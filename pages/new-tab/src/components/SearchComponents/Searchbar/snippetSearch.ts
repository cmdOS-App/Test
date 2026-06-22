import type { Folder, Snippet, Team, Workspace } from '../../../../../modals/interfaces';

const normalize = (value: string | null | undefined): string => {
  if (value == null) return '';
  if (typeof value !== 'string') return String(value).trim().toLowerCase();
  return value.trim().toLowerCase();
};

const splitIntoTokens = (value: string): string[] =>
  value
    .split(/[^a-z0-9]+/i)
    .map(part => part.trim())
    .filter(Boolean);

const collectTokens = (value: string): Set<string> => {
  const normalized = normalize(value);
  if (!normalized) return new Set();
  return new Set([normalized, ...splitIntoTokens(normalized)]);
};

export const parseValue = (
  snippet: Snippet,
): {
  valueText: string;
  urlList: string[];
} => {
  const raw = snippet.value;
  const urlList: string[] = [];
  const textParts: string[] = [];

  const addUrl = (url: string | null | undefined) => {
    const trimmed = normalize(url ?? '');
    if (trimmed) urlList.push(trimmed);
  };

  const handleString = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    textParts.push(trimmed.toLowerCase());
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray((parsed as any).urls)) {
          ((parsed as any).urls as string[]).forEach(addUrl);
        }
        if (typeof (parsed as any).note === 'string') {
          textParts.push(String((parsed as any).note).toLowerCase());
        }
      } else if (trimmed.startsWith('http')) {
        addUrl(trimmed);
      }
    } catch {
      if (trimmed.startsWith('http')) {
        addUrl(trimmed);
      }
    }
  };

  const handleObject = (value: any) => {
    if (!value) return;
    if (Array.isArray(value.urls)) {
      value.urls.forEach((url: string) => addUrl(url));
    }
    if (typeof value.note === 'string') {
      textParts.push(value.note.toLowerCase());
    }
    if (typeof value.summary === 'string') {
      textParts.push(value.summary.toLowerCase());
    }
  };

  if (typeof raw === 'string') {
    handleString(raw);
  } else if (typeof raw === 'object') {
    handleObject(raw);
  }

  return {
    valueText: textParts.join(' '),
    urlList,
  };
};

export interface SnippetIndexEntry {
  snippet: Snippet;
  workspace: Workspace;
  folder: Folder | null;
  keyText: string;
  category: string;
  urlText: string;
  searchableText: string;
  shortcutTokens: Set<string>;
  keywordTokens: Set<string>;
  updatedAt: number;
  isPersonal?: boolean;
  teamName?: string;
}

export type NoteCommandMap = {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
  };
};

export type LinkCommandMap = {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
    url?: string;
    urls?: string[];
    iconHost?: string | null;
    type?: 'link' | 'tabgroup';
  };
};

export const buildSnippetIndex = (
  team: Team | null | undefined,
  noteCommandsMap?: NoteCommandMap,
  linkCommandsMap?: LinkCommandMap,
  isPersonal?: boolean,
  teamName?: string,
): SnippetIndexEntry[] => {
  if (!team?.workspaces) return [];
  const entries: SnippetIndexEntry[] = [];

  team.workspaces.forEach(workspace => {
    const pushEntry = (snippet: Snippet, folder: Folder | null) => {
      const keyText = normalize(snippet.key);
      const { valueText, urlList } = parseValue(snippet);
      const urlText = urlList.join(' ');

      // Get command data for shortcuts and keywords
      const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
      const commandId = folder
        ? `${folder.folder_id}-${uniqueSnippetId}`
        : `${workspace.workspace_id}-${uniqueSnippetId}`;

      const category = normalize(snippet.category);
      const isNoteOrSnippet = category === 'note' || category === 'snippet' || category === 'prompt';
      const isLink =
        category === 'link' ||
        category === 'links' ||
        category === 'tabgroup' ||
        category === 'tab group' ||
        category === 'quicklink';

      const commandData = isNoteOrSnippet ? noteCommandsMap?.[commandId] || {} : linkCommandsMap?.[commandId] || {};

      // Collect shortcut tokens (without leading "/")
      const shortcutTokens = new Set<string>();
      if (commandData.shortcut) {
        const shortcutWithoutSlash = commandData.shortcut.replace(/^\/+/, '').toLowerCase();
        collectTokens(shortcutWithoutSlash).forEach(token => shortcutTokens.add(token));
        shortcutTokens.add(shortcutWithoutSlash);
      }

      // Collect keyword tokens
      const keywordTokens = new Set<string>();
      if (commandData.keywords && Array.isArray(commandData.keywords)) {
        commandData.keywords.forEach(keyword => {
          const normalizedKeyword = normalize(keyword);
          if (normalizedKeyword) {
            collectTokens(normalizedKeyword).forEach(token => keywordTokens.add(token));
            keywordTokens.add(normalizedKeyword);
          }
        });
      }

      // Include shortcuts and keywords in searchable text
      const shortcutText = commandData.shortcut ? commandData.shortcut.replace(/^\/+/, '') : '';
      const keywordsText = commandData.keywords ? commandData.keywords.join(' ') : '';
      const searchableText = [keyText, valueText, urlText, shortcutText, keywordsText].filter(Boolean).join(' ');
      const updatedAt = new Date(snippet.updated_at || snippet.created_at || 0).getTime();

      entries.push({
        snippet,
        workspace,
        folder,
        keyText,
        category,
        urlText,
        searchableText,
        shortcutTokens,
        keywordTokens,
        updatedAt,
        isPersonal,
        teamName,
      });
    };

    (workspace.workspace_snippets || []).forEach(snippet => pushEntry(snippet, null));

    // Recursively collect snippets from folders and sub-folders
    const collectFromFolder = (folder: Folder) => {
      (folder.snippets || []).forEach(snippet => pushEntry(snippet, folder));
      if (folder.folders && folder.folders.length > 0) {
        folder.folders.forEach(subFolder => {
          collectFromFolder(subFolder);
        });
      }
    };

    (workspace.folders || []).forEach(folder => {
      collectFromFolder(folder);
    });
  });

  return entries;
};

export interface SnippetSearchOptions {
  allowedCategories?: Set<string>;
  limit?: number;
  minScore?: number;
  onlyShortcuts?: boolean;
}

export interface SnippetSearchResult {
  entry: SnippetIndexEntry;
  score: number;
}

export const scoreSnippetEntry = (
  entry: SnippetIndexEntry,
  queryTokens: string[],
  fullQuery: string,
  onlyShortcuts: boolean = false,
): number => {
  if (!queryTokens.length) return 0;
  let score = 0;

  const { keyText, urlText, searchableText, shortcutTokens, keywordTokens } = entry;

  // Convert Sets to Arrays for prefix checking
  const shortcuts = Array.from(shortcutTokens);
  const keywords = Array.from(keywordTokens);

  // No longer require shortcut match for visibility, but shortcuts still get higher scores below

  if (keyText === fullQuery) {
    score += 10;
  }

  queryTokens.forEach(token => {
    // Check shortcuts first (high priority)
    // Exact match
    if (shortcutTokens.has(token)) {
      score += 20;
      return;
    }
    // Prefix match
    if (shortcuts.some(s => s.startsWith(token))) {
      score += 15;
      return;
    }

    // Check keywords (high priority)
    // Exact match
    if (keywordTokens.has(token)) {
      score += 18;
      return;
    }
    // Prefix match
    if (keywords.some(k => k.startsWith(token))) {
      score += 12;
      return;
    }

    if (onlyShortcuts) return; // For shortcut-only search, don't score other fields

    if (keyText.startsWith(token)) {
      score += 8;
      return;
    }
    if (keyText.includes(token)) {
      score += 6;
      return;
    }
    if (urlText.startsWith(token)) {
      score += 5;
      return;
    }
    if (urlText.includes(token)) {
      score += 4;
      return;
    }
    if (searchableText.includes(token)) {
      score += 3;
    }
  });

  return score;
};

// ============================================================================
// FOLDER INDEX AND SEARCH
// ============================================================================

export interface FolderIndexEntry {
  // 'workspace' entries represent top-level folders (workspace_name in storage = Folders in UI)
  // 'folder' entries represent sub-folders (folder_name in storage = Sub-folders in UI)
  entryType: 'workspace' | 'folder';
  folder: Folder | null; // null for workspace entries
  workspace: Workspace;
  parentFolder: Folder | null;
  name: string; // workspace_name or folder_name
  nameTokens: Set<string>;
  searchableText: string;
  fullPath: string; // e.g., "Workspace Name" or "Workspace Name / Folder Name"
}

/**
 * Build a searchable folder index from the current team's data.
 * Includes:
 * - Workspaces (shown as "Folders" in UI)
 * - Folders and sub-folders (shown as "Sub-folders" in UI)
 */
export const buildFolderIndex = (team: Team | null | undefined): FolderIndexEntry[] => {
  if (!team?.workspaces) return [];
  const entries: FolderIndexEntry[] = [];

  team.workspaces.forEach(workspace => {
    // Index the workspace itself (shown as "Folder" in UI)
    const workspaceName = normalize(workspace.workspace_name || '');
    const workspaceNameTokens = collectTokens(workspace.workspace_name || '');

    entries.push({
      entryType: 'workspace',
      folder: null,
      workspace,
      parentFolder: null,
      name: workspaceName,
      nameTokens: workspaceNameTokens,
      searchableText: workspaceName,
      fullPath: workspace.workspace_name || '',
    });

    // Index folders (shown as "Sub-folders" in UI)
    const collectFolder = (folder: Folder, parentFolder: Folder | null, pathPrefix: string) => {
      const folderName = normalize(folder.folder_name || '');
      const folderNameTokens = collectTokens(folder.folder_name || '');
      const fullPath = pathPrefix ? `${pathPrefix} / ${folder.folder_name}` : folder.folder_name;
      const searchableText = [folderName, workspaceName, fullPath.toLowerCase()].filter(Boolean).join(' ');

      entries.push({
        entryType: 'folder',
        folder,
        workspace,
        parentFolder,
        name: folderName,
        nameTokens: folderNameTokens,
        searchableText,
        fullPath,
      });

      // Recursively index sub-folders
      if (folder.folders && folder.folders.length > 0) {
        folder.folders.forEach(subFolder => {
          collectFolder(subFolder, folder, fullPath);
        });
      }
    };

    const wsPath = workspace.workspace_name || '';
    (workspace.folders || []).forEach(folder => {
      collectFolder(folder, null, wsPath);
    });
  });

  return entries;
};

export interface FolderSearchResult {
  entry: FolderIndexEntry;
  score: number;
}

/**
 * Score a folder entry against query tokens.
 */
const scoreFolderEntry = (entry: FolderIndexEntry, queryTokens: string[], fullQuery: string): number => {
  if (!queryTokens.length) return 0;
  let score = 0;

  const { nameTokens, name, searchableText } = entry;
  const nameTokensArr = Array.from(nameTokens);

  // Exact name match
  if (name === fullQuery) {
    score += 20;
  }

  queryTokens.forEach(token => {
    // Exact token match in name
    if (nameTokens.has(token)) {
      score += 10;
      return;
    }
    // Prefix match in name tokens
    if (nameTokensArr.some((t: string) => t.startsWith(token))) {
      score += 8;
      return;
    }
    // Contains in name
    if (name.includes(token)) {
      score += 6;
      return;
    }
    // Contains in searchable text (includes workspace name, path)
    if (searchableText.includes(token)) {
      score += 3;
    }
  });

  return score;
};

/**
 * Search folders by query.
 */
export const searchFolders = (
  index: FolderIndexEntry[],
  query: string,
  options: { limit?: number; minScore?: number } = {},
): FolderSearchResult[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const tokens = Array.from(new Set([normalizedQuery, ...splitIntoTokens(normalizedQuery)])).filter(Boolean);
  if (!tokens.length) return [];

  const minScore = options.minScore ?? 1;
  const results: FolderSearchResult[] = [];

  index.forEach(entry => {
    const score = scoreFolderEntry(entry, tokens, normalizedQuery);
    if (score >= minScore) {
      results.push({ entry, score });
    }
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  if (options.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
};

export const searchSnippets = (
  index: SnippetIndexEntry[],
  query: string,
  options: SnippetSearchOptions = {},
): SnippetSearchResult[] => {
  const normalizedQuery = normalize(query);

  // If query is empty but we have allowedCategories (e.g. @ mentions), return all matching items sorted by recency
  if (!normalizedQuery && options.allowedCategories) {
    const allowed = options.allowedCategories;
    const results = index.filter(entry => allowed.has(entry.category)).map(entry => ({ entry, score: 1 }));

    results.sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);

    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }
  // If query is empty and onlyShortcuts is requested, return all items with shortcuts/keywords sorted by recency
  if (!normalizedQuery && options.onlyShortcuts) {
    const results = index.map(entry => ({ entry, score: 1 }));

    results.sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);

    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  if (!normalizedQuery) return [];

  const tokens = Array.from(new Set([normalizedQuery, ...splitIntoTokens(normalizedQuery)])).filter(Boolean);
  if (!tokens.length) return [];

  const allowedCategories = options.allowedCategories;
  const minScore = options.minScore ?? 1;
  const onlyShortcuts = !!options.onlyShortcuts;

  const results: SnippetSearchResult[] = [];

  index.forEach(entry => {
    if (allowedCategories && !allowedCategories.has(entry.category)) {
      return;
    }

    const score = scoreSnippetEntry(entry, tokens, normalizedQuery, onlyShortcuts);
    if (score >= minScore) {
      results.push({ entry, score });
    }
  });

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.updatedAt - a.entry.updatedAt;
  });

  if (options.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
};
