import { CommandModule } from '../types';

export const DeleteFolderCommand: CommandModule = {
  id: 'delete_folder',
  label: 'Delete Folder',
  prefix: '/delete_folder',
  keywords: ['delete', 'remove', 'trash', 'dlt', 'del', 'discard', 'folder', 'folder delete'],
  behavior: 'entity',
  scope: 'folder',
  action: 'delete',

  execute: (context, entity) => {
    // Placeholder for future implementation
    
  },
};
