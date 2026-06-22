import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import NotesPopup from './components/NotesPopup';
import { ImageDownloader } from './ImageDownloader';
import type { NoteItem, PopupPosition, SupportedInputElement } from './types';
import { evaluateAst, RuntimeContext, scanAstForFields, type FieldNode, type DropdownFieldConfig, type ToggleFieldConfig, type ASTNode } from '@extension/shared';

let currentTabId: number | undefined;
chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, id => {
  currentTabId = id;
});

type TriggerContext =
  | {
      type: 'input';
      element: HTMLInputElement | HTMLTextAreaElement;
      selectionStart: number;
    }
  | {
      type: 'contentEditable';
      element: HTMLElement;
      slashRange: Range;
    }
  | {
      type: 'googleDocs';
      iframe: HTMLIFrameElement;
      caretRange: Range;
    }
  | {
      type: 'googleSheets';
      element: HTMLInputElement | HTMLTextAreaElement;
      selectionStart: number;
    };

const isTextInput = (element: HTMLInputElement) => {
  const allowedTypes = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'];
  return allowedTypes.includes(element.type);
};

const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  const temp = document.createElement('div');
  temp.innerHTML = html;

  let text = '';

  const getTextWithStructure = (node: Node, context: { inOrderedList?: boolean; listIndex?: number } = {}) => {
    // Handle Text Nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent || '';
      // We don't trim completely because space between inline elements matters
      // But we can collapse multiple spaces
      text += content.replace(/[ \t]{2,}/g, ' ');
      return;
    }

    // Handle Element Nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // Block elements that should trigger a newline
      // Added 'tr' for table rows to behave like blocks
      const isBlock = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'ul', 'ol', 'tr'].includes(tagName);
      const isListItem = tagName === 'li';

      // Prefix for list items
      if (isListItem) {
        if (context.inOrderedList) {
          text += `${context.listIndex}. `;
        } else {
          text += '• ';
        }
      }

      // Handle children
      if (tagName === 'ol') {
        let index = 1;
        el.childNodes.forEach(child => {
          if (child.nodeName.toLowerCase() === 'li') {
            getTextWithStructure(child, { inOrderedList: true, listIndex: index++ });
          } else {
            getTextWithStructure(child, context);
          }
        });
      } else if (tagName === 'ul') {
        el.childNodes.forEach(child => {
          if (child.nodeName.toLowerCase() === 'li') {
            getTextWithStructure(child, { inOrderedList: false });
          } else {
            getTextWithStructure(child, context);
          }
        });
      } else {
        // Normal recursion
        el.childNodes.forEach(child => {
          getTextWithStructure(child, context);
        });
      }

      // Append newline after block elements
      // But avoid double newlines if the block ends with one already (simple heuristic)
      if (isBlock) {
        if (!text.endsWith('\n')) {
          text += '\n';
        }
      }
    }
  };

  getTextWithStructure(temp);

  return (
    text
      .replace(/\r/g, '')
      .replace(/&nbsp;/g, ' ')
      // Collapse 3+ newlines to 2
      .replace(/\n{3,}/g, '\n\n')
      // Trim result
      .trim()
  );
};

const buildPreview = (text: string) => {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 90 ? `${compact.slice(0, 90)}…` : compact;
};

// ============================================
// Dynamic Variable Helpers
// ============================================

/**
 * Detect all {{variable}} patterns in text
 */
const detectVariables = (text: string): string[] => {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    const variableName = match[1].trim();
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }
  return variables;
};

/**
 * Format a date like "16th December 2025"
 */
const formatDate = (date: Date): string => {
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix} ${month} ${year}`;
};

/**
 * Format time like "3:45 PM"
 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Special variables that are auto-resolved without user input
 */
const specialVariableResolvers: Record<string, () => string> = {
  current_date: () => formatDate(new Date()),
  next_day: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  },
  next_week: () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDate(d);
  },
  current_time: () => formatTime(new Date()),
  current_year: () => new Date().getFullYear().toString(),
  current_month: () => new Date().toLocaleString('default', { month: 'long' }),
  next_month: () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleString('default', { month: 'long' });
  },
};

/**
 * Resolve all special variables in text
 */
const resolveSpecialVariables = (text: string): string => {
  let result = text;
  for (const [varName, resolver] of Object.entries(specialVariableResolvers)) {
    const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, resolver());
  }
  return result;
};

/**
 * Check if a variable name is a special auto-resolved variable
 */
const isSpecialVariable = (varName: string): boolean => {
  return varName.toLowerCase() in specialVariableResolvers;
};

// Slight offset so the popup appears lower on the page and avoids overlapping host UI.
const POPUP_VERTICAL_OFFSET = 36;

const CARET_MIRROR_PROPS = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
] as const;

const getInputCaretPosition = (
  element: HTMLInputElement | HTMLTextAreaElement,
  selectionStart: number,
): PopupPosition | null => {
  if (typeof selectionStart !== 'number' || selectionStart < 0) return null;
  const doc = element.ownerDocument;
  const win = doc?.defaultView ?? window;
  if (!doc) return null;

  const mirrorDiv = doc.createElement('div');
  const mirrorSpan = doc.createElement('span');
  const computed = win.getComputedStyle(element);
  const isInputElement = element instanceof HTMLInputElement && !(element instanceof HTMLTextAreaElement);

  mirrorDiv.style.position = 'absolute';
  mirrorDiv.style.top = '0';
  mirrorDiv.style.left = '-9999px';
  mirrorDiv.style.visibility = 'hidden';
  mirrorDiv.style.whiteSpace = isInputElement ? 'pre' : 'pre-wrap';
  mirrorDiv.style.wordWrap = 'break-word';
  mirrorDiv.style.pointerEvents = 'none';

  CARET_MIRROR_PROPS.forEach(prop => {
    const value = computed.getPropertyValue(prop);
    if (value) {
      mirrorDiv.style.setProperty(prop, value);
    }
  });

  // For inputs we need to explicitly set width to allow horizontal measuring.
  if (isInputElement) {
    mirrorDiv.style.width = `${element.scrollWidth}px`;
  }

  const beforeValue = element.value.substring(0, selectionStart);
  const afterValue = element.value.substring(selectionStart) || '.';
  mirrorDiv.textContent = beforeValue;
  mirrorSpan.textContent = afterValue;
  mirrorDiv.appendChild(mirrorSpan);
  doc.body.appendChild(mirrorDiv);

  mirrorDiv.scrollTop = element.scrollTop;
  mirrorDiv.scrollLeft = element.scrollLeft;

  const mirrorRect = mirrorDiv.getBoundingClientRect();
  const spanRect = mirrorSpan.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  let caretHeight =
    spanRect.height ||
    parseFloat(computed.lineHeight || '') ||
    parseFloat(computed.fontSize || '') ||
    elementRect.height ||
    16;

  if (!Number.isFinite(caretHeight)) caretHeight = 16;

  const leftOffset = spanRect.left - mirrorRect.left;
  const topOffset = spanRect.top - mirrorRect.top;

  const x = elementRect.left + leftOffset - element.scrollLeft + win.scrollX;
  const y = elementRect.top + topOffset - element.scrollTop + caretHeight + 6 + win.scrollY;

  doc.body.removeChild(mirrorDiv);

  return {
    x,
    y,
    caretHeight,
  };
};

const extractTabsValue = (value: any): string => {
  if (!value || typeof value !== 'object') return '';
  const urls = Array.isArray(value.urls) ? value.urls : [];
  if (!urls.length) return JSON.stringify(value);
  return urls
    .map((url: unknown) => (typeof url === 'string' ? url : ''))
    .filter(Boolean)
    .join('\n');
};

const normalizeSnippetTags = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(tag => {
      if (!tag) return null;
      if (typeof tag === 'string') return tag;
      if (typeof tag === 'object' && typeof (tag as { name?: unknown }).name === 'string') {
        return ((tag as { name: string }).name || '').trim();
      }
      if (typeof tag === 'object' && typeof (tag as { label?: unknown }).label === 'string') {
        return ((tag as { label: string }).label || '').trim();
      }
      return null;
    })
    .filter((tag): tag is string => Boolean(tag && tag.trim()));
};

const buildNoteFromSnippet = (snippet: any): NoteItem | null => {
  if (!snippet || typeof snippet !== 'object') return null;

  const rawId = typeof snippet.id === 'string' && snippet.id.trim().length > 0 ? snippet.id.trim() : null;
  const rawSnippetId =
    typeof snippet.snippet_id === 'string' && snippet.snippet_id.trim().length > 0 ? snippet.snippet_id.trim() : null;
  const id = rawId || rawSnippetId;

  const key =
    typeof snippet.key === 'string' && snippet.key.trim().length > 0 ? snippet.key.trim() : id || 'Untitled note';

  const rawValue = snippet.value;
  let value: string;
  if (typeof rawValue === 'string') {
    if (rawValue.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawValue);
        if (typeof parsed.url === 'string') {
          value = parsed.url;
        } else if (Array.isArray(parsed.urls)) {
          value = extractTabsValue(parsed);
        } else {
          value = rawValue;
        }
      } catch {
        value = rawValue;
      }
    } else {
      value = rawValue;
    }
  } else if (rawValue && typeof rawValue === 'object') {
    value = extractTabsValue(rawValue);
  } else {
    value = '';
  }

  if (!value || !value.trim()) return null;

  const plainText = sanitizeHtml(value);
  if (!plainText) return null;

  const tags = normalizeSnippetTags(snippet.tags ?? snippet.snippet_tags);
  const category =
    typeof snippet.category === 'string'
      ? snippet.category.trim()
      : typeof snippet.snippet_category === 'string'
        ? snippet.snippet_category.trim()
        : undefined;

  return {
    id: id || `${key}-${plainText.slice(0, 12)}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    value,
    plainText,
    preview: buildPreview(plainText),
    tags,
    category,
    config: snippet.config,
  };
};

const flattenNotesFromAllData = (rawData: unknown): NoteItem[] => {
  if (!Array.isArray(rawData)) return [];
  const notes: NoteItem[] = [];
  const seen = new Set<string>();

  const pushSnippet = (snippet: any) => {
    const note = buildNoteFromSnippet(snippet);
    if (!note) return;

    // ALLOWED CATEGORIES: note, snippet, link/links/quicklink
    if (
      note.category !== 'note' &&
      note.category !== 'link' &&
      note.category !== 'links' &&
      note.category !== 'quicklink' &&
      note.category !== 'snippet'
    ) {
      return;
    }

    if (seen.has(note.id)) return;
    seen.add(note.id);
    notes.push(note);
  };

  rawData.forEach(team => {
    if (!team || typeof team !== 'object') return;
    const workspaces = Array.isArray((team as any).workspaces) ? ((team as any).workspaces as any[]) : [];
    workspaces.forEach((workspace: any) => {
      if (!workspace || typeof workspace !== 'object') return;
      const workspaceSnippets = Array.isArray((workspace as any).workspace_snippets)
        ? ((workspace as any).workspace_snippets as any[])
        : [];
      workspaceSnippets.forEach(pushSnippet);

      const folders = Array.isArray((workspace as any).folders) ? ((workspace as any).folders as any[]) : [];
      folders.forEach((folder: any) => {
        if (!folder || typeof folder !== 'object') return;
        const folderSnippets = Array.isArray((folder as any).snippets) ? ((folder as any).snippets as any[]) : [];
        folderSnippets.forEach(pushSnippet);
      });
    });
  });

  return notes;
};

const clampPositionToViewport = (position: PopupPosition): PopupPosition => {
  const padding = 12;
  const maxX = window.scrollX + window.innerWidth - padding;
  const maxY = window.scrollY + window.innerHeight - padding;
  return {
    x: Math.max(window.scrollX + padding, Math.min(position.x, maxX)),
    y: Math.max(window.scrollY + padding, Math.min(position.y, maxY)),
    caretHeight: position.caretHeight,
  };
};

const getElementAnchorPosition = (element: HTMLElement): PopupPosition => {
  const rect = element.getBoundingClientRect();
  return clampPositionToViewport({
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 8,
    caretHeight: rect.height,
  });
};

const getRangeAnchorPosition = (range: Range): PopupPosition | null => {
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }
  return clampPositionToViewport({
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 8,
    caretHeight: rect.height,
  });
};

const getRangeRelativeToIframe = (iframe: HTMLIFrameElement, range: Range): PopupPosition | null => {
  const iframeRect = iframe.getBoundingClientRect();
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return clampPositionToViewport({
    x: iframeRect.left + rect.left + window.scrollX,
    y: iframeRect.top + rect.bottom + window.scrollY + 8,
    caretHeight: rect.height,
  });
};

const buildSlashRange = (element: HTMLElement, caretRange: Range, length: number = 2): Range | null => {
  const slashRange = caretRange.cloneRange();
  let remaining = length;
  let { endContainer, endOffset } = slashRange;

  const findPreviousTextNode = (node: Node): Text | null => {
    let current: Node | null = node;

    while (current && current !== element) {
      if (current.previousSibling) {
        current = current.previousSibling;
        while (current && current.lastChild) {
          current = current.lastChild;
        }
      } else {
        current = current.parentNode;
      }

      if (current && current.nodeType === Node.TEXT_NODE) {
        return current as Text;
      }
    }

    return null;
  };

  while (remaining > 0) {
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = endContainer as Text;
      if (endOffset >= remaining) {
        slashRange.setStart(textNode, endOffset - remaining);
        remaining = 0;
        break;
      } else if (endOffset > 0) {
        remaining -= endOffset;
        slashRange.setStart(textNode, 0);
      }
    }

    const previous = findPreviousTextNode(endContainer);
    if (!previous) {
      return null;
    }

    endContainer = previous;
    endOffset = previous.textContent?.length ?? 0;
    slashRange.setStart(previous, Math.max(0, endOffset));
  }

  return remaining === 0 ? slashRange : null;
};

const dispatchInputEvents = (element: HTMLInputElement | HTMLTextAreaElement) => {
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
};

class SlashNotesController {
  private notes: NoteItem[] = [];
  private popupContainer: HTMLDivElement | null = null;
  private popupRoot: Root | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private shadowContainer: HTMLDivElement | null = null;
  private isOpen = false;
  private triggerContext: TriggerContext | null = null;
  private focusedElement: SupportedInputElement | null = null;
  private lastTriggerTimestamp = 0;
  private readonly googleDocs =
    window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/document/');
  private readonly googleSheets =
    window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/');
  private docsIframe: HTMLIFrameElement | null = null;
  private docsSlashCount = 0;
  private loadNotesPromise: Promise<void> | null = null;
  private pendingTrigger: (() => void) | null = null;
  private injectedDocsIframes = new WeakSet<HTMLIFrameElement>();
  private docsTypedBuffer = '';
  private searchQuery = ''; // Track text typed after c/
  private slashPosition = -1; // Position of c/ in the input when popup opened

  constructor() {
    void this.loadNotes();
    this.setupFocusTracking();
    this.setupInputListeners();
    this.setupGlobalKeyListeners();
    this.setupStorageListener(); // Listen for updates
    if (this.googleDocs) {
      this.setupGoogleDocs();
    }
    if (this.googleSheets) {
      this.setupGoogleSheets();
    }
  }

  private setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.myCachedAllData || changes.snippets_cache || changes.local_ast_snippets) {
          // Force reload
          this.loadNotesPromise = null;
          void this.loadNotes();
        }
      }
    });
  }

  private async loadNotes(): Promise<void> {
    if (this.loadNotesPromise) {
      await this.loadNotesPromise;
      return;
    }

    this.loadNotesPromise = (async () => {
      try {
        const result = await chrome.storage.local.get(['myCachedAllData', 'snippets_cache', 'local_ast_snippets']);
        const fromAllData = flattenNotesFromAllData(result?.myCachedAllData);

        const fallbackNotes: NoteItem[] = [];
        if (!fromAllData.length && result?.snippets_cache && typeof result.snippets_cache === 'object') {
          const entries = Object.entries(result.snippets_cache as Record<string, unknown>);
          entries.forEach(([key, value]) => {
            if (typeof value !== 'string' || !value.trim()) return;
            const plainText = sanitizeHtml(value);
            if (!plainText) return;
            fallbackNotes.push({
              id: key,
              key,
              value,
              plainText,
              preview: buildPreview(plainText),
              tags: [],
            });
          });
        }

        let baseNotes = fromAllData.length ? fromAllData : fallbackNotes;

        // Merge local AST snippets
        if (result?.local_ast_snippets && typeof result.local_ast_snippets === 'object') {
          const localAsts = Object.values(result.local_ast_snippets as Record<string, any>);
          localAsts.forEach(astObj => {
            // Check if it already exists in base notes
            if (!baseNotes.some(n => n.id === astObj.snippet_id)) {
              let snippetAst: ASTNode[] | null = null;
              try {
                if (astObj.config) {
                  snippetAst = typeof astObj.config === 'string' ? JSON.parse(astObj.config) : astObj.config;
                } else if (astObj.value && typeof astObj.value === 'string' && astObj.value.trim().startsWith('[')) {
                  snippetAst = JSON.parse(astObj.value);
                }
              } catch (e) {
                console.warn("Failed to parse snippet value as AST", e);
              }

              let plainText = astObj.value;
              if (snippetAst) {
                plainText = snippetAst.map(n => n.type === 'text' ? n.value : '').join('');
              }

              baseNotes.push({
                id: astObj.snippet_id,
                key: astObj.key,
                value: astObj.value,
                plainText: plainText || astObj.key,
                preview: buildPreview(plainText || astObj.key),
                tags: astObj.tags ? astObj.tags.map((t: any) => t.name || t.label || t).filter(Boolean) : [],
                category: 'snippet',
                config: astObj.config
              });
            }
          });
        }

        this.notes = baseNotes;
      } catch (error) {
        console.error('[SlashNotes] Failed to load notes:', error);
        this.notes = [];
      } finally {
        this.loadNotesPromise = null;
      }
    })();

    await this.loadNotesPromise;
  }

  private checkAndReplaceSnippet(
    textBefore: string,
    replaceCallback: (deleteCount: number, text: string, html?: string) => void,
  ): boolean {
    const triggers = ['/t', 'c//'];

    for (const trigger of triggers) {
      const lastTriggerIndex = textBefore.lastIndexOf(trigger);
      if (lastTriggerIndex === -1) continue;

      const rawPotentialKey = textBefore.slice(lastTriggerIndex + trigger.length);
      if (!rawPotentialKey) continue;

      const potentialKey = rawPotentialKey.trimStart();

      const note = this.notes.find(n => n.key === potentialKey);
      if (note) {
        // We need to delete everything from the trigger start to the cursor
        // This includes the trigger, any whitespace, and the key
        const matchLength = textBefore.length - lastTriggerIndex;
        let htmlSnippet = note.value || note.plainText;
        if (htmlSnippet && !/<[a-z][\s\S]*>/i.test(htmlSnippet)) {
          htmlSnippet = htmlSnippet.replace(/\n/g, '<br>');
        }
        replaceCallback(matchLength, note.plainText, htmlSnippet);
        return true;
      }
    }
    return false;
  }

  private runWithNotes(callback: () => void) {
    if (this.notes.length) {
      callback();
      return;
    }

    this.pendingTrigger = callback;
    void this.loadNotes().then(() => {
      const trigger = this.pendingTrigger;
      this.pendingTrigger = null;
      trigger?.();
    });
  }

  private setupFocusTracking() {
    document.addEventListener(
      'focusin',
      event => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target instanceof HTMLInputElement && isTextInput(target)) {
          this.focusedElement = target;
        } else if (target instanceof HTMLTextAreaElement) {
          this.focusedElement = target;
        } else if (target.isContentEditable) {
          this.focusedElement = target;
        }
      },
      true,
    );

    document.addEventListener(
      'focusout',
      event => {
        if (event.target === this.focusedElement) {
          this.focusedElement = null;
        }
      },
      true,
    );
  }

  private setupInputListeners() {
    document.addEventListener(
      'input',
      event => {
        // IGNORE AUTOMATION EVENTS
        if ((window as any).__tasklabs_automation_active || (event as any).isAutomation) {
          return;
        }

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target instanceof HTMLInputElement && isTextInput(target)) {
          this.tryTriggerForInput(target);
        } else if (target instanceof HTMLTextAreaElement) {
          this.tryTriggerForInput(target);
        } else if (target.isContentEditable) {
          this.tryTriggerForContentEditable(target);
        }
      },
      true,
    );
  }

  private setupGlobalKeyListeners() {
    document.addEventListener(
      'keyup',
      event => {
        if (event.key === 'Escape' && this.isOpen) {
          event.stopPropagation();
          this.closePopup();
        }
      },
      true,
    );
  }

  private setupGoogleDocs() {
    const pollIframe = () => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe.docs-texteventtarget-iframe');
      if (!iframe || !iframe.contentDocument) {
        window.setTimeout(pollIframe, 500);
        return;
      }

      this.docsIframe = iframe;
      const doc = iframe.contentDocument;
      doc.addEventListener('keydown', this.handleGoogleDocsKeyDown, true);
    };

    pollIframe();
  }

  private setupGoogleSheets() {
    document.addEventListener(
      'keydown',
      event => {
        if (!this.googleSheets) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        const isFormulaBar =
          target instanceof HTMLInputElement &&
          target.id === 't-formula-bar-input' &&
          isTextInput(target as HTMLInputElement);

        if (isFormulaBar && target.selectionStart !== null) {
          const key = event.key;
          if (key.length === 1) {
            const valueBefore = target.value.slice(0, target.selectionStart || 0) + key;

            this.checkAndReplaceSnippet(valueBefore, (deleteCount, text, html) => {
              event.preventDefault();
              event.stopPropagation();
              this.insertIntoSheets(target as HTMLInputElement, target.selectionStart || 0, text, deleteCount - 1);
            });
          }
        }
      },
      true,
    );
  }

  private handleGoogleDocsKeyDown = (event: KeyboardEvent) => {
    const iframe = this.docsIframe;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.docsTypedBuffer += event.key;

      this.checkAndReplaceSnippet(this.docsTypedBuffer, (deleteCount, text, html) => {
        this.docsTypedBuffer = '';

        const selection = iframe.contentWindow?.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

        setTimeout(() => {
          this.insertIntoGoogleDocs(iframe, range!, text, html, deleteCount);
        }, 0);
      });
    } else if (event.key === 'Backspace') {
      this.docsTypedBuffer = this.docsTypedBuffer.slice(0, -1);
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      if (this.docsTypedBuffer.length > 100) {
        this.docsTypedBuffer = this.docsTypedBuffer.slice(-50);
      }
    }

    if (event.key === 'c') {
      this.docsSlashCount = 1;
    } else if (event.key === '/' && this.docsSlashCount === 1) {
      this.docsSlashCount = 2;
    } else {
      this.docsSlashCount = 0;
    }

    if (this.docsSlashCount >= 2) {
      this.docsSlashCount = 0;
      const selection = iframe.contentWindow?.getSelection();
      if (!selection || !selection.rangeCount) return;

      const caretRange = selection.getRangeAt(0).cloneRange();
      const openPopup = () => {
        const docSelection = iframe.contentWindow?.getSelection();
        const currentRange =
          docSelection && docSelection.rangeCount ? docSelection.getRangeAt(0).cloneRange() : caretRange.cloneRange();
        const position = getRangeRelativeToIframe(iframe, currentRange) || getElementAnchorPosition(iframe);
        if (!position) return;
        this.triggerContext = {
          type: 'googleDocs',
          iframe,
          caretRange: currentRange,
        };
        this.renderPopup(position);
      };

      this.runWithNotes(() => {
        requestAnimationFrame(openPopup);
      });
    }
  };

  private tryTriggerForInput(element: HTMLInputElement | HTMLTextAreaElement) {
    if (element.selectionStart === null) return;

    const selectionStart = element.selectionStart;
    const valueBefore = element.value.slice(0, selectionStart);

    const handled = this.checkAndReplaceSnippet(valueBefore, (deleteCount, text, html) => {
      this.insertIntoStandardInput(element, selectionStart, text, deleteCount);
    });

    if (handled) return;

    const slashIndex = valueBefore.lastIndexOf('c/');

    if (this.isOpen && this.triggerContext?.type === 'input') {
      if (slashIndex === -1) {
        this.closePopup();
        return;
      }

      const newQuery = valueBefore.slice(slashIndex + 2);
      this.searchQuery = newQuery;

      const caretPosition = getInputCaretPosition(element, selectionStart);
      const position = caretPosition || getElementAnchorPosition(element);
      this.renderPopup(position, this.searchQuery);
      return;
    }

    if (!valueBefore.endsWith('c/')) return;

    const openPopup = () => {
      if (!element.isConnected) return;
      if (!element.value.slice(0, selectionStart).endsWith('c/')) return;

      this.slashPosition = selectionStart - 2;
      this.searchQuery = '';

      this.openPopupForElement(element, selectionStart, 'input');
    };

    this.runWithNotes(() => {
      requestAnimationFrame(openPopup);
    });
  }

  private tryTriggerForContentEditable(element: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!element.contains(range.endContainer)) return;

    const probe = range.cloneRange();
    probe.selectNodeContents(element);
    probe.setEnd(range.endContainer, range.endOffset);
    const textBefore = probe.toString();

    const handled = this.checkAndReplaceSnippet(textBefore, (deleteCount, text, html) => {
      const slashRange = buildSlashRange(element, range, deleteCount);
      if (slashRange) {
        this.insertIntoContentEditable(element, slashRange, text, html);
      }
    });

    if (handled) return;

    const slashIndex = textBefore.lastIndexOf('c/');

    if (this.isOpen && this.triggerContext?.type === 'contentEditable') {
      if (slashIndex === -1) {
        this.closePopup();
        return;
      }

      const newQuery = textBefore.slice(slashIndex + 2);
      this.searchQuery = newQuery;

      const currentSelection = window.getSelection();
      const currentRange = currentSelection && currentSelection.rangeCount ? currentSelection.getRangeAt(0) : range;
      const anchorPosition = getRangeAnchorPosition(currentRange) || getElementAnchorPosition(element);

      if (anchorPosition) {
        this.renderPopup(anchorPosition, this.searchQuery);
      }
      return;
    }

    if (!textBefore.endsWith('c/')) return;

    const slashRange = buildSlashRange(element, range, 2);
    if (!slashRange) return;

    const slashIndexForQuery = textBefore.lastIndexOf('c/');
    const searchQuery = slashIndexForQuery !== -1 ? textBefore.slice(slashIndexForQuery + 2) : '';

    const storedRange = slashRange.cloneRange();
    const openPopup = () => {
      if (!element.isConnected) return;
      const textSnapshot = element.textContent || '';
      if (!textSnapshot.includes('c/')) return;

      const currentSelection = window.getSelection();
      const currentRange =
        currentSelection && currentSelection.rangeCount ? currentSelection.getRangeAt(0) : storedRange;
      const anchorPosition = getRangeAnchorPosition(currentRange) || getElementAnchorPosition(element);

      if (!anchorPosition) return;
      this.triggerContext = {
        type: 'contentEditable',
        element,
        slashRange: storedRange.cloneRange(),
      };
      this.renderPopup(anchorPosition, searchQuery);
    };

    this.runWithNotes(openPopup);
  }

  private openPopupForElement(
    element: HTMLInputElement | HTMLTextAreaElement,
    selectionStart: number,
    type: 'input' | 'googleSheets',
  ) {
    const now = Date.now();
    if (now - this.lastTriggerTimestamp < 150) {
      return;
    }
    this.lastTriggerTimestamp = now;

    const safeSelection = Math.max(0, Math.min(selectionStart, element.value.length));
    const caretPosition =
      type === 'input' || type === 'googleSheets' ? getInputCaretPosition(element, safeSelection) : null;
    const position = caretPosition || getElementAnchorPosition(element);
    this.triggerContext =
      type === 'googleSheets'
        ? {
            type: 'googleSheets',
            element,
            selectionStart,
          }
        : {
            type: 'input',
            element,
            selectionStart,
          };

    this.renderPopup(position);
  }

  private renderPopup(position: PopupPosition, externalQuery: string = '') {
    const finalPosition = clampPositionToViewport({
      x: position.x,
      y: position.y + POPUP_VERTICAL_OFFSET,
    });
    if (!this.popupContainer) {
      this.popupContainer = document.createElement('div');
      this.popupContainer.id = 'tasklabs-slash-popup-root';
      this.popupContainer.style.position = 'absolute';
      this.popupContainer.style.top = '0';
      this.popupContainer.style.left = '0';
      this.popupContainer.style.zIndex = '2147483646';
      document.documentElement.appendChild(this.popupContainer);
      this.shadowRoot = this.popupContainer.attachShadow({ mode: 'open' });
      this.shadowContainer = document.createElement('div');
      this.shadowRoot.appendChild(this.shadowContainer);
      this.attachShadowStyles();
      this.popupRoot = createRoot(this.shadowContainer);
    }

    this.popupRoot?.render(
      React.createElement(NotesPopup, {
        notes: this.notes,
        position: finalPosition,
        onClose: () => this.closePopup(),
        onSelect: note => this.insertNote(note),
        onEdit: note => {
          try {
            window.dispatchEvent(
              new CustomEvent('tasklabs:edit-snippet', {
                detail: note,
              }),
            );
          } catch (e) {
            console.error('[SlashNotes] Failed to send edit message', e);
          }
          this.closePopup();
        },
        externalQuery,
      }),
    );

    document.addEventListener('mousedown', this.handleOutsideClick, true);
    document.addEventListener('touchstart', this.handleOutsideClick, true);

    this.isOpen = true;
  }

  private handleOutsideClick = (event: MouseEvent | TouchEvent) => {
    if (!this.popupContainer) return;

    const targetNode = event.target as Node | null;
    if (!targetNode) return;

    if (this.popupContainer.contains(targetNode)) return;
    if (this.shadowContainer?.contains(targetNode)) return;
    this.closePopup();
  };

  private closePopup() {
    if (!this.isOpen) return;

    document.removeEventListener('mousedown', this.handleOutsideClick, true);
    document.removeEventListener('touchstart', this.handleOutsideClick, true);

    if (this.popupRoot) {
      this.popupRoot.render(null);
    }

    this.isOpen = false;
    this.triggerContext = null;
    this.searchQuery = '';
    this.slashPosition = -1;
  }

  private async insertNote(note: NoteItem) {
    let textToInsert = note.plainText;
    let htmlToInsert = note.value || note.plainText;
    let customVariables: Array<string | FieldNode> = [];
    let astFields: FieldNode[] = [];
    let cursorOffset: number | undefined;


    if (note.category === 'snippet') {
      try {
        let parsed = null;
        if (note.config) {
           parsed = typeof note.config === 'string' ? JSON.parse(note.config) : note.config;
        } else if (note.value && note.value.trim().startsWith('[')) {
           parsed = JSON.parse(note.value);
        }
        if (parsed && Array.isArray(parsed) && (parsed.length === 0 || (typeof parsed[0] === 'object' && parsed[0] !== null && 'type' in parsed[0]))) {
          astFields = scanAstForFields(parsed);
          let clipboardText = '';
          try {
            clipboardText = await navigator.clipboard.readText();

          } catch (e) {
            console.warn('[NotesExtension] Failed to read clipboard:', e);

          }

          const context = new RuntimeContext();
          context.setValue('__system_clipboard__', clipboardText, 'SYSTEM');
          
          const evalResult = evaluateAst(parsed, context, { leaveUnresolvedAsBraces: true });
          textToInsert = evalResult.text;
          htmlToInsert = evalResult.text; // Basic AST doesn't have HTML formatting yet, so we just use the evaluated text
          if (evalResult.cursorPosition !== undefined) {
            textToInsert = textToInsert.slice(0, evalResult.cursorPosition) + '\u200B__CURSOR__\u200B' + textToInsert.slice(evalResult.cursorPosition);
            
            // Safely insert cursor into HTML using DOM traversal instead of plain string slicing
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlToInsert;
            const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            let currentOffset = 0;
            let inserted = false;
            
            while (node) {
              const textLength = node.nodeValue?.length || 0;
              if (currentOffset + textLength >= evalResult.cursorPosition) {
                const splitIndex = evalResult.cursorPosition - currentOffset;
                const text = node.nodeValue || '';
                node.nodeValue = text.slice(0, splitIndex) + '\u200B__CURSOR__\u200B' + text.slice(splitIndex);
                inserted = true;
                break;
              }
              currentOffset += textLength;
              node = walker.nextNode();
            }
            
            if (!inserted) {
              tempDiv.appendChild(document.createTextNode('\u200B__CURSOR__\u200B'));
            }
            
            htmlToInsert = tempDiv.innerHTML;
          }
          
          cursorOffset = evalResult.cursorPosition;
        }
      } catch (e) {
        // Fallback to plainText if parsing fails
      }
    }

    if (!textToInsert) {
      this.closePopup();
      return;
    }

    // For link-type notes, insert as a clickable hyperlink
    const cat = (note.category || '').toLowerCase();
    const isLink = cat === 'link' || cat === 'links' || cat === 'quicklink';
    if (isLink) {
      // Get the raw URL from the note value
      let url = (note.value || '').trim();
      // Handle JSON-wrapped URLs
      if (url.startsWith('{')) {
        try {
          const parsed = JSON.parse(url);
          if (parsed.url) url = parsed.url;
          else if (Array.isArray(parsed.urls) && parsed.urls.length > 0) url = parsed.urls[0];
        } catch {}
      }
      // Ensure URL has a protocol
      if (url && !/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      const linkTitle = note.key || url;
      textToInsert = url; // Plain text fallback is just the URL
      htmlToInsert = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkTitle}</a>`;
    }

    // Normalize HTML (only for non-link notes, links already have proper HTML)
    if (!isLink && htmlToInsert && !/<[a-z][\s\S]*>/i.test(htmlToInsert)) {
      htmlToInsert = htmlToInsert.replace(/\n/g, '<br>');
    }

    // Step 1: Auto-resolve special variables (current_date, next_day, etc.)
    textToInsert = resolveSpecialVariables(textToInsert);
    htmlToInsert = resolveSpecialVariables(htmlToInsert);

    // Step 2: Check for remaining custom variables that need user input
    const rawStrings = detectVariables(textToInsert).filter(v => !isSpecialVariable(v));
    
    // Merge astFields and rawStrings
    customVariables = [...astFields];
    rawStrings.forEach(s => {
      const isAstField = astFields.some(f => {
        const configLabel = f.config && typeof f.config === 'object' && 'label' in f.config ? (f.config as any).label : undefined;
        return (configLabel || f.alias || f.id) === s;
      });
      if (!isAstField) customVariables.push(s);
    });

    // Filter out auto-evaluating fields from the popup variables list
    // Clipboard and date are always auto-resolved — never show in the modal
    const interactiveVariables = customVariables.filter(v => {
      if (typeof v === 'string') {
        const lower = v.toLowerCase();
        return lower !== 'clipboard' && lower !== 'date';
      }
      return v.fieldType !== 'date' && v.fieldType !== 'clipboard';
    });

    // Strip leftover {{placeholders}} for non-interactive fields (clipboard, date)
    // These may appear in the text if they couldn't be resolved (e.g. empty values)
    const nonInteractiveFields = customVariables.filter(
      v => typeof v !== 'string' && (v.fieldType === 'clipboard' || v.fieldType === 'date')
    ) as FieldNode[];
    nonInteractiveFields.forEach(f => {
      const label = (f.config as any)?.label || f.alias || f.id;
      const re = new RegExp(`\\{\\{\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}}`, 'gi');
      textToInsert = textToInsert.replace(re, '');
      htmlToInsert = htmlToInsert.replace(re, '');
    });

    // Also strip literal {{clipboard}}, {{date}} case-insensitively
    ['clipboard', 'date'].forEach(name => {
      const re = new RegExp(`\\{\\{\\s*${name}\\s*\\}}`, 'gi');
      textToInsert = textToInsert.replace(re, '');
      htmlToInsert = htmlToInsert.replace(re, '');
    });

    const context = this.triggerContext;
    const queryLength = this.searchQuery.length; // Length of text typed after //
    this.closePopup();

    if (!context) return;

    // If there are custom variables, we'll insert text first then prompt for each
    const performInsertion = (text: string, html: string, cursorIndex?: number) => {
      switch (context.type) {
        case 'input':
          // Delete // plus the search query
          this.insertIntoStandardInput(context.element, context.selectionStart + queryLength, text, 2 + queryLength, cursorIndex);
          break;
        case 'googleSheets':
          this.insertIntoSheets(context.element, context.selectionStart, text, 2);
          break;
        case 'contentEditable': {
          // Extend the slashRange to also cover the search query typed after c/
          const extendedRange = context.slashRange.cloneRange();
          if (queryLength > 0) {
            try {
              // Move the end of the range forward by queryLength characters to cover the search query
              let remaining = queryLength;
              let node = extendedRange.endContainer;
              let offset = extendedRange.endOffset;

              while (remaining > 0 && node) {
                if (node.nodeType === Node.TEXT_NODE) {
                  const textLen = (node.textContent || '').length;
                  const available = textLen - offset;
                  if (available >= remaining) {
                    extendedRange.setEnd(node, offset + remaining);
                    remaining = 0;
                  } else {
                    remaining -= available;
                    offset = 0;
                    // Move to next text node
                    const walker = document.createTreeWalker(context.element, NodeFilter.SHOW_TEXT);
                    walker.currentNode = node;
                    const nextText = walker.nextNode();
                    if (nextText) {
                      node = nextText;
                    } else {
                      break;
                    }
                  }
                } else {
                  // Move into child text nodes
                  const walker = document.createTreeWalker(context.element, NodeFilter.SHOW_TEXT);
                  walker.currentNode = node;
                  const nextText = walker.nextNode();
                  if (nextText) {
                    node = nextText;
                    offset = 0;
                  } else {
                    break;
                  }
                }
              }
            } catch (e) {
              // If extending fails, fall back to original range (at least c/ will be replaced)
              console.warn('[SlashNotes] Failed to extend range for search query removal', e);
            }
          }
          this.insertIntoContentEditable(context.element, extendedRange, text, html);
          break;
        }
        case 'googleDocs':
          this.insertIntoGoogleDocs(context.iframe, context.caretRange, text, html, 2);
          break;
        default:
          break;
      }
    };

    // If there are custom variables, show the inline modal first
    if (interactiveVariables.length > 0 && (context.type === 'input' || context.type === 'contentEditable')) {
      const element = context.type === 'input' ? context.element : context.element;
      this.showInlineVariablesModal(element, interactiveVariables, textToInsert, htmlToInsert, (finalText, finalHtml) => {
        performInsertion(finalText, finalHtml, cursorOffset);
        this.finalizeCursor(element);
      });
    } else {
      performInsertion(textToInsert, htmlToInsert, cursorOffset);
      if (context.type === 'input' || context.type === 'contentEditable') {
        const element = context.type === 'input' ? context.element : context.element;
        this.finalizeCursor(element);
      }
    }
  }

  private showInlineVariablesModal(
    element: HTMLElement,
    variables: Array<string | FieldNode>,
    rawText: string,
    rawHtml: string,
    onComplete: (finalText: string, finalHtml: string) => void
  ) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '2147483646',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: '#1a1f2e', border: '1px solid #2d3548', borderRadius: '14px',
      padding: '24px 24px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      width: '460px', maxWidth: '92vw', maxHeight: '80vh',
      display: 'flex', flexDirection: 'column', gap: '0',
      overflowY: 'auto'
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, { marginBottom: '16px' });
    const title = document.createElement('div');
    title.textContent = 'Fill in the Blanks';
    Object.assign(title.style, { color: '#f1f5f9', fontSize: '16px', fontWeight: '600', letterSpacing: '-0.01em' });
    header.appendChild(title);
    modal.appendChild(header);

    // Deduplicate variables & exclude clipboard and date types
    const seen = new Set<string>();
    const uniqueVariables: Array<string | FieldNode> = [];
    variables.forEach(v => {
      // Exclude special resolved fields (clipboard, date) from being treated as variables
      if (typeof v !== 'string' && (v.fieldType === 'clipboard' || v.fieldType === 'date')) {
        return;
      }
      const key = typeof v === 'string' ? v : ((v.config as any)?.label || v.alias || v.id);
      const lower = key.toLowerCase();
      if (lower === 'clipboard' || lower === 'date') {
        return;
      }
      if (!seen.has(key)) { seen.add(key); uniqueVariables.push(v); }
    });
    const elementsMap = new Map<string, { getValue: () => string }>();
    let firstInput: HTMLElement | null = null;

    // Body: The text flows naturally like a document with inline elements
    const bodyWrapper = document.createElement('div');
    Object.assign(bodyWrapper.style, {
      color: '#e2e8f0', fontSize: '14px', lineHeight: '1.7',
      backgroundColor: '#0f1420', border: '1px solid #2d3548', borderRadius: '8px',
      padding: '16px', marginBottom: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
    });

    // We split rawText by variable placeholders to build the inline structure
    let currentText = rawText;
    // Exclude clipboard and date types from sortedKeys to prevent rendering as input in text splits
    const sortedKeys = uniqueVariables
      .filter(v => {
        if (typeof v === 'string') {
          const lower = v.toLowerCase();
          return lower !== 'clipboard' && lower !== 'date';
        }
        return v.fieldType !== 'clipboard' && v.fieldType !== 'date';
      })
      .map(v => {
        const key = typeof v === 'string' ? v : ((v.config as any)?.label || v.alias || v.id);
        return { key, node: typeof v === 'string' ? null : v };
      });
    // Build the inline text element sequence
    const renderInlineElements = () => {
      // Find matches for any variable key format {{key}}
      // We will match the placeholders in order of their appearance in the text
      const regexParts: string[] = [];
      sortedKeys.forEach(({ key }) => {
        regexParts.push(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`);
      });

      // Filter out the cursor marker from the preview text so the user does not see it
      const previewText = rawText.replace(/\u200B__CURSOR__\u200B/g, '').replace(/__CURSOR__/g, '');
      if (regexParts.length === 0) {
        bodyWrapper.textContent = previewText;
        return;
      }

      const combinedRegex = new RegExp(`(${regexParts.join('|')})`, 'g');
      const parts = previewText.split(combinedRegex);

      parts.forEach(part => {
        // Check if this part matches one of our variable keys
        const matchedVar = sortedKeys.find(({ key }) => {
          const re = new RegExp(`^\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}$`);
          return re.test(part);
        });

        if (matchedVar) {
          const { key, node } = matchedVar;
          const fieldType = node?.fieldType || 'text';
          if (fieldType === 'dropdown') {
            const select = document.createElement('select');
            Object.assign(select.style, {
              display: 'inline-block', padding: '4px 26px 4px 10px', margin: '0 4px',
              backgroundColor: '#1e2538', border: '1px solid #3b455c', borderRadius: '6px',
              color: '#f1f5f9', fontSize: '13px', outline: 'none', cursor: 'pointer',
              verticalAlign: 'baseline', appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23B89DF5\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            });
            const opts = (node!.config as any)?.options || [];
            opts.forEach((opt: string) => {
              const o = document.createElement('option');
              o.value = opt; o.textContent = opt;
              select.appendChild(o);
            });
            select.addEventListener('focus', () => { select.style.borderColor = '#B89DF5'; select.style.boxShadow = '0 0 0 2px rgba(184,157,245,0.25)'; });
            select.addEventListener('blur', () => { select.style.borderColor = '#3b455c'; select.style.boxShadow = 'none'; });
            bodyWrapper.appendChild(select);
            elementsMap.set(key, { getValue: () => select.value });
            if (!firstInput) firstInput = select;

          } else if (fieldType === 'toggle') {
            const cfg = (node!.config as any) || {};
            const trueLabel = cfg.trueLabel || 'Yes';
            const falseLabel = cfg.falseLabel || 'No';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.defaultChecked = cfg.defaultValue === true;
            Object.assign(checkbox.style, {
              display: 'inline-block', margin: '0 6px', width: '16px', height: '16px',
              accentColor: '#B89DF5', cursor: 'pointer', verticalAlign: 'middle'
            });
            bodyWrapper.appendChild(checkbox);
            elementsMap.set(key, { getValue: () => checkbox.checked ? trueLabel : falseLabel });
            if (!firstInput) firstInput = checkbox;

          } else {
            // Text blank
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = key.toLowerCase();
            Object.assign(input.style, {
              display: 'inline-block', padding: '4px 10px', margin: '0 4px',
              backgroundColor: '#1e2538', border: '1px solid #3b455c', borderRadius: '6px',
              color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100px',
              verticalAlign: 'baseline', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            });
            input.addEventListener('focus', () => { input.style.borderColor = '#B89DF5'; input.style.boxShadow = '0 0 0 2px rgba(184,157,245,0.25)'; });
            input.addEventListener('blur', () => { input.style.borderColor = '#3b455c'; input.style.boxShadow = 'none'; });
            bodyWrapper.appendChild(input);
            elementsMap.set(key, { getValue: () => input.value });
            if (!firstInput) firstInput = input;
          }
        } else {
          // Regular text
          bodyWrapper.appendChild(document.createTextNode(part));
        }
      });
    };

    renderInlineElements();
    modal.appendChild(bodyWrapper);

    // Buttons
    const buttons = document.createElement('div');
    Object.assign(buttons.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '8px 16px', border: '1px solid #2d3548', borderRadius: '6px',
      backgroundColor: 'transparent', color: '#94a3b8',
      cursor: 'pointer', fontSize: '13px', fontWeight: '500'
    });
    cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.backgroundColor = '#1e2635'; cancelBtn.style.color = '#e2e8f0'; });
    cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.backgroundColor = 'transparent'; cancelBtn.style.color = '#94a3b8'; });

    const insertBtn = document.createElement('button');
    insertBtn.textContent = 'Insert';
    Object.assign(insertBtn.style, {
      padding: '8px 18px', border: 'none', borderRadius: '6px',
      background: 'linear-gradient(135deg, #B89DF5 0%, #9b73f0 100%)',
      color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
      boxShadow: '0 2px 10px rgba(184,157,245,0.2)'
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(insertBtn);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (firstInput) setTimeout(() => (firstInput as HTMLElement).focus(), 50);
    else setTimeout(() => insertBtn.focus(), 50);

    const doInsert = () => {
      let finalText = rawText;
      let finalHtml = rawHtml;
      elementsMap.forEach((data, varKey) => {
        const val = data.getValue();
        const re = new RegExp(`\\{\\{\\s*${varKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
        finalText = finalText.replace(re, val);
        finalHtml = finalHtml.replace(re, val);
      });
      overlay.remove();
      onComplete(finalText, finalHtml);
    };

    const doCancel = () => overlay.remove();

    insertBtn.addEventListener('click', doInsert);
    cancelBtn.addEventListener('click', doCancel);
    overlay.addEventListener('click', e => { if (e.target === overlay) doCancel(); });

    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
      else if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); doInsert();
      }
    });
  }

  private finalizeCursor(element: HTMLElement) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const idx = element.value.indexOf('\u200B__CURSOR__\u200B');
      if (idx !== -1) {
        element.value = element.value.replace('\u200B__CURSOR__\u200B', '');
        element.setSelectionRange(idx, idx);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (element.isContentEditable) {
      // Robust TreeWalker to find the zero-width cursor marker in text nodes
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeValue && node.nodeValue.includes('\u200B__CURSOR__\u200B')) {
          const idx = node.nodeValue.indexOf('\u200B__CURSOR__\u200B');
          node.nodeValue = node.nodeValue.replace('\u200B__CURSOR__\u200B', '');
          
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          break;
        }
        node = walker.nextNode();
      }
    }
  }

  private insertIntoStandardInput(
    element: HTMLInputElement | HTMLTextAreaElement,
    selectionStart: number,
    text: string,
    deleteCount: number,
    cursorOffset?: number
  ) {
    const start = Math.max(0, selectionStart - deleteCount);
    const before = element.value.slice(0, start);
    const after = element.value.slice(selectionStart);
    const nextValue = `${before}${text}${after}`;
    element.value = nextValue;

    const cursor = cursorOffset !== undefined ? before.length + cursorOffset : before.length + text.length;
    element.setSelectionRange(cursor, cursor);
    dispatchInputEvents(element);
  }

  private insertIntoSheets(
    element: HTMLInputElement | HTMLTextAreaElement,
    selectionStart: number,
    text: string,
    deleteCount: number,
  ) {
    element.focus();
    const start = Math.max(0, selectionStart - deleteCount);
    element.setSelectionRange(start, selectionStart);
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      this.insertIntoStandardInput(element, selectionStart, text, deleteCount);
    }
  }

  private insertIntoContentEditable(element: HTMLElement, slashRange: Range, text: string, html: string = text) {
    element.focus();
    const selection = window.getSelection();
    if (!selection) return;

    try {
      // Method 1: Use execCommand('insertHTML') which handles formatting correctly
      // First, select the range we want to replace
      selection.removeAllRanges();
      selection.addRange(slashRange);

      // Attempt to use execCommand which simulates user typing/pasting
      // This is deprecated but still the most reliable way to interact with complex editors like Gmail/Docs
      const success =
        document.execCommand('insertHTML', false, html) || document.execCommand('insertText', false, text);

      if (success) {
        return;
      }
    } catch (e) {
      console.warn('[SlashNotes] execCommand failed, falling back to manual insertion', e);
    }

    // Fallback: Manual insertion if execCommand fails
    // This is less ideal because it might not trigger editor's internal state updates
    selection.removeAllRanges();
    selection.addRange(slashRange);
    slashRange.deleteContents();

    // Check if text has newlines
    if (text.includes('\n')) {
      const fragment = document.createDocumentFragment();
      const lines = text.split('\n');

      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        if (line) {
          fragment.appendChild(document.createTextNode(line));
        }
      });

      const insertRange = slashRange.cloneRange();
      insertRange.insertNode(fragment);

      // Update cursor position
      selection.removeAllRanges();
      const collapseRange = document.createRange();
      collapseRange.setStartAfter(fragment.lastChild || fragment);
      collapseRange.collapse(true);
      selection.addRange(collapseRange);
    } else {
      const textNode = document.createTextNode(text);
      const insertRange = slashRange.cloneRange();
      insertRange.insertNode(textNode);

      selection.removeAllRanges();
      const collapseRange = document.createRange();
      collapseRange.setStart(textNode, textNode.length);
      collapseRange.collapse(true);
      selection.addRange(collapseRange);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private async insertIntoGoogleDocs(
    iframe: HTMLIFrameElement,
    _caretRange: Range,
    text: string,
    html: string = text,
    deleteCount: number = 0,
  ) {
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) return;

      if (!this.injectedDocsIframes.has(iframe)) {
        const script = doc.createElement('script');
        script.src = chrome.runtime.getURL('content/injected.js');
        script.onload = () => {
          script.remove();
        };
        (doc.head || doc.documentElement).appendChild(script);
        this.injectedDocsIframes.add(iframe);
      }

      // Send message to the iframe's window to trigger the insertion
      win.postMessage({ type: 'TASKLABS_INSERT_TEXT', text, html, deleteCount }, '*');
    } catch (error) {
      console.warn('[SlashNotes] Failed to insert into Google Docs:', error);
    }
  }

  private attachShadowStyles() {
    if (!this.shadowRoot) return;
    if (this.shadowRoot.querySelector('style[data-slash-notes]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-slash-notes', 'true');
    style.textContent = `
      :host {
        all: initial;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #374151;
      }

      * {
        box-sizing: border-box;
      }

      .popup-container {
        position: fixed;
        width: 320px;
        max-height: 320px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        box-shadow: 
          0 4px 6px -1px rgba(0, 0, 0, 0.1), 
          0 2px 4px -1px rgba(0, 0, 0, 0.06),
          0 20px 25px -5px rgba(0, 0, 0, 0.1), 
          0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: fadeIn 0.15s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .popup-header {
        padding: 4px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        background: rgba(255, 255, 255, 0.5);
      }

      .popup-input {
        width: 100%;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        font-size: 13px;
        color: #111827;
        outline: none;
        transition: all 0.2s;
      }

      .popup-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
      }

      .popup-list {
        overflow-y: auto;
        padding: 6px;
        max-height: 240px;
      }

      .note-item {
        width: 100%;
        text-align: left;
        padding: 5px 6px;
        border-radius: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        flex-direction: column;
        gap: 2px;
        color: #374151;
      }

      .note-item:hover, .note-item.active {
        background: #f3f4f6;
      }

      .note-item.active {
        background: #e5e7eb;
        color: #111827;
      }

      .note-title {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .note-preview {
        font-size: 11px;
        color: #6b7280;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        opacity: 0.8;
      }

      .note-tags {
        display: flex;
        gap: 4px;
        margin-top: 4px;
      }

      .note-tag {
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 99px;
        background: #e5e7eb;
        color: #4b5563;
        font-weight: 500;
        text-transform: uppercase;
      }

      .popup-footer {
        padding: 4px 8px;
        background: #f9fafb;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
        color: #9ca3af;
      }

      .shortcut {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .kbd {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 1px 4px;
        font-family: monospace;
        font-weight: 600;
        color: #6b7280;
      }

      .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
      }

      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }

      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.3);
        border-radius: 99px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(156, 163, 175, 0.5);
      }


      .menu-trigger {
        opacity: 0;
        transition: opacity 0.2s;
        background: transparent;
        border: none;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        color: #9ca3af;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .note-item:hover .menu-trigger,
      .menu-trigger.active {
        opacity: 1;
      }

      .menu-trigger:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #4b5563;
      }
    `;

    this.shadowRoot.appendChild(style);
  }
}

// ============================================
// Global Hotkey Controller
// ============================================
// Enables hotkeys to work on any website, not just the new tab page.
// Listens for key combinations and sends messages to background script to open links.

class GlobalHotkeyController {
  private commandHotkeys: Record<string, string> = {};
  private linkHotkeys: Record<string, string> = {};
  private noteHotkeys: Record<string, string> = {};
  private moduleHotkeys: Record<string, string> = {};
  private isLoading = false;

  constructor() {
    this.loadHotkeys();
    this.setupStorageListener();
    this.setupKeydownListener();
  }

  private async loadHotkeys(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const result = await chrome.storage.local.get([
        'alts_link_hotkeys',
        'alts_note_hotkeys',
        'alts_command_hotkeys',
        'alts_module_hotkeys',
        'alts_commands',
        'alts_local_command_customizations',
      ]);

      this.linkHotkeys = result.alts_link_hotkeys || {};
      this.noteHotkeys = result.alts_note_hotkeys || {};
      this.moduleHotkeys = result.alts_module_hotkeys || {};

      const mergedCommandHotkeys: Record<string, string> = {
        ...(result.alts_command_hotkeys || {}),
      };

      const altsCommands = result.alts_commands || [];
      if (Array.isArray(altsCommands)) {
        altsCommands.forEach((cmd: any) => {
          if (cmd?.id && cmd?.hotkey) {
            mergedCommandHotkeys[cmd.id] = cmd.hotkey;
          }
        });
      }

      const localCustoms = result.alts_local_command_customizations || {};
      Object.entries(localCustoms).forEach(([id, data]: [string, any]) => {
        if (data?.hotkey) {
          mergedCommandHotkeys[id] = data.hotkey;
        }
      });

      this.commandHotkeys = mergedCommandHotkeys;

      const count =
        Object.keys(this.linkHotkeys).length +
        Object.keys(this.noteHotkeys).length +
        Object.keys(this.commandHotkeys).length +
        Object.keys(this.moduleHotkeys).length;
      if (count > 0) {
      }
    } catch (error) {
      console.error('[GlobalHotkey] Failed to load hotkeys:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private buildHotkeyFromEvent(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    let keyName = event.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();
    else if (keyName === 'ArrowUp') keyName = '↑';
    else if (keyName === 'ArrowDown') keyName = '↓';
    else if (keyName === 'ArrowLeft') keyName = '←';
    else if (keyName === 'ArrowRight') keyName = '→';

    parts.push(keyName);
    return parts.join('+');
  }

  private normalizeHotkey(value: string): string {
    if (!value) return '';
    const parts = value
      .split('+')
      .map(part => part.trim())
      .filter(Boolean);

    let key = '';
    const mods = new Set<string>();
    for (const part of parts) {
      const upper = part.toUpperCase();
      if (upper === 'CTRL' || upper === 'CONTROL') mods.add('Ctrl');
      else if (upper === 'ALT' || upper === 'OPTION') mods.add('Alt');
      else if (upper === 'SHIFT') mods.add('Shift');
      else if (upper === 'META' || upper === 'CMD' || upper === 'COMMAND') mods.add('Meta');
      else key = part.length === 1 ? part.toUpperCase() : part;
    }

    const ordered = ['Ctrl', 'Alt', 'Shift', 'Meta'].filter(mod => mods.has(mod));
    if (key) ordered.push(key);
    return ordered.join('+');
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (
          changes.alts_link_hotkeys ||
          changes.alts_note_hotkeys ||
          changes.alts_command_hotkeys ||
          changes.alts_module_hotkeys ||
          changes.alts_commands ||
          changes.alts_local_command_customizations
        ) {
          void this.loadHotkeys();
        }
      }
    });
  }

  private setupKeydownListener(): void {
    window.addEventListener(
      'keydown',
      (event: any) => {
        // IGNORE AUTOMATION EVENTS: Prevent extension hotkeys from triggering during automation
        // We check both the event property and the global window flag for maximum reliability
        if (event.isAutomation || (window as any).__tasklabs_automation_active) {
          return;
        }

        if (!event.altKey && !event.ctrlKey && !event.metaKey) return;
        if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(event.key)) return;

        const pressedHotkey = this.normalizeHotkey(this.buildHotkeyFromEvent(event));

        // Match Command
        const matchedCommand = Object.entries(this.commandHotkeys).find(
          ([, hk]) => this.normalizeHotkey(String(hk)) === pressedHotkey,
        );
        if (matchedCommand) {
          this.triggerHotkey('command', matchedCommand[0], event);
          return;
        }

        // Match Module
        const matchedModule = Object.entries(this.moduleHotkeys).find(
          ([, hk]) => this.normalizeHotkey(String(hk)) === pressedHotkey,
        );
        if (matchedModule) {
          this.triggerHotkey('module', matchedModule[0], event);
          return;
        }

        // Match Link
        const matchedLink = Object.entries(this.linkHotkeys).find(
          ([, hk]) => this.normalizeHotkey(String(hk)) === pressedHotkey,
        );
        if (matchedLink) {
          this.triggerHotkey('link', matchedLink[0], event);
          return;
        }

        // Match Note
        const matchedNote = Object.entries(this.noteHotkeys).find(
          ([, hk]) => this.normalizeHotkey(String(hk)) === pressedHotkey,
        );
        if (matchedNote) {
          this.triggerHotkey('note', matchedNote[0], event);
          return;
        }
      },
      true,
    );
  }

  private triggerHotkey(type: 'command' | 'link' | 'note' | 'module', id: string, event: KeyboardEvent) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    chrome.runtime.sendMessage({
      action: 'trigger_hotkey',
      type,
      id,
    });
  }
}

new SlashNotesController();

// Initialize global hotkey controller

new GlobalHotkeyController();

// Initialize image downloader

new ImageDownloader();

/**
 * Visual Element Picker for Automation
 *
 * Robust selector generation — NO CDP debugger needed for selection.
 * Uses content-script introspection with uniqueness validation.
 * CDP is only used during automation execution.
 */
class ElementPicker {
  private active = false;
  private overlay: HTMLDivElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;
  private hoveredElement: HTMLElement | null = null;
  private isReadyForCapture = false;
  private discoveredElements: HTMLElement[] = [];
  private labelsContainer: HTMLDivElement | null = null;
  private inputBuffer = '';
  private inputTimeout: any = null;
  private labelColors = ['#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#a78bfa', '#fb7185'];
  private recordingType: 'click' | 'paste' | null = null;

  start() {
    if (this.active) return;
    this.active = true;
    this.isReadyForCapture = false;

    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    document.addEventListener('click', this.handleClick, true);
    window.addEventListener('scroll', this.handleScroll, true);
    window.addEventListener('resize', this.handleResize, true);

    this.createOverlay();
    // this.createHighlightOverlay(); // Disable mouse-following highlight to reduce clutter

    // Fetch recording type from storage
    chrome.storage.local.get('automation_recording_state', res => {
      this.recordingType = res.automation_recording_state?.type || 'click';
      this.discoverElements();
      this.updateOverlayInstructions();
    });
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('scroll', this.handleScroll, true);
    window.removeEventListener('resize', this.handleResize, true);
    this.hoveredElement = null;
    this.removeOverlay();
    this.removeHighlightOverlay();
    this.clearLabels();
    this.inputBuffer = '';
    if (this.inputTimeout) clearTimeout(this.inputTimeout);
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.isReadyForCapture = true;
  };

  private handleScroll = () => {
    this.updateLabelPositions();
  };

  private handleResize = () => {
    this.discoverElements();
  };

  private clearLabels() {
    if (this.labelsContainer) {
      this.labelsContainer.remove();
      this.labelsContainer = null;
    }
  }

  private discoverElements() {
    this.clearLabels();
    this.discoveredElements = [];

    let selector = '';
    if (this.recordingType === 'paste') {
      // Filter for typeable areas: inputs, textareas, contenteditables
      const typeableTags = [
        'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"])',
        'textarea',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '[role="combobox"]',
      ];
      selector = typeableTags.join(',');
    } else {
      // Default: all interactive elements
      const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'label', 'summary', 'details'];
      const interactiveRoles = [
        'button',
        'link',
        'textbox',
        'combobox',
        'option',
        'menuitem',
        'tab',
        'checkbox',
        'radio',
      ];
      selector = interactiveTags.join(',') + ',' + interactiveRoles.map(r => `[role="${r}"]`).join(',');
    }

    const potentials = document.querySelectorAll(selector);

    const visibleResults: HTMLElement[] = [];
    potentials.forEach(el => {
      const htmlEl = el as HTMLElement;
      // Skip our own interface
      if (this.overlay?.contains(htmlEl) || this.labelsContainer?.contains(htmlEl)) return;

      const rect = htmlEl.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      ) {
        // Final check for visibility
        const style = window.getComputedStyle(htmlEl);
        if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1) {
          visibleResults.push(htmlEl);
        }
      }
    });

    // Sort: top to bottom, then left to right
    this.discoveredElements = visibleResults
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) < 10) return ra.left - rb.left;
        return ra.top - rb.top;
      })
      .slice(0, 99); // Limit to 99 elements for multi-digit sanity

    this.renderLabels();
  }

  private renderLabels() {
    this.labelsContainer = document.createElement('div');
    this.labelsContainer.id = 'tasklabs-labels-container';
    Object.assign(this.labelsContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483645',
    });
    document.body.appendChild(this.labelsContainer);

    this.discoveredElements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const label = document.createElement('div');
      const color = this.labelColors[i % this.labelColors.length];

      label.className = 'tasklabs-element-label';
      label.dataset.index = (i + 1).toString();
      Object.assign(label.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        padding: '2px 4px',
        backgroundColor: color,
        color: 'black',
        borderRadius: '5px',
        fontSize: '11px',
        lineHeight: '1',
        fontWeight: '900',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        zIndex: '2147483646',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '18px',
        border: '1px solid rgba(0,0,0,0.2)',
        pointerEvents: 'auto', // Allow clicking the label
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
      });
      label.textContent = (i + 1).toString();
      label.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.selectElement(el);
      };
      this.labelsContainer?.appendChild(label);

      // Add a border around the interactive element as well
      const border = document.createElement('div');
      border.className = 'tasklabs-element-border';
      border.dataset.index = (i + 1).toString();
      Object.assign(border.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}0D`, // Very light overlay (~5% opacity)
        borderRadius: '5px',
        zIndex: '2147483645',
        pointerEvents: 'none',
        transition: 'transform 0.1s, border-width 0.1s, box-shadow 0.1s',
      });
      this.labelsContainer?.appendChild(border);
    });
  }

  private updateLabelPositions() {
    if (!this.labelsContainer) return;
    const labels = this.labelsContainer.querySelectorAll('.tasklabs-element-label');
    labels.forEach(l => {
      const label = l as HTMLDivElement;
      const idx = parseInt(label.dataset.index || '1', 10);
      const el = this.discoveredElements[idx - 1];
      if (el) {
        const rect = el.getBoundingClientRect();
        // Check if still visible
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          label.style.top = `${rect.top}px`;
          label.style.left = `${rect.left}px`;
          label.style.display = 'flex';
        } else {
          label.style.display = 'none';
        }
      }
    });

    const borders = this.labelsContainer.querySelectorAll('.tasklabs-element-border');
    borders.forEach(b => {
      const border = b as HTMLDivElement;
      const idx = parseInt(border.dataset.index || '1', 10);
      const el = this.discoveredElements[idx - 1];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          Object.assign(border.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            display: 'block',
          });
        } else {
          border.style.display = 'none';
        }
      }
    });
  }

  private createOverlay() {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      padding: '16px 24px',
      backgroundColor: '#1f2937',
      color: 'white',
      borderRadius: '12px',
      zIndex: '2147483647',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
      border: '1px solid #374151',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      animation: 'tasklabs-slide-up 0.3s ease-out',
    });

    const style = document.createElement('style');
    style.id = 'tasklabs-picker-styles';
    style.textContent = `
      @keyframes tasklabs-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes tasklabs-pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    this.updateOverlayInstructions();
    document.body.appendChild(this.overlay);
  }

  private updateOverlayInstructions() {
    if (!this.overlay) return;
    const bufferText = this.inputBuffer
      ? `<div style="color: #fbbf24; font-weight: 800; font-family: monospace; font-size: 18px; margin-top: 4px;">Selecting: ${this.inputBuffer}_</div>`
      : '';

    const actionText =
      this.recordingType === 'paste' ? 'Select a <b>Text Field</b> to Paste' : 'Select an <b>Element</b> to Click';

    this.overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; animation: tasklabs-pulse 1.5s infinite;"></div>
        <div>${actionText}.</div>
      </div>
      <div>Type <b>Number</b> or <b>Click</b> the target.</div>
      <div>Press <span style="background: #374151; padding: 2px 6px; border-radius: 4px; font-family: monospace;">Esc</span> to cancel.</div>
      ${bufferText}
    `;
  }

  private createHighlightOverlay() {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'tasklabs-picker-highlight';
    Object.assign(this.highlightOverlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: '2px solid #8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
      borderRadius: '4px',
      zIndex: '2147483646',
      transition: 'top 0.05s, left 0.05s, width 0.05s, height 0.05s',
      display: 'none',
    });
    document.body.appendChild(this.highlightOverlay);
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    const style = document.getElementById('tasklabs-picker-styles');
    if (style) style.remove();
  }

  private removeHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }

  /**
   * Use mousemove instead of mouseover for more reliable element detection.
   * mouseover can be stopped by stopPropagation in the page's own handlers,
   * but mousemove with document.elementFromPoint bypasses that.
   */
  private handleMouseMove = (e: MouseEvent) => {
    // Use elementFromPoint to get the actual element under the cursor,
    // bypassing any event.stopPropagation() the page might do.
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!target) return;
    if (target === this.overlay || this.overlay?.contains(target)) return;
    if (target === this.highlightOverlay) return;
    if (target === this.hoveredElement) return;

    this.hoveredElement = target;

    // Mouse-following highlight is disabled in hint mode to prevent clutter
    /*
    if (this.highlightOverlay) {
      const resolved = this.getInteractiveParent(target);
      const rect = resolved.getBoundingClientRect();
      Object.assign(this.highlightOverlay.style, {
        display: 'block',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
    */
  };

  private getElementName(el: HTMLElement): string {
    // 1. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // 2. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent) return labelEl.textContent.trim();
    }

    // 3. Associated <label> via for/id
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }

    // 4. Wrapping <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, textarea, select').forEach(c => c.remove());
      const text = clone.textContent?.trim();
      if (text) return text;
    }

    // 5. name attribute
    const nameAttr = el.getAttribute('name');
    if (nameAttr) return nameAttr;

    // 6. placeholder / editor placeholder
    const placeholder =
      el.getAttribute('placeholder') ||
      el.getAttribute('data-empty-text') ||
      el.getAttribute('data-placeholder') ||
      el.getAttribute('aria-placeholder');
    if (placeholder) return placeholder;

    // 6b. contenteditable placeholder descendants (ProseMirror, Tiptap, Slate, Linear)
    if (
      el.isContentEditable ||
      el.getAttribute('contenteditable') === 'true' ||
      el.getAttribute('role') === 'textbox' ||
      el.getAttribute('role') === 'combobox'
    ) {
      const placeholderNode = el.querySelector?.(
        '[data-empty-text], [data-placeholder], [aria-placeholder], .editor-placeholder, [data-placeholder-text]',
      ) as HTMLElement | null;
      const derived =
        placeholderNode?.getAttribute('data-empty-text') ||
        placeholderNode?.getAttribute('data-placeholder') ||
        placeholderNode?.getAttribute('aria-placeholder') ||
        placeholderNode?.getAttribute('data-placeholder-text') ||
        placeholderNode?.textContent?.trim();
      if (derived) return derived;
    }

    // 7. title
    const titleAttr = el.getAttribute('title');
    if (titleAttr) return titleAttr;

    return '';
  }

  private selectElement(interactiveTarget: HTMLElement) {
    const pageUrl = window.location.href;
    this.stop();

    const selector = this.robustGetSelector(interactiveTarget);
    const elementName = this.getElementName(interactiveTarget);
    const nameFallback =
      interactiveTarget.innerText?.trim().split('\n')[0].substring(0, 40) ||
      (interactiveTarget as HTMLInputElement).placeholder ||
      interactiveTarget.getAttribute('data-empty-text') ||
      interactiveTarget.getAttribute('data-placeholder') ||
      interactiveTarget.getAttribute('aria-placeholder') ||
      interactiveTarget.title ||
      interactiveTarget.id ||
      interactiveTarget.tagName.toLowerCase();
    const name = elementName || nameFallback;
    chrome.storage.local.get('automation_recording_state', (res: any) => {
      const state = res.automation_recording_state;
      if (state?.active) {
        chrome.storage.local.set(
          {
            automation_recorded_selector: {
              stepId: state.stepId,
              selector: selector,
              pageUrl: pageUrl,
              elementName: elementName,
              url: window.location.href,
              name,
              iconHost: window.location.hostname,
              timestamp: Date.now(),
            },
            automation_recording_state: null,
          },
          () => {
          },
        );
      } else {
        console.warn('[ElementPicker] Capture failed: No active recording state found in storage.');
      }
    });
  }

  private handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!this.isReadyForCapture) {
      return;
    }

    // Use elementFromPoint for the most accurate target
    const rawTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    const target = rawTarget || (e.target as HTMLElement);
    const interactiveTarget = this.getInteractiveParent(target);
    this.selectElement(interactiveTarget);
  };

  private highlightMatchingLabels() {
    if (!this.labelsContainer) return;
    const labels = this.labelsContainer.querySelectorAll('.tasklabs-element-label');
    labels.forEach(l => {
      const label = l as HTMLDivElement;
      const idx = label.textContent || '';
      if (this.inputBuffer && idx === this.inputBuffer) {
        label.style.transform = 'scale(1.8)';
        label.style.boxShadow = '0 0 20px #fbbf24, 0 0 40px #fbbf24';
        label.style.zIndex = '2147483647';
        label.style.border = '2px solid white';
      } else if (this.inputBuffer && idx.startsWith(this.inputBuffer)) {
        label.style.transform = 'scale(1.3)';
        label.style.boxShadow = '0 0 10px rgba(255,255,255,0.8)';
        label.style.zIndex = '2147483647';
      } else {
        label.style.transform = 'scale(1)';
        label.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.2)';
        label.style.zIndex = '2147483646';
        label.style.border = '1px solid rgba(0,0,0,0.2)';
      }
    });

    const borders = this.labelsContainer.querySelectorAll('.tasklabs-element-border');
    borders.forEach(b => {
      const border = b as HTMLDivElement;
      const idx = border.dataset.index || '';
      if (this.inputBuffer && idx === this.inputBuffer) {
        border.style.borderWidth = '4px';
        border.style.boxShadow = '0 0 15px currentColor';
        border.style.zIndex = '2147483647';
        border.style.backgroundColor = 'rgba(255,255,255,0.1)';
      } else if (this.inputBuffer && idx.startsWith(this.inputBuffer)) {
        border.style.borderWidth = '3px';
        border.style.zIndex = '2147483647';
        border.style.backgroundColor = 'rgba(255,255,255,0.05)';
      } else {
        border.style.borderWidth = '2px';
        border.style.boxShadow = 'none';
        border.style.zIndex = '2147483645';
        border.style.backgroundColor = 'rgba(0,0,0,0.02)';
      }
    });
  }

  private processInputBuffer() {
    const idx = parseInt(this.inputBuffer, 10) - 1;
    if (idx >= 0 && idx < this.discoveredElements.length) {
      this.selectElement(this.discoveredElements[idx]);
    } else {
      this.inputBuffer = '';
      this.updateOverlayInstructions();
      this.highlightMatchingLabels();
    }
    if (this.inputTimeout) clearTimeout(this.inputTimeout);
    this.inputTimeout = null;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      chrome.storage.local.set({ automation_recording_state: null });
      this.stop();
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      if (this.inputTimeout) clearTimeout(this.inputTimeout);
      this.inputBuffer += e.key;
      this.updateOverlayInstructions();
      this.highlightMatchingLabels();

      // Check if this is a unique prefix
      const matches = this.discoveredElements.filter((_, i) => (i + 1).toString().startsWith(this.inputBuffer));
      if (matches.length === 1 && (this.discoveredElements.indexOf(matches[0]) + 1).toString() === this.inputBuffer) {
        // Only one possible match and it's an exact match -> select immediately
        this.processInputBuffer();
      } else if (matches.length === 0) {
        // No matches at all -> reset
        this.inputBuffer = '';
        this.updateOverlayInstructions();
        this.highlightMatchingLabels();
      } else {
        // Multiple possibilities (e.g. 2, 21, 22) -> wait for more input or Enter
        this.inputTimeout = setTimeout(() => {
          this.processInputBuffer();
        }, 1000);
      }
    } else if (e.key === 'Enter' && this.inputBuffer) {
      this.processInputBuffer();
    } else if (e.key === 'Backspace' && this.inputBuffer) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.updateOverlayInstructions();
      this.highlightMatchingLabels();
    }
  };

  // ── Interactive parent resolution ──────────────────────────────────────

  private getInteractiveParent(el: HTMLElement): HTMLElement {
    // Placeholder → editor snap
    const placeholderHint =
      el.getAttribute?.('data-empty-text') ||
      el.getAttribute?.('data-placeholder') ||
      el.getAttribute?.('aria-placeholder') ||
      el.getAttribute?.('data-placeholder-text') ||
      (el.classList && el.classList.contains('editor-placeholder'));

    if (placeholderHint) {
      const editor = el.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]') as HTMLElement | null;
      if (editor) return editor;
    }

    const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'DETAILS', 'LABEL']);
    const interactiveRoles = new Set([
      'button',
      'link',
      'textbox',
      'combobox',
      'option',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'tab',
      'switch',
      'checkbox',
      'radio',
      'slider',
      'spinbutton',
      'searchbox',
    ]);

    // Only walk up for leaf elements (icons, text spans, etc.)
    const leafTags = new Set([
      'SVG',
      'PATH',
      'CIRCLE',
      'RECT',
      'LINE',
      'POLYLINE',
      'POLYGON',
      'ELLIPSE',
      'G',
      'USE',
      'SPAN',
      'I',
      'EM',
      'STRONG',
      'B',
      'IMG',
      'SMALL',
      'SUB',
      'SUP',
      'BR',
      'WBR',
    ]);

    if (!leafTags.has(el.tagName) && !placeholderHint) {
      return el;
    }

    let current: HTMLElement | null = el;
    while (current && current.tagName !== 'BODY' && current !== document.documentElement) {
      if (
        interactiveTags.has(current.tagName) ||
        interactiveRoles.has(current.getAttribute('role') || '') ||
        current.isContentEditable ||
        current.getAttribute('contenteditable') === 'true' ||
        current.hasAttribute('tabindex') ||
        current.onclick ||
        current.hasAttribute('data-testid')
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }

  // ── Robust selector generator ──────────────────────────────────────────
  // This is the heart of the fix. Instead of building fragile CSS paths by
  // walking up the tree and appending tag.class:nth-child at every level,
  // we try attribute-based selectors first and validate uniqueness with
  // querySelectorAll. This is exactly what professional selector tools do.

  private cssEscape(s: string): string {
    if (!s) return '';
    return s.replace(/"/g, '\\"');
  }

  private isUnique(sel: string): boolean {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  }

  private isDynamicClass(c: string): boolean {
    if (!c || c.length === 0) return true;
    // CSS-modules / styled-components / emotion / linaria hashes
    if (/^(css|sc|jss|style|emotion|styled|__)-/i.test(c)) return true;
    // Pure hex/alphanum hashes (8+ chars of just letters/digits, no hyphens/underscores)
    if (/^[a-z0-9]{8,}$/i.test(c)) return true;
    // class_hash patterns like "class_abc12de"
    if (/^[a-z]+_[a-z0-9]{5,}$/i.test(c)) return true;
    // Utility with colons or brackets
    if (c.includes(':') || c.includes('[') || c.includes('\\')) return true;
    return false;
  }

  private isStateClass(c: string): boolean {
    const low = c.toLowerCase();
    const statePatterns = [
      /^is[-_]/,
      /^has[-_]/,
      /[-_](focus|hover|active|pressed|dragging|dropping)$/,
      /^(focused|hovered|activated|pressed|dragging|dropping|animating)$/,
    ];
    return statePatterns.some(p => p.test(low));
  }

  /** Try to build a short, unique selector from element attributes alone */
  private tryAttributeSelector(el: HTMLElement): string | null {
    const tag = el.tagName.toLowerCase();

    // 1. Test IDs & semantic data attributes (highest priority)
    const highPriAttrs = ['data-testid', 'data-cy', 'data-qa', 'data-test', 'data-automation-id', 'data-automation'];
    for (const attr of highPriAttrs) {
      const v = el.getAttribute(attr);
      if (v) {
        const sel = `[${attr}="${this.cssEscape(v)}"]`;
        if (this.isUnique(sel)) return sel;
        const tagSel = `${tag}${sel}`;
        if (this.isUnique(tagSel)) return tagSel;
      }
    }

    // 2. Stable ID
    if (el.id && !/^[a-f0-9]{8,}$/i.test(el.id) && !/^\d/.test(el.id) && !/^:/.test(el.id)) {
      const sel = `#${CSS.escape(el.id)}`;
      if (this.isUnique(sel)) return sel;
    }

    // 3. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      const sel = `[aria-label="${this.cssEscape(ariaLabel)}"]`;
      if (this.isUnique(sel)) return sel;
      const tagSel = `${tag}${sel}`;
      if (this.isUnique(tagSel)) return tagSel;
    }

    // 4. name attribute
    const name = el.getAttribute('name');
    if (name && !/^[0-9]/.test(name)) {
      const sel = `${tag}[name="${this.cssEscape(name)}"]`;
      if (this.isUnique(sel)) return sel;
    }

    // 5. placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      const sel = `${tag}[placeholder="${this.cssEscape(placeholder)}"]`;
      if (this.isUnique(sel)) return sel;
      const noTag = `[placeholder="${this.cssEscape(placeholder)}"]`;
      if (this.isUnique(noTag)) return noTag;
    }

    // 6. role + aria combo
    const role = el.getAttribute('role');
    if (role && ariaLabel) {
      const sel = `[role="${this.cssEscape(role)}"][aria-label="${this.cssEscape(ariaLabel)}"]`;
      if (this.isUnique(sel)) return sel;
    }

    // 7. input type
    const type = el.getAttribute('type');
    if (type && tag === 'input') {
      const sel = `input[type="${this.cssEscape(type)}"]`;
      if (this.isUnique(sel)) return sel;
    }

    // 8. contenteditable combos
    if (el.getAttribute('contenteditable') === 'true') {
      if (role) {
        const sel = `[role="${this.cssEscape(role)}"][contenteditable="true"]`;
        if (this.isUnique(sel)) return sel;
      }
      if (ariaLabel) {
        const sel = `[contenteditable="true"][aria-label="${this.cssEscape(ariaLabel)}"]`;
        if (this.isUnique(sel)) return sel;
      }
      const dp = el.getAttribute('data-placeholder');
      if (dp) {
        const sel = `[contenteditable="true"][data-placeholder="${this.cssEscape(dp)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    // 9. href for links
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('javascript:') && href !== '#') {
        const sel = `a[href="${this.cssEscape(href)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    // 10. label[for]
    if (tag === 'label') {
      const forAttr = el.getAttribute('for');
      if (forAttr) {
        const sel = `label[for="${this.cssEscape(forAttr)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    // 11. Custom data-* attributes (Linear, Notion, etc.)
    const allAttrs = Array.from(el.attributes || []);
    for (const attr of allAttrs) {
      if (attr.name.startsWith('data-') && !highPriAttrs.includes(attr.name)) {
        if (attr.value.length > 80) continue;
        if (/^\d+$/.test(attr.value)) continue;
        const sel = `[${attr.name}="${this.cssEscape(attr.value)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    return null;
  }

  /**
   * Build the robust selector for an element.
   * Uses attribute shortcuts with uniqueness checks to produce the shortest
   * unique selector possible — just like professional selector tools.
   */
  private robustGetSelector(el: HTMLElement): string {
    if (!el || el === document.body || el === document.documentElement) return '';
    if (el.tagName === 'BODY') return 'body';
    if (el.tagName === 'HTML') return 'html';

    // ── Fast path: attribute-only selector ──
    const shortcut = this.tryAttributeSelector(el);
    if (shortcut) return shortcut;

    // ── Build a segment for this element ──
    let segment = el.tagName.toLowerCase();

    // Add stable classes
    const stableClasses = Array.from(el.classList || []).filter(c => !this.isDynamicClass(c) && !this.isStateClass(c));

    if (stableClasses.length > 0) {
      const classStr = stableClasses
        .slice(0, 2)
        .map(c => '.' + CSS.escape(c))
        .join('');
      const candidate = segment + classStr;
      if (this.isUnique(candidate)) return candidate;
      segment = candidate;
    }

    // Add nth-child for disambiguation
    const parent = el.parentElement;
    if (parent) {
      const sameTags = Array.from(parent.children).filter(s => s.tagName === el.tagName);
      if (sameTags.length > 1) {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        segment += `:nth-child(${idx})`;
      }
    }

    if (this.isUnique(segment)) return segment;

    // ── Walk up: try parent attribute shortcut first ──
    if (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
      const parentShortcut = this.tryAttributeSelector(parent);
      if (parentShortcut) {
        const combined = `${parentShortcut} > ${segment}`;
        if (this.isUnique(combined)) return combined;
        const loose = `${parentShortcut} ${segment}`;
        if (this.isUnique(loose)) return loose;
      }

      // Try grandparent
      const grandparent = parent.parentElement;
      if (grandparent && grandparent.tagName !== 'BODY') {
        const gpShortcut = this.tryAttributeSelector(grandparent);
        if (gpShortcut) {
          // Build parent segment
          let parentSeg = parent.tagName.toLowerCase();
          const parentSameTags = Array.from(grandparent.children).filter(s => s.tagName === parent.tagName);
          if (parentSameTags.length > 1) {
            const pidx = Array.from(grandparent.children).indexOf(parent) + 1;
            parentSeg += `:nth-child(${pidx})`;
          }
          const combined = `${gpShortcut} > ${parentSeg} > ${segment}`;
          if (this.isUnique(combined)) return combined;
          const loose = `${gpShortcut} ${segment}`;
          if (this.isUnique(loose)) return loose;
        }
      }

      // Recurse up the full tree
      const parentPath = this.robustGetSelector(parent);
      if (parentPath) {
        return `${parentPath} > ${segment}`;
      }
    }

    return segment;
  }
}

const elementPicker = new ElementPicker();
// Listen for storage changes to trigger the element picker automatically
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.automation_recording_state?.newValue?.active) {
    const newState = changes.automation_recording_state.newValue;

    // Only trigger picker if explicitly in select_mode
    if (newState.select_mode !== true) {
      return;
    }
    if (newState.targetTabId && currentTabId && newState.targetTabId !== currentTabId) {
      return;
    }
    elementPicker.start();
  }
});
