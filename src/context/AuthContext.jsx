import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');

  async function refreshSession() {
    setStatus('checking');

    try {
      const payload = await apiRequest('/api/auth/me');
      setUser(payload?.data?.user || null);
      setAccess(payload?.data?.access || null);
      setError('');
      setStatus('authenticated');
      return true;
    } catch (sessionError) {
      setUser(null);
      setAccess(null);

      if (sessionError instanceof ApiError && sessionError.status === 401) {
        setError('');
        setStatus('anonymous');
        return false;
      }

      setError(sessionError instanceof Error ? sessionError.message : 'Unable to reach the Pioneer API.');
      setStatus('anonymous');
      return false;
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function login(email, password) {
    setError('');

    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    try {
      const payload = await apiRequest('/api/auth/me');
      setUser(payload?.data?.user || null);
      setAccess(payload?.data?.access || null);
      setError('');
      setStatus('authenticated');
    } catch (sessionError) {
      setUser(null);
      setAccess(null);
      setStatus('anonymous');

      const message =
        sessionError instanceof ApiError && sessionError.status === 401
          ? 'Your credentials were accepted, but the browser did not retain the admin session. Check cross-site cookie settings for the Render API.'
          : sessionError instanceof Error
            ? sessionError.message
            : 'The admin session could not be established.';

      setError(message);
      throw new Error(message);
    }
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setAccess(null);
      setError('');
      setStatus('anonymous');
    }
  }

  const value = useMemo(
    () => ({ status, user, access, error, login, logout, refreshSession }),
    [status, user, access, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
