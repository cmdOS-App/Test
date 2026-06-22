import { COMMANDS } from '../components/SearchComponents/Searchbar/commands';
import { LOCAL_COMMANDS } from '../components/SearchComponents/Searchbar/localCommands';
import { updateHotkeyAndRefresh, updateCommandAndRefresh } from '../../../Apis/features/userCommandsApiService';
import { updateSnippetHotkey, updateSnippetShortcut } from '../../../Apis/features/snippetApi';
import { extractSnippetIdFromCompoundId } from '../components/Shared/utils/hotkeyUtils';
import { updateLocalHotkey, updateLocalShortcut } from '../../../utils/shortcutHotkeyUtils';
import { useLocalCommandCustomizations } from './useLocalCommandCustomizations';

export function useHotkeyOverwrite() {
  const { saveCustomization } = useLocalCommandCustomizations();

  const clearConflictHotkey = async (conflictId: string) => {
    const isCommand = COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId);

    if (isCommand) {
      const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
      if (isLocal) {
        await saveCustomization({ command_id: conflictId, hotkey: '' });
      } else {
        try {
          await updateHotkeyAndRefresh(conflictId, '');
        } catch (e) {
          console.warn('Cloud clear hotkey failed', e);
        }
      }
      await updateLocalHotkey(conflictId, '', 'command');
    } else {
      const sId = extractSnippetIdFromCompoundId(conflictId);
      try {
        await updateSnippetHotkey(sId, '');
      } catch (e) {
        console.warn('Cloud clear snippet hotkey failed', e);
      }
      await updateLocalHotkey(conflictId, '', 'note');
      await updateLocalHotkey(conflictId, '', 'link');
    }
  };

  const clearConflictShortcut = async (conflictId: string) => {
    const isCommand = COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId);

    if (isCommand) {
      const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
      if (isLocal) {
        await saveCustomization({ command_id: conflictId, prefix: '' });
      } else {
        try {
          await updateCommandAndRefresh(conflictId, { prefix: '' });
        } catch (e) {
          console.warn('Cloud clear command shortcut failed', e);
        }
      }
    } else {
      const sId = extractSnippetIdFromCompoundId(conflictId);
      try {
        await updateSnippetShortcut(sId, '');
      } catch (e) {
        console.warn('Cloud clear snippet shortcut failed', e);
      }
      await updateLocalShortcut(conflictId, sId, '', '', 'note');
      await updateLocalShortcut(conflictId, sId, '', '', 'link');
    }
  };

  return { clearConflictHotkey, clearConflictShortcut };
}
