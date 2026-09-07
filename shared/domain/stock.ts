/**
 * Stock físico por variante.
 *
 * La variante es la misma tripleta que ya identifica una línea del carrito y
 * del pedido: producto + talle + color. Para los productos sin colores es
 * literalmente "una fila por talle"; para la remera y las medias, que sí los
 * tienen, es la única clave que se corresponde con una prenda real: descontar
 * una remera roja del contador de las blancas dejaría el inventario mintiendo.
 *
 * Regla del club: el stock nunca bloquea una venta. Cuando llega a cero la
 * compra sigue habilitada y pasa a modalidad "a pedido", con el plazo a la
 * vista. Al ingresar mercadería el descuento vuelve a ser normal solo.
 */

/** Lo que el club dice tener de una variante. */
export interface StockLevel {
  size: string;
  /** `null` en productos sin variantes de color. */
  color: string | null;
  units: number;
}

/** Plazo que se le promete al socio cuando la prenda sale a pedido. */
export const ON_DEMAND_LEAD_TIME = 'de 10 a 15 días';

export const ON_DEMAND_NOTICE = `Disponible a pedido. Entrega estimada ${ON_DEMAND_LEAD_TIME}.`;

/** Misma variante: el color ausente y el vacío son lo mismo. */
export const sameVariant = (
  a: Pick<StockLevel, 'size' | 'color'>,
  b: Pick<StockLevel, 'size' | 'color'>,
): boolean => a.size === b.size && (a.color ?? '') === (b.color ?? '');

/**
 * Unidades de una variante, o `null` si el club todavía no cargó stock para
 * ella.
 *
 * `null` y `0` son cosas distintas a propósito: "no sé cuánto tengo" no es
 * "no tengo". Sin esta distinción, activar el inventario habría puesto todo el
 * catálogo en "a pedido" de golpe, antes de que el club cargara una sola
 * unidad. Una variante sin fila simplemente no participa del sistema.
 */
export function unitsFor(
  stock: readonly StockLevel[],
  size: string,
  color: string | null,
): number | null {
  return stock.find((level) => sameVariant(level, { size, color }))?.units ?? null;
}

/** `true` sólo cuando el club cargó stock y se agotó. */
export const isOnDemand = (
  stock: readonly StockLevel[],
  size: string,
  color: string | null,
): boolean => unitsFor(stock, size, color) === 0;

/** Cuántas unidades de un pedido saldrían a pedido, sin tocar la base. */
export const backorderOf = (available: number | null, requested: number): number =>
  available === null ? 0 : Math.max(0, requested - available);
