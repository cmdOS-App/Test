# Search Bar Scope Analysis: Organization vs Personal Space

## Current State Analysis

### How Search Currently Works

The search bar in the new-tab component **is limited to the currently selected organization's files and folders only**. Here's why:

#### Key Code Flow

1. **Selection of Team Data** (`Searchbar.tsx`, lines 1008-1011):
   ```typescript
   const selectedTeam = useSelector(selectSelectedTeam);
   const teamId = selectedTeam?.team_id || '';
   ```
   The `selectedTeam` is retrieved from Redux and represents **only the currently selected organization**.

2. **Snippet Index Building** (`Searchbar.tsx`, lines 1079-1083):
   ```typescript
   const snippetIndex = useMemo(
     () => buildSnippetIndex(selectedTeam ?? null, noteCommandsMap, linkCommandsMap),
     [selectedTeam, noteCommandsMap, linkCommandsMap],
   );
   const folderIndex = useMemo(() => buildFolderIndex(selectedTeam ?? null), [selectedTeam]);
   ```
   Both the `snippetIndex` and `folderIndex` are built **exclusively from `selectedTeam`** data.

3. **Index Construction** (`snippetSearch.ts`, lines 116-214):
   ```typescript
   export const buildSnippetIndex = (
     team: Team | null | undefined,
     ...
   ): SnippetIndexEntry[] => {
     if (!team?.workspaces) return [];
     // Iterates ONLY over team.workspaces
   }
   ```
   The index is built from a single `team` parameter - no cross-organization searching.

### What is "Personal Space" (Workspace_1)?

Personal Space refers to the user's default private organization, typically named `Workspace_1`, `Workspace 1`, or similar variations matching the pattern `/^workspace[_\s]?\d*$/i`.

In the **SideBar** component (lines 1156-1176), Personal Space is handled separately:
```typescript
// Find the default "Workspace_1" team for Personal Space
const defaultPrivateTeam = useMemo(() => {
  return teams.find(team => /^workspace[_\s]?\d*$/i.test(team.team_name.trim()));
}, [teams]);

// Personal Space workspaces from Workspace_1 (always visible regardless of selected org)
const personalSpaceWorkspaces: EnrichedWorkspace[] = useMemo(() => {
  if (!defaultPrivateTeam?.workspaces) return [];
  // ... processes defaultPrivateTeam workspaces
}, [defaultPrivateTeam, ...]);
```

**Note:** The Personal Space is always visible in the **sidebar** regardless of the selected organization, but it is **NOT included in the search** unless it is the currently selected team.

---

## The Problem

When a user selects "Organization A" in the dropdown:
- ✅ Sidebar shows: Organization A's workspaces/folders + Personal Space (always visible)
- ❌ Search bar searches: **Only Organization A's data** (Personal Space is excluded)

This creates an inconsistency where users can see Personal Space items in the sidebar but cannot search for them unless they switch to Personal Space first.

---

## Solution: Include Personal Space in Search

### Option 1: Merge Personal Space Data into Search Index

**Implementation Steps:**

1. **Update Searchbar.tsx** - Modify the snippet index to include both `selectedTeam` AND `defaultPrivateTeam`:

   ```typescript
   // Add new state/memo for allData to access all teams
   const allData = useSelector(selectAllData);
   
   // Find Personal Space team (Workspace_1)
   const personalSpaceTeam = useMemo(() => {
     if (!allData) return null;
     return allData.find(team => /^workspace[_\s]?\d*$/i.test(team.team_name.trim()));
   }, [allData]);
   
   // Build combined snippet index
   const snippetIndex = useMemo(() => {
     const selectedTeamIndex = buildSnippetIndex(selectedTeam ?? null, noteCommandsMap, linkCommandsMap);
     
     // If selected team IS the personal space, don't duplicate
     if (personalSpaceTeam && 
         selectedTeam?.team_id !== personalSpaceTeam.team_id) {
       const personalSpaceIndex = buildSnippetIndex(personalSpaceTeam, noteCommandsMap, linkCommandsMap);
       return [...selectedTeamIndex, ...personalSpaceIndex];
     }
     
     return selectedTeamIndex;
   }, [selectedTeam, personalSpaceTeam, noteCommandsMap, linkCommandsMap]);
   
   // Similarly for folder index
   const folderIndex = useMemo(() => {
     const selectedTeamFolders = buildFolderIndex(selectedTeam ?? null);
     
     if (personalSpaceTeam && 
         selectedTeam?.team_id !== personalSpaceTeam.team_id) {
       const personalSpaceFolders = buildFolderIndex(personalSpaceTeam);
       return [...selectedTeamFolders, ...personalSpaceFolders];
     }
     
     return selectedTeamFolders;
   }, [selectedTeam, personalSpaceTeam]);
   ```

2. **Required Import:**
   ```typescript
   import { selectAllData } from '../../../../../Redux/AllData/allDataSlice';
   ```

### Option 2: Store Personal Space Team ID in Local Storage

For faster access and to avoid recalculating on every render:

1. **Save Personal Space ID on app initialization** (in `App.tsx` or similar):
   ```typescript
   // When allData loads, save personal space team ID
   useEffect(() => {
     if (allData) {
       const personalSpaceTeam = allData.find(team => 
         /^workspace[_\s]?\d*$/i.test(team.team_name.trim())
       );
       if (personalSpaceTeam) {
         chrome.storage.local.set({ 
           personalSpaceTeamId: personalSpaceTeam.team_id 
         });
       }
     }
   }, [allData]);
   ```

2. **Retrieve and use in Searchbar.tsx:**
   ```typescript
   const [personalSpaceTeamId, setPersonalSpaceTeamId] = useState<string | null>(null);
   
   useEffect(() => {
     chrome.storage.local.get('personalSpaceTeamId', (result) => {
       if (result.personalSpaceTeamId) {
         setPersonalSpaceTeamId(result.personalSpaceTeamId);
       }
     });
   }, []);
   
   // Then use allData to find the team by ID and include in search index
   ```

### Option 3: Search All Organizations (Cross-Org Search)

For power users who need to search everything:

1. **Add a toggle** in the search bar to enable "Search All" mode
2. **When enabled**, iterate over all teams in `allData`:
   ```typescript
   const snippetIndex = useMemo(() => {
     if (!allData || !searchAllOrgs) {
       return buildSnippetIndex(selectedTeam ?? null, noteCommandsMap, linkCommandsMap);
     }
     
     // Combine all teams' snippet indexes
     return allData.flatMap(team => 
       buildSnippetIndex(team, noteCommandsMap, linkCommandsMap)
     );
   }, [allData, selectedTeam, searchAllOrgs, noteCommandsMap, linkCommandsMap]);
   ```

---

## Recommended Approach

**Option 1** (Merge Personal Space) is recommended because:
- ✅ Consistent with sidebar behavior (Personal Space always visible)
- ✅ Minimal code changes
- ✅ No additional storage overhead
- ✅ User doesn't need to toggle or configure anything

---

## Files to Modify

| File | Change |
|------|--------|
| `Searchbar.tsx` | Add `selectAllData` selector, find Personal Space team, merge into search indexes |
| No API changes needed | `getAll()` already returns all organizations including Personal Space |

---

## Data Structure Reference

### API Response (`getAll`)
Returns array of `Team[]`:
```typescript
[
  {
    team_id: "org_123",
    team_name: "Workspace_1",  // Personal Space
    workspaces: [...]
  },
  {
    team_id: "org_456",
    team_name: "My Company",   // Organization
    workspaces: [...]
  }
]
```

### Redux State
- `selectSelectedTeam`: Currently selected organization (single Team)
- `selectAllData`: All organizations (Team[])

---

## Summary

| Aspect | Current State | Proposed State |
|--------|--------------|----------------|
| **Search Scope** | Selected org only | Selected org + Personal Space |
| **Personal Space in Sidebar** | ✅ Always visible | ✅ Always visible |
| **Personal Space in Search** | ❌ Only if selected | ✅ Always searchable |
| **Other Orgs** | Not searchable | Consider "Search All" toggle |
