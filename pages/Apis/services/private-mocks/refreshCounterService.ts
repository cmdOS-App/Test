export const COUNTER_STORAGE_KEY = 'orgRefreshCounters';

export const getSelectedOrgId = async (): Promise<string | null> => {
  return new Promise(resolve => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) {
      resolve(null);
      return;
    }
    chromeAny.storage.local.get(['selectedTeamId'], (result: any) => {
      resolve(result.selectedTeamId || null);
    });
  });
};

export const getStoredCounters = async (): Promise<Record<string, number>> => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result: any = await new Promise(resolve => chrome.storage.local.get(COUNTER_STORAGE_KEY, resolve));
    return result?.[COUNTER_STORAGE_KEY] || {};
  }
  return {};
};

export const saveCounters = async (counters: Record<string, number>): Promise<void> => {
  return new Promise(resolve => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) {
      resolve();
      return;
    }
    chromeAny.storage.local.set({ [COUNTER_STORAGE_KEY]: counters }, () => resolve());
  });
};

export const hasAnyOrgChanged = (
  _localCounters: Record<string, number>,
  _remoteCounters: Record<string, number | null>,
): boolean => {
  return false;
};

export const incrementOrgRefreshCounter = async (): Promise<void> => {
  try {
    const orgId = await getSelectedOrgId();
    if (!orgId) return;

    const localCounters = await getStoredCounters();
    const currentLocal = localCounters[orgId] || 0;
    const newValue = currentLocal + 1;
    const updatedCounters = { ...localCounters, [orgId]: newValue };
    await saveCounters(updatedCounters);
  } catch (error) {
    console.error('[RefreshCounterMock] Failed to increment local counter:', error);
  }
};

export const checkIfRefreshNeeded = async (
  _orgIds: string[],
): Promise<{
  needsRefresh: boolean;
  remoteCounters: Record<string, number>;
}> => {
  return { needsRefresh: false, remoteCounters: {} };
};
