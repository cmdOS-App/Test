/**
 * migrationService.ts
 *
 * Entry point for Local → Cloud org migration.
 *
 * Architecture:
 *   UI
 *    ↓
 *   migrateOrganizationToCloud()   ← orchestrator
 *    ↓
 *   buildMigrationPayload()        ← reads local storage, builds payload tree
 *    ↓
 *   API calls                      ← cloud create calls (org / workspace / folder / snippet / automation)
 *    ↓
 *   Verification                   ← confirm cloud round-trip, update migrationStatus
 */

import type { Team, Workspace, Folder, Snippet, SavedAutomation } from '../../modals/interfaces';
import {
  migrateOrganizationToCloud as privateMigrateToCloud,
  migrateOrganizationToLocal as privateMigrateToLocal,
} from '@private-providers/MigrationProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationFolder {
  folder: Folder;
  /** ID of the workspace this folder belongs to */
  workspaceId: string;
  /** ID of the parent folder (null = top-level folder in workspace) */
  parentFolderId: string | null;
}

export interface MigrationSnippet {
  snippet: Snippet;
  /** ID of the workspace this snippet belongs to (set when not inside a folder) */
  workspaceId: string | null;
  /** ID of the folder this snippet belongs to (null = workspace-level snippet) */
  folderId: string | null;
}

export interface MigrationAutomation {
  automation: SavedAutomation;
  /** ID of the workspace this automation belongs to */
  workspaceId: string | null;
  /** ID of the folder this automation belongs to (null = workspace-level) */
  folderId: string | null;
}

export interface MigrationPayload {
  /** The local org being migrated */
  organization: Team;
  /** All workspaces in this org */
  workspaces: Workspace[];
  /** All folders (across all workspaces), flattened with location context */
  folders: MigrationFolder[];
  /** All snippets (workspace-level + folder-level), flattened with location context */
  snippets: MigrationSnippet[];
  /** All automations (workspace-level + folder-level), flattened with location context */
  automations: MigrationAutomation[];
}

export interface MigrationResult {
  success: true;
  payload: MigrationPayload;
}

export type MigrationValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

// ---------------------------------------------------------------------------
// Wrapper Functions delegating to conditional providers
// ---------------------------------------------------------------------------

export async function migrateOrganizationToCloud(organizationId: string): Promise<MigrationResult> {
  return privateMigrateToCloud(organizationId);
}

export async function migrateOrganizationToLocal(organizationId: string): Promise<MigrationResult> {
  return privateMigrateToLocal(organizationId);
}
