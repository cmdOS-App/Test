import React, { useState, useRef } from 'react';
import { UnifiedContextMenu, MenuAction } from './UnifiedContextMenu';
import { FaEdit } from 'react-icons/fa';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import { useSelector } from 'react-redux';
import { selectIsMac } from '../../../../Redux/AllData/uiStateSlice';

interface SharedHotkeyCellProps {
  itemId: string;
  currentValue: string;
  type: 'hotkey' | 'shortcut';
  onUpdate: (value: string) => Promise<void>;
  onCheckConflict?: (value: string) => Promise<{ isConflict: boolean; conflictId?: string; message?: string }>;
  onOverwrite?: (conflictId: string, value: string) => Promise<void>;
  canEdit?: boolean;
  className?: string;
  title?: string;
  portalContainer?: HTMLElement | null;
}

export const SharedHotkeyCell: React.FC<SharedHotkeyCellProps> = ({
  itemId,
  currentValue,
  type,
  onUpdate,
  onCheckConflict,
  onOverwrite,
  canEdit = true,
  className = '',
  title,
  portalContainer,
}) => {
  const isMac = useSelector(selectIsMac);
  const [viewMode, setViewMode] = useState<'none' | 'edit'>('none');
  const [editValue, setEditValue] = useState(currentValue);
  const { captureHotkey } = useHotkeyAssignment(editValue, isMac);
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const cellRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();

    const rect = cellRef.current?.getBoundingClientRect();
    if (rect) {
      setInputPosition({ x: rect.left, y: rect.bottom + 4 });
    }

    // For shortcuts, strip the leading slash since UnifiedContextMenu renders it as a fixed prefix
    if (type === 'shortcut' && currentValue.startsWith('/')) {
      setEditValue(currentValue.substring(1));
    } else {
      setEditValue(currentValue);
    }

    setViewMode('edit');
  };

  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setConflictId(null);
    try {
      if (onCheckConflict && editValue) {
        const conflict = await onCheckConflict(editValue);
        if (conflict.isConflict) {
          setSaveError(conflict.message || 'Conflict detected');
          setConflictId(conflict.conflictId || null);
          setIsSaving(false);
          return;
        }
      }

      await onUpdate(editValue);
      setViewMode('none');
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      if (!conflictId) {
        setIsSaving(false);
      }
    }
  };

  const handleOverwrite = async (cId: string) => {
    if (onOverwrite) {
      setIsSaving(true);
      try {
        await onOverwrite(cId, editValue);
        // After overwrite, we try to save again (or the parent handles it?)
        // Usually InteractiveItemsList handles both clear + save in separate steps but initiated from overwrite.
        // Let's assume onOverwrite handles everything (clearing old + saving new)
        // OR we might need to call handleSave again?
        // In InteractiveItemsList handleOverwriteHotkey calls saveHotkey internally.
        // So we just close viewMode here.
        setViewMode('none');
      } catch (e) {
        console.error(e);
        setSaveError('Overwrite failed');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // We only use the input part of UnifiedContextMenu, but it requires actions?
  // Actually, we can pass empty actions if we just want the input.
  // Or better, we can construct a simple menu if we want "Clear" action.

  const menuActions: MenuAction[] = []; // Empty for now, maybe add Clear?

  const hotkeyInputProps =
    type === 'hotkey'
      ? {
          value: editValue,
          onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
            const result = captureHotkey(e);
            if (result === 'CANCEL') {
              setViewMode('none');
            } else if (result) {
              setEditValue(result);
            }
          },
          onSave: handleSave,
          onCancel: () => setViewMode('none'),
          isSaving,
          isUpdating: !!currentValue,
          onClear: async () => {
            setEditValue('');
            setIsSaving(true);
            try {
              await onUpdate('');
              setViewMode('none');
            } catch (e) {
              console.error(e);
            } finally {
              setIsSaving(false);
            }
          },
          showSuccess: null,
          showError: saveError,
          onOverwrite: onOverwrite ? (id: string) => handleOverwrite(id) : undefined,
        }
      : undefined;

  const shortcutInputProps =
    type === 'shortcut'
      ? {
          value: editValue,
          onChange: (val: string) => setEditValue(val),
          onSave: handleSave,
          onCancel: () => setViewMode('none'),
          isSaving,
          isUpdating: !!currentValue,
          onClear: async () => {
            setEditValue('');
            setIsSaving(true);
            try {
              await onUpdate('');
              setViewMode('none');
            } catch (e) {
              console.error(e);
            } finally {
              setIsSaving(false);
            }
          },
          showSuccess: null,
          showError: saveError,
          onOverwrite: onOverwrite ? (id: string) => handleOverwrite(id) : undefined,
        }
      : undefined;

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div
        ref={cellRef}
        className={`cursor-pointer ${className}`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ minHeight: '1.5em', minWidth: '40px' }} // Ensure hit area
        title={
          title || (currentValue ? `Current: ${currentValue}` : `Assign ${type === 'hotkey' ? 'Hotkey' : 'Shortcut'}`)
        }>
        {currentValue ? (
          currentValue
        ) : isHovered ? (
          <span className="opacity-50 italic text-[10px] whitespace-nowrap">
            Assign {type === 'hotkey' ? 'Hotkey' : 'Shortcut'}
          </span>
        ) : null}
      </div>

      {viewMode === 'edit' && inputPosition && (
        <UnifiedContextMenu
          x={inputPosition.x}
          y={inputPosition.y}
          onClose={() => setViewMode('none')}
          itemId={itemId}
          actions={menuActions}
          hotkeyInput={hotkeyInputProps as any} // fix type later
          shortcutInput={shortcutInputProps}
          error={saveError || undefined}
          conflictId={conflictId}
          portalContainer={portalContainer}
        />
      )}
    </>
  );
};
