import { createStorage, StorageEnum } from '../base/index.js';

const storage = createStorage<string>('wallpaper-id-storage-key', 'none', {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceWallpaperStorage = storage;
