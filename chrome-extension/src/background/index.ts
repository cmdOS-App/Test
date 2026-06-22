/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import type { AutoSubmitRequest } from './automationExecutor';
import { executeAutomation, stopCurrentAutomation, pendingAutoSubmitTabs } from './automationExecutor';
import { trackCounterEvent, isCounterEventType } from './counterTracking';
import { CMDOS_INSTALL_URL, SUPABASE_BASE_URL, SUPABASE_ANON_TOKEN } from './config';

exampleThemeStorage.get().then(theme => {
});


import { refreshCommands } from '../../../pages/Apis/features/userCommandsApiService';
import { checkIfUserRefreshNeeded, saveLocalUserCounter } from '@private-services/userRefreshCounterService';
import {
  updateTodoStatus,
  updateSnippetRealtime,
  convertSnippetToTodo,
  editTodo,
  createSnippet,
  type NewSnippet,
} from '../../../pages/Apis/features/snippetApi';

/**
 * Extract actual snippet ID - safely handles UUIDs and prefixed IDs
 */
function extractSnippetId(id: string): string {
  if (!id) return '';
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const match = id.match(uuidRegex);
  return match ? match[0] : id;
}

/**
 * Creates a notification that automatically closes after a delay
 */
function createNotification(id: string | null, options: chrome.notifications.NotificationOptions, delayMs: number = 5000) {
  const finalId = id || `notif-${Date.now()}`;
  // Ensure we have the required properties for a 'basic' notification
  const finalOptions: chrome.notifications.NotificationOptions = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: 'cmdOS Notification',
    message: '',
    ...options,
    requireInteraction: false // Force auto-close
  };

  chrome.notifications.create(finalId, finalOptions as any, (createdId) => {
    setTimeout(() => {
      chrome.notifications.clear(createdId);
    }, delayMs);
  });
}

async function backgroundSync() {
  try {
    const { needsRefresh, remoteCounter, userId } = await checkIfUserRefreshNeeded();
    if (needsRefresh) {
      await refreshCommands();
      if (userId) await saveLocalUserCounter(userId, remoteCounter);
    }

    // Also process todo maintenance (auto-done for overdue tasks)
    await processTodoMaintenance();
  } catch (err) {
    console.error('[BackgroundSync] Error:', err);
  }
}

async function processTodoMaintenance() {
  try {
    const result = await chrome.storage.local.get(['local_todos']);
    const localTodos = result.local_todos || [];
    let changed = false;

    const nowStr = new Date().toDateString();

    const filteredLocalTodos = localTodos.filter((todo: any) => {
      if (todo.is_done) {
        // Erase old done tasks from previous days
        const completionDateStr = todo.updated_at || todo.event_deadline || new Date().toISOString();
        const completionDate = new Date(completionDateStr.replace(' ', 'T'));
        if (!isNaN(completionDate.getTime()) && completionDate.toDateString() !== nowStr) {
          changed = true;
          return false;
        }
      }
      return true;
    });

    const updated = await Promise.all(
      filteredLocalTodos.map(async (todo: any) => {
        return todo;
      }),
    );

    if (changed) {
      await chrome.storage.local.set({ local_todos: updated });
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => { });
        });
      });
    }
  } catch (err) {
    console.error('[TodoMaintenance] Error:', err);
  }
}

/**
 * Automatically completes a todo (used for notification clicks)
 * Exactly mirrors the logic in TodosList.tsx
 */
async function completeTodoInBg(todoId: string) {
  try {
    const todo = await findTodoById(todoId);
    if (!todo) {
      console.warn('[Background] completeTodoInBg: Todo not found', todoId);
      return;
    }

    const sid = String(todo.snippet_id || todo.id);
    const isRecurring = !!(todo.is_recurring || todo.recurring);
    const recurringCycle = (todo.recurring_cycle || todo.recurring_frequency || 'none').toLowerCase();

    let nextDeadline = todo.event_deadline;
    let newDoneStatus = true;
    let historyTask: any = null;

    if (isRecurring && recurringCycle !== 'none') {
      const now = Date.now();
      const deadlineStr = todo.event_deadline || new Date().toISOString();
      let nextRunTime = new Date(deadlineStr.replace(' ', 'T')).getTime();
      
      // If it is a dummy "anytime" year (>= 2035), base the next recurrence on current time instead of 2075
      if (new Date(nextRunTime).getFullYear() >= 2035) {
        nextRunTime = now;
      }
      
      if (isNaN(nextRunTime)) nextRunTime = now;

      const MIN_GAP = 60 * 1000;
      while (nextRunTime <= now + MIN_GAP) {
        if (recurringCycle === 'daily') nextRunTime += 24 * 60 * 60 * 1000;
        else if (recurringCycle === 'weekly') nextRunTime += 7 * 24 * 60 * 60 * 1000;
        else if (recurringCycle === 'monthly') {
          const tempDate = new Date(nextRunTime);
          tempDate.setMonth(tempDate.getMonth() + 1);
          nextRunTime = tempDate.getTime();
        } else {
          nextRunTime += 24 * 60 * 60 * 1000;
          break;
        }
      }

      nextDeadline = new Date(nextRunTime).toISOString();
      newDoneStatus = false; // Stay active for next cycle (rescheduled)

      // 2. Create a "History" task for today's record
      historyTask = {
        ...todo,
        snippet_id: `hist-${Date.now()}`,
        id: `hist-${Date.now()}`,
        is_done: true,
        is_recurring: false, // History item is a one-time record
        event_deadline: todo.event_deadline, // Keep original deadline for today's record
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // 3. Update Local Storage
    const result = await chrome.storage.local.get(['local_todos']);
    let localTodos = result.local_todos || [];

    localTodos = localTodos.map((t: any) =>
      String(t.id || t.snippet_id) === sid
        ? { ...t, is_done: newDoneStatus, event_deadline: nextDeadline, updated_at: new Date().toISOString() }
        : t
    );

    if (historyTask) {
      localTodos = [historyTask, ...localTodos];
    }

    await chrome.storage.local.set({ local_todos: localTodos });

    // 4. Cloud Sync
    if (sid && !sid.startsWith('local-')) {
      if (isRecurring) {
        // For cloud recurring, we move the deadline and keep it active
        await editTodo(todo.todo_id || sid, nextDeadline, recurringCycle, undefined, undefined, true).catch(err => {
          console.warn('[Background] Cloud editTodo failed:', err);
        });
        await updateTodoStatus(sid, false).catch(err => {
          console.warn('[Background] Cloud updateTodoStatus failed:', err);
        });
      } else {
        await updateTodoStatus(sid, true).catch(err => {
          console.warn('[Background] Cloud updateTodoStatus failed:', err);
        });
      }
    }

    // 5. Alarm Management
    if (newDoneStatus && !isRecurring) {
      chrome.alarms.clear(`todo|${sid}`);
    } else if (isRecurring) {
      // Reschedule alarm for next occurrence
      chrome.alarms.create(`todo|${sid}`, { when: new Date(nextDeadline).getTime() });
    }

    // 6. Notify all open tabs to refresh UI
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => { });
        }
      });
    });
  } catch (err) {
    console.error('[Background] completeTodoInBg failed:', err);
  }
}

interface ActiveSessionEntry {
  sessionId: string;
  sessionName: string;
  windowId: number;
  pinnedTabId: number;
  snippetId: string | null;      // null until first real tab captured
  workspaceId: string;
  folderId: string | null;
  teamId?: string;
  storageMode?: 'local' | 'cloud';
  capturedUrls: string[];
  capturedNames: string[];
  createdAt: string;
  initialTabUrls?: Record<number, string>;
}

// In-memory map keyed by windowId for fast lookup
const activeSessions = new Map<number, ActiveSessionEntry>();

// Restore sessions from storage on SW wake-up
async function restoreActiveSessions() {
  try {
    const result = await chrome.storage.local.get('active_sessions');
    const stored: ActiveSessionEntry[] = result.active_sessions || [];
    stored.forEach(s => activeSessions.set(s.windowId, s));
  } catch (e) {
    console.error('[Session] Failed to restore sessions:', e);
  }
}
restoreActiveSessions();

function persistActiveSessions() {
  const sessions = Array.from(activeSessions.values());
  chrome.storage.local.set({ active_sessions: sessions }).catch(() => {});
}

let newTabKeystrokeRecordingTabId: number | null = null;
// Initial sync
backgroundSync();
// Periodic sync every 30 minutes
setInterval(backgroundSync, 30 * 60 * 1000);

async function executeTrustedDriveFlow(tabId: number, files: any[]) {
  try {
    // 1. Attach Debugger to bypass "User Activation" checks
    await chrome.debugger.attach({ tabId }, '1.3');

    const sendKey = async (key: string, modifiers = 0) => {
      const params = { windowsVirtualKeyCode: key.charCodeAt(0), modifiers, type: 'rawKeyDown' };
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', params);
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
    };

    // 2. Open "New" Menu (Alt + C)
    await sendKey('C', 1); // 1 = Alt
    await new Promise(r => setTimeout(r, 600));

    // 3. Inject the Interceptor into the page to catch the upcoming click
    await chrome.scripting.executeScript({
      target: { tabId },
      func: startSilentInjection,
      args: [files],
      world: 'MAIN',
    });

    // 4. Trigger File Upload command (U)
    await sendKey('U', 0);

    // Detach after some time
    setTimeout(() => {
      chrome.debugger.detach({ tabId });
    }, 1500);

    return { success: true };
  } catch (e: any) {
    console.error('[Background] Automation failed:', e);
    chrome.debugger.detach({ tabId });
    return { success: false, error: e.message || String(e) };
  }
}

const CDP_PICKER_FUNCTION = /* js */ `
  function() {
    const el = this;
    const isPlaceholderNode = node => {
      if (!node || !node.getAttribute) return false;
      const placeholderText =
        node.getAttribute('data-empty-text') ||
        node.getAttribute('data-placeholder') ||
        node.getAttribute('aria-placeholder') ||
        '';
      const isPlaceholderClass = node.classList && node.classList.contains('editor-placeholder');
      return !!placeholderText || !!isPlaceholderClass;
    };

    const getInteractiveParent = node => {
      if (!node) return node;
      if (isPlaceholderNode(node)) {
        const editor = node.closest('[contenteditable="true"], [role="textbox"]');
        if (editor) return editor;
      }
      const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
      let current = node;
      while (current && current.tagName && current.tagName !== 'BODY') {
        if (
          interactiveTags.includes(current.tagName) ||
          current.getAttribute('role') === 'button' ||
          current.isContentEditable ||
          current.getAttribute('contenteditable') === 'true' ||
          current.getAttribute('role') === 'textbox' ||
          current.onclick
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return node;
    };

    const getElementName = node => {
      if (!node || !node.getAttribute) return '';
      const ariaLabel = node.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      const labelledBy = node.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
      }
      if (node.id) {
        const label = document.querySelector('label[for="' + node.id + '"]');
        if (label && label.textContent) return label.textContent.trim();
      }
      const parentLabel = node.closest && node.closest('label');
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true);
        clone.querySelectorAll('input, textarea, select').forEach(c => c.remove());
        const text = clone.textContent && clone.textContent.trim();
        if (text) return text;
      }
      const nameAttr = node.getAttribute('name');
      if (nameAttr) return nameAttr;
      const placeholder =
        node.getAttribute('placeholder') ||
        node.getAttribute('data-empty-text') ||
        node.getAttribute('data-placeholder') ||
        node.getAttribute('aria-placeholder');
      if (placeholder) return placeholder;
      if (
        node.isContentEditable ||
        node.getAttribute('contenteditable') === 'true' ||
        node.getAttribute('role') === 'textbox'
      ) {
        const placeholderNode = node.querySelector(
          '[data-empty-text], [data-placeholder], [aria-placeholder], .editor-placeholder',
        );
        if (placeholderNode) {
          const derived =
            placeholderNode.getAttribute('data-empty-text') ||
            placeholderNode.getAttribute('data-placeholder') ||
            placeholderNode.getAttribute('aria-placeholder');
          if (derived) return derived;
        }
      }
      const titleAttr = node.getAttribute('title');
      if (titleAttr) return titleAttr;
      return '';
    };

    const getUniqueSelector = node => {
      if (!node) return '';
      if (node instanceof ShadowRoot) {
        const host = node.host;
        return host ? getUniqueSelector(host) + ' >>> ' : '';
      }

      const shouldSnap =
        ['SVG', 'PATH', 'SPAN', 'I', 'IMG'].includes(node.tagName) ||
        isPlaceholderNode(node);
      if (shouldSnap) {
        const snapped = getInteractiveParent(node);
        if (snapped && snapped !== node) {
          return getUniqueSelector(snapped);
        }
      }

      if (node.id && !/^\\d/.test(node.id) && !/[a-f0-9]{8,}/i.test(node.id)) {
        return '#' + node.id;
      }
      if (node.tagName === 'BODY') return 'body';

      const stableAttrs = ['data-testid', 'data-id', 'data-automation', 'data-qa', 'aria-label'];
      for (const attr of stableAttrs) {
        const val = node.getAttribute && node.getAttribute(attr);
        if (val) return '[' + attr + '=\"' + val + '\"]';
      }

      let selector = node.tagName.toLowerCase();
      const classes = Array.from(node.classList || []).filter(c => {
        if (c.includes(':') || c.includes('[') || c.includes('theme-')) return false;
        if (/^(sc-|css-|jss-|style-)/i.test(c)) return false;
        if (/[a-z0-0]{6,}/i.test(c)) return false;
        const stateKeywords = [
          'focus',
          'hover',
          'active',
          'select',
          'open',
          'close',
          'hide',
          'show',
          'visible',
          'hidden',
          'loading',
          'disabled',
          'expanded',
          'collapsed',
          'checked',
          'pressed',
          'current',
          'dragging',
          'dropping',
          'invalid',
          'valid',
          'required',
          'is-',
          'has-',
          '-',
        ];
        const low = c.toLowerCase();
        if (stateKeywords.some(k => low.includes(k))) {
          if (low.includes('focus') || low.includes('hover') || low.includes('active') || low.includes('is') || low.includes('has')) {
            return false;
          }
        }
        return true;
      });

      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }

      const parent = node.parentElement || (node.parentNode instanceof ShadowRoot ? node.parentNode : null);
      if (parent) {
        const siblings = Array.from(parent.children || []).filter(s => s.tagName === node.tagName);
        if (siblings.length > 1) {
          const index = Array.from(parent.children || []).indexOf(node) + 1;
          selector += ':nth-child(' + index + ')';
        }
        const parentSelector = getUniqueSelector(parent);
        if (parentSelector.endsWith(' >>> ')) {
          return parentSelector + selector;
        }
        return parentSelector + ' > ' + selector;
      }
      return selector;
    };

    const target = getInteractiveParent(el);
    const selector = getUniqueSelector(target);
    const elementName = getElementName(target);
    const nameFallback =
      (target.innerText || '').trim().split('\\n')[0].substring(0, 40) ||
      target.placeholder ||
      (target.getAttribute && target.getAttribute('data-empty-text')) ||
      (target.getAttribute && target.getAttribute('data-placeholder')) ||
      (target.getAttribute && target.getAttribute('aria-placeholder')) ||
      target.title ||
      target.id ||
      target.tagName.toLowerCase();

    return {
      selector,
      elementName,
      name: elementName || nameFallback,
    };
  }
`;

const isDebuggerAlreadyAttached = (message: string) =>
  message.includes('Another debugger is already attached') || message.includes('already attached');

async function pickElementViaCdp(tabId: number, x: number, y: number) {
  const target = { tabId };
  let attachedHere = false;

  try {
    await chrome.debugger.attach(target, '1.3');
    attachedHere = true;
  } catch (err: any) {
    const message = err?.message || chrome.runtime.lastError?.message || String(err);
    if (!isDebuggerAlreadyAttached(message)) {
      throw err;
    }
  }

  try {
    await chrome.debugger.sendCommand(target, 'DOM.enable');
    await chrome.debugger.sendCommand(target, 'Runtime.enable');

    const nodeResult: any = await chrome.debugger.sendCommand(target, 'DOM.getNodeForLocation', {
      x,
      y,
      includeUserAgentShadowDOM: true,
      ignorePointerEventsNone: true,
    });

    const nodeId = nodeResult?.nodeId;
    if (!nodeId) throw new Error('cdp_node_not_found');

    const resolved: any = await chrome.debugger.sendCommand(target, 'DOM.resolveNode', { nodeId });
    const objectId = resolved?.object?.objectId;
    if (!objectId) throw new Error('cdp_object_not_found');

    const result: any = await chrome.debugger.sendCommand(target, 'Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: CDP_PICKER_FUNCTION,
      returnByValue: true,
    });

    return result?.result?.value || null;
  } finally {
    if (attachedHere) {
      chrome.debugger.detach(target).catch(() => { });
    }
  }
}

// --- THIS FUNCTION RUNS INSIDE THE GOOGLE DRIVE TAB ---
function startSilentInjection(filesToUpload: any[]) {
  // BLOCK the OS File Picker from opening by catching the click at the window level
  const blockOSPicker = (e: any) => {
    if (e.target.type === 'file') {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('click', blockOSPicker, { capture: true, once: true });

  const notify = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;top:20px;right:20px;background:#1a73e8;color:white;padding:12px 24px;border-radius:24px;z-index:999999;font-family:Arial;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 3000);
  };

  let attempts = 0;
  const hunt = setInterval(() => {
    // Drive's hidden input usually has a 'change' listener
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      clearInterval(hunt);
      try {
        const dataTransfer = new DataTransfer();
        filesToUpload.forEach(f => {
          // Handle both raw base64 and full Data URLs
          const parts = f.base64.split(',');
          const base64Data = parts.length > 1 ? parts[1] : parts[0];
          const binary = atob(base64Data);

          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          // Attempt to extract MIME type if it was a Data URL
          let mimeType = 'text/plain';
          if (parts.length > 1) {
            const match = parts[0].match(/:(.*?);/);
            if (match) mimeType = match[1];
          }

          dataTransfer.items.add(new File([bytes], f.filename, { type: mimeType }));
        });

        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        notify('🚀 AI Upload Started!');
      } catch (err) {
        console.error('[AI-Drive] Injection error:', err);
      }
    }
    if (attempts++ > 60) {
      clearInterval(hunt);
    }
  }, 100);
}

const TOGGLE_ALTS_MESSAGE = 'tasklabs:toggle-alts-popup';
const TOGGLE_ALTQ_MESSAGE = 'tasklabs:toggle-altq-popup';

interface PendingAiSession {
  id: string;
  prompt: string;
  models: string[];
  tabIds: number[];
  urls: Record<string, string>;
  timestamp: number;
}
const pendingAiSessions = new Map<string, PendingAiSession>();

// Track prompt queues per tab to handle sequential submission
const tabPromptQueues = new Map<number, AutoSubmitRequest[]>();
const processingTabs = new Set<number>();

let stateRestoredPromise: Promise<void> | null = null;
function ensureStateRestored() {
  if (!stateRestoredPromise) {
    stateRestoredPromise = (async () => {
      if (!chrome.storage?.session) return;
      const data = await chrome.storage.session.get(['pendingAiSessions', 'tabPromptQueues', 'processingTabs']);
      if (data.pendingAiSessions) {
        try {
          const parsed = JSON.parse(data.pendingAiSessions);
          for (const [k, v] of Object.entries(parsed)) pendingAiSessions.set(k, v as any);
        } catch(e) {}
      }
      if (data.tabPromptQueues) {
        try {
          const parsed = JSON.parse(data.tabPromptQueues);
          for (const [k, v] of Object.entries(parsed)) tabPromptQueues.set(Number(k), v as any);
        } catch(e) {}
      }
      if (data.processingTabs) {
        try {
          const parsed = JSON.parse(data.processingTabs);
          parsed.forEach((v: number) => processingTabs.add(v));
        } catch(e) {}
      }
    })();
  }
  return stateRestoredPromise;
}

function persistState() {
  if (!chrome.storage?.session) return;
  chrome.storage.session.set({
    pendingAiSessions: JSON.stringify(Object.fromEntries(pendingAiSessions)),
    tabPromptQueues: JSON.stringify(Object.fromEntries(tabPromptQueues)),
    processingTabs: JSON.stringify(Array.from(processingTabs))
  }).catch(() => {});
}

// Override Map/Set methods to auto-persist
const _aiSet = pendingAiSessions.set.bind(pendingAiSessions);
pendingAiSessions.set = (k, v) => { const r = _aiSet(k, v); persistState(); return r; };
const _aiDel = pendingAiSessions.delete.bind(pendingAiSessions);
pendingAiSessions.delete = (k) => { const r = _aiDel(k); persistState(); return r; };

const _tpqSet = tabPromptQueues.set.bind(tabPromptQueues);
tabPromptQueues.set = (k, v) => { const r = _tpqSet(k, v); persistState(); return r; };
const _tpqDel = tabPromptQueues.delete.bind(tabPromptQueues);
tabPromptQueues.delete = (k) => { const r = _tpqDel(k); persistState(); return r; };

const _ptAdd = processingTabs.add.bind(processingTabs);
processingTabs.add = (k) => { const r = _ptAdd(k); persistState(); return r; };
const _ptDel = processingTabs.delete.bind(processingTabs);
processingTabs.delete = (k) => { const r = _ptDel(k); persistState(); return r; };

async function processTabQueue(tabId: number) {
  if (processingTabs.has(tabId)) {
    return;
  }

  const queue = tabPromptQueues.get(tabId);
  if (!queue || queue.length === 0) {
    return;
  }

  const nextRequest = queue[0]; // Peek
  processingTabs.add(tabId);

  // 🔥 SAFETY TIMEOUT: Unblock tab after 30 seconds if prompt_injected_success is never received
  // This prevents the entire queue for this tab from being permanently stalled.
  setTimeout(() => {
    if (processingTabs.has(tabId)) {
      console.warn('[BG-v2] Safety timeout reached for tab', tabId, '- unblocking queue');
      processingTabs.delete(tabId);
      processTabQueue(tabId);
    }
  }, 30000);

  // Note: We keep the request in the queue until it succeeds or fails to ensure retry/stability if needed,
  // but for now we shift it right before execution to treat it as "active".
  queue.shift();

  try {
    await executeAutoSubmit(tabId, nextRequest);
    processingTabs.delete(tabId);
    processTabQueue(tabId); // Process next in queue
  } catch (err) {
    console.error('[BG-v2] Error processing tab queue:', err);
    processingTabs.delete(tabId);
    // Optional: wait before retry
    setTimeout(() => processTabQueue(tabId), 2000);
  }
}

chrome.runtime.onInstalled.addListener(async details => {
  setupContextMenus();

  // Note: alts_commands is now populated by the API when user logs in
  // We no longer seed static commands here

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await chrome.storage.local.set({ omnibox_override_enabled: false });

    const tutorialUrl = CMDOS_INSTALL_URL;


    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: tutorialUrl }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.warn('[onInstalled] failed to open tutorials tab:', lastError.message);
        }
      });
    } else {
      console.warn('[onInstalled] chrome.tabs unavailable; unable to auto-open tutorials.');
    }
  }

  // Note: alts_commands is populated by API when user logs in - no static seeding
  const result = await chrome.storage.local.get(['myFavouriteItems']);

  // Set uninstall redirect URL to feedback form
  const uninstallFeedbackUrl = 'https://docs.google.com/forms/d/1YAm02YiQfcc4HoV-XtN1WMkihAL__GH2nwDKkWsMNgI/edit';
  if (chrome.runtime?.setUninstallURL) {
    chrome.runtime.setUninstallURL(uninstallFeedbackUrl, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.warn('[onInstalled] Failed to set uninstall URL:', lastError.message);
      } else {
      }
    });
  }
});

// Scheduling Handler: Trigger automation when an alarm fires
/**
 * Shows a beautiful toast notification in the active tab
 */
async function showInTabToast(title: string, message: string) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.id) {
      console.warn('[Background] No active tab with ID found for toast');
      return;
    }

    const isRestricted = tab.url?.startsWith('chrome://') && !tab.url?.includes('newtab');
    const isOurExtension =
      tab.url?.startsWith('chrome-extension://' + chrome.runtime.id) || tab.url?.includes('newtab');

    if (isRestricted && !isOurExtension) {
      console.warn('[Background] Cannot show toast on a restricted system page:', tab.url);
      return;
    }
    // If it's our extension page, we MUST use sendMessage as executeScript is restricted
    if (isOurExtension) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'SHOW_TOAST',
          message: `${title}: ${message}`,
          toastType: 'info',
        })
        .catch(err => console.warn('[Background] Failed to send toast message to extension tab:', err));
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t: string, m: string) => {
        const id = 'cmdos-toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = id;
        toast.innerHTML = `
          <div style="
            position: fixed; top: 24px; right: 24px; z-index: 2147483647;
            background: rgba(18, 18, 18, 0.95); backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #3b82f6;
            border-radius: 16px; padding: 16px 20px; width: 320px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white; transform: translateX(400px); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; flex-direction: column; gap: 4px;
          ">
            <div style="font-size: 14px; font-weight: 700; color: #3b82f6; letter-spacing: 0.5px;">${t}</div>
            <div style="font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9); line-height: 1.4;">${m}</div>
            <div style="margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.4);">Click to dismiss</div>
          </div>
        `;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
          const el = toast.firstElementChild as HTMLElement;
          if (el) el.style.transform = 'translateX(0)';
        });

        // Auto dismiss
        const dismiss = () => {
          const el = toast.firstElementChild as HTMLElement;
          if (el) el.style.transform = 'translateX(400px)';
          setTimeout(() => toast.remove(), 500);
        };
        toast.onclick = dismiss;
        setTimeout(dismiss, 5000);
      },
      args: [title, message],
    });
  } catch (err) {
    console.error('[Background] Failed to show in-tab toast:', err);
  }
}

/**
 * Helper to update local_todos in storage from background
 */
async function updateLocalTodo(todoId: string, updates: any) {
  try {
    const result = await chrome.storage.local.get(['local_todos']);
    const localTodos = result.local_todos || [];
    const actualId = extractSnippetId(todoId);

    let found = false;
    const updated = localTodos.map((t: any) => {
      const tid = String(t.id || t.snippet_id);
      if (tid === String(todoId) || tid === String(actualId)) {
        found = true;
        return { ...t, ...updates };
      }
      return t;
    });

    if (!found) {
      // If not in local_todos yet, add it as a new tracking entry
      updated.push({
        snippet_id: todoId,
        id: todoId,
        is_todo_type: true,
        ...updates,
      });
    }

    await chrome.storage.local.set({ local_todos: updated });
  } catch (err) {
    console.error('[Background] Failed to update local storage:', err);
  }
}

/**
 * Deep search for a todo object in all available caches
 */
async function findTodoById(todoId: string): Promise<any | null> {
  return new Promise(resolve => {
    chrome.storage.local.get(['local_todos', 'cached_todos', 'myCachedAllData', 'myFavouriteItems'], result => {
      const actualId = extractSnippetId(todoId);
      // Always compare as strings to handle numeric IDs (e.g. module_id: 9 vs "9")
      const matches = (a: any, b: any) => {
        if (a === undefined || a === null || b === undefined || b === null) return false;
        return String(a) === String(b);
      };

      // 1. Check local_todos and cached_todos
      const localTodos = result.local_todos || [];
      const cachedTodos = result.cached_todos || [];
      const allTodos = [...localTodos, ...cachedTodos];
      const match = allTodos.find(
        (t: any) =>
          matches(t.id, todoId) ||
          matches(t.snippet_id, todoId) ||
          matches(t.todo_id, todoId) ||
          matches(t.id, actualId) ||
          matches(t.snippet_id, actualId) ||
          matches(t.todo_id, actualId),
      );
      if (match) {
        resolve({
          ...match,
          id: match.id || match.snippet_id,
          category: match.category || match.snippet_category || 'snippet',
        });
        return;
      }

      // 2. Check Favourites
      const favourites = result.myFavouriteItems;
      if (favourites && typeof favourites === 'object') {
        for (const userId of Object.keys(favourites)) {
          const userFavs = favourites[userId];
          if (Array.isArray(userFavs)) {
            const match = userFavs.find((item: any) => {
              const itemId = item.id || item.snippet_id;
              return matches(itemId, actualId) || matches(itemId, todoId);
            });
            if (match) {
              resolve({
                ...match,
                id: match.id || match.snippet_id,
                category: match.category || match.snippet_category || 'snippet',
              });
              return;
            }
          }
        }
      }

      // 3. Check Cached Data
      const allData = result.myCachedAllData;
      if (Array.isArray(allData)) {
        for (const team of allData) {
          for (const workspace of team.workspaces || []) {
            const wsSnippets = workspace.workspace_snippets || [];
            const wsMatch = wsSnippets.find((s: any) => {
              const sid = s.id || s.snippet_id;
              return matches(sid, actualId) || matches(sid, todoId);
            });
            if (wsMatch) {
              resolve({
                ...wsMatch,
                id: wsMatch.id || wsMatch.snippet_id,
                category: wsMatch.category || wsMatch.snippet_category || 'snippet',
              });
              return;
            }

            for (const folder of workspace.folders || []) {
              const folderSnippets = folder.snippets || [];
              const folderMatch = folderSnippets.find((s: any) => {
                const sid = s.id || s.snippet_id;
                return matches(sid, actualId) || matches(sid, todoId);
              });
              if (folderMatch) {
                resolve({
                  ...folderMatch,
                  id: folderMatch.id || folderMatch.snippet_id,
                  category: folderMatch.category || folderMatch.snippet_category || 'snippet',
                });
                return;
              }
            }
          }
        }
      }
      resolve(null);
    });
  });
}

/**
 * Execute the action associated with a Todo (Open URL, Note, or Automation)
 */
async function executeTodoAction(todoId: string) {
  try {
    const todo = await findTodoById(todoId);
    if (!todo) {
      console.warn('[Background] Cannot execute action: Todo not found:', todoId);
      return;
    }

    // A. Check if this is a config-based multi-item todo
    let config = todo.config;
    if (typeof config === 'string' && config.trim().startsWith('{')) {
      try {
        config = JSON.parse(config);
      } catch (e) {
        console.error('[Background] Failed to parse todo config:', config, e);
      }
    }

    const configIds = config?.id;
    if (Array.isArray(configIds) && configIds.length > 0) {
      const result = await new Promise<any>(resolve => {
        chrome.storage.local.get(['myCachedAllData', 'myFavouriteItems', 'local_todos', 'alts_commands'], resolve);
      });

      const allData = result.myCachedAllData || [];
      const favourites = result.myFavouriteItems || {};
      const localTodos = result.local_todos || [];
      const altsCommands = result.alts_commands || [];

      const findItemDetails = (itemId: string) => {
        const cidStr = String(itemId);
        const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');

        let matched = altsCommands.find((c: any) => {
          const cIdStr = String(c.id || '');
          const strippedCId = cIdStr.replace(/^(auto-|cmd-|mod-)/, '');
          return cIdStr === cidStr || strippedCId === strippedCid;
        });
        if (matched) return matched;

        for (const userId of Object.keys(favourites)) {
          const userFavs = favourites[userId];
          if (Array.isArray(userFavs)) {
            matched = userFavs.find((item: any) => {
              const itemIdStr = String(item.id || item.snippet_id || '');
              const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-)/, '');
              return itemIdStr === cidStr || strippedItemId === strippedCid;
            });
            if (matched) return matched;
          }
        }

        if (Array.isArray(allData)) {
          for (const team of allData) {
            for (const workspace of team.workspaces || []) {
              const wsSnippets = workspace.workspace_snippets || [];
              matched = wsSnippets.find((s: any) => {
                const sIdStr = String(s.id || s.snippet_id || '');
                const strippedSId = sIdStr.replace(/^(auto-|cmd-|mod-)/, '');
                return sIdStr === cidStr || strippedSId === strippedCid;
              });
              if (matched) return matched;

              const wsAutos = workspace.workspace_automations || [];
              matched = wsAutos.find((a: any) => {
                const aIdStr = String(a.id || a.automation_id || '');
                const strippedAId = aIdStr.replace(/^(auto-|cmd-|mod-)/, '');
                return aIdStr === cidStr || strippedAId === strippedCid;
              });
              if (matched) return matched;

              for (const folder of workspace.folders || []) {
                const folderSnippets = folder.snippets || [];
                matched = folderSnippets.find((s: any) => {
                  const sIdStr = String(s.id || s.snippet_id || '');
                  const strippedSId = sIdStr.replace(/^(auto-|cmd-|mod-)/, '');
                  return sIdStr === cidStr || strippedSId === strippedCid;
                });
                if (matched) return matched;
              }
            }
          }
        }

        return null;
      };

      for (const cid of configIds) {
        const matched = findItemDetails(cid);
        if (matched) {
          const matchedCat = (matched.category || matched.snippet_category || '').toLowerCase();
          const itemVal = matched.value || matched.data?.value || matched.data?.url || matched.data?.link || '';
          const itemId = matched.id || matched.snippet_id;

          if (['link', 'tabgroup', 'tab group', 'links', 'quicklink', 'collection', 'agent_collection'].includes(matchedCat)) {
            const urls: string[] = [];
            if (typeof itemVal === 'string') {
              try {
                if (itemVal.trim().startsWith('{') || itemVal.trim().startsWith('[')) {
                  const parsed = JSON.parse(itemVal);
                  if (parsed?.urls) {
                    parsed.urls.forEach((u: any) => urls.push(u));
                  }
                } else if (itemVal.startsWith('http')) {
                  urls.push(itemVal);
                }
              } catch (e) {
                if (itemVal.startsWith('http')) {
                  urls.push(itemVal);
                }
              }
            }
            urls.forEach(url => {
              if (url && typeof url === 'string') {
                chrome.tabs.create({ url });
              }
            });
          } else if (['note', 'snippet', 'prompt', 'custom'].includes(matchedCat)) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`
              )
            });
          } else {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `new-tab/index.html?trigger_hotkey=true&type=${matchedCat}&id=${encodeURIComponent(itemId)}`
              )
            });
          }
        }
      }

      // Mark as done locally or update cloud status
      if (String(todoId).startsWith('local-')) {
        const result = await chrome.storage.local.get(['local_todos']);
        const localTodos = (result.local_todos || []).map((t: any) =>
          t.id === todoId || t.snippet_id === todoId ? { ...t, is_done: true } : t,
        );
        await chrome.storage.local.set({ local_todos: localTodos });
      } else {
        await updateTodoStatus(todo.snippet_id || todo.id, true).catch(() => { });
      }
      return;
    }

    const category = (todo.category || todo.snippet_category || 'note').toLowerCase();
    const value = todo.value;
    const snippetId = todo.snippet_id || todo.id;
    if (['link', 'tabgroup', 'tab group', 'links', 'quicklink', 'collection', 'agent_collection'].includes(category)) {
      // Handle URLs
      let urls: string[] = [];
      try {
        if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
          const parsed = JSON.parse(value);
          urls = parsed.urls || [];
        } else if (typeof value === 'string' && value.startsWith('http')) {
          urls = [value];
        } else if (todo.urls) {
          urls = todo.urls;
        }
      } catch (e) { }

      urls.forEach(url => {
        if (url && typeof url === 'string') {
          chrome.tabs.create({ url });
        }
      });
    } else if (['note', 'snippet', 'prompt'].includes(category)) {
      const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`);
      chrome.tabs.create({ url });
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent'].includes(category)) {
      const url = chrome.runtime.getURL(
        `new-tab/index.html?trigger_hotkey=true&type=${category}&id=${encodeURIComponent(value || snippetId)}`,
      );
      chrome.tabs.create({ url });
    }

    // Mark as done locally if it was a local task
    if (String(todoId).startsWith('local-')) {
      const result = await chrome.storage.local.get(['local_todos']);
      const localTodos = (result.local_todos || []).map((t: any) =>
        t.id === todoId || t.snippet_id === todoId ? { ...t, is_done: true } : t,
      );
      await chrome.storage.local.set({ local_todos: localTodos });
    } else {
      // For cloud tasks, we could update status via API, but background script might not have auth context.
      // Usually, the frontend will sync this when it next loads.
      await updateTodoStatus(snippetId, true).catch(() => { });
    }
  } catch (err) {
    console.error('[Background] executeTodoAction failed:', err);
  }
}

/**
 * Shared logic to resolve a snippet/tabgroup/note by ID and execute it (multiple tabs, etc.)
 */
function resolveAndExecuteSnippet(compoundId: string, sendResponse?: (res: any) => void) {
  if (!compoundId) {
    if (sendResponse) sendResponse({ ok: false, error: 'missing_snippet_id' });
    return;
  }

  const actualSnippetId = extractSnippetId(compoundId);

  chrome.storage.local.get(['myFavouriteItems', 'myCachedAllData', 'local_todos'], result => {
    try {
      let foundSnippet: any = null;

      const extractUrls = (snippet: any): string[] => {
        const value = snippet?.value;
        if (!value) return [];
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (parsed?.urls && Array.isArray(parsed.urls)) {
              return parsed.urls.filter(
                (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
              );
            }
          } catch {
            if (value.startsWith('http') || value.startsWith('note:')) return [value];
          }
          return [];
        }
        if (typeof value === 'object' && value?.urls && Array.isArray(value.urls)) {
          return value.urls.filter(
            (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
          );
        }
        return [];
      };

      // 1. Search Local Todos
      const localTodos = result?.local_todos || [];
      foundSnippet = localTodos.find((t: any) => t.id === compoundId || t.id === actualSnippetId);

      // 2. Search Favourites
      if (!foundSnippet) {
        const favourites = result?.myFavouriteItems;
        if (favourites && typeof favourites === 'object') {
          for (const userId of Object.keys(favourites)) {
            const userFavs = favourites[userId];
            if (Array.isArray(userFavs)) {
              for (const item of userFavs) {
                const itemId = item?.id || item?.snippet_id;
                if (itemId === compoundId || itemId === actualSnippetId) {
                  foundSnippet = item;
                  break;
                }
              }
            }
            if (foundSnippet) break;
          }
        }
      }

      // 3. Search All Cached Data
      if (!foundSnippet) {
        const allData = result?.myCachedAllData;
        if (Array.isArray(allData)) {
          for (const team of allData) {
            if (!team?.workspaces) continue;
            for (const workspace of team.workspaces) {
              const wsSnippets = workspace?.workspace_snippets || [];
              for (const snippet of wsSnippets) {
                const snipId = snippet?.id || snippet?.snippet_id;
                if (snipId === compoundId || snipId === actualSnippetId) {
                  foundSnippet = snippet;
                  break;
                }
              }
              if (foundSnippet) break;

              const folders = workspace?.folders || [];
              for (const folder of folders) {
                const folderSnippets = folder?.snippets || [];
                for (const snippet of folderSnippets) {
                  const snipId = snippet?.id || snippet?.snippet_id;
                  if (snipId === compoundId || snipId === actualSnippetId) {
                    foundSnippet = snippet;
                    break;
                  }
                }
                if (foundSnippet) break;
              }
              if (foundSnippet) break;
            }
            if (foundSnippet) break;
          }
        }
      }

      if (!foundSnippet) {
        console.warn('[Background] Snippet not found:', { compoundId });
        if (sendResponse) sendResponse({ ok: false, error: 'snippet_not_found' });
        return;
      }

      let urls = extractUrls(foundSnippet);
      const category = (foundSnippet.category || foundSnippet.snippet_category || '').toLowerCase();

      if (urls.length === 0 && (category === 'note' || category === 'snippet')) {
        const snippetId = foundSnippet.id || foundSnippet.snippet_id;
        if (snippetId) {
          urls = [chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`)];
        }
      }

      if (!urls.length) {
        if (sendResponse) sendResponse({ ok: false, error: 'no_urls_found' });
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
        const currentTab = tabs?.[0];
        const resolvedUrls: string[] = [];

        for (const url of urls) {
          if (url.startsWith('note:')) {
            const noteId = url.substring(5);
            // Re-store editSnippetData for the editor
            const allData = result?.myCachedAllData;
            let foundNote: any = null;
            if (Array.isArray(allData)) {
              for (const team of allData) {
                for (const ws of team.workspaces || []) {
                  for (const snip of ws.workspace_snippets || []) {
                    if ((snip.id || snip.snippet_id) === noteId) {
                      foundNote = snip;
                      break;
                    }
                  }
                  if (foundNote) break;
                }
                if (foundNote) break;
              }
            }
            if (foundNote) {
              await chrome.storage.local.set({
                editSnippetData: {
                  snippet_id: noteId,
                  key: foundNote.key || foundNote.title || '',
                  category: foundNote.category || 'snippet',
                },
              });
            }
            resolvedUrls.push(chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${noteId}`));
          } else {
            resolvedUrls.push(url);
          }
        }

        if (resolvedUrls.length === 1) {
          if (currentTab?.id) {
            chrome.tabs.update(currentTab.id, { url: resolvedUrls[0] }, () => sendResponse?.({ ok: true }));
          } else {
            chrome.tabs.create({ url: resolvedUrls[0] }, () => sendResponse?.({ ok: true }));
          }
        } else {
          const [first, ...rest] = resolvedUrls;
          if (currentTab?.id) {
            chrome.tabs.update(currentTab.id, { url: first }, () => {
              rest.forEach(u => chrome.tabs.create({ url: u, active: false }));
              sendResponse?.({ ok: true });
            });
          } else {
            chrome.tabs.create({ url: first }, () => {
              rest.forEach(u => chrome.tabs.create({ url: u, active: false }));
              sendResponse?.({ ok: true });
            });
          }
        }
      });
    } catch (err) {
      console.error('[Background] resolveAndExecuteSnippet error:', err);
      if (sendResponse) sendResponse({ ok: false, error: String(err) });
    }
  });
}
// Alarms are handled at the end of the file to ensure all dependencies are loaded.

// Listen for create actions from the content script overlay
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'tasklabs:execute-create-action') {
    const action = message.action; // e.g., 'createnotes', 'createlinks'
    const extensionUrl = chrome.runtime.getURL(`new-tab/index.html?open_sheet=${action}`);
    chrome.tabs.create({ url: extensionUrl, active: true });
  }
});

chrome.commands?.onCommand?.addListener(command => {
  if (!chrome.tabs?.query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs?.[0];
    const activeTabId = activeTab?.id;
    const activeUrl = activeTab?.url || '';
    const isNewTabPage = activeUrl.startsWith(chrome.runtime.getURL('new-tab/'));

    if (typeof activeTabId === 'number' && newTabKeystrokeRecordingTabId === activeTabId && isNewTabPage) {
      return;
    }
    if (command === 'open_alt_q') {
      const isActualNewTabPage =
        isNewTabPage ||
        activeUrl.startsWith('chrome://newtab') ||
        activeUrl.startsWith('chrome://new-tab-page') ||
        activeUrl.startsWith('about:blank');

      if (isNewTabPage && typeof activeTabId === 'number') {
        chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:force-board-view' }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) console.warn('[commands] open_alt_q message error:', lastError.message);
        });
      } else if (isActualNewTabPage && typeof activeTabId === 'number') {
        // Build per-tab storage key
        const focusKey = `new_tab_focus_${activeTabId}`;
        // Try reading the per-tab key first; if undefined, fall back to the old shared key
        chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], (result) => {
          const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
          if (hasFocus) {
            chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:force-board-view' }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) console.warn('[commands] open_alt_q message error:', lastError.message);
            });
          } else {
            // Cursor is stuck in the Omnibox — must replace tab to steal focus back.
            const extensionUrl = chrome.runtime.getURL('new-tab/index.html?force_board_view=true');
            chrome.tabs.create({ url: extensionUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          }
        });
      } else {
        // We are on an external site! Trigger Alt+S functionality (Command Palette)
        if (typeof activeTabId === 'number') {
          chrome.tabs.sendMessage(activeTabId, { type: TOGGLE_ALTQ_MESSAGE }, () => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              console.warn('[commands] toggle_altq message error:', lastError.message);
            }
          });
        }
      }
    }

    // Clean up per‑tab focus flags when a New‑Tab page is closed
chrome.tabs.onRemoved.addListener((closedTabId, removeInfo) => {
  const focusKey = `new_tab_focus_${closedTabId}`;
  chrome.storage.local.remove(focusKey, () => {
    if (chrome.runtime.lastError) {
      console.warn('[cleanup] error removing focus key for closed tab', closedTabId, ':', chrome.runtime.lastError.message);
    } else {
    }
  });
});

    if (command === 'open_create') {
      if (!chrome.tabs?.query) return;

      const isActualNewTabPage =
        isNewTabPage ||
        activeUrl.startsWith('chrome://newtab') ||
        activeUrl.startsWith('chrome://new-tab-page') ||
        activeUrl.startsWith('about:blank');

      if (isNewTabPage && typeof activeTabId === 'number') {
        chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) console.warn('[commands] open_create message error:', lastError.message);
        });
      } else if (isActualNewTabPage && typeof activeTabId === 'number') {
        // Build per-tab storage key
        const focusKey = `new_tab_focus_${activeTabId}`;
        chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], (result) => {
          const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
          if (hasFocus) {
            chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) console.warn('[commands] open_create message error:', lastError.message);
            });
          } else {
            // Cursor is stuck in the Omnibox — must replace tab to steal focus back.
            const extensionUrl = chrome.runtime.getURL('new-tab/index.html?open_create=true');
            chrome.tabs.create({ url: extensionUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          }
        });
      } else {
        // Send message to active tab to open the overlay menu
        if (typeof activeTabId === 'number') {
          chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
            const lastError = chrome.runtime.lastError;
            if (lastError) console.warn('[commands] open_create message error:', lastError.message);
          });
        }
      }
    }
  });



  // // Handle Alt+C command to open command palette
  // if (command === 'open_alt_c') {
  //   if (!chrome.tabs?.query) return;
  //   chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  //     const tab = tabs?.[0];
  //     const tabId = tab?.id;

  //     if (typeof tabId === 'number') {
  //       if (!chrome.tabs?.sendMessage) return;

  //       try {
  //         chrome.tabs.sendMessage(tabId, { type: TOGGLE_ALTC_MESSAGE }, () => {
  //           const lastError = chrome.runtime.lastError;
  //           if (lastError) {
  //             console.warn('[commands] toggle_altc message error:', lastError.message);
  //             // Fallback for restricted pages
  //             const url = tab.url || '';
  //             const isRestricted =
  //               url.startsWith('chrome://') ||
  //               url.startsWith('edge://') ||
  //               url.startsWith('brave://') ||
  //               url.startsWith('about:') ||
  //               url.startsWith('chrome-extension://') ||
  //               url.includes('chromewebstore.google.com') ||
  //               url.includes('chrome.google.com/webstore') ||
  //               !url;

  //             if (isRestricted) {
  //               chrome.storage.local.set({ trigger_error_popup: true }).then(() => {
  //                 if (chrome.action && (chrome.action as any).openPopup) {
  //                   (chrome.action as any).openPopup();
  //                 }
  //               });
  //             }
  //           }
  //         });
  //       } catch (error) {
  //         console.error('[commands] failed to send toggle_altc message:', error);
  //       }
  //     } else {
  //       console.warn('[commands] no active tab found for toggle_altc command');
  //     }
  //   });
  // }
});

async function executeAutoSubmit(tabId: number, request: AutoSubmitRequest) {
  if (!chrome.scripting?.executeScript) {
    console.warn('[auto-submit] chrome.scripting unavailable');
    return;
  }

  // Allow the page to settle briefly before interacting with DOM
  await new Promise(resolve => setTimeout(resolve, 300));

  // Handle 'calendar' kind: use 'gemini' logic but prepend system prompt
  let kindToUse = request.kind;
  let promptToUse = request.prompt;

  if (request.kind === 'calendar') {
    kindToUse = 'gemini';
    promptToUse = `Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments. ${request.prompt}`;
  }

  // Handle 'drive' kind: Use specialized Debugger flow instead of DOM injection
  if (request.kind === 'drive') {
    try {
      await executeTrustedDriveFlow(tabId, request.images || []);
      return;
    } catch (err) {
      console.error('[BG-v2] Drive TrustedDriveFlow failed:', err);
      return;
    }
  }

  // NEW — for perplexity specifically, focus the tab first if it's in the background
  if (kindToUse === 'perplexity') {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.active) {
        await chrome.tabs.update(tabId, { active: true });
        await new Promise(resolve => setTimeout(resolve, 100)); // wait for focus to register
      }
    } catch (e) {
      console.warn('[auto-submit] Failed to check/focus perplexity tab:', e);
    }
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      // Fix: Ensure undefined becomes null for serialization
      args: [kindToUse, promptToUse, request.images || null, tabId],
      world: 'MAIN',
      func: (
        kind: AutoSubmitRequest['kind'],
        promptFromExtension: string,
        // Allow null for serialization compatibility
        imagesFromExtension?: { base64: string; mimeType: string; filename: string }[] | null,
        currentTabId?: number,
      ) => {
        const getResolvedPrompt = (): string => {
          // PRIORITY: Use the prompt from the extension first (supports "Clean URL" strategy)
          if (promptFromExtension && promptFromExtension.trim()) {
            return promptFromExtension.trim();
          }
          // FALLBACK: Check URL query parameters (for backward compatibility)
          try {
            const url = new URL(window.location.href);
            const fromQuery = url.searchParams.get('q') || '';
            return fromQuery.trim();
          } catch (error) {
            console.warn('[auto-submit] failed to parse URL', error);
            return '';
          }
        };

        const markKey = `tasklabsAutoSubmit-${kind}`;
        const timestampKey = `${markKey}-timestamp`;
        const now = Date.now();

        // Signal background script that we're done (success, skip, or timeout)
        const stopMonitoring = () => {
          if ((window as any)[timestampKey + '-stopped']) return;
          (window as any)[timestampKey + '-stopped'] = true;

          if ((window as any)[timestampKey + '-interval']) {
            window.clearTimeout((window as any)[timestampKey + '-interval']);
            (window as any)[timestampKey + '-interval'] = null;
          }

          try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && currentTabId !== undefined) {
              chrome.runtime.sendMessage({ action: 'prompt_injected_success', tabId: currentTabId });
            }
          } catch (e) {
            console.warn('[auto-submit] failed to send completion signal', e);
          }
        };

        const resolvedPrompt = getResolvedPrompt();
        if (!resolvedPrompt && (!imagesFromExtension || imagesFromExtension.length === 0)) {
          stopMonitoring();
          return;
        }

        // Helper to convert base64 to File
        const dataURLtoFile = (dataurl: string, filename: string) => {
          const arr = dataurl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new File([u8arr], filename, { type: mime });
        };

        // 0. Pre-Focus Scroll for Lazy-Loaded UI
        // Trigger lazy loading text areas by forcing a scroll to the bottom immediately
        window.scrollTo(0, document.body.scrollHeight);

        const existingTimestamp = (window as any)[timestampKey];

        // Legacy skip logic removed - the background sequential queue now handles timing and order.

        const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : undefined;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else if (valueSetter) {
            valueSetter.call(element, value);
          } else {
            (element as any).value = value;
          }
        };

        const focusAndFill = (element: HTMLInputElement | HTMLTextAreaElement) => {
          element.focus();
          setNativeValue(element, '');
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          setNativeValue(element, resolvedPrompt);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const clickAvailableButton = (
          selectors: string[],
          stopMonitoring?: () => void,
        ): { clicked: boolean; button: HTMLButtonElement | null } => {
          for (const selector of selectors) {
            const candidate = document.querySelector(selector) as HTMLButtonElement | null;
            if (candidate && !candidate.disabled) {
              // Upgrade: Simulate Pointer Events (modern standard) + Mouse Events
              // This satisfies complex frameworks (like Google's) that might track pointerId or pointerType
              const opts = {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
              };

              // Dispatch pointerdown (critical for some frameworks)
              if (typeof PointerEvent !== 'undefined') {
                candidate.dispatchEvent(new PointerEvent('pointerdown', opts));
                candidate.dispatchEvent(new PointerEvent('mousedown', opts));
                candidate.dispatchEvent(new PointerEvent('pointerup', opts));
                candidate.dispatchEvent(new PointerEvent('mouseup', opts));
              } else {
                // Fallback for older environments
                candidate.dispatchEvent(new MouseEvent('mousedown', opts));
                candidate.dispatchEvent(new MouseEvent('mouseup', opts));
              }

              candidate.click();

              // Immediately stop monitoring after successful click
              if (stopMonitoring) {
                stopMonitoring();
              }

              // Track if button becomes disabled after click (indicates successful submission)
              const checkDisabled = () => {
                return candidate.disabled || !document.contains(candidate);
              };

              // Give it a moment to process the click
              setTimeout(() => {
                if (checkDisabled()) {
                } else {
                }
              }, 100);

              return { clicked: true, button: candidate };
            }
          }
          return { clicked: false, button: null };
        };

        const submitChatGPT = (stopMonitoring?: () => void): boolean => {
          // Selectors for the input area
          const textareaSelectors = [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'textarea[id="prompt-textarea"]',
            'div[contenteditable="true"]', // New ChatGPT UI often uses contenteditable div
            'textarea',
          ];

          let node: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
          let isContentEditable = false;

          for (const selector of textareaSelectors) {
            const found = document.querySelector(selector) as HTMLElement | null;
            if (found) {
              node = found;
              isContentEditable =
                (found as HTMLElement).isContentEditable || found.getAttribute('contenteditable') === 'true';
              break;
            }
          }

          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

          if (!node) {
            return false;
          }

          // 0. Handle Image Upload if present
          if (imagesFromExtension && imagesFromExtension.length > 0 && !imageUploadAttempted) {
            if (fileInput) {
              try {
                const dataTransfer = new DataTransfer();
                for (const img of imagesFromExtension) {
                  const file = dataURLtoFile(img.base64, img.filename);
                  dataTransfer.items.add(file);
                }
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                imageUploadAttempted = true;
                lastImageUpload = Date.now();
                return false;
              } catch (e) {
                console.error('[auto-submit][chatgpt] ERROR: Image injection failed', e);
                imageUploadAttempted = true;
              }
            } else {
              // File input not found yet — page may still be loading.
              // Keep retrying (return false) instead of giving up, but set a timeout
              // to prevent indefinite waiting (10 seconds from script start).
              if (!(window as any)[timestampKey + '-imageStart']) {
                (window as any)[timestampKey + '-imageStart'] = Date.now();
              }
              const elapsed = Date.now() - (window as any)[timestampKey + '-imageStart'];
              if (elapsed > 10000) {
                console.warn('[auto-submit][chatgpt] File input not found after 10s, skipping image upload');
                imageUploadAttempted = true;
              } else {
                return false; // Retry on next polling cycle
              }
            }
          }

          const now = Date.now();
          const timeSinceImageUpload = now - lastImageUpload;

          // SPECIAL WAIT: If images were just injected, wait 3s before filling text
          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            timeSinceImageUpload < 3000
          ) {
            return false;
          }

          // 1. Check if text needs to be set
          const getCurrentValue = (): string => {
            if (isContentEditable) return (node as HTMLElement).innerText || (node as HTMLElement).textContent || '';
            return (node as HTMLTextAreaElement).value || '';
          };

          const setCurrentValue = (value: string) => {
            node?.focus();
            const el = node as HTMLElement;

            // Helper to dispatch standard events
            const dispatchStandardEvents = () => {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            };

            // METHOD 1: Paste Event (Primary)
            // Clear content first if needed
            if (getCurrentValue().trim()) {
              if (isContentEditable) {
                document.execCommand('selectAll', false);
                document.execCommand('delete', false);
              } else {
                (el as HTMLInputElement).value = '';
              }
            }

            try {
              const dataTransfer = new DataTransfer();
              dataTransfer.setData('text/plain', value);
              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer,
              });
              el.dispatchEvent(pasteEvent);
            } catch (e) {
            }

            // Verify if paste worked
            if (getCurrentValue().trim() === value.trim()) {
              dispatchStandardEvents();
              return;
            }

            // METHOD 2: execCommand (Fallback)
            if (isContentEditable) {
              if (el.innerText !== value) el.innerText = '';

              const sel = window.getSelection();
              if (sel) {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }

              // Simulate typing events
              el.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              el.dispatchEvent(new Event('keydown', { bubbles: true }));
              el.dispatchEvent(new Event('keypress', { bubbles: true }));

              const success = document.execCommand('insertText', false, value);

              el.dispatchEvent(new Event('textInput', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('compositionend', { bubbles: true }));

              if (!success || el.innerText !== value) {
                el.innerText = value;
                dispatchStandardEvents();
              }
            } else {
              // Standard textarea fallback
              const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value',
              )?.set;
              if (nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(el, value);
              } else {
                (el as HTMLTextAreaElement).value = value;
              }
              dispatchStandardEvents();
            }
          };

          const currentValue = getCurrentValue();
          // Check loose equality to handle trim/whitespace diffs
          if (currentValue.trim() !== resolvedPrompt.trim()) {
            setCurrentValue(resolvedPrompt);
            lastTextUpdate = Date.now();
            return false;
          }

          // 2. Wait a bit after text update to let UI settle/enable button
          const timeSinceTextUpdate = now - lastTextUpdate;
          if (timeSinceTextUpdate < 1000) return false; // Increased wait time

          // 3. Try to click send button
          const buttonSelectors = [
            'button[data-testid="send-button"]',
            'button[data-testid="fruitjuice-send-button"]',
            'button[aria-label="Send prompt"]',
            'button[aria-label="Send message"]',
            'button[type="submit"]',
          ];

          let foundButton: HTMLButtonElement | null = null;
          for (const selector of buttonSelectors) {
            // Look for button specifically within the form or near the input if possible,
            // but global search is usually fine for ChatGPT
            const btn = document.querySelector(selector) as HTMLButtonElement | null;
            if (btn) {
              foundButton = btn;
              break;
            }
          }

          if (foundButton) {
            if (!foundButton.disabled) {
              if (Date.now() - lastSubmitClick < 1500) return false; // Click cooldown
              foundButton.click();
              lastSubmitClick = Date.now();
              if (stopMonitoring) stopMonitoring();
              return true;
            } else {
              const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
              // If images are present, wait indefinitely for button to enable (don't force Enter early)
              if (imagesFromExtension && imagesFromExtension.length > 0 && now - lastImageUpload < timeoutThreshold)
                return false;

              if (now - lastTextUpdate < timeoutThreshold) return false;
            }
          } else {
            // Fallback to Enter key if button not found (rare in ChatGPT)
            // Or if we timed out waiting for button
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            });
            node?.dispatchEvent(enterEvent);
            if (stopMonitoring) stopMonitoring();
            return true;
          }

          return false;
        };

        const submitClaude = (stopMonitoring?: () => void): boolean => {
          // 0. Handle Image Upload if present - try multiple methods
          if (imagesFromExtension && imagesFromExtension.length > 0 && !imageUploadAttempted) {
            // Find the contenteditable element
            const textareaSelectors = [
              'div[contenteditable="true"].ProseMirror',
              'div[contenteditable="true"][data-placeholder]',
              'textarea[data-testid="message-input"]',
              'fieldset textarea',
              'form textarea',
              'textarea',
            ];

            let targetElement: HTMLElement | null = null;
            for (const selector of textareaSelectors) {
              const found = document.querySelector(selector) as HTMLElement | null;
              if (found) {
                targetElement = found;
                break;
              }
            }

            if (targetElement) {
              targetElement.focus();

              // METHOD 1: Try Ctrl+V paste event
              try {
                const dataTransfer = new DataTransfer();
                for (const img of imagesFromExtension) {
                  const file = dataURLtoFile(img.base64, img.filename);
                  dataTransfer.items.add(file);
                }

                const pasteEvent = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: dataTransfer,
                });

                targetElement.dispatchEvent(pasteEvent);
              } catch (e) {
              }

              // METHOD 2: Try file input
              try {
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
                if (fileInput) {
                  const dataTransfer = new DataTransfer();
                  for (const img of imagesFromExtension) {
                    const file = dataURLtoFile(img.base64, img.filename);
                    dataTransfer.items.add(file);
                  }
                  fileInput.files = dataTransfer.files;
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              } catch (e) {
              }

              // METHOD 3 & 4 (Clicking Button / Ctrl+U) REMOVED
              // Reason: These methods open the OS file dialog and do not inject the base64 data.
              // Relying on Method 1 (Paste) and Method 2 (File Input) is more robust for automation.
              imageUploadAttempted = true;
              lastImageUpload = Date.now();
              return false;
            } else {
              imageUploadAttempted = true;
            }
          }

          const now = Date.now();
          const timeSinceImageUpload = now - lastImageUpload;

          // SPECIAL WAIT: If images were just injected, wait 3s before filling text (User Request: "First Plan")
          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            timeSinceImageUpload < 3000
          ) {
            return false;
          }

          const textareaSelectors = [
            'div[contenteditable="true"].ProseMirror', // Claude uses ProseMirror editor
            'div[contenteditable="true"][data-placeholder]',
            'textarea[data-testid="message-input"]',
            'textarea[aria-label*="Message"]',
            'textarea[placeholder*="Claude"]',
            'fieldset textarea',
            'form textarea',
            'textarea',
          ];

          let node: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
          let isContentEditable = false;

          for (const selector of textareaSelectors) {
            const found = document.querySelector(selector) as HTMLElement | null;
            if (found) {
              node = found;
              isContentEditable = found.isContentEditable;
              break;
            }
          }

          if (!node) {
            return false;
          }

          // Get current value
          const getCurrentValue = (): string => {
            if (isContentEditable) {
              return (node as HTMLElement).innerText || '';
            }
            return (node as HTMLTextAreaElement).value || '';
          };

          // Set value
          const setCurrentValue = (value: string) => {
            if (isContentEditable) {
              const el = node as HTMLElement;
              el.focus();
              el.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              el.dispatchEvent(new Event('keydown', { bubbles: true }));
              el.dispatchEvent(new Event('keypress', { bubbles: true }));

              const success = document.execCommand('insertText', false, value);

              el.dispatchEvent(new Event('textInput', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('compositionend', { bubbles: true }));

              // Fallback
              if (!success || (el.innerText || '').trim() !== value) {
                el.innerText = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              focusAndFill(node as HTMLTextAreaElement);
            }
          };

          const currentValue = getCurrentValue();

          // 1. Check if text needs to be set
          if (currentValue.trim() !== resolvedPrompt) {
            setCurrentValue(resolvedPrompt);
            lastTextUpdate = Date.now();
            return false;
          }

          // 2. Verify stability (wait 400ms for React to process)
          const timeSinceUpdate = Date.now() - lastTextUpdate;
          if (timeSinceUpdate < 400) {
            return false;
          }

          // 3. Try to click send button
          const buttonSelectors = [
            'button[data-testid="submit-button"]',
            'button[aria-label="Send Message"]',
            'button[aria-label*="Send"]',
            'button[type="submit"]',
            'fieldset button[type="button"]', // Claude's send button sometimes
          ];

          let foundButton: HTMLButtonElement | null = null;
          for (const selector of buttonSelectors) {
            const btn = document.querySelector(selector) as HTMLButtonElement | null;
            if (btn) {
              foundButton = btn;
              break;
            }
          }

          if (foundButton) {
            if (!foundButton.disabled) {
              foundButton.click();
              if (stopMonitoring) stopMonitoring();
              return true;
            } else {
              const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
              if (Date.now() - lastTextUpdate < timeoutThreshold) {
                return false;
              }
            }
          }

          // No button found - try Enter key
          node.focus();
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          });
          node.dispatchEvent(enterEvent);
          node.dispatchEvent(
            new KeyboardEvent('keyup', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            }),
          );
          return true;
        };

        let imageUploadAttempted = false;
        let filesInjected = false; // <--- NEW: Tracks if files are actually attached
        let lastImageUpload = 0;
        let lastPlusBtnClick = 0;
        let lastTextUpdate = 0;
        let lastSubmitClick = 0;
        let lastReadyToSubmit = 0;
        let uploadState: 'idle' | 'opening' | 'menu-open' | 'waiting-input' | 'done' = 'idle';
        let textInjectedOnce = false;
        const firstUploadAttempt = 0; // When we started the whole process
        let lastUploadClick = 0; // When we last clicked the button
        const lastReadyCheck = new WeakMap<HTMLButtonElement, number>();

        // Helper to wake up background tabs
        const wakeUpBackgroundTab = () => {
          Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
          Object.defineProperty(document, 'hidden', { value: false, writable: true });
          document.dispatchEvent(new Event('visibilitychange'));
          const _reflow = document.body.offsetHeight;
        };

        const submitGemini = (stopMonitoring?: () => void): boolean => {
          const findUploadButtonByScore = (): HTMLButtonElement | null => {
            const root = document.querySelector('input-area-v2') || document.body;
            const allButtons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];

            const textarea = document.querySelector('textarea, div[contenteditable="true"], rich-textarea');
            const textareaRect = textarea?.getBoundingClientRect();

            const scored = allButtons.map(btn => {
              let score = 0;
              const rect = btn.getBoundingClientRect();
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();

              if (rect.width === 0 || rect.height === 0) return { btn, score: -1 };
              if (btn.disabled) return { btn, score: -1 };

              if (textareaRect) {
                const verticallyNear =
                  Math.abs(rect.top - textareaRect.top) < 100 || Math.abs(rect.bottom - textareaRect.bottom) < 100;
                if (verticallyNear) score += 25;
                if (rect.left < textareaRect.left) score += 20;
              }

              if (rect.width < 56 && rect.height < 56) score += 20;

              if (label.includes('upload')) score += 30;
              if (label.includes('add') || label.includes('attach')) score += 20;
              if (label.includes('send') || label.includes('submit')) score -= 50;
              if (
                label.includes('menu') ||
                label.includes('settings') ||
                label.includes('profile') ||
                label.includes('account')
              )
                score -= 40;

              if (html.includes('add_2') || html.includes('add_circle')) score += 20;
              if (html.includes('upload') || html.includes('attach')) score += 20;

              return { btn, score };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];

            if (!best || best.score < 40) {
              console.warn('[gemini-score] fallback triggered');
              return document.querySelector('button[aria-label*="upload"]') as HTMLButtonElement | null;
            }
            return best.btn;
          };

          const findSendButtonByScore = (): HTMLButtonElement | null => {
            const root = document.querySelector('input-area-v2') || document.body;
            const allButtons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];

            const textarea = document.querySelector('textarea, div[contenteditable="true"], rich-textarea');
            const textareaRect = textarea?.getBoundingClientRect();

            const scored = allButtons.map(btn => {
              let score = 0;
              const rect = btn.getBoundingClientRect();
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();

              if (rect.width === 0 || rect.height === 0) return { btn, score: -1 };
              if (btn.disabled) return { btn, score: -1 };

              // aria-disabled = penalty only, stays in race
              if (btn.getAttribute('aria-disabled') === 'true') score -= 30;

              if (textareaRect) {
                const verticallyNear =
                  Math.abs(rect.top - textareaRect.top) < 100 || Math.abs(rect.bottom - textareaRect.bottom) < 100;
                if (verticallyNear) score += 25;
                if (rect.left > textareaRect.right - 100) score += 25;
              }

              if (rect.width < 56 && rect.height < 56) score += 20;

              // Positive signals
              if (label.includes('send')) score += 40;
              if (label.includes('submit')) score += 30;
              if (label.includes('message')) score += 15;

              // Negative signals
              if (label.includes('stop')) score -= 100;
              if (label.includes('remove')) score -= 80; // NEW
              if (label.includes('upload')) score -= 50;
              if (label.includes('attach')) score -= 50;
              if (label.includes('add') || label.includes('menu')) score -= 40;
              if (label.includes('microphone') || label.includes('voice')) score -= 40;
              if (label.includes('settings') || label.includes('profile')) score -= 40;

              // HTML signals
              if (html.includes('send') || html.includes('arrow_upward')) score += 30;
              if (html.includes('arrow_forward')) score += 20;
              if (html.includes('add_2') || html.includes('upload')) score -= 30;

              return { btn, score };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];

            if (!best || best.score < 40) {
              console.warn('[gemini-send-score] fallback triggered');
              return document.querySelector(
                'button[aria-label="Send message"], button[data-testid="send-button"]',
              ) as HTMLButtonElement | null;
            }

            if (best.btn.getAttribute('aria-label')?.toLowerCase().includes('stop')) {
              console.warn('[gemini-send-score] STOP button detected, skipping');
              return null;
            }
            return best.btn;
          };

          const findTextInputByScore = (): { node: HTMLElement; isContentEditable: boolean } | null => {
            const root = document.querySelector('input-area-v2') || document.body;

            const candidates = Array.from(
              root.querySelectorAll('textarea, div[contenteditable="true"], rich-textarea .ql-editor, .ql-editor'),
            ) as HTMLElement[];

            const scored = candidates.map(el => {
              let score = 0;
              const rect = el.getBoundingClientRect();
              const tag = el.tagName.toLowerCase();
              const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
              const classList = el.className.toLowerCase();
              const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

              // Must be visible
              if (rect.width === 0 || rect.height === 0) return { el, score: -1, isContentEditable };

              // Fix 1: reject off-screen editors (hidden .ql-editor)
              if (rect.top < 0 || rect.bottom > window.innerHeight + 50) return { el, score: -1, isContentEditable };

              // Must be enabled
              if (el.getAttribute('disabled') !== null) return { el, score: -1, isContentEditable };
              if (el.getAttribute('aria-disabled') === 'true') return { el, score: -1, isContentEditable };

              // Size signals
              if (rect.width > 200) score += 20;
              if (rect.height > 30) score += 15;
              if (rect.height > 100) score += 10;

              // Fix 2: chat input is always near bottom
              if (rect.top > window.innerHeight * 0.5) score += 25;

              // Tag signals
              if (tag === 'textarea') score += 30;
              if (isContentEditable) score += 25;

              // Class signals
              if (classList.includes('ql-editor')) score += 30;
              if (classList.includes('input')) score += 15;
              if (classList.includes('textarea')) score += 15;
              if (classList.includes('chat')) score += 10;

              // Placeholder signals
              if (placeholder.includes('message')) score += 20;
              if (placeholder.includes('enter') || placeholder.includes('type')) score += 15;
              if (placeholder.includes('ask') || placeholder.includes('prompt')) score += 15;
              if (placeholder.includes('search')) score -= 20;

              // FIXED: proximity-based send button coupling (not global)
              let hasNearbySend = false;
              const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
              for (const btn of allButtons) {
                const btnRect = btn.getBoundingClientRect();
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (!label.includes('send')) continue;
                const distance = Math.abs(btnRect.top - rect.bottom) + Math.abs(btnRect.left - rect.right);
                if (distance < 200) {
                  hasNearbySend = true;
                  break;
                }
              }
              if (hasNearbySend) score += 10;

              // Negative signals
              if (classList.includes('title')) score -= 30;
              if (classList.includes('search')) score -= 20;
              if (classList.includes('label')) score -= 30;

              return { el, score, isContentEditable };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];

            if (!best || best.score < 30) {
              console.warn('[gemini-input-score] fallback triggered');
              // Fix 5: scoped fallback chain, no bare textarea
              const fallback =
                document.querySelector('input-area-v2 textarea') ||
                document.querySelector('rich-textarea .ql-editor') ||
                document.querySelector('.ql-editor[contenteditable="true"]') ||
                document.querySelector('div[contenteditable="true"]') ||
                document.querySelector('textarea:not([type="search"])');

              if (!fallback) return null;
              return {
                node: fallback as HTMLElement,
                isContentEditable: (fallback as HTMLElement).isContentEditable,
              };
            }
            return { node: best.el, isContentEditable: best.isContentEditable };
          };

          const isTrulySendButton = (btn: HTMLButtonElement): boolean => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();
            const rect = btn.getBoundingClientRect();

            // Visibility check
            if (btn.offsetParent === null) {
              console.warn('[gemini-verify] REJECTED: not visible');
              return false;
            }

            // Hard rejects — never click these
            if (label.includes('stop')) return false;
            if (label.includes('remove')) return false;
            if (label.includes('menu')) return false;
            if (label.includes('upload') || label.includes('attach')) return false;
            if (label.includes('microphone') || label.includes('voice')) return false;

            // Must have at least ONE positive signal
            const hasPositiveLabel = label.includes('send') || label.includes('submit');

            const hasPositiveIcon =
              html.includes('send') || html.includes('arrow_upward') || html.includes('arrow_forward');

            if (!hasPositiveLabel && !hasPositiveIcon) {
              console.warn('[gemini-verify] REJECTED: no positive signal');
              return false;
            }

            // Context-based position check
            const textarea = document.querySelector('textarea, div[contenteditable="true"], rich-textarea');
            const textareaRect = textarea?.getBoundingClientRect();

            if (textareaRect && rect.left < textareaRect.right - 150) {
              console.warn('[gemini-verify] REJECTED: not right of input');
              return false;
            }
            return true;
          };

          const isTrulyReady = (btn: HTMLButtonElement): boolean => {
            // Check 1: Basic disabled
            if (btn.disabled) {
              console.warn('[gemini-ready] FAIL: btn.disabled');
              return false;
            }

            // Check 2: aria-disabled
            if (btn.getAttribute('aria-disabled') === 'true') {
              console.warn('[gemini-ready] FAIL: aria-disabled');
              return false;
            }

            // Check 3: Opacity
            const style = window.getComputedStyle(btn);
            if (parseFloat(style.opacity) < 0.7) {
              console.warn('[gemini-ready] FAIL: opacity', style.opacity);
              return false;
            }

            // Check 4: Pointer events
            if (style.pointerEvents === 'none') {
              console.warn('[gemini-ready] FAIL: pointer-events none');
              return false;
            }

            // Check 5: Size
            const rect = btn.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              console.warn('[gemini-ready] FAIL: zero size');
              return false;
            }

            // Check 6: Stability window (non-async, uses polling cycles)
            const now = Date.now();
            const lastCheck = lastReadyCheck.get(btn) || 0;
            if (now - lastCheck < 150) {
              console.warn('[gemini-ready] waiting stability window...');
              return false;
            }
            lastReadyCheck.set(btn, now);
            return true;
          };

          // --- Selectors ---

          wakeUpBackgroundTab();

          // ========================================================================
          // C. IMAGE UPLOAD LOGIC (Step 0)
          // ========================================================================
          if (imagesFromExtension && imagesFromExtension.length > 0 && !filesInjected) {
            const now = Date.now();

            // STEP 1: OPEN MENU
            if (uploadState === 'idle' || uploadState === 'opening') {
              const addBtn = findUploadButtonByScore();

              if (addBtn && now - lastPlusBtnClick > 1500) {
                addBtn.click();
                lastPlusBtnClick = now;
                uploadState = 'opening';
              }

              // Detect menu open
              const uploadMenu = document.querySelector('[aria-controls="upload-file-menu"]');
              const isExpanded = (uploadMenu && uploadMenu.getAttribute('aria-expanded') === 'true') ||
                                 (addBtn && addBtn.getAttribute('aria-expanded') === 'true');
              const hasUploadOption = document.querySelector('button[data-test-id="local-images-files-uploader-button"]');

              if (isExpanded || hasUploadOption) {
                uploadState = 'menu-open';
              }

              return false;
            }

            // STEP 2: CLICK "UPLOAD FILES"
            if (uploadState === 'menu-open') {
              const uploadBtn = document.querySelector(
                'button[data-test-id="local-images-files-uploader-button"]',
              ) as HTMLButtonElement;

              if (uploadBtn && now - lastUploadClick > 1500) {
                uploadBtn.click();
                lastUploadClick = now;
                uploadState = 'waiting-input';
              }

              return false;
            }

            // STEP 3: WAIT FOR INPUT + INJECT
            if (uploadState === 'waiting-input') {
              const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

              if (fileInput) {
                try {
                  const dataTransfer = new DataTransfer();

                  for (const img of imagesFromExtension) {
                    const file = dataURLtoFile(img.base64, img.filename);
                    dataTransfer.items.add(file);
                  }

                  fileInput.files = dataTransfer.files;
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                  filesInjected = true;
                  uploadState = 'done';
                } catch (e) {
                  console.error('[gemini-upload] ❌ Injection failed', e);
                }
              }

              // Timeout fallback (8s)
              if (now - firstUploadAttempt > 8000) {
                console.warn('[gemini-upload] ⏱️ Timeout → fallback to text only');
                filesInjected = true;
                uploadState = 'done';
              }

              return false;
            }
          }

          // ========================================================================
          // E. TEXT INJECTION (Step 1)
          // ========================================================================
          const input = findTextInputByScore();
          if (!input) return false;

          const { node, isContentEditable } = input;

          if (!node) return false;

          const currentText = isContentEditable ? node.textContent || '' : (node as HTMLTextAreaElement).value || '';

          if (!textInjectedOnce) {
            node.focus();

            if (isContentEditable) {
              node.focus();
              node.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              document.execCommand('insertText', false, resolvedPrompt);
              node.dispatchEvent(new Event('compositionend', { bubbles: true }));
            } else {
              setNativeValue(node as HTMLTextAreaElement, resolvedPrompt);
            }

            node.dispatchEvent(new Event('input', { bubbles: true }));

            lastTextUpdate = Date.now();
            textInjectedOnce = true;

            return false;
          }

          if (Date.now() - lastTextUpdate < 1200) {
            return false;
          }

          // ========================================================================
          // F. SUBMISSION (Step 2)
          // ========================================================================
          const foundButton = findSendButtonByScore();

          if (foundButton) {
            const isEnabled = !foundButton.disabled && foundButton.getAttribute('aria-disabled') !== 'true';
            if (isEnabled) {
              // Verify before clicking
              if (!isTrulySendButton(foundButton)) return false;
              if (!isTrulyReady(foundButton)) return false;

              if (Date.now() - lastSubmitClick < 1500) return false; // Click cooldown
              foundButton.click();
              lastSubmitClick = Date.now();
              if (stopMonitoring) stopMonitoring();
              return true;
            } else {
              const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
              if (Date.now() - lastTextUpdate < timeoutThreshold) {
                return false;
              }
            }
          } else {
            // Enter key fallback
            if (lastReadyToSubmit === 0) lastReadyToSubmit = Date.now();
            if (Date.now() - lastReadyToSubmit > 2000) {
              node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
              if (stopMonitoring) stopMonitoring();
              return true;
            }
          }

          return false;
        };

        let lastPerplexitySubmitClick = 0;
        let perplexityTextSet = false; // Guard against re-pasting on every poll cycle
        let perplexityPasteAttempted = false; // Track if paste event was already dispatched

        const submitPerplexity = (stopMonitoring?: () => void): boolean => {
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

          // 0. Handle Image Upload if present
          if (imagesFromExtension && imagesFromExtension.length > 0 && !imageUploadAttempted) {
            if (fileInput) {
              try {
                const dataTransfer = new DataTransfer();
                for (const img of imagesFromExtension) {
                  const file = dataURLtoFile(img.base64, img.filename);
                  dataTransfer.items.add(file);
                }
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                imageUploadAttempted = true;
                lastImageUpload = Date.now();
                return false;
              } catch (e) {
                console.error('[auto-submit][perplexity] ERROR: Image injection failed', e);
                imageUploadAttempted = true;
              }
            } else {
              imageUploadAttempted = true;
            }
          }

          const now = Date.now();
          const timeSinceImageUpload = now - lastImageUpload;

          // SPECIAL WAIT: If images were just injected, wait 3s before filling text (User Request: "First Plan")
          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            timeSinceImageUpload < 3000
          ) {
            return false;
          }

          // 1. Handle text input
          // Perplexity homepage uses #ask-input with a contenteditable <p>
          // Perplexity conversation pages use a textarea directly
          let inputEl: HTMLElement | null = null;
          let isTextarea = false;

          const askInput = document.getElementById('ask-input') as HTMLElement | null;
          if (askInput) {
            const pElement = askInput.querySelector('p') as HTMLElement | null;
            if (pElement && pElement.isContentEditable) {
              inputEl = pElement;
            }
          }

          // Fallback: look for textarea (conversation page)
          if (!inputEl) {
            const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
            if (textarea) {
              inputEl = textarea;
              isTextarea = true;
            }
          }

          // Fallback: look for any contenteditable
          if (!inputEl) {
            const ce = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
            if (ce) {
              inputEl = ce;
            }
          }

          if (!inputEl) {
            return false;
          }

          const currentText = isTextarea ? (inputEl as HTMLTextAreaElement).value : inputEl.textContent || '';

          // Fix: If text was already set, don't re-paste even if comparison mismatches
          // (React may normalize special chars like \ causing textContent to differ)
          if (currentText.trim() !== resolvedPrompt && !(perplexityTextSet && now - lastTextUpdate < 3000)) {
            inputEl.focus();

            if (isTextarea) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value',
              )?.set;
              nativeInputValueSetter?.call(inputEl, resolvedPrompt);
              inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              if (!perplexityPasteAttempted) {
                // First attempt: try paste event simulation
                try {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.setData('text/plain', resolvedPrompt);
                  const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer,
                  });
                  inputEl.dispatchEvent(pasteEvent);
                } catch (e) {
                }
                perplexityPasteAttempted = true;
              } else {
                // Subsequent attempt: paste didn't work, use textContent fallback
                if (inputEl.textContent === '' || inputEl.textContent !== resolvedPrompt) {
                  inputEl.textContent = resolvedPrompt;
                  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            }

            perplexityTextSet = true;
            lastTextUpdate = now;
            return false;
          }

          // 2. Continuous Image Processing Wait
          const imageWaitThreshold = 2500;
          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            now - lastImageUpload < imageWaitThreshold
          ) {
            return false;
          }

          const timeSinceTextUpdate = now - lastTextUpdate;
          if (timeSinceTextUpdate < 500) return false;

          // --- Helper for Perplexity ---
          const findPerplexitySendButton = (): HTMLButtonElement | null => {
            const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
            const scored = allButtons.map(btn => {
              let score = 0;
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();
              const rect = btn.getBoundingClientRect();

              if (rect.width === 0 || rect.height === 0) return { btn, score: -1 };

              // Check visibility state (not just offsetParent)
              const style = window.getComputedStyle(btn);
              if (style.display === 'none' || style.visibility === 'hidden') return { btn, score: -1 };

              // Position Score (usually near input-area)
              if (rect.top > window.innerHeight * 0.5) score += 20;

              // Signal Score
              if (label.includes('submit')) score += 50;
              if (label.includes('send')) score += 40;
              if (label.includes('ask')) score += 30;
              if (html.includes('arrow-right') || html.includes('arrow')) score += 30;

              // CSS Score
              if (btn.classList.contains('bg-accentMain')) score += 20;

              // Penalty Score
              if (label.includes('stop')) score -= 100;
              if (label.includes('attach') || label.includes('upload')) score -= 80;
              if (label.includes('menu') || label.includes('voice')) score -= 50;

              return { btn, score };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];
            if (best) {
              return best.btn;
            }
            return null;
          };

          const isValidPerplexitySend = (btn: HTMLButtonElement): boolean => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();

            // ❌ Reject wrong buttons
            if (
              label.includes('stop') ||
              label.includes('remove') ||
              label.includes('attach') ||
              label.includes('upload') ||
              label.includes('menu') ||
              label.includes('voice')
            )
              return false;

            // ✅ Accept only real send buttons
            if (label.includes('send') || label.includes('submit') || label.includes('ask') || html.includes('arrow'))
              return true;

            return false;
          };

          // 3. Try to click send button
          const foundButton = findPerplexitySendButton();

          if (foundButton) {
            if (!isValidPerplexitySend(foundButton)) {
              console.warn('[perplexity] invalid button → retrying...');
              return false;
            }

            const isEnabled = !foundButton.disabled && foundButton.getAttribute('aria-disabled') !== 'true';

            // If button is enabled, try clicking it first
            if (isEnabled) {
              // FIX: Check if we clicked recently (e.g., within the last 1.5 seconds)
              if (Date.now() - lastPerplexitySubmitClick < 1500) {
                return false;
              }
              const opts = { bubbles: true, cancelable: true, view: window };
              foundButton.dispatchEvent(new MouseEvent('mousedown', opts));
              foundButton.dispatchEvent(new MouseEvent('mouseup', opts));
              foundButton.click();

              lastPerplexitySubmitClick = Date.now();
              if (stopMonitoring) stopMonitoring();
              return true; // Return true to stop monitoring (Success)
            }
          }

          // FINAL FALLBACK: If button is stuck disabled or not found after timeout
          const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
          if (now - lastTextUpdate > timeoutThreshold) {
            console.warn('[perplexity] Button click failed or stuck → forcing Enter key');
            inputEl?.focus();

            // Dispatch Enter key event
            inputEl?.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              }),
            );

            if (stopMonitoring) stopMonitoring();
            return true;
          }

          if (!foundButton) {
            console.warn('[perplexity] No send button found → retrying...');
          } else {
            console.warn('[perplexity] Send button disabled → waiting...');
          }
          return false;
        };

        const attemptSubmission = (stopMonitoring?: () => void) => {
          const success =
            kind === 'claude'
              ? submitClaude(stopMonitoring)
              : kind === 'gemini'
                ? submitGemini(stopMonitoring)
                : kind === 'perplexity'
                  ? submitPerplexity(stopMonitoring)
                  : submitChatGPT(stopMonitoring);
          if (success) {
            (window as any)[markKey] = true;
            (window as any)[timestampKey] = Date.now();
          }
          return success;
        };

        // Check if textarea still has content
        const hasContent = () => {
          const textareaSelectors =
            kind === 'claude'
              ? [
                'textarea[data-testid="message-input"]',
                'textarea[aria-label*="Message"]',
                'form textarea',
                'textarea',
              ]
              : kind === 'gemini'
                ? [
                  '#app-root input-area-v2 textarea',
                  'input-area-v2 textarea',
                  '#app-root input-area-v2 div[contenteditable="true"]',
                  'input-area-v2 div[contenteditable="true"]',
                  'textarea[aria-label*="Message"]',
                  'textarea',
                ]
                : kind === 'perplexity'
                  ? ['#ask-input', 'textarea', 'form textarea']
                  : [
                    '#prompt-textarea',
                    'textarea[data-id="message-textarea"]',
                    'textarea[aria-label*="Message"]',
                    'form textarea',
                    'textarea',
                  ];

          for (const selector of textareaSelectors) {
            const textarea = document.querySelector(selector) as HTMLTextAreaElement | HTMLElement | null;
            if (textarea) {
              if ((textarea as HTMLTextAreaElement).value !== undefined) {
                if ((textarea as HTMLTextAreaElement).value.trim().length > 0) return true;
              } else if (textarea.textContent && textarea.textContent.trim().length > 0) {
                return true;
              }
            }
          }
          return false;
        };

        const start = Date.now();
        // Use extended duration for file uploads (5 minutes), standard 60s for text (for slow history loads)
        const maxDuration = imagesFromExtension && imagesFromExtension.length > 0 ? 300000 : 60000;
        // Use faster polling initially (100ms), then slow down after 2 seconds
        let attemptCount = 0;
        let textWasEverSet = false; // Track if we've ever set the text

        // Use dynamic interval: Fast burst -> Mid-range -> Deep wait
        let lastAttemptCountLog = 0;
        const scheduleNextAttempt = () => {
          attemptCount++;

          // Smart Polling with Exponential Backoff
          // - Initial Burst: 100ms for the first 2 seconds (<= 20 attempts)
          // - Mid-Range: 500ms for the next 10 seconds (<= 40 attempts)
          // - Deep Wait: 1000ms after that to reduce CPU overhead
          let delay = 100;
          if (attemptCount > 40) delay = 1000;
          else if (attemptCount > 20) delay = 500;

          if (attemptCount - lastAttemptCountLog >= 50) {
            lastAttemptCountLog = attemptCount;
          }

          (window as any)[timestampKey + '-interval'] = window.setTimeout(() => {
            // Only check hasContent after we've successfully set text at least once
            // This prevents premature exit before the content is set
            if (textWasEverSet && !hasContent()) {
              stopMonitoring();
              return;
            }

            // Using requestIdleCallback to prevent blocking the main thread while the heavy history DOM renders
            const requestIdle = window.requestIdleCallback || ((cb: Function) => window.setTimeout(cb, 1));
            requestIdle(() => {
              const result = attemptSubmission(stopMonitoring);

              // Track if text was set successfully
              if (!textWasEverSet && hasContent()) {
                textWasEverSet = true;
              }

              if (result) {
                stopMonitoring();
                return;
              }

              if (Date.now() - start > maxDuration) {
                stopMonitoring();
                return;
              }

              // Schedule next attempt
              scheduleNextAttempt();
            });
          }, delay);
        };

        scheduleNextAttempt();

        // Try immediately after a tiny delay to let React/page start rendering
        window.setTimeout(() => {
          if (attemptSubmission(stopMonitoring)) {
            stopMonitoring();
          }
        }, 50);
      },
    });
  } catch (error) {
    console.error('[auto-submit] failed to execute script', error);
  }
}

function normalizeUrlForComparison(urlStr: string): string {
  try {
    let u = urlStr.toLowerCase();
    u = u.replace(/^https?:\/\//, '');
    u = u.replace(/^www\./, '');
    u = u.replace(/\/$/, '');
    return u;
  } catch {
    return urlStr.toLowerCase();
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ensureStateRestored();
  
  if (!changeInfo.url && !changeInfo.status) return; // Early return for irrelevant changes
  
  // 1. AI Chat History Tracking logic (ALWAYS run for registered sessions)
  if ((changeInfo.url || changeInfo.status) && pendingAiSessions.size > 0) {
    const url = changeInfo.url || tab.url || '';
    for (const [sessionId, session] of pendingAiSessions.entries()) {
      const tabIndex = session.tabIds.indexOf(tabId);
      if (tabIndex !== -1) {
        const model = session.models[tabIndex];

        if (changeInfo.url) {
        }

        let isFinal = false;
        // Refined patterns for SPA transitions
        if (model === 'gpt' && url.includes('chatgpt.com/c/')) isFinal = true;
        else if (model === 'gemini' && url.includes('gemini.google.com/app/')) isFinal = true;
        else if (
          model === 'perplexity' &&
          url.includes('perplexity.ai/search/') &&
          !url.includes('/search/new/') // Exclude the intermediate /search/new/UUID loading URL
        )
          isFinal = true;
        else if (model === 'claude' && url.includes('claude.ai/chat/')) isFinal = true;
        else if (model === 'google' && url.includes('google.com/search?q=')) isFinal = true;
        else if (model === 'copilot' && url.includes('copilot.microsoft.com/chats/')) isFinal = true;

        if (isFinal) {
          session.urls[model] = url; // Always update to the latest final URL
          pendingAiSessions.set(sessionId, session);

          // Notify new-tab page with updated session URL so it can track the real chat link.
          // We use chrome.runtime.sendMessage to broadcast to all extension pages (like new-tab)
          // because chrome.tabs.query might fail to find "newtab" tabs which Chrome often
          // masks as chrome://newtab/ instead of the extension URL.
          chrome.runtime
            .sendMessage({
              action: 'ai_session_url_updated',
              sessionId,
              model,
              url,
              tabId,
            })
            .catch(() => { });
        }
      }
    }
  }

  // 2. Sequential Queue Trigger Logic
  if (changeInfo.status === 'complete') {
    // Fail-safe: If a page load completes, the previous script context or navigation is finished.
    // We clear the processing flag to ensure the queue doesn't stay blocked if the
    // injection script was killed by the navigation.
    if (processingTabs.has(tabId)) {
      processingTabs.delete(tabId);
    }

    const queue = tabPromptQueues.get(tabId);
    if (queue && queue.length > 0) {
      processTabQueue(tabId);
    }
  }

  // ─── Session Tab Capture ─────────────────────────────────────────────────────
  const isComplete = changeInfo.status === 'complete';
  const hasNewUrl = !!changeInfo.url;

  if ((isComplete || hasNewUrl) && tab.url && tab.windowId) {
    const session = activeSessions.get(tab.windowId);
    if (session) {
      // Skip the pinned tracker tab itself
      if (tabId === session.pinnedTabId) return;

      // Skip initial seeding loads to prevent duplicate captures of the initial tabs
      if (session.initialTabUrls && (tabId in session.initialTabUrls)) {
        const seededUrl = session.initialTabUrls[tabId];
        const normalizedTab = normalizeUrlForComparison(tab.url);
        const normalizedSeed = normalizeUrlForComparison(seededUrl);
        if (normalizedTab === normalizedSeed) {
          // If the tab finished loading its seeded URL, we can stop ignoring it for future updates
          if (changeInfo.status === 'complete') {
            delete session.initialTabUrls[tabId];
            activeSessions.set(tab.windowId, session);
            persistActiveSessions();
          }
          return;
        } else {
          // The user navigated away from the seeded URL, stop ignoring
          delete session.initialTabUrls[tabId];
          activeSessions.set(tab.windowId, session);
          persistActiveSessions();
        }
      }

      // Skip all non-real URLs
      if (
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('about:') ||
        tab.url === 'chrome://newtab/'
      ) return;

      // Prevent duplicate capture of the same URL in immediate succession
      const lastCapturedUrl = session.capturedUrls[session.capturedUrls.length - 1];
      if (tab.url === lastCapturedUrl) return;

      const title = tab.title || new URL(tab.url).hostname;

      // Append (user said even duplicates should be sent — no dedup)
      session.capturedUrls.push(tab.url);
      session.capturedNames.push(title);
      activeSessions.set(tab.windowId, session);
      persistActiveSessions();

      // Broadcast captured tab update to the frontend LinkEditModal
      chrome.runtime.sendMessage({
        action: 'session_tab_captured',
        sessionId: session.sessionId,
        url: tab.url,
        title: title,
        favIconUrl: tab.favIconUrl,
        capturedUrls: session.capturedUrls,
        capturedNames: session.capturedNames
      }).catch(() => {});
    }
  }
  // ─── End Session Tab Capture ──────────────────────────────────────────────────
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ensureStateRestored();
  if (newTabKeystrokeRecordingTabId === tabId) {
    newTabKeystrokeRecordingTabId = null;
  }
  pendingAutoSubmitTabs.delete(tabId);
  tabPromptQueues.delete(tabId);

  // Check if this was a session's pinned tab
  for (const [windowId, session] of activeSessions.entries()) {
    if (session.pinnedTabId === tabId) {
      activeSessions.delete(windowId);
      persistActiveSessions();
      createNotification(null, {
        title: 'Session Ended',
        message: `"${session.sessionName}" control tab closed. Session ended.`,
      });
      break;
    }
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  await ensureStateRestored();
  const session = activeSessions.get(windowId);
  if (!session) return;

  activeSessions.delete(windowId);
  persistActiveSessions();

  // Automatically save captured links to the cloud database
  if (session.capturedUrls && session.capturedUrls.length > 0) {
    try {
      const category = 'TabGroup';
      const groupValue = {
        names: session.capturedNames.map((name, idx) => name || `Tab ${idx + 1}`),
        urls: session.capturedUrls,
      };

      const payload: Record<string, any> = {
        key: session.sessionName,
        value: JSON.stringify(groupValue),
        category,
        searchtags: {},
      };

      if (session.folderId) {
        payload.folder_id = session.folderId;
      } else if (session.workspaceId) {
        payload.workspace_id = session.workspaceId;
      }

      if (session.snippetId) {
        payload.snippet_id = session.snippetId;
      }

      const response = await updateSnippetRealtime(payload, session.storageMode || 'cloud');
      const responseSnippet = response?.snippet || response;
      const snippetId = responseSnippet?.snippet_id || responseSnippet?.id;
    } catch (err) {
      console.error('[Session] Auto-save failed on window close:', err);
    }
  }

  createNotification(null, {
    title: 'Session Complete',
    message: `"${session.sessionName}" — ${session.capturedUrls.length} tab${session.capturedUrls.length !== 1 ? 's' : ''} saved`,
  });
});

// Internal message listener for the popup to check auth
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  ensureStateRestored().catch(() => {}); // Ensure state starts restoring but don't block sync responses
  
  if (request.action === 'get_tab_id') {
    sendResponse({ tabId: sender.tab?.id });
    return false; // Sync response, close port immediately

  }

  if (request.action === 'start_session') {
    const { sessionName, workspaceId, folderId, teamId, storageMode, sessionId: reqSessionId, initialUrls = [], initialNames = [] } = request;
    const sessionId = reqSessionId || crypto.randomUUID();
    // Build URL for the pinned new-tab with session context
    const encodedName = encodeURIComponent(sessionName);
    const pinnedTabUrl = chrome.runtime.getURL(
      `new-tab/index.html?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`
    );

    const urlsToOpen = [pinnedTabUrl, ...initialUrls];

    chrome.windows.create(
      { url: urlsToOpen, type: 'normal', state: 'maximized' },
      (newWindow) => {
        if (chrome.runtime.lastError || !newWindow) {
          console.error('[Session] Failed to create window:', chrome.runtime.lastError);
          sendResponse({ ok: false, error: 'window_create_failed' });
          return;
        }

        const pinnedTabId = newWindow.tabs?.[0]?.id ?? -1;
        // Pin the first tab
        if (pinnedTabId > 0) {
          chrome.tabs.update(pinnedTabId, { pinned: true });
        }

        // Focus the first actual link tab (index 1) if it exists
        if (newWindow.tabs && newWindow.tabs.length > 1) {
          const firstLinkTabId = newWindow.tabs[1].id;
          if (firstLinkTabId) {
            chrome.tabs.update(firstLinkTabId, { active: true });
          }
        }

        const initialTabUrls: Record<number, string> = {};
        if (newWindow.tabs) {
          newWindow.tabs.forEach((t, index) => {
            if (t.id) {
              const url = t.url || urlsToOpen[index];
              if (url) {
                initialTabUrls[t.id] = url;
              }
            }
          });
        }

        const session: ActiveSessionEntry = {
          sessionId,
          sessionName,
          windowId: newWindow.id!,
          pinnedTabId,
          snippetId: null,    // Created lazily on first real tab
          workspaceId,
          folderId: folderId || null,
          teamId,
          storageMode: storageMode || 'cloud',
          capturedUrls: [...initialUrls],
          capturedNames: [...initialNames],
          createdAt: new Date().toISOString(),
          initialTabUrls,
        };

        activeSessions.set(newWindow.id!, session);
        persistActiveSessions();
        sendResponse({ ok: true, sessionId });
      }
    );

    return true; // Keep port open for async sendResponse
  }

  if (request.action === 'update_session_id') {
    const { oldSessionId, newSessionId } = request;
    for (const [windowId, session] of activeSessions.entries()) {
      if (session.sessionId === oldSessionId) {
        session.sessionId = newSessionId;
        session.snippetId = newSessionId;
        activeSessions.set(windowId, session);
        persistActiveSessions();
        break;
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'end_session') {
    const { windowId } = request;
    const session = activeSessions.get(windowId);
    if (session) {
      activeSessions.delete(windowId);
      persistActiveSessions();
      createNotification(null, {
        title: 'Session Complete',
        message: `"${session.sessionName}" — ${session.capturedUrls.length} tab${session.capturedUrls.length !== 1 ? 's' : ''} saved`,
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'tasklabs_keystroke_recording_state') {
    const senderTabId = sender.tab?.id;
    if (typeof senderTabId === 'number') {
      newTabKeystrokeRecordingTabId = request.active ? senderTabId : null;
      sendResponse({ ok: true });
      return false; // Sync response, close port immediately
    }
    sendResponse({ ok: false, error: 'no_sender_tab' });
    return false; // Sync response, close port immediately

  }

  if (request.action === 'schedule_todo_alarm') {
    const { todoId, deadline } = request;

    if (todoId && deadline) {
      const timestamp = new Date(deadline).getTime();
      const isImmediate = !!request.immediate;

      // Handle Anytime Tasks (suppress alarms)
      if (request.is_anytime) {
        chrome.alarms.clear(`todo|${todoId}`);
        sendResponse({ ok: true, skipped: true });
        return false; // Sync response
      }

      if (isImmediate) {
        // Trigger notification immediately
        (async () => {
          const todo = await findTodoById(todoId);
          if (todo) {
            const key = todo.key || todo.title || 'Task Reminder';
            const category = (todo.category || todo.snippet_category || '').toLowerCase();
            const value = todo.value || '';
            const isCustom = category === 'note' || category === 'snippet' || category === '';

            let displayMessage = key;
            if (isCustom && value && value !== key) {
              displayMessage += `\n${value}`;
            }

            const iconUrl = chrome.runtime.getURL('icon.png');
            createNotification(
              `immediate-${todoId}-${Date.now()}`,
              {
                type: 'basic',
                iconUrl,
                title: 'cmdOS Notification',
                message: displayMessage,
                priority: 2,
              }
            );

            // Reschedule if recurring
            const isRecurring = !!(todo.is_recurring || todo.recurring);
            const recurringCycle = (todo.recurring_cycle || todo.recurring_frequency || 'none').toLowerCase();

            if (isRecurring && recurringCycle !== 'none') {
              const now = new Date();
              let nextRun = new Date();
              if (recurringCycle === 'daily') nextRun.setDate(nextRun.getDate() + 1);
              else if (recurringCycle === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
              else if (recurringCycle === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
              else nextRun.setDate(nextRun.getDate() + 1);
              // Create future alarm
              chrome.alarms.create(`todo|${todoId}`, { when: nextRun.getTime() });

              // Update storage via specialized Todo endpoint (ONLY if cloud-synced)
              if (todoId && !String(todoId).startsWith('local-')) {
                await editTodo(todo.todo_id || todoId, nextRun.toISOString(), recurringCycle, undefined, undefined, true).catch(err =>
                  console.warn('[Background] Cloud reschedule failed:', err),
                );
              }

              // Update local cache
              const result = await chrome.storage.local.get(['local_todos']);
              const localTodos = (result.local_todos || []).map((t: any) =>
                t.id === todoId || t.snippet_id === todoId
                  ? { ...t, event_deadline: nextRun.toISOString(), is_done: false }
                  : t,
              );
              await chrome.storage.local.set({ local_todos: localTodos });
            }
          }
        })();
        sendResponse({ ok: true });
        return true;
      }

      const now = Date.now();
      const GRACE_PERIOD = 10000; // 10 seconds

      if (timestamp > now || now - timestamp < GRACE_PERIOD) {
        // If it's within the grace period (e.g., just missed it), schedule it for 1 second from now
        const effectiveTimestamp = Math.max(timestamp, now + 1000);

        chrome.alarms.getAll(alarms => {
          const existingAlarms = alarms.filter(
            a =>
              a.name === `todo|${todoId}` ||
              a.name === `reminder|${todoId}` ||
              a.name.includes(`|${todoId}|`) ||
              a.name.endsWith(`|${todoId}`),
          );
          existingAlarms.forEach(a => {
            chrome.alarms.clear(a.name);
          });

          // Main alarm
          const alarmName = `todo|${todoId}`;
          chrome.alarms.create(alarmName, { when: effectiveTimestamp });

          sendResponse({ ok: true });
        });
        return true; // Keep channel open for async response
      } else {
        console.warn(`[Background] Cannot schedule alarm in the past: ${deadline}`);
        sendResponse({ ok: false, error: 'past_deadline' });
        return true;
      }
    }
    sendResponse({ ok: false, error: 'missing_data' });
    return true;
  }

  if (request.action === 'clear_todo_alarm') {
    const { todoId } = request;
    if (todoId) {
      // 1. Clear Alarms
      chrome.alarms.getAll(alarms => {
        const existingAlarms = alarms.filter(
          a =>
            a.name === `todo|${todoId}` ||
            a.name === `reminder|${todoId}` ||
            a.name.includes(`|${todoId}|`) ||
            a.name.endsWith(`|${todoId}`),
        );
        existingAlarms.forEach(a => {
          chrome.alarms.clear(a.name);
        });
      });

      // 2. Clear visible Desktop Notifications
      chrome.notifications.getAll(notifications => {
        Object.keys(notifications).forEach(notifId => {
          if (notifId.includes(`-${todoId}-`) || notifId.endsWith(`-${todoId}`)) {
            chrome.notifications.clear(notifId);
          }
        });
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'show_notification') {
    const { title, message } = request;
    // 1. System Notification
    createNotification(`notif-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: title || 'cmdOS Notification',
      message: message || '',
      priority: 2,
    });

    // 2. In-Tab UI Notification
    showInTabToast(title || 'Notification', message || '');

    sendResponse({ ok: true });
    return true;
  }
  if (request.action === 'prompt_injected_success') {
    const { tabId } = request;
    processingTabs.delete(tabId);
    // Give the AI a moment to start generating before sending the next one
    setTimeout(() => processTabQueue(tabId), 2000);
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'cdp_pick_element') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'no_tab' });
      return true;
    }

    (async () => {
      try {
        const result = await pickElementViaCdp(tabId, Number(request.x), Number(request.y));
        if (!result?.selector) {
          sendResponse({ ok: false, error: 'no_selector' });
          return;
        }
        sendResponse({ ok: true, ...result });
      } catch (err: any) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();

    return true;
  }

  if (request.action === 'track_ai_session') {
    const { prompt, tabIds, models } = request;
    const sessionId = Date.now().toString();
    const session: PendingAiSession = {
      id: sessionId,
      prompt,
      models,
      tabIds,
      urls: {},
      timestamp: Date.now(),
    };
    pendingAiSessions.set(sessionId, session);

    // Timeout: cleanup tracking after 2 minutes
    setTimeout(() => {
      pendingAiSessions.delete(sessionId);
    }, 120000);

    sendResponse({ ok: true, sessionId });
    return true;
  }

  if (request.action === 'search_history') {
    // Default to last 30 days if startTime not provided. chrome.history.search defaults to last 24h otherwise.
    const thirtyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    chrome.history.search(
      {
        text: request.query,
        maxResults: request.maxResults || 10,
        startTime: request.startTime || thirtyDaysAgo,
      },
      results => {
        sendResponse(results || []);
      },
    );
    return true;
  }

  if (request.action === 'search_bookmarks') {
    chrome.bookmarks.search(request.query, results => {
      sendResponse(results || []);
    });
    return true;
  }

  if (request.action === 'run_automation') {
    executeAutomation(request.automation).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'stop_automation') {
    stopCurrentAutomation();
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'get_tab_id') {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }

  if (request.action === 'track_counter_event') {
    const { type, meta } = request;
    if (isCounterEventType(type)) {
      trackCounterEvent(type, meta);
    } else {
      console.warn('[CounterTracking] Ignored unknown event type:', type);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'trigger_hotkey') {
    const { type, id } = request;
    const senderTabId = sender.tab?.id;
    // For commands, automations, agents and modules, open the new-tab page with trigger params (needs UI)
    if (['command', 'module', 'automation', 'agent', 'chat_agent'].includes(type)) {
      trackCounterEvent('hotkey_count', { hotkeyType: type, id });

      // Normalize ID (strip slashes and all common UI/internal prefixes)
      let normalizedId = String(id || '');
      if (normalizedId.startsWith('/')) normalizedId = normalizedId.substring(1);
      normalizedId = normalizedId
        .replace(/^cmd-/, '')
        .replace(/^lcmd-/, '')
        .replace(/^auto-/, '')
        .replace(/^agent-/, '');

      const url = chrome.runtime.getURL(`new-tab/index.html?trigger_hotkey=true&type=${type}&id=${encodeURIComponent(normalizedId)}`);
      chrome.tabs.create({ url, active: true });
      sendResponse({ ok: true });
      return true;
    }

    // For links and notes, open directly in current tab (omnibox-style)
    // Reuse the execute_global_hotkey logic
    const compoundId = id as string;

    if (!compoundId) {
      sendResponse({ ok: false, error: 'missing_id' });
      return false;
    }

    // Extract actual snippet ID - last 36 characters is the UUID
    const actualSnippetId = extractSnippetId(compoundId);

    // Fetch the snippet data from storage
    chrome.storage.local.get(['myFavouriteItems', 'myCachedAllData'], result => {
      try {
        let foundSnippet: any = null;

        // Helper function to extract URLs from a snippet
        const extractUrls = (snippet: any): string[] => {
          const value = snippet?.value;
          if (!value) return [];

          // If value is a string, try to parse as JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (parsed?.urls && Array.isArray(parsed.urls)) {
                return parsed.urls.filter(
                  (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
                );
              }
            } catch {
              // If it's a plain URL string
              if (value.startsWith('http') || value.startsWith('note:')) {
                return [value];
              }
            }
            return [];
          }

          // If value is an object with urls array
          if (typeof value === 'object' && value?.urls && Array.isArray(value.urls)) {
            return value.urls.filter(
              (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
            );
          }

          return [];
        };

        // 1. First search in myFavouriteItems (keyed by user ID)
        const favourites = result?.myFavouriteItems;
        if (favourites && typeof favourites === 'object') {
          for (const userId of Object.keys(favourites)) {
            const userFavs = favourites[userId];
            if (Array.isArray(userFavs)) {
              for (const item of userFavs) {
                const itemId = item?.id || item?.snippet_id;
                // Robust matching: check both full ID and UUID portion
                if (itemId === compoundId ||
                  itemId === actualSnippetId ||
                  (typeof itemId === 'string' && itemId.endsWith(actualSnippetId))) {
                  foundSnippet = item;
                  break;
                }
              }
            }
            if (foundSnippet) break;
          }
        }

        // 2. If not found in favourites, search in myCachedAllData
        if (!foundSnippet) {
          const allData = result?.myCachedAllData;
          if (Array.isArray(allData)) {
            for (const team of allData) {
              if (!team?.workspaces) continue;
              for (const workspace of team.workspaces) {
                const wsSnippets = workspace?.workspace_snippets || [];
                for (const snippet of wsSnippets) {
                  const snipId = snippet?.id || snippet?.snippet_id;
                  if (snipId === compoundId || snipId === actualSnippetId || snippet?.snippet_id === actualSnippetId) {
                    foundSnippet = snippet;
                    break;
                  }
                }
                if (foundSnippet) break;

                const folders = workspace?.folders || [];
                for (const folder of folders) {
                  const folderSnippets = folder?.snippets || [];
                  for (const snippet of folderSnippets) {
                    const snipId = snippet?.id || snippet?.snippet_id;
                    if (
                      snipId === compoundId ||
                      snipId === actualSnippetId ||
                      (typeof snipId === 'string' && snipId.endsWith(actualSnippetId))
                    ) {
                      foundSnippet = snippet;
                      break;
                    }
                  }
                  if (foundSnippet) break;
                }
                if (foundSnippet) break;
              }
              if (foundSnippet) break;
            }
          }
        }

        if (!foundSnippet) {
          console.warn('[Background] trigger_hotkey: Snippet not found:', { compoundId, actualSnippetId });
          sendResponse({ ok: false, error: 'snippet_not_found' });
          return;
        }

        let urls = extractUrls(foundSnippet);

        // Handle Note category - construct internal URL
        const category = (foundSnippet.category || foundSnippet.snippet_category || '').toLowerCase();
        if (urls.length === 0 && (category === 'note' || category === 'snippet')) {
          const snippetId = foundSnippet.id || foundSnippet.snippet_id;
          if (snippetId) {
            const noteUrl = chrome.runtime.getURL(
              `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
            );
            urls = [noteUrl];
          }
        }
        if (!urls.length) {
          sendResponse({ ok: false, error: 'no_urls_found' });
          return;
        }

        // Resolve note: URLs to full extension URLs
        const resolvedUrls: string[] = urls.map(url => {
          if (url.startsWith('note:')) {
            const noteId = url.substring(5);
            return chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${noteId}`);
          }
          return url;
        });

        trackCounterEvent('hotkey_count', {
          hotkeyType: 'snippet',
          id: actualSnippetId || compoundId,
          urlCount: resolvedUrls.length,
        });

        // Always open in new tabs to avoid disturbing current activity (back to original behavior)
        if (resolvedUrls.length > 0) {
          resolvedUrls.forEach((url, index) => {
            chrome.tabs.create({ url, active: index === 0 }, () => {
              if (index === resolvedUrls.length - 1) {
                sendResponse({ ok: true, openedUrls: resolvedUrls.length });
              }
            });
          });
        }
      } catch (err) {
        console.error('[Background] trigger_hotkey error:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    });

    return true; // async
  }

  if (request.action === 'open_tab_with_auto_submit') {
    const url = typeof request.url === 'string' ? request.url : '';
    const forceNewTab = request.forceNewTab === true;
    const active = request.active !== undefined ? request.active : !forceNewTab;
    if (!url) {
      sendResponse({ ok: false, error: 'missing_url' });
      return false;
    }

    const rawAutoSubmit = request.autoSubmit;
    const isValidKind = (kind: unknown): kind is string =>
      typeof kind === 'string' &&
      ['chatgpt', 'claude', 'gemini', 'perplexity', 'mistral', 'copilot', 'google', 'calendar', 'drive'].includes(kind);

    const autoSubmit =
      rawAutoSubmit && typeof rawAutoSubmit === 'object' && isValidKind((rawAutoSubmit as { kind?: unknown }).kind)
        ? {
          kind: (rawAutoSubmit as { kind: string }).kind,
          prompt: ((rawAutoSubmit as { prompt: string }).prompt || '').trim(),
          images: (rawAutoSubmit as { images?: any[] }).images,
        }
        : null;

    const sourceTabId = request.sourceTabId;
    const targetTabId = typeof request.targetTabId === 'number' ? request.targetTabId : null;

    // Helper to set pending and respond
    const handleTabCreated = (tab: chrome.tabs.Tab | undefined) => {
      if (autoSubmit && tab?.id) {
        const q = tabPromptQueues.get(tab.id) || [];
        q.push(autoSubmit as any);
        tabPromptQueues.set(tab.id, q);

        // If tab is already complete, trigger right away
        if (tab.status === 'complete') {
          processTabQueue(tab.id);
        }
      }
      sendResponse({ ok: true, tabId: tab?.id });
    };

    // If a specific targetTabId is provided, inject directly into that tab
    if (targetTabId && !forceNewTab && autoSubmit) {
      chrome.tabs.get(targetTabId, tab => {
        if (chrome.runtime.lastError || !tab) {
          // Tab no longer exists, fall through to create a new one
          console.warn('[BG-v2] targetTabId not found, creating new tab');
          chrome.tabs.create({ url, active }, handleTabCreated);
          return;
        }
        // Focus the tab
        chrome.tabs.update(targetTabId, { active: request.active !== false });
        if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true });
        // Inject the prompt
        const q = tabPromptQueues.get(targetTabId) || [];
        q.push(autoSubmit as any);
        tabPromptQueues.set(targetTabId, q);

        if (tab.status === 'complete') {
          processTabQueue(targetTabId);
        }
        sendResponse({ ok: true, tabId: targetTabId });
      });
      return true;
    }

    const handleExistingTab = (tab: chrome.tabs.Tab) => {
      if (!tab.id) return;
      if (active) {
        chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
      }

      if (autoSubmit) {
        // Since it's already open, we might not get an onUpdated 'complete' event to trigger injection.
        // So we queue it AND manually trigger it if the status is already complete.
        const q = tabPromptQueues.get(tab.id) || [];
        q.push(autoSubmit as any);
        tabPromptQueues.set(tab.id, q);

        if (tab.status === 'complete') {
          processTabQueue(tab.id);
        }
      }
      sendResponse({ ok: true, tabId: tab.id });
    };

    const extractChatId = (urlString: string) => {
      try {
        const url = new URL(urlString);
        const path = url.pathname;
        if (url.hostname.includes('perplexity.ai')) {
          // Perplexity format: /search/slug-string-ID or just /ID
          // The ID is usually the last segment after a hyphen
          const parts = path.split('-');
          if (parts.length > 1) return parts[parts.length - 1].replace(/\/$/, '');
          const slashParts = path.split('/');
          return slashParts[slashParts.length - 1] || null;
        }
        if (url.hostname.includes('chatgpt.com')) {
          // ChatGPT format: /c/UUID
          const match = path.match(/\/c\/([^/]+)/);
          if (match) return match[1];
        }
        if (url.hostname.includes('claude.ai')) {
          // Claude format: /chat/UUID
          const match = path.match(/\/chat\/([^/]+)/);
          if (match) return match[1];
        }
        return null;
      } catch (e) {
        return null;
      }
    };

    const findMatchingTab = (targetUrl: string, tabs: chrome.tabs.Tab[]) => {
      const targetId = extractChatId(targetUrl);

      if (targetId) {
        // If we can extract an ID, find the tab that has the same ID in its URL
        return tabs.find(t => {
          if (!t.url) return false;
          return extractChatId(t.url) === targetId;
        });
      }

      // Fallback to normalized full URL match
      try {
        const target = new URL(targetUrl);
        const normalizedTarget = target.origin + target.pathname.replace(/\/$/, '');

        return tabs.find(t => {
          if (!t.url) return false;
          try {
            const tUrl = new URL(t.url);
            const normalizedTUrl = tUrl.origin + tUrl.pathname.replace(/\/$/, '');
            return normalizedTarget === normalizedTUrl;
          } catch (e) {
            return false;
          }
        });
      } catch (e) {
        return tabs.find(t => t.url === targetUrl);
      }
    };

    if (sourceTabId && !forceNewTab) {
      chrome.tabs.update(sourceTabId, { url, active: true }, tab => {
        if (chrome.runtime.lastError) {
          console.error('[BG-v2] Update tab failed:', chrome.runtime.lastError);
          chrome.tabs.create({ url, active: true }, handleTabCreated);
          return;
        }
        handleTabCreated(tab);
      });
    } else {
      // Query all tabs with the same origin to do a manual fuzzy match
      try {
        const urlObj = new URL(url);
        const pattern = `${urlObj.origin}/*`;
        chrome.tabs.query({ url: pattern }, tabs => {
          const match = findMatchingTab(url, tabs || []);
          if (match) {
            handleExistingTab(match);
          } else {
            chrome.tabs.create({ url, active }, handleTabCreated);
          }
        });
      } catch (e) {
        chrome.tabs.query({ url: url }, tabs => {
          if (tabs && tabs.length > 0) {
            handleExistingTab(tabs[0]);
          } else {
            chrome.tabs.create({ url, active }, handleTabCreated);
          }
        });
      }
    }
    return true;
  }

  if (request.action === 'open_multiple_links') {
    const { links, delay = 200 } = request;
    if (!Array.isArray(links)) {
      sendResponse({ ok: false, error: 'invalid_links' });
      return false;
    }

    // Duplicate the matching function for open_multiple_links scope
    const extractChatId = (urlString: string) => {
      try {
        const url = new URL(urlString);
        const path = url.pathname;
        if (url.hostname.includes('perplexity.ai')) {
          const parts = path.split('-');
          if (parts.length > 1) return parts[parts.length - 1].replace(/\/$/, '');
          const slashParts = path.split('/');
          return slashParts[slashParts.length - 1] || null;
        }
        if (url.hostname.includes('chatgpt.com')) {
          const match = path.match(/\/c\/([^/]+)/);
          if (match) return match[1];
        }
        if (url.hostname.includes('claude.ai')) {
          const match = path.match(/\/chat\/([^/]+)/);
          if (match) return match[1];
        }
        return null;
      } catch (e) {
        return null;
      }
    };

    const findMatchingTab = (targetUrl: string, tabs: chrome.tabs.Tab[]) => {
      const targetId = extractChatId(targetUrl);

      if (targetId) {
        return tabs.find(t => {
          if (!t.url) return false;
          return extractChatId(t.url) === targetId;
        });
      }

      try {
        const target = new URL(targetUrl);
        const normalizedTarget = target.origin + target.pathname.replace(/\/$/, '');
        return tabs.find(t => {
          if (!t.url) return false;
          try {
            const tUrl = new URL(t.url);
            const normalizedTUrl = tUrl.origin + tUrl.pathname.replace(/\/$/, '');
            return normalizedTarget === normalizedTUrl;
          } catch (e) {
            return false;
          }
        });
      } catch (e) {
        return tabs.find(t => t.url === targetUrl);
      }
    };

    links.forEach((linkObj, index) => {
      const url = typeof linkObj === 'string' ? linkObj : linkObj.url;
      const autoSubmit = typeof linkObj === 'string' ? null : linkObj.autoSubmit;
      const forceNewTab = index > 0;

      setTimeout(() => {
        try {
          const urlObj = new URL(url);
          chrome.tabs.query({ url: `${urlObj.origin}/*` }, tabs => {
            const match = findMatchingTab(url, tabs || []);
            if (match && match.id) {
              chrome.tabs.update(match.id, { active: index === 0 });
              if (autoSubmit) {
                const q = tabPromptQueues.get(match.id) || [];
                q.push(autoSubmit as any);
                tabPromptQueues.set(match.id, q);

                if (match.status === 'complete') {
                  processTabQueue(match.id);
                }
              }
            } else {
              chrome.tabs.create({ url, active: index === 0 }, tab => {
                if (autoSubmit && tab?.id) {
                  const q = tabPromptQueues.get(tab.id) || [];
                  q.push(autoSubmit as any);
                  tabPromptQueues.set(tab.id, q);

                  if (tab.status === 'complete') {
                    processTabQueue(tab.id);
                  }
                }
              });
            }
          });
        } catch (e) {
          chrome.tabs.query({ url: url }, tabs => {
            if (tabs && tabs.length > 0) {
              const tab = tabs[0];
              if (tab.id) {
                chrome.tabs.update(tab.id, { active: index === 0 });
                if (autoSubmit) {
                  const q = tabPromptQueues.get(tab.id) || [];
                  q.push(autoSubmit as any);
                  tabPromptQueues.set(tab.id, q);

                  if (tab.status === 'complete') {
                    processTabQueue(tab.id);
                  }
                }
              }
            } else {
              chrome.tabs.create({ url, active: index === 0 }, tab => {
                if (autoSubmit && tab?.id) {
                  pendingAutoSubmitTabs.set(tab.id, autoSubmit);
                }
              });
            }
          });
        }
      }, index * delay);
    });

    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'focus_or_open_tab') {
    const url = typeof request.url === 'string' ? request.url : '';
    if (!url) {
      sendResponse({ ok: false, error: 'missing_url' });
      return false;
    }

    chrome.tabs.query({}, tabs => {
      const existingTab = tabs.find(t => t.url === url || t.url === url + '/');
      if (existingTab && existingTab.id) {
        chrome.tabs.update(existingTab.id, { active: true }, () => {
          chrome.windows.update(existingTab.windowId, { focused: true });
          sendResponse({ ok: true, focused: true });
        });
      } else {
        chrome.tabs.create({ url }, tab => {
          sendResponse({ ok: true, focused: false });
        });
      }
    });
    return true;
  }
  if (request.action === 'open_tab_in_session') {
    const { sessionId, url } = request;
    let matchedSession: ActiveSessionEntry | null = null;
    for (const session of activeSessions.values()) {
      if (session.sessionId === sessionId) {
        matchedSession = session;
        break;
      }
    }

    if (matchedSession && matchedSession.windowId) {
      chrome.tabs.create({ windowId: matchedSession.windowId, url, active: true }, (tab) => {
        sendResponse({ ok: true, tabId: tab?.id });
      });
      return true;
    } else {
      sendResponse({ ok: false, error: 'session_not_found' });
      return false;
    }
  }

  if (request.action === 'open_tab') {
    // Include debug messages in response (background scripts can't use alert())
    const debugMessages: string[] = [];
    debugMessages.push(`[DEBUG] Background: open_tab received\nurl: ${request.url}`);

    if (!chrome.tabs?.create) {
      debugMessages.push('[DEBUG] Background: tabs API unavailable');
      sendResponse({ ok: false, error: 'tabs_api_unavailable', debugMessages });
      return false;
    }

    const url = typeof request.url === 'string' ? request.url : '';
    if (!url) {
      debugMessages.push('[DEBUG] Background: Missing URL');
      sendResponse({ ok: false, error: 'missing_url', debugMessages });
      return false;
    }

    debugMessages.push(`[DEBUG] Background: Creating tab\nurl: ${url}`);

    const sourceTabId = request.sourceTabId;

    if (sourceTabId) {
      chrome.tabs.update(sourceTabId, { url }, tab => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          // Fallback to create
          chrome.tabs.create({ url, active: request.active !== undefined ? request.active : true }, () => sendResponse({ ok: true, debugMessages }));
        } else {
          sendResponse({ ok: true, tabId: sourceTabId, debugMessages });
        }
      });
      return true;
    }

    chrome.tabs.create({ url, active: request.active !== undefined ? request.active : true }, tab => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        debugMessages.push(`[DEBUG] Background: tabs.create failed\n${lastError.message}`);
        debugMessages.push(`[DEBUG] Background: Attempted URL was: ${url}`);
        debugMessages.push(`[DEBUG] Background: Extension ID: ${chrome.runtime.id}`);

        // Try to verify if the file exists by checking the manifest
        try {
          const manifestUrl = chrome.runtime.getURL('manifest.json');
          debugMessages.push(`[DEBUG] Background: Manifest URL: ${manifestUrl}`);
        } catch (e) {
          debugMessages.push(`[DEBUG] Background: Could not get manifest URL`);
        }

        sendResponse({ ok: false, error: lastError.message || 'tabs_create_failed', debugMessages });
        return;
      }
      debugMessages.push(`[DEBUG] Background: Tab created successfully\ntabId: ${tab?.id ?? null}\nurl: ${url}`);
      sendResponse({ ok: true, tabId: tab?.id ?? null, debugMessages });
    });

    return true;
  }

  // Helper inside the listener to share sendResponse, or just define it nearby
  const executeScrapeScript = (tabId: number, cb: (res: any) => void) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => {
          // Remove script, style, noscript tags and get only visible text
          const clone = document.body.cloneNode(true) as HTMLElement;
          const removeElements = clone.querySelectorAll(
            'script, style, noscript, svg, img, video, audio, iframe, canvas, link, [style*="display: none"], .alts-exclude',
          );
          removeElements.forEach(el => el.remove());

          // Get text content and clean it up
          let text = clone.textContent || '';

          // Normalize whitespace and remove multiple newlines
          text = text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

          // Truncate to ~12000 characters to fit in context windows
          const maxLength = 12000;
          if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '... [content truncated]';
          }

          return {
            content: text,
            url: window.location.href,
            title: document.title,
          };
        },
      },
      results => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.error('[Background] executeScrapeScript error:', lastError);
          cb({ ok: false, error: lastError.message });
          return;
        }

        const result = results?.[0]?.result;
        if (result) {
          cb({ ok: true, ...result });
        } else {
          cb({ ok: false, error: 'no_content_extracted' });
        }
      },
    );
  };

  // Scrape page content - extracts text from the current page (used by Chat with Site)
  if (request.action === 'scrape_page_content') {
    // Prioritize the tab that sent the message (the page AltS is on)
    const senderTabId = sender.tab?.id;
    if (senderTabId) {
      executeScrapeScript(senderTabId, sendResponse);
    } else {
      // Fallback for popup/options pages
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const activeTab = tabs?.[0];
        if (activeTab?.id) {
          executeScrapeScript(activeTab.id, sendResponse);
        } else {
          sendResponse({ ok: false, error: 'no_active_tab' });
        }
      });
    }

    return true;
  }

  // Scrape specific tab by ID
  if (request.action === 'scrape_tab_by_id') {
    const tabId = parseInt(request.tabId, 10);
    if (tabId) {
      executeScrapeScript(tabId, sendResponse);
    } else {
      sendResponse({ ok: false, error: 'invalid_tab_id' });
    }
    return true;
  }

  // Execute global hotkey - called from content scripts when user triggers a hotkey on any website
  if (request.action === 'execute_global_hotkey') {
    const compoundId = request.snippetId as string;
    if (!compoundId) {
      sendResponse({ ok: false, error: 'missing_snippet_id' });
      return false;
    }

    // The compound ID format is: {containerId}-{snippetId}
    // e.g., "6ccf89a0-f2ce-11ef-83fd-3fa371fb8e67-90e75d24-329d-4116-8d37-18c8838e9e45"
    // The actual snippet ID is the last 36 characters (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    // We need to extract it from the compound ID

    // Extract actual snippet ID - last 36 characters is the UUID
    const actualSnippetId = extractSnippetId(compoundId);
    // Fetch the snippet data from both storage locations
    chrome.storage.local.get(['myFavouriteItems', 'myCachedAllData'], result => {
      try {
        let foundSnippet: any = null;

        // Helper function to extract URLs from a snippet
        const extractUrls = (snippet: any): string[] => {
          const value = snippet?.value;
          if (!value) return [];

          // If value is a string, try to parse as JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (parsed?.urls && Array.isArray(parsed.urls)) {
                return parsed.urls.filter(
                  (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
                );
              }
            } catch {
              // If it's a plain URL string
              if (value.startsWith('http') || value.startsWith('note:')) {
                return [value];
              }
            }
            return [];
          }

          // If value is an object with urls array
          if (typeof value === 'object' && value?.urls && Array.isArray(value.urls)) {
            return value.urls.filter(
              (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
            );
          }

          return [];
        };

        // 1. First search in myFavouriteItems (keyed by user ID)
        const favourites = result?.myFavouriteItems;
        if (favourites && typeof favourites === 'object') {
          // favourites is an object like { "user_xxx": [...items] }
          for (const userId of Object.keys(favourites)) {
            const userFavs = favourites[userId];
            if (Array.isArray(userFavs)) {
              for (const item of userFavs) {
                // Match using both compound ID and extracted snippet ID
                const itemId = item?.id || item?.snippet_id;
                if (itemId === compoundId || itemId === actualSnippetId || item?.snippet_id === actualSnippetId) {
                  foundSnippet = item;
                  break;
                }
              }
            }
            if (foundSnippet) break;
          }
        }

        // 2. If not found in favourites, search in myCachedAllData
        if (!foundSnippet) {
          const allData = result?.myCachedAllData;
          if (Array.isArray(allData)) {
            for (const team of allData) {
              if (!team?.workspaces) continue;
              for (const workspace of team.workspaces) {
                // Check workspace-level snippets
                const wsSnippets = workspace?.workspace_snippets || [];
                for (const snippet of wsSnippets) {
                  const snipId = snippet?.id || snippet?.snippet_id;
                  if (snipId === compoundId || snipId === actualSnippetId || snippet?.snippet_id === actualSnippetId) {
                    foundSnippet = snippet;
                    break;
                  }
                }
                if (foundSnippet) break;

                // Check folder-level snippets
                const folders = workspace?.folders || [];
                for (const folder of folders) {
                  const folderSnippets = folder?.snippets || [];
                  for (const snippet of folderSnippets) {
                    const snipId = snippet?.id || snippet?.snippet_id;
                    if (
                      snipId === compoundId ||
                      snipId === actualSnippetId ||
                      snippet?.snippet_id === actualSnippetId
                    ) {
                      foundSnippet = snippet;
                      break;
                    }
                  }
                  if (foundSnippet) break;
                }
                if (foundSnippet) break;
              }
              if (foundSnippet) break;
            }
          }
        }

        if (!foundSnippet) {
          console.warn('[Background] Snippet not found in any storage:', { compoundId, actualSnippetId });
          sendResponse({ ok: false, error: 'snippet_not_found' });
          return;
        }

        let urls = extractUrls(foundSnippet);

        // Handle Note category - construct internal URL
        const category = (foundSnippet.category || foundSnippet.snippet_category || '').toLowerCase();
        if (urls.length === 0 && (category === 'note' || category === 'snippet')) {
          const snippetId = foundSnippet.id || foundSnippet.snippet_id;
          if (snippetId) {
            const noteUrl = chrome.runtime.getURL(
              `new-tab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
            );
            urls = [noteUrl];
          }
        }
        if (!urls.length) {
          sendResponse({ ok: false, error: 'no_urls_found' });
          return;
        }

        // Element Picker Logic

        // Element Picker Logic
        if (request.action === 'start_selector_mode') {
          // 1. Save state
          chrome.storage.local.set(
            {
              pending_automation_state: request.payload,
            },
            () => {
            },
          );

          // 2. Activate picker in active tab
          chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs.length > 0 && tabs[0].id) {
              const tabId = tabs[0].id;
              // Trigger picker
              chrome.tabs.sendMessage(tabId, { action: 'init_picker' });
            }
          });
          return;
        }

        if (request.action === 'element_selected') {
          // Save selection to storage so AutomationPanel can pick it up
          chrome.storage.local.set(
            {
              pending_selection: request.payload,
            },
            () => {
              // Notify user? Or just let them re-open Alt+S
              // Maybe show a notification
              createNotification(null, {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icon.png'),
                title: 'Element Selected',
                message: `Selected: ${request.payload.name}. Open Alt+S to continue.`,
              });
            },
          );
          return;
        }

        // Open URLs: first in current tab, rest in new tabs
        chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
          const currentTab = tabs?.[0];

          // Process and resolve all URLs (handle note: prefixes)
          const resolvedUrls: string[] = [];

          for (const url of urls) {
            if (url.startsWith('note:')) {
              const noteId = url.substring(5);
              // Find the note data to store editSnippetData (so the editor opens with correct context)
              let foundNote: any = null;
              let foundWs: any = null;
              let foundFld: any = null;

              // Search in cached data
              const allData = result?.myCachedAllData;
              if (Array.isArray(allData)) {
                for (const team of allData) {
                  for (const workspace of team.workspaces || []) {
                    for (const snippet of workspace.workspace_snippets || []) {
                      if ((snippet.id || snippet.snippet_id) === noteId) {
                        foundNote = snippet;
                        foundWs = workspace;
                        break;
                      }
                    }
                    if (foundNote) break;

                    for (const folder of workspace.folders || []) {
                      for (const snippet of folder.snippets || []) {
                        if ((snippet.id || snippet.snippet_id) === noteId) {
                          foundNote = snippet;
                          foundWs = workspace;
                          foundFld = folder;
                          break;
                        }
                      }
                      if (foundNote) break;
                    }
                    if (foundNote) break;
                  }
                  if (foundNote) break;
                }
              }

              if (foundNote) {
                const editData = {
                  snippet_id: noteId,
                  key: foundNote.key || foundNote.title || '',
                  value: foundNote.value || foundNote.description || '',
                  category: foundNote.category || 'snippet',
                  folder_id: foundFld?.folder_id || '',
                  workspace_id: foundWs?.workspace_id || '',
                  org_id: foundNote.team_id || '',
                  snippet_tags: foundNote.snippet_tags || [],
                };
                await chrome.storage.local.set({ editSnippetData: editData });
              }

              // Transform note:ID to extension URL
              const noteUrl = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${noteId}`);
              resolvedUrls.push(noteUrl);
            } else {
              resolvedUrls.push(url);
            }
          }

          if (resolvedUrls.length > 0) {
            trackCounterEvent('hotkey_count', {
              hotkeyType: 'snippet',
              id: actualSnippetId || compoundId,
              urlCount: resolvedUrls.length,
            });
          }

          if (resolvedUrls.length === 1) {
            // Single URL - open in current tab
            if (currentTab?.id) {
              chrome.tabs.update(currentTab.id, { url: resolvedUrls[0] }, () => {
                sendResponse({ ok: true, openedUrls: resolvedUrls.length });
              });
            } else {
              chrome.tabs.create({ url: resolvedUrls[0] }, () => {
                sendResponse({ ok: true, openedUrls: resolvedUrls.length });
              });
            }
          } else if (resolvedUrls.length > 1) {
            // Multiple URLs - open first in current tab, rest in new tabs
            const [firstUrl, ...restUrls] = resolvedUrls;

            const openRest = () => {
              restUrls.forEach(url => {
                chrome.tabs.create({ url, active: false });
              });
              sendResponse({ ok: true, openedUrls: resolvedUrls.length });
            };

            if (currentTab?.id) {
              chrome.tabs.update(currentTab.id, { url: firstUrl }, () => {
                openRest();
              });
            } else {
              chrome.tabs.create({ url: firstUrl }, () => {
                openRest();
              });
            }
          }
        });
      } catch (err) {
        console.error('[Background] execute_global_hotkey error:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    });

    return true; // async
  }

  if (request.action === 'check_auth') {
    chrome.storage.local.get(['accessToken', 'loggedIn'], function (result) {
      sendResponse({
        isLoggedIn: !!result.loggedIn,
        userId: result.accessToken,
        timestamp: new Date().toISOString(),
      });
    });
    return true; // Keep the message channel open for async response
  }

  // Bookmarks search for content scripts (content scripts cannot use chrome.bookmarks)
  if (request.action === 'bookmarks_search') {
    const query = (request.query as string) || '';

    if (!chrome.bookmarks?.search) {
      sendResponse({ ok: false, results: [], error: 'bookmarks_api_unavailable' });
      return false; // synchronous
    }
    try {
      chrome.bookmarks.search(query, nodes => {
        const results = (nodes || [])
          .filter(n => !!n.url)
          .map(n => ({ id: n.id, title: n.title || n.url || '', url: n.url || '' }));

        sendResponse({ ok: true, results });
      });
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false; // synchronous
    }
  }

  // Bookmarks get tree - returns all bookmarks with folder paths for content scripts
  if (request.action === 'bookmarks_get_tree') {
    if (!chrome.bookmarks?.getTree) {
      sendResponse({ ok: false, results: [], error: 'bookmarks_api_unavailable' });
      return false;
    }
    try {
      chrome.bookmarks.getTree(tree => {
        const results: Array<{ id: string; title: string; url: string; folderPath: string }> = [];

        const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[] = []) => {
          for (const node of nodes) {
            if (node.url) {
              results.push({
                id: node.id,
                title: node.title || node.url,
                url: node.url,
                folderPath: path.join(' / ') || 'Bookmarks',
              });
            }
            if (node.children) {
              traverse(node.children, node.parentId === '0' ? [] : [...path, node.title]);
            }
          }
        };

        traverse(tree[0]?.children || []);
        sendResponse({ ok: true, results });
      });
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false;
    }
  }

  if (request.action === 'tabs_query') {
    if (!chrome.tabs?.query) {
      sendResponse({ ok: false, results: [], error: 'tabs_api_unavailable' });
      return false;
    }
    try {
      chrome.tabs.query(request.queryOptions || {}, tabs => {
        const sanitized = (tabs || []).map(tab => ({
          id: tab.id ?? -1,
          url: tab.url ?? '',
          title: tab.title ?? '',
          favIconUrl: tab.favIconUrl ?? '',
          windowId: tab.windowId ?? -1,
          active: Boolean(tab.active),
          index: tab.index ?? 0,
        }));
        sendResponse({ ok: true, results: sanitized });
      });
      return true;
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false;
    }
  }

  // History search for content scripts and new-tab page (similar to bookmarks_search)
  if (request.action === 'history_search') {
    const query = (request.query as string) || '';
    const maxResults = typeof request.maxResults === 'number' ? request.maxResults : 30;
    const includeFrecency = Boolean(request.includeFrecency);
    const halfLifeHoursRaw = Number(request.halfLifeHours);
    const halfLifeHours = Number.isFinite(halfLifeHoursRaw) && halfLifeHoursRaw > 0 ? halfLifeHoursRaw : 2;
    const lambda = Math.LN2 / halfLifeHours;
    const now = Date.now();

    if (!chrome.history?.search) {
      sendResponse({ ok: false, results: [], error: 'history_api_unavailable' });
      return false; // synchronous
    }

    if (includeFrecency && !chrome.history?.getVisits) {
      sendResponse({ ok: false, results: [], error: 'history_visits_api_unavailable' });
      return false;
    }
    try {
      // Search history for the past 90 days by default
      const startTime = Date.now() - 90 * 24 * 60 * 60 * 1000;
      chrome.history.search(
        {
          text: query,
          startTime,
          maxResults: maxResults * 2, // Request more to filter duplicates
        },
        historyItems => {
          // Filter out duplicate URLs and basic invalid/internal entries
          const seenUrls = new Set<string>();
          const uniqueItems = (historyItems || [])
            .filter(item => {
              if (!item.url || seenUrls.has(item.url)) return false;
              // Skip internal browser pages and extension pages
              if (
                item.url.startsWith('chrome://') ||
                item.url.startsWith('chrome-extension://') ||
                item.url.startsWith('edge://') ||
                item.url.startsWith('about:')
              ) {
                return false;
              }
              seenUrls.add(item.url);
              return true;
            })
            .slice(0, maxResults);

          if (!includeFrecency) {
            const results = uniqueItems.map(item => ({
              id: item.id || '',
              title: item.title || item.url || '',
              url: item.url || '',
              lastVisitTime: item.lastVisitTime || 0,
              visitCount: item.visitCount || 0,
            }));
            sendResponse({ ok: true, results });
            return;
          }

          const getVisitsForUrl = (url: string): Promise<chrome.history.VisitItem[]> =>
            new Promise(resolve => {
              chrome.history.getVisits({ url }, visits => {
                resolve(visits || []);
              });
            });

          const computeFrecencyScore = (visits: chrome.history.VisitItem[]): number => {
            let score = 0;
            for (const visit of visits) {
              if (!visit?.visitTime) continue;
              const hoursSinceVisit = (now - visit.visitTime) / 3600000;
              if (hoursSinceVisit < 0) continue;
              score += Math.exp(-lambda * hoursSinceVisit);
            }
            return score;
          };

          Promise.all(
            uniqueItems.map(async item => {
              const url = item.url || '';
              const visits = url ? await getVisitsForUrl(url) : [];
              const frecencyScore = computeFrecencyScore(visits);

              return {
                id: item.id || '',
                title: item.title || url || '',
                url,
                lastVisitTime: item.lastVisitTime || 0,
                visitCount: item.visitCount || 0,
                frecencyScore,
              };
            }),
          )
            .then(results => {
              sendResponse({ ok: true, results });
            })
            .catch(err => {
              sendResponse({ ok: false, results: [], error: String(err) });
            });
        },
      );
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false; // synchronous
    }
  }

  // Proxy fetch for content scripts to avoid CORS: request: { action: 'http_fetch', path, method?, headers?, body? }
  if (request.action === 'http_fetch') {
    const BASE_URL = SUPABASE_BASE_URL;
    const TOKEN = SUPABASE_ANON_TOKEN;

    const url = (request.url as string) || `${BASE_URL}${request.path || ''}`;
    const method = (request.method as string) || 'GET';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(request.headers || {}),
    } as Record<string, string>;

    const fetchInit: RequestInit = {
      method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    };

    fetch(url, fetchInit)
      .then(async resp => {
        const contentType = resp.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await resp.json() : await resp.text();
        sendResponse({ ok: resp.ok, status: resp.status, data });
      })
      .catch(err => {
        console.error('http_fetch error:', err);
        sendResponse({ ok: false, status: 0, error: String(err) });
      });
    return true; // async
  }
  // Handle individual image downloads from the image export UI
  if (request.action === 'TASKLABS_DOWNLOAD_IMAGE' || request.type === 'IMAGE_DOWNLOAD') {
    const url = request.url || request.payload?.url;
    const filename = request.filename;

    if (!url) {
      sendResponse({ ok: false, error: 'No URL provided' });
      return false;
    }

    if (!chrome.downloads?.download) {
      sendResponse({ ok: false, error: 'Downloads API unavailable' });
      return false;
    }

    try {
      chrome.downloads.download(
        {
          url: url,
          filename: filename,
          conflictAction: 'uniquify',
          saveAs: false,
        },
        downloadId => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('[Background] Download failed:', lastError.message, url);
            sendResponse({ ok: false, error: lastError.message });
          } else {
            sendResponse({ ok: true, downloadId });
          }
        },
      );
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return true; // async
  }

  // Image download script injection
  if (request.action === 'execute_image_download') {
    const { tabId, downloadType, options } = request;

    let targetTabId = tabId;
    if (!targetTabId && sender?.tab?.id) {
      targetTabId = sender.tab.id;
    }
    if (!chrome.scripting?.executeScript) {
      console.error('[Background] ✗ Scripting API not available');
      sendResponse({ ok: false, error: 'scripting_api_unavailable' });
      return false;
    }

    if (typeof targetTabId !== 'number' || targetTabId <= 0) {
      console.error('[Background] ✗ Invalid tab ID:', targetTabId);
      sendResponse({ ok: false, error: 'invalid_tab_id' });
      return false;
    }
    try {
      // All download types use the same UI dialog (like AutomationExtension)
      if (downloadType === 'all' || downloadType === 'limit' || downloadType === 'selected') {
        // Show image selection UI dialog (like AutomationExtension)
        chrome.scripting.executeScript(
          {
            target: { tabId: targetTabId },
            func: async (opts: any) => {
              // Declare validImages at function scope so it's accessible in return statement
              let validImages: HTMLImageElement[] = [];

              try {
                const { limit, downloadType } = opts || {};

                // Helper to load lazy images (Google Images, etc.)
                const loadLazyImages = (images: NodeListOf<HTMLImageElement>): void => {
                  images.forEach(img => {
                    // Check for lazy loading attributes
                    const dataSrc =
                      img.getAttribute('data-src') ||
                      img.getAttribute('data-lazy-src') ||
                      img.getAttribute('data-original');
                    if (dataSrc && !img.src) {
                      img.src = dataSrc;
                    }
                    // Also check srcset for responsive images
                    const dataSrcset = img.getAttribute('data-srcset');
                    if (dataSrcset && !img.srcset) {
                      img.srcset = dataSrcset;
                    }
                  });
                };

                // Helper to wait for images to load
                const waitForImagesToLoad = async (
                  images: NodeListOf<HTMLImageElement>,
                  maxWait: number = 3000,
                ): Promise<void> => {
                  const startTime = Date.now();

                  // First, trigger lazy-loaded images
                  loadLazyImages(images);

                  // Small delay to let lazy images start loading
                  await new Promise(resolve => setTimeout(resolve, 200));

                  // Re-query to get updated images
                  const updatedImages = document.querySelectorAll('img');
                  const imagesArray = Array.from(updatedImages);
                  const incompleteImages = imagesArray.filter(img => {
                    const hasSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                    return hasSrc && !img.complete;
                  });

                  if (incompleteImages.length === 0) {
                    return;
                  }
                  const loadPromises = incompleteImages.map(img => {
                    return new Promise<void>(resolve => {
                      if (img.complete) {
                        resolve();
                        return;
                      }

                      const timeout = setTimeout(() => {
                        console.warn(
                          `[Image Download] Timeout waiting for image: ${img.src?.substring(0, 50) || 'no-src'}`,
                        );
                        resolve(); // Resolve anyway to not block
                      }, maxWait);

                      const onLoad = () => {
                        clearTimeout(timeout);
                        img.removeEventListener('load', onLoad);
                        img.removeEventListener('error', onError);
                        resolve();
                      };

                      const onError = () => {
                        clearTimeout(timeout);
                        img.removeEventListener('load', onLoad);
                        img.removeEventListener('error', onError);
                        resolve(); // Resolve on error too
                      };

                      img.addEventListener('load', onLoad);
                      img.addEventListener('error', onError);

                      // If image has lazy src, set it
                      const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                      if (lazySrc && !img.src) {
                        img.src = lazySrc;
                      }
                    });
                  });

                  await Promise.all(loadPromises);
                  const elapsed = Date.now() - startTime;
                };

                // Get all images from multiple sources (same as AutomationExtension + additional sources)
                // 1. Standard <img> tags (primary source - same as AutomationExtension)
                let images = document.querySelectorAll('img');
                // 2. <source> tags inside <picture> elements (additional capture)
                const pictureSources = document.querySelectorAll('picture source[srcset], picture source[src]');
                // 3. CSS background images (additional capture)
                const elementsWithBgImages: HTMLImageElement[] = [];
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                  const style = window.getComputedStyle(el);
                  const bgImage = style.backgroundImage;
                  if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
                    const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                    if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
                      // Create a temporary img element to represent this background image
                      const tempImg = document.createElement('img');
                      tempImg.src = urlMatch[1];
                      tempImg.style.display = 'none';
                      elementsWithBgImages.push(tempImg);
                    }
                  }
                });
                // Combine all image sources
                const allImageElements: HTMLImageElement[] = [];

                // Add standard <img> elements
                Array.from(images).forEach(img => {
                  allImageElements.push(img as HTMLImageElement);
                });

                // Add <source> elements (convert to img-like objects)
                pictureSources.forEach(source => {
                  const srcset = source.getAttribute('srcset');
                  const src = source.getAttribute('src');
                  if (srcset || src) {
                    // Extract first URL from srcset or use src
                    const url = srcset ? srcset.split(',')[0].trim().split(' ')[0] : src;
                    if (url && !url.startsWith('data:')) {
                      const tempImg = document.createElement('img');
                      tempImg.src = url;
                      tempImg.style.display = 'none';
                      allImageElements.push(tempImg);
                    }
                  }
                });

                // Add background images
                elementsWithBgImages.forEach(img => {
                  allImageElements.push(img);
                });
                if (allImageElements.length === 0) {
                  console.warn('[Image Download] No image sources found on this page. Waiting for images to load...');
                  // Don't return, continue to set up observers
                }

                // Wait for images to load (especially important when console is closed)
                // Convert to NodeList for waitForImagesToLoad
                const imagesNodeList = images as NodeListOf<HTMLImageElement>;
                await waitForImagesToLoad(imagesNodeList);

                // Small delay to ensure DOM is stable (fixes timing issue when console is closed)
                await new Promise(resolve => setTimeout(resolve, 100));

                // Re-query images after waiting (some might have been added dynamically)
                images = document.querySelectorAll('img');
                // Rebuild allImageElements with updated images
                allImageElements.length = 0;
                Array.from(images).forEach(img => {
                  allImageElements.push(img as HTMLImageElement);
                });

                const selectedImages = new Set<number>();

                // Filter valid images with detailed logging (same logic as AutomationExtension)
                // validImages already declared at function scope, reset it
                validImages = [];
                let filteredCount = 0;
                const skippedReasons = {
                  notComplete: 0,
                  noWidth: 0,
                  tooSmall: 0,
                  noSrc: 0,
                  dataUrl: 0,
                  error: 0,
                };

                // Use allImageElements instead of just images (includes <source> and backgrounds)
                if (allImageElements && allImageElements.length > 0) {
                  validImages = allImageElements.filter((img, idx) => {
                    try {
                      const imgEl = img as HTMLImageElement;

                      if (!imgEl) {
                        skippedReasons.error++;
                        return false;
                      }

                      // Check for src or data-src (lazy loading) or srcset
                      const hasSrc =
                        imgEl.src ||
                        imgEl.getAttribute('data-src') ||
                        imgEl.getAttribute('data-lazy-src') ||
                        imgEl.srcset;

                      if (!hasSrc) {
                        skippedReasons.noSrc++;
                        return false;
                      }

                      // Handle data URLs (same as AutomationExtension - capture them)
                      const actualSrc =
                        imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                      if (actualSrc && actualSrc.startsWith('data:')) {
                        // Check if data URL is too small (likely a placeholder/icon)
                        // Data URLs can be large, so we only skip very small ones
                        try {
                          const base64Data = actualSrc.split(',')[1];
                          if (base64Data) {
                            const sizeInBytes = (base64Data.length * 3) / 4;
                            const sizeInKB = sizeInBytes / 1024;
                            // Skip data URLs smaller than 0.5 KB (likely icons/placeholders)
                            if (sizeInKB < 0.5) {
                              skippedReasons.dataUrl++;
                              return false;
                            }
                          }
                        } catch (e) {
                          // If we can't parse, include it anyway
                        }
                        // Include data URL images (same as AutomationExtension)
                      }

                      // Very lenient dimension check - accept if ANY dimension is available
                      // This handles lazy-loaded images that might not have naturalWidth yet
                      const hasAnyWidth = imgEl.naturalWidth > 0 || imgEl.width > 0 || imgEl.offsetWidth > 0;
                      const hasAnyHeight = imgEl.naturalHeight > 0 || imgEl.height > 0 || imgEl.offsetHeight > 0;

                      // For Google Images and similar, images might be in containers
                      // Check if image is visible (not display:none or visibility:hidden)
                      const style = window.getComputedStyle(imgEl);
                      const isVisible =
                        style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

                      // Accept image if:
                      // 1. Has a valid src (not data URL)
                      // 2. Is visible (or has dimensions indicating it's meant to be visible)
                      // 3. Has at least some indication of size (even if small, let user decide)
                      const minSize = 10; // Very small minimum to catch thumbnails
                      const width = imgEl.naturalWidth || imgEl.width || imgEl.offsetWidth || 0;
                      const height = imgEl.naturalHeight || imgEl.height || imgEl.offsetHeight || 0;

                      // Skip only if truly invalid (no dimensions at all AND not visible)
                      if (!hasAnyWidth && !hasAnyHeight && !isVisible) {
                        skippedReasons.noWidth++;
                        return false;
                      }

                      // Skip very tiny images (likely icons/spacers) unless they're the only option
                      if (width > 0 && height > 0 && width < minSize && height < minSize && images.length > 5) {
                        skippedReasons.tooSmall++;
                        return false;
                      }

                      filteredCount++;
                      const displaySrc = actualSrc.substring(0, 50) || imgEl.srcset?.substring(0, 50) || 'no-src';
                      return true;
                    } catch (e) {
                      skippedReasons.error++;
                      console.error(`[Image ${idx}] Error filtering:`, e);
                      return false;
                    }
                  }) as HTMLImageElement[];
                }
                // Ensure validImages is always an array
                if (!Array.isArray(validImages)) {
                  console.error('[Image Download] validImages is not an array!', typeof validImages);
                  validImages = [];
                }

                // Apply limit if specified (for 'limit' download type)
                if (downloadType === 'limit' && limit && limit > 0 && validImages && validImages.length > 0) {
                  const beforeLimit = validImages.length;
                  validImages = validImages.slice(0, limit);
                }

                // Final validation - ensure validImages is still an array after limit
                if (!Array.isArray(validImages)) {
                  console.error('[Image Download] validImages became non-array after limit!');
                  validImages = [];
                }

                if (!validImages || !Array.isArray(validImages) || validImages.length === 0) {
                  const debugMsg = `No valid images found yet. Total sources: ${allImageElements.length} (<img>: ${images.length}, <source>: ${pictureSources.length}, backgrounds: ${elementsWithBgImages.length}). Skipped: Not loaded: ${skippedReasons.notComplete}, No width: ${skippedReasons.noWidth}, Too small: ${skippedReasons.tooSmall}, No src: ${skippedReasons.noSrc}, Data URLs: ${skippedReasons.dataUrl}, Errors: ${skippedReasons.error}`;
                  console.warn('[Image Download]', debugMsg);
                  // Don't return, continue to set up observers to catch images as they load
                }
                // Remove any existing dialog first
                const existingDialog = document.getElementById('tasklabs-image-dialog');
                if (existingDialog) {
                  existingDialog.parentElement?.removeChild(existingDialog);
                }

                // Create main container (Overlay)
                const mainContainer = document.createElement('div');
                mainContainer.id = 'tasklabs-image-main-container';
                mainContainer.style.cssText = `
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100vw;
                  height: 100vh;
                  background: rgba(0, 0, 0, 0.1);
                  z-index: 2147483647;
                  display: flex;
                  align-items: center;
                  justify-content: flex-end;
                  font-family: system-ui, -apple-system, sans-serif;
                  padding-right: 20px;
                  box-sizing: border-box;
                `;

                // Dialog Box (Glassmorphism)
                const dialogBox = document.createElement('div');
                dialogBox.id = 'tasklabs-image-dialog';
                dialogBox.style.cssText = `
                  width: 400px;
                  max-width: 90vw;
                  height: 90vh;
                  max-height: 90vh;
                  /* Glacier/Glassy Effect (Specific Color) */
                  background: rgb(235 235 235 / 75%);
                  backdrop-filter: blur(30px) saturate(180%);
                  -webkit-backdrop-filter: blur(30px) saturate(180%);
                  border: 1px solid rgba(255, 255, 255, 0.4);
                  border-left: 1px solid rgba(255, 255, 255, 0.5);
                  border-radius: 16px;
                  display: flex;
                  flex-direction: column;
                  box-shadow: -10px 0 40px -10px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
                  color: #1f2937; /* Dark text for light background */
                  overflow: hidden;
                  animation: tasklabs-slide-in 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                `;

                // Add styles
                const style = document.createElement('style');
                style.innerHTML = `
                @keyframes tasklabs-slide-in {
                  from { opacity: 0; transform: translateX(40px) scale(0.98); }
                  to { opacity: 1; transform: translateX(0) scale(1); }
                }
                .tasklabs-header {
                  padding: 20px 24px;
                  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  background: rgba(255, 255, 255, 0.3);
                }
                .tasklabs-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #111827;
                  letter-spacing: -0.01em;
                }
                .tasklabs-close-button {
                  background: rgba(0, 0, 0, 0.05);
                  color: #4b5563;
                  border: none;
                  border-radius: 8px;
                  width: 32px;
                  height: 32px;
                  font-size: 18px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                }
                .tasklabs-close-button:hover { 
                  background: rgba(0, 0, 0, 0.1);
                  color: #111827;
                }
                .tasklabs-subheader {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 16px 24px;
                  background: rgba(255, 255, 255, 0.2);
                  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                }
                .tasklabs-select-all-container {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  font-size: 13px;
                  color: #374151;
                  cursor: pointer;
                }
                .tasklabs-clear-all {
                  font-size: 13px;
                  color: #ef4444;
                  cursor: pointer;
                  padding: 4px 8px;
                  border-radius: 4px;
                  transition: background 0.2s;
                }
                .tasklabs-clear-all:hover {
                  background: rgba(239, 68, 68, 0.1);
                }
                #tasklabs-image-list {
                  flex: 1;
                  overflow-y: auto;
                  padding: 16px 24px;
                }
                .tasklabs-image-item {
                  display: flex;
                  align-items: center;
                  padding: 12px;
                  border-radius: 12px;
                  margin-bottom: 8px;
                  background: rgba(255, 255, 255, 0.4);
                  border: 1px solid rgba(255, 255, 255, 0.6);
                  cursor: pointer;
                  transition: all 0.2s;
                }
                .tasklabs-image-item:hover {
                  background: rgba(255, 255, 255, 0.7);
                  border-color: rgba(255, 255, 255, 0.9);
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .tasklabs-image-item.selected { 
                  background: rgba(139, 92, 246, 0.1);
                  border-color: rgba(139, 92, 246, 0.3);
                }
                .tasklabs-image-checkbox {
                  margin-right: 16px;
                  width: 18px;
                  height: 18px;
                  accent-color: #8b5cf6;
                  cursor: pointer;
                }
                .tasklabs-image-preview {
                  width: 48px;
                  height: 48px;
                  object-fit: cover;
                  border-radius: 8px;
                  margin-right: 16px;
                  background: rgba(0,0,0,0.2);
                }
                .tasklabs-image-info {
                  display: flex;
                  flex-direction: column;
                  flex-grow: 1;
                }
                .tasklabs-image-label {
                  font-weight: 500;
                  color: #111827;
                  margin-bottom: 4px;
                  font-size: 14px;
                }
                .tasklabs-image-dimensions {
                  font-size: 12px;
                  color: #6b7280;
                }
                .tasklabs-download-options {
                  display: flex;
                  gap: 12px;
                  padding: 20px 24px;
                  background: rgba(255, 255, 255, 0.3);
                  border-top: 1px solid rgba(0, 0, 0, 0.05);
                }
                .tasklabs-download-button {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 12px 20px;
                  border: 1px solid rgba(0, 0, 0, 0.05);
                  border-radius: 10px;
                  font-size: 14px;
                  font-weight: 600;
                  color: #111827;
                  background: rgba(255, 255, 255, 0.6);
                  cursor: pointer;
                  flex: 1;
                  transition: all 0.2s;
                  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }
                .tasklabs-download-button:hover {
                  background: rgba(255, 255, 255, 0.9);
                  transform: translateY(-1px);
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .tasklabs-download-button.disabled {
                  opacity: 0.5;
                  pointer-events: none;
                }
                /* Scrollbar */
                #tasklabs-image-list::-webkit-scrollbar {
                  width: 8px;
                }
                #tasklabs-image-list::-webkit-scrollbar-track {
                  background: transparent;
                }
                #tasklabs-image-list::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 4px;
                }
                #tasklabs-image-list::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.2);
                }
                `;
                document.head.appendChild(style);

                // Close Handler Function
                const closeDialog = () => {
                  if (document.body.contains(mainContainer)) {
                    document.body.removeChild(mainContainer);
                  }
                  if (document.head.contains(style)) {
                    document.head.removeChild(style);
                  }
                  if (document.head.contains(style)) {
                    document.head.removeChild(style);
                  }
                };

                // Close on click outside (Backdrop)
                mainContainer.onclick = e => {
                  if (e.target === mainContainer) {
                    closeDialog();
                  }
                };

                // Close on Escape key
                const handleEsc = (e: KeyboardEvent) => {
                  if (e.key === 'Escape') {
                    closeDialog();
                    document.removeEventListener('keydown', handleEsc);
                  }
                };
                document.addEventListener('keydown', handleEsc);

                // Header
                const header = document.createElement('div');
                header.classList.add('tasklabs-header');
                const title = document.createElement('span');
                title.classList.add('tasklabs-title');
                const totalImages = document.querySelectorAll('img').length;
                const validCount = validImages && validImages.length ? validImages.length : 0;
                if (downloadType === 'limit' && limit) {
                  title.textContent = `Export Images (${validCount} of ${totalImages}, limit: ${limit})`;
                } else {
                  title.textContent = `Export Images (${validCount})`;
                }
                const closeButton = document.createElement('button');
                closeButton.classList.add('tasklabs-close-button');
                closeButton.innerHTML = '✕';
                closeButton.onclick = closeDialog;

                header.appendChild(title);
                header.appendChild(closeButton);
                dialogBox.appendChild(header);

                // Subheader
                const subheader = document.createElement('div');
                subheader.classList.add('tasklabs-subheader');
                const selectAllContainer = document.createElement('div');
                selectAllContainer.classList.add('tasklabs-select-all-container');
                const selectAllCheckbox = document.createElement('input');
                selectAllCheckbox.type = 'checkbox';
                selectAllCheckbox.classList.add('tasklabs-image-checkbox');
                selectAllCheckbox.onchange = () => {
                  const isChecked = selectAllCheckbox.checked;
                  if (!validImages || !Array.isArray(validImages) || validImages.length === 0) {
                    return;
                  }
                  validImages.forEach((_, index) => {
                    if (!validImages || !validImages[index]) return;
                    const checkbox = document.getElementById(`tasklabs-checkbox-${index}`) as HTMLInputElement;
                    if (checkbox) {
                      checkbox.checked = isChecked;
                      if (isChecked) {
                        selectedImages.add(index);
                        const imageItem = document.querySelector(`.tasklabs-image-item:nth-child(${index + 1})`);
                        imageItem?.classList.add('selected');
                        const imgEl = validImages[index] as HTMLImageElement;
                        if (imgEl) {
                          imgEl.style.border = '3px solid #dc2626';
                          imgEl.style.borderRadius = '4px';
                        }
                      } else {
                        selectedImages.delete(index);
                        const imageItem = document.querySelector(`.tasklabs-image-item:nth-child(${index + 1})`);
                        imageItem?.classList.remove('selected');
                        const imgEl = validImages[index] as HTMLImageElement;
                        if (imgEl) {
                          imgEl.style.border = '';
                          imgEl.style.borderRadius = '';
                        }
                      }
                    }
                  });
                  updateButtonStates();
                };
                const selectAllLabel = document.createElement('span');
                selectAllLabel.textContent = 'Select All';
                selectAllContainer.appendChild(selectAllCheckbox);
                selectAllContainer.appendChild(selectAllLabel);

                const clearAll = document.createElement('span');
                clearAll.classList.add('tasklabs-clear-all');
                clearAll.textContent = 'Clear All';
                clearAll.onclick = () => {
                  selectedImages.clear();
                  selectAllCheckbox.checked = false;
                  if (!validImages || !Array.isArray(validImages) || validImages.length === 0) {
                    console.warn('[Image Download] clearAll: validImages is invalid', validImages);
                    updateButtonStates();
                    return;
                  }
                  const validCount = validImages.length;
                  validImages.forEach((_, index) => {
                    if (!Array.isArray(validImages) || index < 0 || index >= validImages.length) {
                      console.warn(
                        `[Image Download] clearAll: Invalid index ${index}, validImages.length=${validImages?.length}`,
                      );
                      return;
                    }
                    if (!validImages[index]) {
                      console.warn(`[Image Download] clearAll: Image at index ${index} is null`);
                      return;
                    }
                    const checkbox = document.getElementById(`tasklabs-checkbox-${index}`) as HTMLInputElement;
                    if (checkbox) checkbox.checked = false;
                    const imageItem = document.querySelector(`.tasklabs-image-item:nth-child(${index + 1})`);
                    imageItem?.classList.remove('selected');
                    const imgEl = validImages[index] as HTMLImageElement;
                    if (imgEl) {
                      imgEl.style.border = '';
                      imgEl.style.borderRadius = '';
                    }
                  });
                  updateButtonStates();
                };
                subheader.appendChild(selectAllContainer);
                subheader.appendChild(clearAll);
                dialogBox.appendChild(subheader);

                // Track added images by their source URL to prevent duplicates
                const addedImageSources = new Set<string>();

                // Image List
                const imageList = document.createElement('div');
                imageList.id = 'tasklabs-image-list';

                if (!validImages || validImages.length === 0) {
                  const noImagesMessage = document.createElement('div');
                  noImagesMessage.textContent = 'No images found on this page';
                  noImagesMessage.style.textAlign = 'center';
                  noImagesMessage.style.padding = '40px 20px';
                  noImagesMessage.style.color = '#6b7280';
                  imageList.appendChild(noImagesMessage);
                } else {
                  if (!validImages || !Array.isArray(validImages)) {
                    const noImagesMessage = document.createElement('div');
                    noImagesMessage.textContent = 'No images found on this page';
                    noImagesMessage.style.textAlign = 'center';
                    noImagesMessage.style.padding = '40px 20px';
                    noImagesMessage.style.color = '#6b7280';
                    imageList.appendChild(noImagesMessage);
                  } else {
                    validImages.forEach((img, index) => {
                      if (!img) return;

                      // Track this image's source to prevent duplicates
                      const imgEl = img as HTMLImageElement;
                      const imgSrc =
                        imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                      if (imgSrc) {
                        addedImageSources.add(imgSrc);
                      }

                      const imageItem = document.createElement('div');
                      imageItem.classList.add('tasklabs-image-item');

                      const checkbox = document.createElement('input');
                      checkbox.type = 'checkbox';
                      checkbox.classList.add('tasklabs-image-checkbox');
                      checkbox.id = `tasklabs-checkbox-${index}`;

                      const preview = document.createElement('img');
                      preview.classList.add('tasklabs-image-preview');
                      // Use actual src, or fallback to data-src for lazy-loaded images (imgEl already declared above)
                      const previewSrc =
                        imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                      preview.src = previewSrc;
                      preview.alt = `Preview ${index + 1}`;
                      preview.onerror = () => {
                        // Try data-src if regular src failed
                        const fallbackSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src');
                        if (fallbackSrc && preview.src !== fallbackSrc) {
                          preview.src = fallbackSrc;
                        } else {
                          preview.style.display = 'none';
                        }
                      };

                      const imageInfo = document.createElement('div');
                      imageInfo.classList.add('tasklabs-image-info');
                      const imageLabel = document.createElement('div');
                      imageLabel.classList.add('tasklabs-image-label');
                      imageLabel.textContent = `Image ${index + 1}`;
                      const imageDimensions = document.createElement('div');
                      imageDimensions.classList.add('tasklabs-image-dimensions');
                      if (imgEl.naturalWidth && imgEl.naturalHeight) {
                        imageDimensions.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}px`;
                      } else {
                        imageDimensions.textContent = 'Loading...';
                        imgEl.onload = () => {
                          imageDimensions.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}px`;
                        };
                      }
                      imageInfo.appendChild(imageLabel);
                      imageInfo.appendChild(imageDimensions);

                      checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                          selectedImages.add(index);
                          imageItem.classList.add('selected');
                          imgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          imgEl.style.border = '3px solid #dc2626';
                          imgEl.style.borderRadius = '4px';
                        } else {
                          selectedImages.delete(index);
                          imageItem.classList.remove('selected');
                          imgEl.style.border = '';
                          imgEl.style.borderRadius = '';
                        }
                        updateButtonStates();
                      });

                      imageItem.addEventListener('click', e => {
                        if (e.target !== checkbox) {
                          checkbox.click();
                        }
                      });

                      imageItem.appendChild(checkbox);
                      imageItem.appendChild(preview);
                      imageItem.appendChild(imageInfo);
                      imageList.appendChild(imageItem);
                    });
                  }
                }
                dialogBox.appendChild(imageList);
                // Verify image list has children
                const imageListChildren = imageList.children.length;
                if (imageListChildren === 0 && validImages.length > 0) {
                  console.error('[Image Download] ❌ Image list is empty but validImages has items!');
                  alert('⚠️ Warning: Images were found but not added to the list. Check console for details.');
                }

                // Helper function to get image extension
                const getImageExtension = (url: string): string => {
                  if (url.startsWith('data:image/')) {
                    const match = url.match(/data:image\/([a-zA-Z]+);/);
                    return match ? match[1] : 'png';
                  }
                  const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
                  return match ? match[1] : 'jpg';
                };

                // Download function using chrome.downloads API
                const downloadSelectedImages = async (format: string) => {
                  if (selectedImages.size === 0) {
                    console.warn('[Image Download] No images selected for download');
                    return;
                  }

                  const hostname = window.location.hostname.replace(/[^a-zA-Z0-9]/g, '_');
                  const date = new Date().toISOString().split('T')[0];
                  const folderName = `TaskLabs_Downloads/${hostname}_${date}`;

                  let downloadIndex = 1;
                  for (const index of Array.from(selectedImages).sort((a, b) => a - b)) {
                    if (!validImages || !validImages[index]) {
                      console.error(`Invalid image index: ${index}`);
                      continue;
                    }
                    const img = validImages[index] as HTMLImageElement;
                    if (!img) {
                      console.error(`Invalid image at index ${index}`);
                      continue;
                    }
                    // Get image source, checking lazy-loading attributes
                    const imgSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
                    if (!imgSrc) {
                      console.error(`No source found for image at index ${index}`);
                      continue;
                    }

                    try {
                      let dataUrl = imgSrc;
                      if (!imgSrc.startsWith('data:')) {
                        const response = await fetch(imgSrc);
                        const blob = await response.blob();
                        dataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onloadend = () => resolve(reader.result as string);
                          reader.onerror = reject;
                          reader.readAsDataURL(blob);
                        });
                      }

                      // Use actual extension from image or format parameter
                      const extension = format === 'png' ? 'png' : format === 'jpg' ? 'jpg' : getImageExtension(imgSrc);
                      const filename = `${folderName}/image_${downloadIndex}.${extension}`;

                      // Send download request via postMessage
                      window.postMessage(
                        {
                          type: 'TASKLABS_DOWNLOAD_IMAGE',
                          dataUrl: dataUrl,
                          filename: filename,
                        },
                        '*',
                      );

                      downloadIndex++;
                      await new Promise(resolve => setTimeout(resolve, 300));
                    } catch (error) {
                      console.error(`Error downloading image ${index + 1}:`, error);
                    }
                  }

                  // Close dialog after download
                  setTimeout(() => {
                    if (validImages && validImages.length > 0) {
                      validImages.forEach(img => {
                        (img as HTMLImageElement).style.border = '';
                        (img as HTMLImageElement).style.borderRadius = '';
                      });
                    }
                    if (document.body.contains(mainContainer)) {
                      document.body.removeChild(mainContainer);
                    }
                    if (document.head.contains(style)) {
                      document.head.removeChild(style);
                    }
                  }, 1000);
                };

                // Download Options
                const downloadOptionsContainer = document.createElement('div');
                downloadOptionsContainer.classList.add('tasklabs-download-options');

                const jpgButton = document.createElement('button');
                jpgButton.textContent = '📥 JPG';
                jpgButton.classList.add('tasklabs-download-button');
                jpgButton.onclick = () => downloadSelectedImages('jpg');

                const pngButton = document.createElement('button');
                pngButton.textContent = '📥 PNG';
                pngButton.classList.add('tasklabs-download-button');
                pngButton.onclick = () => downloadSelectedImages('png');

                const updateButtonStates = () => {
                  const disabled = selectedImages.size === 0;
                  [jpgButton, pngButton].forEach(btn => {
                    btn.disabled = disabled;
                    if (disabled) {
                      btn.classList.add('disabled');
                    } else {
                      btn.classList.remove('disabled');
                    }
                  });
                };
                updateButtonStates();

                downloadOptionsContainer.appendChild(jpgButton);
                downloadOptionsContainer.appendChild(pngButton);
                dialogBox.appendChild(downloadOptionsContainer);

                mainContainer.appendChild(dialogBox);

                // Ensure body exists and append
                if (!document.body) {
                  console.error('[Image Download] document.body does not exist!');
                  return;
                }

                document.body.appendChild(mainContainer);
                // Function to add a new image to the list
                const addImageToList = (img: HTMLImageElement, index: number) => {
                  if (!imageList) {
                    console.warn('[Image Download] Cannot add image: imageList not found');
                    return;
                  }

                  // Double-check this image hasn't been added already (by checking if checkbox exists)
                  const existingCheckbox = document.getElementById(`tasklabs-checkbox-${index}`);
                  if (existingCheckbox) {
                    console.warn(`[Image Download] Image at index ${index} already exists in list, skipping`);
                    return;
                  }

                  const imageItem = document.createElement('div');
                  imageItem.classList.add('tasklabs-image-item');
                  imageItem.id = `tasklabs-image-item-${index}`;

                  const checkbox = document.createElement('input');
                  checkbox.type = 'checkbox';
                  checkbox.classList.add('tasklabs-image-checkbox');
                  checkbox.id = `tasklabs-checkbox-${index}`;

                  const preview = document.createElement('img');
                  preview.classList.add('tasklabs-image-preview');
                  const previewSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
                  preview.src = previewSrc;
                  preview.alt = `Preview ${index + 1}`;
                  preview.onerror = () => {
                    const fallbackSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                    if (fallbackSrc && preview.src !== fallbackSrc) {
                      preview.src = fallbackSrc;
                    } else {
                      preview.style.display = 'none';
                    }
                  };

                  const imageInfo = document.createElement('div');
                  imageInfo.classList.add('tasklabs-image-info');
                  const imageLabel = document.createElement('div');
                  imageLabel.classList.add('tasklabs-image-label');
                  imageLabel.textContent = `Image ${index + 1}`;
                  const imageDimensions = document.createElement('div');
                  imageDimensions.classList.add('tasklabs-image-dimensions');
                  if (img.naturalWidth && img.naturalHeight) {
                    imageDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
                  } else {
                    imageDimensions.textContent = 'Loading...';
                    img.onload = () => {
                      imageDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
                    };
                  }
                  imageInfo.appendChild(imageLabel);
                  imageInfo.appendChild(imageDimensions);

                  checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                      selectedImages.add(index);
                      imageItem.classList.add('selected');
                      img.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      img.style.border = '3px solid #dc2626';
                      img.style.borderRadius = '4px';
                    } else {
                      selectedImages.delete(index);
                      imageItem.classList.remove('selected');
                      img.style.border = '';
                      img.style.borderRadius = '';
                    }
                    updateButtonStates();
                  });

                  imageItem.addEventListener('click', e => {
                    if (e.target !== checkbox) {
                      checkbox.click();
                    }
                  });

                  imageItem.appendChild(checkbox);
                  imageItem.appendChild(preview);
                  imageItem.appendChild(imageInfo);
                  imageList.appendChild(imageItem);
                };

                // Helper to normalize image URL (remove query params for comparison)
                // Handles Google Images encrypted URLs and other image CDN URLs
                const normalizeImageUrl = (url: string): string => {
                  if (!url) return '';
                  try {
                    const urlObj = new URL(url, window.location.href);
                    // Remove common query parameters that don't affect the image
                    // Google Images uses: q, s, w, h, usqp, etc.
                    urlObj.searchParams.delete('w');
                    urlObj.searchParams.delete('h');
                    urlObj.searchParams.delete('q');
                    urlObj.searchParams.delete('s'); // Google Images size parameter
                    urlObj.searchParams.delete('usqp'); // Google Images parameter
                    urlObj.searchParams.delete('fit');
                    urlObj.searchParams.delete('crop');
                    urlObj.searchParams.delete('ixid'); // Unsplash parameter
                    urlObj.searchParams.delete('ixlib'); // Unsplash parameter
                    // Keep the base URL and path, but normalize query params
                    return urlObj.toString();
                  } catch {
                    // If URL parsing fails, return original
                    return url.split('?')[0]; // At least remove query string
                  }
                };

                // Function to refresh image list by scanning for new images
                let isRefreshing = false;
                const refreshImageList = () => {
                  // Prevent concurrent refreshes
                  if (isRefreshing) {
                    return;
                  }
                  isRefreshing = true;
                  // Re-query all image sources (same as initial capture - <img>, <source>)
                  const allImages = document.querySelectorAll('img');
                  const pictureSources = document.querySelectorAll('picture source[srcset], picture source[src]');

                  // Collect all image sources
                  const allImageSources: HTMLImageElement[] = [];
                  Array.from(allImages).forEach(img => {
                    allImageSources.push(img as HTMLImageElement);
                  });

                  pictureSources.forEach(source => {
                    const srcset = source.getAttribute('srcset');
                    const src = source.getAttribute('src');
                    if (srcset || src) {
                      const url = srcset ? srcset.split(',')[0].trim().split(' ')[0] : src;
                      if (url && !url.startsWith('data:')) {
                        const tempImg = document.createElement('img');
                        tempImg.src = url;
                        tempImg.style.display = 'none';
                        allImageSources.push(tempImg);
                      }
                    }
                  });
                  // Load lazy images (helper function defined earlier in scope)
                  allImages.forEach(img => {
                    const dataSrc =
                      img.getAttribute('data-src') ||
                      img.getAttribute('data-lazy-src') ||
                      img.getAttribute('data-original');
                    if (dataSrc && !(img as HTMLImageElement).src) {
                      (img as HTMLImageElement).src = dataSrc;
                    }
                    const dataSrcset = img.getAttribute('data-srcset');
                    if (dataSrcset && !(img as HTMLImageElement).srcset) {
                      (img as HTMLImageElement).srcset = dataSrcset;
                    }
                  });

                  // Filter valid images (same logic as before)
                  const newValidImages: HTMLImageElement[] = [];
                  allImageSources.forEach((img, idx) => {
                    try {
                      const imgEl = img as HTMLImageElement;
                      if (!imgEl) return;

                      const hasSrc =
                        imgEl.src ||
                        imgEl.getAttribute('data-src') ||
                        imgEl.getAttribute('data-lazy-src') ||
                        imgEl.srcset;
                      if (!hasSrc) return;

                      const actualSrc =
                        imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                      if (!actualSrc) return;

                      // Handle data URLs (same as AutomationExtension - include them if not too small)
                      if (actualSrc.startsWith('data:')) {
                        try {
                          const base64Data = actualSrc.split(',')[1];
                          if (base64Data) {
                            const sizeInBytes = (base64Data.length * 3) / 4;
                            const sizeInKB = sizeInBytes / 1024;
                            // Skip data URLs smaller than 0.5 KB (likely icons/placeholders)
                            if (sizeInKB < 0.5) {
                              return;
                            }
                          }
                        } catch (e) {
                          // If we can't parse, include it anyway
                        }
                        // Include data URL images
                      }

                      // Normalize URL for comparison
                      const normalizedSrc = normalizeImageUrl(actualSrc);

                      // Check if this image source has already been added (using normalized URL)
                      if (addedImageSources.has(normalizedSrc) || addedImageSources.has(actualSrc)) {
                        return; // Skip - already added
                      }

                      const hasAnyWidth = imgEl.naturalWidth > 0 || imgEl.width > 0 || imgEl.offsetWidth > 0;
                      const hasAnyHeight = imgEl.naturalHeight > 0 || imgEl.height > 0 || imgEl.offsetHeight > 0;
                      const style = window.getComputedStyle(imgEl);
                      const isVisible =
                        style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

                      if (!hasAnyWidth && !hasAnyHeight && !isVisible) return;

                      const width = imgEl.naturalWidth || imgEl.width || imgEl.offsetWidth || 0;
                      const height = imgEl.naturalHeight || imgEl.height || imgEl.offsetHeight || 0;
                      const minSize = 10;
                      if (width > 0 && height > 0 && width < minSize && height < minSize && allImages.length > 5)
                        return;

                      // This is a new image - mark it as added (both normalized and original) and include it
                      addedImageSources.add(normalizedSrc);
                      if (normalizedSrc !== actualSrc) {
                        addedImageSources.add(actualSrc);
                      }
                      newValidImages.push(imgEl);
                    } catch (e) {
                      console.error(`[Image Download] Error processing image ${idx}:`, e);
                    }
                  });

                  // Add new images to the list
                  if (newValidImages.length > 0) {
                    newValidImages.forEach((img, relativeIndex) => {
                      const absoluteIndex = validImages.length;
                      validImages.push(img);
                      addImageToList(img, absoluteIndex);
                    });

                    // Update title
                    const titleElement = document.querySelector('.tasklabs-title');
                    if (titleElement) {
                      titleElement.textContent = `Export Images (${validImages.length})`;
                    }
                  } else {
                  }

                  isRefreshing = false;
                };

                // Set up MutationObserver to watch for new images added to DOM
                const mutationObserver = new MutationObserver(mutations => {
                  let hasNewImages = false;
                  mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                      if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        if (element.tagName === 'IMG' || element.querySelectorAll('img').length > 0) {
                          hasNewImages = true;
                        }
                      }
                    });
                  });
                  if (hasNewImages) {
                    setTimeout(refreshImageList, 500); // Small delay to let images start loading
                  }
                });

                // Start observing
                mutationObserver.observe(document.body, {
                  childList: true,
                  subtree: true,
                });

                // Also set up periodic refresh (every 3 seconds) to catch lazy-loaded images
                // Use longer interval to prevent too frequent checks
                const refreshInterval = setInterval(() => {
                  refreshImageList();
                }, 3000);

                // Set up close handler with cleanup for observers
                closeButton.onclick = () => {
                  // Clean up observers
                  mutationObserver.disconnect();
                  clearInterval(refreshInterval);

                  // Remove highlights
                  validImages.forEach(img => {
                    (img as HTMLImageElement).style.border = '';
                    (img as HTMLImageElement).style.borderRadius = '';
                  });

                  // Remove dialog
                  if (document.body.contains(mainContainer)) {
                    document.body.removeChild(mainContainer);
                  }
                  if (document.head.contains(style)) {
                    document.head.removeChild(style);
                  }
                };

                // Initial verification
                setTimeout(() => {
                  const checkDialog = document.getElementById('tasklabs-image-dialog');
                  const checkImageList = document.getElementById('tasklabs-image-list');

                  if (checkDialog && checkImageList) {
                    const rect = checkDialog.getBoundingClientRect();
                    const imageCount = checkImageList.children.length;
                  }
                }, 200);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : '';
                console.error('[Image Download] Error in image download UI:', error, errorStack);
                return { successCount: 0, total: 0, errors: [errorMsg] };
              }

              // Return initial success (actual download happens via UI)
              return { successCount: 0, total: validImages?.length || 0, errors: [] };
            },
            args: [{ ...options, downloadType }],
          },
          results => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              console.error('[Background] ✗ Script execution error:', lastError.message);
              sendResponse({ ok: false, error: lastError.message });
              return;
            }
            const scriptResult = results?.[0]?.result;
            if (scriptResult) {
              sendResponse({ ok: true, result: scriptResult });
            } else {
              sendResponse({ ok: true, result: { success: true } });
            }
          },
        );
        return true; // Keep message channel open for async response
      } else {
        // All download types now use the UI dialog above
        sendResponse({ ok: false, error: 'Invalid download type' });
        return false;
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
      return false;
    }
  }

  // Download file using chrome.downloads API
  if (request.action === 'download_file') {
    const { url, filename } = request as { url: string; filename: string };

    if (!chrome.downloads?.download) {
      sendResponse({ ok: false, error: 'downloads_api_unavailable' });
      return false;
    }

    try {
      if (!url) {
        console.error('[Background] ❌ No URL provided for download!');
        sendResponse({ ok: false, error: 'No URL provided for download' });
        return false;
      }

      chrome.downloads.download(
        {
          url: url,
          filename: filename,
          saveAs: false, // Don't show save dialog, use the filename directly
        },
        downloadId => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('[Background] ❌ Download failed:', lastError.message);
            sendResponse({ ok: false, error: lastError.message });
            return;
          }
          sendResponse({ ok: true, downloadId });
        },
      );
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
      return false;
    }
  }

  return false;
});

//sign-in / sign-out
chrome.runtime.onMessageExternal.addListener(function (request, sender, sendResponse) {
  if (request.type === 'auth_token') {
    chrome.storage.local.set(
      {
        accessToken: request.payload.userId,
        profileImg: request.payload.profileImageUrl,
        loggedIn: true,
      },
      function () {
        sendResponse({ status: 'success' });
      },
    );
  } else if (request.type === 'sign_out') {
    // Clear only session-specific keys, keeping local databases intact
    const KEYS_TO_REMOVE = [
      'accessToken',
      'profileImg',
      'loggedIn',
      'user_name',
      'user_email',
      'myCachedAllData',
      'orgRefreshCounters',
      'last_org_counter_check_timestamp',
      'last_org_counter_check_result'
    ];
    chrome.storage.local.remove(KEYS_TO_REMOVE, function () {
      sendResponse({ status: 'success' });
    });
  }

  return true; // Keeps the message channel open for asynchronous response
});

// Screenshot Handler
// Screenshot Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab({ format: 'png' }, dataUrl => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot capture failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tasklabs-screenshot-${timestamp}.png`;

      chrome.downloads.download(
        {
          url: dataUrl,
          filename: filename,
          saveAs: false,
        },
        downloadId => {
          if (chrome.runtime.lastError) {
            console.error('Download failed:', chrome.runtime.lastError);
            sendResponse({ success: false, error: 'Failed to start download' });
          } else {
            sendResponse({ success: true, downloadId });
          }
        },
      );
    });
    return true; // Keep channel open
  }

  if (request.action === 'CAPTURE_FULL_PAGE') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab found');

        // 1. Get page dimensions
        const dimensions = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const body = document.body;
            const html = document.documentElement;
            const fullHeight = Math.max(
              body.scrollHeight,
              body.offsetHeight,
              html.clientHeight,
              html.scrollHeight,
              html.offsetHeight,
            );
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const devicePixelRatio = window.devicePixelRatio || 1;
            return { fullHeight, viewportHeight, viewportWidth, devicePixelRatio };
          },
        });

        if (!dimensions || !dimensions[0] || !dimensions[0].result) throw new Error('Failed to get page dimensions');
        const { fullHeight, viewportHeight, viewportWidth, devicePixelRatio } = dimensions[0].result;

        // 2. Loop and capture
        const screenshots: { y: number; dataUrl: string }[] = [];
        let currentScroll = 0;
        const scrollStep = viewportHeight; // Overlapping handles better stitching but simple step is fine for now

        // Hide scrollbars
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            document.body.style.overflow = 'hidden';
          },
        });

        // Scroll to top
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.scrollTo(0, 0);
          },
        });
        await new Promise(r => setTimeout(r, 500));

        while (currentScroll < fullHeight) {
          // Scroll
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: y => {
              window.scrollTo(0, y);
            },
            args: [currentScroll],
          });

          // Wait for render
          await new Promise(r => setTimeout(r, 1000));

          // Capture
          const dataUrl = await new Promise<string>((resolve, reject) => {
            chrome.tabs.captureVisibleTab({ format: 'png' }, url => {
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve(url);
            });
          });

          screenshots.push({ y: currentScroll, dataUrl });
          currentScroll += scrollStep;
        }

        // Restore scrollbars
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            document.body.style.overflow = '';
            window.scrollTo(0, 0);
          },
        });

        // 3. Stitch images
        // We inject a script that creates a canvas, draws all images, and returns the final data URL
        const stitchedResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (images: any[], width: number, height: number, viewH: number, dpr: number) => {
            const canvas = document.createElement('canvas');
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // Load and draw all images
            for (const imgData of images) {
              const img = new Image();
              img.src = imgData.dataUrl;
              await new Promise(r => {
                img.onload = r;
              });
              ctx.drawImage(img, 0, imgData.y * dpr);
            }
            return canvas.toDataURL('image/png');
          },
          args: [screenshots as any, viewportWidth, fullHeight, viewportHeight, devicePixelRatio],
        });

        const finalDataUrl = stitchedResult[0].result;
        if (!finalDataUrl) throw new Error('Failed to stitch images');

        // 4. Download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `tasklabs-fullpage-${timestamp}.png`;

        chrome.downloads.download({
          url: finalDataUrl,
          filename: filename,
          saveAs: false,
        });

        sendResponse({ success: true });
      } catch (err: any) {
        console.error('Full page capture failed:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open
  }

  if (request.action === 'INIT_ELEMENT_SELECTION') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab found');

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Check if already initialized
            if ((window as any)._tsElementPicker) return;

            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.pointerEvents = 'none';
            overlay.style.border = '2px solid #3b82f6';
            overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            overlay.style.zIndex = '999999';
            overlay.style.transition = 'all 0.1s ease';
            document.body.appendChild(overlay);

            const handleMouseOver = (e: MouseEvent) => {
              const target = e.target as HTMLElement;
              if (target === overlay) return;

              const rect = target.getBoundingClientRect();
              overlay.style.top = `${rect.top}px`;
              overlay.style.left = `${rect.left}px`;
              overlay.style.width = `${rect.width}px`;
              overlay.style.height = `${rect.height}px`;
            };

            const handleClick = (e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();

              const target = e.target as HTMLElement;
              const rect = target.getBoundingClientRect();
              const dpr = window.devicePixelRatio || 1;

              // Cleanup
              document.removeEventListener('mouseover', handleMouseOver);
              document.removeEventListener('click', handleClick, true);
              overlay.remove();
              (window as any)._tsElementPicker = false;

              // Send coordinates to background
              chrome.runtime.sendMessage({
                action: 'CAPTURE_ELEMENT',
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  dpr,
                },
              });
            };

            document.addEventListener('mouseover', handleMouseOver);
            document.addEventListener('click', handleClick, true);
            (window as any)._tsElementPicker = true;
          },
        });

        sendResponse({ success: true });
      } catch (err: any) {
        console.error('Failed to init element selection:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'CAPTURE_ELEMENT') {
    const { rect } = request;

    chrome.tabs.captureVisibleTab({ format: 'png' }, async dataUrl => {
      if (!dataUrl) {
        console.error('Failed to capture visible tab');
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab');

        // Crop image via injected script
        const croppedDataUrlResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (imgUrl: string, cropRect: any) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const img = new Image();
            img.src = imgUrl;
            await new Promise(r => {
              img.onload = r;
            });

            // Set canvas to cropped size
            canvas.width = cropRect.width * cropRect.dpr;
            canvas.height = cropRect.height * cropRect.dpr;

            // Draw cropped portion
            // sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight
            ctx.drawImage(
              img,
              cropRect.x * cropRect.dpr,
              cropRect.y * cropRect.dpr,
              cropRect.width * cropRect.dpr,
              cropRect.height * cropRect.dpr,
              0,
              0,
              cropRect.width * cropRect.dpr,
              cropRect.height * cropRect.dpr,
            );

            return canvas.toDataURL('image/png');
          },
          args: [dataUrl, rect],
        });

        const finalUrl = croppedDataUrlResults[0]?.result;
        if (!finalUrl) throw new Error('Failed to crop image');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `tasklabs-element-${timestamp}.png`;

        chrome.downloads.download({
          url: finalUrl,
          filename: filename,
          saveAs: false,
        });
      } catch (err) {
        console.error('Element capture failed:', err);
      }
    });
    return true;
  }

  // Table download script injection
  if (request.action === 'execute_table_download') {
    const { tabId, downloadType, options } = request as {
      tabId: number;
      downloadType: 'all' | 'selected';
      options?: any;
    };

    // Infer tabId from sender if not provided
    let targetTabId = tabId;
    if (!targetTabId && sender?.tab?.id) {
      targetTabId = sender.tab.id;
    }
    if (!chrome.scripting?.executeScript) {
      console.error('[Background] ✗ Scripting API not available');
      sendResponse({ ok: false, error: 'scripting_api_unavailable' });
      return false;
    }

    if (typeof targetTabId !== 'number' || targetTabId <= 0) {
      console.error('[Background] ✗ Invalid tab ID:', targetTabId);
      sendResponse({ ok: false, error: 'invalid_tab_id' });
      return false;
    }
    try {
      chrome.scripting.executeScript(
        {
          target: { tabId: targetTabId },
          func: async () => {
            try {
              // Find all tables on the page
              const tables = document.querySelectorAll('table');
              if (tables.length === 0) {
                alert('No tables found on this page.');
                return { success: false, error: 'No tables found' };
              }

              // Helper function to convert table to CSV
              const tableToCSV = (table: HTMLTableElement): string => {
                const rows = table.querySelectorAll('tr');
                const csvRows: string[] = [];

                rows.forEach(row => {
                  const cells = row.querySelectorAll('th, td');
                  const rowData: string[] = [];

                  cells.forEach(cell => {
                    // Get text content, clean it up
                    let text = (cell as HTMLElement).innerText || '';
                    // Escape quotes and wrap in quotes if contains comma, newline, or quote
                    text = text.replace(/"/g, '""');
                    if (text.includes(',') || text.includes('\n') || text.includes('"')) {
                      text = `"${text}"`;
                    }
                    rowData.push(text);
                  });

                  csvRows.push(rowData.join(','));
                });

                return csvRows.join('\n');
              };

              // Helper function to download CSV
              const downloadCSV = (csv: string, filename: string) => {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              };

              // Remove any existing dialog
              const existingDialog = document.getElementById('tasklabs-table-dialog');
              if (existingDialog) {
                existingDialog.parentElement?.removeChild(existingDialog);
              }

              // Create overlay
              const overlay = document.createElement('div');
              overlay.id = 'tasklabs-table-main-container';
              overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.1);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                font-family: system-ui, -apple-system, sans-serif;
                padding-right: 20px;
                box-sizing: border-box;
              `;

              // Create dialog
              const dialog = document.createElement('div');
              dialog.id = 'tasklabs-table-dialog';
              dialog.style.cssText = `
                width: 450px;
                max-width: 90vw;
                height: 90vh;
                max-height: 90vh;
                background: rgb(235 235 235 / 75%);
                backdrop-filter: blur(30px) saturate(180%);
                -webkit-backdrop-filter: blur(30px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.4);
                border-radius: 16px;
                display: flex;
                flex-direction: column;
                box-shadow: -10px 0 40px -10px rgba(0, 0, 0, 0.1);
                color: #1f2937;
                overflow: hidden;
              `;

              // Header
              const header = document.createElement('div');
              header.style.cssText = `
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
              `;
              header.innerHTML = `
                <div>
                  <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Download Tables</h2>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">${tables.length} table(s) found</p>
                </div>
                <button id="tasklabs-table-close" style="
                  background: none;
                  border: none;
                  font-size: 24px;
                  cursor: pointer;
                  color: #6b7280;
                  padding: 4px 8px;
                  border-radius: 6px;
                  transition: background 0.2s;
                ">×</button>
              `;
              dialog.appendChild(header);

              // Table list container
              const tableList = document.createElement('div');
              tableList.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 12px;
              `;

              // Selected tables set
              const selectedTables = new Set<number>();

              // Add table items
              tables.forEach((table, index) => {
                const rows = table.querySelectorAll('tr').length;
                const cols = table.querySelectorAll('tr:first-child th, tr:first-child td').length;
                const headerText =
                  table.querySelector('th, caption')?.textContent?.substring(0, 50) || `Table ${index + 1}`;

                const tableItem = document.createElement('div');
                tableItem.dataset.tableIndex = String(index);
                tableItem.style.cssText = `
                  display: flex;
                  align-items: center;
                  padding: 12px;
                  margin-bottom: 8px;
                  background: rgba(255, 255, 255, 0.5);
                  border: 2px solid transparent;
                  border-radius: 10px;
                  cursor: pointer;
                  transition: all 0.2s;
                `;

                // Checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.style.cssText = `
                  width: 18px;
                  height: 18px;
                  margin-right: 12px;
                  cursor: pointer;
                `;
                checkbox.addEventListener('change', () => {
                  if (checkbox.checked) {
                    selectedTables.add(index);
                    tableItem.style.borderColor = '#3b82f6';
                    tableItem.style.background = 'rgba(59, 130, 246, 0.1)';
                  } else {
                    selectedTables.delete(index);
                    tableItem.style.borderColor = 'transparent';
                    tableItem.style.background = 'rgba(255, 255, 255, 0.5)';
                  }
                  updateDownloadButton();
                });

                // Table info
                const info = document.createElement('div');
                info.style.cssText = 'flex: 1;';
                info.innerHTML = `
                  <div style="font-weight: 500; font-size: 14px; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${headerText}</div>
                  <div style="font-size: 12px; color: #6b7280;">${rows} rows × ${cols} columns</div>
                `;

                // Preview button
                const previewBtn = document.createElement('button');
                previewBtn.textContent = 'Preview';
                previewBtn.style.cssText = `
                  background: rgba(0, 0, 0, 0.05);
                  border: none;
                  padding: 6px 12px;
                  border-radius: 6px;
                  font-size: 12px;
                  cursor: pointer;
                  transition: background 0.2s;
                `;
                previewBtn.addEventListener('mouseenter', () => {
                  previewBtn.style.background = 'rgba(0, 0, 0, 0.1)';
                });
                previewBtn.addEventListener('mouseleave', () => {
                  previewBtn.style.background = 'rgba(0, 0, 0, 0.05)';
                });
                previewBtn.addEventListener('click', e => {
                  e.stopPropagation();
                  // Scroll to table on the page
                  table.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  table.style.outline = '3px solid #3b82f6';
                  setTimeout(() => {
                    table.style.outline = '';
                  }, 2000);
                });

                tableItem.appendChild(checkbox);
                tableItem.appendChild(info);
                tableItem.appendChild(previewBtn);

                tableItem.addEventListener('click', e => {
                  if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                  }
                });

                tableList.appendChild(tableItem);
              });

              dialog.appendChild(tableList);

              // Footer with buttons
              const footer = document.createElement('div');
              footer.style.cssText = `
                padding: 16px 20px;
                border-top: 1px solid rgba(0, 0, 0, 0.1);
                display: flex;
                gap: 10px;
              `;

              // Select all button
              const selectAllBtn = document.createElement('button');
              selectAllBtn.textContent = 'Select All';
              selectAllBtn.style.cssText = `
                flex: 1;
                padding: 10px;
                background: rgba(0, 0, 0, 0.05);
                border: none;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.2s;
              `;
              selectAllBtn.addEventListener('click', () => {
                const checkboxes = tableList.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => {
                  cb.checked = !allChecked;
                  cb.dispatchEvent(new Event('change'));
                });
              });

              // Download button
              const downloadBtn = document.createElement('button');
              downloadBtn.id = 'tasklabs-table-download';
              downloadBtn.textContent = 'Download Selected (0)';
              downloadBtn.disabled = true;
              downloadBtn.style.cssText = `
                flex: 2;
                padding: 10px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                opacity: 0.5;
              `;

              const updateDownloadButton = () => {
                const count = selectedTables.size;
                downloadBtn.textContent = `Download Selected (${count})`;
                downloadBtn.disabled = count === 0;
                downloadBtn.style.opacity = count === 0 ? '0.5' : '1';
                downloadBtn.style.cursor = count === 0 ? 'not-allowed' : 'pointer';
              };

              downloadBtn.addEventListener('click', () => {
                if (selectedTables.size === 0) return;

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

                selectedTables.forEach(index => {
                  const table = tables[index] as HTMLTableElement;
                  const csv = tableToCSV(table);
                  const filename = `table-${index + 1}-${timestamp}.csv`;
                  downloadCSV(csv, filename);
                });

                // Close dialog after download
                overlay.remove();
              });

              footer.appendChild(selectAllBtn);
              footer.appendChild(downloadBtn);
              dialog.appendChild(footer);

              overlay.appendChild(dialog);
              document.body.appendChild(overlay);

              // Close button handler
              const closeBtn = document.getElementById('tasklabs-table-close');
              if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                  overlay.remove();
                  // Refocus AltS popup
                  window.postMessage({ type: 'TASKLABS_ALTS_REFOCUS' }, '*');
                });
              }

              // Click outside to close
              overlay.addEventListener('click', e => {
                if (e.target === overlay) {
                  overlay.remove();
                  window.postMessage({ type: 'TASKLABS_ALTS_REFOCUS' }, '*');
                }
              });

              // ESC key to close
              const escHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                  overlay.remove();
                  window.postMessage({ type: 'TASKLABS_ALTS_REFOCUS' }, '*');
                  document.removeEventListener('keydown', escHandler);
                }
              };
              document.addEventListener('keydown', escHandler);

              return { success: true, tableCount: tables.length };
            } catch (error) {
              console.error('[Table Download] Error:', error);
              return { success: false, error: String(error) };
            }
          },
        },
        results => {
          sendResponse({ ok: true, results });
        },
      );
    } catch (error) {
      console.error('[Background] Error executing table download script:', error);
      sendResponse({ ok: false, error: String(error) });
    }
    return true;
  }

  if (request.type === 'inject_auto_submit') {
    const { tabId, request: nestedRequest } = request;
    if (tabId && nestedRequest) {
      executeAutoSubmit(tabId, nestedRequest)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('[Background] executeAutoSubmit error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true;
    }
  }

  if (request.type === 'GET_TAB_ID' || request.action === 'GET_TAB_ID') {
    if (sender.tab?.id) {
      sendResponse(sender.tab.id);
      return false;
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        sendResponse(tabs[0]?.id);
      });
      return true; // Keep channel open for async response
    }
  }

  return true;
});

// --- CONTEXT MENU SETUP ---
const CONTEXT_MENU_PARENT_ID = 'cmdos_commands';
const CONTEXT_MENU_AI_OPTIONS = [
  { id: 'gpt', label: 'ChatGPT', kind: 'chatgpt', url: 'https://chatgpt.com/' },
  { id: 'perplexity', label: 'Perplexity', kind: 'perplexity', url: 'https://www.perplexity.ai/search' },
  { id: 'claude', label: 'Claude', kind: 'claude', url: 'https://claude.ai/new' },
  { id: 'all_ai', label: 'All AI', kind: 'ai' },
];

function setupContextMenus() {
  if (!chrome.contextMenus) return;

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PARENT_ID,
      title: 'cmdOS - Commands',
      contexts: ['selection'],
    });

    CONTEXT_MENU_AI_OPTIONS.forEach(opt => {
      chrome.contextMenus.create({
        id: `ask_${opt.id}`,
        parentId: CONTEXT_MENU_PARENT_ID,
        title: opt.label,
        contexts: ['selection'],
      });
    });
  });
}

// Ensure context menus are created on startup
setupContextMenus();

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  const selectionText = info.selectionText;
  if (!selectionText || !info.menuItemId.toString().startsWith('ask_')) return;

  const id = info.menuItemId.toString().replace('ask_', '');

  if (id === 'all_ai') {
    const { selectedAIs } = await chrome.storage.local.get(['selectedAIs']);
    // Fallback to these 3 if none selected – user requested these specifically
    const activeAIs =
      selectedAIs && Array.isArray(selectedAIs) && selectedAIs.length > 0
        ? selectedAIs
        : ['gpt', 'perplexity', 'claude'];

    activeAIs.forEach((aiId: string, index: number) => {
      const opt = CONTEXT_MENU_AI_OPTIONS.find(o => o.id === aiId);
      if (opt && opt.url) {
        chrome.tabs.create({ url: opt.url, active: index === 0 }, newTab => {
          if (newTab?.id) {
            const q = tabPromptQueues.get(newTab.id) || [];
            q.push({
              kind: opt.kind as any,
              prompt: selectionText,
            });
            tabPromptQueues.set(newTab.id, q);

            if (newTab.status === 'complete') {
              processTabQueue(newTab.id);
            }
          }
        });
      }
    });
  } else {
    const opt = CONTEXT_MENU_AI_OPTIONS.find(o => o.id === id);
    if (opt && opt.url) {
      chrome.tabs.create({ url: opt.url, active: true }, newTab => {
        if (newTab?.id) {
          const q = tabPromptQueues.get(newTab.id) || [];
          q.push({
            kind: opt.kind as any,
            prompt: selectionText,
          });
          tabPromptQueues.set(newTab.id, q);

          if (newTab.status === 'complete') {
            processTabQueue(newTab.id);
          }
        }
      });
    }
  }
});

// --- ALARM LISTENER ---
chrome.alarms.onAlarm.addListener(async alarm => {
  // 1. Handle Automation Alarms
  if (alarm.name.startsWith('automation_')) {
    const automationId = alarm.name.replace('automation_', '');
    try {
      const { automations } = await chrome.storage.local.get(['automations']);
      const automation = automations ? automations[automationId] : null;
      if (automation && automation.steps) {
        await executeAutomation(automation);
      } else {
        console.error('[Background] Automation not found for scheduled alarm:', automationId);
      }
    } catch (err) {
      console.error('[Background] Failed to execute scheduled automation:', err);
    }
    return;
  }

  // 2. Handle Todo Alarms
  if (alarm.name.startsWith('todo|')) {
    const todoId = alarm.name.split('|')[1];

    if (!todoId) return;

    try {
      const todo = await findTodoById(todoId);
      if (!todo) {
        console.warn('[Background] Alarm triggered but Todo not found:', todoId);
        return;
      }

      // If it's done, don't notify (unless it's recurring and we just reset it)
      if (todo.is_done) {
        return;
      }

      const key = todo.key || todo.title || 'Task Due';
      const category = (todo.category || todo.snippet_category || '').toLowerCase();
      const value = todo.value || '';
      const isCustom = category === 'note' || category === 'snippet' || category === '';

      let displayMessage = key;
      if (isCustom && value && value !== key) {
        displayMessage += `\n${value}`;
      }

      const iconUrl = chrome.runtime.getURL('icon.png');

      createNotification(`alarm-${todoId}-${Date.now()}`, {
        type: 'basic',
        iconUrl,
        title: 'cmdOS Notification',
        message: displayMessage,
        priority: 2,
      });

      // Also show beautiful in-tab toast for active feedback
      showInTabToast('cmdOS Notification', key);

      // Reschedule if recurring
      const isRecurring = !!(todo.is_recurring || todo.recurring);
      const recurringCycle = (todo.recurring_cycle || todo.recurring_frequency || 'none').toLowerCase();

      if (isRecurring && recurringCycle !== 'none') {
        const now = Date.now();
        let nextRunTime = alarm.scheduledTime || now;
        const MIN_GAP = 60 * 1000;

        // Calculate next run time
        while (nextRunTime <= now + MIN_GAP) {
          if (recurringCycle === 'daily') nextRunTime += 24 * 60 * 60 * 1000;
          else if (recurringCycle === 'weekly') nextRunTime += 7 * 24 * 60 * 60 * 1000;
          else if (recurringCycle === 'monthly') {
            const tempDate = new Date(nextRunTime);
            tempDate.setMonth(tempDate.getMonth() + 1);
            nextRunTime = tempDate.getTime();
          } else {
            nextRunTime += 24 * 60 * 60 * 1000;
            break;
          }
        }
        chrome.alarms.create(`todo|${todoId}`, { when: nextRunTime });

        // Update local cache
        const result = await chrome.storage.local.get(['local_todos']);
        const localTodos = (result.local_todos || []).map((t: any) =>
          t.id === todoId || t.snippet_id === todoId
            ? { ...t, event_deadline: new Date(nextRunTime).toISOString(), is_done: false }
            : t,
        );
        await chrome.storage.local.set({ local_todos: localTodos });

        // Sync with cloud if needed
        if (todoId && !String(todoId).startsWith('local-')) {
          await editTodo(todo.todo_id || todoId, new Date(nextRunTime).toISOString(), recurringCycle, undefined, undefined, true).catch(err =>
            console.warn('[Background] Cloud reschedule failed:', err),
          );
        }
      }
    } catch (err) {
      console.error('[Background] onAlarm handler failed:', err);
    }
  }
});

// --- NOTIFICATION CLICK LISTENER ---
/**
 * When a notification is clicked, automatically mark the task as done
 * using the same logic as the main app's "Enter" key behavior.
 */
chrome.notifications.onClicked.addListener(notificationId => {
  if (
    notificationId.startsWith('todo-') ||
    notificationId.startsWith('reminder-') ||
    notificationId.startsWith('alarm-') ||
    notificationId.startsWith('immediate-')
  ) {
    // Extract todoId by removing prefix and suffix timestamp
    // Format is: [prefix]-[todoId]-[timestamp]
    // Note: todoId itself might contain dashes (e.g., local-123 or UUID)
    const firstDash = notificationId.indexOf('-');
    const lastDash = notificationId.lastIndexOf('-');
    const todoId = notificationId.substring(firstDash + 1, lastDash);

    if (todoId) {
      // 1. Execute the task action (Open tab, trigger automation, etc)
      executeTodoAction(todoId);

      // 2. Complete the task logic (Sync cloud, reschedule recurring, clear alarms)
      completeTodoInBg(todoId);

      // 3. Clear the notification after it's clicked
      chrome.notifications.clear(notificationId);
    }
  }
});
