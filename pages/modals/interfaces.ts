export interface Tag {
  tag_id: string;
  name: string;
}

export interface Team {
  team_id: string;
  team_name: string;
  workspaces: Workspace[];
  is_personal_space?: boolean;
  storageMode?: 'local' | 'cloud';
  migrationStatus?: 'none' | 'migrating' | 'failed';
  created_at?: string;
  updated_at?: string;
  tags?: Tag[];
}

export interface AutomationStep {
  id: number;
  module_id: string;
  step_order: number;
  config: Record<string, any>;
  created_at?: string;
}

export interface SavedAutomation {
  id: number;
  name: string;
  description?: string | null;
  user_id: string;
  workspace_id?: string | null;
  folder_id?: string | null;
  created_at: string;
  updated_at: string;
  automation_steps: AutomationStep[];
  snippet_id?: string;
  // Cloud-native per-automation fields (new /automations endpoint)
  // NOTE: Unlike snippets, these are plain scalar values — NOT dictionary strings.
  hotkeys?: string | null;
  shortcuts?: string | null;
  is_favourite?: boolean;
  // Legacy local-only fields — kept for runtime compat during transition
  type?: 'automation' | 'automationModule' | string;
  category?: string;
  timestamp?: number;
  steps?: any[];
  inputs?: any[];
  iconHost?: string;
  iconStack?: boolean;
}

export interface Workspace {
  workspace_id: string;
  workspace_name: string;
  folders: Folder[];
  workspace_snippets: Snippet[];
  workspace_automations: SavedAutomation[];
  workspace_chat_agents?: any[];
  chat_agents?: any[];
  workspace_agents?: any[];
  icon?: string | null;
  color?: string | null;
  type?: string | null;
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
  automations: SavedAutomation[];
  folders?: Folder[];
  icon?: string | null;
  color?: string | null;
  access_code?: number;
  effective_role?: string;
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
  favourite_id?: number;
  icon?: string | null;
  color?: string | null;
  // Cloud shortcuts/hotkeys - dictionary format: "user_id1:/shortcut1, user_id2:/shortcut2"
  shortcuts?: string | null;
  hotkeys?: string | null;
  automation?: any;
  steps?: any[];
  // Todo-related fields
  event_deadline?: string;
  is_done?: boolean;
  is_recurring?: boolean;
  recurring_cycle?: string | null;
  reminder?: string;
  is_todo_type?: boolean;
  searchtags?: Record<string, string[]> | string | null;
  config?: Record<string, any> | string;
}

export interface NewSnippetBreadCrum {
  workspace_id: string | null;
  workspace_name: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
}

export interface FavoriteCommand {
  id: string; // Command ID (e.g., 'gpt')
  type: 'command';
  label: string; // Display name (e.g., 'ChatGPT')
  icon?: string; // URL or identifier
  commandPrefix: string; // e.g., '/gpt'
  iconHost?: string; // e.g. "google.com"
  iconStack?: boolean;
  favourite_id?: number;
  category?: string;
  automation?: any;
}

export type FavoriteItemType = Snippet | FavoriteCommand;
