import { CommandModule } from '../types';
import { handleFolderSelectionForCreate } from '../utils/selectionLogic';

export const CreateLinkCommand: CommandModule = {
  id: 'createlinks',
  label: 'Create Smart Links',
  prefix: '/createlinks',
  keywords: ['create link', 'new link', 'link', 'links', 'save link', 'saved link'],
  behavior: 'instant',

  execute: context => {
    
    const { services } = context;

    // Handle folder/workspace selection logic
    handleFolderSelectionForCreate(context);

    // Navigate to link editor
    services.navigation({
      kind: 'linkEditor',
      linkProps: {
        onClose: () => services.navigation({ kind: 'searchSuggestions' }),
      },
    });
  },
};
