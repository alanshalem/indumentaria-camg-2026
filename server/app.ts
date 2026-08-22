import { ConfigError } from './config/env.js';
import { HttpError, internalError, isHttpError } from './http/errors.js';
import { Router } from './http/router.js';
import type { ApiRequest, ApiResponse } from './http/types.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { orderRoutes } from './modules/orders/orders.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { promotionRoutes } from './modules/promotions/promotions.routes.js';
import { uploadRoutes } from './modules/uploads/uploads.routes.js';

/** Tabla de rutas de la API. Cada módulo declara las suyas; acá sólo se montan. */
export const apiRouter = new Router()
  .use('/', authRoutes)
  .use('/', productRoutes)
  .use('/', promotionRoutes)
  .use('/', orderRoutes)
  .use('/', uploadRoutes);

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/**
 * Punto de entrada único del backend. Convierte cualquier excepción en una
 * respuesta con el mismo sobre `{ error: { code, message, fields } }`, así el
 * cliente tiene un solo camino de manejo de errores.
 */
export async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
  try {
    const response = await apiRouter.handle(request);
    return {
      ...response,
      headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...response.headers },
    };
  } catch (error) {
    return toErrorResponse(error, request);
  }
}

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
