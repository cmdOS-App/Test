import { deleteFavorite } from '../../../../Apis/services/favoritesApi';
import { editTodo, updateSnippetRealtime, convertSnippetToTodo } from '../../../../Apis/features/snippetApi';
import { format } from 'date-fns';
import type { Snippet, FavoriteCommand, NewSnippetBreadCrum } from '../../../../modals/interfaces';
import { FaTerminal, FaCheck, FaTimes } from 'react-icons/fa';
import CmdIcon from '../Shared/Icons/CmdIcon';
import { useSnippetItem } from '@src/hooks/useSnippetItem';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { AI_GROUP, COMMANDS } from '../SearchComponents/Searchbar/commands';

import { FiTrash2, FiPlay, FiExternalLink, FiZap, FiZapOff, FiLoader, FiList, FiCheck } from 'react-icons/fi';
import { BsKeyboard, BsPencilFill } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { useDispatch, useSelector } from 'react-redux';
import { VisualKeyDisplay } from '../Shared/VisualKeyDisplay';
import type { MenuAction } from '../Shared/UnifiedContextMenu';
import { UnifiedContextMenu } from '../Shared/UnifiedContextMenu';
import { FavoritesContextMenu } from './FavoritesContextMenu';
import AutomationDynamicIcon from '../Shared/Icons/AutomationDynamicIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import {
  queueNotification,
  clearEditorStates,
  setCommandStatus,
  resetCommandStatus,
  selectIsMac,
  setIsCommandListView,
  setHighlightedCommandId,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  setIsCreatingNewItem,
  selectDarkMode,
  setShowTodosView,
  setTodoCreatePrefill,
  selectSelectedTeam,
} from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import {
  getItemCompoundId,
  readAllHotkeys,
  readAllShortcuts,
  extractSnippetIdFromCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { updateSnippetShortcut, updateSnippetHotkey } from '../../../../Apis/features/snippetApi';
import { updateLocalShortcut, updateLocalHotkey } from '../../../../utils/shortcutHotkeyUtils';
import { updateCommandAndRefresh, updateHotkeyAndRefresh } from '../../../../Apis/features/userCommandsApiService';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import { useLocalCommandCustomizations } from '../../hooks/useLocalCommandCustomizations';
import { LOCAL_COMMANDS } from '../SearchComponents/Searchbar/localCommands';

import {
  isLinkCategory as isOfficialLinkCategory,
  isTabGroupCategory as isOfficialTabGroupCategory,
  isNoteCategory as isOfficialNoteCategory,
  resolveNodeAction,
} from '../Views/HomeView/snippetInteractiveUtils';

const HotkeyBadge: React.FC<{ hotkey: string; isDarkMode: boolean }> = ({ hotkey, isDarkMode }) => {
  const isMac = useSelector(selectIsMac);
  if (!hotkey) return null;

  const parts = hotkey.split('+').map(p => p.trim());
  return (
    <span className="flex items-center gap-0.5 opacity-80 scale-90 origin-left">
      {parts.map((part, i) => {
        let display = part;
        if (isMac) {
          if (part.toLowerCase() === 'alt') display = '⌥';
        }

        return (
          <React.Fragment key={i}>
            <span
              className={`px-1.5 py-0.5 rounded font-medium text-[10px] min-w-[1.2rem] text-center shadow-sm ${
                isDarkMode ? 'bg-neutral-800/80 text-neutral-400' : 'bg-[#eee8d5] text-[#586e75]'
              }`}>
              {display}
            </span>
            {i < parts.length - 1 && <span className="text-[10px] text-neutral-400">+</span>}
          </React.Fragment>
        );
      })}
    </span>
  );
};

const chromeAny = chrome as any;

const isLikelySavedAgentFavorite = (item: any): boolean => {
  if (!item) return false;

  if (item.category === 'agent' || item.section === 'Chat Agents') return true;

  const steps = item.automation_steps || item.steps || item.automation?.steps || [];
  if (!Array.isArray(steps)) return false;

  return steps.some((step: any) => {
    const moduleId = String(step?.moduleId || step?.module_id || step?.module || step?.type || '').toLowerCase();
    return moduleId === 'agent';
  });
};

interface FavoriteItemProps {
  userId: string;
  snippet: Snippet | FavoriteCommand | any; // Accept both types
  workspace: any;
  folder: any;
  reload: () => void;
  selectedItem: string | null;
  selectedTeamId: string;
  favoritesMapping: { [teamId: string]: (Snippet | any)[] };
  setFavoritesMapping: (data: { [teamId: string]: (Snippet | any)[] }) => void;
  index: number;
  onCommandSelect?: (id: string) => void;
  onSelectSavedAgent?: (agent: any) => void;
  onAutomationSelect?: (automation: any) => void;
  hotkeysMap?: Record<string, string>;
  onHotkeyChange?: (id: string, hotkey: string, type: 'command' | 'link' | 'note') => void;
  onOpenUrls?: (urls: string[], title?: string) => void;
  onNavigateToListView?: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  onRequestEditLink?: (suggestion: { snippet: Snippet; workspace: any; folder: any }) => void;
  isReordering?: boolean;
  extensionCommands?: any[];
  setHotkeysMap?: (map: Record<string, string>) => void;
  setShortcutsMap?: (map: Record<string, string>) => void;
  shortcutsMap?: Record<string, string>;
  isDarkMode: boolean;
  onHoverItem?: (item: Snippet | null, element: HTMLElement | null) => void;
  overrideIcon?: React.ReactNode;
  onSnippetSelect?: (snippet: Snippet, workspace: any, folder: any) => void;
}

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

// Component for rendering Command Favorites
const CommandFavoriteItem: React.FC<FavoriteItemProps & { command: FavoriteCommand }> = ({
  userId, // Destructure userId
  command,
  overrideIcon,
  selectedItem,
  onCommandSelect,
  onSelectSavedAgent,
  onAutomationSelect,
  hotkeysMap,
  favoritesMapping,
  setFavoritesMapping,
  selectedTeamId,
  onNavigateToListView,
  isReordering,
  extensionCommands,
  setHotkeysMap,
  setShortcutsMap,
  shortcutsMap,
  isDarkMode,
  reload,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const dispatch = useDispatch();
  const selectedTeam = useSelector(selectSelectedTeam);
  const allData = useSelector(selectAllData);
  const isMac = useSelector(selectIsMac);
  const { customizations, saveCustomization } = useLocalCommandCustomizations();
  const { captureHotkey } = useHotkeyAssignment(editValue, isMac);

  const [existingTodo, setExistingTodo] = useState<any>(null);

  useEffect(() => {
    if (contextMenu) {
      chrome.storage.local.get(['local_todos', 'cached_todos'], result => {
        const allTodos = [...(result.local_todos || []), ...(result.cached_todos || [])];
        const currentId = command.id;
        const match = allTodos.find(t => {
          const tSid = String(t.snippet_id);
          return tSid === `cmd-${currentId}` || tSid === `lcmd-${currentId}` || tSid === currentId;
        });
        setExistingTodo(match || null);
      });
    } else {
      setExistingTodo(null);
    }
  }, [contextMenu, command.id]);

  const handleSaveTodoDirectly = async (todoData: {
    title: string;
    description: string;
    date: string;
    time: string;
    isRecurring: boolean;
    recurringCycle: 'daily' | 'weekly' | 'monthly' | null;
    isAnytime: boolean;
  }) => {
    const chromeAny = (window as any).chrome;
    try {
      let deadline = '';
      if (!todoData.isAnytime && todoData.date) {
        const [year, month, day] = todoData.date.split('-').map(Number);
        const [hour, min] = todoData.time ? todoData.time.split(':').map(Number) : [23, 59];
        const dt = new Date(year, month - 1, day, hour, min);
        if (!isNaN(dt.getTime())) deadline = dt.toISOString();
      } else {
        deadline = new Date().toISOString();
      }

      const itemCategory = 'command';
      const targetId = command.id;

      if (existingTodo) {
        const sid = String(existingTodo.snippet_id);
        const result = await new Promise<any>(resolve => chrome.storage.local.get(['local_todos'], resolve));
        const localTodos = result.local_todos || [];
        const updated = localTodos.map((t: any) =>
          String(t.snippet_id) === sid
            ? {
                ...t,
                key: todoData.title,
                title: todoData.title,
                value: todoData.description,
                event_deadline: deadline,
                is_recurring: todoData.isRecurring,
                recurring_cycle: todoData.isRecurring ? todoData.recurringCycle : null,
                is_anytime: todoData.isAnytime,
              }
            : t,
        );
        await new Promise<void>(resolve => chrome.storage.local.set({ local_todos: updated }, resolve));

        const bestTodoId = existingTodo.todo_id;
        const isNumeric =
          typeof bestTodoId === 'number' ||
          (typeof bestTodoId === 'string' && !isNaN(Number(bestTodoId)) && !bestTodoId.includes('-'));
        if (isNumeric) {
          await editTodo(
            bestTodoId,
            deadline,
            todoData.isRecurring ? todoData.recurringCycle || undefined : undefined,
            todoData.title,
            todoData.description,
            todoData.isRecurring,
            existingTodo.is_done,
          );
        } else {
          await updateSnippetRealtime({
            snippet_id: sid,
            key: todoData.title,
            value: todoData.description,
            event_deadline: deadline,
            is_recurring: todoData.isRecurring,
            recurring_cycle: todoData.isRecurring ? todoData.recurringCycle : null,
            is_done: existingTodo.is_done,
          });
        }

        if (!todoData.isAnytime && deadline && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(bestTodoId || sid),
            deadline: deadline,
            is_anytime: todoData.isAnytime,
          });
        }
      } else {
        const commandId = command.id;
        const isLocal = LOCAL_COMMANDS.some(lc => String(lc.id).toLowerCase() === String(commandId).toLowerCase());
        const computedSnippetId = isLocal ? `lcmd-${commandId}` : `cmd-${commandId}`;
        const rawId =
          String(commandId).includes('-') &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(commandId))
            ? String(commandId).split('-').slice(1).join('-')
            : commandId;

        const optimisticTask: any = {
          snippet_id: computedSnippetId,
          id: computedSnippetId,
          key: todoData.title,
          title: todoData.title,
          value: command.id || todoData.description,
          category: 'command',
          is_todo_type: true,
          event_deadline: deadline,
          is_done: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          folder_id: '',
          workspace_id: null,
          is_recurring: todoData.isRecurring,
          recurring_cycle: todoData.isRecurring ? todoData.recurringCycle : null,
          is_anytime: todoData.isAnytime,
        };

        const storageResult = await new Promise<any>(resolve => chrome.storage.local.get(['local_todos'], resolve));
        const localTodos = storageResult.local_todos || [];
        const updatedLocal = [
          optimisticTask,
          ...localTodos.filter((t: any) => String(t.snippet_id || t.id) !== computedSnippetId),
        ];
        await new Promise<void>(resolve => chrome.storage.local.set({ local_todos: updatedLocal }, resolve));

        const target = { command_id: rawId };

        const convertRes = await convertSnippetToTodo(
          target,
          deadline || '',
          todoData.isRecurring,
          todoData.isRecurring ? todoData.recurringCycle || undefined : undefined,
          todoData.title,
        );

        const todoId =
          convertRes?.todo_id ||
          convertRes?.snippet?.todo_id ||
          convertRes?.snippet?.id ||
          convertRes?.snippet?.snippet_id ||
          convertRes?.todo?.todo_id ||
          convertRes?.todo?.id;

        const freshResult = await new Promise<any>(resolve => chrome.storage.local.get(['local_todos'], resolve));
        const freshTodos = (freshResult.local_todos || []).map((t: any) =>
          String(t.snippet_id || t.id) === computedSnippetId
            ? {
                ...t,
                todo_id: todoId,
              }
            : t,
        );
        await new Promise<void>(resolve => chrome.storage.local.set({ local_todos: freshTodos }, resolve));

        if (!todoData.isAnytime && deadline && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(todoId || computedSnippetId),
            deadline: deadline,
            is_anytime: todoData.isAnytime,
          });
        }
      }

      dispatch(
        queueNotification({
          message: existingTodo ? 'Task updated successfully' : 'Task created successfully',
          type: 'success',
        }),
      );
      reload();
    } catch (e: any) {
      console.error('Failed to save todo:', e);
      dispatch(queueNotification({ message: 'Failed to save todo task', type: 'error' }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      setErrorMessage('');
      setConflictId(null);

      if (!editValue) return;

      if (isEditing) {
        const allHotkeys = await readAllHotkeys();
        const currentSnippetId = extractSnippetIdFromCompoundId(command.id || '');
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === editValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${editValue}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
            : `Hotkey "${editValue}" is already assigned`;
          setErrorMessage(msg);
          setConflictId(conflictingId);
        }
      } else if (isEditingShortcut) {
        let normalized = editValue.trim();
        if (normalized && !normalized.startsWith('/')) {
          normalized = `/${normalized}`;
        }
        if (normalized) {
          const allShortcuts = await readAllShortcuts();
          const currentSnippetId = extractSnippetIdFromCompoundId(command.id || '');
          const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Shortcut "${normalized}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
              : `Shortcut "${normalized}" is already assigned`;
            setErrorMessage(msg);
            setConflictId(conflictingId);
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editValue, isEditing, isEditingShortcut, allData]);

  // Helper to find item name by ID
  const findConflictingItemName = (conflictingId: string): { name: string; type: string } | null => {
    const cmd = COMMANDS.find(c => c.id === conflictingId);
    if (cmd) return { name: cmd.label, type: 'COMMAND' };

    if (!allData) return null;

    for (const team of allData) {
      for (const workspace of team.workspaces) {
        if (workspace.workspace_snippets) {
          for (const s of workspace.workspace_snippets) {
            const sId = s.snippet_id || s.id;
            const compound = `${workspace.workspace_id}-${sId}`;
            if (compound === conflictingId || String(sId) === conflictingId) {
              const type = (s.category || 'NOTE').toUpperCase();
              return { name: s.key, type };
            }
          }
        }
        if (workspace.folders) {
          for (const folder of workspace.folders) {
            if (folder.snippets) {
              for (const s of folder.snippets) {
                const sId = s.snippet_id || s.id;
                const compound = `${folder.folder_id}-${sId}`;
                if (compound === conflictingId || String(sId) === conflictingId) {
                  const type = (s.category || 'NOTE').toUpperCase();
                  return { name: s.key, type };
                }
              }
            }
          }
        }
      }
    }
    return null;
  };

  const custom = customizations[command.id];
  const hotkey = (custom?.hotkey ?? hotkeysMap?.[command.id]) || '';
  const shortcut = (custom?.prefix ?? shortcutsMap?.[command.id]) || '';

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReordering) return;
    setEditValue(hotkey || '');
    setIsUpdating(!!hotkey);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
    setIsEditing(true); // Modes switch
  };

  const handleSaveHotkey = async (newValue: string) => {
    if (!newValue) {
      setIsEditing(false);
      return;
    }

    // Check for duplicates
    const allHotkeys = await readAllHotkeys();
    // Check if hotkey is used by another item (not this one)
    const currentSnippetId = extractSnippetIdFromCompoundId(command.id || '');
    const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === newValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Hotkey "${newValue}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Hotkey "${newValue}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      dispatch(queueNotification({ message: msg, type: 'error' }));
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    // Save to cloud first
    try {
      const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === command.id);

      if (isLocalCommand) {
        await saveCustomization({ command_id: command.id, hotkey: newValue });
        // Also save to local storage for backward compatibility
        await updateLocalHotkey(command.id, newValue, 'command');
      } else {
        await updateHotkeyAndRefresh(command.id, newValue);
        // updateHotkeyAndRefresh already refreshes alts_commands,
        // but we might need to sync to alts_command_hotkeys if that's what's expected
        await updateLocalHotkey(command.id, newValue, 'command');
      }

      const actionText = isUpdating ? 'updated' : 'saved';
      dispatch(setCommandStatus({ status: 'success', message: `Hotkey ${actionText} successfully` }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);

      // Refresh maps
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap?.(allHotkeys);
      setShortcutsMap?.(allShortcuts);

      setShowSuccess(newValue);
    } catch (error: any) {
      console.error('Failed to save command hotkey to cloud:', error);
      // Fallback to chrome storage
      chromeAny.storage.local.get(['alts_command_hotkeys'], (res: any) => {
        const existing = res.alts_command_hotkeys || {};
        existing[command.id] = newValue;
        chromeAny.storage.local.set({ alts_command_hotkeys: existing }, () => {
          const actionText = isUpdating ? 'updated' : 'saved';
          dispatch(
            setCommandStatus({ status: 'success', message: `Hotkey ${actionText} locally (cloud sync failed)` }),
          );
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          setShowSuccess(newValue);
        });
      });
    } finally {
      // Short delay to show success state before closing
      await new Promise(r => setTimeout(r, 1000));
      setIsSaving(false);
      setIsEditing(false);
      setContextMenu(null);
      setShowSuccess(null);
    }
  };

  const handleOverwriteHotkey = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing hotkey...');

    try {
      // 1. Clear existing
      const isCommand = COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId);
      if (isCommand) {
        const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
        if (isLocal) {
          await saveCustomization({ command_id: conflictId, hotkey: '' });
        } else {
          try {
            await updateHotkeyAndRefresh(conflictId, '');
          } catch (e) {
            console.warn('Cloud clear command hotkey failed', e);
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

      // 2. Save new
      await handleSaveHotkey(editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleSaveShortcut = async (value: string) => {
    let normalized = value.trim();
    if (normalized && !normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized) {
      setIsEditingShortcut(false);
      return;
    }

    // Check for duplicates
    const allShortcuts = await readAllShortcuts();
    const currentSnippetId = extractSnippetIdFromCompoundId(command.id || '');
    const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Shortcut "${normalized}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Shortcut "${normalized}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      dispatch(queueNotification({ message: msg, type: 'error' }));
      return;
    }

    setIsSaving(true);
    dispatch(setCommandStatus({ status: 'loading', message: 'Saving shortcut...' }));

    try {
      const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === command.id);

      if (isLocalCommand) {
        await saveCustomization({ command_id: command.id, prefix: normalized });
      } else {
        await updateCommandAndRefresh(command.id, { prefix: normalized });
      }

      // For commands, shortcuts are typically stored in alts_commands or alts_local_command_customizations.
      // If we need to sync to link_commands or note_commands for some reason, we would do it here.

      dispatch(setCommandStatus({ status: 'success', message: 'Shortcut saved successfully' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);

      // Refresh maps
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap?.(allHotkeys);
      setShortcutsMap?.(allShortcuts);

      setShowSuccess(normalized);
    } catch (error: any) {
      console.error('Failed to save command shortcut:', error);
      dispatch(setCommandStatus({ status: 'error', message: `Failed to save: ${error.message || 'Unknown error'}` }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);
    } finally {
      // Short delay to show success state before closing
      await new Promise(r => setTimeout(r, 1000));
      setIsSaving(false);
      setIsEditingShortcut(false);
      setContextMenu(null);
      setShowSuccess(null);
    }
  };

  const handleOverwriteShortcut = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing shortcut...');

    try {
      // 1. Clear existing
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

      // 2. Save new
      await handleSaveShortcut(editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleHotkeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const result = captureHotkey(e);
    if (result === 'CANCEL') {
      setIsEditing(false);
      setErrorMessage('');
    } else if (result) {
      setEditValue(result);
      setErrorMessage('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClearHotkey = async () => {
    if (!hotkey) return;
    dispatch(setCommandStatus({ status: 'loading', message: 'Clearing hotkey...' }));
    setIsSaving(true);

    try {
      const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === command.id);
      if (isLocalCommand) {
        await saveCustomization({ command_id: command.id, hotkey: '' });
      } else {
        await updateHotkeyAndRefresh(command.id, '');
      }

      // Robust local cleanup
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        const keysToClean = ['alts_link_hotkeys', 'alts_note_hotkeys', 'alts_command_hotkeys'];
        chromeAny.storage.local.get([...keysToClean, 'alts_commands'], (res: any) => {
          const updates: any = {};
          const altsCommands = res.alts_commands || [];
          let commandsChanged = false;

          keysToClean.forEach(key => {
            const map = res[key] || {};
            if (map[command.id]) {
              delete map[command.id];
              updates[key] = map;
            }
          });

          if (Array.isArray(altsCommands)) {
            altsCommands.forEach((cmd: any) => {
              if (cmd.id === command.id) {
                if (cmd.hotkey) {
                  delete cmd.hotkey;
                  commandsChanged = true;
                }
              }
            });
          }
          if (commandsChanged) updates.alts_commands = altsCommands;
          if (Object.keys(updates).length > 0) {
            chromeAny.storage.local.set(updates);
          }
        });
      }

      dispatch(setCommandStatus({ status: 'success', message: 'Hotkey cleared successfully' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);

      // Refresh maps
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap?.(allHotkeys);
      setShortcutsMap?.(allShortcuts);
    } catch (error) {
      console.error('Failed to clear command hotkey:', error);
      dispatch(setCommandStatus({ status: 'error', message: 'Failed to clear hotkey' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFavorite = () => {
    const currentList = favoritesMapping[userId] || [];
    const newList = currentList.filter(item => item.id !== command.id);
    setFavoritesMapping({ ...favoritesMapping, [userId]: newList });
    chromeAny.storage.local.get('myFavouriteItems', (result: any) => {
      const favItems = result.myFavouriteItems || {};
      favItems[userId] = newList;
      chromeAny.storage.local.set({ myFavouriteItems: favItems });
    });
    if ((command as any).favourite_id) {
      deleteFavorite(userId, (command as any).favourite_id).catch((err: any) => {
        console.error('Failed to delete command favorite:', err);
      });
    }
  };

  const menuActions: MenuAction[] = [
    {
      key: 'assign-shortcut',
      label: shortcut ? `Assign a Text Command (${shortcut})` : 'Assign a Text Command',
      icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,

      className: 'text-neutral-700 dark:text-neutral-300 ',
      onSelect: () => {
        // Pre-fill existing prefix if any
        const existingPrefix = (command as any).commandPrefix || '';
        setEditValue(existingPrefix.replace(/^\//, ''));
        setIsEditingShortcut(true);
        setIsEditing(false);
        setIsUpdating(!!existingPrefix);
      },
    },
    {
      key: 'assign-hotkey',
      label: hotkey ? `Assign a Keyboard Shortcut (${hotkey})` : 'Assign a Keyboard Shortcut',
      icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
      className: 'text-neutral-700 dark:text-neutral-300 ',
      onSelect: () => {
        setEditValue(hotkey || '');
        setIsEditing(true);
        setIsEditingShortcut(false);
      },
    },

    { key: 'div-1', label: '', icon: null, onSelect: () => {}, divider: true },

    {
      key: 'remove',
      label: 'Remove from Favorites',
      icon: <FiTrash2 size={14} />,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
      onSelect: handleRemoveFavorite,
    },
  ];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        whileDrag={{
          backgroundColor: isDarkMode ? 'rgb(26, 26, 26)' : '#fdf6e3',
          boxShadow: '0 8px 30px rgb(0,0,0,0.12)',
          zIndex: 50,
        }}
        transition={{ duration: 0.2 }}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isEditing && !isReordering) {
            if (onCommandSelect) {
              onCommandSelect(command.id);
            }
          }
        }}
        onContextMenu={handleContextMenu}
        title={command.label}
        className={`group relative cursor-pointer px-1 py-[0.5px] bg-transparent ${selectedItem === command.id ? (isDarkMode ? 'bg-white/5' : 'bg-black/5') : ''}`}>
        <div className="flex items-center gap-1.5 h-[29px] overflow-hidden relative">
          {/* Icon - First */}
          <div
            className={`flex items-center justify-start flex-shrink-0 w-8 overflow-hidden transition-opacity duration-150 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {overrideIcon ? (
              <div className="w-[18px] h-[18px] flex items-center justify-center">{overrideIcon}</div>
            ) : command.id === 'createnotes' || command.id === 'createlinks' ? (
              <div className="h-5 w-5 flex items-center justify-start text-[11px] font-semibold text-neutral-500">
                {command.id === 'createnotes' ? 'N' : 'L'}
              </div>
            ) : command.id === 'ai' ? (
              <div className="flex -space-x-1.5 items-center justify-start">
                {AI_GROUP.members.slice(0, 4).map((id, idx) => {
                  const cmd = COMMANDS.find(c => c.id === id);
                  if (!cmd) return null;
                  return (
                    <div key={id} className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white dark:border-neutral-800 bg-white shadow-sm flex-shrink-0 relative" style={{ zIndex: 4 - idx }}>
                      <img
                        src={getFaviconUrl(cmd.iconHost)}
                        alt={cmd.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            ) : command.category === 'automation' || command.category === 'agent' || command.automation ? (
              <AutomationDynamicIcon automation={command.automation || command} size={16} />
            ) : command.iconHost ? (
              <img src={getFaviconUrl(command.iconHost)} alt="" className="w-4 h-5 rounded scale-[0.8]" />
            ) : (
              <div className="w-8 h-4 flex items-center justify-start scale-[0.35] origin-center">
                <CmdIcon />
              </div>
            )}
          </div>

          {/* Name - Second */}
          <div className="flex-1 min-w-0 min-h-0 h-full relative flex items-center overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {/* Full Title (Visible by default, hidden on hover) */}
              <span
                className={`text-[12.5px] font-medium whitespace-nowrap truncate inline-block transition-colors duration-150 group-hover:hidden ${
                  selectedItem === command.id
                    ? !isDarkMode
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDarkMode
                      ? 'text-neutral-500 group-hover:text-neutral-900'
                      : 'text-neutral-400 group-hover:text-neutral-200'
                }`}
                style={headingFontStyle}>
                {command.label.length > 18 ? command.label.substring(0, 18) + '...' : command.label}
              </span>

              {/* Truncated Title (Hidden by default, visible on hover) */}
              <span
                className={`text-[12.5px] font-medium whitespace-nowrap truncate hidden group-hover:inline-block flex-shrink transition-colors duration-150 ${
                  selectedItem === command.id
                    ? !isDarkMode
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDarkMode
                      ? 'text-neutral-500'
                      : 'text-neutral-200'
                }`}
                style={headingFontStyle}>
                {command.label.length > 12 ? command.label.substring(0, 12) + '...' : command.label}
              </span>
              <span className={`text-[10px] ml-1 flex-shrink-0 hidden group-hover:inline-block transition-opacity duration-150 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                • Command
              </span>
            </div>
          </div>

          {/* Hotkey - Last */}
          <div
            onClick={handleStartEdit}
            className={`flex-shrink-0 w-auto max-w-[120px] text-right pr-2 text-[10px] font-mono font-semibold transition-colors duration-150 ${
              !isDarkMode ? 'text-neutral-400 hover:text-neutral-900' : 'text-neutral-500 hover:text-neutral-200'
            } cursor-pointer`}
            title={hotkey ? `Hotkey: ${hotkey}` : 'Click to edit hotkey'}>
            <span className="relative flex items-center justify-end w-full h-full">
              {hotkey ? (
                <span className="transition-opacity duration-150 truncate">{hotkey}</span>
              ) : (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 text-[#39d639] dark:text-[#39d639] pointer-events-none">
                  <BsPencilFill size={11} />
                </span>
              )}
            </span>
          </div>
        </div>
      </motion.div>
      {contextMenu && (
        <FavoritesContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            setContextMenu(null);
            setIsEditing(false);
            setIsEditingShortcut(false);
            setErrorMessage('');
          }}
          isDarkMode={isDarkMode}
          shortcut={shortcut}
          hotkey={hotkey}
          onSaveShortcut={handleSaveShortcut}
          onSaveHotkey={handleSaveHotkey}
          onClearShortcut={() => {
            setEditValue('');
            // Logic to clear shortcut (not explicitly a handler but we can add one or reuse handleSaveShortcut with empty)
            handleSaveShortcut('');
          }}
          onClearHotkey={handleClearHotkey}
          onToggleFavorite={handleRemoveFavorite}
          isFavorite={true}
          shortcutEditValue={isEditingShortcut ? editValue : shortcut.replace(/^\//, '')}
          onShortcutEditChange={val => {
            setEditValue(val);
            setIsEditingShortcut(true);
            setIsEditing(false);
            setErrorMessage('');
          }}
          hotkeyEditValue={isEditing ? editValue : hotkey}
          onHotkeyEditChange={e => {
            handleHotkeyCapture(e);
            setIsEditing(true);
            setIsEditingShortcut(false);
          }}
          isSaving={isSaving}
          error={errorMessage}
          conflictId={conflictId}
          showSuccess={showSuccess}
          onOverwriteHotkey={handleOverwriteHotkey}
          onOverwriteShortcut={handleOverwriteShortcut}
          existingTodoId={existingTodo ? existingTodo.todo_id || existingTodo.id : null}
          initialDate={
            existingTodo?.event_deadline ? format(new Date(existingTodo.event_deadline), 'yyyy-MM-dd') : undefined
          }
          initialTime={
            existingTodo?.event_deadline ? format(new Date(existingTodo.event_deadline), 'HH:mm') : undefined
          }
          initialIsRecurring={existingTodo?.is_recurring}
          initialRecurringCycle={existingTodo?.recurring_cycle}
          onSaveTodoDirectly={handleSaveTodoDirectly}
          todoTitle={command.label}
          todoDescription={command.id}
        />
      )}
    </>
  );
};

// Existing Snippet Logic wrapped
const SnippetFavoriteItem: React.FC<FavoriteItemProps & { snippet: Snippet }> = props => {
  const {
    userId,
    snippet,
    workspace,
    folder,
    reload,
    selectedItem,
    selectedTeamId,
    favoritesMapping,
    setFavoritesMapping,
    index,
    hotkeysMap,
    onOpenUrls,
    onNavigateToListView,
    isReordering,
    setHotkeysMap,
    setShortcutsMap,
    shortcutsMap,
    isDarkMode,
    onCommandSelect,
    onSelectSavedAgent,
    onAutomationSelect,
    onRequestEditLink,
    onHoverItem,
  } = props;
  const { overrideIcon } = props as any;

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingHotkey, setIsUpdatingHotkey] = useState(false);
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showTodoDialog, setShowTodoDialog] = useState(false);
  const dispatch = useDispatch();
  const allData = useSelector(selectAllData);
  const isMac = useSelector(selectIsMac);
  const { customizations, saveCustomization } = useLocalCommandCustomizations();
  const { captureHotkey } = useHotkeyAssignment(editValue, isMac);

  const [existingTodo, setExistingTodo] = useState<any>(null);

  useEffect(() => {
    if (contextMenu) {
      chrome.storage.local.get(['local_todos', 'cached_todos'], result => {
        const allTodos = [...(result.local_todos || []), ...(result.cached_todos || [])];
        const match = allTodos.find(t => {
          const tSid = String(t.snippet_id);
          const id1 = snippet.id || snippet.snippet_id;
          return tSid === String(id1) || tSid === `auto-${id1}` || tSid === `agent-${id1}`;
        });
        setExistingTodo(match || null);
      });
    } else {
      setExistingTodo(null);
    }
  }, [contextMenu, snippet.id, snippet.snippet_id]);

  const handleSaveTodoDirectly = async (todoData: {
    title: string;
    description: string;
    date: string;
    time: string;
    isRecurring: boolean;
    recurringCycle: 'daily' | 'weekly' | 'monthly' | null;
    isAnytime: boolean;
  }) => {
    const chromeAny = (window as any).chrome;
    try {
      let deadline = '';
      if (!todoData.isAnytime && todoData.date) {
        const [year, month, day] = todoData.date.split('-').map(Number);
        const [hour, min] = todoData.time ? todoData.time.split(':').map(Number) : [23, 59];
        const dt = new Date(year, month - 1, day, hour, min);
        if (!isNaN(dt.getTime())) {
          deadline = dt.toISOString();
        }
      } else {
        deadline = new Date().toISOString();
      }

      const itemCategory = snippet.category || 'snippet';

      if (existingTodo) {
        const sid = String(existingTodo.snippet_id);
        const result = await new Promise<any>(resolve => chrome.storage.local.get(['local_todos'], resolve));
        const localTodos = result.local_todos || [];
        const updated = localTodos.map((t: any) =>
          String(t.snippet_id) === sid
            ? {
                ...t,
                key: todoData.title,
                title: todoData.title,
                value: todoData.description,
                event_deadline: deadline,
                is_recurring: todoData.isRecurring,
                recurring_cycle: todoData.isRecurring ? todoData.recurringCycle : null,
                is_anytime: todoData.isAnytime,
              }
            : t,
        );
        await new Promise<void>(resolve => chrome.storage.local.set({ local_todos: updated }, resolve));

        const bestTodoId = existingTodo.todo_id;
        const isNumeric =
          typeof bestTodoId === 'number' ||
          (typeof bestTodoId === 'string' && !isNaN(Number(bestTodoId)) && !bestTodoId.includes('-'));
        if (isNumeric) {
          await editTodo(
            bestTodoId,
            deadline,
            todoData.isRecurring ? todoData.recurringCycle || undefined : undefined,
            todoData.title,
            todoData.description,
            todoData.isRecurring,
            existingTodo.is_done,
          );
        } else {
          await updateSnippetRealtime({
            snippet_id: sid,
            key: todoData.title,
            value: todoData.description,
            event_deadline: deadline,
            is_recurring: todoData.isRecurring,
            recurring_cycle: todoData.isRecurring ? todoData.recurringCycle : null,
            is_done: existingTodo.is_done,
          });
        }

        if (!todoData.isAnytime && deadline && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(bestTodoId || sid),
            deadline: deadline,
            is_anytime: todoData.isAnytime,
          });
        }
      } else {
        const snippetId = snippet.snippet_id || snippet.id;
        const cat = snippet.category || 'snippet';

        let computedSnippetId = String(snippetId);
        if (['automation', 'agent', 'chat_agent'].includes(cat)) {
          const isAgent = cat === 'agent' || cat === 'chat_agent';
          computedSnippetId = isAgent ? `agent-${snippetId}` : `auto-${snippetId}`;
        } else if (['module', 'install'].includes(cat)) {
          computedSnippetId = `mod-${snippetId}`;
        }

        const rawId =
          String(snippetId).includes('-') &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(snippetId))
            ? String(snippetId).split('-').slice(1).join('-')
            : snippetId;

        const optimisticTask: any = {
          snippet_id: computedSnippetId,
          id: computedSnippetId,
          key: todoData.title,
          title: todoData.title,
          value: ['automation', 'module', 'command', 'agent', 'chat_agent', 'install'].includes(cat)
            ? snippet.id || snippet.snippet_id || todoData.description
            : todoData.description,
          category: cat,
          is_todo_type: true,
          event_deadline: deadline,
          is_done: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          folder_id: '',
          workspace_id: null,
          is_recurring: todoData.isRecurring,
          recurring_cycle: todoData.isRecurring ? todoData.recurringCycle : null,
          is_anytime: todoData.isAnytime,
          automation_description: todoData.description,
        };

        const storageResult = await new Promise<any>(resolve => chrome.storage.local.get(['local_todos'], resolve));
        const localTodos = storageResult.local_todos || [];
        const updatedLocal = [
          optimisticTask,
          ...localTodos.filter((t: any) => String(t.snippet_id || t.id) !== computedSnippetId),
        ];
        await new Promise<void>(resolve => chrome.storage.local.set({ local_todos: updatedLocal }, resolve));

        const target: any = {};
        if (['automation', 'agent', 'chat_agent'].includes(cat)) {
          target.automation_id = rawId;
        } else if (['module', 'install'].includes(cat)) {
          target.installed_module_id = rawId;
        } else {
          target.snippet_id = rawId;
        }

        const convertRes = await convertSnippetToTodo(
          target,
          deadline || '',
          todoData.isRecurring,
          todoData.isRecurring ? todoData.recurringCycle || undefined : undefined,
          todoData.title,
        );

        const todoId =
          convertRes?.todo_id ||
          convertRes?.snippet?.todo_id ||
          convertRes?.snippet?.id ||
          convertRes?.snippet?.snippet_id ||
          convertRes?.todo?.todo_id ||
          convertRes?.todo?.id;

        const freshResult = await new Promise<any>(resolve => chrome.storage.local.get(['local_todos'], resolve));
        const freshTodos = (freshResult.local_todos || []).map((t: any) =>
          String(t.snippet_id || t.id) === computedSnippetId
            ? {
                ...t,
                todo_id: todoId,
              }
            : t,
        );
        await new Promise<void>(resolve => chrome.storage.local.set({ local_todos: freshTodos }, resolve));

        if (!todoData.isAnytime && deadline && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(todoId || computedSnippetId),
            deadline: deadline,
            is_anytime: todoData.isAnytime,
          });
        }
      }

      dispatch(
        queueNotification({
          message: existingTodo ? 'Task updated successfully' : 'Task created successfully',
          type: 'success',
        }),
      );
      reload();
    } catch (e: any) {
      console.error('Failed to save todo:', e);
      dispatch(queueNotification({ message: 'Failed to save todo task', type: 'error' }));
    }
  };

  // Build compound ID using standardized helper
  const snippetId = snippet.snippet_id || snippet.id;
  const compoundId = getItemCompoundId({ suggestion: { folder, workspace, snippet } });

  useEffect(() => {
    const timer = setTimeout(async () => {
      setErrorMessage('');
      setConflictId(null);

      if (!editValue) return;

      if (isEditing) {
        const allHotkeys = await readAllHotkeys();
        const currentSnippetId = extractSnippetIdFromCompoundId(compoundId || '');
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === editValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${editValue}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
            : `Hotkey "${editValue}" is already assigned`;
          setErrorMessage(msg);
          setConflictId(conflictingId);
        }
      } else if (isEditingShortcut) {
        let normalized = editValue.trim();
        if (normalized && !normalized.startsWith('/')) {
          normalized = `/${normalized}`;
        }
        if (normalized) {
          const allShortcuts = await readAllShortcuts();
          const currentSnippetId = extractSnippetIdFromCompoundId(compoundId || '');
          const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Shortcut "${normalized}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
              : `Shortcut "${normalized}" is already assigned`;
            setErrorMessage(msg);
            setConflictId(conflictingId);
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editValue, isEditing, isEditingShortcut, allData, compoundId]);

  const {
    getItemIcon,
    toggleFavorite,
    handleClickItem,
    isFav,
    getFaviconUrl,
    getItemContent,
    getItemTypeLabel,
    openSingleLink,
    openMultipleLinks,
  } = useSnippetItem({
    userId,
    snippet,
    workspace,
    folder,
    reload,
    selectedItem,
    selectedTeamId,
    favoritesMapping,
    setFavoritesMapping,
    index,
    moveSnippet: (fromIndex: number, toIndex: number) => {
      /* Not needed for FavoriteItem */
    },
    snippetList: [snippet], // Minimal implementation to satisfy type
    isWorkspaceLevel: false,
  });
  const { label: rawLabel, color } = getItemTypeLabel(snippet.category || 'note');
  const isLinkCategory = isOfficialLinkCategory(snippet.category);
  const isTabGroupCategory = isOfficialTabGroupCategory(snippet.category);
  const isNoteCategory = isOfficialNoteCategory(snippet.category);
  const faviconUrl = isLinkCategory ? getFaviconUrl(snippet.value as string) : null;
  const label = rawLabel === 'Note' ? 'Notes' : rawLabel === 'Link' ? 'Links' : rawLabel;
  const displayName = snippet.key || snippet.label || snippet.name || 'Untitled Item';

  const subLinksCount = useMemo(() => {
    if (isTabGroupCategory || snippet.category === 'bulk_link' || snippet.category === 'tabgroup') {
      if (typeof snippet.value === 'string') {
        try {
          const parsed = JSON.parse(snippet.value);
          if (parsed && Array.isArray(parsed.urls)) {
            return parsed.urls.length;
          }
        } catch (_) {}
      } else if (typeof snippet.value === 'object' && Array.isArray((snippet.value as any)?.urls)) {
        return (snippet.value as any).urls.length;
      }
    }
    return 0;
  }, [snippet.value, isTabGroupCategory, snippet.category]);

  const snippetUrls = useMemo(() => {
    let urls: string[] = [];
    if (snippet) {
      if (typeof snippet.value === 'string') {
        try {
          const parsed = JSON.parse(snippet.value);
          urls = Array.isArray(parsed?.urls) ? parsed.urls : parsed?.url ? [parsed.url] : [snippet.value];
        } catch {
          urls = [snippet.value];
        }
      } else if (snippet.value && typeof snippet.value === 'object') {
        const val = snippet.value as any;
        urls = Array.isArray(val?.urls) ? val.urls : val?.url ? [val.url] : [];
      }
    }
    return urls;
  }, [snippet]);

  // Get hotkey using compound ID
  const hotkey = hotkeysMap?.[compoundId] || '';
  const shortcut = shortcutsMap?.[compoundId] || '';

  // Helper to find item name by ID
  const findConflictingItemName = (conflictingId: string): { name: string; type: string } | null => {
    const cmd = COMMANDS.find(c => c.id === conflictingId);
    if (cmd) return { name: cmd.label, type: 'COMMAND' };

    if (!allData) return null;

    for (const team of allData) {
      for (const workspace of team.workspaces) {
        if (workspace.workspace_snippets) {
          for (const s of workspace.workspace_snippets) {
            const sId = s.snippet_id || s.id;
            const compound = `${workspace.workspace_id}-${sId}`;
            if (compound === conflictingId || String(sId) === conflictingId) {
              const type = (s.category || 'NOTE').toUpperCase();
              return { name: s.key, type };
            }
          }
        }
        if (workspace.folders) {
          for (const folder of workspace.folders) {
            if (folder.snippets) {
              for (const s of folder.snippets) {
                const sId = s.snippet_id || s.id;
                const compound = `${folder.folder_id}-${sId}`;
                if (compound === conflictingId || String(sId) === conflictingId) {
                  const type = (s.category || 'NOTE').toUpperCase();
                  return { name: s.key, type };
                }
              }
            }
          }
        }
      }
    }
    return null;
  };

  const handleClearHotkey = async () => {
    if (!hotkey) return;
    dispatch(setCommandStatus({ status: 'loading', message: 'Clearing hotkey...' }));
    setIsSaving(true);
    try {
      await updateSnippetHotkey(snippetId, '');
      const type = isLinkCategory ? 'link' : 'note';
      await updateLocalHotkey(compoundId, '', type);

      // Robust local cleanup
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        const keysToClean = ['alts_link_hotkeys', 'alts_note_hotkeys', 'alts_command_hotkeys'];
        chromeAny.storage.local.get([...keysToClean, 'alts_commands'], (res: any) => {
          const updates: any = {};
          const altsCommands = res.alts_commands || [];
          let commandsChanged = false;

          keysToClean.forEach(key => {
            const map = res[key] || {};
            let changed = false;
            // Clear by compound ID
            if (map[compoundId]) {
              delete map[compoundId];
              changed = true;
            }
            // Clear by snippetId
            Object.keys(map).forEach(k => {
              if (k.endsWith(`-${snippetId}`) || k === snippetId) {
                delete map[k];
                changed = true;
              }
            });
            if (changed) updates[key] = map;
          });

          if (Array.isArray(altsCommands)) {
            altsCommands.forEach((cmd: any) => {
              if (cmd.id === snippetId || cmd.id === compoundId || (cmd.id && cmd.id.endsWith(`-${snippetId}`))) {
                if (cmd.hotkey) {
                  delete cmd.hotkey;
                  commandsChanged = true;
                }
              }
            });
          }
          if (commandsChanged) updates.alts_commands = altsCommands;
          if (Object.keys(updates).length > 0) {
            chromeAny.storage.local.set(updates);
          }
        });
      }

      dispatch(setCommandStatus({ status: 'success', message: 'Hotkey cleared successfully' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);

      // Refresh maps
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap?.(allHotkeys);
      setShortcutsMap?.(allShortcuts);
    } catch (error) {
      console.error('Failed to clear hotkey:', error);
      dispatch(setCommandStatus({ status: 'error', message: 'Failed to clear hotkey' }));
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to open links with first one in current tab
  const openWithCurrentTabStrategy = (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    const [first, ...rest] = urls;

    // Open first in current tab
    chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
      if (tabs && tabs[0]?.id) {
        chromeAny.tabs.update(tabs[0].id, { url: first });
      } else {
        window.open(first, '_self');
      }
    });

    // Open rest in new tabs
    rest.forEach(url => {
      chromeAny.tabs.create({ url, active: false });
    });
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReordering) return;
    setEditValue(hotkey || '');
    setIsUpdatingHotkey(!!hotkey);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
    setIsEditing(true);
  };

  const handleSaveHotkey = async (newValue: string) => {
    if (!newValue) {
      setIsEditing(false);
      return;
    }

    // Check for duplicates
    const allHotkeys = await readAllHotkeys();
    const currentSnippetId = extractSnippetIdFromCompoundId(compoundId || '');
    const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === newValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Hotkey "${newValue}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Hotkey "${newValue}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      dispatch(queueNotification({ message: msg, type: 'error' }));
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    try {
      // Save to cloud first
      await updateSnippetHotkey(snippetId, newValue);

      // Update local storage for fast access
      const type = isLinkCategory ? 'link' : 'note';
      await updateLocalHotkey(compoundId, newValue, type);

      const actionText = isUpdatingHotkey ? 'updated' : 'saved';
      dispatch(queueNotification({ message: `Hotkey ${actionText} successfully`, type: 'success' }));
      

      // Refresh maps
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap?.(allHotkeys);
      setShortcutsMap?.(allShortcuts);

      setShowSuccess(newValue);
    } catch (error) {
      console.error('[FavoriteItem] Failed to save hotkey to cloud:', error);
      // Fallback to local storage only
      const storageKey = isLinkCategory ? 'alts_link_hotkeys' : 'alts_note_hotkeys';
      chromeAny.storage.local.get([storageKey], (res: any) => {
        const existing = res[storageKey] || {};
        existing[compoundId] = newValue;
        chromeAny.storage.local.set({ [storageKey]: existing }, () => {
          dispatch(queueNotification({ message: 'Hotkey saved locally', type: 'success' }));
          setShowSuccess(newValue);
        });
      });
    }

    // Short delay to show success state before closing
    await new Promise(r => setTimeout(r, 1000));

    setIsSaving(false);
    setIsEditing(false);
    setContextMenu(null);
    setShowSuccess(null);
  };

  const handleOverwriteHotkey = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing hotkey...');

    try {
      // 1. Clear existing
      const isCommand = COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId);
      if (isCommand) {
        const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
        if (isLocal) {
          await saveCustomization({ command_id: conflictId, hotkey: '' });
        } else {
          try {
            await updateHotkeyAndRefresh(conflictId, '');
          } catch (e) {
            console.warn('Cloud clear command hotkey failed', e);
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

      // 2. Save new
      await handleSaveHotkey(editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleSaveShortcut = async (value: string) => {
    let normalized = value.trim();
    if (normalized && !normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized) {
      setIsEditingShortcut(false);
      return;
    }

    // Check for duplicates
    const allShortcuts = await readAllShortcuts();
    const currentSnippetId = extractSnippetIdFromCompoundId(compoundId || '');
    const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Shortcut "${normalized}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Shortcut "${normalized}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      dispatch(queueNotification({ message: msg, type: 'error' }));
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    try {
      // Save to cloud first
      await updateSnippetShortcut(snippetId, normalized);

      // Update local storage for fast access
      const type = isLinkCategory ? 'link' : 'note';
      await updateLocalShortcut(
        compoundId,
        snippetId,
        normalized,
        snippet.key || '',
        type,
        isLinkCategory ? 'link' : undefined,
      );

      const actionText = isUpdatingShortcut ? 'updated' : 'saved';
      dispatch(queueNotification({ message: `Shortcut ${actionText} successfully`, type: 'success' }));
      

      // Refresh maps
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap?.(allHotkeys);
      setShortcutsMap?.(allShortcuts);

      setShowSuccess(normalized);
    } catch (error) {
      console.error('[FavoriteItem] Failed to save shortcut to cloud:', error);
      // Fallback to local storage only
      const storageKey = isLinkCategory ? 'link_commands' : 'note_commands';
      chromeAny.storage.local.get([storageKey], (res: any) => {
        const existing = res[storageKey] || {};
        const entry = existing[compoundId] || {};
        entry.shortcut = normalized;
        if (!entry.snippetId) {
          entry.snippetId = snippetId;
        }
        existing[compoundId] = entry;
        chromeAny.storage.local.set({ [storageKey]: existing }, () => {
          dispatch(queueNotification({ message: 'Shortcut saved locally', type: 'success' }));
          setShowSuccess(normalized);
        });
      });
    }

    // Short delay to show success state before closing
    await new Promise(r => setTimeout(r, 1000));

    setIsSaving(false);
    setIsEditingShortcut(false);
    setContextMenu(null);
    setShowSuccess(null);
  };

  const handleOverwriteShortcut = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing shortcut...');

    try {
      // 1. Clear existing
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

      // 2. Save new
      await handleSaveShortcut(editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleHotkeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const result = captureHotkey(e);
    if (!result) return;
    if (result === 'CANCEL') {
      setIsEditing(false);
      setErrorMessage('');
    } else if (result) {
      setEditValue(result);
      setErrorMessage('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuActions: MenuAction[] = [
    {
      key: 'assign-shortcut',
      label: shortcut ? `Assign a Text Command (${shortcut})` : 'Assign a Text Command',
      icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
      className: 'text-neutral-700 dark:text-neutral-300 hover:bg-green-50 dark:hover:bg-green-900/20',
      onSelect: async () => {
        const allShortcuts = await readAllShortcuts();
        let existingValue = '';
        if (Object.prototype.hasOwnProperty.call(allShortcuts, compoundId)) {
          existingValue = allShortcuts[compoundId];
        } else {
          const entry = Object.entries(allShortcuts).find(([id]) => id === compoundId);
          if (entry) existingValue = entry[1];
        }

        const displayValue = existingValue ? existingValue.replace(/^\//, '') : '';
        setEditValue(displayValue);
        setIsUpdatingShortcut(!!existingValue);
        setIsEditingShortcut(true);
        setIsEditing(false);
        setErrorMessage('');
      },
    },
    {
      key: 'assign-hotkey',
      label: hotkey ? `Assign a Keyboard Shortcut (${hotkey})` : 'Assign a Keyboard Shortcut',
      icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
      className: 'text-neutral-700 dark:text-neutral-300 hover:bg-green-50 dark:hover:bg-green-900/20',
      onSelect: () => {
        setEditValue(hotkey || '');
        setIsUpdatingHotkey(!!hotkey);
        setIsEditing(true);
        setIsEditingShortcut(false);
      },
    },

    { key: 'div-1', label: '', icon: null, onSelect: () => {}, divider: true },

    {
      key: 'remove',
      label: 'Remove from Favorites',
      icon: <FiTrash2 size={14} />,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
      onSelect: () => toggleFavorite(snippet),
    },
  ];

  // Determine tooltip content (Title only)
  const tooltipContent = displayName === 'Tab Group' ? 'Link Group' : displayName;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        whileDrag={{
          backgroundColor: isDarkMode ? 'rgb(26, 26, 26)' : '#fdf6e3',
          boxShadow: '0 8px 30px rgb(0,0,0,0.12)',
          zIndex: 50,
        }}
        transition={{ duration: 0.2 }}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isEditing && !isEditingShortcut && !isReordering) {
            const category = snippet.category?.toLowerCase();
            let urlsToOpen: string[] = [];

            // Check for Links/TabGroups
            if (
              category === 'link' ||
              category === 'tabgroup' ||
              category === 'tab group' ||
              category === 'bulk_link'
            ) {
              if (typeof snippet.value === 'string') {
                try {
                  const parsed = JSON.parse(snippet.value);
                  if (parsed && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                    urlsToOpen = parsed.urls;
                  } else {
                    if (category === 'link') urlsToOpen = [snippet.value];
                  }
                } catch {
                  if (category === 'link') urlsToOpen = [snippet.value];
                }
              } else if (typeof snippet.value === 'object' && (snippet.value as any)?.urls) {
                urlsToOpen = (snippet.value as any).urls;
              }
            }

            if (urlsToOpen.length > 0) {
              // Use centralized handler if available
              if (onOpenUrls) {
                onOpenUrls(urlsToOpen, snippet.key);
                return;
              }

              // Fallback to legacy behavior
              // Convert all note: URLs to proper extension URLs
              const convertedUrls = urlsToOpen.map(url => {
                if (url && url.startsWith('note:')) {
                  const sid = url.replace('note:', '');
                  return chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
                }
                return url;
              });

              // Open all URLs directly (no duplicate filtering)
              const [first, ...rest] = convertedUrls;
              rest.forEach(url => {
                chromeAny.tabs.create({ url, active: false });
              });
              if (first) window.location.href = first;
            } else if (category === 'prompt') {
              // For prompts, open the Prompt Editor
              // Create breadcrumb for the editor context
              const breadcrumb: NewSnippetBreadCrum = {
                workspace_id: workspace.workspace_id,
                workspace_name: workspace.workspace_name,
                folder_id: folder?.folder_id || null,
                folder_name: folder?.folder_name || null,
              };

              dispatch(setSelectedWorkspace(workspace));
              dispatch(setSelectedFolder(folder));
              dispatch(setSelectedSnippet(snippet));
              dispatch(setIsCreatingNewItem(false));
              dispatch(setSnippetBreadCrum(breadcrumb));
            } else if (category === 'automation' || category === 'agent') {
              // Trigger the automation via the app-level handler
              if (isLikelySavedAgentFavorite(snippet) && onSelectSavedAgent) {
                onSelectSavedAgent(snippet.automation || snippet);
              } else if (onAutomationSelect) {
                onAutomationSelect(snippet.automation || snippet);
              }
            } else if (category === 'snippet' || category === 'note' || category === 'notes') {
              if (props.onSnippetSelect) {
                props.onSnippetSelect(snippet, workspace, folder);
              } else {
                // Fallback: Open as note in new tab (User Request)
                const sid = snippet.snippet_id || snippet.id;
                const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
                window.open(url, '_blank');
              }
            } else {
              // Fallback: Open as note in new tab (User Request)
              if (props.onSnippetSelect) {
                props.onSnippetSelect(snippet, workspace, folder);
              } else {
                const sid = snippet.snippet_id || snippet.id;
                const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
                window.open(url, '_blank');
              }
            }
          }
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={e => {
          if (onHoverItem) {
            onHoverItem(snippet, e.currentTarget);
          }
        }}
        onMouseLeave={() => {
          if (onHoverItem) {
            onHoverItem(null, null);
          }
        }}
        title={tooltipContent}
        className={`group relative cursor-pointer px-1 py-[0.5px] bg-transparent ${selectedItem === snippet.id ? (isDarkMode ? 'bg-white/5' : 'bg-black/5') : ''}`}>
        <div className="flex items-center gap-1.5 h-[29px] overflow-hidden relative">
          {/* Icon - First */}
          <div
            className={`flex items-center justify-start flex-shrink-0 w-8 overflow-hidden transition-opacity duration-150 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {overrideIcon ? (
              <div className="w-[18px] h-[18px] flex items-center justify-center">{overrideIcon}</div>
            ) : snippet.id === 'ai' || (snippet as any).command_id === 'ai' ? (
              <div className="flex -space-x-1.5 items-center justify-start">
                {AI_GROUP.members.slice(0, 4).map((id, idx) => {
                  const command = COMMANDS.find(x => x.id === id);
                  if (!command) return null;
                  return (
                    <div
                      key={`ai-fav-${command.id}`}
                      className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white dark:border-neutral-800 bg-white shadow-sm flex-shrink-0 relative" style={{ zIndex: 4 - idx }}>
                      <img src={(getFaviconUrl(command.iconHost || '') || '') as string} alt={command.label || ''} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            ) : ((snippet.category || '') + '').toLowerCase().includes('snippet') ||
              ((snippet.category || '') + '').toLowerCase().includes('prompt') ? (
              // For Snippets/Prompts show the item-type icon inline as requested
              <div className="w-[18px] h-[18px] flex items-center justify-center">{getItemIcon(snippet.category)}</div>
            ) : isLinkCategory || isTabGroupCategory || snippet.category === 'bulk_link' || snippet.category === 'tabgroup' ? (
              <StackedLinkIcon urls={snippetUrls} size={18} fallback={isTabGroupCategory ? 'tabgroup' : 'link'} />
            ) : snippet.category === 'automation' || snippet.category === 'agent' || snippet.steps || snippet.automation ? (
              <AutomationDynamicIcon automation={snippet.automation || snippet} size={18} />
            ) : (
              // @ts-ignore
              <div
                className={`flex items-center justify-start ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {getItemIcon(snippet.category)}
              </div>
            )}
          </div>

          {/* Name - Second */}
          <div className="flex-1 min-w-0 min-h-0 h-full relative flex items-center overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {/* Full Title (Visible by default, hidden on hover) */}
              <span
                className={`text-[13px] font-medium whitespace-nowrap truncate inline-block transition-colors duration-150 group-hover:hidden ${
                  selectedItem === snippet.id
                    ? !isDarkMode
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDarkMode
                      ? 'text-neutral-500 group-hover:text-neutral-900'
                      : 'text-neutral-400 group-hover:text-neutral-200'
                }`}
                style={headingFontStyle}>
                {(() => {
                  const name = displayName === 'Tab Group' ? 'Link Group' : displayName;
                  return name.length > 18 ? name.substring(0, 18) + '...' : name;
                })()}
              </span>

              {/* Truncated Title (Hidden by default, visible on hover) */}
              <span
                className={`text-[13px] font-medium whitespace-nowrap truncate hidden group-hover:inline-block flex-shrink transition-colors duration-150 ${
                  selectedItem === snippet.id
                    ? !isDarkMode
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDarkMode
                      ? 'text-neutral-500'
                      : 'text-neutral-200'
                }`}
                style={headingFontStyle}>
                {(() => {
                  const name = displayName === 'Tab Group' ? 'Link Group' : displayName;
                  return name.length > 12 ? name.substring(0, 12) + '...' : name;
                })()}
              </span>
              <span className={`text-[10px] ml-1 flex-shrink-0 hidden group-hover:inline-block transition-opacity duration-150 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                • {rawLabel}
              </span>
              {subLinksCount > 0 && (
                <span
                  className={`text-[11px] font-bold flex-shrink-0 transition-colors duration-150 ${isDarkMode ? 'text-neutral-600 group-hover:text-neutral-400' : 'text-neutral-400 group-hover:text-neutral-600'}`}>
                  + {subLinksCount - 1}
                </span>
              )}
            </div>
          </div>

          {/* Hotkey - Last */}
          <div
            onClick={handleStartEdit}
            className={`flex-shrink-0 w-auto max-w-[120px] text-right pr-2 text-[10px] font-mono font-semibold transition-colors duration-150 ${
              !isDarkMode ? 'text-neutral-400 hover:text-neutral-900' : 'text-neutral-500 hover:text-neutral-200'
            } cursor-pointer`}
            title={hotkey ? `Hotkey: ${hotkey}` : 'Click to edit hotkey'}>
            <span className="relative flex items-center justify-end w-full h-full">
              {hotkey ? (
                <span className="transition-opacity duration-150 truncate">{hotkey}</span>
              ) : (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 text-[#39d639] pointer-events-none">
                  <BsPencilFill size={11} />
                </span>
              )}
            </span>
          </div>
        </div>
      </motion.div>
      {contextMenu && (
        <FavoritesContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            setContextMenu(null);
            setIsEditing(false);
            setIsEditingShortcut(false);
            setErrorMessage('');
          }}
          isDarkMode={isDarkMode}
          shortcut={shortcut}
          hotkey={hotkey}
          onSaveShortcut={handleSaveShortcut}
          onSaveHotkey={handleSaveHotkey}
          onClearShortcut={() => {
            setEditValue('');
            // Clear shortcut logic
            const type = isLinkCategory ? 'link' : 'note';
            updateLocalShortcut(compoundId, snippetId, '', '', type);
            // Also update cloud if possible (similar to handleSaveShortcut but with empty)
            updateSnippetShortcut(snippetId, '');
          }}
          onClearHotkey={handleClearHotkey}
          onToggleFavorite={() => toggleFavorite(snippet)}
          isFavorite={true}
          shortcutEditValue={isEditingShortcut ? editValue : shortcut.replace(/^\//, '')}
          onShortcutEditChange={val => {
            setEditValue(val);
            setIsEditingShortcut(true);
            setIsEditing(false);
            setErrorMessage('');
          }}
          hotkeyEditValue={isEditing ? editValue : hotkey}
          onHotkeyEditChange={e => {
            handleHotkeyCapture(e);
            setIsEditing(true);
            setIsEditingShortcut(false);
          }}
          isSaving={isSaving}
          error={errorMessage}
          conflictId={conflictId}
          showSuccess={showSuccess}
          onOverwriteHotkey={handleOverwriteHotkey}
          onOverwriteShortcut={handleOverwriteShortcut}
          onRequestEdit={
            isLinkCategory || isTabGroupCategory
              ? () => {
                  if (onRequestEditLink) {
                    onRequestEditLink({ snippet, workspace, folder });
                  }
                }
              : undefined
          }
          editLabel={isTabGroupCategory ? 'Edit Tab Group' : 'Edit Link'}
          existingTodoId={existingTodo ? existingTodo.todo_id || existingTodo.id : null}
          initialDate={
            existingTodo?.event_deadline ? format(new Date(existingTodo.event_deadline), 'yyyy-MM-dd') : undefined
          }
          initialTime={
            existingTodo?.event_deadline ? format(new Date(existingTodo.event_deadline), 'HH:mm') : undefined
          }
          initialIsRecurring={existingTodo?.is_recurring}
          initialRecurringCycle={existingTodo?.recurring_cycle}
          onSaveTodoDirectly={handleSaveTodoDirectly}
          todoTitle={snippet.key || (snippet as any).name || (snippet as any).label}
          todoDescription={typeof snippet.value === 'string' ? snippet.value : JSON.stringify(snippet.value)}
        />
      )}
    </>
  );
};

const FavoriteItem: React.FC<FavoriteItemProps> = props => {
  const { snippet } = props;

  // Check if it's a command
  if ('type' in snippet && snippet.type === 'command') {
    return <CommandFavoriteItem {...props} command={snippet as FavoriteCommand} />;
  }

  // Default to Snippet
  return <SnippetFavoriteItem {...props} snippet={snippet as Snippet} />;
};

export default FavoriteItem;
