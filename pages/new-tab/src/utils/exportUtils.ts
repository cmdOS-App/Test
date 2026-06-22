import * as XLSX from 'xlsx';
import type { Team, Workspace, Folder, Snippet, SavedAutomation } from '../../../modals/interfaces';

// Excel row data types
export interface ExcelRow {
  CreationDate: string;
  Title: string;
  Content: string;
  FolderPath: string;
  Owner: string;
}

// Type for snippet value (can be string or TabGroup object)
interface TabGroupValue {
  names?: string[];
  urls?: string[];
}

/**
 * Strip HTML tags from content for cleaner Excel output
 */
const stripHtml = (html: string): string => {
  if (!html) return '';
  // Use regex to strip HTML for utility (avoids DOM requirement if run in different contexts)
  return html.replace(/<[^>]*>?/gm, '');
};

/**
 * Format date for Excel
 */
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

/**
 * Get owner name from snippet
 */
const getOwnerName = (snippet: Snippet): string => {
  const firstName = (snippet as any).first_name || '';
  const lastName = (snippet as any).last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown';
};

/**
 * Extract content from snippet value based on category
 */
const extractContent = (snippet: Snippet): string => {
  const value = snippet.value;
  const category = (snippet.category || '').toLowerCase();

  if (typeof value === 'string') {
    // For links, return the URL directly
    if (category === 'link' || category === 'biolink' || category === 'quicklink') {
      return value;
    }
    // For notes/prompts, strip HTML
    return stripHtml(value);
  }

  // For TabGroup (multiple URLs)
  if (typeof value === 'object' && value !== null) {
    const tabGroup = value as TabGroupValue;
    if (tabGroup.urls) {
      // Format as "Name: URL" pairs
      return tabGroup.urls
        .map((url, i) => {
          const name = tabGroup.names?.[i] || 'Untitled';
          return `${name}: ${url}`;
        })
        .join('\n');
    }
  }

  return '';
};

/**
 * Determine if snippet is a link type
 */
const isLinkCategory = (category: string): boolean => {
  const lowerCat = (category || '').toLowerCase();
  return (
    lowerCat === 'link' ||
    lowerCat === 'biolink' ||
    lowerCat === 'quicklink' ||
    lowerCat === 'tabgroup' ||
    lowerCat === 'tab group' ||
    lowerCat === 'bulk_link'
  );
};

/**
 * Determine if snippet is a note type
 */
const isNoteCategory = (category: string): boolean => {
  const lowerCat = (category || '').toLowerCase();
  return lowerCat === 'snippet' || lowerCat === 'note' || lowerCat === '';
};

/**
 * Determine if an automation is an AI agent
 */
const isAiAutomation = (auto: SavedAutomation): boolean => {
  const steps = auto.automation_steps || (auto as any).steps || [];
  return steps.some(
    (s: any) => String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
  );
};

/**
 * Process snippets from a workspace and its folders recursively
 */
export const processWorkspacesData = (
  workspaces: Workspace[],
  teamName: string,
): {
  notes: ExcelRow[];
  links: ExcelRow[];
  automations: ExcelRow[];
  agents: ExcelRow[];
} => {
  const notes: ExcelRow[] = [];
  const links: ExcelRow[] = [];
  const automations: ExcelRow[] = [];
  const agents: ExcelRow[] = [];

  const addSnippet = (snippet: Snippet, workspaceName: string, folderPath: string) => {
    const row: ExcelRow = {
      CreationDate: formatDate(snippet.created_at || ''),
      Title: snippet.key || 'Untitled',
      Content: extractContent(snippet),
      FolderPath: `${teamName} > ${workspaceName}${folderPath ? ` > ${folderPath}` : ''}`,
      Owner: getOwnerName(snippet),
    };

    const category = snippet.category || '';

    if (isLinkCategory(category)) {
      links.push(row);
    } else if (isNoteCategory(category)) {
      notes.push(row);
    } else {
      // Legacy "prompt" category items without specialized structure
      // are lumped into Notes or ignored.
      // Given the user request, we omit specialized "Prompts" tab.
      if (category.toLowerCase() !== 'prompt') {
        notes.push(row);
      }
    }
  };

  const addAutomation = (auto: SavedAutomation, workspaceName: string, folderPath: string) => {
    const steps = auto.automation_steps || (auto as any).steps || [];
    const row: ExcelRow = {
      CreationDate: formatDate(auto.created_at || ''),
      Title: auto.name || 'Untitled',
      Content: JSON.stringify(steps),
      FolderPath: `${teamName} > ${workspaceName}${folderPath ? ` > ${folderPath}` : ''}`,
      Owner: 'You', // Automations are typically personal or team-owned
    };

    if (isAiAutomation(auto)) {
      agents.push(row);
    } else {
      automations.push(row);
    }
  };

  const traverseFolder = (folder: Folder, workspaceName: string, currentPath: string) => {
    const folderName = folder.folder_name || 'Unknown Folder';
    const newPath = currentPath ? `${currentPath} > ${folderName}` : folderName;

    // Process folder snippets
    if (Array.isArray(folder.snippets)) {
      folder.snippets.forEach((s: Snippet) => addSnippet(s, workspaceName, newPath));
    }

    // Process folder automations
    if (Array.isArray(folder.automations)) {
      folder.automations.forEach((a: SavedAutomation) => addAutomation(a, workspaceName, newPath));
    }

    // Recurse into subfolders
    if (Array.isArray(folder.folders)) {
      folder.folders.forEach((sub: Folder) => traverseFolder(sub, workspaceName, newPath));
    }
  };

  workspaces.forEach((workspace: Workspace) => {
    const workspaceName = workspace.workspace_name || 'Unknown Workspace';

    // Process workspace-level snippets
    const workspaceSnippets = (workspace as any).workspace_snippets || (workspace as any).snippets || [];
    if (Array.isArray(workspaceSnippets)) {
      workspaceSnippets.forEach((s: Snippet) => addSnippet(s, workspaceName, ''));
    }

    // Process workspace-level automations
    const workspaceAutomations = workspace.workspace_automations || [];
    if (Array.isArray(workspaceAutomations)) {
      workspaceAutomations.forEach((a: SavedAutomation) => addAutomation(a, workspaceName, ''));
    }

    // Process folders
    if (Array.isArray(workspace.folders)) {
      workspace.folders.forEach((folder: Folder) => traverseFolder(folder, workspaceName, ''));
    }
  });

  return { notes, links, automations, agents };
};

/**
 * Generate and download Excel file
 */
export const generateExcelFile = (
  notes: ExcelRow[],
  links: ExcelRow[],
  automations: ExcelRow[],
  agents: ExcelRow[],
  modules: ExcelRow[],
  filenamePrefix: string = 'cmdOS_Export',
): void => {
  const workbook = XLSX.utils.book_new();
  const headers = ['Creation Date', 'Title', 'Content (URL/Text)', 'Folder Path', 'Owner'];

  const createSheet = (data: ExcelRow[]) => {
    const sheetData = [
      headers,
      ...data.map(row => [row.CreationDate, row.Title, row.Content, row.FolderPath, row.Owner]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 60 }, { wch: 40 }, { wch: 20 }];

    return worksheet;
  };

  if (links.length > 0) XLSX.utils.book_append_sheet(workbook, createSheet(links), 'Links');
  if (notes.length > 0) XLSX.utils.book_append_sheet(workbook, createSheet(notes), 'Notes');
  if (automations.length > 0) XLSX.utils.book_append_sheet(workbook, createSheet(automations), 'Saved Automations');
  if (agents.length > 0) XLSX.utils.book_append_sheet(workbook, createSheet(agents), 'Chat Agents');
  if (modules.length > 0) XLSX.utils.book_append_sheet(workbook, createSheet(modules), 'Installed Modules');

  const date = new Date().toISOString().split('T')[0];
  const fileName = `${filenamePrefix}_${date}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};

/**
 * High-level function to export all data from all teams
 */
export const exportAllTeamsToExcel = async (teams: Team[]) => {
  let allNotes: ExcelRow[] = [];
  let allLinks: ExcelRow[] = [];
  let allAutomations: ExcelRow[] = [];
  let allAgents: ExcelRow[] = [];
  let allModules: ExcelRow[] = [];

  // 1. Fetch installed modules from local storage
  try {
    const result = await chrome.storage.local.get(['installed_modules']);
    const installed = result.installed_modules || [];
    if (Array.isArray(installed)) {
      allModules = installed.map((mod: any) => ({
        CreationDate: '', // Modules don't always have installation dates locally
        Title: mod.name || 'Untitled Module',
        Content: mod.description || '',
        FolderPath: 'Installed Modules',
        Owner: 'You',
      }));
    }
  } catch (e) {
    console.warn('[exportUtils] Failed to fetch installed modules:', e);
  }

  // 2. Process data from teams
  teams.forEach(team => {
    const { notes, links, automations, agents } = processWorkspacesData(
      team.workspaces || [],
      team.team_name || 'Organization',
    );
    allNotes = [...allNotes, ...notes];
    allLinks = [...allLinks, ...links];
    allAutomations = [...allAutomations, ...automations];
    allAgents = [...allAgents, ...agents];
  });

  generateExcelFile(allNotes, allLinks, allAutomations, allAgents, allModules, 'cmdOS_Export');
};
