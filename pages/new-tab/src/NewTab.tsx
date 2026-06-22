import '@src/NewTab.css';
import '@src/NewTab.scss';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { t } from '@extension/i18n';
import { useEffect, useState, useMemo } from 'react';
import { getUserId } from '../../Apis/core/api';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllDataThunk, selectAllData, setData } from '../../Redux/AllData/allDataSlice';
import { selectSelectedTeam } from '../../Redux/AllData/uiStateSlice';
import type { AppDispatch } from '../../Redux/store';
import { checkIfRefreshNeeded, saveCounters } from '@private-services/refreshCounterService';
import type { Team } from '../../modals/interfaces';
import { CMDOS_REDIRECT_URL, CMDOS_SIGN_UP_URL, CMD_DOMAIN } from '../../Apis/core/apiConfig';
// Inline LoginPrompt component from AltS to avoid import issues
const NewTabLoginGuide = ({ onSignIn }: { onSignIn: () => void }) => {
  return (
    <div
      className="relative border-[0px] h-full w-full flex items-center justify-center bg-[#000000e8] "
      style={{
        backgroundImage: 'radial-gradient(60% 60% at 85% 85%, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0) 60%)',
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 8px 32px',
      }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="relative max-w-xl w-full mx-6 rounded-3xl border border-white/70 dark:border-neutral-700/60 bg-frostedwhite backdrop-blur-xl p-10 flex flex-col gap-8 text-center">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 180, damping: 14 }}
          className="inline-flex items-center justify-center gap-3 px-5 py-2.5 rounded-full bg-neutral-900 text-white dark:bg-white/90 dark:text-neutral-900 shadow-inner shadow-neutral-900/10 self-center">
          <FiLogIn className="h-5 w-5" />
          <span className="uppercase text-xs tracking-[0.3em] font-semibold">Welcome to cmdOS</span>
        </motion.div>

        <div className="space-y-4">
          <motion.h2
            className="text-3xl md:text-4xl font-semibold text-neutral-900 dark:text-white"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, type: 'spring', stiffness: 160, damping: 16 }}>
            Your command center for everything
          </motion.h2>
          <motion.p
            className="text-xs text-neutral-600 dark:text-neutral-200 leading-relaxed pt-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 140, damping: 18 }}>
            The fastest way to access everything on the web
          </motion.p>
          <motion.p
            className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 140, damping: 18 }}>
            Sign in to access your folders, notes, and links.{' '}
          </motion.p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
          <motion.button
            onClick={onSignIn}
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-7 py-3 text-base font-medium shadow-lg shadow-neutral-900/10 hover:shadow-neutral-900/20 transition-shadow">
            Launch sign-in
            <FiArrowUpRight className="h-5 w-5" />
          </motion.button>
        </div>

        <motion.p
          className="text-xs text-neutral-400 dark:text-neutral-500"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}>
          Need help? Visit <span className="font-semibold text-neutral-600 dark:text-neutral-300">{CMD_DOMAIN}</span> to
          learn more.
        </motion.p>
      </motion.div>
    </div>
  );
};
import App from './components/App';

import FullScreenNoteView from './components/Editor/FullScreenNoteView';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLogIn, FiArrowUpRight } from 'react-icons/fi';

// Custom error boundary component
const ErrorFallback = ({ error }: { error?: Error }) => {
  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl mb-4 text-gray-400">Something went wrong, please refresh this page</h2>
        <p className="mb-4 text-gray-400">The application encountered an unexpected error.</p>
        {error && (
          <div className="p-3 rounded-lg mb-4 text-left overflow-auto max-h-32">
            <p className="text-gray-400 text-sm font-mono">{error.message}</p>
          </div>
        )}
        <button
          onClick={refreshPage}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors">
          Refresh
        </button>
      </div>
    </div>
  );
};

const NewTab = () => {
  const dispatch = useDispatch<AppDispatch>();
  const allData = useSelector(selectAllData);
  const selectedTeam = useSelector(selectSelectedTeam);

  const logo = 'popup/icon.png';
  const gotoWebsite = () => chrome.tabs.create({ url: CMDOS_REDIRECT_URL });
  const handleLogin = () => {
    chrome.tabs.create({ url: CMDOS_SIGN_UP_URL });
  };

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Removed force dark mode for LoginGuide to allow light mode

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const retrievedUserId = await getUserId();
        setUserId(retrievedUserId);
        setIsLoggedIn(true);
      } catch (error: any) {
        if (error?.name !== 'AuthError' && !error?.message?.includes('login')) {
          console.error('Authentication Error:', error); // Only log real errors, not expected unauthenticated states
        }
        setIsLoggedIn(false);
      }
    };

    checkAuth();
  }, []);

  // Check for New Tab Override Toggle
  // Parse URL parameters to check for full-screen note mode
  const urlParams = useMemo(() => {
    const url = new URL(window.location.href);
    return {
      openNote: url.searchParams.get('open_note') === 'true',
      noteId: url.searchParams.get('noteid') || '',
      focus: url.searchParams.get('focus') === 'true',
      openCreate: url.searchParams.get('open_create') === 'true',
    };
  }, []);

  // Ensure data is loaded when opening a note directly via URL
  // Ensure data is loaded when opening a note directly via URL
  useEffect(() => {
    if (!isLoggedIn) return;

    // Check if we need to load data
    if (!allData || allData.length === 0) {
      setIsDataLoading(true);

      const initializeData = async () => {
        // Step 1: Load cached data from storage (don't use strict freshness check)
        // We want to show cached data for instant UI regardless of age
        const storageResult = await new Promise<{ myCachedAllData?: Team[]; selectedTeamId?: string }>(resolve => {
          chrome.storage.local.get(['myCachedAllData', 'selectedTeamId'], result => resolve(result));
        });

        const cachedData = storageResult.myCachedAllData;
        const selectedOrgId = storageResult.selectedTeamId || cachedData?.[0]?.team_id || null;

        // Show cached data immediately for instant UI
        if (cachedData && cachedData.length > 0) {
          dispatch(setData(cachedData));
          setIsDataLoading(false);
        }

        const hasCloudOrgs = Array.isArray(cachedData) && cachedData.some((t: any) => t && t.storageMode !== 'local');

        // Step 2: Check if we have an org ID to check counter, or if no cloud orgs are cached yet
        if (!selectedOrgId || (isLoggedIn && !hasCloudOrgs)) {
          // No org ID available or no cloud orgs loaded yet - need to fetch all data
          if (isLoggedIn) await dispatch(fetchAllDataThunk());
          setIsDataLoading(false);
          return;
        }

        // Step 3: Check refresh counter BEFORE deciding to fetch
        try {
          const { needsRefresh, remoteCounters } = await checkIfRefreshNeeded([selectedOrgId]);

          if (needsRefresh) {
            if (isLoggedIn) await dispatch(fetchAllDataThunk());
            // Save the remote counter after successful fetch
            if (isLoggedIn) await saveCounters(remoteCounters);
          } else {
          }
        } catch (error) {
          console.error('[NewTab] Error checking refresh counters:', error);
          // Fallback: If we had no cache and check failed, ensure we fetch
          if (!cachedData || cachedData.length === 0) {
            if (isLoggedIn) await dispatch(fetchAllDataThunk());
          }
        } finally {
          setIsDataLoading(false);
        }
      };

      initializeData();
    }
  }, [isLoggedIn, allData, dispatch]);

  // Listen for data_changed_at signals written by any context (AltQ, content script)
  // after saving/updating a link. This bypasses the 1-minute refresh cooldown and
  // immediately propagates new links to Board View, Sheet Toolbar, and Search.
  useEffect(() => {
    if (!isLoggedIn) return;
    const handleStorageChange = (changes: any, area: string) => {
      if (area === 'local' && changes.data_changed_at) {
        dispatch(fetchAllDataThunk());
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [isLoggedIn, dispatch]);

  const handleNoteViewBack = () => {
    // Navigate to default new tab
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs?.update && chromeAny?.runtime?.getURL) {
      chromeAny.tabs.getCurrent((tab: any) => {
        if (tab?.id) {
          chromeAny.tabs.update(tab.id, { url: chromeAny.runtime.getURL('new-tab/index.html') });
        }
      });
    }
  };

  // No longer blocking the app with a login guide

  // Full-screen note view
  if (urlParams.openNote && isLoggedIn) {
    return <FullScreenNoteView noteId={urlParams.noteId} onBack={handleNoteViewBack} />;
  }

  return <App />;
};

export default withErrorBoundary(
  withSuspense(NewTab, <></>),
  <ErrorFallback />,
);
