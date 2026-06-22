import React, { useState, useEffect } from 'react';
import {
  FiList,
  FiSettings,
  FiDatabase,
  FiLogOut,
  FiSearch,
  FiCreditCard,
  FiChevronDown,
} from 'react-icons/fi';
import { FaUser, FaPalette } from 'react-icons/fa';
import { useSelector, useDispatch } from 'react-redux';
import { navigateToView } from '../../../../Redux/AllData/uiStateSlice';
import { revokeRemoteSession } from '../../../../Apis/services/logoutService';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

// Lazy load/import the sub panels to avoid circular dependency or import issues.
import GeneralSettingsPanel from './GeneralSettingsPanel';
import BackupPanel from './BackupPanel';
import AllWorkspacesPanel from './AllWorkspacesPanel';
import WorkspaceSettingsPanel from './WorkspaceSettingsPanel';

interface SettingsLayoutProps {
  view: {
    kind: 'generalSettings' | 'backup' | 'allWorkspaces' | 'workspaceSettings';
    section?: 'profile' | 'billing' | 'appearance' | 'searchView';
  };
  onClose: () => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ view, onClose }) => {
  const dispatch = useDispatch();

  // User info from chrome storage
  const [userInitials, setUserInitials] = useState<string>('ME');
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string } | null>(null);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['user_info', 'user_name'], (res: any) => {
        const name = res.user_info?.name || res.user_name || 'Me';
        const parts = name.split(/\s+/);
        const initials = parts.filter(Boolean).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
        if (initials) setUserInitials(initials);
        if (res.user_info) {
          setUserInfo(res.user_info);
        } else if (res.user_name) {
          setUserInfo({ name: res.user_name, email: 'user@cmdos.dev' });
        }
      });
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
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
        'accessToken', 'profileImg', 'loggedIn', 'user_name', 'user_email',
        'myCachedAllData', 'orgRefreshCounters', 'last_org_counter_check_timestamp', 'last_org_counter_check_result',
      ];
      chromeAny.storage.local.remove(KEYS_TO_REMOVE, () => { window.location.reload(); });
    } else {
      window.location.reload();
    }
  };

  const currentTab = view.kind;
  const currentSection = view.section;

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebarSections = [
    {
      title: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile Settings', icon: FaUser, active: currentTab === 'generalSettings' && currentSection === 'profile', onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'profile' })) },
        { id: 'billing', label: 'Billing & Plan', icon: FiCreditCard, active: currentTab === 'generalSettings' && currentSection === 'billing', onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'billing' })) },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: currentTab === 'allWorkspaces', onClick: () => dispatch(navigateToView({ kind: 'allWorkspaces' })) },
        { id: 'workspaceSettings', label: 'Workspace Settings', icon: FiSettings, active: currentTab === 'workspaceSettings', onClick: () => dispatch(navigateToView({ kind: 'workspaceSettings' })) },
        { id: 'backup', label: 'Cloud Sync & Backup', icon: FiDatabase, active: currentTab === 'backup', onClick: () => dispatch(navigateToView({ kind: 'backup' })) },
      ],
    },
    {
      title: 'UX APPEARANCE',
      items: [
        { id: 'appearance', label: 'Theme', icon: FaPalette, active: currentTab === 'generalSettings' && currentSection === 'appearance', onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'appearance' })) },
        { id: 'searchView', label: 'Search Settings', icon: FiSearch, active: currentTab === 'generalSettings' && currentSection === 'searchView', onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'searchView' })) },
      ],
    },
  ] as const;

  return (
    <div className="flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200">
      {/* ── LEFT SIDEBAR ───────────────────────────────────────────── */}
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
                        onClick={item.onClick ?? undefined}
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

        <div className="flex flex-col gap-3 w-full mt-auto pt-4 relative">
          {/* Logout Popup Menu */}
          {showLogoutMenu && (
            <>
              <div 
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setShowLogoutMenu(false)}
              />
              <div className="absolute bottom-[105px] left-2 right-2 bg-neutral-900 border border-white/10 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <button
                  onClick={() => {
                    setShowLogoutMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-all cursor-pointer"
                >
                  <FiLogOut size={14} className="text-red-500" />
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}

          {/* Profile Card */}
          <div 
            onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            className="flex items-center gap-2 p-2 rounded-xl w-full text-left cursor-pointer hover:bg-white/5 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
              {userInfo?.image_url ? (
                <img src={userInfo.image_url} alt={userInfo.name} className="w-full h-full object-cover" />
              ) : (
                userInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate leading-tight">
                {userInfo?.name || 'Me'}
              </div>
              <div className="text-[9px] text-neutral-400 truncate mt-0.5">
                {userInfo?.email || 'Local Account'}
              </div>
            </div>
            <FiChevronDown size={14} className="text-neutral-400 shrink-0" />
          </div>

          {/* Socials / Connect */}
          <div className="pt-2 border-t border-white/5 space-y-1">
            <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left uppercase opacity-80 px-0.5">
              Connect
            </div>
            <div className="flex flex-nowrap items-center justify-between gap-1 w-full mt-1 px-0.5">
              {[
                { href: 'https://cmdos.slack.com/join/shared_invite/zt-3mycapoa9-afKNhqrFiGXAb7GS7zsOhA', domain: 'slack.com', title: 'Slack' },
                { href: 'https://www.reddit.com/r/cmdOS/', domain: 'reddit.com', title: 'Reddit' },
                { href: 'https://linkly.link/2ZTk0', domain: 'discord.com', title: 'Discord' },
                { href: 'https://x.com/cmdos_terminal', domain: 'x.com', title: 'X' },
                { href: 'https://www.instagram.com/cmdos_terminal', domain: 'instagram.com', title: 'Instagram' },
              ].map(social => (
                <a
                  key={social.domain}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.title}
                  onPointerDown={e => e.stopPropagation()}
                  className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
                >
                  <img src={getFaviconUrl(social.domain)} className="w-[18px] h-[18px] rounded-sm" alt={social.title} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT CONTENT PANE ─────────────────────────────────────── */}
      {currentTab === 'generalSettings' && (
        <GeneralSettingsPanel hideSidebar onClose={onClose} initialTab={currentSection} />
      )}
      {currentTab === 'backup' && (
        <BackupPanel hideSidebar onClose={onClose} />
      )}
      {currentTab === 'allWorkspaces' && (
        <AllWorkspacesPanel hideSidebar onClose={onClose} />
      )}
      {currentTab === 'workspaceSettings' && (
        <WorkspaceSettingsPanel hideSidebar onClose={onClose} />
      )}
    </div>
  );
};

export default SettingsLayout;
