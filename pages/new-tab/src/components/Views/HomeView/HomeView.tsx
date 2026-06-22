import React, { forwardRef, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { enqueueFavoriteAction } from '@src/Apis/favoritesQueue';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { getFavorites, addFavorite, deleteFavorite } from '../../../../../Apis/services/favoritesApi'; // Sync Refactor
import { AI_GROUP, COMMANDS, type CommandId } from '../../SearchComponents/Searchbar/commands';
import { getCommandKeywords } from '../../SearchComponents/Searchbar/commandKeywords';
import {
  selectSelectedTeam,
  selectSelectedFolder,
  selectCommandStatus,
  setCommandStatus,
  selectIsSharedFolderCreationView,
} from '../../../../../Redux/AllData/uiStateSlice';
import type { RootState } from '../../../../../Redux/store';
import type { Folder, Snippet, Team, Workspace } from '../../../../../modals/interfaces';
import InteractiveItemsList, {
  type CommandInteractiveItem,
  type InteractiveItemsListHandle,
  type InteractiveItemsListProps,
  type InteractiveSection,
  type SnippetInteractiveItem,
  type InteractiveItem,
} from './InteractiveItemsList';
import {
  buildSnippetSuggestion,
  buildSuggestionKey,
  extractUrlsFromSnippet,
  getSnippetPreview,
  isLinkCategory,
  isPromptCategory,
  isNoteCategory,
  isTabGroupCategory,
  resolveSnippetIcon,
} from './snippetInteractiveUtils';
import type { SnippetActionDetail, SnippetSuggestion } from './types';
import { LOCAL_COMMANDS, isLocalCommandId, type LocalCommandId } from '../../SearchComponents/Searchbar/localCommands';
import type { CommandDefinition } from '../../SearchComponents/Searchbar/commands';
import { useCommands } from '../../SearchComponents/Searchbar/useCommands';
import { getUserId } from '../../../../../Apis/core/api';
import { trackCounterEvent } from '../../../../../utils/counterTracking';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import {
  FaRegFolder,
  FaFolderOpen,
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
} from 'react-icons/fa';
import { isSameDay } from 'date-fns';
import { BsCalendarCheck } from 'react-icons/bs';

interface HomeViewProps {
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
  onCommandPreview?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections' | null) => void;
  onSnippetSelect: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestFocusSearch?: () => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestLinkEdit?: (suggestion: SnippetSuggestion) => void;
  onHighlightChange?: (item: InteractiveItem | null) => void;
  inlineNotification?: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  isCommandLocked?: boolean;
  isPromptMenuOpen?: boolean;
  isAtMenuOpen?: boolean;
  isSuggestionVisible?: boolean;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  isLoggedIn: boolean;
}

export type HomeViewHandle = InteractiveItemsListHandle;

// Match AltS DefaultMainView: include local create-note/create-link commands as well
const COMMAND_SHORTLIST: Array<CommandId | LocalCommandId | 'ai' | 'collections'> = [
  'ai',
  // 'todo',
  'collections',
];
const NOTE_LIMIT = 6;
const LINK_LIMIT = 6;
const FAV_LIMIT = 6;

const COMMAND_DESCRIPTIONS: Partial<Record<string, string>> = {
  gpt: 'Jump straight into a new ChatGPT conversation.',
  perplexity: 'Search with Perplexity AI assistant.',
  ai: 'Search across all AI assistants at once.',
  google: 'Search the web with Google.',
  event: 'Create a Google Calendar event quickly.',
  createnotes: 'Capture a reusable snippet right from search.',
  createlinks: 'Group your go-to websites and launch in a click.',
  agent: 'Open the AI agent interface.',
  todo: 'Manage your personal tasks and reminders.',
  collections: 'Access all your saved collections and snippets.',
} as const;

const useTeamSnippets = () => {
  const selectedTeam = useSelector((state: RootState) => selectSelectedTeam(state));
  const selectedFolder = useSelector((state: RootState) => selectSelectedFolder(state));

  return useMemo(() => {
    const team: Team | null = selectedTeam;
    if (!team?.workspaces) return [] as Array<{ workspace: Workspace; folder: Folder | null; snippet: Snippet }>;

    const results: Array<{ workspace: Workspace; folder: Folder | null; snippet: Snippet }> = [];

    // Recursively collect snippets from a folder and all its sub-folders
    const collectFolderEntries = (workspace: Workspace, folder: Folder) => {
      (folder.snippets || []).forEach(snippet => {
        results.push({ workspace, folder, snippet });
      });
      (folder.folders || []).forEach(sub => collectFolderEntries(workspace, sub));
    };

    // Helper: find a folder by ID anywhere in the folder tree and return both the folder and its root
    const findFolderAndRoot = (
      workspace: Workspace,
      targetId: string,
    ): { targetFolder: Folder; rootFolder: Folder } | null => {
      const search = (folder: Folder, root: Folder): { targetFolder: Folder; rootFolder: Folder } | null => {
        if (String(folder.folder_id) === targetId) {
          return { targetFolder: folder, rootFolder: root };
        }
        for (const sub of folder.folders || []) {
          const found = search(sub, root);
          if (found) return found;
        }
        return null;
      };

      for (const folder of workspace.folders || []) {
        const found = search(folder, folder);
        if (found) return found;
      }
      return null;
    };

    // If a folder is selected, collect from the ROOT folder (the top-level folder that contains it)
    // This shows all snippets from the root folder and ALL its descendants (sub-folders)
    if (selectedFolder) {
      const targetId = String(selectedFolder.folder_id);
      for (const workspace of team.workspaces) {
        const match = findFolderAndRoot(workspace, targetId);
        if (match) {
          // Collect from the ROOT folder (not just the selected folder)
          // This ensures clicking any folder shows ALL content from its root ancestor
          collectFolderEntries(workspace, match.rootFolder);
          return results;
        }
      }
      // Folder not found in any workspace
      return results;
    }

    // No folder filter: collect everything
    team.workspaces.forEach(workspace => {
      (workspace.workspace_snippets || []).forEach(snippet => {
        results.push({ workspace, folder: null, snippet });
      });
      (workspace.folders || []).forEach(folder => collectFolderEntries(workspace, folder));
    });

    return results;
  }, [selectedTeam, selectedFolder]);
};

const HomeView = React.memo(
  forwardRef<HomeViewHandle, HomeViewProps>(
    (
      {
        onQuickCommandSelect,
        onCommandPreview,
        onSnippetSelect,
        onRequestSnippetDelete,
        onRequestFocusSearch,
        onRequestOpenUrls,
        onRequestLinkEdit,
        onHighlightChange,
        inlineNotification,
        isCommandLocked,
        isPromptMenuOpen,
        isAtMenuOpen,
        isSuggestionVisible,
        onNavigateToListView,
        isLoggedIn,
      },
      ref,
    ) => {
      const teamSnippets = useTeamSnippets();
      const dispatch = useDispatch();
      const selectedTeam = useSelector((state: RootState) => selectSelectedTeam(state));
      const selectedFolder = useSelector((state: RootState) => selectSelectedFolder(state));
      const commandStatus = useSelector((state: RootState) => selectCommandStatus(state));
      const selectedTeamId = selectedTeam?.team_id || '';

      const [todoCounts, setTodoCounts] = useState<{ overdue: number; done: number; total: number }>({
        overdue: 0,
        done: 0,
        total: 0,
      });

      // Helper to parse task dates safely
      const parseTaskDate = (d: string | undefined) => {
        if (!d) return new Date(0);
        return new Date(String(d).replace(' ', 'T'));
      };

      // Unified Todo Synchronization for HomeView (matches SideBar)
      useEffect(() => {
        const chromeAny = (window as any).chrome;

        const updateTodoMetrics = async () => {
          if (!chromeAny?.storage?.local) return;

          try {
            const result = await new Promise<any>(resolve =>
              chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
            );
            const allTasks = [...(result.cached_todos || []), ...(result.local_todos || [])];

            // 1. Deduplicate by ID
            const uniqueTasks = Array.from(new Map(allTasks.map(t => [String(t.id || t.snippet_id), t])).values());
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

            // 2. Calculate Counts & Stats
            const metrics = uniqueTasks.reduce(
              (acc: any, t: any) => {
                const deadline = parseTaskDate(t.event_deadline);
                if (isNaN(deadline.getTime())) return acc;

                const isAnytime = !!(t.is_anytime || (t.event_deadline && String(t.event_deadline).substring(0, 4) >= '2035'));
                const isFutureDay = !isSameDay(deadline, now) && deadline > now;

                const isActiveToday = !t.is_done && !isFutureDay && (isSameDay(deadline, now) || deadline < now || isAnytime);
                const isDoneToday = t.is_done && isSameDay(deadline, now);
                const isPast = deadline < now && !isAnytime;

                if (isActiveToday || isDoneToday) {
                  acc.todayTotal++;
                  if (t.is_done) {
                    acc.todayDone++;
                  } else if (isPast) {
                    acc.overdue++;
                  }
                } else if (!t.is_done && deadline < startOfToday && !isAnytime) {
                  acc.overdue++;
                }
                return acc;
              },
              { overdue: 0, todayTotal: 0, todayDone: 0 },
            );

            setTodoCounts({ overdue: metrics.overdue, done: metrics.todayDone, total: metrics.todayTotal });
          } catch (e) {
            console.error('[HomeView] Failed to update todo metrics:', e);
          }
        };

        updateTodoMetrics();
        window.addEventListener('todosUpdated', updateTodoMetrics);

        const handleStorageChange = (changes: any, area: string) => {
          if (area === 'local' && (changes.local_todos || changes.cached_todos)) {
            updateTodoMetrics();
          }
        };
        chromeAny.storage.onChanged.addListener(handleStorageChange);

        return () => {
          window.removeEventListener('todosUpdated', updateTodoMetrics);
          chromeAny.storage.onChanged.removeListener(handleStorageChange);
        };
      }, []);

      const [favoritesMapping, setFavoritesMapping] = useState<Record<string, Snippet[]>>({});
      const [userId, setUserId] = useState('');

      // Use shared hook for commands
      const { commands } = useCommands();

      const userCommandsMap = useMemo(() => {
        const map: Record<string, CommandDefinition> = {};
        commands.forEach(c => {
          map[c.id] = c;
        });
        return map;
      }, [commands]);

      useEffect(() => {
        const init = async () => {
          const uid = await getUserId();
          setUserId(uid);
        };
        init();
      }, []);

      useEffect(() => {
        try {
          const chromeAny = (window as any)?.chrome;
          if (chromeAny?.storage?.local) {
            chromeAny.storage.local.get(
              'myFavouriteItems',
              (result: { myFavouriteItems?: Record<string, Snippet[]> }) => {
                setFavoritesMapping(result?.myFavouriteItems || {});
              },
            );
          }
        } catch {
          // ignore when chrome API unavailable
        }
      }, []);

      useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.onChanged) return;
        const handleChange = (
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: 'sync' | 'local' | 'managed' | 'session',
        ) => {
          if (areaName !== 'local') return;
          if (changes?.myFavouriteItems) {
            const nextVal = changes.myFavouriteItems.newValue as Record<string, Snippet[]> | undefined;
            setFavoritesMapping(nextVal || {});
          }
        };
        chromeAny.storage.onChanged.addListener(handleChange);
        return () => {
          try {
            chromeAny.storage.onChanged.removeListener(handleChange);
          } catch {
            // ignore
          }
        };
      }, []);

      const favoriteIdSet = useMemo(() => {
        // KEY CHANGE: Use userId
        const list = favoritesMapping[userId] || [];
        const set = new Set<string>();
        list.forEach(s => {
          const favId = (s as any)?.id || (s as any)?.snippet_id;
          if (favId) set.add(favId);
        });
        return set;
      }, [favoritesMapping, userId]);

      const sortedSnippets = useMemo(() => {
        return [...teamSnippets].sort((a, b) => {
          const aTime = new Date(a.snippet.updated_at || a.snippet.created_at || 0).getTime();
          const bTime = new Date(b.snippet.updated_at || b.snippet.created_at || 0).getTime();
          return bTime - aTime;
        });
      }, [teamSnippets]);

      const noteItems = useMemo<SnippetInteractiveItem[]>(() => {
        return sortedSnippets
          .filter(entry => !isLinkCategory(entry.snippet.category))
          .slice(0, NOTE_LIMIT)
          .map((entry, index) => {
            const id = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category;
            let kind: 'note' | 'prompt' | 'link' = 'note';
            if (isPromptCategory(category)) kind = 'prompt';
            else if (isLinkCategory(category)) kind = 'link';

            return {
              kind,
              id,
              title:
                entry.snippet.key ||
                (kind === 'prompt' ? 'Untitled prompt' : kind === 'link' ? 'Untitled link' : 'Untitled note'),
              context,
              preview: getSnippetPreview(entry.snippet),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      const linkItems = useMemo<SnippetInteractiveItem[]>(() => {
        return sortedSnippets
          .filter(entry => isLinkCategory(entry.snippet.category))
          .slice(0, LINK_LIMIT)
          .map((entry, index) => {
            const id = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category;
            return {
              kind: 'link' as const,
              id,
              title: entry.snippet.key || 'Untitled link',
              context,
              preview: getSnippetPreview(entry.snippet) || (isTabGroupCategory(category) ? 'Multiple URLs saved' : ''),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
              urls: extractUrlsFromSnippet(entry.snippet),
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      // AI selection state for dynamic icons (Migrated to chrome.storage.local)
      const [selectedAIs, setSelectedAIs] = useChromeStorage<string[]>('selectedAIs', AI_GROUP.members);

      const handleToggleAI = useCallback(
        (aiId: string) => {
          setSelectedAIs(prev => {
            const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
            return newSelection;
          });
        },
        [setSelectedAIs],
      );

      const commandItems = useMemo<CommandInteractiveItem[]>(() => {
        return COMMAND_SHORTLIST.map(id => {
          if (id === 'ai') {
            // Use fixed AI_GROUP.members for static icon stack
            const targetAIs = AI_GROUP.members;

            return {
              kind: 'command' as const,
              id: `command-${id}`,
              commandId: id,
              label: AI_GROUP.label,
              description: COMMAND_DESCRIPTIONS[id] ?? 'Run this command.',
              iconHosts: targetAIs
                .map(memberId => COMMANDS.find(c => c.id === memberId)?.iconHost)
                .filter((host): host is string => Boolean(host)),
              keywords: ['ai', 'assistants', 'all ai'],
              iconStack: true,
              isFavorite: favoriteIdSet.has(id),
              shortcut: undefined,
            };
          }

          // Local commands (createnotes / createlinks)
          if (isLocalCommandId(id)) {
            const localDef = LOCAL_COMMANDS.find(c => c.id === id);
            if (!localDef) return null;

            const stored = userCommandsMap[id];
            const shortcut = stored ? stored.prefix : localDef.prefix.replace(/^\//, '');

            return {
              kind: 'command' as const,
              id: `command-${id}`,
              commandId: id as LocalCommandId,
              label: localDef.label,
              description: COMMAND_DESCRIPTIONS[id] ?? `Run ${localDef.label}.`,
              iconHosts: [], // indicates local command; InteractiveItemsList will use TerminalIcon
              icon: localDef.icon,
              keywords: [localDef.prefix.replace('/', ''), localDef.label.toLowerCase()],
              iconStack: false,
              isFavorite: favoriteIdSet.has(id),
              shortcut: stored ? stored.prefix : undefined,
            };
          }

          const def = COMMANDS.find(c => c.id === id);
          if (!def && id !== 'collections') return null;

          const stored = userCommandsMap[id];

          // Try to find the specific BROWSER_ICON for this command if it's a browser command
          let customIcon = def?.icon;
          if (!customIcon && id === 'todo') customIcon = BsCalendarCheck;
          else if (!customIcon && id === 'collections') customIcon = FaRegFolder;
          else if (!customIcon && def?.category === 'browser') {
            // BROWSER_ICONS mapping directly from SearchSuggestions.tsx
            const iconMap: Record<string, React.ReactNode> = {
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
            customIcon = iconMap[id];
          }

          return {
            kind: 'command' as const,
            id: `command-${id}`,
            commandId: id,
            label: id === 'todo' ? 'My To-Do' : id === 'collections' ? 'All Shortcuts' : def?.label || '',
            description: COMMAND_DESCRIPTIONS[id] ?? `Open ${def?.label || ''}.`,
            iconHosts: id === 'collections' ? [] : [def?.iconHost].filter(Boolean),
            icon: customIcon,
            keywords: id === 'collections' ? ['collections', 'all', 'folders'] : getCommandKeywords(id as CommandId),
            iconStack: false,
            isFavorite: favoriteIdSet.has(id),
            shortcut: id === 'collections' ? undefined : id === 'todo' ? 'Alt+C' : (stored ? stored.prefix : undefined),
          };
        }).filter(Boolean) as CommandInteractiveItem[];
      }, [selectedAIs, favoriteIdSet, userCommandsMap]);

      const favoriteItems = useMemo<SnippetInteractiveItem[]>(() => {
        if (!favoriteIdSet.size) return [];
        return sortedSnippets
          .filter(entry => {
            const id = entry.snippet.id || entry.snippet.snippet_id || '';
            return Boolean(id) && favoriteIdSet.has(id);
          })
          .slice(0, FAV_LIMIT)
          .map((entry, index) => {
            const baseId = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const id = `favorite-${baseId}`;
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category;
            const isLink = isLinkCategory(category);
            const isPrompt = isPromptCategory(category);

            let kind: 'note' | 'prompt' | 'link' = 'note';
            if (isLink) kind = 'link';
            else if (isPrompt) kind = 'prompt';

            return {
              kind,
              id,
              title:
                entry.snippet.key ||
                (kind === 'link' ? 'Untitled link' : kind === 'prompt' ? 'Untitled prompt' : 'Untitled note'),
              context,
              preview: getSnippetPreview(entry.snippet) || (isTabGroupCategory(category) ? 'Multiple URLs saved' : ''),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: true,
              urls: isLink ? extractUrlsFromSnippet(entry.snippet) : undefined,
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      // ... inside toggleFavoriteForItem ...

      // ... inside component ...

      const toggleFavoriteForItem = useCallback(
        (item: InteractiveItem) => {
          enqueueFavoriteAction(async () => {
            // ... Original Async Logic ...
            // ... Original Async Logic Here ...
            // Since we can't easily indent 100 lines here without error,
            // I will provide the FULL corrected function content below

            const chromeAny = (window as any)?.chrome;
            if (!chromeAny?.storage?.local) return;

            function showToast(msg: string) {
              dispatch(setCommandStatus({ status: 'success', message: msg }));
              setTimeout(() => {
                dispatch(setCommandStatus({ status: 'idle', message: '' }));
              }, 2000);
            }

            try {
              const targetKey = userId;
              if (!targetKey) {
                showToast('Please log in to manage favorites.');
                return;
              }

              // ... imports ...
              const { addFavorite, deleteFavorite, getFavorites } = await import('../../../../../Apis/services/favoritesApi');

              // 1. Get Latest Storage
              const result = await new Promise<any>(resolve =>
                chromeAny.storage.local.get('myFavouriteItems', resolve),
              );
              const favItems = result.myFavouriteItems || {};
              const currentFavList: any[] = favItems[targetKey] || [];

              // ... Prepare Item Data ...
              let itemId: string;
              let itemType: 'command' | 'snippet';
              let itemData: any;

              if (item.kind === 'command') {
                itemType = 'command';
                itemId = item.commandId;
                itemData = {
                  id: item.commandId,
                  type: 'command',
                  label: item.label,
                  commandId: item.commandId,
                  commandPrefix: '/' + item.commandId,
                  iconHost: item.iconHosts?.[0],
                  iconStack: item.iconStack,
                };
              } else {
                const snippet = item.suggestion.snippet;
                itemType = 'snippet';
                itemId = (snippet as any)?.id || (snippet as any)?.snippet_id;

                itemData =
                  (snippet as any)?.id || !(snippet as any)?.snippet_id
                    ? snippet
                    : ({ ...snippet, id: (snippet as any).snippet_id } as Snippet);
              }

              // ... Check Existing ...
              const existingFavIndex = currentFavList.findIndex(fav => {
                if ('type' in fav && fav.type === 'command') {
                  return fav.id === itemId;
                }
                const favId = (fav as any)?.id || (fav as any)?.snippet_id;
                return favId === itemId;
              });
              const isAlreadyFav = existingFavIndex !== -1;

              if (isAlreadyFav) {
                // --- REMOVE ---
                const existingItem = currentFavList[existingFavIndex];

                // API Call
                if (existingItem && existingItem.favourite_id) {
                  const fid = String(existingItem.favourite_id);
                  if (!fid.startsWith('pending-')) {
                    deleteFavorite(targetKey, Number(existingItem.favourite_id)).catch(console.error);
                  }
                } else {
                  // Fallback Logic
                  try {
                    const cloudFavs = await getFavorites(targetKey);
                    const match = cloudFavs.find((cf: any) => {
                      if (itemType === 'command') return cf.command_id === itemId;
                      return cf.snippet_id === itemId;
                    });
                    if (match && match.favourite_id) {
                      deleteFavorite(targetKey, match.favourite_id).catch(console.error);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }

                // Local Update
                const updatedFavList = [...currentFavList];
                updatedFavList.splice(existingFavIndex, 1);

                const updatedMapping = { ...favItems, [targetKey]: updatedFavList };
                await new Promise<void>(resolve =>
                  chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
                );

                showToast(`Removed from favorites`);
                setFavoritesMapping(updatedMapping);
              } else {
                // --- ADD ---
                const tempItem = { ...itemData, favourite_id: 'pending-' + Date.now() };
                const updatedFavList = [tempItem, ...currentFavList];

                const updatedMapping = { ...favItems, [targetKey]: updatedFavList };
                await new Promise<void>(resolve =>
                  chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
                );

                showToast(`Added to favorites`);
                setFavoritesMapping(updatedMapping);

                // API Call
                try {
                  const response = await addFavorite(targetKey, { id: itemId }, itemType);
                  if (response && response.favourite_id) {
                    // Update ID
                    const latestRes = await new Promise<any>(resolve =>
                      chromeAny.storage.local.get('myFavouriteItems', resolve),
                    );
                    const latestFavItems = latestRes.myFavouriteItems || {};
                    const latestUserFavs = latestFavItems[targetKey] || [];

                    // Check Race (Ghost)
                    const stillExists = latestUserFavs.some((f: any) => {
                      const fId = f.id || (f.type === 'command' ? f.commandId : f.snippet_id);
                      return fId === itemId;
                    });

                    if (!stillExists) {
                      
                      await deleteFavorite(targetKey, response.favourite_id);
                    } else {
                      const syncedFavs = latestUserFavs.map((f: any) => {
                        const fId = f.id || (f.type === 'command' ? f.commandId : f.snippet_id);
                        if (fId === itemId) {
                          return { ...f, favourite_id: response.favourite_id };
                        }
                        return f;
                      });
                      const syncedMapping = { ...latestFavItems, [targetKey]: syncedFavs };
                      await new Promise<void>(resolve =>
                        chromeAny.storage.local.set({ myFavouriteItems: syncedMapping }, resolve),
                      );
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              }
            } catch (err) {
              console.error('[HomeView] Toggle Error', err);
            }
          });
        },
        [userId, dispatch],
      );

      const sections = useMemo<InteractiveSection[]>(() => {
        const list: InteractiveSection[] = [];

        // Recommended section - combines commands, notes and links (like AltS)
        const recommendedItems: InteractiveItem[] = [];
        recommendedItems.push(...commandItems);
        // only homeview allow 3 options remaining not sending uncomment to send it

        // recommendedItems.push(...noteItems.slice(0, 4));
        // recommendedItems.push(...linkItems.slice(0, 4));
        if (recommendedItems.length > 0) {
          list.push({
            key: 'recommended',
            title: '',
            items: recommendedItems,
            emptyMessage: 'No suggestions yet. Try creating or saving items.',
          });
        }

        // Empty state if no items
        if (!list.length) {
          list.push({
            key: 'empty',
            title: 'Results',
            items: [],
            emptyMessage: 'Nothing here yet. Try creating a note or saving a link.',
          });
        }

        return list;
      }, [commandItems, noteItems, linkItems]);

      // Track focused item kind for dynamic label
      const [focusedItemKind, setFocusedItemKind] = useState<
        'link' | 'note' | 'command' | 'folder' | 'prompt' | 'tabgroup' | null
      >(null);
      const handleHighlightChange = useCallback(
        (item: InteractiveItem | null) => {
          if (onHighlightChange) {
            onHighlightChange(item);
          }
          if (item) {
            setFocusedItemKind(item.kind);
          } else {
            setFocusedItemKind(null);
          }
        },
        [onHighlightChange],
      );

      const handleSnippetOpen = useCallback(
        (item: SnippetSuggestion) => {
          const category = (item.snippet?.category || '').toLowerCase();
          const snippetId = item.snippet?.snippet_id || item.snippet?.id || '';

          if (isLinkCategory(category)) {
            const urls = extractUrlsFromSnippet(item.snippet);
            trackCounterEvent('link_open_count', {
              source: 'new_tab',
              origin: 'home_view',
              urlCount: urls.length || 1,
              snippetId,
              category,
            });
          } else {
            trackCounterEvent('note_open_count', {
              source: 'new_tab',
              origin: 'home_view',
              snippetId,
              category,
            });
          }

          onSnippetSelect(item);
        },
        [onSnippetSelect],
      );

      const handleOpenUrls = useCallback(
        (urls: string[], title?: string) => {
          if (urls?.length) {
            trackCounterEvent('link_open_count', {
              source: 'new_tab',
              origin: 'home_view',
              urlCount: urls.length,
              title: title || '',
            });
          }
          onRequestOpenUrls?.(urls, title);
        },
        [onRequestOpenUrls],
      );

      const getDynamicActionLabel = () => {
        return 'Options';
      };

      if (isCommandLocked || isAtMenuOpen || isPromptMenuOpen) {
        return null;
      }

      return (
        <div className="max-h-[70%] h-fit w-full flex flex-col relative">
          <InteractiveItemsList
            ref={ref}
            sections={sections}
            todoCounts={todoCounts}
            onQuickCommandSelect={onQuickCommandSelect}
            onCommandPreview={onCommandPreview}
            onSnippetSelect={handleSnippetOpen}
            onRequestSnippetDelete={onRequestSnippetDelete}
            onRequestFocusSearch={onRequestFocusSearch}
            onHighlightChange={handleHighlightChange}
            actionsButtonLabel={getDynamicActionLabel()}
            onToggleFavorite={toggleFavoriteForItem}
            onRequestEditLink={onRequestLinkEdit}
            selectedAIs={selectedAIs}
            onToggleAI={handleToggleAI}
            inlineNotification={inlineNotification}
            isCommandLocked={isCommandLocked}
            isPromptMenuOpen={isPromptMenuOpen}
            isAtMenuOpen={isAtMenuOpen}
            isSuggestionVisible={isSuggestionVisible}
            onNavigateToListView={onNavigateToListView}
            isLoggedIn={isLoggedIn}
            status={commandStatus}
            onRequestOpenUrls={handleOpenUrls} // Pass it down
            folderInfo={
              selectedFolder
                ? (() => {
                  // Show the top-level folder name even if a sub-folder is selected
                  const findRootFolder = (team: Team | null, folderId: string): Folder | null => {
                    if (!team?.workspaces) return null;
                    for (const workspace of team.workspaces) {
                      let root: Folder | null = null;
                      const search = (folder: Folder, ancestor: Folder): boolean => {
                        if (String(folder.folder_id) === String(folderId)) {
                          root = ancestor;
                          return true;
                        }
                        return (folder.folders || []).some(sub => search(sub, ancestor));
                      };
                      for (const folder of workspace.folders || []) {
                        if (search(folder, folder) && root) return root;
                      }
                    }
                    return null;
                  };

                  const rootFolder = findRootFolder(selectedTeam, selectedFolder.folder_id) || selectedFolder;
                  return {
                    name: rootFolder.folder_name,
                    notesCount: teamSnippets.filter(
                      s => !isLinkCategory(s.snippet.category) && !isPromptCategory(s.snippet.category),
                    ).length,
                    promptsCount: teamSnippets.filter(s => isPromptCategory(s.snippet.category)).length,
                    linksCount: teamSnippets.filter(s => isLinkCategory(s.snippet.category)).length,
                  };
                })()
                : null
            }
          />
        </div>
      );
    },
  ),
);

HomeView.displayName = 'HomeView';

export default HomeView;
