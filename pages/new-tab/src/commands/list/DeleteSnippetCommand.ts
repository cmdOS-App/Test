import { CommandModule } from '../types';
import { dispatchSnippetDeleteAction } from '../utils/eventDispatchers';

export const DeleteSnippetCommand: CommandModule = {
  id: 'delete_snippet',
  label: 'Delete Note',
  prefix: '/deletenote',
  keywords: ['delete', 'remove', 'trash', 'dlt', 'del', 'discard', 'snippet', 'note', 'delete note', 'remove note'],
  behavior: 'entity',
  scope: 'snippet',
  action: 'delete',

  execute: (context, entity) => {
    
    if (!entity?.snippet || !entity?.workspace) {
      context.services.toast('No note selected', 'error');
      return;
    }

    dispatchSnippetDeleteAction({
      commandId: 'delete_snippet',
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
