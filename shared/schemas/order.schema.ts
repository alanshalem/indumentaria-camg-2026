import { z } from 'zod';
import { ORDER_STATUSES } from '../domain/order.js';
import { ORDER_CODE_PATTERN } from '../domain/orderCode.js';
import { normalizeName } from '../domain/name.js';
import { PAYMENT_METHODS } from '../domain/payment.js';
import { WHATSAPP_TEMPLATES } from '../domain/whatsapp.js';
import { isValidPhone, normalizePhone } from '../domain/phone.js';

export const MAX_UNITS_PER_LINE = 50;
export const MAX_LINES_PER_ORDER = 40;

/**
 * El mensaje del tipo base cubre el caso "no vino el campo".
 *
 * Se normaliza DESPUÉS de validar el largo: el socio tipea "NATALIA BACCHETTO"
 * o "marianela fontana" y en la base queda "Natalia Bacchetto". Limpiarlo acá
 * y no en cada pantalla hace que el panel, el mail y el Excel lo hereden solos.
 */
const personName = (what: string) =>
  z
    .string(`Ingresá ${what}`)
    .trim()
    .min(2, 'Ingresá al menos 2 caracteres')
    .max(60, 'Máximo 60 caracteres')
    .transform(normalizeName);

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
  /**
   * Lo elige el socio y no el club: el admin no tiene cómo adivinar con qué va
   * a pagar. Después se puede corregir desde el panel si el socio se equivocó.
   */
  paymentMethod: z.enum(PAYMENT_METHODS, 'Elegí cómo vas a pagar'),
  items: z
    .array(orderItemInputSchema, 'Falta el detalle del pedido')
    .min(1, 'El carrito está vacío')
    .max(MAX_LINES_PER_ORDER),
});

export const orderStatusSchema = z.enum(ORDER_STATUSES);

/** Marcar una línea como entregada. Control interno: no manda ningún mail. */
export const deliverItemSchema = z.object({
  index: z.coerce.number().int().min(0).max(MAX_LINES_PER_ORDER),
  delivered: z.boolean(),
});

/**
 * El link de cobro se guarda tal como lo pega el club. Se valida que sea una
 * URL para no mandarle al socio un mensaje con basura adentro.
 */
export const orderPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS).nullable().default(null),
  link: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .default(null)
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      'El link tiene que empezar con http:// o https://',
    ),
});

export const whatsappTemplateSchema = z.object({
  template: z.enum(WHATSAPP_TEMPLATES),
});

export const updateOrderSchema = z.object({
  status: orderStatusSchema,
});

export const orderCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ORDER_CODE_PATTERN, 'Código de pedido inválido');

/** Cuántos pedidos trae una página del panel. */
export const ORDERS_PAGE_SIZE = 50;

/** El Excel pide de a más: son pocas idas y vueltas para exportar la temporada. */
export const EXPORT_PAGE_SIZE = 500;

export const orderQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  search: z.string().trim().max(80).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  // La query llega como texto: `coerce` la pasa a número antes de validar.
  limit: z.coerce.number().int().min(1).max(EXPORT_PAGE_SIZE).default(ORDERS_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export type OrderPaymentDto = z.infer<typeof orderPaymentSchema>;
export type OrderQueryDto = z.infer<typeof orderQuerySchema>;

/** Lo que manda el cliente: `limit` y `offset` los completa el esquema. */
export type OrderFilters = z.input<typeof orderQuerySchema>;
