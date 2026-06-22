import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserPlus, FaUser, FaPalette } from 'react-icons/fa';
import { FiCreditCard, FiSettings, FiLogOut, FiSearch } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { getUserId, getActiveSubscriptions, getUserInfo } from '../../../../Apis/core/api';
import { getCreditBalance } from '@private-services/subscriptionApi';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { useSelector, useDispatch } from 'react-redux';
import { selectSelectedTeam, setSelectedTeam, navigateToView } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import { FEATURE_FLAGS } from '../../utils/featureFlags';
import { revokeRemoteSession } from '../../../../Apis/services/logoutService';
import SaaSControls from '@private-features/SaaSControls';

interface HeaderControlsProps {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  isNewTabEnabled: boolean;
  onToggleNewTab: () => void;
  isCommandListView: boolean;
  onToggleCommandListView: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isLoggedIn: boolean;
  direction?: 'up' | 'down';
  showTutorialButton?: boolean;
  onTutorialClick?: () => void;
  onOpenSubscriptions?: () => void;
  onOpenManageSubscription?: () => void;
  onCommandListCategoryChange?: (category: string) => void;
  commandListCategory?: string;
  isBoardViewEnabled?: boolean;
  onToggleBoardView?: () => void;
  onOpenOrganizationSettings?: (orgId: string, orgName: string) => void;
  onOpenGeneralSettings?: () => void;
}

const HeaderControls: React.FC<HeaderControlsProps> = ({
  isSidebarCollapsed,
  toggleSidebar,
  showFavorites,
  onToggleFavorites,
  isNewTabEnabled,
  onToggleNewTab,
  isCommandListView,
  onToggleCommandListView,
  isDarkMode,
  toggleDarkMode,
  isFocusMode,
  onToggleFocusMode,
  isLoggedIn,
  direction = 'down',
  showTutorialButton = false,
  onTutorialClick,
  onOpenSubscriptions,
  onOpenManageSubscription,
  onCommandListCategoryChange,
  commandListCategory,
  isBoardViewEnabled,
  onToggleBoardView,
  onOpenOrganizationSettings,
  onOpenGeneralSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showOmniboxConfirm, setShowOmniboxConfirm] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  const dispatch = useDispatch();
  const selectedTeam = useSelector(selectSelectedTeam);
  const orgId = selectedTeam?.team_id || (selectedTeam as any)?.org_id || '';

  const allTeams = useSelector(selectAllData);
  const personalTeam = allTeams?.find(t => t.is_personal_space);
  const personalOrgId = personalTeam?.team_id || '';

  const [personalSubscription, setPersonalSubscription] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string } | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchUser = async (force = false) => {
        try {
          const chromeAny = (window as any).chrome;
          const now = Date.now();

          // 1. Try storage first
          const storage = await chromeAny.storage.local.get(['user_info', 'last_user_info_fetch_timestamp']);
          const lastFetch = storage.last_user_info_fetch_timestamp || 0;
          const isCoolingDown = now - lastFetch < 60 * 60 * 1000;

          if (storage.user_info) {
            setUserInfo(storage.user_info);
            if (isCoolingDown && !force) return;
          }

          const userId = await getUserId();
          const info = await getUserInfo(userId);
          if (info && info.user) {
            const { user } = info;
            const fullName = user.first_name
              ? `${user.first_name} ${user.last_name || ''}`.trim()
              : user.email.split('@')[0];

            const data = { email: user.email, name: fullName, image_url: user.image_url || user.profile_image_url };
            setUserInfo(data);
            await chromeAny.storage.local.set({
              user_info: data,
              last_user_info_fetch_timestamp: Date.now(),
            });
          }
        } catch (err) {
          console.error('Failed to fetch user info:', err);
        }
      };
      fetchUser();

      const listener = (changes: any) => {
        if (changes.user_info) {
          setUserInfo(changes.user_info.newValue || null);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    return undefined;
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchPersonalSub = async (force = false) => {
        try {
          const chromeAny = (window as any).chrome;
          const now = Date.now();

          // 1. Try storage first
          const storage = await chromeAny.storage.local.get(['personal_subscription', 'last_sub_fetch_timestamp']);
          const lastFetch = storage.last_sub_fetch_timestamp || 0;
          const isCoolingDown = now - lastFetch < 60 * 60 * 1000; // 1-hour cooldown

          if (storage.personal_subscription) {
            setPersonalSubscription(storage.personal_subscription);
            if (isCoolingDown && !force) return;
          }

          const userId = await getUserId();
          const subs = await getActiveSubscriptions(userId);

          // Find subscription for free_org_ first
          const freeOrgSub = subs.find(
            sub =>
              (sub.organization_id && sub.organization_id.startsWith('free_org_')) ||
              (sub.org_id && sub.org_id.startsWith('free_org_')),
          );

          const targetSub = freeOrgSub || subs[0];
          const hasPro = targetSub ? Boolean(targetSub.stripe_user_id) : false;

          if (hasPro && targetSub) {
            setPersonalSubscription(targetSub);
            await chromeAny.storage.local.set({
              personal_subscription: targetSub,
              last_sub_fetch_timestamp: Date.now(),
            });
          } else {
            const freePlaceholder = targetSub || { plan_type: 'free', stripe_user_id: null };
            setPersonalSubscription(freePlaceholder);
            await chromeAny.storage.local.set({
              personal_subscription: freePlaceholder,
              last_sub_fetch_timestamp: Date.now(),
            });
          }
        } catch (err) {
          console.error('Failed to fetch personal subscription:', err);
        }
      };
      fetchPersonalSub();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchCredits = async (force = false) => {
        try {
          const chromeAny = (window as any).chrome;
          const now = Date.now();
          const cacheKey = `credits_${orgId}`;
          const timeKey = `last_credits_fetch_${orgId}`;

          // 1. Try storage first
          const storage = await chromeAny.storage.local.get([cacheKey, timeKey]);
          const lastFetch = storage[timeKey] || 0;
          const isCoolingDown = now - lastFetch < 2 * 60 * 1000; // 2-minute cooldown per user request

          if (storage[cacheKey] !== undefined) {
            setCreditsLeft(storage[cacheKey]);
            if (isCoolingDown && !force) return;
          }

          const userId = await getUserId();
          const info = await getCreditBalance(userId, orgId);
          let balance = null;
          if (info?.credits !== undefined) balance = info.credits;
          else if (info?.credits_left !== undefined) balance = info.credits_left;
          else if (info?.user?.credits_left !== undefined) balance = info.user.credits_left;

          if (balance !== null) {
            setCreditsLeft(balance);
            await chromeAny.storage.local.set({
              [cacheKey]: balance,
              [timeKey]: Date.now(),
            });
          }
        } catch (err) {
          console.error('Failed to fetch credits:', err);
        }
      };
      fetchCredits();
    }
  }, [isLoggedIn, orgId]);

  // Sync Omnibox setting
  const [isOmniboxEnabled, setIsOmniboxEnabled] = useState(true);
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['omnibox_override_enabled'], (result: any) => {
        setIsOmniboxEnabled(result.omnibox_override_enabled !== false);
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.omnibox_override_enabled) {
          setIsOmniboxEnabled(changes.omnibox_override_enabled.newValue !== false);
        }
      };
      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    }
    return undefined;
  }, []);

  const handleToggleOmnibox = () => {
    setIsOpen(false);
    const newValue = !isOmniboxEnabled;
    if (!newValue) {
      setShowOmniboxConfirm(true);
      return;
    }
    setIsOmniboxEnabled(true);
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ omnibox_override_enabled: true });
    }
  };

  const confirmDisableOmnibox = () => {
    setShowOmniboxConfirm(false);
    setIsOmniboxEnabled(false);
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ omnibox_override_enabled: false });
    }
  };

  const cancelDisableOmnibox = () => {
    setShowOmniboxConfirm(false);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    const chromeAny = (window as any)?.chrome;
    // 1. Revoke the Clerk session (private builds only; no-op in OSS).
    const storedResult = await new Promise<{ accessToken?: string }>(resolve => {
      if (chromeAny?.storage?.local?.get) {
        chromeAny.storage.local.get('accessToken', (res: any) => resolve(res || {}));
      } else {
        resolve({});
      }
    });
    const userId = storedResult?.accessToken;
    if (userId && typeof userId === 'string' && userId.startsWith('user_')) {
      await revokeRemoteSession(userId);
    }
    // 2. Clear local extension storage.
    if (chromeAny?.storage?.local) {
      const KEYS_TO_REMOVE = [
        'accessToken',
        'profileImg',
        'loggedIn',
        'user_name',
        'user_email',
        'myCachedAllData',
        'orgRefreshCounters',
        'last_org_counter_check_timestamp',
        'last_org_counter_check_result',
      ];
      chromeAny.storage.local.remove(KEYS_TO_REMOVE, () => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: 10 },
    visible: { opacity: 1, x: 0 },
  };

  const getContainerVariants = (direction: 'up' | 'down') => ({
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 10 : -10,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.2,
        staggerChildren: 0.03,
      },
    },
    exit: {
      opacity: 0,
      y: direction === 'up' ? 10 : -10,
      scale: 0.95,
      transition: { duration: 0.15 },
    },
  });

  const TooltipButton = ({
    onClick,
    title,
    icon,
    active = false,
    className = '',
    showLabel = false,
    label = '',
    isToggle = false,
  }: {
    onClick?: () => void;
    title: string;
    icon: React.ReactNode;
    active?: boolean;
    className?: string;
    showLabel?: boolean;
    label?: string;
    isToggle?: boolean;
  }) => {
    return (
      <button
        onPointerDown={e => {
          e.stopPropagation();
          onClick?.();
        }}
        onClick={e => e.stopPropagation()}
        title={title}
        className={`relative flex items-center rounded-md transition-colors ${active
          ? 'text-[#073642] hover:text-[#073642] hover:bg-[#eee8d5] dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800'
          : 'text-[#073642] hover:text-[#073642] hover:bg-[#eee8d5] dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800'
          } ${className}`}>
        <div className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</div>
        {showLabel && <span className="text-[13px] font-semibold flex-1 text-left whitespace-nowrap">{label}</span>}
        {isToggle && (
          <div
            className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ml-auto ${active ? 'bg-[var(--color-containerBg)]' : 'bg-[var(--color-containerBg)]'
              }`}>
            <motion.div
              initial={false}
              animate={{
                x: active ? 16 : 0,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`w-3 h-3 rounded-full shadow-sm ${active ? 'bg-[var(--color-containerBg)]' : 'bg-[var(--color-containerBg)]'
                }`}
            />
          </div>
        )}
      </button>
    );
  };

  const LinkButton = ({
    href,
    title,
    icon,
    showText = false,
    className = '',
    target = '_blank',
  }: {
    href: string;
    title: string;
    icon: React.ReactNode;
    showText?: boolean;
    className?: string;
    target?: string;
  }) => {
    return (
      <a
        href={href}
        onPointerDown={e => {
          e.stopPropagation();
          window.open(href, target || '_blank');
        }}
        onClick={e => e.preventDefault()}
        target={target || '_blank'}
        rel="noopener noreferrer"
        title={title}
        className={`relative flex items-center rounded-md transition-colors text-[#073642] hover:text-[#073642] hover:bg-[#eee8d5] dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 ${className} ${showText ? 'bg-transparent' : ''
          }`}>
        <div className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</div>
        {showText && <span className="text-[13px] font-semibold flex-1 text-left whitespace-nowrap">{title}</span>}
      </a>
    );
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div
      ref={menuRef}
      className={`relative z-50 flex flex-col ${direction === 'up' ? 'items-end' : 'items-start'} gap-2`}>
      {/* Tutorial + Upgrade + Hamburger row */}
      <div className="flex items-center gap-2">
        {/* Tutorial Button - shown next to menu button */}
        {/* {showTutorialButton && (
          <motion.button
            onClick={onTutorialClick}
            className="p-1.5 bg-transparent border-0 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors z-[60] flex items-center justify-center rounded-md"
            title="Tutorial"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}>
            <FaGraduationCap size={18} />
          </motion.button>
        )} */}

        {/* Settings Icon - directly opens Settings panel */}
        <motion.button
          onClick={() => {
            dispatch(navigateToView({ kind: 'generalSettings', section: 'profile' }));
          }}
          className="p-1.5 bg-transparent border-0 text-[#073642] hover:text-black dark:text-[var(--color-iconDefault)] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors z-[60] flex items-center justify-center rounded-md"
          title="Settings"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}>
          <FiSettings size={20} />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={getContainerVariants(direction)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`absolute ${direction === 'up' ? 'bottom-full mb-3' : 'top-full mt-2'} ${direction === 'up' ? 'right-0' : 'left-0'} flex flex-col md:flex-row bg-[var(--color-popupBg)] rounded-2xl border border-white/10 p-0 max-h-[85vh] overflow-y-auto overflow-x-hidden custom-scrollbar ${direction === 'up' ? 'origin-bottom-right' : 'origin-top-left'} z-[55] w-[90vw] sm:w-[380px] md:w-[450px] font-sans text-neutral-800 dark:text-neutral-100`}>
            <>
              {/* LEFT COLUMN: Sidebar (compact profile sidebar) */}
              <div className="w-full md:w-[160px] px-3 py-4 flex flex-col border-b md:border-b-0 md:border-r border-[#eee8d5] dark:border-white/5 md:self-stretch">
                {/* WORKSPACES SECTION */}
                {allTeams && allTeams.length > 0 ? (
                  <div className="flex flex-col gap-2 w-full text-left flex-grow overflow-hidden min-h-0">
                    <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider select-none px-0.5 shrink-0">
                      Workspaces
                    </div>
                    <div className="flex flex-col gap-1 w-full overflow-y-auto custom-scrollbar pr-0.5">
                      {allTeams.map(team => {
                        const isSelected = selectedTeam?.team_id === team.team_id;
                        const isPersonal =
                          team.is_personal_space ||
                          team.team_name?.toLowerCase() === 'workspace_1' ||
                          team.team_name?.toLowerCase() === 'workspace 1';
                        const displayName = isPersonal ? 'Personal Space' : team.team_name;
                        const initials = isPersonal ? 'PS' : displayName ? displayName.slice(0, 2).toUpperCase() : '??';
                        const storageMode = team.storageMode ?? 'cloud';
                        const isLocal = storageMode === 'local';
                        return (
                          <button
                            key={team.team_id}
                            onClick={e => {
                              e.stopPropagation();
                              dispatch(setSelectedTeam(team));
                            }}
                            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition-all ${isSelected
                              ? 'text-neutral-900 dark:text-white font-bold'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/50 dark:hover:bg-white/5'
                              }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-full border border-neutral-300 dark:border-white/10 flex items-center justify-center font-bold text-[9px] shrink-0 select-none ${isSelected
                                  ? 'text-neutral-900 dark:text-white'
                                  : 'text-neutral-700 dark:text-neutral-400'
                                  }`}>
                                {initials}
                              </div>
                              <span className="text-[10px] font-bold truncate max-w-[90px]">{displayName}</span>
                              {/* Storage mode badge */}
                              <span
                                className={`text-[8px] px-1 py-0.5 rounded font-semibold shrink-0 select-none ${isLocal
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                                  }`}>
                                {isLocal ? 'Local' : 'Cloud'}
                              </span>
                            </div>
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full text-left flex-grow justify-center items-center select-none text-neutral-400 dark:text-neutral-500 py-10">
                    <span className="text-xs font-semibold text-center leading-normal">No workspace found</span>
                  </div>
                )}

                {/* Social Icons at the bottom */}
                <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-[#eee8d5] dark:border-white/5 w-full shrink-0">
                  <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left">
                    Connect
                  </div>
                  <div className="flex flex-nowrap items-center justify-between gap-2 w-full mt-1 px-0.5">
                    <a
                      href="https://cmdos.slack.com/join/shared_invite/zt-3mycapoa9-afKNhqrFiGXAb7GS7zsOhA"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Slack"
                      onPointerDown={e => e.stopPropagation()}
                      className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                      <img src={getFaviconUrl('slack.com')} className="w-[18px] h-[18px] rounded-sm" alt="Slack" />
                    </a>
                    <a
                      href="https://www.reddit.com/r/cmdOS/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Reddit"
                      onPointerDown={e => e.stopPropagation()}
                      className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                      <img src={getFaviconUrl('reddit.com')} className="w-[18px] h-[18px] rounded-sm" alt="Reddit" />
                    </a>
                    <a
                      href="https://linkly.link/2ZTk0"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Discord"
                      onPointerDown={e => e.stopPropagation()}
                      className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                      <img src={getFaviconUrl('discord.com')} className="w-[18px] h-[18px] rounded-sm" alt="Discord" />
                    </a>
                    <a
                      href="https://x.com/cmdos_terminal"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="X"
                      onPointerDown={e => e.stopPropagation()}
                      className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                      <img src={getFaviconUrl('x.com')} className="w-[18px] h-[18px] rounded-sm" alt="X" />
                    </a>
                    <a
                      href="https://www.instagram.com/cmdos_terminal"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Instagram"
                      onPointerDown={e => e.stopPropagation()}
                      className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                      <img
                        src={getFaviconUrl('instagram.com')}
                        className="w-[18px] h-[18px] rounded-sm"
                        alt="Instagram"
                      />
                    </a>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex-1 p-4 flex flex-col gap-4 min-w-0">
                {/* Profile Header */}
                <SaaSControls
                  type="profileHeader"
                  isLoggedIn={isLoggedIn}
                  userInfo={userInfo}
                  personalSubscription={personalSubscription}
                  creditsLeft={creditsLeft}
                  formatDate={formatDate}
                  onOpenSubscriptions={onOpenSubscriptions}
                  onOpenManageSubscription={onOpenManageSubscription}
                  handleLogout={handleLogout}
                  setIsOpen={setIsOpen}
                />

                {/* Credits / Subscription Info */}
                <SaaSControls
                  type="credits"
                  isLoggedIn={isLoggedIn}
                  userInfo={userInfo}
                  personalSubscription={personalSubscription}
                  creditsLeft={creditsLeft}
                  formatDate={formatDate}
                  onOpenSubscriptions={onOpenSubscriptions}
                  onOpenManageSubscription={onOpenManageSubscription}
                  handleLogout={handleLogout}
                  setIsOpen={setIsOpen}
                />

                {/* Quick Actions Section */}
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider select-none">
                    Quick Actions
                  </span>

                  <div className="flex flex-col gap-1">
                    {/* Settings */}
                    <button
                      onPointerDown={e => {
                        e.stopPropagation();
                        onOpenGeneralSettings?.();
                        setIsOpen(false);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full flex items-center gap-2 py-1 transition-all text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                      <FiSettings size={14} className="text-[var(--color-iconDefault)] shrink-0" />
                      <span className="text-[11px] font-semibold">Settings</span>
                    </button>

                    {/* Workspace settings */}
                    {allTeams && allTeams.length > 0 && (
                      <button
                        onPointerDown={e => {
                          e.stopPropagation();
                          const isPersonal =
                            selectedTeam?.is_personal_space ||
                            selectedTeam?.team_name?.toLowerCase() === 'workspace_1' ||
                            selectedTeam?.team_name?.toLowerCase() === 'workspace 1';
                          const displayName = isPersonal
                            ? 'Personal Space'
                            : selectedTeam?.team_name || 'Personal Space';

                          if (onOpenOrganizationSettings && orgId) {
                            onOpenOrganizationSettings(orgId, displayName);
                          } else {
                            onCommandListCategoryChange?.('settings');
                            if (!isCommandListView) {
                              onToggleCommandListView();
                            }
                          }
                          setIsOpen(false);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full flex items-center gap-2 py-1 transition-all text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                        <FiSettings size={14} className="text-[var(--color-iconDefault)] shrink-0" />
                        <span className="text-[11px] font-semibold">Workspace settings</span>
                      </button>
                    )}

                    {/* Theme */}
                    <button
                      onPointerDown={e => {
                        e.stopPropagation();
                        dispatch(navigateToView({ kind: 'generalSettings', section: 'appearance' }));
                        setIsOpen(false);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full flex items-center gap-2 py-1 transition-all text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                      <FaPalette size={14} className="text-[var(--color-iconDefault)] shrink-0" />
                      <span className="text-[11px] font-semibold">Theme</span>
                    </button>

                    {/* Search Settings */}
                    <button
                      onPointerDown={e => {
                        e.stopPropagation();
                        dispatch(navigateToView({ kind: 'generalSettings', section: 'searchView' }));
                        setIsOpen(false);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full flex items-center gap-2 py-1 transition-all text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                      <FiSearch size={14} className="text-[var(--color-iconDefault)] shrink-0" />
                      <span className="text-[11px] font-semibold">Search Settings</span>
                    </button>

                    {/* SaaS Quick Actions (Profile, Billing, Sign Out) */}
                    <SaaSControls
                      type="quickActions"
                      isLoggedIn={isLoggedIn}
                      userInfo={userInfo}
                      personalSubscription={personalSubscription}
                      creditsLeft={creditsLeft}
                      formatDate={formatDate}
                      onOpenSubscriptions={onOpenSubscriptions}
                      onOpenManageSubscription={onOpenManageSubscription}
                      handleLogout={handleLogout}
                      setIsOpen={setIsOpen}
                    />
                  </div>
                </div>
              </div>
            </>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOmniboxConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-primary,white)] dark:bg-neutral-900 border border-[var(--border-color,#e5e7eb)] dark:border-neutral-800 rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4">
              <h3 className="text-lg font-medium text-[var(--color-textPrimary)] mb-2">Disable Search Focus?</h3>
              <p className="text-sm text-[var(--color-textSecondary)] mb-6">
                This will return your new tab search behavior back to Google. Are you sure?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDisableOmnibox}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary,#6b7280)] dark:text-neutral-300 hover:bg-[var(--bg-secondary,#f3f4f6)] dark:hover:bg-neutral-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={confirmDisableOmnibox}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                  Disable
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(HeaderControls);
