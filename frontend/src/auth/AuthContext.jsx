import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { errorMessage, LOGIN_PATH, ME_PATH } from '../lib/api';
import { clearSession, loadSession, saveSession } from '../lib/session';

const AuthContext = createContext(null);

// "VENDOR", "ROLE_VENDOR" or "vendor" -> "Vendor"
function formatRole(role) {
  if (!role) return '';
  const text = String(role).replace(/^ROLE_/i, '').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toUser(raw) {
  return {
    name: raw.name ?? raw.fullName ?? raw.full_name ?? raw.email,
    email: raw.email ?? '',
    role: formatRole(raw.role ?? raw.roles?.[0]),
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  // The axios client fires this when the server rejects the token.
  useEffect(() => {
    const onLogout = () => setSession(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      // FastAPI's OAuth2 login expects form data with the field "username".
      const { data } = await api.post(
        LOGIN_PATH,
        new URLSearchParams({ username: email, password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const token = data?.accessToken ?? data?.access_token ?? data?.token;
      if (!token) throw new Error('The server did not return a login token.');

      const rawUser =
        data.user ??
        (await api.get(ME_PATH, { headers: { Authorization: `Bearer ${token}` } })).data;

      const next = { token, user: toUser(rawUser) };
      saveSession(next);
      setSession(next);
      return next.user;
    } catch (error) {
      throw new Error(error.isAxiosError ? errorMessage(error) : error.message);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session),
      login,
      logout,
    }),
    [session, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}