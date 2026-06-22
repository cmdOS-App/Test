import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronDown,
  FiChevronRight,
  FiX,
  FiCheck,
  FiList,
  FiSettings,
  FiDatabase,
  FiCloud,
  FiHardDrive,
  FiFileText,
  FiZap,
  FiLogOut,
  FiLink,
  FiTerminal,
  FiExternalLink,
  FiDownload,
  FiUpload,
  FiLock,
} from 'react-icons/fi';
import { FaUser, FaPalette } from 'react-icons/fa';
import { FiCreditCard, FiSearch } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { navigateToView, setSelectedTeam, setSelectedWorkspace } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import type { Team, Workspace, Folder } from '../../../../modals/interfaces';
import { exportBackup } from '../../../../Apis/services/backupService';
import { revokeRemoteSession } from '../../../../Apis/services/logoutService';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

interface WorkspaceSettingsPanelProps {
  onClose: () => void;
}

interface WorkspaceRowData {
  id: string;
  name: string;
  teamName: string;
  isPersonal: boolean;
  storageMode: 'local' | 'cloud';
  path: string;
  todosCount: number;
  automationsCount: number;
  notesCount: number;
  linksCount: number;
  snippetsCount: number;
  sizeEstimate: string;
  lastSync: string;
  lastBackup: string;
  team: Team;
  workspace: Workspace;
  members: string[]; // Actual user initials
}

export const WorkspaceSettingsPanel: React.FC<WorkspaceSettingsPanelProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const allTeams = useSelector(selectAllData) || [];

  // Currently selected workspace for the right inspector panel
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load real user initials from local storage
  const [userInitials, setUserInitials] = useState<string>('ME');
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string } | null>(null);

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

  // Helper to count items inside a single workspace based on actual categories
  const getWorkspaceMetrics = (ws: Workspace) => {
    let todos = 0;
    let automations = (ws.workspace_automations || []).length;
    let notes = 0;
    let links = 0;
    let snippets = 0;

    const processSnippets = (snippetsList: any[]) => {
      for (const s of snippetsList) {
        if (s.is_todo_type || s.event_deadline) {
          todos++;
        } else {
          const category = (s.category || '').toLowerCase();
          if (category === 'note' || category === 'notes' || category === 'node' || category === 'nodes') {
            notes++;
          } else if (
            category === 'link' ||
            category === 'links' ||
            category === 'quicklink' ||
            category === 'tabgroup' ||
            category === 'tab group'
          ) {
            links++;
          } else {
            snippets++;
          }
        }
      }
    };

    processSnippets(ws.workspace_snippets || []);

    const processFolders = (foldersList: Folder[]) => {
      for (const f of foldersList) {
        processSnippets(f.snippets || []);
        automations += (f.automations || []).length;
        if (f.folders && f.folders.length > 0) {
          processFolders(f.folders);
        }
      }
    };

    processFolders(ws.folders || []);

    return { todos, automations, notes, links, snippets };
  };

  // Map Redux store data to row models
  const workspacesList = useMemo<WorkspaceRowData[]>(() => {
    const list: WorkspaceRowData[] = [];

    allTeams.forEach((team: Team) => {
      const teamName = team.team_name || 'Workspace';
      const isPersonal = team.is_personal_space || teamName.toLowerCase().includes('personal');
      const storageMode = (team as any).storageMode === 'local' ? 'local' : 'cloud';

      (team.workspaces || []).forEach((ws: Workspace) => {
        const metrics = getWorkspaceMetrics(ws);
        const totalItems = metrics.todos + metrics.automations + metrics.notes + metrics.links + metrics.snippets;
        
        // Dynamic realistic size estimation
        const sizeKB = Math.max(10, totalItems * 8.5);
        const sizeEstimate = sizeKB > 1024 
          ? `${(sizeKB / 1024).toFixed(1)} MB` 
          : `${sizeKB.toFixed(0)} KB`;

        // Simulate realistic status times
        const lastSync = storageMode === 'cloud' ? '2m ago' : '—';
        const lastBackup = 'Today, 6:36 PM';

        const displayName = isPersonal ? 'Personal Space' : teamName;

        list.push({
          id: ws.workspace_id,
          name: displayName,
          teamName: isPersonal ? 'Personal Space' : teamName,
          isPersonal,
          storageMode,
          path: storageMode === 'cloud' 
            ? `/cloud/${teamName.replace(/\s+/g, '-').toLowerCase()}/${displayName.toLowerCase().replace(/\s+/g, '-')}`
            : `/local/${displayName.toLowerCase().replace(/\s+/g, '-')}`,
          todosCount: metrics.todos,
          automationsCount: metrics.automations,
          notesCount: metrics.notes,
          linksCount: metrics.links,
          snippetsCount: metrics.snippets,
          sizeEstimate,
          lastSync,
          lastBackup,
          team,
          workspace: ws,
          members: [userInitials],
        });
      });
    });

    return list;
  }, [allTeams, userInitials]);

  // Set default selection to first workspace if none selected yet
  useMemo(() => {
    if (!selectedId && workspacesList.length > 0) {
      setSelectedId(workspacesList[0].id);
    }
  }, [workspacesList, selectedId]);

  const selectedWorkspace = useMemo(() => {
    return workspacesList.find(w => w.id === selectedId) || null;
  }, [workspacesList, selectedId]);

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

  const sidebarSections = [
    {
      title: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile Settings', icon: FaUser, active: false, onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'profile' })) },
        { id: 'billing', label: 'Billing & Plan', icon: FiCreditCard, active: false, onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'billing' })) },
        { id: 'logout', label: 'Logout', icon: FiLogOut, active: false, onClick: handleLogout, isDanger: true },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: false, onClick: () => dispatch(navigateToView({ kind: 'allWorkspaces' })) },
        { id: 'workspaceSettings', label: 'Workspace Settings', icon: FiSettings, active: true, onClick: undefined },
        { id: 'backup', label: 'Cloud Sync & Backup', icon: FiDatabase, active: false, onClick: () => dispatch(navigateToView({ kind: 'backup' })) },
      ],
    },
    {
      title: 'UX APPEARANCE',
      items: [
        { id: 'appearance', label: 'Theme', icon: FaPalette, active: false, onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'appearance' })) },
        { id: 'searchView', label: 'Search Settings', icon: FiSearch, active: false, onClick: () => dispatch(navigateToView({ kind: 'generalSettings', section: 'searchView' })) },
      ],
    },
  ] as const;

  const avatarColors = ['bg-blue-500', 'bg-teal-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-green-500', 'bg-rose-500'];

  const GoogleDriveIcon = () => (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l25.4-44c.8-1.4 1.2-2.95 1.2-4.5h-55l13.75 23.8z" fill="#ffbc00"/>
    </svg>
  );

  const LocalFolderIcon = () => (
    <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );  return (
    <div className="flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200">
      
        
        {/* LEFT SIDEBAR */}
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

        {/* RIGHT CONTENT PANE */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
          
          {/* Header bar */}
          <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b border-[var(--color-borderDefault)]/60">
            <div>
              <h1 className="text-xl font-extrabold text-[var(--color-textPrimary)] tracking-tight">
                Workspace Settings
              </h1>
              <p className="text-xs text-[var(--color-textSecondary)] mt-1">
                Manage your workspaces, settings, and team collaboration.
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

          {/* Workspaces List/Table */}
          <div className="flex-1 flex min-h-0 w-full overflow-hidden">
            
            <div className="flex-grow overflow-auto custom-scrollbar p-6">
              <div className="w-full border border-white/5 bg-neutral-900/10 rounded-xl overflow-hidden">
                
                {/* Spreadsheet Header Row */}
                <div className="grid grid-cols-[1.5fr_1.8fr_1.2fr_2fr] items-stretch border-b border-white/5 bg-white/5 py-3 px-4 text-xs font-semibold text-neutral-400 select-none">
                  <div>Workspace</div>
                  <div>Existing Members</div>
                  <div>Invite Link</div>
                  <div>Manage pending join requests</div>
                </div>

                {/* Spreadsheet Body Rows */}
                {workspacesList.length === 0 ? (
                  <div className="flex-grow flex items-center justify-center text-xs text-[var(--color-textMuted)] py-12">
                    No workspaces found.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {workspacesList.map(ws => {
                      const isSelected = selectedId === ws.id;

                      return (
                        <div 
                          key={ws.id} 
                          onClick={() => setSelectedId(ws.id)}
                          className={`grid grid-cols-[1.5fr_1.8fr_1.2fr_2fr] py-4 px-4 text-xs items-center cursor-pointer select-none transition-colors ${
                            isSelected ? 'bg-[var(--color-selectedBg)]/30' : 'hover:bg-white/[0.01]'
                          }`}
                        >
                          {/* Workspace Name & tag */}
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="font-semibold text-white truncate">
                              {ws.name}
                            </span>
                          </div>

                          {/* Existing Members */}
                          <div className="flex flex-col justify-center gap-1.5 min-w-0 pr-2">
                            <div className="flex items-center -space-x-1.5 overflow-hidden">
                              {ws.members.slice(0, 6).map((initial, idx) => (
                                <div
                                  key={idx}
                                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold text-white border border-[var(--color-modalBg)] ${
                                    avatarColors[idx % avatarColors.length]
                                  }`}
                                >
                                  {initial}
                                </div>
                              ))}
                              {ws.members.length > 6 && (
                                <div className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold text-[var(--color-textMuted)] bg-[var(--color-hoverBg)] border border-[var(--color-modalBg)]">
                                  +{ws.members.length - 6}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-500 font-medium">
                              {ws.members.length} {ws.members.length === 1 ? 'member' : 'members'}
                            </span>
                          </div>

                          {/* Invite Link */}
                          <div className="flex items-center pr-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/invite/${ws.id}`);
                              }}
                              className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold cursor-pointer select-none transition"
                            >
                              <FiExternalLink size={12} className="text-purple-400" />
                              <span>View</span>
                            </button>
                          </div>

                          {/* Join requests */}
                          <div className="flex flex-col justify-center gap-1 pr-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                dispatch(navigateToView({
                                  kind: 'organizationSettings',
                                  orgId: ws.team.team_id,
                                  orgName: ws.team.team_name,
                                }));
                              }}
                              className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold cursor-pointer select-none transition self-start"
                            >
                              <FiExternalLink size={12} className="text-purple-400" />
                              <span>View</span>
                            </button>
                            <span className="text-[10px] text-neutral-500 font-medium font-semibold">
                              No pending requests
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>

            {/* RIGHT INSPECTOR PANEL */}
            {selectedWorkspace && (
              <div className="w-[250px] shrink-0 border-l border-white/5 bg-black/10 flex flex-col h-full overflow-hidden">
                {/* Inspector Header */}
                <div className="flex items-center justify-between p-5 pb-4 border-b border-white/5">
                  <span className="font-bold text-[var(--color-textPrimary)] text-sm truncate">
                    {selectedWorkspace.name}
                  </span>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 rounded hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] transition cursor-pointer"
                    title="Close Inspector"
                  >
                    <FiX size={14} />
                  </button>
                </div>

                {/* Inspector Details */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 text-xs text-left select-none">
                  
                  {/* 1. Included Items */}
                  <div className="space-y-3.5">
                    <h4 className="font-bold text-[var(--color-textMuted)] uppercase tracking-wider text-[10px]">
                      Included Items
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-textSecondary)]">Notes</span>
                        <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.notesCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-textSecondary)]">Snippets</span>
                        <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.snippetsCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-textSecondary)]">Links</span>
                        <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.linksCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-textSecondary)]">Automations</span>
                        <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.automationsCount}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                        <span className="font-bold text-[var(--color-textSecondary)]">Total Size</span>
                        <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.sizeEstimate}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>


    </div>
  );
};

export default WorkspaceSettingsPanel;
