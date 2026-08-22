import { ROUTES } from '../../../shared/api/contracts';
import { loginSchema } from '../../../shared/schemas/auth.schema';
import { Router } from '../../http/router';
import { ok } from '../../http/responses';
import { parseOrThrow } from '../../http/validate';
import { requireAdminSession } from '../../security/adminGuard';
import { login } from './auth.service';

export const authRoutes = new Router()
  .post(ROUTES.auth.login, (request) => {
    const { password } = parseOrThrow(loginSchema, request.body, 'No se pudo iniciar sesión');
    return ok(login(password, request.ip));
  })
  .get(ROUTES.auth.session, (request) => {
    const { exp } = requireAdminSession(request);
    return ok({ authenticated: true, expiresAt: exp });
  });
