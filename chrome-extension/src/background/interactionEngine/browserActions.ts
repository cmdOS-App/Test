/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/browserActions.ts
 *
 * PHASE 1 — cookies, storage, executeScript, dispatchEvent.
 * Wraps: existing cookies_clear, execute_js cases, and chrome.storage calls.
 */

import type {
  CookieGetContext,
  CookieSetContext,
  CookieClearContext,
  StorageContext,
  ExecuteScriptContext,
  DispatchEventContext,
  InteractionResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// cookies namespace
// ─────────────────────────────────────────────────────────────────────────────

export const cookies = {

  /** Get cookies for a domain — Phase 1: contract + implementation */
  get: async (ctx: CookieGetContext): Promise<InteractionResult> => {
    try {
      const all = await chrome.cookies.getAll({ domain: ctx.domain, name: ctx.name });
      return { status: 'success', value: all };
    } catch (err: any) {
      return { status: 'failed', error: err?.message ?? String(err) };
    }
  },

  /** Set a cookie — Phase 1: contract + implementation */
  set: async (ctx: CookieSetContext): Promise<InteractionResult> => {
    try {
      await chrome.cookies.set({ url: ctx.url, name: ctx.name, value: ctx.value });
      return { status: 'success' };
    } catch (err: any) {
      return { status: 'failed', error: err?.message ?? String(err) };
    }
  },

  /** Clear all cookies for the active tab's domain.
   *  Wraps: existing cookies_clear case in executeAction */
  clear: async (ctx: CookieClearContext): Promise<InteractionResult> => {
    try {
      const tab = await chrome.tabs.get(ctx.tabId);
      if (!tab?.url) return { status: 'skipped' };

      const url = new URL(tab.url);
      const allCookies = await chrome.cookies.getAll({ domain: url.hostname });

      for (const cookie of allCookies) {
        const cookieUrl = `http${cookie.secure ? 's' : ''}://${
          cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
        }${cookie.path}`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name, storeId: cookie.storeId });
      }

      return { status: 'success', value: { cleared: allCookies.length } };
    } catch (err: any) {
      return { status: 'failed', error: err?.message ?? String(err) };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// storage namespace
// ─────────────────────────────────────────────────────────────────────────────

export const storage = {

  /** chrome.storage.local get/set/remove */
  local: async (ctx: StorageContext): Promise<InteractionResult> => {
    try {
      if (ctx.operation === 'get') {
        const result = await chrome.storage.local.get(ctx.keys ?? null);
        return { status: 'success', value: result };
      }
      if (ctx.operation === 'set' && ctx.data) {
        await chrome.storage.local.set(ctx.data);
        return { status: 'success' };
      }
      if (ctx.operation === 'remove' && ctx.keys) {
        await chrome.storage.local.remove(ctx.keys);
        return { status: 'success' };
      }
      return { status: 'skipped' };
    } catch (err: any) {
      return { status: 'failed', error: err?.message ?? String(err) };
    }
  },

  /** chrome.storage.session get/set/remove */
  session: async (ctx: StorageContext): Promise<InteractionResult> => {
    try {
      if (ctx.operation === 'get') {
        const result = await chrome.storage.session.get(ctx.keys ?? null);
        return { status: 'success', value: result };
      }
      if (ctx.operation === 'set' && ctx.data) {
        await chrome.storage.session.set(ctx.data);
        return { status: 'success' };
      }
      if (ctx.operation === 'remove' && ctx.keys) {
        await chrome.storage.session.remove(ctx.keys);
        return { status: 'success' };
      }
      return { status: 'skipped' };
    } catch (err: any) {
      return { status: 'failed', error: err?.message ?? String(err) };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// executeScript
// Wraps: existing execute_js case in executeAction
// ─────────────────────────────────────────────────────────────────────────────

export const executeScript = async (ctx: ExecuteScriptContext): Promise<InteractionResult> => {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: new Function(ctx.code) as any,
    });
    return { status: 'success', tabId: ctx.tabId, value: results?.[0]?.result };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// dispatchEvent — Phase 1: STUB (contract defined, Phase 2 implementation)
// ─────────────────────────────────────────────────────────────────────────────

export const dispatchEvent = async (_ctx: DispatchEventContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] dispatchEvent: stub — not yet implemented (Phase 2)');
  return { status: 'skipped' };
};
