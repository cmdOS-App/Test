import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaChevronRight,
  FaSave,
  FaTimes,
  FaArrowRight,
  FaLongArrowAltRight,
  FaCheckCircle,
  FaCheck,
  FaAt,
  FaFileAlt,
  FaPen,
  FaLink,
  FaSearch,
  FaHistory,
  FaBookmark,
  FaFolder,
  FaEllipsisV,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaRobot,
  FaList,
  FaCopy,
  FaDirections,
  FaLayerGroup,
} from 'react-icons/fa';
import { FiStar, FiChevronLeft, FiChevronRight, FiTag } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { formatDistanceToNow } from 'date-fns';
import type { AppDispatch, RootState } from '../../../../Redux/store';
import {
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectSnippetBreadCrum,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setIsCreatingNewItem,
  setSnippetBreadCrum,
  queueNotification,
  selectIsMac,
  setSelectedTeam,
  setShowTodosView,
  setTodoCreatePrefill,
} from '../../../../Redux/AllData/uiStateSlice';
import { optimisticAddSnippet, optimisticUpdateSnippet, selectAllData, transformApiResponse } from '../../../../Redux/AllData/allDataSlice';
import { fetchWorkspacesThunk, selectWorkspacesByTeam } from '../../../../Redux/Workspaces/workspaceSlice';

import SaveDestinationPicker from './SaveDestinationPicker';
import { updateLocalHotkey, updateLocalShortcut } from '../../../../utils/shortcutHotkeyUtils';
import {
  updateSnippetShortcut,
  updateSnippetHotkey,
  updateSnippetRealtime,
  createSnippet,
  getOrgTags,
  createTagInOrg,
  convertSnippetToTodo,
  type NewSnippet,
} from '../../../../Apis/features/snippetApi';
import type { Workspace, Folder, Snippet, Tag } from '../../../../modals/interfaces';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import UnsavedChangesDialog from '../Modals/UnsavedChangesDialog';
import { clsx } from 'clsx';
import { formatSaveDestinationPath, getDestinationPathDetails } from '../../utils/pathUtils';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../Shared/utils/hotkeyUtils';
import { addFavorite, deleteFavorite, getFavorites } from '../../../../Apis/services/favoritesApi';
import HotkeyAssignButton from './HotkeyAssignButton';
import { getUserId, getAll } from '../../../../Apis/core/api';
import { useHotkeyOverwrite } from '../../hooks/useHotkeyOverwrite';
import { useAutoSave } from '../../hooks/useAutoSave';

interface LinkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: Snippet | null;
  prefill?: Snippet | null;
  reload: () => void; // Kept for compatibility, though we use optimistic updates
  onDirtyChange?: (isDirty: boolean) => void; // called when unsaved state changes
}

type BrowserTab = {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  windowId: number;
  active: boolean;
  highlighted?: boolean;
  index?: number;
};

type SelectedLink = {
  id: string;
  url: string;
  name: string;
  favIconUrl?: string;
  windowId?: number;
  source: 'tab' | 'custom' | 'note' | 'link';
  originalData?: any;
};

// Content bar tab type
type ContentTab = 'Current Tabs' | 'Selected tabs' | 'All saved files';

// Tab button component (from BuildView)
const TabButton = ({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ComponentType<any>;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 text-sm font-semibold transition-all relative focus:outline-none focus:ring-0 border-none outline-none flex items-center gap-2 ${
      active
        ? 'text-[#333333] dark:text-neutral-200 font-bold'
        : 'text-[#93a1a1] hover:text-[#586e75] dark:text-neutral-400 dark:hover:text-neutral-200'
    }`}>
    {Icon && (
      <Icon
        size={14}
        className={active ? 'text-[#333333] dark:text-neutral-200' : 'text-[#93a1a1] dark:text-neutral-400'}
      />
    )}
    <span>{label}</span>
    {active && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#333333] dark:bg-neutral-200 rounded-t-full shadow-[0_-1px_4px_rgba(0,0,0,0.1)]" />
    )}
  </button>
);

interface HighlightedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Pass any specific props if needed
}

const HighlightedInput = forwardRef<HTMLInputElement, HighlightedInputProps>(
  ({ className = '', value, onChange, onScroll, ...props }, ref) => {
    const mirrorRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Expose the input ref to the parent
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
      if (mirrorRef.current && inputRef.current) {
        mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
      if (onScroll) onScroll(e);
    };

    const renderContent = () => {
      const valStr = String(value || '');
      if (!valStr) return null; // If empty, mirror is empty.

      // Split by {query} or [query]
      const parts = valStr.split(/(\{query\}|\[query\])/gi);
      return parts.map((part, i) => {
        if (/^\{query\}$/i.test(part) || /^\[query\]$/i.test(part)) {
          return (
            <span key={i} className="text-[#3b82f6] dark:text-[#60a5fa] font-semibold">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    };

    return (
      <div className={`relative ${className?.includes('w-full') ? 'w-full' : ''}`} style={{ isolation: 'isolate' }}>
        {/* Mirror div */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={className}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'transparent',
            borderColor: 'transparent',
            boxShadow: 'none',
            // Allow text to be visible
            color: 'inherit',
            display: 'flex', // To match input vertical alignment usually
            alignItems: 'center',
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}>
          {renderContent()}
        </div>

        {/* Actual Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={onChange}
          onScroll={handleScroll}
          className={`${className} !text-transparent caret-neutral-800 dark:caret-white`}
          {...props}
          style={{
            // If value is empty, we want placeholder to be visible.
            // But color:transparent hides it.
            // We can conditionally set color if empty vs not.
            color: !value ? undefined : 'transparent',
            ...(props.style || {}),
          }}
        />
      </div>
    );
  },
);
HighlightedInput.displayName = 'HighlightedInput';

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
    <div className="flex items-center text-white inline-time-input" onClick={e => e.stopPropagation()}>
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


const CustomTimePicker: React.FC<{
  value: string;
  onChange: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}> = ({ value, onChange, isOpen, setIsOpen }) => {
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
    <div ref={popupRef} className="absolute right-0 bottom-full mb-2 bg-[#141414] border border-white/10 rounded-xl p-2 shadow-2xl z-[60] flex gap-2 text-white font-sans" onClick={e => e.stopPropagation()}>
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

const LinkEditModal: React.FC<LinkEditModalProps> = ({
  isOpen,
  onClose,
  snippet: initialSnippetProp,
  prefill,
  reload,
  onDirtyChange,
}) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('session-sidebar-portal-target'));
  }, [isOpen]);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localSnippetOverride, setLocalSnippetOverride] = useState<Snippet | null>(null);
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const hasUserModifiedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setLocalSnippetOverride(null);
      setIsForceCreateNew(false);
      hasPrefilledEditModeRef.current = false;
      hasUserModifiedRef.current = false;
    } else {
      hasUserModifiedRef.current = false;
      if (!initialSnippetProp) {
        setIsFav(false);
      }
    }
  }, [isOpen, initialSnippetProp]);

  const allTeams = useSelector(selectAllData);

  const resolvedActiveSessionSnippet = useMemo(() => {
    if (!activeSessionId || !allTeams) return null;
    for (const team of allTeams) {
      for (const ws of team.workspaces || []) {
        const found = ws.workspace_snippets?.find(
          (s: any) => String(s.id) === String(activeSessionId) || String(s.snippet_id) === String(activeSessionId)
        );
        if (found) return found;
        for (const f of ws.folders || []) {
          const foundInFolder = f.snippets?.find(
            (s: any) => String(s.id) === String(activeSessionId) || String(s.snippet_id) === String(activeSessionId)
          );
          if (foundInFolder) return foundInFolder;
        }
      }
    }
    return null;
  }, [activeSessionId, allTeams]);

  const initialSnippet = isForceCreateNew ? null : localSnippetOverride || initialSnippetProp || resolvedActiveSessionSnippet;
  const snippetId = initialSnippet?.id || (initialSnippet as any)?.snippet_id || activeSessionId || null;
  const isMac = useSelector(selectIsMac);
  const dispatch = useDispatch<AppDispatch>();

  // Get personal workspaces
  const personalWorkspaces = useMemo(() => {
    if (!allTeams) return [];
    // Use is_personal_space flag matching New Tab implementation, with name fallback
    const privateTeam = allTeams.find(team => team.is_personal_space === true || team.team_name === 'Personal Space');
    return privateTeam?.workspaces || [];
  }, [allTeams]);

  // const triggerToast = useToast(); // Removed toast usage

  // Determine mode based on whether a snippet is passed
  const isEditMode = !!initialSnippet;

  const selectedTeam = useSelector(selectSelectedTeam);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const snippetBreadCrum = useSelector(selectSnippetBreadCrum);

  // Determine Organization Team
  const orgTeam = useMemo(() => {
    if (selectedTeam && selectedTeam.is_personal_space !== true) {
      return selectedTeam;
    }
    return allTeams?.find(t => t.is_personal_space !== true) || null;
  }, [selectedTeam, allTeams]);

  const orgTeamId = orgTeam?.team_id || '';
  const workspacesMetadata = useSelector((state: RootState) => selectWorkspacesByTeam(state, orgTeamId));

  const hasInitializedPrefill = useRef(false);
  const hasFetchedWorkspaces = useRef(false);

  // Ensure workspace metadata is fetched
  useEffect(() => {
    if (orgTeamId && workspacesMetadata.length === 0 && !hasFetchedWorkspaces.current) {
      dispatch(fetchWorkspacesThunk(orgTeamId));
      hasFetchedWorkspaces.current = true;
    }
  }, [dispatch, orgTeamId, workspacesMetadata.length]);

  const [title, setTitle] = useState('');
  const [tabsByWindow, setTabsByWindow] = useState<Record<number, BrowserTab[]>>({});
  const [hasFetchedTabs, setHasFetchedTabs] = useState(false);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [collapsedWindows, setCollapsedWindows] = useState<Record<number, boolean>>({});
  const [selectedLinks, setSelectedLinks] = useState<SelectedLink[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const hasPrefilledEditModeRef = useRef(false);

  useEffect(() => {
    const trimmedName = sessionName.trim();
    if (!trimmedName) {
      setSessionError(null);
      return;
    }

    // 1. Check duplicate session names in all workspace snippets and folder snippets
    let exists = false;
    if (allTeams) {
      for (const team of allTeams) {
        for (const ws of team.workspaces || []) {
          if ((ws.workspace_snippets || []).some((s: any) => s.key?.trim().toLowerCase() === trimmedName.toLowerCase())) {
            exists = true;
            break;
          }
          for (const f of ws.folders || []) {
            if ((f.snippets || []).some((s: any) => s.key?.trim().toLowerCase() === trimmedName.toLowerCase())) {
              exists = true;
              break;
            }
          }
          if (exists) break;
        }
        if (exists) break;
      }
    }

    if (exists) {
      setSessionError('A session with this name already exists.');
      return;
    }

    // 2. Check duplicate session names in active sessions stored in local storage
    const checkActiveSessions = async () => {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('active_sessions', (res: any) => {
          const activeSessions = res.active_sessions || [];
          const duplicateActive = activeSessions.some((s: any) => s.sessionName?.toLowerCase() === trimmedName.toLowerCase());
          if (duplicateActive) {
            setSessionError('A session with this name is currently active.');
          } else {
            setSessionError(null);
          }
        });
      } else {
        setSessionError(null);
      }
    };

    checkActiveSessions();
  }, [sessionName, allTeams]);

  const lastSyncTimeRef = useRef<string | null>(null);
  const [conflictModalData, setConflictModalData] = useState<{
    cloudSnippet: any;
    localData: {
      title: string;
      selectedLinks: SelectedLink[];
    };
  } | null>(null);

  useEffect(() => {
    if (initialSnippet && initialSnippet.updated_at) {
      lastSyncTimeRef.current = initialSnippet.updated_at;
    }
  }, [initialSnippet]);

  const { clearConflictHotkey, clearConflictShortcut } = useHotkeyOverwrite();

  const handleOverwriteHotkey = async (conflictId: string, newValue: string) => {
    setSaveStatus('saving');
    try {
      await clearConflictHotkey(conflictId);
      await handleHotkeyChange(newValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      // triggerToast('Overwrite failed', 'error');
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
      // triggerToast('Overwrite failed', 'error');
    } finally {
      setSaveStatus('idle');
    }
  };

  const [isTitleManuallyModified, setIsTitleManuallyModified] = useState(false);

  // Session mode: pre-fill title from storage if opened via session
  useEffect(() => {
    if (!isOpen || isEditMode || title) return;
    chrome.storage.local.get('pending_session_prefill', (result) => {
      const prefill = result.pending_session_prefill;
      if (prefill?.title) {
        setTitle(prefill.title);
        setIsTitleManuallyModified(true);
        if (prefill.sessionId) {
          setActiveSessionId(prefill.sessionId);
        }
        // Clear so it doesn't re-apply on re-open
        chrome.storage.local.remove('pending_session_prefill');
      }
    });
  }, [isOpen, isEditMode, title]);

  // Fetch current window ID on mount/open
  useEffect(() => {
    if (!isOpen) return;
    const chromeAny = (window as any).chrome;
    if (chromeAny?.windows?.getCurrent) {
      chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
        if (currentWindow?.id) {
          setCurrentWindowId(currentWindow.id);
        }
      });
    }
  }, [isOpen]);

  // Load active session for current window on mount (to persist session mode even if unmounted)
  useEffect(() => {
    if (!isOpen || isEditMode || activeSessionId) return;
    
    const checkCurrentWindowSession = async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.windows?.getCurrent) return;
      
      chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
        if (!currentWindow?.id) return;
        
        chromeAny.storage.local.get('active_sessions', (result: any) => {
          const sessions = result.active_sessions || [];
          const matchedSession = sessions.find((s: any) => s.windowId === currentWindow.id);
          if (matchedSession) {
            
            setTitle(matchedSession.sessionName);
            setActiveSessionId(matchedSession.sessionId);
            setIsTitleManuallyModified(true);
          }
        });
      });
    };
    
    checkCurrentWindowSession();
  }, [isOpen, isEditMode, activeSessionId]);

  // Load already-captured links from storage on session start/refresh
  useEffect(() => {
    
    if (!activeSessionId) return;

    chrome.storage.local.get('active_sessions', (result) => {
      const data = result.active_sessions || [];
      
      const session = data.find((s: any) => s.sessionId === activeSessionId);
      
      if (session) {
        if (Array.isArray(session.capturedUrls) && Array.isArray(session.capturedNames)) {
          const preloaded: SelectedLink[] = session.capturedUrls.map((url: string, index: number) => ({
            id: String(Date.now() + index + Math.random()),
            name: session.capturedNames[index] || url,
            url: url,
            source: 'tab',
            favIconUrl: getFaviconUrl(getHostname(url))
          }));
          setSelectedLinks(prev => {
            if (prev.length === 0) return preloaded;
            return prev;
          });
        }

        // Restore save destination to Redux
        if (session.teamId && allTeams && allTeams.length > 0) {
          const team = allTeams.find((t: any) => t.team_id === session.teamId);
          if (team) {
            dispatch(setSelectedTeam(team));
            if (session.workspaceId) {
              const ws = team.workspaces?.find((w: any) => w.workspace_id === session.workspaceId);
              if (ws) {
                dispatch(setSelectedWorkspace(ws));
                if (session.folderId) {
                  const folder = ws.folders?.find((f: any) => f.folder_id === session.folderId);
                  if (folder) {
                    dispatch(setSelectedFolder(folder));
                  }
                }
              }
            }
          }
        }
      }
    });
  }, [activeSessionId, allTeams, dispatch]);

  // Listen for real-time session tab captures from the background script
  useEffect(() => {
    
    const handleMessage = (message: any) => {
      if (message.action === 'session_tab_captured') {
        
        if (activeSessionId && message.sessionId === activeSessionId) {
          

          const newLink: SelectedLink = {
            id: String(Date.now() + Math.random()),
            name: message.title || message.url,
            url: message.url,
            source: 'tab',
            favIconUrl: message.favIconUrl || getFaviconUrl(getHostname(message.url))
          };

          setSelectedLinks(prev => {
            // Avoid duplicate additions
            if (prev.some(l => l.url === message.url)) return prev;
            return [...prev, newLink];
          });
        } else {
          
        }
      }
    };

    const chromeAny = (window as any).chrome;
    if (chromeAny?.runtime?.onMessage) {
      chromeAny.runtime.onMessage.addListener(handleMessage);
      return () => chromeAny.runtime.onMessage.removeListener(handleMessage);
    }
    return () => {};
  }, [activeSessionId]);

  const getBackupKey = useCallback(() => {
    const currentSnippetId = (initialSnippet as any)?.id || (initialSnippet as any)?.snippet_id;
    return currentSnippetId 
      ? `unsaved_session_backup_${currentSnippetId}` 
      : 'unsaved_session_backup_new';
  }, [initialSnippet]);

  const clearStashedBackup = useCallback(() => {
    localStorage.removeItem(getBackupKey());
  }, [getBackupKey]);





  // Handle prefill data (e.g. from history/bookmarks/session)
  useEffect(() => {
    if (isOpen && !isEditMode && prefill && !hasInitializedPrefill.current) {
      setTitle(prefill.key || '');
      const prefillId = prefill.id || (prefill as any).snippet_id;
      if (prefillId && !prefill.searchtags) {
        chrome.storage.local.get('alts_searchtags_backup', result => {
          const backup = result.alts_searchtags_backup || {};
          if (backup[prefillId]) {
            // Note: Since we are in the outer parent state for 'prefill', we can't directly 
            // set selectedTag here. The real mapping happens in the internal useEffect around line 1150.
            // But we must remove setSearchtags since the state is gone.
          }
        });
      }

      if (prefill.category === 'TabGroup') {
        if (prefillId) {
          setActiveSessionId(prefillId);
        }
      } else {
        setSelectedLinks([
          {
            id: prefillId || `temp-${Date.now()}`,
            url: typeof prefill.value === 'string' ? prefill.value : '',
            name: prefill.key || '',
            source: 'link',
          },
        ]);
      }
      hasInitializedPrefill.current = true;
    } else if (!isOpen) {
      hasInitializedPrefill.current = false;
    }
  }, [isOpen, isEditMode, prefill]);

  const [footerStatus, setFooterStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const [isFav, setIsFav] = useState(false);
  const [userId, setUserId] = useState('');
  const footerStatusTimeoutRef = useRef<number | null>(null);
  const justSavedRef = useRef(false);

  const showFooterStatus = (type: 'idle' | 'saving' | 'success' | 'error', message: string, duration = 3000) => {
    if (footerStatusTimeoutRef.current) {
      window.clearTimeout(footerStatusTimeoutRef.current);
    }
    setFooterStatus({ type, message });

    if (type !== 'idle' && type !== 'saving') {
      footerStatusTimeoutRef.current = window.setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, duration);
    }
  };

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isAltEnterPickerOpen, setIsAltEnterPickerOpen] = useState(false);
  const [isCustomLinkFormOpen, setIsCustomLinkFormOpen] = useState(false);
  const [isLeftCustomLinkFormOpen, setIsLeftCustomLinkFormOpen] = useState(false);
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [customLinkName, setCustomLinkName] = useState('');
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);

  // Hotkey assignment state (user: hotkey key-pair format)
  const [pendingHotkey, setPendingHotkey] = useState<string>('');

  // Reminder & Schedule states
  const [isRecurring, setIsRecurring] = useState(false);
  const [isAnytime, setIsAnytime] = useState(false);
  const [recurringCycle, setRecurringCycle] = useState<string | null>('daily');
  const [reminderDate, setReminderDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [reminderTime, setReminderTime] = useState<string>('09:00');
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isTimeModeDropdownOpen, setIsTimeModeDropdownOpen] = useState(false);
  const [linkTodoStatus, setLinkTodoStatus] = useState<'idle' | 'creating' | 'success'>('idle');
  const [pendingTodoData, setPendingTodoData] = useState<{
    deadlineVal: string;
    isRecurring: boolean;
    recurringCycle: string | null;
    isAnytime: boolean;
    taskTitle: string;
    tempId: string;
  } | null>(null);
  const cyclePopupRef = useRef<HTMLDivElement | null>(null);
  const timeDropdownRef = useRef<HTMLDivElement | null>(null);
  const sessionPopupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cyclePopupRef.current && !cyclePopupRef.current.contains(event.target as Node)) {
        setIsCycleDropdownOpen(false);
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setIsTimeModeDropdownOpen(false);
      }
      if (sessionPopupRef.current && !sessionPopupRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.session-btn')) {
        setSessionDialogOpen(false);
      }
      if (event.target instanceof Element && !event.target.closest('.three-dots-container')) {
        setActiveMenuLinkId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // History and Bookmarks Search
  const [linkSuggestions, setLinkSuggestions] = useState<
    Array<{ title: string; url: string; source: 'history' | 'bookmark' }>
  >([]);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const favButtonRef = useRef<HTMLButtonElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const customLinkUrlRef = useRef<HTMLInputElement>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>('');
  const editingUrlInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuLinkId, setActiveMenuLinkId] = useState<string | null>(null);

  const tabItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAutoSelectedRef = useRef(false);

  // Link edit popup state
  const [editingPopupLinkId, setEditingPopupLinkId] = useState<string | null>(null);
  const [editingUrlParts, setEditingUrlParts] = useState<{
    protocol: string;
    domain: string;
    paths: string[];
    search: string;
  } | null>(null);

  // Local state for the URL input to allow editing
  const [localUrlValue, setLocalUrlValue] = useState('');
  // Local state for the link name (display name) editing
  const [editingLinkName, setEditingLinkName] = useState('');
  const urlNameInputRef = useRef<HTMLInputElement>(null);
  const linkNameInputRef = useRef<HTMLInputElement>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);

  const parseUrlParts = useCallback((url: string) => {
    try {
      let normalized = url.trim();
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
      }
      const u = new URL(normalized);
      const paths = u.pathname.split('/').filter(Boolean);
      const cleanDomain = u.host.replace(/^www\./i, '');
      return { protocol: u.protocol.replace(':', ''), domain: cleanDomain, paths, search: u.search };
    } catch {
      return null;
    }
  }, []);

  const assembleUrl = useCallback((parts: { protocol: string; domain: string; paths: string[]; search: string }) => {
    const pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
    const protocol = parts.protocol || 'https';
    return `${protocol}://${parts.domain}${pathStr}${parts.search}`;
  }, []);

  const duplicateLink = useCallback((link: SelectedLink) => {
    setSelectedLinks(prev => {
      const newId = `duplicate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return [
        ...prev,
        {
          ...link,
          id: newId,
          name: `${link.name} (Copy)`
        }
      ];
    });
  }, []);

  const openLinkEditPopup = useCallback(
    (link: SelectedLink) => {
      const parts = parseUrlParts(link.url);
      setEditingPopupLinkId(link.id);
      setEditingUrlParts(parts);
      setLocalUrlValue(link.url.replace(/^https?:\/\/(www\.)?/i, ''));
      setEditingLinkName(link.name || '');
    },
    [parseUrlParts],
  );

  const closeLinkEditPopup = useCallback(() => {
    setEditingPopupLinkId(null);
    setEditingUrlParts(null);
    setLocalUrlValue('');
    setEditingLinkName('');
  }, []);

  const saveLinkEditPopup = useCallback(() => {
    if (!editingPopupLinkId) return;
    let newUrl = editingUrlParts ? assembleUrl(editingUrlParts) : localUrlValue;
    
    newUrl = newUrl.trim();
    if (newUrl && !/^https?:\/\//i.test(newUrl)) {
      newUrl = `https://${newUrl}`;
    }

    setSelectedLinks(prev =>
      prev.map(link =>
        link.id === editingPopupLinkId ? { ...link, url: newUrl, name: editingLinkName || link.name } : link,
      ),
    );
    closeLinkEditPopup();
  }, [editingPopupLinkId, editingUrlParts, editingLinkName, localUrlValue, assembleUrl, closeLinkEditPopup]);

  // Track which path input is focused for inserting variables
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedPathIndex, setFocusedPathIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'domain' | 'path' | null>(null);
  const [showPathQueryDropdown, setShowPathQueryDropdown] = useState(false);

  // Sync editingUrlParts to localUrlValue when parts change (if not editing manualy)
  useEffect(() => {
    if (!editingUrlParts) return;
    if (document.activeElement === urlNameInputRef.current) return;

    const assembled = assembleUrl(editingUrlParts);
    setLocalUrlValue(assembled.replace(/^https?:\/\/(www\.)?/i, ''));
  }, [editingUrlParts, assembleUrl]);

  // Content bar state (from BuildView)
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('Current Tabs');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHoverPeeking, setIsHoverPeeking] = useState(false);
  const sidebarHoverAreaRef = useRef<HTMLDivElement>(null);
  const hoverPeekTimeoutRef = useRef<number | null>(null);
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState<SelectedLink[]>([]);

  // Fallback to Current Tabs if selected links are cleared
  useEffect(() => {
    if (selectedLinks.length === 0 && activeContentTab === 'Selected tabs') {
      setActiveContentTab('Current Tabs');
    }
  }, [selectedLinks.length, activeContentTab]);

  // "All saved files" inline search state
  const [isSavedFilesSearchOpen, setIsSavedFilesSearchOpen] = useState(false);
  const [savedFilesSearchQuery, setSavedFilesSearchQuery] = useState('');
  const [focusedSavedFileIndex, setFocusedSavedFileIndex] = useState(-1);
  const savedFilesInputRef = useRef<HTMLInputElement>(null);

  const savedFileSuggestions = useMemo(() => {
    if (savedFilesSearchQuery.trim().length < 3) return [];
    const q = savedFilesSearchQuery.toLowerCase();
    return availableItems.filter(i => (i.name || '').toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q)).slice(0, 10);
  }, [availableItems, savedFilesSearchQuery]);
  const listContainerRef = useRef<HTMLDivElement>(null);


  // Auto-select highlighted browser tabs when opening in create mode
  useEffect(() => {
    if (isOpen && !isEditMode && !prefill && !hasAutoSelectedRef.current && availableItems.length > 0) {
      const highlighted = availableItems.filter(
        item =>
          item.source === 'tab' && (item.originalData?.highlighted === true || item.originalData?.active === true),
      );
      if (highlighted.length > 0) {
        setSelectedLinks(highlighted);
        const activeTab = highlighted.find(h => h.originalData?.active === true) || highlighted[0];
      }
      hasAutoSelectedRef.current = true;
    }
    if (!isOpen) {
      hasAutoSelectedRef.current = false;
    }
  }, [isOpen, isEditMode, prefill, availableItems, isTitleManuallyModified]);

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  // Manual location overrides (for changing folder via picker)
  const [manualWorkspaceId, setManualWorkspaceId] = useState<string | null>(null);
  const [manualFolderId, setManualFolderId] = useState<string | null>(null);

  // If manualWorkspaceId is set, it means the user explicitly used the picker.
  // We should trust the manual state fully (even if folder is null) to allow moving to root.
  const isManualOverride = manualWorkspaceId !== null;

  // Attempt to resolve location if missing (for legacy or partial snippets)
  const resolvedLocation = useMemo(() => {
    if (!isEditMode || !initialSnippet || (initialSnippet as any).workspace_id) return null;

    // Search in allTeams (Personal + Org) to find where this snippet lives
    const snipId = initialSnippet.id || (initialSnippet as any).snippet_id;
    if (!snipId || !allTeams) return null;

    for (const team of allTeams) {
      for (const ws of team.workspaces || []) {
        // Check workspace snippets
        if (
          (ws.workspace_snippets || []).some(
            (s: any) => String(s.id) === String(snipId) || String(s.snippet_id) === String(snipId),
          )
        ) {
          return { workspace_id: ws.workspace_id, folder_id: undefined };
        }
        // Check folders
        for (const f of ws.folders || []) {
          if (
            (f.snippets || []).some(
              (s: any) => String(s.id) === String(snipId) || String(s.snippet_id) === String(snipId),
            )
          ) {
            return { workspace_id: ws.workspace_id, folder_id: f.folder_id };
          }
        }
      }
    }
    return null;
  }, [isEditMode, initialSnippet, allTeams]);

  const targetWorkspaceId = isManualOverride
    ? manualWorkspaceId
    : isEditMode
      ? (initialSnippet as any)?.workspace_id || resolvedLocation?.workspace_id || ''
      : snippetBreadCrum?.workspace_id || selectedWorkspace?.workspace_id || '';

  const folderIdForSave = isManualOverride
    ? manualFolderId || '' // If override active, trust manualFolderId (empty means root)
    : isEditMode
      ? (initialSnippet as any)?.folder_id || resolvedLocation?.folder_id || ''
      : snippetBreadCrum?.folder_id || selectedFolder?.folder_id || '';

  const targetName =
    snippetBreadCrum?.folder_name ||
    selectedFolder?.folder_name ||
    snippetBreadCrum?.workspace_name ||
    selectedWorkspace?.workspace_name ||
    '';

  const hasDestination = isEditMode ? true : Boolean(targetWorkspaceId);
  const needsDestinationSelection = isEditMode ? false : !hasDestination;

  // Resolve the display name and details for the destination button
  const destinationDetails = useMemo(() => {
    return getDestinationPathDetails(
      allTeams,
      targetWorkspaceId || null,
      folderIdForSave || null,
      null,
      (workspacesMetadata?.find(w => w.workspace_id === targetWorkspaceId) as any)?.type,
    );
  }, [targetWorkspaceId, folderIdForSave, allTeams, workspacesMetadata]);

  const isDuplicateName = useCallback(
    (newName: string) => {
      if (!targetWorkspaceId || !allTeams) return false;
      const team = allTeams.find(t => (t.workspaces || []).some(w => w.workspace_id === targetWorkspaceId));
      if (!team) return false;
      const ws = team.workspaces?.find(w => w.workspace_id === targetWorkspaceId);
      if (!ws) return false;

      let existingSnippets: any[] = [];
      if (folderIdForSave) {
        const folder = ws.folders?.find(f => f.folder_id === folderIdForSave);
        if (folder) {
          existingSnippets = folder.snippets || [];
        }
      } else {
        existingSnippets = ws.workspace_snippets || [];
      }

      const currentSnippetId = (initialSnippet as any)?.id || (initialSnippet as any)?.snippet_id;
      return existingSnippets.some(
        s =>
          s.key?.trim().toLowerCase() === newName.trim().toLowerCase() &&
          String(s.id) !== String(currentSnippetId) &&
          String(s.snippet_id) !== String(currentSnippetId),
      );
    },
    [allTeams, targetWorkspaceId, folderIdForSave, initialSnippet],
  );

  const isDuplicateTitle = useMemo(() => {
    return isDuplicateName(title);
  }, [title, isDuplicateName]);

  // Load user ID on mount
  useEffect(() => {
    const fetchUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    fetchUserId();
  }, []);

  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!isOpen) return;

      if (initialSnippet) {
        try {
          const [hotkeysMap, shortcutsMap] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
          const compoundId = getItemCompoundId({
            ...initialSnippet,
            folder_id: (initialSnippet as any).folder_id || folderIdForSave,
            workspace_id: (initialSnippet as any).workspace_id || targetWorkspaceId,
          });

          const currentHotkey = hotkeysMap[compoundId] || '';
          const currentShortcut = shortcutsMap[compoundId] || '';

          setPendingHotkey(currentHotkey);
          setPendingShortcut(currentShortcut.replace(/^\//, ''));

          // Sync favorite status
          if (userId && initialSnippet.id) {
            chrome.storage.local.get('myFavouriteItems', result => {
              const favItems = result.myFavouriteItems || {};
              const currentFavList: Snippet[] = favItems[userId] || [];
              const isCurrentlyFav = currentFavList.some(item => {
                const favId = item.id || (item as any).snippet_id;
                return String(favId) === String(initialSnippet.id);
              });
              if (justSavedRef.current) {
                if (isFav && !isCurrentlyFav) {
                  return;
                }
                justSavedRef.current = false;
              }
              setIsFav(isCurrentlyFav);
            });
          }
        } catch (error) {
          console.error('[LinkEditModal] Failed to sync standardized maps:', error);
        }
      } else {
        setPendingHotkey('');
        setPendingShortcut('');
        setPendingTodoData(null);
      }
    };

    syncData();
  }, [initialSnippet, isOpen, userId]);


  const toggleFavoriteLocal = async (item: Snippet) => {
    if (!userId) return;

    try {
      const result: any = await new Promise(resolve => chrome.storage.local.get('myFavouriteItems', resolve));
      const favItems = result.myFavouriteItems || {};
      const currentFavList: Snippet[] = favItems[userId] || [];

      const targetId = item.id || (item as any).snippet_id;
      const existingFavIndex = currentFavList.findIndex(fav => {
        const favId = fav.id || (fav as any).snippet_id;
        return String(favId) === String(targetId);
      });
      const isAlreadyFav = existingFavIndex !== -1;

      const updatedFavList = isAlreadyFav
        ? currentFavList.filter(fav => {
            const favId = fav.id || (fav as any).snippet_id;
            return String(favId) !== String(targetId);
          })
        : [item, ...currentFavList];

      const updatedMapping = { ...favItems, [userId]: updatedFavList };
      await new Promise<void>(resolve => chrome.storage.local.set({ myFavouriteItems: updatedMapping }, resolve));

      setIsFav(!isAlreadyFav);

      if (!targetId || String(targetId).startsWith('temp-')) return;

      if (isAlreadyFav) {
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
            console.warn('[LinkEditModal] Fallback cloud deletion failed:', e);
          }
        }
      } else {
        const response = await addFavorite(userId, { id: String(targetId) }, 'snippet');
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
        }
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const handleToggleFavorite = () => {
    if (initialSnippet) {
      toggleFavoriteLocal(initialSnippet);
    } else {
      setIsFav(!isFav);
    }
  };

  const handleCreateTodoFromLink = async () => {
    if (linkTodoStatus === 'creating') return;
    setLinkTodoStatus('creating');

    try {
      let deadlineVal = '';
      if (!isAnytime && reminderDate && reminderTime) {
        try {
          deadlineVal = new Date(`${reminderDate}T${reminderTime}`).toISOString();
        } catch(e) {
          deadlineVal = '';
        }
      }

      const targetCategory = initialSnippet?.category || (selectedLinks.length > 1 ? 'tabgroup' : 'link');
      const snippetId = initialSnippet?.id || initialSnippet?.snippet_id;
      const chromeAny = (window as any).chrome;

      let targetValue = '';
      if (selectedLinks.length > 1) {
        targetValue = JSON.stringify({
          urls: selectedLinks.map(l => l.url),
          names: selectedLinks.map(l => l.name || ''),
        });
      } else if (selectedLinks.length === 1) {
        targetValue = selectedLinks[0].url;
      }

      const tempId = snippetId || ('temp-id-' + Date.now());
      const taskTitle = title.trim() || initialSnippet?.key || 'Untitled Link Task';

      // Build optimistic local entry
      const optimisticTodo: any = {
        snippet_id: String(tempId),
        key: taskTitle,
        title: taskTitle,
        value: targetValue,
        category: targetCategory,
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

      // 2. Cloud sync (fire-and-forget) or queue it for background sync upon saving
      if (snippetId) {
        convertSnippetToTodo(
          { snippet_id: snippetId },
          deadlineVal,
          isRecurring,
          isRecurring ? (recurringCycle || 'daily') : undefined,
          taskTitle,
        ).then(res => {
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
        }).catch(err => console.warn('[LinkEditModal] Cloud todo sync failed (local saved ok):', err));
      } else {
        setPendingTodoData({
          deadlineVal,
          isRecurring,
          recurringCycle: isRecurring ? (recurringCycle || 'daily') : null,
          isAnytime,
          taskTitle: taskTitle,
          tempId: String(tempId),
        });
      }

      // 3. Show success — stay on this page
      setLinkTodoStatus('success');
      setTimeout(() => setLinkTodoStatus('idle'), 3000);
    } catch (err) {
      console.error('[LinkEditModal] handleCreateTodoFromLink failed:', err);
      setLinkTodoStatus('idle');
    }
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    setPendingHotkey(newHotkey);

    if (initialSnippet?.id && !String(initialSnippet.id).startsWith('temp-')) {
      try {
        await updateSnippetHotkey(initialSnippet.id, newHotkey);
        const folderId = (initialSnippet as any).folder_id;
        const workspaceId = (initialSnippet as any).workspace_id;
        const compoundId = `${folderId || workspaceId || targetWorkspaceId}-${initialSnippet.id}`;

        await updateLocalHotkey(compoundId, newHotkey, 'link');
        showFooterStatus('success', newHotkey ? 'Hotkey updated' : 'Hotkey cleared');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        showFooterStatus('error', 'Failed to update hotkey');
      }
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    setPendingShortcut(newShortcut);

    if (initialSnippet?.id && !String(initialSnippet.id).startsWith('temp-')) {
      try {
        await updateSnippetShortcut(initialSnippet.id, newShortcut);
        const folderId = (initialSnippet as any).folder_id;
        const workspaceId = (initialSnippet as any).workspace_id;
        const compoundId = `${folderId || workspaceId || targetWorkspaceId}-${initialSnippet.id}`;

        await updateLocalShortcut(
          compoundId,
          initialSnippet.id,
          newShortcut,
          title.trim() || initialSnippet.key || '',
          'link',
        );
        showFooterStatus('success', 'Shortcut updated');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        showFooterStatus('error', 'Failed to update shortcut');
      }
    }
  };

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  const insertCustomVariable = useCallback(() => {
    if (!editingUrlParts) return;

    if (focusedField === 'domain') {
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    } else if (focusedField === 'path' && focusedPathIndex !== null) {
      const newPaths = [...editingUrlParts.paths];
      // Append /{query} to the selected path component
      newPaths[focusedPathIndex] = (newPaths[focusedPathIndex] || '') + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else if (editingUrlParts.paths.length > 0) {
      // Default: append to last path
      const newPaths = [...editingUrlParts.paths];
      newPaths[newPaths.length - 1] = newPaths[newPaths.length - 1] + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else {
      // No paths, add to domain
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    }
  }, [editingUrlParts, focusedField, focusedPathIndex]);

  const teamId = selectedTeam?.team_id || '';

  const getHostname = useCallback((url: string) => {
    try {
      if (!url) return '';
      // Ensure protocol
      const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(safeUrl).hostname;
    } catch (error) {
      return url;
    }
  }, []);

  const fetchTabs = useCallback(() => {
    // New-Tab has direct access to chrome.tabs
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.tabs?.query) {
      setTabsByWindow({});
      setHasFetchedTabs(true);
      return;
    }

    chromeAny.tabs.query({}, (fetchedTabs: BrowserTab[]) => {
      if (chromeAny.runtime?.lastError || !fetchedTabs) {
        setTabsByWindow({});
        setHasFetchedTabs(true);
        return;
      }

      const tabs = fetchedTabs.filter(
        t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://') && t.url !== 'about:blank',
      ); // Filter internal, extension, and blank pages
      const grouped = tabs.reduce<Record<number, BrowserTab[]>>((acc, tab) => {
        const windowId = tab.windowId ?? -1;
        if (!acc[windowId]) {
          acc[windowId] = [];
        }
        acc[windowId].push(tab);
        return acc;
      }, {});

      Object.keys(grouped).forEach(windowId => {
        // Sort: active tab first, then by index
        grouped[Number(windowId)].sort((a, b) => {
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          return Number(a.index ?? 0) - Number(b.index ?? 0);
        });
      });

      setTabsByWindow(grouped);
      setHasFetchedTabs(true);
    });
  }, []);

  useEffect(() => {
    if (!isLeftCustomLinkFormOpen || !customLinkUrl.trim()) {
      setLinkSuggestions([]);
      setFocusedSuggestionIndex(-1);
      return;
    }

    const query = customLinkUrl.trim();
    if (query.length < 1) return;

    const performSearch = async () => {
      const results: Array<{ title: string; url: string; source: 'history' | 'bookmark' }> = [];
      const chromeAny = (window as any).chrome;

      const searchBookmarks = (): Promise<any[]> => {
        return new Promise(resolve => {
          if (chromeAny?.bookmarks?.search) {
            chromeAny.bookmarks.search(query, (res: any[]) => resolve(res || []));
          } else {
            resolve([]);
          }
        });
      };

      const searchHistory = (): Promise<any[]> => {
        return new Promise(resolve => {
          if (chromeAny?.history?.search) {
            chromeAny.history.search({ text: query, maxResults: 10 }, (res: any[]) => resolve(res || []));
          } else {
            resolve([]);
          }
        });
      };

      try {
        const [bookmarks, history] = await Promise.all([searchBookmarks(), searchHistory()]);

        bookmarks.forEach((b: any) => {
          if (b.url) results.push({ title: b.title, url: b.url, source: 'bookmark' });
        });
        history.forEach((h: any) => {
          if (h.url) results.push({ title: h.title || getHostname(h.url), url: h.url, source: 'history' });
        });

        // Deduplicate by URL
        const unique = new Map();
        results.forEach(r => {
          if (!unique.has(r.url)) unique.set(r.url, r);
        });

        const finalResults = Array.from(unique.values()).slice(0, 5);
        
        setLinkSuggestions(finalResults);
        setFocusedSuggestionIndex(finalResults.length > 0 ? 0 : -1);
      } catch (e) {
        console.error('[LinkEditModal] Search failed:', e);
      }
    };

    performSearch();
  }, [customLinkUrl, isLeftCustomLinkFormOpen, getHostname]);

  // ======================
  // Tag-Related Additions
  // ======================
  const [orgTags, setOrgTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  const generalTags: Tag[] = useMemo(() => [
    { tag_id: '', name: 'Important' },
    { tag_id: '', name: 'Work' },
    { tag_id: '', name: 'Urgent' },
    { tag_id: '', name: 'Personal' },
  ], []);

  useEffect(() => {
    // Disabled per user request - using fallback directly
    setOrgTags(generalTags);
  }, [selectedTeam?.team_id, generalTags]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setTagPopupOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTagPopupOpen(prev => !prev);
  };

  const handleTagSelect = (tag: Tag | null) => {
    setSelectedTag(tag);
  };

  const rawSearchTagsRef = useRef<Record<string, string[]> | string>({});
  const lastPrefilledSnippetIdRef = useRef<string | null>(null);

  // Prefill fields when editing an existing link/tabgroup
  useEffect(() => {
    const currentId = initialSnippet?.id || (initialSnippet as any)?.snippet_id;
    if (!isOpen || !isEditMode || !initialSnippet || activeSessionId) return;
    if (hasPrefilledEditModeRef.current && lastPrefilledSnippetIdRef.current === currentId) return;
    
    hasPrefilledEditModeRef.current = true;
    lastPrefilledSnippetIdRef.current = currentId;
    try {
      setTitle(initialSnippet.key || '');
      
      if (initialSnippet.tags && initialSnippet.tags.length > 0) {
        setSelectedTag(initialSnippet.tags[0]);
      } else if (initialSnippet.searchtags) {
        const rawTags = initialSnippet.searchtags;
        rawSearchTagsRef.current = rawTags;
        let firstTag = '';
        if (typeof rawTags === 'object' && rawTags !== null) {
          const myTags = (rawTags as Record<string, string[]>)[userId] || [];
          if (myTags.length > 0) firstTag = myTags[0];
        } else if (typeof rawTags === 'string') {
          firstTag = rawTags.split(',')[0].trim();
        }
        if (firstTag) {
          setSelectedTag({ tag_id: '', name: firstTag });
        }
      } else {
        // Local storage backup fallback for searchtags
        const snipId = initialSnippet.id || (initialSnippet as any).snippet_id;
        if (snipId) {
          chrome.storage.local.get('alts_searchtags_backup', result => {
            const backup = result.alts_searchtags_backup || {};
            if (backup[snipId]) {
              const bTag = backup[snipId];
              let firstTag = '';
              if (typeof bTag === 'object' && bTag !== null) {
                const myTags = bTag[userId] || [];
                if (myTags.length > 0) firstTag = myTags[0];
              } else if (typeof bTag === 'string') {
                firstTag = bTag.split(',')[0].trim();
              }
              if (firstTag) {
                setSelectedTag({ tag_id: '', name: firstTag });
              }
            }
          });
        }
      }
      
      const category = (initialSnippet.category || '').toLowerCase();

      const isGroup = category === 'tabgroup' || category === 'tab group' || category === 'quicklink';

      if (isGroup) {
        let urls: string[] = [];
        let names: string[] = [];
        if (typeof initialSnippet.value === 'string') {
          try {
            // Try explicit JSON parse first
            if (initialSnippet.value.trim().startsWith('{')) {
              const parsed = JSON.parse(initialSnippet.value);
              urls = Array.isArray((parsed as any)?.urls) ? (parsed as any).urls : [];
              names = Array.isArray((parsed as any)?.names) ? (parsed as any).names : [];
            } else {
              // Fallback for plain string that wasn't JSON
              urls = [initialSnippet.value];
            }
          } catch {
            // If parse fails
            if (initialSnippet.value) {
              urls = [initialSnippet.value];
              names = [initialSnippet.key || initialSnippet.value];
            }
          }
        } else if (initialSnippet.value && typeof initialSnippet.value === 'object') {
          const val = initialSnippet.value as any;
          urls = Array.isArray(val?.urls) ? val.urls : [];
          names = Array.isArray(val?.names) ? val.names : [];
        }

        if (urls.length === 0 && initialSnippet.value && typeof initialSnippet.value === 'string') {
          // Ultimate fallback if parsing returned empty but we have a value
          urls = [initialSnippet.value];
          names = [initialSnippet.key || initialSnippet.value];
        }

        setSelectedLinks(
          urls.map((u, idx) => {
            const isNote = u.startsWith('note:');
            return {
              id: `prefill-${idx}`,
              url: u,
              name: names[idx] || (isNote ? 'Note' : u),
              source: isNote ? ('note' as const) : ('link' as const),
              originalData: isNote ? { id: u.substring(5) } : undefined,
              favIconUrl: isNote ? undefined : getFaviconUrl(getHostname(u)),
            };
          }),
        );
      } else {
        // Single link
        let urlVal = '';
        if (typeof initialSnippet.value === 'string') {
          // It might be a JSON string even for 'link' category if data is messy
          if (initialSnippet.value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(initialSnippet.value);
              urlVal = parsed.url || parsed.urls?.[0] || initialSnippet.value;
            } catch {
              urlVal = initialSnippet.value;
            }
          } else {
            urlVal = initialSnippet.value;
          }
        } else {
          urlVal = String((initialSnippet.value as any) || '');
        }

        const hostname = getHostname(urlVal);
        setSelectedLinks([
          {
            id: `prefill-0`,
            url: urlVal,
            name: initialSnippet.key || urlVal,
            source: 'custom',
            favIconUrl: getFaviconUrl(hostname),
          },
        ]);
      }
    } catch {
      // ignore prefill errors
    }
  }, [isOpen, isEditMode, initialSnippet, getHostname]);

  useEffect(() => {
    if (!isCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isCustomLinkFormOpen]);

  useEffect(() => {
    if (!isLeftCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isLeftCustomLinkFormOpen]);

  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasAutoOpenedRef.current = false;
    }
  }, [isOpen]);

  // Auto-open custom link input if there are no open browser tabs on Current Tabs
  useEffect(() => {
    if (isOpen && activeContentTab === 'Current Tabs' && hasFetchedTabs && !hasAutoOpenedRef.current && !activeSessionId) {
      const hasTabs = Object.values(tabsByWindow).some(group => group.length > 0);
      if (!hasTabs) {
        setIsLeftCustomLinkFormOpen(true);
      }
      hasAutoOpenedRef.current = true;
    }
  }, [isOpen, activeContentTab, tabsByWindow, hasFetchedTabs, activeSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTabs();
    const interval = window.setInterval(fetchTabs, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, fetchTabs]);

  useEffect(() => {
    if (!editingUrlId) return;
    const t = window.setTimeout(() => editingUrlInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [editingUrlId]);

  // Load items for content bar (from BuildView)
  useEffect(() => {
    if (!isOpen) return;

    const loadItems = async () => {
      const items: SelectedLink[] = [];

      // 1. Current Tabs from tabsByWindow
      const seenNormalizedUrls = new Set<string>();
      Object.entries(tabsByWindow).forEach(([windowIdStr, tabs]) => {
        const winId = Number(windowIdStr);
        // If we are in an active session, skip showing tabs from the session window itself under 'Current Tabs'
        if (activeSessionId && currentWindowId !== null && winId === currentWindowId) {
          return;
        }

        tabs.forEach(t => {
          if (t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) {
            const norm = t.url.toLowerCase().trim().replace(/\/$/, '');
            if (seenNormalizedUrls.has(norm)) {
              return; // Skip duplicate tab in "Current Tabs" UI list
            }
            seenNormalizedUrls.add(norm);

            items.push({
              id: `tab-${t.id}`,
              url: t.url,
              name: t.title || 'Untitled Tab',
              favIconUrl: t.favIconUrl || getFaviconUrl(getHostname(t.url)),
              windowId: t.windowId,
              source: 'tab',
              originalData: t,
            });
          }
        });
      });

      // 2. Links & Notes from Redux (allData)
      // Helper to process snippets into list items
      const processSnippet = (s: any) => {
        const category = (s.category || '').toLowerCase();

        const isTabGroup = category === 'tabgroup' || category === 'tab group';
        const isLink = category === 'link' || category === 'links' || category === 'quicklink' || isTabGroup;
        const isNote = category === 'snippet';

        if (!isLink && !isNote) return;

        let subtitle = '';
        if (isLink) {
          try {
            if (typeof s.value === 'string') {
              if (s.value.trim().startsWith('{')) {
                const parsed = JSON.parse(s.value);
                if (parsed.urls && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                  subtitle = parsed.urls[0];
                } else if (parsed.url) {
                  subtitle = parsed.url;
                } else {
                  subtitle = s.value;
                }
              } else {
                subtitle = s.value;
              }
            }
          } catch {
            subtitle = '';
          }
        } else {
          subtitle = 'Note';
        }

        items.push({
          id: s.id || s.snippet_id || `snip-${Math.random()}`,
          url: isNote ? `note:${s.id || s.snippet_id}` : subtitle,
          name: s.key || 'Untitled',
          source: isLink ? 'link' : 'note',
          favIconUrl: (isLink && subtitle) ? getFaviconUrl(getHostname(subtitle)) : undefined,
          originalData: s,
        });
      };

      const processAutomation = (auto: any) => {
        if (!auto) return;
        const steps = auto.automation_steps || auto.steps;
        const isAi =
          Array.isArray(steps) &&
          steps.some(
            (s: any) =>
              String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          );
        if (!isAi) return;

        if (items.some(existing => String(existing.id) === String(auto.id || auto.automation_id))) return;

        items.push({
          id: auto.id || auto.automation_id || `agent-${Math.random()}`,
          url: 'agent_chat',
          name: auto.name || auto.title || 'AI Agent',
          source: 'link',
          originalData: auto,
        });
      };

      const processFolderAutomationsDeep = (folders: any[]) => {
        (folders || []).forEach(folder => {
          (folder.automations || []).forEach(processAutomation);
          if (folder.folders && folder.folders.length > 0) {
            processFolderAutomationsDeep(folder.folders);
          }
        });
      };

      // Fetch local automations
      try {
        const localData = await new Promise<any>(resolve => {
          chrome.storage.local.get(['automations', 'saved_automations'], resolve);
        });
        const toAutomationArray = (value: any): any[] => {
          if (Array.isArray(value)) return value;
          if (value && typeof value === 'object') return Object.values(value);
          return [];
        };
        const syncedAutomations = toAutomationArray(localData?.automations);
        const legacyAutomations = toAutomationArray(localData?.saved_automations);
        const localAutos = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;

        localAutos.forEach(processAutomation);
      } catch (e) {
        console.warn('[LinkEditModal] Failed to load local automations:', e);
      }

      // Always load ALL items from all teams to ensure "Recent" and cross-workspace items are visible
      // (User reported "not showing volcanic ones" likely meaning items from other workspaces/folders)
      if (allTeams) {
        allTeams.forEach(team => {
          team.workspaces?.forEach(ws => {
            ws.workspace_snippets?.forEach(processSnippet);
            (ws.workspace_automations || []).forEach(processAutomation);
            ws.folders?.forEach(f => {
              f.snippets?.forEach(processSnippet);
            });
            processFolderAutomationsDeep(ws.folders);
          });
        });
      }

      // Sort items by updated_at or created_at (descending) to show recent items first
      // Note: originalData might not always have updated_at depending on source, fallback to created_at or 0
      items.sort((a, b) => {
        const tA = a.originalData?.updated_at || a.originalData?.created_at || 0;
        const tB = b.originalData?.updated_at || b.originalData?.created_at || 0;
        // Handle ISO strings or timestamps
        const timeA = new Date(tA).getTime();
        const timeB = new Date(tB).getTime();
        return timeB - timeA;
      });

      setAvailableItems(items);
    };

    loadItems();
  }, [isOpen, allTeams, tabsByWindow, selectedFolder, selectedWorkspace, currentWindowId, activeSessionId]);

  // Scroll to top when active tab changes
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeContentTab]);

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    if (activeContentTab === 'Selected tabs') {
      return selectedLinks;
    }

    let list = availableItems;

    // Tab Filter
    if (activeContentTab === 'Current Tabs') {
      const addedLinks = selectedLinks;
      const notAddedCurrentTabs = availableItems.filter(item => {
        if (item.source !== 'tab') return false;
        return !selectedLinks.some(selected => {
          if (selected.source === 'tab' && selected.originalData?.id === item.originalData?.id) return true;
          return selected.url === item.url;
        });
      });
      list = notAddedCurrentTabs;
    } else if (contentSearchQuery.trim() && activeContentTab === 'All saved files') {
      const q = contentSearchQuery.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
    }

    return list;
  }, [availableItems, activeContentTab, contentSearchQuery, selectedLinks]);

  const checkIsAdded = useCallback((item: SelectedLink) => {
    return selectedLinks.some(selected => {
      if (item.source === selected.source && item.originalData && selected.originalData) {
        const id1 = selected.originalData?.id || selected.originalData?.snippet_id;
        const id2 = item.originalData?.id || item.originalData?.snippet_id;
        return id1 && id2 && id1 === id2;
      }
      return selected.url === item.url;
    });
  }, [selectedLinks]);

  const allRenderedItems = useMemo(() => {
    const renderedSelected = selectedLinks.map(item => ({
      item,
      isAdded: true,
    }));

    const renderedActive = (activeContentTab === 'Selected tabs')
      ? []
      : filteredItems.filter(item => !checkIsAdded(item)).map(item => ({
          item,
          isAdded: false,
        }));

    return [...renderedSelected, ...renderedActive];
  }, [selectedLinks, filteredItems, activeContentTab, checkIsAdded]);

  const handleWorkspaceDestination = useCallback(
    (workspace: Workspace, isPersonal?: boolean) => {
      // Switch team if personal workspace selected
      hasUserModifiedRef.current = true;

      // Update local override
      setManualWorkspaceId(workspace.workspace_id);
      setManualFolderId(null);
      setIsLocationPickerOpen(false);
    },
    [dispatch, allTeams, orgTeam],
  );

  const handleFolderDestination = useCallback(
    (workspace: Workspace, folder: Folder, isPersonal?: boolean) => {
      // Switch team if personal workspace selected
      hasUserModifiedRef.current = true;

      // Update local override
      setManualWorkspaceId(workspace.workspace_id);
      setManualFolderId(folder.folder_id);
      setIsLocationPickerOpen(false);
    },
    [dispatch, allTeams, orgTeam],
  );

  const addLink = useCallback(
    (tab: BrowserTab) => {
      hasUserModifiedRef.current = true;
      const linkName = tab.title || getHostname(tab.url);

      setSelectedLinks(prev => {
        const linkId = `tab-${tab.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return [
          ...prev,
          {
            id: linkId,
            url: tab.url,
            name: linkName,
            favIconUrl: tab.favIconUrl,
            windowId: tab.windowId,
            source: 'tab' as const,
          },
        ];
      });

      if (activeSessionId) {
        chrome.runtime.sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId,
          url: tab.url
        }).catch(() => {});
      }
    },
    [getHostname, isTitleManuallyModified, activeSessionId],
  );

  const removeLink = useCallback((linkId: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.filter(link => link.id !== linkId));
  }, []);

  // Add item from content bar (handles tabs, links, notes)
  const addItemFromContentBar = useCallback(
    (item: SelectedLink) => {
      hasUserModifiedRef.current = true;
      if (item.url === 'agent_chat') {
        const agentId = item.id || item.originalData?.id || item.originalData?.snippet_id;

        setSelectedLinks(prev => {
          const agentUrl = `agent_chat?id=${agentId}`;
          if (prev.some(existing => existing.url === agentUrl)) return prev;

          const newId = `agent-${agentId}-${Date.now()}`;
          return [
            ...prev,
            {
              ...item,
              id: newId,
              url: agentUrl,
              name: `${item.name} (AI Agent)`,
              source: 'custom',
              favIconUrl: 'https://chatgpt.com/favicon.ico', // Indicator for AI
            },
          ];
        });
        return;
      }

      setSelectedLinks(prev => {
        const newId = `${item.source}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return [
          ...prev,
          {
            ...item,
            id: newId,
          },
        ];
      });

      if (activeSessionId && item.url) {
        chrome.runtime.sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId,
          url: item.url
        }).catch(() => {});
      }
    },
    [isTitleManuallyModified, activeSessionId],
  );

  const updateLinkName = useCallback((linkId: string, name: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.map(link => (link.id === linkId ? { ...link, name: name || link.url } : link)));
  }, []);

  const handleAddCustomLink = useCallback(() => {
    hasUserModifiedRef.current = true;
    const rawUrl = customLinkUrl.trim();
    if (!rawUrl) {
      showFooterStatus('error', 'Enter a URL to add.');
      return;
    }

    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      // Validate URL

      new URL(normalizedUrl);
    } catch (error) {
      showFooterStatus('error', 'Enter a valid URL.');
      return;
    }

    const name = customLinkName.trim() || getHostname(normalizedUrl);
    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setSelectedLinks(prev => [
      ...prev,
      {
        id,
        url: normalizedUrl,
        name,
        source: 'custom',
        favIconUrl: getFaviconUrl(getHostname(normalizedUrl)),
      },
    ]);

    if (activeSessionId) {
      chrome.runtime.sendMessage({
        action: 'open_tab_in_session',
        sessionId: activeSessionId,
        url: normalizedUrl
      }).catch(() => {});
    }

    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);
    setActiveContentTab('Current Tabs');
  }, [customLinkName, customLinkUrl, getHostname, activeSessionId]);

  const toggleWindowCollapse = useCallback((windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  }, []);

  const handleCreateSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsStartingSession(true);
    setSessionError(null);

    try {
      // 1. Check duplicate session names in all workspace snippets and folder snippets
      let exists = false;
      const currentSnippetId = (initialSnippet as any)?.id || (initialSnippet as any)?.snippet_id;
      if (allTeams) {
        for (const team of allTeams) {
          for (const ws of team.workspaces || []) {
            if ((ws.workspace_snippets || []).some((s: any) => 
              s.key?.trim().toLowerCase() === trimmedName.toLowerCase() &&
              String(s.id) !== String(currentSnippetId) &&
              String(s.snippet_id) !== String(currentSnippetId)
            )) {
              exists = true;
              break;
            }
            for (const f of ws.folders || []) {
              if ((f.snippets || []).some((s: any) => 
                s.key?.trim().toLowerCase() === trimmedName.toLowerCase() &&
                String(s.id) !== String(currentSnippetId) &&
                String(s.snippet_id) !== String(currentSnippetId)
              )) {
                exists = true;
                break;
              }
            }
            if (exists) break;
          }
          if (exists) break;
        }
      }

      if (exists) {
        showFooterStatus('error', 'A session with this name already exists.');
        setIsStartingSession(false);
        return;
      }

      // 2. Check duplicate session names in active sessions stored in local storage
      const activeSessionsResult = await new Promise<any[]>((resolve) => {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get('active_sessions', (res: any) => resolve(res.active_sessions || []));
        } else {
          resolve([]);
        }
      });
      const duplicateActive = activeSessionsResult.some((s: any) => s.sessionName?.toLowerCase() === trimmedName.toLowerCase());
      if (duplicateActive) {
        showFooterStatus('error', 'A session with this name is currently active.');
        setIsStartingSession(false);
        return;
      }

      const sessionId = isEditMode && initialSnippet
        ? (initialSnippet.id || (initialSnippet as any).snippet_id)
        : (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now() + Math.random()));

      const initialUrls = selectedLinks.map(l => l.url);
      const initialNames = selectedLinks.map(l => l.name);

      // Save prefill to local storage
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({
          pending_session_prefill: {
            title: name.trim(),
            sessionId: sessionId,
          }
        }, () => resolve());
      });

      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'start_session',
          sessionId,
          sessionName: name.trim(),
          workspaceId: targetWorkspaceId,
          folderId: folderIdForSave || null,
          teamId,
          storageMode: selectedTeam?.storageMode ?? 'cloud',
          initialUrls,
          initialNames,
        }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            reject(new Error(response?.error || 'Failed to start session'));
          } else {
            resolve();
          }
        });
      });
      setSessionDialogOpen(false);
      setSessionName('');
      showFooterStatus('success', 'Session started!');
      onClose(); // Return to home view since session is running in a separate window
    } catch (e: any) {
      showFooterStatus('error', e.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleSave = useCallback(
    async (isAutoSave: boolean = false, overrideLinks?: SelectedLink[], overrideTitle?: string) => {
      if (isSaving) return;

      const finalLinks = overrideLinks || selectedLinks;
      const finalTitle = overrideTitle !== undefined ? overrideTitle : title;
      let trimmedTitle = finalTitle.trim();

      
      if (!trimmedTitle) {
        showFooterStatus('error', 'Enter the title for this link collection');
        if (isAutoSave) throw new Error('Validation failed');
        return;
      }

      if (isDuplicateName(trimmedTitle)) {
        if (activeSessionId) {
          // Resolve duplication automatically by appending a numeric counter
          let counter = 1;
          let candidateTitle = `${trimmedTitle} (${counter})`;
          while (isDuplicateName(candidateTitle)) {
            counter++;
            candidateTitle = `${trimmedTitle} (${counter})`;
          }
          trimmedTitle = candidateTitle;
          setTitle(trimmedTitle);
        } else {
          showFooterStatus('error', `A link named "${trimmedTitle}" already exists here.`);
          if (isAutoSave) throw new Error('Validation failed');
          return;
        }
      }

      if (!finalLinks.length) {
        showFooterStatus('error', 'Select at least one tab to save');
        if (isAutoSave) throw new Error('Validation failed');
        return;
      }

      setIsSaving(true);
      setSaveStatus('saving');
      if (isLocationPickerOpen) {
        setIsLocationPickerOpen(false);
      }

      // Detect if this is a quick link group (only if URL contains explicit query placeholder)
      const hasQuickLinks = finalLinks.some(link => /\[query\]|\{query\}/i.test(link.url));

      // Check if any notes are included
      const hasNotes = finalLinks.some(link => link.source === 'note' || link.url.startsWith('note:'));

      // Category logic:
      // - TabGroup: if multiple links OR notes are included (mixed content)
      // - quicklink: exactly one URL containing [query] or {query} placeholder
      // - link: exactly one regular link
      const category: 'link' | 'quicklink' | 'TabGroup' =
        finalLinks.length > 1 || hasNotes ? 'TabGroup' : hasQuickLinks ? 'quicklink' : 'link';

      // Process links to ensure notes have proper URLs
      const processedLinks = finalLinks.map(link => {
        // For notes, ensure url has note: prefix
        if (link.source === 'note' && !link.url.startsWith('note:')) {
          const noteId = link.originalData?.id || link.originalData?.snippet_id;
          return { ...link, url: `note:${noteId}` };
        }
        return link;
      });

      // All multi-item collections use the same storage format: { names: [...], urls: [...] }
      const groupValue =
        category === 'TabGroup' || category === 'quicklink' || finalLinks.length > 1
          ? {
              names: processedLinks.map(
                link => link.name || (link.url.startsWith('note:') ? 'Note' : getHostname(link.url)),
              ),
              urls: processedLinks.map(link => link.url),
            }
          : null;
      const valueForRequest = groupValue ? JSON.stringify(groupValue) : processedLinks[0]?.url || '';

      if (!valueForRequest || valueForRequest.trim() === '') {
        showFooterStatus('error', 'Cannot save empty link');
        setIsSaving(false);
        return;
      }

      try {
        const currentSnippetId = (initialSnippet as any)?.id || (initialSnippet as any)?.snippet_id;
        const isTempId = currentSnippetId && String(currentSnippetId).startsWith('temp-');

        let tagToUse = selectedTag;

        if (isEditMode && initialSnippet) {
          if (isTempId) {
            showFooterStatus('error', 'Syncing in progress. Please refresh if this persists.');
            return;
          }

          const snippetId = currentSnippetId;


          let updatedSearchTags = { ...((rawSearchTagsRef.current as any) || {}) };
          if (tagToUse && tagToUse.name) {
            updatedSearchTags[userId] = [tagToUse.name];
          } else {
            delete updatedSearchTags[userId];
          }
          
          const payload: Record<string, any> = {
            snippet_id: snippetId,
            key: trimmedTitle,
            category,
            value: valueForRequest,
            searchtags: updatedSearchTags,
          };

          // Check for location changes and include in payload if different
          if (targetWorkspaceId !== (initialSnippet as any).workspace_id) {
            payload.workspace_id = targetWorkspaceId;
          }
          // Always send folder_id if workspace changed, or if folder changed within same workspace
          // If folderIdForSave is empty (root) and initial was not, we need to send empty string or null?
          // updateSnippetRealtime signature expects folder_id?: string.
          // If we want to move to root, we usually send null or empty string. Let's send what we have.
          if (folderIdForSave !== (initialSnippet as any).folder_id) {
            payload.folder_id = folderIdForSave;
          }

          // Add hotkey if set (key-pair format: user:hotkey)
          if (pendingHotkey) {
            payload.hotkey = pendingHotkey;
          }

          await updateSnippetRealtime(payload, selectedTeam?.storageMode ?? 'cloud');

          // Show success feedback immediately after API response
          const oldWorkspaceId = (initialSnippet as any).workspace_id;
          const oldFolderId = (initialSnippet as any).folder_id;
          const locationChanged = oldWorkspaceId !== targetWorkspaceId || oldFolderId !== folderIdForSave;

          if (locationChanged) {
            showFooterStatus('success', `Link moved to ${destinationDetails.pathText}`);
          } else {
            showFooterStatus('success', 'Saved link');
          }
          setSaveStatus('success');
          clearStashedBackup();

          // If hotkey was set, update local storage for fast access
          if (pendingHotkey) {
            const compoundId = `${folderIdForSave || targetWorkspaceId}-${snippetId}`;
            await updateLocalHotkey(compoundId, pendingHotkey, 'link');
          }

          // Back up search tags to local storage fallback
          if (snippetId && !String(snippetId).startsWith('temp-')) {
            try {
              chrome.storage.local.get('alts_searchtags_backup', result => {
                const backup = result.alts_searchtags_backup || {};
                backup[snippetId] = tagToUse ? tagToUse.name : '';
                chrome.storage.local.set({ alts_searchtags_backup: backup });
              });
            } catch (e) {
              console.warn('Failed to back up search tags locally:', e);
            }
          }

          // Update local Redux state
          const nowIso = new Date().toISOString();
          if (locationChanged) {
            // Location changed - reload to get fresh state from backend
            // This ensures the snippet appears in the new location and disappears from old
            if (!isAutoSave) {
              setTimeout(() => {
                reload(); // Refresh data from backend
                onClose();
              }, 1500); // 1.5s delay to let user see the message
            }
          } else {
            // Same location - use optimistic update

            // Resolve correct teamId for the target workspace
            const resolvedTeam = allTeams?.find(t =>
              (t.workspaces || []).some(w => w.workspace_id === targetWorkspaceId),
            );
            const effectiveTeamId = resolvedTeam?.team_id || teamId;

            dispatch(
              optimisticUpdateSnippet({
                teamId: effectiveTeamId,
                workspaceId: targetWorkspaceId,
                folderId: folderIdForSave,
                snippet: {
                  ...(initialSnippet as any),
                  id: snippetId,
                  key: trimmedTitle,
                  value: valueForRequest,
                  category,
                  tags: tagToUse ? [tagToUse] : [],
                  updated_at: nowIso,
                },
              }),
            );
            if (!isAutoSave) {
              setTimeout(() => {
                onClose();
              }, 1500);
            }
          }
        } else {
          // Create flow
          if (!teamId) {
            showFooterStatus('error', 'Select an organization before saving');
            setIsSaving(false);
            setSaveStatus('idle');
            if (isAutoSave) throw new Error('Validation failed');
            return;
          }
          if (!targetWorkspaceId) {
            showFooterStatus('error', 'Select a workspace or folder before saving');
            setIsSaving(false);
            setSaveStatus('idle');
            if (isAutoSave) throw new Error('Validation failed');
            return;
          }

          const nowIso = new Date().toISOString();

          let updatedSearchTags = { ...((rawSearchTagsRef.current as any) || {}) };
          if (tagToUse && tagToUse.name) {
            updatedSearchTags[userId] = [tagToUse.name];
          } else {
            delete updatedSearchTags[userId];
          }

          // Use updateSnippetRealtime for creation - it supports hotkey in a single call
          const createPayload: Record<string, any> = {
            key: trimmedTitle,
            value: valueForRequest,
            category,
            searchtags: updatedSearchTags,
            ...(folderIdForSave ? { folder_id: folderIdForSave } : { workspace_id: targetWorkspaceId }),
          };

          // Include hotkey in creation payload if set
          if (pendingHotkey) {
            createPayload.hotkey = pendingHotkey;
          }

          const response = await updateSnippetRealtime(createPayload, selectedTeam?.storageMode ?? 'cloud');

          // Show success feedback immediately after API response
          if (!isAutoSave) {
            const successMsg = `Link saved to ${destinationDetails.pathText}`;
            showFooterStatus('success', successMsg);

            dispatch(
              queueNotification({
                message: successMsg,
                type: 'success',
              }),
            );
          }
          setSaveStatus('success');
          clearStashedBackup();

          const responseSnippet = response?.snippet || response;
          const snippetId = responseSnippet?.snippet_id || responseSnippet?.id || `temp-${Date.now()}`;
          justSavedRef.current = true;

          if (activeSessionId && activeSessionId !== snippetId) {
            
            setActiveSessionId(snippetId);
            
            // Notify background to update the active session's key
            chrome.runtime.sendMessage({
              action: 'update_session_id',
              oldSessionId: activeSessionId,
              newSessionId: snippetId,
            }).catch(e => console.error('[LinkEditModal] Failed to send update_session_id to background:', e));
          }

          const snippetTags = Array.isArray(responseSnippet?.snippet_tags)
            ? responseSnippet.snippet_tags
            : responseSnippet?.tags || [];

          // Resolve correct teamId for the target workspace
          const resolvedTeam = allTeams?.find(t =>
            (t.workspaces || []).some(w => w.workspace_id === targetWorkspaceId),
          );
          const effectiveTeamId = resolvedTeam?.team_id || teamId;

          dispatch(
            optimisticAddSnippet({
              teamId: effectiveTeamId,
              workspaceId: targetWorkspaceId,
              folderId: folderIdForSave,
              snippet: {
                id: snippetId,
                key: trimmedTitle,
                value: valueForRequest,
                category,
                tags: snippetTags,
                user_id: responseSnippet?.user_id || '',
                first_name: responseSnippet?.first_name || '',
                last_name: responseSnippet?.last_name ?? null,
                created_at: responseSnippet?.created_at || nowIso,
                updated_at: responseSnippet?.updated_at || nowIso,
              },
            }),
          );

          // If hotkey was set, update local storage for fast access
          if (pendingHotkey && snippetId && !String(snippetId).startsWith('temp-')) {
            const compoundId = getItemCompoundId({
              id: snippetId,
              folder_id: folderIdForSave,
              workspace_id: targetWorkspaceId,
            });
            await updateLocalHotkey(compoundId, pendingHotkey, 'link');
          }

          // Back up search tags to local storage fallback
          if (snippetId && !String(snippetId).startsWith('temp-')) {
            try {
              chrome.storage.local.get('alts_searchtags_backup', result => {
                const backup = result.alts_searchtags_backup || {};
                backup[snippetId] = tagToUse ? tagToUse.name : '';
                chrome.storage.local.set({ alts_searchtags_backup: backup });
              });
            } catch (e) {
              console.warn('Failed to back up search tags locally:', e);
            }
          }

          // Sync pending shortcut for new snippet
          if (pendingShortcut && snippetId && !String(snippetId).startsWith('temp-')) {
            try {
              await updateSnippetShortcut(snippetId, pendingShortcut);
              const compoundId = getItemCompoundId({
                id: snippetId,
                folder_id: folderIdForSave,
                workspace_id: targetWorkspaceId,
              });
              await updateLocalShortcut(compoundId, snippetId, pendingShortcut, trimmedTitle, 'link');
            } catch (e) {
              console.error('Failed to sync pending shortcut:', e);
            }
          }

          // Sync pending favorite for new snippet
          if (isFav && snippetId && !String(snippetId).startsWith('temp-')) {
            try {
              // Always get a fresh userId at save time — the component state may still be empty
              // if getUserId() hadn't resolved before the user clicked Save.
              const freshUserId = userId || (await getUserId().catch(() => '')) || responseSnippet?.user_id || '';
              if (!freshUserId) throw new Error('No userId available to save favorite');

              const favResponse = await addFavorite(freshUserId, { id: String(snippetId) }, 'snippet');
              if (favResponse?.favourite_id) {
                const result: any = await new Promise(resolve => chrome.storage.local.get('myFavouriteItems', resolve));
                const favItems = result.myFavouriteItems || {};
                const currentTeamFavList: Snippet[] = favItems[freshUserId] || [];

                // If marked as favorite, ensure it has the REAL ID and is in the list
                const idx = currentTeamFavList.findIndex(fav => String(fav.id) === String(snippetId));
                if (idx === -1) {
                  currentTeamFavList.push({
                    id: snippetId,
                    favourite_id: favResponse.favourite_id,
                    key: trimmedTitle,
                    value: valueForRequest,
                    category,
                    tags: snippetTags,
                    user_id: responseSnippet?.user_id || freshUserId,
                    first_name: responseSnippet?.first_name || '',
                    last_name: responseSnippet?.last_name ?? null,
                    created_at: responseSnippet?.created_at || nowIso,
                    updated_at: responseSnippet?.updated_at || nowIso,
                  });
                } else {
                  currentTeamFavList[idx] = {
                    ...currentTeamFavList[idx],
                    favourite_id: favResponse.favourite_id,
                    key: trimmedTitle,
                    value: valueForRequest,
                  };
                }

                const updatedMapping = { ...favItems, [freshUserId]: currentTeamFavList };
                await new Promise<void>(resolve =>
                  chrome.storage.local.set({ myFavouriteItems: updatedMapping }, resolve),
                );

                // Fire sync trigger so useFavoritesSync re-runs and FavoritesPanel picks up the new item
                chrome.storage.local.set({ user_fav_sync_trigger: Date.now() });
              }
            } catch (e) {
              console.error('Failed to sync pending favorite:', e);
            }
          }

          // Sync pending todo for new snippet
          if (pendingTodoData && snippetId && !String(snippetId).startsWith('temp-')) {
            const tempTodoId = pendingTodoData.tempId;
            convertSnippetToTodo(
              { snippet_id: snippetId },
              pendingTodoData.deadlineVal,
              pendingTodoData.isRecurring,
              pendingTodoData.isRecurring ? (pendingTodoData.recurringCycle || 'daily') : undefined,
              pendingTodoData.taskTitle,
            ).then(res => {
              if (chrome.storage.local && res?.todo_id) {
                chrome.storage.local.get(['local_todos'], (r: any) => {
                  const fresh = (r.local_todos || []).map((t: any) =>
                    String(t.snippet_id || t.id) === String(tempTodoId)
                      ? { ...t, snippet_id: snippetId, todo_id: res.todo_id }
                      : t
                  );
                  chrome.storage.local.set({ local_todos: fresh });
                });
              }
              // Schedule alarm for background notifications
              const chromeAny = (window as any).chrome;
              if (pendingTodoData.deadlineVal && chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({
                  action: 'schedule_todo_alarm',
                  todoId: String(res?.todo_id || snippetId),
                  deadline: pendingTodoData.deadlineVal,
                  is_anytime: pendingTodoData.isAnytime
                });
              }
              window.dispatchEvent(new CustomEvent('todosUpdated'));
            }).catch(err => console.warn('[LinkEditModal] Cloud todo sync failed:', err));
            setPendingTodoData(null);
          }

          if (!isAutoSave) {
            setSelectedLinks([]);
            setTitle('');
            setSelectedTag(null);
            setPendingHotkey('');
            setPendingShortcut('');
            setIsFav(false);
            setTimeout(() => {
              onClose();
            }, 1500);
          }
          return snippetId;
        }
      } catch (error: any) {
        console.error('Save error details:', error);
        const serverErrorMessage = error?.response?.data?.error || error?.message || 'Failed to save links';

        // Specifically handle the UUID error to give a better message
        if (
          typeof serverErrorMessage === 'string' &&
          serverErrorMessage.includes('invalid input syntax for type uuid')
        ) {
          showFooterStatus('error', 'Sync error: Temporary ID detected. Please refresh.');
        } else {
          showFooterStatus('error', serverErrorMessage);
        }
        // triggerToast(serverErrorMessage, 'error'); // Removed duplicate toast
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
        // Removed the auto-reset here to let the error persist in footer for visibility
        // The showFooterStatus helper handles its own timeout for 'success', and we might want errors to stick or timeout manually
      }
    },
    [
      folderIdForSave,
      initialSnippet,
      isEditMode,
      isLocationPickerOpen,
      isSaving,
      selectedLinks,
      targetName,
      targetWorkspaceId,
      teamId,
      title,
      onClose,
      getHostname,
      pendingHotkey,
      pendingShortcut,
      isFav,
      userId,
      allTeams,
      dispatch,
      reload,
      pendingTodoData,
    ],
  );

  const parseSnippetValue = useCallback((value: string): SelectedLink[] => {
    if (!value) return [];
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.urls)) {
          return parsed.urls.map((url: string, index: number) => ({
            id: `cloud-${index}-${Date.now()}`,
            url,
            name: parsed.names?.[index] || getHostname(url),
            source: 'link' as const,
          }));
        }
      }
    } catch (e) {
      console.warn('[LinkEditModal] Failed to parse snippet value:', e);
    }
    return [{
      id: `cloud-single-${Date.now()}`,
      url: value,
      name: '',
      source: 'link' as const,
    }];
  }, [getHostname]);

  const handleResolveConflictOverwrite = useCallback(async () => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    
    // Set sync baseline to cloud timestamp so retry bypasses comparison check
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    
    // Retry saving
    await handleSave(false, localData.selectedLinks, localData.title);
  }, [conflictModalData, handleSave]);

  const handleResolveConflictMerge = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    
    const merged = [...localData.selectedLinks];
    cloudLinks.forEach(cl => {
      if (!merged.some(l => l.url === cl.url)) {
        merged.push(cl);
      }
    });

    setTitle(cloudSnippet.key || localData.title);
    setSelectedLinks(merged);
    
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Merged local and cloud edits');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const handleResolveConflictDiscard = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet } = conflictModalData;
    
    setTitle(cloudSnippet.key || '');
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    setSelectedLinks(cloudLinks);
    
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Loaded cloud version');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const hasSyncedInitialDataRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasSyncedInitialDataRef.current = false;
    }
  }, [isOpen]);

  const {
    saveStatus: autoSaveStatus,
    syncInitialData,
    resetSaveStatus,
    hasUnsavedChanges,
    lastSavedAt,
  } = useAutoSave({
    debounceMs: selectedTeam?.storageMode === 'local' ? 300 : 2000,
    // Only track actual link content — NOT metadata like workspace, hotkey, tag, isFav.
    // Those are read directly by handleSave at call-time and must NOT restart
    // the auto-save timer when the location picker or tag popup changes.
    data: {
      title,
      selectedLinks,
    },
    isValid:
      title.trim() !== '' &&
      selectedLinks.length > 0 &&
      Boolean(targetWorkspaceId) &&
      Boolean(teamId) &&
      (!isEditMode || hasSyncedInitialDataRef.current) &&
      hasUserModifiedRef.current,
    onSave: async (savedData) => {
      const newId = await handleSave(true, savedData.selectedLinks, savedData.title);
      if (newId && typeof newId === 'string' && !isEditMode) {
        const hasQuickLinks = savedData.selectedLinks.some(link => /\[query\]|\{query\}/i.test(link.url));
        const hasNotes = savedData.selectedLinks.some(link => link.source === 'note' || link.url.startsWith('note:'));
        const category = savedData.selectedLinks.length > 1 || hasNotes ? 'TabGroup' : hasQuickLinks ? 'quicklink' : 'link';

        const groupValue =
          category === 'TabGroup' || category === 'quicklink' || savedData.selectedLinks.length > 1
            ? {
                names: savedData.selectedLinks.map(
                  link => link.name || (link.url.startsWith('note:') ? 'Note' : getHostname(link.url)),
                ),
                urls: savedData.selectedLinks.map(link => link.url),
              }
            : null;
        const valueForRequest = groupValue ? JSON.stringify(groupValue) : savedData.selectedLinks[0]?.url || '';

        setLocalSnippetOverride({
          ...(initialSnippet || {}),
          id: newId,
          snippet_id: newId,
          key: savedData.title.trim(),
          value: valueForRequest,
          category: category,
          workspace_id: targetWorkspaceId,
          folder_id: folderIdForSave,
          tags: selectedTag ? [selectedTag] : [],
        } as any);
      }
    },
  });

  // Unload event listener to stash unsaved edits
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        const backupData = {
          title,
          selectedLinks,
          activeSessionId,
          targetWorkspaceId,
          folderIdForSave,
          teamId,
          timestamp: Date.now()
        };
        localStorage.setItem(getBackupKey(), JSON.stringify(backupData));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, getBackupKey, title, selectedLinks, activeSessionId, targetWorkspaceId, folderIdForSave, teamId]);

  // Mount effect to restore stashed backup
  useEffect(() => {
    if (!isOpen) return;

    const rawBackup = localStorage.getItem(getBackupKey());
    if (rawBackup) {
      try {
        const backup = JSON.parse(rawBackup);
        if (backup && Date.now() - backup.timestamp < 24 * 60 * 60 * 1000) {
          
          setTitle(backup.title || '');
          setSelectedLinks(backup.selectedLinks || []);
          if (backup.activeSessionId) {
            setActiveSessionId(backup.activeSessionId);
          }
          if (backup.targetWorkspaceId) {
            setManualWorkspaceId(backup.targetWorkspaceId);
          }
          if (backup.folderIdForSave) {
            setManualFolderId(backup.folderIdForSave);
          }
          // Clear backup after successful restoration so it doesn't loop
          localStorage.removeItem(getBackupKey());
          showFooterStatus('success', 'Restored unsaved changes');
        }
      } catch (err) {
        console.error('[LinkEditModal] Failed to restore stashed backup:', err);
      }
    }
  }, [isOpen, getBackupKey]);

  const [lastSavedMessage, setLastSavedMessage] = useState('');

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

  useEffect(() => {
    if (isEditMode && isOpen && !hasSyncedInitialDataRef.current) {
      if (title.trim() !== '' && selectedLinks.length > 0) {
        // Only sync the content fields (title + links) — not metadata.
        // This tells useAutoSave what the "baseline" looks like so it
        // won't immediately consider the note as dirty after loading.
        syncInitialData({
          title,
          selectedLinks,
        });
        hasSyncedInitialDataRef.current = true;
      }
    }
  }, [
    isEditMode,
    isOpen,
    title,
    selectedLinks,
    syncInitialData,
  ]);

  const handleCreateNew = useCallback(() => {
    setIsForceCreateNew(true);
    setTitle('');
    setSelectedLinks([]);
    setLocalSnippetOverride(null);
    hasInitializedPrefill.current = false;
    hasSyncedInitialDataRef.current = false;
    setIsFav(false);
    setPendingHotkey('');
    setPendingShortcut('');
    setSelectedTag(null);
    setIsRecurring(false);
    setIsAnytime(false);
    setRecurringCycle('daily');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setReminderDate(d.toISOString().split('T')[0]);
    setReminderTime('09:00');
    setCustomLinkUrl('');
    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);
    resetSaveStatus();
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [resetSaveStatus]);

  // Notify parent of dirty state so Container can guard editor switching
  useEffect(() => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const handleCloseAttempt = useCallback(() => {
    const endSessionIfActive = () => {
      if (activeSessionId) {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.windows?.getCurrent) {
          chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
            if (currentWindow?.id) {
              chrome.runtime.sendMessage({
                action: 'end_session',
                windowId: currentWindow.id
              }).catch(e => console.error('[LinkEditModal] Failed to send end_session to background:', e));
            }
          });
        }
        setActiveSessionId(null);
      }
    };

    // Silent save & exit logic
    if (hasUnsavedChanges && title.trim() !== '' && selectedLinks.length > 0 && targetWorkspaceId && teamId) {
      dispatch(queueNotification({ message: 'Saving changes...', type: 'success' }));
      handleSave(true)
        .then(() => {
          endSessionIfActive();
          onClose();
        })
        .catch(err => {
          console.error('[LinkEditModal] Background save failed:', err);
          endSessionIfActive();
          onClose();
        });
    } else {
      clearStashedBackup();
      endSessionIfActive();
      onClose();
    }
  }, [hasUnsavedChanges, title, selectedLinks, targetWorkspaceId, teamId, handleSave, dispatch, onClose, activeSessionId]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && event.key === 'Escape') {
        if (isLeftCustomLinkFormOpen || isCustomLinkFormOpen) return;
        if (document.getElementById('hotkey-assignment-popup')) return;

        event.preventDefault();
        event.stopPropagation(); // Stop propagation to prevent leak to Container

        handleCloseAttempt();
        return;
      }
      // Create New Shortcut: Cmd+Enter (Mac) or Ctrl+Enter (Win)
      else if ((isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (isEditMode) {
          handleCreateNew();
        }
      }
      // Location Picker Shortcut: Alt+Enter (Win) -> Option+Enter (Mac)
      else if (
        event.altKey && // Option is also altKey on Mac
        event.key === 'Enter'
      ) {
        event.preventDefault();
        if (isSaving) return;
        if (!selectedTeam || (selectedTeam.workspaces || []).length === 0) {
          showFooterStatus('error', 'Create a workspace first');
          return;
        }
        setIsLocationPickerOpen(prev => !prev);
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        setIsCustomLinkFormOpen(true);
        setCustomLinkUrl(prev => (prev && prev.length > 0 ? prev : ''));
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    handleSave,
    isSaving,
    needsDestinationSelection,
    onClose,
    selectedTeam,
    isOpen,
    hasUnsavedChanges,
    title,
    selectedLinks,
    targetWorkspaceId,
    teamId,
    dispatch,
    handleCloseAttempt,
    isMac,
    isEditMode,
    isLeftCustomLinkFormOpen,
    isCustomLinkFormOpen,
  ]);

  // Browser-level warning for unsaved changes commented out per request
  /*
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isOpen) return undefined;
      const hasUnsavedChanges = !isEditMode && (selectedLinks.length > 0 || title.trim().length > 0);

      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, isEditMode, selectedLinks.length, title]);
  */

  const sortedWindowEntries = useMemo(
    () => Object.entries(tabsByWindow).sort((a, b) => Number(a[0]) - Number(b[0])),
    [tabsByWindow],
  );

  const allTabs = useMemo(() => {
    return sortedWindowEntries.flatMap(([, tabs]) => tabs);
  }, [sortedWindowEntries]);

  const [focusedTabIndex, setFocusedTabIndex] = useState(0);

  // Reset focus index when changing tabs
  useEffect(() => {
    setFocusedTabIndex(0);
  }, [activeContentTab]);

  // Sync focus index when left custom link form is toggled
  useEffect(() => {
    if (isLeftCustomLinkFormOpen) {
      setFocusedTabIndex(allRenderedItems.length);
    }
  }, [isLeftCustomLinkFormOpen, allRenderedItems.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Skip global "Enter to add link" if certain interactive elements are focused
      const focused = document.activeElement;
      const isHeaderElementFocused =
        focused === titleInputRef.current ||
        focused === favButtonRef.current ||
        (hotkeyButtonRef.current &&
          (focused === hotkeyButtonRef.current || hotkeyButtonRef.current.contains(focused as Node)));

      if (
        isCustomLinkFormOpen ||
        isLeftCustomLinkFormOpen ||
        isLocationPickerOpen ||
        isAltEnterPickerOpen ||
        editingUrlId
      )
        return;

      const totalNavigable = allRenderedItems.length + 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev >= totalNavigable - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev <= 0 ? totalNavigable - 1 : prev - 1));
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        // Stop global Enter trigger if typing in any input/textarea (like Title input, Search Tags input, etc.)
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
          return;
        }
        // Trigger Add Link even when typing in the title input (keeping focus in title input)
        e.preventDefault();
        e.stopPropagation();
        if (focusedTabIndex === allRenderedItems.length) {
          setIsLeftCustomLinkFormOpen(true);
          setCustomLinkUrl('');
        } else if (allRenderedItems[focusedTabIndex]) {
          const { item, isAdded } = allRenderedItems[focusedTabIndex];

          if (isAdded) {
            removeLink(item.id);
          } else {
            addItemFromContentBar(item);
          }
        }
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [
    allRenderedItems,
    selectedLinks,
    focusedTabIndex,
    addLink,
    addItemFromContentBar,
    removeLink,
    editingUrlId,
    isAltEnterPickerOpen,
    isCustomLinkFormOpen,
    isLeftCustomLinkFormOpen,
    isLocationPickerOpen,
    isOpen,
  ]);

  // Auto-select first tab when opening in create mode - DISABLED per user request
  // useEffect(() => {
  //   if (isOpen && !isEditMode && !hasAutoSelectedRef.current && allTabs.length > 0) {
  //     addLink(allTabs[0]);
  //     hasAutoSelectedRef.current = true;
  //   }
  //   if (!isOpen) {
  //     hasAutoSelectedRef.current = false;
  //   }
  // }, [isOpen, isEditMode, allTabs, addLink]);

  useEffect(() => {
    const el = tabItemRefs.current[focusedTabIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedTabIndex]);

  if (!isOpen) return null;

  const globalTabRenderIndex = 0;

  return (
    <>
      <div
        className="flex flex-row flex-1 h-full relative text-left w-full  custom-scrollbar"
      >
        <div className="flex flex-col gap-1 w-[560px] max-w-full flex-shrink h-full min-w-[350px]">
          <div className={clsx(
            "flex-1 flex flex-col text-[#073642] dark:text-neutral-200 relative bg-transparent dark:bg-transparent border-none",
            (isLeftCustomLinkFormOpen && linkSuggestions.length > 0) ? "overflow-visible" : "overflow-hidden"
          )}>
            {/* Main Content Area (Centered) */}
            <div className="w-full flex flex-col items-stretch justify-start flex-shrink-0">
              <div className="w-full flex items-center py-2.5 px-2 border-b border-white/50 dark:border-white/10">
                {/* Title Input - Left */}
                <div className="flex items-center flex-1 min-w-0 relative">
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={event => {
                      setTitle(event.target.value);
                      setIsTitleManuallyModified(true);
                      hasUserModifiedRef.current = true;
                    }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowRight') {
                        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
                          e.preventDefault();
                          closeButtonRef.current?.focus();
                        }
                      }
                    }}
                    placeholder="Collection Title"
                    className="flex-1 text-2xl font-semibold text-[#073642] dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none transition-all min-w-0 pl-2"
                  />

                  {/* Auto-save error indicator (inline next to title) */}
                  {autoSaveStatus === 'error' && footerStatus.type === 'error' && (
                    <span className="ml-3 text-[12px] font-semibold text-red-500 whitespace-nowrap shrink-0">
                      {footerStatus.message}
                    </span>
                  )}
                </div>

                {/* Auto-save indicator */}
                <div className="flex items-center gap-1 ml-2 transition-opacity duration-300">
                  {(isEditMode || (title.trim().length > 0 && selectedLinks.length > 0)) && (
                    <>
                      {autoSaveStatus === 'saving' && (
                        <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                          Saving...
                        </span>
                      )}

                      {autoSaveStatus !== 'saving' && hasUnsavedChanges && (
                        <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap opacity-70">
                          Saving...
                        </span>
                      )}

                      {autoSaveStatus === 'saved' && !hasUnsavedChanges && (
                        <span className="text-sm font-medium text-[#93a1a1] dark:text-neutral-500 flex items-center gap-1 whitespace-nowrap">
                          {lastSavedMessage || 'Auto-saved'} <FaCheckCircle className="opacity-70 text-xs text-emerald-500" />
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-auto relative">
                  {isDuplicateTitle && (
                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                      Duplicate title exists
                    </span>
                  )}
                  {!activeSessionId && (
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          const trimmedTitle = title.trim();
                          if (!trimmedTitle) {
                            setSessionName('');
                            setSessionError(null);
                            setSessionDialogOpen(prev => !prev);
                            return;
                          }
                          handleCreateSession(trimmedTitle);
                        }}
                        className="p-2 transition-all rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50 session-btn"
                        title="Start a session — capture tabs automatically">
                        <FaLayerGroup size={13} />
                      </button>

                      {sessionDialogOpen && (
                        <div
                          ref={sessionPopupRef}
                          className="absolute right-0 top-full mt-2 bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-2xl p-4 shadow-2xl w-80 z-[100]"
                          onClick={e => e.stopPropagation()}
                        >
                          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 px-1">
                            Name your session
                          </h3>
                          <input
                            autoFocus
                            type="text"
                            value={sessionName}
                            onChange={e => setSessionName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && sessionName.trim() && !sessionError) {
                                e.preventDefault();
                                handleCreateSession(sessionName);
                              }
                            }}
                            placeholder="e.g. Research session"
                            className="w-full text-xs px-3 py-2 rounded-lg border border-black/10 dark:border-white/10
                                       bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-100
                                       outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/15 mb-3"
                          />
                          {sessionError && (
                            <p className="text-[10px] text-red-500 mb-2 px-1 font-medium">{sessionError}</p>
                          )}
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setSessionDialogOpen(false)}
                              className="px-3 py-1.5 text-[11px] rounded-lg text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!sessionName.trim() || !!sessionError || isStartingSession}
                              onClick={() => handleCreateSession(sessionName)}
                              className={`px-3 py-1.5 text-[11px] rounded-lg border font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white`}
                            >
                              {isStartingSession ? 'Starting…' : 'Start Session'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    ref={closeButtonRef}
                    onClick={handleCloseAttempt}
                    onKeyDown={e => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        if (titleInputRef.current) {
                          titleInputRef.current.focus();
                          titleInputRef.current.selectionStart = titleInputRef.current.value.length;
                          titleInputRef.current.selectionEnd = titleInputRef.current.value.length;
                        }
                      }
                    }}
                    className="p-2 transition-all rounded-lg text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50"
                    title="Close (Esc)">
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Floating Cards Container */}
            <div className="w-full flex-1 flex min-h-0 items-stretch">
              {/* MAIN LIST: Content Bar Source */}
              <div className="w-full flex-1 flex flex-col min-w-0 relative">
                {/* List */}
                <div
                  ref={listContainerRef}
                  className={clsx(
                    "flex-1 min-h-0 bg-transparent w-full max-h-[min(480px,calc(100vh-280px))]",
                    (isLeftCustomLinkFormOpen && linkSuggestions.length > 0)
                      ? "overflow-visible"
                      : "overflow-y-auto custom-scrollbar"
                  )}>
                  <div className="flex flex-col w-full px-3 mt-2 pb-8">
                    {(() => {
                      const renderedSelected = allRenderedItems.filter(i => i.isAdded);
                      const renderedActive = allRenderedItems.filter(i => !i.isAdded);

                      const renderItem = (item: any, isAdded: boolean, idx: number, globalIdx: number) => {
                        const handleToggle = (e?: React.MouseEvent) => {
                          if (e) {
                            e.stopPropagation();
                            e.preventDefault();
                          }
                          if (isAdded) {
                            removeLink(item.id);
                          } else {
                            addItemFromContentBar(item);
                          }
                        };

                        const itemIcon = (() => {
                          if (item.url === 'agent_chat') {
                            const step = (item.originalData?.automation_steps || item.originalData?.steps)?.[0];
                            let urls: string[] = [];
                            if (step?.config?.allAiUrls) {
                              urls = Object.values(step.config.allAiUrls as Record<string, string>)
                                .map(u => String(u))
                                .filter(u => !u.includes('cmd_select_status=false'));
                            } else if (step?.config?.url) {
                              urls = [step.config.url].filter(u => !u.includes('cmd_select_status=false'));
                            }

                            if (urls.length > 0) {
                              return (
                                <div className="flex -space-x-1.5 items-center w-8">
                                  {urls.slice(0, 3).map((url, i) => (
                                    <div
                                      key={`agent-icon-${item.id}-${i}`}
                                      className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1E] overflow-hidden shadow-sm bg-white flex-shrink-0">
                                      <img
                                        src={getFaviconUrl(getHostname(url))}
                                        alt=""
                                        className="w-4 h-4 object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div className="w-5 h-5 rounded flex items-center justify-center bg-[#eee8d5] dark:bg-neutral-800 text-[#93a1a1]">
                                <FaRobot size={12} />
                              </div>
                            );
                          }

                          if (item.favIconUrl) {
                            return <img src={item.favIconUrl} className="w-5 h-5 object-contain" alt="" />;
                          }

                          return (
                            <div className="w-5 h-5 rounded flex items-center justify-center bg-[#eee8d5] dark:bg-neutral-800 text-[#93a1a1]">
                              {item.source === 'note' ? <FaFileAlt size={12} /> : <FaLink size={12} />}
                            </div>
                          );
                        })();

                        const itemLabel = (() => {
                          if (item.source === 'note' || item.url?.startsWith('note:')) {
                            return 'Note';
                          }
                          if (item.url === 'agent_chat') {
                            return 'AI Agent';
                          }
                          return (item.url || '').replace(/^https?:\/\/(www\.)?/i, '');
                        })();

                        return (
                          <div
                            key={item.id}
                            ref={el => {
                              tabItemRefs.current[globalIdx] = el;
                            }}
                            onClick={handleToggle}
                            onDoubleClick={e => {
                              e.stopPropagation();
                              e.preventDefault();
                              openLinkEditPopup(item);
                            }}
                            className={`group flex items-center gap-3 py-2 px-3 transition-all cursor-pointer focus:outline-none first:rounded-t-xl last:rounded-b-xl ${
                              focusedTabIndex === globalIdx
                                ? 'bg-white/10'
                                : 'hover:bg-white/5'
                            }`}>
                            <div className="flex-shrink-0 relative">{itemIcon}</div>

                            <div className="flex-1 min-w-0 flex items-baseline gap-2">
                              <div
                                className={`text-[13.5px] font-normal tracking-tight truncate flex-shrink-0 max-w-[65%] ${
                                  isAdded
                                    ? 'text-white'
                                    : 'text-[#F5F5F5]'
                                }`}
                                style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
                                {item.name}
                              </div>
                              <div
                                className={clsx(
                                  'text-[10.5px] font-normal truncate flex-1 min-w-0 transition-opacity duration-200',
                                  focusedTabIndex === globalIdx ? 'opacity-100' : 'opacity-40 group-hover:opacity-100',
                                  'text-neutral-400',
                                )}>
                                {itemLabel}
                              </div>
                            </div>

                            {/* Action Buttons & Add/Added indicator */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                               {/* Add / Added Text Visual Indicator */}
                               <div
                                 className={clsx(
                                   "text-[12px] font-semibold transition-all duration-200 select-none shrink-0 flex items-center justify-center min-w-[50px]",
                                   isAdded
                                     ? "text-emerald-500 dark:text-emerald-400"
                                     : "text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400"
                                 )}
                               >
                                 {isAdded ? 'Added' : '+ Add'}
                               </div>

                               {/* Three Vertical Dots Dropdown for Added Items */}
                               {isAdded && (
                                 <div 
                                   className="relative shrink-0 three-dots-container flex items-center"
                                 >
                                   <button
                                     type="button"
                                     onClick={e => {
                                       e.stopPropagation();
                                       e.preventDefault();
                                       setActiveMenuLinkId(prev => prev === item.id ? null : item.id);
                                     }}
                                     className={clsx(
                                       "p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center focus:outline-none transition-opacity duration-200",
                                       (activeMenuLinkId === item.id || focusedTabIndex === globalIdx)
                                         ? "opacity-100"
                                         : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                                     )}
                                     title="More options"
                                   >
                                     <FaEllipsisV size={11} />
                                   </button>
                                   
                                   {activeMenuLinkId === item.id && (
                                     <div 
                                       onClick={e => e.stopPropagation()}
                                       className="absolute right-0 top-full mt-1 bg-[#fdf6e3] dark:bg-neutral-900 border border-[#eee8d5] dark:border-neutral-700 rounded-xl shadow-2xl z-[999] py-1 flex flex-col w-32 overflow-hidden"
                                     >
                                       <button
                                         type="button"
                                         onClick={e => {
                                           e.stopPropagation();
                                           e.preventDefault();
                                           setActiveMenuLinkId(null);
                                           openLinkEditPopup(item);
                                         }}
                                         className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-800 hover:text-[#073642] dark:hover:text-white"
                                       >
                                         <FaLink size={10} className="opacity-70" />
                                         <span>Params</span>
                                       </button>
                                       <button
                                         type="button"
                                         onClick={e => {
                                           e.stopPropagation();
                                           e.preventDefault();
                                           setActiveMenuLinkId(null);
                                           duplicateLink(item);
                                         }}
                                         className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-800 hover:text-[#073642] dark:hover:text-white"
                                       >
                                         <FaCopy size={10} className="opacity-70" />
                                         <span>Duplicate</span>
                                       </button>
                                     </div>
                                   )}
                                 </div>
                               )}
                             </div>
                          </div>
                        );
                      };

                      return (
                        <div className="flex flex-col gap-2">
                          {/* Selected Section */}
                          {(renderedSelected.length > 0 || (activeContentTab === 'Current Tabs' && isLeftCustomLinkFormOpen)) && (
                            <div className="flex flex-col">
                              <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-500 tracking-wider text-left bg-transparent pt-1 pb-1.5 flex items-center mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span>Selected tabs</span>
                                  {renderedSelected.length > 0 && (
                                    <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">
                                      ({renderedSelected.length})
                                    </span>
                                  )}
                                </div>
                              </h3>
                              
                              <div className={clsx(
                                "flex flex-col border border-[#eee8d5] dark:border-white/10 rounded-xl divide-y divide-[#eee8d5] dark:divide-white/10 bg-[#fdf6e3]/10 dark:bg-white/[0.02]",
                                (!isLeftCustomLinkFormOpen && activeContentTab === 'Current Tabs' && renderedSelected.length > 0) ? "mb-2" : "mb-3"
                              )}>
                                {/* Selected Items */}
                                {renderedSelected.length > 0 && (
                                  renderedSelected.map((wrap, idx) => renderItem(wrap.item, wrap.isAdded, idx, idx))
                                )}

                                {/* Custom link form appended inside the card wrapper when input form is open */}
                                {activeContentTab === 'Current Tabs' && isLeftCustomLinkFormOpen && (
                                  <div
                                    ref={el => {
                                      tabItemRefs.current[allRenderedItems.length] = el as any;
                                    }}
                                    className="flex items-center gap-3 py-2 px-3 transition-all focus:outline-none bg-transparent relative z-50 last:rounded-b-xl">
                                    
                                    {/* Inline Text Input */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0">
                                      <input
                                        ref={customLinkUrlRef}
                                        value={customLinkUrl}
                                        onChange={event => setCustomLinkUrl(event.target.value)}
                                        onKeyDown={event => {
                                          if (
                                            linkSuggestions.length > 0 &&
                                            (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                                          ) {
                                            event.preventDefault();
                                            if (event.key === 'ArrowDown') {
                                              setFocusedSuggestionIndex(prev =>
                                                Math.min(prev + 1, linkSuggestions.length - 1),
                                              );
                                            } else {
                                              setFocusedSuggestionIndex(prev => Math.max(prev - 1, -1));
                                            }
                                            return;
                                          }

                                          if (event.key === 'Enter') {
                                            event.preventDefault();
                                            event.stopPropagation();

                                            if (focusedSuggestionIndex >= 0 && linkSuggestions[focusedSuggestionIndex]) {
                                              const item = linkSuggestions[focusedSuggestionIndex];
                                              setSelectedLinks(prev => [
                                                ...prev,
                                                {
                                                  id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                                                  url: item.url,
                                                  name: item.title || getHostname(item.url),
                                                  source: 'custom',
                                                  favIconUrl: getFaviconUrl(getHostname(item.url)),
                                                },
                                              ]);
                                              setCustomLinkUrl('');
                                              setCustomLinkName('');
                                              setIsLeftCustomLinkFormOpen(false);
                                              setLinkSuggestions([]);
                                              setActiveContentTab('Current Tabs');
                                              return;
                                            }

                                            handleAddCustomLink();
                                          } else if (event.key === 'Escape') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setIsLeftCustomLinkFormOpen(false);
                                            setCustomLinkUrl('');
                                            setCustomLinkName('');
                                          }
                                        }}
                                        placeholder="Type or paste a URL..."
                                        autoFocus
                                        className="w-full bg-transparent border-none text-[13.5px] font-normal text-[#073642] dark:text-neutral-100 placeholder-[var(--color-textPlaceholder)]/50 focus:outline-none h-6"
                                        style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
                                      />
                                      {linkSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-[#1C1C1E] border border-[#eee8d5] dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99] overflow-hidden max-h-[250px] flex flex-col">
                                          <div className="px-3 py-1.5 text-[10px] font-bold text-[#93a1a1] dark:text-neutral-500  tracking-wider bg-[#fdf6e3]/50 dark:bg-black/20 border-b border-[#eee8d5] dark:border-white/5">
                                            Suggestions
                                          </div>
                                          <div className="overflow-y-auto custom-scrollbar">
                                            {linkSuggestions.map((suggestion, idx) => (
                                              <div
                                                key={idx}
                                                className={`px-3 py-2 cursor-pointer flex items-center gap-3 transition-colors ${
                                                  focusedSuggestionIndex === idx
                                                    ? 'bg-[#3B66AE] text-white'
                                                    : 'hover:bg-[#fdf6e3] dark:hover:bg-white/5 text-[#073642] dark:text-neutral-200'
                                                }`}
                                                onClick={() => {
                                                  const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                                                  setSelectedLinks(prev => [
                                                    ...prev,
                                                    {
                                                      id,
                                                      url: suggestion.url,
                                                      name: suggestion.title || getHostname(suggestion.url),
                                                      source: 'custom',
                                                      favIconUrl: getFaviconUrl(getHostname(suggestion.url)),
                                                    },
                                                  ]);
                                                  setCustomLinkUrl('');
                                                  setCustomLinkName('');
                                                  setIsLeftCustomLinkFormOpen(false);
                                                  setLinkSuggestions([]);
                                                  setActiveContentTab('Current Tabs');
                                                }}>
                                                <div className="flex-shrink-0 relative">
                                                  <img
                                                    src={getFaviconUrl(getHostname(suggestion.url))}
                                                    alt=""
                                                    className="w-3.5 h-3.5 rounded-sm object-cover"
                                                    onError={(e) => {
                                                      e.currentTarget.style.display = 'none';
                                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                  />
                                                  <div className="hidden w-3.5 h-3.5 rounded flex items-center justify-center text-[#93a1a1]">
                                                    {suggestion.source === 'bookmark' ? <FaBookmark size={10} /> : <FaHistory size={10} />}
                                                  </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div
                                                    className={`font-medium truncate ${focusedSuggestionIndex === idx ? 'text-white' : 'text-[#586e75] dark:text-neutral-200'}`}>
                                                    {suggestion.title}
                                                  </div>
                                                  <div
                                                    className={`truncate opacity-80 text-[10px] ${focusedSuggestionIndex === idx ? 'text-white/70' : 'text-[#93a1a1]'}`}>
                                                    {suggestion.url}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {!isLeftCustomLinkFormOpen && activeContentTab === 'Current Tabs' && renderedSelected.length > 0 && (
                                <div className="flex justify-center w-full mb-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsLeftCustomLinkFormOpen(true);
                                      setCustomLinkUrl('');
                                    }}
                                    className="p-2 rounded-full border border-[var(--color-borderDefault)] hover:bg-[#eee8d5] dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                    title="Add Custom Link"
                                  >
                                    <FaPlus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Active Tabs Section */}
                          {renderedActive.length > 0 && (
                            <div className="flex flex-col">
                              <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-500 tracking-wider text-left bg-transparent pt-1 pb-1.5 flex items-center mb-1">
                                <span>{activeContentTab === 'All saved files' ? 'Saved files' : 'Current tabs'}</span>
                                <span className="ml-1 text-xs font-bold text-neutral-400 dark:text-neutral-500">
                                  ({renderedActive.length})
                                </span>
                              </h3>
                              <div className="flex flex-col border border-[#eee8d5] dark:border-white/10 rounded-xl overflow-hidden divide-y divide-[#eee8d5] dark:divide-white/10 bg-[#fdf6e3]/10 dark:bg-white/[0.02]">
                                {renderedActive.map((wrap, idx) => renderItem(wrap.item, wrap.isAdded, idx, renderedSelected.length + idx))}
                              </div>
                            </div>
                          )}

                          {/* Empty State when no items are available */}
                          {allRenderedItems.length === 0 && !isLeftCustomLinkFormOpen && (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                              <div className="w-12 h-12 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3">
                                <FaLink size={20} />
                              </div>
                              <h4 className="text-sm font-semibold text-[var(--color-textPrimary)] mb-1">No tabs selected or open</h4>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[240px] mb-4">
                                Start opening tabs in your browser or add a custom link manually.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsLeftCustomLinkFormOpen(true);
                                  setCustomLinkUrl('');
                                }}
                                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-white/10 transition-all active:scale-95"
                              >
                                Add a custom link
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Inside Border - Temporarily Commented Out
          <div className="relative flex items-center justify-between gap-3 px-8 py-3 bg-transparent dark:bg-transparent text-[10px] font-medium text-[#93a1a1] dark:text-neutral-400 flex-shrink-0 rounded-none border-t border-[#eee8d5] dark:border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCloseAttempt}
                className="flex items-center gap-2 rounded-xl border border-transparent bg-[#eee8d5]/50 dark:bg-white/5 hover:bg-[#eee8d5] px-2.5 py-1 text-[10px] font-semibold text-[#586e75] dark:text-neutral-400 transition-colors group">
                <span>Back</span>
                <span className="text-[8px] font-medium text-[#93a1a1] dark:text-neutral-500 border border-[#eee8d5] dark:border-white/5 bg-[#eee8d5]/50 dark:bg-black/20 px-1 rounded ml-1">
                  Esc
                </span>
              </button>
              {(isCustomLinkFormOpen || isLeftCustomLinkFormOpen) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomLinkUrl(prev => (prev || '').trim() + '{query}');
                    customLinkUrlRef.current?.focus();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-transparent bg-[#eee8d5]/50 dark:bg-white/5 hover:bg-[#eee8d5] px-2.5 py-1 text-[10px] font-semibold text-[#586e75] dark:text-neutral-400 transition-colors group">
                  <span className="text-[#93a1a1] dark:text-neutral-400 font-bold">@</span>
                  <span>Insert {'{query}'}</span>
                </button>
              )}
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <button
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-transparent bg-transparent px-2 py-0.5 text-xs font-medium text-[#93a1a1]/70 dark:text-neutral-500 hover:text-[#586e75] dark:hover:text-neutral-300 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30 transition-all">
                  {hasDestination ? (
                    <>
                      <span className="opacity-60">📁</span>
                      {destinationDetails.iconType === 'globe' ? (
                        <FaGlobe size={12} className="opacity-60" />
                      ) : destinationDetails.iconType === 'users' ? (
                        <FaUsers size={12} className="opacity-60" />
                      ) : (
                        <FaLock size={12} className="opacity-60" />
                      )}
                    </>
                  ) : (
                    <FaFolder size={12} className="opacity-60" />
                  )}
                  <span className="truncate max-w-[200px]" title={destinationDetails.pathText}>
                    {hasDestination ? destinationDetails.pathText : 'Change Folder'}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] font-medium text-[#93a1a1]/50 dark:text-neutral-600">
                    <span className="rounded-md border border-transparent bg-[var(--color-containerBg)] px-1 py-0">
                      {isMac ? '⌥' : 'Alt'}
                    </span>
                    <span>+</span>
                    <span className="rounded-md border border-transparent bg-[var(--color-containerBg)] px-1 py-0">
                      Enter
                    </span>
                  </span>
                </button>

                {isLocationPickerOpen && (
                  <SaveDestinationPicker
                    team={orgTeam}
                    personalWorkspaces={personalWorkspaces}
                    currentSelection={{
                      workspaceId: targetWorkspaceId,
                      folderId: folderIdForSave,
                    }}
                    onSelectWorkspace={handleWorkspaceDestination}
                    onSelectFolder={handleFolderDestination}
                    onClose={() => setIsLocationPickerOpen(false)}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[100] shadow-2xl border-neutral-700 w-80"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {footerStatus.type !== 'idle' && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-[#586e75] dark:text-neutral-300">
                  <div
                    className={`w-2 h-2 rounded-full ${footerStatus.type === 'saving' ? 'animate-pulse' : ''} ${footerStatus.type === 'error'
                        ? 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.4)]'
                        : footerStatus.type === 'success'
                          ? 'bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]'
                          : 'bg-amber-500 shadow-[0_0_6px_2px_rgba(245,158,11,0.4)]'
                      }`}
                  />
                  <span>{footerStatus.message}</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${isSaving
                    ? 'cursor-not-allowed border-[#eee8d5] dark:border-neutral-700 bg-[#eee8d5]/50 dark:bg-neutral-800 text-[#93a1a1] dark:text-neutral-500'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-[#073642] dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}>
                {isSaving ? 'Saving...' : 'Save'}
                <span className="flex items-center gap-0.5 text-[8px] font-semibold text-[#93a1a1] dark:text-neutral-300">
                  <span className="rounded border border-[#eee8d5] dark:border-white/20 bg-[#fdf6e3] dark:bg-neutral-700 px-0.5">
                    {isMac ? '⌘' : 'Ctrl'}
                  </span>
                  <span className="text-[#93a1a1] dark:text-neutral-300">+</span>
                  <span className="rounded border border-[#eee8d5] dark:border-white/20 bg-[#fdf6e3] dark:bg-neutral-700 px-0.5">
                    Enter
                  </span>
                </span>
              </button>
            </div>
          </div>
          */}

          {/* Footer for Actions */}
          <div className="relative flex flex-col w-full flex-shrink-0">
            {/* Create New Floating Button */}
            {isEditMode && !activeSessionId && !hasUnsavedChanges && (
              <div className="w-full flex justify-end px-4 pb-4 pt-1 bg-transparent">
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white">
                  Create new
                  <span className="flex items-center gap-0.5 text-[9px] font-medium opacity-90 ml-1">
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
        </div>

        {/* Floating Sidebar Toggle Button placed on the far right */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-50">
          <button
            type="button"
            onClick={() => {
              setIsSidebarCollapsed(prev => !prev);
              setIsHoverPeeking(false);
            }}
            onMouseEnter={() => {
              if (!isSidebarCollapsed) return;
              if (hoverPeekTimeoutRef.current) {
                window.clearTimeout(hoverPeekTimeoutRef.current);
                hoverPeekTimeoutRef.current = null;
              }
              setIsHoverPeeking(true);
            }}
            onMouseLeave={() => {
              if (!isSidebarCollapsed) return;
              hoverPeekTimeoutRef.current = window.setTimeout(() => {
                setIsHoverPeeking(false);
              }, 200);
            }}
            className="w-8 h-8 rounded-full bg-[var(--color-containerBg)] border border-black/10 dark:border-white/15 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-md focus:outline-none"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed && !isHoverPeeking ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
          </button>
        </div>

        {/* RIGHT COLUMN - Metadata & Settings
            KEY: When collapsed, we keep a 20px invisible strip (w-5 opacity-0 overflow-hidden)
            instead of w-0, so the div always exists in the DOM as a hover target.
            onMouseEnter on this strip + the toggle button above both trigger the peek. */}
        <div
          ref={sidebarHoverAreaRef}
          className={clsx(
            "flex-shrink-0 flex flex-col bg-transparent dark:bg-transparent overflow-hidden custom-scrollbar",
            isSidebarCollapsed && !isHoverPeeking ? 'opacity-0' : 'overflow-y-auto'
          )}
          style={{
            width: isSidebarCollapsed && !isHoverPeeking ? '20px' : '280px',
            minWidth: isSidebarCollapsed && !isHoverPeeking ? '20px' : '280px',
          }}
          onMouseEnter={() => {
            if (!isSidebarCollapsed) return;
            if (hoverPeekTimeoutRef.current) {
              window.clearTimeout(hoverPeekTimeoutRef.current);
              hoverPeekTimeoutRef.current = null;
            }
            setIsHoverPeeking(true);
          }}
          onMouseLeave={() => {
            if (!isSidebarCollapsed) return;
            hoverPeekTimeoutRef.current = window.setTimeout(() => {
              setIsHoverPeeking(false);
            }, 200);
          }}
        >
          <div className="w-[280px] min-h-full flex flex-col">
            <div className="flex-1 px-4 py-6 flex flex-col gap-6">
              {/* Note Options Section */}
              <div className="space-y-3">
                <div className="bg-[var(--color-editorBg)] border border-black/5 dark:border-white/20 rounded-2xl p-2 flex flex-col gap-0.5">
                  <h3 className="text-xs font-semibold text-neutral-400 px-1 pb-2 pt-1 flex items-center">
                    <span>Link Options</span>
                  </h3>
                  {/* Folder Picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        setIsLocationPickerOpen(prev => !prev);
                      }}
                      disabled={saveStatus === 'saving'}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 min-w-0 flex-1 pr-2">
                        <FaFolder className="text-[var(--color-iconDefault)] flex-shrink-0" />
                        <span className="truncate" title={destinationDetails.pathText}>
                          {hasDestination ? destinationDetails.pathText : 'Folders'}
                        </span>
                      </div>
                      <span className="text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1.2em" width="1.2em"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>
                      </span>
                    </button>
                    {isLocationPickerOpen && (
                      <div className="absolute right-0 top-full mt-2 z-[100] w-[260px]">
                        <SaveDestinationPicker
                          team={orgTeam}
                          personalWorkspaces={personalWorkspaces}
                          currentSelection={{
                            workspaceId: targetWorkspaceId,
                            folderId: folderIdForSave,
                          }}
                          onSelectWorkspace={handleWorkspaceDestination}
                          onSelectFolder={handleFolderDestination}
                          onClose={() => setIsLocationPickerOpen(false)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Favorite Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                      <FiStar className="text-[var(--color-iconDefault)] flex-shrink-0 h-4 w-4" />
                      <span>Favorite</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FiStar className={`w-[18px] h-[18px] transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--color-iconDefault)] group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`} />
                    </div>
                  </button>

                  {/* Tags */}
                  <div className="relative" ref={popupRef}>
                    <button
                      type="button"
                      onClick={handleTagIconClick}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        <FiTag className="text-[var(--color-iconDefault)] h-4 w-4 flex-shrink-0" />
                        <span>Tags</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedTag && (
                          <span className="text-xs bg-[var(--color-snippetChipBg)] text-[var(--color-textPrimary)] px-2 py-0.5 rounded-full max-w-[80px] truncate">
                            {selectedTag.name}
                          </span>
                        )}
                        <span className="text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
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

                  {/* Hotkey Assign */}
                  {/* <HotkeyAssignButton
                    itemId={getItemCompoundId(
                      initialSnippet || {
                        id: '',
                        workspace_id: targetWorkspaceId,
                        folder_id: folderIdForSave,
                      },
                    )}
                    currentHotkey={pendingHotkey}
                    onHotkeyChange={handleHotkeyChange}
                    currentShortcut={pendingShortcut}
                    onShortcutChange={handleShortcutChange}
                    onClose={() => setTimeout(() => titleInputRef.current?.focus(), 0)}
                    className="w-full !p-2.5 !rounded-xl !bg-transparent hover:!bg-black/5 dark:hover:!bg-white/5 !border-none transition-colors !justify-start !gap-3 text-neutral-600 dark:text-neutral-300"
                    onOverwriteHotkey={initialSnippet?.id ? handleOverwriteHotkey : undefined}
                    onOverwriteShortcut={initialSnippet?.id ? handleOverwriteShortcut : undefined}
                    isFavorite={isFav}
                    onToggleFavorite={handleToggleFavorite}
                  /> */}

                </div>
              </div>

              {/* Reminder & Schedule Section */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 bg-[var(--color-editorBg)] border border-black/5 dark:border-white/20 rounded-2xl p-2">
                  <h3 className="text-xs font-semibold text-neutral-400 px-1 pb-1 pt-1 flex items-center">
                    <span>Reminder & Schedule</span>
                  </h3>
                  {/* Segmented Control */}
                  <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => { setIsRecurring(false); setIsAnytime(false); setIsTimeModeDropdownOpen(false); setIsTimePickerOpen(false); }}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${!isRecurring ? 'bg-white shadow-sm dark:bg-white/15 text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
                    >
                      One-Time
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsRecurring(true); setIsAnytime(true); setIsTimeModeDropdownOpen(true); setIsTimePickerOpen(false); }}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${isRecurring ? 'bg-white shadow-sm dark:bg-white/15 text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
                    >
                      Recurring
                    </button>
                  </div>

                  {/* Date & Time Selectors aligned row-wise */}
                  <div className="flex flex-col gap-1">
                    <div className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                      if (isRecurring) {
                        setIsTimeModeDropdownOpen(prev => !prev);
                        setIsTimePickerOpen(false);
                      } else {
                        setIsTimePickerOpen(prev => !prev);
                        setIsTimeModeDropdownOpen(false);
                      }
                    }}>
                      <div className="flex items-center gap-3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Time</span>
                      </div>
                      
                      <div className="flex items-center" onClick={(e) => {
                        if (!isAnytime) {
                          e.stopPropagation();
                          setIsTimePickerOpen(prev => !prev);
                          setIsTimeModeDropdownOpen(false);
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

                      {(isRecurring && isTimeModeDropdownOpen) && (
                        <div ref={timeDropdownRef} className="absolute left-0 top-full mt-2 w-[180px] rounded-xl shadow-2xl z-[150] bg-[#1B1B1C] border border-[#2D2E30] overflow-hidden py-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsAnytime(true); setIsTimeModeDropdownOpen(false); setIsTimePickerOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left hover:bg-white/5 text-neutral-300 hover:text-white`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span className="font-medium">Anytime of the day</span>
                          </button>
                          <div className="h-px bg-[#2D2E30] my-0.5"></div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsAnytime(false); setIsTimeModeDropdownOpen(false); setIsTimePickerOpen(true); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left hover:bg-white/5 text-neutral-300 hover:text-white`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 dark:text-neutral-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Date</span>
                      </div>
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none outline-none text-sm text-neutral-500 dark:text-neutral-400 p-0 text-right w-[120px] focus:ring-0 cursor-pointer dark:color-scheme-dark"
                      />
                    </div>
                    {isRecurring && (
                      <div 
                        className="relative flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" 
                        ref={cyclePopupRef}
                        onClick={() => setIsCycleDropdownOpen(prev => !prev)}
                      >
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Cycle</span>
                        <button
                          type="button"
                          className="text-sm text-neutral-500 dark:text-neutral-400 font-medium hover:text-neutral-800 dark:hover:text-white transition-colors flex items-center gap-1.5"
                        >
                          <span className="capitalize">{recurringCycle || 'daily'}</span>
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-3.5 h-3.5 opacity-60" height="1em" width="1em"><path d="M16.293 9.293 12 13.586 7.707 9.293l-1.414 1.414L12 16.414l5.707-5.707z"></path></svg>
                        </button>
                        {isCycleDropdownOpen && (
                          <div className="absolute right-0 bottom-full mb-1 w-[120px] bg-[#141414] border border-white/10 rounded-xl p-1 shadow-lg z-50 flex flex-col gap-0.5">
                            {['daily', 'weekly', 'monthly'].map((cycle) => (
                              <button
                                key={cycle}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                      onClick={handleCreateTodoFromLink}
                      disabled={linkTodoStatus === 'creating'}
                      className={`w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold rounded-xl transition-all shadow-sm ${
                        linkTodoStatus === 'success'
                          ? 'bg-neutral-900 dark:bg-white/10 text-emerald-400 cursor-default ring-1 ring-emerald-500/40'
                          : linkTodoStatus === 'creating'
                          ? 'bg-neutral-800 dark:bg-white/10 text-white/60 cursor-not-allowed opacity-70'
                          : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white/10 dark:hover:bg-white/15 text-white cursor-pointer'
                      }`}
                    >
                      {linkTodoStatus === 'creating' ? (
                        <>
                          <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                          <span>Creating…</span>
                        </>
                      ) : linkTodoStatus === 'success' ? (
                        <>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400"><polyline points="20 6 9 17 4 12" /></svg>
                          <span>Todo Created!</span>
                        </>
                      ) : (
                        <>
                          <BsCalendarCheck size={14} />
                          <span>Create Todo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Link Edit Popup */}
      {editingPopupLinkId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={closeLinkEditPopup}>
          <div
            className="bg-[var(--color-popupBg)] rounded-xl border border-[#eee8d5] dark:border-neutral-700 shadow-2xl p-4 min-w-[600px] max-w-[90%]"
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-[#073642] dark:text-neutral-200 mb-3">Edit Link</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Link Name</td>
                  <td className="py-2">
                    <input
                      ref={linkNameInputRef}
                      value={editingLinkName}
                      onChange={e => setEditingLinkName(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          urlNameInputRef.current?.focus();
                        }
                      }}
                      placeholder="Enter display name for the link"
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Full URL</td>
                  <td className="py-2">
                    <input
                      ref={urlNameInputRef}
                      value={localUrlValue}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/^https?:\/\/(www\.)?/i, '');
                        setLocalUrlValue(cleaned);
                        const parts = parseUrlParts(e.target.value);
                        if (parts) {
                          setEditingUrlParts(parts);
                        }
                      }}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          domainInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs truncate"
                    />
                  </td>
                </tr>
                {/* Only show Domain and Path fields if URL is parseable */}
                {editingUrlParts && (
                  <>
                    <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                      <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Domain</td>
                      <td className="py-2 relative">
                        <HighlightedInput
                          ref={domainInputRef}
                          value={editingUrlParts.domain}
                          onChange={e =>
                            setEditingUrlParts(prev => (prev ? { ...prev, domain: e.target.value } : prev))
                          }
                          onFocus={() => {
                            setFocusedField('domain');
                            setFocusedPathIndex(null);
                          }}
                          onBlur={e => {
                            if (e.relatedTarget === dropdownButtonRef.current) return;
                            setTimeout(() => setShowPathQueryDropdown(false), 150);
                          }}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === '@') {
                              e.preventDefault();
                              lastFocusedInputRef.current = e.currentTarget;
                              setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '@' } : prev));
                              setShowPathQueryDropdown(true);
                            } else if (showPathQueryDropdown) {
                              setShowPathQueryDropdown(false);
                            }
                          }}
                          className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                        />
                        {showPathQueryDropdown && focusedField === 'domain' && (
                          <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                            <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                              Add Variable (Click to select)
                            </div>
                            <button
                              ref={dropdownButtonRef}
                              type="button"
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newDomain = editingUrlParts.domain.replace(
                                    /@$/,
                                    editingUrlParts.domain.endsWith('/') ? '{query}' : '/{query}',
                                  );
                                  setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                } else if (e.key === 'Escape') {
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }
                              }}
                              onClick={e => {
                                e.preventDefault();
                                const newDomain = editingUrlParts.domain.replace(
                                  /@$/,
                                  editingUrlParts.domain.endsWith('/') ? '{query}' : '/{query}',
                                );
                                setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                setShowPathQueryDropdown(false);
                                lastFocusedInputRef.current?.focus();
                              }}
                              className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                              Insert {'{query}'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {editingUrlParts.paths.map((path, idx) => (
                      <tr key={idx} className="border-b border-[#eee8d5] dark:border-neutral-700">
                        <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Path {idx + 1}</td>
                        <td className="py-2 relative">
                          <HighlightedInput
                            value={path}
                            onChange={e => {
                              const newPaths = [...editingUrlParts.paths];
                              newPaths[idx] = e.target.value;
                              setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              if (showPathQueryDropdown) {
                                setShowPathQueryDropdown(false);
                              }
                            }}
                            onFocus={() => {
                              setFocusedField('path');
                              setFocusedPathIndex(idx);
                            }}
                            onBlur={e => {
                              if (e.relatedTarget === dropdownButtonRef.current) return;
                              setTimeout(() => setShowPathQueryDropdown(false), 150);
                            }}
                            onKeyDown={e => {
                              e.stopPropagation();
                              if (e.key === '@') {
                                e.preventDefault();
                                lastFocusedInputRef.current = e.currentTarget;
                                const newPaths = [...editingUrlParts.paths];
                                newPaths[idx] = path + '@';
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                setShowPathQueryDropdown(true);
                              } else if (showPathQueryDropdown) {
                                setShowPathQueryDropdown(false);
                              } else if (e.key === 'Enter' && !/{query}|\[query\]/i.test(path)) {
                                e.preventDefault();
                                const newPaths = [...editingUrlParts.paths];
                                newPaths[idx] = path + '{query}';
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              }
                            }}
                            className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                          />
                          {showPathQueryDropdown && focusedPathIndex === idx && focusedField === 'path' && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                              <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                                Add Variable (Click to select)
                              </div>
                              <button
                                ref={dropdownButtonRef}
                                type="button"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newPaths = [...editingUrlParts.paths];
                                    const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                    newPaths[idx] = path.replace(/@$/, suffix);
                                    setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  } else if (e.key === 'Escape') {
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  }
                                }}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  const newPaths = [...editingUrlParts.paths];
                                  const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                  newPaths[idx] = path.replace(/@$/, suffix);
                                  setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }}
                                className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                                Insert {'{query}'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            <div className="flex justify-between items-center gap-2 mt-4">
              {editingUrlParts && (
                <button
                  type="button"
                  onClick={insertCustomVariable}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  {'{ }'} Insert Param{' '}
                  <span className="ml-1.5 px-1 rounded border border-[#eee8d5] dark:border-neutral-600 bg-[#fdf6e3] dark:bg-white/5 text-[9px] font-bold text-[#93a1a1] dark:text-neutral-400">
                    @
                  </span>
                </button>
              )}
              {!editingUrlParts && <div />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-white bg-neutral-600 rounded-lg hover:bg-neutral-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {conflictModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              Sync Conflict Detected
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
              This session was modified on another device/window since you opened it. How would you like to resolve the conflict?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResolveConflictMerge}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                Merge Changes (Keep Both)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictOverwrite}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-red-500/35 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all transform active:scale-95"
              >
                Overwrite Cloud (Keep Local)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictDiscard}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-[var(--color-borderDefault)] bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all transform active:scale-95"
              >
                Reload Cloud Version (Discard Local)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Session Links Portal */}
      {portalTarget &&
        createPortal(
          <div className="flex flex-col gap-1.5 p-3 h-full overflow-y-auto custom-scrollbar">
            {selectedLinks.length > 0 ? (
              selectedLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 group relative"
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md overflow-hidden bg-white/50 dark:bg-black/20 shadow-sm border border-black/5 dark:border-white/5 group-hover:scale-105 transition-transform">
                    {link.favIconUrl ? (
                      <img src={link.favIconUrl} className="w-3.5 h-3.5 object-contain" alt="" />
                    ) : (
                      <FaLink size={10} className="text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium tracking-wide truncate flex-1 text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                    {link.name || link.url}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                <FaLayerGroup size={24} className="text-neutral-400" />
                <span className="text-[11px] font-medium text-neutral-500">No links captured yet</span>
              </div>
            )}
          </div>,
          portalTarget
        )}

    </>
  );
};

export default LinkEditModal;
