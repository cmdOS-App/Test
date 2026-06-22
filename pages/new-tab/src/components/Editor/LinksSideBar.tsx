import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSave, FaFolder, FaCheck, FaLayerGroup, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import type { NewSnippet } from '../../../../Apis/features/snippetApi';
import { createSnippet, updateSnippetRealtime } from '../../../../Apis/features/snippetApi';
import type { Folder, Workspace } from '../../../../modals/interfaces';
import useToast from '../Shared/Toast/useToast';

interface Tab {
  id: number;
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  active: boolean; // Detect the current active tab
}

interface LinkSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  reload: () => void;
  defaultFolder?: string | null;
  // New prop to receive the dropped link data
  droppedLink?: any | null;
  workspace: Workspace;
  isDarkMode?: boolean;
}

const LinkSidebar: React.FC<LinkSidebarProps> = ({
  isOpen,
  onClose,
  folders,
  reload,
  defaultFolder,
  droppedLink,
  workspace,
  isDarkMode,
}) => {
  const [tabsByWindow, setTabsByWindow] = useState<Record<number, Tab[]>>({});
  const [selectedTabs, setSelectedTabs] = useState<number[]>([]);
  const [showBottomPopup, setShowBottomPopup] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [key, setKey] = useState('');
  const [draggedTab, setDraggedTab] = useState<Tab | null>(null);
  const [dragOverTab, setDragOverTab] = useState<Tab | null>(null);
  const [collapsedWindows, setCollapsedWindows] = useState<Record<number, boolean>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);
  const folderSelectorRef = useRef<HTMLDivElement>(null);

  const bottomPopupRef = useRef<HTMLDivElement>(null);

  const triggerToast = useToast();

  const handelKeyChange = (val: string) => {
    const trailingMatch = val.match(/(\s*)$/);
    const trailingSpaces = trailingMatch ? trailingMatch[0] : '';
    const core = val.slice(0, val.length - trailingSpaces.length);
    const processedCore = core.replace(/ /g, '_');
    setKey(processedCore + trailingSpaces);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if click is inside folder selector modal
      const isClickInSidebar = sidebarRef.current?.contains(event.target as Node);
      const isClickInModal = folderSelectorRef.current?.contains(event.target as Node);
      const isClickInPopup = bottomPopupRef.current?.contains(event.target as Node);

      if (!isClickInSidebar && !isClickInModal && !isClickInPopup) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, showFolderSelector]);

  // Fetch all tabs from all windows and group them by windowId.
  useEffect(() => {
    if (isOpen) {
      chrome.tabs.query({}, fetchedTabs => {
        const allTabs = fetchedTabs as Tab[];
        const grouped = allTabs.reduce(
          (acc, tab) => {
            if (!acc[tab.windowId]) {
              acc[tab.windowId] = [];
            }
            acc[tab.windowId].push(tab);
            return acc;
          },
          {} as Record<number, Tab[]>,
        );
        setTabsByWindow(grouped);
      });
    }
  }, [isOpen]);

  // Flatten all tabs for saving
  const getAllTabs = (): Tab[] => Object.values(tabsByWindow).flat();

  const handleTabSelect = (tabId: number) => {
    setSelectedTabs(prev => {
      const newSelection = prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId];
      setShowBottomPopup(newSelection.length > 0);
      return newSelection;
    });
  };

  const handleSaveClick = () => {
    setShowBottomPopup(false);
    setShowFolderSelector(true);
  };
  const handleClose = () => {
    setSelectedTabs([]);
    setShowBottomPopup(false);
    setShowFolderSelector(false);
    onClose();
  };

  const handleCancelSelection = () => {
    setSelectedTabs([]);
    setShowBottomPopup(false);
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolder(folderId);
  };

  const handleSaveLinks = async () => {
    if (!key || (!selectedFolder && !workspace.workspace_id)) {
      triggerToast('Key and folder/workspace are required', 'error');
      return;
    }

    const allTabs = getAllTabs();
    const tabsToSave = allTabs.filter(tab => selectedTabs.includes(tab.id));

    setIsSaving(true);
    try {
      if (tabsToSave.length === 0) {
        triggerToast('Selected tabs are empty', 'error');
        return;
      }

      const category: 'link' = 'link';

      const newSnippet: NewSnippet = {
        key: key.trim(),
        value:
          tabsToSave.length > 1
            ? JSON.stringify({
                names: tabsToSave.map(tab => tab.title),
                urls: tabsToSave.map(tab => tab.url),
              })
            : tabsToSave[0].url,
        category,
        tags: [],
        ...(selectedFolder ? { folder_id: selectedFolder } : { workspace_id: workspace.workspace_id }), // support either
      };

      await createSnippet([newSnippet]);
      triggerToast('Link created successfully!', 'success');
      reload();
    } catch (error: any) {
      const serverErrorMessage = error?.response?.data?.error || error?.message || 'An error occurred';
      triggerToast(serverErrorMessage, 'error');
    } finally {
      setIsSaving(false);
      setKey('');
      setSelectedTabs([]);
      setShowBottomPopup(false);
      setShowFolderSelector(false);
      setSelectedFolder(null);
      onClose();
    }
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, tab: Tab) => {
    // Get all currently selected tabs
    const allTabs = getAllTabs();
    const tabsToSend = allTabs.filter(t => selectedTabs.includes(t.id));

    // If multiple tabs are selected, send all; otherwise send the single tab
    if (tabsToSend.length > 1) {
      e.dataTransfer.setData('application/json', JSON.stringify(tabsToSend));
    } else {
      e.dataTransfer.setData('application/json', JSON.stringify(tab));
    }

    setDraggedTab(tab);

    if (e.currentTarget.classList) {
      e.currentTarget.classList.add('opacity-50');
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedTab(null);
    setDragOverTab(null);
    if (e.currentTarget.classList) {
      e.currentTarget.classList.remove('opacity-50');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, tab: Tab) => {
    e.preventDefault();
    if (draggedTab && draggedTab.id !== tab.id) {
      setDragOverTab(tab);
    }
  };

  const handleDragLeave = () => {
    setDragOverTab(null);
  };

  // Move a tab within the same window group
  const moveTabWithinWindow = (windowId: number, fromIndex: number, toIndex: number) => {
    const group = tabsByWindow[windowId] || [];
    const newGroup = [...group];
    const [movedTab] = newGroup.splice(fromIndex, 1);
    newGroup.splice(toIndex, 0, movedTab);
    setTabsByWindow({
      ...tabsByWindow,
      [windowId]: newGroup,
    });
    chrome.tabs.move(movedTab.id, { index: toIndex }, () => {});
  };

  // Move a tab from one window group to another
  const moveTabToAnotherWindow = (fromWindowId: number, toWindowId: number, tab: Tab, toIndex: number) => {
    const fromGroup = tabsByWindow[fromWindowId] || [];
    const toGroup = tabsByWindow[toWindowId] ? [...tabsByWindow[toWindowId]] : [];
    const fromIndex = fromGroup.findIndex(t => t.id === tab.id);
    if (fromIndex === -1) return;
    const [movedTab] = fromGroup.splice(fromIndex, 1);
    const updatedTab = { ...movedTab, windowId: toWindowId };
    toGroup.splice(toIndex, 0, updatedTab);
    setTabsByWindow({
      ...tabsByWindow,
      [fromWindowId]: fromGroup,
      [toWindowId]: toGroup,
    });
    chrome.tabs.move(updatedTab.id, { windowId: toWindowId, index: toIndex }, () => {});
  };

  // Drop handler for dropping on a tab
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetTab: Tab) => {
    e.preventDefault();
    if (!draggedTab || draggedTab.id === targetTab.id) return;

    const fromWindowId = draggedTab.windowId;
    const toWindowId = targetTab.windowId;
    const fromGroup = tabsByWindow[fromWindowId] || [];
    const toGroup = tabsByWindow[toWindowId] || [];
    const fromIndex = fromGroup.findIndex(t => t.id === draggedTab.id);
    const toIndex = toGroup.findIndex(t => t.id === targetTab.id);
    if (fromIndex === -1 || toIndex === -1) return;

    if (fromWindowId === toWindowId) {
      moveTabWithinWindow(fromWindowId, fromIndex, toIndex);
    } else {
      moveTabToAnotherWindow(fromWindowId, toWindowId, draggedTab, toIndex);
    }

    setDraggedTab(null);
    setDragOverTab(null);
  };

  // New drop handler for the group drop zone.
  const handleDropOnGroup = (e: React.DragEvent<HTMLDivElement>, windowId: number) => {
    e.preventDefault();
    if (!draggedTab) return;
    const toGroup = tabsByWindow[windowId] || [];
    const toIndex = toGroup.length; // Drop at the end of the group
    const fromWindowId = draggedTab.windowId;
    const fromGroup = tabsByWindow[fromWindowId] || [];
    const fromIndex = fromGroup.findIndex(t => t.id === draggedTab.id);
    if (fromIndex === -1) return;
    if (fromWindowId === windowId) {
      moveTabWithinWindow(windowId, fromIndex, toIndex);
    } else {
      moveTabToAnotherWindow(fromWindowId, windowId, draggedTab, toIndex);
    }
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const toggleCollapse = (windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  };

  useEffect(() => {
    if (defaultFolder) {
      setSelectedFolder(defaultFolder);
      // Check if droppedLink is present
      if (droppedLink) {
        // If droppedLink is an array (multiple links) add all their ids
        if (Array.isArray(droppedLink)) {
          setSelectedTabs(prev => {
            const newIds = droppedLink.map((link: Tab) => link.id);
            return Array.from(new Set([...prev, ...newIds]));
          });
        } else if (droppedLink.id) {
          // Otherwise, handle single link
          setSelectedTabs(prev => {
            if (!prev.includes(droppedLink.id)) {
              return [...prev, droppedLink.id];
            }
            return prev;
          });
        }
      }
      // Open the folder selector popup to let the user confirm saving
      setShowFolderSelector(true);
    }
  }, [defaultFolder, droppedLink]);

  if (!isOpen) return null;

  // Sort windows so they display as "Window 1", "Window 2", etc.
  const sortedWindowEntries = Object.entries(tabsByWindow).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <>
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="fixed inset-y-0 right-0 w-80 shadow-lg transform transition-transform duration-300 z-50 flex flex-col bg-neutral-800 text-white">
        {/* Header */}
        <div
          className="p-4 border-b flex justify-between items-center border-neutral-700">
          <h2 className="font-semibold text-lg text-white">Add Links</h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-200">
            <FaTimes size={18} />
          </button>
        </div>

        {/* Tabs List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="p-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Select tabs to bookmark your links:</p>
            <div className="space-y-2">
              {sortedWindowEntries.map(([windowIdStr, tabs], index) => {
                const windowId = Number(windowIdStr);
                const collapsed = collapsedWindows[windowId];
                return (
                  <div key={windowId}>
                    <div
                      className="flex items-center p-2 font-bold cursor-pointer text-neutral-200"
                      onClick={() => toggleCollapse(windowId)}>
                      {collapsed ? (
                        <FaChevronRight className="mr-2" size={14} />
                      ) : (
                        <FaChevronDown className="mr-2" size={14} />
                      )}
                      <span>Window {index + 1}</span>
                    </div>
                    {!collapsed && (
                      <>
                        {tabs.map(tab => (
                          <div
                            key={tab.id}
                            onClick={() => handleTabSelect(tab.id)}
                            draggable={!tab.active}
                            onDragStart={!tab.active ? e => handleDragStart(e, tab) : undefined}
                            onDragEnd={!tab.active ? handleDragEnd : undefined}
                            onDragOver={!tab.active ? e => handleDragOver(e, tab) : undefined}
                            onDragLeave={!tab.active ? handleDragLeave : undefined}
                            className={`flex items-center p-2 rounded-md cursor-pointer transition-colors
                              ${
                                selectedTabs.includes(tab.id)
                                  ? 'bg-neutral-600 border border-neutral-900'
                                  : 'hover:bg-neutral-700'
                              }
                              ${dragOverTab && dragOverTab.id === tab.id ? 'border-2 border-neutral-400' : ''}
                            `}>
                            <div className="flex-shrink-0 mr-3">
                              {tab.favIconUrl ? (
                                <img src={tab.favIconUrl} alt="" className="w-5 h-5" />
                              ) : (
                                <div className="w-5 h-5 bg-[var(--color-containerBg)] rounded-full" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate text-neutral-200">
                                {tab.title}
                              </p>
                              <p className="text-xs truncate text-neutral-400">
                                {getHostname(tab.url)}
                              </p>
                            </div>
                            {selectedTabs.includes(tab.id) && (
                              <div className="ml-2 text-neutral-500 dark:text-neutral-100">
                                <FaCheck size={14} />
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Drop zone for the window group */}
                        <div
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => handleDropOnGroup(e, windowId)}
                          onDragLeave={handleDragLeave}
                          className="h-4"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Popup */}
      {showBottomPopup && (
        <div
          ref={bottomPopupRef}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 shadow-lg rounded-lg flex items-center p-3 z-[60] bg-neutral-800"
          onClick={e => e.stopPropagation()}>
          <span className="mr-4 text-sm font-medium text-neutral-200">
            {selectedTabs.length} item{selectedTabs.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={e => {
              // Prevent any default behavior
              e.preventDefault();
              // Stop event from propagating up
              e.stopPropagation();
              // Directly set the states instead of calling the function
              setShowBottomPopup(false);
              setShowFolderSelector(true);
            }}
            className="mr-2 px-3 py-1 text-white bg-neutral-700 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-800 rounded-md text-sm flex items-center">
            <FaSave className="mr-1" size={12} />
            Save
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              handleCancelSelection();
            }}
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            <FaTimes size={16} />
          </button>
        </div>
      )}

      {/* Folder Selector Modal */}
      {showFolderSelector && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm">
          <div
            ref={folderSelectorRef}
            className="rounded-lg shadow-2xl w-96 max-w-full transform transition-all animate-fadeIn bg-neutral-800 text-white">
            <div className="p-4 border-b border-[var(--color-borderDefault)]">
              <h3 className="font-semibold text-lg text-[var(--color-textPrimary)]">Save Links</h3>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={key}
                onChange={e => handelKeyChange(e.target.value)}
                placeholder="Enter Key..."
                className="w-full px-2 py-1 mb-3 text-sm rounded border shadow-sm focus:outline-none bg-neutral-700 text-white border-neutral-600"
              />
              <div>
                <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Select Workspace:</h4>
                <div
                  key={workspace.workspace_id}
                  onClick={() => handleFolderSelect(null)}
                  className={`
                     flex items-center p-3 rounded-md cursor-pointer transition-colors
                     ${
                       !selectedFolder
                         ? 'bg-neutral-600 border border-neutral-900'
                         : 'hover:bg-neutral-700'
                     }
                   `}>
                  <FaLayerGroup className="mr-3 text-[var(--color-iconDefault)]" size={16} />
                  <span className="text-neutral-200">{workspace.workspace_name}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Select Collection:</h4>
                <div className="max-h-48 overflow-y-auto hide-scrollbar mb-4 space-y-2">
                  {folders.length === 0 && (
                    <div className="text-neutral-500 dark:text-neutral-400 text-sm">No folders available</div>
                  )}
                  {folders.map(folder => (
                    <div
                      key={folder.folder_id}
                      onClick={() => handleFolderSelect(folder.folder_id)}
                      className={`
                       flex items-center p-3 rounded-md cursor-pointer transition-colors
                       ${
                         selectedFolder === folder.folder_id
                            ? 'bg-neutral-600 border border-neutral-900'
                            : 'hover:bg-neutral-700'
                      }
                     `}>
                      <FaFolder className="mr-3 text-[var(--color-iconDefault)]" size={16} />
                      <span className="text-neutral-200">{folder.folder_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end border-neutral-700">
              <button
                onClick={() => {
                  setShowFolderSelector(false);
                  setShowBottomPopup(true);
                }}
                className="mr-2 px-4 py-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-700">
                Cancel
              </button>
              <button
                onClick={handleSaveLinks}
                disabled={isSaving || !key}
                className={`
                   px-4 py-2 rounded-md text-white flex items-center transition-all
                   ${
                     !isSaving && key
                       ? 'bg-white text-neutral-900 hover:bg-neutral-200'
                       : 'bg-neutral-600 text-neutral-400 cursor-not-allowed'
                   }
                 `}>
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <FaSave className="mr-1" size={14} />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LinkSidebar;
