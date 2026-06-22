import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrash, FaSearch, FaPlus, FaCheck, FaArrowRight, FaLink, FaFileAlt, FaAt, FaFolder } from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, optimisticAddSnippet } from '../../../../Redux/AllData/allDataSlice';
import {
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectIsMac,
  queueNotification,
  setSelectedWorkspace,
  setSelectedFolder,
  setSnippetBreadCrum,
} from '../../../../Redux/AllData/uiStateSlice';
import type { Snippet, Folder, Workspace } from '../../../../modals/interfaces';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import SaveDestinationPicker from '../Editor/SaveDestinationPicker';
import { createSnippet, updateSnippetRealtime, type NewSnippet } from '../../../../Apis/features/snippetApi';
import { optimisticUpdateSnippet } from '../../../../Redux/AllData/allDataSlice';
// import useToast from '../Shared/Toast/useToast';
import type { AppDispatch } from '../../../../Redux/store';

// --- Types ---
type BuildTab = 'All' | 'Current Tabs' | 'Saved Links' | 'Notes';

interface BuildItem {
  id: string;
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  iconUrl?: string; // For favored icons
  type: 'tab' | 'link' | 'note' | 'snippet';
  originalData?: any;
}

interface BuildViewProps {
  onBack: () => void;
  initialSnippet?: Snippet | null; // For editing mode
  workspace?: Workspace | null;
  folder?: Folder | null;
}

// --- Components ---

const TabButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
      active
        ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-neutral-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
        : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5'
    }`}>
    {label}
  </button>
);

const ItemCard = ({
  item,
  onAdd,
  isAdded,
  isFocused,
}: {
  item: BuildItem;
  onAdd: () => void;
  isAdded: boolean;
  isFocused: boolean;
}) => (
  <motion.div
    layoutId={item.id}
    onClick={!isAdded ? onAdd : undefined}
    className={`
        group flex items-center gap-4 py-2 px-4 transition-colors border-b border-neutral-200 dark:border-white/10 last:border-0
        ${isAdded ? 'cursor-default' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5'}
        ${isFocused ? 'bg-neutral-100 dark:bg-white/10 ring-1 ring-inset ring-neutral-200 dark:ring-white/20' : ''}
    `}>
    <div className="flex-shrink-0">
      {item.iconUrl ? (
        <img src={item.iconUrl} className="w-5 h-5 object-contain" alt="" />
      ) : (
        <div className="w-5 h-5 rounded flex items-center justify-center bg-[var(--color-containerBg)] text-[var(--color-iconDefault)]">
          {item.icon || <FaLink size={12} />}
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-300 truncate leading-tight max-w-[80%]">
        {item.title}
      </div>
      <div className="text-xs text-neutral-400 dark:text-neutral-500 truncate leading-tight opacity-90">
        {item.subtitle}
      </div>
    </div>

    <div className="flex-shrink-0 pl-2 flex items-center justify-end min-w-[60px]">
      <div className="flex items-center gap-1 text-xs text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
        {isAdded ? (
          <span className="text-green-500 font-medium">Added</span>
        ) : (
          <>
            <span>Add</span>
            <FaPlus size={10} />
          </>
        )}
      </div>
    </div>
  </motion.div>
);

const SelectedItemCard = ({
  item,
  index,
  onRemove,
  onClick,
}: {
  item: BuildItem;
  index: number;
  onRemove: () => void;
  onClick?: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
    className="group flex items-center justify-between gap-3 px-3 py-2 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg shadow-sm transition-all hover:border-neutral-300 dark:hover:border-white/20 cursor-pointer">
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex-shrink-0 w-5 text-center text-xs text-neutral-400 font-mono">{index + 1}.</span>
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-neutral-100 dark:bg-black/20 text-[var(--color-iconDefault)] border border-neutral-200 dark:border-white/5 flex-shrink-0">
        {item.iconUrl ? (
          <img src={item.iconUrl} alt="" className="w-4 h-4 object-contain" />
        ) : (
          item.icon || <FaLink className="text-[var(--color-iconDefault)]" />
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate leading-snug">
          {item.title}
        </div>
        <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate font-mono opacity-80">
          {item.subtitle}
        </div>
      </div>
    </div>
    <button
      onClick={onRemove}
      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      title="Remove item">
      <FaTrash size={12} />
    </button>
  </motion.div>
);

export const BuildView: React.FC<BuildViewProps> = ({ onBack, initialSnippet, workspace, folder }) => {
  const dispatch = useDispatch<AppDispatch>();
  // const triggerToast = useToast();

  const [title, setTitle] = useState('');
  const [activeTab, setActiveTab] = useState<BuildTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<BuildItem[]>([]);
  const [availableItems, setAvailableItems] = useState<BuildItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);

  const customLinkUrlRef = useRef<HTMLInputElement>(null);

  // Custom Link State
  const [isCustomLinkFormOpen, setIsCustomLinkFormOpen] = useState(false);
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [customLinkName, setCustomLinkName] = useState('');
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);

  // Link Edit Popup State
  const [editingPopupLinkId, setEditingPopupLinkId] = useState<string | null>(null);
  const [editingUrlParts, setEditingUrlParts] = useState<{
    protocol: string;
    domain: string;
    paths: string[];
    search: string;
  } | null>(null);
  const [editingLinkName, setEditingLinkName] = useState('');
  const [localUrlValue, setLocalUrlValue] = useState('');

  const [focusedPathIndex, setFocusedPathIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'domain' | 'path' | null>(null);
  const [showPathQueryDropdown, setShowPathQueryDropdown] = useState(false);

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  // Selectors
  const allData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);
  const currentWorkspace = useSelector(selectSelectedWorkspace);
  const currentFolder = useSelector(selectSelectedFolder);
  const isMac = useSelector(selectIsMac);

  // Get personal workspaces
  const personalWorkspaces = useMemo(() => {
    if (!allData) return [];
    const privateTeam = allData.find(team => team.is_personal_space === true);
    return privateTeam?.workspaces || [];
  }, [allData]);

  // Determine Organization Team
  const orgTeam = useMemo(() => {
    if (selectedTeam && selectedTeam.is_personal_space !== true) {
      return selectedTeam;
    }
    return allData?.find(t => t.is_personal_space !== true) || null;
  }, [selectedTeam, allData]);

  // Pick/Save Location State
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>('');
  const [folderIdForSave, setFolderIdForSave] = useState<string>('');

  // Footer Status
  const [footerStatus, setFooterStatus] = useState<{
    type: 'idle' | 'saving' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const footerStatusTimeoutRef = useRef<number | null>(null);

  const showFooterStatus = useCallback(
    (type: 'idle' | 'saving' | 'success' | 'error', message: string, duration = 3000) => {
      if (footerStatusTimeoutRef.current) {
        window.clearTimeout(footerStatusTimeoutRef.current);
      }
      setFooterStatus({ type, message });

      if (type !== 'idle' && type !== 'saving') {
        footerStatusTimeoutRef.current = window.setTimeout(() => {
          setFooterStatus({ type: 'idle', message: '' });
        }, duration);
      }
    },
    [],
  );

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (footerStatusTimeoutRef.current) {
        window.clearTimeout(footerStatusTimeoutRef.current);
      }
    };
  }, []);

  const listContainerRef = React.useRef<HTMLDivElement>(null);

  // Scroll to top when active tab changes
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setFocusedIndex(0);
  }, [activeTab]);

  // Scroll focused item into view
  // We need refs for items. Since we render in a loop, we can't easily use useRef array without creating it.
  // Instead, we can try to query selector by index or data-attribute
  useEffect(() => {
    if (listContainerRef.current) {
      // This is a bit hacky but works without creating ref array
      const items = listContainerRef.current.querySelectorAll('.group'); // ItemCard has 'group' class
      const target = items[focusedIndex] as HTMLElement;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  // Helper function - must be defined before useEffects that use it
  const getHostname = useCallback((url: string | undefined | null) => {
    try {
      if (!url) return '';
      // Ensure protocol
      const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(safeUrl).hostname;
    } catch {
      return url || '';
    }
  }, []);

  // Initialize location from current selection or props
  useEffect(() => {
    if (workspace) {
      setTargetWorkspaceId(workspace.workspace_id);
    } else if (currentWorkspace) {
      setTargetWorkspaceId(currentWorkspace.workspace_id);
    }

    if (folder) {
      setFolderIdForSave(folder.folder_id);
    } else if (currentFolder) {
      setFolderIdForSave(currentFolder.folder_id);
    }
  }, [workspace, folder, currentWorkspace, currentFolder]);

  // Prefill data when editing - only run when initialSnippet changes
  useEffect(() => {
    if (initialSnippet) {
      const initialId = initialSnippet.id || initialSnippet.snippet_id || null;
      setEditingSnippetId(initialId);
      setTitle(initialSnippet.key || '');

      // Parse TabGroup data
      let urls: string[] = [];
      let names: string[] = [];
      if (typeof initialSnippet.value === 'string') {
        try {
          const parsed = JSON.parse(initialSnippet.value || '{}');
          urls = Array.isArray(parsed?.urls) ? parsed.urls : [];
          names = Array.isArray(parsed?.names) ? parsed.names : [];
        } catch {
          // If parse fails, skip
        }
      } else if (initialSnippet.value && typeof initialSnippet.value === 'object') {
        const val = initialSnippet.value as any;
        urls = Array.isArray(val?.urls) ? val.urls : [];
        names = Array.isArray(val?.names) ? val.names : [];
      }

      // Convert URLs to BuildItems
      const prefillItems: BuildItem[] = urls.map((url, idx) => {
        const name = names[idx] || (url.startsWith('note:') ? 'Untitled Note' : getHostname(url));
        const isNote = url.startsWith('note:');
        const noteId = isNote ? url.substring(5) : null;

        // Find the original snippet if it's a note or link
        let originalData: any = null;
        if (isNote && allData) {
          // Find note snippet
          for (const team of allData) {
            for (const ws of team.workspaces || []) {
              for (const s of ws.workspace_snippets || []) {
                if ((s.id || s.snippet_id) === noteId) {
                  originalData = s;
                  break;
                }
              }
              if (originalData) break;
              for (const f of ws.folders || []) {
                for (const s of f.snippets || []) {
                  if ((s.id || s.snippet_id) === noteId) {
                    originalData = s;
                    break;
                  }
                }
                if (originalData) break;
              }
              if (originalData) break;
            }
            if (originalData) break;
          }
        } else if (!isNote && allData) {
          // Try to find link snippet by URL
          for (const team of allData) {
            for (const ws of team.workspaces || []) {
              for (const s of ws.workspace_snippets || []) {
                const category = (s.category || '').toLowerCase();
                if (category === 'link' || category === 'quicklink') {
                  const snippetUrl = typeof s.value === 'string' ? s.value : '';
                  if (snippetUrl === url) {
                    originalData = s;
                    break;
                  }
                }
              }
              if (originalData) break;
              for (const f of ws.folders || []) {
                for (const s of f.snippets || []) {
                  const category = (s.category || '').toLowerCase();
                  if (category === 'link' || category === 'quicklink') {
                    const snippetUrl = typeof s.value === 'string' ? s.value : '';
                    if (snippetUrl === url) {
                      originalData = s;
                      break;
                    }
                  }
                }
                if (originalData) break;
              }
              if (originalData) break;
            }
            if (originalData) break;
          }
        }

        // If no snippet found, use custom URL object
        if (!originalData && !isNote) {
          originalData = { url, name };
        }

        return {
          // USE STABLE IDs: Do not use Date.now() here as it triggers re-renders on background refresh
          id: isNote ? `note-${noteId}-${idx}` : `link-${idx}-${initialId || 'new'}`,
          title: name,
          subtitle: isNote ? 'Note' : url,
          type: isNote ? 'note' : 'link',
          icon: isNote ? <NotesIcon size={18} className="text-[var(--color-iconDefault)]" /> : <FaLink className="text-[var(--color-iconDefault)]" />,
          originalData: originalData || { url, name },
        };
      });

      setSelectedItems(prefillItems);
    }
  }, [
    initialSnippet && (initialSnippet.id || initialSnippet.snippet_id || initialSnippet.value),
    allData?.length,
    getHostname,
  ]);

  // Handlers for Location Picker - Update both local state and Redux (like RichEditor)
  const handleWorkspaceDestination = (ws: Workspace) => {
    setTargetWorkspaceId(ws.workspace_id);
    setFolderIdForSave(''); // reset folder if workspace changes

    // Update Redux state to match RichEditor behavior
    dispatch(setSelectedWorkspace(ws));
    dispatch(setSelectedFolder(null)); // Clear folder when workspace is selected
    dispatch(
      setSnippetBreadCrum({
        workspace_id: ws.workspace_id,
        workspace_name: ws.workspace_name,
        folder_id: null,
        folder_name: null,
      }),
    );

    setIsLocationPickerOpen(false);
  };

  const handleFolderDestination = (ws: Workspace, f: Folder) => {
    setTargetWorkspaceId(ws.workspace_id); // Ensure workspace is set too
    setFolderIdForSave(f.folder_id);

    // Update Redux state to match RichEditor behavior
    dispatch(setSelectedWorkspace(ws));
    dispatch(setSelectedFolder(f));
    dispatch(
      setSnippetBreadCrum({
        workspace_id: ws.workspace_id,
        workspace_name: ws.workspace_name,
        folder_id: f.folder_id,
        folder_name: f.folder_name,
      }),
    );

    setIsLocationPickerOpen(false);
  };

  const getDestinationLabel = () => {
    // If we have explicit props from event (Sidebar/Favorites), use them first
    if (workspace) {
      if (folder) return folder.folder_name;
      return workspace.workspace_name;
    }

    if (!allData || !selectedTeam) return 'Unknown Dest';

    // Find workspace
    const ws = selectedTeam.workspaces?.find(w => w.workspace_id === targetWorkspaceId);
    if (!ws) return 'Select Workspace';

    // If folder selected
    if (folderIdForSave) {
      const f = ws.folders?.find(folderItem => folderItem.folder_id === folderIdForSave);
      return f ? f.folder_name : ws.workspace_name;
    }
    return ws.workspace_name;
  };

  const handleSaveClick = useCallback(async () => {
    if (isSaving) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showFooterStatus('error', 'Enter a title for this routine');
      return;
    }

    if (!selectedItems.length) {
      showFooterStatus('error', 'Add at least one item to the routine');
      return;
    }

    const teamId = selectedTeam?.team_id || '';
    if (!teamId || !targetWorkspaceId) {
      showFooterStatus('error', 'Select a workspace or folder');
      return;
    }

    setIsSaving(true);
    showFooterStatus('saving', 'Saving...');

    try {
      // Extract URLs and names from selectedItems
      const urls: string[] = [];
      const names: string[] = [];

      for (const item of selectedItems) {
        if (item.type === 'tab') {
          // Tab - use URL from originalData (chrome tab)
          const tab = item.originalData as chrome.tabs.Tab;
          if (tab.url) {
            urls.push(tab.url);
            names.push(String(item.title || getHostname(tab.url)));
          }
        } else if (item.type === 'link') {
          // Link - extract URL from snippet or use direct URL
          const originalData = item.originalData;
          let url = '';

          if (originalData && typeof originalData === 'object' && 'url' in originalData) {
            // Custom link with direct URL
            url = String(originalData.url);
          } else if (originalData && typeof originalData === 'object' && 'category' in originalData) {
            // Snippet object
            const snippet = originalData as Snippet;
            const category = (snippet.category || '').toLowerCase();

            if (category === 'tabgroup' || category === 'quicklink') {
              try {
                const parsed = JSON.parse(String(snippet.value || '{}'));
                url = Array.isArray(parsed.urls) && parsed.urls.length > 0 ? String(parsed.urls[0]) : '';
              } catch {
                url = typeof snippet.value === 'string' ? String(snippet.value) : '';
              }
            } else {
              url = typeof snippet.value === 'string' ? String(snippet.value) : '';
            }
          } else if (typeof originalData === 'string') {
            // Direct URL string
            url = String(originalData);
          }

          if (url) {
            urls.push(url);
            // safe check for getHostname
            const hostname = url ? getHostname(url) : 'Untitled Link';
            names.push(String(item.title || hostname));
          }
        } else if (item.type === 'note') {
          // Note - store with note: prefix so we can detect and open it properly
          const snippet = item.originalData as Snippet;
          const noteId = snippet.id || snippet.snippet_id;
          if (noteId) {
            urls.push(`note:${noteId}`);
            names.push(item.title || 'Untitled Note');
          }
        }
      }

      // Filter out items with empty URLs
      const validItems = urls
        .map((url, idx) => ({ url, name: names[idx] }))
        .filter(item => item.url && item.url.trim());

      if (validItems.length === 0) {
        showFooterStatus('error', 'No valid URLs to save');
        setIsSaving(false);
        return;
      }

      const finalUrls = validItems.map(item => item.url);
      const finalNames = validItems.map(item => item.name);

      const isEditing = Boolean(editingSnippetId);

      if (isEditing) {
        // Update existing snippet
        const updatePayload: any = {
          snippet_id: editingSnippetId,
          key: trimmedTitle,
          value: JSON.stringify({ names: finalNames, urls: finalUrls }),
          category: 'TabGroup',
          tags: [],
        };

        

        const response = await updateSnippetRealtime(updatePayload);
        const responseSnippet = response?.snippet;

        const snippetTags = Array.isArray(responseSnippet?.snippet_tags)
          ? responseSnippet.snippet_tags
          : Array.isArray(responseSnippet?.tags)
            ? responseSnippet.tags
            : [];

        // Update Redux cache
        dispatch(
          optimisticUpdateSnippet({
            teamId,
            workspaceId: targetWorkspaceId,
            folderId: folderIdForSave || '',
            snippet: {
              id: editingSnippetId || '',
              key: trimmedTitle,
              value: JSON.stringify({ names: finalNames, urls: finalUrls }),
              category: 'TabGroup',
              tags: snippetTags,
              user_id: responseSnippet?.user_id || initialSnippet?.user_id || '',
              first_name: responseSnippet?.first_name || initialSnippet?.first_name || '',
              last_name: responseSnippet?.last_name || initialSnippet?.last_name || '',
              created_at: responseSnippet?.created_at || initialSnippet?.created_at || new Date().toISOString(),
              updated_at: responseSnippet?.updated_at || new Date().toISOString(),
            },
          }),
        );

        dispatch(
          queueNotification({
            message: 'Link collection saved successfully',
            type: 'success',
          }),
        );
      } else {
        // Create new snippet
        const newSnippetPayload: NewSnippet = {
          key: trimmedTitle,
          value: JSON.stringify({ names: finalNames, urls: finalUrls }),
          category: 'TabGroup',
          tags: [],
          ...(folderIdForSave ? { folder_id: folderIdForSave } : { workspace_id: targetWorkspaceId }),
        };

        

        const response = await createSnippet([newSnippetPayload]);
        const responseSnippet = response?.[0]?.snippet || response?.snippet;
        const snippetId = responseSnippet?.snippet_id || responseSnippet?.id || `temp-${Date.now()}`;
        const nowIso = new Date().toISOString();

        const snippetTags = Array.isArray(responseSnippet?.snippet_tags)
          ? responseSnippet.snippet_tags
          : Array.isArray(responseSnippet?.tags)
            ? responseSnippet.tags
            : [];

        // Add to Redux cache so it's immediately visible in search
        dispatch(
          optimisticAddSnippet({
            teamId,
            workspaceId: targetWorkspaceId,
            folderId: folderIdForSave || '',
            snippet: {
              id: snippetId,
              key: trimmedTitle,
              value: JSON.stringify({ names: finalNames, urls: finalUrls }),
              category: 'TabGroup',
              tags: snippetTags,
              user_id: responseSnippet?.user_id || '',
              first_name: responseSnippet?.first_name || '',
              last_name: responseSnippet?.last_name ?? null,
              created_at: responseSnippet?.created_at || nowIso,
              updated_at: responseSnippet?.updated_at || nowIso,
            },
          }),
        );
      }

      showFooterStatus('success', 'Link collection saved successfully');
      setTimeout(() => {
        onBack();
      }, 500);
    } catch (error: any) {
      console.error('Error saving routine:', error);
      console.error('Error details:', error?.response?.data || error?.message);

      // Handle specific error cases
      const errorData = error?.response?.data;
      if (errorData?.error?.includes('duplicate key') || errorData?.error?.includes('unique constraint')) {
        showFooterStatus('error', 'Duplicate title. Please rename.');
      } else {
        showFooterStatus('error', errorData?.message || error?.message || 'Failed to save');
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    title,
    selectedItems,
    selectedTeam,
    targetWorkspaceId,
    folderIdForSave,
    dispatch,
    getHostname,
    onBack,
    editingSnippetId,
    initialSnippet,
    showFooterStatus,
  ]);

  const transformSnippetToItem = (s: Snippet): BuildItem | null => {
    const category = (s.category || '').toLowerCase();

    const isTabGroup = category === 'tabgroup' || category === 'tab group';
    const isLink = category === 'link' || category === 'links' || category === 'quicklink' || isTabGroup;
    const isNote = category === 'note';
    const isCodeSnippet = category === 'snippet';

    // Only include links and notes/snippets, exclude everything else
    if (!isLink && !isNote && !isCodeSnippet) {
      return null;
    }

    let subtitle = '';

    if (isLink) {
      // try extracting url from value
      try {
        if (typeof s.value === 'string') {
          // It might be a JSON object string
          if (s.value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(s.value);
              if (parsed.urls && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                subtitle = parsed.urls[0];
              } else if (parsed.url) {
                subtitle = parsed.url;
              } else {
                subtitle = s.value;
              }
            } catch {
              subtitle = s.value;
            }
          } else {
            subtitle = s.value;
          }
        }
      } catch (e) {
        subtitle = '';
      }
    } else if (isNote) {
      subtitle = 'Note';
    } else if (isCodeSnippet) {
      subtitle = 'Snippet';
    }

    return {
      id: s.id || s.snippet_id || `snip-${Math.random()}`,
      title: s.key || 'Untitled',
      subtitle: subtitle,
      type: isLink ? 'link' : isNote ? 'note' : 'snippet',
      icon: isLink ? (
        subtitle ? (
          <img src={getFaviconUrl(subtitle)} alt="" className="w-4 h-4 object-contain rounded-sm" />
        ) : (
          <FaLink className="text-[var(--color-iconDefault)]" />
        )
      ) : isNote ? (
        <NotesIcon size={18} className="text-[var(--color-iconDefault)]" />
      ) : (
        <FaFileAlt className="text-[var(--color-iconDefault)]" />
      ),
      originalData: s,
    };
  };

  useEffect(() => {
    // Load data
    const loadItems = async () => {
      let items: BuildItem[] = [];

      // 1. Current Tabs
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabItems: BuildItem[] = tabs
          .filter(t => t.url && !t.url.startsWith('chrome-extension://'))
          .map(t => ({
            id: `tab-${t.id}`,
            title: t.title || 'Untitled Tab',
            subtitle: t.url || '',
            iconUrl: t.favIconUrl,
            type: 'tab',
            originalData: t,
          }));
        items = [...items, ...tabItems];
      }

      // 2. Links & Notes from Redux (allData) - Exclude TabGroups
      if (allData) {
        allData.forEach(team => {
          team.workspaces?.forEach(ws => {
            // Workspace level snippets
            ws.workspace_snippets?.forEach(s => {
              const item = transformSnippetToItem(s);
              if (item) items.push(item);
            });
            // Folder snippets
            ws.folders?.forEach(f => {
              f.snippets?.forEach(s => {
                const item = transformSnippetToItem(s);
                if (item) items.push(item);
              });
            });
          });
        });
      }

      // Remove duplicates or filter
      setAvailableItems(items);
    };

    loadItems();
  }, [allData]);

  // Handle Esc key and keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
        return;
      }

      // Ctrl+Enter (Win) or Cmd+Enter (Mac) for Save
      const isSaveShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'Enter';
      if (isSaveShortcut) {
        e.preventDefault();
        if (isSaving) return;
        if (!targetWorkspaceId) {
          if (!selectedTeam || (selectedTeam.workspaces || []).length === 0) {
            showFooterStatus('error', 'Create a workspace or folder before saving.');
            return;
          }
          setIsLocationPickerOpen(true);
          return;
        }
        handleSaveClick();
      } else if (e.altKey && e.key === 'Enter') {
        // Alt+Enter to Change Location
        e.preventDefault();
        if (isSaving) return;
        if (!selectedTeam || (selectedTeam.workspaces || []).length === 0) {
          showFooterStatus('error', 'Create a workspace or folder before saving.');
          return;
        }
        setIsLocationPickerOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, isSaving, isMac, targetWorkspaceId, selectedTeam, handleSaveClick, showFooterStatus]);

  useEffect(() => {
    if (!isCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isCustomLinkFormOpen]);

  // --- Link Editing Helpers ---

  const parseUrlParts = useCallback((url: string) => {
    try {
      const u = new URL(url);
      const paths = u.pathname.split('/').filter(Boolean);
      return { protocol: u.protocol.replace(':', ''), domain: u.host, paths, search: u.search };
    } catch {
      return null;
    }
  }, []);

  const assembleUrl = useCallback((parts: { protocol: string; domain: string; paths: string[]; search: string }) => {
    const pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
    return `${parts.protocol}://${parts.domain}${pathStr}${parts.search}`;
  }, []);

  const openLinkEditPopup = useCallback(
    (item: BuildItem) => {
      // Allow editing links and tabs
      if (item.type !== 'link' && item.type !== 'tab') return;

      let url = item.subtitle;
      // Try to get URL from originalData for better accuracy
      if (item.originalData) {
        if (typeof item.originalData === 'object' && 'url' in item.originalData) {
          url = (item.originalData as any).url;
        } else if (item.type === 'tab') {
          url = (item.originalData as chrome.tabs.Tab).url || url;
        }
      }

      const parts = parseUrlParts(url);
      // Always open the popup - even if URL parsing fails, user can edit the name
      setEditingPopupLinkId(item.id);
      setEditingUrlParts(parts); // May be null if URL is malformed
      setEditingLinkName(item.title || '');
      setLocalUrlValue(url);
    },
    [parseUrlParts],
  );

  const closeLinkEditPopup = useCallback(() => {
    setEditingPopupLinkId(null);
    setEditingUrlParts(null);
    setEditingLinkName('');
    setLocalUrlValue('');
  }, []);

  const saveLinkEditPopup = useCallback(() => {
    if (!editingPopupLinkId) return;
    // Use assembled URL if parts are available, otherwise use localUrlValue directly
    const newUrl = editingUrlParts ? assembleUrl(editingUrlParts) : localUrlValue;
    setSelectedItems(prev =>
      prev.map(item =>
        item.id === editingPopupLinkId
          ? {
              ...item,
              title: editingLinkName || item.title,
              subtitle: newUrl,
              originalData: { ...(item.originalData || {}), url: newUrl, value: newUrl },
            }
          : item,
      ),
    );
    closeLinkEditPopup();
  }, [editingPopupLinkId, editingUrlParts, editingLinkName, localUrlValue, assembleUrl, closeLinkEditPopup]);

  const insertCustomVariable = useCallback(() => {
    if (!editingUrlParts) return;

    if (focusedField === 'domain') {
      setEditingUrlParts(prev => (prev ? { ...prev, paths: ['{query}', ...prev.paths] } : prev));
    } else if (focusedField === 'path' && focusedPathIndex !== null) {
      const newPaths = [...editingUrlParts.paths];
      newPaths.splice(focusedPathIndex + 1, 0, '{query}');
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else {
      setEditingUrlParts(prev => (prev ? { ...prev, paths: [...prev.paths, '{query}'] } : prev));
    }
  }, [editingUrlParts, focusedField, focusedPathIndex]);

  const handleAddCustomLink = useCallback(() => {
    const rawUrl = customLinkUrl.trim();
    if (!rawUrl) {
      showFooterStatus('error', 'Enter a URL to add');
      return;
    }

    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      if (!normalizedUrl.startsWith('www.')) {
        normalizedUrl = `https://www.${normalizedUrl}`;
      } else {
        normalizedUrl = `https://${normalizedUrl}`;
      }
    }

    try {
      // eslint-disable-next-line no-new
      new URL(normalizedUrl);
    } catch (error) {
      showFooterStatus('error', 'Enter a valid URL');
      return;
    }

    const name = customLinkName.trim() || getHostname(normalizedUrl);
    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const newItem: BuildItem = {
      id,
      title: name,
      subtitle: normalizedUrl,
      type: 'link',
      icon: <FaLink className="text-[var(--color-iconDefault)]" />,
      originalData: { url: normalizedUrl, name },
    };

    setSelectedItems(prev => [...prev, newItem]);

    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
  }, [customLinkName, customLinkUrl, getHostname, showFooterStatus]);

  // Helper function to check if two items are the same
  const areItemsEqual = useCallback((item1: BuildItem, item2: BuildItem): boolean => {
    // For tabs, compare by tab ID
    if (item1.type === 'tab' && item2.type === 'tab') {
      const tab1 = item1.originalData as chrome.tabs.Tab;
      const tab2 = item2.originalData as chrome.tabs.Tab;
      return tab1?.id === tab2?.id;
    }

    // For notes, compare by snippet ID
    if (item1.type === 'note' && item2.type === 'note') {
      const snippet1 = item1.originalData as Snippet;
      const snippet2 = item2.originalData as Snippet;
      const id1 = snippet1?.id || snippet1?.snippet_id;
      const id2 = snippet2?.id || snippet2?.snippet_id;
      return Boolean(id1 && id2 && id1 === id2);
    }

    // For links, compare by URL or snippet ID
    if (item1.type === 'link' && item2.type === 'link') {
      const snippet1 = item1.originalData as Snippet;
      const snippet2 = item2.originalData as Snippet;

      // If both have snippet IDs, compare those
      const id1 = snippet1?.id || snippet1?.snippet_id;
      const id2 = snippet2?.id || snippet2?.snippet_id;
      if (id1 && id2 && id1 === id2) {
        return true;
      }

      // Otherwise compare by URL
      const url1 = typeof snippet1?.value === 'string' ? snippet1.value : (snippet1 as any)?.url || item1.subtitle;
      const url2 = typeof snippet2?.value === 'string' ? snippet2.value : (snippet2 as any)?.url || item2.subtitle;
      return Boolean(url1 && url2 && url1 === url2);
    }

    // Fallback to ID comparison
    return item1.id === item2.id;
  }, []);

  const filteredItems = useMemo(() => {
    let list = availableItems;

    // Tab Filter
    if (activeTab === 'Current Tabs') list = list.filter(i => i.type === 'tab');
    if (activeTab === 'Saved Links') list = list.filter(i => i.type === 'link');
    if (activeTab === 'Notes') list = list.filter(i => i.type === 'note');

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q));
    }

    return list;
  }, [availableItems, activeTab, searchQuery]);

  const handleAddItem = (item: BuildItem) => {
    // Check if item is already added
    const isAlreadyAdded = selectedItems.some(selected => areItemsEqual(item, selected));
    if (isAlreadyAdded) return;

    let itemsToAdd: BuildItem[] = [];
    const category = (item.originalData?.category || '').toLowerCase();
    const isTabGroup = category === 'tabgroup' || category === 'tab group' || category === 'quicklink';

    if (isTabGroup && item.type === 'link') {
      // Expand tab group
      try {
        let urls: string[] = [];
        let names: string[] = [];
        const rawVal = item.originalData?.value;

        if (typeof rawVal === 'string') {
          if (rawVal.trim().startsWith('{')) {
            const parsed = JSON.parse(rawVal);
            urls = Array.isArray(parsed?.urls) ? parsed.urls : [];
            names = Array.isArray(parsed?.names) ? parsed.names : [];
          } else {
            urls = [rawVal];
          }
        } else if (typeof rawVal === 'object') {
          urls = Array.isArray(rawVal?.urls) ? rawVal.urls : [];
          names = Array.isArray(rawVal?.names) ? rawVal.names : [];
        }

        itemsToAdd = urls
          .map((u, idx) => ({
            id: `${item.id}-${idx}-${Date.now()}`,
            title: names[idx] || getHostname(u),
            subtitle: u,
            type: 'link' as const,
            icon: <FaLink className="text-[var(--color-iconDefault)]" />,
            originalData: { url: u, name: names[idx] },
          }))
          .filter(i => i.subtitle && i.subtitle.trim() !== '');
      } catch {
        itemsToAdd = [item];
      }
    } else {
      itemsToAdd = [item];
    }

    if (itemsToAdd.length > 0) {
      setSelectedItems([...selectedItems, ...itemsToAdd]);
    }
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.id !== id));
  };

  return (
    <div className="w-full h-full flex flex-col gap-1 text-left">
      <div className="flex-1 flex flex-col text-neutral-900 dark:text-neutral-200 overflow-hidden relative bg-white/95 backdrop-blur-xl dark:bg-neutral-950/60 border border-neutral-200 dark:border-white/10 rounded-xl">
        {/* Main Content Area (Centered) */}
        <div className="w-full flex-1 flex flex-col items-center justify-start gap-2 min-h-0 pt-1 px-2">
          {/* Header Input */}
          <div className="w-full flex justify-start pl-1 pt-1">
            <div className="inline-flex items-center w-[400px]">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Collection Title"
                className="w-full h-7 text-xs font-semibold text-neutral-900 dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-xl px-2 outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.currentTarget.blur();
                    listContainerRef.current?.focus();
                    setFocusedIndex(0);
                  }
                }}
              />
            </div>
          </div>

          {/* Floating Cards Container */}
          <div className="w-full flex-1 flex min-h-0 gap-4 h-full px-1 pb-4">
            {/* Left Column: Source */}
            <div className="w-[45%] flex-none flex flex-col min-w-0 gap-4 h-auto min-h-[150px] max-h-full">
              {/* Filters */}
              <div className="flex items-center gap-2">
                {(['All', 'Current Tabs', 'Saved Links', 'Notes'] as BuildTab[]).map(t => (
                  <TabButton key={t} active={activeTab === t} label={t} onClick={() => setActiveTab(t)} />
                ))}
              </div>

              {/* Search */}
              <div className="relative group">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] group-focus-within:text-neutral-600 dark:group-focus-within:text-neutral-300 transition-colors" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-9 pr-4 py-1.5 rounded-full bg-[var(--color-containerBg)] border-2 border-transparent focus:border-blue-500/20 outline-none text-sm shadow-sm transition-all"
                />
              </div>

              {/* List */}
              <div
                ref={listContainerRef}
                className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar outline-none"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    // Need focused state for this list
                    // For now, let's just assume we can add focus logic similar to AltS if a state exists
                    // Since BuildView doesn't have focusedIndex state yet, I need to add it or skip.
                    // User ASKED for navigation. I should add state.
                  }
                }}>
                {filteredItems.map(item => {
                  // Check if item is already added using the comparison helper
                  const isAdded = selectedItems.some(selected => areItemsEqual(item, selected));

                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isAdded={isAdded}
                      isFocused={false}
                      onAdd={() => handleAddItem(item)}
                    />
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-center py-10 text-neutral-400 text-sm">No items found</div>
                )}
              </div>
            </div>

            {/* Middle Arrow */}
            <div className="w-[12%] flex-none flex items-center justify-center  h-[45%]">
              {/* Container for the line and arrow */}
              <div className="flex items-center w-full px-2 group py-2">
                {/* The Horizontal Line: It expands to fill available space */}
                <div className="h-[2px] flex-grow bg-neutral-600 dark:text-neutral-300 origin-left transition-all duration-300 group-hover:bg-purple-400"></div>

                {/* The Arrow Symbol: Placed at the end of the line */}
                <div className="flex-none -ml-1 text-neutral-600  group-hover:text-purple-400 transition-colors">
                  <FaArrowRight size={14} />
                </div>
              </div>
            </div>

            {/* Right Column: Selected */}
            <div className="w-[39%] flex-none flex flex-col min-w-0 bg-[var(--color-containerBg)] border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden self-start h-auto min-h-[140px] max-h-full">
              {/* Header */}
              <div className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 font-mono tracking-tight capitalize opacity-80">
                Selected Items
              </div>

              <div className="flex-1 flex flex-col overflow-y-auto space-y-2 min-h-0 pr-1 custom-scrollbar px-1 pb-4 min-h-[110px]">
                <AnimatePresence>
                  {selectedItems.map((item, index) => (
                    <SelectedItemCard
                      key={item.id}
                      item={item}
                      index={index}
                      onRemove={() => handleRemoveItem(item.id)}
                      onClick={() => openLinkEditPopup(item)}
                    />
                  ))}
                </AnimatePresence>
                {selectedItems.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 text-sm italic mb-4">
                    Select items to build your bundle
                  </div>
                )}

                {/* Add custom link button */}
                {!isCustomLinkFormOpen && (
                  <div className="flex justify-center pb-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomLinkFormOpen(true);
                        setCustomLinkUrl(prev => (prev && prev.length > 0 ? prev : 'www.'));
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C1C1E] hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] font-medium transition-colors shadow-sm border border-white/5"
                      title="Add custom link">
                      <FaPlus size={10} />
                      <span>Add a custom link</span>
                    </button>
                  </div>
                )}

                {/* Custom Link Form */}
                {isCustomLinkFormOpen && (
                  <div className="px-1 pb-1">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--color-containerBg)] border border-white/80 dark:border-white/10 shadow-sm relative">
                      <div className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 w-4 text-right">
                        {selectedItems.length + 1}.
                      </div>
                      <div className="flex-1 min-w-0 relative">
                        <input
                          ref={customLinkUrlRef}
                          value={customLinkUrl}
                          onChange={event => setCustomLinkUrl(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              event.stopPropagation();
                              if (showVariableDropdown) {
                                setCustomLinkUrl(prev => (prev || '').trim() + '{query}');
                                setShowVariableDropdown(false);
                              } else {
                                handleAddCustomLink();
                              }
                            } else if (event.key === 'ArrowDown' && showVariableDropdown) {
                              event.preventDefault();
                              setCustomLinkUrl(prev => (prev || '').trim() + '{query}');
                              setShowVariableDropdown(false);
                            } else if (event.key === 'Escape') {
                              if (showVariableDropdown) {
                                setShowVariableDropdown(false);
                              } else {
                                setIsCustomLinkFormOpen(false);
                                setCustomLinkUrl('');
                                setCustomLinkName('');
                              }
                            }
                          }}
                          placeholder="www."
                          autoFocus
                          className="w-full text-sm px-3 py-2 pr-10 rounded-lg bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#8B7CFF]/40"
                        />

                        {/* @ button to insert {query} variable */}
                        <button
                          type="button"
                          onClick={() => {
                            setCustomLinkUrl(prev => (prev || '').trim() + '{query}');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full transition-colors bg-[var(--color-containerBg)] text-neutral-500 dark:text-neutral-400 hover:bg-purple-500 hover:text-white"
                          title="Insert {query} variable">
                          <FaAt size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
            className="bg-[var(--color-containerBg)] rounded-xl border border-[var(--color-borderDefault)] shadow-2xl p-4 min-w-[600px] max-w-[90%]"
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">Edit Link</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[var(--color-borderDefault)]">
                  <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400 font-medium">Link Name</td>
                  <td className="py-2">
                    <input
                      value={editingLinkName}
                      onChange={e => setEditingLinkName(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                      placeholder="Enter display name for the link"
                      className="w-full bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-borderDefault)]">
                  <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400 font-medium">Full URL</td>
                  <td className="py-2">
                    <input
                      value={localUrlValue}
                      onChange={e => {
                        setLocalUrlValue(e.target.value);
                        const parts = parseUrlParts(e.target.value);
                        setEditingUrlParts(parts);
                      }}
                      onKeyDown={e => e.stopPropagation()}
                      placeholder="Enter URL"
                      className="w-full bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                {editingUrlParts && (
                  <>
                    <tr className="border-b border-[var(--color-borderDefault)]">
                      <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400 font-medium">Domain</td>
                      <td className="py-2 relative">
                        <input
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
                            if (e.key === '@') {
                              e.preventDefault();
                              lastFocusedInputRef.current = e.currentTarget;
                              setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '@' } : prev));
                              setShowPathQueryDropdown(true);
                            } else if (showPathQueryDropdown) {
                              setShowPathQueryDropdown(false);
                            }
                          }}
                          className="w-full bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                        />
                        {showPathQueryDropdown && focusedField === 'domain' && (
                          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--color-popupBg)] rounded-lg border border-[var(--color-borderDefault)] shadow-lg z-[9999]">
                            <div className="px-3 py-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 border-b border-[var(--color-borderDefault)]">
                              Add Variable (Click to select)
                            </div>
                            <button
                              ref={dropdownButtonRef}
                              type="button"
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newDomain = editingUrlParts.domain.replace(/@$/, '');
                                  setEditingUrlParts(prev =>
                                    prev ? { ...prev, domain: newDomain, paths: ['{query}', ...prev.paths] } : prev,
                                  );
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                } else if (e.key === 'Escape') {
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }
                              }}
                              onClick={e => {
                                e.preventDefault();
                                const newDomain = editingUrlParts.domain.replace(/@$/, '');
                                setEditingUrlParts(prev =>
                                  prev ? { ...prev, domain: newDomain, paths: ['{query}', ...prev.paths] } : prev,
                                );
                                setShowPathQueryDropdown(false);
                                lastFocusedInputRef.current?.focus();
                              }}
                              className="w-full text-left px-3 py-2 text-xs bg-[var(--color-containerBg)] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:bg-neutral-200 dark:focus:bg-neutral-700 focus:outline-none">
                              Insert {'{query}'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {editingUrlParts.paths.map((path, idx) => (
                      <tr key={idx} className="border-b border-[var(--color-borderDefault)]">
                        <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400 font-medium">Path {idx + 1}</td>
                        <td className="py-2 relative">
                          <input
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
                                newPaths.splice(idx + 1, 0, '{query}');
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              }
                            }}
                            className="w-full bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                          />
                          {showPathQueryDropdown && focusedPathIndex === idx && focusedField === 'path' && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--color-popupBg)] rounded-lg border border-[var(--color-borderDefault)] shadow-lg z-[9999]">
                              <div className="px-3 py-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 border-b border-[var(--color-borderDefault)]">
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
                                    newPaths[idx] = path.replace(/@$/, '');
                                    newPaths.splice(idx + 1, 0, '{query}');
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
                                  newPaths[idx] = path.replace(/@$/, '');
                                  newPaths.splice(idx + 1, 0, '{query}');
                                  setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }}
                                className="w-full text-left px-3 py-2 text-xs bg-[var(--color-containerBg)] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:bg-neutral-200 dark:focus:bg-neutral-700 focus:outline-none">
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
                  className="px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-[var(--color-containerBg)] rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                  Insert Param
                </button>
              )}
              {!editingUrlParts && <div />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-[var(--color-containerBg)] rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div>
        <div className="relative flex items-center justify-between gap-3 px-3 py-1.5 border-t border-white/10 dark:border-white/5 bg-[var(--color-containerBg)] text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0 rounded-none">
          {/* Left Actions: Back */}
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-md border border-transparent bg-white/10 dark:bg-white/5 hover:bg-white/20 px-2 py-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 transition-colors">
              <span>←</span> Back
            </button>
          </div>

          {/* Center: Location Picker */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <button
                onClick={() => setIsLocationPickerOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[#e2e0ef] dark:border-white/10 bg-[var(--color-containerBg)] px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                <span>📁</span>
                <span className="truncate max-w-[200px]">{getDestinationLabel()}</span>
                <span className="flex items-center gap-1 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  <span className="rounded-md border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0">
                    {isMac ? '⌥' : 'Alt'}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-300">+</span>
                  <span className="rounded-md border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0">
                    Enter
                  </span>
                </span>
              </button>

              {isLocationPickerOpen && selectedTeam && (
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
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[100] !w-80"
                />
              )}
            </div>
          </div>

          {/* Right: Save Action */}
          <div className="flex items-center gap-4">
            {footerStatus.type !== 'idle' && (
              <div
                className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-semibold shadow-sm transition-all animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                  footerStatus.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                    : footerStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                      : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                }`}>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${footerStatus.type === 'saving' ? 'animate-pulse' : ''} ${
                    footerStatus.type === 'error'
                      ? 'bg-red-500'
                      : footerStatus.type === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                  }`}
                />
                <span>{footerStatus.message}</span>
              </div>
            )}
            <button
              onClick={handleSaveClick}
              disabled={isSaving || footerStatus.type === 'saving'}
              className={`flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${
                isSaving || footerStatus.type === 'saving'
                  ? 'cursor-not-allowed border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500'
                  : 'border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff]'
              }`}>
              {isSaving || footerStatus.type === 'saving' ? 'Saving...' : 'Save'}
              <span className="flex items-center gap-0.5 text-[8px] font-semibold text-neutral-500 dark:text-neutral-300">
                <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                  {isMac ? '⌘' : 'Ctrl'}
                </span>
                <span className="text-neutral-500 dark:text-neutral-300">+</span>
                <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                  Enter
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
