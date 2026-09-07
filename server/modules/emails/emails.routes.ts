import { z } from 'zod';
import { ROUTES } from '../../../shared/api/contracts.js';
import { EMAIL_KINDS, statusForEmailKind } from '../../../shared/domain/orderEmails.js';
import { orderCodeSchema } from '../../../shared/schemas/order.schema.js';
import { Router } from '../../http/router.js';
import { ok } from '../../http/responses.js';
import { parseOrThrow } from '../../http/validate.js';
import { adminOnly } from '../../security/adminGuard.js';
import { emailsService } from './emails.service.js';

const previewQuerySchema = z.object({
  kind: z.enum(EMAIL_KINDS),
  /** Sin código se usa el pedido de ejemplo. */
  code: orderCodeSchema.optional(),
});

export const emailRoutes = new Router().get(
  ROUTES.emails.preview,
  adminOnly(async (request) => {
    const { kind, code } = parseOrThrow(
      previewQuerySchema,
      request.query,
      'No se pudo preparar la vista previa',
    );

    // El estado que dispara ese aviso: así el ejemplo se ve como el pedido
    // estaría cuando el mail sale de verdad.
    const status = statusForEmailKind(kind) ?? 'pending';

    return ok(await emailsService.preview(kind, status, code));
  }),
);
