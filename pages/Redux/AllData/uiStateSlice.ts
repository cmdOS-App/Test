import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { Folder, NewSnippetBreadCrum, Snippet, Team, Workspace } from '../../modals/interfaces';

export const NONE_TEAM: Team = {
  team_id: 'none',
  team_name: 'None',
  workspaces: [],
};

// Define the command status type
import type { OS } from '../../new-tab/src/utils/osUtils';

export interface CommandStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

// Define the saved location type for tracking where notes are saved
interface SavedLocation {
  workspace_id: string;
  workspace_name: string;
  folder_id: string | null;
  folder_name: string | null;
}

// Define pending notification type for deferred toast display
interface PendingNotification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// Define the main view type for New Tab
export type MainView =
  | { kind: 'home' }
  | { kind: 'searchSuggestions' } // Alias for home/search view
  | { kind: 'noteEditor'; noteProps?: any }
  | { kind: 'linkEditor'; linkProps?: any }
  | { kind: 'agentPanel'; agentProps?: any }
  | { kind: 'promptEditor'; promptProps?: any }
  | { kind: 'aiEditor' }
  | { kind: 'todos' }
  | { kind: 'store' }
  | { kind: 'subscriptions' }
  | { kind: 'manageSubscription' }
  | { kind: 'moduleDetail'; moduleId: number }
  | {
    kind: 'bulk';
    bulkProps?: { initialSnippet?: Snippet | null; workspace?: Workspace | null; folder?: Folder | null };
  }
  | { kind: 'blank'; title?: string; message?: string }
  | { kind: 'organizationSettings'; orgId: string; orgName: string }
  | { kind: 'createOrganization' }
  | {
    kind: 'workspaceShare';
    workspaceId: string;
    workspaceName: string;
    orgId: string;
    workspaceType?: string;
  }
  | { kind: 'sharedFolderCreation'; defaultPrivacy?: 'private' | 'shared' | 'public'; targetTeamId?: string }
  | { kind: 'allItems'; itemType: 'notes' | 'links' | 'prompts' | 'bookmarks' | 'organizations' }
  | { kind: 'generalSettings'; section?: string }
  | { kind: 'allWorkspaces' }
  | { kind: 'workspaceSettings' }
  | { kind: 'backup' };

// Define the state structure
interface UiState {
  mainView: MainView;
  selectedTeam: Team | null;
  selectedWorkspace: Workspace | null;
  selectedFolder: Folder | null;
  selectedSnippet: Snippet | null;
  snippetBreadCrum: NewSnippetBreadCrum | null;
  expandedWorkspaces: Record<string, boolean>;
  expandedFolders: Record<string, boolean>;
  isCreatingNewItem: boolean;
  darkMode: boolean;
  showFavorites: boolean;
  showLocked: boolean;
  viewMode: 'grid' | 'list';
  debouncedSearchTerm: string;
  isLinkEditModalOpen: boolean;
  isLinkEditMode: boolean;
  activeLinkSnippet: Snippet | null;
  scrollToFolderId: string | null;
  showTodosView: boolean;
  isNewTabOverrideEnabled: boolean;
  commandStatus: CommandStatus;
  lastSavedLocation: SavedLocation | null;
  pendingNotification: PendingNotification | null;
  isFocusMode: boolean;
  os: OS;
  isAutoExpandMode: boolean;
  collapsedWorkspaces: Record<string, boolean>;
  collapsedFolders: Record<string, boolean>;
  collapsedSections: Record<string, boolean>;
  isSidebarCollapsed: boolean;
  isSharedFolderCreationView: boolean;
  isCommandListView: boolean;
  highlightedCommandId: string | null;
  linkEditPrefill: Snippet | null;
  draftAutomation: {
    title: string;
    steps: any[];
    timestamp: number;
    // We don't store ID because it's a draft for a *new* or *unsaved* automation
    // We don't store ID because it's a draft for a *new* or *unsaved* automation
  } | null;
  activeTutorial: 'search' | 'favorites' | 'agent' | 'sidebar' | 'touchpoints' | null;
  hoverContext: { type: 'personal' | 'org' | 'folder' | 'workspace'; id?: string } | null;
  pendingLockedCommand: { commandId: string; mode: 'lock' | 'execute' } | null;
  pendingAutomation: any | null;
  pendingAgent: any | null;
  todoCreatePrefill: any | null;
  isTodoCreateMode: boolean;
  todoDraft: {
    title: string;
    scheduleType: 'one-time' | 'recurring' | '';
    recurringCycle: string;
    time: string;
    date: string;
    isAnytime: boolean;
    selectedItem: any | null;
    selectedType: string | null;
    description: string;
  };
  isEditorDirty: boolean;
  pendingNavigationAction: any | null;
  showEditorSwitchWarning: boolean;
  isCreateMenuOpen: boolean;
  isFullScreenModalOpen: boolean;
}

// Define special payload type for viewing snippets
interface ViewSnippetPayload {
  snippet: Snippet;
  breadcrumb: NewSnippetBreadCrum;
}

// Define the back to workspace payload type
interface BackToWorkspacePayload {
  workspace: Workspace;
}

// Initial state
const initialState: UiState = {
  mainView: { kind: 'home' },
  selectedTeam: null,
  selectedWorkspace: null,
  selectedFolder: null,
  selectedSnippet: null,
  snippetBreadCrum: null,
  expandedWorkspaces: {},
  expandedFolders: {},
  isCreatingNewItem: false,
  darkMode: true,
  showFavorites: true,
  showLocked: false,
  viewMode: 'grid',
  debouncedSearchTerm: '',
  isLinkEditModalOpen: false,
  isLinkEditMode: false,
  activeLinkSnippet: null,
  scrollToFolderId: null,
  showTodosView: false,
  isNewTabOverrideEnabled: true, // Default to true until loaded
  commandStatus: { status: 'idle', message: '' },
  lastSavedLocation: null,
  pendingNotification: null,
  isFocusMode: false,
  os: 'win', // Default to windows until detected
  isAutoExpandMode: true,
  collapsedWorkspaces: {},
  collapsedFolders: {},
  collapsedSections: {},
  isSidebarCollapsed: true,
  isSharedFolderCreationView: false,
  isCommandListView: false,
  highlightedCommandId: null,
  linkEditPrefill: null,
  draftAutomation: null,
  activeTutorial: null,
  hoverContext: null,
  pendingLockedCommand: null,
  pendingAutomation: null,
  pendingAgent: null,
  todoCreatePrefill: null,
  isTodoCreateMode: false,
  todoDraft: {
    title: '',
    scheduleType: '',
    recurringCycle: 'Daily',
    time: '',
    date: '',
    isAnytime: false,
    selectedItem: null,
    selectedType: null,
    description: '',
  },
  isEditorDirty: false,
  pendingNavigationAction: null,
  showEditorSwitchWarning: false,
  isCreateMenuOpen: false,
  isFullScreenModalOpen: false,
};

const uiStateSlice = createSlice({
  name: 'uiState',
  initialState,
  reducers: {
    setSelectedTeam: (state, action: PayloadAction<Team | null>) => {
      const prevTeamId = state.selectedTeam?.team_id;
      state.selectedTeam = action.payload;

      // When team changes, reset workspace, folder and snippet
      if (prevTeamId !== action.payload?.team_id) {
        state.selectedWorkspace = null;
        state.selectedFolder = null;
        state.selectedSnippet = null;
      }
    },

    setSelectedWorkspace: (state, action: PayloadAction<Workspace | null>) => {
      const prevWorkspaceId = state.selectedWorkspace?.workspace_id;
      state.selectedWorkspace = action.payload;

      // Only reset folder and snippet if workspace actually changed or is null
      // This prevents clearing snippet when just refreshing the same workspace
      if (action.payload === null || prevWorkspaceId !== action.payload?.workspace_id) {
        state.selectedFolder = null;

        // We don't automatically clear the snippet and breadcrumb here anymore
        // because that's now handled explicitly in other actions
      }
    },
    setMainView: (state, action: PayloadAction<MainView>) => {
      state.mainView = action.payload;
    },
    navigateToView: (state, action: PayloadAction<MainView>) => {
      const view = action.payload;
      state.mainView = view;

      // Handle common state resets/preparations for specific views
      if (view.kind === 'noteEditor') {
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
        state.showTodosView = false;
      } else if (view.kind === 'linkEditor') {
        state.selectedSnippet = null;
        state.isCreatingNewItem = false;
        state.isLinkEditModalOpen = true;
        state.showTodosView = false;
        if (view.linkProps) {
          state.isLinkEditMode = view.linkProps.editMode ?? false;
          state.activeLinkSnippet = view.linkProps.snippet ?? null;
          state.linkEditPrefill = null;
        }
      } else if (view.kind === 'bulk') {
        state.isLinkEditModalOpen = false;
        state.showTodosView = false;
      } else if (view.kind === 'home' || view.kind === 'searchSuggestions') {
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
        // state.showTodosView = false; // REMOVED: keep Todos open if user pinned it
      } else if (view.kind === 'todos') {
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
        state.showTodosView = true;
      } else if (view.kind === 'aiEditor') {
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
        state.showTodosView = false;
      } else if (view.kind === 'generalSettings') {
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
        state.showTodosView = false;
      } else if (view.kind === 'backup') {
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
        state.showTodosView = false;
      }
    },
    setDebouncedSearchTerm: (state, action) => {
      state.debouncedSearchTerm = action.payload;
    },
    setSelectedFolder: (state, action: PayloadAction<Folder | null>) => {
      state.selectedFolder = action.payload;
    },

    setViewMode(state, action: PayloadAction<'grid' | 'list'>) {
      state.viewMode = action.payload;
    },

    setSelectedSnippet: (state, action: PayloadAction<Snippet | null>) => {
      state.selectedSnippet = action.payload;

      // If setting a snippet to null, we don't want to affect isCreatingNewItem
      // This allows us to keep the editor open when creating a new note
      // isCreatingNewItem should only be explicitly set by the setIsCreatingNewItem action
    },

    setSnippetBreadCrum: (state, action: PayloadAction<NewSnippetBreadCrum | null>) => {
      state.snippetBreadCrum = action.payload;

      // No longer reset the selectedSnippet when updating breadcrumb
      // This fixes workspace snippets not opening
    },

    // New action that safely sets both the snippet and breadcrumb together
    // This ensures they're always in sync and prevents race conditions
    viewSnippet: (state, action: PayloadAction<ViewSnippetPayload>) => {
      const { snippet, breadcrumb } = action.payload;

      // Set everything needed to view a snippet in one atomic update
      state.isCreatingNewItem = false;
      state.snippetBreadCrum = breadcrumb;
      state.selectedSnippet = snippet;

      // EXCLUSIVITY: Clear link editor state when opening a note
      state.isLinkEditModalOpen = false;
      state.activeLinkSnippet = null;
    },

    toggleWorkspace: (state, action: PayloadAction<string>) => {
      const workspaceId = action.payload;
      state.expandedWorkspaces[workspaceId] = !state.expandedWorkspaces[workspaceId];
    },

    toggleFolder: (state, action: PayloadAction<string>) => {
      const folderId = action.payload;
      state.expandedFolders[folderId] = !state.expandedFolders[folderId];
    },

    toggleCollapsedWorkspace: (state, action: PayloadAction<string>) => {
      const workspaceId = action.payload;
      state.collapsedWorkspaces[workspaceId] = !state.collapsedWorkspaces[workspaceId];
    },

    toggleCollapsedFolder: (state, action: PayloadAction<string>) => {
      const folderId = action.payload;
      state.collapsedFolders[folderId] = !state.collapsedFolders[folderId];
    },

    setCollapsedWorkspaces: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.collapsedWorkspaces = action.payload;
    },

    setCollapsedFolders: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.collapsedFolders = action.payload;
    },

    setIsAutoExpandMode: (state, action: PayloadAction<boolean>) => {
      state.isAutoExpandMode = action.payload;
    },

    setCollapsedSections: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.collapsedSections = action.payload;
    },

    toggleCollapsedSection: (state, action: PayloadAction<string>) => {
      const sectionId = action.payload;
      state.collapsedSections[sectionId] = !state.collapsedSections[sectionId];
    },

    setIsSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload;
    },

    setSharedFolderCreationView: (state, action: PayloadAction<boolean>) => {
      state.isSharedFolderCreationView = action.payload;
    },

    setIsCommandListView: (state, action: PayloadAction<boolean>) => {
      state.isCommandListView = action.payload;
    },

    setHighlightedCommandId: (state, action: PayloadAction<string | null>) => {
      state.highlightedCommandId = action.payload;
    },

    expandAllWorkspaces: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.expandedWorkspaces = action.payload;
    },

    expandAllFolders: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.expandedFolders = action.payload;
    },

    setIsCreatingNewItem: (state, action: PayloadAction<boolean>) => {
      state.isCreatingNewItem = action.payload;

      // If creating a new item, clear the selected snippet
      if (action.payload) {
        state.selectedSnippet = null;

        // EXCLUSIVITY: Clear link editor state when starting a new note
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
      }
    },

    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
    },

    setShowFavorites: (state, action: PayloadAction<boolean>) => {
      state.showFavorites = action.payload;
    },

    setShowLocked: (state, action: PayloadAction<boolean>) => {
      state.showLocked = action.payload;
    },

    // Reset everything (for logout, etc)
    resetUiState: state => {
      Object.assign(state, initialState);
    },

    // New action to explicitly navigate back to workspace view
    backToWorkspace: (state, action: PayloadAction<BackToWorkspacePayload>) => {
      const { workspace } = action.payload;

      // Set the workspace
      state.selectedWorkspace = workspace;

      // Clear snippet-related state
      state.selectedSnippet = null;
      state.snippetBreadCrum = null;
      state.isCreatingNewItem = false;
      state.selectedFolder = null;
    },

    // action will update the workspace_snippets inside the selected workspace
    updateWorkspaceSnippetsOrder: (state, action: PayloadAction<Snippet[]>) => {
      if (state.selectedWorkspace) {
        state.selectedWorkspace.workspace_snippets = action.payload;
      }
    },
    updateWorkspaceFolderSnippetsOrder: (state, action: PayloadAction<{ folderId: string; snippets: Snippet[] }>) => {
      if (state.selectedWorkspace?.folders) {
        const folder = state.selectedWorkspace.folders.find(f => f.folder_id === action.payload.folderId);
        if (folder) {
          folder.snippets = action.payload.snippets;
        }
      }
    },
    openLinkEditModal: (
      state,
      action: PayloadAction<{ editMode: boolean; snippet?: Snippet | null; prefill?: Snippet | null }>,
    ) => {
      state.isLinkEditModalOpen = true;
      state.isLinkEditMode = action.payload.editMode;
      state.activeLinkSnippet = action.payload.snippet || null;
      state.linkEditPrefill = action.payload.prefill || null;

      // EXCLUSIVITY: Clear note editor state when opening a link
      state.selectedSnippet = null;
      state.isCreatingNewItem = false;
    },

    closeLinkEditModal: state => {
      state.isLinkEditModalOpen = false;
      state.isLinkEditMode = false;
      state.activeLinkSnippet = null;
      state.linkEditPrefill = null;
    },

    // New action to clear ALL editor states (Notes, Links, etc.)
    clearEditorStates: state => {
      // Clear Note editor state
      state.selectedSnippet = null;
      state.isCreatingNewItem = false;
      state.snippetBreadCrum = null;

      // Clear Link editor state
      state.isLinkEditModalOpen = false;
      state.isLinkEditMode = false;
      state.activeLinkSnippet = null;
      state.linkEditPrefill = null;

      // Clear Todos view state (REMOVED: we want this to persist across tabs)
      // state.showTodosView = false;
      
      // Clear Command List View state
      state.isCommandListView = false;

      // Ensure we drop back to home view if we were in ANY fullscreen editor view
      if (
        state.mainView.kind === 'todos' ||
        state.mainView.kind === 'agentPanel' ||
        state.mainView.kind === 'promptEditor' ||
        state.mainView.kind === 'aiEditor' ||
        state.mainView.kind === 'noteEditor' ||
        state.mainView.kind === 'linkEditor' ||
        state.mainView.kind === 'bulk'
      ) {
        state.mainView = { kind: 'home' };
      }
    },

    setScrollToFolderId: (state, action: PayloadAction<string | null>) => {
      state.scrollToFolderId = action.payload;
    },

    setShowTodosView: (state, action: PayloadAction<boolean>) => {
      state.showTodosView = action.payload;
      if (action.payload) {
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
      } else if (state.mainView.kind === 'todos') {
        state.mainView = { kind: 'home' };
      }
    },

    setNewTabOverrideEnabled: (state, action: PayloadAction<boolean>) => {
      state.isNewTabOverrideEnabled = action.payload;
    },

    setCommandStatus: (state, action: PayloadAction<CommandStatus>) => {
      state.commandStatus = action.payload;
    },

    resetCommandStatus: state => {
      state.commandStatus = { status: 'idle', message: '' };
    },

    setLastSavedLocation: (state, action: PayloadAction<SavedLocation | null>) => {
      state.lastSavedLocation = action.payload;
    },

    // Queue a notification to display after returning to main view
    queueNotification: (state, action: PayloadAction<PendingNotification>) => {
      const raw = action.payload.message;
      // Defensively coerce to string — objects (e.g. {names, urls}) would crash React renders
      const safeMessage = typeof raw === 'string' ? raw : JSON.stringify(raw);
      state.pendingNotification = { ...action.payload, message: safeMessage };
    },

    // Clear the pending notification after displaying
    clearPendingNotification: state => {
      state.pendingNotification = null;
    },

    toggleFocusMode: (state, action: PayloadAction<boolean>) => {
      state.isFocusMode = action.payload;
    },

    setOS: (state, action: PayloadAction<OS>) => {
      state.os = action.payload;
    },

    setDraftAutomation: (state, action: PayloadAction<UiState['draftAutomation']>) => {
      state.draftAutomation = action.payload;
    },

    clearDraftAutomation: state => {
      state.draftAutomation = null;
    },
    setActiveTutorial: (
      state,
      action: PayloadAction<'search' | 'favorites' | 'agent' | 'sidebar' | 'touchpoints' | null>,
    ) => {
      state.activeTutorial = action.payload;
    },
    setHoverContext: (
      state,
      action: PayloadAction<{ type: 'personal' | 'org' | 'folder' | 'workspace'; id?: string } | null>,
    ) => {
      state.hoverContext = action.payload;
    },
    setPendingLockedCommand: (state, action: PayloadAction<{ commandId: string; mode: 'lock' | 'execute' } | null>) => {
      state.pendingLockedCommand = action.payload;
    },
    setPendingAutomation: (state, action: PayloadAction<any | null>) => {
      state.pendingAutomation = action.payload;
    },
    setPendingAgent: (state, action: PayloadAction<any | null>) => {
      state.pendingAgent = action.payload;
    },
    setTodoCreatePrefill: (state, action: PayloadAction<any | null>) => {
      state.todoCreatePrefill = action.payload;
      if (action.payload) {
        if (!action.payload.isCreateModalOnly) {
          state.showTodosView = true;
        }
        state.isCreatingNewItem = false;
        state.selectedSnippet = null;
        state.isLinkEditModalOpen = false;
        state.activeLinkSnippet = null;
      }
    },
    setTodoDraft: (state, action: PayloadAction<Partial<UiState['todoDraft']>>) => {
      state.todoDraft = { ...state.todoDraft, ...action.payload };
    },
    setTodoCreateMode: (state, action: PayloadAction<boolean>) => {
      state.isTodoCreateMode = action.payload;
    },
    setIsEditorDirty: (state, action: PayloadAction<boolean>) => {
      state.isEditorDirty = action.payload;
    },
    setPendingNavigationAction: (state, action: PayloadAction<any | null>) => {
      state.pendingNavigationAction = action.payload;
    },
    setShowEditorSwitchWarning: (state, action: PayloadAction<boolean>) => {
      state.showEditorSwitchWarning = action.payload;
    },
    setIsCreateMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isCreateMenuOpen = action.payload;
    },
    setIsFullScreenModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isFullScreenModalOpen = action.payload;
    },
  },
});

// Export actions
export const {
  setSelectedTeam,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  setMainView,
  navigateToView,
  toggleWorkspace,
  toggleFolder,
  expandAllWorkspaces,
  expandAllFolders,
  setIsCreatingNewItem,
  setDarkMode,
  resetUiState,
  setShowFavorites,
  setShowLocked,
  setViewMode,
  setDebouncedSearchTerm,
  viewSnippet,
  backToWorkspace,
  updateWorkspaceSnippetsOrder,
  updateWorkspaceFolderSnippetsOrder,
  openLinkEditModal,
  closeLinkEditModal,
  clearEditorStates,
  setScrollToFolderId,
  setShowTodosView,
  setNewTabOverrideEnabled,
  setCommandStatus,
  resetCommandStatus,
  setLastSavedLocation,
  queueNotification,
  clearPendingNotification,
  toggleFocusMode,
  setOS,
  toggleCollapsedWorkspace,
  toggleCollapsedFolder,
  setCollapsedWorkspaces,
  setCollapsedFolders,
  setIsAutoExpandMode,
  setCollapsedSections,
  toggleCollapsedSection,
  setIsSidebarCollapsed,
  setSharedFolderCreationView,
  setIsCommandListView,
  setHighlightedCommandId,
  setDraftAutomation,
  clearDraftAutomation,
  setActiveTutorial,
  setHoverContext,
  setPendingLockedCommand,
  setPendingAutomation,
  setPendingAgent,
  setTodoCreatePrefill,
  setTodoDraft,
  setTodoCreateMode,
  setIsEditorDirty,
  setPendingNavigationAction,
  setShowEditorSwitchWarning,
  setIsCreateMenuOpen,
  setIsFullScreenModalOpen,
} = uiStateSlice.actions;

// Export selectors
export const selectMainView = (state: RootState) => state.uiState?.mainView;
export const selectSelectedTeam = (state: RootState) => state.uiState?.selectedTeam;
export const selectSelectedWorkspace = (state: RootState) => state.uiState?.selectedWorkspace;
export const selectSelectedFolder = (state: RootState) => state.uiState?.selectedFolder;
export const selectSelectedSnippet = (state: RootState) => state.uiState?.selectedSnippet;
export const selectSnippetBreadCrum = (state: RootState) => state.uiState?.snippetBreadCrum;
export const selectExpandedWorkspaces = (state: RootState) => state.uiState?.expandedWorkspaces;
export const selectExpandedFolders = (state: RootState) => state.uiState?.expandedFolders;
export const selectIsCreatingNewItem = (state: RootState) => state.uiState?.isCreatingNewItem;
export const selectDarkMode = (state: RootState) => state.uiState?.darkMode;
export const selectShowFavorites = (state: RootState) => state.uiState?.showFavorites;
export const selectShowLocked = (state: RootState) => state.uiState?.showLocked;
export const selectViewMode = (state: RootState) => state.uiState?.viewMode;
export const selectDebouncedSearchTerm = (state: RootState) => state.uiState?.debouncedSearchTerm;
export const selectIsLinkEditModalOpen = (state: RootState) => state.uiState?.isLinkEditModalOpen;
export const selectIsLinkEditMode = (state: RootState) => state.uiState?.isLinkEditMode;
export const selectActiveLinkSnippet = (state: RootState) => state.uiState?.activeLinkSnippet;
export const selectScrollToFolderId = (state: RootState) => state.uiState?.scrollToFolderId;
export const selectShowTodosView = (state: RootState) => state.uiState?.showTodosView;
export const selectIsNewTabOverrideEnabled = (state: RootState) => state.uiState?.isNewTabOverrideEnabled;
export const selectCommandStatus = (state: RootState) => state.uiState?.commandStatus;
export const selectLastSavedLocation = (state: RootState) => state.uiState?.lastSavedLocation;
export const selectIsFocusMode = (state: RootState) => state.uiState?.isFocusMode;
export const selectOS = (state: RootState) => state.uiState?.os;
export const selectIsMac = (state: RootState) => state.uiState?.os === 'mac';
export const selectPendingNotification = (state: RootState) => state.uiState?.pendingNotification;

export const selectIsAutoExpandMode = (state: RootState) => state.uiState?.isAutoExpandMode ?? true;
export const selectCollapsedWorkspaces = (state: RootState) => state.uiState?.collapsedWorkspaces ?? {};
export const selectCollapsedFolders = (state: RootState) => state.uiState?.collapsedFolders ?? {};
export const selectCollapsedSections = (state: RootState) => state.uiState?.collapsedSections ?? {};
export const selectIsSidebarCollapsed = (state: RootState) => state.uiState?.isSidebarCollapsed ?? false;
export const selectIsSharedFolderCreationView = (state: RootState) =>
  state.uiState?.isSharedFolderCreationView ?? false;
export const selectIsCommandListView = (state: RootState) => state.uiState?.isCommandListView ?? false;
export const selectHighlightedCommandId = (state: RootState) => state.uiState?.highlightedCommandId ?? null;
export const selectLinkEditPrefill = (state: RootState) => state.uiState?.linkEditPrefill ?? null;
export const selectDraftAutomation = (state: RootState) => state.uiState?.draftAutomation ?? null;
export const selectActiveTutorial = (state: RootState) => state.uiState?.activeTutorial ?? null;
export const selectHoverContext = (state: RootState) => state.uiState?.hoverContext ?? null;
export const selectPendingLockedCommand = (state: RootState) => state.uiState?.pendingLockedCommand ?? null;
export const selectPendingAutomation = (state: RootState) => state.uiState?.pendingAutomation ?? null;
export const selectPendingAgent = (state: RootState) => state.uiState?.pendingAgent ?? null;
export const selectTodoCreatePrefill = (state: RootState) => state.uiState?.todoCreatePrefill ?? null;
export const selectIsTodoCreateMode = (state: RootState) => state.uiState?.isTodoCreateMode ?? false;
export const selectTodoDraft = (state: RootState) => state.uiState?.todoDraft;
export const selectIsEditorDirty = (state: RootState) => state.uiState?.isEditorDirty ?? false;
export const selectPendingNavigationAction = (state: RootState) => state.uiState?.pendingNavigationAction ?? null;
export const selectShowEditorSwitchWarning = (state: RootState) => state.uiState?.showEditorSwitchWarning ?? false;
export const selectIsCreateMenuOpen = (state: RootState) => state.uiState?.isCreateMenuOpen ?? false;
export const selectIsFullScreenModalOpen = (state: RootState) => state.uiState?.isFullScreenModalOpen ?? false;

export default uiStateSlice.reducer;
