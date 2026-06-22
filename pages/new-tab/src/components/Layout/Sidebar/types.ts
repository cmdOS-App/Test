import { Workspace, Team } from '../../../../../modals/interfaces';

export interface EnrichedWorkspace extends Workspace {
  type?: string;
  admin_user_id?: string;
}

export interface WorkspaceOptionsPopupProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  workspace: Workspace;
  reload: () => void;
  onOpenShare: (workspace: Workspace) => void;
  onOpenEdit: (workspace: Workspace) => void;
  onOpenDelete: (workspace: Workspace) => void;
  onOpenCreateSubFolder?: (workspace: Workspace) => void;
  onOpenCustomize: (workspace: Workspace) => void;
}

export interface OrgDropdownProps {
  selectedTeam: Team;
  teams: Team[];
  onOrgSelect: (orgId: string, orgName: string) => void;
  onOrgSwitch: (team: Team) => void;
  onCreateOrg: () => void;
}
