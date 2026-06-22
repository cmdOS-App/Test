import { CommandModule } from '../types';

export const ShowAllPromptsCommand: CommandModule = {
  id: 'show_all_prompts',
  label: 'Show all prompts',
  prefix: '/prompts',
  keywords: ['prompts', 'all prompts', 'show prompts', 'list prompts', 'view prompts', 'my prompts', 'ai prompts'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the all prompts view
    context.services.navigation({ kind: 'allItems', itemType: 'prompts' });
  },
};
