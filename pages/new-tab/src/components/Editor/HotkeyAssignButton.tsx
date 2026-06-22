import type React from 'react';
import { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import { FaStar, FaEllipsisV } from 'react-icons/fa';
import { FiStar } from 'react-icons/fi';
import { BsKeyboard } from 'react-icons/bs';
import { setHighlightedCommandId, setIsCommandListView, selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import { useSelector, useDispatch } from 'react-redux';
import { COMMANDS } from '../SearchComponents/Searchbar/commands';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import { useHotkeyValidation } from '../../hooks/useHotkeyValidation';
import { HotkeyShortcutGridPopup } from '../Shared/HotkeyShortcutGridPopup';

interface HotkeyAssignButtonProps {
  itemId?: string; // Compound ID for conflict checking
  currentHotkey?: string;
  onHotkeyChange?: (hotkey: string) => void;
  currentShortcut?: string;
  onShortcutChange?: (shortcut: string) => void;
  isMac?: boolean;
  disabled?: boolean;
  className?: string;
  onOverwriteHotkey?: (conflictId: string, newValue: string) => Promise<void>;
  onOverwriteShortcut?: (conflictId: string, newValue: string) => Promise<void>;
  defaultName?: string;
  isNewAgent?: boolean;
  isShortcutsOpen?: boolean;
  onToggleShortcuts?: () => void;
  useEllipsis?: boolean;
  onlyShortcutsOption?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClose?: () => void;
  showFavorite?: boolean;
  isFavLoading?: boolean;
  isHotkeyLoading?: boolean;
  isShortcutLoading?: boolean;
}

type ViewMode = 'none' | 'menu' | 'hotkey' | 'shortcut';

const HotkeyAssignButton = forwardRef<HTMLButtonElement, HotkeyAssignButtonProps>(
  (
    {
      itemId = '',
      currentHotkey = '',
      onHotkeyChange,
      currentShortcut = '',
      onShortcutChange,
      isMac = false,
      disabled = false,
      className = '',
      onOverwriteHotkey,
      onOverwriteShortcut,
      defaultName = '',
      isNewAgent = false,
      useEllipsis = false,
      onKeyDown,
      isFavorite = false,
      onToggleFavorite,
      onClose,
      showFavorite = false,
      isFavLoading = false,
      isHotkeyLoading = false,
      isShortcutLoading = false,
    },
    ref,
  ) => {
    // We keep 'viewMode' to track local state, but the actual display is handled by UnifiedContextMenu
    const [viewMode, setViewMode] = useState<ViewMode>('none');
    const [editValue, setEditValue] = useState(currentHotkey);
    const [shortcutValue, setShortcutValue] = useState(currentShortcut);
    const [isSaving, setIsSaving] = useState(false);
    // We will pass this to UnifiedContextMenu as {x, y}
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

    const internalButtonRef = useRef<HTMLButtonElement>(null);
    const prevViewModeRef = useRef<ViewMode>(viewMode);

    const { captureHotkey } = useHotkeyAssignment(editValue, isMac);
    const { validateHotkey, validateShortcut } = useHotkeyValidation();
    const isDarkMode = useSelector(selectDarkMode);

    const [saveError, setSaveError] = useState<string | null>(null);
    const [conflictId, setConflictId] = useState<string | null>(null);

    const prevDefaultNameRef = useRef(defaultName);
    const lastIntendedShortcutRef = useRef(currentShortcut);

    // Sync ref with prop if it changes externally (not by us)
    useEffect(() => {
      lastIntendedShortcutRef.current = currentShortcut;
    }, [currentShortcut]);

    // Sync shortcut with title
    useEffect(() => {
      if (isNewAgent || !onShortcutChange || defaultName === prevDefaultNameRef.current) return;

      const normalize = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

      const oldTitleNorm = normalize(prevDefaultNameRef.current);
      const newTitleNorm = normalize(defaultName);
      const currentShortcutNorm = normalize(lastIntendedShortcutRef.current);

      const isUntitled = !defaultName.trim() || defaultName.toLowerCase().includes('untitled automation');

      // Condition 1: It was previously in sync with the old title
      const wasInSync = currentShortcutNorm === oldTitleNorm;

      // Condition 2: Initial sync (shortcut is empty, title is newly provided)
      const shouldInitialSync = !currentShortcutNorm && !isUntitled && newTitleNorm.length > 2;

      if (!isUntitled && (wasInSync || shouldInitialSync)) {
        const newShortcut = defaultName.trim().replace(/[^a-zA-Z0-9 ]/g, '');
        if (normalize(newShortcut) !== currentShortcutNorm) {
          lastIntendedShortcutRef.current = newShortcut; // Update ref immediately to avoid race
          const checkAndSave = async () => {
            const res = await validateShortcut(newShortcut, itemId);
            if (!res.errorMessage) {
              setShortcutValue(newShortcut);
              onShortcutChange(newShortcut);
            }
          };
          checkAndSave();
        }
      }
      prevDefaultNameRef.current = defaultName;
    }, [defaultName, itemId, onShortcutChange, validateShortcut]);

    // Sync with props when closed
    useEffect(() => {
      if (viewMode === 'none') {
        setEditValue(currentHotkey);
        setShortcutValue(currentShortcut);
        setSaveError(null);
        setConflictId(null);

        // Only call onClose if we were previously OPEN
        if (prevViewModeRef.current !== 'none') {
          onClose?.();
        }
      }
      prevViewModeRef.current = viewMode;
    }, [currentHotkey, currentShortcut, viewMode, onClose]);

    // Real-time validation
    useEffect(() => {
      const timer = setTimeout(async () => {
        if (viewMode === 'none') return;

        if (viewMode === 'hotkey' && editValue) {
          const res = await validateHotkey(editValue, itemId);
          setSaveError(res.errorMessage);
          setConflictId(res.conflictId);
        } else if (viewMode === 'shortcut' && shortcutValue) {
          const res = await validateShortcut(shortcutValue, itemId);
          setSaveError(res.errorMessage);
          setConflictId(res.conflictId);
        } else if (viewMode === 'menu') {
          // Validate both in the full grid popup
          let combinedError: string | null = null;
          let combinedConflictId: string | null = null;

          if (editValue && editValue !== currentHotkey) {
            const hRes = await validateHotkey(editValue, itemId);
            if (hRes.errorMessage) {
              combinedError = hRes.errorMessage;
              combinedConflictId = hRes.conflictId;
            }
          }

          if (!combinedError && shortcutValue && shortcutValue !== currentShortcut) {
            const sRes = await validateShortcut(shortcutValue, itemId);
            if (sRes.errorMessage) {
              combinedError = sRes.errorMessage;
              combinedConflictId = sRes.conflictId;
            }
          }

          setSaveError(combinedError);
          setConflictId(combinedConflictId);
        } else {
          setSaveError(null);
          setConflictId(null);
        }
      }, 300);

      return () => clearTimeout(timer);
    }, [editValue, shortcutValue, viewMode, itemId, validateHotkey, validateShortcut, currentHotkey, currentShortcut]);

    const handleOpenMenu = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;

        // Reset to initial values on open
        setEditValue(currentHotkey);
        setShortcutValue(currentShortcut);
        setSaveError(null);
        setConflictId(null);

        const rect =
          (ref as any)?.current?.getBoundingClientRect() || internalButtonRef.current?.getBoundingClientRect();
        if (rect) {
          // Position slightly below button
          setPopupPosition({
            x: rect.left,
            y: rect.bottom + 4,
          });
        }
        setViewMode('menu');
      },
      [disabled, ref, currentHotkey, currentShortcut],
    );

    const handleHotkeyCapture = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        const result = captureHotkey(e);
        if (result === 'CANCEL') {
          setViewMode('menu');
          setEditValue(currentHotkey);
        } else if (result) {
          setEditValue(result);
        }
      },
      [captureHotkey, currentHotkey],
    );

    const handleSaveHotkey = useCallback(async () => {
      // If empty, clear it
      if (!editValue) {
        setViewMode('none');
        if (onHotkeyChange) onHotkeyChange('');
        return;
      }

      if (saveError) {
        // Don't save if there's an error
        return;
      }

      setIsSaving(true);

      try {
        if (onHotkeyChange) onHotkeyChange(editValue);
        setViewMode('none');
      } catch (error) {
        console.error('Failed to save hotkey:', error);
      } finally {
        setIsSaving(false);
      }
    }, [editValue, onHotkeyChange, saveError]);

    const handleSaveShortcut = useCallback(async () => {
      let normalized = shortcutValue.trim();
      if (normalized && !normalized.startsWith('/')) {
        normalized = `/${normalized}`;
      }

      if (!normalized) {
        if (onShortcutChange) onShortcutChange('');
        setViewMode('none');
        return;
      }

      if (saveError) {
        return;
      }

      if (onShortcutChange) {
        onShortcutChange(normalized.replace(/^\//, ''));
      }
      setViewMode('none');
    }, [shortcutValue, onShortcutChange, saveError]);

    const handleClearHotkey = useCallback(() => {
      setEditValue('');
      if (onHotkeyChange) onHotkeyChange('');
      setViewMode('none');
    }, [onHotkeyChange]);

    const handleClearShortcut = useCallback(() => {
      setShortcutValue('');
      if (onShortcutChange) {
        onShortcutChange('');
      }
      setViewMode('none');
    }, [onShortcutChange]);

    const handleOverwriteHotkeyWrap = useCallback(
      async (conflictId: string) => {
        if (onOverwriteHotkey) {
          setIsSaving(true);
          try {
            await onOverwriteHotkey(conflictId, editValue);
            setViewMode('none');
          } catch (error) {
            console.error('Failed to overwrite hotkey:', error);
          } finally {
            setIsSaving(false);
          }
        }
      },
      [onOverwriteHotkey, editValue],
    );

    const handleOverwriteShortcutWrap = useCallback(
      async (conflictId: string) => {
        if (onOverwriteShortcut) {
          let normalized = shortcutValue.trim();
          if (normalized && !normalized.startsWith('/')) {
            normalized = `/${normalized}`;
          }
          setIsSaving(true);
          try {
            await onOverwriteShortcut(conflictId, normalized.replace(/^\//, ''));
            setViewMode('none');
          } catch (error) {
            console.error('Failed to overwrite shortcut:', error);
          } finally {
            setIsSaving(false);
          }
        }
      },
      [onOverwriteShortcut, shortcutValue],
    );

    return (
      <>
        <button
          ref={ref || internalButtonRef}
          type="button"
          onClick={handleOpenMenu}
          onKeyDown={onKeyDown}
          disabled={disabled}
          title={currentHotkey ? `Hotkey: ${currentHotkey}` : 'Assign a Keyboard Shortcut / Text Command'}
          className={`flex items-center justify-center transition-all ${
            useEllipsis
              ? 'p-1 bg-transparent border-none text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              : currentHotkey || currentShortcut
                ? 'p-1.5 rounded-lg border bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400'
                : 'p-1.5 rounded-lg border bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : !useEllipsis ? 'hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer' : 'cursor-pointer'} ${className}`}>
          {useEllipsis ? (
            <FaEllipsisV size={11} />
          ) : currentHotkey || currentShortcut ? (
            <div className="flex items-center divide-x divide-purple-200 dark:divide-purple-700/50 relative">
              {(isHotkeyLoading || isShortcutLoading) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-lg z-10">
                  <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                </div>
              )}
              <div className="flex items-center divide-x divide-purple-200 dark:divide-purple-700/50">
                {currentHotkey && (
                  <span className="text-[10px] font-mono font-bold px-1.5 whitespace-nowrap">{currentHotkey}</span>
                )}
                {currentShortcut && (
                  <span className="text-[10px] font-mono font-bold px-1.5 whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                    /{currentShortcut}
                  </span>
                )}
              </div>
            </div>
          ) : showFavorite ? (
            <div className="flex items-center justify-center min-w-[20px] relative">
              {isFavLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
              ) : isFavorite ? (
                <FaStar size={12} className="text-yellow-500" />
              ) : (
                <FiStar size={12} />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center relative min-w-[20px]">
              {isHotkeyLoading || isShortcutLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              ) : (
                <BsKeyboard size={14} />
              )}
            </div>
          )}
        </button>

        {viewMode !== 'none' && popupPosition && (
          <HotkeyShortcutGridPopup
            x={popupPosition.x}
            y={popupPosition.y}
            onClose={() => setViewMode('none')}
            isDarkMode={isDarkMode}
            // Values
            shortcutValue={currentShortcut}
            hotkeyValue={currentHotkey}
            // Editing states
            shortcutEditValue={shortcutValue}
            onShortcutEditChange={setShortcutValue}
            hotkeyEditValue={editValue}
            onHotkeyEditChange={handleHotkeyCapture}
            // Actions
            onSaveShortcut={() => handleSaveShortcut()}
            onSaveHotkey={() => handleSaveHotkey()}
            onClearShortcut={handleClearShortcut}
            onClearHotkey={handleClearHotkey}
            onOverwriteShortcut={conflictId ? handleOverwriteShortcutWrap : undefined}
            onOverwriteHotkey={conflictId ? handleOverwriteHotkeyWrap : undefined}
            // Status
            isSaving={isSaving}
            error={saveError}
            conflictId={conflictId}
            showSuccess={null}
            title="Favorite:"
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            showFavorite={showFavorite}
            isFavLoading={isFavLoading}
            isHotkeySyncing={isHotkeyLoading}
            isShortcutSyncing={isShortcutLoading}
          />
        )}
      </>
    );
  },
);

export default HotkeyAssignButton;
