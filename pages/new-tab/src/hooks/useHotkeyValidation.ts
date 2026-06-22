import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectAllData } from '../../../Redux/AllData/allDataSlice';
import { COMMANDS } from '../components/SearchComponents/Searchbar/commands';
import { readAllHotkeys, readAllShortcuts, extractSnippetIdFromCompoundId } from '../components/Shared/utils/hotkeyUtils';

export interface ValidationResult {
  isValid: boolean;
  conflictId: string | null;
  errorMessage: string | null;
}

export const useHotkeyValidation = () => {
  const allData = useSelector(selectAllData);
  const [extensionCommands, setExtensionCommands] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.commands?.getAll) {
      chromeAny.commands.getAll((cmds: any[]) => {
        if (mounted && cmds) {
          setExtensionCommands(cmds);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const findConflictingItemName = useCallback(
    (conflictingId: string) => {
      // 1. Check commands
      const cmd = COMMANDS.find(c => c.id === conflictingId);
      if (cmd) return cmd.label;

      if (!allData) return null;

      // 2. Check Snippets & Automations (Workspaces/Folders)
      for (const team of allData) {
        for (const workspace of team.workspaces) {
          // Check Workspace Snippets
          if (workspace.workspace_snippets) {
            for (const s of workspace.workspace_snippets) {
              const sId = s.snippet_id || s.id;
              const compound = `${workspace.workspace_id}-${sId}`;
              if (compound === conflictingId || String(sId) === conflictingId) return s.key;
            }
          }
          // Check Workspace Automations
          if (workspace.workspace_automations) {
            for (const a of workspace.workspace_automations) {
              if (String(a.id) === conflictingId) return `Automation: ${a.name}`;
            }
          }

          if (workspace.folders) {
            for (const folder of workspace.folders) {
              if (folder.folder_id === conflictingId || (folder as any).id === conflictingId) {
                return folder.folder_name;
              }
              // Check Folder Snippets
              if (folder.snippets) {
                for (const s of folder.snippets) {
                  const sId = s.snippet_id || s.id;
                  const compound = `${folder.folder_id}-${sId}`;
                  if (compound === conflictingId || String(sId) === conflictingId) return s.key;
                }
              }
              // Check Folder Automations
              if (folder.automations) {
                for (const a of folder.automations) {
                  if (String(a.id) === conflictingId) return `Automation: ${a.name}`;
                }
              }
            }
          }
        }
      }
      return null;
    },
    [allData],
  );

  const validateHotkey = useCallback(
    async (hotkeyValue: string, currentItemId: string): Promise<ValidationResult> => {
      if (!hotkeyValue) {
        return { isValid: true, conflictId: null, errorMessage: null };
      }

      // 1. Check Extension Commands
      const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
      const targetNormal = normalize(hotkeyValue);

      const conflictExtCmd = extensionCommands.find((cmd: any) => {
        if (!cmd.shortcut) return false;
        return normalize(cmd.shortcut) === targetNormal;
      });

      if (conflictExtCmd) {
        return {
          isValid: false,
          conflictId: 'extension-reserved',
          errorMessage: 'Hotkey is reserved by extension',
        };
      }

      // 2. Check for duplicates in our DB
      const allHotkeys = await readAllHotkeys();
      const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === hotkeyValue && extractSnippetIdFromCompoundId(id) !== extractSnippetIdFromCompoundId(currentItemId || ''));

      if (existingEntry) {
        const conflictingId = existingEntry[0];
        const conflictName = findConflictingItemName(conflictingId);
        const msg = conflictName
          ? `Hotkey "${hotkeyValue}" is already assigned to "${conflictName}"`
          : `Hotkey "${hotkeyValue}" is already assigned`;

        return {
          isValid: false,
          conflictId: conflictingId,
          errorMessage: msg,
        };
      }

      return { isValid: true, conflictId: null, errorMessage: null };
    },
    [extensionCommands, findConflictingItemName],
  );

  const validateShortcut = useCallback(
    async (shortcutValue: string, currentItemId: string): Promise<ValidationResult> => {
      if (!shortcutValue) {
        return { isValid: true, conflictId: null, errorMessage: null };
      }

      let normalized = shortcutValue.trim().toLowerCase();
      if (normalized && !normalized.startsWith('/')) {
        normalized = `/${normalized}`;
      }

      // Check for duplicates
      const allShortcuts = await readAllShortcuts();
      const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== extractSnippetIdFromCompoundId(currentItemId || ''));

      if (existingEntry) {
        const conflictingId = existingEntry[0];
        const conflictName = findConflictingItemName(conflictingId);
        const msg = conflictName
          ? `Shortcut "${normalized}" is already assigned to "${conflictName}"`
          : `Shortcut "${normalized}" is already assigned`;

        return {
          isValid: false,
          conflictId: conflictingId,
          errorMessage: msg,
        };
      }

      return { isValid: true, conflictId: null, errorMessage: null };
    },
    [findConflictingItemName],
  );

  return { validateHotkey, validateShortcut, findConflictingItemName };
};
