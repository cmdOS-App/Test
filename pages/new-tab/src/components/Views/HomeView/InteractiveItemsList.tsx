import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import useToast from '../../Shared/Toast/useToast';
import { VariableSizeList as List } from 'react-window';
import { updateCommandAndRefresh, updateHotkeyAndRefresh } from '../../../../../Apis/features/userCommandsApiService';
import { updateSnippetShortcut, updateSnippetHotkey } from '../../../../../Apis/features/snippetApi';
import { updateLocalShortcut, updateLocalHotkey } from '../../../../../utils/shortcutHotkeyUtils';
import {
  readAllShortcuts,
  readAllHotkeys,
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
} from '@src/components/Shared/utils/hotkeyUtils';
import { useHotkeyAssignment } from '../../../hooks/useHotkeyAssignment';
import {
  FiEdit2,
  FiMoreHorizontal,
  FiPlay,
  FiStar,
  FiTrash2,
  FiChevronRight,
  FiExternalLink,
  FiTerminal,
  FiZap,
  FiZapOff,
  FiLoader,
  FiCheckSquare,
  FiSquare,
} from 'react-icons/fi';
import {
  FaLayerGroup,
  FaLink,
  FaStar,
  FaTerminal,
  FaCheck,
  FaTimes,
  FaFolder,
  FaFolderOpen,
  FaCode,
} from 'react-icons/fa';
import { AiOutlineEnter } from 'react-icons/ai';
import { LuSparkles } from 'react-icons/lu';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, fetchAllDataThunk } from '../../../../../Redux/AllData/allDataSlice';
import {
  selectIsMac,
  selectDarkMode,
  selectOS,
  setCommandStatus,
  resetCommandStatus,
  setIsCommandListView,
  setHighlightedCommandId,
  setTodoCreatePrefill,
  setShowTodosView,
  selectIsLinkEditModalOpen,
} from '../../../../../Redux/AllData/uiStateSlice';
import type { CommandStatus } from '../../../../../Redux/AllData/uiStateSlice';
import type { CommandId } from '../../SearchComponents/Searchbar/commands';
import { AI_GROUP, COMMANDS, DEFAULT_SELECTED_AIS } from '../../SearchComponents/Searchbar/commands';
import { isLocalCommandId, type LocalCommandId } from '../../SearchComponents/Searchbar/localCommands';
import { TerminalIcon } from '@src/components/Shared/utils/terminalIcon';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../../Shared/Icons/StackedLinkIcon';
import CmdIcon from '../../Shared/Icons/CmdIcon';
import type { SnippetActionDetail, SnippetSuggestion } from './types';
import {
  buildSnippetDeleteDetail,
  extractUrlsFromSnippet,
  isLinkCategory,
  isPromptCategory,
  isNoteCategory,
  isTabGroupCategory,
  resolveSnippetIcon as resolveIcon,
} from './snippetInteractiveUtils';
import { UnifiedContextMenu, type MenuAction } from '../../Shared/UnifiedContextMenu';
import { AIServiceSelectionPanel } from '../../Shared/AIServiceSelectionPanel';

// HotkeyBadge moved below to consolidate with other UI helpers

const getFaviconUrl = (host: string | null | undefined) => {
  if (!host) return '';
  const cleanDomain = host.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  const fullUrl = `https://${cleanDomain}`;
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(fullUrl)}&size=128`;
};

export type CommandInteractiveItem = {
  kind: 'command';
  id: string;
  commandId: CommandId | LocalCommandId | 'ai' | 'collections';
  label: string;
  description: string;
  iconHosts: string[];
  keywords: string[];
  iconStack?: boolean;
  isFavorite?: boolean;
  shortcut?: string;
  icon?: any;
  color?: string;
};

export type SnippetInteractiveItem = {
  kind: 'note' | 'link' | 'prompt' | 'tabgroup';
  id: string;
  title: string;
  context: string;
  preview: string;
  icon: 'note' | 'link' | 'tabgroup' | 'prompt';
  suggestion: SnippetSuggestion;
  isFavorite?: boolean;
  urls?: string[];
};

export type FolderInteractiveItem = {
  kind: 'folder';
  id: string;
  title: string;
  icon?: string;
  suggestion: SnippetSuggestion;
};

export type InteractiveItem = CommandInteractiveItem | SnippetInteractiveItem | FolderInteractiveItem;

export type InteractiveSection = {
  key: string;
  title: string;
  items: InteractiveItem[];
  hint?: string;
  emptyMessage?: string;
};

// MenuAction is now imported from UnifiedContextMenu
export type { MenuAction };

export interface InteractiveItemsListProps {
  sections: InteractiveSection[];
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
  onCommandPreview?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections' | null) => void;
  onSnippetSelect: (suggestion: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestFocusSearch?: () => void;
  onHighlightChange?: (item: InteractiveItem | null) => void;
  actionsButtonLabel?: string;
  onToggleFavorite?: (item: SnippetInteractiveItem | CommandInteractiveItem) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestEditLink?: (suggestion: SnippetSuggestion) => void;
  selectedAIs?: string[];
  onToggleAI?: (aiId: string) => void;
  inlineNotification?: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  status?: CommandStatus;
  folderInfo?: { name: string; notesCount: number; linksCount: number; promptsCount: number } | null;
  isCommandLocked?: boolean;
  isPromptMenuOpen?: boolean;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  isLoggedIn: boolean;
  isAtMenuOpen?: boolean;
  isSuggestionVisible?: boolean;
  todoCounts?: { overdue: number; done: number; total: number };
}

export interface InteractiveItemsListHandle {
  focusFirstItem: () => void;
  deactivateKeyboard: () => void;
}

// Open a note in a new tab with full-screen view
const openNoteInNewTab = (snippetId: string) => {
  if (!snippetId) {
    console.warn('[openNoteInNewTab] No snippetId provided');
    return;
  }
  const chromeAny = (window as any)?.chrome;

  // Get extension URL via runtime.getURL if available
  let extensionUrl = '';
  if (chromeAny?.runtime?.getURL) {
    extensionUrl = chromeAny.runtime.getURL(
      `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
    );
  } else if (chromeAny?.runtime?.id) {
    // Fallback: construct URL with extension ID
    const extensionId = chromeAny.runtime.id;
    extensionUrl = `chrome-extension://${extensionId}/new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`;
  }

  if (!extensionUrl) {
    console.warn('[openNoteInNewTab] Could not construct extension URL');
    return;
  }

  // Try sending message to background script first (preferred method - not blocked by Chrome/ad blockers)
  if (chromeAny?.runtime?.sendMessage) {
    chromeAny.runtime.sendMessage({ action: 'open_tab', url: extensionUrl }, (response: any) => {
      if (chromeAny.runtime.lastError) {
        console.warn('[openNoteInNewTab] sendMessage failed:', chromeAny.runtime.lastError);
        // Fallback: try chrome.tabs.create first to avoid ERR_BLOCKED_BY_CLIENT
        if (chromeAny?.tabs?.create) {
          chromeAny.tabs.create({ url: extensionUrl });
        } else {
          // Last resort fallback
          window.open(extensionUrl, '_blank');
        }
      } else if (response && !response.ok) {
        // Background script returned an error
        console.error('[openNoteInNewTab] Background script error:', response.error, response.debugMessages);
        // Try direct tab creation as fallback
        if (chromeAny?.tabs?.create) {
          chromeAny.tabs.create({ url: extensionUrl });
        } else {
          window.open(extensionUrl, '_blank');
        }
      }
    });
    return;
  }

  // If sendMessage not available, try direct tab creation
  if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
    const url = chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`);
    chromeAny.tabs.create({ url });
    return;
  }

  // Last resort: window.open
  console.warn('[openNoteInNewTab] chrome.runtime.sendMessage and tabs.create not available, using window.open');
  window.open(extensionUrl, '_blank');
};

const openSingleLink = (url: string) => {
  if (!url) return;

  // Check if URL is a note: prefix
  if (url.startsWith('note:')) {
    const noteId = url.substring(5); // Remove 'note:' prefix
    openNoteInNewTab(noteId);
    return;
  }

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
    // Update current active tab instead of creating a new one
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

const openMultipleLinks = async (urls: string[], snippetId?: string) => {
  if (urls.length === 0) {
    if (snippetId) {
      const chromeAny = (window as any)?.chrome;
      const url = chromeAny?.runtime?.getURL
        ? chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`)
        : '';
      if (url) window.location.href = url;
    }
    return;
  }

  const chromeAny = (window as any)?.chrome;

  const getFinalUrl = (url: string) => {
    if (url.startsWith('note:')) {
      const noteId = url.substring(5);
      return chromeAny?.runtime?.getURL
        ? chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`)
        : '';
    }
    if (url.startsWith('agent_chat?id=')) {
      const agentId = url.split('id=')[1];
      return chromeAny?.runtime?.getURL
        ? chromeAny.runtime.getURL(`new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`)
        : '';
    }
    return url;
  };

  // Get final URLs
  const finalUrls = urls.map(getFinalUrl).filter(Boolean);

  if (finalUrls.length === 0) {
    return;
  }

  // Background tabs FIRST
  finalUrls.slice(1).forEach(url => {
    if (chromeAny?.tabs) {
      chromeAny.tabs.create({ url, active: false });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  });

  // Current tab LAST
  const firstUrl = finalUrls[0];
  if (firstUrl) {
    if (chromeAny?.tabs) {
      chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs && tabs[0]) {
          chromeAny.tabs.update(tabs[0].id, { url: firstUrl });
        } else {
          chromeAny.tabs.create({ url: firstUrl });
        }
      });
    } else {
      window.location.href = firstUrl;
    }
  }
};

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => {
  const isMac = useSelector(selectIsMac);
  return (
    <span className="flex items-center gap-1">
      {keys.map(key => {
        let displayKey = key;
        if (isMac) {
          if (key.toLowerCase() === 'ctrl') displayKey = '⌃';
          if (key.toLowerCase() === 'alt') displayKey = '⌥';
          if (['meta', 'cmd', 'command'].includes(key.toLowerCase())) displayKey = '⌘';
        }
        return (
          <span
            key={key}
            className={`rounded border border-[var(--color-borderDefault)] px-1.5 py-0.5 text-[10px] font-medium shadow-sm text-neutral-500`}>
            {displayKey}
          </span>
        );
      })}
    </span>
  );
};

const CommandIcon: React.FC<{ item: CommandInteractiveItem }> = ({ item }) => {
  // Check if it's an AI group command with a stack
  if (item.iconStack && item.iconHosts.length > 0) {
    return (
      <div className="flex -space-x-1.5 items-center justify-start my-auto">
        {item.iconHosts.slice(0, 4).map((host, idx) => (
          <div
            key={host}
            className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white dark:border-neutral-800 bg-white shadow-sm flex-shrink-0 relative"
            style={{ zIndex: 4 - idx }}>
            <img src={getFaviconUrl(host)} alt={item.label} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  // Check if command has a custom icon (React component, string path, or node)
  const CustomIcon = item.icon;

  if (CustomIcon) {
    return (
      <div className="h-32 w-20 flex items-center justify-center">
        {typeof CustomIcon === 'function' ? (
          <CustomIcon className="w-full h-full object-contain" />
        ) : typeof CustomIcon === 'string' ? (
          <img src={CustomIcon} className="h-32 w-20 object-contain dark:invert" alt="" />
        ) : (
          CustomIcon
        )}
      </div>
    );
  }

  // Check if it's a local command (indicated by empty iconHosts or specific local IDs)
  if (
    (item.iconHosts.length === 0 && isLocalCommandId(item.commandId)) ||
    item.commandId === 'createnotes' ||
    item.commandId === 'createlinks'
  ) {
    return (
      <div className="w-3.5 h-3.5 flex items-center justify-center text-neutral-500 dark:text-neutral-400 overflow-hidden">
        <div className="scale-[0.45] origin-center flex items-center justify-center">
          <CmdIcon />
        </div>
      </div>
    );
  }

  const host = item.iconHosts[0];
  if (!host) {
    return (
      <div className="w-3.5 h-3.5 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
        <div className="scale-[0.45] origin-center flex items-center justify-center">
          <CmdIcon />
        </div>
      </div>
    );
  }

  return <img src={getFaviconUrl(host)} alt={item.label} className="h-3.5 w-3.5 rounded shadow-sm" />;
};

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 300,
};

const HotkeyBadge: React.FC<{ hotkey: string; isActive?: boolean }> = ({ hotkey, isActive }) => {
  const isMac = useSelector(selectIsMac);
  if (!hotkey) return null;

  const parts = hotkey.replace(/\+/g, ' + ').split(' ');
  return (
    <span
      className={`flex items-center gap-0.5 ml-auto origin-right ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
      {parts.map((part, i) => {
        let display = part;
        if (isMac) {
          if (part === 'Meta' || part === 'Command' || part === 'Cmd') display = '⌘';
          if (part === 'Control' || part === 'Ctrl') display = '⌃';
          if (part === 'Alt' || part === 'Option') display = '⌥';
          if (part === 'Shift') display = '⇧';
        }

        if (part === '+') {
          return (
            <span key={i} className="text-[9px] text-neutral-300 dark:text-neutral-600 px-0.5">
              +
            </span>
          );
        }

        return (
          <span
            key={i}
            className="rounded bg-[#eee8d5] px-1.5 py-0.5 text-[9px] font-medium text-[#586e75] dark:bg-neutral-800 dark:text-neutral-400">
            {display}
          </span>
        );
      })}
    </span>
  );
};

const ShortcutBadge: React.FC<{ shortcut: string; isActive?: boolean }> = ({ shortcut, isActive }) => {
  if (!shortcut) return null;

  return (
    <span
      className={`flex items-center gap-0.5 ml-auto origin-left ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
      <span className="bg-[#eee8d5] dark:bg-white/10 text-[#586e75] dark:text-neutral-400 px-2 py-0.5 rounded font-medium text-[9px] shadow-sm">
        {shortcut.startsWith('/') ? shortcut : `/${shortcut}`}
      </span>
    </span>
  );
};

// Helper function to extract URLs from a snippet
const extractUrlsFromValue = (value: any): string[] => {
  if (!value) return [];
  let urls: string[] = [];

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value || '{}');
      if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
        urls = parsed.urls as string[];
      } else if (value.startsWith('http')) {
        urls = [value];
      }
    } catch {
      if (value.startsWith('http')) {
        urls = [value];
      }
    }
  } else if (value && typeof value === 'object' && 'urls' in value) {
    urls = (value.urls || []) as string[];
  }

  return urls;
};

const renderSnippetIcon = (item: SnippetInteractiveItem | FolderInteractiveItem) => {
  // For folders, show folder icon
  if (item.kind === 'folder') {
    return <FaFolder className="h-3.5 w-3.5 text-[var(--color-iconDefault)]" />;
  }

  const snippetItem = item as SnippetInteractiveItem;
  const snippet = snippetItem.suggestion?.snippet;

  // For links and tabgroups, use unified StackedLinkIcon
  if (item.icon === 'link' || item.icon === 'tabgroup') {
    const urls = snippetItem.urls || extractUrlsFromValue(snippet?.value);
    return <StackedLinkIcon urls={urls} size={14} fallback={item.icon === 'tabgroup' ? 'tabgroup' : 'link'} />;
  }

  if (item.icon === 'prompt') return <LuSparkles className="h-3.5 w-3.5 text-[var(--color-iconDefault)]" />;

  // Display 'FaCode' for Snippets (backend category 'note')
  if (snippet?.category === 'note') {
    return <FaCode size={14} className="text-[var(--color-iconDefault)]" />;
  }

  // Custom Notes Icon for note types (backend category 'snippet' or missing)
  return <NotesIcon size={14} className="text-[var(--color-iconDefault)]" />;
};

const getItemTagMeta = (item: InteractiveItem, todoCounts?: { overdue: number; done: number; total: number }) => {
  if (item.kind === 'command') {
    if (item.commandId === 'todo' && todoCounts) {
      if (todoCounts.overdue > 0) {
        return { label: `${todoCounts.overdue} Overdue`.trim(), isBadge: false };
      }
      return { label: `${todoCounts.done}/${todoCounts.total} Done`.trim(), isBadge: false };
    }
    if (item.commandId === 'collections') {
      return { label: '', isBadge: false };
    }
    return { label: '', isBadge: false };
  }
  if (item.kind === 'folder') {
    return { label: 'Folders', isBadge: false };
  }

  const category = (item as SnippetInteractiveItem).suggestion?.snippet?.category;

  if (isTabGroupCategory(category)) {
    return { label: 'Groups', isBadge: false };
  }
  if (isLinkCategory(category)) {
    return { label: 'Links', isBadge: false };
  }
  if (isPromptCategory(category)) {
    return { label: 'Prompts', isBadge: false };
  }
  if (category === 'note') {
    return { label: 'Snippet', isBadge: false };
  }
  if (category === 'snippet' || !category) {
    return { label: 'Note', isBadge: false };
  }
  return { label: 'Snippet', isBadge: false };
};

const Row = ({ index, style, data }: any) => {
  const {
    visualItems,
    focusIndex,
    openMenuFor,
    interactiveIndexMap,
    toggleActionMenu,
    activateItem,
    deactivateKeyboard,
    setFocusIndex,
    dynamicRowHeight,
    dynamicPadding,
    headingFontStyle,
    getItemTagMeta,
    renderSnippetIcon,
    anchorRefs,
    hotkeysMap,
    shortcutsMap,
    getItemCompoundIdInternal,
    todoCounts,
  } = data;
  const visualItem = visualItems[index];

  if (visualItem.type === 'header') {
    if (!visualItem.title) return null;
    return (
      <div
        style={{
          ...style,
          paddingLeft: `${dynamicPadding.px}px`,
          paddingRight: `${dynamicPadding.px}px`,
        }}
        className="pt-3 pb-2">
        <div
          className={`flex items-center justify-between text-[11px] tracking-wide text-neutral-700 dark:text-neutral-400 ${index > 0 ? 'border-t border-neutral-300 dark:border-white/10 pt-2' : ''}`}
          style={{ fontSize: '11px' }}>
          <span style={{ textTransform: 'none' }}>{visualItem.title}</span>
        </div>
      </div>
    );
  }

  const item = visualItem.data!;
  const logicalIndex = visualItem.logicalIndex!;
  const isActive = logicalIndex === focusIndex;

  const itemCompoundId = item ? getItemCompoundIdInternal(item) : '';
  const hotkey = (itemCompoundId ? hotkeysMap[itemCompoundId] : '') || (((item as CommandInteractiveItem)?.shortcut?.includes('+') ? (item as CommandInteractiveItem).shortcut : '') || '');
  const shortcut = itemCompoundId ? shortcutsMap[itemCompoundId] || '' : '';
  const title = item.kind === 'command' ? item.label : item.title === 'Tab Group' ? 'Link Group' : item.title;
  let description = '';
  if (item.kind === 'command') {
    description = item.description;
  } else {
    description = getItemTagMeta(item, todoCounts).label;
  }
  const tagMeta = getItemTagMeta(item, todoCounts);

  const innerStyle = {
    paddingLeft: `${dynamicPadding.px}px`,
    paddingRight: `${dynamicPadding.px}px`,
    paddingTop: `${dynamicPadding.py}px`,
    paddingBottom: `${dynamicPadding.py}px`,
  };

  const isDarkMode = data.isDarkMode;

  const glassStyle: React.CSSProperties = !isDarkMode
    ? {
      background: isActive ? '#fdf6e3' : '#eee8d5',
      border: isActive ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '0px',
      boxShadow: isActive ? 'inset 0 1px 2px rgba(255, 255, 255, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.05)' : 'none',
      backdropFilter: 'blur(4px)',
    }
    : {};

  const primaryTextColor = !isDarkMode ? 'text-[#073642]' : 'text-[#FFFFFF]';
  const secondaryTextColor = !isDarkMode ? 'text-[#586e75]' : 'text-neutral-500';

  return (
    <div style={style}>
      <div
        style={{ ...innerStyle, ...glassStyle }}
        ref={node => {
          if (anchorRefs.current) anchorRefs.current[item.id] = node;
        }}
        className={`cursor-pointer h-full w-full group ${isActive ? (isDarkMode ? 'shadow-sm dark:bg-white/10' : '') : ''
          } ${!isDarkMode ? 'hover:bg-[#fdf6e3]' : 'dark:hover:bg-white/5'}`}
        aria-selected={isActive}
        role="button"
        onContextMenu={event => {
          event.preventDefault();
          setFocusIndex(logicalIndex);
          // Pass coordinates for menu positioning
          toggleActionMenu(logicalIndex, event.clientX, event.clientY);
        }}
        onClick={event => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-menu-button]') || target.closest('[data-action-menu]')) {
            return;
          }
          setFocusIndex(logicalIndex);
          activateItem(item);
          deactivateKeyboard();
        }}
        onDoubleClick={event => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-menu-button]') || target.closest('[data-action-menu]')) {
            return;
          }
          setFocusIndex(logicalIndex);
          activateItem(item);
          deactivateKeyboard();
        }}>
        <div className="flex items-center gap-2 h-full overflow-hidden relative">
          <div
            className={`flex items-center justify-start flex-shrink-0 ${item.kind === 'command' && (item as CommandInteractiveItem).iconStack ? 'w-auto' : 'w-4'
              } h-4 ${item.kind === 'command' && (item as CommandInteractiveItem).color
                ? (item as CommandInteractiveItem).color
                : 'text-neutral-500 dark:text-neutral-400'
              }`}>
            {item.kind === 'command' ? <CommandIcon item={item} /> : renderSnippetIcon(item)}
          </div>

          <div className="flex-1 min-w-0 h-full relative">
            {/* Non-hover state */}
            <div
              className={`absolute inset-0 flex items-center gap-2 opacity-100 translate-y-0 group-hover:opacity-0 group-hover:translate-y-[-4px]`}>
              <span
                className={`font-inter text-[14px] font-normal leading-[22px] tracking-[-0.002em] truncate ${primaryTextColor
                  }`}
                style={{ ...headingFontStyle, fontSize: '14px' }}>
                {title}
              </span>
            </div>

            {/* Hover state */}
            <div
              className={`absolute inset-0 flex items-center justify-between gap-3 opacity-0 translate-y-[4px] group-hover:opacity-100 group-hover:translate-y-0`}>
              <span
                className={`font-inter text-[14px] font-normal leading-[22px] tracking-[-0.002em] truncate flex-shrink-0 max-w-[40%] ${primaryTextColor
                  }`}
                style={{ ...headingFontStyle, fontSize: '14px' }}>
                {item.kind === 'command' ? item.label : item.title === 'Tab Group' ? 'Link Group' : item.title}
              </span>
              <span
                className={
                  tagMeta.isBadge
                    ? 'inline-flex items-center rounded-sm border border-neutral-300 bg-transparent px-2 py-0.5 text-[9px] font-semibold tracking-wide text-neutral-600 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 flex-shrink-0 whitespace-nowrap'
                    : `text-[9px] tracking-wide flex-shrink-0 whitespace-nowrap ${secondaryTextColor}`
                }>
                {tagMeta.label}
              </span>
              {description && (
                <span
                  className="truncate flex-shrink min-w-0 flex-1 text-right text-neutral-500"
                  style={{ fontSize: '12px', color: !isDarkMode ? '#586e75' : 'undefined  ' }}>
                  {description}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InteractiveItemsList = forwardRef<InteractiveItemsListHandle, InteractiveItemsListProps>(
  (
    {
      sections,
      onQuickCommandSelect,
      onCommandPreview,
      onSnippetSelect,
      onRequestSnippetDelete,
      onRequestFocusSearch,
      onHighlightChange,
      actionsButtonLabel = 'Options',
      onToggleFavorite,
      onRequestOpenUrls,
      onRequestEditLink,
      selectedAIs: propSelectedAIs,
      onToggleAI,
      inlineNotification,
      status,
      folderInfo,
      isCommandLocked,
      isPromptMenuOpen,
      isAtMenuOpen,
      isSuggestionVisible,
      onNavigateToListView,
      isLoggedIn,
      todoCounts,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const anchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const listRef = useRef<any>(null);
    const [windowHeight, setWindowHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

    // Listen for resize events
    useEffect(() => {
      const handleResize = () => setWindowHeight(window.innerHeight);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [showInlineNotif, setShowInlineNotif] = useState(false);

    useEffect(() => {
      if (inlineNotification) {
        setShowInlineNotif(true);
        const timer = setTimeout(() => {
          setShowInlineNotif(false);
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        setShowInlineNotif(false);
      }
      return undefined;
    }, [inlineNotification]);

    const dispatch = useDispatch();
    const triggerToast = useToast();

    // Flatten sections into visual items (headers + content)
    const { visualItems, logicalToVisualMap, visualToLogicalMap } = useMemo(() => {
      const visual: Array<{
        type: 'header' | 'item';
        data?: InteractiveItem;
        title?: string;
        sectionKey?: string;
        logicalIndex?: number;
      }> = [];
      const l2v = new Map<number, number>();
      const v2l = new Map<number, number>();

      let currentLogicalIndex = 0;

      // Inject draft automation at the end of the first section if it exists
      const sectionsToProcess = [...sections];

      sectionsToProcess.forEach((section, sIndex) => {
        const sectionItems = [...section.items];

        if (sectionItems.length > 0) {
          // Add header
          visual.push({
            type: 'header',
            title: section.title,
            sectionKey: section.key,
          });

          // Add items
          sectionItems.forEach(item => {
            const visualIndex = visual.length;
            l2v.set(currentLogicalIndex, visualIndex);
            v2l.set(visualIndex, currentLogicalIndex);

            visual.push({
              type: 'item',
              data: item,
              logicalIndex: currentLogicalIndex,
            });
            currentLogicalIndex++;
          });
        }
      });

      return { visualItems: visual, logicalToVisualMap: l2v, visualToLogicalMap: v2l };
    }, [sections]);

    const interactiveItems = useMemo(() => {
      const items: InteractiveItem[] = [];
      sections.forEach(section => {
        items.push(...section.items);
      });

      return items;
    }, [sections]);

    const interactiveIndexMap = useMemo(() => {
      const map = new Map<string, number>();
      interactiveItems.forEach((item, index) => map.set(item.id, index));
      return map;
    }, [interactiveItems]);

    // By default, focus the first item in the recommended list (if any)
    const isDarkMode = useSelector(selectDarkMode);

    const [focusIndex, setFocusIndex] = useState(() => (interactiveItems.length ? 0 : -1));
    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
    const [menuFocusIndex, setMenuFocusIndex] = useState<number>(-1);
    const [isKeyboardActive, setIsKeyboardActive] = useState(false);

    // AI selection state - default to ALL AIs selected
    const [localSelectedAIs, setLocalSelectedAIs] = useState<string[]>(propSelectedAIs || DEFAULT_SELECTED_AIS);

    // Sync local state if propSelectedAIs changes
    useEffect(() => {
      if (propSelectedAIs) {
        setLocalSelectedAIs(propSelectedAIs);
      }
    }, [propSelectedAIs]);
    const [showAISubmenu, setShowAISubmenu] = useState(false);
    const isMac = useSelector(selectIsMac);
    const allData = useSelector(selectAllData);
    const isLinkEditModalOpen = useSelector(selectIsLinkEditModalOpen);

    const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
    const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
    const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});

    const [extensionCommands, setExtensionCommands] = useState<any[]>([]);

    // Load hotkeys and shortcuts and listen for changes
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
      const chromeAny = (window as any)?.chrome;
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
          changes.alts_commands ||
          changes.link_commands ||
          changes.note_commands
        ) {
          loadMaps();
        }
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener(handleStorageChange);
      }
      return () => {
        mounted = false;
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.onChanged.removeListener(handleStorageChange);
        }
      };
    }, []);

    const { captureHotkey } = useHotkeyAssignment(editValue, isMac);
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdatingShortcut, setIsUpdatingShortcut] = useState(false);
    const [isUpdatingHotkey, setIsUpdatingHotkey] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);

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

    const chromeAny = (window as any)?.chrome;

    // Helper to get item's compound ID for storage
    const getItemCompoundIdInternal = useCallback((item: InteractiveItem): string => {
      if (item.kind === 'command') return item.commandId;
      if (item.kind === 'folder') return item.id;
      return getItemCompoundId({ suggestion: (item as SnippetInteractiveItem).suggestion });
    }, []);

    // Helper to find item name by ID (compound or simple)
    const findConflictingItemName = useCallback(
      (conflictingId: string) => {
        // Check commands
        const cmd = COMMANDS.find(c => c.id === conflictingId);
        if (cmd) return cmd.label;

        if (!allData) return null;

        // 2. Check Snippets (Workspaces/Folders)
        // We have to iterate everything to reconstruct compound IDs
        for (const team of allData) {
          for (const workspace of team.workspaces) {
            // Check workspace snippets
            if (workspace.workspace_snippets) {
              for (const s of workspace.workspace_snippets) {
                const sId = s.snippet_id || s.id;
                const compound = `${workspace.workspace_id}-${sId}`;
                // Also check simple ID for legacy or direct matches
                if (compound === conflictingId || String(sId) === conflictingId) return s.key;
              }
            }
            // Check folder snippets
            if (workspace.folders) {
              for (const folder of workspace.folders) {
                // Check if the conflicting ID is the folder itself
                if (folder.folder_id === conflictingId || (folder as any).id === conflictingId) {
                  return folder.folder_name;
                }
                if (folder.snippets) {
                  for (const s of folder.snippets) {
                    const sId = s.snippet_id || s.id;
                    const compound = `${folder.folder_id}-${sId}`;
                    if (compound === conflictingId || String(sId) === conflictingId) return s.key;
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

    // Save shortcut with duplicate validation
    const saveShortcut = useCallback(
      async (item: InteractiveItem, shortcutValue: string) => {
        const normalizedShortcut = shortcutValue.trim().replace(/^\//, '');
        const itemId = getItemCompoundIdInternal(item);

        if (normalizedShortcut) {
          // Check for duplicates
          const allShortcuts = await readAllShortcuts();
          const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
          const existingEntry = Object.entries(allShortcuts).find(
            ([id, sc]) => sc === normalizedShortcut && extractSnippetIdFromCompoundId(id) !== currentSnippetId,
          );

          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Shortcut "${normalizedShortcut}" is already assigned to "${conflictName}"`
              : `Shortcut "${normalizedShortcut}" is already assigned`;

            dispatch(setCommandStatus({ status: 'error', message: msg }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            setSaveError(msg); // Keep editing open
            setConflictId(conflictingId);
            return;
          }
        }

        dispatch(
          setCommandStatus({
            status: 'loading',
            message: !normalizedShortcut ? 'Clearing...' : isUpdatingShortcut ? 'Updating...' : 'Saving...',
          }),
        );
        setIsSaving(true);

        try {
          if (item.kind === 'command') {
            try {
              await updateCommandAndRefresh(item.commandId, { prefix: normalizedShortcut });
            } catch (e) {
              console.warn('Cloud sync failed for command shortcut', e);
            }
          } else {
            const snippetItem = item as SnippetInteractiveItem;
            const snippetId = extractSnippetIdFromCompoundId(itemId);
            if (!snippetId) throw new Error('Snippet ID not found');

            try {
              await updateSnippetShortcut(snippetId, normalizedShortcut);
            } catch (e) {
              console.warn('Cloud sync failed for snippet shortcut, falling back to local', e);
            }

            // Update local storage via utility
            const type = isLinkCategory(snippetItem.suggestion.snippet.category) ? 'link' : 'note';
            await updateLocalShortcut(
              itemId,
              snippetId,
              normalizedShortcut,
              snippetItem.title,
              type,
              snippetItem.kind === 'link' ? 'link' : undefined,
            );
          }

          dispatch(
            setCommandStatus({
              status: 'success',
              message: !normalizedShortcut ? 'Cleared' : 'Saved',
            }),
          );
          setTimeout(() => dispatch(resetCommandStatus()), 3000);

          // Force fresh data from cloud for commands
          if (item.kind === 'command') {
            dispatch(fetchAllDataThunk() as any);
          }

          // Local refresh of maps
          const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
          setHotkeysMap(allHotkeys);
          setShortcutsMap(allShortcuts);
        } catch (error: any) {
          console.error('[InteractiveItemsList] Failed to save/clear shortcut:', error);
          dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to update shortcut' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
        } finally {
          setIsSaving(false);
          setEditingShortcutFor(null);
          setEditValue('');
          setSaveError(null);
        }
      },
      [dispatch, getItemCompoundIdInternal, findConflictingItemName],
    );

    // Save hotkey with duplicate validation (Unified for both snippets and commands)
    const saveHotkey = useCallback(
      async (item: InteractiveItem, hotkeyValue: string, shouldClose = true) => {
        const itemId = getItemCompoundIdInternal(item);

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
            dispatch(setCommandStatus({ status: 'error', message: msg }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            if (saveError !== msg) setSaveError(msg);
            setConflictId('extension-reserved');
            return;
          }

          // Check for duplicates
          const allHotkeys = await readAllHotkeys();
          const currentSnippetId = extractSnippetIdFromCompoundId(itemId || '');
          const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === hotkeyValue && extractSnippetIdFromCompoundId(id) !== currentSnippetId);

          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Hotkey "${hotkeyValue}" is already assigned to "${conflictName}"`
              : `Hotkey "${hotkeyValue}" is already assigned`;

            dispatch(setCommandStatus({ status: 'error', message: msg }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            if (saveError !== msg) setSaveError(msg);
            setConflictId(conflictingId);
            return;
          }
        }

        dispatch(
          setCommandStatus({
            status: 'loading',
            message: !hotkeyValue ? 'Clearing...' : isUpdatingHotkey ? 'Updating...' : 'Saving...',
          }),
        );
        setIsSaving(true);

        try {
          if (item.kind === 'command') {
            // Try cloud sync first
            let result: any = null;
            try {
              result = await updateHotkeyAndRefresh(item.commandId, hotkeyValue);
            } catch (e) {
              console.warn('Cloud sync failed for command hotkey, falling back to local', e);
            }
            // If result is empty, it means no installation ID (e.g. browser command), so fallback to local
            if (!result || result.length === 0) {
              await updateLocalHotkey(itemId, hotkeyValue, 'command');
            }
          } else {
            const snippetItem = item as SnippetInteractiveItem;
            const snippetId = extractSnippetIdFromCompoundId(itemId);
            if (!snippetId) throw new Error('Snippet ID not found');

            try {
              await updateSnippetHotkey(snippetId, hotkeyValue);
            } catch (e) {
              console.warn('Cloud sync failed for snippet hotkey, falling back to local', e);
            }

            const type = isLinkCategory(snippetItem.suggestion.snippet.category) ? 'link' : 'note';
            await updateLocalHotkey(itemId, hotkeyValue, type);
          }

          // Refresh maps
          const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
          setHotkeysMap(allHotkeys);
          setShortcutsMap(allShortcuts);

          // Force Redux refresh for commands
          if (item.kind === 'command') {
            dispatch(fetchAllDataThunk() as any);
          }

          dispatch(setCommandStatus({ status: 'success', message: !hotkeyValue ? 'Cleared' : 'Saved' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
        } catch (error: any) {
          console.error('[InteractiveItemsList] Failed to save/clear hotkey:', error);
          dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to update hotkey' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
        } finally {
          setIsSaving(false);
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
      [dispatch, getItemCompoundIdInternal, findConflictingItemName, saveError, extensionCommands],
    );

    // Real-time duplicate check
    useEffect(() => {
      const timer = setTimeout(async () => {
        if ((!editingHotkeyFor && !editingShortcutFor) || !editValue) {
          setSaveError(null);
          setConflictId(null);
          return;
        }

        const index = interactiveIndexMap.get(editingHotkeyFor || editingShortcutFor || '');
        if (index === undefined) return;
        const item = interactiveItems[index];
        if (!item) return;

        const itemId = getItemCompoundIdInternal(item);

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
      interactiveItems,
      interactiveIndexMap,
      getItemCompoundIdInternal,
      findConflictingItemName,
    ]);

    const focusedItem = focusIndex >= 0 ? interactiveItems[focusIndex] : null;

    const handleOverwriteHotkey = useCallback(async () => {
      if (!conflictId || !focusedItem) return;
      setIsSaving(true);
      setSaveError('Overwriting existing hotkey...');

      try {
        // 1. Clear existing
        const isCommand = COMMANDS.some(c => c.id === conflictId) || isLocalCommandId(conflictId as any);

        if (isCommand) {
          try {
            await updateHotkeyAndRefresh(conflictId as any, '');
          } catch (e) {
            console.warn('Cloud hotkey clear failed or skipped for local command', e);
          }
          await updateLocalHotkey(conflictId, '', 'command');
        } else {
          const sId = extractSnippetIdFromCompoundId(conflictId);
          try {
            await updateSnippetHotkey(sId, '');
          } catch (e) {
            console.warn('Cloud hotkey clear failed', e);
          }
          await updateLocalHotkey(conflictId, '', 'note');
          await updateLocalHotkey(conflictId, '', 'link');
        }

        // 2. Save new
        await saveHotkey(focusedItem, editValue);
      } catch (err) {
        console.error('Overwrite hotkey failed:', err);
        setSaveError('Overwrite failed. Please try again.');
        setIsSaving(false);
      }
    }, [conflictId, focusedItem, editValue, saveHotkey]);

    const handleOverwriteShortcut = useCallback(async () => {
      if (!conflictId || !focusedItem) return;
      setIsSaving(true);
      setSaveError('Overwriting existing shortcut...');

      try {
        // 1. Clear existing
        const isCommand = COMMANDS.some(c => c.id === conflictId) || isLocalCommandId(conflictId as any);

        if (isCommand) {
          try {
            await updateCommandAndRefresh(conflictId as any, { prefix: '' });
          } catch (e) {
            console.warn('Cloud shortcut clear failed or skipped for local command', e);
          }
        } else {
          const sId = extractSnippetIdFromCompoundId(conflictId);
          try {
            await updateSnippetShortcut(sId, '');
          } catch (e) {
            console.warn('Cloud shortcut clear failed', e);
          }
          await updateLocalShortcut(conflictId, sId, '', '', 'note');
          await updateLocalShortcut(conflictId, sId, '', '', 'link');
        }

        // 2. Save new
        await saveShortcut(focusedItem, editValue);
      } catch (err) {
        console.error('Overwrite shortcut failed:', err);
        setSaveError('Overwrite failed. Please try again.');
        setIsSaving(false);
      }
    }, [conflictId, focusedItem, editValue, saveShortcut]);

    // Load selected AIs from Chrome storage
    useEffect(() => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('selectedAIs', result => {
          if (result.selectedAIs && Array.isArray(result.selectedAIs) && result.selectedAIs.length > 0) {
            setLocalSelectedAIs(result.selectedAIs);
          } else {
            setLocalSelectedAIs(DEFAULT_SELECTED_AIS);
          }
        });
      }
    }, []);

    const activateKeyboard = useCallback(() => {
      setIsKeyboardActive(true);
    }, []);

    const deactivateKeyboard = useCallback(() => {
      setIsKeyboardActive(false);
    }, []);

    // AI services available for selection (removed Copilot and Mistral)
    const AI_SERVICES = useMemo(
      () => [
        { id: 'gpt', label: 'ChatGPT' },
        { id: 'claude', label: 'Claude' },
        { id: 'perplexity', label: 'Perplexity' },
        { id: 'gemini', label: 'Gemini' },
      ],
      [],
    );

    // Toggle AI selection
    const toggleAI = useCallback(
      (aiId: string) => {
        setLocalSelectedAIs(prev => {
          const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];

          // Save to Chrome storage
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ selectedAIs: newSelection });
          }

          // Notify parent if callback provided
          if (onToggleAI) {
            onToggleAI(aiId);
          }

          return newSelection;
        });
      },
      [onToggleAI],
    );

    useImperativeHandle(
      ref,
      () => ({
        focusFirstItem: () => {
          setOpenMenuFor(null);
          if (interactiveItems.length > 0) {
            setFocusIndex(0);
          } else {
            setFocusIndex(-1);
          }
          // Do NOT move DOM focus away from the Searchbar.
          // Keyboard navigation is handled via global keydown (like AltS),
          // so the search input stays focused while arrows move the list selection.
          activateKeyboard();
        },
        deactivateKeyboard,
      }),
      [interactiveItems.length, activateKeyboard, deactivateKeyboard],
    );

    useEffect(() => {
      if (!interactiveItems.length) {
        // When there are no items, clear focus and keyboard state
        setFocusIndex(-1);
        setOpenMenuFor(null);
        deactivateKeyboard();
        // Also clear any command preview in the Searchbar
        if (onCommandPreview) {
          onCommandPreview(null);
        }
        return;
      }

      // Whenever the items list is (re)built (e.g. after clearing search),
      // always default focus back to the first item so navigation and
      // preview behave like initial load.
      const shouldSetFocus = focusIndex < 0 || focusIndex >= interactiveItems.length;
      if (shouldSetFocus) {
        setFocusIndex(0);
      }

      // Explicitly sync the Searchbar preview with the first item whenever
      // interactiveItems changes OR focusIndex is 0, so the icon / placeholder /
      // inner box match the auto-selected recommended item.
      if (!onCommandPreview) return;
      const targetIndex = shouldSetFocus ? 0 : focusIndex;
      const targetItem = interactiveItems[targetIndex];
      if (targetItem && targetItem.kind === 'command') {
        onCommandPreview(targetItem.commandId);
      } else if (targetIndex === 0 && interactiveItems.length > 0) {
        // If first item is not a command, still ensure we clear preview
        onCommandPreview(null);
      }
    }, [interactiveItems, deactivateKeyboard, onCommandPreview, focusIndex]);

    useEffect(() => {
      if (!openMenuFor) return;
      const handleClickOutside = (event: MouseEvent) => {
        const anchor = anchorRefs.current[openMenuFor];
        const menu = menuRefs.current[openMenuFor];
        const target = event.target as HTMLElement;

        // Check if the click is within the unified menu (portal)
        if (target.closest('[data-unified-menu="true"]')) return;

        if (anchor?.contains(target) || menu?.contains(target)) return;
        setOpenMenuFor(null);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuFor]);

    useEffect(() => {
      if (openMenuFor && (!focusedItem || focusedItem.id !== openMenuFor)) {
        setOpenMenuFor(null);
      }
    }, [focusedItem, openMenuFor]);

    useEffect(() => {
      if (!openMenuFor) {
        setMenuFocusIndex(-1);
      }
    }, [openMenuFor]);

    // Handle command preview FIRST (matching AltS behavior)
    // This must run on every focusedItem change to ensure command icon clears immediately when navigating to notes
    // Run this before onHighlightChange to ensure command preview clears first
    useEffect(() => {
      if (!onCommandPreview) return;
      // Always reflect the currently focused item in the searchbar command preview
      // This ensures that when command mode exits (e.g., via Backspace), the preview
      // is restored for the currently focused item
      if (focusedItem && focusedItem.kind === 'command') {
        onCommandPreview(focusedItem.commandId);
      } else {
        onCommandPreview(null);
      }
    }, [focusedItem, onCommandPreview]);

    // Also restore preview when focusIndex changes OR when items change
    // This ensures the preview is updated even if focusedItem reference doesn't change
    // This is critical for restoring preview after command mode exits (e.g., when clearing inline query box)
    // We always call onCommandPreview to ensure preview is restored even if commandId hasn't changed
    useEffect(() => {
      if (!onCommandPreview || !interactiveItems.length) return;
      // Always update preview based on current focusIndex
      // This ensures preview is restored even if focusIndex hasn't changed but command mode exited
      // We call onCommandPreview every time this effect runs to handle the case when
      // command mode exits (via Backspace/Escape in inline query box) and selectedCommand was cleared in Searchbar
      const item = focusIndex >= 0 ? interactiveItems[focusIndex] : null;
      if (item && item.kind === 'command') {
        onCommandPreview(item.commandId);
      } else if (focusIndex >= 0) {
        // If focused item is not a command, clear preview
        onCommandPreview(null);
      } else {
        // No item focused, clear preview
        onCommandPreview(null);
      }
    }, [focusIndex, interactiveItems, onCommandPreview]);

    // Notify parent when highlight changes (for updating search bar value)
    // This runs after command preview to ensure proper order
    useEffect(() => {
      if (!onHighlightChange) return;
      onHighlightChange(focusedItem);
    }, [focusedItem, onHighlightChange]);

    // Calculate dynamic values with tiered scaling for large screens
    const { dynamicFontSize, dynamicRowHeight, dynamicPadding } = useMemo(() => {
      const width = windowDimensions.width;

      let fontSize = 13.5;
      let rowHeight = 44;
      let py = 8;
      let px = 20;

      // Scaling for larger screens
      if (width >= 1800) {
        fontSize = 16;
        rowHeight = 54;
        py = 10;
        px = 24;
      } else if (width >= 1600) {
        fontSize = 15;
        rowHeight = 49;
        py = 9;
        px = 22;
      } else if (width >= 1350) {
        fontSize = 14;
        rowHeight = 44;
        py = 8;
        px = 20;
      }

      return {
        dynamicFontSize: fontSize,
        dynamicRowHeight: rowHeight,
        dynamicPadding: { py, px },
      };
    }, [windowDimensions.width]);

    // Helper to get size for a row (header or item)
    const getItemSize = useCallback(
      (index: number) => {
        const item = visualItems[index];
        if (item.type === 'header') {
          return item.title ? 36 : 0; // Height for headers
        }
        return dynamicRowHeight; // Dynamic height for items
      },
      [visualItems, dynamicRowHeight],
    );

    const moveFocus = useCallback(
      (direction: 1 | -1) => {
        if (!interactiveItems.length) return;
        setFocusIndex(prev => {
          const next = prev + direction;
          // Circular navigation: wrap around at boundaries
          let nextIndex: number;
          if (next < 0) {
            nextIndex = interactiveItems.length - 1; // Wrap to last when going up from first
          } else if (next > interactiveItems.length - 1) {
            nextIndex = 0; // Wrap to first when going down from last
          } else {
            nextIndex = next;
          }

          // Scroll to the visual item corresponding to nextIndex
          const visualIdx = logicalToVisualMap.get(nextIndex);
          if (visualIdx !== undefined && listRef.current) {
            listRef.current.scrollToItem(visualIdx);
          }

          // Immediately update search bar value when focus changes (for keyboard navigation)
          if (onHighlightChange && interactiveItems[nextIndex]) {
            onHighlightChange(interactiveItems[nextIndex]);
          }

          return nextIndex;
        });
      },
      [interactiveItems, onHighlightChange, logicalToVisualMap],
    );

    const closeMenu = useCallback(() => {
      setOpenMenuFor(null);
      setMenuFocusIndex(-1);
      setShowAISubmenu(false); // Reset submenu state
    }, []);

    const toggleActionMenu = useCallback(
      (targetIndex?: number, x?: number | boolean, y?: number, initialMode?: 'hotkey' | 'shortcut') => {
        if (!interactiveItems.length) return;
        const index = typeof targetIndex === 'number' ? targetIndex : focusIndex;
        const item = interactiveItems[index];

        if (!item) return;

        // Update menu position if coords are provided OR if we are opening a new menu
        if (typeof x === 'number' && typeof y === 'number') {
          setMenuPos({ x, y });
        } else if (openMenuFor !== item.id) {
          // Fallback if no coords (keyboard shortcut) - center screen or try to find ref
          const node = anchorRefs.current[item.id];
          if (node) {
            const rect = node.getBoundingClientRect();
            setMenuPos({ x: rect.right, y: rect.bottom + 5 });
          } else {
            // Default center/middle fallback
            setMenuPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          }
        }

        setFocusIndex(index);

        // Handle initial mode (from clickable Set area)
        if (initialMode === 'hotkey') {
          const itemId = getItemCompoundIdInternal(item);
          setEditingHotkeyFor(item.id);
          setEditingShortcutFor(null);
          setEditValue(hotkeysMap[itemId] || '');
          setIsUpdatingHotkey(!!hotkeysMap[itemId]);
          setSaveError(null);
          setOpenMenuFor(item.id);
        } else if (initialMode === 'shortcut') {
          const itemId = getItemCompoundIdInternal(item);
          setEditingShortcutFor(item.id);
          setEditingHotkeyFor(null);
          const val = shortcutsMap[itemId] || '';
          setEditValue(val.replace(/^\//, ''));
          setIsUpdatingShortcut(!!val);
          setSaveError(null);
          setOpenMenuFor(item.id);
        } else {
          setOpenMenuFor(prev => {
            const next = prev === item.id ? null : item.id;
            setMenuFocusIndex(next ? -1 : -1);
            if (!next) {
              setEditingHotkeyFor(null);
              setEditingShortcutFor(null);
              setEditValue('');
              setSaveError(null);
            }
            return next;
          });
        }
      },
      [focusIndex, interactiveItems, getItemCompoundIdInternal, hotkeysMap, shortcutsMap],
    );

    const hasQueryPlaceholder = useCallback((url: string) => {
      return /\{query\}|\[query\]/i.test(url || '');
    }, []);

    const activateItem = useCallback(
      (item: InteractiveItem) => {
        setOpenMenuFor(null);

        // Global check for Tab Group (Bulk Link) - handles both 'link' and 'note' kinds
        // (sometimes TabGroups might be misclassified if category is missing/weird)
        const snippet = (item as any).suggestion?.snippet;
        const category = (snippet?.category || '').toLowerCase();
        // Global check removed to allow Tab Groups to use standard link opening logic below
        /*
        if (category === 'tabgroup' || category === 'tab group') {
          const event = new CustomEvent('openBulkEditor', {
            detail: { snippet },
          });
          window.dispatchEvent(event);
          return;
        }
        */

        if (item.kind === 'command') {
          // Guard: Prevent local commands from activating if user is not logged in
          if (isLocalCommandId(item.commandId) && !isLoggedIn) {
            // We could trigger a dialog here, but Container's onCommandExecute also blocks.
            // However, InteractiveItemsList calls onQuickCommandSelect.
            // Let's pass the call up, and Container will handle the LoginPageDialog.
            onQuickCommandSelect?.(item.commandId);
            return;
          }
          onQuickCommandSelect?.(item.commandId);
          return;
        }
        if (item.kind === 'link' || category === 'tabgroup' || category === 'tab group') {
          const snippetItem = item as SnippetInteractiveItem;

          // Previous tabgroup check removed (moved up)

          let urls = snippetItem.urls ? [...snippetItem.urls] : [];
          if (!urls.length) {
            urls = extractUrlsFromSnippet(snippetItem.suggestion.snippet);
          }
          if (urls.length) {
            const needsVar = urls.some(u => hasQueryPlaceholder(String(u)));
            if (needsVar) {
              if (onRequestOpenUrls) {
                onRequestOpenUrls(urls, snippetItem.title);
              } else {
                const query = window.prompt('Enter query to open links');
                if (query && query.trim()) {
                  const encoded = encodeURIComponent(query.trim());
                  const replaced = urls.map(u => u.replace(/\{query\}/gi, encoded).replace(/\[query\]/gi, encoded));
                  openMultipleLinks(
                    replaced,
                    snippetItem.suggestion.snippet?.snippet_id || snippetItem.suggestion.snippet?.id,
                  );
                }
              }
            } else {
              openMultipleLinks(urls, snippetItem.suggestion.snippet?.snippet_id || snippetItem.suggestion.snippet?.id);
            }
          } else {
            onSnippetSelect(item.suggestion);
          }
          return;
        }
        onSnippetSelect(item.suggestion);
      },
      [onQuickCommandSelect, onSnippetSelect, onRequestOpenUrls, hasQueryPlaceholder, isLoggedIn],
    );

    const buildMenuActions = useCallback(
      (item: InteractiveItem): MenuAction[] => {
        const isCommand = item.kind === 'command';

        // --- COMMAND LOGIC ---
        if (isCommand) {
          const commandItem = item as CommandInteractiveItem;
          // ... (keep existing command actions)
          const actions: MenuAction[] = [
            {
              key: 'run',
              label: 'Run command',
              icon: <FiPlay size={14} />,
              onSelect: () => activateItem(item),
            },
            { key: 'div-0', label: '', icon: null, onSelect: () => { }, divider: true },
            {
              key: 'favorite',
              label: (item as any).isFavorite ? 'Remove from favorites' : 'Mark as favorite',
              icon: (item as any).isFavorite ? <FaStar size={14} className="text-yellow-500" /> : <FiStar size={14} />,
              disabled: !onToggleFavorite,
              closeOnExecute: false,
              onSelect: () => {
                if (onToggleFavorite) {
                  onToggleFavorite(item as any);
                }
              },
            },
            { key: 'div-1', label: '', icon: null, onSelect: () => { }, divider: true },
            {
              key: 'assign-shortcut',
              label: 'Assign command',
              icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              closeOnExecute: false,
              onSelect: async () => {
                const itemId = getItemCompoundIdInternal(item);
                const allShortcuts = await readAllShortcuts();
                let existingValue = allShortcuts[itemId] || '';

                setEditingShortcutFor(item.id);
                setEditingHotkeyFor(null);
                const displayValue = existingValue ? existingValue.replace(/^\//, '') : '';
                setEditValue(displayValue);
                setIsUpdatingShortcut(!!existingValue);
                setSaveError(null);
              },
            },
            {
              key: 'assign-hotkey',
              label: hotkeysMap[getItemCompoundIdInternal(item)]
                ? `Assign hotkey (${hotkeysMap[getItemCompoundIdInternal(item)]})`
                : 'Assign hotkey',
              icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              closeOnExecute: false,
              onSelect: async () => {
                const itemId = getItemCompoundIdInternal(item);
                const allHotkeys = await readAllHotkeys();
                let existingValue = allHotkeys[itemId] || '';

                setEditingHotkeyFor(item.id);
                setEditingShortcutFor(null);
                setEditValue(existingValue || '');
                setIsUpdatingHotkey(!!existingValue);
                setSaveError(null);
              },
            },
            {
              key: 'create-todo',
              label: 'Create Todo',
              icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
              onSelect: (e?: any) => {
                dispatch(
                  setTodoCreatePrefill({
                    snippet_id: `cmd-${commandItem.commandId}`,
                    key: commandItem.label || 'New Task',
                    value: commandItem.commandId || '',
                    category: 'command',
                  }),
                ); 
                dispatch(setShowTodosView(true));
                // Also close the searchbar if it's open
                window.dispatchEvent(new CustomEvent('close-searchbar'));
              },
            },
          ];

          // Add AI Selection Submenu Trigger
          if (item.commandId === 'ai') {
            actions.push({ key: 'div-ai', label: '', icon: null, onSelect: () => { }, divider: true });
            actions.push({
              key: 'header-ai',
              label: 'Select Models',
              icon: null,
              disabled: true,
              className: 'text-[10px] font-bold text-neutral-400 dark:text-neutral-500 px-3 py-1 select-none',
              onSelect: () => { },
            });
            AI_SERVICES.forEach(service => {
              const isSelected = localSelectedAIs.includes(service.id);
              const cmd = COMMANDS.find(c => c.id === service.id);
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
                    <div className="w-4 h-4 rounded overflow-hidden border border-[var(--color-borderDefault)] bg-white flex items-center justify-center flex-shrink-0">
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

          return actions;
        }

        // --- FOLDER LOGIC ---
        if (item.kind === 'folder') {
          // ... (keep folder logic)
          return [
            {
              key: 'open',
              label: 'Open Folder',
              icon: <FiPlay size={14} />,
              onSelect: () => activateItem(item),
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: <FiTrash2 size={14} />,
              className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
              onSelect: () => {
                const folderId = (item as any).suggestion?.folder?.folder_id;

                if (folderId) {
                  onRequestSnippetDelete({
                    commandId: 'delete_folder',
                    snippetId: folderId,
                    snippetKey: item.title,
                    folderId: folderId,
                    category: 'folder',
                    workspaceId: (item as any).suggestion?.workspace?.workspace_id || '',
                    orgId: (item as any).suggestion?.workspace?.org_id || '',
                  });
                }
              },
            },
          ];
        }

        // --- SNIPPET LOGIC ---
        const snippetItem = item as SnippetInteractiveItem;
        const isLink = snippetItem.kind === 'link';
        const snippet = snippetItem.suggestion?.snippet;
        const isNote = snippet && snippet.category?.toLowerCase() === 'snippet';
        const isTabGroup =
          snippet &&
          (snippet.category?.toLowerCase() === 'tabgroup' || snippet.category?.toLowerCase() === 'tab group');
        const isPrompt = snippetItem.kind === 'prompt';

        const actions: MenuAction[] = [
          {
            key: 'open',
            label: 'Open',
            icon: <FiPlay size={14} />,
            onSelect: () => activateItem(item),
          },
          // Only show "Open in full screen" for notes, not for links
          ...(isNote && !isPrompt
            ? [
              {
                key: 'open-new-tab',
                label: `Open in full screen ${isMac ? '(⌘+Enter)' : '(Ctrl+Enter)'}`,
                icon: <FiExternalLink size={14} />,
                onSelect: () => {
                  if (snippet) {
                    const snippetId = snippet.snippet_id || snippet.id;
                    if (snippetId) {
                      openNoteInNewTab(snippetId);
                    }
                  }
                },
              },
            ]
            : []),
          {
            key: 'edit',
            label: `${isTabGroup ? 'Edit routine' : isLink ? 'Edit link' : isPrompt ? 'Edit prompt' : 'Edit note'} ${isMac ? '(⌘+Shift+E)' : '(Alt+Shift+E)'}`,
            icon: <FiEdit2 size={14} />,
            onSelect: () => {
              if (isLink || isTabGroup || isPrompt) {
                if (onRequestEditLink) {
                  onRequestEditLink(snippetItem.suggestion);
                }
              } else {
                activateItem(item);
              }
            },
            closeOnExecute: !isLink && !isTabGroup && !isPrompt, // Keep open for these if editing handled externally/popup
          },
          {
            key: 'create-todo',
            label: 'Create Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: (e?: any) => {
              dispatch(
                setTodoCreatePrefill({
                  snippet_id: snippet?.snippet_id || snippet?.id,
                  key: snippet?.key || item.title,
                  value: typeof snippet?.value === 'string' ? snippet.value : JSON.stringify(snippet?.value),
                  category: snippet?.category || item.kind,
                }),
              );
              dispatch(setShowTodosView(true));
              // Also close the searchbar if it's open
              window.dispatchEvent(new CustomEvent('close-searchbar'));
            },
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <FiTrash2 size={14} />,
            className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
            onSelect: () => {
              const detail = buildSnippetDeleteDetail(snippetItem.suggestion, snippetItem.kind as any);
              if (detail) {
                onRequestSnippetDelete(detail);
              }
            },
          },
        ];

        actions.push({ key: 'div-0', label: '', icon: null, onSelect: () => { }, divider: true });

        const favoriteAction: MenuAction = onToggleFavorite
          ? {
            key: 'favorite',
            label: snippetItem.isFavorite ? 'Remove from favourites' : 'Mark as favourite',
            icon: snippetItem.isFavorite ? <FaStar size={14} className="text-yellow-500" /> : <FiStar size={14} />,
            closeOnExecute: false,
            onSelect: () => {
              onToggleFavorite(snippetItem);
            },
          }
          : {
            key: 'favorite',
            label: snippetItem.isFavorite ? 'Remove from favourites' : 'Mark as favourite',
            icon: snippetItem.isFavorite ? <FaStar size={14} className="text-yellow-500" /> : <FiStar size={14} />,
            disabled: true,
            closeOnExecute: false,
            onSelect: () => undefined,
          };

        actions.push(favoriteAction);

        actions.push({ key: 'div-1', label: '', icon: null, onSelect: () => { }, divider: true });

        // Add Assign shortcut (for snippets)
        {
          const itemId = getItemCompoundIdInternal(item);
          const currentShortcut = shortcutsMap[itemId];
          actions.push({
            key: 'assign-shortcut',
            label: currentShortcut ? `Assign command (${currentShortcut})` : 'Assign command',
            icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
            className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
            closeOnExecute: false,
            onSelect: async () => {
              const innerItemId = getItemCompoundIdInternal(item);
              const allShortcuts = await readAllShortcuts();
              let existingValue = allShortcuts[innerItemId] || '';

              setEditingShortcutFor(item.id);
              setEditingHotkeyFor(null);
              // Strip leading slash if present, as the UI adds one
              const displayValue = existingValue ? existingValue.replace(/^\//, '') : '';
              setEditValue(displayValue);
              setIsUpdatingShortcut(!!existingValue);
              setSaveError(null);
            },
          });
        }

        actions.push({
          key: 'assign-hotkey',
          label: hotkeysMap[getItemCompoundIdInternal(item)]
            ? `Assign hotkey (${hotkeysMap[getItemCompoundIdInternal(item)]})`
            : 'Assign hotkey',
          icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
          className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
          closeOnExecute: false,
          onSelect: async () => {
            const itemId = getItemCompoundIdInternal(item);
            const allHotkeys = await readAllHotkeys();
            let existingValue = allHotkeys[itemId] || '';

            setEditingHotkeyFor(item.id);
            setEditingShortcutFor(null);
            setEditValue(existingValue || '');
            setIsUpdatingHotkey(!!existingValue);
            setSaveError(null);
          },
        });

        return actions;
      },
      [
        activateItem,
        onRequestSnippetDelete,
        onToggleFavorite,
        onRequestEditLink,
        isMac,
        getItemCompoundIdInternal,
        saveHotkey,
        saveShortcut,
        hotkeysMap,
        shortcutsMap,
        localSelectedAIs,
        toggleAI,
      ],
    );

    const getCurrentMenuActions = useCallback((): MenuAction[] => {
      if (!openMenuFor) return [];
      const index = interactiveIndexMap.get(openMenuFor);
      if (index === undefined) return [];
      const item = interactiveItems[index];
      if (!item) return [];

      let actions = buildMenuActions(item);

      if (!isLoggedIn) {
        // Filter out actions that require login, EXCEPT create-link which should trigger the login popup
        actions = actions.filter(
          a => !['favorite', 'assign-shortcut', 'assign-hotkey', 'create-todo', 'convert-to-todo', 'schedule'].includes(a.key as string)
        );
        // Clean up any double dividers created by filtering
        actions = actions.filter((a, i, arr) => {
          if (a.divider) {
            if (i === 0) return false;
            if (!arr.slice(i + 1).some(x => !x.divider)) return false;
            if (arr[i - 1].divider) return false;
          }
          return true;
        });
      }

      return actions;
    }, [openMenuFor, interactiveIndexMap, interactiveItems, buildMenuActions, isLoggedIn]);

    const executeMenuAction = useCallback(
      (action: MenuAction) => {
        if ('divider' in action && action.divider) return;
        if (action.disabled) return;

        const requiresLogin = ['favorite', 'assign-shortcut', 'assign-hotkey', 'schedule', 'create-todo', 'convert-to-todo', 'create-link'].includes(action.key as string);
        if (requiresLogin && !isLoggedIn) {
          triggerToast('Please login to use the extension', 'error');
          return;
        }

        action.onSelect();
        if (action.closeOnExecute !== false) {
          closeMenu();
        }
      },
      [closeMenu, isLoggedIn],
    );

    const processKeyEvent = useCallback(
      (event: KeyboardEvent) => {
        // Skip keyboard handling when prompt menu is open in Searchbar OR @ menu is open
        // We allow events when isCommandLocked is true to support navigating/activating items (like Draft Restore)
        // while a command (like /gpt) is locked in the Searchbar.
        if (
          isPromptMenuOpen ||
          isAtMenuOpen ||
          (window as any).isFavoritesMenuOpen ||
          (window as any).isTodoDashboardOpen ||
          isLinkEditModalOpen ||
          (window as any).isGlobalCreateMenuOpen
        )
          return;

        const container = containerRef.current;
        if (!container) return;

        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName ?? '';
        const isInputLike = tagName === 'INPUT' || tagName === 'TEXTAREA' || Boolean(target?.isContentEditable);
        const isInsideContainer = target ? container.contains(target) : false;

        // Determine if target is a searchbar input
        const isSearchbarInput = Boolean(
          target?.getAttribute('data-searchbar-input') === 'true' ||
          target?.id === 'searchbar-input' ||
          target?.id === 'searchbar-inline-input' ||
          target?.closest('.searchbar-glow-container')
        );

        // If focus is in an input-like element that is NOT the searchbar input, do not capture/intercept keys
        if (isInputLike && !isSearchbarInput) {
          return;
        }

        // Allow keyboard navigation from the Searchbar/input while keeping input focused,
        // matching AltS behavior.
        if (!isInsideContainer) {
          // Only handle navigation keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter, Escape) and Control/Command from input
          const isNavigationKey = [
            'ArrowDown',
            'ArrowUp',
            'ArrowLeft',
            'ArrowRight',
            'Enter',
            'Escape',
            'Control',
            'Meta',
          ].includes(event.key);
          const isCtrlK = (isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';
          const isAltShiftE = isMac
            ? event.metaKey && event.shiftKey && event.key.toLowerCase() === 'e'
            : event.altKey && event.shiftKey && event.key.toLowerCase() === 'e';

          if (isInputLike && !isNavigationKey && !isCtrlK && !isAltShiftE) {
            return;
          }
          // If keyboard is not active but we have items and it's a navigation key or Control from input,
          // activate keyboard mode and handle the navigation
          const isActionModifier = isMac ? event.metaKey : event.ctrlKey;
          const isControlKey = event.key === 'Control' || event.key === 'Meta';

          if (
            !isKeyboardActive &&
            interactiveItems.length > 0 &&
            (isNavigationKey || isCtrlK || isControlKey || isAltShiftE)
          ) {
            activateKeyboard();
            // Continue to handle the key below
          } else if (!isKeyboardActive && !isCtrlK && !isControlKey && !isAltShiftE) {
            return;
          }
        }

        const key = event.key;

        if (openMenuFor) {
          const actions = getCurrentMenuActions();
          if (!actions.length) {
            if (key === 'Escape') {
              event.preventDefault();
              closeMenu();
            }
            return;
          }

          if (key === 'ArrowDown') {
            event.preventDefault();
            setMenuFocusIndex(prev => {
              const current = prev >= 0 ? prev : -1;
              const next = current < actions.length - 1 ? current + 1 : 0;
              return next;
            });
            return;
          }

          if (key === 'ArrowUp') {
            event.preventDefault();
            setMenuFocusIndex(prev => {
              const current = prev >= 0 ? prev : actions.length;
              const next = current > 0 ? current - 1 : actions.length - 1;
              return next;
            });
            return;
          }

          if (key === 'Enter') {
            event.preventDefault();
            const targetIndex = menuFocusIndex >= 0 ? menuFocusIndex : 0;
            const action = actions[targetIndex];
            if (action) {
              executeMenuAction(action);
            }
            return;
          }

          if (key === 'Escape') {
            event.preventDefault();
            closeMenu();
            return;
          }

          return;
        }

        if (!interactiveItems.length) {
          if (key === 'ArrowUp' && onRequestFocusSearch) {
            event.preventDefault();
            setOpenMenuFor(null);
            deactivateKeyboard();
            onRequestFocusSearch();
          }
          return;
        }

        if (key === 'ArrowDown') {
          event.preventDefault();
          
          // If focusIndex is -1 (not set), set it to 0 (first item)
          // Otherwise, move to next item
          if (focusIndex < 0) {
            
            if (interactiveItems.length > 0 && interactiveItems[0] && onHighlightChange) {
              onHighlightChange(interactiveItems[0]);
            }
            setFocusIndex(0);
          } else {
            
            moveFocus(1);
          }
          return;
        }

        if (key === 'ArrowUp') {
          event.preventDefault();
          // Circular navigation: wrap to last item when at first (or before first)
          // If focusIndex is -1 (not set), set it to last item
          if (focusIndex < 0) {
            if (interactiveItems.length > 0) {
              const lastIndex = interactiveItems.length - 1;
              setFocusIndex(lastIndex);
              if (onHighlightChange && interactiveItems[lastIndex]) {
                onHighlightChange(interactiveItems[lastIndex]);
              }
            }
          } else {
            moveFocus(-1);
          }
          return;
        }

        // Handle Control+Enter (Windows) or Command+Enter (Mac) to open notes in new tab
        const isActionModifier = isMac ? event.metaKey : event.ctrlKey;
        if (isActionModifier && key === 'Enter') {
          const item = focusedItem;
          if (item && item.kind === 'note') {
            event.preventDefault();
            const snippetItem = item as SnippetInteractiveItem;
            const snippet = snippetItem.suggestion?.snippet;
            if (snippet) {
              const snippetId = snippet.snippet_id || snippet.id;
              if (snippetId) {
                openNoteInNewTab(snippetId);
              }
            }
            return;
          }
        }

        // Handle Alt+Shift+E (Windows) or Command+Shift+E (Mac) to open edit panel
        const isAltShiftE = isMac
          ? event.metaKey && event.shiftKey && key.toLowerCase() === 'e'
          : event.altKey && event.shiftKey && key.toLowerCase() === 'e';

        if (isAltShiftE) {
          const item = focusedItem;
          if (item && (item.kind === 'note' || item.kind === 'link')) {
            event.preventDefault();
            const snippetItem = item as SnippetInteractiveItem;
            const snippet = snippetItem.suggestion?.snippet;
            const isLink = snippetItem.kind === 'link';
            const isTabGroup =
              snippet &&
              (snippet.category?.toLowerCase() === 'tabgroup' || snippet.category?.toLowerCase() === 'tab group');

            if (isLink || isTabGroup) {
              // For links and tab groups, open edit link panel
              if (onRequestEditLink) {
                onRequestEditLink(snippetItem.suggestion);
              }
            } else {
              // For notes, activate item to open edit panel
              activateItem(item);
            }
            return;
          }
        }

        if (key === 'Enter') {
          const item = focusedItem;
          if (item) {
            event.preventDefault();
            activateItem(item);
          }
          return;
        }

        // Ctrl+Right Arrow opens action menu (only when menu is not open)
        const isCtrlRight = (isMac ? event.metaKey : event.ctrlKey) && key === 'ArrowRight';
        if (isCtrlRight && !openMenuFor) {
          event.preventDefault();
          // Ensure keyboard mode is active
          setIsKeyboardActive(true);
          // Ensure we have items
          if (!interactiveItems.length) return;

          // If no item is focused, use first item (index 0), otherwise use current focus
          const targetIndex = focusIndex < 0 ? 0 : focusIndex;
          // toggleActionMenu will handle setting focusIndex and opening the menu
          toggleActionMenu(targetIndex);
          return;
        }

        if (key === 'Escape' && openMenuFor) {
          event.preventDefault();
          closeMenu();
        }
      },
      [
        interactiveItems,
        moveFocus,
        focusedItem,
        activateItem,
        toggleActionMenu,
        openMenuFor,
        onRequestFocusSearch,
        focusIndex,
        isKeyboardActive,
        activateKeyboard,
        deactivateKeyboard,
        getCurrentMenuActions,
        closeMenu,
        executeMenuAction,
        menuFocusIndex,
        isPromptMenuOpen,
        isAtMenuOpen,
        isSuggestionVisible,
      ],
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        processKeyEvent(event.nativeEvent);
      },
      [processKeyEvent],
    );

    useEffect(() => {
      const handleWindowKeyDown = (event: KeyboardEvent) => {
        processKeyEvent(event);
      };
      // Use capture phase so we see arrows even if host page stops bubbling (e.g. Linear)
      const listenerOptions = { capture: true } as const;
      window.addEventListener('keydown', handleWindowKeyDown, listenerOptions);
      return () => window.removeEventListener('keydown', handleWindowKeyDown, listenerOptions);
    }, [processKeyEvent]);

    useEffect(() => {
      if (focusIndex < 0) return;

      // Sync virtualization scroll on external focus changes (e.g. initial load or mouse click fallback)
      const visualIdx = logicalToVisualMap.get(focusIndex);
      if (visualIdx !== undefined && listRef.current) {
        listRef.current.scrollToItem(visualIdx);
      }
    }, [focusIndex, logicalToVisualMap]);

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
        closeMenu();
      }
    }, [conflictId, dispatch, closeMenu]);

    const itemData = useMemo(
      () => ({
        visualItems,
        focusIndex,
        openMenuFor,
        interactiveIndexMap,
        toggleActionMenu,
        activateItem,
        deactivateKeyboard,
        onHighlightChange,
        anchorRefs,
        setFocusIndex,
        dynamicRowHeight,
        dynamicPadding,
        headingFontStyle,
        getItemTagMeta,
        renderSnippetIcon,
        getItemCompoundIdInternal,
        hotkeysMap,
        shortcutsMap,
        activeMenuId: openMenuFor,
        listWidth: '100%',
        isDarkMode,
        todoCounts,
      }),
      [
        visualItems,
        focusIndex,
        openMenuFor,
        interactiveIndexMap,
        toggleActionMenu,
        activateItem,
        deactivateKeyboard,
        onHighlightChange,
        anchorRefs,
        setFocusIndex,
        dynamicRowHeight,
        dynamicPadding,
        headingFontStyle,
        getItemTagMeta,
        renderSnippetIcon,
        getItemCompoundIdInternal,
        hotkeysMap,
        shortcutsMap,
        isDarkMode,
        todoCounts,
      ],
    );

    // Row component moved outside to prevent re-renders

    const renderActiveMenu = () => {
      if (!openMenuFor || !menuPos || !interactiveItems.length) return null;

      const index = interactiveIndexMap.get(openMenuFor);
      if (index === undefined) return null;
      const item = interactiveItems[index];
      if (!item) return null;

      const actions = getCurrentMenuActions();

      return (
        <UnifiedContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={closeMenu}
          actions={actions}
          showSearch={!!isLoggedIn}
          hotkeyInput={
            editingHotkeyFor === item.id
              ? {
                value: editValue,
                onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  const result = captureHotkey(e);
                  if (!result) return;

                  if (result === 'CANCEL') {
                    handleCancelEdit();
                  } else if (result) {
                    // Valid hotkey string
                    setEditValue(result as string);
                    setSaveError(null);
                  }
                },
                onSave: () => saveHotkey(item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteHotkey,
                isSaving: isSaving,
                isUpdating: isUpdatingHotkey,
                onClear: () => {
                  setEditValue('');
                  saveHotkey(item, '', false);
                },
              }
              : undefined
          }
          shortcutInput={
            editingShortcutFor === item.id
              ? {
                value: editValue,
                onChange: setEditValue,
                onSave: () => saveShortcut(item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteShortcut,
                isSaving: isSaving,
                isUpdating: isUpdatingShortcut,
              }
              : undefined
          }
          rightPanelContent={
            showAISubmenu && item.id === openMenuFor ? (
              <AIServiceSelectionPanel
                services={AI_SERVICES}
                selectedIds={localSelectedAIs}
                onToggle={toggleAI}
                commands={COMMANDS}
                onClose={() => setShowAISubmenu(false)}
              />
            ) : undefined
          }
          onNavigateAlreadyAssigned={handleGoToConflict}
          error={saveError || undefined}
          conflictId={conflictId}
          itemId={getItemCompoundIdInternal(item)}
        />
      );
    };

    return (
      <>
        <div
          ref={containerRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onMouseDown={e => {
            if (e.button === 0) e.preventDefault();
            activateKeyboard();
          }}
          className="relative flex h-fit max-h-full flex-col overflow-hidden outline-none border border-white/10 rounded-b-xl rounded-t-none bg-[var(--color-containerBg)] shadow-sm"
          aria-label="Search content">
          <div ref={scrollAreaRef} className="flex-1 w-full relative">
            <List
              ref={listRef}
              height={Math.min(
                visualItems.length * dynamicRowHeight + dynamicRowHeight * 0.5, // Small buffer
                Math.max(windowDimensions.height * (windowDimensions.width >= 1600 ? 0.48 : 0.40), 350), // 48% height for big screens, 40% for others
              )}
              itemCount={visualItems.length}
              itemSize={getItemSize}
              width="100%"
              itemData={itemData}
              className="default-visible-scrollbar"
              onScroll={() => {
                setOpenMenuFor(null);
              }}>
              {Row}
            </List>

            {/* Empty state if needed */}
            {!visualItems.length && (
              <div className="absolute inset-0 m-3 h-fit rounded-lg border border-dashed border-white/50 dark:border-neutral-700/50 bg-[#fdf6e3]/50 dark:bg-neutral-800/30 px-3 py-3 text-xs text-[#586e75] dark:text-neutral-500">
                {sections[0]?.emptyMessage || 'No results found'}
              </div>
            )}

            {/* Flat Bottom Toast Notification */}
            {((status && status.status !== 'idle') || (inlineNotification && showInlineNotif)) && (
              <div className="absolute bottom-0 left-0 right-0 z-[99999] pointer-events-none flex flex-col">
                <div className="flex items-center justify-center gap-2 px-4 py-2  backdrop-blur-sm w-full">
                  {status && status.status !== 'idle' ? (
                    <>
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          status.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span className="text-white/90 text-[12px] font-normal tracking-wide select-none">{typeof status.message === 'string' ? status.message : JSON.stringify(status.message)}</span>
                    </>
                  ) : (
                    <>
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          inlineNotification!.type === 'error'
                            ? 'bg-red-500'
                            : inlineNotification!.type === 'success'
                              ? 'bg-emerald-500'
                              : inlineNotification!.type === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                        }`}
                      />
                      <span className="text-white/90 text-[12px] font-normal tracking-wide select-none">{typeof inlineNotification!.message === 'string' ? inlineNotification!.message : JSON.stringify(inlineNotification!.message)}</span>
                    </>
                  )}
                </div>
                {/* Auto-close progress line */}
                <div
                  className={`h-[2px] w-full origin-left animate-shrink-3s ${
                    status && status.status === 'error'
                      ? 'bg-red-500'
                      : status && status.status !== 'idle'
                        ? 'bg-emerald-500'
                        : inlineNotification!.type === 'error'
                          ? 'bg-red-500'
                          : inlineNotification!.type === 'success'
                            ? 'bg-emerald-500'
                            : inlineNotification!.type === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                  }`}
                />
              </div>
            )}
          </div>
        </div>
        {renderActiveMenu()}
      </>
    );
  },
);

InteractiveItemsList.displayName = 'InteractiveItemsList';

export default React.memo(InteractiveItemsList);
