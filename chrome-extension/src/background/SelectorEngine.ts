/* eslint-disable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────────────────────────────────────
// Robust Selector Engine — handles dynamic/stale selectors gracefully
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A SelectorFingerprint captures multiple stable signals for an element at
 * recording time. At playback time, each strategy is tried in priority order
 * so that even if the primary selector is stale, we still find the element.
 */
export interface SelectorFingerprint {
  /** Primary selector as captured (may be dynamic/fragile) */
  primary: string;
  /** Stable semantic alternatives derived at recording time */
  semantic: string[];
  /** Text content hint (for buttons, links, labels) */
  textContent?: string;
  /** Closest stable ancestor selector (used for scoped search) */
  ancestorSelector?: string;
  /** ARIA role of the element */
  role?: string;
  /** Element tag name */
  tagName?: string;
  /** Element type attribute (for inputs) */
  inputType?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selector Normalisation
// ─────────────────────────────────────────────────────────────────────────────

const DYNAMIC_CLASS_RE = /\.(css-[a-z0-9]+|[a-z0-9]{5,}_[a-z0-9]{4,}|sc-[a-z0-9]+|[a-z][a-z0-9]{3,}-[a-z0-9]{4,})/gi;

const DYNAMIC_ID_RE = /^#[a-z0-9]{8,}$/i;

/**
 * Returns true when a selector looks like it was auto-generated and is likely
 * to change between page versions / deployments.
 */
export const isDynamicSelector = (selector: string): boolean => {
  if (!selector) return false;
  // Hashed class names (Emotion, CSS Modules, Tailwind JIT, styled-components)
  if (DYNAMIC_CLASS_RE.test(selector)) return true;
  // Pure random-looking IDs
  if (DYNAMIC_ID_RE.test(selector)) return true;
  // nth-child / nth-of-type positional selectors with no semantic context
  if (/:nth-child\(\d+\)/.test(selector) && !/\[/.test(selector)) return true;
  // Placeholder-based selectors (often transient in editors like ProseMirror)
  if (/editor-placeholder|data-empty-text|data-placeholder|aria-placeholder/.test(selector)) return true;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// The deep querySelectorDeep helper (injected into page context)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared helper injected as a string into the page.
 * Pierces open shadow DOM boundaries.
 */
export const DEEP_QUERY_HELPER = /* js */ `
  const querySelectorDeep = (selector, root = document) => {
    if (!selector) return null;
    const parts = selector.split(' >>> ');
    let current = root;
    for (const part of parts) {
      if (!part.trim()) continue;
      const found = current.querySelector(part);
      if (found) {
        current = found.shadowRoot || found;
      } else {
        const findInShadows = (node) => {
          const el = node.querySelector(part);
          if (el) return el;
          for (const child of node.querySelectorAll('*')) {
            if (child.shadowRoot) {
              const hit = findInShadows(child.shadowRoot);
              if (hit) return hit;
            }
          }
          return null;
        };
        const hit = findInShadows(current);
        if (!hit) return null;
        current = hit.shadowRoot || hit;
      }
    }
    return current instanceof ShadowRoot ? null : current;
  };
`;

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint builder (runs in page context via chrome.scripting.executeScript)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call this at element-capture time to record all stable signals.
 * Inject via chrome.scripting.executeScript into the page.
 */
export const buildFingerprintInPage = (primarySelector: string): string => {
  // This string is evaluated in the page context
  return /* js */ `
    (function() {
      ${DEEP_QUERY_HELPER}
      const coercePlaceholder = (node) => {
        if (!node) return null;
        const placeholderText =
          node.getAttribute?.('data-empty-text') ||
          node.getAttribute?.('data-placeholder') ||
          node.getAttribute?.('aria-placeholder') ||
          '';
        const isPlaceholder =
          !!placeholderText || (node.classList && node.classList.contains('editor-placeholder'));
        if (!isPlaceholder) return node;
        return node.closest('[contenteditable="true"], [role="textbox"]') || node;
      };

      const original = querySelectorDeep(${JSON.stringify(primarySelector)});
      if (!original) return null;

      const placeholderText =
        original.getAttribute('data-empty-text') ||
        original.getAttribute('data-placeholder') ||
        original.getAttribute('aria-placeholder') ||
        '';
      const isPlaceholder =
        !!placeholderText ||
        (original.classList && original.classList.contains('editor-placeholder'));

      const el = isPlaceholder
        ? original.closest('[contenteditable="true"], [role="textbox"]') || original
        : original;

      const stable = [];

      // 1. Prefer data-testid / data-cy / data-qa (highest stability)
      for (const attr of [
        'data-testid',
        'data-cy',
        'data-qa',
        'data-id',
        'data-name',
        'data-empty-text',
        'data-placeholder',
        'aria-placeholder',
      ]) {
        const v = el.getAttribute(attr);
        if (v) stable.push(\`[\${attr}="\${v}"]\`);
      }

      if (placeholderText) {
        stable.push(\`[data-empty-text="\${placeholderText}"]\`);
        stable.push(\`[data-placeholder="\${placeholderText}"]\`);
        stable.push(\`[aria-placeholder="\${placeholderText}"]\`);
      }

      // 2. aria-label / aria-labelledby
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) stable.push(\`[aria-label="\${ariaLabel}"]\`);

      // 3. name / id (only when looks stable — non-numeric, non-hashed)
      const name = el.getAttribute('name');
      if (name && !/^[0-9]/.test(name)) stable.push(\`\${el.tagName.toLowerCase()}[name="\${name}"]\`);

      const id = el.id;
      if (id && !/^[a-z0-9]{8,}$/i.test(id) && !/^\\\\d/.test(id)) stable.push(\`#\${id}\`);

      // 4. placeholder for inputs
      const placeholder = el.getAttribute('placeholder');
      if (placeholder) stable.push(\`[placeholder="\${placeholder}"]\`);

      // 5. type + role combo for interactive elements
      const type = el.getAttribute('type');
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      if (type) stable.push(\`\${el.tagName.toLowerCase()}[type="\${type}"]\`);

      // 5b. contenteditable
      if (el.getAttribute('contenteditable') === 'true') {
        stable.push('[contenteditable="true"]');
      }

      // 5c. role attribute
      if (el.getAttribute('role')) {
        stable.push(\`[role="\${el.getAttribute('role')}"]\`);
      }

      // 6. Unique text-based selector for buttons/links (text must be ≤ 60 chars)
      const text = ((el.textContent || '').trim() || placeholderText || ariaLabel || placeholder || '')
        .trim()
        .slice(0, 60);
      const textBasedTag = el.tagName.toLowerCase();
      if (text && ['button', 'a', 'label'].includes(textBasedTag) && text.length < 60) {
        stable.push(\`__TEXT__:\${textBasedTag}:\${text}\`);
      }

      // 7. Stable ancestor: walk up to find the nearest ancestor with a
      //    data-* attribute or stable id so we can scope the search.
      let ancestor = el.parentElement;
      let ancestorSelector = null;
      while (ancestor && ancestor !== document.body) {
        for (const attr of ['data-testid', 'data-cy', 'data-qa', 'id']) {
          const v = ancestor.getAttribute(attr);
          if (v && attr === 'id' && !/^[a-z0-9]{8,}$/i.test(v)) {
            ancestorSelector = \`#\${v}\`;
            break;
          }
          if (v && attr !== 'id') {
            ancestorSelector = \`[\${attr}="\${v}"]\`;
            break;
          }
        }
        if (ancestorSelector) break;
        ancestor = ancestor.parentElement;
      }

      return {
        primary: ${JSON.stringify(primarySelector)},
        semantic: stable,
        textContent: text || undefined,
        ancestorSelector: ancestorSelector || undefined,
        role: role || undefined,
        tagName: el.tagName.toLowerCase(),
        inputType: type || undefined,
      };
    })()
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolution strategy (runs in page context)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a JS expression (to be evaluated via Runtime.evaluate) that
 * tries every strategy in the fingerprint and returns the first live element.
 *
 * Strategy priority:
 *   1. Primary selector (fast path when it still works)
 *   2. Semantic selectors (data-testid, aria-label, name, …)
 *   3. Text-content match (button / link with matching label)
 *   4. Scoped search inside the nearest stable ancestor
 */
export const buildResolverExpression = (fp: SelectorFingerprint): string => {
  const semanticLiterals = fp.semantic.map(s => JSON.stringify(s)).join(',');

  return /* js */ `
    (function() {
      ${DEEP_QUERY_HELPER}

      // ── 1. Primary selector ──────────────────────────────────────────────
      const primary = ${JSON.stringify(fp.primary)};
      let el = coercePlaceholder(querySelectorDeep(primary));
      if (el) return el;

      // ── 2. Semantic selectors ────────────────────────────────────────────
      const semantics = [${semanticLiterals}];
      for (const sel of semantics) {
        if (sel.startsWith('__TEXT__:')) {
          // handled in step 3
          continue;
        }
        const found = coercePlaceholder(querySelectorDeep(sel));
        if (found) return found;

        // Scoped inside ancestor
        ${
          fp.ancestorSelector
            ? `
        const ancestor = document.querySelector(${JSON.stringify(fp.ancestorSelector)});
        if (ancestor) {
          const scoped = coercePlaceholder(ancestor.querySelector(sel));
          if (scoped) return scoped;
        }
        `
            : ''
        }
      }

      // ── 3. Text-content match ────────────────────────────────────────────
      ${
        fp.textContent
          ? `
      const targetText = ${JSON.stringify(fp.textContent)}.trim().toLowerCase();
      const tag = ${JSON.stringify(fp.tagName || 'button')};
      const candidates = document.querySelectorAll(tag);
      for (const c of candidates) {
        if ((c.textContent || '').trim().toLowerCase() === targetText) return coercePlaceholder(c);
      }
      // Partial match fallback
      for (const c of candidates) {
        if ((c.textContent || '').trim().toLowerCase().includes(targetText)) return coercePlaceholder(c);
      }
      `
          : ''
      }

      // ── 4. Scoped semantic search inside ancestor ─────────────────────────
      ${
        fp.ancestorSelector && fp.tagName
          ? `
      const scopeRoot = document.querySelector(${JSON.stringify(fp.ancestorSelector)});
      if (scopeRoot) {
        const tagCandidates = scopeRoot.querySelectorAll(${JSON.stringify(fp.tagName)});
        ${
          fp.inputType
            ? `
        for (const c of tagCandidates) {
          if (c.getAttribute('type') === ${JSON.stringify(fp.inputType)}) return coercePlaceholder(c);
        }
        `
            : `if (tagCandidates.length === 1) return coercePlaceholder(tagCandidates[0]);`
        }
      }
      `
          : ''
      }

      return null;
    })()
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// Upgraded ModuleAction with fingerprint support
// ─────────────────────────────────────────────────────────────────────────────

export interface ExpectedOutcome {
  type: 'url_change' | 'element_appear' | 'element_disappear' | 'text_present';
  /** Selector for element_appear/element_disappear */
  selector?: string;
  /** Substring for url_change or text_present */
  text?: string;
  /** Custom timeout for this specific validation */
  timeout_ms?: number;
}

export interface RobustModuleAction {
  action: string;
  selector?: string;
  /** Replaces / augments selector when element may be dynamic */
  selectorFingerprint?: SelectorFingerprint;
  fallback_selectors?: string[];
  value?: string;
  key?: string;
  modifiers?: number;
  timeout_ms?: number;
  ms?: number;
  method?: string;
  condition?: string;
  description?: string;
  code?: string;
  variable_name?: string;
  desired_state?: boolean;
  url?: string;
  /** PHASE 6: Expected state change after action execution */
  expectedOutcome?: ExpectedOutcome;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core helper: resolve element with full fallback chain + retry loop
// ─────────────────────────────────────────────────────────────────────────────

class AutomationStoppedError extends Error {
  constructor() {
    super('Automation stopped by user');
    this.name = 'AutomationStoppedError';
  }
}

const smartWait = async (ms: number) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const res = await chrome.storage.local.get(['stop_automation_requested']);
    if (res.stop_automation_requested) {
      throw new AutomationStoppedError();
    }
    await new Promise(r => setTimeout(r, 100));
  }
};

const checkStop = async () => {
  const res = await chrome.storage.local.get(['stop_automation_requested']);
  if (res.stop_automation_requested) {
    throw new AutomationStoppedError();
  }
};

/**
 * Attempts to resolve an element in the page using all available strategies.
 * Returns the bounding-rect {x, y} of the element, or null on timeout.
 */
export const resolveElementWithFallback = async (
  target: chrome.debugger.Debuggee,
  tabId: number,
  action: RobustModuleAction,
  timeoutMs = 8000,
): Promise<{ x: number; y: number } | null> => {
  const fp = action.selectorFingerprint;
  const allFallbacks = action.fallback_selectors || [];
  const start = Date.now();

  // Build a combined resolver that tries fingerprint strategies, then bare fallbacks
  const buildCombinedExpression = (): string => {
    if (fp) {
      return /* js */ `
        (function() {
          const el = ${buildResolverExpression(fp)};
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return null; // hidden / detached
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()
      `;
    }

    // No fingerprint — fall back to primary + fallback_selectors
    const primary = action.selector || '';
    const all = [primary, ...allFallbacks].filter(Boolean);
    return /* js */ `
      (function() {
        ${DEEP_QUERY_HELPER}
        const coercePlaceholder = (node) => {
          if (!node) return null;
          const placeholderText =
            node.getAttribute?.('data-empty-text') ||
            node.getAttribute?.('data-placeholder') ||
            node.getAttribute?.('aria-placeholder') ||
            '';
          const isPlaceholder =
            !!placeholderText || (node.classList && node.classList.contains('editor-placeholder'));
          if (!isPlaceholder) return node;
          return node.closest('[contenteditable="true"], [role="textbox"]') || node;
        };
        const selectors = [${all.map(s => JSON.stringify(s)).join(',')}];
        for (const sel of selectors) {
          const el = coercePlaceholder(querySelectorDeep(sel));
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return null;
      })()
    `;
  };

  while (Date.now() - start < timeoutMs) {
    await checkStop();
    try {
      const result = (await chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
        expression: buildCombinedExpression(),
        returnByValue: true,
        awaitPromise: false,
      })) as any;

      const val = result?.result?.value;
      if (val && typeof val.x === 'number') {
        return val as { x: number; y: number };
      }
    } catch (e) {
      if ((e as any).name === 'AutomationStoppedError') throw e;
      console.warn('[SelectorEngine] evaluate error:', e);
    }

    await smartWait(500);
  }

  // Final diagnostic log
  console.warn(
    '[SelectorEngine] Could not resolve element after',
    timeoutMs,
    'ms.',
    'Primary:',
    action.selector,
    fp ? '| Fingerprint strategies:' + fp.semantic.join(', ') : '',
  );
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacement for the click & insert_text cases in executeAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Robust click: resolves element with full fallback chain then dispatches
 * mouse events via CDP.
 */
export const robustClick = async (
  target: chrome.debugger.Debuggee,
  tabId: number,
  action: RobustModuleAction,
  timeoutMs = 8000,
): Promise<boolean> => {
  const pos = await resolveElementWithFallback(target, tabId, action, timeoutMs);
  if (!pos) {
    throw new Error(`Failed to find element for click: ${action.selector}`);
  }

  await smartWait(300); // let scrollIntoView settle
  const { x, y } = pos;

  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await smartWait(60);
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  return true;
};

/**
 * Robust insert_text: resolves element → clicks to activate → focuses → inserts text.
 * Falls back through all CDP / native / execCommand methods before giving up.
 */
export const robustInsertText = async (
  target: chrome.debugger.Debuggee,
  tabId: number,
  action: RobustModuleAction,
  resolvedValue: string,
  timeoutMs = 8000,
): Promise<boolean> => {
  // 1. Resolve position
  const pos = await resolveElementWithFallback(target, tabId, action, timeoutMs);
  if (!pos) {
    throw new Error(`Failed to find element for text entry: ${action.selector}`);
  }

  await smartWait(300);
  const { x, y } = pos;

  // 2. Click to activate (important for rich-text editors)
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await smartWait(60);
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await smartWait(120);

  // 3. Focus
  const fp = action.selectorFingerprint;
  const allSels = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) || []),
    ...(action.fallback_selectors || []),
  ].filter(Boolean) as string[];

  const focusExpr = /* js */ `
    (function() {
      ${DEEP_QUERY_HELPER}
      const selectors = [${allSels.map(s => JSON.stringify(s)).join(',')}];
      for (const sel of selectors) {
        const el = querySelectorDeep(sel);
        if (!el) continue;
        const ft = el.matches('input,textarea,[contenteditable="true"],[role="textbox"]')
          ? el
          : el.querySelector('input,textarea,[contenteditable="true"],[role="textbox"]') || el;
        if (ft?.focus) { ft.focus(); return true; }
      }
      return false;
    })()
  `;
  await chrome.debugger.sendCommand(target, 'Runtime.evaluate', { expression: focusExpr });

  // 4. Insert text — try CDP first, then fallback strategies
  const method = action.method || 'cdp_insert_text';

  if (method === 'cdp_insert_text') {
    try {
      await chrome.debugger.sendCommand(target, 'Input.insertText', { text: resolvedValue });
    } catch (err) {
      console.warn('[SelectorEngine] cdp_insert_text failed:', err);
    }
  }

  // Native setter fallback (React-controlled inputs and contenteditable)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (selList: string[], text: string) => {
        const el = selList.map(s => document.querySelector(s)).find(Boolean) as HTMLElement | null;
        if (!el) {
          return false;
        }
        if (el.isContentEditable) {
          el.innerText = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }

        const nativeSetter =
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ||
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(el, text);
        } else {
          (el as any).value = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      },
      args: [allSels, resolvedValue],
    });
  } catch (err) {
    console.warn('[SelectorEngine] Native fallback executeScript failed (e.g. host permission):', err);
  }

  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint-aware wait_for_element
// ─────────────────────────────────────────────────────────────────────────────

export const robustWaitForElement = async (
  target: chrome.debugger.Debuggee,
  action: RobustModuleAction,
  timeoutMs = 10000,
): Promise<boolean> => {
  const start = Date.now();
  const fp = action.selectorFingerprint;
  const allSels = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) || []),
    ...(action.fallback_selectors || []),
  ].filter(Boolean) as string[];

  const checkExpr = /* js */ `
    (function() {
      ${DEEP_QUERY_HELPER}
      const selectors = [${allSels.map(s => JSON.stringify(s)).join(',')}];
      ${
        fp?.textContent
          ? `
      const text = ${JSON.stringify(fp.textContent)}.trim().toLowerCase();
      const tag = ${JSON.stringify(fp.tagName || '*')};
      for (const c of document.querySelectorAll(tag)) {
        if ((c.textContent||'').trim().toLowerCase().includes(text)) return true;
      }
      `
          : ''
      }
      return selectors.some(s => !!querySelectorDeep(s));
    })()
  `;

  while (Date.now() - start < timeoutMs) {
    await checkStop();
    const result = (await chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
      expression: checkExpr,
      returnByValue: true,
    })) as any;
    if (result?.result?.value === true) return true;
    await smartWait(500);
  }
  throw new Error(`Timeout waiting for element: ${action.selector}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Robust content-script selector generator
// ─────────────────────────────────────────────────────────────────────────────
// This generates the BEST possible selector purely from DOM introspection,
// without CDP. It is what the ElementPicker in the content script should use
// for element selection. The CDP picker is removed from the selection flow.

/**
 * The robust selector generator function source.
 * Designed to be injected into the page OR called directly in the content script.
 * Produces short, stable, unique selectors that work on modern web apps
 * (Linear, Notion, Slack, Figma, etc.)
 *
 * Key improvements over the old approach:
 *  - Uses attribute-based selectors aggressively (data-*, aria-*, role, name, placeholder)
 *  - Handles contenteditable / rich-text editors (ProseMirror, Tiptap, Slate, etc.)
 *  - Filters dynamic/hash classes properly without killing semantic classes
 *  - Traverses Shadow DOM boundaries
 *  - Short-circuits on unique attributes to avoid long nth-child chains
 *  - Uses `document.querySelectorAll(candidate).length === 1` uniqueness checks
 */
export const ROBUST_SELECTOR_GENERATOR = /* js */ `
(function robustGetSelector(targetEl) {
  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Check if a class name looks auto-generated / hashed */
  const isDynamicClass = (c) => {
    if (!c || c.length === 0) return true;
    // CSS-modules / styled-components / emotion / linaria hashes
    if (/^(css|sc|jss|style|emotion|styled|__)-/i.test(c)) return true;
    // Pure hex/alphanum hashes (8+ chars of just letters/digits, no hyphens)
    if (/^[a-z0-9]{8,}$/i.test(c)) return true;
    // class_hash patterns like "class_abc12de"
    if (/^[a-z]+_[a-z0-9]{5,}$/i.test(c)) return true;
    // Tailwind JIT hashes like "\\[color\\:red\\]" or utility with colons
    if (c.includes(':') || c.includes('[') || c.includes('\\\\')) return true;
    return false;
  };

  /** Check if a class represents transient UI state */
  const isStateClass = (c) => {
    const low = c.toLowerCase();
    const statePatterns = [
      /^is[-_]/,      // is-active, is_open
      /^has[-_]/,     // has-error, has_focus
      /[-_](focus|hover|active|pressed|dragging|dropping)$/,
      /^(focused|hovered|activated|pressed|dragging|dropping|animating)$/,
    ];
    return statePatterns.some(p => p.test(low));
  };

  /** Escape CSS special chars in a value for use in attribute selectors */
  const cssEscape = (s) => {
    if (!s) return '';
    return s.replace(/"/g, '\\\\"');
  };

  /** Check if a selector uniquely matches exactly one element */
  const isUnique = (sel) => {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch { return false; }
  };

  /** Check if an element is a placeholder node (ProseMirror, Tiptap, etc.) */
  const isPlaceholderNode = (node) => {
    if (!node || !node.getAttribute) return false;
    return !!(
      node.getAttribute('data-empty-text') ||
      node.getAttribute('data-placeholder') ||
      node.getAttribute('aria-placeholder') ||
      (node.classList && node.classList.contains('editor-placeholder'))
    );
  };

  /**
   * Walk up to the nearest interactive/meaningful element.
   * This prevents selecting tiny inner spans, SVG paths, placeholder spans, etc.
   */
  const getInteractiveParent = (node) => {
    if (!node) return node;

    // If it's a placeholder node, jump to the editor
    if (isPlaceholderNode(node)) {
      const editor = node.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]');
      if (editor) return editor;
    }

    const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'DETAILS', 'LABEL']);
    const interactiveRoles = new Set(['button', 'link', 'textbox', 'combobox', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'switch', 'checkbox', 'radio', 'slider', 'spinbutton', 'searchbox']);

    let current = node;
    // Only walk up if the initial element is a "leaf" element (text, icon, etc.)
    const leafTags = new Set(['SVG', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON', 'ELLIPSE', 'G', 'USE',
                              'SPAN', 'I', 'EM', 'STRONG', 'B', 'IMG', 'SMALL', 'SUB', 'SUP', 'BR', 'WBR']);
    if (!leafTags.has(node.tagName) && !isPlaceholderNode(node)) {
      return node; // Already a meaningful element
    }

    while (current && current.tagName !== 'BODY' && current !== document.documentElement) {
      if (
        interactiveTags.has(current.tagName) ||
        interactiveRoles.has(current.getAttribute?.('role') || '') ||
        current.isContentEditable ||
        current.getAttribute?.('contenteditable') === 'true' ||
        current.hasAttribute?.('tabindex') ||
        current.onclick ||
        current.hasAttribute?.('data-testid')
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return node; // No better parent found, use original
  };

  // ── Attribute-based shortcut selectors ───────────────────────────────────

  /** Try to build a short, stable selector from element attributes alone. */
  const tryAttributeSelector = (el) => {
    const tag = el.tagName.toLowerCase();

    // 1. Highest priority: test IDs & semantic data attributes
    const highPriAttrs = ['data-testid', 'data-cy', 'data-qa', 'data-test', 'data-automation-id', 'data-automation'];
    for (const attr of highPriAttrs) {
      const v = el.getAttribute(attr);
      if (v) {
        const sel = '[' + attr + '="' + cssEscape(v) + '"]';
        if (isUnique(sel)) return sel;
        // Try with tag prefix
        const tagSel = tag + sel;
        if (isUnique(tagSel)) return tagSel;
      }
    }

    // 2. Stable ID (not hashed)
    if (el.id && !/^[a-f0-9]{8,}$/i.test(el.id) && !/^\\d/.test(el.id) && !/^:/.test(el.id)) {
      const sel = '#' + CSS.escape(el.id);
      if (isUnique(sel)) return sel;
    }

    // 3. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      const sel = '[aria-label="' + cssEscape(ariaLabel) + '"]';
      if (isUnique(sel)) return sel;
      const tagSel = tag + sel;
      if (isUnique(tagSel)) return tagSel;
    }

    // 4. name attribute (forms)
    const name = el.getAttribute('name');
    if (name && !/^[0-9]/.test(name)) {
      const sel = tag + '[name="' + cssEscape(name) + '"]';
      if (isUnique(sel)) return sel;
    }

    // 5. placeholder attribute (inputs, textareas)
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      const sel = tag + '[placeholder="' + cssEscape(placeholder) + '"]';
      if (isUnique(sel)) return sel;
      // Without tag
      const noTag = '[placeholder="' + cssEscape(placeholder) + '"]';
      if (isUnique(noTag)) return noTag;
    }

    // 6. role + contextual attributes
    const role = el.getAttribute('role');
    if (role) {
      const sel = '[role="' + cssEscape(role) + '"]';
      // role alone is rarely unique, try with other attrs
      const label = ariaLabel || el.getAttribute('aria-describedby') || '';
      if (label) {
        const combined = sel + '[aria-label="' + cssEscape(label) + '"]';
        if (isUnique(combined)) return combined;
      }
    }

    // 7. type for inputs
    const type = el.getAttribute('type');
    if (type && tag === 'input') {
      const sel = 'input[type="' + cssEscape(type) + '"]';
      if (isUnique(sel)) return sel;
    }

    // 8. contenteditable
    if (el.getAttribute('contenteditable') === 'true') {
      // Try role first
      if (role) {
        const sel = '[role="' + cssEscape(role) + '"][contenteditable="true"]';
        if (isUnique(sel)) return sel;
      }
      // Try with aria-label
      if (ariaLabel) {
        const sel = '[contenteditable="true"][aria-label="' + cssEscape(ariaLabel) + '"]';
        if (isUnique(sel)) return sel;
      }
      // Try with data-placeholder
      const dp = el.getAttribute('data-placeholder');
      if (dp) {
        const sel = '[contenteditable="true"][data-placeholder="' + cssEscape(dp) + '"]';
        if (isUnique(sel)) return sel;
      }
    }

    // 9. href for links (trimming query params for stability)
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('javascript:') && href !== '#') {
        const sel = 'a[href="' + cssEscape(href) + '"]';
        if (isUnique(sel)) return sel;
      }
    }

    // 10. for attribute on labels
    if (tag === 'label') {
      const forAttr = el.getAttribute('for');
      if (forAttr) {
        const sel = 'label[for="' + cssEscape(forAttr) + '"]';
        if (isUnique(sel)) return sel;
      }
    }

    // 11. Custom data-* attributes (Linear, Notion, etc. use data-key, data-block-id, etc.)
    const allAttrs = Array.from(el.attributes || []);
    for (const attr of allAttrs) {
      if (attr.name.startsWith('data-') && !highPriAttrs.includes(attr.name)) {
        // Skip very long values (likely hashes or content)
        if (attr.value.length > 80) continue;
        // Skip purely numeric values
        if (/^\\d+$/.test(attr.value)) continue;
        const sel = '[' + attr.name + '="' + cssEscape(attr.value) + '"]';
        if (isUnique(sel)) return sel;
      }
    }

    return null;
  };

  // ── Build selector path (bottom-up) ──────────────────────────────────────

  /**
   * Build the shortest unique CSS path from element to document.
   * Uses attribute shortcuts to short-circuit as early as possible.
   */
  const buildSelectorPath = (el) => {
    if (!el || el === document.body || el === document.documentElement || el === document) return '';
    if (el.tagName === 'BODY') return 'body';
    if (el.tagName === 'HTML') return 'html';

    // First try: can we get a unique selector from attributes alone?
    const shortcut = tryAttributeSelector(el);
    if (shortcut) return shortcut;

    // Build a segment for this element
    let segment = el.tagName.toLowerCase();

    // Add stable classes (filter out dynamic/state classes)
    const stableClasses = Array.from(el.classList || [])
      .filter(c => !isDynamicClass(c) && !isStateClass(c));

    if (stableClasses.length > 0) {
      // Use at most 2 classes to keep selectors short
      const classStr = stableClasses.slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
      const candidate = segment + classStr;
      if (isUnique(candidate)) return candidate;
      segment = candidate;
    }

    // Add nth-child if needed for disambiguation among siblings
    const parent = el.parentElement;
    if (parent) {
      const sameTags = Array.from(parent.children).filter(s => s.tagName === el.tagName);
      if (sameTags.length > 1) {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        segment += ':nth-child(' + idx + ')';
      }
    }

    // Check if this segment alone is unique
    if (isUnique(segment)) return segment;

    // Recurse up the tree
    if (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
      // Try attribute shortcut for parent
      const parentShortcut = tryAttributeSelector(parent);
      if (parentShortcut) {
        const combined = parentShortcut + ' > ' + segment;
        if (isUnique(combined)) return combined;
        // Try without direct child combinator
        const loose = parentShortcut + ' ' + segment;
        if (isUnique(loose)) return loose;
      }

      // Recurse
      const parentPath = buildSelectorPath(parent);
      if (parentPath) {
        return parentPath + ' > ' + segment;
      }
    }

    return segment;
  };

  // ── Shadow DOM support ───────────────────────────────────────────────────
  const buildShadowAwarePath = (el) => {
    const segments = [];
    let current = el;

    while (current) {
      const root = current.getRootNode();

      if (root instanceof ShadowRoot) {
        // Element is inside a shadow DOM
        const hostPath = buildSelectorPath(root.host);
        const innerPath = buildSelectorPath(current);
        segments.unshift(innerPath);
        segments.unshift(hostPath + ' >>> ');
        current = root.host.parentElement;
        // Continue walking up outside the shadow DOM
        if (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
          const outerPath = buildSelectorPath(current);
          segments.unshift(outerPath + ' > ');
        }
        break;
      } else {
        // Normal DOM
        segments.unshift(buildSelectorPath(current));
        break;
      }
    }

    return segments.join('');
  };

  // ── Main logic ───────────────────────────────────────────────────────────

  const el = getInteractiveParent(targetEl);
  const selector = buildShadowAwarePath(el);

  return selector;
})
`;

// ─────────────────────────────────────────────────────────────────────────────
// Element name extractor (for UI display)
// ─────────────────────────────────────────────────────────────────────────────
export const ELEMENT_NAME_EXTRACTOR = /* js */ `
(function getElementName(el) {
  if (!el || !el.getAttribute) return '';

  // 1. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 2. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
  }

  // 3. Associated <label> via for/id
  if (el.id) {
    const label = document.querySelector('label[for="' + el.id + '"]');
    if (label && label.textContent) return label.textContent.trim();
  }

  // 4. Wrapping <label>
  const parentLabel = el.closest && el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true);
    clone.querySelectorAll('input, textarea, select').forEach(c => c.remove());
    const text = clone.textContent && clone.textContent.trim();
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

  // 6b. contenteditable placeholder descendants (ProseMirror, Tiptap)
  if (
    el.isContentEditable ||
    el.getAttribute('contenteditable') === 'true' ||
    el.getAttribute('role') === 'textbox'
  ) {
    const placeholderNode = el.querySelector &&
      el.querySelector(
        '[data-empty-text], [data-placeholder], [aria-placeholder], .editor-placeholder, [data-placeholder-text]'
      );
    if (placeholderNode) {
      const derived =
        placeholderNode.getAttribute('data-empty-text') ||
        placeholderNode.getAttribute('data-placeholder') ||
        placeholderNode.getAttribute('aria-placeholder') ||
        placeholderNode.getAttribute('data-placeholder-text') ||
        placeholderNode.textContent?.trim();
      if (derived) return derived;
    }
  }

  // 7. title
  const titleAttr = el.getAttribute('title');
  if (titleAttr) return titleAttr;

  return '';
})
`;
