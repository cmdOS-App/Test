import { CommandModule } from '../types';
import { dispatchWorkspaceAction } from '../utils/eventDispatchers';

export const RenameWorkspaceCommand: CommandModule = {
  id: 'rename_project',
  label: 'Rename Workspace',
  prefix: '/rename_project',
  keywords: ['rename', 'change name', 'edit name', 'retitle', 'workspace', 'project', 'workspace rename'],
  behavior: 'entity',
  scope: 'workspace',
  action: 'rename',

  execute: (context, entity) => {
    if (!entity?.workspace) return;

    dispatchWorkspaceAction('rename', {
      workspaceId: entity.workspace.workspace_id,
      workspaceName: entity.workspace.workspace_name,
    });
  },
};
