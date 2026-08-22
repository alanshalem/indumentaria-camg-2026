import type { ZodType } from 'zod';
import { validationError } from './errors';

/**
 * Adaptador zod → HttpError. Centralizarlo acá evita repetir el mapeo de
 * `issues` a `fields` en cada controlador (DRY) y garantiza que todos los
 * errores de validación viajen con la misma forma.
 */
export function parseOrThrow<T>(schema: ZodType<T>, payload: unknown, what = 'Datos inválidos'): T {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  const first = result.error.issues[0]?.message;
  throw validationError(first ? `${what}: ${first}` : what, fields);
}
