import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { Team, SavedAutomation } from '../../modals/interfaces';
import { getAll, getUserId } from '../../Apis/core/api';
import { syncCloudDataToLocalStorage } from '../../utils/shortcutHotkeyUtils';

interface AllState {
  data: Team[] | null;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: AllState = {
  data: null,
  loading: false,
  error: null,
};

export interface WorkspaceSnippets {
  id: string;
  key: string;
  value: string;
  category: string;
  tags: string[];
}

// Helper function to ensure a value is always an array
function ensureArray<T>(value: any, fallback: T[] = []): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  // If it's not an array and not null/undefined, log a warning and return empty array
  console.warn('[transformApiResponse] Expected array but got:', typeof value, value);
  return fallback;
}

export function transformApiResponse(apiResponse: any[]): Team[] {
  return apiResponse.map((team: any) => ({
    team_id: team.team_id,
    team_name: team.team_name,
    is_personal_space: !!team.is_personal_space,
    storageMode: team.storageMode ?? 'cloud',
    migrationStatus: team.migrationStatus ?? 'none',
    workspaces: (ensureArray(team.workspaces) || []).map((workspace: any) => ({
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
      type: workspace.type,
      icon: workspace.icon || null,
      color: workspace.color || null,
      workspace_snippets: ensureArray(workspace.workspace_snippets).map((snippet: any) => ({
        id: String(snippet.snippet_id || snippet.id),
        snippet_id: String(snippet.snippet_id || snippet.id),
        key: snippet.key,
        value: snippet.value,
        category: snippet.category,
        user_id: snippet.user_id,
        first_name: snippet.first_name,
        last_name: snippet.last_name,
        created_at: snippet.created_at,
        updated_at: snippet.updated_at,
        tags: snippet.snippet_tags || snippet.tags,
        searchtags: snippet.searchtags || null,
        icon: snippet.icon || null,
        color: snippet.color || null,
        shortcuts: snippet.shortcuts || null,
        hotkeys: snippet.hotkeys || null,
        is_todo_type: !!snippet.is_todo_type,
        event_deadline: snippet.event_deadline || null,
        is_done: !!snippet.is_done,
        is_recurring: !!snippet.is_recurring,
        recurring_cycle: snippet.recurring_cycle || null,
        config: snippet.config,
      })),
      workspace_automations: ensureArray(workspace.workspace_automations).map((auto: any) => ({
        id: auto.id,
        name: auto.name,
        description: auto.description || null,
        user_id: auto.user_id,
        workspace_id: auto.workspace_id || workspace.workspace_id,
        folder_id: auto.folder_id || null,
        created_at: auto.created_at,
        updated_at: auto.updated_at,
        automation_steps: ensureArray(auto.automation_steps),
        // New fields from /automations endpoint
        hotkeys: auto.hotkeys ?? null,
        shortcuts: auto.shortcuts ?? null,
        is_favourite: auto.is_favourite ?? false,
        type: auto.type || 'automation',
        category: auto.category || null,
      })),
      workspace_chat_agents: ensureArray(workspace.workspace_chat_agents),
      chat_agents: ensureArray(workspace.chat_agents),
      folders: ensureArray(workspace.folders).map((folder: any) => ({
        folder_id: folder.folder_id,
        folder_name: folder.folder_name,
        icon: folder.icon || null,
        color: folder.color || null,
        effective_role: folder.effective_role || null,
        snippets: ensureArray(folder.snippets).map((snippet: any) => ({
          id: String(snippet.snippet_id || snippet.id),
          snippet_id: String(snippet.snippet_id || snippet.id),
          key: snippet.key,
          value: snippet.value,
          category: snippet.category,
          user_id: snippet.user_id,
          first_name: snippet.first_name,
          last_name: snippet.last_name,
          created_at: snippet.created_at,
          updated_at: snippet.updated_at,
          tags: snippet.snippet_tags || snippet.tags,
          searchtags: snippet.searchtags || null,
          icon: snippet.icon || null,
          color: snippet.color || null,
          shortcuts: snippet.shortcuts || null,
          hotkeys: snippet.hotkeys || null,
          is_todo_type: !!snippet.is_todo_type,
          event_deadline: snippet.event_deadline || null,
          is_done: !!snippet.is_done,
          is_recurring: !!snippet.is_recurring,
          recurring_cycle: snippet.recurring_cycle || null,
          config: snippet.config,
        })),
        automations: ensureArray(folder.automations).map((auto: any) => ({
          id: auto.id,
          name: auto.name,
          description: auto.description || null,
          user_id: auto.user_id,
          workspace_id: auto.workspace_id || null,
          folder_id: auto.folder_id || folder.folder_id,
          created_at: auto.created_at,
          updated_at: auto.updated_at,
          automation_steps: ensureArray(auto.automation_steps),
          // New fields from /automations endpoint
          hotkeys: auto.hotkeys ?? null,
          shortcuts: auto.shortcuts ?? null,
          is_favourite: auto.is_favourite ?? false,
          type: auto.type || 'automation',
          category: auto.category || null,
        })),
      })),
    })),
  }));
}

// Async thunk to fetch all data
export const fetchAllDataThunk = createAsyncThunk<Team[]>(
  'all/fetchAllData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getAll();



      // Sync cloud shortcuts/hotkeys to local storage for faster access
      try {
        const userId = await getUserId();
        if (userId && response) {
          await syncCloudDataToLocalStorage(response, userId);
        }
      } catch (syncError) {
        console.warn('[fetchAllDataThunk] Failed to sync shortcuts/hotkeys to local storage:', syncError);
        // Don't fail the entire fetch if sync fails
      }

      // Sync cloud automations to chrome.storage.local so Searchbar/background can access them
      try {
        const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;
        if (chromeAny?.storage?.local && Array.isArray(response)) {
          const automationsMap: Record<string, any> = {};

          for (const team of response) {
            for (const ws of team.workspaces || []) {
              // Workspace-level automations
              for (const auto of ws.workspace_automations || []) {
                const localId = String(auto.id);
                automationsMap[localId] = {
                  id: localId,
                  type: 'automation',
                  name: auto.name,
                  description: auto.description || null,
                  workspace_id: auto.workspace_id || ws.workspace_id,
                  folder_id: auto.folder_id || null,
                  steps: (auto.automation_steps || []).map((s: any) => ({
                    id: s.id ? String(s.id) : `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    moduleId: s.module_id,
                    config: s.config || {},
                  })),
                  automation_steps: auto.automation_steps || [],
                  timestamp: new Date(auto.updated_at || auto.created_at).getTime(),
                };
              }

              // Folder-level automations
              for (const folder of ws.folders || []) {
                for (const auto of folder.automations || []) {
                  const localId = String(auto.id);
                  automationsMap[localId] = {
                    id: localId,
                    type: 'automation',
                    name: auto.name,
                    description: auto.description || null,
                    workspace_id: auto.workspace_id || ws.workspace_id,
                    folder_id: auto.folder_id || folder.folder_id,
                    steps: (auto.automation_steps || []).map((s: any) => ({
                      id: s.id ? String(s.id) : `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      moduleId: s.module_id,
                      config: s.config || {},
                    })),
                    automation_steps: auto.automation_steps || [],
                    timestamp: new Date(auto.updated_at || auto.created_at).getTime(),
                  };
                }
              }
            }
          }

          const automationHotkeys: Record<string, string> = {};
          const automationShortcuts: Record<string, string> = {};

          chromeAny.storage.local.set({ automations: automationsMap });

          // Build hotkey / shortcut index for background script & Searchbar
          for (const id of Object.keys(automationsMap)) {
            const raw = automationsMap[id];
            // hotkeys/shortcuts are forwarded via the raw response in automationsMap below
          }
          // Re-iterate the raw response to get hotkeys/shortcuts (automationsMap has processed shape)
          for (const team of response) {
            for (const ws of team.workspaces || []) {
              for (const auto of ws.workspace_automations || []) {
                const id = String(auto.id);
                if (auto.hotkeys) automationHotkeys[id] = auto.hotkeys;
                if (auto.shortcuts) automationShortcuts[id] = auto.shortcuts;
              }
              for (const folder of ws.folders || []) {
                for (const auto of folder.automations || []) {
                  const id = String(auto.id);
                  if (auto.hotkeys) automationHotkeys[id] = auto.hotkeys;
                  if (auto.shortcuts) automationShortcuts[id] = auto.shortcuts;
                }
              }
            }
          }

          // Merge into existing local storage (don't wipe locally-set values not yet synced)
          chromeAny.storage.local.get(['alts_automation_hotkeys', 'alts_automation_shortcuts'], (existing: any) => {
            chromeAny.storage.local.set({
              alts_automation_hotkeys: { ...(existing.alts_automation_hotkeys || {}), ...automationHotkeys },
              alts_automation_shortcuts: {
                ...(existing.alts_automation_shortcuts || {}),
                ...automationShortcuts,
              },
            });
          });
        }
      } catch (syncError) {
        console.warn('[fetchAllDataThunk] Failed to sync automations to local storage:', syncError);
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch all data');
    }
  },
  {
    // Prevent duplicate concurrent fetches — skip if already loading
    condition: (_, { getState }) => {
      const state = getState() as { all: AllState };
      if (state.all.loading) {
        return false;
      }
      return true;
    },
  },
);

const allSlice = createSlice({
  name: 'all',
  initialState,
  reducers: {
    // Set data directly (for loading from cache)
    setData: (state, action: PayloadAction<Team[] | null>) => {
      state.data = action.payload;
    },
    // Optimistically update a snippet in the local state without waiting for API
    optimisticUpdateSnippet: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        folderId?: string | null;
        snippet: {
          id: string;
          key: string;
          value: string | any;
          category: string;
          tags?: any[];
          user_id?: string;
          first_name?: string;
          last_name?: string;
          created_at?: string;
          updated_at?: string;
          searchtags?: Record<string, string[]> | string | null;
        };
      }>,
    ) => {
      if (!state.data) {
        return;
      }

      const { teamId, workspaceId, folderId, snippet } = action.payload;

      // 1. Find existing snippet across all workspaces/folders to preserve existing metadata
      let existingSnippet: any = null;
      state.data.forEach(team => {
        team.workspaces?.forEach(ws => {
          const s1 = ws.workspace_snippets?.find(
            s => String(s.id) === String(snippet.id) || String((s as any).snippet_id) === String(snippet.id),
          );
          if (s1) existingSnippet = { ...s1 };
          ws.folders?.forEach(folder => {
            const s2 = folder.snippets?.find(
              s => String(s.id) === String(snippet.id) || String((s as any).snippet_id) === String(snippet.id),
            );
            if (s2) existingSnippet = { ...s2 };
          });
        });
      });

      // 2. Scrub existing snippet from everywhere to prevent stale duplicate entries
      state.data.forEach(team => {
        team.workspaces?.forEach(ws => {
          if (ws.workspace_snippets) {
            ws.workspace_snippets = ws.workspace_snippets.filter(
              s => String(s.id) !== String(snippet.id) && String((s as any).snippet_id) !== String(snippet.id),
            );
          }
          ws.folders?.forEach(folder => {
            if (folder.snippets) {
              folder.snippets = folder.snippets.filter(
                s => String(s.id) !== String(snippet.id) && String((s as any).snippet_id) !== String(snippet.id),
              );
            }
          });
        });
      });

      const mergedSnippet = {
        ...existingSnippet,
        ...snippet,
        id: String(snippet.id),
        updated_at: new Date().toISOString(),
      };

      // 3. Find target team and workspace
      const teamIndex = state.data.findIndex(team => team.team_id === teamId);
      if (teamIndex === -1) {
        return;
      }

      const workspaceIndex = state.data[teamIndex].workspaces.findIndex(
        workspace => workspace.workspace_id === workspaceId,
      );
      if (workspaceIndex === -1) {
        return;
      }

      // 4. Insert into workspace or folder
      if (!folderId) {
        if (!state.data[teamIndex].workspaces[workspaceIndex].workspace_snippets) {
          state.data[teamIndex].workspaces[workspaceIndex].workspace_snippets = [];
        }
        state.data[teamIndex].workspaces[workspaceIndex].workspace_snippets.push(mergedSnippet);
        return;
      }

      if (!Array.isArray(state.data[teamIndex].workspaces[workspaceIndex].folders)) {
        state.data[teamIndex].workspaces[workspaceIndex].folders = [];
      }
      const folders = state.data[teamIndex].workspaces[workspaceIndex].folders;
      const folderIndex = folders.findIndex(folder => folder.folder_id === folderId);
      if (folderIndex === -1) {
        return;
      }

      if (!Array.isArray(folders[folderIndex].snippets)) {
        folders[folderIndex].snippets = [];
      }
      folders[folderIndex].snippets.push(mergedSnippet);
    },

    // Add a new snippet to the local state
    optimisticAddSnippet: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        folderId?: string | null;
        snippet: {
          id: string;
          key: string;
          value: string | any;
          category: string;
          tags?: any[];
          user_id?: string;
          first_name?: string;
          last_name?: string;
          created_at?: string;
          updated_at?: string;
          searchtags?: Record<string, string[]> | string | null;
        };
      }>,
    ) => {
      if (!state.data) return;

      const { teamId, workspaceId, folderId, snippet } = action.payload;

      // Find the team, workspace, and folder to add the snippet
      const teamIndex = state.data.findIndex(team => team.team_id === teamId);
      if (teamIndex === -1) return;

      const workspaceIndex = state.data[teamIndex].workspaces.findIndex(
        workspace => workspace.workspace_id === workspaceId,
      );
      if (workspaceIndex === -1) return;
      // If folderId is undefined, add snippet directly to workspace
      if (!folderId) {
        // Initialize workspace_snippets array if it doesn't exist
        if (!state.data[teamIndex].workspaces[workspaceIndex].workspace_snippets) {
          state.data[teamIndex].workspaces[workspaceIndex].workspace_snippets = [];
        }

        const existingSnippets = state.data[teamIndex].workspaces[workspaceIndex].workspace_snippets;

        // Check for existing snippet to prevent duplicates
        // 1. Exact ID match
        // 2. Temp ID match (if we are adding a real ID now, replace the temp one)

        let existingIndex = existingSnippets.findIndex(s => {
          const match = String(s.id) === String(snippet.id) || String((s as any).snippet_id) === String(snippet.id);
          return match;
        });

        if (existingIndex === -1 && snippet.id && !snippet.id.startsWith('temp-')) {
          // If we are adding a real ID, look for a matching temp ID to merge
          existingIndex = existingSnippets.findIndex(
            s => String(s.id).startsWith('temp-') && s.key === snippet.key && s.category === snippet.category,
          );
        }

        // Soft Duplicate Check: If adding a temp item, check if real item already exists (race condition)
        if (existingIndex === -1 && String(snippet.id).startsWith('temp-')) {
          const softDuplicateIndex = existingSnippets.findIndex(
            s => s.key === snippet.key && s.category === snippet.category && !String(s.id).startsWith('temp-'),
          );
          if (softDuplicateIndex !== -1) {
            return;
          }
        }

        if (existingIndex !== -1) {
          // Update/Merge existing
          existingSnippets[existingIndex] = {
            ...existingSnippets[existingIndex],
            ...snippet,
            id: String(snippet.id),
            updated_at: snippet.updated_at || new Date().toISOString(),
          };
        } else {
          // Add the new snippet
          existingSnippets.push({
            ...snippet,
            id: String(snippet.id),
            created_at: snippet.created_at || new Date().toISOString(),
            updated_at: snippet.updated_at || new Date().toISOString(),
            user_id: snippet.user_id || '',
            first_name: snippet.first_name || '',
            last_name: snippet.last_name || null,
            tags: snippet.tags || null,
          });
        }
        return;
      }

      // Original folder-based logic - ensure folders is an array
      if (!Array.isArray(state.data[teamIndex].workspaces[workspaceIndex].folders)) {
        state.data[teamIndex].workspaces[workspaceIndex].folders = [];
      }
      const folders = state.data[teamIndex].workspaces[workspaceIndex].folders;
      const folderIndex = folders.findIndex(folder => folder.folder_id === folderId);
      if (folderIndex === -1) return;

      // Ensure snippets array exists
      if (!Array.isArray(folders[folderIndex].snippets)) {
        folders[folderIndex].snippets = [];
      }

      const existingSnippets = folders[folderIndex].snippets;

      // Check for existing snippet to prevent duplicates
      // 1. Exact ID match
      // 2. Temp ID match (if we are adding a real ID now, replace the temp one)
      let existingIndex = existingSnippets.findIndex(
        s => String(s.id) === String(snippet.id) || String((s as any).snippet_id) === String(snippet.id),
      );

      if (existingIndex === -1 && snippet.id && !snippet.id.startsWith('temp-')) {
        // If we are adding a real ID, look for a matching temp ID to merge
        existingIndex = existingSnippets.findIndex(
          s => String(s.id).startsWith('temp-') && s.key === snippet.key && s.category === snippet.category,
        );
      }

      // Soft Duplicate Check: If adding a temp item, check if real item already exists (race condition)
      if (existingIndex === -1 && String(snippet.id).startsWith('temp-')) {
        const softDuplicateIndex = existingSnippets.findIndex(
          s => s.key === snippet.key && s.category === snippet.category && !String(s.id).startsWith('temp-'),
        );
        if (softDuplicateIndex !== -1) {
          return;
        }
      }

      if (existingIndex !== -1) {
        // Update/Merge existing
        existingSnippets[existingIndex] = {
          ...existingSnippets[existingIndex],
          ...snippet,
          id: String(snippet.id),
          updated_at: snippet.updated_at || new Date().toISOString(),
        };
      } else {
        // Add the new snippet
        existingSnippets.push({
          ...snippet,
          id: String(snippet.id),
          created_at: snippet.created_at || new Date().toISOString(),
          updated_at: snippet.updated_at || new Date().toISOString(),
          user_id: snippet.user_id || '',
          first_name: snippet.first_name || '',
          last_name: snippet.last_name || null,
          tags: snippet.tags || null,
        });
      }
    },
    // Workspace-level optimistic updates
    optimisticRenameWorkspace: (
      state,
      action: PayloadAction<{ teamId: string; workspaceId: string; newName: string }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, newName } = action.payload;
      const team = state.data.find(t => t.team_id === teamId);
      if (!team) return;
      const ws = team.workspaces.find(w => w.workspace_id === workspaceId);
      if (ws) {
        ws.workspace_name = newName;
      }
    },
    optimisticDeleteWorkspace: (state, action: PayloadAction<{ teamId?: string; workspaceId: string }>) => {
      if (!state.data) return;
      const { teamId, workspaceId } = action.payload;

      if (teamId) {
        const team = state.data.find(t => t.team_id === teamId);
        if (team) {
          team.workspaces = team.workspaces.filter(w => w.workspace_id !== workspaceId);
          return;
        }
      }

      // Fallback: search all teams
      state.data.forEach(team => {
        team.workspaces = team.workspaces.filter(w => w.workspace_id !== workspaceId);
      });
    },
    optimisticUpdateWorkspace: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        updates: { workspace_name?: string; icon?: string | null; color?: string | null };
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, updates } = action.payload;
      const team = state.data.find(t => t.team_id === teamId);
      if (!team) return;
      const workspace = team.workspaces.find(w => w.workspace_id === workspaceId);
      if (workspace) {
        if (updates.workspace_name !== undefined) workspace.workspace_name = updates.workspace_name;
        if (updates.icon !== undefined) workspace.icon = updates.icon;
        if (updates.color !== undefined) workspace.color = updates.color;
      }
    },
    // ─── Automation Optimistic Reducers ────────────────────────────────────────
    /**
     * Add or replace an automation in the local Redux state immediately after
     * a successful createAutomation API call, before a full refetch.
     */
    optimisticAddAutomation: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        folderId?: string | null;
        automation: SavedAutomation;
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, folderId, automation: rawAuto } = action.payload;
      // Normalize: ensure automation_steps is present if only steps is provided
      const automation = {
        ...rawAuto,
        automation_steps: (rawAuto as any).automation_steps || (rawAuto as any).steps || [],
      };
      const team = state.data.find(t => String(t.team_id) === String(teamId));
      if (!team) return;
      const workspace = team.workspaces.find(w => String(w.workspace_id) === String(workspaceId));
      if (!workspace) return;

      if (!folderId) {
        if (!Array.isArray(workspace.workspace_automations)) workspace.workspace_automations = [];
        const idx = workspace.workspace_automations.findIndex(a => a.id === automation.id);
        if (idx !== -1) {
          workspace.workspace_automations[idx] = automation;
        } else {
          workspace.workspace_automations.push(automation);
        }
        return;
      }

      if (!Array.isArray(workspace.folders)) return;
      const folder = workspace.folders.find(f => f.folder_id === folderId);
      if (!folder) return;
      if (!Array.isArray(folder.automations)) folder.automations = [];
      const idx = folder.automations.findIndex(a => a.id === automation.id);
      if (idx !== -1) {
        folder.automations[idx] = automation;
      } else {
        folder.automations.push(automation);
      }
    },

    /**
     * Optimistically patch an automation's name/description after updateAutomation.
     * Steps are not patched locally — a refetch will reconcile them.
     */
    optimisticUpdateAutomation: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        folderId?: string | null;
        automationId: number;
        updates: Partial<
          Pick<SavedAutomation, 'name' | 'description' | 'automation_steps' | 'hotkeys' | 'shortcuts' | 'is_favourite'>
        >;
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, folderId, automationId, updates } = action.payload;
      const targetId = Number(automationId);

      // 1. Find existing automation across all workspaces/folders to preserve existing metadata
      let existingAuto: any = null;
      state.data.forEach(team => {
        team.workspaces?.forEach(ws => {
          const a1 = ws.workspace_automations?.find(a => Number(a.id) === targetId);
          if (a1) existingAuto = { ...a1 };
          ws.folders?.forEach(folder => {
            const a2 = folder.automations?.find(a => Number(a.id) === targetId);
            if (a2) existingAuto = { ...a2 };
          });
        });
      });

      if (!existingAuto) return;

      // 2. Scrub existing automation from everywhere to prevent stale duplicate entries
      state.data.forEach(team => {
        team.workspaces?.forEach(ws => {
          if (ws.workspace_automations) {
            ws.workspace_automations = ws.workspace_automations.filter(a => Number(a.id) !== targetId);
          }
          ws.folders?.forEach(folder => {
            if (folder.automations) {
              folder.automations = folder.automations.filter(a => Number(a.id) !== targetId);
            }
          });
        });
      });

      const mergedAuto = {
        ...existingAuto,
        ...updates,
        id: targetId,
        updated_at: new Date().toISOString(),
      };

      // 3. Find target team and workspace
      const team = state.data.find(t => String(t.team_id) === String(teamId));
      if (!team) return;
      const workspace = team.workspaces.find(w => String(w.workspace_id) === String(workspaceId));
      if (!workspace) return;

      // 4. Insert into workspace or folder
      if (!folderId) {
        if (!workspace.workspace_automations) workspace.workspace_automations = [];
        workspace.workspace_automations.push(mergedAuto);
        return;
      }

      if (!Array.isArray(workspace.folders)) workspace.folders = [];
      const folder = workspace.folders.find(f => String(f.folder_id) === String(folderId));
      if (!folder) return;
      if (!Array.isArray(folder.automations)) folder.automations = [];
      folder.automations.push(mergedAuto);
    },

    /**
     * Optimistically remove an automation from the local Redux state after deleteAutomation.
     */
    optimisticDeleteAutomation: (
      state,
      action: PayloadAction<{
        teamId?: string;
        workspaceId?: string;
        folderId?: string | null;
        automationId: number | string;
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, folderId, automationId } = action.payload;
      const targetId = Number(automationId);

      // Recursive helper to scrub from all teams/workspaces/folders
      state.data.forEach(team => {
        if (teamId && team.team_id !== teamId) return;

        team.workspaces.forEach(ws => {
          if (workspaceId && ws.workspace_id !== workspaceId) return;

          // Workspace level
          if (!folderId || folderId === null) {
            ws.workspace_automations = (ws.workspace_automations || []).filter(a => Number(a.id) !== targetId);
          }

          // Folders
          ws.folders.forEach(folder => {
            if (folderId && folder.folder_id !== folderId) return;
            folder.automations = (folder.automations || []).filter(a => Number(a.id) !== targetId);
          });
        });
      });
    },

    /**
     * Optimistically remove a snippet (Link/Note) from the local Redux state.
     */
    optimisticDeleteSnippet: (
      state,
      action: PayloadAction<{
        teamId?: string;
        workspaceId?: string;
        folderId?: string | null;
        snippetId: string;
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, folderId, snippetId } = action.payload;

      state.data.forEach(team => {
        if (teamId && team.team_id !== teamId) return;

        team.workspaces.forEach(ws => {
          if (workspaceId && ws.workspace_id !== workspaceId) return;

          // Workspace level
          if (!folderId || folderId === null) {
            ws.workspace_snippets = (ws.workspace_snippets || []).filter(
              s => String(s.id) !== String(snippetId) && String((s as any).snippet_id) !== String(snippetId),
            );
          }

          // Folders
          ws.folders.forEach(folder => {
            if (folderId && folder.folder_id !== folderId) return;
            folder.snippets = (folder.snippets || []).filter(
              s => String(s.id) !== String(snippetId) && String((s as any).snippet_id) !== String(snippetId),
            );
          });
        });
      });
    },
    // ─── optimisticToggleFavourite ──────────────────────────────────────────────
    /**
     * Optimistically flip is_favourite on a single automation in Redux
     * after a successful PUT /update_automation call.
     */
    optimisticToggleFavourite: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        folderId?: string | null;
        automationId: number;
        isFavourite: boolean;
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, folderId, automationId, isFavourite } = action.payload;
      const team = state.data.find(t => t.team_id === teamId);
      if (!team) return;
      const workspace = team.workspaces.find(w => w.workspace_id === workspaceId);
      if (!workspace) return;

      if (!folderId) {
        const auto = workspace.workspace_automations?.find(a => a.id === automationId);
        if (auto) auto.is_favourite = isFavourite;
        return;
      }

      const folder = workspace.folders?.find(f => f.folder_id === folderId);
      if (!folder) return;
      const auto = folder.automations?.find(a => a.id === automationId);
      if (auto) auto.is_favourite = isFavourite;
    },
    // ─── End Automation Optimistic Reducers ───────────────────────────────────────────────────────────

    replaceTeam: (
      state,
      action: PayloadAction<{
        oldOrgId: string;
        newOrg: Team;
      }>
    ) => {
      if (!state.data) return;
      const { oldOrgId, newOrg } = action.payload;
      state.data = state.data.map(team =>
        team.team_id === oldOrgId ? newOrg : team
      );
    },

    optimisticUpdateFolder: (
      state,
      action: PayloadAction<{
        teamId: string;
        workspaceId: string;
        folderId: string;
        updates: { folder_name?: string; icon?: string | null; color?: string | null };
      }>,
    ) => {
      if (!state.data) return;
      const { teamId, workspaceId, folderId, updates } = action.payload;
      const team = state.data.find(t => t.team_id === teamId);
      if (!team) return;
      const workspace = team.workspaces.find(w => w.workspace_id === workspaceId);
      if (!workspace || !Array.isArray(workspace.folders)) return;
      const folder = workspace.folders.find(f => f.folder_id === folderId);
      if (folder) {
        if (updates.folder_name !== undefined) folder.folder_name = updates.folder_name;
        if (updates.icon !== undefined) folder.icon = updates.icon;
        if (updates.color !== undefined) folder.color = updates.color;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAllDataThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllDataThunk.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        const allData: Team[] = transformApiResponse(action.payload);
        state.data = allData;
      })
      .addCase(fetchAllDataThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const {
  setData,
  optimisticUpdateSnippet,
  optimisticAddSnippet,
  optimisticRenameWorkspace,
  optimisticDeleteWorkspace,
  optimisticUpdateWorkspace,
  optimisticUpdateFolder,
  optimisticAddAutomation,
  optimisticUpdateAutomation,
  optimisticDeleteAutomation,
  optimisticDeleteSnippet,
  optimisticToggleFavourite,
  replaceTeam,
} = allSlice.actions;

// You can export selectors if needed
export const selectAllData = (state: RootState) => state.all.data;
export const selectAllDataLoading = (state: RootState) => state.all.loading;
export const selectAllDataError = (state: RootState) => state.all.error;

export default allSlice.reducer;
