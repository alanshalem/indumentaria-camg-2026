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

const timeFormatter = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });

/** Días de diferencia entre dos instantes, contando por fecha y no por horas. */
function daysApart(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Fecha para una tabla que se escanea, no que se lee.
 *
 * "07/09/2026, 03:14 p. m." ocupa media columna y obliga a comparar dígitos
 * para saber si es de hoy. "Hoy 15:14" se entiende de un vistazo. La fecha
 * completa queda en el `title`, que es donde se la busca cuando hace falta.
 */
export function formatOrderDate(
  timestamp: number,
  now: number = Date.now(),
): { label: string; title: string } {
  const date = new Date(timestamp);
  const today = new Date(now);
  const diff = daysApart(date, today);

  const time = timeFormatter.format(date);
  const title = dateTimeFormatter.format(date);

  if (diff === 0) return { label: `Hoy ${time}`, title };
  if (diff === 1) return { label: `Ayer ${time}`, title };

  // El año sólo cuando no es el corriente: repetirlo en cada fila es ruido.
  const day = dayFormatter.format(date);
  const label =
    date.getFullYear() === today.getFullYear()
      ? `${day} ${time}`
      : `${day}/${String(date.getFullYear()).slice(2)}`;

  return { label, title };
}
