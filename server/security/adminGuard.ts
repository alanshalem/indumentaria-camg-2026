import { getConfig } from '../config/env';
import { unauthorized } from '../http/errors';
import type { ApiRequest, ApiResponse, RouteHandler } from '../http/types';
import { verifyToken, type TokenPayload } from './token';

export const ADMIN_SUBJECT = 'admin';

export function readBearerToken(request: ApiRequest): string | null {
  const header = request.headers['authorization'] ?? '';
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

export function requireAdminSession(request: ApiRequest): TokenPayload {
  const token = readBearerToken(request);
  if (!token) throw unauthorized('Falta el token de administrador.');

  const payload = verifyToken(token, getConfig().tokenSecret);
  if (payload.sub !== ADMIN_SUBJECT) throw unauthorized('Token sin permisos de administrador.');
  return payload;
}

/**
 * Decorator de handler: envuelve una ruta y garantiza sesión admin antes de
 * ejecutarla. Ninguna ruta protegida puede olvidarse del chequeo porque el
 * guard es parte de su declaración en la tabla de rutas.
 */
export const adminOnly =
  (handler: RouteHandler): RouteHandler =>
  (request: ApiRequest): Promise<ApiResponse> | ApiResponse => {
    requireAdminSession(request);
    return handler(request);
  };

/** Para rutas de lectura mixta: informa si quien pide es admin, sin bloquear. */
export function isAdminRequest(request: ApiRequest): boolean {
  try {
    requireAdminSession(request);
    return true;
  } catch {
    return false;
  }
}
