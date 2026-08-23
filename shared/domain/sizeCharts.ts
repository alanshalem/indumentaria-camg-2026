/**
 * Tablas de talles oficiales del club.
 *
 * Las medidas son datos y no píxeles adentro de un JPG. Antes eran sólo la
 * imagen: en un teléfono de 390 px los números quedaban ilegibles, no se podían
 * agrandar sin abrir la foto aparte y un lector de pantalla no las leía. Ahora
 * la tabla se dibuja en HTML —se lee en cualquier pantalla y se puede resaltar
 * la fila del talle elegido— y la ilustración queda como referencia de dónde se
 * toma cada medida, que es lo único que la tabla no puede contar.
 *
 * Los valores están transcriptos de las imágenes de `public/images/tablas-talles`.
 */

/** Una fila: el talle y sus medidas, en el orden de las columnas. */
export interface SizeChartRow {
  size: string;
  measurements: readonly number[];
}

export interface SizeChart {
  label: string;
  imageUrl: string;
  alt: string;
  /** Encabezados de las columnas de medidas, sin la del talle. */
  columns: readonly string[];
  rows: readonly SizeChartRow[];
}

export const SIZE_CHARTS = {
  buzos: {
    label: 'Buzos y camperas',
    imageUrl: '/images/tablas-talles/tabla-talles-buzos-canguros.jpg',
    alt: 'Dibujo de un buzo canguro con las flechas de ancho de sisa y largo',
    columns: ['Ancho sisa', 'Largo'],
    rows: [
      { size: '6', measurements: [40, 47] },
      { size: '8', measurements: [42, 49] },
      { size: '10', measurements: [44, 52] },
      { size: '12', measurements: [46, 55] },
      { size: '14', measurements: [48, 58] },
      { size: '16/XS', measurements: [52, 62] },
      { size: 'S', measurements: [55, 65] },
      { size: 'M', measurements: [57, 68] },
      { size: 'L', measurements: [59, 71] },
      { size: 'XL', measurements: [62, 73] },
      { size: 'XXL', measurements: [64, 76] },
      { size: '3XL', measurements: [66, 78] },
    ],
  },
  pantalones: {
    label: 'Pantalones',
    imageUrl: '/images/tablas-talles/tabla-talles-pantalones.jpg',
    alt: 'Dibujo de un pantalón largo con las flechas de contorno de cintura y largo',
    columns: ['Contorno cintura', 'Largo cintura-tobillo'],
    rows: [
      { size: '6', measurements: [58, 69] },
      { size: '8', measurements: [60, 72] },
      { size: '10', measurements: [62, 75] },
      { size: '12', measurements: [64, 78] },
      { size: '14', measurements: [66, 82] },
      { size: 'XS', measurements: [70, 94] },
      { size: 'S', measurements: [72, 97] },
      { size: 'M', measurements: [74, 100] },
      { size: 'L', measurements: [76, 103] },
      { size: 'XL', measurements: [78, 106] },
      { size: '2XL', measurements: [80, 109] },
      { size: '3XL', measurements: [82, 110] },
    ],
  },
  remeras: {
    label: 'Remeras',
    imageUrl: '/images/tablas-talles/tabla-talles-remeras.jpg',
    alt: 'Dibujo de una remera unisex con las flechas de ancho de sisa y largo',
    columns: ['Ancho de sisa', 'Largo'],
    rows: [
      { size: '8', measurements: [38, 54] },
      { size: '10', measurements: [40, 56] },
      { size: '12', measurements: [42, 58] },
      { size: '14', measurements: [44, 60] },
      { size: 'XS', measurements: [46, 62] },
      { size: 'S', measurements: [49, 66] },
      { size: 'M', measurements: [51, 69] },
      { size: 'L', measurements: [53, 72] },
      { size: 'XL', measurements: [55, 75] },
      { size: 'XXL', measurements: [57, 77] },
    ],
  },
} as const satisfies Record<string, SizeChart>;

export type SizeChartId = keyof typeof SIZE_CHARTS;

export const SIZE_CHART_IDS = Object.keys(SIZE_CHARTS) as SizeChartId[];

export const isSizeChartId = (value: unknown): value is SizeChartId =>
  typeof value === 'string' && value in SIZE_CHARTS;

/** Medidas aproximadas: el club lo aclara en cada tabla impresa. */
export const SIZE_CHART_NOTE =
  'Medidas aproximadas en centímetros. Pueden variar 1 cm según la tela y el estampado.';

/**
 * La fila que corresponde al talle elegido.
 *
 * `16/XS` en la tabla matchea tanto con `16/XS` como con un producto que use
 * sólo `XS`: son el mismo talle escrito de dos formas.
 */
export function rowForSize(chart: SizeChart, size: string): SizeChartRow | null {
  const wanted = size.trim().toUpperCase();
  if (!wanted) return null;

  return (
    chart.rows.find((row) => {
      const parts = row.size.toUpperCase().split('/');
      return parts.includes(wanted) || row.size.toUpperCase() === wanted;
    }) ?? null
  );
}
