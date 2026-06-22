import { useRef, useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FaFileAlt,
  FaLink,
  FaRegFolderOpen,
  FaRegFileAlt,
  FaPalette,
  FaShareAlt,
  FaTrashAlt,
  FaPlus,
  FaLayerGroup,
  FaFileExport,
} from 'react-icons/fa';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import { LuSparkles, LuPencil } from 'react-icons/lu';
import type { Folder, Snippet, Workspace } from '../../../../../modals/interfaces';
import { calculateStats, getAllSubFolderSnippets } from './FolderStatsPopup';

interface FolderCreateMenuPopupProps {
  isOpen: boolean;
  triggerRect: DOMRect | null;
  onClose: () => void;
  folder: Folder | null;
  workspace: Workspace | null;
  onCreateNote: () => void;
  onCreateLink: () => void;
  onCreatePrompt: () => void;
  onCreateFolder: () => void;
  // Management options
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onCustomize: () => void;
  // Open All
  onOpenAllLinks?: (urls: string[]) => void;
  onOpenAllSnippets?: (snippets: Snippet[]) => void;
  onOpenEverything?: (urls: string[], snippets: Snippet[]) => void;
  onExportToExcel?: () => void;
}

export const FolderCreateMenuPopup: React.FC<FolderCreateMenuPopupProps> = ({
  isOpen,
  triggerRect,
  onClose,
  folder,
  workspace,
  onCreateNote,
  onCreateLink,
  onCreatePrompt,
  onCreateFolder,
  onEdit,
  onShare,
  onDelete,
  onOpenAllLinks,
  onOpenAllSnippets,
  onOpenEverything,
  onExportToExcel,
  onCustomize,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [calculatedPosition, setCalculatedPosition] = useState<{ top: number; left: number; maxHeight?: number }>({
    top: 0,
    left: 0,
  });

  useLayoutEffect(() => {
    if (isOpen && triggerRect && popupRef.current) {
      const height = popupRef.current.offsetHeight;
      const width = popupRef.current.offsetWidth;
      const margin = 8;

      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      let openUpwards = false;
      if (spaceBelow < height + margin) {
        if (spaceAbove > spaceBelow) {
          openUpwards = true;
        }
      }

      let top;
      let maxHeight;

      if (openUpwards) {
        top = Math.max(margin, triggerRect.top - height - margin);
        maxHeight = triggerRect.top - 2 * margin;
      } else {
        top = triggerRect.bottom + margin;
        maxHeight = window.innerHeight - top - margin;
      }

      const left = Math.min(window.innerWidth - width - margin, triggerRect.right + margin - width / 2);
      // Ensure it doesn't go off the left edge
      const finalLeft = Math.max(margin, left);

      setCalculatedPosition({ top, left: finalLeft, maxHeight });
    }
  }, [isOpen, triggerRect]);

  const { rootStats, subFolderStats } = useMemo(() => {
    let root: Snippet[] = [];
    let sub: Snippet[] = [];

    if (workspace && !folder) {
      root = workspace.workspace_snippets || [];
      sub = getAllSubFolderSnippets(workspace);
    } else if (folder) {
      root = folder.snippets || [];
      sub = getAllSubFolderSnippets(folder as unknown as Workspace);
    }

    return {
      rootStats: calculateStats(root),
      subFolderStats: calculateStats(sub),
    };
  }, [folder, workspace]);

  const totalLinks = rootStats.linkUrls.length + subFolderStats.linkUrls.length;
  const totalNotes = rootStats.notes.length + subFolderStats.notes.length;
  const totalItems = totalLinks + totalNotes;

  useEffect(() => {
    const node = popupRef.current?.getRootNode() as Document | ShadowRoot | undefined;
    if (!isOpen || !node) return;
    const handleClickOutside = (event: Event) => {
      const path = (event as unknown as MouseEvent).composedPath?.() || [];
      if (popupRef.current && !path.includes(popupRef.current)) {
        onClose();
      }
    };
    node.addEventListener('mousedown', handleClickOutside as EventListener, true);
    return () => node.removeEventListener('mousedown', handleClickOutside as EventListener, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-start">
      {/* Backdrop with Blur */}
      <div className="absolute inset-0 bg-black/5" onClick={onClose} />

      {/* Menu Positioned within Fixed Wrapper */}
      <div
        ref={popupRef}
        className="fixed z-50 flex flex-col bg-[#fdf6e3]/95 dark:bg-frostedwhite backdrop-blur-sm rounded-lg shadow-xl border border-[var(--color-borderDefault)] py-1 w-48 overflow-y-auto overflow-x-hidden custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
        style={{
          top: calculatedPosition.top,
          left: calculatedPosition.left,
          maxHeight: calculatedPosition.maxHeight ? `${calculatedPosition.maxHeight}px` : undefined,
          visibility: calculatedPosition.top === 0 ? 'hidden' : 'visible',
        }}
        onClick={e => e.stopPropagation()}>
        {/* Header: Create */}
        <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-neutral-400 dark:text-neutral-500  tracking-wider">
          Create
        </div>
        <button
          onClick={() => {
            onCreateNote();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
          <FaRegFileAlt size={13} className="text-[var(--color-iconDefault)]" />
          <span className="flex-1 flex items-center gap-2">
            Note <FaPlus size={10} className="text-[var(--color-iconDefault)]" />
          </span>
        </button>

        <button
          onClick={() => {
            onCreateLink();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
          <FaLink size={13} className="text-[var(--color-iconDefault)]" />
          <span className="flex-1 flex items-center gap-2">
            Link <FaPlus size={10} className="text-[var(--color-iconDefault)]" />
          </span>
        </button>

        <button
          onClick={() => {
            onCreatePrompt();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
          <LuSparkles size={13} className="text-[var(--color-iconDefault)]" />
          <span className="flex-1 flex items-center gap-2">
            Prompt <FaPlus size={10} className="text-[var(--color-iconDefault)]" />
          </span>
        </button>
        {!folder && (
          <>
            <div className="border-t border-[var(--color-borderDefault)] my-1"></div>
            <button
              onClick={() => {
                onCreateFolder();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
              <FaRegFolderOpen size={13} className="text-[var(--color-iconDefault)]" />
              <span className="flex-1 flex items-center gap-2">
                New Sub-Folder <FaPlus size={10} className="text-[var(--color-iconDefault)]" />
              </span>
            </button>
          </>
        )}

        {/* Header: Options */}
        <div className="border-t border-[var(--color-borderDefault)] mt-1 mb-1"></div>
        <div className="px-3 pt-1 pb-1 text-[10px] font-medium text-neutral-400 dark:text-neutral-500  tracking-wider">
          Options
        </div>

        {/* Management Options */}
        <button
          onClick={() => {
            onCustomize();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-xs whitespace-nowrap hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center group">
          <FaPalette className="mr-3 text-[var(--color-iconDefault)]" size={13} />
          <span className="font-normal">Edit Folder</span>
        </button>

        <button
          onClick={() => {
            onShare();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-xs whitespace-nowrap hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center group">
          <FaShareAlt className="mr-3 text-[var(--color-iconDefault)]" size={13} />
          <span className="font-normal">Share</span>
        </button>

        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-xs whitespace-nowrap hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center group">
          <FaTrashAlt className="mr-3 text-red-500 dark:text-red-400 transition-colors" size={13} />
          <span className="font-normal">Delete</span>
        </button>

        {/* Header: Open All */}
        {totalItems > 0 && (
          <>
            <div className="border-t border-[var(--color-borderDefault)] mt-1 mb-1"></div>
            <div className="px-3 pt-1 pb-1 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 tracking-wider">
              Open All
            </div>
            {totalItems > 0 && onOpenEverything && (
              <button
                onClick={() => {
                  onOpenEverything(
                    [...rootStats.linkUrls, ...subFolderStats.linkUrls],
                    [...rootStats.notes, ...subFolderStats.notes],
                  );
                  onClose();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <FaLayerGroup size={13} className="text-[var(--color-iconDefault)]" />
                  <span className="font-normal">All Files</span>
                </div>
                <span className="text-neutral-400 text-[10px]">{totalItems}</span>
              </button>
            )}
            {totalLinks > 0 && onOpenAllLinks && (
              <button
                onClick={() => {
                  onOpenAllLinks([...rootStats.linkUrls, ...subFolderStats.linkUrls]);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <FaLink size={13} className="text-[var(--color-iconDefault)]" />
                  <span className="font-normal">Links</span>
                </div>
                <span className="text-neutral-400 text-[10px]">{totalLinks}</span>
              </button>
            )}

            {totalNotes > 0 && onOpenAllSnippets && (
              <button
                onClick={() => {
                  onOpenAllSnippets([...rootStats.notes, ...subFolderStats.notes]);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <NotesIcon size={15} className="text-[var(--color-iconDefault)]" />
                  <span className="font-normal">Notes</span>
                </div>
                <span className="text-neutral-400 text-[10px]">{totalNotes}</span>
              </button>
            )}
          </>
        )}

        {/* Export Support */}
        {onExportToExcel && (
          <>
            <div className="border-t border-[var(--color-borderDefault)] mt-1 mb-1"></div>
            <button
              onClick={() => {
                onExportToExcel();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2 group">
              <FaFileExport size={13} />
              <span>Export Everything</span>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
