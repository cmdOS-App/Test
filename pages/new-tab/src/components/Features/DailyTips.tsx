import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsInfoCircle } from 'react-icons/bs';

interface Tip {
  id: string;
  text: string;
  prompt: string;
  commandId: string;
}

const TIPS: Tip[] = [
  {
    id: 'gpt',
    prompt: '"GPT give me new business ideas"',
    text: 'to search ChatGPT',
    commandId: 'gpt',
  },
  {
    id: 'create-note',
    text: ' to create a note',
    commandId: 'createnotes',
    prompt: '"Create note"',
  },
  {
    id: 'yt',
    text: 'to search songs',
    prompt: '"/yt song name"',
    commandId: 'yt',
  },
];

interface DailyTipsProps {
  onCommand: (commandId: string) => void;
}

export const DailyTips: React.FC<DailyTipsProps> = ({ onCommand }) => {
  const [activeTip, setActiveTip] = useState<Tip | null>(null);

  useEffect(() => {
    const runTipsLogic = async () => {
      try {
        const storageKey = 'daily_tips_state';
        const chromeAny = (window as any).chrome;
        if (!chromeAny?.storage?.local) return;

        const result = await chromeAny.storage.local.get([storageKey]);
        const rawState = result[storageKey];

        let state = rawState
          ? (typeof rawState === 'string' ? JSON.parse(rawState) : rawState)
          : {
              viewCounter: 0,
              winningView: Math.floor(Math.random() * 4) + 1, // Random 1-4
              currentTipIndex: 0,
              totalShownCount: 0,
            };

        // 0. Hard stop after 15 displays
        if ((state.totalShownCount || 0) >= 15) {
          setActiveTip(null);
          return;
        }

        // 1. Increment View Counter
        state.viewCounter += 1;

        // 2. Cycle Logic
        if (state.viewCounter > 4) {
          state.viewCounter = 1;
          state.winningView = Math.floor(Math.random() * 4) + 1;
          // Select a random tip from the pool
          state.currentTipIndex = Math.floor(Math.random() * TIPS.length);
        }

        // 3. Increment total shown count when we hit the winning view
        if (state.viewCounter === state.winningView) {
          state.totalShownCount = (state.totalShownCount || 0) + 1;
          setActiveTip(TIPS[state.currentTipIndex]);
        } else {
          setActiveTip(null);
        }

        // 4. Save State
        await chromeAny.storage.local.set({ [storageKey]: state });
      } catch (e) {
        console.error('Failed to run DailyTips logic', e);
      }
    };
    runTipsLogic();
  }, []);

  if (!activeTip) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex justify-end mb-2 w-full pr-4">
        <button
          onClick={() => {
            onCommand(activeTip.commandId);
            setActiveTip(null); // Dismiss immediately on click
          }}
          className="
            relative min-w-[25%] max-w-[50%] 
            px-4 py-2
            text-left text-sm font-medium text-neutral-450 
            
           shadow-sm
           border-none
            rounded-xl
           transition-all duration-300
            group
            flex items-center gap-3
          ">
          <BsInfoCircle
            className="text-neutral-300 group-hover:text-purple-500 transition-colors flex-shrink-0"
            size={16}
          />
          <span className="flex-1 truncate text-gray-400 text-bold font-medium ">
            {' '}
            Type <span className="text-purple-500">{activeTip.prompt} </span>
            {activeTip.text}
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
