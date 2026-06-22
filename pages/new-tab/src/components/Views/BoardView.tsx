import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTerminal,
  FaFlag,
  FaLink,
  FaHistory,
  FaBookmark,
  FaRobot,
  FaSearch,
  FaGlobe,
  FaLayerGroup,
  FaFolder,
  FaFolderOpen,
  FaClock,
  FaCode,
  FaPlus,
  FaCheckCircle,
  FaRegCircle,
} from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiX } from 'react-icons/fi';
import { isSameDay, format } from 'date-fns';
import NotesIcon from '@src/components/Shared/Icons/NotesIcon';
import type { SuggestionState, SuggestionListItem } from '../SearchComponents/Searchbar/Searchbar';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { useDispatch, useSelector } from 'react-redux';
import {
  expandAllWorkspaces,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setIsCreatingNewItem,
  setSnippetBreadCrum,
  selectExpandedWorkspaces,
  navigateToView,
  selectIsMac,
  setTodoCreatePrefill,
  selectTodoCreatePrefill,
  setShowTodosView,
  setCommandStatus,
  resetCommandStatus,
  setHighlightedCommandId,
  setIsCommandListView,
  selectSelectedTeam,
} from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData, fetchAllDataThunk } from '../../../../Redux/AllData/allDataSlice';
import { COMMANDS } from '../SearchComponents/Searchbar/commands';
import { useCommands } from '../SearchComponents/Searchbar/useCommands';
import { LOCAL_COMMANDS, isLocalCommandId } from '../SearchComponents/Searchbar/localCommands';

import { UnifiedContextMenu } from '../Shared/UnifiedContextMenu';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import {
  readAllShortcuts,
  readAllHotkeys,
  getItemCompoundId,
  extractSnippetIdFromCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { updateCommandAndRefresh, updateHotkeyAndRefresh } from '../../../../Apis/features/userCommandsApiService';
import { updateSnippetShortcut, updateSnippetHotkey, updateTodoStatus, getOverdueTodos, getUpcomingTodos, getRecurringTodos } from '../../../../Apis/features/snippetApi';
import { updateLocalShortcut, updateLocalHotkey } from '../../../../utils/shortcutHotkeyUtils';
import { FiPlay, FiExternalLink, FiEdit2, FiTrash2, FiStar, FiZap } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';

// Helper for query highlighting
const highlightMatch = (text: string, query: string) => {
  if (!text || !query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerText.indexOf(lowerQuery);
  if (startIndex === -1) return text;
  const endIndex = startIndex + query.length;
  return (
    <>
      {text.substring(0, startIndex)}
      <span className="font-semibold text-neutral-900 dark:text-white">{text.substring(startIndex, endIndex)}</span>
      {text.substring(endIndex)}
    </>
  );
};

// ─── Slash Category Launcher (mirrors AltQ's @alias system) ──────────────────

/** Alias map: slash-alias (uppercase) → board group key */
const SLASH_SECTION_ALIASES: Record<string, string> = {
  A: 'all',
  T: 'todos',
  N: 'notes',
  S: 'snippets',
  P: 'prompts',
  L: 'links',
  C: 'commands',
  B: 'bookmarks',
  AU: 'automations',
};

/** Reverse map: group key → alias display string */
const SLASH_ALIAS_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SLASH_SECTION_ALIASES).map(([alias, section]) => [section, alias]),
);

const focusSearchbarInput = () => {
  const inputEl = document.getElementById('searchbar-input');
  if (inputEl) {
    inputEl.focus();
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch (e) {
      console.error('[BoardView] Failed to set cursor position:', e);
    }
  }
};

const getTodoDueLabel = (item: any): string => {
  if (!item.event_deadline) {
    if (item.is_anytime) return 'Anytime';
    return '';
  }

  const d = new Date(item.event_deadline.replace(' ', 'T'));
  if (isNaN(d.getTime())) {
    if (item.is_anytime) return 'Anytime';
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const isOverdue = !item.is_done && d.getTime() < now.getTime() && (dDate.getTime() < startOfToday.getTime() || (item.event_deadline && item.event_deadline.includes(':')));

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let dateStr = '';

  if (dDate.getTime() === startOfToday.getTime()) {
    dateStr = 'Today';
  } else if (dDate.getTime() === startOfTomorrow.getTime()) {
    dateStr = 'Tomorrow';
  } else if (d.getFullYear() >= 2035) {
    dateStr = 'Anytime';
  } else {
    dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const isRecurring = !!(item.is_recurring || item.recurring);
  const recurLabel = isRecurring ? ' • Recurring' : '';

  if (isOverdue) {
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let overdueText = '';
    if (diffMins < 60) overdueText = `${diffMins}m overdue`;
    else if (diffHrs < 24) overdueText = `${diffHrs}h overdue`;
    else overdueText = `${diffDays}d overdue`;

    return `${dateStr}, ${timeStr} (${overdueText})${recurLabel}`;
  }

  if (dateStr === 'Anytime') return `Anytime${recurLabel}`;
  return `${dateStr}, ${timeStr}${recurLabel}`;
};

interface SlashMode {
  slashDropdown: boolean; // show the category picker
  activeSection: string | null; // matched section key, or null
  searchQuery: string; // text after the alias for within-category filtering
}

/**
 * Parse a board search value that starts with '/'.
 * Matches only when the alias is followed by a space, allowing partial inputs to filter the dropdown.
 */
function parseSlashMode(value: string): SlashMode {
  const normalizedValue = value.replace(/\u00A0/g, ' ');
  if (!normalizedValue.startsWith('/')) {
    return { slashDropdown: false, activeSection: null, searchQuery: normalizedValue };
  }

  const textAfterSlash = normalizedValue.slice(1);

  // Find the longest matching alias
  let bestAlias = '';
  let activeSection: string | null = null;

  for (const [alias, section] of Object.entries(SLASH_SECTION_ALIASES)) {
    const upperText = textAfterSlash.toUpperCase();
    const upperAlias = alias.toUpperCase();

    // Active if matches exactly followed by a space
    const matchWithSpace = upperText.startsWith(upperAlias + ' ');

    if (matchWithSpace) {
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        activeSection = section;
      }
    }
  }

  if (activeSection) {
    let query = textAfterSlash.slice(bestAlias.length);
    if (query.startsWith(' ')) query = query.slice(1);
    return { slashDropdown: false, activeSection, searchQuery: query };
  }

  // No match → show the dropdown picker
  return { slashDropdown: true, activeSection: null, searchQuery: '' };
}

/** Metadata (icon + label) for each board group shown in the slash picker */
const SLASH_SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  all: {
    title: 'All',
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  todos: { title: 'Todos', icon: <BsCalendarCheck size={16} className="text-[var(--color-iconDefault)]" /> },
  notes: { title: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0 text-amber-400" /> },
  snippets: { title: 'Snippets', icon: <FaCode size={16} className="text-[var(--color-iconDefault)]" /> },
  prompts: { title: 'Prompts', icon: <FaFlag size={16} className="text-purple-400" /> },
  links: { title: 'Links', icon: <FaLink size={16} className="text-blue-400" /> },
  commands: { title: 'Commands', icon: <FaTerminal size={16} className="text-[var(--color-iconDefault)]" /> },
  bookmarks: { title: 'Bookmarks', icon: <FaBookmark size={16} className="text-[var(--color-iconDefault)]" /> },
  automations: { title: 'Automations', icon: <FiZap size={16} className="text-amber-400" /> },
};
// ─────────────────────────────────────────────────────────────────────────────

interface BoardViewProps {
  state?: SuggestionState | null;
  unfilteredSuggestions?: SuggestionListItem[];
  onClose?: () => void;
  isLoggedIn?: boolean;
}

const BoardView: React.FC<BoardViewProps> = ({ state, unfilteredSuggestions = [], onClose, isLoggedIn }) => {
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const [selectedSidebarSection, setSelectedSidebarSection] = useState<string>('all');
  const [slashDropdownSelectedIndex, setSlashDropdownSelectedIndex] = useState(-1);
  const dispatch = useDispatch();
  const expandedWorkspaces = useSelector(selectExpandedWorkspaces);

  const allData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam) as any;
  const { commands } = useCommands();

  // Derive default workspace ID
  const defaultWorkspaceId = useMemo(() => {
    if (!allData || allData.length === 0) return null;
    if (selectedTeam?.team_id) {
      const matchedTeam = allData.find((t: any) => String(t.team_id) === String(selectedTeam.team_id));
      const firstWs = matchedTeam?.workspaces?.[0]?.workspace_id;
      if (firstWs) return firstWs;
    }
    const personal = allData.find((t: any) => t.is_personal_space) || allData[0];
    return personal?.workspaces?.[0]?.workspace_id || null;
  }, [allData, selectedTeam]);

  const rawSearchValue = state?.value || '';
  const prevSearchValueRef = useRef(rawSearchValue);
  const slashMode = useMemo(() => parseSlashMode(rawSearchValue), [rawSearchValue]);

  const effectiveSidebarSection = slashMode.slashDropdown
    ? 'all'
    : slashMode.activeSection && slashMode.activeSection !== 'all'
      ? slashMode.activeSection
      : selectedSidebarSection;

  // Favorites, hotkeys and shortcuts state
  const [favoritesMapping, setFavoritesMapping] = useState<Record<string, any[]>>({});
  const [userId, setUserId] = useState('');
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  const [todosList, setTodosList] = useState<any[]>([]);
  const [chromeBookmarks, setChromeBookmarks] = useState<any[]>([]);

  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; item: any } | null>(null);
  const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
  const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdatingHotkey, setIsUpdatingHotkey] = useState<boolean>(false);
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  const isMac = useSelector(selectIsMac);
  const todoCreatePrefill = useSelector(selectTodoCreatePrefill);
  const { captureHotkey } = useHotkeyAssignment(editValue, isMac);

  const handleCancelEdit = () => {
    setEditingShortcutFor(null);
    setEditingHotkeyFor(null);
    setEditValue('');
    setSaveError(null);
    setConflictId(null);
  };

  const refreshHotkeyMaps = async () => {
    try {
      const [hk, sc] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap(hk);
      setShortcutsMap(sc);
    } catch (e) {
      console.error('[BoardView] Failed to read hotkeys/shortcuts:', e);
    }
  };

  useEffect(() => {
    import('../../../../Apis/core/api')
      .then(m => m.getUserId())
      .then(setUserId)
      .catch(console.error);
    refreshHotkeyMaps();

    const flattenBookmarks = (nodes: any[], result: any[] = []) => {
      nodes.forEach(node => {
        if (node.url) {
          result.push({
            id: `bookmark-${node.id}`,
            _kind: 'bookmark',
            type: 'bookmark',
            title: node.title,
            url: node.url,
          });
        }
        if (node.children) {
          flattenBookmarks(node.children, result);
        }
      });
      return result;
    };

    const loadBookmarks = () => {
      const chromeAny = (window as any)?.chrome;
      chromeAny?.bookmarks?.getTree?.((tree: any) => {
        const flattened = flattenBookmarks(tree);
        setChromeBookmarks(flattened);
      });
    };

    const chromeAny = (window as any)?.chrome;
    loadBookmarks();

    if (chromeAny?.bookmarks?.onRemoved) {
      chromeAny.bookmarks.onRemoved.addListener(loadBookmarks);
      chromeAny.bookmarks.onCreated.addListener(loadBookmarks);
      chromeAny.bookmarks.onChanged.addListener(loadBookmarks);
    }

    const deduplicateAndSetTodos = (localTodos: any[], cachedTodos: any[]) => {
      
      const normalizeId = (t: any): string => {
        const raw = t.snippet_id || t.id || t.todo_id;
        if (raw !== undefined && raw !== null && String(raw) !== 'undefined') {
          return String(raw);
        }
        // Fallback: use key + deadline to create a synthetic id
        return `local-${t.key || t.title || ''}-${t.event_deadline || ''}`.replace(/\s+/g, '_');
      };
      const mappedLocal = localTodos.map((t: any) => ({
        ...t,
        snippet_id: normalizeId(t),
        is_recurring: !!(t.is_recurring || (t as any).recurring),
      }));
      const mappedCached = cachedTodos.map((t: any) => ({
        ...t,
        snippet_id: normalizeId(t),
        is_recurring: !!(t.is_recurring || (t as any).recurring),
      }));
      // local_todos takes priority: build map from local first, then add cached if not already present
      const finalMap = new Map<string, any>();
      mappedLocal.forEach(t => finalMap.set(t.snippet_id, t));
      mappedCached.forEach(t => {
        if (!finalMap.has(t.snippet_id)) {
          finalMap.set(t.snippet_id, t);
        }
      });
      const unique = Array.from(finalMap.values());
      
      setTodosList(unique);
    };

    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['myFavouriteItems', 'local_todos', 'cached_todos'], (result: any) => {
        setFavoritesMapping(result?.myFavouriteItems || {});
        const localTodos = result?.local_todos || [];
        const cachedTodos = result?.cached_todos || [];
        deduplicateAndSetTodos(localTodos, cachedTodos);
      });

      const handleChange = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          if (changes?.myFavouriteItems) {
            setFavoritesMapping(changes.myFavouriteItems.newValue || {});
          }
          if (changes?.local_todos || changes?.cached_todos) {
            chromeAny.storage.local.get(['local_todos', 'cached_todos'], (result: any) => {
              const localTodos = result?.local_todos || [];
              const cachedTodos = result?.cached_todos || [];
              deduplicateAndSetTodos(localTodos, cachedTodos);
            });
          }
          refreshHotkeyMaps();
        }
      };

      const handleTodosUpdated = () => {
        // Read from storage (which has just been updated by TodosList or fetchCloudTodos)
        // DO NOT call fetchCloudTodos here to avoid infinite loops
        chromeAny.storage.local.get(['local_todos', 'cached_todos'], (result: any) => {
          const localTodos = result?.local_todos || [];
          const cachedTodos = result?.cached_todos || [];
          deduplicateAndSetTodos(localTodos, cachedTodos);
        });
      };

      chromeAny.storage.onChanged.addListener(handleChange);
      window.addEventListener('todosUpdated', handleTodosUpdated);

      return () => {
        chromeAny.storage.onChanged.removeListener(handleChange);
        window.removeEventListener('todosUpdated', handleTodosUpdated);
        if (chromeAny?.bookmarks?.onRemoved) {
          chromeAny.bookmarks.onRemoved.removeListener(loadBookmarks);
          chromeAny.bookmarks.onCreated.removeListener(loadBookmarks);
          chromeAny.bookmarks.onChanged.removeListener(loadBookmarks);
        }
      };
    }
    return undefined;
  }, []);

  const convertibleItems = useMemo(() => {
    const items: any[] = [];

    // 1. Snippets (Notes, Links, Prompts)
    if (allData) {
      allData.forEach(team => {
        team.workspaces.forEach(ws => {
          // Workspace snippets
          (ws.workspace_snippets || []).forEach(snippet => {
            if (!snippet.is_todo_type && snippet.category !== 'task') {
              items.push({
                id: snippet.id,
                name: snippet.key,
                category: snippet.category || 'snippet',
                data: snippet,
              });
            }
          });
          // Folder snippets
          (ws.folders || []).forEach(folder => {
            (folder.snippets || []).forEach(snippet => {
              if (!snippet.is_todo_type && snippet.category !== 'task') {
                items.push({
                  id: snippet.id,
                  name: snippet.key,
                  category: snippet.category || 'snippet',
                  data: snippet,
                });
              }
            });
          });

          // Workspace automations
          (ws.workspace_automations || []).forEach(auto => {
            let category = 'automation';

            // Check if it is an AI Chat Agent
            const steps = auto.automation_steps || auto.steps || [];
            const isAiAgent = Array.isArray(steps) && steps.some(
              (s: any) => String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi
            );

            if (isAiAgent) {
              category = 'agent';
            } else {
              const isModule =
                auto.category?.toLowerCase() === 'module' ||
                auto.type === 'automationModule' ||
                !!(auto as any).module_id ||
                !!(auto as any).installation_id;

              if (isModule) category = 'module';
            }

            items.push({
              id: `auto-${auto.id}`,
              name: auto.name,
              category: category,
              data: auto,
            });
          });

          // Workspace Agents & Chat Agents
          const agents = [
            ...((ws as any).workspace_agents || []),
            ...((ws as any).workspace_chat_agents || []),
            ...((ws as any).chat_agents || [])
          ];

          agents.forEach((agent: any) => {
            items.push({
              id: `agent-${agent.id}`,
              name: agent.name,
              category: 'agent',
              data: agent,
            });
          });
          // Workspace Installed Modules
          const wsModules = (ws as any).installed_modules || (ws as any).modules || [];
          wsModules.forEach((m: any) => {
            items.push({
              id: `mod-${m.id || m.installation_id || m.module_id || m.installationId}`,
              name: m.name || m.module_name || m.label || 'Untitled Module',
              category: 'module',
              data: m,
            });
          });
        });
      });
    }

    // 2. Commands
    COMMANDS.forEach(cmd => {
      items.push({
        id: `cmd-${cmd.id}`,
        name: cmd.label,
        category: 'command',
        data: { ...cmd, key: cmd.label, value: cmd.id },
      });
    });

    // 3. Local Commands
    LOCAL_COMMANDS.forEach(cmd => {
      items.push({
        id: `lcmd-${cmd.id}`,
        name: cmd.label,
        category: 'command',
        data: { ...cmd, key: cmd.label, value: cmd.id },
      });
    });

    return items;
  }, [allData]);

  const [asyncItems, setAsyncItems] = useState<any[]>([]);
  useEffect(() => {
    const loadModules = async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.storage?.local) return;
      const storage: any = await new Promise(resolve => chromeAny.storage.local.get(['installed_modules', 'modules', 'installedModules', 'user_modules'], resolve));
      const localModules = storage.installed_modules || storage.modules || storage.installedModules || storage.user_modules || [];

      const mapModules = (modules: any[]) =>
        modules.map((m: any) => ({
          id: `mod-${m.id || m.installation_id || m.module_id || m.installationId}`,
          name: m.name || m.module_name || m.label || 'Untitled Module',
          category: 'module',
          data: m,
        }));

      if (Array.isArray(localModules) && localModules.length > 0) {
        setAsyncItems(mapModules(localModules));
      }
    };

    loadModules();

    const listener = (changes: any) => {
      if (changes.installed_modules || changes.modules || changes.installedModules) {
        loadModules();
      }
    };
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(listener);
      return () => chromeAny.storage.onChanged.removeListener(listener);
    }
    return undefined;
  }, []);

  const finalConvertibleItems = useMemo(() => {
    return [...convertibleItems, ...asyncItems];
  }, [convertibleItems, asyncItems]);

  const fetchCloudTodosRef = useRef<any>(null);

  const fetchCloudTodos = useCallback(async (forceCloud = false) => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local || !isLoggedIn) return;
    try {
      const storage = await chromeAny.storage.local.get(['last_todo_fetch_timestamp']);
      const lastFetch = storage.last_todo_fetch_timestamp || 0;
      const now = Date.now();
      const isCoolingDown = now - lastFetch < 2 * 60 * 60 * 1000;

      if (!forceCloud && isCoolingDown) {
        return;
      }

      const [overdueRes, upcomingRes, recurringRes] = await Promise.all([
        getOverdueTodos(),
        getUpcomingTodos(),
        getRecurringTodos(format(new Date(), 'yyyy-MM-dd')),
      ]);

      await chromeAny.storage.local.set({ last_todo_fetch_timestamp: Date.now() });

      const overdue = Array.isArray(overdueRes) ? overdueRes : (overdueRes as any)?.todos || (overdueRes as any)?.overdue_todos || [];
      const upcoming = Array.isArray(upcomingRes) ? upcomingRes : (upcomingRes as any)?.todos || (upcomingRes as any)?.upcoming_todos || [];
      const recurring = Array.isArray(recurringRes) ? recurringRes : (recurringRes as any)?.todos || (recurringRes as any)?.recurring_todos || [];

      const cloudTasks = [...overdue, ...upcoming, ...recurring].map(s => {
        const possibleIds = [s.todo_id, s.snippet_todo_id, s.id, s.snippet_id];
        const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));
        const tId = numericId || s.todo_id || s.id || s.snippet_id;

        let category = (s.category || s.snippet_category || '').toLowerCase();
        if (s.automation_id) {
          const isAgent = s.is_agent || s.type === 'agent' || s.category === 'agent' || s.category === 'chat_agent';
          category = isAgent ? 'agent' : 'automation';
        } else if (s.command_id) {
          category = 'command';
        } else if (s.installed_module_id || s.module_id) {
          category = 'module';
        }
        if (!category || category === 'custom') category = 'snippet';

        const title = s.key || s.title || s.automation_name || s.command_label || s.module_name || 'Untitled Task';

        let computedSnippetId = s.snippet_id || s.id || s.automation_id || s.command_id || s.installed_module_id || s.module_id || s.todo_id;
        if (s.automation_id) {
          const isAgent = s.is_agent || s.type === 'agent' || s.category === 'agent' || s.category === 'chat_agent';
          computedSnippetId = isAgent ? `agent-${s.automation_id}` : `auto-${s.automation_id}`;
        } else if (s.command_id) {
          const isLocal = LOCAL_COMMANDS.some(lc => String(lc.id).toLowerCase() === String(s.command_id).toLowerCase());
          computedSnippetId = isLocal ? `lcmd-${s.command_id}` : `cmd-${s.command_id}`;
        } else if (s.installed_module_id || s.module_id) {
          computedSnippetId = `mod-${s.installed_module_id || s.module_id}`;
        }

        let parsedConfig = s.config;
        if (typeof s.config === 'string' && s.config.trim().startsWith('{')) {
          try {
            parsedConfig = JSON.parse(s.config);
          } catch (e) {
            console.error('[BoardView Todo Sync] Failed to parse config:', e);
          }
        }

        return {
          ...s,
          is_todo_type: true,
          snippet_id: String(computedSnippetId),
          todo_id: tId,
          key: title,
          title: title,
          category: category,
          is_recurring: !!(s.is_recurring || s.recurring),
          config: parsedConfig,
        };
      });

      const result = await chromeAny.storage.local.get(['local_todos']);
      const rawLocalTodos = result.local_todos || [];
      const localTodos = rawLocalTodos.map((t: any) => ({
        ...t,
        snippet_id: String(t.id || t.snippet_id),
        is_recurring: !!(t.is_recurring || (t as any).recurring),
      }));

      const finalTasksMap = new Map();
      cloudTasks.forEach(cloudTask => {
        finalTasksMap.set(String(cloudTask.snippet_id), cloudTask);
      });

      localTodos.forEach((localTask: any) => {
        const localId = String(localTask.snippet_id);
        if (finalTasksMap.has(localId)) {
          const cloudTask = finalTasksMap.get(localId);
          const existingIsNumeric = typeof localTask.todo_id === 'number' || (typeof localTask.todo_id === 'string' && !isNaN(Number(localTask.todo_id)) && !localTask.todo_id.includes('-'));
          const cloudIsNumeric = typeof cloudTask.todo_id === 'number' || (typeof cloudTask.todo_id === 'string' && !isNaN(Number(cloudTask.todo_id)) && !cloudTask.todo_id.includes('-'));
          if (existingIsNumeric && !cloudIsNumeric) {
            cloudTask.todo_id = localTask.todo_id;
          }
        } else {
          const localDeadline = localTask.event_deadline ? String(localTask.event_deadline).replace(' ', 'T').split('.')[0] : '';
          const localKey = (localTask.key || '').toLowerCase();
          let isDuplicate = false;
          if (localId.startsWith('local-')) {
            isDuplicate = cloudTasks.some(ct => {
              const cloudDeadline = ct.event_deadline ? String(ct.event_deadline).replace(' ', 'T').split('.')[0] : '';
              const cloudKey = (ct.key || '').toLowerCase();
              return cloudDeadline === localDeadline && cloudKey === localKey;
            });
          }
          if (!isDuplicate) {
            finalTasksMap.set(localId, localTask);
          }
        }
      });

      const finalArray = Array.from(finalTasksMap.values());
      // Write to cached_todos — the handleChange listener in the mount effect will
      // automatically pick up the change and call deduplicateAndSetTodos
      await chromeAny.storage.local.set({ cached_todos: finalArray });
      // Dispatch todosUpdated so other components (HomeView, etc.) also refresh
      // Note: BoardView's own handleTodosUpdated will re-read from storage,
      // which is fine because fetchCloudTodos is NOT called from handleTodosUpdated
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (err) {
      console.error('[BoardView Todo Sync] Cloud fetch failed:', err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchCloudTodosRef.current = fetchCloudTodos;
  }, [fetchCloudTodos]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchCloudTodos(false);
    }
  }, [isLoggedIn, fetchCloudTodos]);

  const favoriteIdSet = useMemo(() => {
    const list = favoritesMapping[userId] || [];
    const set = new Set<string>();
    list.forEach(s => {
      const favId = s?.id || s?.snippet_id;
      if (favId) set.add(String(favId));
    });
    return set;
  }, [favoritesMapping, userId]);

  const saveHotkey = async (item: any, hotkeyValue: string, shouldClose = true) => {
    const itemId = getItemCompoundId(item);
    dispatch(
      setCommandStatus({
        status: 'loading',
        message: !hotkeyValue ? 'Clearing...' : isUpdatingHotkey ? 'Updating...' : 'Saving...',
      }),
    );
    setIsSaving(true);

    try {
      const kind = item._kind || item.type;
      if (kind === 'command') {
        let result: any = null;
        try {
          result = await updateHotkeyAndRefresh(item.id, hotkeyValue);
        } catch (e) {
          console.warn('Cloud sync failed for command hotkey, falling back to local', e);
        }
        if (!result || result.length === 0) {
          await updateLocalHotkey(itemId, hotkeyValue, 'command');
        }
      } else {
        const snippetId = extractSnippetIdFromCompoundId(itemId);
        if (!snippetId) throw new Error('Snippet ID not found');
        try {
          await updateSnippetHotkey(snippetId, hotkeyValue, selectedTeam?.storageMode ?? 'cloud');
        } catch (e) {
          console.warn('Cloud sync failed for snippet hotkey, falling back to local', e);
        }
        const category = (item.snippet?.category || '').toLowerCase();
        const type = ['link', 'links', 'quicklink', 'biolink', 'tabgroup'].includes(category) ? 'link' : 'note';
        await updateLocalHotkey(itemId, hotkeyValue, type);
      }

      await refreshHotkeyMaps();

      if (kind === 'command') {
        dispatch(fetchAllDataThunk() as any);
      }

      dispatch(setCommandStatus({ status: 'success', message: !hotkeyValue ? 'Cleared' : 'Saved' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);
    } catch (error: any) {
      console.error('[BoardView] Failed to save/clear hotkey:', error);
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
  };

  const saveShortcut = async (item: any, shortcutValue: string) => {
    const itemId = getItemCompoundId(item);
    let normalized = shortcutValue.trim().toLowerCase();
    if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;

    dispatch(
      setCommandStatus({
        status: 'loading',
        message: !normalized ? 'Clearing...' : isUpdatingShortcut ? 'Updating...' : 'Saving...',
      }),
    );
    setIsSaving(true);

    try {
      const kind = item._kind || item.type;
      if (kind === 'command') {
        let result: any = null;
        try {
          result = await updateCommandAndRefresh(item.id, { prefix: normalized });
        } catch (e) {
          console.warn('Cloud sync failed for command shortcut, falling back to local', e);
        }
        if (!result || result.length === 0) {
          await updateLocalShortcut(itemId, item.id, normalized, getTitle(item), 'module');
        }
      } else {
        const snippetId = extractSnippetIdFromCompoundId(itemId);
        if (!snippetId) throw new Error('Snippet ID not found');
        try {
          await updateSnippetShortcut(snippetId, normalized, selectedTeam?.storageMode ?? 'cloud');
        } catch (e) {
          console.warn('Cloud sync failed for snippet shortcut, falling back to local', e);
        }
        const category = (item.snippet?.category || '').toLowerCase();
        const type = ['link', 'links', 'quicklink', 'biolink', 'tabgroup'].includes(category) ? 'link' : 'note';
        await updateLocalShortcut(
          itemId,
          snippetId,
          normalized,
          item.snippet?.key || getTitle(item),
          type as any,
          category === 'tabgroup' ? 'tabgroup' : 'link',
        );
      }

      await refreshHotkeyMaps();

      if (kind === 'command') {
        dispatch(fetchAllDataThunk() as any);
      }

      dispatch(setCommandStatus({ status: 'success', message: !normalized ? 'Cleared' : 'Saved' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);
    } catch (error: any) {
      console.error('[BoardView] Failed to save/clear shortcut:', error);
      dispatch(setCommandStatus({ status: 'error', message: error.message || 'Failed to update shortcut' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);
    } finally {
      setIsSaving(false);
      setEditingShortcutFor(null);
      setEditValue('');
      setSaveError(null);
    }
  };

  const handleOverwriteHotkey = async (conflictId: string) => {
    if (!conflictId || !contextMenuState?.item) return;
    setIsSaving(true);
    dispatch(setCommandStatus({ status: 'loading', message: 'Overwriting existing hotkey...' }));

    try {
      const isCommand = COMMANDS.some(c => c.id === conflictId) || isLocalCommandId(conflictId as any);

      if (isCommand) {
        try {
          await updateHotkeyAndRefresh(conflictId as any, '');
        } catch (e) {
          console.warn('Cloud hotkey clear failed', e);
        }
        await updateLocalHotkey(conflictId, '', 'command');
      } else {
        const sId = extractSnippetIdFromCompoundId(conflictId);
        try {
          await updateSnippetHotkey(sId, '', selectedTeam?.storageMode ?? 'cloud');
        } catch (e) {
          console.warn('Cloud hotkey clear failed', e);
        }
        await updateLocalHotkey(conflictId, '', 'note');
        await updateLocalHotkey(conflictId, '', 'link');
      }

      await saveHotkey(contextMenuState.item, editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      dispatch(setCommandStatus({ status: 'error', message: 'Overwrite failed' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);
      setIsSaving(false);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string) => {
    if (!conflictId || !contextMenuState?.item) return;
    setIsSaving(true);
    dispatch(setCommandStatus({ status: 'loading', message: 'Overwriting existing shortcut...' }));

    try {
      const isCommand = COMMANDS.some(c => c.id === conflictId) || isLocalCommandId(conflictId as any);

      if (isCommand) {
        try {
          await updateCommandAndRefresh(conflictId as any, { prefix: '' });
        } catch (e) {
          console.warn('Cloud shortcut clear failed', e);
        }
        await updateLocalShortcut(conflictId, conflictId, '', '', 'module');
      } else {
        const sId = extractSnippetIdFromCompoundId(conflictId);
        try {
          await updateSnippetShortcut(sId, '', selectedTeam?.storageMode ?? 'cloud');
        } catch (e) {
          console.warn('Cloud shortcut clear failed', e);
        }
        await updateLocalShortcut(conflictId, sId, '', '', 'note');
        await updateLocalShortcut(conflictId, sId, '', '', 'link');
      }

      await saveShortcut(contextMenuState.item, editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      dispatch(setCommandStatus({ status: 'error', message: 'Overwrite failed' }));
      setTimeout(() => dispatch(resetCommandStatus()), 3000);
      setIsSaving(false);
    }
  };

  const handleGoToConflict = () => {
    if (conflictId) {
      dispatch(setHighlightedCommandId(conflictId));
      dispatch(setIsCommandListView(true));
      setContextMenuState(null);
    }
  };

  const buildContextMenuActions = (item: any) => {
    const kind = item._kind || item.type;
    const isNote =
      kind === 'snippet' &&
      !['link', 'links', 'quicklink', 'biolink', 'tabgroup', 'prompt'].includes(
        (item.snippet?.category || '').toLowerCase(),
      );
    const isPrompt = kind === 'snippet' && (item.snippet?.category || '').toLowerCase() === 'prompt';
    const isLink =
      kind === 'snippet' &&
      ['link', 'links', 'quicklink', 'biolink', 'tabgroup'].includes((item.snippet?.category || '').toLowerCase());
    const isTabGroup =
      kind === 'snippet' && ['tabgroup', 'tab group'].includes((item.snippet?.category || '').toLowerCase());

    const actions: any[] = [];

    if (isNote) {
      actions.push({
        key: 'open-new-tab',
        label: `Open in full screen ${isMac ? '(⌘+Enter)' : '(Ctrl+Enter)'}`,
        icon: <FiExternalLink size={14} />,
        onSelect: () => {
          const snippetId = item.snippet?.snippet_id || item.snippet?.id;
          if (snippetId && (window as any).chrome?.tabs?.create && (window as any).chrome?.runtime?.getURL) {
            (window as any).chrome.tabs.create({
              url: (window as any).chrome.runtime.getURL(
                `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
              ),
              active: true,
            });
          }
        },
      });
    }

    if (kind === 'snippet') {
      const labelText = isTabGroup ? 'Edit routine' : isLink ? 'Edit link' : isPrompt ? 'Edit prompt' : 'Edit note';
      actions.push({
        key: 'edit',
        label: `${labelText} ${isMac ? '(⌘+Shift+E)' : '(Alt+Shift+E)'}`,
        icon: <FiEdit2 size={14} />,
        onSelect: () => {
          if (isLink || isTabGroup || isPrompt) {
            if (state?.onRequestEditLink) {
              state.onRequestEditLink(item);
            } else if (state?.onRequestEditPrompt) {
              state.onRequestEditPrompt(item);
            }
          } else {
            executeItem(item);
          }
        },
      });

      actions.push({
        key: 'create-todo',
        label: 'Create Todo',
        icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
        onSelect: () => {
          dispatch(
            setTodoCreatePrefill({
              snippet_id: item.snippet?.snippet_id || item.snippet?.id,
              key: item.snippet?.key || getTitle(item),
              value: typeof item.snippet?.value === 'string' ? item.snippet.value : JSON.stringify(item.snippet?.value),
              category: item.snippet?.category || item.kind,
            }),
          );
          dispatch(setShowTodosView(true));
        },
      });

      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <FiTrash2 size={14} />,
        className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
        onSelect: () => {
          if (state?.onRequestSnippetDelete) {
            const snippetId = item.snippet?.snippet_id || item.snippet?.id;
            state.onRequestSnippetDelete({
              snippetId,
              id: snippetId,
              key: item.snippet?.key,
              category: item.snippet?.category,
              workspaceId: item.workspace?.workspace_id,
              folderId: item.folder?.folder_id,
            });
          }
        },
      });
    }

    if (kind === 'snippet' || kind === 'command' || kind === 'common_command') {
      actions.push({ key: `div-fav-0`, divider: true });

      const compoundId = getItemCompoundId(item);
      const isFav =
        favoriteIdSet.has(compoundId) || favoriteIdSet.has(String(item.snippet?.id || item.snippet?.snippet_id || ''));

      actions.push({
        key: 'favorite',
        label: isFav ? 'Remove from favourites' : 'Mark as favourite',
        icon: isFav ? <FaStar size={14} className="text-yellow-500" /> : <FiStar size={14} />,
        closeOnExecute: false,
        onSelect: () => {
          if (state?.onToggleFavorite) {
            state.onToggleFavorite(item);
          }
        },
      });
    }

    if (kind === 'snippet' || kind === 'command') {
      actions.push({ key: `div-assign-0`, divider: true });

      const compoundId = getItemCompoundId(item);
      const currentShortcut = shortcutsMap[compoundId];
      actions.push({
        key: 'assign-shortcut',
        label: currentShortcut ? `Assign command (${currentShortcut})` : 'Assign command',
        icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingShortcutFor(compoundId);
          setEditingHotkeyFor(null);
          const displayValue = currentShortcut ? currentShortcut.replace(/^\//, '') : '';
          setEditValue(displayValue);
          setIsUpdatingShortcut(!!currentShortcut);
          setSaveError(null);
        },
      });

      const currentHotkey = hotkeysMap[compoundId];
      actions.push({
        key: 'assign-hotkey',
        label: currentHotkey ? `Assign hotkey (${currentHotkey})` : 'Assign hotkey',
        icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingHotkeyFor(compoundId);
          setEditingShortcutFor(null);
          setEditValue(currentHotkey || '');
          setIsUpdatingHotkey(!!currentHotkey);
          setSaveError(null);
        },
      });
    }

    if (kind === 'bookmark') {
      const compoundId = getItemCompoundId(item);
      const currentHotkey = hotkeysMap[compoundId];

      actions.push({ key: `div-bookmark-0`, divider: true });

      actions.push({
        key: 'assign-hotkey',
        label: currentHotkey ? `Assign hotkey (${currentHotkey})` : 'Assign hotkey',
        icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingHotkeyFor(compoundId);
          setEditingShortcutFor(null);
          setEditValue(currentHotkey || '');
          setIsUpdatingHotkey(!!currentHotkey);
          setSaveError(null);
        },
      });
    }

    return actions;
  };

  if (!state || !state.suggestions) {
    return null;
  }

  const query = (state.value || '').trim();

  // When query is empty OR slash mode is active, build items directly from Redux.
  // Slash mode must bypass state.suggestions because the Searchbar filters suggestions
  // using the raw text (e.g. '/L'), which matches nothing and returns 0 results.
  const isSlashModeActive = query.startsWith('/');
  let sourceItems: SuggestionListItem[];
  if (query.length === 0 || isSlashModeActive) {
    // Build from Redux allData directly
    const reduxItems: SuggestionListItem[] = [];
    const teams = (allData as any[]) || [];
    teams.forEach((team: any) => {
      (team.workspaces || []).forEach((ws: any) => {
        (ws.workspace_snippets || []).forEach((snippet: any) => {
          if (!snippet.is_todo_type && snippet.category !== 'task') {
            reduxItems.push({ _kind: 'snippet', snippet, workspace: ws, folder: null } as any);
          }
        });
        (ws.folders || []).forEach((folder: any) => {
          (folder.snippets || []).forEach((snippet: any) => {
            if (!snippet.is_todo_type && snippet.category !== 'task') {
              reduxItems.push({ _kind: 'snippet', snippet, workspace: ws, folder } as any);
            }
          });
        });
      });
    });
    // Add all COMMANDS (browser commands, AI, search, etc.)
    commands.forEach((cmd: any) => {
      reduxItems.push({
        _kind: 'command',
        commandType: 'remote',
        id: cmd.id,
        label: cmd.label,
        prefix: cmd.prefix,
        command: cmd,
      } as any);
    });
    // Add LOCAL_COMMANDS (Create Notes, Create Links, Dashboard, etc.)
    LOCAL_COMMANDS.forEach((cmd: any) => {
      reduxItems.push({
        _kind: 'command',
        commandType: 'local',
        id: cmd.id,
        label: cmd.label,
        prefix: cmd.prefix,
        command: cmd,
      } as any);
    });

    if (chromeBookmarks.length > 0) {
      reduxItems.push(...chromeBookmarks);
    } else {
      const fallbackSuggestions = unfilteredSuggestions.length > 0 ? unfilteredSuggestions : state.suggestions || [];
      fallbackSuggestions.forEach((item: any) => {
        const kind = item._kind || item.type;
        if (kind === 'bookmark') {
          reduxItems.push(item);
        }
      });
    }

    // Add todos — show ALL non-done todos in Board View so nothing is hidden
    
    const mappedTodos = todosList
      .filter(t => {
        if (t.is_done) {
          
          return false;
        }
        // Include the task — Board View shows everything (today, scheduled, anytime)
        
        return true;
      })
      .map(t => ({
        ...t,
        _kind: 'todo',
        type: 'todo',
        is_todo_type: true
      }));
    
    reduxItems.push(...(mappedTodos as any));

    // If Redux has data, use it; otherwise fall back to unfilteredSuggestions cache
    sourceItems = reduxItems.length > 0 ? reduxItems : (unfilteredSuggestions.length > 0 ? unfilteredSuggestions : state.suggestions || []);
  } else {
    // Filter chrome bookmarks by query
    const lowerQuery = query.toLowerCase();
    const filteredBookmarks = chromeBookmarks.filter(b => 
      (b.title && b.title.toLowerCase().includes(lowerQuery)) || 
      (b.url && b.url.toLowerCase().includes(lowerQuery))
    );
    sourceItems = [...state.suggestions, ...filteredBookmarks];
  }

  const handleCreateItem = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    switch (groupKey) {
      case 'notes':
        dispatch(navigateToView({ kind: 'noteEditor', noteProps: { category: 'note' } }));
        dispatch(setIsCreatingNewItem(true));
        break;
      case 'snippets':
        dispatch(navigateToView({ kind: 'noteEditor', noteProps: { category: 'snippet' } }));
        dispatch(setIsCreatingNewItem(true));
        break;
      case 'prompts':
        dispatch(navigateToView({ kind: 'promptEditor' }));
        dispatch(setIsCreatingNewItem(true));
        break;
      case 'links':
        dispatch(navigateToView({ kind: 'linkEditor' }));
        dispatch(setIsCreatingNewItem(true));
        break;
      case 'todos':
        dispatch(setTodoCreatePrefill({ isCreateModalOnly: true } as any));
        break;
    }
  };

  const filteredAllItems = sourceItems.filter(item => {
    const kind = (item as any)._kind || (item as any).type;
    return !['history', 'ai_history', 'automation', 'open_url', 'math_result', 'time_result'].includes(kind);
  });

  // Define our groups
  const groups = {
    todos: { title: 'Todos', items: [] as SuggestionListItem[], icon: <BsCalendarCheck size={16} className="text-[var(--color-iconDefault)]" /> },
    notes: { title: 'Notes', items: [] as SuggestionListItem[], icon: <NotesIcon className="w-4 h-4 shrink-0" /> },
    snippets: { title: 'Snippets', items: [] as SuggestionListItem[], icon: <FaCode size={16} /> },
    prompts: { title: 'Prompts', items: [] as SuggestionListItem[], icon: <FaFlag size={16} /> },
    links: { title: 'Links', items: [] as SuggestionListItem[], icon: <FaLink size={16} /> },
    commands: { title: 'Commands', items: [] as SuggestionListItem[], icon: <FaTerminal size={16} /> },
    bookmarks: { title: 'Bookmarks', items: [] as SuggestionListItem[], icon: <FaBookmark size={16} /> },
    automations: { title: 'Automations', items: [] as SuggestionListItem[], icon: <FiZap size={16} className="text-amber-400" /> },
  };

  filteredAllItems.forEach(item => {
    const kind = (item as any)._kind || (item as any).type;
    if (kind === 'snippet') {
      const cat = ((item as any).snippet?.category || '').toLowerCase();
      if (cat === 'prompt') groups.prompts.items.push(item);
      else if (['link', 'links', 'quicklink', 'biolink', 'tabgroup'].includes(cat)) groups.links.items.push(item);
      else if (cat === 'snippet') groups.snippets.items.push(item);
      else groups.notes.items.push(item);
    } else if (['command', 'agent_collection', 'common_command', 'module', 'aggregate'].includes(kind)) {
      groups.commands.items.push(item);
    } else if (kind === 'bookmark') {
      groups.bookmarks.items.push(item);
    } else if (kind === 'todo') {
      groups.todos.items.push(item);
    } else if (kind === 'automation' || kind === 'agent' || kind === 'module') {
      groups.automations.items.push(item);
    } else if (
      kind === 'history' ||
      kind === 'ai_history' ||
      kind === 'open_url' ||
      kind === 'math_result' ||
      kind === 'time_result'
    ) {
      // Intentionally empty: hide these from the Board View entirely
    } else if (['workspace', 'folder', 'folder_search'].includes(kind)) {
      groups.notes.items.push(item); // Folders make most sense in notes/snippets
    } else {
      groups.notes.items.push(item); // fallback
    }
  });



  const getTitle = (item: any): string => {
    const kind = item._kind || (item as any).type;
    if (kind === 'todo') return item.key || item.title || item.name || 'Todo';
    if (kind === 'command' || kind === 'common_command') return item.label || item.command?.label || 'Command';
    if (kind === 'aggregate') return item.label || 'All AI Chat Agents';
    if (kind === 'snippet') return item.snippet?.key || 'Snippet';
    if (kind === 'bookmark') return item.title || item.url || 'Link';
    if (kind === 'open_url') return item.displayUrl || item.url || 'Open URL';
    if (kind === 'workspace') return item.workspace?.workspace_name || 'Workspace';
    if (kind === 'folder') return item.folder?.folder_name || 'Folder';
    if (kind === 'automation') return item.automation?.name || item.title || 'Automation';
    if (kind === 'module') return item.module?.name || item.module?.module_key || 'Module';
    if (kind === 'agent_collection') return item.title || 'Agent Collection';
    return 'Untitled';
  };

  const getSuggestionLabel = (item: any) => {
    const kind = item._kind || (item as any).type;
    if (kind === 'todo') return 'Todo';
    if (kind === 'command' || kind === 'aggregate' || kind === 'common_command') return 'Command';
    if (kind === 'snippet') {
      const cat = (item.snippet?.category || '').toLowerCase();
      if (['link', 'links', 'quicklink', 'biolink', 'biolinks'].includes(cat)) return 'Links';
      if (cat === 'prompt') return 'Prompt';
      if (cat === 'tabgroup' || cat === 'tab group') return 'Link Group';
      if (cat === 'note') return 'Snippet';
      return 'Notes';
    }
    if (kind === 'bookmark') return 'Bookmark';
    if (kind === 'automation') return 'Automation';
    if (kind === 'agent_collection') return 'Agent Collection';
    return 'Search';
  };

  const getDesc = (item: any): string => {
    const kind = item._kind || (item as any).type;
    if (kind === 'todo') {
      const dueLabel = getTodoDueLabel(item);
      let val = '';
      if (typeof item.value === 'string') {
        val = item.value.replace(/<[^>]+>/g, '').trim();
      }
      if (dueLabel && val) {
        return `${dueLabel} • ${val}`;
      }
      return dueLabel || val || '';
    }
    if (kind === 'command' || kind === 'common_command') return item.description || '';
    if (kind === 'snippet') {
      if (item.snippet?.description) return item.snippet.description;
      if (typeof item.snippet?.value === 'string') return item.snippet.value.replace(/<[^>]+>/g, '').trim();
      return '';
    }
    if (kind === 'bookmark') return item.url || '';
    if (kind === 'open_url') return item.url || '';
    if (item.description) return item.description;
    return '';
  };

  const getSnippetAllUrls = (snippet: any): string[] => {
    if (!snippet) return [];
    let urls: string[] = [];
    if (typeof snippet.value === 'string') {
      const raw = snippet.value as string;
      try {
        const parsed = JSON.parse(raw || '{}');
        if (parsed && parsed.urls && Array.isArray(parsed.urls)) urls = parsed.urls as string[];
        else if (raw.startsWith('http')) urls = [raw];
      } catch {
        if (raw.startsWith('http')) urls = [raw];
      }
    } else if (snippet && snippet.value && typeof snippet.value === 'object' && 'urls' in (snippet.value as any)) {
      urls = ((snippet.value as any).urls || []) as string[];
    }
    return urls;
  };

  const renderTodoMetadata = (item: any, isFocused: boolean) => {
    if (!item.event_deadline) {
      if (item.is_anytime) {
        return (
          <span className={clsx("text-[11px] font-medium transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
            Anytime
          </span>
        );
      }
      const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';
      if (!val) return null;
      return (
        <span className={clsx("text-[11px] truncate transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
          {val}
        </span>
      );
    }

    const d = new Date(item.event_deadline.replace(' ', 'T'));
    if (isNaN(d.getTime())) {
      const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';
      return (
        <span className={clsx("text-[11px] truncate transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
          {item.is_anytime ? 'Anytime' : ''}{val ? ` • ${val}` : ''}
        </span>
      );
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const isOverdue = !item.is_done && d.getTime() < now.getTime() && (dDate.getTime() < startOfToday.getTime() || (item.event_deadline && item.event_deadline.includes(':')));

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let dateStr = '';

    if (dDate.getTime() === startOfToday.getTime()) {
      dateStr = 'Today';
    } else if (dDate.getTime() === startOfTomorrow.getTime()) {
      dateStr = 'Tomorrow';
    } else if (d.getFullYear() >= 2035) {
      dateStr = 'Anytime';
    } else {
      dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    const isRecurring = !!(item.is_recurring || item.recurring);
    const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';

    return (
      <div className="flex flex-col min-w-0 w-full text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOverdue ? (
            <span className={clsx("font-semibold", isFocused ? "text-neutral-300" : "text-neutral-500")}>
              {dateStr}, {timeStr} ({(() => {
                const diffMs = now.getTime() - d.getTime();
                const diffMins = Math.floor(diffMs / (60 * 1000));
                const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
                const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                if (diffMins < 60) return `${diffMins}m overdue`;
                if (diffHrs < 24) return `${diffHrs}h overdue`;
                return `${diffDays}d overdue`;
              })()})
            </span>
          ) : (
            <span className={clsx("font-semibold", isFocused ? "text-neutral-300" : "text-neutral-500")}>
              {dateStr === 'Anytime' ? 'Anytime' : `${dateStr}, ${timeStr}`}
            </span>
          )}
          {isRecurring && (
            <span className="text-emerald-500 dark:text-emerald-400 font-medium">
              • Recurring
            </span>
          )}
        </div>
        {val && (
          <span className={clsx("truncate mt-0.5 transition-colors", isFocused ? "text-neutral-300" : "text-neutral-500")}>
            {val}
          </span>
        )}
      </div>
    );
  };

  const handleToggleTodo = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const sid = String(item.id || item.snippet_id || item.todo_id);
    const newStatus = !item.is_done;
    const chromeAny = (window as any)?.chrome;

    // 1. Optimistic state update in BoardView
    setTodosList(prev => prev.map(t => {
      if (String(t.id || t.snippet_id || t.todo_id) === sid) {
        return { ...t, is_done: newStatus };
      }
      return t;
    }));

    // 2. Update Chrome Local Storage (local_todos & cached_todos)
    if (chromeAny?.storage?.local) {
      try {
        const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve));
        const localTodos = result.local_todos || [];
        const cachedTodos = result.cached_todos || [];

        let localUpdated = localTodos.map((t: any) =>
          String(t.id || t.snippet_id || t.todo_id) === sid ? { ...t, is_done: newStatus, updated_at: new Date().toISOString() } : t
        );
        let cachedUpdated = cachedTodos.map((t: any) =>
          String(t.id || t.snippet_id || t.todo_id) === sid ? { ...t, is_done: newStatus, updated_at: new Date().toISOString() } : t
        );

        await new Promise<void>(resolve => chromeAny.storage.local.set({
          local_todos: localUpdated,
          cached_todos: cachedUpdated
        }, resolve));
      } catch (err) {
        console.warn('[BoardView] Failed to update local storage for todo:', err);
      }
    }

    // 3. Sync to Cloud
    try {
      if (sid && !sid.startsWith('local-')) {
        await updateTodoStatus(sid, newStatus, selectedTeam?.storageMode);
      }
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (err) {
      console.warn('[BoardView] Failed to toggle todo status in cloud:', err);
      // Revert states on error
      setTodosList(prev => prev.map(t => {
        if (String(t.id || t.snippet_id || t.todo_id) === sid) {
          return { ...t, is_done: !newStatus };
        }
        return t;
      }));
      if (chromeAny?.storage?.local) {
        try {
          const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve));
          const localTodos = result.local_todos || [];
          const cachedTodos = result.cached_todos || [];
          let localUpdated = localTodos.map((t: any) =>
            String(t.id || t.snippet_id || t.todo_id) === sid ? { ...t, is_done: !newStatus } : t
          );
          let cachedUpdated = cachedTodos.map((t: any) =>
            String(t.id || t.snippet_id || t.todo_id) === sid ? { ...t, is_done: !newStatus } : t
          );
          await new Promise<void>(resolve => chromeAny.storage.local.set({
            local_todos: localUpdated,
            cached_todos: cachedUpdated
          }, resolve));
        } catch (storageErr) {
          console.warn('[BoardView] Failed to revert local storage for todo:', storageErr);
        }
      }
    }
  };

  const renderIcon = (item: any) => {
    const kind = item._kind || (item as any).type;

    if (kind === 'todo') {
      return (
        <div
          className="w-full h-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTodo(e, item);
          }}
        >
          {item.is_done ? (
            <FaCheckCircle className="text-emerald-500 w-[18px] h-[18px] drop-shadow-sm" />
          ) : (
            <FaRegCircle className="text-[var(--color-iconDefault)] w-[18px] h-[18px]" />
          )}
        </div>
      );
    }

    if (kind === 'command' || kind === 'common_command') {
      const iconHost = item.command?.iconHost;
      if (iconHost)
        return (
          <img
            src={getFaviconUrl(iconHost)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaTerminal className="text-[var(--color-iconDefault)]" size={16} />;
    }
    if (kind === 'aggregate' || kind === 'agent_collection')
      return <FaLayerGroup className="text-[var(--color-iconDefault)]" size={16} />;

    if (kind === 'snippet') {
      const category = (item.snippet?.category || '').toLowerCase();
      const isTabGroup = category === 'tabgroup' || category === 'tab group';
      const urls = getSnippetAllUrls(item.snippet);

      if (isTabGroup && urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center w-8">
            {urls.slice(0, 3).map((url, i) => (
              <div
                key={`tabgroup-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }

      const firstUrl = urls[0];
      if (firstUrl && ['link', 'links', 'quicklink', 'biolink', 'biolinks'].includes(category)) {
        return (
          <img
            src={getFaviconUrl(firstUrl)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      }
      if (category === 'prompt') return <LuSparkles className="text-emerald-400" size={16} />;
      if (['link', 'links', 'quicklink', 'biolink', 'biolinks'].includes(category))
        return <FaLink className="text-blue-400" size={16} />;
      return <NotesIcon className="text-amber-400" size={16} />;
    }

    if (kind === 'bookmark' || kind === 'open_url') {
      const targetUrl = kind === 'open_url' ? item.url?.split(',')[0] : item.url;
      if (targetUrl)
        return (
          <img
            src={getFaviconUrl(targetUrl)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaLink className="text-[var(--color-iconDefault)]" size={16} />;
    }

    if (kind === 'automation') return <FaRobot className="text-purple-400" size={16} />;
    if (kind === 'module') {
      const iconHost = item.module?.icon_host || item.module?.parent_icon_host;
      if (iconHost)
        return (
          <img
            src={getFaviconUrl(iconHost)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaRobot className="text-purple-400" size={16} />;
    }

    return <FaSearch className="text-[var(--color-iconDefault)]" size={16} />;
  };

  // Define strict priority and default arrays
  const orderedKeys = ['todos', 'notes', 'links', 'commands', 'bookmarks', 'snippets', 'prompts', 'automations'] as const;
  const finalKeys = [...orderedKeys];
  const activeGroups = finalKeys.map(k => (groups as any)[k]);

  const executeTodoItem = async (todo: any, e?: React.MouseEvent | KeyboardEvent) => {
    if (todo.is_done) return;

    const chromeAny = (window as any)?.chrome;
    const { category, value, snippet_id } = todo;
    const cat = (category || (todo as any).snippet_category || '').toLowerCase();

    // Helper to extract URLs
    const extractUrls = (val: any) => {
      let urls: string[] = [];
      try {
        if (typeof val === 'object' && val !== null) {
          if (val.urls) urls = val.urls;
          else if (val.url) urls = [val.url];
        } else if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
          const parsed = JSON.parse(val || '{}');
          urls = parsed.urls || (val.startsWith('http') ? [val] : []);
        } else if (typeof val === 'string' && val.startsWith('http')) {
          urls = [val];
        }
      } catch (err) {
        if (val && typeof val === 'string' && val.startsWith('http')) {
          urls = [val];
        }
      }
      return urls;
    };

    let skipToggle = false;

    // A. Check if this is a config-based multi-item todo
    const configIds = todo.config?.id;
    if (Array.isArray(configIds) && configIds.length > 0) {
      for (const cid of configIds) {
        const cidStr = String(cid);
        const matched = finalConvertibleItems.find(item => {
          const itemIdStr = String(item.id);
          if (itemIdStr === cidStr) return true;
          const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-)/, '');
          const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');
          return strippedItemId === strippedCid;
        });

        if (matched) {
          const itemCat = (matched.category || '').toLowerCase();
          const itemId = matched.id;
          const itemVal = matched.data?.value || matched.data?.url || matched.data?.link || '';
          if (['link', 'tabgroup', 'tab group', 'links', 'quicklink', 'collection', 'agent_collection'].includes(itemCat)) {
            extractUrls(itemVal).forEach(url => chromeAny?.tabs?.create({ url }));
          } else if (['note', 'snippet', 'prompt', 'custom'].includes(itemCat)) {
            chromeAny?.tabs?.create({
              url: chromeAny.runtime.getURL(
                `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`,
              ),
            });
          } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent'].includes(itemCat)) {
            chromeAny?.tabs?.create({
              url: chromeAny.runtime.getURL(
                `new-tab/index.html?trigger_hotkey=true&type=${itemCat}&id=${encodeURIComponent(itemId)}`,
              ),
            });
          }
        }
      }
    } else if (['link', 'tabgroup', 'tab group', 'links', 'quicklink', 'collection', 'agent_collection'].includes(cat)) {
      extractUrls(value).forEach(url => chromeAny?.tabs?.create({ url }));
    } else if (['note', 'snippet', 'prompt'].includes(cat)) {
      let matchedSnippetItem = null;
      if (allData && snippet_id) {
        for (const team of allData) {
          for (const ws of (team.workspaces || [])) {
            const found = (ws.workspace_snippets || []).find((s: any) => String(s.id || s.snippet_id) === String(snippet_id));
            if (found) {
              matchedSnippetItem = { snippet: found, workspace: ws };
              break;
            }
            const foundFolderSnippet = (ws.folders || []).flatMap((f: any) => f.snippets || []).find((s: any) => String(s.id || s.snippet_id) === String(snippet_id));
            if (foundFolderSnippet) {
              matchedSnippetItem = { snippet: foundFolderSnippet, workspace: ws };
              break;
            }
          }
          if (matchedSnippetItem) break;
        }
      }
      if (matchedSnippetItem && state?.onSnippetSelect) {
        state.onSnippetSelect({
          snippet: matchedSnippetItem.snippet,
          workspace: matchedSnippetItem.workspace,
          folder: null
        } as any);
      } else if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
        chromeAny.tabs.create({
          url: chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippet_id)}`),
        });
      }
      skipToggle = true; // Don't toggle done when opening note/snippet editor
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent', 'custom'].includes(cat)) {
      const triggerId = value || snippet_id;
      if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
        if (cat === 'custom') {
          chromeAny.tabs.create({
            url: chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(triggerId)}`),
          });
        } else {
          chromeAny.tabs.create({
            url: chromeAny.runtime.getURL(`new-tab/index.html?trigger_hotkey=true&type=${cat}&id=${encodeURIComponent(triggerId)}`),
          });
        }
      }
    }

    if (!skipToggle) {
      const syntheticEvent = {
        stopPropagation: () => { },
        preventDefault: () => { },
      } as any;
      await handleToggleTodo(syntheticEvent, todo);
    }
  };

  const executeItem = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const isCtrl = e && 'ctrlKey' in e && (e.ctrlKey || e.metaKey);
    const chromeAny = (window as any)?.chrome;
    const kind = item._kind || (item as any).type;

    if (kind === 'todo') {
      executeTodoItem(item, e);
      return;
    }

    if (kind === 'snippet') {
      const category = (item.snippet?.category || '').toLowerCase();
      const urls = getSnippetAllUrls(item.snippet);

      if (isCtrl) {
        if (urls.length > 0) {
          urls.forEach(url => {
            if (url.startsWith('note:')) {
              const sid = url.substring(5);
              if (chromeAny?.runtime?.getURL) {
                chromeAny.tabs.create({
                  url: chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`),
                  active: false,
                });
              }
            } else if (url.startsWith('agent_chat?id=')) {
              const agentId = url.split('id=')[1];
              if (chromeAny?.runtime?.getURL) {
                chromeAny.tabs.create({
                  url: chromeAny.runtime.getURL(
                    `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                  ),
                  active: false,
                });
              }
            } else {
              chromeAny?.tabs?.create({ url, active: false });
            }
          });
        } else {
          const sid = item.snippet?.snippet_id || item.snippet?.id;
          if (sid && chromeAny?.runtime?.getURL) {
            chromeAny.tabs.create({
              url: chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`),
              active: false,
            });
          }
        }
        return;
      }

      if (category === 'snippet' || category === 'note' || category === 'notes' || category === 'prompt') {
        if (state?.onSnippetSelect) {
          state.onSnippetSelect(item);
        }
        return;
      }

      // Handle links, tabgroups, etc. by opening URLs
      if (urls.length > 0 && state?.onRequestOpenUrls) {
        state.onRequestOpenUrls(urls, item.snippet?.key);
      } else if (state?.onSnippetSelect) {
        // Fallback if no URLs parsed
        state.onSnippetSelect(item);
      }
    } else if (['workspace', 'folder', 'folder_search'].includes(kind)) {
      if (isCtrl) return;
      const folder = item.folder;
      const workspace = item.workspace;
      if (!workspace) return; // Need workspace at minimum

      const isWorkspaceEntry = kind === 'workspace' || item.entryType === 'workspace' || !folder;

      if (expandedWorkspaces && !expandedWorkspaces[workspace.workspace_id]) {
        dispatch(expandAllWorkspaces({ ...expandedWorkspaces, [workspace.workspace_id]: true }));
      }
      dispatch(setSelectedWorkspace(workspace));

      if (isWorkspaceEntry) {
        dispatch(setSelectedFolder(null));
        dispatch(setSelectedSnippet(null));
        dispatch(setIsCreatingNewItem(false));
        dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: null,
            folder_name: null,
          }),
        );
      } else if (folder) {
        dispatch(setSelectedFolder(folder));
        dispatch(setSelectedSnippet(null));
        dispatch(setIsCreatingNewItem(false));
        dispatch(
          setSnippetBreadCrum({
            workspace_id: workspace.workspace_id,
            workspace_name: workspace.workspace_name,
            folder_id: folder.folder_id,
            folder_name: folder.folder_name,
          }),
        );
      }
    } else if ((kind === 'command' || kind === 'common_command' || kind === 'aggregate') && state?.onCommandMouseDown) {
      if (isCtrl) {
        if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
          const extUrl = chromeAny.runtime.getURL(`new-tab/index.html?lock_command=${encodeURIComponent(item.id)}`);
          chromeAny.tabs.create({ url: extUrl, active: false });
        }
        return;
      }
      state.onCommandMouseDown(e as any, item.id);
    } else if (kind === 'bookmark' || kind === 'open_url') {
      const urlsToOpen = item.url ? item.url.split(',').filter(Boolean) : [];
      if (isCtrl) {
        urlsToOpen.forEach((url: string) => {
          chromeAny?.tabs?.create({ url, active: false });
        });
        return;
      }
      if (state?.onRequestOpenUrls) {
        if (urlsToOpen.length > 0) {
          state.onRequestOpenUrls(urlsToOpen, item.title || item.displayUrl);
        }
      }
    } else if (kind === 'automation' && state?.onAutomationSelect) {
      if (isCtrl) return;
      state.onAutomationSelect(item.automation);
    } else if (kind === 'module' && state?.onModuleSelect) {
      if (isCtrl) return;
      state.onModuleSelect(item.module);
    } else if (kind === 'agent_collection' && state?.onAgentCollectionSelect) {
      if (isCtrl) return;
      state.onAgentCollectionSelect(item);
    }
  };

  const handleStartSession = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const snippet = item.snippet;
    if (!snippet) return;

    const sessionId = snippet.snippet_id || snippet.id;
    const sessionName = snippet.key || snippet.name || snippet.title || 'Untitled Session';
    const workspaceId = snippet.workspace_id || defaultWorkspaceId;
    const folderId = snippet.folder_id || null;

    let initialUrls: string[] = [];
    let initialNames: string[] = [];
    try {
      const parsed = typeof snippet.value === 'string' ? JSON.parse(snippet.value) : snippet.value;
      if (Array.isArray(parsed)) {
        initialUrls = parsed.map((l: any) => l.url || l);
        initialNames = parsed.map((l: any) => l.name || '');
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
        if (Array.isArray(parsed.names)) initialNames = parsed.names;
      }
    } catch (err) { }

    if (initialUrls.length === 0) {
      initialUrls = getSnippetAllUrls(snippet);
    }

    // Save prefill to local storage perfectly mimicking create session
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({
        pending_session_prefill: {
          title: sessionName,
          sessionId: sessionId,
        }
      }, () => resolve());
    });

    chrome.runtime.sendMessage({
      action: 'start_session',
      sessionId,
      sessionName,
      workspaceId,
      folderId: folderId || null,
      teamId: selectedTeam?.team_id,
      storageMode: selectedTeam?.storageMode ?? 'cloud',
      initialUrls,
      initialNames,
    }, (response) => {
      // Show a toast / notification
      const toastId = `boardview-session-toast-${Date.now()}`;
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.textContent = `🚀 Session "${sessionName}" started`;
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:8px 20px;border-radius:20px;z-index:2147483647;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
      document.body.appendChild(toast);
      setTimeout(() => { toast.remove(); }, 2500);
    });
  };



  // Click outside or ESC to close context menu
  useEffect(() => {
    if (!contextMenuState) return;

    const handleClick = () => setContextMenuState(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuState(null);
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey, { capture: true });

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey, { capture: true });
    };
  }, [contextMenuState]);

  useEffect(() => {
    if (focus[0] >= 0 && focus[1] >= 0) {
      const element = document.getElementById(`board-item-${focus[0]}-${focus[1]}`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [focus]);

  // ── Slash mode integration ────────────────────────────────────────────────

  // Automatically insert space after valid slash shortcut typed
  useEffect(() => {
    const prevVal = prevSearchValueRef.current;
    prevSearchValueRef.current = rawSearchValue;

    if (!rawSearchValue.startsWith('/')) return;

    const isExactlyAlias = Object.keys(SLASH_SECTION_ALIASES).some(
      alias => rawSearchValue.toUpperCase() === `/${alias.toUpperCase()}`
    );

    if (isExactlyAlias) {
      const aliasMatch = rawSearchValue.slice(1).toUpperCase();
      const expectedPrev = `/${aliasMatch} `;
      if (prevVal.toUpperCase() !== expectedPrev) {
        state?.onQueryChange?.(`${rawSearchValue} `);
        requestAnimationFrame(() => {
          focusSearchbarInput();
        });
      }
    }
  }, [rawSearchValue, state]);

  // When a /alias matches, sync the sidebar to that section automatically.
  // Sidebar reflects the slash selection so the left nav stays in step.
  useEffect(() => {
    if (slashMode.activeSection && slashMode.activeSection !== 'all') {
      setSelectedSidebarSection(slashMode.activeSection);
    } else if (slashMode.activeSection === 'all') {
      setSelectedSidebarSection('all');
    }
    // When slash mode is exited (user clears the '/'), reset to 'all'
    if (!slashMode.slashDropdown && !slashMode.activeSection) {
      // Only reset if user cleared the slash prefix entirely
      if (!rawSearchValue.startsWith('/')) {
        setSelectedSidebarSection('all');
      }
    }
  }, [slashMode.activeSection, slashMode.slashDropdown, rawSearchValue]);

  // Keyboard navigation for the slash dropdown
  useEffect(() => {
    if (!slashMode.slashDropdown) return;

    const filterText = rawSearchValue.slice(1).toLowerCase();
    const visibleOptions = Object.keys(SLASH_SECTION_META).filter(name => {
      const alias = SLASH_ALIAS_DISPLAY[name] || '';
      return name.toLowerCase().includes(filterText) || alias.toLowerCase().includes(filterText);
    });

    const handleSlashKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSlashDropdownSelectedIndex(prev => Math.min(prev + 1, visibleOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSlashDropdownSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && slashDropdownSelectedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = visibleOptions[slashDropdownSelectedIndex];
        if (chosen) {
          const alias = SLASH_ALIAS_DISPLAY[chosen] || '';
          state?.onQueryChange?.(`/${alias} `);
          setSlashDropdownSelectedIndex(-1);
          requestAnimationFrame(() => {
            focusSearchbarInput();
          });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        state?.onQueryChange?.('');
        setSlashDropdownSelectedIndex(-1);
      }
    };

    window.addEventListener('keydown', handleSlashKey, { capture: true });
    return () => window.removeEventListener('keydown', handleSlashKey, { capture: true });
  }, [slashMode.slashDropdown, rawSearchValue, slashDropdownSelectedIndex, state]);

  // When slash mode is active, re-filter board items using the slash searchQuery
  // (e.g. /n google → filter notes by "google")
  const slashSearchQuery = slashMode.searchQuery;

  // Override the activeGroups items with slash search query filtering
  const finalGroupsBase = (() => {
    if (!slashSearchQuery.trim()) return activeGroups;
    const lower = slashSearchQuery.toLowerCase();
    return activeGroups.map(g => ({
      ...g,
      items: g.items.filter((item: any) => {
        const t = getTitle(item).toLowerCase();
        const d = getDesc(item).toLowerCase();
        return t.includes(lower) || d.includes(lower);
      }),
    }));
  })();
  // ─────────────────────────────────────────────────────────────────────────

  // ESC to clear search globally when active, as long as context menus aren't open
  useEffect(() => {
    const handleEscToClear = (e: KeyboardEvent) => {
      // If pressing ESC while search is active, and no other local modals are blocking it
      if (e.key === 'Escape' && !contextMenuState && !slashMode.slashDropdown && !todoCreatePrefill) {
        if (rawSearchValue) {
          e.preventDefault();
          e.stopPropagation();
          state?.onQueryChange?.('');
        } else if (onClose) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscToClear, { capture: true });
    return () => window.removeEventListener('keydown', handleEscToClear, { capture: true });
  }, [rawSearchValue, state, contextMenuState, slashMode.slashDropdown, todoCreatePrefill, onClose]);

  // Filter the active groups based on the selected sidebar section.
  // Rules:
  //  - slashDropdown open (only '/' typed) → show ALL columns behind the picker
  //  - slash alias matched (e.g. '/L') → show only that column
  //  - normal sidebar click → use selectedSidebarSection


  const finalGroups =
    effectiveSidebarSection === 'all'
      ? finalGroupsBase
      : finalGroupsBase.filter(g => g.title.toLowerCase() === effectiveSidebarSection);

  // Automatically focus the first available result item when query changes or result set updates
  const groupItemCounts = useMemo(() => finalGroups.map(g => g.items.length).join(','), [finalGroups]);

  useEffect(() => {
    let firstValidCol = -1;
    for (let c = 0; c < finalGroups.length; c++) {
      if (finalGroups[c].items.length > 0) {
        firstValidCol = c;
        break;
      }
    }
    if (firstValidCol !== -1) {
      setFocus([firstValidCol, 0]);
    } else {
      setFocus([-1, -1]);
    }
  }, [rawSearchValue, groupItemCounts]);


  useEffect(() => {
    if (finalGroups.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        state?.isAtMenuOpen ||
        state?.isPromptMenuOpen ||
        state?.isContextualPopupOpen ||
        state?.showAIHistoryPanel ||
        slashMode.slashDropdown
      ) {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        let [col, row] = focus;

        if (col < 0 || col >= finalGroups.length) col = 0;
        if (row < 0 || row >= finalGroups[col].items.length) row = 0;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          row = Math.min(row + 1, finalGroups[col].items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          row = Math.max(row - 1, 0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          col = Math.min(col + 1, finalGroups.length - 1);
          row = Math.min(row, finalGroups[col].items.length - 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          col = Math.max(col - 1, 0);
          row = Math.min(row, finalGroups[col].items.length - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const item = finalGroups[col].items[row];
          if (item) {
            executeItem(item, e);
          }
        }
        setFocus([col, row]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [finalGroups, focus, state, slashMode.slashDropdown]);

  if (activeGroups.length === 0) {
    return (
      <div className="mx-auto w-full max-w-sm h-full flex flex-col items-center justify-center bg-[var(--color-containerBg)] rounded-xl border border-[#eee8d5] dark:border-white/10 shadow-sm transition-all duration-300 ease-in-out">
        <FaSearch
          size={24}
          className="text-neutral-300 dark:text-neutral-700 mb-2 transition-transform duration-300 hover:scale-110"
        />
        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-600">No suggestions</span>
      </div>
    );
  }

  const SIDEBAR_ITEMS = [
    {
      id: 'all',
      label: 'All',
      icon: (isSelected: boolean) => (
        <svg
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: 'todos',
      label: 'Todos',
      icon: (isSelected: boolean) => (
        <BsCalendarCheck
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-neutral-400' : 'text-neutral-400/70 group-hover:text-neutral-400',
          )}
        />
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: (isSelected: boolean) => (
        <NotesIcon
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-amber-400' : 'text-amber-400/70 group-hover:text-amber-400',
          )}
        />
      ),
    },
    {
      id: 'snippets',
      label: 'Snippets',
      icon: (isSelected: boolean) => (
        <FaCode
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
        />
      ),
    },
    {
      id: 'prompts',
      label: 'Prompts',
      icon: (isSelected: boolean) => (
        <LuSparkles
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-emerald-400' : 'text-emerald-400/70 group-hover:text-emerald-400',
          )}
        />
      ),
    },
    {
      id: 'links',
      label: 'Links',
      icon: (isSelected: boolean) => (
        <FaLink
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-blue-400' : 'text-blue-400/70 group-hover:text-blue-400',
          )}
        />
      ),
    },
    {
      id: 'commands',
      label: 'Commands',
      icon: (isSelected: boolean) => (
        <FaTerminal
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
        />
      ),
    },
    {
      id: 'bookmarks',
      label: 'Bookmarks',
      icon: (isSelected: boolean) => (
        <FaBookmark
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200',
          )}
        />
      ),
    },
    {
      id: 'automations',
      label: 'Automations',
      icon: (isSelected: boolean) => (
        <FiZap
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-amber-400' : 'text-amber-400/70 group-hover:text-amber-400',
          )}
        />
      ),
    },
  ];

  // Slash picker visible options
  const slashPickerFilterText = rawSearchValue.slice(1).toLowerCase();
  const slashPickerOptions = Object.keys(SLASH_SECTION_META).filter(name => {
    const alias = SLASH_ALIAS_DISPLAY[name] || '';
    return name.toLowerCase().includes(slashPickerFilterText) || alias.toLowerCase().includes(slashPickerFilterText);
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] h-full relative">
      {onClose && !slashMode.slashDropdown && (
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 z-[60] p-2 flex items-center justify-center text-red-500 hover:text-red-400 transition-transform hover:scale-110 cursor-pointer"
          title="Close Board View (Esc)"
        >
          <FiX size={22} strokeWidth={2.5} />
        </button>
      )}
      <div className={clsx(
        "w-full h-full flex items-stretch overflow-hidden transition-all duration-300 ease-in-out relative",
        slashMode.slashDropdown ? "bg-transparent border-transparent shadow-none" : "bg-[var(--color-containerBg)] rounded-none border border-white/10 shadow-sm"
      )}>
        {/* Left Sidebar */}
        {!slashMode.slashDropdown && (
          <div className="w-[150px] shrink-0 flex flex-col border-r border-white/5 py-4 px-3 overflow-y-auto hover-scrollbar">
            {SIDEBAR_ITEMS.map(item => {
              const isSelected = effectiveSidebarSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedSidebarSection(item.id);
                    setFocus([0, 0]); // Reset focus when switching tabs
                  }}
                  className={clsx(
                    'flex items-center gap-3 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer w-full text-left mb-1 group',
                    isSelected ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white hover:bg-white/5',
                  )}>
                  <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                    {item.icon(isSelected)}
                  </div>
                  <span className="flex-1 tracking-tight truncate leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Board Content */}
        {!slashMode.slashDropdown && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch gap-0 board-scrollbar transition-all duration-300 ease-in-out">
            <AnimatePresence mode="popLayout">
              {finalGroups.map((group, colIdx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  key={group.title}
                  className="flex flex-col items-start flex-1 min-w-[260px] max-w-[400px] bg-transparent border-r border-white/10 pr-4 pl-4 pt-4 pb-4 last:border-r-0 box-border">
                  {/* Header */}
                  <div className="w-full pb-1 mb-1 justify-between min-h-[32px] shrink-0 flex items-center box-border">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="text-white/80 shrink-0 mr-3 flex items-center justify-center">{group.icon}</div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <h2 className="text-[14px] font-medium text-[var(--color-textPrimary)] tracking-tight leading-tight capitalize truncate flex items-center gap-1.5">
                          {group.title}
                          <span className="text-neutral-500 font-normal">· {group.items.length}</span>
                        </h2>
                      </div>
                    </div>
                    {isLoggedIn && ['todos', 'notes', 'snippets', 'prompts', 'links'].includes(group.title.toLowerCase()) && (
                      <button
                        onClick={e => handleCreateItem(group.title.toLowerCase(), e)}
                        className="shrink-0 p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title={`Create new ${group.title.toLowerCase().slice(0, -1)}`}>
                        <FaPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Cards Scrollable Area */}
                  <div className="flex-1 min-w-0 flex py-1 scroll-smooth box-border flex-col items-center overflow-y-auto overflow-x-hidden w-full gap-0 hide-scrollbar">
                    {group.items.length === 0 ? null : (
                      group.items.map((item: any, idx: number) => {
                        const rawTitle = getTitle(item);
                        const desc = getDesc(item);
                        const isFocused = focus[0] === colIdx && focus[1] === idx;
                        const kind = item._kind || item.type;

                        return (
                          <div
                            key={idx}
                            id={`board-item-${colIdx}-${idx}`}
                            onClick={e => executeItem(item, e)}
                            onContextMenu={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenuState({
                                x: e.clientX,
                                y: e.clientY,
                                item,
                              });
                            }}
                            className="shrink-0 flex flex-col group cursor-pointer box-border relative w-full h-auto min-h-[32px] py-0.5 items-center">
                            <div
                              className={clsx(
                                "rounded-xl transition-all duration-200 overflow-hidden box-border h-full py-2 px-3 w-full flex flex-col justify-center text-left border",
                                isFocused
                                  ? "bg-white/10 shadow-md border-white/10"
                                  : "bg-transparent border-transparent hover:bg-white/5"
                              )}>
                              <div className="flex items-center justify-between min-w-0 w-full gap-2">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                                    {renderIcon(item)}
                                  </div>
                                  <span
                                    className={clsx(
                                      "text-[13px] tracking-tight truncate leading-tight flex-1 min-w-0 font-medium transition-colors duration-200",
                                      isFocused ? "text-white" : "text-neutral-200 group-hover:text-white"
                                    )}>
                                    {highlightMatch(rawTitle, query)}
                                  </span>
                                </div>
                                {group.title.toLowerCase() === 'links' && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartSession(item, e);
                                    }}
                                    className="text-neutral-400 hover:text-white transition-colors duration-150 cursor-pointer z-20 opacity-0 group-hover:opacity-100 mr-1.5"
                                    title="Start Session"
                                  >
                                    <FaLayerGroup size={12} />
                                  </div>
                                )}
                                {group.title === 'All' && (
                                  <div className="shrink-0 bg-white/10 px-1.5 py-0.5 rounded text-[9px] text-neutral-400 capitalize tracking-wider font-medium">
                                    {getSuggestionLabel(item)}
                                  </div>
                                )}
                              </div>
                              {kind === 'todo' ? (
                                <div className="flex flex-col min-w-0 w-full pl-[34px] mt-0.5 gap-0.5">
                                  {renderTodoMetadata(item, isFocused)}
                                </div>
                              ) : desc ? (
                                <div className="flex min-w-0 w-full pl-[34px] mt-0.5">
                                  <span
                                    className={clsx(
                                      "text-[11px] truncate w-full leading-relaxed transition-colors duration-200",
                                      isFocused ? "text-neutral-300" : "text-neutral-500"
                                    )}>
                                    {desc}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {/* end Cards Scrollable Area */}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {/* end Main Board Content */}
      </div>
      {/* end inner overflow-hidden board */}

      {/* ── Slash Category Launcher Dropdown ─────────────────────────────────────
          Outside the overflow-hidden inner board, so it is NEVER clipped.
          left-[150px] skips the sidebar; centered max-w-2xl in the content area.
      ───────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {slashMode.slashDropdown && (
          <>
            {/* Dim backdrop (invisible but catches clicks to close) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute inset-0 z-[65] bg-transparent rounded-xl"
              onClick={() => state?.onQueryChange?.('')}
            />
            {/* Dropdown panel */}
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-[-16px] left-0 right-0 z-[70] flex justify-center px-6 pt-0">
              <div className="w-full max-w-[480px] min-[1600px]:max-w-[540px] min-[1800px]:max-w-2xl max-[1480px]:max-w-[440px] max-[1370px]:max-w-[400px] max-[1270px]:max-w-[360px] bg-[var(--color-containerBg)] border border-white/10 rounded-b-xl rounded-t-none shadow-2xl overflow-hidden flex flex-col">

                {/* Options */}
                <div className="flex flex-col py-1.5">
                  {slashPickerOptions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-neutral-500">No matching categories</div>
                  ) : (
                    slashPickerOptions.map((optName, idx) => {
                      const meta = SLASH_SECTION_META[optName];
                      const alias = SLASH_ALIAS_DISPLAY[optName] || '';
                      const isSelected = slashDropdownSelectedIndex === idx;
                      return (
                        <div
                          key={optName}
                          onClick={() => {
                            state?.onQueryChange?.(`/${alias} `);
                            setSlashDropdownSelectedIndex(-1);
                            requestAnimationFrame(() => {
                              focusSearchbarInput();
                            });
                          }}
                          onMouseEnter={() => setSlashDropdownSelectedIndex(idx)}
                          className={clsx(
                            'mx-2 px-3 py-2 flex items-center justify-between cursor-pointer transition-colors rounded-none',
                            isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white',
                          )}>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center opacity-80">
                              {meta.icon}
                            </div>
                            <span className="text-[13px] font-medium tracking-tight">{meta.title}</span>
                          </div>
                          {alias && (
                            <span
                              className={clsx(
                                'text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold tracking-wider min-w-[34px] text-center',
                                isSelected
                                  ? 'border-white/20 bg-white/10 text-white'
                                  : 'border-white/10 bg-white/5 text-neutral-400',
                              )}>
                              /{alias}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {contextMenuState && (
        <UnifiedContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          onClose={() => {
            setContextMenuState(null);
            handleCancelEdit();
          }}
          actions={buildContextMenuActions(contextMenuState.item)}
          showSearch={!!userId}
          itemId={getItemCompoundId(contextMenuState.item)}
          hotkeyInput={
            editingHotkeyFor && contextMenuState.item
              ? {
                value: editValue,
                onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  const result = captureHotkey(e);
                  if (!result) return;
                  if (result === 'CANCEL') {
                    handleCancelEdit();
                  } else if (result) {
                    setEditValue(result as string);
                    setSaveError(null);
                  }
                },
                onSave: () => saveHotkey(contextMenuState.item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteHotkey,
                isSaving: isSaving,
                isUpdating: isUpdatingHotkey,
                onClear: () => {
                  setEditValue('');
                  saveHotkey(contextMenuState.item, '', false);
                },
              }
              : undefined
          }
          shortcutInput={
            editingShortcutFor && contextMenuState.item
              ? {
                value: editValue,
                onChange: setEditValue,
                onSave: () => saveShortcut(contextMenuState.item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteShortcut,
                isSaving: isSaving,
                isUpdating: isUpdatingShortcut,
              }
              : undefined
          }
          onNavigateAlreadyAssigned={handleGoToConflict}
          error={saveError || undefined}
          conflictId={conflictId}
        />
      )}
    </div>
  );
};

export default BoardView;
