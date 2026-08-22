import { z } from 'zod';
import { MAX_PRICE_ARS } from '../domain/money';
import { PROMOTION_KINDS } from '../domain/promotions';

const price = z.number().int().min(0).max(MAX_PRICE_ARS);

export const comboConfigSchema = z.object({
  productIds: z.tuple([z.string().trim().min(1), z.string().trim().min(1)]),
  bundlePriceLarge: price,
  bundlePriceSmall: price,
});

export const sameProductConfigSchema = z.object({
  percentOff: z
    .number()
    .int('El descuento debe ser un porcentaje entero')
    .min(1, 'El descuento debe ser mayor a 0')
    .max(90, 'El descuento no puede superar el 90%'),
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

export type PromotionPatchDto = z.infer<typeof promotionPatchSchema>;
export type ComboConfigDto = z.infer<typeof comboConfigSchema>;
export type SameProductConfigDto = z.infer<typeof sameProductConfigSchema>;
