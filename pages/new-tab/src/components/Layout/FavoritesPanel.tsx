import React, { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Reorder, motion, useDragControls } from 'framer-motion';
import {
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedSnippet,
  selectShowFavorites,
  setActiveTutorial,
  selectActiveTutorial,
  setIsCreatingNewItem,
  openLinkEditModal,
  navigateToView,
  setShowTodosView,
  setTodoCreatePrefill,
  selectIsMac,
  setShowFavorites,
  selectIsCreateMenuOpen,
  selectIsLinkEditModalOpen,
  selectLinkEditPrefill,
  selectActiveLinkSnippet,
  setIsCreateMenuOpen,
  closeLinkEditModal,
  selectMainView,
} from '../../../../Redux/AllData/uiStateSlice';
import {
  selectAllData,
  optimisticUpdateSnippet,
  optimisticDeleteSnippet,
} from '../../../../Redux/AllData/allDataSlice';
import { getUserId } from '../../../../Apis/core/api';
import { updateSnippetRealtime } from '../../../../Apis/features/snippetApi';
import { deleteFavorite } from '../../../../Apis/services/favoritesApi';
import FavoriteItem from '../Items/FavoriteItem';
import {
  isLinkCategory as isOfficialLinkCategory,
  isTabGroupCategory as isOfficialTabGroupCategory,
  isPromptCategory,
  extractUrlsFromSnippet,
} from '../Views/HomeView/snippetInteractiveUtils';
import { getFaviconUrl, stripCmdStatus } from '../SearchComponents/Searchbar/utils';
import { Folder, Snippet } from '../../../../modals/interfaces';
import { HiOutlineStar, HiArrowsUpDown } from 'react-icons/hi2';
import { FaCheck, FaLink, FaCode, FaLayerGroup, FaSearch, FaTerminal, FaTimes } from 'react-icons/fa';
import { BsCalendarCheck } from 'react-icons/bs';
import NotesIcon from '../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import { FiEdit2, FiTrash2, FiPlus, FiLink, FiFileText, FiCode, FiZap, FiChevronDown, FiChevronUp, FiChevronRight, FiCheckSquare, FiMoreHorizontal } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { useCommands } from '../SearchComponents/Searchbar/useCommands';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../Shared/utils/hotkeyUtils';
import { TutorialCard, setTutorialStepFinished, clearTutorialStep } from '@src/components/Tutorial';

const chromeAny = chrome as any;

const extractUrlNamePair = (snippet: Snippet): { url: string; name: string }[] => {
  if (!snippet?.value) return [];

  let urls: string[] = [];
  let names: string[] = [];

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.urls)) {
          urls = parsed.urls;
        }
        if (Array.isArray(parsed.names)) {
          names = parsed.names;
        }
      }
    } catch {
      if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat')) {
        urls = [raw];
      }
    }
    if (urls.length === 0 && (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat'))) {
      urls = [raw];
    }
  } else if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      urls = (snippet.value as any).urls;
    }
    if ('names' in snippet.value && Array.isArray((snippet.value as any).names)) {
      names = (snippet.value as any).names;
    }
  }

  return urls.map((url, idx) => {
    let name = names[idx] || '';
    let targetUrl = url;

    // Convert note: URLs to correct full URLs
    if (url && url.startsWith('note:')) {
      const sid = url.replace('note:', '');
      targetUrl = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${sid}`);
      if (!name) name = 'Note';
    }

    if (!name && url) {
      try {
        const cleanUrl = url.trim();
        const hasProtocol = /^[a-z]+:\/\//i.test(cleanUrl);
        const urlToParse = hasProtocol ? cleanUrl : `https://${cleanUrl}`;
        const urlObj = new URL(urlToParse);
        name = urlObj.hostname.replace('www.', '');
      } catch {
        name = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Link';
      }
    }
    return { url: targetUrl, name };
  });
};

const DEFAULT_CREATE_ITEMS_ORDER = [
  'createlinks',
  'createnotes',
  'ai',
  'createtodo',
  'agent',
  'createsnippet',
  'createprompt',
];

const DragHandleIcon = () => (
  <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40 hover:opacity-100 transition-opacity">
    <circle cx="2" cy="2" r="1" fill="currentColor" />
    <circle cx="2" cy="6" r="1" fill="currentColor" />
    <circle cx="2" cy="10" r="1" fill="currentColor" />
    <circle cx="6" cy="2" r="1" fill="currentColor" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="10" r="1" fill="currentColor" />
  </svg>
);

const DropdownReorderItem = ({
  option,
  isDarkMode,
  visibleCreateItems,
  toggleItemVisibility
}: {
  option: { id: string; label: string };
  isDarkMode: boolean;
  visibleCreateItems: Record<string, boolean>;
  toggleItemVisibility: (id: string) => void;
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={option.id}
      value={option.id}
      className="list-none"
      dragListener={false}
      dragControls={dragControls}
    >
      <div
        className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] transition-colors duration-150 select-none
          ${isDarkMode ? 'hover:bg-white/5 text-neutral-300 hover:text-white' : 'hover:bg-black/5 text-[#586e75] hover:text-[#073642]'}`}
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Drag Handle */}
          <div
            className="cursor-grab active:cursor-grabbing p-1 text-neutral-500 hover:text-neutral-300 dark:hover:text-neutral-200"
            onPointerDown={(e) => {
              dragControls.start(e);
            }}
          >
            <DragHandleIcon />
          </div>
          <span
            className="font-medium cursor-pointer flex-1 py-1"
            onClick={() => toggleItemVisibility(option.id)}
          >
            {option.label}
          </span>
        </div>
        <div
          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150 shrink-0 cursor-pointer
            ${visibleCreateItems[option.id]
              ? 'bg-[#268bd2] border-[#268bd2] text-white'
              : (isDarkMode ? 'border-neutral-600 hover:border-neutral-400' : 'border-neutral-300 hover:border-neutral-500')
            }`}
          onClick={() => toggleItemVisibility(option.id)}
        >
          {visibleCreateItems[option.id] && <FaCheck size={8} />}
        </div>
      </div>
    </Reorder.Item>
  );
};

const FavoritesPanel = ({
  reload,
  isDarkMode,
  onCommandSelect,
  onSelectSavedAgent,
  onAutomationSelect,
  onOpenUrls,
  onNavigateToListView,
  onRequestEditLink,
  isSidebar = false,
}: {
  reload: () => void;
  isDarkMode: boolean;
  onCommandSelect: (id: string) => void;
  onSelectSavedAgent?: (agent: any) => void;
  onAutomationSelect?: (automation: any) => void;
  onOpenUrls?: (urls: string[], title?: string) => void;
  onNavigateToListView?: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  onRequestEditLink?: (suggestion: { snippet: any; workspace: any; folder: any }) => void;
  isSidebar?: boolean;
}) => {
  const dispatch = useDispatch();

  const isMac = useSelector(selectIsMac);
  const savedAgentSelect = onSelectSavedAgent;
  const showFavorites = useSelector(selectShowFavorites);
  const selectedTeam = useSelector(selectSelectedTeam);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedSnippet = useSelector(selectSelectedSnippet);
  const allData = useSelector(selectAllData);

  const handleStartExistingSession = useCallback(async (suggestion: { snippet: Snippet | any; workspace: any; folder: any }) => {
    const { snippet, workspace, folder } = suggestion;
    const sessionId = snippet.snippet_id || snippet.id;
    const sessionName = snippet.key || 'Untitled Session';
    const workspaceId = workspace?.workspace_id || workspace?.id;
    const folderId = folder?.folder_id || folder?.id;

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
    } catch (e) { }

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
      // Do not close the modal, keep it open as requested
    });
  }, [dispatch, selectedTeam]);

  // Find the Personal Space team globally
  const personalSpaceTeam = useMemo(() => {
    return (allData || []).find(team => team.is_personal_space === true);
  }, [allData]);

  const teamId = selectedTeam?.team_id || '';

  const [favoritesMapping, setFavoritesMapping] = useState<{ [key: string]: (Snippet | any)[] }>({});
  const [userId, setUserId] = useState<string>('');
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  // Quick-create menu state removed — items are now shown inline

  // Use shared hook for commands
  const { commands } = useCommands();
  const userCommandsMap = useMemo(() => {
    const map: Record<string, any> = {};
    commands.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [commands]);

  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hasBeenExpanded, setHasBeenExpanded] = useState<boolean>(false);
  const [isReordering, setIsReordering] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'hotkeys' | 'alphabetic' | 'custom'>('hotkeys');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [hoveredLinkItem, setHoveredLinkItem] = useState<{
    item: Snippet;
    top: number;
    viewportTop: number;
    height: number;
    maxHeight?: number;
  } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editUrlValue, setEditUrlValue] = useState<string>('');
  const [isAddingNewUrl, setIsAddingNewUrl] = useState<boolean>(false);
  const [newUrlValue, setNewUrlValue] = useState<string>('');
  const [isCreateExpanded, setIsCreateExpanded] = useState<boolean>(false);
  const showCreateMenu = useSelector(selectIsCreateMenuOpen);
  const mainView = useSelector(selectMainView);
  const isNotesMode = mainView?.kind === 'noteEditor';
  const isPromptsMode = mainView?.kind === 'promptEditor';
  const isLinkEditModalOpen = useSelector(selectIsLinkEditModalOpen);
  const linkEditPrefill = useSelector(selectLinkEditPrefill);
  const activeLinkSnippet = useSelector(selectActiveLinkSnippet);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; snippet: Snippet } | null>(null);

  const isSessionMode = isLinkEditModalOpen;
  const setShowCreateMenu = useCallback((val: boolean) => dispatch(setIsCreateMenuOpen(val)), [dispatch]);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [visibleCreateItems, setVisibleCreateItems] = useState<Record<string, boolean>>({
    createlinks: true,
    createnotes: true,
    ai: true,
    createtodo: true,
    agent: true,
    createsnippet: true,
    createprompt: true,
  });

  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chrome.storage.local.get(['favorites_create_visible_items'], (result) => {
      if (result.favorites_create_visible_items) {
        setVisibleCreateItems((prev) => ({
          ...prev,
          ...result.favorites_create_visible_items,
        }));
      }
    });
  }, []);

  const toggleItemVisibility = (id: string) => {
    const updated = {
      ...visibleCreateItems,
      [id]: !visibleCreateItems[id],
    };
    setVisibleCreateItems(updated);
    chrome.storage.local.set({ favorites_create_visible_items: updated });
  };

  const [createItemsOrder, setCreateItemsOrder] = useState<string[]>(DEFAULT_CREATE_ITEMS_ORDER);

  useEffect(() => {
    chrome.storage.local.get(['favorites_create_items_order'], (result) => {
      if (result.favorites_create_items_order) {
        setCreateItemsOrder(result.favorites_create_items_order);
      }
    });
  }, []);

  const handleReorderCreateItems = (newOrder: string[]) => {
    setCreateItemsOrder(newOrder);
    chrome.storage.local.set({ favorites_create_items_order: newOrder });
  };

  const allCreateOptions = useMemo(() => {
    const optionsMap: Record<string, { id: string; label: string }> = {
      createlinks: { id: 'createlinks', label: 'Link Collection' },
      createnotes: { id: 'createnotes', label: 'Notes' },
      ai: { id: 'ai', label: 'Chat Agent' },
      createtodo: { id: 'createtodo', label: 'Todo' },
      agent: { id: 'agent', label: 'Automation' },
      createsnippet: { id: 'createsnippet', label: 'Snippet' },
      createprompt: { id: 'createprompt', label: 'Prompt' },
    };
    return createItemsOrder.map(id => optionsMap[id]).filter(Boolean);
  }, [createItemsOrder]);

  const visibleOrderedItems = useMemo(() => {
    return createItemsOrder.filter(id => visibleCreateItems[id]);
  }, [createItemsOrder, visibleCreateItems]);

  const { mainItems, collapsedItems } = useMemo(() => {
    const main = visibleOrderedItems.slice(0, 5);
    const collapsed = visibleOrderedItems.slice(5);
    return { mainItems: main, collapsedItems: collapsed };
  }, [visibleOrderedItems]);

  const renderCreateItem = (id: string) => {
    switch (id) {
      case 'createlinks':
        return (
          <div
            key="createlinks"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createlinks');
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Link Collection
            </span>
          </div>
        );
      case 'createnotes':
        return (
          <div
            key="createnotes"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createnotes');
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Notes
            </span>
          </div>
        );
      case 'ai':
        return (
          <div
            key="ai"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('ai');
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Chat Agent
            </span>
          </div>
        );
      case 'createtodo':
        return (
          <div
            key="createtodo"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              dispatch(setTodoCreatePrefill({ isCreateModalOnly: true }));
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Todo
            </span>
          </div>
        );
      case 'agent':
        return (
          <div
            key="agent"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('agent');
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Automation
            </span>
          </div>
        );
      case 'createsnippet':
        return (
          <div
            key="createsnippet"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createsnippet');
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Snippet
            </span>
          </div>
        );
      case 'createprompt':
        return (
          <div
            key="createprompt"
            className="flex items-center cursor-pointer group py-[4px] pl-[12px]"
            onClick={e => {
              e.stopPropagation();
              onCommandSelect('createprompt');
            }}>
            <span
              className={`text-[12px] font-semibold tracking-tight transition-colors duration-150 ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'}`}>
              Prompt
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    const handleClickOutsideSettings = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideSettings);
    return () => document.removeEventListener('mousedown', handleClickOutsideSettings);
  }, []);

  const createMenuRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [todoStats, setTodoStats] = useState<{ completed: number; total: number; overdue: number } | null>(null);

  const updateTodoStats = useCallback(() => {
    chrome.storage.local.get(['local_todos'], result => {
      const localTodos = result.local_todos || [];
      const now = new Date();

      let todayTotal = 0;
      let todayCompleted = 0;
      let overdueCount = 0;

      localTodos.forEach((task: any) => {
        const deadlineStr = task.event_deadline;
        if (!deadlineStr) return;

        let deadline: Date;
        try {
          deadline = new Date(String(deadlineStr).replace(' ', 'T'));
        } catch {
          return;
        }
        if (isNaN(deadline.getTime())) return;

        // Overdue: not done and deadline is in the past
        if (!task.is_done && deadline.getTime() < now.getTime()) {
          overdueCount++;
        }

        // Check if it is scheduled for today
        const isTodayTask =
          // is today
          (deadline.getFullYear() === now.getFullYear() &&
            deadline.getMonth() === now.getMonth() &&
            deadline.getDate() === now.getDate()) ||
          // is overdue and not done
          (deadline.getTime() < now.getTime() && !task.is_done) ||
          // is anytime / dummy year
          task.is_anytime ||
          (deadlineStr.substring(0, 4) >= '2035');

        if (isTodayTask) {
          todayTotal++;
          if (task.is_done) {
            todayCompleted++;
          }
        }
      });

      setTodoStats({
        completed: todayCompleted,
        total: todayTotal,
        overdue: overdueCount,
      });
    });
  }, []);

  useEffect(() => {
    const checkCurrentWindowSession = async () => {
      try {
        const currentWindow = await new Promise<chrome.windows.Window>((resolve) => {
          chrome.windows.getCurrent({}, (w) => resolve(w));
        });
        if (currentWindow?.id) {
          chrome.storage.local.get('active_sessions', (result: any) => {
            const sessions = result.active_sessions || [];
            const matchedSession = sessions.find((s: any) => s.windowId === currentWindow.id);
            if (matchedSession) {
              setActiveSessionId(matchedSession.sessionId);
            } else {
              setActiveSessionId(null);
            }
          });
        }
      } catch (err) { }
    };

    checkCurrentWindowSession();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.active_sessions) {
        checkCurrentWindowSession();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Load userId and myFavouriteItems from storage on mount, then keep reactively in sync
  useEffect(() => {
    const loadFavoritesFromStorage = () => {
      chromeAny.storage.local.get(['myFavouriteItems'], (result: any) => {
        const mapping = result.myFavouriteItems || {};
        setFavoritesMapping(mapping);
      });
    };

    // Initial load of userId + favorites
    getUserId()
      .then(uid => {
        setUserId(uid);
        loadFavoritesFromStorage();
      })
      .catch((err) => {
        console.error('[FavoritesPanel] Failed initial mount userId fetch:', err);
        loadFavoritesFromStorage();
      });

    // Reactive update when LinkEditModal (or anything else) writes to myFavouriteItems or auth state changes
    const handleFavStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.myFavouriteItems) {
        const newMapping = changes.myFavouriteItems.newValue || {};
        setFavoritesMapping(newMapping);
      }
      if (changes.accessToken) {
        const newVal = changes.accessToken.newValue;
        const resolvedId = newVal && newVal.startsWith('user_') ? newVal : 'local_user';
        setUserId(resolvedId);
      }
    };
    chromeAny.storage.onChanged.addListener(handleFavStorageChange);
    return () => chromeAny.storage.onChanged.removeListener(handleFavStorageChange);
  }, []);

  useEffect(() => {
    updateTodoStats();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.local_todos) {
        updateTodoStats();
      }
    };

    window.addEventListener('todosUpdated', updateTodoStats);
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener('todosUpdated', updateTodoStats);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [updateTodoStats]);

  // Close create menu on click outside
  useEffect(() => {
    const handleClickOutsideMenu = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, []);

  useEffect(() => {
    (window as any).isFavoritesMenuOpen = showCreateMenu;
    return () => {
      (window as any).isFavoritesMenuOpen = false;
    };
  }, [showCreateMenu]);

  useEffect(() => {
    if (!showCreateMenu) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCreateMenu(false);
        return;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [showCreateMenu, setShowCreateMenu]);

  const handleInlineEditLink = useCallback((item: Snippet | null, element: HTMLElement | null) => {
    if (!item || !element) {
      setHoveredLinkItem(null);
      return;
    }

    const category = item.category?.toLowerCase();
    const isLink =
      isOfficialLinkCategory(item.category) ||
      isOfficialTabGroupCategory(item.category) ||
      category === 'link' ||
      category === 'tabgroup' ||
      category === 'tab group' ||
      category === 'bulk_link' ||
      category === 'biolink';

    if (!isLink) {
      setHoveredLinkItem(null);
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const height = elementRect.height;

    // Use the same coordinate trick as the Create menu:
    // store the viewport y of the item so the absolute-positioned popup
    // (whose containing block starts at y≈0) renders at the right place.
    // Centre the popup on the item vertically.
    const pairs = extractUrlNamePair(item);
    const urlCount = pairs.length;
    const estimatedHeight = Math.min(300, Math.max(1, urlCount) * 38 + 36);
    const viewportHeight = window.innerHeight;

    // mid-point of item in viewport coordinates
    let viewportTop = elementRect.top + height / 2 - estimatedHeight / 2;

    // clamp so popup stays on screen
    if (viewportTop + estimatedHeight > viewportHeight - 8) {
      viewportTop = viewportHeight - 8 - estimatedHeight;
    }
    if (viewportTop < 8) viewportTop = 8;

    const safeMaxHeight = Math.min(320, viewportHeight - 32);

    setHoveredLinkItem({
      item,
      top: viewportTop, // used as absolute top (same trick as createMenuPos.top)
      viewportTop,
      height,
      maxHeight: safeMaxHeight,
    });
  }, []);

  // Prevent global/parent keyboard actions when the URLs popover or edit mode is open
  useEffect(() => {
    if (hoveredLinkItem !== null) {
      (window as any).isFavoritesMenuOpen = true;
    } else {
      (window as any).isFavoritesMenuOpen = false;
    }
    return () => {
      (window as any).isFavoritesMenuOpen = false;
    };
  }, [hoveredLinkItem]);

  const getRawUrl = (snippet: Snippet, index: number): string => {
    if (!snippet?.value) return '';
    try {
      if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.urls)) {
            return parsed.urls[index] || '';
          }
        }
        return raw;
      } else if (typeof snippet.value === 'object' && snippet.value) {
        const parsed = snippet.value as any;
        if (Array.isArray(parsed.urls)) {
          return parsed.urls[index] || '';
        }
      }
    } catch { }
    return '';
  };

  const handleStartEdit = (index: number) => {
    if (!hoveredLinkItem?.item) return;
    const rawUrl = getRawUrl(hoveredLinkItem.item, index);
    setEditUrlValue(rawUrl);
    setEditingIndex(index);
  };

  const handleSaveUrl = async (index: number, manualUrl?: string) => {
    if (!hoveredLinkItem?.item || editingIndex === null) return;
    const updatedUrl = (manualUrl !== undefined ? manualUrl : editUrlValue).trim();
    if (!updatedUrl) {
      setEditingIndex(null);
      return;
    }

    let normalizedUrl = updatedUrl;
    if (
      !/^[a-z]+:\/\//i.test(normalizedUrl) &&
      !normalizedUrl.startsWith('note:') &&
      !normalizedUrl.startsWith('agent_chat')
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const snippet = hoveredLinkItem.item;
      let newValue = '';
      if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.urls)) {
            const updatedUrls = [...parsed.urls];
            updatedUrls[index] = normalizedUrl;

            const updatedNames = Array.isArray(parsed.names) ? [...parsed.names] : [];
            try {
              const urlObj = new URL(normalizedUrl);
              updatedNames[index] = urlObj.hostname.replace('www.', '');
            } catch {
              updatedNames[index] = normalizedUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Link';
            }

            newValue = JSON.stringify({
              ...parsed,
              urls: updatedUrls,
              names: updatedNames,
            });
          } else {
            newValue = normalizedUrl;
          }
        } catch {
          newValue = normalizedUrl;
        }
      } else if (typeof snippet.value === 'object' && snippet.value) {
        const parsed = snippet.value as any;
        const updatedUrls = Array.isArray(parsed.urls) ? [...parsed.urls] : [];
        updatedUrls[index] = normalizedUrl;

        const updatedNames = Array.isArray(parsed.names) ? [...parsed.names] : [];
        try {
          const urlObj = new URL(normalizedUrl);
          updatedNames[index] = urlObj.hostname.replace('www.', '');
        } catch {
          updatedNames[index] = normalizedUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Link';
        }

        newValue = JSON.stringify({
          ...parsed,
          urls: updatedUrls,
          names: updatedNames,
        });
      }

      const snippetId = snippet.id || snippet.snippet_id;
      await updateSnippetRealtime({
        snippet_id: snippetId,
        key: snippet.key,
        category: snippet.category as any,
        value: newValue,
      });

      // Find the workspace and folder from favoritesWithFolders
      const matchedFav = favoritesWithFolders.find(f => f.item.id === snippet.id);
      const matchedWorkspaceId = matchedFav?.workspace?.workspace_id || '';
      const matchedFolderId = matchedFav?.folder?.folder_id || null;

      // Update Redux cache
      const resolvedTeam = allData?.find(t => (t.workspaces || []).some(w => w.workspace_id === matchedWorkspaceId));
      const effectiveTeamId = resolvedTeam?.team_id || teamId || userId;

      if (matchedWorkspaceId) {
        dispatch(
          optimisticUpdateSnippet({
            teamId: effectiveTeamId,
            workspaceId: matchedWorkspaceId,
            folderId: matchedFolderId,
            snippet: {
              ...snippet,
              tags: (snippet.tags || undefined) as any,
              value: newValue,
              updated_at: new Date().toISOString(),
            } as any,
          }),
        );
      }

      // Update local state so the popover shows the updated URL instantly
      setHoveredLinkItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          item: {
            ...prev.item,
            value: newValue,
          },
        };
      });

      // Sync local storage mapping so the cache is kept in perfect alignment
      chrome.storage.local.get('myFavouriteItems', (result: any) => {
        const favItems = result.myFavouriteItems || {};
        Object.keys(favItems).forEach(key => {
          const list = favItems[key];
          if (Array.isArray(list)) {
            let updated = false;
            const newList = list.map(item => {
              if (item.id === snippet.id) {
                updated = true;
                return {
                  ...item,
                  value: newValue,
                };
              }
              return item;
            });
            if (updated) {
              favItems[key] = newList;
            }
          }
        });
        chrome.storage.local.set({ myFavouriteItems: favItems }, () => {
          setFavoritesMapping(favItems);
        });
      });

      reload();
    } catch (err) {
      console.error('Failed to update inline URL:', err);
    } finally {
      setEditingIndex(null);
    }
  };

  const handleAddNewSave = async (newUrl: string) => {
    if (!hoveredLinkItem?.item) return;
    const trimmed = newUrl.trim();
    if (!trimmed) {
      setIsAddingNewUrl(false);
      setNewUrlValue('');
      return;
    }

    let normalizedUrl = trimmed;
    if (
      !/^[a-z]+:\/\//i.test(normalizedUrl) &&
      !normalizedUrl.startsWith('note:') &&
      !normalizedUrl.startsWith('agent_chat')
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const snippet = hoveredLinkItem.item;

      // Parse current URLs and names from the snippet value
      let currentUrls: string[] = [];
      let currentNames: string[] = [];

      if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        try {
          if (raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              currentUrls = Array.isArray(parsed.urls) ? parsed.urls : [];
              currentNames = Array.isArray(parsed.names) ? parsed.names : [];
            }
          } else if (raw) {
            currentUrls = [raw];
            currentNames = [snippet.key || ''];
          }
        } catch {
          if (raw) {
            currentUrls = [raw];
            currentNames = [snippet.key || ''];
          }
        }
      } else if (typeof snippet.value === 'object' && snippet.value) {
        const parsed = snippet.value as any;
        currentUrls = Array.isArray(parsed.urls) ? parsed.urls : [];
        currentNames = Array.isArray(parsed.names) ? parsed.names : [];
      }

      // Extract hostname as the display name for the new URL
      let host = '';
      try {
        const urlObj = new URL(normalizedUrl);
        host = urlObj.hostname.replace('www.', '');
      } catch {
        host = normalizedUrl;
      }

      // Append the new URL and name
      currentUrls.push(normalizedUrl);
      currentNames.push(host);

      const newValue = JSON.stringify({
        urls: currentUrls,
        names: currentNames,
      });

      const snippetId = snippet.snippet_id || snippet.id;

      // 1. Call cloud API (same as handleSaveUrl)
      await updateSnippetRealtime({
        snippet_id: snippetId,
        key: snippet.key,
        category: snippet.category as any,
        value: newValue,
      });

      // 2. Find the workspace and folder from favoritesWithFolders
      const matchedFav = favoritesWithFolders.find(f => f.item.id === snippet.id);
      const matchedWorkspaceId = matchedFav?.workspace?.workspace_id || '';
      const matchedFolderId = matchedFav?.folder?.folder_id || null;

      // 3. Update Redux cache
      const resolvedTeam = allData?.find(t => (t.workspaces || []).some(w => w.workspace_id === matchedWorkspaceId));
      const effectiveTeamId = resolvedTeam?.team_id || teamId || userId;

      if (matchedWorkspaceId) {
        dispatch(
          optimisticUpdateSnippet({
            teamId: effectiveTeamId,
            workspaceId: matchedWorkspaceId,
            folderId: matchedFolderId,
            snippet: {
              ...snippet,
              tags: (snippet.tags || undefined) as any,
              value: newValue,
              updated_at: new Date().toISOString(),
            } as any,
          }),
        );
      }

      // 4. Update local state so the popover shows the new URL instantly
      setHoveredLinkItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          item: {
            ...prev.item,
            value: newValue,
          },
        };
      });

      // 5. Sync local storage mapping so the cache is kept in perfect alignment
      chrome.storage.local.get('myFavouriteItems', (result: any) => {
        const favItems = result.myFavouriteItems || {};
        Object.keys(favItems).forEach(key => {
          const list = favItems[key];
          if (Array.isArray(list)) {
            let updated = false;
            const newList = list.map(item => {
              if (item.id === snippet.id) {
                updated = true;
                return {
                  ...item,
                  value: newValue,
                };
              }
              return item;
            });
            if (updated) {
              favItems[key] = newList;
            }
          }
        });
        chrome.storage.local.set({ myFavouriteItems: favItems }, () => {
          setFavoritesMapping(favItems);
        });
      });

      reload();
    } catch (err) {
      console.error('Failed to add new URL:', err);
    } finally {
      setIsAddingNewUrl(false);
      setNewUrlValue('');
    }
  };

  const handleDeleteUrl = async (index: number) => {
    if (!hoveredLinkItem?.item) return;
    const snippet = hoveredLinkItem.item;
    try {
      let newValue = '';
      let remainingCount = 0;

      if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.urls)) {
            const updatedUrls = parsed.urls.filter((_: any, i: number) => i !== index);
            const updatedNames = Array.isArray(parsed.names)
              ? parsed.names.filter((_: any, i: number) => i !== index)
              : [];
            remainingCount = updatedUrls.length;

            newValue = JSON.stringify({
              ...parsed,
              urls: updatedUrls,
              names: updatedNames,
            });
          }
        } catch { }
      } else if (typeof snippet.value === 'object' && snippet.value) {
        const parsed = snippet.value as any;
        if (Array.isArray(parsed.urls)) {
          const updatedUrls = parsed.urls.filter((_: any, i: number) => i !== index);
          const updatedNames = Array.isArray(parsed.names)
            ? parsed.names.filter((_: any, i: number) => i !== index)
            : [];
          remainingCount = updatedUrls.length;

          newValue = JSON.stringify({
            ...parsed,
            urls: updatedUrls,
            names: updatedNames,
          });
        }
      }

      if (remainingCount === 0) {
        // No URLs left - remove from favorites completely
        const currentList = favoritesMapping[userId] || [];
        const newList = currentList.filter(item => item.id !== snippet.id);
        setFavoritesMapping({ ...favoritesMapping, [userId]: newList });
        chrome.storage.local.get('myFavouriteItems', (result: any) => {
          const favItems = result.myFavouriteItems || {};
          favItems[userId] = newList;
          chrome.storage.local.set({ myFavouriteItems: favItems });
        });

        // Find the workspace and folder from favoritesWithFolders
        const matchedFav = favoritesWithFolders.find(f => f.item.id === snippet.id);
        const matchedWorkspaceId = matchedFav?.workspace?.workspace_id || '';
        const matchedFolderId = matchedFav?.folder?.folder_id || null;

        // Update Redux cache
        const resolvedTeam = allData?.find(t => (t.workspaces || []).some(w => w.workspace_id === matchedWorkspaceId));
        const effectiveTeamId = resolvedTeam?.team_id || teamId || userId;

        if (matchedWorkspaceId) {
          dispatch(
            optimisticDeleteSnippet({
              teamId: effectiveTeamId,
              workspaceId: matchedWorkspaceId,
              folderId: matchedFolderId,
              snippetId: snippet.id,
            }),
          );
        }

        if ((snippet as any).favourite_id) {
          deleteFavorite(userId, (snippet as any).favourite_id).catch((err: any) => {
            console.error('Failed to delete favorite:', err);
          });
        }
        setHoveredLinkItem(null);
      } else {
        // Update snippet value
        const snippetId = snippet.id || snippet.snippet_id;
        await updateSnippetRealtime({
          snippet_id: snippetId,
          key: snippet.key,
          category: snippet.category as any,
          value: newValue,
        });

        // Find the workspace and folder from favoritesWithFolders
        const matchedFav = favoritesWithFolders.find(f => f.item.id === snippet.id);
        const matchedWorkspaceId = matchedFav?.workspace?.workspace_id || '';
        const matchedFolderId = matchedFav?.folder?.folder_id || null;

        // Update Redux
        const resolvedTeam = allData?.find(t => (t.workspaces || []).some(w => w.workspace_id === matchedWorkspaceId));
        const effectiveTeamId = resolvedTeam?.team_id || teamId || userId;

        if (matchedWorkspaceId) {
          dispatch(
            optimisticUpdateSnippet({
              teamId: effectiveTeamId,
              workspaceId: matchedWorkspaceId,
              folderId: matchedFolderId,
              snippet: {
                ...snippet,
                tags: (snippet.tags || undefined) as any,
                value: newValue,
                updated_at: new Date().toISOString(),
              } as any,
            }),
          );
        }

        // Update local state
        setHoveredLinkItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            item: {
              ...prev.item,
              value: newValue,
            },
          };
        });

        // Sync local storage mapping so cache stays in sync
        chrome.storage.local.get('myFavouriteItems', (result: any) => {
          const favItems = result.myFavouriteItems || {};
          Object.keys(favItems).forEach(key => {
            const list = favItems[key];
            if (Array.isArray(list)) {
              let updated = false;
              const newList = list.map(item => {
                if (item.id === snippet.id) {
                  updated = true;
                  return {
                    ...item,
                    value: newValue,
                  };
                }
                return item;
              });
              if (updated) {
                favItems[key] = newList;
              }
            }
          });
          chrome.storage.local.set({ myFavouriteItems: favItems }, () => {
            setFavoritesMapping(favItems);
          });
        });
      }
      reload();
    } catch (err) {
      console.error('Failed to delete URL:', err);
    }
  };

  // Load sort order
  useEffect(() => {
    chrome.storage.local.get('favoritesSortOrder', result => {
      if (result.favoritesSortOrder) {
        setSortOrder(result.favoritesSortOrder);
      }
    });

    // Close menu on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSortChange = (newOrder: 'hotkeys' | 'alphabetic' | 'custom') => {
    setSortOrder(newOrder);
    chrome.storage.local.set({ favoritesSortOrder: newOrder });
    setShowSortMenu(false);
  };

  // Track if panel has been expanded by hover
  useEffect(() => {
    if (isHovered && !showFavorites) {
      setHasBeenExpanded(true);
    }
  }, [isHovered, showFavorites]);

  // Reset expanded state when showFavorites is toggled on
  useEffect(() => {
    if (showFavorites) {
      setHasBeenExpanded(false);
    }
  }, [showFavorites]);

  const showFavoritesTutorial = useSelector(selectActiveTutorial) === 'favorites';

  // Tutorial event listeners handled centrally in App.tsx

  const handleCloseTutorial = async () => {
    await setTutorialStepFinished('favorites');
    dispatch(setActiveTutorial('agent'));
  };

  const handleGoPrev = async () => {
    // Clear flag to allow Step 1 to show again
    await clearTutorialStep('search');
    dispatch(setActiveTutorial('search'));
  };

  // 1. Fetch User ID once
  useEffect(() => {
    const fetchUserIdFromApi = async () => {
      try {
        const uid = await getUserId();
        if (uid) setUserId(uid);
      } catch (err) {
        console.error('[FavoritesPanel] Failed to get userId:', err);
      }
    };
    fetchUserIdFromApi();
  }, []);

  // Initialize default favorites once for new installations
  useEffect(() => {
    if (!userId) return;

    chrome.storage.local.get(['favorites_initialized', 'myFavouriteItems'], (result) => {
      const isInitialized = result.favorites_initialized;
      const favItems = result.myFavouriteItems || {};
      const userFavs = favItems[userId];

      if (isInitialized || (userFavs && userFavs.length > 0)) {
        if (!isInitialized) {
          chrome.storage.local.set({ favorites_initialized: true });
        }
        return;
      }

      if (!userFavs || userFavs.length === 0) {
        const defaultItems: any[] = [];
        const updatedFavItems = {
          ...favItems,
          [userId]: defaultItems
        };
        chrome.storage.local.set({
          myFavouriteItems: updatedFavItems,
          favorites_initialized: true
        }, () => {
          setFavoritesMapping(updatedFavItems);
        });
      }
    });
  }, [userId]);

  // Load maps from storage
  useEffect(() => {
    const loadMaps = async () => {
      const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap(allHotkeys);
      setShortcutsMap(allShortcuts);
    };

    loadMaps();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (
        changes.alts_command_hotkeys ||
        changes.alts_link_hotkeys ||
        changes.alts_note_hotkeys ||
        changes.alts_commands || // Include cloud-synced commands
        changes.note_commands ||
        changes.link_commands
      ) {
        loadMaps();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Sync with storage on mount and when teamId changes
  useEffect(() => {
    chrome.storage.local.get('myFavouriteItems', result => {
      setFavoritesMapping(result.myFavouriteItems || {});
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.myFavouriteItems) {
        setFavoritesMapping(changes.myFavouriteItems.newValue || {});
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Helper to find all folders and workspaces containing the snippet
  const getLocationsBySnippetId = useCallback(
    (snippetId: string): { snippet: Snippet; folder: Folder | null; workspace: any }[] => {
      const locations: { snippet: Snippet; folder: Folder | null; workspace: any }[] = [];

      // 1. Search in Active Org
      if (selectedTeam) {
        for (const workspace of selectedTeam.workspaces || []) {
          for (const folder of workspace.folders || []) {
            const match = (folder.snippets ?? []).find(
              snippet => snippet.id === snippetId || snippet.snippet_id === snippetId,
            );
            if (match) locations.push({ snippet: match, folder, workspace });
          }
          const matchInWorkspace = (workspace.workspace_snippets ?? []).find(
            snippet => snippet.id === snippetId || snippet.snippet_id === snippetId,
          );
          if (matchInWorkspace) locations.push({ snippet: matchInWorkspace, folder: null, workspace });
        }
      }

      // 2. Search in Personal Space (if different from active org)
      if (personalSpaceTeam && personalSpaceTeam.team_id !== selectedTeam?.team_id) {
        for (const workspace of personalSpaceTeam.workspaces || []) {
          for (const folder of workspace.folders || []) {
            const match = (folder.snippets ?? []).find(
              snippet => snippet.id === snippetId || snippet.snippet_id === snippetId,
            );
            if (match) locations.push({ snippet: match, folder, workspace });
          }
          const matchInWorkspace = (workspace.workspace_snippets ?? []).find(
            snippet => snippet.id === snippetId || snippet.snippet_id === snippetId,
          );
          if (matchInWorkspace) locations.push({ snippet: matchInWorkspace, folder: null, workspace });
        }
      }

      return locations;
    },
    [selectedTeam, personalSpaceTeam],
  );

  const favoritesWithFolders = useMemo(() => {
    // Combine Personal favorites and Current Org favorites
    const personalFavs = favoritesMapping[userId] || [];
    const orgFavs = teamId && teamId !== userId ? favoritesMapping[teamId] || [] : [];

    // Merge and deduplicate by ID
    const combinedFavs: any[] = [...personalFavs];
    const seenIds = new Set(personalFavs.map(f => f.id || f.snippet_id));

    orgFavs.forEach(f => {
      const id = f.id || f.snippet_id;
      if (!seenIds.has(id)) {
        combinedFavs.push(f);
        seenIds.add(id);
      }
    });

    const results: { item: Snippet | any; folder: Folder | null; workspace: any; compoundId: string }[] = [];

    combinedFavs.forEach(item => {
      // If it's a command or agent/automation item, bypass workspace check and inject live prefix
      if (('type' in item && item.type === 'command') || item.category === 'automation' || item.category === 'agent') {
        const storedCmd = userCommandsMap[item.id];
        const dynamicPrefix = storedCmd ? storedCmd.prefix : item.commandPrefix;
        results.push({
          item: { ...item, commandPrefix: dynamicPrefix },
          folder: null,
          workspace: null,
          compoundId: item.id || item.automation_id || item.snippet_id,
        });
        return;
      }


      // Otherwise, look it up in workspace (for Snippets)
      const id = item.id || item.snippet_id;
      const locations = getLocationsBySnippetId(id);

      if (locations.length > 0) {
        locations.forEach(location => {
          // Use live snippet data but preserve favorite metadata and display names
          const liveItem = {
            ...item,
            ...location.snippet,
            // Ensure we don't overwrite a good key with undefined
            key: location.snippet.key || item.key,
            favourite_id: item.favourite_id || item.favorite_id,
          };
          const cId = getItemCompoundId({
            suggestion: { folder: location.folder, workspace: location.workspace, snippet: location.snippet },
          });
          results.push({ item: liveItem, folder: location.folder, workspace: location.workspace, compoundId: cId });
        });
      } else {
        // Fallback for items that might be in storage but not found in current Redux tree (e.g. from other teams not loaded)
        results.push({
          item: { ...item, category: item.category || 'note' },
          folder: null,
          workspace: null,
          compoundId: id,
        });
      }
    });

    if (sortOrder === 'custom') {
      return results;
    }

    return results.sort((a, b) => {
      const nameA = (a.item.label || a.item.key || '').toLowerCase();
      const nameB = (b.item.label || b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];

        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        // Both have or both don't have: sort by name
        return nameA.localeCompare(nameB);
      }

      if (sortOrder === 'alphabetic') {
        return nameA.localeCompare(nameB);
      }

      return 0;
    });
  }, [favoritesMapping, teamId, getLocationsBySnippetId, userCommandsMap, userId, sortOrder, hotkeysMap, allData]);

  const allLinksWithFolders = useMemo(() => {
    const snippets: { item: Snippet | any; folder: Folder | null; workspace: any; compoundId: string }[] = [];

    const collectFolderSnippetsDeep = (folder: any): any[] => {
      const acc = [...(folder.snippets || folder.folder_snippets || [])];
      (folder.folders || []).forEach((f: any) => acc.push(...collectFolderSnippetsDeep(f)));
      return acc;
    };
    const collectWorkspaceSnippetsDeep = (workspace: any): any[] => {
      const acc = [...(workspace.workspace_snippets || [])];
      (workspace.folders || []).forEach((f: any) => acc.push(...collectFolderSnippetsDeep(f)));
      return acc;
    };

    (allData || []).forEach((team: any) => {
      (team.workspaces || []).forEach((workspace: any) => {
        const wsSnippets = collectWorkspaceSnippetsDeep(workspace);
        wsSnippets.forEach(snip => {
          const cat = (snip.category || '').toLowerCase();
          const isLink =
            isOfficialLinkCategory(snip.category) ||
            isOfficialTabGroupCategory(snip.category) ||
            cat === 'link' ||
            cat === 'tabgroup' ||
            cat === 'tab group' ||
            cat === 'bulk_link' ||
            cat === 'biolink';

          if (isLink) {
            snippets.push({
              item: { ...snip, key: snip.key || 'Untitled Link' },
              folder: null, // Resolving exact folder is heavy; sufficient for list
              workspace,
              compoundId: snip.id || snip.snippet_id || '',
            });
          }
        });
      });
    });

    // Deduplicate by snippet ID just in case
    const seen = new Set();
    const deduped = snippets.filter(s => {
      if (seen.has(s.item.id)) return false;
      seen.add(s.item.id);
      return true;
    });

    if (sortOrder === 'custom') {
      return deduped; // No custom sort config for all links
    }

    return deduped.sort((a, b) => {
      const nameA = (a.item.label || a.item.key || '').toLowerCase();
      const nameB = (b.item.label || b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];
        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        return nameA.localeCompare(nameB);
      }

      if (sortOrder === 'alphabetic') {
        return nameA.localeCompare(nameB);
      }

      return 0; // Return raw deduped if custom
    });
  }, [allData, sortOrder, hotkeysMap]);

  const allNotesWithFolders = useMemo(() => {
    const snippets: { item: Snippet | any; folder: Folder | null; workspace: any; compoundId: string }[] = [];

    const collectFolderSnippetsDeep = (folder: any, workspace: any): void => {
      (folder.snippets || folder.folder_snippets || []).forEach((snip: any) => {
        const cat = (snip.category || '').toLowerCase();
        if (cat === 'note' || cat === 'snippet') {
          snippets.push({
            item: { ...snip, key: snip.key || 'Untitled Note' },
            folder: folder,   // ← correctly pass the actual folder
            workspace,
            compoundId: snip.id || snip.snippet_id || '',
          });
        }
      });
      (folder.folders || []).forEach((f: any) => collectFolderSnippetsDeep(f, workspace));
    };

    (allData || []).forEach((team: any) => {
      (team.workspaces || []).forEach((workspace: any) => {
        // Workspace-level snippets (no folder)
        (workspace.workspace_snippets || []).forEach((snip: any) => {
          const cat = (snip.category || '').toLowerCase();
          if (cat === 'note' || cat === 'snippet') {
            snippets.push({
              item: { ...snip, key: snip.key || 'Untitled Note' },
              folder: null,
              workspace,
              compoundId: snip.id || snip.snippet_id || '',
            });
          }
        });
        // Folder-level snippets (with correct folder context)
        (workspace.folders || []).forEach((f: any) => collectFolderSnippetsDeep(f, workspace));
      });
    });

    const seen = new Set();
    const deduped = snippets.filter(s => {
      if (seen.has(s.item.id)) return false;
      seen.add(s.item.id);
      return true;
    });

    if (sortOrder === 'custom') return deduped;

    return deduped.sort((a, b) => {
      const nameA = (a.item.label || a.item.key || '').toLowerCase();
      const nameB = (b.item.label || b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];
        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        return nameA.localeCompare(nameB);
      }

      if (sortOrder === 'alphabetic') return nameA.localeCompare(nameB);
      return 0;
    });
  }, [allData, sortOrder, hotkeysMap]);

  const allPromptsWithFolders = useMemo(() => {
    const snippets: { item: Snippet | any; folder: Folder | null; workspace: any; compoundId: string }[] = [];

    const collectFolderSnippetsDeep = (folder: any, workspace: any): void => {
      (folder.snippets || folder.folder_snippets || []).forEach((snip: any) => {
        const cat = (snip.category || '').toLowerCase();
        if (cat === 'prompt') {
          snippets.push({
            item: { ...snip, key: snip.key || 'Untitled Prompt' },
            folder: folder,  // ← correctly pass the actual folder
            workspace,
            compoundId: snip.id || snip.snippet_id || '',
          });
        }
      });
      (folder.folders || []).forEach((f: any) => collectFolderSnippetsDeep(f, workspace));
    };

    (allData || []).forEach((team: any) => {
      (team.workspaces || []).forEach((workspace: any) => {
        // Workspace-level prompts (no folder)
        (workspace.workspace_snippets || []).forEach((snip: any) => {
          const cat = (snip.category || '').toLowerCase();
          if (cat === 'prompt') {
            snippets.push({
              item: { ...snip, key: snip.key || 'Untitled Prompt' },
              folder: null,
              workspace,
              compoundId: snip.id || snip.snippet_id || '',
            });
          }
        });
        // Folder-level prompts (with correct folder context)
        (workspace.folders || []).forEach((f: any) => collectFolderSnippetsDeep(f, workspace));
      });
    });

    const seen = new Set();
    const deduped = snippets.filter(s => {
      if (seen.has(s.item.id)) return false;
      seen.add(s.item.id);
      return true;
    });

    if (sortOrder === 'custom') return deduped;

    return deduped.sort((a, b) => {
      const nameA = (a.item.label || a.item.key || '').toLowerCase();
      const nameB = (b.item.label || b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];
        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        return nameA.localeCompare(nameB);
      }

      if (sortOrder === 'alphabetic') return nameA.localeCompare(nameB);
      return 0;
    });
  }, [allData, sortOrder, hotkeysMap]);

  const displayList = useMemo(() => {
    const baseList = isPromptsMode ? allPromptsWithFolders : isNotesMode ? allNotesWithFolders : isSessionMode ? allLinksWithFolders : favoritesWithFolders;
    const activeId = (isNotesMode || isPromptsMode)
      ? (selectedSnippet?.id || selectedSnippet?.snippet_id)
      : (activeLinkSnippet?.id || activeLinkSnippet?.snippet_id || activeSessionId);
    if ((isSessionMode || isNotesMode || isPromptsMode) && activeId) {
      const activeIdStr = String(activeId).toLowerCase();
      return baseList.filter((f: any) => {
        const itemId = String(f.item?.id || f.item?.snippet_id || '').toLowerCase();
        return itemId !== activeIdStr;
      });
    }
    return baseList;
  }, [isSessionMode, isNotesMode, isPromptsMode, allLinksWithFolders, allNotesWithFolders, allPromptsWithFolders, favoritesWithFolders, activeLinkSnippet, activeSessionId, selectedSnippet]);

  const handleReorder = (newOrderIds: string[]) => {
    try {
      const reorderedItems = newOrderIds
        .map(cid => {
          const found = displayList.find((f: any) => f.compoundId === cid);
          return found ? found.item : null;
        })
        .filter(Boolean);

      chrome.storage.local.get('myFavouriteItems', result => {
        const favItems = result.myFavouriteItems || {};
        favItems[userId] = reorderedItems;
        chrome.storage.local.set({ myFavouriteItems: favItems }, () => {
          setFavoritesMapping(favItems);
        });
      });
    } catch (error) {
      console.error('Error reordering favorites:', error);
    }
  };



  const handleAddNewFavorite = () => {
    dispatch(setIsCreatingNewItem(true));
    dispatch(navigateToView({ kind: 'linkEditor' }));
    dispatch(openLinkEditModal({ editMode: false, snippet: null }));
  };

  const urlPairs = useMemo(() => {
    if (!hoveredLinkItem?.item) return [];
    return extractUrlNamePair(hoveredLinkItem.item);
  }, [hoveredLinkItem]);

  // Show collapsed star icon when showFavorites is disabled
  const shouldShowCollapsed = false;
  const shouldExpand = isHovered || showFavorites || hasBeenExpanded;

  return (
    <div
      className={`relative overflow-visible favorites-panel-container flex flex-col transition-all duration-500 ${showFavoritesTutorial ? 'z-[9999]' : 'z-40'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: isSidebar ? '100%' : undefined,
      }}>
      {shouldShowCollapsed && !shouldExpand && !isSidebar ? (
        // Collapsed state - just show star icon (but hover area is full width)
        <div className="w-full h-full flex items-start justify-start pt-0">
          <div className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-r-xl cursor-pointer">
            <HiOutlineStar className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
        </div>
      ) : (
        // Expanded state - show full panel
        <div
          className={`relative flex flex-col overflow-visible w-full transition-all duration-500
            ${isSidebar ? 'h-full border-0 rounded-none bg-transparent' : 'h-auto min-h-[160px] max-h-[55vh] border rounded-r-xl rounded-br-none ml-0 mr-auto'}
            ${showFavoritesTutorial ? 'z-[9999] border-[#22c55e] ring-1 ring-[#22c55e]/20 bg-black/60 rounded-r-2xl pointer-events-none' : !isSidebar && isDarkMode ? 'bg-frostedwhite border-white/10 shadow-sm pointer-events-auto' : 'pointer-events-auto'}`}
          style={{
            background: !showFavoritesTutorial && !isDarkMode && !isSidebar ? '#fdf6e3' : '',
            ...(!showFavoritesTutorial && !isDarkMode && !isSidebar ? { borderColor: '#eee8d5' } : {}),
            ...(showFavoritesTutorial ? { borderColor: '#22c55e' } : {}),
          }}>


          {/* Create Menu Accordion Inline */}
          <div className="flex flex-col select-none">
            {/* TODO header */}
            <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2 group/header relative">
              <div className="flex-1 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[12px] font-bold tracking-wider ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    CREATE
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setIsSettingsOpen(!isSettingsOpen);
                    }}
                    title="Customize Create Items"
                    className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300 text-[20px] font-medium select-none leading-none flex items-center justify-center w-6 h-6 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer outline-none border-none p-0 pb-[2px]"
                  >
                    +
                  </button>
                </div>
                <div className={`flex-1 border-t ${isDarkMode ? 'border-white/10' : 'border-[#eee8d5]'}`} />
              </div>
              <div
                className="transition-all duration-150 cursor-pointer p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center"
                onClick={e => {
                  e.stopPropagation();
                  setIsSettingsOpen(!isSettingsOpen);
                }}
              >
                <FiMoreHorizontal
                  size={15}
                  className={`transition-colors duration-150 text-[var(--color-iconDefault)]
                    ${isDarkMode
                      ? 'hover:text-neutral-100'
                      : 'hover:text-neutral-900'
                    }`}
                />
              </div>

              {/* Settings Dropdown Popover */}
              {isSettingsOpen && (
                <div
                  ref={settingsMenuRef}
                  className={`absolute left-full top-0 ml-2 z-[9999] w-48 p-2 rounded-lg border shadow-xl flex flex-col select-none
                    ${isDarkMode ? 'bg-[var(--color-popupBg)] border-white/10 text-neutral-400 shadow-black/80' : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75] shadow-neutral-400/20'}`}
                >
                  <div className={`px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'} mb-1`}>
                    Show items
                  </div>
                  <Reorder.Group
                    axis="y"
                    values={createItemsOrder}
                    onReorder={handleReorderCreateItems}
                    className="flex flex-col gap-0"
                  >
                    {allCreateOptions.map(option => (
                      <DropdownReorderItem
                        key={option.id}
                        option={option}
                        isDarkMode={isDarkMode}
                        visibleCreateItems={visibleCreateItems}
                        toggleItemVisibility={toggleItemVisibility}
                      />
                    ))}
                  </Reorder.Group>
                </div>
              )}
            </div>

            {/* Quick action rows — vertical list */}
            <div className="flex flex-col px-3 pt-0.5 pb-2">
              {mainItems.map(id => renderCreateItem(id))}

              {/* Collapsible Remaining Items */}
              {isCreateExpanded && collapsedItems.length > 0 && (
                <div className="flex flex-col">
                  {collapsedItems.map(id => renderCreateItem(id))}
                </div>
              )}

              {/* Toggle Chevron Accordion */}
              {collapsedItems.length > 0 && (
                <div
                  className="flex items-center justify-center cursor-pointer py-1 px-1.5 group select-none relative"
                  onClick={e => {
                    e.stopPropagation();
                    setIsCreateExpanded(!isCreateExpanded);
                  }}>
                  <div className={`shrink-0 transition-colors text-[var(--color-iconDefault)] ${isDarkMode ? 'group-hover:text-neutral-300' : 'group-hover:text-neutral-600'}`}>
                    {isCreateExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Very light horizontal divider */}
          <div className="mx-3 my-1.5 border-b" style={{ borderColor: '#212121' }} />




          {/* Favorites header */}
          <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span
                className={`text-[12px] font-bold tracking-wider ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {isPromptsMode ? 'PROMPTS' : isNotesMode ? 'NOTES' : isSessionMode ? 'LINK COLLECTIONS' : 'FAVORITES'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`relative flex items-center transition-opacity duration-200 ${isHovered || showSortMenu ? 'opacity-100' : 'opacity-0'}`}
                ref={sortMenuRef}>
                <HiArrowsUpDown
                  className={`cursor-pointer w-3.5 h-3.5 transition-colors ${showSortMenu ? (isDarkMode ? 'text-white' : 'text-black') : `text-[var(--color-iconDefault)] ${isDarkMode ? 'hover:text-neutral-300' : 'hover:text-neutral-600'}`}`}
                  onClick={e => {
                    e.stopPropagation();
                    setShowSortMenu(!showSortMenu);
                  }}
                />

                {showSortMenu && (
                  <div
                    className={`absolute left-0 top-full mt-1 w-44 rounded-lg border shadow-xl z-50 py-1 overflow-hidden
                    ${isDarkMode ? 'bg-[var(--color-popupBg)] border-white/20' : 'bg-[#fdf6e3] border-[#eee8d5]'}`}>
                    <div
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-neutral-500' : 'text-[#93a1a1]'}`}>
                      Sort by
                    </div>
                    {[
                      { id: 'hotkeys', label: 'Hotkeys', color: 'bg-purple-500' },
                      { id: 'alphabetic', label: 'Alphabetic', color: 'bg-neutral-400' },
                      { id: 'custom', label: 'Custom (Drag and drop)', color: 'bg-blue-500' },
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => handleSortChange(option.id as any)}
                        className={`w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center justify-between
                          ${sortOrder === option.id
                            ? isDarkMode
                              ? 'bg-white/10 text-white font-medium'
                              : 'bg-[#eee8d5] text-[#268bd2] font-medium'
                            : isDarkMode
                              ? 'text-neutral-400 hover:bg-white/5 hover:text-white'
                              : 'text-[#586e75] hover:bg-[#eee8d5]'
                          }`}>
                        <div className="flex items-center gap-2">{option.label}</div>
                        {sortOrder === option.id && (
                          <FaCheck size={10} className={isDarkMode ? 'text-purple-400' : 'text-[#268bd2]'} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* List */}

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pl-[20px] pr-2 py-0.5">
            {displayList.length > 0 ? (
              <div className="flex flex-col pb-2">
                <Reorder.Group
                  axis="y"
                  values={displayList.map((f: any) => f.compoundId)}
                  onReorder={handleReorder}
                  className="flex flex-col gap-0">
                  {displayList.map(({ item, folder, workspace, compoundId }: any, index: number) => (
                    <Reorder.Item
                      key={compoundId}
                      value={compoundId}
                      className="list-none"
                      drag={sortOrder === 'custom' ? 'y' : false}
                      onDragStart={() => setIsReordering(true)}
                      onDragEnd={() => {
                        if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
                        reorderTimeoutRef.current = setTimeout(() => {
                          setIsReordering(false);
                        }, 200);
                      }}>
                      <FavoriteItem
                        key={item.id}
                        userId={userId}
                        snippet={item}
                        folder={folder}
                        workspace={workspace}
                        selectedItem={selectedSnippet?.id || null}
                        reload={reload}
                        selectedTeamId={teamId}
                        favoritesMapping={favoritesMapping}
                        setFavoritesMapping={setFavoritesMapping}
                        index={index}
                        onCommandSelect={onCommandSelect}
                        onSelectSavedAgent={savedAgentSelect}
                        onAutomationSelect={onAutomationSelect}
                        hotkeysMap={hotkeysMap}
                        setHotkeysMap={setHotkeysMap}
                        shortcutsMap={shortcutsMap}
                        setShortcutsMap={setShortcutsMap}
                        onNavigateToListView={onNavigateToListView}
                        onOpenUrls={onOpenUrls}
                        onRequestEditLink={onRequestEditLink}
                        onStartExistingSession={handleStartExistingSession}
                        isDarkMode={isDarkMode}
                        onInlineEditLinkClick={handleInlineEditLink}
                        isSessionMode={isSessionMode || isNotesMode || isPromptsMode}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            ) : (
              <div className={`text-center text-sm py-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {isPromptsMode ? 'No prompts yet.' : isNotesMode ? 'No notes yet.' : isSessionMode ? 'No collections yet.' : 'No favorites yet.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Menu Popover removed — quick actions are now shown inline */}



      {/* URL Preview Popover — absolute positioning, mirrors Create menu exactly */}
      {hoveredLinkItem && urlPairs.length > 0 && (
        <div
          className={`absolute left-[280px] z-[9999] p-0 rounded-r-lg border-t border-b border-r shadow-xl flex flex-col w-[300px] overflow-y-auto overflow-x-hidden default-visible-scrollbar transition-all duration-200 select-none
            ${isDarkMode
              ? 'border-white/10 text-neutral-400 shadow-black/80'
              : 'border-[#eee8d5] text-[#586e75] shadow-neutral-400/20'
            }`}
          style={{
            top: `${hoveredLinkItem.top}px`,
            maxHeight: `${hoveredLinkItem.maxHeight || 280}px`,
            backgroundColor: isDarkMode ? '#080808' : '#fdf6e3',
          }}>
          <div className="flex justify-between items-center p-2 sticky top-0 bg-inherit z-10 border-b border-black/5 dark:border-white/5 mb-1">
            <span className={`text-[12px] font-bold tracking-tight px-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              Edit Link
            </span>
            <button
              onClick={() => {
                setHoveredLinkItem(null);
                setEditingIndex(null);
                setEditUrlValue('');
                setIsAddingNewUrl(false);
                setNewUrlValue('');
              }}
              className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-black/5 text-[#586e75] hover:text-black'
                }`}
            >
              <FaTimes size={12} />
            </button>
          </div>
          {urlPairs.map((pair, idx) => (
            <div
              key={idx}
              onDoubleClick={e => {
                e.stopPropagation();
                if (editingIndex !== idx) {
                  handleStartEdit(idx);
                }
              }}
              className={`group flex items-center gap-2 px-3 py-2 transition-colors duration-150 border-b last:border-b-0 w-full min-h-[36px] shrink-0 box-border
                ${isDarkMode ? 'hover:bg-white/5 border-white/5' : 'hover:bg-black/5 border-black/5'}`}>
              {/* Favicon */}
              <img
                src={getFaviconUrl(pair.url)}
                alt=""
                className={`w-4 h-4 rounded-sm object-contain shrink-0 transition-opacity duration-150 ${isDarkMode ? 'opacity-50 group-hover:opacity-80' : 'opacity-60 group-hover:opacity-90'}`}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* URL label or Input */}
              {editingIndex === idx ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onDoubleClick={e => {
                    e.stopPropagation();
                    handleSaveUrl(idx, e.currentTarget.textContent || '');
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveUrl(idx, e.currentTarget.textContent || '');
                    } else if (e.key === 'Escape') {
                      setEditingIndex(null);
                    }
                  }}
                  onBlur={() => {
                    setEditingIndex(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className={`text-[12px] font-medium tracking-tight bg-transparent outline-none flex-1 min-w-0 w-full px-1 py-0.5 rounded break-all whitespace-normal
                    ${isDarkMode ? 'text-white bg-white/10' : 'text-[#073642] bg-black/5'}`}
                  ref={el => {
                    if (el && editingIndex === idx) {
                      el.focus();
                      try {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      } catch (err) {
                        console.error('Failed to set contentEditable caret position:', err);
                      }
                    }
                  }}>
                  {getRawUrl(hoveredLinkItem.item, idx)}
                </div>
              ) : (
                <a
                  href={pair.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className={`text-[12px] font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0 no-underline transition-colors duration-150
                    ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-[#586e75] group-hover:text-[#073642]'}`}>
                  {stripCmdStatus(pair.url).replace(/^(https?:\/\/)?(www\.)?/i, '')}
                </a>
              )}
              {/* Edit + Delete — only visible on row hover when not editing */}
              {editingIndex !== idx && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    title="Edit URL"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartEdit(idx);
                    }}
                    className={`p-1 rounded transition-colors duration-150 text-[var(--color-iconDefault)] ${isDarkMode ? 'hover:text-neutral-300 hover:bg-white/10' : 'hover:text-neutral-600 hover:bg-black/10'}`}>
                    <FiEdit2 size={12} />
                  </button>
                  <button
                    title="Remove URL"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteUrl(idx);
                    }}
                    className={`p-1 rounded transition-colors duration-150 text-[var(--color-iconDefault)] ${isDarkMode ? 'hover:text-red-400 hover:bg-red-500/10' : 'hover:text-red-500 hover:bg-red-50'}`}>
                    <FiTrash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add new URL — plus button or inline input */}
          {!isAddingNewUrl ? (
            <button
              onClick={e => {
                e.stopPropagation();
                setIsAddingNewUrl(true);
              }}
              className={`group flex items-center justify-center gap-2 px-3 py-2 w-full text-[12px] font-semibold tracking-tight border-t transition-colors duration-150 shrink-0
      ${isDarkMode
                  ? 'border-white/5 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400'
                  : 'border-black/5 text-emerald-600 hover:bg-emerald-50/80 hover:text-emerald-700'
                }`}>
              {/* Swapped text-gray-400 out for a matching green text scale */}
              <FiPlus size={13} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>Add URL</span>
            </button>
          ) : (
            <div
              className={`flex items-center gap-2 px-3 py-2 border-t w-full min-h-[36px] shrink-0 box-border
                ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
              <FiPlus size={13} className="shrink-0 text-[var(--color-iconDefault)]" />
              <div
                contentEditable
                suppressContentEditableWarning
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewSave(e.currentTarget.textContent || '');
                  } else if (e.key === 'Escape') {
                    setIsAddingNewUrl(false);
                    setNewUrlValue('');
                  }
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  handleAddNewSave(e.currentTarget.textContent || '');
                }}
                onBlur={() => {
                  setIsAddingNewUrl(false);
                  setNewUrlValue('');
                }}
                onInput={e => {
                  setNewUrlValue((e.currentTarget as HTMLElement).textContent || '');
                }}
                onClick={e => e.stopPropagation()}
                className={`text-[12px] font-medium tracking-tight bg-transparent outline-none flex-1 min-w-0 w-full px-1 py-0.5 rounded break-all whitespace-normal
                  ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'}`}
                ref={el => {
                  if (el) {
                    el.focus();
                  }
                }}
                data-placeholder="Type URL and press Enter"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(FavoritesPanel);
