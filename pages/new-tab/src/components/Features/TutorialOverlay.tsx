'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronRight, FaMoon, FaCheck, FaUsers, FaClock, FaRocket, FaChevronLeft } from 'react-icons/fa6';
import { FaTimes } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { setDarkMode } from '../../../../Redux/AllData/uiStateSlice';
import OnboardingManager from './OnBoardTemplates';
import TutorialDashboard from '../Tutorial/TutorialDashboard';
import { useAppearance } from '@extension/ui';
import { createOrganization } from '../../../../Apis/services/orgservices';
import { createNewWorkspace } from '../../../../Apis/features/workspaceApiServices';
import { FiLoader, FiCloud, FiUpload, FiDatabase, FiFolder, FiHardDrive, FiRefreshCw } from 'react-icons/fi';
import {
  importBackup,
  validateBackup,
  getBackupSummary,
  connectGoogleDrive,
  isGoogleDriveConnected,
  listGoogleDriveBackups,
  getGoogleDriveEmail,
  downloadGoogleDriveBackup,
} from '../../../../Apis/services/backupService';

// Custom scrollbar styles for tutorial overlay
const scrollbarStyles = `
  .tutorial-overlay-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

interface TutorialOverlayProps {
  videoSrc: string;
  onClose: () => void;
  isLoggedIn?: boolean;
  isReturningUser?: boolean;
}

type Step = 'quote' | 'get_started' | 'theme' | 'organization' | 'onboarding' | 'restore_options' | 'restore_success' | 'tutorial';

const TutorialOverlay = React.forwardRef<HTMLDivElement, TutorialOverlayProps>(({ onClose, isLoggedIn, isReturningUser }, ref) => {
  const [step, setStep] = useState<Step>('quote');
  const dispatch = useDispatch();
  const { themeId, setTheme: setThemeProfile, wallpaperId, setWallpaper } = useAppearance();

  const [shouldShowOrgStep, setShouldShowOrgStep] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [selectedStorageMode, setSelectedStorageMode] = useState<'local' | 'cloud'>('local');
  const [isCreating, setIsCreating] = useState(false);
  // True only when the user has a real cloud account (userId starts with 'user_')
  const [isCloudUser, setIsCloudUser] = useState(false);

  // Restore states
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoredSummary, setRestoredSummary] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Google Drive states
  const [driveStatus, setDriveStatus] = useState<'checking' | 'disconnected' | 'connected' | 'connecting' | 'listing'>('disconnected');
  const [driveEmail, setDriveEmail] = useState<string>('');
  const [driveBackups, setDriveBackups] = useState<any[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
  const [loadingDriveBackups, setLoadingDriveBackups] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Google Drive: check connection on mount
  React.useEffect(() => {
    isGoogleDriveConnected()
      .then(async (connected) => {
        if (connected) {
          setDriveStatus('connected');
          const email = await getGoogleDriveEmail().catch(() => '');
          setDriveEmail(email);
          // Load backups
          setLoadingDriveBackups(true);
          const files = await listGoogleDriveBackups(true).catch(() => []);
          setDriveBackups(files);
          setLoadingDriveBackups(false);
        }
      })
      .catch(() => setDriveStatus('disconnected'));
  }, []);

  const loadDriveBackups = async (force = false) => {
    setLoadingDriveBackups(true);
    setDriveError(null);
    try {
      const files = await listGoogleDriveBackups(force);
      setDriveBackups(files);
      setDriveStatus('connected');
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to load Drive backups.');
      setDriveStatus('connected');
    } finally {
      setLoadingDriveBackups(false);
    }
  };


  const handleConnectDrive = async () => {
    setDriveStatus('connecting');
    setDriveError(null);
    try {
      const connected = await connectGoogleDrive();
      if (connected) {
        setDriveStatus('connected');
        const email = await getGoogleDriveEmail().catch(() => '');
        setDriveEmail(email);
        await loadDriveBackups(true);
      } else {
        setDriveStatus('disconnected');
      }
    } catch (err: any) {
      setDriveError(err?.message ?? 'Failed to connect to Google Drive.');
      setDriveStatus('disconnected');
    }
  };

  const handleDriveRestore = async (fileId: string) => {
    setRestoringFileId(fileId);
    setRestoreError(null);
    setIsRestoring(true);
    try {
      const payload = await downloadGoogleDriveBackup(fileId);
      const validation = validateBackup(payload);
      if (!validation.valid || !validation.payload) {
        setRestoreError(validation.error ?? 'Invalid backup payload.');
        setIsRestoring(false);
        setRestoringFileId(null);
        return;
      }
      const fileSummary = getBackupSummary(validation.payload);
      const result = await importBackup(validation.payload);
      if (result.success) {
        setRestoredSummary(fileSummary);
        setStep('restore_success');
      } else {
        setRestoreError(result.error ?? 'Restore failed.');
      }
    } catch (err: any) {
      setRestoreError(err?.message ?? 'Failed to restore from Drive.');
    } finally {
      setIsRestoring(false);
      setRestoringFileId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setRestoreError(null);
    setIsRestoring(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const validation = validateBackup(raw);
      if (!validation.valid || !validation.payload) {
        setRestoreError(validation.error ?? 'Invalid backup file.');
        setIsRestoring(false);
        return;
      }
      const fileSummary = getBackupSummary(validation.payload);
      const result = await importBackup(validation.payload);
      if (result.success) {
        setRestoredSummary(fileSummary);
        setStep('restore_success');
      } else {
        setRestoreError(result.error ?? 'Restore failed.');
      }
    } catch (err) {
      setRestoreError('Failed to read or restore from backup file.');
    } finally {
      setIsRestoring(false);
    }
  };

  React.useEffect(() => {
    chrome.storage.local.get(['localOrganizations', 'myCachedAllData', 'accessToken'], (res) => {
      const localOrgs = res.localOrganizations || [];
      const cachedAllData = res.myCachedAllData || [];
      const hasNoLocal = !Array.isArray(localOrgs) || localOrgs.length === 0;
      const hasNoCached = !Array.isArray(cachedAllData) || cachedAllData.length === 0;
      if (hasNoLocal && hasNoCached) {
        setShouldShowOrgStep(true);
      } else {
        setShouldShowOrgStep(false);
      }
      // Determine if this is a real cloud account
      const token = res.accessToken;
      if (typeof token === 'string' && token.startsWith('user_')) {
        setIsCloudUser(true);
      }
    });
  }, []);

  const handleCreateOrgAndWorkspace = async () => {
    setIsCreating(true);
    try {
      const finalOrgName = orgName.trim() || 'Personal Space';
      if (selectedStorageMode === 'local') {
        // Create org locally
        const { StorageManager } = await import('../../../../Apis/storage/StorageManager');
        await StorageManager.getInstance().getLocalProvider().createOrganization({
          org_name: finalOrgName,
          created_by: 'local_user',
        });
      } else {
        const orgRes = await createOrganization(finalOrgName);
        const orgId = orgRes?.org_id || (orgRes as any)?.team_id || (orgRes as any)?.id;
        const isLocal = orgRes && ((orgRes as any).storageMode === 'local' || (orgRes as any).storage_mode === 'local');
        if (orgId && !isLocal) {
          await createNewWorkspace('Welcome', 'private', orgId, 'cloud');
        }
      }
    } catch (err) {
      console.error('[TutorialOverlay] Failed to setup organization and workspace:', err);
    } finally {
      setIsCreating(false);
      setStep('tutorial');
    }
  };

  const toTitleCase = (str: string) => {
    return str
      .replace(/[-_]/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  };

  const wallpaperModules = (import.meta as any).glob('../../../public/images/wallappear/*.{png,jpg,jpeg,webp,gif}');
  const wallpapers = [
    { id: 'none', label: 'None', src: '' },
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

  const isDarkMode = true;

  // Temporarily disable 3rd step for everyone per user request
  const shouldShowOnboarding = false; // !isReturningUser;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'rgba(5, 5, 10, 0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      className="fixed inset-0 z-[9999] h-screen w-screen max-h-screen max-w-screen flex flex-col items-center justify-between text-neutral-300 font-sans select-none overflow-hidden py-6 md:py-8 px-6 md:px-12">
      <style>{scrollbarStyles}</style>
      
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#5f5eff]/5 blur-[120px] pointer-events-none" />

        <AnimatePresence mode="wait">
          {/* ── Step 1: Quote screen ── */}
          {step === 'quote' && (
            <motion.div
              key="quote"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full max-w-[1100px] max-h-full gap-4 md:gap-6"
              style={{ zoom: 1.25 }}
              onClick={e => e.stopPropagation()}>
              
              {/* Top progress area */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">
                  {shouldShowOrgStep ? 'Step 1 of 4' : 'Step 1 of 3'}
                </span>
                <div className="flex gap-1.5 w-24">
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-neutral-800"></div>
                  <div className="h-1 flex-1 rounded-full bg-neutral-800"></div>
                  {shouldShowOrgStep && <div className="h-1 flex-1 rounded-full bg-neutral-800"></div>}
                </div>
              </div>

              {/* Centered Message & Points */}
              <div className="flex-1 flex flex-col justify-center items-start gap-6 md:gap-8 my-auto max-h-[70vh]">
                <h1 className="text-base md:text-xl lg:text-[22px] font-medium text-neutral-200 leading-relaxed text-left w-full max-w-full">
                  This product is for <span className="text-[#8b5cf6] font-semibold">tech-savvy users</span> who like automating work with shortcut commands.<br className="hidden md:block" /> It's designed to save you <span className="text-[#8b5cf6] font-semibold whitespace-nowrap">3–4 hours / week</span> of browser time.
                </h1>

                <div className="flex flex-col gap-4 w-full max-w-[620px]">
                  {/* Point 1 */}
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center mt-1 text-[#8b5cf6] shrink-0">
                      <FaUsers size={16} />
                    </div>
                    <div className="flex flex-col justify-center min-h-[40px]">
                      <p className="text-neutral-300 text-xs md:text-sm lg:text-base leading-relaxed">
                        <span className="text-[#8b5cf6] font-semibold">Most users take 4–5 days to adapt to our UI</span> and shift away from the traditional browser UI.
                      </p>
                    </div>
                  </div>

                  {/* Point 2 */}
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center mt-1 text-[#8b5cf6] shrink-0">
                      <FaClock size={16} />
                    </div>
                    <div className="flex flex-col justify-center min-h-[40px]">
                      <p className="text-neutral-300 text-xs md:text-sm lg:text-base leading-relaxed">
                        Please be patient while learning, <span className="text-[#8b5cf6] font-semibold">Breaking old habits takes time</span>.
                      </p>
                    </div>
                  </div>

                  {/* Point 3 */}
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center mt-1 text-[#8b5cf6] shrink-0">
                      <FaRocket size={16} />
                    </div>
                    <div className="flex flex-col justify-center min-h-[40px]">
                      <p className="text-neutral-300 text-xs md:text-sm lg:text-base leading-relaxed">
                        Once you're comfortable with the product, <span className="text-white font-semibold">you'll feel the speed</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="relative flex items-center justify-end w-full mt-auto h-12">
                <button
                  onClick={() => setStep('get_started')}
                  className="flex items-center gap-2 bg-[#5f5eff] hover:bg-[#5f5eff]/95 text-white px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-[#5f5eff]/20 hover:scale-[1.02] active:scale-[0.98]">
                  Next →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Get Started Choice Screen ── */}
          {step === 'get_started' && (
            <motion.div
              key="get_started"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full max-w-[850px] max-h-full gap-4 md:gap-6"
              onClick={e => e.stopPropagation()}>
              
              {/* Top progress area */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">
                  {shouldShowOrgStep ? 'Step 2 of 4' : 'Step 2 of 3'}
                </span>
                <div className="flex gap-1.5 w-24">
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-neutral-800"></div>
                  {shouldShowOrgStep && <div className="h-1 flex-1 rounded-full bg-neutral-800"></div>}
                </div>
              </div>

              {/* Get Started Options Content */}
              <div className="flex-grow flex flex-col justify-center items-center gap-6 mt-4 mb-auto w-full max-h-[75vh]">
                <div className="text-center max-w-[700px] flex flex-col gap-2">
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-medium text-neutral-200">
                    How would you like to <span className="text-[#8b5cf6]">Get Started</span>?
                  </h1>
                  <p className="text-neutral-400 text-xs md:text-sm leading-relaxed">
                    Choose whether you want to start clean or recover your settings, hotkeys, and data.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[680px] mt-4">
                  {/* Start Fresh Option */}
                  <motion.button
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      dispatch(setDarkMode(true));
                      setStep('theme');
                    }}
                    className="flex flex-col items-start gap-4 p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#8b5cf6]/50 transition-all text-left group shadow-lg duration-300 relative overflow-hidden"
                  >
                    {/* Hover Glow background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    <FaRocket size={28} className="text-[#8b5cf6] group-hover:scale-125 group-hover:rotate-6 transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(139,92,246,0.3)] shrink-0" />
                    
                    <div className="space-y-1.5 z-10">
                      <h3 className="text-sm font-bold text-white group-hover:text-[#8b5cf6] transition-colors duration-300">Start Fresh</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors duration-300">
                        Create a brand-new space. Customize your theme profile, organizations, and workspaces from scratch.
                      </p>
                    </div>
                  </motion.button>

                  {/* Restore My Data Option */}
                  <motion.button
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep('restore_options')}
                    className="flex flex-col items-start gap-4 p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/50 transition-all text-left group shadow-lg duration-300 relative overflow-hidden"
                  >
                    {/* Hover Glow background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    <FiCloud size={28} className="text-blue-400 group-hover:scale-125 transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] shrink-0" />
                    
                    <div className="space-y-1.5 z-10">
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors duration-300">Restore My Data</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors duration-300">
                        Bring back your layouts, hotkeys, theme preferences, and shortcuts from Google Drive or a local file.
                      </p>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="relative flex items-center justify-between w-full mt-auto h-12">
                <button
                  onClick={() => setStep('quote')}
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 font-semibold text-xs md:text-sm transition-colors px-4 py-2">
                  <FaChevronLeft size={12} /> Back
                </button>
                <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-800"></span>
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6]"></span>
                  <span className="w-2 h-2 rounded-full bg-neutral-800"></span>
                </div>
                <div className="w-20" /> {/* Spacer */}
              </div>
            </motion.div>
          )}

          {/* ── Step: Restore Options Screen ── */}
          {step === 'restore_options' && (
            <motion.div
              key="restore_options"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full max-w-[850px] max-h-full gap-4 md:gap-6"
              onClick={e => e.stopPropagation()}>
              
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">
                  Restore Options
                </span>
              </div>

              <div className="flex-grow flex flex-col justify-start items-center gap-6 mt-4 mb-auto w-full max-h-[75vh] overflow-y-auto tutorial-overlay-scroll px-2">
                <div className="text-center max-w-[700px] flex flex-col gap-2">
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-medium text-neutral-200">
                    Select a <span className="text-blue-400">Restore Method</span>
                  </h1>
                  <p className="text-neutral-400 text-xs md:text-sm">
                    Connect Google Drive or upload a previous backup file to restore.
                  </p>
                </div>

                {restoreError && (
                  <div className="w-full max-w-[620px] p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs text-left animate-pulse">
                    {restoreError}
                  </div>
                )}

                <div className="w-full max-w-[620px] space-y-5">
                  {/* Google Drive Block */}
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          driveStatus === 'connected' || driveStatus === 'listing'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            : 'bg-white/5 border-white/10 text-neutral-400'
                        }`}>
                          <FiCloud size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Google Drive Backups</h3>
                          <p className="text-[11px] text-neutral-400">Retrieve backups automatically stored in your Drive</p>
                        </div>
                      </div>

                      {/* Connect button or connected status */}
                      {driveStatus === 'disconnected' && (
                        <button
                          onClick={handleConnectDrive}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
                        >
                          Connect Drive
                        </button>
                      )}
                      {driveStatus === 'connecting' && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <FiRefreshCw className="animate-spin" size={12} />
                          Connecting...
                        </div>
                      )}
                      {driveStatus === 'connected' && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Connected
                        </span>
                      )}
                    </div>

                    {driveEmail && (
                      <div className="text-[11px] text-neutral-400 font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg w-fit">
                        Account: <span className="text-white font-semibold">{driveEmail}</span>
                      </div>
                    )}

                    {driveStatus === 'connected' && (
                      <div className="space-y-2 border-t border-white/10 pt-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Available Backups ({driveBackups.length})</span>
                          <button onClick={() => loadDriveBackups(true)} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                            <FiRefreshCw size={10} className={loadingDriveBackups ? 'animate-spin' : ''} /> Refresh
                          </button>
                        </div>

                        {loadingDriveBackups && (
                          <div className="flex items-center justify-center py-6 text-xs text-neutral-400 gap-2">
                            <FiRefreshCw className="animate-spin" size={14} /> Loading Drive files...
                          </div>
                        )}

                        {!loadingDriveBackups && driveBackups.length === 0 && (
                          <p className="text-xs text-neutral-400 text-center py-4 italic">No backups found in your Google Drive.</p>
                        )}

                        {!loadingDriveBackups && driveBackups.length > 0 && (
                          <div className="space-y-2 max-h-[160px] overflow-y-auto tutorial-overlay-scroll pr-1">
                            {driveBackups.map(file => {
                              const date = new Date(file.createdTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                              const time = new Date(file.createdTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                              const size = file.size ? `${(parseInt(file.size)/1024).toFixed(1)} KB` : '';
                              const isRestoringThis = restoringFileId === file.id;

                              return (
                                <div key={file.id} className="flex justify-between items-center p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate max-w-[280px]">{file.name}</p>
                                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{date} · {time} {size && `· ${size}`}</p>
                                  </div>
                                  <button
                                    onClick={() => handleDriveRestore(file.id)}
                                    disabled={isRestoring}
                                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isRestoringThis ? (
                                      <FiRefreshCw className="animate-spin" size={12} />
                                    ) : (
                                      <FiUpload size={12} />
                                    )}
                                    Restore
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Local Backup Block */}
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-neutral-400">
                        <FiDatabase size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Restore from Backup File</h3>
                        <p className="text-[11px] text-neutral-400">Upload a tasklabs-backup.json file from your computer</p>
                      </div>
                    </div>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRestoring}
                      className="px-3.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isRestoring ? (
                        <FiLoader className="animate-spin" size={12} />
                      ) : (
                        <FiUpload size={12} />
                      )}
                      Upload File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="relative flex items-center justify-between w-full mt-auto h-12">
                <button
                  disabled={isRestoring}
                  onClick={() => setStep('get_started')}
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 font-semibold text-xs md:text-sm transition-colors px-4 py-2 disabled:opacity-50">
                  <FaChevronLeft size={12} /> Back
                </button>

                <button
                  disabled={isRestoring}
                  onClick={() => setStep('tutorial')}
                  className="text-neutral-500 hover:text-neutral-300 text-xs md:text-sm font-semibold transition-colors px-4 py-2 disabled:opacity-50">
                  Skip for Now
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: Restore Success Screen ── */}
          {step === 'restore_success' && (
            <motion.div
              key="restore_success"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full max-w-[650px] max-h-full gap-6 p-6"
              onClick={e => e.stopPropagation()}>
              
              <div className="flex-grow flex flex-col justify-center items-center gap-6 my-auto text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FaCheck size={24} />
                </div>

                <div className="space-y-2">
                  <h1 className="text-xl md:text-2xl font-bold text-white">Restore Successful!</h1>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    All your settings, shortcuts, hotkeys, and data have been recovered.
                  </p>
                </div>

                {restoredSummary && (
                  <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4 text-left space-y-2 mt-2">
                    <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Restored Summary</h3>
                    
                    <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                      <span className="text-neutral-400 flex items-center gap-1.5"><FiHardDrive size={12} /> Organizations</span>
                      <span className="text-white font-bold">{restoredSummary.organizationCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                      <span className="text-neutral-400 flex items-center gap-1.5"><FiFolder size={12} /> Workspaces</span>
                      <span className="text-white font-bold">{restoredSummary.workspaceCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                      <span className="text-neutral-400 flex items-center gap-1.5"><FiDatabase size={12} /> Snippets & Todos</span>
                      <span className="text-white font-bold">{restoredSummary.snippetCount + restoredSummary.todoCount}</span>
                    </div>

                    {restoredSummary.favoritesCount > 0 && (
                      <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                        <span className="text-neutral-400 flex items-center gap-1.5">★ Favorites</span>
                        <span className="text-white font-bold">{restoredSummary.favoritesCount}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full flex justify-center mt-auto">
                <button
                  onClick={() => setStep('tutorial')}
                  className="w-full max-w-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-full text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]">
                  Next →
                </button>
              </div>
            </motion.div>
          )}


          {step === 'theme' && (
            <motion.div
              key="theme"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full max-w-[800px] max-h-full gap-4 md:gap-6"
              style={{ zoom: 1.25 }}
              onClick={e => e.stopPropagation()}>
              
              {/* Top progress area */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">
                  {shouldShowOrgStep ? 'Step 3 of 4' : 'Step 3 of 3'}
                </span>
                <div className="flex gap-1.5 w-24">
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  {shouldShowOrgStep && <div className="h-1 flex-1 rounded-full bg-neutral-800"></div>}
                </div>
              </div>

              {/* Theme & Wallpaper Customization Content */}
              <div className="flex-grow flex flex-col justify-start items-center gap-6 mt-4 mb-auto w-full max-h-[75vh]">
                <div className="text-center max-w-[700px] flex flex-col gap-2">
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-medium text-neutral-200">
                    Customize <span className="text-[#8b5cf6]">Appearance</span>
                  </h1>
                  <p className="text-neutral-400 text-xs md:text-sm leading-relaxed">
                    Personalize your cmdOS experience by picking a theme profile and background wallpaper.
                  </p>
                </div>

                <div className="w-full max-w-[620px] space-y-6 mt-4 text-left">
                  {/* Theme Selection Row */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-400 tracking-wider uppercase text-left">
                      Select Theme
                    </h3>
                    <div className="flex gap-4 justify-start">
                      {['default-dark', 'ocean-blue'].map(id => {
                        const isSelected = themeId === id;
                        const label = id === 'default-dark' ? 'Dark Mode' : 'Ocean Blue';
                        const bgColor = id === 'default-dark' ? '#000000' : '#090e1a';
                        
                        return (
                          <motion.div
                            key={id}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setThemeProfile(id)}
                            style={{ backgroundColor: bgColor }}
                            className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-lg ${
                              isSelected
                                ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            {/* Subtle inner border for contrast */}
                            <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                            {/* Mini Mockup layout illustration inside the card */}
                            <div className="absolute inset-2 flex gap-1.5 opacity-40 pointer-events-none">
                              {/* Sidebar */}
                              <div className="w-6 h-full rounded bg-white/10" />
                              {/* Content area */}
                              <div className="flex-1 flex flex-col gap-1">
                                <div className="h-3 w-12 rounded bg-white/20" />
                                <div className="h-2 w-full rounded bg-white/10" />
                                <div className="h-2 w-2/3 rounded bg-white/10" />
                              </div>
                            </div>

                            {/* Active Indicator Checkmark */}
                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10 animate-in zoom-in-50 duration-150">
                                <FaCheck size={9} />
                              </div>
                            )}

                            {/* Name Pill (Bottom Left Overlay) */}
                            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                              <span className="text-[10px] font-bold text-white tracking-wide">{label}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wallpaper Selection Row */}
                  <div className="space-y-3 pt-6 border-t border-white/10">
                    <h3 className="text-xs font-bold text-neutral-400 tracking-wider uppercase text-left">
                      Select Wallpaper
                    </h3>
                    <div className="flex flex-wrap gap-4 w-full">
                      {wallpapers.map(wall => {
                        const isSelected = wallpaperId === wall.id;
                        const bgStyle = wall.id === 'none'
                          ? { backgroundColor: '#111115' }
                          : {
                              backgroundImage: `url('${
                                typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                                  ? chrome.runtime.getURL(wall.src) 
                                  : '/' + wall.src
                              }')`,
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
                            className={`cursor-pointer border rounded-xl w-[140px] h-[85px] transition-all relative overflow-hidden shadow-lg ${
                              isSelected
                                ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            {/* Subtle inner border for contrast */}
                            <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                            {/* Active Indicator Checkmark */}
                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10 animate-in zoom-in-50 duration-150">
                                <FaCheck size={9} />
                              </div>
                            )}

                            {/* Name Pill (Bottom Left Overlay) */}
                            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                              <span className="text-[10px] font-bold text-white tracking-wide">{wall.label}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="relative flex items-center justify-between w-full mt-auto h-12">
                <button
                  onClick={() => setStep('quote')}
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 font-semibold text-xs md:text-sm transition-colors px-4 py-2">
                  <FaChevronLeft size={12} /> Back
                </button>

                <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-800"></span>
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6]"></span>
                  {shouldShowOrgStep && <span className="w-2 h-2 rounded-full bg-neutral-800"></span>}
                </div>

                {shouldShowOrgStep ? (
                  <button
                    onClick={() => setStep('organization')}
                    className="flex items-center gap-2 bg-[#5f5eff] hover:bg-[#5f5eff]/95 text-white px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-[#5f5eff]/20 hover:scale-[1.02] active:scale-[0.98]">
                    Next: Organization Setup →
                  </button>
                ) : (
                  <button
                    onClick={() => setStep('tutorial')}
                    className="flex items-center gap-2 bg-[#5f5eff] hover:bg-[#5f5eff]/95 text-white px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-[#5f5eff]/20 hover:scale-[1.02] active:scale-[0.98]">
                    Next →
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Organization selection ── */}
          {step === 'organization' && (
            <motion.div
              key="organization"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full max-w-[800px] max-h-full gap-4 md:gap-6"
              style={{ zoom: 1.25 }}
              onClick={e => e.stopPropagation()}>
              
              {/* Top progress area */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">Step 4 of 4</span>
                <div className="flex gap-1.5 w-24">
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                  <div className="h-1 flex-1 rounded-full bg-[#5f5eff]"></div>
                </div>
              </div>

              {/* Organization Content */}
              <div className="flex-grow flex flex-col justify-center items-center gap-6 mt-4 mb-auto w-full max-h-[75vh]">
                <div className="text-center max-w-[700px] flex flex-col gap-2">
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-medium text-neutral-200">
                    Create <span className="text-[#8b5cf6]">Organization</span>
                  </h1>
                  <p className="text-neutral-400 text-xs md:text-sm leading-relaxed">
                    Set up your workspace team by specifying an organization name.
                  </p>
                </div>

                <div className="w-full max-w-[450px] space-y-5 mt-4 text-left">
                  {/* Organization Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. My Awesome Team"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-[#8b5cf6]/50 focus:ring-1 focus:ring-[#8b5cf6]/20 transition-all font-medium text-sm"
                    />
                  </div>

                  {/* Storage Mode Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase">
                      Storage Mode
                    </label>
                    <div className="flex gap-3">
                      {/* Local Option — always visible */}
                      <button
                        type="button"
                        onClick={() => setSelectedStorageMode('local')}
                        className={`flex-1 flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-xl border transition-all ${
                          selectedStorageMode === 'local'
                            ? 'border-[#8b5cf6]/70 bg-[#8b5cf6]/10 ring-1 ring-[#8b5cf6]/30'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedStorageMode === 'local' ? 'border-[#8b5cf6]' : 'border-neutral-600'
                          }`}>
                            {selectedStorageMode === 'local' && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${
                            selectedStorageMode === 'local' ? 'text-white' : 'text-neutral-400'
                          }`}>Local</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-relaxed pl-5">
                          Data stored on this device only. No account required.
                        </p>
                      </button>

                      {/* Cloud Option — only visible when user has a real cloud account (userId starts with 'user_') */}
                      {isCloudUser && (
                        <button
                          type="button"
                          onClick={() => setSelectedStorageMode('cloud')}
                          className={`flex-1 flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-xl border transition-all ${
                            selectedStorageMode === 'cloud'
                              ? 'border-[#8b5cf6]/70 bg-[#8b5cf6]/10 ring-1 ring-[#8b5cf6]/30'
                              : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedStorageMode === 'cloud' ? 'border-[#8b5cf6]' : 'border-neutral-600'
                            }`}>
                              {selectedStorageMode === 'cloud' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                              )}
                            </div>
                            <span className={`text-sm font-semibold ${
                              selectedStorageMode === 'cloud' ? 'text-white' : 'text-neutral-400'
                            }`}>Cloud</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 leading-relaxed pl-5">
                            Sync across devices. Requires an account.
                          </p>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="relative flex items-center justify-between w-full mt-auto h-12">
                <button
                  disabled={isCreating}
                  onClick={() => setStep('theme')}
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 font-semibold text-xs md:text-sm transition-colors px-4 py-2 disabled:opacity-50">
                  <FaChevronLeft size={12} /> Back
                </button>

                <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-800"></span>
                  <span className="w-2 h-2 rounded-full bg-neutral-800"></span>
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6]"></span>
                </div>

                <button
                  disabled={isCreating}
                  onClick={handleCreateOrgAndWorkspace}
                  className="flex items-center gap-2 bg-[#5f5eff] hover:bg-[#5f5eff]/95 text-white px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-[#5f5eff]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75">
                  {isCreating ? (
                    <>
                      <FiLoader className="animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      Next →
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Onboarding setup ── */}
          {shouldShowOnboarding && step === 'onboarding' && (
            <motion.div
              key="onboarding"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="tutorial-overlay-scroll w-[900px] h-auto min-h-[380px] rounded-[32px] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] cursor-default relative overflow-hidden bg-[var(--color-tutorialCardBg)] border border-[var(--color-borderDefault)] text-neutral-300"
              style={{ zoom: 1.25 }}
              onClick={e => e.stopPropagation()}>
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-colors z-10"
                title="Close">
                <FaTimes size={20} />
              </button>

              <div className="absolute top-5 left-10 z-10">
                <span className="text-[14px] font-bold text-neutral-500 tabular-nums">Step 3/3</span>
              </div>

              <OnboardingManager onFinish={onClose} isLoggedIn={isLoggedIn} isDarkMode={true} />
            </motion.div>
          )}

          {/* ── Step 5: Tutorial Dashboard ── */}
          {step === 'tutorial' && (
            <motion.div
              key="tutorial"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-[100000] h-screen w-screen flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <TutorialDashboard onClose={onClose} isLoggedIn={isLoggedIn} isEmbedded={true} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
  );
});

export default TutorialOverlay;
