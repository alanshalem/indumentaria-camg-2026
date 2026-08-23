import type { OrderPage } from '../../shared/api/contracts.js';
import type { Order, OrderStatus } from '../../shared/domain/order.js';
import type { OrderFilters } from '../../shared/schemas/order.schema.js';
import { ORDERS_PAGE_SIZE } from '../../shared/schemas/order.schema.js';
import { notFound } from '../http/errors.js';
import { toOrder, type OrderRow } from './mappers.js';
import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'orders';
const COLUMNS =
  'code,customer_name,customer_last_name,phone,email,items,subtotal,promotions,total,status,created_at';
export type { OrderPage };

export interface OrderRepository {
  list(filters?: OrderFilters): Promise<OrderPage>;
  findByCode(code: string): Promise<Order | null>;
  create(order: Order): Promise<Order>;
  updateStatus(code: string, status: OrderStatus): Promise<Order>;
}

/** `%` y `_` son comodines en ILIKE: hay que neutralizarlos antes de interpolar. */
const escapeLike = (value: string): string => value.replace(/[%_\\]/g, (char) => `\\${char}`);

export const orderRepository: OrderRepository = {
  async list(filters = {}) {
    // `count: 'exact'` lo resuelve Postgres en la misma consulta: el panel
    // necesita saber cuántos hay para poder paginar sin traerlos todos.
    let query = getSupabase().from(TABLE).select(COLUMNS, { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);
    if (filters.search) {
      const term = `%${escapeLike(filters.search)}%`;
      query = query.or(
        `code.ilike.${term},customer_name.ilike.${term},customer_last_name.ilike.${term},phone.ilike.${term}`,
      );
    }

    const limit = Number(filters.limit ?? ORDERS_PAGE_SIZE);
    const offset = Number(filters.offset ?? 0);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw toHttpError(error, 'orders.list');

    return {
      orders: (data as unknown as OrderRow[]).map(toOrder),
      total: count ?? 0,
    };
  },

  async findByCode(code) {
    const { data, error } = await getSupabase().from(TABLE).select(COLUMNS).eq('code', code).maybeSingle();
    if (error) throw toHttpError(error, 'orders.findByCode');
    return data ? toOrder(data as unknown as OrderRow) : null;
  },

  async create(order) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .insert({
        code: order.code,
        customer_name: order.customerName,
        customer_last_name: order.customerLastName,
        phone: order.phone,
        email: order.email,
        items: order.items,
        subtotal: order.subtotal,
        promotions: order.promotions,
        total: order.total,
        status: order.status,
      })
      .select(COLUMNS)
      .single();
    if (error) throw toHttpError(error, 'orders.create');
    return toOrder(data as unknown as OrderRow);
  },

  async updateStatus(code, status) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({ status })
      .eq('code', code)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw toHttpError(error, 'orders.updateStatus');
    if (!data) throw notFound(`No existe el pedido ${code}.`);
    return toOrder(data as unknown as OrderRow);
  },
};
