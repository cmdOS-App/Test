import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { FaLink, FaCheck, FaCopy, FaShieldAlt, FaLock } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import useToast from '../Shared/Toast/useToast';
import { createSequreShareLinkForSnippet, createShareLinkForSnippet } from '../../../../Apis/features/snippetApi';
import type { Snippet } from '../../../../modals/interfaces';
import { FiLoader } from 'react-icons/fi';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  snippet: Snippet;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose, title, snippet }) => {
  const triggerToast = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const passKeyInputRef = useRef<HTMLInputElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [isCreatingSecureShareLink, setIsCreatingSecureShareLink] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareType, setShareType] = useState<'normal' | 'secure' | null>(null);
  const [passKey, setPassKey] = useState('');
  const [passKeyError, setPassKeyError] = useState('');

  const handleCreateShareLink = async () => {
    setIsCreatingShareLink(true);
    try {
      setPassKey('');
      const data = await createShareLinkForSnippet(snippet.id);
      const link = data?.public_url;
      if (link) {
        setShareLink(link);
        setShareType('normal');
      } else {
        triggerToast('Something went wrong please try again', 'error');
      }
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      triggerToast(serverErrorMessage, 'error');
    }
    setIsCreatingShareLink(false);
  };

  const handleCreateSecureLink = async () => {
    if (!passKey.trim()) {
      setPassKeyError('Pass key is required');
      if (passKeyInputRef.current) {
        passKeyInputRef.current.focus();
      }
      return;
    }

    setPassKeyError('');
    setIsCreatingSecureShareLink(true);

    try {
      const data = await createSequreShareLinkForSnippet(snippet.id, passKey);
      const link = data?.public_url;

      if (link) {
        setShareLink(link);
        setShareType('secure');
        if (data.pass_key) {
          setPassKey(data.pass_key);
        }
      } else {
        triggerToast('Something went wrong please try again', 'error');
      }
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      triggerToast(serverErrorMessage, 'error');
    }
    setIsCreatingSecureShareLink(false);
  };

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setShareLink('');
      setShareType(null);
    }
  }, [isOpen]);

  // Reset copied state when dialog is opened
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setIsInputFocused(false);
      setPassKey('');
      setPassKeyError('');
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      triggerToast('Link copied to clipboard', 'success');

      // Auto-select the text in the input field
      if (linkInputRef.current) {
        linkInputRef.current.select();
        setIsInputFocused(true);
      }

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      triggerToast('Failed to copy link', 'error');
    }
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    if (linkInputRef.current) {
      linkInputRef.current.select();
    }
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match with animation duration
  };

  // Handle outside clicks
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  const handlePassKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassKey(e.target.value);
    if (e.target.value.trim()) {
      setPassKeyError('');
    }
  };

  return (
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleOutsideClick}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-60"
          />
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[var(--color-containerBg)] rounded-lg shadow-xl w-full max-w-md p-6 z-50 border border-[var(--color-borderDefault)]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">Share "{title}"</h3>
              <button
                onClick={handleClose}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Choose sharing method</h4>

              {/* Normal Share Option */}
              <div
                className={`p-4 rounded-lg border transition-all ${
                  shareType === 'normal'
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]'
                }`}>
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="mr-1 bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                      <FaLink className="text-blue-500 dark:text-blue-400" size={16} />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">
                        Public Link
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Anyone with the link can view
                      </span>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreateShareLink}
                    disabled={isCreatingShareLink || isCreatingSecureShareLink}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white min-w-[100px] flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed`}>
                    {isCreatingShareLink ? (
                      <div className="flex items-center">
                        <FiLoader className="animate-spin mr-2" size={16} />
                        Creating...
                      </div>
                    ) : (
                      <>Create Link</>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Secure Share Option */}
              <div
                className={`p-4 rounded-lg border transition-all ${
                  shareType === 'secure'
                    ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]'
                }`}>
                <div className="w-full flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="mr-1 bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                      <FaShieldAlt className="text-green-500 dark:text-green-400" size={16} />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">
                        Secure Link
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Requires a pass key to view
                      </span>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreateSecureLink}
                    disabled={isCreatingShareLink || isCreatingSecureShareLink}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white min-w-[100px] flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed`}>
                    {isCreatingSecureShareLink ? (
                      <div className="flex items-center">
                        <FiLoader className="animate-spin mr-2" size={16} />
                        Creating...
                      </div>
                    ) : (
                      <>Create Secure</>
                    )}
                  </motion.button>
                </div>

                <div className="relative">
                  <div className="flex items-center">
                    <div className="mr-2 text-green-600 dark:text-green-400">
                      <FaLock size={14} />
                    </div>
                    <input
                      ref={passKeyInputRef}
                      type="text"
                      value={passKey}
                      onChange={handlePassKeyChange}
                      placeholder="Enter required pass key"
                      className={`w-full px-3 py-2 bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-md text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm ${
                        passKeyError
                          ? 'border-red-400 dark:border-red-500'
                          : 'border-[var(--color-borderDefault)]'
                      }`}
                    />
                  </div>
                  {passKeyError && <p className="text-red-500 text-xs mt-1 ml-6">{passKeyError}</p>}
                </div>
              </div>
            </div>

            {shareLink && (
              <div className="mb-6">
                <div
                  className={`p-4 rounded-lg ${
                    shareType === 'secure'
                      ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
                      : 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800'
                  }`}>
                  <label
                    htmlFor="share-link"
                    className={`text-sm font-medium mb-2 block ${
                      shareType === 'secure' ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'
                    }`}>
                    {shareType === 'secure' ? 'Secure Link Generated' : 'Link Generated'}
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="flex-grow relative">
                      <input
                        ref={linkInputRef}
                        type="text"
                        id="share-link"
                        value={shareLink}
                        readOnly
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        onClick={handleInputFocus}
                        className={`w-full px-3 py-2 bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-md text-neutral-800 dark:text-neutral-200 focus:outline-none ${
                          isInputFocused ? 'ring-2 ring-blue-500 border-transparent' : ''
                        }`}
                      />
                      <div
                        className={`absolute inset-0 pointer-events-none rounded-md bg-blue-50 dark:bg-blue-900/20 transition-opacity duration-200 ${
                          isInputFocused ? 'opacity-40' : 'opacity-0'
                        }`}></div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors 
                      ${
                        copied
                          ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200'
                          : shareType === 'secure'
                            ? 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white'
                      } min-w-[100px] flex items-center justify-center`}>
                      {copied ? (
                        <>
                          <FaCheck className="mr-2" size={12} />
                          Copied
                        </>
                      ) : (
                        <>
                          <FaCopy className="mr-2" size={12} />
                          Copy link
                        </>
                      )}
                    </motion.button>
                  </div>

                  {shareType === 'secure' && passKey && (
                    <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                      <p className="text-yellow-700 dark:text-yellow-300 font-medium flex items-center">
                        <FaLock className="mr-2" size={12} />
                        Pass Key Information
                      </p>
                      <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                        This link can only be accessed with this pass key:{' '}
                        <span className="font-mono bg-[var(--color-containerBg)] px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-700">
                          {passKey}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--color-containerBg)] hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200">
                Done
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareDialog;
