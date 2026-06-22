import type React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SuggestionState } from './Searchbar';
import { Attachment } from './Searchbar';
import { stripCmdStatus, appendCmdStatus } from './utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCheck,
  FaGlobe,
  FaUsers,
  FaFileAlt,
  FaFilePdf,
  FaFileCode,
  FaFileArchive,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileAudio,
  FaFileVideo,
  FaTimes,
  FaArrowRight,
  FaLock,
  FaRobot,
  FaCheckDouble,
  FaExpandAlt,
  FaTerminal,
  FaPencilAlt,
} from 'react-icons/fa';
import { LuPlus } from 'react-icons/lu';
import { GoPaperclip } from 'react-icons/go';
import { SaveAgentToast } from './SaveAgentToast';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllData, optimisticUpdateAutomation } from '../../../../../Redux/AllData/allDataSlice';
import {
  selectSelectedWorkspace,
  selectSelectedFolder,
  selectDarkMode,
  setSelectedWorkspace,
  setSelectedFolder,
} from '../../../../../Redux/AllData/uiStateSlice';
import { getDestinationPathDetails, findWorkspaceInTeams } from '../../../utils/pathUtils';
import SaveDestinationPicker from '../../Editor/SaveDestinationPicker';
import type { Workspace, Folder, Team } from '../../../../../modals/interfaces';
import { updateAutomation } from '../../../../../Apis/core/api';
import useToast from '../../Shared/Toast/useToast';
import type { AppDispatch } from '../../../../../Redux/store';
import SavedAutomationsPanel from './SavedAutomationsPanel';
import AutomationSkillsPanel from './AutomationSkillsPanel';
import StackedLinkIcon from '../../Shared/Icons/StackedLinkIcon';
import SaveAgentModal from './SaveAgentModal';
import thunder from '../../../assets/thunder.svg';

const DoubleTick = ({ size = 14 }: { size?: number }) => (
  <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
    {/* First Tick (Left) */}
    <FaCheck size={size} className="absolute left-[-2px] opacity-80" />
    {/* Second Tick (Right/Top) */}
    <FaCheck size={size} className="absolute left-[2px]" />
  </div>
);

const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

interface LogItem {
  id: string;
  prompt: string;
  timestamp: number;
}

type TabType = 'agents' | 'automations' | 'skills';

const RenderLogPrompt: React.FC<{ prompt: string; isDarkMode: boolean }> = ({ prompt, isDarkMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const CHAR_LIMIT = 200;
  const LINE_LIMIT = 4;

  const lines = prompt.split('\n');
  const isLarge = prompt.length > CHAR_LIMIT || lines.length > LINE_LIMIT;

  if (!isLarge) {
    return <div className="whitespace-pre-wrap">{prompt}</div>;
  }

  const displayText = isExpanded ? prompt : lines.slice(0, LINE_LIMIT).join('\n').slice(0, CHAR_LIMIT);

  return (
    <div className="relative group/log flex flex-col items-end w-full">
      <div
        className={`whitespace-pre-wrap transition-all duration-300 text-right w-full ${!isExpanded ? 'max-h-[120px] overflow-hidden' : ''
          } relative`}>
        {displayText}
        {!isExpanded && (
          <div
            className={`absolute bottom-0 left-0 right-0 h-6 pointer-events-none ${isDarkMode
                ? 'bg-gradient-to-t from-neutral-900/60 to-transparent'
                : 'bg-gradient-to-t from-[#eee8d5] to-transparent'
              }`}
          />
        )}
      </div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`mt-1 flex items-center gap-1 text-[9px] font-bold transition-all px-1.5 py-0.5 rounded active:scale-95 shrink-0 ${isDarkMode
            ? 'text-white/30 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/5'
            : 'text-[#586e75] hover:text-[#073642] bg-[#eee8d5]/60 hover:bg-[#eee8d5] border border-[#d8d2bf]'
          }`}
        title={isExpanded ? 'Show Less' : 'Show More'}>
        <FaExpandAlt size={7} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        <span>{isExpanded ? 'LESS' : 'MORE'}</span>
      </button>
    </div>
  );
};

interface AICommandLockedUIProps {
  state: SuggestionState;
  initialTab?: TabType;
  savedAgents?: any[];
  savedAutomations?: any[];
  onSelectSavedAgent?: (agent: any) => void;
  onRunAutomation?: (automation: any) => void;
  onEditAutomation?: (automation: any) => void;
  onExecuteModule?: (module: any) => void;
  onNewChat?: () => void;
  onSubmit?: (prompt: string) => void;
  onFileUpload?: () => void;
  onSaveAgent?: () => void;
  onClose?: () => void;
  isMac?: boolean;
  onQueryChange?: (val: string) => void;
  isLoggedIn?: boolean;
}

const AICommandLockedUI: React.FC<AICommandLockedUIProps> = ({
  state,
  initialTab = 'agents',
  savedAgents = [],
  savedAutomations = [],
  onSelectSavedAgent,
  onRunAutomation,
  onEditAutomation,
  onExecuteModule,
  onNewChat,
  onSubmit,
  onFileUpload,
  onSaveAgent,
  onClose,
  isMac = false,
  onQueryChange: onQueryChangeProp,
  isLoggedIn = false,
}) => {
  const {
    selectedAIs = [],
    onToggleAI,
    activeAiSession,
    value,
    selectedImagesCount = 0,
    updateActiveSessionMetadata,
    selectedImages = [],
    onRemoveAttachment,
    onQueryChange: onQueryChangeState,
  } = state;

  const onQueryChange = onQueryChangeProp || onQueryChangeState;
  const scrollRef = useRef<HTMLDivElement>(null);

  const dispatch = useDispatch<AppDispatch>();
  const allTeams = useSelector(selectAllData);
  const isDarkMode = useSelector(selectDarkMode);
  const selectedWorkspace = useSelector(selectSelectedWorkspace);
  const selectedFolder = useSelector(selectSelectedFolder);
  const triggerToast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab as TabType);
  const isAgentTab = activeTab === 'agents';


  // --- Agent Saving/Updating State ---
  const [isUpdating, setIsUpdating] = useState(false);
  const [optimisticSavedId, setOptimisticSavedId] = useState<string | number | null>(null);
  const [lastSavedSessionKey, setLastSavedSessionKey] = useState<string | null>(null);
  const [lastSavedModels, setLastSavedModels] = useState<string[]>([]);

  // --- Inline Agent Renaming State ---
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgentName, setEditingAgentName] = useState<string>('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  
  const [showSaveToast, setShowSaveToast] = useState(false);
  const prevLogsLengthRef = useRef(logs.length);

  const [showSavedStatus, setShowSavedStatus] = useState(false);

  // Load logs from extension local storage
  useEffect(() => {
    const sessionKey = activeAiSession?.sessionKey;
    const sessionPrompt = activeAiSession?.prompt;
    if (!sessionKey) {
      setLogs([]);
      return;
    }
    const storageKey = `ai_logs_${sessionKey}`;

    const loadLogs = (attempt = 0) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([storageKey], result => {
          const saved = result[storageKey];
          if (saved) {
            try {
              const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
              setLogs(parsed);
            } catch (e) {
              console.error('Failed to parse saved logs', e);
              setLogs([]);
            }
          } else if (attempt < 10) {
            // Increased retries
            setTimeout(() => loadLogs(attempt + 1), 150); // Increased delay
          } else if (sessionPrompt) {
            const seedLog = { id: `log-seed-${Date.now()}`, prompt: sessionPrompt.trim(), timestamp: Date.now() };
            chrome.storage.local.set({ [storageKey]: [seedLog] });
            setLogs([seedLog]);
          } else {
            setLogs([]);
          }
        });

      } else {
        setLogs([]);
      }
    };

    loadLogs();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes[storageKey]) {
          const newValue = changes[storageKey].newValue;
          if (newValue) {
            setLogs(typeof newValue === 'string' ? JSON.parse(newValue) : newValue);
          }
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
    return () => { };
  }, [activeAiSession?.sessionKey, activeAiSession?.prompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    setActiveTab(initialTab as TabType);
  }, [initialTab]);

  // Sync optimistic state when session is saved via modal (detecting ID change)
  useEffect(() => {
    if (
      activeAiSession?.id &&
      !String(activeAiSession.id).startsWith('session-') &&
      activeAiSession.id !== 'new-chat'
    ) {
      setOptimisticSavedId(activeAiSession.id);
      setLastSavedModels(selectedAIs);
      setLastSavedSessionKey(activeAiSession.sessionKey);
    }
  }, [activeAiSession?.id]);

  const activeSavedAgent = useMemo(() => {
    if (!activeAiSession || !savedAgents) return null;
    const sId = (activeAiSession as any).id;
    const idToMatch = String(sId);

    // 1. Try to find real agent in Redux
    const realAgent = savedAgents.find(a => String(a.id) === idToMatch) || null;
    if (realAgent) return realAgent;

    // 2. Fallback to optimistic state or direct ID detection
    const isRealId = sId && !idToMatch.startsWith('session-') && sId !== 'new-chat';
    const sessionKeyMatch = lastSavedSessionKey && activeAiSession.sessionKey === lastSavedSessionKey;
    const idMatch = optimisticSavedId && idToMatch === String(optimisticSavedId);

    if (isRealId || sessionKeyMatch || idMatch) {
      return {
        id: optimisticSavedId || sId,
        name: (activeAiSession as any).name || 'Saved Agent',
        workspace_id: activeAiSession.workspace_id,
        folder_id: activeAiSession.folder_id,
        automation_steps: [], // synthetic
      } as any;
    }
    return null;
  }, [activeAiSession, savedAgents, optimisticSavedId, lastSavedSessionKey]);

  const hasShownSaveToastForSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (logs.length > prevLogsLengthRef.current) {
      if (activeAiSession && !activeSavedAgent) {
        const sessionId = String((activeAiSession as any).id || activeAiSession.sessionKey);
        if (hasShownSaveToastForSessionIdRef.current !== sessionId) {
          setShowSaveToast(true);
          hasShownSaveToastForSessionIdRef.current = sessionId;
          setTimeout(() => {
            setShowSaveToast(false);
          }, 8000);
        }
      }
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length, activeAiSession, activeSavedAgent]);

  const isAgentModified = useMemo(() => {
    const sId = activeAiSession?.id ? String(activeAiSession.id) : null;
    const isNew = !sId || sId.startsWith('session-') || sId === 'new-chat';

    if (!activeSavedAgent) return isNew; // If not saved and not "new", we consider it modified/unsaved
    const steps = activeSavedAgent.automation_steps || (activeSavedAgent as any).steps;
    const firstStep = steps?.[0];

    let savedSelectedModels: string[] = [];

    if (firstStep) {
      const allAiUrls = firstStep.config?.allAiUrls || {};
      savedSelectedModels = Object.keys(allAiUrls)
        .filter(id => typeof allAiUrls[id] === 'string' && allAiUrls[id].includes('cmd_select_status=true'))
        .sort();
    } else if (lastSavedSessionKey && activeAiSession?.sessionKey === lastSavedSessionKey) {
      savedSelectedModels = [...lastSavedModels].sort();
    } else if (activeAiSession?.id && !String(activeAiSession.id).startsWith('session-')) {
      // It has a real ID but no steps (synthetic), assume not modified if just saved
      savedSelectedModels = [...selectedAIs].sort();
    } else {
      return isNew;
    }

    const currentSelectedModels = [...selectedAIs].sort();
    const modelsChanged = JSON.stringify(savedSelectedModels) !== JSON.stringify(currentSelectedModels);

    let urlsChanged = false;
    if (firstStep) {
      const allAiUrls = firstStep.config?.allAiUrls || {};
      for (const modelId of activeAiSession?.models || []) {
        const sessionIdx = activeAiSession?.models.indexOf(modelId);
        const currentUrl = activeAiSession?.urls[sessionIdx || 0];
        const savedUrlWithStatus = allAiUrls[modelId];
        const savedUrl = savedUrlWithStatus ? stripCmdStatus(savedUrlWithStatus) : '';
        if (currentUrl && savedUrl && stripCmdStatus(currentUrl) !== savedUrl) {
          urlsChanged = true;
          break;
        }
      }
    }

    return modelsChanged || urlsChanged;
  }, [
    activeSavedAgent,
    selectedAIs,
    lastSavedModels,
    lastSavedSessionKey,
    activeAiSession?.sessionKey,
    activeAiSession?.models,
    activeAiSession?.urls,
  ]);

  // Handle temporary visibility of "Agent Saved" status
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (!isAgentModified && activeSavedAgent) {
      setShowSavedStatus(true);
      timer = setTimeout(() => setShowSavedStatus(false), 3000);
    } else {
      setShowSavedStatus(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAgentModified, activeSavedAgent]);

  const handleUpdateAgent = async () => {
    if (!activeSavedAgent) return;
    setIsUpdating(true);
    try {
      const customResult = await new Promise<any>(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['custom_ai_models', 'selected_custom_ai_models'], resolve);
        } else {
          resolve({});
        }
      });
      const customModels = customResult.custom_ai_models || [];
      const selectedCustomIds = customResult.selected_custom_ai_models || [];

      const allModelIds = Array.from(
        new Set([...(activeAiSession?.models || []), ...selectedAIs, ...selectedCustomIds]),
      ).filter(id => selectedAIs.includes(id) || selectedCustomIds.includes(id));
      const allAiUrls: Record<string, string> = {};

      allModelIds.forEach(id => {
        const isSelected = selectedAIs.includes(id) || selectedCustomIds.includes(id);
        const sessionIdx = activeAiSession?.models?.indexOf(id);
        let baseUrl = '';

        if (sessionIdx !== undefined && sessionIdx !== -1 && activeAiSession?.urls?.[sessionIdx]) {
          baseUrl = activeAiSession.urls[sessionIdx];
        } else if (DEFAULT_ALL_AI_URLS[id]) {
          baseUrl = DEFAULT_ALL_AI_URLS[id];
        } else {
          const custom = customModels.find((m: any) => m.id === id);
          if (custom) baseUrl = custom.url;
        }

        if (baseUrl) {
          allAiUrls[id] = appendCmdStatus(stripCmdStatus(baseUrl), isSelected);
        }
      });

      const existingSteps = activeSavedAgent.automation_steps || (activeSavedAgent as any).steps || [];
      if (!existingSteps[0]) throw new Error('Agent has no valid steps');

      const updatedSteps = existingSteps.map((step: any, idx: number) => {
        if (idx === 0) {
          return {
            ...step,
            config: {
              ...step.config,
              allAiUrls,
              ...allAiUrls,
            },
          };
        }
        return step;
      });

      await updateAutomation({
        id: Number(activeSavedAgent.id),
        steps: updatedSteps,
      });

      const result = findWorkspaceInTeams(allTeams || [], String(activeSavedAgent.workspace_id));

      dispatch(
        optimisticUpdateAutomation({
          teamId: result?.team?.team_id || '',
          workspaceId: String(activeSavedAgent.workspace_id),
          folderId: activeSavedAgent.folder_id ? String(activeSavedAgent.folder_id) : null,
          automationId: Number(activeSavedAgent.id),
          updates: {
            automation_steps: updatedSteps,
          },
        }),
      );

      setLastSavedModels([...selectedAIs]);
      triggerToast('Agent updated successfully!', 'success');
    } catch (error: any) {
      console.error('[AICommandLockedUI] Failed to update agent:', error);
      triggerToast('Failed to update agent', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseWithCheck = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleOpenSaveModal = useCallback(() => {
    if (!isLoggedIn) return;
    if (activeAiSession?.name) return;
    onSaveAgent?.();
  }, [activeAiSession?.name, onSaveAgent, isLoggedIn]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        handleOpenSaveModal();
      } else if (e.key === 'Enter' && (isMac ? e.metaKey : e.ctrlKey)) {
        e.preventDefault();
        handleOpenSaveModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseWithCheck();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isMac, handleOpenSaveModal, handleCloseWithCheck]);

  const handleAgentClick = (agent: any) => {
    onSelectSavedAgent?.(agent);
    const agentObj = agent as any;
    if (agentObj.workspace_id || agentObj.folder_id) {
      let foundWs: Workspace | null = null;
      let foundFolder: Folder | null = null;

      const targetWsId = agentObj.workspace_id ? String(agentObj.workspace_id) : null;
      const targetFolderId = agentObj.folder_id ? String(agentObj.folder_id) : null;

      if (allTeams && Array.isArray(allTeams)) {
        for (const team of allTeams as Team[]) {
          for (const ws of team.workspaces || []) {
            const wsMatches = targetWsId && String(ws.workspace_id) === targetWsId;
            let folderMatch: Folder | null = null;
            if (targetFolderId) {
              const findFolder = (folders: Folder[]): Folder | null => {
                for (const f of folders) {
                  if (String(f.folder_id) === targetFolderId) return f;
                  if (f.folders) {
                    const sub = findFolder(f.folders);
                    if (sub) return sub;
                  }
                }
                return null;
              };
              folderMatch = findFolder(ws.folders || []);
            }

            if (wsMatches || folderMatch) {
              foundWs = ws;
              foundFolder = folderMatch;
              break;
            }
          }
          if (foundWs) break;
        }
      }

      if (foundWs) {
        dispatch(setSelectedWorkspace(foundWs));
        dispatch(setSelectedFolder(foundFolder || null));
      }
    }
  };

  useEffect(() => {
    if (activeAiSession?.workspace_id || activeAiSession?.folder_id) {
      let foundWs: Workspace | null = null;
      let foundFolder: Folder | null = null;
      const targetWsId = activeAiSession.workspace_id ? String(activeAiSession.workspace_id) : null;
      const targetFolderId = activeAiSession.folder_id ? String(activeAiSession.folder_id) : null;

      if (allTeams && Array.isArray(allTeams)) {
        for (const team of allTeams as Team[]) {
          for (const ws of team.workspaces || []) {
            const wsMatches = targetWsId && String(ws.workspace_id) === targetWsId;
            let folderMatch: Folder | null = null;
            if (targetFolderId) {
              const findFolder = (folders: Folder[]): Folder | null => {
                for (const f of folders) {
                  if (String(f.folder_id) === targetFolderId) return f;
                  if (f.folders) {
                    const sub = findFolder(f.folders);
                    if (sub) return sub;
                  }
                }
                return null;
              };
              folderMatch = findFolder(ws.folders || []);
            }

            if (wsMatches || folderMatch) {
              foundWs = ws;
              foundFolder = folderMatch;
              break;
            }
          }
          if (foundWs) break;
        }
      }

      if (foundWs) {
        dispatch(setSelectedWorkspace(foundWs));
        dispatch(setSelectedFolder(foundFolder || null));
      }
    }
  }, [activeAiSession?.workspace_id, activeAiSession?.folder_id, allTeams, dispatch]);

  return (
    <div
      className={`flex h-full w-full relative rounded-b-xl border-t-0 ${logs.length > 0 ? `glass-card border-white/40 dark:border-white/10 dark:bg-transparent ${isDarkMode ? 'border border-white/10' : 'border border-neutral-200'}` : 'border-transparent bg-transparent'} ${isDarkMode ? '' : 'bg-transparent'}`}
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      }}>
      <AnimatePresence>
        {(savedAgents.length > 0 || logs.length > 0) && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: 20 }}
            animate={{ width: 190, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-[10vh] h-[80vh] z-[99999] rounded-l-xl border shadow-2xl overflow-hidden ${isDarkMode
                ? `border-white/10 ${isAgentTab ? 'bg-black/40 backdrop-blur-md' : 'bg-black'}`
                : 'border-[#eee8d5] bg-[#fdf6e3]'
              }`}>
            <div className="flex-1 overflow-y-auto px-1.5 pb-2 custom-scrollbar no-scrollbar scrollbar-hide">
              <div className="mb-1 px-1 pt-3">
                {/* <div className="mb-4">
                  <button
                    onClick={() => {
                      setActiveTab('agents');
                      onNewChat?.();
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border transition-all active:scale-[0.98] text-[10px] font-black tracking-wider ${isDarkMode
                        ? 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                        : 'border-[#d8d2bf] bg-[#eee8d5]/40 text-[#586e75] hover:bg-[#eee8d5] hover:text-[#073642]'
                      }`}>
                    <LuPlus size={11} />
                    <span>New Chat</span>
                  </button>
                </div> */}
                <h4
                  className={`text-[11px] font-black tracking-[0.2em] mb-2 ${isDarkMode ? 'text-white/30' : 'text-[#586e75]'
                    }`}>
                  Your Chats :
                </h4>
              </div>

              <div className="mb-4">
                <div className="space-y-0.2">
                  {(() => {
                    

                    const activeUnsaved =
                      activeAiSession && !activeSavedAgent
                        ? [
                          {
                            id: 'active-session',
                            name: activeAiSession.name || activeAiSession.prompt || 'Untitled Session',
                            isActive: true,
                          },
                        ]
                        : [];

                    const savedPart = savedAgents.map(a => ({
                      ...a,
                      isActive: activeSavedAgent ? String(a.id) === String(activeSavedAgent.id) : false,
                    }));
                    const activeSaved = savedPart.filter(a => a.isActive);
                    const otherSaved = savedPart.filter(a => !a.isActive);

                    const allItems = [...activeUnsaved, ...activeSaved, ...otherSaved];

                    return allItems.length > 0
                      ? allItems.map((agent: any) => {
                        const isEditing = editingAgentId === String(agent.id);

                        const handleSaveName = async () => {
                          if (!editingAgentName.trim()) {
                            setEditingAgentId(null);
                            return;
                          }
                          try {
                            if (agent.id !== 'active-session') {
                              await updateAutomation({ id: Number(agent.id), name: editingAgentName.trim() });

                              const pathRes = findWorkspaceInTeams(allTeams || [], String(agent.workspace_id));
                              dispatch(
                                optimisticUpdateAutomation({
                                  teamId: pathRes?.team?.team_id || '',
                                  workspaceId: String(agent.workspace_id),
                                  folderId: agent.folder_id ? String(agent.folder_id) : null,
                                  automationId: Number(agent.id),
                                  updates: {
                                    name: editingAgentName.trim(),
                                  },
                                }),
                              );
                            }

                            // Always update the active session metadata so the header reflects the new name
                            updateActiveSessionMetadata?.({ name: editingAgentName.trim() });

                            // If this was an active session, we should also update its name in the local storage if it exists
                            const sessionKey = activeAiSession?.sessionKey;
                            if (sessionKey) {
                              chrome.storage.local.get([sessionKey], result => {
                                const sessionData = result[sessionKey];
                                if (sessionData) {
                                  sessionData.name = editingAgentName.trim();
                                  chrome.storage.local.set({ [sessionKey]: sessionData });
                                }
                              });
                            }
                          } catch (err) {
                            console.error('Failed to update agent name:', err);
                          } finally {
                            setEditingAgentId(null);
                          }
                        };

                        return (
                          <div
                            key={agent.id}
                            className={`w-full flex items-center justify-between px-1.5 py-1 transition-all group ${agent.isActive
                                ? isDarkMode
                                  ? 'bg-white/10'
                                  : 'bg-[#eee8d5]'
                                : isDarkMode
                                  ? 'hover:bg-white/5'
                                  : 'hover:bg-[#eee8d5]/70'
                              }`}>
                            <div
                              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                              onClick={() => {
                                setActiveTab('agents');
                                if (agent.id !== 'active-session') {
                                  handleAgentClick(agent);
                                }
                              }}
                              onDoubleClick={() => {
                                setEditingAgentId(String(agent.id));
                                setEditingAgentName(agent.name);
                              }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingAgentName}
                                  onChange={e => setEditingAgentName(e.target.value)}
                                  onBlur={handleSaveName}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveName();
                                    if (e.key === 'Escape') setEditingAgentId(null);
                                  }}
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                  className={`text-[12px] w-full px-1 py-0.5 rounded border outline-none bg-transparent ${isDarkMode
                                      ? 'border-white/20 text-white bg-neutral-800'
                                      : 'border-neutral-300 text-[#073642] bg-white'
                                    }`}
                                />
                              ) : (
                                <span
                                  className={`text-[12px] truncate ${agent.isActive
                                      ? isDarkMode
                                        ? 'text-white font-bold'
                                        : 'text-[#073642] font-bold'
                                      : isDarkMode
                                        ? 'text-white/60 group-hover:text-white'
                                        : 'text-[#657b83] group-hover:text-[#073642]'
                                    }`}>
                                  {agent.name}
                                </span>
                              )}
                            </div>

                            {!isEditing && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditingAgentId(String(agent.id));
                                  setEditingAgentName(agent.name);
                                }}
                                className={`opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 rounded transition-opacity ${isDarkMode
                                    ? 'text-white/60 hover:text-white'
                                    : 'text-[#657b83] hover:text-[#073642]'
                                  }`}>
                                <FaPencilAlt size={9} />
                              </button>
                            )}
                          </div>
                        );
                      })
                      : null;
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAgentTab ? (
        <div
          className={`flex-1 flex flex-col min-w-0 relative min-h-0 ${logs.length > 0 ? (isDarkMode ? 'bg-neutral-900/5' : 'bg-[#fdf6e3]') : 'bg-transparent'}`}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="flex flex-col gap-3 min-h-full">
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-end self-end max-w-[95%] py-1">
                    <div
                      className={`text-[13px] leading-snug text-right ${isDarkMode ? 'text-white' : 'text-[#073642]'}`}>
                      <RenderLogPrompt prompt={log.prompt} isDarkMode={isDarkMode} />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5 opacity-40">
                      <span className={`text-[10px] font-medium ${isDarkMode ? 'text-white/60' : 'text-[#586e75]'}`}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`flex items-center ${isDarkMode ? 'text-white/40' : 'text-[#93a1a1]'}`}>
                        <DoubleTick size={14} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <div className={`relative flex flex-1 min-w-0 flex-col ${isDarkMode ? 'bg-black' : 'bg-[#fdf6e3]'}`}>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-[90] p-1.5 rounded-full hover:bg-white/10 text-red-500 transition-all active:scale-95 group focus:outline-none"
            title="Exit AI Mode">
            <FaTimes
              size={16}
              className="transition-transform group-hover:rotate-90 opacity-70 group-hover:opacity-100"
            />
          </button>
          <div className="flex-1 min-h-0 pt-2">
            {activeTab === 'automations' ? (
              <SavedAutomationsPanel
                automations={savedAutomations}
                onRunAutomation={onRunAutomation}
                onEditAutomation={onEditAutomation}
              />
            ) : (
              <AutomationSkillsPanel onExecuteModule={onExecuteModule} />
            )}
          </div>
        </div>
      )}
      {isLoggedIn && isAgentTab && activeAiSession && (
        <div className={`absolute bottom-4 right-4 z-[50] flex flex-col items-end gap-2`}>
          {activeSavedAgent ? (
            isAgentModified ? (
              <button
                onClick={handleUpdateAgent}
                disabled={isUpdating}
                className={`flex items-center justify-center gap-1.5 rounded-md border w-auto px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-95 shadow-lg min-w-0 disabled:opacity-50 ${isDarkMode
                    ? 'border-white/20 bg-neutral-800 text-white/90 hover:bg-neutral-700 hover:text-white'
                    : 'border-[#d8d2bf] bg-[#eee8d5] text-[#073642] hover:bg-[#e7e0cc]'
                  }`}>
                {isUpdating ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FaCheck size={10} className={isDarkMode ? 'text-white/80' : 'text-[#073642]'} />
                )}
                <span>Update Agent</span>
              </button>
            ) : (
              showSavedStatus && (
                <div
                  className={`flex items-center justify-center gap-1.5 rounded-md border w-auto px-3 py-1.5 text-[10px] font-semibold cursor-default shadow-lg min-w-0 ${isDarkMode
                      ? 'border-white/10 bg-neutral-800/50 text-white/50'
                      : 'border-[#d8d2bf] bg-[#eee8d5]/70 text-[#586e75]'
                    }`}>
                  <FaCheck size={10} className={isDarkMode ? 'text-white/40' : 'text-[#93a1a1]'} />
                  <span>Agent Saved</span>
                </div>
              )
            )
          ) : (
            logs.length > 0 && (
              <AnimatePresence mode="wait">
                {showSaveToast && onSaveAgent ? (
                  <SaveAgentToast
                    key="save-toast"
                    onSave={onSaveAgent}
                    onClose={() => setShowSaveToast(false)}
                    agentName={activeAiSession?.name || activeAiSession?.prompt || 'AI Research Agent'}
                    isDarkMode={isDarkMode}
                    isMac={isMac}
                  />
                ) : (
                  <motion.button
                    key="save-btn"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={onSaveAgent}
                    className={`flex items-center justify-center gap-2 rounded-md border w-auto px-2.5 py-1.5 text-[10px] font-bold transition-all shadow-lg group active:scale-95 ${isDarkMode
                        ? 'border-white/20 bg-neutral-800 text-white/90 hover:bg-neutral-700 hover:text-white'
                        : 'border-[#d8d2bf] bg-[#eee8d5] text-[#073642] hover:bg-[#e7e0cc]'
                      }`}>
                    <span>Save Agent</span>
                    <span
                      className={`text-[8px] font-mono leading-none flex items-center gap-1 border rounded px-1 py-0.5 transition-opacity ${isDarkMode
                          ? 'opacity-30 group-hover:opacity-60 border-white/20 bg-neutral-700'
                          : 'opacity-60 group-hover:opacity-90 border-[#d8d2bf] bg-[#fdf6e3] text-[#586e75]'
                        }`}>
                      {isMac ? '⌘' : 'Ctrl'} + Enter
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default AICommandLockedUI;
