import { CommandModule } from '../types';
import { CMDOS_DASHBOARD_URL } from '../../../../Apis/core/apiConfig';

export const DashboardCommand: CommandModule = {
  id: 'dashboard',
  label: 'Dashboard',
  prefix: '/dashboard',
  keywords: [],
  behavior: 'instant',
  url: CMDOS_DASHBOARD_URL,

  execute: () => {
    // Registry handles URL opening
  },
};
