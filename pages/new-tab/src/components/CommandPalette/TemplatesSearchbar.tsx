import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FaSearch } from 'react-icons/fa';

import { useSelector } from 'react-redux';
import { selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';

interface TemplatesSearchbarProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
}

export interface TemplatesSearchbarHandle {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

const TemplatesSearchbar = forwardRef<TemplatesSearchbarHandle, TemplatesSearchbarProps>(
  ({ value, onChange, onClose, placeholder = 'Search Templates...' }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isDarkMode = useSelector(selectDarkMode);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => onChange(''),
    }));

    // Auto-focus on mount
    useEffect(() => {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }, []);

    // Handle ESC key to close templates view
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
        }
      };

      // Only add listener when input is focused
      const input = inputRef.current;
      if (input) {
        input.addEventListener('keydown', handleKeyDown);
        return () => {
          input.removeEventListener('keydown', handleKeyDown);
        };
      }
      return undefined;
    }, [onClose]);

    return (
      <div className="relative w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
          <FaSearch className={!isDarkMode ? 'text-[#93a1a1]' : 'text-neutral-500'} size={14} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full py-2.5 rounded-xl border backdrop-blur-xl transition-all focus:ring-0 focus:outline-none shadow-none placeholder-[var(--color-textPlaceholder)] ${
            !isDarkMode
              ? 'bg-[#eee8d5]/50 border-[#eee8d5] text-[#073642]'
              : 'bg-white/80 dark:bg-black/60 border-white dark:border-white/80 text-neutral-900 dark:text-neutral-200'
          }`}
          style={{ paddingLeft: '36px', fontSize: '14px' }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    );
  },
);

TemplatesSearchbar.displayName = 'TemplatesSearchbar';

export default TemplatesSearchbar;
