import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { FaFolder, FaSearch, FaGlobe, FaUsers, FaLock } from 'react-icons/fa';
import { MdLockOutline } from 'react-icons/md';
import type { Team, Workspace, Folder } from '../../../../modals/interfaces';
import type { RootState } from '../../../../Redux/store';
import { selectWorkspacesByTeam } from '../../../../Redux/Workspaces/workspaceSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import { selectSelectedTeam, queueNotification, selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import clsx from 'clsx';

interface SaveDestinationPickerProps {
  team: Team | null;
  personalWorkspaces?: Workspace[];
  currentSelection?: { workspaceId?: string | null; folderId?: string | null };
  onSelectWorkspace: (workspace: Workspace, isPersonal?: boolean) => void;
  onSelectFolder: (workspace: Workspace, folder: Folder, isPersonal?: boolean, folderPath?: Folder[]) => void;
  onClose: () => void;
  className?: string;
}

type PickerItem =
  | {
      type: 'workspace';
      workspace: Workspace;
      isPersonal?: boolean;
    }
  | {
      type: 'folder';
      workspace: Workspace;
      folder: Folder;
      folderPath: Folder[]; // Full path from root to this folder
      isPersonal?: boolean;
    }
  | {
      type: 'header';
      label: string;
    }
  | {
      type: 'org-header';
      teamName: string;
    };

const SaveDestinationPicker: React.FC<SaveDestinationPickerProps> = ({
  team,
  personalWorkspaces = [],
  currentSelection,
  onSelectWorkspace,
  onSelectFolder,
  onClose,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Get Personal Space data directly from Redux (matching SideBar approach)
  const allTeams = useSelector(selectAllData);
  const [localTeams, setLocalTeams] = useState<Team[] | null>(null);

  // Fetch cached data if Redux is empty
  useEffect(() => {
    if (!allTeams) {
      chrome.storage.local.get(['myCachedAllData'], result => {
        if (result.myCachedAllData && Array.isArray(result.myCachedAllData)) {
          setLocalTeams(result.myCachedAllData);
        }
      });
    }
  }, [allTeams]);

  const effectiveAllTeams = allTeams || localTeams;

  const defaultPrivateTeam = useMemo(() => {
    if (!effectiveAllTeams) return null;
    return effectiveAllTeams.find(t => t.is_personal_space === true || t.team_name === 'Personal Space');
  }, [effectiveAllTeams]);

  // Auto-detect organization team from Redux when team prop is null
  const defaultOrgTeam = useMemo(() => {
    if (!effectiveAllTeams) return null;
    return effectiveAllTeams.find(t => t.is_personal_space !== true) || null;
  }, [effectiveAllTeams]);

  // Use internally fetched teams if props are empty
  const effectivePersonalWorkspaces =
    personalWorkspaces.length > 0 ? personalWorkspaces : defaultPrivateTeam?.workspaces || [];
  const effectiveOrgTeam = team || defaultOrgTeam;

  // Get enriched workspace data using the effective team ID
  const effectiveOrgTeamId = effectiveOrgTeam?.team_id || '';
  const workspacesFromRedux = useSelector((state: RootState) => selectWorkspacesByTeam(state, effectiveOrgTeamId));

  const effectivePersonalTeamId = defaultPrivateTeam?.team_id || '';
  const personalWorkspacesFromRedux = useSelector((state: RootState) => selectWorkspacesByTeam(state, effectivePersonalTeamId));

  const normalizedQuery = debouncedQuery.trim().toLowerCase();

  const flattenedItems: PickerItem[] = useMemo(() => {
    const items: PickerItem[] = [];
    const MAX_RESULTS = 100;

    const pushWorkspaceWithFolders = (workspace: Workspace, isPersonal = false) => {
      if (items.length >= MAX_RESULTS) return;
      items.push({ type: 'workspace', workspace, isPersonal });

      // Recursively add folders with their paths
      const addFoldersRecursive = (folders: Folder[], parentPath: Folder[] = []) => {
        if (items.length >= MAX_RESULTS) return;

        for (const folder of folders || []) {
          if (items.length >= MAX_RESULTS) return;
          const currentPath = [...parentPath, folder];
          items.push({ type: 'folder', workspace, folder, folderPath: currentPath, isPersonal });

          if (folder.folders && folder.folders.length > 0) {
            addFoldersRecursive(folder.folders, currentPath);
          }
        }
      };
      // In Default View, limiting recursion depth or count per workspace might be better UX,
      // but for now keeping original logic to show "everything" up to MAX_RESULTS.
      addFoldersRecursive(workspace.folders || []);
    };

    const pushSearchedWorkspace = (workspace: Workspace, isPersonal = false) => {
      // Don't cap here immediately, let logic decide
      // But we track items.length to stop
      if (items.length >= MAX_RESULTS) return;

      let workspaceAdded = false;
      const wsNameMatch = workspace.workspace_name?.toLowerCase().includes(normalizedQuery);

      // If workspace matches, we add it.
      // Optimized: If workspace matches, we might want to verify if it has matching folders?
      // Or just show it as a destination? Assuming just show as destination.
      if (wsNameMatch) {
        items.push({ type: 'workspace', workspace, isPersonal });
        workspaceAdded = true;
      }

      // Recursively search folders
      const searchFoldersRecursive = (folders: Folder[], parentPath: Folder[] = []) => {
        if (items.length >= MAX_RESULTS) return;

        for (const folder of folders || []) {
          if (items.length >= MAX_RESULTS) return;

          const folderName = folder.folder_name || '';
          const currentPath = [...parentPath, folder];
          let folderMatches = false;

          if (folderName.toLowerCase().includes(normalizedQuery)) {
            items.push({ type: 'folder', workspace, folder, folderPath: currentPath, isPersonal });
            folderMatches = true;
          }

          // If folder matches OR we are just searching children
          if (folder.folders && folder.folders.length > 0) {
            searchFoldersRecursive(folder.folders, currentPath);
          }
        }
      };

      searchFoldersRecursive(workspace.folders || []);
    };

    // ============================================
    // Logic Split: SEARCH vs DEFAULT
    // ============================================

    if (normalizedQuery.length > 0) {
      // --- SEARCH MODE ---

      // 1. Personal Space
      if (effectivePersonalWorkspaces.length > 0) {
        const startIndex = items.length;
        effectivePersonalWorkspaces.forEach(ws => pushSearchedWorkspace(ws, true));

        // Add Header if items were added
        if (items.length > startIndex) {
          items.splice(startIndex, 0, { type: 'header', label: 'Folders' });
        }
      }

      // 2. Organization Workspaces
      if (effectiveOrgTeam && effectiveOrgTeam.workspaces && effectiveOrgTeam.workspaces.length > 0) {
        // Enrich workspaces with type
        const enrichedOrgWorkspaces = effectiveOrgTeam.workspaces.map(ws => {
          const meta = workspacesFromRedux?.find(w => w.workspace_id === ws.workspace_id) as any;
          return {
            ...ws,
            type: (ws as any).type || meta?.type || 'public',
          };
        });

        const privateWorkspaces = enrichedOrgWorkspaces.filter((ws: any) => ws.type === 'private');
        const sharedOnlyWorkspaces = enrichedOrgWorkspaces.filter((ws: any) => ws.type === 'shareonly');
        const publicWorkspaces = enrichedOrgWorkspaces.filter((ws: any) => ws.type === 'public');

        const orgStartIndex = items.length;

        // Private
        const privStartIndex = items.length;
        privateWorkspaces.forEach(ws => pushSearchedWorkspace(ws, false));
        if (items.length > privStartIndex) {
          items.splice(privStartIndex, 0, { type: 'header', label: 'Private Folders' });
        }

        // Shared
        const sharedStartIndex = items.length;
        sharedOnlyWorkspaces.forEach(ws => pushSearchedWorkspace(ws, false));
        if (items.length > sharedStartIndex) {
          items.splice(sharedStartIndex, 0, { type: 'header', label: 'Shared Only Folders' });
        }

        // Public
        const publicStartIndex = items.length;
        publicWorkspaces.forEach(ws => pushSearchedWorkspace(ws, false));
        if (items.length > publicStartIndex) {
          items.splice(publicStartIndex, 0, { type: 'header', label: 'Public Folders' });
        }

        // If ANY org items were added, add Org Header at the very top of this section
        if (items.length > orgStartIndex) {
          items.splice(orgStartIndex, 0, { type: 'org-header', teamName: effectiveOrgTeam.team_name });
        }
      }
    } else {
      // --- DEFAULT MODE ---
      // Show structure normally (Workspaces + Folders)

      // 1. Personal Space
      if (effectivePersonalWorkspaces.length > 0) {
        items.push({ type: 'header', label: 'Folders' });
        
        const enrichedPersonalWorkspaces = effectivePersonalWorkspaces.map(ws => {
          const meta = personalWorkspacesFromRedux?.find(w => w.workspace_id === ws.workspace_id) as any;
          return {
            ...ws,
            folders: meta?.folders || ws.folders || [],
          };
        });

        enrichedPersonalWorkspaces.forEach(ws => pushWorkspaceWithFolders(ws, true));
      }
      if (effectiveOrgTeam && effectiveOrgTeam.workspaces && effectiveOrgTeam.workspaces.length > 0) {
        // Enrich workspaces
        const enrichedOrgWorkspaces = effectiveOrgTeam.workspaces.map(ws => {
          const meta = workspacesFromRedux?.find(w => w.workspace_id === ws.workspace_id) as any;
          return {
            ...ws,
            type: (ws as any).type || meta?.type || 'public',
            folders: meta?.folders || ws.folders || [],
          };
        });

        items.push({ type: 'org-header', teamName: effectiveOrgTeam.team_name });

        const privateWorkspaces = enrichedOrgWorkspaces.filter((ws: any) => ws.type === 'private');
        const sharedOnlyWorkspaces = enrichedOrgWorkspaces.filter((ws: any) => ws.type === 'shareonly');
        const publicWorkspaces = enrichedOrgWorkspaces.filter((ws: any) => ws.type === 'public');

        // Private
        if (privateWorkspaces.length > 0) {
          items.push({ type: 'header', label: 'Private Folders' });
          privateWorkspaces.forEach(ws => pushWorkspaceWithFolders(ws, false));
        }

        // Shared
        if (sharedOnlyWorkspaces.length > 0) {
          items.push({ type: 'header', label: 'Shared Only Folders' });
          sharedOnlyWorkspaces.forEach(ws => pushWorkspaceWithFolders(ws, false));
        }

        // Public
        if (publicWorkspaces.length > 0) {
          items.push({ type: 'header', label: 'Public Folders' });
          publicWorkspaces.forEach(ws => pushWorkspaceWithFolders(ws, false));
        }
      }
    }

    if (items.length >= MAX_RESULTS) {
      items.push({ type: 'header', label: 'Maximum results reached. Please refine search.' });
    }

    return items;
  }, [effectiveOrgTeam, effectivePersonalWorkspaces, normalizedQuery, workspacesFromRedux]);

  useEffect(() => {
    // Initialize active index to first selectable item
    const firstSelectableIndex = flattenedItems.findIndex(item => item.type !== 'header' && item.type !== 'org-header');
    setActiveIndex(prev => {
      // If previous index is still valid & selectable, keep it?
      // Or reset to 0 on new search results?
      // Resetting to 0 (or first selectable) is safer for search changes.
      return firstSelectableIndex >= 0 ? firstSelectableIndex : 0;
    });
  }, [flattenedItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!flattenedItems.length) return;

      const isHeader = (index: number) =>
        flattenedItems[index].type === 'header' || flattenedItems[index].type === 'org-header';

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(prev => {
          let next = prev + 1;
          while (next < flattenedItems.length && isHeader(next)) {
            next++;
          }
          return next < flattenedItems.length ? next : prev;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(prev => {
          let next = prev - 1;
          while (next >= 0 && isHeader(next)) {
            next--;
          }
          // Scan forward if we hit top and it was header? No, prevent going above 0.
          // If 0 is header, we should probably select next selectable?
          // Logic: find prev selectable. if none, stay.
          return next >= 0 ? next : prev;
        });
      } else if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        // Only handle plain Enter
        event.preventDefault();
        const item = flattenedItems[activeIndex];
        if (!item) return;
        if (item.type === 'workspace') {
          onSelectWorkspace(item.workspace, item.isPersonal);
          onClose();
        } else if (item.type === 'folder') {
          onSelectFolder(item.workspace, item.folder, item.isPersonal, item.folderPath);
          onClose();
        }
      } else if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, flattenedItems, onClose, onSelectFolder, onSelectWorkspace]);

  useEffect(() => {
    const timeout = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeout);
  }, []);

  // Removed early return - let picker render and show data as it loads from Redux

  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "w-full rounded-xl shadow-xl border p-3 space-y-2",
        "border-white/10 bg-[var(--color-containerBg)]",
        className
      )}>
      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)]" size={12} />
        <input
          ref={searchInputRef}
          className={clsx(
            "w-full pl-8 pr-3 py-2 text-sm rounded-lg focus:outline-none transition-all",
            "text-neutral-100 bg-[var(--color-inputBg)] focus:ring-neutral-700/40 placeholder:text-neutral-500 border-neutral-800" 
          )}
          placeholder="Search folders or workspaces"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
          }}
        />
      </div>
      <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1">
        {flattenedItems.length === 0 ? (
          <div className={clsx("text-sm px-1 py-6 text-center", "text-neutral-500")}>
            {!effectiveAllTeams ? 'Loading...' : 'No matches found.'}
          </div>
        ) : (
          flattenedItems.map((item, index) => {
            const isActive = index === activeIndex;
            const activeClass = isActive
              ? 'bg-[var(--color-activeBg)] text-white'
              : 'text-neutral-300 hover:text-white';

            // Organization header with logo and name
            if (item.type === 'org-header') {
              return (
                <React.Fragment key={`org-${item.teamName}-${index}`}>
                  {/* Add separator if it's not the very first item */}
                  {index > 0 && <div className={clsx("border-t my-2", "border-white/10")} />}
                  <div className="px-2 pt-2 pb-1 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-[8px] font-bold">
                        {item.teamName?.charAt(0).toUpperCase() || 'O'}
                      </span>
                    </div>
                    <span className={clsx("text-[11px] font-semibold", "text-neutral-400")}>
                      {item.teamName}
                    </span>
                  </div>
                </React.Fragment>
              );
            }

            if (item.type === 'header') {
              const prevItem = index > 0 ? flattenedItems[index - 1] : null;
              const isFirstInSection = prevItem && prevItem.type === 'org-header';
              const needsSeparator = index > 0 && !isFirstInSection;

              return (
                <React.Fragment key={`hdr-${item.label}-${index}`}>
                  {needsSeparator && <div className={clsx("border-t my-2", "border-white/10")} />}
                  <div className={clsx("px-2 pt-2 pb-1 text-[11px] font-semibold flex items-center gap-2 uppercase tracking-wider", "text-neutral-500")}>
                    {item.label === 'Folders' && (
                      <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">F</div>
                    )}
                    {item.label}
                  </div>
                </React.Fragment>
              );
            }

            if (item.type === 'workspace') {
              return (
                <button
                  ref={isActive ? activeItemRef : null}
                  key={`ws-${item.workspace.workspace_id}-${index}`}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(item.workspace, item.isPersonal);
                    onClose();
                  }}
                  className={clsx(
                    "w-full group relative flex items-center gap-2 pl-8 pr-3 py-2 rounded-lg transition-colors",
                    "hover:bg-[var(--color-hoverBg)]",
                    activeClass
                  )}>
                  {/* Type Icon on Hover */}
                  <span className="absolute left-2.5 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(() => {
                      if (item.isPersonal) return <FaLock size={12} />;
                      const wsType = (item.workspace as any).type;
                      if (wsType === 'public') return <FaGlobe size={12} />;
                      if (wsType === 'shareonly' || wsType === 'shared') return <FaUsers size={12} />;
                      return <FaLock size={12} />;
                    })()}
                  </span>

                  <FaFolder className="text-[var(--color-iconDefault)] shrink-0" size={14} />
                  <span className="text-sm font-normal truncate">{item.isPersonal && item.workspace.workspace_name === "Your shortcuts" ? "Folders" : item.workspace.workspace_name}</span>
                </button>
              );
            }

            return (
              <button
                ref={isActive ? activeItemRef : null}
                key={`fld-${item.folder.folder_id}-${index}`}
                type="button"
                onClick={() => {
                  onSelectFolder(item.workspace, item.folder, item.isPersonal, item.folderPath);
                  onClose();
                }}
                className={clsx(
                  "w-full group relative flex items-center gap-3 pl-12 pr-3 py-2 rounded-lg transition-colors",
                  "hover:bg-[var(--color-hoverBg)]",
                  activeClass
                )}>
                {/* Type Icon on Hover */}
                <span className="absolute left-6 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(() => {
                    if (item.isPersonal) return <FaLock size={12} />;
                    const wsType = (item.workspace as any).type;
                    if (wsType === 'public') return <FaGlobe size={12} />;
                    if (wsType === 'shareonly' || wsType === 'shared') return <FaUsers size={12} />;
                    return <FaLock size={12} />;
                  })()}
                </span>

                <FaFolder className="text-[var(--color-iconDefault)] shrink-0" size={14} />
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-sm font-normal truncate">{item.folder.folder_name}</span>
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 truncate leading-tight">
                    in {item.isPersonal && item.workspace.workspace_name === "Your shortcuts" ? "Personal Space" : item.workspace.workspace_name}
                    {item.folderPath.length > 1 && ` > ${item.folderPath.slice(0, -1).map(f => f.folder_name).join(' > ')}`}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SaveDestinationPicker;
