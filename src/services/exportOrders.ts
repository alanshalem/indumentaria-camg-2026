import type { Order } from '@shared/domain/order';
import { buildOrdersWorkbook, type ExportContext } from '@/utils/ordersWorkbook';

const pad = (value: number) => String(value).padStart(2, '0');

/** `camg-pedidos-2026-08-23` sin el sufijo del filtro. */
const stamp = (now: Date) =>
  `camg-pedidos-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Sufijo del archivo a partir del filtro: sin espacios ni acentos. */
export function slugFilter(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * `camg-pedidos-2026-08-23-pendientes-de-pago.xlsx`.
 *
 * El filtro va en el nombre porque el club exporta varias veces el mismo día:
 * sin esto, dos recortes distintos se pisaban en la carpeta de descargas y no
 * había forma de saber cuál era cuál sin abrirlos.
 */
export function workbookFileName(filterSlug: string, now = new Date()): string {
  return `${stamp(now)}${filterSlug ? `-${filterSlug}` : ''}.xlsx`;
}

/**
 * Descarga los pedidos como Excel.
 *
 * La librería se importa dinámicamente: pesa más que toda la app junta y sólo
 * la necesita un admin que aprieta "Exportar". Así el socio que entra al
 * catálogo no descarga un solo byte de esto.
 */
export async function exportOrdersToExcel(
  orders: readonly Order[],
  context: ExportContext,
): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const sheets = buildOrdersWorkbook(orders, context);

  // La build de browser devuelve { toBlob, toFile }: la descarga la dispara toFile.
  await writeXlsxFile(
    sheets.map((sheet) => ({
      sheet: sheet.sheet,
      data: sheet.data,
      columns: sheet.columns,
      // Se imprime para llevárselo al proveedor: apaisado y sin cuadrícula de
      // fondo, para que salga como informe y no como planilla en crudo.
      ...(sheet.landscape ? { orientation: 'landscape' as const } : {}),
      showGridLines: false,
      stickyRowsCount: sheet.stickyRowsCount,
      ...(sheet.stickyColumnsCount ? { stickyColumnsCount: sheet.stickyColumnsCount } : {}),
      ...(sheet.conditionalFormatting?.length
        ? { conditionalFormatting: sheet.conditionalFormatting }
        : {}),
    })),
  ).toFile(workbookFileName(slugFilter(context.filterLabel)));
}
