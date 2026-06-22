import type React from 'react';
import {
  extractCloudModuleInputDefinitions,
  resolveCloudModuleInputValues,
  runAutomation,
  type SavedAutomation,
  type AutomationInputDefinition,
} from '../../../../../utils/automation';
import { Dispatch } from '@reduxjs/toolkit';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useLayoutEffect,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  COMMANDS,
  AI_GROUP,
  type CommandId,
  type CommandDefinition,
  buildUrl,
  AutoSubmitKind,
  DEFAULT_SELECTED_AIS,
  BROWSER_NAME,
} from './commands';
import type { NoteCommandMap, LinkCommandMap } from './snippetSearch';
import {
  FaRobot,
  FaSearch,
  FaLayerGroup,
  FaFileAlt,
  FaFilePdf,
  FaFileCode,
  FaFileArchive,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileAudio,
  FaFileVideo,
  FaLink,
  FaRegFolder,
  FaTimes,
  FaBookmark,
  FaTerminal,
  FaBuilding,
  FaHistory,
  FaGlobe,
  FaCalculator,
  FaClock,
  FaCheck,
  FaSave,
} from 'react-icons/fa';
import NotesIcon from '@src/components/Shared/Icons/NotesIcon';
import { LuSparkles, LuPlus, LuX } from 'react-icons/lu';
import { GoPaperclip } from 'react-icons/go';
import { SiOpenai, SiPerplexity } from 'react-icons/si';
import { TbSparkles } from 'react-icons/tb';

import { createEventUrlFromText } from './eventParser';
import type { Snippet, Workspace, Folder, Tabs, Team } from '../../../../../modals/interfaces';
import {
  selectSelectedTeam,
  selectSelectedFolder,
  selectSelectedWorkspace,
  selectExpandedWorkspaces,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setSnippetBreadCrum,
  setIsCreatingNewItem,
  expandAllWorkspaces,
  selectDarkMode,
  navigateToView,
  setActiveTutorial,
  selectActiveTutorial,
} from '../../../../../Redux/AllData/uiStateSlice';
import { selectAllData, optimisticAddSnippet } from '../../../../../Redux/AllData/allDataSlice';
import { store, type RootState, type AppDispatch } from '../../../../../Redux/store';
import { getFaviconUrl, saveRecentCommand, appendCmdStatus, stripCmdStatus } from './utils';
import { searchCommands, createCommandIndex, type CommandSearchResult, type IndexedCommand } from './commandSearch';
import {
  LOCAL_COMMANDS,
  isLocalCommandId,
  dispatchWorkspaceAction,
  dispatchSnippetDeleteAction,
  type LocalCommandDefinition,
  type LocalCommandId,
} from './localCommands';
import { FaArrowLeft, FaArrowRight, FaArrowUp, FaChevronDown } from 'react-icons/fa';
import { TutorialCard, getTutorialProgress, setTutorialStepFinished } from '@src/components/Tutorial';
import { buildSnippetIndex, buildFolderIndex, searchSnippets, parseValue } from './snippetSearch';
import { buildCommonCommandEntries, type CommonCommandEntry } from './commonResults';
import { TerminalIcon } from '@src/components/Shared/utils/terminalIcon';
import CmdIcon from '@src/components/Shared/Icons/CmdIcon';

const FallbackFavicon = ({
  url,
  className,
  fallbackIcon: FallbackIcon = FaGlobe,
}: {
  url: string;
  className?: string;
  fallbackIcon?: React.ElementType;
}) => {
  const [error, setError] = useState(false);
   if (error || !url) return <FallbackIcon className={`text-[var(--color-iconDefault)] ${className}`} size={14} />;
  return <img src={getFaviconUrl(url)} alt="" className={className} onError={() => setError(true)} />;
};

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

import { useCommands } from './useCommands';
import useToast from '../../Shared/Toast/useToast';
import type { HistoryItem } from './historyAlgo';
import {
  searchAll as fuseSearchAll,
  detectPinnedCommand,
  preIndexHistory,
  type UnifiedSearchResult,
  type SearchOptions as FuseSearchOptions,
} from './searchEngine';
import InlinePromptPopup from './InlinePromptPopup';
import AtCommandPopup, { AT_COMMAND_COUNT, getFilteredAtCommandCount, getFilteredAtCommands } from './AtCommandPopup';
import { AIHistorySelectionPanel } from '../../Shared/AIHistorySelectionPanel';
import LoginRequiredDialog from '../../Modals/LoginRequiredDialog';
import CommandNotInstalledDialog from '../../Modals/CommandNotInstalledDialog';

import { addCommand } from '../../../../../Apis/features/featuredApi';
import { CMDOS_SIGN_UP_URL } from '../../../../../Apis/core/apiConfig';
import { updateAutomation } from '../../../../../Apis/core/api';
import { htmlToPlainTextWithStructure } from './pasteUtils';
import ContextualCommandPopup, { ContextualMatch } from './ContextualCommandPopup';
import { findContextualMatches, searchDedicatedPanel, type InstalledModule } from './searchEngine';
import FieldOptions from './FieldOptionsDropdown';
import AutomationInputs, { AutomationInputField } from './AutomationInputs';
import AutomationDynamicIcon, { resolveAutomationIconMeta } from '../../Shared/Icons/AutomationDynamicIcon';
import thunder from '../../../assets/thunder.svg';
import { processQuery } from '../../../utils/engines/queryRouter';
import type { TimeResult } from '../../../utils/engines/timeEngine';
import { trackCounterEvent } from '../../../../../utils/counterTracking';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import AIModelSelectionPanel from './AIModelSelectionPanel';

export interface Attachment {
  url: string; // Blob URL for preview
  file: File; // Original file object
  mimeType: string;
  filename: string;
}

export type AnyCommandId = CommandId | LocalCommandId | 'ai';

export type CommandSelectionInfo = {
  id: AnyCommandId;
  label: string;
  prefix: string;
  commandType: 'remote' | 'local' | 'aggregate';
  requiresInlineQuery: boolean;
};

export type SnippetSuggestion = {
  snippet: Snippet;
  workspace: Workspace;
  folder: Folder | null;
  isPersonal?: boolean;
  teamName?: string;
};

export type PromptMenuSuggestion =
  | {
    kind: 'prompt';
    prompt: SnippetSuggestion;
    label: string;
    matchScore?: number;
  }
  | {
    kind: 'automation';
    automation: SavedAutomation;
    label: string;
    matchScore?: number;
  };

export type RemoteCommandSuggestionItem = {
  _kind: 'command';
  commandType: 'remote';
  id: CommandId;
  label: string;
  prefix: string;
  score: number;
  matchedTokens: string[];
  command: CommandDefinition;
  description?: string;
};

export type LocalCommandSuggestionItem = {
  _kind: 'command';
  commandType: 'local';
  id: LocalCommandId;
  label: string;
  prefix: string;
  score: number;
  matchedTokens: string[];
  command: LocalCommandDefinition;
  description?: string;
};

export type AggregateCommandSuggestionItem = {
  _kind: 'command';
  commandType: 'aggregate';
  id: 'ai';
  label: string;
  prefix: string;
  score: number;
  matchedTokens: string[];
  description?: string;
};

export type CommandSuggestionItem =
  | RemoteCommandSuggestionItem
  | LocalCommandSuggestionItem
  | AggregateCommandSuggestionItem;

export type BookmarkSuggestionItem = {
  _kind: 'bookmark';
  id: string;
  title: string;
  url: string;
  commandId?: AnyCommandId;
};

export type CommonCommandSuggestionItem = {
  _kind: 'common_command';
  id: CommandId;
  label: string;
  description: string;
  command: CommandDefinition;
  query: string;
};

export type OpenUrlSuggestionItem = {
  _kind: 'open_url';
  url: string;
  displayUrl: string;
};

export type HistorySuggestionItem = {
  _kind: 'history';
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
  visitCount: number;
  frecencyScore?: number;
  /** If true, this result belongs to the "Other results" section at the bottom */
  isOtherResult?: boolean;
  commandId?: AnyCommandId;
};

export type AgentCollectionSuggestionItem = {
  _kind: 'agent_collection';
  title: string;
  itemCount: number;
};

export type AutomationSuggestionItem = {
  _kind: 'automation';
  automation: SavedAutomation;
};

export type ModuleSuggestionItem = {
  _kind: 'module';
  id: string;
  module: InstalledModule;
};

export type AIChatHistorySuggestionItem = {
  _kind: 'ai_history';
  id: string;
  sessionKey?: string;
  prompt: string;
  models: string[];
  urls: Record<string, string>;
  timestamp: number;
};

export type MathSuggestionItem = {
  _kind: 'math_result';
  query: string;
  result: string;
};

export type TimeSuggestionItem = {
  _kind: 'time_result';
  query: string;
  results: TimeResult[];
};

export type SuggestionListItem =
  | CommandSuggestionItem
  | BookmarkSuggestionItem
  | {
    _kind: 'workspace';
    workspace: Workspace;
    action: NonNullable<LocalCommandDefinition['action']>;
  }
  | {
    _kind: 'folder';
    folder: Folder;
    workspace: Workspace;
    action: NonNullable<LocalCommandDefinition['action']>;
  }
  | {
    _kind: 'folder_search';
    entryType: 'workspace' | 'folder'; // 'workspace' = Folders in UI, 'folder' = Sub-folders in UI
    folder: Folder | null; // null for workspace entries
    workspace: Workspace;
    fullPath?: string;
  }
  | {
    _kind: 'snippet';
    snippet: Snippet;
    workspace: Workspace;
    folder: Folder | null;
    isPersonal?: boolean;
    teamName?: string;
  }
  | CommonCommandSuggestionItem
  | OpenUrlSuggestionItem
  | HistorySuggestionItem
  | AgentCollectionSuggestionItem
  | AutomationSuggestionItem
  | ModuleSuggestionItem
  | MathSuggestionItem
  | TimeSuggestionItem
  | AIChatHistorySuggestionItem;

export type SuggestionMode = 'command' | 'snippet' | 'common' | 'mixed' | 'bookmark' | 'local' | 'history' | null;

export type FooterStatus = {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
} | null;
export interface SuggestionState {
  isVisible: boolean;
  suggestions: SuggestionListItem[];
  highlightIndex: number;
  mode: SuggestionMode;
  value: string;
  lockedCommand: AnyCommandId | null;
  onCommandMouseDown: (event: React.MouseEvent, id: AnyCommandId) => void;
  onHighlightIndexChange: (index: number) => void;
  onLocalSelect?: (item: any) => void;
  onSnippetSelect?: (item: SnippetSuggestion) => void;
  onAgentCollectionSelect?: (item: AgentCollectionSuggestionItem) => void;
  onAutomationSelect?: (automation: SavedAutomation) => void;
  onAutomationEdit?: (automation: SavedAutomation) => void;
  onModuleSelect?: (module: InstalledModule) => void;
  onAIHistorySelect?: (item: AIChatHistorySuggestionItem) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onCommonCommandSelect?: (item: CommonCommandSuggestionItem) => void;
  onRequestEditLink?: (item: SnippetSuggestion) => void;
  onRequestEditPrompt?: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete?: (detail: any) => void;
  onToggleFavorite?: (item: SnippetSuggestion | CommandSuggestionItem) => void;
  showPromo: boolean;
  footerStatus?: FooterStatus;
  isPromptMenuOpen?: boolean;
  inlineAutocomplete?: string | null;
  onInlineAutocompleteChange?: (text: string | null) => void;
  onFolderMouseDown?: (event: React.MouseEvent, folder: Folder) => void;
  isCommandLocked?: boolean;
  requiresInlineQuery?: boolean;
  isAtMenuOpen?: boolean;
  isContextualPopupOpen?: boolean;
  selectedImagesCount: number;
  showAIHistoryPanel?: boolean;
  onAIHistoryPanelToggle?: (show: boolean) => void;
  aiHistory?: AIChatHistorySuggestionItem[];
  isBackspacing?: boolean;
  isAutomationActive?: boolean;
  selectedAIs?: string[];
  onToggleAI?: (aiId: string) => void;
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
    customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
  } | null;
  selectedAutomation?: SavedAutomation | null;
  updateActiveSessionMetadata?: (metadata: {
    name?: string;
    id?: string | number;
    customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
  }) => void;
  onUpdateModelUrl?: (modelId: string, url: string) => void;
  onUpdateCustomModels?: (models: { id: string; name: string; url: string; host: string }[]) => void;
  selectedImages?: Attachment[];
  onRemoveAttachment?: (index: number) => void;
  onQueryChange?: (val: string) => void;
  isAIHistoryOpen?: boolean;
  onToggleAIHistory?: () => void;
}

export interface SearchbarProps {
  onSuggestionStateChange?: (state: SuggestionState | null) => void;
  onCommandExecute?: (
    commandId: CommandId | LocalCommandId | 'ai',
    options?: { prompt?: string; files?: { base64: string; filename: string }[] },
  ) => void;
  onSnippetSelect?: (item: SnippetSuggestion) => void;
  onAutomationSelect?: (automation: any) => void;
  onAutomationEdit?: (automation: any) => void;
  onRequestAutomationEdit?: (automation: any) => void;
  onQueryChange?: (value: string) => void;
  focus?: boolean;
  onRequestFocusChange?: (direction: 'up' | 'down') => void;
  onCommandModeExit?: () => void;
  onClearFolder?: () => void;
  onNavigateBack?: () => void;
  isCommandListView?: boolean;
  onClearCommandListView?: () => void;
  onToggleCommandListView?: (isOpen: boolean) => void;
  isAllItemsView?: boolean;
  allItemsType?: 'notes' | 'links' | 'prompts' | 'bookmarks' | 'organizations';
  onClearAllItemsView?: () => void;

  onRequestEditLink?: (item: SnippetSuggestion) => void;
  onRequestEditPrompt?: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete?: (detail: any) => void;
  onToggleFavorite?: (item: SnippetSuggestion | CommandSuggestionItem) => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  placeholder?: string;
  onGoToTemplates?: () => void; // Navigate to TemplatesView when command not found in @ menu
  onSearchbarFocus?: (isUserInitiated: boolean) => void; // Called when searchbar input gains focus
  searchValue?: string; // Optional controlled value to force clear/update
  isLoggedIn?: boolean;
  onLockedCommandChange?: (commandId: AnyCommandId | null) => void;
  isBoardViewEnabled?: boolean;
  onToggleBoardView?: () => void;
  isInitialAltSFocus?: boolean;
  onInitialAltSFocusChange?: (val: boolean) => void;
  lockedCommand?: AnyCommandId | null;
  onSaveAgent?: () => void;
  activeStoreTab?: 'catalog' | 'saved';
  onToggleStoreTab?: () => void;
  isAIHistoryOpen?: boolean;
  onToggleAIHistory?: () => void;
  savedAiAgents?: any[];
  hideDynamicIcon?: boolean;
  disableContextualPopup?: boolean;
  displayHomeView?: boolean;
  onHoverSlashDot?: () => void;
}

export interface SearchbarHandle {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  setSuggestionsHidden: (hidden: boolean) => void;
  getValue: () => string;
  setValue: (val: string) => void;
  lockCommand: (commandId: AnyCommandId | null, initialValue?: string) => void;
  previewCommand: (commandId: AnyCommandId) => void;
  processCommand: (commandId: AnyCommandId) => void;
  clearCommandPreview: () => void;
  executeCommand: (commandId: AnyCommandId, options?: { mode?: 'execute' | 'lock' }) => void;
  requestPreviewRestore: () => void;
  isLocked: boolean;
  openUrls: (urls: string[], title?: string, forceNewTab?: boolean) => void;
  activateAutomation: (automation: SavedAutomation) => void;
  executeModule: (moduleId: string) => void;
  submitAI: (prompt: string) => void;
  triggerFileUpload: () => void;
  selectSavedAgent: (agent: any) => void;
  newAiChat: () => void;
  updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => void;
  executeSnippet: (snippet: any, forceNewTab?: boolean) => void;
}
export type AutoSubmitRequest = {
  id?: string;
  kind: AutoSubmitKind;
  prompt: string;
  images?: {
    base64: string;
    mimeType: string;
    filename: string;
  }[];
};
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result); // Return the full Data URL
    };
    reader.onerror = error => reject(error);
  });
};

export type LinkToOpen = string | { url: string; autoSubmit?: AutoSubmitRequest };

const toLinkConfig = (link: LinkToOpen): { url: string; autoSubmit?: AutoSubmitRequest } =>
  typeof link === 'string' ? { url: link } : link;

// In the new-tab build we don't declare a real 'bookmarks' local command,
// but we still reuse the AltS helper logic which expects this id.
// Use a type assertion here to avoid a TS error while keeping behavior consistent.
const BOOKMARKS_COMMAND_ID = 'bookmarks' as LocalCommandId;
const isBookmarksCommand = (cmd: AnyCommandId | null): boolean => cmd === 'bookmarks';
const trimQuery = (value: string): string => value.trim();
const STATIC_PLACEHOLDER = 'Type to search';
const COMMAND_PREVIEW_HINT = 'Press Tab/Enter to ask in command mode.';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCommandToken = (token: string): string => token.replace(/^\//, '').toLowerCase();

// Detect if a query looks like a website URL (e.g., "example.co/path", "example.com")
// Supports multiple URLs separated by spaces or commas.
const getUrlsFromQuery = (query: string): string[] => {
  const trimmed = query.trim();
  if (!trimmed || trimmed.startsWith('/')) return [];

  // Split by comma or space
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const urls: string[] = [];

  const urlPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(\/.*)?$/i;
  const localPattern = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/;
  // Matches chrome://, edge://, brave://, ftp://, file://, about:, opera://, vivaldi://, etc.
  const protocolPattern = /^(chrome|edge|brave|opera|vivaldi|ftp|file|about|chrome-extension|moz-extension):\/?\/?/i;

  for (const token of tokens) {
    // Match http:// and https:// URLs
    if (/^https?:\/\//i.test(token)) {
      urls.push(token);
      continue;
    }
    // Match other protocol URLs (chrome://, edge://, ftp://, file://, etc.)
    if (protocolPattern.test(token)) {
      urls.push(token);
      continue;
    }
    if (urlPattern.test(token) || localPattern.test(token) || ipPattern.test(token)) {
      urls.push(normalizeUrl(token));
    }
  }

  return urls;
};

const looksLikeUrl = (query: string): boolean => {
  return getUrlsFromQuery(query).length > 0;
};

// Normalize a URL query to a proper URL (add https:// if needed)
const normalizeUrl = (query: string): string => {
  const trimmed = query.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const extractPromptFromInput = (
  input: string,
  info: { id: AnyCommandId; prefix: string },
): { prompt: string; matched: boolean } => {
  const trimmed = trimQuery(input);
  if (!trimmed) {
    return { prompt: '', matched: false };
  }

  const tokens = Array.from(
    new Set([normalizeCommandToken(String(info.id)), normalizeCommandToken(info.prefix)]),
  ).filter(Boolean);
  if (tokens.length === 0) {
    return { prompt: trimmed, matched: false };
  }

  const pattern = new RegExp(`^\\/?(${tokens.map(escapeRegExp).join('|')})(?:\\s+|:)?`, 'i');
  const match = trimmed.match(pattern);
  if (!match) {
    return { prompt: trimmed, matched: false };
  }

  const prompt = trimQuery(trimmed.slice(match[0].length));
  return { prompt, matched: true };
};

export const resolvePlaceholderFromCmd = (cmd: AnyCommandId | null): string => {
  if (!cmd) return STATIC_PLACEHOLDER;
  const c = String(cmd).toLowerCase();

  // AI group: /ai and member commands
  const aiIds = new Set<string>([...AI_GROUP.members.map(id => id.toLowerCase()), 'ai']);
  if (aiIds.has(c)) {
    if (c === 'gpt') return 'Ask ChatGPT...';
    if (c === 'claude') return 'Ask Claude...';
    if (c === 'gemini') return 'Ask Gemini...';
    if (c === 'perplexity') return 'Ask Perplexity...';
    return 'Ask anything...';
  }

  if (c === 'upload_drive') {
    return 'Attach files (Ctrl+U or paste)';
  }

  // Web search commands
  if (c === 'g' || c === 'google' || c === 'bing' || c === 'duck' || c === 'yt' || c === 'perplexity') {
    return 'Search here';
  }

  if (c === 'store') {
    return 'Search the store...';
  }

  // Event creation
  if (c === 'event' || c === 'calendar') {
    return 'Eg: meeting tomorrow at 9 PM with einstein@mail.com';
  }

  // Spotify
  if (c === 'spotify') {
    return 'Enter song name...';
  }

  // Local create commands
  if (c === 'createnotes') {
    return '';
  }
  if (c === 'createlinks') {
    return '';
  }

  // Bookmarks mode
  if (c === BOOKMARKS_COMMAND_ID) {
    return 'Search bookmarks';
  }

  return STATIC_PLACEHOLDER;
};

const ALL_AI_AGENT_IDS = new Set(['all_ai', 'all']);
const ALL_AI_ROOT_MODULE_IDS = new Set(['all_ai']);
const AI_AUTOMATION_FILTER_DEBUG_STORAGE_KEY = 'debug_ai_automation_filter';

const isAiAutomationFilterDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const globalFlag = Boolean((window as any)?.__DEBUG_AI_AUTOMATION_FILTER__);
    return globalFlag;
  } catch {
    return false;
  }
};

const getTextMatchScore = (candidate: unknown, rawQuery: string): number | null => {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim().toLowerCase();
  const query = rawQuery.trim().toLowerCase();
  if (!text || !query) return null;
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (text.includes(query)) return 2;
  return null;
};

const isPureAiAutomation = (automation: SavedAutomation): boolean => {
  const debugEnabled = isAiAutomationFilterDebugEnabled();
  const debug = (message: string, extra?: Record<string, unknown>) => {
    if (!debugEnabled) return;
    
  };

  if (!automation || !Array.isArray(automation.steps) || automation.steps.length === 0) {
    debug('Rejected: missing or empty steps');
    return false;
  }

  const getNestedSteps = (step: any): any[] => {
    const fromSubSteps = Array.isArray(step?.subSteps) ? step.subSteps : [];
    const fromConfigSubAutomation =
      String(step?.moduleId || step?.type || '').toLowerCase() === 'sub_automation' &&
        Array.isArray(step?.config?.steps)
        ? step.config.steps
        : [];
    return [...fromSubSteps, ...fromConfigSubAutomation];
  };

  const isAllAiRootStep = (step: any): boolean => {
    const moduleId = String(step?.moduleId || step?.type || '').toLowerCase();
    if (ALL_AI_ROOT_MODULE_IDS.has(moduleId)) return true;
    if (moduleId === 'agent') {
      const agentId = String(step?.config?.agentId || step?.config?.id || '').toLowerCase();
      return ALL_AI_AGENT_IDS.has(agentId);
    }
    return false;
  };

  const walkStep = (step: any, inAllAiContext: boolean): { valid: boolean; hasAiStep: boolean } => {
    const moduleId = String(step?.moduleId || step?.type || '').toLowerCase();
    const nested = getNestedSteps(step);

    if (isAllAiRootStep(step)) {
      const nestedResult = nested.length > 0 ? walkSteps(nested, true) : { valid: true, hasAiStep: false };
      if (!nestedResult.valid) return { valid: false, hasAiStep: false };
      debug('Accepted: ALL AI root found', { moduleId, agentId: step?.config?.agentId });
      return { valid: true, hasAiStep: true };
    }

    if (!inAllAiContext && nested.length > 0) {
      const nestedResult = walkSteps(nested, false);
      if (nestedResult.valid && nestedResult.hasAiStep) {
        debug('Accepted: ALL AI root found in nested substeps', { moduleId });
        return { valid: true, hasAiStep: true };
      }
      if (!nestedResult.valid) {
        return { valid: false, hasAiStep: false };
      }
    }

    if (!inAllAiContext) {
      debug('Rejected: missing ALL AI root', { moduleId });
      return { valid: false, hasAiStep: false };
    }

    if (nested.length === 0) {
      return { valid: true, hasAiStep: false };
    }

    return walkSteps(nested, true);
  };

  const walkSteps = (steps: any[], inAiContext: boolean): { valid: boolean; hasAiStep: boolean } => {
    let hasAiStep = false;

    for (const step of steps) {
      const stepResult = walkStep(step, inAiContext);
      if (!stepResult.valid) return { valid: false, hasAiStep: false };
      if (stepResult.hasAiStep) hasAiStep = true;
    }

    return { valid: true, hasAiStep };
  };

  const result = walkSteps(automation.steps, false);
  if (debugEnabled) {
    debug(result.valid && result.hasAiStep ? 'Accepted: ALL AI root found' : 'Rejected: missing ALL AI root', {
      valid: result.valid,
      hasAiStep: result.hasAiStep,
    });
  }
  return result.valid && result.hasAiStep;
};

const buildSelectionInfoFromSuggestion = (item: CommandSuggestionItem): CommandSelectionInfo | null => {
  if (!item) return null;
  if (item.commandType === 'remote') {
    // Browser commands don't require inline queries - they execute immediately
    const isBrowserCommand = item.command?.category === 'browser' && !item.command.urlTemplate.includes('{query}');
    return {
      id: item.id,
      label: item.label,
      prefix: item.prefix,
      commandType: 'remote',
      requiresInlineQuery: !isBrowserCommand && !AI_GROUP.members.includes(item.id as any), // Browser commands don't need prompts, AI commands use main Searchbar
    };
  }
  if (item.commandType === 'aggregate') {
    return {
      id: item.id,
      label: item.label,
      prefix: item.prefix,
      commandType: 'aggregate',
      requiresInlineQuery: item.id !== 'ai', // AI Chat ('ai') uses a large middle input, not the inline pill box
    };
  }
  // Local commands generally don't use inline query mode
  return {
    id: item.id,
    label: item.label,
    prefix: item.prefix,
    commandType: 'local',
    requiresInlineQuery: item.id === 'calendar',
  };
};

const buildSelectionInfoFromId = (
  commandId: AnyCommandId,
  commands: CommandDefinition[],
): CommandSelectionInfo | null => {
  if (commandId === 'ai') {
    return {
      id: 'ai',
      label: AI_GROUP.label,
      prefix: AI_GROUP.prefix,
      commandType: 'aggregate',
      requiresInlineQuery: false, // AI Chat uses a large middle input, not the inline pill box
    };
  }
  if (commandId === 'store') {
    return {
      id: 'store',
      label: 'Automation Store',
      prefix: '/store',
      commandType: 'local',
      requiresInlineQuery: false,
    };
  }
  const remoteDef = commands.find(c => String(c.id) === String(commandId as CommandId)) ||
    COMMANDS.find(c => String(c.id) === String(commandId as CommandId));
  if (remoteDef) {
    // Browser commands don't require inline queries - they execute immediately
    const isBrowserCommand = remoteDef.category === 'browser' && !remoteDef.urlTemplate.includes('{query}');
    return {
      id: remoteDef.id,
      label: remoteDef.label,
      prefix: remoteDef.prefix,
      commandType: 'remote',
      requiresInlineQuery: !isBrowserCommand, // Browser commands don't need prompts
    };
  }
  if (isLocalCommandId(commandId)) {
    const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
    if (!localDef) return null;
    return {
      id: localDef.id as LocalCommandId,
      label: localDef.label,
      prefix: localDef.prefix,
      commandType: 'local',
      requiresInlineQuery:
        (localDef.id === 'calendar' || localDef.behavior === 'locked') &&
        localDef.id !== 'bookmarks',
    };
  }
  return null;
};

const commandSupportsInlineQuery = (info: CommandSelectionInfo | null): info is CommandSelectionInfo => {
  return Boolean(info && info.requiresInlineQuery);
};

// Helper function to open a note in a new tab
const openNoteInNewTab = (snippetId: string) => {
  if (!snippetId) {
    console.warn('[openNoteInNewTab] No snippetId provided');
    return;
  }
  const chromeAny = (window as any)?.chrome;

  // Get extension URL via runtime.getURL if available
  let extensionUrl = '';
  if (chromeAny?.runtime?.getURL) {
    extensionUrl = chromeAny.runtime.getURL(
      `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
    );
  } else if (chromeAny?.runtime?.id) {
    // Fallback: construct URL with extension ID
    const extensionId = chromeAny.runtime.id;
    extensionUrl = `chrome-extension://${extensionId}/new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`;
  }

  if (!extensionUrl) {
    console.warn('[openNoteInNewTab] Could not construct extension URL');
    return;
  }

  // Try sending message to background script first (preferred method - not blocked by Chrome/ad blockers)
  if (chromeAny?.runtime?.sendMessage) {
    chromeAny.runtime.sendMessage({ action: 'open_tab', url: extensionUrl }, (response: any) => {
      if (chromeAny.runtime.lastError) {
        console.warn('[openNoteInNewTab] sendMessage failed:', chromeAny.runtime.lastError);
        // Fallback: try chrome.tabs.create first to avoid ERR_BLOCKED_BY_CLIENT
        if (chromeAny?.tabs?.create) {
          chromeAny.tabs.create({ url: extensionUrl });
        } else {
          // Last resort fallback
          window.open(extensionUrl, '_blank');
        }
      } else if (response && !response.ok) {
        // Background script returned an error
        console.error('[openNoteInNewTab] Background script error:', response.error, response.debugMessages);
        // Try direct tab creation as fallback
        if (chromeAny?.tabs?.create) {
          chromeAny.tabs.create({ url: extensionUrl });
        } else {
          window.open(extensionUrl, '_blank');
        }
      }
    });
    return;
  }

  // If sendMessage not available, try direct tab creation
  if (chromeAny?.tabs?.create && chromeAny?.runtime?.getURL) {
    const url = chromeAny.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`);
    chromeAny.tabs.create({ url });
    return;
  }

  // Last resort: window.open
  console.warn('[openNoteInNewTab] chrome.runtime.sendMessage and tabs.create not available, using window.open');
  window.open(extensionUrl, '_blank');
};

const openSingleLink = (link: LinkToOpen, forceNewTab = false, sourceTabId: number | null = null) => {
  const { url, autoSubmit } = toLinkConfig(link);
  if (!url) return;

  // Check if URL is a note: prefix
  if (url.startsWith('note:')) {
    const noteId = url.substring(5); // Remove 'note:' prefix
    const noteUrl = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`);
    if (forceNewTab) {
      chrome.tabs.create({ url: noteUrl, active: false });
    } else {
      window.location.href = noteUrl;
    }
    return;
  }

  const chromeAny = (window as any)?.chrome;

  // For autoSubmit links, use background script to properly handle prompt injection
  if (autoSubmit) {
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage(
        {
          action: 'open_tab_with_auto_submit',
          url,
          autoSubmit: {
            kind: autoSubmit.kind,
            prompt: autoSubmit.prompt,
            images: autoSubmit.images,
          },
          forceNewTab,
          sourceTabId, // Pass the explicit source tab ID
        },
        (response: any) => {
          if (chromeAny.runtime.lastError) {
            console.warn('[openSingleLink] sendMessage failed:', chromeAny.runtime.lastError);
            // Fallback: try direct tab creation
            if (chromeAny?.tabs?.create) {
              chromeAny.tabs.create({ url, active: true });
            } else {
              window.open(url, '_blank');
            }
          } else if (response && !response.ok) {
            console.error('[openSingleLink] Background script error:', response.error);
            // Fallback: try direct tab creation
            if (chromeAny?.tabs?.create) {
              chromeAny.tabs.create({ url, active: true });
            } else {
              window.open(url, '_blank');
            }
          }
        },
      );
      return;
    }
  }

  // Fallback if autoSubmit but sendMessage not available
  if (autoSubmit) {
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank');
    }
    return;
  }

  if (forceNewTab) {
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank');
    }
    return;
  }

  // Check if URL is a browser internal URL (chrome://, edge://, brave://)
  // These require background script to open, as window.location.href won't work
  const isBrowserInternalUrl =
    url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('brave://') || url.startsWith('about:');

  if (isBrowserInternalUrl) {
    // Browser internal URLs must be opened via background script
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'open_tab', url }, (response: any) => {
        if (chromeAny.runtime.lastError) {
          console.warn('[openSingleLink] sendMessage failed for browser URL:', chromeAny.runtime.lastError);
          // Fallback: try direct tab creation
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url });
          }
        } else if (response && !response.ok) {
          console.error('[openSingleLink] Background script error:', response.error, response.debugMessages);
          // Fallback: try direct tab creation
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url });
          }
        }
      });
      return;
    }
    // Fallback: try tabs API directly
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url });
      return;
    }
    console.warn('[openSingleLink] Cannot open browser internal URL - no APIs available');
    return;
  }

  if (url.startsWith('agent_chat?id=')) {
    const agentId = url.split('id=')[1];
    const extensionUrl = chrome.runtime.getURL(
      `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
    );
    if (forceNewTab) {
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url: extensionUrl, active: true });
      } else {
        window.open(extensionUrl, '_blank');
      }
    } else {
      window.location.href = extensionUrl;
    }
    return;
  }

  // Regular URLs - use current tab as requested
  window.location.href = url;
};

// Helper to normalize URL for comparison (removes trailing slashes, converts to lowercase hostname)
const normalizeUrlForComparison = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Remove www. prefix from hostname for consistency
    let hostname = parsed.hostname.replace(/^www\./, '');
    let normalized = parsed.protocol + '//' + hostname + parsed.pathname;
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    // Fallback: strip www. and trailing slashes
    return url
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '$1')
      .replace(/\/$/, '');
  }
};

// Filter out URLs that are already open in browser tabs
const filterAlreadyOpenUrls = async (urls: string[]): Promise<string[]> => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.tabs?.query) {
    // Can't check tabs, return all URLs
    return urls;
  }

  return new Promise(resolve => {
    chromeAny.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
      if (chromeAny.runtime.lastError) {
        console.warn('[filterAlreadyOpenUrls] Failed to query tabs:', chromeAny.runtime.lastError);
        resolve(urls);
        return;
      }

      // Get all open tab URLs (normalized)
      const openTabUrls = new Set(
        tabs
          .map(tab => tab.url)
          .filter((url): url is string => !!url)
          .map(normalizeUrlForComparison),
      );

      // Filter out URLs that are already open
      const filteredUrls = urls.filter(url => {
        const normalized = normalizeUrlForComparison(url);
        const isAlreadyOpen = openTabUrls.has(normalized);
        return !isAlreadyOpen;
      });
      resolve(filteredUrls);
    });
  });
};

const openMultipleLinks = async (links: LinkToOpen[], sourceTabId: number | null = null) => {
  if (!links || links.length === 0) return;

  // Extract URLs from links for duplicate checking
  const urlsToCheck = links
    .map(link => {
      const config = toLinkConfig(link);
      return config.url || '';
    })
    .filter(url => url && !url.startsWith('note:') && !url.startsWith('agent_chat?id=')); // Don't filter note: or agent: URLs

  // Get non-duplicate URLs
  const nonDuplicateUrls = await filterAlreadyOpenUrls(urlsToCheck);
  const nonDuplicateUrlSet = new Set(nonDuplicateUrls.map(normalizeUrlForComparison));

  // Filter links to only include non-duplicate ones (and always include note: URLs)
  const filteredLinks = links.filter(link => {
    const config = toLinkConfig(link);
    const url = config.url || '';
    // Always include notes OR agents OR links with auto-submit
    if (url.startsWith('note:') || url.startsWith('agent_chat?id=') || config.autoSubmit) return true;
    return nonDuplicateUrlSet.has(normalizeUrlForComparison(url));
  });

  if (filteredLinks.length === 0) {
    
    return;
  }

  const configs = filteredLinks.map(toLinkConfig);

  // Helper to open a background tab with Promise for sync
  const openBackgroundTabAsync = (config: LinkToOpen): Promise<void> => {
    return new Promise(resolve => {
      const { url, autoSubmit } = toLinkConfig(config);
      if (!url) {
        resolve();
        return;
      }

      // Handle note: URLs
      if (url.startsWith('note:')) {
        const noteId = url.substring(5);
        const noteUrl = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`);
        chrome.tabs.create({ url: noteUrl, active: false }, () => resolve());
        return;
      }

      // Handle agent_chat: URLs
      if (url.startsWith('agent_chat?id=')) {
        const agentId = url.split('id=')[1];
        const extensionUrl = chrome.runtime.getURL(
          `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
        );
        chrome.tabs.create({ url: extensionUrl, active: false }, () => resolve());
        return;
      }

      const chromeAny = (window as any)?.chrome;

      // Handle autoSubmit via background script
      if (autoSubmit && chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage(
          {
            action: 'open_tab_with_auto_submit',
            url,
            autoSubmit: {
              kind: autoSubmit.kind,
              prompt: autoSubmit.prompt,
              images: autoSubmit.images,
            },
            forceNewTab: true, // This triggers active: false in background script
          },
          () => resolve(),
        );
        return;
      }

      // Handle regular URLs (fallback)
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url, active: false }, () => resolve());
      } else {
        window.open(url, '_blank');
        resolve();
      }
    });
  };

  // Open all background tabs FIRST, wait for them to complete, THEN navigate foreground
  const backgroundConfigs = configs.slice(1);

  if (backgroundConfigs.length === 0) {
    // No background tabs, just open the single link
    openSingleLink(configs[0], false, sourceTabId);
    return;
  }

  // Open all background tabs and wait for them
  Promise.all(backgroundConfigs.map(openBackgroundTabAsync)).then(() => {
    // All background tabs created, now navigate the foreground tab
    openSingleLink(configs[0], false, sourceTabId);
  });
};

const buildCommandLink = (
  command: CommandDefinition,
  prompt: string,
  images?: { base64: string; mimeType: string; filename: string }[] | null,
): LinkToOpen => {
  const normalizedPrompt = (prompt || '').trim();
  const hasImage = Boolean(images && images.length > 0);
  const hasPrompt = Boolean(normalizedPrompt);

  const urlTemplate = command.urlTemplate;

  

  // Scenario B: If images are present for an AI command, use a "clean" URL to prevent auto-submission.
  // This gives the extension time to inject images first, then the prompt manually.
  let url: string;
  if (command.autoSubmit && (hasImage || hasPrompt)) {
    
    if (command.id === 'perplexity') {
      url = 'https://www.perplexity.ai/';
    } else if (command.id === 'gpt') {
      url = 'https://chatgpt.com/';
    } else if (command.id === 'claude') {
      url = 'https://claude.ai/new';
    } else if (command.id === 'gemini') {
      url = 'https://gemini.google.com/app';
    } else {
      // Fallback: Use the template but with an empty prompt to avoid triggering site results
      url = buildUrl(urlTemplate, '');
    }
  } else {
    
    url = buildUrl(urlTemplate, prompt);
  }

  

  if (command.autoSubmit) {
    // Logic updated: Allow image-only submission OR prompt+image submission
    if (!hasPrompt && !hasImage) return url;

    return {
      url,
      autoSubmit: {
        id: command.id,
        kind: command.autoSubmit,
        prompt: normalizedPrompt,
        images: hasImage ? images! : undefined,
      },
    };
  }
  return url;
};

const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

const mapFullNameToShortcut = (text: string): string => {
  const mapping: Record<string, string> = {
    '/all': '/a',
    '/todos': '/t',
    '/notes': '/n',
    '/snippets': '/s',
    '/prompts': '/p',
    '/links': '/l',
    '/commands': '/c',
    '/bookmarks': '/b',
  };
  const lower = text.toLowerCase();
  for (const [fullName, shortcut] of Object.entries(mapping)) {
    if (lower.startsWith(fullName)) {
      return shortcut + text.slice(fullName.length);
    }
  }
  return text;
};

const getHighlightedHtml = (val: string): string => {
  const match = val.match(/^\/[a-zA-Z]*/);
  if (match && match[0]) {
    const prefix = match[0];
    const rest = val.slice(prefix.length);

    const lowerPrefix = prefix.toLowerCase();
    const isFilterShortcut = ['/a', '/n', '/s', '/p', '/l', '/c', '/b', '/t'].includes(lowerPrefix);

    const escapedRest = rest
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/ /g, '\u00A0');
    const escapedPrefix = prefix
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const hasSpaceAfter = rest.startsWith(' ') || rest.startsWith('\u00A0');

    if (isFilterShortcut && hasSpaceAfter) {
      const labels: Record<string, string> = {
        '/a': '/All',
        '/n': '/Notes',
        '/s': '/Snippets',
        '/p': '/Prompts',
        '/l': '/Links',
        '/c': '/Commands',
        '/b': '/Bookmarks',
        '/t': '/Todos',
      };
      const label = labels[lowerPrefix] || prefix;
      return `<span style="display: inline-flex; align-items: center; justify-content: center; background: rgba(156, 163, 175, 0.15); border: 1.5px solid #9ca3af; color: #9ca3af; border-radius: 6px; padding: 1px 6px; font-weight: 700; margin-right: 4px; font-family: monospace; font-size: 13px;" contenteditable="false">${label}</span>${escapedRest}`;
    }

    return `${escapedPrefix}${escapedRest}`;
  }
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '\u00A0');
};

export const Searchbar = forwardRef<SearchbarHandle, SearchbarProps>(
  (
    {
      onSuggestionStateChange,
      onCommandExecute,
      onSnippetSelect,
      onAutomationSelect,
      onAutomationEdit,
      onRequestAutomationEdit,
      onQueryChange,
      focus = false,
      onRequestFocusChange,
      onCommandModeExit,
      onClearFolder,
      onNavigateBack,
      isCommandListView,
      onClearCommandListView,
      onToggleCommandListView,
      isAllItemsView,
      allItemsType,
      onClearAllItemsView,
      onRequestEditLink,
      onRequestEditPrompt,
      onRequestSnippetDelete,
      onToggleFavorite,
      onRequestOpenUrls,
      placeholder = STATIC_PLACEHOLDER,
      onGoToTemplates,
      onSearchbarFocus,
      searchValue: propSearchValue,
      isLoggedIn,
      onLockedCommandChange,
      lockedCommand: propLockedCommand,
      onSaveAgent,
      activeStoreTab,
      onToggleStoreTab,
      isAIHistoryOpen,
      onToggleAIHistory,
      savedAiAgents = [],
      hideDynamicIcon = false,
      disableContextualPopup = false,
      isBoardViewEnabled = true,
      onToggleBoardView,
      isInitialAltSFocus = false,
      onInitialAltSFocusChange,
      displayHomeView = false,
      onHoverSlashDot,
    },
    ref,
  ) => {
    const dispatch = useDispatch<AppDispatch>();
    const activeTutorial = useSelector(selectActiveTutorial);

    // --- Refs for Suggestion State ---
    const suggestionVisibilityRef = useRef(false);
    const selectionSourceRef = useRef<'suggestions' | 'external' | null>(null);
    const pendingUserFocusRef = useRef(false);

    // --- Tutorial Steps State ---
    const showSearchTutorial = activeTutorial === 'search';
    const [tutorialStep, setTutorialStep] = useState(0);
    const showAgentTutorial = activeTutorial === 'agent';

    // Tutorial event listeners handled centrally in App.tsx

    const handleCloseAgentTutorial = async () => {
      await setTutorialStepFinished('agent');
      dispatch(setActiveTutorial('touchpoints'));
    };

    const handleCloseSearchTutorial = async () => {
      await setTutorialStepFinished('search');
      setTutorialStep(0);
      dispatch(setActiveTutorial('favorites'));
    };

    const handleSkipTutorial = useCallback(() => {
      dispatch(setActiveTutorial(null));
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local && !(window as any).isReplayingTutorial) {
        chromeAny.storage.local.set({
          tutorial_watched: true,
          app_tutorial_progress: {
            search: true,
            favorites: true,
            agent: true,
            sidebar: true,
            touchpoints: true,
          },
        });
      }
      window.dispatchEvent(new CustomEvent('TutorialFinished'));
    }, [dispatch]);

    const handleNextTutorialStep = useCallback(() => {
      handleCloseSearchTutorial();
    }, []);

    const handlePrevTutorialStep = () => {
      setTutorialStep((prev: number) => Math.max(prev - 1, 0));
    };

    const handlePrevAgentTutorial = () => {
      window.dispatchEvent(new CustomEvent('AgentsToFavs'));
    };

    const { commands: rawCommands, refreshCommands } = useCommands();
    const commands = useMemo(() => {
      if (!isLoggedIn) {
        return rawCommands.filter(c => c.category === 'browser');
      }
      return rawCommands;
    }, [rawCommands, isLoggedIn]);
    // Command index for '/' prefix mode only
    const commandIndex = useMemo(() => createCommandIndex(commands), [commands]);

    const [lockedCommand, setLockedCommand] = useState<AnyCommandId | null>(propLockedCommand || null);
    const [activeSlashFilter, setActiveSlashFilter] = useState<'a' | 'n' | 's' | 'p' | 'l' | 'c' | 'b' | 't' | null>(null);
    const [selectedCommand, setSelectedCommand] = useState<CommandSelectionInfo | null>(null);

    const activeCommandInfo = useMemo(
      () => (lockedCommand ? buildSelectionInfoFromId(lockedCommand, commands) : null),
      [lockedCommand, commands],
    );

    const inlineComposerInfo = lockedCommand ? activeCommandInfo : selectedCommand;
    const inlineComposerVisible = commandSupportsInlineQuery(inlineComposerInfo);
    const inlineComposerActive = Boolean(lockedCommand && inlineComposerVisible);
    const inlineComposerPreview = Boolean(!lockedCommand && inlineComposerVisible);

    const [value, setValueRaw] = useState('');
    const lastLocalValueRef = useRef('');

    const [selectedAIs, setSelectedAIs] = useState<string[]>([]);
    const [isAiEditMode, setIsAiEditMode] = useState<boolean>(false);
    const [isModelPopupOpen, setIsModelPopupOpen] = useState(false);
    const [modelWarning, setModelWarning] = useState<string | null>(null);
    const triggerToast = useToast();

    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (modelWarning) {
        timer = setTimeout(() => setModelWarning(null), 3000);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [modelWarning]);

    const handleToggleAI = useCallback(
      (aiId: string) => {
        if (selectedAIs.length === 1 && selectedAIs.includes(aiId)) {
          setModelWarning('At least one model must be active.');
          setIsModelPopupOpen(true);
        } else {
          setModelWarning(null);
          setSelectedAIs(prev => {
            const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
            // Save to chrome storage
            if (typeof chrome !== 'undefined' && chrome.storage) {
              chrome.storage.local.set({ selectedAIs: newSelection });
            }
            return newSelection;
          });
        }
      },
      [selectedAIs],
    );
    const [isDragging, setIsDragging] = useState(false);

    // --------------------------------------------------------------------------
    // State Reset on Query Change (Alt+S behavior)
    // --------------------------------------------------------------------------
    useEffect(() => {
      if (isInitialAltSFocus && onInitialAltSFocusChange && value.length > 0) {
        onInitialAltSFocusChange(false);
      }
    }, [value, isInitialAltSFocus, onInitialAltSFocusChange]);

    // Agent Collection State and Effect
    const [agentCollectionSuggestions, setAgentCollectionSuggestions] = useState<AgentCollectionSuggestionItem[]>([]);
    const [automationSuggestions, setAutomationSuggestions] = useState<SavedAutomation[]>([]);
    const [moduleSuggestions, setModuleSuggestions] = useState<InstalledModule[]>([]);

    useEffect(() => {
      const INDEX_KEY = 'alts_agent_collections_index';
      const chromeAny = (window as any).chrome;

      const loadCollections = () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
          chromeAny.storage.local.get([INDEX_KEY], (result: any) => {
            const titles = result[INDEX_KEY];
            if (titles && Array.isArray(titles)) {
              // Map titles to suggestion items
              const items = titles.map((title: string) => ({
                _kind: 'agent_collection' as const,
                title: title,
                itemCount: 0, // Placeholder
              }));
              setAgentCollectionSuggestions(items);
            }
          });
        }
      };

      const handleChange = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: 'sync' | 'local' | 'managed' | 'session',
      ) => {
        if (areaName === 'local' && changes[INDEX_KEY]) {
          loadCollections();
        }
      };

      try {
        // Initial Load
        loadCollections();

        // Listen for changes
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.addListener(handleChange);
        }
      } catch (e) {
        console.error('[Searchbar] Failed to load agent collections', e);
      }

      return () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.removeListener(handleChange);
        }
      };
    }, []); // Run on mount

    useEffect(() => {
      const STORAGE_KEY = 'automations';
      const chromeAny = (window as any).chrome;

      const loadAutomations = () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
          chromeAny.storage.local.get([STORAGE_KEY], (result: any) => {
            const automationsMap = result[STORAGE_KEY] || {};
            const automations = Object.values(automationsMap) as SavedAutomation[];
            setAutomationSuggestions(automations);
          });
        }
      };

      const handleChange = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: 'sync' | 'local' | 'managed' | 'session',
      ) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          loadAutomations();
        }
      };

      try {
        loadAutomations();
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.addListener(handleChange);
        }
      } catch (e) {
        console.error('[Searchbar] Failed to load automations', e);
      }

      return () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.removeListener(handleChange);
        }
      };
    }, []);

    useEffect(() => {
      const STORAGE_KEY = 'installed_modules';
      const chromeAny = (window as any).chrome;

      const loadModules = () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
          chromeAny.storage.local.get([STORAGE_KEY], (result: any) => {
            const modules = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
            setModuleSuggestions(modules);
          });
        }
      };

      const handleChange = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: 'sync' | 'local' | 'managed' | 'session',
      ) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          loadModules();
        }
      };

      try {
        loadModules();
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.addListener(handleChange);
        }
      } catch (e) {
        console.error('[Searchbar] Failed to load installed modules', e);
      }

      return () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.removeListener(handleChange);
        }
      };
    }, []);

    useEffect(() => {
      if (inlineComposerActive) {
        if (inputRef.current && (inputRef.current.innerText || inputRef.current.innerHTML)) {
          inputRef.current.innerText = '';
          inputRef.current.innerHTML = '';
        }
        return;
      }
      if (propSearchValue !== undefined && propSearchValue !== lastLocalValueRef.current) {
        let displayValue = propSearchValue;
        const normalized = propSearchValue.replace(/\u00A0/g, ' ');
        const match = normalized.match(/^\/([aAnsSplLcCbBtT])\s/);
        if (match) {
          const filterChar = match[1].toLowerCase() as 'a' | 'n' | 's' | 'p' | 'l' | 'c' | 'b' | 't';
          activeSlashFilterRef.current = filterChar;
          setActiveSlashFilter(filterChar);
          displayValue = normalized.slice(3); // strip e.g. "/c "
        } else {
          activeSlashFilterRef.current = null;
          setActiveSlashFilter(null);
        }

        setValueRaw(displayValue);
        lastLocalValueRef.current = propSearchValue;
        if (inputRef.current) {
          try {
            if (inputRef.current.innerText !== displayValue) {
              const expectedHtml = getHighlightedHtml(displayValue);
              inputRef.current.innerHTML = expectedHtml;
              inputRef.current.focus();

              // Safely move the typing cursor/caret to the end of the text
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(inputRef.current as Node);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          } catch (e) {
            console.error('[Searchbar] Error syncing propSearchValue to contentEditable:', e);
          }
        }
      }
    }, [propSearchValue, inlineComposerActive]);

    const setValue = useCallback(
      (newValue: string) => {
        const mappedValue = mapFullNameToShortcut(newValue);
        const normalized = mappedValue.replace(/\u00A0/g, ' ');
        setValueRaw(normalized);
        if (typeof window !== 'undefined') {
          (window as any).__LAST_TYPED_SEARCH_QUERY__ = normalized;
        }
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.set({ last_search_query: normalized });
        }

        let fullValue = normalized;
        if (activeSlashFilterRef.current) {
          fullValue = `/${activeSlashFilterRef.current.toUpperCase()} ${normalized}`;
        }
        lastLocalValueRef.current = fullValue; // Track this locally to ignore it from props later

        if (inlineComposerActive) {
          if (inputRef.current && (inputRef.current.innerText || inputRef.current.innerHTML)) {
            inputRef.current.innerText = '';
            inputRef.current.innerHTML = '';
          }
        } else if (inputRef.current) {
          const expectedHtml = getHighlightedHtml(normalized);
          const currentHtml = inputRef.current.innerHTML;
          const needsUpdate = normalized.startsWith('/') ? (currentHtml !== expectedHtml) : (inputRef.current.innerText.replace(/\u00A0/g, ' ') !== normalized);
          if (needsUpdate) {
            try {
              inputRef.current.innerHTML = expectedHtml;
              inputRef.current.focus();

              // Move cursor to the end
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(inputRef.current as Node);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            } catch (e) {
              console.error('[Searchbar] Error syncing in setValue:', e);
            }
          }
        }

        onQueryChange?.(fullValue);
      },
      [onQueryChange, inlineComposerActive, activeSlashFilter],
    );

    // Auto-resize on value change (programmatic or typed)
    useEffect(() => {
      const textarea = inputRef.current;
      if (textarea) {
        // Use requestAnimationFrame to avoid forced synchronous layout mid-render
        requestAnimationFrame(() => {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        });
      }
    }, [value]);
    const [commandPrompt, setCommandPrompt] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    // Start as false — Board View should only open after explicit user interaction (typing/click)
    // NOT auto-render just because isBoardViewEnabled is true
    const [keepBoardViewOpen, setKeepBoardViewOpen] = useState(false);

    useEffect(() => {
      if (value.trim().length > 0 && isBoardViewEnabled) {
        // User typed something while in Board View mode — keep it open
        setKeepBoardViewOpen(true);
      } else if (value.trim().length === 0) {
        // Search cleared — reset so Board View doesn't persist without interaction
        setKeepBoardViewOpen(false);
      }
    }, [value, isBoardViewEnabled]);

    const serializeRichPrompt = (element: HTMLElement | null): string => {
      if (!element) return '';
      // Clone the element to avoid modifying the actual UI
      const clone = element.cloneNode(true) as HTMLElement;
      // Find all tab pills
      const pills = clone.querySelectorAll('span[data-tab-id]');
      pills.forEach(pill => {
        const tabId = pill.getAttribute('data-tab-id');
        if (tabId) {
          // Replace the visual pill with our internal textual placeholder
          const placeholder = document.createTextNode(` @[tab:${tabId}] `);
          pill.parentNode?.replaceChild(placeholder, pill);
        }
      });
      // innerText preserves newlines and handles layout better than textContent
      return (clone.innerText || '').trim();
    };

    const [isAutomationInputActive, setIsAutomationInputActive] = useState(
      typeof window !== 'undefined' && Boolean((window as any).__tasklabsAutomationInputActive),
    );
    const [highlightIndex, setHighlightIndex] = useState<number>(0);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const lastActionRef = useRef<'backspace' | 'typing' | null>(null);
    const inlineInputRef = useRef<HTMLInputElement | null>(null);
    const prefixRef = useRef<HTMLDivElement | null>(null);
    const modelPopupRef = useRef<HTMLDivElement | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isInlineFocused, setIsInlineFocused] = useState(false);
    const [windowDimensions, setWindowDimensions] = useState({
      width: typeof window !== 'undefined' ? window.innerWidth : 1200,
      height: typeof window !== 'undefined' ? window.innerHeight : 800,
    });

    useEffect(() => {
      const handleResize = () => {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      const handleAutomationInputActiveChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ active?: boolean }>;
        setIsAutomationInputActive(Boolean(customEvent.detail?.active));
      };

      window.addEventListener(
        'tasklabs-automation-input-active-change',
        handleAutomationInputActiveChange as EventListener,
      );
      setIsAutomationInputActive(Boolean((window as any).__tasklabsAutomationInputActive));

      return () => {
        window.removeEventListener(
          'tasklabs-automation-input-active-change',
          handleAutomationInputActiveChange as EventListener,
        );
      };
    }, []);

    // Calculate dynamic values for alignment (Matching SearchSuggestions.tsx)
    const { dynamicLeftOffset, dynamicGap, dynamicFallbackPadding } = useMemo(() => {
      const { width } = windowDimensions;
      // 12px (default), 14px (1600+), 16px (1800+)
      // Standard icon width w-4 (16px), gap-2 (8px).
      // All content (pill text and search text) starts at: offset + 24px.
      if (width >= 1800) return { dynamicLeftOffset: 16, dynamicGap: 8, dynamicFallbackPadding: 40 };
      if (width >= 1600) return { dynamicLeftOffset: 14, dynamicGap: 8, dynamicFallbackPadding: 38 };
      return { dynamicLeftOffset: 12, dynamicGap: 8, dynamicFallbackPadding: 36 };
    }, [windowDimensions.width]);

    const [prefixWidth, setPrefixWidth] = useState(0);
    const [showAIHistoryPanel, setShowAIHistoryPanel] = useState(false);
    const [activeCollection, setActiveCollection] = useState<{
      item: any;
      agents: any[];
      links?: any[];
      automations?: any[];
      fields: SearchbarAutomationField[];
      constantInputs?: Record<string, string>;
      constantFields?: SearchbarAutomationField[];
      focusedFieldIndex: number;
    } | null>(null);

    useEffect(() => {
      const isActive = !!activeCollection;
      if (typeof window !== 'undefined') {
        (window as any).__tasklabsAutomationInputActive = isActive;
        window.dispatchEvent(
          new CustomEvent('tasklabs-automation-input-active-change', {
            detail: { active: isActive },
          }),
        );
      }
    }, [activeCollection]);

    const [inlineCursorPosition, setInlineCursorPosition] = useState(0);
    const [isSuggestionsHidden, setIsSuggestionsHidden] = useState(false);

    // Active Ephemeral "All AI" Session
    const [activeAiSession, setActiveAiSession] = useState<{
      id: string | number;
      sessionKey: string;
      prompt: string;
      name?: string;
      models: string[];
      tabIds: number[];
      urls: string[];
      workspace_id?: string | null;
      folder_id?: string | null;
      customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
    } | null>(null);

    const isInitialMountRef = useRef(true);
    const isProgrammaticFocusRef = useRef<boolean>(false);

    // Intercept native focus() calls to reliably identify programmatic vs user-initiated focus
    useEffect(() => {
      const el = inputRef.current as any;
      if (!el) return;
      const originalFocus = el.focus;
      el.focus = (options?: FocusOptions) => {
        isProgrammaticFocusRef.current = true;
        originalFocus.call(el, options);
        setTimeout(() => {
          isProgrammaticFocusRef.current = false;
        }, 50);
      };
      return () => {
        el.focus = originalFocus;
      };
    }, []);

    useEffect(() => {
      isInitialMountRef.current = false;
    }, []);

    const updateActiveSessionMetadata = useCallback(
      (metadata: {
        name?: string;
        id?: string | number;
        customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
      }) => {
        setActiveAiSession(prev => {
          if (!prev) return null;
          return {
            ...prev,
            name: metadata.name ?? prev.name,
            id: metadata.id ?? prev.id,
            customModelDefinitions: metadata.customModelDefinitions ?? prev.customModelDefinitions,
          };
        });
      },
      [],
    );

    const onUpdateCustomModels = useCallback((models: { id: string; name: string; url: string; host: string }[]) => {
      setActiveAiSession(prev => {
        if (!prev) {
          return {
            id: 'new-chat',
            sessionKey: `new-chat-${Date.now()}`,
            prompt: '',
            models: [],
            tabIds: [],
            urls: [],
            customModelDefinitions: models,
          };
        }
        return {
          ...prev,
          customModelDefinitions: models,
        };
      });
    }, []);

    const onUpdateModelUrl = useCallback((modelId: string, url: string) => {
      setActiveAiSession(prev => {
        if (!prev) return null;
        const modelIdx = prev.models.indexOf(modelId);
        if (modelIdx === -1) return prev;

        const nextUrls = [...prev.urls];
        nextUrls[modelIdx] = url;

        // If this is a saved agent (automation), we should update the automation steps too
        // We identify it by checking if ID is not a 'session-' placeholder
        const isSavedAgent = prev.id && !String(prev.id).startsWith('session-');
        if (isSavedAgent) {
          const automationId = String(prev.id);
          chrome.storage.local.get(['automations'], result => {
            const automations = result.automations || {};
            const auto = automations[automationId];
            if (auto && (auto.steps || auto.automation_steps)) {
              const raws = auto.steps || auto.automation_steps || [];
              let updated = false;
              raws.forEach((step: any) => {
                const config = step.config || {};
                const stepAgentId = config.agentId || config.id || '';
                // Normalize 'all_ai' or check for modelId match
                if (stepAgentId === modelId || (stepAgentId === 'all_ai' && modelId === 'ai')) {
                  config.agentUrl = url;
                  updated = true;
                }
              });
              if (updated) {
                chrome.storage.local.set({
                  automations: {
                    ...automations,
                    [automationId]: { ...auto, steps: raws },
                  },
                });
              }
            }
          });
        }

        return { ...prev, urls: nextUrls };
      });
    }, []);

    const [selectedAutomation, setSelectedAutomation] = useState<SavedAutomation | null>(null);

    // Synchronize active AI session URLs from the background script
    useEffect(() => {
      const listener = (message: any) => {
        if (message.action === 'ai_session_url_updated' && message.url) {
          setActiveAiSession(prev => {
            if (!prev) return null;
            const modelIdx = prev.models.indexOf(message.model);
            if (modelIdx === -1) return prev;

            const nextUrls = [...prev.urls];
            nextUrls[modelIdx] = message.url;
            const nextSession = { ...prev, urls: nextUrls };
            // Update ref for immediate capture in long-running functions
            activeAiSessionRef.current = nextSession;
            return nextSession;
          });
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);
    // Ref so runAggregateCommand can always read the latest value (avoids stale closure)
    const activeAiSessionRef = useRef<typeof activeAiSession>(null);
    useEffect(() => {
      activeAiSessionRef.current = activeAiSession;
    }, [activeAiSession]);

    const selectedAutomationRef = useRef<SavedAutomation | null>(null);
    useEffect(() => {
      selectedAutomationRef.current = selectedAutomation;
    }, [selectedAutomation]);

    // Persist active AI session to storage
    useEffect(() => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ activeAiSession });
      }
    }, [activeAiSession]);

    const valueRef = useRef<string>('');
    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    const activeSlashFilterRef = useRef<'a' | 'n' | 's' | 'p' | 'l' | 'c' | 'b' | 't' | null>(null);
    useEffect(() => {
      activeSlashFilterRef.current = activeSlashFilter;
    }, [activeSlashFilter]);

    const selectedAIsRef = useRef<string[]>([]);
    useEffect(() => {
      selectedAIsRef.current = selectedAIs;
    }, [selectedAIs]);

    // AI Prompt Queue for sequential processing
    const promptQueueRef = useRef<
      {
        prompt: string;
        images?: { file?: File; base64?: string; mimeType: string; filename: string }[] | null;
        historyUrls?: string[];
      }[]
    >([]);
    const isProcessingQueueRef = useRef(false);

    // Contextual Action Popup State (Commands/Automations for highlighted result)
    const [contextualMatches, setContextualMatches] = useState<ContextualMatch[]>([]);
    const [contextualPopupIndex, setContextualPopupIndex] = useState<number>(-1);
    const [isContextualPopupOpen, setIsContextualPopupOpen] = useState(false);
    const cursorOverlayRef = useRef<HTMLDivElement | null>(null);

    const syncScroll = useCallback(() => {
      if (inputRef.current && cursorOverlayRef.current) {
        cursorOverlayRef.current.scrollTop = inputRef.current.scrollTop;
      }
    }, []);

    const updateCursorPosition = useCallback(() => {
      if (inputRef.current) {
        syncScroll();
      }
    }, [syncScroll]);

    const updateInlineCursorPosition = useCallback(() => {
      if (inlineInputRef.current) {
        setInlineCursorPosition(inlineInputRef.current.selectionStart || 0);
      }
    }, []);

    // Sync locked command state to parent
    const lastSyncedLockedCommandRef = useRef<AnyCommandId | null | undefined>(undefined);
    useEffect(() => {
      if (propLockedCommand !== undefined && propLockedCommand !== lockedCommand) {
        setLockedCommand(propLockedCommand);
        lastSyncedLockedCommandRef.current = propLockedCommand;
      }
    }, [propLockedCommand]);

    useEffect(() => {
      if (onLockedCommandChange && lockedCommand !== lastSyncedLockedCommandRef.current) {
        onLockedCommandChange(lockedCommand);
        lastSyncedLockedCommandRef.current = lockedCommand;
      }
    }, [lockedCommand, onLockedCommandChange]);

    // Redux Selectors
    const selectedSnippet = useSelector((state: RootState) => state.uiState.selectedSnippet);
    const isCreatingNewItem = useSelector((state: RootState) => state.uiState.isCreatingNewItem);
    const mainView = useSelector((state: RootState) => state.uiState.mainView);
    const isLinkEditModalOpen = useSelector((state: RootState) => state.uiState.isLinkEditModalOpen);
    const isDarkMode = useSelector(selectDarkMode);

    const [isGlobalDragging, setIsGlobalDragging] = useState(false);
    const dragCounter = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const [showPromo, setShowPromo] = useState(false);

    // Randomly show glow animation with 30% probability (3/10 times)
    const [showGlow] = useState(() => Math.random() < 0.3);

    // Sync locked command state to parent

    // AI selection state
    const [currentTabId, setCurrentTabId] = useState<number | null>(null);

    const applyDropdownEditsToSteps = useCallback(
      (steps: any[], fieldKey: string, optionPairs: { key: string; value: string }[]): any[] => {
        const optionValues = optionPairs.map(pair => pair.value);
        return (steps || []).map((step: any) => {
          const nextConfig = { ...(step?.config || {}) };

          if (nextConfig.paramConfigs && typeof nextConfig.paramConfigs === 'object') {
            const existingParam = nextConfig.paramConfigs[fieldKey];
            if (existingParam) {
              nextConfig.paramConfigs = {
                ...nextConfig.paramConfigs,
                [fieldKey]: {
                  ...existingParam,
                  type: 'dropdown',
                  values: optionValues,
                  optionPairs,
                },
              };
            }
          }

          if (Array.isArray(nextConfig.variables)) {
            nextConfig.variables = nextConfig.variables.map((variable: any) => {
              const variableKey = variable?.key || variable?.name;
              if (variableKey !== fieldKey) return variable;
              return {
                ...variable,
                type: 'dropdown',
                values: optionValues,
              };
            });
          }

          if (Array.isArray(nextConfig.steps)) {
            nextConfig.steps = applyDropdownEditsToSteps(nextConfig.steps, fieldKey, optionPairs);
          }

          const nextStep: any = {
            ...step,
            config: nextConfig,
          };

          if (Array.isArray(step?.subSteps)) {
            nextStep.subSteps = applyDropdownEditsToSteps(step.subSteps, fieldKey, optionPairs);
          }

          return nextStep;
        });
      },
      [],
    );

    const applyDropdownEditsToAutomation = useCallback(
      (
        automation: SavedAutomation,
        fieldKey: string,
        optionPairs: { key: string; value: string }[],
      ): SavedAutomation => {
        const optionValues = optionPairs.map(pair => pair.value);
        const nextInputs = Array.isArray(automation.inputs)
          ? automation.inputs.map(input =>
            input.id === fieldKey || input.label === fieldKey
              ? {
                ...input,
                type: 'dropdown' as AutomationInputDefinition['type'],
                dropdownOptions: optionValues.join(','),
              }
              : input,
          )
          : automation.inputs;

        return {
          ...automation,
          inputs: nextInputs,
          steps: applyDropdownEditsToSteps(automation.steps || [], fieldKey, optionPairs),
        };
      },
      [applyDropdownEditsToSteps],
    );

    const buildApiStepsPayload = useCallback((steps: any[]) => {
      const mapSteps = (
        stepList: any[],
      ): { module_id: string; step_order: number; config: Record<string, any>; sub_steps?: any[] }[] =>
        (stepList || []).map((step: any, index: number) => ({
          module_id: step.moduleId,
          step_order: index + 1,
          config: step.config || {},
          ...(Array.isArray(step.subSteps) && step.subSteps.length > 0
            ? {
              sub_steps: mapSteps(step.subSteps),
            }
            : {}),
        }));
      return mapSteps(steps || []);
    }, []);

    const persistDropdownEditsForAutomations = useCallback(
      async (automations: SavedAutomation[]) => {
        const persistable = (automations || []).filter(auto => {
          const automationId = Number(auto?.id);
          return Number.isFinite(automationId) && automationId > 0;
        });
        if (persistable.length === 0) return;

        const results = await Promise.allSettled(
          persistable.map(async auto => {
            const automationId = Number(auto.id);
            const payloadSteps = buildApiStepsPayload(auto.steps || []);
            return updateAutomation({
              id: automationId,
              name: auto.name,
              steps: payloadSteps,
            });
          }),
        );

        const failed = results.filter(result => result.status === 'rejected').length;
        if (failed > 0) {
          triggerToast('Some dropdown edits failed to persist', 'error');
          return;
        }
        triggerToast('Dropdown edits saved', 'success');
      },
      [buildApiStepsPayload, triggerToast],
    );

    // --- Agent Snippet Saving ---
    const handleSaveAsAgent = useCallback(
      (session: any) => {
        

        const models = session.models || [];
        const isSingle = models.length === 1;

        // Define Agent ID and name
        let agentId = 'all';
        let agentName = 'All AI Chat Agents';

        const mapping: Record<string, string> = {
          gpt: 'ChatGPT',
          claude: 'Claude',
          gemini: 'Gemini',
          perplexity: 'Perplexity',
        };

        const iconHostMapping: Record<string, string> = {
          gpt: 'chatgpt.com',
          claude: 'claude.ai',
          gemini: 'gemini.google.com',
          perplexity: 'perplexity.ai',
        };

        if (isSingle) {
          agentId = models[0];
          agentName = mapping[agentId] || agentId.charAt(0).toUpperCase() + agentId.slice(1);
        } else if (models.length > 1) {
          // For multiple, use names join
          agentName = models.map((m: string) => mapping[m] || m.toUpperCase()).join(' + ');
        }

        // Filter URLs to only include selected models
        const filteredUrls: Record<string, string> = {};
        if (session.urls) {
          models.forEach((m: string) => {
            if (session.urls[m]) filteredUrls[m] = session.urls[m];
          });
        }

        const prefilledAutomation = {
          id: `temp-${Date.now()}`,
          name: session.prompt
            ? session.prompt.length > 30
              ? session.prompt.substring(0, 30)
              : session.prompt
            : 'New Agent',
          steps: [
            {
              id: `agent-${Date.now()}`,
              moduleId: 'agent',
              config: {
                agentId: agentId,
                name: agentName,
                // Only pass allAiUrls if it's the 'all' agent (multiple or generic)
                allAiUrls: agentId === 'all' ? filteredUrls : undefined,
                // If single agent, set specific fields
                url: isSingle ? session.urls[agentId] : undefined,
                iconHost: isSingle ? iconHostMapping[agentId] : undefined,
                prompts: { prompt1: session.prompt },
                promptLabel: 'prompt1',
              },
            },
          ],
          timestamp: Date.now(),
        };

        // Clear searchbar state to exit "locked" AI mode so the AgentPanel can render properly
        setLockedCommand(null);
        setValue('');
        setShowAIHistoryPanel(false);

        dispatch(
          navigateToView({ kind: 'agentPanel', agentProps: { editMode: false, automation: prefilledAutomation } }),
        );
        triggerToast('Opening in Agent Editor...', 'info');
      },
      [dispatch, triggerToast, setValue],
    );

    // Staged AI History Session for context injection
    const [stagedHistorySession, setStagedHistorySession] = useState<AIChatHistorySuggestionItem | null>(null);

    // Image/File attachment state
    const [selectedImages, setSelectedImages] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const selectedImagesRef = useRef<typeof selectedImages>([]);
    useEffect(() => {
      selectedImagesRef.current = selectedImages;
    }, [selectedImages]);

    const stagedHistorySessionRef = useRef<typeof stagedHistorySession>(null);
    useEffect(() => {
      stagedHistorySessionRef.current = stagedHistorySession;
    }, [stagedHistorySession]);

    // Revoke Blob URLs on unmount or change to prevent memory leaks
    useEffect(() => {
      return () => {
        selectedImages.forEach(img => URL.revokeObjectURL(img.url));
      };
    }, []);

    // File preview on hover state
    const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null);

    const processFiles = useCallback(
      (files: FileList | File[]) => {
        if (!files || files.length === 0) return;

        const currentCount = selectedImages.length;
        let addedInThisBatch = 0;
        let limitExceeded = false;
        let unsupportedTypeInBatch = false;

        const isAiCommand =
          lockedCommand === 'gpt' ||
          lockedCommand === 'claude' ||
          lockedCommand === 'perplexity' ||
          lockedCommand === 'gemini' ||
          lockedCommand === 'ai' ||
          lockedCommand === 'upload_drive';

        const allowedAIExtensions = new Set([
          'pdf',
          'doc',
          'docx',
          'txt',
          'md',
          'csv',
          'xlsx',
          'xls',
          'json',
          'ppt',
          'pptx',
          'py',
          'js',
          'ts',
          'tsx',
          'css',
          'html',
          'java',
          'c',
          'cpp',
          'h',
          'sql',
          'sh',
          'rtf',
          'odt',
          'epub',
        ]);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const isImage = file.type.startsWith('image/');
          const extension = file.name.split('.').pop()?.toLowerCase() || '';

          // Allow ALL files for AI commands (User Request: "All types of files")
          // Also allow them when no command is locked so user can see AI suggestions
          const isAllowedDoc = isAiCommand || !lockedCommand;

          const isValidType = isImage || isAllowedDoc;

          if (!isValidType) {
            unsupportedTypeInBatch = true;
            continue;
          }

          if (currentCount + addedInThisBatch >= 8) {
            limitExceeded = true;
            break;
          }

          addedInThisBatch++;
          const blobUrl = URL.createObjectURL(file);

          setSelectedImages(prev => {
            if (prev.length >= 8) {
              URL.revokeObjectURL(blobUrl);
              return prev;
            }

            return [
              ...prev,
              {
                url: blobUrl,
                file: file,
                mimeType: file.type || (isAllowedDoc ? 'application/octet-stream' : 'image/png'),
                filename: file.name,
              },
            ];
          });
        }

        if (unsupportedTypeInBatch) {
          if (!isAiCommand) {
            triggerToast('File support is limited to images here. AI commands support more formats.', 'info');
          } else {
            triggerToast('Some files were skipped. Only images and supported documents are allowed.', 'info');
          }
        }

        if (limitExceeded) {
          triggerToast('Maximum 8 files allowed', 'error');
          setFooterStatus({
            message: 'Maximum 8 files allowed',
            type: 'error',
          });
          setTimeout(() => setFooterStatus(null), 3000);
        }
      },
      [lockedCommand, selectedImages, triggerToast],
    );

    const handleFileSelect = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
          processFiles(event.target.files);
        }
        // Reset input value so the same file can be selected again if needed
        event.target.value = '';
      },
      [processFiles],
    );

    const handlePaste = useCallback(
      (event: React.ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return;

        // Try getting files from .files first (more robust for multiple filesystem files)
        const clipboardFiles = clipboardData.files;
        let files: File[] = [];

        if (clipboardFiles && clipboardFiles.length > 0) {
          files = Array.from(clipboardFiles);
        } else if (clipboardData.items) {
          // Fallback to .items
          for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            if (item.kind === 'file') {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }

        if (files.length > 0) {
          // Prevent default paste if files are detected
          event.preventDefault();
          // Mark native event as processed to avoid double-trigger in global handlers
          if (event.nativeEvent) (event.nativeEvent as any)._processed = true;
          processFiles(files);
        }
      },
      [processFiles],
    );

    // Global attachment handlers (Paste & Drag/Drop)
    useEffect(() => {
      const isRestrictedView =
        mainView?.kind === 'noteEditor' ||
        mainView?.kind === 'promptEditor' ||
        mainView?.kind === 'createOrganization' ||
        mainView?.kind === 'sharedFolderCreation' ||
        mainView?.kind === 'workspaceShare';

      const isRestrictedMode = isCommandListView || isCreatingNewItem || isLinkEditModalOpen;

      if (isRestrictedView || isRestrictedMode) return;

      const handleGlobalPaste = (e: ClipboardEvent) => {
        // Skip if focusing another input/textarea
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true';

        if (isInput) return;

        // Also skip if it bubbled up from our own search bar
        if ((e as any)._processed || e.defaultPrevented || e.composedPath().some(el => el === containerRef.current))
          return;

        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        // Use .files for better compatibility with filesystem file pastes
        let files: File[] = [];
        const clipboardFiles = clipboardData.files;

        if (clipboardFiles && clipboardFiles.length > 0) {
          files = Array.from(clipboardFiles);
        } else if (clipboardData.items) {
          // Fallback to items loop
          for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            if (item.kind === 'file') {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }

        if (files.length > 0) {
          // If a file is pasted, we treat it as an AI prompt attachment
          // preventing default so it doesn't paste into the search bar if it's already focused
          // but if it's NOT focused, we focus it.
          e.preventDefault();
          processFiles(files);
          if (lockedCommand !== 'ai') {
            inputRef.current?.focus();
          }
        }
      };

      const handleGlobalDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const handleGlobalDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer?.types.includes('Files')) {
          setIsGlobalDragging(true);
        }
      };

      const handleGlobalDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setIsGlobalDragging(false);
        }
      };

      const handleGlobalDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsGlobalDragging(false);
        dragCounter.current = 0;

        // Skip if already handled by local handlers
        if ((e as any)._processed || e.defaultPrevented || e.composedPath().some(el => el === containerRef.current))
          return;

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          processFiles(Array.from(files));
          if (lockedCommand !== 'ai') {
            inputRef.current?.focus();
          }
        }
      };

      window.addEventListener('paste', handleGlobalPaste);
      window.addEventListener('dragover', handleGlobalDragOver);
      window.addEventListener('dragenter', handleGlobalDragEnter);
      window.addEventListener('dragleave', handleGlobalDragLeave);
      window.addEventListener('drop', handleGlobalDrop);

      return () => {
        window.removeEventListener('paste', handleGlobalPaste);
        window.removeEventListener('dragover', handleGlobalDragOver);
        window.removeEventListener('dragenter', handleGlobalDragEnter);
        window.removeEventListener('dragleave', handleGlobalDragLeave);
        window.removeEventListener('drop', handleGlobalDrop);
      };
    }, [mainView, isCommandListView, isCreatingNewItem, isLinkEditModalOpen, processFiles, inputRef]);

    const handleDragOver = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // Only set to false if we're actually leaving the container, not just entering a child
      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
      setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
      (event: React.DragEvent | DragEvent) => {
        event.preventDefault();
        event.stopPropagation();

        // Mark the native event as processed to avoid double-trigger in global handlers
        const nativeEvent = (event as any).nativeEvent || event;
        if (nativeEvent) (nativeEvent as any)._processed = true;

        setIsDragging(false);

        const dataTransfer = (event as any).dataTransfer;
        if (!dataTransfer) return;

        // 1. Handle Files
        if (dataTransfer.files && dataTransfer.files.length > 0) {
          processFiles(dataTransfer.files);
          return;
        }

        // 2. Handle Text/URLs
        const url = dataTransfer.getData('URL');
        const text = dataTransfer.getData('text/plain');

        if (url) {
          setValue(url);
          if (lockedCommand !== 'ai') {
            inputRef.current?.focus();
          }
          return;
        }

        if (text) {
          setValue(text);
          if (lockedCommand !== 'ai') {
            inputRef.current?.focus();
          }
          return;
        }
      },
      [processFiles],
    );

    // Global Drag & Drop Listeners (Functionality + Global Highlight)
    useEffect(() => {
      const onDragOver = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
      };

      const onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        // Only set to false if we're actually leaving the window
        if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
          setIsDragging(false);
        }
      };

      const onDrop = (e: DragEvent) => {
        handleDrop(e);
      };

      window.addEventListener('dragover', onDragOver);
      window.addEventListener('dragleave', onDragLeave);
      window.addEventListener('drop', onDrop);

      return () => {
        window.removeEventListener('dragover', onDragOver);
        window.removeEventListener('dragleave', onDragLeave);
        window.removeEventListener('drop', onDrop);
      };
    }, [handleDrop]);

    const removeSelectedImage = useCallback((index: number) => {
      setSelectedImages(prev => {
        const item = prev[index];
        if (item) URL.revokeObjectURL(item.url);
        return prev.filter((_, i) => i !== index);
      });
    }, []);

    const clearSelectedImages = useCallback(() => {
      selectedImages.forEach(img => URL.revokeObjectURL(img.url));
      setSelectedImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, [selectedImages]);

    // Fetch current tab ID on mount to ensure we can target it reliably later
    useEffect(() => {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.tabs?.getCurrent) {
        chromeAny.tabs.getCurrent((tab: any) => {
          if (tab?.id) {
            
            setCurrentTabId(tab.id);
          }
        });
      }
    }, []);

    // Inline Prompt Dropdown State (Tab key triggered)
    const [promptSuggestions, setPromptSuggestions] = useState<PromptMenuSuggestion[]>([]);
    const [promptHighlightIndex, setPromptHighlightIndex] = useState(0);
    const [showPromptMenu, setShowPromptMenu] = useState(false);

    // @ Command Selector State (shows GPT, Perplexity, Google when @ is typed)
    const [showAtCommandMenu, setShowAtCommandMenu] = useState(false);
    const [atCommandHighlightIndex, setAtCommandHighlightIndex] = useState(0);
    const [selectedAtCommand, setSelectedAtCommand] = useState<string | null>(null);
    const [recentIds] = useChromeStorage<string[]>('taskbot_recent_commands', []);
    const [autoTriggerDropdown, setAutoTriggerDropdown] = useChromeStorage<boolean>('rtq_focus_on', true);
    const [openTabs, setOpenTabs] = useState<any[]>([]);
    const [mentionedTabs, setMentionedTabs] = useState<any[]>([]);
    const suppressAtMenuRef = useRef(false);
    const lastAtSelectRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

    const mentionedTabsContainerRef = useRef<HTMLDivElement | null>(null);
    const [mentionedTabsWidth, setMentionedTabsWidth] = useState(0);

    useLayoutEffect(() => {
      if (mentionedTabsContainerRef.current) {
        setMentionedTabsWidth(mentionedTabsContainerRef.current.offsetWidth);
      } else {
        setMentionedTabsWidth(0);
      }
    }, [mentionedTabs]);

    useEffect(() => {
      const chromeAny = (window as any).chrome;
      if (chromeAny && chromeAny.tabs && chromeAny.tabs.query) {
        chromeAny.tabs.query({}, (tabs: any[]) => {
          const mapped = (tabs || [])
            .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
            .map(t => ({
              id: `tab:${t.id}`,
              label: t.title || t.url || 'Untitled Tab',
              favIconUrl: t.favIconUrl || (t.url ? getFaviconUrl(t.url) : ''),
            }));
          setOpenTabs(mapped);
        });
      }
    }, [value]);

    useEffect(() => {
      const editable = inputRef.current as any;
      if (editable && value === '' && editable.innerText !== '') {
        editable.innerHTML = '';
      }
    }, [value]);

    // Inline Saved Agents Menu State (when locked in /ai and typing /...)
    const [showSavedAgentsMenu, setShowSavedAgentsMenu] = useState(false);
    const [savedAgentSuggestions, setSavedAgentSuggestions] = useState<any[]>([]);
    const [savedAgentHighlightIndex, setSavedAgentHighlightIndex] = useState(0);

    useEffect(() => {
      const promptText = commandPrompt || value;
      const isLockedAI = lockedCommand === 'ai';

      if (isLockedAI && promptText.startsWith('/')) {
        const query = promptText.slice(1).trim().toLowerCase();

        // 1. Build the "Your Chats" style list
        const activeUnsaved =
          activeAiSession && !savedAiAgents.some(a => String(a.id) === String((activeAiSession as any).id))
            ? [
              {
                id: 'active-session',
                name: activeAiSession.name || activeAiSession.prompt || 'Untitled Session',
                isActive: true,
              },
            ]
            : [];

        const savedPart = (savedAiAgents || []).map(a => ({
          ...a,
          isActive: String(a.id) === String((activeAiSession as any)?.id),
        }));

        const activeSaved = savedPart.filter(a => a.isActive);
        const otherSaved = savedPart.filter(a => !a.isActive);

        const allItems = [...activeUnsaved, ...activeSaved, ...otherSaved];

        // 2. Filter based on query if present
        if (query) {
          const filtered = allItems.filter((item: any) => (item.name || '').toLowerCase().includes(query));
          setSavedAgentSuggestions(filtered);
          setShowSavedAgentsMenu(filtered.length > 0);
          setSavedAgentHighlightIndex(0);
        } else {
          setSavedAgentSuggestions(allItems);
          setShowSavedAgentsMenu(allItems.length > 0);
          setSavedAgentHighlightIndex(0);
        }
      } else {
        setShowSavedAgentsMenu(false);
        setSavedAgentSuggestions([]);
      }
    }, [lockedCommand, commandPrompt, value, savedAiAgents, activeAiSession]);

    // Footer status for command feedback
    const [footerStatus, setFooterStatus] = useState<FooterStatus>(null);

    // Command Not Installed Dialog State
    const [commandNotInstalledDialog, setCommandNotInstalledDialog] = useState<{
      isOpen: boolean;
      commandName: string;
      commandId?: string;
    }>({ isOpen: false, commandName: '', commandId: undefined });

    const [loginRequiredDialog, setLoginRequiredDialog] = useState<{
      isOpen: boolean;
      commandName: string;
    }>({ isOpen: false, commandName: '' });

    const checkLocalCommandAuth = useCallback(
      (commandId: AnyCommandId): boolean => {
        
        if (isLocalCommandId(commandId as string) && !isLoggedIn) {
          const lDef = LOCAL_COMMANDS.find(c => c.id === commandId);
          setLoginRequiredDialog({ isOpen: true, commandName: lDef?.label || String(commandId) });
          return false;
        }
        return true;
      },
      [isLoggedIn],
    );

    // Chrome omnibox-style inline autocomplete state
    const [inlineAutocomplete, setInlineAutocomplete] = useState<string | null>(null);
    const [isSearchFocusEnabled, setIsSearchFocusEnabled] = useState(true);

    useEffect(() => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

      chrome.storage.local.get(['omnibox_override_enabled'], result => {
        setIsSearchFocusEnabled(result.omnibox_override_enabled !== false);
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.omnibox_override_enabled) {
          setIsSearchFocusEnabled(changes.omnibox_override_enabled.newValue !== false);
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    useEffect(() => {
      const loadPersistedData = () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['selectedAIs', 'activeAiSession'], result => {
            if (result.selectedAIs && Array.isArray(result.selectedAIs)) {
              setSelectedAIs(result.selectedAIs);
            } else {
              setSelectedAIs(AI_GROUP.members);
            }

            if (result.activeAiSession && !isInitialMountRef.current) {
              
              setActiveAiSession(result.activeAiSession);
            }
          });
        } else {
          setSelectedAIs(AI_GROUP.members);
        }
      };

      loadPersistedData();

      // Listen for changes
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.selectedAIs) {
          const newValue = changes.selectedAIs.newValue;
          if (newValue && Array.isArray(newValue)) {
            setSelectedAIs(newValue);
          }
        }
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      return undefined;
    }, []);

    // Keep isFocused in sync with actual DOM focus on the textarea element.
    // We avoid window-level listeners to prevent race conditions with autoFocus.
    // The mount check (with delay) handles the case where autoFocus fires before
    // React's synthetic onFocus handler is attached.
    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;

      const handleFocus = () => {
        setIsFocused(true);
      };
      const handleBlur = () => {
        // Guard: only set false if the textarea truly lost focus.
        // This prevents brief focus-stealing during page load from hiding the cursor.
        if (document.activeElement !== el) {
          setIsFocused(false);
        }
      };

      el.addEventListener('focus', handleFocus);
      el.addEventListener('blur', handleBlur);

      // Delayed mount check: autoFocus may not have fired yet when useEffect runs.
      // This ensures isFocused=true once autoFocus has taken effect.
      const t = setTimeout(() => {
        setIsFocused(document.activeElement === el);
      }, 100);

      return () => {
        el.removeEventListener('focus', handleFocus);
        el.removeEventListener('blur', handleBlur);
        clearTimeout(t);
      };
    }, []);

    const [bookmarkSuggestions, setBookmarkSuggestions] = useState<BookmarkSuggestionItem[]>([]);
    const [pendingQueryUrls, setPendingQueryUrls] = useState<string[] | null>(null);
    const [processedReadyUrls, setProcessedReadyUrls] = useState<string[]>([]);
    const [pendingQueryLabel, setPendingQueryLabel] = useState<string>('');
    const [queryValue, setQueryValue] = useState('');
    const queryInputRef = useRef<HTMLInputElement | null>(null);

    // Measure prefix width dynamically
    useLayoutEffect(() => {
      if (
        prefixRef.current &&
        ((lockedCommand && activeCommandInfo) ||
          (pendingQueryUrls && pendingQueryUrls.length > 0) ||
          selectedAtCommand ||
          isCommandListView ||
          isAllItemsView ||
          (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0))
      ) {
        const width = prefixRef.current.offsetWidth;
        setPrefixWidth(width);
      } else {
        setPrefixWidth(0);
      }
    }, [lockedCommand, activeCommandInfo, pendingQueryUrls, selectedAtCommand, isCommandListView, isAllItemsView]);

    const computeInitialPrompt = useCallback(
      (commandId: AnyCommandId): string => {
        if (!value) return '';
        const raw = value.trim();
        if (!raw) return '';
        if (raw.startsWith('/')) {
          const withoutSlash = raw.slice(1);
          const spaceIdx = withoutSlash.indexOf(' ');
          if (spaceIdx === -1) {
            // Only command prefix typed - no prompt yet
            return '';
          }
          const commandPart = withoutSlash.slice(0, spaceIdx).toLowerCase();
          if (commandPart === String(commandId).toLowerCase()) {
            return withoutSlash.slice(spaceIdx + 1).trim();
          }
          return withoutSlash.slice(spaceIdx + 1).trim();
        }
        return raw;
      },
      [value],
    );

    const previewCommandById = useCallback(
      (commandId: AnyCommandId | null) => {
        if (lockedCommand) return;
        // Assuming `localDef`, `executeCommand`, and `context` would be defined in a broader scope
        // or passed as props/hooks if this were a complete, working snippet.
        // For the purpose of applying the change faithfully and syntactically correctly
        // within the given context, we'll assume `localDef` is derived from `commandId`
        // and `executeCommand` and `context` are available.
        // This block replaces the original `if (!commandId)` block.
        const localDef = commandId ? LOCAL_COMMANDS.find(cmd => cmd.id === (commandId as LocalCommandId)) : null;
        if (localDef) {
          // This `executeCommand` and `context` are not defined in the provided snippet.
          // To make it syntactically correct, I'm commenting out the call.
          // executeCommand(localDef.id, context, undefined);
          // If it's the calendar command, we should close the popup as it opens a new tab
          if ((localDef.id as string) === 'calendar') {
            // For NewTab, window.close might not work on main page, but we can clear search state
            setLockedCommand(null);
            setValue('');
          }
          setSelectedCommand(null); // This line was misplaced in the original instruction, moved inside the block.
          return;
        }
        if (!commandId) {
          // Re-adding the original check for !commandId if localDef wasn't found
          selectionSourceRef.current = null;
          setSelectedCommand(null);
          return;
        }
        const info = buildSelectionInfoFromId(commandId, commands);
        if (!commandSupportsInlineQuery(info)) {
          selectionSourceRef.current = null;
          setSelectedCommand(null);
          return;
        }
        if (selectionSourceRef.current === 'external' && selectedCommand?.id === info.id) {
          return;
        }
        selectionSourceRef.current = 'external';
        setSelectedCommand(info);
      },
      [lockedCommand, selectedCommand, commands],
    );

    const clearCommandPreview = useCallback(() => {
      selectionSourceRef.current = null;
      setSelectedCommand(null);
      clearSelectedImages(); // Clear images on preview clear
    }, [clearSelectedImages]);

    // Measure prefix width dynamically
    useLayoutEffect(() => {
      if (
        prefixRef.current &&
        ((lockedCommand && activeCommandInfo) ||
          (pendingQueryUrls && pendingQueryUrls.length > 0) ||
          selectedAtCommand ||
          isCommandListView ||
          isAllItemsView ||
          selectedWorkspace ||
          selectedFolder ||
          (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0))
      ) {
        const width = prefixRef.current.offsetWidth;
        setPrefixWidth(width);
      } else {
        setPrefixWidth(0);
      }
    }, [
      lockedCommand,
      activeCommandInfo,
      pendingQueryUrls,
      selectedAtCommand,
      isCommandListView,
      isAllItemsView,
      value,
      highlightIndex,
      windowDimensions.width,
    ]);

    const activateCommandById = useCallback(
      (commandId: AnyCommandId | null, initialPromptOverride?: string) => {
        if (commandId === null) {
          setLockedCommand(null);
          resetAfterCommandExecution();
          return;
        }

        // Prevent reactivation if command is already locked with the same ID
        if (lockedCommand === commandId) {
          
          return;
        }

        // Logic Update: Prevent local commands from activating if user is not logged in
        if (!checkLocalCommandAuth(commandId)) return;

        const info = buildSelectionInfoFromId(commandId, commands);
        
        if (!info) return;

        activeSlashFilterRef.current = null;
        setActiveSlashFilter(null);

        const initialPrompt =
          initialPromptOverride !== undefined ? initialPromptOverride : computeInitialPrompt(commandId);
        setCommandPrompt(info.requiresInlineQuery ? initialPrompt : '');
        if (!info.requiresInlineQuery) {
          setValue(commandId === BOOKMARKS_COMMAND_ID ? initialPrompt : '');
        } else {
          setValue('');
        }

        // Always reset AI session when explicitly activating a new command
        // Note: selectSavedAgent will override this by setting the session AFTER activation
        setActiveAiSession(null);

        setLockedCommand(commandId);
        selectionSourceRef.current = null;
        setSelectedCommand(null);
        setHighlightIndex(0);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
        if (info.requiresInlineQuery) {
          
          setIsFocused(false);
          inputRef.current?.blur();
          setIsInlineFocused(true);
          // Use a longer timeout to ensure the inline input is rendered after state update
          window.setTimeout(() => {
            
            if (inlineInputRef.current) {
              inlineInputRef.current.focus();
            } else {
              // Retry with longer delay if component hasn't rendered yet
              window.setTimeout(() => {
                
                if (inlineInputRef.current && document.activeElement !== inlineInputRef.current) {
                  inlineInputRef.current.focus();
                }
              }, 50);
            }
          }, 10);
        } else {
          setIsInlineFocused(false);
          setIsFocused(commandId !== 'ai'); // 'ai' has its own input box
          if (commandId === 'ai') {
            inputRef.current?.blur();
          } else {
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
      },
      [computeInitialPrompt, commands, lockedCommand],
    );

    const activateSelectedCommand = useCallback(() => {
      if (!selectedCommand) return;
      activateCommandById(selectedCommand.id, '');
    }, [activateCommandById, selectedCommand]);

    const resetAfterCommandExecution = useCallback(
      (options?: { preserveAiLock?: boolean }) => {
        // Force clear DOM values manually to avoid race conditions with React's state sync
        if (inputRef.current) {
          (inputRef.current as any).value = '';
          inputRef.current.innerHTML = '';
        }
        if (inlineInputRef.current) inlineInputRef.current.value = '';

        setValue('');
        setCommandPrompt('');

        if (!options?.preserveAiLock) {
          setLockedCommand(null);
          setActiveAiSession(null);
          onLockedCommandChange?.(null);
        }

        setSelectedAtCommand(null);
        selectionSourceRef.current = null;
        setSelectedCommand(null);
        clearSelectedImages();
        setHighlightIndex(0);
        setShowPromo(false);
        setIsSuggestionsHidden(false);
        setContextualMatches([]);
        setIsContextualPopupOpen(false);
        setContextualPopupIndex(-1);
        setShowPromptMenu(false);
        suggestionVisibilityRef.current = false;
        setPendingQueryUrls(null);
        setProcessedReadyUrls([]);
        setPendingQueryLabel('');
        setQueryValue('');
        setActiveCollection(null);
        setShowAIHistoryPanel(false);
        setMentionedTabs([]);
        promptQueueRef.current = [];

        // Synchronously notify parent of query change
        onQueryChange?.('');

        window.setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      },
      [setLockedCommand, setValue, clearSelectedImages, onQueryChange, onLockedCommandChange],
    );

    const exitCommandMode = useCallback(() => {
      setLockedCommand(null);
      setActiveAiSession(null);
      setActiveCollection(null);
      setShowPromo(false);
      selectionSourceRef.current = null;
      setSelectedCommand(null);
      setCommandPrompt('');
      setValue(''); // Clear search query text
      setMentionedTabs([]); // Clear active tab pills
      if (inputRef.current) {
        try {
          (inputRef.current as any).innerText = '';
          (inputRef.current as any).innerHTML = '';
        } catch (e) {
          console.error('[exitCommandMode] Error clearing contentEditable:', e);
        }
      }
      clearSelectedImages(); // Ensure images are cleared when exiting command mode
      setShowAIHistoryPanel(false); // Reset AI history panel visibility
      setIsInlineFocused(false);
      promptQueueRef.current = [];
      setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
        setIsFocused(true);
        setIsInlineFocused(false);
      }, 0);
    }, [clearSelectedImages, setValue, setMentionedTabs]);

    // Helper to process the URL queue
    const processNextUrl = useCallback(
      (queue: string[], ready: string[], title?: string, forceNewTab = false) => {
        if (queue.length === 0) {
          // All done, open them
          if (ready.length === 1) openSingleLink(ready[0], forceNewTab, currentTabId);
          else openMultipleLinks(ready, currentTabId);

          // Reset state
          setPendingQueryUrls(null);
          setProcessedReadyUrls([]);
          setPendingQueryLabel('');
          setQueryValue('');
          return;
        }

        const head = queue[0];
        const needsVar = /\{query\}|\[query\]/i.test(String(head));

        if (!needsVar) {
          // No prompt needed, move to ready and continue
          processNextUrl(queue.slice(1), [...ready, head], title, forceNewTab);
        } else {
          // Needs prompt - update state and wait for user
          setPendingQueryUrls(queue);
          setProcessedReadyUrls(ready);
          setQueryValue('');
          setValue(''); // Clear main input

          // Try to extract a nice label from the URL if generic title is passed or missing
          let label = title || 'Enter value';
          try {
            // If it looks like a url, show domain
            if (head.startsWith('http')) {
              const urlObj = new URL(head);
              label = `Search on ${urlObj.hostname}`;
            }
          } catch { }

          setPendingQueryLabel(label);
          inputRef.current?.focus();
        }
      },
      [currentTabId],
    );

    const openUrls = useCallback(
      (urls: string[], title?: string, forceNewTab = false) => {
        if (!urls || urls.length === 0) return;
        // Start processing the queue
        processNextUrl(urls, [], title, forceNewTab);
      },
      [processNextUrl],
    );

    // Global handler for Ctrl+U to trigger file picker and prevent "View Source"
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // HARD FIX: If favorites context menu is open, ignore ALL navigation/keys here
        if ((window as any).isFavoritesMenuOpen) return;

        // Only trigger if we are in a mode that supports images
        const supportsImages =
          lockedCommand === 'gpt' ||
          lockedCommand === 'ai' ||
          lockedCommand === 'perplexity' ||
          lockedCommand === 'claude' ||
          lockedCommand === 'upload_drive' ||
          lockedCommand === 'gemini';

        if (supportsImages && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
          e.preventDefault();
          e.stopPropagation();
          fileInputRef.current?.click();
        }
      };

      // Use capture phase to ensure we intercept before browser default
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [lockedCommand]);

    // Re-focus the search input when the user returns to this tab (e.g. after visiting an AI tab).
    // Without this, the input loses focus and Enter behaves as a newline/Shift+Enter.
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (
          document.visibilityState === 'visible' &&
          (lockedCommand === 'ai' || AI_GROUP.members.includes(lockedCommand as any))
        ) {
          // Small delay to let the tab finish rendering before we steal focus
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [lockedCommand]);

    // Redux state for workspace/snippet data
    const selectedTeam = useSelector(selectSelectedTeam);
    const selectedFolder = useSelector(selectSelectedFolder);
    const selectedWorkspace = useSelector(selectSelectedWorkspace);
    const teamId = selectedTeam?.team_id || '';

    // Additional measurement for workspace/folder chips (must come after selectors)
    useEffect(() => {
      if (prefixRef.current && (selectedWorkspace || selectedFolder)) {
        const width = prefixRef.current.offsetWidth;
        setPrefixWidth(width);
      }
    }, [selectedWorkspace, selectedFolder]);

    // Needed to show back button when viewing a note

    const showBackButton = (selectedSnippet || isCreatingNewItem) && !isCommandListView;

    const lockedLocalDef: LocalCommandDefinition | undefined = useMemo(() => {
      if (!lockedCommand || !isLocalCommandId(lockedCommand)) return undefined;
      if (lockedCommand === BOOKMARKS_COMMAND_ID) return undefined;
      const def = LOCAL_COMMANDS.find(c => c.id === lockedCommand);
      return def && (def as LocalCommandDefinition).behavior === 'entity' ? def : undefined;
    }, [lockedCommand]);

    const isSnippetCommand = lockedLocalDef?.scope === 'snippet';
    const activeSnippetCommandId: LocalCommandId | null = isSnippetCommand
      ? (lockedLocalDef?.id as LocalCommandId)
      : null;

    // Load note_commands and link_commands for search
    const [noteCommandsMap, setNoteCommandsMap] = useState<NoteCommandMap>({});
    const [linkCommandsMap, setLinkCommandsMap] = useState<LinkCommandMap>({});

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const chromeAny = (window as any)?.chrome;
          if (!chromeAny?.storage?.local) return;

          const result = await chromeAny.storage.local.get(['note_commands', 'link_commands']);
          if (!mounted) return;

          setNoteCommandsMap(result.note_commands || {});
          setLinkCommandsMap(result.link_commands || {});
        } catch (error) {
          console.error('Failed to load note/link commands:', error);
        }
      })();

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local') {
          if (changes.note_commands) {
            setNoteCommandsMap(changes.note_commands.newValue || {});
          }
          if (changes.link_commands) {
            setLinkCommandsMap(changes.link_commands.newValue || {});
          }
        }
      };

      const chromeAny = (window as any)?.chrome;
      chromeAny?.storage?.onChanged?.addListener(handleStorageChange);
      return () => {
        mounted = false;
        chromeAny?.storage?.onChanged?.removeListener?.(handleStorageChange);
      };
    }, []);

    const allTeams = useSelector(selectAllData);

    // Helper to check if a team is personal space (with fallback to team_name)
    const isPersonalSpaceTeam = useCallback((team: Team | null | undefined): boolean => {
      if (!team) return false;
      return team.is_personal_space === true || team.team_name === 'Personal Space';
    }, []);

    const snippetIndex = useMemo(() => {
      // Find personal space team (with team_name fallback for robustness)
      const personalSpace = allTeams?.find(t => t.is_personal_space === true || t.team_name === 'Personal Space');

      // If we're already in personal space, just index that
      if (isPersonalSpaceTeam(selectedTeam)) {
        return buildSnippetIndex(selectedTeam, noteCommandsMap, linkCommandsMap, true, 'Personal Space');
      }

      // If we're in an org, merge org data + personal space data
      const orgIndex = buildSnippetIndex(
        selectedTeam ?? null,
        noteCommandsMap,
        linkCommandsMap,
        false,
        selectedTeam?.team_name,
      );

      if (personalSpace && personalSpace.team_id !== selectedTeam?.team_id) {
        const personalIndex = buildSnippetIndex(
          personalSpace,
          noteCommandsMap,
          linkCommandsMap,
          true,
          'Personal Space',
        );
        return [...orgIndex, ...personalIndex];
      }

      return orgIndex;
    }, [selectedTeam, allTeams, noteCommandsMap, linkCommandsMap, isPersonalSpaceTeam]);

    const folderIndex = useMemo(() => {
      // Find personal space team (with team_name fallback for robustness)
      const personalSpace = allTeams?.find(t => t.is_personal_space === true || t.team_name === 'Personal Space');

      // If we're already in personal space, just index that
      if (isPersonalSpaceTeam(selectedTeam)) {
        return buildFolderIndex(selectedTeam);
      }

      // If we're in an org, merge org folders + personal space folders
      const orgIndex = buildFolderIndex(selectedTeam ?? null);

      if (personalSpace && personalSpace.team_id !== selectedTeam?.team_id) {
        const personalIndex = buildFolderIndex(personalSpace);
        return [...orgIndex, ...personalIndex];
      }

      return orgIndex;
    }, [selectedTeam, allTeams, isPersonalSpaceTeam]);
    const commonCommandEntries = useMemo(() => buildCommonCommandEntries(commands), [commands]);

    const handleAIHistorySelect = useCallback((item: AIChatHistorySuggestionItem | null) => {
      setStagedHistorySession(item);
      setShowAIHistoryPanel(false);
      // Focus input after selection
      setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    // Handle prompt selection from Tab-triggered popup
    const handlePromptSelect = useCallback(
      (suggestion: SnippetSuggestion) => {
        // Insert prompt content at current cursor position
        const promptContent =
          typeof suggestion.snippet.value === 'string' ? suggestion.snippet.value : suggestion.snippet.key;
        const currentValue = value;
        // Insert prompt content + space at the end (or cursor position)
        const newValue =
          currentValue + (currentValue.endsWith(' ') || currentValue === '' ? '' : ' ') + promptContent + ' ';
        setValue(newValue);
        // Reset prompt state
        setShowPromptMenu(false);
        setPromptSuggestions([]);
        setPromptHighlightIndex(0);
        setTimeout(() => inputRef.current?.focus(), 0);
      },
      [value],
    );

    const handlePromptEdit = useCallback(
      (suggestion: SnippetSuggestion) => {
        setShowPromptMenu(false);
        setPromptSuggestions([]);
        // Call parent handler
        onRequestEditPrompt?.(suggestion);
      },
      [onRequestEditPrompt],
    );

    // Load prompt snippets when prompt menu is opened via Tab key
    // Uses current search value to filter prompts - popup auto-closes when no match
    const loadPromptSuggestions = useCallback(() => {
      const query = value.trim();

      const promptResults = searchSnippets(snippetIndex, query, {
        allowedCategories: new Set(['prompt']),
        limit: 50,
      });

      const promptItems: PromptMenuSuggestion[] = promptResults.map(result => {
        const suggestion: SnippetSuggestion = {
          snippet: result.entry.snippet,
          workspace: result.entry.workspace,
          folder: result.entry.folder,
          isPersonal: result.entry.isPersonal,
          teamName: result.entry.teamName,
        };

        return {
          kind: 'prompt',
          prompt: suggestion,
          label: suggestion.snippet.key || '',
          matchScore: query ? (getTextMatchScore(suggestion.snippet.key, query) ?? 3) : undefined,
        };
      });

      const aiAutomations = (automationSuggestions || []).filter(isPureAiAutomation);
      const automationItems: PromptMenuSuggestion[] = aiAutomations.reduce<PromptMenuSuggestion[]>(
        (acc, automation) => {
          const label = String(automation.name || '');
          const score = query ? getTextMatchScore(label, query) : null;
          if (query && score === null) return acc;

          acc.push({
            kind: 'automation',
            automation,
            label,
            matchScore: score ?? undefined,
          });

          return acc;
        },
        [],
      );

      let nextSuggestions: PromptMenuSuggestion[] = [];
      if (!query) {
        nextSuggestions = [...promptItems, ...automationItems];
      } else {
        nextSuggestions = [...promptItems, ...automationItems].sort((a, b) => {
          const aScore = a.matchScore ?? 3;
          const bScore = b.matchScore ?? 3;
          if (aScore !== bScore) return aScore - bScore;
          return a.label.localeCompare(b.label);
        });
      }

      setPromptSuggestions(nextSuggestions);
      setPromptHighlightIndex(0);
    }, [snippetIndex, value, automationSuggestions]);

    // Reactively update prompt suggestions when value changes while popup is open
    useEffect(() => {
      if (showPromptMenu) {
        loadPromptSuggestions();
        // Auto-close handled by InlinePromptPopup when prompts.length === 0
      }
    }, [showPromptMenu, loadPromptSuggestions]);

    // Detect @ at cursor to show command selector (Linear/Slack style)
    // Rule: Space immediately after @ is invalid. Space breaks the query.
    const activeText = inlineComposerActive ? commandPrompt : value;
    const activeInputRef = inlineComposerActive ? inlineInputRef : inputRef;
    const cursorPosition = activeInputRef.current?.selectionStart ?? activeText.length;
    const textBeforeCursor = activeText.slice(0, cursorPosition);
    const atQueryMatch = textBeforeCursor.match(/(?:^|\s)@([^@]*)$/);
    const atSearchQuery = atQueryMatch ? atQueryMatch[1] : '';
    const hasAtPattern = atQueryMatch !== null;

    // Filter prompts for @ menu
    const allPrompts = useMemo(() => {
      return snippetIndex.filter(e => e.category === 'prompt').map(e => e.snippet);
    }, [snippetIndex]);

    // Check if there are matching commands for the current query
    const filteredAtCommands = useMemo(() => {
      if (!hasAtPattern) return [];
      const isLockedAI =
        lockedCommand === 'ai' ||
        lockedCommand === 'gpt' ||
        lockedCommand === 'claude' ||
        lockedCommand === 'gemini' ||
        lockedCommand === 'perplexity';
      const hideTabs = lockedCommand === 'ai' && !!activeAiSession;
      let tabs = isLockedAI && !hideTabs ? openTabs : [];
      if (tabs.length > 0) {
        const allTabsOption = {
          id: 'tab:all_tabs',
          label: 'Add All Open Tabs',
          icon: FaLink,
          color: 'text-neutral-400',
          keywords: ['all', 'tabs', 'add all'],
          category: 'Active Tabs',
        };
        tabs = [allTabsOption, ...tabs];
      }
      const defaultFiltered = isLockedAI
        ? []
        : hasAtPattern
          ? getFilteredAtCommands(atSearchQuery, allPrompts, recentIds)
          : [];
      if (!atSearchQuery) return [...defaultFiltered, ...tabs];
      const q = atSearchQuery.toLowerCase().trim();
      const filteredTabs = tabs.filter(tab => (tab.label || '').toLowerCase().includes(q));
      return [...defaultFiltered, ...filteredTabs];
    }, [hasAtPattern, atSearchQuery, allPrompts, openTabs, lockedCommand, activeAiSession, recentIds]);
    const filteredAtCommandCount = filteredAtCommands.length;
    const isLockedAIState =
      lockedCommand === 'ai' ||
      lockedCommand === 'gpt' ||
      lockedCommand === 'claude' ||
      lockedCommand === 'gemini' ||
      lockedCommand === 'perplexity';
    const shouldShowAtMenu =
      hasAtPattern && (!lockedCommand || isLockedAIState) && !selectedAtCommand && filteredAtCommandCount > 0;

    // Track previous value to detect @ typing
    const prevValueRef = useRef(value);
    const prevPromptRef = useRef(commandPrompt);

    // Sync showAtCommandMenu with shouldShowAtMenu only when value or commandPrompt changes
    if (value !== prevValueRef.current || commandPrompt !== prevPromptRef.current) {
      prevValueRef.current = value;
      prevPromptRef.current = commandPrompt;
      if (suppressAtMenuRef.current) {
        suppressAtMenuRef.current = false;
        setShowAtCommandMenu(false);
      } else if (shouldShowAtMenu && !showAtCommandMenu) {
        setShowAtCommandMenu(true);
        setAtCommandHighlightIndex(0);
      } else if (!shouldShowAtMenu && showAtCommandMenu) {
        setShowAtCommandMenu(false);
      }
    }

    // Clamp highlight index when filtered results change
    if (showAtCommandMenu && atCommandHighlightIndex >= filteredAtCommandCount && filteredAtCommandCount > 0) {
      setAtCommandHighlightIndex(filteredAtCommandCount - 1);
    }

    // Handle @ command selection
    const handleAddTemplate = useCallback(async () => {
      const { commandId } = commandNotInstalledDialog;
      if (!commandId) return;

      // Find the template definition in the global COMMANDS list
      const cmdDef = COMMANDS.find(c => c.id === commandId);
      if (!cmdDef) {
        triggerToast(`Could not find definition for command "${commandId}"`, 'error');
        return;
      }

      try {
        await addCommand(cmdDef.id, cmdDef.prefix, cmdDef.keywords);
        triggerToast(`Command "${cmdDef.label}" added to your templates!`, 'success');
        refreshCommands?.();
      } catch (error) {
        console.error('Failed to add command to templates:', error);
        triggerToast('Failed to add command. Please try again.', 'error');
      }
    }, [commandNotInstalledDialog, refreshCommands, triggerToast]);

    const handleLocalCommandExecute = useCallback(
      (
        commandId: CommandId | LocalCommandId | 'ai',
        options?: { prompt?: string; files?: { base64: string; filename: string }[] },
      ) => {
        trackCounterEvent('command_count', { source: 'new_tab', commandId, commandType: 'local' });
        onCommandExecute?.(
          commandId,
          options ? { ...(options as any), __tracked: true } : ({ __tracked: true } as any),
        );
      },
      [onCommandExecute],
    );

    const handleAtCommandSelect = useCallback(
      async (commandId: string) => {
        const now = Date.now();
        if (lastAtSelectRef.current.id === commandId && now - lastAtSelectRef.current.time < 500) {
          
          return;
        }
        lastAtSelectRef.current = { id: commandId, time: now };

        
        await saveRecentCommand(commandId);
        suppressAtMenuRef.current = true;

        if (commandId === 'tab:all_tabs') {
          // Filter to non-internal chrome URLs
          const validTabs = openTabs.filter(
            t => t.id && !t.id.startsWith('chrome://') && !t.id.startsWith('chrome-extension://'),
          );
          if (validTabs.length === 0) return;

          const newMentions = validTabs.map(t => {
            const tabIdStr = String(t.id).replace('tab:', '');
            const tabTitle = t.label || 'Untitled';
            const truncated = tabTitle.length > 5 ? tabTitle.substring(0, 5) + '...' : tabTitle;
            return {
              token: '@' + truncated,
              tabId: tabIdStr,
              title: tabTitle,
              favIconUrl: t.favIconUrl,
            };
          });

          setMentionedTabs(prev => {
            const existingIds = new Set(prev.map(item => String(item.tabId)));
            const filteredNew = newMentions.filter(m => !existingIds.has(String(m.tabId)));
            return [...prev, ...filteredNew];
          });

          setTimeout(() => {
            const editable = inputRef.current;
            if (!editable) return;

            editable.focus();

            // 1. Traverse backwards to wipe trailing @ word
            let targetNode: Node | null = null;
            for (let i = editable.childNodes.length - 1; i >= 0; i--) {
              const child = editable.childNodes[i];
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.nodeValue || '';
                const match = text.match(/(^|\s)@([^@]*)$/);
                if (match) {
                  const matchIdx = match.index!;
                  const prefixSp = match[1];
                  child.nodeValue = text.slice(0, matchIdx + prefixSp.length);
                  targetNode = child;
                  break;
                }
              }
            }

            // 2. Iterate and append all visual pills
            let lastSpace: Text | null = null;
            validTabs.forEach(t => {
              const tabIdStr = String(t.id).replace('tab:', '');
              const tabTitle = t.label || 'Untitled';

              const pill = document.createElement('span');
              pill.className = `inline-flex items-center gap-1.5 mx-1 align-middle border rounded-lg px-2 py-0.5 text-xs font-medium shadow-sm ${isDarkMode
                ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
                : 'bg-[#eee8d5] border-[#93a1a1]/30 text-[#073642]'
                }`;
              pill.setAttribute('data-tab-id', tabIdStr);
              pill.setAttribute('contenteditable', 'false');

              if (t.favIconUrl) {
                const img = document.createElement('img');
                img.src = t.favIconUrl;
                img.className = 'w-3.5 h-3.5 object-contain rounded-sm';
                pill.appendChild(img);
              } else {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'w-3.5 h-3.5 flex items-center justify-center';
                iconDiv.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="text-blue-500" height="11" width="11" xmlns="http://www.w3.org/2000/svg"><path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 464c-114.687 0-208-93.313-208-208S141.313 48 256 48s208 93.313 208 208-93.313 208-208 208z"></path></svg>`;
                pill.appendChild(iconDiv);
              }

              const truncatedTitle = tabTitle.length > 5 ? tabTitle.substring(0, 5) + '...' : tabTitle;
              const textSpan = document.createElement('input');
              textSpan.type = 'text';
              textSpan.value = truncatedTitle;
              textSpan.readOnly = true;
              textSpan.className =
                'text-xs font-medium pointer-events-none bg-transparent border-none outline-none p-0 max-w-[55px] align-middle';
              textSpan.style.width = 'fit-content';
              textSpan.style.maxWidth = '60px';
              textSpan.style.color = 'inherit';
              textSpan.style.fontSize = '12px';
              textSpan.style.lineHeight = '1';
              pill.appendChild(textSpan);

              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.className =
                'text-red-300 hover:text-red-400 ml-0.5 cursor-pointer pointer-events-auto align-middle';
              removeBtn.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 352 512" height="8" width="8" xmlns="http://www.w3.org/2000/svg"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg>`;

              removeBtn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                pill.remove();
                setMentionedTabs(prev => prev.filter(item => String(item.tabId) !== String(tabIdStr)));
              };
              pill.appendChild(removeBtn);

              if (targetNode) {
                if (targetNode.nextSibling) {
                  editable.insertBefore(pill, targetNode.nextSibling);
                } else {
                  editable.appendChild(pill);
                }
              } else {
                editable.appendChild(pill);
              }

              // 4. Add Space afterwards for correct spacing
              const space = document.createTextNode('\u00A0');
              if (pill.nextSibling) {
                editable.insertBefore(space, pill.nextSibling);
              } else {
                editable.appendChild(space);
              }

              targetNode = space;
              lastSpace = space;
            });

            if (lastSpace) {
              const nextRange = document.createRange();
              nextRange.setStartAfter(lastSpace);
              nextRange.setEndAfter(lastSpace);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(nextRange);
            }

            // Sync prompt value buffers
            if (inlineComposerActive) {
              setCommandPrompt(editable.innerText || '');
            } else {
              setValue(editable.innerText || '');
            }
          }, 0);
          return;
        }

        if (commandId.startsWith('tab:')) {
          const tabId = commandId.replace('tab:', '');
          const tab = openTabs.find(t => String(t.id) === `tab:${tabId}`);
          if (tab) {
            const tabTitle = tab.label || 'Untitled';
            const truncated = tabTitle.substring(0, 5); // up to 5 characters
            const tokenStr = '@' + truncated;

            setMentionedTabs(prev => {
              const filtered = prev.filter(item => item.tabId !== tabId);
              return [...filtered, { token: tokenStr, tabId: tabId, title: tabTitle, favIconUrl: tab.favIconUrl }];
            });

            // Insert Inline Visual Pill at caret inside contenteditable div
            setTimeout(() => {
              const editable = inputRef.current;
              if (!editable) return;

              editable.focus();
              const selection = window.getSelection();
              const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

              // 1. Traverse backwards to find and wipe trailing @ word
              let targetNode: Node | null = null;
              for (let i = editable.childNodes.length - 1; i >= 0; i--) {
                const child = editable.childNodes[i];
                if (child.nodeType === Node.TEXT_NODE) {
                  const text = child.nodeValue || '';
                  const match = text.match(/(^|\s)@([^@]*)$/);
                  if (match) {
                    const matchIdx = match.index!;
                    const prefixSp = match[1];
                    child.nodeValue = text.slice(0, matchIdx + prefixSp.length);
                    targetNode = child;
                    break;
                  }
                }
              }

              // 2. Create Pill Element
              const pill = document.createElement('span');
              pill.className = `inline-flex items-center gap-1.5 mx-1 align-middle border rounded-lg px-2 py-0.5 text-xs font-medium shadow-sm ${isDarkMode
                ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
                : 'bg-[#eee8d5] border-[#93a1a1]/30 text-[#073642]'
                }`;
              pill.setAttribute('data-tab-id', tabId);
              pill.setAttribute('contenteditable', 'false');

              // Icon
              if (tab.favIconUrl) {
                const img = document.createElement('img');
                img.src = tab.favIconUrl;
                img.className = 'w-3.5 h-3.5 object-contain rounded-sm';
                pill.appendChild(img);
              } else {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'w-3.5 h-3.5 flex items-center justify-center';
                iconDiv.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="text-blue-500" height="11" width="11" xmlns="http://www.w3.org/2000/svg"><path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 464c-114.687 0-208-93.313-208-208S141.313 48 256 48s208 93.313 208 208-93.313 208-208 208z"></path></svg>`;
                pill.appendChild(iconDiv);
              }

              // Text
              const truncatedTitle = tabTitle.length > 5 ? tabTitle.substring(0, 5) + '...' : tabTitle;
              const textSpan = document.createElement('input');
              textSpan.type = 'text';
              textSpan.value = truncatedTitle;
              textSpan.readOnly = true;
              textSpan.className =
                'text-xs font-medium pointer-events-none bg-transparent border-none outline-none p-0 max-w-[55px] align-middle';
              // Force styles to override standard browser rules
              textSpan.style.width = 'fit-content';
              textSpan.style.maxWidth = '60px';
              textSpan.style.color = 'inherit';
              textSpan.style.fontSize = '12px';
              textSpan.style.lineHeight = '1';
              pill.appendChild(textSpan);

              // Remove Btn
              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.className =
                'text-red-300 hover:text-red-400 ml-0.5 cursor-pointer pointer-events-auto align-middle';
              removeBtn.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 352 512" height="8" width="8" xmlns="http://www.w3.org/2000/svg"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg>`;

              removeBtn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                pill.remove();
                setMentionedTabs(prev => prev.filter(t => String(t.tabId) !== String(tabId)));
              };
              pill.appendChild(removeBtn);

              // 3. Insert the pill
              if (targetNode) {
                if (targetNode.nextSibling) {
                  editable.insertBefore(pill, targetNode.nextSibling);
                } else {
                  editable.appendChild(pill);
                }
              } else if (range) {
                range.insertNode(pill);
              } else {
                editable.appendChild(pill);
              }

              // 4. Add Space afterwards
              const space = document.createTextNode('\u00A0');
              if (pill.nextSibling) {
                editable.insertBefore(space, pill.nextSibling);
              } else {
                editable.appendChild(space);
              }

              // 5. Move cursor safely
              const nextRange = document.createRange();
              nextRange.setStartAfter(space);
              nextRange.setEndAfter(space);
              selection?.removeAllRanges();
              selection?.addRange(nextRange);

              // Update inner text values
              if (inlineComposerActive) {
                setCommandPrompt(editable.innerText || '');
              } else {
                setValue(editable.innerText || '');
              }
            }, 0);
          }
          setShowAtCommandMenu(false);
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }

        const cursorPosition = inputRef.current?.selectionStart ?? value.length;

        // 0. Handle Prompt Selection (Expand)
        if (commandId.startsWith('prompt:')) {
          const promptId = commandId.replace('prompt:', '');
          const prompt = allPrompts.find(p => (p.id || p.snippet_id) === promptId);
          if (prompt) {
            const promptContent = typeof prompt.value === 'string' ? prompt.value : prompt.key;

            // User requested: "remove the text present"
            // REPLACE the entire input value with the prompt content
            if (lockedCommand && lockedCommand !== 'bookmarks') {
              setCommandPrompt(promptContent);
            } else {
              setValue(promptContent);
            }

            setShowAtCommandMenu(false);
            setAtCommandHighlightIndex(0);
            if (lockedCommand && lockedCommand !== 'bookmarks') {
              setTimeout(() => inlineInputRef.current?.focus(), 0);
            } else {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
            return;
          }
        }

        // 1. Resolve command definition
        // Check remote commands first
        const remoteCmd = commands.find(c => c.id === commandId);
        // Check local commands
        const localCmd = LOCAL_COMMANDS.find(c => c.id === commandId);

        // 2. Check if command is installed - if not, show dialog immediately
        // A command is considered "installed" if it's found in remote commands (user's storage),
        // or it's a local command, or it's the special 'ai' aggregate command
        const isInstalled = !!remoteCmd || !!localCmd || commandId === 'ai';
        if (!isInstalled) {
          // Command not installed - show dialog and clean up
          console.warn('[Searchbar] @ command not installed:', commandId);
          setShowAtCommandMenu(false);
          if (!isLoggedIn) {
            setLoginRequiredDialog({ isOpen: true, commandName: commandId });
          } else {
            setCommandNotInstalledDialog({ isOpen: true, commandName: commandId, commandId: commandId });
          }
          return;
        }

        // Helper to check if it needs query
        const requiresQuery = (cmd: CommandDefinition) => {
          if (cmd.urlTemplate && cmd.urlTemplate.includes('{query}')) return true;
          // AI commands usually need query
          if (['ai', 'gpt', 'claude', 'gemini', 'perplexity', 'calendar', 'chatwithsite'].includes(cmd.id)) return true;
          return false;
        };

        // Determine if we should enter command mode or execute immediately
        let shouldEnterMode = false;

        if (remoteCmd) {
          shouldEnterMode = requiresQuery(remoteCmd);
        } else if (commandId === 'ai') {
          shouldEnterMode = true;
        } else if (commandId === 'calendar' || (localCmd && localCmd.behavior === 'locked')) {
          // Special case: Calendar enters Locked Command mode directly
          // Also handle any other local command with 'locked' behavior (like upload_drive)
          setValue('');
          activateCommandById(commandId as AnyCommandId, '');
          setShowAtCommandMenu(false);
          return;
        }

        // Local commands: 'createnotes'/'createlinks' etc might want direct execution or mode?
        // existing logic used direct execution for 'createnotes', 'createlinks', 'bookmarks' etc.
        // Let's keep that pattern for specific local IDs.
        const directLocalCommands = [
          'createnotes',
          'createlinks',
          'showallnotes',
          'showalllinks',
          'createprompt',
          'bookmarks',
          'history',
          'downloads',
          'extensions',
          'settings',
          'switchorganization',
        ];

        if (directLocalCommands.includes(commandId)) {
          shouldEnterMode = false;
        }

        // Browser commands without query (history, downloads etc) are remote commands but dont have {query}
        // so requiresQuery() returns false -> shouldEnterMode = false. Correct.

        // If we are activating a different command, clear the AI session

        // Clean up the @ trigger text based on cursor position
        const textBeforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/(^|\s)@([^@]*)$/);
        let newValue = value;
        if (mentionMatch) {
          const matchIndex = mentionMatch.index!;
          const prefixSpace = mentionMatch[1]; // "" or " "
          newValue = (value.slice(0, matchIndex + prefixSpace.length) + value.slice(cursorPosition)).trim();
        }

        if (shouldEnterMode) {
          // Enter command mode (lock the command)
          setValue('');
          activateCommandById(commandId as AnyCommandId, newValue);
          setShowAtCommandMenu(false);
          // Focus input
          setTimeout(() => {
            if (prefixRef.current) {
              // If locking command, we might be switching to inline input
              // But activateCommandById handles focus logic
            }
          }, 0);
        } else {
          // Direct execution
          setValue(newValue);
          setShowAtCommandMenu(false);

          if (onCommandExecute) {
            handleLocalCommandExecute(commandId as any);
          } else {
            setValue('');
            setSelectedAtCommand(commandId);
            setShowAtCommandMenu(false);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
      },
      [
        value,
        setValue,
        handleLocalCommandExecute,
        commands,
        activateCommandById,
        allPrompts,
        isLoggedIn,
        onCommandExecute,
      ],
    );

    const snippetSearchResults = useMemo(() => {
      // Check for @ mention pattern: ends with @ followed by optional chars
      const atMentionMatch = value.match(/(?:^|\s)@([^/]*)$/);
      const isAtMention = Boolean(atMentionMatch);
      const atQuery = atMentionMatch ? atMentionMatch[1] : null;

      const trimmed = value.trim();
      const isShortcutQuery = value.startsWith('/');
      // Allow searching snippets when typing "/" to search by shortcuts
      // Only skip if lockedCommand is set AND it's not a "/" search
      // Also skip if @ command is selected (quick search mode)
      if (!isSnippetCommand && lockedCommand && !isShortcutQuery) return [];
      if (selectedAtCommand) return [];

      // Remove leading "/" for shortcut searches
      const searchQuery = isShortcutQuery ? trimmed.slice(1).trim() : trimmed;
      if (!searchQuery && !isSnippetCommand && !isShortcutQuery) {
        if (isInitialAltSFocus) {
          // [NEW] Return all snippets wrapped in SearchResult when Alt+S empty search is focused
          return snippetIndex.map(entry => ({ entry, score: 1 }));
        }
        return [];
      }

      // If we are in @ mention mode, we search specifically for prompts and snippets (Notes)
      // matching the text after @
      if (isAtMention && !lockedCommand && !selectedAtCommand) {
        return searchSnippets(snippetIndex, atQuery || '', {
          allowedCategories: new Set(['prompt', 'snippet']),
          limit: 20,
        });
      }

      if (
        ((!isSnippetCommand && lockedCommand && !isShortcutQuery) || (!trimmed && !isSnippetCommand)) &&
        !isInitialAltSFocus
      )
        return [];

      const allowedCategories =
        isSnippetCommand && activeSnippetCommandId
          ? new Set(
            (activeSnippetCommandId === 'delete_link' ? ['link', 'links', 'tabgroup', 'tab group'] : ['snippet']).map(
              entry => entry.toLowerCase(),
            ),
          )
          : undefined;

      return searchSnippets(snippetIndex, searchQuery, {
        allowedCategories,
        limit: 80,
        onlyShortcuts: value.startsWith('/'),
      });
    }, [snippetIndex, value, lockedCommand, isSnippetCommand, activeSnippetCommandId, isInitialAltSFocus]);

    const matchingSnippets: SnippetSuggestion[] = useMemo(() => {
      const allResults = snippetSearchResults.map(result => ({
        snippet: result.entry.snippet,
        workspace: result.entry.workspace,
        folder: result.entry.folder,
        isPersonal: result.entry.isPersonal,
        teamName: result.entry.teamName,
      }));

      // If a folder is selected, filter to show items from the ROOT folder and all its sub-folders
      // (not just the selected folder - we show all content from the root ancestor)
      if (selectedFolder && selectedTeam) {
        // Recursively collect all folder IDs from a folder and its sub-folders
        const collectFolderIds = (folder: Folder, folderIdSet: Set<string>): void => {
          folderIdSet.add(folder.folder_id);
          if (folder.folders && folder.folders.length > 0) {
            folder.folders.forEach(subFolder => {
              collectFolderIds(subFolder, folderIdSet);
            });
          }
        };

        // Build a set of all folder IDs from the ROOT folder that contains the selected folder
        const buildRootFolderIdSet = (): Set<string> => {
          const folderIdSet = new Set<string>();
          if (!selectedTeam?.workspaces) return folderIdSet;

          for (const workspace of selectedTeam.workspaces || []) {
            // Helper: search for the target folder and return its root (top-level) parent
            const findFolderAndGetRoot = (folders: Folder[], root: Folder): Folder | null => {
              for (const folder of folders) {
                if (folder.folder_id === selectedFolder.folder_id) {
                  return root; // Return the root folder, not the found folder
                }
                if (folder.folders && folder.folders.length > 0) {
                  const found = findFolderAndGetRoot(folder.folders, root);
                  if (found) return found;
                }
              }
              return null;
            };

            // For each top-level folder, search for the selected folder
            // If found, collect all IDs from that top-level folder (root)
            for (const topLevelFolder of workspace.folders || []) {
              const rootFolder = findFolderAndGetRoot([topLevelFolder], topLevelFolder);
              if (rootFolder) {
                collectFolderIds(rootFolder, folderIdSet);
                return folderIdSet; // Found it, return immediately
              }
            }
          }

          return folderIdSet;
        };

        const rootFolderIds = buildRootFolderIdSet();

        return allResults
          .filter(item => {
            // Allow all snippets when typing / as shortcuts should be global
            // Also allow all personal snippets even when a folder is selected in an org
            if (value.startsWith('/') || item.isPersonal) return true;

            // Item must have a folder and it must be in the root folder or one of its descendants
            if (!item.folder || !item.folder.folder_id) {
              return false;
            }
            return rootFolderIds.has(item.folder.folder_id);
          })
          .sort((a, b) => {
            if (a.isPersonal && !b.isPersonal) return -1;
            if (!a.isPersonal && b.isPersonal) return 1;
            return 0;
          });
      }

      return allResults.sort((a, b) => {
        if (a.isPersonal && !b.isPersonal) return -1;
        if (!a.isPersonal && b.isPersonal) return 1;
        return 0;
      });
    }, [snippetSearchResults, selectedFolder, selectedTeam]);

    const snippetEntitySuggestions = useMemo(() => {
      if (!isSnippetCommand || !activeSnippetCommandId) return [];
      const allowedCategories =
        activeSnippetCommandId === 'delete_link'
          ? new Set(['link', 'links', 'tabgroup', 'tab group'])
          : new Set(['snippet']);
      return matchingSnippets
        .filter(item => allowedCategories.has((item.snippet.category || '').toLowerCase()))
        .map(item => ({
          _kind: 'snippet' as const,
          snippet: item.snippet,
          workspace: item.workspace,
          folder: item.folder,
        }));
    }, [activeSnippetCommandId, isSnippetCommand, matchingSnippets]);

    const generalSnippetSuggestions = useMemo<SuggestionListItem[]>(() => {
      return matchingSnippets.map(item => ({
        _kind: 'snippet' as const,
        snippet: item.snippet,
        workspace: item.workspace,
        folder: item.folder,
        isPersonal: item.isPersonal,
        teamName: item.teamName,
      }));
    }, [matchingSnippets]);

    const commonCommandSuggestions = useMemo<CommonCommandSuggestionItem[]>(() => {
      const isShortcutQuery = value.startsWith('/');
      const trimmed = trimQuery(value);
      const searchQuery = isShortcutQuery ? trimmed.slice(1).trim() : trimmed;
      // Allow empty query if files are selected (for AI fallback suggestions)
      if ((!searchQuery && selectedImages.length === 0) || (lockedCommand && !isShortcutQuery)) return [];
      return commonCommandEntries.map(entry => ({
        _kind: 'common_command' as const,
        id: entry.command.id,
        label: entry.label,
        description: entry.description,
        command: entry.command,
        query: searchQuery,
      }));
    }, [commonCommandEntries, value, lockedCommand, selectedImages.length]);

    // History cache ref for Fuse.js search
    const [historyItems, setHistoryItems] = useState<HistoryItem[] | null>(null);
    const isFetchingHistoryRef = useRef<boolean>(false);

    // Effect to prefetch history when search focus is enabled
    useEffect(() => {
      if (!isSearchFocusEnabled) {
        setHistoryItems(null);
        isFetchingHistoryRef.current = false;
        return;
      }

      // If we already have historyItems, don't fetch again
      if (historyItems || isFetchingHistoryRef.current) return;

      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.runtime?.sendMessage) return;

      isFetchingHistoryRef.current = true;
      // Fetch only recent history for lower noise and faster scoring.
      chromeAny.runtime.sendMessage(
        { action: 'history_search', query: '', maxResults: 2000, includeFrecency: true, halfLifeHours: 2 },
        (response: any) => {
          isFetchingHistoryRef.current = false;
          if (response?.ok && Array.isArray(response.results)) {
            const items: HistoryItem[] = response.results.map((item: any) => ({
              id: item.id || item.url,
              title: item.title || item.url || '',
              url: item.url || '',
              lastVisitTime: item.lastVisitTime || 0,
              visitCount: item.visitCount || 0,
              frecencyScore: typeof item.frecencyScore === 'number' ? item.frecencyScore : undefined,
            }));

            // Pre-index history for instant search results
            preIndexHistory(items);
            setHistoryItems(items);
          }
        },
      );
    }, [historyItems, isSearchFocusEnabled]);

    // Bookmark search ref for tracking latest search
    const bookmarkSearchRef = useRef<number>(0);

    // Effect to search bookmarks based on user input
    useEffect(() => {
      const isShortcutQuery = value.startsWith('/');
      const trimmed = isShortcutQuery ? value.slice(1).trim() : value.trim();

      // Only search bookmarks when:
      // 1. There's a query with at least 2 characters but not more than 17 (to prevent lag), OR isInitialAltSFocus is true
      // 2. Not in command mode (no '/') OR explicitly in shortcut search mode
      // 3. No command is locked (unless it's a shortcut search)
      // 4. No @ command is selected
      const isAllowedEmpty = isInitialAltSFocus && !trimmed;
      if (
        (!isAllowedEmpty && (!trimmed || trimmed.length < 2 || trimmed.length > 17)) ||
        (lockedCommand && !isShortcutQuery) ||
        selectedAtCommand
      ) {
        if (!isInitialAltSFocus) {
          setBookmarkSuggestions([]);
        }
        return;
      }

      const searchId = ++bookmarkSearchRef.current;
      const chromeAny = (window as any)?.chrome;

      if (!chromeAny?.runtime?.sendMessage) {
        return;
      }

      // Debounce the search with a small delay
      const timeoutId = window.setTimeout(() => {
        const action = trimmed ? 'bookmarks_search' : 'bookmarks_get_tree';
        const payload = trimmed ? { action, query: trimmed } : { action };

        chromeAny.runtime.sendMessage(payload, (response: any) => {
          // Check if this is still the latest search request
          if (searchId !== bookmarkSearchRef.current) return;

          if (response?.ok && Array.isArray(response.results)) {
            const items: BookmarkSuggestionItem[] = response.results.map((item: any) => ({
              _kind: 'bookmark' as const,
              id: item.id || item.url,
              title: item.title || item.url || '',
              url: item.url || '',
            }));
            setBookmarkSuggestions(items);
          } else {
            setBookmarkSuggestions([]);
          }
        });
      }, 150); // 150ms debounce

      return () => window.clearTimeout(timeoutId);
    }, [value, lockedCommand, isInitialAltSFocus]);

    const handleAgentCollectionSelect = useCallback(
      (item: AgentCollectionSuggestionItem) => {
        
        try {
          const chromeAny = (window as any).chrome;
          if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
            chromeAny.storage.local.get([item.title], (result: any) => {
              const items = result[item.title];
              

              if (items && Array.isArray(items)) {
                // 1. Identify unique prompt parameters and remap paste steps
                const paramRegex = /(?:\{|\[|%7B)([^}\]]+)(?:\}|\]|%7D)/gi;
                const uniqueParams = new Set<string>();
                const paramSourceMap = new Map<string, { item: any; localId: string; config?: any }>();
                let hasQuery = false;
                let globalPasteCount = 1;

                // Helper: extract clean param name from {input_name="xxx"} â†’ "xxx"
                const cleanParamName = (raw: string): string => {
                  const m = raw.match(/^input_name="([^"]+)"$/);
                  return m ? m[1] : raw;
                };

                // Process items to inject unique paste variables
                const processedItems = items.map((item: any) => {
                  const newItem = { ...item }; // Shallow copy

                  // Check Agents and Links for {query}, {content} or {variable}
                  if (newItem.url) {
                    const matches = newItem.url.matchAll(paramRegex);
                    for (const match of matches) {
                      const varName = cleanParamName(match[1]).toLowerCase();
                      if (varName === 'query' || varName === 'content' || varName === 'prompt') {
                        hasQuery = true;
                      } else {
                        // Extract number if it's promptN
                        const pMatch = varName.match(/^prompt(\d+)$/);
                        const key = pMatch ? pMatch[1] : match[1];
                        uniqueParams.add(key);
                        paramSourceMap.set(key, { item: newItem, localId: key, config: newItem });
                      }
                    }
                    if (
                      newItem.url.includes('{query}') ||
                      newItem.url.includes('[query]') ||
                      newItem.url.includes('{content}')
                    ) {
                      hasQuery = true;
                    }
                  }

                  // Check Automations for {content}, {query}, or {variable}
                  // REMAP paste steps to unique {pasteN} variables
                  if ((newItem.type === 'automation' || newItem.steps) && Array.isArray(newItem.steps)) {
                    let localPasteCount = 1;
                    newItem.steps = newItem.steps.map((step: any, index: number) => {
                      if (step.type === 'paste' || step.moduleId === 'paste') {
                        // FORCE unique variable for every paste step
                        const pasteVar = `paste${globalPasteCount}`;
                        const localId = `paste${localPasteCount}`;
                        uniqueParams.add(pasteVar);
                        paramSourceMap.set(pasteVar, { item: newItem, localId });
                        globalPasteCount++;
                        localPasteCount++;

                        // Update config to use this variable
                        return {
                          ...step,
                          config: { ...step.config, text: `{${pasteVar}}` },
                        };
                      }

                      // Extract variables from open_tab URLs without remapping
                      if (step.type === 'open_tab' || step.moduleId === 'open_tab') {
                        const config = step.config || {};
                        const url = config.url || '';
                        if (typeof url === 'string') {
                          const urlMatches = url.matchAll(paramRegex);
                          for (const match of urlMatches) {
                            const varName = cleanParamName(match[1]);
                            const lowerVar = varName.toLowerCase();
                            if (lowerVar === 'query' || lowerVar === 'content' || lowerVar === 'prompt') {
                              hasQuery = true;
                            } else {
                              uniqueParams.add(varName);
                              paramSourceMap.set(varName, { item: newItem, localId: varName, config });
                            }
                          }
                        }
                      }

                      // Ignore variables in other steps to prevent JSON matching false positives
                      return step;
                    });
                  }

                  if (newItem.promptLabel) {
                    const match = newItem.promptLabel.match(/prompt(\d+)/i);
                    const key = match && match[1] ? match[1] : newItem.promptLabel;
                    uniqueParams.add(key);
                    paramSourceMap.set(key, { item: newItem, localId: key });
                  }

                  if (newItem.supportImage) {
                    uniqueParams.add('images');
                    paramSourceMap.set('images', { item: newItem, localId: 'images' });
                  }

                  return newItem;
                });

                const sortedParams = Array.from(uniqueParams).sort((a, b) => {
                  // Sort numbers numerically, strings alphabetically
                  const numA = parseInt(a.replace(/\D/g, ''));
                  const numB = parseInt(b.replace(/\D/g, ''));
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  return a.localeCompare(b);
                });
                

                // Build fields array
                const fields: SearchbarAutomationField[] = sortedParams.map(p => {
                  const isDigit = /^\d+$/.test(p);
                  const key = isDigit ? `prompt${p}` : p;

                  // Find the agent that corresponds to this parameter
                  const source = paramSourceMap.get(p);
                  const matchedAgent = source?.item || processedItems.find((item: any) => item.promptLabel === key);
                  const localId = source?.localId || key;

                  let initialValue = '';
                  let dropdownOptions: string[] | undefined = undefined;
                  let dropdownOptionPairs: { key: string; value: string }[] | undefined = undefined;
                  let paramType: string | undefined;
                  let paramDescription: string | undefined;

                  if (matchedAgent) {
                    // 1. Try to find config in 'inputs' array using localId (for Automations)
                    if (matchedAgent.inputs && Array.isArray(matchedAgent.inputs)) {
                      const inputDef = matchedAgent.inputs.find((i: any) => i.id === localId);
                      if (inputDef) {
                        if (inputDef.fixedValue) initialValue = inputDef.fixedValue;
                        if (inputDef.description) paramDescription = inputDef.description;
                        if (inputDef.dropdownOptions)
                          dropdownOptions = inputDef.dropdownOptions
                            .split(',')
                            .map((s: string) => s.trim())
                            .filter(Boolean);
                      }
                    }

                    // 2. Fallback to top-level properties (Legacy/Agents) if not found in inputs
                    if (!initialValue && !dropdownOptions) {
                      if (matchedAgent.fixedValue) {
                        initialValue = matchedAgent.fixedValue;
                      }

                      if (matchedAgent.dropdownOptions) {
                        const options = matchedAgent.dropdownOptions
                          .split(',')
                          .map((opt: string) => opt.trim())
                          .filter(Boolean);

                        if (options.length > 0) {
                          dropdownOptions = options;
                        }
                      }
                    }

                    // 3. New API check: step.config.paramConfigs matching param
                    if (source?.config?.paramConfigs?.[localId]) {
                      const paramCfg = source.config.paramConfigs[localId];
                      paramType = paramCfg.type;
                      if (paramCfg.description) paramDescription = String(paramCfg.description);
                      if (paramCfg.type === 'dropdown') {
                        dropdownOptions = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                        dropdownOptionPairs = Array.isArray(paramCfg.optionPairs)
                          ? paramCfg.optionPairs
                            .map((pair: any, idx: number) => ({
                              key: String(pair?.key || '').trim() || `Option ${idx + 1}`,
                              value: String(pair?.value || '').trim(),
                            }))
                            .filter((pair: { key: string; value: string }) => !!pair.value)
                          : undefined;
                      } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                        initialValue = paramCfg.values[0];
                      }
                    }

                    // If we have options but no value, default to first option
                    if (dropdownOptions && dropdownOptions.length > 0 && !initialValue) {
                      initialValue = dropdownOptions[0];
                    }
                  }

                  const isImages = p === 'images';
                  const rawType = String(
                    paramType || matchedAgent?.inputs?.find((i: any) => i.id === localId)?.type || 'text',
                  );
                  const sourceType = normalizeAutomationSourceType(rawType);
                  let normalizedFieldType = normalizeAutomationFieldType(rawType);
                  if (normalizedFieldType === 'text' && dropdownOptions && dropdownOptions.length > 0) {
                    normalizedFieldType = 'dropdown';
                  }

                  return {
                    key: key,
                    label: isImages
                      ? 'Image Attachment'
                      : isDigit
                        ? `Prompt ${p}`
                        : p.charAt(0).toUpperCase() +
                        p
                          .slice(1)
                          .replace(/([A-Z0-9])/g, ' $1')
                          .trim(),
                    value: initialValue,
                    type: (isImages ? 'image' : normalizedFieldType) as any,
                    sourceType: isImages ? 'image' : sourceType,
                    description: paramDescription,
                    extraValues: [],
                    dropdownOptions: dropdownOptions,
                    dropdownOptionPairs,
                  };
                });

                // Ensure 'query' field exists if needed
                const hasQueryField = fields.some(f => f.key === 'query');
                if (hasQuery && !hasQueryField) {
                  // Find if any matched agent/link explicitly provides query input/dropdown
                  let queryValue = '';
                  let queryDropdown: string[] | undefined = undefined;

                  // In Agent Collections, the query parameter is typically from a link
                  const querySourceItem = processedItems.find(
                    (i: any) =>
                      i.url && (i.url.includes('{query}') || i.url.includes('[query]') || i.url.includes('{content}')),
                  );

                  if (querySourceItem) {
                    // Start reading from querySourceItem config natively
                    let queryConfig: any = querySourceItem;
                    if (querySourceItem.steps && Array.isArray(querySourceItem.steps)) {
                      const tabStep = querySourceItem.steps.find(
                        (s: any) => s.moduleId === 'open_tab' && s.config?.url && s.config.url.includes('{query}'),
                      );
                      if (tabStep) queryConfig = tabStep.config;
                    }

                    if (queryConfig?.paramConfigs?.['query']) {
                      const paramCfg = queryConfig.paramConfigs['query'];
                      if (paramCfg.type === 'dropdown') {
                        queryDropdown = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                      } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                        queryValue = paramCfg.values[0];
                      }
                    } else if (querySourceItem.inputs && Array.isArray(querySourceItem.inputs)) {
                      const inputDef =
                        querySourceItem.inputs.find((i: any) => i.id === 'query' || i.id === 'content') ||
                        querySourceItem.inputs[0];
                      if (inputDef) {
                        if (inputDef.fixedValue) queryValue = inputDef.fixedValue;
                        if (inputDef.dropdownOptions) {
                          queryDropdown = inputDef.dropdownOptions
                            .split(',')
                            .map((s: string) => s.trim())
                            .filter(Boolean);
                        }
                      }
                    } else {
                      if (querySourceItem.fixedValue) queryValue = querySourceItem.fixedValue;
                      if (querySourceItem.dropdownOptions) {
                        queryDropdown = querySourceItem.dropdownOptions
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean);
                      }
                    }
                  }

                  if (queryDropdown && queryDropdown.length > 0 && !queryValue) {
                    queryValue = queryDropdown[0];
                  }

                  fields.push({
                    key: 'query',
                    label: 'Query',
                    value: queryValue,
                    type: 'text',
                    sourceType: 'text',
                    description: undefined,
                    extraValues: [],
                    dropdownOptions: queryDropdown,
                    dropdownOptionPairs: undefined,
                  });
                }

                // Default to Prompt 1 if no fields (user preference)
                if (fields.length === 0) {
                  fields.push({
                    key: 'prompt1',
                    label: 'Prompt 1',
                    value: '',
                    type: 'text',
                    sourceType: 'text',
                    description: undefined,
                    extraValues: [],
                    dropdownOptions: undefined,
                    dropdownOptionPairs: undefined,
                  });
                }

                // Enter Lock Mode with new structure
                setActiveCollection({
                  item: item, // Use original item without modification
                  agents: processedItems.filter((i: any) => i.type === 'agent' || !i.type), // Backward compatibility
                  links: processedItems.filter((i: any) => i.type === 'link'),
                  automations: processedItems.filter((i: any) => i.type === 'automation'),
                  fields,
                  constantInputs: {},
                  focusedFieldIndex: 0,
                });

                setLockedCommand(null);
                setValue('');
                setCommandPrompt('');
                setHighlightIndex(0);
                suggestionVisibilityRef.current = false;
                setIsFocused(true);
              }
            });
          }
        } catch (e) {
          console.error('[Searchbar] Failed to open agent collection', e);
        }
      },
      [currentTabId],
    );

    const handleAutomationSelect = useCallback(
      (automation: any) => {
        
        
        let typedText = value || queryValue || inputRef.current?.value || '';

        // Extract query by removing the automation name/shortcut keywords that triggered it
        const words = typedText.trim().split(/\s+/);
        const triggerWords = [
          automation.name,
          automation.label,
          (automation.shortcuts || '').replace('/', '')
        ].filter(Boolean);

        const filteredWords = words.filter(word => {
          const normalizedWord = word.toLowerCase();
          return !triggerWords.some(trigger => 
            trigger.toLowerCase().startsWith(normalizedWord) || 
            normalizedWord.startsWith(trigger.toLowerCase())
          );
        });
        typedText = filteredWords.join(' ').trim();
        try {
          // Normalize structure â€” convert automation_steps to steps if needed
          const normalizeStep = (step: any, index: number): any => {
            const rawSubSteps = Array.isArray(step?.subSteps) ? step.subSteps : step?.sub_steps || [];
            return {
              ...step,
              id: step?.id ? String(step.id) : `step-${index + 1}`,
              moduleId: String(
                step?.moduleId || step?.module_id || step?.module || step?.module_key || step?.type || '',
              ),
              config: step?.config || step?.params || step?.parameters || {},
              subSteps: Array.isArray(rawSubSteps)
                ? rawSubSteps.map((subStep: any, subIndex: number) => normalizeStep(subStep, subIndex))
                : [],
            };
          };

          const rawSteps = Array.isArray(automation?.steps)
            ? automation.steps
            : Array.isArray(automation?.automation_steps)
              ? automation.automation_steps
              : [];

          const newItem = {
            ...automation,
            id: String(automation?.id || automation?.automation_id || automation?.name || 'automation'),
            type: 'automation' as const,
            steps: rawSteps.map((step: any, index: number) => normalizeStep(step, index)),
            inputs: automation?.inputs || automation?.automation_inputs || [],
          };

          const inputTypeHints = buildInputTypeHints(Array.isArray(newItem.steps) ? newItem.steps : []);
          const constantInputs = collectConstantInputsFromSteps(Array.isArray(newItem.steps) ? newItem.steps : []);

          // Clear the search bar text so the results disappear when showing inputs
          setValue('');
          setQueryValue('');
          if (inputRef.current) inputRef.current.value = '';

          let fields: SearchbarAutomationField[] = [];
          const cloudInputDefinitions = Array.isArray(newItem.steps)
            ? newItem.steps.flatMap((step: any, index: number) => extractCloudModuleInputDefinitions(step, index))
            : [];

          // STRATEGY 1: Use pre-saved inputs array if it exists (most reliable)
          if (newItem.inputs && Array.isArray(newItem.inputs) && newItem.inputs.length > 0) {
            

            // Build a map: paramKey â†’ urlTemplate (only for open_tab / agent steps)
            const paramUrlTemplateMap = new Map<string, string>();
            if (Array.isArray(newItem.steps)) {
              const paramRegexS1 = /\{input_name="([^"]+)"\}|\{([^}\s"=)]+)\}/g;
              newItem.steps.forEach((step: any) => {
                const isUrlStep = step.moduleId === 'open_tab' || step.moduleId === 'agent';
                if (!isUrlStep) return;
                const urlTmpl: string = step.config?.url || '';
                if (!urlTmpl) return;
                // Extract every {variable} from the URL template
                let m: RegExpExecArray | null;
                const re = new RegExp(paramRegexS1.source, 'g');
                while ((m = re.exec(urlTmpl)) !== null) {
                  const varName = m[1] || m[2];
                  if (varName && !paramUrlTemplateMap.has(varName)) {
                    paramUrlTemplateMap.set(varName, urlTmpl);
                  }
                }
              });
            }

            const mergedInputDefinitions = mergeAutomationInputDefinitions(cloudInputDefinitions, newItem.inputs);
            fields = mapAutomationInputDefinitionsToFields(mergedInputDefinitions, paramUrlTemplateMap, inputTypeHints);
          }

          // STRATEGY 2: Fallback â€” scan step configs for {variable} patterns
          // Also scans agent promptLabel and sub_automation inputs recursively
          if (fields.length === 0) {
            
            const paramRegex = /(?:\{|\[|%7B)([^\}\]]+)(?:\}|\]|%7D)/gi;
            const uniqueParams = new Set<string>();
            const paramSourceMap = new Map<
              string,
              {
                item: any;
                localId: string;
                config?: any;
                variableDef?: any;
                inputDef?: Partial<AutomationInputDefinition>;
              }
            >();
            // Map from param key â†’ url template of its source step (only for url-based steps)
            const paramUrlTemplateMapS2 = new Map<string, string>();
            let hasQuery = false;
            let queryStepConfig: any = null;
            let queryStepUrl: string | undefined = undefined;
            // Track paste steps that use query/content/prompt so we can create unique fields
            const pasteQuerySteps: { stepIndex: number; varName: string; config: any; elementName?: string }[] = [];
            const scopedInputIds = new Set<string>();

            // Helper: extract clean param name from {input_name="xxx"} â†’ "xxx", or return as-is
            const cleanParamName = (raw: string): string => {
              const m = raw.match(/^input_name="([^"]+)"$/);
              return m ? m[1] : raw;
            };
            const isLikelySelectorToken = (raw: string): boolean => /[="'\s]/.test(raw);

            // Recursive step scanner that handles sub_automations and agents
            const scanSteps = (steps: any[]) => {
              steps.forEach((step: any, stepIndex: number) => {
                // Handle cloud modules FIRST â€” they define their own variables explicitly
                // and we must NOT let the generic regex scanner parse their execution_steps
                if (step.config?.isCloudModule && Array.isArray(step.config.variables)) {
                  extractCloudModuleInputDefinitions(step, stepIndex).forEach((inputDef: AutomationInputDefinition) => {
                    const varName = inputDef.id || inputDef.label;
                    if (!varName || uniqueParams.has(varName)) return;

                    uniqueParams.add(varName);
                    paramSourceMap.set(varName, {
                      item: newItem,
                      localId: varName,
                      config: step.config,
                      variableDef: step.config.variables.find((v: any) => (v.key || v.name) === varName),
                      inputDef,
                    });

                    if (inputDef.urlTemplate && !paramUrlTemplateMapS2.has(varName)) {
                      paramUrlTemplateMapS2.set(varName, inputDef.urlTemplate);
                    }
                  });
                  return; // Skip generic scanning for cloud modules
                }

                const isUrlStep = step.moduleId === 'open_tab' || step.moduleId === 'agent';
                const isPasteStep = step.type === 'paste' || step.moduleId === 'paste';

                // Handle paste and open_tab variable patterns
                if (
                  step.type === 'paste' ||
                  step.moduleId === 'paste' ||
                  step.type === 'open_tab' ||
                  step.moduleId === 'open_tab'
                ) {
                  const config = step.config || {};
                  // For URL steps, capture the url template string for later use
                  const stepUrlTmpl: string = isUrlStep ? config.url || '' : '';

                  Object.values(config).forEach((val: any) => {
                    if (typeof val === 'string') {
                      const matches = val.matchAll(paramRegex);
                      for (const match of matches) {
                        const varName = cleanParamName(match[1]);
                        if (isLikelySelectorToken(varName)) {
                          return;
                        }
                        const lowerVar = varName.toLowerCase();

                        if (lowerVar === 'query' || lowerVar === 'content' || lowerVar === 'prompt') {
                          hasQuery = true;
                          if (!queryStepConfig) queryStepConfig = config;
                          if (!queryStepUrl && isUrlStep) queryStepUrl = stepUrlTmpl;
                          // Track paste steps individually so we can create per-step fields
                          if (isPasteStep) {
                            const scopedId = `${varName}__paste_step_${stepIndex}`;
                            if (scopedInputIds.has(scopedId)) {
                              return;
                            }
                            scopedInputIds.add(scopedId);
                            pasteQuerySteps.push({
                              stepIndex,
                              varName,
                              config,
                              elementName: config.selectorElementName || config.name || '',
                            });
                          }
                        } else {
                          uniqueParams.add(varName);
                          paramSourceMap.set(varName, { item: newItem, localId: varName, config });
                          // Only record url template for url-based steps (not paste)
                          if (isUrlStep && stepUrlTmpl && !paramUrlTemplateMapS2.has(varName)) {
                            paramUrlTemplateMapS2.set(varName, stepUrlTmpl);
                          }
                        }
                      }
                    }
                  });

                  // Extract ALL parameters from paramConfigs for ALL step types
                  // This ensures that all defined parameters are shown, even if not referenced in content
                  if (config.paramConfigs && typeof config.paramConfigs === 'object') {
                    Object.keys(config.paramConfigs).forEach((paramKey: string) => {
                      if (paramKey) {
                        // Use scoped key per step so multiple steps can have the same param name (e.g., input1)
                        const scopedParamKey = `${paramKey}__paste_step_${stepIndex}`;
                        if (!uniqueParams.has(scopedParamKey)) {
                          uniqueParams.add(scopedParamKey);
                          // Mark this param with step index so we can group it later
                          const paramSourceEntry: any = { item: newItem, localId: paramKey, config };
                          paramSourceEntry._pasteStepIndex = stepIndex; // Track which step this came from
                          paramSourceMap.set(scopedParamKey, paramSourceEntry);
                        }
                      }
                    });
                  }
                }

                // Handle agent steps â€” extract promptLabel as an input
                if (step.moduleId === 'agent') {
                  const promptLabel = step.config?.promptLabel;
                  const agentUrl: string = step.config?.url || '';
                  if (promptLabel && !uniqueParams.has(promptLabel)) {
                    uniqueParams.add(promptLabel);
                    paramSourceMap.set(promptLabel, { item: newItem, localId: promptLabel });
                    if (agentUrl && !paramUrlTemplateMapS2.has(promptLabel)) {
                      paramUrlTemplateMapS2.set(promptLabel, agentUrl);
                    }
                  }
                }

                // Handle sub_automation steps â€” recurse into their steps
                if (step.moduleId === 'sub_automation' && step.config) {
                  // Collect from sub_automation's saved inputs
                  if (step.config.inputs && Array.isArray(step.config.inputs)) {
                    step.config.inputs.forEach((inputDef: any) => {
                      const inputId = inputDef.id || inputDef.label;
                      if (inputId && !uniqueParams.has(inputId)) {
                        uniqueParams.add(inputId);
                        paramSourceMap.set(inputId, { item: newItem, localId: inputId });
                      }
                    });
                  }
                  // Recurse into sub_automation steps
                  if (Array.isArray(step.config.steps)) {
                    scanSteps(step.config.steps);
                  }
                }
              });
            };

            if (Array.isArray(newItem.steps)) {
              scanSteps(newItem.steps);
            }

            const sortedParams = Array.from(uniqueParams).sort((a, b) => {
              const numA = parseInt(a.replace(/\D/g, ''));
              const numB = parseInt(b.replace(/\D/g, ''));
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
              return a.localeCompare(b);
            });

            fields = sortedParams.map(p => {
              const source = paramSourceMap.get(p);
              const vDef = (source as any)?.variableDef;
              const groupedInputDef = source?.inputDef;
              // For scoped keys, localId contains the original parameter name
              const originalParamKey = (source as any)?.localId || p;

              let initialValue = '';
              let dropdownOptions: string[] | undefined = undefined;
              let dropdownOptionPairs: { key: string; value: string }[] | undefined = undefined;
              let label = groupedInputDef?.label || p;
              let description: string | undefined = groupedInputDef?.description;

              // Use cloud module variable definition if available
              if (vDef) {
                label = groupedInputDef?.label || vDef.label || vDef.key || vDef.name;
                initialValue = source?.config?.[originalParamKey] || vDef.fixedValue || '';
                if (vDef.description && !description) description = String(vDef.description);
                if (vDef.type === 'dropdown' && Array.isArray(vDef.values)) {
                  dropdownOptions = vDef.values;
                }
              }

              let paramType: string | undefined;
              if (source?.config?.paramConfigs?.[originalParamKey]) {
                const paramCfg = source.config.paramConfigs[originalParamKey];
                paramType = paramCfg.type;
                if (paramCfg.displayName) {
                  label = String(paramCfg.displayName);
                }
                if (paramCfg.description) {
                  description = String(paramCfg.description);
                }
                if (paramCfg.type === 'dropdown') {
                  dropdownOptions = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                  dropdownOptionPairs = Array.isArray(paramCfg.optionPairs)
                    ? paramCfg.optionPairs
                      .map((pair: any, idx: number) => ({
                        key: String(pair?.key || '').trim() || `Option ${idx + 1}`,
                        value: String(pair?.value || '').trim(),
                      }))
                      .filter((pair: { key: string; value: string }) => !!pair.value)
                    : undefined;
                } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                  initialValue = paramCfg.values[0];
                }
              }
              if (label === p && source?.config?.selectorElementName) {
                const selectorLabel = String(source.config.selectorElementName || '').trim();
                const lowerSelectorLabel = selectorLabel.toLowerCase();
                if (selectorLabel && !['div', 'span', 'input', 'textarea', 'button'].includes(lowerSelectorLabel)) {
                  label = selectorLabel;
                }
              }

              if (dropdownOptions && dropdownOptions.length > 0 && !initialValue) {
                initialValue = dropdownOptions[0];
              }

              const rawType = String(
                groupedInputDef?.type || paramType || vDef?.type || inputTypeHints.get(originalParamKey) || '',
              );
              let fieldType = normalizeAutomationFieldType(rawType);
              if (fieldType === 'text' && dropdownOptions) {
                fieldType = 'dropdown';
              }
              const inputStyle = getInputStyleFromType(rawType);

              // Determine grouping for paste step parameters
              let fieldGroupId = groupedInputDef?.groupId || p;
              let fieldGroupLabel = groupedInputDef?.groupLabel;

              // If this parameter came from a paste step's paramConfigs, group it with that step
              const pasteStepIndex = (source as any)?._pasteStepIndex;
              if (pasteStepIndex !== undefined) {
                fieldGroupId = `paste_step_${pasteStepIndex}`;
                fieldGroupLabel = `Step ${pasteStepIndex + 1} - Paste Input`;
              }

              // For scoped keys like "input1__paste_step_0", extract the original param name for display
              const displayLabel = p.includes('__paste_step_') ? p.split('__paste_step_')[0] : label;

              // Extract the source variable name and step index from scoped keys
              let sourceVarName = undefined;
              let sourceStepIdx = undefined;
              if (p.includes('__paste_step_')) {
                const scopedMatch = p.match(/^(.+?)__paste_step_(\d+)$/);
                if (scopedMatch) {
                  sourceVarName = scopedMatch[1];
                  sourceStepIdx = parseInt(scopedMatch[2], 10);
                }
              }

              return {
                key: p,
                label: formatAutomationFieldLabel(displayLabel),
                value: initialValue,
                type: fieldType as any,
                sourceType: normalizeAutomationSourceType(rawType),
                description,
                inputStyle,
                extraValues: [],
                dropdownOptions: dropdownOptions,
                dropdownOptionPairs,
                urlTemplate: groupedInputDef?.urlTemplate || paramUrlTemplateMapS2.get(p),
                groupId: fieldGroupId,
                groupLabel: fieldGroupLabel,
                groupSelector: groupedInputDef?.groupSelector,
                groupAction: groupedInputDef?.groupAction,
                order: groupedInputDef?.order,
                sourceVariable: sourceVarName,
                sourceStepIndex: sourceStepIdx,
              };
            });

            if (hasQuery && !fields.some(f => f.key === 'query')) {
              // If multiple paste steps, only show their scoped parameters and suppress all other generic fields
              if (pasteQuerySteps.length > 1) {
                // Keep ONLY the scoped paste step fields we're about to add
                // Remove everything else (including "search", "news", etc.)
                fields = fields.filter(field => field.key.includes('__paste_step_'));

                pasteQuerySteps.forEach((pStep, pIdx) => {
                  const uniqueKey = `${pStep.varName}__paste_step_${pStep.stepIndex}`;
                  const label = pStep.elementName ? formatAutomationFieldLabel(pStep.elementName) : `Input ${pIdx + 1}`;
                  const queryInputStyle: 'short_text' | 'long_text' | undefined =
                    inputTypeHints.get(pStep.varName) || inputTypeHints.get('query');
                  let initialValue = '';
                  let dropdownOptions: string[] | undefined;
                  let dropdownOptionPairs: { key: string; value: string }[] | undefined;
                  if (pStep.config?.paramConfigs?.[pStep.varName]) {
                    const paramCfg = pStep.config.paramConfigs[pStep.varName];
                    if (paramCfg.type === 'dropdown') {
                      dropdownOptions = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                      dropdownOptionPairs = Array.isArray(paramCfg.optionPairs) ? paramCfg.optionPairs : undefined;
                    } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                      initialValue = paramCfg.values[0];
                    }
                  }
                  if (dropdownOptions && dropdownOptions.length > 0 && !initialValue) {
                    initialValue = dropdownOptions[0];
                  }
                  fields.push({
                    key: uniqueKey,
                    label,
                    value: initialValue,
                    type: dropdownOptions ? 'dropdown' : 'text',
                    sourceType: 'text',
                    description: undefined,
                    inputStyle: queryInputStyle,
                    extraValues: [],
                    dropdownOptions,
                    dropdownOptionPairs,
                    sourceVariable: pStep.varName,
                    sourceStepIndex: pStep.stepIndex,
                    groupId: `paste_step_${pStep.stepIndex}`,
                    groupLabel: `Step ${pStep.stepIndex + 1} - Paste Input`,
                  });
                });
              } else {
                // Single or no paste step â€” use the original single 'query' field logic
                let queryValue = '';
                let queryDropdown: string[] | undefined = undefined;
                let queryDropdownPairs: { key: string; value: string }[] | undefined = undefined;
                let queryInputStyle: 'short_text' | 'long_text' | undefined = inputTypeHints.get('query');

                if (queryStepConfig) {
                  if (queryStepConfig.paramConfigs?.['query']) {
                    const paramCfg = queryStepConfig.paramConfigs['query'];
                    queryInputStyle = (getInputStyleFromType(paramCfg.type) as any) || queryInputStyle;
                    if (paramCfg.type === 'dropdown') {
                      queryDropdown = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                      queryDropdownPairs = Array.isArray(paramCfg.optionPairs) ? paramCfg.optionPairs : undefined;
                    } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                      queryValue = paramCfg.values[0];
                    }
                  } else {
                    if (queryStepConfig.fixedValue) queryValue = queryStepConfig.fixedValue;
                    if (queryStepConfig.dropdownOptions) {
                      queryDropdown = queryStepConfig.dropdownOptions
                        .split(',')
                        .map((s: string) => s.trim())
                        .filter(Boolean);
                    }
                  }
                }
                if (queryDropdown && queryDropdown.length > 0 && !queryValue) {
                  queryValue = queryDropdown[0];
                }
                fields.push({
                  key: 'query',
                  label: 'Query',
                  value: queryValue,
                  type: queryDropdown ? 'dropdown' : 'text',
                  sourceType: 'text',
                  description: undefined,
                  inputStyle: queryInputStyle,
                  extraValues: [],
                  dropdownOptions: queryDropdown,
                  dropdownOptionPairs: queryDropdownPairs,
                  // For 'query' field, use the URL template of the step that sourced it
                  urlTemplate: queryStepUrl,
                });
              }
            }
          }

          fields = [...fields].sort((a, b) => {
            const orderDiff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
            if (orderDiff !== 0) return orderDiff;

            // Extract step index from scoped keys like "input1__paste_step_0"
            const aStepMatch = a.key.match(/__paste_step_(\d+)$/);
            const bStepMatch = b.key.match(/__paste_step_(\d+)$/);
            const aStepIndex = aStepMatch ? parseInt(aStepMatch[1], 10) : Number.MAX_SAFE_INTEGER;
            const bStepIndex = bStepMatch ? parseInt(bStepMatch[1], 10) : Number.MAX_SAFE_INTEGER;

            // Sort by step index first (so all Step 1 fields group together, then Step 2, etc.)
            if (aStepIndex !== bStepIndex) {
              return aStepIndex - bStepIndex;
            }

            // Within same step, sort by param name
            return a.key.localeCompare(b.key);
          });

          // If we have paramConfigs-based fields (scoped paste step fields), remove all generic extracted fields
          const hasPasteStepFields = fields.some(f => f.key.includes('__paste_step_'));
          if (hasPasteStepFields) {
            // Keep only paste step fields and explicitly defined paramConfigs fields
            fields = fields.filter(field => field.key.includes('__paste_step_'));
          }

          const constantFields = fields.filter(field => field.sourceType === 'constant');
          const runtimeFields = fields.filter(field => field.sourceType !== 'constant');

          

          if (runtimeFields.length === 0) {
            // No inputs needed, run immediately
            const finalInputs = { ...constantInputs };
            if (!finalInputs['content'] && typedText) finalInputs['content'] = typedText;
            if (!finalInputs['query'] && typedText) finalInputs['query'] = typedText;

            runAutomation(newItem as any, finalInputs);
            resetAfterCommandExecution();
            return;
          }

          setActiveCollection({
            item: { _kind: 'agent_collection', title: automation.name, itemCount: 1, automation: newItem },
            agents: [],
            links: [],
            automations: [newItem],
            fields: fields,
            constantInputs,
            constantFields,
            focusedFieldIndex: 0,
          });

          setLockedCommand(null);
          setCommandPrompt('');
        } catch (e) {
          console.error('[Searchbar] handleAutomationSelect failed', e);
        }
      },
      [resetAfterCommandExecution],
    );

    const handlePromptMenuSelect = useCallback(
      (suggestion: PromptMenuSuggestion) => {
        if (suggestion.kind === 'automation') {
          handleAutomationSelect(suggestion.automation);
          setShowPromptMenu(false);
          setPromptSuggestions([]);
          setPromptHighlightIndex(0);
          return;
        }

        handlePromptSelect(suggestion.prompt);
      },
      [handleAutomationSelect, handlePromptSelect],
    );

    const buildAutomationFromModule = useCallback((module: InstalledModule): SavedAutomation => {
      const moduleId = String(module.module_id);
      return {
        id: `module-${moduleId}`,
        type: 'automation',
        name: module.name || module.module_key || 'Module',
        iconHost: (module as any).icon_host || (module as any).iconHost || (module as any).icon_url || '',
        steps: [
          {
            id: `module-step-${moduleId}`,
            moduleId,
            config: {
              isCloudModule: true,
              name: module.name || module.module_key,
              version: module.version || 1,
              variables: Array.isArray(module.variables) ? module.variables : [],
              execution_steps: Array.isArray(module.execution_steps) ? module.execution_steps : [],
              iconHost: (module as any).icon_host || (module as any).iconHost || (module as any).icon_url || '',
            },
          },
        ],
        timestamp: Date.now(),
      };
    }, []);

    const handleContextualSelect = useCallback(
      (match: ContextualMatch) => {
        if (match.type === 'automation' && match.automation) {
          handleAutomationSelect(match.automation);
        } else if (match.type === 'module' && match.module) {
          handleAutomationSelect(buildAutomationFromModule(match.module));
        } else if (match.type === 'agent' && match.agent) {
          setActiveCollection({
            item: match.agent,
            agents: [],
            links: [],
            automations: [],
            fields: [],
            focusedFieldIndex: 0,
          });
        } else if (match.type === 'snippet' && match.snippet) {
          // Handle links and tab groups
          const category = (match.snippet.category || '').toLowerCase();
          if (['link', 'links'].includes(category) && typeof match.snippet.value === 'string') {
            // Single link - open it
            openSingleLink(match.snippet.value, false, currentTabId);
          } else if (['tabgroup', 'tab group'].includes(category) && typeof match.snippet.value === 'object') {
            // Tab group - extract URLs from tabs array
            const tabsData = match.snippet.value as any;
            if (tabsData.tabs && Array.isArray(tabsData.tabs)) {
              const urls = tabsData.tabs
                .map((tab: any) => (typeof tab === 'string' ? tab : tab.url || ''))
                .filter((url: string) => !!url);
              if (urls.length > 0) {
                openMultipleLinks(urls, currentTabId);
              }
            }
          }
        }
        setIsContextualPopupOpen(false);
        setContextualMatches([]);
        setContextualPopupIndex(-1);
      },
      [handleAutomationSelect, buildAutomationFromModule, currentTabId],
    );

    const handleSavedAgentSelection = useCallback(
      (agent: any) => {
        // Alert only if current session is active and NOT saved (no name)
        if (activeAiSessionRef.current && !activeAiSessionRef.current.name) {
          const confirm = window.confirm(
            'Your Chat Agent is not saved. Save it to avoid losing your changes. Continue anyway?',
          );
          if (!confirm) return;
        }

        // Reset session then populate from agent
        setSelectedAutomation(agent);
        setCommandPrompt('');
        setValue('');
        setShowSavedAgentsMenu(false);
        setSavedAgentSuggestions([]);

        // Extract model IDs and URLs from agent config
        const step = (agent.automation_steps || agent.steps)?.[0];
        let modelsFromAgent: string[] = [];
        let urlsFromAgent: string[] = [];
        let tabIdsFromAgent: number[] = [];
        let customModelDefinitions: any[] = [];

        if (step?.config?.allAiUrls) {
          const allModels = Object.keys(step.config.allAiUrls);
          const activeModels = allModels.filter((m: string) => {
            const url = step.config.allAiUrls[m];
            return url.includes('cmd_select_status=true');
          });

          // For backward compatibility: if no status found, select all
          const finalSelected = activeModels.length > 0 ? activeModels : allModels;

          modelsFromAgent = allModels;
          urlsFromAgent = allModels.map((m: string) => step.config.allAiUrls[m]);
          tabIdsFromAgent = allModels.map(() => 0); // Placeholder tab IDs
          setSelectedAIs(finalSelected);

          // EXTRACT CUSTOM MODELS: If any models in the agent are custom IDs (not standard)
          // we prepare them for the active session definitions so they show up in the Selection Panel.
          const standardIds = ['gpt', 'claude', 'gemini', 'perplexity'];
          customModelDefinitions = allModels
            .filter(id => !standardIds.includes(id))
            .map(id => {
              const rawUrl = stripCmdStatus(step.config.allAiUrls[id]);
              let host = '';
              try {
                host = new URL(rawUrl).hostname;
              } catch (e) {
                host = rawUrl.slice(0, 30);
              }
              return {
                id,
                name: id.startsWith('custom-') ? 'Imported Agent' : id,
                url: rawUrl,
                host: host,
              };
            });
        } else if (step?.config?.agentId && step.config.agentId !== 'all_ai' && step.config.agentId !== 'all') {
          modelsFromAgent = [step.config.agentId];
          urlsFromAgent = [step.config.url || ''];
          tabIdsFromAgent = [0];
          setSelectedAIs(modelsFromAgent);
        }

        // Normalize URLs: Replace empty, null, or about:blank with defaults
        urlsFromAgent = urlsFromAgent.map((url, idx) => {
          const modelId = modelsFromAgent[idx];
          if (!url || url === 'null' || url === 'undefined' || url.startsWith('about:blank')) {
            return DEFAULT_ALL_AI_URLS[modelId] || url || '';
          }
          return url;
        });

        // Lock to AI if not already
        if (lockedCommand !== 'ai') {
          activateCommandById('ai', '');
        }

        // Populate activeAiSession so it shows in sidebar and provides context URLs
        // We do this AFTER activateCommandById because that function now clears the session
        if (modelsFromAgent.length > 0) {
          const sessionKey = `${agent.id}-${Date.now()}`;
          const placeholderSession = {
            id: agent.id, // Stable Agent ID
            sessionKey, // Unique Session Key for logs
            prompt: step?.config?.prompt || agent.name || 'Saved Agent',
            name: agent.name,
            models: modelsFromAgent,
            urls: urlsFromAgent,
            tabIds: tabIdsFromAgent,
            workspace_id: agent.workspace_id,
            folder_id: agent.folder_id,
            customModelDefinitions: customModelDefinitions,
          };
          setActiveAiSession(placeholderSession);
          activeAiSessionRef.current = placeholderSession;

          // Trigger background restoration of captured URLs
          const linksToOpen = modelsFromAgent
            .map((modelId, idx) => {
              const url = urlsFromAgent[idx];
              const cleanUrl = stripCmdStatus(url);
              const hasSpecificChatId =
                cleanUrl.includes('/search/') || // perplexity
                cleanUrl.includes('/c/') ||      // chatgpt
                cleanUrl.includes('/chat/') ||   // claude
                cleanUrl.includes('/chats/');    // copilot

              let autoSubmitConfig: any = undefined;

              if (!hasSpecificChatId) {
                let kind = 'chatgpt';
                if (modelId === 'gemini') kind = 'gemini';
                else if (modelId === 'claude') kind = 'claude';
                else if (modelId === 'perplexity') kind = 'perplexity';
                else if (modelId === 'copilot') kind = 'copilot';
                else if (modelId === 'google') kind = 'google';

                const promptText = step?.config?.prompt || agent.name || '';
                if (promptText) {
                  autoSubmitConfig = {
                    kind,
                    prompt: promptText,
                  };
                }
              }

              return {
                url: cleanUrl,
                active: false, // Don't steal focus
                forceNewTab: false, // Reuse existing tabs if they match the chat ID
                modelId,
                autoSubmit: autoSubmitConfig,
                skip: !url.includes('cmd_select_status=true'),
              };
            })
            .filter(item => !!item.url);

          if (linksToOpen.length > 0) {
            openLinksWithAutoSubmit(linksToOpen).then(openedTabIds => {
              const finalSession = {
                ...placeholderSession,
                tabIds: openedTabIds,
              };
              setActiveAiSession(finalSession);
              activeAiSessionRef.current = finalSession;

              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                  action: 'track_ai_session',
                  prompt: placeholderSession.prompt,
                  tabIds: openedTabIds,
                  models: modelsFromAgent,
                });
              }
            });
          }
        }
      },
      [lockedCommand, activateCommandById, setSelectedAIs, setActiveAiSession, setSelectedAutomation],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => {
          resetAfterCommandExecution();
          setIsSuggestionsHidden(false);
        },
        setSuggestionsHidden: (hidden: boolean) => {
          setIsSuggestionsHidden(hidden);
        },
        getValue: () => inputRef.current?.value || '',
        setValue: (val: string) => {
          if (inlineComposerActive) {
            setCommandPrompt(val);
          } else {
            setValue(val);
          }
        },
        lockCommand: (commandId: AnyCommandId | null, initialValue?: string) => {
          activateCommandById(commandId, initialValue || '');
        },
        previewCommand: (commandId: AnyCommandId) => {
          previewCommandById(commandId);
        },
        processCommand: (commandId: AnyCommandId) => {
          activateCommandById(commandId, '');
        },
        executeCommand: (commandId: AnyCommandId, options?: { mode?: 'execute' | 'lock' }) => {
          if (options?.mode === 'lock') {
            activateCommandById(commandId as AnyCommandId, '');
            return;
          }
          if (isLocalCommandId(commandId as string)) {
            if (!checkLocalCommandAuth(commandId as LocalCommandId)) return;
            const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
            if (localDef?.behavior === 'locked') {
              activateCommandById(commandId as AnyCommandId, '');
              return;
            }
            handleLocalCommandExecute(commandId as LocalCommandId);
            setLockedCommand(null);
            setActiveAiSession(null);
            setValue('');
            setCommandPrompt('');
            setTimeout(() => inputRef.current?.blur(), 0);
            return;
          }
          const remoteCmd = commands.find(c => String(c.id) === String(commandId));
          if (remoteCmd && remoteCmd.category !== 'ai') {
            const requiresQuery = remoteCmd.urlTemplate && remoteCmd.urlTemplate.includes('{query}');
            if (!requiresQuery && remoteCmd.urlTemplate) {
              const urlToOpen = remoteCmd.urlTemplate.includes('?')
                ? remoteCmd.urlTemplate.split('?')[0]
                : remoteCmd.urlTemplate;
              trackCounterEvent('command_count', {
                source: 'new_tab',
                commandId: remoteCmd.id,
                commandType: 'remote',
                via: 'execute_command',
              });
              openSingleLink(urlToOpen);
              return;
            }
          }
          activateCommandById(commandId as AnyCommandId, '');
        },
        clearCommandPreview,
        isLocked: !!lockedCommand,
        openUrls,
        activateAutomation: (automation: SavedAutomation) => {
          handleAutomationSelect(automation);
        },
        requestPreviewRestore: () => {
          if (!lockedCommand) {
            clearCommandPreview();
          }
        },
        executeModule: (moduleId: string) => {
          const rawId = String(moduleId);
          const normalizedId = rawId.includes(':') ? rawId.split(':')[1] : rawId.replace(/^module-/, '');
          const moduleFromState = moduleSuggestions.find(m => String(m.module_id) === normalizedId);
          if (moduleFromState) {
            handleAutomationSelect(buildAutomationFromModule(moduleFromState));
            return;
          }
          if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
          chrome.storage.local.get(['installed_modules'], result => {
            const modules = Array.isArray(result.installed_modules) ? result.installed_modules : [];
            const match = modules.find((m: any) => String(m?.module_id) === normalizedId);
            if (match) {
              handleAutomationSelect(buildAutomationFromModule(match));
            }
          });
        },
        submitAI: (prompt: string) => {
          if (lockedCommand === 'ai') {
            const hist = stagedHistorySessionRef.current;
            const historyUrls = hist ? (Object.values(hist.urls).filter(Boolean) as string[]) : undefined;
            runAggregateCommand(expandPrompts(prompt), selectedImagesRef.current, historyUrls);
          }
        },
        triggerFileUpload: () => {
          fileInputRef.current?.click();
        },
        selectSavedAgent: (agent: any) => {
          // Check if this is already the active agent/session
          const isCurrentlyActive =
            agent.id === 'active-session' ||
            (activeAiSessionRef.current && String(activeAiSessionRef.current.id) === String(agent.id));

          if (isCurrentlyActive) return;

          // Alert only if current session is active and NOT saved (no name)
          if (activeAiSessionRef.current && !activeAiSessionRef.current.name) {
            const confirm = window.confirm(
              'Your Chat Agent is not saved. Save it to avoid losing your changes. Continue anyway?',
            );
            if (!confirm) return;
          }

          // Reset session then populate from agent
          setSelectedAutomation(agent);
          setCommandPrompt('');
          setValue('');

          // Extract model IDs and URLs from agent config
          const step = (agent.automation_steps || agent.steps)?.[0];
          let modelsFromAgent: string[] = [];
          let urlsFromAgent: string[] = [];
          let tabIdsFromAgent: number[] = [];
          let customModelDefinitions: any[] = [];

          if (step?.config?.allAiUrls) {
            const allModels = Object.keys(step.config.allAiUrls);
            const activeModels = allModels.filter(m => {
              const url = step.config.allAiUrls[m];
              return url.includes('cmd_select_status=true');
            });

            // For backward compatibility: if no status found, select all
            const finalSelected = activeModels.length > 0 ? activeModels : allModels;

            modelsFromAgent = allModels;
            urlsFromAgent = allModels.map(m => step.config.allAiUrls[m]);
            tabIdsFromAgent = allModels.map(() => 0); // Placeholder tab IDs
            setSelectedAIs(finalSelected);

            // EXTRACT CUSTOM MODELS: If any models in the agent are custom IDs (not standard)
            // we prepare them for the active session definitions so they show up in the Selection Panel.
            const standardIds = ['gpt', 'claude', 'gemini', 'perplexity'];
            customModelDefinitions = allModels
              .filter(id => !standardIds.includes(id))
              .map(id => {
                const rawUrl = stripCmdStatus(step.config.allAiUrls[id]);
                let host = '';
                try {
                  host = new URL(rawUrl).hostname;
                } catch (e) {
                  host = rawUrl.slice(0, 30);
                }
                return {
                  id,
                  name: id.startsWith('custom-') ? 'Imported Agent' : id,
                  url: rawUrl,
                  host: host,
                };
              });
          } else if (step?.config?.agentId && step.config.agentId !== 'all_ai' && step.config.agentId !== 'all') {
            modelsFromAgent = [step.config.agentId];
            urlsFromAgent = [step.config.url || ''];
            tabIdsFromAgent = [0];
            setSelectedAIs(modelsFromAgent);
          }

          // Normalize URLs: Replace empty, null, or about:blank with defaults
          urlsFromAgent = urlsFromAgent.map((url, idx) => {
            const modelId = modelsFromAgent[idx];
            if (!url || url === 'null' || url === 'undefined' || url.startsWith('about:blank')) {
              return DEFAULT_ALL_AI_URLS[modelId] || url || '';
            }
            return url;
          });

          // Lock to AI if not already
          if (lockedCommand !== 'ai') {
            activateCommandById('ai', '');
          }

          // Populate activeAiSession so it shows in sidebar and provides context URLs
          // We do this AFTER activateCommandById because that function now clears the session
          if (modelsFromAgent.length > 0) {
            const sessionKey = `${agent.id}-${Date.now()}`;
            const placeholderSession = {
              id: agent.id, // Stable Agent ID
              sessionKey, // Unique Session Key for logs
              prompt: step?.config?.prompt || agent.name || 'Saved Agent',
              name: agent.name,
              models: modelsFromAgent,
              urls: urlsFromAgent,
              tabIds: tabIdsFromAgent,
              workspace_id: agent.workspace_id,
              folder_id: agent.folder_id,
              customModelDefinitions: customModelDefinitions,
            };
            setActiveAiSession(placeholderSession);
            activeAiSessionRef.current = placeholderSession;

            // Trigger background restoration of captured URLs
            const linksToOpen = modelsFromAgent
              .map((modelId, idx) => {
                const url = urlsFromAgent[idx];
                const cleanUrl = stripCmdStatus(url);
                const hasSpecificChatId =
                  cleanUrl.includes('/search/') || // perplexity
                  cleanUrl.includes('/c/') ||      // chatgpt
                  cleanUrl.includes('/chat/') ||   // claude
                  cleanUrl.includes('/chats/');    // copilot

                let autoSubmitConfig: any = undefined;

                if (!hasSpecificChatId) {
                  let kind = 'chatgpt';
                  if (modelId === 'gemini') kind = 'gemini';
                  else if (modelId === 'claude') kind = 'claude';
                  else if (modelId === 'perplexity') kind = 'perplexity';
                  else if (modelId === 'copilot') kind = 'copilot';
                  else if (modelId === 'google') kind = 'google';

                  const promptText = step?.config?.prompt || agent.name || '';
                  if (promptText) {
                    autoSubmitConfig = {
                      kind,
                      prompt: promptText,
                    };
                  }
                }

                return {
                  url: cleanUrl,
                  active: false, // Don't steal focus
                  forceNewTab: false, // Reuse existing tabs if they match the chat ID
                  modelId,
                  autoSubmit: autoSubmitConfig,
                  skip: !url.includes('cmd_select_status=true'),
                };
              })
              .filter(l => !!l.url);

            if (linksToOpen.length > 0) {
              openLinksWithAutoSubmit(linksToOpen).then(openedTabIds => {
                const finalSession = {
                  ...placeholderSession,
                  tabIds: openedTabIds,
                };
                setActiveAiSession(finalSession);
                activeAiSessionRef.current = finalSession;

                // Register successfully restored session with background for follow-up tracking
                chrome.runtime.sendMessage({
                  action: 'track_ai_session',
                  prompt: placeholderSession.prompt,
                  tabIds: openedTabIds,
                  models: modelsFromAgent,
                });
              });
            }
          } else {
            setActiveAiSession({
              id: `temp-${agent.id}`,
              sessionKey: `temp-${agent.id}-${Date.now()}`,
              prompt: 'Starting fresh...',
              models: [],
              urls: [],
              tabIds: [],
            });
          }

          const finalPrompt = valueRef.current || value || '';
          if (finalPrompt.trim()) {
            // Trigger immediately if there's a prompt
            runAggregateCommand(finalPrompt, selectedImages, []);
          }
        },
        newAiChat: () => {
          setActiveAiSession({
            id: 'new-chat', // Stable ID for new chats
            sessionKey: `new-chat-${Date.now()}`, // Unique key for logs
            prompt: '',
            models: DEFAULT_SELECTED_AIS,
            tabIds: DEFAULT_SELECTED_AIS.map(() => 0),
            urls: DEFAULT_SELECTED_AIS.map(id => {
              const cmd = commands.find(c => c.id === id) || COMMANDS.find(c => c.id === id);
              return cmd?.urlTemplate || '';
            }),
          });
          setSelectedAutomation(null);
          setCommandPrompt('');
          setValue('');
          setSelectedAIs(DEFAULT_SELECTED_AIS);
          if (lockedCommand !== 'ai') {
            activateCommandById('ai', '');
          }
        },
        executeSnippet: (snippet: any, forceNewTab = false) => {
          // Unified snippet trigger logic (matches SearchSuggestions.tsx)
          if (!snippet) return;

          const rawValue = snippet.value;
          let urls: string[] = [];

          if (typeof rawValue === 'string') {
            try {
              // Try parsing as JSON (common for TabGroups)
              const parsed = JSON.parse(rawValue || '{}');
              if (parsed && Array.isArray(parsed.urls)) {
                urls = parsed.urls;
              } else if (rawValue.startsWith('http') || rawValue.startsWith('chrome:')) {
                urls = [rawValue];
              }
            } catch {
              // Not JSON, check if single URL
              if (rawValue.startsWith('http') || rawValue.startsWith('chrome:')) {
                urls = [rawValue];
              }
            }
          } else if (rawValue && typeof rawValue === 'object' && Array.isArray(rawValue.urls)) {
            urls = rawValue.urls;
          } else if (snippet.url) {
            urls = [snippet.url];
          }

          if (urls.length > 0) {
            
            openUrls(urls, snippet.key, forceNewTab);
          } else {
            // Note/Snippet/Prompt handling
            const snippetId = snippet.id || snippet.snippet_id;
            if (forceNewTab && snippetId) {
              // Open note in a fresh new tab as requested for Todos
              
              const noteUrl = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${snippetId}`);
              openUrls([noteUrl], snippet.key, true);
            } else {
              // Default behavior: open in sidebar
              
              onSnippetSelect?.({ snippet } as any);
            }
          }
        },
        updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => {
          setActiveAiSession(prev => {
            if (!prev) return metadata.id ? ({ id: metadata.id, ...metadata } as any) : null;
            return { ...prev, ...metadata };
          });
        },
      }),
      [
        activateCommandById,
        previewCommandById,
        clearCommandPreview,
        handleLocalCommandExecute,
        openUrls,
        handleAutomationSelect,
        buildAutomationFromModule,
        moduleSuggestions,
        resetAfterCommandExecution,
        lockedCommand,
        onSnippetSelect,
      ],
    );

    const handleSnippetSelect = useCallback(
      (selection: SnippetSuggestion | null | undefined) => {
        if (!selection) return;

        // Check if we are selecting from an @ mention
        const atMentionMatch = value.match(/(?:^|\s)@(\w*)$/);
        if (atMentionMatch && !lockedCommand) {
          // Replace the @fragment with @Title
          const matchIndex = atMentionMatch.index!;
          const matchLength = atMentionMatch[0].length;
          // match[0] includes the leading space if present, so we need to be careful
          const prefix = value.slice(0, matchIndex);
          // Determine separator: if match started with space, keep it
          const separator = atMentionMatch[0].startsWith(' ') ? ' ' : '';

          const title = selection.snippet.key;
          const newValue = prefix + separator + '@' + title + ' ';

          setValue(newValue);
          // Keep focus and don't clear everything
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }

        onSnippetSelect?.(selection);
        setLockedCommand(null);
        setValue('');
        setCommandPrompt('');
        setHighlightIndex(0);
        setBookmarkSuggestions([]);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
        setIsFocused(false);
        setTimeout(() => inputRef.current?.blur(), 0);
      },
      [onSnippetSelect, value, lockedCommand],
    );

    const handleSnippetDelete = useCallback(
      (selection: SnippetSuggestion | null | undefined) => {
        if (!selection || !activeSnippetCommandId) return;
        const snippetId = selection.snippet.id || selection.snippet.snippet_id;
        if (!snippetId) return;
        dispatchSnippetDeleteAction({
          commandId: activeSnippetCommandId,
          snippetId,
          snippetKey: selection.snippet.key,
          category: selection.snippet.category,
          workspaceId: selection.workspace.workspace_id,
          workspaceName: selection.workspace.workspace_name,
          folderId: selection.folder?.folder_id ?? null,
          folderName: selection.folder?.folder_name ?? null,
        });
        setLockedCommand(null);
        setValue('');
        setCommandPrompt('');
        setHighlightIndex(0);
        setBookmarkSuggestions([]);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
        setIsFocused(false);
        setTimeout(() => inputRef.current?.blur(), 0);
      },
      [activeSnippetCommandId],
    );

    const commandQuery = useMemo(() => {
      if (value.startsWith('/')) {
        return value.slice(1);
      }
      return value;
    }, [value]);

    const commandSuggestions = useMemo<CommandSuggestionItem[]>(() => {
      if (lockedLocalDef || isBookmarksCommand(lockedCommand)) return [];

      const trimmedQuery = commandQuery.trim().toLowerCase();
      const results: CommandSearchResult[] = [];

      if (trimmedQuery) {
        results.push(...searchCommands(commandIndex, commandQuery));
      } else if (value.startsWith('/')) {
        // Show all commands if just '/'
        commandIndex.forEach(entry => {
          results.push({
            kind: entry.kind,
            definition: entry.definition,
            score: 1,
            matchedTokens: [],
          } as CommandSearchResult);
        });
      }

      // Filter out 'ai' from results to ensure we use the aggregate logic
      // Also filter out browser commands Unless searching with "/" explicitly
      const filteredResults = results.filter(
        r => r.definition.id !== 'ai' && ((r.definition as any).category !== 'browser' || value.startsWith('/')),
      );

      const converted: CommandSuggestionItem[] = filteredResults.map(match => {
        if (match.kind === 'remote') {
          return {
            _kind: 'command' as const,
            commandType: 'remote' as const,
            id: match.definition.id,
            label: match.definition.label,
            prefix: match.definition.prefix,
            score: match.score,
            matchedTokens: match.matchedTokens,
            command: match.definition,
          };
        }
        return {
          _kind: 'command' as const,
          commandType: 'local' as const,
          id: match.definition.id as LocalCommandId,
          label: match.definition.label,
          prefix: match.definition.prefix,
          score: match.score,
          matchedTokens: match.matchedTokens,
          command: match.definition,
        };
      });

      const shouldIncludeAiAggregate = () => {
        if (lockedLocalDef || isBookmarksCommand(lockedCommand)) return false;
        if (converted.some(item => item.id === 'ai')) return false;
        if (!value.startsWith('/') && !trimmedQuery) return false;
        if (value.startsWith('/')) {
          return 'ai'.startsWith(trimmedQuery);
        }
        return trimmedQuery.includes('ai') || trimmedQuery.includes('assistant') || value.includes('@');
      };

      const suggestionsWithAggregate = shouldIncludeAiAggregate()
        ? [
          {
            _kind: 'command' as const,
            commandType: 'aggregate' as const,
            id: 'ai' as const,
            label: AI_GROUP.label,
            prefix: AI_GROUP.prefix,
            score: trimmedQuery ? 6 : 1,
            matchedTokens: trimmedQuery ? [trimmedQuery] : [],
          },
          ...converted,
        ]
        : converted;

      return suggestionsWithAggregate;
    }, [commandQuery, lockedCommand, lockedLocalDef, value, commandIndex]);

    const localEntitySuggestions = useMemo(() => {
      if (!lockedLocalDef) return [];
      const q = value.trim().toLowerCase();
      if (lockedLocalDef.scope === 'workspace') {
        const action = lockedLocalDef.action;
        if (!action) return [];
        const items =
          (selectedTeam?.workspaces || []).map(ws => ({
            _kind: 'workspace' as const,
            workspace: ws,
            action,
          })) || [];
        if (!q) return items;
        return items.filter(it => (it.workspace.workspace_name || '').toLowerCase().includes(q));
      }
      if (lockedLocalDef.scope === 'snippet') {
        return snippetEntitySuggestions;
      }
      // Folder scope: return empty for now (not implemented)
      return [];
    }, [lockedLocalDef, selectedTeam, snippetEntitySuggestions, value]);

    // Debounced search results state for Fuse.js search
    const [debouncedFuseResults, setDebouncedFuseResults] = useState<SuggestionListItem[]>([]);
    const fuseSearchTimeoutRef = useRef<number | null>(null);

    // Effect to run debounced Fuse.js search
    useEffect(() => {
      // Clear any pending search
      if (fuseSearchTimeoutRef.current) {
        window.clearTimeout(fuseSearchTimeoutRef.current);
        fuseSearchTimeoutRef.current = null;
      }

      // Skip debounced search for special modes
      // [CRITICAL] If searchbar is focused or isInitialAltSFocus is true, do NOT skip so fallback suggestions display immediately when query is empty!
      const shouldSkip =
        isInitialAltSFocus || isFocused
          ? false
          : isBookmarksCommand(lockedCommand) ||
          lockedLocalDef ||
          value.startsWith('/') ||
          lockedCommand ||
          selectedAtCommand ||
          (lockedCommand !== 'calendar' && !value.trim() && selectedImages.length === 0);

      

      if (shouldSkip) {
        setDebouncedFuseResults([]);
        return;
      }

      // Debounce the Fuse.js search (300ms for responsiveness while avoiding lag)
      fuseSearchTimeoutRef.current = window.setTimeout(async () => {
        const bookmarksForSearch = bookmarkSuggestions.map(b => ({
          id: b.id,
          title: b.title,
          url: b.url,
        }));

        const fuseResults = fuseSearchAll(value, {
          commands,
          localCommands: LOCAL_COMMANDS,
          historyItems: isSearchFocusEnabled ? historyItems : null,
          snippetIndex,
          folderIndex,
          bookmarks: bookmarksForSearch,
          commonCommands: commonCommandEntries,
          automations: automationSuggestions,
          agents: agentCollectionSuggestions,
          modules: moduleSuggestions,
          lockedCommand: null,
          selectedFolder: selectedFolder ?? null,
          selectedTeam: selectedTeam ?? null,
          includeCommonIfEmpty: selectedImages.length > 0,
          returnAllIfEmpty: isInitialAltSFocus || !value.trim(),
        });

        

        // Convert UnifiedSearchResult to SuggestionListItem
        const converted: SuggestionListItem[] = [];

        for (const result of fuseResults) {
          switch (result._kind) {
            case 'command':
              converted.push({
                _kind: 'command' as const,
                commandType: result.commandType,
                id: result.id,
                label: result.label,
                prefix: result.prefix,
                score: result.score,
                matchedTokens: [],
                command: result.command,
                description: result.description,
              } as CommandSuggestionItem);
              break;

            case 'history':
              converted.push({
                _kind: 'history' as const,
                id: result.id,
                title: result.title,
                url: result.url,
                lastVisitTime: result.lastVisitTime,
                visitCount: result.visitCount,
                frecencyScore: result.frecencyScore,
                isOtherResult: result.isOtherResult,
                commandId: result.commandId,
              } as HistorySuggestionItem);
              break;

            case 'snippet':
              converted.push({
                _kind: 'snippet' as const,
                snippet: result.snippet,
                workspace: result.workspace,
                folder: result.folder,
                isPersonal: result.isPersonal,
              });
              break;

            case 'bookmark':
              converted.push({
                _kind: 'bookmark' as const,
                id: result.id,
                title: result.title,
                url: result.url,
                commandId: result.commandId,
              } as BookmarkSuggestionItem);
              break;

            case 'common_command':
              converted.push({
                _kind: 'common_command' as const,
                id: result.id,
                label: result.label,
                description: result.description,
                command: result.command,
                query: result.query,
              } as CommonCommandSuggestionItem);
              break;

            case 'folder':
              converted.push({
                _kind: 'folder_search' as const,
                entryType: result.entryType,
                folder: result.folder,
                workspace: result.workspace,
                fullPath: result.fullPath,
              });
              break;
            case 'automation':
              converted.push({
                _kind: 'automation' as const,
                automation: result.automation,
              });
              break;
            case 'module':
              converted.push({
                _kind: 'module' as const,
                id: `module:${result.module.module_id}`,
                module: result.module,
              });
              break;
            case 'agent_collection':
              converted.push({
                _kind: 'agent_collection' as const,
                title: result.title,
                itemCount: result.itemCount,
              });
              break;
          }
        }

        // De-duplicate snippets using ID or key fallback
        const snippetIds = new Set();
        const finalResults = converted.filter(item => {
          if (item._kind === 'snippet') {
            const sid = item.snippet.id || item.snippet.snippet_id || item.snippet.key || '';
            if (snippetIds.has(sid)) return false;
            snippetIds.add(sid);
          }
          return true;
        });

        if (value.trim()) {
          const routeRes = await processQuery(value.trim());
          if (routeRes) {
            if (routeRes.engine === 'math') {
              finalResults.unshift({
                _kind: 'math_result',
                query: routeRes.query,
                result: routeRes.result,
              });
            } else if (routeRes.engine === 'time') {
              // Group all time results into a single card (rendered in a 2-column grid)
              finalResults.unshift({
                _kind: 'time_result',
                query: routeRes.query,
                results: routeRes.results,
              });
            }
          }
        }

        if (finalResults.length > 0) {
          
        }
        setDebouncedFuseResults(finalResults);
      }, 300);

      return () => {
        if (fuseSearchTimeoutRef.current) {
          window.clearTimeout(fuseSearchTimeoutRef.current);
        }
      };
    }, [
      value,
      lockedCommand,
      lockedLocalDef,
      commands,
      snippetIndex,
      folderIndex,
      commonCommandEntries,
      bookmarkSuggestions,
      selectedFolder,
      selectedImages.length,
      historyItems,
      isSearchFocusEnabled,
      automationSuggestions,
      agentCollectionSuggestions,
      moduleSuggestions,
      isInitialAltSFocus,
      isFocused,
    ]);

    // Create "Open URL" suggestion if input looks like a URL
    const openUrlSuggestion = useMemo<OpenUrlSuggestionItem | null>(() => {
      const trimmed = value.trim();
      if (!trimmed || value.startsWith('/') || lockedCommand) return null;
      const urls = getUrlsFromQuery(trimmed);
      if (urls.length > 0) {
        return {
          _kind: 'open_url',
          url: urls.join(','), // Use comma to separate multiple URLs
          displayUrl: trimmed,
        };
      }
      return null;
    }, [value, lockedCommand]);

    // Combined suggestions: uses immediate modes or debounced Fuse results
    const allSuggestions = useMemo<SuggestionListItem[]>(() => {
      // If AutomationInputs are open, hide normal search results.
      // Note: We no longer hide results for showAtCommandMenu to allow search fallback.
      if (activeCollection) {
        return [];
      }

      // Special case: @ command selected (quick search mode) - no suggestions
      if (selectedAtCommand) {
        return [];
      }

      // Special case: Bookmarks mode (immediate)
      if (isBookmarksCommand(lockedCommand)) {
        return bookmarkSuggestions;
      }

      // Special case: Local entity mode (immediate)
      if (lockedLocalDef && lockedCommand !== 'store') {
        return localEntitySuggestions;
      }

      // Special case: AI command locked mode or history list active
      if (showAIHistoryPanel) {
        return [];
      }

      if (lockedCommand === 'ai' || lockedCommand === 'store') {
        return [];
      }

      // Special case: Command list view (immediate)
      if (value.startsWith('/')) {
        // Also include snippets that match shortcuts/keywords when searching with "/"
        const trimmed = value.slice(1).trim();
        let suggestions: SuggestionListItem[] = [
          ...commandSuggestions,
          ...generalSnippetSuggestions,
          ...bookmarkSuggestions,
          ...commonCommandSuggestions,
        ];

        // Filter out items that don't match or have empty labels
        return suggestions.filter(item => {
          if (item._kind === 'command') return !!item.label;
          if (item._kind === 'snippet') return !!item.snippet.key;
          if (item._kind === 'bookmark') return !!item.title;
          if (item._kind === 'common_command') return !!item.label;
          return true;
        });
      }

      // Normal search mode: Use debounced Fuse.js results
      if (!lockedCommand && (value.trim() || selectedImages.length > 0 || isInitialAltSFocus)) {
        // If files are attached, treat as Prompt Mode: only show AI search suggestions
        if (selectedImages.length > 0) {
          return commonCommandSuggestions.filter(s => AI_GROUP.members.includes(s.id as CommandId) || s.id === 'ai');
        }

        // If input looks like URL, prepend "Open URL" suggestion at the beginning
        let results = debouncedFuseResults;
        if (openUrlSuggestion) {
          results = [openUrlSuggestion, ...results];
        }

        return results;
      }

      return [];
    }, [
      value,
      lockedCommand,
      commandSuggestions,
      lockedLocalDef,
      localEntitySuggestions,
      bookmarkSuggestions,
      openUrlSuggestion,
      selectedAtCommand,
      agentCollectionSuggestions,
      automationSuggestions,
      showAtCommandMenu,
      selectedImages,
      debouncedFuseResults,
      generalSnippetSuggestions,
      commonCommandSuggestions,

      showAIHistoryPanel,
      isInitialAltSFocus,
    ]);

    useEffect(() => {
      // Only adjust highlightIndex when allSuggestions changes, not when highlightIndex changes
      setHighlightIndex(prevIdx => {
        if (allSuggestions.length > 0) {
          return Math.min(prevIdx, allSuggestions.length - 1);
        }
        return 0;
      });
    }, [allSuggestions]);

    const handleRequestOpenUrls = useCallback(
      (urls: string[], title?: string) => {
        openUrls(urls, title);
      },
      [commands, currentTabId, triggerToast],
    );

    // --- Custom Agent Handling ---
    interface AgentItem {
      id: string;
      name: string;
      url: string;
      iconHost: string;
      promptLabel?: string;
    }

    const [customAgents, setCustomAgents] = useState<AgentItem[]>([]);
    const [customLinks, setCustomLinks] = useState<any[]>([]);
    const [customAutomations, setCustomAutomations] = useState<any[]>([]);

    useEffect(() => {
      chrome.storage.local.get(['agent_panel_selected_agents'], result => {
        const saved = result.agent_panel_selected_agents;
        if (saved) {
          if (Array.isArray(saved)) {
            setCustomAgents(saved);
          } else {
            setCustomAgents(saved.agents || []);
            setCustomLinks(saved.links || []);
            setCustomAutomations(saved.automations || []);
          }
        }
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.agent_panel_selected_agents) {
          const saved = changes.agent_panel_selected_agents.newValue;
          if (saved) {
            if (Array.isArray(saved)) {
              setCustomAgents(saved);
            } else {
              setCustomAgents(saved.agents || []);
              setCustomLinks(saved.links || []);
              setCustomAutomations(saved.automations || []);
            }
          } else {
            setCustomAgents([]);
            setCustomLinks([]);
            setCustomAutomations([]);
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const openLinksWithAutoSubmit = useCallback(
      async (
        items: Array<{
          url: string;
          active: boolean;
          autoSubmit?: any;
          modelId?: string;
          forceNewTab?: boolean;
          targetTabId?: number;
        }>,
      ) => {
        const tabIds: number[] = [];

        for (const item of items) {
          if ((item as any).skip) {
            tabIds.push(0);
            continue;
          }
          try {
            const response = await new Promise<any>((resolve, reject) => {
              chrome.runtime.sendMessage(
                {
                  action: 'open_tab_with_auto_submit',
                  url: item.url,
                  autoSubmit: item.autoSubmit,
                  forceNewTab: item.forceNewTab ?? true, // Default to true, but allow override
                  active: item.active,
                  targetTabId: item.targetTabId,
                },
                res => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(res);
                  }
                },
              );
            });

            tabIds.push(response?.tabId || 0);
          } catch (error) {
            console.error('[openLinksWithAutoSubmit] Failed to open tab via background:', error);
            // Fallback: direct creation without injection
            try {
              const tab = await new Promise<chrome.tabs.Tab>(res => {
                chrome.tabs.create({ url: item.url, active: item.active }, res);
              });
              tabIds.push(tab?.id || 0);
            } catch (e) {
              tabIds.push(0);
            }
          }
        }

        return tabIds;
      },
      [],
    );

    // Helper to calculate approximate payload size
    const getPayloadSize = (prompt: string, images?: { file: File }[] | null) => {
      let size = prompt.length;
      if (images) {
        images.forEach(img => (size += img.file.size));
      }
      return size;
    };

    const MAX_PAYLOAD_SIZE = 60 * 1024 * 1024; // 60MB limit to stay within 64MB sendMessage limit (including serialization overhead)

    const saveAiLog = useCallback(async (sessionKey: string, prompt: string) => {
      if (!sessionKey || !prompt.trim()) return;
      try {
        const logId = `ai_logs_${sessionKey}`;
        const result = await chrome.storage.local.get([logId]);
        const existingLogs = Array.isArray(result[logId]) ? result[logId] : [];

        // Check if this prompt is already the last one to avoid duplicates
        // (e.g. if the background script or another part of the app also logs it)
        if (existingLogs.length > 0 && existingLogs[existingLogs.length - 1].prompt === prompt.trim()) {
          return;
        }

        const newLog = {
          id: `log-${Date.now()}`,
          prompt: prompt.trim(),
          timestamp: Date.now(),
        };

        await chrome.storage.local.set({ [logId]: [...existingLogs, newLog] });
        
      } catch (err) {
        console.error('[saveAiLog] Failed to save AI log:', err);
      }
    }, []);

    const executeAggregateCommand = useCallback(
      async (
        prompt: string,
        images?: { file?: File; base64?: string; mimeType: string; filename: string }[] | null,
        historyUrls?: string[],
      ) => {
        let finalPrompt = prompt;
        if (lockedCommand === 'ai' && mentionedTabs && mentionedTabs.length > 0) {
          const contextMap = new Map<string, string>();
          try {
            
            for (const tab of mentionedTabs) {
              if (!tab.tabId) continue;
              try {
                const result = await chrome.scripting.executeScript({
                  target: { tabId: Number(tab.tabId) },
                  func: () => document.body.innerText || document.body.textContent,
                });
                const content = result[0]?.result || '';
                if (content) {
                  const structuredText = `\n--- Context from Tab: ${tab.title} ---\n${content}\n`;
                  contextMap.set(String(tab.tabId), structuredText);
                }
              } catch (err) {
                console.error(`[executeAggregateCommand] Failed to extract content from tab ${tab.tabId}:`, err);
              }
            }
          } catch (e) {
            console.error('[executeAggregateCommand] Error during tab content extraction:', e);
          }

          // Perform inline replacement of @[tab:ID] placeholders
          const regex = /@\[tab:([^\]]+)\]/g;
          finalPrompt = prompt.replace(regex, (match, tabId) => {
            const context = contextMap.get(String(tabId));
            if (context) return context;
            return match;
          });

          // Fallback: If no placeholders replaced but we have context
          if (finalPrompt === prompt && contextMap.size > 0) {
            let footerContext = '';
            contextMap.forEach(text => {
              footerContext += `\n${text}`;
            });
            finalPrompt = `${prompt}\n\n[Attached Tabs Context]\n${footerContext}\n[End of Context]`;
          }
        }

        const normalized = finalPrompt; // Tags are already replaced or preserved as fallback
        

        // Convert any File objects to base64 for background submission (DO THIS FIRST)
        const imagesWithBase64 = images
          ? await Promise.all(
            images.map(async img => {
              if (img.base64) return { base64: img.base64, mimeType: img.mimeType, filename: img.filename };
              return {
                base64: await fileToBase64(img.file!),
                mimeType: img.mimeType,
                filename: img.filename,
              };
            }),
          )
          : null;

        

        // If historyUrls are provided, use them for context injection as TOP PRIORITY
        if (historyUrls && historyUrls.length > 0) {
          try {
            const linksToOpen = historyUrls.map((url, index) => {
              // Try to identify which AI this URL belongs to for better autoSubmit targeting
              let kind: AutoSubmitKind = 'chatgpt'; // Default fallback
              let modelId: string = 'gpt';
              const lowerUrl = url.toLowerCase();
              if (lowerUrl.includes('chatgpt.com')) {
                kind = 'chatgpt';
                modelId = 'gpt';
              } else if (lowerUrl.includes('claude.ai')) {
                kind = 'claude';
                modelId = 'claude';
              } else if (lowerUrl.includes('perplexity.ai')) {
                kind = 'perplexity';
                modelId = 'perplexity';
              } else if (lowerUrl.includes('gemini.google.com')) {
                kind = 'gemini';
                modelId = 'gemini';
              }

              return {
                url,
                active: index === 0, // Focus the first one
                autoSubmit: {
                  kind,
                  prompt: normalized,
                  images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
                },
                modelId,
                forceNewTab: false, // Explicitly tell background script to find existing tab
              };
            });

            
            // Save the prompt to logs so it appears in the chat history
            if (stagedHistorySessionRef.current?.sessionKey) {
              saveAiLog(stagedHistorySessionRef.current.sessionKey, normalized);
            }
            // openLinksWithAutoSubmit will return the tab IDs of the newly (or matching) opened tabs
            const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);
            
            // Clean up the staged history after successful trigger
            setTimeout(() => setStagedHistorySession(null), 500);
            return;
          } catch (error) {
            console.error('[executeAggregateCommand] Failed to process historyUrls:', error);
            // Fall through to original logic
          }
        } else if (activeAiSessionRef.current && activeAiSessionRef.current.id !== 'new-chat') {
          // Dynamic Follow-up: Merge currently selected AIs with the existing session
          const currentSession = activeAiSessionRef.current;
          const currentSelectedAIs = selectedAIsRef.current;
          

          try {
            // Get currently selected models (from props/state)
            // Note: If no models are selected in UI during a session, we default to the session's models
            const targetModelIds =
              currentSelectedAIs && currentSelectedAIs.length > 0
                ? currentSelectedAIs.filter(id => id !== 'ai')
                : currentSession.models;

            const linksToOpen: any[] = [];
            const newModels: string[] = [];

            targetModelIds.forEach(modelId => {
              const sessionIndex = currentSession.models.indexOf(modelId);
              if (sessionIndex !== -1) {
                // Already in session -> Follow up in existing tab
                let url = currentSession.urls[sessionIndex];

                // Safety: Avoid opening placeholder URLs in follow-ups
                if (!url || url.startsWith('about:blank')) {
                  url = DEFAULT_ALL_AI_URLS[modelId] || url;
                }

                const lowerUrl = url.toLowerCase();
                let kind: AutoSubmitKind = 'chatgpt';
                if (lowerUrl.includes('chatgpt.com')) kind = 'chatgpt';
                else if (lowerUrl.includes('claude.ai')) kind = 'claude';
                else if (lowerUrl.includes('perplexity.ai')) kind = 'perplexity';
                else if (lowerUrl.includes('gemini.google.com')) kind = 'gemini';

                linksToOpen.push({
                  url,
                  active: linksToOpen.length === 0,
                  autoSubmit: {
                    kind,
                    prompt: normalized,
                    images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
                  },
                  modelId,
                  forceNewTab: false,
                  targetTabId: currentSession.tabIds[sessionIndex],
                });
              } else {
                // New model added to active session -> OPEN NEW TAB
                newModels.push(modelId);
                const cmd = commands.find(c => c.id === modelId) || COMMANDS.find(c => c.id === modelId);
                if (cmd) {
                  const link = buildCommandLink(cmd, normalized, imagesWithBase64);
                  linksToOpen.push({
                    url: typeof link === 'string' ? link : link.url,
                    active: linksToOpen.length === 0,
                    autoSubmit: typeof link === 'string' ? undefined : link.autoSubmit,
                    modelId,
                  });
                }
              }
            });

            if (linksToOpen.length === 0) return;

            // Save the prompt to logs so it appears in the chat history
            saveAiLog(currentSession.sessionKey, normalized);

            const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);
            

            const updatedModels: string[] = [];
            const updatedTabIds: number[] = [];
            const updatedUrls: string[] = [];

            linksToOpen.forEach((item, index) => {
              if (item.modelId) {
                updatedModels.push(item.modelId);
                updatedTabIds.push(openedTabIds[index] || 0);
                updatedUrls.push(item.url);
              }
            });

            if (updatedTabIds.length > 0) {
              const mergedSession = {
                id: currentSession.id, // PRESERVE ID
                sessionKey: currentSession.sessionKey, // Preserve stable session key for logs
                prompt: currentSession.prompt || normalized, // KEEP ORIGINAL PROMPT as name/key, or use current if first time
                models: updatedModels,
                tabIds: updatedTabIds,
                urls: updatedUrls,
                name: currentSession.name, // PRESERVE AGENT NAME
              };
              setActiveAiSession(mergedSession);
              activeAiSessionRef.current = mergedSession;

              // Register updated session with background
              chrome.runtime.sendMessage({
                action: 'track_ai_session',
                prompt: normalized,
                tabIds: updatedTabIds,
                models: updatedModels,
              });
            }

            // Input clearing handled by the queue wrapper
            return;
          } catch (e) {
            console.error('[executeAggregateCommand] Failed to process active AI session', e);
          }
        }

        // Check payload size if files are provided
        if (images) {
          const filesOnly = images.filter(img => img.file).map(img => ({ file: img.file! }));
          const totalSize = getPayloadSize(normalized, filesOnly);
          if (totalSize > MAX_PAYLOAD_SIZE) {
            setFooterStatus({
              message: 'Attachments too large. Please reduce file size or count.',
              type: 'error',
            });
            setTimeout(() => setFooterStatus(null), 5000);
            return;
          }
        }

        // Use selected agent (from sidebar) or custom agents/links/automations (from agent panel)
        if (selectedAutomation || customAgents.length > 0 || customLinks.length > 0 || customAutomations.length > 0) {
          const linksToOpen: any[] = [];
          const aiModelsUsed: string[] = [];

          // 0. Process Selected Automation (Manual selection from sidebar)
          const currentAuto = selectedAutomationRef.current;
          let automationAgents: AgentItem[] = [];

          if (currentAuto && !activeAiSessionRef.current) {
            const raws = (currentAuto as any).steps || (currentAuto as any).automation_steps || [];

            // Check if this is an AI Agent (contains agent steps)
            const isAgentAutomation = raws.some((s: any) => {
              const moduleId = String(s?.module_id || s?.moduleId || '').toLowerCase();
              return moduleId === '5' || moduleId === 'agent' || s?.config?.agentId === 'all_ai' || s?.config?.isAllAi;
            });

            if (isAgentAutomation) {
              
              raws.forEach((step: any) => {
                const moduleId = String(step.module_id || step.moduleId || '').toLowerCase();
                const config = step.config || {};
                const isAiStep =
                  moduleId === '5' || moduleId === 'agent' || config.isAllAi || config.agentId === 'all_ai';

                if (isAiStep) {
                  let agentId = config.agentId || config.id || '';
                  // Normalize 'all_ai' to 'ai' for command lookup
                  if (agentId === 'all_ai') agentId = 'ai';

                  const cmd = commands.find(c => c.id === agentId) || COMMANDS.find(c => c.id === agentId);

                  if (cmd) {
                    automationAgents.push({
                      id: cmd.id,
                      name: cmd.label,
                      url: cmd.urlTemplate,
                      iconHost: cmd.iconHost,
                    });
                  } else if (config.agentUrl) {
                    automationAgents.push({
                      id: agentId || config.agentName || 'custom-agent',
                      name: config.agentName || 'Custom Agent',
                      url: config.agentUrl,
                      iconHost: '',
                    });
                  } else if (agentId === 'ai') {
                    // Fallback for global AI command
                    automationAgents.push({
                      id: 'ai',
                      name: 'All AI Chat Agents',
                      url: 'about:blank#ai:{query}',
                      iconHost: 'chatgpt.com',
                    });
                  }
                }
              });
            }

            if (!isAgentAutomation) {
              
              const inputs: Record<string, string> = {
                content: normalized,
                query: normalized,
                prompt: normalized,
              };
              for (let i = 1; i <= 9; i++) {
                inputs[`prompt${i}`] = normalized;
                inputs[`paste${i}`] = normalized;
              }

              const processedSteps = raws.map((step: any) => {
                const newConfig = { ...step.config };

                if (step.moduleId === 'paste') {
                  const paramKey = newConfig.paramKey || 'content';
                  if (inputs[paramKey] !== undefined) {
                    newConfig.content = inputs[paramKey];
                  }
                }

                Object.keys(newConfig).forEach(key => {
                  let val = newConfig[key];
                  if (typeof val === 'string') {
                    const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g;

                    val = val
                      .replace(VARIABLE_TOKEN_REGEX, (match, newFmtVar, typeVar, nameVar, legacyVar) => {
                        const variable = newFmtVar || nameVar || legacyVar;
                        const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                        if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                        if (variable && inputs[variable] !== undefined) return inputs[variable];
                        return match;
                      })
                      .replace(/%7B(?:[^%]|%(?!7D))*%7D/g, match => {
                        const decodedMatch = decodeURIComponent(match);
                        let replaced = decodedMatch.replace(
                          VARIABLE_TOKEN_REGEX,
                          (m, newFmtVar, typeVar, nameVar, legacyVar) => {
                            const variable = newFmtVar || nameVar || legacyVar;
                            const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                            if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                            if (variable && inputs[variable] !== undefined) return inputs[variable];
                            return m;
                          },
                        );
                        return replaced !== decodedMatch ? encodeURIComponent(replaced) : match;
                      });
                    newConfig[key] = val;
                  }
                });
                return { ...step, config: newConfig };
              });

              chrome.runtime.sendMessage({
                action: 'run_automation',
                automation: { ...currentAuto, steps: processedSteps },
              });

              // Input clearing handled by the queue wrapper
              return;
            }
          }

          // 1. Process Agents
          const agentsToRun = automationAgents.length > 0 ? automationAgents : customAgents;
          agentsToRun.forEach((agent, index) => {
            let url = agent.url;
            let autoSubmitPayload = undefined;

            // Use the robust buildUrl helper to handle all placeholder variations (e.g., {query}, {QUERY}, {query })
            url = buildUrl(agent.url, normalized);
            if (agent.url === url) {
              // Only if NO template replacement occurred (i.e. no {query} found), we set up auto-submit
              let kind = 'chatgpt';

              const idLower = String(agent.id || '').toLowerCase();
              const nameLower = String(agent.name || '').toLowerCase();

              if (idLower.includes('gpt') || nameLower.includes('gpt') || nameLower.includes('openai'))
                kind = 'chatgpt';
              else if (idLower.includes('claude') || nameLower.includes('claude') || nameLower.includes('anthropic'))
                kind = 'claude';
              else if (idLower.includes('gemini') || nameLower.includes('gemini') || nameLower.includes('bard'))
                kind = 'gemini';
              else if (idLower.includes('perplexity') || nameLower.includes('perplexity')) kind = 'perplexity';

              autoSubmitPayload = {
                kind: kind,
                prompt: normalized,
                images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
              };

              // Only track actual AI models that will get prompts (not just simple URL swaps)
              if (kind !== 'google') {
                aiModelsUsed.push(kind);
              }
            }

            linksToOpen.push({
              url: url,
              active: index === 0 && customLinks.length === 0, // Heuristic for active tab
              autoSubmit: autoSubmitPayload,
              modelId: autoSubmitPayload
                ? autoSubmitPayload.kind === 'chatgpt'
                  ? 'gpt'
                  : autoSubmitPayload.kind
                : undefined,
            });
          });

          // 2. Process Links
          customLinks.forEach(link => {
            let url = link.url;
            if (url.includes('{query}')) {
              url = url.replace('{query}', encodeURIComponent(normalized));
            }
            linksToOpen.push({
              url: url,
              active: false, // Generally background for workflow links
            });
          });

          // Execute combined links
          if (linksToOpen.length > 0) {
            // If there's only one agent, use its name. Otherwise use "All AI" or similar.
            const sessionName =
              currentAuto && automationAgents.length > 0
                ? currentAuto.name
                : agentsToRun.length === 1
                  ? agentsToRun[0].name
                  : agentsToRun.length > 1
                    ? 'Multiple Agents'
                    : 'All AI Chat Agents';

            const placeholderSession = {
              id: currentAuto?.id || `session-${Date.now()}`,
              sessionKey: `session-${Date.now()}`,
              prompt: normalized,
              models: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => l.modelId!),
              tabIds: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(() => 0),
              // Use appendCmdStatus for better tracking and UI identification
              urls: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => appendCmdStatus(l.url, true)),
              name: sessionName === 'All AI Chat Agents' ? normalized.slice(0, 50) : sessionName,
              workspace_id: currentAuto?.workspace_id ? String(currentAuto.workspace_id) : null,
              folder_id: currentAuto?.folder_id ? String(currentAuto.folder_id) : null,
            };

            // Sync selectedAIs state so sidebar highlighting matches the session
            const triggeredModelIds = placeholderSession.models;
            if (triggeredModelIds.length > 0) {
              setSelectedAIs(triggeredModelIds);
            }

            // 1. SAVE LOG FIRST (to ensure it's in storage before UI re-renders)
            await saveAiLog(placeholderSession.sessionKey, normalized);

            // 2. ACTIVATE SESSION SECOND
            setActiveAiSession(placeholderSession);
            activeAiSessionRef.current = placeholderSession;

            const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);

            const aiTrackedTabIds: number[] = [];
            const aiTrackedModels: string[] = [];
            const aiTrackedUrls: string[] = [];

            linksToOpen.forEach((item, index) => {
              if (item.autoSubmit && item.modelId && openedTabIds[index]) {
                aiTrackedTabIds.push(openedTabIds[index]);
                aiTrackedModels.push(item.modelId);
                aiTrackedUrls.push(appendCmdStatus(item.url, true));
              }
            });

            if (aiTrackedTabIds.length > 0) {
              const finalSession = {
                ...placeholderSession,
                models: aiTrackedModels,
                tabIds: aiTrackedTabIds,
                urls: aiTrackedUrls,
              };

              setActiveAiSession(prev => {
                // RACE CONDITION FIX: If the background script already sent us the final captured URL
                // (e.g. chatgpt.com/c/xxx), don't overwrite it with the initial base URL (chatgpt.com)
                if (!prev || prev.sessionKey !== placeholderSession.sessionKey) return finalSession;

                const mergedUrls = [...aiTrackedUrls];
                prev.urls.forEach((existingUrl, idx) => {
                  const isFinal =
                    existingUrl.includes('/c/') || existingUrl.includes('/app/') || existingUrl.includes('/search/');
                  const isPlaceholder =
                    !mergedUrls[idx] ||
                    !(
                      mergedUrls[idx].includes('/c/') ||
                      mergedUrls[idx].includes('/app/') ||
                      mergedUrls[idx].includes('/search/')
                    );

                  if (isFinal && isPlaceholder) {
                    mergedUrls[idx] = existingUrl;
                  }
                });

                const updated = {
                  ...finalSession,
                  urls: mergedUrls,
                };
                activeAiSessionRef.current = updated;
                return updated;
              });

              chrome.runtime.sendMessage({
                action: 'track_ai_session',
                prompt: normalized,
                tabIds: aiTrackedTabIds,
                models: aiTrackedModels,
              });
            }
          }

          // 3. Process Automations (Trigger them directly)
          customAutomations.forEach(auto => {
            
            const inputs: Record<string, string> = {
              content: normalized,
              query: normalized,
              prompt: normalized,
            };
            for (let i = 1; i <= 9; i++) {
              inputs[`prompt${i}`] = normalized;
              inputs[`paste${i}`] = normalized;
            }

            const processedSteps = auto.steps.map((step: any) => {
              const newConfig = { ...step.config };

              if (step.moduleId === 'paste') {
                const paramKey = newConfig.paramKey || 'content';
                if (inputs[paramKey] !== undefined) {
                  newConfig.content = inputs[paramKey];
                }
              }

              Object.keys(newConfig).forEach(key => {
                let val = newConfig[key];
                if (typeof val === 'string') {
                  const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g;

                  val = val
                    .replace(VARIABLE_TOKEN_REGEX, (match, newFmtVar, typeVar, nameVar, legacyVar) => {
                      const variable = newFmtVar || nameVar || legacyVar;
                      const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                      if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                      if (variable && inputs[variable] !== undefined) return inputs[variable];
                      return match;
                    })
                    .replace(/%7B(?:[^%]|%(?!7D))*%7D/g, match => {
                      const decodedMatch = decodeURIComponent(match);
                      let replaced = decodedMatch.replace(
                        VARIABLE_TOKEN_REGEX,
                        (m, newFmtVar, typeVar, nameVar, legacyVar) => {
                          const variable = newFmtVar || nameVar || legacyVar;
                          const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                          if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                          if (variable && inputs[variable] !== undefined) return inputs[variable];
                          return m;
                        },
                      );
                      return replaced !== decodedMatch ? encodeURIComponent(replaced) : match;
                    });
                  newConfig[key] = val;
                }
              });
              return { ...step, config: newConfig };
            });

            chrome.runtime.sendMessage({
              action: 'run_automation',
              automation: { ...auto, steps: processedSteps },
            });
          });

          // Input clearing handled by the queue wrapper
          return;
        }

        // Fallback to original logic if no custom items
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get(
            ['selectedAIs', 'custom_ai_models', 'selected_custom_ai_models'],
            async (result: any) => {
              const selection =
                result.selectedAIs && Array.isArray(result.selectedAIs) ? result.selectedAIs : DEFAULT_SELECTED_AIS;

              // Filter to only installed and SELECTED AIs
              const targetAIs = AI_GROUP.members.filter((id: string) => {
                if (id === 'ai') return false;
                const isInstalled = commands.some(c => c.id === id) || COMMANDS.some(c => c.id === id);
                const isSelected = selection.includes(id);
                return isInstalled && isSelected;
              });

              

              const linksToOpen: any[] = [];

              targetAIs.forEach((id: string) => {
                const cmd = commands.find(c => c.id === id) || COMMANDS.find(c => c.id === id);
                if (cmd) {
                  const link = buildCommandLink(cmd, normalized, imagesWithBase64);
                  linksToOpen.push({
                    url: typeof link === 'string' ? link : link.url,
                    active: false,
                    autoSubmit: typeof link === 'string' ? undefined : link.autoSubmit,
                    modelId: id,
                  });
                }
              });

              // Process Custom AIs
              const customModels = result.custom_ai_models || [];
              const selectedCustomIds = result.selected_custom_ai_models || [];
              const targetCustoms = customModels.filter((m: any) => selectedCustomIds.includes(m.id));

              targetCustoms.forEach((custom: any) => {
                let kind: AutoSubmitKind = 'chatgpt';
                const lowerUrl = custom.url.toLowerCase();
                if (lowerUrl.includes('chatgpt.com')) kind = 'chatgpt';
                else if (lowerUrl.includes('claude.ai')) kind = 'claude';
                else if (lowerUrl.includes('perplexity.ai')) kind = 'perplexity';
                else if (lowerUrl.includes('gemini.google.com')) kind = 'gemini';

                linksToOpen.push({
                  url: custom.url,
                  active: false,
                  autoSubmit: {
                    kind,
                    prompt: normalized,
                    images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
                  },
                  modelId: custom.id,
                });
              });

              if (linksToOpen.length === 0) {
                console.warn('[executeAggregateCommand] No standard or custom AI commands selected');
                return;
              }

              // First one should be active
              linksToOpen[0].active = true;

              
              // Input clearing handled by the queue wrapper

              // Set a preliminary session IMMEDIATELY (before tabs open) so follow-ups don't fall through
              const placeholderSession = {
                id: `session-${Date.now()}`,
                sessionKey: `session-${Date.now()}`,
                prompt: normalized,
                models: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => l.modelId!),
                tabIds: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(() => 0),
                urls: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => appendCmdStatus(l.url, true)),
                // NOTE: do NOT set `name` here — it is reserved for saved agent names.
                // AICommandLockedUI uses `activeAiSession?.name` as a guard to block the Save Agent modal.
                // Setting it on every new session would permanently prevent the user from saving.
              };

              // Sync selectedAIs state
              const triggeredModelIds = placeholderSession.models;
              if (triggeredModelIds.length > 0) {
                setSelectedAIs(triggeredModelIds);
              }

              // 1. SAVE LOG FIRST
              await saveAiLog(placeholderSession.sessionKey, normalized);

              // 2. ACTIVATE SESSION SECOND
              setActiveAiSession(placeholderSession);
              activeAiSessionRef.current = placeholderSession;

              const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);
              const aiTrackedTabIds: number[] = [];
              const aiTrackedModels: string[] = [];
              const aiTrackedUrls: string[] = [];

              linksToOpen.forEach((item, index) => {
                if (item.autoSubmit && item.modelId && openedTabIds[index]) {
                  aiTrackedTabIds.push(openedTabIds[index]);
                  aiTrackedModels.push(item.modelId);
                  aiTrackedUrls.push(item.url);
                }
              });

              if (aiTrackedTabIds.length > 0) {
                const finalSession = {
                  id: placeholderSession.id,
                  sessionKey: placeholderSession.sessionKey,
                  prompt: placeholderSession.prompt,
                  models: aiTrackedModels,
                  tabIds: aiTrackedTabIds,
                  urls: aiTrackedUrls,
                  name: activeAiSessionRef.current?.name || undefined, // PRESERVE SAVED AGENT NAME only (not prompt text)
                };

                setActiveAiSession(prev => {
                  // RACE CONDITION FIX: Don't let initial base URLs overwrite final captured chat links
                  if (!prev || prev.sessionKey !== placeholderSession.sessionKey) return finalSession;

                  const mergedUrls = [...aiTrackedUrls];
                  prev.urls.forEach((existingUrl, idx) => {
                    const isFinal =
                      existingUrl.includes('/c/') || existingUrl.includes('/app/') || existingUrl.includes('/search/');
                    const isPlaceholder =
                      !mergedUrls[idx] ||
                      !(
                        mergedUrls[idx].includes('/c/') ||
                        mergedUrls[idx].includes('/app/') ||
                        mergedUrls[idx].includes('/search/')
                      );
                    if (isFinal && isPlaceholder) {
                      mergedUrls[idx] = existingUrl;
                    }
                  });

                  const updated = { ...finalSession, urls: mergedUrls };
                  activeAiSessionRef.current = updated;
                  return updated;
                });

                // Register session with background so it tracks URL changes for each tab
                // This triggers ai_session_url_updated when the tab navigates to its conversation URL
                chrome.runtime.sendMessage({
                  action: 'track_ai_session',
                  prompt: normalized,
                  tabIds: aiTrackedTabIds,
                  models: aiTrackedModels,
                });
              }
            },
          );
        } else {
          // Fallback if storage unavailable
          const targetAIs = AI_GROUP.members.filter(
            id => id !== 'ai' && (commands.some(c => c.id === id) || COMMANDS.some(c => c.id === id)),
          );
          const linksToOpen = targetAIs
            .map(id => {
              const cmd = commands.find(c => c.id === id) || COMMANDS.find(c => c.id === id);
              if (!cmd) return null;
              const link = buildCommandLink(cmd, normalized, imagesWithBase64);
              return {
                url: typeof link === 'string' ? link : link.url,
                active: false,
                autoSubmit: typeof link === 'string' ? undefined : link.autoSubmit,
                modelId: id,
              };
            })
            .filter((item): item is NonNullable<typeof item> => !!item);

          if (linksToOpen.length > 0) {
            linksToOpen[0].active = true;
            // Input clearing handled by the queue wrapper

            // Set a preliminary session IMMEDIATELY (before tabs open) so follow-ups don't fall through
            const placeholderSession = {
              id: `session-${Date.now()}`,
              sessionKey: `session-${Date.now()}`,
              prompt: normalized,
              models: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => l.modelId!),
              tabIds: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(() => 0),
              urls: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => appendCmdStatus(l.url, true)),
              name: normalized.slice(0, 50),
            };

            // Sync selectedAIs state
            const triggeredModelIds = placeholderSession.models;
            if (triggeredModelIds.length > 0) {
              setSelectedAIs(triggeredModelIds);
            }

            // 1. SAVE LOG FIRST
            await saveAiLog(placeholderSession.sessionKey, normalized);

            // 2. ACTIVATE SESSION SECOND
            setActiveAiSession(placeholderSession);
            activeAiSessionRef.current = placeholderSession;

            openLinksWithAutoSubmit(linksToOpen).then(openedTabIds => {
              const aiTrackedTabIds: number[] = [];
              const aiTrackedModels: string[] = [];
              const aiTrackedUrls: string[] = [];

              linksToOpen.forEach((item, index) => {
                if (item.autoSubmit && item.modelId && openedTabIds[index]) {
                  aiTrackedTabIds.push(openedTabIds[index]);
                  aiTrackedModels.push(item.modelId);
                  aiTrackedUrls.push(item.url);
                }
              });

              if (aiTrackedTabIds.length > 0) {
                const finalSession = {
                  id: placeholderSession.id,
                  sessionKey: placeholderSession.sessionKey,
                  prompt: placeholderSession.prompt,
                  models: aiTrackedModels,
                  tabIds: aiTrackedTabIds,
                  urls: aiTrackedUrls,
                  name: activeAiSessionRef.current?.name, // PRESERVE AGENT NAME IF EXISTS
                };
                setActiveAiSession(finalSession);
                activeAiSessionRef.current = finalSession;

                // Register session with background for URL change tracking
                const chromeAny = (window as any)?.chrome;
                chromeAny?.runtime?.sendMessage?.({
                  action: 'track_ai_session',
                  prompt: normalized,
                  tabIds: aiTrackedTabIds,
                  models: aiTrackedModels,
                });

                setLockedCommand('ai');
              }
            });
          }
        }
      },
      [
        customAgents,
        customLinks,
        customAutomations,
        selectedAIs,
        openLinksWithAutoSubmit,
        COMMANDS,
        mentionedTabs,
        lockedCommand,
      ],
    );

    const processQueue = useCallback(async () => {
      if (isProcessingQueueRef.current || promptQueueRef.current.length === 0) return;
      isProcessingQueueRef.current = true;
      try {
        while (promptQueueRef.current.length > 0) {
          const item = promptQueueRef.current.shift()!;
          try {
            await executeAggregateCommand(item.prompt, item.images, item.historyUrls);
          } catch (e) {
            console.error('[Searchbar] Prompt processing failed:', e);
          }
          if (promptQueueRef.current.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } finally {
        isProcessingQueueRef.current = false;
      }
    }, [executeAggregateCommand]);

    const runAggregateCommand = useCallback(
      async (
        prompt: string,
        images?: { file?: File; base64?: string; mimeType: string; filename: string }[] | null,
        historyUrls?: string[],
      ) => {
        const normalized = prompt.trim();
        if (normalized || (images && images.length > 0)) {
          trackCounterEvent('command_count', { source: 'new_tab', commandId: 'ai', commandType: 'aggregate' });
        } else {
          return;
        }

        // Visual feedback: clear input but KEEP the lock to prevent UI flicker (like Favorite panel showing)
        resetAfterCommandExecution({ preserveAiLock: true });

        promptQueueRef.current.push({ prompt: normalized, images, historyUrls });
        processQueue();
      },
      [processQueue, resetAfterCommandExecution],
    );

    const runRemoteCommand = useCallback(
      async (
        command: CommandDefinition,
        prompt: string,
        images?: { file: File; mimeType: string; filename: string }[] | null,
      ) => {
        const normalized = prompt.trim();
        const hasPayload = normalized.length > 0 || (images && images.length > 0);

        // Check payload size
        const totalSize = getPayloadSize(normalized, images);
        if (totalSize > MAX_PAYLOAD_SIZE) {
          triggerToast('Total size too large (~100MB limit). Please remove some files.', 'error');
          return;
        }

        

        // Convert images to base64 for background submission
        const imagesWithBase64 = images
          ? await Promise.all(
            images.map(async img => ({
              base64: await fileToBase64(img.file),
              mimeType: img.mimeType,
              filename: img.filename,
            })),
          )
          : null;

        // Safety: Never navigate to about:blank URLs directly - these are special commands
        // that need dedicated handling (e.g., 'ai' should use runAggregateCommand)
        if (command.urlTemplate.startsWith('about:blank')) {
          console.warn('[runRemoteCommand] Blocked about:blank navigation for command:', command.id);
          // If it's the AI command, use aggregate handler
          if (command.id === 'ai' && (normalized || (images && images.length > 0))) {
            
            runAggregateCommand(normalized, images);
          }
          return;
        }

        // Browser commands don't require prompts - execute immediately
        const isBrowserCommand = command.category === 'browser' && !command.urlTemplate.includes('{query}');
        if (isBrowserCommand) {
          trackCounterEvent('command_count', {
            source: 'new_tab',
            commandId: command.id,
            commandType: 'remote',
            browserInstant: true,
          });
          // Browser commands execute immediately without prompt
          openSingleLink(buildCommandLink(command, '', null), false, currentTabId);
          return;
        }

        // Other commands require prompts UNLESS an image is present (image-only mode for GPT)
        if (!normalized && (!images || images.length === 0)) return;

        if ((command.id as string) === 'event') {
          const result = createEventUrlFromText(normalized);
          if ('error' in result) {
            window.alert(result.error);
          } else {
            trackCounterEvent('command_count', { source: 'new_tab', commandId: command.id, commandType: 'remote' });
            openSingleLink(result.url, false, currentTabId);
          }
          return;
        }
        const link = buildCommandLink(command, normalized, imagesWithBase64);

        if (typeof link !== 'string' && link.autoSubmit) {
          const size = JSON.stringify(link.autoSubmit).length;
          if (size > 60 * 1024 * 1024) {
            setFooterStatus({
              message: 'Attachments too large. Please reduce file size or count.',
              type: 'error',
            });
            setTimeout(() => setFooterStatus(null), 5000);
            return;
          }
        }

        if (hasPayload || !command.urlTemplate.includes('{query}')) {
          trackCounterEvent('command_count', { source: 'new_tab', commandId: command.id, commandType: 'remote' });
        }
        openSingleLink(link, false, currentTabId);
      },
      [currentTabId, runAggregateCommand, buildCommandLink],
    );

    // Centralized function to expand @mentions to their snippet/prompt content
    const expandPrompts = useCallback(
      (text: string): string => {
        let expanded = text;
        const mentionRegex = /@(\w[\w\s]*?)(?=\s|$)/g;
        const mentions = [...text.matchAll(mentionRegex)];

        if (mentions.length > 0) {
          mentions.forEach(match => {
            const title = match[1].toLowerCase();
            // Prioritize 'prompt' category, but fallback to 'snippet' if needed
            // Use case-insensitive matching
            const entry = snippetIndex.find(
              e => e.snippet.key?.toLowerCase() === title && (e.category === 'prompt' || e.category === 'snippet'),
            );

            if (entry) {
              const { valueText } = parseValue(entry.snippet);
              expanded = expanded.replace(match[0], valueText);
            }
          });
        }
        return expanded;
      },
      [snippetIndex],
    );

    const submitInlineQuery = useCallback(() => {
      if (!pendingQueryUrls || pendingQueryUrls.length === 0) return;

      const q = value.trim();
      // If user provided no input, maybe they want to keep the literal {query}?
      // But typically we enforce a value. Let's assume we allow empty if they really want,
      // but usually we want to replace.
      // Actually, if empty, we might just skip replacement? Or encoded empty string?
      // Let's stick to current behavior: check !q return.
      if (!q && q !== '') return; // Allow empty string if they want

      const encoded = encodeURIComponent(q);
      const currentUrl = pendingQueryUrls[0];
      const processedUrl = currentUrl.replace(/\[query\]/gi, encoded).replace(/\{query\}/gi, encoded);

      // Move to next
      const remaining = pendingQueryUrls.slice(1);
      const newReady = [...processedReadyUrls, processedUrl];

      // Continue recursion
      processNextUrl(remaining, newReady, pendingQueryLabel);
    }, [pendingQueryUrls, processedReadyUrls, value, processNextUrl, pendingQueryLabel]);

    const activateSnippetSuggestion = useCallback(
      (selection: SnippetSuggestion | null | undefined) => {
        if (!selection) return;
        const snippet = selection.snippet;
        const category = (snippet.category || '').toLowerCase();
        let urls: string[] = [];
        if (typeof snippet.value === 'string') {
          const raw = snippet.value as string;
          try {
            const parsed = JSON.parse(raw || '{}');
            if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
              urls = parsed.urls as string[];
            } else if (raw.startsWith('http')) {
              urls = [raw];
            }
          } catch {
            if (raw.startsWith('http')) {
              urls = [raw];
            }
          }
        } else if (
          snippet &&
          snippet.value &&
          typeof snippet.value === 'object' &&
          'urls' in (snippet.value as any) &&
          Array.isArray((snippet.value as any).urls)
        ) {
          urls = (((snippet.value as any).urls || []) as string[]).filter(Boolean);
        }

        // Handle quick links, regular links, and links with different case
        if (
          !urls.length &&
          (category === 'link' || category === 'links' || category === 'quicklink') &&
          typeof snippet.value === 'string'
        ) {
          urls = [snippet.value as string];
        }

        if (urls.length) {
          handleRequestOpenUrls(urls, snippet.key);
          return;
        }

        handleSnippetSelect(selection);
      },
      [handleRequestOpenUrls, handleSnippetSelect],
    );

    const executeCommonCommand = useCallback(
      async (item: CommonCommandSuggestionItem) => {
        const promptRaw = item.query.trim();
        const prompt = expandPrompts(promptRaw);

        

        // Convert images to base64 if needed
        const imagesWithBase64 = await Promise.all(
          selectedImages.map(async img => ({
            base64: await fileToBase64(img.file),
            mimeType: img.mimeType,
            filename: img.filename,
          })),
        );

        // Check if it's a remote command
        const remoteCmd = commands.find(c => c.id === item.id) || COMMANDS.find(c => c.id === item.id);
        if (remoteCmd && remoteCmd.category !== 'ai' && item.id !== 'ai') {
          
          const words = promptRaw.split(/\s+/);
          const triggerWords = [remoteCmd.id, remoteCmd.prefix.replace('/', ''), ...(remoteCmd.keywords || [])];
          
          const filteredWords = words.filter(word => {
            const normalizedWord = word.toLowerCase();
            return !triggerWords.some(trigger => 
              trigger.toLowerCase().startsWith(normalizedWord) || 
              normalizedWord.startsWith(trigger.toLowerCase())
            );
          });
          const extractedQuery = filteredWords.join(' ').trim();
          
          activateCommandById(item.id as AnyCommandId, extractedQuery);
          return;
        }

        // If prompt is empty AND files are attached, entering "command mode" is better UX
        // If prompt is empty but NO files are attached, open the AI tool's site directly (old behavior).
        if (!prompt) {
          if (selectedImages.length > 0) {
            activateCommandById(item.id as AnyCommandId);
          } else {
            // Old behavior: open site directly
            const link = buildCommandLink(item.command, '', []);
            trackCounterEvent('command_count', {
              source: 'new_tab',
              commandId: item.id,
              commandType: item.id === 'ai' ? 'aggregate' : 'remote',
              via: 'common_command_direct',
            });
            openSingleLink(link, false, currentTabId);
          }
          return;
        }

        // Special handling for "All AI" command - Redirect to internal AI locked view
        if (item.id === 'ai') {
          // 1. Ensure UI transitions to locked mode for immediate internal feedback
          setLockedCommand('ai');
          setCommandPrompt(promptRaw);

          // 2. Trigger the internal execution logic
          // Use prompt (expanded) and imagesWithBase64
          runAggregateCommand(prompt, imagesWithBase64);

          // 3. Clear local state for a clean transition (locked state is handled above)
          setShowPromo(false);
          suggestionVisibilityRef.current = false;
          return;
        }

        // Check if the regular command is installed
        const isInstalled = commands.some(c => c.id === item.id || c.id === item.command.id);
        if (!isInstalled) {
          
          setCommandNotInstalledDialog({
            isOpen: true,
            commandName: item.label || item.id,
            commandId: item.id as string,
          });
          return;
        }

        trackCounterEvent('command_count', {
          source: 'new_tab',
          commandId: item.id,
          commandType: 'remote',
          via: 'common_command',
        });

        // Pass imagesWithBase64 to buildCommandLink
        const link = buildCommandLink(item.command, prompt, imagesWithBase64);

        if (typeof link !== 'string' && link.autoSubmit) {
          const size = JSON.stringify(link.autoSubmit).length;
          if (size > 60 * 1024 * 1024) {
            setFooterStatus({
              message: 'Attachments too large. Please reduce file size or count.',
              type: 'error',
            });
            setTimeout(() => setFooterStatus(null), 5000);
            return;
          }
        }

        openSingleLink(link, false, currentTabId);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
      },
      [commands, currentTabId, selectedImages, expandPrompts, activateCommandById],
    );

    const handleCommandMouseDown = useCallback(
      (event: React.MouseEvent, commandId: AnyCommandId) => {
        event.preventDefault();
        event.stopPropagation();

        const currentQuery = valueRef.current?.trim() || '';
        

        if (isBoardViewEnabled && activeSlashFilter) {
          activeSlashFilterRef.current = null;
          setActiveSlashFilter(null);
          setValue('');
          activateCommandById(commandId, '');
          return;
        }

        if (!checkLocalCommandAuth(commandId)) {
          console.warn('[DEBUG handleCommandMouseDown] Local command auth check failed for:', commandId);
          return;
        }

        // ✅ LOCAL COMMANDS
        if (isLocalCommandId(commandId as string)) {
          const def = LOCAL_COMMANDS.find(c => c.id === (commandId as LocalCommandId));
          

          if (def?.behavior === 'instant') {
            const execId = def.executeId || def.id;
            handleLocalCommandExecute(execId as any);
            return;
          }

          // 🚀 FORCE EXECUTE instead of selecting
          handleLocalCommandExecute(def?.id as any);
          return;
        }

        // ✅ REMOTE COMMANDS (Google, YouTube, etc.)
        const remoteCmd = commands.find(c => c.id === commandId) || COMMANDS.find(c => c.id === commandId);

        if (remoteCmd) {
          
          const isAiGroupMember = AI_GROUP.members.includes(remoteCmd.id as any) || remoteCmd.id === 'ai';

          // Extract the query by removing the command identifier/keywords that triggered it
          const words = currentQuery.split(/\s+/);
          const triggerWords = [remoteCmd.id, remoteCmd.prefix.replace('/', ''), ...(remoteCmd.keywords || [])];
          
          const filteredWords = words.filter(word => {
            const normalizedWord = word.toLowerCase();
            return !triggerWords.some(trigger => 
              trigger.toLowerCase().startsWith(normalizedWord) || 
              normalizedWord.startsWith(trigger.toLowerCase())
            );
          });
          let extractedQuery = filteredWords.join(' ').trim();
          extractedQuery = extractedQuery.replace(/^\/([aAnsSplLcCbBtT])\s*/i, '');
          

          // Lock the command and pre-fill the search input with the remaining text
          activateCommandById(commandId, extractedQuery);
          return;
        }

        // ✅ AI COMMAND
        if (commandId === 'ai') {
          if (!currentQuery) {
            activateCommandById('ai', '');
          } else {
            onCommandExecute?.('ai', { prompt: currentQuery });
          }
          return;
        }

        // fallback
        activateCommandById(commandId, currentQuery);
      },
      [commands, runRemoteCommand, activateCommandById, handleLocalCommandExecute, onCommandExecute, isBoardViewEnabled, activeSlashFilter],
    );

    const handleHighlightIndexChange = useCallback((index: number) => {
      setHighlightIndex(index);
    }, []);

    const handleCollectionSubmit = useCallback(async () => {
      if (!activeCollection) return;

      // 0. Collect all images from fields (pre-convert to base64)
      const fieldImagesBase64: { base64: string; mimeType: string; filename: string }[] = [];
      for (const f of activeCollection.fields) {
        if (f.type === 'image' && f.images) {
          for (const img of f.images) {
            try {
              const base64 = await fileToBase64(img.file);
              fieldImagesBase64.push({ base64, mimeType: img.mimeType, filename: img.filename });
            } catch (err) {
              console.error('[Searchbar] Image conversion failed:', err);
            }
          }
        }
      }

      

      const fieldsForExecution = activeCollection.fields.map(field => {
        if (field.type === 'image') return field;
        // Combine all values (main value + extraValues) with spaces for display
        const parts = [field.value, ...(field.extraValues || [])]
          .map(val => (typeof val === 'string' ? val.trim() : ''))
          .filter(Boolean);
        const combinedValue = parts.join(' ');
        return { ...field, value: combinedValue };
      });

      

      const collectionFields = fieldsForExecution;

      // 1. Process Agents
      const finalAgents = activeCollection.agents
        .map((a: any) => {
          let newUrl = a.url || '';
          let specificPromptValue = '';

          collectionFields.forEach(f => {
            let replaced = false;
            const isDirectMatch = a.promptLabel === f.key;

            const anyRegex = new RegExp(`(?:\\{|%7B|\\[)${f.key}(?:\\}|%7D|\\])`, 'gi');
            if (anyRegex.test(newUrl)) {
              newUrl = newUrl.replace(anyRegex, (match: string) => {
                return match.startsWith('%') ? encodeURIComponent(f.value) : f.value;
              });
              replaced = true;
            }

            if (f.key === 'query') {
              if (newUrl.includes('{query}') || newUrl.includes('[query]')) {
                newUrl = newUrl.replace(/\{query\}/gi, encodeURIComponent(f.value));
                newUrl = newUrl.replace(/\[query\]/gi, encodeURIComponent(f.value));
                replaced = true;
              }
            } else if (f.key.startsWith('prompt')) {
              const num = f.key.replace('prompt', '');
              const hasExplicitQueryField = collectionFields.some(field => field.key === 'query');
              if (num === '1' && !hasExplicitQueryField && (newUrl.includes('{query}') || newUrl.includes('[query]'))) {
                newUrl = newUrl.replace(/\{query\}/gi, encodeURIComponent(f.value));
                newUrl = newUrl.replace(/\[query\]/gi, encodeURIComponent(f.value));
                replaced = true;
              }
            }

            if ((replaced || isDirectMatch) && f.value.trim()) {
              if (!specificPromptValue.includes(f.value.trim())) {
                specificPromptValue += (specificPromptValue ? ' ' : '') + f.value.trim();
              }
            }
          });

          let kind: 'chatgpt' | 'claude' | 'perplexity' | 'gemini' | null = null;
          if (newUrl.includes('chatgpt.com')) kind = 'chatgpt';
          else if (newUrl.includes('claude.ai')) kind = 'claude';
          else if (newUrl.includes('perplexity.ai')) kind = 'perplexity';
          else if (newUrl.includes('gemini.google.com')) kind = 'gemini';

          if (kind) {
            let promptForAutoSubmit = specificPromptValue;
            if (!promptForAutoSubmit) {
              try {
                const urlObj = new URL(newUrl);
                promptForAutoSubmit = urlObj.searchParams.get('q') || '';
              } catch (e) {
                const queryField = collectionFields.find(f => f.key === 'query');
                promptForAutoSubmit = queryField ? queryField.value : '';
              }
            }
            if (!promptForAutoSubmit) {
              const queryField = collectionFields.find(f => f.key === 'query');
              promptForAutoSubmit = queryField ? queryField.value : '';
            }
            if (!promptForAutoSubmit) {
              const allPopulatedValues = collectionFields
                .filter(f => f.value && f.value.trim().length > 0)
                .map(f => f.value.trim());
              if (allPopulatedValues.length > 0) {
                promptForAutoSubmit = allPopulatedValues.join(' ');
              }
            }

            let standardUrl = newUrl;
            const isSpecificChat =
              (kind === 'chatgpt' && (newUrl.includes('/c/') || newUrl.includes('/g/'))) ||
              (kind === 'claude' && newUrl.includes('/chat/')) ||
              (kind === 'perplexity' && newUrl.includes('/search/') && !newUrl.includes('?q='));

            if (promptForAutoSubmit || (selectedImages && selectedImages.length > 0) || fieldImagesBase64.length > 0) {
              if (!isSpecificChat) {
                if (kind === 'chatgpt')
                  standardUrl = `https://chatgpt.com/?q=${encodeURIComponent(promptForAutoSubmit)}`;
                else if (kind === 'claude')
                  standardUrl = `https://claude.ai/new?q=${encodeURIComponent(promptForAutoSubmit)}`;
                else if (kind === 'perplexity')
                  standardUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(promptForAutoSubmit)}`;
                else if (kind === 'gemini') standardUrl = 'https://gemini.google.com/app';
              }
              // Merge field images with globally selected images if any
              const finalImages = [...(selectedImages || []), ...fieldImagesBase64];
              return { url: standardUrl, autoSubmit: { kind, prompt: promptForAutoSubmit, images: finalImages } };
            }
          }
          return newUrl;
        })
        .filter(Boolean);

      // 2. Process Links
      const finalLinks = (activeCollection.links || [])
        .map((link: any) => {
          let url = link.url || '';
          const hasExplicitQueryField = collectionFields.some((field: any) => field.key === 'query');
          collectionFields.forEach(f => {
            const regex = new RegExp(`(?:\\\\{|\\\\[|%7B)${f.key}(?:\\\\}|\\\\]|%7D)`, 'gi');
            url = url.replace(regex, encodeURIComponent(f.value));
            if (f.key === 'query' || (!hasExplicitQueryField && f.key === 'prompt1')) {
              url = url.replace(/\{query\}/gi, encodeURIComponent(f.value));
              url = url.replace(/\[query\]/gi, encodeURIComponent(f.value));
            }
          });
          return url;
        })
        .filter(Boolean);

      // 3. Process Automations
      (activeCollection.automations || []).forEach((auto: any) => {
        const inputs: Record<string, string> = {};
        const scopedInputsByStep = new Map<number, Record<string, string>>();
        const constantInputs = activeCollection.constantInputs || {};

        Object.entries(constantInputs).forEach(([key, value]) => {
          if (typeof value === 'string' && value.trim() !== '') {
            inputs[key] = value;
          }
        });

        if (typeof window !== 'undefined' && (window as any).__LAST_TYPED_SEARCH_QUERY__) {
          const typedText = (window as any).__LAST_TYPED_SEARCH_QUERY__;
          if (!inputs['content']) inputs['content'] = typedText;
          if (!inputs['query']) inputs['query'] = typedText;
        }

        // Populate inputs: combine multiple values within same (step, sourceVariable) pair with spaces
        const fieldsByStepAndVar = new Map<string, SearchbarAutomationField[]>();
        
        collectionFields.forEach((f, idx) => {
          
        });

        collectionFields.forEach(f => {
          if (typeof f.sourceStepIndex === 'number' && f.sourceVariable) {
            const key = `${f.sourceStepIndex}:${f.sourceVariable}`;
            if (!fieldsByStepAndVar.has(key)) {
              fieldsByStepAndVar.set(key, []);
            }
            fieldsByStepAndVar.get(key)!.push(f);
            return;
          }
          if (f.value && typeof f.value === 'string' && f.value.trim() !== '') {
            inputs[f.key] = f.value;
          }
        });

        
        fieldsByStepAndVar.forEach((fields, key) => {
          
        });

        // Combine fields that share the same step and sourceVariable
        fieldsByStepAndVar.forEach((fieldsWithSameVar, compositeKey) => {
          const [stepIndex, sourceVariable] = compositeKey.split(':');
          const step = parseInt(stepIndex, 10);

          
          const combinedValue = fieldsWithSameVar
            .map((f, i) => {
              
              return f.value;
            })
            .filter(v => v && String(v).trim() !== '')
            .join(' ');

          

          if (combinedValue) {
            const scoped = scopedInputsByStep.get(step) || {};
            scoped[sourceVariable] = combinedValue;
            scopedInputsByStep.set(step, scoped);
          }
        });

        // Add fallbacks
        const hasQuery = inputs['query'] !== undefined;
        const hasPrompt1 = inputs['prompt1'] !== undefined;

        if (hasQuery) {
          if (!inputs['content']) inputs['content'] = inputs['query'];
          if (!inputs['prompt']) inputs['prompt'] = inputs['query'];
        } else if (hasPrompt1) {
          if (!inputs['content']) inputs['content'] = inputs['prompt1'];
          if (!inputs['query']) inputs['query'] = inputs['prompt1'];
          if (!inputs['prompt']) inputs['prompt'] = inputs['prompt1'];
        }

        collectionFields.forEach(f => {
          if (f.key.startsWith('prompt') && !inputs[f.key.replace('prompt', 'paste')]) {
            inputs[f.key.replace('prompt', 'paste')] = f.value;
          } else if (f.key.startsWith('paste') && !inputs[f.key.replace('paste', 'prompt')]) {
            inputs[f.key.replace('paste', 'prompt')] = f.value;
          }
        });

        // Don't build pasteStepInputMap - use scopedInputsByStep instead which has ALL fields per step
        // (pasteStepInputMap was incomplete and only stored one field per step)

        // Recursive step processor that handles sub_automations, agents, and normal steps
        const processSteps = (steps: any[]): any[] => {
          return steps.map((step: any, stepIndex: number) => {
            const newConfig = { ...step.config };

            // For agent steps: inject the resolved prompt value and collected images
            if (step.moduleId === 'agent') {
              if (newConfig.prompts && newConfig.prompts.length > 0) {
                const promptValues = newConfig.prompts
                  .map((p: any) => (inputs[p.key] !== undefined ? inputs[p.key] : ''))
                  .filter((v: string) => v.trim() !== '');
                if (promptValues.length > 0) {
                  newConfig.promptValue = promptValues.join('\n\n');
                }
              } else {
                const promptLabel = newConfig.promptLabel || '';
                if (promptLabel && inputs[promptLabel] !== undefined) {
                  newConfig.promptValue = inputs[promptLabel];
                }
              }
              // If the agent supports images, pass the collected images
              if (newConfig.supportImage) {
                newConfig.images = fieldImagesBase64;
              }
            }

            // For paste steps: map scoped inputs directly to content
            if (step.moduleId === 'paste') {
              const scopedInputs = scopedInputsByStep.get(stepIndex) || {};
              const paramKey = newConfig.paramKey || 'content';
              if (scopedInputs[paramKey] !== undefined) {
                newConfig.content = scopedInputs[paramKey];
              } else if (inputs[paramKey] !== undefined) {
                newConfig.content = inputs[paramKey];
              } else if (inputs['content'] !== undefined) {
                newConfig.content = inputs['content'];
              } else if (inputs['query'] !== undefined) {
                newConfig.content = inputs['query'];
              } else {
                // Fallback 1: Check if there is ANY scoped input for this specific step
                const scopedValues = Object.values(scopedInputs).filter(v => typeof v === 'string' && v.trim() !== '');
                if (scopedValues.length > 0) {
                  newConfig.content = scopedValues[0];
                } else {
                  // Fallback 2: If only one text input was provided across all fields, use it as paste content
                  const providedValues = Object.values(inputs).filter(v => typeof v === 'string' && v.trim() !== '');
                  if (providedValues.length === 1) {
                    newConfig.content = providedValues[0];
                  }
                }
              }
            }

            // For sub_automation steps: recursively process their child steps
            if (step.moduleId === 'sub_automation' && Array.isArray(newConfig.steps)) {
              newConfig.steps = processSteps(newConfig.steps);
            }

            // For cloud modules: ensure input values are placed into config root for the executor
            if (newConfig.isCloudModule) {
              // Inject images if any were collected from fields
              if (fieldImagesBase64.length > 0) {
                newConfig.images = fieldImagesBase64;
              }

              // Also ensure direct values are mapped if they exists in inputs
              if (Array.isArray(newConfig.variables)) {
                newConfig.variables.forEach((v: any) => {
                  const vk = v.key || v.name;
                  if (vk && inputs[vk] !== undefined) {
                    newConfig[vk] = inputs[vk];
                  }
                });
              }

              const resolvedCloudInputs = resolveCloudModuleInputValues(
                {
                  ...step,
                  config: newConfig,
                },
                inputs,
                stepIndex,
              );

              Object.assign(newConfig, resolvedCloudInputs);
            }

            // Substitute {variable} patterns in all string config values
            Object.keys(newConfig).forEach(key => {
              let val = newConfig[key];
              if (typeof val === 'string') {
                const scopedInputs = scopedInputsByStep.get(stepIndex) || {};
                
                
                
                // Handle both simple {variable}, encoded %7Bvariable%7D, and typed {type:paramName} formats
                val = val.replace(/(?:\{|%7B)([^}%]+)(?:\}|%7D)/gi, (match: string, content: string) => {
                  // Check if it's a typed format like "text:input1" or "text%3Ainput1"
                  let colonIndex = content.indexOf(':');
                  let paramName = content;
                  if (colonIndex !== -1) {
                    paramName = content.substring(colonIndex + 1);
                  } else {
                    const pctColonIndex = content.indexOf('%3A');
                    if (pctColonIndex !== -1) {
                      paramName = content.substring(pctColonIndex + 3);
                    } else {
                      const lowerPctColonIndex = content.indexOf('%3a');
                      if (lowerPctColonIndex !== -1) {
                        paramName = content.substring(lowerPctColonIndex + 3);
                      }
                    }
                  }

                  let resolvedValue = '';
                  if (scopedInputs[paramName] !== undefined) {
                    resolvedValue = scopedInputs[paramName];
                  } else if (inputs[paramName] !== undefined) {
                    resolvedValue = inputs[paramName];
                  } else {
                    // Fallback 1: If the variable name in the template doesn't match any input key,
                    // but there's exactly ONE scoped input provided for this step, use it!
                    const scopedValues = Object.values(scopedInputs).filter(
                      v => typeof v === 'string' && v.trim() !== '',
                    );
                    if (scopedValues.length === 1) {
                      resolvedValue = scopedValues[0];
                    } else {
                      // Fallback 2: Check global inputs for a single value
                      const globalValues = Object.values(inputs).filter(v => typeof v === 'string' && v.trim() !== '');
                      if (globalValues.length === 1) {
                        resolvedValue = globalValues[0];
                      } else {
                        return match; // Keep the original token if no value found
                      }
                    }
                  }

                  // If matched using %7B / %7D, URL encode the resolved value
                  if (match.startsWith('%') || match.startsWith('%7b') || match.startsWith('%7B')) {
                    return encodeURIComponent(resolvedValue);
                  }
                  return resolvedValue;
                });

                // Fix: Add spaces between consecutive values that were pasted back-to-back
                // This handles templates like {input1}{input2} with multiple defined inputs
                // If all scopedInputs values exist and their concatenation matches val, add spaces
                const definedInputValues = Object.entries(scopedInputs)
                  .map(([_, v]) => v)
                  .filter(v => v && typeof v === 'string');
                if (definedInputValues.length > 1 && val === definedInputValues.join('')) {
                  val = definedInputValues.join(' ');
                  
                }

                
                newConfig[key] = val;
              }
            });

            return { ...step, config: newConfig };
          });
        };

        const processedSteps = processSteps(auto.steps);

        chrome.runtime.sendMessage({
          action: 'run_automation',
          automation: { ...auto, steps: processedSteps },
        });
      });

      openUrls(
        [...finalAgents, ...finalLinks],
        activeCollection.item.title || activeCollection.item.name || 'Collection',
      );
      resetAfterCommandExecution();
    }, [activeCollection, openUrls, selectedImages, resetAfterCommandExecution]);

    const renderMentionedTabs = () => {
      if (!mentionedTabs || mentionedTabs.length === 0) return null;

      return mentionedTabs.map((tab, idx) => {
        return (
          <div
            key={`tab-prefix-${tab.tabId}`}
            className={`flex items-center gap-1.5 mr-1 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
              } border rounded-lg px-2 py-0.5 shadow-sm`}>
            <div className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0">
              {tab.favIconUrl ? (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-contain rounded-sm"
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <FaGlobe size={11} className="text-blue-500" />
              )}
            </div>
            <span
              className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'
                } font-medium max-w-[100px] truncate`}>
              {tab.title}
            </span>
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setMentionedTabs(prev => prev.filter(t => t.tabId !== tab.tabId));
              }}
              className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
              <FaTimes size={8} />
            </button>
          </div>
        );
      });
    };

    const renderPrimaryPrefix = () => {
      if (hideDynamicIcon) return null;

      if (activeSlashFilter && !lockedCommand) {
        const labels: Record<string, string> = {
          a: 'All',
          n: 'Notes',
          s: 'Snippets',
          p: 'Prompts',
          l: 'Links',
          c: 'Commands',
          b: 'Bookmarks',
          t: 'Todos',
        };
        const label = labels[activeSlashFilter];
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 mr-2 border-[1.5px] rounded-lg px-2 py-0.5 shadow-sm ${isDarkMode
                ? 'bg-neutral-500/10 border-neutral-500 text-neutral-200'
                : 'bg-neutral-500/5 border-neutral-400 text-[#073642]'
              }`}>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${isDarkMode ? 'border-neutral-500/30 text-neutral-400' : 'border-neutral-400/30 text-neutral-500'} font-semibold tracking-wider`}>
              /{activeSlashFilter.toUpperCase()}
            </span>
            <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>
              {label}
            </span>
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                activeSlashFilterRef.current = null;
                setActiveSlashFilter(null);
                setValue('');
                onQueryChange?.('');
              }}
              className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
              <FaTimes size={10} />
            </button>
          </div>
        );
      }

      // Quicklink mode: show link chip
      if (pendingQueryUrls && pendingQueryUrls.length > 0) {
        const firstUrl = pendingQueryUrls[0];
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 pl-2 pr-2 h-7 rounded-md border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
              }`}>
            <img src={getFaviconUrl(firstUrl)} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />
            <span
              className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-[#073642]'
                } font-medium truncate max-w-[150px]`}>
              {pendingQueryLabel || 'Quick Link'}
            </span>
          </div>
        );
      }

      // History Context Mode: show history chip
      if (stagedHistorySession) {
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md ${isDarkMode ? 'bg-purple-500/10 border-purple-500/20' : 'bg-[#eee8d5] border-[#93a1a1]/30'
              } border`}>
            <div className="flex items-center gap-1.5 max-w-[200px]">
              <FaHistory className={isDarkMode ? 'text-purple-400' : 'text-[#073642]'} size={12} />
              <span className={`text-xs ${isDarkMode ? 'text-purple-300' : 'text-[#073642]'} font-medium truncate`}>
                {stagedHistorySession.prompt}
              </span>
            </div>
            <button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setStagedHistorySession(null);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className={`p-1 ${isDarkMode ? 'hover:bg-purple-500/20 text-purple-500' : 'hover:bg-[#93a1a1]/20 text-[#586e75]'
                } rounded-sm`}>
              <FaTimes size={10} />
            </button>
          </div>
        );
      }

      // 1. Show Back Button if applicable (Higher priority than chips/search icon)
      if (showBackButton && !lockedCommand) {
        return (
          <button
            onClick={() => onNavigateBack?.()}
            className="flex items-center justify-start w-6 h-6 rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-[var(--color-iconDefault)]">
            <FaArrowLeft size={14} />
          </button>
        );
      }

      // Integrated Automation Identity Layer (Tier 1)
      if (activeCollection) {
        const item = activeCollection.item;
        const automationName = item?.name || item?.title || 'Automation';
        const ariaLabel = item?.title || item?.name || 'Automation';
        const focusedIndex = activeCollection.focusedFieldIndex !== -1 ? activeCollection.focusedFieldIndex : 0;
        const focusedField = activeCollection.fields[focusedIndex] as any;
        const focusedFieldLabel = focusedField?.label || '';

        return (
          <div
            ref={prefixRef}
            className={`flex flex-col gap-1 px-3 py-1.5 border rounded-lg pointer-events-auto transform transition-all duration-200 min-w-[120px] ${isDarkMode
              ? 'bg-neutral-800 border-neutral-700 shadow-lg shadow-black/20'
              : 'bg-[#eee8d5] border-[#93a1a1]/40 shadow-sm'
              }`}>
            {/* Row 1: Identity (Icon + Name + X) */}
            <div className="flex items-center justify-between w-full gap-3 min-w-max">
              <div className="flex items-center gap-2">
                <div className="w-4.5 h-4.5 flex items-center justify-center shrink-0">
                  <AutomationDynamicIcon automation={item.automation || item} size={16} />
                </div>
                <span
                  className={`text-[12px] ${isDarkMode ? 'text-neutral-200' : 'text-[#073642]'} font-bold whitespace-nowrap`}>
                  {automationName}
                </span>
              </div>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveCollection(null);
                }}
                className={`cursor-pointer p-0.5 rounded-md transition-all ${isDarkMode
                  ? 'text-red-500 hover:text-red-400 hover:bg-neutral-200/10'
                  : 'text-[#586e75] hover:text-red-500 hover:bg-neutral-200'
                  }`}
                title="Exit Automation">
                <FaTimes size={10} />
              </button>
            </div>
            {/* Row 2: Focus Label */}
            {focusedFieldLabel && (
              <div className="flex items-center w-full">
                <span
                  className={`text-[11px] ${isDarkMode ? 'text-neutral-400' : 'text-[#586e75]'} font-semibold truncate`}>
                  {focusedFieldLabel}
                </span>
              </div>
            )}
          </div>
        );
      }

      // Show @ command chip when a command is selected via @
      if (selectedAtCommand) {
        const commandLabels: Record<string, string> = {
          gpt: 'ChatGPT',
          claude: 'Claude',
          gemini: 'Gemini',
          perplexity: 'Perplexity',
          g: 'Google',
          yt: 'YouTube',
          gmail: 'Gmail',
          spotify: 'Spotify',
        };
        const label = commandLabels[selectedAtCommand] || selectedAtCommand;
        const cmd = commands.find(c => c.id === selectedAtCommand);
        return (
          <div
            className={`flex items-center gap-1.5 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
              } border rounded-lg px-2 py-0.5`}>
            {cmd ? (
              <img src={getFaviconUrl(cmd.iconHost)} alt={label} className="w-3 h-3 object-cover rounded-sm" />
            ) : (
              (() => {
                const lowerId = String(selectedAtCommand || '').toLowerCase();
                let IconComp: any = null;
                let color = 'text-blue-500';

                if (lowerId === 'gpt' || lowerId === 'chatgpt') {
                  IconComp = SiOpenai;
                  color = 'text-green-500';
                } else if (lowerId === 'claude') {
                  IconComp = TbSparkles;
                  color = 'text-orange-500';
                } else if (lowerId === 'gemini') {
                  IconComp = TbSparkles;
                  color = 'text-blue-400';
                } else if (lowerId === 'perplexity') {
                  IconComp = SiPerplexity;
                  color = 'text-teal-500';
                } else if (lowerId === 'ai') {
                  IconComp = LuSparkles;
                  color = 'text-purple-500';
                }

                if (IconComp) {
                  return <IconComp size={14} className={`${color}`} />;
                }

                const localDef = LOCAL_COMMANDS.find(c => c.id === selectedAtCommand);
                const customIcon = localDef?.icon;
                return customIcon ? (
                  typeof customIcon === 'function' ? (
                    (() => {
                      const IconComponent = customIcon as React.ComponentType<any>;
                      return (
                        <IconComponent
                          size={16}
                          className={`w-5 h-5 object-contain ${isDarkMode ? 'text-neutral-400' : 'text-[#073642]'}`}
                        />
                      );
                    })()
                  ) : typeof customIcon === 'string' ? (
                    <img src={customIcon} className="w-5 h-5 object-contain dark:invert" alt="" />
                  ) : (
                    customIcon
                  )
                ) : (
                  <span className="text-blue-500">@</span>
                );
              })()
            )}
            <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>{label}</span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setSelectedAtCommand(null);
              }}
              className="text-red-300 hover:text-red-400 ml-0.5">
              <FaTimes size={8} />
            </button>
          </div>
        );
      }

      // Show Command List chip when in command list view (Matching AltS)
      // Prioritize this over lockedCommand to ensure correct view
      if (isCommandListView && !lockedCommand) {
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
              } border rounded-lg px-2 py-0.5`}>
            <FaLayerGroup size={10} className={isDarkMode ? 'text-neutral-500' : 'text-[#073642]'} />
            <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>
              Command List
            </span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onClearCommandListView?.();
                onToggleCommandListView?.(false);
              }}
              className="text-red-300 hover:text-red-400 ml-1">
              <FaTimes size={10} />
            </button>
          </div>
        );
      }

      // Show All Items chip when All Notes, All Links, or All Prompts view is active
      if ((isAllItemsView && !lockedCommand) || (lockedCommand && isBookmarksCommand(lockedCommand))) {
        const isBookmarks = lockedCommand && isBookmarksCommand(lockedCommand);
        const label = isBookmarks
          ? 'All Bookmarks'
          : allItemsType === 'notes'
            ? 'All Notes'
            : allItemsType === 'links'
              ? 'All Links'
              : allItemsType === 'bookmarks'
                ? 'All Bookmarks'
                : allItemsType === 'organizations'
                  ? 'Organizations'
                  : 'All Prompts';
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
              } border rounded-lg px-2 py-0.5`}>
            {isBookmarks || allItemsType === 'bookmarks' ? (
              <FaBookmark size={10} className="text-amber-500" />
            ) : allItemsType === 'notes' ? (
              <NotesIcon size={12} className="text-yellow-500" />
            ) : allItemsType === 'links' ? (
              <FaLink size={10} className="text-blue-500" />
            ) : allItemsType === 'organizations' ? (
              <FaBuilding size={10} className="text-teal-500" />
            ) : (
              <LuSparkles size={10} className="text-purple-500" />
            )}
            <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>{label}</span>
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                if (isBookmarks) {
                  exitCommandMode();
                } else {
                  onClearAllItemsView?.();
                }
              }}
              className="text-red-300 hover:text-red-400 ml-0.5">
              <FaTimes size={8} />
            </button>
          </div>
        );
      }

      // When in command mode (lockedCommand is set), show command icon + name
      if (lockedCommand && activeCommandInfo) {
        const { id, commandType } = activeCommandInfo;
        const remoteCmd = commands.find(c => c.id === id) || COMMANDS.find(c => c.id === id);
        const isBrowserCommand = commandType === 'remote' && remoteCmd?.category === 'browser';
        const labelRaw = isBrowserCommand ? `${BROWSER_NAME} ${activeCommandInfo.label}` : activeCommandInfo.label;
        const label = labelRaw;

        const isAiCommand = id === 'ai';

        if (isAiCommand) {
          let targetAIs = id === 'ai' ? AI_GROUP.members : [id];
          if (id === 'ai') {
            targetAIs = isAiEditMode ? AI_GROUP.members : targetAIs.filter(mid => selectedAIs.includes(mid));
            if (targetAIs.length === 0) targetAIs = AI_GROUP.members;
          }
          return (
            <div
              ref={prefixRef}
              className={`group relative flex items-center gap-1.5 mr-2 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
                } border rounded-lg px-2 py-1 shadow-sm`}>
              <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium mr-1`}>
                AI models:
              </span>
              <div className="flex gap-0.5 items-center justify-start w-auto flex-shrink-0 overflow-hidden">
                <AnimatePresence mode="popLayout">
                  {targetAIs.map((mid, idx) => {
                    const c = commands.find(x => x.id === mid) || COMMANDS.find(x => x.id === mid);
                    if (!c) return <LuSparkles key={`ai-sparkle-${mid}`} size={12} className="text-purple-500" />;

                    const isSelected = selectedAIs.includes(mid);
                    const isInteractive = true;

                    return (
                      <motion.button
                        layout
                        initial={{ scale: 0, opacity: 0, width: 0 }}
                        animate={{ scale: 1, opacity: 1, width: 'auto' }}
                        exit={{ scale: 0, opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        type="button"
                        key={`ai-prefix-locked-${c.id}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isInteractive) {
                            handleToggleAI(mid);
                          }
                        }}
                        className={`relative w-5 h-5 rounded-full flex items-center justify-center transition-all group/iconbtn ${isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${isSelected
                          ? 'border-[1.5px] border-neutral-400 dark:border-neutral-500 p-[2px] shadow-sm bg-white dark:bg-black'
                          : 'border border-transparent'
                          }`}>
                        <img
                          src={getFaviconUrl(c.iconHost)}
                          alt={c.label}
                          className="w-full h-full object-cover rounded-full"
                        />
                        {isInteractive && isSelected && (
                          <div className="absolute -top-[3px] -right-[3px] w-[13px] h-[13px] bg-neutral-800 dark:bg-neutral-900 rounded-full flex items-center justify-center border-[1.5px] border-neutral-400 dark:border-neutral-500 shadow-sm opacity-0 group-hover/iconbtn:opacity-100 transition-opacity">
                            <LuX size={8} strokeWidth={3} className="text-neutral-200" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>

              {id === 'ai' && (
                <div
                  ref={modelPopupRef}
                  className="flex items-center relative"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    if (!isModelPopupOpen) setIsModelPopupOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                    }
                    hoverTimeoutRef.current = setTimeout(() => {
                      setIsModelPopupOpen(false);
                    }, 200);
                  }}>
                  <div className={`w-[1px] h-3.5 mx-1 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
                  <div
                    className={`flex items-center justify-center w-[16px] h-[16px] rounded-full border-[1.5px] cursor-pointer transition-colors ${isModelPopupOpen
                      ? 'border-neutral-600 dark:border-white text-neutral-600 dark:text-white'
                      : 'border-neutral-400 dark:border-neutral-500 text-neutral-400 dark:text-neutral-500 hover:border-neutral-600 dark:hover:border-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300'
                      }`}
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      if (!isModelPopupOpen) setIsModelPopupOpen(true);
                    }}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsModelPopupOpen(prev => !prev);
                    }}>
                    <LuPlus
                      size={10}
                      strokeWidth={2.5}
                      className={`transition-transform duration-200 ${isModelPopupOpen ? 'rotate-45' : ''}`}
                    />
                  </div>

                  {isModelPopupOpen && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-[calc(100%-12px)] p-4 z-[100]"
                      onClick={e => e.stopPropagation()}
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) {
                          clearTimeout(hoverTimeoutRef.current);
                          hoverTimeoutRef.current = null;
                        }
                      }}>
                      <div className="w-[240px]">
                      <AIModelSelectionPanel
                        state={
                          {
                            selectedAIs,
                            onToggleAI: handleToggleAI,
                            activeAiSession,
                            updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => {
                              setActiveAiSession(prev => {
                                if (!prev) return metadata.id ? ({ id: metadata.id, ...metadata } as any) : null;
                                return { ...prev, ...metadata };
                              });
                            },
                            onUpdateModelUrl,
                            onUpdateCustomModels,
                            modelWarning,
                          } as any
                        }
                        isMac={typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0}
                        savedAgents={savedAiAgents}
                        onSaveAgent={onSaveAgent || (() => { })}
                      />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  exitCommandMode();
                }}
                className={`text-red-300 hover:text-red-400 ml-1 cursor-pointer transition-opacity ${id === 'ai' ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                <LuX size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        }

        if (id === 'store') {
          return (
            <div
              ref={prefixRef}
              className={`flex items-center gap-1.5 mr-2 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
                } border rounded-lg px-2 py-0.5`}>
              <div className="w-4 h-4 flex items-center justify-start">
                <FaRobot size={12} className="text-blue-500" />
              </div>
              <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>
                Automation Store
              </span>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  exitCommandMode();
                }}
                className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
                <FaTimes size={10} />
              </button>
            </div>
          );
        }

        if (isLocalCommandId(id as string)) {
          const localDef = LOCAL_COMMANDS.find(c => c.id === (id as LocalCommandId));
          const customIcon = localDef?.icon;
          return (
            <div ref={prefixRef} className="flex items-center gap-1.5 mr-2">
              <div
                className={`flex items-center gap-1.5 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
                  } border rounded-lg px-2 py-0.5`}>
                <div className="w-4 h-4 flex items-center justify-start">
                  {customIcon ? (
                    typeof customIcon === 'function' ? (
                      (() => {
                        const IconComponent = customIcon as React.ComponentType<any>;
                        return (
                          <IconComponent
                            size={16}
                            className={`w-5 h-5 object-contain ${isDarkMode ? 'text-neutral-400' : 'text-[#073642]'}`}
                          />
                        );
                      })()
                    ) : typeof customIcon === 'string' ? (
                      <img src={customIcon} className="w-5 h-5 object-contain dark:invert" alt="" />
                    ) : (
                      customIcon
                    )
                  ) : (
                    <div className="w-8 h-4 flex items-center justify-start scale-[0.4] origin-center">
                      <CmdIcon />
                    </div>
                  )}
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>
                  {label}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    exitCommandMode();
                  }}
                  className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
                  <FaTimes size={10} />
                </button>
              </div>
            </div>
          );
        }

        const c = commands.find(x => x.id === (id as CommandId)) || COMMANDS.find(x => x.id === (id as CommandId));
        if (c) {
          return (
            <div
              ref={prefixRef}
              className={`flex items-center gap-1.5 mr-2 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-[#eee8d5] border-[#93a1a1]/30'
                } border rounded-lg px-2 py-0.5`}>
              <img
                src={getFaviconUrl(c.iconHost)}
                alt={c.label}
                className="w-3 h-3 object-cover rounded-sm shadow-sm"
              />
              <span className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-[#073642]'} font-medium`}>
                {label}
              </span>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  exitCommandMode();
                }}
                className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
                <FaTimes size={10} />
              </button>
            </div>
          );
        }
      }



      // When typing an @ command and the menu is open, show highlighted command's icon
      if (showAtCommandMenu) {
        const highlightedCmd = filteredAtCommands[atCommandHighlightIndex];
        if (highlightedCmd) {
          const Icon = highlightedCmd.icon;
          return (
            <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
              <Icon className={`text-sm ${highlightedCmd.color}`} />
            </div>
          );
        }
        return (
          <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
            <span className="text-blue-500 font-bold text-lg -ml-0.5">@</span>
          </div>
        );
      }

      // Normal mode: show search icon or dynamic matched icon based on top suggestion
      if (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0) {
        const top = allSuggestions[highlightIndex];
        if (top) {
          const kind = (top as any)._kind;

          // Support stacked icons for AI groups and TabGroups in prefix
          if (kind === 'command' && (top as any).commandType === 'aggregate') {
            // Show only the selected AIs (max 3), overlapping neatly
            const visibleAIs = AI_GROUP.members.filter(mid => selectedAIs.includes(mid)).slice(0, 3);
            const displayAIs = visibleAIs.length > 0 ? visibleAIs : AI_GROUP.members.slice(0, 3);
            return (
              <div className="flex -space-x-1 items-center flex-shrink-0 justify-start">
                {displayAIs.map(mid => {
                  const c = commands.find(x => x.id === mid) || COMMANDS.find(x => x.id === mid);
                  if (!c) return null;
                  return (
                    <div
                      key={`ai-prefix-${c.id}`}
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center ring-[1.5px] ring-[var(--color-inputBg)] overflow-hidden shadow-sm bg-white"
                    >
                      <img src={getFaviconUrl(c.iconHost)} alt={c.label} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            );
          }

          if (kind === 'snippet') {
            const category = ((top as any).snippet?.category || '').toLowerCase();
            if (category === 'tabgroup' || category === 'tab group') {
              const { urlList } = parseValue((top as any).snippet);
              if (urlList.length > 0) {
                return (
                  <div ref={prefixRef} className="flex -space-x-1.5 items-center w-8 -ml-1.5 justify-start">
                    {urlList.slice(0, 3).map((url, i) => (
                      <div
                        key={`tabgroup-prefix-${i}`}
                        className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                        <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
                      </div>
                    ))}
                  </div>
                );
              }
            }
          }

          if (kind === 'history' || kind === 'bookmark' || kind === 'open_url') {
            const url = (top as any).url || (top as any).displayUrl;
            if (url) {
              return (
                <div
                  ref={prefixRef}
                  className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-start"
                  style={{ marginLeft: '1.8px' }}>
                  <FallbackFavicon url={url} className="w-5 h-5 object-cover grayscale-[0.2]" fallbackIcon={FaGlobe} />
                </div>
              );
            }
          }

          if (kind === 'command' || kind === 'common_command') {
            const cmdId = (top as any).id;
            const cmd = (top as any).command;

            if (cmdId === 'google') {
              return (
                <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                  <FaSearch size={14} className="text-black dark:text-white" />
                </div>
              );
            }
            if (cmdId === 'calculator' || cmd?.id === 'calculator') {
              return (
                <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                  <FaCalculator size={14} className="text-[var(--color-iconDefault)]" />
                </div>
              );
            }

            if (cmd) {
              // Local commands support
              if (isLocalCommandId(cmdId)) {
                const localDef = LOCAL_COMMANDS.find(c => c.id === cmdId);
                const customIcon = localDef?.icon;
                if (customIcon) {
                  if (typeof customIcon === 'function') {
                    const IconComponent = customIcon as React.ComponentType<{ className?: string; size?: number }>;
                    return (
                      <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                        <IconComponent
                          size={16}
                          className="w-5 h-5 object-contain text-neutral-500 dark:text-neutral-400"
                        />
                      </div>
                    );
                  }
                  if (typeof customIcon === 'string') {
                    return (
                      <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                        <img src={customIcon} className="w-5 h-5 object-contain dark:invert" alt="" />
                      </div>
                    );
                  }
                  return (
                    <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                      {customIcon as React.ReactNode}
                    </div>
                  );
                }
                return (
                  <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                    <CmdIcon />
                  </div>
                );
              }

              // Remote commands
              if (cmd.iconHost) {
                return (
                  <div
                    ref={prefixRef}
                    className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-start"
                    style={{ marginLeft: '1.8px' }}>
                    <FallbackFavicon
                      url={cmd.iconHost}
                      className="w-5 h-5 object-cover grayscale-[0.2]"
                      fallbackIcon={FaSearch}
                    />
                  </div>
                );
              }
            }

            // common_command: show favicon from command.iconHost
            if (kind === 'common_command') {
              const commonCmd = (top as any).command as CommandDefinition | undefined;
              if (commonCmd?.iconHost) {
                return (
                  <div
                    ref={prefixRef}
                    className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-start"
                    style={{ marginLeft: '1.8px' }}>
                    <FallbackFavicon
                      url={commonCmd.iconHost}
                      className="w-5 h-5 object-cover grayscale-[0.2]"
                      fallbackIcon={FaSearch}
                    />
                  </div>
                );
              }
            }
          }

          if (kind === 'math_result') {
            return (
              <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                <FaCalculator size={14} className="text-[var(--color-iconDefault)]" />
              </div>
            );
          }

          if (kind === 'time_result') {
            return (
              <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                <FaClock size={14} className="text-[var(--color-iconDefault)]" />
              </div>
            );
          }
        }
      }

      return (
        <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
          <FaSearch size={14} className="text-black dark:text-white" />
        </div>
      );
    };

    const renderPrefix = () => {
      return <>{renderPrimaryPrefix()}</>;
    };

    type SearchbarAutomationField = {
      key: string;
      label: string;
      value: string;
      type?: 'text' | 'image' | 'dropdown';
      inputStyle?: 'short_text' | 'long_text';
      sourceType?: 'text' | 'image' | 'dropdown' | 'constant';
      description?: string;
      extraValues?: string[];
      images?: { url: string; file: File; filename: string; mimeType: string }[];
      dropdownOptions?: string[];
      dropdownOptionPairs?: { key: string; value: string }[];
      urlTemplate?: string;
      groupId?: string;
      groupLabel?: string;
      groupSelector?: string;
      groupAction?: string;
      order?: number;
      sourceVariable?: string;
      sourceStepIndex?: number;
    };

    const formatAutomationFieldLabel = (value: string) => {
      // Detect CSS selector patterns (e.g., data-qa="texty_input", #myId, .myClass, [attr="val"])
      const looksLikeSelector = /[=\[\]#"]/.test(value) || /^\.[\w-]/.test(value) || /^data-/.test(value);

      if (looksLikeSelector) {
        return 'Input';
      }

      return (
        value.charAt(0).toUpperCase() +
        value
          .slice(1)
          .replace(/([A-Z0-9])/g, ' $1')
          .trim()
      );
    };

    const mergeAutomationInputDefinitions = (
      primary: AutomationInputDefinition[] = [],
      secondary: Partial<AutomationInputDefinition>[] = [],
    ) => {
      const merged = new Map<string, AutomationInputDefinition>();

      const applyDefinitions = (definitions: Partial<AutomationInputDefinition>[], preferExisting: boolean) => {
        definitions.forEach((definition, index) => {
          const inputId = definition.id || definition.label;
          if (!inputId) return;

          const existing = merged.get(inputId);
          const normalized: AutomationInputDefinition = {
            id: inputId,
            label: definition.label || inputId,
            type: definition.type || 'text',
            fixedValue: definition.fixedValue,
            dropdownOptions: definition.dropdownOptions,
            dropdownOptionPairs: definition.dropdownOptionPairs,
            inputStyle: definition.inputStyle,
            description: definition.description,
            urlTemplate: definition.urlTemplate,
            groupId: definition.groupId,
            groupLabel: definition.groupLabel,
            groupSelector: definition.groupSelector,
            groupAction: definition.groupAction,
            order: definition.order ?? index,
          };

          if (!existing) {
            merged.set(inputId, normalized);
            return;
          }

          existing.label = preferExisting ? existing.label : normalized.label || existing.label;
          if (!existing.fixedValue && normalized.fixedValue) existing.fixedValue = normalized.fixedValue;
          if (!existing.dropdownOptions && normalized.dropdownOptions)
            existing.dropdownOptions = normalized.dropdownOptions;
          if (!existing.dropdownOptionPairs && normalized.dropdownOptionPairs)
            existing.dropdownOptionPairs = normalized.dropdownOptionPairs;
          if (!existing.inputStyle && normalized.inputStyle) existing.inputStyle = normalized.inputStyle;
          if (!existing.description && normalized.description) existing.description = normalized.description;
          if (!existing.urlTemplate && normalized.urlTemplate) existing.urlTemplate = normalized.urlTemplate;
          if (!existing.groupId && normalized.groupId) existing.groupId = normalized.groupId;
          if (!existing.groupLabel && normalized.groupLabel) existing.groupLabel = normalized.groupLabel;
          if (!existing.groupSelector && normalized.groupSelector) existing.groupSelector = normalized.groupSelector;
          if (!existing.groupAction && normalized.groupAction) existing.groupAction = normalized.groupAction;
          if (existing.order === undefined && normalized.order !== undefined) existing.order = normalized.order;
          if (existing.type !== 'image' && normalized.type === 'image') existing.type = 'image';
          if (existing.type === 'text' && normalized.type === 'dropdown') existing.type = 'dropdown';
          if (existing.type === 'text' && normalized.type === 'constant') existing.type = 'constant';
        });
      };

      applyDefinitions(primary, true);
      applyDefinitions(secondary, false);

      return Array.from(merged.values()).sort((a, b) => {
        const orderDiff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
        if (orderDiff !== 0) return orderDiff;
        return a.id.localeCompare(b.id);
      });
    };

    const getInputStyleFromType = (rawType?: string | null): 'short_text' | 'long_text' | undefined => {
      if (!rawType) return undefined;
      if (rawType === 'short_text' || rawType === 'long_text') return rawType;
      return undefined;
    };

    const normalizeAutomationFieldType = (rawType?: string | null): 'text' | 'image' | 'dropdown' => {
      if (rawType === 'image') return 'image';
      if (rawType === 'dropdown') return 'dropdown';
      return 'text';
    };

    const normalizeAutomationSourceType = (rawType?: string | null): 'text' | 'image' | 'dropdown' | 'constant' => {
      if (rawType === 'image') return 'image';
      if (rawType === 'dropdown') return 'dropdown';
      if (rawType === 'constant') return 'constant';
      return 'text';
    };

    const collectConstantInputsFromSteps = (steps: any[]): Record<string, string> => {
      const constants: Record<string, string> = {};

      const addConstant = (key?: string, value?: any) => {
        if (!key) return;
        const normalizedValue = value === undefined || value === null ? '' : String(value);
        if (normalizedValue.trim() === '') return;
        if (constants[key] === undefined) {
          constants[key] = normalizedValue;
        }
      };

      const scanSteps = (stepList: any[]) => {
        stepList.forEach(step => {
          const cfg = step?.config || {};

          const paramConfigs = cfg.paramConfigs || {};
          Object.keys(paramConfigs).forEach(paramKey => {
            const paramCfg = paramConfigs[paramKey];
            if (paramCfg?.type === 'constant') {
              addConstant(paramKey, Array.isArray(paramCfg.values) ? paramCfg.values[0] : undefined);
            }
          });

          const prompts = Array.isArray(cfg.prompts) ? cfg.prompts : [];
          prompts.forEach((prompt: any) => {
            if (prompt?.type === 'constant') {
              addConstant(prompt?.key, Array.isArray(prompt?.values) ? prompt.values[0] : undefined);
            }
          });

          if (Array.isArray(cfg.steps)) scanSteps(cfg.steps);
          if (Array.isArray(step?.subSteps)) scanSteps(step.subSteps);
        });
      };

      if (Array.isArray(steps)) scanSteps(steps);
      return constants;
    };

    const buildInputTypeHints = (steps: any[]): Map<string, 'short_text' | 'long_text'> => {
      const hints = new Map<string, 'short_text' | 'long_text'>();

      const applyHint = (key: string, rawType?: string) => {
        if (!key || !rawType) return;
        const style = getInputStyleFromType(rawType);
        if (!style) return;
        const existing = hints.get(key);
        if (!existing || (existing === 'short_text' && style === 'long_text')) {
          hints.set(key, style);
        }
      };

      const scanSteps = (stepList: any[]) => {
        stepList.forEach(step => {
          const paramConfigs = step?.config?.paramConfigs || {};
          Object.keys(paramConfigs).forEach(paramKey => {
            applyHint(paramKey, paramConfigs[paramKey]?.type);
          });

          const prompts = Array.isArray(step?.config?.prompts) ? step.config.prompts : [];
          prompts.forEach((prompt: any) => {
            applyHint(prompt?.key, prompt?.type);
          });

          if (Array.isArray(step?.subSteps)) scanSteps(step.subSteps);
          if (Array.isArray(step?.config?.steps)) scanSteps(step.config.steps);
        });
      };

      if (Array.isArray(steps)) scanSteps(steps);
      return hints;
    };

    const mapAutomationInputDefinitionsToFields = (
      inputDefinitions: Partial<AutomationInputDefinition>[],
      fallbackUrlTemplates?: Map<string, string>,
      inputTypeHints?: Map<string, 'short_text' | 'long_text'>,
    ): SearchbarAutomationField[] => {
      return inputDefinitions.map((inputDefinition, index) => {
        let initialValue = inputDefinition.fixedValue || '';
        let dropdownOptions: string[] | undefined;
        let dropdownOptionPairs: { key: string; value: string }[] | undefined = inputDefinition.dropdownOptionPairs;

        if (inputDefinition.dropdownOptions) {
          dropdownOptions = inputDefinition.dropdownOptions
            .split(',')
            .map((value: string) => value.trim())
            .filter(Boolean);
        }

        // If we have pairs but no flat options, build flat options from pairs
        if (dropdownOptionPairs && dropdownOptionPairs.length > 0 && !dropdownOptions) {
          dropdownOptions = dropdownOptionPairs.map(p => p.value);
        }

        if (dropdownOptions && dropdownOptions.length > 0 && !initialValue) {
          initialValue = dropdownOptions[0];
        }

        const fieldKey = inputDefinition.id || inputDefinition.label || `field-${index}`;
        const rawType = String(inputDefinition.type || inputTypeHints?.get(fieldKey) || '');
        const inputStyle = inputDefinition.inputStyle || getInputStyleFromType(rawType);
        const normalizedType = normalizeAutomationFieldType(rawType);
        const sourceType = normalizeAutomationSourceType(rawType);

        return {
          key: fieldKey,
          label: formatAutomationFieldLabel(inputDefinition.label || fieldKey),
          value: initialValue,
          type: normalizedType,
          sourceType,
          description: inputDefinition.description,
          inputStyle,
          extraValues: [],
          dropdownOptions,
          dropdownOptionPairs,
          urlTemplate: inputDefinition.urlTemplate || fallbackUrlTemplates?.get(fieldKey),
          groupId: inputDefinition.groupId || fieldKey,
          groupLabel: inputDefinition.groupLabel,
          groupSelector: inputDefinition.groupSelector,
          groupAction: inputDefinition.groupAction,
          order: inputDefinition.order ?? index,
        };
      });
    };

    const renderInlineCommandIcon = () => {
      if (!inlineComposerInfo) return null;

      const { id } = inlineComposerInfo;

      if (id === 'ai') {
        const targetAIs = AI_GROUP.members;
        return (
          <div className="flex -space-x-1.5 items-center w-auto flex-shrink-0">
            {targetAIs.slice(0, 4).map(mid => {
              const c = commands.find(x => x.id === mid) || COMMANDS.find(x => x.id === mid);
              if (!c) return null;
              return (
                <div
                  key={`ai-inline-${c.id}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white overflow-hidden shadow-sm bg-white">
                  <img src={getFaviconUrl(c.iconHost)} alt={c.label} className="w-4 h-4 object-cover" />
                </div>
              );
            })}
          </div>
        );
      }

      if (isLocalCommandId(id as string)) {
        const localDef = LOCAL_COMMANDS.find(c => c.id === (id as LocalCommandId));
        if (localDef?.icon) {
          if (typeof localDef.icon === 'function') {
            const IconComponent = localDef.icon as React.ComponentType<{ className?: string; size?: number }>;
            return <IconComponent size={16} className="text-neutral-500" />;
          }
          // If it's a ReactNode (Element), just render it
          return <div className="w-4 h-4 flex items-center justify-center">{localDef.icon as React.ReactNode}</div>;
        }

        return (
          <div className="w-8 h-4 flex items-center justify-center scale-[0.5] origin-center">
            <CmdIcon />
          </div>
        );
      }

      const c = commands.find(x => x.id === (id as CommandId));
      if (c) {
        if (c.icon) {
          if (typeof c.icon === 'function') {
            const IconComponent = c.icon as React.ComponentType<{ className?: string; size?: number }>;
            return <IconComponent size={16} className="text-neutral-500" />;
          }
          // If it's a ReactNode (Element), just render it
          return <div className="w-4 h-4 flex items-center justify-center">{c.icon as React.ReactNode}</div>;
        }

        return (
          <img src={getFaviconUrl(c.iconHost)} alt={c.label} className="w-4 h-4 object-cover rounded-sm shadow-sm" />
        );
      }

      return null;
    };

    // Helper to render the command icon inline
    const renderQuicklinkChip = () => {
      // Changed: Image preview moved to right side. This function now returns null for image preview.
      if (selectedImages.length > 0) return null;

      // Quicklink mode: show link chip
      if (pendingQueryUrls && pendingQueryUrls.length > 0) {
        const firstUrl = pendingQueryUrls[0];
        return (
          <div className="flex items-center gap-1.5 pl-3">
            <img src={getFaviconUrl(firstUrl)} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />
            <span className="text-sm text-neutral-500 font-medium truncate max-w-[150px]">
              {pendingQueryLabel || 'Quick Link'}
            </span>
          </div>
        );
      }
      return null;
    };

    // Calculate left padding based on whether we're in command mode OR folder/workspace mode
    // Command mode shows icon + name, so needs more padding (use measured width)
    // All chip modes now use dynamic prefixWidth measurement
    const calculatedPrefixWidth = useMemo(() => {
      if (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0) {
        const top = allSuggestions[highlightIndex];
        const isAiGroupSuggestion = top && (top as any)._kind === 'command' && (top as any).commandType === 'aggregate';
        if (isAiGroupSuggestion) {
          const visibleAIs = AI_GROUP.members.filter(mid => selectedAIs.includes(mid)).slice(0, 3);
          const displayAIs = visibleAIs.length > 0 ? visibleAIs : AI_GROUP.members.slice(0, 3);
          return displayAIs.length > 0 ? 18 + (displayAIs.length - 1) * 14 : 0;
        }
      }
      return prefixWidth;
    }, [allSuggestions, lockedCommand, value, highlightIndex, selectedAIs, prefixWidth]);

    const inputLeftPaddingPx =
      ((isBoardViewEnabled && value.startsWith('/'))
        ? dynamicLeftOffset
        : !lockedCommand && calculatedPrefixWidth > 0
          ? dynamicLeftOffset + calculatedPrefixWidth + dynamicGap
          : lockedCommand || activeCollection || inlineComposerActive
            ? dynamicLeftOffset
            : dynamicFallbackPadding) +
      (mentionedTabs && mentionedTabs.length > 0 && mentionedTabsWidth > 0 ? mentionedTabsWidth + 12 : 0);



    const selectedLocalLabel = useMemo(() => {
      if (!lockedCommand && selectedCommand?.commandType === 'local') {
        // Exclude createnotes/createlinks from the "Press Enter to..." hint
        if (selectedCommand.id === 'createnotes' || selectedCommand.id === 'createlinks') {
          return null;
        }
        return selectedCommand.label;
      }
      return null;
    }, [lockedCommand, selectedCommand]);
    const inputDisplayValue = inlineComposerActive ? commandPrompt : value;
    const showLocalPreviewHint = Boolean(selectedLocalLabel);
    const previewPlaceholder =
      !lockedCommand &&
        selectedCommand &&
        selectedCommand.id !== 'createnotes' &&
        selectedCommand.id !== 'createlinks' &&
        selectedCommand.id !== 'gpt'
        ? resolvePlaceholderFromCmd(selectedCommand.id)
        : STATIC_PLACEHOLDER;

    const inputPlaceholder = inlineComposerActive
      ? ''
      : showAIHistoryPanel && !value
        ? 'Search history or scroll to see more...'
        : !value && !lockedCommand && selectedLocalLabel
          ? `Press Enter to ${selectedLocalLabel}`
          : !value && lockedCommand
            ? resolvePlaceholderFromCmd(lockedCommand) || placeholder
            : !value && isAllItemsView && allItemsType === 'bookmarks'
              ? 'Search bookmarks'
              : !value && !lockedCommand && selectedCommand && previewPlaceholder !== STATIC_PLACEHOLDER
                ? previewPlaceholder
                : placeholder || STATIC_PLACEHOLDER;
    const inputRightPadding = inlineComposerVisible || showLocalPreviewHint ? 'pr-44' : 'pr-24';

    const suggestionMode: SuggestionMode = useMemo(() => {
      const isShortcutQuery = value.startsWith('/');
      const canShowOthers = !lockedCommand || isShortcutQuery;

      if (isBookmarksCommand(lockedCommand)) return 'bookmark';
      if (lockedLocalDef) {
        if (lockedLocalDef.scope === 'snippet') return 'snippet';
        return 'local';
      }

      const hasCommands = commandSuggestions.length > 0;
      const hasSnippets = canShowOthers && generalSnippetSuggestions.length > 0;

      // Derive hasHistory from debouncedFuseResults
      const hasHistory = canShowOthers && !lockedCommand && debouncedFuseResults.some(r => r._kind === 'history');
      const hasBookmarks = canShowOthers && !lockedCommand && bookmarkSuggestions.length > 0;
      const hasCommon =
        commonCommandSuggestions.length > 0 ||
        (canShowOthers && !lockedCommand && debouncedFuseResults.some(r => r._kind === 'common_command'));
      const hasOpenUrl = openUrlSuggestion !== null;

      if (lockedCommand && !isShortcutQuery) {
        return null;
      }

      // If just '/' with no text, and we have snippets, mixed mode will be returned by hasMultipleTypes

      const hasMultipleTypes =
        [hasCommands, hasSnippets, hasHistory, hasBookmarks, hasCommon, hasOpenUrl].filter(Boolean).length > 1;
      if (hasMultipleTypes) return 'mixed';

      if (hasOpenUrl) return 'common'; // Show as common mode when URL suggestion is present
      if (hasCommands) return 'command';
      if (hasSnippets) return 'snippet';
      if (hasHistory) return 'history';
      if (hasBookmarks) return 'bookmark';
      if (hasCommon) return 'common';
      return null;
    }, [
      value,
      lockedCommand,
      lockedLocalDef,
      commandSuggestions,
      generalSnippetSuggestions,
      debouncedFuseResults,
      bookmarkSuggestions,
      commonCommandSuggestions,
      openUrlSuggestion,
    ]);

    const hasFocus = isFocused || isInlineFocused;
    const isSuggestionVisible = useMemo(() => {
      // Hide suggestions when automation/agent multi-field form is active
      if (activeCollection) return false;

      if (isCommandListView) return true;
      // If a command like /bookmarks, /delete_note is locked (chip shown), hide search suggestions
      // Only AI commands (GPT, Claude, etc) show suggestions (which become Prompts)
      if (lockedCommand) {
        // If files are attached to an AI command, keep suggestions (bottom UI) visible
        // so that the AICommandLockedUI remains mounted in Container.tsx.
        if (selectedImages.length > 0) {
          const isAiCommand =
            lockedCommand === 'ai' ||
            commands.find(c => c.id === lockedCommand)?.category === 'ai' ||
            ['gpt', 'claude', 'perplexity', 'gemini'].includes(lockedCommand as string);
          if (isAiCommand) return true;
          return false;
        }

        // Fallback AI command 'ai' should show prompts
        if (lockedCommand === 'ai') return true;

        // Remote AI commands (gpt, claude etc) should allow prompts
        const info = commands.find(c => c.id === lockedCommand);
        if (info?.category === 'ai') return true;

        if (lockedCommand === 'store') return true;

        return false;
      }

      if (selectedAtCommand) return false;
      if (isSuggestionsHidden) return false;
      // Removed focus requirement to allow persistent suggestions on blur
      // if (!isFocused && !isInlineFocused) return false;

      // showAIHistoryPanel is now rendered as a popup internal to Searchbar to ensure visibility
      // return showAIHistoryPanel ? true : ...

      return (value.trim().length > 0 || selectedImages.length > 0 || (isBoardViewEnabled && isInitialAltSFocus) || keepBoardViewOpen) && !inlineComposerActive;
    }, [
      value,
      isFocused,
      isInlineFocused,
      lockedCommand,
      selectedAtCommand,
      isCommandListView,
      inlineComposerActive,
      selectedImages.length,
      commands,
      isSuggestionsHidden,
      activeCollection,
      showAIHistoryPanel,
      isInitialAltSFocus,
      isBoardViewEnabled,
    ]);

    useEffect(() => {
      // 1. Reset state for new suggestions
      if (!isSuggestionVisible || lockedCommand) {
        if (selectionSourceRef.current !== null) {
          selectionSourceRef.current = null;
          setSelectedCommand(null);
        }
        setContextualMatches([]);
        setIsContextualPopupOpen(false);
        setContextualPopupIndex(-1);
        return;
      }

      // 2. Resolve Primary Command Preview (Original GPT logic)
      const current = allSuggestions[highlightIndex];
      if (current && current._kind === 'command') {
        const info = buildSelectionInfoFromSuggestion(current as CommandSuggestionItem);
        if (commandSupportsInlineQuery(info)) {
          setSelectedCommand(prev => {
            if (selectionSourceRef.current === 'suggestions' && prev?.id === info.id) {
              return prev;
            }
            selectionSourceRef.current = 'suggestions';
            return info;
          });
        }
      } else {
        if (selectionSourceRef.current !== null) {
          selectionSourceRef.current = null;
          setSelectedCommand(null);
        }
      }

      // 3. Dedicated Search for the side panel (Commands, Automations, Agents)
      // Take search query from the main searchbar only (value)
      const dedicatedMatches =
        value.trim().length >= 3
          ? searchDedicatedPanel(value, commands, automationSuggestions, agentCollectionSuggestions, moduleSuggestions)
          : [];

      // Add snippet matches for links and tab groups from matchingSnippets
      const snippetMatches: ContextualMatch[] = [];
      if (value.trim().length >= 3) {
        matchingSnippets.forEach(item => {
          const category = (item.snippet.category || '').toLowerCase();
          if (['link', 'links', 'tabgroup', 'tab group'].includes(category)) {
            snippetMatches.push({
              id: item.snippet.id || item.snippet.snippet_id || `snippet-${Math.random()}`,
              type: 'snippet',
              label: item.snippet.key || 'Link',
              snippet: item.snippet,
            });
          }
        });
      }

      // Merge matches from searchDedicatedPanel (cast as compatible type) with snippet matches
      const allMatches: ContextualMatch[] = [...(dedicatedMatches as ContextualMatch[]), ...snippetMatches];

      // Compare matches to avoid unnecessary state updates
      setContextualMatches((prev: ContextualMatch[]) => {
        const matchesIds = allMatches.map(m => m.id).join(',');
        const prevIds = prev.map(m => m.id).join(',');
        if (matchesIds !== prevIds) {
          setContextualPopupIndex(-1);
          return allMatches;
        }
        return prev;
      });

      if (allMatches.length > 0) {
        setIsContextualPopupOpen(true);
      } else {
        setIsContextualPopupOpen(false);
        setContextualPopupIndex(-1);
      }
    }, [value, matchingSnippets, commands, automationSuggestions, agentCollectionSuggestions, moduleSuggestions]);

    const handleSubmit = useCallback(
      async (isAlt: boolean = false) => {
        const trimmedValue = value.trim();
        const trimmedPrompt = commandPrompt.trim();
        const historyUrls = stagedHistorySession ? Object.values(stagedHistorySession.urls).filter(Boolean) : undefined;
        const selected =
          allSuggestions.length > 0 ? allSuggestions[Math.min(highlightIndex, allSuggestions.length - 1)] : null;

        // 1. Calculate unified prompt and images for all submission paths
        let prompt = serializeRichPrompt(inputRef.current as any);
        if (lockedCommand && inlineComposerActive && inlineInputRef.current) {
          const direct = inlineInputRef.current.value.trim();
          if (direct) prompt = direct;
        }

        const enrichPromptWithMentionedTabs = async (basePrompt: string): Promise<string> => {
          if (mentionedTabs.length === 0) return basePrompt;

          const contextMap = new Map<string, string>();
          for (const mention of mentionedTabs) {
            try {
              const res: any = await new Promise(resolve => {
                const chromeAny = (window as any).chrome;
                if (chromeAny && chromeAny.runtime && chromeAny.runtime.sendMessage) {
                  chromeAny.runtime.sendMessage({ action: 'scrape_tab_by_id', tabId: mention.tabId }, resolve);
                } else {
                  resolve({ ok: false, error: 'chrome_api_missing' });
                }
              });

              let structuredText = '';
              if (res && res.ok && res.content) {
                structuredText = `\n--- Tab Content: "${mention.title}" ---\nURL: ${res.url || 'N/A'}\nContent:\n${res.content}\n-----------------------------------\n`;
              } else {
                structuredText = `\n--- Tab Content: "${mention.title}" ---\n(Failed to fetch active page content)\n-----------------------------------\n`;
              }
              contextMap.set(String(mention.tabId), structuredText);
            } catch (err) {
              console.error('[enrichPromptWithMentionedTabs] Error:', mention.tabId, err);
            }
          }

          // Perform inline replacement of @[tab:ID] placeholders
          const regex = /@\[tab:([^\]]+)\]/g;
          let enhancedPrompt = basePrompt.replace(regex, (match, tabId) => {
            const context = contextMap.get(String(tabId));
            if (context) return context;
            return match; // Keep the placeholder if no context found
          });

          // Fallback: If no placeholders were replaced but we have mentions (e.g. legacy @Title format)
          // we append them to the end as before to ensure context is never lost.
          if (enhancedPrompt === basePrompt && contextMap.size > 0) {
            let footerContext = '';
            contextMap.forEach(text => {
              footerContext += `\n${text}`;
            });
            enhancedPrompt += `\n\n[Context from Mentioned Open Tabs]\n${footerContext}`;
          }

          return enhancedPrompt;
        };

        const expandedPromptBase = expandPrompts(prompt);
        const expandedPrompt = await enrichPromptWithMentionedTabs(expandedPromptBase);
        const imagesToSubmit = [...selectedImages];

        // Pre-convert images to base64 for background submission
        const imagesWithBase64 =
          imagesToSubmit.length > 0
            ? await Promise.all(
              imagesToSubmit.map(async img => ({
                base64: await fileToBase64(img.file),
                mimeType: img.mimeType,
                filename: img.filename,
              })),
            )
            : undefined;

        

        if (trimmedValue || trimmedPrompt || lockedCommand || selected || selectedCommand) {
          trackCounterEvent('search_command_count', { source: 'new_tab' });
        }

        // Handle "Alt + Enter": Trigger Primary Command
        // If a command is available for this domain, activate it instead of opening the link
        if (isAlt && !lockedCommand && selected && (selected._kind === 'history' || selected._kind === 'bookmark')) {
          const item = selected as any;
          if (item.commandId) {
            activateCommandById(item.commandId as AnyCommandId, '');
            return;
          }
        }

        // Handle "Open URL" suggestion
        if (!lockedCommand && selected && selected._kind === 'open_url') {
          const urlToOpen = (selected as OpenUrlSuggestionItem).url;
          resetAfterCommandExecution();
          const urls = urlToOpen.split(',');
          if (urls.length > 1) {
            openMultipleLinks(urls, currentTabId);
          } else {
            openSingleLink(urlToOpen, false, currentTabId);
          }
          return;
        }

        // 1. Handle @ command selector - execute query with the selected command
        if (selectedAtCommand && trimmedValue) {
          const cmd = commands.find(c => c.id === selectedAtCommand) || COMMANDS.find(c => c.id === selectedAtCommand);
          if (cmd) {
            // Resolve @Mentions before sending to selected command
            const expandedValue = expandPrompts(trimmedValue);
            setSelectedAtCommand(null);
            resetAfterCommandExecution();
            runRemoteCommand(cmd, expandedValue);
            return;
          } else {
            // Command not installed - show styled dialog and reset (safeguard)
            console.warn('[Searchbar] Selected @ command not found in installed commands:', selectedAtCommand);
            const commandName = selectedAtCommand;
            setSelectedAtCommand(null);
            if (!isLoggedIn) {
              setLoginRequiredDialog({ isOpen: true, commandName });
            } else {
              setCommandNotInstalledDialog({ isOpen: true, commandName, commandId: commandName });
            }
            return;
          }
        }

        // 2. PRIORITY 1: Handle LOCKED COMMAND execution (Prompt submission)
        if (lockedCommand) {
          // Bookmarks command special handling
          if (isBookmarksCommand(lockedCommand)) {
            const bookmarkItem =
              selected && selected._kind === 'bookmark'
                ? selected
                : bookmarkSuggestions[Math.min(highlightIndex, Math.max(0, bookmarkSuggestions.length - 1))];
            if (bookmarkItem?.url) {
              openSingleLink(bookmarkItem.url, false, currentTabId);
              resetAfterCommandExecution();
              return;
            } else if (trimmedValue) {
              const chromeAny = (window as any)?.chrome;
              const response = await new Promise<any>(resolve =>
                chromeAny?.runtime?.sendMessage?.({ action: 'bookmarks_search', query: trimmedValue }, resolve),
              );
              const first = (response?.results || []).find((n: any) => !!n.url);
              if (first?.url) {
                openSingleLink(first.url, false, currentTabId);
                resetAfterCommandExecution();
                return;
              }
            }
            return;
          }

          // Local Entity commands (Delete/Rename workspace or folder)
          if (lockedLocalDef) {
            const asSnippet = (item: any): SnippetSuggestion | null => {
              if (!item || item._kind !== 'snippet') return null;
              return { snippet: item.snippet, workspace: item.workspace, folder: item.folder };
            };
            if (lockedLocalDef.scope === 'snippet') {
              const snippetItem =
                asSnippet(selected) ??
                asSnippet(
                  snippetEntitySuggestions[Math.min(highlightIndex, Math.max(0, snippetEntitySuggestions.length - 1))],
                );
              if (snippetItem) {
                handleSnippetDelete(snippetItem);
                resetAfterCommandExecution();
              }
              return;
            }
            if (selected && selected._kind === 'workspace') {
              dispatchWorkspaceAction(selected.action, {
                workspaceId: selected.workspace.workspace_id,
                workspaceName: selected.workspace.workspace_name,
              });
              resetAfterCommandExecution();
              return;
            }
            return;
          }

          if (lockedCommand === 'ai') {
            if (!prompt && imagesToSubmit.length === 0) {
              // Only show the toast if the user explicitly had text then cleared it.
              // If the input is simply empty from the start (just locked), silently do nothing.
              if (inlineInputRef.current && inlineInputRef.current.value.trim().length > 0) {
                triggerToast('Prompt is required', 'error');
                setFooterStatus({ message: 'Prompt is required', type: 'error' });
                setTimeout(() => setFooterStatus(null), 3000);
              }
              return;
            }
            await runAggregateCommand(expandedPrompt, imagesToSubmit, historyUrls);
            // Do NOT call resetAfterCommandExecution here â€” runAggregateCommand already handles
            // setValue('') and setLockedCommand('ai') to maintain the locked AI session.
            return;
          }

          if (lockedCommand === 'todo') {
            window.dispatchEvent(
              new CustomEvent('trigger-add-todo', {
                detail: {
                  item: {
                    key: expandedPrompt || '',
                    value: '',
                    category: 'note',
                    openAutomatically: true,
                  },
                },
              }),
            );
            resetAfterCommandExecution();
            return;
          }

          const remoteCommand =
            commands.find(c => c.id === lockedCommand) || COMMANDS.find(c => c.id === lockedCommand);
          if (remoteCommand) {
            const isAiGroupMember = AI_GROUP.members.includes(remoteCommand.id as any);
            const needsPrompt =
              isAiGroupMember ||
              remoteCommand.urlTemplate.includes('{query}') ||
              remoteCommand.urlTemplate.includes('[query]');
            if (needsPrompt && !prompt && imagesToSubmit.length === 0 && !stagedHistorySession) {
              // Only notify if the inline input had text that got cleared â€” not on a fresh empty lock
              const hasInlineText = inlineInputRef.current && inlineInputRef.current.value.trim().length > 0;
              if (hasInlineText) {
                triggerToast('Prompt is required', 'error');
                setFooterStatus({ message: 'Prompt is required', type: 'error' });
                setTimeout(() => setFooterStatus(null), 3000);
              }
              return;
            }

            // If we have a staged history session, we use its SPECIFIC URL if matching the command
            if (stagedHistorySession) {
              const specificUrl = stagedHistorySession.urls[remoteCommand.id as string];
              if (specificUrl) {
                
                saveAiLog(stagedHistorySession.sessionKey || stagedHistorySession.id, expandedPrompt);
                const autoSubmit: AutoSubmitRequest = {
                  kind: remoteCommand.id as AutoSubmitKind,
                  prompt: expandedPrompt,
                  images: imagesWithBase64,
                };

                openLinksWithAutoSubmit([{ url: specificUrl, active: true, autoSubmit }]).then(() => {
                  setStagedHistorySession(null);
                  const isAiHistoryMember = AI_GROUP.members.includes(remoteCommand.id as any);
                  if (isAiHistoryMember) {
                    setValue('');
                    setCommandPrompt('');
                    clearSelectedImages();
                  } else {
                    resetAfterCommandExecution();
                  }
                });
                return;
              }

              // If we have other history URLs but none for THIS command, maybe user switched AIs?
              // In that case, we fall back to runRemoteCommand which will open a NEW chat on the selected AI.
              
            }

            await runRemoteCommand(remoteCommand, expandedPrompt, imagesToSubmit);

            const isAiLockedMember = AI_GROUP.members.includes(remoteCommand.id as any);
            if (isAiLockedMember) {
              // For AI group members, maintain the locked session
              setValue('');
              setCommandPrompt('');
              clearSelectedImages();
              // Don't call resetAfterCommandExecution() to keep the lock
            } else {
              resetAfterCommandExecution();
            }
            return;
          }

          if (isLocalCommandId(lockedCommand)) {
            const def = LOCAL_COMMANDS.find(c => c.id === (lockedCommand as LocalCommandId));
            if (def?.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (def.id === 'calendar') {
                const p = prompt || value || '';
                resetAfterCommandExecution();
                handleLocalCommandExecute('calendar', { prompt: p });
                return;
              }

              resetAfterCommandExecution();
              handleLocalCommandExecute((def.executeId || def.id) as LocalCommandId);
              return;
            }

            if (def?.behavior === 'locked') {
              (async () => {
                const base64Files = await Promise.all(
                  imagesToSubmit.map(async img => ({
                    base64: await fileToBase64(img.file),
                    filename: img.filename,
                    mimeType: img.mimeType,
                  })),
                );
                handleLocalCommandExecute(def.id as LocalCommandId, { prompt: expandedPrompt, files: base64Files });
                if (def.id !== 'saved-automation') {
                  resetAfterCommandExecution();
                }
              })();
              return;
            }
          }
          return;
        }

        // 3. PRIORITY 2: Handle SUGGESTION execution (When no command is locked)
        if (selected) {
          if (selected._kind === 'math_result' || selected._kind === 'time_result') {
            return;
          }

          if (selected._kind === 'command' && selected.commandType === 'local') {
            const def = selected.command;
            if (def.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (def.id === 'calendar') {
                activateCommandById(selected.id as AnyCommandId, '');
                return;
              }

              handleLocalCommandExecute((def.executeId || def.id) as LocalCommandId);
              resetAfterCommandExecution();
              return;
            }
            activateCommandById(selected.id as AnyCommandId, '');
            return;
          }

          if (
            selected._kind === 'command' &&
            (selected.commandType === 'remote' || selected.commandType === 'aggregate')
          ) {
            // Check for instant browser commands
            if (selected.commandType === 'remote' && selected.command) {
              const isBrowserInstant =
                selected.command.category === 'browser' && !selected.command.urlTemplate.includes('{query}');
              if (isBrowserInstant) {
                runRemoteCommand(selected.command, '');
                resetAfterCommandExecution();
                return;
              }
            }

            const firstSpaceIndex = trimmedValue.indexOf(' ');
            const firstToken = firstSpaceIndex !== -1 ? trimmedValue.substring(0, firstSpaceIndex) : trimmedValue;
            const remainingText = firstSpaceIndex !== -1 ? trimmedValue.substring(firstSpaceIndex + 1).trim() : '';

            const prefixLower = (selected.prefix || '').toLowerCase();
            const idLower = `/${selected.id}`.toLowerCase();
            const tokenLower = firstToken.toLowerCase();

            let promptForExecution = remainingText;

            if (tokenLower && (prefixLower.startsWith(tokenLower) || idLower.startsWith(tokenLower))) {
              promptForExecution = remainingText;
            } else {
              const extraction = extractPromptFromInput(value, { id: selected.id, prefix: selected.prefix });
              promptForExecution = extraction.matched ? extraction.prompt : trimmedValue;

              if (!extraction.matched) {
                const pinInfo = detectPinnedCommand(trimmedValue, commands);
                if (pinInfo.pinned && pinInfo.pinned.id === selected.id) {
                  promptForExecution = pinInfo.searchQuery.trim();
                }
              }
            }

            if (!promptForExecution) {
              activateCommandById(selected.id as AnyCommandId, '');
              return;
            }

            if (selected.commandType === 'aggregate') {
              const exp = expandPrompts(promptForExecution);
              const imgs = [...selectedImages];
              await runAggregateCommand(exp, imgs, historyUrls);
            } else if (selected.command) {
              const isAiSuggestionMember = AI_GROUP.members.includes(selected.command.id as any);
              if (!isAiSuggestionMember && selected.id !== 'ai') {
                const remoteCmd = selected.command;
                const words = trimmedValue.split(/\s+/);
                const triggerWords = [
                  selected.id,
                  (selected.prefix || '').replace('/', ''),
                  ...(remoteCmd?.keywords || [])
                ].filter(Boolean);
                
                const filteredWords = words.filter(word => {
                  const normalizedWord = word.toLowerCase();
                  return !triggerWords.some(trigger => 
                    trigger.toLowerCase().startsWith(normalizedWord) || 
                    normalizedWord.startsWith(trigger.toLowerCase())
                  );
                });
                let extractedQuery = filteredWords.join(' ').trim();
                extractedQuery = extractedQuery.replace(/^\/([aAnsSplLcCbBtT])\s*/i, '');
                
                activateCommandById(selected.id as AnyCommandId, extractedQuery);
              } else {
                const exp = expandPrompts(promptForExecution);
                const imgs = [...selectedImages];
                await runRemoteCommand(selected.command, exp, imgs);
                if (isAiSuggestionMember) {
                  setValue('');
                  setCommandPrompt('');
                  clearSelectedImages();
                } else {
                  resetAfterCommandExecution();
                }
              }
            }
            return;
          }

          if (selected._kind === 'common_command') {
            await executeCommonCommand(selected);
            return;
          }

          if (selected._kind === 'snippet') {
            const hasMention = /@\w/.test(trimmedValue);
            if (!hasMention) {
              activateSnippetSuggestion({
                snippet: selected.snippet,
                workspace: selected.workspace,
                folder: selected.folder,
              });
              return;
            }
            // Fall through if mention is present to let fallback AI handle it
          }

          if (selected._kind === 'bookmark' && selected.url) {
            const urlToOpen = selected.url;
            resetAfterCommandExecution();
            openSingleLink(urlToOpen, false, currentTabId);
            return;
          }

          if (selected._kind === 'history' && selected.url) {
            const urlToOpen = selected.url;
            resetAfterCommandExecution();
            openSingleLink(urlToOpen, false, currentTabId);
            return;
          }

          if (selected._kind === 'agent_collection') {
            handleAgentCollectionSelect(selected);
            return;
          }

          if (selected._kind === 'automation') {
            handleAutomationSelect(selected.automation);
            return;
          }

          if (selected._kind === 'module') {
            handleAutomationSelect(buildAutomationFromModule(selected.module));
            return;
          }

          if (selected._kind === 'folder_search') {
            const { folder, workspace, entryType } = selected;
            const currentState = store.getState();
            const expandedWorkspaces = selectExpandedWorkspaces(currentState);
            if (!expandedWorkspaces[workspace.workspace_id]) {
              store.dispatch(expandAllWorkspaces({ ...expandedWorkspaces, [workspace.workspace_id]: true }));
            }
            store.dispatch(setSelectedWorkspace(workspace));
            if (entryType === 'workspace') {
              store.dispatch(setSelectedFolder(null));
              store.dispatch(setSelectedSnippet(null));
              store.dispatch(setIsCreatingNewItem(false));
              store.dispatch(
                setSnippetBreadCrum({
                  workspace_id: workspace.workspace_id,
                  workspace_name: workspace.workspace_name,
                  folder_id: null,
                  folder_name: null,
                }),
              );
            } else if (folder) {
              store.dispatch(setSelectedFolder(folder));
              store.dispatch(setSelectedSnippet(null));
              store.dispatch(setIsCreatingNewItem(false));
              store.dispatch(
                setSnippetBreadCrum({
                  workspace_id: workspace.workspace_id,
                  workspace_name: workspace.workspace_name,
                  folder_id: folder.folder_id,
                  folder_name: folder.folder_name,
                }),
              );
            }
            setValue('');
            return;
          }
        }

        // 4. PRIORITY 3: Handle execution/activation from PREVIEW state (selectedCommand)
        if (selectedCommand) {
          // Instant Browser command
          const remoteCmd =
            commands.find(c => c.id === selectedCommand.id) || COMMANDS.find(c => c.id === selectedCommand.id);
          if (remoteCmd?.category === 'browser' && !remoteCmd.urlTemplate.includes('{query}')) {
            runRemoteCommand(remoteCmd, '');
            const isAiPreviewBrowserMember = AI_GROUP.members.includes(remoteCmd.id as any);
            if (isAiPreviewBrowserMember) {
              setValue('');
              setCommandPrompt('');
              clearSelectedImages();
            } else {
              resetAfterCommandExecution();
            }
            return;
          }

          // Instant Local command
          if (selectedCommand.commandType === 'local') {
            const localDef = LOCAL_COMMANDS.find(c => c.id === selectedCommand.id);
            if (localDef?.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (localDef.id === 'calendar') {
                activateCommandById(selectedCommand.id, '');
                return;
              }

              handleLocalCommandExecute((localDef.executeId || localDef.id) as LocalCommandId);
              const isAiPreviewLocalMember = AI_GROUP.members.includes(selectedCommand.id as any);
              if (isAiPreviewLocalMember) {
                setValue('');
                setCommandPrompt('');
                clearSelectedImages();
              } else {
                resetAfterCommandExecution();
              }
              return;
            }
            activateCommandById(selectedCommand.id, '');
            return;
          }

          // Command activation (move to locked state) if prompt is empty
          if (commandSupportsInlineQuery(selectedCommand)) {
            const extraction = extractPromptFromInput(value, {
              id: selectedCommand.id,
              prefix: selectedCommand.prefix,
            });
            if (extraction.matched && !extraction.prompt) {
              activateCommandById(selectedCommand.id, '');
              return;
            }
          }
        }

        // 5. FALLBACK: Parse input for potential command or direct search/URL
        const remoteTokens = commands
          .flatMap(c => [normalizeCommandToken(c.id), normalizeCommandToken(c.prefix)])
          .filter(Boolean);
        const localTokens = LOCAL_COMMANDS.flatMap(c => [
          normalizeCommandToken(c.id),
          normalizeCommandToken(c.prefix),
        ]).filter(Boolean);
        const tokenSet = Array.from(new Set(['ai', ...remoteTokens, ...localTokens]));

        if (!trimmedValue) return;

        let cmdToken = '';
        prompt = ''; // Reuse outer block prompt
        const fallbackSpaceIndex = trimmedValue.indexOf(' ');
        const fallbackToken = fallbackSpaceIndex !== -1 ? trimmedValue.substring(0, fallbackSpaceIndex) : trimmedValue;
        const fallbackRemaining =
          fallbackSpaceIndex !== -1 ? trimmedValue.substring(fallbackSpaceIndex + 1).trim() : '';

        if (fallbackToken.startsWith('/')) {
          const typedToken = fallbackToken.slice(1).toLowerCase();
          if (typedToken) {
            const matchedFullToken = tokenSet.find(t => t.toLowerCase().startsWith(typedToken));
            if (matchedFullToken) {
              cmdToken = matchedFullToken;
              prompt = fallbackRemaining;
            }
          }
        }

        if (!cmdToken) {
          const pattern = new RegExp(`^\\/?(${tokenSet.map(escapeRegExp).join('|')})(?=$|\\s|:)`, 'i');
          const match = trimmedValue.match(pattern);
          if (match) {
            cmdToken = match[1].toLowerCase();
            prompt = trimQuery(trimmedValue.slice(match[0].length).replace(/^[:\s]+/, ''));
          }
        }

        if (cmdToken) {
          if (cmdToken === 'ai') {
            if (!prompt && selectedImages.length === 0) activateCommandById('ai', '');
            else if (!prompt) {
              triggerToast('Prompt is required', 'error');
              setFooterStatus({ message: 'Prompt is required', type: 'error' });
              setTimeout(() => setFooterStatus(null), 3000);
            } else {
              const exp = expandPrompts(prompt);
              runAggregateCommand(exp, selectedImages, historyUrls);
            }
            return;
          }

          // Check local commands
          if (isLocalCommandId(cmdToken)) {
            const def = LOCAL_COMMANDS.find(c => c.id === (cmdToken as LocalCommandId));
            if (def?.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (def.id === 'calendar') {
                activateCommandById('calendar', '');
                return;
              }

              handleLocalCommandExecute((def.executeId || def.id) as LocalCommandId);
              resetAfterCommandExecution();
              return;
            }
            if (!checkLocalCommandAuth(cmdToken as LocalCommandId)) return;
            setLockedCommand(cmdToken as LocalCommandId);
            setValue(prompt);
            setCommandPrompt('');
            setTimeout(() => inputRef.current?.focus(), 0);
            return;
          }

          // Check remote commands
          const remoteCmd = commands.find(
            c => normalizeCommandToken(c.id) === cmdToken || normalizeCommandToken(c.prefix) === cmdToken,
          ) || COMMANDS.find(
            c => normalizeCommandToken(c.id) === cmdToken || normalizeCommandToken(c.prefix) === cmdToken,
          );
          if (remoteCmd) {
            const needsPrompt = remoteCmd.urlTemplate.includes('{query}') || remoteCmd.urlTemplate.includes('[query]');
            if (!prompt && selectedImages.length === 0) {
              activateCommandById(remoteCmd.id as AnyCommandId);
            } else if (needsPrompt && !prompt) {
              triggerToast('Prompt is required', 'error');
              setFooterStatus({ message: 'Prompt is required', type: 'error' });
              setTimeout(() => setFooterStatus(null), 3000);
            } else {
              runRemoteCommand(remoteCmd, expandPrompts(prompt), selectedImages);
              const isAiFallbackMember = AI_GROUP.members.includes(remoteCmd.id as any);
              if (isAiFallbackMember) {
                setValue('');
                setCommandPrompt('');
                clearSelectedImages();
              } else {
                resetAfterCommandExecution();
              }
            }
            return;
          }
        }

        // Final fallback: URL or AI Search
        if (looksLikeUrl(trimmedValue)) {
          const urlToOpen = normalizeUrl(trimmedValue);
          resetAfterCommandExecution();
          openSingleLink(urlToOpen, false, currentTabId);
        } else {
          // If staged history session exists in fallback (AI search), use its URLs
          if (historyUrls && historyUrls.length > 0) {
            
            await runAggregateCommand(expandedPrompt, imagesWithBase64, historyUrls);
            setStagedHistorySession(null);
            return;
          }

          // If no staged history, perform a clean "All AI" trigger with UI locking
          setLockedCommand('ai');
          setCommandPrompt(value);

          // Trigger the internal execution logic
          runAggregateCommand(expandedPrompt, imagesWithBase64);

          // Clear typical search artifacts but KEEP the locked state
          suggestionVisibilityRef.current = false;
          clearSelectedImages();
          setStagedHistorySession(null);
          if (stagedHistorySessionRef) stagedHistorySessionRef.current = null;
        }
      },
      [
        value,
        commandPrompt,
        allSuggestions,
        highlightIndex,
        selectedCommand,
        lockedCommand,
        selectedAtCommand,
        commands,
        expandPrompts,
        runRemoteCommand,
        runAggregateCommand,
        resetAfterCommandExecution,
        bookmarkSuggestions,
        lockedLocalDef,
        snippetEntitySuggestions,
        handleSnippetDelete,
        inlineComposerActive,
        handleLocalCommandExecute,
        activateCommandById,
        executeCommonCommand,
        activateSnippetSuggestion,
        activateSelectedCommand,
        currentTabId,
        selectedImages,
        triggerToast,
        stagedHistorySession,
        isBoardViewEnabled,
      ],
    );

    const handleInlineKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        // HARD FIX: If favorites context menu is open, ignore ALL navigation/keys here
        if ((window as any).isFavoritesMenuOpen) return;

        const { key } = event;
        const input = event.currentTarget;
        const hasSelection = input.selectionStart !== input.selectionEnd;

        if (showSavedAgentsMenu) {
          if (key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setSavedAgentHighlightIndex(prev => (prev < savedAgentSuggestions.length - 1 ? prev + 1 : 0));
            return;
          }
          if (key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setSavedAgentHighlightIndex(prev => (prev > 0 ? prev - 1 : savedAgentSuggestions.length - 1));
            return;
          }
          if (key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const targetAgent = savedAgentSuggestions[savedAgentHighlightIndex];
            if (targetAgent) {
              handleSavedAgentSelection(targetAgent);
            }
            return;
          }
          if (key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setShowSavedAgentsMenu(false);
            setSavedAgentSuggestions([]);
            return;
          }
        }

        if (showAtCommandMenu) {
          const filteredCmds = filteredAtCommands;
          const hasCommands = filteredCmds.length > 0;
          const maxIndex = Math.max(0, filteredCmds.length - 1);
          if (hasCommands && key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setAtCommandHighlightIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
            return;
          }
          if (hasCommands && key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setAtCommandHighlightIndex(prev => (prev < maxIndex ? prev + 1 : 0));
            return;
          }
          if (key === 'Enter' || key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            const selectedCmd = filteredCmds[atCommandHighlightIndex];
            if (selectedCmd) handleAtCommandSelect(selectedCmd.id);
            return;
          }
          if (key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setShowAtCommandMenu(false);
            return;
          }
        }

        if (key === 'ArrowLeft' && !hasSelection) {
          event.preventDefault();
          exitCommandMode();
          return;
        }

        if (event.ctrlKey && (key === 'u' || key === 'U')) {
          if (
            lockedCommand === 'gpt' ||
            lockedCommand === 'ai' ||
            lockedCommand === 'perplexity' ||
            lockedCommand === 'claude' ||
            lockedCommand === 'upload_drive'
          ) {
            event.preventDefault();
            fileInputRef.current?.click();
            return;
          }
        }

        if (key === 'ArrowDown') {
          event.preventDefault();
          exitCommandMode();
          return;
        }

        if (key === 'ArrowUp') {
          event.preventDefault();
          exitCommandMode();
          return;
        }

        if (key === 'Backspace') {
          const input = event.currentTarget;
          const hasSelection = input.selectionStart !== input.selectionEnd;

          // If in Command List View (via terminal icon)
          if (isCommandListView && !hasSelection) {
            // If input is empty, close the view immediately
            if (value === '') {
              event.preventDefault();
              onToggleCommandListView?.(false);
              return;
            }
          }

          if (!hasSelection && commandPrompt.length === 0) {
            // 1. First remove files one by one
            if (selectedImages.length > 0) {
              event.preventDefault();
              setSelectedImages(prev => prev.slice(0, -1));
              return;
            }

            // 2. Remove mentioned tabs one by one
            if (mentionedTabs.length > 0) {
              event.preventDefault();
              setMentionedTabs(prev => prev.slice(0, -1));
              return;
            }

            // 3. Then exit command mode if no files or tabs left
            if (lockedCommand) {
              event.preventDefault();
              exitCommandMode();
              return;
            }

            // [NEW] If in Alt+S initial state and search bar is empty, reset to normal interactive list
            if (isInitialAltSFocus && !value && onInitialAltSFocusChange) {
              event.preventDefault();
              onInitialAltSFocusChange(false);
              return;
            }
          }
        }

        if (key === 'Enter') {
          if ((event.ctrlKey || event.metaKey) && lockedCommand === 'ai') {
            event.preventDefault();
            onSaveAgent?.();
            return;
          }
          event.preventDefault();
          handleSubmit(event.altKey);
          return;
        }

        if (key === 'Escape') {
          event.preventDefault();
          // Reset Alt+S initial state when Escape is pressed
          if (isInitialAltSFocus && onInitialAltSFocusChange) {
            onInitialAltSFocusChange(false);
          }
          exitCommandMode();
        }
      },
      [
        commandPrompt.length,
        exitCommandMode,
        handleSubmit,
        isCommandListView,
        onToggleCommandListView,
        value,
        lockedCommand,
        selectedImages.length, // Added
        setSelectedImages, // Added
        showSavedAgentsMenu,
        savedAgentSuggestions,
        savedAgentHighlightIndex,
        handleSavedAgentSelection,
        showAtCommandMenu,
        filteredAtCommands,
        atCommandHighlightIndex,
        handleAtCommandSelect,
        isBoardViewEnabled,
        onToggleBoardView,
        isInitialAltSFocus,
        onInitialAltSFocusChange,
      ],
    );

    useEffect(() => {
      let t: number | null = null;
      if (pendingQueryUrls && queryInputRef.current) {
        // Focus after mount
        t = window.setTimeout(() => queryInputRef.current?.focus(), 0);
      }
      return () => {
        if (t) window.clearTimeout(t);
      };
    }, [pendingQueryUrls]);

    // Search focus is controlled via omnibox_override_enabled.
    // We still surface a recovery shortcut hint when the input is not focused.

    useEffect(() => {
      if (typeof window === 'undefined') return;

      if (!isSuggestionVisible) {
        suggestionVisibilityRef.current = false;
        setShowPromo(false);
        return;
      }

      if (!suggestionVisibilityRef.current) {
        (async () => {
          const storageKey = 'alts_search_suggestion_count';
          const chromeAny = (window as any).chrome;
          if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(storageKey, resolve));
            const raw = result[storageKey];
            const currentCount = Number.isFinite(Number(raw)) ? Number(raw) : 0;
            const nextCount = currentCount + 1;
            await new Promise<void>(resolve => chromeAny.storage.local.set({ [storageKey]: nextCount }, resolve));
            setShowPromo(nextCount % 1 === 0);
          }
        })();
      }

      suggestionVisibilityRef.current = true;
    }, [isSuggestionVisible]);

    // Fetch bookmark suggestions when in /bookmarks mode
    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        if (!isBookmarksCommand(lockedCommand)) {
          if (!cancelled) setBookmarkSuggestions([]);
          return;
        }
        const q = value.trim();
        
        // Skip search for long queries to prevent lag
        if (!q || q.length > 17) {
          if (!cancelled) setBookmarkSuggestions([]);
          return;
        }
        const chromeAny = (window as any)?.chrome;
        const response = await new Promise<any>(resolve =>
          chromeAny?.runtime?.sendMessage?.({ action: 'bookmarks_search', query: q }, resolve),
        );
        const nodes: Array<any> = response?.results || [];
        
        if (cancelled) return;
        const items = (nodes || [])
          .filter((n: any) => !!n.url)
          .slice(0, 50)
          .map(
            (n: any): BookmarkSuggestionItem => ({
              _kind: 'bookmark',
              id: n.id,
              title: n.title || n.url,
              url: n.url as string,
            }),
          );
        setBookmarkSuggestions(items);
      };
      run();
      return () => {
        cancelled = true;
      };
    }, [lockedCommand, value]);

    useEffect(() => {
      if (!onSuggestionStateChange) return;

      const newState: SuggestionState = {
        isVisible: isSuggestionVisible,
        suggestions: allSuggestions,
        highlightIndex,
        mode: suggestionMode,
        value: inlineComposerActive && lockedCommand !== 'ai' ? commandPrompt : value,
        lockedCommand,
        onCommandMouseDown: handleCommandMouseDown,
        onHighlightIndexChange: handleHighlightIndexChange,
        isCommandLocked: !!lockedCommand,
        requiresInlineQuery: inlineComposerVisible,
        onFolderMouseDown: (event: React.MouseEvent, folder: Folder) => {
          if (event) event.preventDefault();
          store.dispatch(setSelectedFolder(folder));
          setLockedCommand(null);
          setValue('');
          setCommandPrompt('');
        },

        onLocalSelect: lockedLocalDef
          ? (item: any) => {
            if (item?._kind === 'workspace') {
              dispatchWorkspaceAction(item.action, {
                workspaceId: item.workspace.workspace_id,
                workspaceName: item.workspace.workspace_name,
              });
              setLockedCommand(null);
              setValue('');
              setCommandPrompt('');
            }
          }
          : undefined,
        onSnippetSelect:
          suggestionMode === 'snippet' || suggestionMode === 'mixed' || suggestionMode === 'local'
            ? (item: SnippetSuggestion) => {
              if (isSnippetCommand) {
                handleSnippetDelete(item);
              } else {
                handleSnippetSelect(item);
              }
            }
            : undefined,
        onCommonCommandSelect:
          suggestionMode === 'common' || suggestionMode === 'mixed'
            ? (item: CommonCommandSuggestionItem) => {
              executeCommonCommand(item);
            }
            : undefined,
        onRequestSnippetDelete,
        onRequestEditLink,
        onRequestEditPrompt,

        onToggleFavorite,
        showPromo,
        footerStatus,
        onRequestOpenUrls: (urls: string[], title?: string) => {
          if (!urls || urls.length === 0) return;
          const needsVar = urls.some(u => /\{query\}|\[query\]/i.test(String(u)));
          if (!needsVar) {
            if (urls.length === 1) openSingleLink(urls[0], false, currentTabId);
            else openMultipleLinks(urls, currentTabId);
            return;
          }
          setPendingQueryUrls(urls);
          setQueryValue('');
          setPendingQueryLabel(title || '');
        },
        isPromptMenuOpen: showPromptMenu,
        inlineAutocomplete,
        onInlineAutocompleteChange: setInlineAutocomplete,
        isBackspacing: lastActionRef.current === 'backspace',
        isAtMenuOpen: showAtCommandMenu,
        onAgentCollectionSelect: handleAgentCollectionSelect,
        onAutomationSelect: handleAutomationSelect,
        onModuleSelect: (module: InstalledModule) => handleAutomationSelect(buildAutomationFromModule(module)),
        onAIHistorySelect: () => { },
        onAIHistoryPanelToggle: (show: boolean) => setShowAIHistoryPanel(show),
        onAutomationEdit: onAutomationEdit || onRequestAutomationEdit,
        selectedImagesCount: selectedImages.length,
        isContextualPopupOpen,
        showAIHistoryPanel,
        aiHistory: [],
        isAutomationActive: !!activeCollection,
        selectedAIs,
        onToggleAI: handleToggleAI,
        activeAiSession,
        selectedAutomation,
        updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => {
          setActiveAiSession(prev => {
            if (!prev) return metadata.id ? ({ id: metadata.id, ...metadata } as any) : null;
            return { ...prev, ...metadata };
          });
        },
        selectedImages: selectedImages,
        onRemoveAttachment: (index: number) => {
          setSelectedImages(prev => prev.filter((_, i) => i !== index));
        },
        onQueryChange: (val: string) => {
          setValue(val);
        },
        onUpdateModelUrl,
        onUpdateCustomModels,
        isAIHistoryOpen,
        onToggleAIHistory,
      };

      onSuggestionStateChange(newState);
    }, [
      allSuggestions,
      handleCommandMouseDown,
      handleHighlightIndexChange,
      handleSnippetDelete,
      handleSnippetSelect,
      executeCommonCommand,
      highlightIndex,
      isSuggestionVisible,
      isSnippetCommand,
      lockedCommand,
      onSuggestionStateChange,
      suggestionMode,
      value,
      commandPrompt,
      inlineComposerActive,
      showPromo,
      lockedLocalDef,
      footerStatus,
      onRequestEditLink,
      onRequestEditPrompt,
      onRequestSnippetDelete,
      onToggleFavorite,
      showPromptMenu,
      currentTabId,
      inlineAutocomplete,
      showAtCommandMenu,
      handleAgentCollectionSelect,
      handleAutomationSelect,
      buildAutomationFromModule,
      handleAIHistorySelect,
      onAutomationSelect,
      onAutomationEdit,
      onRequestAutomationEdit,
      selectedImages,
      isContextualPopupOpen,
      showAIHistoryPanel,
      activeCollection,
      selectedAIs,
      handleToggleAI,
      activeAiSession,
      selectedAutomation,
      onUpdateModelUrl,
      isAIHistoryOpen,
      onToggleAIHistory,
    ]);

    useEffect(() => {
      // Notify parent of the full query state (either the main value or the command prompt if locked)
      // This ensures the parent's searchValue is always in sync, especially for clearing.
      onQueryChange?.(inlineComposerActive ? commandPrompt : value);
    }, [value, commandPrompt, lockedCommand, inlineComposerActive, onQueryChange]);

    useEffect(() => {
      return () => {
        onSuggestionStateChange?.(null);
      };
    }, [onSuggestionStateChange]);

    return (
      <div
        className="relative w-full"
        data-at-menu-open={showAtCommandMenu}
        data-suggestion-visible={isSuggestionVisible}
        data-prompt-menu-open={showPromptMenu}
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>
        {/* Unified Close Button removed from global fixed scope - moved into container header below */}

        {/* Global Drag Overlay */}

        {isGlobalDragging && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none transition-all duration-300">
            <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-white/60 bg-white/10 p-12 text-white shadow-2xl backdrop-blur-md">
              <div className="rounded-full bg-white/20 p-6">
                <FaFileImage size={48} className="animate-bounce" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Drop files to attach</h2>
              <p className="text-white/70">Images and supported documents allowed</p>
            </div>
          </div>
        )}
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept={
            lockedCommand === 'gpt' ||
              lockedCommand === 'claude' ||
              lockedCommand === 'perplexity' ||
              lockedCommand === 'gemini' ||
              lockedCommand === 'ai' ||
              !lockedCommand // Allow all files when no command is locked to enable Prompt Mode
              ? '*/*'
              : 'image/png,image/jpeg,image/webp,image/gif' // Added GIF support for regularity
          }
          className="hidden"
          onChange={handleFileSelect}
        />

        <div
          className={`relative ${isDragging ? 'ring-2 ring-blue-500/50 rounded-xl' : ''} ${activeCollection ? 'z-[9999] rounded-2xl' : ''}`}>
          {' '}
          {/* TutorialCards disabled here in favor of the new full-screen TutorialDashboard */}
          {/* Tiered Header - Prefix (Command Chip or Automation Info) */}
          {!activeCollection && (
            <>
              <div
                ref={prefixRef}
                className={`${lockedCommand
                  ? 'absolute bottom-full left-[0px] pb-2'
                  : 'absolute left-[12px] min-[1600px]:left-[14px] min-[1800px]:left-[16px] top-1/2 -translate-y-1/2'
                  } z-20 flex items-center gap-2 pointer-events-auto`}>
                {renderPrimaryPrefix()}
              </div>
            </>
          )}
          <div
            className={`flex flex-col justify-end w-full relative ${activeCollection ? 'min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px]' : 'min-h-[48px]'}`}>
            {/* Layer 2: Action (Injected Inputs) */}
            {activeCollection && (
              <div className="relative w-full">
                {/* Automation Title Heading (Above Border) */}
                <div className="absolute bottom-full left-[12px] min-[1350px]:left-[12px] min-[1600px]:left-[14px] min-[1800px]:left-[16px] pb-2 z-20 flex items-center gap-2 pointer-events-auto">
                  {renderPrefix()}
                </div>

                {/* Main Automation Area (Bordered Box) */}
                <div
                  className={`w-full py-3 rounded-t-xl bg-[var(--color-inputBg)] border ${activeTutorial === 'search' || activeTutorial === 'agent' ? 'border-[#22c55e]' : 'border-[#aeaeae] dark:border-white/10'} backdrop-blur-xl shadow-none min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px]`}
                  style={{ paddingLeft: `${dynamicLeftOffset}px` }}>
                  <AutomationInputs
                    headless
                    isSingleField={activeCollection.fields.length === 1}
                    dynamicLeftOffset={0} // Padding is now handled by the parent container for perfect alignment
                    title={activeCollection.item?.name || activeCollection.item?.title || 'Automation'}
                    automation={activeCollection.item?.automation || activeCollection.item}
                    fields={activeCollection.fields as any} // Cast as any if TS mismatch exists
                    focusedFieldIndex={activeCollection.focusedFieldIndex}
                    onFieldChange={(idx, val) => {
                      const nextFields = [...activeCollection.fields];
                      nextFields[idx] = { ...nextFields[idx], value: val };
                      
                      setActiveCollection({ ...activeCollection, fields: nextFields });
                    }}
                    onFocusChange={idx => {
                      setActiveCollection({ ...activeCollection, focusedFieldIndex: idx });
                    }}
                    onExecute={handleCollectionSubmit}
                    onCancel={() => setActiveCollection(null)}
                  />
                </div>
              </div>
            )}

            {/* Standard Search Interface (Transitioned to Hidden during Automation) */}
            <div
              className={`relative w-full ${activeCollection ? 'h-0 overflow-hidden opacity-0 pointer-events-none' : ''} ${activeTutorial === 'search' || activeTutorial === 'agent' ? 'pointer-events-none' : ''}`}>
              <div
                ref={inputRef as any}
                contentEditable={!activeCollection}
                onMouseDown={() => {
                  
                  pendingUserFocusRef.current = true;
                }}
                onInput={e => {
                  if (activeCollection) return;

                  if (
                    e.currentTarget.innerHTML === '<br>' ||
                    e.currentTarget.innerHTML === '<br><br>' ||
                    e.currentTarget.innerHTML === '<div><br></div>' ||
                    (e.currentTarget.innerText || '').trim() === '' && !e.currentTarget.querySelector('span[data-tab-id]')
                  ) {
                    if (e.currentTarget.innerHTML !== '') {
                      e.currentTarget.innerHTML = '';
                    }
                  }

                  const nextValue = mapFullNameToShortcut(e.currentTarget.innerText || '');

                  // Sync mentioned tabs with actual DOM pills present in the input
                  const pillNodes = e.currentTarget.querySelectorAll('span[data-tab-id]');
                  const remainingIds = new Set<string>();
                  pillNodes.forEach(node => {
                    const id = node.getAttribute('data-tab-id');
                    if (id) remainingIds.add(String(id));
                  });
                  setMentionedTabs(prev => prev.filter(t => remainingIds.has(String(t.tabId))));

                  if (inlineComposerActive) {
                    setCommandPrompt(nextValue);
                    return;
                  }

                  if (inlineAutocomplete && lastActionRef.current === 'backspace') {
                    setInlineAutocomplete(null);
                  }
                  if (selectedCommand && !lockedCommand && nextValue) {
                    selectionSourceRef.current = null;
                    setSelectedCommand(null);
                  }
                  setValue(nextValue);
                  setIsSuggestionsHidden(false);
                  setTimeout(updateCursorPosition, 0);

                  if (inlineAutocomplete) {
                    const autocompleteBase = inlineAutocomplete.includes('|URL|')
                      ? inlineAutocomplete.split('|URL|')[0]
                      : inlineAutocomplete;
                    const stillMatches = autocompleteBase.toLowerCase().startsWith(nextValue.toLowerCase());
                    if (!stillMatches || !nextValue.trim()) {
                      setInlineAutocomplete(null);
                    }
                  }
                }}
                onPaste={e => {
                  handlePaste(e);
                  if (e.defaultPrevented) return;

                  const clipboardData = e.clipboardData;
                  if (!clipboardData) return;

                  const textData = clipboardData.getData('text/plain');
                  if (textData && textData.trim()) {
                    e.preventDefault();
                    document.execCommand('insertText', false, textData);
                  }
                }}
                onFocus={() => {
                  
                  setIsFocused(true);
                  setIsSuggestionsHidden(false);

                  const isUserInitiated = pendingUserFocusRef.current || isInitialAltSFocus;

                  pendingUserFocusRef.current = false;

                  onSearchbarFocus?.(isUserInitiated);

                  if (isUserInitiated) {
                    if (isBoardViewEnabled && autoTriggerDropdown && !value) {
                      setValue('/');
                    }
                  }

                  document.documentElement.classList.add('is-searchbar-focused');
                  setTimeout(updateCursorPosition, 0);
                }}
                onBlur={() =>
                  setTimeout(() => {
                    // Only set false if the textarea is still not focused
                    // (prevents cursor hiding when focus briefly leaves and returns)
                    if (document.activeElement !== inputRef.current) {
                      setKeepBoardViewOpen(false);
                      setIsFocused(false);
                      document.documentElement.classList.remove('is-searchbar-focused');
                    }
                  }, 150)
                }
                onScroll={syncScroll}
                onSelect={updateCursorPosition}
                onClick={() => {
                  
                  updateCursorPosition();

                  const isUserInitiated = pendingUserFocusRef.current || isInitialAltSFocus;
                  if (pendingUserFocusRef.current) {
                    onSearchbarFocus?.(true);
                    pendingUserFocusRef.current = false;
                  } else if (!value.trim()) {
                    onSearchbarFocus?.(true);
                  }

                  if (isUserInitiated) {
                    if (isBoardViewEnabled && autoTriggerDropdown && !value) {
                      setValue('/');
                    }
                  }
                }}
                onKeyUp={updateCursorPosition}
                onKeyDown={e => {
                  setTimeout(updateCursorPosition, 0);

                  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    lastActionRef.current = 'typing';
                  }

                  // Handle space bar after a shorthand board view filter command to convert to locked card
                  if (e.key === ' ') {
                    const text = (inputRef.current?.innerText || '').replace(/\u00A0/g, ' ').trim().toLowerCase();
                    const validShortcuts = ['/a', '/n', '/s', '/p', '/l', '/c', '/b', '/t'];
                    if (validShortcuts.includes(text)) {
                      e.preventDefault();
                      e.stopPropagation();
                      const filterChar = text.slice(1) as 'a' | 'n' | 's' | 'p' | 'l' | 'c' | 'b' | 't';
                      activeSlashFilterRef.current = filterChar;
                      setActiveSlashFilter(filterChar);
                      setValue('');
                      onQueryChange?.(`/${filterChar.toUpperCase()} `);
                      return;
                    }
                  }

                  if (e.key === 'Enter' && activeCollection) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }

                  if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
                    if (
                      lockedCommand === 'gpt' ||
                      lockedCommand === 'ai' ||
                      lockedCommand === 'perplexity' ||
                      lockedCommand === 'claude' ||
                      lockedCommand === 'gemini'
                    ) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                      return;
                    }
                  }

                  if (e.key === 'Backspace') {
                    lastActionRef.current = 'backspace';
                    const hasSelection = false;

                    if (isCommandListView && !hasSelection && !value.trim()) {
                      e.preventDefault();
                      e.stopPropagation();
                      onClearCommandListView?.();
                      onToggleCommandListView?.(false);
                      return;
                    }

                    if (value.trim() === '' && !hasSelection) {
                      if (activeSlashFilter) {
                        e.preventDefault();
                        e.stopPropagation();
                        activeSlashFilterRef.current = null;
                        setActiveSlashFilter(null);
                        setValue('');
                        if (inputRef.current) {
                          inputRef.current.innerHTML = '';
                          inputRef.current.innerText = '';
                        }
                        return;
                      }
                      if (selectedImages.length > 0) {
                        e.preventDefault();
                        setSelectedImages(prev => prev.slice(0, -1));
                        return;
                      }
                      if (mentionedTabs.length > 0) {
                        e.preventDefault();
                        e.stopPropagation();

                        const editable = inputRef.current;
                        if (editable) {
                          const pills = editable.querySelectorAll('span[data-tab-id]');
                          if (pills.length > 0) {
                            const lastPillDom = pills[pills.length - 1];
                            const nextSib = lastPillDom.nextSibling;
                            if (nextSib && nextSib.nodeType === Node.TEXT_NODE && nextSib.nodeValue === '\u00A0') {
                              nextSib.remove();
                            }
                            lastPillDom.remove();
                          }
                        }

                        const remainingTabs = mentionedTabs.slice(0, -1);
                        setMentionedTabs(remainingTabs);

                        // If deleting the last pill leaves everything empty, immediately unlock the command
                        if (
                          remainingTabs.length === 0 &&
                          selectedImages.length === 0 &&
                          !value.trim() &&
                          lockedCommand
                        ) {
                          setLockedCommand(null);
                          setValue('');
                          setCommandPrompt('');
                          setFooterStatus(null);
                          onNavigateBack?.();
                        }

                        return;
                      }
                      if (selectedAtCommand) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedAtCommand(null);
                        return;
                      }
                      if (lockedCommand) {
                        e.preventDefault();
                        e.stopPropagation();
                        setLockedCommand(null);
                        setValue('');
                        setCommandPrompt('');
                        if (inputRef.current) {
                          inputRef.current.innerHTML = '';
                          inputRef.current.innerText = '';
                        }
                        setFooterStatus(null);
                        onNavigateBack?.();
                        return;
                      }
                      if (isAllItemsView) {
                        e.preventDefault();
                        onClearAllItemsView?.();
                        return;
                      }
                      // [NEW] Reset Alt+S initial state on Backspace when bar is empty
                      if (isInitialAltSFocus && onInitialAltSFocusChange) {
                        e.preventDefault();
                        onInitialAltSFocusChange(false);
                        return;
                      }
                      // Do not trigger navigation back on backspace in List View
                    }
                  }

                  if (showSavedAgentsMenu && savedAgentSuggestions.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      e.stopPropagation();
                      setSavedAgentHighlightIndex(prev => (prev < savedAgentSuggestions.length - 1 ? prev + 1 : 0));
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      e.stopPropagation();
                      setSavedAgentHighlightIndex(prev => (prev > 0 ? prev - 1 : savedAgentSuggestions.length - 1));
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      const targetAgent = savedAgentSuggestions[savedAgentHighlightIndex];
                      if (targetAgent) {
                        handleSavedAgentSelection(targetAgent);
                      }
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSavedAgentsMenu(false);
                      setSavedAgentSuggestions([]);
                      return;
                    }
                  }

                  if (showAtCommandMenu) {
                    const filteredCmds = filteredAtCommands;
                    const hasCommands = filteredCmds.length > 0;
                    const maxIndex = Math.max(0, filteredCmds.length - 1);
                    if (hasCommands && e.key === 'ArrowUp') {
                      e.preventDefault();
                      e.stopPropagation();
                      setAtCommandHighlightIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
                      return;
                    }
                    if (hasCommands && e.key === 'ArrowDown') {
                      e.preventDefault();
                      e.stopPropagation();
                      setAtCommandHighlightIndex(prev => (prev < maxIndex ? prev + 1 : 0));
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      e.stopPropagation();
                      const selectedCmd = filteredCmds[atCommandHighlightIndex];
                      if (selectedCmd) handleAtCommandSelect(selectedCmd.id);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowAtCommandMenu(false);
                      return;
                    }
                  }

                  if (isContextualPopupOpen && contextualPopupIndex >= 0) {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextualPopupIndex(prev => (prev > 0 ? prev - 1 : contextualMatches.length - 1));
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextualPopupIndex(prev => (prev < contextualMatches.length - 1 ? prev + 1 : 0));
                      return;
                    }
                    if (e.key === 'Enter') {
                      // Handled by the main Enter block
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextualPopupIndex(-1);
                      return;
                    }
                  }

                  const altDigitMatch =
                    isContextualPopupOpen && contextualMatches.length > 0 && e.altKey && !e.ctrlKey && !e.metaKey
                      ? e.code.match(/^(Digit|Numpad)([1-9])$/) || (e.key.match(/^[1-9]$/) ? ['_', '_', e.key] : null)
                      : null;
                  if (altDigitMatch) {
                    const matchIndex = Number(altDigitMatch[2]) - 1;
                    if (matchIndex >= 0 && matchIndex < contextualMatches.length) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleContextualSelect(contextualMatches[matchIndex]);
                    }
                    return;
                  }

                  if (e.key === 'Tab' && !showPromptMenu && !lockedCommand && !showAtCommandMenu) {
                    if (contextualMatches.length > 0) {
                      e.preventDefault();
                      e.stopPropagation();

                      if (e.shiftKey) {
                        // Shift+Tab moved back to main list
                        setContextualPopupIndex(-1);
                        return;
                      }

                      if (contextualPopupIndex === -1) {
                        setContextualPopupIndex(0);
                      } else {
                        setContextualPopupIndex(prev => (prev + 1) % contextualMatches.length);
                      }
                      return;
                    }

                    if (!e.shiftKey) {
                      e.preventDefault();
                      loadPromptSuggestions();
                      setPromptHighlightIndex(0);
                      setShowPromptMenu(true);
                      return;
                    }
                  }

                  if (showPromptMenu) {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      e.stopPropagation();
                      setPromptHighlightIndex(prev => (prev > 0 ? prev - 1 : promptSuggestions.length - 1));
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      e.stopPropagation();
                      setPromptHighlightIndex(prev => (prev < promptSuggestions.length - 1 ? prev + 1 : 0));
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (promptSuggestions[promptHighlightIndex]) {
                        handlePromptMenuSelect(promptSuggestions[promptHighlightIndex]);
                      }
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPromptMenu(false);
                      setPromptSuggestions([]);
                      return;
                    }
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      e.stopPropagation();
                      setPromptHighlightIndex(prev => (prev < promptSuggestions.length - 1 ? prev + 1 : 0));
                      return;
                    }
                  }

                  if (!lockedCommand && commandSupportsInlineQuery(selectedCommand) && e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    activateSelectedCommand();
                    return;
                  }

                  const isDefaultViewNavigation =
                    !pendingQueryUrls && !isSuggestionVisible && !lockedCommand && value.trim().length === 0;
                  if (isDefaultViewNavigation) {
                    if (e.key === 'ArrowDown') {
                      onRequestFocusChange?.('down');
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      onRequestFocusChange?.('up');
                      return;
                    }
                  }

                  if (e.key === 'ArrowDown') {
                    if (allSuggestions.length === 0) return;
                    e.preventDefault();
                    setHighlightIndex(prev => (prev >= allSuggestions.length - 1 ? 0 : prev + 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    if (allSuggestions.length === 0) return;
                    e.preventDefault();
                    setHighlightIndex(prev => (prev <= 0 ? allSuggestions.length - 1 : prev - 1));
                    return;
                  }

                  if (e.key === 'ArrowRight') {
                    const editable = e.currentTarget;
                    const selection = window.getSelection();
                    const cursorAtEnd =
                      selection && selection.rangeCount > 0
                        ? selection.getRangeAt(0).endOffset >= (editable.innerText || '').length
                        : false;

                    if (cursorAtEnd && inlineAutocomplete && highlightIndex === 0 && allSuggestions.length > 0) {
                      const firstItem = allSuggestions[0];
                      if (firstItem._kind === 'history' || firstItem._kind === 'bookmark') {
                        e.preventDefault();
                        const url = (firstItem as any).url || '';
                        if (url) {
                          const displayUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
                          setValue(displayUrl);
                          setInlineAutocomplete(null);

                          setTimeout(() => {
                            editable.focus();
                            const newRange = document.createRange();
                            newRange.selectNodeContents(editable);
                            newRange.collapse(false); // collapse to end
                            selection?.removeAllRanges();
                            selection?.addRange(newRange);
                          }, 0);
                        }
                        return;
                      }
                    }
                  }

                  if (e.key === 'Enter') {
                    if (contextualPopupIndex >= 0 && contextualPopupIndex < contextualMatches.length) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleContextualSelect(contextualMatches[contextualPopupIndex]);
                      return;
                    }

                    if (pendingQueryUrls && pendingQueryUrls.length > 0) {
                      e.preventDefault();
                      submitInlineQuery();
                      return;
                    }
                    if (inlineComposerActive && lockedCommand !== 'ai') return;
                    e.preventDefault();
                    handleSubmit(e.altKey);
                    return;
                  }

                  if (e.key === 'Escape') {
                    if (selectedAtCommand) {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedAtCommand(null);
                      setSelectedCommand(null);
                      selectionSourceRef.current = null;
                      return;
                    }
                    if (!lockedCommand && selectedCommand) {
                      e.preventDefault();
                      e.stopPropagation();
                      selectionSourceRef.current = null;
                      setSelectedCommand(null);
                      return;
                    }
                    if (lockedCommand) {
                      e.preventDefault();
                      e.stopPropagation();
                      setLockedCommand(null);
                      setFooterStatus(null);
                      return;
                    }
                    if (isCommandListView) {
                      e.preventDefault();
                      e.stopPropagation();
                      onClearCommandListView?.();
                      onToggleCommandListView?.(false);
                      return;
                    }
                    if (value === '') {
                      // Reset Alt+S initial state on Escape when bar is empty
                      if (isInitialAltSFocus && onInitialAltSFocusChange) {
                        e.preventDefault();
                        e.stopPropagation();
                        onInitialAltSFocusChange(false);
                        inputRef.current?.blur();
                        return;
                      }
                      // Hierarchical ESC: Blur search if search is already empty
                      e.preventDefault();
                      e.stopPropagation();
                      inputRef.current?.blur();
                      return;
                    }
                    onNavigateBack?.();
                  }
                }}
                data-placeholder={inputPlaceholder}
                autoFocus={isSearchFocusEnabled}
                data-is-command-locked={!!lockedCommand}
                data-at-menu-open={showAtCommandMenu}
                data-prompt-menu-open={showPromptMenu}
                data-suggestion-visible={isSuggestionVisible}
                id="searchbar-input"
                data-searchbar-input="true"
                className={`${activeCollection ? 'opacity-0 w-[1px] h-[1px] overflow-hidden absolute -z-10' : ''} w-full ${inputRightPadding} py-3 rounded-t-xl bg-[var(--color-inputBg)] border ${activeTutorial === 'search' || activeTutorial === 'agent' ? 'border-[#22c55e]' : 'border-[#aeaeae] dark:border-white/10'} text-neutral-200 caret-auto focus:ring-0 focus:outline-none shadow-none backdrop-blur-xl resize-none overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-400/50 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600/50 [&::-webkit-scrollbar-track]:bg-transparent text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px] empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--color-textPlaceholder)] empty:before:absolute empty:before:pointer-events-none`}
                style={{
                  paddingLeft: inputLeftPaddingPx,
                  ['--placeholder-padding-left' as any]: `${inputLeftPaddingPx}px`,
                  maxHeight: '120px',
                  caretColor: isDarkMode ? '#fff' : '#000',
                }}></div>
            </div>
          </div>
          {/* Chrome omnibox-style inline autocomplete overlay */}
          {inlineAutocomplete &&
            highlightIndex === 0 &&
            !inlineComposerActive &&
            !lockedCommand &&
            !showAtCommandMenu &&
            value.trim().length > 0 &&
            (inlineAutocomplete.toLowerCase().startsWith(value.toLowerCase()) ||
              inlineAutocomplete.split('|URL|')[0].toLowerCase().startsWith(value.toLowerCase())) && (
              <div
                className="pointer-events-none absolute top-0 left-0 right-0 flex items-center py-3 rounded-t-xl overflow-hidden text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px]"
                style={{ paddingLeft: inputLeftPaddingPx }}>
                {/* Invisible typed portion (placeholder for alignment) */}
                <span className="text-transparent whitespace-pre">{value}</span>

                {(() => {
                  const [titlePart, urlPart] = inlineAutocomplete.includes('|URL|')
                    ? inlineAutocomplete.split('|URL|')
                    : [inlineAutocomplete, ''];

                  const isTitleMatch = titlePart.toLowerCase().startsWith(value.toLowerCase());
                  const completionPart = isTitleMatch ? titlePart.slice(value.length) : '';

                  return (
                    <>
                      {/* 7 Spaces Gap Experiment */}
                      <span className="text-transparent whitespace-pre">{' '.repeat(2)}</span>

                      {/* Highlighted completion portion with selection style */}
                      {completionPart && (
                        <span
                          className="bg-blue-600/30 dark:bg-blue-400/45 text-neutral-900 dark:text-neutral-200 whitespace-pre"
                          style={{
                            borderRadius: '2px',
                            paddingTop: '1.5px',
                            paddingBottom: '1.5px',
                          }}>
                          {completionPart}
                        </span>
                      )}

                      {/* URL part - No highlight, blue link style */}
                      {urlPart && (
                        <span className="text-blue-600 dark:text-blue-400 whitespace-pre ml-2 font-normal opacity-90">
                          {' - '}
                          {urlPart}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          <ContextualCommandPopup
            matches={contextualMatches}
            highlightIndex={contextualPopupIndex}
            isOpen={isContextualPopupOpen && !activeCollection && !disableContextualPopup}
            onHighlightChange={setContextualPopupIndex}
            onSelect={match => {
              handleContextualSelect(match);
            }}
            onRequestEditLink={onRequestEditLink}
            onRequestEditAutomation={onAutomationEdit}
          />
          {/* {inlineComposerPreview ? (
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              {renderInlineCommandIcon()}
              <span className="text-sm text-neutral-600 font-medium truncate" title={inlineComposerInfo?.label}>
                {inlineComposerInfo?.label}
              </span>
              <span className="text-xs text-neutral-400 whitespace-nowrap ml-1">{COMMAND_PREVIEW_HINT}</span>
            </div>
          ) : null} */}
          {!isAutomationInputActive &&
            !inlineComposerVisible &&
            showLocalPreviewHint &&
            contextualMatches.length === 0 ? (
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              <span className="text-xs text-neutral-400 whitespace-nowrap">
                {`Press Enter to ${selectedLocalLabel ?? ''}`}
              </span>
            </div>
          ) : null}
          {/* Right-side Actions (Attachment + Keyboard Shortcut) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-auto z-20">
            {(lockedCommand === 'store' || lockedCommand === 'saved-automation') && (
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleStoreTab?.();
                }}
                className="flex items-center gap-2 px-2.5 py-1 animate-in fade-in slide-in-from-right-2 duration-300 cursor-pointer transition-all hover:bg-white/5 rounded-lg active:scale-95 group">
                <span className="text-[10px] font-black text-white/60 tracking-widest bg-white/20 px-1.5 py-0.5 rounded border border-white/10 shadow-sm group-hover:bg-white/30 transition-colors uppercase">
                  Tab
                </span>
                <span className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors">
                  {activeStoreTab === 'catalog' ? 'Saved Automations' : 'Automation Store'}
                </span>
              </button>
            )}
            {/* Alt + S Indication - Hidden when search has text (except when value is exactly '/' to show slash popup dot) */}
            {(!value || (isBoardViewEnabled && value === '/')) && !activeCollection && !lockedCommand && !isCommandListView && !isAllItemsView && (
              <div className="flex items-center gap-2 pl-2 pr-0 py-1 animate-in fade-in slide-in-from-right-2 duration-300 transition-all rounded-lg select-none">
                {(() => {
                  
                  return null;
                })()}
                {!isInitialAltSFocus ? (
                  <div className="flex items-center justify-center px-1.5 py-0.5 rounded border border-neutral-500 dark:border-neutral-400 bg-transparent opacity-30 pointer-events-none">
                    <span className="text-[9px] font-black text-neutral-600 dark:text-neutral-300 tracking-widest uppercase">
                      ALT + S
                    </span>
                  </div>
                ) : (
                  isBoardViewEnabled && (
                    <div 
                      className="relative shrink-0"
                      onMouseEnter={() => onHoverSlashDot?.()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newVal = !autoTriggerDropdown;
                          setAutoTriggerDropdown(newVal);
                        }}
                        className="relative w-7 h-7 flex items-center justify-center rounded-md bg-[#073642]/5 dark:bg-white/5 border border-neutral-300 dark:border-white/10 hover:bg-[#073642]/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        <span>/</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
            {/* Images Preview (Thumbnails) */}
            <div
              className={`items-center pointer-events-auto z-20 ${selectedImages.length > 2 ? 'grid grid-rows-2 grid-flow-col gap-0.5' : 'flex gap-1'
                }`}>
              {selectedImages.map((img, idx) => {
                const isSingle = selectedImages.length === 1;
                // Single: w-8 h-8 (32px), Grid: w-5 h-5 (20px)
                const sizeClasses = isSingle ? 'w-8 h-8' : 'w-5 h-5';
                const iconSize = isSingle ? 16 : 10;
                const textSize = isSingle ? 'text-[6px]' : 'text-[4px]';

                return (
                  <div
                    key={idx}
                    className="relative group"
                    onMouseEnter={() => setHoveredFileIndex(idx)}
                    onMouseLeave={() => setHoveredFileIndex(null)}>
                    <div
                      className={`${sizeClasses} rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden`}>
                      {img.mimeType.startsWith('image/') ? (
                        <img src={img.url} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 w-full h-full">
                          {(() => {
                            const ext = img.filename.split('.').pop()?.toLowerCase() || '';
                            if (ext === 'pdf' || img.mimeType === 'application/pdf')
                              return <FaFilePdf size={iconSize} className="text-red-500 mb-0.5" />;
                            if (['xls', 'xlsx', 'csv'].includes(ext))
                              return <FaFileExcel size={iconSize} className="text-green-600 mb-0.5" />;
                            if (['doc', 'docx'].includes(ext))
                              return <FaFileWord size={iconSize} className="text-blue-600 mb-0.5" />;
                            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
                              return <FaFileArchive size={iconSize} className="text-orange-500 mb-0.5" />;
                            if (
                              [
                                'js',
                                'ts',
                                'tsx',
                                'py',
                                'java',
                                'c',
                                'cpp',
                                'html',
                                'css',
                                'json',
                                'sh',
                                'sql',
                              ].includes(ext)
                            )
                              return (
                                <FaFileCode size={iconSize} className="text-yellow-500 dark:text-yellow-400 mb-0.5" />
                              );
                            if (['mp3', 'wav', 'ogg'].includes(ext))
                              return <FaFileAudio size={iconSize} className="text-purple-500 mb-0.5" />;
                            if (['mp4', 'mov', 'avi', 'mkv'].includes(ext))
                              return <FaFileVideo size={iconSize} className="text-pink-500 mb-0.5" />;
                            return <FaFileAlt size={iconSize} className="text-[var(--color-iconDefault)] mb-0.5" />;
                          })()}
                          {!isSingle ? null : (
                            <span
                              className={`${textSize} text-neutral-500 font-bold truncate w-full px-0.5 text-center leading-none`}>
                              {img.filename.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        removeSelectedImage(idx);
                      }}
                      className="absolute -top-1.5 -left-1 bg-white dark:bg-neutral-700 rounded-full p-0.5 shadow-sm border border-neutral-200 dark:border-neutral-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove attachment">
                      <FaTimes size={8} className="text-[var(--color-iconDefault)] hover:text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {hoveredFileIndex !== null && selectedImages[hoveredFileIndex] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="fixed pointer-events-none"
                  style={{
                    zIndex: 999999,
                    right: '24px',
                    top: '120px',
                  }}>
                  <div className="bg-white/90 dark:bg-neutral-900/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 p-5 backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5">
                    {selectedImages[hoveredFileIndex].mimeType.startsWith('image/') ? (
                      <div className="flex flex-col gap-3">
                        <div className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shadow-inner">
                          <img
                            src={selectedImages[hoveredFileIndex].url}
                            alt={selectedImages[hoveredFileIndex].filename}
                            className="max-w-[450px] max-h-[450px] object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[300px]">
                              {selectedImages[hoveredFileIndex].filename}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {selectedImages[hoveredFileIndex].mimeType} â€¢{' '}
                              {(() => {
                                const sizeInBytes = selectedImages[hoveredFileIndex].file.size;
                                if (sizeInBytes < 1024) return `${sizeInBytes} B`;
                                if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
                                return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
                              })()}
                            </span>
                          </div>
                          <div className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase">
                            Image
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 min-w-[320px] max-w-[400px]">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-sm">
                            {(() => {
                              const ext =
                                selectedImages[hoveredFileIndex].filename.split('.').pop()?.toLowerCase() || '';
                              const iconSize = 32;
                              if (ext === 'pdf' || selectedImages[hoveredFileIndex].mimeType === 'application/pdf')
                                return <FaFilePdf size={iconSize} className="text-red-500" />;
                              if (['xls', 'xlsx', 'csv'].includes(ext))
                                return <FaFileExcel size={iconSize} className="text-green-600" />;
                              if (['doc', 'docx'].includes(ext))
                                return <FaFileWord size={iconSize} className="text-blue-600" />;
                              if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
                                return <FaFileArchive size={iconSize} className="text-orange-500" />;
                              if (
                                [
                                  'js',
                                  'ts',
                                  'tsx',
                                  'py',
                                  'java',
                                  'c',
                                  'cpp',
                                  'html',
                                  'css',
                                  'json',
                                  'sh',
                                  'sql',
                                ].includes(ext)
                              )
                                return <FaFileCode size={iconSize} className="text-yellow-500 dark:text-yellow-400" />;
                              if (['mp3', 'wav', 'ogg'].includes(ext))
                                return <FaFileAudio size={iconSize} className="text-purple-500" />;
                              if (['mp4', 'mov', 'avi', 'mkv'].includes(ext))
                                return <FaFileVideo size={iconSize} className="text-pink-500" />;
                              return <FaFileAlt size={iconSize} className="text-[var(--color-iconDefault)]" />;
                            })()}
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate text-base">
                              {selectedImages[hoveredFileIndex].filename}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                                {selectedImages[hoveredFileIndex].filename.split('.').pop()?.toUpperCase() || 'FILE'}
                              </span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                {(() => {
                                  const sizeInBytes = selectedImages[hoveredFileIndex].file.size;
                                  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
                                  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
                                  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="h-px bg-neutral-200 dark:bg-neutral-800 w-full" />
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                          <span>Metadata</span>
                          <span className="text-neutral-300 dark:text-neutral-600">
                            Attachment {hoveredFileIndex + 1}/8
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-neutral-50 dark:bg-black/20 rounded-lg p-2 border border-neutral-100 dark:border-neutral-800/50">
                            <div className="text-[9px] text-neutral-400 mb-0.5">MIME TYPE</div>
                            <div className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate font-mono">
                              {selectedImages[hoveredFileIndex].mimeType}
                            </div>
                          </div>
                          <div className="bg-neutral-50 dark:bg-black/20 rounded-lg p-2 border border-neutral-100 dark:border-neutral-800/50">
                            <div className="text-[9px] text-neutral-400 mb-0.5">MODIFIED</div>
                            <div className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate font-mono">
                              {new Date(selectedImages[hoveredFileIndex].file.lastModified).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attachment Button - now including /ai as the bottom input is removed */}
            {(lockedCommand === 'gpt' ||
              lockedCommand === 'ai' ||
              lockedCommand === 'perplexity' ||
              lockedCommand === 'claude' ||
              lockedCommand === 'upload_drive' ||
              lockedCommand === 'gemini' ||
              (activeAiSessionRef.current && mainView.kind === 'aiEditor')) && (
                <div className="ml-1 flex items-center gap-1.5 pr-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-[var(--color-iconDefault)] hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-white/5"
                    title="Attach file">
                    <GoPaperclip size={16} />
                  </button>
                  {lockedCommand === 'ai' && !activeAiSession && (
                    <button
                      type="button"
                      onClick={() => value.trim() && handleSubmit(false)}
                      disabled={!value.trim()}
                      className={`flex items-center justify-center h-[26px] w-[26px] rounded-full transition-all ${value.trim()
                        ? 'bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer shadow-sm'
                        : 'bg-neutral-200 text-neutral-400 dark:bg-white/10 dark:text-neutral-500 cursor-not-allowed'
                        }`}
                      title="Send message">
                      {value.trim() ? (
                        <FaArrowUp size={12} />
                      ) : (
                        <span className="text-sm font-semibold select-none">/</span>
                      )}
                    </button>
                  )}
                </div>
              )}
          </div>
          {inlineComposerActive ? (
            <div
              className="absolute top-0 bottom-0 right-0 flex items-center z-10"
              style={{
                left: `${lockedCommand || activeCollection || inlineComposerActive ? dynamicLeftOffset : dynamicLeftOffset + 24}px`,
              }}>
              <input
                ref={inlineInputRef}
                id="searchbar-inline-input"
                data-searchbar-input="true"
                value={commandPrompt}
                onChange={e => {
                  setCommandPrompt(e.target.value);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                onKeyDown={e => {
                  handleInlineKeyDown(e);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                onFocus={() => {
                  setIsInlineFocused(true);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                onBlur={() => setIsInlineFocused(false)}
                onSelect={updateInlineCursorPosition}
                onClick={updateInlineCursorPosition}
                onKeyUp={updateInlineCursorPosition}
                onPaste={e => {
                  handlePaste(e);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                placeholder={resolvePlaceholderFromCmd(lockedCommand) || 'Type your prompt here...'}
                className="w-full h-full bg-transparent outline-none text-sm text-neutral-900 dark:text-neutral-200 caret-auto placeholder-[var(--color-textPlaceholder)]"
                style={{
                  paddingRight:
                    lockedCommand === 'gpt' ||
                      lockedCommand === 'ai' ||
                      lockedCommand === 'perplexity' ||
                      lockedCommand === 'claude' ||
                      lockedCommand === 'upload_drive' ||
                      lockedCommand === 'gemini' ||
                      (activeAiSessionRef.current && mainView.kind === 'aiEditor')
                      ? selectedImages.length > 0
                        ? selectedImages.length === 1
                          ? '5rem' // 1 item: ~32px + gap + icon -> ~80px (5rem)
                          : `${2.8 + Math.ceil(selectedImages.length / 2) * 1.6}rem` // Grid: Base + Columns * (Width 1.25rem + gap)
                        : '2.5rem' // Standard padding for just icon
                      : '1rem',
                }}
              />
              {/* Custom Terminal Cursor for Prompt */}
            </div>
          ) : null}
          {showPromptMenu && (
            <InlinePromptPopup
              suggestions={promptSuggestions}
              highlightIndex={promptHighlightIndex}
              onSelect={handlePromptMenuSelect}
              onClose={() => {
                setShowPromptMenu(false);
                setPromptSuggestions([]);
              }}
              onCreatePrompt={() => {
                setShowPromptMenu(false);
                setPromptSuggestions([]);
                // Trigger the createprompt command
                
                handleLocalCommandExecute('createprompt');
              }}
              onEdit={handlePromptEdit}
              anchorRef={inputRef as any}
            />
          )}
          {showSavedAgentsMenu && savedAgentSuggestions.length > 0 && (
            <div
              className="absolute z-[9999999] border-x border-b border-neutral-200/60 dark:border-white/10 bg-[var(--color-containerBg)] rounded-b-xl rounded-t-none shadow-2xl overflow-hidden"
              style={{
                top: '100%',
                left: '0px',
                width: '100%',
              }}>
              <div className="p-2 border-b border-[#eee8d5] dark:border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#657b83] dark:text-neutral-400 px-2">
                  Matching All AI Chat Agents
                </span>
                <span className="text-[10px] bg-[#eee8d5]/50 dark:bg-white/5 text-[#657b83]/70 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                  {savedAgentSuggestions.length} found
                </span>
              </div>
              <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1">
                {savedAgentSuggestions.map((agent, index) => {
                  const isHighlighted = index === savedAgentHighlightIndex;
                  return (
                    <div
                      key={agent.id}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all cursor-pointer group ${isHighlighted ? 'bg-[#eee8d5] dark:bg-white/10' : 'hover:bg-[#eee8d5]/70 dark:hover:bg-white/5'
                        }`}
                      onClick={() => handleSavedAgentSelection(agent)}
                      onMouseEnter={() => setSavedAgentHighlightIndex(index)}>
                      <span
                        className={`text-[12px] truncate flex-1 ${isHighlighted
                          ? 'text-[#073642] font-bold dark:text-white'
                          : 'text-[#657b83] group-hover:text-[#073642] dark:text-white/60 dark:group-hover:text-white'
                          }`}>
                        {agent.name}
                      </span>
                      {isHighlighted && (
                        <span className="text-[10px] opacity-60 font-normal text-[#073642] dark:text-white">
                          Press Enter
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {showAtCommandMenu && (
            <AtCommandPopup
              highlightIndex={atCommandHighlightIndex}
              onSelect={handleAtCommandSelect}
              onClose={() => setShowAtCommandMenu(false)}
              anchorRef={inputRef as any}
              searchQuery={atSearchQuery}
              onHighlightIndexChange={setAtCommandHighlightIndex}
              onGoToTemplates={onGoToTemplates}
              prompts={allPrompts}
              isLockedAI={
                ['ai', 'gpt', 'perplexity', 'claude', 'gemini'].includes(lockedCommand || '') || isLockedAIState
              }
              hideTabs={lockedCommand === 'ai' && !!activeAiSession}
            />
          )}
          {showAIHistoryPanel && activeAiSession && (
            <div
              className={`fixed right-0 top-[10vh] h-[90vh] w-[190px] z-[99999] overflow-hidden rounded-l-xl border shadow-2xl ${isDarkMode ? 'border-white/10 bg-black/40 backdrop-blur-md' : 'border-[#eee8d5] bg-[#fdf6e3]'}`}>
              <div className="h-full overflow-hidden">
                <AIHistorySelectionPanel
                  history={[
                    {
                      _kind: 'ai_history' as const,
                      id: 'active_session',
                      prompt: activeAiSession.prompt || 'Active Session',
                      models: activeAiSession.models,
                      urls: activeAiSession.urls.reduce(
                        (acc, url, idx) => ({ ...acc, [activeAiSession.models[idx]]: url }),
                        {},
                      ),
                      timestamp: Date.now(),
                    },
                  ]}
                  onSelect={() => null}
                  onSaveAsAgent={handleSaveAsAgent}
                  onClose={() => setShowAIHistoryPanel(false)}
                  commands={commands}
                />
              </div>
            </div>
          )}
          <CommandNotInstalledDialog
            isOpen={commandNotInstalledDialog.isOpen}
            onClose={() => setCommandNotInstalledDialog({ isOpen: false, commandName: '', commandId: undefined })}
            onGoToTemplates={() => {
              setCommandNotInstalledDialog({ isOpen: false, commandName: '', commandId: undefined });
              onGoToTemplates?.();
            }}
            onAddTemplate={handleAddTemplate}
            commandName={commandNotInstalledDialog.commandName}
            zIndex={100000}
          />
          {/* Login Required Dialog (Triggered when local commands are used by Guest) */}
          <LoginRequiredDialog
            isOpen={loginRequiredDialog.isOpen}
            onClose={() => setLoginRequiredDialog({ isOpen: false, commandName: '' })}
            onLogin={() => (window.location.href = CMDOS_SIGN_UP_URL)}
            commandName={loginRequiredDialog.commandName}
            zIndex={100000}
          />
        </div>
      </div>
    );
  },
);

Searchbar.displayName = 'Searchbar';

export default Searchbar;
