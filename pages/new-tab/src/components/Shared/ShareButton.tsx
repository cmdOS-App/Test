import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  FaShare,
  FaGlobe,
  FaLock,
  FaUsers,
  FaCheck,
  FaTimes,
  FaArrowLeft,
  FaPlus,
  FaChevronDown,
  FaUserPlus,
  FaEdit,
  FaTrashAlt,
  FaEye,
  FaShieldAlt,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectSelectedTeam, selectSelectedWorkspace } from '../../../../Redux/AllData/uiStateSlice';
import type { WorkspaceDetails } from '../../../../modals/interfaces';
import {
  addMemberToWorkspace,
  changeMemberAccess,
  editWorkspaceType,
  getMembersInOrganization,
  getWorkspaceDetails,
  removeMemberFromWorkspace,
  WorkspaceMemberAccess,
} from '../../../../Apis/features/workspaceApiServices';
import useToast from './Toast/useToast';
import { FiLoader } from 'react-icons/fi';
import DeleteConfirmation from '../Modals/DeleteDialog';
import { getUserId } from '../../../../Apis/core/api';
import { getUserInfo } from '../../../../Apis/core/api';
import { CMDOS_PRICING_URL } from '../../../../Apis/core/apiConfig';

interface ShareButtonProps {
  workspaceDetails: WorkspaceDetails;
  reload: () => void;
  buttonText?: string;
}

export enum AccessType {
  Public = 'public',
  Private = 'private',
  ShareOnly = 'shareonly',
}

interface MemberInWorkspace {
  user_id: string;
  workspace_id: string;
  email: string;
  first_name: string;
  last_name: string;
  image_url: string;
  role: string;
  credits_left: number;
}

interface Member {
  membership_id: string;
  org_id: string;
  user_id: string;
  role: 'org:member' | 'org:admin';
  first_name: string;
  last_name: string | null;
  email: string;
  image_url: string;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
  credits_left: number;
  subscription_status: string | null;
  plan_type: string | null;
  is_admin: boolean;
}

// Custom Select Component
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon: React.ReactNode }[];
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Find the currently selected option
  const selectedOption = options.find(option => option.value === value);

  return (
    <div ref={selectRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg 
          ${disabled ? 'bg-[var(--color-containerBg)] cursor-not-allowed opacity-70' : 'bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-600 cursor-pointer'} 
          transition-all duration-200 shadow-sm border border-[var(--color-borderDefault)] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 w-40`}
        type="button"
        disabled={disabled}>
        <div className="flex flex-1 overflow-hidden truncate items-center gap-2">
          <div className="text-neutral-600 dark:text-neutral-300">{selectedOption?.icon}</div>
          <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
            {selectedOption?.label}
          </span>
        </div>
        <FaChevronDown
          className={`text-xs text-neutral-500 dark:text-neutral-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            // Increased z-index to ensure overlapping and fixed width
            className="absolute z-[1000] mt-1 w-40 right-0 rounded-lg shadow-lg bg-[var(--color-popupBg)] border border-[var(--color-borderDefault)] overflow-hidden">
            {options.map(option => (
              <div
                key={option.value}
                onClick={() => {
                  if (option.value !== value) {
                    onChange(option.value);
                  }
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 cursor-pointer
                  ${
                    option.value === value
                      ? 'bg-[var(--color-containerBg)] text-neutral-900 dark:text-neutral-100'
                      : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }
                  transition-colors duration-150`}>
                <div
                  className={`${option.value === value ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {option.icon}
                </div>
                <span className="font-medium text-sm truncate">{option.label}</span>
                {option.value === value && <FaCheck className="ml-auto text-[var(--color-iconDefault)]" />}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MemberInWorkspaceComponentProps {
  member: MemberInWorkspace;
  workspaceDetails: WorkspaceDetails;
  reload: () => void;
  workpspaceAccess: AccessType;
}

const MemberInWorkspaceComponent: React.FC<MemberInWorkspaceComponentProps> = ({
  member,
  workspaceDetails,
  reload,
  workpspaceAccess,
}) => {
  const [memberRole, setMemberRole] = useState<WorkspaceMemberAccess>(WorkspaceMemberAccess.Member);
  const triggerToast = useToast();
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    setMemberRole(member.role as WorkspaceMemberAccess);
  }, [member]);

  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  // Select options with icons
  const selectOptions = [
    {
      value: WorkspaceMemberAccess.Member,
      label: 'Viewer',
      icon: <FaEye className="text-sm" />,
    },
    {
      value: WorkspaceMemberAccess.EditAccess,
      label: 'Edit Access',
      icon: <FaEdit className="text-sm" />,
    },
    {
      value: WorkspaceMemberAccess.DeleteAccess,
      label: 'Delete Access',
      icon: <FaTrashAlt className="text-sm" />,
    },
  ];

  const handleOptionSelect = async (memberRole: string) => {
    const prev = memberRole;

    try {
      setMemberRole(memberRole as WorkspaceMemberAccess);
      setIsUpdatingAccess(true);
      await changeMemberAccess(member.user_id, workspaceDetails.workspace_id, memberRole as WorkspaceMemberAccess);
      reload();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      triggerToast(serverErrorMessage, 'error');
      setMemberRole(prev as WorkspaceMemberAccess);
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const handleRemoveMember = async () => {
    try {
      await removeMemberFromWorkspace(member.user_id, workspaceDetails.workspace_id);
      triggerToast('Member Removed', 'success');
      setRemoveOpen(false);
      reload();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      triggerToast(serverErrorMessage, 'error');
    }
  };

  return (
    <div
      key={member.user_id}
      className="p-4 mb-3 flex items-center justify-between rounded-lg cursor-pointer bg-[var(--color-popupBg)] hover:bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] transition-all duration-200 shadow-sm">
      <div className="w-full flex flex-row items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[var(--color-containerBg)] rounded-full flex items-center justify-center shadow">
            {member.image_url ? (
              <img src={member.image_url} alt={member.first_name} className="w-10 h-10 rounded-full" />
            ) : (
              <span className="text-base font-medium text-neutral-100 dark:text-neutral-200">
                {member.first_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="ml-3 font-medium text-neutral-800 dark:text-neutral-200">
            {member.first_name + (member.last_name || '')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {memberRole && memberRole !== WorkspaceMemberAccess.Admin ? (
            <CustomSelect
              value={memberRole}
              onChange={handleOptionSelect}
              options={selectOptions}
              disabled={isUpdatingAccess}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-containerBg)] rounded-lg border border-[var(--color-borderDefault)] shadow-sm w-36">
              <div className="text-neutral-600 dark:text-neutral-300">
                <FaShieldAlt className="text-sm" />
              </div>
              <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">Admin</span>
            </div>
          )}

          {/* Only show remove button for non-admin members */}
          {memberRole !== WorkspaceMemberAccess.Admin && workpspaceAccess === AccessType.ShareOnly && (
            <button
              onClick={e => {
                e.stopPropagation();
                setRemoveOpen(true);
              }}
              className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
              <FaTrashAlt className="text-[var(--color-iconDefault)] hover:opacity-80" />
            </button>
          )}
        </div>
      </div>

      <DeleteConfirmation
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        description={`Are you sure do you want to remove ${member.first_name + (member.last_name || '')} from this channel?`}
      />
    </div>
  );
};

const ShareButton: React.FC<ShareButtonProps> = ({ workspaceDetails, reload, buttonText = 'Share' }) => {
  // State selectors from Redux
  const selectedTeam = useSelector(selectSelectedTeam);

  // States
  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  const [confirmPopupOpen, setConfirmPopupOpen] = useState<boolean>(false);
  const [memberSelectionOpen, setMemberSelectionOpen] = useState<boolean>(false);
  const [selectedAccessType, setSelectedAccessType] = useState<AccessType>(workspaceDetails.type as AccessType);
  const [membersInTeam, setMembersInTeam] = useState<Member[]>([]);
  const [selectedMembersMap, setSelectedMembersMap] = useState<Record<string, WorkspaceMemberAccess>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [userSubscribed, setUserSubscribed] = useState('free');
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);

  const [membersInWorkspace, setMembersInWorkspace] = useState<MemberInWorkspace[]>([]);

  const triggerToast = useToast();

  useEffect(() => {
    const fetchorgMembers = async () => {
      try {
        const data = await getMembersInOrganization(workspaceDetails.org_id);
        if (data && data.members) {
          setMembersInTeam(data.members);
        }
      } catch (error) {
        
      }
    };
    fetchorgMembers();
  }, [workspaceDetails.org_id]);

  //user subscription status
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setIsLoadingUserDetails(true);
        const userId = await getUserId();
        const data = await getUserInfo(userId);
        const checkSubscription = () => {
          if (!selectedTeam) {
            setUserSubscribed('free');
            return;
          }

          // First, check if the selected team's ID matches any org_id in the organizations
          const selectedTeamOrg = data?.organizations?.find((org: any) => org.org_id === selectedTeam.team_id);

          // If we found a matching org for the selected team, use that
          if (selectedTeamOrg?.subscription) {
            setUserSubscribed(selectedTeamOrg.subscription.plan_type || 'free');
            return;
          }

          // As a fallback, check if the workspace's org_id matches any organization
          const workspaceOrg = data?.organizations?.find((org: any) => org.org_id === workspaceDetails.org_id);

          // Use the workspace org subscription if found, otherwise default to free
          const planType = workspaceOrg?.subscription?.plan_type || 'free';
          setUserSubscribed(planType);
        };

        checkSubscription();
      } catch (error: any) {
        const serverErrorMessage = error.response?.data?.error || error?.message;
        triggerToast(serverErrorMessage, 'error');
      } finally {
        setIsLoadingUserDetails(false);
      }
    };

    fetchUserDetails();
  }, [workspaceDetails.org_id, selectedTeam]);

  // Refs
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // For the main popup
      if (
        popupOpen &&
        !confirmPopupOpen &&
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setPopupOpen(false);
      }
    };

    // Handle escape key press
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (memberSelectionOpen) {
          setMemberSelectionOpen(false);
        } else if (confirmPopupOpen) {
          setConfirmPopupOpen(false);
        } else if (popupOpen) {
          setPopupOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [popupOpen, confirmPopupOpen, memberSelectionOpen]);

  const fetchWorkspaceDetails = async () => {
    try {
      const data = await getWorkspaceDetails(workspaceDetails.workspace_id);
      setMembersInWorkspace(data);
    } catch (error) {
      
    }
  };

  useEffect(() => {
    fetchWorkspaceDetails();
  }, [workspaceDetails]);

  // Toggle popup
  const togglePopup = () => {
    setPopupOpen(!popupOpen);
    setConfirmPopupOpen(false);
    setMemberSelectionOpen(false);
  };

  // Handle option selection
  const handleOptionSelect = async (accessType: string) => {
    if (workspaceDetails.type === 'public' || workspaceDetails.type === 'shareonly') {
      if (accessType === AccessType.Private) {
        triggerToast('You cannot change this access to Private', 'error');
        return;
      }
    }
    const prev = selectedAccessType;

    setSelectedAccessType(accessType as AccessType);

    setIsUpdatingAccess(true);

    try {
      await editWorkspaceType(workspaceDetails.workspace_id, accessType as AccessType);
      triggerToast(`Access Changed to ${getAccessTypeLabel(accessType as AccessType)}`, 'success');
      fetchWorkspaceDetails();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      triggerToast(serverErrorMessage, 'error');
      setSelectedAccessType(prev);
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  // Handle confirm for share selection
  const handleShareConfirm = async () => {
    if (Object.keys(selectedMembersMap).length === 0) {
      triggerToast('Please select members', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      // Iterate over each selected member, sending both user ID and role:
      for (const userId in selectedMembersMap) {
        try {
          const role = selectedMembersMap[userId];
          // Assuming addMemberToWorkspace now supports a role parameter.
          await addMemberToWorkspace(userId, workspaceDetails.workspace_id, role);
        } catch (error: any) {
          
        }
      }

      fetchWorkspaceDetails();
      setMemberSelectionOpen(false);
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message;
      triggerToast(serverErrorMessage, 'error');
    } finally {
      setIsLoading(false);
      setSelectedMembersMap({});
    }
  };

  // Toggle member selection
  const toggleMemberSelection = (member: Member) => {
    setSelectedMembersMap(prev => {
      const newMap = { ...prev };
      if (newMap[member.user_id]) {
        // Member is already selected, so remove them.
        delete newMap[member.user_id];
      } else {
        // Member is not selected, add with a default role.
        newMap[member.user_id] = WorkspaceMemberAccess.Member;
      }
      return newMap;
    });
  };

  const updateSelectedMemberRole = (userId: string, newRole: WorkspaceMemberAccess) => {
    setSelectedMembersMap(prev => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  // Define your role options (if not already defined)
  const roleSelectOptions = [
    {
      value: WorkspaceMemberAccess.Member,
      label: 'Viewer',
      icon: <FaEye className="text-sm" />,
    },
    {
      value: WorkspaceMemberAccess.EditAccess,
      label: 'Edit Access',
      icon: <FaEdit className="text-sm" />,
    },
    {
      value: WorkspaceMemberAccess.DeleteAccess,
      label: 'Delete Access',
      icon: <FaTrashAlt className="text-sm" />,
    },
  ];

  // Get filtered members
  // Create a set of member user IDs from the workspace
  const workspaceUserIds = new Set(membersInWorkspace.map(m => m.user_id));

  // Filter organization members so that only those not already in workspace are shown
  const filteredMembers = membersInTeam.filter(
    member =>
      !workspaceUserIds.has(member.user_id) &&
      (member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.last_name?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Get access type label
  const getAccessTypeLabel = (type: AccessType): string => {
    switch (type) {
      case AccessType.Public:
        return 'Public';
      case AccessType.Private:
        return 'Private';
      case AccessType.ShareOnly:
        return 'Shared';
      default:
        return '';
    }
  };

  const openLink = (url: string) => {
    if (chrome?.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  // Select options with icons
  const selectOptions = [
    {
      value: AccessType.Public,
      label: 'Public',
      icon: <FaGlobe className="text-sm" />,
    },
    {
      value: AccessType.Private,
      label: 'Private',
      icon: <FaLock className="text-sm" />,
    },
    {
      value: AccessType.ShareOnly,
      label: 'Shared',
      icon: <FaUsers className="text-sm" />,
    },
  ];

  return (
    <div className="relative">
      {/* Share Button */}
      {!isLoadingUserDetails ? (
        <>
          {userSubscribed === 'free' ? (
            <button
              onClick={() => openLink(CMDOS_PRICING_URL)}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--color-containerBg)] text-neutral-900 dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500">
              <span className="font-medium text-sm">Upgrade to access Share</span>
            </button>
          ) : (
            <div className="relative group">
              <button
                ref={buttonRef}
                onClick={togglePopup}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--color-containerBg)] text-neutral-900 dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500">
                <FaShare className="text-[var(--color-iconDefault)]" />
                <span className="font-medium text-sm">{buttonText}</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <button
          className="w-full flex items-center justify-center min-w-[160px] gap-2 px-3 py-2 rounded-full bg-[var(--color-containerBg)] text-neutral-900 dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-300 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 opacity-50 cursor-not-allowed ease-in-out"
          disabled>
          <div className="w-4 h-4 border-2 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin"></div>
          <span className="font-medium text-sm">Just a Moment...</span>
        </button>
      )}

      {/* Main Popup - Centered Modal */}
      <AnimatePresence>
        {popupOpen && (
          <div className="fixed inset-0 z-40 overflow-y-auto flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black"
              onClick={() => setPopupOpen(false)}
            />
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              // Increased width with max-w-lg instead of max-w-md
              className="relative w-full max-w-lg bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] p-6 z-50 rounded-xl shadow-lg">
              {/* Container for sliding panels */}
              <div className="relative overflow-hidden">
                {/* Main Options View */}
                <motion.div
                  initial={{ x: memberSelectionOpen ? '-100%' : 0 }}
                  animate={{ x: memberSelectionOpen ? '-100%' : 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: confirmPopupOpen ? 'none' : 'block' }}
                  // Increased min-height if needed
                  className="w-full min-h-[400px]">
                  <div className="flex flex-row items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-xl text-[var(--color-textPrimary)]">
                        {workspaceDetails.workspace_name}
                      </h3>
                      <p className="text-sm text-[var(--color-textSecondary)] mt-1">Channel access settings</p>
                    </div>
                    <div className="z-30">
                      <CustomSelect
                        value={selectedAccessType}
                        onChange={handleOptionSelect}
                        options={selectOptions}
                        disabled={isUpdatingAccess}
                      />
                    </div>
                  </div>

                  {isUpdatingAccess && (
                    <div className="flex items-center justify-center py-4 mb-4 bg-[var(--color-popupBg)] rounded-lg border border-[var(--color-borderDefault)]">
                      <FiLoader className="animate-spin mr-2 text-[var(--color-iconDefault)]" size={18} />
                      <span className="text-neutral-700 dark:text-neutral-300 font-medium">Updating access...</span>
                    </div>
                  )}

                  {selectedAccessType === AccessType.ShareOnly && (
                    <div className="flex justify-start w-full mb-4">
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          setMemberSelectionOpen(true);
                        }}
                        className="flex flex-row items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 hover:text-neutral-900 dark:text-gray-100 dark:hover:text-white cursor-pointer transition-colors duration-200">
                        <span>
                          <FaUserPlus />
                        </span>
                        <span>Add Member</span>
                      </div>
                    </div>
                  )}

                  {/* Increased height from h-64 to h-80 */}
                  <div className="h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {membersInWorkspace && membersInWorkspace.length > 0 ? (
                      [...membersInWorkspace]
                        .sort((a, b) => {
                          if (a.role === WorkspaceMemberAccess.Admin && b.role !== WorkspaceMemberAccess.Admin) {
                            return -1;
                          }
                          if (a.role !== WorkspaceMemberAccess.Admin && b.role === WorkspaceMemberAccess.Admin) {
                            return 1;
                          }
                          return 0;
                        })
                        .map(member => (
                          <MemberInWorkspaceComponent
                            key={member.user_id}
                            workspaceDetails={workspaceDetails}
                            member={member}
                            reload={fetchWorkspaceDetails}
                            workpspaceAccess={selectedAccessType}
                          />
                        ))
                    ) : (
                      <div className="text-center py-12 text-neutral-600 dark:text-neutral-400 flex flex-col items-center bg-[var(--color-popupBg)] rounded-lg border border-[var(--color-borderDefault)]">
                        <svg
                          className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mb-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span className="font-medium">No members in this workspace</span>
                        <span className="text-sm mt-1">Click "Add Member" to invite people</span>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Member Selection Panel - Slides in from right */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: memberSelectionOpen ? '0%' : '100%' }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ display: confirmPopupOpen ? 'none' : 'block' }}>
                  <div className="flex items-center mb-4">
                    <button
                      onClick={() => setMemberSelectionOpen(false)}
                      className="p-2 rounded-full bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all">
                      <FaArrowLeft className="text-[var(--color-iconDefault)]" />
                    </button>
                    <h3 className="font-semibold text-xl text-[var(--color-textPrimary)] ml-3">
                      Select Members
                    </h3>
                  </div>

                  {/* Search Input */}
                  <div className="mb-4 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-200 border border-[var(--color-borderDefault)] focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-500"
                    />
                  </div>

                  {/* Selected count badge */}
                  {Object.keys(selectedMembersMap).length > 0 && (
                    <div className="mb-4 px-4 py-2 bg-[var(--color-popupBg)] rounded-lg border border-[var(--color-borderDefault)] flex items-center justify-between">
                      <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                        {Object.keys(selectedMembersMap).length} member
                        {Object.keys(selectedMembersMap).length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={() => setSelectedMembersMap({})}
                        className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Members List */}
                  <div
                    className={` ${Object.keys(selectedMembersMap).length > 0 ? 'h-52' : 'h-64 '}  overflow-y-auto pr-1 custom-scrollbar`}>
                    {filteredMembers.length > 0 ? (
                      <div className="space-y-2">
                        {filteredMembers.map(member => (
                          <div
                            key={member.user_id}
                            // When clicking the row, only select if not already selected.
                            onClick={() => {
                              if (!selectedMembersMap[member.user_id]) {
                                toggleMemberSelection(member);
                              }
                            }}
                            className={`px-4 py-2 flex items-center justify-between rounded-lg cursor-pointer transition-all duration-200 shadow-sm 
      ${
        selectedMembersMap[member.user_id]
          ? 'bg-[var(--color-containerBg)] border-2 border-[var(--color-borderDefault)]'
          : 'bg-[var(--color-popupBg)] hover:bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)]'
      }`}>
                            <div className="flex items-center">
                              {/* Avatar and Name */}
                              <div className="w-10 h-10 bg-[var(--color-containerBg)] rounded-full flex items-center justify-center shadow">
                                {member.image_url ? (
                                  <img
                                    src={member.image_url}
                                    alt={member.first_name}
                                    className="w-10 h-10 rounded-full"
                                  />
                                ) : (
                                  <span className="text-base font-medium text-neutral-100 dark:text-neutral-200">
                                    {member.first_name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="ml-3 font-medium text-neutral-800 dark:text-neutral-200">
                                {member.first_name + (member.last_name || '')}
                              </span>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              {selectedMembersMap[member.user_id] ? (
                                <>
                                  <CustomSelect
                                    value={selectedMembersMap[member.user_id]}
                                    onChange={value =>
                                      updateSelectedMemberRole(member.user_id, value as WorkspaceMemberAccess)
                                    }
                                    options={roleSelectOptions}
                                  />
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleMemberSelection(member);
                                    }}
                                    className="p-1">
                                    <FaTimes className="text-[var(--color-iconDefault)]" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    toggleMemberSelection(member);
                                  }}
                                  className="p-1 rounded-full bg-[var(--color-containerBg)] opacity-80">
                                  <FaPlus className="text-[var(--color-iconDefault)]" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-neutral-600 dark:text-neutral-400 flex flex-col items-center bg-[var(--color-popupBg)] rounded-lg border border-[var(--color-borderDefault)]">
                        <svg
                          className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mb-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span className="font-medium">No members found</span>
                        <span className="text-sm mt-1">Try a different search term</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4 mt-4 ">
                    <button
                      onClick={() => setMemberSelectionOpen(false)}
                      className="px-4 py-3 bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all duration-200 border border-[var(--color-borderDefault)] font-medium shadow-sm hover:shadow">
                      Cancel
                    </button>
                    <button
                      disabled={isLoading || Object.keys(selectedMembersMap).length === 0}
                      onClick={handleShareConfirm}
                      className={`px-4 py-3 flex items-center justify-center rounded-lg transition-all duration-200 shadow-sm hover:shadow font-medium
                        ${
                          isLoading || Object.keys(selectedMembersMap).length === 0
                            ? 'bg-[var(--color-containerBg)] text-neutral-100 dark:text-neutral-400 cursor-not-allowed opacity-80 border border-[var(--color-borderDefault)]'
                            : 'bg-neutral-600 hover:bg-neutral-500 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-neutral-100 dark:text-neutral-100 border border-[var(--color-borderDefault)]'
                        }`}>
                      {isLoading ? (
                        <>
                          <FiLoader className="animate-spin mr-2" size={16} />
                          Adding...
                        </>
                      ) : (
                        <>
                          <span>Add</span>
                          {Object.keys(selectedMembersMap).length > 0 ? (
                            <span className="ml-2 bg-[var(--color-containerBg)] text-white rounded-full px-2 py-0.5 text-xs">
                              {Object.keys(selectedMembersMap).length}
                            </span>
                          ) : (
                            0
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShareButton;
