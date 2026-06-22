import { CommandModule } from '../types';

export const BookmarksCommand: CommandModule = {
  id: 'bookmarks',
  label: 'Bookmarks',
  prefix: '/bookmarks',
  keywords: ['bookmark', 'bookmarks', 'saved', 'favorites', 'favourites', 'saved links', 'organize links'],
  behavior: 'entity',
  scope: 'bookmark',

  execute: () => {
    // Handled by Searchbar UI
  },
};
