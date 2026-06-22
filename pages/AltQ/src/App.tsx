import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppData } from './hooks/useAppData';
import AutomationDynamicIcon from '../../new-tab/src/components/Shared/Icons/AutomationDynamicIcon';
import { FiZap, FiPlus, FiSearch, FiX, FiFilter, FiLayers, FiSettings } from 'react-icons/fi';
import {
  FaCode, FaLink, FaCheckCircle, FaRegCircle, FaCheck, FaRegCalendarAlt, FaPaperclip, FaRegFileAlt, FaTerminal, FaBookmark, FaChevronDown, FaChevronUp,
  FaHistory, FaDownload, FaCog, FaPuzzlePiece, FaFlag, FaTag, FaInfoCircle, FaMemory, FaMicrochip, FaGamepad, FaKey, FaQuestionCircle, FaRobot,
  FaLayerGroup, FaGithub, FaCamera, FaExpand, FaCrosshairs, FaImages, FaTable
} from 'react-icons/fa';
import NotesIcon from './components/NotesIcon';
import { getFaviconUrl } from '../../new-tab/src/components/SearchComponents/Searchbar/utils';
import { extractUrlsFromSnippet } from '../../new-tab/src/components/SearchComponents/SearchPopup/snippetInteractiveUtils';
import { runAutomation } from '../../utils/automation';
import { updateTodoStatus, createSnippet, updateSnippetRealtime } from '../../Apis/features/snippetApi';
import { getUserId } from '../../Apis/core/api';
import { CMDOS_SIGN_UP_URL } from '../../Apis/core/apiConfig';
import { useCommands } from '../../new-tab/src/components/SearchComponents/Searchbar/useCommands';
import { LOCAL_COMMANDS } from '../../new-tab/src/components/SearchComponents/Searchbar/localCommands';
import { buildUrl } from '../../new-tab/src/components/SearchComponents/Searchbar/commands';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import cmdOSLogo from '../../new-tab/src/assets/tasklabs_logo.png';
import { TerminalIcon } from '../../new-tab/src/components/Shared/utils/terminalIcon';
import { UnifiedContextMenu, MenuAction } from '../../new-tab/src/components/Shared/UnifiedContextMenu';
import { FiPlay, FiStar, FiCommand, FiCheckSquare } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData } from '../../Redux/AllData/allDataSlice';
import { selectSelectedTeam } from '../../Redux/AllData/uiStateSlice';
import { AddToExistingModal } from '../../new-tab/src/components/Editor/AddToExistingModal';
import { BsKeyboard } from 'react-icons/bs';
import { LuSparkles } from 'react-icons/lu';
import { resolveWebPageContext } from './utils/context';
import { PAGE_ACTION_ITEMS, executePageActionCommand, type AltQPageActionItem } from './commands/pageActions';


// Map command IDs to specific React Icons
const BROWSER_ICONS: Record<string, React.ReactNode> = {
  history: <FaHistory size={22} className="text-[#586e75] dark:text-neutral-400" />,
  downloads: <FaDownload size={22} className="text-[#586e75] dark:text-neutral-400" />,
  settings: <FaCog size={22} className="text-[#586e75] dark:text-neutral-400" />,
  extensions: <FaPuzzlePiece size={22} className="text-[#586e75] dark:text-neutral-400" />,
  bookmarks: <FaBookmark size={22} className="text-[#586e75] dark:text-neutral-400" />,
  flags: <FaFlag size={22} className="text-[#586e75] dark:text-neutral-400" />,
  inspect: <FaCode size={22} className="text-[#586e75] dark:text-neutral-400" />,
  version: <FaTag size={22} className="text-[#586e75] dark:text-neutral-400" />,
  about: <FaInfoCircle size={22} className="text-[#586e75] dark:text-neutral-400" />,
  tasks: <FaMemory size={22} className="text-[#586e75] dark:text-neutral-400" />,
  gpu: <FaMicrochip size={22} className="text-[#586e75] dark:text-neutral-400" />,
  dino: <FaGamepad size={22} className="text-[#586e75] dark:text-neutral-400" />,
  passwords: <FaKey size={22} className="text-[#586e75] dark:text-neutral-400" />,
  help: <FaQuestionCircle size={22} className="text-[#586e75] dark:text-neutral-400" />,
  ai: <FaRobot size={22} className="text-[#586e75] dark:text-neutral-400 object-contain" />,
};

// Icons for page-action commands (screenshot / download)
const PAGE_ACTION_ICONS: Record<string, React.ReactNode> = {
  capture_screenshot:           <FaCamera     size={14} className="text-sky-400" />,
  capture_full_screenshot:      <FaExpand     size={14} className="text-sky-400" />,
  capture_element_screenshot:   <FaCrosshairs size={14} className="text-violet-400" />,
  downloadallimages:            <FaImages     size={14} className="text-emerald-400" />,
  downloadalltables:            <FaTable      size={14} className="text-amber-400" />,
};

// Alias map: alias (uppercase) → section name
const SECTION_ALIASES: Record<string, string> = {
  'A': 'all',
  'S': 'thissite',
  'T': 'todos',
  'C': 'commands',
  'L': 'links',
  'N': 'notes',
  'AU': 'automations',
  'B': 'bookmarks',
  'SN': 'snippets',
  'P': 'prompts',
};
// Reverse map: section name → alias display string
const SECTION_ALIAS_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_ALIASES).map(([alias, section]) => [section, alias])
);

const mapFullNameToShortcut = (text: string): string => {
  const mapping: Record<string, string> = {
    '/all': '/a',
    '/todos': '/t',
    '/notes': '/n',
    '/automations': '/au',
    '/snippets': '/sn',
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

// All valid filter shortcuts derived from SECTION_ALIASES (prefixed with /)
const FILTER_SHORTCUTS: string[] = Object.keys(SECTION_ALIASES).map(a => '/' + a.toLowerCase());

const FILTER_LABELS: Record<string, string> = {
  '/a': '/All',
  '/s': '/This Site',
  '/t': '/Todos',
  '/c': '/Commands',
  '/l': '/Links',
  '/n': '/Notes',
  '/au': '/Automations',
  '/b': '/Bookmarks',
  '/sn': '/Snippets',
  '/p': '/Prompts',
};

/** Returns tag label if current searchValue has an active tag, otherwise null */
function getActiveTagInfo(searchValue: string): { prefix: string; label: string; query: string } | null {
  const match = searchValue.match(/^\/[a-zA-Z]+/);
  if (!match) return null;
  const prefix = match[0];
  const rest = searchValue.slice(prefix.length);
  const lowerPrefix = prefix.toLowerCase();
  if (FILTER_SHORTCUTS.includes(lowerPrefix) && rest.startsWith(' ')) {
    return { prefix, label: FILTER_LABELS[lowerPrefix] || prefix, query: rest.slice(1) };
  }
  return null;
}

const normalizeUrl = (urlStr: unknown): string => {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let target = urlStr.trim();
  if (!/^[a-zA-Z]+:\/\//.test(target)) {
    target = 'https://' + target;
  }
  try {
    const url = new URL(target);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`;
  } catch {
    return urlStr;
  }
};

const getDomain = (urlStr: string) => {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Parse the current search value to determine the / mode state:
 *   - atDropdown: true when we show the category picker (no space yet)
 *   - activeSection: category activated by /ALIAS+Space, or null
 *   - searchQuery: text typed after the space for within-category search
 */
function parseAtMode(searchValue: string): {
  atDropdown: boolean;
  activeSection: string | null;
  searchQuery: string;
} {
  if (!searchValue.startsWith('/')) {
    return { atDropdown: false, activeSection: null, searchQuery: searchValue };
  }

  const textAfterAt = searchValue.slice(1);

  // Find longest matching alias prefix
  let bestAlias = '';
  let activeSection: string | null = null;

  for (const [alias, section] of Object.entries(SECTION_ALIASES)) {
    const upperText = textAfterAt.toUpperCase();
    const upperAlias = alias.toUpperCase();

    // Active if matches exactly followed by a space
    const matchWithSpace = upperText.startsWith(upperAlias + ' ');

    // Active if matches exactly with no space, but there is no longer alias starting with it
    const isPrefixOfLonger = Object.keys(SECTION_ALIASES).some(
      (other) => other.toUpperCase().startsWith(upperAlias) && other.length > alias.length
    );
    const matchExactNoAmbiguity = upperText === upperAlias && !isPrefixOfLonger;

    if (matchWithSpace || matchExactNoAmbiguity) {
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        activeSection = section;
      }
    }
  }

  if (activeSection) {
    let query = textAfterAt.slice(bestAlias.length);
    if (query.startsWith(' ')) {
      query = query.slice(1);
    }
    return { atDropdown: false, activeSection, searchQuery: query };
  }

  return { atDropdown: true, activeSection: null, searchQuery: '' };
}

const SECTION_META: Record<string, { title: string, icon: React.ReactNode }> = {
  thissite: { title: 'This Site', icon: <FaRegFileAlt className="w-4 h-4 shrink-0" /> },
  todos: { title: 'Todos', icon: <FaCheckCircle className="w-4 h-4 shrink-0" /> },
  prompts: { title: 'Prompts', icon: <FaFlag className="w-4 h-4 shrink-0" /> },
  automations: { title: 'Automations', icon: <FiZap className="w-4 h-4 shrink-0" /> },
  notes: { title: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0" /> },
  links: { title: 'Links', icon: <FaLink className="w-4 h-4 shrink-0" /> },
  snippets: { title: 'Snippets', icon: <FaCode className="w-4 h-4 shrink-0" /> },
  bookmarks: { title: 'Bookmarks', icon: <FaBookmark className="w-4 h-4 shrink-0" /> },
  commands: { title: 'Commands', icon: <FaTerminal className="w-4 h-4 shrink-0" /> },
};

const formatTodoDate = (deadlineStr?: string, isDone?: boolean) => {
  if (!deadlineStr) return { text: 'No due date', badge: 'Anytime', isToday: false };
  try {
    const date = new Date(deadlineStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return { text: deadlineStr, badge: 'Due', isToday: false };

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();

    if (isDone) {
      return { text: `Completed · ${timeStr}`, badge: 'Done', isToday: false };
    }

    if (isToday) {
      return { text: `Due ${timeStr}`, badge: 'Today', isToday: true };
    } else if (isTomorrow) {
      return { text: `Due ${timeStr}`, badge: 'Tomorrow', isToday: false };
    } else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[date.getDay()];
      return { text: `Due ${timeStr}`, badge: dayName, isToday: false };
    }
  } catch {
    return { text: 'No due date', badge: 'Anytime', isToday: false };
  }
};

const extractTodoMetadata = (item: any) => {
  let linkCount = 0;
  let autoCount = 0;
  let noteCount = 0;

  const urls = extractUrlsFromSnippet(item);
  if (urls && urls.length > 0) {
    linkCount = urls.length;
  }

  if (item.automation_id || item.automation || (item.automation_steps && item.automation_steps.length > 0) || (item.steps && item.steps.length > 0)) {
    autoCount = item.automation_steps?.length || item.steps?.length || 1;
  }

  if (item.category?.toLowerCase() === 'note' || (typeof item.value === 'string' && item.value.length > 50 && !urls.length)) {
    noteCount = 1;
  }

  return { linkCount, autoCount, noteCount };
};

interface AppProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

const DashboardRow: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: any[];
  onItemClick: (item: any, e?: React.MouseEvent | KeyboardEvent) => void;
  onNewClick?: () => void;
  renderIcon: (item: any, size: number) => React.ReactNode;
  loading?: boolean;
  selectedIndex: number;
  startIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onToggleTodo?: (e: React.MouseEvent, item: any) => void;
  viewMode?: 'list' | 'board';
  onContextMenu?: (e: React.MouseEvent, item: any, title: string) => void;
  onStartSession?: (item: any, e: React.MouseEvent) => void;
}> = ({ title, icon, items, onItemClick, onNewClick, renderIcon, loading, selectedIndex, startIndex, containerRef, onToggleTodo, viewMode = 'list', onContextMenu, onStartSession }) => {

  useEffect(() => {
    const totalRowItems = items.length + 1;
    let scrollTimer: any;

    if (selectedIndex >= startIndex && selectedIndex < startIndex + totalRowItems) {
      scrollTimer = setTimeout(() => {
        const el = containerRef.current?.querySelector(`#altq-item-${selectedIndex}`);
        if (el) {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }, 50);
    }

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [selectedIndex, startIndex, items.length, containerRef]);

  const itemCount = items.length;

  return (
    <div
      id={`altq-section-${title.toLowerCase()}`}
      className={clsx(
        "flex box-border",
        viewMode === 'list' ? "w-full items-center py-1 px-2 gap-4 mb-3" : "shrink-0 flex-col items-start w-[210px] min-w-[210px] max-w-[210px] bg-transparent border-r border-[#2A2B33] pr-4 pb-8 last:border-r-0"
      )}>
      <div className={clsx(
        "shrink-0 flex items-center box-border",
        viewMode === 'list' ? "w-36 pr-4" : "w-full pb-1 mb-1 justify-between min-h-[32px]"
      )}>
        <div className="flex items-center min-w-0 flex-1">
          <div className="text-white/80 shrink-0 mr-3 flex items-center justify-center">
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 16 }) : icon}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-[14px] font-medium text-white tracking-tight leading-tight capitalize truncate flex items-center gap-1.5">
              {title}
              {viewMode === 'board' && (
                <span>· {items.length}</span>
              )}
            </h2>
          </div>
        </div>
        {viewMode === 'board' && onNewClick && (
          <div
            onClick={onNewClick}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded cursor-pointer text-neutral-400 hover:text-white hover:bg-white/10 transition-colors ml-2"
            title="Create New"
          >
            <FiPlus size={16} />
          </div>
        )}
      </div>

      {/* Cards Scrollable Area */}
      <div className={clsx(
        "flex-1 min-w-0 flex py-1 scroll-smooth box-border",
        viewMode === 'list' ? "items-center overflow-x-auto gap-3 hover-scrollbar" : "h-0 flex-col items-center overflow-y-auto overflow-x-hidden w-full gap-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      )}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shrink-0 w-16 flex flex-col items-center gap-1.5 box-border">
              <div className="w-[52px] h-[52px] rounded-xl bg-neutral-900 animate-pulse" />
              <div className="w-12 h-3 rounded bg-neutral-900 animate-pulse" />
            </div>
          ))
        ) : (
          <>
            {items.map((item, idx) => {
              const absoluteIndex = startIndex + idx;
              const isSelected = selectedIndex === absoluteIndex;
              const rawTitle = item.name || item.key || item.title || 'Untitled';
              const isTodoSection = title.toLowerCase() === 'todos';
              const tileWidth = viewMode === 'board' ? 'w-full' : (isTodoSection ? 'w-[160px]' : 'w-[52px]');
              const containerWidth = viewMode === 'board' ? 'w-full h-auto min-h-[32px] py-0.5 flex items-center' : (isTodoSection ? 'w-[160px]' : 'w-16');

              let dateText, dateBadge, linkCount, autoCount, noteCount, isCompleted;
              if (isTodoSection) {
                const dateData = formatTodoDate(item.event_deadline, item.is_done);
                dateText = dateData.text;
                dateBadge = dateData.badge;
                const meta = extractTodoMetadata(item);
                linkCount = meta.linkCount;
                autoCount = meta.autoCount;
                noteCount = meta.noteCount;
                isCompleted = !!item.is_done;
              }

              return (
                <div
                  key={`${title}-${item.id || item.snippet_id || 'item'}-${idx}`}
                  id={`altq-item-${absoluteIndex}`}
                  onClick={(e) => onItemClick(item, e)}
                  onContextMenu={(e) => {
                    if (onContextMenu) {
                      onContextMenu(e, item, title);
                    }
                  }}
                  className={clsx("shrink-0 flex flex-col group cursor-pointer box-border relative",
                    viewMode === 'list' ? "items-center" : "",
                    containerWidth)}
                >
                  <motion.div
                    whileHover={{ scale: 1.01, y: viewMode === 'list' ? -2 : 0 }}
                    whileTap={{ scale: 0.98 }}
                    className={clsx(
                      'rounded-xl transition-colors overflow-hidden box-border relative',
                      viewMode === 'board' ? 'h-full py-1 px-2 border border-transparent w-full flex items-center' : 'h-[52px] shadow-md border-2',
                      (isTodoSection || viewMode === 'board') ? 'flex flex-col justify-center text-left' : 'flex items-center justify-center',
                      viewMode !== 'board' && tileWidth,
                      isSelected
                        ? (viewMode === 'board' ? 'bg-white/5' : 'bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.12)]')
                        : (viewMode === 'board' ? 'bg-transparent hover:bg-white/5' : 'bg-transparent border-transparent hover:bg-white/5')
                    )}
                  >
                    {isSelected && viewMode === 'board' && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ffffff]" />
                    )}
                    {title.toLowerCase() === 'links' && viewMode === 'list' && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onStartSession) onStartSession(item, e);
                        }}
                        className={clsx(
                          "absolute top-1 right-1 text-neutral-400 hover:text-white transition-colors duration-150 cursor-pointer z-20",
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                      >
                        <FaLayerGroup size={10} />
                      </div>
                    )}
                    {isTodoSection && viewMode === 'list' ? (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleTodo) onToggleTodo(e, item);
                            }}
                            className={clsx(
                              "shrink-0 flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors cursor-pointer",
                              isCompleted ? "text-emerald-400" : isSelected ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"
                            )}
                          >
                            {isCompleted ? <FaCheckCircle size={13} /> : <FaRegCircle size={13} />}
                          </div>
                          <span className={clsx(
                            "text-[11px] tracking-tight truncate leading-none flex-1 min-w-0 font-medium",
                            isSelected ? "text-white" : "text-neutral-400 group-hover:text-white"
                          )}>
                            {rawTitle}
                          </span>
                        </div>

                        <div className="flex items-center justify-between w-full min-w-0 gap-1 mt-0.5">
                          <span className="text-[9px] text-neutral-400 truncate max-w-[65px] leading-none">
                            {dateText}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {isCompleted ? (
                              <div className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[8px] tracking-wide shrink-0">
                                <FaCheck size={7} className="text-emerald-400 shrink-0" />
                                <span>Done</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-300 font-medium text-[8px] shrink-0">
                                <FaRegCalendarAlt size={7} className="text-neutral-400" />
                                <span>{dateBadge}</span>
                              </div>
                            )}

                            {linkCount !== undefined && linkCount > 0 && (
                              <div className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-300 font-medium text-[8px] shrink-0" title={`Links: ${linkCount}`}>
                                <FaLink size={7} className="text-neutral-400" />
                                <span>{linkCount}</span>
                              </div>
                            )}

                            {autoCount !== undefined && autoCount > 0 && (
                              <div className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-300 font-medium text-[8px] shrink-0" title={`Automations: ${autoCount}`}>
                                <FaPaperclip size={7} className="text-neutral-400" />
                                <span>{autoCount}</span>
                              </div>
                            )}

                            {noteCount !== undefined && noteCount > 0 && (
                              <div className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-300 font-medium text-[8px] shrink-0" title={`Notes: ${noteCount}`}>
                                <FaRegFileAlt size={7} className="text-neutral-400" />
                                <span>{noteCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : viewMode === 'board' ? (
                      <div className="flex flex-col w-full h-full text-left justify-center overflow-hidden gap-1">
                        <div className="flex items-center justify-between min-w-0 w-full gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                              {isTodoSection ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleTodo) onToggleTodo(e, item);
                                  }}
                                  className={clsx(
                                    "shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-colors cursor-pointer",
                                    isCompleted ? "text-emerald-400" : isSelected ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"
                                  )}
                                >
                                  {isCompleted ? <FaCheckCircle size={15} /> : <FaRegCircle size={15} />}
                                </div>
                              ) : renderIcon(item, 20)}
                            </div>
                            <span className={clsx(
                              "text-[13px] tracking-tight truncate leading-tight flex-1 min-w-0 font-medium",
                              isSelected ? "text-white" : "text-neutral-200 group-hover:text-white",
                              isTodoSection && isCompleted && "line-through text-neutral-500"
                            )}>
                              {rawTitle}
                            </span>
                          </div>
                          {/* Top Right Date or Tag */}
                          {title.toLowerCase() !== 'commands' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {title.toLowerCase() === 'links' && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onStartSession) onStartSession(item, e);
                                  }}
                                  className={clsx(
                                    "text-neutral-400 hover:text-white transition-colors duration-150 cursor-pointer z-20",
                                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                  )}
                                >
                                  <FaLayerGroup size={12} />
                                </div>
                              )}
                              <span className="text-[10px] text-neutral-500 max-w-[120px] truncate">
                                {(() => {
                                  if (item.id === 'recording-action') {
                                    return `${item.centerBadge} (${item.rightBadge} steps)`;
                                  }
                                  if (title.toLowerCase() === 'todos') {
                                    return dateText;
                                  }
                                  if (title.toLowerCase() === 'links') {
                                    const urls = extractUrlsFromSnippet(item);
                                    if (urls.length === 0) return '';
                                    let baseDomain = '';
                                    try {
                                      baseDomain = new URL(urls[0]).hostname.replace('www.', '');
                                    } catch {
                                      baseDomain = urls[0].split('/')[0];
                                    }
                                    const formattedDomain = baseDomain.toLowerCase();
                                    if (urls.length > 1) return `${formattedDomain} + ${urls.length - 1}`;
                                    return formattedDomain;
                                  }
                                  if (title.toLowerCase() === 'automations') {
                                    return item.is_active ? 'Active' : (item.is_paused ? 'Paused' : 'Draft');
                                  }
                                  if (title.toLowerCase() === 'notes') {
                                    let desc = '';
                                    if (item.description) desc = item.description;
                                    else if (typeof item.value === 'string') desc = item.value.replace(/<[^>]+>/g, '').trim();
                                    return desc || 'Note';
                                  }
                                  if (title.toLowerCase() === 'snippets') return item.language || 'text';
                                  if (title.toLowerCase() === 'prompts') return 'Prompt';
                                  if (item.created_at) {
                                    const d = new Date(item.created_at);
                                    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
                                  }
                                  return 'Today';
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                        {(() => {
                          const sectionName = title.toLowerCase();
                          if (['commands', 'links', 'notes', 'automations', 'todos'].includes(sectionName)) return null;

                          let desc = '';
                          if (item.description) {
                            desc = item.description;
                          } else if (typeof item.value === 'string') {
                            desc = item.value.replace(/<[^>]+>/g, '').trim();
                          }

                          if (!desc) return null;

                          return (
                            <div className="flex min-w-0 w-full pl-[26px]">
                              <span className="text-[11px] text-neutral-500 truncate w-full leading-relaxed">
                                {desc}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-8 w-8 shrink-0 transition-transform group-hover:scale-110">
                        {renderIcon(item, 32)}
                      </div>
                    )}
                  </motion.div>

                  {!isTodoSection && viewMode === 'list' && (
                    <div className="w-full mt-1.5 flex flex-col items-center px-0.5 box-border">
                      <span className={clsx(
                        "text-[11px] w-full text-center leading-tight truncate transition-colors font-medium",
                        isSelected ? "text-white font-semibold" : "text-neutral-400 group-hover:text-white"
                      )} title={rawTitle}>
                        {rawTitle}
                      </span>
                      {item.id === 'recording-action' && (
                        <span className="text-[9px] text-purple-400 font-semibold truncate w-full text-center leading-none mt-0.5">
                          {item.centerBadge} ({item.rightBadge} steps)
                        </span>
                      )}
                      {title.toLowerCase() === 'links' && (
                        <span className="text-[9px] text-neutral-500 truncate w-full text-center leading-none mt-0.5">
                          {(() => {
                            const urls = extractUrlsFromSnippet(item);
                            if (urls.length === 0) return '';

                            let baseDomain = '';
                            try {
                              baseDomain = new URL(urls[0]).hostname.replace('www.', '');
                            } catch {
                              baseDomain = urls[0].split('/')[0];
                            }

                            const formattedDomain = baseDomain.toLowerCase();

                            if (urls.length > 1) {
                              return `${formattedDomain} + ${urls.length - 1}`;
                            }
                            return formattedDomain;
                          })()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* FIXED CREATE Button (List View Only) */}
      {onNewClick && viewMode === 'list' && (
        <div className={clsx("shrink-0 box-border pl-4")}>
          <div
            id={`altq-item-${startIndex + itemCount}`}
            onClick={onNewClick}
            className="shrink-0 w-16 flex flex-col items-center group cursor-pointer box-border relative"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'w-[52px] h-[52px] flex items-center justify-center rounded-xl transition-colors overflow-hidden box-border border-2',
                selectedIndex === startIndex + itemCount
                  ? 'bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.12)]'
                  : 'bg-transparent border-transparent hover:bg-white/5'
              )}
            >
              <div className={clsx(
                'flex items-center justify-center shrink-0 h-8 w-8 transition-colors',
                selectedIndex === startIndex + itemCount ? 'text-white' : 'text-neutral-400 group-hover:text-white'
              )}>
                <FiPlus size={20} />
              </div>
            </motion.div>

            <div className="w-full mt-1.5 flex flex-col items-center px-0.5 box-border">
              <span className={clsx(
                "text-[11px] w-full text-center leading-tight truncate transition-colors font-medium",
                selectedIndex === startIndex + itemCount ? "text-white font-semibold" : "text-neutral-400 group-hover:text-white"
              )}>
                New
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC<AppProps> = ({ isOpen, onClose, theme }) => {
  const [searchValue, setSearchValue] = useState('');
  const [autoTriggerDropdown, setAutoTriggerDropdown] = useState(true);


  const updateSearchValueAndFocus = (val: string) => {
    setSearchValue(val);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        const len = searchInputRef.current.value.length;
        searchInputRef.current.setSelectionRange(len, len);
      }
    }, 10);
  };

  // Load autoTriggerDropdown and view mode preference on mount
  useEffect(() => {
    chrome.storage.local.get(['rtq_focus_on', 'rtq_view_mode'], (res) => {
      if (res.rtq_focus_on !== undefined) {
        setAutoTriggerDropdown(res.rtq_focus_on);
      }
      if (res.rtq_view_mode !== undefined) {
        setViewMode(res.rtq_view_mode as 'list' | 'board');
      }
    });
  }, []);

  // Autofill search bar with '/' when opened if auto-trigger is enabled
  useEffect(() => {
    if (isOpen) {
      setGithubOrgSubAction(null); // Reset active Github Org flow on open
      if (autoTriggerDropdown) {
        setSearchValue('/');
        // Focus the input and position cursor at the end
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            const len = searchInputRef.current.value.length;
            searchInputRef.current.setSelectionRange(len, len);
          }
        }, 10);
      } else {
        setSearchValue('');
      }
    } else {
      setGithubOrgSubAction(null); // Reset active Github Org flow on close
    }
  }, [isOpen, autoTriggerDropdown]);

  const [showAllSections, setShowAllSections] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('board');
  const [selectedSidebarSection, setSelectedSidebarSection] = useState<string>('all');
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement | null>(null);
  const [recordingState, setRecordingState] = useState<any>(null);
  const [draftStepsCount, setDraftStepsCount] = useState<number>(0);

  // Click outside listener for settings dropdown
  useEffect(() => {
    if (!isSettingsDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current) {
        const path = event.composedPath();
        if (!path.includes(settingsDropdownRef.current)) {
          setIsSettingsDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsDropdownOpen]);
  const [allBookmarks, setAllBookmarks] = useState<any[]>([]);
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [addExistingUrl, setAddExistingUrl] = useState('');
  const [addExistingTitle, setAddExistingTitle] = useState('');

  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [activeTabTitle, setActiveTabTitle] = useState('');
  
  // Track current GitHub Org subAction selection state
  // We use this to override search results with extracted repository options
  const [githubOrgSubAction, setGithubOrgSubAction] = useState<{ orgName: string; subAction: 'open' | 'issue' | 'settings' } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState('local_user');
  useEffect(() => {
    getUserId()
      .then((uid) => setUserId(uid))
      .catch(() => setUserId(''));
  }, []);

  const allTeams = useSelector(selectAllData) as any[];
  const selectedTeam = useSelector(selectSelectedTeam) as any;

  // Derive the workspace to save new links into.
  // Priority: selected org team's first workspace → personal space workspace → any workspace.
  // This ensures AltQ-saved links appear in the Sheet Toolbar which filters by selectedTeam.
  const defaultWorkspaceId = useMemo(() => {
    if (!allTeams || allTeams.length === 0) return null;
    // If user has a selected org team in the Sheet Toolbar, save there
    if (selectedTeam?.team_id) {
      const matchedTeam = allTeams.find((t: any) => String(t.team_id) === String(selectedTeam.team_id));
      const firstWs = matchedTeam?.workspaces?.[0]?.workspace_id;
      if (firstWs) return firstWs;
    }
    // Fallback to personal space
    const personal = allTeams.find((t: any) => t.is_personal_space) || allTeams[0];
    return personal?.workspaces?.[0]?.workspace_id || null;
  }, [allTeams, selectedTeam]);

  const [optimisticSavedUrls, setOptimisticSavedUrls] = useState<string[]>([]);
  const { automations, notes, snippets, todos, links, loading, toggleTodoOptimistic } = useAppData();
  const { commands: globalCommands } = useCommands();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const isBackspaceHandlingRef = useRef(false);

  const [contextMenuState, setContextMenuState] = useState<{ x: number, y: number, item: any, title: string } | null>(null);

  // Fetch bookmarks from Chrome API when popup opens
  useEffect(() => {
    if (!isOpen) return;
    const chromeAny = (window as any)?.chrome;

    if (chromeAny?.bookmarks?.getTree) {
      chromeAny.bookmarks.getTree((tree: any) => {
        const list: any[] = [];
        const traverse = (nodes: any[]) => {
          nodes.forEach(node => {
            if (node.url) {
              list.push({
                id: node.id,
                name: node.title || node.url,
                url: node.url,
                isBookmark: true
              });
            }
            if (node.children) {
              traverse(node.children);
            }
          });
        };
        traverse(tree);
        setAllBookmarks(list);
      });
      return;
    }

    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'bookmarks_get_tree' }, (response: any) => {
        if (chromeAny.runtime.lastError || !response?.ok || !Array.isArray(response.results)) {
          return;
        }
        const list = response.results.map((n: any) => ({
          id: n.id || String(Math.random()),
          name: (n.title || '').trim() || n.url,
          url: n.url,
          isBookmark: true
        }));
        setAllBookmarks(list);
      });
    }

    try {
      const topUrl = (window.top as any)?.location?.href || window.location.href || '';
      const topTitle = (window.top as any)?.document?.title || document.title || 'Untitled Page';
      if (topUrl && !topUrl.startsWith('chrome-extension://')) {
        setActiveTabUrl(topUrl);
        setActiveTabTitle(topTitle);
      } else {
        throw new Error('Fallback');
      }
    } catch (_) {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage({ action: 'tabs_query', queryOptions: { active: true, currentWindow: true } }, (response: any) => {
          const activeTab = response?.results?.[0];
          if (activeTab) {
            setActiveTabUrl(activeTab.url || '');
            setActiveTabTitle(activeTab.title || 'Untitled Page');
          }
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    chrome.storage.local.get(['accessToken'], (res) => {
      setIsLoggedIn(!!res.accessToken);
    });
    const listener = (changes: any, areaName: string) => {
      if (areaName === 'local') {
        if (changes.accessToken) {
          setIsLoggedIn(!!changes.accessToken.newValue);
        }
      }
    };
    const chromeAny = (window as any)?.chrome;
    chromeAny?.storage?.onChanged?.addListener(listener);
    return () => {
      chromeAny?.storage?.onChanged?.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['automation_recording_state', 'automation_draft_steps_count'], (res: any) => {
        setRecordingState(res.automation_recording_state || null);
        setDraftStepsCount(res.automation_draft_steps_count || 0);
      });
      const handleChange = (changes: any, area: string) => {
        if (area === 'local') {
          if (changes.automation_recording_state) {
            setRecordingState(changes.automation_recording_state.newValue || null);
          }
          if (changes.automation_draft_steps_count) {
            setDraftStepsCount(changes.automation_draft_steps_count.newValue || 0);
          }
        }
      };
      chromeAny.storage.onChanged.addListener(handleChange);
      return () => chromeAny.storage.onChanged.removeListener(handleChange);
    }
    return undefined;
  }, []);

  const safeList = (list: any) => Array.isArray(list) ? list : [];

  const allCommands = useMemo(() => {
    const globals = globalCommands.map(c => ({ ...c, isGlobal: true, name: c.label }));
    const locals = LOCAL_COMMANDS.map(c => ({ ...c, isGlobal: false, name: c.label }));

    // Deduplicate by ID to prevent key collisions
    const map = new Map();
    locals.forEach(c => map.set(c.id, c));
    globals.forEach(c => map.set(c.id, c)); // globals overwrite locals if duplicate ID
    // Page-action commands (screenshot, download) — always available, run in current page context
    PAGE_ACTION_ITEMS.forEach(c => map.set(c.id, c));

    return Array.from(map.values());
  }, [globalCommands]);

  const filteredCommands = useMemo(() => {
    // Always separate page-action commands — they must never be sliced away
    const pageActionCmds = allCommands.filter(c => (c as any).category === 'page_action');
    const otherCmds = allCommands.filter(c => (c as any).category !== 'page_action');

    const effectiveSearchValue = searchValue.startsWith('/') ? '' : searchValue;

    if (!effectiveSearchValue.trim()) {
      // Exclude browser commands by default, sort as requested: AI -> PageActions -> Local -> External
      const noBrowser = otherCmds.filter(c => !('category' in c) || (c as any).category !== 'browser');
      const ai = noBrowser.filter(c => ('category' in c) && (c as any).category === 'ai' && c.id !== 'ai');
      const local = noBrowser.filter(c => !c.isGlobal);
      const other = noBrowser.filter(c => (!('category' in c) || (c as any).category !== 'ai') && c.isGlobal);
      // Page-action items pinned at front so they're always visible regardless of slice
      return [...pageActionCmds, ...ai, ...local, ...other].slice(0, 40);
    }

    const lower = effectiveSearchValue.toLowerCase();
    const core = lower.replace(/^\//, '');

    // Match page-action items against label, prefix, id AND keywords
    const matchedPageActions = pageActionCmds.filter(c =>
      c.label.toLowerCase().includes(core) ||
      c.prefix.toLowerCase().includes(core) ||
      String(c.id).toLowerCase().includes(core) ||
      ((c as any).keywords as string[] | undefined)?.some((kw: string) => kw.toLowerCase().includes(core))
    );

    const matchedOthers = otherCmds.filter(c =>
      c.id !== 'ai' && (
        c.label.toLowerCase().includes(core) ||
        c.prefix.toLowerCase().includes(core) ||
        String(c.id).toLowerCase().includes(core)
      )
    );

    return [...matchedPageActions, ...matchedOthers].slice(0, 40);
  }, [allCommands, searchValue]);

  const filtered = useMemo(() => {
    const { atDropdown, activeSection, searchQuery } = parseAtMode(searchValue);

    // When a section is activated via /ALIAS+Space, use searchQuery for filtering
    // When normal search, use searchValue directly
    const effectiveSearchValue = atDropdown ? '' : (activeSection !== null ? searchQuery : (searchValue.startsWith('/') ? '' : searchValue));

    const filter = (list: any[]) => {
      if (!effectiveSearchValue.trim()) return list;
      const lower = effectiveSearchValue.toLowerCase();
      return list.filter(item =>
        (item.name || item.key || item.title || '').toLowerCase().includes(lower) ||
        (item.description || (typeof item.value === 'string' ? item.value : '') || '').toLowerCase().includes(lower)
      );
    };

    const allSnippets = safeList(snippets);
    const actualSnippets = allSnippets.filter(s => (s.category || '').toLowerCase() !== 'prompt');
    const actualPrompts = allSnippets.filter(s => (s.category || '').toLowerCase() === 'prompt');

    const activeDomain = getDomain(activeTabUrl);
    const activeNormalized = normalizeUrl(activeTabUrl);

    // Use raw links (not filtered) so saved-state is NEVER affected by search input.
    const allRawLinks = safeList(links);
    const filteredLinks = filter(allRawLinks);

    // isAlreadySaved is computed against the full raw link list, independent of search.
    const isAlreadySaved = !!(activeNormalized && (
      optimisticSavedUrls.some(u => normalizeUrl(u) === activeNormalized) ||
      allRawLinks.some(link => {
        const urls = extractUrlsFromSnippet(link);
        return urls.some(u => normalizeUrl(u) === activeNormalized);
      })
    ));

    const thisSiteItems: any[] = [];
    if (activeNormalized && activeDomain && !activeTabUrl.startsWith('chrome-extension://')) {
      if (isLoggedIn) {
        if (isAlreadySaved) {
          thisSiteItems.push({ id: 'saved_indicator', name: 'Already Saved', category: 'thissite_indicator' });
        } else {
          thisSiteItems.push({ id: 'save_link', name: 'Save This Link', category: 'thissite_action' });
        }
        thisSiteItems.push({ id: 'add_to_existing', name: 'Add to Existing', category: 'thissite_action' });
      }
      thisSiteItems.push({ id: 'summarize_page', name: 'Summarize This Page', category: 'thissite_action' });

      if (recordingState?.active) {
        thisSiteItems.push({
          id: 'recording-action',
          name: 'Click the element to add in automations',
          category: 'thissite_action',
          centerBadge: 'Draft Automation',
          rightBadge: draftStepsCount,
        });
      }

      // Resolve webpage context (e.g., GitHub repo page details)
      const webContext = resolveWebPageContext(activeTabUrl, activeTabTitle);
      
      // Add custom GitHub actions if on any github.com page
      if (webContext.site === 'github') {
        const username = document.querySelector('meta[name="user-login"]')?.getAttribute('content') || '';
        thisSiteItems.push(
          {
            id: 'github_open_settings',
            name: 'Open Settings',
            category: 'thissite_action',
            url: 'https://github.com/settings'
          },
          {
            id: 'github_create_repo',
            name: 'Create Repository',
            category: 'thissite_action',
            url: 'https://github.com/new'
          },
          {
            id: 'github_open_profile',
            name: 'Open Profile',
            category: 'thissite_action',
            url: username ? `https://github.com/${username}` : 'https://github.com'
          },
          {
            id: 'github_create_org',
            name: 'Create an Organization',
            category: 'thissite_action',
            url: 'https://github.com/organizations/new'
          }
        );
      }
      
      // If we are on a recognized GitHub repository page, pull matching registered commands
      if (webContext.site === 'github' && webContext.pageType === 'repository') {
        const owner = webContext.metadata.owner;
        const repo = webContext.metadata.repo;
        const repoPath = `${owner}/${repo}`;

        // Get commands from LOCAL_COMMANDS that have isAvailable returning true for this context
        const contextCmds = LOCAL_COMMANDS.filter(cmd => cmd.isAvailable?.(webContext));
        
        contextCmds.forEach(cmd => {
          let urlPattern = '';
          if (cmd.id === 'github_create_issue') {
            urlPattern = `https://github.com/${repoPath}/issues/new`;
          } else if (cmd.id === 'github_create_pr') {
            urlPattern = `https://github.com/${repoPath}/compare`;
          } else if (cmd.id === 'github_open_settings') {
            urlPattern = `https://github.com/${repoPath}/settings`;
          }

          if (urlPattern) {
            thisSiteItems.push({
              id: cmd.id,
              name: `${cmd.label} in ${repoPath}`,
              category: 'thissite_action',
              url: urlPattern,
              executeId: cmd.id
            });
          }
        });
      }

      // If we are on a recognized GitHub organization page, add org repository search workflows
      if (webContext.site === 'github' && webContext.pageType === 'organization') {
        const orgName = webContext.metadata.organization;
        thisSiteItems.push(
          {
            id: 'github_org_open_repo',
            name: `Open Repository...`,
            category: 'thissite_action',
            executeId: 'github_org_action',
            orgName,
            subAction: 'open'
          },
          {
            id: 'github_org_create_issue',
            name: `Create Issue In...`,
            category: 'thissite_action',
            executeId: 'github_org_action',
            orgName,
            subAction: 'issue'
          },
          {
            id: 'github_org_open_settings',
            name: `Open Repository Settings...`,
            category: 'thissite_action',
            executeId: 'github_org_action',
            orgName,
            subAction: 'settings'
          }
        );
      }
    }

    // If user is inside a GitHub organization sub-action flow, we override
    // the returned data mapping so that only organization repositories show up
    if (githubOrgSubAction) {
      const webContext = resolveWebPageContext(activeTabUrl, activeTabTitle);
      const rawRepos = webContext.metadata.repositories || [];
      
      const filterText = (searchValue.startsWith('/') ? '' : searchValue).toLowerCase().trim();
      const matchedRepos = filterText
        ? rawRepos.filter(r => r.name.toLowerCase().includes(filterText))
        : rawRepos;

      const mappedRepoActions = matchedRepos.map(repo => {
        let repoUrl = repo.url;
        if (githubOrgSubAction.subAction === 'issue') {
          repoUrl = `${repo.url}/issues/new`;
        } else if (githubOrgSubAction.subAction === 'settings') {
          repoUrl = `${repo.url}/settings`;
        }

        return {
          id: `gh_org_repo_${repo.name}`,
          name: repo.name,
          category: 'thissite_action',
          url: repoUrl
        };
      });

      return {
        thissite: mappedRepoActions,
        automations: [],
        notes: [],
        todos: [],
        links: [],
        snippets: [],
        prompts: [],
        bookmarks: [],
        commands: []
      };
    }

    return {
      thissite: thisSiteItems,
      automations: filter(safeList(automations)).slice(0, 30),
      notes: filter(safeList(notes)).slice(0, 30),
      todos: filter(safeList(todos).filter(t => !t.is_done)).slice(0, 30),
      links: filteredLinks.slice(0, 30),
      snippets: filter(actualSnippets).slice(0, 30),
      prompts: filter(actualPrompts).slice(0, 30),
      bookmarks: filter(safeList(allBookmarks)).slice(0, 30),
      commands: filteredCommands
    };
  }, [automations, notes, snippets, todos, links, searchValue, allBookmarks, filteredCommands, activeTabUrl, optimisticSavedUrls, isLoggedIn, githubOrgSubAction]);

  const sections = useMemo(() => {
    let currentStart = 0;
    const result: { name: string; start: number; count: number }[] = [];
    const { atDropdown, activeSection, searchQuery } = parseAtMode(searchValue);
    const effectiveSearchValue = atDropdown ? '' : (activeSection !== null ? searchQuery : (searchValue.startsWith('/') ? '' : searchValue));

    const addSection = (name: string) => {
      if (result.some(s => s.name === name)) return;
      const itemsLength = filtered[name as keyof typeof filtered]?.length || 0;

      // During search: only show sections that have matching results.
      if (effectiveSearchValue.trim() && itemsLength === 0) {
        return;
      }

      const hasNewButton = name !== 'bookmarks' && name !== 'commands';
      // During search, don't add "new" button slot — only real items count
      const count = effectiveSearchValue.trim()
        ? itemsLength
        : itemsLength + (hasNewButton ? 1 : 0);

      if (count > 0) {
        result.push({ name, start: currentStart, count });
        currentStart += count;
      }
    };

    if (githubOrgSubAction) {
      // Show only 'thissite' repository list during github organization flows
      result.push({ name: 'thissite', start: 0, count: filtered.thissite.length });
      return result;
    }

    if (effectiveSearchValue.trim() || showAllSections || viewMode === 'board' || activeSection === 'all') {
      const allKeys = ['thissite', 'todos', 'commands', 'links', 'notes', 'automations', 'bookmarks', 'snippets', 'prompts'];
      allKeys.forEach(name => {
        addSection(name);
      });
    } else if (activeSection && activeSection !== 'all') {
      // @ALIAS+Space activated — show only that section
      addSection(activeSection);
    } else {
      // 1. Show priority sections if they have data (or always for commands)
      const primary = ['thissite', 'todos', 'commands', 'links', 'notes', 'automations'];
      primary.forEach(name => {
        if (result.length >= 5) return;
        if (name === 'commands' || (filtered[name as keyof typeof filtered]?.length || 0) > 0) {
          addSection(name);
        }
      });

      // 2. Fill up to 5 slots with fallbacks
      const fillers = ['bookmarks', 'snippets', 'prompts'];
      fillers.forEach(name => {
        if (result.length >= 5) return;
        addSection(name);
      });
    }

    return result;
  }, [filtered, showAllSections, searchValue, githubOrgSubAction]);

  const visibleSections = useMemo(() => {
    if (githubOrgSubAction) {
      return [{ name: 'thissite', start: 0, count: filtered.thissite.length }];
    }

    const { activeSection } = parseAtMode(searchValue);

    // @ALIAS+Space: show only that section regardless of sidebar
    if (activeSection && activeSection !== 'all') {
      const single = sections.find(r => r.name === activeSection);
      if (single) return [{ ...single, start: 0 }];
      return [];
    }

    if (selectedSidebarSection !== 'all') {
      const single = sections.find(r => r.name === selectedSidebarSection);
      if (single) {
        return [{ ...single, start: 0 }];
      }
      return [];
    }
    return sections;
  }, [sections, selectedSidebarSection, searchValue, githubOrgSubAction, filtered.thissite.length]);

  const flatItems = useMemo(() => {
    const list: any[] = [];
    visibleSections.forEach(s => {
      const items = filtered[s.name as keyof typeof filtered] || [];
      list.push(...items);
      // 'thissite' and 'bookmarks' and 'commands' don't get a "New" button slot
      if (s.name !== 'bookmarks' && s.name !== 'commands' && s.name !== 'thissite') {
        if (viewMode === 'list') {
          list.push({ isNew: true, section: s.name });
        }
      }
    });
    return list;
  }, [filtered, visibleSections, viewMode]);

  const dropdownOptions = useMemo(() => {
    const { atDropdown } = parseAtMode(searchValue);
    if (!atDropdown) return { thisSiteActions: [], categories: [], totalList: [] };

    const filterText = searchValue.slice(1).toLowerCase();

    // 1. "This Site" action items - Only show when input is exactly '/'
    const thisSiteActions = filterText !== ''
      ? []
      : (filtered.thissite || []).map((item: any) => ({
        type: 'action',
        id: item.id,
        name: item.name,
        item: item,
      }));

    // 2. Categories (excluding 'thissite' since it's displayed directly as actions)
    const categoryNames = ['all', 'todos', 'commands', 'links', 'notes', 'automations', 'bookmarks', 'snippets', 'prompts'];
    const categories = categoryNames
      .filter(name => {
        if (!filterText) return true;
        const alias = SECTION_ALIAS_DISPLAY[name] || '';
        return name.toLowerCase().startsWith(filterText) || alias.toLowerCase().startsWith(filterText);
      })
      .map(name => ({
        type: 'category',
        id: name,
        name: name,
      }));

    return {
      thisSiteActions,
      categories,
      totalList: [...categories, ...thisSiteActions]
    };
  }, [searchValue, filtered.thissite]);

  useEffect(() => {
    if (flatItems.length > 0) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex(-1);
    }
  }, [searchValue, flatItems.length]);

  // Reset dropdown selected index when search value changes so that it always starts at the first item (Categories)
  useEffect(() => {
    setDropdownSelectedIndex(0);
  }, [searchValue]);

  // Auto-scroll selected dropdown item into view when keyboard navigating
  useEffect(() => {
    if (dropdownSelectedIndex < 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`altq-dropdown-item-${dropdownSelectedIndex}`);
      if (el) {
        el.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [dropdownSelectedIndex]);

  const handleCreateNew = (type: string) => {
    const paramsMap: Record<string, string> = {
      automation: 'create_automation=true',
      link: 'create_link=true',
      note: 'create_note=true',
      snippet: 'create_snippet=true',
      todo: 'create_todo=true',
      prompt: 'create_prompt=true',
    };
    const param = paramsMap[type.toLowerCase()];
    if (!param) return;
    const url = chrome.runtime.getURL(`new-tab/index.html?${param}`);
    chrome.runtime.sendMessage({ action: 'open_tab', url }, () => {
      if (chrome.runtime.lastError) {
        window.open(url, '_blank');
      }
    });
    onClose();
  };

  const handleStartSession = useCallback(async (item: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const sessionId = item.snippet_id || item.id;
    const sessionName = item.key || item.name || item.title || 'Untitled Session';
    const workspaceId = item.workspace_id || defaultWorkspaceId;
    const folderId = item.folder_id || null;

    let initialUrls: string[] = [];
    let initialNames: string[] = [];
    try {
      const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
      if (Array.isArray(parsed)) {
        initialUrls = parsed.map((l: any) => l.url || l);
        initialNames = parsed.map((l: any) => l.name || '');
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
        if (Array.isArray(parsed.names)) initialNames = parsed.names;
      }
    } catch (err) { }

    if (initialUrls.length === 0) {
      initialUrls = extractUrlsFromSnippet(item);
    }

    // Save prefill to local storage perfectly mimicking create session
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({
        pending_session_prefill: {
          title: sessionName,
          sessionId: sessionId,
        }
      }, () => resolve());
    });

    chrome.runtime.sendMessage({
      action: 'start_session',
      sessionId,
      sessionName,
      workspaceId,
      folderId: folderId || null,
      teamId: selectedTeam?.team_id,
      storageMode: selectedTeam?.storageMode ?? 'cloud',
      initialUrls,
      initialNames,
    }, (response) => {
      // Show a toast
      const toastId = `altq-session-toast-${Date.now()}`;
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.textContent = `🚀 Session "${sessionName}" started`;
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:8px 20px;border-radius:20px;z-index:2147483647;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
      document.body.appendChild(toast);
      setTimeout(() => { toast.remove(); }, 2500);
    });

    onClose();
  }, [defaultWorkspaceId, selectedTeam, onClose]);

  const handleExecute = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    const isCtrl = e && ('ctrlKey' in e) && (e.ctrlKey || e.metaKey);

    // ── Page-action commands (screenshot / download) ──────────────────────
    // These run directly on the current page via chrome.runtime.sendMessage.
    // They cannot be routed through new-tab/index.html.
    if (item.category === 'page_action') {
      e?.stopPropagation();
      executePageActionCommand(item as AltQPageActionItem, onClose);
      return;
    }

    if (item.category === 'thissite_indicator') {
      e?.stopPropagation();
      return;
    }

    if (item.category === 'thissite_action') {
      e?.stopPropagation();
      if (item.id === 'recording-action') {
        onClose();
        const chromeAny = (window as any).chrome;
        if (chromeAny?.runtime && chromeAny?.storage?.local) {
          chromeAny.runtime.sendMessage({ type: 'GET_TAB_ID' }, (tabId: any) => {
            chromeAny.storage.local.get(['automation_recording_state'], (res: any) => {
              const currentState = res.automation_recording_state;
              if (currentState) {
                chromeAny.storage.local.set({
                  automation_recording_state: {
                    ...currentState,
                    select_mode: true,
                    targetTabId: tabId,
                    timestamp: Date.now(),
                  },
                });
              }
            });
          });
        }
        return;
      }

      // Handle GitHub Org subaction selection workflow
      if (item.executeId === 'github_org_action' && item.subAction) {
        setGithubOrgSubAction({ orgName: item.orgName, subAction: item.subAction });
        setSearchValue(''); // Clear query to display the matching repos
        return;
      }

      let tabUrl = activeTabUrl;
      let tabTitle = activeTabTitle;

      if (!tabUrl) {
        try {
          tabUrl = (window.top as any)?.location?.href || window.location.href || '';
          tabTitle = (window.top as any)?.document?.title || document.title || 'Untitled Page';
        } catch (_) { }
      }

      const getFallbackWorkspaceId = async (): Promise<string | null> => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['myCachedAllData', 'selectedTeamId'], (res) => {
            const cachedTeams = res.myCachedAllData;
            const selectedTeamId = res.selectedTeamId;
            if (Array.isArray(cachedTeams) && cachedTeams.length > 0) {
              if (selectedTeamId) {
                const matchedTeam = cachedTeams.find((t: any) => String(t.team_id) === String(selectedTeamId));
                const firstWs = matchedTeam?.workspaces?.[0]?.workspace_id;
                if (firstWs) return resolve(firstWs);
              }
              const personal = cachedTeams.find((t: any) => t.is_personal_space) || cachedTeams[0];
              const personalWs = personal?.workspaces?.[0]?.workspace_id;
              if (personalWs) return resolve(personalWs);
            }
            resolve(null);
          });
        });
      };

      const proceed = async (url: string, title: string) => {
        if (item.url) {
          chrome.runtime.sendMessage({ action: 'open_tab', url: item.url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) {
              window.open(item.url, '_blank');
            }
          });
          setGithubOrgSubAction(null); // Clear active flow
          onClose();
          return;
        }

        if (item.id === 'save_link') {
          try {
            setOptimisticSavedUrls(prev => [...prev, url]);
            let wsId = defaultWorkspaceId;
            if (!wsId) {
              wsId = await getFallbackWorkspaceId();
            }
            await updateSnippetRealtime({
              key: title,
              value: url,
              category: 'link',
              tags: [],
              workspace_id: wsId || undefined
            }, selectedTeam?.storageMode ?? 'cloud');
            const toastId = `altq-toast-${Date.now()}`;
            const toast = document.createElement('div');
            toast.id = toastId;
            toast.textContent = '🔖 Link saved to this site';
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a73e8;color:white;padding:8px 20px;border-radius:20px;z-index:2147483647;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
            document.body.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 2500);
          } catch (err) {
            console.warn('[AltQ-Trigger] updateSnippetRealtime failed:', err);
          }
        } else if (item.id === 'add_to_existing') {
          setAddExistingUrl(url);
          setAddExistingTitle(title);
          setShowAddExistingModal(true);
        } else if (item.id === 'summarize_page') {
          // Perform full context scraping and AI dispatching
          const defaultPrompt = 'Summarize the main points, key takeaways, and outline of this page.';

          chrome.runtime.sendMessage({ action: 'scrape_page_content' }, (scrapeRes: any) => {
            const pageContent = scrapeRes?.ok && typeof scrapeRes.content === 'string' ? scrapeRes.content : '';

            const enhancedPrompt = pageContent
              ? `User Question: ${defaultPrompt}

I'm looking at a webpage titled "${title}" (${url}).

Here is the page content for context:
---
${pageContent}
---`
              : `Summarize this page for me: ${url}`;

            chrome.storage.local.get('selectedAIs', (result: any) => {
              const selection =
                result.selectedAIs && Array.isArray(result.selectedAIs) && result.selectedAIs.length > 0
                  ? result.selectedAIs
                  : ['gpt'];

              const finalIds = selection.filter((id: string) => id !== 'ai');

              const getBaseAIUrl = (kind?: string): string => {
                if (kind === 'chatgpt') return 'https://chatgpt.com/';
                if (kind === 'claude') return 'https://claude.ai/new';
                if (kind === 'gemini') return 'https://gemini.google.com/app';
                if (kind === 'perplexity') return 'https://www.perplexity.ai/';
                return '';
              };

              const links = finalIds
                .map((id: string) => globalCommands.find(c => c.id === id))
                .filter((cmd: any): cmd is any => Boolean(cmd))
                .map((cmd: any) => {
                  const targetUrl = cmd.autoSubmit
                    ? getBaseAIUrl(cmd.autoSubmit) || cmd.urlTemplate.replace('{query}', '')
                    : cmd.urlTemplate.replace('{query}', encodeURIComponent(enhancedPrompt));

                  if (cmd.autoSubmit) {
                    return {
                      url: targetUrl,
                      autoSubmit: {
                        kind: cmd.autoSubmit,
                        prompt: enhancedPrompt,
                      },
                    };
                  }
                  return { url: targetUrl };
                });

              if (links.length > 0) {
                const hasAutoSubmit = links.some((l: any) => Boolean(l.autoSubmit));
                const delay = hasAutoSubmit ? 1200 : 200;

                chrome.runtime.sendMessage({
                  action: 'open_multiple_links',
                  links,
                  delay,
                });
              } else {
                // Fallback to ChatGPT
                chrome.runtime.sendMessage({
                  action: 'open_tab_with_auto_submit',
                  url: 'https://chatgpt.com/',
                  autoSubmit: {
                    kind: 'chatgpt',
                    prompt: enhancedPrompt,
                  },
                  active: true,
                });
              }
            });
          });
          onClose();
        }
      };

      if (tabUrl) {
        proceed(tabUrl, tabTitle);
      } else {
        chrome.runtime.sendMessage({ action: 'tabs_query', queryOptions: { active: true, currentWindow: true } }, (response) => {
          const activeTab = response?.results?.[0];
          proceed(activeTab?.url || '', activeTab?.title || 'Untitled Page');
        });
      }
      return;
    }

    if (item.isNew) {
      handleCreateNew(item.section);
      return;
    }

    if (item.is_todo_type || (item.category || '').toLowerCase() === 'todo') {
      const url = chrome.runtime.getURL('new-tab/index.html?open_create=true');
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
        if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
      });
      if (!isCtrl) onClose();
      return;
    }

    let cat = (item.category || item.snippet_category || '').toLowerCase();

    if (item.isGlobal !== undefined && !cat) {
      cat = 'command';
    }

    if (!cat && item.url) {
      cat = 'bookmark';
    }
    if (cat === 'bookmark' || cat === 'open_url') {
      const urlsToOpen = item.url ? item.url.split(',').filter(Boolean) : [];
      if (urlsToOpen.length > 0) {
        urlsToOpen.forEach((url: string) => {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          });
        });
      }
    } else if (['link', 'tabgroup', 'tab group', 'links', 'quicklink', 'collection', 'agent_collection'].includes(cat)) {
      const urls = extractUrlsFromSnippet(item);
      if (urls && urls.length > 0) {
        urls.forEach(url => {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          });
        });
      }
    } else if (['note', 'snippet', 'prompt'].includes(cat)) {
      const snippetId = String(item.snippet_id || item.id || item.todo_id || '');
      const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`);
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
        if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
      });
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent', 'custom', 'ai'].includes(cat) || !!(item.automation_steps || item.steps || item.automation)) {
      const triggerId = String(item.value || item.snippet_id || item.id || item.todo_id || '');
      const triggerType = (cat === 'custom' || cat === 'ai') ? 'note' : (cat || 'automation');
      // Preserve Global URL template commands (like /google)
      if (cat === 'command' && item.isGlobal && item.urlTemplate) {
        const url = buildUrl(item.urlTemplate, searchValue);
        if (url) {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          });
        }
      } else if (cat === 'ai') {
        // Matches BoardView behavior for ChatGPT, Claude, etc.
        const url = chrome.runtime.getURL(`new-tab/index.html?lock_command=${encodeURIComponent(item.id)}`);
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
        });
      } else {
        const url = chrome.runtime.getURL(`new-tab/index.html?trigger_hotkey=true&type=${triggerType}&id=${encodeURIComponent(triggerId)}`);
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
        });
      }
    } else {
      // Fallback
      const urls = extractUrlsFromSnippet(item);
      if (urls && urls.length > 0) {
        urls.forEach((url: string) => {
          chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
          });
        });
      } else {
        const snippetId = String(item.snippet_id || item.id || item.todo_id || '');
        const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`);
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: !isCtrl }, () => {
          if (chrome.runtime.lastError && !isCtrl) window.open(url, '_blank');
        });
      }
    }

    if (!isCtrl) {
      onClose();
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, item: any, title: string) => {
    e.preventDefault();
    setContextMenuState({ x: e.clientX, y: e.clientY, item, title });
  }, []);

  const handleToggleTodo = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const sid = String(item.id || item.snippet_id || item.todo_id);
    const newStatus = !item.is_done;
    if (toggleTodoOptimistic) toggleTodoOptimistic(sid, newStatus);
    try {
      await updateTodoStatus(item.id || item.snippet_id || item.todo_id, newStatus);
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (err) {
      console.warn('[AltQ] Failed to toggle todo status:', err);
      if (toggleTodoOptimistic) toggleTodoOptimistic(sid, !newStatus);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSettingsDropdownOpen) {
          setIsSettingsDropdownOpen(false);
          e.stopPropagation();
          return;
        }
        onClose();
        return;
      }

      // If the at command dropdown is active, completely ignore global arrow navigation
      if (parseAtMode(searchValue).atDropdown) {
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
          return;
        }
      }

      const total = flatItems.length;
      if (total === 0) return;

      const currentSectionIdx = visibleSections.findIndex(s => selectedIndex >= s.start && selectedIndex < s.start + s.count);
      const relativeIdx = selectedIndex === -1 ? 0 : selectedIndex - (visibleSections[currentSectionIdx]?.start || 0);

      if (viewMode === 'board') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const section = visibleSections[currentSectionIdx];
          if (section && selectedIndex < section.start + section.count - 1) {
            setSelectedIndex(selectedIndex + 1);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const section = visibleSections[currentSectionIdx];
          if (section && selectedIndex > section.start) {
            setSelectedIndex(selectedIndex - 1);
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (currentSectionIdx < visibleSections.length - 1) {
            const nextSection = visibleSections[currentSectionIdx + 1];
            setSelectedIndex(nextSection.start + Math.min(relativeIdx, nextSection.count - 1));
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (currentSectionIdx > 0) {
            const prevSection = visibleSections[currentSectionIdx - 1];
            setSelectedIndex(prevSection.start + Math.min(relativeIdx, prevSection.count - 1));
          }
        } else if (e.key === 'Enter') {
          if (selectedIndex >= 0 && selectedIndex < total) {
            e.preventDefault();
            handleExecute(flatItems[selectedIndex]);
          }
        }
      } else {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSelectedIndex(prev => (prev < total - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : total - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (selectedIndex === -1) {
            setSelectedIndex(0);
          } else if (currentSectionIdx < visibleSections.length - 1) {
            const nextSection = visibleSections[currentSectionIdx + 1];
            const newIdx = nextSection.start + Math.min(relativeIdx, nextSection.count - 1);
            setSelectedIndex(newIdx);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentSectionIdx > 0) {
            const prevSection = visibleSections[currentSectionIdx - 1];
            const newIdx = prevSection.start + Math.min(relativeIdx, prevSection.count - 1);
            setSelectedIndex(newIdx);
          } else {
            setSelectedIndex(-1);
          }
        } else if (e.key === 'Enter') {
          if (selectedIndex >= 0 && selectedIndex < total) {
            e.preventDefault();
            handleExecute(flatItems[selectedIndex]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, flatItems, visibleSections, selectedIndex, onClose, viewMode, searchValue, isSettingsDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);



  if (!isOpen) return null;

  const isDropdownActive = viewMode !== 'list' && parseAtMode(searchValue).atDropdown;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 flex items-center justify-center z-[2147483647] bg-black/60 backdrop-blur-[1px]"
      >
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          ref={mainContainerRef}
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="w-[75vw] min-w-[900px] max-w-[95vw] h-[85vh] flex flex-col bg-[#0B0C10] border border-[#2A2B33] rounded-none shadow-2xl overflow-hidden relative font-['Inter',_sans-serif] popup-main-container"
        >
          {/* Top Left Branding */}
          <div className="absolute top-7 left-8 flex items-center z-50 select-none">
            <img src={cmdOSLogo} alt="cmdOS" className="h-6 w-auto" />
            <span className="text-lg font-bold text-white tracking-wide ml-2">cmdOS</span>
          </div>

          {/* Left Sidebar (Board View Only) */}
          {viewMode === 'board' && !isDropdownActive && (
            <div className="absolute left-0 top-20 bottom-0 w-[160px] flex flex-col px-4 z-40 border-r border-[#2A2B33] overflow-y-auto hover-scrollbar">
              <div className="flex flex-col space-y-1 mt-4 pb-8">
                {/* All Option */}
                <button
                  onClick={() => setSelectedSidebarSection('all')}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                    selectedSidebarSection === 'all'
                      ? "text-white bg-white/10 font-medium"
                      : "text-[#A1A6B3] font-normal hover:text-white hover:bg-white/5"
                  )}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  All
                </button>
                {['thissite', 'todos', 'commands', 'links', 'notes', 'automations', 'bookmarks', 'snippets', 'prompts'].map(sectionName => {
                  const meta = SECTION_META[sectionName] || { title: sectionName, icon: <FaCheckCircle className="w-4 h-4 shrink-0" /> };
                  const isSelected = selectedSidebarSection === sectionName;
                  return (
                    <button
                      key={sectionName}
                      onClick={() => setSelectedSidebarSection(sectionName)}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "text-white bg-white/10 font-medium"
                          : "text-[#A1A6B3] font-normal hover:text-white hover:bg-white/5"
                      )}
                    >
                      {meta.icon}
                      {meta.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Right Action Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-1.5 z-[100]">
            {(!isLoggedIn || userId === 'local_user') && (
              <button
                onClick={() => (window.location.href = CMDOS_SIGN_UP_URL)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-neutral-800 to-neutral-900 dark:from-white dark:to-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold rounded-full shadow-md hover:shadow-lg transition-all border border-white/10 dark:border-transparent flex items-center gap-1.5 cursor-pointer"
              >
                Login
              </button>
            )}

            {/* Settings Dropdown Button */}
            <div ref={settingsDropdownRef} className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsSettingsDropdownOpen(!isSettingsDropdownOpen);
                }}
                className={clsx(
                  "w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer focus:outline-none",
                  isSettingsDropdownOpen
                    ? "bg-white/15 text-white"
                    : "bg-transparent hover:bg-white/10 text-[#A1A6B3] hover:text-white"
                )}
                title="Settings"
              >
                <FiSettings className="w-5 h-5" />
              </button>

              {isSettingsDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-[280px] rounded-xl shadow-2xl z-[9999] p-3 flex flex-col gap-3 border border-[#2A2B33] bg-[#171821] animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-150 text-left">
                  {/* Board Type selector */}
                  <div className="flex flex-col gap-1.5 px-2">
                    <span className="text-[11px] font-semibold text-[#8B8F9D] tracking-wide">Board Type</span>
                    <div className="flex flex-col gap-1">
                      {/* Board View Row */}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          setViewMode('board');
                          chrome.storage.local.set({ rtq_view_mode: 'board' });
                        }}
                        className={clsx(
                          "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors",
                          viewMode === 'board' ? "bg-white/5 text-white" : "text-[#A1A6B3] hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <svg className={clsx("w-4 h-4", viewMode === 'board' ? "text-[#10b981]" : "text-[#A1A6B3]")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M12 3v18" />
                            <path d="M3 12h9" />
                          </svg>
                          <span className="text-xs font-semibold">Board View</span>
                        </div>
                        <div className={clsx(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          viewMode === 'board' ? "border-[#10b981]" : "border-[#A1A6B3]/40"
                        )}>
                          {viewMode === 'board' && <div className="w-2 h-2 rounded-full bg-[#10b981]" />}
                        </div>
                      </div>

                      {/* List View Row */}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          setViewMode('list');
                          chrome.storage.local.set({ rtq_view_mode: 'list' });
                        }}
                        className={clsx(
                          "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors",
                          viewMode === 'list' ? "bg-white/5 text-white" : "text-[#A1A6B3] hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <svg className={clsx("w-4 h-4", viewMode === 'list' ? "text-[#10b981]" : "text-[#A1A6B3]")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                          <span className="text-xs font-semibold">List View</span>
                        </div>
                        <div className={clsx(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          viewMode === 'list' ? "border-[#10b981]" : "border-[#A1A6B3]/40"
                        )}>
                          {viewMode === 'list' && <div className="w-2 h-2 rounded-full bg-[#10b981]" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-[1px] bg-[#2A2B33] my-1 mx-2" />

                  <div className="flex flex-col gap-2 px-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">Command-first search</span>
                        <span className="text-[9px] font-medium bg-neutral-800 text-[#A1A6B3] px-1.5 py-0.5 rounded border border-[#2A2B33]">Suggested</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newVal = !autoTriggerDropdown;
                          setAutoTriggerDropdown(newVal);
                          chrome.storage.local.set({ rtq_focus_on: newVal });
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${autoTriggerDropdown ? 'bg-emerald-500' : 'bg-[#2A2B33]'
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${autoTriggerDropdown ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-start gap-2 text-[10px] text-[#A1A6B3] leading-normal">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                      <div className="flex flex-col gap-1">
                        <span>Clicking search opens command-first results so you can narrow choices faster.</span>
                        <span className="text-[9px] text-[#8B8F9D]">Turn off to use normal search results.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors rounded-lg cursor-pointer focus:outline-none"
              title="Close (Esc)"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          {/* Ultra-Compact Search Bar */}
          <div className={clsx("px-8 pt-6 pb-4 shrink-0 flex justify-center relative", viewMode === 'board' && !isDropdownActive && "ml-[160px]")}>
            <div className="relative flex items-center bg-[#0B0C10] border border-[#2A2B33] h-[52px] rounded-[16px] px-6 group w-full max-w-xl transition-colors shadow-2xl focus-within:border-white/30 z-[60]">
              <FiSearch className="w-4 h-4 text-[#A1A6B3] mr-3 shrink-0" />
              <div className="relative flex-1 h-full flex items-center">
                {/* Active Tag Pill — real DOM node so cursor positions correctly after it */}
                {(() => {
                  const tagInfo = getActiveTagInfo(searchValue);
                  if (!tagInfo) return null;
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(156, 163, 175, 0.15)',
                        border: '1.5px solid #9ca3af',
                        color: '#9ca3af',
                        borderRadius: '6px',
                        padding: '1px 6px',
                        fontWeight: 700,
                        marginRight: '6px',
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        lineHeight: 1,
                        height: '20px',
                        flexShrink: 0,
                        userSelect: 'none',
                      }}
                    >
                      {tagInfo.label}
                    </span>
                  );
                })()}

                {/* Highlight Overlay — only when no active tag (colours the /prefix text) */}
                {viewMode !== 'list' && !getActiveTagInfo(searchValue) && (() => {
                  const prefixMatch = searchValue.match(/^\/[a-zA-Z]+/);
                  return (
                    <div className="absolute inset-0 pointer-events-none select-none whitespace-pre flex items-center text-[15px] font-semibold text-transparent font-sans">
                      {prefixMatch ? (
                        <>
                          <span className="text-white align-middle font-bold">{prefixMatch[0]}</span>
                          <span className="text-white align-middle">{searchValue.slice(prefixMatch[0].length)}</span>
                        </>
                      ) : (
                        <span className="text-white align-middle">{searchValue}</span>
                      )}
                    </div>
                  );
                })()}

                <input
                  ref={searchInputRef}
                  type="text"
                  value={getActiveTagInfo(searchValue)?.query ?? searchValue}
                  onChange={(e) => {
                    const tagInfo = getActiveTagInfo(searchValue);
                    if (tagInfo) {
                      // Tag is active — update only the query portion
                      setSearchValue(tagInfo.prefix + ' ' + e.target.value);
                      return;
                    }

                    let val = mapFullNameToShortcut(e.target.value);
                    const prevVal = searchValue;
                    let spaceAppended = false;

                    if (val.length > prevVal.length) {
                      const m = val.match(/^\/([a-zA-Z]+)$/);
                      if (m) {
                        const typedAlias = m[1].toUpperCase();
                        const isPrefixOfLongerAlias = Object.keys(SECTION_ALIASES).some(
                          (otherAlias) => otherAlias.startsWith(typedAlias) && otherAlias.length > typedAlias.length
                        );
                        if (SECTION_ALIASES[typedAlias] && !isPrefixOfLongerAlias) {
                          val = val + ' ';
                          spaceAppended = true;
                        }
                      }
                    }

                    setSearchValue(val);

                    if (spaceAppended) {
                      setTimeout(() => {
                        if (searchInputRef.current) {
                          const len = searchInputRef.current.value.length;
                          searchInputRef.current.setSelectionRange(len, len);
                        }
                      }, 10);
                    }

                    if (val === '') {
                      setSelectedSidebarSection('all');
                    } else if (val === '/' && prevVal.startsWith('/') && prevVal.length > 1) {
                      setSelectedSidebarSection('all');
                    } else {
                      const { activeSection } = parseAtMode(val);
                      if (activeSection) {
                        setSelectedSidebarSection(activeSection);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();

                    const tagInfo = getActiveTagInfo(searchValue);
                    // Backspace on empty query → unlock tag back to its prefix (e.g. "/l")
                    if (e.key === 'Backspace' && tagInfo && tagInfo.query === '') {
                      e.preventDefault();
                      updateSearchValueAndFocus(tagInfo.prefix);
                      return;
                    }

                    const { atDropdown, activeSection, searchQuery } = parseAtMode(searchValue);

                    if (e.key === 'Enter' && activeSection && !searchQuery.trim()) {
                      e.preventDefault();
                      setSearchValue('');
                      return;
                    }

                    if (atDropdown) {
                      const totalList = dropdownOptions.totalList;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setDropdownSelectedIndex(prev => (prev + 1) % totalList.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setDropdownSelectedIndex(prev => (prev - 1 + totalList.length) % totalList.length);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (totalList.length > 0) {
                          const selectedIdx = Math.max(0, Math.min(dropdownSelectedIndex, totalList.length - 1));
                          const chosen = totalList[selectedIdx];
                          if (chosen.type === 'action') {
                            handleExecute((chosen as any).item);
                            setSearchValue('');
                            setDropdownSelectedIndex(-1);
                          } else {
                            const alias = SECTION_ALIAS_DISPLAY[chosen.id] || '';
                            updateSearchValueAndFocus(`/${alias} `);
                            setDropdownSelectedIndex(-1);
                          }
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setSearchValue('');
                        setDropdownSelectedIndex(-1);
                      }
                    }
                  }}
                  onKeyUp={(e) => e.stopPropagation()}
                  placeholder={searchValue ? "" : "Search across spaces & apps"}
                  className={clsx(
                    "flex-1 min-w-0 bg-transparent border-none text-[15px] font-semibold caret-white placeholder-[#8B8F9D] focus:outline-none focus:ring-0 h-full z-10",
                    (viewMode === 'list' || !!getActiveTagInfo(searchValue)) ? "text-white" : "text-transparent"
                  )}
                />
              </div>
              {viewMode !== 'list' && (
                <div className="relative group/dot shrink-0 ml-2">
                  {/* Small slash button */}
                  <button
                    onMouseEnter={() => setIsSettingsDropdownOpen(true)}
                    onClick={() => {
                      const newVal = !autoTriggerDropdown;
                      setAutoTriggerDropdown(newVal);
                      chrome.storage.local.set({ rtq_focus_on: newVal });
                    }}
                    className="relative w-7 h-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-sm font-semibold focus:outline-none"
                  >
                    <span>/</span>
                  </button>
                </div>
              )}
            </div>

            {/* At Command Dropdown — shown only when typing alias and no matching category yet */}
            {viewMode !== 'list' && parseAtMode(searchValue).atDropdown && (
              <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-full max-w-xl bg-[#171821] border border-white/10 rounded-xl shadow-2xl z-[70] overflow-hidden flex flex-col pt-0 pb-2 backdrop-blur-xl max-h-[360px] overflow-y-auto custom-scrollbar">
                {(() => {
                  if (dropdownOptions.totalList.length === 0) {
                    return <div className="px-4 py-3 text-sm text-neutral-500">No matching categories or actions</div>;
                  }

                  return (
                    <>
                      {/* 1. "Categories" Heading and Category Options */}
                      {dropdownOptions.categories.length > 0 && (
                        <>
                          <div className="px-4 py-1 flex items-center justify-between border-b border-white/5 mb-1">
                            <span className="text-[10px] text-neutral-400 font-bold tracking-wide ">Categories</span>
                          </div>
                          {dropdownOptions.categories.map((opt, idx) => {
                            const globalIdx = idx;
                            const isSelected = dropdownSelectedIndex === globalIdx;
                            const optName = opt.name;
                            const isAll = optName === 'all';
                            const meta = isAll ? { title: 'All', icon: <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg> } : (SECTION_META[optName] || { title: optName, icon: <FaCheckCircle className="w-4 h-4 shrink-0" /> });
                            const alias = SECTION_ALIAS_DISPLAY[optName] || '';

                            return (
                              <div
                                key={optName}
                                id={`altq-dropdown-item-${globalIdx}`}
                                onClick={() => {
                                  updateSearchValueAndFocus(`/${alias} `);
                                  setDropdownSelectedIndex(-1);
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                className={clsx(
                                  "px-4 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-medium",
                                  isSelected ? "bg-white/5 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {meta.icon}
                                  <span className="text-sm font-medium">{meta.title}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {alias && (
                                    <span className={clsx(
                                      "text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold tracking-wider min-w-[28px] text-center",
                                      isSelected
                                        ? "border-white/20 bg-white/10 text-white"
                                        : "border-white/10 bg-white/5 text-neutral-400"
                                    )}>
                                      /{alias}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* 2. "This Section" Heading and Action Items */}
                      {dropdownOptions.thisSiteActions.length > 0 && (
                        <>
                          <div className="px-4 py-1 flex items-center justify-between border-b border-white/5 mb-1 mt-2">
                            <span className="text-[10px] text-neutral-400 font-bold tracking-wide ">This Section</span>
                          </div>
                          {dropdownOptions.thisSiteActions.map((opt, idx) => {
                            const globalIdx = dropdownOptions.categories.length + idx;
                            const isSelected = dropdownSelectedIndex === globalIdx;
                            const icon =
                              opt.id === 'save_link' ? <FaLink className="w-4 h-4 shrink-0 text-[#A1A6B3]" /> :
                                opt.id === 'saved_indicator' ? <FaCheck className="w-4 h-4 shrink-0 text-emerald-400" /> :
                                  opt.id === 'add_to_existing' ? <FaLink className="w-4 h-4 shrink-0 text-[#A1A6B3]" /> :
                                    opt.id === 'summarize_page' ? <LuSparkles className="w-4 h-4 shrink-0 text-purple-400" /> :
                                      <FaRegFileAlt className="w-4 h-4 shrink-0 text-neutral-400" />;

                            return (
                              <div
                                key={opt.id}
                                id={`altq-dropdown-item-${globalIdx}`}
                                onClick={() => {
                                  handleExecute(opt.item);
                                  setSearchValue('');
                                  setDropdownSelectedIndex(-1);
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                className={clsx(
                                  "px-4 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-medium",
                                  isSelected ? "bg-white/5 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {icon}
                                  <span className="text-sm font-medium">{opt.name}</span>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          {/* Scrollable Content Area */}
          {!parseAtMode(searchValue).atDropdown && (
            <div className={clsx(
              "flex-1 px-8",
              viewMode === 'list' ? "pb-8 overflow-y-auto flex-col space-y-3 hover-scrollbar" : "pb-0 overflow-x-auto overflow-y-auto flex flex-row space-x-4 items-stretch ml-[160px] custom-horizontal-scrollbar"
            )}>
              {visibleSections.map(s => {
                if (s.name === 'thissite') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="thissite"
                      title="This Site"
                      icon={<FaRegFileAlt />}
                      items={filtered.thissite}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      containerRef={mainContainerRef}
                      renderIcon={(item) => {
                        if (item.id === 'recording-action') return <FiZap className="w-[22px] h-[22px] text-purple-400 object-contain" />;
                        if (item.id === 'save_link') return <FaLink className="w-[22px] h-[22px] text-[#A1A6B3] object-contain" />;
                        if (item.id === 'saved_indicator') return <FaCheck className="w-[22px] h-[22px] text-emerald-400 object-contain" />;
                        if (item.id === 'add_to_existing') return <FaLink className="w-[22px] h-[22px] text-[#A1A6B3] object-contain" />;
                        if (item.id === 'summarize_page') return <LuSparkles className="w-[22px] h-[22px] text-purple-400 object-contain" />;
                        
                        // GitHub contextual specific actions
                        const githubActionIds = [
                          'github_create_issue', 'github_org_create_issue',
                          'github_create_pr', 'github_org_open_repo',
                          'github_open_settings', 'github_org_open_settings',
                          'github_create_repo', 'github_open_profile',
                          'github_create_org'
                        ];
                        if (githubActionIds.includes(item.id) || item.id?.startsWith('gh_org_repo_')) {
                          return <FaGithub className="w-[22px] h-[22px] text-[#A1A6B3] dark:text-neutral-400 object-contain" />;
                        }
                        
                        // Default favicon loader
                        return <img src={getFaviconUrl(item.url || extractUrlsFromSnippet(item)[0] || 'https://github.com')} alt="" className="w-[22px] h-[22px] object-contain rounded-md shadow-sm" />;
                      }}
                    />
                  );
                }

                if (s.name === 'todos') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="todos"
                      title="Todos"
                      icon={<FaCheckCircle />}
                      items={filtered.todos}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      onNewClick={() => handleCreateNew('todo')}
                      containerRef={mainContainerRef}
                      renderIcon={(item) => (
                        <div
                          className="w-full h-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110"
                          onClick={(e) => { e.stopPropagation(); handleToggleTodo(e, item); }}
                        >
                          {item.is_done ? (
                            <FaCheckCircle className="text-emerald-500 w-[22px] h-[22px] drop-shadow-sm" />
                          ) : (
                            <FaRegCircle className="text-neutral-400 w-[22px] h-[22px]" />
                          )}
                        </div>
                      )}
                      onToggleTodo={handleToggleTodo}
                    />
                  );
                }

                if (s.name === 'automations') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="automations"
                      title="Automations"
                      icon={<FiZap />}
                      items={filtered.automations}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      onNewClick={() => handleCreateNew('automation')}
                      containerRef={mainContainerRef}
                      renderIcon={(item, size) => <AutomationDynamicIcon automation={item} size={size} className="w-full h-full object-contain" />}
                    />
                  );
                }

                if (s.name === 'links') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="links"
                      title="Links"
                      icon={<FaLink />}
                      items={filtered.links}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      onNewClick={() => handleCreateNew('link')}
                      onStartSession={handleStartSession}
                      containerRef={mainContainerRef}
                      renderIcon={(item) => {
                        const urls = extractUrlsFromSnippet(item);
                        if (urls.length > 1) {
                          const displayUrls = urls.slice(0, 4);
                          const count = displayUrls.length;

                          let overlapClass = viewMode === 'list' ? "-space-x-2.5" : "-space-x-1.5";
                          let sizeClass = viewMode === 'list' ? "w-6 h-6" : "w-3.5 h-3.5";
                          let imgClass = viewMode === 'list' ? "w-3.5 h-3.5" : "w-2 h-2";

                          if (count === 3) {
                            overlapClass = viewMode === 'list' ? "-space-x-2" : "-space-x-1.5";
                            sizeClass = viewMode === 'list' ? "w-5 h-5" : "w-3 h-3";
                            imgClass = viewMode === 'list' ? "w-3 h-3" : "w-1.5 h-1.5";
                          } else if (count >= 4) {
                            overlapClass = viewMode === 'list' ? "-space-x-1.5" : "-space-x-1";
                            sizeClass = viewMode === 'list' ? "w-4 h-4" : "w-2.5 h-2.5";
                            imgClass = viewMode === 'list' ? "w-2.5 h-2.5" : "w-1.5 h-1.5";
                          }

                          return (
                            <div className={clsx("flex items-center justify-center h-full", viewMode === 'list' ? 'w-full' : 'w-auto', overlapClass)}>
                              {displayUrls.map((url, i) => (
                                <div
                                  key={`stack-${i}`}
                                  className={clsx(
                                    "shrink-0 aspect-square rounded-full flex items-center justify-center ring-1 ring-[#08080a] bg-white shadow-sm relative",
                                    sizeClass
                                  )}
                                  style={{ zIndex: 10 - i }}
                                >
                                  <img src={getFaviconUrl(url)} alt="" className={clsx("object-contain", imgClass)} />
                                </div>
                              ))}
                            </div>
                          );
                        }
                        const url = urls && urls.length > 0 ? urls[0] : '';
                        return url ? (
                          <img src={getFaviconUrl(url)} alt="" className={clsx("shadow-sm object-contain", viewMode === 'board' ? 'w-3.5 h-3.5' : 'w-full h-full')} />
                        ) : (
                          <FaLink className={clsx("text-neutral-400", viewMode === 'board' ? 'w-3.5 h-3.5' : 'w-full h-full')} />
                        );
                      }}
                    />
                  );
                }

                if (s.name === 'notes') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="notes"
                      title="Notes"
                      icon={<NotesIcon />}
                      items={filtered.notes}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      onNewClick={() => handleCreateNew('note')}
                      containerRef={mainContainerRef}
                      renderIcon={() => <NotesIcon className="drop-shadow-sm w-full h-full object-contain" />}
                    />
                  );
                }

                if (s.name === 'snippets') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="snippets"
                      title="Snippets"
                      icon={<FaCode />}
                      items={filtered.snippets}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      onNewClick={() => handleCreateNew('snippet')}
                      containerRef={mainContainerRef}
                      renderIcon={() => <FaCode className="text-neutral-400 w-full h-full object-contain" />}
                    />
                  );
                }

                if (s.name === 'prompts') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="prompts"
                      title="Prompts"
                      icon={<FaTerminal />}
                      items={filtered.prompts}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      onNewClick={() => handleCreateNew('prompt')}
                      containerRef={mainContainerRef}
                      renderIcon={() => <FaTerminal className="text-neutral-400 w-[22px] h-[22px] object-contain" />}
                    />
                  );
                }

                if (s.name === 'bookmarks') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="bookmarks"
                      title="Bookmarks"
                      icon={<FaBookmark />}
                      items={filtered.bookmarks}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      containerRef={mainContainerRef}
                      renderIcon={(item) => (
                        <img src={getFaviconUrl(item.url)} alt="" className="w-[22px] h-[22px] object-contain rounded-md shadow-sm" />
                      )}
                    />
                  );
                }

                if (s.name === 'commands') {
                  return (
                    <DashboardRow
                      viewMode={viewMode}
                      key="commands"
                      title="Commands"
                      icon={<FaTerminal />}
                      items={filtered.commands}
                      loading={loading}
                      selectedIndex={selectedIndex}
                      startIndex={s.start}
                      onItemClick={handleExecute}
                      onContextMenu={handleContextMenu}
                      containerRef={mainContainerRef}
                      renderIcon={(item) => {
                        // Page-action commands get distinct colored icons
                        if (PAGE_ACTION_ICONS[item.id]) {
                          return (
                            <div className="w-[22px] h-[22px] shrink-0 flex items-center justify-center overflow-hidden border border-white/[0.08] rounded-[6px] bg-white/5 shadow-sm">
                              {PAGE_ACTION_ICONS[item.id]}
                            </div>
                          );
                        }

                        if (BROWSER_ICONS[item.id]) {
                          return (
                            <div className="w-[22px] h-[22px] shrink-0 flex items-center justify-center overflow-hidden">
                              {BROWSER_ICONS[item.id]}
                            </div>
                          );
                        }

                        if (item.icon) {
                          if (typeof item.icon === 'string') {
                            return (
                              <img src={item.icon} alt="" className="w-[22px] h-[22px] object-contain rounded-md shadow-sm" />
                            );
                          }
                          if (React.isValidElement(item.icon)) {
                            return (
                              <div className="w-[22px] h-[22px] shrink-0 flex items-center justify-center overflow-hidden">
                                {item.icon}
                              </div>
                            );
                          }
                          const IconCmd = item.icon as React.ElementType;
                          return (
                            <div className="w-[22px] h-[22px] shrink-0 flex items-center justify-center overflow-hidden">
                              <IconCmd className="text-neutral-400 drop-shadow-sm w-full h-full object-contain" />
                            </div>
                          );
                        }

                        if (item.isGlobal === false || !item.urlTemplate) {
                          return (
                            <div className="w-[22px] h-[22px] shrink-0 flex items-center justify-center overflow-hidden border border-white/[0.08] rounded-[6px] bg-white/5 shadow-sm">
                              <TerminalIcon className="text-[#e2e8f0]" size={14} />
                            </div>
                          );
                        }


                        const url = item.urlTemplate ? buildUrl(item.urlTemplate, '') : `https://${item.iconHost}`;
                        return (
                          <img src={getFaviconUrl(url)} alt="" className="w-[22px] h-[22px] object-contain rounded-md shadow-sm" />
                        );
                      }}
                    />
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* Footer Indications */}
          {!isDropdownActive && (
            <div
              className={clsx(
                "relative flex items-center justify-between gap-3 px-8 py-2.5 border-t border-[#2A2B33] bg-[#0E0F14]/85 backdrop-blur text-[10px] font-medium flex-shrink-0 text-[#8B8F9D]",
                viewMode === 'board' && "pl-[188px]"
              )}
            >
              {/* Left: Keyboard shortcuts */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#A1A6B3]">Navigate</span>
                  <span className="flex items-center gap-0.5">
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">↑</span>
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">↓</span>
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">←</span>
                    <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">→</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#A1A6B3]">Select</span>
                  <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">Enter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#A1A6B3]">Close</span>
                  <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">Esc</span>
                </div>
              </div>

              {/* Right: Options */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#A1A6B3]">Options</span>
                <span className="flex items-center gap-0.5">
                  <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">Right Click</span>
                </span>
              </div>
            </div>
          )}

        </motion.div>

        <AddToExistingModal
          isOpen={showAddExistingModal}
          onClose={() => setShowAddExistingModal(false)}
          activeUrl={addExistingUrl}
          activeTitle={addExistingTitle}
          links={links}
          defaultWorkspaceId={defaultWorkspaceId}
        />

        <style dangerouslySetInnerHTML={{
          __html: `
          .no-scrollbar::-webkit-scrollbar { display: none !important; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          
          .custom-horizontal-scrollbar::-webkit-scrollbar {
            height: 8px;
            width: 0px;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
            background-color: transparent;
            border-radius: 9999px;
          }
          .popup-main-container:hover .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.3);
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.5) !important;
          }
        `}} />
      </motion.div>

      {contextMenuState && (
        <UnifiedContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          showSearch={true}
          portalContainer={(window as any).__ALTQ_PORTAL_HOST__ || document.body}
          onClose={() => setContextMenuState(null)}
          actions={[
            {
              key: 'run',
              label: 'Run command',
              icon: <FiPlay size={14} />,
              onSelect: () => handleExecute(contextMenuState.item)
            },
            { key: 'div-0', label: '', icon: null, onSelect: () => { }, divider: true },
            {
              key: 'favorite',
              label: 'Mark as favorite',
              icon: <FiStar size={14} />,
              onSelect: () => {
                // Implementation for toggle favorite via postMessage to parent
              }
            },
            { key: 'div-1', label: '', icon: null, onSelect: () => { }, divider: true },
            {
              key: 'assign-shortcut',
              label: 'Assign command',
              icon: <FiCommand size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              onSelect: () => {
              }
            },
            {
              key: 'assign-hotkey',
              label: 'Assign hotkey',
              icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
              className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
              onSelect: () => {
              }
            },
            {
              key: 'create-todo',
              label: 'Create Todo',
              icon: <FiCheckSquare size={14} className="text-neutral-500 dark:text-neutral-400" />,
              onSelect: () => {
              }
            }
          ]}
        />
      )}
    </AnimatePresence>
  );
};

export default App;
