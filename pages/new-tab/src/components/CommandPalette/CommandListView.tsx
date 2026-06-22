import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { buildUrl, type CommandDefinition, COMMANDS } from '../SearchComponents/Searchbar/commands';
import { LOCAL_COMMANDS, type LocalCommandId } from '../SearchComponents/Searchbar/localCommands';
import { getLocalCommandKeywords } from '../SearchComponents/Searchbar/commandKeywords';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { useCommands } from '../SearchComponents/Searchbar/useCommands';
import { validateShortcutUniqueness } from '../SearchComponents/Searchbar/shortcutValidation';
import {
  updateCommandAndRefresh,
  BROWSER_COMMANDS,
  updateHotkeyAndRefresh,
} from '../../../../Apis/features/userCommandsApiService';
import { useDispatch, useSelector } from 'react-redux';
import CmdIcon from '../Shared/Icons/CmdIcon';
import {
  setCommandStatus,
  resetCommandStatus,
  setSelectedTeam,
  viewSnippet,
  selectIsMac,
  selectHighlightedCommandId,
  setHighlightedCommandId,
  selectDarkMode,
} from '../../../../Redux/AllData/uiStateSlice';
import { updateSnippetHotkey, updateSnippetShortcut } from '../../../../Apis/features/snippetApi';
import { updateLocalShortcut, updateLocalHotkey } from '../../../../utils/shortcutHotkeyUtils';
import { selectAllData, selectAllDataLoading } from '../../../../Redux/AllData/allDataSlice';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import { useLocalCommandCustomizations } from '../../hooks/useLocalCommandCustomizations';
import {
  readAllHotkeys as readAllHotkeysBase,
  readAllShortcuts,
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { SharedHotkeyCell } from '../Shared/SharedHotkeyCell';
import {
  FaEdit,
  FaCheck,
  FaTimes,
  FaLink,
  FaNetworkWired,
  FaChevronDown,
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
  FaBookmark,
  FaKey,
  FaTag,
  FaQuestionCircle,
  FaFileAlt,
} from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import { FiLoader } from 'react-icons/fi';
import { TerminalIcon } from '../Shared/utils/terminalIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import { LuSparkles } from 'react-icons/lu';

// Map command IDs to specific React Icons (Must match SearchSuggestions.tsx)
const BROWSER_ICONS: Record<string, React.ReactNode> = {
  history: <FaHistory size={14} className="text-[var(--color-iconDefault)]" />,
  downloads: <FaDownload size={14} className="text-[var(--color-iconDefault)]" />,
  settings: <FaCog size={14} className="text-[var(--color-iconDefault)]" />,
  extensions: <FaPuzzlePiece size={14} className="text-[var(--color-iconDefault)]" />,
  bookmarks: <FaBookmark size={14} className="text-[var(--color-iconDefault)]" />,
  flags: <FaFlag size={14} className="text-[var(--color-iconDefault)]" />,
  inspect: <FaCode size={14} className="text-[var(--color-iconDefault)]" />,
  version: <FaTag size={14} className="text-[var(--color-iconDefault)]" />,
  about: <FaInfoCircle size={14} className="text-[var(--color-iconDefault)]" />,
  tasks: <FaMemory size={14} className="text-[var(--color-iconDefault)]" />,
  gpu: <FaMicrochip size={14} className="text-[var(--color-iconDefault)]" />,
  dino: <FaGamepad size={14} className="text-[var(--color-iconDefault)]" />,
  passwords: <FaKey size={14} className="text-[var(--color-iconDefault)]" />,
  help: <FaQuestionCircle size={14} className="text-[var(--color-iconDefault)]" />,
};

type CommandListRow = {
  id: string;
  name: string;
  shortcut: string;
  url: string;
  keywords: string[];
  iconHost?: string | null;
  isEditable: boolean;
  type?: 'command' | 'link' | 'note';
  category?: string;
  icon?: React.ReactNode;
  hotkey: string;
  fullSnippet?: any;
};

type EditField = 'shortcut' | 'keywords' | 'hotkey';
type EditState = {
  [commandId: string]: {
    [field in EditField]?: string;
  };
};

type ConflictState = {
  [commandId: string]: {
    [field in EditField]?: {
      isConflict: boolean;
      conflictId?: string;
      message?: string;
    };
  };
};

// Helper to parse keywords
const parseKeywords = (s: string) =>
  s
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

// Helper to ensure URL is safe/valid
const safeUrl = (url: string) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('chrome://') ||
    url.startsWith('file://') ||
    url.startsWith('about:')
  )
    return url;
  return `https://${url}`;
};

// Helper to format keywords for display
const formatKeywords = (keywords: string[]) => keywords.join(', ');

interface CommandListViewProps {
  searchQuery?: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onClose?: () => void;
}

type NoteCommandMap = {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
  };
};

type LinkCommandMap = {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
    url?: string;
    urls?: string[];
    iconHost?: string | null;
    type?: 'link' | 'tabgroup';
  };
};

const buildLinkRows = (teams: any[], linkCommandsMap: LinkCommandMap, hotkeysMap: Record<string, string>) => {
  const rows: CommandListRow[] = [];
  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      // Workspace-level snippets
      for (const snippet of ws.workspace_snippets || []) {
        const category = (snippet.category || '').toLowerCase();
        if (category !== 'link' && category !== 'tabgroup' && category !== 'quicklink') continue;

        const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
        if (!uniqueSnippetId) continue;

        const commandId = getItemCompoundId({ suggestion: { workspace: ws, snippet } });
        const linkData = linkCommandsMap[commandId] || {};
        let urlLabel = '';
        let iconHost: string | null = null;
        let isGroup = category === 'tabgroup';
        const parsed = safeParseTabs(snippet.value);

        if (category === 'quicklink' && parsed && Array.isArray(parsed.urls) && parsed.urls.length > 1) {
          isGroup = true;
        }

        let urls: string[] = [];
        if (!isGroup) {
          urlLabel = (snippet.value as string) || '';
          if (parsed) {
            if (parsed.url) urlLabel = parsed.url;
            else if (Array.isArray(parsed.urls) && parsed.urls.length > 0) urlLabel = parsed.urls[0];
          }
          try {
            iconHost = new URL(urlLabel).hostname;
          } catch {
            iconHost = null;
          }
        } else {
          urls = (parsed && parsed.urls) || [];
          urlLabel = Array.isArray(urls) ? `${urls.length} URLs` : 'Link Group';
        }

        rows.push({
          id: commandId,
          name: snippet.key,
          shortcut: linkData.shortcut || '',
          url: urlLabel,
          keywords: linkData.keywords || [],
          iconHost,
          isEditable: true,
          type: 'link',
          icon: isGroup ? (
            <StackedLinkIcon urls={urls} maxIcons={3} size={14} />
          ) : (
            <StackedLinkIcon urls={[urlLabel]} maxIcons={1} size={14} fallback="link" />
          ),
          hotkey: hotkeysMap[commandId] || '',
          fullSnippet: { ...snippet, workspace: ws, folder: null },
        });
      }

      // Folder snippets
      for (const folder of ws.folders || []) {
        for (const snippet of folder.snippets || []) {
          const category = (snippet.category || '').toLowerCase();
          if (category !== 'link' && category !== 'tabgroup' && category !== 'quicklink') continue;

          const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
          if (!uniqueSnippetId) continue;

          const commandId = getItemCompoundId({ suggestion: { folder, snippet } });
          const linkData = linkCommandsMap[commandId] || {};
          let urlLabel = '';
          let iconHost: string | null = null;
          let isGroup = category === 'tabgroup';
          const parsed = safeParseTabs(snippet.value);

          if (category === 'quicklink' && parsed && Array.isArray(parsed.urls) && parsed.urls.length > 1) {
            isGroup = true;
          }

          let urls: string[] = [];
          if (!isGroup) {
            urlLabel = (snippet.value as string) || '';
            if (parsed) {
              if (parsed.url) urlLabel = parsed.url;
              else if (Array.isArray(parsed.urls) && parsed.urls.length > 0) urlLabel = parsed.urls[0];
            }
            try {
              iconHost = new URL(urlLabel).hostname;
            } catch {
              iconHost = null;
            }
          } else {
            urls = (parsed && parsed.urls) || [];
            urlLabel = Array.isArray(urls) ? `${urls.length} URLs` : 'Link Group';
          }

          rows.push({
            id: commandId,
            name: snippet.key,
            shortcut: linkData.shortcut || '',
            url: urlLabel,
            keywords: linkData.keywords || [],
            iconHost,
            isEditable: true,
            type: 'link',
            icon: isGroup ? (
              <StackedLinkIcon urls={urls} maxIcons={3} size={14} />
            ) : (
              <StackedLinkIcon urls={[urlLabel]} maxIcons={1} size={14} fallback="link" />
            ),
            hotkey: hotkeysMap[commandId] || '',
            fullSnippet: { ...snippet, workspace: ws, folder: folder },
          });
        }
      }
    }
  }
  return rows;
};

const buildNoteRows = (teams: any[], noteCommandsMap: NoteCommandMap, hotkeysMap: Record<string, string>) => {
  const rows: CommandListRow[] = [];
  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      for (const snippet of ws.workspace_snippets || []) {
        const category = (snippet.category || '').toLowerCase();
        if (category !== 'note' && category !== 'snippet') continue;
        const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
        if (!uniqueSnippetId) continue;

        const commandId = getItemCompoundId({ suggestion: { workspace: ws, snippet } });
        const noteData = noteCommandsMap[commandId] || {};
        const contentPreview = snippet.value ? snippet.value.replace(/<[^>]*>?/gm, '').substring(0, 50) : '';

        rows.push({
          id: commandId,
          name: snippet.key || 'Untitled Note',
          shortcut: noteData.shortcut || '',
          url: contentPreview || 'No content',
          keywords: noteData.keywords || [],
          iconHost: null,
          isEditable: true,
          type: 'note',
          icon: <NotesIcon size={14} className="text-[var(--color-iconDefault)]" />,
          hotkey: hotkeysMap[commandId] || '',
          fullSnippet: { ...snippet, workspace: ws, folder: null },
        });
      }

      for (const folder of ws.folders || []) {
        for (const snippet of folder.snippets || []) {
          const category = (snippet.category || '').toLowerCase();
          if (category !== 'note' && category !== 'snippet') continue;
          const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
          if (!uniqueSnippetId) continue;

          const commandId = getItemCompoundId({ suggestion: { folder, snippet } });
          const noteData = noteCommandsMap[commandId] || {};
          const contentPreview = snippet.value ? snippet.value.replace(/<[^>]*>?/gm, '').substring(0, 50) : '';

          rows.push({
            id: commandId,
            name: snippet.key || 'Untitled Note',
            shortcut: noteData.shortcut || '',
            url: contentPreview || 'No content',
            keywords: noteData.keywords || [],
            iconHost: null,
            isEditable: true,
            type: 'note',
            icon: <NotesIcon size={14} className="text-[var(--color-iconDefault)]" />,
            hotkey: hotkeysMap[commandId] || '',
            fullSnippet: { ...snippet, workspace: ws, folder: folder },
          });
        }
      }
    }
  }
  return rows;
};

const buildPromptRows = (teams: any[], noteCommandsMap: NoteCommandMap, hotkeysMap: Record<string, string>) => {
  const rows: CommandListRow[] = [];
  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      for (const snippet of ws.workspace_snippets || []) {
        const category = (snippet.category || '').toLowerCase();
        if (category !== 'prompt') continue;
        const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
        if (!uniqueSnippetId) continue;

        const commandId = getItemCompoundId({ suggestion: { workspace: ws, snippet } });
        const noteData = noteCommandsMap[commandId] || {};
        const contentPreview = snippet.value ? snippet.value.replace(/<[^>]*>?/gm, '').substring(0, 50) : '';

        rows.push({
          id: commandId,
          name: snippet.key || 'Untitled Prompt',
          shortcut: noteData.shortcut || '',
          url: contentPreview || 'No content',
          keywords: noteData.keywords || [],
          iconHost: null,
          isEditable: true,
          type: 'note', // Using 'note' type so it uses the same editor logic (content preview)
          icon: <LuSparkles size={14} className="text-[var(--color-iconDefault)]" />,
          hotkey: hotkeysMap[commandId] || '',
          fullSnippet: { ...snippet, workspace: ws, folder: null },
        });
      }

      for (const folder of ws.folders || []) {
        for (const snippet of folder.snippets || []) {
          const category = (snippet.category || '').toLowerCase();
          if (category !== 'prompt') continue;
          const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
          if (!uniqueSnippetId) continue;

          const commandId = getItemCompoundId({ suggestion: { folder, snippet } });
          const noteData = noteCommandsMap[commandId] || {};
          const contentPreview = snippet.value ? snippet.value.replace(/<[^>]*>?/gm, '').substring(0, 50) : '';

          rows.push({
            id: commandId,
            name: snippet.key || 'Untitled Prompt',
            shortcut: noteData.shortcut || '',
            url: contentPreview || 'No content',
            keywords: noteData.keywords || [],
            iconHost: null,
            isEditable: true,
            type: 'note',
            icon: <LuSparkles size={14} className="text-[var(--color-iconDefault)]" />,
            hotkey: hotkeysMap[commandId] || '',
            fullSnippet: { ...snippet, workspace: ws, folder: folder },
          });
        }
      }
    }
  }
  return rows;
};

const readNoteStorage = async (): Promise<NoteCommandMap> => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return {};
  return await new Promise(resolve => {
    chromeAny.storage.local.get('note_commands', (res: { note_commands?: NoteCommandMap }) => {
      resolve(res.note_commands || {});
    });
  });
};

const readLinkStorage = async (): Promise<LinkCommandMap> => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return {};
  return await new Promise(resolve => {
    chromeAny.storage.local.get('link_commands', (res: { link_commands?: LinkCommandMap }) => {
      resolve(res.link_commands || {});
    });
  });
};

const safeParseTabs = (maybe: any) => {
  if (!maybe) return null;
  if (typeof maybe === 'string') {
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }
  return maybe;
};

const CommandListView: React.FC<CommandListViewProps> = ({ searchQuery, activeSection, onSectionChange, onClose }) => {
  const { commands: globalCommandsData } = useCommands();
  const { customizations, saveCustomization } = useLocalCommandCustomizations();
  const allData = useSelector(selectAllData);
  const allDataLoading = useSelector(selectAllDataLoading);
  const isDarkMode = useSelector(selectDarkMode);
  const [editState, setEditState] = useState<EditState>({});
  const [conflictState, setConflictState] = useState<ConflictState>({});
  const [savingState, setSavingState] = useState<Record<string, boolean>>({});
  const [noteCommandsMap, setNoteCommandsMap] = useState<NoteCommandMap>({});
  const [linkCommandsMap, setLinkCommandsMap] = useState<LinkCommandMap>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['active', 'local', 'global', 'browser', 'links', 'notes', 'prompts']),
  );

  /* Redux Hooks */
  const dispatch = useDispatch();
  const highlightedCommandId = useSelector(selectHighlightedCommandId);

  // Load note and link commands
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [notes, links] = await Promise.all([readNoteStorage(), readLinkStorage()]);
      if (!mounted) return;
      setNoteCommandsMap(notes);
      setLinkCommandsMap(links);
    })();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.note_commands) {
          setNoteCommandsMap(changes.note_commands.newValue || {});
        }
        if (changes.link_commands) {
          setLinkCommandsMap(changes.link_commands.newValue || {});
        }
      }
    };

    const chromeAny = (window as any)?.chrome;
    chromeAny?.storage?.onChanged?.addListener(handleStorageChange);
    return () => {
      mounted = false;
      chromeAny?.storage?.onChanged?.removeListener?.(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Focus the container on mount to enable keyboard scrolling immediately
    const timeout = setTimeout(() => {
      containerRef.current?.focus();
    }, 50);
    return () => clearTimeout(timeout);
  }, []);
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});

  // Load hotkeys from storage
  useEffect(() => {
    let mounted = true;
    (async () => {
      const allHotkeys = await readAllHotkeysBase();
      if (!mounted) return;
      setHotkeysMap(allHotkeys);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const globalCommands: CommandListRow[] = useMemo(() => {
    return globalCommandsData.map(cmd => ({
      id: cmd.id,
      name: cmd.label,
      shortcut: cmd.prefix,
      url: safeUrl(
        buildUrl(cmd.urlTemplate, '[query]')
          .replace(/%255Bquery%255D/gi, '[query]')
          .replace(/%5Bquery%5D/gi, '[query]'),
      ),
      keywords: cmd.keywords,
      iconHost: cmd.iconHost ?? null,
      isEditable: true,
      type: 'command',
      category: cmd.category,
      icon: BROWSER_ICONS[cmd.id],
      hotkey: hotkeysMap[cmd.id] || '',
    }));
  }, [globalCommandsData, hotkeysMap]);

  const localCommands: CommandListRow[] = useMemo(() => {
    return LOCAL_COMMANDS.map(cmd => {
      const custom = customizations[cmd.id];
      let icon: React.ReactNode = <TerminalIcon size={14} className="text-[var(--color-iconDefault)]" />;
      if (cmd.id === 'createnotes') {
        icon = <FaFileAlt size={14} className="text-[var(--color-iconDefault)]" />;
      } else if (cmd.id === 'createlinks') {
        icon = <FaLink size={14} className="text-[var(--color-iconDefault)]" />;
      }

      return {
        id: cmd.id,
        name: cmd.label,
        shortcut: custom?.prefix ?? cmd.prefix,
        url: safeUrl(cmd.url ?? 'In-app'),
        keywords: custom?.keywords ?? cmd.keywords ?? [],
        iconHost: null,
        isEditable: true,
        type: 'command',
        icon,
        hotkey: custom?.hotkey ?? hotkeysMap[cmd.id] ?? cmd.hotkey ?? '',
      };
    });
  }, [hotkeysMap, customizations]);

  const filterCommands = useCallback(
    (commands: CommandListRow[]) => {
      if (!searchQuery) return commands;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return commands;

      // If query starts with '/', remove it for better matching if user typed shortcut directly?
      // User types '/yt', we match 'yt' shortcut.
      const effectiveQ = q.startsWith('/') ? q.slice(1) : q;

      return commands.filter(
        cmd =>
          cmd.name.toLowerCase().includes(effectiveQ) ||
          cmd.shortcut.toLowerCase().includes(effectiveQ) ||
          (cmd.keywords && cmd.keywords.some(k => k.toLowerCase().includes(effectiveQ))),
      );
    },
    [searchQuery],
  );

  const filteredGlobalCommands = useMemo(() => {
    let filtered = filterCommands(globalCommands);
    if (!searchQuery) {
      filtered = filtered.filter(cmd => cmd.category === 'ai' || cmd.category === 'search');
    } else {
      filtered = filtered.filter(cmd => cmd.category !== 'ai' && cmd.category !== 'search');
    }
    return filtered;
  }, [globalCommands, filterCommands, searchQuery]);

  const filteredLocalCommands = useMemo(() => {
    if (!searchQuery) return [];
    return filterCommands(localCommands);
  }, [localCommands, filterCommands, searchQuery]);

  const browserCommands = useMemo(
    () => filteredGlobalCommands.filter(cmd => cmd.category === 'browser'),
    [filteredGlobalCommands],
  );

  const generalCommands = useMemo(
    () => filteredGlobalCommands.filter(cmd => cmd.category !== 'browser'),
    [filteredGlobalCommands],
  );

  const linkCommands: CommandListRow[] = useMemo(() => {
    return buildLinkRows(allData || [], linkCommandsMap || {}, hotkeysMap || {});
  }, [allData, linkCommandsMap, hotkeysMap]);

  const noteCommands: CommandListRow[] = useMemo(() => {
    return buildNoteRows(allData || [], noteCommandsMap || {}, hotkeysMap || {});
  }, [allData, noteCommandsMap, hotkeysMap]);

  const promptCommands: CommandListRow[] = useMemo(() => {
    return buildPromptRows(allData || [], noteCommandsMap || {}, hotkeysMap || {});
  }, [allData, noteCommandsMap, hotkeysMap]);

  const filteredLinkCommands = useMemo(() => {
    if (!searchQuery) return [];
    return filterCommands(linkCommands);
  }, [linkCommands, filterCommands, searchQuery]);

  const filteredNoteCommands = useMemo(() => {
    if (!searchQuery) return [];
    return filterCommands(noteCommands);
  }, [noteCommands, filterCommands, searchQuery]);

  const filteredPromptCommands = useMemo(() => {
    if (!searchQuery) return [];
    return filterCommands(promptCommands);
  }, [promptCommands, filterCommands, searchQuery]);

  // Compute Active Hotkeys & Shortcuts Items
  const activeHotkeysItems = useMemo(() => {
    const activeItems: CommandListRow[] = [];

    // Helper: Check if command has active hotkey (user assigned or default)
    const hasActiveHotkey = (cmd: CommandListRow, isLocal: boolean) => {
      // 1. Check hotkeysMap directly for user assignment
      if (hotkeysMap[cmd.id]) return true;

      // 2. Fallback to cmd.hotkey (which might be pre-merged)
      if (cmd.hotkey) return true;

      // 3. Default hotkey from definition (for Local Commands)
      if (isLocal) {
        const def = LOCAL_COMMANDS.find(c => c.id === cmd.id);
        if (def?.hotkey) return true;
      }

      return false;
    };

    // 1. Local Commands
    filteredLocalCommands.forEach(cmd => {
      if (hasActiveHotkey(cmd, true)) {
        activeItems.push(cmd);
      }
    });

    // 2. Global Commands (Browser + General)
    filteredGlobalCommands.forEach(cmd => {
      if (hasActiveHotkey(cmd, false)) {
        activeItems.push(cmd);
      }
    });

    // 3. Links
    filteredLinkCommands.forEach(cmd => {
      if (cmd.hotkey) {
        activeItems.push(cmd);
      }
    });

    // 4. Notes
    filteredNoteCommands.forEach(cmd => {
      if (cmd.hotkey) {
        activeItems.push(cmd);
      }
    });

    // 5. Prompts
    filteredPromptCommands.forEach(cmd => {
      if (cmd.hotkey) {
        activeItems.push(cmd);
      }
    });

    return activeItems;
  }, [
    filteredLocalCommands,
    filteredGlobalCommands,
    filteredLinkCommands,
    filteredNoteCommands,
    filteredPromptCommands,
    globalCommandsData,
    hotkeysMap,
  ]);

  // Combine all visible items for flat navigation based on active section
  const allVisibleItems = useMemo(() => {
    let items: CommandListRow[] = [];
    if (expandedSections.has('active')) items = items.concat(activeHotkeysItems);
    if (expandedSections.has('local')) items = items.concat(filteredLocalCommands);
    if (expandedSections.has('global')) items = items.concat(generalCommands);
    if (expandedSections.has('browser')) items = items.concat(browserCommands);
    if (expandedSections.has('links')) items = items.concat(filteredLinkCommands);
    if (expandedSections.has('notes')) items = items.concat(filteredNoteCommands);
    if (expandedSections.has('prompts')) items = items.concat(filteredPromptCommands);
    return items;
  }, [
    expandedSections,
    activeHotkeysItems,
    filteredLocalCommands,
    generalCommands,
    browserCommands,
    filteredLinkCommands,
    filteredNoteCommands,
    filteredPromptCommands,
  ]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeSection) {
      setExpandedSections(prev => {
        if (!prev.has(activeSection)) {
          return new Set(prev).add(activeSection);
        }
        return prev;
      });

      // Wait for render
      setTimeout(() => {
        const el = document.getElementById(`section-${activeSection}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [activeSection]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Handle highlighted command navigation
  useEffect(() => {
    if (!highlightedCommandId) return;

    // Helper to find and scroll
    const handleHighlight = (section: string) => {
      onSectionChange(section);
      // Wait for section expansion and render
      setTimeout(() => {
        const el = document.getElementById(`cmd-row-${highlightedCommandId}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.classList.add('bg-purple-100', 'dark:bg-purple-900/30');
          setTimeout(() => {
            el.classList.remove('bg-purple-100', 'dark:bg-purple-900/30');
            dispatch(setHighlightedCommandId(null));
          }, 2000);
        }
      }, 300);
    };

    // Check where the command is
    if (localCommands.some(c => c.id === highlightedCommandId)) {
      handleHighlight('local');
      return;
    }
    if (globalCommands.some(c => c.id === highlightedCommandId && c.category === 'browser')) {
      handleHighlight('browser');
      return;
    }
    if (globalCommands.some(c => c.id === highlightedCommandId && c.category !== 'browser')) {
      handleHighlight('global');
      return;
    }
    if (linkCommands.some(c => c.id === highlightedCommandId)) {
      handleHighlight('links');
      return;
    }
    if (noteCommands.some(c => c.id === highlightedCommandId)) {
      handleHighlight('notes');
      return;
    }
    if (promptCommands.some(c => c.id === highlightedCommandId)) {
      handleHighlight('prompts');
      return;
    }

    dispatch(setHighlightedCommandId(null));
  }, [
    highlightedCommandId,
    localCommands,
    globalCommands,
    linkCommands,
    noteCommands,
    promptCommands,
    dispatch,
    onSectionChange,
  ]);

  const shouldScrollToSelection = useRef(false);
  const prevSearchQuery = useRef(searchQuery);
  const prevSelectedId = useRef<string | null>(null);

  // Track the ID of the selected item to preserve it across renders
  useEffect(() => {
    const item = allVisibleItems[selectedIndex];
    if (item) {
      prevSelectedId.current = item.id;
    }
  }, [selectedIndex, allVisibleItems]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Check if user is typing in an input field (don't interfere with editing)
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Handle Escape or Backspace to close command list
      if ((e.key === 'Escape' || e.key === 'Backspace') && !isInputElement) {
        // For Backspace, only close if there's no text selection
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Don't close if user is selecting text
          }
        }

        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (allVisibleItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        shouldScrollToSelection.current = true;
        // Circular navigation: wrap to first when at last item
        setSelectedIndex(prev => (prev >= allVisibleItems.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        shouldScrollToSelection.current = true;
        // Circular navigation: wrap to last when at first item
        setSelectedIndex(prev => (prev <= 0 ? allVisibleItems.length - 1 : prev - 1));
      } else if (e.key === 'Enter' && !isInputElement) {
        e.preventDefault();
        // Just keep selection, don't execute command
        // User can use shortcuts to execute commands
      }
    },
    [allVisibleItems.length, onClose],
  );

  // Smart selection reset: Scroll only on Search, Preserve (no scroll) on Collapse
  useEffect(() => {
    const isSearchChange = searchQuery !== prevSearchQuery.current;
    prevSearchQuery.current = searchQuery;

    if (isSearchChange) {
      // If search changed, reset to top and force scroll
      setSelectedIndex(0);
      shouldScrollToSelection.current = true;
    } else {
      // If list changed (e.g. collapse), preserve selection ID if possible
      if (prevSelectedId.current) {
        const newIndex = allVisibleItems.findIndex(item => item.id === prevSelectedId.current);
        if (newIndex !== -1) {
          setSelectedIndex(newIndex);
        } else {
          setSelectedIndex(0);
        }
      } else {
        setSelectedIndex(0);
      }
      // Do NOT set shouldScrollToSelection = true here
      // This prevents jumping when collapsing sections
    }
  }, [allVisibleItems, searchQuery]);

  // Scroll active item into view
  useEffect(() => {
    if (shouldScrollToSelection.current) {
      const selectedItem = allVisibleItems[selectedIndex];
      if (selectedItem) {
        const el = document.getElementById(`cmd-row-${selectedItem.id}`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
      shouldScrollToSelection.current = false;
    }
  }, [selectedIndex, allVisibleItems]);

  const executeCommand = useCallback(
    (row: CommandListRow) => {
      // 1. Handle Links
      if (row.type === 'link') {
        const linkData = linkCommandsMap[row.id];

        // Try to use linkData (custom overrides) first, then fallback to row data
        if (linkData && ((linkData.type === 'tabgroup' && linkData.urls && linkData.urls.length > 0) || linkData.url)) {
          if (linkData.type === 'tabgroup' && linkData.urls) {
            linkData.urls.forEach(url => window.open(url, '_blank'));
          } else if (linkData.url) {
            window.open(linkData.url, '_blank');
          }
        } else {
          // Fallback to row data (snippet)
          const parsed = row.fullSnippet ? safeParseTabs(row.fullSnippet.value) : null;
          if (parsed) {
            if (parsed.url) {
              window.open(parsed.url, '_blank');
            } else if (Array.isArray(parsed.urls)) {
              parsed.urls.forEach((url: string) => window.open(url, '_blank'));
            }
          } else if (row.url && row.url !== 'Link Group' && !row.url.includes(' URLs')) {
            // Fallback to url string if it looks like a URL
            window.open(row.url, '_blank');
          }
        }
        return;
      }

      // 2. Handle Notes
      if (row.type === 'note') {
        const idParts = row.id.split('-');
        if (allData && Array.isArray(allData)) {
          // Helper to find snippet
          const findAndOpenSnippet = () => {
            let containerId = '';
            let snippetId = row.id;

            if (idParts.length >= 10) {
              containerId = idParts.slice(0, 5).join('-');
              snippetId = idParts.slice(5).join('-');
            }

            // Iterate teams -> workspaces -> folders/snippets
            for (const team of allData) {
              if (team.workspaces) {
                for (const ws of team.workspaces) {
                  // Check in workspace snippets
                  if (!containerId || ws.workspace_id === containerId) {
                    const found = ws.workspace_snippets?.find(
                      s => (s as any).snippet_id === snippetId || s.id === snippetId,
                    );
                    if (found) {
                      dispatch(setSelectedTeam(team));
                      dispatch(
                        viewSnippet({
                          snippet: found,
                          breadcrumb: {
                            workspace_id: ws.workspace_id,
                            workspace_name: ws.workspace_name,
                            folder_id: null,
                            folder_name: null,
                          },
                        }),
                      );
                      onClose?.();
                      return true;
                    }
                  }

                  // Check in folders
                  for (const folder of ws.folders || []) {
                    if (!containerId || folder.folder_id === containerId) {
                      const found = folder.snippets?.find(
                        s => (s as any).snippet_id === snippetId || s.id === snippetId,
                      );
                      if (found) {
                        dispatch(setSelectedTeam(team));
                        dispatch(
                          viewSnippet({
                            snippet: found,
                            breadcrumb: {
                              workspace_id: ws.workspace_id,
                              workspace_name: ws.workspace_name,
                              folder_id: folder.folder_id,
                              folder_name: folder.folder_name,
                            },
                          }),
                        );
                        onClose?.();
                        return true;
                      }
                    }
                  }
                }
              }
            }
            return false;
          };

          findAndOpenSnippet();
        }
        return;
      }

      // Check if it's a local command
      const isLocalCommand = LOCAL_COMMANDS.some(cmd => cmd.id === row.id);

      if (isLocalCommand) {
        // For local commands, dispatch events or handle in-app actions
        const localCmd = LOCAL_COMMANDS.find(cmd => cmd.id === row.id);
        if (localCmd?.url) {
          // If local command has a URL, open it
          const chromeAny = (window as any)?.chrome;
          if (chromeAny?.tabs) {
            chromeAny.tabs.create({ url: localCmd.url });
          } else {
            window.open(localCmd.url, '_blank');
          }
        } else {
          // For in-app commands like createnotes/createlinks, we might need to dispatch events
          // For now, just show a message or handle via existing mechanisms
          
        }
        return;
      }

      // For global commands, find the command definition
      const commandDef = globalCommandsData.find(cmd => cmd.id === row.id);
      if (!commandDef) return;

      // Build the command URL
      const buildCommandLink = (command: CommandDefinition, prompt: string): string => {
        return buildUrl(command.urlTemplate, prompt);
      };

      // Check if it's a browser command without query requirement
      const isBrowserCommand = commandDef.category === 'browser' && !commandDef.urlTemplate.includes('{query}');

      if (isBrowserCommand) {
        // Browser commands execute immediately without prompt
        const url = buildCommandLink(commandDef, '');
        const chromeAny = (window as any)?.chrome;
        const isBrowserInternalUrl =
          url.startsWith('chrome://') ||
          url.startsWith('edge://') ||
          url.startsWith('brave://') ||
          url.startsWith('about:');

        if (isBrowserInternalUrl && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({ action: 'open_tab', url }, () => {
            if (chromeAny.runtime.lastError) {
              if (chromeAny?.tabs) {
                chromeAny.tabs.create({ url });
              } else {
                window.open(url, '_blank');
              }
            }
          });
        } else if (chromeAny?.tabs) {
          chromeAny.tabs.create({ url });
        } else {
          window.open(url, '_blank');
        }
      } else {
        // For commands that require a query, execute with empty string (or could prompt user)
        const url = buildCommandLink(commandDef, '');
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.tabs) {
          chromeAny.tabs.create({ url });
        } else {
          window.open(url, '_blank');
        }
      }
    },
    [globalCommandsData, linkCommandsMap, allData, dispatch, onClose],
  );

  const handleEdit = useCallback((commandId: string, field: EditField, currentValue: string | string[]) => {
    let valueStr = Array.isArray(currentValue) ? formatKeywords(currentValue) : currentValue || '';

    // If editing shortcut, strip the leading slash for the input
    if (field === 'shortcut' && valueStr.startsWith('/')) {
      valueStr = valueStr.substring(1);
    }

    if (field === 'hotkey' && !valueStr) {
      valueStr = 'Alt+';
    }

    // Clear any other active edits to ensure single edit mode
    setEditState({
      [commandId]: {
        [field]: valueStr,
      },
    });
  }, []);

  const handleCancel = useCallback((commandId: string, field: EditField) => {
    setEditState(prev => {
      // If cancelling, just clear everything for this command or effectively clear state if single mode
      return {};
    });
    setConflictState(prev => {
      const next = { ...prev };
      delete next[commandId];
      return next;
    });
  }, []);

  const handleHotkeyUpdate = useCallback(
    async (commandId: string, newValue: string) => {
      // Determine current type
      // We don't have direct access to 'noteCommands' array here if it's derived inside render?
      // Let's check variables.
      // If not available, we can rely on ID structure or passed type?
      // SharedHotkeyCell doesn't pass type (it's fixed 'hotkey').
      // But we know commandId.
      // We can use the maps: noteCommandsMap, linkCommandsMap.
      const isNote = !!noteCommandsMap[commandId] || commandId.includes('note') || commandId.includes('prompt');
      // Wait, noteCommandsMap keys are commandIds.
      // Let's use the maps.

      const isLink = !!linkCommandsMap[commandId];
      // isNote logic: check if in noteCommandsMap OR promptCommands?
      // prompt commands might be in noteCommandsMap if they share structure?
      // Prompts use 'prompt' category.
      // Let's look at buildPromptRows. It uses noteCommandsMap!
      const isNoteOrPrompt = !!noteCommandsMap[commandId];

      try {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local) throw new Error('Storage unavailable');

        const type = isNoteOrPrompt ? 'note' : isLink ? 'link' : 'command';

        // Sync to cloud (snippets)
        if (isNoteOrPrompt || isLink) {
          const snippetId = extractSnippetIdFromCompoundId(commandId);
          try {
            await updateSnippetHotkey(snippetId, newValue);
          } catch (e) {
            console.warn('Cloud sync snippet hotkey failed', e);
          }
        }

        // Save to local
        await updateLocalHotkey(commandId, newValue, type);

        // Save customization for local commands
        if (LOCAL_COMMANDS.some(c => c.id === commandId)) {
          await saveCustomization({ command_id: commandId, hotkey: newValue });
        } else if (!isNoteOrPrompt && !isLink) {
          // Assume Global/Browser Command -> Sync via API
          try {
            await updateHotkeyAndRefresh(commandId, newValue);
          } catch (e) {
            console.warn('Cloud sync command hotkey failed', e);
          }
        }

        // Update local state
        setHotkeysMap(prev => ({ ...prev, [commandId]: newValue }));

        // Legacy metadata update for Notes
        if (isNoteOrPrompt) {
          const currentNotes = await readNoteStorage();
          const entry = currentNotes[commandId] ? { ...currentNotes[commandId] } : {};
          if (!entry.snippetId) {
            entry.snippetId = extractSnippetIdFromCompoundId(commandId);
            currentNotes[commandId] = entry;
            await new Promise<void>(res => chromeAny.storage.local.set({ note_commands: currentNotes }, res));
            setNoteCommandsMap(currentNotes);
          }
        }

        dispatch(setCommandStatus({ status: 'success', message: 'Hotkey updated successfully' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } catch (error: any) {
        console.error('[CommandListView] Failed to save hotkey:', error);
        dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to save hotkey' }));
        throw error; // Propagate to SharedHotkeyCell
      }
    },
    [noteCommandsMap, linkCommandsMap, dispatch],
  );

  const handleSave = useCallback(
    async (commandId: string, field: EditField) => {
      const editValue = editState[commandId]?.[field];
      if (editValue === undefined) return;

      const savingKey = `${commandId}-${field}`;
      setSavingState(prev => ({ ...prev, [savingKey]: true }));
      dispatch(setCommandStatus({ status: 'loading', message: `Saving ${field}...` }));

      // Determinue current type based on our computed lists
      const isNote = noteCommands.some(r => r.id === commandId) || promptCommands.some(r => r.id === commandId);
      const isLink = linkCommands.some(r => r.id === commandId);

      try {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local) {
          console.error('chrome.storage.local not available');
          dispatch(setCommandStatus({ status: 'error', message: 'Storage unavailable' }));
          return;
        }

        // Handle hotkey saving separately
        if (field === 'hotkey') {
          return; // Should not happen with SharedHotkeyCell, but safety check
        }

        // --- Handle Shortcut / Keywords Saving ---

        // Check if it's a Note
        if (isNote) {
          const currentNotes = await readNoteStorage();
          const entry = currentNotes[commandId] ? { ...currentNotes[commandId] } : {};

          if (field === 'shortcut') {
            let shortcutValue = editValue.trim();
            if (shortcutValue && !shortcutValue.startsWith('/')) {
              shortcutValue = `/${shortcutValue}`;
            }

            const conflict = await validateShortcutUniqueness(shortcutValue, commandId);
            if (shortcutValue && conflict.isDuplicate) {
              dispatch(
                setCommandStatus({
                  status: 'error',
                  message: conflict.conflictName
                    ? `Shortcut "${shortcutValue}" is already assigned to "${conflict.conflictName}"`
                    : `Shortcut "${shortcutValue}" is already in use`,
                }),
              );
              setTimeout(() => dispatch(resetCommandStatus()), 3000);
              handleCancel(commandId, field);
              return;
            }
            entry.shortcut = shortcutValue;

            // SYNC TO CLOUD
            const snippetId = extractSnippetIdFromCompoundId(commandId);
            const row = allVisibleItems.find(r => r.id === commandId);
            try {
              await updateSnippetShortcut(snippetId, shortcutValue);
            } catch (err) {
              console.error('[CommandListView] Failed to sync note shortcut to cloud:', err);
            }
            await updateLocalShortcut(commandId, snippetId, shortcutValue, row?.name || '', 'note');
          } else if (field === 'keywords') {
            entry.keywords = parseKeywords(editValue);
          }

          // Ensure snippetId is set if new entry
          if (!entry.snippetId) {
            const parts = commandId.split('-');
            if (parts.length > 1) {
              entry.snippetId = parts.slice(1).join('-');
            }
          }

          currentNotes[commandId] = entry;

          await new Promise<void>(resolve => {
            chromeAny.storage.local.set({ note_commands: currentNotes }, () => resolve());
          });
          setNoteCommandsMap(currentNotes);

          handleCancel(commandId, field);
          dispatch(setCommandStatus({ status: 'success', message: `${field} updated` }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          return;
        }

        // Check if it's a Link
        if (isLink) {
          const currentLinks = await readLinkStorage();
          const entry = currentLinks[commandId] ? { ...currentLinks[commandId] } : {};

          if (field === 'shortcut') {
            let shortcutValue = editValue.trim();
            if (shortcutValue && !shortcutValue.startsWith('/')) {
              shortcutValue = `/${shortcutValue}`;
            }

            const conflict = await validateShortcutUniqueness(shortcutValue, commandId);
            if (shortcutValue && conflict.isDuplicate) {
              dispatch(
                setCommandStatus({
                  status: 'error',
                  message: conflict.conflictName
                    ? `Shortcut "${shortcutValue}" is already assigned to "${conflict.conflictName}"`
                    : `Shortcut "${shortcutValue}" is already in use`,
                }),
              );
              setTimeout(() => dispatch(resetCommandStatus()), 3000);
              handleCancel(commandId, field);
              return;
            }
            entry.shortcut = shortcutValue;

            // SYNC TO CLOUD
            const snippetId = extractSnippetIdFromCompoundId(commandId);
            const row = allVisibleItems.find(r => r.id === commandId);
            try {
              await updateSnippetShortcut(snippetId, shortcutValue);
            } catch (err) {
              console.error('[CommandListView] Failed to sync link shortcut to cloud:', err);
            }
            await updateLocalShortcut(commandId, snippetId, shortcutValue, row?.name || '', 'link', 'link');
          } else if (field === 'keywords') {
            entry.keywords = parseKeywords(editValue);
          }

          // Ensure snippetId is set if new entry
          if (!entry.snippetId) {
            const parts = commandId.split('-');
            if (parts.length > 1) {
              entry.snippetId = parts.slice(1).join('-');
            }
          }

          currentLinks[commandId] = entry;

          await new Promise<void>(resolve => {
            chromeAny.storage.local.set({ link_commands: currentLinks }, () => resolve());
          });
          setLinkCommandsMap(currentLinks);

          handleCancel(commandId, field);
          dispatch(setCommandStatus({ status: 'success', message: `${field} updated` }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          return;
        }

        // Check if it's a Local Command
        const isLocalCommand = LOCAL_COMMANDS.some(cmd => cmd.id === commandId);
        if (isLocalCommand) {
          try {
            if (field === 'shortcut') {
              const newPrefix = editValue.startsWith('/') ? editValue.trim() : `/${editValue.trim()}`;
              const conflict = await validateShortcutUniqueness(newPrefix, commandId);
              if (newPrefix && conflict.isDuplicate) {
                const msg = conflict.conflictName
                  ? `Shortcut "${newPrefix}" is already assigned to "${conflict.conflictName}"`
                  : `Shortcut "${newPrefix}" is already in use`;
                dispatch(setCommandStatus({ status: 'error', message: msg }));
                setTimeout(() => dispatch(resetCommandStatus()), 3000);
                handleCancel(commandId, field);
                return;
              }
              await saveCustomization({ command_id: commandId, prefix: newPrefix });
            } else if (field === 'keywords') {
              await saveCustomization({ command_id: commandId, keywords: parseKeywords(editValue) });
            }

            handleCancel(commandId, field);
            dispatch(setCommandStatus({ status: 'success', message: `${field} updated` }));
            // Remove saving state
            setSavingState(prev => {
              const next = { ...prev };
              delete next[savingKey];
              return next;
            });
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            return;
          } catch (error) {
            console.error(`Failed to save ${field} for local command ${commandId}:`, error);
            dispatch(setCommandStatus({ status: 'error', message: 'Save failed' }));
            setSavingState(prev => {
              const next = { ...prev };
              delete next[savingKey];
              return next;
            });
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            return;
          }
        }

        // Fallback: Global Commands - sync via API
        // Check if this is a browser command (local only, not in API)
        const isBrowserCommand = BROWSER_COMMANDS.some(c => c.id === commandId);

        if (isBrowserCommand) {
          // Browser commands are local only - update local storage directly
          const result = await new Promise<{ alts_commands?: CommandDefinition[] }>(resolve => {
            chromeAny.storage.local.get('alts_commands', resolve);
          });

          const commands = [...(result.alts_commands || [])];
          const cmdIndex = commands.findIndex(c => c.id === commandId);

          if (cmdIndex === -1) {
            dispatch(setCommandStatus({ status: 'error', message: 'Command not found' }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            return;
          }

          const updatedCommand = { ...commands[cmdIndex] };
          if (field === 'shortcut') {
            const newPrefix = editValue.startsWith('/') ? editValue.trim() : `/${editValue.trim()}`;
            const conflict = await validateShortcutUniqueness(newPrefix, commandId);
            if (newPrefix && conflict.isDuplicate) {
              const msg = conflict.conflictName
                ? `Shortcut "${newPrefix}" is already assigned to "${conflict.conflictName}"`
                : `Shortcut "${newPrefix}" is already in use`;
              dispatch(setCommandStatus({ status: 'error', message: msg }));
              setTimeout(() => dispatch(resetCommandStatus()), 3000);
              return;
            }
            updatedCommand.prefix = newPrefix;
          } else if (field === 'keywords') {
            updatedCommand.keywords = parseKeywords(editValue);
          }

          commands[cmdIndex] = updatedCommand;
          await new Promise<void>(resolve => {
            chromeAny.storage.local.set({ alts_commands: commands }, resolve);
          });

          handleCancel(commandId, field);
          dispatch(setCommandStatus({ status: 'success', message: `${field} updated` }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
          return;
        }

        // API-synced commands - update via API then refresh local storage
        let newPrefix: string | undefined;
        let newKeywords: string[] | undefined;

        if (field === 'shortcut') {
          newPrefix = editValue.startsWith('/') ? editValue.trim() : `/${editValue.trim()}`;
          const conflict = await validateShortcutUniqueness(newPrefix, commandId);

          if (newPrefix && conflict.isDuplicate) {
            const msg = conflict.conflictName
              ? `Shortcut "${newPrefix}" is already assigned to "${conflict.conflictName}"`
              : `Shortcut "${newPrefix}" is already in use`;

            dispatch(setCommandStatus({ status: 'error', message: msg }));
            setSavingState(prev => {
              const next = { ...prev };
              delete next[savingKey];
              return next;
            });
            setTimeout(() => dispatch(resetCommandStatus()), 3000);

            // Set conflict state
            setConflictState(prev => ({
              ...prev,
              [commandId]: {
                ...prev[commandId],
                shortcut: {
                  isConflict: true,
                  conflictId: conflict.conflictId || 'unknown',
                  message: msg,
                },
              },
            }));
            return;
          }
        } else if (field === 'keywords') {
          newKeywords = parseKeywords(editValue);
        }

        // Call API to update and refresh local storage
        try {
          await updateCommandAndRefresh(commandId, {
            prefix: newPrefix,
            keywords: newKeywords,
          });
        } catch (e) {
          console.warn('Cloud update command proxy failed', e);
        }

        handleCancel(commandId, field);
        dispatch(setCommandStatus({ status: 'success', message: `${field} updated` }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } catch (error) {
        console.error(`Failed to save ${field} for command ${commandId}:`, error);
        dispatch(setCommandStatus({ status: 'error', message: 'Save failed' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } finally {
        setSavingState(prev => {
          const next = { ...prev };
          delete next[savingKey];
          return next;
        });
      }
    },
    [editState, handleCancel, dispatch, hotkeysMap, noteCommandsMap, linkCommandsMap, noteCommands, linkCommands],
  );

  const handleInputChange = useCallback((commandId: string, field: EditField, value: string) => {
    setEditState(prev => ({
      ...prev,
      [commandId]: {
        ...prev[commandId],
        [field]: value,
      },
    }));
  }, []);

  const isFieldEditing = (commandId: string, field: EditField) => {
    return editState[commandId]?.[field] !== undefined;
  };

  const isFieldSaving = (commandId: string, field: EditField) => {
    return savingState[`${commandId}-${field}`] || false;
  };

  const handleShortcutUpdate = useCallback(
    async (commandId: string, newValue: string) => {
      // Wrapper to adapt handleSave logic to SharedHotkeyCell promise expectation
      // We need to set the edit state for the commandId first so handleSave uses it
      // actually handleSave uses editState.
      // But SharedHotkeyCell passes the value directly.
      // So we should modify handleSave to accept value arg optionally?
      // Or just reimplement the save logic here cleanly.

      // Reimplementing logic for cleaner separation:
      dispatch(setCommandStatus({ status: 'loading', message: `Saving shortcut...` }));

      const isNote = noteCommands.some(r => r.id === commandId) || promptCommands.some(r => r.id === commandId);
      const isLink = linkCommands.some(r => r.id === commandId);
      const isLocalCommand = LOCAL_COMMANDS.some(cmd => cmd.id === commandId);
      const isBrowserCommand = BROWSER_COMMANDS.some(c => c.id === commandId);

      try {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local) throw new Error('Storage unavailable');

        let shortcutValue = newValue.trim();
        if (shortcutValue && !shortcutValue.startsWith('/')) {
          shortcutValue = `/${shortcutValue}`;
        }

        // Validation
        const conflict = await validateShortcutUniqueness(shortcutValue, commandId);
        if (shortcutValue && conflict.isDuplicate) {
          const msg = conflict.conflictName
            ? `Shortcut "${shortcutValue}" is already assigned to "${conflict.conflictName}"`
            : `Shortcut "${shortcutValue}" is already in use`;
          throw new Error(msg);
        }

        if (isNote) {
          const currentNotes = await readNoteStorage();
          const entry = currentNotes[commandId] ? { ...currentNotes[commandId] } : {};
          entry.shortcut = shortcutValue;

          // Sync
          const snippetId = extractSnippetIdFromCompoundId(commandId);
          const row = allVisibleItems.find(r => r.id === commandId);
          try {
            await updateSnippetShortcut(snippetId, shortcutValue);
          } catch (e) {
            console.warn('Cloud sync note shortcut failed', e);
          }
          await updateLocalShortcut(commandId, snippetId, shortcutValue, row?.name || '', 'note');

          // Save local
          if (!entry.snippetId) {
            const parts = commandId.split('-');
            if (parts.length > 1) entry.snippetId = parts.slice(1).join('-');
          }
          currentNotes[commandId] = entry;
          await new Promise<void>(resolve => chromeAny.storage.local.set({ note_commands: currentNotes }, resolve));
          setNoteCommandsMap(currentNotes);
        } else if (isLink) {
          const currentLinks = await readLinkStorage();
          const entry = currentLinks[commandId] ? { ...currentLinks[commandId] } : {};
          entry.shortcut = shortcutValue;

          // Sync
          const snippetId = extractSnippetIdFromCompoundId(commandId);
          const row = allVisibleItems.find(r => r.id === commandId);
          try {
            await updateSnippetShortcut(snippetId, shortcutValue);
          } catch (e) {
            console.warn('Cloud sync link shortcut failed', e);
          }
          await updateLocalShortcut(commandId, snippetId, shortcutValue, row?.name || '', 'link', 'link');

          if (!entry.snippetId) {
            const parts = commandId.split('-');
            if (parts.length > 1) entry.snippetId = parts.slice(1).join('-');
          }
          currentLinks[commandId] = entry;
          await new Promise<void>(resolve => chromeAny.storage.local.set({ link_commands: currentLinks }, resolve));
          setLinkCommandsMap(currentLinks);
        } else if (isLocalCommand) {
          await saveCustomization({ command_id: commandId, prefix: shortcutValue });
        } else if (isBrowserCommand) {
          const result = await new Promise<{ alts_commands?: CommandDefinition[] }>(resolve => {
            chromeAny.storage.local.get('alts_commands', resolve);
          });
          const commands = [...(result.alts_commands || [])];
          const cmdIndex = commands.findIndex(c => c.id === commandId);
          if (cmdIndex !== -1) {
            commands[cmdIndex] = { ...commands[cmdIndex], prefix: shortcutValue };
            await new Promise<void>(resolve => chromeAny.storage.local.set({ alts_commands: commands }, resolve));
          }
        } else {
          // Global API
          try {
            await updateCommandAndRefresh(commandId, { prefix: shortcutValue });
          } catch (e) {
            console.warn('Cloud update global proxy failed', e);
          }
        }

        dispatch(setCommandStatus({ status: 'success', message: 'Shortcut updated' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } catch (error: any) {
        console.error(`Failed to save shortcut for ${commandId}:`, error);
        dispatch(setCommandStatus({ status: 'error', message: error.message || 'Save failed' }));
        throw error;
      }
    },
    [noteCommands, promptCommands, linkCommands, noteCommandsMap, linkCommandsMap, allVisibleItems, dispatch],
  );

  const findConflictingItemName = useCallback(
    (conflictingId: string) => {
      // Check commands
      const cmd = COMMANDS.find(c => c.id === conflictingId);
      if (cmd) return cmd.label;

      const localCmd = LOCAL_COMMANDS.find(c => c.id === conflictingId);
      if (localCmd) return localCmd.label;

      // Check global commands data ?
      // globalCommandsData might be better source.
      // But let's check allData first for snippets

      if (!allData) return null;

      // 2. Check Snippets (Workspaces/Folders)
      for (const team of allData) {
        if (team.workspaces) {
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
      }
      return null;
    },
    [allData],
  );

  const checkHotkeyConflict = useCallback(async (hotkeyValue: string) => {
    const allHotkeys = await readAllHotkeysBase();
    // We don't have the "current item ID" here easily unless we pass it.
    // But SharedHotkeyCell doesn't pass it to onCheckConflict.
    // Wait, SharedHotkeyCell calls onCheckConflict(value).
    // It doesn't pass its own ID to exclude itself?
    // SharedHotkeyCell has `itemId` prop. But it calls `onCheckConflict(val)`.
    // We need to wrap it: `(val) => checkHotkeyConflict(val, itemId)`
    // So checkHotkeyConflict should accept (val, itemId).
    // But here I'm defining the generic function?
    // No, I should define a helper `checkConflict(val, itemId, type)`?

    // Let's define it as a generic helper and wrap it in render.
    return { isConflict: false }; // Placeholder, logic moved to wrapper in render
  }, []);

  const handleOverwriteHotkey = useCallback(
    async (conflictId: string, currentItemId: string, newValue: string) => {
      dispatch(setCommandStatus({ status: 'loading', message: 'Overwriting hotkey...' }));
      try {
        // 1. Clear existing
        const isCommand =
          COMMANDS.some(c => c.id === conflictId) ||
          LOCAL_COMMANDS.some(c => c.id === conflictId) ||
          !conflictId.includes('-');

        if (isCommand) {
          if (LOCAL_COMMANDS.some(c => c.id === conflictId)) {
            await saveCustomization({ command_id: conflictId, hotkey: '' });
          } else {
            try {
              await updateHotkeyAndRefresh(conflictId as any, '');
            } catch (e) {
              console.warn('Cloud clear hotkey failed', e);
            }
            await updateLocalHotkey(conflictId, '', 'command');
          }
        } else {
          const sId = extractSnippetIdFromCompoundId(conflictId);
          try {
            await updateSnippetHotkey(sId, '');
          } catch (e) {
            console.warn('Cloud clear snippet hotkey failed', e);
          }
          await updateLocalHotkey(conflictId, '', 'note');
          await updateLocalHotkey(conflictId, '', 'link');
          await updateLocalHotkey(conflictId, '', 'prompt');
        }

        // 2. Save new
        await handleHotkeyUpdate(currentItemId, newValue);
      } catch (err: any) {
        console.error('Overwrite hotkey failed:', err);
        dispatch(setCommandStatus({ status: 'error', message: 'Overwrite failed' }));
        throw err;
      }
    },
    [dispatch, handleHotkeyUpdate],
  );

  const handleOverwriteShortcut = useCallback(
    async (conflictId: string, currentItemId: string, newValue: string) => {
      dispatch(setCommandStatus({ status: 'loading', message: 'Overwriting shortcut...' }));
      try {
        // 1. Clear existing
        const isCommand =
          COMMANDS.some(c => c.id === conflictId) ||
          LOCAL_COMMANDS.some(c => c.id === conflictId) ||
          !conflictId.includes('-');

        if (isCommand) {
          if (LOCAL_COMMANDS.some(c => c.id === conflictId)) {
            await saveCustomization({ command_id: conflictId, prefix: '' });
          } else {
            try {
              await updateCommandAndRefresh(conflictId as any, { prefix: '' });
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
          await updateLocalShortcut(conflictId, sId, '', '', 'prompt');
        }

        // 2. Save new
        await handleShortcutUpdate(currentItemId, newValue);
      } catch (err: any) {
        console.error('Overwrite shortcut failed:', err);
        dispatch(setCommandStatus({ status: 'error', message: 'Overwrite failed' }));
        throw err;
      }
    },
    [dispatch, handleShortcutUpdate],
  );

  const renderEditableCell = (
    commandId: string,
    field: EditField,
    displayValue: string,
    currentValue: string | string[],
    placeholder?: string,
  ) => {
    const isEditing = isFieldEditing(commandId, field);
    const isSaving = isFieldSaving(commandId, field);
    const editValue = editState[commandId]?.[field] || '';

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 w-full relative">
          {isSaving ? (
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <FiLoader size={12} className="animate-spin text-emerald-500" />
              <span className="text-[10px] font-medium text-emerald-500 whitespace-nowrap">
                {field === 'shortcut' ? (currentValue ? 'Updating...' : 'Saving...') : 'Saving...'}
              </span>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={editValue}
                onChange={e => handleInputChange(commandId, field, e.target.value)}
                className={`flex-1 min-w-0 ${field === 'shortcut' ? 'font-mono pl-5' : 'px-2'} text-neutral-600 dark:text-neutral-200 ${!isDarkMode ? 'bg-[#fdf6e3] border-[#eee8d5]' : 'bg-[var(--color-containerBg)] border-[var(--color-borderDefault)]'} py-1.5 rounded text-xs border focus:border-blue-500 focus:outline-none`}
                placeholder={placeholder}
                disabled={isSaving}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave(commandId, field);
                  if (e.key === 'Escape') handleCancel(commandId, field);
                }}
              />
              {field === 'shortcut' && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs select-none">
                  /
                </span>
              )}
              <div
                className={`flex items-center gap-0.5 flex-shrink-0 border rounded shadow-sm p-0.5 absolute right-1 top-1/2 -translate-y-1/2 z-10 ${!isDarkMode ? 'bg-[#fdf6e3] border-[#eee8d5]' : 'bg-[var(--color-containerBg)] border-[var(--color-borderDefault)]'}`}>
                <button
                  onClick={() => handleSave(commandId, field)}
                  disabled={isSaving}
                  className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded disabled:opacity-50"
                  title="Save">
                  <FaCheck size={10} />
                </button>
                <button
                  onClick={() => handleCancel(commandId, field)}
                  disabled={isSaving}
                  className="p-1 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                  title="Cancel">
                  <FaTimes size={10} />
                </button>
              </div>

              {/* Conflict logic removed from here as renderEditableCell is only used for keywords now. */}
              {/* Shortcut and Hotkey editing are fully handled by SharedHotkeyCell which manages its own conflict UI. */}
            </>
          )}
        </div>
      );
    }

    return (
      <div
        className="flex items-center gap-2 group cursor-pointer"
        onClick={() => handleEdit(commandId, field, currentValue)}>
        <span
          className={`flex-1 ${field === 'shortcut' ? `font-mono px-1.5 py-0.5 rounded border ${!isDarkMode ? 'text-[#073642] bg-[#eee8d5]/50 border-[#eee8d5]' : 'text-neutral-600 dark:text-neutral-300 bg-neutral-50/50 dark:bg-white/5 border-neutral-200/50 dark:border-white/10'}` : !isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'} truncate`}
          title={displayValue}>
          {displayValue || (
            <span className={`italic ${!isDarkMode ? 'text-[#93a1a1]' : 'text-neutral-300 dark:text-neutral-600'}`}>
              Set {field}
            </span>
          )}
        </span>
        <button
          onClick={() => handleEdit(commandId, field, currentValue)}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title={`Edit ${field}`}>
          <FaEdit size={12} />
        </button>
      </div>
    );
  };

  const renderHotkeyCell = (commandId: string, currentHotkey: string, canEdit: boolean) => {
    return (
      <SharedHotkeyCell
        itemId={commandId}
        currentValue={currentHotkey}
        type="hotkey"
        canEdit={canEdit}
        onUpdate={val => handleHotkeyUpdate(commandId, val)}
        onCheckConflict={async val => {
          if (!val) return { isConflict: false };

          // 1. Check for Extension Command conflicts (Fixed hotkeys like Alt+S, Alt+K)
          const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
          const targetNormal = normalize(val);

          const chromeAny = (window as any)?.chrome;
          if (chromeAny?.commands?.getAll) {
            const cmds = await new Promise<any[]>(res => chromeAny.commands.getAll(res));
            const conflictExtCmd = cmds.find((cmd: any) => {
              if (!cmd.shortcut) return false;
              return normalize(cmd.shortcut) === targetNormal;
            });

            if (conflictExtCmd) {
              return {
                isConflict: true,
                conflictId: 'extension-reserved',
                message: 'Hotkey is reserved by extension',
              };
            }
          }

          // 2. Check for duplicate assignments
          const allHotkeys = await readAllHotkeysBase();
          const currentSnippetId = extractSnippetIdFromCompoundId(commandId || '');
          const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === val && extractSnippetIdFromCompoundId(id) !== currentSnippetId);
          if (existingEntry) {
            const conflictId = existingEntry[0];
            const conflictName = findConflictingItemName(conflictId);
            return {
              isConflict: true,
              conflictId,
              message: conflictName
                ? `Hotkey "${val}" is already assigned to "${conflictName}"`
                : `Hotkey "${val}" is already assigned`,
            };
          }
          return { isConflict: false };
        }}
        onOverwrite={(conflictId, val) => handleOverwriteHotkey(conflictId, commandId, val)}
        className="font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-50/50 dark:bg-white/5 px-1.5 py-0.5 rounded border border-neutral-200/50 dark:border-white/5 inline-block w-fit whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-white/10"
        title={currentHotkey ? `Current Hotkey: ${currentHotkey}` : 'Assign a Keyboard Shortcut'}
      />
    );
  };

  const renderTable = (title: string, data: CommandListRow[], isGlobal: boolean, sectionId: string) => {
    // Determine if this section is expanded
    const isExpanded = expandedSections.has(sectionId);

    return (
      <div className="mb-8" id={`section-${sectionId}`}>
        <h3
          onClick={() => toggleSection(sectionId)}
          className={`text-sm font-bold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-400'} uppercase tracking-wider mb-3 pl-1 flex items-center gap-2 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 select-none`}>
          <FaChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
          {title}
        </h3>

        {isExpanded &&
          (data.length === 0 ? (
            <div className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-500 italic border border-dashed border-neutral-200 dark:border-white/10 rounded-xl">
              No matching commands found.
            </div>
          ) : (
            <div
              className={`border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${!isDarkMode ? 'bg-[#fdf6e3] border-[#eee8d5]' : 'bg-frostedwhite dark:bg-neutral-800/50 border-white/60 dark:border-white/10'}`}>
              <table className="w-full text-left text-sm table-fixed">
                <thead
                  className={`${!isDarkMode ? 'bg-[#eee8d5] border-[#93a1a1]/20' : 'bg-white/50 dark:bg-white/5 border-[var(--color-borderDefault)]'} border-b`}>
                  <tr>
                    <th
                      className={`px-4 py-3 font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-300'} w-[22%]`}>
                      Name
                    </th>
                    <th
                      className={`px-4 py-3 font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-300'} w-[13%]`}>
                      Shortcut
                    </th>
                    <th
                      className={`px-4 py-3 font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-300'} w-[15%] whitespace-nowrap`}>
                      Keyboard Shortcut
                    </th>
                    <th
                      className={`px-4 py-3 font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-300'} w-[20%]`}>
                      Search Tags
                    </th>
                    <th
                      className={`px-4 py-3 font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-300'} w-[30%]`}>
                      URL
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${!isDarkMode ? 'divide-[#eee8d5]' : 'divide-neutral-100 dark:divide-neutral-700'}`}>
                  {data.map(row => {
                    const isSelected = isExpanded && allVisibleItems[selectedIndex]?.id === row.id;
                    return (
                      <tr
                        key={`${title}-${row.id}`}
                        id={`cmd-row-${row.id}`}
                        className={` ${
                          isSelected
                            ? !isDarkMode
                              ? 'bg-[#eee8d5] shadow-sm'
                              : 'bg-neutral-100 dark:bg-white/10 shadow-sm'
                            : !isDarkMode
                              ? 'hover:bg-[#eee8d5]/50'
                              : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                        }`}
                        onClick={e => {
                          // Don't execute if clicking on editable cells
                          const target = e.target as HTMLElement;
                          if (target.closest('.group') || target.closest('input') || target.closest('button')) {
                            return;
                          }
                          // Just update selection, don't execute command
                          const idx = allVisibleItems.findIndex(item => item.id === row.id);
                          if (idx !== -1) {
                            setSelectedIndex(idx);
                          }
                        }}>
                        <td
                          className={`px-4 py-2.5 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-200'} font-medium truncate`}>
                          <div className="flex items-center gap-2 truncate">
                            {row.icon ? (
                              <span className="flex-shrink-0">{row.icon}</span>
                            ) : row.iconHost ? (
                              <img
                                src={getFaviconUrl(row.iconHost)}
                                className="w-4 h-4 rounded-sm flex-shrink-0"
                                alt=""
                              />
                            ) : null}
                            <span className="truncate text-inherit">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.isEditable ? (
                            <SharedHotkeyCell
                              itemId={row.id}
                              currentValue={row.shortcut}
                              type="shortcut"
                              canEdit={true}
                              onUpdate={val => handleShortcutUpdate(row.id, val)}
                              onCheckConflict={async val => {
                                let normalized = val.trim();
                                if (normalized && !normalized.startsWith('/')) {
                                  normalized = `/${normalized}`;
                                }
                                if (!normalized) return { isConflict: false };

                                const allShortcuts = await readAllShortcuts();
                                const currentSnippetId = extractSnippetIdFromCompoundId(row.id || '');
                                const existingEntry = Object.entries(allShortcuts).find(
                                  ([id, sc]) => sc === normalized && extractSnippetIdFromCompoundId(id) !== currentSnippetId,
                                );
                                if (existingEntry) {
                                  const conflictId = existingEntry[0];
                                  const conflictName = findConflictingItemName(conflictId);
                                  return {
                                    isConflict: true,
                                    conflictId,
                                    message: conflictName
                                      ? `Shortcut "${normalized}" is already assigned to "${conflictName}"`
                                      : `Shortcut "${normalized}" is already assigned`,
                                  };
                                }
                                return { isConflict: false };
                              }}
                              onOverwrite={(conflictId, val) => handleOverwriteShortcut(conflictId, row.id, val)}
                              className={`font-mono px-1.5 py-0.5 rounded text-xs border truncate block text-center min-h-[1.5em] ${!isDarkMode ? 'text-[#586e75] bg-[#eee8d5]/50 border-[#eee8d5] hover:bg-[#eee8d5]' : 'text-neutral-300 bg-neutral-50/50 dark:bg-white/5 border-neutral-200/50 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                            />
                          ) : (
                            <span
                              className={`font-mono px-1.5 py-0.5 rounded text-xs border ${!isDarkMode ? 'text-[#586e75] bg-[#eee8d5]/50 border-[#eee8d5]' : 'text-neutral-300 bg-neutral-50/50 dark:bg-white/5 border-neutral-200/50 dark:border-white/10'}`}>
                              {row.shortcut}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 overflow-hidden">{renderHotkeyCell(row.id, row.hotkey, true)}</td>
                        <td className="px-4 py-2.5">
                          {row.isEditable ? (
                            renderEditableCell(
                              row.id,
                              'keywords',
                              formatKeywords(row.keywords),
                              row.keywords,
                              'keyword1, keyword2, keyword3',
                            )
                          ) : (
                            <span
                              className={`truncate block font-normal ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}
                              title={formatKeywords(row.keywords)}>
                              {formatKeywords(row.keywords)}
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-2.5 truncate ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}
                          title={row.url}>
                          {row.url}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    );
  };

  // Wait for allData to load before rendering links and notes
  if (allDataLoading) {
    return <div className="w-full h-full flex items-center justify-center text-neutral-500">Loading commands...</div>;
  }

  return (
    <div
      className="flex-1 h-full overflow-y-auto px-4 py-4 focus:outline-none visible-scrollbar"
      tabIndex={-1}
      ref={containerRef}
      onKeyDown={handleKeyDown}>
      {/* Commands Group */}
      {(activeHotkeysItems.length > 0 || localCommands.length > 0 || generalCommands.length > 0) && (
        <div className="mb-8">
          <h3
            className={`text-xs font-bold uppercase tracking-wider mb-4 px-1 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-400 dark:text-neutral-500'}`}>
            Commands
          </h3>
          <div
            className={`space-y-6 border-l-2 pl-4 ml-1 ${!isDarkMode ? 'border-[#eee8d5]' : 'border-neutral-100 dark:border-white/5'}`}>
            {activeHotkeysItems.length > 0 && renderTable('Active Hotkeys', activeHotkeysItems, false, 'active')}
            {localCommands.length > 0 && renderTable('Local', filteredLocalCommands, false, 'local')}
            {generalCommands.length > 0 && renderTable('Global', generalCommands, true, 'global')}
          </div>
        </div>
      )}

      {browserCommands.length > 0 && renderTable('Browser Commands', browserCommands, true, 'browser')}
      {filteredLinkCommands.length > 0 && renderTable('Links', filteredLinkCommands, false, 'links')}
      {filteredNoteCommands.length > 0 && renderTable('Notes', filteredNoteCommands, false, 'notes')}
      {filteredPromptCommands.length > 0 && renderTable('Prompts', filteredPromptCommands, false, 'prompts')}
    </div>
  );
};

export default CommandListView;
