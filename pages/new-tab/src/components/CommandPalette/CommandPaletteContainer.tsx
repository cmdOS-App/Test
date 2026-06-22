import React from 'react';
import CommandListView from './CommandListView';
import NotesListView from './NotesListView';
import LinksListView from './LinksListView';
import PromptsListView from './PromptsListView';
import SettingsView from './SettingsView';
import ThemesView from '../Shared/Theme/ThemesView';

import { useSelector } from 'react-redux';
import { selectCommandStatus, selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';

interface CommandPaletteContainerProps {
  activeCategory: string; // Passed from parent (App -> Container -> this)
  searchQuery?: string;
  onExecute?: (commandId: string) => void;
  onClose?: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const CommandPaletteContainer: React.FC<CommandPaletteContainerProps> = ({
  activeCategory,
  searchQuery,
  onExecute,
  onClose,
  activeSection,
  onSectionChange,
}) => {
  const status = useSelector(selectCommandStatus) as { status: string; message: string } | null;
  const isDarkMode = useSelector(selectDarkMode);

  const renderContent = () => {
    switch (activeCategory) {
      case 'commands':
        return (
          <CommandListView
            searchQuery={searchQuery}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            onClose={onClose}
          />
        );
      case 'links':
        return <LinksListView searchQuery={searchQuery} />;
      case 'notes':
        return <NotesListView searchQuery={searchQuery} />;
      case 'prompts':
        return <PromptsListView searchQuery={searchQuery} />;

      case 'settings':
        return <SettingsView />;
      case 'themes':
        return <ThemesView />;
      default:
        return (
          <CommandListView
            searchQuery={searchQuery}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            onClose={onClose}
          />
        );
    }
  };

  const getTitle = () => {
    switch (activeCategory) {
      case 'commands':
        return 'Command Palette';
      case 'links':
        return 'My Links';
      case 'notes':
        return 'My Notes';
      case 'prompts':
        return 'My Prompts';
      case 'templates':
        return 'Templates';
      case 'settings':
        return 'Settings';
      default:
        return 'Command Palette';
    }
  };

  // For templates, render full page without container constraints
  if (activeCategory === 'templates') {
    return <div className="w-full h-full overflow-hidden animate-in fade-in duration-300">{renderContent()}</div>;
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header with Back Button */}
      {/* <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-md">
         <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
              title="Go Back"
            >
              <FaArrowLeft size={14} />
            </button>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
              {activeCategory === 'commands' && <FaTerminal size={14} className="text-neutral-400" />}
              {getTitle()}
            </h2>
         </div>
      </div> */}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">{renderContent()}</div>

      {/* Footer */}
      <div
        className={`flex-shrink-0 px-6 py-2 border-t backdrop-blur-md flex items-center justify-between text-[10px] relative ${!isDarkMode ? 'bg-[#fdf6e3]/50 border-[#eee8d5] text-[#93a1a1]' : 'bg-white/50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-400 dark:text-neutral-500'}`}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span
              className={`px-1 rounded text-[9px] ${!isDarkMode ? 'bg-[#eee8d5]' : 'bg-neutral-200 dark:bg-white/10'}`}>
              ↑↓
            </span>{' '}
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <span
              className={`px-1 rounded text-[9px] ${!isDarkMode ? 'bg-[#eee8d5]' : 'bg-neutral-200 dark:bg-white/10'}`}>
              ↵
            </span>{' '}
            to select
          </span>
        </div>

        {/* Center: Status Message (Overlay) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {status && status.status !== 'idle' && (
            <div
              className={`flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-medium rounded-full shadow-sm border ${
                status.status === 'error'
                  ? !isDarkMode
                    ? 'bg-[#dc322f]/10 text-[#dc322f] border-[#dc322f]/20 shadow-none'
                    : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/50'
                  : status.status === 'success'
                    ? !isDarkMode
                      ? 'bg-[#859900]/10 text-[#859900] border-[#859900]/20 shadow-none'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50'
                    : !isDarkMode
                      ? 'bg-[#268bd2]/10 text-[#268bd2] border-[#268bd2]/20 shadow-none'
                      : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50'
              }`}>
              {status.status === 'loading' ? (
                <svg
                  className="animate-spin h-2.5 w-2.5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <div
                  className={`w-2 h-2 rounded-full ${
                    status.status === 'error'
                      ? 'bg-red-500'
                      : status.status === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                  }`}
                />
              )}
              {status.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPaletteContainer;
