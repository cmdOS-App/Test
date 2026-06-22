import { axiosInstance } from '../core/axiosInstance';
import { bgGet, bgRequest, isContentScriptContext } from '../core/bgFetch';
import { getUserId } from '../core/api';
import { incrementUserRefreshCounter } from '@private-services/userRefreshCounterService';

//Get All the User Data
export const getCommands = async () => {
  const path = `features/commands`;
  if (isContentScriptContext()) {
    return await bgGet(path);
  }
  const response = await axiosInstance.get(path);
  return response.data;
};

// Install a command for a user
export interface AddCommandRequest {
  user_id: string;
  command_id: string;
  prefix: string;
  keywords: string[];
}

export interface AddCommandResponse {
  data: {
    installation_id: number;
    user_id: string;
    command_id: string;
    prefix: string;
    keywords: string[];
    created_at: string;
    updated_at: string;
    command: {
      id: string;
      label: string;
      prefix: string;
      url_template: string;
      icon_host: string;
      auto_submit: string;
      keywords: string[];
      category: string;
      created_at: string;
      updated_at: string;
    };
  };
}

export const addCommand = async (
  commandId: string,
  prefix: string,
  keywords: string[],
): Promise<AddCommandResponse> => {
  const userId = await getUserId();
  const path = `features/commands/user`;
  const payload: AddCommandRequest = {
    user_id: userId,
    command_id: commandId,
    prefix,
    keywords,
  };

  let result: AddCommandResponse;
  if (isContentScriptContext()) {
    result = await bgRequest<AddCommandResponse>({ path, method: 'POST', body: payload });
  } else {
    const response = await axiosInstance.post(path, payload);
    result = response.data;
  }

  // Increment user counter so other devices know a new command was installed (fire-and-forget)
  incrementUserRefreshCounter().catch(() => {});

  return result;
};
