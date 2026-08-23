import { ROUTES, type OrderCreated, type OrderPage, type OrderStatusUpdate } from '@shared/api/contracts';
import type { CreateOrderInput, OrderStatus, PublicOrder } from '@shared/domain/order';
import type { OrderFilters } from '@shared/schemas/order.schema';
import type { EmailLogRecord } from '@shared/domain/orderEmails';
import { httpClient } from './httpClient';

export const orderService = {
  /** Sólo admin. Los filtros se resuelven en el servidor, no en memoria. */
  list: (filters: OrderFilters = {}) =>
    httpClient.get<OrderPage>(ROUTES.orders.collection, {
      query: {
        status: filters.status,
        search: filters.search,
        from: filters.from,
        to: filters.to,
        limit: filters.limit === undefined ? undefined : String(filters.limit),
        offset: filters.offset === undefined ? undefined : String(filters.offset),
      },
    }),

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
  /** Sólo admin. Qué avisos recibió el socio y cuándo. */
  emailHistory: (code: string) =>
    httpClient.get<EmailLogRecord[]>(ROUTES.orders.emails(code)),

  updateStatus: (code: string, status: OrderStatus) =>
    httpClient.patch<OrderStatusUpdate>(ROUTES.orders.byCode(code), { status }),
};
