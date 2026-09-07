/**
 * Normalización de nombres de personas.
 *
 * El socio tipea como puede: "NATALIA BACCHETTO", "marianela fontana",
 * "Viviana  Marisa   Dominguez". En la tabla del panel eso se lee como ruido y
 * en el mail queda "¡Gracias, NATALIA!". Se normaliza al escribir, así el dato
 * queda limpio en la base y todas las pantallas —panel, mail, Excel— lo
 * heredan sin repetir la lógica.
 */

/**
 * Partículas que van en minúscula dentro del apellido: "Juan de la Cruz".
 *
 * La lista es corta a propósito. `di`, `da`, `van` y `von` quedan afuera porque
 * en Argentina se escriben con mayúscula —"Di Marco", "Van Damme"— y bajarlas
 * sería corregir mal un apellido que estaba bien.
 */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

/** Separadores que también empiezan palabra: "Ana-María", "D'Angelo". */
const WORD_BREAK = /([\s\-']+)/;

const capitalize = (word: string): string =>
  word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es');

/**
 * "NATALIA BACCHETTO" → "Natalia Bacchetto"
 * "juan de la cruz"   → "Juan de la Cruz"
 * "ana-maría d'angelo" → "Ana-María D'Angelo"
 *
 * Los espacios de más se colapsan; el resto de la puntuación se respeta.
 */
export function normalizeName(value: string): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  let isFirstWord = true;

  return clean
    .split(WORD_BREAK)
    .map((part) => {
      // Los separadores vuelven tal cual: `split` con captura los intercala.
      if (WORD_BREAK.test(part) || part === '') return part;

      const lower = part.toLocaleLowerCase('es');
      // La partícula sólo baja si no abre el nombre: un apellido que empieza
      // con "De" y se muestra solo tiene que seguir leyéndose como apellido.
      const result = !isFirstWord && PARTICLES.has(lower) ? lower : capitalize(part);

      isFirstWord = false;
      return result;
    })
    .join('');
}
