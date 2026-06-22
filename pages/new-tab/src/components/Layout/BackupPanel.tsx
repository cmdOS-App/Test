import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDownload,
  FiUpload,
  FiX,
  FiCheck,
  FiAlertTriangle,
  FiShield,
  FiDatabase,
  FiFolder,
  FiFileText,
  FiHeart,
  FiCommand,
  FiGlobe,
  FiHardDrive,
  FiRefreshCw,
  FiChevronDown,
  FiChevronRight,
  FiCloud,
  FiCloudOff,
  FiTrash2,
  FiLink,
  FiCloudLightning,
  FiList,
  FiLogOut,
  FiCreditCard,
  FiSettings,
  FiSearch,
} from 'react-icons/fi';
import { FaUser, FaPalette } from 'react-icons/fa';
import { useSelector, useDispatch } from 'react-redux';
import { navigateToView } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import type { Team } from '../../../../modals/interfaces';
import { revokeRemoteSession } from '../../../../Apis/services/logoutService';
import { FEATURE_FLAGS } from '@src/utils/featureFlags';
import { connectGoogleDrive, disconnectGoogleDrive, deleteGoogleDriveBackup, downloadDriveBackupToLocal, downloadGoogleDriveBackup, exportBackup, getBackupSummary, getGoogleDriveEmail, importBackup, isGoogleDriveConnected, listGoogleDriveBackups, uploadToGoogleDrive, validateBackup, type BackupPayload, type BackupSummary, type DriveFileEntry, BACKUP_SCHEMA_VERSION } from '../../../../Apis/services/backupService';
import { migrateOrganizationToCloud, migrateOrganizationToLocal } from '../../../../Apis/services/migrationService';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BackupPanelProps {
  onClose: () => void;
  hideSidebar?: boolean;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState =
  | { mode: 'idle' }
  | { mode: 'exporting' }
  | { mode: 'export_done' }
  | { mode: 'importing'; fileName: string; summary: BackupSummary; payload: BackupPayload }
  | { mode: 'restoring' }
  | { mode: 'restore_done'; restoredOrgs: number }
  | { mode: 'error'; message: string };

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryRow: React.FC<{ icon: React.ReactNode; label: string; value: number | string; dimmed?: boolean }> = ({
  icon,
  label,
  value,
  dimmed,
}) => (
  <div
    className={`flex items-center justify-between py-2 border-b border-[var(--color-borderDefault)]/40 last:border-0 ${dimmed ? 'opacity-40' : ''}`}>
    <div className="flex items-center gap-2.5 text-[var(--color-textSecondary)] text-sm">
      <span className="text-[var(--color-accent)]/80">{icon}</span>
      {label}
    </div>
    <span className="text-[var(--color-textPrimary)] font-bold tabular-nums text-sm">{value}</span>
  </div>
);

const StatusBadge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
    {label}
  </span>
);

// Helper to count entity metrics inside a single organization
const getOrgMetrics = (org: Team) => {
  let workspaces = 0;
  let folders = 0;
  let snippets = 0;
  let todos = 0;
  let automations = 0;

  for (const ws of org.workspaces || []) {
    workspaces++;
    snippets += (ws.workspace_snippets || []).filter((s: any) => !s.is_todo_type && !s.event_deadline).length;
    todos += (ws.workspace_snippets || []).filter((s: any) => s.is_todo_type || s.event_deadline).length;
    automations += (ws.workspace_automations || []).length;

    for (const folder of ws.folders || []) {
      folders++;
      snippets += (folder.snippets || []).filter((s: any) => !s.is_todo_type && !s.event_deadline).length;
      todos += (folder.snippets || []).filter((s: any) => s.is_todo_type || s.event_deadline).length;
      automations += (folder.automations || []).length;
    }
  }

  return { workspaces, folders, snippets, todos, automations };
};

// ─── Main Panel ──────────────────────────────────────────────────────────────

// ─── Drive State Types ────────────────────────────────────────────────────────

type DriveStatus =
  | 'checking'
  | 'disconnected'
  | 'connected'
  | 'connecting'
  | 'uploading'
  | 'upload_done'
  | 'listing'
  | 'deleting';

// ─── Main Panel ──────────────────────────────────────────────────────────────

const BackupPanel: React.FC<BackupPanelProps> = ({ onClose, hideSidebar }) => {
  const dispatch = useDispatch();
  const allTeams = useSelector(selectAllData) || [];

  const [state, setState] = useState<PanelState>({ mode: 'idle' });
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [migratingOrgId, setMigratingOrgId] = useState<string | null>(null);
  const [migrationModal, setMigrationModal] = useState<{
    orgId: string;
    name: string;
    target: 'local' | 'cloud';
  } | null>(null);

  // ── Google Drive State ─────────────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState<DriveStatus>('checking');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveBackups, setDriveBackups] = useState<DriveFileEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [driveEmail, setDriveEmail] = useState<string>('');

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

  // Compute metrics summary from current Redux allTeams
  const summary = useMemo(() => {
    let workspaces = 0;
    let folders = 0;
    let snippets = 0;
    let todos = 0;
    let automations = 0;

    const localOrgs = allTeams.filter((o: any) => o.storageMode === 'local');
    const cloudOrgs = allTeams.filter((o: any) => o.storageMode !== 'local');

    for (const org of allTeams) {
      const metrics = getOrgMetrics(org);
      workspaces += metrics.workspaces;
      folders += metrics.folders;
      snippets += metrics.snippets;
      todos += metrics.todos;
      automations += metrics.automations;
    }

    // Estimate file size: serialize payload and estimate character byte length
    const payloadStr = JSON.stringify(allTeams);
    const sizeBytes = payloadStr.length * 1.5; // 50% buffer to account for settings, hotkeys, customizations
    const sizeMB = sizeBytes / (1024 * 1024);
    const sizeEstimate = sizeMB < 0.1 ? `${(sizeBytes / 1024).toFixed(1)} KB` : `${sizeMB.toFixed(1)} MB`;

    return {
      totalOrgs: allTeams.length,
      localOrgs: localOrgs.length,
      cloudOrgs: cloudOrgs.length,
      workspaces,
      folders,
      snippets,
      todos,
      automations,
      sizeEstimate,
    };
  }, [allTeams]);

  // ── Google Drive: check connection on mount ────────────────────────────────
  useEffect(() => {
    isGoogleDriveConnected()
      .then(async connected => {
        setDriveStatus(connected ? 'connected' : 'disconnected');
        if (connected) {
          getGoogleDriveEmail().then(email => setDriveEmail(email));
          loadDriveBackups();
        }
      })
      .catch(() => setDriveStatus('disconnected'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDriveBackups = useCallback(async (force = false) => {
    setDriveStatus('listing');
    setDriveError(null);
    try {
      const files = await listGoogleDriveBackups(force);
      setDriveBackups(files);
      setDriveStatus('connected');
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to load Drive backups.');
      setDriveStatus('connected');
    }
  }, []);

  const handleDriveConnect = useCallback(async () => {
    setDriveStatus('connecting');
    setDriveError(null);
    try {
      const connected = await connectGoogleDrive();
      if (connected) {
        setDriveStatus('connected');
        const email = await getGoogleDriveEmail();
        setDriveEmail(email);
        await loadDriveBackups(true);
      } else {
        setDriveStatus('disconnected');
      }
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to connect to Google Drive.');
      setDriveStatus('disconnected');
    }
  }, [loadDriveBackups]);

  const handleDriveDisconnect = useCallback(async () => {
    await disconnectGoogleDrive();
    setDriveStatus('disconnected');
    setDriveBackups([]);
    setDriveEmail('');
    setDriveError(null);
  }, []);

  const handleDriveUpload = useCallback(async () => {
    setDriveStatus('uploading');
    setDriveError(null);
    try {
      await uploadToGoogleDrive();
      setDriveStatus('upload_done');
      // Refresh list after short delay, bypassing cache
      setTimeout(() => loadDriveBackups(true), 1200);
    } catch (err: any) {
      setDriveError(err?.message ?? 'Drive upload failed.');
      setDriveStatus('connected');
    }
  }, [loadDriveBackups]);

  const handleDriveDelete = useCallback(async (fileId: string) => {
    setDeletingId(fileId);
    setDriveError(null);
    try {
      await deleteGoogleDriveBackup(fileId);
      setDriveBackups(prev => prev.filter(f => f.id !== fileId));
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to delete backup.');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDriveDownload = useCallback(async (fileId: string, fileName: string) => {
    setDriveStatus('listing');
    setDriveError(null);
    try {
      await downloadDriveBackupToLocal(fileId, fileName);
      setDriveStatus('connected');
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to download backup.');
      setDriveStatus('connected');
    }
  }, []);

  const handleDriveRestore = useCallback(async (fileId: string, fileName: string) => {
    setDriveStatus('listing');
    setDriveError(null);
    try {
      const payload = await downloadGoogleDriveBackup(fileId);
      const validation = validateBackup(payload);
      if (!validation.valid || !validation.payload) {
        setDriveError(validation.error ?? 'Invalid backup payload.');
        setDriveStatus('connected');
        return;
      }
      const fileSummary = getBackupSummary(validation.payload);
      setState({
        mode: 'importing',
        fileName,
        summary: fileSummary,
        payload: validation.payload,
      });
      setDriveStatus('connected');
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to download/parse backup.');
      setDriveStatus('connected');
    }
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setState({ mode: 'exporting' });
    try {
      await exportBackup();
      setState({ mode: 'export_done' });
      setTimeout(() => setState({ mode: 'idle' }), 3500);
    } catch (err: any) {
      setState({ mode: 'error', message: err?.message ?? 'Export failed. Please try again.' });
    }
  }, []);

  // ── Import: file pick ───────────────────────────────────────────────────────

  const handleFilePick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const validation = validateBackup(raw);

      if (!validation.valid || !validation.payload) {
        setState({ mode: 'error', message: validation.error ?? 'Invalid backup file.' });
        return;
      }

      const fileSummary = getBackupSummary(validation.payload);
      setState({
        mode: 'importing',
        fileName: file.name,
        summary: fileSummary,
        payload: validation.payload,
      });
    } catch {
      setState({
        mode: 'error',
        message: 'Could not read the file. Make sure it is a valid tasklabs-backup.json.',
      });
    }
  }, []);

  // ── Import: confirm restore ─────────────────────────────────────────────────

  const handleConfirmRestore = useCallback(async () => {
    if (state.mode !== 'importing') return;
    const { payload } = state;

    setState({ mode: 'restoring' });

    try {
      const result = await importBackup(payload);
      if (result.success) {
        setState({ mode: 'restore_done', restoredOrgs: result.restoredOrgs ?? 0 });
      } else {
        setState({ mode: 'error', message: result.error ?? 'Restore failed.' });
      }
    } catch (err: any) {
      setState({ mode: 'error', message: err?.message ?? 'Restore failed unexpectedly.' });
    }
  }, [state]);

  const handleCancel = useCallback(() => {
    setState({ mode: 'idle' });
  }, []);

  const handleMigrateOrg = useCallback(async (orgId: string, target: 'local' | 'cloud') => {
    setMigratingOrgId(orgId);
    setMigrationModal(null);
    try {
      if (target === 'local') {
        await migrateOrganizationToLocal(orgId);
      } else {
        await migrateOrganizationToCloud(orgId);
      }
    } catch (err: any) {
      setState({ mode: 'error', message: err?.message ?? 'Migration failed.' });
    } finally {
      setMigratingOrgId(null);
    }
  }, []);

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
        { id: 'workspaceSettings', label: 'Workspace Settings', icon: FiSettings, active: false, onClick: () => dispatch(navigateToView({ kind: 'workspaceSettings' })) },
        { id: 'backup', label: 'Cloud Sync & Backup', icon: FiDatabase, active: true, onClick: undefined },
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

  // ── Render ──────────────────────────────────────────────────────────────────

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
      )}
      {/* RIGHT CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b border-[var(--color-borderDefault)]/60">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--color-textPrimary)] tracking-tight">Export / Import</h1>
            <p className="text-xs text-[var(--color-textSecondary)] mt-1">
              Create a complete backup of your TaskLabs data or restore from a previous backup.
            </p>
          </div>
          <button
            onClick={onClose}
            id="backup-panel-close"
            className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close">
            <FiX size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            {/* ── EMPTY STATE ────────────────────────────────── */}
            {allTeams.length === 0 && (state.mode === 'idle' || state.mode === 'export_done') && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-[var(--color-hoverBg)] flex items-center justify-center text-[var(--color-textMuted)] border border-[var(--color-borderDefault)]">
                  <FiDatabase size={28} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">No Data Available</h3>
                  <p className="text-xs text-[var(--color-textSecondary)] max-w-xs mx-auto">
                    No organizations found in your workspace to back up yet.
                  </p>
                </div>

                {/* Still allow importing even when empty */}
                <div className="pt-6 w-full max-w-md border-t border-[var(--color-borderDefault)]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FiUpload size={18} className="text-[var(--color-info)]" />
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-[var(--color-textPrimary)]">Restore from File</h4>
                        <p className="text-[10px] text-[var(--color-textSecondary)]">
                          Import a previous tasklabs-backup.json
                        </p>
                      </div>
                    </div>
                    <motion.button
                      id="backup-import-btn"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleFilePick}
                      className="px-4 py-2 rounded-lg border border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] text-xs font-bold transition-all cursor-pointer">
                      Select File…
                    </motion.button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="backup-file-input"
                />
              </motion.div>
            )}

            {/* ── IDLE / EXPORT DONE (WITH DATA) ──────────────── */}
            {allTeams.length > 0 && (state.mode === 'idle' || state.mode === 'export_done') && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6">
                {/* ─── Google Drive Card (gated by ENABLE_GOOGLE_DRIVE_BACKUP flag) ─── */}
                {FEATURE_FLAGS.ENABLE_GOOGLE_DRIVE_BACKUP && (
                  <div className="rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/30 p-5 space-y-4 overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                            driveStatus === 'connected' ||
                            driveStatus === 'listing' ||
                            driveStatus === 'uploading' ||
                            driveStatus === 'upload_done' ||
                            driveStatus === 'deleting'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-[var(--color-hoverBg)] border-[var(--color-borderDefault)] text-[var(--color-textMuted)]'
                          }`}>
                          <FiCloud size={15} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Google Drive</h3>
                          <p className="text-[10px] text-[var(--color-textSecondary)] mt-0.5">
                            Store backups in your private Drive app folder
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      {driveStatus === 'checking' && (
                        <span className="text-[10px] text-[var(--color-textMuted)] font-semibold animate-pulse">
                          Checking…
                        </span>
                      )}
                      {(driveStatus === 'connected' ||
                        driveStatus === 'listing' ||
                        driveStatus === 'uploading' ||
                        driveStatus === 'upload_done') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <FiCheck size={9} /> Connected
                        </span>
                      )}
                      {driveStatus === 'disconnected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-hoverBg)] text-[var(--color-textMuted)] border border-[var(--color-borderDefault)]">
                          <FiCloudOff size={9} /> Disconnected
                        </span>
                      )}
                      {driveStatus === 'connecting' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] animate-pulse">
                          Connecting…
                        </span>
                      )}
                    </div>

                    {/* Error */}
                    {driveError && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-error)]/5 border border-[var(--color-error)]/20 text-[var(--color-error)]/80 text-xs">
                        <FiAlertTriangle size={12} className="shrink-0 mt-0.5" />
                        {driveError}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {(driveStatus === 'disconnected' || driveStatus === 'checking') && (
                        <motion.button
                          id="drive-connect-btn"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleDriveConnect}
                          disabled={driveStatus === 'checking'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                          <FiLink size={12} />
                          Connect Google Drive
                        </motion.button>
                      )}

                      {driveStatus === 'connecting' && (
                        <div className="flex items-center gap-2 text-xs text-[var(--color-textSecondary)]">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <FiRefreshCw size={12} />
                          </motion.div>
                          Opening Google sign-in…
                        </div>
                      )}

                      {(driveStatus === 'connected' || driveStatus === 'listing' || driveStatus === 'upload_done') && (
                        <>
                          <motion.button
                            id="drive-backup-btn"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleDriveUpload}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer">
                            <FiCloudLightning size={12} />
                            Backup to Drive
                          </motion.button>
                          <motion.button
                            id="drive-refresh-btn"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => loadDriveBackups(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] text-xs font-semibold transition-all cursor-pointer"
                            title="Refresh backup list">
                            <FiRefreshCw size={12} />
                          </motion.button>
                          <motion.button
                            id="drive-disconnect-btn"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleDriveDisconnect}
                            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-borderDefault)] hover:border-[var(--color-error)]/50 text-[var(--color-textMuted)] hover:text-[var(--color-error)] text-xs font-semibold transition-all cursor-pointer">
                            <FiCloudOff size={12} />
                            Disconnect
                          </motion.button>
                        </>
                      )}

                      {driveStatus === 'uploading' && (
                        <div className="flex items-center gap-2 text-xs text-blue-400">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <FiRefreshCw size={12} />
                          </motion.div>
                          Uploading to Drive…
                        </div>
                      )}
                    </div>

                    {/* Connected Account Display */}
                    {driveEmail &&
                      (driveStatus === 'connected' ||
                        driveStatus === 'listing' ||
                        driveStatus === 'upload_done' ||
                        driveStatus === 'uploading') && (
                        <div className="text-[11px] text-[var(--color-textSecondary)] flex items-center gap-1.5 mt-0.5 bg-[var(--color-sidebarBg)]/30 px-3 py-2 rounded-xl border border-[var(--color-borderDefault)]/30 w-fit">
                          <span className="text-[var(--color-textMuted)]">Connected Account:</span>
                          <span className="font-semibold text-[var(--color-textPrimary)] font-mono">{driveEmail}</span>
                        </div>
                      )}

                    {/* Upload done banner */}
                    {driveStatus === 'upload_done' && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                        <FiCheck size={12} /> Backup uploaded successfully
                      </motion.div>
                    )}

                    {/* Drive backups list */}
                    {(driveStatus === 'connected' || driveStatus === 'listing' || driveStatus === 'upload_done') && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-[var(--color-borderDefault)]/40">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider">
                            Available Backups ({driveBackups.length})
                          </p>
                          {driveStatus === 'listing' && (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <FiRefreshCw size={10} className="text-[var(--color-textMuted)]" />
                            </motion.div>
                          )}
                        </div>

                        {driveBackups.length === 0 && driveStatus !== 'listing' && (
                          <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-[var(--color-borderDefault)]/60 rounded-xl gap-2 mt-1">
                            <p className="text-xs text-[var(--color-textSecondary)] text-center">
                              No Google Drive backups found.
                            </p>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleDriveUpload}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1">
                              <FiCloudLightning size={10} />
                              Backup Now
                            </motion.button>
                          </div>
                        )}

                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                          {driveBackups.map(file => {
                            const createdDate = new Date(file.createdTime);
                            const sizeKB = file.size ? (parseInt(file.size) / 1024).toFixed(1) : '?';
                            const isDeleting = deletingId === file.id;
                            const version = file.appProperties?.version || '1.0.0';
                            const type = file.appProperties?.backupType || 'manual';
                            return (
                              <div
                                key={file.id}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--color-hoverBg)]/50 border border-[var(--color-borderDefault)]/60 hover:border-[var(--color-borderActive)]/60 transition-all group">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FiDatabase size={12} className="text-blue-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[var(--color-textPrimary)] truncate max-w-[200px]">
                                      {file.name}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-textSecondary)]">
                                      {createdDate.toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                      {' · '}
                                      {createdDate.toLocaleTimeString(undefined, {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                      {' · '}
                                      {sizeKB} KB
                                      {' · '}v{version}
                                      {' · '}
                                      <span className="capitalize">{type}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDriveRestore(file.id, file.name)}
                                    title="Restore backup"
                                    className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-info)] hover:bg-[var(--color-info)]/10 transition-all cursor-pointer">
                                    <FiUpload size={12} />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDriveDownload(file.id, file.name)}
                                    title="Download backup file"
                                    className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-all cursor-pointer">
                                    <FiDownload size={12} />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDriveDelete(file.id)}
                                    disabled={isDeleting}
                                    title="Delete backup"
                                    className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all cursor-pointer disabled:opacity-50">
                                    {isDeleting ? (
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                                        <FiRefreshCw size={12} />
                                      </motion.div>
                                    ) : (
                                      <FiTrash2 size={12} />
                                    )}
                                  </motion.button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Section 1: Backup Summary Card */}
                <div className="rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/30 p-5 space-y-4">
                  <h3 className="text-xs font-bold text-[var(--color-textMuted)] uppercase tracking-wider">
                    Backup Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="space-y-2">
                      <SummaryRow icon={<FiHardDrive size={13} />} label="Organizations" value={summary.totalOrgs} />
                      <SummaryRow icon={<FiGlobe size={13} />} label="Local Orgs" value={summary.localOrgs} />
                      <SummaryRow icon={<FiDatabase size={13} />} label="Cloud Orgs" value={summary.cloudOrgs} />
                    </div>
                    <div className="space-y-2">
                      <SummaryRow icon={<FiFolder size={13} />} label="Workspaces" value={summary.workspaces} />
                      <SummaryRow icon={<FiFolder size={13} />} label="Folders" value={summary.folders} />
                      <SummaryRow icon={<FiFileText size={13} />} label="Snippets" value={summary.snippets} />
                    </div>
                    <div className="space-y-2">
                      <SummaryRow icon={<FiCheck size={13} />} label="Todos" value={summary.todos} />
                      <SummaryRow icon={<FiRefreshCw size={13} />} label="Automations" value={summary.automations} />
                      <SummaryRow icon={<FiShield size={13} />} label="Est. Size" value={summary.sizeEstimate} />
                    </div>
                  </div>

                  {/* Section 2: Organization Breakdown */}
                  <div className="border-t border-[var(--color-borderDefault)]/40 pt-4">
                    <button
                      onClick={() => setIsBreakdownExpanded(!isBreakdownExpanded)}
                      className="flex items-center gap-2 text-xs font-bold text-[var(--color-textPrimary)] hover:text-[var(--color-accent)] transition-all cursor-pointer">
                      {isBreakdownExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                      Organizations Included
                    </button>
                    {isBreakdownExpanded && (
                      <div className="mt-3 space-y-3 pl-4 border-l-2 border-[var(--color-borderDefault)]/30 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {allTeams.map((org, index) => {
                          const metrics = getOrgMetrics(org);
                          return (
                            <div
                              key={org.team_id || index}
                              className="flex justify-between items-center text-xs py-1.5 border-b border-[var(--color-borderDefault)]/20 last:border-0">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[var(--color-textPrimary)]">
                                    {org.team_name || 'Personal Space'}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      org.storageMode === 'local'
                                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                                        : 'bg-[var(--color-info)]/10 text-[var(--color-info)]'
                                    }`}>
                                    {org.storageMode || 'cloud'}
                                  </span>
                                </div>
                                <span className="text-[var(--color-textSecondary)] font-mono text-[10px] mt-0.5">
                                  {metrics.workspaces} Workspaces · {metrics.folders} Folders · {metrics.snippets}{' '}
                                  Snippets · {metrics.todos} Todos · {metrics.automations} Automations
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {FEATURE_FLAGS.ENABLE_SHARING &&
                                  org.storageMode !== 'local' &&
                                  (migratingOrgId === org.team_id ? (
                                    <span className="text-[10px] text-[var(--color-textMuted)] font-semibold animate-pulse">
                                      Migrating…
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setMigrationModal({
                                          orgId: org.team_id,
                                          name: org.team_name || 'Personal Space',
                                          target: 'local',
                                        })
                                      }
                                      className="px-2.5 py-1 rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10">
                                      Migrate to Local
                                    </button>
                                  ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Export Section */}
                <div className="py-4 border-b border-[var(--color-borderDefault)]/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FiDownload size={18} className="text-[var(--color-success)]" />
                      <div>
                        <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Backup Now</h3>
                        <p className="text-xs text-[var(--color-textSecondary)] mt-0.5">
                          Download a complete snapshot of all your data.
                        </p>
                      </div>
                    </div>
                    {state.mode === 'export_done' ? (
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)] text-xs font-semibold">
                        <FiCheck size={12} className="shrink-0" />
                        Downloaded
                      </motion.div>
                    ) : (
                      <motion.button
                        id="backup-export-btn"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleExport}
                        className="px-4 py-2 rounded-lg bg-[var(--color-success)] hover:brightness-110 text-white text-xs font-bold shadow-md shadow-[var(--color-success)]/10 transition-all cursor-pointer">
                        Download Backup
                      </motion.button>
                    )}
                  </div>

                  {/* Export Metadata Display */}
                  <div className="flex items-center gap-6 text-[11px] text-[var(--color-textSecondary)] bg-[var(--color-sidebarBg)]/20 px-3 py-2 rounded-lg border border-[var(--color-borderDefault)]/30 w-fit">
                    <div>
                      <span className="text-[var(--color-textMuted)]">Version:</span>{' '}
                      <span className="font-mono text-[var(--color-textPrimary)]">{BACKUP_SCHEMA_VERSION}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-textMuted)]">Exported At:</span>{' '}
                      <span className="font-mono text-[var(--color-textPrimary)]">{new Date().toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-textMuted)]">Estimated Size:</span>{' '}
                      <span className="font-mono text-[var(--color-textPrimary)]">{summary.sizeEstimate}</span>
                    </div>
                  </div>
                </div>

                {/* Import section */}
                <div className="py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FiUpload size={18} className="text-[var(--color-info)]" />
                      <div>
                        <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Restore Backup</h3>
                        <p className="text-xs text-[var(--color-textSecondary)] mt-0.5">
                          Select a tasklabs-backup.json file to preview and restore.
                        </p>
                      </div>
                    </div>
                    <motion.button
                      id="backup-import-btn"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleFilePick}
                      className="px-4 py-2 rounded-lg border border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] text-xs font-bold transition-all cursor-pointer">
                      Select File…
                    </motion.button>
                  </div>

                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/20 text-[var(--color-warning)]/80 text-xs">
                    <FiAlertTriangle size={13} className="shrink-0 mt-0.5" />
                    Local org data will be replaced. Cloud orgs re-sync automatically after restore.
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="backup-file-input"
                  />
                </div>
              </motion.div>
            )}

            {/* ── EXPORTING ──────────────────────────────────── */}
            {state.mode === 'exporting' && (
              <motion.div
                key="exporting"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-5">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                  <FiRefreshCw size={32} className="text-[var(--color-success)]" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-[var(--color-textPrimary)] font-bold text-base">Creating backup…</p>
                  <p className="text-[var(--color-textSecondary)] text-sm">Collecting all your data</p>
                </div>
              </motion.div>
            )}

            {/* ── IMPORT PREVIEW (Section 4) ─────────────────── */}
            {state.mode === 'importing' && (
              <motion.div
                key="importing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 flex items-center justify-center">
                    <FiDatabase size={17} className="text-[var(--color-info)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Backup Preview</h3>
                    <p className="text-xs text-[var(--color-textSecondary)] font-mono truncate max-w-[280px]">
                      {state.fileName}
                    </p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge
                    label={`Schema v${state.summary.version}`}
                    color="bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20"
                  />
                  <StatusBadge
                    label={new Date(state.summary.exportedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    color="bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] border border-[var(--color-borderDefault)]"
                  />
                </div>

                {/* Summary table */}
                <div className="rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/30 p-5 space-y-0.5">
                  <h4 className="text-xs font-bold text-[var(--color-textMuted)] uppercase tracking-widest mb-3">
                    Backup Contents
                  </h4>

                  <div className="grid grid-cols-2 gap-x-8">
                    <div>
                      <SummaryRow
                        icon={<FiHardDrive size={12} />}
                        label="Local Orgs"
                        value={state.summary.localOrgCount}
                      />
                      <SummaryRow icon={<FiGlobe size={12} />} label="Cloud Orgs" value={state.summary.cloudOrgCount} />
                      <SummaryRow
                        icon={<FiDatabase size={12} />}
                        label="Workspaces"
                        value={state.summary.workspaceCount}
                      />
                      <SummaryRow icon={<FiFolder size={12} />} label="Folders" value={state.summary.folderCount} />
                    </div>
                    <div>
                      <SummaryRow icon={<FiFileText size={12} />} label="Snippets" value={state.summary.snippetCount} />
                      <SummaryRow icon={<FiCheck size={12} />} label="Todos" value={state.summary.todoCount} />
                      <SummaryRow
                        icon={<FiRefreshCw size={12} />}
                        label="Automations"
                        value={state.summary.automationCount}
                      />
                      <SummaryRow icon={<FiHeart size={12} />} label="Favorites" value={state.summary.favoritesCount} />
                    </div>
                  </div>
                  <div className="pt-1">
                    <SummaryRow
                      icon={<FiCommand size={12} />}
                      label="Command Customizations"
                      value={state.summary.commandCustomizationsCount}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <motion.button
                    id="backup-confirm-restore-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-info)] hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-[var(--color-info)]/20 transition-all cursor-pointer">
                    <FiCheck size={15} />
                    Confirm Restore
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCancel}
                    className="px-4 py-3 rounded-xl border border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] text-sm font-semibold transition-all cursor-pointer">
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── RESTORING ──────────────────────────────────── */}
            {state.mode === 'restoring' && (
              <motion.div
                key="restoring"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-5">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                  <FiRefreshCw size={32} className="text-[var(--color-info)]" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-[var(--color-textPrimary)] font-bold text-base">Restoring backup…</p>
                  <p className="text-[var(--color-textSecondary)] text-sm">
                    Writing data and refreshing your workspace
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── RESTORE DONE ───────────────────────────────── */}
            {state.mode === 'restore_done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-full bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 flex items-center justify-center">
                  <FiCheck size={30} className="text-[var(--color-success)]" />
                </motion.div>
                <div className="text-center space-y-2">
                  <p className="text-[var(--color-textPrimary)] font-extrabold text-xl">Restore complete!</p>
                  <p className="text-[var(--color-textSecondary)] text-sm">
                    {state.restoredOrgs} local organization{state.restoredOrgs !== 1 ? 's' : ''} restored. Cloud orgs
                    will re-sync automatically.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[var(--color-success)] hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-[var(--color-success)]/20 transition-all cursor-pointer">
                  Done
                </motion.button>
              </motion.div>
            )}

            {/* ── ERROR ──────────────────────────────────────── */}
            {state.mode === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center justify-center py-20 gap-6">
                <div className="w-14 h-14 rounded-full bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center justify-center">
                  <FiAlertTriangle size={26} className="text-[var(--color-error)]" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="text-[var(--color-textPrimary)] font-bold text-base">Something went wrong</p>
                  <p className="text-[var(--color-textSecondary)] text-sm">{state.message}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCancel}
                  className="px-6 py-2.5 rounded-xl border border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] text-sm font-semibold transition-all cursor-pointer">
                  Try Again
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Section 5: Restore Warning Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in duration-200 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-[var(--color-error)]">
              <FiAlertTriangle size={24} />
              <h3 className="text-base font-bold text-[var(--color-textPrimary)]">Confirm Restore</h3>
            </div>

            <div className="space-y-3 text-xs text-[var(--color-textSecondary)] leading-relaxed">
              <p className="font-semibold text-[var(--color-error)]">
                Importing a backup will replace all current Local Organizations.
              </p>
              <p>
                Cloud Organizations are <span className="font-bold text-[var(--color-textPrimary)]">NOT</span> restored
                from backup files.
              </p>
              <p>Cloud Organizations will automatically reappear and sync after you login to your account.</p>
              <p className="font-bold text-[var(--color-warning)]">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  handleConfirmRestore();
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-error)] hover:brightness-110 text-white text-xs font-bold transition-all cursor-pointer">
                Yes, Replace and Restore
              </button>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] text-xs font-semibold transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Organization Migration Confirmation Modal */}
      {migrationModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in duration-200 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-[var(--color-warning)]">
              <FiAlertTriangle size={24} />
              <h3 className="text-base font-bold text-[var(--color-textPrimary)]">Confirm Migration</h3>
            </div>

            <div className="space-y-3 text-xs text-[var(--color-textSecondary)] leading-relaxed">
              <p className="font-semibold text-[var(--color-error)]">
                Are you sure you want to migrate "{migrationModal.name}" to Local storage?
              </p>
              <p>
                This is a <span className="font-bold text-[var(--color-textPrimary)]">transfer operation</span>. The
                cloud copy will be permanently deleted from Supabase immediately after successful local verification.
              </p>
              <p>
                A safety backup snapshot (`migration_backup_{migrationModal.orgId}`) will be saved in your local storage
                to prevent any data loss.
              </p>
              <p className="font-bold text-[var(--color-warning)]">
                Please keep your browser active during the migration process.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleMigrateOrg(migrationModal.orgId, 'local')}
                className="flex-1 px-4 py-2.5 rounded-lg text-white text-xs font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500">
                Yes, Start Migration
              </button>
              <button
                onClick={() => setMigrationModal(null)}
                className="px-4 py-2.5 rounded-lg border border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] text-xs font-semibold transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPanel;
