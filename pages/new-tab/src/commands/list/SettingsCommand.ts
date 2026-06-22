import { CommandModule } from '../types';

export const SettingsCommand: CommandModule = {
  id: 'settings',
  label: 'Settings',
  prefix: '/settings',
  keywords: ['settings', 'config', 'preferences', 'options'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the command list view and select 'settings' category
    context.services.navigation({ kind: 'commandList', category: 'settings' });
  },
};
