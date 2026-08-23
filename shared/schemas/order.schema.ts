import { z } from 'zod';
import { ORDER_STATUSES } from '../domain/order.js';
import { ORDER_CODE_PATTERN } from '../domain/orderCode.js';
import { isValidPhone, normalizePhone } from '../domain/phone.js';

export const MAX_UNITS_PER_LINE = 50;
export const MAX_LINES_PER_ORDER = 40;

/** El mensaje del tipo base cubre el caso "no vino el campo". */
const personName = (what: string) =>
  z
    .string(`Ingresá ${what}`)
    .trim()
    .min(2, 'Ingresá al menos 2 caracteres')
    .max(60, 'Máximo 60 caracteres');

/**
 * El teléfono se guarda normalizado a dígitos: así se puede buscar y armar el
 * link de WhatsApp sin importar cómo lo haya tipeado el socio.
 */
const phoneSchema = z
  .string('Ingresá un teléfono de contacto')
  .trim()
  .min(1, 'Ingresá un teléfono de contacto')
  .max(30)
  .refine(isValidPhone, 'Ingresá un teléfono válido (ej: 11 2345-6789)')
  .transform(normalizePhone);

/**
 * El email es obligatorio: es el canal por el que el socio recibe el código,
 * los datos de pago y el aviso de que puede retirar. Se normaliza ANTES de
 * validar — pegar un mail con un espacio al final es lo más común del mundo.
 */
const emailSchema = z
  .string('Ingresá tu email')
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email('Ingresá un email válido').max(120));

export const orderItemInputSchema = z.object({
  productId: z.string().trim().min(1),
  size: z.string().trim().min(1).max(16),
  color: z.string().trim().max(30).nullish().default(null),
  quantity: z.number().int().min(1).max(MAX_UNITS_PER_LINE),
});

export const createOrderSchema = z.object({
  customerName: personName('el nombre'),
  customerLastName: personName('el apellido'),
  phone: phoneSchema,
  email: emailSchema,
  items: z
    .array(orderItemInputSchema, 'Falta el detalle del pedido')
    .min(1, 'El carrito está vacío')
    .max(MAX_LINES_PER_ORDER),
});

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const updateOrderSchema = z.object({
  status: orderStatusSchema,
});

export const orderCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ORDER_CODE_PATTERN, 'Código de pedido inválido');

export const orderQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  search: z.string().trim().max(80).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type OrderQueryDto = z.infer<typeof orderQuerySchema>;
