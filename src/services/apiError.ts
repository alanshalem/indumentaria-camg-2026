import type { ApiErrorBody, ApiErrorCode } from '@shared/api/errors';

/**
 * Error tipado que atraviesa toda la app cliente. Cualquier fallo —de red, de
 * validación o del servidor— llega como ApiError, así la UI tiene un único
 * camino de manejo en vez de `catch` ad-hoc por componente.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.fields = body.fields ?? {};
  }

  static network(): ApiError {
    return new ApiError(
      { code: 'NETWORK_ERROR', message: 'No hay conexión con el servidor. Reintentá en unos segundos.' },
      0,
    );
  }

  get isAuthProblem(): boolean {
    return this.code === 'UNAUTHORIZED' || this.code === 'FORBIDDEN';
  }
}

/** Normaliza cualquier `unknown` de un catch a un mensaje mostrable. */
export const errorMessage = (error: unknown, fallback = 'Ocurrió un error inesperado.'): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};
