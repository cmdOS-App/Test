import axios from 'axios';
import { SUPABASE_BASE_URL, SUPABASE_TOKEN } from './apiConfig';
export { SUPABASE_BASE_URL, SUPABASE_TOKEN };


export const axiosInstance = axios.create({
  baseURL: `${SUPABASE_BASE_URL}/functions/v1`,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_TOKEN}`, // Add the Bearer token here
  },
  responseType: 'json', // Default response type
  maxContentLength: 50 * 1024 * 1024, // 50MB for larger files if needed
  maxBodyLength: 50 * 1024 * 1024,
});

axiosInstance.interceptors.request.use(
  config => {
    // If the request is sending FormData (typically for file uploads), set Content-Type to multipart/form-data
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
    }

    return config;
  },
  error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // Enhanced error handling for debugging, particularly for network issues
    if (!error.response) {
      console.error('Network Error:', error.message);
    } else {
      console.error('Response Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
        config: error.config,
      });
    }
    return Promise.reject(error);
  },
);
