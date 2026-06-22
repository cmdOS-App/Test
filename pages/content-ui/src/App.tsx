import { useEffect, useState, useCallback } from 'react';
import AutomationStatusOverlay from '@src/components/AutomationStatusOverlay';
import { GlobalCreateMenuModal } from '../../new-tab/src/components/Shared/GlobalCreateMenuModal';

export default function App() {
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Check system preference for dark mode initially
    const matchMedia = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(matchMedia.matches);
    const mediaListener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    matchMedia.addEventListener('change', mediaListener);

    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'tasklabs:open-create-menu') {
        setIsCreateMenuOpen(true);
        if (sendResponse) sendResponse({ success: true });
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      matchMedia.removeEventListener('change', mediaListener);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const handleCommandSelect = useCallback((commandId: string) => {
    // Send message to background script to execute the action
    chrome.runtime.sendMessage({
      type: 'tasklabs:execute-create-action',
      action: commandId,
    });
  }, []);

  return (
    <>
      <AutomationStatusOverlay />
      <GlobalCreateMenuModal
        isOpen={isCreateMenuOpen}
        onClose={() => setIsCreateMenuOpen(false)}
        onCommandSelect={handleCommandSelect}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
