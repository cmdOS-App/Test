import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FiX, FiLoader } from 'react-icons/fi';
import useToast from '../Shared/Toast/useToast';
import { updateSharedFolder } from '../../../../Apis/features/folderApiServices';
import { useDispatch, useSelector } from 'react-redux';
import { setCommandStatus } from '../../../../Redux/AllData/uiStateSlice';
import { RootState } from '../../../../Redux/store';

interface EditFolderNamePopupProps {
  isOpen: boolean;
  onClose: () => void;
  reload: () => void;
  folderName: string;
  folderId: string;
  orgId: string;
  workspaceId: string;
}

const EditFolderNamePopup: React.FC<EditFolderNamePopupProps> = ({
  isOpen,
  onClose,
  reload,
  folderId,
  folderName,
  orgId,
  workspaceId,
}) => {
  const [name, setName] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();
  const selectedTeam = useSelector((state: RootState) => state.uiState.selectedTeam);

  const triggerToast = useToast();

  useEffect(() => {
    if (folderName) {
      setName(folderName);
    }
  }, [folderName]);

  // Animation timing
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setIsVisible(true);
        // Focus and set cursor to end of text
        if (inputRef.current) {
          inputRef.current.focus();
          // Set cursor to end of text
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Handle click outside to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLoading) return; // Prevent closing while loading
    if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  const handleClose = (): void => {
    if (isLoading) return; // Prevent closing while loading

    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setName('');
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation();

    if (e.key === 'Escape' && !isLoading) {
      handleClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && name.trim() && !isLoading) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      dispatch(setCommandStatus({ status: 'loading', message: 'Renaming folder...' }));
      await updateSharedFolder(folderId, name, orgId, workspaceId, selectedTeam?.storageMode ?? 'cloud');
      setName('');
      // triggerToast('Folder Name Updated Successfully!', 'success');

      dispatch(setCommandStatus({ status: 'success', message: 'Folder renamed successfully' }));
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);

      reload();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
    }
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center transition-opacity duration-300 ease-in-out"
      style={{ opacity: isVisible ? 1 : 0, zIndex: 1000000 }}
      onClick={handleOverlayClick}>
      <div
        ref={popupRef}
        className="bg-[#fdf6e3]/95 dark:bg-neutral-800 rounded-lg p-3 w-full max-w-md border border-[var(--color-borderDefault)] shadow-xl transform transition-all duration-300 ease-in-out"
        style={{
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
        }}
        onKeyDown={handleKeyDown}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[var(--color-textPrimary)]">Rename Folder</h2>
          <button
            onClick={e => {
              e.stopPropagation();
              handleClose();
            }}
            disabled={isLoading}
            className={`text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full p-1 transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
            <FiX size={20} />
          </button>
        </div>

        {/* Folder Name Input */}
        <div className="mb-6">
          <label htmlFor="folder-name" className="block text-sm font-bold text-neutral-800 dark:text-neutral-300 mb-2">
            Folder Name
          </label>
          <input
            ref={inputRef}
            id="folder-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => {
              // Set cursor to end when input gets focus
              const length = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(length, length);
            }}
            placeholder="My Awesome Folder"
            disabled={isLoading}
            className={`w-full p-3 border border-[var(--color-borderDefault)] rounded-lg bg-[var(--color-containerBg)] text-neutral-900 dark:text-white placeholder-[var(--color-textPlaceholder)] focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-white transition-all ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={e => {
              e.stopPropagation();
              handleClose();
            }}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isLoading
                ? 'bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                : 'bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 shadow-sm border border-neutral-300 dark:border-transparent'
            }`}>
            Cancel
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={!name.trim() || isLoading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
              name.trim() && !isLoading
                ? 'bg-[#eee8d5] dark:bg-white hover:bg-[#dfd9c6] dark:hover:bg-gray-50 text-neutral-800 dark:text-neutral-800 border border-[#93a1a1] dark:border-transparent'
                : 'bg-neutral-600 dark:bg-gray-200 text-white dark:text-neutral-800 opacity-50 cursor-not-allowed'
            }`}>
            {isLoading ? (
              <>
                <FiLoader className="animate-spin mr-2" size={16} />
                Updating...
              </>
            ) : (
              'Update'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditFolderNamePopup;
