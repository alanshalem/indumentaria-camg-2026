import { ROUTES } from '../../../shared/api/contracts';
import {
  createOrderSchema,
  orderCodeSchema,
  orderQuerySchema,
  updateOrderSchema,
} from '../../../shared/schemas/order.schema';
import { Router } from '../../http/router';
import { created, ok } from '../../http/responses';
import { parseOrThrow } from '../../http/validate';
import { adminOnly } from '../../security/adminGuard';
import { ordersService } from './orders.service';

export const orderRoutes = new Router()
  .get(
    ROUTES.orders.collection,
    adminOnly(async (request) => {
      const filters = parseOrThrow(orderQuerySchema, request.query, 'Filtros inválidos');
      return ok(await ordersService.list(filters));
    }),
  )
  // Público: es el checkout del socio. El servidor pone precios y código.
  .post(ROUTES.orders.collection, async (request) => {
    const input = parseOrThrow(createOrderSchema, request.body, 'No se pudo generar el pedido');
    return created(await ordersService.create(input));
  })
  .patch(
    ROUTES.orders.pattern,
    adminOnly(async (request) => {
      const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
      const { status } = parseOrThrow(updateOrderSchema, request.body, 'Estado inválido');
      return ok(await ordersService.updateStatus(code, status));
    }),
  );
