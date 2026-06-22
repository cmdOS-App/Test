import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaLink } from 'react-icons/fa';
import { FiZap, FiCode, FiCheckSquare } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import NotesIcon from './Icons/NotesIcon';

interface GlobalCreateMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (id: string) => void;
  isDarkMode: boolean;
}

export const GlobalCreateMenuModal: React.FC<GlobalCreateMenuModalProps> = ({ isOpen, onClose, onCommandSelect, isDarkMode }) => {
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const createItems = useMemo(() => [
    {
      id: 'createlinks',
      label: 'Link Collection',
      category: 'Data',
      icon: <FaLink size={14} />,
      action: () => onCommandSelect('createlinks'),
      shortcut: 'L',
    },
    {
      id: 'createnotes',
      label: 'Notes',
      category: 'Data',
      icon: <NotesIcon size={15} />,
      action: () => onCommandSelect('createnotes'),
      shortcut: 'N',
    },
    {
      id: 'createsnippet',
      label: 'Snippet',
      category: 'Data',
      icon: <FiCode size={16} />,
      action: () => onCommandSelect('createsnippet'),
      shortcut: 'S',
    },
    {
      id: 'createprompt',
      label: 'Prompt',
      category: 'Data',
      icon: <LuSparkles size={16} />,
      action: () => onCommandSelect('createprompt'),
      shortcut: 'P',
    },
    {
      id: 'createtodo',
      label: 'Todo',
      category: 'Data',
      icon: <FiCheckSquare size={16} />,
      action: () => onCommandSelect('createtodo'),
      shortcut: 'T',
    },
    {
      id: 'ai',
      label: 'Chat Agent',
      category: 'Automations',
      icon: <LuSparkles size={16} />,
      action: () => onCommandSelect('ai'),
      shortcut: 'C',
    },
    {
      id: 'agent',
      label: 'Automation',
      category: 'Automations',
      icon: <FiZap size={15} className="text-amber-500" />,
      action: () => onCommandSelect('agent'),
      shortcut: 'A',
    },
  ], [onCommandSelect]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return createItems;
    const query = searchQuery.toLowerCase().trim();
    return createItems.filter(
      item =>
        item.label.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [createItems, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMenuIndex(0);
      setSearchQuery('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Prevent key events from bubbling up and triggering background page actions
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        return;
      }
      const keyUpper = e.key.toUpperCase();
      const matchedItem = filteredItems.find(item => item.shortcut === keyUpper);
      if (matchedItem) {
        e.preventDefault();
        matchedItem.action();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedMenuIndex]) {
          filteredItems[selectedMenuIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [isOpen, onClose, filteredItems, selectedMenuIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/10 backdrop-blur-[2px]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative rounded-2xl border flex flex-col transition-all duration-200 select-none w-[400px] max-w-[90vw] shadow-2xl pb-3
          ${isDarkMode 
            ? 'bg-[#171821] border-white/10 text-neutral-400' 
            : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75]'
          }`}
        style={{
          boxShadow: isDarkMode 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Search Bar */}
        <div className={`relative flex items-center px-4 py-3.5 border-b
          ${isDarkMode ? 'border-white/5 bg-[#171821]' : 'border-black/5 bg-[#fdf6e3]'} rounded-t-2xl`}>
          <input
            type="text"
            ref={searchInputRef}
            placeholder="Select a create command"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedMenuIndex(0);
            }}
            onFocus={e => e.target.select()}
            className={`w-full bg-transparent outline-none border-none text-[13px] pr-20
              ${isDarkMode ? 'text-white placeholder-neutral-500' : 'text-neutral-800 placeholder-[#93a1a1]'}`}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border select-none tracking-wider
              ${isDarkMode 
                ? 'border-white/10 bg-white/5 text-neutral-400' 
                : 'border-black/10 bg-black/5 text-[#586e75]'
              }`}>
              ALT + C
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="flex flex-col max-h-[50vh] overflow-y-auto custom-scrollbar px-2 mt-2">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-neutral-500">
              No matching creation tools
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const showCategoryHeader = idx === 0 || item.category !== filteredItems[idx - 1].category;
              
              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && (
                    <>
                      {idx > 0 && <div className={`my-1 mx-2 h-[1px] ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`} />}
                      <div className={`px-3 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        {item.category}
                      </div>
                    </>
                  )}
                  <div className="px-1 mb-0.5">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        item.action();
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-none text-left transition-colors duration-150 group
                        ${idx === selectedMenuIndex
                          ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-black/10 text-[#073642]')
                          : (isDarkMode ? 'hover:bg-white/5 text-neutral-300 hover:text-white' : 'hover:bg-black/5 text-[#586e75] hover:text-[#073642]')
                        }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-150
                          ${isDarkMode ? 'text-neutral-500 group-hover:text-neutral-300' : 'text-neutral-400 group-hover:text-[#073642]'}`}>
                          {item.icon}
                        </div>
                        <span className="text-[14px] font-semibold tracking-tight truncate">
                          {item.label}
                        </span>
                      </div>
                      <span 
                        className="text-[12px] font-mono select-none px-2 py-0.5 rounded transition-colors duration-150"
                        style={{ color: '#979799' }}
                      >
                        {item.shortcut}
                      </span>
                    </button>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalCreateMenuModal;
