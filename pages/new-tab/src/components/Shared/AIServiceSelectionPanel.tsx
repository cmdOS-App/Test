import React from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

interface AIService {
  id: string;
  label: string;
}

interface AIServiceSelectionPanelProps {
  services: AIService[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  commands?: any[]; // To get iconHost
}

export const AIServiceSelectionPanel: React.FC<AIServiceSelectionPanelProps> = ({
  services,
  selectedIds,
  onToggle,
  onClose,
  title = 'Select AI Models',
  subtitle = 'Choose models for "All AI Chat Agents" command',
  commands = [],
}) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1C] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-borderDefault)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-textPrimary)] leading-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-[var(--color-textSecondary)] mt-0.5">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-neutral-600">
            <FaTimes size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {services.map(ai => {
          const isSelected = selectedIds.includes(ai.id);
          const cmd = commands.find(c => c.id === ai.id);

          return (
            <button
              key={ai.id}
              type="button"
              onClick={() => {
                
                onToggle(ai.id);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                isSelected
                  ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-600 shadow-sm'
                  : 'bg-[var(--color-containerBg)] hover:bg-neutral-100 dark:hover:bg-neutral-800 border-2 border-[var(--color-borderDefault)] hover:border-purple-200 dark:hover:border-purple-800'
              }`}>
              <div className="flex items-center gap-2.5 pointer-events-none select-none">
                <div className="w-6 h-6 rounded-md overflow-hidden border border-[var(--color-borderDefault)] bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  <img
                    src={getFaviconUrl(cmd?.iconHost || '')}
                    alt={ai.label}
                    className="w-4 h-4 object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
                <span
                  className={`text-sm font-medium select-none transition-colors ${isSelected ? 'text-purple-800 dark:text-purple-200' : 'text-neutral-700 dark:text-neutral-300'}`}>
                  {ai.label}
                </span>
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 flex-shrink-0 pointer-events-none select-none ${
                  isSelected
                    ? 'bg-purple-600 border-purple-600 shadow-md scale-110'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] scale-100'
                }`}>
                {isSelected && <FaCheck size={11} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
