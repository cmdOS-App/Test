import { getUserId } from '../core/identity';
import { axiosInstance } from '../core/axiosInstance';
import type { Tag } from '../../modals/interfaces';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { StorageManager } from '../storage/StorageManager';

export interface NewSnippet {
  folder_id?: string;
  workspace_id?: string;
  key: string;
  value: string;
  category: 'snippet' | 'link' | 'TabGroup' | 'quicklink' | 'prompt' | 'note';
  tags: Tag[];
  searchtags?: Record<string, string[]> | string | null;
  config?: Record<string, any> | string;
}

export const cleanupLocalTodosAfterDelete = async (deletedIds: string[]) => {
  try {
    if (typeof window !== 'undefined') {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        const result = await new Promise<any>(resolve =>
          chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve)
        );
        
        let hasChanges = false;
        const updates: any = {};

        const shouldRemove = (t: any) => {
          const idsToCheck = [
            t.id, 
            t.snippet_id, 
            t.automation_id, 
            t.module_id, 
            t.installed_module_id, 
            t.command_id
          ].filter(Boolean).map(String);
          
          return deletedIds.some(dId => {
            const dIdStr = String(dId);
            return idsToCheck.some(id => id === dIdStr || id.includes(dIdStr));
          });
        };

        if (result.local_todos) {
          const updatedLocal = result.local_todos.filter((t: any) => !shouldRemove(t));
          if (updatedLocal.length !== result.local_todos.length) {
            updates.local_todos = updatedLocal;
            hasChanges = true;
          }
        }

        if (result.cached_todos) {
          const updatedCached = result.cached_todos.filter((t: any) => !shouldRemove(t));
          if (updatedCached.length !== result.cached_todos.length) {
            updates.cached_todos = updatedCached;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await new Promise<void>(resolve => chromeAny.storage.local.set(updates, resolve));
          window.dispatchEvent(new CustomEvent('todosUpdated'));
        }

        if (chromeAny?.runtime?.sendMessage) {
          if (result.local_todos || result.cached_todos) {
            const allTodos = [...(result.local_todos || []), ...(result.cached_todos || [])];
            const removedTodos = allTodos.filter(shouldRemove);
            const seen = new Set();
            removedTodos.forEach(rt => {
               const tid = String(rt.id || rt.snippet_id);
               if (!seen.has(tid)) {
                 seen.add(tid);
                 chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: tid });
               }
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup local todos after deletion:', error);
  }
};

import { bgRequest, isContentScriptContext } from '../core/bgFetch';
import { SUPABASE_BASE_URL } from '../core/axiosInstance';

/**
 * Signals all open tabs/pages to immediately re-fetch data.
 * Works by writing a monotonically increasing timestamp to chrome.storage.local.
 * Every tab listens to chrome.storage.onChanged and will trigger a refresh.
 * This bypasses the 1-minute refresh cooldown entirely.
 */
const notifyDataChanged = (storageMode?: 'local' | 'cloud'): void => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({
        data_changed_at: Date.now(),
        data_changed_mode: storageMode || 'cloud',
        last_org_counter_check_timestamp: 0,
        last_org_counter_check_result: null,
      });
    }
  } catch (_) {
    // Non-critical — best-effort notification
  }
};

//Create a new Snippet
export const createSnippet = async (snippets: NewSnippet[], storageMode?: 'local' | 'cloud') => {
  const wsId = snippets[0]?.workspace_id;
  const fId = snippets[0]?.folder_id;
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
    folderId: fId,
    workspaceId: wsId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.createSnippet(snippets);
  notifyDataChanged(resolvedMode);
  incrementOrgRefreshCounter();
  return result;
};

//Tags of the Organization
export const getOrgTags = async (org_id: string, storageMode?: 'local' | 'cloud'): Promise<Tag[]> => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    orgId: org_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const data = await provider.getOrgTags(userId, org_id);
  return data;
};

//Creating a new Tah
export const createTagInOrg = async (org_id: string, name: string, storageMode?: 'local' | 'cloud'): Promise<Tag> => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    orgId: org_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const data = await provider.createTagInOrg(userId, org_id, name);
  incrementOrgRefreshCounter();
  return data;
};

/**
 * Updates a snippet in real-time or creates a new one if snippet_id is not provided
 */
export const updateSnippetRealtime = async (data: {
  snippet_id?: string;
  folder_id?: string | null;
  workspace_id?: string | null;
  key?: string;
  value?: string;
  category?: 'snippet' | 'link' | 'TabGroup' | 'quicklink' | 'prompt' | 'note';
  tags?: Tag[];
  event_deadline?: string; // Added for todo updates
  is_done?: boolean; // Added for todo updates
  is_recurring?: boolean; // Added for recurring todo updates
  recurring_cycle?: string | null; // Added for recurring todo updates
  open_automatically?: boolean; // Added for automatic execution
  hotkey?: string; // Optional hotkey (user: hotkey key-pair format)
  searchtags?: Record<string, string[]> | string | null; // Added for search tags
  config?: Record<string, any> | string; // JSON AST configuration
}, storageMode?: 'local' | 'cloud') => {
  const { snippet_id, folder_id, workspace_id } = data;

  if (!snippet_id && !folder_id && !workspace_id) {
    throw new Error('One of snippet_id, folder_id, or workspace_id must be provided.');
  }

  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: !snippet_id,
    snippetId: snippet_id,
    folderId: folder_id,
    workspaceId: workspace_id,
  });
  
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateSnippetRealtime(data);
  
  notifyDataChanged(resolvedMode);
  incrementOrgRefreshCounter();
  return result;
};

export const cleanupFavoritesAfterDelete = async (userId: string, deletedIds: string[]) => {
  try {
    // 1. Clean up from chrome.storage.local
    if (typeof window !== 'undefined') {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        const result = await new Promise<any>(resolve =>
          chromeAny.storage.local.get('myFavouriteItems', resolve)
        );
        const favItems = result?.myFavouriteItems || {};
        if (favItems[userId]) {
          const currentList = favItems[userId];
          const updatedList = currentList.filter((fav: any) => {
            const favId = fav.id || fav.snippet_id;
            return !deletedIds.includes(String(favId));
          });
          if (updatedList.length !== currentList.length) {
            favItems[userId] = updatedList;
            await new Promise<void>(resolve =>
              chromeAny.storage.local.set({ myFavouriteItems: favItems }, resolve)
            );
          }
        }
      }
    }

    // 2. Clean up from the cloud database
    const { getFavorites, deleteFavorite } = await import('../services/favoritesApi');
    const cloudFavs = await getFavorites(userId);
    for (const dId of deletedIds) {
      const match = cloudFavs.find((cf: any) => String(cf.snippet_id) === String(dId));
      if (match && match.favourite_id) {
        await deleteFavorite(userId, match.favourite_id);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup favorites after deletion:', error);
  }
};

export const deleteSnippet = async (folder_id: string | undefined, snippet_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
    folderId: folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.deleteSnippet(folder_id, snippet_id);
  notifyDataChanged(resolvedMode);
  incrementOrgRefreshCounter();
  
  // Cleanup local ghost todos
  cleanupLocalTodosAfterDelete([snippet_id]);
  
  // Cleanup favorites
  cleanupFavoritesAfterDelete(userId, [snippet_id]);
  
  return result;
};
export const deletemultiple = async (
  snippetIds: string[],
  storageMode?: 'local' | 'cloud',
): Promise<{
  message: string;
  deleted_count: number;
  failed_count: number;
  failed_ids?: string[];
}> => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippetIds[0],
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.deleteMultiple(snippetIds);
  notifyDataChanged(resolvedMode);
  incrementOrgRefreshCounter();
  
  // Cleanup local ghost todos
  cleanupLocalTodosAfterDelete(snippetIds);
  
  // Cleanup favorites
  cleanupFavoritesAfterDelete(userId, snippetIds);
  
  return result;
};

export const createShareLinkForSnippet = async (snippet_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.createShareLinkForSnippet(userId, snippet_id);
};

export const createSequreShareLinkForSnippet = async (snippet_id: string, pass_key: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.createSequreShareLinkForSnippet(userId, snippet_id, pass_key);
};

export const fetchPublicLinksForSnippet = async (snippet_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.fetchPublicLinksForSnippet(userId, snippet_id);
};

export const revokePublicLink = async (link_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.revokePublicLink(userId, link_id);
};

export const saveSnippetsOrder = async (snippetList: { id: string }[], storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();

  const payload = {
    snippet_orders: snippetList.map((snippet, index) => ({
      snippet_id: snippet.id,
      order: index + 1,
    })),
  };

  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      snippetId: snippetList[0]?.id,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.saveSnippetsOrder(userId, payload);
    incrementOrgRefreshCounter();
    return response;
  } catch (error) {
    console.error('Error reordering snippets:', error);
    throw error;
  }
};

export const convertSnippetToTodo = async (
  target: {
    snippet_id?: string;
    automation_id?: string | number;
    recording_id?: string;
    dataview_id?: string;
    installed_module_id?: string | number;
    command_id?: string;
  },
  event_deadline: string,
  is_recurring?: boolean,
  recurring_cycle?: string,
  key?: string,
  is_done?: boolean,
  storageMode?: 'local' | 'cloud'
) => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: target.snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.convertSnippetToTodo({
    ...target,
    event_deadline: event_deadline,
    is_done: is_done,
    is_recurring: is_recurring,
    recurring_cycle: recurring_cycle,
    key: key,
  });
};

/**
 * Config-based todo creation.
 *
 * The backend still requires exactly one of: snippet_id | automation_id |
 * recording_id | dataview_id | installed_module_id | command_id.
 * The `config` field is returned in the *response* only.
 *
 * This function accepts an array of items (each carrying the raw ID and its
 * type) and calls `/convert_to_todo` once per item, sending the correct ID
 * field for that item type. Callers should pass `selectedItems` directly.
 *
 * For single-item selection the function behaves identically to
 * `convertSnippetToTodo` but derives the target field from the item metadata.
 */
export const convertToTodoWithConfig = async (
  selectedItems: Array<{
    id: string;
    category: string;  // 'note' | 'snippet' | 'automation' | 'agent' | 'module' | 'install' | 'command' | 'link' | ...
    data?: Record<string, any>;
  }>,
  event_deadline: string,
  is_recurring?: boolean,
  recurring_cycle?: string,
  key?: string,
  is_done?: boolean,
  storageMode?: 'local' | 'cloud'
): Promise<any> => {
  // Helper: clean prefix (e.g., auto-201 -> 201)
  const cleanId = (id: string): string => {
    const idStr = String(id);
    if (
      idStr.includes('-') &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr)
    ) {
      return idStr.split('-').slice(1).join('-');
    }
    return idStr;
  };

  // Helper: resolve the correct target field for a single item.
  // Returns both the field object (for the DB constraint) and the resolved ID
  // (used to build config: { id: [...] }).
  const resolveTarget = (item: { id: string; category: string; data?: Record<string, any> }): { target: Record<string, any>; resolvedId: string } => {
    const cat = (item.category || '').toLowerCase();
    const rawId = item.id;
    const cleaned = cleanId(rawId);

    if (['automation', 'agent', 'chat_agent'].includes(cat)) {
      const isNumeric = /^\d+$/.test(cleaned);
      const parsedId = isNumeric ? parseInt(cleaned, 10) : cleaned;
      return { 
        target: { automation_id: parsedId }, 
        resolvedId: String(rawId) 
      };
    }
    if (['module', 'install'].includes(cat)) {
      const isNumeric = /^\d+$/.test(cleaned);
      const parsedId = isNumeric ? parseInt(cleaned, 10) : cleaned;
      return { 
        target: { installed_module_id: parsedId }, 
        resolvedId: String(rawId) 
      };
    }
    if (cat === 'command') {
      return { target: { command_id: cleaned }, resolvedId: String(rawId) };
    }
    // Default: snippet_id (covers 'note', 'link', 'snippet', etc.)
    const snippetId = cleanId(item.data?.snippet_id || item.data?.id || rawId);
    return { target: { snippet_id: snippetId }, resolvedId: String(rawId) };
  };

  if (!selectedItems || selectedItems.length === 0) {
    throw new Error('No items selected');
  }

  // Resolve target using the first selected item to satisfy the DB constraint
  const { target } = resolveTarget(selectedItems[0]);

  // Collect the clean IDs of all selected items (without auto, cmd, mod prefixes, and parsed to numbers where numeric)
  const isNumeric = /^\d+$/.test(selectedItems[0].id);
  const allIds = selectedItems.map(item => {
    const cleaned = item.id.replace(/^(todo_|snippet_)/, '');
    return isNumeric ? parseInt(cleaned, 10) : cleaned;
  });

  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: target.snippet_id || (target as any).id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.convertToTodoWithConfig({
    ...target,
    config: { id: allIds, title: key },   // stored in snippet's config JSON column containing all item IDs without prefixes
    event_deadline: event_deadline,
    is_done: is_done,
    is_recurring: is_recurring,
    recurring_cycle: recurring_cycle,
    key: key,
  });
};

export const editTodo = async (
  todo_id: string | number,
  deadline?: string,
  recurring_cycle?: string,
  key?: string,
  value?: string,
  is_recurring?: boolean,
  is_done?: boolean,
  is_anytime?: boolean,
  storageMode?: 'local' | 'cloud'
) => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: String(todo_id),
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.editTodo({
    todo_id: todo_id,
    deadline: deadline,
    recurring_cycle: recurring_cycle,
    key: key,
    value: value,
    is_recurring: is_recurring,
    is_done: is_done,
    is_anytime: is_anytime,
  });
};

// Keeping modifyTodo as an alias for backward compatibility or during migration
export const modifyTodo = async (
  snippet_id: string,
  key: string,
  event_deadline: string,
  is_recurring?: boolean,
  recurring_cycle?: string,
  deadline?: string,
  is_anytime?: boolean,
  storageMode?: 'local' | 'cloud'
) => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.modifyTodo({
    snippet_id: snippet_id,
    key: key,
    event_deadline: event_deadline,
    deadline: deadline,
    is_anytime: is_anytime,
    is_recurring: is_recurring,
    recurring_cycle: recurring_cycle,
  });
};

export const updateTodoStatus = async (snippet_id: string, is_done: boolean, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.updateTodoStatus(snippet_id, is_done);
};

export const getUpcomingTodos = async (storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.getUpcomingTodos();
};

export const getOverdueTodos = async (storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.getOverdueTodos();
};

export const getTodosByDate = async (date: string, includeCompleted: boolean = false, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.getTodosByDate(date, includeCompleted);
};

export const getRecurringTodos = async (date?: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.getRecurringTodos(date);
};

export const deleteTodo = async (todoId: string | number, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: String(todoId),
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.deleteTodo(todoId);
  incrementOrgRefreshCounter();
  return result;
};

// GET: List all members and roles for a folder
export const getFolderMembers = async (folder_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.getFolderMembers(userId, folder_id);
};

// POST: Add or update a member’s role in the folder
export const addOrUpdateFolderMember = async (
  folder_id: string,
  target_user_id: string,
  role: 'viewer' | 'editor' | 'admin',
  storageMode?: 'local' | 'cloud'
) => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.addOrUpdateFolderMember(userId, folder_id, target_user_id, role);
  incrementOrgRefreshCounter();
  return response;
};

// PATCH: Change an existing folder member’s role
export const changeFolderAccess = async (
  folder_id: string,
  target_user_id: string,
  new_role: 'viewer' | 'editor' | 'admin',
  storageMode?: 'local' | 'cloud'
) => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.changeFolderAccess(userId, folder_id, target_user_id, new_role);
  incrementOrgRefreshCounter();
  return response;
};

// DELETE: Remove a member from the folder
export const removeFolderMember = async (folder_id: string, target_user_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.removeFolderMember(userId, folder_id, target_user_id);
  incrementOrgRefreshCounter();
  return response;
};

export const updateSnippetCustomization = async (snippet_id: string, icon?: string | null, color?: string | null, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippet_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const data = await provider.updateSnippetCustomization(userId, snippet_id, { icon: icon ?? null, color: color ?? null });
  incrementOrgRefreshCounter();
  return data;
};

// ============================================================================
// CLOUD SHORTCUTS & HOTKEYS APIs
// ============================================================================

export interface ShortcutResponse {
  success: boolean;
  snippet_id: string;
  shortcuts: string;
  message?: string;
}

export interface HotkeyResponse {
  success: boolean;
  snippet_id: string;
  hotkeys: string;
  message?: string;
}

/**
 * Update shortcut for a snippet (current user)
 * POST /snippets/shortcuts?user_id=user_xxx
 */
export const updateSnippetShortcut = async (snippetId: string, shortcut: string, storageMode?: 'local' | 'cloud'): Promise<ShortcutResponse> => {
  const userId = await getUserId().catch(() => 'local_user');
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippetId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateSnippetShortcut(userId, snippetId, shortcut);
  incrementOrgRefreshCounter();
  return result;
};

/**
 * Clear shortcut for a snippet (current user)
 * DELETE /snippets/shortcuts?user_id=user_xxx&snippet_id=snippet_xxx
 */
export const clearSnippetShortcut = async (snippetId: string, storageMode?: 'local' | 'cloud'): Promise<ShortcutResponse> => {
  const userId = await getUserId().catch(() => 'local_user');
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippetId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.clearSnippetShortcut(userId, snippetId);
  incrementOrgRefreshCounter();
  return result;
};

/**
 * Update hotkey for a snippet (current user)
 * POST /snippets/hotkeys?user_id=user_xxx
 */
export const updateSnippetHotkey = async (snippetId: string, hotkey: string, storageMode?: 'local' | 'cloud'): Promise<HotkeyResponse> => {
  const userId = await getUserId().catch(() => 'local_user');
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippetId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateSnippetHotkey(userId, snippetId, hotkey);
  incrementOrgRefreshCounter();
  return result;
};

/**
 * Clear hotkey for a snippet (current user)
 * DELETE /snippets/hotkeys?user_id=user_xxx&snippet_id=snippet_xxx
 */
export const clearSnippetHotkey = async (snippetId: string, storageMode?: 'local' | 'cloud'): Promise<HotkeyResponse> => {
  const userId = await getUserId().catch(() => 'local_user');
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    snippetId: snippetId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.clearSnippetHotkey(userId, snippetId);
  incrementOrgRefreshCounter();
  return result;
};
