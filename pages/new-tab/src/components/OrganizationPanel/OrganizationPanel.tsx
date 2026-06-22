import React, { useEffect, useState, useMemo } from 'react';
import { FiChevronDown, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { MdAdminPanelSettings } from 'react-icons/md';
import { LuPlus } from 'react-icons/lu';
import { getMembersInOrganization } from '../../../../Apis/features/workspaceApiServices';
import { getUserId } from '../../../../Apis/core/api';
import { getAvatarColor, getInitials, getSingleInitial } from '../../utils/avatarColors';
import {
  getOrganizationInvitations,
  acceptInvitation,
  rejectInvitation,
  removeMemberFromOrganization,
  Invitation,
  InvitationPagination,
} from '../../../../Apis/services/orgservices';

import { FaTrash } from 'react-icons/fa';
import { BsPeopleFill } from 'react-icons/bs';
import { Team } from '../../../../modals/interfaces';
import InviteMembersPopup from '@private-features/InviteMembersPopup';
import { fetchAllDataThunk } from '../../../../Redux/AllData/allDataSlice';
import { useDispatch } from 'react-redux';
import { store } from '../../../../Redux/store';
import { incrementOrgRefreshCounter } from '@private-services/refreshCounterService';
import { useSelector } from 'react-redux';
import { selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import JoinLinksPanel from '@private-features/JoinLinksPanel';
import { FiLink } from 'react-icons/fi';
import { FEATURE_FLAGS } from '../../utils/featureFlags';

interface OrganizationMember {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  image_url?: string;
  role: 'admin' | 'editor' | 'viewer' | 'contributor';
}

interface OrganizationPanelProps {
  orgId: string;
  orgName: string;
  onClose?: () => void;
  onSave?: () => void;
  teams?: Team[];
  onOrgSwitch?: (orgId: string, orgName: string) => void;
  onCreateOrg?: () => void;
}

const INVITATIONS_PER_PAGE = 8;
const Shortcut = ({ keys }: { keys: string[] }) => {
  const isMac = useSelector(selectIsMac);

  return (
    <span className="flex items-center gap-0.5 text-[8px]">
      {keys.map((k, i) => {
        let display = k;
        if (k === 'Ctrl' && isMac) display = '⌘';
        if (k === 'Enter') display = 'Enter'; // Keep full text
        return (
          <span
            key={i}
            className="rounded border border-neutral-200 dark:border-white/20 bg-[var(--color-containerBg)] px-1 font-medium text-neutral-500 dark:text-neutral-400">
            {display}
          </span>
        );
      })}
    </span>
  );
};
const OrganizationPanel: React.FC<OrganizationPanelProps> = ({
  orgId,
  orgName: initialOrgName,
  onClose,
  onSave,
  teams,
  onOrgSwitch,
  onCreateOrg,
}) => {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState('');

  // Editable fields
  const [editedOrgName, setEditedOrgName] = useState(initialOrgName);
  const [editedAdminName, setEditedAdminName] = useState('');
  const [isEditingOrgName, setIsEditingOrgName] = useState(false);
  const [isEditingAdminName, setIsEditingAdminName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Pending invitations state
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationPage, setInvitationPage] = useState(1);
  const [invitationPagination, setInvitationPagination] = useState<InvitationPagination | null>(null);

  // Remove member state
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);

  // Role dropdown state
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);

  // Invite popup state
  const [showInvitePopup, setShowInvitePopup] = useState(false);

  // Join Links popup state
  const [showJoinLinksPopup, setShowJoinLinksPopup] = useState(false);

  const dispatch = useDispatch();
  // Fetch current user ID to check admin status
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const userId = await getUserId();
        setCurrentUserId(userId);
      } catch (err) {
        console.error('Failed to get user ID:', err);
      }
    };
    fetchUserId();
  }, []);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    if (!currentUserId || !members.length) return false;
    const currentMember = members.find(m => m.user_id === currentUserId);
    if (!currentMember?.role) return false;
    return currentMember.role.toLowerCase().includes('admin');
  }, [currentUserId, members]);

  // Check if this is the personal space
  const isPersonalSpace = useMemo(() => {
    if (orgId?.startsWith('free_org_')) return true;
    const currentTeam = teams?.find(t => t.team_id === orgId);
    return currentTeam?.is_personal_space === true || orgId?.toLowerCase() === 'workspace_1' || orgId?.toLowerCase() === 'workspace 1';
  }, [orgId, teams]);

  // Fetch organization members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const data = await getMembersInOrganization(orgId);
        if (data?.members) {
          setMembers(data.members);
        } else if (Array.isArray(data)) {
          setMembers(data);
        }
      } catch (err: any) {
        console.error('Failed to fetch org members:', err);
        setError(err?.message || 'Failed to load members');
      } finally {
        setLoading(false);
      }
    };

    if (orgId) {
      fetchMembers();
    }
  }, [orgId]);

  // Fetch pending invitations (join requests)
  const fetchInvitations = async (page: number = 1) => {
    try {
      setInvitationsLoading(true);
      const response = await getOrganizationInvitations(orgId, {
        page_number: page,
        page_size: INVITATIONS_PER_PAGE,
        status: 'pending',
        type: 'REQ', // Only show join requests
      });
      setPendingInvitations(response.invitations);
      setInvitationPagination(response.pagination);
    } catch (err: any) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setInvitationsLoading(false);
    }
  };

  useEffect(() => {
    if (orgId && !isPersonalSpace) {
      fetchInvitations(invitationPage);
    }
  }, [orgId, invitationPage, isPersonalSpace]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close role dropdown on Escape
      if (e.key === 'Escape') {
        if (roleDropdownOpen) {
          setRoleDropdownOpen(null);
          e.preventDefault();
          return;
        }
        if (onClose) {
          e.preventDefault();
          onClose();
        }
      }
      // Ctrl + Enter (or Cmd + Enter) to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && hasChanges && isAdmin) {
        e.preventDefault();
        handleSave();
      }
    };

    // Close role dropdown when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('.role-dropdown-container')) {
          setRoleDropdownOpen(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, hasChanges, roleDropdownOpen]);

  // Get admin name and set initial value
  const adminName = useMemo(() => {
    const admin = members.find(m => m.role?.toLowerCase().includes('admin'));
    if (admin) {
      const name = [admin.first_name, admin.last_name].filter(Boolean).join(' ') || 'Admin';
      return name;
    }
    return 'Unknown';
  }, [members]);

  // Filter out personal space (only show organization teams)
  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    return teams.filter(team => team.is_personal_space !== true);
  }, [teams]);

  // Initialize edited admin name when members load
  useEffect(() => {
    if (adminName && !editedAdminName) {
      setEditedAdminName(adminName);
    }
  }, [adminName]);

  // Track changes
  useEffect(() => {
    const orgChanged = editedOrgName !== initialOrgName;
    const adminChanged = editedAdminName !== adminName && editedAdminName !== '';
    setHasChanges(orgChanged || adminChanged);
  }, [editedOrgName, editedAdminName, initialOrgName, adminName]);

  // Update editedOrgName when initialOrgName prop changes
  useEffect(() => {
    setEditedOrgName(initialOrgName);
  }, [initialOrgName]);

  // Format role for display
  const formatRole = (role: string) => {
    const cleanRole = role.replace(/^Org:/i, '').trim();
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1).toLowerCase();
  };

  // Check if a member can be removed (not admin and not self)
  const canRemoveMember = (member: OrganizationMember) => {
    if (!isAdmin) return false;
    if (member.user_id === currentUserId) return false;
    if (member.role?.toLowerCase().includes('admin')) return false;
    return true;
  };

  // Handle remove member
  const handleRemoveMember = async (member: OrganizationMember) => {
    try {
      setRemovingMemberId(member.user_id);
      await removeMemberFromOrganization(orgId, member.user_id);
      // Remove from local state
      setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
      setMemberToRemove(null);
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      setError(err?.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleSave = async () => {
    if (!hasChanges || !isAdmin) return;

    setIsSaving(true);
    try {
      // TODO: Implement API call to update org details
      

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setHasChanges(false);
      if (onSave) {
        onSave();
      }
    } catch (err: any) {
      console.error('Failed to save org details:', err);
      setError(err?.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--color-containerBg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center bg-[var(--color-containerBg)]">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden outline-none bg-[var(--color-containerBg)] rounded-xl border border-[var(--color-borderDefault)]">
      {/* Invite Members Popup */}
      {showInvitePopup && (
        <InviteMembersPopup
          orgId={orgId}
          orgName={editedOrgName}
          members={members}
          onClose={() => setShowInvitePopup(false)}
        />
      )}

      {/* Join Links Popup */}
      {showJoinLinksPopup && (
        <JoinLinksPanel orgId={orgId} isPopup={true} onClose={() => setShowJoinLinksPopup(false)} />
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-popupBg)] rounded-lg p-4 shadow-xl max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-[var(--color-textPrimary)] mb-2">Remove Member</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
              Are you sure you want to remove{' '}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {[memberToRemove.first_name, memberToRemove.last_name].filter(Boolean).join(' ') ||
                  memberToRemove.email ||
                  'this member'}
              </span>
              ? Their content will be reassigned to the admin.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-[var(--color-borderDefault)] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                Cancel
              </button>
              <button
                onClick={() => handleRemoveMember(memberToRemove)}
                disabled={removingMemberId === memberToRemove.user_id}
                className="px-3 py-1.5 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                {removingMemberId === memberToRemove.user_id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Main Content - Three Section Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Top Right - Team Icon and Create Invite Link */}
          <div className="absolute top-4 right-10 flex flex-col items-end gap-2 z-10">
            {/* Org Name and Avatar */}
            <div className="flex items-center gap-2 transition-opacity hover:opacity-100">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{editedOrgName}</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(editedOrgName)} text-sm font-semibold text-white`}>
                {editedOrgName.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Create Invite Link Button - Only visible for admins and not personal space */}
            {FEATURE_FLAGS.ENABLE_SHARING && isAdmin && !isPersonalSpace && (
              <button
                onClick={() => setShowJoinLinksPopup(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800">
                <FiLink size={12} />
                <span>Create Invite Link</span>
              </button>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:text-red-500 dark:hover:text-red-300 dark:hover:bg-red-800 z-20">
            <FiX size={16} />
          </button>

          {/* Left Panel - Organization Details */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar max-w-[350px] min-w-0">
            {/* Org Name Input */}
            <div className="mb-4 w-3/4">
              <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">Org Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={editedOrgName}
                  onChange={e => setEditedOrgName(e.target.value)}
                  disabled={!isAdmin}
                  title={!isAdmin ? 'Only admins can change' : undefined}
                  className="w-full text-sm font-medium text-neutral-800 dark:text-neutral-200 bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-lg px-3 py-2 outline-none focus:border-neutral-400 dark:focus:border-neutral-500 placeholder:text-neutral-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {isAdmin && (
                  <FiEdit2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)]" />
                )}
              </div>
            </div>

            {/* Members Container - Invite + Existing Members */}
            <div className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-3 mt-4">
              {/* Invite Members Search */}
              {FEATURE_FLAGS.ENABLE_SHARING && !isPersonalSpace && (
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[var(--color-borderDefault)]">
                  <svg
                    className="w-4 h-4 text-neutral-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Invite Members"
                    value={inviteSearch}
                    onChange={e => setInviteSearch(e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 bg-transparent text-sm outline-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 min-w-0"
                  />
                  <button
                    disabled={!isAdmin}
                    onClick={() => isAdmin && setShowInvitePopup(true)}
                    title={!isAdmin ? 'Only admins can change' : undefined}
                    className="text-xs font-medium px-3 py-1 rounded-md bg-neutral-700 text-white hover:bg-neutral-800 dark:bg-neutral-600 dark:hover:bg-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                    + Invite
                  </button>
                </div>
              )}

              {/* Existing Members List */}
              <h3 className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Existing Members</h3>
              <div className="space-y-1">
                {[...members]
                  .sort((a, b) => {
                    // Admin always on top
                    const aIsAdmin = a.role?.toLowerCase().includes('admin');
                    const bIsAdmin = b.role?.toLowerCase().includes('admin');
                    if (aIsAdmin && !bIsAdmin) return -1;
                    if (!aIsAdmin && bIsAdmin) return 1;
                    return 0;
                  })
                  .map((member, index) => {
                    const memberIsAdmin = member.role?.toLowerCase().includes('admin');
                    const isCurrentUser = member.user_id === currentUserId;
                    // Can change role if: current user is admin AND target is not admin AND target is not self
                    const canChangeRole = isAdmin && !memberIsAdmin && !isCurrentUser;

                    return (
                      <div key={member.user_id || index} className="flex items-center py-1.5 group">
                        {/* Left section: Avatar + Name + Badges - fixed max width for consistent dropdown alignment */}
                        <div className="flex items-center gap-2 min-w-0" style={{ width: '220px' }}>
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${getAvatarColor(member.first_name || 'U')} text-xs font-semibold text-white flex-shrink-0`}>
                            {getInitials(member.first_name, member.last_name)}
                          </div>
                          <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate max-w-[150px]">
                            {[member.first_name, member.last_name].filter(Boolean).join(' ') ||
                              member.email ||
                              'Unknown'}
                          </span>
                          {memberIsAdmin && (
                            <MdAdminPanelSettings className="text-yellow-500 flex-shrink-0" size={14} title="Admin" />
                          )}
                          {isCurrentUser && (
                            <span className="flex items-center justify-center h-5 px-1.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold flex-shrink-0">
                              You
                            </span>
                          )}
                        </div>

                        {/* Right section: Role display + Remove button */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="relative">
                            <div
                              className="flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border w-[80px] bg-[var(--color-containerBg)] border-[var(--color-borderDefault)] text-neutral-500 dark:text-neutral-400 cursor-default"
                              title={member.role}>
                              <span>{formatRole(member.role)}</span>
                            </div>
                          </div>
                          {FEATURE_FLAGS.ENABLE_SHARING && canRemoveMember(member) && (
                            <button
                              onClick={() => setMemberToRemove(member)}
                              disabled={removingMemberId === member.user_id}
                              className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                              title="Remove member">
                              {removingMemberId === member.user_id ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-neutral-400 border-t-transparent" />
                              ) : (
                                <FaTrash size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {members.length === 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] mt-2">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center flex-shrink-0">
                      <BsPeopleFill size={18} className="text-[var(--color-iconDefault)]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                        No members found
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Add email addresses above to send invitations.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Pending Join Requests */}
          {FEATURE_FLAGS.ENABLE_SHARING && isAdmin && !isPersonalSpace && (
            <div className="flex flex-col p-3 w-[260px] flex-shrink-0 overflow-y-auto custom-scrollbar ml-auto">
              {/* Pending Join Requests Card - aligned with Invite Members card */}
              <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-3 flex flex-col mt-[100px]">
                {/* Header */}
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pb-2 mb-2 border-b border-[var(--color-borderDefault)]">
                  Manage pending join requests
                </h3>

                {/* Pending Invitations Content */}
                <div className="flex-1 min-h-0">
                  {invitationsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-4 w-4 animate-spin rounded-full border border-neutral-300 border-t-neutral-600" />
                    </div>
                  ) : pendingInvitations.length === 0 ? (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">
                      No pending requests
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pendingInvitations.map(invitation => (
                        <div
                          key={invitation.invitation_id}
                          className="flex items-center gap-3 py-2 px-2 rounded-lg bg-[var(--color-containerBg)]">
                          {/* Avatar */}
                          <div
                            className={`w-8 h-8 rounded-full ${getAvatarColor(invitation.requester_name || invitation.email_address)} flex items-center justify-center text-xs font-semibold text-white flex-shrink-0`}>
                            {(invitation.requester_name || invitation.email_address || 'U').charAt(0).toUpperCase()}
                          </div>

                          {/* Name & Email */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                              {invitation.requester_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                              {invitation.email_address}
                            </p>
                          </div>

                          {/* Accept & Reject Buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              className="text-xs px-2 py-1 rounded-md bg-green-500 text-white hover:bg-green-600"
                              onClick={async () => {
                                try {
                                  await acceptInvitation(orgId, invitation.invitation_id);
                                  fetchInvitations(invitationPage);
                                } catch (err: any) {
                                  console.error('Failed to accept invitation:', err);
                                  setError(err?.message || 'Failed to accept invitation');
                                }
                              }}>
                              Accept
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-md border border-[var(--color-borderDefault)] text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                              onClick={async () => {
                                try {
                                  await rejectInvitation(orgId, invitation.invitation_id);
                                  fetchInvitations(invitationPage);
                                } catch (err: any) {
                                  console.error('Failed to reject invitation:', err);
                                  setError(err?.message || 'Failed to reject invitation');
                                }
                              }}>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {invitationPagination && invitationPagination.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--color-borderDefault)]">
                      <button
                        onClick={() => setInvitationPage(p => Math.max(1, p - 1))}
                        disabled={!invitationPagination.has_previous_page}
                        className={`text-[10px] px-2 py-0.5 rounded border border-[var(--color-borderDefault)] 
                                 transition-colors ${
                                   !invitationPagination.has_previous_page
                                     ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                                     : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                 }`}>
                        ← Prev
                      </button>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {invitationPagination.page_number} / {invitationPagination.total_pages}
                      </span>
                      <button
                        onClick={() => setInvitationPage(p => Math.min(invitationPagination.total_pages, p + 1))}
                        disabled={!invitationPagination.has_next_page}
                        className={`text-[10px] px-2 py-0.5 rounded border border-[var(--color-borderDefault)] 
                                 transition-colors ${
                                   !invitationPagination.has_next_page
                                     ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                                     : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                 }`}>
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Organizations List */}
        {filteredTeams.length > 0 && (
          <div className="w-[150px] flex flex-col border-l border-[var(--color-borderDefault)] bg-[var(--color-popupBg)]">
            {/* Header */}
            <div className="px-3 py-3 border-b border-[var(--color-borderDefault)]">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider">
                Your Organisations
              </span>
            </div>

            {/* Organizations List */}
            <div className="p-2 space-y-0.5 overflow-y-auto custom-scrollbar">
              {filteredTeams.map(team => {
                const isSelected = orgId === team.team_id;

                return (
                  <div
                    key={team.team_id}
                    onClick={() => onOrgSwitch?.(team.team_id, team.team_name)}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer duration-150 ${
                      isSelected
                        ? 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}>
                    {/* Org Avatar */}
                    <div
                      className={`w-6 h-6 rounded-full ${getAvatarColor(team.team_name)} opacity-60 flex items-center justify-center font-semibold text-[10px] text-white flex-shrink-0`}>
                      {getSingleInitial(team.team_name)}
                    </div>

                    {/* Org Name */}
                    <span className="text-sm truncate flex-1">{team.team_name}</span>

                    {/* Selected Indicator */}
                    {isSelected && <FiCheck size={16} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Divider above Create New */}
            <div className="border-t border-[var(--color-borderDefault)] mx-2 mt-1" />

            {/* Create Org Option */}
            <div className="p-2">
              <div
                onClick={() => onCreateOrg?.()}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer duration-150 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
                {/* Plus Icon */}
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                  <LuPlus size={12} className="text-purple-500 dark:text-purple-400" />
                </div>

                {/* Label */}
                <span className="text-sm">Create New</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]/75 px-3 py-1 text-[var(--color-textPrimary)] shadow-[0_4px_16px_rgba(124,110,245,0.15)] flex-shrink-0">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
            <span className="text-neutral-500 dark:text-neutral-400">Cancel</span>
            <Shortcut keys={['Esc']} />
          </button>
        </div>
        {/* Right section - Save button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || !isAdmin || isSaving}
          title={!isAdmin ? 'Only admins can change' : undefined}
          className={`flex items-center gap-3 rounded-xl border px-3 py-0.5 text-xs font-semibold shadow-[0_4px_14px_rgba(139,124,255,0.2)] ${
            !hasChanges || !isAdmin || isSaving
              ? 'cursor-not-allowed border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500'
              : 'border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff]'
          }`}>
          {isSaving ? (
            'Saving...'
          ) : (
            <>
              <span>Save</span>
              <span className="flex items-center gap-1 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                <span className="rounded-md border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0">
                  Ctrl
                </span>
                <span className="text-neutral-500 dark:text-neutral-300">+</span>
                <span className="rounded-md border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0">
                  Enter
                </span>
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OrganizationPanel;
