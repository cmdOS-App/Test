import { CommandModule } from '../types';

export const GitHubOpenSettingsCommand: CommandModule = {
  id: 'github_open_settings',
  label: 'Open Repository Settings',
  prefix: '/github-open-settings',
  keywords: ['github', 'settings', 'repository settings', 'repo settings'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: (webContext) => {
    return webContext?.site === 'github' && webContext?.pageType === 'repository' && !!webContext?.metadata?.owner && !!webContext?.metadata?.repo;
  },

  execute: (context) => {
    const url = GitHubOpenSettingsCommand.url;
    if (url) {
      window.open(url, '_blank');
    }
  },

  getDynamicLabel: (context) => {
    return 'Open Repository Settings';
  }
};
