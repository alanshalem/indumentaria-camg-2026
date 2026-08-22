import { ROUTES } from '@shared/api/contracts';
import type { CreateOrderInput, Order, OrderStatus } from '@shared/domain/order';
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

  updateStatus: (code: string, status: OrderStatus) =>
    httpClient.patch<Order>(ROUTES.orders.byCode(code), { status }),
};
