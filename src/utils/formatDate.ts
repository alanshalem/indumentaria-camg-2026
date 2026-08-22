const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** El formateador se crea una sola vez: instanciar Intl por fila es caro. */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  return dateTimeFormatter.format(new Date(timestamp));
}

/** `YYYY-MM-DD` (input date) → instante ISO, respetando la zona local. */
export const startOfDayIso = (date: string): string | undefined =>
  date ? new Date(`${date}T00:00:00`).toISOString() : undefined;

export const endOfDayIso = (date: string): string | undefined =>
  date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
