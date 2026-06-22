import { CommandModule } from '../types';
import { handleFolderSelectionForCreate } from '../utils/selectionLogic';

export const CreateSnippetCommand: CommandModule = {
  id: 'createsnippet',
  label: 'Create Snippet',
  prefix: '/createsnippet',
  keywords: ['create snippet', 'new snippet', 'snippet', 'snippets', 'add snippet', 'save snippet'],
  behavior: 'instant',

  execute: context => {
    
    const { services } = context;

    // Handle folder/workspace selection logic
    handleFolderSelectionForCreate(context);

    // Navigate to note editor with category snippet
    services.navigation({
      kind: 'noteEditor',
      noteProps: {
        category: 'snippet', // Corrected to 'snippet'
        onClose: () => services.navigation({ kind: 'searchSuggestions' }),
      },
    });
  },
};
