import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsPinAngle, BsPinAngleFill, BsQuestionCircle, BsCalendarCheck } from 'react-icons/bs';
import { FaCalendarWeek, FaTimes, FaPlus, FaFilter } from 'react-icons/fa';
import { FiX, FiHelpCircle, FiLayout, FiGrid, FiList, FiSettings } from 'react-icons/fi';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import UnpinConfirmationDialog from './Modals/UnpinConfirmationDialog';

import Container from './Container';
import { FEATURE_FLAGS } from '../utils/featureFlags';
import { CMDOS_DOCS_URL } from '../../../Apis/core/apiConfig';
import LoginButton from './Layout/LoginButton';
import RightTodoWorkspace from './Views/todo/RightTodoWorkspace';
import SideBar from './Layout/SideBar';
import Branding from './Layout/Branding';
import HeaderControls from './Layout/HeaderControls';
import FavoritesPanel from './Layout/FavoritesPanel';
import SidebarSearchBar from './Layout/Sidebar/SidebarSearchBar';
import { TutorialCard, TutorialDashboard } from './Tutorial';
import AutomationStatusIndicator from './Shared/Automation/AutomationStatusIndicator';
import { useGridStore } from './SheetUI/gridStore';

import FilterPanel, { type FilterState } from './Layout/Sidebar/FilterPanel';
import { type SearchbarHandle, type SuggestionState } from './SearchComponents/Searchbar/Searchbar';
import type { Workspace, Team, SavedAutomation } from '../../../modals/interfaces';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllDataThunk, selectAllData, setData } from '../../../Redux/AllData/allDataSlice';
import HotkeysHelpPopup from './Modals/HotkeysHelpPopup';
import TodoFloatingPreview from './Views/todo/TodoFloatingPreview';
import CreateWorkspacePopup from './Modals/CreateWorkspacePopup';
import type { AppDispatch } from '../../../Redux/store';
import { useTeamsData } from '../query/hooks/useTeamsData';
import {
  clearEditorStates,
  setSelectedTeam,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectSelectedSnippet,
  selectSnippetBreadCrum,
  selectIsCreatingNewItem,
  setIsCreatingNewItem,
  setNewTabOverrideEnabled,
  selectDarkMode,
  setDarkMode,
  selectShowFavorites,
  setShowFavorites,
  selectIsFocusMode,
  toggleFocusMode,
  setOS,
  selectIsMac,
  viewSnippet,
  expandAllWorkspaces,
  expandAllFolders,
  selectExpandedWorkspaces,
  selectExpandedFolders,
  selectIsAutoExpandMode,
  setIsAutoExpandMode,
  selectCollapsedWorkspaces,
  setCollapsedWorkspaces,
  selectCollapsedFolders,
  setCollapsedFolders,
  selectCollapsedSections,
  setCollapsedSections,
  toggleCollapsedSection,
  selectIsSidebarCollapsed,
  setIsSidebarCollapsed,
  selectIsLinkEditModalOpen,
  selectLinkEditPrefill,
  openLinkEditModal,
  closeLinkEditModal,
  selectIsCommandListView,
  setIsCommandListView,
  NONE_TEAM,
  selectMainView,
  navigateToView,
  setActiveTutorial,
  selectActiveTutorial,
  selectPendingLockedCommand,
  setPendingLockedCommand,
  selectPendingAutomation,
  setPendingAutomation,
  selectPendingAgent,
  setPendingAgent,
  setTodoCreatePrefill,
  selectTodoCreatePrefill,
  setShowTodosView,
  selectShowTodosView,
  selectIsTodoCreateMode,
  setTodoCreateMode,
  setIsCreateMenuOpen,
  selectIsCreateMenuOpen,
  selectIsEditorDirty,
  setShowEditorSwitchWarning,
  setPendingNavigationAction,
  selectIsFullScreenModalOpen,
} from '../../../Redux/AllData/uiStateSlice';
import { detectOS } from '../utils/osUtils';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import {
  getTutorialProgress,
  setTutorialStepFinished,
  migrateTutorialProgress,
  resetTutorialProgress,
} from '@src/components/Tutorial';
import ToastContainer from './Shared/Toast/ToastContainer';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TeamSelectionContainer from './Layout/TeamSelectionContainer';
import { GlobalCreateMenuModal } from './Shared/GlobalCreateMenuModal';
import { loadFrostedTheme, applyFrostedTheme } from './Shared/Theme/themeControls';
import useToast from './Shared/Toast/useToast';
import { getCommands } from '../../../Apis/features/featuredApi';
import WallpaperLayer from './Shared/Theme/WallpaperLayer';
import { useAppearance } from '@extension/ui';

import { useFavoritesSync } from './hooks/useFavoritesSync';
import { getUserId } from '../../../Apis/core/api'; // Ensure getUserId is imported
import { checkIfRefreshNeeded, saveCounters } from '@private-services/refreshCounterService';

// Check for URL trigger params synchronously at module-load time, before any React effects can clear them.
const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const initialHasUrlTrigger = initialParams
  ? initialParams.get('session_mode') === 'true' ||
  initialParams.get('create_link') === 'true' ||
  initialParams.get('create_note') === 'true' ||
  initialParams.get('create_snippet') === 'true' ||
  initialParams.get('create_automation') === 'true' ||
  initialParams.get('create_todo') === 'true' ||
  initialParams.get('create_prompt') === 'true'
  : false;

if (typeof window !== 'undefined') {
  (window as any).__hasUrlTrigger = initialHasUrlTrigger;
}

const App: React.FC = () => {
  const { theme, themeId } = useAppearance();

  const dispatch = useDispatch<AppDispatch>();

  const isKeystrokeRecordingActive = useCallback(() => {
    const active = document.activeElement;
    if (active && active.tagName === 'INPUT') {
      if (active.hasAttribute('readonly') && active.classList.contains('opacity-0')) {
        return true;
      }
    }
    return Boolean((window as any).__tasklabsKeystrokeRecordingActive);
  }, []);
  const triggerToast = useToast();
  const [isNewTabEnabled, setIsNewTabEnabled] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [showUnpinDialog, setShowUnpinDialog] = useState(false);
  const [isInitialAltSFocus, setIsInitialAltSFocus] = useState(false);
  const [showTutorialTrigger, setShowTutorialTrigger] = useState(0);
  const [showTutorialButton, setShowTutorialButton] = useState(false);
  const [isBoardViewEnabled, setIsBoardViewEnabled] = useState(true);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const [suggestionState, setSuggestionState] = useState<SuggestionState | null>(null);
  const [isBoardHovered, setIsBoardHovered] = useState(false);
  const [isListHovered, setIsListHovered] = useState(false);
  const [isSheetHovered, setIsSheetHovered] = useState(false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);

  const hasLoadedThemeRef = useRef(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState('local_user'); // Global userId for sync hooks to reserve sidebar space on mount
  const [isSheetUIOpen, setIsSheetUIOpen] = useState(false);
  const [activeLockedCommand, setActiveLockedCommand] = useState<string | null>(null);
  const [isAutomationActive, setIsAutomationActive] = useState(false);
  const allData = useSelector(selectAllData);
  const isLoggedIn = userId !== '';

  useEffect(() => {
    if (!isViewDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  useEffect(() => {
    
  }, [isLoggedIn, userId]);

  const mainView = useSelector(selectMainView) || { kind: 'home' };

  // Focus the searchbar reactively when entering search/columns layout
  useEffect(() => {
    

    if (mainView.kind === 'searchSuggestions') {
      let changed = false;
      if (!isInitialAltSFocus) {
        setIsInitialAltSFocus(true);
        changed = true;
      }
      if (changed) return;
    }

    if (!isSheetUIOpen && isInitialAltSFocus) {
      
      searchbarRef.current?.focus();
    }
  }, [isInitialAltSFocus, isBoardViewEnabled, isSheetUIOpen, mainView.kind]);
  const isCreateMenuOpen = useSelector(selectIsCreateMenuOpen);
  const isFullScreenModalOpen = useSelector(selectIsFullScreenModalOpen);
  const showTodosView = useSelector(selectShowTodosView);
  const todoCreatePrefill = useSelector(selectTodoCreatePrefill);
  const handleCloseTodosView = useCallback(() => {
    dispatch(setShowTodosView(false));
  }, [dispatch]);
  const [isGlobalCreateMenuOpen, setIsGlobalCreateMenuOpen] = useState(false);

  useEffect(() => {
    (window as any).isGlobalCreateMenuOpen = isGlobalCreateMenuOpen;
    return () => {
      (window as any).isGlobalCreateMenuOpen = false;
    };
  }, [isGlobalCreateMenuOpen]);

  const [tabId, setTabId] = useState<number | null>(null);
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs?.getCurrent) {
      chromeAny.tabs.getCurrent((tab: any) => {
        if (tab?.id) {
          setTabId(tab.id);
        }
      });
    }
  }, []);

  // Shared focus-tracking storage key
  const focusKey = tabId ? `new_tab_focus_${tabId}` : 'new_tab_has_page_focus';

  // Auto-close Sheet UI when navigating to specific views to prevent UI overlaps
  useEffect(() => {
    if (
      isSheetUIOpen &&
      (mainView.kind === 'todos' || mainView.kind === 'noteEditor' || mainView.kind === 'linkEditor')
    ) {
      setIsSheetUIOpen(false);
    }
  }, [mainView.kind, isSheetUIOpen]);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const isInitialFocusSheet = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('focus_sheet_ui_first_column') === 'true';
  }, []);

  // Tutorial button click handler
  const handleTutorialClick = useCallback(() => {
    
    (window as any).isReplayingTutorial = true;
    dispatch(setActiveTutorial('search'));
    window.dispatchEvent(new CustomEvent('SearchTutorialStarted'));
  }, [dispatch]);

  // Reset trigger after Container picks it up
  const handleTutorialTriggerConsumed = useCallback(() => {
    // Counter-based trigger doesn't need explicit reset to false
  }, []);

  // Tutorial button visibility: hidden once tutorial_watched is set
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    const checkVisibility = () => {
      chromeAny.storage.local.get(['tutorial_watched', 'myCachedAllData'], (result: any) => {
        // 1. Hide if not logged in
        if (!isLoggedIn) {
          setShowTutorialButton(false);
          return;
        }
        // 2. Hide if tutorial is already watched
        /*
        if (result.tutorial_watched) {
          setShowTutorialButton(false);
          return;
        }
        */
        // 3. Hide if "Your shortcuts" workspace already exists
        const allData = result.myCachedAllData;
        if (Array.isArray(allData)) {
          const hasShortcutsWs = allData.some(
            (team: any) =>
              Array.isArray(team.workspaces) &&
              team.workspaces.some((ws: any) => ws.workspace_name === 'Your shortcuts'),
          );
          if (hasShortcutsWs) {
            setShowTutorialButton(false);
            return;
          }
        }
        setShowTutorialButton(true);
      });
    };

    checkVisibility();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.tutorial_watched) {
        checkVisibility();
      }
    };
    chromeAny.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chromeAny.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      // Load initial state
      chromeAny.storage.local.get(['new_tab_override_enabled'], (result: any) => {
        setIsNewTabEnabled(result.new_tab_override_enabled !== false);
      });

      // Listen for storage changes to update dynamically
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.new_tab_override_enabled) {
          const newValue = changes.new_tab_override_enabled.newValue;
          setIsNewTabEnabled(newValue === true);
        }
      };

      chromeAny.storage.onChanged.addListener(handleStorageChange);

      // Check URL parameters for showing unpin dialog
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('show_unpin_dialog') === 'true') {
        setShowUnpinDialog(true);
        // Clean up URL parameter
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      return () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    }
    return;
  }, []);

  // Handle storage-based navigation (e.g., from AltS commands)
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    const checkPendingView = () => {
      chromeAny.storage.local.get(['pendingNewTabView'], (result: any) => {
        if (result.pendingNewTabView === 'agentPanel') {
          
          dispatch(navigateToView({ kind: 'agentPanel' }));
          // Clear it so it doesn't trigger again on refresh
          chromeAny.storage.local.remove('pendingNewTabView');
        }
      });
    };

    // Check on mount
    checkPendingView();

    // Listen for changes (if New Tab is already open)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.pendingNewTabView?.newValue === 'agentPanel') {
        checkPendingView();
      }
    };
    chromeAny.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chromeAny.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [dispatch]);

  // Detect OS
  useEffect(() => {
    detectOS().then(os => {
      dispatch(setOS(os));
    });
  }, [dispatch]);

  const handleToggleNewTab = useCallback(() => {
    // If currently pinned and trying to unpin, show confirmation dialog
    if (isNewTabEnabled) {
      setShowUnpinDialog(true);
    } else {
      // Pinning doesn't need confirmation
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ new_tab_override_enabled: true });
        setIsNewTabEnabled(true);
      }
    }
  }, [isNewTabEnabled]);

  const handleConfirmUnpin = useCallback(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_override_enabled: false });
      setIsNewTabEnabled(false);
    }
  }, []);

  const savedAgentById = useMemo(() => {
    const map = new Map<string, any>();

    const getStepsCount = (automation: any): number => {
      if (Array.isArray(automation?.steps)) return automation.steps.length;
      if (Array.isArray(automation?.automation_steps)) return automation.automation_steps.length;
      return 0;
    };

    const getInputsCount = (automation: any): number => {
      if (Array.isArray(automation?.inputs)) return automation.inputs.length;
      if (Array.isArray(automation?.automation_inputs)) return automation.automation_inputs.length;
      return 0;
    };

    const isSavedAgent = (automation: any): boolean => {
      const steps = automation?.automation_steps || automation?.steps || [];
      if (!Array.isArray(steps)) return false;

      return steps.some((s: any) => {
        const moduleId = String(
          s?.module_id || s?.moduleId || s?.module || s?.module_key || s?.type || '',
        ).toLowerCase();
        return moduleId === '5' || moduleId === 'agent' || s?.config?.agentId === 'all_ai' || s?.config?.isAllAi;
      });
    };

    const put = (automation: any, workspaceId?: string, folderId?: string) => {
      if (!automation || !isSavedAgent(automation)) return;

      const id = String(automation?.id || automation?.automation_id || '');
      if (!id) return;

      const candidate = {
        ...automation,
        id,
        workspace_id: automation?.workspace_id || workspaceId,
        folder_id: automation?.folder_id || folderId,
      };

      const existing = map.get(id);
      if (!existing) {
        map.set(id, candidate);
        return;
      }

      const existingScore = getStepsCount(existing) * 10 + getInputsCount(existing);
      const incomingScore = getStepsCount(candidate) * 10 + getInputsCount(candidate);
      if (incomingScore > existingScore) {
        map.set(id, candidate);
      }
    };

    const walkFolders = (folders: any[], workspaceId: string) => {
      (folders || []).forEach(folder => {
        (folder?.automations || []).forEach((automation: any) => {
          put(automation, workspaceId, folder?.folder_id);
        });

        if (Array.isArray(folder?.folders) && folder.folders.length > 0) {
          walkFolders(folder.folders, workspaceId);
        }
      });
    };

    (allData || []).forEach(team => {
      (team?.workspaces || []).forEach((workspace: any) => {
        (workspace?.workspace_automations || []).forEach((automation: any) => {
          put(automation, workspace?.workspace_id);
        });

        // 🚀 Add support for specialized agent arrays (Chat Agents, Agents)
        (workspace?.workspace_chat_agents || []).forEach((agent: any) => {
          put(agent, workspace?.workspace_id);
        });
        (workspace?.chat_agents || []).forEach((agent: any) => {
          put(agent, workspace?.workspace_id);
        });
        (workspace?.workspace_agents || []).forEach((agent: any) => {
          put(agent, workspace?.workspace_id);
        });

        walkFolders(workspace?.folders || [], workspace?.workspace_id);
      });
    });

    return map;
  }, [allData]);

  // --- Proactive Favorites Sync ---
  useFavoritesSync(userId, allData || []);

  const activeTutorial = useSelector((state: any) => state.uiState.activeTutorial);

  useEffect(() => {
    const onSearchStart = () => {
      setTimeout(() => dispatch(setActiveTutorial('search')), 600);
    };
    const onFavsStart = () => {
      if (!isLoggedIn) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('FavsToAgents'));
        }, 100);
      } else {
        setTimeout(() => dispatch(setActiveTutorial('favorites')), 600);
      }
    };
    const onAgentStart = () => {
      setTimeout(() => dispatch(setActiveTutorial('agent')), 600);
    };
    const onSheetUIStart = () => {
      dispatch(setActiveTutorial(null));
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local && !(window as any).isReplayingTutorial) {
        chromeAny.storage.local.set({ tutorial_watched: true });
      }
      setIsSheetUIOpen(true);
      dispatch(setIsSidebarCollapsed(false));
      window.dispatchEvent(new CustomEvent('TutorialFinished'));
    };
    const onTutorialEnd = () => {
      dispatch(setActiveTutorial(null));
      (window as any).isReplayingTutorial = false;
    };

    window.addEventListener('SearchToFavs', onFavsStart);
    window.addEventListener('FavsToSearch', onSearchStart);
    window.addEventListener('FavsToAgents', onAgentStart);
    window.addEventListener('AgentsToFavs', onFavsStart);
    window.addEventListener('AgentsToSheetUI', onSheetUIStart);
    window.addEventListener('SearchTutorialStarted', onSearchStart);
    window.addEventListener('AgentTutorialStarted', onAgentStart);
    window.addEventListener('TutorialFinished', onTutorialEnd);

    const handleSetViewMode = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      if (mode === 'board') {
        setIsSheetUIOpen(false);
        setIsBoardViewEnabled(true);
        searchbarRef.current?.clear();
        setIsInitialAltSFocus(true);
        chrome.storage.local.set({ new_tab_is_board_view_enabled: true });
      } else if (mode === 'list') {
        setIsSheetUIOpen(false);
        setIsBoardViewEnabled(false);
        searchbarRef.current?.clear();
        setIsInitialAltSFocus(true);
        chrome.storage.local.set({ new_tab_is_board_view_enabled: false });
      } else if (mode === 'sheet') {
        setIsSheetUIOpen(true);
        searchbarRef.current?.clear();
      }
    };
    window.addEventListener('setViewMode', handleSetViewMode);

    return () => {
      window.removeEventListener('SearchToFavs', onFavsStart);
      window.removeEventListener('FavsToSearch', onSearchStart);
      window.removeEventListener('FavsToAgents', onAgentStart);
      window.removeEventListener('AgentsToFavs', onFavsStart);
      window.removeEventListener('AgentsToSheetUI', onSheetUIStart);
      window.removeEventListener('SearchTutorialStarted', onSearchStart);
      window.removeEventListener('AgentTutorialStarted', onAgentStart);
      window.removeEventListener('TutorialFinished', onTutorialEnd);
      window.removeEventListener('setViewMode', handleSetViewMode);
    };
  }, [dispatch, isLoggedIn]);

  // Migration and Resumption of Tutorial progress
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkAndResume = async () => {
      // 1. Migrate old keys if necessary
      await migrateTutorialProgress();

      // 2. Check for resumption if no tutorial is active
      const progress = await getTutorialProgress();

      // We only auto-resume if the tutorial hasn't been officially finished
      // and if we are not already in a tutorial session
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.storage?.local) return;

      chromeAny.storage.local.get(['tutorial_watched'], (result: any) => {
        if (!result.tutorial_watched) return;

        // If search is not finished, start it
        if (!progress.search) {
          dispatch(setActiveTutorial('search'));
        }
        // If search IS finished but favorites IS NOT, start Step 2
        else if (!progress.favorites) {
          dispatch(setActiveTutorial('favorites'));
        }
        // If favorites IS finished but agent IS NOT, start Step 3
        else if (!progress.agent) {
          dispatch(setActiveTutorial('agent'));
        }
        // If agent IS finished but touchpoints IS NOT, start Step 4
        else if (!progress.touchpoints) {
          dispatch(setActiveTutorial('touchpoints'));
        }
      });
    };

    // Delay slightly to ensure login/initial data is ready
    const timer = setTimeout(checkAndResume, 2000);
    return () => clearTimeout(timer);
  }, [dispatch, isLoggedIn]);

  // Fetch User ID on mount
  useEffect(() => {
    const fetchId = async () => {
      try {
        const uid = await getUserId();
        setUserId(uid);
      } catch (e: any) {
        if (e?.name !== 'AuthError' && !e?.message?.includes('login')) {
          console.error('Failed to fetch userId for App sync:', e);
        }
        setUserId('');
      } finally {
        setAuthChecked(true);
      }
    };
    fetchId();
  }, []);

  useEffect(() => {
    const handleStorageChange = async (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.accessToken) {
        const newVal = changes.accessToken.newValue;
        const oldVal = changes.accessToken.oldValue;
        
        const newUserId = newVal && newVal.startsWith('user_') ? newVal : 'local_user';
        setUserId(newUserId);

        // If transitioning from logged out/local to logged-in user
        if (newVal && newVal.startsWith('user_') && newVal !== 'local_user' && (!oldVal || oldVal === 'local_user')) {
          try {
            // 1. Wait for local data migration to complete first to avoid race conditions
            const { migrateLocalUserToCloud } = await import('../../../Apis/core/identity');
            await migrateLocalUserToCloud(newUserId);

            // 2. Reset all sync timers to bypass counter cooldowns
            const { resetAllSyncTimers } = await import('../../../Apis/core/api');
            await resetAllSyncTimers();
            
            // 3. Fetch fresh cloud data
            const action = await dispatch(fetchAllDataThunk());
            const fetchedTeams = action.payload as Team[];

            // 4. Force write to myCachedAllData and reset the string tracker
            if (Array.isArray(fetchedTeams)) {
              previousAllDataRef.current = JSON.stringify(fetchedTeams);
              await chrome.storage.local.set({ myCachedAllData: fetchedTeams });
            }
            
            // 5. Auto-select personal cloud space or first cloud team if available
            if (Array.isArray(fetchedTeams) && fetchedTeams.length > 0) {
              const personalTeam = fetchedTeams.find(t => t.is_personal_space && t.storageMode !== 'local');
              const firstCloudTeam = fetchedTeams.find(t => t.storageMode !== 'local');
              const teamToSelect = personalTeam || firstCloudTeam || fetchedTeams[0];
              
              if (teamToSelect) {
                dispatch(setSelectedTeam(teamToSelect));
                if (teamToSelect.workspaces && teamToSelect.workspaces.length > 0) {
                  dispatch(setSelectedWorkspace(teamToSelect.workspaces[0]));
                }
              }
            }
          } catch (err) {
            console.error('Failed to initialize cloud data on login:', err);
          }
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [dispatch]);

  const selectedTeam = useSelector(selectSelectedTeam);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);

  const handleOpenSheetUI = useCallback(
    (section?: string) => {
      setIsSheetUIOpen(true);
      dispatch(setIsSidebarCollapsed(false));

      if (section === 'saved-automation') {
        useGridStore.getState().setCategoryFilter(['automation', 'agent', 'module']);
      } else if (section === 'collections') {
        const state = useGridStore.getState();
        state.setCategoryFilter(['all']);
        state.setVisibilityFilter(['all']);
        state.setSpaceFilter(['all']);
      } else if (section) {
        const state = useGridStore.getState();
        state.setTargetSection(section);
        // Ensure section is expanded
        if (state.collapsedSections.includes(section)) {
          state.toggleSection(section);
        }
      }
    },
    [dispatch, mainView.kind],
  );

  const selectedSnippet = useSelector(selectSelectedSnippet);
  const snippetBreadCrum = useSelector(selectSnippetBreadCrum);
  const isCreatingNewItem = useSelector(selectIsCreatingNewItem);
  const isLinkEditModalOpen = useSelector(selectIsLinkEditModalOpen);
  const linkEditPrefill = useSelector(selectLinkEditPrefill);
  const isSessionMode = isLinkEditModalOpen;
  const isEditorDirty = useSelector(selectIsEditorDirty);

  const isEditorExpanded =
    isCreatingNewItem ||
    !!selectedSnippet ||
    mainView.kind === 'bulk' ||
    mainView.kind === 'agentPanel' ||
    mainView.kind === 'store' ||
    mainView.kind === 'todos';
  const isActuallyExpanded = isEditorExpanded || isLinkEditModalOpen;

  const isFocusMode = useSelector(selectIsFocusMode);

  const isDarkModeFromRedux = useSelector(selectDarkMode);
  const isDarkMode = isDarkModeFromRedux;
  const allTeamsData = useSelector(selectAllData) || [];
  const isTodoCreateMode = useSelector(selectIsTodoCreateMode);

  // Robust orgId fallback: Ensures Filter Panel works even if no team was explicitly selected
  const effectiveOrgId = useMemo(() => {
    if (selectedTeam?.team_id) return selectedTeam.team_id;

    // If no selected team, but we have a workspace, find the team that contains this workspace
    if (selectedWorkspace && allTeamsData.length > 0) {
      const parentTeam = allTeamsData.find(t =>
        t.workspaces?.some(w => w.workspace_id === selectedWorkspace.workspace_id),
      );
      if (parentTeam) return parentTeam.team_id;
    }
    return '';
  }, [selectedTeam, selectedWorkspace, allTeamsData]);

  // Filter panel state (managed by SideBar, shown on right side)
  const [filterPanelState, setFilterPanelState] = useState<{
    isOpen: boolean;
    filterState: FilterState;
  }>({ isOpen: false, filterState: { assignees: [], contentType: 'all' } });

  // Track when sidebar search is focused to hide main content
  const [isSidebarSearchFocused, setIsSidebarSearchFocused] = useState(false);

  // Clear main search suggestions when sidebar search is focused to prevent UI overlap
  useEffect(() => {
    if (isSidebarSearchFocused) {
      if (searchbarRef.current) {
        searchbarRef.current.setSuggestionsHidden(true);
      }
    }
  }, [isSidebarSearchFocused]);

  // Track previous editor state to detect TRANSITIONS into edit mode (not just being in edit mode)
  const prevEditorStateRef = useRef<{
    selectedSnippet: boolean;
    isCreatingNewItem: boolean;
    isLinkEditModalOpen: boolean;
    orgPanelOpen: boolean;
    isMainViewEditor: boolean;
  }>({
    selectedSnippet: false,
    isCreatingNewItem: false,
    isLinkEditModalOpen: false,
    orgPanelOpen: false,
    isMainViewEditor: false,
  });

  // Save selectedTeamId to Chrome storage for API services to access
  useEffect(() => {
    if (selectedTeam?.team_id) {
      chrome.storage.local.set({ selectedTeamId: selectedTeam.team_id });
    }
  }, [selectedTeam?.team_id]);

  // Ensure Focus Mode is always off on initial load/refresh and return to Home
  useEffect(() => {
    const isSessionMode = initialParams ? initialParams.get('session_mode') === 'true' : false;

    dispatch(toggleFocusMode(false));
    if (!isSessionMode) {
      dispatch(setIsCreatingNewItem(false));
      dispatch(setSelectedSnippet(null));
    }
    dispatch(setTodoCreatePrefill(null));
  }, [dispatch]);

  // Load New Tab Override Setting
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['new_tab_override_enabled'], (result: any) => {
        dispatch(setNewTabOverrideEnabled(result.new_tab_override_enabled === true));
      });
    }
  }, [dispatch]);

  // Load Frosted Theme
  useEffect(() => {
    loadFrostedTheme().then(theme => {
      applyFrostedTheme(theme);
    });
  }, [dispatch]);

  // TanStack Query for teams data - provides automatic caching and deduplication
  const { data: teamsFromQuery, isLoading: isQueryLoading, isSuccess: isQuerySuccess } = useTeamsData();

  // Keep the teams state local since it's derived from API data
  // This syncs with TanStack Query data when available
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Searchbar ref and handlers - shared between SideBar and Container
  const searchbarRef = useRef<SearchbarHandle | null>(null);
  // Track if any search sub-menu is open to hide main content
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const [isBoardViewOpen, setIsBoardViewOpen] = useState(false);
  const isCommandListView = useSelector(selectIsCommandListView);
  const [isTemplatesView, setIsTemplatesView] = useState(false);
  const [templatesCategory, setTemplatesCategory] = useState<string>('all');

  // Organization panel state - tracks when org panel is open
  const [orgPanelState, setOrgPanelState] = useState<{
    isOpen: boolean;
    orgId?: string;
    orgName?: string;
  }>({ isOpen: false });
  // Unified handler for filter panel state to prevent re-render loops in SideBar
  const handleFilterPanelStateChange = useCallback((newState: { isOpen: boolean; filterState: FilterState }) => {
    setFilterPanelState(newState);
  }, []);

  // Shared helper: close every open view/overlay so shortcuts always land cleanly.
  // actionType is the pending action type for the UnsavedChangesDialog to execute after confirmation.
  const dismissAllViews = useCallback(
    (actionType: 'SHORTCUT_BOARD_VIEW' | 'SHORTCUT_CREATE_MENU' = 'SHORTCUT_BOARD_VIEW') => {
      if (isEditorDirty) {
        // Editor has unsaved changes — show the existing UnsavedChangesDialog.
        // Container will call back with the pending action after the user confirms.
        dispatch(setPendingNavigationAction({ type: actionType }));
        dispatch(setShowEditorSwitchWarning(true));
        return;
      }
      // Navigate back to home (closes noteEditor, linkEditor, orgSettings, etc.)
      dispatch(navigateToView({ kind: 'home' }));
      // Close panels / overlays
      setIsSheetUIOpen(false);
      setOrgPanelState({ isOpen: false });
      setFilterPanelState(prev => ({ ...prev, isOpen: false }));
      setIsGlobalCreateMenuOpen(false);
      dispatch(setIsCreatingNewItem(false));
    },
    [isEditorDirty, dispatch, setIsSheetUIOpen, setOrgPanelState, setFilterPanelState, setIsGlobalCreateMenuOpen],
  );

  // Alt+S/Focus Initialization Flow – dismiss everything then enable board view
  const handleAltSInitialization = useCallback((forceBoardView?: boolean) => {
    
    dismissAllViews('SHORTCUT_BOARD_VIEW');
    if (isEditorDirty) return; // dialog shown; board view will activate after user confirms
    
    if (forceBoardView) {
      setIsBoardViewEnabled(true);
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
      }
    } else if (!isInitialAltSFocus && isBoardViewEnabled) {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
      }
    }
    setIsInitialAltSFocus(true);
  }, [dismissAllViews, isEditorDirty, isInitialAltSFocus, isBoardViewEnabled, setIsInitialAltSFocus]);

  // Search Focus (Omnibox) state for the notice
  const [isOmniboxEnabled, setIsOmniboxEnabled] = useState(true);
  const [isHotkeysHelpOpen, setIsHotkeysHelpOpen] = useState(false);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['omnibox_override_enabled'], (result: any) => {
        setIsOmniboxEnabled(result.omnibox_override_enabled !== false);
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.omnibox_override_enabled) {
          setIsOmniboxEnabled(changes.omnibox_override_enabled.newValue !== false);
        }
      };
      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    }
    return undefined;
  }, []);

  // Auto-close filter panel when TRANSITIONING INTO editor activity or org panel
  // This enables seamless switching: entering edit mode closes filter, but user can still reopen it
  useEffect(() => {
    // Check if mainView changed to a fullscreen editor kind
    const isMainViewEditor =
      mainView.kind === 'todos' ||
      mainView.kind === 'agentPanel' ||
      mainView.kind === 'promptEditor' ||
      mainView.kind === 'aiEditor' ||
      mainView.kind === 'noteEditor' ||
      mainView.kind === 'linkEditor';

    if (!filterPanelState.isOpen) {
      // Update the previous state ref even when filter is closed
      prevEditorStateRef.current = {
        selectedSnippet: !!selectedSnippet,
        isCreatingNewItem,
        isLinkEditModalOpen,
        orgPanelOpen: orgPanelState.isOpen,
        isMainViewEditor,
      };
      return;
    }

    // Detect transitions: something changed from false to true
    const prev = prevEditorStateRef.current;

    const transitionedIntoEditor =
      (!prev.orgPanelOpen && orgPanelState.isOpen) ||
      (!prev.selectedSnippet && !!selectedSnippet) ||
      (!prev.isCreatingNewItem && isCreatingNewItem) ||
      (!prev.isLinkEditModalOpen && isLinkEditModalOpen) ||
      (!prev.isMainViewEditor && isMainViewEditor);

    // Only close if we're ENTERING an editor state, not if already in one
    if (transitionedIntoEditor) {
      setFilterPanelState(prevState => ({ ...prevState, isOpen: false }));
    }

    // Update the previous state ref
    prevEditorStateRef.current = {
      selectedSnippet: !!selectedSnippet,
      isCreatingNewItem,
      isLinkEditModalOpen,
      orgPanelOpen: orgPanelState.isOpen,
      isMainViewEditor,
    };
  }, [
    orgPanelState.isOpen,
    selectedSnippet,
    isCreatingNewItem,
    isLinkEditModalOpen,
    filterPanelState.isOpen,
    mainView.kind,
  ]);

  // Handle Global Hotkey Trigger from URL Parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Handle Sheet UI Focus from Background
    if (urlParams.get('focus_sheet_ui_first_column') === 'true') {
      handleOpenSheetUI();
      // 🚀 Optimization: Let SheetTable's internal logic handle focusing the first data row
      useGridStore.getState().setSelectedCell({ rowIndex: 1, colIndex: 0 });

      // Clean up URL parameter to prevent re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Force Board View from Background (Alt+S)
    if (urlParams.get('force_board_view') === 'true') {
      
      handleAltSInitialization(true);
      console.trace('[ALT+S INIT]');

      setTimeout(() => {
        if (searchbarRef.current) {
          searchbarRef.current.focus();
        }
      }, 50);

      // Clean up URL parameter to prevent re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Create Menu from Background (Alt+C)
    if (urlParams.get('open_create') === 'true') {
      
      dismissAllViews('SHORTCUT_CREATE_MENU');
      if (!isEditorDirty) {
        setIsGlobalCreateMenuOpen(true);
      }

      // Clean up URL parameter to prevent re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Sheet from external site
    const sheetAction = urlParams.get('open_sheet');
    if (sheetAction) {
      

      if (sheetAction === 'todo') {
        dispatch(setShowTodosView(true));
      } else if (sheetAction === 'collections') {
        handleOpenSheetUI('collections');
      } else if (sheetAction === 'saved-automation') {
        handleOpenSheetUI('saved-automation');
      } else {
        const executeSheetAction = () => {
          if (searchbarRef.current) {
            searchbarRef.current.clear();
            setTimeout(() => {
              const mode = sheetAction === 'store' || sheetAction === 'ai' ? 'lock' : 'execute';
              searchbarRef.current?.executeCommand(sheetAction as any, { mode });
              searchbarRef.current?.focus();
            }, 10);
          } else {
            setTimeout(executeSheetAction, 100);
          }
        };
        executeSheetAction();
      }

      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Automation Creation
    if (urlParams.get('create_automation') === 'true') {
      
      dispatch(navigateToView({ kind: 'agentPanel', agentProps: { editMode: false, automation: null } }));
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Link Creation
    if (urlParams.get('create_link') === 'true') {
      
      dispatch(setIsCreatingNewItem(true));
      dispatch(navigateToView({ kind: 'linkEditor' }));
      dispatch(openLinkEditModal({ editMode: false, snippet: null }));
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Session Mode Link Editor
    if (urlParams.get('session_mode') === 'true') {
      const sessionName = decodeURIComponent(urlParams.get('session_name') || '');
      const sessionId = urlParams.get('session_id') || '';
      
      dispatch(setIsCreatingNewItem(true));
      dispatch(navigateToView({ kind: 'linkEditor' }));
      dispatch(
        openLinkEditModal({
          editMode: false,
          snippet: null,
          prefill: { key: sessionName, id: sessionId, category: 'TabGroup' } as any,
        }),
      );
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Note Creation
    if (urlParams.get('create_note') === 'true') {
      
      dispatch(setIsCreatingNewItem(true));
      dispatch(navigateToView({ kind: 'noteEditor', noteProps: { category: 'note' } }));
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Snippet Creation
    if (urlParams.get('create_snippet') === 'true') {
      
      dispatch(setIsCreatingNewItem(true));
      dispatch(navigateToView({ kind: 'noteEditor', noteProps: { category: 'snippet' } }));
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Todo Creation
    if (urlParams.get('create_todo') === 'true') {
      
      dispatch(setTodoCreatePrefill({ isCreateModalOnly: true }));
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // Handle Open Prompt Creation
    if (urlParams.get('create_prompt') === 'true') {
      
      dispatch(setIsCreatingNewItem(true));
      dispatch(navigateToView({ kind: 'promptEditor' }));
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    if (urlParams.get('trigger_hotkey') !== 'true') return;

    const type = urlParams.get('type');
    const rawId = urlParams.get('id');
    if (!rawId) {
      console.warn('[App] [HOTKEY_TRIGGER] Trigger detected but missing ID parameter');
      return;
    }

    

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 80; // 8 seconds at 100ms intervals
    const retryDelayMs = 100;

    const tryHandle = () => {
      if (cancelled) return;
      // Wait for both searchbar AND login state (userId) to be ready
      // We use userIdRef.current to avoid stale closure issues during the retry loop
      const currentIsLoggedIn = userIdRef.current !== '';

      if (!searchbarRef.current || (!currentIsLoggedIn && attempts < 30)) {
        if (attempts++ < maxAttempts) {
          if (attempts % 10 === 0) {
            
          }
          window.setTimeout(tryHandle, retryDelayMs);
        } else {
          console.error('[App] [HOTKEY_TRIGGER] Gave up waiting after', attempts, 'attempts');
        }
        return;
      }

      
      const id = rawId.includes(':') ? rawId.split(':')[1] : rawId;

      // 1. Normalize ID (strip all possible UI/internal prefixes)
      let normalizedId = id.startsWith('/') ? id.substring(1) : id;
      normalizedId = normalizedId
        .replace(/^cmd-/, '')
        .replace(/^lcmd-/, '')
        .replace(/^auto-/, '')
        .replace(/^agent-/, '');

      if (type === 'command') {
        
        // Use 'execute' mode to respect command behavior (instant vs locked)
        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });

        if (!searchbarRef.current.isLocked) {
          searchbarRef.current.focus();
        }
      } else if (type === 'module') {
        
        searchbarRef.current.executeModule(normalizedId);
        searchbarRef.current.focus();
      } else if (type === 'automation' || type === 'agent' || type === 'chat_agent') {
        

        // A. Check Saved Agents (AI agents/chats)
        const agent = savedAgentById.get(normalizedId);
        if (agent) {
          searchbarRef.current.executeCommand('ai', { mode: 'lock' });
          searchbarRef.current.selectSavedAgent(agent);
          return;
        }

        // B. Check Automations in allData
        let foundAuto: any = null;
        for (const team of allData || []) {
          for (const ws of team.workspaces || []) {
            foundAuto = (ws.workspace_automations || []).find((a: any) => String(a.id) === normalizedId);
            if (foundAuto) break;
            for (const folder of ws.folders || []) {
              foundAuto = (folder.automations || []).find((a: any) => String(a.id) === normalizedId);
              if (foundAuto) break;
            }
            if (foundAuto) break;
          }
          if (foundAuto) break;
        }

        if (foundAuto) {
          searchbarRef.current.activateAutomation(foundAuto);
        } else {
          // C. FALLBACK: Try as a command if not found as automation/agent
          // This handles cases where a Todo might be mis-categorized
          console.warn(`[App] ${type} not found for ID: ${normalizedId}. Trying as command fallback.`);
          searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
          if (!searchbarRef.current.isLocked) {
            searchbarRef.current.focus();
          }
        }
      } else if (type === 'link' || type === 'note' || type === 'snippet') {
        

        // A. If the ID is a clean UUID or doesn't have joint format, lookup directly in allData
        let foundSnippet: any = null;
        let foundWorkspace: any = null;
        let foundFolder: any = null;
        let foundTeam: any = null;

        for (const team of teams || []) {
          for (const ws of team.workspaces || []) {
            // Check workspace snippets
            const wsSnippet = (ws.workspace_snippets || []).find(
              (s: any) => String(s.id) === normalizedId || String(s.snippet_id) === normalizedId,
            );
            if (wsSnippet) {
              foundSnippet = wsSnippet;
              foundWorkspace = ws;
              foundTeam = team;
              break;
            }
            // Check folder snippets
            for (const folder of ws.folders || []) {
              const fSnippet = (folder.snippets || []).find(
                (s: any) => String(s.id) === normalizedId || String(s.snippet_id) === normalizedId,
              );
              if (fSnippet) {
                foundSnippet = fSnippet;
                foundWorkspace = ws;
                foundFolder = folder;
                foundTeam = team;
                break;
              }
            }
            if (foundSnippet) break;
          }
          if (foundSnippet) break;
        }

        if (foundSnippet && foundWorkspace && foundTeam) {
          if (type === 'link') {
            const category = (foundSnippet.category || '').toLowerCase();
            if (category === 'link') {
              searchbarRef.current.openUrls([foundSnippet.value as string]);
            } else if (category === 'tabgroup' || category === 'tab group') {
              try {
                const val =
                  typeof foundSnippet.value === 'string' ? JSON.parse(foundSnippet.value) : foundSnippet.value;
                const urls = Array.isArray(val?.urls) ? val.urls : [];
                if (urls.length > 0) searchbarRef.current.openUrls(urls);
              } catch { }
            }
          } else {
            // Note / Snippet -> Redirect to clean full screen note view
            const newUrl = chrome.runtime.getURL(
              `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(foundSnippet.id || foundSnippet.snippet_id || '')}`
            );
            window.location.replace(newUrl);
          }
          return;
        }

        // B. Legacy joint containerId-snippetId format check
        const idParts = id.split('-');
        if (idParts.length >= 10) {
          const containerId = idParts.slice(0, 5).join('-');
          const snippetId = idParts.slice(5).join('-');

          let found = false;
          for (const team of teams || []) {
            for (const ws of team.workspaces || []) {
              if (ws.workspace_id === containerId) {
                for (const snippet of ws.workspace_snippets || []) {
                  const uid = (snippet as any).snippet_id ?? (snippet as any).id;
                  if (uid === snippetId) {
                    if (type === 'link') {
                      // Trigger link
                      const category = (snippet.category || '').toLowerCase();
                      if (category === 'link') {
                        searchbarRef.current.openUrls([snippet.value as string]);
                      } else if (category === 'tabgroup' || category === 'tab group') {
                        try {
                          const val = typeof snippet.value === 'string' ? JSON.parse(snippet.value) : snippet.value;
                          const urls = Array.isArray(val?.urls) ? val.urls : [];
                          if (urls.length > 0) searchbarRef.current.openUrls(urls);
                        } catch { }
                      }
                    } else {
                      // Trigger note -> Redirect to clean full screen note view
                      const newUrl = chrome.runtime.getURL(
                        `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippet.id || snippet.snippet_id || '')}`
                      );
                      window.location.replace(newUrl);
                    }
                    found = true;
                    break;
                  }
                }
              }
              if (found) break;

              for (const folder of ws.folders || []) {
                if (folder.folder_id === containerId) {
                  for (const snippet of folder.snippets || []) {
                    const uid = (snippet as any).snippet_id ?? (snippet as any).id;
                    if (uid === snippetId) {
                      if (type === 'link') {
                        const category = (snippet.category || '').toLowerCase();
                        if (category === 'link') {
                          searchbarRef.current.openUrls([snippet.value as string]);
                        } else if (category === 'tabgroup' || category === 'tab group') {
                          try {
                            const val = typeof snippet.value === 'string' ? JSON.parse(snippet.value) : snippet.value;
                            const urls = Array.isArray(val?.urls) ? val.urls : [];
                            if (urls.length > 0) searchbarRef.current.openUrls(urls);
                          } catch { }
                        }
                      } else {
                        // Redirect to clean full screen note view
                        const newUrl = chrome.runtime.getURL(
                          `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippet.id || snippet.snippet_id || '')}`
                        );
                        window.location.replace(newUrl);
                      }
                      found = true;
                      break;
                    }
                  }
                }
                if (found) break;
              }
              if (found) break;
            }
            if (found) break;
          }
        }
      }

      // Clean up URL parameters to prevent re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    };

    tryHandle();
    return () => {
      cancelled = true;
    };
  }, [dataLoaded, teams, dispatch]);

  // Handle lock_command and agent_id from URL (e.g. when opening from a Link Group)
  useEffect(() => {
    if (!dataLoaded || !searchbarRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const lockCommand = urlParams.get('lock_command');
    const agentId = urlParams.get('agent_id');

    if (lockCommand === 'ai' && agentId) {
      

      // Execute /ai command first in lock mode
      searchbarRef.current.executeCommand('ai', { mode: 'lock' });

      // Find the agent in our data
      const agent = savedAgentById.get(agentId);
      if (agent) {
        // Select it after a short delay to ensure AI UI is ready
        setTimeout(() => {
          searchbarRef.current?.selectSavedAgent(agent);
        }, 100);
      }

      // Clean up URL parameters after a delay to allow other components to read them
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 500);
    } else if (lockCommand) {
      const cmdId = lockCommand.startsWith('/') ? lockCommand.substring(1) : lockCommand;
      
      searchbarRef.current.executeCommand(cmdId as any, { mode: 'execute' });
      if (!searchbarRef.current.isLocked) {
        searchbarRef.current.focus();
      }

      // Clean up URL parameters after a delay to allow other components to read them
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 500);
    }
  }, [dataLoaded, savedAgentById]);

  // Global message listener for background notifications (e.g. Toasts, Unified execution)
  useEffect(() => {
    const findSnippetById = (id: string | number) => {
      const actualId = String(id);
      for (const team of allData || []) {
        for (const ws of team.workspaces || []) {
          const wsSnippet = ws.workspace_snippets?.find((s: any) => String(s.id) === actualId);
          if (wsSnippet) return wsSnippet;
          for (const folder of ws.folders || []) {
            const fSnippet = folder.snippets?.find((s: any) => String(s.id) === actualId);
            if (fSnippet) return fSnippet;
          }
        }
      }
      return null;
    };

    const handleMessage = (message: any) => {
      if (message.type === 'SHOW_TOAST') {
        
        triggerToast(message.message, message.toastType || 'info');
      } else if (message.type === 'EXECUTE_TODO') {
        const { todo } = message;
        const { category, id, value, automationObj, key } = todo;
        

        if (!searchbarRef.current) {
          console.warn('[App] EXECUTE_TODO: searchbarRef not ready');
          return;
        }

        // 1. Ensure sidebar is expanded for visibility (matching hotkey behavior)
        dispatch(setIsSidebarCollapsed(false));

        if (category === 'command') {
          // Reverted to 'execute' mode as requested — opens the URL immediately if it's a URL command
          searchbarRef.current.executeCommand((value || id) as any, { mode: 'execute' });
          searchbarRef.current.focus();
        } else if (category === 'module') {
          searchbarRef.current.executeModule(value || id);
          searchbarRef.current.focus();
        } else if (category === 'automation') {
          if (automationObj) {
            searchbarRef.current.activateAutomation(automationObj);
          } else {
            console.warn('[App] EXECUTE_TODO: automationObj missing');
          }
          searchbarRef.current.focus();
        } else if (['tabgroup', 'link', 'links', 'bookmark', 'snippet', 'note', 'prompt'].includes(category)) {
          // Connect to centralized snippet execution logic in Searchbar
          const snippet = findSnippetById(id);
          if (snippet) {
            // Force new tab for scheduled todos as requested
            searchbarRef.current.executeSnippet(snippet, true);
          } else if (category === 'tabgroup' && value) {
            // Fallback for tabgroups if snippet metadata isn't available
            const urls = value
              .split(',')
              .map((u: string) => u.trim())
              .filter((u: string) => u.startsWith('http') || u.startsWith('chrome:'));
            if (urls.length > 0) searchbarRef.current.openUrls(urls, undefined, true);
          }
        }
      } else if (message.type === 'EXECUTE_COMMAND') {
        // Legacy/Direct support
        const { cmdType, cmdId } = message;
        if (!searchbarRef.current) return;
        if (cmdType === 'command') searchbarRef.current.executeCommand(cmdId as any, { mode: 'execute' });
        else if (cmdType === 'module') searchbarRef.current.executeModule(cmdId);
      } else if (message.type === 'EXECUTE_AUTOMATION') {
        // Legacy/Direct support
        if (!searchbarRef.current) return;
        if (message.automation) searchbarRef.current.activateAutomation(message.automation);
      } else if (message.type === 'TODOS_UPDATED') {
        
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [triggerToast, allData, dispatch]);

  const [isOrgPanelLoading, setIsOrgPanelLoading] = useState(false);

  const pendingLockedCommand = useSelector(selectPendingLockedCommand);
  const pendingAutomation = useSelector(selectPendingAutomation);
  const pendingAgent = useSelector(selectPendingAgent);

  useEffect(() => {
    if (searchbarRef.current) {
      if (pendingLockedCommand) {
        const { commandId, mode } = pendingLockedCommand;
        

        // Close Sheet UI if open
        if (isSheetUIOpen) {
          setIsSheetUIOpen(false);
        }

        // Execute the command
        searchbarRef.current?.clear();
        setTimeout(() => {
          searchbarRef.current?.executeCommand(commandId as any, { mode });
        }, 100);

        // Clear the pending state
        dispatch(setPendingLockedCommand(null));
      } else if (pendingAutomation) {
        
        if (isSheetUIOpen) {
          setIsSheetUIOpen(false);
        }
        searchbarRef.current?.clear();
        setTimeout(() => {
          searchbarRef.current?.activateAutomation(pendingAutomation);
          searchbarRef.current?.focus();
        }, 100);
        dispatch(setPendingAutomation(null));
      } else if (pendingAgent) {
        
        if (isSheetUIOpen) {
          setIsSheetUIOpen(false);
        }
        setTimeout(() => {
          searchbarRef.current?.selectSavedAgent(pendingAgent);
          searchbarRef.current?.focus();
        }, 100);
        dispatch(setPendingAgent(null));
      }
    }
  }, [pendingLockedCommand, pendingAutomation, pendingAgent, dispatch, isSheetUIOpen]);

  const handleOrganizationPanelChange = useCallback(
    (state: { isOpen: boolean; orgId?: string; orgName?: string; loading?: boolean }) => {
      setOrgPanelState({
        isOpen: state.isOpen,
        orgId: state.orgId,
        orgName: state.orgName,
      });
      if (state.loading !== undefined) {
        setIsOrgPanelLoading(state.loading);
      }

      // Automatically expand sidebar when an organization panel opens
      if (state.isOpen) {
        dispatch(setIsSidebarCollapsed(false));
      }
    },
    [dispatch],
  );

  const [createWorkspaceModal, setCreateWorkspaceModal] = useState<{
    isOpen: boolean;
    defaultAccess: 'public' | 'private' | 'shareonly';
    isPersonalSpace: boolean;
    targetTeamId?: string;
  }>({
    isOpen: false,
    defaultAccess: 'public',
    isPersonalSpace: false,
  });

  const hasActivePopup =
    mainView?.kind === 'noteEditor' ||
    mainView?.kind === 'promptEditor' ||
    mainView?.kind === 'agentPanel' ||
    isCreatingNewItem ||
    isLinkEditModalOpen ||
    isFullScreenModalOpen ||
    isGlobalCreateMenuOpen ||
    createWorkspaceModal.isOpen;

  const handleCreateWorkspace = useCallback(
    (isPersonal: boolean = false, access?: 'public' | 'private' | 'shareonly', targetTeamId?: string) => {
      if (!isLoggedIn) {
        triggerToast('Please log in to create a folder.', 'warning');
        return;
      }

      // Collapse sidebar for better visibility of creation views/popups
      dispatch(setIsSidebarCollapsed(true));

      // For Org Level (not personal), navigate to the dedicated container view
      if (!isPersonal) {
        setIsSheetUIOpen(false); // Close Sheet UI to show the container view
        dispatch(
          navigateToView({
            kind: 'sharedFolderCreation',
            defaultPrivacy: access === 'public' ? 'public' : access === 'shareonly' ? 'shared' : 'private',
            targetTeamId: targetTeamId,
          }),
        );
        return;
      }

      // For Personal Space, continue using the quick popup
      setIsSheetUIOpen(false); // Close Sheet UI
      setCreateWorkspaceModal({
        isOpen: true,
        defaultAccess: access || (isPersonal ? 'private' : 'public'),
        isPersonalSpace: isPersonal,
        targetTeamId: targetTeamId,
      });
    },
    [isLoggedIn, triggerToast, dispatch],
  );

  // Load UI persistence states
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(
        [
          'new_tab_show_favorites',
          'new_tab_terminal_open',
          'new_tab_expanded_workspaces',
          'new_tab_expanded_folders',
          'new_tab_is_auto_expand_mode',
          'new_tab_collapsed_workspaces',
          'new_tab_collapsed_folders',
          'new_tab_collapsed_sections',
          'new_tab_is_sidebar_collapsed',
          'new_tab_is_dark_mode',
          'new_tab_is_board_view_enabled',
        ],
        (result: any) => {
          if (result.new_tab_show_favorites !== undefined) {
            dispatch(setShowFavorites(result.new_tab_show_favorites));
          }
          if (result.new_tab_is_board_view_enabled !== undefined) {
            setIsBoardViewEnabled(result.new_tab_is_board_view_enabled);
          } else {
            setIsBoardViewEnabled(true);
            chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
          }
          if (result.new_tab_terminal_open !== undefined) {
            dispatch(setIsCommandListView(result.new_tab_terminal_open));
          }
          if (result.new_tab_expanded_workspaces) {
            dispatch(expandAllWorkspaces(result.new_tab_expanded_workspaces));
          }
          if (result.new_tab_expanded_folders) {
            dispatch(expandAllFolders(result.new_tab_expanded_folders));
          }
          if (result.new_tab_is_auto_expand_mode !== undefined) {
            dispatch(setIsAutoExpandMode(result.new_tab_is_auto_expand_mode));
          }
          if (result.new_tab_collapsed_workspaces) {
            dispatch(setCollapsedWorkspaces(result.new_tab_collapsed_workspaces));
          }
          if (result.new_tab_collapsed_folders) {
            dispatch(setCollapsedFolders(result.new_tab_collapsed_folders));
          }
          if (result.new_tab_collapsed_sections) {
            dispatch(setCollapsedSections(result.new_tab_collapsed_sections));
          }
          // Force dark mode only (temporarily disable light mode switching).
          dispatch(setDarkMode(true));
          if (chromeAny?.storage?.local) {
            chromeAny.storage.local.set({ new_tab_is_dark_mode: true, new_tab_dark_mode: true });
          }
          if (result.new_tab_is_sidebar_collapsed !== undefined) {
            // Force sidebar to be collapsed permanently as per user request
            // EXCEPT if we are explicitly focusing the sheet UI via Alt+A/URL param
            const urlParams = new URLSearchParams(window.location.search);
            const isFocusingSheet = isInitialFocusSheet || urlParams.get('focus_sheet_ui_first_column') === 'true';

            if (!isFocusingSheet) {
              dispatch(setIsSidebarCollapsed(true));
              // Sync the forced state back to storage if it was found as false
              if (result.new_tab_is_sidebar_collapsed === false) {
                chrome.storage.local.set({ new_tab_is_sidebar_collapsed: true });
              }
            }
          }

          // Mark as loaded so the saving effect (at line 612) can start persisting changes
          hasLoadedThemeRef.current = true;
        },
      );
    }
  }, [dispatch]);

  // Save UI persistence states on change
  const showFavorites = useSelector(selectShowFavorites);
  const expandedWorkspaces = useSelector(selectExpandedWorkspaces);
  const expandedFolders = useSelector(selectExpandedFolders);
  const isAutoExpandMode = useSelector(selectIsAutoExpandMode);
  const collapsedWorkspaces = useSelector(selectCollapsedWorkspaces);
  const collapsedFolders = useSelector(selectCollapsedFolders);
  const collapsedSections = useSelector(selectCollapsedSections);
  const isSidebarCollapsed = useSelector(selectIsSidebarCollapsed);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local && hasLoadedThemeRef.current) {
      chromeAny.storage.local.set({
        new_tab_show_favorites: showFavorites,
        new_tab_terminal_open: isCommandListView,
        new_tab_expanded_workspaces: expandedWorkspaces,
        new_tab_expanded_folders: expandedFolders,
        new_tab_is_auto_expand_mode: isAutoExpandMode,
        new_tab_collapsed_workspaces: collapsedWorkspaces,
        new_tab_collapsed_folders: collapsedFolders,
        new_tab_collapsed_sections: collapsedSections,
        new_tab_is_sidebar_collapsed: isSidebarCollapsed,
        new_tab_is_dark_mode: isDarkMode,
        new_tab_is_board_view_enabled: isBoardViewEnabled,
      });

      // localStorage writes removed per user request for full extension storage migration
    }
  }, [
    showFavorites,
    isCommandListView,
    expandedWorkspaces,
    expandedFolders,
    isAutoExpandMode,
    collapsedWorkspaces,
    collapsedFolders,
    collapsedSections,
    isSidebarCollapsed,
    isDarkMode,
    isBoardViewEnabled,
  ]);

  // Listen for storage changes from the GeneralSettingsPanel
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.new_tab_is_board_view_enabled !== undefined) {
          setIsBoardViewEnabled(changes.new_tab_is_board_view_enabled.newValue);
        }
      }
    };
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => chromeAny.storage.onChanged.removeListener(handleStorageChange);
    }
    return () => {};
  }, []);

  // Helper function to check if any modal/popup is open
  const isModalOpen = useCallback((): boolean => {
    // Check for modals/popups by looking for common modal classes or fixed overlays
    // This includes EditWorkspaceNamePopup, EditFolderNamePopup, DeleteDialog, etc.
    const modals = document.querySelectorAll('.fixed.inset-0');
    // Also check if activeElement is inside a modal (any element with fixed inset-0 parent)
    const activeElement = document.activeElement;
    if (activeElement) {
      const modalParent = activeElement.closest('.fixed.inset-0');
      if (modalParent) {
        // Check if this modal is actually visible (has opacity > 0 or is in the DOM)
        const style = window.getComputedStyle(modalParent);
        if (style.opacity !== '0' && style.display !== 'none') {
          return true;
        }
      }
    }
    // Check if any visible modal exists
    for (let i = 0; i < modals.length; i++) {
      const modal = modals[i] as HTMLElement;
      const style = window.getComputedStyle(modal);
      if (style.opacity !== '0' && style.display !== 'none') {
        return true;
      }
    }
    return false;
  }, []);

  // Handle F11 for Focus Mode
  useEffect(() => {
    const handleF11 = (event: KeyboardEvent) => {
      if (isKeystrokeRecordingActive()) return;
      if (event.key === 'F11') {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleFocusMode(!isFocusMode));
      }
    };

    window.addEventListener('keydown', handleF11);
    return () => window.removeEventListener('keydown', handleF11);
  }, [dispatch, isFocusMode, isKeystrokeRecordingActive]);

  // Handle ESC key to exit filter mode
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isKeystrokeRecordingActive()) return;
      if (event.key === 'Escape' && filterPanelState.isOpen) {
        // Don't interfere if a modal is open
        if (isModalOpen()) return;

        event.preventDefault();
        event.stopPropagation();
        // Close filter panel and reset filters
        setFilterPanelState({
          isOpen: false,
          filterState: { assignees: [], contentType: 'all' },
        });
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [filterPanelState.isOpen, isModalOpen, isKeystrokeRecordingActive]);

  // Handle global hotkeys for commands, links, and notes (matching AltS logic)
  useEffect(() => {
    // Cache for hotkeys to avoid async lookup on every keypress
    let cachedCommandHotkeys: { [commandId: string]: string } = {};
    let cachedLinkHotkeys: { [linkId: string]: string } = {};
    let cachedNoteHotkeys: { [noteId: string]: string } = {};
    let cachedAutomationHotkeys: { [automationId: string]: string } = {};
    let cachedModuleHotkeys: { [moduleId: string]: string } = {};
    let cachedLinkData: { [linkId: string]: { url?: string; urls?: string[]; type?: string } } = {};
    let cachedAutomations: { [automationId: string]: any } = {};

    // Load hotkeys from storage
    const loadHotkeys = async () => {
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.storage?.local) return;
      const result = await new Promise<{
        alts_command_hotkeys?: { [key: string]: string };
        alts_link_hotkeys?: { [key: string]: string };
        alts_note_hotkeys?: { [key: string]: string };
        alts_automation_hotkeys?: { [key: string]: string };
        alts_module_hotkeys?: { [key: string]: string };
        link_commands?: { [key: string]: { url?: string; urls?: string[]; type?: string } };
        alts_commands?: any[];
        automations?: { [key: string]: any };
      }>(resolve => {
        chromeAny.storage.local.get(
          [
            'alts_command_hotkeys',
            'alts_link_hotkeys',
            'alts_note_hotkeys',
            'alts_automation_hotkeys',
            'alts_module_hotkeys',
            'link_commands',
            'alts_commands',
            'automations',
          ],
          resolve,
        );
      });

      if (result.alts_command_hotkeys) {
        cachedCommandHotkeys = { ...result.alts_command_hotkeys };
      }
      // Merge alts_commands (cloud synced commands) into cachedCommandHotkeys
      if (result.alts_commands && Array.isArray(result.alts_commands)) {
        result.alts_commands.forEach((cmd: any) => {
          if (cmd?.id && cmd?.hotkey) {
            cachedCommandHotkeys[cmd.id] = cmd.hotkey;
          }
        });
      }

      // Apply default fallbacks if not configured/customized
      if (!cachedCommandHotkeys['create']) {
        cachedCommandHotkeys['create'] = 'Alt+C';
      }

      if (result.alts_link_hotkeys) {
        cachedLinkHotkeys = result.alts_link_hotkeys;
      }
      if (result.alts_note_hotkeys) {
        cachedNoteHotkeys = result.alts_note_hotkeys;
      }
      if (result.alts_automation_hotkeys) {
        cachedAutomationHotkeys = result.alts_automation_hotkeys;
      }
      if (result.alts_module_hotkeys) {
        cachedModuleHotkeys = result.alts_module_hotkeys;
      }
      if (result.link_commands) {
        cachedLinkData = result.link_commands;
      }
      if (result.automations) {
        cachedAutomations = result.automations;
      }
    };
    loadHotkeys();

    const chromeAny = (window as any)?.chrome;
    const handleStorageChange = (changes: any) => {
      if (changes.alts_command_hotkeys) {
        cachedCommandHotkeys = { ...cachedCommandHotkeys, ...(changes.alts_command_hotkeys.newValue || {}) };
      }
      if (changes.alts_commands) {
        const newValue = changes.alts_commands.newValue;
        if (Array.isArray(newValue)) {
          newValue.forEach((cmd: any) => {
            if (cmd?.id && cmd?.hotkey) {
              cachedCommandHotkeys[cmd.id] = cmd.hotkey;
            }
          });
        }
      }

      // Re-apply default fallbacks if not configured/customized
      if (!cachedCommandHotkeys['create']) {
        cachedCommandHotkeys['create'] = 'Alt+C';
      }

      if (changes.alts_link_hotkeys) {
        cachedLinkHotkeys = changes.alts_link_hotkeys.newValue || {};
      }
      if (changes.alts_note_hotkeys) {
        cachedNoteHotkeys = changes.alts_note_hotkeys.newValue || {};
      }
      if (changes.alts_automation_hotkeys) {
        cachedAutomationHotkeys = changes.alts_automation_hotkeys.newValue || {};
      }
      if (changes.alts_module_hotkeys) {
        cachedModuleHotkeys = changes.alts_module_hotkeys.newValue || {};
      }
      if (changes.link_commands) {
        cachedLinkData = changes.link_commands.newValue || {};
      }
      if (changes.automations) {
        cachedAutomations = changes.automations.newValue || {};
      }
    };
    chromeAny?.storage?.onChanged?.addListener(handleStorageChange);

    const handleHotkeyDown = (e: KeyboardEvent) => {
      if (isKeystrokeRecordingActive()) return;
      // Check if typing in an input/textarea
      const activeEl = document.activeElement;
      const isInInputField =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable;

      // Ignore standalone modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(e.key)) {
        return;
      }

      // Build pressed hotkey string
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let keyName = e.key;
      if (keyName === ' ') keyName = 'Space';
      else if (keyName.length === 1) keyName = keyName.toUpperCase();
      else if (keyName === 'ArrowUp') keyName = '↑';
      else if (keyName === 'ArrowDown') keyName = '↓';
      else if (keyName === 'ArrowLeft') keyName = '←';
      else if (keyName === 'ArrowRight') keyName = '→';

      parts.push(keyName);
      const pressedHotkey = parts.join('+');

      // Skip if no modifier (we don't want single key hotkeys in NewTab)
      // This also ensures normal typing in inputs is not intercepted
      if (!e.ctrlKey && !e.altKey && !e.metaKey) return;

      // Skip if typing in input WITHOUT a hotkey modifier combination
      // (Allow Ctrl/Alt+key combos even in input fields for hotkeys)
      // Only skip for common text editing shortcuts that should work in inputs
      if (isInInputField) {
        // Allow standard text editing shortcuts to work in inputs
        const isTextEditShortcut =
          (e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase());
        if (isTextEditShortcut) return;
      }

      // Debug: Log hotkey matching
      

      // 🚀 Global System Shortcuts: Ctrl+Q (Quick Search)
      const isCtrlQ = pressedHotkey === 'Ctrl+Q';

      if (isCtrlQ) {
        
        e.preventDefault();
        e.stopPropagation();

        // Ctrl+Q behavior: Focus sidebar search
        dispatch(setIsSidebarCollapsed(false));
        setTimeout(() => {
          const input =
            document.getElementById('sheet-search-name') || document.querySelector('input[placeholder*="Search"]');
          if (input instanceof HTMLElement) input.focus();
        }, 100);
        return;
      }

      // Check command hotkeys first
      const matchedCommand = Object.entries(cachedCommandHotkeys).find(([, hk]) => hk === pressedHotkey);
      if (matchedCommand) {
        const [commandId] = matchedCommand;
        
        e.preventDefault();
        e.stopPropagation();

        if (commandId === 'create') {
          dispatch(setShowFavorites(true));
          dispatch(setIsCreateMenuOpen(true));
          return;
        }

        // Execute command via searchbar - handles local commands (editors), remote commands (tabs), and AI commands (locking)
        if (searchbarRef.current) {
          // Ensure sidebar expands when a command is triggered via hotkey
          dispatch(setIsSidebarCollapsed(false));
          searchbarRef.current.executeCommand(commandId as any, { mode: 'lock' });
          searchbarRef.current.focus();
        }
        return;
      }

      // Check automation hotkeys
      const matchedAutomation = Object.entries(cachedAutomationHotkeys).find(([, hk]) => hk === pressedHotkey);
      if (matchedAutomation) {
        const [rawId] = matchedAutomation;
        // Check for org-scoped hotkey
        let teamScopedId: string | null = null;
        let automationId = rawId;
        if (rawId.includes(':')) {
          const [teamId, actualId] = rawId.split(':');
          if (teamId !== selectedTeam?.team_id) {
            // Hotkey is for different org, skip
          } else {
            teamScopedId = teamId;
            automationId = actualId;
          }
        }

        if (automationId) {
          let automation = cachedAutomations[automationId];

          if (!automation) {
            // Search in teams
            for (const team of teams || []) {
              for (const ws of team.workspaces || []) {
                const found = ws.workspace_automations?.find(a => String(a.id) === String(automationId));
                if (found) {
                  automation = found;
                  break;
                }
                for (const folder of ws.folders || []) {
                  const ffound = folder.automations?.find(a => String(a.id) === String(automationId));
                  if (ffound) {
                    automation = ffound;
                    break;
                  }
                }
                if (automation) break;
              }
              if (automation) break;
            }
          }

          if (automation) {
            
            e.preventDefault();
            e.stopPropagation();

            if (searchbarRef.current) {
              searchbarRef.current.activateAutomation(automation);
              searchbarRef.current.focus();
            }
            return;
          }
        }
      }

      // Check module hotkeys
      const matchedModule = Object.entries(cachedModuleHotkeys).find(([, hk]) => hk === pressedHotkey);
      if (matchedModule) {
        const [rawId] = matchedModule;
        const moduleId = rawId.includes(':') ? rawId.split(':')[1] : rawId;
        
        e.preventDefault();
        e.stopPropagation();

        if (searchbarRef.current) {
          searchbarRef.current.executeModule(moduleId);
          searchbarRef.current.focus();
        }
        return;
      }

      // Check links hotkeys
      const matchedLink = Object.entries(cachedLinkHotkeys).find(([key, hk]) => {
        if (hk !== pressedHotkey) return false;
        // Check for org-scoped hotkey
        if (key.includes(':')) {
          const [teamId] = key.split(':');
          return teamId === selectedTeam?.team_id;
        }
        return true;
      });

      if (matchedLink) {
        const rawId = matchedLink[0];
        const linkId = rawId.includes(':') ? rawId.split(':')[1] : rawId;
        
        e.preventDefault();
        e.stopPropagation();

        // First try cached link data
        const linkData = cachedLinkData[linkId];
        if (linkData && (linkData.url || linkData.urls)) {
          const urls =
            (linkData.type === 'tabgroup' || linkData.type === 'tab group') && linkData.urls
              ? linkData.urls
              : linkData.url
                ? [linkData.url]
                : [];
          if (searchbarRef.current) {
            searchbarRef.current.openUrls(urls);
          } else {
            urls.forEach(url => window.open(url, '_blank'));
          }
          return;
        }

        // Fallback: Find link in teams data
        const idParts = linkId.split('-');
        if (idParts.length >= 10) {
          const containerId = idParts.slice(0, 5).join('-');
          const snippetId = idParts.slice(5).join('-');

          for (const team of teams || []) {
            for (const ws of team.workspaces || []) {
              // Check workspace-level snippets
              if (ws.workspace_id === containerId) {
                for (const snippet of ws.workspace_snippets || []) {
                  const uid = (snippet as any).snippet_id ?? (snippet as any).id;
                  if (uid === snippetId) {
                    const category = (snippet.category || '').toLowerCase();
                    if (category === 'link') {
                      // Check if it's a multi-link JSON pretending to be a single link
                      let isMulti = false;
                      try {
                        const parsed = JSON.parse(snippet.value as string);
                        if (parsed && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                          if (searchbarRef.current) {
                            searchbarRef.current.openUrls(parsed.urls);
                          } else {
                            parsed.urls.forEach((url: string) => window.open(url, '_blank'));
                          }
                          isMulti = true;
                        }
                      } catch { }

                      if (!isMulti) {
                        if (searchbarRef.current) {
                          searchbarRef.current.openUrls([snippet.value as string]);
                        } else {
                          window.open(snippet.value as string, '_blank');
                        }
                      }
                      return;
                    } else if (category === 'tabgroup' || category === 'tab group') {
                      try {
                        let val: any = snippet.value;
                        if (typeof val === 'string') {
                          try {
                            val = JSON.parse(val);
                          } catch {
                            val = { names: [], urls: [] };
                          }
                        }
                        const urls = Array.isArray(val?.urls) ? val.urls : [];
                        if (urls.length > 0) {
                          if (searchbarRef.current) {
                            searchbarRef.current.openUrls(urls);
                          } else {
                            urls.forEach((url: string) => window.open(url, '_blank'));
                          }
                          return;
                        }
                      } catch { }
                    }
                  }
                }
              }

              // Check folder snippets
              for (const folder of ws.folders || []) {
                if (folder.folder_id === containerId) {
                  for (const snippet of folder.snippets || []) {
                    const uid = (snippet as any).snippet_id ?? (snippet as any).id;
                    if (uid === snippetId) {
                      const category = (snippet.category || '').toLowerCase();
                      if (category === 'link') {
                        // Check if it's a multi-link JSON pretending to be a single link
                        let isMulti = false;
                        try {
                          const parsed = JSON.parse(snippet.value as string);
                          if (parsed && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                            if (searchbarRef.current) {
                              searchbarRef.current.openUrls(parsed.urls);
                            } else {
                              parsed.urls.forEach((url: string) => window.open(url, '_blank'));
                            }
                            isMulti = true;
                          }
                        } catch { }

                        if (!isMulti) {
                          if (searchbarRef.current) {
                            searchbarRef.current.openUrls([snippet.value as string]);
                          } else {
                            window.open(snippet.value as string, '_blank');
                          }
                        }
                        return;
                      } else if (category === 'tabgroup' || category === 'tab group') {
                        try {
                          let val: any = snippet.value;
                          if (typeof val === 'string') {
                            try {
                              val = JSON.parse(val);
                            } catch {
                              val = { names: [], urls: [] };
                            }
                          }
                          const urls = Array.isArray(val?.urls) ? val.urls : [];
                          if (urls.length > 0) {
                            if (searchbarRef.current) {
                              searchbarRef.current.openUrls(urls);
                            } else {
                              urls.forEach((url: string) => window.open(url, '_blank'));
                            }
                            return;
                          }
                        } catch { }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return;
      }

      // Check notes hotkeys
      const matchedNote = Object.entries(cachedNoteHotkeys).find(([key, hk]) => {
        if (hk !== pressedHotkey) return false;
        // Check for org-scoped hotkey
        if (key.includes(':')) {
          const [teamId] = key.split(':');
          return teamId === selectedTeam?.team_id;
        }
        return true;
      });

      if (matchedNote) {
        const rawId = matchedNote[0];
        const noteId = rawId.includes(':') ? rawId.split(':')[1] : rawId;
        
        e.preventDefault();
        e.stopPropagation();

        // Find the note in teams data and select it
        const idParts = noteId.split('-');
        if (idParts.length >= 10) {
          const containerId = idParts.slice(0, 5).join('-');
          const snippetId = idParts.slice(5).join('-');

          for (const team of teams || []) {
            for (const ws of team.workspaces || []) {
              // Check workspace-level snippets
              if (ws.workspace_id === containerId) {
                for (const snippet of ws.workspace_snippets || []) {
                  const uid = (snippet as any).snippet_id ?? (snippet as any).id;
                  if (uid === snippetId) {
                    const category = (snippet.category || '').toLowerCase();

                    // Safeguard: Check if this "Note" hotkey is actually a Link or Tab Group
                    if (category === 'link') {
                      // Check if it's a multi-link JSON pretending to be a single link
                      let isMulti = false;
                      try {
                        const parsed = JSON.parse(snippet.value as string);
                        if (parsed && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                          if (searchbarRef.current) {
                            searchbarRef.current.openUrls(parsed.urls);
                          } else {
                            parsed.urls.forEach((url: string) => window.open(url, '_blank'));
                          }
                          isMulti = true;
                        }
                      } catch { }

                      if (!isMulti) {
                        if (searchbarRef.current) {
                          searchbarRef.current.openUrls([snippet.value as string]);
                        } else {
                          window.open(snippet.value as string, '_blank');
                        }
                      }
                      return;
                    } else if (category === 'tabgroup' || category === 'tab group' || category === 'links') {
                      try {
                        let val: any = snippet.value;
                        if (typeof val === 'string') {
                          try {
                            val = JSON.parse(val);
                          } catch {
                            val = { names: [], urls: [] };
                          }
                        }
                        const urls = Array.isArray(val?.urls) ? val.urls : [];
                        if (urls.length > 0) {
                          if (searchbarRef.current) {
                            searchbarRef.current.openUrls(urls);
                          } else {
                            urls.forEach((url: string) => window.open(url, '_blank'));
                          }
                          return;
                        }
                      } catch { }
                      return;
                    }

                    // Found the note - open it using viewSnippet action
                    dispatch(setSelectedTeam(team));
                    dispatch(
                      viewSnippet({
                        snippet,
                        breadcrumb: {
                          workspace_id: ws.workspace_id,
                          workspace_name: ws.workspace_name,
                          folder_id: null,
                          folder_name: null,
                        },
                      }),
                    );
                    return;
                  }
                }
              }

              // Check folder snippets
              for (const folder of ws.folders || []) {
                if (folder.folder_id === containerId) {
                  for (const snippet of folder.snippets || []) {
                    const uid = (snippet as any).snippet_id ?? (snippet as any).id;
                    if (uid === snippetId) {
                      const category = (snippet.category || '').toLowerCase();

                      // Safeguard: Check if this "Note" hotkey is actually a Link or Tab Group
                      if (category === 'link') {
                        // Check if it's a multi-link JSON pretending to be a single link
                        let isMulti = false;
                        try {
                          const parsed = JSON.parse(snippet.value as string);
                          if (parsed && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                            if (searchbarRef.current) {
                              searchbarRef.current.openUrls(parsed.urls);
                            } else {
                              parsed.urls.forEach((url: string) => window.open(url, '_blank'));
                            }
                            isMulti = true;
                          }
                        } catch { }

                        if (!isMulti) {
                          if (searchbarRef.current) {
                            searchbarRef.current.openUrls([snippet.value as string]);
                          } else {
                            window.open(snippet.value as string, '_blank');
                          }
                        }
                        return;
                      } else if (category === 'tabgroup' || category === 'tab group') {
                        try {
                          let val: any = snippet.value;
                          if (typeof val === 'string') {
                            try {
                              val = JSON.parse(val);
                            } catch {
                              val = { names: [], urls: [] };
                            }
                          }
                          const urls = Array.isArray(val?.urls) ? val.urls : [];
                          if (urls.length > 0) {
                            if (searchbarRef.current) {
                              searchbarRef.current.openUrls(urls);
                            } else {
                              urls.forEach((url: string) => window.open(url, '_blank'));
                            }
                            return;
                          }
                        } catch { }
                        return;
                      }

                      // Found the note - open it using viewSnippet action
                      dispatch(setSelectedTeam(team));
                      dispatch(
                        viewSnippet({
                          snippet,
                          breadcrumb: {
                            workspace_id: ws.workspace_id,
                            workspace_name: ws.workspace_name,
                            folder_id: folder.folder_id,
                            folder_name: folder.folder_name,
                          },
                        }),
                      );
                      return;
                    }
                  }
                }
              }
            }
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleHotkeyDown);
    return () => {
      window.removeEventListener('keydown', handleHotkeyDown);
      chromeAny?.storage?.onChanged?.removeListener(handleStorageChange);
    };
  }, [teams, selectedTeam, dispatch, isKeystrokeRecordingActive]);

  // Handle global chrome command for focus
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (isKeystrokeRecordingActive()) {
        const active = document.activeElement as HTMLElement;
        if (active) {
          if (message && message.type === 'tasklabs:focus-search') {
            active.dispatchEvent(
              new KeyboardEvent('keydown', { key: 's', altKey: true, bubbles: true, cancelable: true }),
            );
          } else if (message && message.type === 'tasklabs:open-create-menu') {
            active.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'c', altKey: true, bubbles: true, cancelable: true }),
            );
          }
        }
        return;
      }

      if (message && message.type === 'tasklabs:force-board-view') {
        window.focus();
        setTimeout(() => {
          handleAltSInitialization(true);
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 100);
      } else if (message && message.type === 'tasklabs:focus-search') {
        window.focus(); // Vital to steal focus back from Omnibox
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 100);
      } else if (message && message.type === 'focus_sheet_ui_first_column') {
        window.focus(); // Vital to steal focus back from Omnibox

        // Step 1: Trigger Alt+K behavior first to violently steal focus from the Omnibox
        if (searchbarRef.current) {
          searchbarRef.current.focus();
        }

        // Step 2: Trigger Alt+A behavior
        setTimeout(() => {
          handleOpenSheetUI();
          // Let SheetTable's internal logic handle focusing the first data row or search
          useGridStore.getState().setSelectedCell({ rowIndex: 0, colIndex: 0 });
        }, 50);
      } else if (message && message.type === 'tasklabs:open-create-menu') {
        window.focus(); // Vital to steal focus back from Omnibox
        dismissAllViews('SHORTCUT_CREATE_MENU');
        if (!isEditorDirty) {
          setTimeout(() => {
            if (searchbarRef.current) {
              searchbarRef.current.focus();
            }
            setIsGlobalCreateMenuOpen(true);
          }, 100);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
    return undefined;
  }, [dispatch, dismissAllViews, handleAltSInitialization]);

  // Proactively track focus state and persist it to chrome.storage.local.
  // This is far more reliable than calling document.hasFocus() at keypress time
  // because the act of pressing Alt+C can itself briefly change focus state.
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    let blurTimeout: any;

    const reportFocus = (hasFocus: boolean) => {
      // Use the per‑tab key (focusKey) defined earlier
      chromeAny.storage.local.set({ [focusKey]: hasFocus });
    };

    // SAFETY: Immediately reset to false on every fresh page load.
    reportFocus(false);

    // After a short delay, read the real focus state.
    const initTimer = setTimeout(() => {
      reportFocus(document.hasFocus());
    }, 200);

    const onFocus = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      reportFocus(true);
    };

    const onBlur = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      // Delay reporting blur by 300ms to avoid false negatives from Alt key combinations
      blurTimeout = setTimeout(() => {
        reportFocus(false);
      }, 300);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      clearTimeout(initTimer);
      if (blurTimeout) clearTimeout(blurTimeout);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      // Clean up the flag when this tab unmounts
      if (focusKey) chromeAny.storage.local.remove(focusKey);
    };
  }, [focusKey]);

  // Automatically focus our custom search bar when the new-tab page is opened/rendered

  // Also force window focus to ensure keyboard events (hotkeys) are captured immediately
  useEffect(() => {
    // Force window focus to capture keyboard events immediately
    // This ensures hotkeys work without needing to click on the page first
    window.focus();

    const enterTimeout = window.setTimeout(() => {
      if (searchbarRef.current && !isModalOpen()) {
        searchbarRef.current.focus();
      }
    }, 60); // Match AltS delay (60ms)

    // Listen for visibility changes to recapture focus when the tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.focus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (enterTimeout !== undefined) {
        window.clearTimeout(enterTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isModalOpen]);

  // Load cached data on mount, then fetch fresh data once auth is resolved.
  // We wait for authChecked=true to ensure userId is the real user ID (not 'local_user' placeholder)
  // before attempting to fetch cloud data.
  const hasInitialized = useRef(false);
  useEffect(() => {
    // Wait until getUserId() has resolved so we have the real userId
    if (!authChecked) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Reset stuck editor states on fresh tab load / refresh if not triggered by URL parameters
    const hasUrlTrigger = typeof window !== 'undefined' && (window as any).__hasUrlTrigger;
    if (!hasUrlTrigger) {
      
      dispatch(clearEditorStates());
    } else {
      
    }

    const initializeData = async () => {
      // Step 1: Load cached data from storage (don't use strict freshness check)
      // We want to show cached data for instant UI regardless of age
      const storageResult = await new Promise<{ myCachedAllData?: Team[]; selectedTeamId?: string }>(resolve => {
        chrome.storage.local.get(['myCachedAllData', 'selectedTeamId'], result => resolve(result));
      });

      const cachedData = storageResult.myCachedAllData;
      const selectedOrgId = storageResult.selectedTeamId || cachedData?.[0]?.team_id || null;

      // Show cached data immediately for instant UI
      if (cachedData && cachedData.length > 0) {
        setTeams(cachedData);
        dispatch(setData(cachedData)); // ✅ Populate Redux for children components

        // If we have a saved team ID, restore it now
        if (storageResult.selectedTeamId === NONE_TEAM.team_id) {
          const personalId = cachedData.find(t => t.is_personal_space)?.team_id;
          dispatch(setSelectedTeam({ ...NONE_TEAM, team_id: personalId || NONE_TEAM.team_id }));
        } else if (storageResult.selectedTeamId) {
          const team = cachedData.find(t => t.team_id === storageResult.selectedTeamId);
          if (team) dispatch(setSelectedTeam(team));
        }

        setDataLoaded(true);
      } else {
        // If there's no cached data at all, we must force fetch to load the user's data
        if (isLoggedIn) {
          await dispatch(fetchAllDataThunk());
        } else {
          setDataLoaded(true);
        }
        return;
      }

      // Step 2: Check if we have an org ID to check counter
      if (!selectedOrgId) {
        // No org ID available - need to fetch all data (first time user)
        if (isLoggedIn) dispatch(fetchAllDataThunk());
        return;
      }

      // Step 3: Check refresh counter BEFORE deciding to fetch
      const { needsRefresh, remoteCounters } = await checkIfRefreshNeeded([selectedOrgId]);

      if (needsRefresh) {
        if (isLoggedIn) await dispatch(fetchAllDataThunk());
        // Save the remote counter after successful fetch
        if (isLoggedIn) await saveCounters(remoteCounters);
      } else {
        // We already have cached data loaded above, no need to fetch
      }
    };

    if (isLoggedIn) {
      initializeData();
    }
  }, [dispatch, isLoggedIn, authChecked]); // Re-run when auth resolves so real userId is used

  // Trigger data fetch in the background without blocking UI
  const backgroundRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const backgroundRefresh = useCallback(() => {
    try {
      // Clear any previous pending refresh
      if (backgroundRefreshTimeoutRef.current) {
        clearTimeout(backgroundRefreshTimeoutRef.current);
      }

      // Set a debounce timeout of 1.5 seconds
      backgroundRefreshTimeoutRef.current = setTimeout(async () => {
        try {
          const selectedOrgId = selectedTeam?.team_id;

          // Check counters before fetching
          if (selectedOrgId) {
            const { needsRefresh, remoteCounters } = await checkIfRefreshNeeded([selectedOrgId]);

            if (!needsRefresh) {
              return;
            }

            if (isLoggedIn) await dispatch(fetchAllDataThunk());
            // Save the remote counter after successful fetch
            if (isLoggedIn) await saveCounters(remoteCounters);
          } else {
            // Fallback if no org selected, triggering unconditional refresh
            if (isLoggedIn) await dispatch(fetchAllDataThunk());
          }
        } catch (err) {
          console.error('Background refresh failed:', err);
        }
      }, 1500);
    } catch (err) {
      console.error('Error in background refresh:', err);
    }
  }, [dispatch, selectedTeam?.team_id, isLoggedIn]);

  // Ref to track the stringified version of allData to prevent infinite storage loops
  const previousAllDataRef = useRef<string | null>(null);

  // Listen for changes to myCachedAllData and persist:uiState from other tabs
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.myCachedAllData) {
          const newValue = changes.myCachedAllData.newValue;
          if (newValue && Array.isArray(newValue)) {
            const newStr = JSON.stringify(newValue);
            if (newStr !== previousAllDataRef.current) {
              
              previousAllDataRef.current = newStr;
              setTeams(newValue);
              dispatch(setData(newValue));
            }
          }
        }
        if (changes['persist:uiState']) {
          try {
            const newValue = changes['persist:uiState'].newValue;
            if (newValue) {
              const parsed = JSON.parse(newValue);
              if (parsed && parsed.showTodosView !== undefined) {
                const isTodosOpen = parsed.showTodosView === 'true' || parsed.showTodosView === true;
                // We use a small timeout or just dispatch directly. Redux will update if different.
                dispatch(setShowTodosView(isTodosOpen));
              }
            }
          } catch (e) {
            console.error('[App] Failed to parse persist:uiState for cross-tab sync', e);
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [dispatch]);

  // Trigger background refresh when the selected team changes
  useEffect(() => {
    if (selectedTeam?.team_id) {
      backgroundRefresh();
    }
  }, [selectedTeam?.team_id, backgroundRefresh]);

  // Trigger background refresh when the tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        backgroundRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [backgroundRefresh]);

  // Update teams when allData changes, but keep our existing state
  useEffect(() => {
    if (allData) {
      setTeams(allData);
      const newStr = JSON.stringify(allData);
      if (newStr !== previousAllDataRef.current) {
        previousAllDataRef.current = newStr;
        chrome.storage.local.set({ myCachedAllData: allData });
      }
      setDataLoaded(true);
    }
  }, [allData]);

  // Track if we've completed the initial restore to avoid clearing user navigation
  const hasCompletedInitialRestore = useRef(false);

  // After data is loaded, restore the complete state hierarchy
  useEffect(() => {
    if (!dataLoaded || teams.length === 0) return;

    // Find the selected team in the current data
    let currentTeam: Team | undefined;
    if (selectedTeam?.team_id === NONE_TEAM.team_id || selectedTeam?.team_name === 'None') {
      // Already set to None, nothing to do
      hasCompletedInitialRestore.current = true;
      return;
    }

    if (selectedTeam) {
      currentTeam = teams.find(team => team.team_id === selectedTeam.team_id);
    } else if (teams.length > 0) {
      // Default to first team if none selected
      currentTeam = teams[0];
    }

    if (currentTeam) {
      if (currentTeam.team_id !== selectedTeam?.team_id) {
        dispatch(setSelectedTeam(currentTeam));
      }

      // Only restore workspace if there's an active editing session (snippetBreadCrum exists)
      // OR if this is not the initial restore (user has navigated)
      let currentWorkspace: Workspace | undefined;

      if (snippetBreadCrum?.workspace_id && currentTeam.workspaces) {
        // Restore from breadcrumb (editing session or previous navigation)
        currentWorkspace = currentTeam.workspaces.find(
          workspace => workspace.workspace_id === snippetBreadCrum.workspace_id,
        );
      } else if (hasCompletedInitialRestore.current && selectedWorkspace && currentTeam.workspaces) {
        // After initial restore, preserve user's workspace navigation
        currentWorkspace = currentTeam.workspaces.find(
          workspace => workspace.workspace_id === selectedWorkspace.workspace_id,
        );
      }

      if (currentWorkspace && snippetBreadCrum) {
        if (currentWorkspace.workspace_id !== selectedWorkspace?.workspace_id) {
          dispatch(setSelectedWorkspace(currentWorkspace));
        }

        const folder = currentWorkspace.folders.find(f => f.folder_id === snippetBreadCrum.folder_id);

        if (folder) {
          if (folder.folder_id !== selectedFolder?.folder_id) {
            dispatch(setSelectedFolder(folder));
          }

          if (selectedSnippet && folder.snippets) {
            const currentSnippet = (folder.snippets ?? []).find(s => s.id === selectedSnippet.id);
            if (currentSnippet && currentSnippet.id !== selectedSnippet.id) {
              dispatch(setSelectedSnippet(currentSnippet));
            }
          }
        } else {
          if (selectedFolder !== null) {
            dispatch(setSelectedFolder(null));
          }
        }
      } else if (currentWorkspace && hasCompletedInitialRestore.current) {
        // Preserve workspace navigation after initial load
        if (currentWorkspace.workspace_id !== selectedWorkspace?.workspace_id) {
          dispatch(setSelectedWorkspace(currentWorkspace));
        }
      } else if (!hasCompletedInitialRestore.current) {
        // On initial load with no active session – show Home view by default
        if (selectedWorkspace !== null) {
          dispatch(setSelectedWorkspace(null));
        }
        if (selectedFolder !== null) {
          dispatch(setSelectedFolder(null));
        }
        if (selectedSnippet !== null) {
          dispatch(setSelectedSnippet(null));
        }
        if (snippetBreadCrum !== null) {
          dispatch(setSnippetBreadCrum(null));
        }
      }

      // Mark initial restore as complete
      hasCompletedInitialRestore.current = true;
    }
  }, [
    dataLoaded,
    teams,
    dispatch,
    selectedTeam?.team_id,
    selectedWorkspace?.workspace_id,
    snippetBreadCrum,
    selectedSnippet?.id,
  ]);
  const [commandListCategory, setCommandListCategory] = useState<string>('commands');
  const [activeCommandSection, setActiveCommandSection] = useState<string>('local');
  const [organizationHandlers, setOrganizationHandlers] = useState<{
    onOrganizationSettings: (orgId: string, orgName: string) => void;
    onCreateOrganization: () => void;
    onWorkspaceShare: (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => void;
  } | null>(null);
  const [isHoveringFavsArea, setIsHoveringFavsArea] = useState(false);

  const toggleSidebar = useCallback(() => {
    dispatch(setIsSidebarCollapsed(!isSidebarCollapsed));
  }, [dispatch, isSidebarCollapsed]);

  const handleToggleBoardView = useCallback(() => {
    setIsBoardViewEnabled(prev => !prev);
  }, []);

  const handleCloseSheetUI = useCallback(() => {
    setIsSheetUIOpen(false);
    const isOrgView =
      mainView.kind === 'organizationSettings' ||
      mainView.kind === 'createOrganization' ||
      mainView.kind === 'workspaceShare';

    if (!isOrgView) {
      dispatch(setIsSidebarCollapsed(false));
      setTimeout(() => dispatch(setIsSidebarCollapsed(true)), 0);
    }
  }, [dispatch, mainView.kind]);

  const handleBoardViewRedirectFromSheet = useCallback(() => {
    dispatch(navigateToView({ kind: 'home' }));
    setIsSheetUIOpen(false);
    setIsBoardViewEnabled(true);
    setIsInitialAltSFocus(true);
  }, [dispatch]);

  const handleToggleCommandListViewWithState = useCallback(
    (isOpen: boolean) => {
      dispatch(setIsCommandListView(isOpen));
    },
    [dispatch],
  );

  const handleClearCommandListView = useCallback(() => {
    dispatch(setIsCommandListView(false));
  }, [dispatch]);

  const handleSearchbarFocus = useCallback(
    (isUserInitiated?: boolean) => {
      
      if (isUserInitiated) {
        dispatch(setShowTodosView(false));
        if (activeLockedCommand !== 'saved-automation') {
          setIsSheetUIOpen(false);
        }
        if (filterPanelState.isOpen) {
          setFilterPanelState(prev => ({ ...prev, isOpen: false }));
        }
      }
      setIsSidebarSearchFocused(false);

      if (isUserInitiated && mainView.kind === 'home') {
        handleAltSInitialization();
      }
    },
    [dispatch, activeLockedCommand, filterPanelState.isOpen, handleAltSInitialization, mainView.kind],
  );

  const handleOrganizationHandlersReady = useCallback(
    (handlers: any) => {
      setOrganizationHandlers({
        onOrganizationSettings: (orgId, orgName) => {
          setIsSheetUIOpen(false);
          dispatch(setIsSidebarCollapsed(true));
          handlers.onOrganizationSettings(orgId, orgName);
        },
        onCreateOrganization: () => {
          setIsSheetUIOpen(false);
          dispatch(setIsSidebarCollapsed(true));
          handlers.onCreateOrganization();
        },
        onWorkspaceShare: (wsId, wsName, orgId, wsType) => {
          setIsSheetUIOpen(false);
          dispatch(setIsSidebarCollapsed(true));
          handlers.onWorkspaceShare(wsId, wsName, orgId, wsType);
        },
      });
    },
    [dispatch],
  );

  const toggleDarkModeHandler = useCallback(() => {
    // Theme switching is temporarily disabled; keep dark mode enforced.
    dispatch(setDarkMode(true));
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_dark_mode: true, new_tab_is_dark_mode: true });
    }
  }, [dispatch]);

  const handleToggleFavorites = useCallback(() => {
    dispatch(setShowFavorites(!showFavorites));
  }, [dispatch, showFavorites]);

  const handleToggleCommandListView = useCallback(() => {
    dispatch(setIsCommandListView(!isCommandListView));
  }, [dispatch, isCommandListView]);

  const handleToggleFocusMode = useCallback(() => {
    dispatch(toggleFocusMode(!isFocusMode));
  }, [dispatch, isFocusMode]);

  const handleNavigateToListView = useCallback((type: 'notes' | 'links' | 'commands', section?: string) => {
    setIsSheetUIOpen(false);
    dispatch(setIsCommandListView(true));
    setCommandListCategory('commands');
    if (section) {
      setActiveCommandSection(section);
    } else {
      // Fallback mapping if section is not provided
      const sectionMap: Record<string, string> = {
        notes: 'notes',
        links: 'links',
        commands: 'local',
      };
      setActiveCommandSection(sectionMap[type] || 'local');
    }
  }, []);

  // Handle edit link/tab group/prompt from FavoritesPanel (same flow as Container.handleHomeLinkEdit)
  const handleFavoriteLinkEdit = useCallback(
    (item: { snippet: any; workspace: any; folder: any }) => {
      const { snippet, workspace, folder } = item;
      if (!snippet) return;

      const category = (snippet.category || '').toLowerCase();

      // Prompts: navigate to prompt editor
      if (category === 'prompt') {
        dispatch(setSelectedWorkspace(workspace));
        dispatch(setSelectedFolder(folder ?? null));
        dispatch(setSelectedSnippet(snippet));
        dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace?.workspace_id,
            workspace_name: workspace?.workspace_name,
            folder_id: folder?.folder_id || null,
            folder_name: folder?.folder_name || null,
          }),
        );
        dispatch(navigateToView({ kind: 'promptEditor', promptProps: { snippet } }));
        return;
      }

      // Links and tab groups: open LinkEditModal
      dispatch(openLinkEditModal({ editMode: true, snippet }));
    },
    [dispatch],
  );

  // Ref for the main container to capture keyboard focus
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Focus the main container on mount to capture keyboard events immediately
  useEffect(() => {
    // Give the searchbar a chance to autoFocus first.
    // Only focus the container if nothing else is focused.
    const t = window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      const isTextInputFocused =
        !!active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable ||
          active.getAttribute?.('role') === 'textbox');

      if (!mainContainerRef.current) return;
      if (!active || active === document.body) {
        mainContainerRef.current.focus();
      } else if (!isTextInputFocused) {
        mainContainerRef.current.focus();
      }
    }, 120);

    return () => window.clearTimeout(t);
  }, []);

  // Watch for mainView changes to forcefully close the Automation Panel (isSheetUIOpen)
  // so we don't get trapped in a state where AutomationPanel overlays the intended view.
  useEffect(() => {
    
    if (mainView.kind === 'subscriptions' || mainView.kind === 'manageSubscription' || mainView.kind === 'organizationSettings' || mainView.kind === 'generalSettings') {
      // Clean up active editors when transitioning to organization/billing views
      if (selectedSnippet) dispatch(setSelectedSnippet(null));
      if (isCreatingNewItem) dispatch(setIsCreatingNewItem(false));
      if (isLinkEditModalOpen) dispatch(closeLinkEditModal());
    }
    if (isSheetUIOpen || isTemplatesView) {
      if (
        mainView.kind === 'noteEditor' ||
        mainView.kind === 'promptEditor' ||
        mainView.kind === 'todos' ||
        mainView.kind === 'agentPanel' ||
        mainView.kind === 'aiEditor' ||
        mainView.kind === 'linkEditor' ||
        isLinkEditModalOpen
      ) {
        
        setIsSheetUIOpen(false);
        setIsTemplatesView(false);
      }
    }
  }, [mainView.kind, isLinkEditModalOpen, isSheetUIOpen, isTemplatesView, selectedSnippet, isCreatingNewItem, dispatch]);

  // Escape key handler to close organization/billing panels and return to Home
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey) {
        const isOrgOrBillingView =
          mainView.kind === 'subscriptions' ||
          mainView.kind === 'manageSubscription' ||
          mainView.kind === 'organizationSettings' ||
          mainView.kind === 'createOrganization' ||
          mainView.kind === 'sharedFolderCreation' ||
          mainView.kind === 'generalSettings';

        if (isOrgOrBillingView) {
          event.preventDefault();
          event.stopPropagation();
          dispatch(navigateToView({ kind: 'home' }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [mainView.kind, dispatch]);

  // Context-aware Documentation URL

  const getDocumentationUrl = useCallback(
    (lockedCommand: string | null, currentView: any, linkModalOpen: boolean): string => {
      const baseUrl = CMDOS_DOCS_URL;

      // Priority 1: Check locked command (Searchbar explicit lock)
      const docMap: Record<string, string> = {
        note: '/notes',
        fullscreennote: '/notes',
        link: '/links',
        links: '/links',
        prompt: '/notes',
        prompts: '/notes',
        snippet: '/snippets',
        todo: '/todos',
        screenshot: '/screenshots',
        ai: '/commands/ai',
      };

      if (lockedCommand && docMap[lockedCommand]) {
        return `${CMDOS_DOCS_URL}${docMap[lockedCommand]}`;
      }

      // Priority 2: Check Link Edit Modal (Overrides main view if open)
      if (linkModalOpen) {
        return `${CMDOS_DOCS_URL}/links`;
      }

      // Priority 3: Check current main view (Redux state)
      if (currentView) {
        switch (currentView.kind) {
          case 'noteEditor':
            return `${CMDOS_DOCS_URL}/notes`;
          case 'linkEditor':
            return `${CMDOS_DOCS_URL}/links`;
          case 'promptEditor':
            return `${CMDOS_DOCS_URL}/notes`;
          case 'todos':
            return `${CMDOS_DOCS_URL}/todos`;
          case 'store':
            // maybe just docs or specific store docs
            return CMDOS_DOCS_URL;
          case 'allItems':
            if (currentView.itemType === 'notes') return `${CMDOS_DOCS_URL}/notes`;
            if (currentView.itemType === 'links') return `${CMDOS_DOCS_URL}/links`;
            if (currentView.itemType === 'prompts') return `${CMDOS_DOCS_URL}/notes`;
            break;
        }
      }

      return CMDOS_DOCS_URL;
    },
    [],
  );

  const handleLockedCommandChange = useCallback((commandId: string | null) => {
    setActiveLockedCommand(commandId);
  }, []);

  const [autoTriggerDropdown, setAutoTriggerDropdown] = useChromeStorage<boolean>('rtq_focus_on', true);


  // Load initial Todo open state from localStorage
  useEffect(() => {
    const persistedState = localStorage.getItem('show_todos_panel');
    if (persistedState === 'true') {
      dispatch(setShowTodosView(true));
    }
  }, [dispatch]);

  // Save Todo open state to localStorage
  useEffect(() => {
    localStorage.setItem('show_todos_panel', showTodosView ? 'true' : 'false');
  }, [showTodosView]);

  const handleOpenSubscriptions = useCallback(() => {
    dispatch(navigateToView({ kind: 'subscriptions' }));
  }, [dispatch]);

  const handleOpenManageSubscription = useCallback(() => {
    dispatch(navigateToView({ kind: 'manageSubscription' }));
  }, [dispatch]);

  const handleOpenGeneralSettings = useCallback(() => {
    dispatch(navigateToView({ kind: 'generalSettings' }));
  }, [dispatch]);

  const showSidebarColumn = isLoggedIn && !isFocusMode;


  if (!authChecked) {
    return (
      <DndProvider backend={HTML5Backend}>
        <div
          className="flex h-screen text-neutral-900 !rounded-none dark:!rounded-none dark:text-white relative overflow-hidden outline-none bg-[var(--color-rootBg)]"
        />
      </DndProvider>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        ref={mainContainerRef}
        tabIndex={-1}
        className="flex h-screen text-neutral-900 !rounded-none dark:!rounded-none dark:text-white relative overflow-hidden outline-none bg-[var(--color-rootBg)]">
        <WallpaperLayer />
        <div id="ai-history-anchor" />
        {/* Global Branding & Controls - Always visible in top left */}
        <div className="absolute top-0 left-0 w-[280px] p-2.5 z-[10000] pointer-events-auto flex items-center justify-between">
          <Branding
            className="!p-0 !gap-1.5"
            showAvatar={false}
            onClick={() => {
              if (isSheetUIOpen) setIsSheetUIOpen(false);
            }}
          />
          {!isFocusMode && !isTutorialActive && !activeTutorial && (
            <div style={{ filter: hasActivePopup ? 'blur(1px)' : 'none', transition: 'filter 0.3s ease' }}>
              <HeaderControls
                isSidebarCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
                showFavorites={showFavorites}
                onToggleFavorites={handleToggleFavorites}
                isNewTabEnabled={isNewTabEnabled}
                onToggleNewTab={handleToggleNewTab}
                isCommandListView={isCommandListView}
                onToggleCommandListView={handleToggleCommandListView}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkModeHandler}
                isFocusMode={isFocusMode}
                onToggleFocusMode={handleToggleFocusMode}
                isLoggedIn={isLoggedIn && userId !== 'local_user'}
                direction="down"
                showTutorialButton={showTutorialButton}
                onTutorialClick={handleTutorialClick}
                onOpenSubscriptions={handleOpenSubscriptions}
                onOpenManageSubscription={handleOpenManageSubscription}
                onCommandListCategoryChange={setCommandListCategory}
                commandListCategory={commandListCategory}
                isBoardViewEnabled={isBoardViewEnabled}
                onToggleBoardView={() => setIsBoardViewEnabled(!isBoardViewEnabled)}
                onOpenGeneralSettings={handleOpenGeneralSettings}
                onOpenOrganizationSettings={(orgId, orgName) => {
                  organizationHandlers?.onOrganizationSettings(orgId, orgName);
                }}
              />
            </div>
          )}
        </div>

        {/* Global Tutorial Overlay - Centralized only for Sidebar & Favorites (Steps 2 & 4) */}
        <AnimatePresence>
          {activeTutorial && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9990] bg-[var(--color-editorBg)]/80 pointer-events-auto"
              onClick={() => {
                dispatch(setActiveTutorial(null));
                const chromeAny = (window as any)?.chrome;
                if (chromeAny?.storage?.local) {
                  chromeAny.storage.local.set({
                    tutorial_watched: true,
                    app_tutorial_progress: {
                      search: true,
                      favorites: true,
                      agent: true,
                      sidebar: true,
                      touchpoints: true,
                    },
                  });
                }
                window.dispatchEvent(new CustomEvent('TutorialFinished'));
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeTutorial && ['search', 'favorites', 'agent', 'sidebar', 'touchpoints'].includes(activeTutorial) && (
            <TutorialDashboard
              onClose={() => dispatch(setActiveTutorial(null))}
              isLoggedIn={isLoggedIn}
            />
          )}
        </AnimatePresence>

        {/* Left Sidebar: Favorites Panel or SnippetSidebarPanel */}
        {showSidebarColumn && !isTutorialActive && (
          <div
            className={`h-full shrink-0 flex flex-col pt-[56px] border-r border-neutral-200 dark:border-white/10 shadow-2xl
              ${activeTutorial === 'favorites' || activeTutorial === 'sidebar' ? 'z-[9999]' : 'z-30'}
              bg-[var(--color-sidebarBg)]
            `}
            style={{
              width: '280px',
              filter: hasActivePopup ? 'blur(1px)' : 'none',
              transition: 'filter 0.3s ease',
            }}>
            <FavoritesPanel
              reload={backgroundRefresh}
              isDarkMode={isDarkMode}
              isSidebar={true}
              onCommandSelect={commandId => {
                
                const isOrgOrBillingView =
                  mainView.kind === 'subscriptions' ||
                  mainView.kind === 'manageSubscription' ||
                  mainView.kind === 'organizationSettings';
                if (commandId === 'collections') {
                  if (isOrgOrBillingView) {
                    dispatch(navigateToView({ kind: 'home' }));
                  }
                  handleOpenSheetUI('collections');
                  return;
                }
                const mode =
                  commandId === 'saved-automation' || commandId === 'store' || commandId === 'ai'
                    ? 'lock'
                    : 'execute';
                if (isOrgOrBillingView) {
                  dispatch(navigateToView({ kind: 'home' }));
                  dispatch(setPendingLockedCommand({ commandId, mode }));
                } else if (searchbarRef.current) {
                  searchbarRef.current.clear();
                  setTimeout(() => {
                    searchbarRef.current?.executeCommand(commandId as any, { mode });
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onAutomationSelect={automation => {
                const isOrgOrBillingView =
                  mainView.kind === 'subscriptions' ||
                  mainView.kind === 'manageSubscription' ||
                  mainView.kind === 'organizationSettings';
                setIsSheetUIOpen(false);
                setIsTemplatesView(false);
                if (isOrgOrBillingView) {
                  dispatch(navigateToView({ kind: 'home' }));
                  dispatch(setPendingAutomation(automation));
                } else if (searchbarRef.current) {
                  searchbarRef.current.clear();
                  setTimeout(() => {
                    searchbarRef.current?.activateAutomation(automation);
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onSelectSavedAgent={agent => {
                
                const isOrgOrBillingView =
                  mainView.kind === 'subscriptions' ||
                  mainView.kind === 'manageSubscription' ||
                  mainView.kind === 'organizationSettings' ||
                  mainView.kind === 'generalSettings';
                setIsSheetUIOpen(false);
                setIsTemplatesView(false);

                const candidateIds = [
                  agent?.id,
                  agent?.automation_id,
                  agent?.automation?.id,
                  agent?.automation?.automation_id,
                ]
                  .map(val => String(val || ''))
                  .filter(Boolean);

                const resolvedAgent = candidateIds.map(id => savedAgentById.get(id)).find(Boolean) || agent;

                if (isOrgOrBillingView) {
                  dispatch(navigateToView({ kind: 'home' }));
                  dispatch(setPendingAgent(resolvedAgent));
                } else if (searchbarRef.current) {
                  setTimeout(() => {
                    searchbarRef.current?.selectSavedAgent(resolvedAgent);
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onNavigateToListView={(type, section) => {
                const isOrgOrBillingView =
                  mainView.kind === 'subscriptions' ||
                  mainView.kind === 'manageSubscription' ||
                  mainView.kind === 'organizationSettings' ||
                  mainView.kind === 'generalSettings';
                if (isOrgOrBillingView) {
                  dispatch(navigateToView({ kind: 'home' }));
                }
                handleNavigateToListView(type, section);
              }}
              onRequestEditLink={handleFavoriteLinkEdit}
            />
          </div>
        )}

        {/* Main Content Area (Rich Text Editor) */}
        <div
          className={`flex-1 flex flex-col text-neutral-900 dark:text-white min-w-0 w-full h-full relative ${isViewDropdownOpen ? 'z-[50]' : (activeTutorial === 'search' || activeTutorial === 'agent' ? '' : 'z-0')} transition-opacity duration-300 ${isFullScreenModalOpen && theme.wallpaper ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={{
            filter: (hasActivePopup && !isLinkEditModalOpen && mainView?.kind !== 'noteEditor' && mainView?.kind !== 'promptEditor' && mainView?.kind !== 'agentPanel') ? 'blur(1px)' : 'none',
            transition: 'filter 0.3s ease'
          }}>
          <Container
            onTutorialVisibilityChange={setIsTutorialActive}
            onSuggestionStateChange={setSuggestionState}
            showSidebarColumn={showSidebarColumn}
            isBoardViewEnabled={isBoardViewEnabled}
            onToggleBoardView={handleToggleBoardView}
            isInitialAltSFocus={isInitialAltSFocus}
            onInitialAltSFocusChange={setIsInitialAltSFocus}
            isLoggedIn={isLoggedIn}
            teams={teams}
            reload={backgroundRefresh}
            searchbarRef={searchbarRef}
            isSheetUIOpen={isSheetUIOpen}
            onOpenSheetUI={handleOpenSheetUI}
            onCreateWorkspace={handleCreateWorkspace}
            onCloseSheetUI={handleCloseSheetUI}
            onBoardViewRedirect={handleBoardViewRedirectFromSheet}
            onMenuStateChange={setIsSearchMenuOpen}
            onBoardViewOpenChange={setIsBoardViewOpen}
            onShortcutBoardView={() => {
              dispatch(navigateToView({ kind: 'home' }));
              setIsBoardViewEnabled(true);
              setIsInitialAltSFocus(true);
              const chromeAny = (window as any)?.chrome;
              if (chromeAny?.storage?.local) {
                chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
              }
            }}
            onShortcutCreateMenu={() => {
              dispatch(navigateToView({ kind: 'home' }));
              setIsGlobalCreateMenuOpen(true);
            }}
            onAutomationActiveChange={setIsAutomationActive}
            isCommandListView={isCommandListView}
            onToggleCommandListView={handleToggleCommandListViewWithState}
            onClearCommandListView={handleClearCommandListView}
            commandListCategory={commandListCategory}
            onCommandListCategoryChange={setCommandListCategory}
            activeCommandSection={activeCommandSection}
            onCommandSectionChange={setActiveCommandSection}
            isTemplatesView={isTemplatesView}
            onToggleTemplatesView={setIsTemplatesView}
            templatesCategory={templatesCategory}
            onTemplatesCategoryChange={setTemplatesCategory}
            onOrganizationHandlersReady={handleOrganizationHandlersReady}
            onOrganizationPanelChange={handleOrganizationPanelChange}
            onNavigateToListView={handleNavigateToListView}
            hideMainContent={
              isSheetUIOpen ||
              (isSidebarSearchFocused && !selectedSnippet && !isCreatingNewItem && !isLinkEditModalOpen) ||
              filterPanelState.isOpen ||
              (!!activeLockedCommand &&
                activeLockedCommand !== 'ai' &&
                activeLockedCommand !== 'store' &&
                activeLockedCommand !== 'saved-automation') ||
              isSearchMenuOpen
            }
            onLockedCommandChange={handleLockedCommandChange}
            onSearchbarFocus={handleSearchbarFocus}
            showTutorialTrigger={showTutorialTrigger}
            onTutorialTriggerConsumed={handleTutorialTriggerConsumed}
            onHoverSlashDot={() => setIsViewDropdownOpen(true)}
          />

          {!isFocusMode && !isTutorialActive && (
            <div className="absolute top-4 right-4 z-[9999] flex flex-row items-center gap-2 pointer-events-auto">

              {!isTemplatesView &&
                !isSheetUIOpen &&
                !isCreatingNewItem &&
                !selectedSnippet &&
                mainView?.kind !== 'noteEditor' &&
                mainView?.kind !== 'promptEditor' &&
                mainView?.kind !== 'agentPanel' &&
                mainView?.kind !== 'aiEditor' &&
                mainView?.kind !== 'searchSuggestions' ? (
                <>
                  {mainView?.kind === 'home' && isLoggedIn && (
                    <div className="flex items-center gap-2">
                      {!(
                        suggestionState &&
                        (suggestionState.lockedCommand === 'store' ||
                          suggestionState.lockedCommand === 'saved-automation' ||
                          suggestionState.isVisible !== false) &&
                        !suggestionState.isAtMenuOpen &&
                        !suggestionState.isAutomationActive &&
                        suggestionState.lockedCommand !== 'calendar' &&
                        !isLinkEditModalOpen
                      ) && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleTutorialClick}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/40 dark:border-white/10 hover:border-white/60 dark:hover:border-white/20 bg-frostedwhite/90 dark:bg-neutral-900/80 backdrop-blur-md text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                            title="Start Tutorial">
                            <BsQuestionCircle size={16} />
                          </motion.button>
                        )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {!isFocusMode &&
          !isCommandListView &&
          !isTemplatesView &&
          !orgPanelState.isOpen && (
            <div
              className={`absolute left-0 top-0 h-full pointer-events-none flex flex-col items-start ${activeTutorial === 'favorites' ? 'z-[9999]' : 'z-40'}`}>
              <div
                onMouseEnter={() => setIsHoveringFavsArea(true)}
                onMouseLeave={() => setIsHoveringFavsArea(false)}
                className="pointer-events-auto h-full flex flex-col items-start pt-[14vh] overflow-y-auto overflow-x-hidden scrollbar-none pb-10">
                {/* 1. Favorites Panel (Moved to static left sidebar)
              isLoggedIn &&
                !isSheetUIOpen &&
                (mainView?.kind === 'home' || mainView?.kind === 'searchSuggestions') &&
                !selectedWorkspace &&
                !selectedFolder &&
                !selectedSnippet &&
                !isCreatingNewItem &&
                !isLinkEditModalOpen &&
                !activeLockedCommand &&
                !isAutomationActive && (
                  <FavoritesPanel
                    reload={backgroundRefresh}
                    isDarkMode={isDarkMode}
                    onCommandSelect={commandId => {
                      if (searchbarRef.current) {
                        searchbarRef.current.clear();
                        setTimeout(() => {
                          const mode = commandId === 'saved-automation' || commandId === 'store' || commandId === 'ai' ? 'lock' : 'execute';
                          searchbarRef.current?.executeCommand(commandId as any, { mode });
                          searchbarRef.current?.focus();
                        }, 10);
                      }
                    }}
                    onAutomationSelect={automation => {
                      if (searchbarRef.current) {
                        searchbarRef.current.clear();
                        setTimeout(() => {
                          searchbarRef.current?.activateAutomation(automation);
                          searchbarRef.current?.focus();
                        }, 10);
                      }
                    }}
                    onSelectSavedAgent={agent => {
                      if (searchbarRef.current) {
                        const candidateIds = [
                          agent?.id,
                          agent?.automation_id,
                          agent?.automation?.id,
                          agent?.automation?.automation_id,
                        ]
                          .map(val => String(val || ''))
                          .filter(Boolean);

                        const resolvedAgent = candidateIds.map(id => savedAgentById.get(id)).find(Boolean) || agent;

                        setTimeout(() => {
                          searchbarRef.current?.selectSavedAgent(resolvedAgent);
                          searchbarRef.current?.focus();
                        }, 10);
                      }
                    }}
                    onNavigateToListView={handleNavigateToListView}
                    onRequestEditLink={handleFavoriteLinkEdit}
                  />
                )*/}

                {/* 2. Filter Panel (Now stacks below Favorites instead of replacing it) */}
                {filterPanelState.isOpen && (
                  <div className="flex flex-col mt-4">
                    <FilterPanel
                      orgId={effectiveOrgId}
                      isOpen={filterPanelState.isOpen}
                      onClose={() =>
                        setFilterPanelState(prev => ({
                          ...prev,
                          isOpen: false,
                          filterState: { assignees: [], contentType: 'all' },
                        }))
                      }
                      filterState={filterPanelState.filterState}
                      onFilterChange={newFilterState =>
                        setFilterPanelState(prev => ({ ...prev, filterState: newFilterState }))
                      }
                    />
                  </div>
                )}

                {/* 3. Search Focus Notice (Moved from FavoritesPanel) */}
                {/* {!isOmniboxEnabled &&
                isLoggedIn &&
                !isSheetUIOpen &&
                (mainView?.kind === 'home' || mainView?.kind === 'searchSuggestions') &&
                !selectedWorkspace &&
                !selectedFolder &&
                !selectedSnippet &&
                !isCreatingNewItem &&
                !isLinkEditModalOpen &&
                !activeLockedCommand &&
                !isAutomationActive &&
                isHoveringFavsArea && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-[-1px] rounded-l-xl rounded-t-none border px-3 py-2.5 text-[10px] leading-4 whitespace-normal w-[280px] shadow-sm ${isDarkMode
                      ? 'border-white/10 bg-frostedwhite text-neutral-300'
                      : 'border-[#eee8d5] bg-[#fdf6e3] text-[#586e75]'
                      }`}>
                    Hotkeys work on all websites and in the cmdOS search bar. They won’t work when the browser address
                    bar is focused.{' '}
                    <button
                      onClick={() => setIsHotkeysHelpOpen(true)}
                      className={`transition-colors font-medium border-none bg-transparent p-0 cursor-pointer ${isDarkMode ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
                        }`}>
                      Learn More
                    </button>
                  </motion.div>
                )} */}

                <HotkeysHelpPopup
                  isOpen={isHotkeysHelpOpen}
                  onClose={() => setIsHotkeysHelpOpen(false)}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          )}

        {isCommandListView && (
          <button
            onClick={() => dispatch(setIsCommandListView(false))}
            className="fixed top-10 right-8 z-[60] p-2 rounded-full bg-[var(--color-containerBg)] backdrop-blur-md border border-neutral-200 dark:border-white/10 shadow-lg text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all hover:scale-110 active:scale-95 group"
            title="Close command list">
            <FiX size={20} className="group-hover:rotate-90 transition-transform duration-200" />
          </button>
        )}
        {/* TodoFloatingPreview is now rendered inside CreateTodoSelectionView for perfect vertical alignment */}
      </div>

      <AutomationStatusIndicator />
      <ToastContainer />
      <UnpinConfirmationDialog
        isOpen={showUnpinDialog}
        onClose={() => setShowUnpinDialog(false)}
        onConfirm={handleConfirmUnpin}
      />

      {createWorkspaceModal.isOpen && (
        <CreateWorkspacePopup
          isOpen={createWorkspaceModal.isOpen}
          onClose={() => setCreateWorkspaceModal(prev => ({ ...prev, isOpen: false }))}
          reload={backgroundRefresh}
          defaultAccess={createWorkspaceModal.defaultAccess}
          isPersonalSpace={createWorkspaceModal.isPersonalSpace}
          targetTeamId={createWorkspaceModal.targetTeamId}
        />
      )}

      <GlobalCreateMenuModal
        isOpen={isGlobalCreateMenuOpen}
        onClose={() => setIsGlobalCreateMenuOpen(false)}
        isDarkMode={isDarkMode}
        onCommandSelect={commandId => {
          if (commandId === 'collections') {
            handleOpenSheetUI('collections');
            return;
          }
          if (commandId === 'saved-automation') {
            handleOpenSheetUI('saved-automation');
            return;
          }
          if (commandId === 'createtodo') {
            dispatch(setTodoCreatePrefill({ isCreateModalOnly: true }));
            return;
          }
          if (searchbarRef.current) {
            searchbarRef.current.clear();
            setTimeout(() => {
              const mode = commandId === 'store' || commandId === 'ai' ? 'lock' : 'execute';
              searchbarRef.current?.executeCommand(commandId as any, { mode });
              searchbarRef.current?.focus();
            }, 10);
          }
        }}
      />

      {/* ── Right-Side Todo Panel & Toggle (Hidden when a full-screen modal is open) ── */}
      {!isTutorialActive && (
        <div className={`transition-opacity duration-300 ${isFullScreenModalOpen && theme.wallpaper ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Floating Toggle Button */}
        {isLoggedIn && !showTodosView && !isBoardViewOpen && !isSheetUIOpen && mainView?.kind === 'home' && !isActuallyExpanded && !isTemplatesView && (
          <button
            onClick={() => dispatch(setShowTodosView(true))}
            className={`fixed right-4 top-[14vh] z-[40] flex items-center gap-1.5 hover:gap-3 px-2.5 hover:px-4 py-1.5 rounded-full shadow-lg border transition-all duration-300 ease-out group
              ${isDarkMode
                ? 'bg-[#171821]/95 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/30 hover:shadow-white/5'
                : 'bg-white/95 border-black/10 text-neutral-500 hover:text-black hover:bg-black/5 hover:border-black/20'
              } backdrop-blur-md cursor-pointer`}
            title="Open Todo Workspace">
            <BsCalendarCheck size={14} className="transition-transform duration-200" />
            <span className="text-[11px] font-semibold">Today tasks</span>
          </button>
        )}

        {/* Right Todo Workspace Panel */}
        {(() => {
          const isCreateModalOnly = !!todoCreatePrefill?.isCreateModalOnly;
          return (
            <RightTodoWorkspace
              isOpen={
                isCreateModalOnly ||
                (showTodosView &&
                  mainView?.kind === 'home' &&
                  (!isBoardViewOpen || showTodosView) &&
                  !isSheetUIOpen &&
                  !isActuallyExpanded &&
                  !isTemplatesView)
              }
              onClose={() => {
                if (showTodosView) handleCloseTodosView();
                else dispatch(setTodoCreatePrefill(null));
              }}
              isLoggedIn={isLoggedIn}
              isCreateModalOnly={isCreateModalOnly}
            />
          );
        })()}
        </div>
      )}
    </DndProvider>
  );
};

export default App;
