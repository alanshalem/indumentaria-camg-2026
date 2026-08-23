/**
 * Detector de errores de tipeo en el dominio del mail.
 *
 * El campo de "confirmar email" atrapa los deslices al tipear, pero no sirve
 * cuando alguien **pega** la misma dirección equivocada en los dos campos. Esto
 * cubre ese hueco para el error más común: el dominio mal escrito
 * (`gmial.com`, `hotmial.com`, `gmail.con`).
 *
 * Importante: acá el socio no tiene cuenta ni forma de recuperar el pedido. Si
 * el mail sale mal, se entera cuando no le llega nada — y para entonces ya pagó.
 */

/** Dominios más usados en Argentina. Ordenados por frecuencia real de uso. */
const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com.ar',
  'live.com',
  'icloud.com',
  'yahoo.com.ar',
  'outlook.es',
  'protonmail.com',
  'me.com',
] as const;

/**
 * Distancia de Damerau-Levenshtein acotada.
 *
 * Cuenta la **transposición de dos letras adyacentes como una sola edición**,
 * y eso no es un detalle: `gmial` → `gmail` es intercambiar dos letras, el error
 * de tipeo más frecuente que existe. Con Levenshtein plano esa transposición
 * vale 2 y el typo más común del dominio más común se escapaba.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let twoBack: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        current[j - 1]! + 1, // inserción
        previous[j]! + 1, // borrado
        previous[j - 1]! + cost, // sustitución
      );

      // Transposición: "ab" tipeado como "ba".
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2]! + 1);
      }

      current[j] = value;
      if (value < rowMin) rowMin = value;
    }

    // Si toda la fila ya supera el máximo, no hay forma de bajar después.
    if (rowMin > max) return max + 1;
    twoBack = previous;
    previous = current;
  }

  return previous[b.length]!;
}

/**
 * Devuelve el mail corregido si el dominio se parece mucho a uno conocido,
 * o `null` si está bien escrito o si no se parece a ninguno.
 */
export function suggestEmailFix(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return null;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  // Ya es uno de los conocidos: nada que sugerir.
  if (COMMON_DOMAINS.includes(domain as (typeof COMMON_DOMAINS)[number])) return null;

  // Un dominio corto se parece a demasiadas cosas: sugerir sería adivinar.
  if (domain.length < 5) return null;

  let best: { domain: string; distance: number } | null = null;

  for (const candidate of COMMON_DOMAINS) {
    // Tolerancia proporcional: en dominios largos un error de más no es raro.
    const max = candidate.length > 10 ? 2 : 1;
    const distance = editDistance(domain, candidate, max);

    if (distance <= max && (best === null || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }

  return best ? `${local}@${best.domain}` : null;
}
