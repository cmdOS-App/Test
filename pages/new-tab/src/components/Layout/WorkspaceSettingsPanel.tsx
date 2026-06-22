import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiX,
  FiList,
  FiSettings,
  FiDatabase,
  FiLogOut,
  FiLink,
  FiExternalLink,
  FiUsers,
  FiUserPlus,
  FiLoader,
  FiAlertCircle,
  FiSearch,
  FiTerminal,
} from 'react-icons/fi';
import { FaUser, FaPalette } from 'react-icons/fa';
import { FiCreditCard } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { navigateToView } from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData } from '../../../../Redux/AllData/allDataSlice';
import type { Team, Workspace, Folder } from '../../../../modals/interfaces';
import { revokeRemoteSession } from '../../../../Apis/services/logoutService';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import { getMembersInOrganization } from '../../../../Apis/features/workspaceApiServices';
import {
  getOrganizationInvitations,
  acceptInvitation,
  rejectInvitation,
  type Invitation,
} from '../../../../Apis/services/orgservices';
import { getAvatarColor, getInitials } from '../../utils/avatarColors';
import { FEATURE_FLAGS } from '@src/utils/featureFlags';
import InviteMembersPopup from '@private-features/InviteMembersPopup';
import JoinLinksPanel from '@private-features/JoinLinksPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceSettingsPanelProps {
  onClose: () => void;
  hideSidebar?: boolean;
}

interface OrgMember {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  image_url?: string;
  role: string;
}

interface WorkspaceMetrics {
  notes: number;
  snippets: number;
  links: number;
  todos: number;
  automations: number;
  sizeEstimate: string;
}

interface WorkspaceRowData {
  id: string;         // team_id (org level)
  name: string;
  isPersonal: boolean;
  /** true = local storage, false = CMD OS cloud */
  isLocal: boolean;
  storageMode: 'local' | 'cloud';
  team: Team;
  metrics: WorkspaceMetrics;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines whether a team belongs to the LOCAL section or the CMD OS section.
 *
 * Classification rules (evaluated in priority order):
 *
 * ── Explicit storageMode (most reliable, set by the app) ──────────────────
 *  1. team.storageMode === 'local'  → LOCAL
 *  2. team.storageMode === 'cloud'  → CMD OS
 *
 * ── CMD OS identity signals (no explicit storageMode) ─────────────────────
 *  3. team_id starts with 'free_org_'   → CMD OS personal space (logged-in user)
 *  4. team.is_personal_space === true   → CMD OS personal space (logged-in user)
 *
 * ── Local-only identity signals (no explicit storageMode) ─────────────────
 *  5. team_id starts with 'workspace_'  → Legacy local workspace ID
 *  6. team_id starts with 'local_'      → Explicit local ID
 *
 * ── Default fallback ──────────────────────────────────────────────────────
 *  7. All other teams without storageMode → LOCAL
 *     (Treat unknown / unregistered CMD OS users as local-only)
 */
function isLocalTeam(team: Team): boolean {
  // Priority 1 & 2: Explicit storageMode is the ground truth — always trust it first
  if (team.storageMode === 'local') return true;
  if (team.storageMode === 'cloud') return false;

  const id = (team.team_id || '').toLowerCase();

  // Priority 3: free_org_ prefix = CMD OS personal space for a logged-in user → CMD OS
  if (id.startsWith('free_org_')) return false;

  // Priority 4: is_personal_space = true means it belongs to a logged-in CMD OS user → CMD OS
  if (team.is_personal_space === true) return false;

  // Priority 5 & 6: Known local-only ID prefixes → Local
  if (id.startsWith('workspace_') || id.startsWith('local_')) return true;

  // Priority 7: Default — treat as local for non-registered / offline CMD OS users
  return true;
}

/** Aggregate metrics across all workspaces in a team */
function getTeamMetrics(team: Team): WorkspaceMetrics {
  let notes = 0, snippets = 0, links = 0, todos = 0, automations = 0;

  const processSnippets = (list: any[]) => {
    for (const s of list) {
      if (s.is_todo_type || s.event_deadline) { todos++; continue; }
      const cat = (s.category || '').toLowerCase();
      if (cat === 'note' || cat === 'notes' || cat === 'node' || cat === 'nodes') notes++;
      else if (cat === 'link' || cat === 'links' || cat === 'quicklink' || cat === 'tabgroup' || cat === 'tab group') links++;
      else snippets++;
    }
  };

  const processFolders = (folders: Folder[]) => {
    for (const f of folders) {
      processSnippets(f.snippets || []);
      automations += (f.automations || []).length;
      if (f.folders?.length) processFolders(f.folders);
    }
  };

  for (const ws of team.workspaces || []) {
    processSnippets(ws.workspace_snippets || []);
    automations += (ws.workspace_automations || []).length;
    processFolders(ws.folders || []);
  }

  const total = notes + snippets + links + todos + automations;
  const sizeKB = Math.max(10, total * 8.5);
  const sizeEstimate = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;

  return { notes, snippets, links, todos, automations, sizeEstimate };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const WorkspaceSettingsPanel: React.FC<WorkspaceSettingsPanelProps> = ({ onClose, hideSidebar }) => {
  const dispatch = useDispatch();
  const allTeams: Team[] = useSelector(selectAllData) || [];

  // User info from chrome storage
  const [userInitials, setUserInitials] = useState<string>('ME');
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string } | null>(null);

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

  // ── Selected workspace for inspector panel ─────────────────────────
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  // ── Popup state (per org) ──────────────────────────────────────────────────
  const [membersPopup, setMembersPopup] = useState<{ orgId: string; orgName: string; members: OrgMember[]; loading: boolean; error: string | null } | null>(null);
  const [invitePopup, setInvitePopup] = useState<{ orgId: string; orgName: string } | null>(null);
  const [pendingPopup, setPendingPopup] = useState<{ orgId: string } | null>(null);

  // ── Members popup close on outside click ─────────────────────────────────
  const membersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!membersPopup) return;
    const handler = (e: MouseEvent) => {
      if (membersRef.current && !membersRef.current.contains(e.target as Node)) {
        setMembersPopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [membersPopup]);

  // ── Load real members from API ────────────────────────────────────────────
  const openMembersPopup = useCallback(async (team: Team) => {
    setMembersPopup({ orgId: team.team_id, orgName: team.team_name, members: [], loading: true, error: null });
    try {
      const data = await getMembersInOrganization(team.team_id);
      const members: OrgMember[] = data?.members || (Array.isArray(data) ? data : []);
      setMembersPopup({ orgId: team.team_id, orgName: team.team_name, members, loading: false, error: null });
    } catch (err: any) {
      setMembersPopup(prev => prev ? { ...prev, loading: false, error: err?.message || 'Failed to load members' } : null);
    }
  }, []);

  // ── Derived workspace lists ───────────────────────────────────────────────
  const { localWorkspaces, cmdosWorkspaces } = useMemo(() => {
    const local: WorkspaceRowData[] = [];
    const cmdos: WorkspaceRowData[] = [];

    allTeams.forEach((team: Team) => {
      const isPersonal = team.is_personal_space === true;
      const isLocal = isLocalTeam(team);
      const storageMode: 'local' | 'cloud' = isLocal ? 'local' : 'cloud';
      const displayName = isPersonal ? 'Personal Space' : (team.team_name || 'Workspace');
      const metrics = getTeamMetrics(team);

      const row: WorkspaceRowData = {
        id: team.team_id,
        name: displayName,
        isPersonal,
        isLocal,
        storageMode,
        team,
        metrics,
      };

      if (isLocal) {
        local.push(row);
      } else {
        cmdos.push(row);
      }
    });

    return { localWorkspaces: local, cmdosWorkspaces: cmdos };
  }, [allTeams]);

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

  // ── Sidebar ───────────────────────────────────────────────────────────────
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

  // ── Icons ─────────────────────────────────────────────────────────────────
  const GoogleDriveIcon = () => (
    <img
      src={getFaviconUrl('drive.google.com')}
      className="w-4 h-4 rounded-sm shrink-0"
      alt="Google Drive"
    />
  );

  const LocalFolderIcon = () => (
    <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );

  const selectedWorkspace = useMemo(() => {
    return localWorkspaces.find(w => w.id === selectedWorkspaceId) || 
           cmdosWorkspaces.find(w => w.id === selectedWorkspaceId) || 
           null;
  }, [localWorkspaces, cmdosWorkspaces, selectedWorkspaceId]);

  // ── Content Body ──────────────────────────────────────────────────────────
  const contentBody = (
    <>
        {/* Header */}
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

        {/* Scrollable Content + Inspector — flex row */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Scrollable list area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

          {/* ══ LOCAL SECTION ══════════════════════════════════════════════ */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <LocalFolderIcon />
              <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase select-none">Local</span>
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-neutral-600 font-mono">
                {localWorkspaces.length} workspace{localWorkspaces.length !== 1 ? 's' : ''}
              </span>
            </div>

            {localWorkspaces.length === 0 ? (
              <div className="text-xs text-neutral-600 italic px-1">No local workspaces</div>
            ) : (
              <div className="w-full border border-white/5 bg-neutral-900/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2fr_1.5fr] border-b border-white/5 bg-white/5 py-3 px-4 text-xs font-semibold text-neutral-400 select-none">
                  <div>Workspace</div>
                  <div>Storage</div>
                </div>
                {/* Rows — clickable to open inspector */}
                <div className="divide-y divide-white/5">
                  {localWorkspaces.map(ws => (
                    <div
                      key={ws.id}
                      onClick={() => setSelectedWorkspaceId(prev => prev === ws.id ? null : ws.id)}
                      className={`grid grid-cols-[2fr_1.5fr] py-3.5 px-4 text-xs items-center cursor-pointer transition-colors select-none ${
                        selectedWorkspaceId === ws.id ? 'bg-[var(--color-selectedBg)]/30' : 'hover:bg-white/[0.015]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="font-semibold text-white truncate">{ws.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <LocalFolderIcon />
                        <span className="text-neutral-300 font-medium">Local Drive</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══ CMD OS SECTION ═════════════════════════════════════════════ */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <FiTerminal className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase select-none">CMD OS</span>
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-neutral-600 font-mono">
                {cmdosWorkspaces.length} workspace{cmdosWorkspaces.length !== 1 ? 's' : ''}
              </span>
            </div>

            {cmdosWorkspaces.length === 0 ? (
              <div className="text-xs text-neutral-600 italic px-1">No CMD OS workspaces</div>
            ) : (
              <div className="w-full border border-white/5 bg-neutral-900/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1.5fr_1fr_1.8fr_1.2fr_2fr] border-b border-white/5 bg-white/5 py-3 px-4 text-xs font-semibold text-neutral-400 select-none">
                  <div>Workspace</div>
                  <div>Storage</div>
                  <div>Existing Members</div>
                  <div>Invite Link</div>
                  <div>Manage pending join requests</div>
                </div>
                {/* Rows */}
                <div className="divide-y divide-white/5 relative">
                  {cmdosWorkspaces.map(ws => (
                    <div
                      key={ws.id}
                      onClick={() => setSelectedWorkspaceId(prev => prev === ws.id ? null : ws.id)}
                      className={`grid grid-cols-[1.5fr_1fr_1.8fr_1.2fr_2fr] py-4 px-4 text-xs items-center cursor-pointer transition-colors select-none ${
                        selectedWorkspaceId === ws.id ? 'bg-[var(--color-selectedBg)]/30' : 'hover:bg-white/[0.01]'
                      }`}
                    >
                      {/* Workspace Name */}
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="font-semibold text-white truncate">{ws.name}</span>
                      </div>

                      {/* Storage */}
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <GoogleDriveIcon />
                        <span className="text-neutral-300 font-medium truncate">Google Drive</span>
                      </div>

                      {/* Existing Members — clickable dropdown trigger */}
                      <div className="flex items-center pr-2 relative">
                        <button
                          onClick={e => { e.stopPropagation(); openMembersPopup(ws.team); }}
                          className="flex items-center gap-1.5 text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] font-semibold cursor-pointer transition group"
                          title="View existing members"
                        >
                          <FiUsers size={13} className="text-blue-400 shrink-0" />
                          <span className="text-blue-400 group-hover:text-blue-300">View Members</span>
                        </button>
                      </div>

                      {/* Invite Link */}
                      <div className="flex items-center pr-2" onClick={e => e.stopPropagation()}>
                        {FEATURE_FLAGS.ENABLE_SHARING ? (
                          <button
                            onClick={() => setInvitePopup({ orgId: ws.team.team_id, orgName: ws.name })}
                            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold cursor-pointer select-none transition"
                            title="Send invite"
                          >
                            <FiUserPlus size={12} className="text-purple-400" />
                            <span>Invite</span>
                          </button>
                        ) : (
                          <span className="text-neutral-600 text-[11px] italic">N/A</span>
                        )}
                      </div>

                      {/* Manage Pending Join Requests */}
                      <div className="flex flex-col justify-center gap-1 pr-2" onClick={e => e.stopPropagation()}>
                        {FEATURE_FLAGS.ENABLE_SHARING ? (
                          <button
                            onClick={() => setPendingPopup({ orgId: ws.team.team_id })}
                            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold cursor-pointer select-none transition self-start"
                            title="Manage join requests"
                          >
                            <FiLink size={12} className="text-purple-400" />
                            <span>Manage</span>
                          </button>
                        ) : (
                          <span className="text-neutral-600 text-[11px] italic">N/A</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          </div>{/* end scrollable list area */}

          {/* ── RIGHT INSPECTOR PANEL (for selected workspace) ───────────── */}
          {selectedWorkspace && (
            <div className="w-[250px] shrink-0 border-l border-white/5 bg-black/10 flex flex-col h-full overflow-hidden">
              {/* Inspector Header — NO X button */}
              <div className="px-5 py-4 border-b border-white/5">
                <span className="font-bold text-[var(--color-textPrimary)] text-sm truncate block">
                  {selectedWorkspace.name}
                </span>
              </div>

              {/* Inspector Details — real data from workspace metrics */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 text-xs select-none">
                <div className="space-y-3.5">
                  <h4 className="font-bold text-[var(--color-textMuted)] uppercase tracking-wider text-[10px]">
                    Included Items
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-textSecondary)]">Notes</span>
                      <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.metrics.notes}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-textSecondary)]">Snippets</span>
                      <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.metrics.snippets}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-textSecondary)]">Links</span>
                      <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.metrics.links}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-textSecondary)]">Automations</span>
                      <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.metrics.automations}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                      <span className="font-bold text-[var(--color-textSecondary)]">Total Size</span>
                      <span className="font-semibold text-[var(--color-textPrimary)]">{selectedWorkspace.metrics.sizeEstimate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>{/* end flex row */}
    </>
  );

  const globalPopups = (
    <>
      {/* Invite Members Popup */}
      {FEATURE_FLAGS.ENABLE_SHARING && invitePopup && (
        <InviteMembersPopup
          orgId={invitePopup.orgId}
          orgName={invitePopup.orgName}
          members={[]}
          onClose={() => setInvitePopup(null)}
        />
      )}

      {/* Join Links / Invite Link Popup */}
      {FEATURE_FLAGS.ENABLE_SHARING && pendingPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-[520px] max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl">
            <JoinLinksPanel
              orgId={pendingPopup.orgId}
              isPopup={true}
              onClose={() => setPendingPopup(null)}
            />
          </div>
        </div>
      )}

      {/* Members List Popup Modal */}
      {membersPopup && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
          onClick={() => setMembersPopup(null)}
        >
          <div 
            ref={membersRef}
            onClick={e => e.stopPropagation()}
            className="w-[380px] max-h-[70vh] flex flex-col bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
              <div>
                <span className="font-bold text-[var(--color-textPrimary)] text-sm block">
                  Workspace Members
                </span>
                <span className="text-[10px] text-[var(--color-textSecondary)] block mt-0.5">
                  {membersPopup.orgName}
                </span>
              </div>
              <button 
                onClick={() => setMembersPopup(null)} 
                className="p-1 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {membersPopup.loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-500">
                  <FiLoader size={18} className="animate-spin text-blue-400" />
                  <span className="text-xs">Loading members...</span>
                </div>
              ) : membersPopup.error ? (
                <div className="flex items-center gap-2 py-4 px-3 text-red-400 text-xs justify-center">
                  <FiAlertCircle size={16} />
                  <span>{membersPopup.error}</span>
                </div>
              ) : membersPopup.members.length === 0 ? (
                <div className="text-xs text-neutral-500 text-center py-8">No members found</div>
              ) : (
                <div className="space-y-1.5">
                  {membersPopup.members.map((m, idx) => {
                    const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email || 'Unknown User';
                    const isAdmin = m.role?.toLowerCase().includes('admin');
                    return (
                      <div key={m.user_id || idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div
                          className={`w-8 h-8 rounded-full ${getAvatarColor(m.first_name || 'U')} flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden`}
                        >
                          {m.image_url ? (
                            <img src={m.image_url} alt={fullName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(m.first_name, m.last_name)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[var(--color-textPrimary)] truncate">{fullName}</div>
                          {m.email && <div className="text-[10px] text-neutral-500 truncate">{m.email}</div>}
                        </div>
                        {isAdmin && (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold shrink-0">Admin</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (hideSidebar) {
    return (
      <>
        {globalPopups}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
          {contentBody}
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200">
      {globalPopups}
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
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
        {contentBody}
      </div>
    </div>
  );
};

export default WorkspaceSettingsPanel;
