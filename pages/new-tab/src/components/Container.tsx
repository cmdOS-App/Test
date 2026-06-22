import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { runAutomation, type SavedAutomation as ExecutionAutomation } from '../../../utils/automation';
import clsx from 'clsx';
import type { SavedAutomation } from '../../../modals/interfaces';
import thunder from '../../../assets/thunder.svg';
import AIModelSelectionPanel from './SearchComponents/Searchbar/AIModelSelectionPanel';
import { useSelector, useDispatch, useStore } from 'react-redux';
import { resolveAutomationIconMeta } from './Shared/Icons/AutomationDynamicIcon';
import { extractUrlsFromSnippet } from './SearchComponents/SearchPopup/snippetInteractiveUtils';
import { getFavorites } from '../../../Apis/services/favoritesApi';
import SharedFolderCreationView from './Views/SharedFolderCreationView';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaLink,
  FaNetworkWired,
  FaBook,
  FaPlus,
  FaHashtag,
  FaChevronRight,
  FaChevronLeft,
  FaLayerGroup,
  FaSun,
  FaMoon,
  FaFileAlt,
  FaHome,
  FaChevronDown,
} from 'react-icons/fa';
import { FiCreditCard, FiTerminal, FiSettings, FiCheck, FiLayout } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { AiOutlineEnter } from 'react-icons/ai';
import { BsPinAngle, BsPinAngleFill, BsList, BsGrid, BsTable, BsLayoutSidebarInsetReverse } from 'react-icons/bs';
import CollectionGridView from './Views/CollectionGridView';
import DeleteDialog from './Modals/DeleteDialog';
import HomeView, { type HomeViewHandle } from './Views/HomeView/HomeView';
import AllItemsView from './Views/HomeView/AllItemsView';
import { BuildView } from './Views/BuildView';
import type { SnippetActionDetail } from './Views/HomeView/types';
import type { InteractiveItem } from './Views/HomeView/InteractiveItemsList';
import {
  resolveNodeAction,
  isLinkCategory,
  isNoteCategory,
  isPromptCategory,
  isTabGroupCategory,
} from './Views/HomeView/snippetInteractiveUtils';
import { COMMANDS, AI_GROUP, type CommandId } from './SearchComponents/Searchbar/commands';
import { commandRegistry } from '../commands/registry';
import { CommandContext } from '../commands/types';
import {
  LOCAL_COMMANDS,
  isLocalCommandId,
  LOCAL_COMMAND_EVENTS,
  type WorkspaceActionDetail,
  type FolderActionDetail,
  type LocalCommandId,
} from './SearchComponents/Searchbar/localCommands';
import type { Folder, Snippet, Tabs, Team, Workspace, WorkspaceDetails } from '../../../modals/interfaces';
import { NewSnippetBreadCrum } from '../../../modals/interfaces';
import { RichTextEditor } from './Editor/RichEditor';
import { SnippetEditor } from './Editor/SnippetEditor';
import LinkSidebar from './Editor/LinksSideBar';
import CommandPaletteContainer from './CommandPalette/CommandPaletteContainer';
import BookmarksTable from './SearchComponents/SearchPopup/BookmarksTable';
import TodosList from './Views/todo/TodosList';

import {
  setSelectedWorkspace,
  setSelectedTeam,
  setSelectedSnippet,
  setIsCreatingNewItem,
  setDarkMode,
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectSelectedSnippet,
  selectSnippetBreadCrum,
  selectIsCreatingNewItem,
  selectDarkMode,
  selectViewMode,
  selectDebouncedSearchTerm,
  setDebouncedSearchTerm,
  setSnippetBreadCrum,
  selectIsLinkEditModalOpen,
  selectIsLinkEditMode,
  setScrollToFolderId,
  selectActiveLinkSnippet,
  selectScrollToFolderId,
  closeLinkEditModal,
  openLinkEditModal,
  selectShowTodosView,
  setShowTodosView,
  setSelectedFolder,
  viewSnippet,
  toggleFolder,
  expandAllWorkspaces,
  expandAllFolders,
  selectShowFavorites,
  setShowFavorites,
  setCommandStatus,
  selectCommandStatus,
  selectPendingNotification,
  clearPendingNotification,
  resetCommandStatus,
  selectMainView,
  setMainView,
  navigateToView,
  clearEditorStates,
  selectIsFocusMode,
  selectLinkEditPrefill,
  selectIsMac,
  setTodoCreatePrefill,
  setIsEditorDirty,
  selectIsEditorDirty,
  setDraftAutomation,
  setTodoDraft,
  selectPendingNavigationAction,
  selectShowEditorSwitchWarning,
  setShowEditorSwitchWarning,
} from '../../../Redux/AllData/uiStateSlice';
import { selectAllData, optimisticDeleteSnippet } from '../../../Redux/AllData/allDataSlice';
import TeamSelectionContainer from './Layout/TeamSelectionContainer';
import ShareButton from './Shared/ShareButton';
import { getUserId, syncCounterStats, syncInstalledModulesToStorage } from '../../../Apis/core/api';
import { trackCounterEvent } from '../../../utils/counterTracking';
import LinkEditModal from './Editor/LinkEditModal';
import AgentPanel from './Editor/AgentPanel';
import { deleteSnippet } from '../../../Apis/features/snippetApi';
import { deleteSharedFolder } from '../../../Apis/features/folderApiServices';
import { deleteSWorkspace } from '../../../Apis/features/workspaceApiServices';
import { addFavorite, deleteFavorite } from '../../../Apis/services/favoritesApi';
import { setWorkspacesFromAllData, selectWorkspacesByTeam } from '../../../Redux/Workspaces/workspaceSlice';
import EditWorkspaceNamePopup from './Modals/EditWorkspaceNamePopup';
import type { AppDispatch, RootState } from '../../../Redux/store';
import Searchbar, {
  type SearchbarHandle,
  type SuggestionState,
  type SnippetSuggestion,
} from './SearchComponents/Searchbar/Searchbar';
import SearchSuggestions from './SearchComponents/Searchbar/SearchSuggestions';
import AICommandLockedUI from './SearchComponents/Searchbar/AICommandLockedUI';
import SaveAgentModal from './SearchComponents/Searchbar/SaveAgentModal';
import useToast from './Shared/Toast/useToast';
import LoginRequiredDialog from './Modals/LoginRequiredDialog';
import UnsavedChangesDialog from './Modals/UnsavedChangesDialog';
import OrganizationPanel from './OrganizationPanel/OrganizationPanel';
import CreateOrganizationPanel from './OrganizationPanel/CreateOrganizationPanel';
import CreatePromptPanel from './Editor/CreatePromptPanel';
import AutomationSkillsPanel from './SearchComponents/Searchbar/AutomationSkillsPanel';
import SavedAutomationsPanel from './SearchComponents/Searchbar/SavedAutomationsPanel';
import BoardView from './Views/BoardView';
import { DailyTips } from './Features/DailyTips';
import TemplatesView from './CommandPalette/TemplatesView';
import WorkspaceSharePanel from '@private-features/WorkspaceSharePanel';
import { FEATURE_FLAGS } from '../utils/featureFlags';
import TutorialOverlay from './Features/TutorialOverlay';
import OnboardingLoader from './Features/OnboardingLoader';
import ModuleSpeaker from './Editor/ModuleSpeaker';
import SubscriptionsPanel from './Subscriptions/SubscriptionsPanel';
import ManageSubscriptionPanel from './Subscriptions/ManageSubscriptionPanel';
import GeneralSettingsPanel from './Layout/GeneralSettingsPanel';
import AllWorkspacesPanel from './Layout/AllWorkspacesPanel';
import WorkspaceSettingsPanel from './Layout/WorkspaceSettingsPanel';
import BackupPanel from './Layout/BackupPanel';
import { getTutorialProgress } from '@src/components/Tutorial';
import SheetUI from './SheetUI';
import { useCommands } from './SearchComponents/Searchbar/useCommands';

const collectFolderSnippetsDeep = (folder: Folder): Snippet[] => {
  const acc: Snippet[] = [...(folder.snippets || [])];
  (folder.folders || []).forEach(sub => {
    acc.push(...collectFolderSnippetsDeep(sub));
  });
  return acc;
};

const findRootFolderById = (team: Team | null, folderId: string): { root: Folder; workspace: Workspace } | null => {
  if (!team?.workspaces) return null;
  for (const workspace of team.workspaces) {
    let rootFound: Folder | null = null;
    const search = (folder: Folder, root: Folder): boolean => {
      if (String(folder.folder_id) === String(folderId)) {
        rootFound = root;
        return true;
      }
      return (folder.folders || []).some(sub => search(sub, root));
    };
    for (const folder of workspace.folders || []) {
      if (search(folder, folder) && rootFound) {
        return { root: rootFound, workspace };
      }
    }
  }
  return null;
};

// Collect ALL snippets from a workspace: workspace-level snippets + all folder snippets (deep)
// This matches AltS WorkspaceContentView behavior when a workspace is selected without a folder
const collectWorkspaceSnippetsDeep = (workspace: Workspace): Snippet[] => {
  const acc: Snippet[] = [...(workspace.workspace_snippets || [])];
  (workspace.folders || []).forEach(folder => {
    acc.push(...collectFolderSnippetsDeep(folder));
  });
  return acc;
};

// MainView type is now exported from uiStateSlice
import type { MainView } from '../../../Redux/AllData/uiStateSlice';

interface ContainerProps {
  reload: () => void;
  teams: Team[];
  searchbarRef: React.RefObject<SearchbarHandle | null>;
  searchValue?: string;
  onSnippetSelectFromSearch?: (item: SnippetSuggestion) => void;
  isCommandListView?: boolean;
  onClearCommandListView?: () => void;
  onToggleCommandListView?: (isOpen: boolean) => void;
  commandListCategory?: string;
  onCommandListCategoryChange?: (category: string) => void;
  activeCommandSection?: string;
  onCommandSectionChange?: (section: string) => void;
  isTemplatesView?: boolean;
  onToggleTemplatesView?: (isOpen: boolean) => void;
  templatesCategory?: string;
  onTemplatesCategoryChange?: (category: string) => void;
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateOrganization?: () => void;
  onOrganizationHandlersReady?: (handlers: {
    onOrganizationSettings: (orgId: string, orgName: string) => void;
    onCreateOrganization: () => void;
    onWorkspaceShare: (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => void;
  }) => void;
  onOrganizationPanelChange?: (state: { isOpen: boolean; orgId?: string; orgName?: string; loading?: boolean }) => void;
  onSearchbarFocus?: (isUserInitiated: boolean) => void; // Called when main searchbar gains focus
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  hideMainContent?: boolean; // Hide main content (keep searchbar visible)
  isLoggedIn: boolean;
  onLockedCommandChange?: (commandId: string | null) => void;
  onMenuStateChange?: (isOpen: boolean) => void;
  onAutomationActiveChange?: (isActive: boolean) => void;
  onQueryChange?: (value: string) => void;
  showTutorialTrigger?: number;
  onTutorialTriggerConsumed?: () => void;
  isSheetUIOpen?: boolean;
  onOpenSheetUI?: (section?: string) => void;
  onCloseSheetUI?: () => void;
  onCreateWorkspace?: (isPersonal: boolean, access?: 'public' | 'private' | 'shareonly', targetTeamId?: string) => void;
  showSidebarColumn?: boolean;
  isBoardViewEnabled?: boolean;
  onToggleBoardView?: () => void;
  isInitialAltSFocus?: boolean;
  onInitialAltSFocusChange?: (val: boolean) => void;
  onBoardViewOpenChange?: (isOpen: boolean) => void;
  /** Called after user confirms unsaved-changes dialog triggered by Alt+S */
  onShortcutBoardView?: () => void;
  /** Called after user confirms unsaved-changes dialog triggered by Alt+C */
  onShortcutCreateMenu?: () => void;
  onSuggestionStateChange?: (state: SuggestionState | null) => void;
  onHoverSlashDot?: () => void;
  onBoardViewRedirect?: () => void;
  onTutorialVisibilityChange?: (visible: boolean) => void;
}

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-1">
    {keys.map(key => (
      <span
        key={key}
        className="rounded border border-white/20 bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 shadow-sm leading-none">
        {key}
      </span>
    ))}
  </span>
);

import { enqueueFavoriteAction } from '@src/Apis/favoritesQueue';

const Container: React.FC<ContainerProps> = ({
  reload,
  teams,
  searchbarRef,
  onMenuStateChange,
  onAutomationActiveChange,
  searchValue: propSearchValue,

  onSnippetSelectFromSearch,

  isCommandListView,
  onClearCommandListView,
  onToggleCommandListView,
  commandListCategory,
  onCommandListCategoryChange,
  activeCommandSection,
  onCommandSectionChange,
  isTemplatesView,
  onToggleTemplatesView,
  templatesCategory,
  onTemplatesCategoryChange,
  onOrganizationSettings,
  onCreateOrganization,
  onOrganizationHandlersReady,
  onOrganizationPanelChange,
  onSearchbarFocus,
  onNavigateToListView,
  hideMainContent,
  isLoggedIn,
  onLockedCommandChange,
  onQueryChange: propOnQueryChange,
  showTutorialTrigger,
  onTutorialTriggerConsumed,
  isSheetUIOpen,
  onOpenSheetUI,
  onCloseSheetUI,
  onCreateWorkspace,
  showSidebarColumn,
  isBoardViewEnabled,
  onToggleBoardView,
  isInitialAltSFocus,
  onInitialAltSFocusChange,
  onBoardViewOpenChange,
  onShortcutBoardView,
  onShortcutCreateMenu,
  onSuggestionStateChange,
  onHoverSlashDot,
  onBoardViewRedirect,
  onTutorialVisibilityChange,
}) => {
  const isCounterSyncingRef = useRef(false);
  const [storeTab, setStoreTab] = useState<'catalog' | 'saved'>('catalog');

  const homeViewRef = useRef<HomeViewHandle>(null);
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore();

  // Clear any persisted dirty/draft states on app initialization (e.g. refresh)
  useEffect(() => {
    dispatch(setIsEditorDirty(false));
    dispatch(setDraftAutomation(null));
    // Clear Todo draft as well
    dispatch(
      setTodoDraft({
        title: '',
        scheduleType: '',
        recurringCycle: 'daily',
        time: '',
        date: '',
        isAnytime: false,
        selectedItem: null,
        selectedType: 'custom',
        description: '',
      }),
    );
  }, [dispatch]);
  const [suggestionState, setSuggestionStateInternal] = useState<SuggestionState | null>(null);
  const setSuggestionState = useCallback(
    (
      val: SuggestionState | null | ((prev: SuggestionState | null) => SuggestionState | null),
    ) => {
      setSuggestionStateInternal(prev => {
        const next = typeof val === 'function' ? val(prev) : val;
        onSuggestionStateChange?.(next);
        return next;
      });
    },
    [onSuggestionStateChange],
  );
  const prevIsMenuOpenRef = useRef(false);
  const prevIsAutomationActiveRef = useRef(false);
  const [searchValue, setSearchValue] = useState('');
  const prevLockedRef = useRef<string | null>(null);
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [agentSpeakerProps, setAgentSpeakerProps] = useState<any>(null);
  const mainView = useSelector(selectMainView) || { kind: 'home' };
  const [favoritesMapping, setFavoritesMapping] = useState<Record<string, any[]>>({});
  const [isSaveAgentModalOpen, setIsSaveAgentModalOpen] = useState(false);
  const [localAutomations, setLocalAutomations] = useState<any[]>([]);
  const [localSavedAutomations, setLocalSavedAutomations] = useState<any[]>([]);
  const [installedModules, setInstalledModules] = useState<any[]>([]);

  const { commands } = useCommands();

  const fetchInstalledModulesWithMetadata = useCallback(
    async (forceCloud = false) => {
      if (isLoggedIn === false) return;
      const chromeAny = (window as any).chrome;
      const now = Date.now();

      try {
        // 1. Check shared storage for the last sync timestamp across ALL tabs
        const storage = await chromeAny.storage.local.get(['installed_modules', 'last_module_fetch_timestamp']);
        const lastFetch = storage.last_module_fetch_timestamp || 0;
        const isCoolingDown = now - lastFetch < 2 * 60 * 60 * 1000; // 2-hour cooldown per user request

        // 2. Load from cache immediately
        if (storage.installed_modules && Array.isArray(storage.installed_modules)) {
          setInstalledModules(storage.installed_modules);
          // If we are cooling down and not forced, we are done!
          if (isCoolingDown && !forceCloud) return;
        }

        // 3. If forced or cooldown expired, fetch and sync from cloud
        
        const enriched = await syncInstalledModulesToStorage();
        if (Array.isArray(enriched)) {
          setInstalledModules(enriched);
        }
      } catch (err) {
        console.error('Failed to fetch enriched installed modules in Container:', err);
      }
    },
    [isLoggedIn],
  );

  const lockedCommand = suggestionState?.lockedCommand;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isStoreLocked = (lockedCommand as string) === 'store' || (lockedCommand as string) === 'saved-automation';
      if (isStoreLocked && e.key === 'Tab') {
        e.preventDefault();
        setStoreTab(prev => {
          const nextTab = prev === 'catalog' ? 'saved' : 'catalog';
          const nextCmd = nextTab === 'catalog' ? 'store' : 'saved-automation';
          if (lockedCommand !== nextCmd) {
            const currentVal = searchbarRef.current?.getValue() || '';
            searchbarRef.current?.lockCommand(nextCmd, currentVal);
          }
          return nextTab;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockedCommand]);

  useEffect(() => {
    if (lockedCommand === 'saved-automation') {
      setStoreTab('saved');
    } else if (lockedCommand === 'store') {
      setStoreTab('catalog');
    }
  }, [lockedCommand]);

  useEffect(() => {
    const withIconMeta = (automation: any) => {
      if (!automation || typeof automation !== 'object') return automation;
      if (automation.iconMeta?.mode && Array.isArray(automation.iconMeta?.hosts)) return automation;
      return {
        ...automation,
        iconMeta: resolveAutomationIconMeta(automation),
      };
    };

    const persistIconMeta = async (automations: any[]) => {
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.storage?.local?.get || !chromeAny?.storage?.local?.set) return;

      try {
        const snapshot = await chromeAny.storage.local.get(['automations', 'saved_automations']);
        const map = snapshot?.automations;
        if (map && typeof map === 'object' && !Array.isArray(map)) {
          let hasChanges = false;
          const nextMap: Record<string, any> = { ...map };
          Object.entries(nextMap).forEach(([key, value]) => {
            if (!value || typeof value !== 'object') return;
            if (value.iconMeta?.mode && Array.isArray(value.iconMeta?.hosts)) return;
            nextMap[key] = { ...value, iconMeta: resolveAutomationIconMeta(value) };
            hasChanges = true;
          });
          if (hasChanges) {
            await chromeAny.storage.local.set({ automations: nextMap });
          }
        }

        const legacy = snapshot?.saved_automations;
        if (Array.isArray(legacy)) {
          const nextLegacy = legacy.map((item: any) => withIconMeta(item));
          const changed = nextLegacy.some((item: any, index: number) => item !== legacy[index]);
          if (changed) {
            await chromeAny.storage.local.set({ saved_automations: nextLegacy });
          }
        }
      } catch (error) {
        console.warn('[Container] Failed to persist automation iconMeta', error);
      }
    };

    const toAutomationArray = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    };

    const getAiLocals = (local: any[]) =>
      local.filter((auto: any) => {
        const hasAiStep =
          auto.steps?.some(
            (s: any) =>
              String(s.moduleId || s.module_id) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          ) ||
          auto.automation_steps?.some(
            (s: any) =>
              String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          );
        return hasAiStep;
      });

    // Load local automations from storage.
    // `automations` is the canonical synced map used by Searchbar and hotkeys.
    chrome.storage.local.get(['automations', 'saved_automations'], result => {
      const syncedAutomations = toAutomationArray(result.automations).map(withIconMeta);
      const legacyAutomations = toAutomationArray(result.saved_automations).map(withIconMeta);
      const local = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;
      setLocalSavedAutomations(local);
      setLocalAutomations(getAiLocals(local));
      persistIconMeta(local);
    });

    // Listen for storage changes to keep localAutomations in sync
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.automations || changes.saved_automations) {
        const syncedAutomations = toAutomationArray(changes.automations?.newValue).map(withIconMeta);
        const legacyAutomations = toAutomationArray(changes.saved_automations?.newValue).map(withIconMeta);
        const local = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;
        setLocalSavedAutomations(local);
        setLocalAutomations(getAiLocals(local));
        persistIconMeta(local);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    // Initial fetch for installed modules
    const fetchInstalled = async () => {
      const cached = await chrome.storage.local.get(['installed_modules']);
      if (cached?.installed_modules) {
        setInstalledModules(cached.installed_modules);
      }
      // Also trigger a fresh fetch from API to ensure metadata (icons, etc.) are up to date
      fetchInstalledModulesWithMetadata();
    };
    fetchInstalled();

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.installed_modules) {
        setInstalledModules(changes.installed_modules.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => chrome.storage.onChanged.removeListener(storageListener);
  }, [fetchInstalledModulesWithMetadata]);

  const allTeams = useSelector(selectAllData);

  const isReturningUser = useMemo(() => {
    if (!allTeams || allTeams.length === 0) return false;
    // Multi-Device Safe: specifically check for the workspace created by the onboarding flow
    return allTeams.some(team => team.workspaces && team.workspaces.some(ws => ws.workspace_name === 'Your shortcuts'));
  }, [allTeams]);

  // Helper to deep collect AI agents from folders
  const collectAiAgentsFromFolders = useCallback((folders: Folder[], workspaceId: string): SavedAutomation[] => {
    const agents: SavedAutomation[] = [];
    (folders || []).forEach(folder => {
      // Collect from current folder
      (folder.automations || []).forEach(auto => {
        const isAi = auto.automation_steps?.some(
          (s: any) =>
            String(s.module_id) === '5' ||
            String(s.moduleId) === '5' ||
            s.config?.agentId === 'all_ai' ||
            s.config?.isAllAi,
        );
        if (isAi && !agents.find(a => a.id === auto.id)) {
          agents.push({
            ...auto,
            workspace_id: workspaceId,
            folder_id: folder.folder_id,
          });
        }
      });
      // Recursively collect from subfolders
      if (folder.folders && folder.folders.length > 0) {
        const subAgents = collectAiAgentsFromFolders(folder.folders, workspaceId);
        subAgents.forEach(sa => {
          if (!agents.find(a => a.id === sa.id)) {
            agents.push(sa);
          }
        });
      }
    });
    return agents;
  }, []);

  // --- Saved AI Agents for AICommandLockedUI ---
  const savedAiAgents = useMemo(() => {
    let agents: any[] = [];

    // 1. Collect from Cloud (allTeams)
    if (allTeams) {
      allTeams.forEach(team => {
        (team.workspaces || []).forEach(workspace => {
          (workspace.workspace_automations || []).forEach(auto => {
            const steps = auto.automation_steps || auto.steps;
            const isAi =
              Array.isArray(steps) &&
              steps.some(
                (s: any) =>
                  String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
              );
            if (isAi && !agents.find(a => String(a.id) === String(auto.id))) {
              agents.push({
                ...auto,
                workspace_id: workspace.workspace_id,
              });
            }
          });

          const folderAgents = collectAiAgentsFromFolders(workspace.folders || [], workspace.workspace_id);
          folderAgents.forEach(fa => {
            if (!agents.find(a => String(a.id) === String(fa.id))) {
              agents.push(fa);
            }
          });

          // 1.c Collect from dedicated Chat Agent arrays (parity with SheetUI)
          const dedicatedAgents = [
            ...(workspace.workspace_chat_agents || []),
            ...(workspace.chat_agents || []),
            ...(workspace.workspace_agents || []),
          ];

          dedicatedAgents.forEach(agent => {
            const agentId = agent?.id || agent?.automation_id || agent?.snippet_id;
            if (agentId && !agents.find(a => String(a.id || a.automation_id || a.snippet_id) === String(agentId))) {
              agents.push({
                ...agent,
                id: agentId,
                workspace_id: workspace.workspace_id,
              });
            }
          });
        });
      });
    }

    // 2. Merge with Local Automations
    localAutomations.forEach(localAuto => {
      if (!agents.find(a => String(a.id) === String(localAuto.id))) {
        agents.push(localAuto);
      }
    });

    return agents;
  }, [allTeams, localAutomations, collectAiAgentsFromFolders]);

  const collectAutomationsFromFolders = useCallback((folders: Folder[], workspaceId: string): SavedAutomation[] => {
    const automations: SavedAutomation[] = [];
    (folders || []).forEach(folder => {
      (folder.automations || []).forEach(auto => {
        if (!automations.find(a => String(a.id) === String(auto.id))) {
          automations.push({
            ...auto,
            workspace_id: workspaceId,
            folder_id: folder.folder_id,
          });
        }
      });
      if (folder.folders && folder.folders.length > 0) {
        const subAutomations = collectAutomationsFromFolders(folder.folders, workspaceId);
        subAutomations.forEach(sub => {
          if (!automations.find(a => String(a.id) === String(sub.id))) {
            automations.push(sub);
          }
        });
      }
    });
    return automations;
  }, []);

  const savedAutomations = useMemo(() => {
    const automationMap = new Map<string, any>();
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
    const put = (automation: any) => {
      const key = String(
        automation?.id ||
        automation?.automation_id ||
        `${automation?.name || 'automation'}-${automation?.timestamp || automation?.created_at || ''}`,
      );
      const existing = automationMap.get(key);
      if (!existing) {
        automationMap.set(key, automation);
        return;
      }

      const existingScore = getStepsCount(existing) * 10 + getInputsCount(existing);
      const incomingScore = getStepsCount(automation) * 10 + getInputsCount(automation);
      if (incomingScore > existingScore) {
        automationMap.set(key, automation);
      }
    };

    if (allTeams) {
      allTeams.forEach(team => {
        (team.workspaces || []).forEach(workspace => {
          (workspace.workspace_automations || []).forEach(auto => {
            put({
              ...auto,
              workspace_id: workspace.workspace_id,
            });
          });
          const folderAutomations = collectAutomationsFromFolders(workspace.folders || [], workspace.workspace_id);
          folderAutomations.forEach(put);
        });
      });
    }

    localSavedAutomations.forEach(put);

    return Array.from(automationMap.values()).sort((a: any, b: any) => {
      const aTime = new Date(a?.updated_at || a?.created_at || a?.timestamp || 0).getTime();
      const bTime = new Date(b?.updated_at || b?.created_at || b?.timestamp || 0).getTime();
      return bTime - aTime;
    });
  }, [allTeams, localSavedAutomations, collectAutomationsFromFolders]);

  const handleSelectSavedAgent = (agent: any) => {
    searchbarRef.current?.selectSavedAgent(agent);
  };

  const handleNewChat = () => {
    searchbarRef.current?.newAiChat();
  };

  // Get state from Redux
  const allData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const selectedSnippet = useSelector(selectSelectedSnippet);
  const snippetBreadCrum = useSelector(selectSnippetBreadCrum);
  const isCreatingNewItem = useSelector(selectIsCreatingNewItem);
  const isCreatingEditorView =
    (isCreatingNewItem || !!selectedSnippet) && (mainView.kind === 'noteEditor' || mainView.kind === 'promptEditor');

  const isDarkMode = useSelector(selectDarkMode);
  const isFocusMode = useSelector(selectIsFocusMode);
  const isMac = useSelector(selectIsMac);

  const isLinkEditModalOpen = useSelector(selectIsLinkEditModalOpen);
  const linkEditPrefill = useSelector(selectLinkEditPrefill);

  // Track whether the currently active editor has unsaved changes via Redux
  const isEditorDirty = useSelector(selectIsEditorDirty);
  const showEditorSwitchWarning = useSelector(selectShowEditorSwitchWarning);
  const pendingNavigationAction = useSelector(selectPendingNavigationAction);

  const handleEditorDirtyChange = useCallback(
    (isDirty: boolean) => {
      dispatch(setIsEditorDirty(isDirty));
    },
    [dispatch],
  );

  useEffect(() => {
    if (isSheetUIOpen) {
      fetchInstalledModulesWithMetadata();
    }
  }, [isSheetUIOpen, fetchInstalledModulesWithMetadata]);

  // Auto-close LinkEditModal on navigation (folder/workspace change) or view switch.
  // This matches RichEditor behavior: navigating via sidebar should reset the view.
  // Auto-close LinkEditModal on navigation (folder/workspace change) or view switch.
  // REMOVED: This causes the modal to close immediately after creation because setting workspace/folder triggers this effect.
  // The user should manually close the modal or it should be handled explicitly.
  /*
  useEffect(() => {
    if (isLinkEditModalOpen) {
      dispatch(closeLinkEditModal());
    }
  }, [selectedFolder?.folder_id, selectedWorkspace?.workspace_id, selectedTeam?.team_id, dispatch]);
  */

  const [showTutorial, setShowTutorial] = useState(false);
  const [isCheckingTutorial, setIsCheckingTutorial] = useState(true);
  const tutorialVideoSrc = 'https://drive.google.com/file/d/1IyGR9rKItnPPwXdw8RJkNcfnf7HNdfmz/view?usp=sharing';

  const COUNTERS_DAILY_KEY = 'counters_daily_v1';
  const COUNTERS_SYNC_NEXT_KEY = 'counters_sync_next_at';
  const COUNTERS_SYNC_LOCK_KEY = 'counters_sync_in_progress';
  const COUNTERS_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const COUNTERS_SYNC_LOCK_TTL_MS = 2 * 60 * 1000;

  useEffect(() => {
    const checkTutorial = async () => {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        if (!isLoggedIn) {
          setIsCheckingTutorial(false);
          return;
        }

        chromeAny.storage.local.get(['tutorial_watched', 'myCachedAllData'], (result: any) => {
          if (result.tutorial_watched) {
            setIsCheckingTutorial(false);
            return;
          }

          // Check if "Your shortcuts" workspace already exists
          const allData = result.myCachedAllData;
          if (Array.isArray(allData)) {
            const hasShortcutsWs = allData.some(
              (team: any) =>
                Array.isArray(team.workspaces) &&
                team.workspaces.some((ws: any) => ws.workspace_name === 'Your shortcuts'),
            );
            if (hasShortcutsWs) {
              setIsCheckingTutorial(false);
              return;
            }
          }

          // Show tutorial immediately on fresh install
          setShowTutorial(true);
          setIsCheckingTutorial(false);
        });
      } else {
        setIsCheckingTutorial(false);
      }
    };
    checkTutorial();
  }, [isLoggedIn]);

  const handleCloseTutorial = useCallback(async () => {
    setShowTutorial(false);
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local && !(window as any).isReplayingTutorial) {
      chromeAny.storage.local.set({ tutorial_watched: true });
    }
    // 1. Refresh all data (snippets, workspaces) and AWAIT it
    // Note: dispatch(fetchAllDataThunk()) returns a promise that resolves when data is in Redux
    await (reload() as any);

    // 2. Trigger favorites re-sync by toggling the trigger.
    // useFavoritesSync listens for this change, clears its internal cache, and fetches cloud favs.
    try {
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('user_fav_sync_trigger', (res: any) => {
          const val = res.user_fav_sync_trigger || 0;
          chromeAny.storage.local.set({ user_fav_sync_trigger: val + 1 });
        });
      }
    } catch (e) {
      console.error('[Container] Failed to trigger favorites sync:', e);
    }

    // Trigger the new 4-step tutorial if not seen yet
    const progress = await getTutorialProgress();
    if (!progress.search) {
      window.dispatchEvent(new CustomEvent('SearchTutorialStarted'));
    }
  }, [reload, onTutorialTriggerConsumed]);

  // When Tutorial button is clicked in HeaderControls (via App), show the overlay
  useEffect(() => {
    if (showTutorialTrigger && showTutorialTrigger > 0) {
      
      setShowTutorial(true);
      onTutorialTriggerConsumed?.();
    }
  }, [showTutorialTrigger, onTutorialTriggerConsumed]);

  useEffect(() => {
    onTutorialVisibilityChange?.(showTutorial);
  }, [showTutorial, onTutorialVisibilityChange]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    let cancelled = false;

    const runSync = async () => {
      if (isCounterSyncingRef.current) return;
      isCounterSyncingRef.current = true;
      const now = Date.now();
      try {
        const result: any = await new Promise(resolve => {
          chromeAny.storage.local.get(
            [COUNTERS_DAILY_KEY, COUNTERS_SYNC_NEXT_KEY, COUNTERS_SYNC_LOCK_KEY, 'last_counter_sync_timestamp'],
            resolve,
          );
        });
        if (cancelled) return;

        const lastSync = result.last_counter_sync_timestamp || 0;
        if (now - lastSync < 60 * 1000) return;

        const nextAt = typeof result?.[COUNTERS_SYNC_NEXT_KEY] === 'number' ? result[COUNTERS_SYNC_NEXT_KEY] : 0;
        if (nextAt && now < nextAt) return;

        const lock = result?.[COUNTERS_SYNC_LOCK_KEY];
        if (lock && typeof lock.startedAt === 'number' && now - lock.startedAt < COUNTERS_SYNC_LOCK_TTL_MS) {
          return;
        }

        const store = result?.[COUNTERS_DAILY_KEY];
        const days = store?.days && typeof store.days === 'object' ? store.days : {};
        const dayKeys = Object.keys(days);

        if (dayKeys.length === 0) {
          await chromeAny.storage.local.set({
            [COUNTERS_SYNC_NEXT_KEY]: now + COUNTERS_SYNC_INTERVAL_MS,
            last_counter_sync_timestamp: now,
          });
          return;
        }

        await chromeAny.storage.local.set({
          [COUNTERS_SYNC_LOCK_KEY]: { startedAt: now },
          last_counter_sync_timestamp: now,
        });

        const AGGREGATE_METRIC_IDS: Record<string, number> = {
          command_count: 1,
          search_command_count: 2,
        };
        const COMMAND_METRIC_IDS: Record<string, number> = {
          store: 101,
          agent: 102,
          gpt: 103,
          google: 104,
        };

        const rows: Array<[string, 0 | 1, number, number]> = [];
        dayKeys.forEach(dayKey => {
          const bucket = days[dayKey];
          if (!bucket || typeof bucket !== 'object') return;

          const counts = bucket.counts && typeof bucket.counts === 'object' ? bucket.counts : {};
          const commandCounts =
            bucket.commandCounts && typeof bucket.commandCounts === 'object' ? bucket.commandCounts : {};

          Object.entries(AGGREGATE_METRIC_IDS).forEach(([countKey, metricId]) => {
            const delta = Number((counts as any)[countKey]) || 0;
            if (delta !== 0) rows.push([dayKey, 0, metricId, delta]);
          });

          Object.entries(commandCounts as Record<string, any>).forEach(([commandKey, value]) => {
            const metricId = COMMAND_METRIC_IDS[commandKey];
            if (!metricId) return;
            const delta = Number(value) || 0;
            if (delta !== 0) rows.push([dayKey, 1, metricId, delta]);
          });
        });

        if (rows.length === 0) {
          await chromeAny.storage.local.set({ [COUNTERS_SYNC_NEXT_KEY]: now + COUNTERS_SYNC_INTERVAL_MS });
          return;
        }

        const userId = await getUserId();
        const payload = {
          v: 2 as const,
          tz:
            typeof store?.timezoneOffsetMinutes === 'number'
              ? store.timezoneOffsetMinutes
              : new Date(now).getTimezoneOffset(),
          rows,
          syncedAt: now,
        };

        await syncCounterStats(userId, payload);

        const latest: any = await new Promise(resolve => {
          chromeAny.storage.local.get([COUNTERS_DAILY_KEY], resolve);
        });

        const latestStore = latest?.[COUNTERS_DAILY_KEY] || {
          version: 1,
          timezoneOffsetMinutes: new Date(now).getTimezoneOffset(),
          days: {},
          lastUpdated: 0,
        };

        const latestDays = latestStore?.days && typeof latestStore.days === 'object' ? { ...latestStore.days } : {};

        const AGGREGATE_METRIC_KEYS: Record<number, string> = {
          1: 'command_count',
          2: 'search_command_count',
        };
        const COMMAND_METRIC_KEYS: Record<number, string> = {
          101: 'store',
          102: 'agent',
          103: 'gpt',
          104: 'google',
        };

        const sentDays = (payload.rows || []).reduce(
          (
            acc: Record<string, { counts: Record<string, number>; commandCounts: Record<string, number> }>,
            row: any,
          ) => {
            const [day, metricKind, metricId, deltaRaw] = row || [];
            if (typeof day !== 'string') return acc;
            const delta = Number(deltaRaw) || 0;
            if (delta === 0) return acc;

            if (!acc[day]) {
              acc[day] = { counts: {}, commandCounts: {} };
            }

            if (metricKind === 0) {
              const key = AGGREGATE_METRIC_KEYS[Number(metricId)];
              if (key) acc[day].counts[key] = (acc[day].counts[key] || 0) + delta;
            } else if (metricKind === 1) {
              const key = COMMAND_METRIC_KEYS[Number(metricId)];
              if (key) acc[day].commandCounts[key] = (acc[day].commandCounts[key] || 0) + delta;
            }
            return acc;
          },
          {},
        );

        const subtractMap = (latestMap: Record<string, any>, sentMap: Record<string, any>) => {
          const next: Record<string, number> = {};
          const keys = new Set([...Object.keys(latestMap || {}), ...Object.keys(sentMap || {})]);
          keys.forEach(k => {
            const latestValue = Number((latestMap || {})[k]) || 0;
            const sentValue = Number((sentMap || {})[k]) || 0;
            const remaining = latestValue - sentValue;
            if (remaining > 0) {
              next[k] = remaining;
            }
          });
          return next;
        };

        dayKeys.forEach(key => {
          const latestBucket = latestDays[key];
          if (!latestBucket || typeof latestBucket !== 'object') {
            delete latestDays[key];
            return;
          }

          const sentBucket = sentDays[key] && typeof sentDays[key] === 'object' ? sentDays[key] : {};
          const remainingCounts = subtractMap(latestBucket.counts || {}, (sentBucket as any).counts || {});
          const remainingCommandCounts = subtractMap(
            latestBucket.commandCounts || {},
            (sentBucket as any).commandCounts || {},
          );

          if (Object.keys(remainingCounts).length === 0 && Object.keys(remainingCommandCounts).length === 0) {
            delete latestDays[key];
            return;
          }

          latestDays[key] = {
            ...latestBucket,
            counts: remainingCounts,
            commandCounts: remainingCommandCounts,
          };
        });

        await chromeAny.storage.local.set({
          [COUNTERS_DAILY_KEY]: { ...latestStore, days: latestDays },
          [COUNTERS_SYNC_NEXT_KEY]: now + COUNTERS_SYNC_INTERVAL_MS,
        });
      } catch (err) {
        console.error('[CounterSync] Failed to sync counter stats:', err);
      } finally {
        try {
          await chromeAny.storage.local.remove(COUNTERS_SYNC_LOCK_KEY);
        } catch {
          // ignore
        } finally {
          isCounterSyncingRef.current = false;
        }
      }
    };

    runSync();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // ── Onboarding loader state ────────────────────────────────────────────
  const [showOnboardingLoader, setShowOnboardingLoader] = useState(false);
  const [onboardingLoaderStep, setOnboardingLoaderStep] = useState<'commands' | 'links' | 'tabgroups' | 'done'>(
    'commands',
  );

  // ── Process onboarding drafts after login ──────────────────────────────
  // When user signs in, merge draft commands into alts_commands and
  // create draft links/tab groups via API, then clear the draft keys.
  // Workspace ID is resolved dynamically from myCachedAllData.
  // Includes retry logic for new users where myCachedAllData may not
  // be available immediately after signup.

  useEffect(() => {
    if (!isLoggedIn) return;
    const chromeAny = (window as any).chrome;
    if (!chromeAny?.storage?.local) return;

    let cancelled = false;

    const processDrafts = async () => {
      const res: any = await new Promise(resolve => {
        chromeAny.storage.local.get(['alts_commands_draft', 'Onboarded_links'], resolve);
      });

      const hasDraftCmds = Array.isArray(res.alts_commands_draft) && res.alts_commands_draft.length > 0;
      const hasDraftLinks =
        res.Onboarded_links &&
        ((Array.isArray(res.Onboarded_links.linkGroups) && res.Onboarded_links.linkGroups.length > 0) ||
          (Array.isArray(res.Onboarded_links.singleLinks) && res.Onboarded_links.singleLinks.length > 0));

      if (!hasDraftCmds && !hasDraftLinks) return;
      if (cancelled) return;

      

      // Show the professional onboarding loader
      setOnboardingLoaderStep('commands');
      setShowOnboardingLoader(true);

      let commandsOk = true;
      let linksOk = true;

      // 1. Merge draft commands into alts_commands
      if (hasDraftCmds) {
        try {
          setOnboardingLoaderStep('commands');
          await new Promise<void>(resolve => {
            chromeAny.storage.local.get('alts_commands', (cmdRes: any) => {
              const existing = Array.isArray(cmdRes.alts_commands) ? cmdRes.alts_commands : [];
              const existingIds = new Set(existing.map((c: any) => c.id));
              const merged = [...existing, ...res.alts_commands_draft.filter((c: any) => !existingIds.has(c.id))];
              chromeAny.storage.local.set({ alts_commands: merged }, () => {
                
                resolve();
              });
            });
          });
        } catch (err) {
          console.error('[Container] Failed to merge draft commands:', err);
          commandsOk = false;
        }
      }

      // 2. Create draft links/tab groups via API
      if (hasDraftLinks) {
        try {
          // Step A: Wait for myCachedAllData to be populated (retry up to 15 times, every 2s)
          const MAX_RETRIES = 7;
          let personalTeamId: string | null = null;

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (cancelled) return;
            personalTeamId = await new Promise<string | null>(resolve => {
              chromeAny.storage.local.get('myCachedAllData', (cachedRes: any) => {
                const allData = cachedRes.myCachedAllData;
                if (!Array.isArray(allData)) {
                  resolve(null);
                  return;
                }
                const personalTeam = allData.find((team: any) => team.is_personal_space === true);
                if (personalTeam?.team_id) {
                  resolve(personalTeam);
                } else {
                  resolve(null);
                }
              });
            });

            if (personalTeamId) {
              
              break;
            }

            
            await new Promise(r => setTimeout(r, 2000));
          }

          if (!personalTeamId) {
            console.error('[Container] Could not resolve personal team ID after retries — drafts preserved');
            linksOk = false;
          } else {
            // Step B: Create a new workspace "Your shortcuts" in the personal space team
            const { createNewWorkspace } = await import('../../../Apis/features/workspaceApiServices');
            // personalTeamId here is actually the personalTeam object now based on the above change
            const teamObj = personalTeamId as any;
            const teamId = teamObj?.team_id;
            const storageMode = teamObj?.storageMode ?? 'cloud';
            const wsResult = await createNewWorkspace('Your shortcuts', 'private', teamId, storageMode);
            const newWorkspaceId =
              wsResult.workspace_id || wsResult.id || (wsResult.workspace && wsResult.workspace.workspace_id);

            if (!newWorkspaceId) {
              console.error('[Container] Failed to get workspace ID from createNewWorkspace — drafts preserved');
              linksOk = false;
            } else {
              

              const { updateSnippetRealtime } = await import('../../../Apis/features/snippetApi');
              const { linkGroups = [], singleLinks = [] } = res.Onboarded_links;

              // Create tab groups — value must be JSON {names, urls}
              if (linkGroups.length > 0) {
                setOnboardingLoaderStep('tabgroups');
                for (const group of linkGroups) {
                  const names = (group.links || []).map((l: any) => l.title || l.url);
                  const urls = (group.links || []).map((l: any) => l.url);
                  const valueForRequest = JSON.stringify({ names, urls });
                  const createPayload: Record<string, any> = {
                    key: group.name,
                    value: valueForRequest,
                    category: 'TabGroup',
                    workspace_id: newWorkspaceId,
                  };
                  if (group.hotkey) {
                    createPayload.hotkey = group.hotkey;
                  }
                  await updateSnippetRealtime(createPayload, storageMode);
                }
              }

              // Create single links
              if (singleLinks.length > 0) {
                setOnboardingLoaderStep('links');
                for (const link of singleLinks) {
                  const createPayload: Record<string, any> = {
                    key: link.title,
                    value: link.url,
                    category: 'link',
                    workspace_id: newWorkspaceId,
                  };
                  await updateSnippetRealtime(createPayload, storageMode);
                }
              }

              
            }
          }
        } catch (err) {
          console.error('[Container] Failed to create draft links via API:', err);
          linksOk = false;
        }
      }

      if (cancelled) return;

      // 3. Mark as done and show completion briefly
      setOnboardingLoaderStep('done');
      await new Promise(r => setTimeout(r, 1200));

      // 4. Only clear draft keys that were successfully processed
      const keysToRemove: string[] = [];
      if (commandsOk && hasDraftCmds) keysToRemove.push('alts_commands_draft');
      if (linksOk && hasDraftLinks) keysToRemove.push('Onboarded_links');

      if (keysToRemove.length > 0) {
        chromeAny.storage.local.remove(keysToRemove, () => {
          
        });
      } else {
        console.warn('[Container] No drafts were successfully processed — keeping all draft keys for retry');
      }

      // 5. Hide loader
      setShowOnboardingLoader(false);
    };

    processDrafts();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // Load and sync favorites
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;

    // Initial load
    chromeAny.storage.local.get('myFavouriteItems', (res: { myFavouriteItems?: Record<string, any[]> }) => {
      setFavoritesMapping(res.myFavouriteItems || {});
    });

    // Listener
    const handleChange = (changes: { [key: string]: any }, area: string) => {
      if (area === 'local' && changes.myFavouriteItems) {
        setFavoritesMapping(changes.myFavouriteItems.newValue || {});
      }
    };
    chromeAny.storage.onChanged.addListener(handleChange);
    return () => {
      chromeAny.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  // RESET STATE ON MOUNT (Refresh)
  // User requested: "When I just refresh... it goes to the home view freshly new one."
  // RESET STATE ON MOUNT (Refresh) - Ensure completely clean state
  useEffect(() => {
    const hasUrlTrigger = typeof window !== 'undefined' && (window as any).__hasUrlTrigger;

    // Load favorites visibility from storage
    const chrome = (window as any).chrome;
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['showFavorites'], (result: any) => {
        if (result.showFavorites !== undefined) {
          dispatch(setShowFavorites(result.showFavorites));
        }
      });
    }

    if (hasUrlTrigger) {
      
      return;
    }

    // Clear all navigation and selection state
    dispatch(setSelectedSnippet(null));
    dispatch(setSnippetBreadCrum(null));
    dispatch(setSelectedFolder(null));
    dispatch(setSelectedWorkspace(null));

    dispatch(setIsCreatingNewItem(false));
    dispatch(closeLinkEditModal());
    // dispatch(setShowTodosView(false)); // REMOVED: keep Todos open if user pinned it

    const urlParams = new URLSearchParams(window.location.search);
    const hasLockParam = urlParams.get('lock_command') || urlParams.get('open_note') || urlParams.get('trigger_hotkey');

    // Clear search and scroll
    dispatch(setDebouncedSearchTerm(''));
    setSearchValue('');
    dispatch(setScrollToFolderId(null));

    // COLLAPSE EVERYTHING - critical for "fresh start" feel
    // dispatch(expandAllWorkspaces({}));
    // dispatch(expandAllFolders({}));

    // Ensure local state is reset
    setIsLinkSidebarOpen(false);

    // Clear suggestion state
    setSuggestionState(null);

    // RESET TO HOME VIEW - ensures fresh start on refresh/new tab
    // Specifically clear any pending AI/Command locks via the ref if it's available after mount
    dispatch(navigateToView({ kind: 'home' }));

    // Explicitly clear AI lock on next tick to ensure Searchbar is ready
    // BUT skip this if the URL has a lock_command (e.g. from opening an agent in a collection)
    setTimeout(() => {
      if (searchbarRef.current) {
        if (!hasLockParam) {
          
          searchbarRef.current.lockCommand(null);
        } else {
          
        }
      }
    }, 50);
  }, [dispatch]);

  // Sync with prop if it changes (e.g. from parent App)
  useEffect(() => {
    if (propSearchValue !== undefined && propSearchValue !== searchValue) {
      setSearchValue(propSearchValue);
    }
  }, [propSearchValue]);
  const isLinkEditMode = useSelector(selectIsLinkEditMode);
  const activeLinkSnippet = useSelector(selectActiveLinkSnippet);
  const scrollToFolderId = useSelector(selectScrollToFolderId);
  const showTodosView = useSelector(selectShowTodosView);
  const showFavorites = useSelector(selectShowFavorites);

  // Clear searchbar state when navigating to Todos View to ensure locked AI modes are dismissed
  useEffect(() => {
    if (mainView.kind === 'todos') {
      searchbarRef.current?.clear();
      setSuggestionState(null);
    }
  }, [mainView.kind]);

  // New Tab Toggle State
  const [isNewTabEnabled, setIsNewTabEnabled] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      // Load initial state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chromeAny.storage.local.get(['new_tab_override_enabled'], (result: any) => {
        setIsNewTabEnabled(result.new_tab_override_enabled === true);
      });

      // Listen for storage changes to update dynamically
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.new_tab_override_enabled) {
          const newValue = changes.new_tab_override_enabled.newValue;
          setIsNewTabEnabled(newValue === true);
        }
      };

      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    }
    return;
  }, []);

  const handleToggleNewTab = useCallback(() => {
    const newValue = !isNewTabEnabled;
    setIsNewTabEnabled(newValue);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_override_enabled: newValue });
    }
  }, [isNewTabEnabled]);

  const handleCloseLinkEditModal = () => {
    dispatch(closeLinkEditModal());
    dispatch(setIsCreatingNewItem(false)); // Reset creation mode to restore standard layout (Header/Sidebar)
    dispatch(setSelectedSnippet(null)); // Ensure snippet is deselected so editor mode exits and searchbar reappears
    dispatch(navigateToView({ kind: 'home' }));
    // Reset search state to ensure we return to the Homepage view (no "Keep typing..." message)
    if (isCreatingNewItem || selectedWorkspace || selectedFolder) {
      // Removed searchValue and searchbar clear to allow persistent suggestions
      // setSearchValue('');
      // dispatch(setDebouncedSearchTerm(''));
      // setSuggestionState(null);

      // Full Reset to Homepage (Fresh state)
      dispatch(setSelectedWorkspace(null));
      dispatch(setSelectedFolder(null));
      dispatch(setSelectedSnippet(null));
      dispatch(setSnippetBreadCrum(null));
      // dispatch(setShowFavorites(false)); // REMOVED: Respect user choice

      if (searchbarRef.current) {
        // searchbarRef.current.clear();
        searchbarRef.current.blur();
      }
    } else {
      // Only focus if we were NOT clearing search (meaning we were probably already in a clean state)
      setTimeout(() => {
        if (!isModalOpen() && searchbarRef.current) {
          searchbarRef.current.focus();
        }
      }, 0);
    }
  };

  const [userId, setUserId] = useState('');
  const [workpsaceDetails, setWorkspaceDetails] = useState<WorkspaceDetails | null>(null);
  const [isLoadingShareButton, setIsLoadingShareButton] = useState(true);

  // Add state for sidebar visibility
  const [isLinkSidebarOpen, setIsLinkSidebarOpen] = useState(false);

  const viewMode = useSelector(selectViewMode);
  const triggerToast = useToast();
  const [homeDeleteContext, setHomeDeleteContext] = useState<{
    isOpen: boolean;
    detail: SnippetActionDetail | null;
  }>({ isOpen: false, detail: null });

  const [loginRequiredDialog, setLoginRequiredDialog] = useState<{
    isOpen: boolean;
    commandName: string;
  }>({ isOpen: false, commandName: '' });

  // Organization handlers - these set the view and call parent callbacks
  const handleOrganizationSettings = useCallback(
    (orgId: string, orgName: string) => {
      dispatch(navigateToView({ kind: 'organizationSettings', orgId, orgName }));
      onOrganizationSettings?.(orgId, orgName);
    },
    [onOrganizationSettings, dispatch],
  );

  const handleCreateOrganization = useCallback(() => {
    dispatch(navigateToView({ kind: 'createOrganization' }));
    onCreateOrganization?.();
  }, [onCreateOrganization, dispatch]);

  const handleWorkspaceShare = useCallback(
    (workspaceId: string, workspaceName: string, orgId: string, workspaceType?: string) => {
      dispatch(
        navigateToView({
          kind: 'workspaceShare',
          workspaceId,
          workspaceName,
          orgId,
          workspaceType,
        }),
      );
    },
    [dispatch],
  );

  // Expose handlers to parent (App) so it can pass them to SideBar
  useEffect(() => {
    if (onOrganizationHandlersReady) {
      onOrganizationHandlersReady({
        onOrganizationSettings: handleOrganizationSettings,
        onCreateOrganization: handleCreateOrganization,
        onWorkspaceShare: handleWorkspaceShare,
      });
    }
  }, [onOrganizationHandlersReady, handleOrganizationSettings, handleCreateOrganization, handleWorkspaceShare]);

  // Notify parent when organization panel opens/closes
  useEffect(() => {
    if (
      mainView.kind === 'organizationSettings' ||
      mainView.kind === 'createOrganization' ||
      mainView.kind === 'workspaceShare'
    ) {
      onOrganizationPanelChange?.({
        isOpen: true,
        orgId: (mainView as any).orgId,
        orgName: (mainView as any).orgName,
      });
    } else {
      onOrganizationPanelChange?.({ isOpen: false });
    }
  }, [mainView, onOrganizationPanelChange]);

  const commandStatus = useSelector(selectCommandStatus);

  // Inline notification state (matching AltS DefaultMainView pattern)
  const pendingNotification = useSelector(selectPendingNotification);
  const [inlineNotification, setInlineNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  // When pendingNotification changes, display it and auto-clear after 10 seconds
  useEffect(() => {
    if (pendingNotification) {
      // Show the notification
      setInlineNotification(pendingNotification);
      dispatch(clearPendingNotification());
    }

    // Auto-clear after 10 seconds (hard deadline)
    if (inlineNotification) {
      const timeout = setTimeout(() => {
        setInlineNotification(null);
      }, 10000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [pendingNotification, inlineNotification, dispatch]);

  // Auto-clear command status after 10 seconds (hard deadline)
  useEffect(() => {
    if (commandStatus.status !== 'idle' && commandStatus.status !== 'loading') {
      const timeout = setTimeout(() => {
        dispatch(resetCommandStatus());
      }, 10000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [commandStatus, dispatch]);

  // Memoized reload function to avoid unnecessary re-renders
  const handleReload = useCallback(() => {
    // Trigger a background reload but don't block UI
    reload();
  }, [reload]);

  const debouncedSearchTerm = useSelector(selectDebouncedSearchTerm);

  // Helper function to check if any modal/popup is open (matching AltS logic)
  const isModalOpen = useCallback((): boolean => {
    const modals = document.querySelectorAll('.fixed.inset-0');
    const activeElement = document.activeElement;
    if (activeElement) {
      const modalParent = activeElement.closest('.fixed.inset-0');
      if (modalParent) {
        const style = window.getComputedStyle(modalParent);
        if (style.opacity !== '0' && style.display !== 'none') {
          return true;
        }
      }
    }
    for (let i = 0; i < modals.length; i++) {
      const modal = modals[i] as HTMLElement;
      const style = window.getComputedStyle(modal);
      if (style.opacity !== '0' && style.display !== 'none') {
        return true;
      }
    }
    return false;
  }, []);

  // Focus search bar when view/state changes (matching AltS behavior)
  // Only focus if not in editor mode (which handles its own focus)
  useEffect(() => {
    const focusTimeout = window.setTimeout(() => {
      // Only focus if not in editor mode (which handles its own focus)
      // AND not in AI command mode (which has its own middle input box)
      const isInEditor = (isCreatingNewItem || selectedSnippet) && snippetBreadCrum;
      const isAiLocked =
        suggestionState?.lockedCommand === 'ai' ||
        suggestionState?.lockedCommand === 'gpt' ||
        suggestionState?.lockedCommand === 'perplexity' ||
        suggestionState?.lockedCommand === 'claude' ||
        suggestionState?.lockedCommand === 'gemini';

      if (!isInEditor && !isAiLocked && !isModalOpen() && searchbarRef.current) {
        searchbarRef.current.focus();
      }
    }, 0);
    return () => window.clearTimeout(focusTimeout);
  }, [
    selectedWorkspace,
    selectedFolder,
    selectedSnippet,
    isCreatingNewItem,
    isModalOpen,
    suggestionState?.lockedCommand,
  ]);

  // Focus search bar when folder is selected (matching AltS handleFolderViewRequested behavior)
  // When folder is clicked, focus search bar so user can immediately search within folder
  useEffect(() => {
    const isAiLocked =
      suggestionState?.lockedCommand === 'ai' ||
      suggestionState?.lockedCommand === 'gpt' ||
      suggestionState?.lockedCommand === 'perplexity' ||
      suggestionState?.lockedCommand === 'claude' ||
      suggestionState?.lockedCommand === 'gemini';
    if (selectedFolder && selectedWorkspace && !selectedSnippet && !isCreatingNewItem && !isAiLocked) {
      // Removed search clearing to allow persistent suggestions during sidebar navigation
      // searchbarRef.current?.clear();
      setTimeout(() => {
        if (!isModalOpen() && searchbarRef.current) {
          searchbarRef.current.focus();
        }
      }, 0);
    }
  }, [
    selectedFolder?.folder_id,
    selectedWorkspace?.workspace_id,
    selectedSnippet,
    isCreatingNewItem,
    isModalOpen,
    suggestionState?.lockedCommand,
  ]);

  // Auto-switch to editor when a snippet is selected (e.g. from CollectionGridView)
  useEffect(() => {
    if (selectedSnippet) {
      // Clear search bar command state when opening an editor from favorites or elsewhere
      // This ensures any pending "command pill" (e.g. /ai) is removed
      searchbarRef.current?.clear();

      if (!isLinkCategory(selectedSnippet.category) && selectedSnippet.category !== 'prompt') {
        // Logic matching renderMainContent Priority 2 checks
        if (
          mainView.kind !== 'noteEditor' &&
          snippetBreadCrum &&
          (snippetBreadCrum.workspace_id || snippetBreadCrum.folder_id)
        ) {
          
          dispatch(navigateToView({ kind: 'noteEditor' }));
        }
      } else if (selectedSnippet.category === 'prompt') {
        if (mainView.kind !== 'promptEditor') {
          
          dispatch(navigateToView({ kind: 'promptEditor' }));
        }
      }
    }
  }, [selectedSnippet, mainView.kind, snippetBreadCrum]);

  // Ensure search bar is cleared when creating a new item
  useEffect(() => {
    if (isCreatingNewItem) {
      searchbarRef.current?.clear();
    }
  }, [isCreatingNewItem]);

  // Ensure search bar is cleared when link edit modal opens
  useEffect(() => {
    if (isLinkEditModalOpen) {
      searchbarRef.current?.clear();
    }
  }, [isLinkEditModalOpen]);

  // CLEAR BREADCRUMB: Auto-switch back to home view when editor states are cleared
  useEffect(() => {
    // If we're in noteEditor mode but all the editor states are cleared, go back to home
    if (
      (mainView.kind === 'noteEditor' || mainView.kind === 'promptEditor') &&
      !selectedSnippet &&
      !isCreatingNewItem &&
      !snippetBreadCrum
    ) {
      
      dispatch(navigateToView({ kind: 'home' }));
    }
  }, [mainView.kind, selectedSnippet, isCreatingNewItem, snippetBreadCrum]);

  // NEW ITEM CREATION: Auto-switch to noteEditor when creating new item
  useEffect(() => {
    if (
      isCreatingNewItem &&
      mainView.kind !== 'noteEditor' &&
      mainView.kind !== 'promptEditor' &&
      mainView.kind !== 'linkEditor'
    ) {
      
      dispatch(navigateToView({ kind: 'noteEditor' }));
    }
  }, [isCreatingNewItem, mainView.kind]);

  // Memoized selectedSnippet to prevent it from being lost during re-renders
  const memoizedSnippet = useRef(selectedSnippet);

  // Update the memoized value when the real value changes
  useEffect(() => {
    if (selectedSnippet) {
      memoizedSnippet.current = selectedSnippet;
    }
  }, [selectedSnippet]);

  // Use the memoized version if the real one is null but we have a breadcrumb
  const effectiveSnippet = isCreatingNewItem
    ? null
    : selectedSnippet || (snippetBreadCrum && memoizedSnippet.current) || null;

  // Clear the memoized snippet when navigating back to workspace view or home
  useEffect(() => {
    // CLEAR BREADCRUMB: Clear memoized snippet when going back to workspace view OR home view
    // Original condition: selectedWorkspace && !snippetBreadCrum && !selectedSnippet
    // Updated to also clear when going to home (no workspace selected)
    if (!snippetBreadCrum && !selectedSnippet) {
      memoizedSnippet.current = null;
    }
  }, [selectedWorkspace, snippetBreadCrum, selectedSnippet]);

  const hasReloadedRef = useRef(false);

  useEffect(() => {
    const term = (debouncedSearchTerm || '').trim();

    if (term.length === 0 && !hasReloadedRef.current) {
      reload(); // ✅ trigger only once
      hasReloadedRef.current = true;
    }

    if (term.length > 0) {
      hasReloadedRef.current = false; // reset so reload can fire next time it's cleared
    }
  }, [debouncedSearchTerm, reload]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, isSheetUIOpen]);

  const trimmedSearch = (debouncedSearchTerm || '').trim();

  const isAiLocked =
    suggestionState?.lockedCommand === 'ai' ||
    suggestionState?.lockedCommand === 'gpt' ||
    suggestionState?.lockedCommand === 'claude' ||
    suggestionState?.lockedCommand === 'perplexity' ||
    suggestionState?.lockedCommand === 'gemini';
  const isStoreLocked =
    (suggestionState?.lockedCommand as string) === 'store' ||
    (suggestionState?.lockedCommand as string) === 'saved-automation';

  const hasSearchTerm =
    trimmedSearch.length > 0 ||
    searchValue.trim().length > 0 ||
    (suggestionState?.value?.trim().length ?? 0) > 0 ||
    ((suggestionState?.selectedImagesCount ?? 0) > 0 && !suggestionState?.lockedCommand);

  const shouldShowSuggestions =
    (hasSearchTerm || suggestionState?.isVisible || isStoreLocked) && !isAiLocked && !isLinkEditModalOpen;

  const displayHomeView =
    !isLinkEditModalOpen &&
    !selectedSnippet &&
    !isCreatingNewItem &&
    trimmedSearch.length === 0 &&
    !suggestionState?.lockedCommand &&
    !suggestionState?.isAtMenuOpen &&
    !suggestionState?.isPromptMenuOpen;

  const isNarrowView = (displayHomeView && !isStoreLocked) || (shouldShowSuggestions && !isStoreLocked);

  const isBoardViewOpen = !!(
    isBoardViewEnabled &&
    !isStoreLocked &&
    suggestionState &&
    (shouldShowSuggestions && suggestionState.isVisible !== false) &&
    !suggestionState.isAtMenuOpen &&
    !suggestionState.isAutomationActive &&
    suggestionState.lockedCommand !== 'calendar' &&
    suggestionState.lockedCommand !== 'upload_drive' &&
    (mainView.kind !== 'allItems' || isStoreLocked) &&
    !isLinkEditModalOpen
  );

  useEffect(() => {
    onBoardViewOpenChange?.(isBoardViewOpen);
  }, [isBoardViewOpen, onBoardViewOpenChange]);

  const actionWorkspace = selectedWorkspace ?? selectedTeam?.workspaces?.[0] ?? null;
  const canCreateContent = Boolean(actionWorkspace);

  // When HomeView appears (search is cleared), ensure the first item is selected
  // and the search bar preview is updated to match it
  useEffect(() => {
    if (displayHomeView && homeViewRef.current) {
      // Use a small delay to ensure HomeView has rendered and computed interactiveItems
      const timeoutId = setTimeout(() => {
        homeViewRef.current?.focusFirstItem();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [displayHomeView]);

  // When search value becomes empty and we're in HomeView, ensure preview is restored
  // This handles the case when command mode exits (via Backspace/Escape) and value is empty
  // Also handles when the inline query box is cleared - we need to restore preview for the first item
  useEffect(() => {
    if (displayHomeView && homeViewRef.current && !searchValue.trim()) {
      // Trigger focusFirstItem to ensure the preview is restored for the first item
      // This ensures the search bar shows the correct icon/placeholder after exiting command mode
      // or clearing the inline query box
      const timeoutId = setTimeout(() => {
        homeViewRef.current?.focusFirstItem();
        // Also request preview restore from Searchbar to ensure it's updated
        // searchbarRef.current?.requestPreviewRestore();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [displayHomeView, searchValue]);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        setIsLoadingShareButton(true);
        const user_id = await getUserId();
        setUserId(user_id);
      } catch (error) {
        
      } finally {
        setIsLoadingShareButton(false);
      }
    };
    fetchUserId();
  }, []);

  const teamId = selectedTeam?.team_id || '';
  const workspacesFromRedux = useSelector((state: RootState) => selectWorkspacesByTeam(state, teamId));

  useEffect(() => {
    const teamWorkspaces = selectedTeam?.workspaces;
    if (teamId && workspacesFromRedux.length === 0 && teamWorkspaces && teamWorkspaces.length > 0) {
      dispatch(setWorkspacesFromAllData([{ teamId, workspaces: teamWorkspaces }]));
    }
  }, [dispatch, teamId, workspacesFromRedux.length, selectedTeam?.workspaces]);

  useEffect(() => {
    if (selectedWorkspace && workspacesFromRedux.length > 0) {
      const wsDetails = workspacesFromRedux.find(ws => ws.workspace_id === selectedWorkspace.workspace_id) as
        | WorkspaceDetails
        | undefined;
      if (wsDetails) {
        setWorkspaceDetails(wsDetails);
      }
    }
  }, [selectedWorkspace, workspacesFromRedux]);

  useEffect(() => {
    // Force dark mode only (temporarily disable light mode switching).
    dispatch(setDarkMode(true));
    document.documentElement.classList.add('dark');
    chrome.storage.local.set({ theme: 'dark' });
  }, [dispatch]);

  const toggleDarkMode = () => {
    // Theme switching is temporarily disabled; keep dark mode enforced.
    dispatch(setDarkMode(true));
    document.documentElement.classList.add('dark');
    chrome.storage.local.set({ theme: 'dark' });
  };

  const resolveWorkspace = (workspaceOverride?: Workspace | null): Workspace | null => {
    if (workspaceOverride) return workspaceOverride;
    if (selectedWorkspace) return selectedWorkspace;
    return null; // Do NOT default to the first workspace automatically
  };

  const handleAddNote = (workspaceOverride?: Workspace | null) => {
    // Only use an override or currently selected workspace; do NOT default to the first one in the team
    const workspaceToUse = workspaceOverride || selectedWorkspace || null;

    dispatch(
      setSnippetBreadCrum({
        workspace_id: workspaceToUse?.workspace_id || null,
        workspace_name: workspaceToUse?.workspace_name || null,
        folder_id: null,
        folder_name: null,
      }),
    );
    // If we have a workspace, use it; otherwise clear the selection
    dispatch(setSelectedWorkspace(workspaceToUse || null));
    dispatch(setSelectedFolder(null));
    dispatch(setSelectedSnippet(null));
    dispatch(setIsCreatingNewItem(true));
  };

  const handleAddLink = (folderId?: string, workspaceOverride?: Workspace | null) => {
    const workspaceToUse = resolveWorkspace(workspaceOverride);
    if (!workspaceToUse) {
      triggerToast('Select or create a workspace first', 'info');
      return;
    }

    dispatch(openLinkEditModal({ editMode: false, snippet: null }));
  };

  const handleGoHome = () => {
    setIsLinkSidebarOpen(false);
    dispatch(clearEditorStates());
    dispatch(setSelectedWorkspace(null));
    dispatch(setSelectedFolder(null));
    dispatch(setDebouncedSearchTerm(''));
    setSuggestionState(null);
    setSearchValue('');
    dispatch(navigateToView({ kind: 'home' }));
    // Focus search bar when going home (matching AltS behavior)
    setTimeout(() => {
      searchbarRef.current?.focus();
    }, 0);
  };

  const handleNavigateBack = useCallback(
    (forceNavigate?: any) => {
      const shouldForce = forceNavigate === true;
      const isEditorOpen =
        isLinkEditModalOpen ||
        isCreatingNewItem ||
        [
          'noteEditor',
          'promptEditor',
          'linkEditor',
          'aiEditor',
          'agentPanel',
          'todos',
          'bulk',
          'organizationSettings',
          'createOrganization',
          'sharedFolderCreation',
          'workspaceShare',
        ].includes(mainView?.kind);
      if (isEditorOpen || selectedSnippet) {
        if (isEditorDirty && !shouldForce) {
          dispatch({ type: 'uiState/setPendingNavigationAction', payload: { type: 'NAVIGATE_BACK' } });
          dispatch(setShowEditorSwitchWarning(true));
          return;
        }

        setIsLinkSidebarOpen(false);
        dispatch(closeLinkEditModal());
        dispatch(setSelectedSnippet(null));
        dispatch(setIsCreatingNewItem(false));
        dispatch(clearEditorStates());
        dispatch(setSelectedWorkspace(null));
        dispatch(setSelectedFolder(null));
        dispatch(setSnippetBreadCrum(null));
        dispatch(setDebouncedSearchTerm(''));
        setSuggestionState(null);
        setSearchValue('');
        dispatch(navigateToView({ kind: 'home' }));
        setTimeout(() => searchbarRef.current?.focus(), 0);
        return;
      } else if (selectedFolder) {
        // Logic for "Back" when inside a Folder
        dispatch(setSelectedFolder(null));
        // Collapse the folder in the sidebar
        dispatch(toggleFolder(selectedFolder.folder_id));
        dispatch(
          setSnippetBreadCrum({
            workspace_id: selectedWorkspace!.workspace_id,
            workspace_name: selectedWorkspace!.workspace_name,
            folder_id: null,
            folder_name: null,
          }),
        );
        dispatch(setScrollToFolderId(null));
      } else if (selectedWorkspace) {
        // Logic for "Back" when inside a Workspace (going to Home)
        dispatch(setSelectedWorkspace(null));
        dispatch(setSnippetBreadCrum(null));
        dispatch(setScrollToFolderId(null));

        // Collapse all workspaces in the sidebar
        dispatch(expandAllWorkspaces({}));
      }
      // Removed suggestion state and search clear to show results persistently during navigation
      // setSuggestionState(null);
      // setSearchValue('');
      // searchbarRef.current?.clear();
      setTimeout(() => searchbarRef.current?.focus(), 0);
    },
    [
      dispatch,
      selectedFolder,
      selectedWorkspace,
      selectedSnippet,
      isCreatingNewItem,
      isLinkEditModalOpen,
      mainView?.kind,
    ],
  );

  const handleHomeLinkEdit = useCallback(
    (item: SnippetSuggestion) => {
      const { snippet, workspace, folder } = item;
      if (!snippet) return;

      // For new snippets (no ID), workspace can be null as they'll select it in the modal.
      // For existing snippets, we require a workspace context.
      const isNew = !snippet.id && !snippet.snippet_id;
      if (!isNew && !workspace) return;

      const category = (snippet.category || '').toLowerCase();

      // Fix: Handle prompts in edit flow (Context Menu -> Edit)
      if (category === 'prompt') {
        dispatch(setSelectedWorkspace(workspace));
        dispatch(setSelectedFolder(folder ?? null));
        dispatch(setSelectedSnippet(snippet));
        dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: folder?.folder_id || null,
            folder_name: folder?.folder_name || null,
          }),
        );
        dispatch(navigateToView({ kind: 'promptEditor', promptProps: { snippet } }));
        return;
      }

      // If it's a TabGroup, use LinkEditModal as well for consistent UI
      // (removed: was opening BuildView/bulk editor for tabgroups)

      // All link types - open link editor modal
      dispatch(openLinkEditModal({ editMode: true, snippet }));
    },
    [dispatch],
  );

  const handlePromptEditRequest = useCallback(
    (item: SnippetSuggestion) => {
      const { snippet } = item;
      if (!snippet) return;
      // Fix: Ensure selectedSnippet is set so CreatePromptPanel can load the data
      dispatch(setSelectedSnippet(snippet));
      dispatch(navigateToView({ kind: 'promptEditor', promptProps: { snippet } }));
    },
    [dispatch],
  );

  // Listen for bulk editor open event from CollectionGridView
  useEffect(() => {
    const handleOpenBulkEditor = (event: CustomEvent) => {
      const snippet = event.detail?.snippet;
      const workspace = event.detail?.workspace;
      const folder = event.detail?.folder;

      if (snippet) {
        // Clear any locked command state in search bar
        searchbarRef.current?.clear();

        // Small delay to ensure clear completes before opening editor
        setTimeout(() => {
          // Explicitly close Link Editor if open
          if (isLinkEditModalOpen) {
            dispatch(closeLinkEditModal());
          }
          dispatch(setIsCreatingNewItem(false));
          // Ensure snippet is selected (BulkEditor might rely on it)
          dispatch(setSelectedSnippet(snippet));

          // The snippet should already be set in Redux by CollectionGridView/FolderItem/etc.
          // Just set the view to bulk, passing any workspace/folder context from the event
          dispatch(
            navigateToView({
              kind: 'bulk',
              bulkProps: {
                initialSnippet: snippet,
                workspace,
                folder,
              },
            }),
          );
        }, 10);
      }
    };

    window.addEventListener('openBulkEditor', handleOpenBulkEditor as EventListener);
    return () => {
      window.removeEventListener('openBulkEditor', handleOpenBulkEditor as EventListener);
    };
  }, [setMainView]);

  const handleRequestOpenUrls = useCallback(
    (urls: string[], title?: string) => {
      searchbarRef.current?.openUrls(urls, title);
    },
    [searchbarRef],
  );

  const handleHomeSnippetSelect = useCallback(
    (item: SnippetSuggestion) => {
      const { snippet, workspace, folder } = item;

      // 1. Navigation to grid view (Workspace/Folder selection)
      if (!snippet && workspace) {
        dispatch(setSelectedWorkspace(workspace));
        dispatch(setSelectedFolder(folder ?? null));
        dispatch(navigateToView({ kind: 'home' }));
        return;
      }

      if (!snippet || !workspace) return;

      // 2. Resolve action based on category
      const action = resolveNodeAction(snippet);

      // 3. Handle specific actions with early returns
      if (action === 'open_multiple_links') {
        const urls = extractUrlsFromSnippet(snippet);
        if (urls.length > 0) {
          handleRequestOpenUrls(urls, snippet.key);
          return;
        }
        // Fallback to editor if no urls found
        dispatch(navigateToView({ kind: 'linkEditor', linkProps: { editMode: true, snippet } }));
        return;
      }

      if (action === 'edit_link') {
        dispatch(navigateToView({ kind: 'linkEditor', linkProps: { editMode: true, snippet } }));
        return;
      }

      if (action === 'view_prompt') {
        dispatch(setSelectedWorkspace(workspace));
        dispatch(setSelectedFolder(folder ?? null));
        dispatch(setSelectedSnippet(snippet));
        dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: folder?.folder_id || null,
            folder_name: folder?.folder_name || null,
          }),
        );
        dispatch(navigateToView({ kind: 'promptEditor', promptProps: { snippet } }));
        return;
      }

      // 4. Default: Note Editor
      // Ensure searchbar is cleared when entering editor
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      dispatch(setSelectedWorkspace(workspace));
      dispatch(setSelectedFolder(folder ?? null));
      dispatch(
        viewSnippet({
          snippet,
          breadcrumb: {
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: folder?.folder_id || null,
            folder_name: folder?.folder_name || null,
          },
        }),
      );
      dispatch(
        navigateToView({
          kind: 'noteEditor',
          noteProps: {
            snippet,
            breadcrumb: {
              workspace_id: workspace.workspace_id,
              workspace_name: workspace.workspace_name,
              folder_id: folder?.folder_id || null,
              folder_name: folder?.folder_name || null,
            },
          },
        }),
      );
    },
    [dispatch, handleRequestOpenUrls],
  );

  // Handle snippet selection from search (like AltS)
  const handleSearchSnippetSelect = useCallback(
    (item: SnippetSuggestion) => {
      if (!item.workspace) return;

      // Clear and blur search bar (matching AltS behavior)
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      handleHomeSnippetSelect(item);
    },
    [handleHomeSnippetSelect],
  );

  const normalizeAutomationForExecution = useCallback((automation: any) => {
    const mapSteps = (steps: any[]): any[] =>
      (steps || []).map((step: any, index: number) => {
        const rawSubSteps = Array.isArray(step?.subSteps) ? step.subSteps : step?.sub_steps || [];
        return {
          ...step,
          id: step?.id || `step-${index + 1}`,
          moduleId: String(step?.moduleId || step?.module_id || step?.module || step?.module_key || step?.type || ''),
          config: step?.config || step?.params || step?.parameters || {},
          subSteps: Array.isArray(rawSubSteps) ? mapSteps(rawSubSteps) : [],
        };
      });

    const rawSteps = Array.isArray(automation?.steps)
      ? automation.steps
      : Array.isArray(automation?.automation_steps)
        ? automation.automation_steps
        : [];

    return {
      ...automation,
      id: String(automation?.id || automation?.automation_id || automation?.name || 'automation'),
      steps: mapSteps(rawSteps),
      inputs: automation?.inputs || automation?.automation_inputs || [],
    };
  }, []);

  const handleAutomationSelect = useCallback(
    (automation: SavedAutomation) => {
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      const normalized = normalizeAutomationForExecution(automation);
      runAutomation(normalized as any);
    },
    [normalizeAutomationForExecution],
  );

  const handleAutomationEdit = useCallback(
    (automation: SavedAutomation) => {
      if (searchbarRef.current) {
        searchbarRef.current.clear();
        searchbarRef.current.blur();
      }

      const normalizedAuto = normalizeAutomationForExecution(automation);

      dispatch(
        navigateToView({
          kind: 'agentPanel',
          agentProps: { editMode: true, automation: normalizedAuto },
        }),
      );
    },
    [dispatch, normalizeAutomationForExecution],
  );

  const handleRunAutomationFromAiPanel = useCallback(
    (automation: any) => {
      // Use the searchbar's built-in locking mechanism to ensure state sync and prevent render loops
      searchbarRef.current?.lockCommand(null);

      dispatch(navigateToView({ kind: 'searchSuggestions' }));
      const invokeActivation = (attempt: number) => {
        if (searchbarRef.current?.activateAutomation) {
          // Pass the raw automation; searchbar's activateAutomation handles normalization
          searchbarRef.current.activateAutomation(automation);
          return;
        }
        if (attempt >= 10) {
          triggerToast('Search bar is not ready yet. Please try again.', 'warning');
          return;
        }
        setTimeout(() => invokeActivation(attempt + 1), 40);
      };
      setTimeout(() => invokeActivation(0), 10);
    },
    [dispatch, searchbarRef, triggerToast],
  );

  const handleEditAutomationFromAiPanel = useCallback(
    (automation: SavedAutomation) => {
      setSuggestionState(prev => (prev ? { ...prev, lockedCommand: null, value: '' } : prev));
      handleAutomationEdit(automation);
    },
    [handleAutomationEdit],
  );

  const handleExecuteModuleFromAiPanel = useCallback(
    (module: any) => {
      const moduleId = String(module?.module_id || module?.id || '');
      if (!moduleId) return;

      // Use the searchbar's built-in locking mechanism to ensure state sync and prevent render loops
      searchbarRef.current?.lockCommand(null);

      dispatch(navigateToView({ kind: 'searchSuggestions' }));
      const invokeModule = (attempt: number) => {
        if (searchbarRef.current?.executeModule) {
          searchbarRef.current.executeModule(moduleId);
          return;
        }
        if (attempt >= 10) {
          triggerToast('Search bar is not ready yet. Please try again.', 'warning');
          return;
        }
        setTimeout(() => invokeModule(attempt + 1), 40);
      };
      setTimeout(() => invokeModule(0), 10);
    },
    [dispatch, searchbarRef, triggerToast],
  );

  // Expose handler to parent (App) so it can pass to SideBar
  useEffect(() => {
    if (onSnippetSelectFromSearch) {
      (window as any).__containerSnippetSelectHandler = handleSearchSnippetSelect;
    }
  }, [handleSearchSnippetSelect, onSnippetSelectFromSearch]);

  const handleHomeDeleteRequest = useCallback(
    async (detail: SnippetActionDetail) => {
      if (!detail) return;

      try {
        // Show loading status
        dispatch(setCommandStatus({ status: 'loading', message: `Deleting "${detail.snippetKey}"...` }));

        if (detail.commandId === 'delete_folder') {
          if (!detail.orgId || !detail.workspaceId) {
            throw new Error('Missing org or workspace ID for folder deletion');
          }
          await deleteSharedFolder(detail.snippetId, detail.orgId, detail.workspaceId, selectedTeam?.storageMode ?? 'cloud');
        } else {
          dispatch(
            optimisticDeleteSnippet({
              teamId: detail.orgId || '', // Fallback, but orgId should be available
              workspaceId: detail.workspaceId,
              folderId: detail.folderId,
              snippetId: detail.snippetId,
            }),
          );
          await deleteSnippet(detail.folderId ?? undefined, detail.snippetId, selectedTeam?.storageMode ?? 'cloud');
        }

        // Show success status in footer
        dispatch(setCommandStatus({ status: 'success', message: 'Deleted successfully' }));

        // Clear status after delay
        setTimeout(() => {
          dispatch(setCommandStatus({ status: 'idle', message: '' }));
        }, 3000);

        reload();
        if (
          selectedSnippet &&
          (selectedSnippet.id === detail.snippetId || selectedSnippet.snippet_id === detail.snippetId)
        ) {
          dispatch(setSelectedSnippet(null));
          dispatch(setSnippetBreadCrum(null));
          dispatch(setIsCreatingNewItem(false));
        }
      } catch (error: any) {
        console.error('Delete failed:', error);
        const message = error?.response?.data?.error || error?.message || 'Failed to delete';
        dispatch(setCommandStatus({ status: 'error', message: message }));
        // Clear error after delay
        setTimeout(() => {
          dispatch(setCommandStatus({ status: 'idle', message: '' }));
        }, 3000);
      }
    },
    [deleteSnippet, dispatch, reload, selectedSnippet],
  );

  const handleCloseHomeDeleteDialog = useCallback(() => {
    setHomeDeleteContext({ isOpen: false, detail: null });
  }, []);

  const handleConfirmHomeDelete = useCallback(async () => {
    const detail = homeDeleteContext.detail;
    if (!detail) return;

    // Close dialog immediately for better UX
    setHomeDeleteContext({ isOpen: false, detail: null });

    try {
      // Show loading status
      dispatch(setCommandStatus({ status: 'loading', message: `Deleting "${detail.snippetKey}"...` }));

      if (detail.commandId === 'delete_folder') {
        if (!detail.orgId || !detail.workspaceId) {
          throw new Error('Missing org or workspace ID for folder deletion');
        }
        await deleteSharedFolder(detail.snippetId, detail.orgId, detail.workspaceId, selectedTeam?.storageMode ?? 'cloud');
      } else {
        dispatch(
          optimisticDeleteSnippet({
            teamId: detail.orgId || '', // Fallback, but orgId should be available
            workspaceId: detail.workspaceId,
            folderId: detail.folderId,
            snippetId: detail.snippetId,
          }),
        );
        await deleteSnippet(detail.folderId ?? undefined, detail.snippetId, selectedTeam?.storageMode ?? 'cloud');
      }

      // Show success status in footer
      dispatch(setCommandStatus({ status: 'success', message: 'Deleted successfully' }));

      // Clear status after delay
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);

      reload();
      if (
        selectedSnippet &&
        (selectedSnippet.id === detail.snippetId || selectedSnippet.snippet_id === detail.snippetId)
      ) {
        dispatch(setSelectedSnippet(null));
        dispatch(setSnippetBreadCrum(null));
        dispatch(setIsCreatingNewItem(false));
      }
    } catch (error: any) {
      console.error('Delete failed:', error);
      const message = error?.response?.data?.error || error?.message || 'Failed to delete';
      dispatch(setCommandStatus({ status: 'error', message: message }));
      // Clear error after delay
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);
    }
  }, [deleteSnippet, dispatch, homeDeleteContext.detail, reload, selectedSnippet]);

  // Handle workspace rename/delete events from searchbar commands (matching AltS behavior)
  const [workspaceActionContext, setWorkspaceActionContext] = useState<{
    isOpen: boolean;
    action: 'rename' | 'delete' | null;
    detail: WorkspaceActionDetail | null;
  }>({ isOpen: false, action: null, detail: null });

  const handleWorkspaceActionEvent = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceActionDetail>).detail;
      if (!detail) return;
      const eventType = (event as CustomEvent).type;
      const action = eventType === LOCAL_COMMAND_EVENTS.workspaceRename ? 'rename' : 'delete';
      setWorkspaceActionContext({ isOpen: true, action, detail });
      // Clear search bar after triggering workspace action
      setTimeout(() => {
        searchbarRef.current?.clear();
        searchbarRef.current?.focus();
      }, 0);
    },
    [searchbarRef],
  );

  useEffect(() => {
    window.addEventListener(LOCAL_COMMAND_EVENTS.workspaceRename, handleWorkspaceActionEvent as EventListener);
    window.addEventListener(LOCAL_COMMAND_EVENTS.workspaceDelete, handleWorkspaceActionEvent as EventListener);

    const handleSnippetDeleteEvent = (event: Event) => {
      
      const detail = (event as CustomEvent<SnippetActionDetail>).detail;
      if (detail) {
        setHomeDeleteContext({ isOpen: true, detail });
      }
    };
    window.addEventListener(LOCAL_COMMAND_EVENTS.snippetDelete, handleSnippetDeleteEvent as EventListener);

    return () => {
      window.removeEventListener(LOCAL_COMMAND_EVENTS.workspaceRename, handleWorkspaceActionEvent as EventListener);
      window.removeEventListener(LOCAL_COMMAND_EVENTS.workspaceDelete, handleWorkspaceActionEvent as EventListener);
      window.removeEventListener(LOCAL_COMMAND_EVENTS.snippetDelete, handleSnippetDeleteEvent as EventListener);
    };
  }, [handleWorkspaceActionEvent]);

  // Handle folder rename/delete events from searchbar commands (matching AltS behavior)
  const [folderActionContext, setFolderActionContext] = useState<{
    isOpen: boolean;
    action: 'rename' | 'delete' | null;
    detail: FolderActionDetail | null;
  }>({ isOpen: false, action: null, detail: null });

  const handleFolderActionEvent = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent<FolderActionDetail>).detail;
      if (!detail) return;
      const eventType = (event as CustomEvent).type;
      const action = eventType === LOCAL_COMMAND_EVENTS.folderRename ? 'rename' : 'delete';
      setFolderActionContext({ isOpen: true, action, detail });
      // Clear search bar after triggering folder action
      setTimeout(() => {
        searchbarRef.current?.clear();
        searchbarRef.current?.focus();
      }, 0);
    },
    [searchbarRef],
  );

  useEffect(() => {
    window.addEventListener(LOCAL_COMMAND_EVENTS.folderRename, handleFolderActionEvent as EventListener);
    window.addEventListener(LOCAL_COMMAND_EVENTS.folderDelete, handleFolderActionEvent as EventListener);
    return () => {
      window.removeEventListener(LOCAL_COMMAND_EVENTS.folderRename, handleFolderActionEvent as EventListener);
      window.removeEventListener(LOCAL_COMMAND_EVENTS.folderDelete, handleFolderActionEvent as EventListener);
    };
  }, [handleFolderActionEvent]);

  // Handle snippet delete events from searchbar commands (matching AltS behavior)
  useEffect(() => {
    const handleSnippetDeleteEvent = (event: Event) => {
      const detail = (event as CustomEvent<SnippetActionDetail>).detail;
      if (!detail) return;
      handleHomeDeleteRequest(detail);
    };
    window.addEventListener(LOCAL_COMMAND_EVENTS.snippetDelete, handleSnippetDeleteEvent as EventListener);
    return () => {
      window.removeEventListener(LOCAL_COMMAND_EVENTS.snippetDelete, handleSnippetDeleteEvent as EventListener);
    };
  }, [handleHomeDeleteRequest]);

  // Allow InteractiveItemsList (HomeView) to return focus back to the search bar
  const handleRequestFocusSearch = useCallback(() => {
    

    if (searchbarRef.current) {
      searchbarRef.current.focus();
    }
  }, [searchbarRef]);

  // Handle command preview (matching AltS behavior)
  // This must clear immediately when navigating to notes to ensure icon updates synchronously.
  const handleCommandPreview = useCallback((commandId: CommandId | 'ai' | null) => {
    if (!searchbarRef.current) return;
    if (commandId) {
      searchbarRef.current.previewCommand(commandId);
    } else {
      searchbarRef.current.clearCommandPreview();
    }
  }, []);

  // Global keyboard handler for closing command list with Escape/Backspace
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // HARD FIX: If favorites context menu or Todo dashboard is open, ignore ALL navigation/keys here
      if ((window as any).isFavoritesMenuOpen || (window as any).isTodoDashboardOpen) return;

      // Only handle if command list is open
      if (!isCommandListView) return;

      // Check if user is typing in an input/textarea (don't interfere with editing)
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // If Escape or Backspace pressed and not typing in an input
      if ((e.key === 'Escape' || e.key === 'Backspace') && !isInputElement) {
        // For Backspace, only close if there's no text selection
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Don't close if user is selecting text
          }
        }

        e.preventDefault();
        e.stopPropagation();

        // Close command list
        onClearCommandListView?.();
        onToggleCommandListView?.(false);

        // Refocus search bar
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 0);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true); // Use capture phase
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isCommandListView, onClearCommandListView, onToggleCommandListView]);

  // Global keyboard handler for closing templates view with Escape/Backspace
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // HARD FIX: If favorites context menu or Todo dashboard is open, ignore ALL navigation/keys here
      if ((window as any).isFavoritesMenuOpen || (window as any).isTodoDashboardOpen) return;

      // Only handle if templates view is open
      if (!isTemplatesView) return;

      // Check if user is typing in an input/textarea (don't interfere with editing)
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // If Escape or Backspace pressed and not typing in an input
      if ((e.key === 'Escape' || e.key === 'Backspace') && !isInputElement) {
        // For Backspace, only close if there's no text selection
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Don't close if user is selecting text
          }
        }

        e.preventDefault();
        e.stopPropagation();

        // Close templates view
        onToggleTemplatesView?.(false);

        // Refocus search bar
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 0);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true); // Use capture phase
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isTemplatesView, onToggleTemplatesView]);

  // Refocus search bar when templates view opens
  useEffect(() => {
    if (isTemplatesView) {
      // Use requestAnimationFrame to wait for React render completion
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 100);
      });
    }
  }, [isTemplatesView]);

  const handleInteractiveItemHighlight = useCallback((item: InteractiveItem | null) => {
    if (!searchbarRef.current) return;

    if (!item) {
      // When nothing is highlighted, clear any command preview.
      searchbarRef.current.clearCommandPreview();
      return;
    }

    if (item.kind === 'command') {
      // For commands: DON'T change the typed value (no "/g", "/ai" injection).
      // HomeView already calls onCommandPreview, which updates the icon and inline box.
      return;
    }

    // For notes/links: clear any previous command preview so we fall back to default search icon.
    searchbarRef.current.clearCommandPreview();
  }, []);

  const handleCommandExecute = useCallback(
    async (
      commandId: CommandId | LocalCommandId | 'ai',
      options?: { prompt?: string; files?: { base64: string; filename: string }[] },
    ) => {
      

      
      const alreadyTracked = Boolean((options as any)?.__tracked);
      if (!alreadyTracked) {
        trackCounterEvent('command_count', {
          source: 'new_tab',
          commandId,
          commandType: isLocalCommandId(commandId as string) ? 'local' : 'remote',
          via: 'container',
        });
      }
      // Guard: Prevent local commands from executing if user is not logged in
      if (isLocalCommandId(commandId as string) && !isLoggedIn) {
        console.warn('[DEBUG Container.tsx] user not logged in for local command:', commandId);
        const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
        setLoginRequiredDialog({
          isOpen: true,
          commandName: localDef?.label || String(commandId),
        });
        return;
      }

      // Guard: If any editor has unsaved changes, show warning and defer the command
      if (isEditorDirty) {
        
        dispatch({
          type: 'uiState/setPendingNavigationAction',
          payload: { type: 'EXECUTE_COMMAND', payload: { commandId: commandId as string, options } },
        });
        dispatch(setShowEditorSwitchWarning(true));
        return;
      }

      
      // Close the Link Edit Modal first (explicit dispatch) before clearing other states
      if (isLinkEditModalOpen) {
        
        dispatch(closeLinkEditModal());
      }

      // Explicitly clear any active editor states before running a command
      // This ensures a clean transition (closing notes/links) as requested by the user.
      dispatch(clearEditorStates());

      // Clear search bar and suggestions for instant feedback
      // Special case: don't clear for view-locking commands like 'saved-automation'
      if (commandId !== 'saved-automation' && (commandId as any) !== 'store') {
        setSearchValue('');
        setSuggestionState(null);
        searchbarRef.current?.clear();
      }

      const context: CommandContext = {
        dispatch,
        prompt: options?.prompt,
        files: options?.files,
        state: store.getState() as RootState,
        previouslySelectedFolder: null, // new-tab doesn't track this the same way as AltS popup
        services: {
          toast: (msg, type) => triggerToast(msg, type || 'info'),
          navigation: (view: any) => {
            
            // Handle specific view requests from commands
            if (view.kind === 'noteEditor') {
              
              dispatch(navigateToView({ kind: 'noteEditor', noteProps: view.noteProps }));
              dispatch(setIsCreatingNewItem(true));
            } else if (view.kind === 'linkEditor') {
              
              dispatch(navigateToView({ kind: 'linkEditor', linkProps: view.linkProps }));
              dispatch(setIsCreatingNewItem(true));
            } else if (view.kind === 'agentPanel') {
              
              dispatch(navigateToView({ kind: 'agentPanel', agentProps: view.agentProps }));
            } else if (view.kind === 'promptEditor') {
              dispatch(navigateToView({ kind: 'promptEditor', promptProps: view.promptProps }));
              dispatch(setIsCreatingNewItem(true));
            } else if (view.kind === 'store') {
              
              dispatch(navigateToView({ kind: 'store' }));
            } else if (view.kind === 'allItems') {
              
              // Don't clear search bar - user can filter items using main searchbar
              setSuggestionState(null);
              dispatch(navigateToView({ kind: 'allItems', itemType: view.itemType }));
              // Ensure focus logic runs after render
              setTimeout(() => {
                searchbarRef.current?.focus();
              }, 10);
            } else if (view.kind === 'bulk') {
              
              dispatch(navigateToView({ kind: 'bulk' }));
            } else if (view.kind === 'commandList') {
              
              if (view.category) {
                onCommandListCategoryChange?.(view.category);
              }
              onToggleCommandListView?.(true);
            } else if (view.kind === 'templatesView') {
              
              onToggleTemplatesView?.(true);
              // Refocus search bar after templates view opens (using requestAnimationFrame for React render completion)
              requestAnimationFrame(() => {
                setTimeout(() => {
                  if (searchbarRef.current) {
                    searchbarRef.current.focus();
                  }
                }, 50);
              });
            } else if (view.kind === 'createOrganization') {
              
              // Removed search clear to support persistent suggestions
              // searchbarRef.current?.clear();
              // setSearchValue('');
              // setSuggestionState(null);
              dispatch(navigateToView({ kind: 'createOrganization' }));
            } else if (commandId === 'showallnotes') {
              
              setSuggestionState(null);
              dispatch(navigateToView({ kind: 'allItems', itemType: 'notes' }));
              // Ensure focus logic runs after render
              setTimeout(() => {
                searchbarRef.current?.focus();
              }, 10);
            } else if (commandId === 'showalllinks') {
              
              setSuggestionState(null);
              dispatch(navigateToView({ kind: 'allItems', itemType: 'links' }));
              // Ensure focus logic runs after render
              setTimeout(() => {
                searchbarRef.current?.focus();
              }, 10);
            }
          },
          reload: handleReload,
        },
      };

      if (commandId === 'shortcuts') {
        onToggleCommandListView?.(true);
        return;
      }

      if (commandId === 'showallnotes') {
        dispatch(navigateToView({ kind: 'allItems', itemType: 'notes' }));
        setSuggestionState(null);
        setTimeout(() => searchbarRef.current?.focus(), 0);
        return;
      }

      if (commandId === 'showalllinks') {
        dispatch(navigateToView({ kind: 'allItems', itemType: 'links' }));
        setSuggestionState(null);
        setTimeout(() => searchbarRef.current?.focus(), 0);
        return;
      }

      await commandRegistry.execute(commandId as string, context);
    },
    [
      dispatch,
      store,
      triggerToast,
      handleReload,
      onToggleCommandListView,
      isLoggedIn,
      onNavigateToListView,
      onToggleTemplatesView,
      onCommandListCategoryChange,
    ],
  );

  // Handle Link Creation
  useEffect(() => {
    if (isCreatingNewItem && mainView.kind === 'linkEditor') {
      dispatch(openLinkEditModal({ editMode: false, snippet: null }));
    }
  }, [isCreatingNewItem, mainView.kind, dispatch]);

  // Handle Note Creation - switch to noteEditor when creating new note
  useEffect(() => {
    if (
      isCreatingNewItem &&
      snippetBreadCrum &&
      (snippetBreadCrum.workspace_id || snippetBreadCrum.folder_id) &&
      mainView.kind !== 'linkEditor' &&
      mainView.kind !== 'promptEditor'
    ) {
      // If we are already in noteEditor, don't re-navigate (which clears props)
      if (mainView.kind === 'noteEditor') {
        return;
      }
      
      dispatch(navigateToView({ kind: 'noteEditor' }));
    }
  }, [isCreatingNewItem, snippetBreadCrum, mainView.kind]);

  // We no longer move focus explicitly from the search bar into HomeView here.
  // InteractiveItemsList listens to global keydown events (like AltS) and
  // handles ArrowUp/ArrowDown navigation while the search input stays focused.

  // Determines what to render in the main content area
  const renderMainContent = () => {
    // Priority -1: Sheet UI
    if (isSheetUIOpen) {
      return (
        <div className="flex-1 w-full flex overflow-auto p-[1px]">
          <SheetUI
            onClose={onCloseSheetUI}
            savedAutomations={savedAutomations}
            savedAgents={savedAiAgents}
            installedModules={installedModules}
            onCreateOrganization={handleCreateOrganization}
            onOrganizationSettings={handleOrganizationSettings}
            onCreateWorkspace={onCreateWorkspace}
            isLoggedIn={isLoggedIn}
            onRequireLogin={() => setLoginRequiredDialog({ isOpen: true, commandName: 'Sheet Options' })}
            onBoardViewRedirect={onBoardViewRedirect}
          />
        </div>
      );
    }

    // Priority 0: Templates View (dedicated, separate from command list)
    if (isTemplatesView) {
      
      return (
        <div className="flex-1 min-h-0 w-full h-full">
          <div
            className="flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden bg-transparent rounded-xl shadow-sm">
            <TemplatesView
              isLoggedIn={isLoggedIn}
              selectedCategory={templatesCategory}
              onClose={() => {
                onToggleTemplatesView?.(false);
                dispatch(navigateToView({ kind: 'home' }));
                // Refocus search bar after closing templates view
                setTimeout(() => {
                  if (searchbarRef.current) {
                    searchbarRef.current.focus();
                  }
                }, 0);
              }}
              activeTab={templatesActiveTab}
              onTabChange={setTemplatesActiveTab}
              onCountsUpdate={setTemplatesCounts}
              onCategoryChange={onTemplatesCategoryChange}
            />
          </div>
        </div>
      );
    }

    const isAiLocked = suggestionState?.lockedCommand === 'ai' ||
      suggestionState?.lockedCommand === 'gpt' ||
      suggestionState?.lockedCommand === 'claude' ||
      suggestionState?.lockedCommand === 'perplexity' ||
      suggestionState?.lockedCommand === 'gemini';
    if (mainView.kind === 'aiEditor' || isAiLocked) {
      const aiState = suggestionState || {
        lockedCommand: 'ai',
        value: '',
        isSuggestionVisible: false,
        showAIHistoryPanel: false,
        isVisible: true,
        selectedAIs: [],
      };
      return (
        <div className="flex h-[90%] w-full justify-center relative bg-transparent overflow-visible">
          <div
            className="flex-1 h-full min-h-0 relative rounded-xl dark:rounded-none overflow-visible"
            style={{ border: 'none' }}>
            <AICommandLockedUI
              key="ai-editor"
              state={aiState as SuggestionState}
              initialTab="agents"
              isMac={isMac}
              savedAgents={savedAiAgents}
              isLoggedIn={isLoggedIn}
              savedAutomations={savedAutomations}
              onSelectSavedAgent={handleSelectSavedAgent}
              onRunAutomation={handleRunAutomationFromAiPanel}
              onEditAutomation={handleEditAutomationFromAiPanel}
              onExecuteModule={handleExecuteModuleFromAiPanel}
              onNewChat={handleNewChat}
              onQueryChange={handleAIQueryChange}
              onSaveAgent={() => {
                if (!isLoggedIn) {
                  setLoginRequiredDialog({ isOpen: true, commandName: 'Save Agent' });
                } else {
                  setIsSaveAgentModalOpen(true);
                }
              }}
              onClose={() => {
                handleNavigateBack();
              }}
              onSubmit={(prompt: string) => {
                searchbarRef.current?.submitAI(prompt);
              }}
              onFileUpload={() => {
                searchbarRef.current?.triggerFileUpload();
              }}
            />
          </div>
        </div>
      );
    }

    // Priority 0.5: Command Palette Mode
    // Check if we show command palette
    if (isCommandListView) {
      // For templates, render full page without container constraints
      if (commandListCategory === 'templates') {
        return (
          <div className="flex-1 min-h-0 w-full h-full">
            <CommandPaletteContainer
              activeCategory={commandListCategory || 'commands'}
              searchQuery={searchValue}
              onClose={() => {
                onToggleCommandListView?.(false);
                // Refocus search bar after closing command list
                setTimeout(() => {
                  if (searchbarRef.current) {
                    searchbarRef.current.focus();
                  }
                }, 0);
              }}
              activeSection={activeCommandSection || 'local'}
              onSectionChange={onCommandSectionChange || (() => { })}
            />
          </div>
        );
      }

      
      return (
        <div className="flex-1 min-h-0">
          <div
            className="flex-1 min-h-0 h-[90%] w-full flex flex-col overflow-hidden rounded-xl border shadow-sm bg-containerBg border-borderDefault">
            <CommandPaletteContainer
              activeCategory={commandListCategory || 'commands'}
              searchQuery={searchValue}
              onClose={() => {
                onToggleCommandListView?.(false);
                // Refocus search bar after closing command list
                setTimeout(() => {
                  if (searchbarRef.current) {
                    searchbarRef.current.focus();
                  }
                }, 0);
              }}
              activeSection={activeCommandSection || 'local'}
              onSectionChange={onCommandSectionChange || (() => { })}
            />
          </div>
        </div>
      );
    }

    // Priority 1: Editor
    const showEditor = (isCreatingNewItem || effectiveSnippet) && mainView.kind === 'noteEditor';

    if (isLinkEditModalOpen) {
      return (
        <div className="flex-1 min-h-0 flex justify-center items-start pt-[67px] pb-6">
          {/* Invisible wrapper that centers exactly like the full 1000px modal */}
          <div className="w-[calc(100%-48px)] max-w-[1000px] flex justify-center">
            {/* The actual modal, which shrinks to fit its content and expands to the right */}
            <div className="max-h-[calc(100vh-134px)] h-fit min-h-[450px] w-fit max-w-full flex flex-col bg-[var(--color-editorBg)] rounded-xl border border-neutral-800 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
              <LinkEditModal
                isOpen={isLinkEditModalOpen}
                onClose={handleCloseLinkEditModal}
                snippet={activeLinkSnippet}
                prefill={linkEditPrefill}
                reload={handleReload}
                onDirtyChange={handleEditorDirtyChange}
              />
            </div>
          </div>
        </div>
      );
    }

    // Agent Panel
    if (mainView.kind === 'agentPanel') {
      
      const agentProps = (mainView as any).agentProps || {};
      return (
        <div className="flex-1 min-h-0 w-full flex flex-col items-center transition-all duration-300 px-4">
          <div className="h-[90%] flex justify-center bg-transparent transition-all duration-300 rounded-xl overflow-hidden w-full max-w-[1440px] ">
            <div
              className={`flex flex-col overflow-hidden transition-all duration-[400ms] ease-in-out rounded-xl  shadow-2xl border border-white/10 ${agentProps.automation?.steps?.some((s: any) => {
                const text = s.config?.url || s.config?.content || s.config?.selectorElementName || '';
                return text.length > 55;
              })
                ? 'w-[70%]'
                : 'w-[65%]'
                }`}>
              <AgentPanel
                isOpen={true}
                onClose={handleNavigateBack}
                editMode={agentProps.editMode}
                automation={agentProps.automation}
                reload={handleReload}
                onPickerToggle={setIsAgentPickerOpen}
                onSpeakerPropsChange={setAgentSpeakerProps}
                onDirtyChange={handleEditorDirtyChange}
              />
            </div>
          </div>
        </div>
      );
    }

    if (showEditor) {
      // Determine based on category:
      // If category is explicitly 'note', use SnippetEditor (Dynamic)
      // Else (including 'snippet' or undefined), use RichTextEditor (Standard)
      // Wait, previous logic was: 'note' => Snippet Label (Dynamic), 'snippet' => Note Label (Static)
      // Let's stick to the plan:
      // SnippetEditor for Snippets (Dynamic, @ variable support)
      // RichEditor for Notes (Static, no @ variable support)

      // We need to check the category of the item we are about to edit.
      // This comes from selectedSnippet OR snippetBreadCrum context if creating new?
      // Actually Container logic usually mounts RichTextEditor when mainView.kind === 'noteEditor'.
      // We should check the category prop passed to it, or derive it.

      // The mainView state for 'noteEditor' might have props.
      // const noteViewProps = mainView.kind === 'noteEditor' ? mainView : {};

      // Let's check selectedSnippet?.category.
      // If creating new, we might need a hint.
      // The 'category' prop was passed to RichTextEditor.

      const isSnippetMode =
        selectedSnippet?.category === 'snippet' ||
        (isCreatingNewItem && mainView.kind === 'noteEditor' && (mainView as any).noteProps?.category === 'snippet');
      // console.log('[Container] isSnippetMode:', isSnippetMode);

      if (mainView.kind === 'noteEditor') {
        if (isSnippetMode) {
          return (
            <div className="flex-1 min-h-0 pt-6">
              <div
                className={`${isFocusMode || isCreatingEditorView ? 'h-full' : 'h-full'} w-full flex flex-col overflow-hidden`}>
                <SnippetEditor
                  selectedTeamId={selectedTeam?.team_id || ''}
                  selectedSnippet={effectiveSnippet}
                  isCreatingNew={isCreatingNewItem}
                  snippetBreadCrum={snippetBreadCrum}
                  reload={handleReload}
                  favoritesMapping={favoritesMapping}
                  setFavoritesMapping={data => setFavoritesMapping(data)} // fix type mismatch if any
                  onBack={() => {
                    setSearchValue('');
                    setSuggestionState(null);
                    searchbarRef.current?.clear();
                    dispatch(setIsEditorDirty(false));
                    dispatch(setShowEditorSwitchWarning(false));
                    dispatch(clearEditorStates());
                    dispatch(setSelectedWorkspace(null));
                    dispatch(setSelectedFolder(null));
                    dispatch(navigateToView({ kind: 'home' }));
                    onToggleCommandListView?.(false); // Reset command list view so it doesn't stay expanded
                  }}
                  initialDraftKey={(mainView as any).initialDraftKey}
                  initialDraftContent={(mainView as any).initialDraftContent}
                  category="snippet"
                  onDirtyChange={handleEditorDirtyChange}
                />
              </div>
            </div>
          );
        } else {
          return (
            <div className="flex-1 min-h-0 pt-6">
              <div
                className={`${isFocusMode || isCreatingEditorView ? 'h-full' : 'h-full  '} w-full flex flex-col overflow-hidden`}>
                <RichTextEditor
                  selectedTeamId={selectedTeam?.team_id || ''}
                  selectedSnippet={effectiveSnippet}
                  isCreatingNew={isCreatingNewItem}
                  snippetBreadCrum={snippetBreadCrum}
                  reload={handleReload}
                  favoritesMapping={favoritesMapping}
                  setFavoritesMapping={data => setFavoritesMapping(data)}
                  onBack={() => {
                    setSearchValue('');
                    setSuggestionState(null);
                    searchbarRef.current?.clear();
                    dispatch(setIsEditorDirty(false));
                    dispatch(setShowEditorSwitchWarning(false));
                    dispatch(clearEditorStates());
                    dispatch(setSelectedWorkspace(null));
                    dispatch(setSelectedFolder(null));
                    dispatch(navigateToView({ kind: 'home' }));
                    onToggleCommandListView?.(false); // Reset command list view so it doesn't stay expanded
                  }}
                  initialDraftKey={(mainView as any).initialDraftKey}
                  initialDraftContent={(mainView as any).initialDraftContent}
                  category="note"
                  onDirtyChange={handleEditorDirtyChange}
                />
              </div>
            </div>
          );
        }
      }
    }

    // Priority 2.5: Prompt Editor
    if (mainView.kind === 'promptEditor') {
      return (
        <div className="flex-1 min-h-0">
          <div
            className={`${isFocusMode || isCreatingEditorView ? 'h-full' : 'h-full'} w-full flex flex-col overflow-hidden`}>
            <CreatePromptPanel onClose={handleGoHome} />
          </div>
        </div>
      );
    }

    // Priority 2: Absolute Persistent Search Suggestions (Overlays secondary views)


    const isBoardSlashDropdownActive = (() => {
      if (!isBoardViewEnabled) return false;
      const val = (suggestionState?.value || '').replace(/\u00A0/g, ' ');
      if (!val.startsWith('/')) return false;
      const textAfterSlash = val.slice(1).toUpperCase();
      const aliases = ['A', 'T', 'N', 'S', 'P', 'L', 'C', 'B'];
      const hasSpaceMatch = aliases.some(alias => textAfterSlash.startsWith(alias + ' '));
      return !hasSpaceMatch;
    })();

    if (
      suggestionState &&
      (isStoreLocked || (shouldShowSuggestions && suggestionState.isVisible !== false)) &&
      !suggestionState.isAtMenuOpen &&
      !suggestionState.isAutomationActive &&
      suggestionState.lockedCommand !== 'calendar' &&
      suggestionState.lockedCommand !== 'upload_drive' &&
      (mainView.kind !== 'allItems' || isStoreLocked) &&
      !isLinkEditModalOpen
    ) {
      return (
        <div
          className={`${(!suggestionState.lockedCommand && !isStoreLocked && !isBoardViewEnabled) || isBoardSlashDropdownActive ? '' : 'glass-card border border-white/40 border-b-none border-r-none border-l-none dark:border-white/10'} ${isBoardViewEnabled && !isStoreLocked ? 'w-[75vw] -ml-[calc(37.5vw-50%)] max-w-none mt-4 h-[calc(100vh-200px)]' : isStoreLocked ? 'h-[90%] w-full' : !suggestionState.lockedCommand ? 'w-full h-fit max-h-[70%]' : 'h-[70%] w-full'} min-h-0 overflow-visible rounded-xl dark:rounded-none dark:bg-transparent`}
          style={{ border: 'none' }}>
          {isStoreLocked ? (
            storeTab === 'catalog' ? (
              <AutomationSkillsPanel
                query={suggestionState.value}
                onTabChange={setStoreTab}
                activeTab={storeTab}
                onExecuteModule={handleExecuteModuleFromAiPanel}
                onClose={() => searchbarRef.current?.lockCommand(null)}
              />
            ) : (
              <SavedAutomationsPanel
                automations={savedAutomations}
                query={suggestionState.value}
                onRunAutomation={handleRunAutomationFromAiPanel}
                onEditAutomation={handleEditAutomationFromAiPanel}
                onExecuteModule={handleExecuteModuleFromAiPanel}
                onTabChange={setStoreTab}
                activeTab={storeTab}
                onClose={() => searchbarRef.current?.lockCommand(null)}
                userId={userId}
              />
            )
          ) : isBoardViewEnabled ? (
            <BoardView
              state={suggestionState}
              unfilteredSuggestions={unfilteredSuggestionsRef.current}
              isLoggedIn={isLoggedIn}
              onClose={() => {
                const shorthandFilters = ['/a', '/t', '/n', '/s', '/p', '/l', '/c', '/b'];
                if (shorthandFilters.includes(searchValue.trim().toLowerCase())) {
                  searchbarRef.current?.clear();
                }
                searchbarRef.current?.blur();
                if (isInitialAltSFocus && onInitialAltSFocusChange) {
                  onInitialAltSFocusChange(false);
                }
                handleGoHome();
              }}
            />
          ) : (
            <SearchSuggestions
              state={suggestionState}
              favoritesMapping={favoritesMapping}
              selectedTeamId={selectedTeam?.team_id}
              userId={userId}
              status={commandStatus}
              inlineNotification={inlineNotification}
              onNavigateToListView={onNavigateToListView}
              onRequestClear={() => searchbarRef.current?.clear()}
            />
          )}
        </div>
      );
    }

    // Priority 3.5: Store & Module Detail
    if (mainView.kind === 'store') {
      const aiState = suggestionState || {
        lockedCommand: 'ai',
        value: '',
        isSuggestionVisible: false,
        showAIHistoryPanel: false,
        isVisible: true,
        selectedAIs: [],
      };
      return (
        <div className="flex h-[90%] w-full justify-center relative bg-transparent overflow-visible">
          <div
            className="glass-card border border-white/40 border-b-none border-r-none border-l-none dark:border-white/10 flex-1 min-h-0 relative rounded-xl dark:rounded-none dark:bg-transparent overflow-visible"
            style={{ border: 'none' }}>
            <AICommandLockedUI
              key="ai-store"
              state={aiState as SuggestionState}
              initialTab="skills"
              isMac={isMac}
              savedAgents={savedAiAgents}
              isLoggedIn={isLoggedIn}
              savedAutomations={savedAutomations}
              onSelectSavedAgent={handleSelectSavedAgent}
              onRunAutomation={handleRunAutomationFromAiPanel}
              onEditAutomation={handleEditAutomationFromAiPanel}
              onExecuteModule={handleExecuteModuleFromAiPanel}
              onNewChat={handleNewChat}
              onQueryChange={(val: string) =>
                setSuggestionState(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    value: val,
                  };
                })
              }
              onSaveAgent={() => {
                if (!isLoggedIn) {
                  setLoginRequiredDialog({ isOpen: true, commandName: 'Save Agent' });
                } else {
                  setIsSaveAgentModalOpen(true);
                }
              }}
              onClose={handleStoreClose}
              onSubmit={(prompt: string) => {
                searchbarRef.current?.submitAI(prompt);
              }}
              onFileUpload={() => {
                searchbarRef.current?.triggerFileUpload();
              }}
            />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'bulk') {
      return (
        <div className="flex-1 min-h-0 w-full flex flex-col items-center">
          <div className="h-[90%] w-full flex flex-col overflow-hidden border border-neutral-200 dark:border-white/10 bg-[var(--color-containerBg)] rounded-xl shadow-2xl">
            <BuildView
              onBack={handleGoHome}
              initialSnippet={mainView.bulkProps?.initialSnippet || selectedSnippet}
              workspace={mainView.bulkProps?.workspace}
              folder={mainView.bulkProps?.folder}
            />
          </div>
        </div>
      );
    }

    // Priority 2.5: All Items View (Show all notes/links)
    if (mainView.kind === 'allItems') {
      if (mainView.itemType === 'bookmarks') {
        return (
          <div className="flex-1 min-h-0 h-[90%] w-full">
            <BookmarksTable searchQuery={searchValue} onClose={handleGoHome} />
          </div>
        );
      }
      return (
        <div className="flex-1 min-h-0 h-[90%] w-full">
          <AllItemsView
            itemType={mainView.itemType}
            onClose={() => dispatch(navigateToView({ kind: 'home' }))}
            onSnippetSelect={handleHomeSnippetSelect}
            onRequestSnippetDelete={handleHomeDeleteRequest}
            onRequestOpenUrls={handleRequestOpenUrls}
            onRequestEditLink={handleHomeLinkEdit}
            searchQuery={searchValue}
          />
        </div>
      );
    }

    // Priority 3.5: Organization Panels
    if (mainView.kind === 'organizationSettings') {
      return (
        <div className="flex-1 min-h-0 px-6 pb-6">
          {/* Main Organization Panel - maintains original size */}
          <div className="glass-card border border-white/40 dark:border-white/10 h-[90%] flex flex-col overflow-hidden max-w-full">
            <OrganizationPanel
              orgId={mainView.orgId}
              orgName={mainView.orgName}
              onClose={handleGoHome}
              onSave={handleReload}
              teams={teams}
              onOrgSwitch={(orgId, orgName) => {
                const team = teams.find(t => t.team_id === orgId);
                if (team) {
                  dispatch(setSelectedTeam(team));
                }
                handleGoHome();
              }}
              onCreateOrg={() => {
                dispatch(navigateToView({ kind: 'createOrganization' }));
              }}
            />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'createOrganization') {
      return (
        <div className="flex-1 min-h-0 px-6 pb-6">
          <div className="glass-card border border-white/40 dark:border-white/10 h-[90%] flex flex-col overflow-hidden">
            <CreateOrganizationPanel
              onClose={() => dispatch(navigateToView({ kind: 'home' }))}
              onSuccess={(orgId, orgName) => {
                handleReload();
                dispatch(navigateToView({ kind: 'home' }));
              }}
            />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'sharedFolderCreation') {
      return (
        <div className="flex-1 min-h-0 w-full h-full flex flex-col items-center justify-center">
          <SharedFolderCreationView />
        </div>
      );
    }

    if (mainView.kind === 'workspaceShare') {
      if (!FEATURE_FLAGS.ENABLE_SHARING) return null;
      return (
        <div className="flex-1 min-h-0 px-6 pb-6">
          <div className="glass-card border border-white/40 dark:border-white/10 h-full flex flex-col overflow-hidden">
            <WorkspaceSharePanel
              workspaceId={mainView.workspaceId}
              workspaceName={mainView.workspaceName}
              orgId={mainView.orgId}
              workspaceType={mainView.workspaceType}
              reload={handleReload}
              onClose={() => dispatch(navigateToView({ kind: 'home' }))}
            />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'subscriptions') {
      return (
        <div className="flex-1 min-h-0 px-6 pb-6">
          <div className="h-full flex flex-col overflow-hidden">
            <SubscriptionsPanel
              teams={teams}
              selectedOrgId={selectedTeam?.team_id || null}
              onClose={() => dispatch(navigateToView({ kind: 'home' }))}
            />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'manageSubscription') {
      return (
        <div className="flex h-[90%] w-full justify-center relative bg-transparent overflow-visible">
          <div className="glass-card border border-white/20 dark:border-white/5 flex-1 h-full min-h-0 relative rounded-xl overflow-hidden">
            <ManageSubscriptionPanel onClose={() => dispatch(navigateToView({ kind: 'home' }))} />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'generalSettings') {
      return (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-hidden px-6 md:px-12 lg:px-24 py-6 md:py-10">
            <GeneralSettingsPanel onClose={handleGoHome} initialTab={mainView.section} />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'backup') {
      return (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-hidden px-6 md:px-12 lg:px-24 py-6 md:py-10">
            <BackupPanel onClose={handleGoHome} />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'allWorkspaces') {
      return (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-hidden px-6 md:px-12 lg:px-24 py-6 md:py-10">
            <AllWorkspacesPanel onClose={handleGoHome} />
          </div>
        </div>
      );
    }

    if (mainView.kind === 'workspaceSettings') {
      return (
        <div className="flex-1 min-h-0 pt-6">
          <div className="h-full w-full flex flex-col overflow-hidden px-6 md:px-12 lg:px-24 py-6 md:py-10">
            <WorkspaceSettingsPanel onClose={handleGoHome} />
          </div>
        </div>
      );
    }



    // Priority 4: Home View
    if (displayHomeView) {
      return (
        <div className="flex-1 min-h-0 h-[70%] w-full">
          <HomeView
            onRequestOpenUrls={handleRequestOpenUrls}
            isAtMenuOpen={suggestionState?.isAtMenuOpen}
            ref={homeViewRef}
            onQuickCommandSelect={commandId => {
              if (isLocalCommandId(commandId as string)) {
                const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
                if (localDef?.behavior === 'instant') {
                  handleCommandExecute(commandId as any);
                  return;
                }
              }
              if (commandId === 'saved-automation') {
                onOpenSheetUI?.('saved-automation');
                return;
              }
              if (commandId === 'todo') {
                dispatch(setShowTodosView(true));
                return;
              }
              if (commandId === 'collections') {
                onOpenSheetUI?.('collections');
                return;
              }
              searchbarRef.current?.lockCommand(commandId);
              searchbarRef.current?.focus();
            }}
            onSnippetSelect={handleHomeSnippetSelect}
            onRequestSnippetDelete={handleHomeDeleteRequest}
            onRequestLinkEdit={handleHomeLinkEdit}
            onHighlightChange={handleInteractiveItemHighlight}
            onRequestFocusSearch={handleRequestFocusSearch}
            onCommandPreview={cmd => searchbarRef.current?.previewCommand(cmd as any)}
            isCommandLocked={!!suggestionState?.lockedCommand}
            isPromptMenuOpen={suggestionState?.isPromptMenuOpen}
            isSuggestionVisible={suggestionState?.isVisible}
            inlineNotification={inlineNotification}
            onNavigateToListView={onNavigateToListView}
            isLoggedIn={isLoggedIn}
          />
        </div>
      );
    }



    // Priority 6: Default/Welcome -> Defaults to Home View
    if (
      (suggestionState?.lockedCommand && (suggestionState.lockedCommand as string) !== 'store') ||
      suggestionState?.isAtMenuOpen ||
      suggestionState?.isPromptMenuOpen
    ) {
      return null;
    }

    return (
      <div className="flex-1 min-h-0 h-[70%] w-full">
        <HomeView
          ref={homeViewRef}
          onQuickCommandSelect={commandId => {
            if (commandId === 'todo') {
              dispatch(setShowTodosView(true));
              return;
            }
            if (commandId === 'collections') {
              onOpenSheetUI?.('collections');
              return;
            }
            if (commandId === 'saved-automation') {
              onOpenSheetUI?.('saved-automation');
              return;
            }
            searchbarRef.current?.lockCommand(commandId);
            searchbarRef.current?.focus();
          }}
          onSnippetSelect={handleHomeSnippetSelect}
          onRequestSnippetDelete={handleHomeDeleteRequest}
          onRequestLinkEdit={handleHomeLinkEdit}
          onHighlightChange={handleInteractiveItemHighlight}
          onRequestFocusSearch={handleRequestFocusSearch}
          onCommandPreview={cmd => searchbarRef.current?.previewCommand(cmd as any)}
          isCommandLocked={!!suggestionState?.lockedCommand}
          isPromptMenuOpen={suggestionState?.isPromptMenuOpen}
          isSuggestionVisible={suggestionState?.isVisible}
          onNavigateToListView={onNavigateToListView}
          isLoggedIn={isLoggedIn}
        />
      </div>
    );
  };

  const lastEmittedStateRef = useRef<SuggestionState | null>(null);
  const unfilteredSuggestionsRef = useRef<any[]>([]);

  // Handle suggestion state from Searchbar (like AltS)
  const handleSuggestionStateChange = useCallback(
    (state: SuggestionState | null) => {
      // 1. Check for changes before updating state to avoid render loops
      // We compare critical properties that affect UI rendering.
      const prevState = lastEmittedStateRef.current;
      const hasChanged =
        !prevState ||
        !state ||
        state.isVisible !== prevState.isVisible ||
        state.lockedCommand !== prevState.lockedCommand ||
        state.value !== prevState.value ||
        state.highlightIndex !== prevState.highlightIndex ||
        state.isAtMenuOpen !== prevState.isAtMenuOpen ||
        state.isPromptMenuOpen !== prevState.isPromptMenuOpen ||
        state.isAutomationActive !== prevState.isAutomationActive ||
        state.selectedAIs?.length !== prevState.selectedAIs?.length ||
        JSON.stringify(state.selectedAIs) !== JSON.stringify(prevState.selectedAIs) ||
        state.activeAiSession?.id !== prevState.activeAiSession?.id ||
        state.activeAiSession?.sessionKey !== prevState.activeAiSession?.sessionKey ||
        state.suggestions?.length !== prevState.suggestions?.length;

      if (hasChanged) {
        if (!state?.value || state.value.trim() === '') {
          if (state?.suggestions && state.suggestions.length > 0) {
            unfilteredSuggestionsRef.current = state.suggestions;
          }
        }
        lastEmittedStateRef.current = state;
        setSuggestionState(state);
      }

      // 2. Proactively notify parent of command lock changes to avoid race conditions in UI
      const nextLocked = (state?.lockedCommand as string | null) || null;
      if (nextLocked !== prevLockedRef.current) {
        prevLockedRef.current = nextLocked;
        onLockedCommandChange?.(nextLocked);
      }

      // 3. Only notify parent of menu visibility changes to avoid re-rendering App on item highlight
      const isMenuOpen = !!(state?.isAtMenuOpen || state?.isPromptMenuOpen);
      if (isMenuOpen !== prevIsMenuOpenRef.current) {
        prevIsMenuOpenRef.current = isMenuOpen;
        onMenuStateChange?.(isMenuOpen);
      }

      const isAutomationActive = !!state?.isAutomationActive;
      if (isAutomationActive !== prevIsAutomationActiveRef.current) {
        prevIsAutomationActiveRef.current = isAutomationActive;
        onAutomationActiveChange?.(isAutomationActive);
      }
    },
    [onMenuStateChange, onAutomationActiveChange, onLockedCommandChange],
  );

  const handleAISubmit = useCallback((prompt: string) => {
    searchbarRef.current?.submitAI(prompt);
  }, []);

  const handleAIFileUpload = useCallback(() => {
    searchbarRef.current?.triggerFileUpload();
  }, []);

  const handleAIQueryChange = useCallback((val: string) => {
    // 1. Update the local suggestionState immediately for responsive UI
    setSuggestionState(prev => (prev ? { ...prev, value: val } : null));

    // 2. Synchronize with the Searchbar's internal state (commandPrompt/value)
    // This prevents the searchbar from re-emitting a stale prompt state
    // when it re-renders (e.g. after a file upload).
    searchbarRef.current?.setValue(val);
  }, []);

  const handleCloseTodosView = useCallback(() => {
    handleNavigateBack();
  }, [handleNavigateBack]);

  // When a command is locked (e.g. /ai), close any active editor so the user sees the command interface
  useEffect(() => {
    if (suggestionState?.lockedCommand && !isLinkEditModalOpen) {
      if (
        mainView.kind === 'noteEditor' ||
        mainView.kind === 'linkEditor' ||
        mainView.kind === 'promptEditor' ||
        mainView.kind === 'bulk'
      ) {
        
        dispatch(navigateToView({ kind: 'searchSuggestions' }));
      }
    }
  }, [suggestionState?.lockedCommand, mainView.kind, dispatch, isLinkEditModalOpen]);

  const handleSearchbarFocusChange = useCallback(
    (direction: 'up' | 'down') => {
      
      if (direction === 'down') {
        // InteractiveItemsList handles its own navigation via global keydown listener
        // No need to call focusFirstItem() here - it causes focus to reset to index 0
        
      } else if (direction === 'up') {
        
      }
    },
    [displayHomeView],
  );

  // Promise Queue

  const handleCommandExecuteLog = (commandId: string) => {
    
  };

  const handleStoreClose = useCallback(() => {
    dispatch(navigateToView({ kind: 'searchSuggestions' }));
    // Removed search clear to allow results to persist when closing store
    // setSuggestionState(null);
    // setSearchValue('');
    // searchbarRef.current?.clear();
    setTimeout(() => searchbarRef.current?.focus(), 0);
  }, [dispatch]);

  const handleToggleFavorite = useCallback(
    async (item: SnippetSuggestion | any) => {
      // Use userId for global favorites
      if (!userId) {
        triggerToast('Please sign in to manage favorites', 'error');
        return;
      }

      enqueueFavoriteAction(async () => {
        try {
          const targetKey = userId;
          if (!targetKey) {
            triggerToast('Please sign in to manage favorites', 'error');
            return;
          }

          // Use the imported API functions directly (already imported at the top)
          // 1. Get Latest Storage from Disk (Async)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chromeAny = (window as any)?.chrome;
          if (!chromeAny?.storage?.local) return;

          const result = await new Promise<any>(resolve => chromeAny.storage.local.get('myFavouriteItems', resolve));
          const favItems = result.myFavouriteItems || {};
          const currentFavList: any[] = favItems[targetKey] || [];

          // Prepare Item Data based on what SearchSuggestions passes
          let itemId: string;
          let itemType: 'command' | 'snippet';
          let itemData: any;

          // Check if it's a command
          const isCommand = item.source === 'last_used' || (item.label && item.id && !item.snippet) || item.id === 'ai';

          if (isCommand) {
            itemType = 'command';
            itemId = item.id;

            // Extract valid iconHost
            let iconHost = item.command?.iconHost;
            if (!iconHost) {
              if (item.id === 'ai') {
                iconHost = 'chatgpt.com'; // Default AI icon
              } else {
                const def = COMMANDS.find(c => c.id === item.id);
                if (def) iconHost = def.iconHost;
              }
            }

            itemData = {
              id: item.id,
              type: 'command',
              label: item.label,
              commandId: item.id,
              commandPrefix: item.prefix || '/' + item.id,
              iconHost: iconHost,
              iconStack: item.id === 'ai', // Special case for AI group
              category: item.category || 'command',
              automation: item.automation || (item.steps ? item : null),
            };
          } else if (item.snippet) {
            // It's a snippet suggestion
            itemType = 'snippet';
            itemId = item.snippet.snippet_id || item.snippet.id;
            // Ensure we store the simplified snippet object, not the wrapper
            // If the snippet is complex, we might want to store just enough to identify/display it
            // But HomeView stores the whole snippet usually.
            itemData = { ...item.snippet, id: itemId };
          } else {
            console.warn('[handleToggleFavorite] Unknown item structure', item);
            return;
          }

          // Check Existing
          const existingFavIndex = currentFavList.findIndex(fav => {
            if ('type' in fav && fav.type === 'command') {
              return fav.id === itemId;
            }
            const favId = (fav as any)?.id || (fav as any)?.snippet_id;
            return favId === itemId;
          });
          const isAlreadyFav = existingFavIndex !== -1;

          if (isAlreadyFav) {
            // --- REMOVE FLOW ---
            const existingItem = currentFavList[existingFavIndex];

            // Local Update First (Optimistic)
            const updatedFavList = [...currentFavList];
            updatedFavList.splice(existingFavIndex, 1);
            const updatedMapping = { ...favItems, [targetKey]: updatedFavList };

            await new Promise<void>(resolve =>
              chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
            );
            setFavoritesMapping(updatedMapping);
            triggerToast('Removed from favorites', 'success');

            // API Call
            if (existingItem && existingItem.favourite_id) {
              const fid = String(existingItem.favourite_id);
              if (!fid.startsWith('pending-')) {
                await deleteFavorite(targetKey, Number(existingItem.favourite_id)).catch(console.error);
              }
            } else {
              // Fallback logic for favorites without ID (legacy/sync issue)
              try {
                // If we don't have a fav ID, we can try to find it on the server?
                // Or just ignore. Usually synced items have favourite_id.
                // Assuming we might need to fetch favorites to find the ID to delete?
                // For now, let's skip complex lookup to avoid blocking.
              } catch (e) {
                console.error(e);
              }
            }
          } else {
            // --- ADD FLOW ---
            const tempItem = { ...itemData, favourite_id: 'pending-' + Date.now() };
            const updatedFavList = [tempItem, ...currentFavList];
            const updatedMapping = { ...favItems, [targetKey]: updatedFavList };

            await new Promise<void>(resolve =>
              chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
            );
            setFavoritesMapping(updatedMapping);
            triggerToast('Added to favorites', 'success');

            try {
              // Call API
              // For commands, we pass {id: itemId} and type 'command'
              // For snippets, we pass the snippet object and type 'snippet'
              const payload = itemType === 'command' ? { id: itemId } : itemData;
              const response = await addFavorite(targetKey, payload, itemType);

              if (response && response.favourite_id) {
                // Update the local item with the real ID
                const latestRes = await new Promise<any>(resolve =>
                  chromeAny.storage.local.get('myFavouriteItems', resolve),
                );
                const latestFavItems = latestRes.myFavouriteItems || {};
                const latestUserFavs = latestFavItems[targetKey] || [];

                // Ghost Check
                const stillExists = latestUserFavs.some((f: any) => {
                  const fId = f.id || (f.type === 'command' ? f.commandId : f.snippet_id);
                  return fId === itemId;
                });

                if (!stillExists) {
                  
                  await deleteFavorite(targetKey, response.favourite_id);
                } else {
                  const correctedList = latestUserFavs.map((f: any) => {
                    const fId = f.id || (f.type === 'command' ? f.commandId : f.snippet_id);
                    if (fId === itemId) {
                      return { ...f, favourite_id: response.favourite_id };
                    }
                    return f;
                  });
                  const finalMap = { ...latestFavItems, [targetKey]: correctedList };
                  await new Promise<void>(resolve =>
                    chromeAny.storage.local.set({ myFavouriteItems: finalMap }, resolve),
                  );
                  setFavoritesMapping(finalMap);
                }
              }
            } catch (apiErr) {
              console.error('Failed to add favorite to cloud:', apiErr);
              triggerToast('Failed to sync favorite to cloud', 'error');
            }
          }
        } catch (error) {
          console.error(error);
          triggerToast('Failed to update favorites', 'error');
        }
      });
    },
    [userId, triggerToast],
  );

  // Templates View State
  const [templatesActiveTab, setTemplatesActiveTab] = useState<'links' | 'notes' | 'prompts'>('links');
  const [templatesCounts, setTemplatesCounts] = useState({ links: 0, notes: 0, prompts: 0 });

  // All Items View (Show All Notes / All Links) computed state
  const isAllItemsView = mainView.kind === 'allItems';
  const allItemsType = mainView.kind === 'allItems' ? mainView.itemType : undefined;

  // Clear all items view (via backspace or X button in search bar)
  const handleClearAllItemsView = useCallback(() => {
    dispatch(navigateToView({ kind: 'home' }));
    setSearchValue('');
    searchbarRef.current?.clear();
    // Force immediate focus
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (searchbarRef.current) {
          searchbarRef.current.focus();
        }
      }, 0);
    });
  }, [dispatch]);

  const handleLockedCommandChangeInternal = useCallback(
    (cmd: any) => {
      
      if (cmd === 'ai') {
        dispatch(navigateToView({ kind: 'aiEditor' }));
        // Focus the search bar when AI mode is entered
        setTimeout(() => {
          if (searchbarRef.current) {
            searchbarRef.current.focus();
          }
        }, 50);
      } else if (cmd === null && mainView.kind === 'aiEditor') {
        // When clearing an AI command, automatically return to home view
        dispatch(navigateToView({ kind: 'home' }));
      }
      onLockedCommandChange?.(cmd);
    },
    [onLockedCommandChange, dispatch, mainView.kind],
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      propOnQueryChange?.(value);
      // Also dispatch to Redux for debounced search term (used by other parts of the app)
      dispatch(setDebouncedSearchTerm(value));
    },
    [dispatch, propOnQueryChange],
  );

  const defaultPlaceholder = useMemo(() => {
    return 'Type to search';
  }, []);

  const renderHeader = () => {
    // If in TemplatesView or AgentPanel, keep header mounted so searchbarRef remains valid, but let CSS hide it.
    const isAiLocked = (suggestionState?.lockedCommand as string) === 'ai';

    return (
      <div className={isTemplatesView ? 'hidden' : 'flex-shrink-0 relative z-48'}>
        <div className={isTemplatesView ? 'flex items-center gap-2 p-3 pb-1' : 'flex items-center gap-2'}>
          {/* Left: Search Bar */}
          <div className={isTemplatesView ? 'flex-1 min-w-0 relative max-w-3xl' : 'flex-1 min-w-0'}>
            <Searchbar
              ref={searchbarRef}
              savedAiAgents={savedAiAgents}
              hideDynamicIcon={
                isBoardViewEnabled &&
                Boolean(
                  suggestionState &&
                  (isStoreLocked || (shouldShowSuggestions && suggestionState.isVisible !== false)) &&
                  !suggestionState.isAtMenuOpen &&
                  !suggestionState.isAutomationActive &&
                  suggestionState.lockedCommand !== 'calendar' &&
                  suggestionState.lockedCommand !== 'upload_drive' &&
                  (mainView.kind !== 'allItems' || isStoreLocked) &&
                  !isLinkEditModalOpen,
                )
              }
              disableContextualPopup={isBoardViewEnabled}
              isBoardViewEnabled={isBoardViewEnabled}
              onToggleBoardView={onToggleBoardView}
              placeholder={
                isTemplatesView
                  ? 'Search templates...'
                  : isLinkEditModalOpen
                    ? defaultPlaceholder
                    : isCreatingNewItem
                      ? 'Untitled'
                      : selectedSnippet
                        ? `Search in ${(selectedSnippet as any).snippet_name || 'snippet'}...`
                        : selectedFolder
                          ? `Search in ${selectedFolder.folder_name}...`
                          : selectedWorkspace
                            ? `Search in ${selectedWorkspace.workspace_name}...`
                            : defaultPlaceholder
              }
              onSuggestionStateChange={handleSuggestionStateChange}
              onLockedCommandChange={handleLockedCommandChangeInternal}
              lockedCommand={suggestionState?.lockedCommand || null}
              onSnippetSelect={handleSearchSnippetSelect}
              onAutomationSelect={handleAutomationSelect}
              onAutomationEdit={handleAutomationEdit}
              searchValue={searchValue}
              onQueryChange={handleQueryChange}
              onCommandModeExit={() => {
                if (displayHomeView && homeViewRef.current) {
                  setTimeout(() => {
                    homeViewRef.current?.focusFirstItem();
                  }, 0);
                }
              }}
              onCommandExecute={handleCommandExecute}
              onRequestFocusChange={handleSearchbarFocusChange}
              onClearFolder={handleGoHome}
              onNavigateBack={handleNavigateBack}
              isCommandListView={isCommandListView}
              onClearCommandListView={onClearCommandListView}
              isAllItemsView={isAllItemsView}
              allItemsType={allItemsType}
              onClearAllItemsView={handleClearAllItemsView}
              onRequestEditLink={handleHomeLinkEdit}
              onRequestEditPrompt={handlePromptEditRequest}
              onRequestSnippetDelete={handleHomeDeleteRequest}
              onToggleFavorite={handleToggleFavorite}
              onGoToTemplates={() => onToggleTemplatesView?.(true)}
              onSearchbarFocus={onSearchbarFocus}
              isLoggedIn={isLoggedIn}
              onSaveAgent={() => {
                if (!isLoggedIn) {
                  setLoginRequiredDialog({ isOpen: true, commandName: 'Save Agent' });
                } else {
                  setIsSaveAgentModalOpen(true);
                }
              }}
              activeStoreTab={storeTab}
              onToggleStoreTab={() => {
                setStoreTab(prev => {
                  const nextTab = prev === 'catalog' ? 'saved' : 'catalog';
                  const nextCmd = nextTab === 'catalog' ? 'store' : 'saved-automation';
                  if (lockedCommand !== nextCmd) {
                    const currentVal = searchbarRef.current?.getValue() || '';
                    searchbarRef.current?.lockCommand(nextCmd, currentVal);
                  }
                  return nextTab;
                });
              }}
              isInitialAltSFocus={isInitialAltSFocus}
              onInitialAltSFocusChange={onInitialAltSFocusChange}
              displayHomeView={displayHomeView}
              onHoverSlashDot={onHoverSlashDot}
            />
          </div>
        </div>
      </div>
    );
  };

  const isEditorExpanded =
    isCreatingNewItem ||
    !!selectedSnippet ||
    mainView.kind === 'bulk' ||
    mainView.kind === 'agentPanel' ||
    mainView.kind === 'store' ||
    mainView.kind === 'todos' ||
    (suggestionState?.lockedCommand as string) === 'ai';
  const isActuallyExpanded = isEditorExpanded || isLinkEditModalOpen;
  const isOrganizationPanelOpen =
    mainView.kind === 'organizationSettings' ||
    mainView.kind === 'createOrganization' ||
    mainView.kind === 'sharedFolderCreation' ||
    mainView.kind === 'subscriptions' ||
    mainView.kind === 'manageSubscription' ||
    mainView.kind === 'generalSettings' ||
    mainView.kind === 'allWorkspaces' ||
    mainView.kind === 'workspaceSettings' ||
    mainView.kind === 'backup';
  const isAutomationActive = Boolean(suggestionState?.isAutomationActive);
  const shouldHideMainContent = hideMainContent || isAutomationActive;

  const shouldHideHeader =
    isSheetUIOpen ||
    isTemplatesView ||
    mainView.kind === 'todos' ||
    (isActuallyExpanded &&
      (suggestionState?.lockedCommand as string) !== 'store' &&
      (suggestionState?.lockedCommand as string) !== 'ai' &&
      mainView.kind !== 'store');

  const isFreshAiCommand =
    (mainView.kind === 'aiEditor' || (suggestionState?.lockedCommand as string) === 'ai') &&
    !suggestionState?.activeAiSession?.prompt;

  const isQueryBasedLockedCommand = Boolean(
    suggestionState?.lockedCommand &&
    (
      !isLocalCommandId(suggestionState.lockedCommand as string) ||
      suggestionState.requiresInlineQuery
    ) &&
    suggestionState.lockedCommand !== 'store' &&
    suggestionState.lockedCommand !== 'ai'
  );

  return (
    <div
      className={`flex h-full flex-col w-full relative ${isFocusMode || isCreatingEditorView || isLinkEditModalOpen || mainView.kind === 'generalSettings' || mainView.kind === 'allWorkspaces' || mainView.kind === 'workspaceSettings' || mainView.kind === 'backup'
        ? 'max-w-none mx-0 pt-0 pb-0 mt-0 h-full overflow-hidden'
        : isTemplatesView
          ? showSidebarColumn
            ? 'w-full px-10 pt-4 pb-[5px] overflow-hidden'
            : 'w-full pl-72 pr-10 pt-4 pb-[5px] overflow-hidden'
          : isSheetUIOpen
            ? 'w-full mx-auto pr-0 pt-0 pb-0 mt-0 h-full overflow-hidden'
            : mainView.kind === 'agentPanel'
              ? 'max-w-5xl mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-6xl min-[1800px]:max-w-7xl max-[1480px]:max-w-4xl max-[1370px]:max-w-3xl max-[1270px]:max-w-2xl h-[90vh] overflow-visible'
              : isOrganizationPanelOpen && mainView.kind !== 'manageSubscription'
                ? mainView.kind === 'subscriptions'
                  ? 'max-w-6xl mx-auto pt-[6vh] pb-[5px] min-[1600px]:max-w-7xl w-full h-[90vh] overflow-visible'
                  : 'max-w-5xl mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-6xl min-[1800px]:max-w-7xl max-[1480px]:max-w-4xl max-[1370px]:max-w-3xl max-[1270px]:max-w-2xl h-[90vh] overflow-visible'
                : mainView.kind === 'todos'
                  ? 'max-w-4xl mx-auto pt-0 pb-[5px] min-[1600px]:max-w-5xl min-[1800px]:max-w-6xl max-[1480px]:max-w-3xl max-[1370px]:max-w-2xl max-[1270px]:max-w-xl h-full overflow-visible'
                  : mainView.kind === 'store' || mainView.kind === 'manageSubscription'
                    ? `pb-[5px] overflow-visible w-full mx-auto ${showSidebarColumn ? 'max-w-[1800px]' : 'max-w-4xl'} pt-[10vh] ${showSidebarColumn ? 'pl-[8%] pr-[340px]' : ''}`
                    : mainView.kind === 'aiEditor' || (suggestionState?.lockedCommand as string) === 'ai'
                      ? `pb-[5px] overflow-visible w-full mx-auto max-w-2xl pt-[10vh]`
                      : isQueryBasedLockedCommand
                        ? `pb-[5px] overflow-visible w-full mx-auto max-w-2xl pt-[14vh]`
                        : isNarrowView
                          ? `max-w-[480px] mx-auto pt-[14vh] pb-[5px] min-[1600px]:max-w-[540px] min-[1800px]:max-w-2xl max-[1480px]:max-w-[440px] max-[1370px]:max-w-[400px] max-[1270px]:max-w-[360px] ${isBoardViewEnabled ? 'overflow-visible' : 'overflow-hidden'}`
                          : `max-w-[1200px] mx-auto pt-0 pb-0 mt-0 h-full px-8 min-[1600px]:max-w-[1400px] ${isBoardViewEnabled ? 'overflow-visible' : 'overflow-hidden'}`
        }`}>
      {!isOrganizationPanelOpen && !showTutorial && !isCheckingTutorial && (
        <div className={shouldHideHeader ? 'hidden pointer-events-none opacity-0 h-0 overflow-hidden' : ''}>
          {renderHeader()}
        </div>
      )}

      {/* Daily Tips - Absolute positioned top-right, below icons */}
      {/* {!shouldHideMainContent && !isActuallyExpanded && !isOrganizationPanelOpen && displayHomeView && (
        <div className="absolute top-[0.2vh] right-0 w-full z-20 pointer-events-none mr-20">
          <div className="pointer-events-auto">
            <DailyTips
              onCommand={cmd => {
                const commandId = cmd as string;
                if (isLocalCommandId(commandId)) {
                  const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
                  if (localDef?.behavior === 'instant') {
                    handleCommandExecute(commandId as any);
                    return;
                  }
                }
                searchbarRef.current?.lockCommand(commandId as any);
                searchbarRef.current?.focus();
              }}
            />
          </div>
        </div>
      )} */}

      {/* Main Content Area - Hidden when sidebar search is focused or filter panel is open */}
      {!showTutorial && !isCheckingTutorial && ((mainView.kind === 'agentPanel' && !isAutomationActive) ||
        mainView.kind === 'todos' ||
        isSheetUIOpen ||
        !shouldHideMainContent) ? (
        <div
          className={`flex-1 flex flex-col ${isSheetUIOpen || isOrganizationPanelOpen ? 'overflow-hidden min-h-0' : 'overflow-visible'} ${isActuallyExpanded ? 'mt-0' : 'mt-[-6px] '}`}>
          {renderMainContent()}
        </div>
      ) : null}
      <DeleteDialog
        isOpen={homeDeleteContext.isOpen}
        onClose={handleCloseHomeDeleteDialog}
        onConfirm={handleConfirmHomeDelete}
        title={homeDeleteContext.detail?.commandId === 'delete_link' ? 'Delete Link' : 'Delete Note'}
        description={
          homeDeleteContext.detail
            ? `Do you want to delete "${homeDeleteContext.detail.snippetKey}"?`
            : 'Do you want to delete this item?'
        }
      />

      {/* Workspace rename/delete dialogs from searchbar commands */}
      {workspaceActionContext.isOpen && workspaceActionContext.detail && (
        <>
          {workspaceActionContext.action === 'rename' && (
            <EditWorkspaceNamePopup
              isOpen={workspaceActionContext.isOpen}
              onClose={() => setWorkspaceActionContext({ isOpen: false, action: null, detail: null })}
              reload={reload}
              workspaceId={workspaceActionContext.detail.workspaceId}
              workspaceName={workspaceActionContext.detail.workspaceName || ''}
            />
          )}
          {workspaceActionContext.action === 'delete' && (
            <DeleteDialog
              isOpen={workspaceActionContext.isOpen}
              onClose={() => setWorkspaceActionContext({ isOpen: false, action: null, detail: null })}
              onConfirm={async () => {
                if (!workspaceActionContext.detail) return;
                try {
                  await deleteSWorkspace(workspaceActionContext.detail.workspaceId);
                  reload();
                  dispatch(setCommandStatus({ status: 'success', message: 'Channel deleted successfully' }));
                  setTimeout(() => {
                    dispatch(setCommandStatus({ status: 'idle', message: '' }));
                  }, 3000);
                  setWorkspaceActionContext({ isOpen: false, action: null, detail: null });
                } catch (error: any) {
                  const serverErrorMessage = error.response?.data?.error || error?.message;
                  dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
                }
              }}
              title="Confirm Delete"
              description={`Are you sure you want to delete ${workspaceActionContext.detail.workspaceName || 'this workspace'}? This action cannot be undone.`}
            />
          )}
        </>
      )}
      {/* Login Required Dialog */}
      <LoginRequiredDialog
        isOpen={loginRequiredDialog.isOpen}
        onClose={() => setLoginRequiredDialog({ isOpen: false, commandName: '' })}
        commandName={loginRequiredDialog.commandName}
        onLogin={() => {
          // Re-trigger the command after login?
          // For now just close the dialog and let user retry.
          setLoginRequiredDialog({ isOpen: false, commandName: '' });
        }}
      />

      {/* Editor Switch Unsaved Changes Warning */}
      <UnsavedChangesDialog
        source="Container"
        isOpen={showEditorSwitchWarning}
        onClose={() => {
          dispatch(setShowEditorSwitchWarning(false));
          dispatch({ type: 'uiState/setPendingNavigationAction', payload: null });
        }}
        onSave={async () => {
          // Auto-save is already handled by the editor's debounce.
          dispatch(setShowEditorSwitchWarning(false));
          dispatch(setIsEditorDirty(false));
          const pending = pendingNavigationAction;
          dispatch({ type: 'uiState/setPendingNavigationAction', payload: null });
          if (pending) {
            if (pending.type === 'EXECUTE_COMMAND') {
              await handleCommandExecute(pending.payload.commandId, pending.payload.options);
            } else if (pending.type === 'GO_HOME') {
              handleGoHome();
            } else if (pending.type === 'NAVIGATE_BACK') {
              handleNavigateBack(true);
            } else if (pending.type === 'SHORTCUT_BOARD_VIEW') {
              onShortcutBoardView?.();
            } else if (pending.type === 'SHORTCUT_CREATE_MENU') {
              onShortcutCreateMenu?.();
            } else {
              dispatch({ ...pending, __bypassUnsavedGuard: true });
            }
          }
        }}
        onDiscard={() => {
          dispatch(setShowEditorSwitchWarning(false));
          dispatch(setIsEditorDirty(false));
          const pending = pendingNavigationAction;
          dispatch({ type: 'uiState/setPendingNavigationAction', payload: null });
          if (pending) {
            if (pending.type === 'EXECUTE_COMMAND') {
              handleCommandExecute(pending.payload.commandId, pending.payload.options);
            } else if (pending.type === 'GO_HOME') {
              handleGoHome();
            } else if (pending.type === 'NAVIGATE_BACK') {
              handleNavigateBack(true);
            } else if (pending.type === 'SHORTCUT_BOARD_VIEW') {
              onShortcutBoardView?.();
            } else if (pending.type === 'SHORTCUT_CREATE_MENU') {
              onShortcutCreateMenu?.();
            } else {
              dispatch({ ...pending, __bypassUnsavedGuard: true });
            }
          }
        }}
      />

      {/* Save Agent Modal */}
      <SaveAgentModal
        isOpen={isSaveAgentModalOpen}
        onClose={() => setIsSaveAgentModalOpen(false)}
        selectedAIs={suggestionState?.selectedAIs || []}
        prompt={suggestionState?.value || ''}
        activeAiSession={suggestionState?.activeAiSession}
        onSaveSuccess={(name, id) => searchbarRef.current?.updateActiveSessionMetadata({ name, id })}
      />

      {/* Tutorial Overlay */}
      {showTutorial && (
        <TutorialOverlay
          key="tutorial-overlay"
          videoSrc={tutorialVideoSrc}
          onClose={handleCloseTutorial}
          isLoggedIn={isLoggedIn}
          isReturningUser={isReturningUser}
        />
      )}

      {/* Onboarding Loader - shown during post-login draft processing */}
      <OnboardingLoader isVisible={showOnboardingLoader} currentStep={onboardingLoaderStep} />


    </div>
  );
};

export default memo(Container);
