
import type { Team } from '../../modals/interfaces';

export interface IStorageProvider {
  /**
   * Fetch all organizations/teams for the current user
   */
  fetchTeams(): Promise<any>;

  /**
   * Fetch workspaces belonging to a team
   */
  fetchWorkspaces(teamId: string): Promise<any>;

  /**
   * Fetch folders belonging to an organization/workspace
   */
  fetchFolders(orgId: string | null, workspaceId: string | null): Promise<any>;

  /**
   * Fetch the entire nested data tree (Teams -> Workspaces -> Folders -> Snippets)
   */
  getAll(): Promise<any>;

  /**
   * Create a new snippet
   */
  createSnippet(snippets: any): Promise<any>;

  /**
   * Update an existing snippet or create if not exists
   */
  updateSnippetRealtime(data: any): Promise<any>;

  /**
   * Delete a single snippet
   */
  deleteSnippet(folder_id: string | undefined, snippet_id: string): Promise<any>;

  /**
   * Delete multiple snippets
   */
  deleteMultiple(snippetIds: string[]): Promise<any>;

  // --- Workspace CRUD ---

  createWorkspace(payload: any): Promise<any>;
  updateWorkspace(payload: any): Promise<any>;
  updateWorkspaceCustomization(payload: any): Promise<any>;
  deleteWorkspace(payload: any): Promise<any>;

  // --- Folder CRUD ---

  createFolder(payload: any): Promise<any>;
  updateFolder(folderId: string, name: string, orgId: string, workspaceId: string): Promise<any>;
  updateFolderCustomization(payload: any): Promise<any>;
  deleteFolder(folderId: string, orgId: string, workspaceId: string): Promise<any>;

  // --- Organization CRUD ---

  createOrganization(payload: any): Promise<any>;
  updateOrganization(orgId: string, payload: any): Promise<any>;
  deleteOrganization(orgId: string): Promise<any>;
  removeMemberFromOrganization(orgId: string, userId: string): Promise<any>;
  inviteMemberToOrg(orgId: string, email: string, role: string): Promise<any>;

  // --- Join Links & Invitations ---
  createJoinLink(orgId: string, linkType: string, options?: any): Promise<any>;
  getJoinLinks(orgId: string, status?: string): Promise<any>;
  revokeJoinLink(orgId: string, linkId: string): Promise<any>;

  // Organization Migration
  migrateOrganization?(payload: any): Promise<any>;

  getOrganizationInvitations(orgId: string, params?: any): Promise<any>;
  acceptInvitation(orgId: string, invitationId: string): Promise<any>;
  rejectInvitation(orgId: string, invitationId: string): Promise<any>;

  // --- Refresh Counters ---
  setRefreshCounter(orgId: string, counterValue: number): Promise<void>;
  getRefreshCounters(orgIds: string[]): Promise<Record<string, number>>;

  // --- Todo Reads ---
  getUpcomingTodos(): Promise<any>;
  getOverdueTodos(): Promise<any>;
  getTodosByDate(date: string, includeCompleted: boolean): Promise<any>;
  getRecurringTodos(date?: string): Promise<any>;

  // --- Todo Writes ---
  convertSnippetToTodo(payload: any): Promise<any>;
  convertToTodoWithConfig(payload: any): Promise<any>;
  editTodo(payload: any): Promise<any>;
  modifyTodo(payload: any): Promise<any>;
  updateTodoStatus(snippetId: string, isDone: boolean): Promise<any>;
  deleteTodo(todoId: string | number): Promise<any>;

  // --- Automation Reads ---
  fetchSavedAutomations(userId: string): Promise<any>;
  fetchAutomationContents(userId: string, automationId: string): Promise<any>;

  // --- Automation Writes ---
  createAutomation(userId: string, payload: any): Promise<any>;
  updateAutomation(userId: string, payload: any): Promise<any>;
  deleteAutomation(userId: string, automationIdOrIds: string | string[]): Promise<any>;
  updateInputOverride(userId: string, moduleId: number, config: any): Promise<any>;

  // --- Legacy Automation Writes ---
  createLegacyAutomation(userId: string, data: any): Promise<any>;
  updateLegacyAutomation(userId: string, data: any): Promise<any>;
  deleteLegacyAutomation(userId: string, id: number): Promise<any>;

  // --- Favorites CRUD ---
  getFavorites(userId: string): Promise<any>;
  addFavorite(payload: { user_id: string; snippet_id?: string; command_id?: string }): Promise<any>;
  deleteFavorite(userId: string, favoriteId: number): Promise<any>;

  // --- User Commands ---
  fetchUserCommands(userId: string): Promise<any>;
  updateUserCommand(installationId: number, payload: any): Promise<any>;
  updateCommandHotkey(installationId: number, payload: { hotkey: string }): Promise<any>;

  // --- Local Command Customizations ---
  fetchUserLocalCommandCustomizations(userId: string): Promise<any>;
  upsertUserLocalCommand(payload: any): Promise<any>;
  deleteUserLocalCommand(id: number): Promise<any>;

  // --- Tags CRUD ---
  getOrgTags(userId: string, orgId: string): Promise<any>;
  createTagInOrg(userId: string, orgId: string, name: string): Promise<any>;

  // --- Store & Installed Modules ---
  fetchStore(): Promise<any>;
  fetchModuleById(userId: string, id: number): Promise<any>;
  installStoreModule(moduleId: number | string, payload: any): Promise<any>;
  installModule(userId: string, moduleId: string, options?: any): Promise<any>;
  getInstallations(userId: string): Promise<any>;
  updateStoreInstallation(moduleId: number | string, installationId: number, payload: any): Promise<any>;
  updateModuleInstallation(userId: string, moduleId: string, installationId: number, payload: any): Promise<any>;
  uninstallStoreModule(moduleId: string | number, installationId: number): Promise<any>;
  uninstallModule(userId: string, moduleId: string): Promise<any>;

  getModuleCatalog(): Promise<any>;
  updateModuleCustomization(userId: string, moduleId: string, payload: { hotkey?: string | null; is_favourite?: boolean }): Promise<any>;
  getInstalledModules(userId: string): Promise<any>;
  getFavoritedModules(userId: string): Promise<any>;

  // --- Snippet Hotkeys & Shortcuts ---
  updateSnippetShortcut(userId: string, snippetId: string, shortcut: string): Promise<any>;
  clearSnippetShortcut(userId: string, snippetId: string): Promise<any>;
  updateSnippetHotkey(userId: string, snippetId: string, hotkey: string): Promise<any>;
  clearSnippetHotkey(userId: string, snippetId: string): Promise<any>;

  // --- Snippet Customization ---
  updateSnippetCustomization(userId: string, snippetId: string, payload: { icon?: string | null; color?: string | null }): Promise<any>;

  // --- Folder Members ---
  getFolderMembers(userId: string, folder_id: string): Promise<any>;
  addOrUpdateFolderMember(userId: string, folder_id: string, target_user_id: string, role: string): Promise<any>;
  changeFolderAccess(userId: string, folder_id: string, target_user_id: string, new_role: string): Promise<any>;
  removeFolderMember(userId: string, folder_id: string, target_user_id: string): Promise<any>;

  // --- Snippet Sharing & Ordering ---
  createShareLinkForSnippet(userId: string, snippet_id: string): Promise<any>;
  createSequreShareLinkForSnippet(userId: string, snippet_id: string, pass_key: string): Promise<any>;
  fetchPublicLinksForSnippet(userId: string, snippet_id: string): Promise<any>;
  revokePublicLink(userId: string, link_id: string): Promise<any>;
  saveSnippetsOrder(userId: string, payload: any): Promise<any>;

  // --- Workspace & Org Membership & Invitations ---
  getWorkspaceDetails(workspaceId: string): Promise<any>;
  removeMemberFromWorkspace(userId: string, workspaceId: string): Promise<any>;
  getMembersInOrganization(orgId: string): Promise<any>;
  addMemberToWorkspace(userId: string, workspaceId: string, role: string): Promise<any>;
  changeMemberAccess(userId: string, workspaceId: string, role: string): Promise<any>;
  inviteMemberIntoOrganization(orgId: string, email: string): Promise<any>;
}
