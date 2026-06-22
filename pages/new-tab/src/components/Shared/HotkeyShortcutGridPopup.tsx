import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiLoader, FiStar, FiZapOff } from 'react-icons/fi';
import { FaStar, FaAt } from 'react-icons/fa';
import { BsKeyboard } from 'react-icons/bs';
import { VisualKeyDisplay } from './VisualKeyDisplay';

interface HotkeyShortcutGridPopupProps {
  x: number;
  y: number;
  onClose: () => void;
  isDarkMode: boolean;

  // Actual Values (for "Changed" state detection)
  shortcutValue: string; // Internal value (e.g. "mycmd")
  hotkeyValue: string; // Internal value (e.g. "Ctrl+S")

  // Editing Values/States (managed by parent)
  shortcutEditValue: string;
  onShortcutEditChange: (val: string) => void;
  hotkeyEditValue: string;
  onHotkeyEditChange: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  // Actions
  onSaveShortcut: (val: string) => void;
  onSaveHotkey: (val: string) => void;
  onClearShortcut: () => void;
  onClearHotkey: () => void;
  onOverwriteHotkey?: (conflictId: string) => void;
  onOverwriteShortcut?: (conflictId: string) => void;

  // Optional extra row (like Remove/Favorite)
  extraAction?: {
    label: string;
    icon: React.ReactNode;
    actionLabel: string;
    onExecute: () => void;
  };

  // Favorite toggle (Alternative to extraAction)
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  showFavorite?: boolean;

  // State
  isSaving: boolean;
  error?: string | null;
  conflictId?: string | null;
  showSuccess?: string | null;
  title?: string;
  isFavLoading?: boolean;
  isHotkeySyncing?: boolean;
  isShortcutSyncing?: boolean;
}

export const HotkeyShortcutGridPopup: React.FC<HotkeyShortcutGridPopupProps> = ({
  x,
  y,
  onClose,
  isDarkMode,
  shortcutValue,
  hotkeyValue,
  shortcutEditValue,
  onShortcutEditChange,
  hotkeyEditValue,
  onHotkeyEditChange,
  onSaveShortcut,
  onSaveHotkey,
  onClearShortcut,
  onClearHotkey,
  onOverwriteHotkey,
  onOverwriteShortcut,
  extraAction,
  isFavorite,
  onToggleFavorite,
  showFavorite,
  isSaving,
  error,
  conflictId,
  showSuccess,
  title = 'Assignment Options:',
  isFavLoading,
  isHotkeySyncing,
  isShortcutSyncing,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const extraActionRef = useRef<HTMLButtonElement>(null);
  const favButtonRef = useRef<HTMLButtonElement>(null);

  const [focusedRow, setFocusedRow] = useState<number>(0);
  const [focusedCol, setFocusedCol] = useState<number>(1);

  // Auto-focus shortcut on open
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      if (shortcutInputRef.current) {
        shortcutInputRef.current.focus();
        const val = shortcutInputRef.current.value;
        shortcutInputRef.current.setSelectionRange(val.length, val.length);
      }
    }, 150);
    return () => clearTimeout(focusTimer);
  }, []);

  // Handle outside Click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath();
      if (menuRef.current && !path.includes(menuRef.current)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 2D Navigation Logic
  useEffect(() => {
    const handleCaptureEvents = (e: KeyboardEvent) => {
      // Shield background when the popup is rendered
      const isHotkeyCaptureActive = focusedRow === 1 && focusedCol === 1;
      const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
      const keysToShield = [
        'ArrowUp',
        'ArrowDown',
        'Enter',
        'Escape',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ];

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (keysToShield.includes(e.key)) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return;
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
          if (isHotkeyCaptureActive && hasModifier) return;
          e.preventDefault();

          if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            if (focusedRow === 0) setFocusedRow(1);
            else if (focusedRow === 1 && (extraAction || (onToggleFavorite && showFavorite))) {
              setFocusedRow(2);
              setFocusedCol(1);
            }
          } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            if (focusedRow === 1) setFocusedRow(0);
            else if (focusedRow === 2) {
              setFocusedRow(1);
              setFocusedCol(1);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleCaptureEvents, true);
    return () => window.removeEventListener('keydown', handleCaptureEvents, true);
  }, [onClose, focusedRow, focusedCol, extraAction, onToggleFavorite, showFavorite]);

  // Sync Focus to state
  useEffect(() => {
    if (focusedRow === 0) {
      shortcutInputRef.current?.focus();
    } else if (focusedRow === 1) {
      hotkeyInputRef.current?.focus();
    } else if (focusedRow === 2) {
      if (extraAction) extraActionRef.current?.focus();
      else if (onToggleFavorite) favButtonRef.current?.focus();
    }
  }, [focusedRow, focusedCol, extraAction, onToggleFavorite]);

  // Proportions
  const menuWidth = 400;
  const totalHeight = 310;
  const padding = 12;

  let finalLeft = x;
  if (x + menuWidth + padding > window.innerWidth) finalLeft = window.innerWidth - menuWidth - padding;
  if (finalLeft < padding) finalLeft = padding;

  const shouldFlip = y + totalHeight + padding > window.innerHeight;

  const style: React.CSSProperties = {
    position: 'fixed' as const,
    zIndex: 2147483647,
    left: finalLeft,
    top: shouldFlip ? 'auto' : y,
    bottom: shouldFlip ? window.innerHeight - y : 'auto',
    width: `${menuWidth}px`,
  };

  const mainRowStyles = 'flex w-full items-stretch overflow-hidden';
  const dividerStyles = `border-r ${isDarkMode ? 'border-white/10' : 'border-[#eee8d5]'}`;

  const getRowStyles = (rowIdx: number) => {
    return `border-b ${isDarkMode ? 'border-white/10' : 'border-[#eee8d5]'} flex flex-col transition-all duration-150 relative`;
  };

  const getLabelColStyles = (rowIdx: number) => {
    const isRowFocused = focusedRow === rowIdx;
    let base = `w-[45%] px-4 whitespace-nowrap overflow-hidden flex items-center shrink-0 transition-all duration-150`;
    base += ` ${dividerStyles}`;
    base += ` ${isRowFocused ? (isDarkMode ? 'bg-white/5' : 'bg-[#eee8d5]') : ''}`;
    return base;
  };

  const getContentColStyles = (rowIdx: number) => {
    const isRowFocused = focusedRow === rowIdx;
    let base = `w-[55%] flex flex-col justify-center relative transition-all duration-150 shrink-0 py-1.5`;
    base += ` ${isRowFocused ? (isDarkMode ? 'bg-white/5' : 'bg-[#eee8d5]') : ''}`;
    return base;
  };

  // Color Tokens
  const isHotkeyError =
    error && (error.toLowerCase().includes('hotkey') || error.toLowerCase().includes('keyboard shortcut'));
  const isShortcutError =
    error && (error.toLowerCase().includes('shortcut') || error.toLowerCase().includes('text command'));

  // Dynamic Coloring based on presence of value
  const hasShortcut = !!shortcutValue;
  const hasHotkey = !!hotkeyValue;

  // Use vibrant colors from Sidebar context menu for parity
  const shortcutIconColor = isDarkMode ? 'text-green-400' : 'text-green-600';
  const hotkeyIconColor = isDarkMode ? 'text-blue-400' : 'text-blue-600';
  const favoriteIconColor = isDarkMode ? 'text-yellow-400' : 'text-yellow-600';

  const shortcutLabelColor = isDarkMode ? 'text-neutral-200' : 'text-[#073642]';
  const hotkeyLabelColor = isDarkMode ? 'text-neutral-200' : 'text-[#073642]';
  const favoriteLabelColor = isDarkMode ? 'text-neutral-200' : 'text-[#073642]';

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        id="hotkey-assignment-popup"
        initial={{ opacity: 0, scale: 0.95, y: shouldFlip ? 10 : -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: shouldFlip ? 10 : -10 }}
        className={`fixed z-[2147483647] rounded-xl shadow-2xl overflow-hidden border pointer-events-auto ${
          isDarkMode ? 'bg-[var(--color-popupBg)] border-white/10 text-neutral-200' : 'bg-[#fdf6e3] border-[#eee8d5] text-[#073642]'
        } flex flex-col`}
        style={style}>
        <div className={`px-4 py-1.5 border-b ${isDarkMode ? 'border-white/10' : 'border-[#eee8d5]'}`}>
          <div className="flex items-center justify-between min-w-0">
            <span
              className={`text-[11px] font-bold  tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-[#586e75]'} truncate`}>
              Assign
            </span>
            {(isSaving || showSuccess) && (
              <div className="flex items-center gap-1.5 ml-2">
                {showSuccess ? (
                  <FiCheck size={14} className="text-emerald-500" />
                ) : (
                  <FiLoader size={12} className="animate-spin text-blue-500" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className={getRowStyles(0)}>
            <div className={`${mainRowStyles} min-h-[36px]`}>
              <div className={getLabelColStyles(0)}>
                <div className="flex items-center gap-2">
                  <FaAt className={shortcutIconColor} size={15} />
                  <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                    Text Command
                  </span>
                </div>
              </div>
              <div className={getContentColStyles(0)}>
                <div className="flex items-center justify-center w-full h-7">
                  <div className="flex items-center justify-center gap-1.5 w-full h-full">
                    <span className="text-neutral-400 font-mono text-[13px] shrink-0 ml-2">/</span>
                    <input
                      ref={shortcutInputRef}
                      type="text"
                      placeholder="command"
                      value={shortcutEditValue}
                      onChange={e => onShortcutEditChange(e.target.value)}
                      onFocus={() => {
                        setFocusedRow(0);
                        setFocusedCol(1);
                      }}
                      className={`flex-1 h-full bg-transparent text-[13px] font-mono text-center outline-none border-none focus:ring-0 p-0 pr-4 ${isDarkMode ? 'text-white' : 'text-[#073642]'}`}
                    />
                  </div>
                </div>
                {isShortcutError && error && (
                  <div
                    className={`w-full px-3 py-1 border-t border-red-200/50 dark:border-red-900/30 flex flex-col gap-1 items-center justify-center`}>
                    <div className="flex items-start gap-1 text-red-500">
                      <FiZapOff size={11} className="shrink-0 mt-0.5" />
                      <div className="text-[10px] font-medium leading-tight text-center">
                        <span className="text-[#586e75] dark:text-neutral-100/90">Conflict: </span>
                        {(() => {
                          const parts = error.split('"');
                          if (parts.length >= 5) {
                            const val = parts[1];
                            const mid = parts[2];
                            const name = parts[3];
                            const end = parts[4];
                            return (
                              <>
                                <span className="text-red-600 dark:text-red-400 font-bold">"{val}"</span>
                                <span className="text-[#586e75] dark:text-neutral-100/90">{mid}</span>
                                <span className="text-red-600 dark:text-red-400 font-bold">"{name}"</span>
                                <span className="text-[#93a1a1] dark:text-neutral-200/80 text-[9px] block">{end}</span>
                              </>
                            );
                          }
                          return <span className="text-[#586e75] dark:text-neutral-200/80">{error}</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={getRowStyles(1)}>
            <div className={`${mainRowStyles} min-h-[36px]`}>
              <div className={getLabelColStyles(1)}>
                <div className="flex items-center gap-2">
                  <BsKeyboard className={hotkeyIconColor} size={15} />
                  <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                    Keyboard Shortcut
                  </span>
                </div>
              </div>
              <div className={getContentColStyles(1)} onClick={() => hotkeyInputRef.current?.focus()}>
                <div className="h-7 flex items-center justify-center w-full">
                  <div className="flex items-center justify-center w-full h-full">
                    <input
                      ref={hotkeyInputRef}
                      type="text"
                      readOnly
                      onFocus={() => {
                        setFocusedRow(1);
                        setFocusedCol(1);
                      }}
                      onKeyDown={e => {
                        const hasModifier = e.ctrlKey || e.metaKey;
                        if (e.key === 'Enter' && hasModifier) {
                          e.preventDefault();
                          if (isHotkeyError && conflictId && onOverwriteHotkey) onOverwriteHotkey(conflictId);
                          else onSaveHotkey(hotkeyEditValue);
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isHotkeyError && conflictId && onOverwriteHotkey) onOverwriteHotkey(conflictId);
                          else onSaveHotkey(hotkeyEditValue);
                        } else {
                          onHotkeyEditChange(e);
                        }
                      }}
                      className="absolute opacity-0 pointer-events-none"
                    />
                    {hotkeyEditValue ? (
                      <VisualKeyDisplay hotkey={hotkeyEditValue} size="md" />
                    ) : (
                      <span className="text-[11px] text-neutral-400 italic text-center w-full">Set</span>
                    )}
                  </div>
                </div>
                {error && (
                  <div
                    className={`w-full px-3 py-1.5 border-t border-red-200/50 dark:border-red-900/30 flex flex-col gap-1 items-center justify-center`}>
                    <div className="flex items-start gap-1 text-red-500">
                      <FiZapOff size={11} className="shrink-0 mt-0.5" />
                      <div className="text-[10px] font-medium leading-tight text-center">
                        <span className="text-[#586e75] dark:text-neutral-100/90">Conflict: </span>
                        {(() => {
                          const parts = error.split('"');
                          if (parts.length >= 5) {
                            const val = parts[1];
                            const mid = parts[2];
                            const name = parts[3];
                            const end = parts[4];
                            return (
                              <>
                                <span className="text-red-600 dark:text-red-400 font-bold">"{val}"</span>
                                <span className="text-[#586e75] dark:text-neutral-100/90">{mid}</span>
                                <span className="text-red-600 dark:text-red-400 font-bold">"{name}"</span>
                                <span className="text-[#93a1a1] dark:text-neutral-200/80 text-[9px] block">{end}</span>
                              </>
                            );
                          }
                          return <span className="text-[#586e75] dark:text-neutral-200/80">{error}</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {onToggleFavorite && showFavorite ? (
            <div className={getRowStyles(2).replace('border-b', '')}>
              <div className={`${mainRowStyles} min-h-[36px]`}>
                <div className={getLabelColStyles(2)}>
                  <div className="flex items-center gap-2">
                    <FiStar
                      className={
                        isFavorite
                          ? isDarkMode
                            ? 'text-yellow-400'
                            : 'text-yellow-500'
                          : isDarkMode
                            ? 'text-neutral-500'
                            : 'text-neutral-400'
                      }
                      size={15}
                    />
                    <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                      Favorite
                    </span>
                  </div>
                </div>
                <div className={getContentColStyles(2)}>
                  <div className="flex items-center justify-center w-full">
                    <button
                      ref={favButtonRef}
                      onClick={onToggleFavorite}
                      onFocus={() => setFocusedRow(2)}
                      className={`p-1 rounded-full transition-all group ${isFavorite ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-500') : 'text-neutral-300 dark:text-neutral-600 hover:text-yellow-500'}`}>
                      {isFavorite ? (
                        <FaStar size={18} className="drop-shadow-sm" />
                      ) : (
                        <FiStar size={18} className="group-hover:drop-shadow-sm" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            extraAction && (
              <div className={getRowStyles(2).replace('border-b', '')}>
                <div className={`${mainRowStyles} min-h-[36px]`}>
                  <div className={getLabelColStyles(2)}>
                    <div className="flex items-center gap-2">
                      {extraAction.icon}
                      <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                        {extraAction.label.includes('Favorite') ? 'Favorite' : extraAction.label}
                      </span>
                    </div>
                  </div>
                  <div className={getContentColStyles(2)}>
                    <div className="flex items-center justify-center w-full">
                      <button
                        ref={extraActionRef}
                        onFocus={() => {
                          setFocusedRow(2);
                        }}
                        onClick={extraAction.onExecute}
                        className={`transition-all h-6 px-3 rounded-md text-[9px] font-bold tracking-tight text-center border border-transparent ${
                          isDarkMode ? 'text-red-400 hover:bg-white/5' : 'text-red-600 hover:bg-[#eee8d5]'
                        }`}>
                        {extraAction.actionLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Dynamic Bottom Bar (Save / Clear / Overwrite) */}
        <AnimatePresence>
          {((focusedRow === 0 && (shortcutEditValue !== shortcutValue || shortcutValue)) ||
            (focusedRow === 1 && (hotkeyEditValue !== hotkeyValue || hotkeyValue)) ||
            (focusedRow === 2 && extraAction)) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`px-3 py-2 border-t flex items-center justify-between gap-3 ${
                isDarkMode ? 'bg-black/40 border-white/10' : 'bg-[#eee8d5]/30 border-[#eee8d5]'
              }`}>
              <div className="flex items-center gap-2">
                {((focusedRow === 0 && shortcutValue) || (focusedRow === 1 && hotkeyValue)) && (
                  <button
                    onClick={() => {
                      if (focusedRow === 0) onClearShortcut();
                      else if (focusedRow === 1) onClearHotkey();
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-tight transition-all flex items-center gap-1.5 ${
                      isDarkMode
                        ? 'text-red-400 hover:bg-red-900/20'
                        : 'text-red-500 hover:bg-red-50 hover:text-red-600'
                    }`}
                    title={isSaving ? undefined : focusedRow === 0 ? 'Clear Shortcut' : 'Clear Hotkey'}>
                    <FiZapOff size={11} className="shrink-0" />
                    {isSaving ? 'Clearing...' : focusedRow === 0 ? 'Clear Shortcut' : 'Clear Hotkey'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Cancel removed as per request */}
                {(focusedRow === 0 && isShortcutError) || (focusedRow === 1 && isHotkeyError) ? (
                  <button
                    onClick={() => {
                      if (focusedRow === 0 && onOverwriteShortcut && conflictId) onOverwriteShortcut(conflictId);
                      else if (focusedRow === 1 && onOverwriteHotkey && conflictId) onOverwriteHotkey(conflictId);
                    }}
                    disabled={isSaving}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-tight border transition-all active:scale-95 shadow-sm disabled:opacity-50 ${
                      isDarkMode
                        ? 'border-[#9fa2ff] bg-neutral-800 text-neutral-100 hover:border-[#8f93ff]'
                        : 'border-[#c7bcff] bg-[#f5f3ff] text-neutral-700 hover:border-[#b9adff] hover:bg-[#ebeeff]'
                    }`}>
                    {isSaving ? 'Saving...' : 'Overwrite'}
                  </button>
                ) : (
                  ((focusedRow === 0 && shortcutEditValue !== shortcutValue) ||
                    (focusedRow === 1 && hotkeyEditValue !== hotkeyValue)) && (
                    <button
                      onClick={() => {
                        if (focusedRow === 0) onSaveShortcut(shortcutEditValue);
                        else if (focusedRow === 1) onSaveHotkey(hotkeyEditValue);
                      }}
                      disabled={isSaving}
                      className={`flex items-center gap-2 rounded-md border px-5 py-1.5 text-[10px] font-bold tracking-tight transition-all active:scale-95 shadow-sm disabled:opacity-50 ${
                        isDarkMode
                          ? 'border-[#9fa2ff] bg-neutral-800 text-neutral-100 hover:border-[#8f93ff]'
                          : 'border-[#c7bcff] bg-[#f5f3ff] text-neutral-700 hover:border-[#b9adff] hover:bg-[#ebeeff]'
                      }`}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
