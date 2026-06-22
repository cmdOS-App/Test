import { CommandModule } from '../types';

export const CreateOrganizationCommand: CommandModule = {
  id: 'createorganization',
  label: 'Create New Organization',
  prefix: '/createorganization',
  keywords: ['create', 'organization', 'new', 'team', 'org', 'add org', 'new org'],
  behavior: 'instant',
  description: 'Create a new organization',

  execute: context => {
    // Navigate to in-app create organization panel
    context.services.navigation({ kind: 'createOrganization' });
  },
};
