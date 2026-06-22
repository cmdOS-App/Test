import { axiosInstance, SUPABASE_BASE_URL, SUPABASE_TOKEN } from './axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from './bgFetch';
import { CMDOS_ORG_MEMBERS_URL, CMDOS_ORG_USER_DETAIL_URL, CMDOS_GET_USAGE_URL, CMD_DOMAIN, CMD_URL } from './apiConfig';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { incrementUserRefreshCounter } from '@private-services/userRefreshCounterService';
import { cleanupLocalTodosAfterDelete } from '../features/snippetApi';
import { StorageManager } from '../storage/StorageManager';

import { getUserId, getUserName, AuthError } from './identity';
export { getUserId, getUserName, AuthError };

const AUTOMATION_BASE_URL = `${SUPABASE_BASE_URL}/functions/v1/automation_agents`;

/**
 * Helper to unwrap standard API envelope { success: true, data: T }
 */
const unbox = (res: any) => {
  if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
    return res.data;
  }
  return res;
};

//Fetch the all the Organization
export const fetchTeams = async () => {
  return StorageManager.getInstance().getProviderForOrg('cloud').fetchTeams();
};

export const fetchWorkspaces = async (team_id: string) => {
  const { storageMode } = await StorageManager.getInstance().resolveStorageMode({
    isNew: false,
    orgId: team_id,
  });
  return StorageManager.getInstance().getProviderForOrg(storageMode).fetchWorkspaces(team_id);
};

export const fetchFolders = async (org_id: string | null, workspace_id: string | null) => {
  const { storageMode } = await StorageManager.getInstance().resolveStorageMode({
    isNew: false,
    workspaceId: workspace_id,
    orgId: org_id,
  });
  return StorageManager.getInstance().getProviderForOrg(storageMode).fetchFolders(org_id, workspace_id);
};

//Get All the User Data
export const getAll = async (force: boolean = false, isBackground: boolean = false) => {
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  const localData = await localProvider.getAll().catch(err => {
    return [];
  });

  let cloudData: any[] = [];
  try {
    const userId = await getUserId();
    if (userId && userId !== 'local_user') {
      let shouldFetchCloud = true;
      const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;
      if (chromeAny?.storage?.local && !force) {
        const cachedResult = await new Promise<any>(resolve => {
          chromeAny.storage.local.get(['myCachedAllData', 'last_cloud_fetch_timestamp', 'data_changed_mode'], resolve);
        });
        const cacheTime = cachedResult?.last_cloud_fetch_timestamp || 0;
        const now = Date.now();
        const CACHE_COOLDOWN = 15000; // 15 seconds
        const isCoolingDown = (now - cacheTime < CACHE_COOLDOWN);
        const lastChangeMode = cachedResult?.data_changed_mode || 'cloud';

        if (cachedResult?.myCachedAllData && (lastChangeMode === 'local' || isCoolingDown)) {
          const cachedTeams = cachedResult.myCachedAllData;
          cloudData = Array.isArray(cachedTeams)
            ? cachedTeams.filter((t: any) => t && t.storageMode !== 'local')
            : [];
          shouldFetchCloud = false;

          if (lastChangeMode === 'local' && chromeAny?.storage?.local) {
            chromeAny.storage.local.remove('data_changed_mode');
            chromeAny.storage.local.set({ last_cloud_fetch_timestamp: Date.now() });
          }
        }
      }

      if (shouldFetchCloud) {
        const res = await cloudProvider.getAll();
        cloudData = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        if (chromeAny?.storage?.local) {
          await chromeAny.storage.local.set({ last_cloud_fetch_timestamp: Date.now() });
        }
      }
    }
  } catch (err) {
  }

  const merged = [...localData];
  const localIds = new Set(localData.map((t: any) => String(t.team_id)));
  if (Array.isArray(cloudData)) {
    for (const team of cloudData) {
      if (team && team.team_id && !localIds.has(String(team.team_id))) {
        merged.push(team);
      }
    }
  }
  return merged;
};


// Fetch user info (subscription, orgs, etc.) from Supabase edge function
export const getUserInfo = async (userId: string) => {
  const url = `${SUPABASE_BASE_URL}/functions/v1/user_data/user_info?user_id=${userId}`;
  if (isContentScriptContext()) {
    return await bgRequest({ url, method: 'GET' });
  }
  const response = await axiosInstance.get(`/user_data/user_info?user_id=${userId}`);
  return response.data;
};

export interface SubscriptionRecord {
  org_id: string;
  organization_id?: string;
  stripe_user_id?: string | null;
  status?: string;
}

const normalizeSubscriptions = (payload: any): SubscriptionRecord[] => {
  const raw = unbox(payload);
  if (Array.isArray(raw)) return raw as SubscriptionRecord[];
  if (raw && typeof raw === 'object') {
    if (Array.isArray((raw as any).subscriptions)) return (raw as any).subscriptions as SubscriptionRecord[];
    if (Array.isArray((raw as any).data)) return (raw as any).data as SubscriptionRecord[];
  }
  return [];
};

export const getActiveSubscriptions = async (userId: string, orgId?: string): Promise<SubscriptionRecord[]> => {
  let path = `/get_subscriptions?user_id=${userId}&status=active`;
  if (orgId) {
    path += `&organization_id=${orgId}`;
  }
  if (isContentScriptContext()) {
    const result = await bgGet(path);
    return normalizeSubscriptions(result);
  }
  const response = await axiosInstance.get(path);
  return normalizeSubscriptions(response.data);
};

export interface CreateCheckoutSessionPayload {
  user_id: string;
  checkout_type: 'main_subscription' | 'recharge_credits';
  price_id: string;
  success_url: string;
  cancel_url: string;
  quantity?: number;
  customer_email?: string;
  metadata?: Record<string, string>;
  team?: {
    organization_name: string;
    free_org_id?: string;
  };
  recharge?: {
    parent_subscription_id: string;
    parent_plan_id: string;
  };
}

export interface CheckoutSessionResponse {
  success?: boolean;
  checkout_type?: 'main_subscription' | 'recharge_credits';
  checkout_url?: string;
  url?: string;
  session_id?: string;
  mode?: 'payment' | 'subscription';
}

export const createCheckoutSession = async (
  payload: CreateCheckoutSessionPayload,
): Promise<CheckoutSessionResponse> => {
  const path = '/create_checkout_session';
  const headers = { apikey: SUPABASE_TOKEN };
  if (isContentScriptContext()) {
    const result = await bgRequest({ url: path, method: 'POST', headers, body: payload });
    return unbox(result);
  }
  const response = await axiosInstance.post(path, payload, { headers });
  return unbox(response.data);
};

export const syncCounterStats = async (userId: string, payload: any) => {
  const path = `/features/usage/sync/v2?user_id=${userId}`;
  if (isContentScriptContext()) {
    return await bgRequest({ url: path, method: 'POST', body: payload });
  }
  const response = await axiosInstance.post(path, payload);
  return response.data;
};

// ─── Automation APIs ────────────────────────────────────────────────────────

/**
 * Create a new automation (with its steps) on the cloud.
 * Maps frontend camelCase step fields to snake_case before sending.
 */
export const createAutomation = async (
  data: {
    name: string;
    description?: string;
    workspace_id?: string | null;
    folder_id?: string | null;
    steps: Array<{ module_id: string; step_order: number; config: Record<string, any> }>;
    // New optional fields (native to /automations endpoint)
    hotkeys?: string | null;
    shortcuts?: string | null;
    is_favourite?: boolean;
  },
  storageMode?: 'local' | 'cloud'
) => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
    workspaceId: data.workspace_id,
    folderId: data.folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.createLegacyAutomation(userId, data);
  incrementOrgRefreshCounter();
  return result;
};

/**
 * Update an existing automation's metadata and refresh its steps.
 * Steps are synced using a delete-and-reinsert strategy on the backend.
 */
export const updateAutomation = async (
  data: {
    id: number;
    name?: string;
    description?: string;
    workspace_id?: string | null;
    folder_id?: string | null;
    steps?: Array<{ module_id: string; step_order: number; config: Record<string, any> }>;
    // New optional fields (native to /automations endpoint)
    hotkeys?: string | null;
    shortcuts?: string | null;
    is_favourite?: boolean;
  },
  storageMode?: 'local' | 'cloud'
) => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    automationId: String(data.id),
    workspaceId: data.workspace_id,
    folderId: data.folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateLegacyAutomation(userId, data);
  incrementOrgRefreshCounter();
  return result;
};

/**
 * Permanently delete an automation by ID.
 * Associated steps are deleted automatically via CASCADE on the backend.
 */
export const deleteAutomation = async (id: number, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    automationId: String(id),
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.deleteLegacyAutomation(userId, id);
  incrementOrgRefreshCounter();
  return result;
};

// ─── Cloud Module APIs ────────────────────────────────────────────────────────

/**
 * Fetch all available modules from the global catalog.
 */
export const getModuleCatalog = async () => {
  const url = `${AUTOMATION_BASE_URL}/modules/catalog`;
  if (isContentScriptContext()) {
    return unbox(await bgRequest({ url, method: 'GET' }));
  }
  const response = await axiosInstance.get('/automation_agents/modules/catalog');
  return unbox(response.data);
};

/**
 * Helper to fetch and write the latest installed modules to chrome storage.
 */
export const syncInstalledModulesToStorage = async (): Promise<any[]> => {
  try {
    const [installed, metadata] = await Promise.all([
      getInstalledModules(),
      fetchModuleMetadata().catch(err => {
        console.error('Failed to fetch module metadata:', err);
        return [];
      }),
    ]);

    const metaMap: Record<string, any> = {};
    if (Array.isArray(metadata)) {
      metadata.forEach((m: any) => {
        if (m.module_id) metaMap[String(m.module_id)] = m;
      });
    }

    const enriched = (installed || []).map((mod: any) => {
      const m = metaMap[String(mod.module_id)];
      return {
        ...mod,
        description: m?.description || mod.description,
        description_meta: m?.description_meta,
        name: m?.name || mod.name,
        icon_host: m?.icon_host || mod.icon_host,
        parent_icon_host: m?.parent_icon_host || mod.parent_icon_host,
      };
    });

    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local?.set) {
      await chromeAny.storage.local.set({
        installed_modules: enriched,
        modules_metadata: metaMap,
        last_module_fetch_timestamp: Date.now()
      });
    }
    return enriched;
  } catch (err) {
    console.warn('[Sync] Failed to sync installed modules to storage:', err);
    return [];
  }
};

/**
 * Install a module for the user.
 */
export const installModule = async (
  moduleId: string,
  options?: {
    scope?: 'user' | 'org';
    org_id?: string | null;
    version?: string;
    settings?: Record<string, any>;
    hotkey?: string | null;
    is_favourite?: boolean;
    is_enabled?: boolean;
  },
) => {
  const userId = await getUserId();
  let resolvedMode: 'local' | 'cloud' = 'cloud';
  if (options?.org_id) {
    const res = await StorageManager.getInstance().resolveStorageMode({
      isNew: false,
      orgId: options.org_id,
    });
    resolvedMode = res.storageMode;
  }
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.installModule(userId, moduleId, options);
  incrementUserRefreshCounter();
  await syncInstalledModulesToStorage();
  return result;
};

/**
 * Uninstall a module for the user.
 */
export const uninstallModule = async (moduleId: string) => {
  const userId = await getUserId();
  let resolvedMode: 'local' | 'cloud' = 'cloud';
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const cache = await chromeAny.storage.local.get(['installed_modules']);
      const list = cache.installed_modules || [];
      const match = list.find((m: any) => String(m.module_id) === String(moduleId) || String(m.id) === String(moduleId));
      if (match && match.org_id) {
        const res = await StorageManager.getInstance().resolveStorageMode({
          isNew: false,
          orgId: match.org_id,
        });
        resolvedMode = res.storageMode;
      }
    }
  } catch {}
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.uninstallModule(userId, moduleId);
  incrementUserRefreshCounter();
  await syncInstalledModulesToStorage();
  
  // Cleanup local ghost todos
  cleanupLocalTodosAfterDelete([String(moduleId)]);
  
  return result;
};

/**
 * Update an existing module installation (hotkey, favourite, etc.).
 */
export const updateInstallation = async (
  moduleId: string,
  installationId: number,
  data: {
    hotkey?: string | null;
    is_favourite?: boolean;
    is_enabled?: boolean;
    settings?: Record<string, any>;
  },
) => {
  const userId = await getUserId();
  let resolvedMode: 'local' | 'cloud' = 'cloud';
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const cache = await chromeAny.storage.local.get(['installed_modules']);
      const list = cache.installed_modules || [];
      const match = list.find((m: any) => String(m.module_id) === String(moduleId) || String(m.id) === String(moduleId));
      if (match && match.org_id) {
        const res = await StorageManager.getInstance().resolveStorageMode({
          isNew: false,
          orgId: match.org_id,
        });
        resolvedMode = res.storageMode;
      }
    }
  } catch {}
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateModuleInstallation(userId, moduleId, installationId, data);
  incrementUserRefreshCounter();
  await syncInstalledModulesToStorage();
  return result;
};

/**
 * Fetch modules currently installed by the user (including full execution JSON).
 */
export const getInstalledModules = async () => {
  const userId = await getUserId();
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  let localMods: any[] = [];
  try {
    const res = await localProvider.getInstalledModules(userId);
    localMods = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch {}

  let cloudMods: any[] = [];
  try {
    if (userId && userId !== 'local_user') {
      const res = await cloudProvider.getInstalledModules(userId);
      cloudMods = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    }
  } catch {}

  const merged = [...localMods];
  const localIds = new Set(localMods.map((m: any) => String(m.module_id)));
  for (const m of cloudMods) {
    if (m && m.module_id && !localIds.has(String(m.module_id))) {
      merged.push(m);
    }
  }
  return merged;
};

/**
 * Fetch favorited modules currently installed by the user.
 */
export const getFavoritedModules = async (userId: string) => {
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  let localFavs: any[] = [];
  try {
    const res = await localProvider.getFavoritedModules(userId);
    localFavs = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch {}

  let cloudFavs: any[] = [];
  try {
    if (userId && userId !== 'local_user') {
      const res = await cloudProvider.getFavoritedModules(userId);
      cloudFavs = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    }
  } catch {}

  const merged = [...localFavs];
  const localIds = new Set(localFavs.map((m: any) => String(m.module_id)));
  for (const m of cloudFavs) {
    if (m && m.module_id && !localIds.has(String(m.module_id))) {
      merged.push(m);
    }
  }
  return merged;
};

/**
 * Fetch detailed metadata for modules directly from the DB.
 * Includes description and description_meta as requested.
 */
export const fetchModuleMetadata = async () => {
  const url = `${SUPABASE_BASE_URL}/rest/v1/agent_modules?select=module_id,module_key,name,description,description_meta`;
  const headers = {
    apikey: SUPABASE_TOKEN,
    Authorization: `Bearer ${SUPABASE_TOKEN}`,
    'Accept-Profile': 'stripe_sync',
  };

  if (isContentScriptContext()) {
    return await bgRequest({ url, method: 'GET', headers });
  }

  const response = await axiosInstance.get(url, { headers });
  return response.data;
};

/**
 * Assign a hotkey to an installed module.
 */
export const assignModuleHotkey = async (moduleId: string, hotkey: string) => {
  const userId = await getUserId();
  let resolvedMode: 'local' | 'cloud' = 'cloud';
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const cache = await chromeAny.storage.local.get(['installed_modules']);
      const list = cache.installed_modules || [];
      const match = list.find((m: any) => String(m.module_id) === String(moduleId) || String(m.id) === String(moduleId));
      if (match && match.org_id) {
        const res = await StorageManager.getInstance().resolveStorageMode({
          isNew: false,
          orgId: match.org_id,
        });
        resolvedMode = res.storageMode;
      }
    }
  } catch {}
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateModuleCustomization(userId, moduleId, { hotkey });
  await syncInstalledModulesToStorage();
  return unbox(result);
};

/**
 * Remove a hotkey from an installed module.
 */
export const removeModuleHotkey = async (moduleId: string, hotkey = '') => {
  const userId = await getUserId();
  let resolvedMode: 'local' | 'cloud' = 'cloud';
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const cache = await chromeAny.storage.local.get(['installed_modules']);
      const list = cache.installed_modules || [];
      const match = list.find((m: any) => String(m.module_id) === String(moduleId) || String(m.id) === String(moduleId));
      if (match && match.org_id) {
        const res = await StorageManager.getInstance().resolveStorageMode({
          isNew: false,
          orgId: match.org_id,
        });
        resolvedMode = res.storageMode;
      }
    }
  } catch {}
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateModuleCustomization(userId, moduleId, { hotkey: '' });
  await syncInstalledModulesToStorage();
  return unbox(result);
};

/**
 * Mark an installed module as a favorite using the dedicated installation endpoint.
 * This is used separately after a successful installation.
 */
export const favoriteModule = async (moduleId: string) => {
  const userId = await getUserId();
  let resolvedMode: 'local' | 'cloud' = 'cloud';
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const cache = await chromeAny.storage.local.get(['installed_modules']);
      const list = cache.installed_modules || [];
      const match = list.find((m: any) => String(m.module_id) === String(moduleId) || String(m.id) === String(moduleId));
      if (match && match.org_id) {
        const res = await StorageManager.getInstance().resolveStorageMode({
          isNew: false,
          orgId: match.org_id,
        });
        resolvedMode = res.storageMode;
      }
    }
  } catch {}
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateModuleCustomization(userId, moduleId, { is_favourite: true });
  await syncInstalledModulesToStorage();
  return result;
};

/**
 * Reset all multi-tab synchronization timers.
 * Call this after any mutation (create/delete/update) to ensure all tabs
 * fetch fresh data on their next check, bypassing the 1-2 minute cooldowns.
 */
export const resetAllSyncTimers = async () => {
  const chromeAny = (window as any).chrome;
  if (chromeAny?.storage?.local) {
    const keysToRemove = [
      'last_todo_fetch_timestamp',
      'last_module_fetch_timestamp',
      'last_user_info_fetch_timestamp',
      'last_sub_fetch_timestamp',
      'last_user_counter_check_timestamp',
      'last_org_counter_check_timestamp',
      'last_counter_sync_timestamp',
      'last_cloud_fetch_timestamp',
      'data_changed_mode'
    ];

    // Also find and remove all per-org credit timers
    const allStorage = await chromeAny.storage.local.get(null);
    Object.keys(allStorage).forEach(key => {
      if (key.startsWith('last_credits_fetch_') || key.startsWith('credits_')) {
        keysToRemove.push(key);
      }
    });

    await chromeAny.storage.local.remove(keysToRemove);
  }
};

/**
 * Fetch detailed organization user and subscription metrics directly.
 */
export const getOrgUserDetail = async (orgId: string, userId: string): Promise<any> => {
  const url = CMDOS_ORG_USER_DETAIL_URL(orgId, userId);
  if (isContentScriptContext()) {
    return await bgRequest({ url, method: 'GET' });
  }
  const response = await axiosInstance.get(url);
  return response.data;
};

/**
 * Fetch organization members.
 */
export const getMembersInOrganization = async (orgId: string): Promise<any> => {
  const url = CMDOS_ORG_MEMBERS_URL(orgId);
  if (isContentScriptContext()) {
    return await bgRequest({ url, method: 'GET' });
  }
  const response = await axiosInstance.get(url);
  return response.data;
};

/**
 * Remove a member from the organization.
 */
export const removeMemberFromOrganization = async (orgId: string, userId: string): Promise<any> => {
  const path = `/org_management/org/${orgId}/members/${userId}`;
  if (isContentScriptContext()) {
    return await bgRequest({
      url: `${SUPABASE_BASE_URL}/functions/v1${path}`,
      method: 'DELETE',
    });
  }
  const response = await axiosInstance.delete(path);
  return response.data;
};

/**
 * Fetch daily credit usage data for a given user, year, and month.
 */
export const getUsageData = async (userId: string, year: number, month: number): Promise<any> => {
  const url = CMDOS_GET_USAGE_URL(userId, year, month);
  if (isContentScriptContext()) {
    return await bgRequest({ url, method: 'GET' });
  }
  const response = await axiosInstance.get(url);
  return response.data;
};



