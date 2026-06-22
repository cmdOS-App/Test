import type React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaExclamationCircle, FaPlus, FaExternalLinkAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandNotInstalledDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToTemplates: () => void;
  onAddTemplate?: () => void;
  commandName: string;
  zIndex?: number;
}

const CommandNotInstalledDialog: React.FC<CommandNotInstalledDialogProps> = ({
  isOpen,
  onClose,
  onGoToTemplates,
  onAddTemplate,
  commandName,
  zIndex = 50,
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

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match with animation duration
  }, [onClose]);

  const handleAddTemplate = useCallback(() => {
    onAddTemplate?.();
    onClose();
  }, [onAddTemplate, onClose]);

  const handleGoToTemplates = useCallback(() => {
    onClose();
    onGoToTemplates();
  }, [onClose, onGoToTemplates]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTemplate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleAddTemplate]);

  // Do not conditionally call hooks. Use early return only after hooks.
  if (!isOpen && !isAnimating) return null;

  // Handle outside clicks
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  // Format display name (capitalize first letter)
  const displayName = commandName.charAt(0).toUpperCase() + commandName.slice(1);

  return createPortal(
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/20"
          style={{ zIndex }}
          onClick={handleOutsideClick}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-60"
            style={{ zIndex }}
          />
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[var(--color-containerBg)] rounded-xl shadow-2xl w-full max-w-md p-6 border border-[var(--color-borderDefault)] backdrop-blur-xl"
            style={{ zIndex: zIndex + 1 }}
            onClick={e => e.stopPropagation()}>
            <button
              onClick={e => {
                e.stopPropagation();
                handleGoToTemplates();
              }}
              className="absolute top-4 right-4 text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 font-medium underline transition-colors">
              <span className="inline-flex items-center">
                All Templates <FaExternalLinkAlt className="ml-1" size={10} />
              </span>
            </button>

            <div className="flex items-center mb-4 pt-1">
              <div className="mr-4 bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                <FaExclamationCircle className="text-amber-500 dark:text-amber-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">Command Not Added</h3>
            </div>
            <p className="mb-6 text-[var(--color-textSecondary)]">
              Add <span className="font-semibold">"{displayName}"</span> to your templates to use this command.
            </p>
            <div className="flex justify-end space-x-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-[13px] font-medium flex items-center transition-colors bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                Cancel
                <span className="ml-2 text-[10px] bg-neutral-400/30 text-neutral-600 dark:text-neutral-400 rounded px-1.5 py-0.5">
                  esc
                </span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={e => {
                  e.stopPropagation();
                  handleAddTemplate();
                }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium flex items-center justify-center whitespace-nowrap transition-all bg-[#2da44e] hover:bg-[#2c974b] text-white shadow-sm">
                <FaPlus className="mr-1" size={12} />
                import
                <span className="ml-2 text-[10px] bg-black/20 text-white/90 rounded px-1.5 py-0.5">Enter</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default CommandNotInstalledDialog;
