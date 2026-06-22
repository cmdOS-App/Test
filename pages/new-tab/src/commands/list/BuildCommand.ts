import { CommandModule } from '../types';

export const BuildCommand: CommandModule = {
  id: 'bulk',
  label: 'Bulk Actions',
  prefix: '/bulk',
  keywords: ['bulk', 'create space', 'bundle', 'stack', 'workspace'],
  behavior: 'instant',
  description: 'Create a new space or bundle of items',

  execute: context => {
    context.services.navigation({ kind: 'bulk' });
  },
};
