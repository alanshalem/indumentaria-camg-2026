import type { ApiErrorBody, ApiErrorCode } from '../../shared/api/errors';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
  NETWORK_ERROR: 503,
};

/**
 * Único tipo de error que el borde HTTP sabe traducir. Todo lo demás que
 * escape de un servicio se convierte en 500 sin filtrar detalles internos.
 */
export class HttpError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = fields;
  }

  toBody(): ApiErrorBody {
    return { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}) };
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError('BAD_REQUEST', message, fields);
export const validationError = (message: string, fields?: Record<string, string>) =>
  new HttpError('VALIDATION_ERROR', message, fields);
export const unauthorized = (message = 'Sesión inválida o expirada.') =>
  new HttpError('UNAUTHORIZED', message);
export const notFound = (message = 'Recurso no encontrado.') => new HttpError('NOT_FOUND', message);
export const conflict = (message: string) => new HttpError('CONFLICT', message);
export const tooManyRequests = (message: string) => new HttpError('TOO_MANY_REQUESTS', message);
export const payloadTooLarge = (message: string) => new HttpError('PAYLOAD_TOO_LARGE', message);
export const internalError = (message = 'Error interno del servidor.') =>
  new HttpError('INTERNAL_ERROR', message);

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;
