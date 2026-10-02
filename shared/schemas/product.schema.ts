import { z } from 'zod';
import { MAX_PRICE_ARS } from '../domain/money.js';
import { PRODUCT_CATEGORIES } from '../domain/product.js';
import { SIZE_CHART_IDS } from '../domain/sizeCharts.js';

const trimmed = (max: number) => z.string().trim().max(max);

/** Un talle es una etiqueta corta: "M", "16/XS", "42-50", "Único". */
const sizeSchema = trimmed(16).min(1, 'El talle no puede estar vacío');

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El identificador solo admite minúsculas, números y guiones');

const priceSchema = z
  .number('Ingresá un precio')
  .int('El precio debe ser un número entero de pesos')
  .min(0, 'El precio no puede ser negativo')
  .max(MAX_PRICE_ARS, 'El precio supera el máximo permitido');

export const productColorSchema = z.object({
  name: trimmed(30).min(1, 'El color necesita un nombre'),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usá un color en formato #RRGGBB'),
  imageUrl: trimmed(500).nullable().default(null),
});

export const productInputSchema = z
  .object({
    id: slugSchema.optional(),
    name: trimmed(80).min(2, 'El nombre debe tener al menos 2 caracteres'),
    description: trimmed(300).default(''),
    imageUrl: trimmed(500).min(1, 'La imagen es obligatoria'),
    sizesSmall: z.array(sizeSchema).max(30).default([]),
    sizesLarge: z.array(sizeSchema).max(30).default([]),
    priceSmall: priceSchema,
    priceLarge: priceSchema,
    colors: z.array(productColorSchema).max(12).default([]),
    sizeChartId: z.enum(SIZE_CHART_IDS).nullable().default(null),
    category: z.enum(PRODUCT_CATEGORIES).default('accesorios'),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  // Un producto sin talles no se puede comprar: no tendría qué elegir el socio.
  .refine((product) => product.sizesSmall.length + product.sizesLarge.length > 0, {
    message: 'Cargá al menos un talle',
    path: ['sizesLarge'],
  })
  // El mismo talle en los dos tiers haría ambiguo el precio.
  .refine((product) => !product.sizesSmall.some((size) => product.sizesLarge.includes(size)), {
    message: 'Un talle no puede estar en chicos y en grandes a la vez',
    path: ['sizesSmall'],
  })
  .refine(
    (product) => new Set(product.colors.map((color) => color.name)).size === product.colors.length,
    { message: 'Hay colores repetidos', path: ['colors'] },
  );

/** PATCH parcial: todo opcional, pero al menos un campo presente. */
export const productPatchSchema = z
  .object({
    name: trimmed(80).min(2).optional(),
    description: trimmed(300).optional(),
    imageUrl: trimmed(500).min(1).optional(),
    sizesSmall: z.array(sizeSchema).max(30).optional(),
    sizesLarge: z.array(sizeSchema).max(30).optional(),
    priceSmall: priceSchema.optional(),
    priceLarge: priceSchema.optional(),
    colors: z.array(productColorSchema).max(12).optional(),
    sizeChartId: z.enum(SIZE_CHART_IDS).nullable().optional(),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'No hay cambios para aplicar');

/**
 * La grilla de stock que manda el panel. Reemplaza la del producto entera: una
 * variante que se saca de la pantalla deja de existir, no queda con su último
 * valor.
 */
export const stockGridSchema = z.object({
  levels: z
    .array(
      z.object({
        size: sizeSchema,
        color: trimmed(30).nullable().default(null),
        units: z
          .number('Cargá un número')
          .int('Las unidades son enteras')
          .min(0, 'No puede ser negativo')
          .max(9999),
      }),
    )
    .max(200)
    .default([]),
});

export const productImageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  /** Contenido del archivo en base64 puro (sin el prefijo `data:`). */
  dataBase64: z.string().min(1).max(8_000_000),
});

export type ProductImageUploadDto = z.infer<typeof productImageUploadSchema>;
