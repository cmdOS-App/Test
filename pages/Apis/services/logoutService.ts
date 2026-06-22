/**
 * logoutService.ts
 *
 * Public entry point for signing the user out.
 *
 * Architecture:
 *   UI (HeaderControls)
 *    ↓
 *   revokeRemoteSession()        ← this file (public API)
 *    ↓
 *   @private-providers/LogoutProvider
 *    ↓ (private build)           ↓ (OSS build)
 *   LogoutProvider.ts            private-mocks/LogoutProvider.ts
 *   → calls remote sign_out endpoint   → returns null (no-op)
 */

import { revokeClerkSession as _revokeClerkSession } from '@private-providers/LogoutProvider';

/**
 * Revokes the remote Clerk session for the given userId.
 * - Private build: calls the configured sign-out endpoint.
 * - OSS build:     no-op, returns null immediately.
 */
export async function revokeRemoteSession(userId: string): Promise<null> {
  await _revokeClerkSession(userId);
  return null;
}
