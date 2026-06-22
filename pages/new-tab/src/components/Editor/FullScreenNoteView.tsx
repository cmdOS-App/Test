import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RichTextEditor } from './RichEditor';
import { SnippetEditor } from './SnippetEditor';
import CreatePromptPanel from './CreatePromptPanel';
import { selectAllData, fetchAllDataThunk, setData } from '../../../../Redux/AllData/allDataSlice';
import {
  selectSelectedTeam,
  toggleFocusMode,
  setSelectedWorkspace,
  setSelectedFolder,
  setSnippetBreadCrum,
  selectSnippetBreadCrum,
  setSelectedSnippet,
} from '../../../../Redux/AllData/uiStateSlice';
import { Snippet, NewSnippetBreadCrum, Workspace, Folder } from '../../../../modals/interfaces';
import { AppDispatch } from '../../../../Redux/store';

interface FullScreenNoteViewProps {
  noteId?: string;
  onBack?: () => void;
}

const FullScreenNoteView: React.FC<FullScreenNoteViewProps> = ({ noteId, onBack }) => {
  const dispatch = useDispatch<AppDispatch>();
  const allData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);
  const snippetBreadCrumFromRedux = useSelector(selectSnippetBreadCrum);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Determine if this is a temporary new note or an existing one
  const isTempNewNote = useMemo(() => {
    return noteId ? noteId.startsWith('temp-') : false;
  }, [noteId]);

  // State for draft content loaded from chrome.storage
  const [draftKey, setDraftKey] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [localSnippet, setLocalSnippet] = useState<any>(null);

  const [favoritesMapping, setFavoritesMapping] = useState<{ [teamId: string]: Snippet[] }>({});

  // Load draft content from chrome.storage when opening a temp note
  useEffect(() => {
    if (isTempNewNote && !isDraftLoaded) {
      chrome.storage.local.get('pendingNoteDraft', result => {
        const draft = result.pendingNoteDraft;
        if (draft && draft.key !== undefined && draft.content !== undefined) {
          // Only use draft if it was created recently (within 5 minutes)
          const FIVE_MINUTES_MS = 5 * 60 * 1000;
          if (draft.timestamp && Date.now() - draft.timestamp < FIVE_MINUTES_MS) {
            setDraftKey(draft.key);
            setDraftContent(draft.content);
          }
          // Clear the draft from storage after loading
          chrome.storage.local.remove('pendingNoteDraft');
        }
        setIsDraftLoaded(true);
      });
    } else if (!isTempNewNote) {
      setIsDraftLoaded(true);
    }
  }, [isTempNewNote, isDraftLoaded]);

  // Ensure data is loaded when opening an existing note
  useEffect(() => {
    if (!noteId || isTempNewNote) return;

    // Check if we have data, if not, fetch it
    if (!allData || allData.length === 0) {
      setIsDataLoading(true);
      // Try to load from cache first (faster)
      chrome.storage.local.get(['myCachedAllData', 'cacheTimestamp'], result => {
        const local = result.myCachedAllData;
        const lastFetched = result.cacheTimestamp;
        const now = Date.now();
        const TEN_MINUTES_MS = 1000 * 60 * 10;
        const isFresh = lastFetched && now - lastFetched < TEN_MINUTES_MS;

        if (local && isFresh) {
          // Load cached data into Redux immediately
          dispatch(setData(local));
          setIsDataLoading(false);
        } else {
          // Fetch fresh data if cache is empty or stale
          
          dispatch(fetchAllDataThunk())
            .unwrap()
            .then(() => {
              setIsDataLoading(false);
            })
            .catch(() => {
              setIsDataLoading(false);
            });
        }
      });
    }
  }, [noteId, isTempNewNote, allData, dispatch]);

  const reload = () => {
    // Refresh data when reload is called
    if (!isTempNewNote) {
      setIsDataLoading(true);
      
      dispatch(fetchAllDataThunk())
        .unwrap()
        .then(() => {
          setIsDataLoading(false);
        })
        .catch(() => {
          setIsDataLoading(false);
        });
    }
  };

  // Find the snippet, workspace, and folder if it exists
  const { foundSnippet, foundWorkspace, foundFolder } = useMemo(() => {
    if (!noteId || isTempNewNote || !allData || allData.length === 0) {
      return { foundSnippet: null, foundWorkspace: null, foundFolder: null };
    }

    for (const team of allData) {
      for (const workspace of team.workspaces || []) {
        // Check workspace snippets
        const wsSnippet = (workspace.workspace_snippets || []).find(
          (s: any) => String(s.id) === String(noteId) || String(s.snippet_id) === String(noteId),
        );
        if (wsSnippet) {
          return { foundSnippet: wsSnippet, foundWorkspace: workspace, foundFolder: null };
        }

        // Helper to check folder recursively
        const findSnippetInFolder = (folder: Folder): { snippet: Snippet; folder: Folder } | null => {
          const found = (folder.snippets || []).find((s: any) => String(s.id) === String(noteId) || String(s.snippet_id) === String(noteId));
          if (found) {
            return { snippet: found, folder };
          }
          for (const subFolder of folder.folders || []) {
            const res = findSnippetInFolder(subFolder);
            if (res) return res;
          }
          return null;
        };

        // Check folder snippets recursively
        for (const folder of workspace.folders || []) {
          const res = findSnippetInFolder(folder);
          if (res) {
            return { foundSnippet: res.snippet, foundWorkspace: workspace, foundFolder: res.folder };
          }
        }
      }
    }
    return { foundSnippet: null, foundWorkspace: null, foundFolder: null };
  }, [allData, noteId, isTempNewNote]);

  // Fetch from local_todos if not found in allData (useful for local / custom tasks)
  useEffect(() => {
    if (!noteId || isTempNewNote) return;

    if (!foundSnippet) {
      chrome.storage.local.get(['local_todos', 'cached_todos'], (result) => {
        const localTodos = result.local_todos || [];
        const cachedTodos = result.cached_todos || [];
        const allTodos = [...localTodos, ...cachedTodos];
        const match = allTodos.find(
          (t: any) => String(t.snippet_id || t.id) === String(noteId)
        );
        if (match) {
          setLocalSnippet({
            id: match.snippet_id || match.id,
            key: match.key || match.title || '',
            value: match.value || '',
            category: match.category || 'note',
            searchtags: match.searchtags || {},
            is_recurring: match.is_recurring,
            recurring_cycle: match.recurring_cycle,
            event_deadline: match.event_deadline,
          });
        }
      });
    } else {
      setLocalSnippet(null);
    }
  }, [noteId, isTempNewNote, foundSnippet]);

  const activeSnippet = foundSnippet || localSnippet;

  // Construct initial breadcrumb from snippet location (only used for initialization)
  const initialBreadcrumb: NewSnippetBreadCrum | null = useMemo(() => {
    if (activeSnippet && foundWorkspace) {
      return {
        workspace_id: foundWorkspace.workspace_id,
        workspace_name: foundWorkspace.workspace_name,
        folder_id: foundFolder ? foundFolder.folder_id : null,
        folder_name: foundFolder ? foundFolder.folder_name : null,
      };
    }
    return null;
  }, [activeSnippet, foundWorkspace, foundFolder]);

  // Use Redux state for breadcrumb (allows manual folder changes via SaveDestinationPicker)
  // Fall back to initial breadcrumb if Redux state is not set yet
  const breadcrumb: NewSnippetBreadCrum | null = snippetBreadCrumFromRedux || initialBreadcrumb;

  // Set workspace and folder in Redux when snippet is found
  // Only initialize once when noteId changes or component mounts, not on every dependency change
  // This prevents resetting folder selection when user manually changes it via SaveDestinationPicker
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (activeSnippet && foundWorkspace && selectedTeam && !hasInitializedRef.current) {
      // Set workspace in Redux
      dispatch(setSelectedWorkspace(foundWorkspace));

      // Set folder in Redux if it exists
      if (foundFolder) {
        dispatch(setSelectedFolder(foundFolder));
      } else {
        dispatch(setSelectedFolder(null));
      }

      // Set breadcrumb in Redux
      if (initialBreadcrumb) {
        dispatch(setSnippetBreadCrum(initialBreadcrumb));
      }

      // Set selected snippet in Redux
      dispatch(setSelectedSnippet(activeSnippet));

      hasInitializedRef.current = true;
    }
  }, [activeSnippet, foundWorkspace, foundFolder, initialBreadcrumb, selectedTeam, dispatch]);

  // Reset initialization flag when noteId changes so we can initialize for a new note
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [noteId]);

  // Ensure we are in focus mode for this view
  useEffect(() => {
    dispatch(toggleFocusMode(true));
    return () => {
      dispatch(toggleFocusMode(false));
      dispatch(setSelectedWorkspace(null));
      dispatch(setSelectedFolder(null));
      dispatch(setSnippetBreadCrum(null));
      dispatch(setSelectedSnippet(null));
    };
  }, [dispatch]);

  // Show loading state while data is being fetched
  if (!selectedTeam) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-editorBg)] text-neutral-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-lg font-medium">Loading data...</p>
        </div>
      </div>
    );
  }

  // Show loading state if we're fetching data for an existing note
  if (!isTempNewNote && !activeSnippet && isDataLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-editorBg)] text-neutral-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-lg font-medium">Loading note...</p>
        </div>
      </div>
    );
  }

  // Show loading state while draft is being loaded for temp notes
  if (isTempNewNote && !isDraftLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-editorBg)] text-neutral-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-lg font-medium">Preparing editor...</p>
        </div>
      </div>
    );
  }

  // Choose the appropriate editor based on the category
  const isSnippetMode = activeSnippet?.category === 'snippet' || (isTempNewNote && draftKey?.startsWith('snippet-')); // Check draftKey prefix if temp
  const isPromptMode = activeSnippet?.category === 'prompt';

  return (
    <div className="fixed inset-0 z-[100002] bg-[var(--color-editorBg)] overflow-hidden">
      {isPromptMode ? (
        <CreatePromptPanel onClose={onBack || (() => {})} />
      ) : isSnippetMode ? (
        <SnippetEditor
          selectedTeamId={selectedTeam.team_id}
          selectedSnippet={activeSnippet}
          isCreatingNew={isTempNewNote}
          snippetBreadCrum={breadcrumb}
          reload={reload}
          favoritesMapping={favoritesMapping}
          setFavoritesMapping={setFavoritesMapping}
          onBack={onBack}
          initialDraftKey={isTempNewNote ? draftKey : undefined}
          initialDraftContent={isTempNewNote ? draftContent : undefined}
          isFullScreenMode={true}
          category="snippet"
        />
      ) : (
        <RichTextEditor
          selectedTeamId={selectedTeam.team_id}
          selectedSnippet={activeSnippet}
          isCreatingNew={isTempNewNote}
          snippetBreadCrum={breadcrumb}
          reload={reload}
          favoritesMapping={favoritesMapping}
          setFavoritesMapping={setFavoritesMapping}
          onBack={onBack}
          initialDraftKey={isTempNewNote ? draftKey : undefined}
          initialDraftContent={isTempNewNote ? draftContent : undefined}
          isFullScreenMode={true}
          category="note"
        />
      )}
    </div>
  );
};

export default FullScreenNoteView;
