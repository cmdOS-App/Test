import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useGridStore } from './gridStore';
import { FiHelpCircle, FiX, FiFilter, FiPlus, FiZap, FiSearch, FiSettings, FiLayout, FiList, FiGrid } from 'react-icons/fi';
import Branding from '../Layout/Branding';
import {
  FaFilter,
  FaLock,
  FaGlobe,
  FaUsers,
  FaChevronDown,
  FaRegStar,
  FaKeyboard,
  FaAt,
  FaTimes,
  FaCheck,
  FaRobot,
  FaLink,
  FaFolder,
  FaRegFolder,
  FaCode,
  FaTerminal,
  FaBookmark,
  FaHistory,
  FaWindowRestore,
} from 'react-icons/fa';
import { BsStarFill, BsChatDots, BsGrid } from 'react-icons/bs';
import NotesIcon from '../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { TutorialCard } from '../Tutorial';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import {
  setSelectedTeam,
  selectSelectedTeam,
  navigateToView,
  setIsCommandListView,
  setHighlightedCommandId,
  setPendingLockedCommand,
  NONE_TEAM,
  selectDarkMode,
} from '../../../../Redux/AllData/uiStateSlice';
import { LuArrowRightLeft } from 'react-icons/lu';
import { exportAllTeamsToExcel } from '../../utils/exportUtils';
import type { Team } from '../../../../modals/interfaces';
import useToast from '../Shared/Toast/useToast';
import { getAvatarColor, getSingleInitial } from '../../utils/avatarColors';
import clsx from 'clsx';

interface SheetToolbarProps {
  onClose?: () => void;
  onCreateOrganization?: () => void;
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateWorkspace?: (isPersonal: boolean, access?: 'public' | 'private' | 'shareonly', targetTeamId?: string) => void;
  onOpenTutorial?: () => void;
  tutorialStep: number | null;
  setTutorialStep: (step: number | null) => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onBoardViewRedirect?: () => void;
}

interface FilterOption {
  type: 'space' | 'category' | 'visibility' | 'feature' | 'separator';
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
}

const SheetToolbar: React.FC<SheetToolbarProps> = ({
  onClose,
  onCreateOrganization,
  onOrganizationSettings,
  onCreateWorkspace,
  onOpenTutorial,
  tutorialStep,
  setTutorialStep,
  isLoggedIn,
  onRequireLogin,
  onBoardViewRedirect,
}) => {
  const {
    categoryFilter,
    setCategoryFilter,
    visibilityFilter,
    setVisibilityFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showHotkeysOnly,
    setShowHotkeysOnly,
    showShortcutsOnly,
    setShowShortcutsOnly,
    spaceFilter,
    setSpaceFilter,
    setQuickAddModal,
  } = useGridStore();
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [isFolderSubmenuOpen, setIsFolderSubmenuOpen] = useState(false);

  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isBoardHovered, setIsBoardHovered] = useState(false);
  const [isListHovered, setIsListHovered] = useState(false);
  const [isSheetHovered, setIsSheetHovered] = useState(false);
  const [autoTriggerDropdown, setAutoTriggerDropdown] = useChromeStorage<boolean>('rtq_focus_on', true);
  const [isBoardViewEnabled, setIsBoardViewEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(['new_tab_is_board_view_enabled'], (res) => {
      if (res.new_tab_is_board_view_enabled !== undefined) {
        setIsBoardViewEnabled(res.new_tab_is_board_view_enabled);
      }
    });
  }, []);

  useEffect(() => {
    if (!isViewDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  const allTeamsData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);
  const isDarkMode = useSelector(selectDarkMode);
  const triggerToast = useToast();

  const filteredTeams = allTeamsData?.filter((team: Team) => team.is_personal_space !== true) || [];

  let displayTeam = selectedTeam;
  if (selectedTeam?.is_personal_space === true) {
    if (filteredTeams.length > 0) {
      displayTeam = filteredTeams[0];
    }
  }

  const isNone = !displayTeam || displayTeam.team_id === NONE_TEAM.team_id || displayTeam.team_name === 'None';
  const orgName = isNone ? 'None' : displayTeam!.team_name;

  const [swapMenuOpen, setSwapMenuOpen] = useState<string | null>(null);

  // Handle Escape key to close popups without closing the background Sheet UI
  useEffect(() => {
    const anyOpen = menuOpen || createMenuOpen || !!swapMenuOpen || isViewDropdownOpen;
    if (!anyOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Stop propagation to prevent the background Sheet UI from closing
        e.preventDefault();
        e.stopPropagation();

        // Close our local menus
        setMenuOpen(false);
        setCreateMenuOpen(false);
        setSwapMenuOpen(null);
        setIsFolderSubmenuOpen(false);
        setIsViewDropdownOpen(false);
      }
    };

    // Use capture phase to catch the event before the background listener
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [menuOpen, createMenuOpen, swapMenuOpen, isViewDropdownOpen]);

  const handleToggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleClearAll = () => {
    setCategoryFilter(['all']);
    setVisibilityFilter(['all']);
    setSpaceFilter(['all']);
    setShowFavoritesOnly(false);
    setShowHotkeysOnly(false);
    setShowShortcutsOnly(false);
  };

  const filterOptions: FilterOption[] = [
    // Spaces
    { type: 'space', id: 'all', label: 'All Spaces', icon: <FaFilter className="text-[10px]" /> },
    {
      type: 'space' as const,
      id: 'none_org',
      label: 'Personal Space',
      icon: (
        <div className="w-3.5 h-3.5 rounded-full bg-neutral-400 flex items-center justify-center font-bold text-[6px] text-white">N</div>
      )
    },
    ...(!isNone ? [{
      type: 'space' as const,
      id: displayTeam!.team_id,
      label: displayTeam!.team_name,
      icon: (
        <div className={`w-3.5 h-3.5 rounded-full ${getAvatarColor(displayTeam!.team_name)} flex items-center justify-center font-bold text-[6px] text-white`}>
          {getSingleInitial(displayTeam!.team_name)}
        </div>
      )
    }] : []),
    // Categories
    { type: 'category' as const, id: 'all', label: 'All', icon: <FaFilter className="text-[10px]" /> },
    { type: 'category' as const, id: 'note', label: 'All Notes', icon: <NotesIcon size={14} /> },
    { type: 'category' as const, id: 'snippet', label: 'Snippets', icon: <FaCode className="text-[var(--color-iconDefault)]" size={14} /> },
    { type: 'category' as const, id: 'prompt', label: 'Prompts', icon: <FaTerminal className="text-[var(--color-iconDefault)]" size={14} /> },
    { type: 'category' as const, id: 'link', label: 'Smart Links', icon: <FaLink className="text-[var(--color-iconDefault)]" size={14} /> },
    { type: 'category' as const, id: 'bookmark', label: 'Bookmarks', icon: <FaBookmark className="text-blue-500" size={14} /> },
    { type: 'category' as const, id: 'general_commands', label: 'Commands', icon: <FaTerminal className="text-blue-400" size={14} /> },
    { type: 'category' as const, id: 'commands', label: 'Browser Commands', icon: <FaTerminal className="text-[var(--color-iconDefault)]" size={14} /> },
    {
      type: 'category' as const,
      id: 'automation',
      label: 'Saved Automations',
      icon: <FiZap className="text-amber-500" size={14} />,
    },
    {
      type: 'category' as const,
      id: 'agent',
      label: 'Chat Agents',
      icon: (
        <StackedLinkIcon
          urls={['chatgpt.com', 'gemini.google.com', 'claude.ai', 'perplexity.ai']}
          size={14}
          maxIcons={4}
        />
      ),
    },
    {
      type: 'category' as const,
      id: 'module',
      label: 'Installed Modules',
      icon: <FaRobot className="text-purple-500" size={14} />,
    },
    // Separator
    { type: 'separator' },
    // Visibility
    { type: 'visibility' as const, id: 'all', label: 'All Scopes', icon: <FaGlobe className="text-[10px]" /> },
    { type: 'visibility' as const, id: 'private', label: 'Private', icon: <FaLock className="text-[10px]" /> },
    { type: 'visibility' as const, id: 'public', label: 'Public', icon: <FaGlobe className="text-[10px]" /> },
    { type: 'visibility' as const, id: 'shared', label: 'Shared', icon: <FaUsers className="text-[10px]" /> },
    // Separator
    { type: 'separator' },
    // Features (Quick Filters)
    {
      type: 'feature' as const,
      id: 'favorites',
      label: 'Favorites',
      icon: <FaRegStar className="text-[11px]" />,
      activeIcon: <BsStarFill className="text-[11px]" />,
    },
    { type: 'feature' as const, id: 'hotkeys', label: 'Hotkeys', icon: <FaKeyboard className="text-[11px]" /> },
    { type: 'feature' as const, id: 'shortcuts', label: 'Shortcuts', icon: <FaAt className="text-[11px]" /> },
  ];

  const getActiveLabel = () => {
    const activeCategories = categoryFilter.filter(c => c !== 'all');
    const activeSpaces = spaceFilter.filter(s => s !== 'all');
    const activeVisibilities = visibilityFilter.filter(v => v !== 'all');

    if (activeCategories.length > 0) return `${activeCategories.length} Categories`;
    if (activeSpaces.length > 0) return `${activeSpaces.length} Spaces`;
    if (activeVisibilities.length > 0) return `${activeVisibilities.length} Visibility`;

    return 'All';
  };

  const isSelected = (opt: FilterOption) => {
    if (opt.type === 'space') return spaceFilter.includes(opt.id!);
    if (opt.type === 'category') return categoryFilter.includes(opt.id!);
    if (opt.type === 'visibility') return visibilityFilter.includes(opt.id!);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') return showFavoritesOnly;
      if (opt.id === 'hotkeys') return showHotkeysOnly;
      if (opt.id === 'shortcuts') return showShortcutsOnly;
    }
    return false;
  };

  const selectedFilters = filterOptions.filter((opt: FilterOption) => {
    if (opt.type === 'space') return !spaceFilter.includes('all') && spaceFilter.includes(opt.id!);
    if (opt.type === 'category') return !categoryFilter.includes('all') && categoryFilter.includes(opt.id!);
    if (opt.type === 'visibility') return !visibilityFilter.includes('all') && visibilityFilter.includes(opt.id!);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') return showFavoritesOnly;
      if (opt.id === 'hotkeys') return showHotkeysOnly;
      if (opt.id === 'shortcuts') return showShortcutsOnly;
    }
    return false;
  });

  const clearFilter = (opt: FilterOption) => {
    if (opt.type === 'space') setSpaceFilter(['all']);
    if (opt.type === 'category') setCategoryFilter(['all']);
    if (opt.type === 'visibility') setVisibilityFilter(['all']);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') setShowFavoritesOnly(false);
      if (opt.id === 'hotkeys') setShowHotkeysOnly(false);
      if (opt.id === 'shortcuts') setShowShortcutsOnly(false);
    }
  };

  const handleSelect = (opt: FilterOption) => {
    const toggleArray = (current: string[], id: string) => {
      if (id === 'all') return ['all'];
      const next = current.includes('all')
        ? [id]
        : current.includes(id)
          ? current.filter(x => x !== id)
          : [...current, id];
      return next.length === 0 ? ['all'] : next;
    };

    if (opt.type === 'space') {
      setSpaceFilter(toggleArray(spaceFilter, opt.id!));
    } else if (opt.type === 'category') {
      setCategoryFilter(toggleArray(categoryFilter, opt.id!));
    } else if (opt.type === 'visibility') {
      setVisibilityFilter(toggleArray(visibilityFilter, opt.id!));
    } else if (opt.type === 'feature') {
      if (opt.id === 'favorites') setShowFavoritesOnly(!showFavoritesOnly);
      if (opt.id === 'hotkeys') setShowHotkeysOnly(!showHotkeysOnly);
      if (opt.id === 'shortcuts') setShowShortcutsOnly(!showShortcutsOnly);
    }
  };

  return (
    <div className="w-auto flex items-center py-1.5 px-0 z-[100] relative text-inherit">
      <div className="flex items-center justify-end gap-3 ml-auto">
        {selectedFilters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap max-w-[440px]">
            {selectedFilters.map((opt: FilterOption) => (
              <button
                key={`chip-${opt.type}-${opt.id}`}
                onClick={() => clearFilter(opt)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  isDarkMode
                    ? "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                    : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                )}
                title={`Remove ${opt.label}`}>
                <FaTimes className="text-[8px] text-[var(--color-iconDefault)]" />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Settings Dropdown (replacing Board View button) */}
        <div className="relative min-[1600px]:[zoom:0.833] min-[1800px]:[zoom:0.78125]" ref={viewDropdownRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsViewDropdownOpen(!isViewDropdownOpen);
            }}
            id="sheet-toolbar-settings-btn"
            className={clsx(
              "flex items-center justify-center w-8 h-8 rounded-lg border border-white/40 dark:border-white/10 hover:border-white/60 dark:hover:border-white/20 bg-frostedwhite/90 dark:bg-neutral-900/80 backdrop-blur-md text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95"
            )}
            title="View Options"
          >
            <FiSettings size={16} />
          </button>
          
          {isViewDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-[1000]" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsViewDropdownOpen(false);
                }} 
              />
              <div className="absolute top-full right-0 mt-1.5 w-[280px] rounded-xl shadow-2xl z-[1001] p-3 flex flex-col gap-3 border border-white/10 bg-[var(--color-popupBg)] text-left">
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-semibold text-neutral-400 px-2 pb-1">
                    Board Type
                  </div>
                  <div className="flex flex-col gap-1">
                    {(() => {
                      const views = [
                        {
                          id: 'board',
                          label: 'Board View',
                          icon: FiLayout,
                          isActive: false, // In Sheet UI, so only sheet is active
                          onClick: () => {
                            window.dispatchEvent(new CustomEvent('setViewMode', { detail: 'board' }));
                            setIsBoardViewEnabled(true);
                          },
                        },
                        {
                          id: 'list',
                          label: 'List View',
                          icon: FiList,
                          isActive: false,
                          onClick: () => {
                            window.dispatchEvent(new CustomEvent('setViewMode', { detail: 'list' }));
                            setIsBoardViewEnabled(false);
                          },
                        },
                        {
                          id: 'sheet',
                          label: 'Sheet UI',
                          icon: FiGrid,
                          isActive: true,
                          onClick: () => {
                            window.dispatchEvent(new CustomEvent('setViewMode', { detail: 'sheet' }));
                          },
                        },
                      ];

                      return (
                        <>
                          {views.map(view => (
                            <div key={view.id} className="relative w-full">
                              <button
                                onClick={e => {
                                  e.preventDefault();
                                  setIsViewDropdownOpen(false);
                                  view.onClick();
                                }}
                                onMouseEnter={() => {
                                  if (view.id === 'board') setIsBoardHovered(true);
                                  if (view.id === 'list') setIsListHovered(true);
                                  if (view.id === 'sheet') setIsSheetHovered(true);
                                }}
                                onMouseLeave={() => {
                                  if (view.id === 'board') setIsBoardHovered(false);
                                  if (view.id === 'list') setIsListHovered(false);
                                  if (view.id === 'sheet') setIsSheetHovered(false);
                                }}
                                className={clsx(
                                  "flex items-center justify-between w-full px-2.5 py-2 text-xs rounded-lg transition-all font-medium cursor-pointer",
                                  view.isActive
                                    ? 'text-white bg-white/5'
                                    : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                                )}>
                                <div className="flex items-center gap-2.5">
                                  <view.icon
                                    size={16}
                                    className={view.isActive ? 'text-emerald-500' : 'text-neutral-400'}
                                  />
                                  <span>{view.label}</span>
                                  {view.id === 'board' && (
                                    <span className="text-[9px] font-medium bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-white/5">
                                      Suggested
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-center shrink-0">
                                  {view.isActive ? (
                                    <div className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-neutral-600" />
                                  )}
                                </div>
                              </button>

                              {view.id === 'board' && isBoardHovered && (
                                <TutorialCard
                                  isVisible={isBoardHovered}
                                  onClose={() => setIsBoardHovered(false)}
                                  direction="right"
                                  type="board_view"
                                  title="Board View"
                                  description="A multi-column layout that displays your workspaces, folders, and resources side-by-side for ultra-fast visual access."
                                  hideNavigation={true}
                                  width="w-[380px]"
                                  className="mr-3"
                                  arrowTopClass="top-[38px]"
                                />
                              )}

                              {view.id === 'list' && isListHovered && (
                                <TutorialCard
                                  isVisible={isListHovered}
                                  onClose={() => setIsListHovered(false)}
                                  direction="right"
                                  type="list_view"
                                  title="List View"
                                  description="A clean, single-column vertical layout designed for focused browsing and scrolling."
                                  hideNavigation={true}
                                  width="w-[380px]"
                                  className="mr-3"
                                  arrowTopClass="top-[38px]"
                                />
                              )}

                              {view.id === 'sheet' && isSheetHovered && (
                                <TutorialCard
                                  isVisible={isSheetHovered}
                                  onClose={() => setIsSheetHovered(false)}
                                  direction="right"
                                  type="sheet_ui"
                                  title="Sheet UI"
                                  description="A tabular, spreadsheet-style interface designed for advanced workspace management, sorting, and automation building."
                                  hideNavigation={true}
                                  width="w-[380px]"
                                  className="mr-3"
                                  arrowTopClass="top-[38px]"
                                />
                              )}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="h-[1px] bg-white/5" />

                <div className="flex flex-col gap-2 px-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">Command-first search</span>
                      <span className="text-[9px] font-medium bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-white/5">Suggested</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAutoTriggerDropdown(!autoTriggerDropdown);
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${autoTriggerDropdown ? 'bg-emerald-500' : 'bg-neutral-600'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${autoTriggerDropdown ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-neutral-400 leading-normal">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    <div className="flex flex-col gap-1">
                      <span>Clicking search opens command-first results so you can narrow choices faster.</span>
                      <span className="text-[9px] text-neutral-500">Turn off to use normal search results.</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Plus Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              if (isLoggedIn === false && onRequireLogin) {
                onRequireLogin();
                return;
              }
              setCreateMenuOpen(!createMenuOpen);
              if (createMenuOpen) setIsFolderSubmenuOpen(false); // Reset submenu on close
            }}
            id="sheet-toolbar-add-btn"
            className={clsx(
              "flex items-center justify-center p-1.5 rounded-md transition-all active:scale-95 border",
              tutorialStep === 1
                ? "border-[#22c55e]"
                : "border-transparent",
              isDarkMode
                ? "text-[var(--color-iconDefault)] hover:text-neutral-200 bg-[#000000]"
                : "text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100"
            )}
            title="Create new...">
            <FiPlus size={14} />
          </button>

          {createMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setCreateMenuOpen(false);
                  setIsFolderSubmenuOpen(false);
                }}
              />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-44 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.1)] z-[9999] p-1 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5 border bg-[var(--color-popupBg)] border-white/10">

                <button
                  onClick={() => setIsFolderSubmenuOpen(!isFolderSubmenuOpen)}
                  className={clsx(
                    "flex items-center justify-between w-full px-2 py-1 text-[11px] rounded-md transition-all text-left font-medium group",
                    isDarkMode ? "text-neutral-300 hover:bg-neutral-900 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 flex justify-center shrink-0">
                      <FaFolder size={11} className="text-[var(--color-iconDefault)]" />
                    </div>
                    <span>Create Folder</span>
                  </div>
                  <FaChevronDown
                    className={clsx(
                      'text-[8px] transition-all duration-200',
                      isFolderSubmenuOpen ? 'rotate-180 opacity-100' : 'opacity-0 group-hover:opacity-100',
                    )}
                  />
                </button>

                {isFolderSubmenuOpen && (
                  <div className={clsx(
                    "ml-2 border-l-2 pl-1 flex flex-col gap-0.5 mt-0.5 mb-1 animate-in slide-in-from-top-1 duration-150",
                    isDarkMode ? "border-white/10" : "border-slate-100"
                  )}>
                    <button
                      onClick={() => {
                        setCreateMenuOpen(false);
                        setIsFolderSubmenuOpen(false);
                        if (onCreateWorkspace) {
                          onCreateWorkspace(true, 'private');
                        } else {
                          triggerToast('Workspace creation handler not ready.', 'warning');
                        }
                      }}
                      className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] text-slate-500 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-all text-left font-medium">
                      <div className="w-5 flex justify-center shrink-0">
                        <FaRegFolder className="text-[var(--color-iconDefault)] text-[10px]" />
                      </div>
                      <span>Personal Folder</span>
                    </button>
                    <button
                      onClick={() => {
                        setCreateMenuOpen(false);
                        setIsFolderSubmenuOpen(false);
                        if (onCreateWorkspace) {
                          onCreateWorkspace(false, 'public');
                        } else {
                          triggerToast('Workspace creation handler not ready.', 'warning');
                        }
                      }}
                      className={clsx(
                        "flex items-center gap-1.5 w-full px-2 py-1 text-[10px] rounded-md transition-all text-left font-medium",
                        isDarkMode ? "text-neutral-400 hover:bg-neutral-900 hover:text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      )}>
                      <div className="w-5 flex justify-center shrink-0">
                        <FaFolder className="text-[var(--color-iconDefault)]" size={10} />
                      </div>
                      <span>Org Level Folder</span>
                    </button>
                  </div>
                )}

                <div className={clsx("h-px my-0.5 mx-1", "bg-[var(--color-borderDefault)]")} />

                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    // Use the centralized handler if available, otherwise fallback to direct dispatch
                    if (onCreateOrganization) {
                      onCreateOrganization();
                    } else {
                      dispatch(navigateToView({ kind: 'createOrganization' }));
                    }
                    onClose?.();
                  }}
                  className={clsx(
                    "flex items-center gap-1.5 w-full px-2 py-1 text-[11px] rounded-md transition-all text-left font-medium",
                    isDarkMode ? "text-neutral-400 hover:bg-neutral-900 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}>
                  <div className="w-6 flex justify-center shrink-0">
                    <FaUsers className="text-[var(--color-iconDefault)]" size={11} />
                  </div>
                  <span>Create Organization</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Unified Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              if (isLoggedIn === false && onRequireLogin) {
                onRequireLogin();
                return;
              }
              handleToggleMenu();
            }}
            id="sheet-toolbar-filter-btn"
            className={clsx(
              'flex items-center justify-center p-1.5 rounded-md transition-all border',
              tutorialStep === 2
                ? 'border-[#22c55e]'
                : 'border-transparent',
              !categoryFilter.includes('all') ||
                !visibilityFilter.includes('all') ||
                !spaceFilter.includes('all') ||
                showFavoritesOnly ||
                showHotkeysOnly ||
                showShortcutsOnly
                ? isDarkMode
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-blue-50 text-blue-600'
                : isDarkMode
                  ? 'bg-[#000000] text-[var(--color-iconDefault)] hover:text-neutral-200'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
            )}>
            <FiFilter
              size={12}
              className={
                !categoryFilter.includes('all') ||
                  !visibilityFilter.includes('all') ||
                  !spaceFilter.includes('all') ||
                  showFavoritesOnly ||
                  showHotkeysOnly ||
                  showShortcutsOnly
                  ? 'text-blue-500'
                  : 'text-[var(--color-iconDefault)]'
              }
            />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-1.5 w-[800px] border rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.3)] z-[9999] p-0.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 bg-[var(--color-popupBg)] border-white/10">
                <div className="flex gap-0.5 p-2 h-full bg-[var(--color-popupBg)]">
                  {/* Space Column */}
                  <div className="flex-[1.1] px-1.5">
                    <div className={clsx(
                      "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5",
                      isDarkMode ? "text-neutral-500 border-white/5" : "text-slate-400 border-slate-50"
                    )}>
                      Spaces
                    </div>
                    <div className="space-y-0">
                      {filterOptions
                        .filter(o => o.type === 'space')
                        .map(opt => {
                          const active = isSelected(opt);
                          return (
                            <div
                              key={`${opt.type}-${opt.id}`}
                              onClick={() => handleSelect(opt)}
                              className={clsx(
                                'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                active
                                  ? isDarkMode ? 'bg-blue-900/20 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-700 font-semibold'
                                  : isDarkMode ? 'text-neutral-400 hover:bg-neutral-900 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                              )}>
                              <div
                                className={clsx(
                                  'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                  active
                                    ? 'bg-blue-600 border-blue-600'
                                    : isDarkMode ? 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-600' : 'border-slate-300 bg-white group-hover:border-slate-400',
                                )}>
                                {active && <FaCheck className="text-white text-[7px]" />}
                              </div>
                              <span
                                className={clsx(
                                  'w-4.5 flex justify-center text-[13px]',
                                  active ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : (isDarkMode ? 'text-neutral-500 group-hover:text-neutral-400' : 'text-slate-400 group-hover:text-slate-500'),
                                )}>
                                {opt.icon}
                              </span>
                              <span className="truncate flex-1 text-left">{opt.label}</span>

                              {/* Organization Settings & Swap Organization Features */}
                              {opt.type === 'space' && opt.label !== 'All Spaces' && opt.id !== 'none_org' && (
                                <div className="flex items-center ml-1 shrink-0 relative gap-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (onOrganizationSettings && opt.id) {
                                        onClose?.();
                                        onOrganizationSettings(opt.id, opt.label || '');
                                        setMenuOpen(false);
                                      }
                                    }}
                                    className={clsx(
                                      "transition-colors shrink-0 cursor-pointer p-1 rounded hover:bg-black/5 dark:hover:bg-white/10",
                                      isDarkMode ? "text-neutral-500 hover:text-blue-400" : "text-slate-400 hover:text-blue-600"
                                    )}
                                    title="Organization Settings"
                                  >
                                    <FiSettings size={13} />
                                  </button>

                                  <div
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSwapMenuOpen(swapMenuOpen === opt.id ? null : (opt.id ?? null));
                                    }}
                                    className={clsx(
                                      "transition-colors shrink-0 cursor-pointer p-1 rounded hover:bg-black/5 dark:hover:bg-white/10",
                                      isDarkMode ? "text-neutral-600 hover:text-blue-400" : "text-slate-400 hover:text-blue-600"
                                    )}
                                    title="Swap Organization"
                                  >
                                    <LuArrowRightLeft size={13} />
                                  </div>

                                  {swapMenuOpen === opt.id && (
                                    <>
                                      <div className="fixed inset-0 z-[1000]" onClick={(e) => { e.stopPropagation(); setSwapMenuOpen(null); }} />
                                      <div className="absolute top-0 left-full ml-2 w-48 max-h-[300px] overflow-y-auto border rounded-lg shadow-xl z-[1001] p-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-left-2 duration-150 custom-scrollbar bg-[var(--color-popupBg)] border-white/10">
                                        <div className={clsx(
                                          "px-2 py-1 text-[9px] font-bold uppercase tracking-wider border-b mb-0.5",
                                          isDarkMode ? "text-neutral-500 border-white/5" : "text-slate-400 border-slate-50"
                                        )}>
                                          Switch Organization
                                        </div>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const personalTeam = allTeamsData?.find((t: any) => t.is_personal_space);
                                            dispatch(setSelectedTeam(personalTeam || NONE_TEAM));
                                            setSwapMenuOpen(null);
                                          }}
                                          className={clsx(
                                            "flex items-center gap-2 w-full px-2 py-1.5 text-[11px] rounded-md transition-all text-left font-medium",
                                            isDarkMode ? "text-neutral-400 hover:bg-neutral-900 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                          )}
                                        >
                                          <div className={clsx(
                                            "w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px]",
                                            isDarkMode ? "bg-neutral-800 text-neutral-400" : "bg-neutral-200 text-neutral-500"
                                          )}>P</div>
                                          <span>Personal Space</span>
                                        </button>

                                        {filteredTeams
                                          .filter(t => t.team_id !== displayTeam?.team_id)
                                          .map(team => (
                                            <button
                                              key={team.team_id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                dispatch(setSelectedTeam(team));
                                                setSwapMenuOpen(null);
                                              }}
                                              className={clsx(
                                                "flex items-center gap-2 w-full px-2 py-1.5 text-[11px] rounded-md transition-all text-left font-medium",
                                                isDarkMode ? "text-neutral-400 hover:bg-neutral-900 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                              )}
                                            >
                                              <div className={`w-4 h-4 rounded-full ${getAvatarColor(team.team_name)} flex items-center justify-center font-bold text-[8px] text-white`}>
                                                {getSingleInitial(team.team_name)}
                                              </div>
                                              <span className="truncate flex-1">{team.team_name}</span>
                                            </button>
                                          ))}

                                        {filteredTeams.filter(t => t.team_id !== displayTeam?.team_id).length === 0 && isNone && (
                                          <div className="px-2 py-2 text-[11px] text-slate-400 italic text-center">No other organizations</div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className={clsx("w-px my-1.5", "bg-[var(--color-borderDefault)]")} />

                  {/* Category Column */}
                  <div className="flex-[1.4] px-1.5">
                    <div className={clsx(
                      "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5",
                      isDarkMode ? "text-neutral-500 border-white/5" : "text-slate-400 border-slate-50"
                    )}>
                      Categories
                    </div>
                    <div className="space-y-0">
                      {filterOptions
                        .filter(o => o.type === 'category')
                        .map(opt => {
                          const active = isSelected(opt);
                          return (
                            <div
                              key={`${opt.type}-${opt.id}`}
                              onClick={() => handleSelect(opt)}
                              className={clsx(
                                'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                active
                                  ? isDarkMode ? 'bg-blue-900/20 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-700 font-semibold'
                                  : isDarkMode ? 'text-neutral-400 hover:bg-neutral-900 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                              )}>
                              <div
                                className={clsx(
                                  'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                  active
                                    ? 'bg-blue-600 border-blue-600'
                                    : isDarkMode ? 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-600' : 'border-slate-300 bg-white group-hover:border-slate-400',
                                )}>
                                {active && <FaCheck className="text-white text-[7px]" />}
                              </div>
                              <span
                                className={clsx(
                                  'w-4.5 flex justify-center text-[13px]',
                                  active ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : (isDarkMode ? 'text-neutral-500 group-hover:text-neutral-400' : 'text-slate-400 group-hover:text-slate-500'),
                                )}>
                                {opt.icon}
                              </span>
                              <span className="whitespace-nowrap flex-1 text-left">{opt.label}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className={clsx("w-px my-1.5", "bg-[var(--color-borderDefault)]")} />

                  {/* Visibility Column */}
                  <div className="flex-[1.1] px-1.5">
                    <div className={clsx(
                      "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5",
                      isDarkMode ? "text-neutral-500 border-white/5" : "text-slate-400 border-slate-50"
                    )}>
                      Visibility
                    </div>
                    <div className="space-y-0">
                      {filterOptions
                        .filter(o => o.type === 'visibility')
                        .map(opt => {
                          const active = isSelected(opt);
                          return (
                            <div
                              key={`${opt.type}-${opt.id}`}
                              onClick={() => handleSelect(opt)}
                              className={clsx(
                                'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                active
                                  ? isDarkMode ? 'bg-blue-900/20 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-700 font-semibold'
                                  : isDarkMode ? 'text-neutral-400 hover:bg-neutral-900 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                              )}>
                              <div
                                className={clsx(
                                  'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                  active
                                    ? 'bg-blue-600 border-blue-600'
                                    : isDarkMode ? 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-600' : 'border-slate-300 bg-white group-hover:border-slate-400',
                                )}>
                                {active && <FaCheck className="text-white text-[7px]" />}
                              </div>
                              <span
                                className={clsx(
                                  'w-4.5 flex justify-center text-[13px]',
                                  active ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : (isDarkMode ? 'text-neutral-500 group-hover:text-neutral-400' : 'text-slate-400 group-hover:text-slate-500'),
                                )}>
                                {opt.icon}
                              </span>
                              <span className="whitespace-nowrap flex-1 text-left">{opt.label}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className={clsx("w-px my-1.5", "bg-[var(--color-borderDefault)]")} />

                  {/* Quick Filters Column */}
                  <div className="flex-[1.2] px-1.5 relative">
                    <div className={clsx(
                      "px-1.5 pb-1.5 text-[11px] font-bold border-b mb-1.5 flex items-center justify-between",
                      isDarkMode ? "text-neutral-500 border-white/5" : "text-slate-400 border-slate-50"
                    )}>
                      <span>Quick Filters</span>
                      <button
                        onClick={() => setMenuOpen(false)}
                        className={clsx(
                          "p-1 rounded transition-colors -my-1 flex items-center justify-center",
                          isDarkMode ? "text-[var(--color-iconDefault)] hover:text-white hover:bg-neutral-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                        )}
                        title="Close (ESC)"
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                    <div className="space-y-0">
                      {filterOptions
                        .filter(o => o.type === 'feature')
                        .map(opt => {
                          const active = isSelected(opt);
                          return (
                            <div
                              key={`${opt.type}-${opt.id}`}
                              onClick={() => handleSelect(opt)}
                              className={clsx(
                                'flex items-center gap-2 w-full px-1.5 py-1 text-[12px] rounded-md transition-all group relative cursor-pointer',
                                active
                                  ? isDarkMode ? 'bg-blue-900/20 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-700 font-semibold'
                                  : isDarkMode ? 'text-[var(--color-iconDefault)] hover:bg-neutral-900 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                              )}>
                              <div
                                className={clsx(
                                  'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-200',
                                  active
                                    ? isDarkMode ? 'bg-blue-500 border-blue-500' : 'bg-blue-600 border-blue-600'
                                    : isDarkMode ? 'border-neutral-700 bg-[#000000] group-hover:border-neutral-600' : 'border-slate-300 bg-white group-hover:border-slate-400',
                                )}>
                                {active && <FaCheck className="text-white text-[7px]" />}
                              </div>
                              <span
                                className={clsx(
                                  'w-4.5 flex justify-center text-[13px]',
                                  active ? '' : (isDarkMode ? 'text-[var(--color-iconDefault)] group-hover:text-neutral-400' : 'text-slate-400 group-hover:text-slate-500'),
                                )}>
                                {active && opt.activeIcon ? opt.activeIcon : opt.icon}
                              </span>
                              <span className="whitespace-nowrap flex-1 text-left">{opt.label}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 border-t border-white/10 bg-[var(--color-popupBg)]">
                  <button
                    onClick={handleClearAll}
                    className={clsx(
                      "text-[11px] font-medium transition-colors px-2 py-1 rounded flex items-center gap-1.5",
                      isDarkMode ? "text-[var(--color-iconDefault)] hover:text-neutral-200 hover:bg-neutral-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    )}>
                    <FaTimes className="text-[9px]" />
                    Clear all
                  </button>
                  <div className={clsx(
                    "flex items-center gap-1.5 text-[11px] mr-1",
                    isDarkMode ? "text-[var(--color-iconDefault)]" : "text-slate-400"
                  )}>
                    <span>Press</span>
                    <kbd className={clsx(
                      "px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border shadow-sm",
                      isDarkMode ? "bg-neutral-800 border-neutral-700 text-neutral-300" : "bg-white border-slate-200 text-slate-600"
                    )}>ESC</kbd>
                    <span>to close</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Close Button Section */}
        {onClose && (
          <div className="flex items-center gap-1.5 ml-0.5">
            <div className="h-4 w-px bg-[var(--color-borderDefault)] mx-1 shrink-0 self-center" />
            <button
              onClick={onOpenTutorial}
              className={clsx(
                "p-1.5 rounded-md transition-colors focus:outline-none flex items-center justify-center",
                isDarkMode ? "text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10" : "text-slate-400 hover:text-blue-500 hover:bg-blue-50"
              )}
              aria-label="Help"
              title="Open Tutorial">
              <FiHelpCircle size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors focus:outline-none flex items-center justify-center"
              aria-label="Close"
              title="Close">
              <FiX size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SheetToolbar;
