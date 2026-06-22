import { CommandModule, CommandContext, EntitySelection } from './types';
import { CreateNoteCommand } from './list/CreateNoteCommand';
import { CreateSnippetCommand } from './list/CreateSnippetCommand';
import { CreateLinkCommand } from './list/CreateLinkCommand';
import { CreatePromptCommand } from './list/CreatePromptCommand';
import { CalendarCommand } from './list/CalendarCommand';
import { DashboardCommand } from './list/DashboardCommand';
import { TutorialsCommand } from './list/TutorialsCommand';
import { AgentCommand } from './list/AgentCommand';
import { CreateOrganizationCommand } from './list/CreateOrganizationCommand';
import { SwitchOrganizationCommand } from './list/SwitchOrganizationCommand';
import { StoreCommand } from './list/StoreCommand';
import { ShortcutsCommand } from './list/ShortcutsCommand';
import { SavedAutomationsCommand } from './list/SavedAutomationsCommand';
import { RenameWorkspaceCommand } from './list/RenameWorkspaceCommand';
import { DeleteWorkspaceCommand } from './list/DeleteWorkspaceCommand';
import { RenameFolderCommand } from './list/RenameFolderCommand';
import { DeleteFolderCommand } from './list/DeleteFolderCommand';
// import { BookmarksCommand } from './list/BookmarksCommand';
import { DeleteSnippetCommand } from './list/DeleteSnippetCommand';
import { DeleteLinkCommand } from './list/DeleteLinkCommand';
//import { NewTabOverrideCommand } from './list/NewTabOverrideCommand';
// import { ToggleDarkModeCommand } from './list/ToggleDarkModeCommand';
import { ProfileCommand } from './list/ProfileCommand';
// BuildCommand removed - functionality merged into CreateLinkCommand
import { ShowAllNotesCommand } from './list/ShowAllNotesCommand';
import { ShowAllLinksCommand } from './list/ShowAllLinksCommand';
import { ShowAllPromptsCommand } from './list/ShowAllPromptsCommand';
import { ShowBookmarksCommand } from './list/ShowBookmarksCommand';
import { ToggleAutoExpandCommand } from './list/ToggleAutoExpandCommand';

import { TemplatesCommand } from './list/TemplatesCommand';
import { RefreshCommand } from './list/Refresh';

// import { CreateNoteFullCommand } from './list/CreateNoteFullCommand';
import { SettingsCommand } from './list/SettingsCommand';
import { ExportAllCommand } from './list/ExportAll';
import { UploadDriveCommand } from './list/UploadDriveCommand';

import { GitHubCreateIssueCommand } from './list/GitHubCreateIssueCommand';
import { GitHubCreatePRCommand } from './list/GitHubCreatePRCommand';
import { GitHubOpenSettingsCommand } from './list/GitHubOpenSettingsCommand';
import { GitHubOrgCommand } from './list/GitHubOrgCommand';

/**
 * Central registry of all commands
 * Add new commands here to register them
 */
class CommandRegistry {
  private commands: Map<string, CommandModule> = new Map();

  constructor() {
    
    this.register(CreateNoteCommand);
    this.register(CreateSnippetCommand);
    //this.register(CreateNoteFullCommand);
    this.register(CreateLinkCommand);
    this.register(CreatePromptCommand);
    this.register(AgentCommand);
    this.register(CalendarCommand);
    this.register(DashboardCommand);
    this.register(TutorialsCommand);
    this.register(CreateOrganizationCommand);
    this.register(SwitchOrganizationCommand);
    this.register(StoreCommand);
    this.register(ShortcutsCommand);
    this.register(SavedAutomationsCommand);
    //this.register(RenameWorkspaceCommand);
    //this.register(DeleteWorkspaceCommand);
    //this.register(RenameFolderCommand);
    //this.register(DeleteFolderCommand);
    this.register(ShowBookmarksCommand);
    this.register(DeleteSnippetCommand);
    this.register(DeleteLinkCommand);
    //this.register(NewTabOverrideCommand);
    // Dark/light toggle command is temporarily disabled to keep app in dark mode only.
    // this.register(ToggleDarkModeCommand);
    this.register(ProfileCommand);
    this.register(ShowAllNotesCommand);
    this.register(ShowAllLinksCommand);
    this.register(ShowAllPromptsCommand);

    this.register(ToggleAutoExpandCommand);
    this.register(SettingsCommand);
    this.register(RefreshCommand);
    this.register(TemplatesCommand);
    this.register(ExportAllCommand);
    this.register(UploadDriveCommand);

    // Register GitHub context actions
    this.register(GitHubCreateIssueCommand);
    this.register(GitHubCreatePRCommand);
    this.register(GitHubOpenSettingsCommand);
    this.register(GitHubOrgCommand);
  }


  register(command: CommandModule): void {
    if (this.commands.has(command.id)) {
      console.warn(`Command ${command.id} is already registered`);
      return;
    }
    this.commands.set(command.id, command);
  }

  get(id: string): CommandModule | undefined {
    return this.commands.get(id);
  }

  getAll(): CommandModule[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get all commands formatted for LOCAL_COMMANDS array (backward compatibility)
   */
  getLocalCommandsDefinitions() {
    return this.getAll().map(cmd => ({
      id: cmd.id,
      label: cmd.label,
      prefix: cmd.prefix,
      behavior: cmd.behavior,
      keywords: cmd.keywords,
      scope: cmd.scope,
      action: cmd.action,
      executeId: cmd.id,
      url: cmd.url,
      getDynamicLabel: cmd.getDynamicLabel,
      icon: cmd.icon,
      showInDashboard: cmd.showInDashboard,
      category: cmd.category,
      isAvailable: cmd.isAvailable,
    }));
  }


  /**
   * Get all keywords for search (replaces LOCAL_COMMAND_KEYWORDS)
   */
  getKeywordsMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    this.getAll().forEach(cmd => {
      map[cmd.id] = cmd.keywords;
    });
    return map;
  }

  /**
   * Universal executor - handles both instant and entity commands
   */
  async execute(id: string, context: CommandContext, entity?: EntitySelection): Promise<void> {
    const command = this.get(id);
    if (!command) {
      console.warn(`Command ${id} not found`);
      return;
    }

    // Check if command can execute
    if (command.canExecute && !command.canExecute(context, entity)) {
      context.services.toast('Command cannot be executed', 'error');
      return;
    }

    // Pre-execution hook
    if (command.onBeforeExecute) {
      await command.onBeforeExecute(context);
    }

    // Handle URL-based commands
    if (command.url && command.behavior === 'instant') {
      const chromeAny = (window as any)?.chrome;

      // 1. Try direct tabs.create if available (extension context)
      if (chromeAny?.tabs?.create) {
        try {
          chromeAny.tabs.create({ url: command.url });
          return;
        } catch (e) {
          console.warn('[BrowserCommand] chrome.tabs.create failed, trying message:', e);
        }
      }

      // 2. Try sending message to background script (if in context where tabs API is restricted but runtime isn't)
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage({ action: 'open_tab', url: command.url }, (response: any) => {
          if (chromeAny.runtime.lastError) {
            console.warn('[BrowserCommand] Failed to open tab via background:', chromeAny.runtime.lastError);
            // 3. Fallback to window.open (might be blocked for chrome:// URLs)
            try {
              window.open(command.url, '_blank');
            } catch (err) {
              console.error('[BrowserCommand] window.open failed:', err);
            }
          }
        });
        return;
      }

      // 3. Final fallback
      try {
        window.open(command.url, '_blank');
      } catch (err) {
        console.error('[BrowserCommand] window.open final fallback failed:', err);
      }
      return;
    }

    // Execute the command
    await command.execute(context, entity);
  }

  /**
   * Search commands by query
   */
  search(query: string): CommandModule[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(cmd => {
      // Match by prefix
      if (cmd.prefix.toLowerCase().includes(lowerQuery)) return true;
      // Match by label
      if (cmd.label.toLowerCase().includes(lowerQuery)) return true;
      // Match by keywords
      if (cmd.keywords.some(kw => kw.toLowerCase().includes(lowerQuery))) return true;
      // Match by ID
      if (cmd.id.includes(lowerQuery)) return true;
      return false;
    });
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();

// Export convenience functions
export const getAllCommands = () => commandRegistry.getAll();
export const getCommand = (id: string) => commandRegistry.get(id);
export const executeCommand = (id: string, context: CommandContext, entity?: EntitySelection) =>
  commandRegistry.execute(id, context, entity);
export const searchCommands = (query: string) => commandRegistry.search(query);
