import React from 'react';
import { FaLink, FaFileAlt } from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import { BsStars } from 'react-icons/bs';

import { useSelector } from 'react-redux';
import { selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';

interface TemplatesContentBarProps {
  activeTab: 'links' | 'notes' | 'prompts';
  onTabChange: (tab: 'links' | 'notes' | 'prompts') => void;
  counts: { links: number; notes: number; prompts: number };
}

const TemplatesContentBar: React.FC<TemplatesContentBarProps> = ({ activeTab, onTabChange, counts }) => {
  const isDarkMode = useSelector(selectDarkMode);

  return (
    <div className="flex justify-center w-full mb-6 mt-2">
      <div
        className={`flex items-center p-1 rounded-lg border ${!isDarkMode ? 'bg-[#eee8d5] border-[#eee8d5]' : 'bg-[var(--color-containerBg)] border-neutral-200 dark:border-white/10'}`}>
        <button
          onClick={() => onTabChange('links')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'links'
              ? !isDarkMode
                ? 'bg-white text-[#073642] shadow-sm'
                : 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100 shadow-sm'
              : !isDarkMode
                ? 'text-[#93a1a1] hover:text-[#586e75]'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}>
          <div className="flex items-center gap-2">
            <FaLink size={12} className="text-blue-500 dark:text-blue-400" />
            <span>Links</span>
          </div>
        </button>
        <button
          onClick={() => onTabChange('prompts')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'prompts'
              ? !isDarkMode
                ? 'bg-white text-[#073642] shadow-sm'
                : 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100 shadow-sm'
              : !isDarkMode
                ? 'text-[#93a1a1] hover:text-[#586e75]'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}>
          <div className="flex items-center gap-2">
            <BsStars size={12} className="text-purple-500 dark:text-purple-400" />
            <span>Prompts</span>
          </div>
        </button>
        <button
          onClick={() => onTabChange('notes')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'notes'
              ? !isDarkMode
                ? 'bg-white text-[#073642] shadow-sm'
                : 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100 shadow-sm'
              : !isDarkMode
                ? 'text-[#93a1a1] hover:text-[#586e75]'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}>
          <div className="flex items-center gap-2">
            <NotesIcon size={14} className="text-orange-500 dark:text-orange-400" />
            <span>Snippets</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TemplatesContentBar;
