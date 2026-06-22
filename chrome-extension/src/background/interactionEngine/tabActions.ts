/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/tabActions.ts
 *
 * PHASE 1 — openTab, closeTab, switchTab, refreshTab, navigate.
 * openTab / navigate wrap existing handleOpenTab behavior.
 * closeTab / switchTab / refreshTab: contract defined, implemented here.
 */

import type {
  OpenTabContext,
  CloseTabContext,
  SwitchTabContext,
  RefreshTabContext,
  NavigateContext,
  InteractionResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// openTab
// Wraps: existing handleOpenTab() behavior from automationExecutor
// ─────────────────────────────────────────────────────────────────────────────

export const openTab = async (ctx: OpenTabContext): Promise<InteractionResult> => {
  return new Promise(resolve => {
    const url = ctx.url.startsWith('http') ? ctx.url : `https://${ctx.url}`;

    chrome.tabs.create({ url, active: true }, tab => {
      if (chrome.runtime.lastError || !tab.id) {
        resolve({ status: 'failed', error: chrome.runtime.lastError?.message ?? 'tab creation failed' });
        return;
      }
      const tabId = tab.id;

      const stopTimer = setInterval(async () => {
        const res = await chrome.storage.local.get(['stop_automation_requested']);
        if (res.stop_automation_requested) {
          clearInterval(stopTimer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve({ status: 'stopped', tabId });
        }
      }, 500);

      const listener = (tid: number, info: chrome.tabs.TabChangeInfo) => {
        if (tid === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearInterval(stopTimer);
          setTimeout(() => resolve({ status: 'success', tabId }), 2500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// navigate
// Same as openTab but takes a full context (for future headers/auth support)
// ─────────────────────────────────────────────────────────────────────────────

export const navigate = async (ctx: NavigateContext): Promise<InteractionResult> => {
  const url = ctx.url.startsWith('http') ? ctx.url : `https://${ctx.url}`;

  if (ctx.tabId && ctx.tabId > 0) {
    // Navigate existing tab
    return new Promise(resolve => {
      chrome.tabs.update(ctx.tabId, { url }, tab => {
        if (chrome.runtime.lastError || !tab) {
          resolve({ status: 'failed', error: chrome.runtime.lastError?.message ?? 'navigation failed' });
          return;
        }

        const listener = (tid: number, info: chrome.tabs.TabChangeInfo) => {
          if (tid === ctx.tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            // YouTube and other heavy sites need a bit more time to settle
            setTimeout(() => resolve({ status: 'success', tabId: ctx.tabId }), 2000);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    });
  }

  // Fallback to opening new tab
  return openTab({ url: ctx.url });
};

// ─────────────────────────────────────────────────────────────────────────────
// closeTab
// Wraps: existing close_tab case (chrome.tabs.remove)
// ─────────────────────────────────────────────────────────────────────────────

export const closeTab = async (ctx: CloseTabContext): Promise<InteractionResult> => {
  try {
    await chrome.tabs.remove(ctx.tabId);
    return { status: 'success' };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// switchTab
// Wraps: chrome.tabs.update to make a tab active
// ─────────────────────────────────────────────────────────────────────────────

export const switchTab = async (ctx: SwitchTabContext): Promise<InteractionResult> => {
  try {
    await chrome.tabs.update(ctx.tabId, { active: true });
    return { status: 'success', tabId: ctx.tabId };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// refreshTab
// Wraps: chrome.tabs.reload
// ─────────────────────────────────────────────────────────────────────────────

export const refreshTab = async (ctx: RefreshTabContext): Promise<InteractionResult> => {
  try {
    await chrome.tabs.reload(ctx.tabId);
    return { status: 'success', tabId: ctx.tabId };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};
