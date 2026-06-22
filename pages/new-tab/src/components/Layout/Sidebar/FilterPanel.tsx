import React, { useEffect, useState, useMemo } from 'react';
import { FaLink, FaFileAlt, FaCheck, FaRegFolder } from 'react-icons/fa';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import { BsStars } from 'react-icons/bs';
import { FiX } from 'react-icons/fi';
import { getMembersInOrganization } from '../../../../../Apis/features/workspaceApiServices';
import { getAvatarColor, getInitials } from '../../../utils/avatarColors';
import { getUserId } from '../../../../../Apis/core/api';
import { useSelector } from 'react-redux';
import {
  selectDarkMode,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectHoverContext,
  selectSelectedTeam,
} from '../../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../../Redux/AllData/allDataSlice';
import type { Folder, Snippet, Workspace } from '../../../../../modals/interfaces';

interface OrganizationMember {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  image_url?: string;
  role: 'admin' | 'editor' | 'viewer' | 'contributor';
}

export type ContentFilterType = 'all' | 'links' | 'notes' | 'prompts';

export interface FilterState {
  assignees: string[]; // Array of user_ids
  contentType: ContentFilterType;
}

interface FilterPanelProps {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  filterState: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ orgId, isOpen, onClose, filterState, onFilterChange }) => {
  const isDarkMode = useSelector(selectDarkMode);
  const teams = useSelector(selectAllData) || [];
  const selectedTeamFromRedux = useSelector(selectSelectedTeam);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const hoverContext = useSelector(selectHoverContext);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- CONTEXT-AWARE OWNER SCRAPING LOGIC ---
  const activeOwnerIds = useMemo(() => {
    if (!teams || teams.length === 0) return null;
    const ownerIds = new Set<string>();

    const collectFromFolders = (folders: Folder[]) => {
      if (!folders) return;
      folders.forEach(folder => {
        if (folder.snippets) {
          folder.snippets.forEach((snippet: Snippet) => {
            if (snippet.user_id) ownerIds.add(snippet.user_id);
          });
        }
        if (folder.folders) {
          collectFromFolders(folder.folders);
        }
      });
    };

    const collectFromWorkspace = (workspace: Workspace) => {
      if (workspace.workspace_snippets) {
        workspace.workspace_snippets.forEach((snippet: Snippet) => {
          if (snippet.user_id) ownerIds.add(snippet.user_id);
        });
      }
      if (workspace.folders) {
        collectFromFolders(workspace.folders);
      }
    };

    // --- PRIORITIZED CONTEXT: HOVER ---
    if (hoverContext) {
      const { type, id } = hoverContext;

      if (type === 'personal') {
        const personalTeam = teams.find(t => t.is_personal_space === true);
        if (personalTeam?.workspaces) {
          personalTeam.workspaces.forEach(collectFromWorkspace);
        }
      } else if (type === 'org') {
        const currentOrgTeam = selectedTeamFromRedux || teams.find(t => t.team_id === orgId);
        if (currentOrgTeam?.workspaces) {
          currentOrgTeam.workspaces.forEach(collectFromWorkspace);
        }
      } else if (type === 'folder' && id) {
        let targetFolder: Folder | null = null;
        const findFolder = (folders: Folder[]) => {
          for (const f of folders) {
            if (f.folder_id === id) {
              targetFolder = f;
              return;
            }
            if (f.folders) findFolder(f.folders as Folder[]);
            if (targetFolder) return;
          }
        };

        teams.forEach(t => {
          t.workspaces?.forEach(w => {
            if (w.folders) findFolder(w.folders as Folder[]);
          });
        });

        if (targetFolder) {
          if ((targetFolder as Folder).snippets) {
            (targetFolder as Folder).snippets.forEach((s: Snippet) => {
              if (s.user_id) ownerIds.add(s.user_id);
            });
          }
        }
      } else if (type === 'workspace' && id) {
        let targetWorkspace: Workspace | null = null;
        for (const t of teams) {
          const ws = t.workspaces?.find(w => w.workspace_id === id);
          if (ws) {
            targetWorkspace = ws;
            break;
          }
        }

        if (targetWorkspace) {
          if (targetWorkspace.workspace_snippets) {
            targetWorkspace.workspace_snippets.forEach(s => {
              if (s.user_id) ownerIds.add(s.user_id);
            });
          }
          if (targetWorkspace.folders) {
            targetWorkspace.folders.forEach(f => {
              if (f.snippets) {
                f.snippets.forEach(s => {
                  if (s.user_id) ownerIds.add(s.user_id);
                });
              }
            });
          }
        }
      }

      const hoverResult = ownerIds.size > 0 ? Array.from(ownerIds).sort() : null;
      if (hoverResult) return hoverResult;
    }

    // --- SECONDARY CONTEXT: NAVIGATION ---
    if (selectedFolder) {
      if (selectedFolder.snippets) {
        selectedFolder.snippets.forEach((snippet: Snippet) => {
          if (snippet.user_id) ownerIds.add(snippet.user_id);
        });
      }
      if (selectedFolder.folders) {
        collectFromFolders(selectedFolder.folders as Folder[]);
      }
    } else if (selectedWorkspace) {
      collectFromWorkspace(selectedWorkspace);
    } else {
      const currentOrgTeam = selectedTeamFromRedux || teams.find(t => t.team_id === orgId);
      if (currentOrgTeam?.workspaces) {
        currentOrgTeam.workspaces.forEach(collectFromWorkspace);
      }

      const personalSpaceTeam = teams.find(t => t.is_personal_space === true);
      if (personalSpaceTeam && personalSpaceTeam.team_id !== currentOrgTeam?.team_id) {
        if (personalSpaceTeam.workspaces) {
          personalSpaceTeam.workspaces.forEach(collectFromWorkspace);
        }
      }
    }

    return ownerIds.size > 0 ? Array.from(ownerIds).sort() : null;
  }, [teams, selectedWorkspace, selectedFolder, hoverContext, orgId, selectedTeamFromRedux]);

  // Use a second memo to ensure the reference only changes if the CONTENT changes
  // This prevents infinite re-render loops in the useEffect that depends on these IDs
  const stableActiveOwnerIds = useMemo(() => {
    return activeOwnerIds;
  }, [JSON.stringify(activeOwnerIds)]);

  // Auto-clear selected assignees when the context (activeOwnerIds) changes
  // This logic is now handled correctly by SideBar's applyContextualFilter, which completely overrides assignees based on context.
  // We removed the conflicting useEffect to fix the bug where moving the mouse off a folder cleared the filter panel.

  // Fetch current user ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userId = await getUserId();
        setCurrentUserId(userId);
      } catch (err) {
        console.error('Failed to fetch current user ID:', err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch organization members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!orgId || !isOpen) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getMembersInOrganization(orgId);
        if (data?.members) {
          setMembers(data.members);
        } else if (Array.isArray(data)) {
          setMembers(data);
        }
      } catch (err: any) {
        console.error('Failed to fetch org members:', err);
        setError(err?.message || 'Failed to load members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [orgId, isOpen]);

  // Sort members to put current user first
  const sortedMembers = useMemo(() => {
    if (!currentUserId) return members;
    return [...members].sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      return 0;
    });
  }, [members, currentUserId]);

  // Filter members by content owners if provided
  const finalMembers = useMemo(() => {
    if (!stableActiveOwnerIds) return sortedMembers;
    return sortedMembers.filter(m => stableActiveOwnerIds.includes(m.user_id));
  }, [sortedMembers, stableActiveOwnerIds]);

  const handleAssigneeToggle = (userId: string) => {
    const newAssignees = filterState.assignees.includes(userId)
      ? filterState.assignees.filter((id: string) => id !== userId)
      : [...filterState.assignees, userId];

    onFilterChange({
      ...filterState,
      assignees: newAssignees,
    });
  };

  const handleContentTypeChange = (type: ContentFilterType) => {
    onFilterChange({
      ...filterState,
      contentType: type,
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      assignees: [],
      contentType: 'all',
    });
  };

  const hasActiveFilters = filterState.assignees.length > 0 || filterState.contentType !== 'all';

  if (!isOpen) return null;

  return (
    <div
      className={`w-72 border-l shadow-lg flex flex-col overflow-hidden ${isDarkMode ? 'bg-[var(--color-panelBg)] border-neutral-700' : 'bg-[#fdf6e3] border-[#eee8d5]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#eee8d5] dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">Filters</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-700'
                } hover:bg-neutral-100 dark:hover:bg-neutral-800`}>
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className={`ml-0.5 p-1 rounded-md transition-colors ${isDarkMode
                ? 'text-neutral-400 hover:text-neutral-100 hover:bg-white/10'
                : 'text-red-300 hover:text-red-400 hover:bg-red-50'
              }`}>
            <FiX size={16} />
          </button>
        </div>
      </div>

      {/* Content Type Tabs */}
      <div className={`px-3 pt-3 pb-2 border-b ${isDarkMode ? 'border-neutral-700' : 'border-[#eee8d5]'}`}>
        <div
          className={`flex items-center justify-center p-1 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-[#eee8d5]'}`}>
          <button
            onClick={() => handleContentTypeChange('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterState.contentType === 'all'
                ? 'bg-[#fdf6e3] dark:bg-neutral-700 text-[#073642] dark:text-neutral-100 shadow-sm'
                : 'text-[#586e75] dark:text-neutral-500 hover:text-[#073642] dark:hover:text-neutral-300'
              }`}>
            All
          </button>
          <button
            onClick={() => handleContentTypeChange('links')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${filterState.contentType === 'links'
                ? 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}>
            <FaLink size={10} className="text-blue-500 dark:text-blue-400" />
            Links
          </button>
          <button
            onClick={() => handleContentTypeChange('notes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${filterState.contentType === 'notes'
                ? 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}>
            <NotesIcon size={14} className="text-orange-500 dark:text-orange-400" />
            Notes
          </button>
          <button
            onClick={() => handleContentTypeChange('prompts')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${filterState.contentType === 'prompts'
                ? 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}>
            <BsStars size={10} className={isDarkMode ? 'text-purple-400' : 'text-purple-500'} />
            Prompts
          </button>
        </div>
      </div>

      {/* Assignees Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-3">
          <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2  tracking-wider">Owner</h4>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-neutral-400 dark:text-neutral-500">No members found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {finalMembers.map(member => {
                const isSelected = filterState.assignees.includes(member.user_id);
                const isCurrentUser = member.user_id === currentUserId;
                const displayName =
                  [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email || 'Unknown';

                return (
                  <button
                    key={member.user_id}
                    onClick={() => handleAssigneeToggle(member.user_id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all border ${isSelected
                        ? isDarkMode
                          ? 'bg-white/10 border-white/20'
                          : 'bg-[#fdf6e3] shadow-md border-black/10'
                        : isDarkMode
                          ? 'hover:bg-white/5 border-transparent'
                          : 'hover:bg-[#eee8d5] border-transparent'
                      }`}>
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full ${getAvatarColor(member.first_name || 'U')} flex items-center justify-center text-xs font-semibold text-white flex-shrink-0`}>
                      {getInitials(member.first_name, member.last_name)}
                    </div>

                    {/* Name & Email */}
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className={`text-sm truncate flex items-center gap-1.5 ${isSelected ? (isDarkMode ? 'text-neutral-100 font-bold' : 'text-[#073642] font-bold') : isDarkMode ? 'text-neutral-300' : 'text-[#073642]'}`}>
                        <span className="truncate">{displayName}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 shrink-0">
                            You
                          </span>
                        )}
                      </p>
                      {member.email && member.first_name && (
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">{member.email}</p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#cb4b16] flex items-center justify-center flex-shrink-0">
                        <FaCheck size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
