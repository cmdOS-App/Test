import { CommandModule } from '../types';

export const ShowBookmarksCommand: CommandModule = {
  id: 'bookmarks',
  label: 'Bookmarks',
  prefix: '/bookmarks',
  keywords: ['bookmarks', 'bookmark', 'saved', 'browser'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the all bookmarks view
    context.services.navigation({ kind: 'allItems', itemType: 'bookmarks' });
  },
};
