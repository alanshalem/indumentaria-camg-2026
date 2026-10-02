import { ConfigError } from './config/env.js';
import { HttpError, internalError, isHttpError } from './http/errors.js';
import { Router } from './http/router.js';
import type { ApiRequest, ApiResponse } from './http/types.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { emailRoutes } from './modules/emails/emails.routes.js';
import { orderRoutes } from './modules/orders/orders.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { promotionRoutes } from './modules/promotions/promotions.routes.js';
import { uploadRoutes } from './modules/uploads/uploads.routes.js';

/**
 * Arma la tabla de rutas de la API. Cada módulo declara las suyas; acá sólo se
 * montan.
 *
 * Toma los routers por parámetro, y eso es lo único que hacía falta para cerrar
 * la costura de la inyección de dependencias. Antes llegaba al servicio y se
 * cortaba ahí: cada router importaba su singleton en el scope del módulo, así
 * que no existía forma de ejercitar un endpoint sin Supabase del otro lado.
 * El resultado medible era que la validación de los query params, `adminOnly`,
 * los códigos de estado, el matcheo de rutas y el sobre de error no tenían un
 * solo test —y es exactamente la capa donde se escapó el bug de
 * `payment_method`, con el dato de un socio real perdido—.
 *
 * Los valores por defecto son los de producción, así que `apiRouter` sigue
 * siendo el mismo objeto que antes y el adaptador de Vercel no se enteró.
 */
export const makeApiRouter = (
  routers: readonly Router[] = [
    authRoutes,
    productRoutes,
    promotionRoutes,
    orderRoutes,
    uploadRoutes,
    emailRoutes,
  ],
): Router => routers.reduce((api, routes) => api.use('/', routes), new Router());

export const apiRouter = makeApiRouter();

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/**
 * Punto de entrada único del backend. Convierte cualquier excepción en una
 * respuesta con el mismo sobre `{ error: { code, message, fields } }`, así el
 * cliente tiene un solo camino de manejo de errores.
 *
 * Es una fábrica por el mismo motivo que los routers: un test necesita este
 * borde —el que pone los headers y traduce los errores— corriendo sobre una
 * tabla de rutas armada con dobles.
 */
export function makeApiHandler(router: Router = apiRouter) {
  return async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
    try {
      const response = await router.handle(request);
      return {
        ...response,
        headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...response.headers },
      };
    } catch (error) {
      return toErrorResponse(error, request);
    }
  };
}

export const handleApiRequest = makeApiHandler();

function toErrorResponse(error: unknown, request: ApiRequest): ApiResponse {
  const httpError = normalize(error);

  if (httpError.status >= 500) {
    console.error(`[api] ${request.method} ${request.path} →`, error);
  }

  return {
    status: httpError.status,
    headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS },
    body: { error: httpError.toBody() },
  };
}

function normalize(error: unknown): HttpError {
  if (isHttpError(error)) return error;
  // La ConfigError sí se muestra: nombra variables faltantes, no valores.
  if (error instanceof ConfigError) return new HttpError('INTERNAL_ERROR', error.message);
  return internalError();
}
