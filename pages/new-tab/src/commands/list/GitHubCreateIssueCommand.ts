import { CommandModule } from '../types';

export const GitHubCreateIssueCommand: CommandModule = {
  id: 'github_create_issue',
  label: 'Create Issue',
  prefix: '/github-create-issue',
  keywords: ['github', 'issue', 'create issue', 'new issue'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: (webContext) => {
    return webContext?.site === 'github' && webContext?.pageType === 'repository' && !!webContext?.metadata?.owner && !!webContext?.metadata?.repo;
  },

  execute: (context) => {
    // For direct link opening commands, execution is typically resolved via the tab context url in AltQ,
    // or by opening a tab. We provide an execute method that opens a tab.
    const url = GitHubCreateIssueCommand.url;
    if (url) {
      window.open(url, '_blank');
    }
  },

  getDynamicLabel: (context) => {
    // Label can be customized dynamically if we have context in the UI,
    // but the fallback label is 'Create Issue'.
    return 'Create Issue';
  }
};
