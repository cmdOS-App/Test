import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FaTimes, FaPlus, FaCheck, FaFolder, FaUsers, FaGlobe, FaLock, FaChevronDown } from 'react-icons/fa';
import { LuSave } from 'react-icons/lu';
import { useDispatch, useSelector } from 'react-redux';
import { createAutomation } from '../../../../../Apis/core/api';
import { optimisticAddAutomation, selectAllData } from '../../../../../Redux/AllData/allDataSlice';
import type { AppDispatch, RootState } from '../../../../../Redux/store';
import SaveDestinationPicker from '../../Editor/SaveDestinationPicker';
import type { Workspace, Folder, Team } from '../../../../../modals/interfaces';
import {
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectSnippetBreadCrum,
  selectIsMac,
  selectDarkMode,
  selectSelectedTeam,
  setSelectedWorkspace,
  setSelectedFolder,
  setSnippetBreadCrum,
  clearDraftAutomation,
} from '../../../../../Redux/AllData/uiStateSlice';
import useToast from '../../Shared/Toast/useToast';
import { getFaviconUrl, appendCmdStatus } from './utils';
import { getDestinationPathDetails } from '../../../utils/pathUtils';
import { fetchWorkspacesThunk, selectWorkspacesByTeam } from '../../../../../Redux/Workspaces/workspaceSlice';

interface SaveAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAIs: string[];
  prompt: string;
  activeAiSession?: {
    id: string | number;
    sessionKey: string;
    prompt: string;
    name?: string;
    models: string[];
    tabIds: number[];
    urls: string[];
    workspace_id?: string | null;
    folder_id?: string | null;
  } | null;
  onSaveSuccess?: (name: string, id: string | number) => void;
}

const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

const SaveAgentModal: React.FC<SaveAgentModalProps> = ({
  isOpen,
  onClose,
  selectedAIs,
  prompt,
  activeAiSession,
  onSaveSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const dispatch = useDispatch<AppDispatch>();
  const triggerToast = useToast();
  const allTeams = useSelector(selectAllData);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const snippetBreadCrum = useSelector(selectSnippetBreadCrum);
  const selectedTeam = useSelector(selectSelectedTeam);
  const isMac = useSelector(selectIsMac);
  const isDarkMode = useSelector(selectDarkMode);

  // Manual location overrides (matching LinkEditModal)
  const [manualWorkspaceId, setManualWorkspaceId] = useState<string | null>(null);
  const [manualFolderId, setManualFolderId] = useState<string | null>(null);
  const isManualOverride = manualWorkspaceId !== null;

  // Determine Organization Team
  const orgTeam = useMemo(() => {
    if (selectedTeam && selectedTeam.is_personal_space !== true) {
      return selectedTeam;
    }
    return Array.isArray(allTeams) ? allTeams.find(t => t.is_personal_space !== true) || null : null;
  }, [selectedTeam, allTeams]);

  // Determine Personal Workspaces
  const personalWorkspaces = useMemo(() => {
    if (!allTeams) return [];
    const privateTeam = allTeams.find(team => team.is_personal_space === true || team.team_name === 'Personal Space');
    return privateTeam?.workspaces || [];
  }, [allTeams]);

  const orgTeamId = orgTeam?.team_id || '';
  const workspacesMetadata = useSelector((state: RootState) => selectWorkspacesByTeam(state, orgTeamId));

  const hasFetchedWorkspaces = React.useRef(false);

  // Ensure workspace metadata is fetched for correct icon resolution
  useEffect(() => {
    if (orgTeamId && workspacesMetadata.length === 0 && !hasFetchedWorkspaces.current) {
      dispatch(fetchWorkspacesThunk(orgTeamId));
      hasFetchedWorkspaces.current = true;
    }
  }, [dispatch, orgTeamId, workspacesMetadata.length]);

  // Derivation Precedence Matching LinkEditModal
  const targetWorkspaceId = isManualOverride
    ? manualWorkspaceId
    : snippetBreadCrum?.workspace_id || selectedWorkspace?.workspace_id || '';

  const targetFolderId = isManualOverride
    ? manualFolderId
    : snippetBreadCrum?.folder_id || selectedFolder?.folder_id || '';

  const hasDestination = Boolean(targetWorkspaceId);

  // Resolve the display name and details for the destination button
  const destinationDetails = useMemo(() => {
    const wsType = (workspacesMetadata?.find((w: Workspace) => w.workspace_id === targetWorkspaceId) as any)?.type;
    return getDestinationPathDetails(allTeams, targetWorkspaceId, targetFolderId, null, wsType);
  }, [targetWorkspaceId, targetFolderId, allTeams, workspacesMetadata]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!title.trim()) {
      triggerToast('Please enter a name for your agent', 'error');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      // 1. Map all captured/selected models to their URLs with selection status
      const customModels = (activeAiSession as any)?.customModelDefinitions || [];

      const allAiUrls: Record<string, string> = {};
      const allModelIds = Array.from(new Set([...(activeAiSession?.models || []), ...selectedAIs]));

      allModelIds.forEach(id => {
        const isSelected = selectedAIs.includes(id);
        const sessionIdx = activeAiSession?.models?.indexOf(id);
        let baseUrl = '';

        if (sessionIdx !== undefined && sessionIdx !== -1 && activeAiSession?.urls?.[sessionIdx]) {
          baseUrl = activeAiSession.urls[sessionIdx];
        } else if (DEFAULT_ALL_AI_URLS[id]) {
          baseUrl = DEFAULT_ALL_AI_URLS[id];
        } else {
          // Fallback to locally defined custom models
          const custom = customModels.find((m: any) => m.id === id);
          if (custom) baseUrl = custom.url;
        }

        if (baseUrl) {
          // Filter: only save models that are currently selected to keep agent config clean
          if (isSelected) {
            allAiUrls[id] = appendCmdStatus(baseUrl, isSelected);
          }
        }
      });

      // 2. Construct Step
      const ALL_AI_STEP = {
        module_id: '5', // Numeric ID for All AI from Catalog
        step_order: 1,
        config: {
          module_key: 'all_ai',
          isCloudModule: true,
          agentId: 'all_ai',
          name: 'All AI Chat Agents',
          iconHost: 'chatgpt.com',
          allAiUrls: allAiUrls,
          // Spread individual model URLs into the config for compatibility
          ...allAiUrls,
          prompt: activeAiSession?.prompt || prompt, // Use activeAiSession.prompt first (always correct), fallback to prop
          consolidatedAllAi: true,
          isAllAi: true,
        },
      };

      // 3. Call API
      const result = await createAutomation({
        name: title.trim(),
        workspace_id: targetWorkspaceId || null,
        folder_id: targetFolderId || null,
        steps: [ALL_AI_STEP],
      }, selectedTeam?.storageMode ?? 'cloud');

      const rawAutomation = result?.data ?? result;
      const savedId = rawAutomation?.id || rawAutomation?.automation_id;
      const savedAutomation = rawAutomation ? { ...rawAutomation, id: savedId } : null;

      // 4. Update Redux optimistically (always, even for root-level saves)
      if (savedAutomation && savedId) {
        const resolvedTeam = targetWorkspaceId
          ? allTeams?.find(t => (t.workspaces || []).some(w => w.workspace_id === targetWorkspaceId))
          : allTeams?.[0]; // fallback to first team if no workspace selected

        dispatch(
          optimisticAddAutomation({
            teamId: resolvedTeam?.team_id || orgTeam?.team_id || '',
            workspaceId: targetWorkspaceId || '',
            folderId: targetFolderId || null,
            automation: savedAutomation,
          }),
        );
      }

      triggerToast('Agent saved successfully!', 'success');
      dispatch(clearDraftAutomation());
      onSaveSuccess?.(title.trim(), savedId);
      onClose();
    } catch (error: any) {
      console.error('[SaveAgentModal] Failed to save agent:', error);
      triggerToast(error?.message || 'Failed to save agent', 'error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [
    title,
    targetWorkspaceId,
    targetFolderId,
    activeAiSession,
    selectedAIs,
    allTeams,
    orgTeam,
    prompt,
    onSaveSuccess,
    onClose,
    dispatch,
    triggerToast,
  ]);

  // Set title ONLY when the modal first opens (not on workspace/prompt changes)
  const hasInitializedTitle = useRef(false);
  useEffect(() => {
    if (isOpen) {
      if (!hasInitializedTitle.current) {
        const resolvedPrompt = activeAiSession?.prompt || prompt;
        const defaultTitle = resolvedPrompt
          ? resolvedPrompt.length > 50
            ? resolvedPrompt.slice(0, 47) + '...'
            : resolvedPrompt
          : '';
        setTitle(defaultTitle);
        hasInitializedTitle.current = true;
      }

      // Reset manual overrides when reopening
      setManualWorkspaceId(null);
      setManualFolderId(null);

      // Auto-select default destination if none is present
      if (!targetWorkspaceId) {
        chrome.storage.local.get('lastNoteDestination', result => {
          const lastDest = result.lastNoteDestination;

          if (lastDest && allTeams) {
            for (const team of allTeams) {
              const workspace = team.workspaces?.find((ws: any) => ws.workspace_id === lastDest.workspace_id);
              if (workspace) {
                let folder: Folder | null = null;
                if (lastDest.folder_id) {
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

          // Fallback: Select first workspace of selected team if no last destination
          const teamToUse = selectedTeam || allTeams?.[0];
          if (teamToUse && teamToUse.workspaces && teamToUse.workspaces.length > 0) {
            const defaultWorkspace = teamToUse.workspaces[0];
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
      }
    } else {
      // Reset the init flag when modal closes so it re-initializes next time
      hasInitializedTitle.current = false;
    }
  }, [isOpen, allTeams, selectedTeam, dispatch]);

  const handleWorkspaceDestination = useCallback((workspace: Workspace, isPersonal?: boolean) => {
    setManualWorkspaceId(workspace.workspace_id);
    setManualFolderId(null);
    setIsLocationPickerOpen(false);
  }, []);

  const handleFolderDestination = useCallback((workspace: Workspace, folder: Folder, isPersonal?: boolean) => {
    setManualWorkspaceId(workspace.workspace_id);
    setManualFolderId(folder.folder_id);
    setIsLocationPickerOpen(false);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      // Save Shortcut: Cmd+Enter (Mac) or Ctrl+Enter (Win)
      const isSaveShortcut = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';

      if (isSaveShortcut) {
        event.preventDefault();
        if (isSaving) return;
        handleSave();
      }
      // Location Picker Shortcut: Alt+Enter
      else if (event.altKey && event.key === 'Enter') {
        event.preventDefault();
        if (isSaving) return;
        setIsLocationPickerOpen(prev => !prev);
      } else if (event.key === 'Escape') {
        // Only handle escape if picker is closed, otherwise picker handles it or modal onClose
        if (!isLocationPickerOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMac, isSaving, isLocationPickerOpen, handleSave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300 ${
        isDarkMode ? 'bg-black/80' : 'bg-[#073642]/25'
      }`}>
      <div
        className={`w-full max-w-md rounded-2xl animate-in zoom-in-95 duration-200 ${
          isDarkMode
            ? 'bg-black border border-white/10 shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)]'
            : 'bg-[#fdf6e3] border border-[#d8d2bf] shadow-[0_0_50px_-12px_rgba(7,54,66,0.25)]'
        }`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-[#d8d2bf] bg-[#eee8d5]/40'
          }`}>
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner ${
                isDarkMode ? 'bg-white/5 text-white/70' : 'bg-[#eee8d5] text-[#586e75]'
              }`}>
              <LuSave size={18} />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-textPrimary)]">
              Save Agent
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all active:scale-90 ${
              isDarkMode
                ? 'hover:bg-white/10 text-white/40 hover:text-white'
                : 'hover:bg-[#eee8d5] text-[#93a1a1] hover:text-[#073642]'
            }`}>
            <FaTimes size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Agent Name */}
          <div className="space-y-2">
            <label
              className={`text-[11px] font-bold tracking-[0.2em] ml-1 ${
                isDarkMode ? 'text-white/30' : 'text-[#586e75]'
              }`}>
              Agent Name
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. My Multi-Model Researcher"
              autoFocus
              className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all shadow-inner placeholder-[var(--color-textPlaceholder)] ${
                isDarkMode
                  ? 'bg-black border border-white/10 text-white focus:ring-white/10 focus:border-white/20'
                  : 'bg-[#fdf6e3] border border-[#d8d2bf] text-[#073642] focus:ring-[#93a1a1]/30 focus:border-[#93a1a1]'
              }`}
            />
          </div>

          {/* Location Picker */}
          <div className="space-y-2 relative">
            <label
              className={`text-[11px] font-bold tracking-[0.2em] ml-1 ${
                isDarkMode ? 'text-white/30' : 'text-[#586e75]'
              }`}>
              Save Destination
            </label>
            <button
              onClick={() => setIsLocationPickerOpen(!isLocationPickerOpen)}
              className={`w-full h-11 flex items-center justify-between rounded-xl px-4 text-sm transition-all text-left shadow-inner group ${
                isDarkMode
                  ? 'bg-black border border-white/10 text-white hover:bg-white/[0.02]'
                  : 'bg-[#fdf6e3] border border-[#d8d2bf] text-[#073642] hover:bg-[#eee8d5]/60'
              }`}>
              <div className="flex items-center gap-2 truncate">
                {hasDestination ? (
                  <>
                    <span className={`text-base ${isDarkMode ? 'text-white/60' : 'text-[#586e75]'}`}>📁</span>
                    {destinationDetails.iconType === 'globe' ? (
                      <FaGlobe
                        className={`transition-colors ${
                          isDarkMode
                            ? 'text-white/40 group-hover:text-white/60'
                            : 'text-[#93a1a1] group-hover:text-[#586e75]'
                        }`}
                        size={12}
                      />
                    ) : destinationDetails.iconType === 'users' ? (
                      <FaUsers
                        className={`transition-colors ${
                          isDarkMode
                            ? 'text-white/40 group-hover:text-white/60'
                            : 'text-[#93a1a1] group-hover:text-[#586e75]'
                        }`}
                        size={12}
                      />
                    ) : (
                      <FaLock
                        className={`transition-colors ${
                          isDarkMode
                            ? 'text-white/40 group-hover:text-white/60'
                            : 'text-[#93a1a1] group-hover:text-[#586e75]'
                        }`}
                        size={12}
                      />
                    )}
                  </>
                ) : (
                  <FaFolder className={`shrink-0 ${isDarkMode ? 'text-white/40' : 'text-[#93a1a1]'}`} size={12} />
                )}
                <span
                  className={`truncate font-medium transition-colors ${
                    isDarkMode ? 'text-white/80 group-hover:text-white' : 'text-[#586e75] group-hover:text-[#073642]'
                  }`}>
                  {hasDestination ? destinationDetails.pathText : 'Select Destination'}
                </span>
                <span
                  className={`flex items-center gap-1 text-[9px] font-semibold ${
                    isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'
                  }`}>
                  <span
                    className={`rounded-md border px-1 py-0 ${
                      isDarkMode ? 'border-white/20 bg-neutral-700' : 'border-[#d8d2bf] bg-[#fdf6e3]'
                    }`}>
                    {isMac ? '⌥' : 'Alt'}
                  </span>
                  <span className={isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}>+</span>
                  <span
                    className={`rounded-md border px-1 py-0 ${
                      isDarkMode ? 'border-white/20 bg-neutral-700' : 'border-[#d8d2bf] bg-[#fdf6e3]'
                    }`}>
                    Enter
                  </span>
                </span>
              </div>
            </button>

            {isLocationPickerOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 z-[120] animate-in slide-in-from-bottom-2 duration-300">
                <SaveDestinationPicker
                  team={orgTeam}
                  personalWorkspaces={personalWorkspaces}
                  currentSelection={{
                    workspaceId: targetWorkspaceId || null,
                    folderId: targetFolderId || null,
                  }}
                  onSelectWorkspace={handleWorkspaceDestination}
                  onSelectFolder={handleFolderDestination}
                  onClose={() => setIsLocationPickerOpen(false)}
                  className={`w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
                    isDarkMode ? 'border border-white/20 !bg-black' : 'border border-[#d8d2bf] !bg-[#fdf6e3]'
                  }`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
            isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-[#eee8d5]/40 border-[#d8d2bf]'
          }`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
              isDarkMode
                ? 'text-white/40 hover:text-white hover:bg-white/5'
                : 'text-[#586e75] hover:text-[#073642] hover:bg-[#eee8d5]'
            }`}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className={`flex items-center gap-2 rounded-md border px-5 py-2 text-sm font-semibold transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                : 'border-[#d8d2bf] bg-[#eee8d5] text-[#073642] hover:bg-[#e7e0cc]'
            }`}>
            {isSaving ? (
              <div
                className={`w-4 h-4 border-2 rounded-full animate-spin ${
                  isDarkMode ? 'border-white/30 border-t-white' : 'border-[#93a1a1] border-t-[#073642]'
                }`}
              />
            ) : (
              <div className="flex items-center gap-2">
                <FaCheck size={14} className={isDarkMode ? 'text-white/80' : 'text-[#073642]'} />
                <span>Save Agent</span>
                <span
                  className={`ml-1 text-[10px] font-mono leading-none flex items-center gap-1 border rounded px-1 py-0.5 ${
                    isDarkMode
                      ? 'opacity-40 border-white/20 bg-neutral-700'
                      : 'opacity-80 border-[#d8d2bf] bg-[#fdf6e3] text-[#586e75]'
                  }`}>
                  {isMac ? '⌘' : 'Ctrl'} + Enter
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAgentModal;
