import automation from '../../assets/my_automation.png';
import { CommandModule } from '../types';

export const SavedAutomationsCommand: CommandModule = {
  id: 'saved-automation',
  label: 'My Automations',
  prefix: '/saved',
  description: 'Manage and run your saved automation library.',
  keywords: ['saved automations', 'my automations', 'workflows'],
  behavior: 'locked',
  // Vite resolves this import to the correct chrome-extension:// URL at build time
  icon: automation,

  execute: () => {
    // Logic handled in search-integrated view via 'locked' behavior.
    // When this command is activated, the Searchbar switches to SavedAutomationsPanel.
  },
};
