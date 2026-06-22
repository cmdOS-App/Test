import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiLoader, FiZapOff, FiStar } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { MdOutlineShortcut } from 'react-icons/md';
import { BsKeyboard, BsPencilFill, BsCalendarCheck } from 'react-icons/bs';
import { VisualKeyDisplay } from '../Shared/VisualKeyDisplay';
import { format } from 'date-fns';

interface FavoritesContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  isDarkMode: boolean;
  shortcut: string;
  hotkey: string;
  onSaveShortcut: (val: string) => void;
  onSaveHotkey: (val: string) => void;
  onClearShortcut: () => void;
  onClearHotkey: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  shortcutEditValue: string;
  onShortcutEditChange: (val: string) => void;
  hotkeyEditValue: string;
  onHotkeyEditChange: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isSaving: boolean;
  error?: string;
  conflictId?: string | null;
  showSuccess?: string | null;
  onOverwriteHotkey?: (conflictId: string) => void;
  onOverwriteShortcut?: (conflictId: string) => void;
  onRequestEdit?: () => void;
  onShowTodo?: () => void;
  editLabel?: string;

  // Direct quick scheduling properties
  existingTodoId?: string | number | null;
  initialDate?: string;
  initialTime?: string;
  initialIsRecurring?: boolean;
  initialRecurringCycle?: 'daily' | 'weekly' | 'monthly' | null;
  onSaveTodoDirectly?: (todoData: {
    title: string;
    description: string;
    date: string;
    time: string;
    isRecurring: boolean;
    recurringCycle: 'daily' | 'weekly' | 'monthly' | null;
    isAnytime: boolean;
  }) => Promise<void>;
  todoTitle: string;
  todoDescription: string;
}

export const FavoritesContextMenu: React.FC<FavoritesContextMenuProps> = ({
  x,
  y,
  onClose,
  isDarkMode,
  shortcut,
  hotkey,
  onSaveShortcut,
  onSaveHotkey,
  onClearShortcut,
  onClearHotkey,
  onToggleFavorite,
  isFavorite,
  shortcutEditValue,
  onShortcutEditChange,
  hotkeyEditValue,
  onHotkeyEditChange,
  isSaving,
  error,
  conflictId,
  showSuccess,
  onOverwriteHotkey,
  onOverwriteShortcut,
  onRequestEdit,
  editLabel,

  // Direct quick scheduling properties
  existingTodoId,
  initialDate,
  initialTime,
  initialIsRecurring,
  initialRecurringCycle,
  onSaveTodoDirectly,
  todoTitle,
  todoDescription,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);
  const removeBtnRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const todoBtnRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const [focusedRow, setFocusedRow] = useState<number>(0);
  const [focusedCol, setFocusedCol] = useState<number>(1);

  // Scheduling states
  const [isSchedulingActive, setIsSchedulingActive] = useState(false);
  const [scheduleType, setScheduleType] = useState<'one-time' | 'recurring'>(
    initialIsRecurring ? 'recurring' : 'one-time',
  );
  const [recurringCycle, setRecurringCycle] = useState<'daily' | 'weekly' | 'monthly'>(
    initialRecurringCycle || 'daily',
  );
  const [isAnytime, setIsAnytime] = useState(false);
  const [todoDate, setTodoDate] = useState(() => initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [todoTime, setTodoTime] = useState(() => {
    if (initialTime) return initialTime;
    return format(new Date(), 'HH:mm');
  });
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(null);
  const measuredSignatureRef = useRef('');

  const hasEditOption = !!onRequestEdit;
  const todoRowIdx = hasEditOption ? 4 : 3;
  const editRowIdx = hasEditOption ? 3 : -1;

  // Additional index logic for expanded rows
  const dateRowIdx = todoRowIdx + 1;
  const modeRowIdx = todoRowIdx + 2;
  const intervalRowIdx = todoRowIdx + 3;

  const maxRow = !isSchedulingActive ? todoRowIdx : scheduleType === 'recurring' ? intervalRowIdx : modeRowIdx;

  useEffect(() => {
    (window as any).isFavoritesMenuOpen = true;
    return () => {
      (window as any).isFavoritesMenuOpen = false;
    };
  }, []);

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

  useLayoutEffect(() => {
    if (!menuRef.current) return;

    const signature = [
      x,
      y,
      isSchedulingActive ? 's' : 'n',
      scheduleType,
      recurringCycle,
      isAnytime ? '1' : '0',
      todoDate,
      todoTime,
      error || '',
      conflictId || '',
      showSuccess || '',
      onRequestEdit ? 'edit' : 'no-edit',
    ].join('|');

    if (measuredSignatureRef.current === signature) return;
    measuredSignatureRef.current = signature;

    const rect = menuRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const nextWidth = Math.round(rect.width);
      const nextHeight = Math.round(rect.height);
      setMeasuredSize(prev => {
        if (prev && prev.width === nextWidth && prev.height === nextHeight) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    }
  }, [
    x,
    y,
    isSchedulingActive,
    scheduleType,
    recurringCycle,
    isAnytime,
    todoDate,
    todoTime,
    error,
    conflictId,
    showSuccess,
    onRequestEdit,
  ]);

  // Quick Save Handler
  const handleSaveTodo = async () => {
    if (!onSaveTodoDirectly) return;

    await onSaveTodoDirectly({
      title: todoTitle,
      description: todoDescription,
      date: todoDate,
      time: todoTime,
      isRecurring: scheduleType === 'recurring',
      recurringCycle: scheduleType === 'recurring' ? recurringCycle : null,
      isAnytime,
    });

    onClose();
  };

  useEffect(() => {
    const handleCaptureEvents = (e: KeyboardEvent) => {
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

      // Ctrl + Enter or Cmd + Enter shortcut for quick saving the task
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSaveTodo();
        return;
      }

      // Always intercept these keys to prevent main app navigation when the menu is open
      if (keysToShield.includes(e.key)) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return;

        e.stopPropagation();
        e.stopImmediatePropagation();

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
          if (isHotkeyCaptureActive && hasModifier) return;
          e.preventDefault();

          if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            setFocusedRow(prev => {
              if (prev < maxRow) return prev + 1;
              return prev;
            });
          } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            setFocusedRow(prev => {
              if (prev > 0) return prev - 1;
              return prev;
            });
          }
        }

        // Handle Enter key for non-input rows
        if (e.key === 'Enter' && !hasModifier) {
          if (focusedRow === 2) {
            e.preventDefault();
            onToggleFavorite();
          } else if (focusedRow === editRowIdx) {
            e.preventDefault();
            onRequestEdit?.();
            onClose();
          } else if (focusedRow === todoRowIdx) {
            e.preventDefault();
            setIsSchedulingActive(prev => !prev);
          } else if (focusedRow === modeRowIdx) {
            e.preventDefault();
            setScheduleType(prev => (prev === 'recurring' ? 'one-time' : 'recurring'));
          } else if (focusedRow === intervalRowIdx) {
            e.preventDefault();
            setRecurringCycle(prev => {
              if (prev === 'daily') return 'weekly';
              if (prev === 'weekly') return 'monthly';
              return 'daily';
            });
          }
        }
      }
    };
    window.addEventListener('keydown', handleCaptureEvents, true);
    return () => window.removeEventListener('keydown', handleCaptureEvents, true);
  }, [
    onClose,
    focusedRow,
    hasEditOption,
    onToggleFavorite,
    onRequestEdit,
    editRowIdx,
    todoRowIdx,
    maxRow,
    isSchedulingActive,
    scheduleType,
    recurringCycle,
    todoTime,
    todoDate,
    isAnytime,
    todoTitle,
    todoDescription,
  ]);

  useEffect(() => {
    if (focusedRow === 0) {
      shortcutInputRef.current?.focus();
    } else if (focusedRow === 1) {
      hotkeyInputRef.current?.focus();
    } else if (focusedRow === 2) {
      removeBtnRef.current?.focus();
    } else if (focusedRow === editRowIdx) {
      editBtnRef.current?.focus();
    } else if (focusedRow === todoRowIdx) {
      todoBtnRef.current?.focus();
    } else if (focusedRow === dateRowIdx) {
      dateInputRef.current?.focus();
    }
  }, [focusedRow, editRowIdx, todoRowIdx, dateRowIdx]);

  const menuWidth = measuredSize?.width || 420;
  const padding = 12;

  // Dynamically calculate the natural height to determine position & maximum available space.
  // Use the measured height when available so the menu can clamp to the real rendered size.
  const naturalHeight = measuredSize?.height || (isSchedulingActive ? 480 : 352);

  let finalLeft = x;
  if (x + menuWidth + padding > window.innerWidth) finalLeft = window.innerWidth - menuWidth - padding;
  if (finalLeft < padding) finalLeft = padding;

  let finalTop: number | 'auto' = y;
  let finalBottom: number | 'auto' = 'auto';
  let allowedMaxHeight = naturalHeight;

  const roomBelow = window.innerHeight - y;
  const roomAbove = y;

  if (roomBelow >= naturalHeight) {
    // Fits below the cursor, so keep it there and clamp if needed.
    finalTop = Math.max(padding, Math.min(y, window.innerHeight - naturalHeight - padding));
    finalBottom = 'auto';
    allowedMaxHeight = Math.min(naturalHeight, window.innerHeight - finalTop - padding);
  } else if (roomAbove >= naturalHeight || roomAbove > roomBelow) {
    // Not enough room below, but there is more room above, so flip upward.
    finalBottom = Math.max(padding, window.innerHeight - y);
    finalTop = 'auto';
    allowedMaxHeight = Math.min(naturalHeight, y - padding);
  } else {
    // Neither side fully fits, so pin to the top and use the available viewport height.
    finalBottom = 'auto';
    finalTop = padding;
    allowedMaxHeight = window.innerHeight - padding * 2;
  }

  // Fallback sanity check for allowedMaxHeight
  allowedMaxHeight = Math.max(200, Math.min(allowedMaxHeight, window.innerHeight - padding * 2));

  const style: React.CSSProperties = {
    position: 'fixed' as const,
    zIndex: 2147483647,
    left: finalLeft,
    top: finalTop,
    bottom: finalBottom,
    width: `${menuWidth}px`,
    maxHeight: `${allowedMaxHeight}px`,
    display: 'flex',
    flexDirection: 'column',
    visibility: measuredSize ? 'visible' : 'hidden',
    pointerEvents: measuredSize ? 'auto' : 'none',
  };

  const mainRowStyles = 'flex w-full items-stretch overflow-hidden';
  const dividerStyles = '';

  const getRowStyles = (rowIdx: number, isLast: boolean = false) => {
    return `${isLast ? '' : 'border-b'} border-white/10 flex flex-col transition-all duration-150 relative`;
  };

  const getLabelColStyles = (rowIdx: number) => {
    const isRowFocused = focusedRow === rowIdx;
    let base = `w-[225px] pl-4 pr-3 flex flex-col items-start justify-center shrink-0 transition-all duration-150 py-2.5`;
    base += ` ${dividerStyles}`;
    base += ` ${isRowFocused ? 'bg-white/5' : ''}`;
    return base;
  };

  const getContentColStyles = (rowIdx: number) => {
    const isRowFocused = focusedRow === rowIdx;
    let base = `flex-1 flex flex-col justify-start relative transition-all duration-150 py-3`;
    base += ` ${isRowFocused ? 'bg-white/5' : ''}`;
    return base;
  };

  const isHotkeyError =
    error && (error.toLowerCase().includes('hotkey') || error.toLowerCase().includes('keyboard shortcut'));
  const isShortcutError =
    error && (error.toLowerCase().includes('shortcut') || error.toLowerCase().includes('text command'));

  const shortcutColor = 'text-green-400';
  const hotkeyColor = 'text-blue-400';
  const shouldFlip = finalBottom !== 'auto';

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.98, y: shouldFlip ? 10 : -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: shouldFlip ? 10 : -10 }}
        className="fixed z-[2147483647] rounded-xl shadow-2xl overflow-hidden border pointer-events-auto bg-[var(--color-contextMenuBg)] border-white/10 text-neutral-200 flex flex-col"
        style={style}>
        {/* Header */}
        <div className="px-4 py-1.5 border-b border-white/10">
          <div className="flex items-center justify-between min-w-0">
            <span
              className="text-[11px] font-bold tracking-wider text-neutral-300 truncate">
              Favorite Actions
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

        {/* Scrollable Content Area with Hover-only Scrollbar */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-context-scrollbar">
          <style>{`
            .custom-context-scrollbar::-webkit-scrollbar {
              width: 5px;
              height: 5px;
            }
            .custom-context-scrollbar::-webkit-scrollbar-track {
              background: ${isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'};
            }
            .custom-context-scrollbar::-webkit-scrollbar-thumb {
              background: ${isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)'};
              border-radius: 9999px;
            }
            .custom-context-scrollbar:hover::-webkit-scrollbar-thumb {
              background: ${isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.28)'};
            }
            .custom-context-scrollbar::-webkit-scrollbar-thumb:hover {
              background: ${isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.38)'};
            }
            .custom-context-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.35) rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.28) rgba(0, 0, 0, 0.04)'};
            }
          `}</style>
          {/* Rows Container */}
          <div className="flex flex-col">
            {/* Row 0: Shortcut */}
            <div className={getRowStyles(0)}>
              <div className={`${mainRowStyles} min-h-[58px]`}>
                <div className={getLabelColStyles(0)}>
                  <div className="flex items-start gap-2">
                    <MdOutlineShortcut className={`mt-0.5 shrink-0 ${shortcutColor}`} size={15} />
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-bold leading-normal ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                        Text Command
                      </span>
                      <span
                        className={`text-[9.5px] font-normal leading-tight opacity-65 ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>
                        Trigger action by typing its slash command
                      </span>
                    </div>
                  </div>
                </div>
                <div className={getContentColStyles(0)}>
                  <div className="flex items-center justify-start gap-1.5 w-full h-7 px-4">
                    <span className="text-neutral-400 font-mono text-[13px] shrink-0">/</span>
                    <input
                      ref={shortcutInputRef}
                      type="text"
                      placeholder="e.g. add-note"
                      value={shortcutEditValue}
                      onChange={e => onShortcutEditChange(e.target.value)}
                      onFocus={() => {
                        setFocusedRow(0);
                        setFocusedCol(1);
                      }}
                      className={`w-36 h-full bg-transparent text-[13px] font-mono outline-none border-none focus:ring-0 p-0 ${isDarkMode ? 'text-white' : 'text-[#073642]'}`}
                    />
                  </div>
                  {isShortcutError && error && (
                    <div className="w-full px-3 py-1 border-t border-red-200/50 dark:border-red-900/30 flex flex-col gap-1 items-center justify-center">
                      <div className="flex items-start gap-1 text-red-500">
                        <FiZapOff size={11} className="shrink-0 mt-0.5" />
                        <div className="text-[10px] font-medium leading-tight text-center">
                          <span className="text-[#586e75] dark:text-neutral-100/90 whitespace-nowrap">Conflict: </span>
                          {error}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 1: Hotkey */}
            <div className={getRowStyles(1)}>
              <div className={`${mainRowStyles} min-h-[58px]`}>
                <div className={getLabelColStyles(1)}>
                  <div className="flex items-start gap-2">
                    <BsKeyboard className={`mt-0.5 shrink-0 ${hotkeyColor}`} size={15} />
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-bold leading-normal ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                        Keyboard Shortcut
                      </span>
                      <span
                        className={`text-[9.5px] font-normal leading-tight opacity-65 ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>
                        Trigger action using a keyboard hotkey
                      </span>
                    </div>
                  </div>
                </div>
                <div className={getContentColStyles(1)} onClick={() => hotkeyInputRef.current?.focus()}>
                  <div className="h-7 flex items-center justify-start w-full px-4">
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
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isHotkeyError && conflictId) onOverwriteHotkey?.(conflictId);
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
                      <span className="text-[11px] text-neutral-400 italic">Add Shortcut</span>
                    )}
                  </div>
                  {isHotkeyError && error && (
                    <div className="w-full px-3 py-1 border-t border-red-200/50 dark:border-red-900/30 flex flex-col gap-1 items-center justify-center">
                      <div className="flex items-start gap-1 text-red-500">
                        <FiZapOff size={11} className="shrink-0 mt-0.5" />
                        <div className="text-[10px] font-medium leading-tight text-center">
                          <span className="text-[#586e75] dark:text-neutral-100/90 whitespace-nowrap">Conflict: </span>
                          {error}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Favorite Action */}
            <div className={getRowStyles(2)}>
              <div className={`${mainRowStyles} min-h-[58px]`}>
                <div className={getLabelColStyles(2)}>
                  <div className="flex items-start gap-2">
                    <FiStar
                      className={`mt-0.5 shrink-0 text-[var(--color-iconDefault)]`}
                      size={15}
                    />
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-bold leading-normal ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                        Favorite
                      </span>
                      <span
                        className={`text-[9.5px] font-normal leading-tight opacity-65 ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>
                        Pin action to favorites bar for quick access
                      </span>
                    </div>
                  </div>
                </div>
                <div className={getContentColStyles(2)}>
                  <div className="flex items-start justify-start w-full px-4">
                    <button
                      ref={removeBtnRef}
                      onFocus={() => setFocusedRow(2)}
                      onClick={onToggleFavorite}
                      className={`p-1 rounded-full transition-all group ${isFavorite ? 'text-yellow-500' : 'text-[var(--color-iconDefault)] hover:text-yellow-500'}`}>
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

            {/* Row 3 (Edit Action) */}
            {hasEditOption && (
              <div className={getRowStyles(3)}>
                <div className={`${mainRowStyles} min-h-[58px]`}>
                  <div className={getLabelColStyles(3)}>
                    <div className="flex items-start gap-2">
                      <BsPencilFill className="mt-0.5 shrink-0 text-[var(--color-iconDefault)]" size={14} />
                      <div className="flex flex-col">
                        <span
                          className={`text-[11px] font-bold leading-normal ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                          {editLabel || 'Edit'}
                        </span>
                        <span
                          className={`text-[9.5px] font-normal leading-tight opacity-65 ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>
                          Modify settings and configuration
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={getContentColStyles(3)}>
                    <div className="flex items-start justify-start w-full px-4">
                      <button
                        ref={editBtnRef}
                        onClick={() => {
                          onRequestEdit?.();
                          onClose();
                        }}
                        onFocus={() => setFocusedRow(3)}
                        className={`p-1 rounded-full transition-all group hover:bg-neutral-100 dark:hover:bg-white/5`}>
                        <BsPencilFill
                          size={16}
                          className="text-[var(--color-iconDefault)] group-hover:text-neutral-600 dark:group-hover:text-neutral-200"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Row 4 or 3 (Create Todo Action) */}
            <div className={getRowStyles(todoRowIdx, !isSchedulingActive)}>
              <div className={`${mainRowStyles} min-h-[58px]`}>
                <div className={getLabelColStyles(todoRowIdx)}>
                  <div className="flex items-start gap-2">
                    <BsCalendarCheck className="mt-0.5 shrink-0 text-[var(--color-iconDefault)]" size={15} />
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-bold leading-normal ${isDarkMode ? 'text-neutral-300' : 'text-[#586e75]'}`}>
                        {existingTodoId ? 'Edit Scheduled Todo' : 'Create Todo'}
                      </span>
                      <span
                        className={`text-[9.5px] font-normal leading-tight opacity-65 ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>
                        Schedule action as a task with date and time
                      </span>
                    </div>
                  </div>
                </div>
                <div className={getContentColStyles(todoRowIdx)}>
                  <div className="flex items-start justify-start w-full px-4">
                    <button
                      ref={todoBtnRef}
                      onClick={() => setIsSchedulingActive(prev => !prev)}
                      onFocus={() => setFocusedRow(todoRowIdx)}
                      className={`p-1 rounded-full transition-all group hover:bg-neutral-100 dark:hover:bg-white/5 ${
                        isSchedulingActive ? 'text-blue-500 bg-neutral-100 dark:bg-white/5 shadow-inner' : ''
                      }`}>
                      <BsCalendarCheck
                        size={18}
                        className={`text-[var(--color-iconDefault)] group-hover:text-blue-500 dark:group-hover:text-blue-400 ${
                          isSchedulingActive ? 'text-blue-500 dark:text-blue-400' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Quick Scheduling Rows */}
            {isSchedulingActive && (
              <div
                className="p-4 flex flex-col gap-4 border-t border-[var(--color-borderDefault)] bg-[var(--color-popupBg)]/40">
                {/* 1. Schedule Type Row */}
                <div className="flex flex-col gap-1.5">
                  <span
                    className="text-[11.5px] font-bold tracking-wider text-neutral-400 font-semibold">
                    Schedule Type
                  </span>
                  <div className="flex items-center gap-2">
                    {(['one-time', 'recurring'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          setScheduleType(type);
                          if (type === 'one-time') {
                            setIsAnytime(false);
                          }
                        }}
                        className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all capitalize border-none cursor-pointer ${
                          scheduleType === type
                            ? isDarkMode
                              ? 'bg-white text-black shadow'
                              : 'bg-[#073642] text-white shadow'
                            : isDarkMode
                              ? 'bg-white/5 text-neutral-400 hover:text-white'
                              : 'bg-[#eee8d5]/40 text-[#586e75] hover:bg-[#eee8d5]/80'
                        }`}>
                        {type === 'one-time' ? 'One-Time' : 'Recurring'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Repeat Interval Row */}
                {scheduleType === 'recurring' && (
                  <div className="flex flex-col gap-1.5">
                    <span
                      className={`text-[11.5px] font-bold tracking-wider ${isDarkMode ? 'text-neutral-400 font-semibold' : 'text-[#586e75]'}`}>
                      Repeat Interval
                    </span>
                    <div className="flex items-center gap-2">
                      {(['daily', 'weekly', 'monthly'] as const).map(cycle => (
                        <button
                          key={cycle}
                          onClick={() => setRecurringCycle(cycle)}
                          className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all capitalize border-none cursor-pointer ${
                            recurringCycle === cycle
                              ? isDarkMode
                                ? 'bg-white text-black shadow'
                                : 'bg-[#073642] text-white shadow'
                              : isDarkMode
                                ? 'bg-white/5 text-neutral-400 hover:text-white'
                                : 'bg-[#eee8d5]/40 text-[#586e75] hover:bg-[#eee8d5]/80'
                          }`}>
                          {cycle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Time Configuration */}
                {scheduleType === 'recurring' && (
                  <div className="flex flex-col gap-1.5">
                    <span
                      className={`text-[11.5px] font-bold tracking-wider ${isDarkMode ? 'text-neutral-400 font-semibold' : 'text-[#586e75]'}`}>
                      Time Config
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsAnytime(true)}
                        className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all border-none cursor-pointer ${
                          isAnytime
                            ? isDarkMode
                              ? 'bg-white text-black shadow'
                              : 'bg-[#073642] text-white shadow'
                            : isDarkMode
                              ? 'bg-white/5 text-neutral-400 hover:text-white'
                              : 'bg-[#eee8d5]/40 text-[#586e75] hover:bg-[#eee8d5]/80'
                        }`}>
                        Automatic
                      </button>
                      <button
                        onClick={() => setIsAnytime(false)}
                        className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all border-none cursor-pointer ${
                          !isAnytime
                            ? isDarkMode
                              ? 'bg-white text-black shadow'
                              : 'bg-[#073642] text-white shadow'
                            : isDarkMode
                              ? 'bg-white/5 text-neutral-400 hover:text-white'
                              : 'bg-[#eee8d5]/40 text-[#586e75] hover:bg-[#eee8d5]/80'
                        }`}>
                        Select Time
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Unified Date & Time Picker Row */}
                <div className="flex flex-col gap-1.5">
                  <span
                    className={`text-[11.5px] font-bold tracking-wider ${isDarkMode ? 'text-neutral-400 font-semibold' : 'text-[#586e75]'}`}>
                    {scheduleType === 'recurring' ? 'Start Date & Time' : 'Date & Time'}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={todoDate}
                      onChange={e => setTodoDate(e.target.value)}
                      className={`w-36 h-8 bg-transparent border rounded-lg px-2.5 text-xs outline-none transition-all ${
                        isDarkMode
                          ? 'border-white/15 text-white bg-neutral-900 focus:border-[#9fa2ff]/50'
                          : 'border-[#eee8d5] text-[#073642] bg-[#fdf6e3] focus:border-[#c7bcff]/50'
                      }`}
                    />
                    {(scheduleType === 'one-time' || !isAnytime) && (
                      <input
                        ref={timeInputRef}
                        type="time"
                        value={todoTime}
                        onChange={e => setTodoTime(e.target.value)}
                        className={`w-28 h-8 bg-transparent border rounded-lg px-2.5 text-xs outline-none transition-all ${
                          isDarkMode
                            ? 'border-white/15 text-white bg-neutral-900 focus:border-[#9fa2ff]/50'
                            : 'border-[#eee8d5] text-[#073642] bg-[#fdf6e3] focus:border-[#c7bcff]/50'
                        }`}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Save Bar for Todo Scheduling */}
        {isSchedulingActive && (
          <div
            className={`px-4 py-2 border-t flex items-center justify-between ${
              isDarkMode ? 'bg-neutral-900/50 border-white/10' : 'bg-[#eee8d5]/20 border-[#eee8d5]'
            }`}>
            <span className="text-[9px] opacity-50 select-none">Press Ctrl+Enter to save</span>
            <button
              onClick={handleSaveTodo}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-[10px] font-bold tracking-tight transition-all active:scale-95 shadow-sm ${
                isDarkMode
                  ? 'border-[#9fa2ff] bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
                  : 'border-[#c7bcff] bg-[#f5f3ff] text-neutral-700 hover:bg-[#ebeeff]'
              }`}>
              <FiCheck size={12} />
              Save Task
            </button>
          </div>
        )}

        {/* Dynamic Bottom Bar (Save / Overwrite for text/hotkey shortcuts) */}
        <AnimatePresence>
          {!isSchedulingActive &&
            ((focusedRow === 0 && shortcutEditValue !== (shortcut || '').replace(/^\//, '')) ||
              (focusedRow === 1 && hotkeyEditValue !== hotkey)) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`px-3 py-2 border-t flex items-center justify-end gap-3 ${
                  isDarkMode ? 'bg-black/40 border-white/10' : 'bg-[#eee8d5]/30 border-[#eee8d5]'
                }`}>
                <button
                  onClick={() => {
                    if (focusedRow === 0 && isShortcutError && conflictId) onOverwriteShortcut?.(conflictId);
                    else if (focusedRow === 1 && isHotkeyError && conflictId) onOverwriteHotkey?.(conflictId);
                    else if (focusedRow === 0) onSaveShortcut(shortcutEditValue);
                    else if (focusedRow === 1) onSaveHotkey(hotkeyEditValue);
                  }}
                  disabled={isSaving}
                  className={`flex items-center gap-2 rounded-md border px-4 py-1.5 text-[10px] font-bold tracking-tight transition-all active:scale-95 shadow-sm disabled:opacity-50 ${
                    isDarkMode
                      ? 'border-[#9fa2ff] bg-neutral-800 text-neutral-100 hover:border-[#8f93ff]'
                      : 'border-[#c7bcff] bg-[#f5f3ff] text-[#073642] hover:border-[#b9adff] hover:bg-[#ebeeff]'
                  }`}>
                  {isSaving ? 'Saving...' : isShortcutError || isHotkeyError ? 'Overwrite' : 'Save'}
                </button>
              </motion.div>
            )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default FavoritesContextMenu;
