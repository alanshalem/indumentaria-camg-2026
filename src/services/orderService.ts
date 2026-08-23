import { ROUTES, type OrderStatusUpdate } from '@shared/api/contracts';
import type { CreateOrderInput, Order, OrderStatus, PublicOrder } from '@shared/domain/order';
import type { OrderQueryDto } from '@shared/schemas/order.schema';
import { httpClient } from './httpClient';

export const orderService = {
  /** Sólo admin. Los filtros se resuelven en el servidor, no en memoria. */
  list: (filters: OrderQueryDto = {}) =>
    httpClient.get<Order[]>(ROUTES.orders.collection, {
      query: {
        status: filters.status,
        search: filters.search,
        from: filters.from,
        to: filters.to,
      },
    }),

  create: (input: CreateOrderInput) => httpClient.post<Order>(ROUTES.orders.collection, input),

  /**
   * Seguimiento público. La autorización es el token firmado que viajó en el
   * mail, no una sesión: por eso es el único GET de pedidos sin login.
   */
  getPublic: (code: string, token: string) =>
    httpClient.get<PublicOrder>(ROUTES.orders.byCode(code), { query: { t: token } }),

  /** Devuelve el pedido y qué aviso salió: el panel necesita poder decirlo. */
  updateStatus: (code: string, status: OrderStatus) =>
    httpClient.patch<OrderStatusUpdate>(ROUTES.orders.byCode(code), { status }),
};
