import { IStorageProvider } from '../IStorageProvider';
import { Team, Workspace, Folder, Snippet } from '../../../modals/interfaces';
import { getUserId, getUserName } from '../../core/identity';
import { updateUserHotkey, updateUserShortcut } from '../../../utils/shortcutHotkeyUtils';
import { SUPABASE_BASE_URL } from '../../core/apiConfig';
export class LocalProvider implements IStorageProvider {
  // --- Helpers ---

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  private async getLocalOrgs(): Promise<Team[]> {
    const result = await chrome.storage.local.get('localOrganizations');
    return result.localOrganizations || [];
  }

  public async saveLocalOrgs(orgs: Team[]): Promise<void> {
    await chrome.storage.local.set({ localOrganizations: orgs });
    await this.materializeCache(orgs);
  }

  private async materializeCache(localOrgs: Team[]): Promise<void> {
    const result = await chrome.storage.local.get('myCachedAllData');
    const existingData: Team[] = result.myCachedAllData || [];

    const localOrgIds = new Set(localOrgs.map((org: any) => String(org.team_id)));

    // Cloud orgs do not have storageMode === 'local'
    // Filter out old local orgs and merge the newly updated local tree.
    // We ALSO filter out any org whose ID is in the localOrgs array to prevent duplicates
    // from old local orgs that didn't have the storageMode flag.
    const cloudOrgs = existingData.filter(
      (org: any) => org.storageMode !== 'local' && !localOrgIds.has(String(org.team_id)),
    );
    // Ensure every local org carries storageMode: 'local' in the cache.
    // Orgs created before this field was added have storageMode: undefined in
    // localOrganizations — stamping here backfills them without touching storage.
    const localOrgsWithMode = localOrgs.map(org => ({ ...org, storageMode: 'local' as const }));
    const merged = [...cloudOrgs, ...localOrgsWithMode];

    // Rebuild automations cache for the background runner
    const newAutomationsMap: Record<string, any> = {};
    for (const org of merged) {
      for (const ws of org.workspaces || []) {
        for (const auto of ws.workspace_automations || []) {
          const localId = String(auto.id);
          newAutomationsMap[localId] = {
            id: localId,
            type: 'automation',
            name: auto.name,
            description: auto.description || null,
            workspace_id: auto.workspace_id || ws.workspace_id,
            folder_id: auto.folder_id || null,
            steps: (auto.automation_steps || []).map((s: any) => ({
              id: s.id ? String(s.id) : `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              moduleId: s.module_id,
              config: s.config || {},
            })),
            automation_steps: auto.automation_steps || [],
            timestamp: new Date(auto.updated_at || auto.created_at || Date.now()).getTime(),
            hotkeys: auto.hotkeys || null,
            shortcuts: auto.shortcuts || null,
            is_favourite: auto.is_favourite || false,
          };
        }
        for (const folder of ws.folders || []) {
          for (const auto of folder.automations || []) {
            const localId = String(auto.id);
            newAutomationsMap[localId] = {
              id: localId,
              type: 'automation',
              name: auto.name,
              description: auto.description || null,
              workspace_id: auto.workspace_id || ws.workspace_id,
              folder_id: auto.folder_id || folder.folder_id,
              steps: (auto.automation_steps || []).map((s: any) => ({
                id: s.id ? String(s.id) : `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                moduleId: s.module_id,
                config: s.config || {},
              })),
              automation_steps: auto.automation_steps || [],
              timestamp: new Date(auto.updated_at || auto.created_at || Date.now()).getTime(),
              hotkeys: auto.hotkeys || null,
              shortcuts: auto.shortcuts || null,
              is_favourite: auto.is_favourite || false,
            };
          }
        }
      }
    }

    await chrome.storage.local.set({
      myCachedAllData: merged,
      automations: newAutomationsMap,
    });
  }

  // --- Reads ---

  async fetchTeams(): Promise<any> {
    return await this.getLocalOrgs();
  }

  async fetchWorkspaces(teamId: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find(o => o.team_id === teamId);
    return { workspaces: org?.workspaces || [] };
  }

  async fetchFolders(orgId: string | null, workspaceId: string | null): Promise<any> {
    if (!orgId || !workspaceId) return { folders: [] };
    const orgs = await this.getLocalOrgs();
    const org = orgs.find(o => o.team_id === orgId);
    const workspace = org?.workspaces.find(w => w.workspace_id === workspaceId);
    return { folders: workspace?.folders || [] };
  }

  async getAll(): Promise<any> {
    await this.cleanupStaleCompletedTodos();
    const localOrgs = await this.getLocalOrgs();
    return localOrgs.map(org => ({ ...org, storageMode: 'local' as const }));
  }

  // --- Snippet CRUD ---

  async createSnippet(snippets: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const createdSnippets = [];

    // snippets is usually an array of NewSnippet
    const snippetsArray = Array.isArray(snippets) ? snippets : [snippets];

    for (const snippetData of snippetsArray) {
      for (const org of orgs) {
        const ws = org.workspaces.find(w => w.workspace_id === snippetData.workspace_id);
        if (ws) {
          const userId = await getUserId().catch(() => 'local_user');
          const userName = await getUserName().catch(() => 'Local User');

          const newSnippet: any = {
            id: this.generateId('snippet'),
            key: snippetData.key,
            value: snippetData.value,
            category: snippetData.category,
            user_id: userId,
            first_name: userName,
            last_name: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: snippetData.tags || [],
            searchtags: snippetData.searchtags || null,
            config: snippetData.config || null,
          };
          newSnippet.snippet_id = newSnippet.id; // Many places rely on snippet_id

          if (snippetData.folder_id) {
            const folder = ws.folders.find(f => f.folder_id === snippetData.folder_id);
            if (folder) {
              if (!folder.snippets) folder.snippets = [];
              folder.snippets.push(newSnippet);
              createdSnippets.push(newSnippet);
            }
          } else {
            if (!ws.workspace_snippets) ws.workspace_snippets = [];
            ws.workspace_snippets.push(newSnippet);
            createdSnippets.push(newSnippet);
          }
          break; // move to next snippetData once added
        }
      }
    }

    await this.saveLocalOrgs(orgs);
    return createdSnippets;
  }

  async updateSnippetRealtime(data: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    let foundSnippet = false;
    let updatedSnippet = null;

    if (!data.snippet_id && !data.id) {
      // It's a create
      const created = await this.createSnippet([data]);
      return { snippet: created[0], isNew: true };
    }

    const targetId = data.snippet_id || data.id;

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        // Check workspace snippets
        if (ws.workspace_snippets) {
          const sIndex = ws.workspace_snippets.findIndex(s => s.id === targetId || s.snippet_id === targetId);
          if (sIndex !== -1) {
            ws.workspace_snippets[sIndex] = {
              ...ws.workspace_snippets[sIndex],
              ...data,
              updated_at: new Date().toISOString(),
            };
            updatedSnippet = ws.workspace_snippets[sIndex];
            foundSnippet = true;
            break;
          }
        }
        // Check folders
        for (const folder of ws.folders) {
          if (folder.snippets) {
            const sIndex = folder.snippets.findIndex(s => s.id === targetId || s.snippet_id === targetId);
            if (sIndex !== -1) {
              folder.snippets[sIndex] = { ...folder.snippets[sIndex], ...data, updated_at: new Date().toISOString() };
              updatedSnippet = folder.snippets[sIndex];
              foundSnippet = true;
              break;
            }
          }
        }
        if (foundSnippet) break;
      }
      if (foundSnippet) break;
    }

    if (!foundSnippet) {
      // Fallback: If not found, create it instead of throwing error, as realtime updates sometimes behave like creates
      const created = await this.createSnippet([data]);
      return { snippet: created[0], isNew: true };
    }

    await this.saveLocalOrgs(orgs);
    return { snippet: updatedSnippet };
  }

  async deleteSnippet(folder_id: string | undefined, snippet_id: string): Promise<any> {
    return await this.deleteMultiple([snippet_id]);
  }

  async deleteMultiple(snippetIds: string[]): Promise<any> {
    const orgs = await this.getLocalOrgs();

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_snippets) {
          ws.workspace_snippets = ws.workspace_snippets.filter(
            s => !snippetIds.includes(s.id) && !snippetIds.includes(s.snippet_id || ''),
          );
        }
        for (const folder of ws.folders) {
          if (folder.snippets) {
            folder.snippets = folder.snippets.filter(
              s => !snippetIds.includes(s.id) && !snippetIds.includes(s.snippet_id || ''),
            );
          }
        }
      }
    }

    await this.saveLocalOrgs(orgs);
    return { success: true };
  }

  // --- Organization CRUD ---

  async createOrganization(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const welcomeWorkspace: Workspace = {
      workspace_id: this.generateId('workspace'),
      workspace_name: 'Welcome',
      type: 'private',
      folders: [],
      workspace_snippets: [],
      workspace_automations: [],
      icon: null,
      color: null,
    };

    const newOrg: Team = {
      team_id: this.generateId('org'),
      team_name: payload.org_name || 'Personal Space',
      is_personal_space: false,
      storageMode: 'local',
      migrationStatus: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      workspaces: [welcomeWorkspace],
    };
    orgs.push(newOrg);
    await this.saveLocalOrgs(orgs);
    return newOrg;
  }

  async updateOrganization(orgId: string, payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const orgIndex = orgs.findIndex(o => o.team_id === orgId);
    if (orgIndex === -1) throw new Error('Organization not found locally');

    orgs[orgIndex] = { ...orgs[orgIndex], ...payload, updated_at: new Date().toISOString() };
    await this.saveLocalOrgs(orgs);
    return orgs[orgIndex];
  }

  async deleteOrganization(orgId: string): Promise<any> {
    let orgs = await this.getLocalOrgs();
    orgs = orgs.filter(o => o.team_id !== orgId);
    await this.saveLocalOrgs(orgs);
    return { success: true };
  }

  async removeMemberFromOrganization(orgId: string, userId: string): Promise<any> {
    return { success: true };
  }
  async inviteMemberToOrg(orgId: string, email: string, role: string): Promise<any> {
    return { success: true };
  }
  async createJoinLink(orgId: string, linkType: string, options?: any): Promise<any> {
    return { success: true, link_id: 'local_link', join_link: 'local' };
  }
  async getJoinLinks(orgId: string, status?: string): Promise<any> {
    return { success: true, join_links: [] };
  }
  async revokeJoinLink(orgId: string, linkId: string): Promise<any> {
    return { success: true };
  }
  async getOrganizationInvitations(orgId: string, params?: any): Promise<any> {
    return { success: true, invitations: [], pagination: {} };
  }
  async acceptInvitation(orgId: string, invitationId: string): Promise<any> {
    return { success: true };
  }
  async rejectInvitation(orgId: string, invitationId: string): Promise<any> {
    return { success: true };
  }
  async setRefreshCounter(orgId: string, counterValue: number): Promise<void> {}
  async getRefreshCounters(orgIds: string[]): Promise<Record<string, number>> {
    const res: Record<string, number> = {};
    orgIds.forEach(id => {
      res[id] = 0;
    });
    return res;
  }

  // --- Workspace CRUD ---

  async createWorkspace(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find(o => o.team_id === payload.org_id);
    if (!org) throw new Error('Organization not found locally');

    const newWorkspace: Workspace = {
      workspace_id: this.generateId('workspace'),
      workspace_name: payload.name || 'New Workspace',
      folders: [],
      workspace_snippets: [],
      workspace_automations: [],
      icon: null,
      color: null,
      type: payload.type || 'private',
    };

    org.workspaces.push(newWorkspace);
    await this.saveLocalOrgs(orgs);
    return newWorkspace;
  }

  async updateWorkspace(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    for (const org of orgs) {
      const wsIndex = org.workspaces.findIndex(w => w.workspace_id === payload.workspace_id);
      if (wsIndex !== -1) {
        org.workspaces[wsIndex].workspace_name = payload.workspace_name;
        // Optionally update other fields here
        await this.saveLocalOrgs(orgs);
        return org.workspaces[wsIndex];
      }
    }
    throw new Error('Workspace not found locally');
  }

  async updateWorkspaceCustomization(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    for (const org of orgs) {
      const wsIndex = org.workspaces.findIndex(w => w.workspace_id === payload.workspace_id);
      if (wsIndex !== -1) {
        if (payload.icon !== undefined) org.workspaces[wsIndex].icon = payload.icon;
        if (payload.color !== undefined) org.workspaces[wsIndex].color = payload.color;
        await this.saveLocalOrgs(orgs);
        return org.workspaces[wsIndex];
      }
    }
    throw new Error('Workspace not found locally');
  }

  async deleteWorkspace(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    for (const org of orgs) {
      const wsIndex = org.workspaces.findIndex(w => w.workspace_id === payload.workspace_id);
      if (wsIndex !== -1) {
        org.workspaces.splice(wsIndex, 1);
        await this.saveLocalOrgs(orgs);
        return { success: true };
      }
    }
    throw new Error('Workspace not found locally');
  }

  // --- Folder CRUD ---

  async createFolder(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    for (const org of orgs) {
      const ws = org.workspaces.find(w => w.workspace_id === payload.workspace_id);
      if (ws) {
        const newFolder: Folder = {
          folder_id: this.generateId('folder'),
          folder_name: payload.name || 'New Folder',
          snippets: [],
          automations: [],
          folders: [],
        };
        ws.folders.push(newFolder);
        await this.saveLocalOrgs(orgs);
        return newFolder;
      }
    }
    throw new Error('Workspace not found locally for folder creation');
  }

  async updateFolder(folderId: string, name: string, orgId: string, workspaceId: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find(o => o.team_id === orgId);
    const ws = org?.workspaces.find(w => w.workspace_id === workspaceId);
    if (ws) {
      const folder = ws.folders.find(f => f.folder_id === folderId);
      if (folder) {
        folder.folder_name = name;
        await this.saveLocalOrgs(orgs);
        return folder;
      }
    }
    throw new Error('Folder not found locally');
  }

  async updateFolderCustomization(payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find(o => o.team_id === payload.org_id);
    const ws = org?.workspaces.find(w => w.workspace_id === payload.workspace_id);
    if (ws) {
      const folder = ws.folders.find(f => f.folder_id === payload.folder_id);
      if (folder) {
        if (payload.icon !== undefined) folder.icon = payload.icon;
        if (payload.color !== undefined) folder.color = payload.color;
        await this.saveLocalOrgs(orgs);
        return folder;
      }
    }
    throw new Error('Folder not found locally');
  }

  async deleteFolder(folderId: string, orgId: string, workspaceId: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find(o => o.team_id === orgId);
    const ws = org?.workspaces.find(w => w.workspace_id === workspaceId);
    if (ws) {
      const fIndex = ws.folders.findIndex(f => f.folder_id === folderId);
      if (fIndex !== -1) {
        ws.folders.splice(fIndex, 1);
        await this.saveLocalOrgs(orgs);
        return { success: true };
      }
    }
    throw new Error('Folder not found locally');
  }

  // --- Todo Helpers ---

  private async getLocalTodos(): Promise<any[]> {
    const data = await chrome.storage.local.get('local_todos');
    return data.local_todos || [];
  }

  private async setLocalTodos(todos: any[]): Promise<void> {
    await chrome.storage.local.set({ local_todos: todos });
    window.dispatchEvent(new CustomEvent('todosUpdated'));
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  }

  private async cleanupStaleCompletedTodos(): Promise<void> {
    const todos = await this.getLocalTodos();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const keptTodos = todos.filter(t => {
      // 1. Self-healing purge for corrupted duplicates from the old bug
      if (t.todo_id && String(t.snippet_id) === String(t.todo_id) && String(t.todo_id).startsWith('local-')) {
        return false;
      }

      // 2. Standard next-day purge
      if (!t.is_done) return true; // Keep all pending
      const updatedAtStr = t.updated_at || t.event_deadline;
      if (!updatedAtStr) return false;
      const completedDate = new Date(updatedAtStr.replace(' ', 'T'));
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    });

    if (keptTodos.length !== todos.length) {
      await this.setLocalTodos(keptTodos);
    }
  }

  // --- Todo Reads ---

  async getUpcomingTodos(): Promise<any> {
    await this.cleanupStaleCompletedTodos();
    const todos = await this.getLocalTodos();
    const now = new Date();
    return {
      todos: todos.filter(t => {
        if (t.is_done) return false;
        const d = new Date((t.event_deadline || '').replace(' ', 'T'));
        return isNaN(d.getTime()) || d.getTime() >= now.getTime() || this.isSameDay(d, now) || t.is_anytime;
      }),
    };
  }

  async getOverdueTodos(): Promise<any> {
    await this.cleanupStaleCompletedTodos();
    const todos = await this.getLocalTodos();
    const now = new Date();
    return {
      todos: todos.filter(t => {
        if (t.is_done) return false;
        if (t.is_anytime) return false;
        const d = new Date((t.event_deadline || '').replace(' ', 'T'));
        return !isNaN(d.getTime()) && d.getTime() < now.getTime() && !this.isSameDay(d, now);
      }),
    };
  }

  async getTodosByDate(date: string, includeCompleted: boolean): Promise<any> {
    await this.cleanupStaleCompletedTodos();
    const todos = await this.getLocalTodos();
    const target = new Date(date);
    return {
      todos: todos.filter(t => {
        if (!includeCompleted && t.is_done) return false;
        const d = new Date((t.event_deadline || '').replace(' ', 'T'));
        return !isNaN(d.getTime()) && this.isSameDay(d, target);
      }),
    };
  }

  async getRecurringTodos(date?: string | undefined): Promise<any> {
    await this.cleanupStaleCompletedTodos();
    const todos = await this.getLocalTodos();
    return {
      todos: todos.filter(t => (t.is_recurring || t.recurring) && !t.is_done),
    };
  }

  // --- Todo Writes ---

  async convertSnippetToTodo(payload: any): Promise<any> {
    const todos = await this.getLocalTodos();
    const newTodoId = `local-${crypto.randomUUID()}`;

    // Respect the snippet_id passed in from the payload, or generate one if missing
    const targetSnippetId =
      payload.snippet_id ||
      payload.id ||
      payload.automation_id ||
      payload.command_id ||
      payload.installed_module_id ||
      newTodoId;

    // Find any existing record with the same snippet_id.
    // Prefer to match an optimistic record (no todo_id or todo_id === targetSnippetId),
    // but fall back to any existing record to avoid duplicates.
    let existingIndex = todos.findIndex(
      t =>
        String(t.snippet_id) === String(targetSnippetId) &&
        (!t.todo_id || String(t.todo_id) === String(targetSnippetId)),
    );
    // If no optimistic match found, check for any existing todo with the same snippet_id
    // to prevent creating a second entry for the same resource.
    if (existingIndex === -1) {
      existingIndex = todos.findIndex(
        t => String(t.snippet_id) === String(targetSnippetId),
      );
    }

    const newTodo = {
      ...payload,
      snippet_id: targetSnippetId,
      todo_id: newTodoId,
      id: newTodoId,
      is_todo_type: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      // Upsert: merge with existing record
      const existing = todos[existingIndex];
      todos[existingIndex] = {
        ...existing,
        ...newTodo,
        // Preserve an existing proper todo_id (a real local UUID that isn't just the snippet_id)
        todo_id:
          existing.todo_id &&
          String(existing.todo_id).startsWith('local-') &&
          existing.todo_id !== existing.snippet_id
            ? existing.todo_id
            : newTodo.todo_id,
        updated_at: new Date().toISOString(),
      };
    } else {
      todos.push(newTodo);
    }

    // Deduplicate by snippet_id before saving (keep the entry with a proper todo_id if duplicates exist)
    const deduped = Array.from(
      todos.reduce((map, t) => {
        const key = String(t.snippet_id);
        if (!map.has(key)) {
          map.set(key, t);
        } else {
          const prev = map.get(key);
          // Prefer the entry with a proper local todo_id over one without
          if (t.todo_id && String(t.todo_id).startsWith('local-') && t.todo_id !== t.snippet_id) {
            if (!prev.todo_id || prev.todo_id === prev.snippet_id) {
              map.set(key, t);
            }
          }
        }
        return map;
      }, new Map<string, any>()).values()
    );

    await this.setLocalTodos(deduped);

    const resultTodo = deduped.find((t: any) => String(t.snippet_id) === String(targetSnippetId)) || newTodo;

    const chromeAny = (window as any).chrome;
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({
        action: 'schedule_todo_alarm',
        todoId: targetSnippetId,
        deadline: payload.event_deadline,
        is_anytime: payload.is_anytime,
      });
    }
    return resultTodo;
  }

  async convertToTodoWithConfig(payload: any): Promise<any> {
    return this.convertSnippetToTodo(payload);
  }

  async editTodo(payload: any): Promise<any> {
    const todos = await this.getLocalTodos();
    const targetId = String(payload.todo_id || payload.snippet_id || payload.id);
    let found = false;

    const updatedTodos = todos.map(t => {
      // Prioritize todo_id. Only fallback to snippet_id if the todo doesn't have a todo_id yet.
      const isMatch =
        String(t.todo_id) === targetId ||
        (String(t.snippet_id) === targetId && (!t.todo_id || String(t.todo_id) === targetId));
      if (isMatch) {
        found = true;
        return {
          ...t,
          ...payload,
          updated_at: new Date().toISOString(),
        };
      }
      return t;
    });

    if (found) {
      await this.setLocalTodos(updatedTodos);
      const chromeAny = (window as any).chrome;
      if (chromeAny?.runtime?.sendMessage && payload.event_deadline) {
        chromeAny.runtime.sendMessage({
          action: 'schedule_todo_alarm',
          todoId: targetId,
          deadline: payload.event_deadline,
          is_anytime: payload.is_anytime,
        });
      }
    }
    return { success: found };
  }

  async modifyTodo(payload: any): Promise<any> {
    return this.editTodo(payload);
  }

  async updateTodoStatus(snippetId: string, isDone: boolean): Promise<any> {
    const todos = await this.getLocalTodos();
    const targetId = String(snippetId);
    let found = false;

    const updatedTodos = todos.map(t => {
      const isMatch =
        String(t.todo_id) === targetId ||
        (String(t.snippet_id) === targetId && (!t.todo_id || String(t.todo_id) === targetId));
      if (isMatch) {
        found = true;
        return {
          ...t,
          is_done: isDone,
          updated_at: new Date().toISOString(),
        };
      }
      return t;
    });

    if (found) {
      await this.setLocalTodos(updatedTodos);
      const chromeAny = (window as any).chrome;
      if (chromeAny?.runtime?.sendMessage && isDone) {
        chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: targetId });
      }
    }
    return { success: found };
  }

  async deleteTodo(todoId: string | number): Promise<any> {
    const todos = await this.getLocalTodos();
    const targetId = String(todoId);

    const initialLength = todos.length;
    const updatedTodos = todos.filter(t => {
      const isMatch =
        String(t.todo_id) === targetId ||
        (String(t.snippet_id) === targetId && (!t.todo_id || String(t.todo_id) === targetId));
      return !isMatch;
    });

    if (updatedTodos.length !== initialLength) {
      await this.setLocalTodos(updatedTodos);
      const chromeAny = (window as any).chrome;
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: targetId });
      }
    }
    return { success: true };
  }

  async fetchSavedAutomations(userId: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const automations: any[] = [];
    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_automations) {
          automations.push(...ws.workspace_automations);
        }
        for (const folder of ws.folders) {
          if (folder.automations) {
            automations.push(...folder.automations);
          }
        }
      }
    }
    return automations;
  }

  async fetchAutomationContents(userId: string, automationId: string): Promise<any> {
    const automations = await this.fetchSavedAutomations(userId);
    const automation = automations.find((a: any) => String(a.id) === String(automationId));
    if (!automation) throw new Error(`Local automation ${automationId} not found`);
    return automation;
  }

  async createAutomation(userId: string, payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const newAutomation = {
      ...payload,
      id: `local-auto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_id: userId,
      is_local: true,
      automation_steps: payload.steps || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let targetWs = null;
    let targetFolder = null;
    let orgFound = false;

    for (const org of orgs) {
      if (payload.org_id && String(org.team_id) !== String(payload.org_id)) continue;

      targetWs = org.workspaces.find(w => w.workspace_id === payload.workspace_id);
      if (targetWs) {
        orgFound = true;
        if (payload.folder_id) {
          targetFolder = targetWs.folders.find(f => f.folder_id === payload.folder_id);
        }
        break;
      }
    }

    if (!orgFound || !targetWs) {
      throw new Error('Workspace not found locally for automation creation');
    }

    if (targetFolder) {
      if (!targetFolder.automations) targetFolder.automations = [];
      targetFolder.automations.push(newAutomation);
    } else {
      if (!targetWs.workspace_automations) targetWs.workspace_automations = [];
      targetWs.workspace_automations.push(newAutomation);
    }

    await this.saveLocalOrgs(orgs);
    return newAutomation;
  }

  async updateAutomation(userId: string, payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const targetId = String(payload.automation_id || payload.id);

    let foundAutomation = false;
    let oldLocation = { orgIndex: -1, wsIndex: -1, folderIndex: -1, aIndex: -1 };
    let updatedAutomation = null;

    for (let o = 0; o < orgs.length; o++) {
      for (let w = 0; w < orgs[o].workspaces.length; w++) {
        const ws = orgs[o].workspaces[w];
        if (ws.workspace_automations) {
          const aIndex = ws.workspace_automations.findIndex((a: any) => String(a.id) === targetId);
          if (aIndex !== -1) {
            oldLocation = { orgIndex: o, wsIndex: w, folderIndex: -1, aIndex };
            updatedAutomation = {
              ...ws.workspace_automations[aIndex],
              ...payload,
              automation_steps: payload.steps || ws.workspace_automations[aIndex].automation_steps || [],
              updated_at: new Date().toISOString(),
            };
            foundAutomation = true;
            break;
          }
        }
        for (let f = 0; f < ws.folders.length; f++) {
          if (ws.folders[f].automations) {
            const aIndex = ws.folders[f].automations.findIndex((a: any) => String(a.id) === targetId);
            if (aIndex !== -1) {
              oldLocation = { orgIndex: o, wsIndex: w, folderIndex: f, aIndex };
              updatedAutomation = {
                ...ws.folders[f].automations[aIndex],
                ...payload,
                automation_steps: payload.steps || ws.folders[f].automations[aIndex].automation_steps || [],
                updated_at: new Date().toISOString(),
              };
              foundAutomation = true;
              break;
            }
          }
        }
        if (foundAutomation) break;
      }
      if (foundAutomation) break;
    }

    if (!foundAutomation || !updatedAutomation) {
      throw new Error(`Local automation ${targetId} not found for update`);
    }

    const targetWorkspaceId = payload.workspace_id || updatedAutomation.workspace_id;
    const targetFolderId = payload.folder_id !== undefined ? payload.folder_id : updatedAutomation.folder_id;
    let moved = false;

    const oldOrg = orgs[oldLocation.orgIndex];
    const oldWs = oldOrg.workspaces[oldLocation.wsIndex];
    const oldFolder = oldLocation.folderIndex !== -1 ? oldWs.folders[oldLocation.folderIndex] : null;

    if (oldWs.workspace_id !== targetWorkspaceId || (oldFolder?.folder_id || null) !== (targetFolderId || null)) {
      // Find new location
      for (const org of orgs) {
        if (payload.org_id && String(org.team_id) !== String(payload.org_id)) continue;
        const newWs = org.workspaces.find((w: any) => w.workspace_id === targetWorkspaceId);
        if (newWs) {
          // Delete from old location
          if (oldLocation.folderIndex !== -1) {
            oldWs.folders[oldLocation.folderIndex].automations.splice(oldLocation.aIndex, 1);
          } else {
            oldWs.workspace_automations.splice(oldLocation.aIndex, 1);
          }

          updatedAutomation.workspace_id = targetWorkspaceId;
          updatedAutomation.folder_id = targetFolderId || null;

          if (targetFolderId) {
            const newFolder = newWs.folders.find((f: any) => f.folder_id === targetFolderId);
            if (newFolder) {
              if (!newFolder.automations) newFolder.automations = [];
              newFolder.automations.push(updatedAutomation);
              moved = true;
            }
          } else {
            if (!newWs.workspace_automations) newWs.workspace_automations = [];
            newWs.workspace_automations.push(updatedAutomation);
            moved = true;
          }
          break;
        }
      }

      if (!moved) {
        if (oldLocation.folderIndex !== -1) {
          oldWs.folders[oldLocation.folderIndex].automations[oldLocation.aIndex] = updatedAutomation;
        } else {
          oldWs.workspace_automations[oldLocation.aIndex] = updatedAutomation;
        }
      }
    } else {
      if (oldLocation.folderIndex !== -1) {
        oldWs.folders[oldLocation.folderIndex].automations[oldLocation.aIndex] = updatedAutomation;
      } else {
        oldWs.workspace_automations[oldLocation.aIndex] = updatedAutomation;
      }
    }

    await this.saveLocalOrgs(orgs);
    return updatedAutomation;
  }

  async deleteAutomation(userId: string, automationIdOrIds: string | string[]): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const idsToDelete = Array.isArray(automationIdOrIds) ? automationIdOrIds.map(String) : [String(automationIdOrIds)];

    let anyDeleted = false;

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_automations) {
          const initialLen = ws.workspace_automations.length;
          ws.workspace_automations = ws.workspace_automations.filter(a => !idsToDelete.includes(String(a.id)));
          if (ws.workspace_automations.length !== initialLen) anyDeleted = true;
        }
        for (const folder of ws.folders) {
          if (folder.automations) {
            const initialLen = folder.automations.length;
            folder.automations = folder.automations.filter(a => !idsToDelete.includes(String(a.id)));
            if (folder.automations.length !== initialLen) anyDeleted = true;
          }
        }
      }
    }

    if (anyDeleted) {
      await this.saveLocalOrgs(orgs);

      // Also clear any scheduled alarms for these automations
      const chromeAny = (window as any).chrome;
      if (chromeAny?.alarms?.clear) {
        for (const id of idsToDelete) {
          chromeAny.alarms.clear(`automation_${id}`);
        }
      }
    }
    return { success: true };
  }

  async updateInputOverride(userId: string, moduleId: number, config: any): Promise<any> {
    // Local provider does not currently support cloud module overrides, return mock success
    return { success: true };
  }

  async createLegacyAutomation(userId: string, data: any): Promise<any> {
    return this.createAutomation(userId, data);
  }

  async updateLegacyAutomation(userId: string, data: any): Promise<any> {
    return this.updateAutomation(userId, data);
  }

  async deleteLegacyAutomation(userId: string, id: number): Promise<any> {
    return this.deleteAutomation(userId, String(id));
  }

  async getFavorites(userId: string): Promise<any> {
    const result = await chrome.storage.local.get('myFavouriteItems');
    const favItems = result.myFavouriteItems || {};
    const currentFavList = favItems[userId] || [];

    return currentFavList.map((snippet: any) => ({
      favourite_id: snippet.favourite_id || Date.now(),
      user_id: userId,
      snippet_id: snippet.id || snippet.snippet_id,
      created_at: snippet.created_at || new Date().toISOString(),
      updated_at: snippet.updated_at || new Date().toISOString(),
      command_id: null,
    }));
  }

  async addFavorite(payload: { user_id: string; snippet_id?: string; command_id?: string }): Promise<any> {
    const { user_id, snippet_id, command_id } = payload;
    const targetId = snippet_id || command_id;
    if (!targetId) throw new Error('No target ID provided');

    // Find the target item in local orgs
    const orgs = await this.getLocalOrgs();
    let targetItem: any = null;
    for (const org of orgs) {
      for (const ws of org.workspaces || []) {
        if (ws.workspace_snippets) {
          const match = ws.workspace_snippets.find(
            (s: any) => String(s.id) === String(targetId) || String(s.snippet_id) === String(targetId),
          );
          if (match) targetItem = match;
        }
        for (const folder of ws.folders || []) {
          if (folder.snippets) {
            const match = folder.snippets.find(
              (s: any) => String(s.id) === String(targetId) || String(s.snippet_id) === String(targetId),
            );
            if (match) targetItem = match;
          }
        }
      }
    }

    if (!targetItem) {
      targetItem = { id: targetId, snippet_id: targetId, key: 'Unknown Item' };
    }

    const favourite_id = Date.now();
    targetItem = { ...targetItem, favourite_id, is_local: true };

    const result = await chrome.storage.local.get('myFavouriteItems');
    const favItems = result.myFavouriteItems || {};
    const currentFavList = favItems[user_id] || [];

    const existingIndex = currentFavList.findIndex((fav: any) => {
      const favId = fav.id || fav.snippet_id;
      return String(favId) === String(targetId);
    });

    if (existingIndex === -1) {
      currentFavList.unshift(targetItem);
      favItems[user_id] = currentFavList;
      await chrome.storage.local.set({ myFavouriteItems: favItems });
    }

    return {
      favourite_id,
      user_id,
      snippet_id: targetId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      command_id: null,
    };
  }

  async deleteFavorite(userId: string, favoriteId: number): Promise<any> {
    const result = await chrome.storage.local.get('myFavouriteItems');
    const favItems = result.myFavouriteItems || {};
    const currentFavList = favItems[userId] || [];

    // Filter out the favorite
    const updatedFavList = currentFavList.filter((fav: any) => fav.favourite_id !== favoriteId);
    favItems[userId] = updatedFavList;

    await chrome.storage.local.set({ myFavouriteItems: favItems });
    return true;
  }

  async fetchUserCommands(userId: string): Promise<any> {
    const result = await chrome.storage.local.get('alts_commands');
    const cmds = result.alts_commands || [];

    // Convert CommandDefinition back to UserInstalledCommand API format
    // Only return commands that were "API commands" (e.g. core ones, not browser or module ones)
    const apiCommands = cmds.filter((cmd: any) => cmd.category === 'core' || cmd.category === 'search');

    const data = apiCommands.map((cmd: any, index: number) => ({
      command_id: cmd.id,
      installation_id: cmd.installation_id || Date.now() + index,
      prefix: cmd.prefix,
      keywords: cmd.keywords || [],
      hotkey: cmd.hotkey || '',
      is_active: true,
      is_local: true,
      command: {
        id: cmd.id,
        label: cmd.label,
        url_template: cmd.urlTemplate || cmd.url_template,
        icon_host: cmd.iconHost || cmd.icon_host,
        category: cmd.category,
        auto_submit: cmd.autoSubmit || cmd.auto_submit,
      },
    }));

    return { data };
  }

  async updateUserCommand(installationId: number, payload: any): Promise<any> {
    const result = await chrome.storage.local.get('alts_commands');
    let commands = result.alts_commands || [];

    let updated: any = null;
    commands = commands.map((cmd: any) => {
      // If installation_id is missing on the client side definition, match by logic if needed.
      // We will assume matching by a generated ID or by the fact that the client passed it.
      // For safety, match by command_id if installationId is not reliable
      if (cmd.installation_id === installationId || cmd.id === String(installationId)) {
        updated = { ...cmd, ...payload, is_local: true, updated_at: new Date().toISOString() };
        return updated;
      }
      return cmd;
    });

    if (updated) {
      await chrome.storage.local.set({ alts_commands: commands });
      return { data: { ...updated, command: updated } };
    }
    throw new Error('Command not found');
  }

  async updateCommandHotkey(installationId: number, payload: { hotkey: string }): Promise<any> {
    const result = await chrome.storage.local.get('alts_commands');
    let commands = result.alts_commands || [];

    let found = false;
    commands = commands.map((cmd: any) => {
      if (cmd.installation_id === installationId || cmd.id === String(installationId)) {
        found = true;
        return { ...cmd, hotkey: payload.hotkey, is_local: true, updated_at: new Date().toISOString() };
      }
      return cmd;
    });

    if (found) {
      await chrome.storage.local.set({ alts_commands: commands });
      return { success: true };
    }
    throw new Error('Command not found');
  }

  async fetchUserLocalCommandCustomizations(userId: string): Promise<any> {
    const result = await chrome.storage.local.get('alts_local_command_customizations');
    const record = result.alts_local_command_customizations || {};

    // API returns array
    const data = Object.values(record).map((item: any) => ({
      ...item,
      is_local: true,
    }));
    return { data };
  }

  async upsertUserLocalCommand(payload: any): Promise<any> {
    const result = await chrome.storage.local.get('alts_local_command_customizations');
    const record = result.alts_local_command_customizations || {};

    const cmdId = payload.command_id;
    const existing = record[cmdId] || {};

    const updated = {
      ...existing,
      ...payload,
      id: existing.id || Date.now(),
      is_local: true,
      updated_at: new Date().toISOString(),
      created_at: existing.created_at || new Date().toISOString(),
    };

    record[cmdId] = updated;
    await chrome.storage.local.set({ alts_local_command_customizations: record });
    return updated;
  }

  async deleteUserLocalCommand(id: number): Promise<any> {
    const result = await chrome.storage.local.get('alts_local_command_customizations');
    const record = result.alts_local_command_customizations || {};

    for (const key of Object.keys(record)) {
      if (record[key].id === id) {
        delete record[key];
        break;
      }
    }

    await chrome.storage.local.set({ alts_local_command_customizations: record });
    return true;
  }

  async getOrgTags(userId: string, orgId: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find((o: any) => String(o.team_id) === String(orgId));
    if (!org) return [];

    const tagsMap = new Map<string, any>();

    // Add explicitly created org tags
    if (org.tags) {
      for (const t of org.tags) {
        tagsMap.set(t.name.toLowerCase(), t);
      }
    }

    // Dynamically extract from all snippets
    for (const ws of org.workspaces) {
      if (ws.workspace_snippets) {
        for (const s of ws.workspace_snippets) {
          if (s.tags) {
            for (const t of s.tags) {
              tagsMap.set(t.name.toLowerCase(), t);
            }
          }
        }
      }
      for (const f of ws.folders) {
        if (f.snippets) {
          for (const s of f.snippets) {
            if (s.tags) {
              for (const t of s.tags) {
                tagsMap.set(t.name.toLowerCase(), t);
              }
            }
          }
        }
      }
    }

    return Array.from(tagsMap.values());
  }

  async createTagInOrg(userId: string, orgId: string, name: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    const org = orgs.find((o: any) => String(o.team_id) === String(orgId));
    if (!org) throw new Error('Org not found');

    const newTag = {
      tag_id: `tag_${crypto.randomUUID()}`,
      name: name,
    };

    if (!org.tags) org.tags = [];

    const existing = org.tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    org.tags.push(newTag);
    await this.saveLocalOrgs(orgs);
    return newTag;
  }

  async fetchStore(): Promise<any> {
    return [];
  }
  async fetchModuleById(userId: string, id: number): Promise<any> {
    return null;
  }
  async installStoreModule(moduleId: string | number, payload: any): Promise<any> {
    return null;
  }

  async installModule(userId: string, moduleId: string, options?: any): Promise<any> {
    const result = await chrome.storage.local.get('installed_modules');
    const installed = result.installed_modules || [];

    const existing = installed.find((m: any) => String(m.module_id) === String(moduleId));
    if (existing) return existing;

    const catalog = await this.getModuleCatalog();
    const moduleInfo = catalog.find(
      (m: any) => String(m.id) === String(moduleId) || String(m.module_id) === String(moduleId),
    );

    if (!moduleInfo) throw new Error('Module not found in catalog');

    const newInstall = {
      id: Date.now(),
      module_id: moduleId,
      user_id: userId,
      installed_at: new Date().toISOString(),
      hotkey: options?.hotkey || null,
      is_favourite: options?.is_favourite || false,
      is_local: true,
      module: moduleInfo,
    };

    installed.push(newInstall);
    await chrome.storage.local.set({ installed_modules: installed });

    return newInstall;
  }

  async getInstallations(userId: string): Promise<any> {
    return [];
  }
  async updateStoreInstallation(moduleId: string | number, installationId: number, payload: any): Promise<any> {
    return null;
  }
  async updateModuleInstallation(userId: string, moduleId: string, installationId: number, payload: any): Promise<any> {
    return null;
  }
  async uninstallStoreModule(moduleId: string | number, installationId: number): Promise<any> {
    return null;
  }

  async uninstallModule(userId: string, moduleId: string): Promise<any> {
    const result = await chrome.storage.local.get('installed_modules');
    let installed = result.installed_modules || [];
    // Optionally only remove if is_local, but we'll trust the caller
    installed = installed.filter((m: any) => String(m.module_id) !== String(moduleId));
    await chrome.storage.local.set({ installed_modules: installed });
    return { success: true };
  }

  async getModuleCatalog(): Promise<any> {
    try {
      const url = `${SUPABASE_BASE_URL}/functions/v1/automation_agents/modules/catalog`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return json;
    } catch (e) {
      console.error('LocalProvider - getModuleCatalog error:', e);
      return [];
    }
  }

  async updateModuleCustomization(
    userId: string,
    moduleId: string,
    payload: { hotkey?: string | null | undefined; is_favourite?: boolean | undefined },
  ): Promise<any> {
    const result = await chrome.storage.local.get('installed_modules');
    const installed = result.installed_modules || [];

    const target = installed.find((m: any) => String(m.module_id) === String(moduleId));
    if (target) {
      if (payload.hotkey !== undefined) target.hotkey = payload.hotkey;
      if (payload.is_favourite !== undefined) target.is_favourite = payload.is_favourite;

      await chrome.storage.local.set({ installed_modules: installed });
      return target;
    }
    return null;
  }

  async getInstalledModules(userId: string): Promise<any> {
    const result = await chrome.storage.local.get('installed_modules');
    const installed = result.installed_modules || [];
    return installed.filter((m: any) => m.is_local);
  }

  async getFavoritedModules(userId: string): Promise<any> {
    const result = await chrome.storage.local.get('installed_modules');
    const installed = result.installed_modules || [];
    return installed.filter((m: any) => m.is_local && m.is_favourite);
  }

  async updateSnippetShortcut(userId: string, snippetId: string, shortcut: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    let found = false;

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_snippets) {
          const s = ws.workspace_snippets.find(s => s.id === snippetId || s.snippet_id === snippetId);
          if (s) {
            s.shortcuts = updateUserShortcut(s.shortcuts, userId, shortcut);
            found = true;
            break;
          }
        }
        for (const folder of ws.folders) {
          if (folder.snippets) {
            const s = folder.snippets.find(s => s.id === snippetId || s.snippet_id === snippetId);
            if (s) {
              s.shortcuts = updateUserShortcut(s.shortcuts, userId, shortcut);
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    if (found) await this.saveLocalOrgs(orgs);
    return { success: true, snippet_id: snippetId, shortcuts: shortcut };
  }

  async clearSnippetShortcut(userId: string, snippetId: string): Promise<any> {
    return this.updateSnippetShortcut(userId, snippetId, '');
  }
  async updateSnippetHotkey(userId: string, snippetId: string, hotkey: string): Promise<any> {
    const orgs = await this.getLocalOrgs();
    let found = false;

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_snippets) {
          const s = ws.workspace_snippets.find(s => s.id === snippetId || s.snippet_id === snippetId);
          if (s) {
            s.hotkeys = updateUserHotkey(s.hotkeys, userId, hotkey);
            found = true;
            break;
          }
        }
        for (const folder of ws.folders) {
          if (folder.snippets) {
            const s = folder.snippets.find(s => s.id === snippetId || s.snippet_id === snippetId);
            if (s) {
              s.hotkeys = updateUserHotkey(s.hotkeys, userId, hotkey);
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    if (found) await this.saveLocalOrgs(orgs);
    return { success: found };
  }

  async clearSnippetHotkey(userId: string, snippetId: string): Promise<any> {
    return this.updateSnippetHotkey(userId, snippetId, '');
  }

  async updateSnippetCustomization(
    userId: string,
    snippetId: string,
    payload: { icon?: string | null | undefined; color?: string | null | undefined },
  ): Promise<any> {
    const orgs = await this.getLocalOrgs();
    let foundSnippet: any = null;

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_snippets) {
          foundSnippet = ws.workspace_snippets.find(s => s.id === snippetId || s.snippet_id === snippetId);
          if (foundSnippet) break;
        }
        for (const folder of ws.folders) {
          if (folder.snippets) {
            foundSnippet = folder.snippets.find(s => s.id === snippetId || s.snippet_id === snippetId);
            if (foundSnippet) break;
          }
        }
        if (foundSnippet) break;
      }
      if (foundSnippet) break;
    }

    if (foundSnippet) {
      if (payload.icon !== undefined) foundSnippet.icon = payload.icon;
      if (payload.color !== undefined) foundSnippet.color = payload.color;
      await this.saveLocalOrgs(orgs);
      return foundSnippet;
    }

    return null;
  }

  // --- Folder Members ---
  async getFolderMembers(userId: string, folder_id: string): Promise<any> {
    return []; // Local folders don't have members
  }

  async addOrUpdateFolderMember(userId: string, folder_id: string, target_user_id: string, role: string): Promise<any> {
    return { success: true };
  }

  async changeFolderAccess(userId: string, folder_id: string, target_user_id: string, new_role: string): Promise<any> {
    return { success: true };
  }

  async removeFolderMember(userId: string, folder_id: string, target_user_id: string): Promise<any> {
    return { success: true };
  }

  // --- Snippet Sharing & Ordering ---
  async createShareLinkForSnippet(userId: string, snippet_id: string): Promise<any> {
    throw new Error('Local snippets cannot be shared via public links.');
  }

  async createSequreShareLinkForSnippet(userId: string, snippet_id: string, pass_key: string): Promise<any> {
    throw new Error('Local snippets cannot be shared via public links.');
  }

  async fetchPublicLinksForSnippet(userId: string, snippet_id: string): Promise<any> {
    return [];
  }

  async revokePublicLink(userId: string, link_id: string): Promise<any> {
    return { success: true };
  }

  async saveSnippetsOrder(userId: string, payload: any): Promise<any> {
    const orgs = await this.getLocalOrgs();
    if (!payload?.snippet_orders || !Array.isArray(payload.snippet_orders)) return { success: false };

    const orderMap = new Map();
    payload.snippet_orders.forEach((item: any) => {
      orderMap.set(String(item.snippet_id), item.order);
    });

    const sortFn = (a: any, b: any) => {
      const aId = String(a.id || a.snippet_id);
      const bId = String(b.id || b.snippet_id);
      const aOrder = orderMap.has(aId) ? orderMap.get(aId) : Infinity;
      const bOrder = orderMap.has(bId) ? orderMap.get(bId) : Infinity;
      return aOrder - bOrder;
    };

    for (const org of orgs) {
      for (const ws of org.workspaces) {
        if (ws.workspace_snippets) {
          ws.workspace_snippets.sort(sortFn);
        }
        for (const folder of ws.folders) {
          if (folder.snippets) {
            folder.snippets.sort(sortFn);
          }
        }
      }
    }
    await this.saveLocalOrgs(orgs);
    return { success: true };
  }

  // --- Workspace & Org Membership & Invitations ---
  async getWorkspaceDetails(workspaceId: string): Promise<any> {
    return { success: true, workspace_id: workspaceId, members: [] };
  }

  async removeMemberFromWorkspace(userId: string, workspaceId: string): Promise<any> {
    return { success: true };
  }

  async getMembersInOrganization(orgId: string): Promise<any> {
    return [];
  }

  async addMemberToWorkspace(userId: string, workspaceId: string, role: string): Promise<any> {
    return { success: true };
  }

  async changeMemberAccess(userId: string, workspaceId: string, role: string): Promise<any> {
    return { success: true };
  }

  async inviteMemberIntoOrganization(orgId: string, email: string): Promise<any> {
    return { success: true };
  }
}
