import React from 'react';
import { FaHistory, FaTimes, FaSave } from 'react-icons/fa';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

interface AIHistorySession {
  _kind: 'ai_history';
  id: string;
  prompt: string;
  models: string[];
  urls: Record<string, string>;
  timestamp: number;
}

interface AIHistorySelectionPanelProps {
  history: AIHistorySession[];
  onSelect: (session: AIHistorySession | null) => void;
  onSaveAsAgent: (session: AIHistorySession) => void;
  onClose?: () => void;
  commands?: any[]; // To get iconHost
  activeId?: string | null;
}

export const AIHistorySelectionPanel: React.FC<AIHistorySelectionPanelProps> = ({
  history,
  onSelect,
  onSaveAsAgent,
  onClose,
  commands = [],
  activeId,
}) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1C] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--color-borderDefault)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <FaHistory size={12} className="text-purple-500" />
            <h3 className="text-[12px] font-medium text-[var(--color-textPrimary)] leading-tight">
              Active Session
            </h3>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <div
                onClick={() => onSelect(history[0])}
                className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-[1px] h-3 bg-[var(--color-containerBg)] shrink-0" />

                <span
                  title={history[0].prompt}
                  className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate flex-1">
                  {history[0].prompt
                    ? history[0].prompt.length > 30
                      ? history[0].prompt.substring(0, 30) + '...'
                      : history[0].prompt
                    : 'New Session'}
                </span>

                <div className="flex -space-x-1 items-center shrink-0 ml-auto">
                  {(history[0].models || []).slice(0, 3).map(mid => {
                    const cmd = commands.find(c => c.id === mid);
                    const host =
                      cmd?.iconHost ||
                      (mid === 'gpt'
                        ? 'chatgpt.com'
                        : mid === 'claude'
                          ? 'claude.ai'
                          : mid === 'gemini'
                            ? 'gemini.google.com'
                            : '');
                    return (
                      <div
                        key={`${history[0].id}-${mid}`}
                        className="w-3.5 h-3.5 rounded-full border border-white dark:border-neutral-900 bg-white overflow-hidden shadow-sm"
                        title={cmd?.label || mid}>
                        <img src={getFaviconUrl(host)} alt={mid} className="w-3.5 h-3.5 object-contain" />
                      </div>
                    );
                  })}
                  {(history[0].models || []).length > 3 && (
                    <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center text-[7px] font-bold text-neutral-500 ring-1 ring-white dark:ring-neutral-900">
                      +{(history[0].models || []).length - 3}
                    </div>
                  )}
                </div>
              </div>

              {/* Save as Agent Button */}
              <button
                onClick={e => {
                  
                  e.stopPropagation();
                  onSaveAsAgent(history[0]);
                }}
                className="p-1 text-neutral-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-all ml-1 shrink-0"
                title="Save as Agent Snippet">
                <FaSave size={12} />
              </button>
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md text-neutral-400 transition-colors shrink-0">
            <FaTimes size={10} />
          </button>
        )}
      </div>

      {!history.length && (
        <div className="flex flex-col items-center justify-center py-6 text-neutral-400">
          <span className="text-[10px]">No active session</span>
        </div>
      )}
    </div>
  );
};
