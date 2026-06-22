import { useState, useEffect, type FC } from 'react';
import { FaTimes, FaListUl, FaCheck } from 'react-icons/fa';

interface HistorySuggestionsModalProps {
  isOpen: boolean;
  paramName: string;
  suggestions: { value: string; title: string }[];
  onClose: () => void;
  onSelectSingle: (value: string) => void;
  onSaveAsDropdown: (selectedSuggestions: { key: string; value: string }[]) => void;
}

const HistorySuggestionsModal: FC<HistorySuggestionsModalProps> = ({
  isOpen,
  paramName,
  suggestions,
  onClose,
  onSelectSingle,
  onSaveAsDropdown,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [customInputs, setCustomInputs] = useState<Array<{ title: string; value: string; selected: boolean }>>([
    { title: '', value: '', selected: true },
  ]);

  const suggestionKey = (s: { title: string; value: string }, idx: number) => `${idx}::${s.title}::${s.value}`;

  useEffect(() => {
    // Auto-suggest is always enabled for this modal flow.
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedKeys(new Set());
    setCustomInputs([{ title: '', value: '', selected: true }]);
  }, [isOpen, suggestions]);

  const toggleSuggestion = (idx: number) => {
    const s = suggestions[idx];
    if (!s) return;
    const key = suggestionKey(s, idx);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    suggestions.forEach((s, idx) => all.add(suggestionKey(s, idx)));
    setSelectedKeys(all);
  };

  const handleClearSelection = () => setSelectedKeys(new Set());

  const selectedForDropdown = suggestions
    .map((s, idx) => ({ s, idx }))
    .filter(({ s, idx }) => selectedKeys.has(suggestionKey(s, idx)))
    .map(({ s }) => ({ key: s.title, value: s.value }));

  const customInputPairs = customInputs
    .filter(item => item.selected)
    .map(item => ({ key: item.title.trim(), value: item.value.trim() }))
    .filter(item => item.key && item.value);

  const allPairsForSave = [...selectedForDropdown, ...customInputPairs];

  const addCustomInputRow = () => {
    setCustomInputs(prev => [...prev, { title: '', value: '', selected: true }]);
  };

  const updateCustomInput = (index: number, field: 'title' | 'value', value: string) => {
    setCustomInputs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleCustomInputSelection = (index: number) => {
    setCustomInputs(prev => {
      const next = [...prev];
      const curr = next[index];
      if (!curr) return prev;
      next[index] = { ...curr, selected: !curr.selected };
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture to trap before parent
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      onMouseDown={e => e.stopPropagation()}
      data-modal-portal="true">
      <div
        className="w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col bg-[var(--color-popupBg)] border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-4 border-b border-neutral-100 dark:border-white/5">
          <div className="flex items-center gap-3 w-full">
            <div className="text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-white/5 p-2 rounded-lg">
              <FaListUl size={16} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-textPrimary)] tracking-tight">
                History Suggestions
              </h2>
              <p className="text-[11px] text-[var(--color-textSecondary)] font-medium">
                Found {suggestions.length} frequent value{suggestions.length !== 1 ? 's' : ''} for{' '}
                <span className="text-neutral-800 dark:text-neutral-200 font-bold">{paramName}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors">
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-1.5">
            <div className="flex px-3 pb-2 border-b border-neutral-100 dark:border-white/5 mb-2">
              <div className="flex-1 text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate pr-3 mr-3">
                Custom Tab Name
              </div>
              <div className="flex-1 text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate pr-2">
                Custom Identified Value
              </div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-2">Use</div>
            </div>

            {customInputs.map((input, idx) => (
              <div
                key={`custom-${idx}`}
                className="w-full px-3 py-2.5 rounded-lg border border-transparent bg-neutral-50 dark:bg-white/5 flex items-center justify-between gap-3">
                <div className="flex items-center w-full min-w-0">
                  <div className="flex-1 min-w-0 pr-3 border-r border-[var(--color-borderDefault)] mr-3">
                    <input
                      type="text"
                      value={input.title}
                      onChange={e => updateCustomInput(idx, 'title', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomInputRow();
                          setTimeout(() => {
                            const node = document.querySelector<HTMLInputElement>(
                              `[data-custom-title="${customInputs.length}"]`,
                            );
                            node?.focus();
                          }, 0);
                        }
                      }}
                      data-custom-title={idx}
                      placeholder="Custom Tab Name"
                      className="w-full bg-transparent text-[13px] font-bold text-neutral-800 dark:text-neutral-200 outline-none placeholder-[var(--color-textPlaceholder)]"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <input
                      type="text"
                      value={input.value}
                      onChange={e => updateCustomInput(idx, 'value', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomInputRow();
                          setTimeout(() => {
                            const node = document.querySelector<HTMLInputElement>(
                              `[data-custom-value="${customInputs.length}"]`,
                            );
                            node?.focus();
                          }, 0);
                        }
                      }}
                      data-custom-value={idx}
                      placeholder="Custom Identified Value"
                      className="w-full bg-transparent text-[12px] font-medium text-neutral-600 dark:text-neutral-300 outline-none placeholder-[var(--color-textPlaceholder)]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCustomInputSelection(idx)}
                  className={`ml-1 w-4 h-4 rounded border flex items-center justify-center transition-colors ${input.selected ? 'bg-neutral-800 border-neutral-800 dark:bg-neutral-200 dark:border-neutral-200' : 'bg-transparent border-[var(--color-borderDefault)]'}`}
                  aria-label="Select custom input for dropdown save">
                  {input.selected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-containerBg)]" />}
                </button>
              </div>
            ))}

            <div className="pt-1 pb-2 border-b border-neutral-100 dark:border-white/5">
              <button
                onClick={addCustomInputRow}
                className="px-2 py-1 text-[10px] font-semibold rounded-md border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                + Add Custom Input
              </button>
            </div>

            <div className="flex px-3 pb-2 border-b border-neutral-100 dark:border-white/5 mb-2">
              <div className="flex-1 text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate pr-3 mr-3">
                Title / Tab Name
              </div>
              <div className="flex-1 text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate pr-2">
                Identified Value
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={handleSelectAll}
                  className="px-2 py-1 text-[10px] font-semibold rounded-md border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                  Select All
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-2 py-1 text-[10px] font-semibold rounded-md border border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                  Clear
                </button>
              </div>
            </div>

            {suggestions.length === 0 && (
              <div className="px-3 py-3 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-xs text-neutral-500">
                No recent history found. You can still add custom inputs above.
              </div>
            )}

            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSingle(suggestion.value)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-transparent hover:border-neutral-200 dark:hover:border-white/10 bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 transition-all group flex items-center justify-between gap-3"
                title="Click to use this value">
                <div className="flex items-center w-full min-w-0">
                  <div className="flex-1 min-w-0 pr-3 border-r border-[var(--color-borderDefault)] mr-3">
                    <span className="block text-[13px] font-bold text-neutral-800 dark:text-neutral-200 truncate">
                      {suggestion.title}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <span className="block text-[12px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                      {suggestion.value}
                    </span>
                  </div>
                </div>
                <FaCheck
                  size={12}
                  className="text-neutral-700 dark:text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity flex-none"
                />
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    toggleSuggestion(idx);
                  }}
                  className={`ml-1 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedKeys.has(suggestionKey(suggestion, idx)) ? 'bg-neutral-800 border-neutral-800 dark:bg-neutral-200 dark:border-neutral-200' : 'bg-transparent border-[var(--color-borderDefault)]'}`}
                  aria-label="Select option for dropdown save">
                  {selectedKeys.has(suggestionKey(suggestion, idx)) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-containerBg)]" />
                  )}
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        {(suggestions.length > 0 || customInputPairs.length > 0) && (
          <div className="flex-none p-4 border-t border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-black/20 flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">Save selected and custom options</span>
            <button
              onClick={() => onSaveAsDropdown(allPairsForSave)}
              disabled={allPairsForSave.length === 0}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2">
              <FaListUl size={12} />
              Save as Dropdown Options ({allPairsForSave.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorySuggestionsModal;
