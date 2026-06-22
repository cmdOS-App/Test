export const readAllShortcuts = async (): Promise<Record<string, string>> => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return {};
  return new Promise(resolve => {
    chromeAny.storage.local.get(
      [
        'link_commands',
        'note_commands',
        'alts_commands',
        'alts_local_command_customizations',
        'alts_automation_shortcuts',
      ],
      (res: any) => {
        const all: Record<string, string> = {};
        const linkCmds = res.link_commands || {};
        const noteCmds = res.note_commands || {};
        const altsCmds = res.alts_commands || [];
        const localCustoms = res.alts_local_command_customizations || {};
        const autoShortcuts = res.alts_automation_shortcuts || {};

        // 1. Link Commands
        Object.entries(linkCmds).forEach(([id, data]: [string, any]) => {
          if (data?.shortcut) all[id] = data.shortcut;
        });

        // 2. Note Commands
        Object.entries(noteCmds).forEach(([id, data]: [string, any]) => {
          if (data?.shortcut) all[id] = data.shortcut;
        });

        // 3. Global Commands (alts_commands)
        if (Array.isArray(altsCmds)) {
          altsCmds.forEach((cmd: any) => {
            if (cmd?.id && cmd?.prefix) {
              all[cmd.id] = cmd.prefix;
            }
          });
        }

        // 4. Local Command Customizations
        Object.entries(localCustoms).forEach(([id, data]: [string, any]) => {
          if (data?.prefix) {
            all[id] = data.prefix;
          }
        });

        // 5. Automation Specific Shortcuts
        Object.entries(autoShortcuts).forEach(([id, sc]) => {
          if (typeof sc === 'string') all[id] = sc;
        });

        resolve(all);
      },
    );
  });
};

export const readAllHotkeys = async (): Promise<Record<string, string>> => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return {};
  return new Promise(resolve => {
    chromeAny.storage.local.get(
      [
        'alts_command_hotkeys',
        'alts_link_hotkeys',
        'alts_note_hotkeys',
        'alts_commands',
        'alts_local_command_customizations',
        'alts_automation_hotkeys',
        'alts_module_hotkeys',
      ],
      (res: any) => {
        const all: Record<string, string> = {};

        // 1. API Command Hotkeys (cloud synced)
        const altsCmds = res.alts_commands || [];
        if (Array.isArray(altsCmds)) {
          altsCmds.forEach((cmd: any) => {
            if (cmd?.id && cmd?.hotkey) {
              all[cmd.id] = cmd.hotkey;
            }
          });
        }

        // 2. Local Overrides / Other Hotkeys
        Object.entries(res.alts_command_hotkeys || {}).forEach(([id, hk]) => {
          all[id] = hk as string;
        });
        Object.entries(res.alts_link_hotkeys || {}).forEach(([id, hk]) => {
          all[id] = hk as string;
        });
        Object.entries(res.alts_note_hotkeys || {}).forEach(([id, hk]) => {
          all[id] = hk as string;
        });
        Object.entries(res.alts_automation_hotkeys || {}).forEach(([id, hk]) => {
          all[id] = hk as string;
        });
        Object.entries(res.alts_module_hotkeys || {}).forEach(([id, hk]) => {
          all[id] = hk as string;
        });

        // 3. Local Command Customizations
        const localCustoms = res.alts_local_command_customizations || {};
        Object.entries(localCustoms).forEach(([id, data]: [string, any]) => {
          if (data?.hotkey) {
            all[id] = data.hotkey;
          }
        });

        // 4. Default Fallbacks if not configured
        if (!all['create']) all['create'] = 'Alt+C';

        resolve(all);
      },
    );
  });
};

/**
 * Generates a compound ID for storage lookup (e.g., "folderId-snippetId").
 * Centralizes the logic used across various views.
 */
export const getItemCompoundId = (item: any): string => {
  if (!item) return '';
  // Direct ID check for commands or folders
  if (item.kind === 'command' || item._kind === 'command') return item.id;
  if (item._kind === 'folder' || item.kind === 'folder') return item.folder_id || item.id;
  if (
    item._kind === 'automation' ||
    item.kind === 'automation' ||
    item.type === 'automation' ||
    item.category === 'automation'
  )
    return item.automation?.id || item.id;

  // Handle SavedAutomation wrapper from SavedAutomationsPanel.tsx
  if (item.type === 'saved' || item.type === 'installed') {
    const data = item.data || {};
    const snippetId = String(data.id || data.module_id || '');
    const containerId = data.folder_id || data.workspace_id;
    if (containerId && containerId !== 'null' && containerId !== 'undefined' && snippetId) {
      return `${containerId}-${snippetId}`;
    }
    return snippetId;
  }

  // Snippet resolution
  const snippet = item.suggestion?.snippet || item.snippet || item;
  let rawId = String(snippet?.snippet_id || snippet?.id || snippet?.snippetId || '');

  // If the ID already looks like a compound ID (contains a hyphen), extract the rightmost part
  // This prevents double-prefixing (e.g., "WS-ID-WS-ID-SnippetID")
  if (rawId.includes('-')) {
    rawId = extractSnippetIdFromCompoundId(rawId);
  }

  const snippetId = rawId;

  if (!snippetId && (item.folder_id || item.id || item.workspace_id)) {
    // If no snippet but has container ID, might be a folder or other entity
    return String(item.folder_id || item.workspace_id || item.id || '');
  }

  // Container resolution (Matches FavoritesPanel.tsx logic)
  const containerId =
    item.suggestion?.folder?.folder_id ||
    item.suggestion?.workspace?.workspace_id ||
    item.folder?.folder_id ||
    item.workspace?.workspace_id ||
    item.folder_id ||
    item.workspace_id;

  if (containerId && containerId !== 'null' && containerId !== 'undefined' && snippetId) {
    return `${containerId}-${snippetId}`;
  }
  return snippetId || String(containerId || '');
};

/**
 * Extracts the raw snippet ID from a compound ID.
 */
export const extractSnippetIdFromCompoundId = (compoundId: string): string => {
  if (!compoundId.includes('-')) return compoundId;
  const parts = compoundId.split('-');
  return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
};
