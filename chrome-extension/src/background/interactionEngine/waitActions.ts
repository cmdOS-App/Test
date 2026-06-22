/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/waitActions.ts
 *
 * PHASE 1 — waitForElement, waitForNavigation, waitForState.
 * Wraps: robustWaitForElement + smartWait from existing engine.
 */

import { robustWaitForElement } from '../SelectorEngine';
import type {
  WaitForElementContext,
  WaitForNavigationContext,
  WaitForStateContext,
  InteractionResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal smartWait — mirrors the one in automationExecutor / SelectorEngine.
// Centralized here so wait logic has one place to check stop signal.
// ─────────────────────────────────────────────────────────────────────────────

const smartWait = async (ms: number): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const res = await chrome.storage.local.get(['stop_automation_requested']);
    if (res.stop_automation_requested) {
      throw new Error('AutomationStoppedError');
    }
    await new Promise(r => setTimeout(r, 100));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// waitForElement
// Wraps: robustWaitForElement() from SelectorEngine
// ─────────────────────────────────────────────────────────────────────────────

export const waitForElement = async (ctx: WaitForElementContext): Promise<InteractionResult> => {
  if (!ctx.target || !ctx.action) {
    return { status: 'failed', error: 'waitForElement: missing target or action' };
  }
  try {
    const found = await robustWaitForElement(ctx.target, ctx.action, ctx.timeout ?? 10000);
    return found
      ? { status: 'success', tabId: ctx.tabId }
      : { status: 'timeout', error: 'waitForElement: element not found within timeout' };
  } catch (err: any) {
    return { status: 'failed', error: err?.message ?? String(err) };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// waitForNavigation
// Wraps: existing tab load-complete listener in handleOpenTab
// Phase 1: Opens a URL and waits for tab to be 'complete'.
// ─────────────────────────────────────────────────────────────────────────────

export const waitForNavigation = async (ctx: WaitForNavigationContext): Promise<InteractionResult> => {
  return new Promise(resolve => {
    const rawUrl = ctx.url;
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

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
          resolve({ status: 'stopped' });
        }
      }, 500);

      const listener = (tid: number, info: chrome.tabs.TabChangeInfo) => {
        if (tid === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearInterval(stopTimer);
          // 2.5s post-load settle (mirrors existing handleOpenTab behavior)
          setTimeout(() => resolve({ status: 'success', tabId }), 2500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// waitForState (wait_duration)
// Wraps: existing wait_duration / smartWait logic
// ─────────────────────────────────────────────────────────────────────────────

export const waitForState = async (ctx: WaitForStateContext): Promise<InteractionResult> => {
  const ms = ctx.ms ?? ctx.action?.ms ?? 1000;
  try {
    await smartWait(ms);
    return { status: 'success', tabId: ctx.tabId };
  } catch (err: any) {
    return { status: 'stopped', error: err?.message };
  }
};
