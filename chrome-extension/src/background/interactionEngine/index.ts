/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/index.ts
 *
 * PHASE 1 — The assembled InteractionEngine object.
 *
 * This is the ONLY import that automationExecutor.ts needs.
 * It must NEVER import directly from SelectorEngine, chrome.debugger,
 * or chrome.scripting. All calls go through interactionEngine.method().
 *
 * Architecture contract:
 *   executeAction() → interactionEngine.method() → existing implementation
 *
 * Future phases (2, 3, ...):
 *   Only the implementation files change.
 *   This index and automationExecutor remain untouched.
 */

// ── Debugger Actions ─────────────────────────────────────────────────────────
import { attachDebugger, enrichFingerprint, detachDebugger } from './debuggerActions';

// ── Element Actions ───────────────────────────────────────────────────────────
import { click, type, paste, scroll, hover, focus, select, upload } from './elementActions';

// ── Keyboard Actions ──────────────────────────────────────────────────────────
import { keyboard, shortcut } from './keyboardActions';

// ── Clipboard Actions ─────────────────────────────────────────────────────────
import { clipboardWrite, clipboardRead } from './clipboardActions';

// ── Wait Actions ──────────────────────────────────────────────────────────────
import { waitForElement, waitForNavigation, waitForState } from './waitActions';

// ── Extraction Actions ────────────────────────────────────────────────────────
import { getText, getHTML, getAttribute, getValue } from './extractActions';

// ── Tab Actions ───────────────────────────────────────────────────────────────
import { openTab, closeTab, switchTab, refreshTab, navigate } from './tabActions';

// ── Browser Actions ───────────────────────────────────────────────────────────
import { cookies, storage, executeScript, dispatchEvent } from './browserActions';

// ── Recovery Actions (Phase 2+, contract defined now) ─────────────────────────
import { validateState, recoverAction, fallbackDebugger, detectProtectedFlow } from './recoveryActions';

// ── Re-export all types so callers only need one import ───────────────────────
import type { ClickContext, TypeContext, PasteContext, ScrollContext, HoverContext, FocusContext, SelectContext, UploadContext, KeyboardContext, ShortcutContext } from './types';
export * from './types';

// ─────────────────────────────────────────────────────────────────────────────
// The Engine Object
//
// The executor calls: interactionEngine.click(ctx)
// Never: robustClick(target, tabId, action, timeout)
//
// This single object is the boundary between "what to do" and "how to do it".
// ─────────────────────────────────────────────────────────────────────────────

import { automationExecutionContext } from './automationExecutionContext';

const withAutomationContext = async <T>(tabId: number, fn: () => Promise<T>): Promise<T> => {
  if (!tabId || tabId <= 0) return await fn();
  
  automationExecutionContext.start();
  try {
    // Sync state to the tab's window object for content script protection
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { (window as any).__tasklabs_automation_active = true; }
    }).catch(() => {});
    
    return await fn();
  } finally {
    // Cleanup state
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { (window as any).__tasklabs_automation_active = false; }
    }).catch(() => {});
    
    automationExecutionContext.stop();
  }
};

export const interactionEngine = {
  // ── Debugger (internal utilities — abstracted from executor) ───────────────
  attachDebugger,
  enrichFingerprint,
  detachDebugger,

  // ── Element interactions ─────────────────────────────────────────────────
  click: (ctx: ClickContext) => withAutomationContext(ctx.tabId, () => click(ctx)),
  type: (ctx: TypeContext) => withAutomationContext(ctx.tabId, () => type(ctx)),
  paste: (ctx: PasteContext) => withAutomationContext(ctx.tabId, () => paste(ctx)),
  scroll: (ctx: ScrollContext) => withAutomationContext(ctx.tabId, () => scroll(ctx)),
  hover: (ctx: HoverContext) => withAutomationContext(ctx.tabId, () => hover(ctx)),
  focus: (ctx: FocusContext) => withAutomationContext(ctx.tabId, () => focus(ctx)),
  select: (ctx: SelectContext) => withAutomationContext(ctx.tabId, () => select(ctx)),
  upload: (ctx: UploadContext) => withAutomationContext(ctx.tabId, () => upload(ctx)),

  // ── Keyboard ─────────────────────────────────────────────────────────────
  keyboard: (ctx: KeyboardContext) => withAutomationContext(ctx.tabId, () => keyboard(ctx)),
  shortcut: (ctx: ShortcutContext) => withAutomationContext(ctx.tabId, () => shortcut(ctx)),

  // ── Clipboard ─────────────────────────────────────────────────────────────
  clipboardWrite,
  clipboardRead,

  // ── Waits ─────────────────────────────────────────────────────────────────
  waitForElement,
  waitForNavigation,
  waitForState,

  // ── Extraction (Phase 2+) ─────────────────────────────────────────────────
  getText,
  getHTML,
  getAttribute,
  getValue,

  // ── Tab management ────────────────────────────────────────────────────────
  openTab,
  closeTab,
  switchTab,
  refreshTab,
  navigate,

  // ── Browser APIs ──────────────────────────────────────────────────────────
  cookies,
  storage,
  executeScript,
  dispatchEvent,

  // ── Recovery & Protection (Phase 2+, contract defined now) ───────────────
  validateState,
  recoverAction,
  fallbackDebugger,
  detectProtectedFlow,
} as const;

export type InteractionEngine = typeof interactionEngine;
