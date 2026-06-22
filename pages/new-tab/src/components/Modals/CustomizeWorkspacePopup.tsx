import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector, useDispatch } from 'react-redux';
import { FaRegFolder, FaLayerGroup, FaFolder } from 'react-icons/fa';
import { LuPencil } from 'react-icons/lu';
import { editWorkspaceName, updateWorkspaceCustomization } from '../../../../Apis/features/workspaceApiServices';
import { Workspace } from '../../../../modals/interfaces';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import useToast from '../Shared/Toast/useToast';
import { selectSelectedTeam, selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import { optimisticUpdateWorkspace } from '../../../../Redux/AllData/allDataSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

interface CustomizeWorkspacePopupProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  reload: () => void;
}

const CustomizeWorkspacePopup: React.FC<CustomizeWorkspacePopupProps> = ({ isOpen, onClose, workspace, reload }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState<string>(workspace?.workspace_name || '');
  const [selectedColor, setSelectedColor] = useState<string>(workspace?.color || '#FFC107');
  const [selectedIcon, setSelectedIcon] = useState<string>(workspace?.icon || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingIcon, setIsEditingIcon] = useState<boolean>(false);
  const [tempIcon, setTempIcon] = useState<string>('');
  const [tempColor, setTempColor] = useState<string>('#FFC107');

  const triggerToast = useToast();
  const selectedTeam = useSelector(selectSelectedTeam);
  const isMac = useSelector(selectIsMac);

  useEffect(() => {
    if (isOpen && workspace) {
      // Load from workspace object (cloud data)
      setName(workspace.workspace_name);
      setSelectedColor(workspace.color || '#FFC107');
      setSelectedIcon(workspace.icon || '');
    }
  }, [isOpen, workspace]);

  const handleEditIconClick = () => {
    setIsEditingIcon(true);
    setTempIcon(selectedIcon);
    setTempColor(selectedColor);
  };

  const handleSaveIcon = () => {
    setSelectedIcon(tempIcon);
    setSelectedColor(tempColor);
    setIsEditingIcon(false);
  };

  const handleCancelIcon = () => {
    setIsEditingIcon(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      // 1. API Update (Name only if changed)
      if (name.trim() !== workspace.workspace_name) {
        await editWorkspaceName(workspace.workspace_id, name, selectedTeam?.storageMode ?? 'cloud');
      }

      // 2. API Update (Icon and Color)
      const iconChanged = selectedIcon !== (workspace.icon || '');
      const colorChanged = selectedColor !== (workspace.color || '#FFC107');

      if (iconChanged || colorChanged) {
        await updateWorkspaceCustomization(workspace.workspace_id, selectedIcon || null, selectedColor || null, selectedTeam?.storageMode ?? 'cloud');
      }

      // 3. Optimistic Update (UI)
      if (selectedTeam) {
        dispatch(
          optimisticUpdateWorkspace({
            teamId: selectedTeam.team_id,
            workspaceId: workspace.workspace_id,
            updates: {
              workspace_name: name.trim(),
              icon: selectedIcon || null,
              color: selectedColor || null,
            },
          }),
        );
      }

      triggerToast('Workspace customization saved', 'success');
      reload();
      onClose();
    } catch (error) {
      console.error('Failed to update workspace', error);
      triggerToast('Failed to save workspace customization', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();

      if (isEditingIcon) {
        if (e.key === 'Escape') {
          handleCancelIcon();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSaveIcon();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      }
      // Save on Cmd+S / Ctrl+S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Save on Enter (standard) or Cmd+Enter / Ctrl+Enter
      if (e.key === 'Enter') {
        if (!e.shiftKey || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleSave, isEditingIcon, selectedIcon, selectedColor, tempIcon, tempColor]);

  if (!isOpen) return null;

  const displayIcon = isEditingIcon ? tempIcon : selectedIcon;
  const displayColor = isEditingIcon ? tempColor : selectedColor;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20" onClick={onClose}>
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.05}
        animate={{
          width: 550,
          height: isEditingIcon ? 520 : 200,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-[#fdf6e3]/95 dark:bg-frostedwhite backdrop-blur-sm rounded-lg border border-[var(--color-borderDefault)] shadow-xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <AnimatePresence mode="wait">
          <motion.div
            key="customize-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0">
            {/* Top Section */}
            <div className="p-4 pb-2 flex items-center gap-4 shrink-0 bg-transparent z-10">
              <div className="relative group/icon">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-neutral-100 dark:border-white/10 shadow-sm transition-all duration-300 relative overflow-hidden"
                  style={{
                    backgroundColor: displayColor ? displayColor + '15' : undefined,
                    boxShadow: displayColor ? `0 0 20px ${displayColor}20` : undefined,
                  }}>
                  {/* Soft Glow Layer */}
                  {displayColor && (
                    <div className="absolute inset-0 opacity-20 blur-xl" style={{ backgroundColor: displayColor }} />
                  )}

                  <div
                    className="text-2xl drop-shadow-sm transition-colors relative z-10"
                    style={{ color: displayColor }}>
                    {displayIcon ? (
                      displayIcon.startsWith('U+') ? (
                        <span>{String.fromCodePoint(parseInt(displayIcon.replace('U+', ''), 16))}</span>
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: displayIcon }} />
                      )
                    ) : (
                      <FaRegFolder />
                    )}
                  </div>
                </div>
                {!isEditingIcon && (
                  <button
                    onClick={handleEditIconClick}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-popupBg)] rounded-full shadow border border-[var(--color-borderDefault)] flex items-center justify-center text-neutral-400 hover:text-blue-500 hover:border-blue-500 transition-colors z-20"
                    title="Edit Folder">
                    <LuPencil size={10} />
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold tracking-wider flex items-center gap-1.5 ml-1">
                    <span className="font-semibold">Edit Folder</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                    <FiX size={18} />
                  </button>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isEditingIcon}
                  className={`w-full text-xl font-bold text-neutral-800 dark:text-neutral-100 bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-700 ${isEditingIcon ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="Workspace Name"
                  autoFocus={!isEditingIcon}
                />
              </div>
            </div>

            <div className="h-[1px] w-full bg-neutral-100 dark:bg-white/5" />

            {/* Embedded Picker - Only show when editing icon */}
            {isEditingIcon && (
              <div className="flex-1 min-h-0 bg-transparent overflow-y-auto custom-scrollbar">
                <EmojiPicker
                  onSelectIcon={icon => {
                    setSelectedIcon(icon);
                    setIsEditingIcon(false);
                  }}
                  onSelectColor={color => {
                    setSelectedColor(color);
                    setSelectedIcon('');
                    setIsEditingIcon(false);
                  }}
                  showColorPicker={true}
                  continuousScroll={true}
                  previewIcon={tempIcon}
                  compact={true}
                  colorSectionLabel="Folder Colors"
                  className="w-full h-full border-none"
                />
              </div>
            )}

            {/* Spacer to push footer to bottom when not editing */}
            {!isEditingIcon && <div className="flex-1" />}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-[var(--color-containerBg)] border-t border-white/10 dark:border-white/5 shrink-0">
              <button
                onClick={isEditingIcon ? handleCancelIcon : onClose}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-transparent bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-neutral-700 dark:text-neutral-400 transition-colors group">
                <span>{isEditingIcon ? 'Back' : 'Cancel'}</span>
                <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/20 px-1 rounded ml-1">
                  ESC
                </span>
              </button>
              <button
                onClick={isEditingIcon ? handleSaveIcon : handleSave}
                disabled={!isEditingIcon && (!name.trim() || isSaving)}
                className={`flex items-center gap-2 px-2 py-0.5 text-[10px] font-semibold rounded-md border shadow-sm transition-colors ${
                  isEditingIcon || (name.trim() && !isSaving)
                    ? 'border-[#93a1a1] dark:border-[#9fa2ff] bg-[#eee8d5] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#839496] dark:hover:border-[#8f93ff]'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                }`}>
                {isSaving && !isEditingIcon ? 'Saving...' : isEditingIcon ? 'Save' : 'Save Changes'}
                <span className="flex items-center gap-0.5 text-[8px] font-semibold text-neutral-500 dark:text-neutral-300 ml-1">
                  <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                    {isMac ? '⌘' : 'Ctrl'}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-300">+</span>
                  <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                    Enter
                  </span>
                </span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body,
  );
};

export default CustomizeWorkspacePopup;
