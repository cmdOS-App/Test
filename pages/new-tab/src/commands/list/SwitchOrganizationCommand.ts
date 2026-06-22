import { CommandModule } from '../types';
import {
  setSelectedTeam,
  setSelectedWorkspace,
  setSelectedFolder,
  setSelectedSnippet,
  setIsCreatingNewItem,
} from '../../../../Redux/AllData/uiStateSlice';
import type { Team } from '../../../../modals/interfaces';

export const SwitchOrganizationCommand: CommandModule = {
  id: 'switchorganization',
  label: 'Switch Organization',
  prefix: '/switchorganization',
  keywords: ['switch', 'organization', 'change', 'team', 'org', 'switch org'],
  behavior: 'instant',
  description: 'Switch to a different organization',

  execute: context => {
    // Navigate to organizations list view
    context.services.navigation({ kind: 'allItems', itemType: 'organizations' });
  },
};

// Helper to perform the actual organization switch via Redux (no page reload needed)
export const performOrganizationSwitch = (
  dispatch: any,
  team: Team,
  toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void,
) => {
  dispatch(setSelectedTeam(team));
  dispatch(setSelectedWorkspace(null));
  dispatch(setSelectedFolder(null));
  dispatch(setSelectedSnippet(null));
  dispatch(setIsCreatingNewItem(false));
  toast(`Switched to ${team.team_name}`, 'success');
};
