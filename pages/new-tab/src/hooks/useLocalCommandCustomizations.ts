/**
 * Hook for managing local command customizations
 *
 * Provides:
 * - customizations: Map of command_id -> { prefix?, keywords?, hotkey? }
 * - loading: Whether initial load is in progress
 * - saveCustomization: Function to save a customization to cloud
 * - deleteCustomization: Function to reset a command to defaults
 * - refreshCustomizations: Function to force refresh from cloud
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchAndCacheCustomizations,
  getStoredCustomizations,
  hasEverFetchedCustomizations,
  deleteUserLocalCommand,
  upsertUserLocalCommand,
  UserLocalCommandCustomization,
  UpsertLocalCommandPayload,
} from '../../../Apis/features/localCommandsApiService';
import { checkIfUserRefreshNeeded, saveLocalUserCounter } from '@private-services/userRefreshCounterService';
import { getUserId } from '../../../Apis/core/identity';

const STORAGE_KEY = 'alts_local_command_customizations';

// Module-level flag — only the first hook instance does the counter check + potential fetch.
// All others read from storage and stay in sync via chrome.storage.onChanged.
let _customizationsInitDone = false;

export const useLocalCommandCustomizations = () => {
  const [customizations, setCustomizations] = useState<Record<string, Partial<UserLocalCommandCustomization>>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('local_user');

  // Load userId and listen to changes on accessToken
  useEffect(() => {
    const checkUser = async () => {
      const currentUserId = await getUserId();
      setUserId(currentUserId);
    };
    checkUser();

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.accessToken) {
        _customizationsInitDone = false;
        checkUser();
      }
    };
    chrome.storage.onChanged.addListener(handleStorage);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorage);
    };
  }, []);

  // Initialize on userId change
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        // Step 1: Load from cache immediately for instant display
        const cached = await getStoredCustomizations();
        if (!active) return;
        if (Object.keys(cached).length > 0) {
          setCustomizations(cached);
          setLoading(false);
        }

        // Step 2: Only first instance checks counter + potentially fetches
        if (!_customizationsInitDone) {
          _customizationsInitDone = true;

          const { needsRefresh, remoteCounter, userId: checkedUserId } = await checkIfUserRefreshNeeded();
          if (!active) return;

          if (needsRefresh) {
            try {
              const fresh = await fetchAndCacheCustomizations(checkedUserId);
              if (!active) return;
              setCustomizations(fresh);
              // Save remote counter locally so next load skips the fetch
              if (checkedUserId) await saveLocalUserCounter(checkedUserId, remoteCounter);
            } catch (err) {
              console.warn('[useLocalCommandCustomizations] Fetch failed, keeping cached data:', err);
            }
          } else {
            // Counter says no change — check if we've ever fetched for this specific user
            const everFetched = await hasEverFetchedCustomizations(checkedUserId);
            if (!everFetched) {
              // First-ever load, need to fetch at least once
              try {
                const fresh = await fetchAndCacheCustomizations(checkedUserId);
                if (!active) return;
                setCustomizations(fresh);
              } catch (err) {
                console.warn('[useLocalCommandCustomizations] Initial fetch failed:', err);
              }
            }
          }
        }
      } catch (error) {
        console.error('[useLocalCommandCustomizations] Init failed:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
    };
  }, [userId]);

  // Listen for storage changes (sync across tabs/components)
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.onChanged) return;

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        setCustomizations(changes[STORAGE_KEY].newValue || {});
      }
    };

    chromeAny.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chromeAny.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  /**
   * Save a customization to cloud and update local state
   */
  const saveCustomization = useCallback(async (payload: UpsertLocalCommandPayload) => {
    

    const result = await upsertUserLocalCommand(payload);

    // Refresh cache and state
    const fresh = await fetchAndCacheCustomizations();
    setCustomizations(fresh);

    return result;
  }, []);

  /**
   * Delete a customization (reset to defaults) and update local state
   */
  const deleteCustomization = useCallback(
    async (commandId: string) => {
      const custom = customizations[commandId];
      if (!custom?.id) {
        console.warn('[useLocalCommandCustomizations] No customization found for:', commandId);
        return;
      }

      

      await deleteUserLocalCommand(custom.id);

      // Refresh cache and state
      const fresh = await fetchAndCacheCustomizations();
      setCustomizations(fresh);
    },
    [customizations],
  );

  /**
   * Force refresh from cloud
   */
  const refreshCustomizations = useCallback(async () => {
    
    const fresh = await fetchAndCacheCustomizations();
    setCustomizations(fresh);
    return fresh;
  }, []);

  /**
   * Get effective value for a command (custom or default)
   */
  const getEffectiveValue = useCallback(
    <T>(commandId: string, field: 'prefix' | 'keywords' | 'hotkey', defaultValue: T): T => {
      const custom = customizations[commandId];
      if (!custom) return defaultValue;

      const customValue = custom[field];
      if (customValue === null || customValue === undefined) return defaultValue;

      return customValue as T;
    },
    [customizations],
  );

  return {
    customizations,
    loading,
    saveCustomization,
    deleteCustomization,
    refreshCustomizations,
    getEffectiveValue,
  };
};
