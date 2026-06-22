import { CommandModule } from '../types';

export const ShortcutsCommand: CommandModule = {
  id: 'shortcuts',
  label: 'Command List',
  prefix: '/shortcuts',
  keywords: ['commands', 'list commands', 'shortcuts', 'hotkeys', 'help'],
  behavior: 'instant',

  execute: ({ services }) => {
    services.navigation({ kind: 'commandList' });
  },
};
