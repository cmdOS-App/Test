import { CommandModule } from '../types';
import {
  setNewTabOverrideEnabled,
  setCommandStatus,
  resetCommandStatus,
  setDebouncedSearchTerm,
} from '../../../../Redux/AllData/uiStateSlice';

export const NewTabOverrideCommand: CommandModule = {
  id: 'toggle-new-tab-override',
  label: 'Toggle New Tab Override',
  prefix: '/newtab',
  keywords: [
    'new tab',
    'override',
    'toggle new tab',
    'enable new tab',
    'disable new tab',
    'turn on new tab',
    'turn off new tab',
  ],
  behavior: 'instant',

  getDynamicLabel: context => {
    // Check if the setting is currently enabled in Redux state
    // We cast to any because context.state is RootState but we want to avoid circular type deps if possible,
    // or just assume standard structure.
    const isEnabled = (context.state as any).uiState?.isNewTabOverrideEnabled;

    if (isEnabled) {
      return 'Disable New Tab Override (Currently ON)';
    } else {
      return 'Enable New Tab Override (Currently OFF)';
    }
  },

  execute: ({ services, dispatch }) => {
    dispatch(setCommandStatus({ status: 'loading', message: 'Updating New Tab settings...' }));
    const chromeAny = (window as any)?.chrome;

    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['new_tab_override_enabled'], (result: any) => {
        // Default to true if undefined? Logic in App.tsx was similar.
        // Let's assume result.new_tab_override_enabled is the truth.
        const currentState = result.new_tab_override_enabled === true;
        const newState = !currentState;

        chromeAny.storage.local.set({ new_tab_override_enabled: newState }, () => {
          // Update Redux state immediately for UI consistency
          dispatch(setNewTabOverrideEnabled(newState));

          dispatch(
            setCommandStatus({
              status: 'success',
              message: `New Tab Override ${newState ? 'Enabled' : 'Disabled'}`,
            }),
          );

          // Reset after 3 seconds and navigate home
          setTimeout(() => {
            dispatch(resetCommandStatus());
            dispatch(setDebouncedSearchTerm(''));
          }, 3000);
        });
      });
    } else {
      services.toast('Storage API not available', 'error');
    }
  },
};
