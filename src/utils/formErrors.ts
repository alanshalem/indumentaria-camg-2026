import type { ZodError } from 'zod';
import { ApiError } from '@/services/apiError';

/** Errores por campo, con la misma forma que devuelve la API. */
export type FieldErrors = Record<string, string>;

/**
 * Traduce los `issues` de zod a un mapa `campo -> mensaje`.
 *
 * Estaba copiado en el checkout y en el alta de productos. La clave `_` junta
 * los errores que no pertenecen a ningún campo (los `refine` a nivel objeto),
 * para poder mostrarlos como error general del formulario.
 */
export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Los errores por campo que trae un fallo de la API, o vacío si no es de la API. */
export const fieldErrorsFromApi = (caught: unknown): FieldErrors =>
  caught instanceof ApiError ? caught.fields : {};
