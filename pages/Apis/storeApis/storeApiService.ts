
import { bgGet, bgRequest, isContentScriptContext } from '../core/bgFetch';
import { getUserId } from '../../Apis/core/api';
import { cleanupLocalTodosAfterDelete } from '../../Apis/features/snippetApi';
import { StorageManager } from '../storage/StorageManager';

export interface StoreModuleUser {
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url: string;
}

export interface StoreModuleReview {
  rating_id: number;
  rating: number;
  review: string;
  created_at: string;
  user: StoreModuleUser;
}

export interface StoreModuleRatingSummary {
  average_rating: number;
  rating_count: number;
  reviews: StoreModuleReview[];
}

export interface StoreModuleCategory {
  name: string;
  description: string;
  execution_engine: string;
  created_at: string;
  updated_at: string;
  category_id: number;
}

export interface StoreModule {
  module_id: number;
  name: string;
  description: string;
  icon_url: string;
  version: string;
  publisher_name: string;
  publisher_email: string | null;
  publisher_type: string;
  publisher_user_id: string | null;
  requires_subscription: boolean;
  is_verified: boolean;
  is_listed: boolean;
  tags: string[];
  public_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  category_id: number;
  category: StoreModuleCategory;
  rating_summary: StoreModuleRatingSummary;
  is_installed: boolean;
  is_connected: boolean;
  connection_api: string | null;
  installation_id?: number | null;
}

export interface StoreApiResponse {
  data: StoreModule[];
}

export interface CommandApiSpec {
  path: string;
  method: string;
}

export interface Command {
  command_id: string;
  module_id: number;
  command_key: string;
  label: string;
  prefix: string;
  url_template: string | null;
  api_spec: CommandApiSpec;
  input_schema: unknown | null;
  search_keywords: string[];
  icon_host: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ModuleByIdResponse {
  module: StoreModule;
  commands: Command[];
}

export interface InstallationModule {
  module_id: number;
  module_key?: string;
  slug?: string;
  name: string;
  description: string;
  icon_url: string;
  version: string;
  publisher_name: string;
  publisher_email: string | null;
  publisher_type: string;
  publisher_user_id: string | null;
  requires_subscription: boolean;
  is_verified: boolean;
  is_listed: boolean;
  tags: string[];
  public_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  category_id: number;
  category: StoreModuleCategory;
}

export interface Installation {
  id: number;
  module_id: number | string;
  user_id: string;
  org_id: string | null;
  scope: string;
  version: string;
  hotkey: string | null;
  settings: Record<string, unknown>;
  is_enabled: boolean;
  is_favourite: boolean;
  installed_at: string;
  updated_at: string;
  module: InstallationModule;
}

export interface InstallationsResponse {
  data: Installation[];
}

export const fetchStore = async (): Promise<StoreApiResponse> => {
  const response = await StorageManager.getInstance().getCloudProvider().fetchStore();
  return response as StoreApiResponse;
};

export const fetchModuleById = async (id: number): Promise<ModuleByIdResponse> => {
  const user_id = await getUserId();
  const response = await StorageManager.getInstance().getCloudProvider().fetchModuleById(user_id, id);
  return response as ModuleByIdResponse;
};

export interface InstallModuleResponse {
  id: number;
  module_id: string;
  installation_id?: number; // For backward compatibility if needed
}

export const installModule = async (
  module_id: number | string,
  options?: {
    scope?: 'user' | 'org';
    version?: string;
    settings?: Record<string, unknown>;
    hotkey?: string | null;
    is_favourite?: boolean;
    is_enabled?: boolean;
  },
  storageMode?: 'local' | 'cloud'
): Promise<InstallModuleResponse> => {
  const user_id = await getUserId();
  const payload = {
    scope: options?.scope || 'user',
    user_id: user_id,
    version: options?.version || '1.0.0',
    is_enabled: options?.is_enabled ?? true,
    ...options,
  };
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.installStoreModule(module_id, payload);
  // Provider returns the raw axios response data which is { data: InstallModuleResponse }
  return response.data;
};

export const getInstallations = async (): Promise<InstallationsResponse> => {
  const user_id = await getUserId();
  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  // Fetch local installations
  let localInstalls: any[] = [];
  try {
    const res = await localProvider.getInstallations(user_id);
    localInstalls = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
  } catch (err) {
    console.error('[getInstallations] Local fetch failed:', err);
  }

  // Fetch cloud installations
  let cloudInstalls: any[] = [];
  try {
    if (user_id && user_id !== 'local_user') {
      const res = await cloudProvider.getInstallations(user_id);
      cloudInstalls = res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    }
  } catch (err) {
    console.warn('[getInstallations] Cloud fetch failed, continuing with local only:', err);
  }

  // Merge and deduplicate by module_id
  const merged = [...localInstalls];
  const localModuleIds = new Set(localInstalls.map(i => String(i.module_id)));
  for (const i of cloudInstalls) {
    if (i && i.module_id && !localModuleIds.has(String(i.module_id))) {
      merged.push(i);
    }
  }

  return { data: merged };
};

/**
 * Updates an existing module installation (e.g., toggling is_favourite or updating hotkey).
 * @param moduleId - The ID of the module (UUID, Number, or Name/Key).
 * @param installationId - The unique ID of this specific installation instance.
 * @param data - The fields to update.
 */
export const updateInstallation = async (
  moduleId: number | string,
  installationId: number | string,
  data: Partial<Installation>,
  storageMode?: 'local' | 'cloud'
): Promise<any> => {
  const user_id = await getUserId();
  const numInstallationId = Number(installationId);

  const payload = {
    user_id,
    scope: 'user',
    ...data,
  };
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true, // Use fallback to get the current org's storage mode
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const response = await provider.updateStoreInstallation(moduleId, numInstallationId, payload);
  return response.data;
};

export const uninstallModule = async (moduleId: string | number, installationId: string | number, storageMode?: 'local' | 'cloud'): Promise<any> => {
  const numInstallationId = Number(installationId);
  
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.uninstallStoreModule(moduleId, numInstallationId);
  
  // Cleanup local ghost todos associated with this module
  cleanupLocalTodosAfterDelete([String(moduleId)]);
  
  return result;
};
