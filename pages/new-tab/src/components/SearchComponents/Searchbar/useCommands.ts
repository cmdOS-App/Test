import { useState, useEffect, useRef } from 'react';
import type { CommandDefinition } from './commands';
import {
  getStoredCommands,
  fetchAndStoreUserCommands,
  ALL_DEFAULT_COMMANDS,
  DEFAULT_COMMANDS,
  storeCommands,
  refreshCommands,
} from '../../../../../Apis/features/userCommandsApiService';
import { checkIfUserRefreshNeeded, saveLocalUserCounter } from '@private-services/userRefreshCounterService';
import { getUserId } from '../../../../../Apis/core/api';

const STORAGE_KEY = 'alts_commands';

// Module-level flag — only the FIRST hook instance runs the counter check + potential fetch.
// All other instances just load from storage and rely on the storage change listener to sync.
let _commandsInitDone = false;

/**
 * Hook to get user commands.
 * - Loads from local storage instantly on mount.
 * - Only fetches from API when user refresh counter indicates a change.
 * - Multiple simultaneous instances share a single network request.
 * - All instances stay in sync via chrome.storage.onChanged.
 */
export const useCommands = () => {
  const [commands, setCommands] = useState<CommandDefinition[]>(ALL_DEFAULT_COMMANDS);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('local_user');

  // Ensure default commands (AI, GPT, Gemini, Perplexity, Google, YouTube) are always present
  const ensureDefaultCommands = (list: CommandDefinition[]): CommandDefinition[] => {
    const existingIds = new Set(list.map(c => c.id));
    const missingDefaults = DEFAULT_COMMANDS.filter(dc => !existingIds.has(dc.id));
    if (missingDefaults.length === 0) return list;
    
    return [...list, ...missingDefaults];
  };

  const normalizeCommandIds = (list: CommandDefinition[]): CommandDefinition[] =>
    list.map(cmd => ({
      ...cmd,
      id: String(cmd.id) as CommandDefinition['id'],
    }));

  // Track userId changes and listen to accessToken changes
  useEffect(() => {
    const checkUser = async () => {
      const currentUserId = await getUserId();
      setUserId(currentUserId);
    };
    checkUser();

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.accessToken) {
        // Reset module level flag when user changes (login/logout)
        _commandsInitDone = false;
        checkUser();
      }
    };

    chrome.storage.onChanged.addListener(handleStorage);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorage);
    };
  }, []);

  // Run the initialization whenever userId changes
  useEffect(() => {
    let active = true;
    const initCommands = async () => {
      try {
        // Step 1: Load from storage immediately for instant display
        const stored = await getStoredCommands();
        if (!active) return;

        if (stored && stored.length > 0) {
          // Run any pending migrations
          let needsUpdate = false;
          const migrated = normalizeCommandIds(stored).map(cmd => {
            if (cmd.id === 'perplexity' && !cmd.autoSubmit) {
              needsUpdate = true;
              return { ...cmd, autoSubmit: 'perplexity' as const };
            }
            if (cmd.id === 'claude' && !cmd.autoSubmit) {
              needsUpdate = true;
              return { ...cmd, autoSubmit: 'claude' as const };
            }
            if (cmd.id === 'gpt' && !cmd.autoSubmit) {
              needsUpdate = true;
              return { ...cmd, autoSubmit: 'chatgpt' as const };
            }
            if (cmd.id === 'gemini' && !cmd.autoSubmit) {
              needsUpdate = true;
              return { ...cmd, autoSubmit: 'gemini' as const };
            }
            return cmd;
          });
          const withDefaults = ensureDefaultCommands(migrated);
          if (withDefaults.length > stored.length || needsUpdate) await storeCommands(withDefaults);
          setCommands(withDefaults);
          setLoading(false);
        }

        // Step 2: Only the first hook instance checks the counter + potentially fetches
        if (!_commandsInitDone) {
          _commandsInitDone = true;

          const { needsRefresh, remoteCounter, userId: checkedUserId } = await checkIfUserRefreshNeeded();
          if (!active) return;

          if (needsRefresh) {
            try {
              const fresh = await fetchAndStoreUserCommands();
              if (!active) return;
              const withDefaults = ensureDefaultCommands(normalizeCommandIds(fresh));
              if (withDefaults.length > fresh.length) await storeCommands(withDefaults);
              setCommands(withDefaults);

              // Save remote counter locally so next load skips the fetch
              if (checkedUserId) await saveLocalUserCounter(checkedUserId, remoteCounter);
            } catch (apiError) {
              console.warn('[useCommands] API fetch failed, keeping cached data');
            }
          } else if (!stored || stored.length === 0) {
            // Counter says no change, but no cache — first-ever load, fetch anyway
            try {
              const fresh = await fetchAndStoreUserCommands();
              if (!active) return;
              const withDefaults = ensureDefaultCommands(normalizeCommandIds(fresh));
              await storeCommands(withDefaults);
              setCommands(withDefaults);
            } catch {
              if (!active) return;
              await storeCommands(normalizeCommandIds(ALL_DEFAULT_COMMANDS));
              setCommands(normalizeCommandIds(ALL_DEFAULT_COMMANDS));
            }
          }
        } else {
          // Still need to handle no-storage case for this instance
          if (!stored || stored.length === 0) {
            setCommands(normalizeCommandIds(ALL_DEFAULT_COMMANDS));
          }
        }
      } catch (error) {
        console.error('[useCommands] Failed to initialize commands:', error);
        if (active) setCommands(normalizeCommandIds(ALL_DEFAULT_COMMANDS));
      } finally {
        if (active) setLoading(false);
      }
    };

    initCommands();

    return () => {
      active = false;
    };
  }, [userId]);

  // Listen for storage changes to stay in sync with other components/tabs
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newValue = changes[STORAGE_KEY].newValue;
        if (newValue && Array.isArray(newValue)) {
          setCommands(normalizeCommandIds(newValue));
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return { commands, loading, refreshCommands };
};
