/**
 * Global feature flags for compiling public vs. private builds.
 */
export const FEATURE_FLAGS = {
  // Defaults to true (private mode) unless explicitly disabled via environment variable
  ENABLE_SHARING: (import.meta as any).env?.VITE_ENABLE_SHARING !== 'false',

  // Google Drive Backup — disabled by default; set VITE_ENABLE_GOOGLE_DRIVE_BACKUP=true in .env to enable
  ENABLE_GOOGLE_DRIVE_BACKUP: (import.meta as any).env?.VITE_ENABLE_GOOGLE_DRIVE_BACKUP === 'true',
};
