import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaExclamationCircle, FaSignInAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { FEATURE_FLAGS } from '../../utils/featureFlags';

interface LoginRequiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  commandName: string;
  zIndex?: number;
}

const LoginRequiredDialog: React.FC<LoginRequiredDialogProps> = ({
  isOpen,
  onClose,
  onLogin,
  commandName,
  zIndex = 1000,
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

  if (!FEATURE_FLAGS.ENABLE_SHARING) return null;
  if (!isOpen && !isAnimating) return null;

  const handleLogin = () => {
    onClose();
    onLogin();
  };

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

  const displayName = commandName.charAt(0).toUpperCase() + commandName.slice(1);

  return createPortal(
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"
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
            className="relative bg-[var(--color-containerBg)] rounded-lg shadow-xl w-full max-w-md p-6 border border-[var(--color-borderDefault)]"
            style={{ zIndex: zIndex + 1 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <div className="mr-4 bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                <FaExclamationCircle className="text-amber-500 dark:text-amber-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">Login Required</h3>
            </div>
            <p className="mb-6 text-[var(--color-textSecondary)]">
              Please login to{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{displayName}</span>
            </p>
            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-[var(--color-containerBg)] hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200">
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={e => {
                  e.stopPropagation();
                  handleLogin();
                }}
                className="px-4 py-2 bg-gradient-to-r from-neutral-800 to-neutral-900 dark:from-white dark:to-neutral-100 text-white dark:text-neutral-900 text-sm font-semibold rounded-full shadow-lg shadow-neutral-900/10 hover:shadow-neutral-900/20 transition-all border border-white/10 dark:border-transparent flex items-center gap-2">
                <FaSignInAlt className="mr-2" size={12} />
                Sign In
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default LoginRequiredDialog;
