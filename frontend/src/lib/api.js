import axios from 'axios';
import { clearSession, loadSession } from './session';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// FastAPI login and current-user endpoints.
export const LOGIN_PATH = '/api/v1/auth/login';
export const ME_PATH = '/api/v1/auth/me';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { Accept: 'application/json' },
});

// Adds "Authorization: Bearer <token>" to every request when someone is logged in.
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = loadSession()?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the server rejects a saved token, log out everywhere.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes(LOGIN_PATH);
    if (error.response?.status === 401 && !isLoginRequest && loadSession()) {
      clearSession();
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// Turns an axios error into a message a person can read.
export function errorMessage(error) {
  if (error.code === 'ERR_NETWORK') {
    return 'Could not reach the API Gateway. Confirm the backend services are running.';
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (status === 401) return 'Invalid email or password.';
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
    if (typeof data.message === 'string') return data.message;
  }
  if (status) return `Request failed (HTTP ${status}).`;
  return error.message || 'Something went wrong.';
}

export default api;