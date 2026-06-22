import { readFileSync } from 'node:fs';
import '@extension/env';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
// Vite loads .env before importing this file, so process.env has all VITE_* vars
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? '';
const PUBLIC_KEY = process.env.VITE_EXTENSION_PUBLIC_KEY ?? '';

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  ...(PUBLIC_KEY ? { key: PUBLIC_KEY } : {}),
  browser_specific_settings: {
    gecko: {
      id: 'example@example.com',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  description: '__MSG_extensionDescription__',
  host_permissions: [
    'https://www.cmdos.app/*',
    '',
    'https://www.cmdos.app/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://drive.google.com/*',
    '<all_urls>',
  ],
  permissions: [
    'storage',
    'tabs',
    'activeTab',
    'bookmarks',
    'scripting',
    'downloads',
    'history',
    'debugger',
    'topSites',
    'clipboardRead',
    'clipboardWrite',
    'cookies',
    'alarms',
    'contextMenus',
    'notifications',
    'unlimitedStorage',
    'identity',
  ],
  // Google Drive OAuth — Client ID injected from VITE_GOOGLE_CLIENT_ID in .env
  ...(GOOGLE_CLIENT_ID
    ? {
        oauth2: {
          client_id: GOOGLE_CLIENT_ID,
          scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        },
      }
    : {}),
  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup/index.html',
    default_icon: 'icon.png',
  },
  chrome_url_overrides: {
    newtab: 'new-tab/index.html',
  },

  commands: {
    // open_alt_s: {
    //   suggested_key: {
    //     default: 'Alt+S',
    //     mac: 'Alt+S',
    //   },
    //   description: 'Open the cmdOS quick capture overlay',
    // },
    // open_alt_c: {
    //   suggested_key: {
    //     default: 'Alt+C',
    //     mac: 'Alt+C',
    //   },
    //   description: 'Open the command palette',
    // },
    // focus_search: {
    //   suggested_key: {
    //     default: 'Alt+K',
    //     mac: 'Alt+K',
    //   },
    //   description: 'New tab: Command search',
    // },

    open_create: {
      suggested_key: {
        default: 'Alt+C',
        mac: 'Alt+C',
      },
      description: 'Open Create Menu',
    },
    open_alt_q: {
      suggested_key: {
        default: 'Alt+S',
        mac: 'Alt+S',
      },
      description: 'On Any Website: Command search',
    },
  },
  icons: {
    128: 'icon.png',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content/index.iife.js'],
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content-ui/index.iife.js'],
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['altq/index.iife.js'],
      run_at: 'document_start',
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      css: ['content.css'],
    },
  ],
  devtools_page: 'devtools/index.html',
  web_accessible_resources: [
    {
      resources: [
        '*.js',
        '*.css',
        '*.svg',
        '*.png',
        'icon.png',
        'icon-34.png',
        'pin_new_tab.png',
        'altq/*.js',
        'altq/*.css',
        'content/injected.js',
      ],
      matches: ['*://*/*'],
    },
  ],
  side_panel: {
    default_path: 'side-panel/index.html',
  },
  externally_connectable: {
    matches: [
      'https://www.cmdos.app/*',
      '',
      'https://www.cmdos.app/*',
    ],
  },
  // NOTE: chrome_url_overrides is intentionally NOT included to prevent new tab override
} satisfies chrome.runtime.ManifestV3;

export default manifest;
