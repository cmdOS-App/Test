/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/clipboardActions.ts
 *
 * PHASE 1 — clipboardWrite and clipboardRead methods.
 * Wraps: existing clipboard_write and clipboard_paste cases in executeAction.
 */

import { robustInsertText } from '../SelectorEngine';
import type { ClipboardWriteContext, ClipboardReadContext, InteractionResult } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// clipboardWrite
// Wraps: existing clipboard_write case in executeAction
// ─────────────────────────────────────────────────────────────────────────────

export const clipboardWrite = async (ctx: ClipboardWriteContext): Promise<InteractionResult> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (val: string) => {
        navigator.clipboard.writeText(val).catch(err => {
          console.error('[InteractionEngine] clipboardWrite failed inside page:', err);
        });
      },
      args: [ctx.text],
    });
    return { status: 'success', tabId: ctx.tabId };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// clipboardRead (clipboard_paste: read clipboard → insert into element)
// Wraps: existing clipboard_paste case in executeAction
// ─────────────────────────────────────────────────────────────────────────────

export const clipboardRead = async (ctx: ClipboardReadContext): Promise<InteractionResult> => {
  if (!ctx.target || !ctx.action) {
    return { status: 'failed', error: 'clipboardRead: missing target or action' };
  }
  try {
    // 1. Read clipboard value from the page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return null;
        }
      },
    });

    const clipboardValue = results?.[0]?.result;
    if (!clipboardValue) {
      return { status: 'skipped' };
    }

    // 2. Insert the clipboard value into the target element
    const ok = await robustInsertText(ctx.target, ctx.tabId, ctx.action, clipboardValue, ctx.timeout ?? 8000);
    return ok
      ? { status: 'success', tabId: ctx.tabId, value: clipboardValue }
      : { status: 'failed', error: 'clipboardRead: element insert failed' };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};
