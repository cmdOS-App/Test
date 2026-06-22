import React, { forwardRef, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { FaFileAlt, FaLayerGroup, FaLink, FaStar } from 'react-icons/fa';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../../Shared/Icons/StackedLinkIcon';
import { LuSparkles } from 'react-icons/lu';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { AiOutlineEnter } from 'react-icons/ai';
import { selectSelectedTeam, selectSelectedFolder } from '../../../../../Redux/AllData/uiStateSlice';
import type { RootState } from '../../../../../Redux/store';
import type { Folder, Snippet, Team, Workspace } from '../../../../../modals/interfaces';
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
  buildSnippetDeleteDetail,
} from './snippetInteractiveUtils';
import type { SnippetActionDetail, SnippetSuggestion } from './types';
import { getFaviconUrl } from '../../SearchComponents/Searchbar/utils';
import { useDispatch } from 'react-redux';
import { selectAllData } from '../../../../../Redux/AllData/allDataSlice';
import useToast from '../../Shared/Toast/useToast';
import { performOrganizationSwitch } from '../../../commands/list/SwitchOrganizationCommand';
import { FaBuilding } from 'react-icons/fa';

export type AllItemsViewProps = {
  itemType: 'notes' | 'links' | 'prompts' | 'bookmarks' | 'organizations';
  onClose: () => void;
  onSnippetSelect: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestEditLink?: (suggestion: SnippetSuggestion) => void;
  searchQuery?: string; // External search query from main searchbar
};

export interface AllItemsViewHandle {
  focus: () => void;
}

type AllItemEntry = {
  workspace?: Workspace;
  folder?: Folder | null;
  snippet?: Snippet;
  team?: Team; // For organizations view
};

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-0.5">
    {keys.map(key => (
      <span
        key={key}
        className="rounded border border-white/60 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-medium text-neutral-500 dark:text-neutral-400 shadow-sm">
        {key}
      </span>
    ))}
  </span>
);

const renderIcon = (category: string | null | undefined, snippet?: any) => {
  const iconType = resolveSnippetIcon(category);

  if (iconType === 'link' || iconType === 'tabgroup') {
    let urls: string[] = [];
    if (snippet) {
      urls = extractUrlsFromSnippet(snippet);
    }
    return <StackedLinkIcon urls={urls} size={16} fallback={iconType === 'tabgroup' ? 'tabgroup' : 'link'} />;
  }

  if (iconType === 'prompt') return <LuSparkles className="h-4 w-4 text-[var(--color-iconDefault)]" />;
  return <NotesIcon size={16} className="text-[var(--color-iconDefault)]" />;
};

const openSingleLink = (url: string) => {
  if (!url) return;

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

const openMultipleLinks = async (urls: string[]) => {
  if (!urls.length) return;

  const chromeAny = (window as any)?.chrome;

  const getFinalUrl = (url: string) => {
    if (url.startsWith('agent_chat?id=')) {
      const agentId = url.split('id=')[1];
      return chromeAny?.runtime?.getURL
        ? chromeAny.runtime.getURL(`new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`)
        : '';
    }
    return url;
  };

  const finalUrls = urls.map(getFinalUrl).filter(Boolean);
  if (!finalUrls.length) return;

  const firstUrl = finalUrls[0];

  if (chromeAny?.tabs) {
    chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs && tabs[0]) {
        // Update current tab with first URL, open remaining in new tabs
        chromeAny.tabs.update(tabs[0].id, { url: firstUrl });
        finalUrls.slice(1).forEach(url => chromeAny.tabs.create({ url }));
      } else {
        // Fallback: create new tabs for all URLs
        finalUrls.forEach(url => chromeAny.tabs.create({ url }));
      }
    });
  } else {
    // Navigate current tab, open remaining in new windows as a last resort
    window.location.href = firstUrl;
    finalUrls.slice(1).forEach(url => window.open(url, '_blank', 'noopener'));
  }
};

const AllItemsView = forwardRef<AllItemsViewHandle, AllItemsViewProps>(
  (
    {
      itemType,
      onClose,
      onSnippetSelect,
      onRequestSnippetDelete,
      onRequestOpenUrls,
      onRequestEditLink,
      searchQuery = '',
    },
    ref,
  ) => {
    const dispatch = useDispatch();
    const selectedTeam = useSelector((state: RootState) => selectSelectedTeam(state));
    const allTeams = useSelector((state: RootState) => selectAllData(state));
    const selectedFolder = useSelector((state: RootState) => selectSelectedFolder(state));
    const selectedTeamId = selectedTeam?.team_id || '';

    const [focusIndex, setFocusIndex] = useState(0);
    const [isReady, setIsReady] = useState(false); // New interaction shield
    const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [favoritesMapping, setFavoritesMapping] = useState<Record<string, Snippet[]>>({});

    // Load favorites
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
        // ignore
      }
    }, []);

    const favoriteIdSet = useMemo(() => {
      const list = favoritesMapping[selectedTeamId] || [];
      const set = new Set<string>();
      list.forEach(s => {
        const favId = (s as any)?.id || (s as any)?.snippet_id;
        if (favId) set.add(favId);
      });
      return set;
    }, [favoritesMapping, selectedTeamId]);

    // Get all items from team
    const allItems = useMemo<AllItemEntry[]>(() => {
      // Organizations: return all teams directly, no snippet processing needed
      if (itemType === 'organizations') {
        if (!allTeams || allTeams.length === 0) return [];
        return allTeams.map(t => ({ team: t }));
      }

      const team: Team | null = selectedTeam;
      if (!team?.workspaces) return [];

      const results: AllItemEntry[] = [];

      const collectFolderEntries = (workspace: Workspace, folder: Folder) => {
        (folder.snippets || []).forEach(snippet => {
          results.push({ workspace, folder, snippet });
        });
        (folder.folders || []).forEach(sub => collectFolderEntries(workspace, sub));
      };

      const collectWorkspace = (workspace: Workspace) => {
        (workspace.workspace_snippets || []).forEach(snippet => {
          results.push({ workspace, folder: null, snippet });
        });
        (workspace.folders || []).forEach(folder => collectFolderEntries(workspace, folder));
      };

      // Helper to find a folder by ID and return both the target folder and its root ancestor
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

      // If a folder is selected, collect from its ROOT folder (shows all sub-folder contents too)
      if (selectedFolder) {
        const targetId = String(selectedFolder.folder_id);
        for (const workspace of team.workspaces) {
          const match = findFolderAndRoot(workspace, targetId);
          if (match) {
            collectFolderEntries(workspace, match.rootFolder);
            break;
          }
        }
      } else {
        team.workspaces.forEach(collectWorkspace);
      }

      // Filter by item type (notes, links, or prompts)
      let filtered = results;
      if (itemType === 'notes') {
        filtered = filtered.filter(entry => entry.snippet && isNoteCategory(entry.snippet.category));
      } else if (itemType === 'links') {
        filtered = filtered.filter(entry => entry.snippet && isLinkCategory(entry.snippet.category));
      } else if (itemType === 'prompts') {
        filtered = filtered.filter(entry => entry.snippet && isPromptCategory(entry.snippet.category));
      }

      // Sort by updated_at descending
      filtered.sort((a, b) => {
        if (!a.snippet || !b.snippet) return 0;
        const aTime = new Date(a.snippet.updated_at || a.snippet.created_at || 0).getTime();
        const bTime = new Date(b.snippet.updated_at || b.snippet.created_at || 0).getTime();
        return bTime - aTime;
      });

      return filtered;
    }, [selectedTeam, selectedFolder, itemType, allTeams]);

    // Filter by search query (from main searchbar)
    const filteredItems = useMemo(() => {
      if (!searchQuery.trim()) return allItems;
      const query = searchQuery.toLowerCase();
      return allItems.filter(entry => {
        if (itemType === 'organizations' && entry.team) {
          return entry.team.team_name.toLowerCase().includes(query);
        }

        // Safety guard: ensure snippet exists for non-org items
        if (!entry.snippet) return false;

        const title = (entry.snippet.key || '').toLowerCase();
        const preview = getSnippetPreview(entry.snippet).toLowerCase();
        const workspaceName = (entry.workspace?.workspace_name || '').toLowerCase();
        const folderName = (entry.folder?.folder_name || '').toLowerCase();

        return (
          title.includes(query) ||
          preview.includes(query) ||
          workspaceName.includes(query) ||
          folderName.includes(query)
        );
      });
    }, [allItems, searchQuery, itemType]);

    // Reset focus index when filtered items change
    useEffect(() => {
      setFocusIndex(0);
    }, [filteredItems.length]);

    // Scroll focused item into view
    useEffect(() => {
      const node = itemRefs.current[focusIndex];
      if (node) {
        node.scrollIntoView({ block: 'nearest' });
      }
    }, [focusIndex]);
    const triggerToast = useToast();

    const handleItemActivate = useCallback(
      (entry: AllItemEntry) => {
        if (itemType === 'organizations' && entry.team) {
          performOrganizationSwitch(dispatch, entry.team, triggerToast);
          onClose();
          return;
        }

        if (!entry.snippet || !entry.workspace) return;
        const suggestion = buildSnippetSuggestion(entry.workspace, entry.folder ?? null, entry.snippet);

        if (isLinkCategory(entry.snippet.category)) {
          const urls = extractUrlsFromSnippet(entry.snippet);
          if (urls.length) {
            if (onRequestOpenUrls) {
              onRequestOpenUrls(urls, entry.snippet.key);
            } else {
              openMultipleLinks(urls);
            }
          } else {
            onSnippetSelect(suggestion);
          }
        } else {
          onSnippetSelect(suggestion);
        }
      },
      [onSnippetSelect, onRequestOpenUrls, itemType, dispatch, triggerToast, onClose],
    );

    // Enable interactions after a short delay
    useEffect(() => {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 300); // 300ms interaction shield
      return () => clearTimeout(timer);
    }, []);

    // Global keyboard handler
    useEffect(() => {
      const handleGlobalKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        const isFromInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        if (event.key === 'ArrowDown') {
          // Allow navigation even when typing in searchbar
          event.preventDefault();
          setFocusIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setFocusIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
          return;
        }

        if (event.key === 'Escape') {
          // Always allow escape to close
          event.preventDefault();
          onClose();
          return;
        }

        // Enter: Only activate if:
        // 1. View is "ready" (shield removed)
        // 2. We allow activation from input because we force focus there
        if (event.key === 'Enter' && isReady && filteredItems[focusIndex]) {
          event.preventDefault();
          handleItemActivate(filteredItems[focusIndex]);
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [filteredItems, focusIndex, onClose, isReady, handleItemActivate]);

    const handleDelete = useCallback(
      (entry: AllItemEntry) => {
        if (!entry.snippet || !entry.workspace) return;
        const suggestion = buildSnippetSuggestion(entry.workspace, entry.folder ?? null, entry.snippet);
        const category = entry.snippet.category;
        const itemKind = isLinkCategory(category) ? 'link' : 'note';
        const detail = buildSnippetDeleteDetail(suggestion, itemKind);
        if (detail) {
          onRequestSnippetDelete(detail);
        }
      },
      [onRequestSnippetDelete],
    );

    const handleEdit = useCallback(
      (entry: AllItemEntry) => {
        if (!entry.snippet || !entry.workspace) return;
        const suggestion = buildSnippetSuggestion(entry.workspace, entry.folder ?? null, entry.snippet);
        if (isLinkCategory(entry.snippet.category) && onRequestEditLink) {
          onRequestEditLink(suggestion);
        } else {
          onSnippetSelect(suggestion);
        }
      },
      [onSnippetSelect, onRequestEditLink],
    );

    React.useImperativeHandle(ref, () => ({
      focus: () => containerRef.current?.focus(),
    }));

    const emptyMessage =
      itemType === 'notes'
        ? 'No notes found. Create your first note!'
        : itemType === 'links'
          ? 'No links found. Save your first link!'
          : itemType === 'organizations'
            ? 'No organizations found.'
            : 'No prompts found. Create your first prompt!';

    return (
      <div ref={containerRef} className="h-full w-full flex flex-col overflow-hidden" tabIndex={-1}>
        {/* Items List - Glass theme, no background */}
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-2 py-1 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {itemType === 'notes' ? (
                <NotesIcon size={40} className="text-neutral-300 dark:text-neutral-600 mb-3" />
              ) : itemType === 'links' ? (
                <FaLink className="h-10 w-10 text-neutral-300 dark:text-neutral-600 mb-3" />
              ) : (
                <LuSparkles className="h-10 w-10 text-neutral-300 dark:text-neutral-600 mb-3" />
              )}
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">{emptyMessage}</p>
            </div>
          ) : (
            filteredItems.map((entry, idx) => {
              const isActive = idx === focusIndex;
              const snippetId =
                entry.snippet?.id || (entry.snippet as any)?.snippet_id || (entry.team ? entry.team.team_id : '');
              const isFavorite = snippetId ? favoriteIdSet.has(snippetId) : false;
              const context =
                itemType === 'organizations'
                  ? ''
                  : entry.folder
                    ? `${entry.workspace?.workspace_name} / ${entry.folder.folder_name}`
                    : entry.workspace?.workspace_name;
              const urls =
                entry.snippet && isLinkCategory(entry.snippet.category) ? extractUrlsFromSnippet(entry.snippet) : [];

              const key =
                itemType === 'organizations' && entry.team
                  ? `org-${entry.team.team_id}`
                  : buildSuggestionKey(entry.workspace!, entry.folder ?? null, entry.snippet!, idx);

              return (
                <button
                  key={key}
                  ref={el => {
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => handleItemActivate(entry)}
                  onMouseEnter={() => setFocusIndex(idx)}
                  className={`w-full text-left px-2 py-1.5 flex items-center gap-2 rounded-lg transition-colors border mb-0.5 ${isActive
                    ? 'bg-white/80 shadow-sm border-white/80 dark:bg-white/10 dark:border-white/20'
                    : 'border-transparent hover:bg-white/50 dark:hover:bg-white/5'
                    }`}>
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {itemType === 'organizations' ? (
                      <div className="w-4 h-4 flex items-center justify-center text-[var(--color-iconDefault)]">
                        <FaBuilding size={14} />
                      </div>
                    ) : isLinkCategory(entry.snippet?.category) && urls.length > 0 ? (
                      <div className="w-4 h-4 rounded-full bg-white ring-1 ring-white overflow-hidden shadow-sm">
                        <img src={getFaviconUrl(urls[0])} alt="" className="w-4 h-4 object-cover" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 flex items-center justify-center">
                        {renderIcon(entry.snippet?.category, entry.snippet)}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="font-inter text-[16.2px] font-normal leading-[22px] tracking-[-0.002em] text-neutral-800 dark:text-neutral-100 truncate"
                      style={headingFontStyle}>
                      {itemType === 'organizations'
                        ? entry.team?.team_name
                        : entry.snippet?.key || (itemType === 'notes' ? 'Untitled note' : 'Untitled link')}
                    </span>
                    {entry.snippet && isFavorite && <FaStar className="h-2.5 w-2.5 text-yellow-500 flex-shrink-0" />}
                  </div>

                  {/* Path - Right side */}
                  {itemType !== 'organizations' && (
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate max-w-[140px] flex-shrink-0">
                      {context}
                    </span>
                  )}

                  {/* Actions (show on hover/focus) */}
                  {isActive && itemType !== 'organizations' && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleEdit(entry);
                        }}
                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[var(--color-iconDefault)] hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                        title="Edit">
                        <FiEdit2 size={12} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(entry);
                        }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-iconDefault)] hover:text-red-500 transition-colors"
                        title="Delete">
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer - With count */}
        <div className="relative flex items-center justify-between gap-3 px-3 py-1.5 border-t border-white/10 dark:border-white/5 bg-white/30 dark:bg-transparent text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-transparent bg-white/10 dark:bg-white/5 px-1 py-[1px]">
              <span className="font-semibold text-neutral-500 dark:text-neutral-400">Navigate</span>
              <KeyHint keys={['↑', '↓']} />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-transparent bg-white/10 dark:bg-white/5 px-1 py-[1px]">
              <span className="font-semibold text-neutral-500 dark:text-neutral-400">Open</span>
              <AiOutlineEnter />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-transparent bg-white/10 dark:bg-white/5 px-1 py-[1px]">
              <span className="font-semibold text-neutral-500 dark:text-neutral-400">Back</span>
              <KeyHint keys={['Esc']} />
            </div>
          </div>
          {/* Count on the right */}
          <div className="flex items-center gap-1.5">
            {itemType === 'notes' ? (
              <NotesIcon size={14} className="text-[var(--color-iconDefault)]" />
            ) : itemType === 'links' ? (
              <FaLink className="h-3 w-3 text-[var(--color-iconDefault)]" />
            ) : itemType === 'organizations' ? (
              <FaBuilding size={12} className="text-[var(--color-iconDefault)]" />
            ) : (
              <LuSparkles className="h-3 w-3 text-[var(--color-iconDefault)]" />
            )}
            <span className="text-neutral-500 dark:text-neutral-400">
              {filteredItems.length} {itemType}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

AllItemsView.displayName = 'AllItemsView';

export default AllItemsView;
