/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/types.ts
 *
 * PHASE 1 — Full Interaction Contract.
 *
 * The execution engine (automationExecutor) must ONLY import from here.
 * It should never know how an interaction is implemented internally.
 *
 * Rule: executeAction() calls interactionEngine.method(context)
 *       The engine internally calls debugger / scripting / robustClick etc.
 */

import type { RobustModuleAction } from '../SelectorEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Core Context — passed to every method
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractionContext {
  /** Chrome tab ID being operated on */
  tabId: number;
  /** Pre-attached CDP debugger target. Engine will attach if absent. */
  target?: chrome.debugger.Debuggee;
  /** Full action descriptor (selector, fingerprint, value, etc.) */
  action?: RobustModuleAction;
  /** Runtime variable inputs */
  inputs?: Record<string, any>;
  /** Timeout in ms for element-dependent operations */
  timeout?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standardized Result — every method returns this
// ─────────────────────────────────────────────────────────────────────────────

export type InteractionStatus = 'success' | 'failed' | 'timeout' | 'stopped' | 'skipped';

export interface InteractionResult {
  status: InteractionStatus;
  /** Returned data — for getText, getAttribute, getValue */
  value?: any;
  /** Error message when status === 'failed' */
  error?: string;
  /** Active tab ID after the operation (may change on openTab) */
  tabId?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Element Interaction Contexts
// ─────────────────────────────────────────────────────────────────────────────

export interface ClickContext extends InteractionContext {}

export interface TypeContext extends InteractionContext {
  value: string;
}

export interface PasteContext extends InteractionContext {
  content: string;
}

export interface ScrollContext extends InteractionContext {}

export interface HoverContext extends InteractionContext {}

export interface FocusContext extends InteractionContext {}

export interface SelectContext extends InteractionContext {
  /** The option value or visible text to select */
  optionValue: string;
}

export interface UploadContext extends InteractionContext {
  images: Array<{ base64: string; mimeType: string; filename: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Contexts
// ─────────────────────────────────────────────────────────────────────────────

export interface KeyboardContext extends InteractionContext {
  /** Key name or combo string e.g. "Enter", "Ctrl+A" */
  key: string;
  modifiers?: number;
}

export interface ShortcutContext extends InteractionContext {
  /** Full shortcut string e.g. "Ctrl+Shift+P" */
  shortcut: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clipboard Contexts
// ─────────────────────────────────────────────────────────────────────────────

export interface ClipboardWriteContext extends InteractionContext {
  text: string;
}

export interface ClipboardReadContext extends InteractionContext {}

// ─────────────────────────────────────────────────────────────────────────────
// Wait Contexts
// ─────────────────────────────────────────────────────────────────────────────

export interface WaitForElementContext extends InteractionContext {}

export interface WaitForNavigationContext extends InteractionContext {
  url: string;
}

export interface WaitForStateContext extends InteractionContext {
  /** Duration in ms — used for wait_duration steps */
  ms?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Contexts (Phase 2+ implementation, Phase 1: contract only)
// ─────────────────────────────────────────────────────────────────────────────

export interface GetTextContext extends InteractionContext {}
export interface GetHTMLContext extends InteractionContext {}
export interface GetAttributeContext extends InteractionContext { attribute: string; }
export interface GetValueContext extends InteractionContext {}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Contexts
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenTabContext {
  url: string;
}

export interface CloseTabContext {
  tabId: number;
}

export interface SwitchTabContext {
  tabId: number;
}

export interface RefreshTabContext {
  tabId: number;
}

export interface NavigateContext extends InteractionContext {
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Contexts
// ─────────────────────────────────────────────────────────────────────────────

export interface CookieGetContext {
  domain: string;
  name?: string;
}

export interface CookieSetContext {
  url: string;
  name: string;
  value: string;
}

export interface CookieClearContext {
  tabId: number;
}

export interface StorageContext {
  operation: 'get' | 'set' | 'remove';
  keys?: string[];
  data?: Record<string, any>;
}

export interface ExecuteScriptContext extends InteractionContext {
  code: string;
}

export interface DispatchEventContext extends InteractionContext {
  eventName: string;
  detail?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recovery & Future Actions
// Phase 1: contract defined NOW — implementation comes in future phases.
// IMPORTANT: These MUST exist in the contract today (contract-first architecture).
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidateStateContext extends InteractionContext {
  /** Outcome-based indicators */
  expected?: {
    url_contains?: string;
    element_present?: string;
    element_absent?: string;
    text_present?: string;
    timeout_ms?: number;
  };
  /** Legacy: match DOM state exactly */
  expectedState?: Record<string, any>;
}

export interface RecoverActionContext extends InteractionContext {
  originalAction: RobustModuleAction;
  failureReason?: string;
}

export interface FallbackDebuggerContext extends InteractionContext {
  /** Raw CDP command to dispatch */
  command: string;
  params?: Record<string, any>;
}

export interface DetectProtectedFlowContext extends InteractionContext {}
