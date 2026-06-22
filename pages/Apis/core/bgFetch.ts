export function isContentScriptContext(): boolean {
  try {
    // content scripts run on http/https pages, not chrome-extension pages
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !location.href.startsWith('chrome-extension://');
  } catch {
    return false;
  }
}

export function bgGet<T = any>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'http_fetch', path, method: 'GET' }, (resp: any) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!resp || resp.ok === false) {
          return reject(new Error(resp?.error || `Request failed: ${resp?.status}`));
        }
        resolve(resp.data as T);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function bgRequest<T = any>(options: {
  url?: string;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'http_fetch', ...options }, (resp: any) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!resp || resp.ok === false) {
          return reject(new Error(resp?.error || `Request failed: ${resp?.status}`));
        }
        resolve(resp.data as T);
      });
    } catch (e) {
      reject(e);
    }
  });
}
