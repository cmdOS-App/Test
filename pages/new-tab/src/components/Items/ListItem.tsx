import type { ItemProps } from '@src/types';
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
  setIsCommandListView,
} from '../../../../Redux/AllData/uiStateSlice';

const ItemType = 'SNIPPET'; // Common type for drag
import { SnippetActions } from '../snippets/SnippetActions';
import { useSnippetDragAndLock } from '@src/hooks/useSnippetDragAndLock';

export const ListItem: React.FC<ItemProps> = ({
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
    getItemSize,
    handleShowDelete,
    handleDeleteItem,
    handleClickItem,
    isFav,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleCopyContent,
    isShareDialogOpen,
    setIsShareDialogOpen,
    isPublicLinkDialogOpen,
    setIsPublicLinkDialogOpen,
    getFaviconUrl,
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
  const [isHovered, setIsHovered] = useState(false);
  const { isLocked, toggleLock, isDragging, ref } = useSnippetDragAndLock(snippet.id, index, moveSnippet);
  const itemSize = getItemSize(snippet);
  
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
        console.error('[DEBUG] ListItem - Error in handleWorkspaceSnippetClick:', error);
      }
    }
  };

  const { label, color } = getItemTypeLabel(snippet.category);
  const isLinkCategory = snippet.category.toLowerCase() === 'link';
  const faviconUrl = isLinkCategory ? getFaviconUrl(snippet.value as string) : null;

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      key={snippet.id}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // space triggers scroll by default
          if (isWorkspaceLevel && snippet.category.toLowerCase() === 'snippet') {
            handleWorkspaceSnippetClick();
          } else {
            handleClickItem(snippet);
          }
        }
      }}
      onClick={() => {
        if (isWorkspaceLevel && snippet.category.toLowerCase() === 'snippet') {
          handleWorkspaceSnippetClick();
        } else {
          handleClickItem(snippet);
        }
      }}
      className={`
          bg-frostedglass dark:bg-frostedglass rounded-xl p-4 cursor-pointer transition-all
          hover:bg-white/70 hover:bg-[var(--color-hoverBg)] hover:shadow-lg 
          border border-white/30 border-[var(--color-borderDefault)] relative
          ${selectedItem === snippet.id ? 'ring-2 ring-blue-500' : ''}
          flex items-center justify-between group
        `}>
      <div
        className="flex items-center gap-3 flex-grow"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        {isHovered && (
          <div
            className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 
                  bg-neutral-800 text-white text-xs px-2 py-1 rounded 
                  shadow-lg whitespace-nowrap z-50
                  transition-opacity duration-200">
            Size: {itemSize}
          </div>
        )}
        <div className="flex flex-col flex-grow">
          <div className="flex items-center gap-3">
            {isLinkCategory && faviconUrl ? (
              <img src={faviconUrl || '/placeholder.svg'} alt="" className="w-5 h-5" />
            ) : (
              <div>{getItemIcon(snippet.category)}</div>
            )}{' '}
            <h3 className="text-base font-medium text-neutral-900 dark:text-white">{snippet.key}</h3>
          </div>
          <div
            className={`prose prose-sm dark:prose-invert text-sm text-neutral-500 dark:text-neutral-400 mt-1 ml-2 
    max-h-[40px] overflow-hidden line-clamp-none relative whitespace-pre-line 
    ${isLocked ? 'blur-sm hover:blur-none transition-all' : ''}`}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            dangerouslySetInnerHTML={{ __html: getItemContent(snippet, 200) }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
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
            dispatch(setIsCommandListView(false));
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
        onClose={() => setIsPublicLinkDialogOpen(false)}
        userId={userId}
        snippetId={snippet.id}
      />
    </div>
  );
};
