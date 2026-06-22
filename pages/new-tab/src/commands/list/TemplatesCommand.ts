import { CommandModule } from '../types';

export const TemplatesCommand: CommandModule = {
  id: 'templates',
  label: 'Templates',
  prefix: '/templates',
  keywords: ['templates', 'template', 'categories', 'quicklinks'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the dedicated templates view
    context.services.navigation({ kind: 'templatesView' });
  },
};
