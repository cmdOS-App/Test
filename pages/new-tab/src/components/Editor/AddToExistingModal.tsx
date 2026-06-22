import React, { useState, useMemo, useEffect, useRef } from 'react';
import { selectSelectedTeam } from '../../../../Redux/AllData/uiStateSlice';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiArrowLeft, FiPlus, FiCheck } from 'react-icons/fi';
import { FaRegFileAlt, FaLayerGroup } from 'react-icons/fa';
import { updateSnippetRealtime, createSnippet } from '../../../../Apis/features/snippetApi';
import { extractUrlsFromSnippet } from '../SearchComponents/SearchPopup/snippetInteractiveUtils';

/** Safe URL normalizer — never throws on non-strings */
const normalizeUrl = (url: unknown): string => {
  if (!url || typeof url !== 'string') return '';
  let target = url.trim();
  if (!/^[a-zA-Z]+:\/\//.test(target)) {
    target = 'https://' + target;
  }
  try {
    const parsed = new URL(target);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
};

/** Safe string coercion — never crashes on objects or null */
const safeStr = (val: unknown): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return ''; }
  }
  return String(val);
};

/** Extracts the display domain from a URL string */
const getDomain = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

type SaveState = 'idle' | 'saving' | 'success';

export const AddToExistingModal = ({
  isOpen,
  onClose,
  activeUrl,
  activeTitle,
  links,
  defaultWorkspaceId,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeUrl: string;
  activeTitle: string;
  links: any[];
  defaultWorkspaceId: string | null;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedItemName, setSavedItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedTeam = useSelector(selectSelectedTeam);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSaveState('idle');
      setSavedItemName('');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Returns true if the active URL is already in this item
  const isDuplicate = (item: any): boolean => {
    if (!activeUrl) return false;
    const activeNorm = normalizeUrl(activeUrl);
    if (!activeNorm) return false;
    return extractUrlsFromSnippet(item).some(u => normalizeUrl(u) === activeNorm);
  };

  const filteredLinks = useMemo(() => {
    if (!Array.isArray(links)) return [];
    const pool = links.filter(l => (safeStr(l.category) || 'link').toLowerCase().includes('link'));
    if (!searchTerm.trim()) return pool.slice(0, 40);
    const lower = searchTerm.toLowerCase();
    return pool.filter(l => {
      const key = safeStr(l.key).toLowerCase();
      const folder = safeStr(l.folder_name).toLowerCase();
      const urlsStr = extractUrlsFromSnippet(l).join(' ').toLowerCase();
      return key.includes(lower) || folder.includes(lower) || urlsStr.includes(lower);
    }).slice(0, 40);
  }, [links, searchTerm]);

  const handleAppend = async (item: any) => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const existingUrls = extractUrlsFromSnippet(item);
      let existingNames: string[] = [];
      const rawValue = item.value;

      if (typeof rawValue === 'string') {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed && Array.isArray(parsed.names)) {
            existingNames = (parsed.names as any[]).map(safeStr);
          } else {
            existingNames = existingUrls.map(() => safeStr(item.key));
          }
        } catch {
          existingNames = existingUrls.map(() => safeStr(item.key));
        }
      } else if (rawValue && typeof rawValue === 'object' && Array.isArray((rawValue as any).names)) {
        existingNames = ((rawValue as any).names as any[]).map(safeStr);
      } else {
        existingNames = existingUrls.map(() => safeStr(item.key));
      }

      while (existingNames.length < existingUrls.length) existingNames.push(safeStr(item.key));

      const newValue = JSON.stringify({
        names: [...existingNames, activeTitle || 'Untitled Page'],
        urls: [...existingUrls, activeUrl],
      });

      await updateSnippetRealtime({
        snippet_id: safeStr(item.snippet_id || item.id) || undefined,
        key: safeStr(item.key),
        value: newValue,
        category: (item.category as any) || 'link',
        workspace_id: safeStr(item.workspace_id) || defaultWorkspaceId || undefined,
        folder_id: safeStr(item.folder_id) || undefined,
      }, selectedTeam?.storageMode ?? 'cloud');

      setSavedItemName(safeStr(item.key) || 'Collection');
      setSaveState('success');
      // Auto-close and return to This Site after 1.4s
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      console.error('[AddToExisting] Failed to append link:', err);
      setSaveState('idle');
    }
  };

  const handleCreateNew = async () => {
    if (!searchTerm.trim() || saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const newValue = JSON.stringify({
        names: [activeTitle || 'Untitled Page'],
        urls: [activeUrl],
      });
      await updateSnippetRealtime({
        key: searchTerm.trim(),
        value: newValue,
        category: 'link',
        tags: [],
        workspace_id: defaultWorkspaceId || undefined,
      }, selectedTeam?.storageMode ?? 'cloud');
      setSavedItemName(searchTerm.trim());
      setSaveState('success');
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      console.error('[AddToExisting] Failed to create new collection:', err);
      setSaveState('idle');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — blurs the Alt+Q content behind, but does NOT close Alt+Q */}
          <motion.div
            key="add-existing-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 z-[110] bg-black/50 backdrop-blur-[2px] rounded-[24px]"
            onClick={onClose}
          />

          {/* Compact picker panel — centered, fixed max height */}
          <motion.div
            key="add-existing-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-[120] inset-x-8 top-[10%] bottom-[10%] max-w-[520px] mx-auto flex flex-col bg-[#171821] border border-[#2A2B33] rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Success screen */}
            <AnimatePresence>
              {saveState === 'success' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#171821] rounded-2xl gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <FiCheck className="text-emerald-400" size={22} />
                  </div>
                  <div className="text-white font-semibold text-sm">Added to &quot;{savedItemName}&quot;</div>
                  <div className="text-neutral-500 text-xs">Returning to This Site…</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2B33] shrink-0">
              <button
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-[#A1A6B3] hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Back to This Site"
              >
                <FiArrowLeft size={15} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">Add to Existing</div>
                <div className="text-neutral-500 text-xs truncate">{activeTitle || activeUrl}</div>
              </div>
            </div>

            {/* Search input */}
            <div className="px-4 py-2.5 border-b border-[#2A2B33] shrink-0">
              <div className="flex items-center gap-2.5 bg-white/[0.05] border border-[#2A2B33] rounded-lg px-3 py-2 focus-within:border-white/20 transition-colors">
                <FiSearch className="text-[#A1A6B3] shrink-0" size={14} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
                    if (e.key === 'Enter' && searchTerm.trim() && filteredLinks.length === 0) handleCreateNew();
                  }}
                  placeholder="Search collections…"
                  className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-[#8B8F9D]"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-1.5 hover-scrollbar">
              {/* Create new row — shown when search has text */}
              {searchTerm.trim() && (
                <button
                  onClick={handleCreateNew}
                  disabled={saveState === 'saving'}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <FiPlus className="text-blue-400" size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-blue-400 text-sm font-medium group-hover:text-blue-300 truncate">
                      Create &quot;{searchTerm}&quot;
                    </div>
                    <div className="text-neutral-600 text-xs">New collection with this page</div>
                  </div>
                </button>
              )}

              {/* Divider */}
              {searchTerm.trim() && filteredLinks.length > 0 && (
                <div className="mx-4 my-1 border-t border-[#2A2B33]" />
              )}

              {/* Existing items */}
              {filteredLinks.map((item, idx) => {
                const alreadyAdded = isDuplicate(item);
                const urls = extractUrlsFromSnippet(item);
                const displayUrl = urls.length > 0 ? getDomain(urls[0]) : '';
                const urlCount = urls.length;

                return (
                  <button
                    key={safeStr(item.snippet_id || item.id) || String(idx)}
                    onClick={!alreadyAdded && saveState === 'idle' ? () => handleAppend(item) : undefined}
                    disabled={alreadyAdded || saveState !== 'idle'}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group ${alreadyAdded
                        ? 'opacity-50 cursor-not-allowed'
                        : saveState !== 'idle'
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-white/5 cursor-pointer'
                      }`}
                  >
                    {/* Icon */}
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-[#A1A6B3] group-hover:text-neutral-300 transition-colors">
                      {urlCount > 1
                        ? <FaLayerGroup size={12} />
                        : <FaRegFileAlt size={12} />
                      }
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate leading-tight">
                        {safeStr(item.key) || 'Untitled'}
                      </div>
                      <div className="text-[#8B8F9D] text-xs truncate mt-0.5">
                        {urlCount > 1 ? `${urlCount} links` : displayUrl || 'Saved link'}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      {alreadyAdded ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium bg-emerald-400/10 px-2 py-0.5 rounded-md">
                          <FiCheck size={10} /> Added
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-600 group-hover:text-blue-400 transition-colors font-medium opacity-0 group-hover:opacity-100">
                          Append →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Empty states */}
              {filteredLinks.length === 0 && !searchTerm.trim() && (
                <div className="px-4 py-8 text-center text-neutral-600 text-sm">
                  No saved links yet.
                  <div className="text-xs mt-1 text-neutral-700">Type above to create a new collection.</div>
                </div>
              )}
              {filteredLinks.length === 0 && searchTerm.trim() && (
                <div className="px-4 py-4 text-center text-neutral-600 text-xs">
                  No matches — use Create above.
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-white/[0.05] shrink-0 flex items-center justify-between">
              <span className="text-neutral-700 text-xs">↵ to create · Esc to go back</span>
              <span className="text-neutral-700 text-xs">{filteredLinks.length} collections</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
