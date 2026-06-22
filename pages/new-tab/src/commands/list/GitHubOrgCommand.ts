import { CommandModule } from '../types';

export const GitHubOrgCommand: CommandModule = {
  id: 'github_org_action',
  label: 'GitHub Org Action',
  prefix: '/github-org',
  keywords: ['github', 'organization', 'org', 'repository', 'open repository', 'create issue', 'settings'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: (webContext) => {
    return webContext?.site === 'github' && webContext?.pageType === 'organization' && !!webContext?.metadata?.organization;
  },

  execute: (context) => {
    // Resolved directly within AltQ UI dropdowns/palettes.
  }
};
