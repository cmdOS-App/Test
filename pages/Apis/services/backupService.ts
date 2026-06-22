/**
 * backupService.ts
 *
 * Milestone 7 — Export / Import Architecture
 *
 * Provides:
 *   exportBackup()         → collects all data and triggers a JSON file download
 *   importBackup()         → validates and restores a backup file
 *   getBackupSummary()     → returns counts for the confirmation UI
 *   connectGoogleDrive()   → OAuth connect via GoogleDriveProvider
 *   disconnectGoogleDrive()→ clear Drive token
 *   uploadToGoogleDrive()  → build payload and upload to Drive appDataFolder
 *   listGoogleDriveBackups()  → list Drive backups
 *   deleteGoogleDriveBackup() → delete a Drive backup by ID
 *
 * Schema version history:
 *   v1 — initial release (2026-06-19)
 */

import { StorageManager } from '../storage/StorageManager';
import { getUserId } from '../core/identity';
import { getGoogleDriveProvider } from '../backup/backupProviders';
import type { DriveFileEntry } from '../backup/backupProviders';
import { getStoredCustomizations } from '../features/localCommandsApiService';
import { store } from '../../Redux/store';
import { fetchAllDataThunk } from '../../Redux/AllData/allDataSlice';
import { clearWorkspaces } from '../../Redux/Workspaces/workspaceSlice';
import { setSelectedWorkspace, setSelectedFolder, setSelectedSnippet, navigateToView } from '../../Redux/AllData/uiStateSlice';
import type { Team } from '../../modals/interfaces';

// ─── Schema ─────────────────────────────────────────────────────────────────

export const BACKUP_SCHEMA_VERSION = '1.0.0';

export interface BackupPayload {
  /** Schema version string (e.g., '1.0.0'). */
  version: string;

  /** ISO-8601 UTC timestamp of when this backup was created. */
  exportedAt: string;

  /** App identifier — guards against loading backups from a different product. */
  appId: 'tasklabs';

  /** Optional backup type (e.g., 'manual', 'scheduled'). */
  backupType?: string;

  /** All orgs (Local + Cloud) with full nested data tree. */
  organizations: Team[];

  /** Favorites stored in chrome.storage.local (myFavouriteItems). */
  favorites: Record<string, any[]> | null;

  /** Hotkeys stored in chrome.storage.local (user_hotkeys). */
  hotkeys: Record<string, string> | null;

  /** Shortcuts stored in chrome.storage.local (user_shortcuts). */
  shortcuts: Record<string, string> | null;

  /** Local command customizations (prefix, keywords, hotkey overrides). */
  commandCustomizations: Record<string, any> | null;

  /** Appearance / preference settings from chrome.storage.local. */
  settings: BackupSettings | null;

  // Real snippet/automation shortcuts and hotkeys from local storage
  linkCommands?: Record<string, any> | null;
  noteCommands?: Record<string, any> | null;
  linkHotkeys?: Record<string, string> | null;
  noteHotkeys?: Record<string, string> | null;
  automationShortcuts?: Record<string, string> | null;
  automationHotkeys?: Record<string, string> | null;
}

export interface BackupSettings {
  themeId?: string;
  wallpaperId?: string;
  customWallpaperBase64?: string | null;
  isBoardViewEnabled?: boolean;
  isDarkMode?: boolean;
  isSidebarCollapsed?: boolean;
  showFavorites?: boolean;
  terminalOpen?: boolean;
  isAutoExpandMode?: boolean;
  expandedWorkspaces?: string[];
  expandedFolders?: string[];
  collapsedWorkspaces?: string[];
  collapsedFolders?: string[];
  collapsedSections?: string[];
}

export interface BackupSummary {
  version: string;
  exportedAt: string;
  organizationCount: number;
  localOrgCount: number;
  cloudOrgCount: number;
  workspaceCount: number;
  folderCount: number;
  snippetCount: number;
  todoCount: number;
  automationCount: number;
  tagCount: number;
  favoritesCount: number;
  commandCustomizationsCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function chromeStorage(): typeof chrome.storage.local | null {
  try {
    return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
  } catch {
    return null;
  }
}

async function chromeGet<T = any>(keys: string | string[]): Promise<T> {
  return new Promise(resolve => {
    const cs = chromeStorage();
    if (!cs) return resolve({} as T);
    cs.get(keys, result => resolve(result as T));
  });
}

async function chromeSet(obj: Record<string, any>): Promise<void> {
  return new Promise(resolve => {
    const cs = chromeStorage();
    if (!cs) return resolve();
    cs.set(obj, resolve);
  });
}

// Walk the org tree and count entities
function countEntities(orgs: Team[]) {
  let workspaces = 0, folders = 0, snippets = 0, todos = 0, automations = 0, tags = 0;

  for (const org of orgs) {
    tags += (org.tags || []).length;
    for (const ws of org.workspaces || []) {
      workspaces++;
      snippets += (ws.workspace_snippets || []).filter(
        (s: any) => !s.is_todo_type && !s.event_deadline
      ).length;
      todos += (ws.workspace_snippets || []).filter(
        (s: any) => s.is_todo_type || s.event_deadline
      ).length;
      automations += (ws.workspace_automations || []).length;

      for (const folder of ws.folders || []) {
        folders++;
        snippets += (folder.snippets || []).filter(
          (s: any) => !s.is_todo_type && !s.event_deadline
        ).length;
        todos += (folder.snippets || []).filter(
          (s: any) => s.is_todo_type || s.event_deadline
        ).length;
        automations += (folder.automations || []).length;
      }
    }
  }

  return { workspaces, folders, snippets, todos, automations, tags };
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Collects all data and downloads a tasklabs-backup.json file.
 * Does NOT require any parameters — reads everything from storage.
 */
export async function exportBackup(): Promise<void> {
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  // 1. Fetch all organizations (local + cloud merged)
  const localOrgs: Team[] = await localProvider.getAll().catch(() => []);

  let cloudOrgs: Team[] = [];
  try {
    const userId = await getUserId().catch(() => null);
    if (userId && userId !== 'local_user') {
      const result = await cloudProvider.getAll().catch(() => []);
      cloudOrgs = Array.isArray(result) ? result : result?.data ?? [];
    }
  } catch {
    // Cloud not available — local-only backup
  }

  // Merge, de-dupe by team_id
  const seenIds = new Set<string>();
  const allOrgs: Team[] = [];
  for (const org of [...localOrgs, ...cloudOrgs]) {
    const id = String((org as any).team_id);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      allOrgs.push(org);
    }
  }

  // 2. Favorites
  const favResult = await chromeGet<{ myFavouriteItems?: Record<string, any[]> }>('myFavouriteItems');
  const favorites = favResult.myFavouriteItems ?? null;

  // 3. Hotkeys
  const hotkeyResult = await chromeGet<{ user_hotkeys?: Record<string, string> }>('user_hotkeys');
  const hotkeys = hotkeyResult.user_hotkeys ?? null;

  // 4. Shortcuts
  const shortcutResult = await chromeGet<{ user_shortcuts?: Record<string, string> }>('user_shortcuts');
  const shortcuts = shortcutResult.user_shortcuts ?? null;

  // 5. Local command customizations
  const commandCustomizations = await getStoredCustomizations().catch(() => null);

  // 6. Appearance settings
  const settingsResult = await chromeGet<any>([
    'theme-id',
    'wallpaper-id',
    'custom-wallpaper-base64',
    'new_tab_is_board_view_enabled',
    'new_tab_is_dark_mode',
    'new_tab_is_sidebar_collapsed',
    'new_tab_show_favorites',
    'new_tab_terminal_open',
    'new_tab_is_auto_expand_mode',
    'new_tab_expanded_workspaces',
    'new_tab_expanded_folders',
    'new_tab_collapsed_workspaces',
    'new_tab_collapsed_folders',
    'new_tab_collapsed_sections'
  ]);

  const settings: BackupSettings = {
    themeId: settingsResult['theme-id'],
    wallpaperId: settingsResult['wallpaper-id'],
    customWallpaperBase64: settingsResult['custom-wallpaper-base64'] ?? null,
    isBoardViewEnabled: settingsResult['new_tab_is_board_view_enabled'],
    isDarkMode: settingsResult['new_tab_is_dark_mode'],
    isSidebarCollapsed: settingsResult['new_tab_is_sidebar_collapsed'],
    showFavorites: settingsResult['new_tab_show_favorites'],
    terminalOpen: settingsResult['new_tab_terminal_open'],
    isAutoExpandMode: settingsResult['new_tab_is_auto_expand_mode'],
    expandedWorkspaces: settingsResult['new_tab_expanded_workspaces'],
    expandedFolders: settingsResult['new_tab_expanded_folders'],
    collapsedWorkspaces: settingsResult['new_tab_collapsed_workspaces'],
    collapsedFolders: settingsResult['new_tab_collapsed_folders'],
    collapsedSections: settingsResult['new_tab_collapsed_sections'],
  };

  // 8. Build payload
  const realTriggers = await chromeGet<any>([
    'link_commands',
    'note_commands',
    'alts_link_hotkeys',
    'alts_note_hotkeys',
    'alts_automation_shortcuts',
    'alts_automation_hotkeys',
  ]);

  const payload: BackupPayload = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appId: 'tasklabs',
    backupType: 'manual',
    organizations: allOrgs,
    favorites,
    hotkeys,
    shortcuts,
    commandCustomizations,
    settings,
    linkCommands: realTriggers.link_commands ?? null,
    noteCommands: realTriggers.note_commands ?? null,
    linkHotkeys: realTriggers.alts_link_hotkeys ?? null,
    noteHotkeys: realTriggers.alts_note_hotkeys ?? null,
    automationShortcuts: realTriggers.alts_automation_shortcuts ?? null,
    automationHotkeys: realTriggers.alts_automation_hotkeys ?? null,
  };

  // 9. Download
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tasklabs-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Validate ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  payload?: BackupPayload;
}

/**
 * Validates a parsed backup file against the known schema.
 */
export function validateBackup(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Invalid file: not a JSON object.' };
  }

  const data = raw as any;

  if (data.appId !== 'tasklabs') {
    return { valid: false, error: 'Invalid file: not a TaskLabs backup (appId mismatch).' };
  }

  if (typeof data.version !== 'string') {
    return { valid: false, error: 'Invalid file: missing or invalid schema version format.' };
  }

  if (data.version !== BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Backup version ${data.version} is not supported by this version of the app (v${BACKUP_SCHEMA_VERSION}).`,
    };
  }

  if (!Array.isArray(data.organizations)) {
    return { valid: false, error: 'Invalid file: organizations field is not an array.' };
  }

  if (!data.exportedAt || typeof data.exportedAt !== 'string') {
    return { valid: false, error: 'Invalid file: missing exportedAt timestamp.' };
  }

  return { valid: true, payload: data as BackupPayload };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable summary of what's in a backup file.
 * Used by the confirmation UI before executing the restore.
 */
export function getBackupSummary(payload: BackupPayload): BackupSummary {
  const orgs = payload.organizations ?? [];
  const localOrgCount = orgs.filter((o: any) => o.storageMode === 'local').length;
  const cloudOrgCount = orgs.length - localOrgCount;

  const {
    workspaces, folders, snippets, todos, automations, tags,
  } = countEntities(orgs);

  const favoritesCount = Object.values(payload.favorites ?? {}).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
  );

  const commandCustomizationsCount = Object.keys(payload.commandCustomizations ?? {}).length;

  return {
    version: payload.version,
    exportedAt: payload.exportedAt,
    organizationCount: orgs.length,
    localOrgCount,
    cloudOrgCount,
    workspaceCount: workspaces,
    folderCount: folders,
    snippetCount: snippets,
    todoCount: todos,
    automationCount: automations,
    tagCount: tags,
    favoritesCount,
    commandCustomizationsCount,
  };
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  error?: string;
  restoredOrgs?: number;
}

/**
 * Restores a validated backup payload into local storage.
 *
 * Strategy:
 *   - Local orgs → written directly into LocalProvider (localOrganizations key)
 *   - Cloud orgs → skipped in V1 (cloud data lives in Supabase; re-sync on next load)
 *   - Settings, favorites, hotkeys, shortcuts, command customizations → restored to chrome.storage.local
 *   - Redux is refreshed via fetchAllDataThunk after restore
 */
export async function importBackup(payload: BackupPayload): Promise<ImportResult> {
  try {
    const localProvider = StorageManager.getInstance().getLocalProvider();
    const localOrgs = payload.organizations.filter(
      (o: any) => o.storageMode === 'local'
    );
    if (localOrgs.length > 0) {
      await localProvider.saveLocalOrgs(localOrgs);
    }

    // 2. Restore myCachedAllData (merged tree for sidebar rendering)
    //    We only merge local orgs back. Cloud orgs will re-populate on next getAll() call.
    const existing = await chromeGet<{ myCachedAllData?: Team[] }>('myCachedAllData');
    const existingCloud = (existing.myCachedAllData ?? []).filter(
      (o: any) => o.storageMode !== 'local'
    );
    const mergedCache = [
      ...localOrgs.map((o: any) => ({ ...o, storageMode: 'local' as const })),
      ...existingCloud,
    ];
    await chromeSet({ myCachedAllData: mergedCache });

    // 3. Restore favorites
    if (payload.favorites) {
      await chromeSet({ myFavouriteItems: payload.favorites });
    }

    // 4. Restore hotkeys
    if (payload.hotkeys) {
      await chromeSet({ user_hotkeys: payload.hotkeys });
    }

    // 5. Restore shortcuts
    if (payload.shortcuts) {
      await chromeSet({ user_shortcuts: payload.shortcuts });
    }

    // 5.1 Restore real snippet/automation shortcuts and hotkeys
    if (payload.linkCommands) {
      await chromeSet({ link_commands: payload.linkCommands });
    }
    if (payload.noteCommands) {
      await chromeSet({ note_commands: payload.noteCommands });
    }
    if (payload.linkHotkeys) {
      await chromeSet({ alts_link_hotkeys: payload.linkHotkeys });
    }
    if (payload.noteHotkeys) {
      await chromeSet({ alts_note_hotkeys: payload.noteHotkeys });
    }
    if (payload.automationShortcuts) {
      await chromeSet({ alts_automation_shortcuts: payload.automationShortcuts });
    }
    if (payload.automationHotkeys) {
      await chromeSet({ alts_automation_hotkeys: payload.automationHotkeys });
    }

    // 6. Restore local command customizations
    if (payload.commandCustomizations) {
      await chromeSet({
        alts_local_command_customizations: payload.commandCustomizations,
        alts_local_command_customizations_fetched: true,
      });
    }

    // 7. Restore appearance & UI settings
    if (payload.settings) {
      const settingsToRestore: Record<string, any> = {};
      if (payload.settings.themeId !== undefined) settingsToRestore['theme-id'] = payload.settings.themeId;
      if (payload.settings.wallpaperId !== undefined) settingsToRestore['wallpaper-id'] = payload.settings.wallpaperId;
      if (payload.settings.customWallpaperBase64 !== undefined) {
        settingsToRestore['custom-wallpaper-base64'] = payload.settings.customWallpaperBase64;
      }
      
      // UI Settings
      if (payload.settings.isBoardViewEnabled !== undefined) settingsToRestore['new_tab_is_board_view_enabled'] = payload.settings.isBoardViewEnabled;
      if (payload.settings.isDarkMode !== undefined) settingsToRestore['new_tab_is_dark_mode'] = payload.settings.isDarkMode;
      if (payload.settings.isSidebarCollapsed !== undefined) settingsToRestore['new_tab_is_sidebar_collapsed'] = payload.settings.isSidebarCollapsed;
      if (payload.settings.showFavorites !== undefined) settingsToRestore['new_tab_show_favorites'] = payload.settings.showFavorites;
      if (payload.settings.terminalOpen !== undefined) settingsToRestore['new_tab_terminal_open'] = payload.settings.terminalOpen;
      if (payload.settings.isAutoExpandMode !== undefined) settingsToRestore['new_tab_is_auto_expand_mode'] = payload.settings.isAutoExpandMode;
      if (payload.settings.expandedWorkspaces !== undefined) settingsToRestore['new_tab_expanded_workspaces'] = payload.settings.expandedWorkspaces;
      if (payload.settings.expandedFolders !== undefined) settingsToRestore['new_tab_expanded_folders'] = payload.settings.expandedFolders;
      if (payload.settings.collapsedWorkspaces !== undefined) settingsToRestore['new_tab_collapsed_workspaces'] = payload.settings.collapsedWorkspaces;
      if (payload.settings.collapsedFolders !== undefined) settingsToRestore['new_tab_collapsed_folders'] = payload.settings.collapsedFolders;
      if (payload.settings.collapsedSections !== undefined) settingsToRestore['new_tab_collapsed_sections'] = payload.settings.collapsedSections;

      if (Object.keys(settingsToRestore).length > 0) {
        await chromeSet(settingsToRestore);
      }
    }

    // 9. Rebuild LocalProvider's automation cache & clear Redux workspace slice
    //    (materializeCache is called automatically by LocalProvider.saveLocalOrgs,
    //     but since we wrote directly, we trigger a re-read via fetchAllDataThunk)
    try {
      // Clear current workspace selections and workspace slice data
      store.dispatch(clearWorkspaces());
      store.dispatch(setSelectedWorkspace(null));
      store.dispatch(setSelectedFolder(null));
      store.dispatch(setSelectedSnippet(null));
      store.dispatch(navigateToView({ kind: 'home' }));

      await store.dispatch(fetchAllDataThunk() as any);
    } catch (err) {
      console.warn('[backupService] Failed post-restore Redux sync:', err);
    }

    return { success: true, restoredOrgs: localOrgs.length };
  } catch (error: any) {
    console.error('[backupService] importBackup failed:', error);
    return { success: false, error: error?.message ?? 'Unknown restore error.' };
  }
}

// ─── Google Drive Coordination ────────────────────────────────────────────────

/**
 * Initiates the Google Drive OAuth flow.
 * Returns true if the user successfully connected, false if they cancelled.
 * Throws if the client ID is not configured or an unexpected error occurs.
 */
export async function connectGoogleDrive(): Promise<boolean> {
  const provider = getGoogleDriveProvider();
  return provider.connect();
}

/**
 * Clears the stored Drive access token.
 * The user will need to reconnect to perform Drive operations.
 */
export async function disconnectGoogleDrive(): Promise<void> {
  const provider = getGoogleDriveProvider();
  return provider.disconnect();
}

/**
 * Returns true if a valid Drive token is stored.
 */
export async function isGoogleDriveConnected(): Promise<boolean> {
  const provider = getGoogleDriveProvider();
  return provider.isConnected();
}

/**
 * Builds the full backup payload (same data as exportBackup) and uploads it
 * to the user's Drive appDataFolder.
 */
export async function uploadToGoogleDrive(): Promise<boolean> {
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  const localOrgs: any[] = await localProvider.getAll().catch(() => []);

  let cloudOrgs: any[] = [];
  try {
    const userId = await getUserId().catch(() => null);
    if (userId && userId !== 'local_user') {
      const result = await cloudProvider.getAll().catch(() => []);
      cloudOrgs = Array.isArray(result) ? result : (result as any)?.data ?? [];
    }
  } catch {
    // Cloud unavailable — proceed with local-only backup
  }

  const seenIds = new Set<string>();
  const allOrgs: any[] = [];
  for (const org of [...localOrgs, ...cloudOrgs]) {
    const id = String(org.team_id);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      allOrgs.push(org);
    }
  }

  // Collect auxiliary data (same as exportBackup)
  const favResult = await new Promise<any>(resolve => {
    chrome.storage.local.get('myFavouriteItems', resolve);
  });
  const hotkeyResult = await new Promise<any>(resolve => {
    chrome.storage.local.get('user_hotkeys', resolve);
  });
  const shortcutResult = await new Promise<any>(resolve => {
    chrome.storage.local.get('user_shortcuts', resolve);
  });
  const settingsResult = await new Promise<any>(resolve => {
    chrome.storage.local.get(
      [
        'theme-id', 'wallpaper-id', 'custom-wallpaper-base64',
        'new_tab_is_board_view_enabled', 'new_tab_is_dark_mode', 'new_tab_is_sidebar_collapsed',
        'new_tab_show_favorites', 'new_tab_terminal_open', 'new_tab_is_auto_expand_mode',
        'new_tab_expanded_workspaces', 'new_tab_expanded_folders', 'new_tab_collapsed_workspaces',
        'new_tab_collapsed_folders', 'new_tab_collapsed_sections'
      ],
      resolve,
    );
  });

  const { getStoredCustomizations: gsc } = await import(
    '../features/localCommandsApiService'
  );

  const commandCustomizations = await gsc().catch(() => null);

  const realTriggers = await new Promise<any>(resolve => {
    chrome.storage.local.get([
      'link_commands',
      'note_commands',
      'alts_link_hotkeys',
      'alts_note_hotkeys',
      'alts_automation_shortcuts',
      'alts_automation_hotkeys',
    ], resolve);
  });

  const payload: BackupPayload = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appId: 'tasklabs',
    backupType: 'manual',
    organizations: allOrgs,
    favorites: favResult.myFavouriteItems ?? null,
    hotkeys: hotkeyResult.user_hotkeys ?? null,
    shortcuts: shortcutResult.user_shortcuts ?? null,
    commandCustomizations,
    settings: {
      themeId: settingsResult['theme-id'],
      wallpaperId: settingsResult['wallpaper-id'],
      customWallpaperBase64: settingsResult['custom-wallpaper-base64'] ?? null,
      isBoardViewEnabled: settingsResult['new_tab_is_board_view_enabled'],
      isDarkMode: settingsResult['new_tab_is_dark_mode'],
      isSidebarCollapsed: settingsResult['new_tab_is_sidebar_collapsed'],
      showFavorites: settingsResult['new_tab_show_favorites'],
      terminalOpen: settingsResult['new_tab_terminal_open'],
      isAutoExpandMode: settingsResult['new_tab_is_auto_expand_mode'],
      expandedWorkspaces: settingsResult['new_tab_expanded_workspaces'],
      expandedFolders: settingsResult['new_tab_expanded_folders'],
      collapsedWorkspaces: settingsResult['new_tab_collapsed_workspaces'],
      collapsedFolders: settingsResult['new_tab_collapsed_folders'],
      collapsedSections: settingsResult['new_tab_collapsed_sections'],
    },
    linkCommands: realTriggers.link_commands ?? null,
    noteCommands: realTriggers.note_commands ?? null,
    linkHotkeys: realTriggers.alts_link_hotkeys ?? null,
    noteHotkeys: realTriggers.alts_note_hotkeys ?? null,
    automationShortcuts: realTriggers.alts_automation_shortcuts ?? null,
    automationHotkeys: realTriggers.alts_automation_hotkeys ?? null,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `tasklabs-backup-${dateStr}.json`;

  const provider = getGoogleDriveProvider();
  const success = await provider.uploadBackup(fileName, payload);
  if (success) {
    _cachedDriveBackups = null; // Invalidate cache
  }
  return success;
}

let _cachedDriveBackups: DriveFileEntry[] | null = null;

/**
 * Lists all TaskLabs backup files stored in the user's Drive appDataFolder.
 * Caches results inside the current session to avoid redundant queries.
 */
export async function listGoogleDriveBackups(forceRefresh = false): Promise<DriveFileEntry[]> {
  if (_cachedDriveBackups && !forceRefresh) {
    return _cachedDriveBackups;
  }
  const provider = getGoogleDriveProvider();
  const backups = await provider.listBackups();
  _cachedDriveBackups = backups;
  return backups;
}

/**
 * Permanently deletes a Drive backup file by its file ID.
 */
export async function deleteGoogleDriveBackup(fileId: string): Promise<boolean> {
  const provider = getGoogleDriveProvider();
  const ok = await provider.deleteBackup(fileId);
  if (ok) {
    _cachedDriveBackups = null; // Invalidate cache
  }
  return ok;
}

/**
 * Returns the Google account email connected to the drive backup session.
 */
export async function getGoogleDriveEmail(): Promise<string> {
  const provider = getGoogleDriveProvider();
  return provider.getUserEmail();
}

/**
 * Downloads a Google Drive backup's JSON content by its file ID.
 */
export async function downloadGoogleDriveBackup(fileId: string): Promise<any> {
  const provider = getGoogleDriveProvider();
  return provider.downloadBackup(fileId);
}

/**
 * Downloads the backup payload from Drive and triggers a local browser file download.
 */
export async function downloadDriveBackupToLocal(fileId: string, fileName: string): Promise<void> {
  const payload = await downloadGoogleDriveBackup(fileId);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Re-export DriveFileEntry so BackupPanel doesn't need to import from providers directly
export type { DriveFileEntry };

