import {
  ROUTES,
  type OrderCreated,
  type OrderPage,
  type OrderStatusUpdate,
  type OrderTotals,
} from '@shared/api/contracts';
import type { CreateOrderInput, Order, OrderStatus, PublicOrder } from '@shared/domain/order';
import { EXPORT_PAGE_SIZE, type OrderFilters } from '@shared/schemas/order.schema';
import type { EmailLogRecord } from '@shared/domain/orderEmails';
import { httpClient } from './httpClient';

/** Los filtros como query string. El servidor completa los que falten. */
const toQuery = (filters: OrderFilters) => ({
  status: filters.status,
  search: filters.search,
  from: filters.from,
  to: filters.to,
  limit: filters.limit === undefined ? undefined : String(filters.limit),
  offset: filters.offset === undefined ? undefined : String(filters.offset),
});

export const orderService = {
  /** Sólo admin. Los filtros se resuelven en el servidor, no en memoria. */
  list: (filters: OrderFilters = {}) =>
    httpClient.get<OrderPage>(ROUTES.orders.collection, { query: toQuery(filters) }),

  /** Devuelve el pedido y el token del link de seguimiento. */
  create: (input: CreateOrderInput) =>
    httpClient.post<OrderCreated>(ROUTES.orders.collection, input),

  /**
   * Seguimiento público. La autorización es el token firmado que viajó en el
   * mail, no una sesión: por eso es el único GET de pedidos sin login.
   */
  getPublic: (code: string, token: string) =>
    httpClient.get<PublicOrder>(ROUTES.orders.byCode(code), { query: { t: token } }),

  /** Devuelve el pedido y qué aviso salió: el panel necesita poder decirlo. */
  /**
   * Totales del filtro completo. Van aparte del listado: sumar la página
   * visible daba el total de 50 pedidos, no el del recorte.
   */
  summary: (filters: OrderFilters = {}) =>
    httpClient.get<OrderTotals>(ROUTES.orders.summary, { query: toQuery(filters) }),

  /**
   * Todos los pedidos del filtro, paginando de a `EXPORT_PAGE_SIZE`.
   * Lo usa el Excel: exportar sólo la página visible dejaba afuera el resto.
   */
  async listAll(filters: OrderFilters = {}): Promise<Order[]> {
    const all: Order[] = [];

    for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
      const page = await orderService.list({ ...filters, limit: EXPORT_PAGE_SIZE, offset });
      all.push(...page.orders);

      if (all.length >= page.total || page.orders.length === 0) return all;
    }
  },

  /** Sólo admin. Qué avisos recibió el socio y cuándo. */
  emailHistory: (code: string) =>
    httpClient.get<EmailLogRecord[]>(ROUTES.orders.emails(code)),

  updateStatus: (code: string, status: OrderStatus) =>
    httpClient.patch<OrderStatusUpdate>(ROUTES.orders.byCode(code), { status }),
};
