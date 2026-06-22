import { IStorageProvider } from '../../IStorageProvider';

export class CloudProvider implements IStorageProvider {
  async fetchTeams(): Promise<any> {
    return [];
  }

  async fetchWorkspaces(_teamId: string): Promise<any> {
    return [];
  }

  async fetchFolders(_orgId: string | null, _workspaceId: string | null): Promise<any> {
    return [];
  }

  async getAll(): Promise<any> {
    return {
      organizations: [],
      workspaces: [],
      folders: [],
      snippets: []
    };
  }

  async createSnippet(_snippets: any): Promise<any> {
    return null;
  }

  async updateSnippetRealtime(_data: any): Promise<any> {
    return null;
  }

  async deleteSnippet(_folder_id: string | undefined, _snippet_id: string): Promise<any> {
    return null;
  }

  async deleteMultiple(_snippetIds: string[]): Promise<any> {
    return null;
  }

  async createWorkspace(_payload: any): Promise<any> {
    return null;
  }

  async updateWorkspace(_payload: any): Promise<any> {
    return null;
  }

  async updateWorkspaceCustomization(_payload: any): Promise<any> {
    return null;
  }

  async deleteWorkspace(_payload: any): Promise<any> {
    return null;
  }

  async createFolder(_payload: any): Promise<any> {
    return null;
  }

  async updateFolder(_folderId: string, _name: string, _orgId: string, _workspaceId: string): Promise<any> {
    return null;
  }

  async updateFolderCustomization(_payload: any): Promise<any> {
    return null;
  }

  async deleteFolder(_folderId: string, _orgId: string, _workspaceId: string): Promise<any> {
    return null;
  }

  async createOrganization(_payload: any): Promise<any> {
    return null;
  }

  async updateOrganization(_orgId: string, _payload: any): Promise<any> {
    return null;
  }

  async deleteOrganization(_orgId: string): Promise<any> {
    return null;
  }

  async removeMemberFromOrganization(_orgId: string, _userId: string): Promise<any> {
    return null;
  }

  async inviteMemberToOrg(_orgId: string, _email: string, _role: string): Promise<any> {
    return null;
  }

  async createJoinLink(_orgId: string, _linkType: string, _options?: any): Promise<any> {
    return null;
  }

  async getJoinLinks(_orgId: string, _status?: string): Promise<any> {
    return [];
  }

  async revokeJoinLink(_orgId: string, _linkId: string): Promise<any> {
    return null;
  }

  async getOrganizationInvitations(_orgId: string, _params?: any): Promise<any> {
    return [];
  }

  async acceptInvitation(_orgId: string, _invitationId: string): Promise<any> {
    return null;
  }

  async rejectInvitation(_orgId: string, _invitationId: string): Promise<any> {
    return null;
  }

  async setRefreshCounter(_orgId: string, _counterValue: number): Promise<void> {}

  async getRefreshCounters(_orgIds: string[]): Promise<Record<string, number>> {
    return {};
  }

  async getUpcomingTodos(): Promise<any> {
    return [];
  }

  async getOverdueTodos(): Promise<any> {
    return [];
  }

  async getTodosByDate(_date: string, _includeCompleted: boolean): Promise<any> {
    return [];
  }

  async getRecurringTodos(_date?: string): Promise<any> {
    return [];
  }

  async convertSnippetToTodo(_payload: any): Promise<any> {
    return null;
  }

  async convertToTodoWithConfig(_payload: any): Promise<any> {
    return null;
  }

  async editTodo(_payload: any): Promise<any> {
    return null;
  }

  async modifyTodo(_payload: any): Promise<any> {
    return null;
  }

  async updateTodoStatus(_snippetId: string, _isDone: boolean): Promise<any> {
    return null;
  }

  async deleteTodo(_todoId: string | number): Promise<any> {
    return null;
  }

  async fetchSavedAutomations(_userId: string): Promise<any> {
    return [];
  }

  async fetchAutomationContents(_userId: string, _automationId: string): Promise<any> {
    return null;
  }

  async createAutomation(_userId: string, _payload: any): Promise<any> {
    return null;
  }

  async updateAutomation(_userId: string, _payload: any): Promise<any> {
    return null;
  }

  async deleteAutomation(_userId: string, _automationIdOrIds: string | string[]): Promise<any> {
    return null;
  }

  async updateInputOverride(_userId: string, _moduleId: number, _config: any): Promise<any> {
    return null;
  }

  async createLegacyAutomation(_userId: string, _data: any): Promise<any> {
    return null;
  }

  async updateLegacyAutomation(_userId: string, _data: any): Promise<any> {
    return null;
  }

  async deleteLegacyAutomation(_userId: string, _id: number): Promise<any> {
    return null;
  }

  async getFavorites(_userId: string): Promise<any> {
    return [];
  }

  async addFavorite(_payload: { user_id: string; snippet_id?: string; command_id?: string }): Promise<any> {
    return null;
  }

  async deleteFavorite(_userId: string, _favoriteId: number): Promise<any> {
    return null;
  }

  async fetchUserCommands(_userId: string): Promise<any> {
    return [];
  }

  async updateUserCommand(_installationId: number, _payload: any): Promise<any> {
    return null;
  }

  async updateCommandHotkey(_installationId: number, _payload: { hotkey: string }): Promise<any> {
    return null;
  }

  async fetchUserLocalCommandCustomizations(_userId: string): Promise<any> {
    return [];
  }

  async upsertUserLocalCommand(_payload: any): Promise<any> {
    return null;
  }

  async deleteUserLocalCommand(_id: number): Promise<any> {
    return null;
  }

  async getOrgTags(_userId: string, _orgId: string): Promise<any> {
    return [];
  }

  async createTagInOrg(_userId: string, _orgId: string, _name: string): Promise<any> {
    return null;
  }

  async fetchStore(): Promise<any> {
    return [];
  }

  async fetchModuleById(_userId: string, _id: number): Promise<any> {
    return null;
  }

  async installStoreModule(_moduleId: number | string, _payload: any): Promise<any> {
    return null;
  }

  async installModule(_userId: string, _moduleId: string, _options?: any): Promise<any> {
    return null;
  }

  async getInstallations(_userId: string): Promise<any> {
    return [];
  }

  async updateStoreInstallation(_moduleId: number | string, _installationId: number, _payload: any): Promise<any> {
    return null;
  }

  async updateModuleInstallation(_userId: string, _moduleId: string, _installationId: number, _payload: any): Promise<any> {
    return null;
  }

  async uninstallStoreModule(_moduleId: string | number, _installationId: number): Promise<any> {
    return null;
  }

  async uninstallModule(_userId: string, _moduleId: string): Promise<any> {
    return null;
  }

  async getModuleCatalog(): Promise<any> {
    return [];
  }

  async updateModuleCustomization(_userId: string, _moduleId: string, _payload: { hotkey?: string | null; is_favourite?: boolean }): Promise<any> {
    return null;
  }

  async getInstalledModules(_userId: string): Promise<any> {
    return [];
  }

  async getFavoritedModules(_userId: string): Promise<any> {
    return [];
  }

  async updateSnippetShortcut(_userId: string, _snippetId: string, _shortcut: string): Promise<any> {
    return null;
  }

  async clearSnippetShortcut(_userId: string, _snippetId: string): Promise<any> {
    return null;
  }

  async updateSnippetHotkey(_userId: string, _snippetId: string, _hotkey: string): Promise<any> {
    return null;
  }

  async clearSnippetHotkey(_userId: string, _snippetId: string): Promise<any> {
    return null;
  }

  async updateSnippetCustomization(_userId: string, _snippetId: string, _payload: { icon?: string | null; color?: string | null }): Promise<any> {
    return null;
  }

  async getFolderMembers(_userId: string, _folder_id: string): Promise<any> {
    return [];
  }

  async addOrUpdateFolderMember(_userId: string, _folder_id: string, _target_user_id: string, _role: string): Promise<any> {
    return null;
  }

  async changeFolderAccess(_userId: string, _folder_id: string, _target_user_id: string, _new_role: string): Promise<any> {
    return null;
  }

  async removeFolderMember(_userId: string, _folder_id: string, _target_user_id: string): Promise<any> {
    return null;
  }

  async createShareLinkForSnippet(_userId: string, _snippet_id: string): Promise<any> {
    return null;
  }

  async createSequreShareLinkForSnippet(_userId: string, _snippet_id: string, _pass_key: string): Promise<any> {
    return null;
  }

  async fetchPublicLinksForSnippet(_userId: string, _snippet_id: string): Promise<any> {
    return [];
  }

  async revokePublicLink(_userId: string, _link_id: string): Promise<any> {
    return null;
  }

  async saveSnippetsOrder(_userId: string, _payload: any): Promise<any> {
    return null;
  }
}
