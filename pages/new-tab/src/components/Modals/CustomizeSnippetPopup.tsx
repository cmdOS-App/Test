import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { FaFileAlt, FaLayerGroup, FaLink, FaTerminal } from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../Shared/Icons/StackedLinkIcon';
import { updateSnippetCustomization, updateSnippetRealtime } from '../../../../Apis/features/snippetApi';
import { Snippet } from '../../../../modals/interfaces';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import useToast from '../Shared/Toast/useToast';
import { selectSnippetBreadCrum } from '../../../../Redux/AllData/uiStateSlice';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

interface CustomizeSnippetPopupProps {
  isOpen: boolean;
  snippet: Snippet;
  onClose: () => void;
  reload: () => void;
}

const CustomizeSnippetPopup: React.FC<CustomizeSnippetPopupProps> = ({ isOpen, onClose, snippet, reload }) => {
  const [name, setName] = useState<string>(snippet?.key || '');
  const [selectedColor, setSelectedColor] = useState<string>((snippet as any)?.color || '#FFC107');
  const [selectedIcon, setSelectedIcon] = useState<string>(snippet?.icon || '');
  const [isSaving, setIsSaving] = useState(false);
  const triggerToast = useToast();
  const breadcrumb = useSelector(selectSnippetBreadCrum);

  useEffect(() => {
    if (isOpen && snippet) {
      // Load from snippet object (cloud data)
      setName(snippet.key);
      setSelectedColor((snippet as any).color || '#FFC107');
      setSelectedIcon(snippet.icon || '');
    }
  }, [isOpen, snippet]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      // API Update (Icon only for snippets - name is updated elsewhere)
      const snippetId = snippet.id || snippet.snippet_id;
      if (!snippetId) {
        console.error('No snippet ID available');
        triggerToast('Failed to save: No snippet ID', 'error');
        return;
      }

      const iconChanged = selectedIcon !== (snippet.icon || 'text');
      const colorChanged = selectedColor !== ((snippet as any).color || '#FFC107');
      const nameChanged = name.trim() !== snippet.key;

      if (nameChanged) {
        await updateSnippetRealtime({ snippet_id: snippetId, key: name.trim() });
      }

      if (iconChanged || colorChanged) {
        await updateSnippetCustomization(snippetId, selectedIcon === 'text' ? null : selectedIcon, selectedColor);
      }

      triggerToast('Snippet customization saved', 'success');
      reload();
      onClose();
    } catch (error) {
      console.error('Failed to update snippet', error);
      triggerToast('Failed to save snippet customization', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Save on Cmd+S / Ctrl+S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Save on Enter (standard) or Cmd+Enter / Ctrl+Enter
      if (e.key === 'Enter') {
        if (!e.shiftKey || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleSave]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20" onClick={onClose}>
      <div
        className="w-[600px] h-[550px] bg-white dark:bg-[var(--color-popupBg)] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--color-borderDefault)] animate-in fade-in zoom-in-95 duration-200 ring-4 ring-black/5 dark:ring-white/5"
        onClick={e => e.stopPropagation()}>
        {/* Top Section */}
        <div className="p-4 flex items-center gap-4 shrink-0 bg-white dark:bg-[var(--color-popupBg)] z-10">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-neutral-100 dark:border-white/10 shadow-sm transition-all duration-300 relative overflow-hidden group"
            style={{
              backgroundColor:
                !selectedIcon &&
                (snippet.category.toLowerCase().includes('link') ||
                  snippet.category.toLowerCase().includes('tabgroup') ||
                  snippet.category.toLowerCase().includes('tab group'))
                  ? 'transparent'
                  : selectedColor
                    ? selectedColor + '15'
                    : undefined,
              boxShadow:
                !selectedIcon &&
                (snippet.category.toLowerCase().includes('link') ||
                  snippet.category.toLowerCase().includes('tabgroup') ||
                  snippet.category.toLowerCase().includes('tab group'))
                  ? 'none'
                  : selectedColor
                    ? `0 0 20px ${selectedColor}20`
                    : undefined,
            }}>
            {/* Soft Glow Layer */}
            {selectedColor &&
              !selectedIcon &&
              !snippet.category.toLowerCase().includes('link') &&
              !snippet.category.toLowerCase().includes('tabgroup') &&
              !snippet.category.toLowerCase().includes('tab group') && (
                <div className="absolute inset-0 opacity-20 blur-xl" style={{ backgroundColor: selectedColor }} />
              )}

            <div className="text-2xl drop-shadow-sm transition-colors relative z-10" style={{ color: selectedColor }}>
              {selectedIcon && selectedIcon !== 'text' ? (
                selectedIcon.startsWith('U+') ? (
                  <span>{String.fromCodePoint(parseInt(selectedIcon.replace('U+', ''), 16))}</span>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: selectedIcon }} />
                )
              ) : snippet.category.toLowerCase() === 'tabgroup' ||
                snippet.category.toLowerCase() === 'tab group' ||
                snippet.category.toLowerCase() === 'bulk_link' ? (
                (() => {
                  let urls: string[] = [];
                  if (typeof snippet.value === 'string') {
                    try {
                      const parsed = JSON.parse(snippet.value);
                      urls = Array.isArray(parsed?.urls) ? parsed.urls : [];
                    } catch {
                      if (snippet.value) urls = [snippet.value];
                    }
                  } else if (typeof snippet.value === 'object' && snippet.value) {
                    urls = Array.isArray((snippet.value as any)?.urls) ? (snippet.value as any).urls : [];
                  }
                  return <StackedLinkIcon urls={urls} maxIcons={3} size={24} fallback="tabgroup" />;
                })()
              ) : snippet.category.toLowerCase() === 'link' || snippet.category.toLowerCase() === 'quicklink' ? (
                (() => {
                  let urls: string[] = [];
                  if (typeof snippet.value === 'string') {
                    try {
                      const parsed = JSON.parse(snippet.value);
                      if (parsed.url) urls = [parsed.url];
                      else if (Array.isArray(parsed.urls)) urls = parsed.urls;
                      else if (typeof parsed === 'string') urls = [parsed];
                      else urls = [snippet.value];
                    } catch {
                      urls = [snippet.value];
                    }
                  } else if (snippet.value && typeof snippet.value === 'object') {
                    const val = snippet.value as any;
                    if (val.url) urls = [val.url];
                    else if (Array.isArray(val.urls)) urls = val.urls;
                  }

                  return <StackedLinkIcon urls={urls} maxIcons={1} size={24} fallback="link" />;
                })()
              ) : snippet.category.toLowerCase() === 'prompt' ? (
                <FaTerminal />
              ) : (
                <NotesIcon size={18} />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5 justify-center">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-xl font-bold text-neutral-800 dark:text-neutral-100 bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              placeholder="Snippet Name"
              autoFocus
            />
          </div>
        </div>

        {/* Embedded Picker */}
        <div className="flex-1 min-h-0 bg-white dark:bg-[var(--color-popupBg)]">
          <EmojiPicker
            onSelectIcon={icon => setSelectedIcon(icon)}
            onSelectColor={color => {
              setSelectedColor(color);
              setSelectedIcon('');
            }}
            showColorPicker={false}
            continuousScroll={true}
            previewIcon=""
            fallbackIcon={
              snippet.category.toLowerCase() === 'tabgroup' || snippet.category.toLowerCase() === 'tab group' ? (
                <FaLayerGroup size={18} />
              ) : snippet.category.toLowerCase() === 'link' ? (
                <FaLink size={18} />
              ) : snippet.category.toLowerCase() === 'prompt' ? (
                <FaTerminal size={18} />
              ) : (
                <NotesIcon size={18} />
              )
            }
            colorSectionLabel="Snippet Colors"
            className="w-full h-full border-none"
          />
        </div>

        {/* Footer - Minimal Buttons */}
        <div className="p-3 border-t border-neutral-100 dark:border-white/5 bg-white dark:bg-[var(--color-popupBg)] flex justify-between gap-3 shrink-0">
          {/* Reset Button (Shown if any custom icon is set) */}
          {selectedIcon ? (
            <button
              onClick={() => setSelectedIcon('')}
              className="px-3 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors flex items-center gap-1">
              <span>↺</span> Reset Icon
            </button>
          ) : (
            <div /> /* Spacer */
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className={`flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff]`}>
              {isSaving ? 'Saving...' : 'Save Changes'}
              <span className="flex items-center gap-0.5 text-[8px] font-semibold text-neutral-500 dark:text-neutral-300">
                <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                  Ctrl
                </span>
                <span className="text-neutral-500 dark:text-neutral-300">+</span>
                <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                  Enter
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CustomizeSnippetPopup;
