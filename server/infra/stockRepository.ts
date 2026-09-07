import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

/** Lo que se pide descontar de una variante. */
export interface StockRequest {
  productId: string;
  size: string;
  color: string | null;
  quantity: number;
}

/** Qué se pudo tomar del stock y qué queda a pedido. */
export interface StockOutcome extends StockRequest {
  /** Unidades que salieron del stock físico. */
  taken: number;
  /** Unidades que no había: salen a pedido, con plazo. */
  backorder: number;
  /** `false` cuando esa variante no tiene stock cargado y queda fuera del sistema. */
  tracked: boolean;
}

export interface StockRepository {
  /**
   * Descuenta lo que haya y devuelve el resultado línea por línea.
   * Nunca falla por falta de stock: eso es una decisión de negocio, no un error.
   */
  consume(items: readonly StockRequest[]): Promise<StockOutcome[]>;
}

export const stockRepository: StockRepository = {
  async consume(items) {
    if (items.length === 0) return [];

    // Una función de Postgres y no una serie de updates desde acá: corre en una
    // sola transacción y bloquea cada fila, así dos socios que compran la
    // última unidad al mismo tiempo no la descuentan los dos.
    const { data, error } = await getSupabase().rpc('consume_stock', {
      p_items: items.map((item) => ({
        productId: item.productId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
      })),
    });

    if (error) throw toHttpError(error, 'stock.consume');
    return (data ?? []) as StockOutcome[];
  },
};
