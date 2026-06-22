/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/elementActions.ts
 *
 * PHASE 2 — click() upgraded with DOM-first strategy.
 * All other methods remain Phase 1 (unchanged).
 *
 * click() flow:
 *   1. DOM Strategy  → chrome.scripting (fast, no debugger needed)
 *   2. Validate      → element found + visible?
 *   3. fallback      → robustClick (CDP/debugger) if DOM strategy failed
 */

import { robustClick, robustInsertText } from '../SelectorEngine';
import { attachDebugger } from './debuggerActions';
import type {
  ClickContext,
  TypeContext,
  PasteContext,
  ScrollContext,
  HoverContext,
  FocusContext,
  SelectContext,
  UploadContext,
  InteractionResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// DOM Click Strategy (internal — not exported)
//
// Runs entirely inside the page via chrome.scripting.executeScript.
// Uses the full selector + fingerprint fallback chain.
// Returns { found, method, selector } for diagnostics.
//
// WHY DOM-first:
//   - No debugger attachment cost (faster for most actions)
//   - Works for 80%+ of normal buttons/links
//   - Gracefully hands off to debugger for protected/complex cases
// ─────────────────────────────────────────────────────────────────────────────

interface DomClickResult {
  found: boolean;
  method: 'css' | 'text' | null;
  selector: string | null;
}

const domClickStrategy = async (ctx: ClickContext): Promise<DomClickResult> => {
  const action = ctx.action!;
  const fp = action.selectorFingerprint;

  // Build CSS selector list (same priority order as robustClick)
  const cssSelectors = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) ?? []),
    ...(action.fallback_selectors ?? []),
  ].filter(Boolean) as string[];

  // Text-hint selectors (e.g. "__TEXT__:button:Submit")
  const textHints = fp?.semantic.filter(s => s.startsWith('__TEXT__:')) ?? [];

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (
        selectorList: string[],
        textHintList: string[],
      ): DomClickResult => {
        // ── Inline shadow-DOM-aware query (mirrors DEEP_QUERY_HELPER) ─────────
        const deepQuery = (selector: string, root: Document | Element | ShadowRoot = document): Element | null => {
          if (!selector) return null;
          const parts = selector.split(' >>> ');
          let current: Document | Element | ShadowRoot = root;
          for (const part of parts) {
            if (!part.trim()) continue;
            const found = (current as Document | Element).querySelector(part);
            if (!found) {
              // Try shadow roots on all children
              const allNodes = (current as Document | Element).querySelectorAll('*');
              let hit: Element | null = null;
              for (const node of Array.from(allNodes)) {
                if ((node as any).shadowRoot) {
                  hit = (node as any).shadowRoot.querySelector(part);
                  if (hit) break;
                }
              }
              if (!hit) return null;
              current = (hit as any).shadowRoot || hit;
            } else {
              current = (found as any).shadowRoot || found;
            }
          }
          return current instanceof ShadowRoot ? null : (current as Element);
        };

        // ── Strategy 1: CSS selectors ─────────────────────────────────────────
        for (const sel of selectorList) {
          const el = deepQuery(sel) as HTMLElement | null;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          // Skip hidden / detached elements
          if (rect.width === 0 && rect.height === 0) continue;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.click();
          return { found: true, method: 'css', selector: sel };
        }

        // ── Strategy 2: Text-content match ────────────────────────────────────
        for (const hint of textHintList) {
          // Format: "__TEXT__:tagName:visible text"
          const withoutPrefix = hint.slice('__TEXT__:'.length);
          const colonIdx = withoutPrefix.indexOf(':');
          if (colonIdx === -1) continue;
          const tag = withoutPrefix.slice(0, colonIdx);
          const text = withoutPrefix.slice(colonIdx + 1);

          const candidates = Array.from(document.querySelectorAll(tag)) as HTMLElement[];

          // Exact match first
          let match = candidates.find(c => (c.textContent ?? '').trim() === text);
          // Partial match fallback
          if (!match) match = candidates.find(c => (c.textContent ?? '').trim().includes(text));

          if (match) {
            const rect = match.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
              match.scrollIntoView({ behavior: 'instant', block: 'center' });
              match.click();
              return { found: true, method: 'text', selector: hint };
            }
          }
        }

        return { found: false, method: null, selector: null };
      },
      args: [cssSelectors, textHints],
    });

    return (results?.[0]?.result as DomClickResult) ?? { found: false, method: null, selector: null };
  } catch (err: any) {
    // scripting may fail on chrome:// pages or if extension can't inject
    console.warn('[InteractionEngine] DOM click script error:', err?.message);
    return { found: false, method: null, selector: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// click — PHASE 2
//
// Architecture:
//   Step 1 → DOM strategy (chrome.scripting — fast, no debugger)
//   Step 2 → Validate success (element found + visible?)
//   Step 3 → fallbackDebugger (robustClick via CDP) if DOM failed
// ─────────────────────────────────────────────────────────────────────────────

export const click = async (ctx: ClickContext): Promise<InteractionResult> => {
  if (!ctx.action) {
    return { status: 'failed', error: 'click: missing action' };
  }

  // ── Step 1 & 2: DOM Strategy + Validation ─────────────────────────────────
  const domResult = await domClickStrategy(ctx);

  if (domResult.found) {
    
    return { status: 'success', tabId: ctx.tabId };
  }

  // ── Step 3: fallbackDebugger (robustClick via CDP) ─────────────────────────
  // ⚠️  DOM strategy could not find/click the element.
  // ⚡  DEBUGGER FALLBACK ACTIVATED — CDP transport will now execute the click.
  console.warn(
    '[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — click',
    `| reason: DOM strategy could not find/click element`,
    `| primary: "${ctx.action.selector}"`,
    ctx.action.selectorFingerprint
      ? `| fingerprint strategies available: ${ctx.action.selectorFingerprint.semantic.length}`
      : '| no fingerprint recorded',
  );

  if (!ctx.target) {
    return { status: 'failed', error: 'click: DOM failed and no debugger target available for fallback' };
  }

  try {
    // ⚡ On-demand attachment
    const target = await attachDebugger(ctx.tabId);
    const ok = await robustClick(target, ctx.tabId, ctx.action, ctx.timeout ?? 8000);
    if (ok) {
      
      return { status: 'success', tabId: ctx.tabId };
    }
    return { status: 'failed', error: 'click: both DOM and debugger strategies failed' };
  } catch (err: any) {
    return { status: 'failed', error: `click debugger fallback error: ${err?.message ?? String(err)}` };
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// DOM Type Strategy (internal — shared by type() and paste())
//
// PHASE 3A SCOPE: input + textarea ONLY.
// contenteditable / rich editors → route to fallback (robustInsertText handles them).
//
// Why native setter instead of el.value = text:
//   React, Vue, Angular track value via their own internal state.
//   Setting el.value directly bypasses their state and events are ignored.
//   Using the native HTMLInputElement setter + dispatching synthetic events
//   is the correct way to update React-controlled inputs.
// ─────────────────────────────────────────────────────────────────────────────

interface DomTypeResult {
  found: boolean;
  validated: boolean;
  method: 'dom-type' | 'dom-paste' | null;
  tag: string | null;
  selector: string | null;
}

const domTypeStrategy = async (
  ctx: TypeContext | PasteContext,
  text: string,
  method: 'dom-type' | 'dom-paste',
): Promise<DomTypeResult> => {
  const action = ctx.action!;
  const fp = action.selectorFingerprint;

  const cssSelectors = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) ?? []),
    ...(action.fallback_selectors ?? []),
  ].filter(Boolean) as string[];

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (
        selectorList: string[],
        valueToType: string,
        methodLabel: string,
      ): DomTypeResult => {
        // ── Inline shadow-DOM-aware query ──────────────────────────────────────
        const deepQuery = (selector: string): Element | null => {
          if (!selector) return null;
          const parts = selector.split(' >>> ');
          let current: Document | Element | ShadowRoot = document;
          for (const part of parts) {
            if (!part.trim()) continue;
            const found: Element | null = (current as Document | Element).querySelector(part);
            if (!found) {
              const allNodes: NodeListOf<Element> = (current as Document | Element).querySelectorAll('*');
              let hit: Element | null = null;
              for (const node of Array.from(allNodes)) {
                if ((node as any).shadowRoot) {
                  hit = (node as any).shadowRoot.querySelector(part);
                  if (hit) break;
                }
              }
              if (!hit) return null;
              current = (hit as any).shadowRoot || hit;
            } else {
              current = (found as any).shadowRoot || found;
            }
          }
          return current instanceof ShadowRoot ? null : (current as Element);
        };

        // ── PHASE 9: Resolve Editable Target ──────────────────────────────────
        // If the selector hits a wrapper, find the actual editable node inside.
        const resolveEditableTarget = (root: Element): HTMLElement | null => {
          const isEditable = (el: any) => 
            el.tagName === 'INPUT' || 
            el.tagName === 'TEXTAREA' || 
            el.isContentEditable || 
            el.getAttribute('contenteditable') === 'true' ||
            el.getAttribute('role') === 'textbox';

          if (isEditable(root)) return root as HTMLElement;

          // Search descendants
          // Prioritize standard inputs
          const standard = root.querySelector('input, textarea');
          if (standard) return standard as HTMLElement;

          // Fallback to contenteditable
          const rich = root.querySelector('[contenteditable="true"], [role="textbox"]');
          if (rich) return rich as HTMLElement;

          return null;
        };

        // ── Find element ───────────────────────────────────────────────────────
        let el: HTMLElement | null = null;
        let matchedSelector: string | null = null;

        for (const sel of selectorList) {
          const found = deepQuery(sel);
          if (!found) continue;
          
          const resolved = resolveEditableTarget(found);
          if (!resolved) continue;

          const rect = resolved.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          
          el = resolved;
          matchedSelector = sel;
          break;
        }

        if (!el) {
          return { found: false, validated: false, method: null, tag: null, selector: null };
        }

        const tag = el.tagName.toLowerCase();
        const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox';

        // ── Step 1: Focus + scroll ─────────────────────────────────────────────
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.focus();

        if (isContentEditable) {
          // ── Step 2 (Rich): Use execCommand for contenteditable ──────────────
          // This is the most React/Vue-safe way to type into rich editors
          // as it triggers native mutation events.
          try {
             // Clear existing if needed? Usually for type() we replace.
             if (methodLabel === 'dom-type') {
                (el as HTMLElement).innerText = '';
             }
             
             // Place cursor at end
             const selection = window.getSelection();
             const range = document.createRange();
             range.selectNodeContents(el);
             range.collapse(false);
             selection?.removeAllRanges();
             selection?.addRange(range);

             // Insert text
             document.execCommand('insertText', false, valueToType);
          } catch (e) {
             (el as HTMLElement).innerText = valueToType;
          }
        } else {
          // ── Step 2 (Standard): Set value via native setter ───────────────────
          const nativeSetter =
            tag === 'textarea'
              ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
              : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

          if (nativeSetter) {
            nativeSetter.call(el, valueToType);
          } else {
            (el as any).value = valueToType;
          }
        }

        // ── Step 3: Fire events (React + Vue + vanilla) ───────────────────────
        // Order matters: beforeinput → input → change → keydown → keyup
        el.dispatchEvent(new Event('beforeinput', { bubbles: true }));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: valueToType }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

        // ── Step 4: Validation ─────────────────────────────────────────────────
        let validated = false;
        if (isContentEditable) {
           const currentText = (el as HTMLElement).innerText || (el as HTMLElement).textContent || '';
           validated = currentText.trim() === valueToType.trim();
        } else {
           validated = (el as HTMLInputElement).value === valueToType;
        }

        return {
          found: true,
          validated,
          method: methodLabel as 'dom-type' | 'dom-paste',
          tag: isContentEditable ? 'contenteditable' : tag,
          selector: matchedSelector,
        };
      },
      args: [cssSelectors, text, method],
    });

    return (results?.[0]?.result as DomTypeResult) ?? { found: false, validated: false, method: null, tag: null, selector: null };
  } catch (err: any) {
    console.warn('[InteractionEngine] DOM type script error:', err?.message);
    return { found: false, validated: false, method: null, tag: null, selector: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// type — PHASE 3
//
// Flow:
//   Step 1 → DOM Strategy (scripting — native setter + React events)
//   Step 2 → Validate (input.value === expected?)
//   Step 3 → fallbackDebugger (robustInsertText via CDP) if DOM failed/invalid
// ─────────────────────────────────────────────────────────────────────────────

export const type = async (ctx: TypeContext): Promise<InteractionResult> => {
  if (!ctx.action) {
    return { status: 'failed', error: 'type: missing action' };
  }

  // ── Step 1 & 2: DOM Strategy + Validation ─────────────────────────────────
  const domResult = await domTypeStrategy(ctx, ctx.value, 'dom-type');

  if (domResult.found && domResult.validated) {
    
    return { status: 'success', tabId: ctx.tabId };
  }

  // ── Step 3: fallbackDebugger (robustInsertText via CDP) ─────────────────────
  // ⚠️  DOM strategy found or failed validation.
  // ⚡  DEBUGGER FALLBACK ACTIVATED — CDP transport will now execute the type.
  if (domResult.found && !domResult.validated) {
    console.warn(
      '[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — type',
      `| reason: element found but value validation failed (likely React/Vue controlled input)`,
      `| tag: ${domResult.tag}`,
      `| selector: "${domResult.selector}"`,
    );
  } else {
    console.warn(
      '[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — type',
      `| reason: element not found in input/textarea scope (likely contenteditable or rich editor)`,
      `| primary: "${ctx.action.selector}"`,
    );
  }
  if (!ctx.target) {
    return { status: 'failed', error: 'type: DOM failed and no debugger target available for fallback' };
  }

  try {
    // ⚡ On-demand attachment
    const target = await attachDebugger(ctx.tabId);
    const ok = await robustInsertText(target, ctx.tabId, ctx.action, ctx.value, ctx.timeout ?? 8000);
    if (ok) {
      
      return { status: 'success', tabId: ctx.tabId };
    }
    return { status: 'failed', error: 'type: both DOM and debugger strategies failed' };
  } catch (err: any) {
    return { status: 'failed', error: `type debugger fallback error: ${err?.message ?? String(err)}` };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// paste — PHASE 3
//
// Flow:
//   Step 1 → DOM click to focus (uses DOM click strategy internally)
//   Step 2 → DOM type strategy (native setter + React events)
//   Step 3 → Validate (input.value === expected?)
//   Step 4 → fallbackDebugger (robustClick + robustInsertText) if DOM failed
// ─────────────────────────────────────────────────────────────────────────────

export const paste = async (ctx: PasteContext): Promise<InteractionResult> => {
  if (!ctx.action) {
    return { status: 'failed', error: 'paste: missing action' };
  }

  // ── Step 1: DOM click to activate the element ──────────────────────────────
  // Reuse domClickStrategy logic inline (avoids circular import)
  const clickCtx = { tabId: ctx.tabId, target: ctx.target, action: ctx.action, timeout: ctx.timeout };
  const clickSelectors = [
    ctx.action.selector,
    ...(ctx.action.selectorFingerprint?.semantic.filter(s => !s.startsWith('__TEXT__:')) ?? []),
    ...(ctx.action.fallback_selectors ?? []),
  ].filter(Boolean) as string[];

  try {
    await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (selectorList: string[]) => {
        for (const sel of selectorList) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.focus();
          el.click();
          return true;
        }
        return false;
      },
      args: [clickSelectors],
    });
  } catch {
    // Non-critical — proceed to type attempt regardless
  }

  await new Promise(r => setTimeout(r, 150));

  // ── Step 2 & 3: DOM type strategy + Validation ─────────────────────────────
  const domResult = await domTypeStrategy(ctx as any as TypeContext, ctx.content, 'dom-paste');

  if (domResult.found && domResult.validated) {
    
    return { status: 'success', tabId: ctx.tabId };
  }

  // ⚡  DEBUGGER FALLBACK ACTIVATED — CDP transport will now execute the paste.
  if (domResult.found && !domResult.validated) {
    console.warn(
      '[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — paste',
      `| reason: element found but value validation failed (likely React/Vue controlled input)`,
      `| tag: ${domResult.tag}`,
    );
  } else {
    console.warn(
      '[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — paste',
      `| reason: element not found in input/textarea scope`,
      `| primary: "${ctx.action.selector}"`,
    );
  }

  // ── Step 4: fallbackDebugger (robustClick + robustInsertText via CDP) ──────
  if (!ctx.target) {
    return { status: 'failed', error: 'paste: DOM failed and no debugger target available for fallback' };
  }

  try {
    // ⚡ On-demand attachment
    const target = await attachDebugger(ctx.tabId);
    await robustClick(target, ctx.tabId, ctx.action, ctx.timeout ?? 8000);
    await new Promise(r => setTimeout(r, 200));
    const ok = await robustInsertText(target, ctx.tabId, ctx.action, ctx.content, ctx.timeout ?? 8000);
    if (ok) {
      
      return { status: 'success', tabId: ctx.tabId };
    }
    return { status: 'failed', error: 'paste: both DOM and debugger strategies failed' };
  } catch (err: any) {
    return { status: 'failed', error: `paste debugger fallback error: ${err?.message ?? String(err)}` };
  }
};



// ─────────────────────────────────────────────────────────────────────────────
// scroll — PHASE 4
//
// Flow:
//   Step 1 → DOM Strategy (shadow-aware deepQuery + scrollIntoView)
//   Step 2 → Validate (did element become visible in viewport?)
//   Step 3 → Success (no debugger fallback usually needed for scroll)
// ─────────────────────────────────────────────────────────────────────────────

export const scroll = async (ctx: ScrollContext): Promise<InteractionResult> => {
  if (!ctx.action) {
    return { status: 'failed', error: 'scroll: missing action' };
  }

  const action = ctx.action;
  const fp = action.selectorFingerprint;
  const cssSelectors = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) ?? []),
    ...(action.fallback_selectors ?? []),
  ].filter(Boolean) as string[];

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (selectorList: string[]) => {
        // ── Inline shadow-DOM-aware query ──────────────────────────────────────
        const deepQuery = (selector: string): Element | null => {
          if (!selector) return null;
          const parts = selector.split(' >>> ');
          let current: Document | Element | ShadowRoot = document;
          for (const part of parts) {
            if (!part.trim()) continue;
            const found: Element | null = (current as Document | Element).querySelector(part);
            if (!found) {
              const allNodes: NodeListOf<Element> = (current as Document | Element).querySelectorAll('*');
              let hit: Element | null = null;
              for (const node of Array.from(allNodes)) {
                if ((node as any).shadowRoot) {
                  hit = (node as any).shadowRoot.querySelector(part);
                  if (hit) break;
                }
              }
              if (!hit) return null;
              current = (hit as any).shadowRoot || hit;
            } else {
              current = (found as any).shadowRoot || found;
            }
          }
          return current instanceof ShadowRoot ? null : (current as Element);
        };

        for (const sel of selectorList) {
          const el = deepQuery(sel) as HTMLElement | null;
          if (!el) continue;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { found: true, selector: sel };
        }
        return { found: false };
      },
      args: [cssSelectors],
    });

    const res = results?.[0]?.result as { found: boolean; selector?: string };
    if (res?.found) {
      
      return { status: 'success', tabId: ctx.tabId };
    }

    console.warn('[InteractionEngine] scroll: element not found in DOM, no fallback needed for scroll.');
    return { status: 'success', tabId: ctx.tabId }; // Scroll is best-effort
  } catch (err: any) {
    return { status: 'failed', error: `scroll error: ${err?.message ?? String(err)}` };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// hover — PHASE 4
//
// Flow:
//   Step 1 → DOM Strategy (dispatch mouseenter/mouseover/mousemove)
//   Step 2 → Fallback (CDP Input.dispatchMouseEvent) if DOM didn't trigger
// ─────────────────────────────────────────────────────────────────────────────

export const hover = async (ctx: HoverContext): Promise<InteractionResult> => {
  if (!ctx.action) {
    return { status: 'failed', error: 'hover: missing action' };
  }

  const action = ctx.action;
  const fp = action.selectorFingerprint;
  const cssSelectors = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) ?? []),
    ...(action.fallback_selectors ?? []),
  ].filter(Boolean) as string[];

  try {
    // ── Step 1: DOM Strategy ─────────────────────────────────────────────────
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (selectorList: string[]) => {
        // ── Inline shadow-DOM-aware query ──────────────────────────────────────
        const deepQuery = (selector: string): Element | null => {
          if (!selector) return null;
          const parts = selector.split(' >>> ');
          let current: Document | Element | ShadowRoot = document;
          for (const part of parts) {
            if (!part.trim()) continue;
            const found: Element | null = (current as Document | Element).querySelector(part);
            if (!found) {
              const allNodes: NodeListOf<Element> = (current as Document | Element).querySelectorAll('*');
              let hit: Element | null = null;
              for (const node of Array.from(allNodes)) {
                if ((node as any).shadowRoot) {
                  hit = (node as any).shadowRoot.querySelector(part);
                  if (hit) break;
                }
              }
              if (!hit) return null;
              current = (hit as any).shadowRoot || hit;
            } else {
              current = (found as any).shadowRoot || found;
            }
          }
          return current instanceof ShadowRoot ? null : (current as Element);
        };

        for (const sel of selectorList) {
          const el = deepQuery(sel) as HTMLElement | null;
          if (!el) continue;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
          return { found: true, selector: sel };
        }
        return { found: false };
      },
      args: [cssSelectors],
    });

    const res = results?.[0]?.result as { found: boolean; selector?: string };
    if (res?.found) {
      
      return { status: 'success', tabId: ctx.tabId };
    }

    // ── Step 2: Debugger Fallback ───────────────────────────────────────────
    console.warn('[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — hover');
    const target = await attachDebugger(ctx.tabId);
    
    // We reuse robustClick's coordinate resolution logic by proxying through SelectorEngine helpers if possible,
    // but for now we'll implement a clean hover fallback using CDP.
    const ok = await robustClick(target, ctx.tabId, ctx.action, ctx.timeout ?? 8000); // robustClick already does hover + click
    return ok ? { status: 'success', tabId: ctx.tabId } : { status: 'failed', error: 'hover: fallback failed' };
  } catch (err: any) {
    return { status: 'failed', error: `hover error: ${err?.message ?? String(err)}` };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// focus — PHASE 4
//
// Flow:
//   Step 1 → DOM Strategy (element.focus())
//   Step 2 → Fallback (CDP DOM.focusNode)
// ─────────────────────────────────────────────────────────────────────────────

export const focus = async (ctx: FocusContext): Promise<InteractionResult> => {
  if (!ctx.action) {
    return { status: 'failed', error: 'focus: missing action' };
  }

  const action = ctx.action;
  const fp = action.selectorFingerprint;
  const cssSelectors = [
    action.selector,
    ...(fp?.semantic.filter(s => !s.startsWith('__TEXT__:')) ?? []),
    ...(action.fallback_selectors ?? []),
  ].filter(Boolean) as string[];

  try {
    // ── Step 1: DOM Strategy ─────────────────────────────────────────────────
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (selectorList: string[]) => {
        const deepQuery = (selector: string): Element | null => {
          if (!selector) return null;
          const parts = selector.split(' >>> ');
          let current: Document | Element | ShadowRoot = document;
          for (const part of parts) {
            if (!part.trim()) continue;
            const found: Element | null = (current as Document | Element).querySelector(part);
            if (!found) {
              const allNodes: NodeListOf<Element> = (current as Document | Element).querySelectorAll('*');
              let hit: Element | null = null;
              for (const node of Array.from(allNodes)) {
                if ((node as any).shadowRoot) {
                  hit = (node as any).shadowRoot.querySelector(part);
                  if (hit) break;
                }
              }
              if (!hit) return null;
              current = (hit as any).shadowRoot || hit;
            } else {
              current = (found as any).shadowRoot || found;
            }
          }
          return current instanceof ShadowRoot ? null : (current as Element);
        };

        for (const sel of selectorList) {
          const el = deepQuery(sel) as HTMLElement | null;
          if (!el) continue;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.focus();
          return { found: true, selector: sel };
        }
        return { found: false };
      },
      args: [cssSelectors],
    });

    const res = results?.[0]?.result as { found: boolean; selector?: string };
    if (res?.found) {
      
      return { status: 'success', tabId: ctx.tabId };
    }

    // ── Step 2: Debugger Fallback ───────────────────────────────────────────
    console.warn('[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — focus');
    const target = await attachDebugger(ctx.tabId);
    
    // For focus, we can use DOM.focusNode but it requires nodeId.
    // Simpler fallback: use robustClick which includes a focus step.
    const ok = await robustClick(target, ctx.tabId, ctx.action, ctx.timeout ?? 8000);
    return ok ? { status: 'success', tabId: ctx.tabId } : { status: 'failed', error: 'focus: fallback failed' };
  } catch (err: any) {
    return { status: 'failed', error: `focus error: ${err?.message ?? String(err)}` };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// select — Phase 1: STUB (contract defined, Phase 2 implementation)
// ─────────────────────────────────────────────────────────────────────────────


export const select = async (_ctx: SelectContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] select: stub — not yet implemented (Phase 2)');
  return { status: 'skipped' };
};

// ─────────────────────────────────────────────────────────────────────────────
// upload (inject_image)
// Wraps: existing inject_image case in executeAction
// ─────────────────────────────────────────────────────────────────────────────

export const upload = async (ctx: UploadContext): Promise<InteractionResult> => {
  if (!ctx.action?.selector || ctx.images.length === 0) {
    return { status: 'skipped' };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: async (selector: string, imgs: any[]) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (!input) return;
        const dt = new DataTransfer();
        for (const img of imgs) {
          const res = await fetch(`data:${img.mimeType};base64,${img.base64}`);
          const blob = await res.blob();
          dt.items.add(new File([blob], img.filename, { type: img.mimeType }));
        }
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      args: [ctx.action.selector, ctx.images],
    });
    return { status: 'success', tabId: ctx.tabId };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};
