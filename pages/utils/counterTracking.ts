export const COUNTER_EVENT_TYPES = [
  'hotkey_count',
  'note_open_count',
  'link_open_count',
  'search_command_count',
  'command_count',
] as const;

export type CounterEventType = (typeof COUNTER_EVENT_TYPES)[number];
export type CounterEventMeta = Record<string, unknown> | undefined;

const TRACK_EVENT_ACTION = 'track_counter_event';

const normalizeTrackedCommandKey = (commandIdRaw: unknown): 'store' | 'agent' | 'gpt' | 'google' | null => {
  if (commandIdRaw === undefined || commandIdRaw === null) return null;
  const commandId = String(commandIdRaw).trim().toLowerCase();
  if (!commandId) return null;

  if (commandId === 'gpt') return 'gpt';
  if (commandId === 'google') return 'google';
  if (commandId === 'store' || commandId === 'saved-automation') return 'store';
  if (
    commandId === 'agent' ||
    commandId === 'ai' ||
    commandId === 'claude' ||
    commandId === 'gemini' ||
    commandId === 'perplexity'
  ) {
    return 'agent';
  }

  return null;
};

export const trackCounterEvent = (type: CounterEventType, meta?: CounterEventMeta) => {
  try {
    const chromeAny = typeof chrome !== 'undefined' ? chrome : (typeof window !== 'undefined' ? (window as any)?.chrome : null);
    if (chromeAny?.runtime?.sendMessage) {
      // Send to background script which handles the actual persistence in chrome.storage.local
      chromeAny.runtime.sendMessage({ action: TRACK_EVENT_ACTION, type, meta }, (response: any) => {
        if (chromeAny?.runtime?.lastError) {
          console.warn('[CounterTracking] Message failed (likely background script inactive):', chromeAny.runtime.lastError);
        } else if (response?.ok === false) {
          console.warn('[CounterTracking] Background script failed to record event:', response.error);
        }
      });
    } else {
      console.warn('[CounterTracking] chrome.runtime.sendMessage not available');
    }
  } catch (error) {
    console.error('[CounterTracking] Unexpected error during event tracking:', error);
  }
};
