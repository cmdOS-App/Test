import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useToast from '../../Shared/Toast/useToast';
import { createPortal } from 'react-dom';
import { VariableSizeList as List } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { AI_GROUP, type CommandId, BROWSER_NAME, COMMANDS, DEFAULT_SELECTED_AIS } from './commands';
import {
  FaLayerGroup,
  FaLink,
  FaEdit,
  FaTrashAlt,
  FaBookmark,
  FaFolder,
  FaHistory,
  FaDownload,
  FaCog,
  FaPuzzlePiece,
  FaFlag,
  FaCode,
  FaInfoCircle,
  FaMemory,
  FaMicrochip,
  FaGamepad,
  FaKey,
  FaTag,
  FaQuestionCircle,
  FaFolderOpen,
  FaCheck,
  FaTimes,
  FaTerminal,
  FaSearch,
  FaRobot,
  FaCalculator,
  FaClock,
  FaRegClock,
} from 'react-icons/fa';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../../Shared/Icons/StackedLinkIcon';
import AutomationDynamicIcon from '../../Shared/Icons/AutomationDynamicIcon';
import {
  FiEdit2,
  FiPlay,
  FiStar,
  FiTrash2,
  FiExternalLink,
  FiFileText,
  FiMoreHorizontal,
  FiLoader,
  FiZap,
  FiZapOff,
  FiCheckSquare,
  FiSquare,
  FiPlus,
} from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { MdOutlineShortcut } from 'react-icons/md';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import type {
  SuggestionState,
  SnippetSuggestion,
  CommandSuggestionItem,
  CommonCommandSuggestionItem,
  HistorySuggestionItem,
  OpenUrlSuggestionItem,
  BookmarkSuggestionItem,
  AgentCollectionSuggestionItem,
  AutomationSuggestionItem,
  ModuleSuggestionItem,
  MathSuggestionItem,
  TimeSuggestionItem,
} from './Searchbar';
import { type SavedAutomation } from '../../../../../utils/automation';
import type { Snippet, Workspace, Folder } from '../../../../../modals/interfaces';
import { getFaviconUrl } from './utils';
import { buildSnippetSuggestion } from '../SearchPopup/snippetInteractiveUtils';
import { TerminalIcon } from '@src/components/Shared/utils/terminalIcon';
import CmdIcon from '../../Shared/Icons/CmdIcon';
import { useCommands } from './useCommands';
import { useHotkeyAssignment } from '../../../hooks/useHotkeyAssignment';
import { store } from '../../../../../Redux/store';
import { updateCommandAndRefresh, updateHotkeyAndRefresh } from '../../../../../Apis/features/userCommandsApiService';
import { updateSnippetShortcut, updateSnippetHotkey } from '../../../../../Apis/features/snippetApi';
import { updateAutomationRealtime } from '../../../../../Apis/features/automationsApi';
import { assignModuleHotkey, removeModuleHotkey } from '../../../../../Apis/core/api';
import { updateLocalShortcut, updateLocalHotkey } from '../../../../../utils/shortcutHotkeyUtils';
import {
  readAllShortcuts,
  readAllHotkeys,
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
} from '../../Shared/utils/hotkeyUtils';
import type { CommandStatus } from '../../../../../Redux/AllData/uiStateSlice';
import {
  selectIsMac,
  setCommandStatus,
  resetCommandStatus,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  setTodoCreatePrefill,
  setShowTodosView,
  setIsCreatingNewItem,
  expandAllWorkspaces,
  selectExpandedWorkspaces,
  setIsCommandListView,
  setHighlightedCommandId,
  openLinkEditModal,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectDarkMode,
} from '../../../../../Redux/AllData/uiStateSlice';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, fetchAllDataThunk } from '../../../../../Redux/AllData/allDataSlice';
import { LOCAL_COMMANDS } from './localCommands';
import { useLocalCommandCustomizations } from '../../../hooks/useLocalCommandCustomizations';
import { AIServiceSelectionPanel } from '../../Shared/AIServiceSelectionPanel';
import { AIHistorySelectionPanel } from '../../Shared/AIHistorySelectionPanel';
import { trackCounterEvent } from '../../../../../utils/counterTracking';
import { useAppearance } from '@extension/ui';

// Map command IDs to specific React Icons (Must match CommandListView.tsx)
const BROWSER_ICONS: Record<string, React.ReactNode> = {
  history: <FaHistory size={16} className="text-[var(--color-iconDefault)]" />,
  downloads: <FaDownload size={16} className="text-[var(--color-iconDefault)]" />,
  settings: <FaCog size={16} className="text-[var(--color-iconDefault)]" />,
  extensions: <FaPuzzlePiece size={16} className="text-[var(--color-iconDefault)]" />,
  bookmarks: <FaBookmark size={16} className="text-[var(--color-iconDefault)]" />,
  flags: <FaFlag size={16} className="text-[var(--color-iconDefault)]" />,
  inspect: <FaCode size={16} className="text-[var(--color-iconDefault)]" />,
  version: <FaTag size={16} className="text-[var(--color-iconDefault)]" />,
  about: <FaInfoCircle size={16} className="text-[var(--color-iconDefault)]" />,
  tasks: <FaMemory size={16} className="text-[var(--color-iconDefault)]" />,
  gpu: <FaMicrochip size={16} className="text-[var(--color-iconDefault)]" />,
  dino: <FaGamepad size={16} className="text-[var(--color-iconDefault)]" />,
  passwords: <FaKey size={16} className="text-[var(--color-iconDefault)]" />,
  help: <FaQuestionCircle size={16} className="text-[var(--color-iconDefault)]" />,
};

interface SearchSuggestionsProps {
  state: SuggestionState | null;
  favoritesMapping?: Record<string, any[]>;
  selectedTeamId?: string;
  userId?: string;
  status?: CommandStatus;
  inlineNotification?: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  onRequestClear?: () => void;
}

import { highlightMatch } from '../../Shared/utils/searchUtils';
import { getFormattedTime } from '../../../utils/engines/timeEngine';

const LiveTimeDisplay = ({ initialTime, timezone }: { initialTime: string; timezone: string }) => {
  const isDarkMode = useSelector(selectDarkMode);
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (!timezone) return;
    const interval = setInterval(() => {
      setTime(getFormattedTime(timezone));
    }, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  return <strong className={`font-medium ${!isDarkMode ? 'text-[#268bd2]' : 'text-blue-400'}`}>{time}</strong>;
};

const FocusedIndicator = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  return (
    <div
      className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-lg z-[30] pointer-events-none"
      style={{ backgroundColor: '#a8c7fa' }}
    />
  );
};

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => {
  const isMac = useSelector(selectIsMac);
  const isDarkMode = useSelector(selectDarkMode);
  const secondaryTextColor = !isDarkMode ? 'text-[#586e75]' : 'text-[var(--color-textMuted)]';
  return (
    <span className="flex items-center gap-1">
      {keys.map(key => {
        let displayKey = key;
        if (isMac) {
          if (key.toLowerCase() === 'ctrl') displayKey = '⌘';
          if (key.toLowerCase() === 'alt') displayKey = '⌥';
        }
        return (
          <span
            key={key}
            className={`rounded border ${!isDarkMode ? 'border-[#eee8d5] ' : 'border-neutral-700 '} px-1.5 py-0.5 text-[10px] font-medium ${secondaryTextColor} shadow-sm`}>
            {displayKey}
          </span>
        );
      })}
    </span>
  );
};

const HotkeyBadge: React.FC<{ hotkey: string; isActive?: boolean }> = ({ hotkey, isActive }) => {
  const isMac = useSelector(selectIsMac);
  const isDarkMode = useSelector(selectDarkMode);
  const secondaryTextColor = !isDarkMode ? 'text-[#586e75]' : 'text-[var(--color-textMuted)]';
  if (!hotkey) return null;

  const parts = hotkey.split('+').map(p => p.trim());
  return (
    <span
      className={`flex items-center gap-0.5 ml-1.5 origin-right transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
      {parts.map((part, i) => {
        let display = part;
        if (isMac) {
          if (part.toLowerCase() === 'alt') display = '⌥';
        }

        return (
          <React.Fragment key={i}>
            <span
              className={`${!isDarkMode ? 'bg-[#fdf6e3] text-[#586e75] border-[#eee8d5]' : 'bg-white/10 text-neutral-400 border-white/10'} px-1.5 py-0.5 rounded border font-mono text-[10px] min-w-[1.2rem] text-center shadow-sm`}>
              {display}
            </span>
            {i < parts.length - 1 && <span className={`text-[10px] ${secondaryTextColor}`}>+</span>}
          </React.Fragment>
        );
      })}
    </span>
  );
};

// Helper to identify automation items reliably
const isAutomationItem = (item: any) => {
  if (!item) return false;
  // Handle direct automation items from synced storage/legacy
  if (item._kind === 'automation' || (item as any).type === 'automation') return true;
  // Handle commands/aggregates that are explicitly marked as automations
  if ((item._kind === 'command' || item._kind === 'aggregate') && (item.isAutomation || item.is_automation))
    return true;
  // Handle Module suggestions
  if (item._kind === 'module') return true;
  return false;
};

// Highlight matched query segments in a string (case-insensitive)
// baseClass: applied to all parts; matchClass: applied additionally to matched parts
const FavoriteStar: React.FC<{
  isFav: boolean;
  isActive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}> = ({ isFav, isActive, onClick, title }) => {
  const isDarkMode = useSelector(selectDarkMode);
  return (
    <div
      className={`cursor-pointer group flex items-center justify-start p-1 rounded-md ${isFav
        ? 'text-yellow-400 hover:text-yellow-500'
        : `opacity-0 group-hover:opacity-100 ${!isDarkMode ? 'text-neutral-300 hover:text-[#586e75] hover:bg-[#fdf6e3]' : 'text-neutral-600 hover:text-neutral-500 hover:bg-neutral-800'}`
        } ${isActive ? 'opacity-100' : ''}`}
      onClick={onClick}
      title={title}>
      <FiStar size={13} className={`${isFav ? 'fill-yellow-400' : ''}`} />
    </div>
  );
};

const ShortcutBadge: React.FC<{ shortcut: string; isActive?: boolean }> = ({ shortcut, isActive }) => {
  const isDarkMode = useSelector(selectDarkMode);
  if (!shortcut) return null;

  return (
    <span
      className={`flex items-center gap-0.5 ml-2 origin-left transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
      <span
        className={`${!isDarkMode ? 'bg-[#fdf6e3] text-[#586e75] border-[#eee8d5]' : 'bg-white/10 text-neutral-400 border-white/10'} px-2 py-0.5 rounded border font-medium text-[9px] shadow-sm`}>
        {shortcut.startsWith('/') ? shortcut : `/${shortcut}`}
      </span>
    </span>
  );
};

const highlightOmniboxStyle = (text: string, query: string, isDarkMode: boolean) => {
  if (!query || !text) return text;
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, idx) =>
      regex.test(part) ? (
        <strong key={idx} className={`font-semibold ${!isDarkMode ? 'text-[#268bd2]' : 'text-blue-400'}`}>
          {part}
        </strong>
      ) : (
        <span key={idx} className="text-neutral-900 dark:text-white font-semibold">
          {part}
        </span>
      ),
    );
  } catch {
    return text;
  }
};

import { UnifiedContextMenu, type MenuAction } from '../../Shared/UnifiedContextMenu';

const SuggestionRow = ({ index, style, data }: any) => {
  const { renderItem, highlightIndex } = data;
  const isActive = index === highlightIndex;

  return (
    <div style={style} className="relative group overflow-hidden">
      {renderItem(index)}
    </div>
  );
};

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  state,
  favoritesMapping = {},
  selectedTeamId,
  userId,
  status,
  inlineNotification,
  onNavigateToListView,
  onRequestClear,
}) => {
  const getIsFavorite = useCallback(
    (itemId: string) => {
      // Use userId for favorite lookups as per Container.tsx logic
      const key = userId || '';
      if (!key || !favoritesMapping[key]) return false;
      return favoritesMapping[key].some((fav: any) => (fav.snippet_id || fav.id) === itemId);
    },
    [favoritesMapping, userId],
    );

  const dispatch = useDispatch();
  const triggerToast = useToast();
  const chromeAny = (window as any)?.chrome;
  const allData = useSelector(selectAllData);
  const isMac = useSelector(selectIsMac);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const { commands } = useCommands();
  const { saveCustomization } = useLocalCommandCustomizations();
  const isDarkMode = useSelector(selectDarkMode);
  const { theme } = useAppearance();
  const hasWallpaper = !!theme?.wallpaper;

  const primaryTextColor = 'text-[var(--color-textPrimary)]';
  const secondaryTextColor = hasWallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[var(--color-textSecondary)]';
  const tertiaryTextColor = hasWallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[var(--color-textMuted)]';

  const trackNoteOpen = useCallback((snippet: Snippet) => {
    const snippetId = snippet?.snippet_id || snippet?.id || '';
    trackCounterEvent('note_open_count', {
      source: 'new_tab',
      origin: 'search_suggestions',
      snippetId,
      category: snippet?.category || '',
    });
  }, []);

  const trackLinkOpen = useCallback((urlCount: number, meta?: Record<string, unknown>) => {
    trackCounterEvent('link_open_count', {
      source: 'new_tab',
      origin: 'search_suggestions',
      urlCount,
      ...meta,
    });
  }, []);

  const suggestions = state?.suggestions || [];
  const highlightIndex = state?.highlightIndex || 0;

  const hasLocalMatches = useMemo(() => {
    return suggestions.some(
      s => s._kind !== 'common_command' && !(s._kind === 'command' && s.id === 'google') && s._kind !== 'open_url',
    );
  }, [suggestions]);

  const showNoResultsMessage = useMemo(() => {
    return !hasLocalMatches && state?.value?.trim() && !state?.lockedCommand && suggestions.length > 0;
  }, [hasLocalMatches, state?.value, state?.lockedCommand, suggestions.length]);

  const listRef = useRef<any>(null);
  const itemRefs = useRef<Record<number, HTMLElement | null>>({});
  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [openMenuFor, setOpenMenuFor] = useState<number | null>(null);
  const [menuFocusIndex, setMenuFocusIndex] = useState<number>(-1);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // States for shortcut/hotkey management
  const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
  const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const { captureHotkey } = useHotkeyAssignment(editValue, isMac);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState(false);
  const [isUpdatingHotkey, setIsUpdatingHotkey] = useState(false);
  const [isClearingHotkey, setIsClearingHotkey] = useState(false);
  const [isClearingShortcut, setIsClearingShortcut] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);

  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  const hotkeysMapFromRedux = useSelector((state: any) => state.allData?.hotkeysMap || {});
  const [extensionCommands, setExtensionCommands] = useState<any[]>([]);

  // Scheduling state
  const [schedulingAutomationFor, setSchedulingAutomationFor] = useState<any>(null);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [isScheduling, setIsScheduling] = useState(false);

  // Debounced real-time validation for duplicates
  useEffect(() => {
    const timer = setTimeout(async () => {
      setSaveError(null);
      setConflictId(null);

      if (editingHotkeyFor && editValue) {
        const allHotkeys = await readAllHotkeys();
        const currentSnippetId = extractSnippetIdFromCompoundId(editingHotkeyFor || '');
        const existingEntry = Object.entries(allHotkeys).find(
          ([id, hk]) => hk === editValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId,
        );
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${editValue}" is already assigned to "${conflictName}"`
            : `Hotkey "${editValue}" is already assigned`;
          setSaveError(msg);
          setConflictId(conflictingId);
        }
      } else if (editingShortcutFor && editValue) {
        let normalized = editValue.trim();
        if (normalized && !normalized.startsWith('/')) {
          normalized = `/${normalized}`;
        }
        const allShortcuts = await readAllShortcuts();
        const currentSnippetId = extractSnippetIdFromCompoundId(editingShortcutFor || '');
        const existingEntry = Object.entries(allShortcuts).find(
          ([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId,
        );
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Shortcut "${normalized}" is already assigned to "${conflictName}"`
            : `Shortcut "${normalized}" is already assigned`;
          setSaveError(msg);
          setConflictId(conflictingId);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [editValue, editingHotkeyFor, editingShortcutFor, allData]);

  useEffect(() => {
    const handleTriggerTodo = (e: any) => {
      
      const data = e.detail || {};
      dispatch(setTodoCreatePrefill(data.item || null));
      if (data.item) {
        dispatch(setShowTodosView(true));
        onRequestClear?.();
      }
    };
    window.addEventListener('trigger-add-todo', handleTriggerTodo);
    return () => window.removeEventListener('trigger-add-todo', handleTriggerTodo);
  }, [dispatch]);

  // Close the searchbar when 'close-searchbar' is fired (e.g. from right-click Create Todo in sheet view)
  useEffect(() => {
    const handleCloseSearchbar = () => {
      onRequestClear?.();
    };
    window.addEventListener('close-searchbar', handleCloseSearchbar);
    return () => window.removeEventListener('close-searchbar', handleCloseSearchbar);
  }, [onRequestClear]);

  const getItemCompoundIdInternal = useCallback((item: any) => {
    if (!item) return '';
    if (item._kind === 'snippet') {
      return getItemCompoundId(item);
    }
    if (item._kind === 'automation' || (item as any).type === 'automation') {
      return String(item.automation?.id || item.id || '');
    }
    if (item._kind === 'module') {
      return String(item.id || '');
    }
    return String(item.id || '');
  }, []);

  const getAutomationId = useCallback((item: any): string => {
    return String(item?.automation?.id || item?.id || '');
  }, []);

  const toggleAutomationFavorite = useCallback(
    async (item: any) => {
      const automationId = getAutomationId(item);
      if (!automationId || !userId || !chromeAny?.storage?.local) return;

      const currentlyFav = getIsFavorite(automationId);
      const nextFav = !currentlyFav;

      try {
        await updateAutomationRealtime(userId, {
          automation_id: automationId,
          is_favourite: nextFav,
        });

        const result: any = await new Promise(resolve => chromeAny.storage.local.get('myFavouriteItems', resolve));
        const favItems = result.myFavouriteItems || {};
        const currentFavList: any[] = favItems[userId] || [];

        const updatedFavList = nextFav
          ? [{ ...(item.automation || item), id: automationId, category: 'automation', fav: true }, ...currentFavList]
          : currentFavList.filter(fav => String(fav.id) !== automationId);

        await new Promise<void>(resolve =>
          chromeAny.storage.local.set({ myFavouriteItems: { ...favItems, [userId]: updatedFavList } }, resolve),
        );

        dispatch(
          setCommandStatus({
            status: 'success',
            message: nextFav ? 'Added to favourites' : 'Removed from favourites',
          }),
        );
        setTimeout(() => dispatch(resetCommandStatus()), 2500);
      } catch (error) {
        console.error('[SearchSuggestions] Failed toggling automation favorite:', error);
        dispatch(setCommandStatus({ status: 'error', message: 'Failed to update favourite' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      }
    },
    [chromeAny, dispatch, getAutomationId, getIsFavorite, userId],
  );

  const findConflictingItemName = useCallback(
    (compoundId: string) => {
      // 1. Check local commands first
      const cmd = commands.find(c => c.id === compoundId);
      if (cmd) return cmd.label;

      // 2. Check suggestions in current state
      const sugg = suggestions.find(s => {
        if (s._kind === 'snippet') {
          return getItemCompoundIdInternal(s) === compoundId;
        }
        return false;
      });
      if (sugg && sugg._kind === 'snippet') return sugg.snippet?.key;

      const moduleSuggestion = suggestions.find(
        s => (s as any)._kind === 'module' && getItemCompoundIdInternal(s) === compoundId,
      ) as ModuleSuggestionItem | undefined;
      if (moduleSuggestion) return moduleSuggestion.module?.name || moduleSuggestion.module?.module_key;

      if (!allData) return null;

      // 3. Check all snippets in Redux (Teams -> Workspaces -> Folders)
      const allDataArray = Array.isArray(allData) ? allData : [];
      for (const team of allDataArray) {
        const { workspaces = [] } = team;
        for (const ws of workspaces) {
          const snippets = ws.workspace_snippets || [];
          for (const s of snippets) {
            const sId = s.snippet_id || s.id;
            const compound = `${ws.workspace_id}-${sId}`;
            if (compound === compoundId || String(sId) === compoundId) return s.key;
          }
          for (const f of ws.folders || []) {
            // Check if the conflicting ID is the folder itself
            if (f.folder_id === compoundId || (f as any).id === compoundId) {
              return f.folder_name;
            }
            for (const s of f.snippets || []) {
              const sId = s.snippet_id || s.id;
              const compound = `${f.folder_id}-${sId}`;
              if (compound === compoundId || String(sId) === compoundId) return s.key;
            }
          }
        }
      }

      return null;
    },
    [allData, commands, suggestions, getItemCompoundIdInternal],
  );

  const saveShortcut = useCallback(
    async (item: any, shortcutValue: string) => {
      const compoundId = getItemCompoundIdInternal(item);
      const itemId =
        item._kind === 'command' || item._kind === 'aggregate' || item._kind === 'common_command'
          ? item.id
          : compoundId;

      let normalizedShortcut = shortcutValue.trim();
      if (normalizedShortcut && !normalizedShortcut.startsWith('/')) {
        normalizedShortcut = `/${normalizedShortcut}`;
      }

      if (!normalizedShortcut) {
        setIsSaving(true);
        setIsClearingShortcut(true);
        dispatch(setCommandStatus({ status: 'loading', message: 'Clearing...' }));
        try {
          if (item._kind === 'command' || item._kind === 'aggregate' || item._kind === 'common_command') {
            const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === item.id);
            if (isLocalCommand) {
              await saveCustomization({ command_id: item.id, prefix: '' });
            } else {
              try {
                await updateCommandAndRefresh(item.id, { prefix: '' });
              } catch (e) {
                console.warn('Cloud clear shortcut failed', e);
              }
            }
          } else if (item._kind === 'automation' || (item as any).type === 'automation') {
            const automationId = getAutomationId(item);
            if (automationId && userId) {
              await updateAutomationRealtime(userId, {
                automation_id: automationId,
                shortcuts: null,
              });
            }
            await updateLocalShortcut(
              String(itemId),
              automationId,
              '',
              item.automation?.name || 'Automation',
              'automation',
            );
          } else {
            const snippetId = extractSnippetIdFromCompoundId(compoundId);
            try {
              await updateSnippetShortcut(snippetId, '');
            } catch (e) {
              console.warn('Cloud clear snippet shortcut failed', e);
            }
            const type = (item.snippet?.category || '').toLowerCase() === 'link' ? 'link' : 'note';
            await updateLocalShortcut(
              compoundId,
              snippetId,
              '',
              item.snippet?.key || 'Snippet',
              type,
              type === 'link' ? 'link' : undefined,
            );
          }
          dispatch(setCommandStatus({ status: 'success', message: 'Shortcut cleared' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          // Refresh maps
          const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
          setHotkeysMap(allHotkeys);
          setShortcutsMap(allShortcuts);
        } catch (e: any) {
          console.error('[SearchSuggestions] Failed to clear shortcut:', e);
          dispatch(setCommandStatus({ status: 'error', message: 'Failed to clear shortcut' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
        } finally {
          setIsSaving(false);
          setIsClearingShortcut(false);
          setEditingShortcutFor(null);
          setEditValue('');
        }
        return;
      }

      // Check for duplicates
      const allShortcuts = await readAllShortcuts();
      const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
      const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalizedShortcut && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

      if (existingEntry) {
        const conflictingId = existingEntry[0];
        const conflictName = findConflictingItemName(conflictingId);
        const msg = conflictName
          ? `Shortcut "${normalizedShortcut}" is already assigned to "${conflictName}"`
          : `Shortcut "${normalizedShortcut}" is already assigned`;

        setSaveError(msg);
        setConflictId(conflictingId);
        return;
      }

      setIsSaving(true);
      dispatch(setCommandStatus({ status: 'loading', message: isUpdatingShortcut ? 'Updating...' : 'Saving...' }));

      try {
        if (item._kind === 'command' || item._kind === 'aggregate' || item._kind === 'common_command') {
          const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === item.id);
          if (isLocalCommand) {
            await saveCustomization({ command_id: item.id, prefix: normalizedShortcut });
          } else {
            try {
              await updateCommandAndRefresh(item.id, { prefix: normalizedShortcut });
            } catch (e) {
              console.warn('Cloud sync shortcut failed', e);
            }
          }
        } else if (item._kind === 'automation' || (item as any).type === 'automation') {
          const automationId = getAutomationId(item);
          if (automationId && userId) {
            await updateAutomationRealtime(userId, {
              automation_id: automationId,
              shortcuts: normalizedShortcut,
            });
          }
          await updateLocalShortcut(
            String(itemId),
            automationId,
            normalizedShortcut,
            item.automation?.name || 'Automation',
            'automation',
          );
        } else {
          // Handle Snippet Shortcut
          const snippetId = extractSnippetIdFromCompoundId(compoundId);
          try {
            await updateSnippetShortcut(snippetId, normalizedShortcut);
          } catch (e) {
            console.warn('Cloud sync snippet shortcut failed', e);
          }

          const type = (item.snippet?.category || '').toLowerCase() === 'link' ? 'link' : 'note';
          await updateLocalShortcut(
            compoundId,
            snippetId,
            normalizedShortcut,
            item.snippet?.key,
            type,
            type === 'link' ? 'link' : undefined,
          );
        }

        dispatch(setCommandStatus({ status: 'success', message: 'Saved successfully' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
        // Refresh maps
        const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
        setHotkeysMap(allHotkeys);
        setShortcutsMap(allShortcuts);

        // Force global refresh for commands
        if (item._kind !== 'snippet') {
          dispatch(fetchAllDataThunk() as any);
        }
      } catch (error: any) {
        console.error('Failed to save shortcut:', error);
        dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to sync shortcut' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } finally {
        setIsSaving(false);
        setEditingShortcutFor(null);
        setEditValue('');
        setSaveError(null);
      }
    },
    [dispatch, findConflictingItemName, getItemCompoundIdInternal, getAutomationId, suggestions, userId],
  );

  const saveHotkey = useCallback(
    async (item: any, hotkeyValue: string, shouldClose = true) => {
      const compoundId = getItemCompoundIdInternal(item);
      const itemId =
        item._kind === 'command' || item._kind === 'aggregate' || item._kind === 'common_command'
          ? item.id
          : compoundId;

      if (hotkeyValue) {
        // 1. Check for Extension Command conflicts (Fixed hotkeys like Alt+S, Alt+K)
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        const targetNormal = normalize(hotkeyValue);

        const conflictExtCmd = extensionCommands.find((cmd: any) => {
          if (!cmd.shortcut) return false;
          return normalize(cmd.shortcut) === targetNormal;
        });

        if (conflictExtCmd) {
          const msg = `Hotkey is reserved by extension`;
          setSaveError(msg);
          return;
        }

        // 2. Check for duplicates
        const allHotkeys = await readAllHotkeys();
        const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === hotkeyValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${hotkeyValue}" is already assigned to "${conflictName}"`
            : `Hotkey "${hotkeyValue}" is already assigned`;

          setSaveError(msg);
          setConflictId(conflictingId);
          return;
        }
      }

      if (!hotkeyValue) {
        setIsClearingHotkey(true);
      }
      dispatch(
        setCommandStatus({
          status: 'loading',
          message: !hotkeyValue ? 'Clearing...' : isUpdatingHotkey ? 'Updating...' : 'Saving...',
        }),
      );

      try {
        if (item._kind === 'command' || item._kind === 'aggregate' || item._kind === 'common_command') {
          // Check if it's a local command
          const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === item.id);

          if (isLocalCommand) {
            // For local commands, use saveCustomization
            await saveCustomization({ command_id: item.id, hotkey: hotkeyValue });
            await updateLocalHotkey(item.id, hotkeyValue, 'command');
          } else {
            // For remote commands, try cloud sync first
            let result: any = null;
            try {
              result = await updateHotkeyAndRefresh(item.id, hotkeyValue);
            } catch (e) {
              console.warn('Cloud sync hotkey failed', e);
            }
            // If result is empty, it means no installation ID (e.g. browser command), so fallback to local
            if (!result || result.length === 0) {
              await updateLocalHotkey(item.id, hotkeyValue, 'command');
            }
          }
        } else if (item._kind === 'automation' || (item as any).type === 'automation') {
          const automationId = getAutomationId(item);
          if (automationId && userId) {
            await updateAutomationRealtime(userId, {
              automation_id: automationId,
              hotkeys: hotkeyValue || null,
            });
          }
          await updateLocalHotkey(String(itemId), hotkeyValue, 'automation');
        } else if (item._kind === 'module') {
          const moduleId = String(item.module?.module_id || '');
          if (moduleId) {
            try {
              if (hotkeyValue) {
                await assignModuleHotkey(moduleId, hotkeyValue);
              } else {
                await removeModuleHotkey(moduleId, hotkeyValue);
              }
            } catch (e) {
              console.warn('Cloud sync module hotkey failed', e);
            }
          }
          await updateLocalHotkey(String(itemId), hotkeyValue, 'module');
        } else {
          // Snippets
          const snippetId = extractSnippetIdFromCompoundId(compoundId);
          try {
            await updateSnippetHotkey(snippetId, hotkeyValue);
          } catch (e) {
            console.warn('Cloud sync snippet hotkey failed', e);
          }

          const cat = (item.snippet?.category || '').toLowerCase();
          const type = ['link', 'links', 'quicklink', 'biolink', 'biolinks', 'tabgroup', 'tab group'].includes(cat)
            ? 'link'
            : 'note';
          await updateLocalHotkey(compoundId, hotkeyValue, type as any);
        }

        // Refresh maps
        const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
        setHotkeysMap(allHotkeys);
        setShortcutsMap(allShortcuts);

        dispatch(setCommandStatus({ status: 'success', message: !hotkeyValue ? 'Hotkey cleared' : 'Hotkey saved' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
        // Force global refresh for commands
        if (item._kind !== 'snippet') {
          dispatch(fetchAllDataThunk() as any);
        }
      } catch (error: any) {
        console.error('Failed to save/clear hotkey:', error);
        dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to update hotkey' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } finally {
        setIsSaving(false);
        setIsClearingHotkey(false);
        if (shouldClose) {
          setEditingHotkeyFor(null);
          setEditValue('');
          setSaveError(null);
        } else {
          setEditValue(hotkeyValue);
          setSaveError(null);
        }
      }
    },
    [
      dispatch,
      findConflictingItemName,
      getItemCompoundIdInternal,
      extensionCommands,
      getAutomationId,
      saveError,
      userId,
    ],
  );

  const handleOverwriteHotkey = useCallback(async () => {
    if (!conflictId || !editingHotkeyFor) return;
    const item = suggestions.find(s => {
      return getItemCompoundIdInternal(s) === editingHotkeyFor;
    });
    if (!item) return;

    setIsSaving(true);
    setSaveError('Overwriting existing hotkey...');

    try {
      const isCommand =
        conflictId && (COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId));
      const isAutomationConflict =
        !!conflictId &&
        suggestions.some(
          s =>
            ((s as any)._kind === 'automation' || (s as any).type === 'automation') &&
            getItemCompoundIdInternal(s) === conflictId,
        );
      const isModule =
        !!conflictId &&
        (conflictId.startsWith('module:') ||
          suggestions.some(s => (s as any)._kind === 'module' && getItemCompoundIdInternal(s) === conflictId));

      if (isCommand) {
        // Check if local
        const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
        if (isLocal) {
          await saveCustomization({ command_id: conflictId!, hotkey: '' });
          await updateLocalHotkey(conflictId!, '', 'command');
        } else {
          try {
            await updateHotkeyAndRefresh(conflictId as any, '');
          } catch (e) {
            console.warn('Cloud overwrite clear hotkey failed', e);
          }
          await updateLocalHotkey(conflictId!, '', 'command');
        }
      } else if (isModule) {
        const moduleId = conflictId.includes(':') ? conflictId.split(':')[1] : conflictId;
        try {
          await removeModuleHotkey(moduleId);
        } catch (e) {
          console.warn('Cloud overwrite clear module hotkey failed', e);
        }
        await updateLocalHotkey(conflictId, '', 'module');
      } else if (isAutomationConflict) {
        const automationId = conflictId;
        if (userId && automationId) {
          try {
            await updateAutomationRealtime(userId, {
              automation_id: automationId,
              hotkeys: null,
            });
          } catch (e) {
            console.warn('Cloud overwrite clear automation hotkey failed', e);
          }
        }
        await updateLocalHotkey(conflictId, '', 'automation');
      } else {
        const sId = extractSnippetIdFromCompoundId(conflictId!);
        try {
          await updateSnippetHotkey(sId, '');
        } catch (e) {
          console.warn('Cloud overwrite clear snippet hotkey failed', e);
        }
        await updateLocalHotkey(conflictId!, '', 'note');
        await updateLocalHotkey(conflictId!, '', 'link');
      }

      await saveHotkey(item, editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      setSaveError('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  }, [
    conflictId,
    editingHotkeyFor,
    suggestions,
    editValue,
    saveHotkey,
    getItemCompoundIdInternal,
    saveCustomization,
    userId,
  ]);

  const handleOverwriteShortcut = useCallback(async () => {
    if (!conflictId || !editingShortcutFor) return;
    const item = suggestions.find(s => {
      if (s._kind === 'snippet') return getItemCompoundIdInternal(s) === editingShortcutFor;
      return (s as any).id === editingShortcutFor;
    });
    if (!item) return;

    setIsSaving(true);
    setSaveError('Overwriting existing shortcut...');

    try {
      const isCommand =
        conflictId && (COMMANDS.some(c => c.id === conflictId) || LOCAL_COMMANDS.some(c => c.id === conflictId));
      const isAutomationConflict =
        !!conflictId &&
        suggestions.some(
          s =>
            ((s as any)._kind === 'automation' || (s as any).type === 'automation') &&
            getItemCompoundIdInternal(s) === conflictId,
        );

      if (isCommand) {
        const isLocal = LOCAL_COMMANDS.some(c => c.id === conflictId);
        if (isLocal) {
          await saveCustomization({ command_id: conflictId!, prefix: '' });
        } else {
          try {
            await updateCommandAndRefresh(conflictId as any, { prefix: '' });
          } catch (e) {
            console.warn('Cloud overwrite clear shortcut failed', e);
          }
        }
      } else if (isAutomationConflict) {
        const automationId = conflictId;
        if (userId && automationId) {
          try {
            await updateAutomationRealtime(userId, {
              automation_id: automationId,
              shortcuts: null,
            });
          } catch (e) {
            console.warn('Cloud overwrite clear automation shortcut failed', e);
          }
        }
        await updateLocalShortcut(conflictId!, automationId!, '', '', 'automation');
      } else {
        const sId = extractSnippetIdFromCompoundId(conflictId!);
        try {
          await updateSnippetShortcut(sId, '');
        } catch (e) {
          console.warn('Cloud overwrite clear snippet shortcut failed', e);
        }
        await updateLocalShortcut(conflictId!, sId, '', '', 'note');
        await updateLocalShortcut(conflictId!, sId, '', '', 'link');
      }

      await saveShortcut(item, editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      setSaveError('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  }, [
    conflictId,
    editingShortcutFor,
    suggestions,
    editValue,
    saveShortcut,
    getItemCompoundIdInternal,
    saveCustomization,
    userId,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditingShortcutFor(null);
    setEditingHotkeyFor(null);
    setEditValue('');
    setSaveError(null);
    setConflictId(null);
  }, []);

  const handleGoToConflict = useCallback(() => {
    if (conflictId) {
      dispatch(setHighlightedCommandId(conflictId));
      dispatch(setIsCommandListView(true));
      setOpenMenuFor(null);
    }
  }, [conflictId, dispatch]);

  // Real-time duplicate check
  useEffect(() => {
    const timer = setTimeout(async () => {
      const activeId = editingHotkeyFor || editingShortcutFor;
      if (!activeId || !editValue) {
        setSaveError(null);
        setConflictId(null);
        return;
      }

      const itemId = activeId;
      const item = suggestions.find(s => {
        if (s._kind === 'snippet') return getItemCompoundIdInternal(s) === activeId;
        return (s as any).id === activeId;
      });
      if (!item) return;

      if (editingHotkeyFor) {
        // 1. Check for Extension Command conflicts first
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        const targetNormal = normalize(editValue);

        const conflictExtCmd = extensionCommands.find((cmd: any) => {
          if (!cmd.shortcut) return false;
          return normalize(cmd.shortcut) === targetNormal;
        });

        if (conflictExtCmd) {
          setSaveError(`Hotkey is reserved by extension`);
          setConflictId('extension-reserved');
          return;
        }

        // 2. Check for duplicates
        const allHotkeys = await readAllHotkeys();
        const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === editValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${editValue}" is already assigned to "${conflictName}"`
            : `Hotkey "${editValue}" is already assigned`;
          setSaveError(msg);
          setConflictId(conflictingId);
        } else {
          setSaveError(null);
          setConflictId(null);
        }
      } else if (editingShortcutFor) {
        let normalized = editValue.trim().toLowerCase();
        if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;

        if (normalized) {
          const allShortcuts = await readAllShortcuts();
          const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
          const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Shortcut "${normalized}" is already assigned to "${conflictName}"`
              : `Shortcut "${normalized}" is already assigned`;
            setSaveError(msg);
            setConflictId(conflictingId);
          } else {
            setSaveError(null);
            setConflictId(null);
          }
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    editValue,
    editingHotkeyFor,
    editingShortcutFor,
    suggestions,
    getItemCompoundIdInternal,
    findConflictingItemName,
  ]);

  // Load hotkeys and shortcuts from storage and listen for changes
  useEffect(() => {
    let mounted = true;
    const loadMaps = async () => {
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      if (!mounted) return;
      setHotkeysMap(allHotkeys);
      setShortcutsMap(allShortcuts);
    };

    loadMaps();

    // Fetch extension commands (fixed hotkeys)
    if (chromeAny?.commands?.getAll) {
      chromeAny.commands.getAll((cmds: any[]) => {
        if (mounted && cmds) {
          setExtensionCommands(cmds);
        }
      });
    }

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (
        changes.alts_command_hotkeys ||
        changes.alts_link_hotkeys ||
        changes.alts_note_hotkeys ||
        changes.alts_automation_hotkeys ||
        changes.alts_module_hotkeys ||
        changes.alts_commands ||
        changes.link_commands ||
        changes.note_commands
      ) {
        loadMaps();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(highlightIndex);
    }
  }, [highlightIndex, suggestions]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuFor) return;
    const handleClickOutside = (event: MouseEvent) => {
      const anchor = itemRefs.current[openMenuFor];
      const menu = menuRefs.current[openMenuFor];
      const target = event.target as Node;

      if (anchor?.contains(target) || menu?.contains(target)) return;

      // Check if click is inside the UnifiedContextMenu (which uses a Portal)
      if ((target as Element).closest('[data-unified-menu="true"]')) return;

      setOpenMenuFor(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuFor]);

  useEffect(() => {
    if (!openMenuFor) {
      setMenuFocusIndex(-1);
    }
  }, [openMenuFor]);

  const [selectedAIs, setSelectedAIs] = useState<string[]>(['gpt', 'perplexity']);
  const [setupAIFor, setSetupAIFor] = useState<string | null>(null);

  // AI services available for selection
  const AI_SERVICES = useMemo(
    () => [
      { id: 'gpt', label: 'ChatGPT' },
      { id: 'claude', label: 'Claude' },
      { id: 'perplexity', label: 'Perplexity' },
      { id: 'gemini', label: 'Gemini' },
    ],
    [],
  );

  const toggleAI = useCallback((aiId: string) => {
    setSelectedAIs(prev => {
      const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ selectedAIs: newSelection });
      }
      return newSelection;
    });
  }, []);

  const [windowDimensions, setWindowDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync selectedAIs with chrome storage
  useEffect(() => {
    const loadSelectedAIs = () => {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('selectedAIs', (result: any) => {
          if (result.selectedAIs && Array.isArray(result.selectedAIs)) {
            setSelectedAIs(result.selectedAIs);
          } else {
            setSelectedAIs(DEFAULT_SELECTED_AIS);
          }
        });
      }
    };

    loadSelectedAIs();

    const chromeAny = (window as any)?.chrome;
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.selectedAIs) {
        setSelectedAIs(changes.selectedAIs.newValue || DEFAULT_SELECTED_AIS);
      }
    };

    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(handleStorageChange);
    }
    return () => {
      if (chromeAny?.storage?.onChanged) {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  // Calculate dynamic values with tiered scaling for large screens
  const { dynamicFontSize, dynamicRowHeight, dynamicPadding } = useMemo(() => {
    const width = windowDimensions.width;

    let fontSize = 13.5;
    let rowHeight = 44;
    let py = 8;
    let px = 12; // Aligned with left-3 (12px)

    // Scaling for larger screens
    if (width >= 1800) {
      fontSize = 16;
      rowHeight = 54;
      py = 10;
      px = 16; // 12 + 4
    } else if (width >= 1600) {
      fontSize = 15;
      rowHeight = 49;
      py = 9;
      px = 14; // 12 + 2
    }

    return {
      dynamicFontSize: fontSize,
      dynamicRowHeight: rowHeight,
      dynamicPadding: { py, px },
    };
  }, [windowDimensions.width]);

  // Calculate max list height based on window dimensions
  const maxListHeight = useMemo(() => {
    const height = windowDimensions.height;
    const width = windowDimensions.width;
    // Use 40% of viewport height for smaller screens, 48% for larger
    const percentage = width >= 1600 ? 0.48 : 0.40;
    return Math.max(height * percentage, 350);
  }, [windowDimensions.height, windowDimensions.width]);

  const openNoteInNewTab = useCallback((snippetId: string) => {
    if (!snippetId) return;
    trackCounterEvent('note_open_count', { source: 'new_tab', origin: 'search_suggestions', snippetId });
    const chromeAny = (window as any)?.chrome;
    let extensionUrl = '';
    if (chromeAny?.runtime?.getURL) {
      extensionUrl = chromeAny.runtime.getURL(
        `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
      );
    } else if (chromeAny?.runtime?.id) {
      const extensionId = chromeAny.runtime.id;
      extensionUrl = `chrome-extension://${extensionId}/new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`;
    }
    if (!extensionUrl) return;
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'open_tab', url: extensionUrl }, (response: any) => {
        if (chromeAny.runtime.lastError) {
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url: extensionUrl });
          } else {
            window.open(extensionUrl, '_blank');
          }
        }
      });
      return;
    }
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url: extensionUrl });
    } else {
      window.open(extensionUrl, '_blank');
    }
  }, []);

  const buildMenuActions = useCallback(
    (item: any): MenuAction[] => {
      if (!item || state?.isPromptMenuOpen) return [];

      if (item._kind === 'automation' || (item as any).type === 'automation') {
        const itemId = getItemCompoundIdInternal(item);
        const automationId = getAutomationId(item);
        const isFav = getIsFavorite(automationId);
        const actions: MenuAction[] = [
          {
            key: 'run',
            label: 'Run automation',
            icon: <FiPlay size={14} />,
            onSelect: () => {
              state?.onAutomationSelect?.(item.automation);
              setOpenMenuFor(null);
            },
          },
          {
            key: 'edit',
            label: 'Edit automation',
            icon: <FiEdit2 size={14} />,
            onSelect: () => {
              state?.onAutomationEdit?.(item.automation);
              setOpenMenuFor(null);
            },
          },
          {
            key: 'favorite',
            label: isFav ? 'Remove from favourites' : 'Mark as favourite',
            icon: <FiStar size={14} className={isFav ? 'fill-yellow-400 text-yellow-400' : ''} />,
            closeOnExecute: false,
            onSelect: async () => {
              await toggleAutomationFavorite(item);
              setOpenMenuFor(null);
            },
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <FiTrash2 size={14} />,
            className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
            onSelect: async () => {
              try {
                // Delete from chrome.storage.local
                const result = await chrome.storage.local.get(['automations']);
                const currentAutomations = result.automations || {};
                delete currentAutomations[item.automation.id];
                await chrome.storage.local.set({ automations: currentAutomations });

                // You may want to trigger a refresh here if you have a reload function
                // For now, it will just close the menu.
              } catch (e) {
                console.error('[SearchSuggestions] Failed to delete automation', e);
              }
              setOpenMenuFor(null);
            },
          },
          { divider: true },
          {
            key: 'assign-shortcut',
            label: shortcutsMap[itemId] ? `Assign a Text Command (${shortcutsMap[itemId]})` : 'Assign a Text Command',
            icon: <MdOutlineShortcut size={14} className="text-blue-600 dark:text-blue-400" />,
            closeOnExecute: false,
            onSelect: async () => {
              const allShortcuts = await readAllShortcuts();
              const existingValue = allShortcuts[itemId] || '';
              setEditingShortcutFor(itemId);
              setEditingHotkeyFor(null);
              setEditValue(existingValue.replace(/^\//, ''));
              setIsUpdatingShortcut(!!existingValue);
              setSaveError(null);
            },
          },
          {
            key: 'assign-hotkey',
            label: hotkeysMap[itemId]
              ? `Assign a Keyboard Shortcut (${hotkeysMap[itemId]})`
              : 'Assign a Keyboard Shortcut',
            icon: <BsKeyboard size={14} className="text-blue-600 dark:text-blue-400" />,
            closeOnExecute: false,
            onSelect: async () => {
              const allHotkeys = await readAllHotkeys();
              const existingValue = allHotkeys[itemId] || '';
              setEditingHotkeyFor(itemId);
              setEditingShortcutFor(null);
              setEditValue(existingValue);
              setIsUpdatingHotkey(!!existingValue);
              setSaveError(null);
            },
          },
          {
            key: 'schedule',
            label: 'Schedule',
            icon: <FaRegClock size={14} className="text-amber-500" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  id: item.automation?.id || item.id || '',
                  key: item.automation?.name || item.name || 'New Task',
                  value: item.automation?.id || item.id || '',
                  category: 'automation',
                  openAutomatically: true,
                  event_deadline: item.automation?.event_deadline,
                  is_recurring: item.automation?.is_recurring,
                  recurring_cycle: item.automation?.recurring_cycle,
                  reminder: item.automation?.reminder,
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
          {
            key: 'create-todo',
            label: 'Create Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  id: item.automation?.id || item.id || '',
                  key: item.automation?.name || item.name || 'New Task',
                  value: item.automation?.id || item.id || '',
                  category: 'automation',
                  openAutomatically: false,
                  event_deadline: item.automation?.event_deadline,
                  is_recurring: item.automation?.is_recurring,
                  recurring_cycle: item.automation?.recurring_cycle,
                  reminder: item.automation?.reminder,
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
        ];

        return actions;
      }

      if (item._kind === 'module') {
        const itemId = getItemCompoundIdInternal(item);
        const actions: MenuAction[] = [
          {
            key: 'run',
            label: 'Run module',
            icon: <FiPlay size={14} />,
            onSelect: () => {
              state?.onModuleSelect?.(item.module);
              setOpenMenuFor(null);
            },
          },
          { divider: true },
          {
            key: 'assign-hotkey',
            label: hotkeysMap[itemId]
              ? `Assign a Keyboard Shortcut (${hotkeysMap[itemId]})`
              : 'Assign a Keyboard Shortcut',
            icon: <BsKeyboard size={14} className="text-blue-600 dark:text-blue-400" />,
            closeOnExecute: false,
            onSelect: async () => {
              const allHotkeys = await readAllHotkeys();
              const existingValue = allHotkeys[itemId] || '';
              setEditingHotkeyFor(itemId);
              setEditingShortcutFor(null);
              setEditValue(existingValue);
              setIsUpdatingHotkey(!!existingValue);
              setSaveError(null);
            },
          },
          {
            key: 'schedule',
            label: 'Schedule',
            icon: <FaRegClock size={14} className="text-amber-500" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  id: item.module?.module_id || item.id || '',
                  key: item.module?.name || item.name || 'New Task',
                  value: item.module?.module_id || item.id || '',
                  category: 'module',
                  openAutomatically: true,
                  event_deadline: item.module?.event_deadline,
                  is_recurring: item.module?.is_recurring,
                  recurring_cycle: item.module?.recurring_cycle,
                  reminder: item.module?.reminder,
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
          {
            key: 'create-todo',
            label: 'Create Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  id: item.module?.module_id || item.id || '',
                  key: item.module?.name || item.name || 'New Task',
                  value: item.module?.module_id || item.id || '',
                  category: 'module',
                  openAutomatically: false,
                  event_deadline: item.module?.event_deadline,
                  is_recurring: item.module?.is_recurring,
                  recurring_cycle: item.module?.recurring_cycle,
                  reminder: item.module?.reminder,
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
        ];

        return actions;
      }

      const isCommand = item._kind === 'command' || item._kind === 'aggregate' || item._kind === 'common_command';
      const isSnippet = item._kind === 'snippet';
      const isHistory = item._kind === 'history';
      const isBookmark = item._kind === 'bookmark';
      const isLocalEntity = item._kind === 'local_entity';
      const isFolder = item._kind === 'folder_search';
      const isOpenUrl = item._kind === 'open_url';

      if (isCommand) {
        const isFav = getIsFavorite(item.id);
        const actions: MenuAction[] = [
          {
            key: 'run',
            label: 'Run command',
            icon: <FiPlay size={14} />,
            onSelect: () => {
              if (state && state.onCommandMouseDown) {
                const cmdId = item.id;
                const fakeEvent = { preventDefault: () => { }, stopPropagation: () => { } } as any;
                state.onCommandMouseDown(fakeEvent, cmdId);
              }
              setOpenMenuFor(null);
            },
          },
        ];

        if (state && state.onToggleFavorite) {
          actions.push({
            key: 'favorite',
            label: isFav ? 'Remove from favourites' : 'Mark as favourite',
            icon: <FiStar size={14} className={isFav ? 'fill-yellow-400 text-yellow-400' : ''} />,
            closeOnExecute: false,
            onSelect: () => {
              state.onToggleFavorite?.(item);
            },
          });
        }

        // Only show AI toggle menu actions if the right panel is NOT active
        // When setupAIFor === 'ai', the AIServiceSelectionPanel handles selection
        if (item.id === 'ai' && setupAIFor !== 'ai') {
          actions.push({
            key: 'header-ai',
            label: 'Select Models',
            icon: null,
            disabled: true,
            className: 'text-[10px] font-bold text-neutral-400 dark:text-neutral-500 px-3 py-1 select-none',
            onSelect: () => { },
          });
          AI_SERVICES.forEach(service => {
            const isSelected = selectedAIs.includes(service.id);
            const cmd = commands.find(c => c.id === service.id);
            actions.push({
              key: `toggle-ai-${service.id}`,
              label: service.label,
              icon: (
                <div className="flex items-center gap-2">
                  {isSelected ? (
                    <FiCheckSquare className="text-purple-600 dark:text-purple-400 flex-shrink-0" size={14} />
                  ) : (
                    <FiSquare className="text-[var(--color-iconDefault)] flex-shrink-0" size={14} />
                  )}
                  <div className="w-4 h-4 rounded overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white flex items-center justify-center flex-shrink-0">
                    <img src={getFaviconUrl(cmd?.iconHost || '')} alt="" className="w-3 h-3 object-contain" />
                  </div>
                </div>
              ),
              closeOnExecute: false,
              onSelect: () => toggleAI(service.id),
            });
          });
          actions.push({ divider: true });
        }

        const itemId = getItemCompoundIdInternal(item);

        actions.push({
          key: 'assign-shortcut',
          label: shortcutsMap[itemId] ? 'Assign a Text Command' : 'Assign a Text Command',
          icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
          closeOnExecute: false,
          onSelect: async () => {
            const allShortcuts = await readAllShortcuts();
            const existingValue = allShortcuts[itemId] || '';
            setEditingShortcutFor(itemId);
            setEditingHotkeyFor(null);
            setEditValue(existingValue.replace(/^\//, ''));
            setIsUpdatingShortcut(!!existingValue);
            setSaveError(null);
          },
        });

        actions.push({
          key: 'assign-hotkey',
          label: hotkeysMap[itemId]
            ? `Assign a Keyboard Shortcut (${hotkeysMap[itemId]})`
            : 'Assign a Keyboard Shortcut',
          icon: <BsKeyboard size={14} className="text-blue-600 dark:text-blue-400" />,
          closeOnExecute: false,
          onSelect: async () => {
            const allHotkeys = await readAllHotkeys();
            const existingValue = allHotkeys[itemId] || '';
            setEditingHotkeyFor(itemId);
            setEditingShortcutFor(null);
            setEditValue(existingValue);
            setIsUpdatingHotkey(!!existingValue);
            setSaveError(null);
          },
        });

        actions.push({
          key: 'schedule',
          label: 'Schedule',
          icon: <FaRegClock size={14} className="text-amber-500" />,
          onSelect: () => {
            dispatch(
              setTodoCreatePrefill({
                id: item.id,
                key: item.label || item.name || 'New Task',
                value: item.urlTemplate || item.url || item.id || '',
                category: 'command',
                openAutomatically: true,
                event_deadline: (item as any).event_deadline,
                is_recurring: (item as any).is_recurring,
                recurring_cycle: (item as any).recurring_cycle,
                reminder: (item as any).reminder,
              }),
            );
            dispatch(setShowTodosView(true));
            onRequestClear?.();
            setOpenMenuFor(null);
          },
        });

        actions.push({
          key: 'create-todo',
          label: 'Create Todo',
          icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
          onSelect: () => {
            dispatch(
              setTodoCreatePrefill({
                id: item.id,
                key: item.label || item.name || 'New Task',
                value: item.urlTemplate || item.url || item.id || '',
                category: 'command',
                openAutomatically: false,
                event_deadline: (item as any).event_deadline,
                is_recurring: (item as any).is_recurring,
                recurring_cycle: (item as any).recurring_cycle,
                reminder: (item as any).reminder,
              }),
            );
            dispatch(setShowTodosView(true));
            onRequestClear?.();
            setOpenMenuFor(null);
          },
        });

        return actions;
      }

      if (isSnippet) {
        const { snippet, workspace, folder } = item;
        const category = (snippet?.category || '').toLowerCase();
        const isNote = category === 'snippet' || category === 'prompt';
        const isPrompt = category === 'prompt';
        const isLink = category === 'link' || category === 'links';
        const isTabGroup = category === 'tabgroup' || category === 'tab group';
        const snippetSuggestion: SnippetSuggestion = { snippet, workspace, folder };

        const isFav = getIsFavorite(snippet.snippet_id || snippet.id);

        const actions: MenuAction[] = [
          {
            key: 'open',
            label: isTabGroup ? 'Open tabs' : isLink ? 'Open link' : 'Open in current tab',
            icon: isTabGroup ? (
              <FiExternalLink size={14} />
            ) : isLink ? (
              <FiExternalLink size={14} />
            ) : (
              <FiFileText size={14} />
            ),
            onSelect: () => {
              if (isNote) {
                if (isPrompt) {
                  // Prompts open in the dashboard editor
                  trackNoteOpen(snippet);
                  if (state && state.onSnippetSelect) state.onSnippetSelect(snippetSuggestion);
                } else {
                  // Notes open in full screen in CURRENT tab
                  const snippetId = snippet.snippet_id || snippet.id;
                  if (snippetId) {
                    trackNoteOpen(snippet);
                    const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${snippetId}`);
                    window.location.href = url;
                  }
                }
              } else {
                let urls: string[] = [];
                if (typeof snippet.value === 'string') {
                  const raw = snippet.value as string;
                  try {
                    const parsed = JSON.parse(raw || '{}');
                    if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
                      urls = parsed.urls as string[];
                    } else if (raw.startsWith('http')) {
                      urls = [raw];
                    }
                  } catch {
                    if (raw.startsWith('http')) {
                      urls = [raw];
                    }
                  }
                } else if (snippet?.value && typeof snippet.value === 'object' && 'urls' in (snippet.value as any)) {
                  urls = ((snippet.value as any).urls || []) as string[];
                }
                if (!urls.length && isLink && typeof snippet.value === 'string') {
                  urls = [snippet.value as string];
                }
                if (urls.length) {
                  trackLinkOpen(urls.length, {
                    snippetId: snippet.snippet_id || snippet.id,
                  });
                  if (state && state.onRequestOpenUrls) state.onRequestOpenUrls(urls, snippet.key);
                }
              }
              setOpenMenuFor(null);
            },
          },
          {
            key: 'schedule',
            label: 'Schedule',
            icon: <FaRegClock size={14} className="text-amber-500" />,
            onSelect: () => {
              // Robustly extract the URL for the 'value' field
              let linkValue = snippet.snippet_id || snippet.id;
              if (isLink || isTabGroup) {
                const rawValue = snippet.value;
                if (typeof rawValue === 'string') {
                  if (rawValue.startsWith('http')) {
                    linkValue = rawValue;
                  } else {
                    try {
                      const parsed = JSON.parse(rawValue);
                      if (parsed?.urls?.[0]) {
                        linkValue = parsed.urls[0];
                      } else if (parsed?.url) {
                        linkValue = parsed.url;
                      }
                    } catch (e) {
                      // Not JSON or missing fields, keep ID as fallback
                    }
                  }
                } else if (rawValue?.urls?.[0]) {
                  linkValue = rawValue.urls[0];
                } else if (rawValue?.url) {
                  linkValue = rawValue.url;
                }
              }

              dispatch(
                setTodoCreatePrefill({
                  id: snippet.snippet_id || snippet.id,
                  key: snippet.key || 'New Task',
                  value: linkValue,
                  category: category,
                  openAutomatically: true,
                  event_deadline: snippet.event_deadline,
                  is_recurring: snippet.is_recurring,
                  recurring_cycle: snippet.recurring_cycle,
                  reminder: snippet.reminder,
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
          {
            key: 'create-todo',
            label: 'Create Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              let linkValue = snippet.snippet_id || snippet.id;
              if (isLink || isTabGroup) {
                const rawValue = snippet.value;
                if (typeof rawValue === 'string') {
                  if (rawValue.startsWith('http')) {
                    linkValue = rawValue;
                  } else {
                    try {
                      const parsed = JSON.parse(rawValue);
                      if (parsed?.urls?.[0]) {
                        linkValue = parsed.urls[0];
                      } else if (parsed?.url) {
                        linkValue = parsed.url;
                      }
                    } catch (e) { }
                  }
                } else if (rawValue?.urls?.[0]) {
                  linkValue = rawValue.urls[0];
                } else if (rawValue?.url) {
                  linkValue = rawValue.url;
                }
              }

              dispatch(
                setTodoCreatePrefill({
                  id: snippet.snippet_id || snippet.id,
                  key: snippet.key || 'New Task',
                  value: linkValue,
                  category: category,
                  openAutomatically: false,
                  event_deadline: snippet.event_deadline,
                  is_recurring: snippet.is_recurring,
                  recurring_cycle: snippet.recurring_cycle,
                  reminder: snippet.reminder,
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
          ...(isNote && !isPrompt
            ? [
              {
                key: 'open-new-tab',
                label: 'Open in full screen',
                icon: <FiExternalLink size={14} />,
                onSelect: () => {
                  const snippetId = snippet.snippet_id || snippet.id;
                  if (snippetId) {
                    openNoteInNewTab(snippetId);
                  }
                  setOpenMenuFor(null);
                },
              },
            ]
            : []),
          {
            key: 'edit',
            label: isTabGroup ? 'Edit routine' : isLink ? 'Edit link' : isPrompt ? 'Edit prompt' : 'Edit note',
            icon: <FiEdit2 size={14} />,
            onSelect: () => {
              if (isTabGroup) {
                if (state && state.onRequestEditLink) {
                  state.onRequestEditLink(snippetSuggestion);
                } else {
                  window.dispatchEvent(
                    new CustomEvent('openBulkEditor', {
                      detail: { snippet, workspace, folder },
                    }),
                  );
                }
              } else if (isLink) {
                if (state && state.onRequestEditLink) state.onRequestEditLink(snippetSuggestion);
              } else {
                if (state && state.onSnippetSelect) state.onSnippetSelect(snippetSuggestion);
              }
              setOpenMenuFor(null);
            },
            closeOnExecute: !isLink && !isTabGroup,
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <FiTrash2 size={14} />,
            className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
            onSelect: () => {
              if (state && state.onRequestSnippetDelete) {
                const detail = {
                  snippetId: snippet.snippet_id || snippet.id,
                  snippetKey: snippet.key,
                  folderId: folder?.folder_id || null,
                  workspaceId: workspace?.workspace_id || '',
                  orgId: workspace?.team_id || snippet?.team_id || '',
                  category: snippet.category || 'snippet',
                };
                state.onRequestSnippetDelete(detail);
              }
              setOpenMenuFor(null);
            },
          },
        ];

        if (state && state.onToggleFavorite) {
          actions.push({
            key: 'favorite',
            label: isFav ? 'Remove from favourites' : 'Mark as favourite',
            icon: <FiStar size={14} className={isFav ? 'fill-yellow-400 text-yellow-400' : ''} />,
            closeOnExecute: false,
            onSelect: () => {
              state.onToggleFavorite?.(snippetSuggestion);
            },
          });
        }
        const compoundId = getItemCompoundIdInternal(item as any);
        const currentShortcut = shortcutsMap[compoundId];
        

        actions.push({
          key: 'assign-shortcut',
          label: currentShortcut ? `Assign a Text Command (${currentShortcut})` : 'Assign a Text Command',
          icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
          className: 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50',
          closeOnExecute: false,
          onSelect: async () => {
            const allShortcuts = await readAllShortcuts();
            const existingValue = allShortcuts[compoundId] || '';
            setEditingShortcutFor(compoundId);
            setEditingHotkeyFor(null);
            setEditValue(existingValue.replace(/^\//, ''));
            setIsUpdatingShortcut(!!existingValue);
            setSaveError(null);
          },
        });

        actions.push({
          key: 'assign-hotkey',
          label: hotkeysMap[compoundId]
            ? `Assign a Keyboard Shortcut (${hotkeysMap[compoundId]})`
            : 'Assign a Keyboard Shortcut',
          icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
          className: 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50',
          closeOnExecute: false,
          onSelect: async () => {
            const allHotkeys = await readAllHotkeys();
            const existingValue = allHotkeys[compoundId] || '';
            setEditingHotkeyFor(compoundId);
            setEditingShortcutFor(null);
            setEditValue(existingValue);
            setIsUpdatingHotkey(!!existingValue);
            setSaveError(null);
          },
        });

        return actions;
      }

      if (isOpenUrl) {
        const urls = item.url.split(',').filter(Boolean);
        const urlCount = urls.length;
        const actions: MenuAction[] = [
          {
            key: 'open',
            // Show count if multiple URLs are present
            label: urlCount > 1 ? `Open ${urlCount} sites` : 'Open',
            icon: <FiExternalLink size={14} />,
            onSelect: () => {
              if (item.url) {
                const urlsToOpen = item.url.split(',').filter(Boolean);
                trackLinkOpen(urlsToOpen.length, { itemType: 'open_url' });
                if (state && state.onRequestOpenUrls) state.onRequestOpenUrls(urlsToOpen, item.displayUrl);
              }
              setOpenMenuFor(null);
            },
          },
          {
            key: 'convert-to-todo',
            label: 'Convert to Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  snippet_id: `link-${item.id}`,
                  key: item.displayUrl || 'Open Link',
                  value: item.url || '',
                  category: 'link',
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
          {
            key: 'create-link',
            label: 'Create link',
            icon: <FaLink size={14} />,
            onSelect: () => {
              const tempSnippet: Snippet = {
                id: null,
                key: item.displayUrl || 'Link', // Use displayUrl as title/key
                value: item.url || '',
                category: 'link',
                workspace_id: selectedWorkspace?.workspace_id || '',
                folder_id: selectedFolder?.folder_id || undefined,
                tags: [],
                is_favorite: false,
                snippet_id: null,
              } as any;

              dispatch(setSelectedSnippet(null));
              dispatch(
                openLinkEditModal({
                  editMode: false,
                  snippet: null,
                  prefill: tempSnippet,
                }),
              );
              setOpenMenuFor(null);
            },
          },
        ];
        return actions;
      }

      if (isHistory || isBookmark || isLocalEntity) {
        const url = item.url;
        const actions: MenuAction[] = [];

        actions.push(
          {
            key: 'open',
            label: 'Open',
            icon: <FiExternalLink size={14} />,
            onSelect: () => {
              if (url) {
                trackLinkOpen(1, { itemType: isHistory ? 'history' : isBookmark ? 'bookmark' : 'link' });
                if (state && state.onRequestOpenUrls) state.onRequestOpenUrls([url], item.title);
              }
              setOpenMenuFor(null);
            },
          },
          {
            key: 'convert-to-todo',
            label: 'Convert to Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  snippet_id: `${isHistory ? 'hist' : 'bkmk'}-${item.id}`,
                  key: item.title || 'Open Link',
                  value: item.url || '',
                  category: isHistory ? 'history' : isBookmark ? 'bookmark' : 'link',
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
          {
            key: 'create-link',
            label: 'Create link',
            icon: <FaLink size={14} />,
            onSelect: () => {
              const tempSnippet: Snippet = {
                id: null,
                key: item.title || '',
                value: item.url || '',
                category: 'link',
                workspace_id: selectedWorkspace?.workspace_id || '',
                folder_id: selectedFolder?.folder_id || undefined,
                tags: [],
                is_favorite: false,
                snippet_id: null,
              } as any;

              dispatch(setSelectedSnippet(null));
              dispatch(
                openLinkEditModal({
                  editMode: false,
                  snippet: null,
                  prefill: tempSnippet,
                }),
              );
              setOpenMenuFor(null);
            },
          },
        );
        return actions;
      }

      if (isFolder) {
        const actions: MenuAction[] = [
          {
            key: 'open',
            label: 'Open folder',
            icon: <FaFolderOpen size={14} />,
            onSelect: () => {
              if (state && state.onFolderMouseDown && item.folder) {
                state.onFolderMouseDown({} as any, item.folder);
              }
            },
          },
        ];
        return actions;
      }

      if (item._kind === 'common_command') {
        const actions: MenuAction[] = [];

        const currentShortcut = shortcutsMap[item.id];
        actions.push({
          key: 'assign-shortcut',
          label: currentShortcut ? `Assign a Text Command (${currentShortcut})` : 'Assign a Text Command',
          icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
          className: 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50',
          closeOnExecute: false,
          onSelect: async () => {
            const allShortcuts = await readAllShortcuts();
            const existingValue = allShortcuts[item.id] || ''; // Use ID directly for commands
            setEditingShortcutFor(item.id);
            setEditingHotkeyFor(null);
            setEditValue(existingValue.replace(/^\//, ''));
            setIsUpdatingShortcut(!!existingValue);
            setSaveError(null);
          },
        });

        actions.push({
          key: 'assign-hotkey',
          label: 'Assign a Keyboard Shortcut',
          icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
          className: 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50',
          closeOnExecute: false,
          onSelect: async () => {
            const allHotkeys = await readAllHotkeys();
            const existingValue = allHotkeys[item.id] || '';
            setEditingHotkeyFor(item.id);
            setEditingShortcutFor(null);
            setEditValue(existingValue);
            setIsUpdatingHotkey(!!existingValue);
            setSaveError(null);
          },
        });

        if (hotkeysMap[item.id]) {
          actions.push({
            key: 'div-clear',
            label: '',
            icon: null,
            onSelect: () => { },
            divider: true,
          });
          actions.push({
            key: 'clear-hotkey',
            label: 'Clear hotkey',
            icon: <FiZapOff size={14} />,
            className: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
            onSelect: () => {
              saveHotkey(item, '');
            },
            shortcut: (
              <span className="font-mono text-[10px] opacity-75 border border-orange-200 dark:border-orange-900/40 rounded px-1 min-w-0 truncate max-w-[80px] text-right">
                {hotkeysMap[item.id]}
              </span>
            ),
          });
        }

        actions.push({
          key: 'convert-to-todo',
          label: 'Create Todo',
          icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
          onSelect: () => {
            dispatch(
              setTodoCreatePrefill({
                snippet_id: `cmd-${item.id}`,
                key: item.label || 'New Task',
                value: item.id || '',
                category: 'command',
                is_todo_type: false,
              }),
            );
            dispatch(setShowTodosView(true));
            onRequestClear?.();
            setOpenMenuFor(null);
          },
        });

        return actions;
      }

      if (item._kind === 'agent_collection') {
        const actions: MenuAction[] = [
          {
            key: 'open',
            label: 'Run collection',
            icon: <FiPlay size={14} />,
            onSelect: () => {
              state?.onAgentCollectionSelect?.(item);
              setOpenMenuFor(null);
            },
          },
          {
            key: 'create-todo',
            label: 'Create Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              dispatch(
                setTodoCreatePrefill({
                  snippet_id: `ac-${item.title}`,
                  key: item.title || 'New Task',
                  value: item.title || '',
                  category: 'agent_collection',
                }),
              );
              dispatch(setShowTodosView(true));
              onRequestClear?.();
              setOpenMenuFor(null);
            },
          },
        ];
        return actions;
      }

      return [];
    },
    [
      state,
      openNoteInNewTab,
      getIsFavorite,
      getAutomationId,
      getItemCompoundIdInternal,
      findConflictingItemName,
      hotkeysMap,
      shortcutsMap,
      saveHotkey,
      saveShortcut,
      selectedAIs,
      toggleAutomationFavorite,
      toggleAI,
    ],
  );

  const toggleActionMenu = useCallback(
    (targetIndex: number, clientX?: number, clientY?: number, forceOpen: boolean = false) => {
      setOpenMenuFor(prev => {
        if (prev === targetIndex && !forceOpen) return null;
        return targetIndex;
      });

      if (clientX !== undefined && clientY !== undefined) {
        setMenuPos({
          x: clientX,
          y: clientY,
        });
      } else {
        const el = itemRefs.current[targetIndex];
        if (el) {
          const rect = el.getBoundingClientRect();
          // Use bottom-left or bottom-right?
          // Previous logic was right-aligned. Let's start with bottom-left or stick to mouse pos logic.
          // InteractiveItemsList uses x=rect.right, y=rect.bottom. Let's match that.
          setMenuPos({
            x: rect.right,
            y: rect.bottom + 5,
          });
        }
      }
      setMenuFocusIndex(() => {
        const item = suggestions[targetIndex];
        if (!item) return 0;
        let actions = buildMenuActions(item);
        if (!userId) {
          actions = actions.filter(
            a => !['favorite', 'assign-shortcut', 'assign-hotkey', 'schedule', 'create-todo', 'convert-to-todo', 'create-link'].includes(a.key as string)
          );
          actions = actions.filter((a, i, arr) => {
            if (a.divider) {
               if (i === 0) return false;
               if (!arr.slice(i + 1).some(x => !x.divider)) return false;
               if (arr[i-1].divider) return false;
            }
            return true;
          });
        }
        const firstAction = actions.findIndex(a => !a.divider);
        return firstAction >= 0 ? firstAction : 0;
      });
    },
    [],
  );

  const executeMenuAction = useCallback(
    (action: MenuAction) => {
      if ('divider' in action && action.divider) return;
      if (action.disabled) return;
      
      const requiresLogin = ['favorite', 'assign-shortcut', 'assign-hotkey', 'schedule', 'create-todo', 'convert-to-todo', 'create-link'].includes(action.key as string);
      if (requiresLogin && !userId) {
        triggerToast('Please login to use the extension', 'error');
        return;
      }

      action.onSelect();
      if (action.closeOnExecute !== false) {
        setOpenMenuFor(null);
      }
    },
    [setOpenMenuFor, userId],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // HARD FIX: If favorites context menu is open, ignore ALL navigation/keys here
      if ((window as any).isFavoritesMenuOpen) return;

      if (!state?.isVisible || state?.isPromptMenuOpen) return;

      const isAltE = (event.altKey || event.metaKey) && event.key.toLowerCase() === 'e';
      // Changed from ArrowLeft to Ctrl+ArrowRight to trigger options menu
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlRightArrow = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'ArrowRight';
      const isTriggerKey = isCtrlRightArrow || isAltE;

      if (isTriggerKey) {
        if (event.repeat) return;
        if (highlightIndex >= 0 && suggestions[highlightIndex]) {
          event.preventDefault();
          event.stopPropagation(); // Prevent event from reaching Searchbar
          toggleActionMenu(highlightIndex);
        }
        return;
      }

      // Handle menu navigation and interaction
      if (openMenuFor !== null) {
        const item = suggestions[openMenuFor];
        let actions = buildMenuActions(item);
        if (!userId) {
          actions = actions.filter(
            a => !['favorite', 'assign-shortcut', 'assign-hotkey', 'schedule', 'create-todo', 'convert-to-todo', 'create-link'].includes(a.key as string)
          );
          actions = actions.filter((a, i, arr) => {
            if (a.divider) {
               if (i === 0 || i === arr.length - 1) return false;
               if (arr[i-1].divider) return false;
            }
            return true;
          });
        }
        if (actions.length === 0) return;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          let next = (menuFocusIndex + 1) % actions.length;
          while (actions[next]?.divider && next !== menuFocusIndex) {
            next = (next + 1) % actions.length;
          }
          setMenuFocusIndex(next);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          let prev = (menuFocusIndex - 1 + actions.length) % actions.length;
          while (actions[prev]?.divider && prev !== menuFocusIndex) {
            prev = (prev - 1 + actions.length) % actions.length;
          }
          setMenuFocusIndex(prev);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          if (menuFocusIndex >= 0 && menuFocusIndex < actions.length) {
            executeMenuAction(actions[menuFocusIndex]);
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpenMenuFor(null);
        }
        return;
      }

      if (event.key === 'Escape' && openMenuFor !== null) {
        event.preventDefault();
        setOpenMenuFor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to intercept before Searchbar
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    state?.isVisible,
    highlightIndex,
    suggestions,
    openMenuFor,
    toggleActionMenu,
    menuFocusIndex,
    buildMenuActions,
    executeMenuAction,
    state?.isPromptMenuOpen,
    userId,
  ]);

  const focusedSuggestion = useMemo(() => {
    if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
      return suggestions[highlightIndex];
    }
    return null;
  }, [highlightIndex, suggestions]);

  const isSnippet = useMemo(() => {
    return focusedSuggestion?._kind === 'snippet';
  }, [focusedSuggestion]);

  const isAutomation = useMemo(() => {
    return focusedSuggestion?._kind === 'automation';
  }, [focusedSuggestion]);

  const isModule = useMemo(() => {
    return focusedSuggestion?._kind === 'module';
  }, [focusedSuggestion]);

  const hasActions = useMemo(() => {
    const actionsPresent = Boolean(
      state?.onRequestEditLink || state?.onRequestSnippetDelete || state?.onToggleFavorite,
    );
    const isCommand =
      (focusedSuggestion as any)?._kind === 'command' ||
      (focusedSuggestion as any)?._kind === 'aggregate' ||
      (focusedSuggestion as any)?._kind === 'common_command';

    if (isCommand || isAutomation || isModule) {
      return true; // Commands, Automations, and Modules always have options
    }
    return isSnippet && actionsPresent;
  }, [
    isSnippet,
    isAutomation,
    isModule,
    state?.onRequestEditLink,
    state?.onRequestSnippetDelete,
    state?.onToggleFavorite,
    focusedSuggestion,
  ]);

  const firstOtherGroupIndex = useMemo(() => {
    if (state?.mode !== 'mixed') return -1;

    // Prefer explicit "other history" section start when available.
    const firstOtherHistory = suggestions.findIndex((s: any) => s._kind === 'history' && s.isOtherResult);
    if (firstOtherHistory >= 0) return firstOtherHistory;

    // If we have regular search matches and then common AI commands,
    // treat the first common command as the start of "Other results".
    const firstCommon = suggestions.findIndex((s: any) => s._kind === 'common_command');
    if (firstCommon < 0) return -1;

    const hasNonCommonResults = suggestions.some((s: any) => s._kind !== 'common_command');
    return hasNonCommonResults ? firstCommon : -1;
  }, [state?.mode, suggestions]);

  const firstPersonalSnippetIndex = useMemo(() => {
    if (!state?.value?.startsWith('/')) return -1;
    return suggestions.findIndex((s: any) => s._kind === 'snippet' && s.isPersonal);
  }, [suggestions, state?.value]);

  const firstOrgSnippetIndex = useMemo(() => {
    if (!state?.value?.startsWith('/')) return -1;
    return suggestions.findIndex((s: any) => s._kind === 'snippet' && s.isPersonal === false);
  }, [suggestions, state?.value]);

  const showHeading = useMemo(() => {
    if (suggestions.length === 0) return false;
    // In 'common' mode, there are only common commands (no actual search results)
    if (state?.mode === 'common') return false;
    // Show heading only if we have actual search results (non-AI results)
    return suggestions.some((s: any) => s._kind !== 'common_command');
  }, [suggestions, state?.mode]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [suggestions, state?.value, state?.mode, state?.highlightIndex, firstOtherGroupIndex, dynamicRowHeight]);

  // Chrome omnibox-style inline autocomplete: Calculate autocomplete text for first history result
  useEffect(() => {
    const onInlineAutocompleteChange = state?.onInlineAutocompleteChange;
    if (!onInlineAutocompleteChange) return;

    const query = (state?.value || '').trim().toLowerCase();
    const currentHighlight = state?.highlightIndex || 0;

    // Only show autocomplete when on the first item (index 0) and not in @ mode and NOT backspacing
    if (currentHighlight !== 0 || !query || query.length === 0 || state?.isAtMenuOpen || state?.isBackspacing) {
      onInlineAutocompleteChange(null);
      return;
    }

    // Get the first suggestion
    const firstItem = suggestions[0];
    if (!firstItem) {
      onInlineAutocompleteChange(null);
      return;
    }

    // Handle history suggestions
    if (firstItem._kind === 'history') {
      const historyItem = firstItem as HistorySuggestionItem;
      const displayUrl = historyItem.url.replace(/^https?:\/\//, '').replace(/^www\./, '');

      // Try title first
      if (historyItem.title && historyItem.title.toLowerCase().startsWith(query)) {
        onInlineAutocompleteChange(`${historyItem.title}|URL|${displayUrl}`);
        return;
      }

      // Try URL without protocol
      if (displayUrl.toLowerCase().startsWith(query)) {
        onInlineAutocompleteChange(displayUrl);
        return;
      }
    }

    // Handle bookmark suggestions
    if (firstItem._kind === 'bookmark') {
      const bookmarkItem = firstItem as BookmarkSuggestionItem;
      if (bookmarkItem.title && bookmarkItem.title.toLowerCase().startsWith(query)) {
        onInlineAutocompleteChange(bookmarkItem.title);
        return;
      }
    }

    // No autocomplete match found
    onInlineAutocompleteChange(null);
  }, [suggestions, state?.value, state?.highlightIndex, state?.onInlineAutocompleteChange, state?.isAtMenuOpen]);

  const getItemSize = useCallback(
    (index: number) => {
      const item = suggestions[index];
      if (!item) return dynamicRowHeight;

      let size = dynamicRowHeight;
      const trimmedQuery = (state?.value || '').trim();
      const mode = state?.mode;
      const isActive = index === highlightIndex;
      const hasImages = !!(state?.selectedImagesCount && state.selectedImagesCount > 0);

      // 1. Add height for headings (approx 24-27px)
      if (mode === 'common') {
        if (index === 0 && trimmedQuery && !hasImages) {
          size += 24;
        }
      } else if (mode === 'mixed') {
        if (item._kind === 'common_command' && index === 0 && trimmedQuery && !hasImages) {
          size += 24;
        } else if (index === firstOtherGroupIndex) {
          size += 24;
        } else if (index === firstPersonalSnippetIndex) {
          size += 24;
        } else if (index === firstOrgSnippetIndex) {
          size += 24;
        }
      }

      // 2. Add height for active state extra info (approx 16-20px)
      // Only for types that render extra lines when isActive
      if (isActive) {
        // @ts-ignore
        if (item._kind === 'command' || item._kind === 'common_command' || item._kind === 'aggregate') {
          size += 16;
        }
      }

      if (item._kind === 'math_result' || (item as any)._kind === 'time_result') {
        size += 14;
      }

      if ((item as any)._kind === 'time_result') {
        const resultsCount = (item as any as TimeSuggestionItem).results?.length || 1;
        const rowsCount = Math.ceil(resultsCount / 2);
        if (rowsCount > 1) {
          size += (rowsCount - 1) * 26 + 10; // Slightly increased for 18.5px font
        }
      }
      return size;
    },
    [
      suggestions,
      state?.value,
      state?.mode,
      highlightIndex,
      state?.selectedImagesCount,
      firstOtherGroupIndex,
      dynamicRowHeight,
    ],
  );

  // Helper function to get all URLs from a snippet (for tabgroups)
  // NOTE: Must be defined BEFORE the early return below to avoid React #310 hooks-order violation
  const getSnippetAllUrls = (snippet: any): string[] => {
    if (!snippet) return [];
    let urls: string[] = [];

    if (typeof snippet.value === 'string') {
      const raw = snippet.value as string;
      try {
        const parsed = JSON.parse(raw || '{}');
        if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
          urls = parsed.urls as string[];
        } else if (raw.startsWith('http')) {
          urls = [raw];
        }
      } catch {
        if (raw.startsWith('http')) {
          urls = [raw];
        }
      }
    } else if (snippet && snippet.value && typeof snippet.value === 'object' && 'urls' in (snippet.value as any)) {
      urls = ((snippet.value as any).urls || []) as string[];
    }

    return urls;
  };

  // NOTE: useCallback MUST be before the early return to satisfy React rules of hooks
  const getMenuTargetMeta = useCallback(
    (item: any): { label: string; iconUrl?: string; icon?: React.ReactNode } | undefined => {
      if (!item) return undefined;

      if (item._kind === 'command' || item._kind === 'common_command') {
        const commandDef = (item as any).command;
        const iconHost = commandDef?.iconHost;
        return {
          label: item.label || commandDef?.label || 'Command',
          iconUrl: iconHost ? getFaviconUrl(iconHost) : undefined,
          icon: iconHost ? undefined : <CmdIcon />,
        };
      }

      if (item._kind === 'aggregate') {
        return {
          label: item.label || 'All AI Chat Agents',
          icon: <FaLayerGroup size={12} />,
        };
      }

      if (item._kind === 'snippet') {
        const category = (item.snippet?.category || '').toLowerCase();
        const isTabGroup = category === 'tabgroup' || category === 'tab group';
        const urls = getSnippetAllUrls(item.snippet);
        const firstUrl = urls[0];
        const fallbackSnippetIcon =
          category === 'prompt' ? (
            <LuSparkles size={12} />
          ) : isTabGroup ? (
            <FaLayerGroup size={12} />
          ) : category === 'link' ||
            category === 'links' ||
            category === 'quicklink' ||
            category === 'biolink' ||
            category === 'biolinks' ? (
            <FaLink size={12} />
          ) : (
            <NotesIcon size={12} className={secondaryTextColor} />
          );
        return {
          label: item.snippet?.key || 'Snippet',
          iconUrl: firstUrl ? getFaviconUrl(firstUrl) : undefined,
          icon: firstUrl ? undefined : fallbackSnippetIcon,
        };
      }

      if (item._kind === 'bookmark') {
        return {
          label: item.title || item.url || 'Bookmark',
          iconUrl: item.url ? getFaviconUrl(item.url) : undefined,
          icon: item.url ? undefined : <FaLink size={12} />,
        };
      }

      if (item._kind === 'history') {
        return {
          label: item.title || item.url || 'History',
          iconUrl: item.url ? getFaviconUrl(item.url) : undefined,
          icon: item.url ? undefined : <FaClock size={12} />,
        };
      }

      if (item._kind === 'open_url') {
        return {
          label: item.displayUrl || item.url || 'Open URL',
          iconUrl: item.url ? getFaviconUrl(item.url.split(',')[0]) : undefined,
          icon: <FaLink size={12} />,
        };
      }

      if (item._kind === 'workspace') {
        return {
          label: item.workspace?.workspace_name || 'Workspace',
          icon: <FaFolder size={12} />,
        };
      }

      if (item._kind === 'folder') {
        return {
          label: item.folder?.folder_name || 'Folder',
          icon: <FaFolderOpen size={12} />,
        };
      }

      if (item._kind === 'folder_search') {
        const isWorkspaceEntry = item.entryType === 'workspace';
        return {
          label: isWorkspaceEntry
            ? item.workspace?.workspace_name || 'Folder'
            : item.folder?.folder_name || 'Sub-folder',
          icon: isWorkspaceEntry ? <FaFolder size={12} /> : <FaFolderOpen size={12} />,
        };
      }

      if (item._kind === 'automation' || item.type === 'automation') {
        return {
          label: item.automation?.name || item.title || 'Automation',
          icon: <AutomationDynamicIcon automation={item.automation || item} size={12} />,
        };
      }

      if (item._kind === 'module') {
        const iconHost = item.module?.icon_host || item.module?.parent_icon_host;
        return {
          label: item.module?.name || item.module?.module_key || 'Module',
          iconUrl: iconHost ? getFaviconUrl(iconHost) : undefined,
          icon: iconHost ? undefined : <FaRobot size={12} />,
        };
      }

      if (item._kind === 'agent_collection') {
        return {
          label: item.title || 'Agent Collection',
          icon: <FaLayerGroup size={12} />,
        };
      }

      return undefined;
    },
    [getSnippetAllUrls, secondaryTextColor],
  );

  if (!state || !state.isVisible || (!state.mode && !state.showAIHistoryPanel)) {
    return null;
  }

  const {
    onCommandMouseDown,
    onHighlightIndexChange,
    onCommonCommandSelect,
    onLocalSelect,
    value,
    footerStatus,
    mode,
  } = state;

  const getRowClasses = (isActive: boolean) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const effectivelyActive = isActive;

    return `relative overflow-hidden min-w-0 w-full flex-1 text-left flex items-center gap-2 group pl-[12px] min-[1600px]:pl-[14px] min-[1800px]:pl-[16px] pr-[12px] min-[1600px]:pr-[14px] min-[1800px]:pr-[16px] transition-all duration-150 ${effectivelyActive
      ? 'bg-white/5 dark:bg-white/[0.07]'
      : isActive && isContextualOpen
        ? 'bg-transparent opacity-80 cursor-default'
        : 'hover:bg-[#fdf6e3]/50 dark:hover:bg-white/5'
      }`;
  };

  const rowStyle: React.CSSProperties = {
    paddingTop: `${dynamicPadding.py}px`,
    paddingBottom: `${dynamicPadding.py}px`,
  };

  const getSuggestionLabel = (item: any) => {
    const kind = item._kind || (item as any).type;
    if (kind === 'command' || kind === 'aggregate' || kind === 'common_command') {
      return 'Command';
    }
    if (kind === 'snippet') {
      const cat = (item.snippet?.category || '').toLowerCase();
      if (['link', 'links', 'quicklink', 'biolink', 'biolinks'].includes(cat)) return 'Links';
      if (cat === 'prompt') return 'Prompt';
      if (cat === 'tabgroup' || cat === 'tab group') return 'Link Group';
      return 'Notes';
    }
    if (kind === 'folder' || kind === 'workspace' || kind === 'folder_search') {
      if (kind === 'folder') return 'Sub-folder';
      if (kind === 'folder_search' && item.entryType === 'folder') return 'Sub-folder';
      return 'Folder';
    }
    if (kind === 'history') return 'History';
    if (kind === 'bookmark') return 'Bookmark';
    return null;
  };

  const getSnippetFirstUrl = (snippet: any): string | null => {
    if (!snippet) return null;
    let urls: string[] = [];
    const category = (snippet.category || '').toLowerCase();

    if (typeof snippet.value === 'string') {
      const raw = snippet.value as string;
      try {
        const parsed = JSON.parse(raw || '{}');
        if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
          urls = parsed.urls as string[];
        } else if (raw.startsWith('http')) {
          urls = [raw];
        }
      } catch {
        if (raw.startsWith('http')) {
          urls = [raw];
        }
      }
    } else if (snippet.value && typeof snippet.value === 'object' && 'urls' in (snippet.value as any)) {
      urls = ((snippet.value as any).urls || []) as string[];
    }

    if (!urls.length && (category === 'link' || category === 'links') && typeof snippet.value === 'string') {
      // If simple value string is url
      if (snippet.value.startsWith('http')) {
        urls = [snippet.value];
      }
    }

    return urls.length > 0 ? urls[0] : null;
  };

  const openLink = (url: string) => {
    trackLinkOpen(1, { method: 'direct' });

    if (url.startsWith('agent_chat?id=')) {
      const agentId = url.split('id=')[1];
      const extensionUrl = chrome.runtime.getURL(
        `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
      );
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.tabs) {
        chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
          if (tabs && tabs[0]) {
            chromeAny.tabs.update(tabs[0].id, { url: extensionUrl });
          } else {
            chromeAny.tabs.create({ url: extensionUrl });
          }
        });
      } else {
        window.location.href = extensionUrl;
      }
      return;
    }

    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs) {
      // Get current active tab and update it instead of creating a new one
      chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs && tabs[0]) {
          chromeAny.tabs.update(tabs[0].id, { url });
        } else {
          // Fallback: create new tab if we can't get current tab
          chromeAny.tabs.create({ url });
        }
      });
    } else {
      window.location.href = url;
    }
  };

  const renderCommandSuggestion = (item: CommandSuggestionItem, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const isAI = item.commandType === 'aggregate';
    const isLocalCommand = item.commandType === 'local' || LOCAL_COMMANDS.some(c => c.id === item.id);
    const showEventDescription = item.commandType === 'remote' && (item.id as string) === 'event';
    const query = (state?.value || '').trim().replace(/^\//, '');

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      onCommandMouseDown(event, item.id);
    };

    let displayLabel = item.label;
    const cmd = (item as any).command;
    if (cmd?.getDynamicLabel) {
      try {
        const context: any = {
          state: store.getState(),
          dispatch: store.dispatch,
          services: {},
        };
        displayLabel = cmd.getDynamicLabel(context);
      } catch (e) {
        console.warn('Failed to get dynamic label for', item.id, e);
      }
    }

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`${item.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className={`${isAI ? 'w-[32px] -ml-[4px]' : 'w-5'} h-5 flex-shrink-0 flex items-center justify-start`}>
            {isAI ? (
              <div className="flex -space-x-1.5 items-center w-[32px]">
                {AI_GROUP.members.slice(0, 3).map(id => {
                  const command = commands.find(x => x.id === id);
                  if (!command) return null;
                  return (
                    <div
                      key={`ai-sugg-${command.id}`}
                      className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                      <img src={getFaviconUrl(command.iconHost)} alt={command.label} className="w-4 h-4 object-cover" />
                    </div>
                  );
                })}
              </div>
            ) : isLocalCommand ? (
              (() => {
                if (item.id === 'settings') {
                  return (
                    <div className="w-5 h-5 flex items-center justify-start text-neutral-500 dark:text-neutral-400 ">
                      {BROWSER_ICONS['settings']}
                    </div>
                  );
                }

                // Check if command has a custom icon
                const localDef = LOCAL_COMMANDS.find(c => c.id === item.id);
                const CustomIcon = item.command?.icon ?? localDef?.icon;
                if (CustomIcon) {
                  return (
                    <div className="w-5 h-5 flex items-center justify-start">
                      {typeof CustomIcon === 'function' ? (
                        <CustomIcon className="w-5 h-5 object-contain" />
                      ) : typeof CustomIcon === 'string' ? (
                        <img
                          src={CustomIcon}
                          style={{ width: 20, height: 20, objectFit: 'contain' }}
                          className="dark:invert opacity-60"
                          alt=""
                        />
                      ) : (
                        CustomIcon
                      )}
                    </div>
                  );
                }

                const Icon =
                  (item as any).command?.action === 'rename' || (localDef as any)?.action === 'rename'
                    ? FaEdit
                    : (item as any).command?.action === 'delete' || (localDef as any)?.action === 'delete'
                      ? FaTrashAlt
                      : null;
                return (
                  <div className="w-5 h-4 flex items-center justify-start text-neutral-500 dark:text-neutral-400">
                    {Icon ? <Icon size={14} /> : <CmdIcon />}
                  </div>
                );
              })()
            ) : item.id === 'google' ? (
              <div className="w-5 h-5 flex items-center justify-start text-black dark:text-white">
                <FaSearch size={14} />
              </div>
            ) : (
              (() => {
                const command = item.command;
                if (!command) return null;
                if (BROWSER_ICONS[command.id]) {
                  return <div className="w-5 h-5 flex items-center justify-start">{BROWSER_ICONS[command.id]}</div>;
                }
                return (
                  <div className="w-5 h-5 rounded-full overflow-hidden">
                    <img src={getFaviconUrl(command.iconHost)} alt={command.label} className="w-5 h-5 object-cover" />
                  </div>
                );
              })()
            )}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {item.id === 'google' ? (
              <>
                <div className="flex items-center min-w-0 flex-1">
                  {/* This span will handle the ellipsis (...) for the long query with highlighting */}
                  <span
                    className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
                    style={headingFontStyle}>
                    {highlightMatch(query, query)}
                  </span>

                  {/* This span will stay fully visible and never truncate */}
                  <span
                    className={`font-light mx-1 flex-shrink-0 whitespace-nowrap ${hasWallpaper ? 'text-[var(--color-textSecondary)]' : 'text-neutral-500'}`}
                    style={headingFontStyle}>
                    - Google search
                  </span>
                </div>
                {/* <div className="w-4 h-4 rounded-full overflow-hidden ml-1 opacity-80">
                  <img
                    src={getFaviconUrl((item as any).command?.iconHost || 'google.com')}
                    alt="Google"
                    className="w-4 h-4 object-cover"
                  />
                </div> */}
              </>
            ) : (
              <span
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
                style={headingFontStyle}>
                {highlightMatch(
                  (item as any).command?.category === 'browser' ? `${BROWSER_NAME} ${displayLabel}` : displayLabel,
                  query,
                )}
              </span>
            )}
            <span className={`text-[10px] tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap ml-1`}>
              {getSuggestionLabel(item)}
            </span>
            <FavoriteStar
              isFav={getIsFavorite(item.id)}
              isActive={effectivelyActive}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                if (state && state.onToggleFavorite) {
                  state.onToggleFavorite(item as any);
                }
              }}
              title={getIsFavorite(item.id) ? 'Remove from favorites' : 'Add to favorites'}
            />
            <HotkeyBadge hotkey={hotkeysMap[item.id] || ''} isActive={effectivelyActive} />
            {/* <ShortcutBadge shortcut={shortcutsMap[item.id] || item.prefix || ''} isActive={isActive} /> */}
          </div>
          <div className="flex flex-col items-end text-right gap-0.5 flex-shrink-0">
            {showEventDescription ? (
              <span
                className={`${tertiaryTextColor} whitespace-nowrap`}
                style={{ fontSize: `${Math.max(11, dynamicFontSize * 0.75)}px` }}>
                Try Schedule my meet at 5:00 PM.
              </span>
            ) : item.description ? (
              <span
                className={`${tertiaryTextColor} truncate transition-opacity ${effectivelyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
                {highlightMatch(item.description, query, {
                  baseClass: tertiaryTextColor,
                  matchClass: `font-semibold ${isDarkMode ? 'text-white' : 'text-[#073642]'}`,
                })}
              </span>
            ) : null}
            {effectivelyActive ? (
              <span
                className={`tracking-wide ${tertiaryTextColor} whitespace-nowrap flex items-center gap-1`}
                style={{ fontSize: `${Math.max(10, dynamicFontSize * 0.7)}px` }}>
                {isLocalCommand ? (
                  `Press Enter to ${item.label}`
                ) : (item as any).command?.category === 'browser' ? (
                  `Open ${BROWSER_NAME} ${item.label}`
                ) : (
                  <></>
                )}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  const renderOpenUrlSuggestion = (item: OpenUrlSuggestionItem, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      openLink(item.url);
    };

    // Truncate long URLs similar to bookmarks
    const truncateUrl = (url: string, maxLength: number = 60) => {
      if (url.length <= maxLength) return url;
      return url.substring(0, maxLength) + '...';
    };

    const urls = item.url.split(',').filter(Boolean);
    const urlCount = urls.length;
    const query = (state?.value || '').trim();

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`open-url-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className="w-5 h-5 flex items-center justify-start text-neutral-500 dark:text-neutral-400">
              <FaLink size={14} />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 min-w-0 pr-8">
          <span
            className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
            style={headingFontStyle}>
            {urlCount > 1 ? `Open sites ${urlCount} identified` : item.displayUrl}
          </span>
          <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
            Command
          </span>
          <span
            className={`${tertiaryTextColor} truncate min-w-0`}
            style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
            {truncateUrl(item.displayUrl)}
          </span>
        </div>
      </button>
    );
  };

  const renderAgentCollectionSuggestion = (item: AgentCollectionSuggestionItem, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const query = (state?.value || '').trim();
    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      state?.onAgentCollectionSelect?.(item);
    };

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`ac-${item.title}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              <FaLayerGroup size={12} />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={headingFontStyle}>
              {highlightMatch(item.title, query)}
            </span>
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
              Agent Collection
            </span>
          </div>
          <span className="text-right text-[10px] text-neutral-400">
            {effectivelyActive ? 'Press Enter to open collection' : ''}
          </span>
        </div>
      </button>
    );
  };

  const renderAutomationSuggestion = (item: AutomationSuggestionItem, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const query = (state?.value || '').trim();
    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      state?.onAutomationSelect?.(item.automation);
    };

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`automation-${item.automation.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              <AutomationDynamicIcon automation={item.automation} size={14} />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={headingFontStyle}>
              {highlightMatch(item.automation.name, query)}
            </span>
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap `}>
              Automation
            </span>
            <HotkeyBadge hotkey={hotkeysMap[item.automation.id] || ''} isActive={effectivelyActive} />
          </div>
          <span className="text-right text-[10px] text-neutral-400">
            {effectivelyActive ? 'Press Enter to run' : ''}
          </span>
        </div>
      </button>
    );
  };

  const renderModuleSuggestion = (item: ModuleSuggestionItem, idx: number) => {
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const query = (state?.value || '').trim();
    const moduleName = item.module?.name || item.module?.module_key || 'Module';
    const iconHost = item.module?.icon_host || item.module?.parent_icon_host;

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      state?.onModuleSelect?.(item.module);
    };

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`module-${item.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {iconHost ? (
                <img src={getFaviconUrl(iconHost)} alt="" className="w-5 h-5 object-cover" />
              ) : (
                <FaRobot size={12} />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={headingFontStyle}>
              {highlightMatch(moduleName, query)}
            </span>
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap `}>
              Automation module
            </span>
            <HotkeyBadge hotkey={hotkeysMap[item.id] || ''} isActive={effectivelyActive} />
          </div>
          <span className="text-right text-[10px] text-neutral-400">
            {effectivelyActive ? 'Press Enter to run' : ''}
          </span>
        </div>
      </button>
    );
  };

  const renderCommonCommandSuggestion = (item: CommonCommandSuggestionItem, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const query = (state?.value || '').trim().replace(/^\//, '');

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      onCommonCommandSelect?.(item);
    };

    const command = item.command;
    if (!command) return null;
    const localDef = LOCAL_COMMANDS.find(c => c.id === item.id);
    const customIcon = command.icon ?? localDef?.icon;

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`common-${item.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-9 h-5 flex-shrink-0 flex items-center justify-start">
            {item.id === 'google' ? (
              <div className={`w-5 h-5 flex items-center justify-start ${secondaryTextColor}`}>
                <FaSearch size={14} />
              </div>
            ) : item.id === 'ai' ? (
              // Stacked AI icons for "All AI" command - use fixed ones
              <div className="flex -space-x-1.5">
                {(() => {
                  const targetAIs = AI_GROUP.members;
                  return targetAIs.slice(0, 4).map((aiId, idx) => {
                    const aiCommand = commands.find(c => c.id === aiId) || COMMANDS.find(c => c.id === aiId);
                    if (!aiCommand) return null;
                    return (
                      <div
                        key={`ai-common-${aiId}-${idx}`}
                        className="w-4 h-4 rounded-full flex items-center justify-start overflow-hidden border border-white/50 dark:border-neutral-700/50">
                        <img
                          src={getFaviconUrl(aiCommand.iconHost)}
                          alt={aiCommand.label}
                          className="w-4 h-4 object-cover"
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            ) : customIcon ? (
              <div className="w-5 h-5 flex items-center justify-start">
                {typeof customIcon === 'function' ? (
                  (() => {
                    const IconComponent = customIcon as React.ComponentType<{ className?: string; size?: number }>;
                    return <IconComponent className="w-5 h-5 object-contain" size={16} />;
                  })()
                ) : typeof customIcon === 'string' ? (
                  <img src={customIcon} className="w-5 h-5 object-contain dark:invert opacity-60" alt="" />
                ) : (
                  customIcon
                )}
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full overflow-hidden">
                <img src={getFaviconUrl(command.iconHost)} alt={command.label} className="w-5 h-5 object-cover" />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {item.id === 'google' ? (
              <>
                <div className="flex items-center min-w-0 flex-1">
                  {/* This span will handle the ellipsis (...) for the long query with highlighting */}
                  <span
                    className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
                    style={headingFontStyle}>
                    {highlightMatch(query, query)}
                  </span>

                  {/* This span will stay fully visible and never truncate */}
                  <span
                    className="text-neutral-500 font-light mx-1 flex-shrink-0 whitespace-nowrap"
                    style={headingFontStyle}>
                    - Google search
                  </span>
                </div>
                {/* <div className="w-4 h-4 rounded-full overflow-hidden ml-1 opacity-80">
                  <img src={getFaviconUrl(command.iconHost)} alt="Google" className="w-4 h-4 object-cover" />
                </div> */}
              </>
            ) : (
              <span
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
                style={headingFontStyle}>
                {highlightMatch(item.label, query)}
              </span>
            )}
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
              {getSuggestionLabel(item)}
            </span>
            <FavoriteStar
              isFav={getIsFavorite(item.id)}
              isActive={effectivelyActive}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                toggleAutomationFavorite(item);
              }}
            />
            <HotkeyBadge hotkey={hotkeysMap[item.id] || ''} isActive={effectivelyActive} />
            {/* <ShortcutBadge shortcut={shortcutsMap[item.id] || ''} isActive={isActive} /> */}
          </div>
          <div className="flex flex-col items-end text-right gap-0.5 flex-shrink-0">
            <span
              className={`${tertiaryTextColor} truncate text-right transition-opacity ${effectivelyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
              {highlightMatch(item.description, query, {
                baseClass: tertiaryTextColor,
                matchClass: `font-semibold ${isDarkMode ? 'text-white' : 'text-[#073642]'}`,
              })}
            </span>
            {effectivelyActive && item.label !== 'Search Google' ? (
              <span
                className={`tracking-wide ${tertiaryTextColor} whitespace-nowrap flex items-center gap-1`}
                style={{ fontSize: `${Math.max(10, dynamicFontSize * 0.7)}px` }}>
                Press Enter to {item.label}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  const renderBookmarkSuggestion = (
    item: { _kind: 'bookmark'; title: string; url: string; id: string },
    idx: number,
  ) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const query = (state?.value || '').trim();

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      openLink(item.url);
    };

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`bookmark-${item.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className={`w-5 h-5 flex items-center justify-start ${secondaryTextColor}`}>
              <img src={getFaviconUrl(item.url)} alt="" className="w-5 h-5 object-contain" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 min-w-0 pr-8">
          <span
            className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate whitespace-nowrap flex-shrink-1`}
            style={headingFontStyle}>
            {highlightMatch(item.title, query)}
          </span>
          <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
            {getSuggestionLabel(item)}
          </span>
          <span
            className={`${tertiaryTextColor} truncate min-w-0`}
            style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
            {highlightMatch(item.url, query, {
              baseClass: tertiaryTextColor,
              matchClass: `font-semibold ${isDarkMode ? 'text-white' : 'text-[#073642]'}`,
            })}
          </span>
        </div>
      </button>
    );
  };

  const renderHistorySuggestion = (item: HistorySuggestionItem, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive;
    const query = (state?.value || '').trim();

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      openLink(item.url);
    };

    // Extract domain for display
    let displayUrl = item.url;
    try {
      const urlObj = new URL(item.url);
      displayUrl = urlObj.hostname.replace(/^www\./, '');
    } catch {
      // Use full URL if parsing fails
    }

    // Check if this is the first history result in the suggestions list
    // Look for the first history item before this index
    const isFirstHistoryResult =
      idx === suggestions.findIndex((s: any) => s._kind === 'history' && !s.isOtherResult) ||
      (suggestions.findIndex((s: any) => s._kind === 'history') === idx && !item.isOtherResult);

    // Use omnibox-style highlighting for the first matched history result only
    // Only apply if there's a query and it's not an "other result"
    const useOmniboxStyle = isFirstHistoryResult && query.length > 0 && !item.isOtherResult;

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`history-${item.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
              <img src={getFaviconUrl(item.url)} alt="" className="w-5 h-5 object-cover" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 min-w-0 pr-8">
          <span
            className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate whitespace-nowrap flex-shrink-1`}
            style={headingFontStyle}>
            {useOmniboxStyle
              ? highlightOmniboxStyle(item.title || displayUrl, query, isDarkMode)
              : highlightMatch(item.title || displayUrl, query)}
          </span>
          {!useOmniboxStyle && (
            <span
              className={`px-1.5 py-0.5 rounded ${!isDarkMode ? 'bg-[#fdf6e3] text-[#268bd2]' : 'bg-blue-900/30 dark:text-blue-400'} font-medium flex-shrink-0 whitespace-nowrap ml-1`}
              style={{ fontSize: `${Math.max(10, dynamicFontSize * 0.6)}px` }}>
              history
            </span>
          )}
          <span
            className={`truncate min-w-0 ${useOmniboxStyle
              ? !isDarkMode
                ? 'text-[#268bd2]'
                : 'text-blue-400 font-thin'
              : !isDarkMode
                ? 'text-[#268bd2]'
                : 'text-blue-400 font-thin'
              }`}
            title={item.url}
            style={{ fontSize: `${Math.max(11, dynamicFontSize * 0.75)}px`, marginLeft: '4px' }}>
            {useOmniboxStyle ? (
              <>
                <span className="text-neutral-500 dark:text-neutral-500 px-2 opacity-50">{'\u00A0'.repeat(2)}-</span>
                {highlightOmniboxStyle(item.url, query, isDarkMode)}
              </>
            ) : (
              highlightMatch(item.url, query, {
                baseClass: !isDarkMode ? 'text-[#268bd2]' : 'text-blue-400',
                matchClass: 'font-semibold',
              })
            )}
          </span>
        </div>
      </button>
    );
  };

  const renderLocalEntitySuggestion = (
    item: { _kind: 'workspace' | 'folder'; workspace?: any; folder?: any },
    idx: number,
  ) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive && !isContextualOpen;
    const query = (state?.value || '').trim();

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      onLocalSelect?.(item);
    };

    const isWorkspace = item._kind === 'workspace';
    const label = isWorkspace ? item.workspace?.workspace_name : item.folder?.folder_name;
    const subLabel = isWorkspace ? 'Workspace' : `${item.workspace?.workspace_name} / ${item.folder?.folder_name}`;

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`local-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className={`w-5 h-5 flex items-center justify-start ${secondaryTextColor}`}>
              {isWorkspace ? <FaFolder size={14} /> : <FaFolderOpen size={14} />}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={headingFontStyle}>
              {highlightMatch(label, query)}
            </span>
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
              {getSuggestionLabel(item)}
            </span>
            <FavoriteStar
              isFav={getIsFavorite(getItemCompoundIdInternal(item))}
              isActive={effectivelyActive}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
            />
          </div>
          <span
            className={`${tertiaryTextColor} truncate text-right min-w-0 transition-opacity ${effectivelyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
            {highlightMatch(subLabel, query)}
          </span>
        </div>
      </button>
    );
  };

  const renderFolderSearchSuggestion = (
    item: {
      _kind: 'folder_search';
      entryType?: 'workspace' | 'folder';
      folder: any;
      workspace: any;
      fullPath?: string;
    },
    idx: number,
  ) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive && !isContextualOpen;
    const query = (state?.value || '').trim();
    const isWorkspaceEntry = item.entryType === 'workspace';

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      // Dispatch Redux actions to select the folder/workspace - mimics clicking on sidebar
      const { folder, workspace } = item;

      // Get current expanded workspaces
      const currentState = store.getState();
      const expandedWorkspaces = selectExpandedWorkspaces(currentState);

      // Expand the workspace
      if (!expandedWorkspaces[workspace.workspace_id]) {
        store.dispatch(expandAllWorkspaces({ ...expandedWorkspaces, [workspace.workspace_id]: true }));
      }

      // Set the selected workspace
      store.dispatch(setSelectedWorkspace(workspace));

      if (isWorkspaceEntry) {
        // For workspace entries (Folders in UI), just select the workspace, no sub-folder
        store.dispatch(setSelectedFolder(null));
        store.dispatch(setSelectedSnippet(null));
        store.dispatch(setIsCreatingNewItem(false));
        store.dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: null,
            folder_name: null,
          }),
        );
      } else if (folder) {
        // For folder entries (Sub-folders in UI), select both workspace and folder
        store.dispatch(setSelectedFolder(folder));
        store.dispatch(setSelectedSnippet(null));
        store.dispatch(setIsCreatingNewItem(false));
        store.dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: folder.folder_id,
            folder_name: folder.folder_name,
          }),
        );
      }
    };

    // For workspace entries: show workspace name as label
    // For folder entries: show folder name as label
    const label = isWorkspaceEntry
      ? item.workspace?.workspace_name || 'Folder'
      : item.folder?.folder_name || 'Sub-folder';

    // For workspace entries: no sub-label needed (or show organization name if available)
    // For folder entries: show full path
    const subLabel = isWorkspaceEntry ? '' : item.fullPath || item.workspace?.workspace_name || '';

    const uniqueKey = isWorkspaceEntry
      ? `workspace-search-${item.workspace?.workspace_id}-${idx}`
      : `folder-search-${item.folder?.folder_id}-${idx}`;

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={uniqueKey}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        onContextMenu={e => {
          e.preventDefault();
          toggleActionMenu(idx, e.clientX, e.clientY, true);
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className={`w-5 h-5 flex items-center justify-start ${secondaryTextColor}`}>
              {isWorkspaceEntry ? <FaFolder size={14} /> : <FaFolderOpen size={14} />}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={headingFontStyle}>
              {highlightMatch(label, query)}
            </span>
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
              {getSuggestionLabel(item)}
            </span>
            <FavoriteStar
              isFav={getIsFavorite(
                isWorkspaceEntry ? `workspace-${item.workspace?.workspace_id}` : `folder-${item.folder?.folder_id}`,
              )}
              isActive={isActive}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
            />
          </div>
          {subLabel && (
            <span
              className={`${tertiaryTextColor} truncate text-right max-w-[50%] transition-opacity ${effectivelyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
              {highlightMatch(subLabel, query, {
                baseClass: tertiaryTextColor,
                matchClass: `font-semibold ${isDarkMode ? 'text-white' : 'text-[#073642]'}`,
              })}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderSnippetIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'link':
      case 'links':
      case 'quicklink':
      case 'biolink':
      case 'biolinks':
        return <FaLink className={secondaryTextColor} size={14} />;
      case 'tabgroup':
      case 'tab group':
        return <FaLayerGroup className={secondaryTextColor} size={14} />;
      case 'prompt':
        return <LuSparkles className={secondaryTextColor} size={14} />;
      case 'snippet':
      default:
        return <NotesIcon size={14} className={secondaryTextColor} />;
    }
  };

  // Render icon for snippet - now supports stacked icons for tabgroups
  const renderSnippetItemIcon = (snippet: any, snippetUrl: string | null) => {
    const category = (snippet?.category || '').toLowerCase();
    const isTabGroup = category === 'tabgroup' || category === 'tab group';
    const isLinkKind = ['link', 'links', 'quicklink', 'biolink', 'biolinks'].includes(category);

    // For tabgroups, show stacked favicons (like AllAI command)
    if (isTabGroup) {
      const urls = getSnippetAllUrls(snippet);
      if (urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center w-8">
            {urls.slice(0, 3).map((url, i) => (
              <div
                key={`tabgroup-icon-${i}`}
                className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }
      return <FaLayerGroup className="text-[var(--color-iconDefault)]" size={14} />;
    }

    // For links, show favicon if URL is available
    if (isLinkKind && snippetUrl) {
      return <img src={getFaviconUrl(snippetUrl)} alt="" className="w-5 h-5 object-contain rounded-sm" />;
    }

    // Default icons
    return renderSnippetIcon(snippet?.category);
  };

  const renderSnippetSuggestion = (
    item: { _kind: 'snippet'; snippet: any; workspace: any; folder: any },
    idx: number,
  ) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive && !isContextualOpen;
    const { snippet, workspace, folder } = item;
    const query = (state?.value || '').trim();

    const handleActivate = (event: React.MouseEvent) => {
      if (
        (event.target as HTMLElement).closest('[data-menu-button]') ||
        (event.target as HTMLElement).closest('[data-action-menu]')
      ) {
        return;
      }
      event.preventDefault();
      const category = (snippet.category || '').toLowerCase();

      if (category === 'snippet' || category === 'note' || category === 'notes') {
        trackNoteOpen(snippet);
        state.onSnippetSelect?.({
          snippet,
          workspace,
          folder,
        });
        return;
      }

      // Use helper for URL extraction logic
      let urls: string[] = [];
      if (typeof snippet.value === 'string') {
        const raw = snippet.value as string;
        try {
          const parsed = JSON.parse(raw || '{}');
          if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
            urls = parsed.urls as string[];
          } else if (raw.startsWith('http')) {
            urls = [raw];
          }
        } catch {
          if (raw.startsWith('http')) {
            urls = [raw];
          }
        }
      } else if (snippet && snippet.value && typeof snippet.value === 'object' && 'urls' in (snippet.value as any)) {
        urls = ((snippet.value as any).urls || []) as string[];
      }
      if (!urls.length && (category === 'link' || category === 'links') && typeof snippet.value === 'string') {
        urls = [snippet.value as string];
      }

      /*
      if (category === 'tabgroup' || category === 'tab group') {
        // Dispatch event to open Bulk Editor (listened in Container.tsx)
        const event = new CustomEvent('openBulkEditor', {
          detail: { snippet },
        });
        window.dispatchEvent(event);
        return;
      }
      */

      if (urls.length) {
        trackLinkOpen(urls.length, {
          snippetId: snippet?.snippet_id || snippet?.id || '',
          category,
        });
        state.onRequestOpenUrls?.(urls, snippet.key);
      }
    };

    // Define snippetSuggestion for reuse
    const snippetSuggestion = buildSnippetSuggestion(workspace, folder, snippet);
    const isFav = getIsFavorite(snippet.snippet_id || snippet.id);

    const isLinkKind = ['link', 'links', 'quicklink', 'biolink', 'biolinks'].includes(
      (snippet.category || '').toLowerCase(),
    );
    const isTabGroup = ['tabgroup', 'tab group'].includes((snippet.category || '').toLowerCase());
    const snippetUrl = isLinkKind ? getSnippetFirstUrl(snippet) : null;

    return (
      <div
        key={`${snippet.snippet_id || snippet.id}-${idx}`}
        ref={el => {
          itemRefs.current[idx] = el as HTMLButtonElement | null;
        }}
        className="relative flex-1 flex flex-col">
        <button
          type="button"
          onMouseDown={event => {
            event.preventDefault();
          }}
          onClick={e => {
            if (
              (e.target as HTMLElement).closest('[data-menu-button]') ||
              (e.target as HTMLElement).closest('[data-action-menu]')
            ) {
              return;
            }
            e.preventDefault();
            onHighlightIndexChange(idx);
            handleActivate(e);
          }}
          onAuxClick={e => {
            if (e.button === 1) {
              e.preventDefault();
              handleActivate(e);
            }
          }}
          onDoubleClick={handleActivate}
          onContextMenu={e => {
            e.preventDefault();
            toggleActionMenu(idx, e.clientX, e.clientY, true);
          }}
          className={getRowClasses(isActive)}
          style={rowStyle}>
          <FocusedIndicator isActive={isActive} />
          <div className="flex items-center">
            <div className={`${isTabGroup ? 'w-8 -ml-1.5' : 'w-5'} h-5 flex-shrink-0 flex items-center justify-start`}>
              {renderSnippetItemIcon(snippet, snippetUrl)}
            </div>
          </div>
          <div className="flex flex-1 items-center justify-between gap-3 min-w-0 pr-8">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden flex-1">
              <span
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate flex-shrink-0`}
                style={headingFontStyle}>
                {highlightMatch(snippet.key, query)}
              </span>
              <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
                {getSuggestionLabel(item)}
              </span>
              <FavoriteStar
                isFav={isFav}
                isActive={effectivelyActive}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (state && state.onToggleFavorite) {
                    state.onToggleFavorite(snippetSuggestion);
                  }
                }}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              />
              <HotkeyBadge hotkey={hotkeysMap[getItemCompoundId(item)] || ''} isActive={effectivelyActive} />
              {/* <ShortcutBadge shortcut={shortcutsMap[getItemCompoundId(item)] || ''} isActive={isActive} /> */}
            </div>

            <span
              className={`${tertiaryTextColor} truncate text-right max-w-[50%] transition-opacity ${effectivelyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
              {snippetUrl
                ? highlightMatch(snippetUrl, query, {
                  baseClass: tertiaryTextColor,
                  matchClass: `font-semibold ${isDarkMode ? 'text-white' : 'text-[#073642]'}`,
                })
                : highlightMatch(
                  folder ? `${workspace.workspace_name} / ${folder.folder_name}` : workspace.workspace_name,
                  query,
                  {
                    baseClass: tertiaryTextColor,
                    matchClass: `font-semibold ${isDarkMode ? 'text-white' : 'text-[#073642]'}`,
                  },
                )}
            </span>
          </div>
        </button>
        {isActive && !isLinkKind && (
          <button
            data-menu-button
            type="button"
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              toggleActionMenu(idx);
            }}
            onMouseDown={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md ${!isDarkMode ? 'hover:bg-white/30 text-[#586e75] hover:text-[#073642]' : 'hover:bg-white/20 text-neutral-400 hover:text-neutral-200'} transition-colors z-10`}>
            <FiEdit2 size={14} />
          </button>
        )}
      </div>
    );
  };

  const renderActiveMenu = () => {
    if (openMenuFor === null || !menuPos || openMenuFor >= suggestions.length) return null;
    const item = suggestions[openMenuFor];
    if (
      item._kind !== 'snippet' &&
      (item as any)._kind !== 'command' &&
      (item as any)._kind !== 'aggregate' &&
      (item as any)._kind !== 'common_command' &&
      (item as any)._kind !== 'bookmark' &&
      (item as any)._kind !== 'history' &&
      (item as any)._kind !== 'open_url' &&
      (item as any)._kind !== 'workspace' &&
      (item as any)._kind !== 'folder' &&
      (item as any)._kind !== 'automation' &&
      (item as any)._kind !== 'module' &&
      (item as any)._kind !== 'agent_collection'
    )
      return null;

    let actions = buildMenuActions(item);

    if (!userId) {
      actions = actions.filter(
        a => !['favorite', 'assign-shortcut', 'assign-hotkey', 'schedule', 'create-todo', 'convert-to-todo', 'create-link'].includes(a.key as string)
      );
      actions = actions.filter((a, i, arr) => {
        if (a.divider) {
           if (i === 0) return false;
           if (!arr.slice(i + 1).some(x => !x.divider)) return false;
           if (arr[i-1].divider) return false;
        }
        return true;
      });
    }

    // Filter out AI toggle actions when the AI selection panel is open
    // The panel handles all AI selection when setupAIFor === 'ai'
    const filteredActions =
      setupAIFor === 'ai'
        ? actions.filter(action => !action.key?.startsWith('toggle-ai-') && action.key !== 'header-ai')
        : actions;

    return (
      <UnifiedContextMenu
        x={menuPos.x}
        y={menuPos.y}
        onClose={() => {
          setOpenMenuFor(null);
          setSetupAIFor(null);
        }}
        actions={filteredActions}
        showSearch={!!userId}
        hotkeyInput={
          editingHotkeyFor === getItemCompoundIdInternal(item as any)
            ? {
              value: editValue,
              onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
                const result = captureHotkey(e);

                if (!result) {
                  // Null result - ignore
                  return;
                }

                if (result === 'CANCEL') {
                  handleCancelEdit();
                } else if (result) {
                  setEditValue(result);
                  setSaveError('');
                }
              },
              onSave: () => saveHotkey(item, editValue),
              onCancel: handleCancelEdit,
              onOverwrite: handleOverwriteHotkey,
              isSaving: isSaving,
              isUpdating: isUpdatingHotkey,
              isClearing: isClearingHotkey,
              onClear: () => {
                setEditValue('');
                saveHotkey(item, '', false);
              },
            }
            : undefined
        }
        shortcutInput={
          editingShortcutFor === getItemCompoundIdInternal(item as any)
            ? {
              value: editValue,
              onChange: setEditValue,
              onSave: () => saveShortcut(item, editValue),
              onCancel: handleCancelEdit,
              onOverwrite: handleOverwriteShortcut,
              isSaving: isSaving,
              isUpdating: isUpdatingShortcut,
              isClearing: isClearingShortcut,
            }
            : undefined
        }
        rightPanelContent={
          setupAIFor === 'ai' ? (
            <AIServiceSelectionPanel
              services={AI_SERVICES}
              selectedIds={selectedAIs}
              onToggle={toggleAI}
              commands={commands}
              onClose={() => setSetupAIFor(null)}
            />
          ) : undefined
        }
        onNavigateAlreadyAssigned={handleGoToConflict}
        error={saveError || undefined}
        conflictId={conflictId}
        itemId={getItemCompoundIdInternal(item as any)}
        menuTarget={getMenuTargetMeta(item)}
      />
    );
  };

  const renderAIHistorySuggestion = (item: any, idx: number) => {
    const isContextualOpen = state?.isContextualPopupOpen;
    const isActive = idx === highlightIndex;
    const effectivelyActive = isActive && !isContextualOpen;
    const query = (state?.value || '').trim();

    const handleActivate = (event: React.MouseEvent) => {
      event.preventDefault();
      state?.onAIHistorySelect?.(item);
    };

    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`ai-history-${item.id}-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onClick={e => {
          e.preventDefault();
          onHighlightIndexChange(idx);
          handleActivate(e);
        }}
        onAuxClick={e => {
          if (e.button === 1) {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        onDoubleClick={handleActivate}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className="w-9 -ml-1.5 h-5 flex-shrink-0 flex items-center justify-start">
            <div className="flex -space-x-1.5 items-center w-8">
              {item.models.slice(0, 3).map((aiId: string) => {
                const aiCommand = commands.find(c => c.id === aiId);
                if (!aiCommand) return null;
                return (
                  <div
                    key={`ai-${aiId}`}
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                    <img
                      src={getFaviconUrl(aiCommand.iconHost)}
                      alt={aiCommand.label}
                      className="w-3.5 h-3.5 object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0 pr-8">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={headingFontStyle}>
              {highlightMatch(item.prompt, query)}
            </span>
            <span className={`text-[10px] ml-1 tracking-wide ${secondaryTextColor} flex-shrink-0 whitespace-nowrap`}>
              Resume Chat
            </span>
          </div>
          <span
            className={`${tertiaryTextColor} truncate text-right transition-opacity ${effectivelyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            style={{ fontSize: `${Math.max(12, dynamicFontSize * 0.75)}px` }}>
            {new Date(item.timestamp).toLocaleString()}
          </span>
        </div>
      </button>
    );
  };

  const renderMathSuggestion = (item: MathSuggestionItem, idx: number) => {
    const isActive = idx === highlightIndex;
    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`math-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onContextMenu={e => {
          e.preventDefault();
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-start ${secondaryTextColor}`}>
            <FaCalculator size={14} />
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 min-w-0 py-1">
          <span
            className={`font-inter text-[18.5px] font-normal leading-[26px] tracking-[-0.002em] ${primaryTextColor} truncate whitespace-nowrap`}
            style={headingFontStyle}>
            {item.query} = <strong className="text-[#268bd2] dark:text-blue-400">{item.result}</strong>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded ${!isDarkMode ? 'bg-[#fdf6e3] text-[#268bd2]' : 'bg-blue-900/30 text-blue-400'} font-medium flex-shrink-0 whitespace-nowrap ml-2`}
            style={{ fontSize: `${Math.max(10, dynamicFontSize * 0.6)}px` }}>
            calculator
          </span>
        </div>
      </button>
    );
  };

  const renderTimeSuggestion = (item: TimeSuggestionItem, idx: number) => {
    const isActive = idx === highlightIndex;
    return (
      <button
        ref={el => {
          itemRefs.current[idx] = el;
        }}
        key={`time-${idx}`}
        onMouseDown={event => {
          event.preventDefault();
        }}
        onContextMenu={e => {
          e.preventDefault();
        }}
        className={getRowClasses(isActive)}
        style={rowStyle}>
        <FocusedIndicator isActive={isActive} />
        <div className="flex items-center">
          <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-start ${secondaryTextColor}`}>
            <FaClock size={14} />
          </div>
        </div>
        {item.results.length === 1 ? (
          <div className="flex flex-1 items-center gap-2 min-w-0 py-1">
            <span
              className={`font-inter text-[18.5px] font-normal leading-[26px] tracking-[-0.002em] ${primaryTextColor} truncate whitespace-nowrap`}
              style={headingFontStyle}>
              {item.results[0].location}:{' '}
              <LiveTimeDisplay initialTime={item.results[0].time} timezone={item.results[0].timezone} />
            </span>
            <span
              className={`px-1.5 py-0.5 rounded ${!isDarkMode ? 'bg-[#fdf6e3] text-[#268bd2]' : 'bg-blue-900/30 text-blue-400'} font-medium flex-shrink-0 whitespace-nowrap ml-2`}
              style={{ fontSize: `${Math.max(10, dynamicFontSize * 0.6)}px` }}>
              time
            </span>
          </div>
        ) : (
          <div className="flex flex-1 items-start gap-2 min-w-0 pr-4 py-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 overflow-hidden flex-1">
              {item.results.map((res, i) => (
                <span
                  key={i}
                  className={`font-inter text-[17px] font-normal leading-[24px] tracking-[-0.002em] ${primaryTextColor} truncate whitespace-nowrap`}
                  style={headingFontStyle}>
                  {res.location}: <LiveTimeDisplay initialTime={res.time} timezone={res.timezone} />
                </span>
              ))}
            </div>
            <span
              className={`px-1.5 py-0.5 rounded ${!isDarkMode ? 'bg-[#fdf6e3] text-[#268bd2]' : 'bg-blue-900/30 text-blue-400'} font-medium flex-shrink-0 whitespace-nowrap ml-2 mt-0.5`}
              style={{ fontSize: `${Math.max(10, dynamicFontSize * 0.6)}px` }}>
              time
            </span>
          </div>
        )}
      </button>
    );
  };

  const renderItem = (index: number) => {
    const item = suggestions[index];
    const idx = index;
    const trimmedQuery = value.trim();
    const truncatedQuery = trimmedQuery.length > 100 ? trimmedQuery.substring(0, 100) + '...' : trimmedQuery;

    if (state?.mode === 'local') {
      if ((item as any)._kind === 'snippet') {
        return renderSnippetSuggestion(item as any, idx);
      }
      if ((item as any)._kind === 'folder_search') {
        return renderFolderSearchSuggestion(item as any, idx);
      }
      return renderLocalEntitySuggestion(item as any, idx);
    }

    const kind = (item as any)._kind || (item as any).type;

    if (kind === 'math_result') return renderMathSuggestion(item as MathSuggestionItem, idx);
    if (kind === 'time_result') return renderTimeSuggestion(item as TimeSuggestionItem, idx);
    if (kind === 'ai_history') return renderAIHistorySuggestion(item as any, idx);

    if (mode === 'command') return renderCommandSuggestion(item as CommandSuggestionItem, idx);
    if (mode === 'bookmark') return renderBookmarkSuggestion(item as any, idx);
    if (mode === 'common') {
      // Handle "Open URL" suggestion first
      if (item?._kind === 'open_url') {
        return renderOpenUrlSuggestion(item as OpenUrlSuggestionItem, idx);
      }
      const heading =
        index === 0 && trimmedQuery && !(state?.selectedImagesCount && state.selectedImagesCount > 0) ? (
          <div
            key={`common-heading-${idx}`}
            className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
            style={{
              fontSize: `${Math.max(11, dynamicFontSize * 0.7)}px`,
              paddingLeft: `${dynamicPadding.px}px`,
              paddingRight: `${dynamicPadding.px}px`,
              paddingTop: `${dynamicPadding.py}px`,
              paddingBottom: `${dynamicPadding.py * 0.5}px`,
            }}>
            Open "{truncatedQuery}" with...
          </div>
        ) : null;
      return (
        <React.Fragment key={`common-group-${(item as any).id}-${idx}`}>
          {heading}
          {renderCommonCommandSuggestion(item as any, idx)}
        </React.Fragment>
      );
    }
    if (mode === 'mixed') {
      if (kind === 'command') return renderCommandSuggestion(item as CommandSuggestionItem, idx);
      if (item?._kind === 'open_url') {
        return renderOpenUrlSuggestion(item as OpenUrlSuggestionItem, idx);
      }
      if (kind === 'history') {
        const historyItem = item as HistorySuggestionItem;
        const isFirst = idx === firstOtherGroupIndex;

        return (
          <React.Fragment key={`history-wrap-${historyItem.id}-${idx}`}>
            {isFirst && (
              <div
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${secondaryTextColor} truncate`}
                style={{
                  fontSize: `${Math.max(11, dynamicFontSize * 0.7)}px`,
                  paddingLeft: `${dynamicPadding.px}px`,
                  paddingRight: `${dynamicPadding.px}px`,
                  paddingTop: `${dynamicPadding.py}px`,
                  paddingBottom: `${dynamicPadding.py * 0.5}px`,
                }}>
                Other results
              </div>
            )}
            {renderHistorySuggestion(historyItem, idx)}
          </React.Fragment>
        );
      }
      if (kind === 'bookmark') return renderBookmarkSuggestion(item as any, idx);
      if (kind === 'common_command') {
        const isFirstOtherGroup = idx === firstOtherGroupIndex;
        const heading =
          index === 0 && trimmedQuery && !(state?.selectedImagesCount && state.selectedImagesCount > 0) ? (
            <div
              key={`common-heading-${idx}`}
              className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${primaryTextColor} truncate`}
              style={{
                fontSize: `${Math.max(11, dynamicFontSize * 0.7)}px`,
                paddingLeft: `${dynamicPadding.px}px`,
                paddingRight: `${dynamicPadding.px}px`,
                paddingTop: `${dynamicPadding.py}px`,
                paddingBottom: `${dynamicPadding.py * 0.5}px`,
              }}>
              Open "{truncatedQuery}" with...
            </div>
          ) : null;
        return (
          <React.Fragment key={`common-group-${(item as any).id}-${idx}`}>
            {isFirstOtherGroup && (
              <div
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${secondaryTextColor} truncate`}
                style={{
                  fontSize: `${Math.max(11, dynamicFontSize * 0.7)}px`,
                  paddingLeft: `${dynamicPadding.px}px`,
                  paddingRight: `${dynamicPadding.px}px`,
                  paddingTop: `${dynamicPadding.py}px`,
                  paddingBottom: `${dynamicPadding.py * 0.5}px`,
                }}>
                Other results
              </div>
            )}
            {heading}
            {renderCommonCommandSuggestion(item as any, idx)}
          </React.Fragment>
        );
      }
      // Handle folder_search in mixed mode
      if (kind === 'folder_search') {
        return renderFolderSearchSuggestion(item as any, idx);
      }
      if (kind === 'snippet') {
        const isFirstPersonal = idx === firstPersonalSnippetIndex;
        const isFirstOrg = idx === firstOrgSnippetIndex;

        return (
          <React.Fragment key={`snippet-wrap-${(item as any).snippet?.id || (item as any).snippet?.snippet_id}-${idx}`}>
            {isFirstPersonal && (
              <div
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${secondaryTextColor} truncate`}
                style={{
                  fontSize: `${Math.max(11, dynamicFontSize * 0.7)}px`,
                  paddingLeft: `${dynamicPadding.px}px`,
                  paddingRight: `${dynamicPadding.px}px`,
                  paddingTop: `${dynamicPadding.py}px`,
                  paddingBottom: `${dynamicPadding.py * 0.5}px`,
                }}>
                Personal Space
              </div>
            )}
            {isFirstOrg && (
              <div
                className={`font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] ${secondaryTextColor} truncate`}
                style={{
                  fontSize: `${Math.max(11, dynamicFontSize * 0.7)}px`,
                  paddingLeft: `${dynamicPadding.px}px`,
                  paddingRight: `${dynamicPadding.px}px`,
                  paddingTop: `${dynamicPadding.py}px`,
                  paddingBottom: `${dynamicPadding.py * 0.5}px`,
                }}>
                {(item as any).teamName || 'Org Space'}
              </div>
            )}
            {renderSnippetSuggestion(
              item as unknown as { _kind: 'snippet'; snippet: any; workspace: any; folder: any },
              idx,
            )}
          </React.Fragment>
        );
      }
      if (kind === 'agent_collection') {
        return renderAgentCollectionSuggestion(item as AgentCollectionSuggestionItem, idx);
      }
      if (kind === 'automation') {
        return renderAutomationSuggestion(item as AutomationSuggestionItem, idx);
      }
      if (kind === 'module') {
        return renderModuleSuggestion(item as ModuleSuggestionItem, idx);
      }
      if (kind === 'math_result') {
        return renderMathSuggestion(item as MathSuggestionItem, idx);
      }
      // Fallback: skip unknown item types
      return null;
    }
    if (mode === 'history') {
      return renderHistorySuggestion(item as HistorySuggestionItem, idx);
    }
    if (kind === 'folder_search') {
      return renderFolderSearchSuggestion(item as any, idx);
    }
    if (kind === 'workspace' || kind === 'folder') {
      return renderLocalEntitySuggestion(item as any, idx);
    }
    // Only render as snippet if it's actually a snippet
    if (kind === 'snippet') {
      return renderSnippetSuggestion(
        item as unknown as { _kind: 'snippet'; snippet: any; workspace: any; folder: any },
        idx,
      );
    }
    if (kind === 'agent_collection') {
      return renderAgentCollectionSuggestion(item as AgentCollectionSuggestionItem, idx);
    }
    if (kind === 'automation') {
      return renderAutomationSuggestion(item as AutomationSuggestionItem, idx);
    }
    if (kind === 'module') {
      return renderModuleSuggestion(item as ModuleSuggestionItem, idx);
    }
    // Fallback: return null for unknown types
    return null;
  };

  const itemData = { renderItem, highlightIndex };

  return (
    <>
      <div
        className="w-full h-fit max-h-full bg-[var(--color-containerBg)] border border-t-0 rounded-b-xl rounded-t-none shadow-sm px-0 py-0 flex flex-col overflow-hidden"
        style={{
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)',
        }}>
        {/* Search results header */}
        {/* {showHeading && (
          <div
            style={{
              paddingLeft: `${dynamicPadding.px}px`,
              paddingRight: `${dynamicPadding.px}px`,
            }}
            className="pt-3 pb-2">
            <div
              className={`flex items-center justify-between text-[11px] tracking-wide ${tertiaryTextColor}`}
              style={{ ...headingFontStyle, fontSize: '11px' }}>
              <span style={{ textTransform: 'none' }}>Search results</span>
            </div>
          </div>
        )} */}

        <div className="flex-1 w-full relative min-h-0 flex flex-col">
          <List
            ref={listRef}
            height={(() => {
              let totalHeight = 0;
              for (let i = 0; i < suggestions.length; i++) {
                totalHeight += getItemSize(i);
              }
              // Add a bit of buffer and handle no results case
              const finalH = totalHeight + (showNoResultsMessage ? 60 : 0) + (suggestions.length > 0 ? 8 : 0);
              return Math.min(finalH, maxListHeight);
            })()} // Responsive height based on actual item sizes
            itemCount={suggestions.length}
            itemSize={getItemSize}
            width="100%"
            itemData={itemData}
            className="default-visible-scrollbar"
            onScroll={() => setOpenMenuFor(null)}>
            {SuggestionRow}
          </List>
        </div>

        <div
          style={{
            paddingLeft: `${dynamicPadding.px}px`,
            paddingRight: `${dynamicPadding.px}px`,
          }}
          className={`footer-indications relative flex items-center justify-between gap-3 py-1.5 border-t ${!isDarkMode ? 'border-[#eee8d5]' : 'border-white/10 dark:border-white/5'} bg-[var(--color-containerBg)] text-[10px] font-medium flex-shrink-0 rounded-none`}>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1 rounded-md border border-transparent px-1 py-[1px]`}>
              <span className={`font-semibold ${secondaryTextColor}`}>Navigate</span>
              <KeyHint keys={['↑', '↓']} />
            </div>
          </div>

          {/* Unified Footer Status Area */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-start w-full max-w-[50%]">
            {(() => {
              const currentStatus =
                status && status.status !== 'idle'
                  ? { message: status.message, type: status.status === 'loading' ? 'info' : status.status }
                  : inlineNotification
                    ? { message: inlineNotification.message, type: inlineNotification.type }
                    : state?.footerStatus
                      ? { message: state.footerStatus.message, type: state.footerStatus.type }
                      : null;

              if (!currentStatus) return null;

              const isCommandLoading = status?.status === 'loading';

              return (
                <div
                  className={`flex items-center justify-start gap-2 px-3 py-1 text-[10px] font-medium rounded-full shadow-sm border whitespace-nowrap overflow-hidden transition-all duration-200 ${currentStatus.type === 'error'
                    ? !isDarkMode
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : 'bg-red-900/40 dark:text-red-300 dark:border-red-800/50'
                    : currentStatus.type === 'success'
                      ? !isDarkMode
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50'
                      : currentStatus.type === 'warning'
                        ? !isDarkMode
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/50'
                        : !isDarkMode
                          ? 'bg-[#fdf6e3] text-[#268bd2] border-blue-100'
                          : 'bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50'
                    }`}>
                  {isCommandLoading ? (
                    <svg
                      className={`animate-spin h-2.5 w-2.5 ${!isDarkMode ? 'text-[#268bd2]' : 'text-blue-600'}`}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${currentStatus.type === 'error'
                        ? 'bg-red-500'
                        : currentStatus.type === 'success'
                          ? 'bg-emerald-500'
                          : currentStatus.type === 'warning'
                            ? 'bg-amber-500'
                            : !isDarkMode
                              ? 'bg-[#268bd2]'
                              : 'bg-blue-500'
                        }`}
                    />
                  )}
                  <span className="truncate">{typeof currentStatus.message === 'string' ? currentStatus.message : JSON.stringify(currentStatus.message)}</span>
                </div>
              );
            })()}
          </div>

          <button
            type="button"
            onClick={() => {
              if (hasActions && highlightIndex >= 0 && highlightIndex < suggestions.length) {
                toggleActionMenu(highlightIndex);
              }
            }}
            disabled={!hasActions}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-0.5 font-semibold text-[10px] transition ${hasActions
              ? !isDarkMode
                ? 'bg-[#fdf6e3] text-[#073642] hover:bg-white/20'
                : ' text-neutral-200 hover:bg-white/20 dark:hover:bg-white/10'
              : !isDarkMode
                ? 'cursor-not-allowed  text-[#586e75] opacity-50'
                : 'cursor-not-allowed  text-neutral-600 opacity-50'
              }`}>
            <span>Options</span>
            <KeyHint keys={['Ctrl', '→']} />
          </button>
        </div>
      </div>
      {renderActiveMenu()}

      {schedulingAutomationFor &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className={`w-full max-w-sm ${isDarkMode ? 'bg-[#1C1C1C]' : 'bg-white'} border ${isDarkMode ? 'border-white/10' : 'border-neutral-200'} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
              onClick={e => e.stopPropagation()}>
              <div className={`px-6 py-5 border-b ${isDarkMode ? 'border-white/5' : 'border-neutral-100'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FaRegClock className="text-blue-400" size={16} />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">
                    Schedule Automation
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-textSecondary)] truncate">
                  {schedulingAutomationFor.label || schedulingAutomationFor.name}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Quick Buttons */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 5, 10].map(mins => (
                      <button
                        key={mins}
                        onClick={() => {
                          const date = new Date(Date.now() + mins * 60 * 1000);
                          setScheduleTime(
                            new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
                          );
                        }}
                        className={`py-2.5 rounded-xl ${isDarkMode ? 'bg-white/5 hover:bg-white/10 border-white/5 text-white' : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-900'} border text-xs font-medium transition-all ring-offset-2 ring-offset-current focus:ring-2 focus:ring-blue-500`}>
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Pick */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Custom Time</label>
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-neutral-200 text-neutral-900'} border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all [color-scheme:dark]`}
                  />
                </div>
              </div>

              <div className={`px-6 py-5 ${isDarkMode ? 'bg-white/5' : 'bg-neutral-50'} flex items-center gap-3`}>
                <button
                  onClick={() => setSchedulingAutomationFor(null)}
                  className="flex-1 py-3 rounded-xl bg-transparent hover:bg-black/5 text-xs font-semibold text-neutral-400 transition-all">
                  Cancel
                </button>
                <button
                  disabled={!scheduleTime || isScheduling}
                  onClick={async () => {
                    if (!scheduleTime) return;
                    setIsScheduling(true);
                    const scheduledDate = new Date(scheduleTime);
                    const now = new Date();

                    if (scheduledDate <= now) {
                      alert('Please select a future time');
                      setIsScheduling(false);
                      return;
                    }

                    try {
                      const when = scheduledDate.getTime();
                      const automationId = schedulingAutomationFor.id || schedulingAutomationFor.automation_id;
                      

                      await chrome.alarms.create(`automation_${automationId}`, {
                        when: when,
                      });

                      dispatch(
                        setCommandStatus({
                          status: 'success',
                          message: `Scheduled for ${scheduledDate.toLocaleTimeString()}`,
                        }),
                      );
                      setTimeout(() => dispatch(resetCommandStatus()), 3000);
                      setSchedulingAutomationFor(null);
                    } catch (err) {
                      console.error('[Scheduling] Failed:', err);
                    } finally {
                      setIsScheduling(false);
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl ${!scheduleTime || isScheduling ? 'bg-blue-500/50 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-xs font-semibold text-white transition-all shadow-lg shadow-blue-500/20`}>
                  {isScheduling ? <FiLoader className="animate-spin mx-auto" /> : 'Confirm'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default React.memo(SearchSuggestions);
