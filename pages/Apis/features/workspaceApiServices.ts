import { getUserId } from '../core/api';
import { v4 as uuidv4 } from 'uuid';
import { axiosInstance } from '../core/axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from '../core/bgFetch';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { StorageManager } from '../storage/StorageManager';
import { CMDOS_USER_WORKSPACE_URL, CMDOS_ORG_MEMBERS_URL_WITHOUT_WWW, CMDOS_REDIRECT_URL, CMDOS_CLERK_INVITE_URL } from '../core/apiConfig';

export const fetchWorkspaces = async (team_id: string) => {
  const { storageMode } = await StorageManager.getInstance().resolveStorageMode({
    isNew: false,
    orgId: team_id,
  });
  return await StorageManager.getInstance().getProviderForOrg(storageMode).fetchWorkspaces(team_id);
};

export const createNewWorkspace = async (
  channelName: string,
  channelType: 'public' | 'private' | 'shareonly',
  org_id: string,
  storageMode?: 'local' | 'cloud',
) => {
  const workspace_id = await uuidv4();
  const userId = await getUserId();
  const payload = {
    workspace_id: workspace_id,
    name: channelName,
    org_id: org_id,
    user_id: userId,
    type: channelType,
  };
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: true,
    orgId: org_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.createWorkspace(payload);
  incrementOrgRefreshCounter();
  return { ...result, workspace_id };
};

export const deleteSWorkspace = async (workspace_id: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const body = { workspace_id, user_id: userId } as const;
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.deleteWorkspace(body);
  incrementOrgRefreshCounter();
  return result;
};

export const editWorkspaceName = async (workspace_id: string, workspace_name: string, storageMode?: 'local' | 'cloud') => {
  const userId = await getUserId();
  const payload = { workspace_id, user_id: userId, new_name: workspace_name } as const;
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateWorkspace(payload);
  incrementOrgRefreshCounter();
  return result;
};

export const editWorkspaceType = async (workspace_id: string, workspace_type: 'public' | 'private' | 'shareonly', storageMode?: 'local' | 'cloud') => {
  const user_id = await getUserId();
  const payload = { workspace_id, user_id, type: workspace_type } as const;
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateWorkspace(payload);
  incrementOrgRefreshCounter();
  return result;
};

export const getWorkspaceDetails = async (workspace_id: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  return await StorageManager.getInstance().getProviderForOrg(resolvedMode).getWorkspaceDetails(workspace_id);
};

export const removeMemberFromWorkspace = async (user_id: string, workspace_id: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const result = await StorageManager.getInstance().getProviderForOrg(resolvedMode).removeMemberFromWorkspace(user_id, workspace_id);
  incrementOrgRefreshCounter();
  return result;
};

export const getMembersInOrganization = async (org_id: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    orgId: org_id,
  });
  return await StorageManager.getInstance().getProviderForOrg(resolvedMode).getMembersInOrganization(org_id);
};

export enum WorkspaceMemberAccess {
  Admin = 'admin',
  Member = 'member',
  EditAccess = 'editaccess',
  DeleteAccess = 'deleteaccess',
}

export const addMemberToWorkspace = async (user_id: string, workspace_id: string, role: WorkspaceMemberAccess, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const result = await StorageManager.getInstance().getProviderForOrg(resolvedMode).addMemberToWorkspace(user_id, workspace_id, role);
  incrementOrgRefreshCounter();
  return result;
};

export const changeMemberAccess = async (user_id: string, workspace_id: string, role: WorkspaceMemberAccess, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const result = await StorageManager.getInstance().getProviderForOrg(resolvedMode).changeMemberAccess(user_id, workspace_id, role);
  incrementOrgRefreshCounter();
  return result;
};

export const inviteMemberIntoOrganization = async (org_id: string, email: string, storageMode?: 'local' | 'cloud') => {
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    orgId: org_id,
  });
  const result = await StorageManager.getInstance().getProviderForOrg(resolvedMode).inviteMemberIntoOrganization(org_id, email);
  incrementOrgRefreshCounter();
  return result;
};

export const updateWorkspaceCustomization = async (
  workspace_id: string,
  icon?: string | null,
  color?: string | null,
  storageMode?: 'local' | 'cloud',
) => {
  const user_id = await getUserId();
  const payload = {
    workspace_id,
    user_id,
    ...(icon !== undefined && { icon }),
    ...(color !== undefined && { color }),
  };
  const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
    storageMode,
    isNew: false,
    workspaceId: workspace_id,
  });
  const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
  const result = await provider.updateWorkspaceCustomization(payload);
  incrementOrgRefreshCounter();
  return result;
};
