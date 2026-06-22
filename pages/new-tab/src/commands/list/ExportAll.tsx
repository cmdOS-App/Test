import { CommandModule } from '../types';
import { exportAllTeamsToExcel } from '../../utils/exportUtils';
import { Team } from '../../../../modals/interfaces';

/**
 * ExportAll Command - Exports all links, notes, and prompts to a downloadable Excel file
 */
export const ExportAllCommand: CommandModule = {
  id: 'export_all',
  label: 'Export All',
  prefix: '/export',
  keywords: ['export', 'download', 'excel', 'xlsx', 'backup', 'all', 'notes', 'links', 'prompts', 'data'],
  description: 'Export all links, notes, and prompts to an Excel file',
  behavior: 'instant',

  execute: async context => {
    const { services, state } = context;

    try {
      // Show loading message
      services.toast('Preparing export...', 'info');

      // Get the all teams from Redux state
      const allTeams = (state as any).all?.data as Team[];

      if (!allTeams || allTeams.length === 0) {
        // Fallback to selectedTeam if all.data is not seeded
        const selectedTeam = state.uiState?.selectedTeam;
        if (!selectedTeam) {
          services.toast('No data found to export.', 'error');
          return;
        }

        services.toast('Exporting selected organization...', 'info');
        exportAllTeamsToExcel([selectedTeam]);
      } else {
        services.toast(`Exporting ${allTeams.length} organizations...`, 'info');
        exportAllTeamsToExcel(allTeams);
      }

      services.toast('Export complete!', 'success');
    } catch (error) {
      console.error('[ExportAllCommand] Error:', error);
      services.toast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  },
};

export default ExportAllCommand;
