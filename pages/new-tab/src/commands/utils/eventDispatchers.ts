export const LOCAL_COMMAND_EVENTS = {
  workspaceRename: 'alts:workspace-rename',
  workspaceDelete: 'alts:workspace-delete',
  folderRename: 'alts:folder-rename',
  folderDelete: 'alts:folder-delete',
  snippetDelete: 'alts:snippet-delete',
} as const;

export type LocalCommandAction = 'rename' | 'delete';

export interface WorkspaceActionDetail {
  workspaceId: string;
  workspaceName?: string;
}

export interface FolderActionDetail {
  folderId: string;
  folderName: string;
  workspaceId: string;
}

export interface SnippetActionDetail {
  snippetId: string;
  snippetKey: string;
  category: string;
  workspaceId: string;
  workspaceName?: string;
  folderId?: string | null;
  folderName?: string | null;
  commandId: string; // Changed from LocalCommandId to string to avoid circular dependency if possible, or we need to be careful
}

export const dispatchWorkspaceAction = (action: LocalCommandAction, detail: WorkspaceActionDetail) => {
  const eventName = action === 'rename' ? LOCAL_COMMAND_EVENTS.workspaceRename : LOCAL_COMMAND_EVENTS.workspaceDelete;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

export const dispatchSnippetDeleteAction = (detail: SnippetActionDetail) => {
  window.dispatchEvent(new CustomEvent(LOCAL_COMMAND_EVENTS.snippetDelete, { detail }));
};
