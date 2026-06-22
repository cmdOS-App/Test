import React from 'react';
import { FaSearch, FaKeyboard, FaRobot, FaGlobe, FaChevronRight, FaTimes } from 'react-icons/fa';
import logoUrl from '../../assets/tasklabs_logo.png';
import Branding from '../Layout/Branding';
import { CMDOS_DOCS_URL } from '../../../../Apis/core/apiConfig';

interface TutorialDashboardProps {
  onClose: () => void;
  isLoggedIn?: boolean;
  isEmbedded?: boolean;
}

const TutorialDashboard: React.FC<TutorialDashboardProps> = ({ onClose, isLoggedIn, isEmbedded }) => {

  const handleFinish = () => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local && !(window as any).isReplayingTutorial) {
      chromeAny.storage.local.set({
        tutorial_watched: true,
        app_tutorial_progress: {
          search: true,
          favorites: true,
          agent: true,
          sidebar: true,
          touchpoints: true,
        },
      });
    }
    window.dispatchEvent(new CustomEvent('TutorialFinished'));
    onClose();
  };

  return (
    <div className={isEmbedded ? "relative flex flex-col justify-between p-4 md:p-6 font-sans select-none overflow-hidden h-full w-full z-50" : "fixed inset-0 z-[100000] bg-[var(--color-rootBg)] flex flex-col justify-between p-4 md:p-6 font-sans select-none overflow-hidden h-screen w-screen max-h-screen max-w-screen"}>

      {/* Top Left Branding Logo (Original Asset & Font Styled per Request) */}
      {!isEmbedded && (
        <div className="absolute top-2.5 left-2.5 select-none z-50">
          <Branding showAvatar={false} textColor="text-white" />
        </div>
      )}

      {/* Top Right Header Controls / Docs & Close Buttons */}
      {!isEmbedded && (
        <div className="absolute top-2.5 right-2.5 z-50 flex items-center gap-3">
          <button
            onClick={() => window.open(CMDOS_DOCS_URL, '_blank')}
            className="cursor-pointer px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-400/10 to-indigo-400/10 border border-purple-400/25 hover:from-purple-400/20 hover:to-indigo-400/20 text-purple-300 hover:text-purple-200 text-xs font-medium transition-all duration-200 active:scale-[0.98]">
            Docs
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-all cursor-pointer border border-white/5"
            title="Close">
            <FaTimes size={14} />
          </button>
        </div>
      )}

      {/* Center Header */}
      <div className="flex flex-col items-center text-center mt-3 w-full shrink-0">
        <h1 className="text-white text-2xl md:text-[34px] font-semibold tracking-tight leading-tight">
          Everything you need, in <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">one place.</span>
        </h1>
        <p className="text-neutral-400 text-xs md:text-sm mt-1 max-w-[600px] font-medium leading-normal">
          Powerful features to search, automate and streamline your workflow.
        </p>
      </div>

      {/* 2x2 Grid of Cards (Height-constrained to fit perfectly without scroll) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-[1240px] mx-auto flex-grow my-4 overflow-hidden items-stretch">

        {/* Card 1: Search & Commands */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaSearch size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">Search & Commands</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Your shortcut to a digital second brain.
                  </p>
                </div>
              </div>

              {/* Badge */}
              <div className="mt-2.5">
                <span className="text-[9.5px] font-bold text-emerald-400 tracking-wider">
                  ALT + S
                </span>
              </div>

              {/* Bullets */}
              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Search YouTube, notes, links, news and more instantly.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Type <span className="text-emerald-400 font-mono font-semibold">@</span> to trigger commands
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Type <span className="text-emerald-400 font-mono font-semibold">/</span> to find saved files & links
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Preview */}
          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
            <img
              src="/new-tab/images/Gif/searchbar_recording-ezgif.com-video-to-gif-converter.gif"
              alt="Search demo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Card 2: Keyboard Shortcuts */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaKeyboard size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">Keyboard Shortcuts</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Turn frequent actions into instant hotkeys.
                  </p>
                </div>
              </div>

              {/* Badge */}
              <div className="mt-2.5">
                <span className="text-[11px] font-semibold text-blue-400 leading-normal">
                  Assign a keyboard shortcut to any note or link collection for quick access.
                </span>
              </div>

              {/* Bullets */}
              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Save favorites: Pin your top agents, links, or notes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Assign hotkeys: Trigger workflows with Alt + 1
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Work faster: Skip the mouse entirely
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Preview */}
          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
            <img
              src="/new-tab/images/Gif/favPanel_recording-ezgif.com-video-to-gif-converter.gif"
              alt="Favorites demo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Card 3: AI Chat Shortcuts */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaRobot size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">AI Chat Shortcuts</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Turn AI workflows into reusable shortcuts.
                  </p>
                </div>
              </div>

              {/* Badge */}
              <div className="mt-2.5">
                <span className="text-[9.5px] font-bold text-purple-400 tracking-wider">
                  @ai
                </span>
              </div>

              {/* Bullets */}
              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Save time: Automate repetitive tasks
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Multi-model: Chat with ChatGPT, Claude & Gemini
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Instant launch: Trigger agents anywhere
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Preview */}
          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
            <img
              src="/new-tab/images/Gif/agentPanel_recording-ezgif.com-video-to-gif-converter.gif"
              alt="AI Chat demo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Card 4: cmdOS Anywhere */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaGlobe size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">cmdOS Anywhere</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Use cmdOS across all browser touchpoints.
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="mt-2.5 flex gap-1.5">
                <span className="text-[9.5px] font-bold text-teal-400 tracking-wider">
                  ALT + C
                </span>
                <span className="text-neutral-500 text-[9.5px] font-bold select-none">•</span>
                <span className="text-[9.5px] font-bold text-teal-400 tracking-wider">
                  ALT + S
                </span>
              </div>

              {/* Bullets */}
              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Open create menu on new tab page.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Open side panel on any website.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Run automations & AI without switching tabs.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Detailed info from previous UI */}
          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] flex flex-col gap-1.5 shrink-0 bg-black p-2 rounded-xl border border-white/10 overflow-hidden text-[9px] leading-snug select-none">
            {/* Section 1: Alt + C */}
            <div className="flex flex-col gap-1 p-1.5 rounded-lg bg-black border border-white/5">
              <div className="flex items-center gap-1 select-none">
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">Alt</span>
                <span className="text-white/40 text-[8.5px]">+</span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">C</span>
                <span className="text-neutral-400 text-[9px] font-semibold ml-1.5">(New Tab)</span>
              </div>
              <ul className="text-neutral-300 space-y-0.5 text-[9px] font-medium pl-0.5">
                <li className="flex items-start gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Create notes, links, agents</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Accessible anywhere on tab</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Save reusable workflows</span>
                </li>
              </ul>
              <div className="text-[8px] bg-teal-950/40 text-teal-400 px-1 py-0.5 rounded border border-teal-500/20 mt-0.5 inline-block w-fit">
                💡 <span className="font-bold">Pro Tip:</span> Press Alt + C on new tab
              </div>
            </div>

            {/* Section 2: Alt + S */}
            <div className="flex flex-col gap-1 p-1.5 rounded-lg bg-black border border-white/5">
              <div className="flex items-center gap-1 select-none">
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">Alt</span>
                <span className="text-white/40 text-[8.5px]">+</span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">S</span>
                <span className="text-neutral-400 text-[9px] font-semibold ml-1.5">(Any Website)</span>
              </div>
              <ul className="text-neutral-300 space-y-0.5 text-[9px] font-medium pl-0.5">
                <li className="flex items-start gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Search workspace instantly</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Run automations without tabs</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Capture notes & page context</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom CTA Button */}
      <div className="w-full flex justify-end shrink-0 mb-2 mt-1 px-4 md:px-6">
        <button
          onClick={handleFinish}
          className="cursor-pointer bg-gradient-to-r from-purple-400/10 to-indigo-400/10 border border-purple-400/25 hover:from-purple-400/20 hover:to-indigo-400/20 text-purple-300 hover:text-purple-200 font-medium py-2 px-6 rounded-full active:scale-[0.98] transition-all duration-200 flex items-center gap-2 text-xs tracking-wide">
          Let's automate with cmdOS
          <FaChevronRight size={10} />
        </button>
      </div>

    </div>
  );
};

export default TutorialDashboard;
