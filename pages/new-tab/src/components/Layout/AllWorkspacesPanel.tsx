import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronDown,
  FiChevronRight,
  FiX,
  FiRefreshCw,
  FiCheck,
  FiTrash2,
  FiList,
  FiSettings,
  FiDatabase,
  FiCloud,
  FiHardDrive,
  FiFolder,
  FiFileText,
  FiZap,
  FiLogOut,
  FiLink,
  FiTerminal,
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

interface AllWorkspacesPanelProps {
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
}

export const AllWorkspacesPanel: React.FC<AllWorkspacesPanelProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const allTeams = useSelector(selectAllData) || [];

  // Expanded row state tracking (workspace ID -> boolean)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
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

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
        });
      });
    });

    return list;
  }, [allTeams]);

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
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: true, onClick: undefined },
        { id: 'workspaceSettings', label: 'Workspace Settings', icon: FiSettings, active: false, onClick: () => dispatch(navigateToView({ kind: 'workspaceSettings' })) },
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
  );

  return (
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
              Cloud & Sync
            </h1>
            <p className="text-xs text-[var(--color-textSecondary)] mt-1">
              Manage sync locations, backups, and properties across all workspaces.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Workspaces List/Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="w-full border border-white/5 bg-neutral-900/10 rounded-xl overflow-hidden">
            
            {/* Table Header */}
            <div className="grid grid-cols-[1.5fr_2.5fr_0.8fr_1.2fr_1fr_1.5fr] border-b border-white/5 bg-white/5 py-3 px-4 text-xs font-semibold text-neutral-400 select-none">
              <div>Workspace</div>
              <div>Location / Source</div>
              <div className="pl-2">Todos</div>
              <div className="pl-2">Automations</div>
              <div>Size</div>
              <div className="text-right pr-2">Actions</div>
            </div>

            {/* Table Body */}
            {workspacesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No workspaces found.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {workspacesList.map(ws => {
                  const isExpanded = !!expandedRows[ws.id];

                  return (
                    <div key={ws.id} className="flex flex-col w-full transition-colors hover:bg-white/[0.01]">
                      
                      {/* Collapsible Row Header */}
                      <div 
                        onClick={() => toggleRow(ws.id)}
                        className="grid grid-cols-[1.5fr_2.5fr_0.8fr_1.2fr_1fr_1.5fr] py-4 px-4 text-xs items-center cursor-pointer select-none"
                      >
                        {/* Workspace Name & Chevron */}
                        <div className="flex items-center gap-2 pr-2">
                          <span className="text-neutral-400">
                            {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                          </span>
                          <span className="font-semibold text-white truncate">
                            {ws.name}
                          </span>
                        </div>
                        {/* Location / Source */}
                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                          {ws.storageMode === 'cloud' ? <GoogleDriveIcon /> : <LocalFolderIcon />}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-neutral-200 truncate">
                              {ws.storageMode === 'cloud' ? 'Google Drive' : 'Local Drive'}
                            </span>
                            <span className="text-[10px] text-neutral-500 truncate font-mono mt-0.5">
                              {ws.path}
                            </span>
                          </div>
                        </div>

                        {/* Counts & Size */}
                        <div className="text-neutral-300 font-medium pl-2">{ws.todosCount}</div>
                        <div className="text-neutral-300 font-medium pl-2">{ws.automationsCount}</div>
                        <div className="text-neutral-400">{ws.sizeEstimate}</div>

                        {/* Row Actions */}
                        <div className="flex items-center justify-end pr-2" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => exportBackup()}
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-white/5 hover:bg-neutral-700 text-white font-semibold transition cursor-pointer select-none active:scale-95 whitespace-nowrap"
                          >
                            Backup now
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Details Panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-black/10 border-t border-white/5"
                          >
                            <div className="flex flex-col p-5 select-none gap-6 text-xs text-left">
                              {/* Top Content Row */}
                              <div className="grid grid-cols-4 gap-6">
                                {/* 1. Included Items */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Included Items
                                  </h4>
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiCheck size={14} className="text-neutral-400 shrink-0" />
                                        <span>Todos</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.todosCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiFileText size={14} className="text-neutral-400 shrink-0" />
                                        <span>Notes</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.notesCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiLink size={14} className="text-neutral-400 shrink-0" />
                                        <span>Links</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.linksCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiTerminal size={14} className="text-neutral-400 shrink-0" />
                                        <span>Snippets</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.snippetsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiZap size={14} className="text-neutral-400 shrink-0" />
                                        <span>Automations</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.automationsCount}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Location / Source */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Location / Source
                                  </h4>
                                  <div className="space-y-3 text-neutral-300">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Folder</span>
                                      <span className="font-mono break-all">{ws.path}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Type</span>
                                      <span>{ws.storageMode === 'cloud' ? 'Google Drive' : 'Local Drive'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 3. Backup Settings */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Backup Settings
                                  </h4>
                                  <div className="space-y-3 text-neutral-300">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Backup location</span>
                                      <span>Cloud (Default)</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Version retention</span>
                                      <span>30 days</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 4. Status & Sync */}
                                <div className="space-y-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Status & Sync
                                  </h4>
                                  <div className="space-y-3 text-neutral-300">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Status</span>
                                      <span className="flex items-center gap-1 font-semibold text-neutral-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span> Available
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Last Backup</span>
                                      <span>{ws.lastBackup}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Aligned Buttons Row */}
                              <div className="grid grid-cols-4 gap-6 pt-4 border-t border-white/5 items-end">
                                <div className="border-r border-white/5 pr-4">
                                  <button 
                                    onClick={() => {
                                      dispatch(setSelectedTeam(ws.team));
                                      dispatch(setSelectedWorkspace(ws.workspace));
                                      onClose();
                                    }}
                                    className="w-full text-center py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold border border-white/5 transition cursor-pointer select-none active:scale-95"
                                  >
                                    Manage Included Items
                                  </button>
                                </div>
                                <div className="border-r border-white/5 pr-4">
                                  <button 
                                    onClick={() => {
                                      dispatch(setSelectedTeam(ws.team));
                                      dispatch(setSelectedWorkspace(ws.workspace));
                                      onClose();
                                    }}
                                    className="w-full text-center py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold border border-white/5 transition cursor-pointer select-none active:scale-95"
                                  >
                                    Open Folder
                                  </button>
                                </div>
                                <div className="border-r border-white/5 pr-4">
                                  <button 
                                    onClick={() => {
                                      dispatch(navigateToView({
                                        kind: 'organizationSettings',
                                        orgId: ws.team.team_id,
                                        orgName: ws.team.team_name,
                                      }));
                                    }}
                                    className="w-full text-center py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold border border-white/5 transition cursor-pointer select-none active:scale-95"
                                  >
                                    Edit Settings
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => exportBackup()}
                                    className="flex-1 text-center py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer select-none active:scale-95 whitespace-nowrap"
                                  >
                                    Backup now
                                  </button>
                                  <button className="flex-1 text-center py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-semibold border border-white/5 cursor-not-allowed select-none opacity-50 whitespace-nowrap">
                                    Restore...
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};

export default AllWorkspacesPanel;
