import type { ItemProps } from '@src/types';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import { AiOutlineGlobal } from 'react-icons/ai';
import DeleteConfirmation from '../Modals/DeleteDialog';
import ShareDialog from '../Modals/ShareDialog';
import { useSnippetItem } from '@src/hooks/useSnippetItem';
import PublicLinksDialog from '../Modals/PublicLinksDialog';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  viewSnippet,
  openLinkEditModal,
  setSelectedSnippet,
  setIsCreatingNewItem,
  setTodoCreatePrefill,
  setShowTodosView,
} from '../../../../Redux/AllData/uiStateSlice';
import { SnippetActions } from '../snippets/SnippetActions';
import { useSnippetDragAndLock } from '@src/hooks/useSnippetDragAndLock';

export const GridItem: React.FC<ItemProps> = ({
  userId,
  snippet,
  workspace,
  folder,
  reload,
  selectedItem,
  selectedTeamId,
  favoritesMapping,
  setFavoritesMapping,
  isWorkspaceLevel = false,
  index,
  moveSnippet,
  snippetList,
}) => {
  const dispatch = useDispatch();

  const {
    getItemIcon,
    getItemTypeLabel,
    toggleFavorite,
    getItemContent,
    handleShowDelete,
    handleDeleteItem,
    handleCopyContent,
    handleClickItem,
    isFav,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isShareDialogOpen,
    setIsShareDialogOpen,
    isPublicLinkDialogOpen,
    setIsPublicLinkDialogOpen,
    getFaviconUrl,
    getItemSize,
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
    isWorkspaceLevel,
  });
  const { isLocked, toggleLock, isDragging, ref } = useSnippetDragAndLock(snippet.id, index, moveSnippet);

  const itemSize = getItemSize(snippet);
  const [isHovered, setIsHovered] = useState(false);

  // Direct handling for workspace snippets
  const handleWorkspaceSnippetClick = () => {
    if (snippet.category.toLowerCase() === 'snippet' && workspace) {
      try {
        // Use the new viewSnippet action to update multiple states atomically
        const breadcrumb = {
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          folder_id: null,
          folder_name: null,
        };

        // This single action replaces all three previous dispatches
        dispatch(
          viewSnippet({
            snippet: snippet,
            breadcrumb: breadcrumb,
          }),
        );
      } catch (error) {
        console.error('[DEBUG] Error in handleWorkspaceSnippetClick:', error);
      }
    }
  };

  const { label, color } = getItemTypeLabel(snippet.category);
  const isLinkCategory = snippet.category.toLowerCase() === 'link';
  const faviconUrl = isLinkCategory ? getFaviconUrl(snippet.value as string) : null;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={ref}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      key={snippet.id}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // space triggers scroll by default

          // For workspace-level snippets, use direct handling
          if (isWorkspaceLevel && snippet.category.toLowerCase() === 'snippet') {
            handleWorkspaceSnippetClick();
          } else {
            // For folder snippets or non-snippet types, use the hook
            handleClickItem(snippet);
          }
        }
      }}
      onClick={() => {
        // For workspace-level snippets, use direct handling
        if (isWorkspaceLevel && snippet.category.toLowerCase() === 'snippet') {
          handleWorkspaceSnippetClick();
        } else {
          // For folder snippets or non-snippet types, use the hook
          handleClickItem(snippet);
        }
      }}
      className={`
          bg-frostedglass dark:bg-frostedglass rounded-xl p-4 cursor-pointer transition-all
          hover:bg-white/70 hover:bg-[var(--color-hoverBg)] hover:shadow-lg 
          border border-white/30 border-[var(--color-borderDefault)] relative
          ${selectedItem === snippet.id ? 'ring-2 ring-blue-500' : ''}
          h-40 flex flex-col justify-between group
        `}>
      {isHovered && (
        <div
          className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 
                  bg-neutral-800 text-white text-xs px-2 py-1 rounded 
                  shadow-lg whitespace-nowrap z-50
                  transition-opacity duration-200">
          Size: {itemSize}
        </div>
      )}

      <div>
        <div className="flex items-start mb-1">
          {isLinkCategory && faviconUrl ? (
            <div className="flex mr-2 mt-1">
              <img src={faviconUrl} alt="" className="w-5 h-5" />
            </div>
          ) : (
            <div className="mt-1 mr-2">{getItemIcon(snippet.category)}</div>
          )}
          <h3 className="text-[16.2px] font-normal text-[#F5F5F5] line-clamp-2">{snippet.key}</h3>
          <button
            onClick={e => {
              e.stopPropagation();
              setIsPublicLinkDialogOpen(true);
            }}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            title="View public links">
            <AiOutlineGlobal
              className="text-neutral-800 transition-all duration-300 ease-in-out hover:scale-125 hover:text-neutral-900 dark:text-gray-100 dark:hover:text-white"
              size={16}
            />
          </button>

          <button
            onClick={toggleLock}
            className="absolute top-3 right-9 opacity-0 group-hover:opacity-100 transition-opacity"
            title={isLocked ? 'Unlock' : 'Lock'}>
            {isLocked ? (
              <FaLock className="text-neutral-300 transition-all duration-300 ease-in-out hover:scale-125" size={16} />
            ) : (
              <FaLockOpen
                className="text-neutral-300 transition-all duration-300 ease-in-out hover:text-neutral-500 hover:scale-125"
                size={16}
              />
            )}
          </button>
        </div>
        <div
          className={`prose prose-sm dark:prose-invert text-sm text-neutral-500 dark:text-neutral-400 mt-1
   max-h-[60px] overflow-hidden line-clamp-none relative
    ${isLocked ? 'blur-sm hover:blur-none transition-all' : ''}
  `}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
          dangerouslySetInnerHTML={{ __html: getItemContent(snippet, 300) }}
        />
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${color} text-opacity-80 dark:text-opacity-80`}>
          {(() => {
            const first = snippet.first_name || '';
            const last = snippet.last_name || '';
            const fullName = first || last ? `${first} ${last}`.trim() : 'System';
            const maxLength = 20;
            return fullName.length > maxLength ? fullName.substring(0, maxLength) + '...' : fullName;
          })()}
        </span>
        <SnippetActions
          view="grid"
          snippet={snippet}
          userId={userId}
          isFav={isFav}
          isLocked={isLocked}
          toggleFavorite={() => toggleFavorite(snippet)}
          toggleLock={toggleLock}
          onEditLink={() => {
            const category = (snippet.category || '').toLowerCase();
            const isTabGroup = category === 'tabgroup' || category === 'tab group';

            if (isTabGroup) {
              dispatch(setSelectedSnippet(snippet));
              dispatch(setIsCreatingNewItem(false));
              window.dispatchEvent(new CustomEvent('openBulkEditor', { detail: { snippet } }));
            } else {
              dispatch(openLinkEditModal({ editMode: true, snippet }));
            }
          }}
          onTodo={() => {
            dispatch(setTodoCreatePrefill(snippet));
            dispatch(setShowTodosView(true));
          }}
          onDelete={handleShowDelete}
          onCopy={() => handleCopyContent(snippet)}
          onShare={() => setIsShareDialogOpen(true)}
          onPublicLinks={() => setIsPublicLinkDialogOpen(true)}
        />
      </div>

      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteItem}
        title="Delete Item"
        description={`Are you sure you want to delete "${snippet?.key || 'this item'}"? This action cannot be undone.`}
      />

      <ShareDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        title={snippet?.key || 'Note'}
        snippet={snippet}
      />

      <PublicLinksDialog
        isOpen={isPublicLinkDialogOpen}
        onClose={() => {
          setIsPublicLinkDialogOpen(false);
        }}
        userId={userId}
        snippetId={snippet.id}
      />
    </div>
  );
};
