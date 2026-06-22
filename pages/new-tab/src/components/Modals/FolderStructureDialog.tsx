import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaFolder, FaTimes } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import type { Team, Workspace, Folder } from '../../../../modals/interfaces';
import { selectWorkspacesByTeam } from '../../../../Redux/Workspaces/workspaceSlice';
import type { RootState } from '../../../../Redux/store';

interface FolderStructureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTeam: Team | null;
  onSelectWorkspace: (workspaceId: string, workspaceName: string) => void;
  onSelectFolder: (workspaceId: string, workspaceName: string, folderId: string, folderName: string) => void;
}

interface EnrichedWorkspace extends Workspace {
  type?: string;
  admin_user_id?: string;
}

const FolderStructureDialog: React.FC<FolderStructureDialogProps> = ({
  isOpen,
  onClose,
  selectedTeam,
  onSelectWorkspace,
  onSelectFolder,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const workspacesFromRedux = useSelector((state: RootState) =>
    selectedTeam ? selectWorkspacesByTeam(state, selectedTeam.team_id) : [],
  );
  

  const enrichedWorkspaces: EnrichedWorkspace[] = useMemo(() => {
    if (!selectedTeam?.workspaces || !workspacesFromRedux) return [];

    return selectedTeam.workspaces.map(ws => {
      const meta = workspacesFromRedux.find(w => w.workspace_id === ws.workspace_id) as EnrichedWorkspace;
      return {
        ...ws,
        type: meta?.type,
        admin_user_id: meta?.admin_user_id,
      };
    });
  }, [selectedTeam, workspacesFromRedux]);

  const groupedSearchedWorkspaces = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const groups: Record<string, EnrichedWorkspace[]> = {
      private: [],
      shareonly: [],
      public: [],
    };

    enrichedWorkspaces.forEach(ws => {
      const workspaceMatch = ws.workspace_name.toLowerCase().includes(term);

      const matchingFolders = ws.folders
        ?.map(folder => {
          const folderMatch = folder.folder_name.toLowerCase().includes(term);

          const matchingSnippets = folder.snippets.filter(snippet => {
            const key = snippet.key?.toLowerCase() || '';
            const value = typeof snippet.value === 'string' ? snippet.value.toLowerCase() : '';
            const urls =
              typeof snippet.value === 'object' &&
              snippet.value &&
              'urls' in snippet.value &&
              Array.isArray(snippet.value.urls)
                ? snippet.value.urls.map(u => u.toLowerCase()).join(' ')
                : '';

            return key.includes(term) || value.includes(term) || urls.includes(term);
          });

          if (folderMatch || matchingSnippets.length > 0) {
            return { ...folder, snippets: matchingSnippets };
          }

          return null;
        })
        .filter(Boolean) as Folder[];

      if ((workspaceMatch || matchingFolders.length > 0) && ws.type) {
        groups[ws.type].push({
          ...ws,
          folders: matchingFolders,
        });
      }
    });

    return groups;
  }, [searchTerm, enrichedWorkspaces]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!isOpen || !selectedTeam) return null;

  const typeLabels: Record<string, string> = {
    private: 'Private Workspaces',
    shareonly: 'Shared Workspaces',
    public: 'Public Workspaces',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        className="bg-[var(--color-containerBg)] rounded-xl shadow-2xl w-[700px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col transition-all">
        {/* Header */}
        <div className="flex flex-col p-5 border-b border-[var(--color-borderDefault)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[var(--color-textPrimary)]">Select Location</h2>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all">
              <FaTimes />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search location..."
              className="w-full px-4 py-2 border border-[var(--color-borderDefault)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-neutral-500 hover:text-red-500"
                onClick={() => setSearchTerm('')}>
                x
              </button>
            )}
          </div>
        </div>

        {/* Workspace Listing */}
        <div className="overflow-y-auto p-5 flex-grow custom-scrollbar">
          {Object.values(groupedSearchedWorkspaces).every(group => group.length === 0) ? (
            <div className="text-center text-neutral-500 dark:text-neutral-400 mt-10 mb-10">
              No matching workspaces or folders found.
            </div>
          ) : (
            Object.entries(groupedSearchedWorkspaces).map(
              ([type, workspaces]) =>
                workspaces.length > 0 && (
                  <div key={type} className="mb-8">
                    <h3 className="text-md font-semibold text-[var(--color-textPrimary)] mb-3">
                      {typeLabels[type]}
                    </h3>
                    {workspaces.map(workspace => (
                      <div key={workspace.workspace_id} className="mb-2">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => onSelectWorkspace(workspace.workspace_id, workspace.workspace_name)}
                            className="px-3 py-1 bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-100 rounded-full font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow shrink-0">
                            {workspace.workspace_name}
                          </button>

                          {workspace.folders?.length > 0 && (
                            <div className="flex items-center flex-wrap gap-2 ml-1">
                              <span className="text-neutral-400 mr-1">:</span>
                              {workspace.folders.map(folder => (
                                <button
                                  key={folder.folder_id}
                                  onClick={() =>
                                    onSelectFolder(
                                      workspace.workspace_id,
                                      workspace.workspace_name,
                                      folder.folder_id,
                                      folder.folder_name,
                                    )
                                  }
                                  className="px-3 py-1 bg-[var(--color-containerBg)] text-neutral-700 dark:text-neutral-300 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200 flex items-center gap-1.5 text-sm border border-[var(--color-borderDefault)] hover:shadow-sm">
                                  {folder.folder_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ),
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--color-borderDefault)] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all duration-200 font-medium hover:shadow-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderStructureDialog;
