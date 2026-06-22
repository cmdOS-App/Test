import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FaTrash,
  FaExclamationTriangle,
  FaTimes,
  FaCheck,
  FaExclamationCircle,
  FaLink,
  FaFileAlt,
  FaLayerGroup,
  FaTerminal,
} from 'react-icons/fa';
import { FiLoader, FiTrash2, FiX, FiLink, FiFileText, FiLayers, FiTerminal } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import type { Snippet } from '../../../../../modals/interfaces';

interface SelectionSummary {
  notes: number;
  links: number;
  tabgroups: number;
  prompts: number;
}

interface BulkDeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  selectedItems: Map<string, { snippet: Snippet; category: string }>;
  isDeleting: boolean;
}

// Bulk Delete Confirmation Dialog matching existing DeleteDialog style
const BulkDeleteConfirmDialog: React.FC<BulkDeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedItems,
  isDeleting,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  const handleClose = () => {
    if (isDeleting) return;
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  // Group items by category for display
  const groupedItems = {
    notes: [] as string[],
    links: [] as string[],
    tabgroups: [] as string[],
    prompts: [] as string[],
  };

  selectedItems.forEach(({ snippet, category }) => {
    const cat = category.toLowerCase();
    const name = snippet.key || 'Untitled';
    if (cat === 'snippet' || cat === 'note') {
      groupedItems.notes.push(name);
    } else if (cat === 'link' || cat === 'quicklink') {
      groupedItems.links.push(name);
    } else if (cat === 'tabgroup' || cat === 'tab group' || cat === 'bulk_link') {
      groupedItems.tabgroups.push(name);
    } else if (cat === 'prompt') {
      groupedItems.prompts.push(name);
    }
  });

  return createPortal(
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/20"
          style={{ zIndex: 9999 }}
          onClick={handleOutsideClick}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-60"
            style={{ zIndex: 9999 }}
          />
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-frostedwhite dark:bg-frostedwhite rounded-lg shadow-xl w-full max-w-md p-6 border border-[var(--color-borderDefault)]"
            style={{ zIndex: 10000 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <div className="mr-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <FaExclamationTriangle className="text-red-500 dark:text-red-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">
                Delete {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''}?
              </h3>
            </div>

            <p className="mb-4 text-sm text-[var(--color-textSecondary)]">
              This action cannot be undone. The following items will be permanently deleted:
            </p>

            {/* Items List */}
            <div className="mb-6 max-h-48 overflow-y-auto space-y-3">
              {groupedItems.notes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Notes ({groupedItems.notes.length})
                  </p>
                  <div className="space-y-1">
                    {groupedItems.notes.map((name, idx) => (
                      <div
                        key={`note-${idx}`}
                        className="text-xs text-neutral-700 dark:text-neutral-300 bg-[var(--color-containerBg)] px-2 py-1 rounded truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {groupedItems.links.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Links ({groupedItems.links.length})
                  </p>
                  <div className="space-y-1">
                    {groupedItems.links.map((name, idx) => (
                      <div
                        key={`link-${idx}`}
                        className="text-xs text-neutral-700 dark:text-neutral-300 bg-[var(--color-containerBg)] px-2 py-1 rounded truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {groupedItems.tabgroups.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Link Groups ({groupedItems.tabgroups.length})
                  </p>
                  <div className="space-y-1">
                    {groupedItems.tabgroups.map((name, idx) => (
                      <div
                        key={`tabgroup-${idx}`}
                        className="text-xs text-neutral-700 dark:text-neutral-300 bg-[var(--color-containerBg)] px-2 py-1 rounded truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {groupedItems.prompts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Prompts ({groupedItems.prompts.length})
                  </p>
                  <div className="space-y-1">
                    {groupedItems.prompts.map((name, idx) => (
                      <div
                        key={`prompt-${idx}`}
                        className="text-xs text-neutral-700 dark:text-neutral-300 bg-[var(--color-containerBg)] px-2 py-1 rounded truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: isDeleting ? 1 : 1.03 }}
                whileTap={{ scale: isDeleting ? 1 : 0.97 }}
                onClick={handleClose}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isDeleting
                    ? 'bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                    : 'bg-[var(--color-containerBg)] hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200'
                }`}>
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: isDeleting ? 1 : 1.03 }}
                whileTap={{ scale: isDeleting ? 1 : 0.97 }}
                onClick={e => {
                  e.stopPropagation();
                  onConfirm();
                }}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center min-w-[120px] transition-colors ${
                  isDeleting
                    ? 'bg-red-500 dark:bg-red-600 opacity-80 cursor-wait'
                    : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
                } text-white`}>
                {isDeleting ? (
                  <div className="flex items-center">
                    <FiLoader className="animate-spin mr-2" size={16} />
                    Deleting...
                  </div>
                ) : (
                  <>
                    <FaTrash className="mr-2" size={12} />
                    Delete Selected
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// Failed Items Warning Dialog - shows items that couldn't be deleted due to permissions
interface FailedItemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  failedItems: string[];
  deletedCount: number;
}

const FailedItemsDialog: React.FC<FailedItemsDialogProps> = ({ isOpen, onClose, failedItems, deletedCount }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/20"
          style={{ zIndex: 9999 }}
          onClick={handleOutsideClick}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-60"
            style={{ zIndex: 9999 }}
          />
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-frostedwhite dark:bg-frostedwhite rounded-lg shadow-xl w-full max-w-md p-6 border border-[var(--color-borderDefault)]"
            style={{ zIndex: 10000 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <div className="mr-4 bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                <FaExclamationCircle className="text-amber-500 dark:text-amber-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">
                  Some items couldn't be deleted
                </h3>
                {deletedCount > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {deletedCount} item{deletedCount > 1 ? 's' : ''} deleted successfully
                  </p>
                )}
              </div>
            </div>

            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">
              You don't have permission to delete the following items:
            </p>

            {/* Failed Items List */}
            <div className="mb-6 max-h-48 overflow-y-auto space-y-1">
              {failedItems.map((name, idx) => (
                <div
                  key={`failed-${idx}`}
                  className="text-xs text-neutral-700 dark:text-neutral-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2 py-1.5 rounded flex items-center gap-2">
                  <FaExclamationCircle className="text-amber-500 shrink-0" size={10} />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--color-containerBg)] hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 transition-colors">
                OK
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

interface DeleteSelectedBarProps {
  selectedForDelete: Map<string, { snippet: Snippet; category: string }>;
  selectionSummary: SelectionSummary;
  isDeleting: boolean;
  onDelete: () => Promise<{ deleted_count: number; failed_count: number; failed_ids?: string[] }>;
  onCancel: () => void;
  onDeleteComplete?: (deletedCount: number) => void;
}

// Delete Selected Bar Component - Minimal, transparent, glass-style
const DeleteSelectedBar: React.FC<DeleteSelectedBarProps> = ({
  selectedForDelete,
  selectionSummary,
  isDeleting,
  onDelete,
  onCancel,
  onDeleteComplete,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFailedDialog, setShowFailedDialog] = useState(false);
  const [failedItemNames, setFailedItemNames] = useState<string[]>([]);
  const [lastDeletedCount, setLastDeletedCount] = useState(0);

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    const result = await onDelete();
    setShowConfirmDialog(false);

    // Check if there are failed items
    if (result.failed_count > 0 && result.failed_ids && result.failed_ids.length > 0) {
      // Get names of failed items
      const failedNames: string[] = [];
      result.failed_ids.forEach(id => {
        const item = selectedForDelete.get(id);
        if (item) {
          failedNames.push(item.snippet.key || 'Untitled');
        } else {
          failedNames.push(`Item (${id.substring(0, 8)}...)`);
        }
      });
      setFailedItemNames(failedNames);
      setLastDeletedCount(result.deleted_count);
      setShowFailedDialog(true);
    }

    // Notify parent of successful deletes
    if (onDeleteComplete) {
      onDeleteComplete(result.deleted_count);
    }
  };

  const handleCloseDialog = () => {
    setShowConfirmDialog(false);
  };

  const handleCloseFailedDialog = () => {
    setShowFailedDialog(false);
    setFailedItemNames([]);
  };

  if (selectedForDelete.size === 0) return null;

  return (
    <>
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none">
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={{ left: -500, right: 500, top: -500, bottom: 100 }}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          style={{ backdropFilter: 'blur(32px) saturate(1.8)' }}
          className="pointer-events-auto h-12 flex items-center justify-between gap-2 px-4 py-2 rounded-full bg-[#0a0a0a40] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[320px] max-w-[95vw] cursor-move select-none">
          {/* Close/Cancel Icon - Left */}
          <button
            onClick={onCancel}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Cancel selection">
            <FiX size={18} />
          </button>

          {/* Selection Summary - Middle */}
          <div className="flex items-center justify-center gap-4 px-4 flex-1 overflow-x-auto hide-scrollbar">
            {selectionSummary.links > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <FiLink size={16} className="text-[var(--color-iconDefault)]" />
                <span className="text-white text-sm font-medium whitespace-nowrap">
                  {selectionSummary.links} Link{selectionSummary.links !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {selectionSummary.links > 0 && selectionSummary.notes > 0 && (
              <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />
            )}

            {selectionSummary.notes > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <FiFileText size={16} className="text-[var(--color-iconDefault)]" />
                <span className="text-white text-sm font-medium whitespace-nowrap">
                  {selectionSummary.notes} note{selectionSummary.notes !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {(selectionSummary.links > 0 || selectionSummary.notes > 0) && selectionSummary.tabgroups > 0 && (
              <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />
            )}

            {selectionSummary.tabgroups > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <FiLayers size={16} className="text-[var(--color-iconDefault)]" />
                <span className="text-white text-sm font-medium whitespace-nowrap">
                  {selectionSummary.tabgroups} group{selectionSummary.tabgroups !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {(selectionSummary.links > 0 || selectionSummary.notes > 0 || selectionSummary.tabgroups > 0) &&
              selectionSummary.prompts > 0 && <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />}

            {selectionSummary.prompts > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <FiTerminal size={16} className="text-[var(--color-iconDefault)]" />
                <span className="text-white text-sm font-medium whitespace-nowrap">
                  {selectionSummary.prompts} prompt{selectionSummary.prompts !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Delete Icon - Right */}
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-500/20 text-[#ff4d4d] transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Delete selected">
            {isDeleting ? <FiLoader className="animate-spin" size={18} /> : <FiTrash2 size={20} />}
          </button>
        </motion.div>
      </div>

      {/* Confirmation Dialog */}
      <BulkDeleteConfirmDialog
        isOpen={showConfirmDialog}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
        selectedItems={selectedForDelete}
        isDeleting={isDeleting}
      />

      {/* Failed Items Warning Dialog */}
      <FailedItemsDialog
        isOpen={showFailedDialog}
        onClose={handleCloseFailedDialog}
        failedItems={failedItemNames}
        deletedCount={lastDeletedCount}
      />
    </>
  );
};

export default DeleteSelectedBar;
export { BulkDeleteConfirmDialog, FailedItemsDialog };
