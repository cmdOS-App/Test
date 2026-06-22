import { CommandModule } from '../types';
import { CMDOS_PROFILE_URL } from '../../../../Apis/core/apiConfig';

export const ProfileCommand: CommandModule = {
  id: 'profile',
  label: 'Profile',
  prefix: '/profile',
  keywords: ['profile', 'account', 'user', 'settings', 'me'],
  behavior: 'instant',
  url: CMDOS_PROFILE_URL,

  execute: () => {
    // Registry handles URL opening
  },
};
