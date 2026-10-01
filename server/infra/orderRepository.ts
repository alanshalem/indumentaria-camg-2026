import type { OrderPage, OrderTotals } from '../../shared/api/contracts.js';
import {
  countsForBilling,
  isOpenOrder,
  type Order,
  type OrderStatus,
} from '../../shared/domain/order.js';
import type { PaymentMethod } from '../../shared/domain/payment.js';
import { ORDERS_PAGE_SIZE, type OrderFilters } from '../../shared/schemas/order.schema.js';
import { notFound } from '../http/errors.js';
import { toOrder, type OrderRow } from './mappers.js';
import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'orders';
const COLUMNS =
  'code,customer_name,customer_last_name,phone,email,items,subtotal,promotions,total,status,payment_method,payment_link,created_at';

export interface OrderRepository {
  list(filters?: OrderFilters): Promise<OrderPage>;
  /** Totales sobre todo el filtro, no sobre una página. */
  summary(filters?: OrderFilters): Promise<OrderTotals>;
  findByCode(code: string): Promise<Order | null>;
  create(order: Order): Promise<Order>;
  updateStatus(code: string, status: OrderStatus): Promise<Order>;
  /** Marca o desmarca una línea como entregada. No toca el estado del pedido. */
  setItemDelivered(code: string, index: number, delivered: boolean): Promise<Order>;
  /** Registra cómo paga el socio y, si aplica, el link de cobro. */
  setPayment(code: string, payment: OrderPaymentInput): Promise<Order>;
}

/** Lo que el panel puede cambiar del pago. */
export interface OrderPaymentInput {
  method: PaymentMethod | null;
  link: string | null;
}

/** `%` y `_` son comodines en ILIKE: hay que neutralizarlos antes de interpolar. */
const escapeLike = (value: string): string => value.replace(/[%_\\]/g, (char) => `\\${char}`);

/**
 * Los filtros del panel, aplicados igual al listado y a los totales.
 *
 * Sin `status` explícito se excluyen los eliminados: "Todos" significa todos
 * los pedidos vivos. Para verlos hay que pedirlos por estado, así no ensucian
 * ninguna cuenta por omisión.
 *
 * El builder de PostgREST tiene un tipo distinto según qué columnas se
 * seleccionaron, y encadenarlo genéricamente hace explotar al compilador con
 * "type instantiation is excessively deep". Se estrecha a la única interfaz que
 * esta función usa y se devuelve el tipo original: el cast queda acá adentro y
 * los dos llamadores conservan su tipado.
 */
function applyFilters<Q>(query: Q, filters: OrderFilters): Q {
  let scoped = query as FilterableQuery;

  scoped = filters.status
    ? scoped.eq('status', filters.status)
    : scoped.neq('status', 'cancelled');

  if (filters.from) scoped = scoped.gte('created_at', filters.from);
  if (filters.to) scoped = scoped.lte('created_at', filters.to);

  if (filters.search) {
    const term = `%${escapeLike(filters.search)}%`;
    scoped = scoped.or(
      `code.ilike.${term},customer_name.ilike.${term},customer_last_name.ilike.${term},phone.ilike.${term}`,
    );
  }

  return scoped as Q;
}

/** Lo único que `applyFilters` necesita saber de un builder de PostgREST. */
interface FilterableQuery {
  eq(column: string, value: string): FilterableQuery;
  neq(column: string, value: string): FilterableQuery;
  gte(column: string, value: string): FilterableQuery;
  lte(column: string, value: string): FilterableQuery;
  or(filter: string): FilterableQuery;
}

/** Fila flaca para los totales: no hace falta traer los items. */
interface TotalsRow {
  subtotal: number;
  total: number;
  status: OrderStatus;
}

export const orderRepository: OrderRepository = {
  async list(filters = {}) {
    // `count: 'exact'` lo resuelve Postgres en la misma consulta: el panel
    // necesita saber cuántos hay para poder paginar sin traerlos todos.
    const query = applyFilters(getSupabase().from(TABLE).select(COLUMNS, { count: 'exact' }), filters);

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

  /**
   * El panel mostraba "total facturado" sumando sólo las 50 filas visibles: con
   * más de una página el número mentía. Se traen tres columnas de todas las
   * filas que matchean y se agrega acá, en vez de depender de los agregados de
   * PostgREST, que atan el código a una versión puntual del servidor.
   */
  async summary(filters = {}) {
    const { data, error } = await applyFilters(
      getSupabase().from(TABLE).select('subtotal,total,status'),
      filters,
    );

    if (error) throw toHttpError(error, 'orders.summary');

    // Doble red: el filtro ya excluye los eliminados salvo que se pidan
    // explícitamente, y acá tampoco suman aunque se los esté mirando.
    const rows = (data as unknown as TotalsRow[]).filter((row) => countsForBilling(row.status));

    return {
      revenue: rows.reduce((sum, row) => sum + row.total, 0),
      discounts: rows.reduce((sum, row) => sum + (row.subtotal - row.total), 0),
      open: rows.filter((row) => isOpenOrder(row.status)).length,
      counted: rows.length,
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

  async setItemDelivered(code, index, delivered) {
    const order = await orderRepository.findByCode(code);
    if (!order) throw notFound(`No existe el pedido ${code}.`);

    const item = order.items[index];
    if (!item) throw notFound(`El pedido ${code} no tiene una línea ${index}.`);

    // Los items son un snapshot JSON: se reescribe el array completo con la
    // línea cambiada. Nunca se reordenan, así que el índice es estable.
    const items = order.items.map((line, at) =>
      at === index ? { ...line, delivered } : line,
    );

    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({ items })
      .eq('code', code)
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw toHttpError(error, 'orders.setItemDelivered');
    if (!data) throw notFound(`No existe el pedido ${code}.`);
    return toOrder(data as unknown as OrderRow);
  },

  async setPayment(code, payment) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({ payment_method: payment.method, payment_link: payment.link })
      .eq('code', code)
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw toHttpError(error, 'orders.setPayment');
    if (!data) throw notFound(`No existe el pedido ${code}.`);
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
