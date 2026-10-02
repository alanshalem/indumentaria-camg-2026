import { ROUTES } from '../../../shared/api/contracts.js';
import { loginSchema } from '../../../shared/schemas/auth.schema.js';
import { Router } from '../../http/router.js';
import { ok } from '../../http/responses.js';
import { parseOrThrow } from '../../http/validate.js';
import { requireAdminSession } from '../../security/adminGuard.js';
import { login } from './auth.service.js';

/** Rutas de sesión. `signIn` entra por parámetro para poder testear el 401. */
export const makeAuthRoutes = (signIn: typeof login = login): Router =>
  new Router()
    .post(ROUTES.auth.login, (request) => {
      const { password } = parseOrThrow(loginSchema, request.body, 'No se pudo iniciar sesión');
      return ok(signIn(password, request.ip));
    })
    .get(ROUTES.auth.session, (request) => {
      const { exp } = requireAdminSession(request);
      return ok({ authenticated: true, expiresAt: exp });
    });

export const authRoutes = makeAuthRoutes();
