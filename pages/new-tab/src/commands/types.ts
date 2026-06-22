import type { AppDispatch, RootState } from '../../../Redux/store';
import React from 'react';
import type { Workspace, Folder, Snippet } from '../../../modals/interfaces';

export type SearchPopupView =
  | { kind: 'searchSuggestions' }
  | { kind: 'noteEditor'; noteProps?: { onClose: () => void; category?: string } }
  | {
      kind: 'linkEditor';
      linkProps?: {
        onClose: () => void;
        mode?: 'create' | 'edit';
        initialSnippet?: Snippet | null;
        initialWorkspace?: Workspace | null;
        initialFolder?: Folder | null;
        lockLocation?: boolean;
      };
    }
  | { kind: 'agentPanel'; agentProps?: { onClose: () => void } }
  | { kind: 'automationPanel'; automationProps?: { onClose: () => void } }
  | { kind: 'routineEditor'; routineProps?: { onClose: () => void } }
  | { kind: 'blank'; title?: string; message?: string }
  | { kind: 'custom'; element: React.ReactNode | (() => React.ReactNode) }
  | { kind: 'workspaceContent'; workspace: Workspace; folder: Folder | null }
  | { kind: 'store' }
  | { kind: 'moduleDetail'; moduleId: number }
  | { kind: 'commandList'; category?: string }
  | { kind: 'templatesView' }
  | { kind: 'folderEditor'; folderProps?: { onClose: () => void; reload?: () => void } }
  | { kind: 'profile'; profileProps?: { onClose: () => void } }
  | { kind: 'organization'; organizationProps: { orgId: string; orgName: string; onClose?: () => void } }
  | {
      kind: 'createOrganization';
      createOrgProps?: { onClose?: () => void; onSuccess?: (orgId: string, orgName: string) => void };
    }
  | { kind: 'bulk' }
  | { kind: 'promptEditor'; promptProps?: { onClose: () => void } }
  | { kind: 'allItems'; itemType: 'notes' | 'links' | 'prompts' | 'bookmarks' | 'organizations'; onClose?: () => void };

// Context passed to every command so it can interact with the app
export interface CommandContext {
  dispatch: AppDispatch;
  state: RootState;
  previouslySelectedFolder?: Folder | null;
  services: {
    toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    navigation: (view: SearchPopupView) => void;
    reload: () => void;
  };
  prompt?: string;
  files?: { base64: string; filename: string }[];
}

// Arguments for entity commands (when user selects a workspace/snippet/etc)
export interface EntitySelection {
  workspace?: Workspace;
  folder?: Folder | null;
  snippet?: Snippet;
}

export type CommandBehavior = 'instant' | 'entity' | 'locked';
export type CommandScope = 'workspace' | 'folder' | 'snippet' | 'bookmark';
export type CommandAction = 'rename' | 'delete' | 'create' | 'edit';

// The Universal Command Interface
export interface CommandModule {
  // === Metadata ===
  id: string; // Unique identifier (e.g., 'createnotes')
  label: string; // Display name (e.g., 'Create Notes')
  prefix: string; // Command prefix (e.g., '/createnotes')
  keywords: string[]; // Search keywords (e.g., ['note', 'create'])
  description?: string; // Optional description for tooltips
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>; // Optional custom icon

  // === Behavior Configuration ===
  behavior: CommandBehavior;
  scope?: CommandScope; // For entity commands
  action?: CommandAction; // For entity commands

  // === Optional URL (for simple instant commands that just open a link) ===
  url?: string;

  // === The Execution Logic ===
  // This is where the magic happens - all logic in one place!
  execute: (context: CommandContext, entity?: EntitySelection) => void | Promise<void>;

  // === Optional: Custom validation or pre-execution hooks ===
  canExecute?: (context: CommandContext, entity?: EntitySelection) => boolean;
  onBeforeExecute?: (context: CommandContext) => void | Promise<void>;

  // === Optional: Dynamic Label ===
  getDynamicLabel?: (context: CommandContext) => string;

  // === Optional Context Checks & Filtering ===
  showInDashboard?: boolean; // Set to false to exclude from standard dashboard listing
  category?: 'thissite_action' | string; // Optional category grouping
  isAvailable?: (webContext?: any) => boolean; // Determines if command should be shown based on webpage/active tab context
}

