import { commandRegistry } from '../../../commands/registry';

export type LocalCommandId =
  | 'rename_project'
  | 'delete_project'
  | 'rename_folder'
  | 'delete_folder'
  | 'createnotes'
  | 'createlinks'
  | 'agent'
  | 'bookmarks'
  | 'dashboard'
  | 'tutorials'
  | 'createorganization'
  | 'delete_snippet'
  | 'delete_link'
  | 'store'
  | 'shortcuts'
  | 'profile'
  | 'calendar'
  | 'showallprompts'
  | 'show_all_links'
  | 'expand_all_folders'
  | 'settings'
  | 'refresh'
  | 'toggle-dark-mode'
  | 'upload_drive'
  | 'saved-automation';

export type LocalCommandScope = 'workspace' | 'folder' | 'snippet' | 'bookmark';
export type LocalCommandAction = 'rename' | 'delete';
export type LocalCommandBehavior = 'entity' | 'instant' | 'locked';

export interface LocalCommandDefinition {
  id: string; // Changed from LocalCommandId to string to allow newly registered commands
  label: string;
  prefix: string; // e.g., '/rename_project'
  behavior: LocalCommandBehavior;
  keywords?: string[]; // Search keywords for fuzzy matching
  // entity-selection behavior
  scope?: LocalCommandScope;
  action?: LocalCommandAction;
  // instant behavior identifier; consumers can route by this id
  executeId?: string;
  url?: string; // optional: open this URL directly for instant commands
  getDynamicLabel?: (context: any) => string;
  hotkey?: string; // User-defined hotkey (optional)
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>;
  showInDashboard?: boolean;
  category?: string;
  isAvailable?: (webContext?: any) => boolean;
}

// Check if we are running in the extension dashboard (chrome-extension:// protocol)
const isDashboardEnv = typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:';

// Auto-generate from registry (base defaults)
export const ALL_LOCAL_COMMANDS: LocalCommandDefinition[] =
  commandRegistry.getLocalCommandsDefinitions() as unknown as LocalCommandDefinition[];

// Filter out commands that are not supposed to be shown in dashboard if running in dashboard
export const LOCAL_COMMANDS: LocalCommandDefinition[] = isDashboardEnv
  ? ALL_LOCAL_COMMANDS.filter(cmd => cmd.showInDashboard !== false)
  : ALL_LOCAL_COMMANDS;




import { getStoredCustomizations } from '../../../../../Apis/features/localCommandsApiService';

/**
 * Get local commands with user customizations applied
 * (Synchronous version using whatever is currently in storage/cache)
 */
export const getLocalCommandsSync = async (): Promise<LocalCommandDefinition[]> => {
  const defaults = LOCAL_COMMANDS;
  const customizations = await getStoredCustomizations();

  return defaults.map(cmd => {
    const custom = customizations[cmd.id];

    if (!custom) return cmd; // No customization, use default

    return {
      ...cmd,
      prefix: custom.prefix || cmd.prefix, // Use custom if set, else default
      keywords: custom.keywords || cmd.keywords, // Use custom if set, else default
      hotkey: custom.hotkey || undefined, // Hotkey (new field)
    };
  });
};

export const filterLocalCommands = (query: string): LocalCommandDefinition[] => {
  const core = query.replace(/^\//, '').toLowerCase();
  if (!core) return LOCAL_COMMANDS;
  return LOCAL_COMMANDS.filter(
    c => c.id.includes(core) || c.label.toLowerCase().includes(core) || c.prefix.includes(core),
  );
};


export const isLocalCommandId = (id: string | null | undefined): id is LocalCommandId => {
  if (!id) return false;
  return (LOCAL_COMMANDS as LocalCommandDefinition[]).some(c => c.id === id);
};

// Re-export event dispatchers from new location
export {
  LOCAL_COMMAND_EVENTS,
  dispatchWorkspaceAction,
  dispatchSnippetDeleteAction,
  type WorkspaceActionDetail,
  type FolderActionDetail,
  type SnippetActionDetail,
  type LocalCommandAction as EventLocalCommandAction,
} from '../../../commands/utils/eventDispatchers';
