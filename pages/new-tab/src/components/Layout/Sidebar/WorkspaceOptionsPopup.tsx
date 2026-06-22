import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaPalette, FaPlus, FaShareAlt, FaEdit, FaTrashAlt, FaRegFileAlt, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { Workspace } from '../../../../../modals/interfaces';
import { clearEditorStates, setIsCreatingNewItem, setSelectedSnippet } from '../../../../../Redux/AllData/uiStateSlice';
import { useDispatch } from 'react-redux';
interface WorkspaceOptionsPopupProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  workspace: Workspace;
  onOpenCustomize: (workspace: Workspace) => void;
  onOpenCreateSubFolder?: (workspace: Workspace) => void;

  onOpenShare: (workspace: Workspace) => void;
  onOpenEdit: (workspace: Workspace) => void;
  onOpenDelete: (workspace: Workspace) => void;
  zIndex?: number;
}

const WorkspaceOptionsPopup: React.FC<WorkspaceOptionsPopupProps> = ({
  isOpen,
  position,
  onClose,
  workspace,
  onOpenCustomize,
  onOpenCreateSubFolder,
  onOpenShare,
  onOpenEdit,
  onOpenDelete,
  zIndex = 9999,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-start">
      {/* Backdrop with Blur */}
      <div className="absolute inset-0 bg-black/5" onClick={onClose} />

      {/* Menu Positioned within Fixed Wrapper */}
      <div
        ref={popupRef}
        style={{
          position: 'absolute', // Absolute relative to the fixed wrapper
          top: position.top,
          left: position.left,
        }}
        className="relative bg-frostedwhite dark:bg-frostedwhite shadow-xl rounded-lg border border-[var(--color-borderDefault)] overflow-hidden w-48 animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}>
        <div className="py-1 px-1">
          <div className="px-0.8 py-1.5 text-[12px] text-neutral-400 font-medium truncate border-b border-[var(--color-borderDefault)] mb-1">
            Folder: {workspace.workspace_name}
          </div>

          {/* Edit Workspace (Renamed from Customize) */}
          <button
            onClick={e => {
              e.stopPropagation();
              onOpenCustomize(workspace);
              onClose();
            }}
            className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300 flex items-center group">
            <FaPalette className="mr-3 text-[var(--color-iconDefault)]" />
            <span className="font-normal">Edit Folder</span>
          </button>

          <div className="border-t border-[var(--color-borderDefault)] my-1"></div>

          {/* Create Sub Folder */}
          {onOpenCreateSubFolder && (
            <button
              onClick={e => {
                e.stopPropagation();
                onOpenCreateSubFolder(workspace);
                onClose();
              }}
              className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300 flex items-center group">
              <FaPlus className="mr-3 text-[var(--color-iconDefault)]" />
              <span className="font-normal">Create Sub Folder</span>
            </button>
          )}
          <div className="border-t border-[var(--color-borderDefault)] my-1"></div>
          <button
            onClick={e => {
              e.stopPropagation();
              dispatch(clearEditorStates());
              dispatch(setIsCreatingNewItem(false));
              dispatch(setSelectedSnippet(null));
              onOpenShare(workspace);
              onClose();
            }}
            className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300 flex items-center group">
            <FaShareAlt className="mr-3 text-[var(--color-iconDefault)]" />
            <span className="font-normal">Share</span>
          </button>

          {/* Removed "Edit Name" button as per request */}

          <div className="border-t border-[var(--color-borderDefault)] my-1"></div>

          <button
            onClick={e => {
              e.stopPropagation();
              onOpenDelete(workspace);
              onClose();
            }}
            className="w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center group">
            <FaTrashAlt className="mr-3 text-red-500 dark:text-red-400 transition-colors" />
            <span className="font-normal">Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WorkspaceOptionsPopup;
