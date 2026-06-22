import type { RowData, GridRow } from './types';
import { extractUrlsFromSnippet } from '../SearchComponents/SearchPopup/snippetInteractiveUtils';
import {
  updateSnippetRealtime,
  updateSnippetHotkey,
  updateSnippetShortcut,
  deleteSnippet,
} from '../../../../Apis/features/snippetApi';
import { addFavorite, deleteFavorite } from '../../../../Apis/services/favoritesApi';
import { updateAutomationRealtime, deleteAutomationInstance, updateInputOverride } from '../../../../Apis/features/automationsApi';
import {
  updateLocalHotkey,
  updateLocalShortcut,
  getUserHotkey,
  getUserShortcut,
  extractSnippetIdFromCommandId,
} from '../../../../utils/shortcutHotkeyUtils';
import {
  optimisticAddSnippet,
  optimisticUpdateSnippet,
  optimisticUpdateAutomation,
  optimisticDeleteSnippet,
  optimisticDeleteAutomation,
} from '../../../../Redux/AllData/allDataSlice';
import { queueNotification, resetCommandStatus, setCommandStatus } from '../../../../Redux/AllData/uiStateSlice';
import { getUserId, updateAutomation } from '../../../../Apis/core/api';
import { enqueueFavoriteAction } from '../../../../Apis/services/favoritesQueue';
import { create } from 'zustand';
import { COMMANDS } from '../SearchComponents/Searchbar/commands';
import { commandRegistry } from '../../commands/registry';
import { updateHotkeyAndRefresh, updateCommandAndRefresh } from '../../../../Apis/features/userCommandsApiService';
import {
  readAllHotkeys,
  readAllShortcuts,
  extractSnippetIdFromCompoundId,
  getItemCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { updateInstallation, installModule } from '../../../../Apis/storeApis/storeApiService';
export type CellPosition = {
  rowIndex: number;
  colIndex: number;
};

interface GridState {
  selectedCell: CellPosition | null;
  editingCell: CellPosition | null;
  tableData: GridRow[];
  columnCount: number;
  isPickerOpen: boolean;
  pickerRowIndex: number | null;
  visibilityFilter: string[];
  categoryFilter: string[];
  searchTerm: string;
  isSaving: boolean;
  showSuccess: boolean;
  showFavoritesOnly: boolean;
  showHotkeysOnly: boolean;
  showShortcutsOnly: boolean;
  spaceFilter: string[];
  isFilterMenuOpen: boolean;

  expandedEmptySections: boolean;
  setFilterMenuOpen: (open: boolean) => void;

  setSelectedCell: (cell: CellPosition | null) => void;
  setEditingCell: (cell: CellPosition | null) => void;
  setTableData: (data: GridRow[]) => void;
  setColumnCount: (count: number) => void;
  addRow: (section: string, initialData?: Partial<RowData>) => void;
  removeRow: (rowId: string, dispatch?: any) => void;
  updateCellData: (
    rowId: string,
    colIndex: number,
    columnId: string,
    value: any,
    dispatch: any,
    allTeams: any[],
  ) => void;
  overwriteCellData: (
    rowId: string,
    colIndex: number,
    columnId: string,
    value: any,
    conflictId: string,
    dispatch: any,
    allTeams: any[],
  ) => void;
  updateRowLocation: (
    rowId: string,
    wsId: string,
    wsName: string,
    fId: string | null,
    fName: string | null,
    pathNames: string[],
    visibility: any,
    dispatch: any,
    allTeams: any[],
  ) => void;
  syncRealNotes: (
    teams: any[],
    userId: string,
    selectedTeamId: string | null,
    favsMap: Record<string, any[]>,
    hotkeysMap: Record<string, string>,
    shortcutsMap: Record<string, string>,
    automations: any[],
    agents: any[],
    installedModules: any[],
    bookmarks: any[],
  ) => void;

  toggleEmptySections: () => void;

  openPicker: (rowId: string) => void;

  columnFilters: Record<string, string>;
  setColumnFilter: (columnId: string, value: string) => void;

  closePicker: () => void;
  toggleFavorite: (rowId: string) => void;

  setCategoryFilter: (filter: string[]) => void;
  setVisibilityFilter: (filter: string[]) => void;
  setSearchTerm: (term: string) => void;
  setIsSaving: (val: boolean) => void;
  setShowSuccess: (val: boolean) => void;
  setShowFavoritesOnly: (val: boolean) => void;
  setShowHotkeysOnly: (val: boolean) => void;
  setShowShortcutsOnly: (val: boolean) => void;
  setSpaceFilter: (filter: string[]) => void;
  targetSection: string | null;
  setTargetSection: (section: string | null) => void;
  collapsedSections: string[];
  toggleSection: (title: string) => void;
  expandedCategories: string[];
  toggleCategory: (categoryId: string) => void;
  setRowStatus: (rowId: string, status: 'idle' | 'syncing' | 'saved' | 'error', message?: string) => void;
  commitRowToBackend: (rowId: string, dispatch: any, allTeams: any[], noChange?: boolean) => Promise<void>;
  quickAddModal: { isOpen: boolean; type: 'note' | 'link' | 'snippet' | 'prompt' | null };
  setQuickAddModal: (type: 'note' | 'link' | 'snippet' | 'prompt' | null) => void;

  undoDelete: (rowId: string) => void;
  lastSyncArgs?: any;
}

export const useGridStore = create<GridState>((set, get) => ({
  selectedCell: null, // Start unselected so main search bar gets focus
  editingCell: null,
  tableData: [
    { type: 'section', title: 'Smart Links' },
    { type: 'section', title: 'Notes' },
    { type: 'section', title: 'Snippets' },
    { type: 'section', title: 'Prompts' },
    { type: 'section', title: 'Saved Automations' },
    { type: 'section', title: 'Chat Agents' },
    { type: 'section', title: 'Installed Modules' },
    { type: 'section', title: 'Bookmarks' },
    { type: 'section', title: 'Browser Commands' },
  ],

  columnCount: 7,
  isPickerOpen: false,
  pickerRowIndex: null,
  categoryFilter: ['all'],
  visibilityFilter: ['all'],
  searchTerm: '',
  columnFilters: {},
  isSaving: false,
  showSuccess: false,
  showFavoritesOnly: false,
  showHotkeysOnly: false,
  showShortcutsOnly: false,
  spaceFilter: ['all'],
  collapsedSections: [],
  expandedCategories: [],
  expandedEmptySections: false,
  targetSection: null,
  quickAddModal: { isOpen: false, type: null },

  setSelectedCell: cell => set({ selectedCell: cell }),
  setTargetSection: section => set({ targetSection: section }),
  setEditingCell: cell => set({ editingCell: cell }),
  setTableData: data => set({ tableData: data }),
  setColumnCount: count => set({ columnCount: count }),
  setCategoryFilter: filter => set({ categoryFilter: filter }),
  setVisibilityFilter: filter => set({ visibilityFilter: filter }),
  setSearchTerm: term => set({ searchTerm: term }),
  setColumnFilter: (columnId, value) =>
    set(state => ({
      columnFilters: { ...state.columnFilters, [columnId]: value },
    })),
  setIsSaving: val => set({ isSaving: val }),
  setShowFavoritesOnly: val => set({ showFavoritesOnly: val }),
  setShowHotkeysOnly: val => set({ showHotkeysOnly: val }),
  setShowShortcutsOnly: val => set({ showShortcutsOnly: val }),
  setSpaceFilter: filter => set({ spaceFilter: filter }),

  setQuickAddModal: type => set({ quickAddModal: { isOpen: !!type, type } }),
  setShowSuccess: val => {
    set({ showSuccess: val });
    if (val) setTimeout(() => set({ showSuccess: false }), 1200);
  },
  openPicker: rowId => {
    const state = useGridStore.getState();
    const index = state.tableData.findIndex(r => r.type === 'data' && r.id === rowId);
    if (index !== -1) {
      set({ isPickerOpen: true, pickerRowIndex: index });
    }
  },
  closePicker: () => set({ isPickerOpen: false, pickerRowIndex: null }),

  toggleSection: title =>
    set(state => {
      const isCollapsed = state.collapsedSections.includes(title);
      if (isCollapsed) {
        return { collapsedSections: state.collapsedSections.filter(s => s !== title) };
      } else {
        return { collapsedSections: [...state.collapsedSections, title] };
      }
    }),
  toggleEmptySections: () => set(state => ({ expandedEmptySections: !state.expandedEmptySections })),
  toggleCategory: categoryId =>
    set(state => {
      const isExpanded = state.expandedCategories.includes(categoryId);
      if (isExpanded) {
        return { expandedCategories: state.expandedCategories.filter(id => id !== categoryId) };
      } else {
        return { expandedCategories: [...state.expandedCategories, categoryId] };
      }
    }),
  setRowStatus: (rowId, status, message) =>
    set(state => {
      const index = state.tableData.findIndex(r => r.type === 'data' && r.id === rowId);
      if (index === -1) return state;
      const nd = [...state.tableData];
      if (nd[index] && nd[index].type === 'data') {
        nd[index] = { ...nd[index], syncStatus: status, syncMessage: message } as any;
      }
      return { tableData: nd };
    }),

  toggleFavorite: (rowId: string) => {
    const state = useGridStore.getState();
    const row = state.tableData.find(r => r.type === 'data' && r.id === rowId) as RowData;
    if (row) {
      const isFav = !row.fav;

      set(s => {
        const nd = [...s.tableData];
        const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
        if (idx !== -1 && nd[idx].type === 'data') {
          if (row.isReal) {
            // Delay fill for real items
            nd[idx] = {
              ...nd[idx],
              syncStatus: 'syncing',
              favAction: isFav ? 'adding' : 'removing',
            } as any;
          } else {
            // Immediate fill for new/non-real items
            nd[idx] = {
              ...nd[idx],
              fav: isFav,
            } as any;
          }
        }
        return { tableData: nd };
      });

      // Only push to backend queue if the row is already saved (isReal)
      if (row.isReal) {
        enqueueFavoriteAction(async () => {
          const state = useGridStore.getState();
          const userId = await getUserId();
          const currentData = state.tableData;
          const rowIndex = currentData.findIndex(r => r.type === 'data' && r.id === rowId);

          // Storage Key Resolution: Personal = userId, Org = team_id
          const storageKey = row.isPersonal ? userId : row.team_id || userId;

          if (isFav) {
            // Add favorite logic using global queue
            set(s => {
              const nd = [...s.tableData];
              const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
              if (idx !== -1 && nd[idx].type === 'data') {
                nd[idx] = {
                  ...nd[idx],
                  syncStatus: 'syncing',
                  favAction: 'adding',
                } as any;
              }
              return { tableData: nd };
            });

            try {
              let apiType: 'snippet' | 'automation' | 'agent' | 'command' | 'module' = 'snippet';
              if (row.category === 'automation') apiType = 'automation';
              else if (row.category === 'agent') apiType = 'agent';
              else if (row.category === 'module') apiType = 'module';
              else if (row.category === 'link' || row.category === 'note' || row.category === 'snippet') apiType = 'snippet';

              const response = await addFavorite(
                userId,
                {
                  id: String(row.id),
                  snippet_id: row.snippet_id,
                  module_id: row.module_id,
                  installation_id: row.installation_id || row.id,
                } as any,
                apiType,
              );

              if (response) {
                const result: any = await new Promise(res => chrome.storage.local.get('myFavouriteItems', res));
                const favItems = result.myFavouriteItems || {};

                Object.keys(favItems).forEach(k => {
                  if (Array.isArray(favItems[k])) {
                    favItems[k] = favItems[k].filter(
                      (f: any) =>
                        String(f.id || f.snippet_id) !== String(row.id) &&
                        String(f.snippet_id || f.id) !== String(row.snippet_id || row.id),
                    );
                  }
                });

                const favoriteObject = {
                  ...(row.automationData || row),
                  fav: true,
                  favourite_id: response.favourite_id,
                  syncStatus: 'saved',
                };
                const updatedList = [favoriteObject, ...(favItems[userId] || [])];
                await chrome.storage.local.set({ myFavouriteItems: { ...favItems, [userId]: updatedList } });

                if (row.category === 'module') {
                  const installationId = row.installation_id || row.id;
                  const modRes: any = await new Promise(res => chrome.storage.local.get('installed_modules', res));
                  const currentModules = modRes.installed_modules || [];
                  const updatedModules = currentModules.map((m: any) => {
                    if (String(m.id || m.installation_id) === String(installationId)) {
                      return { ...m, is_favourite: true };
                    }
                    return m;
                  });
                  await chrome.storage.local.set({ installed_modules: updatedModules });
                }

                set(s => {
                  const nd = [...s.tableData];
                  const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                  if (idx !== -1 && nd[idx].type === 'data') {
                    nd[idx] = {
                      ...nd[idx],
                      favourite_id: response.favourite_id,
                      syncStatus: 'saved',
                      favAction: 'adding',
                      fav: true,
                    } as any;
                  }
                  return { tableData: nd };
                });
                await new Promise(res => setTimeout(res, 3000));
              }
            } catch (e) {
              console.error('[gridStore] Add Favorite Failed:', e);
              set(s => {
                const nd = [...s.tableData];
                const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                if (idx !== -1 && nd[idx].type === 'data') {
                  nd[idx] = {
                    ...nd[idx],
                    syncStatus: 'idle',
                    favAction: undefined,
                    fav: false,
                  } as any;
                }
                return { tableData: nd };
              });
            }
          } else {
            // Remove favorite logic using global queue
            set(s => {
              const nd = [...s.tableData];
              const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
              if (idx !== -1 && nd[idx].type === 'data') {
                nd[idx] = {
                  ...nd[idx],
                  syncStatus: 'syncing',
                  favAction: 'removing',
                } as any;
              }
              return { tableData: nd };
            });

            try {
              const favId = (row as any).favourite_id;
              const result: any = await new Promise(res => chrome.storage.local.get('myFavouriteItems', res));
              const favItems = result.myFavouriteItems || {};

              await deleteFavorite(userId, favId, false, undefined, {
                id: String(row.id),
                type: row.category as any,
                moduleId: row.module_id !== undefined ? String(row.module_id) : undefined,
              });

              if (row.category === 'module') {
                const installationId = row.installation_id || row.id;
                const modRes: any = await new Promise(res => chrome.storage.local.get('installed_modules', res));
                const currentModules = modRes.installed_modules || [];
                const updatedModules = currentModules.map((m: any) => {
                  if (String(m.id || m.installation_id) === String(installationId)) {
                    return { ...m, is_favourite: false };
                  }
                  return m;
                });
                await chrome.storage.local.set({ installed_modules: updatedModules });
              }

              Object.keys(favItems).forEach(key => {
                if (Array.isArray(favItems[key])) {
                  favItems[key] = favItems[key].filter(
                    (f: any) =>
                      String(f.id || f.snippet_id) !== String(row.id) &&
                      String(f.snippet_id || f.id) !== String(row.snippet_id || row.id),
                  );
                }
              });

              await chrome.storage.local.set({ myFavouriteItems: favItems });

              set(s => {
                const nd = [...s.tableData];
                const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                if (idx !== -1 && nd[idx].type === 'data') {
                  nd[idx] = {
                    ...nd[idx],
                    favourite_id: undefined,
                    syncStatus: 'saved',
                    favAction: 'removing',
                    fav: false,
                  } as any;
                }
                return { tableData: nd };
              });
              await new Promise(res => setTimeout(res, 3000));
            } catch (e) {
              console.error('[gridStore] Delete Favorite Failed:', e);
              set(s => {
                const nd = [...s.tableData];
                if (rowIndex !== -1 && nd[rowIndex].type === 'data') {
                  (nd[rowIndex] as any).syncStatus = 'idle';
                  (nd[rowIndex] as any).favAction = undefined;
                }
                return { tableData: nd };
              });
            }
          }

          // Return row to idle status after confirmation delay
          set(s => {
            const nd = [...s.tableData];
            const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
            if (idx !== -1 && nd[idx].type === 'data') {
              nd[idx] = {
                ...nd[idx],
                syncStatus: 'idle',
                favAction: undefined,
              } as any;
            }
            return { tableData: nd, isSaving: false };
          });
        });
      }
    }
  },

  addRow: (section, initialData) =>
    set(state => {
      const newRow: GridRow = {
        type: 'data',
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        url: '',
        folder: '',
        fav: false,
        key: '',
        command: '',
        section,
        ...initialData,
      };

      const newData = [...state.tableData];
      const sectionIndex = newData.findIndex(r => r.type === 'section' && r.title === section);

      if (sectionIndex !== -1) {
        newData.splice(sectionIndex + 1, 0, newRow);
      } else {
        newData.push(newRow);
      }

      return { tableData: newData };
    }),

  removeRow: async (rowId: string, dispatch?: any) => {
    const state = useGridStore.getState();
    const index = state.tableData.findIndex(r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId);
    if (index === -1) return;

    const rowToRemove = state.tableData[index] as RowData;
    if (!rowToRemove) return;

    // 1. Mark as deleting in UI
    set(state => {
      const newData = [...state.tableData];
      const i = newData.findIndex(r => (r.type === 'data' || r.type === 'automationModule') && (r as any).id === rowId);
      if (i !== -1) {
        const timer = setTimeout(() => {
          // Actual backend removal after 3s
          const finalState = useGridStore.getState();
          const finalIndex = finalState.tableData.findIndex(
            r => (r.type === 'data' || r.type === 'automationModule') && (r as any).id === rowId,
          );
          if (finalIndex === -1) return;

          const finalRow = finalState.tableData[finalIndex] as RowData;
          if (finalRow.isDeleting) {
            // 1. Backend removal
            (async () => {
              try {
                if (
                  finalRow.section === 'Smart Links' ||
                  finalRow.section === 'Notes' ||
                  finalRow.section === 'Snippets' ||
                  finalRow.section === 'Prompts'
                ) {
                  await deleteSnippet(finalRow.folder_id || undefined, finalRow.id);
                } else if (finalRow.section === 'Saved Automations' || finalRow.section === 'Chat Agents') {
                  const userId = await getUserId();
                  await deleteAutomationInstance(userId, finalRow.id);
                } else if (finalRow.section === 'Bookmarks' || (finalRow as any).category === 'bookmark') {
                  const bookmarkId = finalRow.id.replace('bm-', '');
                  const chromeAny = (window as any)?.chrome;
                  if (chromeAny?.bookmarks?.remove) {
                    chromeAny.bookmarks.remove(bookmarkId, () => {});
                  } else if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({ action: 'bookmarks_remove', id: bookmarkId }, () => {});
                  }
                }
              } catch (e) {
                console.error('Backend delete failed:', e);
              }

              // 2. Local Storage Cleanup
              try {
                const result: any = await new Promise(res =>
                  chrome.storage.local.get(
                    [
                      'automations',
                      'saved_automations',
                      'myFavouriteItems',
                      'selectedAIs',
                      'agent_panel_selected_agents',
                      'installed_modules',
                      'alts_automation_hotkeys',
                      'alts_automation_shortcuts',
                      'alts_link_hotkeys',
                      'alts_note_hotkeys',
                      'link_commands',
                      'note_commands',
                    ],
                    res,
                  ),
                );

                // --- myFavouriteItems: match by id OR snippet_id to avoid stale favorites ---
                if (result.myFavouriteItems) {
                  const next = { ...result.myFavouriteItems };
                  let changed = false;
                  Object.keys(next).forEach(k => {
                    if (Array.isArray(next[k])) {
                      const len = next[k].length;
                      next[k] = next[k].filter(
                        (f: any) =>
                          String(f.id) !== String(finalRow.id) &&
                          String(f.snippet_id) !== String(finalRow.id) &&
                          String(f.id) !== String(rowId) &&
                          String(f.snippet_id) !== String(rowId),
                      );
                      if (next[k].length !== len) changed = true;
                    }
                  });
                  if (changed) await chrome.storage.local.set({ myFavouriteItems: next });
                }

                // --- Notes/Snippets/Links cache cleanup (Hotkeys and Shortcuts) ---
                if (
                  finalRow.section === 'Smart Links' ||
                  finalRow.section === 'Notes' ||
                  finalRow.section === 'Snippets' ||
                  finalRow.section === 'Prompts'
                ) {
                  const snippetId = String(finalRow.id);
                  if (result.alts_link_hotkeys && result.alts_link_hotkeys[snippetId]) {
                    const next = { ...result.alts_link_hotkeys };
                    delete next[snippetId];
                    await chrome.storage.local.set({ alts_link_hotkeys: next });
                  }
                  if (result.alts_note_hotkeys && result.alts_note_hotkeys[snippetId]) {
                    const next = { ...result.alts_note_hotkeys };
                    delete next[snippetId];
                    await chrome.storage.local.set({ alts_note_hotkeys: next });
                  }
                  if (result.link_commands && result.link_commands[snippetId]) {
                    const next = { ...result.link_commands };
                    delete next[snippetId];
                    await chrome.storage.local.set({ link_commands: next });
                  }
                  if (result.note_commands && result.note_commands[snippetId]) {
                    const next = { ...result.note_commands };
                    delete next[snippetId];
                    await chrome.storage.local.set({ note_commands: next });
                  }
                }

                // --- Installed Modules cache cleanup ---
                if (finalRow.section === 'Installed Modules') {
                  if (Array.isArray(result.installed_modules)) {
                    const next = result.installed_modules.filter(
                      (m: any) => String(m.id || m.module_id) !== String(finalRow.id) && String(m.id || m.module_id) !== String(rowId)
                    );
                    if (next.length !== result.installed_modules.length) {
                      await chrome.storage.local.set({ installed_modules: next });
                    }
                  }
                }

                // --- Automation/Agent caches: clean both 'automations' map AND 'saved_automations' array ---
                if (finalRow.section === 'Saved Automations' || finalRow.section === 'Chat Agents') {
                  // Map-style cache (keyed by automation id)
                  if (result.automations) {
                    const next = { ...result.automations };
                    delete next[String(finalRow.id)];
                    delete next[rowId];
                    await chrome.storage.local.set({ automations: next });
                  }
                  // Legacy array-style cache
                  if (Array.isArray(result.saved_automations)) {
                    const next = result.saved_automations.filter(
                      (a: any) => String(a.id) !== String(finalRow.id) && String(a.id) !== rowId,
                    );
                    if (next.length !== result.saved_automations.length) {
                      await chrome.storage.local.set({ saved_automations: next });
                    }
                  }
                  // Clean automation hotkeys/shortcuts
                  if (result.alts_automation_hotkeys) {
                    const next = { ...result.alts_automation_hotkeys };
                    delete next[String(finalRow.id)];
                    await chrome.storage.local.set({ alts_automation_hotkeys: next });
                  }
                  if (result.alts_automation_shortcuts) {
                    const next = { ...result.alts_automation_shortcuts };
                    delete next[String(finalRow.id)];
                    await chrome.storage.local.set({ alts_automation_shortcuts: next });
                  }
                }
              } catch (err) {
                console.warn('Storage cleanup failed:', err);
              }

              // 3. Redux Sync
              if (dispatch) {
                if (
                  finalRow.section === 'Smart Links' ||
                  finalRow.section === 'Notes' ||
                  finalRow.section === 'Snippets' ||
                  finalRow.section === 'Prompts'
                ) {
                  dispatch(
                    optimisticDeleteSnippet({
                      teamId: finalRow.team_id,
                      workspaceId: finalRow.workspace_id || undefined,
                      folderId: finalRow.folder_id,
                      snippetId: finalRow.id,
                    }),
                  );
                } else if (finalRow.section === 'Saved Automations' || finalRow.section === 'Chat Agents') {
                  dispatch(
                    optimisticDeleteAutomation({
                      teamId: finalRow.team_id,
                      workspaceId: finalRow.workspace_id || undefined,
                      folderId: finalRow.folder_id,
                      automationId: finalRow.id,
                    }),
                  );
                }
              }
            })();

            set(s => ({
              tableData: s.tableData.filter(r => (r as any).id !== rowId),
            }));
          }
        }, 3000);

        newData[i] = { ...newData[i], isDeleting: true, deleteTimer: timer } as any;
      }
      return { tableData: newData };
    });
  },

  undoDelete: (rowId: string) => {
    set(state => {
      const newData = [...state.tableData];
      const i = newData.findIndex(r => (r as any).id === rowId);
      if (i !== -1 && (newData[i] as any).isDeleting) {
        clearTimeout((newData[i] as any).deleteTimer);
        newData[i] = { ...newData[i], isDeleting: false, deleteTimer: undefined } as any;
      }
      return { tableData: newData };
    });
  },

  updateCellData: (rowId, colIndex, columnId, value, dispatch, allTeams) => {
    const state = useGridStore.getState();

    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
    );
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index];
    if (!row || (row.type !== 'data' && row.type !== 'automationModule')) return;

    let noChange = false;
    const isTextContent =
      row.section === 'Notes' || row.section === 'Snippets' || row.section === 'Prompts';

    if (columnId === 'name') {
      if (row.name === value) noChange = true;
      row.name = value;
    } else if (columnId === 'url') {
      if (isTextContent) {
        if (row.value === value) noChange = true;
        row.value = value;
      } else {
        if (row.url === value) noChange = true;
        row.url = value;
        try {
          if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            const parsed = JSON.parse(value);
            if (parsed.urls) row.urls = parsed.urls;
          } else {
            row.urls = value.trim() ? [value.trim()] : [];
          }
        } catch (e) {
          row.urls = value.trim() ? [value.trim()] : [];
        }
      }
    } else if (columnId === 'folder' || columnId === 'path') {
      if (row.path === value) noChange = true;
      row.path = value;
    } else if (columnId === 'key') {
      if (row.key === value) noChange = true;
      row.key = value;
    } else if (columnId === 'command') {
      if (row.command === value) noChange = true;
      row.command = value;
    } else if (columnId === 'value') {
      if (row.value === value) noChange = true;
      row.value = value;
    } else if (columnId === 'automationData') {
      row.automationData = value;
    }

    // Set editAction for feedback
    if (columnId === 'key') row.editAction = 'hotkey';
    else if (columnId === 'command') row.editAction = 'command';
    else if (columnId === 'name') row.editAction = 'name';
    else if (columnId === 'value' || columnId === 'url') row.editAction = 'value';
    else if (columnId === 'automationData') row.editAction = 'automation';

    set({ tableData: newData });
    state.commitRowToBackend(rowId, dispatch, allTeams, noChange);
  },

  overwriteCellData: async (rowId, colIndex, columnId, value, conflictId, dispatch, allTeams) => {
    const state = useGridStore.getState();
    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
    );
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index];
    if (!row || (row.type !== 'data' && row.type !== 'automationModule')) return;

    dispatch(setCommandStatus({ status: 'loading', message: 'Overwriting...' }));

    try {
      // 1. Clear existing conflict
      const isCommand = COMMANDS.some(c => c.id === conflictId);
      if (isCommand) {
        // Clear command hotkey/shortcut
        if (columnId === 'key') {
          try {
            await updateHotkeyAndRefresh(conflictId, '');
          } catch (e) {}
          await updateLocalHotkey(conflictId, '', 'command');
        } else {
          try {
            await updateCommandAndRefresh(conflictId, { prefix: '' });
          } catch (e) {}
        }
      } else {
        // Check if the conflict row is an automation/agent — use the new API
        const conflictRow = state.tableData.find(
          r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
        ) as any;
        const isConflictAutomation =
          conflictRow?.category === 'automation' ||
          conflictRow?.category === 'agent' ||
          conflictRow?.section === 'My Saved Automations' ||
          conflictRow?.section === 'Chat Agents';

        if (isConflictAutomation) {
          // Clear hotkey/shortcut via /automations endpoint
          try {
            const userId = await getUserId();
            const clearPayload: any = { automation_id: String(conflictRow.id) };
            if (columnId === 'key') clearPayload.hotkeys = null;
            else clearPayload.shortcuts = null;
            await updateAutomationRealtime(userId, clearPayload);
          } catch (e) {
            console.warn('[overwriteCellData] Automation conflict clear failed (non-critical):', e);
          }
          await updateLocalHotkey(conflictId, '', 'automation');
        } else {
          // Clear snippet hotkey/shortcut
          const sId = extractSnippetIdFromCompoundId(conflictId);
          if (columnId === 'key') {
            try {
              await updateSnippetHotkey(sId, '');
            } catch (e) {}
            await updateLocalHotkey(conflictId, '', 'note');
          } else {
            try {
              await updateSnippetShortcut(sId, '');
            } catch (e) {}
            await updateLocalShortcut(conflictId, sId, '', '', 'note');
          }
        }
      }

      // 2. Proceed with normal update
      state.updateCellData(rowId, colIndex, columnId, value, dispatch, allTeams);
      dispatch(setCommandStatus({ status: 'success', message: 'Overwritten successfully' }));
      setTimeout(() => dispatch(resetCommandStatus()), 2000);
    } catch (err) {
      console.error('Overwrite failed:', err);
      dispatch(setCommandStatus({ status: 'error', message: 'Overwrite failed' }));
    }
  },

  commitRowToBackend: async (rowId, dispatch, allTeams, noChange = false) => {
    const state = useGridStore.getState();
    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
    );
    if (index === -1) {
      return;
    }

    const row = state.tableData[index];

    if (!row || (row.type !== 'data' && row.type !== 'automationModule')) return;

    // 1. Requirements Check for New Items
    if (!row.isReal) {
      const isNoteRow = row.section === 'Notes';
      const hasName = row.name?.trim();
      const hasValue = isNoteRow ? row.value?.trim() : row.url?.trim() || (row.urls && row.urls.length > 0);
      const hasLocation = !!row.workspace_id;

      if (!hasName || !hasValue || !hasLocation) {
        return;
      }
    }

    // 2. Handle Unchanged Case
    if (noChange && row.isReal) {
      set(s => {
        const nd = [...s.tableData];
        if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
          (nd[index] as any).syncStatus = 'saved';
          (nd[index] as any).syncMessage = 'Existing Unchanged';
        }
        return { tableData: nd };
      });
      setTimeout(() => {
        set(s => {
          const nd = [...s.tableData];
          if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
            (nd[index] as any).syncStatus = 'idle';
            (nd[index] as any).syncMessage = undefined;
          }
          return { tableData: nd };
        });
      }, 2000);
      return;
    }

    set(s => {
      const nd = [...s.tableData];
      if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
        (nd[index] as any).syncStatus = 'syncing';
        (nd[index] as any).syncMessage = 'Syncing...';
      }
      return { tableData: nd, isSaving: true };
    });

    // Helper for hostname resolution in multi-links
    const getHostname = (u: string) => {
      try {
        const urlObj = new URL(u.startsWith('http') ? u : `https://${u}`);
        return urlObj.hostname.replace('www.', '');
      } catch {
        return u;
      }
    };

    // 3. Synchronization logic (mirrors LinkEditModal.tsx)
    try {
      const untrimmedUrl = row.url || '';
      const hasQuickLinks = /\[query\]|\{query\}/i.test(untrimmedUrl);
      const urlsArray = row.urls || [];
      const isMulti = urlsArray.length > 1;

      // Determine Category
      const isNote = row.section === 'Notes';
      const isSnippet = row.section === 'Snippets';
      const isPrompt = row.section === 'Prompts';
      const isAutomation =
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents' ||
        row.category === 'automation' ||
        row.category === 'agent' ||
        row.category === 'module';
      const category: any = isNote
        ? 'note'
        : isSnippet
          ? 'snippet'
          : isPrompt
            ? 'prompt'
            : isAutomation
              ? row.category || 'automation'
              : isMulti
                ? 'TabGroup'
                : hasQuickLinks
                  ? 'quicklink'
                  : 'link';

      // Determine Value (JSON for Multi/Quick, String for single)
      let valueForRequest = isNote || isSnippet || isPrompt ? row.value || '' : untrimmedUrl;
      if (!isNote && !isSnippet && !isPrompt && !isAutomation && (isMulti || hasQuickLinks)) {
        const groupValue = {
          urls: urlsArray,
        };
        valueForRequest = JSON.stringify(groupValue);
      }

      const payload: any = {
        key: row.name.trim(),
        value: valueForRequest,
        category,
        folder_id: row.folder_id || null,
        workspace_id: row.workspace_id || null,
      };

      if (row.isReal && row.id) {
        payload.snippet_id = row.id;
      }

      let responseSnippet: any;

      // Specialized logic for Hotkey/Shortcut to match Favorite panel robustness
      // NOTE: Automations and agents are excluded here — they use updateAutomationRealtime in the else-if block below.
      const isAutomationRow =
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents' ||
        row.category === 'automation' ||
        row.category === 'agent' ||
        row.category === 'module';

      if (row.isReal && row.id && (row.editAction === 'hotkey' || row.editAction === 'command') && !isAutomationRow) {
        const itemType =
          (row.itemType as any) || (isNote ? 'note' : isSnippet ? 'snippet' : isPrompt ? 'prompt' : 'link');
        const compoundId = getItemCompoundId({
          ...row,
          workspace_id: row.workspace_id || '',
          folder_id: row.folder_id || '',
        });

        if (row.editAction === 'hotkey') {
          const res = await updateSnippetHotkey(row.id, row.key || '');
          responseSnippet = res;
          await updateLocalHotkey(compoundId, row.key || '', itemType);
          set(s => {
            const nd = [...s.tableData];
            if (nd[index].type === 'data' || nd[index].type === 'automationModule')
              (nd[index] as any).syncMessage = 'Hotkey Updated';
            return { tableData: nd };
          });
        } else {
          const res = await updateSnippetShortcut(row.id, row.command || '');
          responseSnippet = res;
          const cleanShortcut = row.command ? (row.command.startsWith('/') ? row.command : `/${row.command}`) : '';
          await updateLocalShortcut(
            compoundId,
            row.id,
            cleanShortcut,
            row.name || '',
            itemType as any,
            isNote ? undefined : 'link',
          );
          set(s => {
            const nd = [...s.tableData];
            if (nd[index].type === 'data' || nd[index].type === 'automationModule')
              (nd[index] as any).syncMessage = 'Shortcut Updated';
            return { tableData: nd };
          });
        }
      } else if (row.category === 'module') {
        if (row.editAction === 'automation') {
          // ─── Module Configuration Sync (2nd Column) ───────────────────────
          try {
            const userId = await getUserId();
            const moduleId = Number(row.module_id);
            const automationData = row.automationData || {};
            const paramConfigs: Record<string, any> = { ...(automationData.paramConfigs || {}) };

            // 🔍 Gather paramConfigs from all steps to ensure we have the latest token configurations
            const steps =
              automationData.steps || automationData.automation_steps || automationData.execution_steps || [];
            steps.forEach((s: any) => {
              if (s.config?.paramConfigs) {
                Object.assign(paramConfigs, s.config.paramConfigs);
              }
            });

            // 🛠️ Get Original Config to ensure we don't drop existing fields (like 'images')
            const originalConfig = automationData.input_split_config || {};
            const originalFields =
              originalConfig.split_fields ||
              originalConfig.canonical_fields ||
              automationData.variables ||
              automationData.execution_steps?.filter((s: any) => s.variables)?.flatMap((s: any) => s.variables) ||
              [];

            // 🔍 Extract tokens from URL and steps to ensure we don't miss any newly added tokens
            const tokensFromUrl =
              (row.url || '').match(/\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g) || [];
            const extractedKeys = tokensFromUrl.map(t => {
              const namedMatch = t.match(/^\{input_name="([^"]+)"\}$/);
              if (namedMatch) return namedMatch[1];
              const typeMatch = t.match(/^\{([^}:\s]+):([^}\s]+)\}$/);
              if (typeMatch) return typeMatch[2];
              return t.replace(/^\{|\}$/g, '');
            });

            // Map of all field keys we need to process
            const allFieldKeys = new Set([
              ...originalFields.map((f: any) => f.key || f.name).filter((k: any) => !!k && String(k).trim() !== ''),
              ...Object.keys(paramConfigs).filter((k: any) => !!k && String(k).trim() !== ''),
              ...extractedKeys.filter((k: any) => !!k && String(k).trim() !== ''),
            ]);

            

            // 1. Transform ALL fields into API structure (split_fields)
            const split_fields = Array.from(allFieldKeys).map(key => {
              const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
              return {
                key,
                type: cfg.type || 'short_text',
                label:
                  cfg.label ||
                  cfg.current_label ||
                  cfg.name ||
                  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                options:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                values:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                fixed_value: cfg.type === 'constant' ? cfg.fixedValue : undefined,
                description: cfg.type === 'constant' ? cfg.description : undefined,
              };
            });

            // 2. Build merge_mapping (standard direct mapping for EVERY field)
            const merge_mapping: Record<string, any> = {};
            allFieldKeys.forEach(key => {
              merge_mapping[key] = { op: 'direct', field: key };
            });

            // 3. Build canonical_fields
            const canonical_fields = Array.from(allFieldKeys).map(key => {
              const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
              return {
                key,
                options:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                values:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                required: cfg.required || false,
                current_type: cfg.type || cfg.current_type || 'short_text',
                default_type: cfg.default_type || cfg.type || 'short_text',
                current_label:
                  cfg.label ||
                  cfg.current_label ||
                  cfg.name ||
                  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                default_label:
                  cfg.label ||
                  cfg.current_label ||
                  cfg.name ||
                  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              };
            });

            const payload = {
              input_split_config: {
                version: 1,
                module_id: moduleId,
                module_key: row.module_key,
                module_name: row.name,
                split_fields: Array.from(allFieldKeys).map(key => {
                  const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
                  const isConstant = cfg.type === 'constant';
                  const dropdownVals =
                    cfg.type === 'dropdown'
                      ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                          .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                          .filter((v: any) => v && String(v).trim() !== '')
                      : null; // Use null for constants

                  return {
                    key,
                    type: cfg.type || 'short_text',
                    label: cfg.label || cfg.current_label || key,
                    options: dropdownVals,
                    values: dropdownVals,
                    fixed_value: isConstant ? cfg.fixedValue : undefined,
                    fixedValue: isConstant ? cfg.fixedValue : undefined,
                    description: isConstant ? cfg.description : undefined,
                  };
                }),
                merge_mapping,
                canonical_fields: Array.from(allFieldKeys).map(key => {
                  const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
                  const isConstant = cfg.type === 'constant';
                  const dropdownVals =
                    cfg.type === 'dropdown'
                      ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                          .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                          .filter((v: any) => v && String(v).trim() !== '')
                      : null; // Use null for constants

                  return {
                    key,
                    options: dropdownVals,
                    values: dropdownVals,
                    required: cfg.required || false,
                    current_type: cfg.type || 'short_text',
                    default_type: cfg.default_type || cfg.type || 'short_text',
                    current_label: cfg.label || cfg.current_label || key,
                    default_label: cfg.label || cfg.current_label || key,
                    fixed_value: isConstant ? cfg.fixedValue : undefined,
                    fixedValue: isConstant ? cfg.fixedValue : undefined,
                  };
                }),
              },
            };

            if (canonical_fields.length > 0) {
              
              await updateInputOverride(userId, moduleId, payload);
            } else {
              
            }

            set(s => {
              const nd = [...s.tableData];
              if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
                (nd[index] as any).syncStatus = 'saved';
                (nd[index] as any).syncMessage = 'Configuration Saved';
              }
              return { tableData: nd, isSaving: false };
            });

            setTimeout(() => {
              set(s => {
                const nd = [...s.tableData];
                const freshIndex = nd.findIndex(r => (r as any).id === rowId);
                if (
                  freshIndex !== -1 &&
                  (nd[freshIndex].type === 'data' || nd[freshIndex].type === 'automationModule')
                ) {
                  (nd[freshIndex] as any).syncStatus = 'idle';
                  (nd[freshIndex] as any).syncMessage = undefined;
                }
                return { tableData: nd };
              });
            }, 2000);
          } catch (err) {
            set(s => {
              const nd = [...s.tableData];
              if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
                (nd[index] as any).syncStatus = 'error';
                (nd[index] as any).syncMessage = 'Save Failed';
              }
              return { tableData: nd, isSaving: false };
            });
          }
        } else if (row.editAction === 'hotkey' || row.editAction === 'command') {
          const value = row.editAction === 'hotkey' ? row.key : row.command;
          const moduleId = row.module_id!;
          const installationId = row.installation_id;

          if (installationId) {
            await updateInstallation(moduleId, installationId, { hotkey: value, scope: 'user' });
          } else {
            const installRes = await installModule(moduleId, { hotkey: value, scope: 'user' });
            set(s => {
              const nd = [...s.tableData];
              if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
                (nd[index] as any).installation_id = installRes.id;
                (nd[index] as any).id = String(installRes.id);
              }
              return { tableData: nd };
            });
          }

          set(s => {
            const nd = [...s.tableData];
            if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
              (nd[index] as any).syncStatus = 'saved';
              (nd[index] as any).syncMessage =
                row.editAction === 'hotkey' ? 'Module Hotkey Updated' : 'Shortcut Updated';
            }
            return { tableData: nd };
          });
          await updateLocalHotkey(String(moduleId), value || '', 'module');
        }
        return;
      } else if (
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents' ||
        row.category === 'automation' ||
        row.category === 'agent'
      ) {
        // ─── Automation Sync Logic ────────────────────────────────────────────
        const automationId = Number(row.id);
        const userId = await getUserId();

        if (row.editAction === 'hotkey' || row.editAction === 'command') {
          // ── Hotkey / Shortcut Only ─────────────────────────────────────────
          // Don't re-save steps/name — just update the hotkey or shortcut field.
          try {
            const cloudPayload: any = {
              automation_id: String(automationId),
              workspace_id: row.workspace_id,
              folder_id: row.folder_id || null,
            };
            if (row.editAction === 'hotkey') {
              cloudPayload.hotkeys = row.key || null;
            } else {
              const cmd = row.command || '';
              cloudPayload.shortcuts = cmd ? (cmd.startsWith('/') ? cmd : `/${cmd}`) : null;
            }
            await updateAutomationRealtime(userId, cloudPayload);

            // Also sync to local storage for background / Searchbar
            const compoundId = getItemCompoundId({
              ...row,
              workspace_id: row.workspace_id || '',
              folder_id: row.folder_id || '',
            });
            if (row.editAction === 'hotkey') {
              await updateLocalHotkey(compoundId, row.key || '', 'automation');
              set(s => {
                const nd = [...s.tableData];
                if (nd[index].type === 'data') {
                  (nd[index] as any).syncStatus = 'saved';
                  (nd[index] as any).syncMessage = 'Hotkey Updated';
                }
                return { tableData: nd };
              });
            } else {
              const cleanShortcut = row.command ? (row.command.startsWith('/') ? row.command : `/${row.command}`) : '';
              await updateLocalShortcut(compoundId, String(automationId), cleanShortcut, row.name || '', 'automation');
              set(s => {
                const nd = [...s.tableData];
                if (nd[index].type === 'data') {
                  (nd[index] as any).syncStatus = 'saved';
                  (nd[index] as any).syncMessage = 'Shortcut Updated';
                }
                return { tableData: nd };
              });
            }
          } catch (e) {
            console.error('[commitRowToBackend] Automation Hotkey/Shortcut Cloud Sync Failed:', e);
            throw e; // Let outer catch handle error state
          }
        } else {
          // ── Name / Steps Edit ──────────────────────────────────────────────
          const steps = row.automationData?.steps || row.automationData?.automation_steps || [];
          const apiSteps = steps.map((s: any, idx: number) => ({
            module_id: String(s.moduleId || s.module_id || ''),
            step_order: idx + 1,
            config: s.config || {},
          }));

          await updateAutomation({
            id: automationId,
            name: row.name,
            steps: apiSteps,
            workspace_id: row.workspace_id,
            folder_id: row.folder_id || null,
          });

          // Redux optimistic sync
          const resolvedTeam = allTeams?.find((t: any) =>
            (t.workspaces || []).some((w: any) => w.workspace_id === row.workspace_id),
          );
          const teamId = resolvedTeam?.team_id;
          if (teamId && row.workspace_id) {
            dispatch(
              optimisticUpdateAutomation({
                teamId,
                workspaceId: row.workspace_id,
                folderId: row.folder_id,
                automationId,
                updates: {
                  name: row.name,
                  automation_steps: apiSteps,
                },
              }),
            );
          }
        }

        responseSnippet = { id: automationId, syncStatus: 'saved' };
      } else {
        const resolvedTeam = allTeams?.find((t: any) =>
          (t.workspaces || []).some((w: any) => w.workspace_id === row.workspace_id),
        );
        const response = await updateSnippetRealtime(payload, resolvedTeam?.storageMode ?? 'cloud');
        responseSnippet = response?.snippet || response;
      }

      const finalId = responseSnippet?.snippet_id || responseSnippet?.id || row.id;
      const updatedTime = responseSnippet?.updated_at || new Date().toISOString();

      // Ensure local storage is updated for NEW items or generic saves
      // This solves the "not fetched/not in localstorage" issue for first-time saves
      if (finalId && (row.key || row.command)) {
        const tempItem = { ...row, id: finalId };
        const compoundId = getItemCompoundId(tempItem);

        // Resolve correct type for local registry parity
        const resolvedLocalType =
          row.category === 'automation'
            ? 'automation'
            : row.category === 'agent'
              ? 'automation'
              : isNote
                ? 'note'
                : 'link';

        if (row.key) {
          await updateLocalHotkey(compoundId, row.key, resolvedLocalType);
        }
        if (row.command) {
          await updateLocalShortcut(
            compoundId,
            String(finalId),
            row.command.startsWith('/') ? row.command : `/${row.command}`,
            row.name || '',
            resolvedLocalType,
            isNote ? undefined : 'link',
          );
        }
      }

      // 4. Handle Shortcut/Hotkey/Favorite synchronization
      let favouriteId: number | undefined;
      if (finalId) {
        const userId = await getUserId();
        const compoundId = `${row.folder_id || row.workspace_id}-${finalId}`;

        // Sync Favorite if it was set for a NEW link/note
        if (!row.isReal && row.fav && userId) {
          try {
            const finalId = responseSnippet?.snippet_id || responseSnippet?.id || row.snippet_id || row.id;

            // Precision: Use types that send snippet_id for automations, agents, notes, and links
            const apiType: any =
              row.category === 'automation' ? 'automation' : row.category === 'agent' ? 'agent' : 'snippet'; // Default to snippet for notes and links

            const favResponse = await addFavorite(userId, { id: String(finalId) }, apiType);
            if (favResponse?.favourite_id) {
              favouriteId = favResponse.favourite_id;

              // Update local storage (myFavouriteItems) for immediate parity with Rich Editor and SideBar
              // Always use userId as the key to align with AgentPanel patterns
              const result: any = await new Promise(res => chrome.storage.local.get('myFavouriteItems', res));
              const favItems = result.myFavouriteItems || {};
              const storageKey = userId;
              const currentList = favItems[storageKey] || [];

              const updatedList = currentList.filter((f: any) => String(f.id || f.snippet_id) !== String(finalId));
              updatedList.unshift({
                ...row,
                id: finalId,
                isReal: true,
                fav: true,
                favourite_id: favouriteId,
                updated_at: updatedTime,
              });

              await chrome.storage.local.set({ myFavouriteItems: { ...favItems, [storageKey]: updatedList } });
            }
          } catch (e) {
            console.error('[commitRowToBackend] Favorite Sync Failed:', e);
          }
        }
      }

      // 5. Update local state and Redux
      const isNewItem = !row.isReal;
      const successMessage = isNewItem ? 'New One Saved' : 'Updated';

      set(s => {
        const nd = [...s.tableData];
        if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
          (nd[index] as any).id = finalId;
          (nd[index] as any).isReal = true;
          (nd[index] as any).favourite_id = favouriteId || (nd[index] as any).favourite_id;
          (nd[index] as any).syncStatus = 'saved';
          (nd[index] as any).syncMessage = successMessage;
          (nd[index] as any).category = category;
          (nd[index] as any).updated_at = updatedTime;

          if (row.editAction === 'hotkey') (nd[index] as any).key = row.key;
          if (row.editAction === 'command') (nd[index] as any).command = row.command;
        }
        return { tableData: nd };
      });

      // Redux Optimistic Sync — skip for automation/agent rows (they use optimisticUpdateAutomation within their block)
      const isAutomationCategory =
        row.category === 'automation' ||
        row.category === 'agent' ||
        row.category === 'module' ||
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents';

      const resolvedTeam = allTeams?.find((t: any) =>
        (t.workspaces || []).some((w: any) => w.workspace_id === row.workspace_id),
      );
      const teamId = resolvedTeam?.team_id;
      const workspaceId = row.workspace_id;

      if (teamId && workspaceId && !isAutomationCategory) {
        if (row.isReal) {
          dispatch(
            optimisticUpdateSnippet({
              teamId,
              workspaceId,
              folderId: row.folder_id,
              snippet: {
                ...row,
                id: finalId,
                key: row.name,
                value: valueForRequest,
                category,
                updated_at: updatedTime,
              },
            }),
          );
        } else {
          dispatch(
            optimisticAddSnippet({
              teamId,
              workspaceId,
              folderId: row.folder_id,
              snippet: {
                ...row,
                id: finalId,
                key: row.name,
                value: valueForRequest,
                category,
                user_id: '',
                updated_at: updatedTime,
              },
            }),
          );
        }
      }

      state.setShowSuccess(true);
      setTimeout(() => {
        set(s => {
          const nd = [...s.tableData];
          if (nd[index].type === 'data') {
            (nd[index] as any).syncStatus = 'idle';
            (nd[index] as any).syncMessage = undefined;
            (nd[index] as any).editAction = undefined;
          }
          return { tableData: nd };
        });
      }, 3000);
    } catch (error) {
      console.error('[SheetUI] Commit failed:', error);
      dispatch(queueNotification({ message: 'Failed to sync link', type: 'error' }));
      set(s => {
        const nd = [...s.tableData];
        if (nd[index].type === 'data') {
          (nd[index] as any).syncStatus = 'idle';
          (nd[index] as any).syncMessage = 'Failed to Sync';
        }
        return { tableData: nd };
      });
    } finally {
      set({ isSaving: false });
    }
  },

  updateRowLocation: (rowId, wsId, wsName, fId, fName, pathNames, visibility, dispatch, allTeams) => {
    const state = useGridStore.getState();
    const index = state.tableData.findIndex(r => r.type === 'data' && r.id === rowId);
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index];
    if (row && row.type === 'data') {
      const wsIcon = '📁';
      const wsPath = `${wsIcon} ${wsName}`;

      let visType: any = 'lock';
      if (visibility.isPersonal) {
        visType = 'personal';
      } else {
        visType = visibility.type || 'lock';
      }

      const fPathSection = fName ? ` / 📂 ${pathNames.join(' / 📂 ')}` : '';
      const fullPath = `${wsPath}${fPathSection}`;

      const fPlainSection = fName ? ` / ${pathNames.join(' / ')}` : '';
      const plainPath = `${wsName}${fPlainSection}`;

      newData[index] = {
        ...row,
        workspace_id: wsId,
        folder_id: fId || null,
        folder: fName || wsName,
        path: fullPath,
        plainPath: plainPath,
        visibilityType: visType,
      };

      set({ tableData: newData, isPickerOpen: false, pickerRowIndex: null });

      // Save as last used destination for parity with Rich Editor / Link Modal
      const storageKey = row.section === 'Smart Links' ? 'lastLinkDestination' : 'lastNoteDestination';
      chrome.storage.local.set({
        [storageKey]: {
          workspace_id: wsId,
          folder_id: fId || null,
        },
      });

      // Trigger backend commit
      state.commitRowToBackend(rowId, dispatch, allTeams);
    }
  },

  syncRealNotes: (
    teams,
    userId,
    selectedTeamId,
    favsMap,
    hotkeysMap,
    shortcutsMap,
    automations,
    agents,
    installedModules,
    bookmarks,
  ) => {
    const state = useGridStore.getState();
    const favsHash = JSON.stringify(favsMap);
    const hotkeysHash = JSON.stringify(hotkeysMap);
    const shortcutsHash = JSON.stringify(shortcutsMap);
    const bookmarksHash = JSON.stringify(bookmarks?.map(b => b.id) || []);

    if (
      state.lastSyncArgs &&
      state.lastSyncArgs.teams === teams &&
      state.lastSyncArgs.userId === userId &&
      state.lastSyncArgs.selectedTeamId === selectedTeamId &&
      state.lastSyncArgs.automations === automations &&
      state.lastSyncArgs.agents === agents &&
      state.lastSyncArgs.installedModules === installedModules &&
      state.lastSyncArgs.favsHash === favsHash &&
      state.lastSyncArgs.hotkeysHash === hotkeysHash &&
      state.lastSyncArgs.shortcutsHash === shortcutsHash &&
      state.lastSyncArgs.bookmarksHash === bookmarksHash
    ) {
      return;
    }

    useGridStore.setState({
      lastSyncArgs: {
        teams,
        userId,
        selectedTeamId,
        automations,
        agents,
        installedModules,
        favsHash,
        hotkeysHash,
        shortcutsHash,
        bookmarksHash,
      },
    });

    set(state => {
      const deletingRowsMap = new Map<string, any>();
      state.tableData.forEach((r: any) => {
        if (r.isDeleting) {
          deletingRowsMap.set(String(r.id), r.deleteTimer);
        }
      });

      const realLinks: RowData[] = [];
      const realNotes: RowData[] = [];
      const realSnippets: RowData[] = [];
      const realPrompts: RowData[] = [];
      const realAutomations: RowData[] = [];
      const realChatAgents: RowData[] = [];
      const realInstalledModules: RowData[] = [];
      const realBookmarks: RowData[] = [];
      const browserCommands: RowData[] = [];

      const favMap: Record<string, string> = {};
      const locationLookup: Record<
        string,
        { name: string; path: string; plainPath: string; visibilityType: 'lock' | 'globe' | 'users' | 'personal' }
      > = {};

      // Align with Sidebar logic: check favorites for both the specific user and the selected team
      const processFavList = (list: any[]) => {
        if (Array.isArray(list)) {
          list.forEach((item: any) => {
            const fid = item.favourite_id || item.favorite_id || 'true'; // Fallback to "true" string if missing but present in list
            const sid = String(item.snippet_id || item.command_id || item.id || '');
            if (sid) favMap[sid] = String(fid);
          });
        }
      };

      if (favsMap) {
        Object.keys(favsMap).forEach(key => {
          processFavList(favsMap[key]);
        });
      }

      const stripHtml = (html: string) => {
        if (typeof html !== 'string') return html;
        return html.replace(/<[^>]*>?/gm, '');
      };

      const resolveIcon = (iconStr: string | null | undefined, defaultEmoji: string) => {
        if (!iconStr) return defaultEmoji;
        if (iconStr.startsWith('U+')) {
          try {
            return String.fromCodePoint(parseInt(iconStr.replace('U+', ''), 16));
          } catch (e) {
            return defaultEmoji;
          }
        }
        return defaultEmoji;
      };

      teams.forEach(team => {
        const isPersonal = team.is_personal_space === true;
        const isSelected = selectedTeamId && String(team.team_id) === String(selectedTeamId);

        // Only process the selected organization and the personal space
        if (!isPersonal && !isSelected) return;

        // Only process the selected organization and the personal space
        if (!isPersonal && !isSelected) return;

        team.workspaces?.forEach((ws: any) => {
          const wsIcon = resolveIcon(ws.icon, '📁');
          const wsPath = `${wsIcon} ${ws.workspace_name}`;

          let visibilityType: 'lock' | 'globe' | 'users' | 'personal' = 'lock';
          if (isPersonal) {
            visibilityType = 'personal';
          } else {
            const wsType = ws.type || (ws.is_shared ? 'shareonly' : ws.is_public ? 'public' : 'private');
            if (wsType === 'private') visibilityType = 'lock';
            else if (wsType === 'shareonly' || wsType === 'shared') visibilityType = 'users';
            else if (wsType === 'public') visibilityType = 'globe';
          }

          locationLookup[ws.workspace_id] = {
            name: ws.workspace_name,
            path: wsPath,
            plainPath: ws.workspace_name,
            visibilityType,
          };

          const collectFromList = (
            list: any[],
            parentFolderName?: string,
            parentPath?: string,
            parentPlainPath?: string,
          ) => {
            list?.forEach((snip: any) => {
              const category = (snip.category || 'note').toLowerCase();
              const categories = ['link', 'note', 'snippet', 'tabgroup', 'tab group', 'prompt'];
              if (categories.some(c => category.includes(c))) {
                const isLink =
                  category.includes('link') || category.includes('tabgroup') || category.includes('tab group');
                const isSnippet = category === 'snippet';
                const isPrompt = category === 'prompt';
                const itemType = isLink ? 'link' : isSnippet ? 'snippet' : isPrompt ? 'prompt' : 'note';

                const cleanValue = typeof snip.value === 'string' ? stripHtml(snip.value) : isLink ? '' : 'Note Data';
                const snipLongId = snip.snippet_id || snip.id;

                // Unify compoundId logic with rest of app
                const compoundId = getItemCompoundId({
                  ...snip,
                  workspace_id: ws.workspace_id,
                  folder_id: parentFolderName ? snip.folder_id : undefined,
                });

                const hotkey = hotkeysMap
                  ? hotkeysMap[compoundId] || getUserHotkey(snip.hotkeys, userId) || ''
                  : getUserHotkey(snip.hotkeys, userId) || '';
                const shortcut = shortcutsMap
                  ? shortcutsMap[compoundId] || getUserShortcut(snip.shortcuts, userId) || ''
                  : getUserShortcut(snip.shortcuts, userId) || '';
                const existingRow = state.tableData.find(r => r.type === 'data' && r.id === snipLongId) as RowData;

                const rowData: RowData = {
                  type: 'data',
                  id: snipLongId,
                  name: snip.key,
                  url: isLink ? snip.value || '' : cleanValue, // Description for all, URL for links
                  value: snip.value,

                  folder: parentFolderName || ws.workspace_name,
                  path: parentPath || wsPath,
                  plainPath: parentPlainPath || ws.workspace_name,
                  visibilityType,
                  fav: !!favMap[String(snipLongId)],
                  favourite_id: favMap[String(snipLongId)],
                  key: hotkey,
                  command: shortcut,
                  section: isLink ? 'Smart Links' : isSnippet ? 'Snippets' : isPrompt ? 'Prompts' : 'Notes',
                  isReal: true,
                  syncStatus: existingRow?.syncStatus || 'idle',
                  favAction: existingRow?.favAction,
                  editAction: existingRow?.editAction,
                  itemType: itemType as any,
                  category: itemType,
                  urls: isLink ? extractUrlsFromSnippet(snip) : [],
                  team_id: String(team.team_id),
                  isPersonal: isPersonal,
                  updated_at: snip.updated_at,
                };

                if (isLink) realLinks.push(rowData);
                else if (isSnippet) realSnippets.push(rowData);
                else if (isPrompt) realPrompts.push(rowData);
                else realNotes.push(rowData);
              }
            });
          };

          collectFromList(ws.workspace_snippets);
          ws.folders?.forEach((folder: any) => {
            const fIcon = resolveIcon(folder.icon, '📂');
            const fPath = `${wsPath} / ${fIcon} ${folder.folder_name}`;
            const fPlainPath = `${ws.workspace_name} / ${folder.folder_name}`;
            locationLookup[folder.folder_id] = {
              name: folder.folder_name,
              path: fPath,
              plainPath: fPlainPath,
              visibilityType,
            };
            collectFromList(folder.snippets, folder.folder_name, fPath, fPlainPath);
          });
        });
      });

      // Helper to determine if an automation is an AI agent
      const isAiAutomation = (auto: any) => {
        const steps = auto.automation_steps || auto.steps || [];
        return steps.some(
          (s: any) => String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
        );
      };

      // Process Automations
      if (Array.isArray(automations)) {
        automations.forEach((auto: any) => {
          const isPersonal = !auto.team_id;

          const isAgent = isAiAutomation(auto);
          const automationLongId = auto.automation_id || auto.id || '';
          const id = String(automationLongId);
          const compoundId = getItemCompoundId(auto);

          // Automation hotkey/shortcut: prefer local storage map (user-set values),
          // then fall back to the new scalar fields from the /automations API.
          const hotkey = (hotkeysMap ? hotkeysMap[compoundId] || hotkeysMap[id] : '') || (auto.hotkeys as string) || '';
          const shortcut =
            (shortcutsMap ? shortcutsMap[compoundId] || shortcutsMap[id] : '') ||
            ((auto.shortcuts as string) || '').replace(/^\//, '') ||
            '';
          const existingRow = state.tableData.find(r => r.type === 'data' && r.id === id) as RowData;

          // Resolve location name and path
          let resolvedFolder = auto.parent_name || 'General';
          let resolvedPath = auto.parent_name || 'General';
          let resolvedVisibility: 'lock' | 'globe' | 'users' | 'personal' = 'personal';

          if (auto.folder_id && locationLookup[auto.folder_id]) {
            resolvedFolder = locationLookup[auto.folder_id].name;
            resolvedPath = locationLookup[auto.folder_id].path;
            resolvedVisibility = locationLookup[auto.folder_id].visibilityType;
          } else if (auto.workspace_id && locationLookup[auto.workspace_id]) {
            resolvedFolder = locationLookup[auto.workspace_id].name;
            resolvedPath = locationLookup[auto.workspace_id].path;
            resolvedVisibility = locationLookup[auto.workspace_id].visibilityType;
          }

          const snippetId = auto.snippet_id || (auto.id && String(auto.id));

          // Fav: prefer favMap (legacy), fall back to is_favourite from the new API
          const isFav =
            !!favMap[compoundId] || !!favMap[id] || (snippetId ? !!favMap[snippetId] : false) || !!auto.is_favourite;

          const row: RowData = {
            type: 'data',
            id: id,
            name: auto.name || 'Untitled Automation',
            url: '',
            value: '',
            folder: resolvedFolder,
            path: resolvedPath,
            plainPath:
              auto.folder_id && locationLookup[auto.folder_id]
                ? locationLookup[auto.folder_id].plainPath
                : auto.workspace_id && locationLookup[auto.workspace_id]
                  ? locationLookup[auto.workspace_id].plainPath
                  : auto.parent_name || 'General',
            visibilityType: resolvedVisibility,
            fav: isFav,
            favourite_id: favMap[compoundId] || favMap[id] || (snippetId ? favMap[snippetId] : undefined),
            syncStatus: existingRow?.syncStatus || 'idle',
            favAction: existingRow?.favAction,
            editAction: existingRow?.editAction,
            key: hotkey,
            command: shortcut,
            snippet_id: auto.snippet_id || (auto.id && String(auto.id)),
            section: isAgent ? 'Chat Agents' : 'Saved Automations',
            isReal: true,
            itemType: isAgent ? 'agent' : 'agent',
            category: isAgent ? 'agent' : 'automation',
            urls: [],
            team_id: auto.team_id ? String(auto.team_id) : undefined,
            isPersonal: !auto.team_id,
            updated_at: auto.updated_at || auto.created_at,
            automationData: auto,
          };

          if (isAgent) realChatAgents.push(row);
          else realAutomations.push(row);
        });
      }

      // Process Explicit Agents (vetted AI agents)
      if (Array.isArray(agents)) {
        agents.forEach((agent: any) => {
          const isPersonal = !agent.team_id;

          if (realChatAgents.some(a => a.id === String(agent.id))) return; // Avoid duplicates

          const agentIdLong = agent.automation_id || agent.id || '';
          const id = String(agentIdLong);
          const compoundId = getItemCompoundId(agent);

          const hotkey = hotkeysMap ? hotkeysMap[compoundId] || hotkeysMap[id] || '' : '';
          const shortcut = shortcutsMap ? shortcutsMap[compoundId] || shortcutsMap[id] || '' : '';
          const existingRow = state.tableData.find(r => r.type === 'data' && r.id === id) as RowData;

          let resolvedFolder = agent.parent_name || 'General';
          let resolvedPath = agent.parent_name || 'General';
          let resolvedVisibility: 'lock' | 'globe' | 'users' | 'personal' = 'personal';

          if (agent.folder_id && locationLookup[agent.folder_id]) {
            resolvedFolder = locationLookup[agent.folder_id].name;
            resolvedPath = locationLookup[agent.folder_id].path;
            resolvedVisibility = locationLookup[agent.folder_id].visibilityType;
          } else if (agent.workspace_id && locationLookup[agent.workspace_id]) {
            resolvedFolder = locationLookup[agent.workspace_id].name;
            resolvedPath = locationLookup[agent.workspace_id].path;
            resolvedVisibility = locationLookup[agent.workspace_id].visibilityType;
          }

          const snippetId = agent.snippet_id || (agent.id && String(agent.id));
          const row: RowData = {
            type: 'data',
            id: id,
            name: agent.name || 'Untitled Agent',
            url: agent.description || agent.url || '',
            value: agent.description || '',
            folder: resolvedFolder,
            path: resolvedPath,
            plainPath:
              agent.folder_id && locationLookup[agent.folder_id]
                ? locationLookup[agent.folder_id].plainPath
                : agent.workspace_id && locationLookup[agent.workspace_id]
                  ? locationLookup[agent.workspace_id].plainPath
                  : agent.parent_name || 'General',
            visibilityType: resolvedVisibility,
            fav: !!favMap[compoundId] || !!favMap[id] || (snippetId ? !!favMap[snippetId] : false),
            favourite_id: favMap[compoundId] || favMap[id] || (snippetId ? favMap[snippetId] : undefined),
            syncStatus: existingRow?.syncStatus || 'idle',
            favAction: existingRow?.favAction,
            editAction: existingRow?.editAction,
            key: hotkey,
            command: shortcut,
            snippet_id: snippetId,
            section: 'Chat Agents',
            isReal: true,
            itemType: 'agent',
            category: 'agent',
            updated_at: agent.updated_at || agent.created_at,
            automationData: agent,
          };

          realChatAgents.push(row);
        });
      }
      // Process Installed Modules
      const normalizedModules: any[] = [];
      if (Array.isArray(installedModules)) {
        normalizedModules.push(...installedModules);
      } else if (installedModules && typeof installedModules === 'object') {
        Object.values(installedModules).forEach(val => {
          if (val && typeof val === 'object') normalizedModules.push(val);
        });
      }

      const seenModuleIds = new Set<string>();

      normalizedModules.forEach((mod: any) => {
        // --- 1. ID resolution ---
        const instId = mod.id || mod.installation_id || mod.installationId;
        const modId = mod.module_id || mod.moduleId;
        // In the /modules/installed response, the primary 'id' is the installation_id
        const id = instId ? String(instId) : modId ? String(modId) : `mod-${Math.random()}`;

        // De-duplicate: if we've seen this module ID or installation ID, skip it
        if (seenModuleIds.has(id)) return;
        seenModuleIds.add(id);

        // --- 2. Prefix / Command parsing (matching SavedAutomationsPanel logic) ---
        const toCommandToken = (value: string): string =>
          String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^\/+/, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        const extractLongDescription = (meta: any): string | null => {
          if (Array.isArray(meta)) {
            const longObj = meta.find((item: any) => typeof item.long === 'string');
            return longObj?.long || null;
          }
          if (typeof meta === 'string') return meta;
          return null;
        };

        const commandPrefixFromModule = (m: any): string => {
          const raw = m.command_id || m.command_key || m.module_key || m.name || String(m.module_id || 'command');
          const normalized = toCommandToken(raw) || `module_${String(m.module_id || '').toLowerCase()}`;
          return `${normalized}`;
        };

        // --- 3. Registry parity for user-set overrides ---
        const compoundId = getItemCompoundId({ ...mod, category: 'module' });
        const hotkey = (hotkeysMap ? hotkeysMap[compoundId] || hotkeysMap[id] : '') || (mod.hotkey as string) || '';

        // Prefix logic: prefer local storage registry, then installation object from API, then derived from module metadata
        let shortcut =
          (shortcutsMap ? shortcutsMap[compoundId] || shortcutsMap[id] : '') || (mod.prefix as string) || '';
        if (!shortcut) {
          shortcut = commandPrefixFromModule(mod);
        }

        const categoryName =
          mod.category_name ||
          mod.parent_name ||
          (typeof mod.category === 'string' && mod.category !== 'module' ? mod.category : mod.category?.name) ||
          'Other';

        const row: RowData = {
          type: 'data',
          id: id,
          name: mod.name || mod.module_name || 'Untitled Module',
          url: extractLongDescription(mod.description_meta) || mod.description || '',
          value: '',
          folder: 'Installed',
          path: 'Installed',
          plainPath: 'Installed',
          visibilityType: 'personal',
          fav: !!mod.is_favourite,
          key: hotkey,
          command: shortcut.replace(/^\/+/, ''),
          section: 'Installed Modules',
          isReal: true,
          itemType: 'agent',
          category: 'module',
          automationData: {
            ...mod,
            groupingCategory: categoryName,
          },
          urls: [],
          workspace_id: '',
          folder_id: '',
          installation_id: instId,
          module_id: modId,
          module_uuid: mod.module_uuid,
          module_internal_id: mod.module_internal_id || mod.id,
          module_key: mod.module_key,
          icon_host: mod.parent_icon_host || mod.icon_host || mod.iconHost || '',
          updated_at: mod.updated_at || mod.installed_at,
        };

        realInstalledModules.push(row);
      });

      // --- Group Installed Modules by Category ---
      const groupedModules: any[] = [];
      const categoriesMap = new Map<string, any[]>();

      realInstalledModules.forEach((mod: any) => {
        const catName = mod.automationData?.groupingCategory || 'Other';
        const key = catName.toLowerCase();
        if (!categoriesMap.has(key)) {
          categoriesMap.set(key, []);
        }
        categoriesMap.get(key)!.push(mod);
      });

      categoriesMap.forEach((modules, key) => {
        const firstMod = modules[0];
        const catName = firstMod.automationData?.groupingCategory || 'Other';
        const categoryId = `cat_${key}`;
        groupedModules.push({
          type: 'automationCategory',
          id: categoryId,
          name: catName,
          iconHost: firstMod.icon_host || '',
          moduleCount: modules.length,
          section: 'Installed Modules',
          category: 'module',
        });

        modules.forEach(m => {
          groupedModules.push({
            ...m,
            type: 'automationModule',
            parentId: categoryId,
          });
        });
      });

      // Process Bookmarks
      if (Array.isArray(bookmarks)) {
        bookmarks.forEach((bm: any) => {
          // Flatten bookmarks from tree if needed, but assuming here it's already flattened or passed as list
          if (bm.url) {
            const row: RowData = {
              type: 'data',
              id: `bm-${bm.id}`,
              name: bm.title || 'Untitled Bookmark',
              url: bm.url,
              value: bm.url,
              folder: 'Browser',
              path: 'Browser Bookmarks',
              plainPath: 'Browser Bookmarks',
              visibilityType: 'lock',
              fav: false,
              key: '',
              command: '',
              section: 'Bookmarks',
              isReal: true,
              itemType: 'link', // Treat as link for icon/rendering
              category: 'bookmark',
              urls: [bm.url],
              isPersonal: true,
              updated_at: bm.dateAdded ? new Date(bm.dateAdded).toISOString() : undefined,
            };
            realBookmarks.push(row);
          }
        });
      }

      // Process Browser Commands
      const browserCmdIds = [
        'history', 
        'extensions', 
        'bookmarks', 
        'downloads', 
        'passwords', 
        'flags', 
        'inspect', 
        'version', 
        'tasks', 
        'gpu', 
        'dino', 
        'about'
      ];
      
      const otherCommands: RowData[] = [];

      COMMANDS.forEach((cmd: any) => {
        // Filter for browser-related commands
        if (browserCmdIds.includes(cmd.id)) {
          browserCommands.push({
            type: 'data',
            id: `cmd-${cmd.id}`,
            name: cmd.label || cmd.id,
            url: cmd.urlTemplate || cmd.prefix || `/${cmd.id}`,
            value: cmd.keywords?.join(', ') || '',
            folder: 'System',
            path: 'Browser Commands',
            plainPath: 'Browser Commands',
            visibilityType: 'lock',
            fav: false,
            key: '',
            command: cmd.id,
            section: 'Browser Commands',
            isReal: true,
            itemType: 'prompt', 
            category: 'commands',
            urls: [cmd.urlTemplate].filter(Boolean),
            icon_host: cmd.iconHost,
            isPersonal: true,
          });
        } else {
          // Add to Commands (Cloud Commands)
          const cmdLongId = `cmd-${cmd.id}`;
          otherCommands.push({
            type: 'data',
            id: cmdLongId,
            name: cmd.label || cmd.id,
            url: cmd.urlTemplate || cmd.prefix || `/${cmd.id}`,
            value: cmd.keywords?.join(', ') || '',
            folder: 'System',
            path: 'Commands',
            plainPath: 'Commands',
            visibilityType: 'personal',
            fav: !!favMap[cmdLongId] || !!favMap[cmd.id],
            favourite_id: favMap[cmdLongId] || favMap[cmd.id],
            key: hotkeysMap ? hotkeysMap[cmdLongId] || hotkeysMap[cmd.id] || '' : '',
            command: shortcutsMap ? shortcutsMap[cmdLongId] || shortcutsMap[cmd.id] || cmd.id : cmd.id,
            section: 'Commands',
            isReal: true,
            itemType: 'prompt',
            category: 'general_commands',
            urls: [cmd.urlTemplate].filter(Boolean),
            icon_host: typeof cmd.iconHost === 'string' ? cmd.iconHost : '',
            isPersonal: true,
          });
        }
      });

      // Process Local Commands
      commandRegistry.getAll().forEach((cmd: any) => {
        const cmdLongId = `cmd-${cmd.id}`;
        otherCommands.push({
            type: 'data',
            id: cmdLongId,
            name: cmd.label || cmd.id,
            url: cmd.prefix || `/${cmd.id}`,
            value: cmd.keywords?.join(', ') || '',
            folder: 'System',
            path: 'Commands',
            plainPath: 'Commands',
            visibilityType: 'personal',
            fav: !!favMap[cmdLongId] || !!favMap[cmd.id],
            favourite_id: favMap[cmdLongId] || favMap[cmd.id],
            key: hotkeysMap ? hotkeysMap[cmdLongId] || hotkeysMap[cmd.id] || '' : '',
            command: shortcutsMap ? shortcutsMap[cmdLongId] || shortcutsMap[cmd.id] || cmd.id : cmd.id,
            section: 'Commands',
            isReal: true,
            itemType: 'prompt',
            category: 'general_commands',
            urls: [],
            icon_host: '', // Local commands do not have an icon_host string
            isPersonal: true,
        });
      });

      const finalInstalledModules = groupedModules.length
        ? groupedModules
        : state.tableData.filter(
            r =>
              (r.type === 'automationModule' || r.type === 'automationCategory') &&
              (r as any).section === 'Installed Modules',
          );

      const finalData: GridRow[] = [
        { type: 'section', title: 'Smart Links' },
        ...realLinks,
        { type: 'section', title: 'Notes' },
        ...realNotes,
        { type: 'section', title: 'Snippets' },
        ...realSnippets,
        { type: 'section', title: 'Prompts' },
        ...realPrompts,
        { type: 'section', title: 'Saved Automations' },
        ...realAutomations,
        { type: 'section', title: 'Chat Agents' },
        ...realChatAgents,
        { type: 'section', title: 'Installed Modules' },
        ...finalInstalledModules,
        { type: 'section', title: 'Commands' },
        ...otherCommands,
        { type: 'section', title: 'Bookmarks' },
        ...realBookmarks,
        { type: 'section', title: 'Browser Commands' },
        ...browserCommands,
      ];

      finalData.forEach((row: any) => {
        if (row.id && deletingRowsMap.has(String(row.id))) {
          row.isDeleting = true;
          row.deleteTimer = deletingRowsMap.get(String(row.id));
        }
      });

      return { tableData: finalData };
    });
  },
  isFilterMenuOpen: false,
  setFilterMenuOpen: (open: boolean) => set({ isFilterMenuOpen: open }),
}));
