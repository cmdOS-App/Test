import { CommandModule } from '../types';
import {
  setDarkMode,
  setCommandStatus,
  resetCommandStatus,
  setDebouncedSearchTerm,
} from '../../../../Redux/AllData/uiStateSlice';

export const ToggleDarkModeCommand: CommandModule = {
  id: 'toggle-dark-mode',
  label: 'Toggle Dark Mode',
  prefix: '/darkmode',
  keywords: [
    'dark mode',
    'light mode',
    'theme',
    'toggle theme',
    'switch theme',
    'enable dark mode',
    'disable dark mode',
  ],
  behavior: 'instant',

  getDynamicLabel: context => {
    // Check if the setting is currently enabled in Redux state
    const isDark = (context.state as any).uiState?.darkMode;

    if (isDark) {
      return 'Switch to Light Mode (Currently Dark)';
    } else {
      return 'Switch to Dark Mode (Currently Light)';
    }
  },

  execute: ({ services, dispatch, state }) => {
    const isDark = (state as any).uiState?.darkMode;
    const newState = !isDark;

    dispatch(setCommandStatus({ status: 'loading', message: 'Switching theme...' }));
    dispatch(setDarkMode(newState));

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ new_tab_dark_mode: newState });
    }

    dispatch(setCommandStatus({ status: 'success', message: `Switched to ${newState ? 'Dark' : 'Light'} Mode` }));

    // Reset after 3 seconds and navigate home
    setTimeout(() => {
      dispatch(resetCommandStatus());
      dispatch(setDebouncedSearchTerm(''));
    }, 3000);
  },
};
