import { useCallback, useEffect, useState } from 'react';

const SESSION_KEY = 'camg_admin';

export function useAuth() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    setIsAuthed(sessionStorage.getItem(SESSION_KEY) === 'true');
  }, []);

  const login = useCallback((password) => {
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || 'camg2026';
    if (password === expected) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthed(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthed(false);
  }, []);

  return { isAuthed, login, logout };
}
