import type { Folder, Snippet, Workspace } from '../../modals/interfaces';

export interface ItemProps {
  userId: string;
  snippet: Snippet;
  workspace: Workspace | null;
  folder: Folder | null;
  reload: () => void;
  selectedItem: string | null;
  selectedTeamId: string;
  favoritesMapping: {
    [teamId: string]: Snippet[];
  };
  setFavoritesMapping: (data: { [teamId: string]: Snippet[] }) => void;
  isWorkspaceLevel?: boolean;
  index: number;
  moveSnippet: (fromIndex: number, toIndex: number) => void;
  snippetList: Snippet[];
}
