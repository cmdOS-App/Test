export const COUNTER_EVENT_TYPES = [
  'hotkey_count',
  'note_open_count',
  'link_open_count',
  'search_command_count',
  'command_count',
] as const;

export type CounterEventType = (typeof COUNTER_EVENT_TYPES)[number];
export type CounterEventMeta = Record<string, unknown> | undefined;

export const isCounterEventType = (value: unknown): value is CounterEventType =>
  COUNTER_EVENT_TYPES.includes(value as CounterEventType);

type CounterDayBucket = {
  counts: Record<string, number>;
  commandCounts: Record<string, number>;
  lastUpdated: number;
};

type CounterTrackingStore = {
  version: 1;
  timezoneOffsetMinutes: number;
  days: Record<string, CounterDayBucket>;
  lastUpdated: number;
};

const COUNTERS_TRACKING_KEY = 'counters_daily_v1';

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

const toDateKey = (timestamp: number) => {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const buildStore = (raw: unknown): CounterTrackingStore => {
  const base = (raw || {}) as Partial<CounterTrackingStore>;
  const days = typeof base.days === 'object' && base.days !== null ? { ...base.days } : {};
  const lastUpdated = typeof base.lastUpdated === 'number' ? base.lastUpdated : 0;
  return {
    version: 1,
    timezoneOffsetMinutes: typeof base.timezoneOffsetMinutes === 'number' ? base.timezoneOffsetMinutes : 0,
    days,
    lastUpdated,
  };
};

let trackingQueue = Promise.resolve();

export const trackCounterEvent = (type: CounterEventType, meta?: CounterEventMeta) => {
  trackingQueue = trackingQueue
    .then(async () => {
      const result = await chrome.storage.local.get(COUNTERS_TRACKING_KEY);
      const store = buildStore(result?.[COUNTERS_TRACKING_KEY]);
      const ts = Date.now();
      const dayKey = toDateKey(ts);
      const dayBucket: CounterDayBucket = store.days[dayKey] || {
        counts: {},
        commandCounts: {},
        lastUpdated: 0,
      };

      dayBucket.counts[type] = (Number(dayBucket.counts[type]) || 0) + 1;
      if (type === 'command_count') {
        const commandIdRaw = typeof meta === 'object' && meta ? (meta as any).commandId : null;
        const commandKey = normalizeTrackedCommandKey(commandIdRaw);
        if (commandKey) {
          dayBucket.commandCounts[commandKey] = (Number(dayBucket.commandCounts[commandKey]) || 0) + 1;
        }
      }

      dayBucket.lastUpdated = ts;
      store.days[dayKey] = dayBucket;
      store.lastUpdated = ts;
      store.timezoneOffsetMinutes = new Date(ts).getTimezoneOffset();

      await chrome.storage.local.set({ [COUNTERS_TRACKING_KEY]: store });
    })
    .catch(error => {
      console.error('[CounterTracking] Failed to record event:', error);
    });
};
