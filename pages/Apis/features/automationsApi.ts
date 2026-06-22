/**
 * automationsApi.ts
 *
 * API functions for the new /automations Supabase edge function.
 * This replaces the old /automation_agents/* endpoints for saved-automation CRUD
 * and adds native support for hotkeys, shortcuts, and is_favourite.
 *
 * Base: https://<PROJECT_REF>.supabase.co/functions/v1/automations
 *
 * All requests must include:
 *   apikey: SUPABASE_TOKEN
 *   authorization: Bearer SUPABASE_TOKEN
 *   content-type: application/json  (POST / PUT)
 */


import { cleanupLocalTodosAfterDelete } from './snippetApi';
import { StorageManager } from '../storage/StorageManager';



// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudAutomationStep {
  name: string;
  task: Record<string, any>;
  [key: string]: any;
}

/**
 * Shape returned by GET /automations and GET /automation_contents.
 * Also used as the canonical type for create / update responses.
 */
export interface CloudAutomation {
  id: string;
  title: string;
  description: string | null;
  url: string;
  icon: string;
  steps: CloudAutomationStep[];
  folder_id?: string | null;
  workspace_id?: string | null;
  hotkeys: string | null;
  shortcuts: string | null;
  is_favourite: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAutomationPayload {
  description: string;
  url: string;
  title: string;
  icon: string;
  steps: CloudAutomationStep[];
  /** Exactly one of folder_id or workspace_id must be provided */
  folder_id?: string | null;
  workspace_id?: string | null;
  hotkeys?: string | null;
  shortcuts?: string | null;
  is_favourite?: boolean;
}

export interface UpdateAutomationPayload {
  automation_id: string;
  title?: string;
  description?: string;
  url?: string;
  icon?: string;
  steps?: CloudAutomationStep[];
  hotkeys?: string | null;
  shortcuts?: string | null;
  is_favourite?: boolean;
}


// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * GET /automations?user_id=<USER_ID>
 * Returns all saved automations for the user, including hotkeys, shortcuts, is_favourite.
 */
export async function fetchSavedAutomations(userId: string, storageMode?: 'local' | 'cloud'): Promise<CloudAutomation[]> {
  if (storageMode) {
    const provider = StorageManager.getInstance().getProviderForOrg(storageMode);
    return provider.fetchSavedAutomations(userId);
  }

  const localProvider = StorageManager.getInstance().getLocalProvider();
  const cloudProvider = StorageManager.getInstance().getCloudProvider();

  // Fetch local automations
  let localAutos: CloudAutomation[] = [];
  try {
    const res = await localProvider.fetchSavedAutomations(userId);
    localAutos = Array.isArray(res) ? res : [];
  } catch (err) {
    console.error('[fetchSavedAutomations] Local fetch failed:', err);
  }

  // Fetch cloud automations
  let cloudAutos: CloudAutomation[] = [];
  try {
    if (userId && userId !== 'local_user') {
      const res = await cloudProvider.fetchSavedAutomations(userId);
      cloudAutos = Array.isArray(res) ? res : [];
    }
  } catch (err) {
    console.warn('[fetchSavedAutomations] Cloud fetch failed, continuing with local only:', err);
  }

  // Merge and deduplicate by id
  const merged = [...localAutos];
  const localIds = new Set(localAutos.map(a => String(a.id)));
  for (const a of cloudAutos) {
    if (a && a.id && !localIds.has(String(a.id))) {
      merged.push(a);
    }
  }

  return merged;
}

export async function fetchAutomationContents(userId: string, automationId: string, storageMode?: 'local' | 'cloud'): Promise<CloudAutomation> {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    automationId: automationId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.fetchAutomationContents(userId, automationId);
}

export async function createCloudAutomation(
  userId: string,
  payload: CreateAutomationPayload,
  storageMode?: 'local' | 'cloud'
): Promise<CloudAutomation> {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
    workspaceId: payload.workspace_id,
    folderId: payload.folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.createAutomation(userId, payload);
}

export async function updateAutomationRealtime(
  userId: string,
  payload: UpdateAutomationPayload,
  storageMode?: 'local' | 'cloud'
): Promise<CloudAutomation> {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    automationId: payload.automation_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.updateAutomation(userId, payload);
}

export async function deleteAutomationInstance(userId: string, automationIdOrIds: string | string[], storageMode?: 'local' | 'cloud'): Promise<void> {
  const targetId = Array.isArray(automationIdOrIds) ? automationIdOrIds[0] : automationIdOrIds;
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    automationId: targetId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  await provider.deleteAutomation(userId, automationIdOrIds);
  const idsToDelete = Array.isArray(automationIdOrIds) ? automationIdOrIds : [automationIdOrIds];
  cleanupLocalTodosAfterDelete(idsToDelete);
}

export async function updateInputOverride(userId: string, moduleId: number, config: any, storageMode?: 'local' | 'cloud'): Promise<any> {
  let resolvedOrgId: string | null = null;
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const result = await chromeAny.storage.local.get('installed_modules');
      const modules = result.installed_modules || [];
      const match = modules.find((m: any) => 
        Number(m.module_internal_id) === moduleId || 
        Number(m.id) === moduleId || 
        String(m.module_id) === String(moduleId)
      );
      if (match && match.org_id) {
        resolvedOrgId = match.org_id;
      }
    }
  } catch (err) {
    console.warn('[updateInputOverride] Failed to lookup module ownership:', err);
  }

  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: !resolvedOrgId,
    orgId: resolvedOrgId,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  return provider.updateInputOverride(userId, moduleId, config);
}
