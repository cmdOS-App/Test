export interface Tag {
  tag_id: string;
  name: string;
}

export interface Team {
  org_id: string;
  team_name: string;
  workspaces: Workspace[];
}

export interface Workspace {
  workspace_id: string;
  workspace_name: string;
  folders: Folder[];
  workspace_snippets: Snippet[];
}

export interface WorkspaceDetails {
  workspace_id: string;
  workspace_name: string;
  org_id: string;
  type: 'public' | 'private' | 'shareonly';
  admin_user_id?: string;
}

export interface Folder {
  folder_id: string;
  folder_name: string;
  snippets: Snippet[];
}

export interface Tabs {
  urls: string[];
  names: string[];
}

export interface Snippet {
  id: string;
  key: string;
  value: string | Tabs;
  category: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[] | null;
  snippet_id?: string;
}

export interface NewSnippetBreadCrum {
  workspace_id: string | null;
  workspace_name: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
}
