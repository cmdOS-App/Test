import { CommandModule } from '../types';
import { FaLayerGroup } from 'react-icons/fa';

export const StoreCommand: CommandModule = {
  id: 'store',
  label: 'Automation Store',
  prefix: '/store',
  description: 'Browse and install automation modules by category.',
  keywords: [
    'store',
    'app store',
    'module store',
    'apps',
    'app',
    'connect app',
    'connect',
    'integration',
    'integrations',
    'marketplace',
  ],
  behavior: 'locked',
  icon: FaLayerGroup,

  execute: () => {
    // Logic moved to search-integrated store view
  },
};
