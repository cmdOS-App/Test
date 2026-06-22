export interface SubscriptionRecord {
  id: string;
  organization_id?: string;
  org_id?: string;
  credits_left: number;
  plan_id: string;
  is_admin: boolean;
  stripe_user_id?: string | null;
  status?: string;
  created_time?: string;
}

export const getCreditBalance = async (_userId: string, _orgId?: string) => {
  return { credits: 99999, credits_left: 99999, success: true };
};

export const recordCreditUsage = async (_userId: string, _orgId?: string) => {
  return;
};

export const getActiveSubscriptions = async (_userId: string, _orgId?: string): Promise<SubscriptionRecord[]> => {
  return [];
};

export const getOrgUserDetail = async (_orgId: string, _userId: string): Promise<any> => {
  return null;
};

export const getMembersInOrganization = async (_orgId: string): Promise<any> => {
  return [];
};

export const removeMemberFromOrganization = async (_orgId: string, _userId: string): Promise<any> => {
  return { success: true };
};

export const getUsageData = async (_userId: string, _year: number, _month: number): Promise<any> => {
  return { success: true, data: [] };
};
