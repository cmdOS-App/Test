import React, { useState, useRef, useEffect } from 'react';
import { FaSearch, FaFilter, FaTrashAlt, FaTimes, FaPlus } from 'react-icons/fa';
import { FiX, FiMoreVertical } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import { FcExpand } from 'react-icons/fc';
import { Team } from '../../../../../modals/interfaces';
import { getAvatarColor, getSingleInitial } from '../../../utils/avatarColors';
import { NONE_TEAM } from '../../../../../Redux/AllData/uiStateSlice';

interface SidebarSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFilterClick?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onBulkDeleteClick?: () => void;
  isBulkDeleteMode?: boolean;
  isAutoExpandMode?: boolean;
  onToggleAutoExpand?: () => void;
  onExportClick?: () => void;
  isDarkMode?: boolean;
  isSheetUIOpen?: boolean;
  activeTutorial?: string | null;
  teams?: Team[];
  selectedTeamId?: string;
  onOrgSwitch?: (team: Team) => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

const SidebarSearchBar = React.forwardRef<HTMLInputElement, SidebarSearchBarProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Search folders...',
      onFilterClick,
      onFocus,
      onBlur,
      onBulkDeleteClick,
      isBulkDeleteMode = false,
      isAutoExpandMode = false,
      onToggleAutoExpand,
      onExportClick,
      isDarkMode,
      isSheetUIOpen,
      activeTutorial,
      teams = [],
      selectedTeamId,
      onOrgSwitch,
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
    const localInputRef = useRef<HTMLInputElement>(null);

    // Combine refs if both are provided
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || localInputRef;

    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleFocus = () => {
      setIsFocused(true);
      onFocus?.();
    };

    const handleBlur = () => {
      setIsFocused(false);
      onBlur?.();
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onChange('');
      inputRef.current?.focus();
    };

    const handleSearchIconClick = () => {
      inputRef.current?.focus();
    };

    const handleMenuClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.left - 110, // Position menu to the left of the button
        });
      }
      setIsMenuOpen(!isMenuOpen);
    };

    const handleFilterOptionClick = () => {
      setIsMenuOpen(false);
      onFilterClick?.();
    };

    const handleBulkDeleteOptionClick = () => {
      setIsMenuOpen(false);
      onBulkDeleteClick?.();
    };

    const handleToggleAutoExpand = () => {
      setIsMenuOpen(false);
      onToggleAutoExpand?.();
    };

    const handleExportClick = () => {
      setIsMenuOpen(false);
      onExportClick?.();
    };

    // Close menu when clicking outside
    useEffect(() => {
      if (!isMenuOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        const path = event.composedPath?.() || [];
        if (
          menuRef.current &&
          !path.includes(menuRef.current) &&
          menuButtonRef.current &&
          !path.includes(menuButtonRef.current)
        ) {
          setIsMenuOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isMenuOpen]);

    // Close menu on escape key
    useEffect(() => {
      if (!isMenuOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMenuOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isMenuOpen]);

    const isTutorialActive = activeTutorial === 'search' || activeTutorial === 'agent' || activeTutorial === 'sidebar';

    return (
      <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
        <div
          className={`relative flex items-center ${isDarkMode
            ? 'bg-frostedwhite border-neutral-700'
            : isSheetUIOpen
              ? 'bg-white border-neutral-200'
              : 'bg-[#fdf6e3] border-white'
            } border rounded-lg overflow-hidden w-full ${isFocused ? 'shadow-sm' : ''} ${isTutorialActive ? 'border-[#22c55e] pointer-events-none' : ''
            }`}
          style={{
            borderColor: isTutorialActive ? '#22c55e' : undefined,
          }}>
          {/* Search Icon - Always visible */}
          <button
            type="button"
            onClick={handleSearchIconClick}
            className={`flex-shrink-0 p-1.5 cursor-pointer ${isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-[#586e75] hover:text-[#073642]'
              }`}
            aria-label="Search">
            <FaSearch size={12} />
          </button>

          {/* Input Field - Always Visible */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={`flex-1 bg-transparent text-[12px] outline-none min-w-0 py-1 pr-1 placeholder-[var(--color-textPlaceholder)] ${isDarkMode ? 'text-neutral-200' : 'text-[#073642]'
              }`}
          />

          {/* Shortcut Hint - Removed Alt+A */}

          {/* Clear Button - Only has value */}
          {value.trim() && (
            <button
              type="button"
              onClick={handleClear}
              className="text-red-300 hover:text-red-400 mr-1 cursor-pointer"
              aria-label="Clear search">
              <FaTimes size={10} />
            </button>
          )}
        </div>

        {/* Filter Button - Separate for better visibility */}
        {/* {onFilterClick && (isFilterActive || isFilterPanelOpen) && (
          <button
            type="button"
            onClick={onFilterClick}
            className={`flex-shrink-0 p-1.5 rounded-lg border transition-all ${
              isFilterActive
                ? isDarkMode
                  ? 'bg-[#cb4b16]/20 border-[#cb4b16]/50 text-[#cb4b16]'
                  : 'bg-[#cb4b16]/10 border-[#cb4b16]/30 text-[#cb4b16]'
                : isDarkMode
                  ? 'bg-neutral-800/80 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600'
                  : 'bg-[#fdf6e3] border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
            aria-label="Filter"
            title="Filter options">
            <FaFilter size={12} />
          </button>
        )} */}

        {/* Three Dot Menu Button - For remaining options like Bulk Delete */}
        {onBulkDeleteClick && (
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleMenuClick}
            className={`flex-shrink-0 p-1.5 rounded-lg border relative ${isMenuOpen || isBulkDeleteMode
              ? isDarkMode
                ? 'bg-neutral-800/80 border-neutral-600 text-neutral-300'
                : isSheetUIOpen
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                  : 'bg-[#eee8d5] border-neutral-300 text-neutral-800'
              : isDarkMode
                ? 'bg-neutral-800/80 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600'
                : isSheetUIOpen
                  ? 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  : 'bg-[#fdf6e3] border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            aria-label="More options"
            title="More options">
            <FiMoreVertical size={14} />
            {/* Active indicator dot for Bulk Delete */}
            {isBulkDeleteMode && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#cb4b16] rounded-full transform translate-x-1 -translate-y-1 shadow-sm" />
            )}
          </button>
        )}

        {/* Dropdown Menu Portal */}
        {isMenuOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-start justify-start">
              {/* Backdrop WITHOUT Blur */}
              <div className="absolute inset-0 bg-transparent" onClick={() => setIsMenuOpen(false)} />

              {/* Menu */}
              <div
                ref={menuRef}
                className={`fixed z-50 flex flex-col ${isDarkMode
                  ? 'bg-frostedwhite border-neutral-700/50'
                  : isSheetUIOpen
                    ? 'bg-white border-neutral-200 shadow-xl'
                    : 'bg-[#fdf6e3]/95 border-neutral-200'
                  } rounded-lg shadow-xl border py-1 w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100`}
                style={{ top: menuPosition.top, left: menuPosition.left }}
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div
                  className={`px-3 pt-2 pb-1 text-[10px] font-medium ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} tracking-wider`}>
                  Options
                </div>

                {/* Auto Expand Folders Option */}
                {onToggleAutoExpand && (
                  <button
                    onClick={handleToggleAutoExpand}
                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 ${isAutoExpandMode
                      ? (isDarkMode
                        ? 'text-neutral-300 hover:bg-neutral-700'
                        : 'text-neutral-700 hover:bg-neutral-100') + ' font-bold'
                      : (isDarkMode
                        ? 'text-neutral-300 hover:bg-neutral-700'
                        : 'text-neutral-700 hover:bg-neutral-100') + ' font-bold'
                      }`}>
                    <FcExpand size={12} className={isAutoExpandMode ? 'text-neutral-600' : 'text-neutral-500'} />
                    <span className="flex-1 flex items-center gap-2">
                      {isAutoExpandMode ? 'Collapse Folders' : 'Expand Folders'}
                    </span>
                  </button>
                )}

                {/* Export to Excel Option */}
                {onExportClick && (
                  <button
                    onClick={handleExportClick}
                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 ${isDarkMode ? 'text-neutral-300 hover:bg-neutral-700' : 'text-neutral-700 hover:bg-neutral-100'
                      }`}>
                    <FaPlus size={12} className="text-blue-500" />
                    <span className="flex-1 flex items-center gap-2">Export to Excel</span>
                  </button>
                )}

                {/* Bulk Delete Option */}
                {onBulkDeleteClick && (
                  <button
                    onClick={handleBulkDeleteOptionClick}
                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 ${isBulkDeleteMode
                      ? isDarkMode
                        ? 'text-red-400 bg-red-900/20'
                        : 'text-red-700 bg-red-100'
                      : isDarkMode
                        ? 'text-neutral-300 hover:bg-neutral-700'
                        : 'text-neutral-700 hover:bg-[#f5f0e8]'
                      }`}>
                    <FaTrashAlt size={12} className={isBulkDeleteMode ? 'text-red-600' : 'text-neutral-500'} />
                    <span className="flex-1 flex items-center gap-2">
                      Bulk Delete
                      {isBulkDeleteMode && (
                        <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded-full">Active</span>
                      )}
                    </span>
                  </button>
                )}

                {/* Organizations Section */}
                {teams.length > 0 && (
                  <>
                    <div className="border-t border-[var(--color-borderDefault)] my-1 mx-2" />
                    <div
                      className={`px-3 pt-1 pb-1 text-[10px] font-medium ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} tracking-wider`}>
                      Organizations
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar px-1.5 space-y-0.5">
                      {/* None/Personal Option */}
                      <button
                        onClick={() => {
                          const personalTeam = teams.find(t => t.is_personal_space);
                          if (onOrgSwitch) {
                            onOrgSwitch(personalTeam || (NONE_TEAM as any));
                          }
                          setIsMenuOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${!selectedTeamId || teams.find(t => t.team_id === selectedTeamId)?.is_personal_space
                          ? isDarkMode
                            ? 'bg-purple-900/30 text-purple-300'
                            : 'bg-purple-50 text-purple-700'
                          : isDarkMode
                            ? 'text-neutral-300 hover:bg-neutral-700'
                            : 'text-neutral-700 hover:bg-neutral-100'
                          }`}>
                        <div className="w-4 h-4 rounded-full bg-neutral-400 flex items-center justify-center text-[8px] text-white font-bold shrink-0">
                          N
                        </div>
                        <span className="truncate flex-1">None (Personal)</span>
                        {(!selectedTeamId || teams.find(t => t.team_id === selectedTeamId)?.is_personal_space) && (
                          <span className="text-[8px]">✓</span>
                        )}
                      </button>

                      {/* Team List */}
                      {teams
                        .filter(t => !t.is_personal_space)
                        .map(team => (
                          <button
                            key={team.team_id}
                            onClick={() => {
                              if (onOrgSwitch) onOrgSwitch(team);
                              setIsMenuOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${selectedTeamId === team.team_id
                              ? isDarkMode
                                ? 'bg-purple-900/30 text-purple-300'
                                : 'bg-purple-50 text-purple-700'
                              : isDarkMode
                                ? 'text-neutral-300 hover:bg-neutral-700'
                                : 'text-neutral-700 hover:bg-neutral-100'
                              }`}>
                            <div
                              className={`w-4 h-4 rounded-full ${getAvatarColor(team.team_name)} flex items-center justify-center text-[8px] text-white font-bold shrink-0`}>
                              {getSingleInitial(team.team_name)}
                            </div>
                            <span className="truncate flex-1">{team.team_name}</span>
                            {selectedTeamId === team.team_id && <span className="text-[8px]">✓</span>}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

export default SidebarSearchBar;
