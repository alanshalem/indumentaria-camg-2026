import { z } from 'zod';
import { MAX_PRICE_ARS } from '../domain/money.js';
import { PROMOTION_KINDS } from '../domain/promotions.js';

const price = z.number().int().min(0).max(MAX_PRICE_ARS);

const productId = z.string().trim().min(1);

const promotionId = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El identificador solo admite minúsculas, números y guiones');

export const comboConfigSchema = z.object({
  productIds: z.tuple([productId, productId]),
  bundlePriceLarge: price,
  bundlePriceSmall: price,
});

export const sameProductConfigSchema = z.object({
  percentOff: z
    .number()
    .int('El descuento debe ser un porcentaje entero')
    .min(1, 'El descuento debe ser mayor a 0')
    .max(90, 'El descuento no puede superar el 90%'),
  // Explícito y obligatorio: una promo sin productos elegidos no descuenta
  // nada, y es preferible a una que descuenta en todo el catálogo por omisión.
  productIds: z.array(productId).min(1, 'Elegí al menos un producto').max(50),
});

/**
 * El `config` se valida según el `kind`: cada estrategia tiene su propia forma.
 * Un discriminated union deja que zod elija el esquema correcto solo.
 */
export const promotionConfigByKind = {
  combo: comboConfigSchema,
  sameProductDifferentSize: sameProductConfigSchema,
} as const;

export const promotionPatchSchema = z
  .object({
    label: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(200).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    config: z.unknown().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'No hay cambios para aplicar');

export const promotionKindSchema = z.enum(PROMOTION_KINDS);

/**
 * Alta de una promoción desde el panel.
 *
 * El `config` viaja como `unknown` y lo valida el servicio con el esquema que
 * corresponde al `kind`: acá todavía no se sabe cuál de las dos formas es.
 */
export const promotionInputSchema = z.object({
  id: promotionId.optional(),
  kind: promotionKindSchema,
  label: z.string().trim().min(2, 'Poné un nombre').max(80),
  description: z.string().trim().max(200).default(''),
  config: z.unknown(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export type PromotionInputDto = z.infer<typeof promotionInputSchema>;
export type PromotionPatchDto = z.infer<typeof promotionPatchSchema>;
