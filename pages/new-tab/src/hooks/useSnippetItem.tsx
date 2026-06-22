import useToast from '@src/components/Shared/Toast/useToast';
import type { ItemProps } from '@src/types';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { FaBook, FaLink, FaTerminal, FaLayerGroup, FaImage, FaFile } from 'react-icons/fa';
import NotesIcon from '../components/Shared/Icons/NotesIcon';
import StackedLinkIcon from '../components/Shared/Icons/StackedLinkIcon';
import type { Snippet, Tabs } from '../../../modals/interfaces';
import { deleteSnippet } from '../../../Apis/features/snippetApi';
import {
  navigateToView,
  viewSnippet,
  setSelectedWorkspace,
  setSelectedFolder,
  setIsCreatingNewItem,
  setDebouncedSearchTerm,
  setSelectedSnippet,
  setSnippetBreadCrum,
  clearEditorStates,
  openLinkEditModal,
} from '../../../Redux/AllData/uiStateSlice';
import DOMPurify from 'dompurify';
import { useSelector } from 'react-redux';
import {
  isLinkCategory,
  isPromptCategory,
  isTabGroupCategory,
  isNoteCategory,
  resolveNodeAction,
} from '../components/Views/HomeView/snippetInteractiveUtils';

export const useSnippetItem = ({
  userId,
  snippet,
  workspace,
  folder,
  reload,
  selectedItem,
  selectedTeamId,
  favoritesMapping,
  setFavoritesMapping,
  index,
  moveSnippet,
  snippetList,
  isWorkspaceLevel,
}: ItemProps) => {
  const dispatch = useDispatch();
  const triggerToast = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isPublicLinkDialogOpen, setIsPublicLinkDialogOpen] = useState(false);

  const getItemIcon = (itemType: string, customSnippet?: Snippet) => {
    const targetSnippet = customSnippet || snippet;

    if (isNoteCategory(itemType)) return <NotesIcon size={18} className="text-neutral-500 dark:text-neutral-400" />;

    if (isPromptCategory(itemType)) return <FaTerminal className="text-purple-500 dark:text-purple-400" size={18} />;

    if (isTabGroupCategory(itemType) || isLinkCategory(itemType)) {
      let urls: string[] = [];
      if (targetSnippet) {
        if (typeof targetSnippet.value === 'string') {
          try {
            const parsed = JSON.parse(targetSnippet.value);
            urls = Array.isArray(parsed?.urls) ? parsed.urls : parsed?.url ? [parsed.url] : [targetSnippet.value];
          } catch {
            urls = [targetSnippet.value];
          }
        } else if (targetSnippet.value && typeof targetSnippet.value === 'object') {
          const val = targetSnippet.value as any;
          urls = Array.isArray(val?.urls) ? val.urls : val?.url ? [val.url] : [];
        }
      }

      return <StackedLinkIcon urls={urls} size={18} fallback={isTabGroupCategory(itemType) ? 'tabgroup' : 'link'} />;
    }

    return null;
  };
  const getItemTypeLabel = (itemType: string) => {
    const normalized = (itemType || '').toLowerCase();
    if (normalized === 'snippet') {
      return {
        label: 'Snippet',
        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      };
    }
    if (isNoteCategory(itemType)) {
      return {
        label: 'Note',
        color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
      };
    }
    if (isPromptCategory(itemType)) {
      return {
        label: 'Prompt',
        color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
      };
    }
    if (itemType?.toLowerCase() === 'agent') {
      return {
        label: 'Chat Agent',
        color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      };
    }
    if (isTabGroupCategory(itemType)) {
      return {
        label: 'Link Group',
        color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
      };
    }
    if (isLinkCategory(itemType)) {
      return {
        label: 'Link',
        color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
      };
    }
    if (itemType?.toLowerCase() === 'image' || itemType?.toLowerCase() === 'picture') {
      return {
        label: 'Image',
        color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
      };
    }
    if (itemType?.toLowerCase() === 'file') {
      return {
        label: 'File',
        color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
      };
    }
    return {
      label: 'Unknown',
      color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
    };
  };

  // Helper function to open a note
  const openNote = (snippetId: string, inCurrentTab: boolean = true) => {
    if (!snippetId) {
      console.warn('[openNote] No snippetId provided');
      return;
    }
    const chromeAny = (window as any)?.chrome;

    let extensionUrl = '';
    if (chromeAny?.runtime?.getURL) {
      extensionUrl = chromeAny.runtime.getURL(
        `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
      );
    }

    if (!extensionUrl) return;

    if (inCurrentTab) {
      window.location.href = extensionUrl;
    } else {
      chromeAny.tabs.create({ url: extensionUrl, active: false });
    }
  };

  const openSingleLink = (url: string): void => {
    // Check if URL is a note: prefix
    if (url.startsWith('note:')) {
      const noteId = url.substring(5); // Remove 'note:' prefix
      openNote(noteId, true);
      return;
    }

    if (url.startsWith('agent_chat?id=')) {
      const agentId = url.split('id=')[1];
      const extensionUrl = chrome.runtime.getURL(
        `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
      );
      window.location.href = extensionUrl;
      return;
    }

    window.location.href = url;
  };

  // Helper function to normalize URLs for comparison
  // Ignores protocol (http vs https) since most sites redirect anyway
  const normalizeUrl = (url: string): string => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      // Normalize: ignore protocol, lowercase hostname, remove trailing slash from path, preserve query and hash
      const normalized = `${urlObj.hostname.toLowerCase()}${urlObj.pathname.replace(/\/$/, '')}${urlObj.search}${urlObj.hash}`;
      return normalized;
    } catch {
      // If URL parsing fails, return lowercase version (trimmed)
      return url.toLowerCase().trim();
    }
  };

  const openMultipleLinks = (urls: string[]): void => {
    if (!urls || urls.length === 0) return;

    const finalUrls = urls
      .map(url => {
        if (url.startsWith('note:')) {
          const sid = url.substring(5);
          return chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`);
        }
        if (url.startsWith('agent_chat?id=')) {
          const agentId = url.split('id=')[1];
          return chrome.runtime.getURL(`new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`);
        }
        return url;
      })
      .filter(Boolean);

    if (finalUrls.length === 0) return;

    // Background FIRST
    finalUrls.slice(1).forEach(url => {
      chrome.tabs.create({ url, active: false });
    });

    // Current LAST
    window.location.href = finalUrls[0];
  };

  const parseTabGroup = (val: unknown): Tabs => {
    try {
      if (!val) return { names: [], urls: [] };
      if (typeof val === 'string') {
        const parsed = JSON.parse(val);
        const names = Array.isArray(parsed?.names) ? parsed.names : [];
        const urls = Array.isArray(parsed?.urls) ? parsed.urls : [];
        return { names, urls };
      }
      const obj = val as any;
      const names = Array.isArray(obj?.names) ? obj.names : [];
      const urls = Array.isArray(obj?.urls) ? obj.urls : [];
      return { names, urls };
    } catch {
      return { names: [], urls: [] };
    }
  };

  const toggleFavorite = async (item: Snippet) => {
    // 1. Determine target keys (Support both Personal and current Org context)
    const personalKey = userId || '';
    const itemTeamId = (item as any).team_id;

    // We will clean/update both to be safe during removal,
    // but typically we add to the specific context we are in.
    const storageKeys = [personalKey];
    if (itemTeamId && itemTeamId !== personalKey) storageKeys.push(itemTeamId);

    try {
      // Optimistic UI update (Local Storage)
      chrome.storage.local.get('myFavouriteItems', async result => {
        const favItems = result.myFavouriteItems || {};

        // Find if it exists in ANY key
        let isAlreadyFav = false;
        let existingFavId: number | undefined = item.favourite_id;

        storageKeys.forEach(key => {
          if (favItems[key]?.some((f: any) => f.id === item.id)) {
            isAlreadyFav = true;
            if (!existingFavId) {
              existingFavId = favItems[key].find((f: any) => f.id === item.id)?.favourite_id;
            }
          }
        });

        const updatedMapping = { ...favItems };

        if (isAlreadyFav) {
          // REMOVING: Scrub from all possible keys
          Object.keys(updatedMapping).forEach(k => {
            if (Array.isArray(updatedMapping[k])) {
              updatedMapping[k] = updatedMapping[k].filter((f: any) => f.id !== item.id);
            }
          });
        } else {
          // ADDING: Add to the primary context key
          const primaryKey = itemTeamId || personalKey;
          const currentList = updatedMapping[primaryKey] || [];
          const augmentedItem = {
            ...item,
            org_id: selectedTeamId || (workspace as any)?.org_id || (item as any).org_id || '',
            workspace_id: (workspace as any)?.workspace_id || (workspace as any)?.id || (item as any).workspace_id || '',
            folder_id: (folder as any)?.folder_id || (folder as any)?.id || (item as any).folder_id || '',
          };
          updatedMapping[primaryKey] = [augmentedItem, ...currentList];
        }

        chrome.storage.local.set({ myFavouriteItems: updatedMapping }, () => {
          setFavoritesMapping(updatedMapping);
        });

        triggerToast(isAlreadyFav ? 'Removed from Favorites' : 'Added to Favorites', 'success');

        // 2. Sync with Cloud
        if (userId) {
          const { addFavorite, deleteFavorite, getFavorites } = await import('../../../Apis/services/favoritesApi');

          if (!isAlreadyFav) {
            // Adding
            const type = 'type' in item && item.type === 'command' ? 'command' : 'snippet';
            const addedItem = await addFavorite(userId, item, type);

            if (addedItem?.favourite_id) {
              const primaryKey = itemTeamId || personalKey;
              // Re-fetch storage to ensure no race conditions
              chrome.storage.local.get('myFavouriteItems', finalRes => {
                const finalMap = finalRes.myFavouriteItems || {};
                if (finalMap[primaryKey]) {
                  finalMap[primaryKey] = finalMap[primaryKey].map((f: any) =>
                    f.id === item.id ? { 
                      ...f, 
                      favourite_id: addedItem.favourite_id,
                      org_id: selectedTeamId || (workspace as any)?.org_id || f.org_id || '',
                      workspace_id: (workspace as any)?.workspace_id || (workspace as any)?.id || f.workspace_id || '',
                      folder_id: (folder as any)?.folder_id || (folder as any)?.id || f.folder_id || '',
                    } : f,
                  );
                  chrome.storage.local.set({ myFavouriteItems: finalMap }, () => {
                    setFavoritesMapping(finalMap);
                  });
                }
              });
            }
          } else {
            // Removing
            const favIdToDelete = existingFavId || item.favourite_id;
            if (favIdToDelete) {
              await deleteFavorite(userId, favIdToDelete);
            } else {
              // Deep fallback: Find by matching snippet/command ID in cloud
              const cloudFavs = await getFavorites(userId);
              const type = 'type' in item && item.type === 'command' ? 'command' : 'snippet';
              const cloudMatch = cloudFavs.find(f =>
                type === 'command' ? f.command_id === item.id : f.snippet_id === item.id,
              );
              if (cloudMatch) await deleteFavorite(userId, cloudMatch.favourite_id);
            }
          }
        }
      });
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Something went wrong', 'error');
    }
  };

  const handleCopyContent = (item: Snippet) => {
    const content = getItemContent(item, 10000); // high maxLength to get full content
    navigator.clipboard.writeText(content).then(() => {
      triggerToast('Copied to clipboard!', 'success'); // if you're using a toast system
    });
  };
  // Define allowed HTML tags for sanitization
  // This is used to ensure that only safe HTML tags are included in the truncated content}
  const allowedTags = [
    'b',
    'i',
    'strong',
    'em',
    'ol',
    'ul',
    'li',
    'pre',
    'blockquote',
    'br',
    'div',
    'p',
    'u',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span',
    'a',
    'img',
  ];

  const truncateHtml = (html: string, maxLength: number): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let textLength = 0;
    const resultFragment = document.createDocumentFragment();

    const walk = (node: Node, container: Node): boolean => {
      if (textLength >= maxLength) return false;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node as Text).data;
        const remaining = maxLength - textLength;
        const truncatedText = text.slice(0, remaining);
        textLength += truncatedText.length;
        container.appendChild(document.createTextNode(truncatedText));
        return textLength < maxLength;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (!allowedTags.includes(tag)) return true;

        const clone = document.createElement(tag);
        Array.from(el.attributes).forEach(attr => clone.setAttribute(attr.name, attr.value));

        container.appendChild(clone);

        for (const child of Array.from(el.childNodes)) {
          if (!walk(child, clone)) break;
        }
      }

      return true;
    };

    walk(temp, resultFragment);

    const wrapper = document.createElement('div');
    wrapper.appendChild(resultFragment);
    return wrapper.innerHTML + (textLength >= maxLength ? '...' : '');
  };

  const getItemContent = (item: Snippet, maxLength: number = 80): string => {
    let content = '';

    if (isLinkCategory(item.category) || isTabGroupCategory(item.category)) {
      let urls: string[] = [];
      if (typeof item.value === 'string') {
        try {
          const parsed = JSON.parse(item.value);
          if (parsed && Array.isArray(parsed.urls)) {
            urls = parsed.urls;
          } else if (parsed && parsed.url) {
            urls = [parsed.url];
          } else {
            urls = [item.value];
          }
        } catch {
          urls = [item.value];
        }
      } else if (item.value && typeof item.value === 'object') {
        const val = item.value as any;
        urls = Array.isArray(val?.urls) ? val.urls : val?.url ? [val.url] : [];
      }

      if (urls.length > 0) {
        content = urls[0]; // Return first URL
        // If it's a tab group with multiple, maybe indicate?
        if (urls.length > 1 && isTabGroupCategory(item.category)) {
          // Provide a hint? The UI truncates, so "URL1..." is fine.
          // Or "URL1 + X more"
          content = `${urls[0]} (+${urls.length - 1})`;
        }
      }
    } else {
      let val = (item.value as string) || '';
      if (val === 'undefined' || !val) {
        content = '';
      } else {
        const truncated = truncateHtml(val, maxLength);
        content = DOMPurify.sanitize(truncated, {
          ALLOWED_TAGS: allowedTags,
          ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'style'],
          ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|data:image\/[^;]+;base64)[^<>]*)$/i,
        });
      }
    }

    return content;
  };

  const handleShowDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteItem = async () => {
    try {
      await deleteSnippet(folder?.folder_id, snippet.id);

      // Remove from localStorage favorites
      chrome.storage.local.get('myFavouriteItems', result => {
        const favItems = result.myFavouriteItems || {};
        const targetKey = userId || '';

        // Fork logic here too? Ideally yes, but usually delete comes after list is viewed.
        // If we are deleting a default item from a team view that hasn't been forked yet:
        let currentFavList = favItems[targetKey] || [];

        if (currentFavList) {
          const updatedFavList = currentFavList.filter((fav: Snippet) => fav.id !== snippet.id);
          favItems[targetKey] = updatedFavList;

          chrome.storage.local.set({ myFavouriteItems: favItems }, () => {
            setFavoritesMapping(favItems); // Update UI state
          });
        }
      });

      triggerToast('Deleted Successfully!', 'success');
      reload();
    } catch (error) {
      const serverErrorMessage =
        error instanceof Error ? (error as any)?.response?.data?.error || error?.message : 'Not recognised';

      triggerToast(serverErrorMessage, 'error');
    }
  };

  const handleClickItem = (snippet: Snippet) => {
    const action = resolveNodeAction(snippet);

    switch (action) {
      case 'open_multiple_links': {
        const parsed = parseTabGroup(snippet.value);
        if (parsed.urls && parsed.urls.length > 0) {
          openMultipleLinks(parsed.urls);
        }
        break;
      }
      case 'view_prompt': {
        dispatch(navigateToView({ kind: 'promptEditor' }));
        break;
      }
      case 'edit_link': {
        dispatch(navigateToView({ kind: 'linkEditor', linkProps: { editMode: true, snippet } }));
        break;
      }
      case 'view_note':
      default: {
        const breadcrumb = {
          workspace_id: workspace?.workspace_id || null,
          workspace_name: workspace?.workspace_name || null,
          folder_id: folder?.folder_id || null,
          folder_name: folder?.folder_name || null,
        };

        if (workspace) {
          dispatch(setSelectedWorkspace(workspace));
        }
        if (folder) {
          dispatch(setSelectedFolder(folder));
        }

        dispatch(navigateToView({ kind: 'noteEditor' }));
        dispatch(
          viewSnippet({
            snippet: snippet,
            breadcrumb: breadcrumb,
          }),
        );
        break;
      }
    }
  };

  const isFav = snippet?.id
    ? (favoritesMapping[userId] || []).some((favItem: Snippet) => favItem.id === snippet.id)
    : false;

  // Get favicon URL for links
  const getFaviconUrl = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch (error) {
      return null;
    }
  };

  const getItemSize = (item: Snippet): string => {
    let content = '';

    if (item.category === 'TabGroup') {
      const val = parseTabGroup(item.value);
      const joined = (val.urls || []).join('');
      content = joined;
    } else {
      content = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
    }

    const bytes = new TextEncoder().encode(content).length;

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    getItemIcon,
    getItemTypeLabel,
    toggleFavorite,
    getItemContent,
    handleCopyContent,
    handleShowDelete,
    handleDeleteItem,
    handleClickItem,
    isFav,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isShareDialogOpen,
    setIsShareDialogOpen,
    isPublicLinkDialogOpen,
    setIsPublicLinkDialogOpen,
    getFaviconUrl,
    getItemSize,
    openSingleLink,
    openMultipleLinks,
  };
};
