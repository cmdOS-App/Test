import { CommandModule } from '../types';

export const ShowAllLinksCommand: CommandModule = {
  id: 'show_all_links',
  label: 'Show all links',
  prefix: '/links',
  keywords: ['links', 'all links', 'show links', 'list links', 'view links', 'tabgroups', 'tab groups', 'my links'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the all links view
    context.services.navigation({ kind: 'allItems', itemType: 'links' });
  },
};
