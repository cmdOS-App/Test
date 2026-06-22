import type { BaseStorage } from '../base/index.js';
import { createStorage, StorageEnum } from '../base/index.js';

export interface AIChatSession {
  id: string;
  prompt: string;
  models: string[];
  urls: Record<string, string>;
  timestamp: number;
}

type AIHistory = AIChatSession[];

type AIHistoryStorage = BaseStorage<AIHistory> & {
  addSession: (session: AIChatSession) => Promise<void>;
  updateSessionUrls: (id: string, model: string, url: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

const storage = createStorage<AIHistory>('ai-history-storage-key', [], {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const aiHistoryStorage: AIHistoryStorage = {
  ...storage,
  addSession: async session => {
    // No-op: AI sessions are now ephemeral and handled in memory
  },
  updateSessionUrls: async (id, model, url) => {
    // No-op: AI sessions are now ephemeral and handled in memory
  },
  clearHistory: async () => {
    await storage.set(() => []);
  },
};
