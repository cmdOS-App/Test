import { CommandModule } from '../types';
import { clearDraftAutomation } from '../../../../Redux/AllData/uiStateSlice';

export const AgentCommand: CommandModule = {
  id: 'agent',
  label: 'Create an Automation Agent',
  prefix: '/agent',
  keywords: ['agent', 'ai agent', 'assistant', 'ai assistant', 'automation'],
  behavior: 'instant',

  execute: context => {
    
    const { dispatch, services } = context;

    // Clear transient automation storage keys
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.remove(['automation_recording_state', 'automation_draft_steps_count']);
    }

    // Navigate to agent panel
    services.navigation({
      kind: 'agentPanel',
      agentProps: {
        onClose: () => services.navigation({ kind: 'searchSuggestions' }),
      },
    });
  },
};
