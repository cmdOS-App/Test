import { CommandContext } from '../types';
import {
  setSelectedWorkspace,
  setSelectedFolder,
  setSnippetBreadCrum,
  setIsCreatingNewItem,
} from '../../../../Redux/AllData/uiStateSlice';
import { Folder, Workspace } from '../../../../modals/interfaces';

export const handleFolderSelectionForCreate = (context: CommandContext) => {
  const { dispatch, state, previouslySelectedFolder } = context;
  const selectedTeam = state.uiState.selectedTeam;
  const selectedFolder = state.uiState.selectedFolder;
  const selectedWorkspace = state.uiState.selectedWorkspace;

  

  // Check if there's a previously selected folder (before popup cleared it)
  const folderToUse = selectedFolder || previouslySelectedFolder;

  if (folderToUse && selectedTeam) {
    // Use the previously selected folder
    const workspace =
      selectedWorkspace ||
      selectedTeam.workspaces?.find((ws: Workspace) =>
        ws.folders?.some((f: Folder) => f.folder_id === folderToUse.folder_id),
      );

    if (workspace) {
      dispatch(setSelectedWorkspace(workspace));
      dispatch(setSelectedFolder(folderToUse));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          folder_id: folderToUse.folder_id,
          folder_name: folderToUse.folder_name,
        }),
      );
      dispatch(setIsCreatingNewItem(true));
    }
  } else if (!folderToUse && selectedTeam) {
    // No previously selected folder - find and set the first folder (for new users)
    const firstWorkspaceWithFolders = selectedTeam.workspaces?.find(
      (ws: Workspace) => ws.folders && ws.folders.length > 0,
    );

    if (
      firstWorkspaceWithFolders &&
      firstWorkspaceWithFolders.folders &&
      firstWorkspaceWithFolders.folders.length > 0
    ) {
      const firstFolder = firstWorkspaceWithFolders.folders[0];
      dispatch(setSelectedWorkspace(firstWorkspaceWithFolders));
      dispatch(setSelectedFolder(firstFolder));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: firstWorkspaceWithFolders.workspace_id,
          workspace_name: firstWorkspaceWithFolders.workspace_name,
          folder_id: firstFolder.folder_id,
          folder_name: firstFolder.folder_name,
        }),
      );
      dispatch(setIsCreatingNewItem(true));
    } else if (selectedWorkspace) {
      // If there's a selected workspace but no folders, use the workspace
      dispatch(setSelectedFolder(null));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: selectedWorkspace.workspace_id,
          workspace_name: selectedWorkspace.workspace_name,
          folder_id: null,
          folder_name: null,
        }),
      );
      dispatch(setIsCreatingNewItem(true));
    } else if (selectedTeam.workspaces && selectedTeam.workspaces.length > 0) {
      // Use the first workspace if no workspace is selected
      const firstWorkspace = selectedTeam.workspaces[0];
      dispatch(setSelectedWorkspace(firstWorkspace));
      dispatch(setSelectedFolder(null));
      dispatch(
        setSnippetBreadCrum({
          workspace_id: firstWorkspace.workspace_id,
          workspace_name: firstWorkspace.workspace_name,
          folder_id: null,
          folder_name: null,
        }),
      );
      dispatch(setIsCreatingNewItem(true));
    }
  }
};
