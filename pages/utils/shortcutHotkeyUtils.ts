/**
 * Utility functions for parsing and managing cloud-based shortcuts and hotkeys
 * These are stored as dictionary strings on snippets: "user_123:/shortcut1, user_456:/shortcut2"
 */

// ============================================================================
// DICTIONARY PARSING UTILITIES
// ============================================================================

/**
 * Parse dictionary string into Map
 * Input: "user_123:/leave_mail, user_456:/vacation"
 * Output: Map { "user_123" => "/leave_mail", "user_456" => "/vacation" }
 */
export function parseDictionaryString(dictString: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!dictString) return map;

  const entries = dictString
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const colonIndex = entry.indexOf(':');
    if (colonIndex > 0) {
      const key = entry.substring(0, colonIndex).trim();
      const value = entry.substring(colonIndex + 1).trim();
      if (key && value) {
        map.set(key, value);
      }
    }
  }
  return map;
}

/**
 * Serialize Map back to dictionary string
 * Input: Map { "user_123" => "/leave_mail", "user_456" => "/vacation" }
 * Output: "user_123:/leave_mail, user_456:/vacation"
 */
export function serializeDictionaryToString(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

/**
 * Get current user's shortcut from snippet's shortcuts dictionary
 */
export function getUserShortcut(shortcuts: string | null | undefined, userId: string): string {
  const map = parseDictionaryString(shortcuts);
  return map.get(userId) || '';
}

/**
 * Get current user's hotkey from snippet's hotkeys dictionary
 */
export function getUserHotkey(hotkeys: string | null | undefined, userId: string): string {
  const map = parseDictionaryString(hotkeys);
  return map.get(userId) || '';
}

/**
 * Update user's shortcut in dictionary and return new string
 */
export function updateUserShortcut(shortcuts: string | null | undefined, userId: string, newShortcut: string): string {
  const map = parseDictionaryString(shortcuts);
  if (newShortcut) {
    map.set(userId, newShortcut);
  } else {
    map.delete(userId);
  }
  return serializeDictionaryToString(map);
}

/**
 * Update user's hotkey in dictionary and return new string
 */
export function updateUserHotkey(hotkeys: string | null | undefined, userId: string, newHotkey: string): string {
  const map = parseDictionaryString(hotkeys);
  if (newHotkey) {
    map.set(userId, newHotkey);
  } else {
    map.delete(userId);
  }
  return serializeDictionaryToString(map);
}

// ============================================================================
// LOCAL STORAGE SYNC UTILITIES
// These transform cloud data to local storage format for faster access
// ============================================================================

const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;

export interface LinkCommandMap {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
    url?: string;
    urls?: string[];
    iconHost?: string | null;
    type?: 'link' | 'tabgroup';
  };
}

export interface NoteCommandMap {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
  };
}

export interface HotkeysMap {
  commands: Record<string, string>;
  links: Record<string, string>;
  notes: Record<string, string>;
}

/**
 * Transform cloud shortcuts/hotkeys data from API response into local storage format
 * This should be called after fetching allData from the API
 *
 * @param teams - The teams array from API response
 * @param userId - Current user's ID from accessToken
 */
export async function syncCloudDataToLocalStorage(teams: any[], userId: string): Promise<void> {
  if (!chromeAny?.storage?.local || !userId) return;

  const linkCommands: LinkCommandMap = {};
  const noteCommands: NoteCommandMap = {};
  const linkHotkeys: Record<string, string> = {};
  const noteHotkeys: Record<string, string> = {};

  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      // Process workspace-level snippets
      for (const snippet of ws.workspace_snippets || []) {
        const snippetId = snippet.snippet_id || snippet.id;
        if (!snippetId) continue;

        const commandId = `${ws.workspace_id}-${snippetId}`;
        const category = (snippet.category || '').toLowerCase();

        // Get user-specific shortcut and hotkey from cloud data
        const userShortcut = getUserShortcut(snippet.shortcuts, userId);
        const userHotkey = getUserHotkey(snippet.hotkeys, userId);

        if (snippet.shortcuts || snippet.hotkeys) {
        }

        if (category === 'link' || category === 'tabgroup' || category === 'quicklink') {
          // Link/TabGroup
          if (userShortcut || userHotkey) {
            linkCommands[commandId] = {
              shortcut: userShortcut || undefined,
              snippetId: snippetId,
              label: snippet.key,
              type: category === 'tabgroup' ? 'tabgroup' : 'link',
            };
          }
          if (userHotkey) {
            linkHotkeys[commandId] = userHotkey;
          }
        } else if (category === 'snippet' || category === 'note' || category === 'prompt') {
          // Note/Snippet
          if (userShortcut || userHotkey) {
            noteCommands[commandId] = {
              shortcut: userShortcut || undefined,
              snippetId: snippetId,
              label: snippet.key,
            };
          }
          if (userHotkey) {
            noteHotkeys[commandId] = userHotkey;
          }
        }
      }

      // Process folder snippets
      for (const folder of ws.folders || []) {
        for (const snippet of folder.snippets || []) {
          const snippetId = snippet.snippet_id || snippet.id;
          if (!snippetId) continue;

          const commandId = `${folder.folder_id}-${snippetId}`;
          const category = (snippet.category || '').toLowerCase();

          // Get user-specific shortcut and hotkey from cloud data
          const userShortcut = getUserShortcut(snippet.shortcuts, userId);
          const userHotkey = getUserHotkey(snippet.hotkeys, userId);

          if (category === 'link' || category === 'tabgroup' || category === 'quicklink') {
            // Link/TabGroup
            if (userShortcut || userHotkey) {
              linkCommands[commandId] = {
                shortcut: userShortcut || undefined,
                snippetId: snippetId,
                label: snippet.key,
                type: category === 'tabgroup' ? 'tabgroup' : 'link',
              };
            }
            if (userHotkey) {
              linkHotkeys[commandId] = userHotkey;
            }
          } else if (category === 'snippet' || category === 'note' || category === 'prompt') {
            // Note/Snippet
            if (userShortcut || userHotkey) {
              noteCommands[commandId] = {
                shortcut: userShortcut || undefined,
                snippetId: snippetId,
                label: snippet.key,
              };
            }
            if (userHotkey) {
              noteHotkeys[commandId] = userHotkey;
            }
          }
        }
      }
    }
  }

  // Write to local storage for fast access - MERGING with existing data to prevent overwrite of local-only changes
  await new Promise<void>(resolve => {
    chromeAny.storage.local.get(
      ['link_commands', 'note_commands', 'alts_link_hotkeys', 'alts_note_hotkeys'],
      (result: any) => {
        const existingLinkCommands = result.link_commands || {};
        const existingNoteCommands = result.note_commands || {};
        const existingLinkHotkeys = result.alts_link_hotkeys || {};
        const existingNoteHotkeys = result.alts_note_hotkeys || {};

        // Merge strategies:
        // 1. For Commands: Cloud source of truth usually wins for definition, but we want to preserve local shortcuts if not in cloud?
        //    Actually, cloud should be source of truth. BUT if cloud is empty/partial, we shouldn't wipe.
        //    However, safest is: merge new onto existing.

        const mergedLinkCommands = { ...existingLinkCommands, ...linkCommands };
        const mergedNoteCommands = { ...existingNoteCommands, ...noteCommands };
        const mergedLinkHotkeys = { ...existingLinkHotkeys, ...linkHotkeys };
        const mergedNoteHotkeys = { ...existingNoteHotkeys, ...noteHotkeys };

        chromeAny.storage.local.set(
          {
            link_commands: mergedLinkCommands,
            note_commands: mergedNoteCommands,
            alts_link_hotkeys: mergedLinkHotkeys,
            alts_note_hotkeys: mergedNoteHotkeys,
          },
          () => resolve(),
        );
      },
    );
  });

  // ─── Sync automation hotkeys/shortcuts ─────────────────────────────────────
  // Automations use direct scalar values (not per-user dict strings).
  // Key: automation_id (string). Value: the hotkey/shortcut string.
  const automationHotkeys: Record<string, string> = {};
  const automationShortcuts: Record<string, string> = {};

  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      // Workspace-level automations
      for (const auto of ws.workspace_automations || []) {
        const id = String(auto.id || auto.automation_id || '');
        if (!id) continue;
        if (auto.hotkeys) automationHotkeys[id] = auto.hotkeys;
        if (auto.shortcuts) automationShortcuts[id] = auto.shortcuts;
      }
      // Folder-level automations
      for (const folder of ws.folders || []) {
        for (const auto of folder.automations || []) {
          const id = String(auto.id || auto.automation_id || '');
          if (!id) continue;
          if (auto.hotkeys) automationHotkeys[id] = auto.hotkeys;
          if (auto.shortcuts) automationShortcuts[id] = auto.shortcuts;
        }
      }
    }
  }

  if (Object.keys(automationHotkeys).length > 0 || Object.keys(automationShortcuts).length > 0) {
    await new Promise<void>(resolve => {
      chromeAny.storage.local.get(['alts_automation_hotkeys', 'alts_automation_shortcuts'], (existing: any) => {
        chromeAny.storage.local.set(
          {
            alts_automation_hotkeys: { ...(existing.alts_automation_hotkeys || {}), ...automationHotkeys },
            alts_automation_shortcuts: { ...(existing.alts_automation_shortcuts || {}), ...automationShortcuts },
          },
          () => resolve(),
        );
      });
    });
  }
  // ─── End automation sync ────────────────────────────────────────────────────
}

/**
 * Update a single snippet's shortcut in local storage after successful cloud save
 */
export async function updateLocalShortcut(
  commandId: string,
  snippetId: string,
  shortcut: string,
  label: string,
  type: 'link' | 'note' | 'snippet' | 'prompt' | 'automation' | 'module',
  snippetType?: 'link' | 'tabgroup',
): Promise<void> {
  if (!chromeAny?.storage?.local) return;

  const storageKey =
    type === 'link'
      ? 'link_commands'
      : type === 'automation'
        ? 'alts_automation_shortcuts'
        : type === 'module'
          ? 'alts_local_command_customizations'
          : 'note_commands';

  return new Promise<void>(resolve => {
    chromeAny.storage.local.get(storageKey, (result: any) => {
      const existing = result[storageKey] || {};

      const updateData = (id: string) => {
        if (shortcut) {
          if (type === 'automation') {
            existing[id] = shortcut;
          } else if (type === 'module') {
            existing[id] = { ...existing[id], prefix: shortcut };
          } else {
            existing[id] = {
              ...existing[id],
              shortcut: shortcut,
              snippetId: snippetId,
              label: label,
              ...(type === 'link' && snippetType && { type: snippetType }),
            };
          }
        } else if (existing[id]) {
          if (type === 'automation' || type === 'module') {
            delete existing[id];
          } else {
            delete existing[id].shortcut;
            if (Object.keys(existing[id]).length <= 1) {
              delete existing[id];
            }
          }
        }
      };

      // 1. Update the target ID
      updateData(commandId);

      // 2. For automation, also update the raw automationId if commandId is compound
      if (type === 'automation' && commandId.includes('-')) {
        const rawId = commandId.split('-').slice(1).join('-');
        if (rawId) {
          updateData(rawId);
        }
      }

      // 3. Global sync: find and update all other instances of this snippet
      Object.keys(existing).forEach(key => {
        // Extract ID using robust logic: everything after first dash
        if (key !== commandId && (key.endsWith(`-${snippetId}`) || key === snippetId)) {
          updateData(key);
        }
      });

      chromeAny.storage.local.set({ [storageKey]: existing }, () => resolve());
    });
  });
}

/**
 * Update a single snippet's hotkey in local storage after successful cloud save
 */
export async function updateLocalHotkey(
  commandId: string,
  hotkey: string,
  type: 'link' | 'note' | 'snippet' | 'command' | 'prompt' | 'automation' | 'module',
): Promise<void> {
  if (!chromeAny?.storage?.local) return;

  const storageKey =
    type === 'link'
      ? 'alts_link_hotkeys'
      : type === 'note' || type === 'snippet' || type === 'prompt'
        ? 'alts_note_hotkeys'
        : type === 'automation'
          ? 'alts_automation_hotkeys'
          : type === 'module'
            ? 'alts_module_hotkeys'
            : 'alts_command_hotkeys';

  return new Promise<void>(resolve => {
    chromeAny.storage.local.get(storageKey, (result: any) => {
      const existing = result[storageKey] || {};

      // 1. Update the target ID
      if (hotkey) {
        existing[commandId] = hotkey;
      } else {
        delete existing[commandId];
      }

      // Also ensure the raw automationId is updated/synced for automations
      if (type === 'automation' && commandId.includes('-')) {
        const rawId = commandId.split('-').slice(1).join('-');
        if (rawId) {
          if (hotkey) {
            existing[rawId] = hotkey;
          } else {
            delete existing[rawId];
          }
        }
      }

      // 2. Global sync for snippets (commands/modules/automations don't have container prefixes like WS-ID)
      if (type !== 'command' && type !== 'module' && type !== 'automation' && commandId.includes('-')) {
        // Find fragment that matches a potential snippet ID
        const parts = commandId.split('-');
        const snippetId = parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : parts.slice(1).join('-');

        if (snippetId) {
          Object.keys(existing).forEach(key => {
            if (key !== commandId && (key.endsWith(`-${snippetId}`) || key === snippetId)) {
              if (hotkey) {
                existing[key] = hotkey;
              } else {
                delete existing[key];
              }
            }
          });
        }
      }

      chromeAny.storage.local.set({ [storageKey]: existing }, () => resolve());
    });
  });
}

/**
 * Get current user ID from local storage
 */
export async function getCurrentUserId(): Promise<string> {
  if (!chromeAny?.storage?.local) return '';

  return new Promise<string>(resolve => {
    chromeAny.storage.local.get('accessToken', (result: { accessToken?: string }) => {
      resolve(result.accessToken || '');
    });
  });
}

/**
 * Extract snippet ID from commandId
 * commandId format: "${containerId}-${snippetId}"
 */
export function extractSnippetIdFromCommandId(commandId: string): string {
  const parts = commandId.split('-');
  // The snippet ID is everything after the first hyphen
  return parts.slice(1).join('-');
}
