import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSelector, useDispatch } from 'react-redux';
import { FiCreditCard, FiExternalLink } from 'react-icons/fi';
import {
  FaFileAlt,
  FaLink,
  FaLayerGroup,
  FaEllipsisH,
  FaEdit,
  FaTrashAlt,
  FaPlus,
  FaRegFolder,
  FaRegFolderOpen,
  FaSearch,
  FaShareAlt,
  FaTerminal,
  FaCog,
  FaPalette,
  FaExternalLinkAlt,
  FaCode,
  FaGlobe,
  FaArrowLeft,
  FaCheck,
  FaSortAmountDown,
  FaFilter,
  FaFileDownload,
  FaChevronUp,
  FaSignOutAlt,
  FaCalendarWeek,
  FaPlay,
} from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import { MdLockOutline, MdPublic } from 'react-icons/md';
import { TbWorld, TbShare } from 'react-icons/tb';
import { LuPlus, LuSparkles, LuArrowRightLeft } from 'react-icons/lu';
import { FiChevronDown, FiSettings, FiGlobe, FiCalendar } from 'react-icons/fi';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import clsx from 'clsx';
import type { Folder, Snippet, Tabs, Workspace, WorkspaceDetails } from '../../../../modals/interfaces';
import { NewSnippetBreadCrum, Team } from '../../../../modals/interfaces';
import {
  setSelectedTeam,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  toggleWorkspace,
  toggleFolder,
  expandAllWorkspaces,
  expandAllFolders,
  setIsCreatingNewItem,
  setDarkMode,
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectSelectedSnippet,
  selectSnippetBreadCrum,
  selectExpandedWorkspaces,
  selectExpandedFolders,
  selectIsCreatingNewItem,
  selectDarkMode,
  backToWorkspace,
  setScrollToFolderId,
  setCommandStatus,
  setIsAutoExpandMode,
  selectCollapsedWorkspaces,
  setCollapsedWorkspaces,
  selectCollapsedFolders,
  setCollapsedFolders,
  selectCollapsedSections,
  setCollapsedSections,
  toggleCollapsedSection,
  toggleCollapsedWorkspace,
  toggleCollapsedFolder,
  openLinkEditModal,
  viewSnippet,
  clearEditorStates,
  setSharedFolderCreationView,
  navigateToView,
  closeLinkEditModal,
  NONE_TEAM,
  setIsCommandListView,
  setActiveTutorial,
  selectActiveTutorial,
  selectIsAutoExpandMode,
  setShowTodosView,
  selectShowTodosView,
  setHoverContext,
  setTodoCreatePrefill,
} from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { exportAllTeamsToExcel } from '../../utils/exportUtils';
import { isSameDay } from 'date-fns';
import { useGridStore } from '../SheetUI/gridStore';
import { isLinkCategory } from '../Views/HomeView/snippetInteractiveUtils';
import { getUserId } from '../../../../Apis/core/api';
import { FEATURE_FLAGS } from '../../utils/featureFlags';
import { CMDOS_SIGN_UP_URL, CMDOS_SIGN_IN_URL } from '../../../../Apis/core/apiConfig';
import { BsPeopleFill, BsStar, BsCalendarCheck } from 'react-icons/bs';
import FavoriteItem from '../Items/FavoriteItem';
import TemplateSidebar from './TemplateSidebar';
import CreateWorkspacePopup from '../Modals/CreateWorkspacePopup';
import CreateCollectionPopup from '../Modals/CreateCollectionPopup';
import DeleteConfirmation from '../Modals/DeleteDialog';
import useToast from '../Shared/Toast/useToast';
import { deleteSWorkspace, getWorkspaceDetails } from '../../../../Apis/features/workspaceApiServices';
import { deleteSharedFolder } from '../../../../Apis/features/folderApiServices';
import { deletemultiple } from '../../../../Apis/features/snippetApi';
import EditWorkspaceNamePopup from '../Modals/EditWorkspaceNamePopup';
import EditFolderNamePopup from '../Modals/EditFolderNamePopup';
import { FolderCreateMenuPopup } from './Sidebar/FolderCreateMenuPopup';
import { FolderStatsPopup } from './Sidebar/FolderStatsPopup';
import {
  fetchWorkspacesThunk,
  setWorkspacesFromAllData,
  selectWorkspacesByTeam,
  selectWorkspacesLoading,
} from '../../../../Redux/Workspaces/workspaceSlice';
import type { AppDispatch, RootState } from '../../../../Redux/store';
import FolderOptionsPopup from '../Modals/FolderOptionsPopup';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore using asset from sibling page; if missing, we render text-only logo
import logoUrl from '../../assets/tasklabs_logo.png';
import { getAvatarColor, getSingleInitial } from '../../utils/avatarColors';
import { performOrganizationSwitch } from '../../commands/list/SwitchOrganizationCommand';
import { EnrichedWorkspace } from './Sidebar/types';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { readAllHotkeys, readAllShortcuts } from '../Shared/utils/hotkeyUtils';

import { WorkspaceSkeleton } from './Sidebar/WorkspaceSkeleton';
import { OrgDropdown } from './Sidebar/OrgDropdown';

import SnippetOptionsPopup from '../Modals/SnippetOptionsPopup';
import CustomizeWorkspacePopup from '../Modals/CustomizeWorkspacePopup';
import CustomizeFolderPopup from '../Modals/CustomizeFolderPopup';
import CustomizeSnippetPopup from '../Modals/CustomizeSnippetPopup';
import WorkspaceOptionsPopup from './Sidebar/WorkspaceOptionsPopup';
import TutorialCard from '../Tutorial/TutorialCard';
import SidebarSearchBar from './Sidebar/SidebarSearchBar';
import FilterPanel, { type FilterState, type ContentFilterType } from './Sidebar/FilterPanel';
import DeleteSelectedBar from './Sidebar/DeleteSelectedBar';

// Organization Dropdown Component (matching AltS)
interface OrgDropdownProps {
  selectedTeam: Team;
  teams: Team[];
  onOrgSelect: (orgId: string, orgName: string) => void;
  onOrgSwitch: (team: Team) => void;
  onCreateOrg: () => void;
}

// const OrgDropdown: React.FC<OrgDropdownProps> = ({ selectedTeam, teams, onOrgSelect, onOrgSwitch, onCreateOrg }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [highlightedIndex, setHighlightedIndex] = useState(-1);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   // Filter out default private workspaces (like "Workspace_1", "Workspace_2", etc.)
//   const filteredTeams = useMemo(() => {
//     return teams.filter(team => !/^workspace[_\s]?\d*$/i.test(team.team_name.trim()));
//   }, [teams]);

//   // Use first real org for display if selectedTeam is a default workspace
//   const displayTeam = useMemo(() => {
//     const isDefault = /^workspace[_\s]?\d*$/i.test(selectedTeam.team_name.trim());
//     if (isDefault && filteredTeams.length > 0) {
//       return filteredTeams[0];
//     }
//     return selectedTeam;
//   }, [selectedTeam, filteredTeams]);

//   // Total items = filteredTeams + 1 (create org option)
//   const totalItems = filteredTeams.length + 1;

//   // Click outside handler
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
//         setIsOpen(false);
//         setHighlightedIndex(-1);
//       }
//     };
//     if (isOpen) {
//       document.addEventListener('mousedown', handleClickOutside);
//     }
//     return () => {
//       document.removeEventListener('mousedown', handleClickOutside);
//     };
//   }, [isOpen]);

//   // Keyboard navigation
//   useEffect(() => {
//     if (!isOpen) return;

//     const handleKeyDown = (e: KeyboardEvent) => {
//       switch (e.key) {
//         case 'ArrowDown':
//           e.preventDefault();
//           setHighlightedIndex(prev => (prev + 1) % totalItems);
//           break;
//         case 'ArrowUp':
//           e.preventDefault();
//           setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
//           break;
//         case 'Enter':
//           e.preventDefault();
//           if (highlightedIndex >= 0 && highlightedIndex < filteredTeams.length) {
//             const team = filteredTeams[highlightedIndex];
//             if (team.team_id !== displayTeam.team_id) {
//               onOrgSwitch(team);
//             } else {
//               onOrgSelect(team.team_id, team.team_name);
//             }
//             setIsOpen(false);
//             setHighlightedIndex(-1);
//           } else if (highlightedIndex === filteredTeams.length) {
//             onCreateOrg();
//             setIsOpen(false);
//             setHighlightedIndex(-1);
//           }
//           break;
//         case 'Escape':
//           e.preventDefault();
//           setIsOpen(false);
//           setHighlightedIndex(-1);
//           break;
//       }
//     };

//     document.addEventListener('keydown', handleKeyDown);
//     return () => document.removeEventListener('keydown', handleKeyDown);
//   }, [isOpen, highlightedIndex, filteredTeams, totalItems, displayTeam, onOrgSelect, onOrgSwitch, onCreateOrg]);

//   // Reset highlight when opening
//   useEffect(() => {
//     if (isOpen) {
//       const currentIndex = filteredTeams.findIndex(t => t.team_id === displayTeam.team_id);
//       setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
//     }
//   }, [isOpen, filteredTeams, displayTeam.team_id]);

//   // Don't render if no orgs to show
//   if (filteredTeams.length === 0) {
//     return null;
//   }

//   const handleOrgClick = (team: Team) => {
//     if (team.team_id !== displayTeam.team_id) {
//       onOrgSwitch(team);
//     } else {
//       onOrgSelect(team.team_id, team.team_name);
//     }
//     setIsOpen(false);
//     setHighlightedIndex(-1);
//   };

//   const handleCreateOrgClick = () => {
//     onCreateOrg();
//     setIsOpen(false);
//     setHighlightedIndex(-1);
//   };

//   return (
//     <div className="relative" ref={dropdownRef}>
//       {/* Main Button - Style removed for unified container */}
//       <div className="rounded-lg px-2 py-1.5 transition-colors hover:bg-white/50 dark:hover:bg-white/5">
//         <div className="flex items-center gap-1.5">
//           {/* Clickable area for org navigation */}
//           <div
//             className="flex items-center gap-1.5 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
//             onMouseDown={e => {
//               e.preventDefault();
//               e.stopPropagation();
//               onOrgSelect(displayTeam.team_id, displayTeam.team_name);
//             }}>
//             {/* Org Avatar */}
//             <div
//               className={`w-5 h-5 rounded-full ${getAvatarColor(displayTeam.team_name)} flex items-center justify-center font-bold text-[10px] text-white shadow-sm flex-shrink-0`}>
//               {getSingleInitial(displayTeam.team_name)}
//             </div>
//             {/* Org Name */}
//             <span className="flex-1 text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
//               {displayTeam.team_name}
//             </span>
//           </div>
//           {/* Dropdown Icon */}
//           <button
//             onMouseDown={e => {
//               e.preventDefault();
//               e.stopPropagation();
//               setIsOpen(!isOpen);
//             }}
//             className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
//             title="Select organization">
//             <FiChevronDown
//               size={12}
//               className={`text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-transform ${isOpen ? 'rotate-180' : ''}`}
//             />
//           </button>
//         </div>
//       </div>

//       {/* Dropdown Menu */}
//       {isOpen && (
//         <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--color-containerBg)] shadow-lg rounded-lg border border-[var(--color-borderDefault)] max-h-64 overflow-y-auto custom-scrollbar">
//           <div className="p-1.5 space-y-0.5">
//             {filteredTeams.map((team, index) => (
//               <div
//                 key={team.team_id}
//                 onMouseDown={e => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   handleOrgClick(team);
//                 }}
//                 onMouseEnter={() => setHighlightedIndex(index)}
//                 className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${highlightedIndex === index
//                   ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
//                   : displayTeam.team_id === team.team_id
//                     ? 'bg-[var(--color-containerBg)] text-neutral-700 dark:text-neutral-300'
//                     : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
//                   }`}>
//                 <div
//                   className={`w-5 h-5 rounded-full ${getAvatarColor(team.team_name)} flex items-center justify-center font-bold text-[10px] text-white`}>
//                   {getSingleInitial(team.team_name)}
//                 </div>
//                 <span className="text-xs font-medium truncate flex-1">{team.team_name}</span>
//                 {displayTeam.team_id === team.team_id && (
//                   <span className="text-[10px] text-purple-500 dark:text-purple-400">✓</span>
//                 )}
//               </div>
//             ))}
//           </div>
//           {/* Divider */}
//           <div className="border-t border-[var(--color-borderDefault)] mx-1.5" />
//           {/* Add or create org option */}
//           <div className="p-1.5">
//             <div
//               onMouseDown={e => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 handleCreateOrgClick();
//               }}
//               onMouseEnter={() => setHighlightedIndex(filteredTeams.length)}
//               className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${highlightedIndex === filteredTeams.length
//                 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
//                 : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
//                 }`}>
//               <div className="w-5 h-5 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center">
//                 <LuPlus size={10} className="text-neutral-500 dark:text-neutral-400" />
//               </div>
//               <span className="text-xs font-medium">Create Org or Team</span>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

interface SideBarProps {
  reload: () => void;
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isCommandListView?: boolean;
  onToggleCommandListView?: (isOpen: boolean) => void;
  commandListCategory?: string;
  onCommandListCategoryChange?: (category: string) => void;
  isTemplatesView?: boolean;
  onToggleTemplatesView?: (isOpen: boolean) => void;
  templatesCategory?: string;
  onTemplatesCategoryChange?: (category: string) => void;
  teams?: Team[];
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateOrganization?: () => void;
  onWorkspaceShare?: (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => void;
  activeCommandSection?: string;
  onCommandSectionChange?: (section: string) => void;
  templateCommands?: any[];
  onFilterPanelStateChange?: (state: { isOpen: boolean; filterState: FilterState }) => void;
  // External filter state from App.tsx (for when App.tsx modifies filters via FilterPanel)
  externalFilterState?: {
    isOpen: boolean;
    filterState: FilterState;
  };
  // Callback when sidebar search focus changes
  onSidebarSearchFocusChange?: (isFocused: boolean) => void;
  isLoggedIn?: boolean;
  onOpenUrls?: (urls: string[], title?: string) => void;
  isDarkMode: boolean;
  isSheetUIOpen: boolean;
  onExpand?: () => void;
  onCreateWorkspace?: (isPersonal: boolean, access?: 'public' | 'private' | 'shareonly', targetTeamId?: string) => void;
}

const SideBar: React.FC<SideBarProps> = ({
  reload,
  isCollapsed,
  toggleSidebar,
  isCommandListView,
  onToggleCommandListView,
  commandListCategory,
  onCommandListCategoryChange,
  isTemplatesView,
  onToggleTemplatesView,
  templatesCategory,
  onTemplatesCategoryChange,
  teams = [],
  onOrganizationSettings,
  onCreateOrganization,
  onWorkspaceShare,
  activeCommandSection,
  onCommandSectionChange,
  templateCommands = [],
  onFilterPanelStateChange,
  externalFilterState,
  onSidebarSearchFocusChange,
  isLoggedIn = false,
  onOpenUrls,
  isDarkMode,
  isSheetUIOpen,
  onExpand,
  onCreateWorkspace,
}) => {
  // Get Redux state and dispatch
  const dispatch = useDispatch<AppDispatch>();
  const activeTutorial = useSelector(selectActiveTutorial);
  const triggerToast = useToast();

  const [userId, setUserId] = useState('');
  useEffect(() => {
    getUserId().then(setUserId).catch(() => { });
  }, []);

  const selectedTeam = useSelector(selectSelectedTeam);
  const expandedWorkspaces = useSelector(selectExpandedWorkspaces);
  const expandedFolders = useSelector(selectExpandedFolders);
  const expandedComponents = useSelector(selectExpandedFolders);
  const selectedSnippet = useSelector(selectSelectedSnippet);
  const selectedFolder = useSelector(selectSelectedFolder);
  const isAutoExpandMode = useSelector(selectIsAutoExpandMode);
  const collapsedWorkspaces = useSelector(selectCollapsedWorkspaces);
  const collapsedFolders = useSelector(selectCollapsedFolders);
  const collapsedSections = useSelector(selectCollapsedSections);
  const showTodosView = useSelector(selectShowTodosView);

  // Sidebar has its own separate search - don't use debouncedSearchTerm from main search
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
  const [debouncedSidebarSearchTerm, setDebouncedSidebarSearchTerm] = useState('');

  const setSearchTerm = useGridStore(state => state.setSearchTerm);
  const setSelectedCell = useGridStore(state => state.setSelectedCell);

  // Sync sidebar search with grid store (sheet view)
  useEffect(() => {
    setSearchTerm(sidebarSearchTerm);
  }, [sidebarSearchTerm, setSearchTerm]);

  // Filter panel state - use external state if provided, otherwise use local state
  // This prevents infinite loops from bidirectional sync
  const isFilterPanelOpen = externalFilterState?.isOpen ?? false;
  const filterState = externalFilterState?.filterState ?? { assignees: [], contentType: 'all' as const };

  const [viewMode, setViewMode] = useChromeStorage<'folder' | 'datatype'>('sidebarViewMode', 'datatype');

  const handleOwnerHoverEntry = (type: 'personal' | 'org' | 'folder' | 'workspace', id?: string) => {
    dispatch(setHoverContext({ type, id }));
  };

  const handleOwnerHoverLeave = () => {
    dispatch(setHoverContext(null));
  };

  const [expandedDataGroups, setExpandedDataGroups] = useState<Record<string, boolean>>({
    'Personal Space-links': true,
    'Personal Space-notes': true,
    'Personal Space-prompts': true,
    'Organization-links': true,
    'Organization-notes': true,
    'Organization-prompts': true,
  });

  const toggleDataGroup = (groupId: string) => {
    setExpandedDataGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Handler to toggle filter panel - notifies parent
  const handleToggleFilterPanel = useCallback(() => {
    const newState = {
      isOpen: !isFilterPanelOpen,
      filterState: filterState,
    };
    onFilterPanelStateChange?.(newState);
  }, [isFilterPanelOpen, filterState, onFilterPanelStateChange]);

  const teamId = selectedTeam?.team_id || '';

  // Determine which organization to display in the org section
  const displayOrgTeam = useMemo(() => {
    const filteredTeams = teams.filter(team => team.is_personal_space !== true);
    if (!selectedTeam) return null;
    if (selectedTeam.team_id === NONE_TEAM.team_id || selectedTeam.team_name === 'None') {
      return null;
    }
    if (selectedTeam.is_personal_space) {
      return filteredTeams[0] || null;
    }
    return selectedTeam;
  }, [selectedTeam, teams]);

  const orgTeamId = displayOrgTeam?.team_id || '';
  const workspacesFromRedux = useSelector((state: RootState) => selectWorkspacesByTeam(state, orgTeamId));
  const isWorkspacesLoading = useSelector(selectWorkspacesLoading);

  // Internal collapse state - defaults to true (collapsed) on mount/refresh as requested
  const [isCollapsedInternal, setIsCollapsedInternal] = useState(true);
  const [isOrgFoldersCollapsed, setIsOrgFoldersCollapsed] = useState(false);
  const [hoveredLeftIcon, setHoveredLeftIcon] = useState<'personal' | 'org' | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Reset internal collapse state when global collapse state changes
  useEffect(() => {
    setIsCollapsedInternal(true);
  }, [isCollapsed]);

  // Effective collapse state: Matches internal state if globally collapsed AND not in special views; otherwise expanded
  const effectiveCollapsed =
    !isCommandListView && !isTemplatesView ? (isCollapsed ? isCollapsedInternal : false) : false;

  // --- Folder Visibility Feature (Replaced by Global Collapse State) ---
  //  const [scrollToFolderId, setScrollToFolderIdState] = useState<string | null>(null);
  const [todoCounts, setTodoCounts] = useState<{ overdue: number; done: number; total: number }>({
    overdue: 0,
    done: 0,
    total: 0,
  });

  // Helper to parse task dates safely
  const parseTaskDate = (d: string | undefined) => {
    if (!d) return new Date(0);
    return new Date(String(d).replace(' ', 'T'));
  };

  // Unified Todo Synchronization for Sidebar
  useEffect(() => {
    const updateTodoMetrics = async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.storage?.local) return;

      try {
        const result = await new Promise<any>(resolve =>
          chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
        );
        const allTasks = [...(result.cached_todos || []), ...(result.local_todos || [])];

        // 1. Deduplicate by ID
        const uniqueTasks = Array.from(new Map(allTasks.map(t => [String(t.id || t.snippet_id), t])).values());
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        // 2. Calculate Counts & Stats (Logic matches TodosList.tsx)
        const metrics = uniqueTasks.reduce(
          (acc: any, t: any) => {
            const deadline = parseTaskDate(t.event_deadline);
            if (isNaN(deadline.getTime())) return acc;

            const isAnytime = !!(t.is_anytime || (t.event_deadline && String(t.event_deadline).substring(0, 4) >= '2035'));
            const isFutureDay = !isSameDay(deadline, now) && deadline > now;

            // "Today" category includes: specifically today, overdue, or anytime
            const isActiveToday = !t.is_done && !isFutureDay && (isSameDay(deadline, now) || deadline < now || isAnytime);
            const isDoneToday = t.is_done && isSameDay(deadline, now);
            const isPast = deadline < now && !isAnytime;

            if (isActiveToday || isDoneToday) {
              acc.todayTotal++;
              if (t.is_done) {
                acc.todayDone++;
              } else if (isPast) {
                acc.overdue++;
              }
            } else if (!t.is_done && deadline < startOfToday && !isAnytime) {
              acc.overdue++;
            }
            return acc;
          },
          { overdue: 0, todayTotal: 0, todayDone: 0 },
        );

        setTodoCounts({ overdue: metrics.overdue, done: metrics.todayDone, total: metrics.todayTotal });
        setTodoStats({ overdue: metrics.overdue, todayTotal: metrics.todayTotal, todayDone: metrics.todayDone });
      } catch (e) {
        console.error('[SideBar] Failed to update todo metrics:', e);
      }
    };

    updateTodoMetrics();

    // Event-driven updates instead of aggressive polling
    window.addEventListener('todosUpdated', updateTodoMetrics);

    const handleStorageChange = (changes: any, area: string) => {
      if (area === 'local' && (changes.local_todos || changes.cached_todos)) {
        updateTodoMetrics();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Refresh every 5 minutes as a fallback for time-based changes (e.g. becoming overdue)
    const interval = setInterval(updateTodoMetrics, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('todosUpdated', updateTodoMetrics);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const [isResizing, setIsResizing] = useState(false);

  // Top-level modals managed here so they persist even if the options popup unmounts
  const [editModal, setEditModal] = useState<{ isOpen: boolean; workspace: Workspace | null }>({
    isOpen: false,
    workspace: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; workspace: Workspace | null }>({
    isOpen: false,
    workspace: null,
  });

  // Folder management modals (lifted from FolderOptionsPopup)
  const [editFolderModal, setEditFolderModal] = useState<{
    isOpen: boolean;
    folder: Folder | null;
    workspace: Workspace | null;
  }>({ isOpen: false, folder: null, workspace: null });
  const [deleteFolderModal, setDeleteFolderModal] = useState<{
    isOpen: boolean;
    folder: Folder | null;
    workspace: Workspace | null;
  }>({ isOpen: false, folder: null, workspace: null });

  const [collectionCreationWorkspace, setCollectionCreationWorkspace] = useState<Workspace | null>(null);
  const [showCreateCollectionPopup, setShowCreateCollectionPopup] = useState(false);


  const [sidebarTutorialFinished, setSidebarTutorialFinished] = useChromeStorage<boolean>('sidebar_tutorial_finished', false);

  useEffect(() => {
    const handleStartSidebarTutorial = () => {
      if (!sidebarTutorialFinished) {
        dispatch(setActiveTutorial('sidebar'));
      }
    };
    window.addEventListener('startSidebarTutorial', handleStartSidebarTutorial);
    return () => {
      window.removeEventListener('startSidebarTutorial', handleStartSidebarTutorial);
    };
  }, [sidebarTutorialFinished, dispatch]);

  const handleCloseSidebarTutorial = () => {
    dispatch(setActiveTutorial(null));
    setSidebarTutorialFinished(true);
    window.dispatchEvent(new CustomEvent('TutorialFinished'));
  };

  const selectedTeamId = selectedTeam?.team_id || '';
  const enrichedWorkspaces: EnrichedWorkspace[] = useMemo(() => {
    if (!displayOrgTeam?.workspaces) return [];

    // Prioritize workspaces from displayOrgTeam (fresher for name/icon/color via optimistic updates)
    return displayOrgTeam.workspaces.map(ws => {
      const meta = workspacesFromRedux?.find(w => w.workspace_id === ws.workspace_id) as EnrichedWorkspace | undefined;

      // Deeply merge folders to ensure we aren't losing fresh icons/colors/names
      const safeFolders = (Array.isArray(ws.folders) ? ws.folders : []).map(f => {
        const metaFolder = meta?.folders?.find(mf => mf.folder_id === f.folder_id);
        return {
          ...metaFolder, // Keep metadata if available
          ...f, // Overwrite with fresh data from displayOrgTeam
        };
      });

      return {
        ...(meta || {}), // Start with metadata
        ...ws, // Overwrite with fresh data from displayOrgTeam (name, icon, color)
        folders: safeFolders,
        // Preserve critical type/admin info if missing in ws
        // Fix for mixing: Check for is_shared/is_public flags if type is missing before defaulting to private
        type:
          (ws as any).type ||
          meta?.type ||
          ((ws as any).is_shared ? 'shareonly' : (ws as any).is_public ? 'public' : 'private'),
        admin_user_id: meta?.admin_user_id || (ws as any).admin_user_id,
      };
    });
  }, [selectedTeam, workspacesFromRedux]);

  // Use a ref to keep the listener updated with the latest workspace data
  const enrichedWorkspacesRef = useRef(enrichedWorkspaces);
  useEffect(() => {
    enrichedWorkspacesRef.current = enrichedWorkspaces;
  }, [enrichedWorkspaces]);

  // Auto-collapse Org Section if no workspaces exist (User Request)
  // This declutters the sidebar by default if the org has no folders.
  // The user can still manualy expand it to create folders.
  useEffect(() => {
    if (enrichedWorkspaces.length === 0) {
      setIsOrgFoldersCollapsed(true);
    }
  }, [enrichedWorkspaces.length, displayOrgTeam?.team_id]);

  // ----------------------- Auto Expand Logic -----------------------

  const toggleSectionCollapse = (title: string) => {
    dispatch(toggleCollapsedSection(title));
  };

  /**
   * Helper to automatically apply filters based on current folder/workspace context
   */
  const applyContextualFilter = useCallback(
    (folder: Folder | null, workspace: Workspace | EnrichedWorkspace | null, isPersonal: boolean) => {
      // Don't trigger if already in a search mode that wasn't started by this
      if (debouncedSidebarSearchTerm.trim()) return;

      let newAssignees: string[] = [];

      if (isPersonal && userId) {
        newAssignees = [userId];
      } else if (workspace) {
        const ownerId = (workspace as any).admin_user_id || (workspace as any).user_id || (workspace as any).created_by;
        if (ownerId) {
          newAssignees = [ownerId];
        }
      }

      // 🔍 STABILITY CHECK: Avoid redundant triggers if already open with same filters
      const currentState = externalFilterState?.filterState;
      const currentAssignees = currentState?.assignees || [];
      const alreadyMatches =
        externalFilterState?.isOpen === true &&
        currentAssignees.length === newAssignees.length &&
        currentAssignees.every((id, idx) => id === newAssignees[idx]);

      if (alreadyMatches) return;

      onFilterPanelStateChange?.({
        isOpen: true,
        filterState: {
          ...(currentState || { contentType: 'all' }),
          assignees: newAssignees,
        },
      });
    },
    [userId, externalFilterState, onFilterPanelStateChange, debouncedSidebarSearchTerm],
  );

  // Hover timer ref for debouncing
  const autofilterHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleContextualFolderHoverEntry = useCallback(
    (folder: Folder, workspace: Workspace, isPersonal: boolean) => {
      if (autofilterHoverTimerRef.current) clearTimeout(autofilterHoverTimerRef.current);
      autofilterHoverTimerRef.current = setTimeout(() => {
        applyContextualFilter(folder, workspace, isPersonal);
      }, 450); // 450ms debounce for hover
    },
    [applyContextualFilter],
  );

  const handleContextualWorkspaceHoverEntry = useCallback(
    (workspace: Workspace, isPersonal: boolean) => {
      if (autofilterHoverTimerRef.current) clearTimeout(autofilterHoverTimerRef.current);
      autofilterHoverTimerRef.current = setTimeout(() => {
        applyContextualFilter(null, workspace, isPersonal);
      }, 450);
    },
    [applyContextualFilter],
  );

  const handleContextualFolderHoverLeave = () => {
    if (autofilterHoverTimerRef.current) {
      clearTimeout(autofilterHoverTimerRef.current);
      autofilterHoverTimerRef.current = null;
    }
  };

  // ----------------------- Favorites -----------------------
  const [favoritesMapping, setFavoritesMapping] = useState<{
    [teamId: string]: Snippet[];
  }>({});
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});

  // ----------------------- Bulk Delete Mode -----------------------
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Map<string, { snippet: Snippet; category: string }>>(
    new Map(),
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [todoStats, setTodoStats] = useState({ overdue: 0, todayTotal: 0, todayDone: 0 });

  // Get selection summary
  const selectionSummary = useMemo(() => {
    const summary: { notes: number; links: number; tabgroups: number; prompts: number } = {
      notes: 0,
      links: 0,
      tabgroups: 0,
      prompts: 0,
    };
    selectedForDelete.forEach(({ category }) => {
      const cat = category.toLowerCase();
      if (cat === 'note') {
        summary.notes++;
      } else if (cat === 'snippet') {
        summary.notes++; // Combine notes/snippets in summary if desired, or add summary.snippets
      } else if (cat === 'link' || cat === 'quicklink') {
        summary.links++;
      } else if (cat === 'tabgroup' || cat === 'tab group' || cat === 'bulk_link') {
        summary.tabgroups++;
      } else if (cat === 'prompt') {
        summary.prompts++;
      }
    });
    return summary;
  }, [selectedForDelete]);

  // Toggle bulk delete mode
  const handleToggleBulkDeleteMode = useCallback(() => {
    setIsBulkDeleteMode(prev => {
      if (prev) {
        // Clear selection when exiting bulk delete mode
        setSelectedForDelete(new Map());
      }
      return !prev;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allWsExpandable: Record<string, boolean> = {};
    const allFolderExpandable: Record<string, boolean> = {};

    // Recursive helper to get all folder IDs
    const collectFolderIds = (folders: Folder[]) => {
      folders.forEach(f => {
        allFolderExpandable[f.folder_id] = true;
        if (f.folders && Array.isArray(f.folders)) collectFolderIds(f.folders);
      });
    };

    enrichedWorkspaces.forEach(ws => {
      allWsExpandable[ws.workspace_id] = true;
      if (ws.folders && Array.isArray(ws.folders)) collectFolderIds(ws.folders);
    });

    // Update both states to ensure expansion regardless of mode
    dispatch(expandAllWorkspaces(allWsExpandable));
    dispatch(expandAllFolders(allFolderExpandable));

    // Also update the auto-expand mode's specific collapse states if needed
    // In auto-expand mode, 'collapsed' means NOT expanded.
    // So we should set collapsed states to false.
    const allNotCollapsed: Record<string, boolean> = {};
    enrichedWorkspaces.forEach(ws => {
      allNotCollapsed[ws.workspace_id] = false;
      const collectNotCollapsed = (folders: Folder[]) => {
        folders.forEach(f => {
          allNotCollapsed[f.folder_id] = false;
          if (f.folders && Array.isArray(f.folders)) collectNotCollapsed(f.folders);
        });
      };
      if (ws.folders) collectNotCollapsed(ws.folders);
    });
    dispatch(setCollapsedWorkspaces(allNotCollapsed));
    dispatch(setCollapsedFolders(allNotCollapsed));

    triggerToast('Expanded all folders', 'success');
  }, [enrichedWorkspaces, dispatch, triggerToast]);

  const allTeamsData = useSelector(selectAllData);

  const handleExportExcel = () => {
    if (!allTeamsData || allTeamsData.length === 0) {
      triggerToast('No data available to export.', 'warning');
      return;
    }
    triggerToast('Preparing Excel export...', 'info');
    exportAllTeamsToExcel(allTeamsData);
    triggerToast('Export complete!', 'success');
  };

  const handleToggleAutoExpand = useCallback(() => {
    // Match Alt+A behavior when folder toggle action is used.
    if (isCollapsed) {
      toggleSidebar();
    }

    onExpand?.();

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }

    const nextMode = !isAutoExpandMode;
    dispatch(setIsAutoExpandMode(nextMode));

    if (nextMode) {
      // When turning ON Auto Expand: Use the expand all logic to clear any manual collapses
      handleExpandAll();
    } else {
      // When turning OFF (Collapsing All): Clear both expanded and collapsed dictionaries
      // i.e. reset to a clean collapsed state
      dispatch(expandAllWorkspaces({}));
      dispatch(expandAllFolders({}));
      dispatch(setCollapsedWorkspaces({}));
      dispatch(setCollapsedFolders({}));
      triggerToast('Collapsed all folders', 'success');
    }
  }, [dispatch, isAutoExpandMode, handleExpandAll, triggerToast, isCollapsed, toggleSidebar, onExpand]);

  // Toggle item selection for bulk delete
  const toggleSnippetSelection = useCallback((snippet: Snippet) => {
    setSelectedForDelete(prev => {
      const newMap = new Map(prev);
      const snippetId = snippet.snippet_id || snippet.id;
      if (newMap.has(snippetId)) {
        newMap.delete(snippetId);
      } else {
        newMap.set(snippetId, { snippet, category: snippet.category || 'snippet' });
      }
      return newMap;
    });
  }, []);

  // Handle bulk delete action - returns result for failed items handling
  const handleBulkDelete = useCallback(async (): Promise<{
    deleted_count: number;
    failed_count: number;
    failed_ids?: string[];
  }> => {
    if (selectedForDelete.size === 0) {
      return { deleted_count: 0, failed_count: 0 };
    }

    setIsDeleting(true);
    try {
      const snippetIds = Array.from(selectedForDelete.keys());
      const result = await deletemultiple(snippetIds);

      // Show toast based on actual deleted count, not total selected
      if (result.deleted_count > 0) {
        triggerToast(
          `${result.deleted_count} item${result.deleted_count > 1 ? 's' : ''} deleted successfully`,
          'success',
        );
      }

      // Remove successfully deleted items from selection
      if (result.failed_ids && result.failed_ids.length > 0) {
        // Keep only failed items in selection for visibility
        const failedSet = new Set(result.failed_ids);
        setSelectedForDelete(prev => {
          const newMap = new Map<string, { snippet: any; category: string }>();
          prev.forEach((value, key) => {
            if (failedSet.has(key)) {
              newMap.set(key, value);
            }
          });
          return newMap;
        });
      } else {
        // All items deleted successfully
        setSelectedForDelete(new Map());
        setIsBulkDeleteMode(false);
      }

      reload();
      return result;
    } catch (error) {
      console.error('Bulk delete failed:', error);
      triggerToast('Failed to delete items', 'error');
      return { deleted_count: 0, failed_count: selectedForDelete.size };
    } finally {
      setIsDeleting(false);
    }
  }, [selectedForDelete, triggerToast, reload]);

  useEffect(() => {
    const loadMaps = async () => {
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap(allHotkeys);
      setShortcutsMap(allShortcuts);
    };

    loadMaps();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (
        changes.alts_command_hotkeys ||
        changes.alts_link_hotkeys ||
        changes.alts_note_hotkeys ||
        changes.alts_commands ||
        changes.alts_local_command_customizations ||
        changes.note_commands ||
        changes.link_commands
      ) {
        loadMaps();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    chrome.storage.local.get('myFavouriteItems', result => {
      setFavoritesMapping(result.myFavouriteItems || {});
    });
  }, []);

  // Optional: listen for changes in storage
  useEffect(() => {
    const handleStorageChange = (changes: any, namespace: string) => {
      if (namespace === 'local' && changes.myFavouriteItems && selectedTeamId) {
        setFavoritesMapping(changes.myFavouriteItems.newValue || {});
      }
      if (namespace === 'local' && changes.accessToken) {
        const newVal = changes.accessToken.newValue;
        setUserId(newVal && newVal.startsWith('user_') ? newVal : 'local_user');
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [selectedTeamId]);

  const workspace = useSelector(selectSelectedWorkspace);

  const selectedItem = useSelector(selectSelectedSnippet);
  const snippetBreadCrum = useSelector(selectSnippetBreadCrum);
  const [workspaceDetails, setWorkspaceDetails] = useState<WorkspaceDetails[]>([]);
  const [isTeamSwitcherOpen, setIsTeamSwitcherOpen] = useState(false);
  const [switcherPosition, setSwitcherPosition] = useState<{ top: number; left: number } | null>(null);

  // Click outside listener for fixed switcher
  useEffect(() => {
    const handleClickOutside = () => {
      if (isTeamSwitcherOpen) {
        setIsTeamSwitcherOpen(false);
        setSwitcherPosition(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isTeamSwitcherOpen]);

  // Snippet Customizations - Now loaded from cloud data (snippet.icon, snippet.color)
  // Folder Customizations - Now loaded from cloud data (folder.icon, folder.color)
  // Workspace Customizations - Now loaded from cloud data (workspace.icon, workspace.color)

  // Search input ref for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);

  const triggerSidebarSearchShortcutFlow = useCallback(
    (isAltATrigger = false) => {
      // 1. Ensure sidebar is expanded if it's currently collapsed
      if (isCollapsed) {
        toggleSidebar();
      }

      // 🌟 SHEET UI FOCUS REDIRECTION:
      // If the Sheet UI is open (or about to be opened via onExpand), focus the "Name" column search
      // instead of the general sidebar search.
      if (onExpand || isSheetUIOpen) {
        if (!isSheetUIOpen) {
          onExpand?.();
        }

        setSelectedCell({ rowIndex: 0, colIndex: 0 }); // Select "Name" column header

        // If this was Alt+A, we don't want to force focus to the search input
        // if we want the user to be able to navigate the rows immediately.
        // The SheetTable's internal Alt+A handler will decide whether to focus search or row.
        if (isAltATrigger && isSheetUIOpen) return;

        // Delay focus slightly to allow Sheet UI to mount/render and input to appear
        setTimeout(() => {
          // For Alt+A, we skip the search focus to allow row navigation
          if (isAltATrigger) return;

          const input = document.getElementById('sheet-search-name');
          if (input) {
            input.focus();
          } else {
            // Fallback to sidebar search if SheetUI search is not found
            searchInputRef.current?.focus();
          }
        }, 300);
      } else {
        // Regular sidebar search behavior (when not in Sheet UI mode)
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        } else {
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 300);
        }
      }
    },
    [isCollapsed, toggleSidebar, onExpand, isSheetUIOpen, setSelectedCell],
  );

  useEffect(() => {
    // Populate workspace slice from allData — no separate API call needed.
    // The /all API already returns workspaces with full data (type, icon, color, etc.)
    const hasWorkspacesInRedux = workspacesFromRedux.length > 0;
    const teamWorkspaces = displayOrgTeam?.workspaces;

    if (orgTeamId && !hasWorkspacesInRedux && teamWorkspaces && teamWorkspaces.length > 0) {

      dispatch(setWorkspacesFromAllData([{ teamId: orgTeamId, workspaces: teamWorkspaces }]));
    }
  }, [dispatch, orgTeamId, workspacesFromRedux.length, displayOrgTeam?.workspaces]);

  // Auto-expand sidebar when a snippet/link is selected
  const prevAutoExpandMode = useRef(isAutoExpandMode);

  // Scroll to selected item only, NO expansion
  useEffect(() => {
    if (!selectedItem || !snippetBreadCrum) return;

    if (snippetBreadCrum.folder_id) {
      dispatch(setScrollToFolderId(snippetBreadCrum.folder_id));
    }
  }, [selectedItem, snippetBreadCrum, dispatch]);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const user_id = await getUserId();
        setUserId(user_id);
      } catch (error) {
        console.error(error);
      }
    };
    fetchUserId();
  }, []);

  // Workspace options popup state
  const [optionsPopup, setOptionsPopup] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    workspace: Workspace | null;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    workspace: null,
  });

  // Folder options popup state
  const [folderOptionsPopup, setFolderOptionsPopup] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    folder: Folder | null;
    workspace: Workspace | null;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    folder: null,
    workspace: null,
  });

  // Folder create menu popup state
  const [folderCreateMenu, setFolderCreateMenu] = useState<{
    isOpen: boolean;
    triggerRect: DOMRect | null;
    folder: Folder | null;
    workspace: Workspace | null;
  }>({
    isOpen: false,
    triggerRect: null,
    folder: null,
    workspace: null,
  });

  const [folderStatsMenu, setFolderStatsMenu] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    folder: Folder | null;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    folder: null,
  });

  const [workspaceStatsMenu, setWorkspaceStatsMenu] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    workspace: Workspace | null;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    workspace: null,
  });

  const [customizeWorkspaceModal, setCustomizeWorkspaceModal] = useState<{
    isOpen: boolean;
    workspace: Workspace | null;
  }>({
    isOpen: false,
    workspace: null,
  });

  const [customizeFolderModal, setCustomizeFolderModal] = useState<{
    isOpen: boolean;
    folder: Folder | null;
    workspace: Workspace | null;
  }>({
    isOpen: false,
    folder: null,
    workspace: null,
  });

  const [customizeSnippetModal, setCustomizeSnippetModal] = useState<{
    isOpen: boolean;
    snippet: Snippet | null;
  }>({
    isOpen: false,
    snippet: null,
  });

  // Snippet options popup state
  const [snippetOptionsPopup, setSnippetOptionsPopup] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    snippet: Snippet | null;
    workspace: Workspace | null;
    folder: Folder | null;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    snippet: null,
    workspace: null,
    folder: null,
  });

  const handleSnippetOptionsClick = (
    e: React.MouseEvent,
    snippet: Snippet,
    workspace: Workspace,
    folder: Folder | null,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Set breadcrumb for the popup
    // dispatch(
    //   setSnippetBreadCrum({
    //     workspace_id: workspace.workspace_id,
    //     workspace_name: workspace.workspace_name,
    //     folder_id: folder?.folder_id,
    //     folder_name: folder?.folder_name,
    //   }),
    // );

    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 192; // matches w-48
    const left = Math.min(window.innerWidth - popupWidth - 4, rect.right + 2);
    setSnippetOptionsPopup({
      isOpen: true,
      position: {
        top: rect.top,
        left,
      },
      snippet,
      workspace,
      folder,
    });
  };

  // Handle focus from background script message (for global extension triggering on existing tabs)
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'focus_sidebar_search') {
        // If sidebar is collapsed, expand it permanently
        if (isCollapsed) {
          toggleSidebar();
        }

        // Trigger SheetUI
        onExpand?.();

        if (searchInputRef.current) {
          searchInputRef.current.focus();
        } else {
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 300);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [effectiveCollapsed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('focus_sidebar') === 'true') {
      const timer = setTimeout(() => {
        // If sidebar is collapsed, expand it permanently
        if (isCollapsed) {
          toggleSidebar();
        }

        // Trigger SheetUI
        onExpand?.();

        if (searchInputRef.current) {
          searchInputRef.current.focus();
          const newUrl =
            window.location.pathname + window.location.search.replace(/[?&]focus_sidebar=true/, '').replace(/^&/, '?');
          window.history.replaceState({}, '', newUrl);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isCollapsed, toggleSidebar, onExpand]);

  const handleWorkspaceClick = (workspace: Workspace) => {
    // 1. Force Expand Logic (Double Click Fix)
    if (isAutoExpandMode) {
      if (collapsedWorkspaces[workspace.workspace_id]) {
        dispatch(toggleCollapsedWorkspace(workspace.workspace_id));
      }
    } else {
      if (!expandedWorkspaces[workspace.workspace_id]) {
        dispatch(expandAllWorkspaces({ ...expandedWorkspaces, [workspace.workspace_id]: true }));
      }
    }

    // Trigger contextual filter for the workspace
    const isPersonal = (workspace as any).is_personal_space || false;
    applyContextualFilter(null, workspace, isPersonal);

    // Use the new backToWorkspace action to handle all state updates atomically
    dispatch(backToWorkspace({ workspace }));

    // Reset any folder scroll target
    dispatch(setScrollToFolderId(null));
  };

  const handleToggleWorkspace = (workspaceId: string, isPersonal: boolean = false) => {
    const isExpanding = isAutoExpandMode ? !!collapsedWorkspaces[workspaceId] : !expandedWorkspaces[workspaceId];

    if (isAutoExpandMode) {
      dispatch(toggleCollapsedWorkspace(workspaceId));
    } else {
      // Standard Toggle: Only toggle the specific workspace, keep others as is.
      const newExpandedState = { ...expandedWorkspaces };
      if (newExpandedState[workspaceId]) {
        delete newExpandedState[workspaceId];
      } else {
        newExpandedState[workspaceId] = true;
      }
      dispatch(expandAllWorkspaces(newExpandedState));
    }

    // Trigger filter on expansion
    if (isExpanding) {
      dispatch(setHoverContext({ type: isPersonal ? 'personal' : 'workspace', id: workspaceId }));
      const ws = enrichedWorkspaces.find(w => w.workspace_id === workspaceId);
      if (ws) applyContextualFilter(null, ws, isPersonal);
    }
  };

  const handleToggleFolder = (folderId: string, workspace: Workspace, isPersonal: boolean = false) => {
    const isExpanding = isAutoExpandMode ? !!collapsedFolders[folderId] : !expandedFolders[folderId];

    if (isAutoExpandMode) {
      dispatch(toggleCollapsedFolder(folderId));
    } else {
      dispatch(toggleFolder(folderId));
    }

    if (isExpanding) {
      dispatch(setHoverContext({ type: 'folder', id: folderId }));
      // Find the folder to get its metadata for filtering
      const findFolder = (folders: Folder[]): Folder | undefined => {
        for (const f of folders) {
          if (f.folder_id === folderId) return f;
          if (f.folders) {
            const result = findFolder(f.folders);
            if (result) return result;
          }
        }
        return undefined;
      };
      const folder = findFolder(workspace.folders || []);
      if (folder) applyContextualFilter(folder, workspace, isPersonal);
    }

    dispatch(setScrollToFolderId(folderId));
  };

  const handleFolderSelect = useCallback(
    (folder: Folder, workspace: Workspace, isPersonal: boolean = false) => {
      // Logic for selecting a folder (navigation)
      // Expand workspace if not already
      if (isAutoExpandMode) {
        if (collapsedWorkspaces[workspace.workspace_id]) {
          dispatch(toggleCollapsedWorkspace(workspace.workspace_id));
        }
      } else {
        if (!expandedWorkspaces[workspace.workspace_id]) {
          dispatch(expandAllWorkspaces({ ...expandedWorkspaces, [workspace.workspace_id]: true }));
        }
      }

      // 1. Force Expand Folder (Double Click Fix)
      if (isAutoExpandMode) {
        if (collapsedFolders[folder.folder_id]) {
          dispatch(toggleCollapsedFolder(folder.folder_id));
        }
      } else {
        if (!expandedFolders[folder.folder_id]) {
          dispatch(toggleFolder(folder.folder_id));
        }
      }

      // Trigger contextual filter
      applyContextualFilter(folder, workspace, isPersonal);

      dispatch(setSelectedWorkspace(workspace));
      dispatch(setSelectedFolder(folder));
      dispatch(setSelectedSnippet(null));
      dispatch(setIsCreatingNewItem(false));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          folder_id: folder.folder_id,
          folder_name: folder.folder_name,
        }),
      );
    },
    [
      dispatch,
      expandedWorkspaces,
      isAutoExpandMode,
      collapsedWorkspaces,
      applyContextualFilter,
      collapsedFolders,
      expandedFolders,
    ],
  );
  const handleOptionsClick = (e: React.MouseEvent, workspace: Workspace) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 192;
    const popupHeight = 160; // Estimated height for options menu
    const left = Math.min(window.innerWidth - popupWidth - 4, rect.right + 4);

    // Smart Positioning
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < popupHeight;
    const top = openUpwards ? rect.top - popupHeight - 4 : rect.bottom + 4;

    setOptionsPopup({
      isOpen: true,
      position: {
        top,
        left,
      },
      workspace,
    });
  };

  const handleFolderOptionsClick = (e: React.MouseEvent, folder: Folder, workspace: Workspace) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 192;
    const popupHeight = 160; // Estimated height
    const left = Math.min(window.innerWidth - popupWidth - 4, rect.right + 4);

    // Smart Positioning
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < popupHeight;
    const top = openUpwards ? rect.top - popupHeight - 4 : rect.bottom + 4;

    setFolderOptionsPopup({
      isOpen: true,
      position: {
        top,
        left,
      },
      folder,
      workspace,
    });
  };

  const handleFolderCreateClick = (e: React.MouseEvent, folder: Folder, workspace: Workspace) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    setFolderCreateMenu({
      isOpen: true,
      triggerRect: rect,
      folder,
      workspace,
    });
  };

  const handleWorkspaceCreateClick = (e: React.MouseEvent, workspace: Workspace) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    setFolderCreateMenu({
      isOpen: true,
      triggerRect: rect,
      folder: null,
      workspace,
    });
  };

  const handleFolderStatsClick = (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 192; // 48 * 4
    const menuHeight = 140; // Estimated height
    const left = Math.min(window.innerWidth - menuWidth - 4, rect.right + 4);

    // Smart Positioning
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight;
    const top = openUpwards ? rect.top - menuHeight - 4 : rect.bottom + 4;

    setFolderStatsMenu({
      isOpen: true,
      position: { top, left },
      folder,
    });
  };

  const handleWorkspaceStatsClick = (e: React.MouseEvent, workspace: Workspace) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = 140; // Estimated height
    const left = Math.min(window.innerWidth - menuWidth - 4, rect.right + 4);

    // Smart Positioning
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight;
    const top = openUpwards ? rect.top - menuHeight - 4 : rect.bottom + 4;

    setWorkspaceStatsMenu({
      isOpen: true,
      position: { top, left },
      workspace,
    });
  };

  const handleOpenAllLinks = async (urls: string[]) => {

    if (!urls || urls.length === 0) {
      console.warn('[SideBar] handleOpenAllLinks received empty array');
      return;
    }

    const processed = urls
      .map(url => {
        if (url.startsWith('note:')) {
          const sid = url.replace('note:', '');
          return chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
        }
        return url;
      })
      .filter(Boolean);

    if (processed.length === 0) return;

    // Open background tabs FIRST
    processed.slice(1).forEach(url => {
      chrome.tabs.create({ url, active: false });
    });

    // Navigate current tab LAST
    window.location.href = processed[0];

    triggerToast(`Opening ${processed.length} links...`, 'success');
  };

  const handleOpenAllSnippets = async (snippets: Snippet[]) => {

    if (!snippets || snippets.length === 0) return;

    const noteUrls = snippets
      .map(s => {
        const id = s.id || s.snippet_id;
        return id ? chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${id}`) : null;
      })
      .filter(Boolean) as string[];

    if (noteUrls.length === 0) return;

    // Open background tabs FIRST
    noteUrls.slice(1).forEach(url => {
      chrome.tabs.create({ url, active: false });
    });

    // Navigate current tab LAST
    window.location.href = noteUrls[0];

    triggerToast(`Opening ${noteUrls.length} snippets...`, 'success');
  };

  const handleOpenEverything = async (urls: string[], snippets: Snippet[]) => {


    // Collect all final URLs to handle the "first one in current tab" logic correctly
    const allTargetUrls: string[] = [];

    snippets.forEach(s => {
      const id = s.id || s.snippet_id;
      if (id) {
        allTargetUrls.push(chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${id}`));
      }
    });

    urls.forEach(url => {
      if (url) {
        if (url.startsWith('note:')) {
          const sid = url.replace('note:', '');
          allTargetUrls.push(chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`));
        } else {
          allTargetUrls.push(url);
        }
      }
    });

    if (allTargetUrls.length === 0) return;

    // Open background tabs FIRST
    allTargetUrls.slice(1).forEach(url => {
      chrome.tabs.create({ url, active: false });
    });

    // Navigate current tab LAST
    window.location.href = allTargetUrls[0];

    triggerToast(`Opening ${allTargetUrls.length} items...`, 'success');
  };

  const handleCreateNote = (folder: Folder | null, workspace: Workspace) => {
    // Set the folder and workspace in Redux
    dispatch(setSelectedWorkspace(workspace));
    dispatch(setSelectedFolder(folder));
    dispatch(setSelectedSnippet(null));
    dispatch(
      setSnippetBreadCrum({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        folder_id: folder?.folder_id || null,
        folder_name: folder?.folder_name || null,
      }),
    );
    dispatch(setIsCreatingNewItem(true));
    setFolderCreateMenu({ isOpen: false, triggerRect: null, folder: null, workspace: null });
  };

  const handleCreatePrompt = (folder: Folder | null, workspace: Workspace) => {
    // EXCLUSIVITY: Clear other editor states before starting prompt
    dispatch(clearEditorStates());

    // Set the folder and workspace in Redux
    dispatch(setSelectedWorkspace(workspace));
    dispatch(setSelectedFolder(folder));

    // Create a dummy snippet to trigger the prompt editor
    // This relies on the Container detecting category='prompt' and switching to promptEditor
    const dummyPrompt = {
      category: 'prompt',
      key: '',
      value: '',
      snippet_id: '',
      id: '',
      workspace_id: workspace.workspace_id,
      folder_id: folder?.folder_id,
      tags: [],
    };

    dispatch(setSelectedSnippet(dummyPrompt as unknown as Snippet));

    dispatch(
      setSnippetBreadCrum({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        folder_id: folder?.folder_id || null,
        folder_name: folder?.folder_name || null,
      }),
    );
    // Explicitly turn OFF creating new item so we don't default to Note Editor
    dispatch(setIsCreatingNewItem(false));
    setFolderCreateMenu({ isOpen: false, triggerRect: null, folder: null, workspace: null });
  };

  const handleCreateFolder = (folder: Folder | null, workspace: Workspace) => {
    // If folder is provided, it's a subfolder? But popup handles collections.
    // For now, if folder is null (workspace level), we create a collection in workspace.
    // If folder is present, create subfolder in that folder (if supported).
    // The previous logic for workspace "+" was setCollectionCreationWorkspace(ws).
    setCollectionCreationWorkspace(workspace);
    // If subfolder creation logic exists, we should use it. For now, using collection popup.
    setShowCreateCollectionPopup(true);
    setFolderCreateMenu({ isOpen: false, triggerRect: null, folder: null, workspace: null });
  };

  const handleCreateLink = (folder: Folder | null, workspace: Workspace) => {
    // Set the folder and workspace in Redux
    dispatch(setSelectedWorkspace(workspace));
    dispatch(setSelectedFolder(folder));
    dispatch(setSelectedSnippet(null));
    dispatch(
      setSnippetBreadCrum({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        folder_id: folder?.folder_id || null,
        folder_name: folder?.folder_name || null,
      }),
    );
    // Open link edit modal in create mode
    dispatch(openLinkEditModal({ editMode: false, snippet: null }));
    setFolderCreateMenu({ isOpen: false, triggerRect: null, folder: null, workspace: null });
  };

  const handleGoHome = () => {
    // Navigate to home by clearing all selections
    dispatch(setSelectedWorkspace(null));
    dispatch(setSelectedFolder(null));
    dispatch(setSelectedSnippet(null));
    dispatch(setSnippetBreadCrum(null));
    dispatch(setIsCreatingNewItem(false));

    // Close command list view if open
    dispatch(setIsCommandListView(false));

    // Bug #3 Fix
    if (!isAutoExpandMode) {
      dispatch(expandAllFolders({}));
      dispatch(expandAllWorkspaces({}));
    } else {
      dispatch(setCollapsedFolders({}));
      dispatch(setCollapsedWorkspaces({}));
    }
  };

  /*
   * Handle Single Click:
   * - Notes -> Note Editor (viewSnippet)
   * - Links -> Link Editor (openLinkEditModal)
   * - Bulk Links (TabGroup) -> Bulk Link Editor (via CustomEvent)
   */
  const handleSnippetClick = (snippet: Snippet, workspace: Workspace, folder: Folder | null) => {
    const category = (snippet.category || '').toLowerCase();
    const isLink = isLinkCategory(category);
    const isBulkLink = category === 'tabgroup' || category === 'tab group' || category === 'bulk_link';
    const isPrompt = category === 'prompt';

    // Create breadcrumb for the editor context
    const breadcrumb: NewSnippetBreadCrum = {
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
      folder_id: folder?.folder_id || null,
      folder_name: folder?.folder_name || null,
    };

    if (isBulkLink) {
      window.dispatchEvent(
        new CustomEvent('openBulkEditor', {
          detail: {
            snippet,
            workspace,
            folder,
          },
        }),
      );
    } else if (isLink) {
      // For single links, open the Link Editor modal
      dispatch(setSnippetBreadCrum(breadcrumb));
      dispatch(
        openLinkEditModal({
          editMode: true,
          snippet,
        }),
      );
    } else if (isPrompt) {
      // For prompts, open the Prompt Editor
      dispatch(setSelectedWorkspace(workspace));
      dispatch(setSelectedFolder(folder));
      dispatch(setSelectedSnippet(snippet));
      dispatch(setIsCreatingNewItem(false));
      dispatch(setSnippetBreadCrum(breadcrumb));
    } else {
      // For notes, use viewSnippet to properly set up the editor state
      dispatch(
        viewSnippet({
          snippet,
          breadcrumb,
        }),
      );
    }
  };

  // Returns an icon based on snippet category.
  const renderSnippetIcon = (snippet: any, size: number = 14) => {
    const category = snippet?.category || '';
    const lowerCat = category.toLowerCase();

    // 0. Custom User Icon (Precedence over everything else)
    if (snippet?.icon && snippet.icon !== 'text') {
      if (snippet.icon.startsWith('U+')) {
        return (
          <span style={{ fontSize: size, lineHeight: '1em' }}>
            {String.fromCodePoint(parseInt(snippet.icon.replace('U+', ''), 16))}
          </span>
        );
      }
      return (
        <span
          style={{ width: size, height: size, display: 'inline-block' }}
          dangerouslySetInnerHTML={{ __html: snippet.icon }}
        />
      );
    }

    // 1. Tab Groups / Bulk Links - Use StackedLinkIcon with URLs
    if (lowerCat === 'tabgroup' || lowerCat === 'tab group' || lowerCat === 'bulk_link') {
      // Extract URLs from snippet value
      let urls: string[] = [];
      if (snippet?.value) {
        try {
          // Try parsing as JSON first
          const valueStr = typeof snippet.value === 'string' ? snippet.value : JSON.stringify(snippet.value);
          const parsed = JSON.parse(valueStr);
          if (Array.isArray(parsed)) {
            urls = parsed.map((item: any) => item.url || item).filter(Boolean);
          } else if (parsed?.urls && Array.isArray(parsed.urls)) {
            urls = parsed.urls;
          }
        } catch {
          // If not JSON, try to extract URLs from string
          const valueStr = typeof snippet.value === 'string' ? snippet.value : String(snippet.value);
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const matches = valueStr.match(urlRegex);
          if (matches) urls = matches;
        }
      }
      return <StackedLinkIcon urls={urls} size={size} fallback="tabgroup" maxIcons={2} />;
    }

    // 2. Any other Link usage (Quick link, link, my link, etc.)
    if (lowerCat.includes('link')) {
      // Extract URL to show favicon
      let url = '';
      if (typeof snippet.value === 'string') {
        url = snippet.value;
      } else if (snippet.value && typeof snippet.value === 'object' && !Array.isArray(snippet.value)) {
        // handle potential object value
        url = (snippet.value as any).url || '';
      }

      if (url) {
        return <img src={getFaviconUrl(url)} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />;
      }
      return <FaLink size={size} />;
    }

    // 3. Prompts
    if (lowerCat === 'prompt') {
      return <LuSparkles size={size} />;
    }

    // 4. Default to Note
    return <NotesIcon size={size} />;
  };

  // Keep these for potential future use or context menu actions
  const openSingleLink = (url: string): void => {
    chrome.tabs.create({ url }, tab => {
      if (chrome.runtime.lastError) {
        console.error('Error opening tab:', chrome.runtime.lastError.message);
      } else {

      }
    });
  };

  const openMultipleLinks = async (urls: string[]): Promise<void> => {
    if (urls.length === 0) return;

    urls.forEach(url => {
      chrome.tabs.create({ url }, tab => {
        if (chrome.runtime.lastError) {
          console.error(`Error opening tab for ${url}:`, chrome.runtime.lastError.message);
        } else {

        }
      });
    });
  };

  // Helper to ensure folders is always an array
  const ensureFoldersArray = useCallback((folders: any): Folder[] => {
    if (Array.isArray(folders)) {
      return folders;
    }
    if (folders == null) {
      return [];
    }
    console.warn('[SideBar] Expected folders array but got:', typeof folders, folders);
    return [];
  }, []);

  // Memoize folder lookup to avoid expensive loops on every render
  const getFolderBySnippetIdFromTeams = useCallback(
    (snippetId: string): Folder | null | undefined => {
      if (selectedTeam) {
        for (const workspace of selectedTeam.workspaces || []) {
          // 1. Check inside folders - ensure it's an array
          const folders = ensureFoldersArray(workspace.folders);
          for (const folder of folders) {
            const match = (folder.snippets ?? []).find(
              snippet => snippet.id === snippetId || snippet.snippet_id === snippetId,
            );
            if (match) {
              return folder;
            }
          }

          // 2. Check directly under workspace
          const matchInWorkspace = (workspace.workspace_snippets ?? []).find(
            snippet => snippet.id === snippetId || snippet.snippet_id === snippetId,
          );
          if (matchInWorkspace) {
            return null;
          }
        }
      }
      return undefined;
    },
    [selectedTeam, ensureFoldersArray],
  );

  // Memoize favorites with folder lookup to avoid expensive recalculations
  const favoritesWithFolders = useMemo(() => {
    const teamFavorites = favoritesMapping[selectedTeamId] || [];
    return teamFavorites
      .map(item => {
        const folder = getFolderBySnippetIdFromTeams(item.id);
        return folder !== undefined ? { item, folder } : null;
      })
      .filter((result): result is { item: Snippet; folder: Folder | null } => result !== null);
  }, [favoritesMapping, selectedTeamId, getFolderBySnippetIdFromTeams]);

  const renderFavorites = useCallback(() => {
    const handleReorder = (reorderedItems: Snippet[]) => {
      try {
        chrome.storage.local.get('myFavouriteItems', result => {
          const favItems = result.myFavouriteItems || {};

          // Replace the current team's favorites with the reordered list
          favItems[selectedTeamId] = reorderedItems;

          // Update chrome.storage.local
          chrome.storage.local.set({ myFavouriteItems: favItems }, () => {
            // Update the state
            setFavoritesMapping(favItems);
          });
        });
      } catch (error) {
        console.error('Error reordering favorites:', error);
      }
    };

    // Callback to handle edit link/tab group/prompt using the same flow as handleSnippetClick
    const handleFavoriteEditLink = (item: { snippet: any; workspace: any; folder: any }) => {
      if (item.snippet && item.workspace) {
        handleSnippetClick(item.snippet, item.workspace, item.folder);
      }
    };

    const filteredFavorites = favoritesWithFolders.map(f => f.item);

    return (
      <>
        {filteredFavorites.length > 0 ? (
          <Reorder.Group axis="y" values={filteredFavorites} onReorder={handleReorder} className="flex flex-col gap-1">
            {favoritesWithFolders.map(({ item, folder }, index: number) => {
              return (
                <Reorder.Item key={item.id} value={item} className="list-none">
                  <FavoriteItem
                    key={item.id}
                    userId={userId}
                    snippet={item}
                    folder={folder}
                    workspace={workspace}
                    selectedItem={selectedItem?.snippet_id || null}
                    reload={reload}
                    selectedTeamId={selectedTeamId}
                    favoritesMapping={favoritesMapping}
                    setFavoritesMapping={setFavoritesMapping}
                    index={index}
                    hotkeysMap={hotkeysMap}
                    setHotkeysMap={setHotkeysMap}
                    shortcutsMap={shortcutsMap}
                    setShortcutsMap={setShortcutsMap}
                    onRequestEditLink={handleFavoriteEditLink}
                    isDarkMode={isDarkMode}
                  />
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        ) : (
          <div className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-1">No favorites yet.</div>
        )}
      </>
    );
  }, [favoritesWithFolders, selectedTeamId, setFavoritesMapping, userId, workspace, selectedItem, reload]);

  // Expansion Helpers (Bug #2 & Risk #1 Fix)
  const isSearchActive = debouncedSidebarSearchTerm.trim() !== '';
  const isExpandedWorkspace = (id: string) =>
    isSearchActive || (isAutoExpandMode ? !collapsedWorkspaces[id] : !!expandedWorkspaces[id]);

  const isExpandedFolder = (id: string) =>
    isSearchActive || (isAutoExpandMode ? !collapsedFolders[id] : !!expandedFolders[id]);

  // Update effect to avoid Redux pollution (Bug #2 Fix)
  useEffect(() => {
    // Update ref
    prevAutoExpandMode.current = isAutoExpandMode;
  }, [isAutoExpandMode]);

  // Find the Personal Space team using the is_personal_space flag from API
  const defaultPrivateTeam = useMemo(() => {
    return teams.find(team => team.is_personal_space === true);
  }, [teams]);

  // Personal Space workspaces from Workspace_1 (always visible regardless of selected org)
  // Apply filters when search/filter is active
  const personalSpaceWorkspaces: EnrichedWorkspace[] = useMemo(() => {
    if (!defaultPrivateTeam?.workspaces) return [];

    const hasAnyFilter =
      debouncedSidebarSearchTerm.trim() || filterState.assignees.length > 0 || filterState.contentType !== 'all';

    // Get base workspaces
    const baseWorkspaces = defaultPrivateTeam.workspaces.map(ws => {
      const safeFolders = Array.isArray(ws.folders) ? ws.folders : [];
      return { ...ws, folders: safeFolders, type: 'private' } as EnrichedWorkspace;
    });

    // If no filter active, return all
    if (!hasAnyFilter) return baseWorkspaces;

    // Apply the same filtering logic as filteredWorkspaces
    const searchTerm = debouncedSidebarSearchTerm.toLowerCase().trim();
    const hasSearchTerm = searchTerm.length > 0;

    const matchesContentType = (snippet: Snippet): boolean => {
      if (filterState.contentType === 'all') return true;
      const category = (snippet.category || 'snippet').toLowerCase();
      switch (filterState.contentType) {
        case 'links':
          return category === 'link' || category === 'tabgroup' || category === 'tab group' || category === 'bulk_link';
        case 'notes':
          return category === 'snippet' || category === 'note';
        case 'prompts':
          return category === 'prompt';
        default:
          return true;
      }
    };

    const matchesAssignee = (snippet: Snippet): boolean => {
      if (filterState.assignees.length === 0) return true;
      const snippetUserId = (snippet as any).user_id || (snippet as any).owner_id || (snippet as any).created_by;
      return filterState.assignees.includes(snippetUserId);
    };

    // Helper to check if folder creator matches assignee filter
    const folderCreatorMatchesAssignee = (folder: Folder): boolean => {
      if (filterState.assignees.length === 0) return false;
      const folderUserId = (folder as any).user_id || (folder as any).admin_user_id || (folder as any).created_by;
      return folderUserId ? filterState.assignees.includes(folderUserId) : false;
    };

    // Helper to check if workspace creator matches assignee filter
    const workspaceCreatorMatchesAssignee = (ws: EnrichedWorkspace): boolean => {
      if (filterState.assignees.length === 0) return false;
      const wsUserId = ws.admin_user_id || (ws as any).user_id || (ws as any).created_by;
      return wsUserId ? filterState.assignees.includes(wsUserId) : false;
    };

    const matchesSearch = (snippet: Snippet): boolean => {
      if (!hasSearchTerm) return true;
      const key = snippet.key?.toLowerCase() || '';
      const value = typeof snippet.value === 'string' ? snippet.value.toLowerCase() : '';
      const urls =
        typeof snippet.value === 'object' && snippet.value && 'urls' in snippet.value
          ? (Array.isArray((snippet.value as any).urls) ? (snippet.value as any).urls : [])
            .map((url: string) => url.toLowerCase())
            .join(' ')
          : '';
      return key.includes(searchTerm) || value.includes(searchTerm) || urls.includes(searchTerm);
    };

    return baseWorkspaces
      .map(workspace => {
        const workspaceNameMatches = hasSearchTerm
          ? workspace.workspace_name.toLowerCase().includes(searchTerm)
          : false;

        const filteredWorkspaceSnippets =
          workspace.workspace_snippets?.filter(snippet => {
            const searchMatch = workspaceNameMatches ? true : matchesSearch(snippet);
            const contentMatch = matchesContentType(snippet);
            const assigneeMatch = matchesAssignee(snippet);
            return searchMatch && contentMatch && assigneeMatch;
          }) || [];

        const matchingFolders = (workspace.folders || [])
          .map(folder => {
            const folderNameMatches = hasSearchTerm ? folder.folder_name?.toLowerCase().includes(searchTerm) : false;
            const shouldShowAllContent = workspaceNameMatches || folderNameMatches;

            const filteredSnippets = (folder.snippets || []).filter(snippet => {
              const searchMatch = shouldShowAllContent ? true : matchesSearch(snippet);
              const contentMatch = matchesContentType(snippet);
              const assigneeMatch = matchesAssignee(snippet);
              return searchMatch && contentMatch && assigneeMatch;
            });
            const hasMatchingSnippets = filteredSnippets.length > 0;
            const folderCreatorMatches = folderCreatorMatchesAssignee(folder);
            const folderMatches = shouldShowAllContent || hasMatchingSnippets || folderCreatorMatches;

            return {
              ...folder,
              snippets: filteredSnippets,
              hasMatches: folderMatches,
            };
          })
          .filter(folder => folder.hasMatches);

        const workspaceCreatorMatches = workspaceCreatorMatchesAssignee(workspace);
        const hasMatches =
          workspaceNameMatches ||
          matchingFolders.length > 0 ||
          filteredWorkspaceSnippets.length > 0 ||
          workspaceCreatorMatches;
        return { ...workspace, folders: matchingFolders, workspace_snippets: filteredWorkspaceSnippets, hasMatches };
      })
      .filter(workspace => workspace.hasMatches);
  }, [defaultPrivateTeam, debouncedSidebarSearchTerm, filterState]);

  // Debounce sidebar search term (2 seconds for better UX)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSidebarSearchTerm(sidebarSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarSearchTerm]);

  // Filter workspaces based on sidebar search term AND filter state (assignees + content type)
  const filteredWorkspaces = useMemo(() => {
    const searchTerm = debouncedSidebarSearchTerm.toLowerCase().trim();
    const hasSearchTerm = searchTerm.length > 0;
    const hasAssigneeFilter = filterState.assignees.length > 0;
    const hasContentTypeFilter = filterState.contentType !== 'all';
    const hasAnyFilter = hasSearchTerm || hasAssigneeFilter || hasContentTypeFilter;

    // Helper to check if snippet matches content type filter
    const matchesContentType = (snippet: Snippet): boolean => {
      if (filterState.contentType === 'all') return true;
      const category = (snippet.category || 'snippet').toLowerCase();
      switch (filterState.contentType) {
        case 'links':
          return category === 'link' || category === 'tabgroup' || category === 'tab group' || category === 'bulk_link';
        case 'notes':
          return category === 'snippet' || category === 'note';
        case 'prompts':
          return category === 'prompt';
        default:
          return true;
      }
    };

    // Helper to check if snippet matches assignee filter
    const matchesAssignee = (snippet: Snippet): boolean => {
      if (filterState.assignees.length === 0) return true;
      // Check if snippet's owner_id or user_id matches any selected assignee
      const snippetUserId = (snippet as any).user_id || (snippet as any).owner_id || (snippet as any).created_by;
      return filterState.assignees.includes(snippetUserId);
    };

    // Helper to check if folder creator matches assignee filter
    const folderCreatorMatchesAssignee = (folder: Folder): boolean => {
      if (filterState.assignees.length === 0) return false; // Only relevant when assignee filter is active
      const folderUserId = (folder as any).user_id || (folder as any).admin_user_id || (folder as any).created_by;
      return folderUserId ? filterState.assignees.includes(folderUserId) : false;
    };

    // Helper to check if workspace creator matches assignee filter
    const workspaceCreatorMatchesAssignee = (workspace: EnrichedWorkspace): boolean => {
      if (filterState.assignees.length === 0) return false; // Only relevant when assignee filter is active
      const workspaceUserId = workspace.admin_user_id || (workspace as any).user_id || (workspace as any).created_by;
      return workspaceUserId ? filterState.assignees.includes(workspaceUserId) : false;
    };

    // Helper to check if snippet matches search term
    const matchesSearch = (snippet: Snippet): boolean => {
      if (!hasSearchTerm) return true;
      const key = snippet.key?.toLowerCase() || '';
      const value = typeof snippet.value === 'string' ? snippet.value.toLowerCase() : '';
      const urls =
        typeof snippet.value === 'object' && snippet.value && 'urls' in snippet.value
          ? (Array.isArray((snippet.value as any).urls) ? (snippet.value as any).urls : [])
            .map((url: string) => url.toLowerCase())
            .join(' ')
          : '';
      return key.includes(searchTerm) || value.includes(searchTerm) || urls.includes(searchTerm);
    };

    // If no filters applied, return all workspaces
    if (!hasAnyFilter) {
      return enrichedWorkspaces;
    }

    return enrichedWorkspaces
      .map(workspace => {
        // Check if workspace name matches search
        const workspaceNameMatches = hasSearchTerm
          ? workspace.workspace_name.toLowerCase().includes(searchTerm)
          : false;

        // Filter workspace-level snippets
        const filteredWorkspaceSnippets =
          workspace.workspace_snippets?.filter(snippet => {
            // Fix: If workspace matches, show all its snippets (search match inherited)
            const searchMatch = workspaceNameMatches ? true : matchesSearch(snippet);
            const contentMatch = matchesContentType(snippet);
            const assigneeMatch = matchesAssignee(snippet);
            return searchMatch && contentMatch && assigneeMatch;
          }) || [];

        // Filter folders
        const workspaceFolders = Array.isArray(workspace.folders) ? workspace.folders : [];
        const matchingFolders = workspaceFolders
          .map(folder => {
            const folderNameMatches = hasSearchTerm ? folder.folder_name?.toLowerCase().includes(searchTerm) : false;
            // Fix: If workspace matches OR folder matches, show all folder snippets (inherit match)
            const shouldShowAllContent = workspaceNameMatches || folderNameMatches;

            // Filter snippets in folder
            const filteredSnippets = (Array.isArray(folder.snippets) ? folder.snippets : []).filter(snippet => {
              const searchMatch = shouldShowAllContent ? true : matchesSearch(snippet);
              const contentMatch = matchesContentType(snippet);
              const assigneeMatch = matchesAssignee(snippet);
              return searchMatch && contentMatch && assigneeMatch;
            });

            // Folder matches if:
            // - Name matches OR Parent Workspace matches (Explicitly included)
            // - OR has matching snippets
            // - OR created by assignee
            const hasMatchingSnippets = filteredSnippets.length > 0;
            const folderCreatorMatches = folderCreatorMatchesAssignee(folder);
            const folderMatches = shouldShowAllContent || hasMatchingSnippets || folderCreatorMatches;

            return {
              ...folder,
              snippets: filteredSnippets,
              hasMatches: folderMatches,
            };
          })
          .filter(folder => folder.hasMatches);

        // Workspace matches if:
        // - Workspace name matches search (even if no snippets match other filters)
        // - OR has matching folders
        // - OR has matching workspace-level snippets
        // - OR workspace was created by the selected assignee (show empty workspaces created by selected user)
        const workspaceCreatorMatches = workspaceCreatorMatchesAssignee(workspace);
        const hasMatches =
          workspaceNameMatches ||
          matchingFolders.length > 0 ||
          filteredWorkspaceSnippets.length > 0 ||
          workspaceCreatorMatches;

        return {
          ...workspace,
          folders: matchingFolders,
          workspace_snippets: filteredWorkspaceSnippets,
          hasMatches,
        };
      })
      .filter(workspace => workspace.hasMatches);
  }, [enrichedWorkspaces, debouncedSidebarSearchTerm, filterState]);

  // Helper to flatten snippets from workspaces and folders
  const getFlattenedSnippets = useCallback((workspaces: EnrichedWorkspace[]) => {
    const allItems: { snippet: Snippet; workspace: EnrichedWorkspace; folder: Folder | null }[] = [];
    const collectFromFolders = (folders: Folder[], workspace: EnrichedWorkspace) => {
      folders.forEach(folder => {
        if (folder.snippets) {
          folder.snippets.forEach(s => allItems.push({ snippet: s, workspace, folder }));
        }
        if (folder.folders) collectFromFolders(folder.folders, workspace);
      });
    };
    workspaces.forEach(ws => {
      if (ws.workspace_snippets) {
        ws.workspace_snippets.forEach(s => allItems.push({ snippet: s, workspace: ws, folder: null }));
      }
      if (ws.folders) collectFromFolders(ws.folders, ws);
    });
    return allItems;
  }, []);

  // Helper to render a simple flat list of snippets for search
  const renderSimpleFlatList = (items: { snippet: Snippet; workspace: EnrichedWorkspace; folder: Folder | null }[]) => {
    return (
      <div className="space-y-0.5 py-1">
        {items.map((item, idx) => (
          <div key={`${item.snippet.id}-${idx}`}>
            {renderSnippetItem(item.snippet, item.workspace, item.folder, false, false)}
          </div>
        ))}
      </div>
    );
  };

  // Helper to group snippets by category
  const groupSnippetsByCategory = useCallback(
    (items: { snippet: Snippet; workspace: EnrichedWorkspace; folder: Folder | null }[]) => {
      const grouped = {
        links: [] as typeof items,
        notes: [] as typeof items,
        prompts: [] as typeof items,
      };
      items.forEach(item => {
        const cat = (item.snippet.category || 'snippet').toLowerCase();
        if (
          cat.includes('link') ||
          cat.includes('tabgroup') ||
          cat.includes('bulk_link') ||
          cat.includes('tab group')
        ) {
          grouped.links.push(item);
        } else if (cat === 'prompt') {
          grouped.prompts.push(item);
        } else {
          grouped.notes.push(item);
        }
      });
      return grouped;
    },
    [],
  );

  const personalFlattened = useMemo(
    () => groupSnippetsByCategory(getFlattenedSnippets(personalSpaceWorkspaces)),
    [personalSpaceWorkspaces, getFlattenedSnippets, groupSnippetsByCategory],
  );

  const orgFlattened = useMemo(
    () => groupSnippetsByCategory(getFlattenedSnippets(filteredWorkspaces)),
    [filteredWorkspaces, getFlattenedSnippets, groupSnippetsByCategory],
  );

  // Helper to calculate total recursive snippets in a folder
  const getTotalFolderItems = useCallback((folder: Folder): number => {
    let count = (folder.snippets || []).length;
    if (folder.folders && Array.isArray(folder.folders)) {
      folder.folders.forEach(sub => {
        count += getTotalFolderItems(sub);
      });
    }
    return count;
  }, []);

  // Helper to calculate total recursive snippets in a workspace
  const getTotalWorkspaceItems = useCallback(
    (ws: EnrichedWorkspace): number => {
      let count = (ws.workspace_snippets || []).length;
      if (ws.folders && Array.isArray(ws.folders)) {
        ws.folders.forEach(f => {
          count += getTotalFolderItems(f);
        });
      }
      return count;
    },
    [getTotalFolderItems],
  );

  // Auto-expand sections on search match
  useEffect(() => {
    const searchTerm = debouncedSidebarSearchTerm.toLowerCase().trim();
    if (!searchTerm) return;

    const sharedOnlySection = 'Shared Only Folders';
    const publicSection = 'Public Folders';
    const privateSection = 'Private Folders';
    const personalSection = 'Personal Space';

    const hasSharedOnly = filteredWorkspaces.some(ws => ws.type === 'shareonly');
    if (hasSharedOnly) {
      if (collapsedSections[sharedOnlySection]) dispatch(toggleCollapsedSection(sharedOnlySection));
      setIsOrgFoldersCollapsed(false);
    }

    const hasPublic = filteredWorkspaces.some(ws => ws.type === 'public');
    if (hasPublic) {
      if (collapsedSections[publicSection]) dispatch(toggleCollapsedSection(publicSection));
      setIsOrgFoldersCollapsed(false);
    }

    const hasOrgPrivate = filteredWorkspaces.some(ws => ws.type === 'private' && !(ws as any).is_personal_space);
    if (hasOrgPrivate) {
      if (collapsedSections[privateSection]) dispatch(toggleCollapsedSection(privateSection));
      setIsOrgFoldersCollapsed(false);
    }

    const hasPersonal = personalSpaceWorkspaces.length > 0;
    if (hasPersonal && collapsedSections[personalSection]) {
      dispatch(toggleCollapsedSection(personalSection));
    }
  }, [debouncedSidebarSearchTerm, filteredWorkspaces, collapsedSections, dispatch, setIsOrgFoldersCollapsed]);

  // Org-specific private workspaces (from currently selected org) - use filteredWorkspaces
  const orgPrivateWorkspaces: EnrichedWorkspace[] = useMemo(() => {
    return filteredWorkspaces.filter(ws => ws.type === 'private');
  }, [filteredWorkspaces]);

  // Org-specific shared ONLY workspaces (shareonly) - use filteredWorkspaces
  const orgSharedOnlyWorkspaces: EnrichedWorkspace[] = useMemo(() => {
    return filteredWorkspaces
      .filter(ws => ws.type === 'shareonly')
      .sort((a, b) => a.workspace_name.localeCompare(b.workspace_name));
  }, [filteredWorkspaces]);

  // Org-specific PUBLIC workspaces (public) - use filteredWorkspaces
  const orgPublicWorkspaces: EnrichedWorkspace[] = useMemo(() => {
    return filteredWorkspaces
      .filter(ws => ws.type === 'public')
      .sort((a, b) => a.workspace_name.localeCompare(b.workspace_name));
  }, [filteredWorkspaces]);

  const groupedByType: Record<'private' | 'shareonly' | 'public', EnrichedWorkspace[]> = useMemo(() => {
    const groups = { private: [], shareonly: [], public: [] } as Record<
      'private' | 'shareonly' | 'public',
      EnrichedWorkspace[]
    >;
    filteredWorkspaces.forEach(ws => {
      const t = (ws.type as 'private' | 'shareonly' | 'public') || 'public';
      groups[t].push(ws);
    });
    return groups;
  }, [filteredWorkspaces]);

  const sharedWorkspaces = useMemo(
    () => [...groupedByType.shareonly, ...groupedByType.public],
    [groupedByType.shareonly, groupedByType.public],
  );

  // Render a single snippet item
  const renderSnippetItem = (
    snippet: Snippet,
    workspace: Workspace,
    folder: Folder | null,
    isNested: boolean,
    isDataTypeView: boolean = false,
  ) => {
    const isSelected = selectedSnippet?.id === snippet.id;

    // Use cloud data for customization
    const displayName = snippet.key === 'Tab Group' ? 'Link Group' : snippet.key;
    const displayIcon = snippet.icon;
    const displayColor = snippet.color || undefined;

    // Determine category for click behavior
    const category = (snippet.category || 'snippet').toLowerCase();
    const isLink = isLinkCategory(category);
    const isNoteOrPrompt = category === 'snippet' || category === 'note' || category === 'prompt';

    // Handler for clicking the snippet item
    const handleSnippetClick = (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      if (isNoteOrPrompt) {
        // Create breadcrumb for the snippet location
        const breadcrumb: NewSnippetBreadCrum = {
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          folder_id: folder?.folder_id || null,
          folder_name: folder?.folder_name || null,
        };
        // Open note/prompt in RichEditor (viewSnippet action)
        dispatch(viewSnippet({ snippet, breadcrumb }));
      } else if (isLink) {
        // Main click now opens the link(s) in new tab
        handleOpenLinkInNewTab(e);
      }
    };

    // Handler for opening editor for link (swapped from clicking main area)
    const handleOpenEditorClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const isSingleLink =
        category == 'link' || category == 'biolink' || category == 'biolinks' || category == 'quicklink';

      if (isSingleLink) {
        const breadcrumb: NewSnippetBreadCrum = {
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          folder_id: folder?.folder_id || null,
          folder_name: folder?.folder_name || null,
        };
        dispatch(setSnippetBreadCrum(breadcrumb));
        dispatch(openLinkEditModal({ editMode: true, snippet }));
      } else {
        // Bulk link / Tab group
        window.dispatchEvent(new CustomEvent('openBulkEditor', { detail: { snippet, workspace, folder } }));
      }
    };

    // Handler for opening link in new tab
    const handleOpenLinkInNewTab = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        let urls: string[] = [];

        if (category === 'link') {
          // Single link
          const url = typeof snippet.value === 'string' ? snippet.value : '';
          if (url) urls = [url];
        } else if (
          category === 'tabgroup' ||
          category === 'tab group' ||
          category === 'bulk_link' ||
          category === 'quicklink'
        ) {
          // Tab group - parse the value
          if (typeof snippet.value === 'string') {
            try {
              const parsed = JSON.parse(snippet.value);
              urls = Array.isArray(parsed?.urls) ? parsed.urls : [];
            } catch {
              // If parsing fails, try as single URL
              if (snippet.value) urls = [snippet.value];
            }
          } else if (typeof snippet.value === 'object' && snippet.value) {
            urls = Array.isArray((snippet.value as any)?.urls) ? (snippet.value as any).urls : [];
          }
        }

        if (urls.length > 0) {
          const finalUrls = urls
            .map(url => {
              if (url.startsWith('note:')) {
                const sid = url.replace('note:', '');
                return chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
              }
              return url;
            })
            .filter(Boolean);

          if (finalUrls.length > 0) {
            // Background tabs FIRST
            finalUrls.slice(1).forEach(url => {
              if (url.startsWith('agent_chat?id=')) {
                const agentId = url.split('id=')[1];
                const extensionUrl = chrome.runtime.getURL(
                  `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                );
                chrome.tabs.create({ url: extensionUrl, active: false });
              } else {
                chrome.tabs.create({ url, active: false });
              }
            });
            // Navigate current tab LAST
            const firstUrl = finalUrls[0];
            if (firstUrl.startsWith('agent_chat?id=')) {
              const agentId = firstUrl.split('id=')[1];
              const extensionUrl = chrome.runtime.getURL(
                `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
              );
              window.location.href = extensionUrl;
            } else {
              window.location.href = firstUrl;
            }
          }
        } else {
          // Fallback: Open as note
          const sid = snippet.snippet_id || snippet.id;
          const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
          window.location.href = url;
        }
      } catch (err) {
        console.error('Failed to open link:', err);
      }
    };

    const snippetId = snippet.snippet_id || snippet.id;
    const isSelectedForDelete = selectedForDelete.has(snippetId);

    // Handle click based on bulk delete mode
    const handleItemClick = (e: React.MouseEvent) => {
      if (isBulkDeleteMode) {
        e.stopPropagation();
        e.preventDefault();
        toggleSnippetSelection(snippet);
      } else {
        handleSnippetClick(e);
      }
    };

    return (
      <div
        key={snippet.id}
        className={`group flex items-center gap-1 px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${isSelected
          ? 'text-purple-700 dark:text-purple-300 font-medium bg-transparent'
          : isDarkMode
            ? 'text-neutral-200 hover:bg-neutral-800'
            : `text-[#073642] ${isSheetUIOpen ? 'hover:bg-neutral-100' : 'hover:bg-[#eee8d5]'}`
          } ${isNested ? 'ml-4' : 'ml-2'}`}
        onClick={handleItemClick}
        onContextMenu={e => handleSnippetOptionsClick(e, snippet, workspace, folder)}>
        {/* Bulk Delete Checkbox */}
        {isBulkDeleteMode && (
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all mr-1 ${isSelectedForDelete
              ? 'bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] text-white'
              : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]'
              }`}
            onClick={e => {
              e.stopPropagation();
              toggleSnippetSelection(snippet);
            }}>
            {isSelectedForDelete && <FaCheck size={8} />}
          </div>
        )}
        <span
          className="w-5 h-5 flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 relative"
          style={{
            color: displayColor,
          }}>
          <span className="text-[14px] leading-none flex items-center justify-center">
            {displayIcon && displayIcon !== 'text' ? (
              displayIcon.startsWith('U+') ? (
                <span>{String.fromCodePoint(parseInt(displayIcon.replace('U+', ''), 16))}</span>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: displayIcon }} />
              )
            ) : (
              renderSnippetIcon(snippet, 12)
            )}
          </span>
        </span>
        {/* Replaced fixed width with flex box for name + type */}
        <div className="flex-1 flex items-center min-w-0 justify-start gap-1">
          <span
            className={`text-[10.5px] truncate ml-[-3px] ${!isDarkMode ? (isSheetUIOpen ? 'text-slate-800' : 'text-[#073642]') : 'text-neutral-300'}`}
            title={displayName}>
            {displayName}
          </span>
          {!isDataTypeView && (
            <span
              className={`text-[7px] tracking-wider shrink-0 ${!isDarkMode ? (isSheetUIOpen ? 'text-slate-500' : 'text-[#586e75]') : 'text-neutral-400'}`}>
              {snippet.category === 'snippet' || !snippet.category
                ? 'Note'
                : snippet.category === 'note'
                  ? 'Snippet'
                  : snippet.category?.toLowerCase() === 'bulk_link' ||
                    snippet.category?.toLowerCase() === 'tabgroup' ||
                    snippet.category?.toLowerCase() === 'tab group'
                    ? 'Link Group'
                    : snippet.category.charAt(0).toUpperCase() + snippet.category.slice(1)}
            </span>
          )}

          {/* External link icon for links/tabgroups - now opens editor (swapped) */}

          {!isBulkDeleteMode && (
            <span
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleSnippetOptionsClick(e, snippet, workspace, folder);
              }}
              className="hidden group-hover:block text-[13px] leading-3  font-bold -mt-2 shrink-0 cursor-pointer ml-auto pr-4"
              style={{ color: 'rgb(247, 247, 247)' }}>
              ...
            </span>
          )}
        </div>
      </div>
    );
  };

  // Helper function to open create workspace popup
  const openCreateWorkspacePopup = (
    access: 'public' | 'private' | 'shareonly',
    isPersonalSpace: boolean = false,
    targetTeamId?: string,
  ) => {
    if (onCreateWorkspace) {
      onCreateWorkspace(isPersonalSpace, access, targetTeamId);
    } else {
      console.warn('onCreateWorkspace prop not passed to SideBar');
    }
  };

  // Render a single folder recursively
  const renderFolder = (folder: Folder, ws: Workspace, depth: number = 0, isPersonalSpace: boolean = false) => {
    const isFolderExpanded = isExpandedFolder(folder.folder_id);
    const isFolderActive =
      selectedFolder?.folder_id === folder.folder_id && workspace?.workspace_id === ws.workspace_id;

    // Use cloud data for customization
    const displayName = folder.folder_name;
    const displayIcon = folder.icon;
    const displayColor = folder.color || undefined;

    return (
      <div key={folder.folder_id} className="space-y-0.5">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.3 rounded-lg transition-colors cursor-pointer group relative ${isFolderActive
            ? 'border border-[var(--color-borderDefault)] bg-transparent'
            : `border border-transparent ${!isDarkMode ? (isSheetUIOpen ? 'hover:bg-neutral-100' : 'hover:bg-[#eee8d5]') : 'dark:hover:bg-neutral-800'}`
            }`}
          onMouseEnter={() => {
            handleOwnerHoverEntry('folder', folder.folder_id);
            handleContextualFolderHoverEntry(folder, ws, isPersonalSpace);
          }}
          onMouseLeave={() => {
            handleOwnerHoverLeave();
            handleContextualFolderHoverLeave();
          }}
          onClick={e => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (isFolderExpanded) {
              // Collapsing
              if (isFolderActive) {
                // If we are collapsing the currently active folder, navigate back to workspace
                dispatch(backToWorkspace({ workspace: ws }));
              }
            }
            // Toggle expansion state on row click (Single Click = Toggle ONLY)
            handleToggleFolder(folder.folder_id, ws, isPersonalSpace);
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            // Double Click navigates to folder in main view
            handleFolderSelect(folder, ws, isPersonalSpace);
          }}
          onContextMenu={e => {
            e.preventDefault();
            handleFolderOptionsClick(e, folder, ws);
          }}>
          {(() => {
            const commonClasses =
              'hidden group-hover:block transition-all duration-200 text-neutral-500 shrink-0 absolute left-[-9px] top-1/2 -translate-y-1/2 z-10';

            // Only show for Org folders (not personal space)
            if (isPersonalSpace) return null;

            if (folder.access_code === 2) {
              return <FiGlobe className={commonClasses} size={11} />;
            } else if (folder.access_code === 1) {
              return <BsPeopleFill className={commonClasses} size={10} />;
            } else {
              // Default to private/lock for folders without explicit public/shared code
              return <MdLockOutline className={commonClasses} size={11} />;
            }
          })()}
          <div
            className={`flex-1 flex items-center gap-1 text-left text-[12px] truncate ml-[-5px] ${isFolderActive
              ? isDarkMode
                ? 'text-neutral-100 font-medium'
                : isSheetUIOpen
                  ? 'text-slate-900 font-medium'
                  : 'text-[#073642] font-medium'
              : isDarkMode
                ? 'text-neutral-300'
                : isSheetUIOpen
                  ? 'text-slate-700'
                  : 'text-[#073642]'
              }`}>
            <span
              className="transition-all duration-300 w-6 h-6 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleToggleFolder(folder.folder_id, ws, isPersonalSpace);
              }}
              style={{
                color: displayColor,
              }}>
              <span className="text-[14px] leading-none flex items-center justify-center">
                {displayIcon && displayIcon !== 'text' ? (
                  displayIcon.startsWith('U+') ? (
                    <span>{String.fromCodePoint(parseInt(displayIcon.replace('U+', ''), 16))}</span>
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: displayIcon }} />
                  )
                ) : (
                  <FaRegFolder size={14} />
                )}
              </span>
            </span>
            <span className="truncate ml-[-5px]">{displayName}</span>
            <span
              className={`ml-1 text-[10px] ${isFolderActive ? (isDarkMode ? 'text-neutral-300' : isSheetUIOpen ? 'text-slate-500' : 'text-[#586e75]') : isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              ({getTotalFolderItems(folder)})
            </span>

            {/* <button
              onClick={e => handleFolderStatsClick(e, folder)}
              className="ml-2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              style={{ color: '#8634EB' }}
              title="Open all">
              <FaExternalLinkAlt size={9} />
            </button> */}

            <button
              onClick={e => handleFolderCreateClick(e, folder, ws)}
              className="p-0.5 text-green-500 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Create item">
              <FaPlus size={10} />
            </button>
            <div className="flex-1" />
          </div>
        </div>

        {isFolderExpanded && !effectiveCollapsed && (
          <div className="space-y-0.5 pl-2 ">
            {/* 1. Render Sub-folders */}
            {folder.folders && folder.folders.length > 0 && (
              <div className="space-y-0.5">
                {folder.folders.map(subFolder => renderFolder(subFolder, ws, depth + 1, isPersonalSpace))}
              </div>
            )}
            {/* 2. Render Folder Snippets - Show if expanded, regardless of Auto Mode */}
            {folder.snippets && folder.snippets.length > 0 && (
              <div className="space-y-0.5">
                {folder.snippets.map(snippet => renderSnippetItem(snippet, ws, folder, false))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render a single workspace item (matching AltS)
  const renderWorkspace = (ws: EnrichedWorkspace, workspaceIndex: number, isPersonalSpace: boolean = false) => {
    const workspaceKey = ws.workspace_id || `workspace-${workspaceIndex}`;
    const isActive = workspace?.workspace_id === ws.workspace_id;

    // ✅ Use Central Helper (Risk #1 Fix)
    const isExpanded = isExpandedWorkspace(ws.workspace_id);
    // Ensure folders is always an array
    const folders = Array.isArray(ws.folders) ? ws.folders : [];

    // Use cloud data for customization
    const displayName = ws.workspace_name;
    const displayIcon = ws.icon;
    const displayColor = ws.color || undefined;

    return (
      <div key={workspaceKey} className="">
        <div
          onMouseEnter={() => {
            handleOwnerHoverEntry(isPersonalSpace ? 'personal' : 'workspace', ws.workspace_id);
            handleContextualWorkspaceHoverEntry(ws, isPersonalSpace);
          }}
          onMouseLeave={() => {
            handleOwnerHoverLeave();
            handleContextualFolderHoverLeave();
          }}
          onContextMenu={e => {
            e.preventDefault();
            handleOptionsClick(e, ws);
          }}
          className={`flex items-center gap-1 px-0.2 py-0.3 rounded-lg border group relative ${isActive
            ? 'border-[var(--color-borderDefault)] bg-transparent'
            : `border-transparent ${!isDarkMode ? (isSheetUIOpen ? 'hover:bg-neutral-100' : 'hover:bg-[#eee8d5]') : 'dark:hover:bg-neutral-800'}`
            } transition-colors`}>
          {(() => {
            const commonClasses =
              'hidden group-hover:block transition-all duration-200 text-neutral-500 shrink-0 absolute left-[-9px] top-1/2 -translate-y-1/2 z-10';

            // 1. Personal Space Workspace (always private)
            if (isPersonalSpace) {
              return <MdLockOutline className={commonClasses} size={11} />;
            }

            // 2. Organization Workspaces
            if (ws.type === 'shareonly') {
              return <BsPeopleFill className={commonClasses} size={10} />;
            } else if (ws.type === 'public') {
              return <FiGlobe className={commonClasses} size={11} />;
            } else if (ws.type === 'private') {
              return <MdLockOutline className={commonClasses} size={11} />;
            }

            return null;
          })()}
          <button
            onClick={e => {
              if (e.button !== 0) return;
              e.stopPropagation();
              // Click toggles expansion (or opens sidebar if collapsed)
              if (effectiveCollapsed) {
                toggleSidebar();
              } else {
                if (isExpanded) {
                  // Collapsing
                  if (isActive) {
                    // If we are collapsing the currently active workspace, go home
                    handleGoHome();
                  }
                }
                handleToggleWorkspace(ws.workspace_id, isPersonalSpace);
              }
            }}
            onDoubleClick={e => {
              e.stopPropagation();
              // Double Click navigates to workspace
              handleWorkspaceClick(ws);
            }}
            className={`flex-1 flex items-center gap-0.5 text-left text-[12.5px] truncate ml-[-5px] ${isActive
              ? isDarkMode
                ? 'text-neutral-100'
                : isSheetUIOpen
                  ? 'text-slate-900'
                  : 'text-[#073642]'
              : isDarkMode
                ? 'text-neutral-300'
                : isSheetUIOpen
                  ? 'text-slate-700'
                  : 'text-[#073642]'
              }`}>
            <div
              className="w-6 h-6 flex items-center justify-center shrink-0 transition-all duration-300 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                if (effectiveCollapsed) {
                  toggleSidebar();
                } else if (isExpanded) {
                  // Allow manual collapse if already expanded
                  handleToggleWorkspace(ws.workspace_id, isPersonalSpace);
                } else {
                  // Expand on icon click if not expanded
                  handleToggleWorkspace(ws.workspace_id, isPersonalSpace);
                }
              }}
              style={{
                color: displayColor,
              }}>
              {displayIcon && displayIcon !== 'text' ? (
                displayIcon.startsWith('U+') ? (
                  // Dynamic Logic:
                  // 1. Is it a default folder emoji? (U+1F4C1 / U+1F4C2)
                  // 2. AND is it the default color? (#FFC107) -> Show Dynamic Emoji (Open/Closed)
                  // 3. IF Custom Color -> restore Static Outline Folder (FaRegFolder) for better color support
                  displayIcon === 'U+1F4C1' || displayIcon === 'U+1F4C2' ? (
                    !displayColor || displayColor === '#FFC107' ? (
                      <span className="text-[14px] leading-none">
                        {String.fromCodePoint(isExpanded ? 0x1f4c2 : 0x1f4c1)}
                      </span>
                    ) : (
                      // Custom Color -> Fallback to Static Outline
                      <FaRegFolder size={16} className="text-[14px]" />
                    )
                  ) : (
                    <span className="text-[14px] leading-none">
                      {String.fromCodePoint(parseInt(displayIcon.replace('U+', ''), 16))}
                    </span>
                  )
                ) : (
                  <span className="text-[14px] leading-none" dangerouslySetInnerHTML={{ __html: displayIcon }} />
                )
              ) : // No Icon set -> Check Color
                !displayColor || displayColor === '#FFC107' ? (
                  <span className="text-[14px] leading-none">{String.fromCodePoint(isExpanded ? 0x1f4c2 : 0x1f4c1)}</span>
                ) : (
                  <FaRegFolder size={16} className="text-[14px]" />
                )}
            </div>

            {!effectiveCollapsed && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className={displayName === 'Personal Space' ? '' : 'truncate '}>{displayName}</span>
                <span
                  className={`ml-1 text-[10px] ${isActive ? (isDarkMode ? 'text-neutral-300' : isSheetUIOpen ? 'text-slate-500' : 'text-[#586e75]') : isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  ({getTotalWorkspaceItems(ws)})
                </span>
                {/* Visibility Icon (Public/Shared) */}
                {(ws.type === 'public' || ws.type === 'shareonly') && (
                  <div
                    className="flex items-center justify-center w-5 h-5 text-neutral-400 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
                    style={{ marginLeft: '-6px' }}>
                    {/* {ws.type === 'public' ? <FiGlobe size={11} /> : <BsPeopleFill size={9} />} */}
                  </div>
                )}

                {/* Action buttons - Moved to Right */}
                {/* <button
                  onClick={e => handleWorkspaceStatsClick(e, ws)}
                  className="opacity-0 group-hover:opacity-100 dark:hover:bg-auto/10 ml-1.5 p-0.5 rounded transition-all duration-200"
                  style={{ color: '#8634EB' }}
                  title="Workspace stats / Open all">
                  <FaExternalLinkAlt size={9} />
                </button> */}
                <button
                  onClick={e => handleWorkspaceCreateClick(e, ws)}
                  className="opacity-0 group-hover:opacity-100 dark:hover:bg-auto/10 p-0.5 rounded transition-all duration-200 text-green-500"
                  title="Create item">
                  <FaPlus size={10} />
                </button>
                <div className="flex-1" />
              </div>
            )}
          </button>
        </div>
        {isExpanded && !effectiveCollapsed && (
          <div className="mt-1">
            {/* 1. Files (Snippets) - Show if expanded, regardless of Auto Mode */}
            {ws.workspace_snippets && ws.workspace_snippets.length > 0 && (
              <div className="mb-1 space-y-0.5 ml-">
                {ws.workspace_snippets.map(snippet => renderSnippetItem(snippet, ws, null, false))}
              </div>
            )}

            {/* 2. Sub-folders - Render Second with STANDARD margin */}
            {/* Show folders ONLY if not collapsed (effectively) */}
            {folders.length > 0 && (
              <div className="mb-1 pl-2 border-[var(--color-borderDefault)] space-y-0.5">
                {folders.map(folder => renderFolder(folder, ws, 0, isPersonalSpace))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render a section card (matching AltS)
  const renderSectionCard = (
    title: string,
    defaultAccess: 'public' | 'private' | 'shareonly',
    workspaces: EnrichedWorkspace[],
    trailingIcon: React.ReactNode,
    className: string = '',
    isPersonalSpace: boolean = false,
    leadingIcon: React.ReactNode = null,
    targetTeamId?: string,
    runCommand?: () => void,
    dataTypeGroups?: ReturnType<typeof groupSnippetsByCategory>,
  ) => {
    // Force collapsed based on availability of items in current view mode
    const hasItems = dataTypeGroups
      ? dataTypeGroups.links.length > 0 || dataTypeGroups.notes.length > 0 || dataTypeGroups.prompts.length > 0
      : workspaces.length > 0;

    const isCollapsed = collapsedSections[title] !== undefined ? collapsedSections[title] : !hasItems;

    return (
      <div className={`${hasItems ? 'p-1 px-0 space-y-2' : 'px-0 py-0'} ${!isCollapsed && hasItems ? className : ''}`}>
        {!effectiveCollapsed && (
          <div className={`flex items-center justify-between group/header px-0`}>
            <div
              className={`flex items-center gap-${isPersonalSpace ? '1px ' : '1px'} flex-1 ${isPersonalSpace ? 'pl-0 pr-1.5' : 'pl-0 pr-1.5 '} py-0.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5' : isSheetUIOpen ? 'hover:bg-neutral-100' : 'hover:bg-[#eee8d5]'
                } cursor-pointer min-w-0  ${isPersonalSpace
                  ? `ml-[-3px] text-[14.5px] ${isDarkMode ? 'text-neutral-200' : isSheetUIOpen ? 'text-slate-900' : 'text-[#073642]'} font-bold`
                  : `ml-[-1px] text-[13.5px] ${isDarkMode ? 'text-neutral-200' : isSheetUIOpen ? 'text-slate-700' : 'text-[#073642]'}`
                }`}
              onClick={() => toggleSectionCollapse(title)}>
              {/* Unified Left Chevron */}
              <span
                className={`text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ${isPersonalSpace ? '' : ''}`}
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                <FiChevronDown size={12} />
              </span>

              {/* Avatar/Icon logic */}
              {/* {isPersonalSpace ? (
                <div
                  className={`w-5 h-5 rounded-full ${getAvatarColor(title)} flex items-center justify-center font-bold text-[10px] text-white shadow-sm flex-shrink-0`}>
                  {getSingleInitial(title)}
                </div>
              ) : (
                <>{leadingIcon}</>
              )} */}

              <span className={isPersonalSpace ? '' : 'truncate text-[13.5px]'}>{title}</span>

              {/* + Button - next to section title */}
              <button
                type="button"
                className="p-0.8 text-green-500 rounded opacity-0 group-hover/header:opacity-100 transition-opacity flex-shrink-0 ml-[6px]"
                title="Create Folder"
                onClick={e => {
                  e.stopPropagation();
                  e.stopPropagation();
                  if (runCommand) {
                    runCommand();
                  } else {
                    openCreateWorkspacePopup(defaultAccess, isPersonalSpace, targetTeamId);
                  }
                }}>
                <FaPlus size={10} />
              </button>

              <span className="text-neutral-400 dark:text-neutral-500 ">{trailingIcon}</span>
            </div>
          </div>
        )}
        {!effectiveCollapsed && !isCollapsed && hasItems && (
          <div style={{ marginTop: '0px' }}>
            {sidebarSearchTerm.trim() !== '' ? (
              <div className="pl-1">{renderSimpleFlatList(getFlattenedSnippets(workspaces))}</div>
            ) : dataTypeGroups ? (
              renderDataTypeGroups(dataTypeGroups, title)
            ) : (
              workspaces.map((ws, idx) => renderWorkspace(ws, idx, isPersonalSpace))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDataTypeGroups = (dataTypeGroups: ReturnType<typeof groupSnippetsByCategory>, sectionPrefix: string) => {
    const categories = [
      { id: 'links', label: 'All Links', icon: <FaLink size={12} />, items: dataTypeGroups.links },
      { id: 'notes', label: 'All Notes', icon: <FaFileAlt size={12} />, items: dataTypeGroups.notes },
      { id: 'prompts', label: 'All Prompts', icon: <FaTerminal size={12} />, items: dataTypeGroups.prompts },
    ];

    return (
      <div className="space-y-1 mb-2">
        {categories.map(cat => {
          if (cat.items.length === 0) return null;
          const groupId = `${sectionPrefix}-${cat.id}`;
          const isExpanded = expandedDataGroups[groupId];

          return (
            <div key={cat.id} className="space-y-0.5">
              <div
                className={`flex items-center gap-1.5 px-1.5 py-1 cursor-pointer rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-[#eee8d5]'
                  }`}
                onClick={() => toggleDataGroup(groupId)}>
                <span
                  className="text-neutral-400 dark:text-neutral-500 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                  <FiChevronDown size={11} />
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 opacity-80">{cat.icon}</span>
                <span
                  className={`text-[11.5px] font-semibold ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'}`}>
                  {cat.label} ({cat.items.length})
                </span>
              </div>
              {isExpanded && (
                <div className="ml-2 space-y-0.5">
                  {cat.items.map((item, idx) =>
                    renderSnippetItem(item.snippet, item.workspace, item.folder, true, true),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      onMouseLeave={() => {
        // Hide sections when leaving sidebar
        setHoveredLeftIcon(null);
      }}
      className={`h-[92%] min-h-0 flex flex-row relative ${isDarkMode ? '!bg-black !bg-[#000000]' : 'bg-[#fdf6e3]'} ${effectiveCollapsed ? 'w-[110px] items-center' : 'w-[280px] min-[1600px]:w-[300px] min-[1800px]:w-[320px] min-[1600px]:zoom-1'} ${activeTutorial === 'sidebar' ? 'z-[9999] pointer-events-none' : ''}`}
      style={{ background: isDarkMode ? '#000000' : '#fdf6e3' }}>
      {/* Sidebar Top Header (Logo) - Removed, now handled globally in App.tsx */}

      {/* Left Options Rail - Vertically Centered */}
      {!effectiveCollapsed && isLoggedIn && !isCommandListView && !isTemplatesView && (
        <div className="flex flex-col items-center justify-center gap-2 w-10 flex-shrink-0 h-full">
          <div
            onMouseEnter={() => setHoveredLeftIcon('personal')}
            className="p-2 cursor-pointer text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            title="personal space">
            <div
              className={`w-5 h-5 rounded-full ${getAvatarColor('Personal Space')} flex items-center justify-center font-bold text-[10px] text-white shadow-sm`}>
              {getSingleInitial('Personal Space')}
            </div>
          </div>
          <div
            onMouseEnter={() => setHoveredLeftIcon('org')}
            className="p-2 cursor-pointer text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors border-b border-neutral-400/30 mb-0.5"
            title="organization">
            <div
              className={`w-5 h-5 rounded-full ${getAvatarColor(displayOrgTeam?.team_name || 'Organization')} flex items-center justify-center font-bold text-[10px] text-white shadow-sm`}>
              {getSingleInitial(displayOrgTeam?.team_name || 'Organization')}
            </div>
          </div>
        </div>
      )}

      {/* Main Sidebar Content Area - Shifted Right */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full pt-[12vh] pb-20">
        {isCommandListView && (
          <div
            className={clsx(
              "flex-1 mx-2 mb-2 overflow-y-auto custom-scrollbar overflow-hidden border rounded-xl",
              isDarkMode
                ? "bg-neutral-900/50 border-white/10 shadow-md"
                : "bg-white border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            )}>
            <div className="p-2 space-y-1">
              {['commands', 'settings', 'themes'].map(category => (
                <div key={category}>
                  <div
                    onClick={() => onCommandListCategoryChange?.(category)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                      commandListCategory === category
                        ? isDarkMode
                          ? "bg-neutral-700 text-neutral-100 font-medium"
                          : "bg-slate-100 text-slate-900 font-medium"
                        : isDarkMode
                          ? "text-neutral-400 hover:bg-neutral-800"
                          : "text-slate-600 hover:bg-slate-100"
                    )}>
                    <span className="text-lg">
                      {category === 'commands' && <FaTerminal size={14} />}
                      {category === 'settings' && <FaCog size={14} />}
                      {category === 'themes' && <FaPalette size={14} />}
                      {category === 'templates' && <FaLayerGroup size={14} />}
                    </span>
                    <span className="text-sm capitalize">{category}</span>
                  </div>

                  {category === 'commands' && commandListCategory === 'commands' && (
                    <div className="ml-9 mt-1 space-y-0.5 border-l border-neutral-200   dark:border-white/10 pl-2">
                      {[
                        { id: 'active', label: 'Active Hotkeys' },
                        { id: 'local', label: 'System Commands' },
                        { id: 'global', label: 'Search Commands' },
                        { id: 'browser', label: 'Browser' },
                        { id: 'links', label: 'Links' },
                        { id: 'notes', label: 'Notes' },
                        { id: 'prompts', label: 'Prompts' },
                      ].map(sub => (
                        <div
                          key={sub.id}
                          onClick={e => {
                            e.stopPropagation();
                            onCommandSectionChange?.(sub.id);
                          }}
                          className={clsx(
                            "text-xs px-2 py-1 rounded-md cursor-pointer transition-colors",
                            activeCommandSection === sub.id
                              ? isDarkMode
                                ? "text-purple-400 bg-purple-900/20 font-medium"
                                : "text-purple-600 bg-purple-50 font-medium"
                              : isDarkMode
                                ? "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          )}>
                          {sub.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isTemplatesView && (
          <TemplateSidebar
            templatesCategory={templatesCategory}
            onTemplatesCategoryChange={onTemplatesCategoryChange}
          />
        )}

        {!isCommandListView && !isTemplatesView && (
          <div className="flex-1 px-2 py-2 flex flex-col min-h-0 bg-transparent w-full">
            {!effectiveCollapsed ? (
              <>
                {isLoggedIn && (
                  <>
                    <SidebarSearchBar
                      ref={searchInputRef}
                      value={sidebarSearchTerm}
                      onChange={setSidebarSearchTerm}
                      isDarkMode={isDarkMode}
                      isSheetUIOpen={isSheetUIOpen}
                      activeTutorial={activeTutorial}
                      placeholder="Search folders..."
                      onFilterClick={handleToggleFilterPanel}
                      onFocus={() => {
                        setIsSearchFocused(true);
                        onSidebarSearchFocusChange?.(true);
                      }}
                      onBlur={() => {
                        setIsSearchFocused(false);
                        onSidebarSearchFocusChange?.(false);
                      }}
                      onBulkDeleteClick={handleToggleBulkDeleteMode}
                      isBulkDeleteMode={isBulkDeleteMode}
                      isAutoExpandMode={isAutoExpandMode}
                      onToggleAutoExpand={handleToggleAutoExpand}
                      onExportClick={handleExportExcel}
                      teams={teams}
                      selectedTeamId={selectedTeam?.team_id}
                      onOrgSwitch={team => {
                        dispatch(setSelectedTeam(team));
                        dispatch(expandAllWorkspaces({}));
                        setIsOrgFoldersCollapsed(false);
                      }}
                    />
                  </>
                )}

                {!isLoggedIn && FEATURE_FLAGS.ENABLE_SHARING ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fadeIn">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-2">
                      <FaRegFolderOpen size={24} className="animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">
                        Unlock your folders
                      </h3>
                      <p className="text-xs text-[var(--color-textSecondary)] leading-relaxed">
                        Login to access your folders, notes, and links across all your devices.
                      </p>
                    </div>
                    <button
                      onClick={() => (window.location.href = CMDOS_SIGN_UP_URL)}
                      className="mt-2 px-5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-full hover:opacity-90 transition-all shadow-md shadow-neutral-900/10 active:scale-95">
                      Login to cmdOS
                    </button>
                  </div>
                ) : isWorkspacesLoading &&
                  workspacesFromRedux.length === 0 &&
                  (!selectedTeam?.workspaces || selectedTeam.workspaces.length === 0) ? (
                  <WorkspaceSkeleton isCollapsed={effectiveCollapsed} />
                ) : (debouncedSidebarSearchTerm.trim() ||
                  filterState.assignees.length > 0 ||
                  filterState.contentType !== 'all') &&
                  filteredWorkspaces.length === 0 &&
                  personalSpaceWorkspaces.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <FaSearch className="mx-auto text-[var(--color-iconDefault)] mb-3" size={24} />
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">No results found</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {filterState.assignees.length > 0 || filterState.contentType !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Try searching for different keywords'}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`flex-1 overflow-hidden group/sidebar-scroll rounded-xl ${!effectiveCollapsed && sidebarSearchTerm.trim() !== ''
                      ? isDarkMode
                        ? 'bg-[#000000] border border-neutral-700'
                        : 'bg-[#fdf6e3] border border-black/20 shadow-md'
                      : ''
                      }`}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar [direction:rtl]">
                      <div className="[direction:ltr] overflow-hidden">
                        {!effectiveCollapsed && sidebarSearchTerm.trim() !== '' && (
                          <div
                            className={`space-y-0 ${!effectiveCollapsed ? 'rounded-xl mb-1.5' : ''} whitespace-nowrap overflow-hidden transition-opacity duration-200`}>
                            <div>
                              {renderSectionCard(
                                'Personal Space',
                                'private',
                                sidebarSearchTerm.trim() !== '' ? personalSpaceWorkspaces : [],
                                null,
                                '',
                                true,
                                <div className="flex items-center justify-center w-5 h-5 text-neutral-500 dark:text-neutral-400">
                                  <MdPublic size={15} />
                                </div>,
                                defaultPrivateTeam?.team_id,
                                undefined,
                                undefined,
                              )}
                            </div>
                          </div>
                        )}
                        {!effectiveCollapsed && sidebarSearchTerm.trim() !== '' && (
                          <div className="h-[0.5px] w-[99%] bg-[var(--color-containerBg)] mb-[1px]"></div>
                        )}
 
                        {!effectiveCollapsed && sidebarSearchTerm.trim() !== '' && (
                          <div
                            className={`${!effectiveCollapsed ? 'rounded-xl' : ''} mx-0 my-0 whitespace-nowrap overflow-hidden transition-opacity duration-200`}>
                            {selectedTeam &&
                              !effectiveCollapsed &&
                              teams.length > 0 &&
                              (() => {
                                const filteredTeams = teams.filter(team => team.is_personal_space !== true);
 
                                if (filteredTeams.length === 0) {
                                  return (
                                    <div className="flex items-center justify-center w-full">
                                      <button
                                        onClick={e => {
                                          e.preventDefault();
                                          onCreateOrganization?.();
                                        }}
                                        className="flex items-center justify-center gap-2  py-2 w-full rounded-md text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all opacity-0 group-hover/sidebar-scroll:opacity-100 duration-200">
                                        <LuPlus size={12} />
                                        <span>Create an Organization</span>
                                      </button>
                                    </div>
                                  );
                                }
 
                                return (
                                  <>
                                    {!effectiveCollapsed && (
                                      <div className="px-1 pt-1 pb-0.5">
                                        <p
                                          className={`text-[9px] font-bold tracking-wider ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-400'}`}>
                                          Workspace
                                        </p>
                                      </div>
                                    )}
                                    <div className="px-0 py-0.8">
                                      <div className="flex items-center group/org-header">
                                        <div
                                          onMouseEnter={() => handleOwnerHoverEntry('org')}
                                          onMouseLeave={handleOwnerHoverLeave}
                                          className={`flex items-center gap-[1px] flex-1 pl-0 pr-1.5 py-1 ml-[-3px] rounded-lg transition-colors ${!isDarkMode ? 'hover:bg-[#eee8d5]' : 'hover:bg-white/50 dark:hover:bg-white/5'} cursor-pointer min-w-0`}
                                          onClick={() => {
                                            setIsOrgFoldersCollapsed(!isOrgFoldersCollapsed);
                                          }}>
                                          <span
                                            className="text-[var(--color-iconDefault)] transition-transform duration-200 mr-0"
                                            style={{
                                              transform: isOrgFoldersCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                            }}
                                            onClick={e => {
                                              e.stopPropagation();
                                              setIsOrgFoldersCollapsed(!isOrgFoldersCollapsed);
                                            }}>
                                            <FiChevronDown size={12} />
                                          </span>
                                          <div
                                            className={`w-5 h-5 rounded-full ${displayOrgTeam ? getAvatarColor(displayOrgTeam.team_name) : 'bg-neutral-400'} flex items-center justify-center font-bold text-[10px] text-white shadow-sm flex-shrink-0`}>
                                            {displayOrgTeam ? getSingleInitial(displayOrgTeam.team_name) : 'N'}
                                          </div>
                                          <span className=" text-[15px] font-bold text-neutral-800 dark:text-neutral-200">
                                            {displayOrgTeam ? displayOrgTeam.team_name : 'None'}
                                          </span>
                                          <div className="flex items-center gap-0.5 transition-opacity">
                                            {displayOrgTeam && (
                                              <button
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  if (displayOrgTeam && onOrganizationSettings) {
                                                    dispatch(clearEditorStates());
                                                    dispatch(setIsCreatingNewItem(false));
                                                    dispatch(setSelectedSnippet(null));
                                                    setIsTeamSwitcherOpen(false);
                                                    setSwitcherPosition(null);
                                                    onOrganizationSettings(
                                                      displayOrgTeam.team_id,
                                                      displayOrgTeam.team_name,
                                                    );
                                                  }
                                                }}
                                                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors text-[var(--color-iconDefault)] flex-shrink-0"
                                                title="Organization Settings">
                                                <FiSettings size={14} />
                                              </button>
                                            )}
                                            <div className="relative">
                                              <button
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  const rect = e.currentTarget.getBoundingClientRect();
                                                  if (isTeamSwitcherOpen) {
                                                    setIsTeamSwitcherOpen(false);
                                                    setSwitcherPosition(null);
                                                  } else {
                                                    setIsTeamSwitcherOpen(true);
                                                    setSwitcherPosition({ top: rect.bottom + 4, left: rect.left });
                                                  }
                                                }}
                                                className={`p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors text-[var(--color-iconDefault)] flex-shrink-0 ${isTeamSwitcherOpen ? 'bg-black/5 dark:bg-white/10 text-neutral-800 dark:text-neutral-200' : ''}`}
                                                title="Switch Organization">
                                                <LuArrowRightLeft size={14} />
                                              </button>
                                              {isTeamSwitcherOpen &&
                                                switcherPosition &&
                                                createPortal(
                                                  <div
                                                    className={`fixed z-[10000] mt-1 w-48 ${!isDarkMode ? 'bg-white' : 'bg-frostedwhite dark:bg-frostedwhite'} backdrop-blur-sm shadow-2xl rounded-lg border border-[var(--color-borderDefault)] overflow-hidden text-neutral-800 dark:text-neutral-200`}
                                                    style={{ top: switcherPosition.top, left: switcherPosition.left }}
                                                    onClick={e => e.stopPropagation()}>
                                                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                      <div className="px-2 py-1 text-[10px] font-bold text-neutral-400  tracking-wider">
                                                        Switch to
                                                      </div>
                                                      {displayOrgTeam && (
                                                        <button
                                                          onClick={() => {
                                                            const personalId = teams.find(
                                                              t => t.is_personal_space,
                                                            )?.team_id;
                                                            dispatch(
                                                              setSelectedTeam({
                                                                ...NONE_TEAM,
                                                                team_id: personalId || NONE_TEAM.team_id,
                                                              }),
                                                            );
                                                            dispatch(expandAllWorkspaces({}));
                                                            setIsOrgFoldersCollapsed(false);
                                                            setIsTeamSwitcherOpen(false);
                                                            setSwitcherPosition(null);
                                                          }}
                                                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${!isDarkMode ? 'hover:bg-[#eee8d5]' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'}`}>
                                                          <div className="w-4 h-4 rounded-full bg-neutral-400 flex items-center justify-center text-[8px] text-white font-bold">
                                                            N
                                                          </div>
                                                          <span className="text-xs text-neutral-700 dark:text-neutral-200 truncate flex-1">
                                                            None
                                                          </span>
                                                        </button>
                                                      )}
 
                                                      {teams
                                                        .filter(
                                                          t =>
                                                            !t.is_personal_space &&
                                                            t.team_id !== displayOrgTeam?.team_id,
                                                        )
                                                        .map(team => (
                                                          <button
                                                            key={team.team_id}
                                                            onClick={() => {
                                                              dispatch(setSelectedTeam(team));
                                                              dispatch(expandAllWorkspaces({}));
                                                              setIsOrgFoldersCollapsed(false);
                                                              setIsTeamSwitcherOpen(false);
                                                              setSwitcherPosition(null);
                                                            }}
                                                            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${isDarkMode
                                                              ? 'hover:bg-neutral-700 text-neutral-200'
                                                              : 'hover:bg-[#eee8d5] text-[#073642]'
                                                              }`}>
                                                            <div
                                                              className={`w-4 h-4 rounded-full ${getAvatarColor(team.team_name)} flex items-center justify-center text-[8px] text-white font-bold`}>
                                                              {getSingleInitial(team.team_name)}
                                                            </div>
                                                            <span className="text-xs text-neutral-700 dark:text-neutral-200 truncate flex-1">
                                                              {team.team_name}
                                                            </span>
                                                          </button>
                                                        ))}
                                                      {teams.filter(
                                                        t =>
                                                          !t.is_personal_space && t.team_id !== displayOrgTeam?.team_id,
                                                      ).length === 0 && (
                                                          <div className="px-2 py-2 text-xs text-neutral-400 text-center italic">
                                                            No other organizations
                                                          </div>
                                                        )}
                                                    </div>
                                                  </div>,
                                                  document.body,
                                                )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
 
                            {teams.filter(team => !team.is_personal_space).length > 0 && (
                              <>
                                {!isOrgFoldersCollapsed && displayOrgTeam && (
                                  <div className="overflow-hidden">
                                    <div className="">
                                      {false && renderDataTypeGroups(orgFlattened, 'Organization')}
                                    </div>
 
                                    {sidebarSearchTerm.trim() !== '' && !effectiveCollapsed && (
                                      <div className="space-y-1 ml-2">
                                        {renderSectionCard(
                                          'Private Folders',
                                          'private',
                                          orgPrivateWorkspaces,
                                          null,
                                          'min-h-[66px]',
                                          false,
                                          <MdLockOutline
                                            size={14}
                                            className="text-[var(--color-iconDefault)]"
                                          />,
                                          orgTeamId,
                                          () => {
                                            dispatch(clearEditorStates());
                                            dispatch(closeLinkEditModal());
                                            dispatch(setIsCreatingNewItem(false));
                                            dispatch(setSelectedSnippet(null));
                                            dispatch(
                                              navigateToView({
                                                kind: 'sharedFolderCreation',
                                                defaultPrivacy: 'private',
                                              }),
                                            );
                                          },
                                          undefined,
                                        )}
 
                                        {renderSectionCard(
                                          'Shared Folders',
                                          'shareonly',
                                          orgSharedOnlyWorkspaces,
                                          null,
                                          '',
                                          false,
                                          <BsPeopleFill size={14} className="text-[var(--color-iconDefault)]" />,
                                          orgTeamId,
                                          () => {
                                            dispatch(clearEditorStates());
                                            dispatch(closeLinkEditModal());
                                            dispatch(setIsCreatingNewItem(false));
                                            dispatch(setSelectedSnippet(null));
                                            dispatch(
                                              navigateToView({
                                                kind: 'sharedFolderCreation',
                                                defaultPrivacy: 'shared',
                                              }),
                                            );
                                          },
                                          undefined,
                                        )}
 
                                        {renderSectionCard(
                                          'Public Folders',
                                          'public',
                                          orgPublicWorkspaces,
                                          null,
                                          '',
                                          false,
                                          <TbWorld size={14} className="text-[var(--color-iconDefault)]" />,
                                          orgTeamId,
                                          () => {
                                            dispatch(clearEditorStates());
                                            dispatch(closeLinkEditModal());
                                            dispatch(setIsCreatingNewItem(false));
                                            dispatch(setSelectedSnippet(null));
                                            dispatch(
                                              navigateToView({
                                                kind: 'sharedFolderCreation',
                                                defaultPrivacy: 'public',
                                              }),
                                            );
                                          },
                                          undefined,
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
 
        {!isLoggedIn && !effectiveCollapsed && FEATURE_FLAGS.ENABLE_SHARING && (
          <div className="px-2 pb-2 mt-auto">
            <button
              onClick={() => {
                window.location.href = CMDOS_SIGN_IN_URL;
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all border border-transparent hover:border-neutral-200 dark:hover:border-white/10"
              title="Watch tutorial & sign in">
              <FaPlay size={10} />
              <span>Tutorial</span>
            </button>
          </div>
        )}
      </div>
 
      {/* Bulk Delete Selection Bar - Moved outside scrollable area */}
      <AnimatePresence>
        {isBulkDeleteMode && (
          <DeleteSelectedBar
            selectedForDelete={selectedForDelete}
            selectionSummary={selectionSummary}
            isDeleting={isDeleting}
            onDelete={handleBulkDelete}
            onCancel={() => {
              setSelectedForDelete(new Map());
              setIsBulkDeleteMode(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* No more popups for collection creation - handled by SharedFolderCreationView */}

      {/* Options Popup */}
      {optionsPopup && optionsPopup.workspace && (
        <WorkspaceOptionsPopup
          isOpen={optionsPopup.isOpen}
          position={optionsPopup.position}
          onClose={() => setOptionsPopup({ ...optionsPopup, isOpen: false })}
          workspace={optionsPopup.workspace!}
          onOpenEdit={ws => {
            setEditModal({ isOpen: true, workspace: ws });
          }}
          onOpenDelete={ws => {
            setDeleteModal({ isOpen: true, workspace: ws });
          }}
          onOpenShare={ws => {
            if (!selectedTeam?.team_id) {
              triggerToast('Select an organization to share this workspace.', 'warning');
              return;
            }
            const workspace = optionsPopup.workspace!;
            // Cast to EnrichedWorkspace to get the type if needed, or find it in enrichedWorkspaces
            const fullWorkspace =
              enrichedWorkspaces.find(item => item.workspace_id === workspace.workspace_id) ||
              ({ ...workspace, type: (workspace as any).type || 'private' } as EnrichedWorkspace);

            onWorkspaceShare?.(
              fullWorkspace.workspace_id,
              fullWorkspace.workspace_name,
              selectedTeam.team_id,
              fullWorkspace.type,
            );
          }}
          onOpenCreateSubFolder={ws => {
            setCollectionCreationWorkspace(ws);
            setShowCreateCollectionPopup(true);
          }}
          onOpenCustomize={workspace => setCustomizeWorkspaceModal({ isOpen: true, workspace })}
          zIndex={9999}
        />
      )}

      {/* Top-level Modals */}
      <DeleteConfirmation
        key="delete-dialog"
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, workspace: null })}
        zIndex={10001}
        onConfirm={async () => {
          const ws = deleteModal.workspace;
          if (!ws) return;
          try {
            await deleteSWorkspace(ws.workspace_id, selectedTeam?.storageMode ?? 'cloud');
            reload();
            dispatch(setCommandStatus({ status: 'success', message: 'Channel deleted successfully' }));
            setTimeout(() => {
              dispatch(setCommandStatus({ status: 'idle', message: '' }));
            }, 3000);
            setDeleteModal({ isOpen: false, workspace: null });
          } catch (error: any) {
            const serverErrorMessage = error.response?.data?.error || error?.message || 'Failed to delete workspace';
            dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
            setTimeout(() => {
              dispatch(setCommandStatus({ status: 'idle', message: '' }));
            }, 3000);
            throw error; // Re-throw so DeleteDialog knows the operation failed
          }
        }}
        title="Confirm Delete"
        description={`Are you sure do you want to delete ${deleteModal.workspace?.workspace_name || ''} channel? This action cannot be undone.`}
      />

      <EditWorkspaceNamePopup
        key="edit-workspace-name"
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, workspace: null })}
        reload={reload}
        workspaceId={editModal.workspace?.workspace_id || ''}
        workspaceName={editModal.workspace?.workspace_name || ''}
        storageMode={selectedTeam?.storageMode ?? 'cloud'}
      />

      {/* Folder Management Modals */}
      {deleteFolderModal.isOpen && deleteFolderModal.folder && deleteFolderModal.workspace && (
        <DeleteConfirmation
          isOpen={deleteFolderModal.isOpen}
          onClose={() => setDeleteFolderModal({ isOpen: false, folder: null, workspace: null })}
          onConfirm={async () => {
            const folder = deleteFolderModal.folder!;
            const workspace = deleteFolderModal.workspace!;
            const orgId = selectedTeam?.team_id || '';

            try {
              dispatch(setCommandStatus({ status: 'loading', message: `Deleting folder "${folder.folder_name}"...` }));
              // Need to import deleteSharedFolder in SideBar or move it to a service that is imported
              // Assuming deleteSharedFolder is available or imported.
              // Wait, deleteSharedFolder was imported from '../../../../Apis/features/folderApiServices' in FolderOptionsPopup.
              // I need to add that import to SideBar.
              await deleteSharedFolder(folder.folder_id, orgId, workspace.workspace_id, selectedTeam?.storageMode ?? 'cloud');
              reload();
              if (orgId) {
                dispatch(fetchWorkspacesThunk(orgId));
              }
              dispatch(setCommandStatus({ status: 'success', message: 'Folder deleted successfully' }));
              setTimeout(() => {
                dispatch(setCommandStatus({ status: 'idle', message: '' }));
              }, 3000);
              setDeleteFolderModal({ isOpen: false, folder: null, workspace: null });
            } catch (error: any) {
              const serverErrorMessage = error.response?.data?.error || error?.message || 'Failed to delete folder';
              dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
              setTimeout(() => {
                dispatch(setCommandStatus({ status: 'idle', message: '' }));
              }, 3000);
              throw error; // Re-throw so DeleteDialog knows the operation failed
            }
          }}
          title={`Delete ${deleteFolderModal.folder!.folder_name}?`}
          description="Are you sure you want to delete this folder? This action cannot be undone."
          zIndex={10001}
        />
      )}

      {editFolderModal.isOpen && editFolderModal.folder && editFolderModal.workspace && (
        <EditFolderNamePopup
          isOpen={editFolderModal.isOpen}
          onClose={() => setEditFolderModal({ isOpen: false, folder: null, workspace: null })}
          reload={reload}
          folderName={editFolderModal.folder!.folder_name}
          folderId={editFolderModal.folder!.folder_id}
          orgId={selectedTeam?.team_id || ''}
          workspaceId={editFolderModal.workspace!.workspace_id}
        />
      )}

      {folderStatsMenu.isOpen && folderStatsMenu.folder && (
        <FolderStatsPopup
          isOpen={folderStatsMenu.isOpen}
          position={folderStatsMenu.position}
          onClose={() => setFolderStatsMenu({ ...folderStatsMenu, isOpen: false })}
          folder={folderStatsMenu.folder}
          onOpenAllLinks={handleOpenAllLinks}
          onOpenAllSnippets={handleOpenAllSnippets}
          onOpenEverything={handleOpenEverything}
          onExportToExcel={handleExportExcel}
        />
      )}

      {workspaceStatsMenu.isOpen && workspaceStatsMenu.workspace && (
        <FolderStatsPopup
          isOpen={workspaceStatsMenu.isOpen}
          position={workspaceStatsMenu.position}
          onClose={() => setWorkspaceStatsMenu({ ...workspaceStatsMenu, isOpen: false })}
          workspace={workspaceStatsMenu.workspace}
          onOpenAllLinks={handleOpenAllLinks}
          onOpenAllSnippets={handleOpenAllSnippets}
          onOpenEverything={handleOpenEverything}
          onExportToExcel={handleExportExcel}
        />
      )}

      {/* Folder Options Popup */}
      {folderOptionsPopup && folderOptionsPopup.folder && folderOptionsPopup.workspace && (
        <FolderOptionsPopup
          isOpen={folderOptionsPopup.isOpen}
          position={folderOptionsPopup.position}
          onClose={() => setFolderOptionsPopup({ ...folderOptionsPopup, isOpen: false })}
          folder={folderOptionsPopup.folder!}
          orgId={selectedTeam?.team_id || ''}
          workspaceId={folderOptionsPopup.workspace!.workspace_id}
          reload={reload}
          onOpenShare={folder => {
            // Placeholder/Todo

          }}
          onOpenCustomize={folder =>
            setCustomizeFolderModal({ isOpen: true, folder, workspace: folderOptionsPopup.workspace! })
          }
        />
      )}

      {/* Folder/Workspace Create Menu Popup */}
      {folderCreateMenu.isOpen && folderCreateMenu.workspace && (
        <FolderCreateMenuPopup
          isOpen={folderCreateMenu.isOpen}
          triggerRect={folderCreateMenu.triggerRect}
          onClose={() => setFolderCreateMenu({ ...folderCreateMenu, isOpen: false })}
          folder={folderCreateMenu.folder}
          workspace={folderCreateMenu.workspace}
          onCreateNote={() => handleCreateNote(folderCreateMenu.folder!, folderCreateMenu.workspace!)}
          onCreateLink={() => handleCreateLink(folderCreateMenu.folder, folderCreateMenu.workspace!)}
          onCreatePrompt={() => handleCreatePrompt(folderCreateMenu.folder, folderCreateMenu.workspace!)}
          onCreateFolder={() => handleCreateFolder(folderCreateMenu.folder, folderCreateMenu.workspace!)}
          // Management handlers
          onEdit={() => {
            if (folderCreateMenu.folder) {
              setEditFolderModal({
                isOpen: true,
                folder: folderCreateMenu.folder,
                workspace: folderCreateMenu.workspace,
              });
            } else {
              setEditModal({ isOpen: true, workspace: folderCreateMenu.workspace });
            }
            setFolderCreateMenu({ ...folderCreateMenu, isOpen: false });
          }}
          onShare={() => {
            if (folderCreateMenu.folder) {
              // Folder share logic

            } else {
              // Workspace share logic
              if (!selectedTeam?.team_id) {
                triggerToast('Select an organization to share this workspace.', 'warning');
                return;
              }
              const ws = folderCreateMenu.workspace!;
              const fullWorkspace =
                enrichedWorkspaces.find(item => item.workspace_id === ws.workspace_id) ||
                ({ ...ws, type: (ws as any).type || 'private' } as EnrichedWorkspace);
              onWorkspaceShare?.(
                fullWorkspace.workspace_id,
                fullWorkspace.workspace_name,
                selectedTeam.team_id,
                fullWorkspace.type,
              );
            }
            setFolderCreateMenu({ ...folderCreateMenu, isOpen: false });
          }}
          onDelete={() => {
            if (folderCreateMenu.folder) {
              setDeleteFolderModal({
                isOpen: true,
                folder: folderCreateMenu.folder,
                workspace: folderCreateMenu.workspace,
              });
            } else {
              setDeleteModal({ isOpen: true, workspace: folderCreateMenu.workspace });
            }
            setFolderCreateMenu({ ...folderCreateMenu, isOpen: false });
          }}
          onCustomize={() => {
            if (folderCreateMenu.folder) {
              setCustomizeFolderModal({
                isOpen: true,
                folder: folderCreateMenu.folder,
                workspace: folderCreateMenu.workspace,
              });
            } else {
              setCustomizeWorkspaceModal({ isOpen: true, workspace: folderCreateMenu.workspace });
            }
            setFolderCreateMenu({ ...folderCreateMenu, isOpen: false });
          }}
          onOpenAllLinks={handleOpenAllLinks}
          onOpenAllSnippets={handleOpenAllSnippets}
          onOpenEverything={handleOpenEverything}
          onExportToExcel={handleExportExcel}
        />
      )}

      {/* Snippet Options Popup */}
      {snippetOptionsPopup && snippetOptionsPopup.snippet && (
        <SnippetOptionsPopup
          isOpen={snippetOptionsPopup.isOpen}
          position={snippetOptionsPopup.position}
          onClose={() =>
            setSnippetOptionsPopup({
              isOpen: false,
              position: { top: 0, left: 0 },
              snippet: null,
              workspace: null,
              folder: null,
            })
          }
          snippet={snippetOptionsPopup.snippet!}
          workspace={snippetOptionsPopup.workspace}
          folder={snippetOptionsPopup.folder}
          reload={reload}
          onOpenCustomize={snippet => setCustomizeSnippetModal({ isOpen: true, snippet })}
          onEdit={snippet => {
            if (snippetOptionsPopup.workspace) {
              handleSnippetClick(snippet, snippetOptionsPopup.workspace, snippetOptionsPopup.folder);
            }
          }}
        />
      )}

      {/* Customize Modals */}
      {customizeWorkspaceModal.isOpen && customizeWorkspaceModal.workspace && (
        <CustomizeWorkspacePopup
          isOpen={customizeWorkspaceModal.isOpen}
          onClose={() => setCustomizeWorkspaceModal({ isOpen: false, workspace: null })}
          reload={reload}
          workspace={customizeWorkspaceModal.workspace!}
        />
      )}

      {customizeFolderModal.isOpen && customizeFolderModal.folder && customizeFolderModal.workspace && (
        <CustomizeFolderPopup
          isOpen={customizeFolderModal.isOpen}
          onClose={() => setCustomizeFolderModal({ isOpen: false, folder: null, workspace: null })}
          reload={reload}
          folder={customizeFolderModal.folder!}
          orgId={selectedTeam?.team_id || ''}
          workspaceId={customizeFolderModal.workspace!.workspace_id}
          storageMode={selectedTeam?.storageMode ?? 'cloud'}
        />
      )}

      {customizeSnippetModal.isOpen && customizeSnippetModal.snippet && (
        <CustomizeSnippetPopup
          isOpen={customizeSnippetModal.isOpen}
          onClose={() => setCustomizeSnippetModal({ isOpen: false, snippet: null })}
          reload={reload}
          snippet={customizeSnippetModal.snippet!}
        />
      )}

      {/* Sub-Folder Creation Popup */}
      {showCreateCollectionPopup && collectionCreationWorkspace && (
        <CreateCollectionPopup
          isOpen={showCreateCollectionPopup}
          onClose={() => {
            setShowCreateCollectionPopup(false);
            setCollectionCreationWorkspace(null);
          }}
          reload={reload}
          selectedWorkspace={collectionCreationWorkspace!}
        />
      )}

      {/* Bottom Controls Area - Absolute Bottom of Component */}
      {/* <div
        className={`absolute bottom-14 z-50 transition-all duration-300 flex flex-col gap-3 left-0 right-0 ${effectiveCollapsed ? 'items-start pl-2' : 'items-start px-3'
          }`}>

      </div> */}
    </div>
  );
};

export default SideBar;
