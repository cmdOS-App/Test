import type React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaKeyboard, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface TutorialCardProps {
  onClose: () => void;
  onNext?: () => void;
  isVisible: boolean;
  stepIndex?: number;
  totalSteps?: number;
  title?: string;
  features?: { title: string; desc: string; icon?: React.ReactNode }[];
  direction?: 'top' | 'right' | 'left' | 'bottom' | 'none';
  width?: string;
  className?: string;
  type?: 'search' | 'favorites' | 'agent' | 'sidebar' | 'touchpoints' | 'sheet_search' | 'sheet_add' | 'sheet_filter' | 'board_view' | 'list_view' | 'sheet_ui';
  demoText?: string;
  description?: string;
  featuresTitle?: string;
  features2?: { title: string; desc: string; icon?: React.ReactNode }[];
  featuresTitle2?: string;
  footer?: string;
  extraContent?: React.ReactNode;
  isLoggedIn?: boolean;
  hideNavigation?: boolean;
  arrowTopClass?: string;
}

/**
 * A generic onboarding card for tutorials across the app.
 * Premium UI with navigation steps and smooth animations.
 * NO Shadows, Clean Borders, Minimal Geometric Pointers.
 * Consistent 400px geometry (400px x 549px for steps 1 & 3).
 */
const TutorialCard: React.FC<TutorialCardProps> = ({
  onClose,
  onNext,
  isVisible,
  stepIndex = 0,
  totalSteps = 1,
  title = 'Tutorial',
  features = [],
  direction = 'top',
  className = '',
  type = 'search',
  demoText = 'youtube.com',
  description,
  featuresTitle,
  features2 = [],
  featuresTitle2,
  footer,
  width: customWidth,
  extraContent,
  isLoggedIn,
  hideNavigation = false,
  arrowTopClass,
}) => {
  const [displayText, setDisplayText] = useState('');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    // Typing animation logic using demoText prop
    let timer: NodeJS.Timeout;
    if (step === 0) {
      if (displayText.length < demoText.length) {
        timer = setTimeout(() => {
          setDisplayText(demoText.slice(0, displayText.length + 1));
        }, 100);
      } else {
        timer = setTimeout(() => setStep(1), 1000);
      }
    } else if (step === 1) {
      timer = setTimeout(() => {
        setStep(2);
      }, 2500);
    } else {
      timer = setTimeout(() => {
        setDisplayText('');
        setStep(0);
      }, 1200);
    }

    return () => clearTimeout(timer);
  }, [displayText, step, isVisible, demoText]);

  const isLast = stepIndex === totalSteps - 1;

  // Triangle Positioning & Rotation Logic
  const triangleStyles = {
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-[1px]',
    right: `${arrowTopClass || 'top-6'} right-0 translate-x-full pl-[1px]`,
    left: `${arrowTopClass || 'top-6'} left-0 -translate-x-full pr-[1px]`,
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-[1px]',
    none: '',
  };

  const triangleCores = {
    top: 'border-l-[10px] border-r-[10px] border-b-[12px] border-l-transparent border-r-transparent border-b-black/80',
    right:
      'border-t-[10px] border-b-[10px] border-l-[12px] border-t-transparent border-b-transparent border-l-black/80',
    left: 'border-t-[10px] border-b-[10px] border-r-[12px] border-t-transparent border-b-transparent border-r-black/80',
    bottom:
      'border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-black/80',
  };

  const isSmallCard = type === 'search' || type === 'agent';
  const cardWidth = customWidth || (type === 'touchpoints' ? 'w-[1100px] max-w-[95vw]' : 'w-[560px] max-w-[calc(100vw-32px)]');
  const cardHeightClass = type === 'touchpoints' ? 'h-auto' : 'h-auto';
  const cardPadding = 'p-4';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            opacity: 0,
            x: direction === 'right' ? -15 : direction === 'left' ? 15 : 0,
            y: direction === 'top' ? 15 : direction === 'bottom' ? -15 : 0,
            scale: 0.96,
          }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            x: direction === 'right' ? -10 : direction === 'left' ? 10 : 0,
            y: direction === 'top' ? 10 : direction === 'bottom' ? -10 : 0,
            scale: 0.95,
          }}
          whileHover={{
            y: direction === 'top' ? -2 : direction === 'bottom' ? 2 : 0,
            x: direction === 'right' ? -2 : direction === 'left' ? 2 : 0,
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`absolute ${
            direction === 'top'
              ? 'top-full left-0 mt-1'
              : direction === 'bottom'
                ? 'bottom-full left-0 mb-0'
                : direction === 'right'
                  ? 'right-full top-0 mr-0'
                  : direction === 'left'
                    ? 'left-full top-0 ml-0'
                    : '' // direction === 'none'
          } ${cardWidth} ${cardHeightClass} flex flex-col z-[9999] cursor-default ${className}`}>
          {/* Main Card - Clean solid background with thin gray border */}
          <div className="relative flex-1 min-h-0 flex flex-col rounded-[2rem] bg-[var(--color-tutorialCardBg)] border border-white/10 overflow-visible cursor-default z-[9999] shadow-2xl">
            {direction !== 'none' && (
              <div className={`absolute z-50 pointer-events-none ${triangleStyles[direction]}`}>
                <svg
                  width={direction === 'top' || direction === 'bottom' ? '20' : '12'}
                  height={direction === 'top' || direction === 'bottom' ? '12' : '20'}
                  viewBox={direction === 'top' || direction === 'bottom' ? '0 0 20 12' : '0 0 12 20'}
                  className="overflow-visible">
                  <path
                    d={
                      direction === 'top'
                        ? 'M 0 12 L 10 0 L 20 12'
                        : direction === 'bottom'
                          ? 'M 0 0 L 10 12 L 20 0'
                          : direction === 'left'
                            ? 'M 12 0 L 0 10 L 12 20'
                            : 'M 0 0 L 12 10 L 0 20' // direction === 'right'
                    }
                    fill="var(--color-tutorialCardBg)"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}

            {/* Premium Content Inner */}
            <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${cardPadding} rounded-[1.5rem]`}>
              {/* Header Section - Modern Heading */}
              <div className="relative flex flex-col mb-4 flex-shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[22px] font-black tracking-tight text-white leading-tight drop-shadow-sm">{title}</h3>
                  {hideNavigation ? null : (
                    totalSteps > 1 && isLoggedIn !== false && (
                      <span className="text-[13px] font-bold text-neutral-400 tabular-nums px-2 py-1 bg-white/5 rounded-md border border-white/5">
                        {stepIndex + 1} / {totalSteps}
                      </span>
                    )
                  )}
                </div>
                {description && (
                  <div className="flex items-start gap-4">
                    <div className="mt-[8px] w-[5px] h-[5px] rounded-full bg-emerald-500 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <p className="text-[14px] text-neutral-300 font-medium leading-relaxed">{description}</p>
                  </div>
                )}
              </div>

              {/* Content Area - No internal scrolling */}
              <div className="flex-1 min-h-0 mb-3 flex flex-col">
                {/* Tutorial Media Section */}
                {(() => {
                  if (type === 'touchpoints') return null;
                  const gifMapping: Record<string, string> = {
                    search: 'searchbar_recording-ezgif.com-video-to-gif-converter.gif',
                    favorites: 'favPanel_recording-ezgif.com-video-to-gif-converter.gif',
                    agent: 'agentPanel_recording-ezgif.com-video-to-gif-converter.gif',
                    sidebar: 'SideBarPanel_recording-ezgif.com-video-to-gif-converter.gif',
                    sheet_search: 'sheet_search.mp4',
                    sheet_add: 'sheet_add.mp4',
                    sheet_filter: 'sheet_filter.mp4',
                    board_view: 'board_view.gif',
                    list_view: 'list_view.gif',
                    sheet_ui: 'sheet_ui.gif',
                  };

                  const gifName = gifMapping[type];

                  if (gifName) {
                    const src = `/new-tab/images/Gif/${gifName}`;
                    const isVideo = gifName.endsWith('.mp4');

                    return (
                      <div className="relative bg-[#111218] rounded-xl overflow-hidden border border-white/10 mb-4 flex justify-center w-full shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                        {isVideo ? (
                          <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-auto max-h-[min(260px,30vh)] object-contain">
                            <source src={src} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <img
                            src={src}
                            alt={`${type} Tutorial`}
                            className="w-full h-auto max-h-[min(260px,30vh)] object-contain"
                          />
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="relative bg-black/40 rounded-xl p-3 border border-white/[0.05] mb-2 flex flex-col gap-2 max-w-[340px] mx-auto w-full">
                      <div className="flex items-center gap-2 bg-[#080808] rounded-lg px-2 py-1.5 border border-white/5 h-[36px] overflow-hidden relative shadow-inner">
                        <span className="text-[13px] font-mono font-bold text-white">
                          {displayText}
                          <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="inline-block w-[1.5px] h-[16px] bg-white/40 ml-1 rounded-full"
                          />
                        </span>
                      </div>

                      <div className="flex justify-center">
                        <motion.div
                          animate={step === 1 ? { y: [0, 2, 0], opacity: 1, scale: 0.98 } : { opacity: 0.4 }}
                          className={`flex items-center gap-2 px-6 py-2 rounded-lg bg-[#0c0c0c] border border-white/[0.08] text-[11px] font-bold font-mono transition-all ${step === 1 ? 'border-white/20 text-white' : 'text-white'}`}>
                          <FaKeyboard size={13} />
                          <span>Enter</span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })()}

                {/* Clean Feature List */}
                {(features.length > 0 || features2.length > 0 || featuresTitle || featuresTitle2) && (
                  <div className="relative border-t border-white/[0.08] pt-4 mt-2 flex flex-col gap-3">
                    {featuresTitle && <div className="text-[14px] font-bold text-indigo-300 mb-1">{featuresTitle}</div>}
                    {features.map((f, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="mt-[8px] w-[5px] h-[5px] rounded-full bg-indigo-400 flex-shrink-0 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                        <p className="text-[14px] text-neutral-200 font-medium leading-relaxed">
                          {f.title && <span className="text-white font-black">{f.title}</span>}
                          {f.title && f.desc && ' '}
                          {f.desc}
                        </p>
                      </div>
                    ))}

                    {featuresTitle2 && <div className="text-[14px] font-bold text-indigo-300 mt-2 mb-1">{featuresTitle2}</div>}
                    {features2.map((f, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="mt-[8px] w-[5px] h-[5px] rounded-full bg-indigo-400 flex-shrink-0 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                        <p className="text-[14px] text-neutral-200 font-medium leading-relaxed">
                          {f.title && <span className="text-white font-black">{f.title}</span>}
                          {f.title && f.desc && ' '}
                          {f.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {extraContent && (
                  <div className={(features.length > 0 || features2.length > 0) && type !== 'touchpoints' ? "mt-4 pt-4 border-t border-white/[0.08]" : "mt-2"}>
                    {extraContent}
                  </div>
                )}

                {footer && (
                  <div className="mt-4 pt-3 border-t border-white/[0.08]">
                    <p className="text-[12px] text-white/60 font-medium italic">{footer}</p>
                  </div>
                )}
              </div>

              {/* Multi-Step Navigation Footer - Extra Small Compact Buttons */}
              {!hideNavigation && (
                <div className="mt-auto pt-2 flex items-center justify-end gap-2 flex-shrink-0 relative z-50">
                  {!isLast && (
                    <button
                      onClick={onClose}
                      className="cursor-pointer relative z-50 py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold text-[11px] transition-all active:scale-[0.98] border border-white/10 whitespace-nowrap">
                      Skip
                    </button>
                  )}
                  {isLast ? (
                    <button
                      onClick={onNext || onClose}
                      className="cursor-pointer relative z-50 py-2.5 px-6 rounded-xl bg-[#a66cf1] hover:bg-[#a66cf1]/90 text-white font-black text-xs transition-all active:scale-[0.98] border border-white/20 shadow-lg whitespace-nowrap">
                      Lets automate with Keyboard shortcuts
                    </button>
                  ) : (
                    <button
                      onClick={onNext}
                      className="cursor-pointer relative z-50 flex items-center gap-2 py-2 px-6 rounded-xl bg-[#a66cf1] hover:bg-[#a66cf1]/90 text-white font-black text-xs transition-all active:scale-[0.98] border border-white/20 shadow-lg">
                      Next
                      <FaChevronRight size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TutorialCard;
