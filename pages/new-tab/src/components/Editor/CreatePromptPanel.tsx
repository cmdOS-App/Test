import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaFolder, FaTimes, FaStar, FaCheckCircle } from 'react-icons/fa';
import { FiStar, FiChevronLeft, FiChevronRight, FiTag } from 'react-icons/fi';


import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../../Redux/store';
import {
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectSnippetBreadCrum,
  selectSelectedSnippet,
  selectLastSavedLocation,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  setLastSavedLocation,
  queueNotification,
  setSelectedTeam,
} from '../../../../Redux/AllData/uiStateSlice';
import { optimisticAddSnippet, optimisticUpdateSnippet, selectAllData } from '../../../../Redux/AllData/allDataSlice';
import useToast from '../Shared/Toast/useToast';
import { updateSnippetRealtime, getOrgTags } from '../../../../Apis/features/snippetApi';
import SaveDestinationPicker from './SaveDestinationPicker';
import UnsavedChangesDialog from '../Modals/UnsavedChangesDialog';
import type { Workspace, Folder, Tag } from '../../../../modals/interfaces';

import { formatSaveDestinationPath } from '../../utils/pathUtils';
import { addFavorite, deleteFavorite } from '../../../../Apis/services/favoritesApi';
import { updateSnippetShortcut, updateSnippetHotkey } from '../../../../Apis/features/snippetApi';
import {
  readAllHotkeys,
  readAllShortcuts,
  getItemCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { updateLocalHotkey, updateLocalShortcut } from '../../../../utils/shortcutHotkeyUtils';
import HotkeyAssignButton from './HotkeyAssignButton';
import { selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import { useHotkeyOverwrite } from '../../hooks/useHotkeyOverwrite';
import { getUserId } from '../../../../Apis/core/api';


const generalTags: Tag[] = [
  { tag_id: '', name: 'Important' },
  { tag_id: '', name: 'Work' },
  { tag_id: '', name: 'Urgent' },
  { tag_id: '', name: 'Personal' },
];

interface CreatePromptPanelProps {
  onClose: () => void;
}

/**
 * CreatePromptPanel - A simplified note editor for prompts.
 * Similar UI to CreateNotePanel but without dynamic variable support (no // or @ triggers).
 * Uses category 'prompt' instead of 'snippet'.
 */
const CreatePromptPanel: React.FC<CreatePromptPanelProps> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const triggerToast = useToast();

  const allTeams = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const snippetBreadCrum = useSelector(selectSnippetBreadCrum);
  const selectedSnippet = useSelector(selectSelectedSnippet);
  const lastSavedLocation = useSelector(selectLastSavedLocation);
  const isMac = useSelector(selectIsMac);

  // Get personal workspaces
  // Get personal workspaces
  const personalWorkspaces = useMemo(() => {
    if (!allTeams) return [];
    // Use is_personal_space flag matching New Tab implementation, with name fallback
    const privateTeam = allTeams.find(team => team.is_personal_space === true || team.team_name === 'Personal Space');
    return privateTeam?.workspaces || [];
  }, [allTeams]);

  // Determine Organization Team
  const orgTeam = useMemo(() => {
    if (selectedTeam && selectedTeam.is_personal_space !== true) {
      return selectedTeam;
    }
    return allTeams?.find(t => t.is_personal_space !== true) || null;
  }, [selectedTeam, allTeams]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [snippetId, setSnippetId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const favButtonRef = useRef<HTMLButtonElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const saveResetTimeoutRef = useRef<number | null>(null);

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isAltEnterPickerOpen, setIsAltEnterPickerOpen] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Auto save State
  const [autoSaveEnabled] = useState(true);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [orgTags, setOrgTags] = useState<Tag[]>([]);

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setTagPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch org tags
  useEffect(() => {
    (async () => {
      if (!orgTeam?.team_id && !selectedTeam?.team_id) return;
      try {
        const teamIdToUse = orgTeam?.team_id || selectedTeam?.team_id || '';
        const fetchedTags = await getOrgTags(teamIdToUse);
        if (fetchedTags && fetchedTags.length > 0) {
          setOrgTags(fetchedTags);
        } else {
          setOrgTags(generalTags); // fallback
        }
      } catch (err) {
        console.error('Error fetching tags:', err);
        setOrgTags(generalTags); // fallback on error
      }
    })();
  }, [orgTeam, selectedTeam]);

  const handleTagIconClick = () => {
    setTagPopupOpen(!tagPopupOpen);
  };

  const handleTagSelect = (tag: Tag | null) => {
    setSelectedTag(tag);
  };

  const isCreatingRef = useRef(true);
  const lastSavedContentRef = useRef({ title: '', content: '' });
  const justSavedRef = useRef(false);

  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const [isFav, setIsFav] = useState(false);
  const [favoritesMapping, setFavoritesMapping] = useState<{ [teamId: string]: any[] }>({});
  const [userId, setUserId] = useState('');

  const isDuplicateTitle = useMemo(() => {
    const trimmedTitle = title.trim().toLowerCase();
    if (!trimmedTitle || !allTeams) return false;

    for (const team of allTeams) {
      for (const ws of team.workspaces || []) {
        for (const snip of ws.workspace_snippets || []) {
          const snipId = snip.id || snip.snippet_id;
          if (snipId === snippetId) continue;
          if (snip.key?.trim().toLowerCase() === trimmedTitle) {
            return true;
          }
        }
        for (const folder of ws.folders || []) {
          const findInFolder = (f: Folder): boolean => {
            for (const snip of f.snippets || []) {
              const snipId = snip.id || snip.snippet_id;
              if (snipId === snippetId) continue;
              if (snip.key?.trim().toLowerCase() === trimmedTitle) {
                return true;
              }
            }
            for (const sub of f.folders || []) {
              if (findInFolder(sub)) return true;
            }
            return false;
          };
          if (findInFolder(folder)) return true;
        }
      }
    }
    return false;
  }, [title, allTeams, snippetId]);

  useEffect(() => {
    const initUser = async () => {
      const uid = await getUserId();
      setUserId(uid);
      chrome.storage.local.get('myFavouriteItems', result => {
        if (result.myFavouriteItems) {
          setFavoritesMapping(result.myFavouriteItems);
        }
      });
    };
    initUser();
  }, []);

  useEffect(() => {
    if (userId && snippetId && favoritesMapping[userId]) {
      const isFavorited = favoritesMapping[userId].some((fav: any) => fav.id === snippetId);
      if (justSavedRef.current) {
        if (isFav && !isFavorited) {
          return;
        }
        justSavedRef.current = false;
      }
      setIsFav(isFavorited);
    } else {
      setIsFav(false);
    }
  }, [userId, snippetId, favoritesMapping]);

  const handleToggleFavorite = async () => {
    const isTitleEmpty = title.trim().length === 0;
    const isContentEmpty = content.trim().length === 0;
    if (isTitleEmpty || isContentEmpty) {
      triggerToast('Please enter a title and description before adding to favorites.', 'warning');
      return;
    }

    const teamIdToUse = orgTeam?.team_id || selectedTeam?.team_id;
    if (!teamIdToUse || !userId) return;

    if (!snippetId) {
      setIsFav(!isFav);
      return;
    }

    try {
      const currentFavList = favoritesMapping[userId] || [];
      const existingFavIndex = currentFavList.findIndex((fav: any) => fav.id === snippetId);
      const isAlreadyFav = existingFavIndex !== -1;

      const updatedFavList = isAlreadyFav
        ? currentFavList.filter((fav: any) => fav.id !== snippetId)
        : [{ id: snippetId, key: title, value: content, category: 'prompt', tags: [] }, ...currentFavList];

      const updatedMapping = { ...favoritesMapping, [userId]: updatedFavList };
      setFavoritesMapping(updatedMapping);
      setIsFav(!isAlreadyFav);

      await new Promise<void>(resolve => chrome.storage.local.set({ myFavouriteItems: updatedMapping }, resolve));

      if (isAlreadyFav) {
        const existingItem = currentFavList[existingFavIndex];
        if (existingItem.favourite_id) {
          await deleteFavorite(userId, existingItem.favourite_id);
        }
      } else {
        const response = await addFavorite(userId, { id: snippetId }, 'snippet');
        if (response?.favourite_id) {
          const syncedList = updatedFavList.map((f: any) =>
            f.id === snippetId ? { ...f, favourite_id: response.favourite_id } : f,
          );
          const syncedMapping = { ...updatedMapping, [userId]: syncedList };
          setFavoritesMapping(syncedMapping);
          await new Promise<void>(resolve => chrome.storage.local.set({ myFavouriteItems: syncedMapping }, resolve));
        }
      }
      triggerToast(isAlreadyFav ? 'Removed from Favorites' : 'Added to Favorites', 'success');
    } catch (error: any) {
      triggerToast(error.message || 'Something went wrong', 'error');
    }
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    setPendingHotkey(newHotkey);
    if (snippetId) {
      try {
        await updateSnippetHotkey(snippetId, newHotkey);
        const targetWorkspaceId = snippetBreadCrum?.workspace_id || selectedWorkspace?.workspace_id || '';
        const folderIdForSave = snippetBreadCrum?.folder_id || selectedFolder?.folder_id || '';
        const compoundId =
          folderIdForSave || targetWorkspaceId ? `${folderIdForSave || targetWorkspaceId}-${snippetId}` : snippetId;
        await updateLocalHotkey(compoundId, newHotkey, 'prompt');
        triggerToast('Hotkey updated', 'success');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        triggerToast('Failed to update hotkey', 'error');
      }
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    setPendingShortcut(newShortcut);
    if (snippetId) {
      try {
        await updateSnippetShortcut(snippetId, newShortcut);
        const targetWorkspaceId = snippetBreadCrum?.workspace_id || selectedWorkspace?.workspace_id || '';
        const folderIdForSave = snippetBreadCrum?.folder_id || selectedFolder?.folder_id || '';
        const compoundId =
          folderIdForSave || targetWorkspaceId ? `${folderIdForSave || targetWorkspaceId}-${snippetId}` : snippetId;
        await updateLocalShortcut(compoundId, snippetId, newShortcut, trimmedTitle || 'Untitled Prompt', 'prompt');
        triggerToast('Shortcut updated', 'success');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        triggerToast('Failed to update shortcut', 'error');
      }
    }
  };

  const { clearConflictHotkey, clearConflictShortcut } = useHotkeyOverwrite();

  const handleOverwriteHotkey = async (conflictId: string, newValue: string) => {
    setSaveStatus('saving');
    try {
      await clearConflictHotkey(conflictId);
      await handleHotkeyChange(newValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      triggerToast('Overwrite failed', 'error');
    } finally {
      setSaveStatus('idle');
    }
  };

  const handleOverwriteShortcut = async (conflictId: string, newValue: string) => {
    setSaveStatus('saving');
    try {
      await clearConflictShortcut(conflictId);
      await handleShortcutChange(newValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      triggerToast('Overwrite failed', 'error');
    } finally {
      setSaveStatus('idle');
    }
  };

  // Helper to get default save location
  const getDefaultSaveLocation = useCallback(() => {
    if (lastSavedLocation) {
      return lastSavedLocation;
    }
    const workspaces = selectedTeam?.workspaces || [];
    if (workspaces.length > 0) {
      const firstWorkspace = workspaces[0];
      const folders = firstWorkspace.folders || [];
      if (folders.length > 0) {
        const firstFolder = folders[0];
        return {
          workspace_id: firstWorkspace.workspace_id,
          workspace_name: firstWorkspace.workspace_name,
          folder_id: firstFolder.folder_id,
          folder_name: firstFolder.folder_name,
        };
      }
      return {
        workspace_id: firstWorkspace.workspace_id,
        workspace_name: firstWorkspace.workspace_name,
        folder_id: null,
        folder_name: null,
      };
    }
    return null;
  }, [lastSavedLocation, selectedTeam?.workspaces]);

  // Focus title input on mount
  useEffect(() => {
    const focusTimeout = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(focusTimeout);
  }, []);

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();

  // targetWorkspaceId and folderIdForSave
  const targetWorkspaceId = useMemo(() => {
    if (snippetBreadCrum?.workspace_id) return snippetBreadCrum.workspace_id;
    if (selectedWorkspace?.workspace_id) return selectedWorkspace.workspace_id;
    const defaultLoc = getDefaultSaveLocation();
    return defaultLoc?.workspace_id || '';
  }, [snippetBreadCrum, selectedWorkspace, getDefaultSaveLocation]);

  const folderIdForSave = useMemo(() => {
    if (snippetBreadCrum?.folder_id) return snippetBreadCrum.folder_id;
    if (selectedFolder?.folder_id) return selectedFolder.folder_id;
    const defaultLoc = getDefaultSaveLocation();
    return defaultLoc?.folder_id || null;
  }, [snippetBreadCrum, selectedFolder, getDefaultSaveLocation]);

  const teamId = selectedTeam?.team_id || '';

  // Target name for display
  const targetName = useMemo(() => {
    if (snippetBreadCrum?.folder_name) return snippetBreadCrum.folder_name;
    if (snippetBreadCrum?.workspace_name) return snippetBreadCrum.workspace_name;
    if (selectedFolder?.folder_name) return selectedFolder.folder_name;
    if (selectedWorkspace?.workspace_name) return selectedWorkspace.workspace_name;
    const defaultLoc = getDefaultSaveLocation();
    return defaultLoc?.folder_name || defaultLoc?.workspace_name || '';
  }, [snippetBreadCrum, selectedFolder, selectedWorkspace, getDefaultSaveLocation]);

  const needsDestinationSelection = !targetWorkspaceId;
  const hasDestination = Boolean(targetWorkspaceId); // Fix ReferenceError
  const isSaveDisabled = isSaving || (!trimmedTitle && !trimmedContent);
  const saveLabel = needsDestinationSelection ? 'Select Destination' : isSaving ? 'Saving...' : 'Save';

  // Destination handlers
  const handleWorkspaceDestination = useCallback(
    (ws: Workspace, isPersonal?: boolean) => {
      dispatch(setSelectedWorkspace(ws));
      dispatch(setSelectedFolder(null));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: ws.workspace_id,
          workspace_name: ws.workspace_name,
          folder_id: null,
          folder_name: null,
        }),
      );
      setIsLocationPickerOpen(false);
      setIsAltEnterPickerOpen(false);
    },
    [dispatch, allTeams, orgTeam],
  );

  const handleFolderDestination = useCallback(
    (ws: Workspace, folder: Folder, isPersonal?: boolean) => {
      dispatch(setSelectedWorkspace(ws));
      dispatch(setSelectedFolder(folder));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: ws.workspace_id,
          workspace_name: ws.workspace_name,
          folder_id: folder.folder_id,
          folder_name: folder.folder_name,
        }),
      );
      setIsLocationPickerOpen(false);
      setIsAltEnterPickerOpen(false);
    },
    [dispatch],
  );

  const handleAltEnterWorkspaceSelect = useCallback(
    (ws: Workspace, isPersonal?: boolean) => {
      handleWorkspaceDestination(ws, isPersonal);
      setIsAltEnterPickerOpen(false);
    },
    [handleWorkspaceDestination],
  );

  const handleAltEnterFolderSelect = useCallback(
    (ws: Workspace, folder: Folder, isPersonal?: boolean) => {
      handleFolderDestination(ws, folder, isPersonal);
      setIsAltEnterPickerOpen(false);
    },
    [handleFolderDestination],
  );

  // Save handler
  const handleSave = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent || false;
      if (isSaving) return;
      if (!trimmedTitle && !trimmedContent) {
        if (!silent) triggerToast('Please add a title or content', 'error');
        return;
      }
      if (!targetWorkspaceId) {
        if (!silent) triggerToast('Please select a destination', 'error');
        return;
      }

      setIsSaving(true);
      setSaveStatus('saving');
      if (isLocationPickerOpen) setIsLocationPickerOpen(false);

      try {
        const nowIso = new Date().toISOString();
        const isExistingSnippet = Boolean(snippetId);
        let tagToUse = selectedTag;
        let updatedSearchTags: Record<string, string[]> = {};
        if (tagToUse && tagToUse.name) {
          updatedSearchTags[userId] = [tagToUse.name];
        }

        const requestData: Record<string, any> = {
          key: trimmedTitle || 'Untitled Prompt',
          value: content,
          category: 'prompt', // Use 'prompt' category
          searchtags: updatedSearchTags,
        };
        if (pendingHotkey) {
          requestData.hotkey = pendingHotkey;
        }

        if (isExistingSnippet) {
          requestData.snippet_id = snippetId;
        }

        if (!isExistingSnippet) {
          if (folderIdForSave) {
            requestData.folder_id = folderIdForSave;
          } else {
            requestData.workspace_id = targetWorkspaceId;
          }
        }

        const response = await updateSnippetRealtime(requestData, selectedTeam?.storageMode ?? 'cloud');
        const responseSnippet = response?.snippet;
        const resolvedSnippetId = responseSnippet?.snippet_id || snippetId || `temp-${Date.now()}`;

        setSnippetId(resolvedSnippetId);
        justSavedRef.current = true;

        // Update last saved content for autosave tracking
        lastSavedContentRef.current = {
          title: trimmedTitle || 'Untitled Prompt',
          content: content,
        };

        // Sync favorite if needed for new item
        if (isFav && resolvedSnippetId) {
          try {
            const favResponse = await addFavorite(userId, { id: resolvedSnippetId }, 'snippet');
            if (favResponse?.favourite_id) {
              chrome.storage.local.get('myFavouriteItems', result => {
                const favItems = result.myFavouriteItems || {};
                const userFavList: any[] = favItems[userId] || [];
                const updatedList = userFavList.map((f: any) =>
                  f.id === resolvedSnippetId ? { ...f, favourite_id: favResponse.favourite_id } : f,
                );
                if (!updatedList.some(f => f.id === resolvedSnippetId)) {
                  updatedList.push({
                    id: resolvedSnippetId,
                    key: trimmedTitle || 'Untitled Prompt',
                    value: content,
                    category: 'prompt',
                    favourite_id: favResponse.favourite_id,
                  });
                }
                const updatedMapping = { ...favItems, [userId]: updatedList };
                chrome.storage.local.set({ myFavouriteItems: updatedMapping }, () => {
                  setFavoritesMapping(updatedMapping);
                });
              });
            }
          } catch (e) {
            console.error('Failed to sync pending favorite:', e);
          }
        }

        // Update local hotkey storage if we have a hotkey
        if (pendingHotkey && resolvedSnippetId) {
          const compoundId =
            folderIdForSave || targetWorkspaceId
              ? `${folderIdForSave || targetWorkspaceId}-${resolvedSnippetId}`
              : resolvedSnippetId;
          updateLocalHotkey(compoundId, pendingHotkey, 'prompt').catch(e => console.error(e));
        }

        // Sync shortcut if needed
        if (pendingShortcut && resolvedSnippetId) {
          try {
            await updateSnippetShortcut(resolvedSnippetId, pendingShortcut);
            const compoundId =
              folderIdForSave || targetWorkspaceId
                ? `${folderIdForSave || targetWorkspaceId}-${resolvedSnippetId}`
                : resolvedSnippetId;
            await updateLocalShortcut(
              compoundId,
              resolvedSnippetId,
              pendingShortcut,
              trimmedTitle || 'Untitled Prompt',
              'prompt',
            );
          } catch (e) {
            console.error('Failed to sync pending shortcut:', e);
          }
        }

        const snippetTags = Array.isArray(responseSnippet?.snippet_tags)
          ? responseSnippet?.snippet_tags
          : Array.isArray(responseSnippet?.tags)
            ? responseSnippet?.tags
            : [];

        const snippetPayload = {
          id: resolvedSnippetId,
          key: trimmedTitle || 'Untitled Prompt',
          value: content,
          category: 'prompt',
          tags: selectedTag ? [selectedTag] : [],
          user_id: responseSnippet?.user_id || '',
          first_name: responseSnippet?.first_name || '',
          last_name: responseSnippet?.last_name ?? null,
          created_at: responseSnippet?.created_at || nowIso,
          updated_at: responseSnippet?.updated_at || nowIso,
        };

        const isNewSnippet = !snippetId || response?.isNew;

        const fullSnippetPayload = {
          ...snippetPayload,
          snippet_id: resolvedSnippetId,
        };

        if (isNewSnippet) {
          // Resolve correct teamId for the workspace
          let targetTeamId = teamId;
          if (allTeams && targetWorkspaceId) {
            const foundTeam = allTeams.find(t => (t.workspaces || []).some(w => w.workspace_id === targetWorkspaceId));
            if (foundTeam) targetTeamId = foundTeam.team_id;
          }

          dispatch(
            optimisticAddSnippet({
              teamId: targetTeamId,
              workspaceId: targetWorkspaceId,
              folderId: folderIdForSave ?? undefined,
              snippet: snippetPayload,
            }),
          );
        } else {
          // Resolve correct teamId (same logic)
          let targetTeamId = teamId;
          if (allTeams && targetWorkspaceId) {
            const foundTeam = allTeams.find(t => (t.workspaces || []).some(w => w.workspace_id === targetWorkspaceId));
            if (foundTeam) targetTeamId = foundTeam.team_id;
          }

          dispatch(
            optimisticUpdateSnippet({
              teamId: targetTeamId,
              workspaceId: targetWorkspaceId,
              folderId: folderIdForSave ?? undefined,
              snippet: snippetPayload,
            }),
          );
        }

        dispatch(setSelectedSnippet(fullSnippetPayload as any));

        if (isNewSnippet) {
          dispatch(
            setLastSavedLocation({
              workspace_id: targetWorkspaceId,
              workspace_name: snippetBreadCrum?.workspace_name || selectedWorkspace?.workspace_name || '',
              folder_id: folderIdForSave || null,
              folder_name: snippetBreadCrum?.folder_name || selectedFolder?.folder_name || null,
            }),
          );
        }

        setSaveStatus('success');

        if (!silent) {
          dispatch(
            queueNotification({
              message: 'Saved prompt',
              type: 'success',
            }),
          );
          setTimeout(() => onClose(), 500);
        }
      } catch (error: any) {
        const serverErrorMessage = error?.response?.data?.error || error?.message || 'Failed to save prompt';
        triggerToast(serverErrorMessage, 'error');
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
        if (saveResetTimeoutRef.current) {
          window.clearTimeout(saveResetTimeoutRef.current);
        }
        saveResetTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus('idle');
          saveResetTimeoutRef.current = null;
        }, 2500);
      }
    },
    [
      content,
      dispatch,
      folderIdForSave,
      isSaving,
      isLocationPickerOpen,
      onClose,
      snippetId,
      targetName,
      targetWorkspaceId,
      teamId,
      triggerToast,
      trimmedTitle,
      trimmedContent,
      snippetBreadCrum,
      selectedWorkspace,
      selectedFolder,
      allTeams,
    ],
  );

  // Autosave logic - debounced save for editing mode
  const debounceSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (!trimmedTitle || !trimmedContent) return;

    // Check if content actually changed
    const hasChanged =
      (lastSavedContentRef.current.title || '').trim() !== trimmedTitle ||
      lastSavedContentRef.current.content !== content;

    if (!hasChanged) return;

    const isLocalMode = selectedTeam?.storageMode === 'local';
    const debounceDelay = isLocalMode ? 300 : 2000;

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (autoSaveEnabled) {
        handleSave({ silent: true });
      }
    }, debounceDelay);
  }, [autoSaveEnabled, handleSave, snippetId, trimmedTitle, content, selectedTeam]);

  // Watch for content changes and trigger autosave
  useEffect(() => {
    if (autoSaveEnabled) {
      debounceSave();
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content, autoSaveEnabled, debounceSave]);

  // Keyboard shortcuts - must be after handleSave is defined
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter to save
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSave();
      }
      // Alt+Enter to open folder picker
      if (event.altKey && event.key === 'Enter') {
        event.preventDefault();
        setIsAltEnterPickerOpen(prev => !prev);
      }
      // Escape to close
      if (event.key === 'Escape') {
        if (document.getElementById('hotkey-assignment-popup')) return;
        event.preventDefault();

        // First close any open pickers or dialogs
        if (showUnsavedWarning) {
          setShowUnsavedWarning(false);
          return;
        }
        if (isAltEnterPickerOpen) {
          setIsAltEnterPickerOpen(false);
          return;
        }
        if (isLocationPickerOpen) {
          setIsLocationPickerOpen(false);
          return;
        }

        // Check if there are unsaved changes
        const hasUnsavedChanges =
          (lastSavedContentRef.current.title || '').trim() !== trimmedTitle ||
          content !== lastSavedContentRef.current.content;

        if (hasUnsavedChanges && (trimmedTitle || trimmedContent)) {
          // Show warning (User request: "no i want theseee")
          setShowUnsavedWarning(true);
          return;
        }

        // Close logic
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClose,
    handleSave,
    isAltEnterPickerOpen,
    isLocationPickerOpen,
    showUnsavedWarning,
    trimmedTitle,
    trimmedContent,
    content,
  ]);

  // Load existing snippet data if editing (Moved here to access handleSave)
  useEffect(() => {
    if (selectedSnippet && selectedSnippet.category === 'prompt') {
      const targetId = selectedSnippet.id || selectedSnippet.snippet_id;

      // Fix: If we are already editing this snippet, ignore Redux updates
      // This prevents the autosave loop where saving updates Redux -> updates this effect -> resets state -> triggers autosave
      if (snippetId && targetId === snippetId) {
        return;
      }

      // Auto-save previous prompt if dirty
      if (snippetId && autoSaveEnabled) {
        const hasUnsavedChanges =
          (lastSavedContentRef.current.title || '').trim() !== trimmedTitle ||
          lastSavedContentRef.current.content !== content;

        if (hasUnsavedChanges) {
          handleSave({ silent: true });
        }
      }

      
      const initialTags = (selectedSnippet as any).snippet_tags || selectedSnippet.tags || [];
      if (initialTags.length > 0 && typeof initialTags[0] === 'object') {
        setSelectedTag(initialTags[0] as Tag);
      } else if (selectedSnippet.searchtags) {
        const rawTags = selectedSnippet.searchtags;
        let firstTag = '';
        if (typeof rawTags === 'object' && rawTags !== null) {
          const myTags = (rawTags as Record<string, string[]>)[userId] || [];
          if (myTags.length > 0) firstTag = myTags[0];
        } else if (typeof rawTags === 'string') {
          firstTag = rawTags.split(',')[0].trim();
        }
        if (firstTag) {
          setSelectedTag({ tag_id: '', name: firstTag });
        } else {
          setSelectedTag(null);
        }
      } else {
        setSelectedTag(null);
      }

      setTitle(selectedSnippet.key || '');
      const value = selectedSnippet.value;
      if (typeof value === 'string') {
        setContent(value);
      }
      setSnippetId(selectedSnippet.id || selectedSnippet.snippet_id || null);

      // Update last saved content ref
      lastSavedContentRef.current = {
        title: selectedSnippet.key || '',
        content: typeof value === 'string' ? value : '',
      };

      // Allow autosave after data loads
      isCreatingRef.current = false;
    }
  }, [selectedSnippet]); // Note: handleSave dependency omitted to avoid loops? It should be fine.

  // Browser-level warning for unsaved changes (e.g., closing tab/window)
  // Restored based on user request ("no i want theseee")
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsavedChanges =
        lastSavedContentRef.current.title !== trimmedTitle || lastSavedContentRef.current.content !== content.trim();

      if (hasUnsavedChanges && (trimmedTitle || trimmedContent)) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [trimmedTitle, content, trimmedContent]);

  return (
    <div
      ref={panelRef}
      className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent px-6 md:px-12 lg:px-24 py-6 md:py-10`}>
      <div
        className={`w-full max-w-[1300px] mx-auto flex-1 flex flex-col relative rounded-xl ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} bg-[var(--color-editorBg)] border border-black/5 dark:border-white/10`}
      >
        <div
          className={`flex-1 min-h-0 flex ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} flex-col gap-3 bg-transparent text-neutral-900 dark:text-white`}>

          {/* Main Area */}
          <div className="flex-1 flex min-h-0 relative">

            {/* Wrapper for Title + Content */}
            <div className="flex-1 flex flex-col min-h-0 relative">

              {/* Absolute Close Button */}
              <div className="absolute top-4 right-4 md:top-5 md:right-5 z-50 flex items-center gap-3">
                {isDuplicateTitle && (
                  <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                    Duplicate title exists
                  </span>
                )}
                {/* Auto-save indicator */}
                <div className="transition-opacity duration-300">
                  {(() => {
                    const hasUnsavedChanges =
                      (lastSavedContentRef.current.title || '').trim() !== trimmedTitle ||
                      lastSavedContentRef.current.content !== content;
                    const isActuallySaving = saveStatus === 'saving';
                    const hasBothFields = Boolean(trimmedTitle && trimmedContent);
                    const showSaving = hasBothFields && (isActuallySaving || hasUnsavedChanges);
                    const isSuccess = hasBothFields && saveStatus === 'success' && !hasUnsavedChanges;
                    return (
                      <>
                        {showSaving && (
                          <span className={`text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap ${!isActuallySaving ? 'opacity-70' : ''}`}>
                            Saving...
                          </span>
                        )}
                        {isSuccess && (
                          <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                            Auto-saved <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>

                <button
                  onClick={onClose}
                  className="p-2 opacity-50 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all focus:outline-none focus:ring-1 focus:ring-red-400"
                  title="Close (Esc)">
                  <FaTimes size={16} />
                </button>
              </div>

              <div className="w-full flex-1 flex flex-col min-h-0 px-6 md:px-12 py-6">
                {/* Title Input Row */}
                <div className="flex items-center gap-2 flex-shrink-0 relative z-10 py-4">
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <input
                      ref={titleInputRef}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          contentTextareaRef.current?.focus();
                        }
                      }}
                      placeholder="Prompt Title"
                      className="w-full text-[28px] font-semibold text-black dark:text-white placeholder-neutral-400/70 dark:placeholder-neutral-600/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0"
                    />
                  </div>

                  <div className="flex-1" />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-neutral-900 dark:text-white pb-3">
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    <textarea
                      ref={contentTextareaRef}
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp' && contentTextareaRef.current) {
                          const textarea = contentTextareaRef.current;
                          if (textarea.selectionStart === 0) {
                            e.preventDefault();
                            titleInputRef.current?.focus();
                          }
                        }
                      }}
                      placeholder="Write your prompt logic here..."
                      className="w-full h-full resize-none bg-transparent border-none outline-none text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 text-base leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Divider Line with Floating Collapse Toggle Button */}
            <div className="relative flex-shrink-0 w-px bg-black/10 dark:bg-white/10">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 w-8 h-8 rounded-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/15 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm focus:outline-none"
                style={{ left: '50%' }}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
              </button>
            </div>

            {/* RIGHT COLUMN - Prompt Options */}
            <div
              className={`flex-shrink-0 flex flex-col bg-[var(--color-editorBg)] overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[280px] border-l border-black/10 dark:border-white/20'}`}
              style={{
                width: isSidebarCollapsed ? '0px' : '280px',
                minWidth: isSidebarCollapsed ? '0px' : '280px',
              }}
            >
              {!isSidebarCollapsed && (
                <div className="flex-1 px-4 py-6 flex flex-col gap-6">
                  {/* Prompt Options Section */}
                  <div className="space-y-3">
                    <div className="bg-[var(--color-editorBg)] border border-black/5 dark:border-white/20 rounded-2xl p-2 flex flex-col gap-0.5">
                      <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1 pb-2 pt-1 flex items-center">
                        <span>Prompt Options</span>
                      </h3>

                      {/* Folder Picker */}
                      <div className="relative">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setIsLocationPickerOpen(prev => !prev); }}
                          disabled={isSaving}
                          className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 min-w-0 flex-1 pr-2">
                            <FaFolder className="text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                            <span className="truncate" title={snippetBreadCrum?.folder_name || snippetBreadCrum?.workspace_name || 'Folders'}>
                              {snippetBreadCrum?.folder_name || snippetBreadCrum?.workspace_name || 'Folders'}
                            </span>
                          </div>
                          <span className="text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1.2em" width="1.2em"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>
                          </span>
                        </button>
                        {isLocationPickerOpen && (
                          <div className="absolute left-0 right-0 top-full mt-2 z-[60] w-auto">
                            <SaveDestinationPicker
                              team={orgTeam}
                              personalWorkspaces={personalWorkspaces}
                              currentSelection={{
                                workspaceId: snippetBreadCrum?.workspace_id,
                                folderId: snippetBreadCrum?.folder_id ?? null,
                              }}
                              onSelectWorkspace={handleWorkspaceDestination}
                              onSelectFolder={handleFolderDestination}
                              onClose={() => setIsLocationPickerOpen(false)}
                            />
                          </div>
                        )}
                      </div>

                      
                      {/* Tags */}
                      <div className="relative" ref={popupRef}>
                        <button
                          type="button"
                          onClick={handleTagIconClick}
                          className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            <FiTag className="text-neutral-400 dark:text-neutral-500 h-4 w-4" />
                            <span>Tags</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {selectedTag && (
                              <span className="text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded-full max-w-[80px] truncate">
                                {selectedTag.name}
                              </span>
                            )}
                            <span className="text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity">
                              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1.2em" width="1.2em"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>
                            </span>
                          </div>
                        </button>

                        {tagPopupOpen && (
                          <div className="absolute right-0 top-full mt-2 w-[240px] bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-xl p-3 shadow-xl z-50 flex flex-col gap-2">
                            <div className="text-xs font-semibold text-neutral-400 mb-1 px-1">Select Tag</div>
                            <div className="max-h-[160px] overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                              {orgTags.map((tag, idx) => (
                                <button
                                  key={tag.tag_id || idx}
                                  type="button"
                                  onClick={() => {
                                    handleTagSelect((selectedTag?.name === tag.name ? null : tag) as any);
                                  }}
                                  className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${selectedTag?.name === tag.name ? 'bg-black/5 dark:bg-white/10 text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                                >
                                  <span>{tag.name}</span>
                                  {selectedTag?.name === tag.name && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-black/10 dark:border-white/10 pt-2 mt-1">
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (!newTagName.trim()) return;
                                  const trimmed = newTagName.trim();
                                  const existing = orgTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                                  if (existing) {
                                    handleTagSelect(existing);
                                  } else {
                                    const newTag = { tag_id: '', name: trimmed };
                                    setOrgTags(prev => [...prev, newTag]);
                                    handleTagSelect(newTag);
                                  }
                                  setNewTagName('');
                                }}
                                className="flex gap-1"
                              >
                                <input
                                  type="text"
                                  placeholder="New tag..."
                                  value={newTagName}
                                  onChange={e => setNewTagName(e.target.value)}
                                  className="flex-1 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-black/20 dark:focus:border-white/20 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
                                />
                                <button
                                  type="submit"
                                  className="px-2 py-1 bg-black/5 dark:bg-[#2a2a2a] text-neutral-700 dark:text-white border border-black/10 dark:border-white/10 rounded-lg text-xs font-medium hover:bg-black/10 dark:hover:bg-[#3a3a3a]"
                                >
                                  Add
                                </button>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Favorite Toggle */}
                      <button
                        type="button"
                        ref={favButtonRef}
                        onClick={handleToggleFavorite}
                        className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                          <FiStar className="text-neutral-400 dark:text-neutral-500" />
                          <span>Favorite</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <FiStar className={`w-[18px] h-[18px] transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`} />
                        </div>
                      </button>

                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-50 mt-auto flex-shrink-0 border-t border-black/10 dark:border-white/10 bg-[var(--color-editorBg)] rounded-b-xl">
          <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
            {/* Left: Back Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const hasUnsavedChanges =
                    trimmedTitle !== lastSavedContentRef.current.title ||
                    content.trim() !== lastSavedContentRef.current.content;
                  if (hasUnsavedChanges && (trimmedTitle || trimmedContent)) {
                    setShowUnsavedWarning(true);
                    return;
                  }
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-white dark:bg-neutral-700 px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  Esc
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onSave={async () => {
          await handleSave();
        }}
        onDiscard={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        zIndex={100}
        source="prompt-editor"
      />
    </div>
  );
};

export default CreatePromptPanel;
