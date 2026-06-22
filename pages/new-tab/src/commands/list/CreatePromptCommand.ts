import { CommandModule } from '../types';
import { handleFolderSelectionForCreate } from '../utils/selectionLogic';

export const CreatePromptCommand: CommandModule = {
  id: 'createprompt',
  label: 'Create Prompt',
  prefix: '/createprompt',
  keywords: ['create prompt', 'new prompt', 'prompt', 'prompts', 'add prompt', 'save prompt', 'ai prompt'],
  behavior: 'instant',
  description: 'Create a new prompt (plain text, no variables)',

  execute: context => {
    
    const { services } = context;

    // Handle folder/workspace selection logic
    handleFolderSelectionForCreate(context);

    // Navigate to prompt editor
    services.navigation({
      kind: 'promptEditor',
      promptProps: {
        onClose: () => services.navigation({ kind: 'searchSuggestions' }),
      },
    });
  },
};
