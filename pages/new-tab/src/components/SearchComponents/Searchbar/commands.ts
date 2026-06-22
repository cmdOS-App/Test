export type CommandId =
  | 'ai'
  | 'gpt'
  | 'claude'
  | 'perplexity'
  | 'google'
  | 'yt'
  | 'gemini'
  // | 'calendar' // Handled by local command
  | 'perplexity'
  | 'yt'
  // | 'event' // Removed
  | 'lucky'
  | 'translate'
  | 'gmail'
  | 'drive'
  | 'assignments'
  | 'assignments'
  | 'createnotes'
  | 'createlinks'
  | 'agent'
  | 'createprompt'
  | 'history'
  | 'downloads'
  | 'extensions'
  | 'bookmarks'
  | 'passwords'
  | 'flags'
  | 'inspect'
  | 'version'
  | 'gpu'
  | 'dino'
  | 'about'
  | 'spotify'
  | 'gemini'
  | 'showallnotes'
  | 'showalllinks'
  | 'todo'
  | 'store';

export type AutoSubmitKind = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'calendar';

export interface CommandDefinition {
  id: CommandId;
  label: string;
  prefix: string; // e.g., '/gpt'
  urlTemplate: string; // e.g. "https://google.com/search?q={query}"
  iconHost: string; // Used for favicon unless custom icon is provided
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>; // Custom icon override
  type?: 'general' | 'ai' | 'social' | 'dev' | 'shopping' | 'news' | 'tabgroup';
  autoSubmit?: AutoSubmitKind;
  keywords: string[];
  category?: 'browser' | 'ai' | 'search';
  hotkey?: string;
}

const GOOGLE_KEYWORDS = ['google', 'search', 'web', 'lookup', 'engine'];

// Helper to determine the browser scheme and icon host
const getBrowserInfo = (): { scheme: string; iconHost: string; name: string } => {
  const userAgent = navigator.userAgent.toLowerCase();

  // Edge and Brave have specific schemes
  if (userAgent.includes('edg/') || userAgent.includes('edge')) {
    return { scheme: 'edge://', iconHost: 'microsoft.com', name: 'Edge' };
  }

  if ((navigator as any).brave && (navigator as any).brave.isBrave) {
    return { scheme: 'brave://', iconHost: 'brave.com', name: 'Brave' };
  }

  // Default to Chrome (handles Comet, Atlas, and standard Chrome)
  return { scheme: 'chrome://', iconHost: 'google.com', name: 'Chrome' };
};

const BROWSER_INFO = getBrowserInfo();
export const BROWSER_NAME = BROWSER_INFO.name;


export const COMMANDS: CommandDefinition[] = [
  // --- Internal Browser Pages ---
  {
    id: 'history',
    label: 'History',
    prefix: '/history',
    urlTemplate: `${BROWSER_INFO.scheme}history`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['history', 'recent', 'past', 'visited', 'core'],
    category: 'browser',
  },
  {
    id: 'extensions',
    label: 'Extensions',
    prefix: '/extensions',
    urlTemplate: `${BROWSER_INFO.scheme}extensions`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['extensions', 'plugins', 'addons', 'browser extensions', 'core'],
    category: 'browser',
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    prefix: '/bookmarks',
    urlTemplate: `${BROWSER_INFO.scheme}bookmarks`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['bookmarks', 'favorites', 'saved', 'core'],
    category: 'browser',
  },
  {
    id: 'downloads',
    label: 'Downloads',
    prefix: '/downloads',
    urlTemplate: `${BROWSER_INFO.scheme}downloads`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['downloads', 'files', 'downloaded', 'core'],
    category: 'browser',
  },

  {
    id: 'passwords',
    label: 'Passwords',
    prefix: '/passwords',
    urlTemplate: `${BROWSER_INFO.scheme}password-manager`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['passwords', 'credentials', 'login', 'manager', 'core'],
    category: 'browser',
  },
  {
    id: 'flags',
    label: 'Flags',
    prefix: '/flags',
    urlTemplate: `${BROWSER_INFO.scheme}flags`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['flags', 'experimental', 'features', 'dev'],
    category: 'browser',
  },
  {
    id: 'inspect',
    label: 'Inspect',
    prefix: '/inspect',
    urlTemplate: `${BROWSER_INFO.scheme}inspect`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['inspect', 'developer', 'tools', 'debug', 'dev'],
    category: 'browser',
  },
  {
    id: 'version',
    label: 'Version',
    prefix: '/version',
    urlTemplate: `${BROWSER_INFO.scheme}version`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['version', 'build', 'about', 'info', 'dev'],
    category: 'browser',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    prefix: '/tasks',
    urlTemplate: `${BROWSER_INFO.scheme}tasks`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['tasks', 'manager', 'processes', 'perf', 'performance'],
    category: 'browser',
  },
  {
    id: 'gpu',
    label: 'GPU',
    prefix: '/gpu',
    urlTemplate: `${BROWSER_INFO.scheme}gpu`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['gpu', 'graphics', 'acceleration', 'perf', 'performance'],
    category: 'browser',
  },
  {
    id: 'dino',
    label: 'Dino Game',
    prefix: '/dino',
    urlTemplate: `${BROWSER_INFO.scheme}dino`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['dino', 'game', 't-rex', 'offline', 'fun'],
    category: 'browser',
  },
  {
    id: 'about',
    label: 'About Browser',
    prefix: '/about',
    urlTemplate: `${BROWSER_INFO.scheme}about`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['about', 'list', 'urls', 'chrome urls', 'all'],
    category: 'browser',
  },

  // --- Existing Commands ---
  {
    id: 'ai',
    label: 'All AI Chat Agents',
    prefix: '/ai',
    urlTemplate: 'about:blank#ai:{query}',
    iconHost: 'chatgpt.com',
    keywords: ['ai', 'assistants', 'all ai', 'meta'],
    category: 'ai',
  },
  {
    id: 'gpt',
    label: 'ChatGPT',
    prefix: '/gpt',
    urlTemplate: 'https://chatgpt.com/?q={query}',
    iconHost: 'chatgpt.com',
    autoSubmit: 'chatgpt',
    keywords: ['chatgpt', 'gpt', 'openai', 'ai', 'chat', 'assistant'],
    category: 'ai',
  },
  {
    id: 'claude',
    label: 'Claude',
    prefix: '/claude',
    urlTemplate: 'https://claude.ai/new?q={query}',
    iconHost: 'claude.ai',
    autoSubmit: 'claude',
    keywords: ['claude', 'anthropic', 'ai', 'assistant', 'chat'],
    category: 'ai',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    prefix: '/gemini',
    // Gemini does not accept prompt params; we open the app and auto-inject via background
    urlTemplate: 'https://gemini.google.com/app',
    iconHost: 'gemini.google.com',
    autoSubmit: 'gemini',
    keywords: ['gemini', 'google ai', 'bard', 'chat', 'assistant', 'ai'],
    category: 'ai',
  },
  // {
  //   id: 'calendar',
  //   label: 'Calendar Agent',
  //   prefix: '/calendar',
  //   urlTemplate: 'https://gemini.google.com/app',
  //   iconHost: 'gemini.google.com', // Use Gemini icon
  //   autoSubmit: 'calendar',
  //   keywords: ['calendar', 'schedule', 'meeting', 'event', 'agenda', 'ai'],
  //   category: 'ai',
  // },
  {
    id: 'perplexity',
    label: 'Perplexity',
    prefix: '/p',
    urlTemplate: 'https://www.perplexity.ai/search?q={query}',
    iconHost: 'perplexity.ai',
    autoSubmit: 'perplexity',
    keywords: ['perplexity', 'ai', 'answers', 'search assistant', 'ask'],
    category: 'ai',
  },

  // {
  //   id: 'google',
  //   label: 'Ask Google Search',
  //   prefix: '/google',
  //   urlTemplate: 'https://www.google.com/search?q={query}',
  //   iconHost: 'google.com',
  //   keywords: GOOGLE_KEYWORDS,
  // },

  // {
  //   id: 'translate',
  //   label: 'Google Translate',
  //   prefix: '/translate',
  //   urlTemplate: 'https://translate.google.com/?text={query}',
  //   iconHost: 'translate.google.com',
  //   keywords: ['translate', 'translation', 'language', 'languages', 'google translate', 'translator'],
  // },
  // {
  //   id: 'drive',
  //   label: 'Google Drive',
  //   prefix: '/drive',
  //   urlTemplate: 'https://drive.google.com/drive/search?q={query}',
  //   iconHost: 'drive.google.com',
  //   keywords: ['drive', 'google drive', 'storage', 'files', 'documents', 'cloud'],
  // },

  // {
  //   id: 'yt',
  //   label: 'YouTube Search',
  //   prefix: '/yt',
  //   urlTemplate: 'https://www.youtube.com/results?search_query={query}',
  //   iconHost: 'youtube.com',
  //   keywords: ['youtube', 'yt', 'video', 'videos', 'watch', 'stream'],
  // },
  // {
  //   id: 'help',
  //   label: 'Help',
  //   prefix: '/help',
  //   urlTemplate: 'about:blank#help',
  //   iconHost: 'help.com',
  //   keywords: ['help', 'commands', 'info', 'support', 'guide', 'instructions'],
  // },
  // {
  //   id: 'event',
  //   label: 'Create Google Event',
  //   prefix: '/event',
  //   // Special handling in Searchbar; buildUrl unused here
  //   // urlTemplate: 'about:blank#event:{query}',
  //   // iconHost: 'calendar.google.com',
  //   // keywords: ['event', 'calendar', 'meeting', 'schedule', 'reminder', 'google calendar', 'gcal', 'invite'],
  //   // category: 'search',
  // // },
  // {
  //   id: 'spotify',
  //   label: 'Spotify Search',
  //   prefix: '/spotify',
  //   urlTemplate: 'https://open.spotify.com/search/{query}',
  //   iconHost: 'spotify.com',
  //   keywords: ['spotify', 'music', 'listen', 'audio', 'artist', 'album', 'song'],
  // },
  {
    id: 'store',
    label: 'Automation Store',
    prefix: '/store',
    description: 'Browse and install automation modules by category.',
    iconHost: '', // Handled by StoreCommand
    keywords: [
      'store',
      'app store',
      'module store',
      'apps',
      'app',
      'connect app',
      'connect',
      'integration',
      'integrations',
      'marketplace',
    ],
  },

].filter(cmd => {
  // Filter out Chrome-specific commands for non-Chrome browsers (Edge, Brave)
  const chromeSpecificIds = ['passwords', 'tasks', 'inspect', 'dino'];
  if (BROWSER_INFO.scheme !== 'chrome://' && chromeSpecificIds.includes(cmd.id)) {
    return false;
  }
  return true;
}) as CommandDefinition[];

export const AI_GROUP = {
  id: 'ai',
  label: 'All AI Chat Agents',
  prefix: '/ai',
  members: ['gpt', 'claude', 'gemini', 'perplexity'] as CommandId[],
};

export const DEFAULT_SELECTED_AIS: CommandId[] = ['gpt', 'perplexity', 'gemini'];

export const findCommandByPrefix = (
  input: string,
  commands: CommandDefinition[] = COMMANDS,
): CommandDefinition | undefined => {
  const trimmed = input.trim();
  return commands.find(cmd => trimmed.startsWith(cmd.prefix));
};

export const filterCommands = (query: string, commands: CommandDefinition[] = COMMANDS): CommandDefinition[] => {
  const core = query.replace(/^\//, '').toLowerCase();
  if (!core) return commands;
  return commands.filter(c => c.id.includes(core) || c.label.toLowerCase().includes(core) || c.prefix.includes(core));
};

export const buildUrl = (template: string, prompt: string): string => {
  const encoded = encodeURIComponent(prompt);
  // Robustly replace common placeholder variations
  const url = template
    .replace(/\{query\s*\}/gi, encoded)
    .replace(/\[query\s*\]/gi, encoded)
    .replace(/\{content\s*\}/gi, encoded)
    .replace(/\{prompt\s*\}/gi, encoded);
  return url;
};
