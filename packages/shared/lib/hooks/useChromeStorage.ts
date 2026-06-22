import { useStorage } from './useStorage.js';
import { createStorage, StorageEnum } from '@extension/storage';
import type { BaseStorage } from '@extension/storage';

const storageInstances = new Map<string, BaseStorage<any>>();

export function useChromeStorage<T>(key: string, defaultValue: T): [T, (value: T | ((val: T) => T)) => Promise<void>] {
  let storage = storageInstances.get(key) as BaseStorage<T>;
  if (!storage) {
    storage = createStorage<T>(key, defaultValue, {
      storageEnum: StorageEnum.Local,
      liveUpdate: true,
    });
    storageInstances.set(key, storage);
  }

  const value = useStorage(storage);

  const setValue = async (newValue: T | ((val: T) => T)) => {
    await storage.set(newValue);
  };

  return [value, setValue];
}