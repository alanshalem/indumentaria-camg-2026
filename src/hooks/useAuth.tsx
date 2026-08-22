import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '@/services/authService';
import { httpClient } from '@/services/httpClient';

const STORAGE_KEY = 'camg_admin_session';

interface StoredSession {
  token: string;
  expiresAt: number;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    return session.token && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
};

/**
 * La sesión vive a nivel de módulo, no dentro de un efecto de React.
 *
 * Si el token se publicara desde un `useEffect`, los componentes hijos podrían
 * disparar su primer request ANTES de que el cliente HTTP tenga con qué
 * autenticarse: los efectos de los hijos corren primero. Leyéndola acá, el
 * token ya está disponible desde el primer render.
 */
let activeSession: StoredSession | null = readStoredSession();
let handleSessionLost: () => void = () => {};

const persist = (session: StoredSession | null): void => {
  activeSession = session;
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
};

httpClient.configure({
  getToken: () => activeSession?.token ?? null,
  onUnauthorized: () => handleSessionLost(),
});

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Fuente única de la sesión admin.
 *
 * El modelo anterior guardaba `camg_admin=true` en sessionStorage y comparaba
 * la clave en el browser: bastaba escribir esa línea en la consola para entrar.
 * Ahora la sesión es un JWT firmado por el servidor; el estado local sólo decide
 * qué se dibuja, y cada endpoint protegido revalida la firma por su cuenta.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(activeSession);

  const logout = useCallback(() => {
    persist(null);
    setSession(null);
  }, []);

  // Un 401 de cualquier request cierra la sesión y devuelve al login.
  useEffect(() => {
    handleSessionLost = logout;
    return () => {
      handleSessionLost = () => {};
    };
  }, [logout]);

  // Cierre automático al expirar: el usuario ve el login en vez de errores 401.
  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [session, logout]);

  const login = useCallback(async (password: string) => {
    const { token, expiresAt } = await authService.login(password);
    persist({ token, expiresAt });
    setSession({ token, expiresAt });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated: session !== null, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
