/** Códigos de error del contrato HTTP. El cliente decide UX según el código, no según el texto. */
export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
  'NETWORK_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Errores por campo, para pintarlos junto al input que los produjo. */
  fields?: Record<string, string>;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

export interface ApiDataEnvelope<T> {
  data: T;
}

export type ApiEnvelope<T> = ApiDataEnvelope<T> | ApiErrorEnvelope;

export const isErrorEnvelope = <T>(value: ApiEnvelope<T>): value is ApiErrorEnvelope =>
  typeof value === 'object' && value !== null && 'error' in value;
