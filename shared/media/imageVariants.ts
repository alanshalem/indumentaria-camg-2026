/**
 * Anchos que se generan de cada imagen del sitio.
 *
 * Vive acá porque lo necesitan las dos puntas: el script que genera los WebP
 * (`npm run images`) y el componente que arma el `srcset`. Si estuvieran en dos
 * lados, el navegador terminaría pidiendo un ancho que nadie generó.
 *
 * Los originales no se tocan: quedan como fallback del `<picture>` y como
 * archivo de trabajo del club. El navegador moderno nunca los descarga.
 */
import { IMAGE_MANIFEST } from './imageManifest.js';

export const OPTIMIZED_DIR = '/images/opt';

/** Prefijo de ruta → anchos, en píxeles. Gana el prefijo más largo. */
export const IMAGE_VARIANTS: Record<string, readonly number[]> = {
  // Se ven a 356 px en el teléfono y hasta ~780 en la ficha. 700 es el techo
  // de las fotos más chicas del catálogo (cuello y toalla miden 763 de ancho):
  // por encima de eso el generador las saltearía y la ficha las agrandaría.
  '/images/fotos-prendas': [400, 700, 1200],
  // Son tablas con números adentro: necesitan resolución para ampliarlas.
  // 700 entra en la más angosta (pantalones, 792).
  '/images/tablas-talles': [700, 1400],
  // El escudo se dibuja a 44, 56 y 180 px. 384 alcanza para el hero en DPR 2.
  '/images': [128, 384],
};

const EXTENSION = /\.(jpe?g|png|webp)$/i;

/** `/images/fotos-prendas/campera.jpg` → `fotos-prendas/campera` */
export const variantKey = (src: string): string =>
  src.replace(/^\/images\//, '').replace(EXTENSION, '');

/**
 * Anchos que el script *pediría* para esta imagen. Es la entrada del generador,
 * no la verdad: si el original es más chico, el ancho grande no se genera.
 * Para saber qué existe de verdad está el manifiesto.
 */
export function requestedWidths(src: string): readonly number[] {
  // Sólo las imágenes servidas por el sitio. Las que sube el admin viven en
  // Supabase Storage con URL absoluta y no pasan por el optimizador.
  if (!src.startsWith('/images/') || !EXTENSION.test(src)) return [];

  const prefix = Object.keys(IMAGE_VARIANTS)
    .filter((key) => src.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];

  return prefix ? (IMAGE_VARIANTS[prefix] ?? []) : [];
}

/** Ruta del derivado, para un ancho puntual. */
export const variantPath = (key: string, width: number): string =>
  `${OPTIMIZED_DIR}/${key}-${width}.webp`;

/**
 * `srcset` en WebP con los anchos que **de verdad se generaron**.
 *
 * Sale del manifiesto y no de la configuración de arriba: `pantalon.jpg` mide
 * 1122 px, así que su variante de 1200 no existe. Armar el `srcset` desde la
 * configuración pedía archivos inexistentes y el navegador comía un 404.
 *
 * Cadena vacía significa "usá el original y listo", no un error.
 */
export function webpSrcSet(src: string): string {
  const key = variantKey(src);
  const widths = IMAGE_MANIFEST[key];
  if (!widths || widths.length === 0) return '';

  return widths.map((width) => `${variantPath(key, width)} ${width}w`).join(', ');
}
