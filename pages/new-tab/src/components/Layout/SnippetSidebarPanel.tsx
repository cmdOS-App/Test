import React, { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Reorder, motion } from 'framer-motion';
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
  setIsCreateMenuOpen,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
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
import { FaCheck, FaLink, FaCode, FaLayerGroup, FaSearch, FaTerminal } from 'react-icons/fa';
import { BsCalendarCheck } from 'react-icons/bs';
import NotesIcon from '../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import { FiEdit2, FiTrash2, FiPlus, FiLink, FiFileText, FiCode, FiZap, FiChevronDown, FiChevronUp, FiChevronRight, FiCheckSquare } from 'react-icons/fi';
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

const collectFolderSnippetsDeep = (folder: Folder): Snippet[] => {
  const acc: Snippet[] = [...(folder.snippets || [])];
  (folder.folders || []).forEach((sub: Folder) => {
    acc.push(...collectFolderSnippetsDeep(sub));
  });
  return acc;
};

const collectWorkspaceSnippetsDeep = (workspace: any): Snippet[] => {
  const acc: Snippet[] = [...(workspace.workspace_snippets || [])];
  (workspace.folders || []).forEach((folder: Folder) => {
    acc.push(...collectFolderSnippetsDeep(folder));
  });
  return acc;
};

const SnippetSidebarPanel = ({
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
  const setShowCreateMenu = useCallback((val: boolean) => dispatch(setIsCreateMenuOpen(val)), [dispatch]);

  const [selectedMenuIndex, setSelectedMenuIndex] = useState<number>(0);
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

  const createItems = useMemo(() => [
    {
      id: 'createlinks',
      label: 'Link Collection',
      category: 'Data',
      icon: <FaLink size={11} />,
      action: () => onCommandSelect('createlinks'),
    },
    {
      id: 'createnotes',
      label: 'Notes',
      category: 'Data',
      icon: <NotesIcon size={12} />,
      action: () => onCommandSelect('createnotes'),
    },
    {
      id: 'createsnippet',
      label: 'Snippet',
      category: 'Data',
      icon: <FiCode size={13} />,
      action: () => onCommandSelect('createsnippet'),
    },
    {
      id: 'createprompt',
      label: 'Prompt',
      category: 'Data',
      icon: <LuSparkles size={13} />,
      action: () => onCommandSelect('createprompt'),
    },
    {
      id: 'createtodo',
      label: 'Todo',
      category: 'Data',
      icon: <FiCheckSquare size={13} />,
      action: () => {
        dispatch(setTodoCreatePrefill({ isCreateModalOnly: true }));
      },
    },
    {
      id: 'ai',
      label: 'Chat Agent',
      category: 'Automations',
      icon: <LuSparkles size={13} />,
      action: () => onCommandSelect('ai'),
    },
    {
      id: 'agent',
      label: 'Automation',
      category: 'Automations',
      icon: <FiZap size={12} className="text-amber-500" />,
      action: () => onCommandSelect('agent'),
    },
  ], [onCommandSelect, dispatch]);

  useEffect(() => {
    if (showCreateMenu) {
      setSelectedMenuIndex(0);
    }
  }, [showCreateMenu]);

  useEffect(() => {
    if (!showCreateMenu) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCreateMenu(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev < createItems.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev > 0 ? prev - 1 : createItems.length - 1));
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= createItems.length) {
        e.preventDefault();
        createItems[num - 1].action();
        setShowCreateMenu(false);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        createItems[selectedMenuIndex].action();
        setShowCreateMenu(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [showCreateMenu, createItems, selectedMenuIndex, setShowCreateMenu]);

  const handleHoverItem = useCallback((item: Snippet | null, element: HTMLElement | null) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    if (!item || !element) {
      leaveTimeoutRef.current = setTimeout(() => {
        setHoveredLinkItem(null);
      }, 150);
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
    } catch {}
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
        } catch {}
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
    const snippets: { item: Snippet | any; folder: Folder | null; workspace: any; compoundId: string }[] = [];
    (allData || []).forEach((team: any) => {
      (team.workspaces || []).forEach((workspace: any) => {
        const wsSnippets = collectWorkspaceSnippetsDeep(workspace);
        wsSnippets.forEach(snip => {
          const cat = (snip.category || '').toLowerCase();
          if (cat === 'snippet') {
            snippets.push({
              item: { ...snip, key: snip.key || 'Untitled Snippet' },
              folder: null,
              workspace,
              compoundId: snip.id || snip.snippet_id || '',
            });
          }
        });
      });
    });

    if (sortOrder === 'custom') {
      return snippets;
    }

    return [...snippets].sort((a, b) => {
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
  }, [allData, sortOrder, hotkeysMap]);

  const handleReorder = (reorderedItems: Snippet[]) => {
    try {
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


         

         

          {/* Collapsible "+ Create >" header button */}
          <div 
            className="px-2 py-0.5 relative" 
            ref={createMenuRef}
            onMouseEnter={() => setShowCreateMenu(true)}
            onMouseLeave={() => setShowCreateMenu(false)}
          >
            <button
              onClick={e => {
                e.stopPropagation();
                setShowCreateMenu(!showCreateMenu);
              }}
              className={`w-full group relative cursor-pointer px-1 py-[2px] bg-transparent rounded-lg transition-all duration-200
                ${isDarkMode 
                  ? 'hover:bg-white/5' 
                  : 'hover:bg-black/5'
                }`}
            >
              <div className="flex items-center gap-1.5 h-8 overflow-hidden relative">
                <div className={`flex items-center justify-start flex-shrink-0 w-8 transition-colors duration-150 text-[var(--color-iconDefault)] ${isDarkMode ? 'group-hover:text-neutral-300' : 'group-hover:text-neutral-900'}`}>
                  <FiPlus size={16} />
                </div>
                
                <div className="flex-1 min-h-0 h-full relative flex items-center">
                  <span className={`text-[13px] font-medium transition-colors duration-150 truncate ${isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-900'}`} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
                    Create
                  </span>
                </div>

                <div className="flex-shrink-0 w-auto text-right pr-2 text-[10px] font-mono font-semibold flex items-center gap-2">
                  <span className="flex items-center gap-0.5 opacity-80 scale-90 origin-right shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] min-w-[1.2rem] text-center shadow-sm transition-colors duration-150 ${
                        isDarkMode ? 'bg-neutral-800/80 text-neutral-400 group-hover:bg-neutral-700/80 group-hover:text-neutral-300' : 'bg-[#eee8d5] text-[#586e75] group-hover:bg-[#e2dcc8] group-hover:text-[#073642]'
                      }`}>
                      {isMac ? '⌥' : 'Alt'}
                    </span>
                    <span className="text-[10px] text-neutral-400">+</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] min-w-[1.2rem] text-center shadow-sm transition-colors duration-150 ${
                        isDarkMode ? 'bg-neutral-800/80 text-neutral-400 group-hover:bg-neutral-700/80 group-hover:text-neutral-300' : 'bg-[#eee8d5] text-[#586e75] group-hover:bg-[#e2dcc8] group-hover:text-[#073642]'
                      }`}>
                      C
                    </span>
                  </span>
                  <FiChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${showCreateMenu ? 'rotate-90' : ''} text-[var(--color-iconDefault)] ${isDarkMode ? 'group-hover:text-neutral-300' : 'group-hover:text-[#073642]'}`} />
                </div>
              </div>
            </button>
 
            {/* Popup Menu */}
            {showCreateMenu && (
              <div
                className={`absolute left-5 right-1 top-full z-[9999] p-1.5 rounded-xl border flex flex-col transition-all duration-200 select-none
                  ${isDarkMode 
                    ? 'bg-[#171821] border-white/10 text-neutral-400' 
                    : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75]'
                  }`}
                style={{
                  marginTop: '0.5px',
                  boxShadow: isDarkMode 
                    ? '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)' 
                    : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Items List */}
                <div className="flex flex-col max-h-[280px] overflow-y-auto custom-scrollbar pb-1 pt-1.5">
                  {createItems.map((item, idx) => {
                    const showCategoryHeader = idx === 0 || item.category !== createItems[idx - 1].category;
                    
                    return (
                      <React.Fragment key={item.id}>
                        {showCategoryHeader && (
                          <>
                            {idx > 0 && <div className={`my-1.5 mx-2 h-[1px] ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`} />}
                            <div className={`px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                              {item.category}
                            </div>
                          </>
                        )}
                        <div className="px-1 mb-0.5">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              item.action();
                              setShowCreateMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors duration-150 group
                              ${idx === selectedMenuIndex
                                ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-black/10 text-[#073642]')
                                : (isDarkMode ? 'hover:bg-white/5 text-neutral-300 hover:text-white' : 'hover:bg-black/5 text-[#586e75] hover:text-[#073642]')
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-4 h-4 flex items-center justify-center shrink-0 transition-colors duration-150 text-[var(--color-iconDefault)]
                                ${isDarkMode ? 'group-hover:text-neutral-300' : 'group-hover:text-[#073642]'}`}>
                                {item.icon}
                              </div>
                              <span className="text-[12px] font-semibold tracking-tight truncate">
                                {item.label}
                              </span>
                            </div>
                            <span 
                              className="text-[10px] font-mono select-none px-1 py-0.2 rounded transition-colors duration-150"
                              style={{ color: '#979799' }}
                            >
                              {idx + 1}
                            </span>
                          </button>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Very light horizontal divider */}
          <div className="mx-3 my-3 border-b" style={{ borderColor: '#212121' }} />





          {/* Favorites header */}
          <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span
                className={`text-[12px] font-bold tracking-wider ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                SNIPPETS
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
                    ${isDarkMode ? 'bg-black border-white/20' : 'bg-[#fdf6e3] border-[#eee8d5]'}`}>
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
                          ${
                            sortOrder === option.id
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

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-0.5">
            {favoritesWithFolders.length > 0 ? (
              <div className="flex flex-col pb-2">
                <Reorder.Group
                  axis="y"
                  values={favoritesWithFolders.map((f: any) => f.item)}
                  onReorder={handleReorder}
                  className="flex flex-col gap-0">
                  {favoritesWithFolders.map(({ item, folder, workspace }: any, index: number) => (
                    <Reorder.Item
                      key={item.id}
                      value={item}
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
                        isDarkMode={isDarkMode}
                        onHoverItem={handleHoverItem}
                        onSnippetSelect={(clickedSnippet, workspace, folder) => {
                          const breadcrumb = {
                            workspace_id: workspace.workspace_id,
                            workspace_name: workspace.workspace_name,
                            folder_id: folder?.folder_id || null,
                            folder_name: folder?.folder_name || null,
                          };

                          dispatch(setSelectedWorkspace(workspace));
                          dispatch(setSelectedFolder(folder));
                          dispatch(setSelectedSnippet(clickedSnippet));
                          dispatch(setIsCreatingNewItem(false));
                          dispatch(setSnippetBreadCrum(breadcrumb));
                          
                          // Navigate to noteEditor view so Container renders the editor
                          dispatch(navigateToView({ kind: 'noteEditor' }));
                        }}
                        overrideIcon={<FaCode size={14} className={isDarkMode ? 'text-blue-400' : 'text-[#268bd2]'} />}
                        isSnippetPanel={true}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            ) : (
              <div className={`text-center text-sm py-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                No snippets yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Menu Popover removed — quick actions are now shown inline */}



      {/* URL Preview Popover — absolute positioning, mirrors Create menu exactly */}
      {hoveredLinkItem && urlPairs.length > 0 && (
        <div
          onMouseEnter={() => {
            if (leaveTimeoutRef.current) {
              clearTimeout(leaveTimeoutRef.current);
              leaveTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            setHoveredLinkItem(null);
            setEditingIndex(null);
            setEditUrlValue('');
            setIsAddingNewUrl(false);
            setNewUrlValue('');
          }}
          className={`absolute left-[280px] z-[9999] p-0 rounded-r-lg border-t border-b border-r shadow-xl flex flex-col w-[300px] overflow-y-auto overflow-x-hidden default-visible-scrollbar transition-all duration-200 select-none
            ${
              isDarkMode
                ? 'border-white/10 text-neutral-400 shadow-black/80'
                : 'border-[#eee8d5] text-[#586e75] shadow-neutral-400/20'
            }`}
          style={{
            top: `${hoveredLinkItem.top}px`,
            maxHeight: `${hoveredLinkItem.maxHeight || 280}px`,
            backgroundColor: isDarkMode ? '#080808' : '#fdf6e3',
          }}>
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
      ${
        isDarkMode
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

export default memo(SnippetSidebarPanel);
