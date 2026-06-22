import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import { useHotkeyValidation } from '../../hooks/useHotkeyValidation';
import { VisualKeyDisplay } from '../Shared/VisualKeyDisplay';
import { FiZapOff } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { selectIsMac, selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';
import clsx from 'clsx';

interface GridInputProps {
  itemId: string;
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  onOverwrite: (value: string, conflictId: string) => void;
}

export const GridHotkeyInput: React.FC<GridInputProps> = ({ itemId, initialValue, onSave, onCancel, onOverwrite }) => {
  const isMac = useSelector(selectIsMac);
  const isDarkMode = useSelector(selectDarkMode);
  const { hotkey, setHotkey, captureHotkey } = useHotkeyAssignment(initialValue, isMac);
  const { validateHotkey } = useHotkeyValidation();
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Real-time validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (hotkey && hotkey !== initialValue) {
        const res = await validateHotkey(hotkey, itemId);
        setError(res.errorMessage);
        setConflictId(res.conflictId);
      } else {
        setError(null);
        setConflictId(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hotkey, itemId, initialValue, validateHotkey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (conflictId) {
        onOverwrite(hotkey, conflictId);
      } else {
        onSave(hotkey);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    captureHotkey(e);
  };

  return (
    <div
      className={clsx(
        'w-full flex flex-col items-center justify-center relative transition-all duration-200',
        error ? 'min-h-[80px] py-2' : 'min-h-[40px]',
      )}>
      <input
        ref={inputRef}
        type="text"
        readOnly
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!error) onSave(hotkey);
          else onCancel();
        }}
        className="absolute opacity-0 pointer-events-none"
      />
      <div
        className={clsx(
          'flex items-center justify-center w-full grow cursor-pointer py-1 ring-emerald-500/30 focus-within:ring-2 rounded',
          isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5',
        )}
        onClick={() => inputRef.current?.focus()}>
        {hotkey ? (
          <VisualKeyDisplay hotkey={hotkey} variant="text" />
        ) : (
          <span
            className={clsx(
              'text-[11px] font-bold tracking-wider px-2 py-0.5 rounded transition-all shadow-sm',
              isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white text-slate-700 border border-[#e1e1e1]',
            )}>
            Set
          </span>
        )}
      </div>

      {error && (
        <div
          className={clsx(
            'w-full px-2 mt-1.5 py-1.5 flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-1 rounded border-2 z-50',
            isDarkMode ? 'bg-red-500/5 border-red-500/30' : 'bg-white border-red-400/60 shadow-md',
          )}>
          <div className="flex items-start gap-1 justify-center max-w-full">
            <FiZapOff size={11} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-[10px] font-bold leading-tight text-center break-words">
              {(() => {
                const parts = error.split('"');
                if (parts.length >= 5) {
                  return (
                    <span className={clsx('font-medium', isDarkMode ? 'text-neutral-300' : 'text-slate-500')}>
                      {parts[0]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[1]}"</span>
                      {parts[2]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[3]}"</span>
                      {parts[4]}
                    </span>
                  );
                }
                return <span className="text-red-500 font-medium">{error}</span>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const GridCommandInput: React.FC<GridInputProps> = ({ itemId, initialValue, onSave, onCancel, onOverwrite }) => {
  const isDarkMode = useSelector(selectDarkMode);
  const [value, setValue] = useState(initialValue.startsWith('/') ? initialValue.slice(1) : initialValue);
  const { validateShortcut } = useHotkeyValidation();
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Real-time validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      const fullVal = value ? (value.startsWith('/') ? value : `/${value}`) : '';
      const initialWithSlash = initialValue ? (initialValue.startsWith('/') ? initialValue : `/${initialValue}`) : '';

      if (fullVal && fullVal !== initialWithSlash) {
        const res = await validateShortcut(fullVal, itemId);
        setError(res.errorMessage);
        setConflictId(res.conflictId);
      } else {
        setError(null);
        setConflictId(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [value, itemId, initialValue, validateShortcut]);

  const handleFinish = () => {
    const finalVal = value ? (value.startsWith('/') ? value : `/${value}`) : '';
    if (conflictId) {
      onOverwrite(finalVal.replace(/^\//, ''), conflictId);
    } else {
      onSave(finalVal.replace(/^\//, ''));
    }
  };

  return (
    <div
      className={clsx(
        'w-full flex flex-col items-center justify-center relative transition-all duration-200',
        error ? 'min-h-[80px] py-2' : 'min-h-[40px]',
      )}>
      <div
        className={clsx(
          'flex items-center justify-center w-full grow cursor-pointer py-1 gap-0.5 rounded transition-all ring-blue-500/30 focus-within:ring-2',
          isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5',
        )}
        onClick={() => inputRef.current?.focus()}>
        <div
          className={clsx(
            'flex items-center font-medium text-[11px] max-w-full overflow-hidden',
            isDarkMode ? 'text-neutral-300' : 'text-slate-700',
          )}>
          <span className={isDarkMode ? 'text-neutral-500' : 'text-slate-700 shrink-0'}>/</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            autoFocus
            onChange={e => setValue(e.target.value.replace(/^\//, ''))}
            onBlur={() => {
              if (!error) handleFinish();
              else onCancel();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleFinish();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }
            }}
            placeholder="cmd"
            className={clsx(
              'bg-transparent outline-none border-none focus:ring-0 p-0 min-w-[30px] w-full max-w-[100px] text-left',
              isDarkMode ? 'text-white placeholder:text-neutral-600' : 'text-slate-700 placeholder:text-slate-300',
            )}
          />
        </div>
      </div>

      {error && (
        <div
          className={clsx(
            'w-full px-2 mt-1.5 py-1.5 flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-1 rounded border-2 z-50',
            isDarkMode ? 'bg-red-500/5 border-red-500/30' : 'bg-white border-red-400/60 shadow-md',
          )}>
          <div className="flex items-start gap-1 justify-center max-w-full">
            <FiZapOff size={11} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-[10px] font-bold leading-tight text-center break-words">
              {(() => {
                const parts = error.split('"');
                if (parts.length >= 5) {
                  return (
                    <span className={clsx('font-medium', isDarkMode ? 'text-neutral-300' : 'text-slate-500')}>
                      {parts[0]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[1]}"</span>
                      {parts[2]}
                      <span className="text-red-600 dark:text-red-400 font-bold">"{parts[3]}"</span>
                      {parts[4]}
                    </span>
                  );
                }
                return <span className="text-red-500 font-medium">{error}</span>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
