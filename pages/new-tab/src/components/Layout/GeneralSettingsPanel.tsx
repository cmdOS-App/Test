import React, { useState, useEffect, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import { motion } from 'framer-motion';
import { FiX, FiCheck, FiUpload, FiDatabase, FiSearch, FiLayout, FiList, FiGrid, FiCreditCard, FiSettings, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { FaPalette, FaUser } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { useDispatch } from 'react-redux';
import { navigateToView } from '../../../../Redux/AllData/uiStateSlice';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { getUserId, getActiveSubscriptions, getUserInfo } from '../../../../Apis/core/api';
import { getCreditBalance } from '@private-services/subscriptionApi';
import { revokeRemoteSession } from '../../../../Apis/services/logoutService';
import ManageSubscriptionPanel from '../Subscriptions/ManageSubscriptionPanel';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

interface GeneralSettingsPanelProps {
  onClose: () => void;
  initialTab?: string;
  hideSidebar?: boolean;
}

const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({ onClose, initialTab = 'searchView', hideSidebar }) => {
  const dispatch = useDispatch();
  const { themeId, setTheme: setThemeProfile, wallpaperId, setWallpaper } = useAppearance();
  const [customWallpaperPreview, setCustomWallpaperPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search View settings hooks
  const [isBoardViewEnabled, setIsBoardViewEnabled] = useChromeStorage<boolean>('new_tab_is_board_view_enabled', true);
  const [autoTriggerDropdown, setAutoTriggerDropdown] = useChromeStorage<boolean>('rtq_focus_on', true);

  // Layout selection state
  const [currentLayout, setCurrentLayout] = useState<'board' | 'list' | 'sheet'>('board');

  // Profile data states
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string } | null>(null);
  const [userInitials, setUserInitials] = useState<string>('ME');
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [personalSubscription, setPersonalSubscription] = useState<any>(null);

  // Tab Selection State
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'searchView' | 'appearance'>('searchView');

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['user_info', 'user_name'], (res: any) => {
        const name = res.user_info?.name || res.user_name || 'Me';
        const parts = name.split(/\s+/);
        const initials = parts.filter(Boolean).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
        if (initials) {
          setUserInitials(initials);
        }
        if (res.user_info) {
          setUserInfo(res.user_info);
        } else if (res.user_name) {
          setUserInfo({ name: res.user_name, email: 'user@cmdos.dev' });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (initialTab === 'appearance') {
      setActiveTab('appearance');
    } else if (initialTab === 'profile') {
      setActiveTab('profile');
    } else if (initialTab === 'billing') {
      setActiveTab('billing');
    } else {
      setActiveTab('searchView');
    }
  }, [initialTab]);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['new_tab_is_board_view_enabled', 'new_tab_view_mode_temp'], (result: any) => {
        if (result.new_tab_view_mode_temp) {
          setCurrentLayout(result.new_tab_view_mode_temp);
        } else {
          setCurrentLayout(result.new_tab_is_board_view_enabled === false ? 'list' : 'board');
        }
      });
    }
  }, []);

  const handleSelectLayout = (mode: 'board' | 'list' | 'sheet') => {
    setCurrentLayout(mode);
    if (mode === 'board') {
      setIsBoardViewEnabled(true);
    } else if (mode === 'list') {
      setIsBoardViewEnabled(false);
    }
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_view_mode_temp: mode });
    }
    window.dispatchEvent(new CustomEvent('setViewMode', { detail: mode }));
  };

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['custom-wallpaper-base64'], result => {
        if (result['custom-wallpaper-base64']) {
          setCustomWallpaperPreview(result['custom-wallpaper-base64']);
        }
      });
    }
  }, []);

  // Fetch Profile data when the tab is 'profile'
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const chromeAny = (window as any).chrome;
        if (!chromeAny?.storage?.local) return;

        // Try getting cached data first
        const storage = await chromeAny.storage.local.get([
          'user_info',
          'personal_subscription',
        ]);

        if (storage.user_info) {
          setUserInfo(storage.user_info);
        }
        if (storage.personal_subscription) {
          setPersonalSubscription(storage.personal_subscription);
        }

        // Fetch fresh info
        const userId = await getUserId();
        if (userId) {
          const info = await getUserInfo(userId);
          if (info && info.user) {
            const { user } = info;
            const fullName = user.first_name
              ? `${user.first_name} ${user.last_name || ''}`.trim()
              : user.email.split('@')[0];

            const data = { email: user.email, name: fullName, image_url: user.image_url || user.profile_image_url };
            setUserInfo(data);
            await chromeAny.storage.local.set({ user_info: data });
          }

          // Fetch active subscriptions
          try {
            const subs = await getActiveSubscriptions(userId);
            const freeOrgSub = subs.find(
              sub =>
                (sub.organization_id && sub.organization_id.startsWith('free_org_')) ||
                (sub.org_id && sub.org_id.startsWith('free_org_')),
            );
            const targetSub = freeOrgSub || subs[0];
            if (targetSub) {
              setPersonalSubscription(targetSub);
              await chromeAny.storage.local.set({ personal_subscription: targetSub });
            }
          } catch (e) {
            console.error('Failed to fetch subscriptions:', e);
          }

          // Fetch credits from personal workspace
          try {
            const teamsResult = await chromeAny.storage.local.get('myCachedAllData');
            const allTeams = teamsResult.myCachedAllData || [];
            const personalTeam = allTeams.find((t: any) => t.is_personal_space);
            const personalOrgId = personalTeam?.team_id || '';

            if (personalOrgId) {
              const balanceInfo = await getCreditBalance(userId, personalOrgId);
              let balance = null;
              if (balanceInfo?.credits !== undefined) balance = balanceInfo.credits;
              else if (balanceInfo?.credits_left !== undefined) balance = balanceInfo.credits_left;
              else if (balanceInfo?.user?.credits_left !== undefined) balance = balanceInfo.user.credits_left;
              
              if (balance !== null) {
                setCreditsLeft(balance);
              }
            }
          } catch (e) {
            console.error('Failed to fetch credits:', e);
          }
        }
      } catch (err) {
        console.error('Failed to load profile data in settings:', err);
      }
    };

    if (activeTab === 'profile') {
      fetchProfileData();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    const chromeAny = (window as any)?.chrome;
    const storedResult = await new Promise<{ accessToken?: string }>(resolve => {
      if (chromeAny?.storage?.local?.get) {
        chromeAny.storage.local.get('accessToken', (res: any) => resolve(res || {}));
      } else {
        resolve({});
      }
    });
    const userId = storedResult?.accessToken;
    if (userId && typeof userId === 'string' && userId.startsWith('user_')) {
      await revokeRemoteSession(userId).catch(console.error);
    }
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setCustomWallpaperPreview(base64);
        if (typeof window !== 'undefined') {
          localStorage.setItem('wallpaper-id', 'custom');
        }
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ 'custom-wallpaper-base64': base64 });
        }
        await setWallpaper('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const toTitleCase = (str: string) => {
    return str
      .replace(/[-_]/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  };

  const sidebarSections = [
    {
      title: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile Settings', icon: FaUser, active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
        { id: 'billing', label: 'Billing & Plan', icon: FiCreditCard, active: activeTab === 'billing', onClick: () => setActiveTab('billing') },
        { id: 'logout', label: 'Logout', icon: FiLogOut, active: false, onClick: handleLogout, isDanger: true },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: false, onClick: () => dispatch(navigateToView({ kind: 'allWorkspaces' })) },
        { id: 'workspaceSettings', label: 'Workspace Settings', icon: FiSettings, active: false, onClick: () => dispatch(navigateToView({ kind: 'workspaceSettings' })) },
        { id: 'backup', label: 'Cloud Sync & Backup', icon: FiDatabase, active: false, onClick: () => dispatch(navigateToView({ kind: 'backup' })) },
      ],
    },
    {
      title: 'UX APPEARANCE',
      items: [
        { id: 'appearance', label: 'Theme', icon: FaPalette, active: activeTab === 'appearance', onClick: () => setActiveTab('appearance') },
        { id: 'searchView', label: 'Search Settings', icon: FiSearch, active: activeTab === 'searchView', onClick: () => setActiveTab('searchView') },
      ],
    },
  ] as const;

  const wallpaperModules = (import.meta as any).glob('../../../public/images/wallappear/*.{png,jpg,jpeg,webp,gif}');
  
  const wallpapers = [
    { id: 'none', label: 'None', src: '' },
    ...(customWallpaperPreview ? [{ id: 'custom', label: 'Custom Image', src: customWallpaperPreview }] : []),
    ...Object.keys(wallpaperModules).map(path => {
      const filename = path.split('/').pop() || '';
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      return {
        id: filename,
        label: toTitleCase(nameWithoutExt),
        src: `new-tab/images/wallappear/${filename}`,
      };
    })
  ];

  const getWallpaperUrl = (wall: typeof wallpapers[number]) => {
    if (wall.id === 'custom') return wall.src;
    if (!wall.src) return '';
    return typeof chrome !== 'undefined' && chrome.runtime?.getURL 
      ? chrome.runtime.getURL(wall.src) 
      : '/' + wall.src;
  };

  return (
    <div className={hideSidebar ? "flex-1 flex flex-col min-w-0" : "flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200"}>
      {/* LEFT SIDEBAR */}
      {!hideSidebar && (
        <div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-5 flex flex-col justify-between">
        <div className="space-y-6">
          <nav className="space-y-6">
            {sidebarSections.map(section => (
              <div key={section.title} className="space-y-2">
                <div className="px-3 text-[9px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isDanger = 'isDanger' in item && item.isDanger;
                    return (
                      <div
                        key={item.id}
                        onClick={item.onClick}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left text-xs font-semibold transition-all relative cursor-pointer ${
                          item.active
                            ? 'text-[var(--color-textPrimary)] bg-[var(--color-selectedBg)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                            : isDanger
                            ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
                            : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                        }`}
                      >
                        <Icon size={14} className={isDanger ? 'text-red-500' : 'text-[var(--color-accent)]'} />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 w-full mt-auto pt-4">
          
          {/* Profile Card */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 w-full text-left">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
              {userInfo?.image_url ? (
                <img src={userInfo.image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[var(--color-textPrimary)] truncate">
                {userInfo?.name || 'User'}
              </div>
              <div className="text-[10px] text-[var(--color-textMuted)] truncate mt-0.5">
                {userInfo?.email || 'user@cmdos.dev'}
              </div>
            </div>
            <FiChevronDown size={14} className="text-[var(--color-textMuted)] shrink-0" />
          </div>

          {/* Social Icons Connect Section */}
          <div className="flex flex-col gap-1.5 w-full shrink-0 border-t border-white/5 pt-3">
            <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left uppercase opacity-80 px-0.5">
              Connect
            </div>
            <div className="flex flex-nowrap items-center justify-between gap-1 w-full mt-1 px-0.5">
              <a
                href="https://cmdos.slack.com/join/shared_invite/zt-3mycapoa9-afKNhqrFiGXAb7GS7zsOhA"
                target="_blank"
                rel="noopener noreferrer"
                title="Slack"
                onPointerDown={e => e.stopPropagation()}
                className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
              >
                <img src={getFaviconUrl('slack.com')} className="w-[18px] h-[18px] rounded-sm" alt="Slack" />
              </a>
              <a
                href="https://www.reddit.com/r/cmdOS/"
                target="_blank"
                rel="noopener noreferrer"
                title="Reddit"
                onPointerDown={e => e.stopPropagation()}
                className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
              >
                <img src={getFaviconUrl('reddit.com')} className="w-[18px] h-[18px] rounded-sm" alt="Reddit" />
              </a>
              <a
                href="https://linkly.link/2ZTk0"
                target="_blank"
                rel="noopener noreferrer"
                title="Discord"
                onPointerDown={e => e.stopPropagation()}
                className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
              >
                <img src={getFaviconUrl('discord.com')} className="w-[18px] h-[18px] rounded-sm" alt="Discord" />
              </a>
              <a
                href="https://x.com/cmdos_terminal"
                target="_blank"
                rel="noopener noreferrer"
                title="X"
                onPointerDown={e => e.stopPropagation()}
                className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
              >
                <img src={getFaviconUrl('x.com')} className="w-[18px] h-[18px] rounded-sm" alt="X" />
              </a>
              <a
                href="https://www.instagram.com/cmdos_terminal"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                onPointerDown={e => e.stopPropagation()}
                className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
              >
                <img
                  src={getFaviconUrl('instagram.com')}
                  className="w-[18px] h-[18px] rounded-sm"
                  alt="Instagram"
                />
              </a>
            </div>
          </div>

        </div>
        </div>
      )}
      {/* RIGHT CONTENT PANE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
        {/* Header bar */}
        <div className="flex items-center justify-between p-6 pb-2 shrink-0">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--color-textPrimary)] tracking-tight">
              {activeTab === 'profile' && 'Profile Settings'}
              {activeTab === 'billing' && 'Billing & Plan'}
              {activeTab === 'searchView' && 'Search View'}
              {activeTab === 'appearance' && 'Appearance'}
            </h1>
            <p className="text-xs text-[var(--color-textSecondary)] mt-1">
              {activeTab === 'profile' && 'Manage your user profile details, plans, and credits.'}
              {activeTab === 'billing' && 'Manage your payments, subscription plans, and billing history.'}
              {activeTab === 'searchView' && 'Configure your layout preferences and command-first search triggers.'}
              {activeTab === 'appearance' && 'Choose your default workspace theme appearance.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close Settings"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Scrollable container */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  User Profile
                </h3>

                {/* Profile Card */}
                <div className="glass-card border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 text-left bg-neutral-900/30">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full border-2 border-emerald-500 bg-neutral-800 flex items-center justify-center font-bold text-3xl text-white select-none overflow-hidden shrink-0">
                    {userInfo?.image_url ? (
                      <img src={userInfo.image_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{userInfo?.name?.charAt(0).toUpperCase() || '?'}</span>
                    )}
                  </div>

                  {/* Profile info */}
                  <div className="flex-grow flex flex-col justify-center min-w-0 text-center sm:text-left">
                    <h2 className="text-lg font-bold text-white truncate">
                      {userInfo?.name || 'Loading Name...'}
                    </h2>
                    <p className="text-xs text-[var(--color-textSecondary)] mt-1 truncate">
                      {userInfo?.email || 'Loading Email...'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3 items-center justify-center sm:justify-start">
                      <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold select-none">
                        {personalSubscription?.stripe_user_id ? 'Pro Plan' : 'Free Plan'}
                      </span>
                      {!personalSubscription?.stripe_user_id && (
                        <button
                          onClick={() => setActiveTab('billing')}
                          className="text-[10px] px-2.5 py-1 bg-amber-500 text-neutral-950 font-bold rounded flex items-center gap-1 hover:bg-amber-400 transition-colors shadow-md cursor-pointer border-none">
                          <LuSparkles size={11} />
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage & Limits Card */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Usage & Limits
                </h3>

                <div className="glass-card border border-white/10 rounded-xl p-5 text-left bg-neutral-900/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-white">AI Credits</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {creditsLeft !== null ? `${creditsLeft} / 400` : '0 / 400'} Credits Left
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((creditsLeft ?? 0) / 400) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10.5px] text-[var(--color-textSecondary)] mt-3">
                    Credits are consumed when running automation tasks or querying the AI assistant. Upgrade to increase your limit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="w-full h-full min-h-[400px] overflow-hidden rounded-xl bg-neutral-900/10">
              <ManageSubscriptionPanel onClose={onClose} />
            </div>
          )}

          {activeTab === 'searchView' && (
            <div className="space-y-6">
              {/* LAYOUT SELECTION SECTION */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Select Layout
                </h3>
                <div className="flex flex-wrap gap-4">
                  {/* Board View Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectLayout('board')}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-[#0d0e12] transition-all relative overflow-hidden shadow-md flex items-center justify-center border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] ${
                      currentLayout === 'board'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 text-neutral-400">
                      <FiLayout size={24} className={currentLayout === 'board' ? 'text-emerald-500' : 'text-neutral-400'} />
                    </div>
                    {currentLayout === 'board' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Board View</span>
                    </div>
                  </motion.div>

                  {/* List View Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectLayout('list')}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-[#0d0e12] transition-all relative overflow-hidden shadow-md flex items-center justify-center border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] ${
                      currentLayout === 'list'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 text-neutral-400">
                      <FiList size={24} className={currentLayout === 'list' ? 'text-emerald-500' : 'text-neutral-400'} />
                    </div>
                    {currentLayout === 'list' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">List View</span>
                    </div>
                  </motion.div>

                  {/* Sheet UI Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectLayout('sheet')}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-[#0d0e12] transition-all relative overflow-hidden shadow-md flex items-center justify-center border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] ${
                      currentLayout === 'sheet'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 text-neutral-400">
                      <FiGrid size={24} className={currentLayout === 'sheet' ? 'text-emerald-500' : 'text-neutral-400'} />
                    </div>
                    {currentLayout === 'sheet' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Sheet UI</span>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* SEARCH PREFERENCES SECTION */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Search Preferences
                </h3>
                
                <div className="glass-card border border-white/10 rounded-xl p-4 flex flex-col gap-3 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">Command-first search</span>
                      <p className="text-[10.5px] text-[var(--color-textSecondary)] mt-1">
                        Clicking search opens command-first results so you can narrow choices faster.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoTriggerDropdown(!autoTriggerDropdown)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${
                        autoTriggerDropdown ? 'bg-emerald-500' : 'bg-neutral-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${
                          autoTriggerDropdown ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Turn off to use normal search results instead.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* THEME SELECTION SECTION */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Select Theme
                </h3>
                <div className="flex flex-wrap gap-4">
                  {/* Theme Card 1: Default Dark */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setThemeProfile('default-dark')}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-black transition-all relative overflow-hidden shadow-md ${
                      themeId === 'default-dark'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                        : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                    }`}
                  >
                    {/* Subtle inner border for contrast */}
                    <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                    {/* Active Indicator Checkmark */}
                    {themeId === 'default-dark' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}

                    {/* Name Pill (Bottom Left Overlay) */}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Dark</span>
                    </div>
                  </motion.div>

                  {/* Theme Card 2: Ocean Blue */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setThemeProfile('ocean-blue')}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] bg-[#090e1a] transition-all relative overflow-hidden shadow-md ${
                      themeId === 'ocean-blue'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                        : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                    }`}
                  >
                    {/* Subtle inner border for contrast */}
                    <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                    {/* Active Indicator Checkmark */}
                    {themeId === 'ocean-blue' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}

                    {/* Name Pill (Bottom Left Overlay) */}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Ocean Blue</span>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* WALLPAPER SELECTION SECTION */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Select Wallpaper
                </h3>
                <div className="flex flex-wrap gap-4">
                  {wallpapers.map(wall => {
                    const isActive = wallpaperId === wall.id;
                    const bgStyle = wall.id === 'none'
                      ? { backgroundColor: '#111' }
                      : {
                          backgroundImage: `url('${getWallpaperUrl(wall)}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        };

                    return (
                      <motion.div
                        key={wall.id}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setWallpaper(wall.id)}
                        style={bgStyle}
                        className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md ${
                          isActive
                            ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                            : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                        }`}
                      >
                        {/* Subtle inner border for contrast */}
                        <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                        {/* Active Indicator Checkmark */}
                        {isActive && (
                          <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                            <FiCheck size={11} className="stroke-[3]" />
                          </div>
                        )}

                        {/* Name Pill (Bottom Left Overlay) */}
                        <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                          <span className="text-[10px] font-bold text-white tracking-wide">{wall.label}</span>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Upload Custom Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUploadClick}
                    className="cursor-pointer border border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-900/20 rounded-xl w-[160px] h-[95px] transition-all relative flex flex-col items-center justify-center gap-1.5 shadow-md"
                  >
                    <FiUpload className="text-neutral-400" size={18} />
                    <span className="text-[10px] font-bold text-neutral-400 tracking-wide">Upload Custom</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </motion.div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneralSettingsPanel;
