import type { Order } from '@shared/domain/order.js';
import { buildOrdersWorkbook } from '@/utils/ordersWorkbook';

const pad = (value: number) => String(value).padStart(2, '0');

/** `camg-pedidos-2026-08-22.xlsx`: ordena solo al listarlo por nombre. */
export function workbookFileName(now = new Date()): string {
  return `camg-pedidos-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;
}

/**
 * Descarga los pedidos como Excel.
 *
 * La librería se importa dinámicamente: pesa más que toda la app junta y sólo
 * la necesita un admin que aprieta "Exportar". Así el socio que entra al
 * catálogo no descarga un solo byte de esto.
 */
export async function exportOrdersToExcel(orders: readonly Order[]): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const sheets = buildOrdersWorkbook(orders);

  // La build de browser devuelve { toBlob, toFile }: la descarga la dispara toFile.
  await writeXlsxFile(
    sheets.map((sheet) => ({
      sheet: sheet.sheet,
      data: sheet.data,
      columns: sheet.columns,
      // Encabezado siempre visible al scrollear cientos de filas.
      stickyRowsCount: 1,
    })),
  ).toFile(workbookFileName());
}
