import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaPlus, FaRobot } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import type { PromptMenuSuggestion, SnippetSuggestion } from './Searchbar';

interface InlinePromptPopupProps {
  suggestions: PromptMenuSuggestion[];
  highlightIndex: number;
  onSelect: (suggestion: PromptMenuSuggestion) => void;
  onClose: () => void;
  onEdit?: (suggestion: SnippetSuggestion) => void;
  onCreatePrompt?: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const InlinePromptPopup: React.FC<InlinePromptPopupProps> = ({
  suggestions,
  highlightIndex,
  onSelect,
  onClose,
  onCreatePrompt,
  onEdit,
  anchorRef,
}) => {
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // ... (existing code for positioning) ...

  useEffect(() => {
    const updatePosition = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + 12, // slightly offset below input
          left: rect.left + 40, // approximate indentation to match @ popup
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const node = itemRefs.current[highlightIndex];
    if (node) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Auto-close when no matching prompts
  useEffect(() => {
    if (suggestions.length === 0) {
      onClose();
    }
  }, [suggestions.length, onClose]);

  // Don't render if no suggestions or no coords
  if (!coords || suggestions.length === 0) return null;

  return createPortal(
    <div
      className="fixed w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden flex flex-col font-sans"
      style={{
        top: coords.top,
        left: coords.left,
        zIndex: 99999,
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/30">
        <span className="text-[10px] font-semibold text-neutral-400 tracking-wide">Prompts & Automations</span>
        <button
          type="button"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
            onCreatePrompt?.();
          }}
          className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          title="Create new prompt">
          <FaPlus size={8} className="text-[var(--color-iconDefault)] hover:text-neutral-600 dark:hover:text-neutral-300" />
        </button>
      </div>

      {/* List */}
      <div className="max-h-48 overflow-y-auto py-1">
        {suggestions.map((item, idx) => {
          const isActive = idx === highlightIndex;
          const rowKey =
            item.kind === 'prompt'
              ? `prompt-${item.prompt.snippet.id || item.prompt.snippet.snippet_id || idx}`
              : `automation-${item.automation.id || idx}`;
          const rowTitle = item.kind === 'prompt' ? item.prompt.snippet.key : item.automation.name;
          return (
            <button
              key={rowKey}
              ref={el => {
                itemRefs.current[idx] = el;
              }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between group ${
                isActive
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
              onMouseDown={e => {
                e.preventDefault();
                onSelect(item);
              }}>
              <div className="flex items-center min-w-0 flex-1 gap-2">
                {item.kind === 'prompt' ? (
                  <LuSparkles size={12} className="text-[var(--color-iconDefault)] shrink-0" />
                ) : (
                  <FaRobot size={12} className="text-[var(--color-iconDefault)] shrink-0" />
                )}
                <span className="truncate flex-1">{rowTitle}</span>
                <span className="text-[9px] tracking-wide text-neutral-400 dark:text-neutral-500 shrink-0">
                  {item.kind === 'prompt' ? 'Prompt' : 'Automation'}
                </span>
              </div>
              {item.kind === 'prompt' && (
                <div
                  role="button"
                  className={`ml-2 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors opacity-0 group-hover:opacity-100 ${
                    isActive ? 'opacity-100' : ''
                  }`}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit?.(item.prompt);
                  }}
                  title="Edit Prompt">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-3 h-3 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export default InlinePromptPopup;
