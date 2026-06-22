/**
 * oauthConfig.ts
 *
 * Centralized Google OAuth configuration for TaskLabs backup.
 *
 * The Client ID is injected into the manifest at build time from VITE_GOOGLE_CLIENT_ID in .env.
 * chrome.identity.getAuthToken() reads the client_id directly from the manifest — no need
 * to reference it here at runtime.
 *
 * This file only holds the storage key constants used by the Drive provider.
 */

/** Storage key used to persist the access token in chrome.storage.local (legacy — no longer used with getAuthToken) */
export const GDRIVE_TOKEN_KEY = 'gdrive_access_token';

/** Storage key for token expiry epoch (ms) (legacy — no longer used with getAuthToken) */
export const GDRIVE_TOKEN_EXPIRY_KEY = 'gdrive_token_expiry';
