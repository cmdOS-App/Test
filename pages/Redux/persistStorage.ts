import type { Storage } from 'redux-persist';

function isChromeStorageAvailable(): boolean {
  try {
    // @ts-ignore chrome is provided by the extension environment
    return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
  } catch {
    return false;
  }
}

const chromeStorage: Storage = {
  getItem: (key: string): Promise<string | null> =>
    new Promise(resolve => {
      try {
        // @ts-ignore chrome is provided by the extension environment
        chrome.storage.local.get([key], result => {
          const value = result?.[key];
          resolve(typeof value === 'string' ? value : value ? JSON.stringify(value) : null);
        });
      } catch {
        resolve(null);
      }
    }),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise(resolve => {
      try {
        // Persist raw string if possible; redux-persist always passes a string
        // @ts-ignore chrome is provided by the extension environment
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } catch {
        resolve();
      }
    }),
  removeItem: (key: string): Promise<void> =>
    new Promise(resolve => {
      try {
        // @ts-ignore chrome is provided by the extension environment
        chrome.storage.local.remove([key], () => resolve());
      } catch {
        resolve();
      }
    }),
};

const memory: Record<string, string> = {};
const memoryStorage: Storage = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(memory[key] ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    memory[key] = value;
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    delete memory[key];
    return Promise.resolve();
  },
};

const storage: Storage = isChromeStorageAvailable() ? chromeStorage : memoryStorage;

export default storage;
