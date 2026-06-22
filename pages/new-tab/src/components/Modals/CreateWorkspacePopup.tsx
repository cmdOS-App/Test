import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FiX, FiLock, FiGlobe, FiLoader } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { setCommandStatus, selectSelectedTeam, selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import { BsPeopleFill } from 'react-icons/bs';
import { createNewWorkspace, updateWorkspaceCustomization } from '../../../../Apis/features/workspaceApiServices';
import { fetchWorkspacesThunk } from '../../../../Redux/Workspaces/workspaceSlice';
import { LuPencil } from 'react-icons/lu';
import { FaRegFolder } from 'react-icons/fa';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateWorkspacePopupProps {
  isOpen: boolean;
  onClose: () => void;
  reload: () => void;
  defaultAccess?: 'public' | 'private' | 'shareonly';
  zIndex?: number;
  isPersonalSpace?: boolean;
  targetTeamId?: string;
}

const CreateWorkspacePopup: React.FC<CreateWorkspacePopupProps> = ({
  isOpen,
  onClose,
  reload,
  defaultAccess = 'public',
  zIndex = 50,
  isPersonalSpace = false,
  targetTeamId,
}) => {
  const [name, setName] = useState<string>('');
  const [access, setAccess] = useState<'public' | 'private' | 'shareonly'>(defaultAccess);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancedMode] = useState<boolean>(true);
  const [selectedColor, setSelectedColor] = useState<string>('#FFC107');
  const [selectedIcon, setSelectedIcon] = useState<string>('U+1F4C1');
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
      setAccess(defaultAccess);
      setTimeout(() => {
        setIsVisible(true);
        inputRef.current?.focus();
      }, 50);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, defaultAccess]);

  // Focus input when returning from icon edit
  useEffect(() => {
    if (!isEditingIcon && isOpen) {
      // Small timeout to ensure input is enabled/rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isEditingIcon, isOpen]);

  const handleClose = (): void => {
    if (isLoading) return; // Prevent closing while loading

    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setName('');
      setError(null);
      setAccess(defaultAccess);
      setSelectedColor('#FFC107');
      setSelectedIcon('');
    }, 300);
  };

  const handleSave = async () => {
    // Determine the correct team:
    // 1. If targetTeamId is explicitly provided, find that team
    // 2. Else if isPersonalSpace is true, find the Personal Space team
    // 3. Otherwise use selectedTeam

    let targetTeam = selectedTeam;

    if (targetTeamId && allTeams) {
      const foundTeam = allTeams.find(t => t.team_id === targetTeamId);
      if (foundTeam) {
        targetTeam = foundTeam;
      }
    } else if (isPersonalSpace && allTeams) {
      const personalTeam = allTeams.find(t => t.is_personal_space);
      if (personalTeam) {
        targetTeam = personalTeam;
      }
    }

    if (!targetTeam) {
      setError('No organization found');
      return;
    }

    const workspace = targetTeam.workspaces.find(workspace => workspace.workspace_name === name.trim());
    if (workspace) {
      setError('Folder with this name already exists');
      return;
    }

    if (name.trim()) {
      try {
        setIsLoading(true);
        dispatch(setCommandStatus({ status: 'loading', message: 'Creating folder...' }));

        // Ensure access is consistently 'private' for Personal Space
        const finalAccess = isPersonalSpace ? 'private' : access;

        const res = await createNewWorkspace(name.trim(), finalAccess, targetTeam.team_id, targetTeam?.storageMode ?? 'cloud');

        // If enhanced mode was used, apply customization
        if (isEnhancedMode && (selectedIcon || selectedColor !== '#546E7A')) {
          const workspace_id = res.workspace_id || res.id || (res.workspace && res.workspace.workspace_id);
          if (workspace_id) {
            await updateWorkspaceCustomization(workspace_id, selectedIcon || null, selectedColor || null, targetTeam?.storageMode ?? 'cloud');
          }
        }
        reload();
        if (targetTeam?.team_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (dispatch as any)(fetchWorkspacesThunk(targetTeam.team_id));
        }
        dispatch(setCommandStatus({ status: 'success', message: 'Folder created successfully' }));
        setTimeout(() => {
          dispatch(setCommandStatus({ status: 'idle', message: '' }));
        }, 3000);
        handleClose();
      } catch (error: any) {
        const serverErrorMessage = error.response?.data?.error || error?.message;
        setError(serverErrorMessage || 'Failed to create folder');
        // Do NOT close on error, keep modal open
      } finally {
        setIsLoading(false);
        // Only close if successful (no error set in catch)
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
      className="fixed inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-300 ease-in-out"
      style={{
        opacity: isVisible ? 1 : 0,
        zIndex: zIndex,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      onClick={e => {
        // Close only if clicking directly on the backdrop, not on children
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}>
      <motion.div
        ref={popupRef}
        animate={{
          width: 550,
          height: isEditingIcon ? 520 : 200,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-[#fdf6e3]/95 dark:bg-frostedwhite backdrop-blur-sm rounded-lg border border-[var(--color-borderDefault)] shadow-xl transform transition-all duration-0 ease-in-out overflow-hidden flex flex-col"
        onClick={e => {
          // Prevent clicks inside popup from bubbling to backdrop
          e.stopPropagation();
        }}
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
                    className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-popupBg)] rounded-full shadow border border-[var(--color-borderDefault)] flex items-center justify-center text-neutral-400 hover:text-blue-500 hover:border-blue-500 z-20"
                    title="Edit Folder">
                    <LuPencil size={10} />
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold tracking-wider flex items-center gap-1.5 ml-1">
                    <span className="opacity-100 font-semibold">Create Folder</span>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
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
                    if (error) setError(null); // Clear error on typing
                  }}
                  disabled={isEditingIcon}
                  className={`w-full text-xl font-bold text-neutral-800 dark:text-neutral-100 bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-700 ${isEditingIcon ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="Folder Name"
                  autoFocus={!isEditingIcon}
                />
              </div>
            </div>

            <div className="h-[1px] w-full bg-neutral-100 dark:bg-white/5" />

            {/* Visibility Selection Area with Descriptions */}
            {!isEditingIcon && !isPersonalSpace && defaultAccess !== 'private' && (
              <div className="px-5 py-3 pb-1 flex flex-col gap-2 shrink-0">
                <div className="flex gap-3">
                  <div
                    onClick={() => setAccess('public')}
                    className={`flex-1 flex flex-col p-2.5 border rounded-xl cursor-pointer ${
                      access === 'public'
                        ? 'bg-purple-50/50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 shadow-sm'
                        : 'bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] hover:border-neutral-200 dark:hover:border-neutral-700'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <FiGlobe
                        size={14}
                        className={access === 'public' ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-400'}
                      />
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${access === 'public' ? 'text-purple-800 dark:text-purple-300' : 'text-neutral-600'}`}>
                        Public
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-500 leading-tight">
                      Anyone in your organization can find and join.
                    </p>
                  </div>

                  <div
                    onClick={() => setAccess('shareonly')}
                    className={`flex-1 flex flex-col p-2.5 border rounded-xl cursor-pointer ${
                      access === 'shareonly'
                        ? 'bg-neutral-800 border-neutral-700 shadow-sm'
                        : 'bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] hover:border-neutral-200 dark:hover:border-neutral-700'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <FiLock size={14} className={access === 'shareonly' ? 'text-white' : 'text-neutral-400'} />
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${access === 'shareonly' ? 'text-white' : 'text-neutral-600'}`}>
                        Shared
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-500 leading-tight">
                      Only members of this space can access.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                className="flex items-center gap-2 rounded-xl border border-transparent bg-white/10 dark:bg-white/5 hover:bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 group">
                <span>{isEditingIcon ? 'Back' : 'Cancel'}</span>
                <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/20 px-1 rounded ml-1">
                  ESC
                </span>
              </button>
              <button
                onClick={isEditingIcon ? handleSaveIcon : handleSave}
                disabled={!isEditingIcon && (!name.trim() || isLoading)}
                className={`flex items-center gap-2 px-2 py-0.5 text-[10px] font-semibold rounded-md border shadow-sm ${
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

export default CreateWorkspacePopup;
