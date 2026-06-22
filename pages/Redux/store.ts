import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from './persistStorage';
import allReducer from './AllData/allDataSlice';
import uiStateReducer from './AllData/uiStateSlice';
import toastReducer from './Toast/toastSlice';
import workspaceReducer from './Workspaces/workspaceSlice';

export type RootState = ReturnType<typeof store.getState>;

// Configure persistence for the uiState
const uiStatePersistConfig = {
  key: 'uiState',
  storage,
  whitelist: [
    'selectedTeam',
    'selectedWorkspace',
    'selectedFolder',
    'selectedSnippet',
    'snippetBreadCrum',
    'expandedWorkspaces',
    'expandedFolders',
    'darkMode',
    'lastSavedLocation',
    'showFavorites',
    'collapsedWorkspaces',
    'collapsedFolders',
    'collapsedSections',
    'showTodosView',
  ],
};

const rootReducer = combineReducers({
  all: allReducer,
  uiState: persistReducer(uiStatePersistConfig, uiStateReducer),
  toast: toastReducer,
  workspaces: workspaceReducer,
});

// Configure root persistence
const persistConfig = {
  key: 'root',
  storage,
  whitelist: [], // Nested reducers (like uiState) have their own persist configs
  blacklist: ['all', 'uiState', 'toast', 'workspaces'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const unsavedChangesGuardMiddleware = (storeApi: any) => (next: any) => (action: any) => {
  // If the action is explicitly bypassing the guard, let it through
  if (action.__bypassUnsavedGuard) {
    const cleanAction = { ...action };
    delete cleanAction.__bypassUnsavedGuard;
    return next(cleanAction);
  }

  const interceptedActions = [
    'uiState/navigateToView',
    'uiState/setSelectedSnippet',
    'uiState/setIsCreatingNewItem',
    'uiState/openLinkEditModal',
    'uiState/setShowTodosView',
    'uiState/setTodoCreatePrefill',
    'uiState/clearEditorStates',
  ];

  if (interceptedActions.includes(action.type)) {
    const state = storeApi.getState();
    const isEditorDirty = state.uiState?.isEditorDirty;
    
    if (isEditorDirty) {
      // It's dirty! Block the navigation, save it as pending, and show the warning
      storeApi.dispatch({ type: 'uiState/setPendingNavigationAction', payload: action });
      storeApi.dispatch({ type: 'uiState/setShowEditorSwitchWarning', payload: true });
      return; // Intercepted
    }
  }

  return next(action);
};

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.workspace', 'payload.team', 'payload.folder', 'payload.snippet'],
        // Ignore these paths in the state
        ignoredPaths: [
          'uiState.selectedTeam',
          'uiState.selectedWorkspace',
          'uiState.selectedFolder',
          'uiState.selectedSnippet',
          'uiState.snippetBreadCrum',
        ],
      },
    }).concat(unsavedChangesGuardMiddleware),
});

export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
