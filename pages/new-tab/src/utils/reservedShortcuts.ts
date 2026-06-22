/**
 * Reserved keyboard shortcuts that cannot be used as user-defined hotkeys.
 * These include system-level shortcuts and built-in extension functionality.
 */

export interface ReservedShortcut {
  shortcut: string;
  reason: string;
  category: 'system' | 'extension' | 'browser';
}

export const RESERVED_SHORTCUTS_MAC: ReservedShortcut[] = [
  // Extension Built-in Shortcuts
  { shortcut: 'Meta+K', reason: 'Focus search', category: 'extension' },
  { shortcut: 'Meta+Enter', reason: 'Save/Submit/Open in full screen', category: 'extension' },
  { shortcut: 'Meta+ArrowRight', reason: 'Open context menu', category: 'extension' },
  { shortcut: 'Meta+→', reason: 'Open context menu', category: 'extension' },
  { shortcut: 'Meta+Q', reason: 'Quick action', category: 'extension' },
  { shortcut: 'Meta+U', reason: 'Upload file', category: 'extension' },
  { shortcut: 'Meta+S', reason: 'Save', category: 'extension' },
  { shortcut: 'Meta+E', reason: 'Edit item', category: 'extension' },
  { shortcut: 'Meta+Shift+E', reason: 'Edit in modal', category: 'extension' },


  // Critical macOS System Shortcuts (Cannot Override)
  { shortcut: 'Meta+W', reason: 'Close window/tab', category: 'system' },
  { shortcut: 'Meta+M', reason: 'Minimize window', category: 'system' },
  { shortcut: 'Meta+H', reason: 'Hide application', category: 'system' },
  { shortcut: 'Meta+Tab', reason: 'Switch applications', category: 'system' },
  { shortcut: 'Meta+Space', reason: 'Spotlight search', category: 'system' },
  { shortcut: 'Meta+,', reason: 'Preferences', category: 'system' },

  // Common macOS Shortcuts
  { shortcut: 'Meta+C', reason: 'Copy', category: 'system' },
  { shortcut: 'Meta+V', reason: 'Paste', category: 'system' },
  { shortcut: 'Meta+X', reason: 'Cut', category: 'system' },
  { shortcut: 'Meta+Z', reason: 'Undo', category: 'system' },
  { shortcut: 'Meta+Shift+Z', reason: 'Redo', category: 'system' },
  { shortcut: 'Meta+A', reason: 'Select all', category: 'system' },
  { shortcut: 'Meta+F', reason: 'Find', category: 'system' },
  { shortcut: 'Meta+N', reason: 'New window', category: 'system' },
  { shortcut: 'Meta+P', reason: 'Print', category: 'system' },

  // Chrome-Specific Shortcuts
  { shortcut: 'Meta+L', reason: 'Focus address bar', category: 'browser' },
  { shortcut: 'Meta+T', reason: 'New tab', category: 'browser' },
  { shortcut: 'Meta+Shift+T', reason: 'Reopen closed tab', category: 'browser' },
  { shortcut: 'Meta+Shift+N', reason: 'New incognito window', category: 'browser' },
  { shortcut: 'Meta+Shift+B', reason: 'Toggle bookmarks bar', category: 'browser' },
  { shortcut: 'Meta+R', reason: 'Reload page', category: 'browser' },
  { shortcut: 'Meta+Shift+R', reason: 'Hard reload', category: 'browser' },
  { shortcut: 'Meta+[', reason: 'Navigate back', category: 'browser' },
  { shortcut: 'Meta+]', reason: 'Navigate forward', category: 'browser' },
  { shortcut: 'Meta+1', reason: 'Switch to tab 1', category: 'browser' },
  { shortcut: 'Meta+2', reason: 'Switch to tab 2', category: 'browser' },
  { shortcut: 'Meta+3', reason: 'Switch to tab 3', category: 'browser' },
  { shortcut: 'Meta+4', reason: 'Switch to tab 4', category: 'browser' },
  { shortcut: 'Meta+5', reason: 'Switch to tab 5', category: 'browser' },
  { shortcut: 'Meta+6', reason: 'Switch to tab 6', category: 'browser' },
  { shortcut: 'Meta+7', reason: 'Switch to tab 7', category: 'browser' },
  { shortcut: 'Meta+8', reason: 'Switch to tab 8', category: 'browser' },
  { shortcut: 'Meta+9', reason: 'Switch to last tab', category: 'browser' },

  // Control-based shortcuts on Mac (also reserved)
  { shortcut: 'Ctrl+K', reason: 'Focus search (alternative)', category: 'extension' },
  { shortcut: 'Ctrl+Enter', reason: 'Save/Submit (alternative)', category: 'extension' },
  { shortcut: 'Ctrl+ArrowRight', reason: 'Open context menu (alternative)', category: 'extension' },
  { shortcut: 'Ctrl+→', reason: 'Open context menu (alternative)', category: 'extension' },
];

export const RESERVED_SHORTCUTS_WINDOWS: ReservedShortcut[] = [
  // Extension Built-in Shortcuts
  {
    shortcut: 'Alt+S',
    reason: 'This shortcut is reserved for faster access to extension commands.',
    category: 'extension',
  },
  {
    shortcut: 'Alt+E',
    reason: 'This shortcut is reserved for editing items within the extension.',
    category: 'extension',
  },
  {
    shortcut: 'Alt+Shift+E',
    reason: 'This shortcut is reserved for editing items in the extension modal.',
    category: 'extension',
  },

  {
    shortcut: 'Ctrl+K',
    reason: 'This shortcut is reserved for browser search bar access or extension search.',
    category: 'extension',
  },

  // Common Windows Browser Shortcuts (Cannot Override effectively)
  {
    shortcut: 'Ctrl+T',
    reason: 'This shortcut is reserved by your browser for opening a new tab.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+W',
    reason: 'This shortcut is reserved by your browser for closing the current tab.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+N',
    reason: 'This shortcut is reserved by your browser for opening a new window.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+Shift+N',
    reason: 'This shortcut is reserved by your browser for opening a new incognito window.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+Shift+T',
    reason: 'This shortcut is reserved by your browser for re-opening the last closed tab.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+F',
    reason: 'This shortcut is reserved by your browser for finding text on the page.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+G',
    reason: 'This shortcut is reserved by your browser for finding the next match on the page.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+H',
    reason: 'This shortcut is reserved by your browser for opening browsing history.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+J',
    reason: 'This shortcut is reserved by your browser for opening the downloads folder.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+L',
    reason: 'This shortcut is reserved by your browser for focusing the address bar.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+P',
    reason: 'This shortcut is reserved by your browser for printing the current page.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+R',
    reason: 'This shortcut is reserved by your browser for reloading the current page.',
    category: 'browser',
  },
  {
    shortcut: 'Ctrl+S',
    reason: 'This shortcut is reserved by your browser for saving the current page.',
    category: 'browser',
  },

  // System/Standard Shortcuts
  { shortcut: 'Ctrl+C', reason: 'This shortcut is reserved for copying selected content.', category: 'system' },
  {
    shortcut: 'Ctrl+V',
    reason: 'This shortcut is reserved for pasting content from your clipboard.',
    category: 'system',
  },
  { shortcut: 'Ctrl+X', reason: 'This shortcut is reserved for cutting selected content.', category: 'system' },
  { shortcut: 'Ctrl+Z', reason: 'This shortcut is reserved for undoing your last action.', category: 'system' },
  { shortcut: 'Ctrl+Y', reason: 'This shortcut is reserved for re-doing your last action.', category: 'system' },
  { shortcut: 'Ctrl+A', reason: 'This shortcut is reserved for selecting all content.', category: 'system' },
  { shortcut: 'Ctrl+Tab', reason: 'This shortcut is reserved for switching between browser tabs.', category: 'system' },
  {
    shortcut: 'Ctrl+Shift+Tab',
    reason: 'This shortcut is reserved for switching back through browser tabs.',
    category: 'system',
  },
];

/**
 * Check if a shortcut is reserved and cannot be used as a user-defined hotkey.
 * @param shortcut - The shortcut string (e.g., "Meta+K", "Ctrl+Enter")
 * @param isMac - Whether the user is on macOS
 * @returns Object with isReserved flag and reason if reserved
 */
export const checkReservedShortcut = (
  shortcut: string,
  isMac: boolean,
): { isReserved: boolean; reason?: string; category?: string } => {
  const reserved = isMac ? RESERVED_SHORTCUTS_MAC : RESERVED_SHORTCUTS_WINDOWS;
  const found = reserved.find(r => r.shortcut === shortcut);

  if (found) {
    return {
      isReserved: true,
      reason: found.reason,
      category: found.category,
    };
  }

  return { isReserved: false };
};

/**
 * Get all reserved shortcuts for display purposes.
 * @param isMac - Whether the user is on macOS
 * @returns Array of reserved shortcuts
 */
export const getReservedShortcuts = (isMac: boolean): ReservedShortcut[] => {
  return isMac ? RESERVED_SHORTCUTS_MAC : RESERVED_SHORTCUTS_WINDOWS;
};

/**
 * Get reserved shortcuts grouped by category.
 * @param isMac - Whether the user is on macOS
 * @returns Object with shortcuts grouped by category
 */
export const getReservedShortcutsByCategory = (isMac: boolean): Record<string, ReservedShortcut[]> => {
  const shortcuts = getReservedShortcuts(isMac);
  return shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, ReservedShortcut[]>,
  );
};
