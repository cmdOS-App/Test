import React, { useState, useEffect } from 'react';
import { FiX, FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectDarkMode, setSelectedTeam } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import CreditsCard from './CreditsRemaining';
import AccountDetailsCard from './AccountDetails';
import TeamMembersCard from './TeamMembersCard';
import UsageGraph from './UsageGraph';
import { getUserId } from '../../../../Apis/core/api';
import {
  getCreditBalance,
  getActiveSubscriptions,
  getOrgUserDetail,
  getMembersInOrganization,
  removeMemberFromOrganization,
  getUsageData,
} from '@private-services/subscriptionApi';

import { getAvatarColor, getInitials } from '../../utils/avatarColors';

interface ManageSubscriptionPanelProps {
  onClose: () => void;
}

const ManageSubscriptionPanel: React.FC<ManageSubscriptionPanelProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const allTeamsData = useSelector(selectAllData) || [];

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');

  const getOrgDisplayName = (team: any) => {
    if (!team) return 'Workspace';
    if (team.is_personal_space) return 'Personal';
    const name = (team.team_name || '').trim();
    if (name.toLowerCase() === 'workspace_1' || name.toLowerCase() === 'workspace 1') {
      return 'Personal';
    }
    return name;
  };
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [creditsData, setCreditsData] = useState<{
    credits_left: number;
    plan_id: string;
    isAdmin: boolean;
    email?: string;
    createdAt?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Set default selected organization (Personal Space)
  useEffect(() => {
    if (allTeamsData.length > 0 && !selectedOrgId) {
      const personalTeam = allTeamsData.find((t: any) => t.is_personal_space) || allTeamsData[0];
      setSelectedOrgId(personalTeam.team_id);
    }
  }, [allTeamsData, selectedOrgId]);

  // Fetch credit balance on load from API or Chrome local cache
  useEffect(() => {
    if (!selectedOrgId) return;

    let active = true;

    // Reset state immediately upon workspace switch to prevent stale display
    setCreditsData(null);
    setTeamMembers([]);
    setUsageData([]);
    setShowTeamDetails(false);

    const fetchCredits = async () => {
      try {
        setIsLoading(true);
        const uid = await getUserId();
        if (!uid) return;
        setCurrentUserId(uid);

        const currentOrgId = selectedOrgId;
        const cacheKey = `credits_${currentOrgId}`;
        const timeKey = `last_credits_fetch_${currentOrgId}`;
        const membersKey = `members_${currentOrgId}`;
        const usageKey = `usage_${currentOrgId}`;
        const planKey = `plan_${currentOrgId}`;
        const emailKey = `email_${currentOrgId}`;
        const createdKey = `created_${currentOrgId}`;

        // 1. Fetch user name and avatar from local storage
        if (active && typeof chrome !== 'undefined' && chrome.storage?.local) {
          const resInfo = await new Promise<any>((resolve) => {
            chrome.storage.local.get(['user_info', 'user_name'], resolve);
          });
          const nameValue = resInfo?.user_info?.name || resInfo?.user_name || '';
          const avatarValue = resInfo?.user_info?.image_url || '';
          if (active && nameValue) {
            setUserName(nameValue);
          }
          if (active && avatarValue) {
            setUserAvatar(avatarValue);
          }
        }

        // 2. Try checking Chrome storage first for a recent cache hit (within last 30 seconds)
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const cached = await new Promise<any>((resolve) => {
            chrome.storage.local.get([cacheKey, timeKey, membersKey, usageKey, planKey, emailKey, createdKey], resolve);
          });

          const lastFetch = cached?.[timeKey];
          if (active && lastFetch && (Date.now() - lastFetch < 30000)) {
            if (cached[cacheKey] !== undefined) {
              setCreditsData({
                credits_left: cached[cacheKey],
                plan_id: cached[planKey] || 'free_tier',
                isAdmin: true,
                email: cached[emailKey] || '',
                createdAt: cached[createdKey] || '',
              });
            }
            if (Array.isArray(cached[membersKey])) {
              setTeamMembers(cached[membersKey]);
            }
            if (Array.isArray(cached[usageKey])) {
              setUsageData(cached[usageKey]);
            }
            setIsLoading(false);
            return;
          }
        }

        let creditsLeft = 0;
        let planId = 'free_tier';
        let isAdmin = true;
        let email = '';
        let createdAt = '';

        try {
          const res = await getOrgUserDetail(currentOrgId, uid);
          if (res?.subscription) {
            creditsLeft = typeof res.subscription.credits_left === 'number' ? res.subscription.credits_left : 0;
            planId = res.subscription.plan_id || 'free_tier';
            isAdmin = res.subscription.is_admin ?? true;
            email = res.subscription.email || '';
            createdAt = res.organization?.created_at || '';
          } else {
            throw new Error('Direct endpoint missing subscription node');
          }
        } catch (e) {
          console.warn('[ManageSubscriptionPanel] Direct endpoint failed, attempting backups:', e);
          const subs = await getActiveSubscriptions(uid, currentOrgId || undefined);
          if (subs && subs.length > 0) {
            const orgSub = (subs.find((s: any) => s.organization_id === currentOrgId || s.org_id === currentOrgId) || subs[0]) as any;
            creditsLeft = typeof orgSub?.credits_left === 'number' ? orgSub.credits_left : 0;
            planId = orgSub?.plan_id || 'free_tier';
            isAdmin = orgSub?.is_admin ?? true;
            email = orgSub?.email || '';
            createdAt = orgSub?.created_time || '';
          } else {
            const info = await getCreditBalance(uid, currentOrgId || undefined);
            if (info) {
              if (info.credits !== undefined) creditsLeft = info.credits;
              else if (info.credits_left !== undefined) creditsLeft = info.credits_left;
              else if (info.user?.credits_left !== undefined) creditsLeft = info.user.credits_left;
              planId = info.plan_id || info.subscription?.plan_id || 'free_tier';
              isAdmin = info.is_admin ?? info.user?.is_admin ?? true;
              email = info.user?.email || info.email || '';
              createdAt = info.subscription?.created_time || info.created_time || '';
            }
          }
        }

        // Fetch organization members
        let membersList: any[] = [];
        try {
          const membersData = await getMembersInOrganization(currentOrgId);
          if (Array.isArray(membersData)) {
            membersList = membersData;
          } else if (membersData && Array.isArray(membersData.members)) {
            membersList = membersData.members;
          } else if (membersData && Array.isArray(membersData.data)) {
            membersList = membersData.data;
          }
        } catch (e) {
          console.warn('[ManageSubscriptionPanel] Failed to fetch organization members:', e);
        }

        // Fetch credit usage analytics
        let resUsage: any[] = [];
        if (active) {
          setIsLoadingUsage(true);
        }
        try {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const usageResponse = await getUsageData(uid, year, month);
          if (Array.isArray(usageResponse)) {
            resUsage = usageResponse;
          } else if (usageResponse && Array.isArray(usageResponse.data)) {
            resUsage = usageResponse.data;
          }
        } catch (e) {
          console.warn('[ManageSubscriptionPanel] Failed to fetch credit usage history:', e);
        } finally {
          if (active) {
            setIsLoadingUsage(false);
          }
        }

        if (active) {
          setTeamMembers(membersList);
          setUsageData(resUsage);
          const freshData = {
            credits_left: creditsLeft,
            plan_id: planId,
            isAdmin,
            email,
            createdAt,
          };
          setCreditsData(freshData);

          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({
              [cacheKey]: creditsLeft,
              [timeKey]: Date.now(),
              [membersKey]: membersList,
              [usageKey]: resUsage,
              [planKey]: planId,
              [emailKey]: email,
              [createdKey]: createdAt,
            });
          }
        }
      } catch (err) {
        console.error('[ManageSubscriptionPanel] Error fetching credits:', err);
        if (active) {
          setCreditsData({
            credits_left: 0,
            plan_id: 'free_tier',
            isAdmin: true,
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchCredits();

    return () => {
      active = false;
    };
  }, [selectedOrgId]);

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const handleManageTeamClick = () => {
    setShowTeamDetails(true);
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      const confirmDelete = window.confirm(`Are you sure you want to remove ${memberName || 'this member'} from the organization?`);
      if (!confirmDelete) return;

      setRemovingMemberId(memberId);
      await removeMemberFromOrganization(selectedOrgId || '', memberId);

      if (selectedOrgId && typeof chrome !== 'undefined' && chrome.storage?.local) {
        const membersKey = `members_${selectedOrgId}`;
        const updatedMembers = teamMembers.filter((m) => (m.user_id || m.id) !== memberId);
        await chrome.storage.local.set({ [membersKey]: updatedMembers });
      }

      setTeamMembers((prev) => prev.filter((m) => (m.user_id || m.id) !== memberId));
      alert(`Successfully removed ${memberName || 'member'} from organization`);
    } catch (e: any) {
      alert(e.message || "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'Member';
    const cleanRole = role.replace(/^Org:/i, '').trim();
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1).toLowerCase();
  };

  const handleLeaveOrg = async () => {
    try {
      const uid = await getUserId();
      if (!uid || !selectedOrgId) return;
      const confirmLeave = window.confirm("Are you sure you want to leave this organization?");
      if (!confirmLeave) return;

      await removeMemberFromOrganization(selectedOrgId, uid);

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const cacheKey = `credits_${selectedOrgId}`;
        const timeKey = `last_credits_fetch_${selectedOrgId}`;
        const membersKey = `members_${selectedOrgId}`;
        const usageKey = `usage_${selectedOrgId}`;
        const planKey = `plan_${selectedOrgId}`;
        const emailKey = `email_${selectedOrgId}`;
        const createdKey = `created_${selectedOrgId}`;
        
        await chrome.storage.local.remove([
          cacheKey,
          timeKey,
          membersKey,
          usageKey,
          planKey,
          emailKey,
          createdKey
        ]);
      }

      const personalTeam = allTeamsData.find((t: any) => t.is_personal_space) || allTeamsData[0];
      if (personalTeam) {
        dispatch(setSelectedTeam(personalTeam));
      }

      alert("Successfully left organization");
      onClose();
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "Failed to leave organization");
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-visible bg-transparent">
      {/* Main Right Content Panel */}
      <div
        className="flex-grow flex flex-col text-neutral-800 dark:text-white relative bg-transparent h-full w-full overflow-hidden"
        style={{
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
        }}
      >
        {/* Dashboard Content Grid */}
        <div className="flex-1 flex flex-col items-start justify-start gap-4 p-4 overflow-y-auto w-full custom-scrollbar">
          {isLoading && !creditsData ? (
            <div className="flex flex-col gap-6 w-full animate-pulse pr-6">
              <div className="flex flex-row flex-nowrap items-start justify-start gap-6 w-full overflow-x-auto pb-2 shrink-0">
                <div className="flex h-[180px] w-[240px] flex-col justify-between rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/80 dark:bg-neutral-800/20 p-6 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3 w-32">
                      <div className="h-4 bg-neutral-300 dark:bg-white/10 rounded w-full" />
                      <div className="h-8 bg-neutral-300 dark:bg-white/10 rounded w-3/4" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-neutral-300 dark:bg-white/10" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 bg-neutral-300 dark:bg-white/10 rounded w-full" />
                    <div className="h-4 bg-neutral-300 dark:bg-white/10 rounded w-1/3" />
                  </div>
                </div>
                <div className="flex h-[180px] w-[240px] flex-col justify-between rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/80 dark:bg-neutral-800/20 p-6 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3 w-32">
                      <div className="h-4 bg-neutral-300 dark:bg-white/10 rounded w-full" />
                      <div className="h-8 bg-neutral-300 dark:bg-white/10 rounded w-2/3" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-neutral-300 dark:bg-white/10" />
                  </div>
                  <div className="space-y-2 pt-4">
                    <div className="h-3 bg-neutral-300 dark:bg-white/10 rounded w-full" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            creditsData && (
              showTeamDetails ? (
                <div className="w-full transition-all duration-300 flex flex-col h-auto">
                  <div className="flex flex-row items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4 mb-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setShowTeamDetails(false)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 active:scale-95 transition-all duration-200 cursor-pointer"
                      >
                        <FiArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-textPrimary)] flex items-center gap-2">
                          Team Members
                          <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                            ({teamMembers.length} {teamMembers.length === 1 ? 'Member' : 'Members'})
                          </span>
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Members Table */}
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-white/5">
                          <th className="py-2.5 px-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">Member</th>
                          <th className="py-2.5 px-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">Email</th>
                          <th className="py-2.5 px-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">Role</th>
                          {creditsData.isAdmin && (
                            <th className="py-2.5 px-3 text-right text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                        {teamMembers.map((member, index) => {
                          const mId = member.user_id || member.id || `idx-${index}`;
                          const mEmail = member.email || member.email_address || '';
                          const mFirstName = member.first_name || '';
                          const mLastName = member.last_name || '';
                          const mName = [mFirstName, mLastName].filter(Boolean).join(' ') || mEmail.split('@')[0] || 'Unknown User';
                          const mAvatar = member.image_url || member.profile_image_url;
                          const mRole = formatRole(member.role || member.org_role);
                          const isSelf = mId === currentUserId;
                          const mIsAdmin = (member.role || member.org_role || '').toLowerCase().includes('admin');

                          return (
                            <tr key={mId} className="hover:bg-neutral-100/50 dark:hover:bg-white/5 transition-colors">
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  {mAvatar ? (
                                    <img
                                      src={mAvatar}
                                      alt={mName}
                                      className="h-8 w-8 rounded-full object-cover border border-neutral-200 dark:border-white/10 shadow-sm"
                                    />
                                  ) : (
                                    <div
                                      className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-white/10 ${getAvatarColor(mName || 'U')}`}
                                    >
                                      {getInitials(mFirstName, mLastName)}
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1">
                                      {mName}
                                      {isSelf && (
                                        <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400 select-none ml-1">
                                          (You)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-xs text-neutral-500 dark:text-neutral-400 font-medium select-all">
                                {mEmail || <span className="text-xs text-neutral-400 italic">No email</span>}
                              </td>

                              <td className="py-3 px-3 whitespace-nowrap">
                                {mIsAdmin ? (
                                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    Admin
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                    {mRole}
                                  </span>
                                )}
                              </td>

                              {creditsData.isAdmin && (
                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  {!isSelf && !mIsAdmin ? (
                                    <button
                                      disabled={removingMemberId === mId}
                                      onClick={() => handleRemoveMember(mId, mName)}
                                      className="inline-flex items-center justify-center p-1.5 rounded-lg border border-transparent text-neutral-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 dark:hover:text-red-400 dark:hover:bg-red-500/10 dark:hover:border-red-500/20 transition-all duration-200 disabled:opacity-50 active:scale-95 cursor-pointer"
                                      title={`Remove ${mName}`}
                                    >
                                      {removingMemberId === mId ? (
                                        <div className="h-3 w-3 animate-spin rounded-full border border-red-500 border-t-transparent" />
                                      ) : (
                                        <FiTrash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-neutral-400 dark:text-neutral-500 italic pr-3">—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  {/* Organizations Tab Selector inside Panel Content */}
                  <div className="flex flex-wrap items-center gap-3 mb-6 w-full">
                    <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase select-none mr-1">
                      Select Workspace:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {allTeamsData.map((team: any) => {
                        const teamName = getOrgDisplayName(team);
                        const isPersonal = team.is_personal_space || teamName === 'Personal';
                        const isActive = selectedOrgId === team.team_id;

                        return (
                          <button
                            key={team.team_id}
                            onClick={() => setSelectedOrgId(team.team_id)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_2px_8px_rgba(16,185,129,0.15)] scale-105'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold transition-colors ${
                              isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {isPersonal ? 'P' : (teamName || 'O').charAt(0).toUpperCase()}
                            </div>
                            <span>{teamName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horizontal Card Row */}
                  <div className="flex flex-row flex-nowrap items-stretch justify-start gap-4 w-full overflow-x-auto pb-2 shrink-0">
                    <CreditsCard
                      credits_left={creditsData.credits_left}
                      plan_id={creditsData.plan_id}
                      isAdmin={creditsData.isAdmin}
                    />

                    <AccountDetailsCard
                      userName={userName}
                      email={creditsData.email}
                      isAdmin={creditsData.isAdmin}
                      createdAt={creditsData.createdAt}
                      userAvatar={userAvatar}
                    />

                    <TeamMembersCard
                      displayTeamMembers={teamMembers}
                      isadmin={creditsData.isAdmin}
                      handleManageTeamClick={handleManageTeamClick}
                      onLeaveOrg={handleLeaveOrg}
                    />
                  </div>

                  {/* Credit Usage History Trend Graph */}
                  <div className="w-full shrink-0 mt-4">
                    <UsageGraph
                      usageData={usageData}
                      isLoadingUsage={isLoadingUsage}
                      organizationSubscription={{ plan_type: creditsData.plan_id }}
                      orgName={getOrgDisplayName(allTeamsData.find((t: any) => t.team_id === selectedOrgId))}
                      freeOrgId={selectedOrgId || ''}
                    />
                  </div>
                </>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageSubscriptionPanel;
