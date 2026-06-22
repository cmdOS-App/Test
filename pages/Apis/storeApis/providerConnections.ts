import { axiosInstance } from../core/axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from../core/bgFetch';
import { SUPABASE_BASE_URL } from../core/apiConfig';

export const connectWithGoogle = async (installation_id: number) => {
  const path = `/cmdstore/oauth/google/auth-url?installation_id=${installation_id}&redirect_uri=${SUPABASE_BASE_URL}/functions/v1/cmdstore/oauth/google/callback`;
  if (isContentScriptContext()) {
    return await bgGet(path);
  }
  const response = await axiosInstance.get(path);
  return response.data;
};

export const revokeGoogleConnection = async (installation_id: number) => {
  const path = `/cmdstore/oauth/google/revoke?installation_id=${installation_id}`;
  if (isContentScriptContext()) {
    return await bgGet(path);
  }
  const response = await axiosInstance.get(path);
  return response.data;
};
