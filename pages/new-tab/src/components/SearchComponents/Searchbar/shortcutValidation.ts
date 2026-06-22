import { COMMANDS } from './commands';
import { LOCAL_COMMANDS } from './localCommands';

export interface ShortcutConflict {
  isDuplicate: boolean;
  conflictName?: string;
  conflictId?: string;
  type?: 'command' | 'note' | 'link';
}

/**
 * Validates if a shortcut is already in use across any category.
 * @param newShortcut The new shortcut string (e.g. "hey" or "/hey")
 * @param currentCommandId The ID of the item being edited (to exclude it from collision check)
 */
export const validateShortcutUniqueness = async (
  newShortcut: string,
  currentCommandId: string,
): Promise<ShortcutConflict> => {
  const normalized = newShortcut.trim().toLowerCase();
  if (!normalized) return { isDuplicate: false };

  // Ensure comparison is done with leading slash
  const shortcutToCompare = normalized.startsWith('/') ? normalized : `/${normalized}`;

  // 1. Check Local (Static) Commands
  const localConflict = LOCAL_COMMANDS.find(c => c.prefix.toLowerCase() === shortcutToCompare);
  if (localConflict) {
    return { isDuplicate: true, conflictName: localConflict.label, conflictId: localConflict.id, type: 'command' };
  }

  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) {
    // Fallback logic for when storage is unavailable (e.g. dev server without extension context)
    const staticConflict = COMMANDS.find(
      c => c.prefix.toLowerCase() === shortcutToCompare && c.id !== currentCommandId,
    );
    if (staticConflict)
      return { isDuplicate: true, conflictName: staticConflict.label, conflictId: staticConflict.id, type: 'command' };
    return { isDuplicate: false };
  }

  // 2. Fetch all dynamic command mappings from storage
  const storageData = await new Promise<any>(resolve => {
    chromeAny.storage.local.get(['note_commands', 'link_commands', 'alts_commands'], resolve);
  });

  // 3. Check AI/Global Commands (alts_commands in storage, fallback to static COMMANDS)
  const altsCommands = storageData.alts_commands || COMMANDS;
  const globalConflict = altsCommands.find(
    (c: any) => c.prefix.toLowerCase() === shortcutToCompare && c.id !== currentCommandId,
  );
  if (globalConflict) {
    return { isDuplicate: true, conflictName: globalConflict.label, conflictId: globalConflict.id, type: 'command' };
  }

  // 4. Check Notes
  const noteCommands = storageData.note_commands || {};
  for (const [id, data] of Object.entries(noteCommands) as [string, any][]) {
    if (id !== currentCommandId && data.shortcut?.toLowerCase() === shortcutToCompare) {
      // Notes don't store labels in the command map, so we just return the type
      return { isDuplicate: true, conflictId: id, type: 'note' };
    }
  }

  // 5. Check Links
  const linkCommands = storageData.link_commands || {};
  for (const [id, data] of Object.entries(linkCommands) as [string, any][]) {
    if (id !== currentCommandId && data.shortcut?.toLowerCase() === shortcutToCompare) {
      return { isDuplicate: true, conflictName: data.label || 'another link', conflictId: id, type: 'link' };
    }
  }

  return { isDuplicate: false };
};
