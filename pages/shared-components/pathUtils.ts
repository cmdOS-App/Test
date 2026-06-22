import type { Folder, Team, Workspace } from '../../../modals/interfaces';

/**
 * Formats the full path for a save destination.
 *
 * Format:
 * - Personal Space: Personal Space/Folder/Subfolder
 * - Org Private: OrgName/Private/Folder/Subfolder
 * - Org Shared: OrgName/Shared/WorkspaceName/Folder/Subfolder
 *
 * @param allTeams - All teams from Redux to search for workspace
 * @param workspaceId - The workspace ID
 * @param folderId - The folder ID (optional)
 * @param folderPathNames - Pre-computed folder path names array (optional, used when available from picker)
 */
export type WorkspaceIconType = 'lock' | 'globe' | 'users' | 'personal';

export interface PathDetails {
  iconType: WorkspaceIconType;
  pathText: string;
}

/**
 * Formats the full path details for a save destination.
 */
export const getDestinationPathDetails = (
  allTeams: Team[] | null,
  workspaceId: string | null,
  folderId: string | null,
  folderPathNames?: string[] | null,
  workspaceType?: string,
): PathDetails => {
  if (!workspaceId) return { iconType: 'lock', pathText: 'Select Destination' };

  // Find the workspace and its parent team
  const result = findWorkspaceInTeams(allTeams, workspaceId);
  if (!result) return { iconType: 'lock', pathText: 'Select Destination' };

  const { workspace, team } = result;
  const isPersonalSpace = team.is_personal_space === true || team.team_name === 'Personal Space';

  // Determine security icon and base path
  let iconType: WorkspaceIconType = 'lock';
  let basePath = '';

  if (isPersonalSpace) {
    iconType = 'lock';
    basePath = 'Personal Space';
  } else {
    const orgName = team.team_name || 'Organization';
    // Use same type inference logic as SideBar.tsx: check is_shared/is_public flags if type is undefined
    const wsType =
      workspaceType ||
      (workspace as any).type ||
      ((workspace as any).is_shared ? 'shareonly' : (workspace as any).is_public ? 'public' : 'private');

    if (wsType === 'private') {
      iconType = 'lock';
      basePath = `${orgName} /Private`;
    } else if (wsType === 'shareonly') {
      iconType = 'users'; // Shared Only
      basePath = `${orgName} /Shared Only`;
    } else if (wsType === 'public') {
      iconType = 'globe';
      basePath = `${orgName} /Public`;
    } else if (wsType === 'shared') {
      iconType = 'users';
      basePath = `${orgName} /Shared`;
    } else {
      // Final fallback to Private
      iconType = 'lock';
      basePath = `${orgName} /Private`;
    }
  }

  // Construct full path string
  let fullPath = `${basePath} /${workspace.workspace_name}`;

  // If no folder selected, just return workspace path
  if (!folderId && (!folderPathNames || folderPathNames.length === 0)) {
    return { iconType, pathText: fullPath };
  }

  // Use provided folderPathNames if available (from picker via breadcrumb)
  if (folderPathNames && folderPathNames.length > 0) {
    folderPathNames.forEach(name => {
      fullPath += ` /${name}`;
    });
    return { iconType, pathText: fullPath };
  }

  // Fallback: try to find folder path in workspace folders (for legacy/direct access)
  if (folderId) {
    const folderPath = findFolderPath(workspace.folders || [], folderId);
    if (folderPath && folderPath.length > 0) {
      folderPath.forEach(f => {
        fullPath += ` /${f.folder_name}`;
      });
      return { iconType, pathText: fullPath };
    }
  }

  return { iconType, pathText: fullPath };
};

/**
 * Legacy wrapper for backward compatibility (returns just text now, emojis stripped).
 * @deprecated Use getDestinationPathDetails for structured data including icon type.
 */
export const formatSaveDestinationPath = (
  allTeams: Team[] | null,
  workspaceId: string | null,
  folderId: string | null,
  folderPathNames?: string[] | null,
  workspaceType?: string,
): string => {
  const { pathText } = getDestinationPathDetails(allTeams, workspaceId, folderId, folderPathNames, workspaceType);
  return pathText;
};

/**
 * Finds a workspace across all teams by workspace ID.
 */
export const findWorkspaceInTeams = (
  allTeams: Team[] | null,
  workspaceId: string,
): { workspace: Workspace; team: Team } | null => {
  if (!allTeams || !workspaceId) return null;
  for (const team of allTeams) {
    const ws = (team.workspaces || []).find(w => w.workspace_id === workspaceId);
    if (ws) {
      return { workspace: ws, team };
    }
  }
  return null;
};

/**
 * Recursively searches for a folder path within a workspace's folder structure.
 * Returns an array of folders starting from the root-most folder down to the target folder.
 */
export const findFolderPath = (folders: Folder[], targetFolderId: string): Folder[] | null => {
  for (const folder of folders) {
    if (folder.folder_id === targetFolderId) {
      return [folder];
    }
    if (folder.folders && folder.folders.length > 0) {
      const path = findFolderPath(folder.folders, targetFolderId);
      if (path) {
        return [folder, ...path];
      }
    }
  }
  return null;
};
