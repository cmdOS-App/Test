import { CommandModule } from '../types';
import { dispatchSnippetDeleteAction } from '../utils/eventDispatchers';

export const DeleteLinkCommand: CommandModule = {
  id: 'delete_link',
  label: 'Delete Link',
  prefix: '/deletelink',
  keywords: ['delete', 'remove', 'trash', 'dlt', 'del', 'discard', 'link', 'links', 'delete link', 'remove link'],
  behavior: 'entity',
  scope: 'snippet',
  action: 'delete',

  execute: (context, entity) => {
    if (!entity?.snippet || !entity?.workspace) {
      context.services.toast('No link selected', 'error');
      return;
    }

    dispatchSnippetDeleteAction({
      commandId: 'delete_link',
      snippetId: entity.snippet.id || entity.snippet.snippet_id || '',
      snippetKey: entity.snippet.key,
      category: entity.snippet.category,
      workspaceId: entity.workspace.workspace_id,
      workspaceName: entity.workspace.workspace_name,
      folderId: entity.folder?.folder_id ?? null,
      folderName: entity.folder?.folder_name ?? null,
    });
  },
};
