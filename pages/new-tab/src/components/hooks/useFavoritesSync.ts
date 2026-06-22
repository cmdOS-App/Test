import { useEffect, useState, useRef } from 'react';
import { getFavorites, addFavorite } from '../../../../Apis/services/favoritesApi';
import { COMMANDS, AI_GROUP } from '../SearchComponents/Searchbar/commands';
import {
  checkIfUserRefreshNeeded,
  saveLocalUserCounter,
  clearUserCheckCache,
  incrementUserRefreshCounter,
} from '@private-services/userRefreshCounterService';

const chromeAny = chrome as any;

export const useFavoritesSync = (userId: string, allData: any[]) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const hasSyncedRef = useRef<string | null>(null);
  const lastAllDataRef = useRef<any[] | null>(null);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.user_fav_sync_trigger) {
        clearUserCheckCache();
        setRefreshTrigger((v) => v + 1);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    if (!userId || !allData || allData.length === 0) return;

    const syncKey = `${userId}-${refreshTrigger}`;
    if (hasSyncedRef.current === syncKey && lastAllDataRef.current === allData) return;

    const syncFavorites = async () => {
      try {
        const storageResult = await new Promise<any>((resolve) => {
          chromeAny.storage.local.get(['myFavouriteItems', `favorites_fetched_${userId}`], resolve);
        });
        const localFavorites = storageResult?.myFavouriteItems || {};
        const currentLocalList = localFavorites[userId] || [];
        const everFetched = !!storageResult?.[`favorites_fetched_${userId}`];

        const check = await checkIfUserRefreshNeeded();
        const remoteCounter = check.remoteCounter;
        let needsRefresh = check.needsRefresh || !everFetched;

        if (!needsRefresh) {
          hasSyncedRef.current = syncKey;
          lastAllDataRef.current = allData;
          return;
        }

        const cloudFavorites = await getFavorites(userId);
        let hasChanges = false;
        const mergedList: any[] = [];
        const localMap = new Map(currentLocalList.map((item: any) => [item.id, item]));

        for (const cloudItem of cloudFavorites) {
          const targetId = cloudItem.snippet_id || cloudItem.command_id;
          if (!targetId) continue;

          if (localMap.has(targetId)) {
            const localItem: any = localMap.get(targetId);
            if (localItem.favourite_id !== cloudItem.favourite_id) {
              mergedList.push({ ...localItem, favourite_id: cloudItem.favourite_id });
              hasChanges = true;
            } else {
              mergedList.push(localItem);
            }
            localMap.delete(targetId);
          } else {
            let foundSnippet: any = null;
            let foundOrgId: string = '';
            let foundWorkspaceId: string = '';
            let foundFolderId: string = '';

            for (const team of allData) {
              if (foundSnippet) break;
              const orgId = team.id || team.team_id || '';
              for (const ws of team.workspaces) {
                if (foundSnippet) break;
                const wsId = ws.workspace_id || ws.id || '';

                // 1. Workspace-level snippets
                const wsSnippets = ws.workspace_snippets || [];
                const match = wsSnippets.find((s: any) => s.id === targetId || s.snippet_id === targetId);
                if (match) {
                  foundSnippet = match;
                  foundOrgId = orgId;
                  foundWorkspaceId = wsId;
                  break;
                }

                // 2. Workspace-level automations
                const wsAutos = (ws as any).workspace_automations || [];
                const aMatch = wsAutos.find((a: any) => String(a.id) === String(targetId));
                if (aMatch) {
                  foundSnippet = { ...aMatch, type: 'automation', category: 'automation' };
                  foundOrgId = orgId;
                  foundWorkspaceId = wsId;
                  break;
                }

                // 3. Folder-level snippets (recursive)
                const searchFoldersDeep = (folders: any[]): { snippet: any; folderId: string } | null => {
                  for (const folder of folders) {
                    const fId = folder.folder_id || folder.id || '';
                    const snippets = folder.snippets || folder.folder_snippets || [];
                    const fMatch = snippets.find((s: any) => s.id === targetId || s.snippet_id === targetId);
                    if (fMatch) {
                      return { snippet: fMatch, folderId: fId };
                    }
                    if (folder.folders && folder.folders.length > 0) {
                      const deepMatch = searchFoldersDeep(folder.folders);
                      if (deepMatch) return deepMatch;
                    }
                  }
                  return null;
                };

                if (ws.folders && ws.folders.length > 0) {
                  const folderMatch = searchFoldersDeep(ws.folders);
                  if (folderMatch) {
                    foundSnippet = folderMatch.snippet;
                    foundOrgId = orgId;
                    foundWorkspaceId = wsId;
                    foundFolderId = folderMatch.folderId;
                    break;
                  }
                }
              }
            }

            if (foundSnippet) {
              mergedList.push({
                ...foundSnippet,
                favourite_id: cloudItem.favourite_id,
                id: foundSnippet.id || foundSnippet.snippet_id,
                label: foundSnippet.key || foundSnippet.name,
                type: foundSnippet.type || 'snippet',
                org_id: foundOrgId,
                workspace_id: foundWorkspaceId,
                folder_id: foundFolderId,
              });
              hasChanges = true;
            } else {
              const command = COMMANDS.find(c => c.id === targetId) || (targetId === 'ai' ? AI_GROUP : null);
              if (command) {
                mergedList.push({
                  id: command.id,
                  type: 'command',
                  label: command.label,
                  favourite_id: cloudItem.favourite_id,
                });
                hasChanges = true;
              }
            }
          }
        }

        localMap.forEach(val => mergedList.push(val));

        if (hasChanges || mergedList.length !== currentLocalList.length) {
          const updatedMapping = { ...localFavorites, [userId]: mergedList };
          await new Promise((resolve) => chromeAny.storage.local.set({ myFavouriteItems: updatedMapping }, resolve));
        }

        if (cloudFavorites.length === 0 && currentLocalList.length > 0) {
          const syncableList = currentLocalList.filter((item: any) => item.type === 'command' || item.type === 'snippet');
          if (syncableList.length > 0) {
            await Promise.all(syncableList.map((item: any) => addFavorite(userId, item, item.type, true)));
            await incrementUserRefreshCounter();
          }
        } else {
          await saveLocalUserCounter(userId, remoteCounter);
        }

        // Mark as fetched for this user
        await new Promise<void>((resolve) => {
          chromeAny.storage.local.set({ [`favorites_fetched_${userId}`]: true }, resolve);
        });

        hasSyncedRef.current = syncKey;
        lastAllDataRef.current = allData;
      } catch (error) {
        console.error('[useFavoritesSync] Sync Error:', error);
      }
    };

    syncFavorites();
  }, [userId, allData, refreshTrigger]);
};
