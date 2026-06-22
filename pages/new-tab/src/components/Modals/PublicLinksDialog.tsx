import type React from 'react';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader, FiTrash2, FiGlobe, FiX, FiCopy } from 'react-icons/fi';
import { LuCheckCheck } from 'react-icons/lu';

import { fetchPublicLinksForSnippet, revokePublicLink } from '../../../../Apis/features/snippetApi';
import useToast from '../Shared/Toast/useToast';

interface PublicLink {
  link_id: string;
  public_url: string;
  created_at: string;
  access_token: string;
  expires_at: string;
}

interface PublicLinksDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  snippetId?: string;
}

export default function PublicLinksDialog({ isOpen, onClose, userId, snippetId = '' }: PublicLinksDialogProps) {
  const [publicLinks, setPublicLinks] = useState<PublicLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const triggerToast = useToast();

  const fetchPublicLinks = useCallback(async () => {
    if (!snippetId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchPublicLinksForSnippet(snippetId);

      if (Array.isArray(data)) {
        setPublicLinks(data);
      } else {
        setPublicLinks([]);
      }
    } catch (err) {
      setError('Failed to load public links. Please try again.');
      console.error(err);
      setPublicLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [snippetId]);
  // Fetch public links when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchPublicLinks();
    }
  }, [isOpen, userId, snippetId, fetchPublicLinks]);

  const handleRevokeLink = async (linkId: string) => {
    setDeletingLinkId(linkId);

    try {
      await revokePublicLink(linkId);

      // Remove the deleted link from the state
      setPublicLinks(prevLinks => prevLinks.filter(link => link.link_id !== linkId));

      triggerToast('Public link successfully revoked', 'success');
    } catch (err) {
      setError('Failed to revoke link. Please try again.');
      triggerToast('Failed to revoke public link', 'error');
      console.error(err);
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    // Prevent the default action and stop propagation
    e.preventDefault();
    e.stopPropagation();

    // Close the modal if clicked outside
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const copyToClipboard = async (linkId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLinkId(linkId);
      triggerToast('Public link copied to clipboard', 'success');
      setTimeout(() => {
        setCopiedLinkId(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      triggerToast('Failed to copy link to clipboard', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)] flex items-center">
                <FiGlobe className="mr-2" />
                Public Links
              </h3>
              <button
                onClick={handleClose}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                <FiX size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <FiLoader className="animate-spin text-[var(--color-iconDefault)]" size={24} />
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
                </div>
              ) : publicLinks.length === 0 ? (
                <div className="bg-[var(--color-popupBg)] border border-[var(--color-borderDefault)] rounded-lg p-6 text-center">
                  <FiGlobe className="mx-auto mb-3 text-[var(--color-iconDefault)]" size={24} />
                  <p className="text-neutral-600 dark:text-neutral-300 text-sm">
                    No public links found for this snippet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {publicLinks.map(link => (
                    <motion.div
                      key={link.link_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)]">
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                              {`Shared on ${formatDate(link.created_at)}`}
                            </h4>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-2">
                              {link.public_url}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => copyToClipboard(link.link_id, link.public_url)}
                              className={`p-1.5 rounded-full ${
                                copiedLinkId === link.link_id
                                  ? 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                              }`}
                              title={copiedLinkId === link.link_id ? 'Copied!' : 'Copy link'}>
                              {copiedLinkId === link.link_id ? <LuCheckCheck size={16} /> : <FiCopy size={16} />}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleRevokeLink(link.link_id)}
                              disabled={deletingLinkId === link.link_id}
                              className="p-1.5 rounded-full text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Revoke link">
                              {deletingLinkId === link.link_id ? (
                                <FiLoader className="animate-spin" size={16} />
                              ) : (
                                <FiTrash2 size={16} />
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--color-containerBg)] hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200">
                Close
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
