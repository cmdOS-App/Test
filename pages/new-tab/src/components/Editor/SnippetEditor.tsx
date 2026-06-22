import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import taskLabsLogo from '../../assets/tasklabs_logo.png';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaExpand,
  FaCompress,
  FaBolt,
  FaChevronRight,
  FaLayerGroup,
  FaFileAlt,
  FaFolder,
  FaTimes,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaCheckCircle,
} from 'react-icons/fa';
import { FiStar, FiTag, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { BsPinAngleFill, BsPinAngle } from 'react-icons/bs';
import { RxEnterFullScreen } from 'react-icons/rx';
import type {
  NewSnippetBreadCrum,
  Snippet,
  Tag,
  Workspace,
  WorkspaceDetails,
  Folder,
} from '../../../../modals/interfaces';
import {
  optimisticUpdateSnippet,
  optimisticAddSnippet,
  selectAllData,
  fetchAllDataThunk,
} from '../../../../Redux/AllData/allDataSlice';

type FooterStatus = { type: 'idle' | 'saving' | 'saved' | 'error'; message: string };

import {
  selectSelectedTeam,
  setIsCreatingNewItem,
  setSelectedSnippet,
  setSelectedWorkspace,
  setSnippetBreadCrum,
  setSelectedFolder,
  queueNotification,
  selectIsFocusMode,
  toggleFocusMode,
  selectIsMac,
  setSelectedTeam,
  selectIsLinkEditModalOpen,
} from '../../../../Redux/AllData/uiStateSlice';
import { getUserId } from '../../../../Apis/core/api';
import {
  updateSnippetShortcut,
  updateSnippetHotkey,
  getOrgTags,
  createTagInOrg,
  updateSnippetRealtime,
  deleteSnippet,
} from '../../../../Apis/features/snippetApi';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../Shared/utils/hotkeyUtils';
import { updateLocalHotkey, updateLocalShortcut } from '../../../../utils/shortcutHotkeyUtils';
import { addFavorite, deleteFavorite, getFavorites } from '../../../../Apis/services/favoritesApi';
import HotkeyAssignButton from './HotkeyAssignButton';
import useToast from '../Shared/Toast/useToast';

/**
 * Helper to convert an AST JSON string into readable plain text.
 */
function astToPlainText(astString: string): string {
  try {
    const ast = JSON.parse(astString);
    let result = '';
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.type === 'text') {
          result += node.value || node.text || '';
        } else if (node.type === 'field' || node.type === 'dropdown' || node.type === 'toggle') {
          const config = node.config || {};
          const alias = config.label || node.alias || node.id || 'Field';
          result += `{{${alias}}}`;
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    traverse(ast);
    return result;
  } catch (e) {
    // If it fails to parse, return the original string
    return astString;
  }
}

import DeleteConfirmation from '../Modals/DeleteDialog';
import UnsavedChangesDialog from '../Modals/UnsavedChangesDialog';

import { getWorkspaceDetails } from '../../../../Apis/features/workspaceApiServices';

import type { AppDispatch, RootState } from '../../../../Redux/store';
import { fetchWorkspacesThunk, selectWorkspacesByTeam } from '../../../../Redux/Workspaces/workspaceSlice';
import QuillEditor from './QuillEditor';
import { SnippetBuilderProvider, SnippetBuilderEditor, SnippetBuilderToolbar } from '../SnippetBuilder/index.js';
import SaveDestinationPicker from './SaveDestinationPicker';
import VariableDropdown from './VariableDropdown';
import { formatSaveDestinationPath, getDestinationPathDetails } from '../../utils/pathUtils';
/**
 * Fallback tags to display if the organization has no tags.
 */
const generalTags: Tag[] = [
  { tag_id: '', name: 'Important' },
  { tag_id: '', name: 'Work' },
  { tag_id: '', name: 'Urgent' },
  { tag_id: '', name: 'Personal' },
];

interface SnippetEditorProps {
  selectedTeamId: string;
  selectedSnippet: Snippet | null;
  isCreatingNew: boolean;
  snippetBreadCrum: NewSnippetBreadCrum | null;
  snippets?: Snippet[];
  showFolderStructure?: boolean;
  reload: () => void;
  favoritesMapping: { [teamId: string]: Snippet[] };
  setFavoritesMapping: (data: { [teamId: string]: Snippet[] }) => void;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  isFullScreenMode?: boolean; // True when rendered in FullScreenNoteView
  category?: string; // 'note' or 'snippet'
  onDirtyChange?: (isDirty: boolean) => void; // called when unsaved state changes
}

// Define the interface for workspace member
interface WorkspaceMember {
  user_id: string;
  workspace_id: string;
  email: string;
  first_name: string;
  last_name: string;
  image_url: string;
  role: string;
  credits_left: number;
}

const SnippetEditorComponent: React.FC<SnippetEditorProps> = ({
  selectedTeamId,
  snippetBreadCrum,
  selectedSnippet,
  isCreatingNew,
  reload,
  favoritesMapping,
  setFavoritesMapping,
  onBack,
  initialDraftKey = '',
  initialDraftContent = '',
  isFullScreenMode = false,
  category,
  onDirtyChange,
}) => {
  const isMac = useSelector(selectIsMac);
  const dispatch = useDispatch<AppDispatch>();

  // Get personal workspaces - using allTeams like SideBar does
  const allTeams = useSelector(selectAllData);

  // Find the Personal Space team using is_personal_space flag from API
  const defaultPrivateTeam = useMemo(() => {
    if (!allTeams) return null;
    return allTeams.find(team => team.is_personal_space === true || team.team_name === 'Personal Space');
  }, [allTeams]);

  const personalWorkspaces = useMemo(() => {
    return defaultPrivateTeam?.workspaces || [];
  }, [allTeams, defaultPrivateTeam]);

  // Prefetch teams data on mount to ensure Personal Space is available
  useEffect(() => {
    if (!allTeams) {
      
      dispatch(fetchAllDataThunk());
    }
  }, [allTeams, dispatch]);

  const triggerToast = useToast();

  // Get Redux state for optimistic updates
  const selectedTeam = useSelector(selectSelectedTeam);
  const teamId = selectedTeam?.team_id || '';

  // Determine Organization Team
  const orgTeam = useMemo(() => {
    if (selectedTeam && selectedTeam.is_personal_space !== true) {
      return selectedTeam;
    }
    return allTeams?.find(t => t.is_personal_space !== true) || null;
  }, [selectedTeam, allTeams]);
  const workspacesFromRedux = useSelector((state: RootState) => selectWorkspacesByTeam(state, teamId));
  const [noteKey, setNoteKey] = useState(initialDraftKey);
  const [noteContent, setNoteContent] = useState(initialDraftContent);
  const [userId, setUserId] = useState('');

  const [isVariableDropdownOpen, setIsVariableDropdownOpen] = useState(false);
  const [variableHighlightIndex, setVariableHighlightIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [isAtTriggered, setIsAtTriggered] = useState(false);
  const [varCounter, setVarCounter] = useState(1);
  const [showToolbar, setShowToolbar] = useState(true);
  const isUserKeyManuallySetRef = useRef(false);
  const justSavedRef = useRef(false); // Ref to track if we just saved successfully
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null); // Quill instance ref
  const quillToolbarRef = useRef<HTMLElement | null>(null);

  const isCreatingRef = useRef(false); // Track if a create request is in flight

  const pendingUpdateRef = useRef(false); // Track if changes occurred during creation
  const isFocusMode = useSelector(selectIsFocusMode);
  const isLinkEditModalOpen = useSelector(selectIsLinkEditModalOpen);

  // State for workspace access management
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceDetails, setWorkspaceDetails] = useState<WorkspaceDetails | null>(null);
  const [isLoadingWorkspaceDetails, setIsLoadingWorkspaceDetails] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTodoDialogOpen, setIsTodoDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(category !== 'snippet');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarBtnRef = useRef<HTMLButtonElement>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [footerStatus, setFooterStatus] = useState<FooterStatus>({ type: 'idle', message: '' });
  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const [isFav, setIsFav] = useState(false);
  const [searchtags, setSearchtags] = useState('');
  const rawSearchTagsRef = useRef<Record<string, string[]>>({});
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const tempFavoriteIdRef = useRef<string | null>(null);

  const isDuplicateTitle = useMemo(() => {
    const trimmedTitle = noteKey.trim().toLowerCase();
    if (!trimmedTitle || !allTeams) return false;

    for (const team of allTeams) {
      for (const ws of team.workspaces || []) {
        for (const snip of ws.workspace_snippets || []) {
          const snipId = snip.id || snip.snippet_id;
          if (snipId === activeSnippetId) continue;
          if (snip.key?.trim().toLowerCase() === trimmedTitle) {
            return true;
          }
        }
        for (const folder of ws.folders || []) {
          const findInFolder = (f: Folder): boolean => {
            for (const snip of f.snippets || []) {
              const snipId = snip.id || snip.snippet_id;
              if (snipId === activeSnippetId) continue;
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
  }, [noteKey, allTeams, activeSnippetId]);

  const showFooterStatus = (type: FooterStatus['type'], message: string) => {
    setFooterStatus({ type, message });
    if (type !== 'idle' && type !== 'saving') {
      setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  };

  useEffect(() => {
    if (isCreatingNew) {
      // If we have an initial draft key (from expand to full-screen),
      // treat it as manually set to prevent auto-generation
      isUserKeyManuallySetRef.current = !!initialDraftKey;
    }
  }, [isCreatingNew, initialDraftKey]);

  useEffect(() => {
    chrome.storage.local.get('user', result => {
      if (result.user?.id) {
        setUserId(result.user.id);
      }
    });
  }, []);

  // Ensure workspace metadata is fetched (for public/private type info)
  useEffect(() => {
    if (teamId && workspacesFromRedux.length === 0) {
      dispatch(fetchWorkspacesThunk(teamId));
    }
  }, [dispatch, teamId, workspacesFromRedux.length]);

  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!activeSnippetId) {
        setIsFav(false);
        setPendingHotkey('');
        setPendingShortcut('');
        tempFavoriteIdRef.current = null;
        return;
      }

      // 1. Sync Favorite status (MATCH SIDEBAR: use userId)
      if (userId) {
        chrome.storage.local.get('myFavouriteItems', result => {
          const favItems = result.myFavouriteItems || {};
          const currentFavList: Snippet[] = favItems[userId] || [];
          setIsFav(currentFavList.some(item => {
            const favId = item.id || (item as any).snippet_id;
            return String(favId) === String(activeSnippetId);
          }));
        });
      }

      // 2. Sync Hotkey and Shortcut from local storage maps (matching FavoriteItem logic)
      try {
        const [allHotkeys, allShortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
        const itemCtx = selectedSnippet
          ? {
            ...selectedSnippet,
            folder_id: (selectedSnippet as any).folder_id || snippetBreadCrum?.folder_id,
            workspace_id: (selectedSnippet as any).workspace_id || snippetBreadCrum?.workspace_id,
          }
          : {
            id: activeSnippetId || '',
            workspace_id: snippetBreadCrum?.workspace_id,
            folder_id: snippetBreadCrum?.folder_id,
          };
        const compoundId = getItemCompoundId(itemCtx);

        const currentHotkey = allHotkeys[compoundId] || '';
        const currentShortcut = allShortcuts[compoundId] || '';

        setPendingHotkey(currentHotkey);
        setPendingShortcut(currentShortcut.replace(/^\//, '')); // Standardize to no slash internally
      } catch (e) {
        console.error('[SnippetEditor] Failed to sync standardized maps:', e);
      }
    };

    syncData();
  }, [activeSnippetId, userId, selectedSnippet, snippetBreadCrum]);

  // Auto-select default destination for new snippets
  useEffect(() => {
    if (!isCreatingNew || snippetBreadCrum?.workspace_id) return;

    // Try to load last used destination from storage
    chrome.storage.local.get('lastNoteDestination', result => {
      const lastDest = result.lastNoteDestination;

      if (lastDest && allTeams) {
        // Find the workspace/folder in our data
        for (const team of allTeams) {
          const workspace = team.workspaces?.find(ws => ws.workspace_id === lastDest.workspace_id);
          if (workspace) {
            let folder: Folder | null = null;
            if (lastDest.folder_id) {
              // Find folder recursively
              const findFolder = (folders: Folder[]): Folder | null => {
                for (const f of folders || []) {
                  if (f.folder_id === lastDest.folder_id) return f;
                  const nested = findFolder(f.folders || []);
                  if (nested) return nested;
                }
                return null;
              };
              folder = findFolder(workspace.folders || []);
            }

            // Set the breadcrumb
            const newBreadCrum = {
              workspace_id: workspace.workspace_id,
              workspace_name: workspace.workspace_name,
              folder_id: folder?.folder_id || null,
              folder_name: folder?.folder_name || null,
            };

            dispatch(setSelectedWorkspace(workspace));
            dispatch(setSelectedFolder(folder));
            dispatch(setSnippetBreadCrum(newBreadCrum));
            return;
          }
        }
      }

      // Fallback: Select first workspace if no last destination
      if (selectedTeam && selectedTeam.workspaces && selectedTeam.workspaces.length > 0) {
        const defaultWorkspace = selectedTeam.workspaces[0];
        const newBreadCrum = {
          workspace_id: defaultWorkspace.workspace_id,
          workspace_name: defaultWorkspace.workspace_name,
          folder_id: null,
          folder_name: null,
        };
        dispatch(setSelectedWorkspace(defaultWorkspace));
        dispatch(setSelectedFolder(null));
        dispatch(setSnippetBreadCrum(newBreadCrum));
      }
    });
  }, [isCreatingNew, allTeams, selectedTeam, snippetBreadCrum?.workspace_id, dispatch]);

  useEffect(() => {
    // Determine the relevant ID: either from selectedSnippet or the active (possibly new) snippet
    const targetId = selectedSnippet?.id || selectedSnippet?.snippet_id || activeSnippetId;

    if (!targetId || !userId) {
      setIsFav(false);
      return;
    }

    chrome.storage.local.get('myFavouriteItems', result => {
      const favItems = result.myFavouriteItems || {};
      const currentFavList: Snippet[] = favItems[userId] || [];

      // Check if targetId matches
      const isCurrentlyFav = currentFavList.some(item => {
        const favId = item.id || (item as any).snippet_id;
        return String(favId) === String(targetId);
      });
      setIsFav(isCurrentlyFav);
    });
  }, [selectedSnippet?.id, selectedSnippet?.snippet_id, activeSnippetId, userId]);

  const toggleFavorite = async (item: Snippet) => {
    if (!userId) return;

    try {
      // 1. Get latest storage
      const result: any = await new Promise(resolve => chrome.storage.local.get('myFavouriteItems', resolve));
      const favItems = result.myFavouriteItems || {};
      const currentFavList: Snippet[] = favItems[userId] || [];

      const targetId = item.id || (item as any).snippet_id;
      const existingFavIndex = currentFavList.findIndex(fav => {
        const favId = fav.id || (fav as any).snippet_id;
        return String(favId) === String(targetId);
      });
      const isAlreadyFav = existingFavIndex !== -1;

      // 2. Optimistic local update
      const updatedFavList = isAlreadyFav
        ? currentFavList.filter(fav => {
          const favId = fav.id || (fav as any).snippet_id;
          return String(favId) !== String(targetId);
        })
        : [item, ...currentFavList];

      const updatedMapping = {
        ...favItems,
        [userId]: updatedFavList,
      };

      await new Promise<void>(resolve => chrome.storage.local.set({ myFavouriteItems: updatedMapping }, resolve));

      setFavoritesMapping(updatedMapping);
      setIsFav(!isAlreadyFav);

      // 3. Cloud API update - only if snippet has a persistent ID
      if (!targetId || String(targetId).startsWith('temp-id-')) {
        return;
      }

      if (isAlreadyFav) {
        // Find favorite_id to delete
        const existingItem = currentFavList[existingFavIndex];
        const favId = existingItem.favourite_id;
        if (favId && !String(favId).startsWith('pending-')) {
          await deleteFavorite(userId, Number(favId));
        } else {
          // Fallback cloud search
          try {
            const cloudFavs = await getFavorites(userId);
            const match = cloudFavs.find((cf: any) => String(cf.snippet_id) === String(targetId));
            if (match && match.favourite_id) {
              await deleteFavorite(userId, match.favourite_id);
            }
          } catch (e) {
            console.warn('[SnippetEditor] Fallback cloud deletion failed:', e);
          }
        }
      } else {
        const response = await addFavorite(userId, { id: String(targetId) }, 'snippet');
        // Update the item in local storage with the new favourite_id
        if (response?.favourite_id) {
          const latestRes: any = await new Promise(resolve => chrome.storage.local.get('myFavouriteItems', resolve));
          const latestFavItems = latestRes.myFavouriteItems || {};
          const latestList = latestFavItems[userId] || [];

          const syncedList = latestList.map((f: Snippet) => {
            const fId = f.id || (f as any).snippet_id;
            return String(fId) === String(targetId) ? { ...f, favourite_id: response.favourite_id } : f;
          });

          const syncedMapping = { ...latestFavItems, [userId]: syncedList };
          await new Promise<void>(resolve => chrome.storage.local.set({ myFavouriteItems: syncedMapping }, resolve));
          setFavoritesMapping(syncedMapping);
        }
      }

      triggerToast(isAlreadyFav ? 'Removed from Favorites' : 'Added to Favorites', 'success');
    } catch (error) {
      console.error('Toggle favorite error:', error);
      triggerToast(error instanceof Error ? error.message : 'Something went wrong', 'error');
    }
  };

  useEffect(() => {
    const saveUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    saveUserId();
  }, []);

  useEffect(() => {
    if (teamId && workspacesFromRedux.length === 0) {
      dispatch(fetchWorkspacesThunk(teamId));
    }
  }, [dispatch, teamId, workspacesFromRedux.length]);

  useEffect(() => {
    if (snippetBreadCrum?.workspace_id && workspacesFromRedux.length > 0 && userId && isAdmin) {
      const workspace = workspacesFromRedux.find(ws => ws.workspace_id === snippetBreadCrum.workspace_id);
      if (workspace) {
        // Fetch full workspace details
        getWorkspaceDetails(workspace.workspace_id)
          .then(details => {
            setWorkspaceDetails(details);
          })
          .catch(error => {
            console.error('Error fetching workspace details:', error);
          });
      }
    }
  }, [snippetBreadCrum?.workspace_id, workspacesFromRedux, isAdmin, userId]);

  // Fetch workspace members
  useEffect(() => {
    const fetchWorkspaceMembers = async () => {
      try {
        if (snippetBreadCrum?.workspace_id) {
          setIsLoadingWorkspaceDetails(true);
          // Fetch members in workspace
          const members = await getWorkspaceDetails(snippetBreadCrum.workspace_id);
          setWorkspaceMembers(members);

          // Check if current user is an admin in this workspace
          const currentUserDetails = members.find((member: WorkspaceMember) => member.user_id === userId);
          const userIsAdmin = currentUserDetails?.role === 'admin';
          setIsAdmin(userIsAdmin);
        }
      } catch (error) {
        console.error('Error fetching workspace members:', error);
      } finally {
        setIsLoadingWorkspaceDetails(false);
      }
    };

    fetchWorkspaceMembers();
  }, [snippetBreadCrum, userId, selectedTeam]);

  // ======================
  //  Tag-Related Additions
  // ======================
  const [orgTags, setOrgTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null); // only one tag
  const [tagPopupOpen, setTagPopupOpen] = useState(false);

  // Whether user is currently creating a new tag
  const [creatingNewTag, setCreatingNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Formatting state
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  // ======================
  //  Auto-save Additions
  // ======================
  const isSnippetUnsaved = !activeSnippetId;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedMessage, setLastSavedMessage] = useState('');

  // Add reference to track last saved content to avoid unnecessary API calls
  const lastSavedContentRef = useRef({
    key: '',
    content: '',
  });

  // Reference to track manual saves and prevent auto-saves right after
  const justManuallySavedRef = useRef(false);
  const hasUserModifiedRef = useRef(false);

  // Notify parent of dirty state so Container can guard editor switching
  useEffect(() => {
    if (!onDirtyChange) return;
    const isDirty =
      lastSavedContentRef.current.key !== noteKey.trim() ||
      lastSavedContentRef.current.content !== noteContent.trim();
    const isNewEmptyNote = !activeSnippetId && noteKey.trim().length === 0 && noteContent.trim().length === 0;
    onDirtyChange(isDirty && !isNewEmptyNote);
  }, [noteKey, noteContent, onDirtyChange]);

  // Update "Last saved" message periodically
  useEffect(() => {
    if (!lastSavedAt) {
      setLastSavedMessage('');
      return;
    }

    const updateMessage = () => {
      setLastSavedMessage(`Saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`);
    };

    updateMessage(); // Initial update
    const interval = setInterval(updateMessage, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const handleFormatToggle = (format: keyof typeof formatState) => {
    const newState = { ...formatState, [format]: !formatState[format] };
    setFormatState(newState);
  };

  // Ref to detect clicks outside the popup

  // Ref to detect clicks outside the popup
  const popupRef = useRef<HTMLDivElement | null>(null);

  //delete handle
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false);
  const handleShowDelete = () => {
    setIsDeleteDialogOpen(true);
  };
  const handleDeleteItem = async () => {
    if (!selectedSnippet?.id) {
      triggerToast('Cannot delete an unsaved snippet', 'error');
      return;
    }

    if (!snippetBreadCrum || !selectedSnippet) {
      console.error('Missing snippet or breadcrumb info. Cannot delete.');
      return;
    }

    try {
      await deleteSnippet(
        snippetBreadCrum.folder_id !== null ? snippetBreadCrum.folder_id : undefined,
        selectedSnippet.id,
        selectedTeam?.storageMode ?? 'cloud',
      );

      // Remove from chrome.storage.local favorites
      chrome.storage.local.get('myFavouriteItems', result => {
        const favItems = result.myFavouriteItems || {};
        if (favItems[userId]) {
          const updatedFavList = favItems[userId].filter((fav: Snippet) => fav.id !== selectedSnippet.id);
          favItems[userId] = updatedFavList;

          chrome.storage.local.set({ myFavouriteItems: favItems });
        }
      });

      triggerToast('Deleted Successfully!', 'success');

      closeEditor();

      reload(); // optional if you want to refetch workspaces/snippets again
    } catch (error) {
      const serverErrorMessage =
        error instanceof Error ? (error as any)?.response?.data?.error || error?.message : 'Not recognised';

      triggerToast(serverErrorMessage, 'error');
    }
  };

  // Close popup if user clicks outside
  // Close popup if user clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setTagPopupOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch org tags or use fallback
  useEffect(() => {
    (async () => {
      try {
        const fetchedTags = await getOrgTags(selectedTeamId);
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
  }, [selectedTeamId]);

  const handleTagIconClick = () => {
    setTagPopupOpen(!tagPopupOpen);
  };

  /** Select a single tag by clicking its container. Highlight it if selected. */
  const handleTagSelect = (tag: Tag) => {
    setSelectedTag(tag);
  };

  /** Show the "New Tag" input form */
  // const handleShowNewTag = () => {
  //   setCreatingNewTag(true);
  //   setNewTagName('');
  // };

  /** Hide the "New Tag" form and show normal tag list again */
  // const handleCancelNewTag = () => {
  //   setCreatingNewTag(false);
  //   setNewTagName('');
  // };

  // const handleAddNewTag = async () => {
  //   if (!newTagName.trim()) return;
  //   try {
  //     // Check if tag with same name already exists
  //     const presentTag = orgTags.find(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase());
  //     if (presentTag) {
  //       setSelectedTag(presentTag);
  //     } else {
  //       // Create a new unsaved tag locally
  //       const newTag: Tag = { tag_id: '', name: newTagName.trim() };
  //       setOrgTags(prev => [...prev, newTag]);
  //       setSelectedTag(newTag);
  //     }
  //     setCreatingNewTag(false);
  //     setNewTagName('');
  //   } catch (error: any) {
  //     // Extract error message from API response
  //     let serverErrorMessage = 'An error occurred while saving the note';

  //     try {
  //       // Direct error response in the format {"error":"message"}
  //       if (error.response?.data?.error) {
  //         serverErrorMessage = error.response.data.error;
  //       }
  //       // Plain error message
  //       else if (error.message) {
  //         serverErrorMessage = error.message;
  //       }
  //     } catch (parseError) {
  //       console.error('Error parsing error response:', parseError);
  //     }

  //     triggerToast(serverErrorMessage, 'error');
  //     if (selectedSnippet && selectedSnippet.category === 'snippet') {
  //       setNoteKey(selectedSnippet.key || '');
  //       setNoteContent((selectedSnippet.value as string) || '');
  //     }
  //     console.error('Error saving note:', error);
  //     setSaveStatus('error');

  //     // Reset error status after 5 seconds
  //     setTimeout(() => {
  //       setSaveStatus('idle');
  //     }, 5000);
  //   }
  // };

  // const handleClearTag = () => {
  //   setSelectedTag(null);
  // };

  // When a snippet is selected, set the active snippet ID and populate fields
  useEffect(() => {
    try {
      if (selectedSnippet) {
        // Auto-save previous note if dirty
        if (activeSnippetId && autoSaveEnabled) {
          const hasUnsavedChanges =
            lastSavedContentRef.current.key !== noteKey.trim() ||
            lastSavedContentRef.current.content !== noteContent.trim();

          if (hasUnsavedChanges) {
            handleManualSave(); // Async but fire-and-forget for now
          }
        }

        // Get the ID from the selected snippet
        const snippetId = selectedSnippet.id;
        setActiveSnippetId(snippetId);

        if (selectedSnippet.category === 'note' || selectedSnippet.category === 'snippet') {
          hasUserModifiedRef.current = false; // Reset modification flag on load
          setNoteKey(selectedSnippet.key || '');

          let content = (selectedSnippet.value as string) || '';
          if (selectedSnippet.category === 'snippet' && selectedSnippet.config) {
            content = typeof selectedSnippet.config === 'string'
              ? selectedSnippet.config
              : JSON.stringify(selectedSnippet.config);
          }
          setNoteContent(content);

          const rawTags = selectedSnippet.searchtags;
          if (typeof rawTags === 'object' && rawTags !== null) {
            rawSearchTagsRef.current = rawTags as Record<string, string[]>;
            const myTags = rawSearchTagsRef.current[userId] || [];
            setSearchtags(myTags.join(', '));
          } else {
            rawSearchTagsRef.current = {};
            setSearchtags((rawTags as string) || '');
          }

          if (snippetId && !selectedSnippet.searchtags) {
            chrome.storage.local.get('alts_searchtags_backup', result => {
              const backup = result.alts_searchtags_backup || {};
              if (backup[snippetId]) {
                const bTag = backup[snippetId];
                if (typeof bTag === 'object' && bTag !== null) {
                  rawSearchTagsRef.current = bTag;
                  const myTags = bTag[userId] || [];
                  setSearchtags(myTags.join(', '));
                } else {
                  setSearchtags(bTag);
                }
              }
            });
          }

          isUserKeyManuallySetRef.current = true;

          if (selectedSnippet.tags && selectedSnippet.tags.length > 0) {
            setSelectedTag(selectedSnippet.tags[0]);
          }

          // Update last saved content reference when a snippet is loaded
          lastSavedContentRef.current = {
            key: selectedSnippet.key || '',
            content: content,
          };

          // Explicitly update Quill instance content
          if (editorRef.current) {
            const quill = editorRef.current;
            const newContent = (selectedSnippet.value as string) || '';
            // Use a slight delay to ensure the editor is ready if mounting
            setTimeout(() => {
              if (quill && typeof quill.clipboard?.dangerouslyPasteHTML === 'function') {
                // Clear existing content first to avoid appending
                const currentLength = quill.getLength();
                if (currentLength > 0) {
                  quill.deleteText(0, currentLength);
                }
                quill.clipboard.dangerouslyPasteHTML(0, newContent);
                // Move cursor to end
                quill.setSelection(quill.getLength(), 0);
              }
            }, 0);
          }

          // Mark that we've just loaded a snippet to prevent unnecessary auto-saving
          justManuallySavedRef.current = true;
        }
      } else {
        // Clearing selection
        if (activeSnippetId && autoSaveEnabled) {
          const hasUnsavedChanges =
            lastSavedContentRef.current.key !== noteKey.trim() ||
            lastSavedContentRef.current.content !== noteContent.trim();

          if (hasUnsavedChanges) {
            handleManualSave();
          }
        }

        setActiveSnippetId(null);
        setNoteKey('');
        setNoteContent('');
        setSelectedTag(null);
        setPendingHotkey('');
        setPendingShortcut('');
        setSearchtags('');
        hasUserModifiedRef.current = false; // Reset modification flag on clear

        // Reset the last saved content reference
        lastSavedContentRef.current = {
          key: '',
          content: '',
        };
      }

      // Initialize hotkey and shortcut from storage maps for existing snippets
      if (selectedSnippet) {
        (async () => {
          try {
            const [hotkeysMap, shortcutsMap] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
            const compoundId = getItemCompoundId({
              ...selectedSnippet,
              folder_id: (selectedSnippet as any).folder_id || snippetBreadCrum?.folder_id,
              workspace_id: (selectedSnippet as any).workspace_id || snippetBreadCrum?.workspace_id,
            });

            const currentHotkey = hotkeysMap[compoundId] || '';
            const currentShortcut = shortcutsMap[compoundId] || '';

            setPendingHotkey(currentHotkey);
            setPendingShortcut(currentShortcut.replace(/^\//, ''));
          } catch (error) {
            console.error('[SnippetEditor] Failed to sync standardized maps:', error);
          }
        })();
      }
    } catch (error) {
      console.error('Error setting snippet data:', error);
      // Continue without crashing
    }
  }, [selectedSnippet]); // Note: check dependencies. autoSaveEnabled etc should technically be here but avoiding big re-trigger

  // Track if we've already focused for the current note
  const hasFocusedRef = useRef<string | null>(null);

  // Focus the editor (description area) only once when a note is first opened
  useEffect(() => {
    // Create a unique key for the current note
    const noteKey = selectedSnippet?.id || (isCreatingNew ? 'new-note' : null);

    // Only focus if this is a different note than the last one we focused
    if (noteKey && hasFocusedRef.current !== noteKey) {
      hasFocusedRef.current = noteKey;

      // Wait a bit for the editor to be ready and content to be loaded
      const focusTimeout = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100); // Short timeout to ensure render

      return () => clearTimeout(focusTimeout);
    }

    // Reset the focus ref when note is closed
    if (!noteKey) {
      hasFocusedRef.current = null;
    }

    return undefined;
  }, [selectedSnippet?.id, isCreatingNew, selectedSnippet, noteContent]);

  // Control Quill toolbar visibility
  useEffect(() => {
    const updateToolbarVisibility = () => {
      // Find the Quill toolbar within the container
      const toolbar = containerRef.current?.querySelector('.ql-toolbar') as HTMLElement | null;
      if (toolbar) {
        quillToolbarRef.current = toolbar;
        const variableButton = toolbar.querySelector('.ql-variable') as HTMLElement | null;
        const variableFormatGroup = variableButton?.closest('.ql-formats') as HTMLElement | null;

        if (!isToolbarVisible) {
          // Hide all formatting buttons but keep variable button visible
          const allButtons = toolbar.querySelectorAll('button');
          allButtons.forEach(btn => {
            if (!btn.classList.contains('ql-variable')) {
              (btn as HTMLElement).style.display = 'none';
            }
          });
          // Hide format groups that don't contain variable button
          const formatGroups = toolbar.querySelectorAll('.ql-formats');
          formatGroups.forEach(group => {
            if (group !== variableFormatGroup) {
              (group as HTMLElement).style.display = 'none';
            } else {
              // Ensure variable button's format group is visible
              (group as HTMLElement).style.display = '';
            }
          });
          // Ensure variable button is visible
          if (variableButton) {
            variableButton.style.display = 'flex';
          }
        } else {
          // Show all toolbar buttons and groups
          const allButtons = toolbar.querySelectorAll('button');
          allButtons.forEach(btn => {
            (btn as HTMLElement).style.display = '';
          });
          const formatGroups = toolbar.querySelectorAll('.ql-formats');
          formatGroups.forEach(group => {
            (group as HTMLElement).style.display = '';
          });
        }
      }
    };

    // Initial setup and watch for changes
    const timeout = setTimeout(updateToolbarVisibility, 100);
    // Use MutationObserver to watch for toolbar changes
    const observer = new MutationObserver(updateToolbarVisibility);
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [isToolbarVisible, selectedSnippet?.id, isCreatingNew]);

  // Optimistically update the snippet in Redux
  const updateSnippetInRedux = (
    snippetData: {
      id: string;
      key: string;
      value: string;
      category: string;
      tags?: Tag[];
      user_id?: string;
      first_name?: string;
      last_name?: string;
      created_at?: string;
      updated_at?: string;
    },
    isNew: boolean = false,
  ) => {
    try {
      if (!snippetBreadCrum || !selectedTeam) return;

      // A snippet can be associated with either a workspace or a folder
      // We need at least one of them to be valid
      const workspaceId = snippetBreadCrum.workspace_id || '';
      const folderId = snippetBreadCrum.folder_id || '';

      // Make sure we have at least one valid container (workspace or folder)
      if (!workspaceId && !folderId) {
        console.error('No valid container (workspace or folder) for the snippet');
        return;
      }

      // Resolve correct teamId for the workspace
      let targetTeamId = selectedTeam.team_id;
      if (allTeams && workspaceId) {
        // Using optional chaining and some to find the team that owns the workspace
        const foundTeam = allTeams.find(t => (t.workspaces || []).some(w => w.workspace_id === workspaceId));
        if (foundTeam) {
          targetTeamId = foundTeam.team_id;
        }
      }

      if (isNew) {
        // Add a new snippet
        dispatch(
          optimisticAddSnippet({
            teamId: targetTeamId,
            workspaceId,
            folderId,
            snippet: snippetData,
          }),
        );
      } else {
        // Update an existing snippet
        dispatch(
          optimisticUpdateSnippet({
            teamId: targetTeamId,
            workspaceId,
            folderId,
            snippet: snippetData,
          }),
        );
      }
    } catch (error) {
      console.error('Error updating Redux state:', error);
    }
  };

  // Debounced save function
  const debounceSave = useCallback(() => {
    // Don't proceed if auto-save is disabled
    if (!autoSaveEnabled) return;

    // Don't save if the user hasn't explicitly modified anything
    if (!hasUserModifiedRef.current) return;

    // Don't save if a manual save just happened
    if (justManuallySavedRef.current) {
      justManuallySavedRef.current = false;
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const isLocalMode = selectedTeam?.storageMode === 'local';
    const debounceDelay = isLocalMode ? 300 : 2000;

    // Don't save if essential data is missing
    if (!snippetBreadCrum) return;

    // We need at least a workspace_id or folder_id to save a snippet
    if (!snippetBreadCrum.workspace_id && !snippetBreadCrum.folder_id) return;

    // Minimum valid data check
    const isTitleEmpty = noteKey.trim().length === 0;
    const isContentEmpty = noteContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
    if (isTitleEmpty || isContentEmpty) return;

    // Check if content has actually changed since last save
    if (
      lastSavedContentRef.current.key === noteKey.trim() &&
      lastSavedContentRef.current.content === noteContent.trim()
    ) {
      return; // No changes since last save, skip API call
    }

    // Set a new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Double-check if content has changed since last save (in case of multiple quick edits)
        if (
          lastSavedContentRef.current.key === noteKey.trim() &&
          lastSavedContentRef.current.content === noteContent.trim()
        ) {
          return; // No changes since last save, skip API call
        }

        // Check if a creation is already in progress
        if (!activeSnippetId && isCreatingRef.current) {
          pendingUpdateRef.current = true;
          return;
        }

        setSaveStatus('saving');

        // Update last saved content references
        lastSavedContentRef.current = {
          key: noteKey.trim(),
          content: noteContent.trim(),
        };

        // Prepare tag if selected
        let tagToUse = selectedTag;

        // Create request object
        const targetCategory = category ? category : selectedSnippet ? selectedSnippet.category : 'snippet'; // Default for standard notes is now 'snippet'


        // Update searchtags object
        const newTagsArray = searchtags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tagToUse && tagToUse.name && !newTagsArray.includes(tagToUse.name)) {
          newTagsArray.push(tagToUse.name);
        }

        const updatedSearchTags = { ...rawSearchTagsRef.current };
        if (newTagsArray.length > 0) {
          updatedSearchTags[userId] = newTagsArray;
        } else {
          delete updatedSearchTags[userId];
        }

        const isAstSnippet = targetCategory === 'snippet' && noteContent.trim().startsWith('[');

        let finalValue = noteContent.trim();
        let finalConfig: any = undefined;

        if (isAstSnippet) {
          // Keep finalValue as the JSON string so the backend doesn't lose our AST data!
          finalValue = noteContent.trim();
          try {
            finalConfig = JSON.parse(noteContent.trim());
          } catch (e) {
            finalConfig = noteContent.trim();
          }
        }

        const requestData: any = {
          key: noteKey.trim(),
          value: finalValue,
          category: targetCategory,
          config: finalConfig,
          searchtags: updatedSearchTags,
        };

        // Create the snippet object for Redux update
        const snippetData = {
          id: activeSnippetId || 'temp-id-' + Date.now(), // Use a temporary ID for new snippets
          key: noteKey.trim(),
          value: noteContent.trim(),
          config: finalConfig,
          category: targetCategory,
          tags: tagToUse ? [tagToUse] : [],
          user_id: selectedSnippet?.user_id || '',
          first_name: selectedSnippet?.first_name || '',
          last_name: selectedSnippet?.last_name || undefined,
          created_at: selectedSnippet?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          searchtags: updatedSearchTags,
        };

        // Add correct ID or folder parameters for API request
        if (activeSnippetId) {
          requestData.snippet_id = activeSnippetId;

          // Optimistically update the snippet in Redux before API call
          updateSnippetInRedux(snippetData, false);
        } else {
          // New snippet logic
          isCreatingRef.current = true;

          // If saving a new snippet, we need to determine where to save it
          // It needs to be saved either to a folder or directly to a workspace

          // First try to save to folder if folder_id exists
          if (snippetBreadCrum.folder_id) {
            requestData.folder_id = snippetBreadCrum.folder_id;
          }
          // Otherwise save to workspace
          else if (snippetBreadCrum.workspace_id) {
            requestData.workspace_id = snippetBreadCrum.workspace_id;
          }
          // This should never happen due to earlier checks, but just in case
          else {
            setSaveStatus('error');
            triggerToast('No valid location to save the snippet', 'error');
            isCreatingRef.current = false; // Reset on early exit
            return;
          }

          // For new snippets, we'll update Redux after we get the ID from the API
        }

        // Call the real-time update function
        
        let response;

        response = await updateSnippetRealtime({
          folder_id: snippetBreadCrum.folder_id || undefined,
          snippet_id: activeSnippetId || undefined,
          key: noteKey.trim(),
          value: finalValue,
          config: finalConfig,
          workspace_id: snippetBreadCrum.workspace_id || undefined,
          tags: tagToUse ? [tagToUse] : [],
          category: targetCategory as any,
          hotkey: pendingHotkey || undefined,
          searchtags: updatedSearchTags,
        }, selectedTeam?.storageMode ?? 'cloud');
        if (response?.isNew) {
          // creation complete
          isCreatingRef.current = false;

          // If this was a new snippet, update our active ID
          setActiveSnippetId(response.snippet.snippet_id);


          // For Redux update (accepts undefined)
          const reduxSnippetData = {
            ...snippetData,
            id: response.snippet.snippet_id,
            last_name: snippetData.last_name || undefined,
          };

          // For selected snippet (requires null)
          const selectedSnippetData = {
            ...snippetData,
            id: response.snippet.snippet_id,
            last_name: snippetData.last_name || null,
          };

          // Update Redux with the correct ID from the API
          onDirtyChange?.(false);
          updateSnippetInRedux(reduxSnippetData, true);
          dispatch({
            ...setSelectedSnippet(selectedSnippetData),
            __bypassUnsavedGuard: true,
          } as any);
          reload();

          // Sync pending hotkey/shortcut for new snippet
          if (response.snippet.snippet_id) {
            const compoundId = getItemCompoundId({
              id: response.snippet.snippet_id,
              folder_id: snippetBreadCrum?.folder_id,
              workspace_id: snippetBreadCrum?.workspace_id,
            });

            if (pendingHotkey) {
              await updateLocalHotkey(compoundId, pendingHotkey, (category || 'note') === 'link' ? 'link' : 'note');
            }
            if (pendingShortcut) {
              try {
                await updateSnippetShortcut(response.snippet.snippet_id, pendingShortcut, selectedTeam?.storageMode ?? 'cloud');
                await updateLocalShortcut(
                  compoundId,
                  response.snippet.snippet_id,
                  pendingShortcut,
                  noteKey.trim(),
                  (category || 'note') === 'link' ? 'link' : 'note',
                );
              } catch (e) {
                console.error('Failed to sync pending shortcut:', e);
              }
            }
          }

          // Sync pending favorite for new snippet
          if (isFav && response.snippet.snippet_id) {
            try {
              const favResponse = await addFavorite(userId, { id: response.snippet.snippet_id }, 'snippet');
              if (favResponse?.favourite_id) {
                // Update local storage with the real favorite_id
                chrome.storage.local.get('myFavouriteItems', result => {
                  const favItems = result.myFavouriteItems || {};
                  const currentTeamFavList: Snippet[] = favItems[userId] || [];

                  const updatedFavList = currentTeamFavList.map(fav =>
                    fav.id === response.snippet.snippet_id ? { ...fav, favourite_id: favResponse.favourite_id } : fav,
                  );

                  const updatedMapping = { ...favItems, [userId]: updatedFavList };
                  chrome.storage.local.set({ myFavouriteItems: updatedMapping }, () => {
                    setFavoritesMapping(updatedMapping);
                  });
                });
              }
            } catch (e) {
              console.error('Failed to sync pending favorite:', e);
            }
          }

          // If changes happened while creating, save again immediately
          if (pendingUpdateRef.current) {
            pendingUpdateRef.current = false;
            // Force a save with the new ID
            // We can just call debounceSave again, or set a timeout
            setTimeout(debounceSave, 0);
          }
        }

        // After a successful save/update, check and update favorites
        chrome.storage.local.get('myFavouriteItems', result => {
          const favItems = result.myFavouriteItems || {};
          const currentTeamFavList: Snippet[] = favItems[userId] || [];

          // For new snippets, we need to find and replace any temporary ID entry
          const updatedFavList = currentTeamFavList
            .filter(fav => {
              if (fav.id && tempFavoriteIdRef.current && fav.id === tempFavoriteIdRef.current) {
                return false;
              }
              if (fav.id && fav.id.startsWith('temp-id-')) {
                return fav.key !== noteKey.trim() || (fav.value as string) !== noteContent.trim();
              }
              return true;
            })
            .map(fav =>
              fav.id === (activeSnippetId || response?.snippet?.snippet_id)
                ? { ...fav, key: noteKey.trim(), value: noteContent.trim(), tags: tagToUse ? [tagToUse] : [] }
                : fav,
            );

          // If the snippet is marked as favorite, ensure it has the REAL ID and is in the list
          if (isFav && response?.snippet?.snippet_id) {
            const alreadyInList = updatedFavList.some(fav => fav.id === response.snippet.snippet_id);
            if (!alreadyInList) {
              updatedFavList.push({
                ...snippetData,
                id: response.snippet.snippet_id,
                last_name: snippetData.last_name || null,
              });
            }
          }

          const updatedMapping = {
            ...favItems,
            [userId]: updatedFavList,
          };

          chrome.storage.local.set({ myFavouriteItems: updatedMapping }, () => {
            
            setFavoritesMapping(updatedMapping);
          });
        });

        // Save backup of searchtags locally
        const snippetId = activeSnippetId || response?.snippet?.snippet_id;
        if (snippetId) {
          chrome.storage.local.get('alts_searchtags_backup', result => {
            const backup = result.alts_searchtags_backup || {};
            backup[snippetId] = updatedSearchTags;
            chrome.storage.local.set({ alts_searchtags_backup: backup });
          });
        }

        // Set status to saved
        setSaveStatus('saved');
        setLastSavedAt(new Date());

        // Explicitly clear dirty state - the onDirtyChange useEffect only fires
        // when noteKey/noteContent changes, so it never runs after an auto-save
        // (content didn't change). Without this, isEditorDirty stays true in Redux
        // and the Container-level UnsavedChangesDialog incorrectly fires.
        onDirtyChange?.(false);


      } catch (error: any) {
        // Reset creation flag on error so user can try again
        isCreatingRef.current = false;

        // Extract error message from API response
        let serverErrorMessage = 'An error occurred while saving the note';

        try {
          // Direct error response in the format {"error":"message"}
          if (error.response?.data?.error) {
            serverErrorMessage = error.response.data.error;
          }
          // Plain error message
          else if (error.message) {
            serverErrorMessage = error.message;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }

        if (serverErrorMessage.includes('duplicate key value violates unique constraint') || serverErrorMessage.includes('idx_snippets_unique_key')) {
          serverErrorMessage = 'A note with this title already exists in this folder.';
        }

        triggerToast(serverErrorMessage, 'error');
        if (selectedSnippet && (selectedSnippet.category === 'snippet' || selectedSnippet.category === 'note')) {
          setNoteKey(selectedSnippet.key || '');
          let content = (selectedSnippet.value as string) || '';
          if (selectedSnippet.category === 'snippet' && selectedSnippet.config) {
            content = typeof selectedSnippet.config === 'string'
              ? selectedSnippet.config
              : JSON.stringify(selectedSnippet.config);
          }
          setNoteContent(content);
        }
        console.error('Error saving note:', error);
        setSaveStatus('error');

        // Reset error status after 5 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 5000);
      }
    }, debounceDelay); // Fast save for local mode, 2 seconds for cloud
  }, [
    noteKey,
    noteContent,
    activeSnippetId,
    selectedTag,
    snippetBreadCrum,
    selectedTeamId,
    setSelectedSnippet,
    selectedSnippet,
    autoSaveEnabled,
    dispatch,
    selectedTeam,
    isFav,
    searchtags,
  ]);

  // Trigger debounced save when content or metadata changes
  useEffect(() => {
    if (autoSaveEnabled) {
      debounceSave();
    }
  }, [noteContent, noteKey, autoSaveEnabled, snippetBreadCrum, selectedTag, searchtags, debounceSave]);

  // Manual save for explicit actions (Save button, etc.)
  const handleManualSave = async () => {
    if (!snippetBreadCrum) return;
    if (noteKey.trim().length === 0) {
      triggerToast('Title cannot be empty', 'error');
      return;
    }

    try {
      setSaveStatus('saving');

      // Update refs to current state to prevent auto-save from triggering
      // immediately after we save manually
      lastSavedContentRef.current = {
        key: noteKey.trim(),
        content: noteContent.trim(),
      };
      justManuallySavedRef.current = true; // Flag to skip next auto-save

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Determine ID to use (new vs existing)
      const idToUse = activeSnippetId || null;

      // Exclusive location logic: prioritize folder_id
      const folderId = snippetBreadCrum.folder_id || undefined;
      const workspaceId = folderId ? undefined : snippetBreadCrum.workspace_id || undefined;

      const targetCategory = category ? category : selectedSnippet ? selectedSnippet.category : 'snippet';

      // Update searchtags object
      const newTagsArray = searchtags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (selectedTag && selectedTag.name && !newTagsArray.includes(selectedTag.name)) {
        newTagsArray.push(selectedTag.name);
      }

      const updatedSearchTags = { ...rawSearchTagsRef.current };
      if (newTagsArray.length > 0) {
        updatedSearchTags[userId] = newTagsArray;
      } else {
        delete updatedSearchTags[userId];
      }

      const isAstSnippet = targetCategory === 'snippet' && noteContent.trim().startsWith('[');
      let finalValue = noteContent.trim();
      let finalConfig: any = undefined;

      if (isAstSnippet) {
        finalValue = astToPlainText(noteContent.trim());
        try {
          finalConfig = JSON.parse(noteContent.trim());
        } catch (e) {
          finalConfig = noteContent.trim();
        }
      }

      const requestData: any = {
        folder_id: folderId,
        snippet_id: idToUse as any,
        key: noteKey.trim(),
        value: finalValue,
        config: finalConfig,
        workspace_id: workspaceId,
        category: targetCategory as any,
        tags: [],
        searchtags: updatedSearchTags,
      };

      // Add hotkey if set
      if (pendingHotkey) {
        requestData.hotkey = pendingHotkey;
      }

      
      const response = await updateSnippetRealtime(requestData, selectedTeam?.storageMode ?? 'cloud');

      // API returns { isNew: boolean, snippet: {...} }
      if (response?.snippet) {
        // Inject config back into the response because the backend might omit it
        response.snippet.config = finalConfig;
        const savedTime = new Date();
        setLastSavedAt(savedTime);
        setSaveStatus('saved');
        onDirtyChange?.(false);
        justSavedRef.current = true; // Mark as just saved to prevent unsaved warning
        setLastSavedMessage(`Saved ${formatDistanceToNow(savedTime, { addSuffix: true })}`);

        const newId = response.snippet.id || response.snippet.snippet_id;
        if (newId) {
          chrome.storage.local.get('alts_searchtags_backup', result => {
            const backup = result.alts_searchtags_backup || {};
            backup[newId] = updatedSearchTags;
            chrome.storage.local.set({ alts_searchtags_backup: backup });
          });
        }
        const wasNew = response.isNew || !activeSnippetId;

        // If newly created, set the ID
        if (wasNew && newId) {
          setActiveSnippetId(newId);

          // Optimistically add to list
          updateSnippetInRedux(response.snippet, true);

          // Update selected snippet in Redux to reflect the new ID
          dispatch(
            setSelectedSnippet({
              ...selectedSnippet,
              ...response.snippet,
              id: newId,
            }),
          );

          // Turn off creation flag
          isCreatingRef.current = false;
          dispatch(setIsCreatingNewItem(false));

          // If hotkey was set, update local storage for fast access
          if (pendingHotkey && newId) {
            const compoundId = getItemCompoundId({
              id: newId,
              folder_id: snippetBreadCrum?.folder_id,
              workspace_id: snippetBreadCrum?.workspace_id,
            });
            await updateLocalHotkey(compoundId, pendingHotkey, (category || 'snippet') === 'link' ? 'link' : 'snippet');
          }

          // Sync pending shortcut for new snippet
          if (pendingShortcut && newId) {
            try {
              await updateSnippetShortcut(newId, pendingShortcut, selectedTeam?.storageMode ?? 'cloud');
              const compoundId = getItemCompoundId({
                id: newId,
                folder_id: snippetBreadCrum?.folder_id,
                workspace_id: snippetBreadCrum?.workspace_id,
              });
              await updateLocalShortcut(
                compoundId,
                newId,
                pendingShortcut,
                noteKey.trim(),
                (category || 'snippet') === 'link' ? 'link' : 'snippet',
              );
            } catch (e) {
              console.error('Failed to sync pending shortcut:', e);
            }
          }

          // Sync pending favorite for new snippet
          if (isFav && newId) {
            try {
              const favResponse = await addFavorite(userId, { id: newId }, 'snippet');
              if (favResponse?.favourite_id) {
                // Update local storage with the real favorite_id
                chrome.storage.local.get('myFavouriteItems', result => {
                  const favItems = result.myFavouriteItems || {};
                  const currentTeamFavList: Snippet[] = favItems[userId] || [];

                  const updatedFavList = currentTeamFavList.map(fav =>
                    fav.id === newId ? { ...fav, favourite_id: favResponse.favourite_id } : fav,
                  );

                  const updatedMapping = { ...favItems, [userId]: updatedFavList };
                  chrome.storage.local.set({ myFavouriteItems: updatedMapping }, () => {
                    setFavoritesMapping(updatedMapping);
                  });
                });
              }
            } catch (e) {
              console.error('Failed to sync pending favorite:', e);
            }
          }

          // Navigate back to home (Snippet Lists) on successful create
          if (handleGoHome) {
            handleGoHome();
            return;
          }
        } else {
          // Just an update
          updateSnippetInRedux(response.snippet, false);

          // For existing snippets, update local hotkey storage
          if (activeSnippetId && pendingHotkey) {
            const compoundId = getItemCompoundId({
              id: activeSnippetId,
              folder_id: snippetBreadCrum?.folder_id,
              workspace_id: snippetBreadCrum?.workspace_id,
            });
            await updateLocalHotkey(compoundId, pendingHotkey, (category || 'snippet') === 'link' ? 'link' : 'snippet');
          }
        }

        // After a successful save/update, check and update favorites
        chrome.storage.local.get('myFavouriteItems', result => {
          const favItems = result.myFavouriteItems || {};
          const currentTeamFavList: Snippet[] = favItems[userId] || [];

          const currentId = activeSnippetId || response?.snippet?.snippet_id;

          const updatedFavList = currentTeamFavList
            .filter(fav => {
              if (fav.id && fav.id.startsWith('temp-id-')) {
                return fav.key !== noteKey.trim() || (fav.value as string) !== noteContent.trim();
              }
              return true;
            })
            .map(fav =>
              fav.id === currentId
                ? { ...fav, key: noteKey.trim(), value: noteContent.trim(), tags: selectedTag ? [selectedTag] : [] }
                : fav,
            );

          // If marked as favorite, ensure it has the REAL ID and is in the list
          if (isFav && currentId) {
            const alreadyInList = updatedFavList.some(fav => fav.id === currentId);
            if (!alreadyInList) {
              updatedFavList.push({
                ...response.snippet,
                id: currentId,
                last_name: response.snippet.last_name || null,
              });
            }
          }

          const updatedMapping = {
            ...favItems,
            [userId]: updatedFavList,
          };

          chrome.storage.local.set({ myFavouriteItems: updatedMapping }, () => {
            setFavoritesMapping(updatedMapping);
          });
        });

        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } else {
        // If response doesn't have snippet, still mark as saved
        setSaveStatus('saved');
        onDirtyChange?.(false);
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('error');
      triggerToast('Save failed. Please try again.', 'error');
      // Reset status after a delay so user can try again
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  };

  const handleToggleFavorite = () => {
    const isTitleEmpty = noteKey.trim().length === 0;
    const isContentEmpty = noteContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
    if (isTitleEmpty || isContentEmpty) {
      triggerToast('Please enter a title and description before adding to favorites.', 'warning');
      return;
    }

    if (selectedSnippet) {
      toggleFavorite(selectedSnippet);
    } else if (activeSnippetId) {
      const tempSnippet: any = {
        id: activeSnippetId,
        key: noteKey,
        value: noteContent,
        category: category || 'note',
        tags: selectedTag ? [selectedTag] : [],
        workspace_id: snippetBreadCrum?.workspace_id,
        folder_id: snippetBreadCrum?.folder_id,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      toggleFavorite(tempSnippet);
    } else {
      const tempId = tempFavoriteIdRef.current || 'temp-id-' + Date.now();
      tempFavoriteIdRef.current = tempId;
      const tempSnippet: any = {
        id: tempId,
        key: noteKey,
        value: noteContent,
        category: category || 'note',
        tags: selectedTag ? [selectedTag] : [],
        workspace_id: snippetBreadCrum?.workspace_id,
        folder_id: snippetBreadCrum?.folder_id,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      toggleFavorite(tempSnippet);
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    setPendingShortcut(newShortcut);

    if (activeSnippetId) {
      try {
        await updateSnippetShortcut(activeSnippetId, newShortcut, selectedTeam?.storageMode ?? 'cloud');
        const compoundId =
          snippetBreadCrum?.folder_id || snippetBreadCrum?.workspace_id
            ? `${snippetBreadCrum.folder_id || snippetBreadCrum.workspace_id}-${activeSnippetId}`
            : activeSnippetId;

        await updateLocalShortcut(
          compoundId,
          activeSnippetId,
          newShortcut,
          noteKey.trim(),
          (category || 'snippet') === 'link' ? 'link' : 'snippet',
        );
        showFooterStatus('saved', 'Shortcut updated');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        triggerToast('Failed to update shortcut', 'error');
      }
    }
  };

  const closeEditor = useCallback(() => {
    
    // Reset Focus Mode when leaving
    dispatch(toggleFocusMode(false));

    // Clear all selection state to return to main page (matching RichEditor)
    
    dispatch(setSelectedWorkspace(null));
    dispatch(setSelectedFolder(null));
    dispatch(setSnippetBreadCrum(null));
    dispatch(setSelectedSnippet(null));
    dispatch(setIsCreatingNewItem(false));

    if (onBack) {
      
      onBack();
    }
  }, [dispatch, onBack]);

  const handleEscapeSaveAndClose = useCallback(() => {
    const hasTitle = noteKey.trim().length > 0;
    const hasContent = noteContent.trim().length > 0 && noteContent.trim() !== '<p><br></p>';
    const hasUnsavedChanges =
      lastSavedContentRef.current.key !== noteKey.trim() ||
      lastSavedContentRef.current.content !== noteContent.trim();

    if (hasUnsavedChanges && (hasTitle || hasContent)) {
      setIsUnsavedDialogOpen(true);
    } else {
      closeEditor();
    }
  }, [noteKey, noteContent, closeEditor]);

  const handleGoHome = useCallback(() => {
    closeEditor();
  }, [closeEditor]);

  /**
   * Handle "@" trigger: Open a small dropdown near the cursor
   */
  const handleAtTrigger = useCallback((position: { top: number; left: number }) => {
    
    // Using createPortal with fixed positioning - pass viewport coords directly
    setDropdownPosition(position);
    setIsAtTriggered(true);
    setIsVariableDropdownOpen(true);
    setVariableHighlightIndex(0);
  }, []);

  const handleVariableSelect = useCallback(
    (value: string) => {
      if (!editorRef.current) return;
      const quill = editorRef.current;

      quill.focus();
      const range = quill.getSelection(true);
      if (range) {
        // Delete the @ character (index - 1)
        if (range.index > 0) {
          quill.deleteText(range.index - 1, 1);
        }

        // Get new range after deletion
        const newRange = { index: range.index - 1, length: 0 };

        if (value === 'custom') {
          const varName = `var${varCounter}`;
          quill.insertText(newRange.index, `{{${varName}}}`);
          quill.setSelection(newRange.index + varName.length + 4);
          setVarCounter(prev => prev + 1);
        } else {
          quill.insertText(newRange.index, value);
          quill.setSelection(newRange.index + value.length);
        }
      }
      setIsVariableDropdownOpen(false);
      setIsAtTriggered(false);
      setDropdownPosition(null);
    },
    [varCounter],
  );

  // Track if user types after @ trigger - close dropdown if they continue typing
  const atTriggerContentRef = useRef<number>(-1);
  useEffect(() => {
    if (isAtTriggered && isVariableDropdownOpen) {
      const currentLength = noteContent.length;
      // First time after trigger: save the content length
      if (atTriggerContentRef.current === -1) {
        atTriggerContentRef.current = currentLength;
      } else if (currentLength > atTriggerContentRef.current) {
        // Content increased after @ was typed - user is typing more, close dropdown
        setIsVariableDropdownOpen(false);
        setIsAtTriggered(false);
        setDropdownPosition(null);
        atTriggerContentRef.current = -1;
      }
    } else {
      atTriggerContentRef.current = -1;
    }
  }, [noteContent, isAtTriggered, isVariableDropdownOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isVariableDropdownOpen) return;
    const handleClick = () => {
      setIsVariableDropdownOpen(false);
      setIsAtTriggered(false);
      setDropdownPosition(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isVariableDropdownOpen]);

  // Shortcut listeners (Save + Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      
      // Escape logic - use Capture phase and inline logic to prevent stale closures and event swallowing
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey) {
        if (isFocusMode) {
          event.preventDefault();
          event.stopPropagation();
          dispatch(toggleFocusMode(false));
          return;
        }

        // Don't intercept if warning dialog is already showing - let dialog handle it
        if (isUnsavedDialogOpen) {
          return;
        }

        // Don't intercept if other dialogs or link modal are open
        if (
          isLocationPickerOpen ||
          isDeleteDialogOpen ||
          tagPopupOpen ||
          isTodoDialogOpen ||
          isShareDialogOpen ||
          isLinkEditModalOpen ||
          document.getElementById('hotkey-assignment-popup')
        )
          return;

        event.preventDefault();
        event.stopPropagation();

        // If variable dropdown is open, close it first
        if (isVariableDropdownOpen) {
          setIsVariableDropdownOpen(false);
          setIsAtTriggered(false);
          setDropdownPosition(null);
          return;
        }

        // Close normally via background save
        handleEscapeSaveAndClose();
        return;
      }

      // Ctrl+Enter (Win) or Cmd+Enter (Mac) for Save
      const isSaveShortcut = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';

      if (isSaveShortcut) {
        event.preventDefault();
        if (saveStatus === 'saving') return;

        const needsDestinationSelection = !snippetBreadCrum?.workspace_id && !snippetBreadCrum?.folder_id;

        if (needsDestinationSelection) {
          // Auto-select destination if possible
          if (selectedTeam && selectedTeam.workspaces && selectedTeam.workspaces.length > 0) {
            const defaultWorkspace = selectedTeam.workspaces[0];

            const newBreadCrum = {
              workspace_id: defaultWorkspace.workspace_id,
              workspace_name: defaultWorkspace.workspace_name,
              folder_id: null,
              folder_name: null,
            };

            dispatch(setSelectedWorkspace(defaultWorkspace));
            dispatch(setSelectedFolder(null));
            dispatch(setSnippetBreadCrum(newBreadCrum));

            setTimeout(() => {
              handleManualSave();
            }, 50);
            return;
          }

          if (!selectedTeam || (selectedTeam.workspaces || []).length === 0) {
            triggerToast('Create a workspace or folder before saving.', 'info');
            return;
          }
          setIsLocationPickerOpen(true);
          return;
        }

        handleManualSave();
      }

      // Alt+Enter to toggle Location Picker
      const isLocationPickerShortcut = event.altKey && event.key === 'Enter';
      

      if (isLocationPickerShortcut) {
        
        event.preventDefault();
        if (!selectedTeam || (selectedTeam.workspaces || []).length === 0) {
          triggerToast('Create a workspace or folder before saving.', 'info');
          return;
        }
        
        setIsLocationPickerOpen(prev => !prev);
      }
    };

    // Use Capture phase (true) to ensure we catch Esc before the editor swallows it
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isLocationPickerOpen,
    isDeleteDialogOpen,
    tagPopupOpen,
    isTodoDialogOpen,
    isShareDialogOpen,
    saveStatus,
    snippetBreadCrum,
    selectedTeam,
    triggerToast,
    handleManualSave,
    isFocusMode,
    dispatch,
    isMac,
    closeEditor,
    isVariableDropdownOpen,
    isUnsavedDialogOpen,
    handleEscapeSaveAndClose,
    isLinkEditModalOpen,
  ]);

  // Browser-level warning for unsaved changes (e.g., closing tab/window)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsavedChanges =
        lastSavedContentRef.current.key !== noteKey.trim() ||
        lastSavedContentRef.current.content !== noteContent.trim();

      if (hasUnsavedChanges && (noteKey.trim() || noteContent.trim())) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [noteKey, noteContent]);

  // Add state for folder structure dialog
  const [showFolderStructureDialog, setShowFolderStructureDialog] = useState(false);

  // Handle workspace and folder selection
  const handleWorkspaceSelect = (workspaceId: string, workspaceName: string) => {
    // Find the workspace object in selectedTeam or allTeams
    let workspaceObj = selectedTeam?.workspaces.find(w => w.workspace_id === workspaceId);
    if (!workspaceObj && allTeams) {
      // Search in allTeams if not found in selectedTeam (e.g., Personal Space)
      for (const team of allTeams) {
        workspaceObj = team.workspaces?.find(w => w.workspace_id === workspaceId);
        if (workspaceObj) break;
      }
    }
    if (!workspaceObj) return;

    // Create new bread crumb with the selected workspace
    const newBreadCrum = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      folder_id: null,
      folder_name: null,
    };

    // Update Redux state - Clear folder selection when selecting workspace
    dispatch(setSelectedWorkspace(workspaceObj));
    dispatch(setSelectedFolder(null));
    dispatch(setSnippetBreadCrum(newBreadCrum));

    // Logic to preserve content if editing existing note or active draft
    if (activeSnippetId) {
      // Existing note: Only location updated above. Content logic preserved.
    } else {
      // New Note / Draft
      const hasContent = noteKey.trim().length > 0 || noteContent.trim().length > 0;

      if (!hasContent) {
        setNoteKey('');
        setNoteContent('');
        setActiveSnippetId(null);
        setSelectedTag(null);
      }

      dispatch(setSelectedSnippet(null));
      dispatch(setIsCreatingNewItem(true));
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  const handleFolderSelect = (
    workspaceId: string,
    workspaceName: string,
    folderId: string,
    folderName: string,
    folderPathNames?: string[],
  ) => {
    // Find the workspace object in selectedTeam or allTeams
    let workspaceObj = selectedTeam?.workspaces.find(w => w.workspace_id === workspaceId);
    if (!workspaceObj && allTeams) {
      // Search in allTeams if not found in selectedTeam (e.g., Personal Space)
      for (const team of allTeams) {
        workspaceObj = team.workspaces?.find(w => w.workspace_id === workspaceId);
        if (workspaceObj) break;
      }
    }
    if (!workspaceObj) return;

    // Create new bread crumb with the selected workspace, folder, and folder path
    const newBreadCrum: any = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      folder_id: folderId,
      folder_name: folderName,
    };

    // Add folder path names if provided (for full hierarchy display)
    if (folderPathNames && folderPathNames.length > 0) {
      newBreadCrum.folder_path_names = folderPathNames;
    }

    // Update Redux state - IMPORTANT: Set both workspace AND folder
    dispatch(setSelectedWorkspace(workspaceObj));
    // Note: selectedFolder might not be found for nested folders, that's OK
    dispatch(setSnippetBreadCrum(newBreadCrum));

    // Logic to preserve content if editing existing note or active draft
    if (activeSnippetId) {
      // Existing note: Only location updated above. Content logic preserved.
    } else {
      // New Note / Draft
      const hasContent = noteKey.trim().length > 0 || noteContent.trim().length > 0;

      if (!hasContent) {
        setNoteKey('');
        setNoteContent('');
        setActiveSnippetId(null);
        setSelectedTag(null);
      }

      dispatch(setSelectedSnippet(null));
      dispatch(setIsCreatingNewItem(true));
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  // Adapters for SaveDestinationPicker
  const handleWorkspaceDestination = (workspace: Workspace, isPersonal?: boolean) => {
    handleWorkspaceSelect(workspace.workspace_id, workspace.workspace_name);

    // Save as last used destination
    chrome.storage.local.set({
      lastNoteDestination: {
        workspace_id: workspace.workspace_id,
        folder_id: null,
      },
    });

    setIsLocationPickerOpen(false); // Close the location picker
  };

  const handleFolderDestination = (
    workspace: Workspace,
    folder: Folder,
    isPersonal?: boolean,
    folderPath?: Folder[],
  ) => {
    if (allTeams) {
      if (isPersonal) {
        // Use robust Personal Space detection (flag + name fallback)
        const privateTeam = allTeams.find(t => t.is_personal_space === true || t.team_name === 'Personal Space');
        if (privateTeam) dispatch(setSelectedTeam(privateTeam));
      } else if (orgTeam) {
        dispatch(setSelectedTeam(orgTeam));
      }
    }
    // Extract folder names from path for display
    const folderPathNames = folderPath?.map(f => f.folder_name) || [folder.folder_name];
    handleFolderSelect(
      workspace.workspace_id,
      workspace.workspace_name,
      folder.folder_id,
      folder.folder_name,
      folderPathNames,
    );

    // Save as last used destination
    chrome.storage.local.set({
      lastNoteDestination: {
        workspace_id: workspace.workspace_id,
        folder_id: folder.folder_id,
      },
    });

    setIsLocationPickerOpen(false); // Close the location picker
  };

  // Determine placeholder based on category
  const titlePlaceholder = 'Enter the title for Snippet';

  const destinationDetails = useMemo(() => {
    return getDestinationPathDetails(
      allTeams,
      snippetBreadCrum?.workspace_id || null,
      snippetBreadCrum?.folder_id || null,
      (snippetBreadCrum as any)?.folder_path_names || null,
      (workspacesFromRedux?.find(w => w.workspace_id === snippetBreadCrum?.workspace_id) as any)?.type,
    );
  }, [allTeams, snippetBreadCrum, workspacesFromRedux]);

  const editorContentNode = (
    <div
      className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode ? '' : 'px-6 md:px-12 lg:px-24 py-6 md:py-10'}`}>
      <div
        className={`flex-1 flex flex-col relative ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} ${isFullScreenMode ? 'w-full rounded-none' : 'w-full max-w-[1300px] mx-auto rounded-xl'} bg-[var(--color-editorBg)] ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'}`}>
        <div
          className={`flex-1 min-h-0 flex ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} flex-col gap-3 bg-transparent text-neutral-900 dark:text-white`}>

          {/* Main Area */}
          <div className="flex-1 flex min-h-0 relative">

            {/* Wrapper for Title + Content */}
            <div
              className={`flex-1 flex flex-col min-h-0 relative`}>

              {/* Absolute Close Button */}
              <div className="absolute top-4 right-4 md:top-5 md:right-5 z-50 flex items-center gap-3">
                {isDuplicateTitle && (
                  <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                    Duplicate title exists
                  </span>
                )}
                {/* Auto-save indicator */}
                <div className="transition-opacity duration-300">
                  {(noteKey.trim().length > 0 && noteContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0) && (
                    <>
                      {saveStatus === 'saving' && (
                        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                          Saving...
                        </span>
                      )}
                      {saveStatus !== 'saving' && (lastSavedContentRef.current.key !== noteKey.trim() || lastSavedContentRef.current.content !== noteContent.trim()) && (noteKey.trim().length > 0 || noteContent.trim().length > 0) && (
                        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap opacity-70">
                          Saving...
                        </span>
                      )}
                      {saveStatus === 'saved' && (lastSavedContentRef.current.key === noteKey.trim() && lastSavedContentRef.current.content === noteContent.trim()) && (
                        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                          {lastSavedMessage || 'Auto-saved'} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                        </span>
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={handleEscapeSaveAndClose}
                  className="p-2 opacity-50 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all focus:outline-none focus:ring-1 focus:ring-red-400"
                  title="Close">
                  <FaTimes size={16} />
                </button>
              </div>

              <div className="w-full flex-1 flex flex-col min-h-0 px-6 md:px-12 py-6">
                {/* Title Input Row */}
                <div
                  className={`flex items-center gap-2 flex-shrink-0 relative z-10 ${isFullScreenMode ? 'py-8 pr-6' : 'py-4'}`}>
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <input
                      ref={titleInputRef}
                      value={noteKey}
                      onChange={e => {
                        setNoteKey(e.target.value);
                        isUserKeyManuallySetRef.current = true;
                        hasUserModifiedRef.current = true;
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          editorRef.current?.focus();
                        }
                      }}
                      type="text"
                      placeholder="Title"
                      className={`w-full text-[28px] font-semibold text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isFullScreenMode ? 'pl-8' : ''}`}
                    />
                  </div>

                  <div className="flex-1" />
                </div>

                {/* Editor Area */}
                <div
                  className={`flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-neutral-900 dark:text-white ${isFullScreenMode ? 'pl-8 pr-6 pt-1' : 'pb-3'}`}>
                  <div
                    className="flex-1 min-h-0 overflow-hidden relative"
                    ref={containerRef}
                    onBlurCapture={() => {
                      const hasUnsavedChanges =
                        lastSavedContentRef.current.key !== noteKey.trim() ||
                        lastSavedContentRef.current.content !== noteContent.trim();
                      if (hasUnsavedChanges && autoSaveEnabled) {
                        debounceSave();
                      }
                    }}
                  >
                    {category === 'snippet' ? (
                      <SnippetBuilderEditor />
                    ) : (
                      <QuillEditor
                        value={noteContent}
                        onChange={content => {
                          if (editorRef.current && editorRef.current.hasFocus()) {
                            hasUserModifiedRef.current = true;
                          }
                          setNoteContent(content);
                        }}
                        onKeyUpdate={newKey => {
                          if (!isUserKeyManuallySetRef.current && !noteKey) {
                            setNoteKey(newKey);
                          }
                        }}
                        placeholder="Type your snippet here..."
                        showToolbar={false}
                        ref={editorRef}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Divider Line with Floating Collapse Toggle Button Centered */}
            <div className="relative flex-shrink-0 w-px bg-black/10 dark:bg-white/10">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 w-8 h-8 rounded-full bg-[var(--color-containerBg)] border border-black/10 dark:border-white/15 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm focus:outline-none"
                style={{ left: '50%' }}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
              </button>
            </div>

            {/* RIGHT COLUMN - Snippet Options */}
            <div
              className={`flex-shrink-0 flex flex-col bg-[var(--color-editorBg)] overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[340px] border-l border-black/10 dark:border-white/20'}`}
              style={{
                width: isSidebarCollapsed ? '0px' : '340px',
                minWidth: isSidebarCollapsed ? '0px' : '340px',
              }}
            >
              {/* Sidebar Content - hidden when collapsed */}
              {!isSidebarCollapsed && (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex flex-col gap-6">
                  {category === 'snippet' ? (
                    <SnippetBuilderToolbar />
                  ) : null}
                  {/* Snippet Options Section */}
                  {/* 
                  <div className="space-y-3">
                    <div className="bg-[var(--color-editorBg)] border border-black/5 dark:border-white/20 rounded-2xl p-2 flex flex-col gap-0.5">
                      <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1 pb-2 pt-1 flex items-center">
                        <span>Snippet Options</span>
                      </h3>

                      // Folder Picker
                      <div className="relative">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setIsLocationPickerOpen(prev => !prev); }}
                          disabled={saveStatus === 'saving'}
                          className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 min-w-0 flex-1 pr-2">
                            <FaFolder className="text-[var(--color-iconDefault)] flex-shrink-0" />
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

                      // Tags
                      <div className="relative" ref={popupRef}>
                        <button
                          type="button"
                          onClick={handleTagIconClick}
                          className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            <FiTag className="text-[var(--color-iconDefault)] h-4 w-4" />
                            <span>Tags</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {selectedTag && (
                              <span className="text-xs bg-[var(--color-snippetChipBg)] text-[var(--color-textPrimary)] px-2 py-0.5 rounded-full max-w-[80px] truncate">
                                {selectedTag.name}
                              </span>
                            )}
                            <span className="text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity">
                              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1.2em" width="1.2em"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>
                            </span>
                          </div>
                        </button>

                        {tagPopupOpen && (
                          <div className="absolute right-0 top-full mt-2 w-[240px] bg-[var(--color-editorBg)] border border-black/10 rounded-xl p-3 shadow-xl z-50 flex flex-col gap-2">
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

                      // Favorite Toggle
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSnippet) {
                            toggleFavorite(selectedSnippet);
                          }
                        }}
                        className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                          <FiStar className="text-[var(--color-iconDefault)]" />
                          <span>Favorite</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <FiStar className={`w-[18px] h-[18px] transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--color-iconDefault)] group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`} />
                        </div>
                      </button>

                    </div>
                  </div>
                  */}
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
                  if (onBack) onBack();
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  Esc
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => {
          handleDeleteItem();
          setIsDeleteDialogOpen(false);
        }}
        title={noteKey ? `Delete "${noteKey}"?` : 'Delete this snippet?'}
        description="Are you sure you want to delete this snippet? This action cannot be undone."
        zIndex={isFullScreenMode ? 200000 : 50}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={isUnsavedDialogOpen}
        onClose={() => setIsUnsavedDialogOpen(false)}
        onSave={async () => {
          await handleManualSave();
          setIsUnsavedDialogOpen(false);
          closeEditor();
        }}
        onDiscard={() => {
          setIsUnsavedDialogOpen(false);
          closeEditor();
        }}
        source="SnippetEditor"
        zIndex={isFullScreenMode ? 200000 : 9999}
      />
    </div>
  );

  if (category === 'snippet') {
    return (
      <SnippetBuilderProvider key={selectedSnippet?.id || 'new'} initialContent={noteContent} onChange={content => {
        hasUserModifiedRef.current = true;
        setNoteContent(content);
      }}>
        {editorContentNode}
      </SnippetBuilderProvider>
    );
  }

  return editorContentNode;
};

export const SnippetEditor = React.memo(SnippetEditorComponent);
export default SnippetEditor;
