import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FaTimes,
  FaSun,
  FaRegCalendarAlt,
  FaRegCheckCircle,
  FaSyncAlt,
  FaBolt,
  FaRegCircle,
  FaRegClock,
  FaCheck,
  FaBell,
  FaTrash,
  FaLink,
  FaBox,
  FaLayerGroup,
  FaRobot,
  FaCloudDownloadAlt,
  FaStore,
  FaHistory,
  FaDownload,
  FaCog,
  FaPuzzlePiece,
  FaBookmark,
  FaFlag,
  FaCode,
  FaTag,
  FaInfoCircle,
  FaMemory,
  FaMicrochip,
  FaGamepad,
  FaKey,
  FaQuestionCircle,
  FaSearch,
} from 'react-icons/fa';
import {
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
  FiBell,
  FiClock,
  FiStar,
  FiFileText,
  FiSearch,
  FiPlus,
  FiCalendar,
  FiRepeat,
  FiCheckCircle,
  FiCheck,
  FiCheckSquare,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { BsCalendarPlus, BsCheck2Circle, BsCalendarCheck, BsPinAngleFill } from 'react-icons/bs';

import NotesIcon from '../../Shared/Icons/NotesIcon';
import AutomationDynamicIcon from '../../Shared/Icons/AutomationDynamicIcon';
import CmdIcon from '../../Shared/Icons/CmdIcon';
import StackedLinkIcon from '../../Shared/Icons/StackedLinkIcon';
import { getFaviconUrl } from '../../SearchComponents/Searchbar/utils';
import { useAppearance } from '@extension/ui';

import {
  setIsCommandListView,
  setHighlightedCommandId,
  selectTodoCreatePrefill,
  setTodoCreatePrefill,
  setShowTodosView,
  selectSelectedWorkspace,
  selectSelectedTeam,
  setTodoCreateMode,
} from '../../../../../Redux/AllData/uiStateSlice';
import { selectAllData, optimisticAddSnippet } from '../../../../../Redux/AllData/allDataSlice';
import { COMMANDS, AI_GROUP } from '../../SearchComponents/Searchbar/commands';
import { LOCAL_COMMANDS } from '../../SearchComponents/Searchbar/localCommands';
import CreateTodoSelectionView from './CreateTodoSelectionView';
import FullScreenNoteView from '../../Editor/FullScreenNoteView';
import { useSelector, useDispatch } from 'react-redux';
import {
  getUpcomingTodos,
  getOverdueTodos,
  getRecurringTodos,
  updateTodoStatus,
  deleteSnippet,
  createSnippet,
  convertSnippetToTodo,
  convertToTodoWithConfig,
  updateSnippetRealtime,
  editTodo,
  deleteTodo,
} from '../../../../../Apis/features/snippetApi';
import { getAll, getInstalledModules } from '../../../../../Apis/core/api';
import { format, endOfDay, isSameDay, formatDistanceToNow, isToday, isBefore, startOfToday, isTomorrow } from 'date-fns';
import useToast from '@src/components/Shared/Toast/useToast';
import MonthYearCalendar from './MonthYearCalendar';

interface TodoItem {
  snippet_id: string;
  todo_id?: string | number; // Added for precise todo management
  id?: string;
  key: string;
  title?: string;
  value: string;
  category: string;
  snippet_category?: string;
  created_at: string;
  updated_at: string;
  folder_id: string;
  workspace_id: string | null;
  team_id?: string | null;
  is_todo_type: boolean;
  is_recurring: boolean;
  recurring_cycle: string | null;
  event_deadline: string;
  is_done: boolean;
  is_anytime?: boolean;
  iconHost?: string;
  iconHosts?: string[];
  tags?: string[];
  automation_id?: string | number;
  automation_description?: string;
  /** Populated by the config-based creation path; contains the IDs used at creation time. */
  config?: { id: string[] };
}

interface TodosListProps {
  isOpen: boolean;
  onClose: () => void;
  searchbarRef?: React.RefObject<any>;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  isSidebar?: boolean;
  isCreateModalOnly?: boolean;
}

const sections = [
  { id: 'today', label: 'Today', icon: <FiClock size={18} /> },
  { id: 'scheduled', label: 'Scheduled', icon: <BsCalendarCheck size={18} /> },
] as const;

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-0.5">
    {keys.map((key, i) => (
      <React.Fragment key={i}>
        <kbd className="min-w-[1.2rem] h-4 flex items-center justify-center px-1 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[9px] font-bold font-mono">
          {key}
        </kbd>
        {i < keys.length - 1 && <span className="text-[9px] opacity-80 font-bold">+</span>}
      </React.Fragment>
    ))}
  </span>
);

const TodosList: React.FC<TodosListProps> = React.memo(({ isOpen, onClose, searchbarRef, isLoggedIn, onRequireLogin, isSidebar, isCreateModalOnly }) => {
  const { theme } = useAppearance();
  const dispatch = useDispatch();
  const triggerToast = useToast();
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const allData = useSelector(selectAllData);
  const [activeSection, setActiveSection] = useState<
    'today' | 'scheduled' | 'done' | 'one-time' | 'recurring' | 'calendar'
  >('today');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    active: false,
    overdue: false,
    completed: true,
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inlineNoteId, setInlineNoteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  const [createSearchQuery, setCreateSearchQuery] = useState('');
  const todoCreatePrefill = useSelector(selectTodoCreatePrefill);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedTeam = useSelector(selectSelectedTeam);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const activeTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const tasksRef = useRef<TodoItem[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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

  const performPermanentDelete = async (task: TodoItem) => {
    const sid = String(task.snippet_id);
    const chromeAny = (window as any).chrome;
    const targetTodoId = task.todo_id || task.id;
    
    // Remove from local storage
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve));
      const localTodos = result.local_todos || [];
      const cachedTodos = result.cached_todos || [];
      
      const updatedLocal = localTodos.filter((t: any) => {
        const tTodoId = t.todo_id || t.id;
        if (targetTodoId && tTodoId) {
          return String(tTodoId) !== String(targetTodoId);
        }
        return String(t.id || t.snippet_id) !== sid;
      });
      
      const updatedCached = cachedTodos.filter((t: any) => {
        const tTodoId = t.todo_id || t.id;
        if (targetTodoId && tTodoId) {
          return String(tTodoId) !== String(targetTodoId);
        }
        return String(t.snippet_id || t.id) !== sid;
      });
      
      await new Promise<void>(resolve => chromeAny.storage.local.set({
        local_todos: updatedLocal,
        cached_todos: updatedCached
      }, resolve));
    }
    
    // Call API
    try {
      if (task.todo_id) {
        await deleteTodo(task.todo_id as string | number, selectedTeam?.storageMode);
      } else if (sid && !sid.startsWith('local-')) {
        await deleteSnippet(task.folder_id, sid);
      }
    } catch (e) {
      console.error('Permanent delete failed:', e);
    }
    
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: targetTodoId ? String(targetTodoId) : sid });
    }
  };

  useEffect(() => {
    return () => {
      const sids = Object.keys(activeTimeoutsRef.current);
      sids.forEach(sid => {
        clearTimeout(activeTimeoutsRef.current[sid]);
        const t = tasksRef.current.find(item => String(item.snippet_id) === sid);
        if (t) {
          performPermanentDelete(t);
        }
      });
    };
  }, []);

  const listHeight = useMemo(() => {
    const maxAvailable = windowDimensions.height - 180; // Buffer for top offset, search bar, and bottom screen edge
    const desiredHeight = windowDimensions.height * (windowDimensions.width >= 1600 ? 0.60 : 0.50);
    return Math.min(Math.max(desiredHeight, 300), maxAvailable);
  }, [windowDimensions]);

  const rowHeight = useMemo(() => {
    if (windowDimensions.width >= 1600) return 54;
    if (windowDimensions.width >= 1200) return 49;
    return 44;
  }, [windowDimensions]);

  const now = new Date();
  const parseTaskDate = (d: string | undefined) => {
    if (!d) return new Date(0);
    return new Date(String(d).replace(' ', 'T'));
  };

  useEffect(() => {
    dispatch(setTodoCreateMode(isCreateModalOpen));
  }, [isCreateModalOpen, dispatch]);

  const normalizeDeadline = (d: string | undefined): string => {
    if (!d) return '';
    return String(d).replace(' ', 'T').split('.')[0];
  };

  const extractActualId = (id: string): string => {
    if (id.length <= 36) return id;
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const match = id.match(uuidRegex);
    return match ? match[0] : id;
  };

  useEffect(() => {
    if (todoCreatePrefill && isOpen) {
      if (todoCreatePrefill.autoSave) {
        // Automatically save the todo, bypassing the modal
        handleCreateFromSelection({
          type: todoCreatePrefill.category,
          item: todoCreatePrefill,
          title: todoCreatePrefill.key,
          description: todoCreatePrefill.value,
          scheduleType: todoCreatePrefill.is_recurring ? 'recurring' : 'one-time',
          recurringCycle: todoCreatePrefill.recurring_cycle,
          deadline: todoCreatePrefill.event_deadline,
          isAnytime: todoCreatePrefill.is_anytime || false,
        });
        dispatch(setTodoCreatePrefill(null));
      } else {
        setIsCreateModalOpen(true);
      }
    }
  }, [todoCreatePrefill, isOpen]);

  const handleClose = useCallback(() => {
    dispatch(setTodoCreatePrefill(null));
    onClose();
  }, [onClose, dispatch]);

  // Clean up on unmount to prevent modals from reopening unintentionally
  useEffect(() => {
    return () => {
      dispatch(setTodoCreatePrefill(null));
    };
  }, [dispatch]);

  const isDarkMode = document.documentElement.classList.contains('dark');

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const formatDeadline = (deadlineStr: string) => {
    if (!deadlineStr) return '';
    try {
      const date = new Date(deadlineStr.replace(' ', 'T'));
      if (isNaN(date.getTime())) return deadlineStr;

      const now = new Date();
      const diffInMinutes = Math.floor((date.getTime() - now.getTime()) / 60000);

      if (Math.abs(diffInMinutes) < 60) {
        if (diffInMinutes === 0) return 'Just now';
        const unit = Math.abs(diffInMinutes) === 1 ? 'min' : 'mins';
        return diffInMinutes > 0 ? `In ${diffInMinutes} ${unit}` : `${Math.abs(diffInMinutes)} ${unit} ago`;
      }

      if (Math.abs(diffInMinutes) < 24 * 60) {
        return formatDistanceToNow(date, { addSuffix: true });
      }

      return format(date, 'MMM d, h:mm a');
    } catch (e) {
      return deadlineStr;
    }
  };

  const fetchTasks = useCallback(async (forceCloud: boolean = true) => {
    const chromeAny = (window as any).chrome;
    let currentLocalTasks: TodoItem[] = [];

    // 1. Load Local & Cached Tasks for immediate UI responsiveness
    if (chromeAny?.storage?.local) {
      try {
        const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve));
        const localTodos = result.local_todos || [];
        const cachedTodos = result.cached_todos || [];

        currentLocalTasks = localTodos.map((t: any) => ({
          ...t,
          snippet_id: String(t.snippet_id || t.id),
          is_recurring: !!(t.is_recurring || (t as any).recurring),
        }));

        const cachedTasks = cachedTodos.map((t: any) => ({
          ...t,
          snippet_id: String(t.snippet_id || t.id),
          is_recurring: !!(t.is_recurring || (t as any).recurring),
        }));

        if (currentLocalTasks.length > 0 || cachedTasks.length > 0) {
          setTasks(prev => {
            const merged = [...prev, ...cachedTasks, ...currentLocalTasks];
            return Array.from(new Map(merged.map(item => [String(item.snippet_id), item])).values());
          });
        }
      } catch (e) {
        console.warn('[TodosList] Local/Cache fetch failed:', e);
      }
    }

    if (fetchingRef.current) return;

    if (isLoggedIn === false) {
      setIsLoading(false);
      return;
    }

    try {
      // 1.5. Multi-Tab Cooldown Guard (2 hours)
      const storage = await chromeAny.storage.local.get(['last_todo_fetch_timestamp']);
      const lastFetch = storage.last_todo_fetch_timestamp || 0;
      const now = Date.now();
      const isCoolingDown = now - lastFetch < 2 * 60 * 60 * 1000;

      if (!forceCloud && isCoolingDown) {
        setIsLoading(false);
        return;
      }

      fetchingRef.current = true;
      setIsLoading(true);

      // 2. Fetch Cloud Tasks (Unified with RightModal for consistency)
      const [overdueRes, upcomingRes, recurringRes] = await Promise.all([
        getOverdueTodos(),
        getUpcomingTodos(),
        getRecurringTodos(format(new Date(), 'yyyy-MM-dd')),
      ]);

      // After successful cloud fetch, update the timestamp
      await chromeAny.storage.local.set({ last_todo_fetch_timestamp: Date.now() });

      const overdue = Array.isArray(overdueRes)
        ? overdueRes
        : (overdueRes as any)?.todos || (overdueRes as any)?.overdue_todos || [];
      const upcoming = Array.isArray(upcomingRes)
        ? upcomingRes
        : (upcomingRes as any)?.todos || (upcomingRes as any)?.upcoming_todos || [];
      const recurring = Array.isArray(recurringRes)
        ? recurringRes
        : (recurringRes as any)?.todos || (recurringRes as any)?.recurring_todos || [];

      const cloudTasks = [...overdue, ...upcoming, ...recurring].map(s => {
        

        // 1. Identify the best ID (Numeric Todo ID preferred for management)
        const possibleIds = [s.todo_id, s.snippet_todo_id, s.id, s.snippet_id];
        const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));
        const tId = numericId || s.todo_id || s.id || s.snippet_id;

        // 2. Identify the correct Category
        let category = (s.category || s.snippet_category || '').toLowerCase();

        if (s.automation_id) {
          // Check if it's an AI Chat Agent (matching SheetUI/gridStore logic)
          const isAgent = s.is_agent || s.type === 'agent' || s.category === 'agent' || s.category === 'chat_agent';
          category = isAgent ? 'agent' : 'automation';
        } else if (s.command_id) {
          category = 'command';
        } else if (s.installed_module_id || s.module_id) {
          category = 'module';
        }

        if (!category || category === 'custom') category = 'snippet';

        // 3. Recover the correct Title/Key
        const title = s.key || s.title || s.automation_name || s.command_label || s.module_name || 'Untitled Task';
        const description = s.value || s.automation_description || s.module_description || '';

        // Reconstruct the correct prefixed snippet_id to match local_todos/convertibleItems format
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
            console.error('[TodoDebug] Failed to parse s.config JSON:', s.config, e);
          }
        }

        return {
          ...s,
          is_todo_type: true,
          snippet_id: String(computedSnippetId),
          todo_id: tId,
          key: title,
          title: title,
          // We keep the original s.value (which might be the Automation ID) 
          // and let renderDescription handle the display via s.automation_description
          category: category,
          is_recurring: !!(s.is_recurring || s.recurring),
          config: parsedConfig,
        };
      });

      // 3. Robust Merge & Deduplication
      const finalTasksMap = new Map();

      // Add Cloud Tasks first
      cloudTasks.forEach(cloudTask => {
        finalTasksMap.set(String(cloudTask.snippet_id), cloudTask);
      });

      // Merge with Local/Existing tasks to preserve numeric IDs
      currentLocalTasks.forEach(localTask => {
        const localId = String(localTask.snippet_id);

        // If we have a cloud version, check if we need to preserve the ID
        if (finalTasksMap.has(localId)) {
          const cloudTask = finalTasksMap.get(localId);

          const existingIsNumeric = typeof localTask.todo_id === 'number' || (typeof localTask.todo_id === 'string' && !isNaN(Number(localTask.todo_id)) && !localTask.todo_id.includes('-'));
          const cloudIsNumeric = typeof cloudTask.todo_id === 'number' || (typeof cloudTask.todo_id === 'string' && !isNaN(Number(cloudTask.todo_id)) && !cloudTask.todo_id.includes('-'));

          if (existingIsNumeric && !cloudIsNumeric) {
            
            cloudTask.todo_id = localTask.todo_id;
          }
        } else {
          // Add local-only tasks (if not duplicates)
          const localDeadline = normalizeDeadline(localTask.event_deadline);
          const localKey = (localTask.key || '').toLowerCase();
          let isDuplicate = false;
          if (localId.startsWith('local-')) {
            isDuplicate = cloudTasks.some(ct => {
              const cloudDeadline = normalizeDeadline(ct.event_deadline);
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
      setTasks(finalArray);

      // 4. Update Cache (optional but recommended for offline support)
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ cached_todos: finalArray });
      }
    } catch (error) {
      console.error('[TodosList] Cloud fetch failed:', error);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [getOverdueTodos, getUpcomingTodos, getRecurringTodos, isLoggedIn]);

  const filteredTasks = tasks.filter(task => {
    const deadline = parseTaskDate(task.event_deadline);

    if (activeSection === 'today') {
      if (task.is_done) {
        // Only show done tasks if they were completed today
        const completionDate = task.updated_at ? new Date(task.updated_at.replace(' ', 'T')) : deadline;
        return !isNaN(completionDate.getTime()) && isSameDay(completionDate, now);
      }

      // Only hide if it's specifically scheduled for a future day (not today)
      const isFutureDay = !isSameDay(deadline, now) && deadline.getTime() > now.getTime();

      return (
        !isNaN(deadline.getTime()) &&
        !isFutureDay &&
        (isSameDay(deadline, now) ||
          deadline.getTime() < now.getTime() ||
          task.is_anytime ||
          (task.event_deadline && task.event_deadline.substring(0, 4) >= '2035'))
      );
    }
    if (activeSection === 'scheduled') {
      // In the new consolidated view, show both One-time and Recurring tasks that aren't done
      return !task.is_done;
    }
    if (activeSection === 'calendar') {
      return isSameDay(deadline, selectedDate);
    }
    return true;
  });

  const searchFilteredTasks = filteredTasks.filter(task => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const rawTitle = task.key || task.title || '';
    const title = (typeof rawTitle === 'object' ? JSON.stringify(rawTitle) : String(rawTitle)).toLowerCase();
    const cat = (task.category || '').toLowerCase();
    return title.includes(q) || cat.includes(q);
  });

  const activeTasks = searchFilteredTasks
    .filter(t => !t.is_done)
    .sort((a, b) => {
      const parseDate = (d: string) => {
        if (!d) return 0;
        const date = new Date(d.replace(' ', 'T'));
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      return parseDate(a.event_deadline) - parseDate(b.event_deadline);
    });

  const doneTasks = searchFilteredTasks
    .filter(t => t.is_done)
    .sort((a, b) => {
      const parseDate = (d: string) => {
        if (!d) return 0;
        const date = new Date(d.replace(' ', 'T'));
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      return parseDate(b.event_deadline) - parseDate(a.event_deadline);
    });

  const allOrderedTasks = React.useMemo(() => {
    if (activeSection === 'today') {
      const overdueItems = activeTasks.filter(t => {
        const deadlineDate = parseTaskDate(t.event_deadline);
        return deadlineDate.getTime() < now.getTime() && (!isSameDay(deadlineDate, now) || (t.event_deadline && t.event_deadline.includes(':')));
      });
      const todayActiveItems = activeTasks.filter(t => !overdueItems.includes(t));
      return [...todayActiveItems, ...overdueItems, ...doneTasks];
    }
    return [...activeTasks, ...doneTasks];
  }, [activeTasks, doneTasks, activeSection]);

  const counts: Record<string, number> = useMemo(() => {
    return {
      today: activeTasks.filter(t => {
        const d = parseTaskDate(t.event_deadline);
        return isToday(d) || (d.getTime() < now.getTime() && !t.is_done);
      }).length,
      scheduled: activeTasks.length,
      done: doneTasks.length,
      calendar: 0,
    };
  }, [activeTasks, doneTasks, now]);

  const globalOverdueCount = useMemo(() =>
    tasks.filter(t => !t.is_done && parseTaskDate(t.event_deadline).getTime() < now.getTime()).length,
    [tasks, now]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [activeSection, tasks.length, searchQuery]);

  // Initial fetch when opening
  useEffect(() => {
    if (isOpen) {
      fetchTasks(false);
    }
  }, [isOpen, fetchTasks]);
  // Auto-focus search when section changes or when opening
  useEffect(() => {
    if (isOpen && !isCreateModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, activeSection, isCreateModalOpen]);

  useEffect(() => {
    const handleRefresh = () => fetchTasks(false);
    window.addEventListener('todosUpdated', handleRefresh);

    // Listen for background script updates to local storage
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && (changes.local_todos || changes.cached_todos)) {
        // When storage changes, we only need to refresh from local storage, not the cloud
        fetchTasks(false);
      }
    };
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // Remove redundant polling interval to prevent excessive backend load.
    // We now rely on storage changes, todosUpdated events, and component mounting.
    return () => {
      window.removeEventListener('todosUpdated', handleRefresh);
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [fetchTasks]);

  useEffect(() => {
    if (selectedIndex === -1 || !scrollableRef.current) return;
    // Find either a table row or a div with the data-index attribute
    const selectedElement = scrollableRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, activeSection]);

  const handleEdit = (task: TodoItem) => {
    // Robust numeric ID discovery for prefill
    const possibleIds = [task.todo_id, (task as any).id, (task as any).snippet_todo_id];
    const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));

    

    const taskWithId = {
      ...task,
      todo_id: numericId || task.todo_id || task.snippet_id
    };
    dispatch(setTodoCreatePrefill(taskWithId));
  };

  const calculateNextDeadline = (currentDeadline: string, cycle: string | null): string | null => {
    if (!cycle) return null;
    let date = new Date(currentDeadline.replace(' ', 'T'));
    if (isNaN(date.getTime())) return null;

    // If it is a dummy "anytime" year (>= 2035), base the next recurrence on current time
    if (date.getFullYear() >= 2035) {
      date = new Date();
    }

    if (cycle === 'daily') date.setDate(date.getDate() + 1);
    else if (cycle === 'weekly') date.setDate(date.getDate() + 7);
    else if (cycle === 'monthly') date.setMonth(date.getMonth() + 1);
    else return null;

    return date.toISOString();
  };

  const handleToggleDone = async (task: TodoItem) => {
    try {
      const chromeAny = (window as any).chrome;
      const isRecurring = !!(task.is_recurring || (task as any).recurring);
      const isCompleting = !task.is_done;
      const sid = String(task.snippet_id);

      let nextDeadline = task.event_deadline;
      let newDoneStatus = isCompleting;
      let historyTask: TodoItem | null = null;

      if (isCompleting && isRecurring) {
        const calc = calculateNextDeadline(task.event_deadline, task.recurring_cycle);
        if (calc) {
          // 1. Create a "History" task for today's completion
          historyTask = {
            ...task,
            snippet_id: `hist-${Date.now()}`,
            id: `hist-${Date.now()}`,
            is_done: true,
            is_recurring: false, // History item is a one-time record
            event_deadline: task.event_deadline, // Keep original deadline for today's record
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // 2. Move the main task to the next occurrence
          nextDeadline = calc;
          newDoneStatus = false; // Reset to active for next cycle
        }
      }

      // 2. Update Local Storage
      if (chromeAny?.storage?.local) {
        const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
        const localTodos = result.local_todos || [];

        let updated = localTodos.map((t: any) =>
          String(t.snippet_id || t.id) === sid ? { ...t, is_done: newDoneStatus, event_deadline: nextDeadline, updated_at: new Date().toISOString() } : t,
        );

        if (historyTask) {
          updated = [historyTask, ...updated];
        }

        await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
      }

      // 3. Update React State
      setTasks(prev => {
        let updated = prev.map(t =>
          String(t.snippet_id) === sid ? { ...t, is_done: newDoneStatus, event_deadline: nextDeadline, updated_at: new Date().toISOString() } : t,
        );
        if (historyTask) {
          updated = [historyTask, ...updated];
        }
        return updated;
      });

      // 4. Cloud Sync
      if (sid && !sid.startsWith('local-')) {
        if (isRecurring && isCompleting) {
          // For cloud recurring, we move the deadline and keep it active
          await editTodo(task.todo_id || sid, nextDeadline, task.recurring_cycle || undefined, undefined, undefined, true, undefined, undefined, selectedTeam?.storageMode);
          await updateTodoStatus(sid, false, selectedTeam?.storageMode);
        } else {
          await updateTodoStatus(sid, isCompleting, selectedTeam?.storageMode);
        }
      }

      // 5. Alarm Management
      if (chromeAny?.runtime?.sendMessage) {
        if (isCompleting && !isRecurring) {
          chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: sid });
        } else if (isRecurring) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: sid,
            deadline: nextDeadline,
            is_anytime: !!task.is_anytime
          });
        }
      }

      // Silent update
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('Failed to toggle todo status:', error);
      triggerToast('Failed to update task', 'error');
    }
  };

  const handleEditTask = async (task: TodoItem) => {
    // Robust numeric ID discovery for prefill
    const possibleIds = [task.todo_id, (task as any).id, (task as any).snippet_todo_id];
    const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));

    const taskWithId = {
      ...task,
      todo_id: numericId || task.todo_id || task.snippet_id
    };
    // Instead of prompts, we use the prefill system to open the embedded edit view
    dispatch(setTodoCreatePrefill(taskWithId));
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (task: TodoItem) => {
    try {
      const sid = String(task.snippet_id);
      setDeletingIds(prev => [...prev, sid]);

      if (activeTimeoutsRef.current[sid]) {
        clearTimeout(activeTimeoutsRef.current[sid]);
      }

      activeTimeoutsRef.current[sid] = setTimeout(async () => {
        delete activeTimeoutsRef.current[sid];
        setDeletingIds(prev => prev.filter(id => id !== sid));
        setTasks(prev => prev.filter(t => String(t.snippet_id) !== sid));
        await performPermanentDelete(task);
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      }, 3000);

      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('Failed to delete todo:', error);
      triggerToast('Failed to delete task', 'error');
    }
  };

  const handleUndo = (sid: string) => {
    if (activeTimeoutsRef.current[sid]) {
      clearTimeout(activeTimeoutsRef.current[sid]);
      delete activeTimeoutsRef.current[sid];
    }
    setDeletingIds(prev => prev.filter(id => id !== sid));
    window.dispatchEvent(new CustomEvent('todosUpdated'));
  };

  const handleSnooze = async (task: TodoItem) => {
    try {
      const chromeAny = (window as any).chrome;
      const sid = String(task.snippet_id);

      // Snooze behavior: Mark as done immediately
      // If recurring, it will be reset by the alarm logic or maintenance

      if (chromeAny?.storage?.local) {
        const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
        const localTodos = result.local_todos || [];
        const updated = localTodos.map((t: any) =>
          String(t.snippet_id || t.id) === sid ? { ...t, is_done: true } : t,
        );
        await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
      }

      setTasks(prev => prev.map(t => (String(t.snippet_id) === sid ? { ...t, is_done: true } : t)));

      if (sid && !sid.startsWith('local-')) {
        await updateTodoStatus(sid, true, selectedTeam?.storageMode);
      }

      triggerToast(`Snoozed: "${task.key}"`, 'success');

      if (chromeAny?.runtime?.sendMessage) {
        const isRecurring = !!(task.is_recurring || (task as any).recurring);
        if (isRecurring) {
          // Trigger the recurring task NOW and let background handle rescheduling
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: sid,
            immediate: true,
          });
        } else {
          // For one-time tasks, just clear any existing alarm since it's now done
          chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: sid });
        }
      }
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('Failed to snooze task:', error);
      triggerToast('Failed to snooze task', 'error');
    }
  };

  const extractUrlsFromValue = (value: any): string[] => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed?.urls) return parsed.urls;
      } catch { }
      if (value.startsWith('http')) return [value];
    }
    return value?.urls || [];
  };

  const executeTask = async (task: TodoItem, skipToggle = false) => {
    if (task.is_done && !skipToggle) return;

    // A. Check if this is a config-based multi-item todo
    const configIds = task.config?.id;
    if (Array.isArray(configIds) && configIds.length > 0) {
      

      // We look up each ID in finalConvertibleItems to find its actual category and details
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
            extractUrlsFromValue(itemVal).forEach(url => chrome.tabs.create({ url }));
          } else if (['note', 'snippet', 'prompt', 'custom'].includes(itemCat)) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`,
              ),
            });
          } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent'].includes(itemCat)) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `new-tab/index.html?trigger_hotkey=true&type=${itemCat}&id=${encodeURIComponent(itemId)}`,
              ),
            });
          }
        }
      }

      if (!skipToggle) {
        await handleToggleDone(task);
      }
      return;
    }

    const { category, value, snippet_id } = task;
    const cat = (category || (task as any).snippet_category || '').toLowerCase();

    if (['link', 'tabgroup', 'tab group', 'links', 'quicklink', 'collection', 'agent_collection'].includes(cat)) {
      extractUrlsFromValue(value).forEach(url => chrome.tabs.create({ url }));
    } else if (['note', 'snippet', 'prompt'].includes(cat)) {
      // Open inline note editor instead of new tab
      setInlineNoteId(snippet_id);
      return; // Don't toggle done when opening inline
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent', 'custom'].includes(cat)) {
      // For these types, we open a new tab to trigger the logic as requested
      const triggerId = value || snippet_id;
      if (cat === 'custom') {
        chrome.tabs.create({
          url: chrome.runtime.getURL(
            `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(triggerId)}`,
          ),
        });
      } else {
        chrome.tabs.create({
          url: chrome.runtime.getURL(
            `new-tab/index.html?trigger_hotkey=true&type=${cat}&id=${encodeURIComponent(triggerId)}`,
          ),
        });
      }
    }
    if (!skipToggle) {
      await handleToggleDone(task);
    }
  };

  const convertibleItems = React.useMemo(() => {
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
            // Folder automations removed
          });

          // Workspace automations
          (ws.workspace_automations || []).forEach(auto => {
            let category = 'automation';

            // Check if it is an AI Chat Agent (matching SheetUI/gridStore logic)
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

    // 4. Installed Modules (from storage)
    const fetchModules = async () => {
      const res: any = await new Promise(resolve => chrome.storage.local.get('installed_modules', resolve));
      const modules = res.installed_modules || [];
      return modules.map((m: any) => ({
        id: `mod-${m.id || m.installation_id}`,
        name: m.name,
        category: 'module',
        data: m,
      }));
    };

    return items;
  }, [allData]);

  // Handle async module fetching
  const [asyncItems, setAsyncItems] = React.useState<any[]>([]);
  React.useEffect(() => {
    const loadModules = async () => {
      const storage: any = await new Promise(resolve => chrome.storage.local.get(['installed_modules', 'modules', 'installedModules', 'user_modules'], resolve));
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

    // 3. Listen for changes
    const listener = (changes: any) => {
      if (changes.installed_modules || changes.modules || changes.installedModules) {
        loadModules();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const finalConvertibleItems = React.useMemo(() => {
    return [...convertibleItems, ...asyncItems];
  }, [convertibleItems, asyncItems]);

  const getTaskCategoryDisplay = (t: TodoItem) => {
    const configIds = t.config?.id;

    // Case A: Multiple resources/files
    if (Array.isArray(configIds) && configIds.length > 1) {
      return `Automation (${configIds.length})`;
    }

    // Case B: Single resource/file task
    if (Array.isArray(configIds) && configIds.length === 1) {
      const cidStr = String(configIds[0]);
      const matched = finalConvertibleItems.find(item => {
        const itemIdStr = String(item.id);
        if (itemIdStr === cidStr) return true;
        const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-)/, '');
        const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');
        return strippedItemId === strippedCid;
      });

      if (matched) {
        const cat = (matched.category || '').toLowerCase();
        if (cat === 'command') return 'Command';
        if (cat === 'folder') return 'Folder';
        if (['tabgroup', 'tab group', 'agent_collection', 'collection'].includes(cat)) return 'Group';
        if (['link', 'links', 'quicklink'].includes(cat)) return 'Link';
        if (cat === 'prompt') return 'Prompt';
        if (cat === 'note') return 'Note';
        if (cat === 'snippet') return 'Snippet';
        if (cat === 'chat_agent' || cat === 'agent') return 'Agent';
        if (cat === 'automation') return 'Automation';
        if (cat === 'module' || cat === 'install') return 'Module';
        return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase().replace(/_/g, ' ');
      }
    }

    // Fallback for single resource if configIds is not present but category is set to something other than note/snippet/custom
    const catLower = (t.category || '').toLowerCase();
    if (catLower && !['note', 'snippet', 'custom'].includes(catLower)) {
      if (catLower === 'command') return 'Command';
      if (catLower === 'folder') return 'Folder';
      if (['tabgroup', 'tab group', 'agent_collection', 'collection'].includes(catLower)) return 'Group';
      if (['link', 'links', 'quicklink'].includes(catLower)) return 'Link';
      if (catLower === 'prompt') return 'Prompt';
      if (catLower === 'chat_agent' || catLower === 'agent') return 'Agent';
      if (catLower === 'automation') return 'Automation';
      if (catLower === 'module' || catLower === 'install') return 'Module';
    }

    // Case C: Custom Task
    return 'Task';
  };

  const handleCreateFromSelection = async (data: any) => {
    const chromeAny = (window as any).chrome;
    const cleanId = (id: string): string => {
      const idStr = String(id);
      if (
        idStr.includes('-') &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr)
      ) {
        return idStr.split('-').slice(1).join('-');
      }
      return idStr;
    };

    try {
      setIsLoading(true);
      let snippetId = data.item?.id || data.item?.snippet_id;

      // 1. If custom, we skip cloud snippet creation and handle it locally in step 3

      if (!snippetId && data.type !== 'custom') throw new Error('Failed to identify item ID');

      // 2. Format deadline
      let deadline = data.deadline || '';
      const isAnytime = !!data.isAnytime;

      if (!deadline && !isAnytime) {
        try {
          if (data.date) {
            const [year, month, day] = data.date.split('-').map(Number);
            const [hour, minute] = data.time ? data.time.split(':').map(Number) : [23, 59];
            const dt = new Date(year, month - 1, day, hour, minute);
            if (!isNaN(dt.getTime())) {
              deadline = dt.toISOString();
            }
          }
        } catch (e) {
          console.warn('[TodosList] Failed to parse date/time:', e);
        }
      }
      if (isAnytime) {
        try {
          let dt = new Date();
          const nowMs = Date.now();
          const eodMs = new Date().setHours(23, 59, 59, 999);

          if (data.date) {
            const [year, month, day] = data.date.split('-').map(Number);
            const targetDate = new Date(year, month - 1, day);

            if (isSameDay(targetDate, new Date())) {
              // Today: Pick random between NOW and EOD
              const randomMs = Math.floor(Math.random() * (eodMs - nowMs));
              dt = new Date(nowMs + randomMs);
            } else {
              // Future Day: Pick any random time that day
              dt = targetDate;
              dt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0);
            }
          } else {
            // Default Today: Pick random between NOW and EOD
            const randomMs = Math.floor(Math.random() * (eodMs - nowMs));
            dt = new Date(nowMs + randomMs);
          }

          if (!isNaN(dt.getTime())) {
            deadline = dt.toISOString();
          }
        } catch (e) {
          console.warn('[TodosList] Failed to set anytime deadline:', e);
          deadline = new Date().toISOString();
        }
      }

      // 3. Save or Update todo
      if (todoCreatePrefill?.todo_id || (todoCreatePrefill?.snippet_id && todoCreatePrefill?.is_todo_type)) {
        const sid = String(todoCreatePrefill.snippet_id);
        const hasConfigIds = Array.isArray(data.selectedItems) && data.selectedItems.length > 0;
        const configFromSelection = hasConfigIds ? {
          id: (data.selectedItems as any[]).map((i: any) => {
            return String(cleanId(i.data?.snippet_id || i.id));
          }),
          title: data.title
        } : {
          id: [String(cleanId(sid))],
          title: data.title
        };

        // This is an update
        if (sid.startsWith('local-')) {
          // Handle local update
          if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
            const localTodos = result.local_todos || [];
            const updated = localTodos.map((t: any) =>
              String(t.snippet_id || t.id) === sid
                ? {
                  ...t,
                  key: data.title,
                  title: data.title,
                  value: data.description,
                  event_deadline: deadline,
                  is_recurring: data.scheduleType === 'recurring',
                  recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                  is_anytime: isAnytime,
                  config: configFromSelection,
                }
                : t,
            );
            await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));

            // Optimistic UI update for the list
            setTasks(prev =>
              prev.map(t =>
                String(t.snippet_id) === sid
                  ? {
                    ...t,
                    key: data.title,
                    title: data.title,
                    value: data.description,
                    event_deadline: deadline,
                    is_recurring: data.scheduleType === 'recurring',
                    recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                    is_anytime: isAnytime,
                    config: configFromSelection,
                  }
                  : t,
              ),
            );
          }
        } else {
          // 1. Optimistic Update: Save to Local Cache & UI immediately
          if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
            const localTodos = result.local_todos || [];
            const updated = localTodos.map((t: any) =>
              String(t.snippet_id || t.id) === sid
                ? {
                  ...t,
                  key: data.title,
                  title: data.title,
                  value: data.description,
                  event_deadline: deadline,
                  is_recurring: data.scheduleType === 'recurring',
                  recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                  is_anytime: isAnytime,
                  config: configFromSelection,
                }
                : t,
            );
            await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updated }, resolve));
          }

          setTasks(prev =>
            prev.map(t =>
              String(t.snippet_id) === sid
                ? {
                  ...t,
                  key: data.title,
                  title: data.title,
                  value: data.description,
                  event_deadline: deadline,
                  is_recurring: data.scheduleType === 'recurring',
                  recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                  is_anytime: isAnytime,
                  config: configFromSelection,
                }
                : t,
            ),
          );

          // 2. Background Cloud Sync
          try {
            const bestTodoId = todoCreatePrefill.todo_id;
            const isNumeric = typeof bestTodoId === 'number' || (typeof bestTodoId === 'string' && !isNaN(Number(bestTodoId)) && !bestTodoId.includes('-'));

            if (isNumeric) {
              
              await editTodo(
                bestTodoId,
                deadline,
                data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
                data.title,
                data.description,
                data.scheduleType === 'recurring',
                todoCreatePrefill.is_done
              );
              // Also update the config column in the snippets table via updateSnippetRealtime
              if (sid) {
                await updateSnippetRealtime({
                  snippet_id: sid,
                  config: configFromSelection,
                }, selectedTeam?.storageMode ?? 'cloud');
              }
            } else {
              
              await updateSnippetRealtime({
                snippet_id: sid,
                key: data.title,
                value: data.description,
                event_deadline: deadline,
                is_recurring: data.scheduleType === 'recurring',
                recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
                is_done: todoCreatePrefill.is_done,
                config: configFromSelection,
              }, selectedTeam?.storageMode ?? 'cloud');
            }
          } catch (cloudError) {
            console.error('[TodosList] Cloud sync failed for edit:', cloudError);
            // Silent failure
          }

          // 3. Reschedule Alarm
          if (chromeAny?.runtime?.sendMessage) {
            chromeAny.runtime.sendMessage({
              action: 'schedule_todo_alarm',
              todoId: String(todoCreatePrefill.todo_id || sid),
              deadline: deadline || new Date().toISOString(),
              is_anytime: isAnytime
            });
          }
        }
      } else if (['custom'].includes(data.type)) {
        // ─── CLOUD SAVE FOR CUSTOM TASKS ───
        const storageResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['lastNoteDestination', 'user', 'local_todos'], resolve));
        const lastDest = storageResult.lastNoteDestination;
        const localTodos = storageResult.local_todos || [];

        let targetWorkspaceId = lastDest?.workspace_id;
        let targetFolderId = lastDest?.folder_id;

        if (!targetWorkspaceId && allData && allData.length > 0) {
          for (const team of allData) {
            if (team.workspaces && team.workspaces.length > 0) {
              targetWorkspaceId = team.workspaces[0].workspace_id;
              break;
            }
          }
        }

        const taskValue = data.description;
        const tempId = `local-temp-${Date.now()}`;

        // 1. Optimistic Local Save (Ensure data is stored even if cloud fails)
        const optimisticTask: TodoItem = {
          snippet_id: tempId,
          id: tempId,
          key: data.title,
          title: data.title,
          value: taskValue,
          category: 'note',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          event_deadline: deadline,
          is_done: false,
          is_todo_type: true,
          is_recurring: data.scheduleType === 'recurring',
          recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
          folder_id: targetFolderId || '',
          workspace_id: targetWorkspaceId || null,
          is_anytime: isAnytime,
        };

        await new Promise<void>(resolve =>
          chromeAny.storage.local.set({ local_todos: [optimisticTask, ...localTodos] }, resolve),
        );

        setTasks(prev => [optimisticTask, ...prev]);

        // 2. Attempt Cloud Sync if workspace is available
        if (targetWorkspaceId) {
          try {
            const response = await updateSnippetRealtime({
              workspace_id: targetWorkspaceId,
              folder_id: targetFolderId || undefined,
              key: data.title,
              value: taskValue,
              category: (data.type === 'custom' ? 'note' : data.type) as any,
            } as any, selectedTeam?.storageMode ?? 'cloud');

            const cloudSnippet = response.snippet;
            const cloudId = cloudSnippet.snippet_id || cloudSnippet.id;

            const convertRes = await convertSnippetToTodo(
              { snippet_id: cloudId },
              deadline || '',
              data.scheduleType === 'recurring',
              data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
              data.title
            );

            const todoId = convertRes?.todo_id || convertRes?.snippet?.todo_id || convertRes?.snippet?.id || convertRes?.snippet?.snippet_id;

            // 3. Update local with real cloud IDs
            const finalTask = { ...optimisticTask, snippet_id: String(cloudId), id: String(cloudId), todo_id: todoId };
            const freshResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
            const freshTodos = (freshResult.local_todos || []).map((t: any) =>
              t.snippet_id === tempId ? finalTask : t
            );
            await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: freshTodos }, resolve));

            setTasks(prev => prev.map(t => (t.snippet_id === tempId ? finalTask : t)));

            if (chromeAny?.runtime?.sendMessage) {
              chromeAny.runtime.sendMessage({
                action: 'schedule_todo_alarm',
                todoId: String(cloudId),
                deadline: deadline || new Date().toISOString(),
                is_anytime: isAnytime
              });
            }
          } catch (error) {
            console.error('[TodosList] Cloud sync failed, task remains local-only:', error);
            triggerToast('Task saved locally, but cloud sync failed.', 'warning');
          }
        }

        dispatch(setTodoCreateMode(false));

      } else {
        // ─── CLOUD CONVERSION FOR EXISTING RESOURCES ───
        const rawId =
          String(snippetId).includes('-') &&
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(snippetId))
            ? String(snippetId).split('-').slice(1).join('-')
            : snippetId;

        const cat = data.type || 'note';
        const hasConfigIds = Array.isArray(data.selectedItems) && data.selectedItems.length > 0;
        const configFromSelection = hasConfigIds ? {
          id: (data.selectedItems as any[]).map((i: any) => {
            return String(cleanId(i.data?.snippet_id || i.id));
          }),
          title: data.title
        } : (data.item?.config?.id ? {
          id: (data.item.config.id as any[]).map(id => String(cleanId(id))),
          title: data.title
        } : {
          id: [String(cleanId(rawId))],
          title: data.title
        });

        const optimisticTask: TodoItem = {
          snippet_id: String(rawId),
          key: data.title,
          title: data.title,
          value: (['automation', 'module', 'command', 'agent', 'chat_agent', 'install'].includes(cat))
            ? (data.item?.id || data.item?.snippet_id || data.description)
            : data.description,
          category: cat,
          is_todo_type: true,
          event_deadline: deadline,
          is_done: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          folder_id: '',
          workspace_id: null,
          is_recurring: data.scheduleType === 'recurring',
          recurring_cycle: data.scheduleType === 'recurring' ? data.recurringCycle : null,
          is_anytime: isAnytime,
          automation_description: data.description,
          config: configFromSelection,
        };

        // 1. Optimistic Local Save
        const localResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
        const localTodos = localResult.local_todos || [];
        const updatedLocal = [optimisticTask, ...localTodos.filter((t: any) => String(t.snippet_id || t.id) !== String(rawId))];
        await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: updatedLocal }, resolve));

        setTasks(prev => {
          const merged = [optimisticTask, ...prev];
          return Array.from(new Map(merged.map(item => [String(item.snippet_id), item])).values());
        });

        // 2. Attempt Cloud Sync
        try {
          // ── Config-based path ────────────────────────────────────────────────
          // When selectedItems[] is populated (multi-select UI), use
          // convertToTodoWithConfig which resolves the correct ID field per
          // item type (snippet_id / automation_id / command_id / etc.) and
          // calls the endpoint once per item, returning a unified response.
          // Falls back to the old per-type logic for legacy / single-item paths.
          const hasConfigIds = Array.isArray(data.selectedItems) && data.selectedItems.length > 0;

          let res: any;
          if (hasConfigIds) {
            
            res = await convertToTodoWithConfig(
              data.selectedItems as any[],
              deadline,
              data.scheduleType === 'recurring',
              data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
              data.title,
            );
          } else {
            // ── FALLBACK: legacy per-type path (unchanged) ──────────────────
            const target: any = {};
            if (['automation', 'agent', 'chat_agent'].includes(data.type)) {
              target.automation_id = rawId;
            } else if (['module', 'install'].includes(data.type)) {
              target.installed_module_id = rawId;
            } else if (data.type === 'command') {
              target.command_id = rawId;
            } else {
              target.snippet_id = rawId;
            }
            res = await convertSnippetToTodo(
              target,
              deadline,
              data.scheduleType === 'recurring',
              data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
              data.title,
            );
          }

          const configFromResponse = res?.snippet?.config || (hasConfigIds ? {
            id: (data.selectedItems as any[]).map((i: any) => {
              return String(cleanId(i.data?.snippet_id || i.id));
            }),
            title: data.title
          } : (data.item?.config?.id ? {
            id: (data.item.config.id as any[]).map(id => String(cleanId(id))),
            title: data.title
          } : {
            id: [String(cleanId(rawId))],
            title: data.title
          }));
          const freshResult = await new Promise<any>(resolve => chromeAny.storage.local.get(['local_todos'], resolve));
          const freshTodos = (freshResult.local_todos || []).map((t: any) =>
            String(t.snippet_id || t.id) === String(rawId)
              ? { ...t, todo_id: res.todo_id, category: res.entity_type || t.category, config: configFromResponse }
              : t
          );
          await new Promise<void>(resolve => chromeAny.storage.local.set({ local_todos: freshTodos }, resolve));

          setTasks(prev => prev.map(t =>
            String(t.snippet_id || t.id) === String(rawId)
              ? { ...t, todo_id: res.todo_id, config: configFromResponse }
              : t
          ));

          if (chromeAny?.runtime?.sendMessage) {
            chromeAny.runtime.sendMessage({
              action: 'schedule_todo_alarm',
              todoId: String(res.todo_id || rawId),
              deadline: deadline || new Date().toISOString(),
              is_anytime: isAnytime
            });
          }
        } catch (error) {
          console.error('[TodosList] Cloud conversion failed, task remains local:', error);
          triggerToast('Task saved locally, but cloud sync failed.', 'warning');
        }
      }

      // Shared cleanup and refresh for all creation/edit paths
      await fetchTasks(false);
      setIsLoading(false);
      setActiveSection('today');
      setSelectedIndex(0);
      setCreateSearchQuery('');
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error: any) {
      console.error('Failed to create/convert todo:', error);
      triggerToast(error.message || 'Failed to save task', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createViewFlatItems = React.useMemo(() => {
    if (isCreateModalOpen) return [];

    const q = createSearchQuery.toLowerCase();
    // In create mode, we show filtered items
    return finalConvertibleItems.filter(item => (item.name || item.key || '').toLowerCase().includes(q));
  }, [finalConvertibleItems, activeSection, createSearchQuery]);

  // Restoration of full Keyboard Navigation logic
  useEffect(() => {
    if (!isOpen) return;
    (window as any).isTodoDashboardOpen = true;
    dispatch(setIsCommandListView(false));
    dispatch(setHighlightedCommandId(null));
    const activeTag = document.activeElement?.tagName;
    if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      if (!isCreateModalOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      } else if (!isCreateModalOpen) {
        containerRef.current?.focus();
      }
    }

    const blockEvents = (e: KeyboardEvent) => {
      if (isCreateModalOpen) {
        return;
      }
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // When inline note editor is open, only handle Escape to close it
      if (inlineNoteId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setInlineNoteId(null);
        }
        return; // Let all other keys pass through to the note editor
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      // If we are in an input/textarea, we should be very careful not to block standard typing keys
      if (isInput) {
        // Always allow navigation keys in all sections when searching
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          // Continue to handle these for search result selection
        } else {
          // Let all other keys (Space, ArrowRight, ArrowLeft, etc.) work normally in the input
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        let maxIndex = allOrderedTasks.length - 1;
        if (isCreateModalOpen) return; // Let component handle

        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, maxIndex));
        return;
      }
      if (e.key === 'ArrowUp') {
        if (isCreateModalOpen) return; // Let component handle

        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (isInput || isCreateModalOpen) return;
        const pillList = ['today', 'scheduled'] as const;
        const currentPillIndex = pillList.indexOf(activeSection as any);
        const nextIndex = e.key === 'ArrowRight' ? (currentPillIndex + 1) % pillList.length : (currentPillIndex - 1 + pillList.length) % pillList.length;

        setActiveSection(pillList[nextIndex]);
        setSelectedIndex(0);
        return;
      }
      if (e.key === ' ') {
        if (isInput) return;
        e.preventDefault();
        const task = allOrderedTasks[selectedIndex];
        if (task) executeTask(task, task.is_done);
        return;
      }
      if (e.key === 'Enter') {
        if (isCreateModalOpen) return; // HANDLED BY CreateTodoSelectionView

        e.preventDefault();
        const task = allOrderedTasks[selectedIndex];
        if (task) {
          executeTask(task, task.is_done);
        }
        return;
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', blockEvents, true);
    return () => {
      (window as any).isTodoDashboardOpen = false;
      window.removeEventListener('keydown', blockEvents, true);
    };
  }, [isOpen, activeSection, selectedIndex, allOrderedTasks, collapsedCategories, finalConvertibleItems, inlineNoteId, isCreateModalOpen]);



  const renderTaskRow = (task: TodoItem, globalIndex: number) => {
    const taskId = String(task.snippet_id || task.id);
    if (deletingIds.includes(taskId)) {
      return (
        <div
          key={taskId}
          className="w-full bg-red-500/[0.02] border border-red-500/20 rounded-xl py-2 px-3.5 mb-2 flex items-center justify-between transition-all duration-200"
        >
          <span className="flex items-center gap-2 text-xs text-neutral-300 font-medium select-none">
            <span className="text-emerald-500 text-[14px]">✓</span>
            <span>To-do deleted successfully.</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUndo(taskId);
            }}
            className="text-[#5e6ad2] dark:text-blue-400 hover:text-blue-300 font-semibold cursor-pointer select-none transition-all duration-150 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs border border-white/[0.06] hover:border-white/[0.1]"
          >
            Undo
          </button>
        </div>
      );
    }

    const deadlineDate = parseTaskDate(task.event_deadline);
    const isOverdue = !task.is_done && deadlineDate.getTime() < now.getTime() && (!isSameDay(deadlineDate, now) || (task.event_deadline && task.event_deadline.includes(':')));
    let category = (task.category || 'snippet').toLowerCase();

    // Safety check: If it has automation_id but is categorized as snippet/note, fix it for display
    if ((task as any).automation_id && (category === 'snippet' || category === 'note')) {
      const isAgent = (task as any).is_agent || (task as any).type === 'agent' || (task as any).category === 'agent';
      category = isAgent ? 'agent' : 'automation';
    }
    const getTaskTitle = (t: TodoItem) => {
      const raw = t.key || t.title || 'Untitled Task';
      if (typeof raw === 'object' && raw !== null) {
        if ((raw as any).name) return String((raw as any).name);
        if ((raw as any).names) return Array.isArray((raw as any).names) ? (raw as any).names.join(', ') : String((raw as any).names);
        return JSON.stringify(raw);
      }
      return String(raw);
    };

    const taskTitle = getTaskTitle(task);
    const effectivelyIconHost =
      task.iconHost ||
      (task as any).icon_host ||
      (task as any).parent_icon_host ||
      (task.iconHosts && task.iconHosts[0]);

    // Helper for icons based on search session rules
    const renderTypeIcon = (wrap = true) => {
      const iconSize = 18;

      const wrapIcon = (icon: React.ReactNode, extraClasses = '') => {
        return <div className={`flex items-center justify-center shrink-0 ${extraClasses}`}>{icon}</div>;
      };

      const configIds = task.config?.id;
      if (Array.isArray(configIds) && configIds.length > 1) {
        return wrapIcon(<FaLayerGroup size={iconSize - 2} className={wrap ? "text-[#38bdf8]" : ""} />);
      }
      if ((!configIds || configIds.length === 0) && (category === 'note' || category === 'snippet' || category === 'custom')) {
        return wrapIcon(<FiCheckSquare size={iconSize} className={wrap ? "text-amber-500" : ""} />);
      }

      // Extract URLs for stacked icons
      let urls: string[] = [];
      try {
        const val = task.value || '';
        if (typeof val === 'object' && val !== null) {
          if ((val as any).urls) urls = (val as any).urls;
          else if ((val as any).url) urls = [(val as any).url];
        } else if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          const parsed = JSON.parse(val || '{}');
          urls = parsed.urls || (val.startsWith('http') ? [val] : []);
        } else if (typeof val === 'string' && val.startsWith('http')) {
          urls = [val];
        }
      } catch (e) {
        if (task.value && typeof task.value === 'string' && task.value.startsWith('http')) {
          urls = [task.value];
        }
      }

      const BROWSER_ICONS: Record<string, React.ReactNode> = {
        history: <FaHistory size={14} />,
        downloads: <FaDownload size={14} />,
        settings: <FaCog size={14} />,
        extensions: <FaPuzzlePiece size={14} />,
        bookmarks: <FaBookmark size={14} />,
        flags: <FaFlag size={14} />,
        inspect: <FaCode size={14} />,
        version: <FaTag size={14} />,
        about: <FaInfoCircle size={14} />,
        tasks: <FaMemory size={14} />,
        gpu: <FaMicrochip size={14} />,
        dino: <FaGamepad size={14} />,
        passwords: <FaKey size={14} />,
        help: <FaQuestionCircle size={14} />,
        google: <FaSearch size={14} />,
      };

      switch ((category || '').toLowerCase()) {
        case 'note':
        case 'snippet':
          return wrapIcon(<NotesIcon size={iconSize} />);
        case 'link':
        case 'links':
        case 'quicklink':
        case 'biolink':
          if (urls.length > 1) {
            return <StackedLinkIcon urls={urls} size={iconSize} />;
          }
          if (urls.length === 1) {
            return wrapIcon(
              <img src={getFaviconUrl(urls[0])} alt="" className="w-4 h-4 rounded-sm object-contain shadow-sm" />,
            );
          }
          return wrapIcon(<FaLink size={iconSize - 2} className={wrap ? "text-blue-400" : ""} />);
        case 'automation':
        case 'module':
        case 'install':
        case 'agent':
        case 'chat agent':
        case 'chat_agent':
          if (effectivelyIconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(effectivelyIconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }
          // Dynamic icon logic from SheetUI/SearchSuggestions
          // Try to find the full automation data in our Redux store for better icons
          const allTeams = Array.isArray(allData) ? allData : [];
          let enrichedAutomation = null;
          const targetAutoId = String((task as any).automation_id || task.id || '');

          for (const team of allTeams) {
            for (const ws of (team.workspaces || [])) {
              const auto = (ws.workspace_automations || []).find((a: any) => String(a.id) === targetAutoId);
              if (auto) { enrichedAutomation = auto; break; }
              const fAuto = (ws.folders || []).flatMap((f: any) => f.automations || []).find((a: any) => String(a.id) === targetAutoId);
              if (fAuto) { enrichedAutomation = fAuto; break; }
            }
            if (enrichedAutomation) break;
          }

          return wrapIcon(
            <AutomationDynamicIcon
              automation={enrichedAutomation || task}
              size={iconSize}
              className="shrink-0"
            />,
          );
        case 'prompt':
          return wrapIcon(<LuSparkles size={iconSize} className={wrap ? "text-purple-500" : ""} />);
        case 'command':
          const cmdId = typeof task.value === 'string' ? task.value.toLowerCase() : '';

          if (cmdId === 'ai') {
            return (
              <div className="flex -space-x-2 items-center justify-center w-8">
                {AI_GROUP.members.slice(0, 3).map(aiId => {
                  const aiCommand = COMMANDS.find(c => c.id === aiId);
                  if (!aiCommand) return null;
                  return (
                    <div
                      key={`ai-todo-${aiId}`}
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center overflow-hidden border border-white/50 dark:border-neutral-700/50 bg-white shadow-sm">
                      <img
                        src={getFaviconUrl(aiCommand.iconHost)}
                        alt={aiCommand.label}
                        className="w-3.5 h-3.5 object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            );
          }

          const commandDef = COMMANDS.find(
            c => c.id.toLowerCase() === cmdId || c.id.toLowerCase() === cmdId.replace('cmd-', ''),
          );

          if (commandDef && commandDef.iconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(commandDef.iconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }

          if (effectivelyIconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(effectivelyIconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }
          if (BROWSER_ICONS[cmdId]) {
            return wrapIcon(BROWSER_ICONS[cmdId], wrap ? 'text-[var(--color-iconDefault)]' : '');
          }

          return wrapIcon(<CmdIcon size={18} height={12} fontSize={8} />);
        case 'tabgroup':
        case 'tab group':
        case 'collection':
        case 'agent_collection':
          return <StackedLinkIcon urls={urls} size={iconSize} fallback="tabgroup" />;
        case 'store':
        case 'catalog':
          return wrapIcon(<FaCloudDownloadAlt size={iconSize} className={wrap ? "text-blue-500" : ""} />);
        case 'analysis':
        case 'modification':
          return wrapIcon(<FaSyncAlt size={iconSize - 2} className={wrap ? "text-emerald-400" : ""} />);
        default:
          if (effectivelyIconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(effectivelyIconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }
          return wrapIcon(<FiFileText size={iconSize} className={wrap ? "text-blue-400" : ""} />);
      }
    };

    const getDueStatus = () => {
      if (task.is_done) return { text: 'Completed', color: 'text-emerald-500 font-semibold' };

      const now = new Date();
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffMins = Math.abs(Math.floor(diffMs / (60 * 1000)));
      const diffHrs = Math.abs(Math.floor(diffMs / (60 * 60 * 1000)));
      const diffDays = Math.abs(Math.floor(diffMs / (24 * 60 * 60 * 1000)));

      if (isOverdue) {
        let text = '';
        if (diffMins < 60) text = `${diffMins}m overdue`;
        else if (diffHrs < 24) text = `${diffHrs}h overdue`;
        else text = `${diffDays}d overdue`;

        return { text, color: 'text-red-500 font-bold' };
      }

      if (diffMins < 60) {
        return {
          text: `${diffMins}m due`,
          color: 'text-amber-500 font-bold',
        };
      }

      if (diffHrs < 24) {
        return {
          text: `${diffHrs}h due`,
          color: 'text-amber-500 font-bold',
        };
      }

      return {
        text: `${diffDays}d due`,
        color: `${isDarkMode ? 'text-white/40' : 'text-slate-500'} font-bold`,
      };
    };

    const dueStatus = getDueStatus();

    const renderDescription = () => {
      let val = (task as any).automation_description || (task as any).automation_name || task.value || '';
      if (!val) return category === 'automation' ? 'Run automation flow' : 'Task';

      // 1. Handle raw object (not stringified)
      if (typeof val === 'object' && val !== null) {
        if ((val as any).urls && Array.isArray((val as any).urls)) {
          return (val as any).urls.join(', ');
        }
        if ((val as any).name) return String((val as any).name);
        if ((val as any).names) return Array.isArray((val as any).names) ? (val as any).names.join(', ') : String((val as any).names);
        return JSON.stringify(val);
      }

      // 2. Handle JSON string (Tab Groups / Links)
      if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.urls && Array.isArray(parsed.urls)) {
            return parsed.urls.join(', ');
          }
          if (parsed.name) return parsed.name;
          if (parsed.names) return Array.isArray(parsed.names) ? parsed.names.join(', ') : String(parsed.names);
        } catch (e) { }
      }

      // 3. Strip HTML (Notes)
      if (typeof val === 'string') {
        return val.replace(/<[^>]*>?/gm, '');
      }
      return String(val);
    };

    return (
      <div
        key={taskId}
        data-index={globalIndex}
        onClick={() => executeTask(task, task.is_done)}
        className={`group transition-all duration-200 cursor-pointer flex items-center justify-between w-full border border-white/[0.08] dark:border-white/[0.05] bg-white/[0.02] rounded-xl py-2 px-3.5 mb-2 hover:bg-white/[0.04] hover:border-white/[0.15] ${task.is_done ? 'opacity-[0.6]' : ''} ${selectedIndex === globalIndex
          ? 'bg-white/[0.06] border-white/[0.15]'
          : ''
          }`}>
        {/* Left side: Checkbox, Type Icon, Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Checkbox & Optional Type Icon */}
          <div className="flex items-center gap-2 shrink-0">
            {task.is_done ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleDone(task);
                }}
                title="Completed"
                className="w-[18px] h-[18px] rounded-full bg-emerald-500 border border-emerald-500 text-white flex items-center justify-center shadow-sm cursor-pointer transition-all hover:bg-emerald-600 shrink-0"
              >
                <FaCheck size={9} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleDone(task);
                }}
                title="Mark Done"
                className={`w-[18px] h-[18px] rounded-full border border-white/30 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all cursor-pointer shrink-0 opacity-100`}
              >
                <FaCheck size={9} className="opacity-0 hover:opacity-50 text-emerald-500 transition-opacity" />
              </button>
            )}
            {!isSidebar && (
              <div className="flex items-center justify-center shrink-0">
                {renderTypeIcon()}
              </div>
            )}
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col justify-center min-w-0 flex-1">
            {isSidebar ? (
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <div className="flex items-center justify-center scale-[0.75] opacity-80 shrink-0">
                  {renderTypeIcon(false)}
                </div>
                <span
                  className={`font-medium truncate tracking-wide ${task.is_done ? 'text-white/50' : 'text-[#e4e5eb]'} flex-1 min-w-0`}
                  style={{ fontSize: '14px' }}
                  title={taskTitle}
                >
                  {taskTitle}
                </span>
                <span className={`text-[11px] font-medium tracking-wide whitespace-nowrap shrink-0 ${task.is_done ? 'text-white/30' : (theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[#8b949e]')} ${Array.isArray(task.config?.id) && task.config.id.length > 1
                  ? 'text-white/40 dark:text-white/30 font-normal'
                  : ''
                }`}>
                  {getTaskCategoryDisplay(task)}
                </span>
                {deadlineDate.getTime() !== 0 && (
                  <>
                    <span className="opacity-50 text-[10px] shrink-0">•</span>
                    <span className={`text-[11px] font-medium tracking-wide whitespace-nowrap shrink-0 ${task.is_done ? 'text-white/30' : (theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[#8b949e]')}`}>
                      {isSameDay(deadlineDate, now)
                        ? deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                        : `${isTomorrow(deadlineDate) ? 'Tomorrow' : format(deadlineDate, 'MMM d')}, ${deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 max-w-full">
                  <div className="flex items-center justify-center scale-[0.75] opacity-80 shrink-0">
                    {renderTypeIcon(false)}
                  </div>
                  <span
                    className={`font-medium truncate block tracking-wide ${task.is_done ? 'text-white/50' : 'text-[#e4e5eb]'} flex-1 min-w-0`}
                    style={{ fontSize: '14px' }}
                    title={taskTitle}
                  >
                    {taskTitle}
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 mt-0.5 ${task.is_done ? 'text-white/30' : (theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[#8b949e]')}`}>
                  <span className={`text-[11px] font-medium tracking-wide whitespace-nowrap ${Array.isArray(task.config?.id) && task.config.id.length > 1
                      ? 'text-white/40 dark:text-white/30 font-normal'
                      : ''
                    }`}>
                    {getTaskCategoryDisplay(task)}
                  </span>
                  {(() => {
                    const desc = renderDescription();
                    if (desc && desc.trim() !== '' && desc !== taskTitle) {
                      return (
                        <>
                          <span className="opacity-50 text-[10px] shrink-0">•</span>
                          <span className={`text-[11px] font-normal truncate max-w-[300px] ${theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[#8b949e]'}`} title={desc}>
                            {desc}
                          </span>
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
              </>
            )}

            {isSidebar && (() => {
              const desc = renderDescription();
              if (desc && desc.trim() !== '' && desc !== taskTitle) {
                return (
                  <span className={`text-[10px] font-normal truncate mt-0.5 ${task.is_done ? 'text-white/30' : (theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[#8b949e]')}`} title={desc}>
                    {desc}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Right side: Time, Recurrence & Actions */}
        <div className="flex items-center gap-3 shrink-0 text-right whitespace-nowrap ml-4">
          {!isSidebar && (
            <span className={`${task.is_done ? 'text-white/40' : 'text-[#8b949e]'} text-[12px] font-medium flex items-center gap-1.5`}>
              <span>
                {isSameDay(deadlineDate, now)
                  ? deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : `${isTomorrow(deadlineDate) ? 'Tomorrow, ' : deadlineDate.getTime() !== 0 ? `${format(deadlineDate, 'MMM d')}, ` : ''}${deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              </span>
              {task.is_recurring && <span>•</span>}
              {task.is_recurring && <span className="opacity-80">Daily</span>}
            </span>
          )}

          {!task.is_done && (
            <div
              className="flex items-center gap-0.5 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
            >
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleEditTask(task);
                }}
                className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-white/40 hover:text-white"
                title="Edit Task"
              >
                <FiEdit2 size={13} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(task);
                }}
                className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-white/40 hover:text-red-400"
                title="Delete Task"
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCaughtUpState = (title = 'All caught up for today', subtitle = 'Enjoy your focus time.') => (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none animate-fadeIn w-full">
      {/* Nested circles with checkmark */}
      <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
        {/* Decorative Stars/Sparkles */}
        <div className="absolute top-1 left-2 text-neutral-500/40 text-xs">✦</div>
        <div className="absolute bottom-2 left-0 text-neutral-500/40 text-sm">✦</div>
        <div className="absolute top-2 right-1 text-neutral-500/40 text-sm">✦</div>
        <div className="absolute bottom-1 right-2 text-neutral-500/40 text-xs">✦</div>
        
        {/* Outer circle */}
        <div className="w-14 h-14 rounded-full border border-neutral-700/30 flex items-center justify-center bg-transparent">
          {/* Inner circle */}
          <div className="w-10 h-10 rounded-full border border-neutral-700/60 flex items-center justify-center bg-transparent">
            {/* Checkmark icon */}
            <FiCheck className="text-neutral-400 text-lg stroke-[3]" />
          </div>
        </div>
      </div>
      <h4 className="text-[13px] font-semibold text-neutral-300 tracking-wide mb-1">
        {title}
      </h4>
      <p className="text-[11px] text-neutral-500">
        {subtitle}
      </p>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full relative bg-transparent items-start justify-center pt-0 ${isSidebar ? 'px-1 pb-1' : 'px-4 pb-4'}`}
      style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Content Area */}
      <div className={`flex flex-col w-full max-w-5xl bg-transparent ${isCreateModalOnly ? 'hidden' : ''}`}>
        {/* Unified Bottom Card */}
        <div
          style={isSidebar ? { height: '100%' } : { height: `${listHeight}px` }}
          className={`flex flex-col w-full overflow-hidden relative ${isSidebar ? 'bg-transparent border-0' : 'bg-[var(--color-editorBg)] border border-[#2f3142] rounded-xl shadow-2xl'}`}>
          {/* Navigation Pill Buttons */}
          <div className={`flex items-center justify-between px-2 shrink-0 w-full box-border border-b border-white/[0.06] ${isSidebar ? 'py-2.5' : 'py-4'}`}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setActiveSection('today'); setSelectedIndex(0); }}
                className={`text-[12px] font-medium tracking-wide transition-all flex items-center gap-1.5 ${activeSection === 'today' ? 'text-white font-bold' : 'text-[#8b949e] hover:text-[#e4e5eb]'}`}>
                <FiClock size={12} />
                <span>Today</span>
              </button>
              <button
                onClick={() => { setActiveSection('scheduled'); setSelectedIndex(0); }}
                className={`text-[12px] font-medium tracking-wide transition-all flex items-center gap-1.5 ${activeSection === 'scheduled' || activeSection === 'calendar' ? 'text-white font-bold' : 'text-[#8b949e] hover:text-[#e4e5eb]'}`}>
                <BsCalendarCheck size={12} />
                <span>Scheduled</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isLoggedIn === false && onRequireLogin) {
                    onRequireLogin();
                    return;
                  }
                  dispatch(setTodoCreatePrefill(null));
                  setIsCreateModalOpen(true);
                  setSelectedIndex(0);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[#e4e5eb] cursor-pointer transition-all"
                title="Add Task"
              >
                <FiPlus size={14} />
              </button>
              {isSidebar && (
                <button
                  onClick={onClose}
                  title="Collapse Panel"
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all"
                >
                  <BsPinAngleFill size={15} />
                </button>
              )}
            </div>
          </div>

          <div
            ref={scrollableRef}
            className={`flex-1 w-full custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20 transition-all overflow-y-auto`}>
            <div className="pb-4 w-full">
              {isLoading && (
                <div className="absolute top-4 right-4 z-10 animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              )}

              <div className="w-full text-[var(--color-textPrimary)] flex flex-col px-4 pt-4">
                <>
                  {activeSection === 'today' ? (
                    <>
                      {(() => {
                        const overdueItems = activeTasks.filter(t => {
                          const deadlineDate = parseTaskDate(t.event_deadline);
                          return deadlineDate.getTime() < now.getTime() && (!isSameDay(deadlineDate, now) || (t.event_deadline && t.event_deadline.includes(':')));
                        });
                        const todayActiveItems = activeTasks.filter(t => !overdueItems.includes(t));
                        const todayDoneItems = doneTasks.filter(t => t.is_done && isToday(parseTaskDate(t.event_deadline)));

                        if (todayActiveItems.length === 0 && overdueItems.length === 0 && todayDoneItems.length === 0) {
                          return renderCaughtUpState('All caught up for today', 'Enjoy your focus time.');
                        }

                        const rows: React.ReactNode[] = [];

                        const pushActive = () => {
                          rows.push(
                            <div key="active-header" className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2" onClick={() => setCollapsedGroups(prev => ({ ...prev, active: !prev.active }))}>
                              <div className="w-full py-2 flex items-center bg-transparent">
                                <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                                  {collapsedGroups.active ? <FiChevronRight size={12} className="opacity-70" /> : <FiChevronDown size={12} className="opacity-70" />}
                                  <FiClock size={12} className="text-blue-500 shrink-0" />
                                  <span>Today</span>
                                  <span className="opacity-50">•</span>
                                  <span>{todayActiveItems.length}</span>
                                </div>
                              </div>
                            </div>
                          );
                          if (!collapsedGroups.active) {
                            if (todayActiveItems.length === 0) {
                              rows.push(
                                <div key="active-caughtup">
                                  {renderCaughtUpState('All caught up for today', 'Enjoy your focus time.')}
                                </div>
                              );
                            } else {
                              todayActiveItems.forEach((task, index) => {
                                rows.push(renderTaskRow(task, index));
                              });
                            }
                          }
                        };

                        const pushOverdue = () => {
                          if (overdueItems.length === 0) return;
                          rows.push(
                            <div key="overdue-header" className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2" onClick={() => setCollapsedGroups(prev => ({ ...prev, overdue: !prev.overdue }))}>
                              <div className="w-full py-2 flex items-center bg-transparent">
                                <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                                  {collapsedGroups.overdue ? <FiChevronRight size={12} className="opacity-70" /> : <FiChevronDown size={12} className="opacity-70" />}
                                  <FiClock size={12} className="text-red-500 shrink-0" />
                                  <span>Overdue</span>
                                  <span className="opacity-50">•</span>
                                  <span>{overdueItems.length}</span>
                                </div>
                              </div>
                            </div>
                          );
                          if (!collapsedGroups.overdue) {
                            overdueItems.forEach((task, index) => {
                              rows.push(renderTaskRow(task, todayActiveItems.length + index));
                            });
                          }
                        };

                        const pushCompleted = () => {
                          if (todayDoneItems.length === 0) return;
                          rows.push(
                            <div key="completed-header" className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2" onClick={() => setCollapsedGroups(prev => ({ ...prev, completed: !prev.completed }))}>
                              <div className="w-full py-2 flex items-center bg-transparent">
                                <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                                  {collapsedGroups.completed ? <FiChevronRight size={12} className="opacity-70" /> : <FiChevronDown size={12} className="opacity-70" />}
                                  <FiCheckCircle size={12} className="text-emerald-500 shrink-0" />
                                  <span>Completed</span>
                                  <span className="opacity-50">•</span>
                                  <span>{todayDoneItems.length}</span>
                                </div>
                              </div>
                            </div>
                          );
                          if (!collapsedGroups.completed) {
                            todayDoneItems.forEach((task, index) => {
                              rows.push(renderTaskRow(task, activeTasks.length + index));
                            });
                          }
                        };

                        const shouldShowOverdueFirst = todayActiveItems.length === 0 && overdueItems.length > 0;
                        if (shouldShowOverdueFirst) {
                          pushOverdue();
                          pushActive();
                          pushCompleted();
                        } else {
                          pushActive();
                          pushOverdue();
                          pushCompleted();
                        }

                        return <>{rows}</>;
                      })()}
                    </>
                  ) : activeSection === 'calendar' ? (
                    <>
                      <div className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2">
                        <div className="w-full py-2 flex items-center bg-transparent">
                          <div className="flex items-center gap-2 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                            <span>Tasks for {format(selectedDate, 'MMMM d, yyyy')}</span>
                            <span className="opacity-50">•</span>
                            <span>{activeTasks.length}</span>
                          </div>
                        </div>
                      </div>
                      {activeTasks.length === 0 ? (
                        renderCaughtUpState('All caught up', 'No tasks for this day.')
                      ) : (
                        activeTasks.map((task, index) => renderTaskRow(task, index))
                      )}
                    </>
                  ) : activeSection === 'scheduled' ? (
                    <>
                      <div className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2">
                        <div className="w-full py-2 flex items-center bg-transparent">
                          <div className="flex items-center gap-2 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                            <span>Upcoming Tasks</span>
                            <span className="opacity-50">•</span>
                            <span>{activeTasks.length}</span>
                          </div>
                        </div>
                      </div>
                      {activeTasks.length === 0 ? (
                        renderCaughtUpState('All caught up', 'No tasks scheduled.')
                      ) : (
                        activeTasks.map((task, index) => renderTaskRow(task, index))
                      )}
                    </>
                  ) : activeSection === 'done' ? (
                    <>
                      <div className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2">
                        <div className="w-full py-2 flex items-center bg-transparent">
                          <div className="flex items-center gap-2 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                            <span>Completed History</span>
                            <span className="opacity-50">•</span>
                            <span>{doneTasks.length}</span>
                          </div>
                        </div>
                      </div>
                      {doneTasks.length === 0 ? (
                        renderCaughtUpState('All caught up', 'No completed tasks yet.')
                      ) : (
                        doneTasks.map((task, index) => renderTaskRow(task, index))
                      )}
                    </>
                  ) : null}
                </>
              </div>            </div>
          </div>

          {(!isCreateModalOpen && !isSidebar) && (
            <div
              className="px-6 py-3 border-t flex items-center justify-end text-[11px] font-medium bg-[var(--color-editorBg)] border-white/[0.06] text-[#8b949e]">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <KeyHint keys={['Enter']} />
                  <span>Run / Mark Done</span>
                </div>
                <div className="flex items-center gap-2">
                  <KeyHint keys={['Esc']} />
                  <span>Back</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal Overlay for CreateTodoSelectionView — portal to body to escape parent stacking contexts */}
      {isCreateModalOpen && createPortal(
        <CreateTodoSelectionView
          items={finalConvertibleItems}
          onCreateTodo={async (data: any) => {
            await handleCreateFromSelection(data);
          }}
          isDarkMode={isDarkMode}
          initialItem={todoCreatePrefill}
          isEditMode={!!todoCreatePrefill?.todo_id}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          searchQuery={createSearchQuery}
          onSearchQueryChange={setCreateSearchQuery}
          scrollableRef={scrollableRef}
          onClose={() => {
            if (isCreateModalOnly) {
              onClose();
            } else {
              setIsCreateModalOpen(false);
              dispatch(setTodoCreatePrefill(null));
            }
          }}
        />,
        document.body
      )}

      {/* Inline Note Editor Overlay */}
      {inlineNoteId && createPortal(
        <div className="fixed inset-0 z-[100001] bg-black/60 backdrop-blur-sm">
          <FullScreenNoteView
            noteId={inlineNoteId || undefined}
            onBack={() => {
              setInlineNoteId(null);
              dispatch(setShowTodosView(false));
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
});

TodosList.displayName = 'TodosList';

export default TodosList;
