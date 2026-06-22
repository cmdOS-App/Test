import { fetchAllDataThunk } from '../../Redux/AllData/allDataSlice';
import { store } from '../../Redux/store';
import { getUserId, getUserName } from '../core/api';
import { axiosInstance } from '../core/axiosInstance';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { StorageManager } from '../storage/StorageManager';

// ==================== Organization API Services ====================

export interface CreateOrgRequest {
  org_name: string;
  created_by: string;
  max_allowed_seats?: number;
  image_url?: string;
}

export interface CreateOrgResponse {
  org_id: string;
  org_name: string;
  created_by: string;
  max_allowed_seats: number;
  image_url?: string;
}

/**
 * Create a new organization
 */
export const createOrganization = async (
  orgName: string,
  options?: {
    maxAllowedSeats?: number;
    imageUrl?: string;
    storageMode?: 'local' | 'cloud';
  },
): Promise<CreateOrgResponse> => {
  try {
    const userId = await getUserId();

    const requestBody: CreateOrgRequest = {
      org_name: orgName,
      created_by: userId,
      max_allowed_seats: options?.maxAllowedSeats ?? 10,
    };

    if (options?.imageUrl) {
      requestBody.image_url = options.imageUrl;
    }

    const sMode = options?.storageMode || 'cloud';
    const provider = StorageManager.getInstance().getProviderForOrg(sMode);
    const result = await provider.createOrganization(requestBody);
    store.dispatch(fetchAllDataThunk() as any);
    return result;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to create organization:', error);
    throw new Error(error?.response?.data?.message || 'Failed to create organization');
  }
};

/**
 * Update organization details
 */
export const updateOrganization = async (
  orgId: string,
  updates: {
    org_name?: string;
    image_url?: string;
    max_allowed_seats?: number;
  },
  storageMode?: 'local' | 'cloud',
): Promise<any> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const result = await provider.updateOrganization(orgId, updates);
    incrementOrgRefreshCounter();
    return result;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to update organization:', error);
    throw new Error(error?.response?.data?.message || 'Failed to update organization');
  }
};

/**
 * Delete an organization
 */
export const deleteOrganization = async (orgId: string, storageMode?: 'local' | 'cloud'): Promise<void> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    await provider.deleteOrganization(orgId);
    incrementOrgRefreshCounter();
  } catch (error: any) {
    console.error('[OrgAPI] Failed to delete organization:', error);
    throw new Error(error?.response?.data?.message || 'Failed to delete organization');
  }
};

export interface RemoveMemberResponse {
  success: boolean;
  message: string;
}

/**
 * Remove a member from the organization
 * Reassigns their content to the admin.
 * Note: Organization admins cannot be removed. Transfer admin role first.
 */
export const removeMemberFromOrganization = async (orgId: string, userId: string, storageMode?: 'local' | 'cloud'): Promise<RemoveMemberResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.removeMemberFromOrganization(orgId, userId);
    incrementOrgRefreshCounter();
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to remove member from organization:', error);
    throw new Error(error?.response?.data?.message || 'Failed to remove member from organization');
  }
};

/**
 * Invite a member to an organization
 */
export const inviteMemberToOrg = async (orgId: string, email: string, role: 'org:member', storageMode?: 'local' | 'cloud'): Promise<any> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.inviteMemberToOrg(orgId, email, role);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to invite member:', error);
    throw new Error(error?.response?.data?.message || 'Failed to invite member');
  }
};

// ==================== Join Links API ====================

export type JoinLinkType = 'OPEN' | 'APPROVAL';
export type JoinLinkStatus = 'active' | 'revoked' | 'expired';

export interface JoinLink {
  link_id: string;
  org_id: string;
  link_type: JoinLinkType;
  status: JoinLinkStatus;
  created_by: string;
  created_at: string;
  uses_count: number;
  expires_at?: string;
  max_uses?: number;
  join_link?: string; // Full URL from API response
}

export interface CreateJoinLinkRequest {
  link_type: JoinLinkType;
  created_by: string;
  expires_at?: string;
  max_uses?: number;
}

export interface CreateJoinLinkResponse {
  success: boolean;
  link_id: string;
  join_link: string;
  link_type: JoinLinkType;
  message: string;
}

export interface GetJoinLinksResponse {
  success: boolean;
  join_links: JoinLink[];
}

export interface RevokeJoinLinkResponse {
  success: boolean;
  message: string;
}

/**
 * Create a new join link for an organization
 * @param orgId - Organization ID
 * @param linkType - OPEN (auto-join) or APPROVAL (requires admin approval)
 * @param options - Optional parameters like expires_at and max_uses
 */
export const createJoinLink = async (
  orgId: string,
  linkType: JoinLinkType,
  options?: {
    expiresAt?: string;
    maxUses?: number;
  },
  storageMode?: 'local' | 'cloud'
): Promise<CreateJoinLinkResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.createJoinLink(orgId, linkType, options);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to create join link:', error);
    throw new Error(error?.response?.data?.message || 'Failed to create join link');
  }
};

/**
 * Get all active join links for an organization
 * @param orgId - Organization ID
 * @param status - Optional status filter (defaults to 'active')
 */
export const getJoinLinks = async (orgId: string, status: JoinLinkStatus = 'active', storageMode?: 'local' | 'cloud'): Promise<GetJoinLinksResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.getJoinLinks(orgId, status);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to get join links:', error);
    throw new Error(error?.response?.data?.message || 'Failed to get join links');
  }
};

/**
 * Revoke a join link so it can no longer be used
 * @param orgId - Organization ID
 * @param linkId - Join link ID to revoke
 */
export const revokeJoinLink = async (orgId: string, linkId: string, storageMode?: 'local' | 'cloud'): Promise<RevokeJoinLinkResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.revokeJoinLink(orgId, linkId);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to revoke join link:', error);
    throw new Error(error?.response?.data?.message || 'Failed to revoke join link');
  }
};

// ==================== Invitations API ====================

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type InvitationType = 'P2P' | 'REQ'; // P2P = admin invite, REQ = user join request

export interface Invitation {
  invitation_id: string;
  email_address: string;
  role: string;
  status: InvitationStatus;
  type: InvitationType;
  expires_at: string;
  created_at: string;
  inviter_user_id: string;
  requester_user_id: string | null;
  requester_name: string | null;
}

export interface InvitationPagination {
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface GetInvitationsResponse {
  success: boolean;
  invitations: Invitation[];
  pagination: InvitationPagination;
}

export interface GetInvitationsParams {
  page_number?: number;
  page_size?: number;
  status?: InvitationStatus;
  type?: InvitationType;
}

/**
 * Get organization invitations with pagination and filtering
 * @param orgId - Organization ID
 * @param params - Optional query parameters for pagination and filtering
 */
export const getOrganizationInvitations = async (
  orgId: string,
  params?: GetInvitationsParams,
  storageMode?: 'local' | 'cloud'
): Promise<GetInvitationsResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.getOrganizationInvitations(orgId, params);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to get organization invitations:', error);
    throw new Error(error?.response?.data?.message || 'Failed to get organization invitations');
  }
};

// ==================== Accept/Reject Invitation APIs ====================

export interface AcceptInvitationResponse {
  success: boolean;
  membership_id: string;
  subscription_id: string;
  message: string;
}

export interface RejectInvitationResponse {
  success: boolean;
  message: string;
}

/**
 * Accept a join request invitation
 * @param orgId - Organization ID
 * @param invitationId - Invitation ID to accept
 */
export const acceptInvitation = async (orgId: string, invitationId: string, storageMode?: 'local' | 'cloud'): Promise<AcceptInvitationResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.acceptInvitation(orgId, invitationId);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to accept invitation:', error);
    throw new Error(error?.response?.data?.message || 'Failed to accept invitation');
  }
};

/**
 * Reject/revoke an invitation
 * @param orgId - Organization ID
 * @param invitationId - Invitation ID to reject
 */
export const rejectInvitation = async (orgId: string, invitationId: string, storageMode?: 'local' | 'cloud'): Promise<RejectInvitationResponse> => {
  try {
    const { storageMode: resolvedMode } = await StorageManager.getInstance().resolveStorageMode({
      storageMode,
      isNew: false,
      orgId,
    });
    const provider = StorageManager.getInstance().getProviderForOrg(resolvedMode);
    const response = await provider.rejectInvitation(orgId, invitationId);
    return response;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to reject invitation:', error);
    throw new Error(error?.response?.data?.message || 'Failed to reject invitation');
  }
};

// ==================== Refresh Counter APIs ====================

export interface SetRefreshCounterRequest {
  org_id: string;
  counter_value: number;
}

export interface GetRefreshCountersResponse {
  success: boolean;
  data: Record<string, number>;
}

/**
 * Set the refresh counter value for an organization.
 * This is used to track and trigger refresh events across clients.
 */
export const setRefreshCounter = async (orgId: string, counterValue: number): Promise<void> => {
  try {
    const { storageMode } = await StorageManager.getInstance().resolveStorageMode({
      isNew: false,
      orgId,
    });

    if (storageMode === 'local') {
      // Local organization: Bypass network call. The refreshCounterService will handle storing the counter locally.
      return;
    }
    const provider = StorageManager.getInstance().getProviderForOrg(storageMode);
    await provider.setRefreshCounter(orgId, counterValue);
  } catch (error: any) {
    console.error('[OrgAPI] Failed to set refresh counter:', error);
    // Don't throw - this is a non-critical operation
  }
};

/**
 * Get refresh counter values for multiple organizations at once.
 * Returns a map of org_id -> counter_value
 */
export const getRefreshCounters = async (orgIds: string[]): Promise<Record<string, number>> => {
  try {
    const result: Record<string, number> = {};
    const cloudOrgIds: string[] = [];

    for (const id of orgIds) {
      const { storageMode } = await StorageManager.getInstance().resolveStorageMode({
        isNew: false,
        orgId: id,
      });
      if (storageMode === 'local') {
        result[id] = 0;
      } else {
        cloudOrgIds.push(id);
      }
    }

    if (cloudOrgIds.length > 0) {
      const provider = StorageManager.getInstance().getProviderForOrg('cloud');
      const response = await provider.getRefreshCounters(cloudOrgIds);
      if (response) {
        Object.assign(result, response);
      }
    }
    return result;
  } catch (error: any) {
    console.error('[OrgAPI] Failed to get refresh counters:', error);
    return {}; // Return empty on error - will fall back to full refresh
  }
};
