'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTerminal, FaLink, FaLayerGroup, FaCheck } from 'react-icons/fa';

interface OnboardingLoaderProps {
  isVisible: boolean;
  /** Current step being processed: 'commands' | 'links' | 'tabgroups' | 'done' */
  currentStep?: 'commands' | 'links' | 'tabgroups' | 'done';
  /** Optional status message override */
  statusMessage?: string;
}

const STEPS = [
  { key: 'commands', label: 'Setting up shortcuts', icon: FaTerminal },
  { key: 'links', label: 'Organizing your links', icon: FaLink },
  { key: 'tabgroups', label: 'Creating tab groups', icon: FaLayerGroup },
] as const;

const stepOrder = ['commands', 'links', 'tabgroups', 'done'] as const;

const OnboardingLoader: React.FC<OnboardingLoaderProps> = ({ isVisible, currentStep = 'commands', statusMessage }) => {
  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--color-editorBg)]/85">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md mx-4">
            {/* Card */}
            <div className="bg-[var(--color-popupBg)] rounded-3xl shadow-2xl border border-[var(--color-borderDefault)] overflow-hidden">
              {/* Animated gradient top bar */}
              <div className="h-1 w-full relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  style={{ width: '200%', opacity: 0.3 }}
                />
              </div>

              <div className="px-8 pt-10 pb-8 flex flex-col items-center gap-8">
                {/* Animated logo / spinner */}
                <div className="relative">
                  {/* Outer ring */}
                  <motion.div
                    className="w-20 h-20 rounded-full border-[3px] border-white/10"
                    style={{ borderTopColor: '#8b5cf6', borderRightColor: '#3b82f6' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Inner icon */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                    <span className="text-2xl font-black bg-gradient-to-br from-violet-500 to-blue-500 bg-clip-text text-transparent select-none">
                      CmdOS
                    </span>
                  </motion.div>
                </div>

                {/* Heading */}
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-[var(--color-textPrimary)] tracking-tight">Setting up your workspace</h2>
                  <motion.p
                    key={statusMessage || currentStep}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-[var(--color-textSecondary)] font-medium">
                    {statusMessage || 'Please wait while we configure everything for you…'}
                  </motion.p>
                </div>

                {/* Steps */}
                <div className="w-full space-y-3">
                  {STEPS.map((step, idx) => {
                    const isCompleted = currentIdx > idx || currentStep === 'done';
                    const isActive = stepOrder[currentIdx] === step.key;
                    const Icon = step.icon;

                    return (
                      <motion.div
                        key={step.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                          isActive
                            ? 'bg-violet-50 border border-violet-200'
                            : isCompleted
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'bg-neutral-50 border border-neutral-100'
                        }`}>
                        {/* Icon circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                            isActive
                              ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
                              : isCompleted
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                : 'bg-neutral-200 text-neutral-400'
                          }`}>
                          {isCompleted ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                              <FaCheck size={12} />
                            </motion.div>
                          ) : isActive ? (
                            <motion.div
                              animate={{ scale: [1, 1.15, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}>
                              <Icon size={13} />
                            </motion.div>
                          ) : (
                            <Icon size={13} />
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className={`text-sm font-medium transition-colors duration-300 ${
                            isActive ? 'text-violet-700' : isCompleted ? 'text-emerald-700' : 'text-neutral-400'
                          }`}>
                          {step.label}
                        </span>

                        {/* Active spinner */}
                        {isActive && (
                          <motion.div
                            className="ml-auto w-4 h-4 rounded-full border-2 border-violet-200"
                            style={{ borderTopColor: '#8b5cf6' }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                        )}

                        {/* Completed check */}
                        {isCompleted && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="ml-auto text-[10px] font-semibold text-emerald-600 tracking-wide">
                            DONE
                          </motion.span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{
                      width:
                        currentStep === 'done'
                          ? '100%'
                          : currentStep === 'tabgroups'
                            ? '75%'
                            : currentStep === 'links'
                              ? '45%'
                              : '15%',
                    }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>

                {/* Subtle footer text */}
                <p className="text-[11px] text-neutral-400 text-center font-medium">This will only take a moment ✨</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingLoader;
