import type { Folder, Snippet, Workspace } from '../../../../../modals/interfaces';
import type { SnippetActionDetail, SnippetSuggestion } from './types';

/**
 * Strips HTML tags from a string and returns plain text content.
 * Example: "<p>Hello</p>" -> "Hello"
 */
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  // Remove HTML tags and decode common HTML entities
  return html
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Decode ampersand
    .replace(/&lt;/g, '<') // Decode less than
    .replace(/&gt;/g, '>') // Decode greater than
    .replace(/&quot;/g, '"') // Decode quotes
    .replace(/&#39;/g, "'") // Decode single quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

export const isNoteCategory = (category: string | null | undefined) => {
  const normalized = (category || '').toLowerCase();
  return normalized === 'snippet' || normalized === 'note';
};

export const isPromptCategory = (category: string | null | undefined) => {
  const normalized = (category || '').toLowerCase();
  return normalized === 'prompt';
};

export const isTabGroupCategory = (category: string | null | undefined) => {
  const normalized = (category || '').toLowerCase();
  return normalized === 'tabgroup' || normalized === 'tab group' || normalized === 'link group';
};

export const isLinkCategory = (category: string | null | undefined) => {
  const normalized = (category || '').toLowerCase();
  return (
    normalized === 'link' ||
    normalized === 'biolink' ||
    normalized === 'biolinks' ||
    normalized === 'quicklink' ||
    normalized === 'bulk_link' ||
    normalized === 'bulk link' ||
    isTabGroupCategory(category)
  );
};

export const resolveSnippetIcon = (category: string | null | undefined): 'note' | 'link' | 'tabgroup' | 'prompt' => {
  if (isTabGroupCategory(category)) return 'tabgroup';
  if (isPromptCategory(category)) return 'prompt';
  if (isLinkCategory(category)) return 'link';
  return 'note';
};

// Centralized Action Resolver for Unified Node System
export type NodeActionKind = 'view_note' | 'edit_link' | 'view_prompt' | 'open_multiple_links';

export const resolveNodeAction = (snippet: Snippet): NodeActionKind => {
  const category = (snippet.category || '').toLowerCase();
  if (isTabGroupCategory(category)) return 'open_multiple_links';
  if (isPromptCategory(category)) return 'view_prompt';
  if (isLinkCategory(category)) return 'edit_link';
  return 'view_note';
};

// ... (getSnippetPreview, extractUrlsFromSnippet, buildSuggestionKey, buildSnippetSuggestion - keep unchanged or include if needed for context)

export const buildSnippetDeleteDetail = (
  suggestion: SnippetSuggestion,
  itemKind: 'note' | 'link' | 'prompt' | 'tabgroup',
): SnippetActionDetail | null => {
  const snippet = suggestion.snippet;
  const workspace = suggestion.workspace;
  const folder = suggestion.folder;
  const snippetId = snippet.id || (snippet as any).snippet_id;
  if (!snippetId) return null;

  let commandId: 'delete_snippet' | 'delete_link' | 'delete_folder' = 'delete_snippet';
  if (itemKind === 'link' || itemKind === 'tabgroup') commandId = 'delete_link';

  return {
    snippetId,
    snippetKey: snippet.key,
    category: snippet.category,
    workspaceId: workspace.workspace_id,
    workspaceName: workspace.workspace_name,
    folderId: folder?.folder_id ?? null,
    folderName: folder?.folder_name ?? null,
    commandId,
  };
};

export const getSnippetPreview = (snippet: Snippet): string => {
  if (!snippet?.value) return '';

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    if (!raw) return '';

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray((parsed as any).urls)) {
          return ((parsed as any).urls as string[]).slice(0, 2).join(', ');
        }
        if (typeof (parsed as any).note === 'string') {
          const noteContent = (parsed as any).note as string;
          const cleanNote = stripHtmlTags(noteContent);
          return cleanNote.length > 140 ? `${cleanNote.slice(0, 137)}…` : cleanNote;
        }
      }
    } catch {
      // fall through to raw string
    }

    // Strip HTML tags from raw content
    const cleanRaw = stripHtmlTags(raw);
    return cleanRaw.length > 140 ? `${cleanRaw.slice(0, 137)}…` : cleanRaw;
  }

  if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      return ((snippet.value as any).urls as string[]).slice(0, 2).join(', ');
    }
    if ('names' in snippet.value && Array.isArray((snippet.value as any).names)) {
      return ((snippet.value as any).names as string[]).slice(0, 2).join(', ');
    }
  }

  return '';
};

export const extractUrlsFromSnippet = (snippet: Snippet): string[] => {
  if (!snippet?.value) return [];

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).urls)) {
        return ((parsed as any).urls as string[]).filter(Boolean);
      }
    } catch {
      if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat')) return [raw];
    }
    if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat')) return [raw];
    return [];
  }

  if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      return ((snippet.value as any).urls as string[]).filter(Boolean);
    }
  }

  return [];
};

export const buildSuggestionKey = (
  workspace: Workspace,
  folder: Folder | null,
  snippet: Snippet,
  index: number,
): string => {
  const snippetId = snippet.id || (snippet as any).snippet_id;
  if (snippetId) return snippetId;
  const folderPart = folder ? `${folder.folder_id}-` : '';
  return `${workspace.workspace_id}-${folderPart}${snippet.key || 'snippet'}-${index}`;
};

export const buildSnippetSuggestion = (
  workspace: Workspace,
  folder: Folder | null,
  snippet: Snippet,
): SnippetSuggestion => ({
  snippet,
  workspace,
  folder,
});
