import { CommandModule } from '../types';
import { dispatchWorkspaceAction } from '../utils/eventDispatchers';

export const DeleteWorkspaceCommand: CommandModule = {
  id: 'delete_project',
  label: 'Delete Workspace',
  prefix: '/delete_project',
  keywords: ['delete', 'remove', 'trash', 'dlt', 'del', 'discard', 'workspace', 'project', 'workspace delete'],
  behavior: 'entity',
  scope: 'workspace',
  action: 'delete',

  execute: (context, entity) => {
    if (!entity?.workspace) return;

    dispatchWorkspaceAction('delete', {
      workspaceId: entity.workspace.workspace_id,
      workspaceName: entity.workspace.workspace_name,
    });
  },
};
