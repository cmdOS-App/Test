/**
 * Local Commands API Service
 *
 * Handles fetching and updating user customizations for local commands.
 * Defaults are defined in frontend code (registry), this service only manages user overrides.
 */

import { axiosInstance } from '../core/axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from '../core/bgFetch';
import { getUserId } from '../core/api';
import { incrementUserRefreshCounter } from '@private-services/userRefreshCounterService';
import { StorageManager } from '../storage/StorageManager';

// ==================== Types ====================

/**
 * User customization for a local command from the API
 */
export interface UserLocalCommandCustomization {
  id: number;
  user_id: string;
  command_id: string; // Matches ID from registry (e.g., 'createnotes')
  prefix: string | null; // NULL = use default from code
  keywords: string[] | null; // NULL = use default from code
  hotkey: string | null; // e.g., 'alt+n'
  created_at: string;
  updated_at: string;
}

/**
 * API response for fetching user customizations
 */
export interface UserLocalCommandsApiResponse {
  data: UserLocalCommandCustomization[];
}

/**
 * Payload for creating/updating a user customization
 */
export interface UpsertLocalCommandPayload {
  user_id?: string; // Will be auto-filled if not provided
  command_id: string;
  prefix?: string | null;
  keywords?: string[] | null;
  hotkey?: string | null;
}

// ==================== Local Storage ====================

const STORAGE_KEY = 'alts_local_command_customizations';
const FETCHED_KEY = 'alts_local_command_customizations_fetched';

/**
 * Get cached customizations from local storage
 * Returns a map: { [command_id]: { id, prefix?, keywords?, hotkey? } }
 */
export const getStoredCustomizations = async (): Promise<Record<string, Partial<UserLocalCommandCustomization>>> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return {};

    return new Promise(resolve => {
      chromeAny.storage.local.get(STORAGE_KEY, (result: any) => {
        resolve(result[STORAGE_KEY] || {});
      });
    });
  } catch {
    return {};
  }
};

/**
 * Save customizations to local storage
 */
export const storeCustomizations = async (
  customizations: Record<string, Partial<UserLocalCommandCustomization>>,
  userId?: string,
): Promise<void> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return;
    const user_id = userId || (await getUserId());
    const fetchedKeyForUser = `${FETCHED_KEY}_${user_id}`;

    await new Promise<void>(resolve => {
      chromeAny.storage.local.set({ [STORAGE_KEY]: customizations, [fetchedKeyForUser]: true }, () => resolve());
    });
  } catch (error) {
    console.error('[localCommandsApiService] Error caching customizations:', error);
  }
};

/**
 * Check if customizations have ever been fetched from the API.
 * Returns false if we've never fetched (first-ever load), true otherwise.
 * This distinguishes "never fetched" from "fetched but user has zero customizations".
 */
export const hasEverFetchedCustomizations = async (userId?: string): Promise<boolean> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) return false;
    const user_id = userId || (await getUserId());
    const fetchedKeyForUser = `${FETCHED_KEY}_${user_id}`;

    return new Promise(resolve => {
      chromeAny.storage.local.get(fetchedKeyForUser, (result: any) => {
        resolve(!!result[fetchedKeyForUser]);
      });
    });
  } catch {
    return false;
  }
};

// ==================== API Methods ====================

/**
 * Fetch user's customizations from cloud API
 */
export const fetchUserLocalCommandCustomizations = async (
  userId?: string,
): Promise<UserLocalCommandCustomization[]> => {
  const user_id = userId || (await getUserId());
  const result = await StorageManager.getInstance().getLocalProvider().fetchUserLocalCommandCustomizations(user_id);
  return result;
};

/**
 * Create or update a user's command customization (upsert)
 */
export const upsertUserLocalCommand = async (
  payload: UpsertLocalCommandPayload,
): Promise<UserLocalCommandCustomization> => {
  // Ensure user_id is set
  const user_id = payload.user_id || (await getUserId());
  const fullPayload = { ...payload, user_id };
  const result = await StorageManager.getInstance().getLocalProvider().upsertUserLocalCommand(fullPayload);

  // Increment user counter (fire-and-forget)
  incrementUserRefreshCounter().catch(() => {});

  return result;
};

/**
 * Delete a customization (reset command to defaults)
 */
export const deleteUserLocalCommand = async (id: number): Promise<void> => {
  await StorageManager.getInstance().getLocalProvider().deleteUserLocalCommand(id);

  // Increment user counter (fire-and-forget)
  incrementUserRefreshCounter().catch(() => {});
};

// ==================== Transform & Cache ====================

/**
 * Transform API response to storage format (keyed by command_id)
 */
export const transformToStorageFormat = (
  customizations: UserLocalCommandCustomization[],
): Record<string, Partial<UserLocalCommandCustomization>> => {
  const result: Record<string, Partial<UserLocalCommandCustomization>> = {};

  if (!customizations) return result;

  let list = customizations;
  if (customizations && typeof customizations === 'object' && !Array.isArray(customizations)) {
    if (Array.isArray((customizations as any).data)) {
      list = (customizations as any).data;
    } else if (Array.isArray((customizations as any).customizations)) {
      list = (customizations as any).customizations;
    } else {
      console.warn('[transformToStorageFormat] customizations is not an array:', customizations);
      return result;
    }
  }

  if (!Array.isArray(list)) {
    return result;
  }

  for (const custom of list) {
    if (custom && custom.command_id) {
      result[custom.command_id] = {
        id: custom.id,
        prefix: custom.prefix,
        keywords: custom.keywords,
        hotkey: custom.hotkey,
      };
    }
  }

  return result;
};

/**
 * Fetch customizations from API and cache them locally.
 * Deduplicates concurrent calls — multiple hook instances share one in-flight request.
 */
let _fetchAndCachePromise: Promise<Record<string, Partial<UserLocalCommandCustomization>>> | null = null;

export const fetchAndCacheCustomizations = async (userId?: string): Promise<
  Record<string, Partial<UserLocalCommandCustomization>>
> => {
  // If there's already an in-flight request, reuse it
  if (_fetchAndCachePromise) {
    return _fetchAndCachePromise;
  }

  _fetchAndCachePromise = (async () => {
    try {
      const uId = userId || (await getUserId());
      const customizations = await fetchUserLocalCommandCustomizations(uId);
      const storageFormat = transformToStorageFormat(customizations);
      await storeCustomizations(storageFormat, uId);
      return storageFormat;
    } catch (error) {
      console.error('[localCommandsApiService] Error fetching customizations:', error);
      throw error;
    } finally {
      _fetchAndCachePromise = null;
    }
  })();

  return _fetchAndCachePromise;
};

/**
 * Initialize customizations - check cache first, then fetch in background.
 * Includes a cooldown to prevent redundant background refreshes from multiple hook instances.
 */
let _lastInitTimestamp = 0;
const INIT_COOLDOWN_MS = 30000; // 30 seconds

export const initializeLocalCommandCustomizations = async (): Promise<
  Record<string, Partial<UserLocalCommandCustomization>>
> => {
  // Check cache first
  const cached = await getStoredCustomizations();

  if (Object.keys(cached).length > 0) {
    // Only refresh in background if cooldown has passed
    const now = Date.now();
    if (now - _lastInitTimestamp > INIT_COOLDOWN_MS) {
      _lastInitTimestamp = now;
      fetchAndCacheCustomizations().catch(err => {
        console.warn('[localCommandsApiService] Background refresh failed:', err);
      });
    } else {
    }
    return cached;
  }

  // No cache, fetch from API
  _lastInitTimestamp = Date.now();
  return await fetchAndCacheCustomizations();
};

/**
 * Update a single customization and refresh cache
 */
export const updateCustomizationAndRefresh = async (
  payload: UpsertLocalCommandPayload,
): Promise<Record<string, Partial<UserLocalCommandCustomization>>> => {
  await upsertUserLocalCommand(payload);
  return await fetchAndCacheCustomizations();
};

/**
 * Delete a customization and refresh cache
 */
export const deleteCustomizationAndRefresh = async (
  id: number,
): Promise<Record<string, Partial<UserLocalCommandCustomization>>> => {
  await deleteUserLocalCommand(id);
  return await fetchAndCacheCustomizations();
};
