import {StorageManager} from '../storage/StorageManager';
import {incrementUserRefreshCounter} from '@private-services/userRefreshCounterService';
import { updateAutomationRealtime } from '../features/automationsApi';
import { updateInstallation } from '../storeApis/storeApiService';

export interface FavoriteItemResponse {
  favourite_id: number;
  user_id: string;
  snippet_id: string | null;
  created_at: string;
  updated_at: string;
  command_id: string | null;
}

export interface FavoritesResponse {
  data: FavoriteItemResponse[];
}

/**
 * Fetches the user's favorites from the cloud.
 * @param userId - The ID of the user to fetch favorites for.
 * @returns A promise that resolves to an array of FavoriteItemResponse objects.
 */
export const getFavorites = async (userId: string): Promise<FavoriteItemResponse[]> => {
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  // 1. Fetch Local Favorites
  let localFavs: FavoriteItemResponse[] = [];
  try {
    const response = await localProvider.getFavorites(userId);
    if (response && Array.isArray(response.data)) {
      localFavs = response.data;
    } else if (Array.isArray(response)) {
      localFavs = response;
    }
  } catch (error) {
    console.error('[getFavorites] Local fetch failed:', error);
  }

  // 2. Fetch Cloud Favorites
  let cloudFavs: FavoriteItemResponse[] = [];
  try {
    if (userId && userId !== 'local_user') {
      const response = await cloudProvider.getFavorites(userId);
      if (response && Array.isArray(response.data)) {
        cloudFavs = response.data;
      } else if (Array.isArray(response)) {
        cloudFavs = response;
      }
    }
  } catch (error) {
    console.warn('[getFavorites] Cloud fetch failed, continuing with local only:', error);
  }

  // 3. Merge and deduplicate by snippet_id / command_id
  const merged = [...localFavs];
  const localSnippetIds = new Set(localFavs.map(f => f.snippet_id).filter(Boolean));
  const localCommandIds = new Set(localFavs.map(f => f.command_id).filter(Boolean));

  for (const f of cloudFavs) {
    const isDuplicate = 
      (f.snippet_id && localSnippetIds.has(f.snippet_id)) || 
      (f.command_id && localCommandIds.has(f.command_id));
    if (!isDuplicate) {
      merged.push(f);
    }
  }

  return merged;
};

/**
 * Adds a new favorite item (snippet or command).
 * @param userId - The ID of the user.
 * @param item - The item to add (must have an id).
 * @param type - The type of item ('snippet' | 'command' | 'automation' | 'agent' | 'module').
 */
export const addFavorite = async (
  userId: string,
  item: { id: string; module_id?: string; installation_id?: string | number },
  type: 'snippet' | 'command' | 'automation' | 'agent' | 'module',
  skipIncrement?: boolean,
  storageMode?: 'local' | 'cloud',
): Promise<FavoriteItemResponse | null> => {
  console.log('[favoritesApi.addFavorite] Invoked with arguments:', { userId, itemId: item.id, type, skipIncrement, storageMode });
  try {
    // Handle entity types with direct fields
    if (type === 'automation' || type === 'agent') {
      console.log('[favoritesApi.addFavorite] Delegating to updateAutomationRealtime');
      await updateAutomationRealtime(userId, {
        automation_id: String(item.id),
        is_favourite: true,
      }, storageMode);

      return {
        favourite_id: Number(item.id) || Date.now(),
        user_id: userId,
        snippet_id: item.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        command_id: null,
      };
    }

    if (type === 'module') {
      const moduleId = item.module_id || item.id;
      const installationId = item.installation_id || item.id;
      console.log('[favoritesApi.addFavorite] Delegating to updateInstallation for module:', { moduleId, installationId });
      await updateInstallation(moduleId, installationId, { is_favourite: true }, storageMode);

      return {
        favourite_id: Number(installationId) || Date.now(),
        user_id: userId,
        snippet_id: String(installationId),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        command_id: null,
      };
    }

    const payload: { user_id: string; snippet_id?: string; command_id?: string } = {
      user_id: userId,
    };

    if (type === 'command') {
      payload.command_id = (item as any).command_id || item.id;
    } else {
      payload.snippet_id = (item as any).snippet_id || (item as any).automation_id || item.id;
    }

    let resolvedMode: 'local' | 'cloud' = storageMode || 'cloud';
    if (!storageMode) {
      try {
        if (type === 'command') {
          const commandId = (item as any).command_id || item.id;
          const result = await chrome.storage.local.get('alts_commands');
          const cmds = result.alts_commands || [];
          const cmd = cmds.find((c: any) => c.id === commandId || c.command_id === commandId);
          if (cmd) {
            resolvedMode = cmd.storageMode || (cmd.is_local || cmd.category === 'browser' ? 'local' : 'cloud');
            console.log('[favoritesApi.addFavorite] Command storageMode resolved from alts_commands:', resolvedMode);
          } else {
            const res = await StorageManager.getInstance().resolveStorageMode({
              isNew: true,
              userId,
            });
            resolvedMode = res.storageMode;
            console.log('[favoritesApi.addFavorite] Command storageMode resolved from fallback resolveStorageMode:', resolvedMode);
          }
        } else {
          const res = await StorageManager.getInstance().resolveStorageMode({
            isNew: false, // The snippet already exists
            snippetId: type === 'snippet' ? item.id : undefined,
            automationId: undefined,
            userId,
          });
          resolvedMode = res.storageMode;
          console.log('[favoritesApi.addFavorite] Snippet storageMode resolved from resolveStorageMode:', resolvedMode, 'resolvedBy:', res.resolvedBy, 'orgId:', res.orgId);
        }
      } catch (err) {
        console.warn('[addFavorite] Failed to resolve storage mode, using fallback selectedTeamId storage mode', err);
      }
    }

    console.log('[favoritesApi.addFavorite] Final routing details:', { resolvedMode, payload });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.addFavorite(payload);
    console.log('[favoritesApi.addFavorite] Provider response:', response);

    // Increment counter so other devices know to re-fetch (fire-and-forget)
    if (!skipIncrement) {
      incrementUserRefreshCounter().catch(() => {});
    }

    // Handle potential response variations (array or single object)
    if (Array.isArray(response)) {
      return response[0] || null;
    } else if (response && 'data' in response && Array.isArray(response.data)) {
      return response.data[0] || null;
    }
    return response as FavoriteItemResponse;
  } catch (error) {
    console.error('[addFavorite] Error adding favorite:', error);
    return null;
  }
};

/**
 * Deletes a favorite item by its user ID and favorite ID.
 * @param userId - The ID of the user.
 * @param favoriteId - The ID of the favorite entry to delete.
 */
export const deleteFavorite = async (
  userId: string,
  favoriteId: number,
  skipIncrement?: boolean,
  storageMode?: 'local' | 'cloud',
  itemDetails?: { id: string; type: 'snippet' | 'command' | 'automation' | 'agent' | 'module'; moduleId?: string },
): Promise<boolean> => {
  console.log('[favoritesApi.deleteFavorite] Invoked with arguments:', { userId, favoriteId, skipIncrement, storageMode, itemDetails });
  try {
    if (itemDetails) {
      const { id, type, moduleId } = itemDetails;
      if (type === 'automation' || type === 'agent') {
        console.log('[favoritesApi.deleteFavorite] Delegating to updateAutomationRealtime');
        await updateAutomationRealtime(userId, {
          automation_id: String(id),
          is_favourite: false,
        }, storageMode);
        return true;
      }
      if (type === 'module') {
        const effectiveModuleId = moduleId || id;
        console.log('[favoritesApi.deleteFavorite] Delegating to updateInstallation for module:', { effectiveModuleId, id });
        await updateInstallation(effectiveModuleId, id, { is_favourite: false }, storageMode);
        return true;
      }
    }

    let resolvedMode: 'local' | 'cloud' = storageMode || 'cloud';
    if (!storageMode) {
      try {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          const result = await new Promise<any>(resolve =>
            chromeAny.storage.local.get('myFavouriteItems', resolve)
          );
          const favItems = result?.myFavouriteItems || {};
          const userFavs = favItems[userId] || [];
          const match = userFavs.find((f: any) => f.favourite_id === favoriteId);
          if (match) {
            console.log('[favoritesApi.deleteFavorite] Found match in myFavouriteItems:', match);
            const cmdId = match.command_id || (match.category === 'browser' || match.category === 'core' || match.category === 'search' ? (match.id || match.snippet_id) : undefined);
            if (cmdId) {
              const cmdResult = await chrome.storage.local.get('alts_commands');
              const cmds = cmdResult.alts_commands || [];
              const cmd = cmds.find((c: any) => c.id === cmdId || c.command_id === cmdId);
              if (cmd) {
                resolvedMode = cmd.storageMode || (cmd.is_local || cmd.category === 'browser' ? 'local' : 'cloud');
                console.log('[favoritesApi.deleteFavorite] Command storageMode resolved from alts_commands:', resolvedMode);
              }
            } else {
              const snId = match.snippet_id || match.id;
              const res = await StorageManager.getInstance().resolveStorageMode({
                isNew: false,
                snippetId: snId,
                userId,
              });
              resolvedMode = res.storageMode;
              console.log('[favoritesApi.deleteFavorite] Snippet storageMode resolved from resolveStorageMode:', resolvedMode, 'resolvedBy:', res.resolvedBy, 'orgId:', res.orgId);
            }
          } else {
            console.log('[favoritesApi.deleteFavorite] No match found in myFavouriteItems for favoriteId:', favoriteId);
            // Even if match is missing, we must resolve routing mode safely
            const res = await StorageManager.getInstance().resolveStorageMode({
              isNew: false,
              userId,
            }).catch(() => ({ storageMode: 'cloud' as const, resolvedBy: 'fallback' as const, orgId: 'unknown' }));
            resolvedMode = res.storageMode;
            console.log('[favoritesApi.deleteFavorite] Resolved default storageMode for unmatched favorite delete:', resolvedMode);
          }
        }
      } catch (e) {
        console.warn('[deleteFavorite] Failed resolving storage mode from cache:', e);
      }
    }

    console.log('[favoritesApi.deleteFavorite] Final routing details:', { resolvedMode, userId, favoriteId });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    await provider.deleteFavorite(userId, favoriteId);
    console.log('[favoritesApi.deleteFavorite] Provider delete complete.');

    // Increment counter after successful delete (fire-and-forget)
    if (!skipIncrement) {
      incrementUserRefreshCounter().catch(() => {});
    }
    return true;
  } catch (error) {
    console.error('[deleteFavorite] Error deleting favorite:', error);
    return false;
  }
};
