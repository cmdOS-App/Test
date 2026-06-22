import { SUPABASE_BASE_URL as BASE_URL, SUPABASE_TOKEN } from '../../../pages/Apis/core/apiConfig';

// Configuration for chrome-extension background script
export const CMD_DOMAIN = 'cmdos.app';
export const CMD_URL = `https://${CMD_DOMAIN}`;
export const CMDOS_INSTALL_URL = `https://www.${CMD_DOMAIN}/install`;

export const SUPABASE_BASE_URL = `${BASE_URL}/functions/v1`;
export const SUPABASE_ANON_TOKEN = SUPABASE_TOKEN;

