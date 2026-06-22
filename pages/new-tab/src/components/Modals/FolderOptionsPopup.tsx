import type React from 'react';
import { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FaEdit,
  FaTrashAlt,
  FaShareAlt,
  FaPalette,
  FaRegFileAlt,
  FaLink,
  FaRegFolderOpen,
  FaLayerGroup,
  FaFileAlt,
} from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import { LuSparkles } from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';
import type { Folder, Snippet, Workspace } from '../../../../modals/interfaces';
import DeleteConfirmation from './DeleteDialog';
import EditFolderNamePopup from './EditFolderNamePopup';
import { useDispatch, useSelector } from 'react-redux';
import { setCommandStatus } from '../../../../Redux/AllData/uiStateSlice';
import { deleteSharedFolder } from '../../../../Apis/features/folderApiServices';
import { fetchWorkspacesThunk, selectWorkspacesByTeam } from '../../../../Redux/Workspaces/workspaceSlice';
import { RootState } from '../../../../Redux/store';
import { calculateStats, getAllSubFolderSnippets, Stats } from '../Layout/Sidebar/FolderStatsPopup';

interface FolderOptionsPopupProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  folder: Folder;
  orgId: string;
  workspaceId: string;
  reload: () => void;
  onOpenShare: (folder: Folder) => void;
  // onOpenEdit: (folder: Folder) => void;
  // onOpenDelete: (folder: Folder) => void;
  onOpenCustomize: (folder: Folder) => void;
}

const FolderOptionsPopup: React.FC<FolderOptionsPopupProps> = ({
  isOpen,
  position,
  onClose,
  folder,
  orgId,
  workspaceId,
  reload,
  onOpenShare,
  // onOpenEdit,
  // onOpenDelete,
  onOpenCustomize,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  const workspaces = useSelector((state: RootState) => selectWorkspacesByTeam(state, orgId));
  const workspace = workspaces.find(w => w.workspace_id === workspaceId);
  const selectedTeam = useSelector((state: RootState) => state.uiState.selectedTeam);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);

  const handleDeleteFolder = async () => {
    try {
      dispatch(setCommandStatus({ status: 'loading', message: `Deleting folder "${folder.folder_name}"...` }));
      await deleteSharedFolder(folder.folder_id, orgId, workspaceId, selectedTeam?.storageMode ?? 'cloud');
      reload();
      if (orgId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (dispatch as any)(fetchWorkspacesThunk(orgId));
      }
      dispatch(setCommandStatus({ status: 'success', message: 'Folder deleted successfully' }));
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);
      setShowDeleteDialog(false);
      onClose();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message || 'Failed to delete folder';
      dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);
      throw error; // Re-throw so DeleteDialog knows the operation failed
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-start">
      {/* Backdrop with Blur */}
      <div
        className="absolute inset-0 bg-black/5"
        onClick={() => {
          // Don't close if delete/edit dialogs are open
          if (!showDeleteDialog && !showEditNameDialog) {
            onClose();
          }
        }}
      />

      <AnimatePresence>
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'absolute', // Absolute relative to fixed portal wrapper
            top: position.top,
            left: position.left,
          }}
          className="relative bg-[#fdf6e3]/95 dark:bg-frostedwhite shadow-xl rounded-lg border border-[var(--color-borderDefault)] overflow-hidden w-48 animate-in fade-in zoom-in-95 duration-100"
          onClick={e => e.stopPropagation()}>
          <div className="py-1 px-1">
            <div className="px-0.8 py-1.5 text-[12px] text-neutral-600 dark:text-neutral-400 font-semibold truncate border-b border-[var(--color-borderDefault)] mb-1">
              Sub Folder: {folder.folder_name}
            </div>

            <button
              onClick={() => {
                onOpenCustomize(folder);
                onClose();
              }}
              className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-[#eee8d5] dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300 flex items-center group">
              <FaPalette className="mr-3 text-[var(--color-iconDefault)]" />
              <span className="font-normal">Edit Folder</span>
            </button>
            <div className="border-t border-[var(--color-borderDefault)] my-1"></div>
            <button
              onClick={() => {
                onOpenShare(folder);
                onClose();
              }}
              className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 hover:bg-[#eee8d5] dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300 flex items-center group">
              <FaShareAlt className="mr-3 text-[var(--color-iconDefault)] transition-colors duration-150" />
              <span className="font-normal transition-colors duration-150">Share</span>
            </button>

            <div className="border-t border-[var(--color-borderDefault)] my-1"></div>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center group">
              <FaTrashAlt className="mr-3 text-red-500 dark:text-red-400 transition-colors duration-150" />
              <span className="font-normal transition-colors duration-150">Delete</span>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nested Modals */}
      {showDeleteDialog && (
        <DeleteConfirmation
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteFolder}
          title={`Delete ${folder.folder_name}?`}
          description="Are you sure you want to delete this folder? This action cannot be undone."
          zIndex={10001}
        />
      )}

      {showEditNameDialog && (
        <EditFolderNamePopup
          isOpen={showEditNameDialog}
          onClose={() => setShowEditNameDialog(false)}
          reload={reload}
          folderName={folder.folder_name}
          folderId={folder.folder_id}
          orgId={orgId}
          workspaceId={workspaceId}
        />
      )}
    </div>,
    document.body,
  );
};

export default FolderOptionsPopup;
