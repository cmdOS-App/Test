import { CommandModule } from '../types';
import { handleFolderSelectionForCreate } from '../utils/selectionLogic';

export const CreateNoteCommand: CommandModule = {
  id: 'createnotes',
  label: 'Create Notes',
  prefix: '/createnotes',
  keywords: ['create note', 'new note', 'note', 'notes', 'add note', 'save note'],
  behavior: 'instant',

  execute: context => {
    
    const { services } = context;

    // Handle folder/workspace selection logic
    handleFolderSelectionForCreate(context);

    // Navigate to note editor
    services.navigation({
      kind: 'noteEditor',
      noteProps: {
        category: 'note', // Corrected to 'note'
        onClose: () => services.navigation({ kind: 'searchSuggestions' }),
      },
    });
  },
};
