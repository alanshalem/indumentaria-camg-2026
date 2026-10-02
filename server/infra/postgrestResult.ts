import type { PostgrestError } from '@supabase/supabase-js';
import { notFound } from '../http/errors.js';
import { toHttpError } from './postgrestError.js';

/**
 * El final de toda consulta a Supabase, escrito una sola vez.
 *
 * Los seis repositorios repetían la misma secuencia treinta veces: chequear
 * `error`, traducirlo con `toHttpError`, castear la fila y mapearla. Lo que esa
 * repetición escondía eran quince `as unknown as` sueltos, cada uno un lugar
 * donde el compilador dejaba de mirar. El bug de `payment_method` fue
 * exactamente eso: una lista de columnas que el tipo no revisaba.
 *
 * El cast en sí es inevitable mientras no haya tipos generados de la base: el
 * builder de PostgREST infiere su tipo del string de columnas y no coincide con
 * nuestras filas. Lo que sí se puede es tomar `data` como `unknown` —que es lo
 * que honestamente es desde acá— y necesitar entonces un solo `as`, nombrado y
 * en un archivo que se revisa, en vez de un `as unknown as` por llamada.
 */
interface QueryResult {
  data: unknown;
  error: PostgrestError | null;
}

/** Las filas de una consulta de listado. Sin resultados devuelve `[]`. */
export function rowsOf<Row>(result: QueryResult, operation: string): Row[] {
  if (result.error) throw toHttpError(result.error, operation);
  return (result.data ?? []) as Row[];
}

/** La fila de un `maybeSingle()` que puede legítimamente no existir. */
export function maybeRowOf<Row>(result: QueryResult, operation: string): Row | null {
  if (result.error) throw toHttpError(result.error, operation);
  return (result.data ?? null) as Row | null;
}

/**
 * La fila que la operación necesita que exista: si no está, es un 404 con el
 * mensaje que el repositorio sabe escribir ("No existe el pedido CAMG-…").
 */
export function rowOf<Row>(result: QueryResult, operation: string, missing: string): Row {
  const row = maybeRowOf<Row>(result, operation);
  if (!row) throw notFound(missing);
  return row;
}
