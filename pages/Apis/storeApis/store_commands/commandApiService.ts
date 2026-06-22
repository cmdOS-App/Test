import { axiosInstance } from../../core/axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from../../core/bgFetch';

export const getSheets = async (installation_id: number) => {
  const path = `cmdstore/google/drive/spreadsheets?installation_id=${installation_id}`;
  if (isContentScriptContext()) {
    return await bgGet(path);
  }
  const response = await axiosInstance.get(path);
  return response.data;
};
