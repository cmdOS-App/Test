import { IStorageProvider } from './IStorageProvider';
import { CloudProvider } from './providers/CloudProvider';
import { LocalProvider } from './providers/LocalProvider';

/**
 * StorageManager
 *
 * Provides per-org provider routing:
 *
 *   org.storageMode === 'local'  → LocalProvider
 *   org.storageMode === 'cloud'
 *   or undefined                 → CloudProvider
 *
 * Usage:
 *   // Explicit per-org routing (preferred for new code)
 *   const provider = StorageManager.getInstance().getProviderForOrg(team.storageMode);
 *
 *   // Backward-compat global provider (legacy call sites)
 *   const provider = StorageManager.getInstance().getProvider();
 */
export class StorageManager {
  private static instance: StorageManager;

  // Singleton provider instances — reused, not recreated per call
  private readonly localProvider: LocalProvider;
  private readonly cloudProvider: CloudProvider;

  // Global fallback provider (used by legacy getProvider() call sites)
  private activeProvider: IStorageProvider;

  /** Resolves once the global provider has been determined from storage. */
  public readonly ready: Promise<void>;

  private constructor() {
    this.localProvider = new LocalProvider();
    this.cloudProvider = new CloudProvider();

    // Default to LocalProvider synchronously so no call is ever unrouted.
    this.activeProvider = this.localProvider;

    // Resolve the global provider from the access token asynchronously.
    this.ready = this.initGlobalProvider();
  }

  // ---------------------------------------------------------------------------
  // Per-org routing (the correct API for new code)
  // ---------------------------------------------------------------------------

  /**
   * Returns the correct provider for a specific org based on its storageMode.
   *
   * @param storageMode - team.storageMode from the Team interface
   */
  public getProviderForOrg(storageMode: 'local' | 'cloud' | undefined): IStorageProvider {
    return storageMode === 'local' ? this.localProvider : this.cloudProvider;
  }

  /**
   * Convenience getter — returns the singleton LocalProvider.
   * Use when you explicitly need to read local storage regardless of active org.
   */
  public getLocalProvider(): LocalProvider {
    return this.localProvider;
  }

  /**
   * Convenience getter — returns the singleton CloudProvider.
   * Use when you explicitly need to call the cloud API.
   */
  public getCloudProvider(): CloudProvider {
    return this.cloudProvider;
  }

  // ---------------------------------------------------------------------------
  // Global provider (legacy — backward compat for existing call sites)
  // ---------------------------------------------------------------------------

  /**
   * Returns the globally active provider.
   * Determined from the access token at init time and updated on login/logout.
   *
   * @deprecated Prefer getProviderForOrg(team.storageMode) for new code.
   */
  public getProvider(): IStorageProvider {
    return this.activeProvider;
  }

  /** Override the global provider directly (used by tests / migration). */
  public setProvider(provider: IStorageProvider): void {
    this.activeProvider = provider;
  }

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // ---------------------------------------------------------------------------
  // Internal — resolve global provider from access token
  // ---------------------------------------------------------------------------

  private async initGlobalProvider(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['accessToken', 'selectedTeamId', 'myCachedAllData']);
      const userId = result.accessToken;
      this.activeProvider = this.resolveActiveProvider(userId, result.selectedTeamId, result.myCachedAllData);
    } catch {
      this.activeProvider = this.localProvider;
    }

    // React to login/logout or selected team changes at runtime
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName === 'local') {
          if (changes.accessToken || changes.selectedTeamId || changes.myCachedAllData) {
            const result = await chrome.storage.local.get(['accessToken', 'selectedTeamId', 'myCachedAllData']);
            this.activeProvider = this.resolveActiveProvider(
              result.accessToken,
              result.selectedTeamId,
              result.myCachedAllData,
            );
          }
        }
      });
    }
  }

  private resolveActiveProvider(token: unknown, selectedTeamId: string | undefined, cachedData: any[] | undefined): IStorageProvider {
    if (!token || typeof token !== 'string' || !token.startsWith('user_') || token === 'local_user') {
      return this.localProvider;
    }
    
    // If we have a selected team, route based on its specific storage mode
    // If we have a selected team, route based on its specific storage mode
    if (selectedTeamId && Array.isArray(cachedData)) {
      const team = cachedData.find((t: any) => t.team_id === selectedTeamId);
      if (team) {
        return team.storageMode === 'local' ? this.localProvider : this.cloudProvider;
      }
    }

    return this.cloudProvider;
  }

  /**
   * Resolves the storage mode ('local' | 'cloud'), owning org ID, and resolution method.
   * If storageMode is explicitly passed, it is respected.
   * Otherwise, it searches the cache (myCachedAllData) for the entity or its parents.
   * If not found and isNew is false, it triggers a second-chance cache refresh from source.
   * If still not found and isNew is true, it falls back to the selectedTeamId storageMode.
   */
  public async resolveStorageMode(params: {
    storageMode?: 'local' | 'cloud';
    isNew: boolean;
    snippetId?: string | null;
    folderId?: string | null;
    workspaceId?: string | null;
    orgId?: string | null;
    automationId?: string | null;
    userId?: string | null;
  }): Promise<ResolvedStorageMode> {
    const { storageMode, isNew, snippetId, folderId, workspaceId, orgId, automationId, userId } = params;

    console.log('[StorageManager.resolveStorageMode] Input context:', {
      storageMode,
      isNew,
      snippetId,
      folderId,
      workspaceId,
      orgId,
      automationId,
      userId,
    });

    // 1. Resolve local/offline user first. If the user is offline/local, route to local immediately.
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      try {
        const tokenRes = await chrome.storage.local.get('accessToken');
        effectiveUserId = tokenRes.accessToken;
      } catch (err) {
        effectiveUserId = 'local_user';
      }
    }

    if (!effectiveUserId || effectiveUserId === 'local_user' || typeof effectiveUserId !== 'string' || !effectiveUserId.startsWith('user_')) {
      const localResult: ResolvedStorageMode = {
        storageMode: 'local',
        orgId: 'local',
        resolvedBy: 'fallback',
      };
      console.log('[StorageManager.resolveStorageMode] Offline/local user detected, forcing local storage:', localResult);
      return localResult;
    }

    if (isNew && storageMode) {
      const result: ResolvedStorageMode = {
        storageMode,
        orgId: orgId || 'explicit',
        resolvedBy: 'org',
      };
      console.log('[StorageManager.resolveStorageMode] Resolved via explicit storageMode:', result);
      return result;
    }

    const tryLookup = (cachedOrgs: any[]): ResolvedStorageMode | null => {
      // Helper: recursive folder search
      const hasFolder = (folders: any[], id: string): boolean => {
        for (const f of folders) {
          if (String(f.folder_id) === id) return true;
          if (f.folders && hasFolder(f.folders, id)) return true;
        }
        return false;
      };

      // Helper: recursive snippet search
      const hasSnippetInFolders = (folders: any[], id: string): boolean => {
        for (const f of folders) {
          if (f.snippets?.some((s: any) => String(s.id || s.snippet_id) === id)) return true;
          if (f.folders && hasSnippetInFolders(f.folders, id)) return true;
        }
        return false;
      };

      // Helper: recursive automation search
      const hasAutomationInFolders = (folders: any[], id: string): boolean => {
        for (const f of folders) {
          if (f.automations?.some((a: any) => String(a.id) === id)) return true;
          if (f.folders && hasAutomationInFolders(f.folders, id)) return true;
        }
        return false;
      };

      // 1. If we have orgId, look it up directly
      if (orgId) {
        const org = cachedOrgs.find(o => String(o.team_id) === String(orgId));
        if (org) {
          return {
            storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
            orgId: String(org.team_id),
            resolvedBy: 'org',
          };
        }
      }

      // 2. If we have workspaceId, find the workspace and get its org's storageMode
      if (workspaceId) {
        const org = cachedOrgs.find(o =>
          o.workspaces?.some((w: any) => String(w.workspace_id) === String(workspaceId))
        );
        if (org) {
          return {
            storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
            orgId: String(org.team_id),
            resolvedBy: 'workspace',
          };
        }
      }

      // 3. If we have folderId, find the folder and get its org's storageMode
      if (folderId) {
        const org = cachedOrgs.find(o =>
          o.workspaces?.some((w: any) => hasFolder(w.folders || [], String(folderId)))
        );
        if (org) {
          return {
            storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
            orgId: String(org.team_id),
            resolvedBy: 'folder',
          };
        }
      }

      // 4. If we have snippetId, find the snippet and get its org's storageMode
      if (snippetId) {
        const targetSnippetId = String(snippetId);
        for (const org of cachedOrgs) {
          for (const ws of org.workspaces || []) {
            const inWs = ws.workspace_snippets?.some((s: any) => String(s.id || s.snippet_id) === targetSnippetId);
            if (inWs) {
              return {
                storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
                orgId: String(org.team_id),
                resolvedBy: 'snippet',
              };
            }

            if (hasSnippetInFolders(ws.folders || [], targetSnippetId)) {
              return {
                storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
                orgId: String(org.team_id),
                resolvedBy: 'snippet',
              };
            }
          }
        }
      }

      // 5. If we have automationId, find the automation and get its org's storageMode
      if (automationId) {
        const targetAutomationId = String(automationId);
        for (const org of cachedOrgs) {
          for (const ws of org.workspaces || []) {
            const inWs = ws.workspace_automations?.some((a: any) => String(a.id) === targetAutomationId);
            if (inWs) {
              return {
                storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
                orgId: String(org.team_id),
                resolvedBy: 'automation',
              };
            }

            if (hasAutomationInFolders(ws.folders || [], targetAutomationId)) {
              return {
                storageMode: org.storageMode === 'local' ? 'local' : 'cloud',
                orgId: String(org.team_id),
                resolvedBy: 'automation',
              };
            }
          }
        }
      }

      return null;
    };

    try {
      const result = await chrome.storage.local.get(['myCachedAllData', 'selectedTeamId']);
      const cachedOrgs: any[] = result.myCachedAllData || [];
      const selectedTeamId = result.selectedTeamId;

      let resolved = tryLookup(cachedOrgs);
      if (resolved) {
        console.log('[StorageManager.resolveStorageMode] Resolved from cache lookup:', resolved);
        return resolved;
      }

      // Second-chance: Force-reload from source if lookup misses for existing entity
      if (!isNew) {
        try {
          const { getAll } = await import('../core/api');
          const freshOrgs = await getAll(true);
          if (Array.isArray(freshOrgs) && freshOrgs.length > 0) {
            await chrome.storage.local.set({ myCachedAllData: freshOrgs });
            resolved = tryLookup(freshOrgs);
            if (resolved) {
              console.log('[StorageManager.resolveStorageMode] Resolved from cache lookup after second-chance refresh:', resolved);
              return resolved;
            }
          }
        } catch (reloadErr) {
          console.warn('[StorageManager.resolveStorageMode] Second-chance reload failed:', reloadErr);
        }
      }

      if (!isNew && storageMode) {
        const result: ResolvedStorageMode = {
          storageMode,
          orgId: orgId || 'explicit',
          resolvedBy: 'org',
        };
        console.log('[StorageManager.resolveStorageMode] Resolved from explicit fallback storageMode:', result);
        return result;
      }

      // Fallback ONLY for creating new entities
      if (isNew && selectedTeamId) {
        const activeOrg = cachedOrgs.find(o => String(o.team_id) === String(selectedTeamId));
        if (activeOrg) {
          const result: ResolvedStorageMode = {
            storageMode: activeOrg.storageMode === 'local' ? 'local' : 'cloud',
            orgId: String(activeOrg.team_id),
            resolvedBy: 'fallback',
          };
          console.log('[StorageManager.resolveStorageMode] Resolved via active team fallback:', result);
          return result;
        }
      }
    } catch (err) {
      console.warn('[StorageManager.resolveStorageMode] Execution failed:', err);
    }

    if (!isNew) {
      const entityInfo = JSON.stringify({ snippetId, folderId, workspaceId, orgId, automationId });
      console.error('[StorageManager.resolveStorageMode] Failed to resolve storage mode for existing entity:', entityInfo);
      throw new Error(`Failed to resolve storage mode for existing entity. Context: ${entityInfo}`);
    }

    // Default to cloud for new entities ifselectedTeamId lookup failed
    const defaultResult: ResolvedStorageMode = {
      storageMode: 'cloud',
      orgId: 'unknown',
      resolvedBy: 'fallback',
    };
    console.log('[StorageManager.resolveStorageMode] Default fallback resolved:', defaultResult);
    return defaultResult;
  }
}

export interface ResolvedStorageMode {
  storageMode: 'local' | 'cloud';
  orgId: string;
  resolvedBy: 'org' | 'workspace' | 'folder' | 'snippet' | 'automation' | 'fallback';
}
