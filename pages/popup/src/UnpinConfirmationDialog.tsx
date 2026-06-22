import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaInfoCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { BsPinAngleFill } from 'react-icons/bs';

interface UnpinConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  zIndex?: number;
}

const UnpinConfirmationDialog: React.FC<UnpinConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  zIndex = 50,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Get the pin image URL
  const pinImageUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('pin_new_tab.gif') : '';

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
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

  return createPortal(
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
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
            className="relative bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-2xl p-6 border border-gray-200 dark:border-gray-700"
            style={{ zIndex: zIndex + 1 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start mb-4">
              <div className="mr-4 bg-gray-100 dark:bg-gray-900/30 p-3 rounded-full shrink-0">
                <BsPinAngleFill className="text-gray-600 dark:text-gray-400" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Unpin cmdOS?</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  If you unpin, cmdOS will no longer replace your new tab page. You can always pin it again later.
                </p>
              </div>
            </div>

            {/* Instructions with Image Stacked */}
            <div className=" border border-gray-200 dark:border-gray-400 rounded-lg p-4 mb-6 flex flex-col gap-6">
              <div className="w-full">
                <div className="flex items-start gap-3 mt-1">
                  <FaInfoCircle className="text-gray-600 dark:text-gray-400 shrink-0 mt-1" size={18} />
                  <div className="text-sm text-gray-800 dark:text-gray-200">
                    <p className="font-semibold text-lg mb-2">To pin again later:</p>
                    <ol className="list-decimal list-inside space-y-3 ml-2 text-sm">
                      <li>Click the cmdOS extension icon in toolbar</li>
                      <li>Click the pin icon (📌) in the popup</li>
                    </ol>
                  </div>
                </div>
              </div>
              {/* Image below instructions */}
              {pinImageUrl ? (
                <div className="w-full flex items-center justify-center bg-white dark:bg-neutral-700/50 p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-lg">
                  <img
                    src={pinImageUrl}
                    alt="Visual guide showing how to pin the TaskLabs extension - click the extension icon in browser toolbar, then click the pin icon"
                    className="w-full max-w-[480px] h-auto object-contain"
                    style={{
                      maxHeight: '360px',
                      display: 'block',
                    }}
                    onError={e => {
                      console.error('Failed to load pin image:', pinImageUrl);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML =
                          '<div class="text-xs text-neutral-500 italic p-4">Image: pin_new_tab.gif</div>';
                      }
                    }}
                    onLoad={() => {
                    }}
                  />
                </div>
              ) : (
                <div className="w-full max-w-[480px] h-[360px] mx-auto flex items-center justify-center bg-neutral-100 dark:bg-neutral-700/50 p-4 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600">
                  <div className="text-xs text-neutral-500 italic text-center">
                    Image: pin_new_tab.gif
                    <br />
                    (Extension assets not loaded)
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-white">
                ⚠️ Unpin
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-green-700 dark:text-green-400">
                Keep Pinned {`->`}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default UnpinConfirmationDialog;
