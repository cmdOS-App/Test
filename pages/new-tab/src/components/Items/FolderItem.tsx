import React, { useState, useRef, useEffect } from 'react';
import { FaFileAlt, FaLink, FaLayerGroup } from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import { FiEdit2, FiPlay, FiStar, FiTrash2 } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { openLinkEditModal, setSelectedSnippet, setIsCreatingNewItem } from '../../../../Redux/AllData/uiStateSlice';
import type { Snippet, Workspace, Folder } from '../../../../modals/interfaces';
import { useSnippetItem } from '@src/hooks/useSnippetItem';

const extractUrlsFromSnippet = (snippet: Snippet): string[] => {
  if (!snippet?.value) return [];

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).urls)) {
        return ((parsed as any).urls as string[]).filter(Boolean);
      }
    } catch {
      if (raw.startsWith('http')) return [raw];
    }
    if (raw.startsWith('http')) return [raw];
    return [];
  }

  if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      return ((snippet.value as any).urls as string[]).filter(Boolean);
    }
  }

  return [];
};

import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

interface FolderItemProps {
  snippet: Snippet;
  workspace: Workspace;
  folder: Folder | null;
  index: number;
  reload: () => void;
  selectedItem: string | null;
  selectedTeamId: string;
  favoritesMapping: { [teamId: string]: Snippet[] };
  setFavoritesMapping: (mapping: { [teamId: string]: Snippet[] }) => void;
  snippetList: Snippet[];
  moveSnippet: (fromIndex: number, toIndex: number) => void;
  userId: string;
  isFocused?: boolean;
  isMenuOpen?: boolean;
  onToggleMenu?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

const FolderItem: React.FC<FolderItemProps> = ({
  snippet,
  workspace,
  folder,
  index,
  reload,
  selectedItem,
  selectedTeamId,
  favoritesMapping,
  setFavoritesMapping,
  snippetList,
  moveSnippet,
  userId,
  isFocused = false,
  isMenuOpen = false,
  onToggleMenu,
  onClick,
  onDoubleClick,
}) => {
  const dispatch = useDispatch();
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const {
    getItemTypeLabel,
    getItemContent,
    handleClickItem,
    isFav,
    toggleFavorite,
    handleShowDelete,
    handleCopyContent,
  } = useSnippetItem({
    userId,
    snippet,
    workspace,
    folder,
    reload,
    selectedItem,
    selectedTeamId,
    favoritesMapping,
    setFavoritesMapping,
    index,
    moveSnippet,
    snippetList,
    isWorkspaceLevel: false,
  });

  const isLink = snippet.category.toLowerCase() === 'link';
  const isSelected = selectedItem === snippet.id;

  // Render Icon
  const renderIcon = () => {
    if (isLink) {
      const url = snippet.value as string;
      const favicon = getFaviconUrl(url);
      if (favicon) {
        return <img src={favicon} alt="" className="w-5 h-5 rounded-md shadow-sm" />;
      }
      return <FaLink className="text-neutral-500 w-5 h-5" />;
    }
    if (snippet.category === 'TabGroup') {
      return <FaLayerGroup className="text-neutral-500 w-5 h-5" />;
    }
    return <NotesIcon size={20} className="text-neutral-500" />;
  };

  const title = snippet.key || (isLink ? 'Untitled Link' : 'Untitled Note');
  const preview = React.useMemo(() => {
    const rawVal = snippet.value;
    if (!rawVal) return '';

    // Convert to string if it's an object
    let strVal = '';
    if (typeof rawVal === 'string') {
      strVal = rawVal;
    } else {
      try {
        strVal = JSON.stringify(rawVal);
      } catch {
        return '';
      }
    }

    // Strip HTML tags and entities
    const stripped = strVal
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    return stripped.length > 100 ? stripped.substring(0, 100) + '...' : stripped;
  }, [snippet.value]);
  const tagMeta = getItemTypeLabel(snippet.category);

  useEffect(() => {
    if (!isMenuOpen || !onToggleMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onToggleMenu();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Menu Navigation Logic
  const [menuIndex, setMenuIndex] = useState(0);

  useEffect(() => {
    if (!isMenuOpen) {
      setMenuIndex(0);
      return;
    }

    const handleMenuKeyDown = (e: KeyboardEvent) => {
      // We only handle menu navigation keys here
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setMenuIndex(prev => (prev < 3 ? prev + 1 : 0)); // 4 items: Open, Edit, Fav, Delete
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setMenuIndex(prev => (prev > 0 ? prev - 1 : 3));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Execute action based on index
        if (menuIndex === 0) {
          handleActionClick(() => handleClickItem(snippet)); // Open
        } else if (menuIndex === 1) {
          handleActionClick(() => {
            // Edit
            const category = (snippet.category || '').toLowerCase();
            const isTabGroup = category === 'tabgroup' || category === 'tab group';

            if (isLink || isTabGroup) {
              // For TabGroup, dispatch event to open bulk editor
              if (isTabGroup) {
                dispatch(setSelectedSnippet(snippet));
                dispatch(setIsCreatingNewItem(false));
                window.dispatchEvent(new CustomEvent('openBulkEditor', { detail: { snippet } }));
              } else {
                dispatch(openLinkEditModal({ editMode: true, snippet }));
              }
            } else {
              handleClickItem(snippet);
            }
          });
        } else if (menuIndex === 2) {
          handleActionClick(() => toggleFavorite(snippet)); // Favorite
        } else if (menuIndex === 3) {
          handleActionClick(handleShowDelete); // Delete
        }
      }
    };

    window.addEventListener('keydown', handleMenuKeyDown);
    return () => window.removeEventListener('keydown', handleMenuKeyDown);
  }, [isMenuOpen, menuIndex, snippet, isLink, dispatch, handleClickItem, toggleFavorite, handleShowDelete]);

  // Scroll logic for focused item
  useEffect(() => {
    if (isFocused && itemRef.current) {
      setTimeout(() => {
        itemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 50);
    }
  }, [isFocused]);

  const handleActionClick = (action: () => void) => {
    action();
    if (onToggleMenu) onToggleMenu();
  };

  const isActive = isHovered || isFocused || isMenuOpen;

  return (
    <div
      ref={itemRef}
      className={`group relative cursor-pointer px-2 py-2 transition-colors duration-200 ${
        isSelected
          ? 'bg-[var(--color-activeBg)] shadow-sm ring-1 ring-[var(--color-borderFocus)] z-10'
          : isActive
            ? 'bg-[var(--color-hoverBg)] z-50'
            : 'hover:bg-[var(--color-hoverBg)]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={e => {
        if ((e.target as HTMLElement).closest('[data-menu-button]')) return;
        if (onClick) onClick();
      }}
      onDoubleClick={e => {
        if ((e.target as HTMLElement).closest('[data-menu-button]')) return;
        if (onDoubleClick) onDoubleClick();
        else handleClickItem(snippet); // Fallback
      }}>
      <div className="flex items-center gap-2 h-8 relative">
        {/* Icon */}
        <div className="flex items-center justify-center text-neutral-500 flex-shrink-0 w-8">{renderIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0 h-full relative">
          {/* Non-hover/Non-focused state */}
          <div
            className={`absolute inset-0 flex items-center gap-2 transition-all duration-200 ${
              isActive ? 'opacity-0 translate-y-[-4px]' : 'opacity-100 translate-y-0'
            }`}>
            <span className="text-[16.2px] font-normal text-[#F5F5F5] truncate" style={headingFontStyle}>
              {title}
            </span>
            <span className="text-[9px] tracking-wide text-neutral-500 flex-shrink-0 whitespace-nowrap">
              {tagMeta.label}
            </span>
          </div>

          {/* Hover/Focused state */}
          <div
            className={`absolute inset-0 flex flex-col justify-center transition-all duration-200 ${
              isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[4px]'
            }`}>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[16.2px] font-normal text-[#F5F5F5] truncate" style={headingFontStyle}>
                {title}
              </span>
              <span className="text-[9px] tracking-wide text-neutral-500 flex-shrink-0 whitespace-nowrap">
                {tagMeta.label}
              </span>
            </div>
            <p className="text-[12px] text-neutral-500 truncate leading-tight mt-0.5">
              {isLink ? (snippet.value as string) : preview}
            </p>
          </div>
        </div>

        {/* Menu Popup (Triggered via Alt+E) */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-[100] mt-1 w-40 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-1 shadow-2xl">
            <button
              onClick={() => handleActionClick(() => handleClickItem(snippet))}
              onMouseEnter={() => setMenuIndex(0)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition ${
                menuIndex === 0
                  ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                  : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
              }`}>
              <FiPlay size={14} /> Open
            </button>
            <button
              onClick={() =>
                handleActionClick(() => {
                  const category = (snippet.category || '').toLowerCase();
                  const isTabGroup = category === 'tabgroup' || category === 'tab group';

                  if (isLink || isTabGroup) {
                    // For TabGroup, dispatch event to open bulk editor
                    if (isTabGroup) {
                      dispatch(setSelectedSnippet(snippet));
                      dispatch(setIsCreatingNewItem(false));
                      window.dispatchEvent(new CustomEvent('openBulkEditor', { detail: { snippet } }));
                    } else {
                      dispatch(openLinkEditModal({ editMode: true, snippet }));
                    }
                  } else {
                    handleClickItem(snippet);
                  }
                })
              }
              onMouseEnter={() => setMenuIndex(1)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition ${
                menuIndex === 1
                  ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                  : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
              }`}>
              <FiEdit2 size={14} /> Edit
            </button>
            <button
              onClick={() => handleActionClick(() => toggleFavorite(snippet))}
              onMouseEnter={() => setMenuIndex(2)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition ${
                menuIndex === 2
                  ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                  : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
              }`}>
              {isFav ? <FaLink className="text-yellow-500" size={14} /> : <FiStar size={14} />}
              {isFav ? 'Unfavorite' : 'Favorite'}
            </button>
            <button
              onClick={() => handleActionClick(handleShowDelete)}
              onMouseEnter={() => setMenuIndex(3)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition ${
                menuIndex === 3
                  ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                  : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
              }`}>
              <FiTrash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderItem;
