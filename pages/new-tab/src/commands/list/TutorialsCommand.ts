import { CommandModule } from '../types';
import { CMDOS_DOCS_URL } from '../../../../Apis/core/apiConfig';

export const TutorialsCommand: CommandModule = {
  id: 'tutorials',
  label: 'Tutorials',
  prefix: '/tutorials',
  keywords: [],
  behavior: 'instant',
  url: CMDOS_DOCS_URL,

  execute: () => {
    // Registry handles URL opening
  },
};
