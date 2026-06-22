import React, { useState, useCallback } from 'react';
import { checkReservedShortcut } from '../utils/reservedShortcuts';

export interface HotkeyState {
  value: string;
  isMac: boolean;
}

export type HotkeyResult = string | 'CANCEL' | null;

/**
 * Unified hook for capturing and formatting hotkey combinations.
 * Standardizes the "Alt + [Key]" pattern used throughout the app.
 * Validates against reserved system and extension shortcuts.
 */
export const useHotkeyAssignment = (initialHotkey: string = '', isMac: boolean = false) => {
  const [hotkey, setHotkey] = useState<string>(initialHotkey);

  const captureHotkey = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent): HotkeyResult => {
      e.preventDefault();
      e.stopPropagation();

      const reactEvent = e as React.KeyboardEvent;
      if (reactEvent.nativeEvent) {
        reactEvent.nativeEvent.stopImmediatePropagation();
        reactEvent.nativeEvent.stopPropagation();
      }

      // Ignore pure modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;

      if (e.key === 'Escape') {
        return 'CANCEL';
      }

      const parts: string[] = [];

      if (isMac) {
        // Mac Logic: Align with App.tsx mapping (Meta and Ctrl both map to "Ctrl")
        if (e.ctrlKey || e.metaKey) {
          parts.push('Ctrl');
        } else {
          // Default to Ctrl (which maps to Cmd/Meta in assignment UX)
          parts.push('Ctrl');
        }
        if (e.shiftKey) parts.push('Shift');
      } else {
        // Windows/Linux Logic: Support Ctrl, Alt, or both
        // Match App.tsx order: Ctrl > Alt > Shift
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');

        // If no modifiers, default to Alt (legacy consistency)
        // BUT: Ignore navigation keys so they don't capture during grid movement
        const isNavKey = [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Home',
          'End',
          'PageUp',
          'PageDown',
        ].includes(e.key);
        if (!e.ctrlKey && !e.altKey && !isNavKey) {
          parts.push('Alt');
        }

        if (e.shiftKey) parts.push('Shift');
      }

      const isNavKey = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ].includes(e.key);
      if (isNavKey && !e.ctrlKey && !e.altKey && !e.metaKey) return null;

      let keyName = e.key;
      if (keyName === ' ') {
        keyName = 'Space';
      } else if (keyName.length === 1) {
        keyName = keyName.toUpperCase();
      } else {
        // Format arrow keys and other special symbols
        const symbolMap: Record<string, string> = {
          ArrowUp: '↑',
          ArrowDown: '↓',
          ArrowLeft: '←',
          ArrowRight: '→',
        };
        keyName = symbolMap[keyName] || keyName;
      }

      parts.push(keyName);

      // We restrict to max 3 parts (Modifier + Shift + Key) usually
      // But Mac might have Meta+Ctrl+Shift+Key -> 4 parts.
      // Let's allow up to 4 for now.
      if (parts.length > 4) return null;

      const newValue = parts.join('+');

      setHotkey(newValue);
      return newValue;
    },
    [isMac],
  );

  const resetHotkey = useCallback((newInitialValue: string = '') => {
    setHotkey(newInitialValue);
  }, []);

  return {
    hotkey,
    setHotkey,
    captureHotkey,
    resetHotkey,
  };
};
