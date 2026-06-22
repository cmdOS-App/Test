import type React from 'react';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../../../../Redux/store';
import { hideToast } from '../../../../../Redux/Toast/toastSlice';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_DISMISS_MS = 3000;

const ToastContainer: React.FC = () => {
  const dispatch = useDispatch();
  const { isVisible, message, type } = useSelector((state: RootState) => state.toast);

  // Auto-dismiss after AUTO_DISMISS_MS when toast is visible
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        dispatch(hideToast());
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, dispatch]);

  if (!message || !type) return null;

  // Dot color per type
  const dotColor =
    type === 'success'
      ? '#10b981'
      : type === 'error'
        ? '#ef4444'
        : type === 'warning'
          ? '#f59e0b'
          : '#3b82f6';

  // Progress bar color per type
  const progressColor =
    type === 'success'
      ? '#10b981'
      : type === 'error'
        ? '#ef4444'
        : type === 'warning'
          ? '#f59e0b'
          : '#3b82f6';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="toast"
          className="fixed bottom-0 left-0 right-0 z-[999999] flex flex-col items-center pointer-events-none"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Plain text row */}
          <div className="flex items-center gap-2 px-4 py-2.5 w-full justify-center bg-black/85 dark:bg-black/90 backdrop-blur-sm">
            {/* Small colored dot */}
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: dotColor }}
            />
            <span className="text-white/90 text-[12px] font-normal tracking-wide select-none">
              {typeof message === 'string' ? message : JSON.stringify(message)}
            </span>
          </div>

          {/* Auto-close progress line — animates from full width to 0 */}
          <motion.div
            className="h-[2px] w-full"
            style={{ background: progressColor, transformOrigin: 'left center' }}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToastContainer;
