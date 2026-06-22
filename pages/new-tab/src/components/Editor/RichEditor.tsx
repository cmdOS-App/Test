import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import taskLabsLogo from '../../assets/tasklabs_logo.png';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaExpand,
  FaCompress,
  FaEllipsisV,
  FaBolt,
  FaFolder,
  FaTimes,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaCheckCircle,
} from 'react-icons/fa';
import { FiStar, FiChevronLeft, FiChevronRight, FiMaximize2, FiX, FiTag } from 'react-icons/fi';
import { FaChevronRight } from 'react-icons/fa';
import { RxEnterFullScreen } from 'react-icons/rx';
import { BsCalendarCheck } from 'react-icons/bs';
import type {
  NewSnippetBreadCrum,
  Snippet,
  Tag,
  Workspace,
  WorkspaceDetails,
  Folder,
} from '../../../../modals/interfaces';
import {
  getOrgTags,
  createTagInOrg,
  updateSnippetRealtime,
  deleteSnippet,
  updateSnippetShortcut,
  updateSnippetHotkey,
  convertSnippetToTodo,
} from '../../../../Apis/features/snippetApi';
import {
  optimisticUpdateSnippet,
  optimisticAddSnippet,
  optimisticDeleteSnippet,
  selectAllData,
  fetchAllDataThunk,
} from '../../../../Redux/AllData/allDataSlice';
import { addFavorite, deleteFavorite, getFavorites } from '../../../../Apis/services/favoritesApi';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../Shared/utils/hotkeyUtils';
import { updateLocalHotkey, updateLocalShortcut } from '../../../../utils/shortcutHotkeyUtils';
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
  setShowTodosView,
  setTodoCreatePrefill,
  selectIsLinkEditModalOpen,
} from '../../../../Redux/AllData/uiStateSlice';
import useToast from '../Shared/Toast/useToast';
import { getUserId } from '../../../../Apis/core/api';

import DeleteConfirmation from '../Modals/DeleteDialog';
import UnsavedChangesDialog from '../Modals/UnsavedChangesDialog';

import { getWorkspaceDetails } from '../../../../Apis/features/workspaceApiServices';

import type { AppDispatch, RootState } from '../../../../Redux/store';
import { fetchWorkspacesThunk, selectWorkspacesByTeam } from '../../../../Redux/Workspaces/workspaceSlice';
import QuillEditor from './QuillEditor';
import SaveDestinationPicker from './SaveDestinationPicker';
import VariableDropdown from './VariableDropdown';
import { formatSaveDestinationPath, getDestinationPathDetails } from '../../utils/pathUtils';
import HotkeyAssignButton from './HotkeyAssignButton';
import { useHotkeyOverwrite } from '../../hooks/useHotkeyOverwrite';
import { useAutoSave } from '../../hooks/useAutoSave';
/**
 * InlineTimeInput Component
 */
interface InlineTimeInputProps {
  value: string; // 'HH:mm' in 24h
  onChange: (val: string) => void;
  onExitRight?: () => void;
  onExitLeft?: () => void;
}

const InlineTimeInput: React.FC<InlineTimeInputProps> = ({ value, onChange, onExitRight, onExitLeft }) => {
  let [hh, mm] = (value || '09:00').split(':');
  let hr24 = parseInt(hh, 10);
  const isPM = hr24 >= 12;
  let hr12 = hr24 % 12 || 12;

  const hrRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const ampmRef = useRef<HTMLInputElement>(null);

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;
    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, segment: 'hr' | 'min' | 'ampm') => {
    if (e.key === 'ArrowRight') {
      if (segment === 'hr' && hrRef.current?.selectionEnd === hrRef.current?.value.length) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionEnd === minRef.current?.value.length) { e.preventDefault(); ampmRef.current?.focus(); }
      else if (segment === 'ampm' && ampmRef.current?.selectionEnd === ampmRef.current?.value.length) { e.preventDefault(); onExitRight?.(); }
    } else if (e.key === 'ArrowLeft') {
      if (segment === 'ampm' && ampmRef.current?.selectionStart === 0) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionStart === 0) { e.preventDefault(); hrRef.current?.focus(); }
      else if (segment === 'hr' && hrRef.current?.selectionStart === 0) { e.preventDefault(); onExitLeft?.(); }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (segment === 'hr') updateTime(e.key === 'ArrowUp' ? (hr12 === 12 ? 1 : hr12 + 1) : (hr12 === 1 ? 12 : hr12 - 1), mm, isPM);
      else if (segment === 'min') {
        let m = parseInt(mm, 10);
        m = e.key === 'ArrowUp' ? (m + 1) % 60 : (m - 1 + 60) % 60;
        updateTime(hr12, String(m).padStart(2, '0'), isPM);
      }
      else if (segment === 'ampm') updateTime(hr12, mm, !isPM);
    } else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        if (segment === 'hr') { e.preventDefault(); minRef.current?.focus(); }
        else if (segment === 'min') { e.preventDefault(); ampmRef.current?.focus(); }
      } else {
        if (segment === 'ampm') { e.preventDefault(); minRef.current?.focus(); }
        else if (segment === 'min') { e.preventDefault(); hrRef.current?.focus(); }
      }
    }
  };

  return (
    <div className="flex items-center text-neutral-300 inline-time-input" onClick={e => e.stopPropagation()}>
      <input
        ref={hrRef}
        type="text"
        value={String(hr12).padStart(2, '0')}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 12) num = parseInt(val.slice(-1), 10);
            if (num === 0 && val.length > 1) num = 12;
            updateTime(num || 12, mm, isPM);
            if (val.length === 2 && num >= 1) minRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'hr')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm font-medium"
      />
      <span className="opacity-50 pb-[2px] font-medium">:</span>
      <input
        ref={minRef}
        type="text"
        value={mm}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 59) num = parseInt(val.slice(-1), 10);
            updateTime(hr12, String(num).padStart(2, '0'), isPM);
            if (val.length === 2) ampmRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'min')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm font-medium"
      />
      <input
        ref={ampmRef}
        type="text"
        value={isPM ? 'PM' : 'AM'}
        onChange={e => {
          const val = e.target.value.toUpperCase();
          if (val.includes('A')) updateTime(hr12, mm, false);
          if (val.includes('P')) updateTime(hr12, mm, true);
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'ampm')}
        className="w-[22px] ml-1 bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm text-[11px] font-bold tracking-wider"
      />
    </div>
  );
};

/**
 * CustomTimePicker Component
 */
interface CustomTimePickerProps {
  value: string; // 'HH:mm'
  onChange: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  focusedColumn?: number;
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, isOpen, setIsOpen }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  let [hh, mm] = (value || '09:00').split(':');
  if (!hh) hh = '09';
  if (!mm) mm = '00';

  let hrNum = parseInt(hh);
  const isPM = hrNum >= 12;
  let hr12 = hrNum % 12;
  if (hr12 === 0) hr12 = 12;

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;

    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleHourChange = (newHr: number) => updateTime(newHr, mm, isPM);
  const handleMinChange = (newMin: string) => updateTime(hr12, newMin, isPM);
  const handleMeridiemChange = (newIsPM: boolean) => updateTime(hr12, mm, newIsPM);

  return (
    <div ref={popupRef} className="absolute right-0 top-full mt-2 bg-[#141414] border border-white/10 rounded-xl p-2 shadow-2xl z-[160] flex gap-2 text-white font-sans" onClick={e => e.stopPropagation()}>
      {/* Hours */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
          <button
            key={h}
            type="button"
            onClick={() => handleHourChange(h)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${hr12 === h ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
          >
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>

      <div className="flex flex-col justify-center text-neutral-500 font-bold">:</div>

      {/* Minutes */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1">
        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => handleMinChange(m)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${mm === m ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="w-px bg-white/10 mx-1"></div>

      {/* AM/PM */}
      <div className="flex flex-col gap-1 w-12 justify-center">
        <button
          type="button"
          onClick={() => handleMeridiemChange(false)}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${!isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => handleMeridiemChange(true)}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
        >
          PM
        </button>
      </div>
    </div>
  );
};

/**
 * Fallback tags to display if the organization has no tags.
 */
const generalTags: Tag[] = [
  { tag_id: '', name: 'Important' },
  { tag_id: '', name: 'Work' },
  { tag_id: '', name: 'Urgent' },
  { tag_id: '', name: 'Personal' },
];

interface RichTextEditorProps {
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

// Helper to normalize HTML for dirty checking (Quill sometimes adds/removes trailing tags on blur)
const normalizeHTMLForCompare = (html: string) => {
  if (!html) return '';
  let str = html.trim();
  str = str.replace(/(<p><br><\/p>)+$/, '');
  str = str.replace(/(<br\s*\/?>)+<\/p>$/, '</p>');
  return str;
};

const RichTextEditorComponent: React.FC<RichTextEditorProps> = ({
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

  const workspacesMetadata = useSelector((state: RootState) => selectWorkspacesByTeam(state, selectedTeamId));
  const [isVariableDropdownOpen, setIsVariableDropdownOpen] = useState(false);
  const [variableHighlightIndex, setVariableHighlightIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [isAtTriggered, setIsAtTriggered] = useState(false);
  const [varCounter, setVarCounter] = useState(1);
  const [showToolbar, setShowToolbar] = useState(true);
  const isUserKeyManuallySetRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const quillWrapperRef = useRef<HTMLDivElement>(null); // Separate ref for Quill editor wrapper
  const editorRef = useRef<any>(null); // Quill instance ref

  const isCreatingRef = useRef(false); // Track if a create request is in flight

  const pendingUpdateRef = useRef(false); // Track if changes occurred during creation
  const isFocusMode = useSelector(selectIsFocusMode);

  // State for workspace access management
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceDetails, setWorkspaceDetails] = useState<WorkspaceDetails | null>(null);
  const [isLoadingWorkspaceDetails, setIsLoadingWorkspaceDetails] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTodoDialogOpen, setIsTodoDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ======================
  //  Auto-save Additions
  // ======================
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const loadedSnippetIdRef = useRef<string | null>(null);
  const tempFavoriteIdRef = useRef<string | null>(null);
  const isSnippetUnsaved = !activeSnippetId;


  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const quillToolbarRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isTitleFocusedRef = useRef(false); // Track when user has clicked/focused the title input
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarBtnRef = useRef<HTMLButtonElement>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // Guard flag: true while a new snippet is being loaded into the editor.
  // Suppresses false-positive dirty-state notifications during the load transition.
  const isLoadingSnippetRef = useRef(false);

  const { clearConflictHotkey, clearConflictShortcut } = useHotkeyOverwrite();

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

  // Debug: Log when isLocationPickerOpen changes
  useEffect(() => {
    // console.log('[RichEditor] isLocationPickerOpen state changed to:', isLocationPickerOpen);
  }, [isLocationPickerOpen]);

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
    if (selectedTeamId && workspacesMetadata.length === 0) {
      dispatch(fetchWorkspacesThunk(selectedTeamId));
    }
  }, [dispatch, selectedTeamId, workspacesMetadata.length]);

  // Auto-select default destination for new notes
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
            let folder = null;
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

  const [isFav, setIsFav] = useState(false);
  const [searchtags, setSearchtags] = useState('');
  const rawSearchTagsRef = useRef<Record<string, string[]>>({});

  const toggleFavorite = async (item: Snippet) => {
    if (!selectedTeamId || !userId) return;

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
        // This is a new/unsaved snippet, so we've updated local state only.
        // The persistent save logic will handle adding this to the cloud favorite list.
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
            console.warn('[RichEditor] Fallback cloud deletion failed:', e);
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
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const cyclePopupRef = useRef<HTMLDivElement | null>(null);

  // Whether user is currently creating a new tag
  const [creatingNewTag, setCreatingNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Formatting state
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  const hasUserModifiedRef = useRef(false);

  // Reminder & Schedule states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringCycle, setRecurringCycle] = useState<string | null>('daily');
  const [reminderDate, setReminderDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [reminderTime, setReminderTime] = useState<string>('09:00');
  const [isAnytime, setIsAnytime] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [todoStatus, setTodoStatus] = useState<'idle' | 'creating' | 'success'>('idle');
  const [pendingTodoData, setPendingTodoData] = useState<{
    deadlineVal: string;
    isRecurring: boolean;
    recurringCycle: string | null;
    isAnytime: boolean;
    taskTitle: string;
    tempId: string;
  } | null>(null);
  const timePopupRef = useRef<HTMLDivElement | null>(null);

  // Sync favorite status when activeSnippetId changes (moved here to avoid used-before-declaration error)
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

      // Check if targetId matches or matches the temp ID we used
      const isCurrentlyFav = currentFavList.some(item => {
        const favId = item.id || (item as any).snippet_id;
        return String(favId) === String(targetId) || (tempFavoriteIdRef.current && String(favId) === String(tempFavoriteIdRef.current));
      });
      setIsFav(isCurrentlyFav);
    });
  }, [selectedSnippet?.id, selectedSnippet?.snippet_id, activeSnippetId, userId]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
  // Reference to prevent unsaved dialog from showing right after successful save
  const justSavedRef = useRef(false);

  // Track whether initial data has been synced for useAutoSave (edit mode)
  const hasSyncedAutoSaveRef = useRef(false);

  // --- useAutoSave integration ---
  const {
    syncInitialData: syncAutoSaveInitialData,
    resetSaveStatus: resetAutoSaveStatus,
  } = useAutoSave({
    data: {
      noteKey,
      noteContent,
      workspaceId: snippetBreadCrum?.workspace_id || '',
      folderId: snippetBreadCrum?.folder_id || '',
      selectedTag,
      pendingHotkey,
      pendingShortcut,
      isFav,
      isRecurring,
      recurringCycle,
      reminderDate,
      reminderTime,
      searchtags,
    },
    isValid:
      noteKey.trim().length > 0 &&
      noteContent.trim().length > 0 &&
      !!(snippetBreadCrum?.workspace_id || snippetBreadCrum?.folder_id) &&
      (!selectedSnippet || hasSyncedAutoSaveRef.current),
    debounceMs: selectedTeam?.storageMode === 'local' ? 300 : 2000,
    onSave: async () => {
      // Actual saving is handled by the existing debounceSave useEffect.
      // useAutoSave is used here for syncInitialData/resetSaveStatus and status tracking.
    },
  });

  const isDirty =
    lastSavedContentRef.current.key !== noteKey.trim() ||
    normalizeHTMLForCompare(lastSavedContentRef.current.content) !== normalizeHTMLForCompare(noteContent.trim());

  // Notify parent of dirty state so Container can guard editor switching.
  // Skip while isLoadingSnippetRef is true to avoid false-positive dirty notifications
  // during the async state-update window that occurs when switching between notes.
  useEffect(() => {
    if (!onDirtyChange) return;
    if (isLoadingSnippetRef.current) return; // Suppress during snippet load transition
    const isNewEmptyNote = !activeSnippetId && noteKey.trim().length === 0 && noteContent.trim().length === 0;
    onDirtyChange(isDirty && !isNewEmptyNote);
  }, [isDirty, noteKey, noteContent, onDirtyChange]);

  // Update "Last saved" message periodically
  useEffect(() => {
    if (!lastSavedAt) {
      setLastSavedMessage('');
      return;
    }

    const updateMessage = () => {
      const diffSecs = Math.floor((new Date().getTime() - lastSavedAt.getTime()) / 1000);
      if (diffSecs < 60) {
        setLastSavedMessage('Saved');
      } else {
        setLastSavedMessage(`Saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`);
      }
    };

    updateMessage(); // Initial update
    const interval = setInterval(updateMessage, 10000); // Check every 10 seconds

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
  const handleShowDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  // Unsaved changes dialog state (shown when Escape/Back pressed with dirty content)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
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
      dispatch(
        optimisticDeleteSnippet({
          teamId: teamId,
          workspaceId: snippetBreadCrum.workspace_id || undefined,
          folderId: snippetBreadCrum.folder_id,
          snippetId: selectedSnippet.id,
        })
      );
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
      if (cyclePopupRef.current && !cyclePopupRef.current.contains(event.target as Node)) {
        setIsCycleDropdownOpen(false);
      }
      if (timePopupRef.current && !timePopupRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch org tags or use fallback
  useEffect(() => {
    // Disabled per user request - using fallback directly
    setOrgTags(generalTags);
  }, [selectedTeamId]);

  const handleTagIconClick = () => {
    setTagPopupOpen(!tagPopupOpen);
  };

  const handleCreateTodoFromNote = async () => {
    if (todoStatus === 'creating') return;
    setTodoStatus('creating');

    try {
      let deadlineVal = '';
      if (!isAnytime && reminderDate && reminderTime) {
        try {
          deadlineVal = new Date(`${reminderDate}T${reminderTime}`).toISOString();
        } catch (e) {
          deadlineVal = '';
        }
      }

      const snippetId = selectedSnippet?.id || selectedSnippet?.snippet_id || activeSnippetId;
      const chromeAny = (window as any).chrome;

      // Build a local optimistic todo entry
      const tempId = snippetId || ('temp-id-' + Date.now());
      const optimisticTodo: any = {
        snippet_id: String(tempId),
        key: noteKey.trim() || 'Untitled Note Task',
        title: noteKey.trim() || 'Untitled Note Task',
        value: noteContent.trim(),
        category: category || 'note',
        is_todo_type: true,
        event_deadline: deadlineVal,
        is_done: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        folder_id: '',
        workspace_id: null,
        is_recurring: isRecurring,
        recurring_cycle: isRecurring ? (recurringCycle || 'daily') : null,
        is_anytime: isAnytime,
      };

      // 1. Save optimistically to local storage
      if (chromeAny?.storage?.local) {
        const result = await new Promise<any>(res => chromeAny.storage.local.get(['local_todos'], res));
        const existing: any[] = result.local_todos || [];
        const merged = [optimisticTodo, ...existing.filter((t: any) => String(t.snippet_id || t.id) !== String(tempId))];
        await new Promise<void>(res => chromeAny.storage.local.set({ local_todos: merged }, res));
      }

      // 2. Attempt cloud sync (fire-and-forget — don't block success UX)
      if (snippetId) {
        convertSnippetToTodo(
          { snippet_id: snippetId },
          deadlineVal,
          isRecurring,
          isRecurring ? (recurringCycle || 'daily') : undefined,
          noteKey.trim() || 'Untitled Note Task',
        ).then(res => {
          // Update local todo with real cloud ID
          if (chromeAny?.storage?.local && res?.todo_id) {
            chromeAny.storage.local.get(['local_todos'], (r: any) => {
              const fresh = (r.local_todos || []).map((t: any) =>
                String(t.snippet_id || t.id) === String(tempId) ? { ...t, todo_id: res.todo_id } : t
              );
              chromeAny.storage.local.set({ local_todos: fresh });
            });
          }
          // Schedule alarm for background notifications
          if (deadlineVal && chromeAny?.runtime?.sendMessage) {
            chromeAny.runtime.sendMessage({
              action: 'schedule_todo_alarm',
              todoId: String(res?.todo_id || snippetId),
              deadline: deadlineVal,
              is_anytime: isAnytime
            });
          }
          window.dispatchEvent(new CustomEvent('todosUpdated'));
        }).catch(err => console.warn('[RichEditor] Cloud todo sync failed (local saved ok):', err));
      } else {
        // Stash todo data to be synced after note is saved
        setPendingTodoData({
          deadlineVal,
          isRecurring,
          recurringCycle: isRecurring ? (recurringCycle || 'daily') : null,
          isAnytime,
          taskTitle: noteKey.trim() || 'Untitled Note Task',
          tempId: String(tempId),
        });
        // Force manual save immediately to get real note ID and sync
        handleManualSave();
      }

      // 3. Show success — stay on this page
      setTodoStatus('success');
      setTimeout(() => setTodoStatus('idle'), 3000);
    } catch (err) {
      console.error('[RichEditor] handleCreateTodoFromNote failed:', err);
      setTodoStatus('idle');
      triggerToast('Failed to create todo. Please try again.', 'error');
    }
  };

  /** Select a single tag by clicking its container. Highlight it if selected. */
  const handleTagSelect = (tag: Tag | null) => {
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
        // Prevent reload loop and focus stealing if the note is already loaded
        if (loadedSnippetIdRef.current === selectedSnippet.id) {
          return;
        }

        // Signal that we are transitioning to a new snippet so the dirty-change
        // useEffect doesn't fire a false-positive during the async state update window.
        isLoadingSnippetRef.current = true;
        hasUserModifiedRef.current = false; // Reset modification flag on load

        // Auto-save previous note if dirty
        if (loadedSnippetIdRef.current && autoSaveEnabled) {
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
        loadedSnippetIdRef.current = snippetId;

        if (selectedSnippet.category === 'snippet' || selectedSnippet.category === 'note' || selectedSnippet.category === 'prompt') {
          setNoteKey(selectedSnippet.key || '');
          setNoteContent((selectedSnippet.value as string) || '');
          const rawTags = selectedSnippet.searchtags;
          let searchTagsStr = '';
          if (typeof rawTags === 'object' && rawTags !== null) {
            rawSearchTagsRef.current = rawTags as Record<string, string[]>;
            const myTags = rawSearchTagsRef.current[userId] || [];
            searchTagsStr = myTags.join(', ');
            setSearchtags(searchTagsStr);
          } else {
            rawSearchTagsRef.current = {};
            searchTagsStr = (rawTags as string) || '';
            setSearchtags(searchTagsStr);
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

          if (selectedSnippet.event_deadline) {
            const dateObj = new Date(selectedSnippet.event_deadline);
            setReminderDate(dateObj.toISOString().split('T')[0]);
            const hrs = String(dateObj.getHours()).padStart(2, '0');
            const mins = String(dateObj.getMinutes()).padStart(2, '0');
            setReminderTime(`${hrs}:${mins}`);
          } else {
            // Default tomorrow at 9am if no deadline
            const d = new Date();
            d.setDate(d.getDate() + 1);
            setReminderDate(d.toISOString().split('T')[0]);
            setReminderTime('09:00');
          }
          setIsRecurring(!!selectedSnippet.is_recurring);
          setRecurringCycle(selectedSnippet.recurring_cycle || 'daily');

          // Update last saved content reference when a snippet is loaded
          lastSavedContentRef.current = {
            key: selectedSnippet.key || '',
            content: (selectedSnippet.value as string) || '',
          };

          // Sync useAutoSave initial data to prevent immediate false-save
          syncAutoSaveInitialData({
            noteKey: selectedSnippet.key || '',
            noteContent: (selectedSnippet.value as string) || '',
            workspaceId: snippetBreadCrum?.workspace_id || '',
            folderId: snippetBreadCrum?.folder_id || '',
            selectedTag: selectedSnippet.tags?.[0] || null,
            pendingHotkey: '',
            pendingShortcut: '',
            isFav,
            isRecurring: !!selectedSnippet.is_recurring,
            recurringCycle: selectedSnippet.recurring_cycle || 'daily',
            reminderDate: selectedSnippet.event_deadline ? new Date(selectedSnippet.event_deadline).toISOString().split('T')[0] : reminderDate,
            reminderTime: selectedSnippet.event_deadline ? (() => { const d = new Date(selectedSnippet.event_deadline); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })() : reminderTime,
            searchtags: searchTagsStr,
          });
          hasSyncedAutoSaveRef.current = true;

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
                // Move cursor to end without stealing focus
                // quill.setSelection(quill.getLength(), 0, 'silent');
              }
            }, 0);
          }

          // Mark that we've just loaded a snippet to prevent unnecessary auto-saving
          justManuallySavedRef.current = true;

          // Explicitly clear any lingering dirty state from the previous note.
          // This must happen AFTER state setters above (they are async), so we
          // use a short timeout to let React flush the new noteKey/noteContent before
          // releasing the loading guard and re-enabling dirty tracking.
          setTimeout(() => {
            isLoadingSnippetRef.current = false;
            onDirtyChange?.(false);
          }, 100);
        }
      } else {
        // Clearing selection
        if (loadedSnippetIdRef.current && autoSaveEnabled) {
          const hasUnsavedChanges =
            lastSavedContentRef.current.key !== noteKey.trim() ||
            lastSavedContentRef.current.content !== noteContent.trim();

          if (hasUnsavedChanges) {
            handleManualSave();
          }
        }

        setActiveSnippetId(null);
        loadedSnippetIdRef.current = null;
        setPendingHotkey('');
        setPendingShortcut('');
        setSearchtags('');
        hasUserModifiedRef.current = false; // Reset modification flag on clear

        // Reset the last saved content reference
        lastSavedContentRef.current = {
          key: '',
          content: '',
        };

        // Reset useAutoSave status for new/cleared state
        resetAutoSaveStatus();
        hasSyncedAutoSaveRef.current = false;
      }

      // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
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
            console.error('[RichEditor] Failed to sync standardized maps:', error);
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

  // Focus the title input by default when a note is opened
  useEffect(() => {
    // Create a unique key for the current note
    const noteKey = selectedSnippet?.id || (isCreatingNew ? 'new-note' : null);

    // Only focus if this is a different note than the last one we focused
    if (noteKey && hasFocusedRef.current !== noteKey) {
      hasFocusedRef.current = noteKey;

      // For ALL notes (new and existing): keep focus on the title input by default
      setTimeout(() => {
        if (!isTitleFocusedRef.current) {
          titleInputRef.current?.focus();
          isTitleFocusedRef.current = true;
        }
      }, 50);

      return undefined;
    }

    // Reset the focus ref when note is closed
    if (!noteKey) {
      hasFocusedRef.current = null;
    }

    return undefined;
    // Only re-run when the note ID or creation mode changes - NOT on every content change
  }, [selectedSnippet?.id, isCreatingNew]);

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
      normalizeHTMLForCompare(lastSavedContentRef.current.content) === normalizeHTMLForCompare(noteContent.trim())
    ) {
      return; // No changes since last save, skip API call
    }

    // Set a new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Double-check if content has changed since last save (in case of multiple quick edits)
        if (
          lastSavedContentRef.current.key === noteKey.trim() &&
          normalizeHTMLForCompare(lastSavedContentRef.current.content) === normalizeHTMLForCompare(noteContent.trim())
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

        let deadlineVal: string | undefined = undefined;
        if (reminderDate && reminderTime) {
          try {
            deadlineVal = new Date(`${reminderDate}T${reminderTime}`).toISOString();
          } catch (e) {
            deadlineVal = undefined;
          }
        }
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

        const requestData: any = {
          key: noteKey.trim(),
          value: noteContent.trim(),
          category: targetCategory,
          event_deadline: deadlineVal,
          is_recurring: isRecurring,
          recurring_cycle: isRecurring ? (recurringCycle || 'daily') : null,
          searchtags: updatedSearchTags,
        };

        // Create the snippet object for Redux update
        const snippetData = {
          id: activeSnippetId || 'temp-id-' + Date.now(), // Use a temporary ID for new snippets
          key: noteKey.trim(),
          value: noteContent.trim(),
          category: targetCategory,
          tags: tagToUse ? [tagToUse] : [],
          user_id: selectedSnippet?.user_id || '',
          first_name: selectedSnippet?.first_name || '',
          last_name: selectedSnippet?.last_name || undefined,
          created_at: selectedSnippet?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          event_deadline: deadlineVal,
          is_recurring: isRecurring,
          recurring_cycle: isRecurring ? (recurringCycle || 'daily') : null,
          is_todo_type: !!deadlineVal,
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
        
        const response = await updateSnippetRealtime({
          folder_id: snippetBreadCrum.folder_id || undefined,
          snippet_id: activeSnippetId || undefined,
          key: noteKey.trim(),
          value: noteContent.trim(),
          workspace_id: snippetBreadCrum.workspace_id || undefined,
          tags: tagToUse ? [tagToUse] : [],
          category: targetCategory as any,
          hotkey: pendingHotkey || undefined,
          event_deadline: deadlineVal,
          is_recurring: isRecurring,
          recurring_cycle: isRecurring ? (recurringCycle || 'daily') : null,
          searchtags: updatedSearchTags,
        }, selectedTeam?.storageMode ?? 'cloud');
        if (response?.isNew) {
          // creation complete
          isCreatingRef.current = false;

          // If this was a new snippet, update our active ID
          setActiveSnippetId(response.snippet.snippet_id);
          loadedSnippetIdRef.current = response.snippet.snippet_id;

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
          dispatch(setIsCreatingNewItem(false));
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
            tempFavoriteIdRef.current = null; // Clear it now that it is synced!
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

        // Schedule or update alarm for background notifications
        const chromeAny = (window as any).chrome;
        if (deadlineVal && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(response?.todo_id || response?.snippet?.todo_id || snippetId),
            deadline: deadlineVal,
            is_anytime: isAnytime
          });
        } else if (!deadlineVal && chromeAny?.runtime?.sendMessage && snippetId) {
          // If no deadline/todo, clear any existing alarm
          chromeAny.runtime.sendMessage({
            action: 'clear_todo_alarm',
            todoId: String(snippetId)
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
          setNoteContent((selectedSnippet.value as string) || '');
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
    isCreatingNew,
    setSelectedSnippet,
    selectedSnippet,
    autoSaveEnabled,
    dispatch,
    selectedTeam,
    isFav,
    searchtags,
  ]);

  // Footer Status Notification State
  const [footerStatus, setFooterStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const footerStatusTimeoutRef = useRef<number | null>(null);

  const showFooterStatus = (type: 'idle' | 'saving' | 'success' | 'error', message: string, duration = 3000) => {
    if (footerStatusTimeoutRef.current) {
      clearTimeout(footerStatusTimeoutRef.current);
    }
    setFooterStatus({ type, message });
    if (type !== 'saving') {
      footerStatusTimeoutRef.current = window.setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, duration);
    }
  };

  const closeEditor = useCallback(() => {


    // Cancel any pending debounced auto-save so discarded notes are never saved
    if (saveTimeoutRef.current) {

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Reset Focus Mode when leaving
    dispatch(toggleFocusMode(false));

    dispatch(setSelectedWorkspace(null));
    dispatch(setSelectedFolder(null)); // CLEAR BREADCRUMB: Clear folder selection
    dispatch(setSnippetBreadCrum(null));
    dispatch(setSelectedSnippet(null));
    dispatch(setIsCreatingNewItem(false));

    // Explicitly reset dirty state before navigating away to avoid triggering Container's UnsavedChangesDialog

    onDirtyChange?.(false);

    if (onBack) {
      onBack();
    }
  }, [dispatch, snippetBreadCrum?.workspace_id, onBack, activeSnippetId, noteKey, isCreatingNew, onDirtyChange]);

  /**
   * Checks whether there are unsaved changes before closing the editor.
   * - For NEW notes (never saved): any typed title or content is considered unsaved.
   * - For EXISTING notes: compare current content against last-saved snapshot.
   * If unsaved changes exist → show the UnsavedChangesDialog.
   * Otherwise → close the editor immediately.
   */
  const checkAndCloseEditor = useCallback(() => {
    const hasTitle = noteKey.trim().length > 0;
    const hasContent = noteContent.trim().length > 0;
    const isNewUnsaved = !activeSnippetId && (hasTitle || hasContent);
    const isExistingDirty =
      !!activeSnippetId &&
      (lastSavedContentRef.current.key !== noteKey.trim() ||
        normalizeHTMLForCompare(lastSavedContentRef.current.content) !== normalizeHTMLForCompare(noteContent.trim()));

    

    if (isNewUnsaved || isExistingDirty) {
      
      setShowUnsavedDialog(true);
    } else {
      
      closeEditor();
    }
  }, [noteKey, noteContent, activeSnippetId, closeEditor]);

  const handleWorkspaceBackclick = useCallback(() => {
    
    checkAndCloseEditor();
  }, [checkAndCloseEditor]);

  // Toggle auto-save feature
  const toggleAutoSave = () => {
    setAutoSaveEnabled(!autoSaveEnabled);
  };

  // Trigger debounced save when content or metadata changes.
  // Skip if we are currently loading a new snippet to avoid triggering an unnecessary
  // API call (and potential save-status flicker) during the load transition.
  useEffect(() => {
    if (autoSaveEnabled && !isLoadingSnippetRef.current) {
      debounceSave();
    }
  }, [noteContent, noteKey, autoSaveEnabled, snippetBreadCrum, selectedTag, isRecurring, recurringCycle, reminderDate, reminderTime, searchtags, debounceSave]);

  // Manual save function for when auto-save is disabled
  const handleManualSave = async () => {
    /* Manual save logic disabled per user request
    if (saveStatus === 'saving') return;
    try {
      if (noteKey.trim().length === 0) {
        showFooterStatus('error', 'Enter the Key');
        return;
      }

      if (noteContent.trim().length === 0) {
        showFooterStatus('error', 'Enter the Description');
        return;
      }

      if (!snippetBreadCrum) {
        triggerToast('Something went wrong please try again', 'error');
        return;
      }

      // Ensure we have either a workspace_id or folder_id to save the snippet
      if (!snippetBreadCrum.workspace_id && !snippetBreadCrum.folder_id) {
        triggerToast('No valid location to save the snippet', 'error');
        return;
      }

      // Mark that we're doing a manual save to prevent auto-save from triggering
      justManuallySavedRef.current = true;

      // Update last saved content references
      lastSavedContentRef.current = {
        key: noteKey.trim(),
        content: noteContent.trim(),
      };

      setSaveStatus('saving');
      showFooterStatus('saving', 'Saving...');

      // Prepare tag if selected
      let tagToUse = selectedTag;

      // Create request object
      // Determine category based on props or existing snippet
      // Note Creation (default) -> category: 'note' (as requested)
      // Snippet Creation -> category: 'snippet' (as requested)

      const targetCategory = category ? category : selectedSnippet ? selectedSnippet.category : 'note'; // Default for standard notes is now 'note'

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

      let deadlineVal: string | undefined = undefined;
      if (reminderDate && reminderTime) {
        try {
          deadlineVal = new Date(`${reminderDate}T${reminderTime}`).toISOString();
        } catch (e) {
          deadlineVal = undefined;
        }
      }
      const requestData: any = {
        key: noteKey.trim(),
        value: noteContent.trim(),
        category: targetCategory,
        tags: tagToUse ? [tagToUse] : [],
        event_deadline: deadlineVal,
        is_recurring: isRecurring,
        recurring_cycle: isRecurring ? (recurringCycle || 'daily') : null,
        searchtags: updatedSearchTags,
      };

      // Add hotkey if set
      if (pendingHotkey) {
        requestData.hotkey = pendingHotkey;
      }

      // Create the snippet object for Redux update
      const snippetData = {
        id: activeSnippetId || 'temp-id-' + Date.now(), // Use a temporary ID for new snippets
        key: noteKey.trim(),
        value: noteContent.trim(),
        category: targetCategory,
        tags: tagToUse ? [tagToUse] : [],
        user_id: selectedSnippet?.user_id || '',
        first_name: selectedSnippet?.first_name || '',
        last_name: selectedSnippet?.last_name || undefined,
        created_at: selectedSnippet?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        event_deadline: deadlineVal,
        is_recurring: isRecurring,
        recurring_cycle: isRecurring ? (recurringCycle || 'daily') : null,
        is_todo_type: !!deadlineVal,
        searchtags: updatedSearchTags,
      };

      // Add correct ID or folder parameters
      if (activeSnippetId) {
        requestData.snippet_id = activeSnippetId;

        // Optimistically update the snippet in Redux before API call
        updateSnippetInRedux(snippetData, false);
      } else {
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
          showFooterStatus('error', 'No valid location');
          triggerToast('No valid location to save the snippet', 'error');
          return;
        }

        // For new snippets, we'll update Redux after we get the ID from the API
      }

      // Call the real-time update function
      console.log('[RichEditor] Manual Save - Saving with category:', targetCategory);
      const response = await updateSnippetRealtime(requestData, selectedTeam?.storageMode ?? 'cloud');

      // Show success feedback immediately after API response
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      showFooterStatus('success', 'Saved');
      dispatch(
        queueNotification({
          message: 'Saved note',
          type: 'success',
        }),
      );

      const snippetId = activeSnippetId || response?.snippet?.snippet_id;
      if (snippetId) {
        chrome.storage.local.get('alts_searchtags_backup', result => {
          const backup = result.alts_searchtags_backup || {};
          backup[snippetId] = updatedSearchTags;
          chrome.storage.local.set({ alts_searchtags_backup: backup });
        });
      }

      if (response?.isNew && response?.snippet) {
        // If this was a new snippet, update our active ID
        setActiveSnippetId(response.snippet.snippet_id);
        loadedSnippetIdRef.current = response.snippet.snippet_id;
        setUserId(response.snippet.user_id);

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
        updateSnippetInRedux(reduxSnippetData, true);
        dispatch(setSelectedSnippet(selectedSnippetData));
        reload();

        // If hotkey was set, update local storage for fast access
        if (pendingHotkey && response.snippet.snippet_id) {
          const compoundId =
            snippetBreadCrum.folder_id || snippetBreadCrum.workspace_id
              ? `${snippetBreadCrum.folder_id || snippetBreadCrum.workspace_id}-${response.snippet.snippet_id}`
              : response.snippet.snippet_id;
          await updateLocalHotkey(compoundId, pendingHotkey, (category || 'note') === 'link' ? 'link' : 'note');
        }

        // Sync pending shortcut for new snippet
        if (pendingShortcut && response.snippet.snippet_id) {
          try {
            await updateSnippetShortcut(response.snippet.snippet_id, pendingShortcut, selectedTeam?.storageMode ?? 'cloud');
            const compoundId =
              snippetBreadCrum.folder_id || snippetBreadCrum.workspace_id
                ? `${snippetBreadCrum.folder_id || snippetBreadCrum.workspace_id}-${response.snippet.snippet_id}`
                : response.snippet.snippet_id;
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

        // Sync pending todo for new snippet
        if (pendingTodoData && response.snippet.snippet_id) {
          const tempTodoId = pendingTodoData.tempId;
          const targetSnippetId = response.snippet.snippet_id;
          convertSnippetToTodo(
            { snippet_id: targetSnippetId },
            pendingTodoData.deadlineVal,
            pendingTodoData.isRecurring,
            pendingTodoData.isRecurring ? (pendingTodoData.recurringCycle || 'daily') : undefined,
            pendingTodoData.taskTitle,
          ).then(res => {
            if (chromeAny?.storage?.local && res?.todo_id) {
              chromeAny.storage.local.get(['local_todos'], (r: any) => {
                const fresh = (r.local_todos || []).map((t: any) =>
                  String(t.snippet_id || t.id) === String(tempTodoId)
                    ? { ...t, snippet_id: targetSnippetId, todo_id: res.todo_id }
                    : t
                );
                chromeAny.storage.local.set({ local_todos: fresh });
              });
            }
            // Schedule alarm for background notifications
            if (pendingTodoData.deadlineVal && chromeAny?.runtime?.sendMessage) {
              chromeAny.runtime.sendMessage({
                action: 'schedule_todo_alarm',
                todoId: String(res?.todo_id || targetSnippetId),
                deadline: pendingTodoData.deadlineVal,
                is_anytime: pendingTodoData.isAnytime
              });
            }
            window.dispatchEvent(new CustomEvent('todosUpdated'));
          }).catch(err => console.warn('[RichEditor] Cloud todo sync failed:', err));
          setPendingTodoData(null);
        }



        // Auto-navigate back to main page for new notes (First time save)
        // Set justSavedRef to prevent unsaved warning during close
        justSavedRef.current = true;
        setTimeout(() => {
          handleWorkspaceBackclick();
        }, 500);
      } else if (activeSnippetId && pendingHotkey) {
        // For existing snippets, update local hotkey storage
        const compoundId = getItemCompoundId({
          id: activeSnippetId,
          folder_id: snippetBreadCrum?.folder_id,
          workspace_id: snippetBreadCrum?.workspace_id,
        });
        await updateLocalHotkey(compoundId, pendingHotkey, (category || 'note') === 'link' ? 'link' : 'note');
      }

      // After a successful save/update, check and update favorites
      chrome.storage.local.get('myFavouriteItems', result => {
        const favItems = result.myFavouriteItems || {};
        const currentTeamFavList: Snippet[] = favItems[userId] || [];

        // For new snippets, we need to find and replace any temporary ID entry
        // that might have been added by toggleFavorite before the snippet was saved.
        const updatedFavList = currentTeamFavList
          .filter(fav => {
            if (fav.id && tempFavoriteIdRef.current && fav.id === tempFavoriteIdRef.current) {
              return false;
            }
            // Remove any temp entries that match this snippet's content (defensive)
            // or any entry that was just created for this new snippet
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
          console.log('RichEditor: Successfully updated myFavouriteItems in chrome.storage.local', updatedMapping);
          setFavoritesMapping(updatedMapping);
        });
      });


    } catch (error: any) {
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

      triggerToast(serverErrorMessage, 'error');
      if (selectedSnippet && (selectedSnippet.category === 'snippet' || selectedSnippet.category === 'note')) {
        setNoteKey(selectedSnippet.key || '');
        setNoteContent((selectedSnippet.value as string) || '');
      }
      console.error('Error saving note:', error);
      setSaveStatus('error');

      // Reset error status after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    }
    */
  };

  // Trigger autosave on content change
  useEffect(() => {
    if (autoSaveEnabled && !isCreatingRef.current) {
      debounceSave();
    }
  }, [noteContent, noteKey, autoSaveEnabled, snippetBreadCrum, selectedTag, isRecurring, recurringCycle, reminderDate, reminderTime, debounceSave]);

  // Add state for folder structure dialog
  const [showFolderStructureDialog, setShowFolderStructureDialog] = useState(false);

  // CLEAR BREADCRUMB: When closing the editor, clear all selection state to return to home

  // Handle workspace and folder selection
  const handleWorkspaceSelect = (workspaceId: string, workspaceName: string) => {
    // Find the workspace object in selectedTeam or allTeams
    let workspaceObj = selectedTeam?.workspaces.find(w => w.workspace_id === workspaceId);
    let owningTeam = selectedTeam;
    if (!workspaceObj && allTeams) {
      // Search in allTeams if not found in selectedTeam (e.g., Personal Space)
      for (const team of allTeams) {
        workspaceObj = team.workspaces?.find(w => w.workspace_id === workspaceId);
        if (workspaceObj) {
          owningTeam = team;
          break;
        }
      }
    }
    if (!workspaceObj) return;

    if (owningTeam) {
      dispatch(setSelectedTeam(owningTeam));
    }

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
        loadedSnippetIdRef.current = null;
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
    let owningTeam = selectedTeam;
    if (!workspaceObj && allTeams) {
      // Search in allTeams if not found in selectedTeam (e.g., Personal Space)
      for (const team of allTeams) {
        workspaceObj = team.workspaces?.find(w => w.workspace_id === workspaceId);
        if (workspaceObj) {
          owningTeam = team;
          break;
        }
      }
    }
    if (!workspaceObj) return;

    if (owningTeam) {
      dispatch(setSelectedTeam(owningTeam));
    }

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
        loadedSnippetIdRef.current = null;
        setSelectedTag(null);
      }

      dispatch(setSelectedSnippet(null));
      dispatch(setIsCreatingNewItem(true));
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  const handleCreateNewNote = () => {
    setNoteKey('');
    setNoteContent('');
    setActiveSnippetId(null);
    loadedSnippetIdRef.current = null;
    setSelectedTag(null);
    setIsFav(false);
    setIsRecurring(false);
    setIsAnytime(false);
    setRecurringCycle('daily');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setReminderDate(d.toISOString().split('T')[0]);
    setReminderTime('09:00');

    if (editorRef.current && typeof editorRef.current.deleteText === 'function') {
      editorRef.current.deleteText(0, editorRef.current.getLength());
    }

    dispatch(setSelectedSnippet(null));
    dispatch(setIsCreatingNewItem(true));
    tempFavoriteIdRef.current = null;
  };

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  const handleToggleFavorite = () => {
    if (selectedSnippet) {
      toggleFavorite(selectedSnippet);
    } else if (activeSnippetId) {
      // Fallback for new/unsaved snippets where selectedSnippet prop hasn't updated yet
      const tempSnippet: any = {
        id: activeSnippetId,
        key: noteKey,
        value: noteContent,
        category: category || 'snippet',
        tags: selectedTag ? [selectedTag] : [],
        workspace_id: snippetBreadCrum?.workspace_id,
        folder_id: snippetBreadCrum?.folder_id,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      toggleFavorite(tempSnippet);
    } else {
      // Brand new unsaved snippet - no ID yet
      // Create a temporary snippet object with a temp ID so the favorite state is tracked
      // The real ID will be assigned and synced after save (debounceSave or handleManualSave)
      const tempId = tempFavoriteIdRef.current || 'temp-id-' + Date.now();
      tempFavoriteIdRef.current = tempId;
      const tempSnippet: any = {
        id: tempId,
        key: noteKey,
        value: noteContent,
        category: category || 'snippet',
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

  const handleHotkeyChange = async (newHotkey: string) => {
    setPendingHotkey(newHotkey);

    if (activeSnippetId) {
      try {
        await updateSnippetHotkey(activeSnippetId, newHotkey, selectedTeam?.storageMode ?? 'cloud');
        const compoundId =
          snippetBreadCrum?.folder_id || snippetBreadCrum?.workspace_id
            ? `${snippetBreadCrum.folder_id || snippetBreadCrum.workspace_id}-${activeSnippetId}`
            : activeSnippetId;

        await updateLocalHotkey(compoundId, newHotkey, (category || 'snippet') === 'link' ? 'link' : 'note');
        showFooterStatus('success', newHotkey ? 'Hotkey updated' : 'Hotkey cleared');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        triggerToast('Failed to update hotkey', 'error');
      }
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
          (category || 'note') === 'link' ? 'link' : 'note',
        );
        showFooterStatus('success', 'Shortcut updated');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        triggerToast('Failed to update shortcut', 'error');
      }
    }
  };

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

  const handleAtTrigger = useCallback((position: { top: number; left: number }) => {
    // Get editor container bounding rect to calculate relative position if needed
    // But for Portal/Overlay, absolute screen coords might be better.
    // AltS `CreateNotePanel` logic:
    /*
      if (panelRef.current) {
        const panelRect = panelRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: position.top - panelRect.top,
          left: position.left - panelRect.left,
        });
      }
    */
    // For RichEditor in New Tab, the editor is inside `containerRef`.
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: position.top - containerRect.top,
        left: position.left - containerRect.left,
      });
    } else {
      setDropdownPosition(position);
    }
    setIsVariableDropdownOpen(true);
    setIsAtTriggered(true);
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
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isVariableDropdownOpen]);

  // Shortcut listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      //console.log(
      //   '[RichEditor] handleKeyDown triggered:',
      //   event.key,
      //   'Alt:',
      //   event.altKey,
      //   'Ctrl:',
      //   event.ctrlKey,
      //   'Meta:',
      //   event.metaKey,
      // );
      // Escape logic - use Capture phase and inline logic
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey) {
        

        if (isFocusMode) {
          event.preventDefault();
          event.stopPropagation();
          dispatch(toggleFocusMode(false));
          return;
        }

        // Don't intercept if the unsaved-changes dialog is already showing — let the dialog handle its own Escape
        if (showUnsavedDialog) {
          
          return;
        }

        // Don't intercept if other dialogs/popups are open (let them close first)
        if (
          isLocationPickerOpen ||
          isDeleteDialogOpen ||
          tagPopupOpen ||
          isTodoDialogOpen ||
          isShareDialogOpen ||
          document.getElementById('hotkey-assignment-popup')
        ) {
          
          return;
        }

        event.preventDefault();
        event.stopPropagation(); // Stop propagation to prevent editor from handling it

        // If variable dropdown is open, close it first
        if (isVariableDropdownOpen) {
          
          setIsVariableDropdownOpen(false);
          setIsAtTriggered(false);
          setDropdownPosition(null);
          return;
        }

        // If we just saved successfully, skip the unsaved check and close
        if (justSavedRef.current) {
          
          justSavedRef.current = false;
          closeEditor();
          return;
        }

        // Run unsaved-change guard
        
        checkAndCloseEditor();
        return;
      }

      // Ctrl+Enter (Win) or Cmd+Enter (Mac) for Save / Create New
      const isSaveShortcut = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';

      if (isSaveShortcut) {
        event.preventDefault();

        if (!isCreatingNew) {
          handleCreateNewNote();
          return;
        }

        if (saveStatus === 'saving') return;

        const needsDestinationSelection = !snippetBreadCrum?.workspace_id && !snippetBreadCrum?.folder_id;

        if (needsDestinationSelection) {
          // Auto-select destination if possible
          if (selectedTeam && selectedTeam.workspaces && selectedTeam.workspaces.length > 0) {
            const defaultWorkspace = selectedTeam.workspaces[0];

            // Create a temporary breadcrumb for state consistency
            const newBreadCrum = {
              workspace_id: defaultWorkspace.workspace_id,
              workspace_name: defaultWorkspace.workspace_name,
              folder_id: null,
              folder_name: null,
            };

            dispatch(setSelectedWorkspace(defaultWorkspace));
            dispatch(setSelectedFolder(null));
            dispatch(setSnippetBreadCrum(newBreadCrum));

            // Trigger save after a minimal delay to allow state propagation
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

      // Applying corrected logic for Location Picker
      const isLocationPickerShortcut = event.altKey && event.key === 'Enter'; // Option is altKey on Mac
      

      if (isLocationPickerShortcut) {
        
        event.preventDefault();
        if (!selectedTeam || (selectedTeam.workspaces || []).length === 0) {
          triggerToast('Create a workspace or folder before saving.', 'info');
          return;
        }
        setIsLocationPickerOpen(prev => !prev);
      }
    };

    // Use Capture phase (true)
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isLocationPickerOpen,
    isDeleteDialogOpen,
    tagPopupOpen,
    isTodoDialogOpen,
    isShareDialogOpen,
    showUnsavedDialog,
    saveStatus,
    snippetBreadCrum,
    selectedTeam,
    triggerToast,
    handleManualSave,
    isFocusMode,
    dispatch,
    isMac,
    noteKey,
    noteContent,
    checkAndCloseEditor,
    closeEditor,
    isVariableDropdownOpen,
    autoSaveEnabled,
  ]);

  // Browser-level warning for unsaved changes (e.g., closing tab/window)
  // Restored based on user request ("no i want theseee")
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsavedChanges =
        lastSavedContentRef.current.key !== noteKey.trim() ||
        normalizeHTMLForCompare(lastSavedContentRef.current.content) !== normalizeHTMLForCompare(noteContent.trim());

      if (hasUnsavedChanges && (noteKey.trim() || noteContent.trim())) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [noteKey, noteContent]);

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
  // Focus title input by default when opened (Full Screen / Rich Editor)
  // Using autoFocus on input AND timeout to beat any focus stealers (like QuillEditor)
  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 300); // 300ms to beat async editor initialization
    return () => clearTimeout(focusTimeout);
  }, []);

  // Determine placeholder based on category
  const titlePlaceholder = 'Title';

  const destinationDetails = useMemo(() => {
    return getDestinationPathDetails(
      allTeams,
      snippetBreadCrum?.workspace_id || null,
      snippetBreadCrum?.folder_id || null,
      (snippetBreadCrum as any)?.folder_path_names || null,
      (workspacesMetadata?.find(w => w.workspace_id === snippetBreadCrum?.workspace_id) as any)?.type,
    );
  }, [allTeams, snippetBreadCrum, workspacesMetadata]);

  return (
    <div
      className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode ? '' : 'px-6 md:px-12 lg:px-24 py-6 md:py-10'}`}>
      <div
        className={`flex-1 flex flex-col relative ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} ${isFullScreenMode ? 'w-full rounded-none' : 'w-full max-w-[1300px] mx-auto rounded-xl'} bg-[var(--color-editorBg)] ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'}`}
        ref={containerRef}>


        <div
          className={`flex-1 min-h-0 flex ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'} ${isFullScreenMode ? 'flex-row' : 'flex-col gap-3'} bg-transparent text-neutral-900 dark:text-white`}>
          {/* Sidebar - Only in full-screen mode */}
          {isFullScreenMode && (
            <div className="w-[180px] flex flex-col flex-shrink-0">
              <div className="px-8 py-8">
                <div
                  className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100 transition-opacity w-fit"
                  onClick={() => {
                    // Save draft content to chrome storage before navigating
                    // Get HTML content from Quill to preserve formatting
                    const htmlContent = editorRef.current?.root?.innerHTML || noteContent;
                    const folderId = snippetBreadCrum?.folder_id || undefined;
                    const workspaceId = snippetBreadCrum?.workspace_id || undefined;
                    const idToUse = activeSnippetId || undefined;

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

                    // Perform save
                    updateSnippetRealtime({
                      folder_id: folderId,
                      snippet_id: idToUse,
                      key: noteKey.trim(),
                      value: noteContent.trim(),
                      workspace_id: workspaceId,
                      category: (category || 'snippet') as any,
                      searchtags: updatedSearchTags,
                    }, selectedTeam?.storageMode ?? 'cloud');
                    const draftData = {
                      key: noteKey,
                      content: htmlContent,
                      timestamp: Date.now(),
                    };
                    chrome.storage.local.set({ pendingNoteDraft: draftData }, () => {
                      // Open full-screen note view with a temp ID
                      const tempId = 'temp-' + Date.now();
                      const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${tempId}`);

                      if (chrome.runtime?.sendMessage) {
                        chrome.runtime.sendMessage({ action: 'open_tab', url }, (response: any) => {
                          if (chrome.runtime.lastError) {
                            if (chrome.tabs?.create) {
                              chrome.tabs.create({ url });
                            } else {
                              window.open(url, '_blank');
                            }
                          }
                        });
                      } else if (chrome.tabs?.create) {
                        chrome.tabs.create({ url });
                      } else {
                        window.open(url, '_blank');
                      }
                    });
                  }}
                  title="Go to cmdOS Home">
                  <img src={taskLabsLogo} alt="Cmdos" className="h-7 w-auto" />
                  <span className="text-lg font-semibold text-neutral-800 dark:text-white tracking-tight">cmdOS</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Area */}
          <div className="flex-1 flex min-h-0 relative">
            {/* Vertical Spacer for Focus Mode - OUTSIDE the bordered area */}
            {isFullScreenMode && <div className="h-20 flex-shrink-0" />}

            {/* Wrapper for Title + Content: Handles Layout */}
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
                      {saveStatus !== 'saving' && isDirty && (
                        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap opacity-70">
                          Saving...
                        </span>
                      )}
                      {saveStatus === 'saved' && !isDirty && (
                        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                          {lastSavedMessage || 'Auto-saved'} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                        </span>
                      )}
                    </>
                  )}
                </div>

                <button
                  ref={closeBtnRef}
                  onClick={handleWorkspaceBackclick}
                  onKeyDown={e => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      if (fullscreenBtnRef.current) {
                        fullscreenBtnRef.current.focus();
                      } else {
                        toolbarBtnRef.current?.focus();
                      }
                    }
                  }}
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
                        const newVal = e.target.value;
                        if (!noteKey && newVal && !activeSnippetId) {
                          
                        }
                        setNoteKey(newVal);
                        isUserKeyManuallySetRef.current = true;
                        hasUserModifiedRef.current = true;
                      }}
                      onFocus={() => {
                        isTitleFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        isTitleFocusedRef.current = false;
                      }}
                      onClick={() => {
                        // Ensure focus is set when user clicks
                        isTitleFocusedRef.current = true;
                        titleInputRef.current?.focus();
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          isTitleFocusedRef.current = false;
                          editorRef.current?.focus();
                        } else if (e.key === 'ArrowRight') {
                          if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
                            e.preventDefault();
                            isTitleFocusedRef.current = false;
                            hotkeyButtonRef.current?.focus();
                          }
                        }
                      }}
                      type="text"
                      placeholder={titlePlaceholder}
                      style={{ pointerEvents: 'auto' }}
                      className={`w-full text-[28px] font-semibold text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isFullScreenMode ? 'pl-8' : ''}`}
                    />
                  </div>

                  {/* Hotkey Select moved to Right Column */}
                  <div className="flex-1" /> {/* Spacer to keep right-side actions on the right */}
                </div>

                {/* Editor Area - Vertical Borders added here */}
                <div
                  className={`flex-1 min-h-0 font-sans overflow-hidden flex flex-col text-neutral-900 dark:text-white ${isFullScreenMode ? 'pl-8 pr-6 pt-1' : 'pb-3'}`}>
                  <div className="flex-1 min-h-0 overflow-hidden relative" ref={quillWrapperRef}>
                    <QuillEditor
                      value={noteContent}
                      onChange={content => {
                        if (editorRef.current && editorRef.current.hasFocus()) {
                          hasUserModifiedRef.current = true;
                        }
                        setNoteContent(content);
                      }}
                      placeholder="Start writing your note..."
                      readOnly={false}
                      onUpArrowAtStart={() => titleInputRef.current?.focus()}
                      ref={editorRef}
                      showToolbar={showToolbar}
                      toolbarSelector="#rich-editor-toolbar"
                      isFocusMode={isFullScreenMode}
                      onCreateNew={handleCreateNewNote}
                      onDelete={!isCreatingNew && selectedSnippet ? handleShowDelete : undefined}
                    />
                  </div>

                </div>
              </div>
            </div>

            {/* Sidebar Divider Line with Floating Collapse Toggle Button Centered */}
            {/* INTENTIONALLY DISABLED/COMMENTED OUT COLLAPSE FUNCTIONALITY FOR FUTURE USE:
            <div className="relative flex-shrink-0 w-px bg-transparent">
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
            */}

            {/* RIGHT COLUMN - Metadata & Settings */}
            <div
              className={`flex-shrink-0 flex flex-col bg-[var(--color-editorBg)] border-l border-black/10 dark:border-white/10 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[280px]'}`}
              style={{
                width: isSidebarCollapsed ? '0px' : '280px',
                minWidth: isSidebarCollapsed ? '0px' : '280px',
                boxSizing: 'border-box'
              }}
            >
              {/* Sidebar Content — hidden when collapsed */}
              {!isSidebarCollapsed && (
                <div className="flex-1 px-4 py-4 flex flex-col gap-3">
                  {/* Note Options Section */}
                  <div className="space-y-3">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-[10px] font-semibold text-neutral-400 dark:text-white/40 uppercase tracking-wider px-1 pb-2 pt-1 flex items-center gap-1.5 w-full">
                        <span>Note Properties</span>
                        <span className="text-[10px] text-neutral-400/80 dark:text-white/30 font-normal normal-case tracking-normal">(opt)</span>
                      </h3>
                      {/* Folder Picker */}
                      <div className="relative">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setIsLocationPickerOpen(prev => !prev); }}
                          disabled={saveStatus === 'saving'}
                          className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-white/60 min-w-0 flex-1 pr-2">
                            <FaFolder className="text-[var(--color-iconDefault)] flex-shrink-0" />
                            <span className="truncate" title={snippetBreadCrum?.folder_name || snippetBreadCrum?.workspace_name || "Folders"}>
                              {snippetBreadCrum?.folder_name || snippetBreadCrum?.workspace_name || "Folders"}
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
                          <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-white/60">
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
                                    className="flex-1 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-black/20 dark:focus:border-white/20 text-neutral-900 dark:text-white placeholder-[var(--color-textPlaceholder)]"
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
                        onClick={handleToggleFavorite}
                        className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-white/60">
                          <FiStar className="text-[var(--color-iconDefault)]" />
                          <span>Favorite</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <FiStar className={`w-[18px] h-[18px] transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--color-iconDefault)] group-hover:text-neutral-600 dark:group-hover:text-white/70'}`} />
                        </div>
                      </button>


                    </div>
                  </div>

                  {/* Subtle Divider between Note Properties and Reminder & Schedule */}
                  <div className="mx-2 my-2 border-b border-black/10 dark:border-white/10 opacity-60" />

                  {/* Reminder & Schedule Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[10px] font-semibold text-neutral-400 dark:text-white/40 uppercase tracking-wider px-1 pb-1 pt-1 flex items-center">
                        <span>Reminder & Schedule</span>
                      </h3>
                      {/* Segmented Control */}
                      <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => { setIsRecurring(false); setIsAnytime(false); setIsTimeDropdownOpen(false); }}
                          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${!isRecurring ? 'bg-white shadow-sm dark:bg-white/10 text-neutral-900 dark:text-white/80' : 'text-neutral-500 dark:text-white/40 hover:text-neutral-900 dark:hover:text-white/70'}`}
                        >
                          One-Time
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsRecurring(true); setIsAnytime(true); setIsTimeDropdownOpen(true); setIsTimePickerOpen(false); }}
                          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${isRecurring ? 'bg-white shadow-sm dark:bg-white/10 text-neutral-900 dark:text-white/80' : 'text-neutral-500 dark:text-white/40 hover:text-neutral-900 dark:hover:text-white/70'}`}
                        >
                          Recurring
                        </button>
                      </div>

                      {/* Date & Time Selectors aligned row-wise */}
                      <div className="flex flex-col gap-1">
                        <div className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                          if (isRecurring) {
                            setIsTimeDropdownOpen(prev => !prev);
                            setIsTimePickerOpen(false);
                          } else {
                            setIsTimePickerOpen(prev => !prev);
                            setIsTimeDropdownOpen(false);
                          }
                        }}>
                          <div className="flex items-center gap-3">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-iconDefault)]"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span className="text-sm font-medium text-neutral-600 dark:text-white/60">Time</span>
                          </div>

                          <div className="flex items-center" onClick={(e) => {
                            if (!isAnytime) {
                              e.stopPropagation();
                              setIsTimePickerOpen(prev => !prev);
                              setIsTimeDropdownOpen(false);
                            }
                          }}>
                            {(isRecurring && isAnytime) ? (
                              <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Anytime</span>
                            ) : (
                              <div className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                                <InlineTimeInput
                                  value={reminderTime}
                                  onChange={setReminderTime}
                                />
                              </div>
                            )}
                          </div>

                          {(isRecurring && isTimeDropdownOpen) && (
                            <div ref={timePopupRef} className="absolute left-0 top-full mt-2 w-[180px] rounded-xl shadow-2xl z-[150] bg-[#1B1B1C] border border-[#2D2E30] overflow-hidden py-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsAnytime(true); setIsTimeDropdownOpen(false); setIsTimePickerOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left hover:bg-white/5 text-neutral-300 hover:text-white`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-iconDefault)]"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span className="font-medium">Anytime of the day</span>
                              </button>
                              <div className="h-px bg-[#2D2E30] my-0.5"></div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsAnytime(false); setIsTimeDropdownOpen(false); setIsTimePickerOpen(true); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left hover:bg-white/5 text-neutral-300 hover:text-white`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-iconDefault)]"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span className="font-medium">Specific Time</span>
                              </button>
                            </div>
                          )}

                          <CustomTimePicker
                            value={reminderTime}
                            onChange={setReminderTime}
                            isOpen={isTimePickerOpen && (!isRecurring || !isAnytime)}
                            setIsOpen={setIsTimePickerOpen}
                          />
                        </div>
                        <div
                          className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={(e) => {
                            const input = e.currentTarget.querySelector('input[type="date"]');
                            if (input) {
                              try {
                                (input as HTMLInputElement).showPicker();
                              } catch (err) {
                                (input as HTMLInputElement).focus();
                              }
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-iconDefault)]"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span className="text-sm font-medium text-neutral-600 dark:text-white/60">Date</span>
                          </div>
                          <input
                            type="date"
                            value={reminderDate}
                            onChange={(e) => setReminderDate(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-none outline-none text-sm text-neutral-500 dark:text-white/50 p-0 text-right w-[120px] focus:ring-0 cursor-pointer dark:color-scheme-dark"
                          />
                        </div>
                        {isRecurring && (
                          <div
                            className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            ref={cyclePopupRef}
                            onClick={() => setIsCycleDropdownOpen(prev => !prev)}
                          >
                            <span className="text-sm font-medium text-neutral-600 dark:text-white/60">Cycle</span>
                            <button
                              type="button"
                              className="text-sm text-neutral-500 dark:text-white/50 font-medium hover:text-neutral-800 dark:hover:text-white/80 transition-colors flex items-center gap-1.5"
                            >
                              <span className="capitalize">{recurringCycle || 'daily'}</span>
                              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-3.5 h-3.5 opacity-60" height="1em" width="1em"><path d="M16.293 9.293 12 13.586 7.707 9.293l-1.414 1.414L12 16.414l5.707-5.707z"></path></svg>
                            </button>
                            {isCycleDropdownOpen && (
                              <div className="absolute right-0 top-full mt-1 w-[120px] bg-[#141414] border border-white/10 rounded-xl p-1 shadow-lg z-50 flex flex-col gap-0.5">
                                {['daily', 'weekly', 'monthly'].map((cycle) => (
                                  <button
                                    key={cycle}
                                    type="button"
                                    onClick={() => {
                                      setRecurringCycle(cycle);
                                      setIsCycleDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors capitalize ${recurringCycle === cycle ? 'bg-white/15 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                                  >
                                    {cycle}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleCreateTodoFromNote}
                          disabled={todoStatus === 'creating'}
                          className={`mt-3 ml-auto w-fit flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium rounded-lg border transition-all ${
                            todoStatus === 'success'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default'
                              : todoStatus === 'creating'
                                ? 'border-white/5 bg-white/5 text-neutral-500 cursor-not-allowed opacity-70'
                                : 'border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-neutral-600 dark:text-white/50 hover:text-neutral-900 dark:hover:text-white/80 cursor-pointer'
                          }`}
                        >
                          {todoStatus === 'creating' ? (
                            <>
                              <svg className="animate-spin text-neutral-500" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                              <span>Creating…</span>
                            </>
                          ) : todoStatus === 'success' ? (
                            <>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400"><polyline points="20 6 9 17 4 12" /></svg>
                              <span>Todo Created!</span>
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-iconDefault)]"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"/></svg>
                              <span>Create Todo</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer - Integrated inside Content Container */}
        <div className="relative z-50 mt-auto flex-shrink-0 border-t border-black/10 dark:border-white/10 bg-[var(--color-editorBg)] rounded-b-xl">
          <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
            {/* Left: Back Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  
                  checkAndCloseEditor();
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  Esc
                </span>
              </button>
            </div>

            {/* Center: Formatting Toolbar */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <div id="rich-editor-toolbar" className="flex items-center justify-center empty:hidden !border-none !p-0"></div>
              {/* Create New Floating Button */}
              {!!(selectedSnippet?.id || selectedSnippet?.snippet_id || activeSnippetId) && (
                <div className="flex items-center">
                  <button
                    onClick={handleCreateNewNote}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95 border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white">
                    Create new
                    <span className="flex items-center gap-0.5 text-[8px] font-medium opacity-90 ml-1">
                      <span className="rounded border px-1 py-0.5 border-white/20 bg-neutral-700">
                        {isMac ? '⌘' : 'Ctrl'}
                      </span>
                      <span>+</span>
                      <span className="rounded border px-1 py-0.5 border-white/20 bg-neutral-700">Enter</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Expand/Compress Button - Hidden in full-screen mode (when onBack is provided) */}
              {!onBack && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => dispatch(toggleFocusMode(!isFocusMode))}
                    className="flex items-center gap-2 rounded-md border border-[#e2e0ef] dark:border-white/10 bg-[var(--color-containerBg)] px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-200 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                    title={isFocusMode ? 'Minimize (F11)' : 'Expand (F11)'}>
                    {isFocusMode ? <FaCompress size={10} /> : <FaExpand size={10} />}
                    <span>{isFocusMode ? 'Minimize (F11)' : 'Expand (F11)'}</span>
                  </button>
                </div>
              )}
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
        title={noteKey ? `Delete "${noteKey}"?` : 'Delete this note?'}
        description="Are you sure you want to delete this note? This action cannot be undone."
        zIndex={isFullScreenMode ? 200000 : 50}
      />

      {/* Unsaved Changes Dialog — shown when Escape/Back is pressed with unsaved content */}
      <UnsavedChangesDialog
        source="RichEditor"
        isOpen={showUnsavedDialog}
        zIndex={isFullScreenMode ? 200000 : 9999}
        onClose={() => {
          
          setShowUnsavedDialog(false);
        }}
        onSave={async () => {
          
          // Clear any pending debounce timer and trigger save immediately
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          // Manually call debounceSave to flush pending changes (it will skip if nothing changed)
          debounceSave();
          // Small wait to allow the save to initiate before navigating away
          await new Promise(resolve => setTimeout(resolve, 100));
          
          setShowUnsavedDialog(false);
          closeEditor();
        }}
        onDiscard={() => {
          
          setShowUnsavedDialog(false);
          closeEditor();
        }}
      />
    </div>
  );
};

export const RichTextEditor = React.memo(RichTextEditorComponent);
