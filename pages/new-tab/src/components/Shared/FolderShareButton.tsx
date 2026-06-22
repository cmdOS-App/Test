import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  FaUserPlus,
  FaTrashAlt,
  FaEye,
  FaEdit,
  FaChevronDown,
  FaCheck,
  FaArrowLeft,
  FaPlus,
  FaTimes,
  FaShieldAlt,
  FaShareAlt,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getFolderMembers,
  addOrUpdateFolderMember,
  changeFolderAccess,
  removeFolderMember,
} from '../../../../Apis/features/snippetApi';
import useToast from './Toast/useToast';
import { FiLoader } from 'react-icons/fi';
import { getUserId } from '../../../../Apis/core/api';
import { getWorkspaceDetails } from '../../../../Apis/features/workspaceApiServices';

// Folder Role Types
export type FolderRole = 'owner' | 'manager' | 'editor' | 'viewer';

// Folder member interface
interface FolderMember {
  user_id: string;
  email: string;
  role: FolderRole;
  first_name?: string;
  last_name?: string;
  image_url?: string;
}

// Workspace member interface (eligible for invite)
interface WorkspaceMember {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
}

// Props
interface FolderShareButtonProps {
  folderDetails: {
    folder_id: string;
    name: string;
  };
  workspaceId: string;
  reload: () => void;
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

// Member component
interface FolderMemberComponentProps {
  member: FolderMember;
  folderDetails: {
    folder_id: string;
    name: string;
  };
  onRoleChange: (userId: string, newRole: FolderRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

const FolderMemberComponent: React.FC<FolderMemberComponentProps> = ({
  member,
  folderDetails,
  onRoleChange,
  onRemove,
}) => {
  const [memberRole, setMemberRole] = useState<FolderRole>(member.role);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  useEffect(() => {
    setMemberRole(member.role);
  }, [member.role]);

  const selectOptions =
    member.role === 'owner'
      ? [
          { value: 'owner', label: 'Owner', icon: <FaShieldAlt className="text-sm" /> }, // show only if they're already owner
        ]
      : [
          { value: 'viewer', label: 'Viewer', icon: <FaEye className="text-sm" /> },
          { value: 'editor', label: 'Editor', icon: <FaEdit className="text-sm" /> },
          { value: 'manager', label: 'Manager', icon: <FaUserPlus className="text-sm" /> },
        ];

  const handleRoleChange = async (newRole: string) => {
    setIsUpdatingRole(true);
    try {
      await onRoleChange(member.user_id, newRole as FolderRole);
      setMemberRole(newRole as FolderRole);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <div className="p-4 mb-3 flex items-center justify-between rounded-lg bg-[var(--color-popupBg)] hover:bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] transition-all duration-200 shadow-sm">
      <div className="w-full flex flex-row items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[var(--color-containerBg)] rounded-full flex items-center justify-center shadow">
            {member.image_url ? (
              <img src={member.image_url || '/placeholder.svg'} alt={member.email} className="w-10 h-10 rounded-full" />
            ) : (
              <span className="text-base font-medium text-neutral-100 dark:text-neutral-200">
                {member.email.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="ml-3 font-medium text-neutral-800 dark:text-neutral-200">
            {member.first_name ? `${member.first_name}${member.last_name ? ` ${member.last_name}` : ''}` : member.email}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {member.role === 'owner' ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-100 shadow-sm border border-[var(--color-borderDefault)] text-sm font-medium">
              <FaShieldAlt className="text-sm" />
              Owner
            </div>
          ) : (
            <CustomSelect
              value={memberRole}
              onChange={handleRoleChange}
              options={selectOptions}
              disabled={isUpdatingRole}
            />
          )}

          {member.role !== 'owner' && (
            <button
              onClick={() => onRemove(member.user_id)}
              className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
              <FaTrashAlt className="text-[var(--color-iconDefault)] hover:opacity-80" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const mapFolderRoleToApiRole = (role: FolderRole): 'admin' | 'editor' | 'viewer' => {
  switch (role) {
    case 'manager':
      return 'admin';
    case 'owner':
      return 'admin';
    default:
      return role;
  }
};

const FolderShareButton: React.FC<FolderShareButtonProps> = ({ folderDetails, workspaceId, reload }) => {
  const [membersInFolder, setMembersInFolder] = useState<FolderMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [selectedMembersMap, setSelectedMembersMap] = useState<Record<string, FolderRole>>({});
  const [popupOpen, setPopupOpen] = useState(false);
  const [memberSelectionOpen, setMemberSelectionOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const triggerToast = useToast();

  // Refs
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const id = await getUserId();
        setCurrentUserId(id);
      } catch (error) {
        console.error('Failed to fetch user ID:', error);
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    if (folderDetails?.folder_id && workspaceId && currentUserId) {
      fetchMembers();
    }
  }, [folderDetails?.folder_id, workspaceId, currentUserId]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupOpen &&
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
  }, [popupOpen, memberSelectionOpen]);

  const fetchMembers = async () => {
    try {
      const [folderRes, workspaceRes] = await Promise.all([
        getFolderMembers(folderDetails.folder_id),
        getWorkspaceDetails(workspaceId),
      ]);

      setMembersInFolder(folderRes?.users || []);
      setWorkspaceMembers(workspaceRes || []);

      // Set user's role
      if (currentUserId) {
        const currentUser = folderRes?.users?.find((m: FolderMember) => m.user_id === currentUserId);
        if (currentUser) {
          setAccessDenied(currentUser.role === 'viewer');
        }
      }
    } catch (error: any) {
      triggerToast('Error loading members', 'error');
    }
  };

  const handleAddMembers = async () => {
    if (Object.keys(selectedMembersMap).length === 0) {
      triggerToast('Please select members', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      for (const userId in selectedMembersMap) {
        const role = selectedMembersMap[userId];
        await addOrUpdateFolderMember(folderDetails.folder_id, userId, mapFolderRoleToApiRole(role));
      }
      triggerToast('Members added', 'success');
      setSelectedMembersMap({});
      fetchMembers();
      setMemberSelectionOpen(false);
    } catch (error) {
      triggerToast('Error adding members', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: FolderRole) => {
    try {
      await changeFolderAccess(folderDetails.folder_id, userId, mapFolderRoleToApiRole(newRole));
      triggerToast('Role updated', 'success');
      fetchMembers();
    } catch (error) {
      triggerToast('Error updating role', 'error');
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeFolderMember(folderDetails.folder_id, userId);
      triggerToast('Member removed', 'success');
      fetchMembers();
    } catch (error) {
      triggerToast('Error removing member', 'error');
    }
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMembersMap(prev => {
      const next = { ...prev };
      if (next[userId]) delete next[userId];
      else next[userId] = 'viewer';
      return next;
    });
  };

  const updateSelectedMemberRole = (userId: string, newRole: FolderRole) => {
    setSelectedMembersMap(prev => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  // Create a set of member user IDs from the folder
  const folderUserIds = new Set(membersInFolder.map(m => m.user_id));

  // Filter workspace members so that only those not already in folder are shown
  const filteredMembers = workspaceMembers.filter(
    member =>
      !folderUserIds.has(member.user_id) &&
      (member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.first_name && member.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (member.last_name && member.last_name.toLowerCase().includes(searchTerm.toLowerCase()))),
  );

  // Role select options
  const roleSelectOptions = [
    {
      value: 'viewer',
      label: 'Viewer',
      icon: <FaEye className="text-sm" />,
    },
    {
      value: 'editor',
      label: 'Editor',
      icon: <FaEdit className="text-sm" />,
    },
    {
      value: 'manager',
      label: 'Manager',
      icon: <FaUserPlus className="text-sm" />,
    },
  ];

  return (
    <div className="relative">
      {/* Share Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!accessDenied) {
            setPopupOpen(!popupOpen);
          } else {
            triggerToast("You don't have permission to manage sharing for this folder.", 'warning');
          }
        }}
        className="p-2 rounded-full bg-[var(--color-containerBg)] text-neutral-900 dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
        title="Share">
        <FaShareAlt className="w-4 h-4 text-[var(--color-iconDefault)]" />
      </button>

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
              className="relative w-full max-w-lg bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] p-6 z-50 rounded-xl shadow-lg">
              {/* Container for sliding panels */}
              <div className="relative overflow-hidden">
                {/* Main Options View */}
                <motion.div
                  initial={{ x: memberSelectionOpen ? '-100%' : 0 }}
                  animate={{ x: memberSelectionOpen ? '-100%' : 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full min-h-[420px]">
                  <div className="flex flex-row items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-xl text-[var(--color-textPrimary)]">
                        {folderDetails.name}
                      </h3>
                      <p className="text-sm text-[var(--color-textSecondary)] mt-1">Folder access settings</p>
                    </div>
                  </div>

                  <div className="flex justify-start w-full mb-4">
                    <div
                      onClick={() => setMemberSelectionOpen(true)}
                      className="flex flex-row items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-containerBg)] hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 hover:text-neutral-900 dark:text-gray-100 dark:hover:text-white cursor-pointer transition-colors duration-200">
                      <span>
                        <FaUserPlus />
                      </span>
                      <span>Add Member</span>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {membersInFolder && membersInFolder.length > 0 ? (
                      [...membersInFolder]
                        .sort((a, b) => {
                          if (a.role === 'owner' && b.role !== 'owner') {
                            return -1;
                          }
                          if (a.role !== 'owner' && b.role === 'owner') {
                            return 1;
                          }
                          return 0;
                        })
                        .map(member => (
                          <FolderMemberComponent
                            key={member.user_id}
                            member={member}
                            folderDetails={folderDetails}
                            onRoleChange={handleRoleChange}
                            onRemove={handleRemove}
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
                        <span className="font-medium">No members in this folder</span>
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
                  className="absolute top-0 left-0 w-full h-full">
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
                      className="w-[98%] pl-10 pr-4 py-3 rounded-lg bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-200 border border-[var(--color-borderDefault)] focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-500"
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
                    className={`${Object.keys(selectedMembersMap).length > 0 ? 'h-52' : 'h-64'} overflow-y-auto pr-1 custom-scrollbar`}>
                    {filteredMembers.length > 0 ? (
                      <div className="space-y-2">
                        {filteredMembers.map(member => (
                          <div
                            key={member.user_id}
                            onClick={() => {
                              if (!selectedMembersMap[member.user_id]) {
                                toggleMemberSelection(member.user_id);
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
                                    src={member.image_url || '/placeholder.svg'}
                                    alt={member.email}
                                    className="w-10 h-10 rounded-full"
                                  />
                                ) : (
                                  <span className="text-base font-medium text-neutral-100 dark:text-neutral-200">
                                    {member.email.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="ml-3 font-medium text-neutral-800 dark:text-neutral-200">
                                {member.first_name && member.last_name
                                  ? `${member.first_name} ${member.last_name}`
                                  : member.email}
                              </span>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              {selectedMembersMap[member.user_id] ? (
                                <>
                                  <CustomSelect
                                    value={selectedMembersMap[member.user_id]}
                                    onChange={value => updateSelectedMemberRole(member.user_id, value as FolderRole)}
                                    options={roleSelectOptions}
                                  />
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleMemberSelection(member.user_id);
                                    }}
                                    className="p-1">
                                    <FaTimes className="text-[var(--color-iconDefault)]" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    toggleMemberSelection(member.user_id);
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
                  <div className="grid grid-cols-2 gap-4 mt-4 mb-5">
                    <button
                      onClick={() => setMemberSelectionOpen(false)}
                      className="px-4 py-3 bg-[var(--color-containerBg)] text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all duration-200 border border-[var(--color-borderDefault)] font-medium shadow-sm hover:shadow">
                      Cancel
                    </button>
                    <button
                      disabled={isLoading || Object.keys(selectedMembersMap).length === 0}
                      onClick={handleAddMembers}
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
                          {Object.keys(selectedMembersMap).length > 0 && (
                            <span className="ml-2 bg-[var(--color-containerBg)] text-white rounded-full px-2 py-0.5 text-xs">
                              {' '}
                              {Object.keys(selectedMembersMap).length}
                            </span>
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

export default FolderShareButton;
