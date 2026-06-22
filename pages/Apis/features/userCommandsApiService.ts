import { axiosInstance } from '../core/axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from '../core/bgFetch';
import { getUserId } from '../core/api';
import { getInstallations as getStoreInstallations } from '../storeApis/storeApiService';
import {
  CommandDefinition,
  AutoSubmitKind,
  CommandId,
  COMMANDS,
} from '../../new-tab/src/components/SearchComponents/Searchbar/commands';
import { addCommand } from './featuredApi';
import { incrementUserRefreshCounter } from '@private-services/userRefreshCounterService';
import { StorageManager } from '../storage/StorageManager';

// ==================== Storage Key ====================
// Using same key as existing system for backward compatibility
const STORAGE_KEY = 'alts_commands';


// ==================== Browser Info Detection ====================

const getBrowserInfo = (): { scheme: string; iconHost: string; name: string } => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('edg/') || userAgent.includes('edge')) {
    return { scheme: 'edge://', iconHost: 'microsoft.com', name: 'Edge' };
  }

  if ((navigator as any).brave && (navigator as any).brave.isBrave) {
    return { scheme: 'brave://', iconHost: 'brave.com', name: 'Brave' };
  }

  return { scheme: 'chrome://', iconHost: 'google.com', name: 'Chrome' };
};

const BROWSER_INFO = getBrowserInfo();

// ==================== Browser Commands (Local Only) ====================
// These stay local because they use browser-specific URLs (chrome://, edge://, brave://)

const BROWSER_COMMANDS_RAW = [
  {
    id: 'history' as CommandId,
    label: 'History',
    prefix: '/history',
    urlTemplate: `${BROWSER_INFO.scheme}history`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['history', 'recent', 'past', 'visited', 'core'],
    category: 'browser' as const,
  },
  {
    id: 'extensions' as CommandId,
    label: 'Extensions',
    prefix: '/extensions',
    urlTemplate: `${BROWSER_INFO.scheme}extensions`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['extensions', 'plugins', 'addons', 'browser extensions', 'core'],
    category: 'browser' as const,
  },
  {
    id: 'bookmarks' as CommandId,
    label: 'Bookmarks',
    prefix: '/bookmarks',
    urlTemplate: `${BROWSER_INFO.scheme}bookmarks`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['bookmarks', 'favorites', 'saved', 'core'],
    category: 'browser' as const,
  },
  {
    id: 'downloads' as CommandId,
    label: 'Downloads',
    prefix: '/downloads',
    urlTemplate: `${BROWSER_INFO.scheme}downloads`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['downloads', 'files', 'downloaded', 'core'],
    category: 'browser' as const,
  },
  {
    id: 'passwords' as CommandId,
    label: 'Passwords',
    prefix: '/passwords',
    urlTemplate: `${BROWSER_INFO.scheme}password-manager`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['passwords', 'credentials', 'login', 'manager', 'core'],
    category: 'browser' as const,
  },
  {
    id: 'flags' as CommandId,
    label: 'Flags',
    prefix: '/flags',
    urlTemplate: `${BROWSER_INFO.scheme}flags`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['flags', 'experimental', 'features', 'dev'],
    category: 'browser' as const,
  },
  {
    id: 'inspect' as CommandId,
    label: 'Inspect',
    prefix: '/inspect',
    urlTemplate: `${BROWSER_INFO.scheme}inspect`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['inspect', 'developer', 'tools', 'debug', 'dev'],
    category: 'browser' as const,
  },
  {
    id: 'version' as CommandId,
    label: 'Version',
    prefix: '/version',
    urlTemplate: `${BROWSER_INFO.scheme}version`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['version', 'build', 'about', 'info', 'dev'],
    category: 'browser' as const,
  },
  {
    id: 'tasks' as CommandId,
    label: 'Tasks',
    prefix: '/tasks',
    urlTemplate: `${BROWSER_INFO.scheme}tasks`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['tasks', 'manager', 'processes', 'perf', 'performance'],
    category: 'browser' as const,
  },
  {
    id: 'gpu' as CommandId,
    label: 'GPU',
    prefix: '/gpu',
    urlTemplate: `${BROWSER_INFO.scheme}gpu`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['gpu', 'graphics', 'acceleration', 'perf', 'performance'],
    category: 'browser' as const,
  },
  {
    id: 'dino' as CommandId,
    label: 'Dino Game',
    prefix: '/dino',
    urlTemplate: `${BROWSER_INFO.scheme}dino`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['dino', 'game', 't-rex', 'offline', 'fun'],
    category: 'browser' as const,
  },
  {
    id: 'about' as CommandId,
    label: 'About Browser',
    prefix: '/about',
    urlTemplate: `${BROWSER_INFO.scheme}about`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['about', 'list', 'urls', 'chrome urls', 'all'],
    category: 'browser' as const,
  },
];

// Filter out Chrome-specific commands for non-Chrome browsers
export const BROWSER_COMMANDS: CommandDefinition[] = BROWSER_COMMANDS_RAW.filter(cmd => {
  const chromeSpecificIds = ['passwords', 'tasks', 'inspect', 'dino'];
  if (BROWSER_INFO.scheme !== 'chrome://' && chromeSpecificIds.includes(cmd.id)) {
    return false;
  }
  return true;
});

// ==================== Default AI & Search Commands ====================
// These are pre-populated for new users (along with browser commands)

// All default commands (browser + AI/search + remote) for new users
export const DEFAULT_COMMANDS: CommandDefinition[] = COMMANDS.filter(c => c.category !== 'browser');
export const ALL_DEFAULT_COMMANDS: CommandDefinition[] = COMMANDS;

// ==================== Types & Interfaces ====================

/**
 * Base command from the database (commands table)
 */
export interface BaseCommand {
  id: string;
  label: string;
  prefix: string;
  url_template: string;
  icon_host: string | null;
  auto_submit: AutoSubmitKind | null;
  keywords: string[];
  category: 'browser' | 'ai' | 'search';
  created_at: string;
  updated_at: string;
}

/**
 * User installed command from the API response
 */
export interface UserInstalledCommand {
  installation_id: number;
  user_id: string;
  command_id: string;
  prefix: string;
  keywords: string[];
  created_at: string;
  updated_at: string;
  command: BaseCommand;
  hotkey?: string;
}

/**
 * API response for fetching user installed commands
 */
export interface UserCommandsApiResponse {
  data: UserInstalledCommand[];
}

/**
 * API response for single user command operations
 */
export interface UserCommandApiResponse {
  data: UserInstalledCommand;
}

/**
 * Payload for updating user command (prefix/keywords)
 */
export interface UpdateUserCommandPayload {
  prefix?: string;
  keywords?: string[];
}

// ==================== API Service Methods ====================

/**
 * Fetch user's installed commands from the API
 */
export const fetchUserCommandsFromApi = async (userId?: string): Promise<UserCommandsApiResponse> => {
  const user_id = userId || (await getUserId());
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  // Fetch local user commands
  let localCmds: any[] = [];
  try {
    const res = await localProvider.fetchUserCommands(user_id);
    localCmds = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch (err) {
    console.error('[fetchUserCommandsFromApi] Local fetch failed:', err);
  }

  // Fetch cloud user commands
  let cloudCmds: any[] = [];
  try {
    if (user_id && user_id !== 'local_user') {
      const res = await cloudProvider.fetchUserCommands(user_id);
      cloudCmds = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    }
  } catch (err) {
    console.warn('[fetchUserCommandsFromApi] Cloud fetch failed, continuing with local only:', err);
  }

  // Merge and deduplicate by command_id
  const merged = localCmds.map((c: any) => ({ ...c, storageMode: 'local' }));
  const localCommandIds = new Set(localCmds.map(c => c.command_id || c.command?.id).filter(Boolean));
  for (const c of cloudCmds) {
    const cmdId = c.command_id || c.command?.id;
    if (cmdId && !localCommandIds.has(cmdId)) {
      merged.push({ ...c, storageMode: 'cloud' });
    }
  }

  return { data: merged };
};

/**
 * Update user's custom prefix and/or keywords for an installed command
 */
export const updateUserCommand = async (
  installationId: number,
  payload: UpdateUserCommandPayload,
  storageMode?: 'local' | 'cloud',
): Promise<UserCommandApiResponse> => {
  let resolvedMode: 'local' | 'cloud' = storageMode || 'cloud';
  if (!storageMode) {
    const found = cachedUserCommandsRaw.find(cmd => cmd.installation_id === installationId);
    if (found && (found as any).storageMode) {
      resolvedMode = (found as any).storageMode;
    }
  }
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.updateUserCommand(installationId, payload);
  
  // Increment user counter (fire-and-forget)
  incrementUserRefreshCounter().catch(() => {});

  return response as UserCommandApiResponse;
};

/**
 * Update user's command hotkey via API
 */
export const updateCommandHotkey = async (
  installationId: number,
  hotkey: string,
  storageMode?: 'local' | 'cloud',
): Promise<any> => {
  let resolvedMode: 'local' | 'cloud' = storageMode || 'cloud';
  if (!storageMode) {
    const found = cachedUserCommandsRaw.find(cmd => cmd.installation_id === installationId);
    if (found && (found as any).storageMode) {
      resolvedMode = (found as any).storageMode;
    }
  }
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.updateCommandHotkey(installationId, { hotkey });

  // Increment user counter (fire-and-forget)
  incrementUserRefreshCounter().catch(() => {});

  return response;
};

// ==================== Transform Functions ====================

/**
 * Transform API response to CommandDefinition format
 * Uses parent prefix/keywords (user customizable) instead of command.prefix/keywords
 */
export const transformUserCommandToDefinition = (userCommand: UserInstalledCommand): CommandDefinition => {
  const { command, prefix, keywords } = userCommand;

  return {
    id: command.id as CommandId,
    label: command.label,
    prefix: prefix, // Use user's custom prefix
    urlTemplate: command.url_template,
    iconHost: command.icon_host || '',
    autoSubmit: command.auto_submit || undefined,
    keywords: keywords, // Use user's custom keywords
    category: command.category,
    hotkey: userCommand.hotkey,
  };
};

/**
 * Transform array of user commands to CommandDefinition array
 */
export const transformUserCommandsToDefinitions = (userCommands: UserInstalledCommand[]): CommandDefinition[] => {
  return userCommands.map(transformUserCommandToDefinition);
};

// ==================== Installation ID Lookup ====================

// Cache the user commands with installation_ids for lookup
let cachedUserCommandsRaw: UserInstalledCommand[] = [];

/**
 * Get installation_id for a command by its command_id
 */
export const getInstallationIdByCommandId = (commandId: string): number | null => {
  const found = cachedUserCommandsRaw.find(cmd => cmd.command_id === commandId);
  return found ? found.installation_id : null;
};

// ==================== Local Storage Functions ====================

/**
 * Get commands from local storage (alts_commands)
 */
export const getStoredCommands = async (): Promise<CommandDefinition[] | null> => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY] && Array.isArray(result[STORAGE_KEY])) {
      return result[STORAGE_KEY];
    }
    return null;
  } catch (error) {
    console.error('[userCommandsApiService] Error reading storage:', error);
    return null;
  }
};

/**
 * Save commands to local storage (alts_commands)
 */
export const storeCommands = async (commands: CommandDefinition[]): Promise<void> => {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: commands });
  } catch (error) {
    console.error('[userCommandsApiService] Error storing commands:', error);
  }
};

// ==================== Main Functions ====================

/**
 * Fetch commands from API, merge with browser commands, and store in local storage
 * Returns the merged commands array
 */
// In-flight deduplication — prevents multiple hook instances from each firing a network request
let _fetchAndStorePromise: Promise<CommandDefinition[]> | null = null;

export const fetchAndStoreUserCommands = async (): Promise<CommandDefinition[]> => {
  if (_fetchAndStorePromise) {
    return _fetchAndStorePromise;
  }

  _fetchAndStorePromise = (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchUserCommandsFromApi(userId);

      // Cache raw response for installation_id lookups
      cachedUserCommandsRaw = response.data;

      // Transform to CommandDefinition format
      const apiCommands = transformUserCommandsToDefinitions(response.data);

      // Merge: Browser commands + API commands
      const nonBrowserApiCommands = apiCommands.filter(cmd => cmd.category !== 'browser');

      // Phase 2: Sync and Merge Installed Cloud Modules
      let modules: any[] = [];
      try {
        const installationsRes = await getStoreInstallations();
        if (installationsRes && Array.isArray(installationsRes.data)) {
          // Flatten to include module metadata and top-level ID for backward compatibility
          modules = installationsRes.data.map(inst => {
            const nestedModule = (inst.module || {}) as any;
            const nestedId = nestedModule.module_id; // Numeric ID (from nested)
            const topLevelModuleId = inst.module_id; // UUID (usually)
            const moduleKey = nestedModule.module_key || nestedModule.slug;
            return {
              ...nestedModule,
              id: inst.id, // Primary Installation ID
              installation_id: inst.id,
              module_id: topLevelModuleId || nestedId, // Preferred identifier for general use
              module_uuid: topLevelModuleId,
              module_internal_id: nestedId,
              module_key: moduleKey,
              prefix: nestedModule.prefix || nestedModule.shortcut || '',
              hotkey: (inst as any).hotkey || (inst as any).settings?.hotkey || '',
              is_favourite: inst.is_favourite || false,
              is_enabled: inst.is_enabled ?? true,
            };
          });
          await chrome.storage.local.set({ installed_modules: modules });
        } else {
          // Fallback to existing storage if update fails
          const modResult = await chrome.storage.local.get(['installed_modules']);
          modules = modResult.installed_modules || [];
        }
      } catch (err) {
        console.warn('[userCommandsApiService] Failed to sync modules via Store API, using cache:', err);
        const modResult = await chrome.storage.local.get(['installed_modules']);
        modules = modResult.installed_modules || [];
      }

      const moduleCommands: CommandDefinition[] = modules.map(m => ({
        id: m.module_id as CommandId,
        label: m.name,
        prefix: `/${m.module_id}`,
        urlTemplate: m.icon_host ? `https://${m.icon_host}` : 'https://chatgpt.com',
        iconHost: m.icon_host || 'chatgpt.com',
        autoSubmit: 'chatgpt' as any,
        keywords: [m.name.toLowerCase()],
        category: 'ai' as any,
      }));

      const mergedCommands = [...BROWSER_COMMANDS, ...nonBrowserApiCommands, ...moduleCommands];

      // Store in local storage
      await storeCommands(mergedCommands);
      return mergedCommands;
    } catch (error: any) {
      if (error?.name === 'AuthError' || error?.message?.includes('login')) {
        // Silently return default commands if user is not logged in
        return [...ALL_DEFAULT_COMMANDS];
      }
      console.error('[userCommandsApiService] Error fetching commands:', error);
      throw error;
    } finally {
      _fetchAndStorePromise = null;
    }
  })();

  return _fetchAndStorePromise;
};

/**
 * Initialize user commands - check storage first, fetch from API if needed
 * This is the main function to call on app load
 */
export const initializeUserCommands = async (): Promise<CommandDefinition[]> => {
  try {
    // Check if we have stored commands
    const stored = await getStoredCommands();

    if (stored && stored.length > 0) {
      // Rebuild the raw cache from stored commands (won't have installation_ids)
      // We'll need to fetch from API in background to get installation_ids
      fetchAndStoreUserCommands().catch(err => {
        console.warn('[userCommandsApiService] Background refresh failed:', err);
      });

      return stored;
    }

    // No stored commands, fetch from API
    return await fetchAndStoreUserCommands();
  } catch (error) {
    console.error('[userCommandsApiService] Initialization error:', error);
    // Return browser commands as fallback
    return BROWSER_COMMANDS;
  }
};

/**
 * Update a command's prefix/keywords via API, then refresh local storage
 * Returns the updated commands array
 */
export const updateCommandAndRefresh = async (
  commandId: string,
  payload: UpdateUserCommandPayload,
): Promise<CommandDefinition[]> => {
  try {
    // Find installation_id for this command
    let installationId = getInstallationIdByCommandId(commandId);

    if (!installationId) {
      // If we don't have the installation_id cached, fetch commands first
      await fetchAndStoreUserCommands();
      installationId = getInstallationIdByCommandId(commandId);

      if (!installationId) {
        // Check if it's a default command that needs installation
        const defaultCmd = DEFAULT_COMMANDS.find(c => c.id === commandId);
        if (defaultCmd) {
          const installRes = await addCommand(defaultCmd.id, defaultCmd.prefix, defaultCmd.keywords);
          installationId = installRes?.data?.installation_id || null;
        }
      }

      if (!installationId) {
        throw new Error(`Command ${commandId} not found and cannot be installed.`);
      }

      // Now update
      await updateUserCommand(installationId, payload);
    } else {
      // Update via API
      await updateUserCommand(installationId, payload);
    }

    // Fetch fresh data from API and update local storage
    return await fetchAndStoreUserCommands();
  } catch (error) {
    console.error('[userCommandsApiService] Error updating command:', error);
    throw error;
  }
};

/**
 * Update a command's hotkey via API, then refresh local storage
 * Returns the updated commands array
 */
export const updateHotkeyAndRefresh = async (commandId: string, hotkey: string): Promise<CommandDefinition[]> => {
  try {
    // Find installation_id for this command
    let installationId = getInstallationIdByCommandId(commandId);

    if (!installationId) {
      // If we don't have the installation_id cached, fetch commands first
      await fetchAndStoreUserCommands();
      installationId = getInstallationIdByCommandId(commandId);
    }

    if (installationId) {
      // Update via API
      await updateCommandHotkey(installationId, hotkey);
    } else {
      // If no installation ID (e.g. browser command), check if it's a default command that needs installation
      const defaultCmd = DEFAULT_COMMANDS.find(c => c.id === commandId);
      if (defaultCmd) {
        const installRes = await addCommand(defaultCmd.id, defaultCmd.prefix, defaultCmd.keywords);
        if (installRes?.data?.installation_id) {
          await updateCommandHotkey(installRes.data.installation_id, hotkey);
        }
      } else {
        console.warn(
          `[userCommandsApiService] No installation ID and NOT a default command for ${commandId}, skipping API update`,
        );
        return [];
      }
    }

    // Fetch fresh data from API and update local storage
    return await fetchAndStoreUserCommands();
  } catch (error) {
    console.error('[userCommandsApiService] Error updating hotkey:', error);
    throw error;
  }
};

/**
 * Force refresh commands from API
 */
export const refreshCommands = async (): Promise<CommandDefinition[]> => {
  return await fetchAndStoreUserCommands();
};
