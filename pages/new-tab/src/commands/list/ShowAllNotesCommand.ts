import { CommandModule } from '../types';

export const ShowAllNotesCommand: CommandModule = {
  id: 'show_all_notes',
  label: 'Show all notes',
  prefix: '/notes',
  keywords: ['notes', 'all notes', 'show notes', 'list notes', 'view notes', 'my notes'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the all notes view
    context.services.navigation({ kind: 'allItems', itemType: 'notes' });
  },
};
