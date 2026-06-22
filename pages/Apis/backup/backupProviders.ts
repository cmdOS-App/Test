/**
 * backupProviders.ts
 *
 * Milestone 7A — Google Drive Backup Provider
 *
 * Uses chrome.identity.getAuthToken() — the official Chrome Extension OAuth flow.
 * This requires the oauth2 block in manifest.json (injected at build time from .env).
 *
 * Key design decisions:
 *   - chrome.identity.getAuthToken() handles the entire OAuth popup — no redirect URI needed
 *   - Token is managed by Chrome itself (no manual storage needed for the token)
 *   - Files stored in appDataFolder (hidden from user's Drive UI, app-scoped)
 *   - On 401, revokes the cached token and retries once with a fresh token
 */

import { GDRIVE_TOKEN_KEY, GDRIVE_TOKEN_EXPIRY_KEY } from './oauthConfig';

// ─── Generic Interface ────────────────────────────────────────────────────────

export interface DriveFileEntry {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  /** size in bytes as a string (Drive API returns it that way) */
  size?: string;
  appProperties?: {
    version?: string;
    exportedAt?: string;
    appId?: string;
    backupType?: string;
  };
}

export interface IBackupProvider {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  uploadBackup(fileName: string, payload: unknown): Promise<boolean>;
  listBackups(): Promise<DriveFileEntry[]>;
  downloadBackup(fileId: string): Promise<unknown>;
  deleteBackup(fileId: string): Promise<boolean>;
  getUserEmail(): Promise<string>;
}

// ─── Google Drive Provider ────────────────────────────────────────────────────

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export class GoogleDriveProvider implements IBackupProvider {
  // ── Token via chrome.identity ───────────────────────────────────────────────

  /** Gets a token interactively (shows Google sign-in popup if needed). */
  private getToken(interactive: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, token => {
        if (chrome.runtime.lastError || !token) {
          const msg = chrome.runtime.lastError?.message ?? 'Failed to get auth token';
          reject(new Error(msg));
        } else {
          resolve(token as string);
        }
      });
    });
  }

  /** Revokes a specific cached token so Chrome will fetch a fresh one next time. */
  private revokeToken(token: string): Promise<void> {
    return new Promise(resolve => {
      chrome.identity.removeCachedAuthToken({ token }, resolve);
    });
  }

  // ── IBackupProvider ─────────────────────────────────────────────────────────

  async connect(): Promise<boolean> {
    try {
      const token = await this.getToken(true);
      return !!token;
    } catch (err: any) {
      // User cancelled the sign-in popup — not an error we throw
      if (err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
        return false;
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const token = await this.getToken(false);
      if (token) {
        // Revoke the token on Google's authorization servers
        try {
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
        } catch (revokeErr) {
          console.error('[GoogleDriveProvider] Server-side token revocation failed:', revokeErr);
        }
        // Remove from Chrome's cache
        await this.revokeToken(token);
      }
    } catch {
      // Already disconnected — no-op
    }

    // Force clear all cached tokens for the extension to ensure clean slate
    if (chrome.identity && typeof (chrome.identity as any).clearAllCachedAuthTokens === 'function') {
      await new Promise<void>(resolve => {
        (chrome.identity as any).clearAllCachedAuthTokens(resolve);
      });
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      // Non-interactive: returns a token only if one is already cached
      const token = await this.getToken(false);
      return !!token;
    } catch {
      return false;
    }
  }

  // ── HTTP Utilities ──────────────────────────────────────────────────────────

  /**
   * Performs an authenticated Drive API request.
   * On 401, automatically revokes the stale token and retries once with a fresh one.
   */
  private async driveRequest(
    url: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<Response> {
    const token = await this.getToken(false);

    const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && retry) {
      // Token rejected — revoke and get a fresh one
      await this.revokeToken(token);
      return this.driveRequest(url, options, false);
    }

    return response;
  }

  // ── IBackupProvider Implementation ─────────────────────────────────────────

  async uploadBackup(fileName: string, payload: unknown): Promise<boolean> {
    const jsonStr = JSON.stringify(payload, null, 2);
    const boundary = '-------tasklabs_drive_backup_boundary';

    const metadata = {
      name: fileName,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
      appProperties: {
        version: String((payload as any).version || '1.0.0'),
        exportedAt: String((payload as any).exportedAt || new Date().toISOString()),
        appId: String((payload as any).appId || 'tasklabs'),
        backupType: String((payload as any).backupType || 'manual'),
      }
    };

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      jsonStr,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await this.driveRequest(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Drive upload failed (${response.status}): ${errText}`);
    }

    return true;
  }

  async listBackups(): Promise<DriveFileEntry[]> {
    const fields = 'files(id,name,createdTime,modifiedTime,size,appProperties)';
    const query = "name contains 'tasklabs-backup'";
    const url = `${DRIVE_API}/files?spaces=appDataFolder&fields=${encodeURIComponent(fields)}&q=${encodeURIComponent(query)}&orderBy=createdTime desc`;

    const response = await this.driveRequest(url, { method: 'GET' });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to list Drive backups (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return (data.files ?? []) as DriveFileEntry[];
  }

  async getUserEmail(): Promise<string> {
    // 1. Try Chrome Identity API first
    const chromeEmail = await new Promise<string>(resolve => {
      if (typeof chrome !== 'undefined' && chrome.identity?.getProfileUserInfo) {
        try {
          (chrome.identity.getProfileUserInfo as any)({ accountStatus: 'ANY' } as any, (userInfo: any) => {
            resolve(userInfo?.email || '');
          });
        } catch (e) {
          console.warn('[GoogleDriveProvider] getProfileUserInfo failed:', e);
          resolve('');
        }
      } else {
        resolve('');
      }
    });

    if (chromeEmail) return chromeEmail;

    // 2. Fallback: Request Google OAuth2 userinfo
    try {
      const token = await this.getToken(false);
      if (token) {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          return data.email || '';
        }
      }
    } catch {
      // Ignore errors, return empty string
    }

    return '';
  }

  async downloadBackup(fileId: string): Promise<unknown> {
    const url = `${DRIVE_API}/files/${fileId}?alt=media`;
    const response = await this.driveRequest(url, { method: 'GET' });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to download Drive backup (${response.status}): ${errText}`);
    }

    return response.json();
  }

  async deleteBackup(fileId: string): Promise<boolean> {
    const url = `${DRIVE_API}/files/${fileId}`;
    const response = await this.driveRequest(url, { method: 'DELETE' });

    if (response.status === 204 || response.ok) {
      return true;
    }

    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to delete Drive backup (${response.status}): ${errText}`);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _driveProvider: GoogleDriveProvider | null = null;

export function getGoogleDriveProvider(): GoogleDriveProvider {
  if (!_driveProvider) {
    _driveProvider = new GoogleDriveProvider();
  }
  return _driveProvider;
}
