export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

/** RFC 4180: comillas dobles duplicadas y todo el campo entrecomillado. */
const escapeCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

export const toCsv = <T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string =>
  [
    columns.map((column) => escapeCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(',')),
  ].join('\r\n');

/**
 * Dispara la descarga de un CSV. El BOM al inicio es lo que hace que Excel en
 * español abra los acentos bien en vez de mostrar "Atlético".
 */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
