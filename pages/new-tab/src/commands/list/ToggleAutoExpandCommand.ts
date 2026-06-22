import { setIsAutoExpandMode } from '../../../../Redux/AllData/uiStateSlice';
import { CommandModule } from '../types';

export const ToggleAutoExpandCommand: CommandModule = {
  id: 'toggle_auto_expand',
  label: 'Toggle Auto Expand Folders',
  prefix: '/autoexpand',
  keywords: ['toggle', 'expand', 'auto', 'folder'],
  behavior: 'instant',

  execute: context => {
    const current = context.state.uiState.isAutoExpandMode;
    const newValue = !current;

    context.dispatch(setIsAutoExpandMode(newValue));
    context.services.toast(`Auto Expand Folders is now ${newValue ? 'ON' : 'OFF'}.`, 'success');
  },
};
