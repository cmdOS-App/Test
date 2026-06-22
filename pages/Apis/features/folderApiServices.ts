import { getUserId } from '../core/api';
import { axiosInstance } from '../core/axiosInstance';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { StorageManager } from '../storage/StorageManager';

export interface NewShareFolder {
  org_id: string | undefined;
  workspace_id: string | undefined;
  access_code: FolderAccess;
  name: string;
}

export enum FolderAccess {
  PRIVATE = 1,
  PUBLIC = 2,
}

export const createSharedFolder = async (shareFolders: NewShareFolder, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const payload = {
    name: shareFolders.name,
    user_id: userId,
    org_id: shareFolders.org_id,
    workspace_id: shareFolders.workspace_id,
    access_code: shareFolders.access_code,
  };
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
    workspaceId: shareFolders.workspace_id,
    orgId: shareFolders.org_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.createFolder(payload);
  incrementOrgRefreshCounter();
  return result;
};

export const deleteSharedFolder = async (folder_id: string, org_id: string, workspace_id: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
    workspaceId: workspace_id,
    orgId: org_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.deleteFolder(folder_id, org_id, workspace_id);
  incrementOrgRefreshCounter();
  return result;
};

export const updateSharedFolder = async (folder_id: string, name: string, org_id: string, workspace_id: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
    workspaceId: workspace_id,
    orgId: org_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateFolder(folder_id, name, org_id, workspace_id);
  incrementOrgRefreshCounter();
  return result;
};

export const updateFolderCustomization = async (folder_id: string, icon?: string | null, color?: string | null, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const payload = {
    folder_id,
    user_id: userId,
    ...(icon !== undefined && { icon }),
    ...(color !== undefined && { color }),
  };
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    folderId: folder_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateFolderCustomization(payload);
  incrementOrgRefreshCounter();
  return result;
};
