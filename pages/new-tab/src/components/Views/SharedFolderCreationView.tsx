import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaGlobe, FaSearch, FaUsers, FaCheck, FaLock, FaRegFolder, FaPencilAlt } from 'react-icons/fa';
import { FiLoader, FiArrowLeft, FiSave, FiX } from 'react-icons/fi';
import { LuPlus } from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';
import {
  setCommandStatus,
  selectSelectedTeam,
  selectIsMac,
  navigateToView,
} from '../../../../Redux/AllData/uiStateSlice';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import type { RootState } from '../../../../Redux/store';
import { fetchWorkspacesThunk } from '../../../../Redux/Workspaces/workspaceSlice';
import {
  createNewWorkspace,
  getMembersInOrganization,
  addMemberToWorkspace,
  updateWorkspaceCustomization,
  WorkspaceMemberAccess,
} from '../../../../Apis/features/workspaceApiServices';
import { getAvatarColor, getInitials } from '../../utils/avatarColors';

// --- Shared Types ---

interface OrgMember {
  membership_id: string;
  org_id: string;
  user_id: string;
  role: 'org:member' | 'org:admin';
  first_name: string;
  last_name: string | null;
  email: string;
  image_url: string | null;
}

enum PrivacyType {
  Private = 'private',
  Shared = 'shared',
}

enum AccessType {
  SpecificPeople = 'shareonly',
  AllInOrg = 'public',
}

const AddMemberRow = ({
  member,
  onAdd,
  isAdded,
}: {
  member: OrgMember;
  onAdd: (userId: string) => void;
  isAdded: boolean;
}) => {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800/30 transition-colors">
      <div className="flex items-center gap-2 overflow-hidden">
        <div
          className={`w-6 h-6 rounded-full ${getAvatarColor(member.first_name)} flex-shrink-0 flex items-center justify-center text-white font-medium text-[10px]`}>
          {member.image_url ? (
            <img src={member.image_url} alt={member.first_name} className="w-full h-full object-cover rounded-full" />
          ) : (
            getInitials(member.first_name, member.last_name || undefined)
          )}
        </div>
        <div className="min-w-0">
          <p className="text-neutral-900 dark:text-neutral-200 text-xs font-medium truncate">
            {member.first_name} {member.last_name || ''}
          </p>
          <p className="text-neutral-500 text-[10px] truncate">{member.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(member.user_id)}
        className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-colors
                ${isAdded
            ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'bg-[var(--color-containerBg)] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
          }
            `}>
        {isAdded ? 'Added' : 'Add'}
      </button>
    </div>
  );
};

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

// --- Main View Component ---

const SharedFolderCreationView: React.FC = () => {
  const dispatch = useDispatch();
  const rawSelectedTeam = useSelector((state: RootState) => selectSelectedTeam(state));
  const allTeams = useSelector((state: RootState) => state.all.data);

  // Filter out public/personal orgs - if selected is personal, use first real org
  const selectedTeam = useMemo(() => {
    if (rawSelectedTeam?.is_personal_space === false) {
      return rawSelectedTeam;
    }
    // Fallback: find first non-personal org
    if (allTeams && allTeams.length > 0) {
      const firstRealOrg = allTeams.find((team: any) => team.is_personal_space === false);
      return firstRealOrg || null;
    }
    return null;
  }, [rawSelectedTeam, allTeams]);

  const isMac = useSelector(selectIsMac);

  const [folderName, setFolderName] = useState('');
  const [privacyType, setPrivacyType] = useState<PrivacyType | null>(null);
  const [privacy, setPrivacy] = useState<AccessType>(AccessType.SpecificPeople);
  const [selectedColor, setSelectedColor] = useState<string>('#FFC107');
  const [selectedIcon, setSelectedIcon] = useState<string>('');
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // -- Icon Editing State --
  const [isEditingIcon, setIsEditingIcon] = useState(false);
  const [tempIcon, setTempIcon] = useState<string>('');
  const [tempColor, setTempColor] = useState<string>('#FFC107');

  const handleEditIconClick = () => {
    setIsEditingIcon(true);
    // Initialize with current selection
    setTempIcon(selectedIcon);
    setTempColor(selectedColor);
  };

  const handleSaveIcon = () => {
    setSelectedIcon(tempIcon);
    setSelectedColor(tempColor);
    setIsEditingIcon(false);
  };

  const handleCancelIcon = () => {
    setIsEditingIcon(false);
    // No need to revert selected* as we didn't touch them
  };

  // Preview logic: Show temp values if editing, else actual values
  const displayIcon = isEditingIcon ? tempIcon : selectedIcon;
  const displayColor = isEditingIcon ? tempColor : selectedColor;

  // Animation timing - check mainView directly
  const shouldShow = useSelector((state: RootState) => state.uiState.mainView.kind === 'sharedFolderCreation');

  useEffect(() => {
    if (shouldShow) {
      setTimeout(() => {
        setIsVisible(true);
      }, 50);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow]);

  // Better approach: Use a specific selector or effect to set initial state whenever view opens
  const mainView = useSelector((state: RootState) => state.uiState.mainView);

  useEffect(() => {
    if (mainView.kind === 'sharedFolderCreation' && isVisible) {
      if (mainView.defaultPrivacy === 'private') {
        setPrivacyType(PrivacyType.Private);
      } else if (mainView.defaultPrivacy === 'shared') {
        setPrivacyType(PrivacyType.Shared);
        setPrivacy(AccessType.SpecificPeople);
      } else if (mainView.defaultPrivacy === 'public') {
        setPrivacyType(PrivacyType.Shared);
        setPrivacy(AccessType.AllInOrg);
      }
      // Focus input
      inputRef.current?.focus();
    }
  }, [mainView, isVisible]);

  // Fetch Org Members
  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedTeam?.team_id) return;
      try {
        const data = await getMembersInOrganization(selectedTeam.team_id);
        if (data && Array.isArray(data.members)) {
          setOrgMembers(data.members);
        } else if (Array.isArray(data)) {
          setOrgMembers(data);
        }
      } catch (err) {
        console.error('Failed to load members', err);
      }
    };
    loadMembers();
  }, [selectedTeam?.team_id]);

  // Auto-select org owner when Shared with specific people is selected
  useEffect(() => {
    if (privacyType === PrivacyType.Shared && privacy === AccessType.SpecificPeople && orgMembers.length > 0) {
      const owner = orgMembers.find(m => m.role === 'org:admin');
      if (owner && !invitedUserIds.has(owner.user_id)) {
        setInvitedUserIds(prev => new Set([...prev, owner.user_id]));
      }
    }
  }, [privacyType, privacy, orgMembers]);

  // Filter Logic
  const filteredMembers = useMemo(() => {
    if (!searchTerm) {
      return orgMembers.slice(0, 20);
    }
    const lower = searchTerm.toLowerCase();
    return orgMembers
      .filter(
        m =>
          m.first_name.toLowerCase().includes(lower) ||
          (m.last_name && m.last_name.toLowerCase().includes(lower)) ||
          m.email.toLowerCase().includes(lower),
      )
      .slice(0, 10);
  }, [orgMembers, searchTerm]);

  const handleAddUser = (userId: string) => {
    const newSet = new Set(invitedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setInvitedUserIds(newSet);
    if (newSet.size > 0) setError(null);
  };

  const handleClose = () => {
    if (isLoading) return;
    dispatch(navigateToView({ kind: 'home' }));
    setFolderName('');
    setError(null);
    setPrivacyType(null);
    setInvitedUserIds(new Set());
    setSearchTerm('');
    setSelectedColor('#FFC107');
    setSelectedIcon('');
  };

  const handleCreate = async () => {
    if (!folderName.trim()) {
      setError('Please enter a folder name');
      return;
    }
    if (!privacyType) {
      setError('Please select a folder type (Private or Shared)');
      return;
    }
    if (privacyType === PrivacyType.Shared && privacy === AccessType.SpecificPeople && invitedUserIds.size === 0) {
      setError('Please select at least one member to share with');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await createNewWorkspace(
        folderName,
        privacyType === PrivacyType.Private ? 'private' : privacy === AccessType.AllInOrg ? 'public' : 'shareonly',
        selectedTeam?.team_id!,
        selectedTeam?.storageMode ?? 'cloud'
      );

      const workspaceId = res.workspace_id || res.id || (res.workspace && res.workspace.workspace_id);

      if (workspaceId && (selectedColor || selectedIcon)) {
        try {
          await updateWorkspaceCustomization(workspaceId, selectedIcon || null, selectedColor || null, selectedTeam?.storageMode ?? 'cloud');
        } catch (e) {
          console.error('Failed to apply customization', e);
        }
      }

      if (privacyType === PrivacyType.Shared && privacy === AccessType.SpecificPeople && workspaceId) {
        const userIds = Array.from(invitedUserIds);
        for (const uid of userIds) {
          try {
            await addMemberToWorkspace(uid, workspaceId, WorkspaceMemberAccess.Member);
          } catch (e) {
            console.error(`Failed to add user ${uid}`, e);
          }
        }
      }

      dispatch(setCommandStatus({ status: 'success', message: 'Shared folder created successfully' }));
      setTimeout(() => dispatch(setCommandStatus({ status: 'idle', message: '' })), 3000);

      if (selectedTeam?.team_id) {
        (dispatch as any)(fetchWorkspacesThunk(selectedTeam.team_id));
      }

      handleClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to create folder';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (isEditingIcon) {
      if (e.key === 'Escape') {
        handleCancelIcon();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveIcon();
      }
      return;
    }

    if (e.key === 'Escape' && !isLoading) {
      handleClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && folderName.trim() && !isLoading) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div
      className="flex-1 min-h-0 w-full flex flex-col items-center transition-opacity duration-300 ease-in-out"
      style={{ opacity: isVisible ? 1 : 0 }}>
      <div
        ref={modalRef}
        className="relative h-[90%] w-full max-w-5xl flex flex-col overflow-hidden border border-neutral-200 dark:border-white/10 bg-[#fdf6e3]/95 dark:bg-black rounded-xl shadow-2xl"
        onKeyDownCapture={handleKeyDown}>
        {/* Absolute Header (Top Right) */}
        {selectedTeam && (
          <div className="absolute top-4 right-10 flex items-center gap-2 z-10 transition-opacity hover:opacity-100 p-2">
            <span className="text-xs text-neutral-600 dark:text-neutral-400">{selectedTeam.team_name}</span>
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full ${getAvatarColor(selectedTeam.team_name)} text-xs font-semibold text-white`}>
              {selectedTeam.team_name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:text-red-500 dark:hover:text-red-300 dark:hover:bg-red-800 transition-colors z-20">
          <FiX size={16} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col">
          {/* Header - Inline Icon + Name */}
          <div className="flex items-center gap-4 mb-4 shrink-0">
            <div className="relative group/icon">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border border-[var(--color-borderDefault)] shadow-sm transition-all duration-300 relative overflow-hidden"
                style={{
                  backgroundColor: displayColor ? displayColor + '15' : undefined,
                }}>
                <div className="text-xl drop-shadow-sm transition-colors relative z-10" style={{ color: displayColor }}>
                  {displayIcon ? (
                    displayIcon.startsWith('U+') ? (
                      <span>{String.fromCodePoint(parseInt(displayIcon.replace('U+', ''), 16))}</span>
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: displayIcon }} />
                    )
                  ) : (
                    <FaRegFolder />
                  )}
                </div>
              </div>
              {!isEditingIcon && (
                <button
                  onClick={handleEditIconClick}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-containerBg)] rounded-full shadow border border-[var(--color-borderDefault)] flex items-center justify-center text-[var(--color-iconDefault)] hover:text-blue-500 hover:border-blue-500 transition-colors z-20"
                  title="Edit Folder">
                  <FaPencilAlt size={10} />
                </button>
              )}
            </div>

            <div className="w-[45%]">
              <input
                ref={inputRef}
                type="text"
                value={folderName}
                onChange={e => {
                  setFolderName(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isEditingIcon}
                className={`w-full text-lg font-bold text-neutral-900 dark:text-white bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-neutral-500 leading-tight ${isEditingIcon ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="Folder name"
                autoFocus={!isEditingIcon}
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-[var(--color-borderDefault)] mb-4 shrink-0" />

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden">
                <div className="p-3 text-sm text-red-500 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Two-Column Layout */}
          <div className={`grid ${isEditingIcon ? 'grid-cols-[70%_30%]' : 'grid-cols-2'} gap-8 flex-1 min-h-0`}>
            <div
              className={`flex flex-col h-full overflow-hidden ${isEditingIcon ? '' : 'overflow-y-auto custom-scrollbar'}`}>
              {isEditingIcon ? (
                <EmojiPicker
                  onSelectIcon={icon => setTempIcon(icon)}
                  onSelectColor={color => setTempColor(color)}
                  showColorPicker={true}
                  previewIcon={tempIcon}
                  compact={true}
                  continuousScroll={true}
                  className="h-full border-none shadow-none ring-0 bg-transparent"
                />
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div
                      onClick={() => setPrivacyType(PrivacyType.Private)}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${privacyType === PrivacyType.Private
                          ? 'border-neutral-700 bg-[#eee8d5] dark:border-neutral-100 dark:bg-neutral-800'
                          : 'border-[var(--color-borderDefault)] hover:border-neutral-400 dark:hover:border-neutral-700'
                        }`}>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${privacyType === PrivacyType.Private
                            ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100'
                            : 'border-[var(--color-borderDefault)]'
                          }`}>
                        {privacyType === PrivacyType.Private && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-containerBg)]" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <FaLock
                          className={
                            privacyType === PrivacyType.Private
                              ? 'text-neutral-900 dark:text-neutral-100'
                              : 'text-[var(--color-iconDefault)]'
                          }
                          size={14}
                        />
                        <span
                          className={`text-sm font-semibold ${privacyType === PrivacyType.Private
                              ? 'text-neutral-900 dark:text-neutral-100'
                              : 'text-neutral-700 dark:text-neutral-400'
                            }`}>
                          Private
                        </span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-500 pl-5">
                          Private folder visible only to you.
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={() => setPrivacyType(PrivacyType.Shared)}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${privacyType === PrivacyType.Shared
                          ? 'border-neutral-700 bg-[#eee8d5] dark:border-neutral-100 dark:bg-neutral-800'
                          : 'border-[var(--color-borderDefault)] hover:border-neutral-400 dark:hover:border-neutral-700'
                        }`}>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${privacyType === PrivacyType.Shared
                            ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100'
                            : 'border-[var(--color-borderDefault)]'
                          }`}>
                        {privacyType === PrivacyType.Shared && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-containerBg)]" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <FaUsers
                          className={
                            privacyType === PrivacyType.Shared
                              ? 'text-neutral-900 dark:text-neutral-100'
                              : 'text-[var(--color-iconDefault)]'
                          }
                          size={14}
                        />
                        <span
                          className={`text-sm font-semibold ${privacyType === PrivacyType.Shared
                              ? 'text-neutral-900 dark:text-neutral-100'
                              : 'text-neutral-700 dark:text-neutral-400'
                            }`}>
                          Shared
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-500 pl-5">
                        Shared folder visible to all members.
                      </span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {privacyType === PrivacyType.Shared && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-2 pl-1 border-l-2 border-[var(--color-borderDefault)] ml-3.5">
                        <div
                          onClick={() => setPrivacy(AccessType.SpecificPeople)}
                          className={`cursor-pointer px-3 py-2 rounded-lg text-sm transition-colors flex flex-col gap-0.5 ${privacy === AccessType.SpecificPeople
                              ? 'bg-[#eee8d5] shadow-sm dark:bg-white/10 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-[#f5f0e8] dark:hover:bg-neutral-800/50'
                            }`}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full border flex items-center justify-center ${privacy === AccessType.SpecificPeople
                                  ? 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]'
                                  : 'border-neutral-400'
                                }`}>
                              {privacy === AccessType.SpecificPeople && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-containerBg)]" />
                              )}
                            </div>
                            <span
                              className={
                                privacy === AccessType.SpecificPeople
                                  ? 'text-neutral-900 dark:text-neutral-100 font-medium'
                                  : 'text-neutral-600 dark:text-neutral-400'
                              }>
                              Shared: Specific people
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-500 pl-5">
                            Share with selected members.
                          </span>
                        </div>

                        <div
                          onClick={() => setPrivacy(AccessType.AllInOrg)}
                          className={`cursor-pointer px-3 py-2 rounded-lg text-sm transition-colors flex flex-col gap-0.5 ${privacy === AccessType.AllInOrg
                              ? 'bg-[#eee8d5] shadow-sm dark:bg-white/10 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-[#f5f0e8] dark:hover:bg-neutral-800/50'
                            }`}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full border flex items-center justify-center ${privacy === AccessType.AllInOrg
                                  ? 'border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]'
                                  : 'border-neutral-400'
                                }`}>
                              {privacy === AccessType.AllInOrg && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-containerBg)]" />
                              )}
                            </div>
                            <span
                              className={
                                privacy === AccessType.AllInOrg
                                  ? 'text-neutral-900 dark:text-neutral-100 font-medium'
                                  : 'text-neutral-600 dark:text-neutral-400'
                              }>
                              Public: Everyone in the organization
                            </span>
                          </div>
                          <span
                            className={`text-[10px] pl-5 ${privacy === AccessType.AllInOrg
                                ? 'text-neutral-600 dark:text-neutral-400'
                                : 'text-neutral-500'
                              }`}>
                            Anyone in the organization can join.
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {!isEditingIcon && (
              <div className="flex flex-col min-h-[50px] overflow-hidden transition-all h-full">
                <AnimatePresence mode="wait">
                  {privacyType === PrivacyType.Shared && privacy === AccessType.SpecificPeople && (
                    <motion.div
                      key="member-search"
                      initial={{ height: 50, opacity: 0.6 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 50, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="flex flex-col p-4 w-full border border-[var(--color-borderDefault)] rounded-xl">
                      <div className="relative mb-3 shrink-0">
                        <FaSearch
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-iconDefault)]"
                          size={12}
                        />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Search members..."
                          className="w-full pl-9 pr-4 py-1.5 bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-shadow"
                        />
                      </div>

                      <div className="max-h-[260px] overflow-y-auto custom-scrollbar -mx-2 px-2 flex-1">
                        {filteredMembers.length > 0 ? (
                          <div className="space-y-0.5">
                            {filteredMembers.map(member => (
                              <AddMemberRow
                                key={member.user_id}
                                member={member}
                                onAdd={handleAddUser}
                                isAdded={invitedUserIds.has(member.user_id)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 flex flex-col items-center justify-center text-neutral-400">
                            <p className="text-xs">No members found</p>
                          </div>
                        )}
                      </div>

                      {privacyType === PrivacyType.Shared && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-borderDefault)] flex items-center justify-between shrink-0">
                          <span className="text-[10px] text-neutral-500 italic">Not seeing someone?</span>
                          <button
                            type="button"
                            onClick={() =>
                              selectedTeam &&
                              dispatch(
                                navigateToView({
                                  kind: 'organizationSettings',
                                  orgId: selectedTeam.team_id,
                                  orgName: selectedTeam.team_name,
                                }),
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-containerBg)] text-neutral-600 dark:text-neutral-300 font-semibold text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shadow-sm border border-[var(--color-borderDefault)]">
                            <LuPlus size={12} className="stroke-[3px]" />
                            <span>Invite to Org</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border border-white/70 dark:border-white/10 bg-[#fdf6e3]/95 dark:bg-neutral-900/75 px-3 py-1 text-neutral-600 dark:text-neutral-200 shadow-[0_4px_16px_rgba(124,110,245,0.15)] flex-shrink-0">
          <button
            onClick={isEditingIcon ? handleCancelIcon : handleClose}
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)]">
            {isEditingIcon && <FiArrowLeft size={10} />}
            <span className="text-neutral-600 dark:text-white">Back</span>
            <span className="ml-1 text-[9px] font-bold text-gray-500 px-1 rounded border border-gray-100 dark:border-gray-900/30">
              ESC
            </span>
          </button>

          <button
            onClick={isEditingIcon ? handleSaveIcon : handleCreate}
            disabled={!isEditingIcon && (!folderName.trim() || !privacyType || isLoading)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-0.5 text-xs font-semibold shadow-[0_4px_14px_rgba(139,124,255,0.2)] ${isEditingIcon || (folderName.trim() && privacyType && !isLoading)
                ? 'border-[#93a1a1] dark:border-[#9fa2ff] bg-[#eee8d5] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#839496] dark:hover:border-[#8f93ff]'
                : 'cursor-not-allowed border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500'
              }`}>
            {isLoading && !isEditingIcon ? (
              <div className="flex items-center gap-2">
                <FiLoader className="animate-spin" size={12} />
                <span>Creating...</span>
              </div>
            ) : (
              <>
                <span>{isEditingIcon ? 'Save' : 'Create'}</span>
                <span className="flex items-center gap-1 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  <span className="rounded-md border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0">
                    {isMac ? 'Cmd' : 'Ctrl'}
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
    </div>
  );
};

export default SharedFolderCreationView;
