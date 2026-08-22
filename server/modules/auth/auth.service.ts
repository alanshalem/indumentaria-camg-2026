import { getConfig } from '../../config/env';
import { unauthorized } from '../../http/errors';
import { loginRateLimiter } from '../../security/rateLimit';
import { ADMIN_SUBJECT } from '../../security/adminGuard';
import { createToken, safeEquals } from '../../security/token';
import type { LoginResponse } from '../../../shared/api/contracts';

/**
 * La clave vive sólo en el entorno del servidor. Antes se comparaba en el
 * browser contra `import.meta.env.VITE_ADMIN_PASSWORD`, con lo cual viajaba
 * dentro del bundle: cualquiera podía leerla. Acá no sale nunca del server.
 */
export function login(password: string, ip: string): LoginResponse {
  loginRateLimiter.consume(ip);

  const { adminPassword, tokenSecret, sessionTtlMs } = getConfig();
  if (!safeEquals(password, adminPassword)) {
    throw unauthorized('Clave incorrecta.');
  }

  loginRateLimiter.reset(ip);

  const now = Date.now();
  const expiresAt = now + sessionTtlMs;
  return {
    token: createToken({ sub: ADMIN_SUBJECT, iat: now, exp: expiresAt }, tokenSecret),
    expiresAt,
  };
}
