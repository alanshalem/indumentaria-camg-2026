import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Guard de ruta. Es sólo cosmético —evita mostrar una pantalla sin datos—:
 * la protección real la aplica el servidor en cada endpoint, así que forzar
 * esta ruta desde el browser no revela absolutamente nada.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
