import React, { useState, useMemo } from 'react';
import type { SortingState, ColumnSizingState } from '@tanstack/react-table';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllData, optimisticUpdateAutomation } from '../../../../Redux/AllData/allDataSlice';
import type { RowData, GridRow, AutomationModuleRow } from './types';
import { columns } from './columns';
import SheetHeader from './SheetHeader';
import { updateAutomation } from '../../../../Apis/core/api';
import { clsx } from 'clsx';
import {
  selectDarkMode,
  navigateToView,
  setIsCommandListView,
  setHighlightedCommandId,
  setPendingLockedCommand,
  setShowTodosView,
  setTodoCreatePrefill,
} from '../../../../Redux/AllData/uiStateSlice';
import { useGridStore } from './gridStore';
import {
  FaPlus,
  FaTrash,
  FaLock,
  FaGlobe,
  FaUsers,
  FaUser,
  FaStar,
  FaLink,
  FaFileAlt,
  FaCode,
  FaTerminal,
  FaTrashAlt,
  FaCheck,
  FaRobot,
  FaBookmark,
} from 'react-icons/fa';

import { BsPersonFill, BsPeopleFill, BsHourglassSplit } from 'react-icons/bs';
import { MdLockOutline } from 'react-icons/md';
import {
  FiStar,
  FiCheck,
  FiGlobe,
  FiFilter,
  FiExternalLink,
  FiUsers,
  FiLock,
  FiPlus,
  FiLoader,
  FiChevronRight,
  FiChevronDown,
  FiBox,
  FiZap,
  FiSearch,
  FiTrash,
} from 'react-icons/fi';

import { LuSparkles, LuPlus } from 'react-icons/lu';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { motion, AnimatePresence } from 'framer-motion';
import NotesIcon from '../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import AutomationDynamicIcon from '../Shared/Icons/AutomationDynamicIcon';
import { GridHotkeyInput, GridCommandInput } from './GridShortcutInputs';
import { GridMultiLinkInput } from './GridMultiLinkInput';
import { GridAutomationStepInput } from './GridAutomationStepInput';
import SaveDestinationPicker from '../Editor/SaveDestinationPicker';
import { VisualKeyDisplay } from '../Shared/VisualKeyDisplay';

import { getItemCompoundId, readAllHotkeys, readAllShortcuts } from '../Shared/utils/hotkeyUtils';
import { BsCalendarCheck } from 'react-icons/bs';
import { UnifiedContextMenu, type MenuAction } from '../Shared/UnifiedContextMenu';

// Helper to resolve icon strings to emojis
const resolveIcon = (iconStr: string | null | undefined, defaultEmoji: string) => {
  if (!iconStr) return defaultEmoji;
  if (iconStr.startsWith('U+')) {
    try {
      return String.fromCodePoint(parseInt(iconStr.replace('U+', ''), 16));
    } catch (e) {
      return defaultEmoji;
    }
  }
  return defaultEmoji;
};

// Helper to resolve param configs from cloud metadata
const resolveParamConfigs = (data: any) => {
  if (!data) return undefined;

  // 🚀 PERFORMANCE: If we already have paramConfigs and no split config, just return it
  // to avoid creating new objects on every render.
  if (data.paramConfigs && !data.variables && !data.input_split_config) {
    return data.paramConfigs;
  }

  const configs: Record<string, any> = {};
  // ... rest of the logic
  // (I'll actually just implement a simple check)

  if (Array.isArray(data.variables)) {
    data.variables.forEach((v: any) => {
      configs[v.key] = { type: v.type, values: v.options, label: v.label };
    });
  }

  if (data.input_split_config?.split_fields) {
    data.input_split_config.split_fields.forEach((f: any) => {
      configs[f.key] = { type: f.type, values: f.options, label: f.label };
    });
  }

  if (data.paramConfigs) {
    Object.entries(data.paramConfigs).forEach(([key, conf]: [string, any]) => {
      const isCollectionType = conf.type === 'dropdown' || conf.type === 'search_dropdown';
      configs[key] = {
        ...configs[key],
        ...conf,
        options: isCollectionType ? conf.options || conf.values || configs[key]?.options : [],
        values: isCollectionType
          ? conf.values || conf.options || configs[key]?.values
          : conf.values || (configs[key]?.values ? [configs[key].values[0]] : []),
      };
    });
  }

  return Object.keys(configs).length > 0 ? configs : undefined;
};

// Helper component for Buffered Editing (Save on Enter, Discard on Escape)
const BufferedCellInput = ({
  initialValue,
  onSave,
  onCancel,
  placeholder,
  isReal,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  placeholder?: string;
  isReal: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState(initialValue);

  return (
    <div className="relative w-full h-full flex items-center px-0.5">
      <input
        autoFocus
        value={localValue}
        placeholder={placeholder}
        className="w-full h-full outline-none bg-transparent"
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave(localValue);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {!localValue && !isReal && (
        <span className="absolute right-1 text-red-500 text-[10px] font-bold pointer-events-none">*</span>
      )}
    </div>
  );
};

interface SheetTableProps {
  orgTeam: any;
  personalWorkspaces: any[];
  onClose?: () => void;
  tutorialStep: number | null;
  setTutorialStep: (step: number | null) => void;
}

const SheetTable: React.FC<SheetTableProps> = ({
  orgTeam,
  personalWorkspaces,
  onClose,
  tutorialStep,
  setTutorialStep,
}) => {
  const {
    tableData,
    selectedCell,
    setSelectedCell,
    editingCell,
    setEditingCell,
    addRow,
    removeRow,
    updateCellData,
    isPickerOpen,
    pickerRowIndex,
    closePicker,
    updateRowLocation,
    toggleFavorite,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    collapsedSections,
    toggleSection,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    targetSection,
    setTargetSection,
    setQuickAddModal,
    spaceFilter,
    expandedEmptySections,
    toggleEmptySections,
    expandedCategories,
    toggleCategory,
    undoDelete,
  } = useGridStore();

  const dispatch = useDispatch();
  const allTeams = (useSelector(selectAllData) as any[]) || [];
  const isDarkMode = useSelector(selectDarkMode);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedRowForTodo, setSelectedRowForTodo] = useState<RowData | null>(null);

  const filteredData = useMemo(() => {
    const sections: { title: string; rows: GridRow[] }[] = [];
    let current: { title: string; rows: GridRow[] } | null = null;

    const hasColumnFilters = Object.values(columnFilters).some(v => v.trim() !== '');
    const isGlobalFilterActive =
      showFavoritesOnly ||
      showHotkeysOnly ||
      showShortcutsOnly ||
      hasColumnFilters ||
      searchTerm.trim() !== '' ||
      !categoryFilter.includes('all') ||
      !visibilityFilter.includes('all') ||
      !spaceFilter.includes('all');

    const filterRow = (r: GridRow) => {
      if (r.type === 'data' || r.type === 'automationModule') {
        const term = String(searchTerm || '')
          .toLowerCase()
          .trim();

        // 1. Search term match
        const matchesSearch =
          !term ||
          String(r.name || '').toLowerCase().includes(term) ||
          String(r.url || '').toLowerCase().includes(term) ||
          (Array.isArray((r as any).urls) && (r as any).urls.some((u: any) => String(u || '').toLowerCase().includes(term))) ||
          String(r.value || '').toLowerCase().includes(term) ||
          String(r.path || '').toLowerCase().includes(term) ||
          String((r as any).folder || '').toLowerCase().includes(term) ||
          String(r.key || '').toLowerCase().includes(term) ||
          String((r as any).hotkey || '').toLowerCase().includes(term) ||
          String(r.command || '').toLowerCase().includes(term) ||
          String((r as any).shortcut || '').toLowerCase().includes(term) ||
          String((r as any).description || '').toLowerCase().includes(term) ||
          String((r as any).team_name || '').toLowerCase().includes(term) ||
          String((r as any).workspace_name || '').toLowerCase().includes(term) ||
          (r.category === 'module' && String((r as any).module_id || '').toLowerCase().includes(term));

        if (!matchesSearch) return false;

        // 2. Space filter
        if (!spaceFilter.includes('all')) {
          const isMatch = spaceFilter.some(filterId => {
            if (filterId === 'none_org') {
              return r.isPersonal;
            } else {
              return !r.isPersonal && String((r as any).team_id) === String(filterId);
            }
          });
          if (!isMatch) return false;
        }

        // 3. Visibility filters
        if (!visibilityFilter.includes('all')) {
          const v = r.visibilityType || 'lock';
          const mappedV =
            v === 'lock' || v === 'personal'
              ? 'private'
              : v === 'globe'
                ? 'public'
                : v === 'users'
                  ? 'shared'
                  : 'private';
          if (!visibilityFilter.includes(mappedV)) return false;
        }

        // 4. Category filters
        if (!categoryFilter.includes('all')) {
          if (!categoryFilter.includes(r.category || 'note')) return false;
        }

        // 5. Global Rail Filters
        if (showFavoritesOnly && !r.fav) return false;
        if (showHotkeysOnly && !r.key) return false;
        if (showShortcutsOnly && !r.command) return false;

        // 6. Custom Column Filters
        const columnFilterMatch = Object.entries(columnFilters).every(([colId, filterVal]) => {
          const cleanedFilter = filterVal.toLowerCase().trim();
          if (!cleanedFilter) return true;

          let val = '';
          if (colId === 'name') {
            val = String(r.name || '');
          } else if (colId === 'url') {
            const rawVal = r.url || r.value || '';
            if (typeof rawVal === 'object' && rawVal && 'urls' in rawVal) {
              val = Array.isArray((rawVal as any).urls) ? (rawVal as any).urls.join(' ') : '';
            } else {
              val = String(rawVal);
            }
          } else if (colId === 'folder' || colId === 'path') {
            val = String(r.path || '');
          } else if (colId === 'key') {
            val = String(r.key || '');
          } else if (colId === 'command') {
            val = String(r.command || '');
          }

          return val.toLowerCase().includes(cleanedFilter);
        });

        if (!columnFilterMatch) return false;

        return true;
      }

      if (r.type === 'automationCategory') {
        // Only show category if its category type (module) is allowed
        if (!categoryFilter.includes('all') && !categoryFilter.includes('module')) return false;
        // The actual visibility of category depends on if it has children, which we handle in the second pass
        return true;
      }

      return false;
    };

    // First pass: Group and filter
    tableData.forEach(row => {
      if (row.type === 'section') {
        current = { title: row.title, rows: [] };
        sections.push(current);
      } else if (current && filterRow(row)) {
        current.rows.push(row);
      }
    });

    // Reorder: Active sections first, empty sections last
    const nonEmptySections = sections.filter(s => s.rows.length > 0);
    const emptySections = sections.filter(s => s.rows.length === 0);

    const sortedSections: typeof sections = [];
    sortedSections.push(...nonEmptySections);

    // If expanded or filtering, show empty sections (ONLY if NO global filter is active)
    if (!isGlobalFilterActive && expandedEmptySections) {
      sortedSections.push(...emptySections);
    }

    // Final pass: Flatten and handle expanded categories
    const result: GridRow[] = [];

    sortedSections.forEach(s => {
      // If filtering is active, hide empty sections entirely
      if (isGlobalFilterActive && s.rows.length === 0) return;

      // Special check for automation categories: only show them if they have visible children or if no filter is active
      const processedRows: GridRow[] = [];
      if (s.title === 'Installed Modules') {
        s.rows.forEach((row, idx) => {
          if (row.type === 'automationCategory') {
            const hasVisibleChildren = s.rows.some(
              (r, i) => i > idx && r.type === 'automationModule' && r.parentId === row.id,
            );
            if (!isGlobalFilterActive || hasVisibleChildren) {
              processedRows.push(row);
            }
          } else {
            processedRows.push(row);
          }
        });
      } else {
        processedRows.push(...s.rows);
      }

      // If after processing categories, we have no rows left in this section and filter is active, skip section
      if (isGlobalFilterActive && processedRows.length === 0) return;

      result.push({ type: 'section', title: s.title, count: processedRows.length } as GridRow);

      if (!collapsedSections.includes(s.title)) {
        processedRows.forEach(row => {
          if (row.type === 'automationModule') {
            if (expandedCategories.includes(row.parentId)) {
              result.push(row);
            }
          } else {
            result.push(row);
          }
        });
      }
    });

    if (targetSection) {
      result.push({ type: 'section', title: targetSection, count: 0 } as GridRow);
    }

    // If not expanded and not filtering, add the toggle row at the very end
    if (!expandedEmptySections && !isGlobalFilterActive && emptySections.length > 0) {
      result.push({ type: 'emptySectionsToggle', count: emptySections.length });
    }

    return result;
  }, [
    tableData,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    collapsedSections,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    spaceFilter,
    targetSection,
    expandedCategories,
    expandedEmptySections,
  ]);

  // Use filtered data for navigation sync
  const dataRows = useMemo(
    () =>
      filteredData.filter(
        (r): r is RowData | AutomationModuleRow => r.type === 'data' || r.type === 'automationModule',
      ),
    [filteredData],
  );

  // 🚀 Keep selection in sync when filteredData changes (e.g. section collapse)
  const lastSelectedRowIdRef = React.useRef<string | null>(null);

  // Update the ref whenever selection or data changes
  React.useEffect(() => {
    if (selectedCell !== null) {
      if (selectedCell.rowIndex === -1) {
        lastSelectedRowIdRef.current = `header-col-${selectedCell.colIndex}`;
      } else {
        const row = filteredData[selectedCell.rowIndex];
        if (row) {
          if (row.type === 'section') {
            lastSelectedRowIdRef.current = `section-${row.title}`;
          } else {
            lastSelectedRowIdRef.current = (row as any).id || (row as any).name || (row as any).command || null;
          }
        }
      }
    }
  }, [selectedCell, filteredData]);

  // Sync rowIndex if the row moved or handle if it's gone
  React.useEffect(() => {
    if (lastSelectedRowIdRef.current && selectedCell !== null) {
      const targetId = lastSelectedRowIdRef.current;
      const currentIndex = filteredData.findIndex(r => {
        if (r.type === 'section') return `section-${r.title}` === targetId;
        const rId = (r as any).id || (r as any).name || (r as any).command;
        return rId === targetId;
      });

      // Special handling for header col persistence
      if (targetId.startsWith('header-col-')) {
        const colIdx = parseInt(targetId.replace('header-col-', ''), 10);
        if (selectedCell.rowIndex !== -1 || selectedCell.colIndex !== colIdx) {
          setSelectedCell({ rowIndex: -1, colIndex: colIdx });
        }
        return;
      }

      if (currentIndex !== -1 && currentIndex !== selectedCell.rowIndex) {
        // Selection shifted (e.g. a section above was collapsed/expanded)
        setSelectedCell({ ...selectedCell, rowIndex: currentIndex });
      } else if (currentIndex === -1) {
        // Selected row is no longer in filteredData (e.g. its section was collapsed)
        // Clear selection to prevent jumping to a different row that now has the same index
        setSelectedCell(null);
      }
    }
  }, [filteredData]);

  // Determine the active section (hovered or selected)
  const activeSectionTitle = useMemo(() => {
    if (hoveredSection) return hoveredSection;
    if (selectedCell !== null) {
      const row = filteredData[selectedCell.rowIndex];
      if (row) {
        return (row as any).title || (row as any).section;
      }
    }
    return null;
  }, [hoveredSection, selectedCell, filteredData]);

  const table = useReactTable({
    data: dataRows,
    columns,
    state: {
      columnSizing,
      sorting,
    },
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // 🚀 Auto-scroll selection into view
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (selectedCell !== null) {
      // Small timeout to ensure DOM elements with data-row-index are rendered
      timer = setTimeout(() => {
        const rowElement = document.querySelector(`[data-row-index="${selectedCell.rowIndex}"]`);
        if (rowElement) {
          rowElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedCell?.rowIndex]);

  // 🚀 Asynchronous navigation to target section (Deep Linking)
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (targetSection && filteredData.length > 0) {
      const index = filteredData.findIndex(r => r.type === 'section' && r.title === targetSection);
      if (index !== -1) {
        // We set to null briefly to ensure selecting the same index re-triggers scroll
        setSelectedCell(null);
        timer = setTimeout(() => {
          setSelectedCell({ rowIndex: index, colIndex: 0 });
          setTargetSection(null);
        }, 100);
      } else {
        setTargetSection(null);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [filteredData, targetSection, setSelectedCell, setTargetSection]);

  // 🚀 Auto-select first data record when data loads or search updates, keeping focus on search bar
  React.useEffect(() => {
    if (selectedCell === null && filteredData.length > 0) {
      const firstIndex = filteredData.findIndex(r => r.type === 'data' || r.type === 'automationModule');
      if (firstIndex !== -1) {
        setSelectedCell({ rowIndex: firstIndex, colIndex: 0 });
      }
    }
  }, [filteredData, selectedCell, setSelectedCell]);

  // 🚀 Synchronized Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useGridStore.getState();
      const {
        selectedCell,
        setSelectedCell,
        editingCell,
        setEditingCell,
        columnCount,
        addRow,
        openPicker,
        isPickerOpen,
      } = state;

      const target = e.target as HTMLElement;
      const isSearchInput = target.tagName === 'INPUT' && (target as HTMLInputElement).id?.startsWith('sheet-search-');

      // 🚀 1. ESCAPE -> Cancel edit mode OR Close Sheet
      // Handle this at the very top to ensure it's never blocked
      if (e.key === 'Escape') {
        const isEditing = editingCell !== null;
        if (isEditing) {
          e.preventDefault();
          e.stopPropagation();
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
          return;
        }

        if (isPickerOpen) {
          e.preventDefault();
          e.stopPropagation();
          closePicker();
          return;
        }

        if (isSearchInput) {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
          return;
        }

        // If nothing else is active, close the sheet
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.defaultPrevented) return;

      // 🚀 2. Alt + A -> Focus first data row AND Name Search
      // Handle this early so it works even if no cell is selected
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();

        const firstDataIndex = filteredData.findIndex(r => r.type === 'data' || r.type === 'automationModule');

        if (firstDataIndex !== -1) {
          setSelectedCell({ rowIndex: firstDataIndex, colIndex: 0 });
        }
        const nameSearch = document.getElementById('sheet-search-name');
        if (nameSearch) {
          (nameSearch as HTMLInputElement).focus();
          (nameSearch as HTMLInputElement).select();
        }
        return;
      }

      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

      // 🚀 3. Handle initial navigation from Search Bar if nothing is selected
      if (isSearchInput && !selectedCell && (e.key === 'ArrowDown' || e.key === 'Tab')) {
        if (filteredData.length > 0) {
          e.preventDefault();
          setSelectedCell({ rowIndex: 0, colIndex: 0 });
          return;
        }
      }

      if (!selectedCell || isPickerOpen) return;

      const { rowIndex, colIndex } = selectedCell;
      const isEditing = editingCell !== null;

      const currentRow = filteredData[rowIndex];
      if (!currentRow) return;

      // 🚀 2. Restrict non-navigation keys when focused in an input (except search)
      if (
        !isSearchInput && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[data-ignore-grid-nav="true"]')
        )
      ) {
        return;
      }

      // If it IS a search input, only allow specific navigation keys to pass through
      const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key);
      if (isSearchInput && !isNavKey) {
        return;
      }

      // 🚀 ESCAPE -> Cancel edit mode OR Close Sheet
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) {
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
        } else if (isSearchInput) {
          (target as HTMLInputElement).blur();
        } else {
          onClose?.();
        }
        return;
      }

      // Standard spreadsheet: arrows move cursor in input.
      if (isEditing && e.key !== 'Enter' && e.key !== 'Tab') {
        return;
      }

      // 🚀 ENTER -> Edit, Add Row, Open Picker, or Toggle Favorite
      if (e.key === 'Enter') {
        e.preventDefault();

        const isBookmark = (currentRow as any).category === 'bookmark';
        const isCommand = (currentRow as any).category === 'commands' || (currentRow as any).category === 'general_commands';

        if (isBookmark) {
          if (colIndex === 6) {
            useGridStore.getState().removeRow((currentRow as any).id, dispatch);
            return;
          }
          const dataRow = currentRow as RowData;
          if (dataRow.url) {
            window.open(dataRow.url, '_blank');
          }
          return;
        }

        if (isCommand) {
          const cmdId = String((currentRow as any).id || '').replace(/^cmd-/, '');
          if (cmdId) {
            dispatch(setPendingLockedCommand({ commandId: cmdId, mode: 'lock' }));
            onClose?.();
          }
          return;
        }

        // 0. If on Folder column (index 2) -> Trigger Picker
        if (colIndex === 2 && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          const isBookmark =
            (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
          const isBrowserCommand =
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands' ||
            (currentRow as any).section === 'Browser Commands';
          const isInstalledModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';

          if (!(isBookmark || isBrowserCommand || isInstalledModule)) {
            openPicker(currentRow.id);
          }
          return;
        }

        // 1. If on Favorite column (index 3) -> Toggle Favorite
        if (colIndex === 3 && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          state.toggleFavorite(currentRow.id);
          return;
        }

        // 2. If on an "Add Row" button
        if (currentRow?.type === 'add_row') {
          addRow(currentRow.section);
          setEditingCell({ rowIndex: rowIndex, colIndex: 0 });
          return;
        }

        if (currentRow?.type === 'section') {
          toggleSection(currentRow.title);
          return;
        }
        if (currentRow?.type === 'automationCategory') {
          toggleCategory(currentRow.id);
          return;
        }
        if (currentRow?.type === 'emptySectionsToggle') {
          toggleEmptySections();
          return;
        }

        // 4. If on Delete column (index 6) -> Remove Row
        if (colIndex === 6 && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          const isSpecial =
            currentRow.section === 'Installed Modules' ||
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands';

          if (!isSpecial) {
            useGridStore.getState().removeRow(currentRow.id, dispatch);
          }
          return;
        }

        // 5. Default Enter behavior
        if (!isEditing) {
          const isModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';
          const isAgent = (currentRow as any).category === 'agent' || (currentRow as any).section === 'Chat Agents';
          const isBookmark =
            (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
          const isBrowserCommand =
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands' ||
            (currentRow as any).section === 'Browser Commands';
          const isInstalledModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';

          const isCellBlocked =
            (colIndex === 0 && (isBookmark || isBrowserCommand || isInstalledModule)) ||
            (colIndex === 1 && (isBookmark || isBrowserCommand));

          const isReadonlyCol = isModule
            ? colIndex === 0 || colIndex === 2
            : colIndex === 0 || colIndex === 1 || colIndex === 2;

          if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (colIndex === 0 || colIndex === 2))) {
            setEditingCell(selectedCell);
          }
        } else if (isEditing) {
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
          const nextRow = rowIndex + 1;
          // In filtered data, if it exists, it is navigable
          if (nextRow < filteredData.length) {
            setSelectedCell({ rowIndex: nextRow, colIndex });
          }
        }
        return;
      }

      // 🚀 TAB & ARROWS -> Move Navigation
      const moveFocus = (rInc: number, cInc: number) => {
        const nRow = rowIndex + rInc;
        let nCol = colIndex + cInc;

        if (nRow >= 0 && nRow < filteredData.length) {
          if (nCol < 0) nCol = 0;
          if (nCol >= columnCount) nCol = columnCount - 1;
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
      };

      if (isArrowKey) {
        if (isEditing) return;
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        if (rowIndex > 0) {
          moveFocus(-1, 0);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        moveFocus(1, 0);
        return;
      }
      if (e.key === 'ArrowLeft') {
        moveFocus(0, -1);
        return;
      }
      if (e.key === 'ArrowRight') {
        moveFocus(0, 1);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (isEditing) setEditingCell(null);
        let nRow = rowIndex;
        let nCol = colIndex + (e.shiftKey ? -1 : 1);

        if (nCol >= columnCount) {
          nCol = 0;
          nRow++;
        } else if (nCol < 0) {
          nCol = columnCount - 1;
          nRow--;
        }

        if (nRow >= 0 && nRow < filteredData.length) {
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
        return;
      }

      // Quick Type-to-Edit
      if (
        !isEditing &&
        (currentRow?.type === 'data' || currentRow?.type === 'automationModule') &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const isModule =
          (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';
        const isAgent = (currentRow as any).category === 'agent' || (currentRow as any).section === 'Chat Agents';
        const isBookmark =
          (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
        const isBrowserCommand =
          (currentRow as any).category === 'commands' ||
          (currentRow as any).category === 'general_commands' ||
          (currentRow as any).section === 'Browser Commands';
        const isInstalledModule =
          (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';

        const isCellBlocked =
          (colIndex === 0 && (isBookmark || isBrowserCommand || isInstalledModule)) ||
          (colIndex === 1 && (isBookmark || isBrowserCommand));

        const isReadonlyCol = colIndex === 0 || colIndex === 1 || colIndex === 2;
        const isAgentReadonlyCol = colIndex === 1; // Only Description for agents

        if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && isAgentReadonlyCol) && !isBookmark) {
          setEditingCell(selectedCell);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredData, selectedCell, editingCell, setSelectedCell, setEditingCell, toggleSection, onClose]);

  const handleAddRow = async (section: string, visualIndex: number) => {
    const storageKey = section === 'Smart Links' ? 'lastLinkDestination' : 'lastNoteDestination';
    let initialLocation = {};
    if (allTeams && allTeams.length > 0) {
      const result: any = await new Promise(res => chrome.storage.local.get(storageKey, res));
      const lastDest = result[storageKey];

      let targetWS = null;
      let targetFID = null;

      if (lastDest) {
        for (const team of allTeams) {
          const ws = team.workspaces?.find((w: any) => w.workspace_id === lastDest.workspace_id);
          if (ws) {
            targetWS = ws;
            targetFID = lastDest.folder_id;
            break;
          }
        }
      }

      if (!targetWS && orgTeam && orgTeam.workspaces?.length > 0) {
        targetWS = orgTeam.workspaces[0];
        targetFID = null;
      }

      if (targetWS) {
        const wsIcon = resolveIcon(targetWS.icon, '📁');
        const wsPath = `${wsIcon} ${targetWS.workspace_name}`;

        const team = allTeams.find((t: any) =>
          t.workspaces?.some((w: any) => w.workspace_id === targetWS.workspace_id),
        );
        const isPersonal = team?.is_personal_space === true;
        let vType: 'lock' | 'globe' | 'users' | 'personal' = 'lock';
        if (isPersonal) {
          vType = 'personal';
        } else {
          const wsType =
            targetWS.type || (targetWS.is_shared ? 'shareonly' : targetWS.is_public ? 'public' : 'private');
          if (wsType === 'private') vType = 'lock';
          else if (wsType === 'shareonly' || wsType === 'shared') vType = 'users';
          else if (wsType === 'public') vType = 'globe';
        }

        let fName = null;
        let fPath = wsPath;
        if (targetFID) {
          const findFolder = (folders: any[]): any => {
            if (!folders) return null;
            for (const f of folders) {
              if (f.folder_id === targetFID) return f;
              const nested = findFolder(f.folders || []);
              if (nested) return nested;
            }
            return null;
          };
          const folder = findFolder(targetWS.folders || []);
          if (folder) {
            fName = folder.folder_name;
            const fIcon = resolveIcon(folder.icon, '📂');
            fPath = `${wsPath} / ${fIcon} ${fName}`;
          }
        }

        initialLocation = {
          workspace_id: targetWS.workspace_id,
          folder_id: targetFID || undefined,
          folder: fName || targetWS.workspace_name,
          path: fPath,
          visibilityType: vType,
        };
      }
    }

    addRow(section, initialLocation);
    // Expand the section if it was collapsed so the user can see the new row
    if (collapsedSections.includes(section)) {
      toggleSection(section);
    }
    // Select the newly added row (which is at visualIndex + 1 since addRow inserts at top)
    setTimeout(() => {
      setSelectedCell({ rowIndex: visualIndex + 1, colIndex: 0 });
      setEditingCell({ rowIndex: visualIndex + 1, colIndex: 0 });
    }, 50);
  };

  let dataIndex = 0;

  const sectionGroups: { key: string; items: { row: any; visualIndex: number }[] }[] = [];
  let currentGroup: { key: string; items: { row: any; visualIndex: number }[] } | null = null;

  filteredData.forEach((row, visualIndex) => {
    if (row.type === 'section') {
      currentGroup = { key: `section-${row.title}-${visualIndex}`, items: [] };
      sectionGroups.push(currentGroup);
    }
    if (!currentGroup) {
      currentGroup = { key: `default-${visualIndex}`, items: [] };
      sectionGroups.push(currentGroup);
    }
    currentGroup.items.push({ row, visualIndex });
  });

  return (
    <div className="flex flex-col items-center w-full">
      <div className={clsx('w-full rounded-2xl shadow-lg bg-[var(--color-sheetBg)] border border-white/10 overflow-hidden')}>
        <table className={clsx('w-full border-collapse table-fixed', 'bg-transparent')}>
          <SheetHeader
            table={table}
            isDarkMode={isDarkMode}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
          />
          {sectionGroups.map(group => (
            <tbody key={group.key} className="bg-transparent">
              {group.items.map(({ row, visualIndex }) => {
                if (row.type === 'section') {
                  const getIcon = (title: string) => {
                    switch (title) {
                      case 'Smart Links':
                        return (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        );
                      case 'Notes':
                        return (
                          <svg width="18" height="18" viewBox="0 0 24 24">
                            <rect x="2.5" y="3" width="19" height="18" rx="3.2" fill="#2B2B2B" />
                            <rect x="3.5" y="4" width="17" height="16" rx="2.8" fill="#FFFFFF" />
                            <rect x="3.5" y="18.4" width="17" height="1.6" rx="0.8" fill="#FFD84D" />
                            <path
                              d="M7 8.6 H17 M7 10.8 H16 M7 13 H15 M7 15.2 H14 M7 17.4 H13"
                              stroke="#BDBDBD"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                            <path d="M14.5 20 C17.6 18.1 19.2 16.6 20.8 14.5 L20.8 20 Z" fill="#E6C98A" />
                            <path d="M15.2 20 C17.4 18.4 18.6 17.2 20.4 15.2 L20.4 20 Z" fill="#E0E0E0" />
                            <path d="M16 20 C17.8 18.7 18.8 17.8 20 16 L20 20 Z" fill="#FFFFFF" />
                            <path
                              d="M7 4 C7 2.6 9 2.6 9 4 V5.6 C9 7 7 7 7 5.6 Z"
                              fill="#FFD84D"
                              stroke="#3A3A3A"
                              strokeWidth="0.9"
                            />
                            <path
                              d="M11 4 C11 2.6 13 2.6 13 4 V5.6 C13 7 11 7 11 5.6 Z"
                              fill="#FFD84D"
                              stroke="#3A3A3A"
                              strokeWidth="0.9"
                            />
                            <path
                              d="M15 4 C15 2.6 17 2.6 17 4 V5.6 C17 7 15 7 15 5.6 Z"
                              fill="#FFD84D"
                              stroke="#3A3A3A"
                              strokeWidth="0.9"
                            />
                          </svg>
                        );
                      case 'Saved Automations':
                        return <FiZap className="h-4 w-4 text-amber-500" />;
                      case 'Chat Agents':
                        return (
                          <StackedLinkIcon
                            urls={['chatgpt.com', 'gemini.google.com', 'claude.ai', 'perplexity.ai']}
                            size={14}
                            maxIcons={4}
                          />
                        );
                      case 'Installed Modules':
                        return <FaRobot className="h-4 w-4 text-purple-500" />;
                      case 'Bookmarks':
                        return <FaBookmark className="h-4 w-4 text-blue-500" />;
                      case 'Browser Commands':
                        return <FaTerminal className="h-4 w-4 text-[var(--color-iconDefault)]" />;
                      case 'Snippets':
                        return <FaCode className="h-4 w-4 text-emerald-500" />;
                      case 'Prompts':
                        return <LuSparkles className="h-4 w-4 text-purple-400" />;
                      default:
                        return null;
                    }
                  };

                  const isSelectedSection = selectedCell?.rowIndex === visualIndex;
                  const isCollapsed = collapsedSections.includes(row.title);

                  return (
                    <tr
                      key={`section-${row.title}-${visualIndex}`}
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                        toggleSection(row.title);
                      }}
                      onMouseEnter={() => setHoveredSection(row.title)}
                      onMouseLeave={() => setHoveredSection(null)}
                      className="cursor-pointer relative group/section-row select-none sticky top-[27px] z-[70]">
                      <td
                        colSpan={table.getAllLeafColumns().length}
                        className="p-0 text-sm font-normal tracking-tight bg-[var(--color-sheetBg)]">
                        <div className="flex items-center -ml-6 relative pr-0 gap-1 bg-transparent">
                          <div
                            className={clsx(
                              'p-1 rounded-md transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0 z-20',
                              isDarkMode ? 'bg-transparent hover:bg-white/10 text-neutral-400' : 'bg-white hover:bg-slate-200 text-slate-600',
                              isSelectedSection ? 'opacity-100' : 'opacity-0 group-hover/section-row:opacity-100',
                            )}
                            onClick={e => {
                              e.stopPropagation();
                              toggleSection(row.title);
                            }}>
                            {isCollapsed ? (
                              <FiChevronRight size={14} />
                            ) : (
                              <FiChevronDown size={14} />
                            )}
                          </div>

                          {/* Title Container (Gradient Box) */}
                          <div className={clsx(
                            "flex items-center flex-1 pl-2 pr-3 py-1 rounded-none transition-colors relative shadow-sm",
                            isDarkMode ? "bg-gradient-to-r from-white/10 to-transparent text-white border-b border-white/5" : "bg-gradient-to-r from-slate-200/50 to-transparent text-slate-700 border-b border-slate-200",
                            isSelectedSection ? (isDarkMode ? 'ring-1 ring-white/20 ring-inset z-10' : 'ring-1 ring-slate-800 ring-inset z-10') : ''
                          )}>
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[var(--color-iconDefault)]">{getIcon(row.title)}</span>
                              <span className="flex items-center">
                                {row.title}
                                <span className={clsx(
                                  "ml-2 text-[10px] font-bold",
                                  isDarkMode ? "text-neutral-400" : "text-slate-400"
                                )}>
                                  {
                                    tableData.filter(
                                      r =>
                                        (r.type === 'data' ||
                                          r.type === 'automationCategory' ||
                                          r.type === 'automationModule') &&
                                        r.section === row.title,
                                    ).length
                                  }
                                </span>
                                <div
                                  className={clsx(
                                    'flex items-center ml-1 transition-opacity duration-200',
                                    activeSectionTitle === row.title ? 'opacity-100' : 'opacity-0',
                                  )}>
                                  {/* Plus Button for Links/Notes/Snippets/Prompts */}
                                  {(row.title === 'Smart Links' || row.title === 'Notes' || row.title === 'Snippets' || row.title === 'Prompts') && (
                                    <div
                                      className="ml-2 p-1 hover:bg-green-100/50 text-green-600 rounded-full transition-all cursor-pointer group/add-btn active:scale-90"
                                      title={`Add new ${row.title === 'Smart Links' ? 'Link' : row.title === 'Snippets' ? 'Snippet' : row.title === 'Prompts' ? 'Prompt' : 'Note'}`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        setQuickAddModal(
                                          row.title === 'Smart Links' ? 'link' :
                                            row.title === 'Snippets' ? 'snippet' :
                                              row.title === 'Prompts' ? 'prompt' : 'note'
                                        );
                                      }}>
                                      <LuPlus size={14} strokeWidth={3} />
                                    </div>
                                  )}

                                  {/* Plus Button for Automations */}
                                  {row.title === 'Saved Automations' && (
                                    <div
                                      className="ml-2 p-1 hover:bg-green-100/50 text-green-600 rounded-full transition-all cursor-pointer group/add-btn active:scale-90"
                                      title="Add new automation"
                                      onClick={e => {
                                        e.stopPropagation();
                                        onClose?.();
                                        dispatch(navigateToView({ kind: 'agentPanel' }));
                                      }}>
                                      <LuPlus size={14} strokeWidth={3} />
                                    </div>
                                  )}

                                  {/* Plus Button for Chat Agents */}
                                  {row.title === 'Chat Agents' && (
                                    <div
                                      className="ml-2 p-1 hover:bg-green-100/50 text-green-600 rounded-full transition-all cursor-pointer group/add-btn active:scale-90"
                                      title="Create Chat Agent"
                                      onClick={e => {
                                        e.stopPropagation();
                                        onClose?.();
                                        dispatch(setPendingLockedCommand({ commandId: 'ai', mode: 'lock' }));
                                      }}>
                                      <LuPlus size={14} strokeWidth={3} />
                                    </div>
                                  )}

                                  {row.title === 'Installed Modules' && (
                                    <div
                                      className="ml-2 p-1 hover:bg-green-100/50 text-green-600 rounded-full transition-all cursor-pointer group/add-btn active:scale-90"
                                      title="Open Store"
                                      onClick={e => {
                                        e.stopPropagation();
                                        onClose?.();
                                        dispatch(navigateToView({ kind: 'store' }));
                                      }}>
                                      <LuPlus size={14} strokeWidth={3} />
                                    </div>
                                  )}
                                </div>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'automationCategory') {
                  const isSelected = selectedCell?.rowIndex === visualIndex;
                  const isExpanded = useGridStore.getState().expandedCategories.includes(row.id);

                  return (
                    <tr
                      key={`cat-${row.id}-${visualIndex}`}
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                      }}
                      onDoubleClick={() => toggleCategory(row.id)}
                      onMouseEnter={() => setHoveredRowIndex(visualIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className={clsx(
                        'cursor-pointer relative select-none transition-all duration-200 group',
                        isDarkMode
                          ? isExpanded
                            ? 'bg-white/5 border-b border-white/5'
                            : 'bg-transparent border-b border-white/5 hover:bg-white/5'
                          : isExpanded
                            ? 'bg-slate-50/80 border-b border-[#e1e1e1]'
                            : 'bg-white border-b border-[#e1e1e1] hover:bg-slate-50',
                        isSelected ? (isDarkMode ? 'ring-1 ring-white/60 ring-inset z-10' : 'ring-1 ring-slate-800 ring-inset z-10') : '',
                      )}>
                      <td
                        colSpan={table.getAllLeafColumns().length}
                        className={clsx(
                          'pl-1 pr-0 py-1.5',
                          isDarkMode ? 'border-white/10' : 'border-[#e1e1e1]',
                        )}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1">
                            <div
                              className={clsx(
                                'p-1 rounded-md transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0',
                                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200',
                                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                              )}
                              onClick={e => {
                                e.stopPropagation();
                                toggleCategory(row.id);
                              }}>
                              {isExpanded ? (
                                <FiChevronDown className="text-[var(--color-iconDefault)]" size={14} />
                              ) : (
                                <FiChevronRight className="text-[var(--color-iconDefault)]" size={14} />
                              )}
                            </div>

                            {/* Icon & Name */}
                            <div className="flex items-center gap-2">
                              {row.iconHost ? (
                                <img
                                  src={getFaviconUrl(row.iconHost)}
                                  alt=""
                                  className="w-4 h-4 object-contain rounded-sm transition-all"
                                />
                              ) : (
                                <FiBox className="text-[var(--color-iconDefault)]" size={14} />
                              )}
                              <span
                                className={clsx(
                                  'text-[11px] font-bold uppercase tracking-[0.1em]',
                                  isDarkMode ? 'text-white' : 'text-slate-700',
                                )}>
                                {row.name}
                                <span className={clsx(
                                  "ml-2 text-[10px] font-bold",
                                  isDarkMode ? "text-neutral-400" : "text-slate-400"
                                )}>
                                  {row.moduleCount}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'emptySectionsToggle') {
                  const isSelected = selectedCell?.rowIndex === visualIndex;

                  return (
                    <tr
                      key="empty-sections-toggle"
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                        toggleEmptySections();
                      }}
                      onMouseEnter={() => setHoveredRowIndex(visualIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className={clsx(
                        'cursor-pointer select-none transition-colors',
                        isDarkMode ? 'bg-transparent hover:bg-white/5' : 'bg-white hover:bg-slate-50',
                      )}>
                      <td colSpan={table.getAllLeafColumns().length} className="pl-3 pr-0 py-1.5">
                        <span
                          className={clsx(
                            'flex items-center gap-1.5 text-[11px] font-medium',
                            isDarkMode ? 'text-neutral-400' : 'text-slate-500',
                          )}>
                          <FiChevronRight size={11} className="text-[var(--color-iconDefault)]" />
                          Show {row.count} more sections
                        </span>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'add_row') return null;

                // Normal data row
                const tableRow = table.getRowModel().rows[dataIndex++];
                if (!tableRow) return null;

                const handleContextMenu = (e: React.MouseEvent) => {
                  e.preventDefault();
                  setContextMenuPos({ x: e.clientX, y: e.clientY });
                  setSelectedRowForTodo(tableRow.original as RowData);
                };

                return (
                  <tr
                    key={tableRow.id}
                    data-row-index={visualIndex}
                    onMouseEnter={() => setHoveredSection(tableRow.original.section)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onContextMenu={handleContextMenu}
                    className={clsx(
                      'group/row grow h-auto min-h-[44px] transition-all duration-300',
                      isDarkMode
                        ? (tableRow.original as any).isDeleting
                          ? 'bg-red-900/20'
                          : 'bg-transparent hover:bg-white/5'
                        : (tableRow.original as any).isDeleting
                          ? 'bg-red-50/60'
                          : 'bg-white hover:bg-slate-50',
                    )}>
                    {tableRow.getVisibleCells().map((cell, index) => {
                      const isSelected = selectedCell?.rowIndex === visualIndex && selectedCell?.colIndex === index;
                      const isSelectedRow = selectedCell?.rowIndex === visualIndex;

                      const isEditing = editingCell?.rowIndex === visualIndex && editingCell?.colIndex === index;

                      const value = cell.getValue() as string;

                      return (
                        <td
                          key={cell.id}
                          onClick={() => {
                            setSelectedCell({ rowIndex: visualIndex, colIndex: index });
                            if (isSelected && !isEditing) {
                              const row = tableRow.original as any;
                              const isModule = row.category === 'module' || row.section === 'Installed Modules';
                              const isAgent = row.category === 'agent' || row.section === 'Chat Agents';
                              const isBookmark =
                                row.category === 'bookmark' || row.section === 'Bookmarks';
                              const isBrowserCommand =
                                row.category === 'commands' ||
                                row.category === 'general_commands' ||
                                row.section === 'Browser Commands';
                              const isInstalledModule =
                                row.category === 'module' || row.section === 'Installed Modules';

                              const isCellBlocked =
                                (index === 0 && (isBookmark || isBrowserCommand || isInstalledModule)) ||
                                (index === 1 && (isBookmark || isBrowserCommand));

                              // For modules and agents, the 2nd column (index 1) is now editable
                              const isReadonlyCol = isModule
                                ? index === 0 || index === 2
                                : index === 0 || index === 1 || index === 2;
                              const isAgentReadonlyCol = index === 1;

                              if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (index === 0 || index === 2))) {
                                setEditingCell({ rowIndex: visualIndex, colIndex: index });
                              }
                            }
                          }}
                          className={clsx(
                            'text-[11px] cursor-pointer transition-all relative border-none',
                            index === 6
                              ? 'p-0 text-center align-middle'
                              : index === 4 || index === 5
                                ? 'px-1'
                                : cell.column.id === 'url' && isSelected
                                  ? 'px-[2px]'
                                  : 'px-2 py-1',
                            isSelected
                              ? (isDarkMode
                                  ? 'text-white ring-1 ring-white/30 ring-inset rounded bg-white/5 z-[50] overflow-visible py-[2px]'
                                  : 'text-slate-700 ring-1 ring-slate-400/50 ring-inset rounded bg-slate-500/5 z-[50] overflow-visible py-[2px]')
                              : (isDarkMode ? 'text-white py-[1.5px]' : 'text-slate-700 py-[1.5px]'),
                            (tableRow.original as any).isDeleting && (index !== 6 ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'),
                          )}
                          style={{ width: cell.column.getSize() }}>
                          {index === 6 ? (
                            (tableRow.original as any).isDeleting ? (
                              <div className="flex items-center justify-center w-full h-full">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    undoDelete(tableRow.original.id);
                                  }}
                                  className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded transition-all hover:bg-red-700 active:scale-90 animate-pulse">
                                  UNDO
                                </button>
                              </div>
                            ) : tableRow.original.section !== 'Installed Modules' ? (
                              <div className="flex items-center justify-center w-full h-full min-h-[28px]">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    useGridStore.getState().removeRow(tableRow.original.id, dispatch);
                                  }}
                                  className={clsx(
                                    'flex items-center justify-center w-7 h-7 rounded hover:text-red-500 transition-all',
                                    isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                  )}>
                                  <FiTrash size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="p-1 h-6 w-6 opacity-0 pointer-events-none" aria-hidden="true" />
                            )
                          ) : isEditing ? (
                            index === 3 ? (
                              tableRow.original.section === 'Bookmarks' ? null : (
                                <div className="flex justify-center w-full">
                                  <button
                                    className="transition-colors"
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleFavorite(tableRow.original.id as string);
                                    }}>
                                    {tableRow.original.syncStatus === 'syncing' ? (
                                      <FiLoader className="animate-spin text-[var(--color-iconDefault)] text-xs" />
                                    ) : tableRow.original.fav ? (
                                      <FaStar className="text-amber-400 text-xs" />
                                    ) : (
                                      <FiStar className="text-[var(--color-iconDefault)] text-xs hover:opacity-80" />
                                    )}
                                  </button>
                                </div>
                              )
                            ) : index === 4 ? (
                              <GridHotkeyInput
                                itemId={tableRow.original.id}
                                initialValue={value || ''}
                                onSave={val => {
                                  updateCellData(tableRow.original.id, index, cell.column.id, val, dispatch, allTeams);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                                onOverwrite={(val, conflictId) => {
                                  useGridStore
                                    .getState()
                                    .overwriteCellData(
                                      tableRow.original.id,
                                      index,
                                      cell.column.id,
                                      val,
                                      conflictId,
                                      dispatch,
                                      allTeams,
                                    );
                                  setEditingCell(null);
                                }}
                              />
                            ) : index === 5 ? (
                              <GridCommandInput
                                itemId={getItemCompoundId(tableRow.original)}
                                initialValue={value || ''}
                                onSave={val => {
                                  updateCellData(tableRow.original.id, index, cell.column.id, val, dispatch, allTeams);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                                onOverwrite={(val, conflictId) => {
                                  useGridStore
                                    .getState()
                                    .overwriteCellData(
                                      tableRow.original.id,
                                      index,
                                      cell.column.id,
                                      val,
                                      conflictId,
                                      dispatch,
                                      allTeams,
                                    );
                                  setEditingCell(null);
                                }}
                              />
                            ) : index === 1 ? (
                              (() => {
                                const isAutomation =
                                  !!tableRow.original.automationData ||
                                  tableRow.original.section === 'My Saved Automations' ||
                                  tableRow.original.section === 'Chat Agents' ||
                                  tableRow.original.category === 'automation' ||
                                  tableRow.original.category === 'agent' ||
                                  (tableRow.original.itemType === 'agent' && !!tableRow.original.automationData);

                                if (isAutomation) {
                                  const steps =
                                    tableRow.original.automationData?.steps ||
                                    tableRow.original.automationData?.automation_steps ||
                                    tableRow.original.automationData?.execution_steps ||
                                    [];
                                  const currentParamConfigs = resolveParamConfigs(tableRow.original.automationData);

                                  return (
                                    <GridAutomationStepInput
                                      itemId={tableRow.original.id}
                                      steps={steps}
                                      globalParamConfigs={currentParamConfigs}
                                      onSave={() => {
                                        setEditingCell(null);
                                      }}
                                      onCancel={() => setEditingCell(null)}
                                      onUpdateStepPrimaryValue={(stepId, newValue) => {
                                        const currentData = tableRow.original.automationData;
                                        if (!currentData) return;
                                        const steps =
                                          currentData.steps ||
                                          currentData.automation_steps ||
                                          currentData.execution_steps ||
                                          [];
                                        const updatedSteps = steps.map((s: any, sIdx: number) => {
                                          const sId = s.id ?? s.step_id;
                                          const matchId = stepId === sId || stepId === `step-${sIdx}`;
                                          if (matchId) {
                                            const mId = String(s.moduleId || s.module_id || s.action || '');
                                            const config = { ...(s.config || {}) };

                                            const isTopLevel = s.action !== undefined;
                                            const update = (key: string, val: any) => {
                                              if (isTopLevel && s[key] !== undefined) s[key] = val;
                                              else config[key] = val;
                                            };

                                            if (mId === 'wait' || mId === 'wait_duration')
                                              update(s.ms !== undefined ? 'ms' : 'delay', Number(newValue) || 0);
                                            else if (mId === 'paste' || mId === 'insert_text')
                                              update(s.value !== undefined ? 'value' : 'content', newValue);
                                            else if (mId === 'clipboard_write') update('text', newValue);
                                            else if (
                                              mId === 'click' ||
                                              mId === 'clipboard_paste' ||
                                              mId === 'wait_for_element' ||
                                              mId === 'inject_image'
                                            )
                                              update(
                                                s.selector !== undefined ? 'selector' : 'selectorElementName',
                                                newValue,
                                              );
                                            else if (mId === 'keystroke') update('key', newValue);
                                            else update('url', newValue);

                                            return isTopLevel ? { ...s } : { ...s, config };
                                          }
                                          return s;
                                        });
                                        const updatedData = { ...currentData, steps: updatedSteps };
                                        // Support different keys for steps in automationData
                                        if (currentData.steps) updatedData.steps = updatedSteps;
                                        if (currentData.automation_steps) updatedData.automation_steps = updatedSteps;
                                        if (currentData.execution_steps) updatedData.execution_steps = updatedSteps;

                                        updateCellData(
                                          tableRow.original.id,
                                          index,
                                          'automationData',
                                          updatedData,
                                          dispatch,
                                          allTeams,
                                        );
                                      }}
                                      onUpdateStepConfig={(stepId, newConfig) => {
                                        const currentData = tableRow.original.automationData;
                                        if (!currentData) return;
                                        const steps =
                                          currentData.steps ||
                                          currentData.automation_steps ||
                                          currentData.execution_steps ||
                                          [];
                                        const updatedSteps = steps.map((s: any, sIdx: number) => {
                                          const sId = s.id ?? s.step_id;
                                          const matchId = stepId === sId || stepId === `step-${sIdx}`;
                                          if (matchId) {
                                            const isTopLevel = s.action !== undefined;
                                            if (isTopLevel) {
                                              return { ...s, ...newConfig };
                                            } else {
                                              return { ...s, config: { ...s.config, ...newConfig } };
                                            }
                                          }
                                          return s;
                                        });
                                        const updatedData: any = { ...currentData, steps: updatedSteps };
                                        if (currentData.steps) updatedData.steps = updatedSteps;
                                        if (currentData.automation_steps) updatedData.automation_steps = updatedSteps;
                                        if (currentData.execution_steps) updatedData.execution_steps = updatedSteps;

                                        // 🆕 CRITICAL: Merge paramConfigs into the top-level automationData
                                        // This ensures syncInputSplitConfig in gridStore finds the updates for cloud sync
                                        if (newConfig.paramConfigs) {
                                          // 🚀 MERGE FIX: Ensure we don't accidentally revert types
                                          const baseParamConfigs = tableRow.original.automationData?.paramConfigs || {};
                                          updatedData.paramConfigs = {
                                            ...baseParamConfigs,
                                            ...newConfig.paramConfigs,
                                          };
                                        }

                                        updateCellData(
                                          tableRow.original.id,
                                          index,
                                          'automationData',
                                          updatedData,
                                          dispatch,
                                          allTeams,
                                        );
                                      }}
                                      onUpdateStepData={(stepId, newValue, newConfig) => {
                                        const currentData = tableRow.original.automationData;
                                        if (!currentData) return;
                                        const steps =
                                          currentData.steps ||
                                          currentData.automation_steps ||
                                          currentData.execution_steps ||
                                          [];
                                        const updates: any = {};
                                        const updatedSteps = steps.map((s: any, sIdx: number) => {
                                          const sId = s.id ?? s.step_id;
                                          const matchId = stepId === sId || stepId === `step-${sIdx}`;
                                          if (matchId) {
                                            const mId = String(s.moduleId || s.module_id || s.action || '');
                                            const isTopLevel = s.action !== undefined;

                                            const rootProps = ['status', 'name', 'moduleId', 'subSteps', 'paramConfigs'];
                                            const configUpdates: any = {};

                                            Object.keys(newConfig || {}).forEach(key => {
                                              if (rootProps.includes(key)) updates[key] = newConfig[key];
                                              else configUpdates[key] = newConfig[key];
                                            });

                                            const config = { ...(s.config || {}), ...configUpdates };

                                            const update = (key: string, val: any) => {
                                              if (isTopLevel && s[key] !== undefined) s[key] = val;
                                              else config[key] = val;
                                            };

                                            if (newValue !== undefined) {
                                              if (mId === 'wait' || mId === 'wait_duration')
                                                update(s.ms !== undefined ? 'ms' : 'delay', Number(newValue) || 0);
                                              else if (mId === 'paste' || mId === 'insert_text')
                                                update(s.value !== undefined ? 'value' : 'content', newValue);
                                              else if (mId === 'clipboard_write') update('text', newValue);
                                              else if (
                                                mId === 'click' ||
                                                mId === 'clipboard_paste' ||
                                                mId === 'wait_for_element' ||
                                                mId === 'inject_image'
                                              )
                                                update(
                                                  s.selector !== undefined ? 'selector' : 'selectorElementName',
                                                  newValue,
                                                );
                                              else if (mId === 'keystroke') update('key', newValue);
                                              else update('url', newValue);
                                            }
                                            return isTopLevel ? { ...s, ...updates } : { ...s, ...updates, config };
                                          }
                                          return s;
                                        });
                                        const updatedData = { ...currentData, steps: updatedSteps, ...updates };
                                        if (currentData.steps) updatedData.steps = updatedSteps;
                                        if (currentData.automation_steps) updatedData.automation_steps = updatedSteps;
                                        if (currentData.execution_steps) updatedData.execution_steps = updatedSteps;

                                        // Merge paramConfigs explicitly if they exist in updates
                                        if (updates.paramConfigs) {
                                          updatedData.paramConfigs = {
                                            ...(currentData.paramConfigs || {}),
                                            ...updates.paramConfigs,
                                          };
                                        }

                                        updateCellData(
                                          tableRow.original.id,
                                          index,
                                          'automationData',
                                          updatedData,
                                          dispatch,
                                          allTeams,
                                        );
                                      }}
                                    />
                                  );
                                }

                                if (
                                  tableRow.original.section === 'Notes' ||
                                  tableRow.original.section === 'Snippets' ||
                                  tableRow.original.section === 'Prompts'
                                ) {
                                  return (
                                    <BufferedCellInput
                                      initialValue={String(tableRow.original.value || '')
                                        .replace(/<[^>]*>?/gm, '')
                                        .replace(/&nbsp;/g, ' ')
                                        .trim()}
                                      placeholder="Enter description"
                                      isReal={!!tableRow.original.isReal}
                                      onSave={val => {
                                        updateCellData(
                                          tableRow.original.id,
                                          index,
                                          cell.column.id,
                                          val,
                                          dispatch,
                                          allTeams,
                                        );
                                        setEditingCell(null);
                                      }}
                                      onCancel={() => setEditingCell(null)}
                                    />
                                  );
                                }

                                return (
                                  <GridMultiLinkInput
                                    initialUrls={tableRow.original.urls || []}
                                    onSave={val => {
                                      updateCellData(
                                        tableRow.original.id,
                                        index,
                                        cell.column.id,
                                        val,
                                        dispatch,
                                        allTeams,
                                      );
                                      setEditingCell(null);
                                    }}
                                    onCancel={() => setEditingCell(null)}
                                  />
                                );
                              })()
                            ) : (
                              <BufferedCellInput
                                initialValue={value || ''}
                                placeholder="Enter the title"
                                isReal={!!tableRow.original.isReal}
                                onSave={val => {
                                  updateCellData(tableRow.original.id, index, cell.column.id, val, dispatch, allTeams);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            )
                          ) : (
                            <div className={clsx('max-w-full flex items-center gap-2', 'truncate whitespace-nowrap')}>
                              {cell.column.id === 'fav' ? (
                                tableRow.original.section === 'Bookmarks' ? null : (
                                  <div className="flex justify-center w-full">
                                    <button
                                      className="transition-colors"
                                      onClick={e => {
                                        e.stopPropagation();
                                        toggleFavorite(tableRow.original.id as string);
                                      }}>
                                      {tableRow.original.syncStatus === 'syncing' ? (
                                        <FiLoader className="animate-spin text-[var(--color-iconDefault)] text-xs" />
                                      ) : tableRow.original.fav ? (
                                        <FaStar className="text-amber-400 text-xs" />
                                      ) : (
                                        <FiStar className="text-[var(--color-iconDefault)] text-xs hover:opacity-80" />
                                      )}
                                    </button>
                                  </div>
                                )
                              ) : (cell.column.id === 'folder' || cell.column.id === 'folder_id') &&
                                (tableRow.original.section === 'My Saved Automations' ||
                                  tableRow.original.section === 'Chat Agents') ? (
                                <div className="flex items-center justify-between gap-1 w-full h-full px-2 overflow-hidden">
                                  {tableRow.original.path && (
                                    <>
                                      <div className="truncate flex-1 min-w-0">
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200',
                                            isSelectedRow ? 'hidden' : 'group-hover/row:hidden',
                                            isDarkMode ? "text-white" : "text-slate-700"
                                          )}>
                                          {tableRow.original.plainPath || tableRow.original.path}
                                        </span>
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200',
                                            isSelectedRow ? 'inline' : 'hidden group-hover/row:inline',
                                            isDarkMode ? "text-white" : "text-slate-700"
                                          )}>
                                          {tableRow.original.path}
                                        </span>
                                      </div>
                                      <span
                                        className={clsx(
                                          'shrink-0 ml-1.5 flex items-center transition-opacity duration-200',
                                          isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                        )}>
                                        {tableRow.original.visibilityType === 'lock' && (
                                          <MdLockOutline size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'globe' && (
                                          <FiGlobe size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'users' && (
                                          <BsPeopleFill size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'personal' && (
                                          <BsPersonFill size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ) : (cell.column.id === 'folder' || cell.column.id === 'folder_id') &&
                                tableRow.original.section === 'Installed Modules' ? (
                                <div className="flex items-center justify-between gap-1 w-full h-full px-2 overflow-hidden">
                                  <span className={clsx(
                                    "truncate whitespace-nowrap flex-1 min-w-0",
                                    isDarkMode ? "text-white" : "text-slate-700"
                                  )}>Installed</span>
                                  <span
                                    className={clsx(
                                      'shrink-0 ml-1.5 flex items-center transition-opacity duration-200',
                                      isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                    )}>
                                    <BsPersonFill size={11} className="text-[var(--color-iconDefault)]" />
                                  </span>
                                </div>
                              ) : cell.column.id === 'name' ? (
                                <div
                                  className={clsx(
                                    'flex items-center gap-2 truncate max-w-full pl-6',
                                    tableRow.original.type === 'automationModule' && 'ml-8',
                                  )}>
                                  {(() => {
                                    const rowItem = tableRow.original;
                                    const isLink = rowItem.itemType === 'link' || rowItem.category === 'bookmark';

                                    return (
                                      <>
                                        {isLink && rowItem.category !== 'commands' && rowItem.category !== 'general_commands' && (
                                          <StackedLinkIcon
                                            urls={rowItem.urls || []}
                                            size={14}
                                            fallback={
                                              rowItem.category === 'bookmark'
                                                ? 'link'
                                                : (rowItem.category || '').toLowerCase() === 'tabgroup' ||
                                                  (rowItem.category || '').toLowerCase() === 'tab group' ||
                                                  (rowItem.category || '').toLowerCase() === 'bulk_link'
                                                  ? 'tabgroup'
                                                  : 'link'
                                            }
                                            maxIcons={3}
                                          />
                                        )}
                                        {rowItem.itemType === 'note' && (
                                          <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {rowItem.itemType === 'snippet' && (
                                          <FaCode size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {rowItem.itemType === 'prompt' && !(typeof rowItem.icon_host === 'string' && rowItem.icon_host) && (
                                          <FaTerminal size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {(rowItem.itemType === 'agent' || rowItem.category === 'module' || rowItem.category === 'commands' || rowItem.category === 'general_commands') ? (
                                          (typeof rowItem.icon_host === 'string' && rowItem.icon_host) ? (
                                            <img
                                              src={getFaviconUrl(rowItem.icon_host)}
                                              alt=""
                                              className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"
                                            />
                                          ) : (!isLink && rowItem.category !== 'commands' && rowItem.category !== 'general_commands') ? (
                                            <AutomationDynamicIcon
                                              automation={rowItem.automationData}
                                              size={14}
                                              className="shrink-0"
                                            />
                                          ) : null
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                  <span className="truncate flex-1 font-normal flex items-center gap-1">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    {!cell.getValue() && !tableRow.original.isReal && (
                                      <span className="text-red-500 font-bold text-[10px]">*</span>
                                    )}
                                  </span>
                                  {(tableRow.original.section === 'Smart Links' || tableRow.original.category === 'bookmark' || tableRow.original.category === 'commands') && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();

                                        const urls = tableRow.original.urls || [];
                                        if (urls.length > 0) {
                                          const finalUrls = urls
                                            .map((url: string) => {
                                              if (url.startsWith('note:')) {
                                                const sid = url.substring(5);
                                                return chrome.runtime.getURL(
                                                  `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`,
                                                );
                                              }
                                              return url;
                                            })
                                            .filter(Boolean);

                                          if (finalUrls.length > 0) {
                                            finalUrls.slice(1).forEach((url: string) => {
                                              if (url.startsWith('agent_chat?id=')) {
                                                const agentId = url.split('id=')[1];
                                                const extensionUrl = chrome.runtime.getURL(
                                                  `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                                                );
                                                chrome.tabs.create({ url: extensionUrl, active: false });
                                              } else {
                                                chrome.tabs.create({ url, active: false });
                                              }
                                            });

                                            const firstUrl = finalUrls[0];
                                            if (firstUrl.startsWith('agent_chat?id=')) {
                                              const agentId = firstUrl.split('id=')[1];
                                              const extensionUrl = chrome.runtime.getURL(
                                                `new-tab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                                              );
                                              window.location.href = extensionUrl;
                                            } else if (firstUrl.startsWith('chrome://') || firstUrl.startsWith('edge://') || firstUrl.startsWith('brave://')) {
                                              chrome.tabs.update({ url: firstUrl });
                                            } else {
                                              window.location.href = firstUrl;
                                            }
                                          }
                                        }
                                      }}
                                      className={clsx(
                                        'p-0.5 rounded transition-all cursor-pointer mr-2 shrink-0 flex items-center justify-center',
                                        isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200',
                                        isSelectedRow || isSelected
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover/row:opacity-100',
                                      )}
                                      title="Open Link">
                                      <FiExternalLink size={12} className="text-[var(--color-iconDefault)]" />
                                    </button>
                                  )}
                                  <AnimatePresence mode="popLayout">
                                    {tableRow.original.syncStatus === 'syncing' && (
                                      <motion.div
                                        key="syncing"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className={clsx(
                                          "shrink-0 ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border",
                                          isDarkMode
                                            ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                                            : "bg-blue-50 border-blue-200 text-blue-600"
                                        )}>
                                        <BsHourglassSplit className="text-[10px] animate-spin" />
                                        <span className="text-[9px] font-medium tracking-tight">
                                          Syncing...
                                        </span>
                                      </motion.div>
                                    )}
                                    {tableRow.original.syncStatus === 'deleting' && (
                                      <motion.div
                                        key="deleting"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className={clsx(
                                          "shrink-0 ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border",
                                          isDarkMode
                                            ? "bg-red-500/20 border-red-500/30 text-red-300"
                                            : "bg-red-50 border-red-200 text-red-600"
                                        )}>
                                        <FiLoader className="text-[10px] animate-spin" />
                                        <span className="text-[9px] font-medium tracking-tight">
                                          Deleting...
                                        </span>
                                      </motion.div>
                                    )}
                                    {tableRow.original.syncStatus === 'saved' && (
                                      <div className="shrink-0 ml-1">
                                        <motion.div
                                          key="saved-check"
                                          initial={{ opacity: 0, scale: 0.5 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0 }}
                                          className="flex items-center">
                                          <FiCheck className="text-[10px] text-emerald-500 stroke-[3]" />
                                        </motion.div>
                                      </div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ) : cell.column.id === 'folder' ? (
                                <div
                                  className="flex items-center justify-between gap-1 cursor-pointer hover:text-blue-500 transition-colors w-full h-full pr-2 overflow-hidden"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const row = tableRow.original as any;
                                    const isBookmark =
                                      row.category === 'bookmark' || row.section === 'Bookmarks';
                                    const isBrowserCommand =
                                      row.category === 'commands' ||
                                      row.category === 'general_commands' ||
                                      row.section === 'Browser Commands';
                                    const isInstalledModule =
                                      row.category === 'module' || row.section === 'Installed Modules';

                                    if (!(isBookmark || isBrowserCommand || isInstalledModule)) {
                                      useGridStore.getState().openPicker(tableRow.original.id);
                                    }
                                  }}>
                                  {tableRow.original.path ? (
                                    <>
                                      <div className="truncate flex-1 min-w-0">
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200',
                                            isSelectedRow ? 'hidden' : 'group-hover/row:hidden',
                                            isDarkMode ? "text-white" : "text-slate-700"
                                          )}>
                                          {tableRow.original.plainPath || tableRow.original.path}
                                        </span>
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200',
                                            isSelectedRow ? 'inline' : 'hidden group-hover/row:inline',
                                            isDarkMode ? "text-white" : "text-slate-700"
                                          )}>
                                          {tableRow.original.path}
                                        </span>
                                      </div>
                                      <span
                                        className={clsx(
                                          'shrink-0 ml-1.5 flex items-center transition-opacity duration-200',
                                          isSelectedRow
                                            ? 'opacity-100 text-blue-400'
                                            : 'opacity-0 group-hover/row:opacity-100 group-hover/row:text-blue-400',
                                        )}>
                                        {tableRow.original.visibilityType === 'lock' && (
                                          <MdLockOutline size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'globe' && (
                                          <FiGlobe size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'users' && (
                                          <BsPeopleFill size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                        {tableRow.original.visibilityType === 'personal' && (
                                          <BsPersonFill size={11} className="text-[var(--color-iconDefault)]" />
                                        )}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-blue-400/70 font-normal italic text-[10px] pl-2 group-hover/folder:text-blue-500 transition-colors flex items-center gap-1">
                                      +{' '}
                                      {tableRow.original.section === 'Notes'
                                        ? 'Select regarding'
                                        : 'Selector for destination'}
                                      {!tableRow.original.folder && !tableRow.original.isReal && (
                                        <span className="text-red-500 text-[10px]">*</span>
                                      )}
                                    </span>
                                  )}

                                  {isPickerOpen && pickerRowIndex === visualIndex && (
                                    <div
                                      className={clsx(
                                        'absolute left-0 z-[100] transform transition-all animate-in fade-in zoom-in duration-150',
                                        visualIndex > tableData.length * 0.7 ? 'bottom-full mb-2' : 'top-full mt-2',
                                      )}
                                      onClick={e => e.stopPropagation()}>
                                      <SaveDestinationPicker
                                        className="!w-[320px]"
                                        team={orgTeam}
                                        personalWorkspaces={personalWorkspaces}
                                        currentSelection={{
                                          workspaceId: tableRow.original.workspace_id,
                                          folderId: tableRow.original.folder_id ?? null,
                                        }}
                                        onSelectWorkspace={(ws: any) => {
                                          updateRowLocation(
                                            tableRow.original.id,
                                            ws.workspace_id,
                                            ws.workspace_name,
                                            null,
                                            null,
                                            [],
                                            {
                                              isPersonal: ws.is_personal || ws.team_name === 'Personal Space',
                                              type: ws.type,
                                              label: ws.is_public ? 'Public' : ws.is_shared ? 'Shared' : 'Private',
                                            },
                                            dispatch,
                                            allTeams,
                                          );
                                        }}
                                        onSelectFolder={(ws: any, folder: any, isP?: boolean, pNames?: any[]) => {
                                          const names = pNames?.map((f: any) => f.folder_name) || [folder.folder_name];
                                          updateRowLocation(
                                            tableRow.original.id,
                                            ws.workspace_id,
                                            ws.workspace_name,
                                            folder.folder_id,
                                            folder.folder_name,
                                            names,
                                            {
                                              isPersonal: isP,
                                              type: ws.type,
                                              label: ws.is_public ? 'Public' : ws.is_shared ? 'Shared' : 'Private',
                                            },
                                            dispatch,
                                            allTeams,
                                          );
                                        }}
                                        onClose={closePicker}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : index === 4 ? (
                                <div className="flex justify-center w-full">
                                  {value && <VisualKeyDisplay hotkey={value} variant="text" />}
                                </div>
                              ) : index === 5 && value ? (
                                <div className="flex justify-center w-full">
                                  <span className={clsx(
                                    "text-[11px] font-normal",
                                    isDarkMode ? "text-white" : "text-slate-700"
                                  )}>
                                    /{value.replace(/^\//, '')}
                                  </span>
                                </div>
                              ) : cell.column.id === 'url' ? (
                                (() => {
                                  if (
                                    tableRow.original.section === 'Notes' ||
                                    tableRow.original.section === 'Snippets' ||
                                    tableRow.original.section === 'Prompts'
                                  ) {
                                    const urls = tableRow.original.urls || [];
                                    // If Note has URLs, show them like Links. If not, show plain text snippet content.
                                    if (urls.length > 0) {
                                      // Fall through to standard URL rendering logic below
                                    } else {
                                      return (
                                        <div className={clsx(
                                          "flex-1 truncate text-[11px] leading-tight flex items-center gap-1",
                                          isDarkMode ? "text-white" : "text-slate-700"
                                        )}>
                                          {tableRow.original.value ? (
                                            String(tableRow.original.value)
                                              .replace(/<[^>]*>?/gm, '')
                                              .replace(/&nbsp;/g, ' ')
                                              .trim()
                                          ) : (
                                            <>
                                              {!tableRow.original.isReal && (
                                                <span className="text-red-500 font-bold text-[10px]">*</span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      );
                                    }
                                  }

                                  const isAutomation =
                                    tableRow.original.section === 'My Saved Automations' ||
                                    tableRow.original.section === 'Automation Store' ||
                                    tableRow.original.section === 'Installed Modules' ||
                                    tableRow.original.category === 'automation' ||
                                    tableRow.original.type === 'automationModule';

                                  const isAgent =
                                    tableRow.original.section === 'Chat Agents' || tableRow.original.category === 'agent';

                                  if (isAutomation) {
                                    const steps =
                                      tableRow.original.automationData?.steps ||
                                      tableRow.original.automationData?.automation_steps ||
                                      tableRow.original.automationData?.execution_steps ||
                                      [];

                                    // 🚀 Priority 1: If editing, ALWAYS show the automation steps editor
                                    if (isSelected && isEditing) {
                                      const currentParamConfigs = resolveParamConfigs(tableRow.original.automationData);
                                      return (
                                        <GridAutomationStepInput
                                          itemId={tableRow.original.id}
                                          steps={steps}
                                          globalParamConfigs={currentParamConfigs}
                                          onSave={() => {
                                            setEditingCell(null);
                                          }}
                                          onCancel={() => {
                                            setEditingCell(null);
                                          }}
                                          onUpdateStepPrimaryValue={(stepId, newValue) => {
                                            const currentData = tableRow.original.automationData;
                                            if (!currentData) return;
                                            const updatedSteps = (
                                              currentData.steps ||
                                              currentData.automation_steps ||
                                              []
                                            ).map((s: any) => {
                                              if (s.id === stepId || s.step_id === stepId) {
                                                const mId = String(s.moduleId || s.module_id || '');
                                                const config = { ...s.config };
                                                if (mId === 'wait') config.delay = Number(newValue) || 0;
                                                else if (mId === 'paste') config.content = newValue;
                                                else if (mId === 'clipboard_write') config.text = newValue;
                                                else if (mId === 'click' || mId === 'clipboard_paste')
                                                  config.selectorElementName = newValue;
                                                else config.url = newValue;
                                                return { ...s, config };
                                              }
                                              return s;
                                            });
                                            const updatedData = { ...currentData, steps: updatedSteps };
                                            updateCellData(
                                              tableRow.original.id,
                                              index,
                                              'automationData',
                                              updatedData,
                                              dispatch,
                                              allTeams,
                                            );
                                          }}
                                          onUpdateStepConfig={(stepId, newConfig) => {
                                            const currentData = tableRow.original.automationData;
                                            if (!currentData) return;
                                            const updatedSteps = (
                                              currentData.steps ||
                                              currentData.automation_steps ||
                                              []
                                            ).map((s: any) =>
                                              s.id === stepId || s.step_id === stepId
                                                ? { ...s, config: { ...s.config, ...newConfig } }
                                                : s,
                                            );
                                            const updatedData = { ...currentData, steps: updatedSteps };
                                            updateCellData(
                                              tableRow.original.id,
                                              index,
                                              'automationData',
                                              updatedData,
                                              dispatch,
                                              allTeams,
                                            );
                                          }}
                                        />
                                      );
                                    }

                                    // 🚀 Priority 2: Preview for rows with steps
                                    if (steps.length > 0) {
                                      const getStepName = (mId: any) => {
                                        const id = String(mId || '');
                                        switch (id) {
                                          case 'open_tab':
                                          case 'open_url':
                                            return 'Open Link';
                                          case 'paste':
                                          case 'insert_text':
                                            return 'Fill Input';
                                          case 'wait':
                                          case 'wait_duration':
                                          case 'wait_for_navigation':
                                          case 'wait_for_element':
                                            return 'Wait';
                                          case 'clipboard_write':
                                            return 'Write Clipboard';
                                          case 'clipboard_paste':
                                            return 'Paste Clipboard';
                                          case 'agent':
                                            return 'Agent Step';
                                          case 'sub_automation':
                                            return 'Sub-Automation';
                                          default:
                                            return null;
                                        }
                                      };

                                      const stepNames = steps
                                        .map((s: any) => getStepName(s.moduleId || s.module_id || s.action))
                                        .filter(Boolean);

                                      const visibleSteps = stepNames.slice(0, 25).join(', ');
                                      const moreCount = stepNames.length - 25;

                                      return (
                                        <div className={clsx(
                                          "flex items-center w-full text-[10px] overflow-hidden font-normal",
                                          isDarkMode ? "text-neutral-400" : "text-slate-700"
                                        )}>
                                          <span className="truncate flex-1">{visibleSteps}</span>
                                          {moreCount > 0 && (
                                            <span className={clsx(
                                              "ml-1 text-[9px] font-normal shrink-0 px-1.5 rounded whitespace-nowrap",
                                              isDarkMode ? "text-neutral-400 bg-neutral-800" : "text-neutral-900 bg-slate-100"
                                            )}>
                                              +{moreCount} more
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }

                                    // 🚀 Priority 3: Fallback to description for modules/automations without steps
                                    const rawVal = tableRow.original.url || tableRow.original.value || '';
                                    let decodedVal = rawVal.includes('%') ? decodeURIComponent(rawVal) : rawVal;

                                    // If decodedVal is just dots or very short, try to use mod name or a better placeholder
                                    if (decodedVal === '......' || !decodedVal) {
                                      decodedVal =
                                        tableRow.original.name !== 'Untitled Module'
                                          ? `Module: ${tableRow.original.name}`
                                          : '';
                                    }

                                    if (decodedVal) {
                                      return (
                                        <div className="text-slate-500 italic text-[10px] truncate h-full px-1">
                                          {decodedVal}
                                        </div>
                                      );
                                    }

                                    // 🚀 Priority 4: Placeholder for empty/new automation rows
                                    return (
                                      <div className={clsx(
                                        "italic text-[10px] flex items-center gap-1.5 h-full px-1",
                                        isDarkMode ? "text-neutral-500" : "text-slate-500"
                                      )}>
                                        <FiZap size={10} className="text-[var(--color-iconDefault)]" />
                                        No steps - press Enter to add
                                      </div>
                                    );
                                  }

                                  const urls = tableRow.original.urls || [];
                                  // Only show editor if SPECIFICALLY in edit mode
                                  if (isSelected && isEditing) {
                                    return (
                                      <GridMultiLinkInput
                                        initialUrls={urls}
                                        onSave={val =>
                                          updateCellData(
                                            tableRow.original.id,
                                            index,
                                            cell.column.id,
                                            val,
                                            dispatch,
                                            allTeams,
                                          )
                                        }
                                        onCancel={() => setEditingCell(null)}
                                      />
                                    );
                                  }

                                  const displayUrls = urls.length > 0 ? urls : [value || ''];
                                  const domains = displayUrls.map((u: string) => {
                                    try {
                                      const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
                                      return hostname.replace('www.', '');
                                    } catch {
                                      return u;
                                    }
                                  });

                                  const topThree = domains.slice(0, 3).join(', ');
                                  const moreCount = domains.length - 3;

                                  return (
                                    <div className={clsx(
                                      "group/url flex items-center w-full text-[10px] overflow-hidden font-normal relative h-full",
                                      isDarkMode ? "text-white" : "text-slate-700"
                                    )}>
                                      <div className="flex flex-col w-full group-hover/row:py-1">
                                        {/* Collapsed View */}
                                        <div
                                          className={clsx(
                                            'flex items-center w-full transition-opacity',
                                            isSelected ? 'hidden' : 'flex',
                                          )}>
                                          <span className="truncate flex-1">{topThree}</span>
                                          {moreCount > 0 && (
                                            <span className={clsx(
                                              "ml-1 text-[9px] font-normal shrink-0 whitespace-nowrap transition-colors",
                                              isDarkMode
                                                ? "text-neutral-500 group-hover/row:text-blue-400"
                                                : "text-slate-400 group-hover/row:text-blue-500"
                                            )}>
                                              +{moreCount} more
                                            </span>
                                          )}
                                        </div>

                                        {/* Expanded View on Cell Selection */}
                                        <div className={clsx('flex-col gap-1.5 w-full', isSelected ? 'flex' : 'hidden')}>
                                          {urls.map((u, i) => (
                                            <div
                                              key={i}
                                              className={clsx(
                                                "text-[10px] hover:text-blue-600 transition-colors break-all leading-tight border-b last:border-0 pb-1",
                                                isDarkMode ? "text-white border-white/5" : "text-slate-700 border-slate-100"
                                              )}>
                                              {u}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : (
                                flexRender(cell.column.columnDef.cell, cell.getContext())
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {contextMenuPos && selectedRowForTodo && (
        <UnifiedContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setContextMenuPos(null)}
          actions={[
            {
              key: 'create-todo',
              label: 'Create Todo',
              icon: <BsCalendarCheck size={14} />,
              onSelect: () => {
                if (!selectedRowForTodo) return;
                dispatch(
                  setTodoCreatePrefill({
                    snippet_id: selectedRowForTodo.snippet_id || selectedRowForTodo.id,
                    key: selectedRowForTodo.name || selectedRowForTodo.key || '',
                    category: selectedRowForTodo.category || 'note',
                    value: selectedRowForTodo.value || selectedRowForTodo.url || '',
                    event_deadline: selectedRowForTodo.event_deadline,
                    is_recurring: selectedRowForTodo.is_recurring,
                    recurring_cycle: selectedRowForTodo.recurring_cycle,
                    reminder: selectedRowForTodo.reminder,
                  }),
                );
                dispatch(setShowTodosView(true));
                setContextMenuPos(null);
                setSelectedRowForTodo(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
};

export default SheetTable;
