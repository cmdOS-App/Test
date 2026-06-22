/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/debuggerActions.ts
 *
 * PHASE 1 — Debugger attachment and fingerprint enrichment.
 *
 * These are the two remaining direct chrome.debugger calls that were
 * still living in automationExecutor.ts. They are now fully isolated here.
 *
 * The executor NO LONGER knows about chrome.debugger at all.
 * It only calls:
 *   interactionEngine.attachDebugger(tabId)
 *   interactionEngine.enrichFingerprint(tabId, action)
 */

import { buildFingerprintInPage, isDynamicSelector } from '../SelectorEngine';
import type { SelectorFingerprint } from '../SelectorEngine';
import type { ModuleAction } from '../automationExecutor';

// ─────────────────────────────────────────────────────────────────────────────
// attachDebugger
// Wraps: existing attachDebugger() in automationExecutor
// Attaches CDP to a tab, silently ignoring "already attached" errors.
// ─────────────────────────────────────────────────────────────────────────────

export const attachDebugger = async (tabId: number): Promise<chrome.debugger.Debuggee> => {
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    if (!msg.includes('already attached')) {
      console.warn('[InteractionEngine] Debugger attach warning:', e?.message);
    }
  }
  return target;
};

// ─────────────────────────────────────────────────────────────────────────────
// enrichFingerprint
// Wraps: existing enrichActionWithFingerprint() in automationExecutor
//
// If an action has a dynamic/fragile selector but no fingerprint recorded,
// this auto-generates one on-the-fly from the live DOM.
// Best-effort: silently returns original action if page isn't ready yet.
// ─────────────────────────────────────────────────────────────────────────────

export const enrichFingerprint = async (tabId: number, action: ModuleAction): Promise<ModuleAction> => {
  // Already fingerprinted — skip
  if (action.selectorFingerprint) return action;

  const selector = action.selector;
  if (!selector || !isDynamicSelector(selector)) return action;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel: string, fingerprintScriptBody: string) => {
        // We have to evaluate the fingerprint script body because it's a complex utility 
        // from SelectorEngine.ts that isn't easily passed as a simple function.
        try {
          return (new Function('selector', `return (${fingerprintScriptBody})(selector)`))(sel);
        } catch (e) {
          return null;
        }
      },
      args: [selector, buildFingerprintInPage.toString()],
    });

    const fp: SelectorFingerprint | null = results?.[0]?.result ?? null;
    if (fp && fp.semantic.length > 0) {
      
      return { ...action, selectorFingerprint: fp };
    }
  } catch (err: any) {
    // Non-critical — page may not be ready
    console.debug('[InteractionEngine] enrichFingerprint (DOM) skipped:', err?.message);
  }

  return action;
};

// ─────────────────────────────────────────────────────────────────────────────
// detachDebugger
// Wraps: chrome.debugger.detach — used in the finally block of executeAutomation
// ─────────────────────────────────────────────────────────────────────────────

export const detachDebugger = (tabId: number): void => {
  chrome.debugger.detach({ tabId }).catch(() => {});
};

