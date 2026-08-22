import type { PostgrestError } from '@supabase/supabase-js';
import { conflict, internalError, notFound, type HttpError } from '../http/errors.js';

const UNIQUE_VIOLATION = '23505';
const NO_ROWS = 'PGRST116';

/**
 * Traduce errores de PostgREST a errores HTTP del dominio. Los detalles crudos
 * quedan en el log del servidor; al cliente le llega un mensaje accionable.
 */
export function toHttpError(error: PostgrestError, context: string): HttpError {
  console.error(`[db] ${context}:`, error.code, error.message, error.details);

  if (error.code === UNIQUE_VIOLATION) return conflict('Ya existe un registro con ese identificador.');
  if (error.code === NO_ROWS) return notFound('No se encontró el registro solicitado.');
  return internalError('No se pudo completar la operación en la base de datos.');
}
