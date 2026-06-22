import type { Snippet, Workspace, Folder } from '../../../../../modals/interfaces';
export type SnippetSuggestion = {
  snippet: Snippet;
  workspace: Workspace;
  folder: Folder | null;
};

export type SnippetActionDetail = {
  snippetId: string;
  snippetKey: string;
  category: string | null | undefined;
  workspaceId: string;
  workspaceName?: string;
  folderId?: string | null;
  folderName?: string | null;
  orgId?: string;
  commandId: 'delete_snippet' | 'delete_link' | 'delete_folder';
};
