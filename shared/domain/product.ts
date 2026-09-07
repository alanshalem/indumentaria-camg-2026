import type { Ars } from './money.js';
import type { StockLevel } from './stock.js';
import type { SizeChartId } from './sizeCharts.js';

/**
 * La lista de precios del club tiene dos columnas —"Talles Grandes" y "Talles
 * Chicos"— para casi todos los productos. El precio depende del talle elegido,
 * así que el talle define un *tier* y el tier define el precio.
 */
/**
 * Categorías del catálogo.
 *
 * Sirven para filtrar: con ocho productos la grilla todavía se recorre, pero en
 * un teléfono ya son casi ocho pantallas de scroll y el club va a sumar más.
 */
export const PRODUCT_CATEGORIES = ['abrigo', 'pantalones', 'remeras', 'accesorios'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  abrigo: 'Buzos y camperas',
  pantalones: 'Pantalones',
  remeras: 'Remeras',
  accesorios: 'Accesorios',
};

export const isProductCategory = (value: unknown): value is ProductCategory =>
  typeof value === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(value);

export const SIZE_TIERS = ['small', 'large'] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

export const SIZE_TIER_LABELS: Record<SizeTier, string> = {
  small: 'Talle chico',
  large: 'Talle grande',
};

export interface ProductColor {
  name: string;
  /** Color de muestra para el chip; los diseños sublimados usan el dominante. */
  hex: string;
  /** Foto de esa variante. Si falta, se usa la imagen principal. */
  imageUrl: string | null;
}

/** Producto tal como lo consume la UI y lo devuelve la API. */
export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Talles 6–16: precio `priceSmall`. */
  sizesSmall: string[];
  /** Talles XS–3XL (y talle único): precio `priceLarge`. */
  sizesLarge: string[];
  priceSmall: Ars;
  priceLarge: Ars;
  /** Vacío = el producto no ofrece elección de color. */
  colors: ProductColor[];
  sizeChartId: SizeChartId | null;
  /** Para el filtro del catálogo. */
  category: ProductCategory;
  /**
   * Stock físico por variante. Sólo trae las que el club cargó: una variante
   * ausente no participa del inventario y se vende sin aviso.
   */
  stock: StockLevel[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Payload de creación/edición. `id` se deriva del nombre si no viene. */
export interface ProductInput {
  id?: string;
  name: string;
  description?: string;
  imageUrl: string;
  sizesSmall?: string[];
  sizesLarge?: string[];
  priceSmall: Ars;
  priceLarge: Ars;
  colors?: ProductColor[];
  sizeChartId?: SizeChartId | null;
  category?: ProductCategory;
  isActive?: boolean;
  sortOrder?: number;
}

export const SIZE_PRESETS = {
  ninosBuzos: ['6', '8', '10', '12', '14'],
  ninosRemeras: ['8', '10', '12', '14'],
  adultosBuzos: ['16/XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  adultosPantalones: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
  adultosRemeras: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  medias: ['38-42', '42-50'],
  unico: ['Único'],
} as const satisfies Record<string, readonly string[]>;

export type SizePresetKey = keyof typeof SIZE_PRESETS;

export const SIZE_PRESET_LABELS: Record<SizePresetKey, string> = {
  ninosBuzos: 'Niños buzos (6–14)',
  ninosRemeras: 'Niños remeras (8–14)',
  adultosBuzos: 'Adultos buzos (16/XS–3XL)',
  adultosPantalones: 'Adultos pantalón (XS–3XL)',
  adultosRemeras: 'Adultos remera (XS–XXL)',
  medias: 'Medias (38-42 / 42-50)',
  unico: 'Talle único',
};

/** Todos los talles del producto, en el orden en que se muestran. */
export const allSizes = (product: Pick<Product, 'sizesSmall' | 'sizesLarge'>): string[] => [
  ...product.sizesSmall,
  ...product.sizesLarge,
];

export function sizeTierOf(
  product: Pick<Product, 'sizesSmall' | 'sizesLarge'>,
  size: string,
): SizeTier | null {
  if (product.sizesSmall.includes(size)) return 'small';
  if (product.sizesLarge.includes(size)) return 'large';
  return null;
}

export const priceForTier = (
  product: Pick<Product, 'priceSmall' | 'priceLarge'>,
  tier: SizeTier,
): Ars => (tier === 'small' ? product.priceSmall : product.priceLarge);

/**
 * Talle marcado al abrir la ficha o la card.
 *
 * Vacío a propósito cuando hay más de uno. Preseleccionar el primero hacía que
 * un adulto agregara al carrito un talle 6 —el primero de la lista es de nene—
 * sin haber elegido nada, y el club terminaba encargándole esa prenda al
 * proveedor. Con una sola opción no hay decisión que tomar: se marca sola.
 */
export const initialSize = (product: Pick<Product, 'sizesSmall' | 'sizesLarge'>): string => {
  const sizes = allSizes(product);
  return sizes.length === 1 ? sizes[0]! : '';
};

/** Rango a mostrar en la ficha cuando los dos tiers valen distinto. */
export const priceRange = (
  product: Pick<Product, 'priceSmall' | 'priceLarge' | 'sizesSmall' | 'sizesLarge'>,
): { min: Ars; max: Ars; hasRange: boolean } => {
  const prices = [
    ...(product.sizesSmall.length ? [product.priceSmall] : []),
    ...(product.sizesLarge.length ? [product.priceLarge] : []),
  ];
  const min = prices.length ? Math.min(...prices) : product.priceLarge;
  const max = prices.length ? Math.max(...prices) : product.priceLarge;
  return { min, max, hasRange: min !== max };
};

/** Orden canónico de los talles de adulto, para ordenar listados. */
const ADULT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XXXL'];

/**
 * Valor numérico de un talle, o `null` si es de letra.
 *
 * No alcanza con "empieza con dígito": `3XL` y `2XL` empiezan con número y son
 * talles de adulto grandes. Sólo cuenta como numérico si después de los dígitos
 * viene el final (`6`), un guion (`38-42`) o una barra (`16/XS`).
 */
function numericSizeValue(size: string): number | null {
  const match = /^(\d+)(?:$|\s*[-/])/.exec(size.trim());
  return match ? Number.parseInt(match[1]!, 10) : null;
}

/**
 * Ordena talles como los leería una persona: primero los numéricos de menor a
 * mayor (6, 8, 10, 14, 16/XS) y después los de letra en su orden real.
 * Sin esto un export sale como "10, 12, 14, 6, 8" y parece roto.
 */
export function compareSizes(a: string, b: string): number {
  const numericA = numericSizeValue(a);
  const numericB = numericSizeValue(b);

  if (numericA !== null && numericB !== null) return numericA - numericB;
  if (numericA !== null) return -1;
  if (numericB !== null) return 1;

  const indexA = ADULT_SIZE_ORDER.indexOf(a.toUpperCase());
  const indexB = ADULT_SIZE_ORDER.indexOf(b.toUpperCase());
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;

  return a.localeCompare(b, 'es');
}

/** "6 a 14" / "Único": resume un tramo de talles para mostrar su precio. */
export function sizeRangeLabel(sizes: readonly string[]): string {
  if (sizes.length === 0) return '';
  if (sizes.length === 1) return sizes[0]!;
  return `${sizes[0]} a ${sizes[sizes.length - 1]}`;
}

/**
 * Los dos tramos de precio, sólo cuando de verdad valen distinto. Sirve para
 * explicar el precio sin pegarle una etiqueta al número.
 */
export const priceBands = (
  product: Pick<Product, 'sizesSmall' | 'sizesLarge' | 'priceSmall' | 'priceLarge'>,
): Array<{ tier: SizeTier; range: string; price: Ars }> => {
  if (product.priceSmall === product.priceLarge) return [];
  if (product.sizesSmall.length === 0 || product.sizesLarge.length === 0) return [];

  return [
    { tier: 'small', range: sizeRangeLabel(product.sizesSmall), price: product.priceSmall },
    { tier: 'large', range: sizeRangeLabel(product.sizesLarge), price: product.priceLarge },
  ];
};

export const findColor = (product: Pick<Product, 'colors'>, name: string | null) =>
  name ? (product.colors.find((color) => color.name === name) ?? null) : null;

/** Imagen a mostrar: la de la variante elegida, con fallback a la principal. */
export const imageForColor = (product: Product, colorName: string | null): string =>
  findColor(product, colorName)?.imageUrl ?? product.imageUrl;

const SLUG_INVALID = /[^a-z0-9]+/g;
const SLUG_EDGES = /^-+|-+$/g;

/** Convierte "Campera 1/2 cierre" -> "campera-1-2-cierre". Determinista e idempotente. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(SLUG_INVALID, '-')
    .replace(SLUG_EDGES, '')
    .slice(0, 64);
}

export function resolveProductId(input: Pick<ProductInput, 'id' | 'name'>): string {
  const candidate = input.id?.trim() ? input.id : input.name;
  return slugify(candidate);
}
