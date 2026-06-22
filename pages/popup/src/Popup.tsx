import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { useEffect, useState, useRef } from 'react';
import LoginGuide from './LoginGuide';
import UserProfile from './UserProfile';
import { FaSave, FaFolder, FaTimes, FaChevronRight, FaSync, FaChevronDown, FaKeyboard } from 'react-icons/fa';
import { GoAlert } from 'react-icons/go';
import { BsPeopleFill, BsLink45Deg, BsPinAngleFill, BsPinAngle } from 'react-icons/bs';
import UnpinConfirmationDialog from './UnpinConfirmationDialog';
import { IoDocumentsOutline } from 'react-icons/io5';
import type { Team, Folder, WorkspaceDetails } from '../types/popupType';
import { axiosInstance } from '../../Apis/core/axiosInstance';
import { StorageManager } from '../../Apis/storage/StorageManager';
import { CMDOS_REDIRECT_URL, CMDOS_DOCS_URL, CMDOS_SIGN_IN_URL } from '../../Apis/core/apiConfig';

const getOS = () => {
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac';
  }
  return 'win';
};

const Popup = () => {
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';
  const logo = 'popup/tasklabs_logo.png';
  const gotoWebsite = () => chrome.tabs.create({ url: CMDOS_REDIRECT_URL });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userProfileImg, setUserProfileImg] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Team[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Team | null>(null);
  const [channels, setChannels] = useState<WorkspaceDetails[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<WorkspaceDetails | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<{ title: string; url: string } | null>(null);

  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [saveDirectlyToChannel, setSaveDirectlyToChannel] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add debug log state
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const debugLogRef = useRef<HTMLDivElement>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isNewTabEnabled, setIsNewTabEnabled] = useState(false);
  const [showUnpinDialog, setShowUnpinDialog] = useState(false);

  // Check initial state of new tab override
  useEffect(() => {
    // Check initial state of new tab override
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['new_tab_override_enabled'], (result: any) => {
        if (result.new_tab_override_enabled === undefined) {
          // If not set, default to true
          chromeAny.storage.local.set({ new_tab_override_enabled: true });
          setIsNewTabEnabled(true);
        } else {
          setIsNewTabEnabled(result.new_tab_override_enabled === true);
        }
      });
    }

    // Check for unsupported tab
    // Logic reverted as per user request
  }, []);

  const togglePin = () => {
    // If currently pinned and trying to unpin, show confirmation dialog
    if (isNewTabEnabled) {
      setShowUnpinDialog(true);
    } else {
      // Pinning doesn't need confirmation
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ new_tab_override_enabled: true });
        setIsNewTabEnabled(true);
      }
    }
  };

  const handleConfirmUnpin = () => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_override_enabled: false });
      setIsNewTabEnabled(false);
    }
  };

  const handleSelect = (org: Team) => {
    setSelectedOrg(org);
    setDropdownOpen(false);
    setShowOrgSelector(false);
    setShowChannelSelector(true);
    setSelectedChannel(null);
    setSelectedFolder(null);
    setSaveDirectlyToChannel(false);
  };

  const handleSignOut = async () => {
    const keysToRemove = [
      'accessToken',
      'myCachedAllData',
      'user_info',
      'last_org_counter_check_timestamp',
      'last_org_counter_check_result',
      'last_user_info_fetch_timestamp',
      'last_cloud_fetch_timestamp',
      'last_todo_fetch_timestamp',
      'last_sub_fetch_timestamp',
    ];
    await chrome.storage.local.remove(keysToRemove);
    window.location.reload();
  };

  // Custom debug logger that saves to state
  const debugLog = (message: string, data?: any) => {
    const timestamp = new Date().toISOString().substr(11, 8);
    const logMessage = data ? `${timestamp} ${message}: ${JSON.stringify(data, null, 2)}` : `${timestamp} ${message}`;
    setDebugLogs(prev => {
      const newLogs = [...prev, logMessage];
      // Keep last 50 logs only
      return newLogs.slice(Math.max(0, newLogs.length - 50));
    });

    // Scroll to bottom of logs
    setTimeout(() => {
      if (debugLogRef.current) {
        debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
      }
    }, 100);
  };

  // Setup axios interceptors with our debug logger
  useEffect(() => {
    // Log all requests and responses
    const requestInterceptor = axiosInstance.interceptors.request.use(
      config => {
        const url = config.url || '';
        const method = config.method?.toUpperCase() || 'GET';
        const headers = config.headers || {};

        try {
          debugLog(`API Request: ${method} ${url}`, {
            url: config.baseURL ? `${config.baseURL}${url}` : url,
            method,
            headers,
            data: config.data,
          });
        } catch (e) {
          console.error('Error in request interceptor:', e);
        }

        return config;
      },
      error => {
        try {
          debugLog('API Request Error', error);
        } catch (e) {
          console.error('Error in request error interceptor:', e);
        }
        return Promise.reject(error);
      },
    );

    const responseInterceptor = axiosInstance.interceptors.response.use(
      response => {
        try {
          const { config, status, statusText, data } = response;
          const url = config.url || '';
          const method = config.method?.toUpperCase() || 'GET';

          debugLog(`API Response: ${method} ${url} [${status}]`, {
            url: config.baseURL ? `${config.baseURL}${url}` : url,
            method,
            status,
            statusText,
            data,
          });
        } catch (e) {
          console.error('Error in response interceptor:', e);
        }

        return response;
      },
      error => {
        try {
          if (error.response) {
            const { config, status, statusText, data } = error.response;
            const url = config.url || '';
            const method = config.method?.toUpperCase() || 'GET';

            debugLog(`API Response Error: ${method} ${url} [${status}]`, {
              url: config.baseURL ? `${config.baseURL}${url}` : url,
              method,
              status,
              statusText,
              data,
            });
          } else {
            debugLog('API Response Error (No Response)', error);
          }
        } catch (e) {
          console.error('Error in response error interceptor:', e);
        }

        return Promise.reject(error);
      },
    );

    // Clean up interceptors when component unmounts
    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
      axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, []); // Only set up once

  // Replace first debugging calls
  useEffect(() => {
    debugLog('Popup initialized');
    debugLog('Current theme', theme);

    // Initial check
    chrome.storage.local.get(null, allStorage => {
      debugLog('All storage content', allStorage);
      // Try to set email from initial storage dump if available
      if (allStorage.user_email || allStorage.email) {
        setUserEmail(allStorage.user_email || allStorage.email);
      }
    });
  }, [theme]);

  // API functions directly in the component
  const getUserId = async (): Promise<string> => {
    try {
      debugLog('Getting userId from storage...');
      const result = await chrome.storage.local.get('accessToken');
      debugLog('Storage full result', result);

      // Debug: Log exact token structure and format
      const userIdResult = result.accessToken;
      debugLog('Raw accessToken', userIdResult);
      debugLog('Token type', typeof userIdResult);

      if (!userIdResult) {
        const error = 'No access token found in storage';
        debugLog('Error', error);
        throw new Error(error);
      }

      if (typeof userIdResult !== 'string') {
        debugLog('Token is not a string', userIdResult);
        throw new Error('Access token is not in the expected string format');
      }

      if (!userIdResult.startsWith('user_')) {
        debugLog('Token does not start with "user_"', userIdResult);
        throw new Error('Please login to use the extension');
      }

      return userIdResult;
    } catch (error) {
      debugLog('Error getting userId', error);
      throw error;
    }
  };

  const fetchTeams = async () => {
    try {
      const userIdValue = await getUserId();
      debugLog('Fetching teams with StorageManager');
      const { fetchTeams: apiFetchTeams } = await import('../../Apis/core/api');
      const response = await apiFetchTeams();
      return response;
    } catch (error) {
      debugLog('Error fetching teams', error);
      throw error;
    }
  };

  const fetchWorkspaces = async (team_id: string) => {
    try {
      debugLog('Fetching workspaces with StorageManager', { org_id: team_id });
      const { fetchWorkspaces: apiFetchWorkspaces } = await import('../../Apis/core/api');
      const response = await apiFetchWorkspaces(team_id);
      
      if (response && Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.workspaces)) {
        return response.workspaces;
      } else {
        return [];
      }
    } catch (error) {
      debugLog('Error fetching workspaces', error);
      throw error;
    }
  };

  const fetchFolders = async (org_id: string | null, workspace_id: string | null) => {
    try {
      debugLog('Fetching folders with StorageManager', { org_id, workspace_id });
      const { fetchFolders: apiFetchFolders } = await import('../../Apis/core/api');
      const response = await apiFetchFolders(org_id, workspace_id);
      
      if (response && Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.folders)) {
        return response.folders;
      } else {
        return [];
      }
    } catch (error) {
      debugLog('Error fetching folders', error);
      throw error;
    }
  };

  const updateSnippetRealtime = async (data: any, storageMode?: 'local' | 'cloud') => {
    try {
      debugLog('Updating snippet with StorageManager', { data });
      const { updateSnippetRealtime: centralUpdate } = await import('../../Apis/features/snippetApi');
      const response = await centralUpdate(data, storageMode);
      return response;
    } catch (error) {
      debugLog('Error updating snippet', error);
      throw error;
    }
  };

  // Function to process key (replace spaces with underscores)
  const processKey = (key: string) => {
    const trailingMatch = key.match(/(\s*)$/);
    const trailingSpaces = trailingMatch ? trailingMatch[0] : '';
    const core = key.slice(0, key.length - trailingSpaces.length);
    return core.replace(/ /g, '_') + trailingSpaces;
  };

  // Check for trigger_error_popup flag from background script
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['trigger_error_popup'], (result: any) => {
        if (result.trigger_error_popup) {
          setShowErrorPopup(true);
          // Clear the flag so it doesn't persist
          chromeAny.storage.local.remove('trigger_error_popup');
        }
      });
    }
  }, []);

  // Show heavily compacted Error/Alert Popup
  // Show heavily compacted Error/Alert Popup matching exact image format (vertical stack)

  // Manually fetch organizations
  const fetchOrganizationsHandler = async () => {
    if (!isLoggedIn || !userId) {
      debugLog('Not logged in or missing userId', { isLoggedIn, userId });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      debugLog('Fetching organizations with userId', userId);

      // Debug: Verify the userId directly from storage again
      try {
        const directUserId = await getUserId();
        debugLog('Direct userId check', directUserId);
        if (directUserId !== userId) {
          debugLog('UserId mismatch!', { stateUserId: userId, storageUserId: directUserId });
          // Update the userId if different
          setUserId(directUserId);
        }
      } catch (error) {
        debugLog('Failed to double-check userId', error);
      }

      // Debug: Log the exact API call we're making
      debugLog(
        'Calling API endpoint',
        `${axiosInstance.defaults.baseURL}/sharable_content/organizations?userId=${userId}`,
      );

      const response = await fetchTeams();
      debugLog('Raw organizations API response', response);

      // Check if response has organizations property and it's an array
      const orgsData = response?.organizations || [];

      if (Array.isArray(orgsData) && orgsData.length > 0) {
        debugLog(
          'Found organizations',
          orgsData.map(org => org.team_name),
        );
        setOrganizations(orgsData);
        // Auto-select first org if available
        setSelectedOrg(orgsData[0]);
        setShowOrgSelector(true);
      } else {
        debugLog('No organizations in response or empty array', response);
        setError('No organizations found. Please create an organization in the main app first.');
      }
    } catch (error) {
      debugLog('Error fetching organizations', error);
      // Debug: Show more details about the error
      if ((error as any).response) {
        debugLog('API error response', {
          status: (error as any).response.status,
          data: (error as any).response.data,
        });
      }
      setError('Failed to load organizations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user info from Supabase
  const fetchUserInfo = async (id: string) => {
    try {
      debugLog('Fetching user info for avatar', id);
      const response = await axiosInstance.get(`/user_data/user_info?user_id=${id}`);
      debugLog('User info response', response.data);
      return response.data;
    } catch (e) {
      debugLog('Failed to fetch user info', e);
      return null;
    }
  };

  // Fetch organizations
  useEffect(() => {
    if (isLoggedIn && userId && showSavePanel) {
      fetchOrganizationsHandler();
    }
  }, [isLoggedIn, userId, showSavePanel]);

  // Fetch channels and folders when organization is selected
  useEffect(() => {
    if (selectedOrg) {
      const loadChannelsAndFolders = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const orgId = selectedOrg.org_id;

          debugLog('Fetching channels for org', {
            org_id: orgId,
            org_name: selectedOrg.team_name,
          });

          // Fetching all the channels
          const channelsData = await fetchWorkspaces(orgId);
          if (!Array.isArray(channelsData) || channelsData.length === 0) {
            setError('No channels found in this organization.');
            return;
          }
          setChannels(channelsData);
          debugLog(
            'Channels loaded successfully',
            channelsData.map(c => c.workspace_name),
          );

          // Fetching all the folders
          const foldersPromises = channelsData.map(channel =>
            fetchFolders(orgId, channel.workspace_id).catch(error => {
              debugLog(`Error fetching folders for ${channel.workspace_name}`, error);
              return []; // fallback to empty array if error
            }),
          );
          const foldersResults = await Promise.all(foldersPromises); // Wait for all
          const allFolders = foldersResults.flat(); // Flatten the array of arrays
          setFolders(allFolders);
          debugLog('All folders loaded', allFolders.length);

          // Reset selections
          setSelectedChannel(null);
          setSelectedFolder(null);
        } catch (error) {
          debugLog('Error fetching channels or folders', error);
          setError('Failed to load channels and folders. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

      loadChannelsAndFolders();
    }
  }, [selectedOrg]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Debug: Check localStorage directly first
        debugLog('Directly checking chrome.storage.local...');
        chrome.storage.local.get(null, allStorage => {
          debugLog('All storage content', allStorage);
        });

        // First check auth via background script
        debugLog('Sending check_auth message to background script...');
        chrome.runtime.sendMessage({ action: 'check_auth' }, async response => {
          debugLog('Auth check response from background', response);

          // Helper to fetch email and name after auth success
          const ensureUserEmail = (uid: string) => {
            chrome.storage.local.get(['user_email', 'email', 'profileImg', 'user_name'], res => {
              const cachedEmail = res.user_email || res.email;
              const cachedImage = res.profileImg;
              const cachedName = res.user_name;

              if (cachedImage) {
                setUserProfileImg(cachedImage);
              }

              if (cachedName) {
                setUserName(cachedName);
              }

              if (cachedEmail) {
                setUserEmail(cachedEmail);
              }

              // If any info is missing, fetch from API to ensure fresh data
              if (!cachedEmail || !cachedName || !cachedImage) {
                fetchUserInfo(uid).then(data => {
                  if (data && data.user) {
                    const user = data.user;

                    const email = user.email;
                    const fullName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null;
                    const profileImg = user.profile_image_url;

                    if (email) {
                      setUserEmail(email);
                      chrome.storage.local.set({ user_email: email });
                    }

                    if (fullName) {
                      setUserName(fullName);
                      chrome.storage.local.set({ user_name: fullName });
                    }

                    if (profileImg) {
                      setUserProfileImg(profileImg);
                      chrome.storage.local.set({ profileImg: profileImg });
                    }
                  }
                });
              }
            });
          };

          if (response && response.isLoggedIn && response.userId) {
            debugLog('User is logged in via background check', response.userId);
            setUserId(response.userId);
            setIsLoggedIn(true);
            ensureUserEmail(response.userId);
          } else {
            // Fallback to direct storage check
            debugLog('Fallback to direct storage check...');
            try {
              const retrievedUserId = await getUserId();
              debugLog('Retrieved User ID from direct check', retrievedUserId);
              setUserId(retrievedUserId);
              setIsLoggedIn(true);
              ensureUserEmail(retrievedUserId);
            } catch (error) {
              debugLog('Direct auth check failed', error);
              setIsLoggedIn(false);
              // Debug: Let's try to manually check storage again after failure
              chrome.storage.local.get('accessToken', result => {
                debugLog('Manual accessToken check after failure', result);
              });
            }
          }
        });
      } catch (error) {
        debugLog('Authentication Error', error);
        setIsLoggedIn(false);
      }
    };

    checkAuth();
  }, []);

  const handleSaveLink = async () => {
    // Validate required fields based on save location
    if (saveDirectlyToChannel) {
      if (!selectedChannel) return;
    } else {
      if (!selectedFolder) return;
    }

    if (!currentTab) return;

    setIsSaving(true);
    setError(null);
    try {
      const key = processKey(currentTab.title);

      // Prepare request data
      const requestData: any = {
        key: key,
        value: currentTab.url,
        category: 'link',
        tags: [],
      };

      // Set the destination - either folder or workspace
      if (saveDirectlyToChannel && selectedChannel) {
        requestData.workspace_id = selectedChannel.workspace_id;
      } else if (selectedFolder) {
        requestData.folder_id = selectedFolder;
      } else {
        throw new Error('No valid destination selected');
      }
      // Use updateSnippetRealtime API instead
      await updateSnippetRealtime(requestData, (selectedOrg as any)?.storageMode === 'local' ? 'local' : 'cloud');
      setSaveSuccess(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
        resetSelections();
      }, 2000);
    } catch (error) {
      console.error('Error saving link:', error);
      setError('Failed to save link. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetSelections = () => {
    setShowSavePanel(false);
    setShowOrgSelector(false);
    setShowChannelSelector(false);
    setShowFolderSelector(false);
    setSaveDirectlyToChannel(false);
  };

  const startSaveProcess = () => {
    setShowSavePanel(true);
    setError(null);
    // Manually fetch organizations when starting the save process
    fetchOrganizationsHandler();
  };

  // Render the debug panel toggle button and panel
  const renderDebugPanel = () => (
    <div className="fixed bottom-2 right-2 z-50">
      {/* <button
        onClick={() => setShowDebugPanel(!showDebugPanel)}
        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full">
        🐞
      </button> */}

      {showDebugPanel && (
        <div className="fixed inset-0 bg-white dark:bg-gray-800 z-50 p-3 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Debug Logs</h3>
            <button
              onClick={() => setShowDebugPanel(false)}
              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded">
              Close
            </button>
          </div>

          <div
            ref={debugLogRef}
            className="flex-1 bg-black text-green-400 p-2 overflow-auto font-mono text-xs whitespace-pre">
            {debugLogs.join('\n')}
          </div>

          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={() => setDebugLogs([])}
              className="bg-red-500 hover:bg-red-600 text-white p-1 px-2 rounded text-sm">
              Clear Logs
            </button>
            <button
              onClick={fetchOrganizationsHandler}
              className="bg-blue-500 hover:bg-blue-600 text-white p-1 px-2 rounded text-sm">
              Fetch Orgs
            </button>
            <button
              onClick={() => {
                chrome.storage.local.get(null, result => {
                  debugLog('Storage contents', result);
                });
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white p-1 px-2 rounded text-sm">
              Check Storage
            </button>
            <button
              onClick={() => {
                const logsText = debugLogs.join('\n');
                navigator.clipboard
                  .writeText(logsText)
                  .then(() => {
                    alert('Logs copied to clipboard!');
                  })
                  .catch(err => {
                    alert('Failed to copy logs: ' + err);
                    console.error('Copy failed:', err);
                  });
              }}
              className="bg-green-500 hover:bg-green-600 text-white p-1 px-2 rounded text-sm">
              Copy Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Show heavily compacted Error/Alert Popup matching exact image format (vertical stack)
  // Moved to end of render to avoid React Hook errors (Rendered fewer hooks than expected)
  if (showErrorPopup) {
    return (
      <div
        className={`App ${!isLight ? 'dark' : ''} bg-white dark:bg-neutral-900 h-full flex flex-col p-4`}
        style={{ width: '300px', height: '300px' }}>
        {/* Header for Close */}
        {/* <div className="w-full flex justify-end mb-2">
              <button 
                onClick={() => window.close()}
                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
                <FaTimes size={16} />
              </button>
           </div> */}

        {/* Alert Card */}
        <div className="w-[96%] bg-[#FFF9F0] border-[3px] border-orange-300  mt-2 rounded-lg h-[60px] mb-4 flex items-center justify-center gap-2 relative overflow-hidden mx-auto">
          {/* Shine effect - Diagonal white block on right */}
          <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-white via-white/80 transform skew-x-[-20deg] translate-x-8 b-[1px] border-[#ffd2b480]"></div>

          <div className="flex items-center gap-2 z-10">
            <span className="text-orange-400 text-lg">
              <GoAlert size={20} color="yellow-800" />
            </span>
            <span className="text-yellow-800  font-medium text-sm">Alert</span>
          </div>
        </div>

        {/* Warning Text */}
        <div className="space-y-2 px-1 font-medium">
          <p className="text-gray-600  ">
            The Alt+S feature is supported only on <br /> standard websites that start with{' '}
            <span className="text-green-700 dark:text-green-400 font-semibold">WWW </span>(e.g., www.example.com).
            <br />
            <span className="text-[#dc2626a8] px-1">
              {' '}
              It does not run on the <del>Extension Store</del> or on <del>blank tab pages</del>.
            </span>
          </p>
        </div>

        {/* Actions - Vertical Stack (Matching Image) */}
        <div className="flex flex-col gap-3 w-[65%] mt-4 mx-auto">
          <button
            onClick={() => chrome.tabs.create({ url: CMDOS_DOCS_URL })}
            className="w-full py-2 bg-white-600  border border-black-400  rounded-lg text-black text-xs font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 hover:text-white transition-colors shadow-sm">
            Learn More
          </button>

          <button
            onClick={() => chrome.tabs.create({ url: CMDOS_DOCS_URL })}
            className="w-full py-2 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-md">
            Tutorial
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginGuide websiteUrl={CMDOS_SIGN_IN_URL} />
        {renderDebugPanel()}
      </>
    );
  }

  return (
    <div
      className={`App ${!isLight ? 'dark' : ''} rounded-xl overflow-hidden`}
      id="app-container dropdown-card"
      style={{ width: !showSavePanel ? '600px' : 'auto' }}>
      <div className="flex justify-between items-center w-full px-4 mb-3 pt-3">
        <div className="flex items-center gap-3">
          <button onClick={gotoWebsite} className="outline-none">
            <img src={chrome.runtime.getURL(logo)} className="w-8 h-8 object-contain" alt="logo" />
          </button>
          <h1 className="text-lg font-medium text-neutral-600 ">cmdOS</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Pin Icon */}
          <button
            onClick={togglePin}
            className="text-indigo-500 hover:text-indigo-600 transition-colors p-1"
            title={isNewTabEnabled ? 'Unpin Extension' : 'Pin Extension'}>
            {isNewTabEnabled ? <BsPinAngleFill size={18} /> : <BsPinAngle size={18} />}
          </button>

          {/* Avatar Group with Overlapping Badge */}
          <UserProfile
            user={{
              name: userName || userEmail?.split('@')[0] || 'User',
              email: userEmail,
              avatar_url: userProfileImg,
            }}
            onSignOut={handleSignOut}
          />

          <button
            onClick={() => window.close()}
            className="ml-1 text-neutral-800 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200">
            <FaTimes size={18} />
          </button>
        </div>
      </div>

      {/* Header Divider */}
      <div className="w-full h-[1px] bg-neutral-500 mb-4"></div>

      {!showSavePanel ? (
        <div className="flex flex-col items-center w-full px-4">
          <h2 className="text-sm text-neutral-600 mb-6">To get started:</h2>

          <div className="flex items-center justify-center gap-8 mb-6 w-full">
            {getOS() === 'win' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <kbd className="bg-black text-white px-3 py-2 rounded-md font-md min-w-[3rem] text-center">ALT</kbd>
                  <span className="text-lg text-black font-bold">+</span>
                  <kbd className="bg-white text-black border border-neutral-200 px-3 py-2 rounded-md font-bold text-xl min-w-[3rem] text-center shadow-sm">
                    S
                  </kbd>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <kbd className="bg-black text-white px-3 py-2 rounded-md font-bold text-lg min-w-[3rem] text-center flex items-center justify-center">
                    ⌥
                  </kbd>
                  <span className="text-lg text-black font-bold">+</span>
                  <kbd className="bg-white text-black border border-neutral-200 px-3 py-2 rounded-md font-bold text-xl min-w-[3rem] text-center shadow-sm">
                    S
                  </kbd>
                </div>
              </div>
            )}
          </div>

          <div className="relative w-[50%] overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 text-center shadow-lg mb-4">
            <div className="flex justify-between items-start mb-1">
              {/* Decorative background blur removed for simplicity or added if needed */}
            </div>
            <h3 className="text-lg font-semibold mb-1 relative z-10">Want a quick demo?</h3>
            <p className="text-purple-100 text-sm mb-4 relative z-10">Learn the flow in under a minute.</p>

            <button
              onClick={() => window.open(CMDOS_DOCS_URL)}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-6 py-2 rounded-lg text-sm font-medium backdrop-blur-sm transition-colors relative z-10 flex items-center justify-center mx-auto gap-2">
              🚀 Watch Tutorial
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-medium text-xl">Save Link</h3>
            <button
              onClick={resetSelections}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
              <FaTimes size={18} />
            </button>
          </div>

          {/* Display current tab info */}
          {currentTab && (
            <div className="mb-5 p-4 bg-neutral-100 rounded-md border border-neutral-200 dark:border-neutral-500">
              <div className="flex items-start mb-2">
                <BsLink45Deg className="mr-3 mt-1 text-neutral-500 flex-shrink-0" size={20} />
                <p className="text-base font-medium">{currentTab.title}</p>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 pl-8 break-all">{currentTab.url}</p>
            </div>
          )}

          {/* Error message if any */}
          {error && (
            <div className="mb-5 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm border border-red-200 dark:border-red-800">
              {error}
              <div className="mt-2 flex">
                <button
                  onClick={fetchOrganizationsHandler}
                  className="text-red-600 dark:text-red-300 flex items-center text-sm hover:underline mr-4">
                  <FaSync className="mr-1" size={12} /> Try again
                </button>

                <button
                  onClick={async () => {
                    try {
                      // Test direct API call with both parameter formats
                      const userIdValue = await getUserId();
                      // Try both parameter formats in parallel
                      const url1 = `/sharable_content/organizations?userId=${userIdValue}`;
                      const url2 = `/sharable_content/organizations?user_id=${userIdValue}`;
                      Promise.all([
                        axiosInstance.get(url1).catch(e => ({ error: e, url: url1 })),
                        axiosInstance.get(url2).catch(e => ({ error: e, url: url2 })),
                      ]).then(results => {
                        // Show results on screen
                        setError(`Debug info logged to console. User ID: ${userIdValue.substring(0, 10)}...`);
                      });
                    } catch (err) {
                      console.error('Debug test failed:', err);
                      setError('Debug test failed. See console for details.');
                    }
                  }}
                  className="text-blue-500 dark:text-blue-300 flex items-center text-sm hover:underline">
                  <span className="mr-1">🐞</span> Debug API
                </button>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center items-center py-4">
              <svg
                className="animate-spin h-6 w-6 text-neutral-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-neutral-600 dark:text-neutral-300">Loading...</span>
            </div>
          )}

          {/* Organization selector */}
          <div className="mb-5">
            <h4 className="text-base font-medium text-neutral-700 mb-4 border-b border-neutral-200 dark:border-neutral-600 pb-2">
              Select Organization
            </h4>

            {/* Dropdown Button */}
            <div className="mb-3 space-y-2 relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-600 rounded-md bg-white text-black hover:bg-neutral-100 transition-colors">
                {selectedOrg ? selectedOrg.team_name : 'Select Organization'}
                <FaChevronDown className="ml-2 text-neutral-500" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute mt-2 w-full bg-frostedwhite dark:bg-frostedwhite backdrop-blur-sm border border-neutral-300 dark:border-neutral-700/50 rounded-md shadow-md z-10">
                  {organizations.map(org => (
                    <div
                      key={org.org_id}
                      onClick={() => {
                        handleSelect(org);
                        setDropdownOpen(false);
                        setSelectedChannel(null);
                        setSelectedFolder(null);
                      }}
                      className="dropdown flex items-center p-3 cursor-pointer transition-colors hover:bg-neutral-100">
                      <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center mr-3 text-sm font-semibold">
                        {org.team_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-base font-medium text-neutral-800">{org.team_name}</span>
                      <FaChevronRight className="ml-auto text-neutral-400" size={14} />
                    </div>
                  ))}
                </div>
              )}
              {selectedOrg && (
                <>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {channels.map(channel => (
                      <div key={channel.workspace_id} className="flex items-center gap-4">
                        {/* Channel Button */}
                        <button
                          onClick={() => {
                            setSelectedChannel(channel);
                            setSelectedFolder(null);
                            setSaveDirectlyToChannel(true);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm transition border shadow-sm
                              ${
                                selectedChannel?.workspace_id === channel.workspace_id && !selectedFolder
                                  ? 'bg-neutral-800 text-white border-neutral-800'
                                  : 'bg-gray-300 text-neutral-700 hover:bg-gray-400 border-transparent'
                              }
                          `}>
                          <FaFolder size={14} className="text-neutral-700 dark:text-white" />
                          {channel.workspace_name}
                        </button>
                        <p>:</p>

                        {/* Folders under Channel */}
                        <div className="flex items-center gap-1">
                          {folders
                            .filter(folder => folder.folder_id === channel.workspace_id)
                            .map(folder => (
                              <button
                                key={folder.folder_id}
                                onClick={() => {
                                  setSelectedChannel(channel);
                                  setSelectedFolder(folder.folder_id);
                                  setSaveDirectlyToChannel(false);
                                }}
                                className={`px-2 py-1 rounded-full text-xs transition border border-gray-300 bg-transparent
                                    ${
                                      selectedFolder === folder.folder_id
                                        ? 'text-neutral-800 hover:bg-neutral-100 bg-neutral-800 dark:bg-neutral-800 dark:text-white border-neutral-300'
                                        : 'text-neutral-700 hover:bg-neutral-100 border-neutral-300'
                                    }
                                `}>
                                {folder.folder_name}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSaveLink}
                      disabled={(!saveDirectlyToChannel && !selectedFolder) || isSaving}
                      className={`btn w-full py-3 text-base ${
                        (saveDirectlyToChannel || selectedFolder) && !isSaving
                          ? 'btn-primary'
                          : 'bg-neutral-400 cursor-not-allowed text-white'
                      }`}>
                      {isSaving ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Saving...
                        </span>
                      ) : saveSuccess ? (
                        <span className="flex items-center">
                          <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved Successfully!
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <FaSave className="mr-3" size={18} />
                          Save Link
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Channel/Folder Selector */}
          </div>
        </div>
      )}

      {/* Add debug panel to the end */}
      {renderDebugPanel()}
      <UnpinConfirmationDialog
        isOpen={showUnpinDialog}
        onClose={() => setShowUnpinDialog(false)}
        onConfirm={handleConfirmUnpin}
      />
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div className="p-4 text-center">Loading...</div>),
  <div className="p-4 text-center text-red-500">An error occurred. Please try again.</div>,
);
