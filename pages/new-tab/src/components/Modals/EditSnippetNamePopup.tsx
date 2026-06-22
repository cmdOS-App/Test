import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FiX, FiLoader } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { setCommandStatus } from '../../../../Redux/AllData/uiStateSlice';
import { updateSnippetRealtime } from '../../../../Apis/features/snippetApi';

interface EditSnippetNamePopupProps {
  isOpen: boolean;
  onClose: () => void;
  reload: () => void;
  snippetName: string;
  snippetId: string;
}

const EditSnippetNamePopup: React.FC<EditSnippetNamePopupProps> = ({
  isOpen,
  onClose,
  reload,
  snippetId,
  snippetName,
}) => {
  const [name, setName] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (snippetName) {
      setName(snippetName);
    }
  }, [snippetName]);

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
    if (e.key === 'Enter' && name.trim() && !isLoading) {
      handleSave();
    } else if (e.key === 'Escape' && !isLoading) {
      handleClose();
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      dispatch(setCommandStatus({ status: 'loading', message: 'Renaming file...' }));
      await updateSnippetRealtime({ snippet_id: snippetId, key: name });
      setName('');

      dispatch(setCommandStatus({ status: 'success', message: 'File renamed successfully' }));
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
        className="bg-[var(--color-containerBg)] rounded-lg p-3 w-full max-w-md border border-[var(--color-borderDefault)] shadow-xl transform transition-all duration-300 ease-in-out"
        style={{
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
        }}
        onKeyDown={handleKeyDown}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[var(--color-textPrimary)]">Rename File</h2>
          <button
            onClick={e => {
              e.stopPropagation();
              handleClose();
            }}
            disabled={isLoading}
            className={`text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full p-1 transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
            <FiX size={20} />
          </button>
        </div>

        {/* File Name Input */}
        <div className="mb-6">
          <label
            htmlFor="snippet-name"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            File Name
          </label>
          <input
            ref={inputRef}
            id="snippet-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => {
              // Set cursor to end when input gets focus
              const length = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(length, length);
            }}
            placeholder="My Awesome File"
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
            className={`px-4 py-2 font-semibold border border-[var(--color-borderDefault)] rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
            Cancel
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={!name.trim() || isLoading}
            className={`px-4 py-2 font-semibold rounded-lg text-white dark:text-neutral-800 transition-colors flex items-center justify-center ${
              name.trim() && !isLoading
                ? 'bg-neutral-700 dark:bg-white hover:bg-neutral-800 dark:hover:bg-gray-50'
                : 'bg-neutral-600 dark:bg-gray-200 opacity-50 cursor-not-allowed'
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

export default EditSnippetNamePopup;
