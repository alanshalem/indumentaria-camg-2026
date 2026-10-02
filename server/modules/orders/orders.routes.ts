import { ROUTES } from '../../../shared/api/contracts.js';
import {
  createOrderSchema,
  deliverItemSchema,
  orderCodeSchema,
  orderPaymentSchema,
  whatsappTemplateSchema,
  orderQuerySchema,
  updateOrderSchema,
} from '../../../shared/schemas/order.schema.js';
import { Router } from '../../http/router.js';
import { created, ok } from '../../http/responses.js';
import { parseOrThrow } from '../../http/validate.js';
import { adminOnly } from '../../security/adminGuard.js';
import { emailsService, type EmailsService } from '../emails/emails.service.js';
import { ordersService, type OrdersService } from './orders.service.js';

/** Rutas de pedidos. Los servicios entran por parámetro: ver `makeApiRouter`. */
export const makeOrderRoutes = (
  orders: OrdersService = ordersService,
  emails: EmailsService = emailsService,
): Router =>
  new Router()
    .get(
      ROUTES.orders.collection,
      adminOnly(async (request) => {
        const filters = parseOrThrow(orderQuerySchema, request.query, 'Filtros inválidos');
        return ok(await orders.list(filters));
      }),
    )
    // Totales del panel. Van aparte del listado porque se calculan sobre todo el
    // filtro y no sobre la página que se está mirando.
    .get(
      ROUTES.orders.summary,
      adminOnly(async (request) => {
        const filters = parseOrThrow(orderQuerySchema, request.query, 'Filtros inválidos');
        return ok(await orders.summary(filters));
      }),
    )
    // Control interno: marcar prendas entregadas de a una. No manda mails.
    .patch(
      ROUTES.orders.itemsPattern,
      adminOnly(async (request) => {
        const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
        const { index, delivered } = parseOrThrow(
          deliverItemSchema,
          request.body,
          'No se pudo marcar la prenda',
        );
        return ok(await orders.setItemDelivered(code, index, delivered));
      }),
    )
    .patch(
      ROUTES.orders.paymentPattern,
      adminOnly(async (request) => {
        const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
        const payment = parseOrThrow(orderPaymentSchema, request.body, 'No se pudo guardar el pago');
        return ok(await orders.setPayment(code, payment));
      }),
    )
    .get(
      ROUTES.orders.whatsappPattern,
      adminOnly(async (request) => {
        const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
        return ok(await orders.whatsappHistory(code));
      }),
    )
    .post(
      ROUTES.orders.whatsappPattern,
      adminOnly(async (request) => {
        const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
        const { template } = parseOrThrow(
          whatsappTemplateSchema,
          request.body,
          'Plantilla desconocida',
        );
        return ok(await orders.recordWhatsapp(code, template));
      }),
    )
    // Historial de avisos. Va antes de `/orders/:code` sólo por claridad: son
    // rutas de distinto largo y el router no las confunde.
    .get(
      ROUTES.orders.emailsPattern,
      adminOnly(async (request) => {
        const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
        return ok(await emails.history(code));
      }),
    )
    // Público con firma: el seguimiento del pedido que se linkea desde el mail.
    // No lleva `adminOnly` porque la autorización es el token, no una sesión.
    .get(ROUTES.orders.pattern, async (request) => {
      const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
      return ok(await orders.findPublic(code, request.query.t ?? ''));
    })
    // Público: es el checkout del socio. El servidor pone precios y código.
    .post(ROUTES.orders.collection, async (request) => {
      const input = parseOrThrow(createOrderSchema, request.body, 'No se pudo generar el pedido');
      return created(await orders.create(input));
    })
    .patch(
      ROUTES.orders.pattern,
      adminOnly(async (request) => {
        const code = parseOrThrow(orderCodeSchema, request.params.code, 'Código inválido');
        const { status } = parseOrThrow(updateOrderSchema, request.body, 'Estado inválido');
        return ok(await orders.updateStatus(code, status));
      }),
    );

export const orderRoutes = makeOrderRoutes();
