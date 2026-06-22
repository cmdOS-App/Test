const USER_COUNTER_STORAGE_KEY = 'userRefreshCounter';

export const getRemoteUserCounter = async (_userId: string): Promise<number> => {
  return 0;
};

export const getLocalUserCounter = async (userId: string): Promise<number> => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result: any = await new Promise(resolve => chrome.storage.local.get(USER_COUNTER_STORAGE_KEY, resolve));
    const stored = result?.[USER_COUNTER_STORAGE_KEY] || {};
    return stored[userId] ?? 0;
  }
  return 0;
};

export const saveLocalUserCounter = async (userId: string, counterValue: number): Promise<void> => {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.get(USER_COUNTER_STORAGE_KEY, (result: any) => {
      const stored = result[USER_COUNTER_STORAGE_KEY] || {};
      const updated = { ...stored, [userId]: counterValue };
      chrome.storage.local.set({ [USER_COUNTER_STORAGE_KEY]: updated }, () => resolve());
    });
  });
};

export const clearUserCheckCache = () => {};

export const checkIfUserRefreshNeeded = async (): Promise<{
  needsRefresh: boolean;
  remoteCounter: number;
  userId: string;
}> => {
  return { needsRefresh: false, remoteCounter: 0, userId: 'local_user' };
};

export const incrementUserRefreshCounter = async (): Promise<void> => {};
