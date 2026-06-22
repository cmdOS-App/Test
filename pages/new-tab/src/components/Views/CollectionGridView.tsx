import React, { useMemo, useEffect, useRef } from 'react';
import { enqueueFavoriteAction } from '../../../../Apis/services/favoritesQueue';
import { useDispatch, useSelector } from 'react-redux';
import { Folder, Snippet, Workspace } from '../../../../modals/interfaces';
import { navigateToView, openLinkEditModal, viewSnippet } from '../../../../Redux/AllData/uiStateSlice';
import { deleteSnippet } from '../../../../Apis/features/snippetApi';
import CreateCollectionPopup from '../Modals/CreateCollectionPopup';
import LinkSidebar from '../Editor/LinksSideBar';
import InteractiveItemsList, {
  InteractiveSection,
  SnippetInteractiveItem,
  FolderInteractiveItem,
} from '../Views/HomeView/InteractiveItemsList';
import {
  setSelectedFolder,
  setSnippetBreadCrum,
  setIsCreatingNewItem,
  selectCommandStatus,
  setSelectedSnippet,
  setSelectedWorkspace,
  setSelectedFolder as setSelectedFolderAction,
} from '../../../../Redux/AllData/uiStateSlice';

import {
  buildSnippetSuggestion,
  buildSuggestionKey,
  getSnippetPreview,
  isLinkCategory,
  isPromptCategory,
  resolveSnippetIcon,
  buildSnippetDeleteDetail,
} from './HomeView/snippetInteractiveUtils';
import type { SnippetSuggestion } from '../SearchComponents/Searchbar/Searchbar';
import type { SnippetActionDetail } from './HomeView/types';

interface CollectionGridViewProps {
  reload: () => void;
  selectedTeamId: string;
  folders: Folder[];
  workspaceSnippets: Snippet[];
  onItemClick: (item: Snippet) => void;
  selectedItem: string | null;
  selectedFolder: Folder | null;
  workspace: Workspace | null;
  openLinkSideBar: () => void;
  scrollToFolderId: string | null;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  isDarkMode?: boolean;
  isLoggedIn: boolean;
}

const CollectionGridView: React.FC<CollectionGridViewProps> = ({
  reload,
  workspaceSnippets,
  selectedFolder,
  workspace,
  selectedTeamId,
  folders,
  onItemClick,
  onRequestSnippetDelete,
  onNavigateToListView,
  isDarkMode,
  isLoggedIn,
}) => {
  const dispatch = useDispatch();
  const commandStatus = useSelector(selectCommandStatus);
  const [showCreateCollectionPopup, setShowCreateCollectionPopup] = React.useState(false);
  const [isLinkSidebarOpen, setIsLinkSidebarOpen] = React.useState(false);

  // Use store import if needed, but since it's passed as prop, we prioritize prop.
  // We need to import useStore if accessing state directly, but better to use prop.
  // I will check imports if useStore is available. Step 735 shows imports: React, useDispatch, types... NO useStore.
  // So I rely on 'selectedTeamId' prop.

  // Filter snippets into entries
  const snippetEntries = useMemo(() => {
    if (!workspaceSnippets) return [];

    // Create entries similar to WorkspaceContentView
    const entries = workspaceSnippets.map(snippet => ({
      workspace:
        workspace ||
        ({ workspace_id: 'temp', workspace_name: 'Unknown', folders: [], workspace_snippets: [], workspace_automations: [] } as Workspace),
      folder: selectedFolder,
      snippet,
    }));

    return entries.sort((a, b) => {
      const aTime = new Date(a.snippet.updated_at || a.snippet.created_at || 0).getTime();
      const bTime = new Date(b.snippet.updated_at || b.snippet.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [workspaceSnippets, workspace, selectedFolder]);

  // Favorites logic (ported from HomeView)
  const [favoritesMapping, setFavoritesMapping] = React.useState<Record<string, Snippet[]>>({});
  // selectedTeamId is already available from props.
  const [userId, setUserId] = React.useState<string>('');

  useEffect(() => {
    const init = async () => {
      const { getUserId } = await import('../../../../Apis/core/api');
      const uid = await getUserId();
      setUserId(uid);
    };
    init();

    const loadFavorites = () => {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('myFavouriteItems', (result: { myFavouriteItems?: Record<string, Snippet[]> }) => {
          if (result.myFavouriteItems) {
            setFavoritesMapping(result.myFavouriteItems);
          }
        });
      }
    };
    loadFavorites();

    // Listen for changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.myFavouriteItems) {
        setFavoritesMapping(changes.myFavouriteItems.newValue || {});
      }
    };
    if ((window as any)?.chrome?.storage) {
      (window as any).chrome.storage.onChanged.addListener(handleStorageChange);
    }
    return () => {
      if ((window as any)?.chrome?.storage) {
        (window as any).chrome.storage.onChanged.removeListener(handleStorageChange);
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
  }, [favoritesMapping, selectedTeamId]);

  const noteItems = useMemo<SnippetInteractiveItem[]>(() => {
    return snippetEntries
      .filter(entry => !isLinkCategory(entry.snippet.category) && !isPromptCategory(entry.snippet.category))
      .map((entry, index) => {
        // Fallback for missing workspace/folder if needed
        const ws = entry.workspace;
        const id = buildSuggestionKey(ws, entry.folder, entry.snippet, index);
        const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
        const context = entry.folder
          ? `${ws.workspace_name || ''} • ${entry.folder.folder_name}`
          : ws.workspace_name || '';

        return {
          kind: 'note',
          id,
          title: entry.snippet.key || 'Untitled note',
          context,
          preview: getSnippetPreview(entry.snippet),
          icon: resolveSnippetIcon(entry.snippet.category) as any,
          suggestion: buildSnippetSuggestion(ws, entry.folder, entry.snippet),
          isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
        };
      });
  }, [snippetEntries, favoriteIdSet]);

  const promptItems = useMemo<SnippetInteractiveItem[]>(() => {
    return snippetEntries
      .filter(entry => isPromptCategory(entry.snippet.category))
      .map((entry, index) => {
        const ws = entry.workspace;
        const id = buildSuggestionKey(ws, entry.folder, entry.snippet, index + noteItems.length);
        const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
        const context = entry.folder
          ? `${ws.workspace_name || ''} • ${entry.folder.folder_name}`
          : ws.workspace_name || '';

        return {
          kind: 'prompt', // Correct kind for prompt
          id,
          title: entry.snippet.key || 'Untitled prompt',
          context,
          preview: getSnippetPreview(entry.snippet),
          icon: resolveSnippetIcon(entry.snippet.category) as any,
          suggestion: buildSnippetSuggestion(ws, entry.folder, entry.snippet),
          isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
        };
      });
  }, [snippetEntries, noteItems.length, favoriteIdSet]);

  const linkItems = useMemo<SnippetInteractiveItem[]>(() => {
    return snippetEntries
      .filter(entry => isLinkCategory(entry.snippet.category))
      .map((entry, index) => {
        const ws = entry.workspace;
        const id = buildSuggestionKey(ws, entry.folder, entry.snippet, index + noteItems.length + promptItems.length);
        const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
        const context = entry.folder
          ? `${ws.workspace_name || ''} • ${entry.folder.folder_name}`
          : ws.workspace_name || '';

        return {
          kind: 'link',
          id,
          title: entry.snippet.key || 'Untitled link',
          context,
          preview: getSnippetPreview(entry.snippet) || 'Multiple URLs saved',
          icon: resolveSnippetIcon(entry.snippet.category),
          suggestion: buildSnippetSuggestion(ws, entry.folder, entry.snippet),
          isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
        };
      });
  }, [snippetEntries, noteItems.length, favoriteIdSet]);

  const folderItems = useMemo<FolderInteractiveItem[]>(() => {
    return folders.map(folder => {
      const ws =
        workspace ||
        ({ workspace_id: 'temp', workspace_name: 'Unknown', folders: [], workspace_snippets: [], workspace_automations: [] } as Workspace);
      // We need unique ID
      const id = `folder-${folder.folder_id}`;

      return {
        kind: 'folder',
        id,
        title: folder.folder_name,
        context: ws.workspace_name,
        icon: 'folder',
        // Casting snippet as null to identifying it as a folder navigational item
        suggestion: { workspace: ws, folder, snippet: null as unknown as Snippet } as SnippetSuggestion,
      };
    });
  }, [folders, workspace]);

  const isFolderView = Boolean(selectedFolder);

  const sections = useMemo<InteractiveSection[]>(
    () =>
      [
        {
          key: 'prompts',
          title: 'Prompts',
          items: promptItems,
        },
        {
          key: 'notes',
          title: 'Notes',
          items: noteItems,
        },
        {
          key: 'links',
          title: 'Links',
          items: linkItems,
        },
      ].filter(section => section.items.length > 0),
    [linkItems, noteItems, promptItems],
  );

  const handleSnippetSelect = (suggestion: SnippetSuggestion) => {
    // console.log('Snippet select:', suggestion);
    // Handle Folder Navigation
    if (!suggestion.snippet && suggestion.folder) {
      // console.log('Navigating to folder:', suggestion.folder);
      dispatch(setSelectedFolder(suggestion.folder));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: suggestion.workspace.workspace_id,
          workspace_name: suggestion.workspace.workspace_name,
          folder_id: suggestion.folder.folder_id,
          folder_name: suggestion.folder.folder_name,
        }),
      );
      return;
    }

    dispatch(setIsCreatingNewItem(false));

    // Call parent handler to switch view immediately
    if (onItemClick && suggestion.snippet) {
      onItemClick(suggestion.snippet);
    }

    dispatch(
      viewSnippet({
        snippet: suggestion.snippet,
        breadcrumb: {
          workspace_id: suggestion.workspace.workspace_id,
          workspace_name: suggestion.workspace.workspace_name,
          folder_id: suggestion.folder?.folder_id ?? null,
          folder_name: suggestion.folder?.folder_name ?? null,
        },
      }),
    );
  };

  const handleRequestSnippetDelete = async (detail: SnippetActionDetail) => {
    if (onRequestSnippetDelete) {
      onRequestSnippetDelete(detail);
    }
  };

  const handleRequestEditLink = (suggestion: SnippetSuggestion) => {
    const snippet = suggestion.snippet;
    const category = (snippet.category || '').toLowerCase();

    // If it's a TabGroup, we need to open bulk editor
    // Since CollectionGridView doesn't have direct access to setMainView,
    // we'll dispatch the necessary state and dispatch a custom event
    if (category === 'tabgroup' || category === 'tab group') {
      dispatch(setSelectedSnippet(snippet));
      dispatch(setIsCreatingNewItem(false));
      dispatch(setSelectedWorkspace(suggestion.workspace));
      dispatch(setSelectedFolder(suggestion.folder ?? null));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: suggestion.workspace.workspace_id,
          workspace_name: suggestion.workspace.workspace_name,
          folder_id: suggestion.folder ? suggestion.folder.folder_id : null,
          folder_name: suggestion.folder ? suggestion.folder.folder_name : null,
        }),
      );
      // Dispatch a custom event that Container can listen to
      window.dispatchEvent(new CustomEvent('openBulkEditor', { detail: { snippet } }));
      return;
    }

    // If it's a Prompt, open prompt editor
    if (isPromptCategory(category)) {
      dispatch(setSelectedWorkspace(suggestion.workspace));
      dispatch(setSelectedFolder(suggestion.folder ?? null));
      dispatch(setSelectedSnippet(snippet));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: suggestion.workspace.workspace_id,
          workspace_name: suggestion.workspace.workspace_name,
          folder_id: suggestion.folder ? suggestion.folder.folder_id : null,
          folder_name: suggestion.folder ? suggestion.folder.folder_name : null,
        }),
      );
      dispatch(
        navigateToView({
          kind: 'promptEditor',
          promptProps: { snippet },
        }),
      );
      return;
    }

    // Regular link - open link editor
    dispatch(openLinkEditModal({ editMode: true, snippet }));
  };

  // ... inside component ...

  const toggleFavoriteForItem = (item: SnippetInteractiveItem | any) => {
    // Only handle snippet items, ignore commands
    if ('commandId' in item) return;
    // Enqueue globally
    enqueueFavoriteAction(async () => {
      if (!selectedTeamId) return;

      try {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local) return;

        let currentUserId = userId;
        if (!currentUserId) {
          const { getUserId } = await import('../../../../Apis/core/api');
          currentUserId = await getUserId();
          setUserId(currentUserId);
        }
        if (!currentUserId) return;

        const { addFavorite, deleteFavorite, getFavorites } = await import('../../../../Apis/services/favoritesApi');

        // Async Get
        const result = await new Promise<any>(resolve => chromeAny.storage.local.get('myFavouriteItems', resolve));
        const favItems = result.myFavouriteItems || {};
        const currentFavList: Snippet[] = favItems[currentUserId] || [];
        const snippet = item.suggestion.snippet;
        const snippetId = (snippet as any)?.id || (snippet as any)?.snippet_id;

        const existingFav = currentFavList.find(fav => {
          const favId = (fav as any)?.id || (fav as any)?.snippet_id;
          return favId === snippetId;
        });
        const isAlreadyFav = !!existingFav;

        const normalizedSnippet =
          (snippet as any)?.id || !(snippet as any)?.snippet_id
            ? snippet
            : ({ ...snippet, id: (snippet as any).snippet_id } as Snippet);

        if (isAlreadyFav) {
          // --- REMOVE FLOW ---
          const updatedFavList = currentFavList.filter(fav => {
            const favId = (fav as any)?.id || (fav as any)?.snippet_id;
            return favId !== snippetId;
          });
          const updatedMapping = { ...favItems, [currentUserId]: updatedFavList };

          await new Promise<void>(resolve =>
            chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
          );
          reload();

          // API Call
          if (existingFav && existingFav.favourite_id) {
            const fid = String(existingFav.favourite_id);
            if (!fid.startsWith('pending-')) {
              await deleteFavorite(currentUserId, Number(existingFav.favourite_id)).catch(console.error);
            }
          }
          // Skip heavy fallback for queued operations to keep UI snappy, unless critical?
          // Let's keep fallback logic but simplified or trusted.
        } else {
          // --- ADD FLOW ---
          const tempItem = { ...normalizedSnippet, favourite_id: 'pending-' + Date.now() };
          const updatedFavList = [tempItem, ...currentFavList];
          const updatedMapping = { ...favItems, [currentUserId]: updatedFavList };

          await new Promise<void>(resolve =>
            chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
          );
          reload();

          // API Call
          const type = 'type' in snippet && (snippet as any).type === 'command' ? 'command' : 'snippet';
          if (normalizedSnippet.id) {
            try {
              const addedItem = await addFavorite(currentUserId, { id: normalizedSnippet.id }, type);
              if (addedItem && addedItem.favourite_id) {
                // ID Update
                const latestRes = await new Promise<any>(resolve =>
                  chromeAny.storage.local.get('myFavouriteItems', resolve),
                );
                const latestMap = latestRes.myFavouriteItems || {};
                const latestList = latestMap[currentUserId] || [];

                // Ghost Check
                const stillThere = latestList.some((f: any) => (f.snippet_id || f.id) === snippetId);
                if (!stillThere) {
                  
                  await deleteFavorite(currentUserId, addedItem.favourite_id);
                } else {
                  const correctedList = latestList.map((f: any) => {
                    if ((f.snippet_id || f.id) === snippetId) {
                      return { ...f, favourite_id: addedItem.favourite_id };
                    }
                    return f;
                  });
                  const mappingWithId = { ...favItems, [currentUserId]: correctedList };
                  await new Promise<void>(resolve =>
                    chromeAny.storage.local.set({ myFavouriteItems: mappingWithId }, resolve),
                  );
                  // No reload needed for ID update
                }
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      } catch (e) {
        console.error('Failed to toggle favorite', e);
      }
    });
  };

  return (
    <div className="flex flex-col bg-transparent w-full h-full min-h-0">
      <InteractiveItemsList
        sections={sections}
        onSnippetSelect={handleSnippetSelect}
        onRequestSnippetDelete={handleRequestSnippetDelete as any}
        onRequestEditLink={handleRequestEditLink}
        onToggleFavorite={toggleFavoriteForItem}
        actionsButtonLabel="Options"
        folderInfo={{
          name: selectedFolder ? selectedFolder.folder_name : workspace?.workspace_name || 'Workspace',
          notesCount: noteItems.length,
          linksCount: linkItems.length,
          promptsCount: promptItems.length,
        }}
        status={commandStatus}
        isLoggedIn={isLoggedIn}
      />

      <CreateCollectionPopup
        isOpen={showCreateCollectionPopup}
        onClose={() => setShowCreateCollectionPopup(false)}
        reload={reload}
        selectedWorkspace={workspace || ({} as Workspace)}
      />

      <LinkSidebar
        reload={reload}
        isOpen={isLinkSidebarOpen}
        onClose={() => {
          setIsLinkSidebarOpen(false);
        }}
        folders={[]}
        workspace={workspace || ({} as Workspace)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default CollectionGridView;
