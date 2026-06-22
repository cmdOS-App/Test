import React, { useEffect, useMemo } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import clsx from 'clsx';
import SheetTable from './SheetTable';
import { useGridStore } from './gridStore';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, fetchAllDataThunk } from '../../../../Redux/AllData/allDataSlice';
import { readAllHotkeys, readAllShortcuts } from '../Shared/utils/hotkeyUtils';
import SaveDestinationPicker from '../Editor/SaveDestinationPicker';
import { selectSelectedTeam, selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';

import SheetToolbar from './SheetToolbar';
import GridQuickAddModal from './GridQuickAddModal';
import TutorialCard from '../Tutorial/TutorialCard';
import Branding from '../Layout/Branding';
import { getAvatarColor, getSingleInitial } from '../../utils/avatarColors';
import { setSelectedTeam } from '../../../../Redux/AllData/uiStateSlice';

interface SheetUIProps {
  onClose?: () => void;
  savedAutomations?: any[];
  savedAgents?: any[];
  installedModules?: any[];
  onCreateOrganization?: () => void;
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateWorkspace?: (isPersonal: boolean, access?: 'public' | 'private' | 'shareonly', targetTeamId?: string) => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onBoardViewRedirect?: () => void;
}

const SheetUI: React.FC<SheetUIProps> = ({
  onClose,
  savedAutomations = [],
  savedAgents = [],
  installedModules = [],
  onCreateOrganization,
  onOrganizationSettings,
  onCreateWorkspace,
  isLoggedIn,
  onRequireLogin,
  onBoardViewRedirect,
}) => {
  const allData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);
  const syncRealNotes = useGridStore(state => state.syncRealNotes);
  const { isPickerOpen, pickerRowIndex, closePicker, updateRowLocation, openPicker, searchTerm, setSearchTerm, setSelectedCell } = useGridStore();
  const dispatch = useDispatch<any>();
  const isDarkMode = useSelector(selectDarkMode);
  const [bookmarks, setBookmarks] = React.useState<any[]>([]);
  const [tutorialStep, setTutorialStep] = React.useState<number | null>(null);
  const [cardPos, setCardPos] = React.useState<{ top: number; left: number; right?: number } | null>(null);

  React.useEffect(() => {
    if (tutorialStep === null) {
      setCardPos(null);
      return;
    }

    const updatePosition = () => {
      const ids = ['sheet-search-wrapper', 'sheet-toolbar-add-btn', 'sheet-toolbar-filter-btn'];
      const targetId = ids[tutorialStep];
      const el = document.getElementById(targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Focus the search input if step is 0
        if (tutorialStep === 0) {
          const inputEl = document.getElementById('sheet-search-name');
          if (inputEl instanceof HTMLElement) {
            inputEl.focus();
          }
        } else if (el instanceof HTMLElement) {
          el.focus();
        }

        const container = document.getElementById('sheet-ui-container');
        if (container) {
          const cRect = container.getBoundingClientRect();
          const computedZoom = window.getComputedStyle(container).zoom;
          const zoom = parseFloat(computedZoom) || 1;

          if (tutorialStep === 0) {
            // Pointing to Search Input (from top)
            // Center horizontally, position below the element
            setCardPos({
              top: (rect.bottom - cRect.top + 10) / zoom,
              left: (rect.left - cRect.left + rect.width / 2) / zoom,
            });
          } else {
            // Pointing to Toolbar buttons (from right)
            // Align vertically with center, position to the left of the element
            setCardPos({
              top: (rect.top - cRect.top + rect.height / 2) / zoom,
              left: (rect.left - cRect.left - 10) / zoom,
            });
          }
        }
      }
    };

    // Recalculate position on window resize for perfect alignment
    window.addEventListener('resize', updatePosition);

    // Stable delay to ensure render and layout are completely settled
    const timer = setTimeout(updatePosition, 250);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [tutorialStep]);

  const [favs, setFavs] = React.useState<Record<string, any[]>>({});
  const [userId, setUserId] = React.useState<string>('');
  const [hotkeys, setHotkeys] = React.useState<Record<string, string>>({});
  const [shortcuts, setShortcuts] = React.useState<Record<string, string>>({});

  // Memoize Org and Personal data for the Picker
  const orgTeam = useMemo(() => {
    if (selectedTeam && selectedTeam.is_personal_space !== true) return selectedTeam;
    return allData?.find(t => t.is_personal_space !== true) || null;
  }, [selectedTeam, allData]);

  const personalWorkspaces = useMemo(() => {
    const pTeam = allData?.find(t => t.is_personal_space === true || t.team_name === 'Personal Space');
    return pTeam?.workspaces || [];
  }, [allData]);

  // 1. Initial Load of Favorites, Hotkeys and Shortcuts
  useEffect(() => {
    chrome.storage.local.get('myFavouriteItems', result => {
      setFavs(result.myFavouriteItems || {});
    });

    // Moved loadKeys to a separate useEffect that depends on isLoggedIn

    // Fetch Bookmarks
    const flattenBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[], result: any[] = []) => {
      nodes.forEach(node => {
        if (node.url) {
          result.push(node);
        }
        if (node.children) {
          flattenBookmarks(node.children, result);
        }
      });
      return result;
    };

    const loadBookmarks = () => {
      chrome.bookmarks?.getTree?.(tree => {
        const flattened = flattenBookmarks(tree);
        setBookmarks(flattened);
      });
    };

    loadBookmarks();

    if (chrome.bookmarks?.onRemoved) {
      chrome.bookmarks.onRemoved.addListener(loadBookmarks);
      chrome.bookmarks.onCreated.addListener(loadBookmarks);
      chrome.bookmarks.onChanged.addListener(loadBookmarks);
    }

    // 🚀 Handle click outside to clear all focus/selection
    const handleOutsideClick = (e: MouseEvent) => {
      const container = document.getElementById('sheet-ui-container');
      if (container && !container.contains(e.target as Node)) {
        const store = useGridStore.getState();
        store.setSelectedCell(null);
        store.setEditingCell(null);

        // Force blur any active elements to ensure focus is truly gone
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('mousedown', handleOutsideClick, true); // Use capture phase
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, []);

  // 1.5 Load Keys
  useEffect(() => {
    let isMounted = true;

    const loadKeys = async () => {
      try {
        const u = await import('../../../../Apis/core/api').then(m => m.getUserId());
        const [h, s] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
        if (isMounted) {
          setUserId(u || 'local_user');
          setHotkeys(h);
          setShortcuts(s);
        }
      } catch (e) {
        console.warn('Initial load keys failed:', e);
      }
    };
    loadKeys();

    if (!allData) dispatch(fetchAllDataThunk());

    return () => { isMounted = false; };
  }, [isLoggedIn]); // removed allData and dispatch to prevent unnecessary refetches

  // 2. Real-time Monitor
  useEffect(() => {
    const handleStorageChange = (changes: any, namespace: string) => {
      if (namespace === 'local') {
        if (changes.myFavouriteItems) {
          setFavs(changes.myFavouriteItems.newValue || {});
        }

        const keyRelated = [
          'alts_command_hotkeys',
          'alts_link_hotkeys',
          'alts_note_hotkeys',
          'alts_automation_hotkeys',
          'alts_automation_shortcuts',
          'alts_module_hotkeys',
          'note_commands',
          'link_commands',
        ];
        if (keyRelated.some(k => changes[k])) {
          const reloadKeys = async () => {
            const [h, s] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
            setHotkeys(h);
            setShortcuts(s);
          };
          reloadKeys();
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // 3. Sync Logic
  useEffect(() => {
    if (allData && userId) {
      syncRealNotes(
        allData,
        userId,
        selectedTeam?.team_id || null,
        favs,
        hotkeys,
        shortcuts,
        savedAutomations,
        savedAgents,
        installedModules,
        bookmarks,
      );
    }
  }, [
    allData,
    userId,
    selectedTeam,
    favs,
    hotkeys,
    shortcuts,
    syncRealNotes,
    savedAutomations,
    savedAgents,
    installedModules,
    bookmarks,
  ]);

  const pickerRow = pickerRowIndex !== null ? useGridStore.getState().tableData[pickerRowIndex] : null;

  const handleOpenTutorial = async () => {
    setTutorialStep(0);
  };

  const handleCloseTutorial = () => {
    setTutorialStep(null);
  };

  const handleNextStep = (step: number) => {
    if (step < 2) {
      setTutorialStep(step + 1);
    } else {
      handleCloseTutorial();
    }
  };

  return (
    <div
      id="sheet-ui-container"
      className="flex h-full w-full overflow-hidden border border-white/10 rounded-t-2xl border-b-0 relative flex-col min-[1600px]:[zoom:1.2] min-[1800px]:[zoom:1.28] bg-[var(--color-appBg)] text-white mb-0 shadow-2xl"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Absolute positioned Toolbar at the top right */}
      <div className="absolute top-3 right-6 z-[200]">
        <SheetToolbar
          onClose={onClose}
          onCreateOrganization={onCreateOrganization}
          onOrganizationSettings={onOrganizationSettings}
          onCreateWorkspace={onCreateWorkspace}
          onOpenTutorial={handleOpenTutorial}
          tutorialStep={tutorialStep}
          setTutorialStep={setTutorialStep}
          isLoggedIn={isLoggedIn}
          onRequireLogin={onRequireLogin}
          onBoardViewRedirect={onBoardViewRedirect}
        />
      </div>

      {/* Standalone Search Bar left-aligned with the table */}
      <div className="w-full max-w-[924px] mx-auto pt-[10vh] pb-4 pl-6 pr-3 flex-shrink-0 relative z-50">
        <div className="w-full max-w-[420px]">
          <div
            id="sheet-search-wrapper"
            className={clsx(
              "w-full flex flex-start px-3 gap-2.5 rounded-md border shadow-none transition-colors items-center",
              "min-h-[36px] min-[1680px]:min-h-[40px] min-[1880px]:min-h-[44px]",
              tutorialStep === 0
                ? "border-[#22c55e]"
                : "border-white/80",
              "bg-[var(--color-inputBg)] text-neutral-200"
            )}
          >
            <div className="flex items-center justify-center shrink-0">
              <FaSearch size={13} className="text-[var(--color-iconDefault)]" />
            </div>
            <input
              id="sheet-search-name"
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search "
              className={clsx(
                "flex-1 bg-transparent font-medium outline-none border-none",
                "text-[14px] min-[1680px]:text-[15px] min-[1880px]:text-[16px]",
                "text-neutral-200 placeholder:text-neutral-400"
              )}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={clsx(
                  "p-1 rounded-md transition-colors",
                  "text-[var(--color-iconDefault)] hover:text-white hover:bg-white/10"
                )}
                title="Clear search"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tutorial Cards - Dynamic Positioning */}
      {tutorialStep !== null && cardPos && (
        <div className="absolute inset-0 z-[10000] pointer-events-none overflow-hidden">
          <div
            className="absolute pointer-events-auto transition-all duration-300"
            style={{
              top: cardPos.top,
              left: tutorialStep === 0 ? cardPos.left - 260 : undefined,
              right: tutorialStep !== 0 ? `calc(100% - ${cardPos.left}px)` : undefined,
              transform: tutorialStep === 0 ? 'none' : 'translateY(-50%)',
            }}>
            {tutorialStep === 0 && (
              <TutorialCard
                isVisible={true}
                stepIndex={0}
                totalSteps={3}
                title="Advanced Searchbar"
                description="Instantly search and filter items across your entire dashboard."
                type="sheet_search"
                direction="top"
                onNext={() => handleNextStep(0)}
                onClose={handleCloseTutorial}
                features={[
                  { title: 'Real-Time Filtering', desc: 'Filters notes, links, automations, and commands as you type.' },
                  { title: 'Deep Search', desc: 'Matches names, descriptions, commands, paths, hotkeys, and shortcuts.' },
                  { title: 'Quick Navigation', desc: 'Press Alt+S to focus the input. Use Arrow keys to navigate rows.' },
                ]}
              />
            )}

            {tutorialStep === 1 && (
              <TutorialCard
                isVisible={true}
                stepIndex={1}
                totalSteps={3}
                title="Create New Items"
                description="Quickly add new resources to your personal or organization workspace."
                type="sheet_add"
                direction="right"
                onNext={() => handleNextStep(1)}
                onClose={handleCloseTutorial}
                features={[
                  { title: 'Create Content', desc: 'Add Smart Links, Notes, Snippets, or AI Prompts in a single click.' },
                  { title: 'Workflows & Agents', desc: 'Build custom automations or configure a new chat agent.' },
                  { title: 'Folders & Orgs', desc: 'Create personal/organization folders or set up new organizations.' },
                ]}
              />
            )}

            {tutorialStep === 2 && (
              <TutorialCard
                isVisible={true}
                stepIndex={2}
                totalSteps={3}
                title="Powerful Filters"
                description="Narrow down your workspace items by type, visibility, or status."
                type="sheet_filter"
                direction="right"
                onNext={() => handleNextStep(2)}
                onClose={handleCloseTutorial}
                features={[
                  { title: 'Spaces & Categories', desc: 'Filter by Personal vs Org space, or by specific item categories.' },
                  { title: 'Visibility Scopes', desc: 'Toggle views to show Private, Public, or Shared items.' },
                  { title: 'Quick Filters', desc: 'Filter down instantly to only show your Favorites, Hotkeys, or Shortcuts.' },
                ]}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex-1 w-full  overflow-hidden relative z-0 flex flex-col">
        <div className="flex-1 w-full max-w-[924px] mx-auto overflow-auto pl-6 pr-3 custom-scrollbar dark-scrollbar scroll-pt-[57px]">
          <SheetTable
            orgTeam={orgTeam}
            personalWorkspaces={personalWorkspaces}
            onClose={onClose}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
          />
        </div>
      </div>

      <GridQuickAddModal />
    </div>
  );
};

export default SheetUI;

