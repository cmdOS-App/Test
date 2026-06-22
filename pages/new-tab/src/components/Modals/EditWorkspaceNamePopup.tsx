import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiLoader } from 'react-icons/fi';
// import useToast from '../Shared/Toast/useToast';
import { editWorkspaceName } from '../../../../Apis/features/workspaceApiServices';
import { useDispatch } from 'react-redux';
import { setCommandStatus } from '../../../../Redux/AllData/uiStateSlice';

interface EditWorkspaceNamePopupProps {
  isOpen: boolean;
  onClose: () => void;
  reload: () => void;
  workspaceName: string;
  workspaceId: string;
  zIndex?: number;
  storageMode?: 'local' | 'cloud';
}

const EditWorkspaceNamePopup: React.FC<EditWorkspaceNamePopupProps> = ({
  isOpen,
  onClose,
  reload,
  workspaceId,
  workspaceName,
  zIndex = 50,
  storageMode,
}) => {
  const [name, setName] = useState<string>('');

  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();

  // const triggerToast = useToast();

  useEffect(() => {
    if (workspaceName) {
      setName(workspaceName);
    }
  }, [workspaceName]);

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
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      event.stopPropagation();
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

  const handleClose = (): void => {
    if (isLoading) return; // Prevent closing while loading

    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setName('');
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && name.trim() && !isLoading) {
    } else if (e.key === 'Escape' && !isLoading) {
      handleClose();
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      dispatch(setCommandStatus({ status: 'loading', message: 'Renaming channel...' }));
      await editWorkspaceName(workspaceId, name, storageMode ?? 'cloud');
      setName('');
      // triggerToast('Name Updated Successfully!', 'success');
      dispatch(setCommandStatus({ status: 'success', message: 'Channel renamed successfully' }));
      setTimeout(() => {
        dispatch(setCommandStatus({ status: 'idle', message: '' }));
      }, 3000);

      reload();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      // triggerToast(serverErrorMessage, 'error');
      dispatch(setCommandStatus({ status: 'error', message: serverErrorMessage }));
    }
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center transition-opacity duration-300 ease-in-out"
      style={{ opacity: isVisible ? 1 : 0, zIndex }}>
      <div
        ref={popupRef}
        className="bg-[#fdf6e3]/95 dark:bg-neutral-800 rounded-lg p-3 w-full max-w-md border border-[var(--color-borderDefault)] shadow-xl transform transition-all duration-300 ease-in-out"
        style={{
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          zIndex: zIndex + 1,
        }}
        onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[var(--color-textPrimary)]">Rename Channel</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className={`text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full p-1 transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
            <FiX size={20} />
          </button>
        </div>

        {/* Collection Name Input */}
        <div className="mb-6">
          <label
            htmlFor="collection-name"
            className="block text-sm font-bold text-neutral-800 dark:text-neutral-300 mb-2">
            Channel Name
          </label>
          <input
            ref={inputRef}
            id="collection-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => {
              // Set cursor to end when input gets focus
              const length = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(length, length);
            }}
            placeholder="My Awesome Collection"
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
            onClick={handleClose}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isLoading
                ? 'bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                : 'bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 shadow-sm border border-neutral-300 dark:border-transparent'
            }`}>
            Cancel
          </button>
          <button
            onClick={handleSave}
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
    </div>,
    document.body,
  );
};

export default EditWorkspaceNamePopup;
