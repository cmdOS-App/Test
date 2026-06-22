export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Cached userId to avoid repeated chrome.storage.local reads across all components.
// Invalidated on storage change (logout/login).
let _cachedUserId: string | null = null;
let _userIdPromise: Promise<string> | null = null;

// Migrate local_user data to a real clerk userId
export const migrateLocalUserToCloud = async (newUserId: string) => {
  if (!newUserId || newUserId === 'local_user') return;

  // 1. Migrate localOrganizations
  try {
    const result = await chrome.storage.local.get('localOrganizations');
    const localOrgs = result.localOrganizations || [];
    if (localOrgs.length > 0) {
      let modified = false;
      const updateObjectUserId = (obj: any) => {
        if (obj && typeof obj === 'object') {
          if (obj.user_id === 'local_user') {
            obj.user_id = newUserId;
            modified = true;
          }
          if (typeof obj.shortcuts === 'string' && obj.shortcuts.includes('local_user:')) {
            obj.shortcuts = obj.shortcuts.replace(/local_user:/g, `${newUserId}:`);
            modified = true;
          }
          if (typeof obj.hotkeys === 'string' && obj.hotkeys.includes('local_user:')) {
            obj.hotkeys = obj.hotkeys.replace(/local_user:/g, `${newUserId}:`);
            modified = true;
          }
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object') {
              updateObjectUserId(obj[key]);
            }
          }
        }
      };
      updateObjectUserId(localOrgs);
      if (modified) {
        await chrome.storage.local.set({ localOrganizations: localOrgs });
      }
    }
  } catch (err) {
    console.error('[Migration] Error migrating localOrganizations:', err);
  }

  // 2. Migrate myFavouriteItems
  try {
    const result = await chrome.storage.local.get('myFavouriteItems');
    const favItems = result.myFavouriteItems || {};
    if (favItems['local_user']) {
      const localFavs = favItems['local_user'];
      const newUserIdFavs = favItems[newUserId] || [];
      // merge them, filter duplicates
      const mergedFavs = [...newUserIdFavs];
      for (const item of localFavs) {
        const itemId = item.id || item.snippet_id;
        const exists = mergedFavs.some((f: any) => (f.id || f.snippet_id) === itemId);
        if (!exists) {
          mergedFavs.push({
            ...item,
            user_id: newUserId
          });
        }
      }
      favItems[newUserId] = mergedFavs;
      delete favItems['local_user'];
      await chrome.storage.local.set({ myFavouriteItems: favItems });
    }
  } catch (err) {
    console.error('[Migration] Error migrating myFavouriteItems:', err);
  }

  // 3. Migrate local_automations
  try {
    const result = await chrome.storage.local.get('local_automations');
    let automations = result.local_automations || [];
    if (automations.length > 0) {
      let modified = false;
      automations = automations.map((a: any) => {
        if (a.user_id === 'local_user') {
          modified = true;
          return { ...a, user_id: newUserId };
        }
        return a;
      });
      if (modified) {
        await chrome.storage.local.set({ local_automations: automations });
      }
    }
  } catch (err) {
    console.error('[Migration] Error migrating local_automations:', err);
  }

  // 4. Migrate local_todos
  try {
    const result = await chrome.storage.local.get('local_todos');
    let todos = result.local_todos || [];
    if (todos.length > 0) {
      let modified = false;
      todos = todos.map((t: any) => {
        if (t.user_id === 'local_user') {
          modified = true;
          return { ...t, user_id: newUserId };
        }
        return t;
      });
      if (modified) {
        await chrome.storage.local.set({ local_todos: todos });
      }
    }
  } catch (err) {
    console.error('[Migration] Error migrating local_todos:', err);
  }

  // 5. Migrate myCachedAllData
  try {
    const result = await chrome.storage.local.get('myCachedAllData');
    const cachedData = result.myCachedAllData || [];
    if (cachedData.length > 0) {
      let modified = false;
      const updateObjectUserId = (obj: any) => {
        if (obj && typeof obj === 'object') {
          if (obj.user_id === 'local_user') {
            obj.user_id = newUserId;
            modified = true;
          }
          if (typeof obj.shortcuts === 'string' && obj.shortcuts.includes('local_user:')) {
            obj.shortcuts = obj.shortcuts.replace(/local_user:/g, `${newUserId}:`);
            modified = true;
          }
          if (typeof obj.hotkeys === 'string' && obj.hotkeys.includes('local_user:')) {
            obj.hotkeys = obj.hotkeys.replace(/local_user:/g, `${newUserId}:`);
            modified = true;
          }
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object') {
              updateObjectUserId(obj[key]);
            }
          }
        }
      };
      updateObjectUserId(cachedData);
      if (modified) {
        await chrome.storage.local.set({ myCachedAllData: cachedData });
      }
    }
  } catch (err) {
    console.error('[Migration] Error migrating myCachedAllData:', err);
  }

  // 6. Migrate local command customizations to cloud
  try {
    const { StorageManager } = await import('../storage/StorageManager');
    const result = await chrome.storage.local.get('alts_local_command_customizations');
    const localCustoms = result.alts_local_command_customizations || {};
    const commandIds = Object.keys(localCustoms);
    if (commandIds.length > 0) {
      const cloudProvider = StorageManager.getInstance().getCloudProvider();
      for (const cmdId of commandIds) {
        const custom = localCustoms[cmdId];
        await cloudProvider.upsertUserLocalCommand({
          user_id: newUserId,
          command_id: cmdId,
          prefix: custom.prefix || null,
          keywords: custom.keywords || null,
          hotkey: custom.hotkey || null,
        }).catch((err: any) => {
          console.error(`[Migration] Failed to migrate command customization for ${cmdId}:`, err);
        });
      }
      
      // Mark as fetched for the new user so they don't overwrite local storage on next initialization
      const fetchedKeyNew = `alts_local_command_customizations_fetched_${newUserId}`;
      await chrome.storage.local.set({ [fetchedKeyNew]: true });
      await chrome.storage.local.remove('alts_local_command_customizations_fetched_local_user');
    }
  } catch (err) {
    console.error('[Migration] Error migrating local command customizations:', err);
  }
};

// Listen for storage changes to invalidate cache on logout/login and trigger migration
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.accessToken) {
      _cachedUserId = null;
      _userIdPromise = null;

      const newVal = changes.accessToken.newValue;
      if (newVal && typeof newVal === 'string' && newVal.startsWith('user_') && newVal !== 'local_user') {
        migrateLocalUserToCloud(newVal);
      }
    }
  });
}

// Get the UserID
export const getUserId = async (): Promise<string> => {
  // Return cached value if available
  if (_cachedUserId) return _cachedUserId;

  // Deduplicate concurrent calls — share the same in-flight promise
  if (_userIdPromise) return _userIdPromise;

  _userIdPromise = (async () => {
    const result = await chrome.storage.local.get('accessToken');
    const userId = result.accessToken;

    if (!userId || typeof userId !== 'string' || !userId.startsWith('user_')) {
      _userIdPromise = null;
      return 'local_user';
    }

    _cachedUserId = userId;
    _userIdPromise = null;
    return userId;
  })();

  return _userIdPromise;
};

export const getUserName = async (): Promise<string> => {
  const result = await chrome.storage.local.get('user_name');
  const userName = result.user_name;

  if (!userName || typeof userName !== 'string') {
    return 'Local User';
  }

  return userName;
};
