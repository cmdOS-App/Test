import React from 'react';
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FaEdit,
  FaTrashAlt,
  FaPalette,
  FaStar,
  FaRegStar,
  FaKeyboard,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { FiCommand, FiZapOff, FiLoader, FiExternalLink } from 'react-icons/fi';
import { MdOutlineShortcut } from 'react-icons/md';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { motion, AnimatePresence } from 'framer-motion';
import type { Folder, Snippet, Workspace } from '../../../../modals/interfaces';
import DeleteConfirmation from './DeleteDialog';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCommandStatus,
  resetCommandStatus,
  setIsCommandListView,
  setHighlightedCommandId,
  selectIsMac,
  setShowTodosView,
  setTodoCreatePrefill,
} from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData, fetchAllDataThunk } from '../../../../Redux/AllData/allDataSlice';
import { deleteSnippet, updateSnippetHotkey, updateSnippetShortcut } from '../../../../Apis/features/snippetApi';
import { getUserId } from '../../../../Apis/core/api';
import { addFavorite, deleteFavorite, getFavorites } from '../../../../Apis/services/favoritesApi';
import {
  getItemCompoundId,
  readAllHotkeys,
  readAllShortcuts,
  extractSnippetIdFromCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { updateLocalHotkey, updateLocalShortcut } from '../../../../utils/shortcutHotkeyUtils';
import { COMMANDS } from '../SearchComponents/Searchbar/commands';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import { UnifiedContextMenu, MenuAction } from '../Shared/UnifiedContextMenu';
import { updateHotkeyAndRefresh, updateCommandAndRefresh } from '../../../../Apis/features/userCommandsApiService';
import { useLocalCommandCustomizations } from '../../hooks/useLocalCommandCustomizations';
import { LOCAL_COMMANDS } from '../SearchComponents/Searchbar/localCommands';

interface SnippetOptionsPopupProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  snippet: Snippet | null;
  workspace: Workspace | null;
  folder: Folder | null;
  reload: () => void;
  onOpenCustomize: (snippet: Snippet) => void;
  onEdit: (snippet: Snippet) => void;
}

const SnippetOptionsPopup: React.FC<SnippetOptionsPopupProps> = ({
  isOpen,
  position,
  onClose,
  snippet,
  workspace,
  folder,
  reload,
  onOpenCustomize,
  onEdit,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();
  const isMac = useSelector(selectIsMac);
  const allData = useSelector(selectAllData);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [favoritesMapping, setFavoritesMapping] = useState<Record<string, any[]>>({});
  const [isClearing, setIsClearing] = useState(false);

  // Inline Editing States
  const [isEditingHotkey, setIsEditingHotkey] = useState(false);
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [existingHotkey, setExistingHotkey] = useState('');
  const [existingShortcut, setExistingShortcut] = useState('');
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const { customizations, saveCustomization } = useLocalCommandCustomizations();
  const { captureHotkey } = useHotkeyAssignment(inputValue, isMac);

  // Load User ID
  useEffect(() => {
    const init = async () => {
      const uid = await getUserId();
      setUserId(uid);
    };
    init();
  }, []);

  // Fetch Favorites Status and Current Hotkeys
  useEffect(() => {
    if (!isOpen || !userId || !snippet) return;

    const initData = async () => {
      // Favorites
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('myFavouriteItems', (res: any) => {
          const map = res.myFavouriteItems || {};
          setFavoritesMapping(map);
          const userFavs = map[userId] || [];
          const snippetId = snippet.id || snippet.snippet_id;
          const isFav = userFavs.some((f: any) => f.id === snippetId || f.snippet_id === snippetId);
          setIsFavorite(isFav);
        });
      }

      // Hotkey and Shortcut
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);

      const snippetId = snippet.id || snippet.snippet_id;
      const compoundId = getItemCompoundId({ snippet, workspace, folder });

      setExistingHotkey(allHotkeys[compoundId] || '');
      setExistingShortcut(allShortcuts[compoundId] || '');
    };
    initData();
  }, [isOpen, userId, snippet, workspace, folder]);

  // Focus logic removed as UnifiedContextMenu handles it

  // Click outside listener
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showDeleteDialog) return;
    onClose();
  };

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setIsEditingHotkey(false);
      setIsEditingShortcut(false);
      setInputValue('');
      setError(null);
      setConflictId(null);
      setSaving(false);
    }
  }, [isOpen]);

  const handleDeleteSnippet = async () => {
    try {
      if (!snippet?.id) return;
      const category = (snippet.category || '').toLowerCase();
      const isLink = category.includes('link') || category.includes('tabgroup');
      const itemType = isLink ? 'snippet' : 'note';

      dispatch(setCommandStatus({ status: 'loading', message: `Deleting ${itemType} "${snippet.key}"...` }));
      await deleteSnippet(undefined, snippet.id);
      reload();
      dispatch(
        setCommandStatus({
          status: 'success',
          message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully`,
        }),
      );
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);
      setShowDeleteDialog(false);
      onClose();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message || 'Failed to delete file';
      dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);
      throw error;
    }
  };

  const handleToggleFavorite = async () => {
    if (!snippet || !userId) return;
    try {
      setSaving(true);
      const snippetId = snippet.id || snippet.snippet_id;
      if (!snippetId) return;

      if (isFavorite) {
        // Remove
        const chromeAny = (window as any)?.chrome;
        const userFavs = favoritesMapping[userId] || [];
        const existing = userFavs.find((f: any) => f.id === snippetId || f.snippet_id === snippetId);

        if (existing?.favourite_id) {
          if (!String(existing.favourite_id).startsWith('pending-')) {
            await deleteFavorite(userId, existing.favourite_id);
          }
        } else {
          // Try API lookup
          const cloudFavs = await getFavorites(userId);
          const match = cloudFavs.find((cf: any) => cf.snippet_id === snippetId);
          if (match?.favourite_id) {
            await deleteFavorite(userId, match.favourite_id);
          }
        }

        const newList = userFavs.filter((f: any) => f.id !== snippetId && f.snippet_id !== snippetId);
        const newMap = { ...favoritesMapping, [userId]: newList };
        chromeAny.storage.local.set({ myFavouriteItems: newMap });
        setFavoritesMapping(newMap);
        setIsFavorite(false);
        dispatch(setCommandStatus({ status: 'success', message: 'Removed from favorites' }));
        setTimeout(() => dispatch(setCommandStatus({ status: 'idle', message: '' })), 3000);
      } else {
        // Add
        const chromeAny = (window as any)?.chrome;
        const userFavs = favoritesMapping[userId] || [];
        const tempItem = { ...snippet, favourite_id: 'pending-' + Date.now() };
        const newList = [tempItem, ...userFavs];
        const newMap = { ...favoritesMapping, [userId]: newList };
        chromeAny.storage.local.set({ myFavouriteItems: newMap });
        setFavoritesMapping(newMap);
        setIsFavorite(true);
        dispatch(setCommandStatus({ status: 'success', message: 'Added to favorites' }));
        setTimeout(() => dispatch(setCommandStatus({ status: 'idle', message: '' })), 3000);
        await addFavorite(userId, { id: snippetId }, 'snippet');
      }
    } catch (err) {
      console.error(err);
      dispatch(setCommandStatus({ status: 'error', message: 'Failed to update favorite' }));
    } finally {
      setSaving(false);
      onClose(); // Close popup after toggle
    }
  };

  // --- Shortcut Logic (Inline) ---
  const handleStartShortcutEdit = async () => {
    if (!snippet) return;
    // Toggle off other
    setIsEditingHotkey(false);

    const allShortcuts = await readAllShortcuts();
    const compoundId = getItemCompoundId({ snippet, workspace, folder });
    const existing = allShortcuts[compoundId];

    setInputValue(existing ? existing.replace(/^\//, '') : '');
    setIsUpdating(!!existing);
    setIsEditingShortcut(true);
    setError(null);
  };

  const handleSaveShortcut = async () => {
    if (!snippet) return;
    let normalized = inputValue.trim().toLowerCase();
    if (normalized && !normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    if (!normalized) {
      setIsEditingShortcut(false);
      return;
    }

    // Validation is now handled by UnifiedContextMenu or we trust the input if this is called manually (which it shouldn't be if we are using the menu)
    // If this is called from onSave of UnifiedContextMenu, validation has passed (assuming we implement blocking in UnifiedContextMenu correctly or pass error back).
    // UnifiedContextMenu passes `error` prop. If `error` is present, the save button in UnifiedContextMenu should be disabled.
    // So we don't need to re-validate here.

    setSaving(true);
    try {
      const snippetId = snippet.id || snippet.snippet_id;
      if (!snippetId) throw new Error('No ID');

      try {
        await updateSnippetShortcut(snippetId, normalized);
      } catch (e) {
        console.warn('Cloud sync shortcut failed', e);
      }

      // Update local storage
      const compoundId = getItemCompoundId({ snippet, workspace, folder });
      const category = (snippet.category || '').toLowerCase();
      const type = category.includes('link') || category.includes('tabgroup') ? 'link' : 'note';
      await updateLocalShortcut(compoundId, snippetId, normalized, snippet.key || '', type);

      setExistingShortcut(normalized);
      setShowSuccess('Shortcut saved');
      setTimeout(() => setShowSuccess(null), 2000);
      setIsEditingShortcut(false);
    } catch (err) {
      console.error(err);
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // --- Hotkey Logic (Inline) ---
  const handleStartHotkeyEdit = async () => {
    if (!snippet) return;
    setIsEditingShortcut(false);

    // Ensure we have layoutest data
    const allHotkeys = await readAllHotkeys();

    const compoundId = getItemCompoundId({ snippet, workspace, folder });
    const currentHotkey = existingHotkey || allHotkeys[compoundId] || '';

    setInputValue(currentHotkey);
    setIsUpdating(!!currentHotkey);
    setIsEditingHotkey(true);
    setError(null);
  };

  const handleHotkeyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const result = captureHotkey(e);
    if (result === 'CANCEL') {
      setIsEditingHotkey(false);
      setError(null);
    } else if (result) {
      setInputValue(result);
      setError(null);
    }
  };

  const handleSaveHotkey = async () => {
    if (!snippet) return;

    const compoundId = getItemCompoundId({ snippet, workspace, folder });

    const hotkey = inputValue.trim();

    if (!hotkey) {
      setIsEditingHotkey(false);
      return;
    }

    setSaving(true);
    try {
      const snippetId = snippet.id || snippet.snippet_id;
      if (!snippetId) throw new Error('No ID');

      try {
        await updateSnippetHotkey(snippetId, hotkey);
      } catch (e) {
        console.warn('Cloud sync hotkey failed', e);
      }
      const category = (snippet.category || '').toLowerCase();
      const type = category === 'link' || category.includes('link') ? 'link' : 'note';
      await updateLocalHotkey(compoundId, hotkey, type);

      dispatch(setCommandStatus({ status: 'success', message: 'Hotkey saved' }));
      setTimeout(() => dispatch(setCommandStatus({ status: 'idle', message: '' })), 3000);
      setExistingHotkey(hotkey);
      setShowSuccess(hotkey);
      await new Promise(r => setTimeout(r, 1000));
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
      setShowSuccess(null);
    }
  };

  const handleClearHotkey = async () => {
    // Logic adapted from user request, ensuring variables are defined
    const hotkey = existingHotkey;
    if (!hotkey || !snippet) return;

    const snippetId = snippet.id || snippet.snippet_id;
    if (!snippetId) return;

    const category = (snippet.category || '').toLowerCase();
    const isLinkCategory =
      category === 'link' ||
      category.includes('link') ||
      category.includes('tabgroup') ||
      category.includes('quicklink');

    const compoundId = getItemCompoundId({ snippet, workspace, folder });
    const chromeAny = (window as any)?.chrome;

    dispatch(setCommandStatus({ status: 'loading', message: 'Clearing hotkey...' }));
    setIsClearing(true);
    setSaving(true);

    try {
      try {
        await updateSnippetHotkey(snippetId, '');
      } catch (e) {
        console.warn('Cloud overwrite clear hotkey failed', e);
      }
      const type = isLinkCategory ? 'link' : 'note';
      await updateLocalHotkey(compoundId, '', type);

      dispatch(setCommandStatus({ status: 'success', message: 'Hotkey cleared successfully' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);

      // Also update UI state
      setExistingHotkey('');
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Failed to clear hotkey:', error);
    } finally {
      setIsClearing(false);
      setSaving(false);
    }

    // Robust cleanup: Always run this to ensure local cache is consistent
    // We clean from ALL possible locations because 'tabgroups' or other types might have been
    // saved as 'command', 'note', or 'link' depending on past logic/bugs.
    if (chromeAny?.storage?.local) {
      const keysToClean = ['alts_link_hotkeys', 'alts_note_hotkeys', 'alts_command_hotkeys'];

      chromeAny.storage.local.get([...keysToClean, 'alts_commands'], (res: any) => {
        const updates: any = {};
        const altsCommands = res.alts_commands || [];
        let commandsChanged = false;

        // 1. Clean from all local override maps
        keysToClean.forEach(key => {
          const map = res[key] || {};
          let changed = false;

          // Delete by compound ID
          if (map[compoundId]) {
            delete map[compoundId];
            changed = true;
          }

          // Also try cleaning up any by snippetId to be safe
          Object.keys(map).forEach(k => {
            if (k.endsWith(`-${snippetId}`) || k === snippetId) {
              delete map[k];
              changed = true;
            }
          });

          if (changed) {
            updates[key] = map;
          }
        });

        // 2. Clean from alts_commands (Prevent read-through of stale cloud data)
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
          chromeAny.storage.local.set(updates, () => {
            
          });
        }
      });
    }
  };

  const handleOverwriteHotkey = async (conflictId: string) => {
    if (!conflictId || !snippet) return;
    setSaving(true);
    setError('Overwriting existing hotkey...');

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

      // 2. Save new
      await handleSaveHotkey();
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      setError('Overwrite failed. Please try again.');
      setSaving(false);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string) => {
    if (!conflictId || !snippet) return;
    setSaving(true);
    setError('Overwriting existing shortcut...');

    try {
      // 1. Clear existing
      const isCommand = COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId);

      if (isCommand) {
        const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
        if (isLocal) {
          await saveCustomization({ command_id: conflictId, prefix: '' }); // Clearing shortcut uses 'prefix' in local customs
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
      await handleSaveShortcut();
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      setError('Overwrite failed. Please try again.');
      setSaving(false);
    }
  };

  // Navigation to conflict
  const handleNavigateToConflict = () => {
    if (conflictId) {
      dispatch(setHighlightedCommandId(conflictId));
      dispatch(setIsCommandListView(true));
    }
    onClose();
  };

  if (!isOpen || !snippet) return null;

  const category = (snippet.category || '').toLowerCase();
  const itemTypeLabel = category.includes('link')
    ? 'Link'
    : category.includes('tabgroup')
      ? 'Link Group'
      : category.includes('prompt')
        ? 'Prompt'
        : 'Note';

  const getDeleteDescription = () => {
    const isLink = category.includes('link') || category.includes('tabgroup');
    return `Are you sure you want to delete this ${isLink ? 'link' : 'note'}? This action cannot be undone.`;
  };

  // Smart positioning logic
  const estimatedHeight = 350; // Heuristic
  const estimatedWidth = isEditingHotkey || isEditingShortcut ? 240 : 192;

  const wouldOverflowBottom = position.top + estimatedHeight > window.innerHeight;
  const wouldOverflowRight = position.left + estimatedWidth > window.innerWidth;

  const style: React.CSSProperties = {
    position: 'absolute',
    maxHeight: 'calc(100vh - 24px)',
    overflowY: 'auto',
  };

  if (wouldOverflowBottom) {
    style.bottom = window.innerHeight - position.top;
    style.top = 'auto'; // Flip up
  } else {
    style.top = position.top;
    style.bottom = 'auto';
  }

  if (wouldOverflowRight) {
    style.right = window.innerWidth - position.left;
    style.left = 'auto'; // Flip left
  } else {
    style.left = position.left;
    style.right = 'auto';
  }

  const menuActions: MenuAction[] = [
    {
      key: 'edit',
      label: `Edit ${itemTypeLabel}`,
      icon: <FaEdit size={14} />,
      onSelect: () => onEdit(snippet!),
    },
    {
      key: 'customize',
      label: 'Edit File',
      icon: <FaPalette size={14} />,
      onSelect: () => onOpenCustomize(snippet!),
    },
    { divider: true, key: 'div1', label: '', icon: null, onSelect: () => { } },
    {
      key: 'favorite',
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: isFavorite ? <FaStar size={14} className="text-amber-400" /> : <FaRegStar size={14} />,
      onSelect: handleToggleFavorite,
    },
    {
      key: 'create-todo',
      label: 'Create Todo',
      icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
      onSelect: () => {
        if (!snippet) return;
        dispatch(
          setTodoCreatePrefill({
            snippet_id: snippet.id || (snippet as any).snippet_id,
            key: snippet.key,
            value: typeof snippet.value === 'string' ? snippet.value : JSON.stringify(snippet.value),
            category: snippet.category || 'snippet',
            todo_id: (snippet as any).todo_id,
            event_deadline: snippet.event_deadline,
            is_recurring: snippet.is_recurring,
            recurring_cycle: snippet.recurring_cycle,
            reminder: snippet.reminder,
          }),
        );
        dispatch(setShowTodosView(true));
        onClose();
      },
    },
    { divider: true, key: 'div2', label: '', icon: null, onSelect: () => { } },
    {
      key: 'assign-shortcut',
      label: existingShortcut ? `Assign a Text Command (${existingShortcut})` : 'Assign a Text Command',
      icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
      onSelect: handleStartShortcutEdit,
    },
    {
      key: 'assign-hotkey',
      label: existingHotkey ? `Assign a Keyboard Shortcut (${existingHotkey})` : 'Assign a Keyboard Shortcut',
      icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
      onSelect: handleStartHotkeyEdit,
    },
    { divider: true, key: 'div3', label: '', icon: null, onSelect: () => { } },
    {
      key: 'delete',
      label: 'Delete',
      icon: <FaTrashAlt size={14} />,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
      onSelect: () => setShowDeleteDialog(true),
      closeOnExecute: false,
    },
  ];

  return createPortal(
    <>
      {!showDeleteDialog && (
        <UnifiedContextMenu
          x={position.left}
          y={position.top}
          onClose={onClose}
          actions={menuActions}
          itemId={getItemCompoundId({ snippet, workspace, folder })}
          error={error || undefined}
          conflictId={conflictId}
          onNavigateAlreadyAssigned={handleNavigateToConflict}
          hotkeyInput={
            isEditingHotkey
              ? {
                value: inputValue,
                onChange: handleHotkeyKeyDown,
                onSave: handleSaveHotkey,
                onCancel: () => {
                  setIsEditingHotkey(false);
                  setError(null);
                },
                isSaving: saving,
                isUpdating: isUpdating,
                isClearing: isClearing,
                onClear: handleClearHotkey,
                onOverwrite: handleOverwriteHotkey,
                showSuccess: showSuccess,
              }
              : undefined
          }
          shortcutInput={
            isEditingShortcut
              ? {
                value: inputValue,
                onChange: setInputValue,
                onSave: handleSaveShortcut,
                onCancel: () => {
                  setIsEditingShortcut(false);
                  setError(null);
                },
                isSaving: saving,
                isUpdating: isUpdating,
                onOverwrite: handleOverwriteShortcut,
                showSuccess: showSuccess,
              }
              : undefined
          }
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteDialog && (
        <DeleteConfirmation
          isOpen={showDeleteDialog}
          title={`Delete ${itemTypeLabel}?`}
          description={getDeleteDescription()}
          onConfirm={handleDeleteSnippet}
          onClose={() => {
            setShowDeleteDialog(false);
            onClose();
          }}
          zIndex={10001}
        />
      )}
    </>,
    document.body,
  );
};

export default SnippetOptionsPopup;
