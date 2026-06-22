export const SUPABASE_TOKEN =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  '';

export const SUPABASE_BASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  '';


// Section A — cmdos.app constants
export const CMD_DOMAIN = 'cmdos.app';
export const CMD_BASE_URL = `https://www.${CMD_DOMAIN}`;
export const CMD_URL = `https://${CMD_DOMAIN}`;

// Named URL path constants
export const CMDOS_WORKSPACE_URL = `${CMD_BASE_URL}/api/workspaces`;
export const CMDOS_USER_WORKSPACE_URL = `${CMD_BASE_URL}/api/userWorkspaceMapping`;
export const CMDOS_SIGN_OUT_URL = `${CMD_BASE_URL}/api/sign_out`;
export const CMDOS_CLERK_INVITE_URL = `${CMD_BASE_URL}/api/clerk/invite_user`;
export const CMDOS_REDIRECT_URL = `${CMD_BASE_URL}/`;

// Function-based dynamic URL path constants (matching exact behaviors)
export const CMDOS_ORG_MEMBERS_URL = (orgId: string) => `${CMD_URL}/api/organizations/${orgId}/members`;
export const CMDOS_ORG_USER_DETAIL_URL = (orgId: string, userId: string) => `${CMD_URL}/api/user_org/${orgId}/${userId}`;
export const CMDOS_GET_USAGE_URL = (userId: string, year: number, month: number) =>
  `${CMD_URL}/api/get_usage?userId=${encodeURIComponent(userId)}&year=${year}&month=${month}`;

// Function-based dynamic URL path constants specifically using cmdos.app with www vs non-www
// workspaceApiServices.ts L105 uses cmdos.app/api/organizations/${org_id}/members (non-www)
export const CMDOS_ORG_MEMBERS_URL_WITHOUT_WWW = (orgId: string) => `https://${CMD_DOMAIN}/api/organizations/${orgId}/members`;

// General user-facing UI routes
export const CMDOS_SIGN_UP_URL = `${CMD_BASE_URL}/sign-up`;
export const CMDOS_SIGN_IN_URL = `${CMD_BASE_URL}/sign-in`;
export const CMDOS_DOCS_URL = `${CMD_BASE_URL}/docs`;
export const CMDOS_DOCS_FOLDERS_URL = `${CMD_BASE_URL}/docs/folders`;
export const CMDOS_CONTACT_URL = `${CMD_URL}/contact`;
export const CMDOS_PRICING_URL = `${CMD_BASE_URL}/pricing`;
export const CMDOS_DASHBOARD_URL = `${CMD_BASE_URL}/dashboard`;
export const CMDOS_PROFILE_URL = `${CMD_BASE_URL}/dashboard/profile`;
export const CMDOS_INSTALL_URL = `${CMD_BASE_URL}/install`;
export const CMDOS_SUBSCRIPTION_URL = `${CMD_URL}/subscription`;

export const isSharingEnabled = (): boolean => {
  const envSharing = typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_ENABLE_SHARING;
  const metaSharing = (import.meta as any).env?.VITE_ENABLE_SHARING;
  return envSharing !== 'false' && metaSharing !== 'false';
};


