import {
  FaRobot,
  FaExternalLinkAlt,
  FaMousePointer,
  FaPaste,
  FaHistory,
  FaClipboardList,
  FaCookieBite,
  FaKeyboard,
} from 'react-icons/fa';
import type { AgentPanelModule } from './AgentPanelTypes';

export const STORAGE_KEY = 'agent_panel_selected_agents';
export const AUTOMATIONS_KEY = 'automations';

export const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

export const MODULES: AgentPanelModule[] = [
  {
    id: 'open_tab',
    name: 'Open Link',
    icon: FaExternalLinkAlt,
    color: 'text-blue-400',
    description: 'Automatically opens the specified URL.',
    category: 'navigation',
  },
  {
    id: 'click',
    name: 'Click a button',
    icon: FaMousePointer,
    color: 'text-emerald-400',
    description: 'Automatically clicks the selected button or element.',
    category: 'navigation',
  },
  {
    id: 'paste',
    name: 'Paste in input field ',
    icon: FaPaste,
    color: 'text-purple-400',
    description: 'Automatically focuses the selected input field and pastes the provided text.',
    category: 'navigation',
  },
  {
    id: 'wait',
    name: 'Wait',
    icon: FaHistory,
    color: 'text-amber-400',
    description: 'Automatically pauses the automation for the specified duration.',
    category: 'navigation',
  },

  {
    id: 'clipboard_write',
    name: 'Write Clipboard',
    icon: FaClipboardList,
    color: 'text-indigo-400',
    description: 'Writes specific text to the browser clipboard.',
    category: 'navigation',
  },
  {
    id: 'clipboard_paste',
    name: 'Clipboard Paste',
    icon: FaPaste,
    color: 'text-orange-400',
    description: 'Pastes current system clipboard content into selected field.',
    category: 'navigation',
  },
  {
    id: 'cookies_clear',
    name: 'Clear Cookies',
    icon: FaCookieBite,
    color: 'text-amber-600',
    description: 'Clears all cookies for the current site.',
    category: 'navigation',
    isPro: true,
  },
  {
    id: 'keystroke',
    name: 'Keystroke',
    icon: FaKeyboard,
    color: 'text-cyan-400',
    description: 'Records and sends keyboard shortcuts.',
    category: 'navigation',
  },
];
