import { FaEdit, FaLock, FaLockOpen, FaStar, FaTasks, FaTrash } from 'react-icons/fa';
import type { Snippet } from '../../../../modals/interfaces';
import { AiOutlineGlobal } from 'react-icons/ai';
import { MdOutlineContentCopy } from 'react-icons/md';
import { IoShareSocial } from 'react-icons/io5';
import { CiStar } from 'react-icons/ci';
import { useSnippetItem } from '@src/hooks/useSnippetItem';
import { useState } from 'react';

type SnippetActionsProps = {
  snippet: Snippet;
  userId: string;
  isFav: boolean;
  isLocked: boolean;
  toggleFavorite: (e?: React.MouseEvent) => void;
  toggleLock: (e: React.MouseEvent) => void;
  onEditLink?: (e?: React.MouseEvent) => void;
  onTodo?: (e?: React.MouseEvent) => void;
  onDelete?: (e?: React.MouseEvent) => void;
  onCopy?: (e?: React.MouseEvent) => void;
  onShare?: (e?: React.MouseEvent) => void;
  onPublicLinks?: (e?: React.MouseEvent) => void;
  view?: 'grid' | 'list';
};

export const SnippetActions: React.FC<SnippetActionsProps> = ({
  snippet,
  userId,
  isFav,
  isLocked,
  toggleFavorite,
  toggleLock,
  onEditLink,
  onTodo,
  onDelete,
  onCopy,
  onShare,
  onPublicLinks,
  view = 'list',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isLinkOrTabGroup = ['link', 'tabgroup'].includes(snippet.category.toLowerCase());

  // Get item size using useSnippetItem hook
  const { getItemSize } = useSnippetItem({
    userId,
    snippet,
    workspace: null,
    folder: null,
    reload: () => {},
    selectedItem: null,
    selectedTeamId: '',
    favoritesMapping: {},
    setFavoritesMapping: () => {},
    index: 0,
    moveSnippet: () => {},
    snippetList: [],
  });

  const itemSize = getItemSize(snippet);

  // Helper function to stop propagation for all action buttons
  const handleClick = (e: React.MouseEvent, callback?: (e: React.MouseEvent) => void) => {
    e.stopPropagation();
    if (callback) callback(e);
  };

  return (
    <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div
        className={`
        flex items-center gap-2 
        opacity-0 group-hover:opacity-100 
        transition-all duration-200
        ${isHovered ? 'shadow-lg bg-[var(--color-containerBg)] rounded-lg p-2' : ''}
      `}>
        <button onClick={e => handleClick(e, onTodo)} title="Create Todo">
          <FaTasks className="action-icon" size={16} />
        </button>
        {view !== 'grid' && (
          <button onClick={e => handleClick(e, onPublicLinks)} title="View public links">
            <AiOutlineGlobal className="action-icon" size={16} />
          </button>
        )}
        <button onClick={e => handleClick(e, onCopy)} title="Copy content">
          <MdOutlineContentCopy className="action-icon" size={16} />
        </button>
        {isLinkOrTabGroup && (
          <button onClick={e => handleClick(e, onEditLink)} title="Edit">
            <FaEdit className="action-icon" size={16} />
          </button>
        )}

        {userId === snippet.user_id && (
          <button onClick={e => handleClick(e, onShare)} title="Share">
            <IoShareSocial className="action-icon" size={16} />
          </button>
        )}
        {view !== 'grid' && (
          <button onClick={e => handleClick(e, toggleLock)} title={isLocked ? 'Unlock' : 'Lock'}>
            {isLocked ? <FaLock className="action-icon" size={16} /> : <FaLockOpen className="action-icon" size={16} />}
          </button>
        )}
        <button onClick={e => handleClick(e, toggleFavorite)} title={isFav ? 'Unfavorite' : 'Favorite'}>
          {isFav ? (
            <FaStar className="text-yellow-500 hover:scale-125 transition-all" size={18} />
          ) : (
            <CiStar className="text-yellow-400 hover:text-yellow-600 hover:scale-125" size={20} />
          )}
        </button>
        <button onClick={e => handleClick(e, onDelete)} title="Delete">
          <FaTrash className="text-red-500 hover:text-red-700 transition-all" size={16} />
        </button>
      </div>

      {/* Size information popup */}
    </div>
  );
};
