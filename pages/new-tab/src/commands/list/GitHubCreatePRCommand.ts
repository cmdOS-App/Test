import { CommandModule } from '../types';

export const GitHubCreatePRCommand: CommandModule = {
  id: 'github_create_pr',
  label: 'Create Pull Request',
  prefix: '/github-create-pr',
  keywords: ['github', 'pr', 'pull request', 'create pr', 'new pr', 'compare'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: (webContext) => {
    return webContext?.site === 'github' && webContext?.pageType === 'repository' && !!webContext?.metadata?.owner && !!webContext?.metadata?.repo;
  },

  execute: (context) => {
    const url = GitHubCreatePRCommand.url;
    if (url) {
      window.open(url, '_blank');
    }
  },

  getDynamicLabel: (context) => {
    return 'Create Pull Request';
  }
};
