import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FiEdit2, FiPlay, FiStar, FiTrash2, FiExternalLink, FiLoader, FiZapOff, FiChevronRight } from 'react-icons/fi';
import { FaFileAlt, FaLayerGroup, FaLink, FaStar, FaFolder, FaCheck, FaTimes, FaTerminal } from 'react-icons/fa';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import { AiOutlineEnter } from 'react-icons/ai';
import { getFaviconUrl } from '../Searchbar/utils';
import { AI_GROUP, type CommandId } from '../Searchbar/commands';
import type { SnippetSuggestion } from '../Searchbar/Searchbar';
import { isLocalCommandId, type SnippetActionDetail, type LocalCommandId } from '../Searchbar/localCommands';
import { buildSnippetDeleteDetail, extractUrlsFromSnippet } from './snippetInteractiveUtils';
import { TerminalIcon } from '@src/components/Shared/utils/terminalIcon';
import CmdIcon from '../../Shared/Icons/CmdIcon';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, fetchAllDataThunk } from '../../../../../Redux/AllData/allDataSlice';
import {
  selectIsMac,
  selectDarkMode,
  setCommandStatus,
  resetCommandStatus,
  type CommandStatus,
  selectIsLinkEditModalOpen,
} from '../../../../../Redux/AllData/uiStateSlice';
import { updateSnippetHotkey, updateSnippetShortcut } from '../../../../../Apis/features/snippetApi';
import { updateHotkeyAndRefresh, updateCommandAndRefresh } from '../../../../../Apis/features/userCommandsApiService';
import { updateLocalHotkey, updateLocalShortcut } from '../../../../../utils/shortcutHotkeyUtils';
import {
  readAllHotkeys,
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
  readAllShortcuts,
} from '../../Shared/utils/hotkeyUtils';
import { BsKeyboard } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { useHotkeyAssignment } from '../../../hooks/useHotkeyAssignment';
import { LOCAL_COMMANDS } from '../Searchbar/localCommands';
import { useLocalCommandCustomizations } from '../../../hooks/useLocalCommandCustomizations';

const HotkeyBadge: React.FC<{ hotkey: string }> = ({ hotkey }) => {
  const isMac = useSelector(selectIsMac);
  if (!hotkey) return null;

  const parts = hotkey.split('+').map(p => p.trim());
  return (
    <span className="flex items-center gap-0.5 ml-1.5 opacity-80 scale-90 origin-right">
      {parts.map((part, i) => {
        let display = part;
        if (isMac) {
          if (part.toLowerCase() === 'alt') display = '⌥';
        }

        return (
          <React.Fragment key={i}>
            <span className="bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-200/50 dark:border-white/10 font-mono text-[10px] min-w-[1.2rem] text-center shadow-sm">
              {display}
            </span>
            {i < parts.length - 1 && <span className="text-[10px] text-neutral-400">+</span>}
          </React.Fragment>
        );
      })}
    </span>
  );
};

export type CommandInteractiveItem = {
  kind: 'command';
  id: string;
  commandId: CommandId | LocalCommandId | 'ai';
  label: string;
  description: string;
  iconHosts: string[];
  keywords: string[];
  iconStack?: boolean;
  icon?: ReactNode | React.ComponentType<{ className?: string; size?: number }>;
};

export type SnippetInteractiveItem = {
  kind: 'note' | 'link';
  id: string;
  title: string;
  context: string;
  preview: string;
  icon: 'note' | 'link' | 'tabgroup';
  suggestion: SnippetSuggestion;
  isFavorite?: boolean;
  urls?: string[];
};

export type FolderInteractiveItem = {
  kind: 'folder';
  id: string;
  title: string;
  context: string; // "WorkspaceName" or "ParentFolder"
  icon: 'folder';
  suggestion: SnippetSuggestion; // We might need to adapt this or make it optional? Actually, existing code uses suggestion for selection.
  // SnippetSuggestion can represent a folder too? Let's check SnippetSuggestion type in SearchBar.
  // For now, let's assume we build a suggestion for the folder.
};

export type InteractiveItem = CommandInteractiveItem | SnippetInteractiveItem | FolderInteractiveItem;

export type InteractiveSection = {
  key: string;
  title: string;
  items: InteractiveItem[];
  hint?: string;
  emptyMessage?: string;
};

type MenuAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
  divider?: boolean; // Support for separator lines
  closeOnExecute?: boolean;
  shortcut?: string | React.ReactNode;
};

export interface InteractiveItemsListProps {
  sections: InteractiveSection[];
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai') => void;
  onCommandPreview?: (commandId: CommandId | LocalCommandId | 'ai' | null) => void;
  onSnippetSelect: (suggestion: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestFocusSearch?: () => void;
  actionsButtonLabel?: string;
  onToggleFavorite?: (item: SnippetInteractiveItem) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestEditLink?: (suggestion: SnippetSuggestion) => void;
  selectedAIs?: string[];
  onToggleAI?: (aiId: string) => void;
  folderInfo?: {
    name: string;
    notesCount: number;
    linksCount: number;
  };
  status?: CommandStatus;
  onNavigateBack?: () => void;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
}

export interface InteractiveItemsListHandle {
  focusFirstItem: (moveToNext?: boolean) => void;
  deactivateKeyboard: () => void;
}

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

const openMultipleLinks = (urls: string[]) => {
  if (urls.length === 0) return;

  const chromeAny = (window as any)?.chrome;

  const getFinalUrl = (url: string) => {
    if (url.startsWith('note:')) {
      const noteId = url.substring(5);
      return chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`);
    }
    if (url.startsWith('agent_chat?id=')) {
      const agentId = url.split('id=')[1];
      return chrome.runtime.getURL(`new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`);
    }
    return url;
  };

  const finalUrls = urls.map(getFinalUrl).filter(Boolean);
  if (finalUrls.length === 0) return;

  const firstUrl = finalUrls[0];

  if (chromeAny?.tabs) {
    chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs && tabs[0]) {
        // Update current tab with first URL, open the rest in new tabs
        chromeAny.tabs.update(tabs[0].id, { url: firstUrl });
        finalUrls.slice(1).forEach(url => chromeAny.tabs.create({ url }));
      } else {
        // Fallback: create new tabs if we can't find the current one
        finalUrls.forEach(url => chromeAny.tabs.create({ url }));
      }
    });
  } else {
    // Navigate current tab, open remaining in new windows as a last resort
    window.location.href = firstUrl;
    finalUrls.slice(1).forEach(url => window.open(url, '_blank', 'noopener'));
  }
};

// Open a note in a new tab with full-screen view (same approach as AltS)
const openNoteInNewTab = (snippetId: string) => {
  if (!snippetId) return;
  const chromeAny = (window as any)?.chrome;

  // Try getting the extension URL and sending message to background to open tab
  if (chromeAny?.runtime?.sendMessage) {
    // Get extension URL via runtime.getURL if available
    let extensionUrl = '';
    if (chromeAny.runtime.getURL) {
      extensionUrl = chromeAny.runtime.getURL(
        `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
      );
    } else {
      // Fallback: construct URL with extension ID
      const extensionId = chromeAny.runtime.id;
      if (extensionId) {
        extensionUrl = `chrome-extension://${extensionId}/new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`;
      }
    }

    if (extensionUrl) {
      // Send message to background script to open the tab (not blocked by Chrome/ad blockers)
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
          }
        }
      });
      return;
    }
  }

  // If sendMessage not available, try direct tab creation
  if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
    const extensionUrl = chromeAny.runtime.getURL(
      `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
    );
    chromeAny.tabs.create({ url: extensionUrl });
    return;
  }

  console.warn('[openNoteInNewTab] chrome.runtime.sendMessage and tabs.create not available');
};

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-1">
    {keys.map(key => (
      <span
        key={key}
        className="rounded border border-white/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 shadow-sm dark:border-neutral-700">
        {key}
      </span>
    ))}
  </span>
);

const CommandIcon: React.FC<{ item: CommandInteractiveItem }> = ({ item }) => {
  if (item.icon) {
    if (React.isValidElement(item.icon)) {
      return <div className="h-4 w-4 flex items-center justify-center">{item.icon}</div>;
    }
    if (typeof item.icon === 'function') {
      const IconComponent = item.icon as React.ComponentType<{ className?: string; size?: number }>;
      return <IconComponent className="h-4 w-4 text-[var(--color-iconDefault)]" size={16} />;
    }
    return <div className="h-4 w-4 flex items-center justify-center">{item.icon}</div>;
  }

  if (item.iconStack && item.iconHosts.length > 0) {
    return (
      <div className="flex -space-x-1.5 items-center justify-start">
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

  // Check if it's a local command (indicated by empty iconHosts)
  if (item.iconHosts.length === 0 && isLocalCommandId(item.commandId)) {
    return (
      <div className="w-8 h-4 flex items-center justify-center scale-[0.5] origin-center">
        <CmdIcon />
      </div>
    );
  }

  const host = item.iconHosts[0];
  if (!host) {
    return <div className="h-4 w-4 rounded bg-neutral-300" />;
  }

  return <img src={getFaviconUrl(host)} alt={item.label} className="h-4 w-4 rounded shadow-sm" />;
};

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

// Helper function to extract URLs from a snippet value
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
    return <FaFolder className="h-4 w-4 text-[var(--color-iconDefault)]" />;
  }

  const snippetItem = item as SnippetInteractiveItem;
  const snippet = snippetItem.suggestion?.snippet;
  const category = (snippet.category || 'snippet').toLowerCase();

  // For code snippets (category: 'note'), show code icon
  if (category === 'note') {
    return <NotesIcon size={16} />;
  }

  // For links, show favicon
  if (item.icon === 'link') {
    const urls = snippetItem.urls || extractUrlsFromValue(snippet?.value);
    if (urls.length > 0) {
      return <img src={getFaviconUrl(urls[0])} alt="" className="h-4 w-4 rounded-sm object-contain" />;
    }
    return <FaLink className="h-4 w-4 text-[var(--color-iconDefault)]" />;
  }

  // For tabgroups, show stacked favicons (like AllAI command)
  if (item.icon === 'tabgroup') {
    const urls = snippetItem.urls || extractUrlsFromValue(snippet?.value);
    if (urls.length > 0) {
      return (
        <div className="flex -space-x-1.5 items-center">
          {urls.slice(0, 3).map((url, i) => (
            <div
              key={`tabgroup-icon-${i}`}
              className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white/50 dark:border-neutral-700/50 bg-white">
              <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
            </div>
          ))}
        </div>
      );
    }
    return <FaLayerGroup className="h-4 w-4 text-[var(--color-iconDefault)]" />;
  }

  return <NotesIcon size={16} className="text-[var(--color-iconDefault)]" />;
};

const getItemTagMeta = (item: InteractiveItem) => {
  if (item.kind === 'command') {
    return {
      label: 'Command',
    };
  }
  if (item.kind === 'link') {
    return {
      label: 'Links',
    };
  }
  if (item.kind === 'folder') {
    return {
      label: 'Folders',
    };
  }

  const snippetItem = item as SnippetInteractiveItem;
  const snippet = snippetItem.suggestion?.snippet;
  const category = (snippet?.category || 'snippet').toLowerCase();

  if (category === 'note') {
    return {
      label: 'Snippet',
    };
  }

  return {
    label: 'Snippet',
  };
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
      actionsButtonLabel = 'Options',
      onToggleFavorite,
      onRequestOpenUrls,
      onRequestEditLink,
      selectedAIs = ['gpt', 'perplexity'],
      onToggleAI,
      folderInfo,
      status,
      onNavigateBack,
      onNavigateToListView,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const anchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const filteredSections = useMemo(
      () =>
        sections
          .map(section => ({
            ...section,
            items: section.items.filter(item => {
              if (item.kind !== 'command') return true;
              const cmd = item as CommandInteractiveItem;
              const label = String(cmd.label || '').toLowerCase();
              return cmd.commandId !== 'store' && label !== 'module store';
            }),
          }))
          .filter(section => section.items.length > 0 || section.emptyMessage),
      [sections],
    );

    const interactiveItems = useMemo(() => filteredSections.flatMap(section => section.items), [filteredSections]);

    const interactiveIndexMap = useMemo(() => {
      const map = new Map<string, number>();
      interactiveItems.forEach((item, index) => map.set(item.id, index));
      return map;
    }, [interactiveItems]);

    const dispatch = useDispatch();
    const isMac = useSelector(selectIsMac);
    const isDarkMode = useSelector(selectDarkMode);
    const allData = useSelector(selectAllData);
    const isLinkEditModalOpen = useSelector(selectIsLinkEditModalOpen);
    const { saveCustomization } = useLocalCommandCustomizations();
    const [focusIndex, setFocusIndex] = useState(-1);
    const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
    const showSectionHeader = false; // Define missing variable

    // Load hotkeys and listen for changes
    useEffect(() => {
      let mounted = true;
      const loadHotkeys = async () => {
        const allHotkeys = await readAllHotkeys();
        if (!mounted) return;
        setHotkeysMap(allHotkeys);
      };

      loadHotkeys();

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (
          changes.alts_command_hotkeys ||
          changes.alts_link_hotkeys ||
          changes.alts_note_hotkeys ||
          changes.alts_commands
        ) {
          loadHotkeys();
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        mounted = false;
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }, []);

    const getItemCompoundIdInternal = useCallback((item: InteractiveItem) => {
      if (item.kind === 'command') return item.id;
      if (item.kind === 'folder') return item.id; // Folders might not have hotkeys, but safe to return ID
      const snippetItem = item as SnippetInteractiveItem;
      return getItemCompoundId(snippetItem);
    }, []);

    const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
    const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdatingShortcut, setIsUpdatingShortcut] = useState(false);
    const [isUpdatingHotkey, setIsUpdatingHotkey] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const { captureHotkey } = useHotkeyAssignment(editValue, isMac);

    const findConflictingItemName = useCallback(
      (conflictingId: string) => {
        // Check commands
        const cmd = AI_GROUP.members.find(m => m === conflictingId); // Simple check for AI group
        if (cmd) return cmd;

        if (!allData) return null;

        // Check Snippets (Workspaces/Folders)
        for (const team of allData) {
          for (const workspace of team.workspaces) {
            // Check workspace snippets
            if (workspace.workspace_snippets) {
              for (const s of workspace.workspace_snippets) {
                const sId = s.snippet_id || s.id;
                const compound = `${workspace.workspace_id}-${sId}`;
                if (compound === conflictingId || String(sId) === conflictingId) return s.key;
              }
            }
            // Check folder snippets
            if (workspace.folders) {
              for (const folder of workspace.folders) {
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

    const saveShortcut = useCallback(
      async (item: InteractiveItem, shortcutValue: string) => {
        let normalizedShortcut = shortcutValue.trim();
        if (normalizedShortcut && !normalizedShortcut.startsWith('/')) {
          normalizedShortcut = `/${normalizedShortcut}`;
        }

        if (!normalizedShortcut) {
          setIsSaving(true);
          dispatch(setCommandStatus({ status: 'loading', message: 'Clearing shortcut...' }));
          try {
            if (item.kind === 'command') {
              const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === item.commandId);
              if (isLocalCommand) {
                await saveCustomization({ command_id: item.commandId, prefix: '' });
              } else {
                await updateCommandAndRefresh(item.commandId, { prefix: '' });
              }
            } else {
              const compoundId = getItemCompoundIdInternal(item);
              const snippetId = extractSnippetIdFromCompoundId(compoundId);
              await updateSnippetShortcut(snippetId, '');

              const snippetItem = item as SnippetInteractiveItem;
              const type = (snippetItem.suggestion.snippet.category || '').toLowerCase() === 'link' ? 'link' : 'note';
              await updateLocalShortcut(
                compoundId,
                snippetId,
                '',
                snippetItem.title,
                type,
                type === 'link' ? 'link' : undefined,
              );
            }
            dispatch(setCommandStatus({ status: 'success', message: 'Shortcut cleared' }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
          } catch (e: any) {
            dispatch(setCommandStatus({ status: 'error', message: 'Failed to clear shortcut' }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
          } finally {
            setIsSaving(false);
            setEditingShortcutFor(null);
            setEditValue('');
            setSaveError(null);
          }
          return;
        }

        // Check for duplicates
        const allShortcuts = await readAllShortcuts();
        const compoundId = getItemCompoundIdInternal(item);
        const currentSnippetId = extractSnippetIdFromCompoundId(compoundId || '');
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
          setSaveError(msg);
          return;
        }

        dispatch(setCommandStatus({ status: 'loading', message: 'Saving shortcut...' }));
        setIsSaving(true);

        try {
          if (item.kind === 'command') {
            const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === item.commandId);
            if (isLocalCommand) {
              await saveCustomization({ command_id: item.commandId, prefix: normalizedShortcut });
            } else {
              await updateCommandAndRefresh(item.commandId, { prefix: normalizedShortcut });
            }
          } else {
            const snippetId = extractSnippetIdFromCompoundId(compoundId);
            await updateSnippetShortcut(snippetId, normalizedShortcut);

            const snippetItem = item as SnippetInteractiveItem;
            const cat = (snippetItem.suggestion.snippet.category || '').toLowerCase();
            const type = ['link', 'links', 'quicklink', 'biolink', 'biolinks', 'tabgroup', 'tab group'].includes(cat)
              ? 'link'
              : 'note';
            await updateLocalShortcut(
              compoundId,
              snippetId,
              normalizedShortcut,
              snippetItem.title,
              type as any,
              cat === 'link' || cat === 'tabgroup' ? 'link' : undefined,
            );
          }

          dispatch(setCommandStatus({ status: 'success', message: 'Shortcut saved successfully' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          // Force global refresh for commands
          if (item.kind === 'command') {
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
      [dispatch, getItemCompoundIdInternal, findConflictingItemName],
    );

    const saveHotkey = useCallback(
      async (item: InteractiveItem, hotkeyValue: string) => {
        const compoundId = getItemCompoundIdInternal(item);
        const itemId = item.kind === 'command' ? item.id : compoundId;

        if (hotkeyValue) {
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
            setEditingHotkeyFor(null);
            setEditValue('');
            return;
          }
        }

        dispatch(
          setCommandStatus({ status: 'loading', message: !hotkeyValue ? 'Clearing hotkey...' : 'Saving hotkey...' }),
        );

        try {
          if (item.kind === 'command') {
            // Check if it's a local command
            const isLocalCommand = LOCAL_COMMANDS.some(c => c.id === item.commandId);

            if (isLocalCommand) {
              // For local commands, use saveCustomization
              await saveCustomization({ command_id: item.commandId, hotkey: hotkeyValue });
              await updateLocalHotkey(item.commandId, hotkeyValue, 'command');
            } else {
              // For remote commands, try cloud sync first
              const result = await updateHotkeyAndRefresh(item.commandId, hotkeyValue);
              // If result is empty, it means no installation ID (e.g. browser command), so fallback to local
              if (!result || result.length === 0) {
                await updateLocalHotkey(item.commandId, hotkeyValue, 'command');
              }
            }
          } else {
            const snippetItem = item as SnippetInteractiveItem;
            const snippetId = extractSnippetIdFromCompoundId(compoundId);
            await updateSnippetHotkey(snippetId, hotkeyValue);

            const cat = (snippetItem.suggestion.snippet.category || '').toLowerCase();
            const type = ['link', 'links', 'quicklink', 'biolink', 'biolinks', 'tabgroup', 'tab group'].includes(cat)
              ? 'link'
              : 'note';
            await updateLocalHotkey(compoundId, hotkeyValue, type as any);
          }

          // Refresh map
          const allHotkeys = await readAllHotkeys();
          setHotkeysMap(allHotkeys);

          dispatch(setCommandStatus({ status: 'success', message: !hotkeyValue ? 'Hotkey cleared' : 'Hotkey saved' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          // Force global refresh for commands
          if (item.kind === 'command') {
            dispatch(fetchAllDataThunk() as any);
          }
        } catch (error: any) {
          console.error('Failed to save/clear hotkey:', error);
          dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to update hotkey' }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
        }
      },
      [dispatch, getItemCompoundIdInternal],
    );
    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
    const [menuFocusIndex, setMenuFocusIndex] = useState(-1);
    const [isKeyboardActive, setIsKeyboardActive] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; align: 'top' | 'bottom' } | null>(
      null,
    );

    useEffect(() => {
      if (openMenuFor && anchorRefs.current[openMenuFor]) {
        const node = anchorRefs.current[openMenuFor];
        const rect = node.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldOpenUp = spaceBelow < 250;

        setMenuPosition({
          top: shouldOpenUp ? rect.top : rect.bottom,
          left: rect.right - 192, // w-48 is 12rem = 192px
          align: shouldOpenUp ? 'bottom' : 'top',
        });
      } else {
        setMenuPosition(null);
      }
    }, [openMenuFor]);

    // AI services available for selection
    const AI_SERVICES = useMemo(
      () => [
        { id: 'gpt', label: 'ChatGPT' },
        { id: 'claude', label: 'Claude' },
        { id: 'perplexity', label: 'Perplexity' },
      ],
      [],
    );

    const focusedItem = focusIndex >= 0 ? interactiveItems[focusIndex] : null;

    const activateKeyboard = useCallback(() => {
      setIsKeyboardActive(true);
    }, []);

    const deactivateKeyboard = useCallback(() => {
      setIsKeyboardActive(false);
      onCommandPreview?.(null);
    }, [onCommandPreview]);

    useImperativeHandle(
      ref,
      () => ({
        focusFirstItem: (moveToNext: boolean = false) => {
          setOpenMenuFor(null);
          // Only activate keyboard mode - let ArrowDown handler set the focusIndex
          // This ensures the first ArrowDown selects the first item (index 0)
          activateKeyboard();
          // If focusIndex is not set (-1), the ArrowDown handler will set it to 0
          // If we're explicitly moving to next, set to 1, otherwise let ArrowDown handle it
          if (moveToNext && interactiveItems.length > 0) {
            setFocusIndex(Math.min(1, interactiveItems.length - 1));
          }
        },
        deactivateKeyboard,
      }),
      [interactiveItems.length, activateKeyboard, deactivateKeyboard],
    );

    useEffect(() => {
      if (!interactiveItems.length) {
        setFocusIndex(-1);
        setOpenMenuFor(null);
        deactivateKeyboard();
        return;
      }
      setFocusIndex(prev => {
        if (prev < 0) return -1;
        if (prev > interactiveItems.length - 1) return interactiveItems.length - 1;
        return prev;
      });
    }, [interactiveItems, deactivateKeyboard]);

    useEffect(() => {
      if (!onCommandPreview) return;
      if (focusedItem && focusedItem.kind === 'command') {
        onCommandPreview(focusedItem.commandId);
      } else {
        onCommandPreview(null);
      }
    }, [focusedItem, onCommandPreview]);

    useEffect(() => {
      return () => {
        onCommandPreview?.(null);
      };
    }, [onCommandPreview]);

    useEffect(() => {
      if (!openMenuFor) return;
      const handleClickOutside = (event: MouseEvent) => {
        const anchor = anchorRefs.current[openMenuFor];
        const menu = menuRefs.current[openMenuFor];
        const target = event.target as Node;

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

    const moveFocus = useCallback(
      (direction: 1 | -1) => {
        if (!interactiveItems.length) return;
        setFocusIndex(prev => {
          const next = prev + direction;
          // Circular navigation: wrap around at boundaries
          if (next < 0) return interactiveItems.length - 1; // Wrap to last when going up from first
          if (next > interactiveItems.length - 1) return 0; // Wrap to first when going down from last
          return next;
        });
      },
      [interactiveItems.length],
    );

    const closeMenu = useCallback(() => {
      setOpenMenuFor(null);
      setMenuFocusIndex(-1);
    }, []);

    const toggleActionMenu = useCallback(
      (targetIndex?: number, viaKeyboard = false) => {
        if (!interactiveItems.length) return;
        const index = typeof targetIndex === 'number' ? targetIndex : focusIndex;
        const item = interactiveItems[index];
        if (!item) return;
        setFocusIndex(index);
        setOpenMenuFor(prev => {
          const next = prev === item.id ? null : item.id;
          setMenuFocusIndex(next ? (viaKeyboard ? 0 : -1) : -1);
          return next;
        });
      },
      [focusIndex, interactiveItems],
    );

    const hasQueryPlaceholder = useCallback((url: string) => {
      return /\{query\}|\[query\]/i.test(url || '');
    }, []);

    const activateItem = useCallback(
      (item: InteractiveItem) => {
        setOpenMenuFor(null);
        if (item.kind === 'command') {
          onQuickCommandSelect?.(item.commandId);
          return;
        }
        if (item.kind === 'folder') {
          onSnippetSelect(item.suggestion);
          return;
        }
        if (item.kind === 'link') {
          const snippetItem = item as SnippetInteractiveItem;
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
                  openMultipleLinks(replaced);
                }
              }
            } else {
              openMultipleLinks(urls);
            }
          } else {
            onSnippetSelect(item.suggestion);
          }
          return;
        }
        onSnippetSelect(item.suggestion);
      },
      [onQuickCommandSelect, onSnippetSelect, onRequestOpenUrls, hasQueryPlaceholder],
    );

    const buildMenuActions = useCallback(
      (item: InteractiveItem): MenuAction[] => {
        if (item.kind === 'command') {
          const actions: MenuAction[] = [
            {
              key: 'run',
              label: 'Run command',
              icon: <FiPlay size={14} />,
              onSelect: () => activateItem(item),
            },
            {
              key: 'favorite',
              label: 'Favourite (coming soon)',
              icon: <FiStar size={14} />,
              disabled: true,
              closeOnExecute: false,
              onSelect: () => undefined,
            },
            {
              key: 'assign-shortcut',
              label: 'Assign a Text Command',
              icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              closeOnExecute: false,
              onSelect: async () => {
                const allShortcuts = await readAllShortcuts();
                const existingValue = allShortcuts[item.id] || '';
                setEditingShortcutFor(item.id);
                setEditingHotkeyFor(null);
                setEditValue(existingValue.replace(/^\//, ''));
                setIsUpdatingShortcut(!!existingValue);
                setSaveError(null);
              },
            },
            {
              key: 'assign-hotkey',
              label: 'Assign a Keyboard Shortcut',
              icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
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
            },
          ];

          if (hotkeysMap[item.id]) {
            actions.push({
              key: 'clear-hotkey',
              label: 'Clear hotkey',
              icon: <FiZapOff size={14} />,
              className: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
              onSelect: () => saveHotkey(item, ''),
              shortcut: (
                <span className="font-mono text-[10px] opacity-75 border border-orange-200 dark:border-orange-900/40 rounded px-1 min-w-0 truncate max-w-[80px] text-right">
                  {hotkeysMap[item.id]}
                </span>
              ),
            });
          }

          return actions;
        }

        if (item.kind === 'folder') {
          return [
            {
              key: 'open',
              label: 'Open Folder',
              icon: <FiPlay size={14} />,
              onSelect: () => activateItem(item),
            },
            // Delete not supported for folders here yet
          ];
        }

        const snippetItem = item as SnippetInteractiveItem;
        const isLink = snippetItem.kind === 'link';
        const snippet = snippetItem.suggestion?.snippet;
        const category = (snippet?.category || '').toLowerCase();
        const isPrompt = category === 'prompt';
        const isNote = category === 'snippet' || category === 'note'; // Be specific about note category
        const isTabGroup = category === 'tabgroup' || category === 'tab group';

        const actions: MenuAction[] = [
          {
            key: 'open',
            // Update label to be more descriptive for Notes
            label: isNote ? 'Open in current tab' : 'Open',
            icon: <FiPlay size={14} />,
            onSelect: () => {
              if (isNote) {
                // For Notes, navigate current tab to full screen view
                // (isNote excludes Prompts here as defined above)
                if (snippet) {
                  const snippetId = snippet.snippet_id || snippet.id;
                  if (snippetId) {
                    const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${snippetId}`);
                    window.location.href = url;
                  }
                }
              } else {
                activateItem(item);
              }
            },
          },
          // Only show "Open in full screen" for notes, not for links or prompts
          ...(isNote
            ? [
                {
                  key: 'open-new-tab',
                  label: `Open in full screen ${isMac ? '(⌘+Enter)' : '(Ctrl+Enter)'}`,
                  icon: <FiExternalLink size={14} />,
                  onSelect: () => {
                    if (snippet) {
                      const snippetId = snippet.snippet_id || snippet.id;
                      if (snippetId) {
                        // Use openNoteInNewTab function which uses background script + query params (not blocked)
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
              if (isLink || isTabGroup) {
                if (onRequestEditLink) {
                  onRequestEditLink(snippetItem.suggestion);
                }
              } else {
                activateItem(item);
              }
            },
            closeOnExecute: !isLink && !isTabGroup,
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <FiTrash2 size={14} />,
            className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
            onSelect: () => {
              const detail = buildSnippetDeleteDetail(snippetItem.suggestion, snippetItem.kind);
              if (detail) {
                onRequestSnippetDelete(detail);
              }
            },
          },
        ];

        const compoundId = getItemCompoundIdInternal(item);

        actions.push({
          key: 'assign-shortcut',
          label: 'Assign a Text Command',
          icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
          className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
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
          label: 'Assign a Keyboard Shortcut',
          icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
          className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
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

        if (hotkeysMap[compoundId]) {
          actions.push({
            key: 'clear-hotkey',
            label: 'Clear hotkey',
            icon: <FiZapOff size={14} />,
            className: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
            onSelect: () => saveHotkey(item, ''),
            shortcut: (
              <span className="font-mono text-[10px] opacity-75 border border-orange-200 dark:border-orange-900/40 rounded px-1 min-w-0 truncate max-w-[80px] text-right">
                {hotkeysMap[compoundId]}
              </span>
            ),
          });
        }

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

        return actions;
      },
      [
        activateItem,
        onRequestSnippetDelete,
        onToggleFavorite,
        onRequestEditLink,
        isMac,
        saveHotkey,
        getItemCompoundIdInternal,
        hotkeysMap,
      ],
    );

    const getCurrentMenuActions = useCallback((): MenuAction[] => {
      if (!openMenuFor) return [];
      const index = interactiveIndexMap.get(openMenuFor);
      if (index === undefined) return [];
      const item = interactiveItems[index];
      if (!item) return [];
      return buildMenuActions(item);
    }, [openMenuFor, interactiveIndexMap, interactiveItems, buildMenuActions]);

    const executeMenuAction = useCallback(
      (action: MenuAction) => {
        if (action.disabled) return;
        action.onSelect();
        if (action.closeOnExecute !== false) {
          closeMenu();
        }
      },
      [closeMenu],
    );

    const processKeyEvent = useCallback(
      (event: KeyboardEvent) => {
        if ((window as any).isGlobalCreateMenuOpen) return;

        const container = containerRef.current;
        if (!container) return;

        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName ?? '';
        const isInputLike = tagName === 'INPUT' || tagName === 'TEXTAREA' || Boolean(target?.isContentEditable);
        const isInsideContainer = target ? container.contains(target) : false;

        // Allow keyboard navigation from input when keyboard mode is active or should be active
        // This allows navigating items while keeping the search input focused
        if (!isInsideContainer) {
          // Only handle navigation keys (ArrowUp, ArrowDown, Enter, Escape) or modifier keys from input
          const isNavigationKey = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key);
          const isAltE = isMac
            ? event.metaKey && event.key.toLowerCase() === 'e'
            : event.altKey && event.key.toLowerCase() === 'e';
          const isCtrlK = (isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';
          const isAltShiftE = isMac
            ? event.metaKey && event.shiftKey && event.key.toLowerCase() === 'e'
            : event.altKey && event.shiftKey && event.key.toLowerCase() === 'e';
          const isCtrlEnter = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';
          // Define isControlKey explicitly
          const isControlKey = event.key === 'Control' || event.key === 'Meta';

          // Allow Control key and shortcuts to pass through even if input is focused
          if (isInputLike && !isNavigationKey && !isAltE && !isCtrlK && !isControlKey && !isAltShiftE && !isCtrlEnter) {
            return;
          }
          // If keyboard is not active but we have items and it's a navigation key or Alt+E/Ctrl+K or Control from input,
          // activate keyboard mode and handle the navigation
          if (
            !isKeyboardActive &&
            interactiveItems.length > 0 &&
            (isNavigationKey || isAltE || isCtrlK || isControlKey || isAltShiftE || isCtrlEnter)
          ) {
            activateKeyboard();
            // Continue to handle the key below
          } else if (!isKeyboardActive && !isAltE && !isCtrlK && !isControlKey && !isAltShiftE && !isCtrlEnter) {
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

            // Handle Ctrl+Enter (Open in full screen) explicitly
            if (openMenuFor && (event.ctrlKey || event.metaKey)) {
              const actions = getCurrentMenuActions();
              const newTabAction = actions.find(a => a.key === 'open-new-tab');
              if (newTabAction) {
                executeMenuAction(newTabAction);
                return;
              }
            }

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

        // Global Backspace handling for navigation (clearing pills)
        if (event.key === 'Backspace' && !isInputLike && onNavigateBack) {
          event.preventDefault();
          onNavigateBack();
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

        // Handle navigation keys
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          // If focusIndex is -1 (not set), set it to 0 (first item)
          // Otherwise, move to next item
          if (focusIndex < 0) {
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
            }
          } else {
            moveFocus(-1);
          }
          return;
        }

        // Ctrl+Enter (Windows) or Command+Enter (Mac) opens note in full-page new tab (Global Shortcut)
        const isActionModifier = isMac ? event.metaKey : event.ctrlKey;
        if (isActionModifier && key === 'Enter') {
          const item = focusedItem;
          if (item && item.kind === 'note') {
            event.preventDefault();
            const snippetItem = item as SnippetInteractiveItem;
            // Use existing utility or safe check
            const snippetId = snippetItem.suggestion?.snippet?.id || snippetItem.suggestion?.snippet?.snippet_id;
            if (snippetId) {
              openNoteInNewTab(snippetId);
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

        const lowerKey = key.toLowerCase();

        // Alt+Shift+E (Windows) or Command+Shift+E (Mac) opens item for editing (Global Shortcut)
        const isAltShiftE = isMac
          ? event.metaKey && event.shiftKey && lowerKey === 'e'
          : event.altKey && event.shiftKey && lowerKey === 'e';

        if (isAltShiftE) {
          const item = focusedItem;
          if (item && (item.kind === 'note' || item.kind === 'link')) {
            event.preventDefault();
            setOpenMenuFor(null);
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
              // For notes, treating "Edit" as selecting the item which usually opens it in editor
              onSnippetSelect(snippetItem.suggestion);
            }
          }
          return;
        }

        // 2. Ctrl+K / Cmd+K
        if ((event.ctrlKey || event.metaKey) && lowerKey === 'k') {
          event.preventDefault();
          toggleActionMenu(undefined, true);
          return;
        }

        const isAltE = isMac ? event.metaKey && lowerKey === 'e' : event.altKey && lowerKey === 'e';
        if (isAltE) {
          event.preventDefault();
          // Ensure keyboard mode is active
          if (!isKeyboardActive) {
            activateKeyboard();
          }
          // If no item is focused, default to first item (0)
          const targetIdx = focusIndex < 0 ? 0 : focusIndex;
          toggleActionMenu(targetIdx, true);
          return;
        }

        // Handle Control (Windows) or Command (Mac) key to toggle action menu
        // Matches AltS "Control" behavior but adapted for OS specific modifier
        if (event.key === 'Control' || event.key === 'Meta') {
          event.preventDefault();
          if (!isKeyboardActive) activateKeyboard();

          if (focusIndex < 0 && interactiveItems.length > 0) {
            setFocusIndex(0);
            toggleActionMenu(0, true);
          } else if (focusIndex >= 0) {
            toggleActionMenu(undefined, true);
          }
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
        deactivateKeyboard,
        getCurrentMenuActions,
        closeMenu,
        executeMenuAction,
        menuFocusIndex,
        onSnippetSelect,
        onRequestEditLink,
        isMac,
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
        // HARD FIX: If favorites context menu is open, ignore ALL navigation/keys here
        if ((window as any).isFavoritesMenuOpen) return;
        if (isLinkEditModalOpen) return;

        processKeyEvent(event);
      };
      // Use capture phase so we see arrows even if host page stops bubbling (e.g. Linear)
      const listenerOptions = { capture: true } as const;
      window.addEventListener('keydown', handleWindowKeyDown, listenerOptions);
      return () => window.removeEventListener('keydown', handleWindowKeyDown, listenerOptions);
    }, [processKeyEvent]);

    // Track previous focus index to prevent auto-scrolling on every render
    const prevFocusIndexRef = useRef(focusIndex);

    useEffect(() => {
      // If the focus index hasn't changed, don't auto-scroll
      // This allows the user to manually scroll without fighting the auto-scroll
      if (prevFocusIndexRef.current === focusIndex) {
        return;
      }
      prevFocusIndexRef.current = focusIndex;

      if (focusIndex < 0) return;
      const container = scrollAreaRef.current;
      if (!container) return;
      const item = interactiveItems[focusIndex];
      // Check if we can find the node (it might not be rendered yet if virtualized, though we aren't using virtualization here)
      // but if items changed, the ref might be stale or missing until next render?
      // Actually, refs should be up to date after render.
      if (!item) return;

      const node = anchorRefs.current[item.id];
      if (!node) return;
      if (!container.contains(node)) return;

      node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }, [focusIndex, interactiveItems]);

    const renderActionMenu = (item: InteractiveItem) => {
      const actions = buildMenuActions(item);
      const commandItem = item.kind === 'command' ? (item as CommandInteractiveItem) : null;
      const isAllAICommand = commandItem?.commandId === 'ai';

      return (
        <>
          {actions.map((action, index) => {
            if (action.divider) {
              return <div key={action.key} className="border-b border-neutral-200/50 dark:border-white/10 mx-2 my-1" />;
            }
            const isActive = index === menuFocusIndex;
            const baseClasses =
              'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs focus:outline-none';
            const stateClasses = action.disabled
              ? 'cursor-not-allowed text-neutral-300 dark:text-neutral-600 dark:opacity-50'
              : isActive
                ? action.className
                  ? `${action.className
                      .split(' ')
                      .filter(c => !c.includes('text-'))
                      .map(c => c.replace(/hover:/g, ''))
                      .join(' ')} ${action.className} dark:border dark:border-neutral-600/50`
                  : 'bg-neutral-50 text-neutral-800 dark:bg-neutral-700/50 dark:text-neutral-100 dark:border dark:border-neutral-600/50'
                : action.className ||
                  'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700/50';

            return (
              <button
                key={action.key}
                type="button"
                disabled={action.disabled}
                onClick={() => executeMenuAction(action)}
                onMouseEnter={() => setMenuFocusIndex(index)}
                className={`${baseClasses} ${stateClasses}`}>
                <div className="flex items-center gap-2">
                  {action.icon}
                  {action.label}
                </div>
                {action.shortcut &&
                  (typeof action.shortcut === 'string' ? (
                    <span className="text-[10px] text-neutral-400 font-medium ml-2">{action.shortcut}</span>
                  ) : (
                    action.shortcut
                  ))}
              </button>
            );
          })}

          {/* Inline Shortcut Editor */}
          {editingShortcutFor === getItemCompoundIdInternal(item) && (
            <div className="border-t border-neutral-200 dark:border-neutral-700/50 mt-1 pt-2 px-2 pb-2">
              <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 px-1">
                Assign a Text Command (e.g., /new)
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-2 focus-within:border-blue-500">
                  <span className="text-neutral-400 text-xs font-medium mr-0.5">/</span>
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        saveShortcut(item, editValue);
                      } else if (e.key === 'Escape') {
                        setEditingShortcutFor(null);
                        setEditValue('');
                      }
                    }}
                    autoFocus
                    placeholder="shortcut"
                    disabled={isSaving}
                    className="flex-1 min-w-0 bg-transparent py-1.5 px-1 text-xs text-neutral-800 dark:text-neutral-200 outline-none disabled:opacity-50"
                  />
                </div>
                {isSaving ? (
                  <div className="flex items-center gap-1.5 px-1">
                    <FiLoader size={12} className="animate-spin text-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-500 whitespace-nowrap">
                      {isUpdatingShortcut ? 'Updating...' : 'Saving...'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingShortcutFor(null);
                        setEditValue('');
                      }}
                      className="rounded-xl border border-transparent bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400"
                      title="Cancel">
                      Cancel
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        saveShortcut(item, editValue);
                      }}
                      className="rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff] px-2 py-0.5 text-[10px] font-semibold shadow-sm"
                      title="Save">
                      Save
                    </button>
                  </div>
                )}
              </div>
              {saveError && <div className="text-[10px] text-red-500 mt-1 px-1">{saveError}</div>}
              {onNavigateToListView && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    let section = 'local';
                    if (item.kind === 'link') section = 'links';
                    else if (item.kind === 'note') {
                      const snippet = (item as SnippetInteractiveItem).suggestion?.snippet;
                      const category = (snippet?.category || '').toLowerCase();
                      section = category === 'link' || category === 'links' ? 'links' : 'notes';
                    }
                    onNavigateToListView('commands', section);
                    setOpenMenuFor(null);
                    setEditingShortcutFor(null);
                  }}
                  className="mt-2 w-full text-center py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-dashed border-red-200 dark:border-red-800/50">
                  Already Assigned Shortcuts
                </button>
              )}
            </div>
          )}

          {/* Inline Hotkey Editor */}
          {editingHotkeyFor === getItemCompoundIdInternal(item) && (
            <div className="border-t border-neutral-200 dark:border-neutral-700/50 mt-1 pt-2 px-2 pb-2">
              <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 px-1">
                Assign a Keyboard Shortcut (Alt + key combination)
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center w-full bg-neutral-50 dark:bg-neutral-900 border border-purple-400 rounded px-2 focus-within:ring-1 focus-within:ring-purple-400">
                  <input
                    type="text"
                    value={editValue}
                    onKeyDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.key === 'Escape') {
                        setEditingHotkeyFor(null);
                        setEditValue('');
                        return;
                      }
                      if (e.key === 'Enter' && editValue) {
                        saveHotkey(item, editValue);
                        return;
                      }
                      const captured = captureHotkey(e as any);
                      if (captured && captured !== 'CANCEL') {
                        setEditValue(captured);
                      }
                    }}
                    autoFocus
                    placeholder="Press keys..."
                    disabled={isSaving}
                    className="flex-1 min-w-0 bg-transparent py-1.5 text-xs font-mono text-neutral-800 dark:text-neutral-200 outline-none disabled:opacity-50"
                  />
                </div>
                {isSaving ? (
                  <div className="flex items-center gap-1.5 px-1">
                    <FiLoader size={12} className="animate-spin text-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-500 whitespace-nowrap">
                      {isUpdatingHotkey ? 'Updating...' : 'Saving...'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingHotkeyFor(null);
                        setEditValue('');
                      }}
                      className="rounded-xl border border-transparent bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400"
                      title="Cancel">
                      Cancel
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        saveHotkey(item, editValue);
                      }}
                      className="rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff] px-2 py-0.5 text-[10px] font-semibold shadow-sm"
                      disabled={!editValue}
                      title="Save">
                      Save
                    </button>
                  </div>
                )}
              </div>
              {onNavigateToListView && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    let section = 'local';
                    if (item.kind === 'link') section = 'links';
                    else if (item.kind === 'note') {
                      const snippet = (item as SnippetInteractiveItem).suggestion?.snippet;
                      const category = (snippet?.category || '').toLowerCase();
                      section = category === 'link' || category === 'links' ? 'links' : 'notes';
                    }
                    onNavigateToListView('commands', section);
                    setOpenMenuFor(null);
                    setEditingHotkeyFor(null);
                  }}
                  className="mt-2 w-full text-center py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-dashed border-red-200 dark:border-red-800/50">
                  Already Assigned Hotkeys
                </button>
              )}
            </div>
          )}

          {/* AI Selection Inline (only for All AI command) */}
          {isAllAICommand && (
            <div className="border-t border-neutral-200 mt-1 pt-1">
              <div className="text-[10px] font-medium text-neutral-500 px-3 pb-1">Select AI Services</div>
              <div className="max-h-[120px] overflow-y-auto px-1 default-visible-scrollbar">
                {AI_SERVICES.map(ai => (
                  <label
                    key={ai.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-50 cursor-pointer text-xs text-neutral-700"
                    onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedAIs.includes(ai.id)}
                      onChange={() => onToggleAI?.(ai.id)}
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{ai.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      );
    };

    // Flatten all items with section info for rendering
    const allItemsWithSection = useMemo(() => {
      const result: Array<{
        item: InteractiveItem;
        sectionKey: string;
        sectionTitle: string;
        isFirstInSection: boolean;
      }> = [];
      filteredSections.forEach(section => {
        section.items.forEach((item, itemIndex) => {
          result.push({
            item,
            sectionKey: section.key,
            sectionTitle: section.title,
            isFirstInSection: itemIndex === 0,
          });
        });
      });
      return result;
    }, [filteredSections]);

    const hasAnyItems = allItemsWithSection.length > 0;

    const handleMouseDown = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button === 0) {
          event.preventDefault();
        }
        activateKeyboard();
      },
      [activateKeyboard],
    );

    return (
      <div
        ref={containerRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        className={`relative flex h-full flex-col overflow-hidden outline-none border
          ${isDarkMode ? 'bg-frostedwhite dark:bg-frostedglass' : 'shadow-[0_8px_30px_rgb(0,0,0,0.12)]'}`}
        style={{
          borderRadius: '0px',
          background: isDarkMode ? '' : '#eee8d5',
          ...(isDarkMode ? {} : { borderColor: 'rgba(0, 0, 0, 0.1)' }),
        }}
        aria-label="Search content">
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto default-visible-scrollbar">
          {hasAnyItems ? (
            <div className="overflow-hidden">
              {allItemsWithSection.map(({ item, sectionKey, sectionTitle, isFirstInSection }, flatIndex) => {
                const index = interactiveIndexMap.get(item.id) ?? -1;
                const isActive = index === focusIndex;
                const isMenuOpen = openMenuFor === item.id;
                const title = item.kind === 'command' ? item.label : item.title;

                let description = '';
                if (item.kind === 'command') {
                  description = item.description;
                } else if (item.kind !== 'folder') {
                  description = (item as SnippetInteractiveItem).preview || '';
                }

                const tagMeta = getItemTagMeta(item);
                const isLast = flatIndex === allItemsWithSection.length - 1;
                const prevSectionKey = flatIndex > 0 ? allItemsWithSection[flatIndex - 1].sectionKey : null;
                const shouldOpenUp = allItemsWithSection.length > 3 && flatIndex >= allItemsWithSection.length - 3;

                const primaryTextColor = !isDarkMode ? 'text-[#073642]' : 'text-[#FFFFFF]';
                const secondaryTextColor = !isDarkMode ? 'text-[#586e75]' : 'text-neutral-500';

                const glassStyle: React.CSSProperties = !isDarkMode
                  ? {
                      background: isActive ? '#fdf6e3' : '#eee8d5',
                      border: isActive ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '0px',
                      boxShadow: isActive
                        ? 'inset 0 1px 2px rgba(255, 255, 255, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.05)'
                        : 'none',
                      backdropFilter: 'blur(4px)',
                    }
                  : {};

                return (
                  <React.Fragment key={item.id}>
                    {showSectionHeader && (
                      <div className={`px-3 pt-3 pb-2 ${flatIndex > 0 ? 'border-t border-neutral-300' : ''}`}>
                        <div className="flex items-center justify-between text-[7px] tracking-wide text-neutral-500">
                          <span style={{ textTransform: 'none' }}>{sectionTitle}</span>
                        </div>
                      </div>
                    )}
                    <div
                      style={glassStyle}
                      className={`group relative cursor-pointer px-3 py-2 border ${
                        isActive
                          ? isDarkMode
                            ? 'bg-neutral-100 dark:bg-white/10 shadow-sm border-black/5 dark:border-white/5'
                            : ''
                          : isDarkMode
                            ? 'hover:bg-neutral-50 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400'
                            : 'hover:bg-[#fdf6e3]'
                      }`}
                      aria-selected={isActive}
                      role="button"
                      onClick={event => {
                        const target = event.target as HTMLElement;
                        if (target.closest('[data-menu-button]') || target.closest('[data-action-menu]') || index < 0) {
                          return;
                        }

                        // Ctrl+Click or Meta+Click on notes opens in full-page new tab
                        if ((event.ctrlKey || event.metaKey) && item.kind === 'note') {
                          event.preventDefault();
                          const snippetItem = item as SnippetInteractiveItem;
                          const snippetId =
                            snippetItem.suggestion?.snippet?.id || snippetItem.suggestion?.snippet?.snippet_id;
                          if (snippetId) {
                            openNoteInNewTab(snippetId);
                          }
                          return;
                        }

                        // Immediately activate item on click (unless it was a ctrl click handled above)
                        setFocusIndex(index);
                        // Single click only selects. Double click activates.
                        // activateItem(item);
                      }}
                      onDoubleClick={event => {
                        const target = event.target as HTMLElement;
                        if (target.closest('[data-menu-button]') || target.closest('[data-action-menu]') || index < 0) {
                          return;
                        }
                        setFocusIndex(index);
                        activateItem(item);
                      }}
                      onContextMenu={event => {
                        event.preventDefault();
                        if (index < 0) return;
                        setFocusIndex(index);
                        toggleActionMenu(index, false);
                      }}>
                      <div className="flex items-center gap-2 h-8 overflow-hidden relative">
                        <div
                          className={`flex items-center justify-center text-[var(--color-iconDefault)] flex-shrink-0 ${
                            item.kind === 'command' && item.iconStack
                              ? 'w-12'
                              : item.kind !== 'command' && (item as any).icon === 'tabgroup'
                                ? 'min-w-[48px]'
                                : 'w-12 h-12'
                          }`}>
                          {item.kind === 'command' ? <CommandIcon item={item} /> : renderSnippetIcon(item)}
                        </div>

                        {/* Content area with fixed height */}
                        <div className="flex-1 min-w-0 h-full relative">
                          {/* Non-hover state: Icon and title on same line */}
                          <div
                            className={`absolute inset-0 flex items-center gap-2 transition-all duration-200 ${
                              isActive
                                ? 'opacity-0 translate-y-[-4px]'
                                : 'opacity-100 translate-y-0 group-hover:opacity-0 group-hover:translate-y-[-4px]'
                            }`}>
                            <span
                              className={
                                item.kind === 'command'
                                  ? `font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] truncate ${
                                      primaryTextColor
                                    }`
                                  : `${primaryTextColor} text-sm font-medium truncate`
                              }
                              style={item.kind === 'command' ? {} : headingFontStyle}>
                              {title}
                            </span>
                            <HotkeyBadge hotkey={hotkeysMap[item.id] || ''} />
                            <span
                              className={`text-[10px] tracking-wide flex-shrink-0 whitespace-nowrap ${secondaryTextColor}`}>
                              {tagMeta.label}
                            </span>
                          </div>

                          {/* Hover state: Inline Title -> Tag -> Description */}
                          <div
                            className={`absolute inset-0 flex items-center gap-2 transition-all duration-200 ${
                              isActive
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-[4px] group-hover:opacity-100 group-hover:translate-y-0'
                            }`}>
                            <span
                              className={
                                item.kind === 'command'
                                  ? `font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] truncate flex-shrink-0 max-w-[40%] ${
                                      primaryTextColor
                                    }`
                                  : `text-[12px] font-medium ${primaryTextColor} truncate flex-shrink-0 max-w-[40%]`
                              }
                              style={item.kind === 'command' ? {} : headingFontStyle}>
                              {item.kind === 'command' ? item.label : item.title}
                            </span>
                            <span
                              className={`text-[9px] tracking-wide flex-shrink-0 whitespace-nowrap ${secondaryTextColor}`}>
                              {tagMeta.label}
                            </span>
                            {description && (
                              <span
                                className="truncate flex-shrink min-w-0 flex-1 text-right"
                                style={{ fontSize: '12px', color: !isDarkMode ? '#586e75' : 'text-neutral-500' }}>
                                {description}
                              </span>
                            )}
                          </div>
                        </div>
                        {isMenuOpen ? (
                          <div
                            ref={node => {
                              menuRefs.current[item.id] = node;
                            }}
                            data-action-menu
                            onMouseDown={e => e.stopPropagation()}
                            className={`absolute right-0 z-50 w-48 rounded-xl border border-neutral-200 bg-white p-1 shadow-2xl dark:bg-neutral-800 dark:border-neutral-700 ${
                              shouldOpenUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
                            }`}>
                            {renderActionMenu(item)}
                          </div>
                        ) : null}
                      </div>
                      {(!isLast || flatIndex < allItemsWithSection.length - 1) && (
                        <div className="mx-2 h-[1px] bg-neutral-200/60 dark:bg-white/5" />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400 m-3">
              {filteredSections[0]?.emptyMessage || 'No items yet.'}
            </div>
          )}
        </div>

        <div
          className={`flex items-center justify-between gap-3 px-3 py-1.5 
  border-t border-white/10 dark:border-white/5
  ${!isDarkMode ? 'bg-[#eee8d5]' : 'bg-neutral-900/40'} 
  text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0 relative rounded-none`}>
          {/* Left section */}
          <div className="flex items-center gap-3">
            {/* Navigate */}
            <div className="flex items-center gap-1 rounded-md border border-transparent px-1 py-[1px]">
              <span className="font-semibold text-neutral-500 dark:text-neutral-400">Navigate</span>
              <KeyHint keys={['\u2191', '\u2193']} />
              {/* <span className="text-neutral-400">to navigate</span> */}
            </div>

            {/* Select */}
            <div className="flex items-center gap-1 rounded-md border border-transparent px-1 py-[1px]">
              <span className="font-semibold text-neutral-500 dark:text-neutral-400">Select</span>
              <AiOutlineEnter />
            </div>
          </div>

          {/* Center - Folder info */}
          {folderInfo && (!status || status.status === 'idle') && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 z-10 pointer-events-none">
              <FaFolder className="h-3 w-3 text-[var(--color-iconDefault)] flex-shrink-0" />
              <span className="font-semibold text-neutral-600 dark:text-neutral-300">{folderInfo.name}</span>
              <span>·</span>
              <span>
                {folderInfo.notesCount} notes, {folderInfo.linksCount} links
              </span>
            </div>
          )}

          {/* Status Message (Overlay) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
            {status && status.status !== 'idle' && (
              <div
                className={`flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-medium rounded-full shadow-sm border ${
                  status.status === 'error'
                    ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/50'
                    : status.status === 'success'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50'
                      : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50'
                }`}>
                {status.status === 'loading' ? (
                  <svg
                    className="animate-spin h-2.5 w-2.5"
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
                    className={`w-2 h-2 rounded-full ${
                      status.status === 'error'
                        ? 'bg-red-500'
                        : status.status === 'success'
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                    }`}
                  />
                )}
                {status.message}
              </div>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {focusedItem?.kind === 'command' && isLocalCommandId(focusedItem.commandId) && (
              <span className="whitespace-nowrap">{`Press Enter to ${focusedItem.label}`}</span>
            )}

            {/* Actions button */}
            <button
              type="button"
              onClick={() => toggleActionMenu()}
              disabled={!focusedItem}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-0.5 font-semibold text-[10px] transition
        ${
          focusedItem
            ? 'text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5'
            : 'text-neutral-500 dark:text-neutral-600 opacity-50'
        }`}>
              <span>{actionsButtonLabel}</span>

              {/* Shortcut keys "Ctrl" or "Cmd" */}
              <KeyHint keys={isMac ? ['Cmd'] : ['Ctrl']} />
            </button>
          </div>
        </div>

        {menuPosition &&
          openMenuFor &&
          createPortal(
            <div
              ref={node => {
                if (openMenuFor) menuRefs.current[openMenuFor] = node;
              }}
              data-action-menu
              onMouseDown={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: menuPosition.align === 'top' ? menuPosition.top + 4 : undefined,
                bottom: menuPosition.align === 'bottom' ? window.innerHeight - menuPosition.top + 4 : undefined,
                left: menuPosition.left,
                zIndex: 99999,
              }}
              className="w-48 rounded-xl border border-white/20 bg-white/80 backdrop-blur-md p-1 shadow-2xl dark:bg-black/80 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5">
              {(() => {
                const item = interactiveItems.find(i => i.id === openMenuFor);
                return item ? renderActionMenu(item) : null;
              })()}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

InteractiveItemsList.displayName = 'InteractiveItemsList';

export default InteractiveItemsList;
