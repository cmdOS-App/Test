import { CommandModule } from '../types';
import { FaGoogleDrive } from 'react-icons/fa';

export const UploadDriveCommand: CommandModule = {
  id: 'upload_drive',
  label: 'Upload Drive',
  prefix: '/upload_drive',
  keywords: ['upload', 'drive', 'google', 'files', 'cloud'],
  behavior: 'locked',
  icon: FaGoogleDrive,

  execute: async context => {
    const { files } = context;
    const { toast } = context.services;

    if (!files || files.length === 0) {
      toast('Please attach files first (Ctrl+U or paste)', 'error');
      return;
    }

    toast(`Starting upload flow for ${files.length} file(s)...`, 'info');

    try {
      // Use the unified auto-submit flow
      chrome.runtime.sendMessage(
        {
          action: 'open_tab_with_auto_submit',
          url: 'https://drive.google.com/drive/my-drive',
          autoSubmit: {
            kind: 'drive',
            images: files,
          },
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            toast(`Upload failed: ${chrome.runtime.lastError.message}`, 'error');
          } else if (response?.ok) {
            // No need for "triggered" toast usually as the page is about to navigate
          } else {
            toast(response?.error || 'Failed to start upload flow', 'error');
          }
        },
      );
    } catch (err) {
      console.error('[UploadDriveCommand] Error sending files:', err);
      toast('Failed to start upload flow', 'error');
    }
  },
};
