import type React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlay, FaCheck, FaExclamationTriangle, FaTimes, FaStop } from 'react-icons/fa';

interface AutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error' | 'stopped';
  name: string;
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  error?: string;
  targetTabId?: number;
}

const AutomationStatusOverlay: React.FC = () => {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [myTabId, setMyTabId] = useState<number | null>(null);

  useEffect(() => {
    // Get my own tab ID
    chrome.runtime.sendMessage({ action: 'get_tab_id' }, response => {
      if (response?.tabId) {
        setMyTabId(response.tabId);
      }
    });

    // Initial load
    chrome.storage.local.get(['active_automation_status'], result => {
      const activeStatus = result.active_automation_status as AutomationStatus;
      if (activeStatus) {
        setStatus(activeStatus);
      }
    });

    // Listen for updates
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.active_automation_status) {
        const newVal = changes.active_automation_status.newValue as AutomationStatus;
        setStatus(newVal);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Control visibility based on tab matching
  useEffect(() => {
    if (!status || !myTabId) {
      setIsVisible(false);
      return;
    }

    const isCorrectTab = status.targetTabId === myTabId;
    const isStateActive =
      status.status === 'running' ||
      status.status === 'completed' ||
      status.status === 'error' ||
      status.status === 'stopped';

    setIsVisible(isCorrectTab && isStateActive);
  }, [status, myTabId]);

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: 'stop_automation' });
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  // Auto-dismiss on success after 5 seconds, on stop after 3 seconds
  useEffect(() => {
    let timer: any;
    if (status?.status === 'completed' || status?.status === 'stopped') {
      timer = setTimeout(
        () => {
          handleDismiss();
        },
        status.status === 'stopped' ? 3000 : 5000,
      );
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status?.status]);

  if (!status || !isVisible) return null;

  const isRunning = status.status === 'running';
  const isError = status.status === 'error';
  const isCompleted = status.status === 'completed';
  const isStopped = status.status === 'stopped';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -50, opacity: 0, scale: 0.9 }}
        className="fixed top-6 right-6 z-[2147483647] pointer-events-auto">
        <div className="flex flex-col items-end gap-2">
          <div className="bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 flex items-center gap-3 min-w-[240px] max-w-sm">
            <div className="flex-shrink-0">
              {isRunning && (
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25" />
                  <div className="relative bg-blue-500 p-1.5 rounded-full">
                    <FaPlay size={10} className="text-white animate-pulse" />
                  </div>
                </div>
              )}
              {isCompleted && (
                <div className="bg-green-500 p-1.5 rounded-full">
                  <FaCheck size={10} className="text-white" />
                </div>
              )}
              {(isError || isStopped) && (
                <div className="bg-red-500 p-1.5 rounded-full">
                  {isError ? (
                    <FaExclamationTriangle size={10} className="text-white" />
                  ) : (
                    <FaStop size={10} className="text-white" />
                  )}
                </div>
              )}
            </div>

            <div className="flex-grow min-w-0">
              <h4 className="text-[10px] font-bold text-white/40 tracking-widest truncate mb-0.5">
                {status.name || 'Automation'}
              </h4>
              <p
                className={`text-xs font-semibold text-white flex items-center gap-1.5 ${isError ? 'flex-wrap' : 'truncate'}`}>
                {isRunning && status.totalSteps ? (
                  <>
                    <span className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-[10px]">
                      Step {status.currentStep}/{status.totalSteps}
                    </span>
                    <span className="opacity-90">{status.stepName}</span>
                  </>
                ) : isError ? (
                  <>
                    <span className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded text-[10px]">
                      {status.stepName || 'Error'}
                    </span>
                    <span className="opacity-90 text-[10px] break-words">{status.error}</span>
                  </>
                ) : (
                  <span className="capitalize">{status.stepName || status.status}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {isRunning && (
                <button
                  onClick={handleStop}
                  title="Stop Automation"
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20">
                  <FaStop size={10} />
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <FaTimes size={12} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AutomationStatusOverlay;
