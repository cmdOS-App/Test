import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FiX, FiLoader, FiGlobe, FiLock } from 'react-icons/fi';
import { BsPeopleFill } from 'react-icons/bs';
import type { NewShareFolder } from '../../../../Apis/features/folderApiServices';
import { createSharedFolder, FolderAccess, updateFolderCustomization } from '../../../../Apis/features/folderApiServices';
import { useSelector, useDispatch } from 'react-redux';
import { selectSelectedTeam, setCommandStatus, selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import type { Workspace } from '../../../../modals/interfaces';
import { fetchWorkspacesThunk } from '../../../../Redux/Workspaces/workspaceSlice';
import { LuPencil } from 'react-icons/lu';
import { FaRegFolder } from 'react-icons/fa';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateCollectionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  reload: () => void;
  selectedWorkspace: Workspace;
}

const CreateCollectionPopup: React.FC<CreateCollectionPopupProps> = ({
  isOpen,
  onClose,
  reload,
  selectedWorkspace,
}) => {
  const [name, setName] = useState<string>('');
  const [access, setAccess] = useState<FolderAccess>(FolderAccess.PUBLIC);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancedMode] = useState<boolean>(true);
  const [selectedColor, setSelectedColor] = useState<string>('#FFC107');
  const [selectedIcon, setSelectedIcon] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isEditingIcon, setIsEditingIcon] = useState<boolean>(false);
  const [tempIcon, setTempIcon] = useState<string>('');
  const [tempColor, setTempColor] = useState<string>('#FFC107');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTeam = useSelector(selectSelectedTeam);
  const allTeams = useSelector(selectAllData);
  const isMac = useSelector(selectIsMac);

  const dispatch = useDispatch();

  // Animation timing
  useEffect(() => {
    if (isOpen) {
      // Determine default access based on workspace type
      const workspaceType = (selectedWorkspace as any)?.type;
      setAccess(workspaceType === 'private' ? FolderAccess.PRIVATE : FolderAccess.PUBLIC);

      setTimeout(() => {
        setIsVisible(true);
        inputRef.current?.focus();
      }, 50);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, selectedWorkspace]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when returning from icon edit
  useEffect(() => {
    if (!isEditingIcon && isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300); // Increased timeout to wait for Exit animation
    }
  }, [isEditingIcon, isOpen]);

  const handleClose = (): void => {
    if (isLoading) return; // Prevent closing while loading

    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setName('');
      setError(null);
      setSelectedColor('#FFC107');
      setSelectedIcon('');
    }, 300);
  };

  const handleSave = async () => {
    const folder = selectedWorkspace?.folders.find(folder => folder.folder_name === name.trim());
    if (folder) {
      setError('Sub-folder with this name already exists');
      return;
    }
    if (name.trim()) {
      try {
        setIsLoading(true);
        dispatch(setCommandStatus({ status: 'loading', message: 'Creating folder...' }));

        // Determine correct org_id based on the workspace owner
        let targetOrgId = selectedTeam?.team_id;

        // Safety check: If the selected workspace belongs to the Personal Space team, use that team ID
        if (allTeams && Array.isArray(allTeams) && selectedWorkspace?.workspace_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const owningTeam = allTeams.find(
            (t: any) =>
              t.workspaces && t.workspaces.some((w: any) => w.workspace_id === selectedWorkspace.workspace_id),
          );
          if (owningTeam) {
            targetOrgId = owningTeam.team_id;
          }
        }

        const newSharedFolder: NewShareFolder = {
          org_id: targetOrgId,
          workspace_id: selectedWorkspace?.workspace_id,
          access_code: access,
          name: name,
        };
        const res = await createSharedFolder(newSharedFolder, selectedTeam?.storageMode ?? 'cloud');

        // If enhanced mode was used, apply customization
        if (isEnhancedMode && (selectedIcon || selectedColor !== '#546E7A')) {
          const folder_id = res.folder_id || res.id || (res.folder && res.folder.folder_id);
          if (folder_id) {
            await updateFolderCustomization(folder_id, selectedIcon || null, selectedColor || null, selectedTeam?.storageMode ?? 'cloud');
          }
        }
        reload();
        if (selectedTeam?.team_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (dispatch as any)(fetchWorkspacesThunk(selectedTeam.team_id));
        }
        dispatch(setCommandStatus({ status: 'success', message: 'Folder created successfully' }));
        setTimeout(() => {
          dispatch(setCommandStatus({ status: 'idle', message: '' }));
        }, 3000);
        handleClose();
      } catch (error: any) {
        const serverErrorMessage = error.response?.data?.error || error?.message;
        setError(serverErrorMessage || 'Failed to create sub-folder');
        // Do NOT close on error
      } finally {
        setIsLoading(false);
        // Only close if no error
      }
    }
  };

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

  const displayIcon = isEditingIcon ? tempIcon : selectedIcon;
  const displayColor = isEditingIcon ? tempColor : selectedColor;

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation();

    if (isEditingIcon) {
      if (e.key === 'Escape') {
        handleCancelIcon();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveIcon();
      }
      return;
    }

    if (e.key === 'Escape' && !isLoading) {
      handleClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && name.trim() && !isLoading) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isVisible ? 1 : 0 }}>
      <motion.div
        ref={popupRef}
        animate={{
          width: 550,
          height: isEditingIcon ? 520 : 200,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-[#fdf6e3]/95 dark:bg-frostedwhite backdrop-blur-sm rounded-lg border border-[var(--color-borderDefault)] shadow-xl transform transition-all duration-0 ease-in-out overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}>
        <AnimatePresence mode="wait">
          <motion.div
            key="enhanced-mode"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0">
            {/* Enhanced UI Content */}
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
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold tracking-wider flex items-center gap-1.5 ml-1">
                    <span className="opacity-100 font-semibold">Create Sub-folder</span>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                    <FiX size={18} />
                  </button>
                </div>
                <input
                  ref={inputRef}
                  id="enhanced-collection-name"
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isEditingIcon}
                  className={`w-full text-xl font-bold text-neutral-800 dark:text-neutral-100 bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-700 ${isEditingIcon ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="Sub-folder Name"
                  autoFocus={!isEditingIcon}
                />
              </div>
            </div>

            <div className="h-[1px] w-full bg-neutral-100 dark:bg-white/5" />

            {/* Visibility Selection Area Removed for Inheritance */}
            {/* Embedded Picker - Only show when editing icon */}

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

            {/* Inline Error Display */}
            {error && (
              <div className="px-5 py-2 text-xs text-red-500 font-medium bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/20 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-[var(--color-containerBg)] border-t border-white/10 dark:border-white/5 shrink-0">
              <button
                onClick={isEditingIcon ? handleCancelIcon : handleClose}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-xl border border-transparent bg-white/10 dark:bg-white/5 hover:bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 transition-colors group">
                <span>{isEditingIcon ? 'Back' : 'Cancel'}</span>
                <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/20 px-1 rounded ml-1">
                  ESC
                </span>
              </button>
              <button
                onClick={isEditingIcon ? handleSaveIcon : handleSave}
                disabled={!isEditingIcon && (!name.trim() || isLoading)}
                className={`flex items-center gap-2 px-2 py-0.5 text-[10px] font-semibold rounded-md border shadow-sm transition-colors ${
                  isEditingIcon || (name.trim() && !isLoading)
                    ? 'border-[#93a1a1] dark:border-[#9fa2ff] bg-[#eee8d5] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#839496] dark:hover:border-[#8f93ff]'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                }`}>
                {isLoading && !isEditingIcon ? (
                  <>
                    <FiLoader className="animate-spin mr-1" size={12} />
                    Creating...
                  </>
                ) : isEditingIcon ? (
                  'Save'
                ) : (
                  'Create'
                )}
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
    </div>
  );
};

export default CreateCollectionPopup;
