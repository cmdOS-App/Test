import { CommandModule } from '../types';
import { store } from '../../../../Redux/store';
import { fetchAllDataThunk } from '../../../../Redux/AllData/allDataSlice';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { resetAllSyncTimers, syncInstalledModulesToStorage } from '../../../../Apis/core/api';

export const RefreshCommand: CommandModule = {
  id: 'refresh',
  label: 'Refresh',
  prefix: '/refresh',
  keywords: ['refresh', 'reload', 'Refresh', 'reload page'],
  behavior: 'instant',

  execute: async () => {
    // Fetch all data, reset caching cooldowns, and increment refresh counter
    try {
      await store.dispatch(fetchAllDataThunk() as any);
      await resetAllSyncTimers();
      await syncInstalledModulesToStorage();
      await incrementOrgRefreshCounter();
    } catch (error) {
      console.error('[RefreshCommand] Error during refresh:', error);
      // Continue with tab reload even if these fail
    }

    const chromeAny = (window as any)?.chrome;

    // Reload all open new-tab instances and the active tab
    if (chromeAny?.tabs?.query && chromeAny?.tabs?.reload) {
      chromeAny.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
        if (chromeAny.runtime?.lastError) {
          console.warn('[RefreshCommand] Error querying tabs:', chromeAny.runtime.lastError);
          // Fallback to window.location.reload() if available
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          }
          return;
        }

        const extensionId = chromeAny.runtime?.id;
        const tabsToReload: { id: number; isActive: boolean }[] = [];

        tabs.forEach((tab) => {
          if (!tab.id) return;

          const isNewTab = tab.url && (
            tab.url.includes('chrome://newtab') ||
            (extensionId && tab.url.includes(`chrome-extension://${extensionId}/pages/new-tab/index.html`)) ||
            tab.url.includes('new-tab/index.html')
          );

          if (isNewTab || tab.active) {
            tabsToReload.push({ id: tab.id, isActive: !!tab.active });
          }
        });

        // Sort so that we reload background tabs first, and reload the active tab last
        tabsToReload.sort((a, b) => (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0));

        let activeTabReloaded = false;
        tabsToReload.forEach((t) => {
          chromeAny.tabs.reload(t.id);
          if (t.isActive) {
            activeTabReloaded = true;
          }
        });

        if (!activeTabReloaded && typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
      });
    } else {
      // chrome.tabs API not available, use window.location.reload() as fallback
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    }
  },
};
