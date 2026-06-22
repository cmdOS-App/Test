import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';
import { FiCheck, FiX } from 'react-icons/fi';

interface HotkeysHelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

const HotkeysHelpPopup: React.FC<HotkeysHelpPopupProps> = ({ isOpen, onClose, isDarkMode }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const cardTone = isDarkMode
    ? {
        ok: 'border-emerald-500/15 bg-emerald-500/5',
        okBadge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
        bad: 'border-rose-500/15 bg-rose-500/5',
        badBadge: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
        title: 'text-neutral-200',
      }
    : {
        ok: 'border-emerald-200 bg-emerald-50',
        okBadge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        bad: 'border-rose-200 bg-rose-50',
        badBadge: 'bg-rose-100 text-rose-700 border-rose-200',
        title: 'text-neutral-700',
      };

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle outside click
  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleOutsideClick}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-7xl max-h-[90vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col
              ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-neutral-200'}`}>
            {/* Close Button */}
            {/* <button
              onClick={onClose}
              className="absolute top-6 right-6 z-10 p-1 group focus:outline-none transition-transform hover:scale-110"
              title="Close (Esc)">
              <FiX className="text-red-500 group-hover:text-red-600 w-8 h-8" />
            </button> */}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-5">
              <div className="flex flex-row h-full items-start gap-8">
                {/* Container 1: Image 1 */}
                <div className="flex-1 flex flex-col gap-2 h-full min-w-0">
                  {/* 1st Image */}
                  <div className="flex-1 flex flex-col gap-2 min-w-0 h-full">
                    <FiCheck className="mx-auto w-14 h-14 flex-shrink-0 text-emerald-500" />

                    <div
                      className={`flex-1 flex flex-col gap-4 p-6 min-h-0 group rounded-xl overflow-hidden border shadow-sm transition-all hover:shadow-md ${cardTone.ok}`}>
                      <div className="text-center space-y-2">
                        <p
                          className={`text-base font-semibold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          Keyboard hotkeys work on any website (www.something.com).
                        </p>
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-0">
                        <img
                          src={
                            typeof chrome !== 'undefined' && chrome.runtime?.getURL
                              ? chrome.runtime.getURL('new-tab/images/fav-panel/OneImage.png')
                              : '/images/fav-panel/OneImage.png'
                          }
                          alt="works on any website"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="text-center space-y-2">
                        <p className={`text-sm opacity-80 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                          Example: Visit any site, except the Chrome Web Store, and press an assigned hotkey you have
                          created.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transparent Vertical Line */}
                <div className={`w-[1px] h-full ${isDarkMode ? 'bg-white/10' : 'bg-neutral-200/50'}`} />

                {/* Container 2: Image 3 (with extra space from Container 1 via gap-20) */}
                <div className="flex-1 flex flex-col gap-2 h-full min-w-0">
                  <FiX className="mx-auto w-14 h-14 flex-shrink-0 text-red-500" />
                  <div
                    className={`flex-1 flex flex-col gap-4 p-6 min-h-0 group rounded-xl overflow-hidden border shadow-sm transition-all hover:shadow-md ${cardTone.bad}`}>
                    <div className="text-center space-y-2">
                      <p className={`text-base font-semibold ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>
                        Keyboard hotkeys do not work when the search bar is focused on the New Tab page.
                      </p>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-0">
                      <img
                        src={
                          typeof chrome !== 'undefined' && chrome.runtime?.getURL
                            ? chrome.runtime.getURL('new-tab/images/fav-panel/ThirdImage.png')
                            : '/images/fav-panel/ThirdImage.png'
                        }
                        alt="When focused on browser search bar"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <p className={`text-sm opacity-80 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        Ensure you are clicked on the webpage itself, not the address bar or search input.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`px-8 py-4 border-t flex justify-end ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-neutral-50 border-neutral-100'}`}>
              <p className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Press <span className="px-1.5 py-0.5 rounded border border-neutral-400 font-mono text-[10px]">Esc</span>{' '}
                to close
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default HotkeysHelpPopup;
