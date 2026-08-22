/**
 * Tablas de talles oficiales. Son tres imágenes fijas provistas por el club, no
 * datos que cambien seguido: viven en código y el admin elige cuál asociar a
 * cada producto desde un desplegable.
 */
export const SIZE_CHARTS = {
  buzos: {
    label: 'Buzos y camperas',
    imageUrl: '/images/tablas-talles/tabla-talles-buzos-canguros.jpg',
    alt: 'Tabla de talles de buzos y camperas con capucha: ancho de sisa y largo',
  },
  pantalones: {
    label: 'Pantalones',
    imageUrl: '/images/tablas-talles/tabla-talles-pantalones.jpg',
    alt: 'Tabla de talles de pantalón largo: contorno de cintura y largo cintura-tobillo',
  },
  remeras: {
    label: 'Remeras',
    imageUrl: '/images/tablas-talles/tabla-talles-remeras.jpg',
    alt: 'Tabla de talles de remera unisex: ancho de sisa y largo',
  },
} as const;

export type SizeChartId = keyof typeof SIZE_CHARTS;

export const SIZE_CHART_IDS = Object.keys(SIZE_CHARTS) as SizeChartId[];

export const isSizeChartId = (value: unknown): value is SizeChartId =>
  typeof value === 'string' && value in SIZE_CHARTS;
