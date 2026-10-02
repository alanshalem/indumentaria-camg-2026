import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardarraíl de código muerto: un `export` que nadie nombra en ningún lado.
 *
 * El proyecto no tiene ESLint, y agregarlo con sus plugins para una regla de
 * lint sería más peso que el problema. El patrón de la casa para un invariante
 * de arquitectura es un test —`moduleResolution.test.ts` hace lo mismo con las
 * extensiones de los imports—, así que esto corre en el mismo `npm test` y sin
 * una dependencia nueva.
 *
 * Qué detecta: el identificador aparece **una sola vez** en todo el repo, que es
 * su propia declaración. Nadie lo importa y su propio archivo tampoco lo usa:
 * es código que no hace nada. Deliberadamente NO marca un `export` que el
 * archivo sí consume internamente, aunque nadie lo importe de afuera: eso es
 * superficie pública más ancha de lo necesario, no código muerto, y hacer fallar
 * el build por eso daría más ruido que señal.
 */
const SCANNED = ['shared', 'server', 'src'];
const SEARCHED = [...SCANNED, 'api', 'tests', 'scripts'];

/**
 * Exports sin uso que se dejan a propósito, con el motivo.
 *
 * Que haya que escribir el motivo acá es el punto: deja de ser un descuido
 * invisible y pasa a ser una decisión.
 */
const DELIBERATE: Record<string, string> = {
  // Formato: 'ruta/del/archivo.ts:NombreExportado': 'por qué se deja'.
  // Hoy está vacío: cuando este test falle, la decisión es borrar el export o
  // anotar acá por qué tiene que quedarse.
};

const DECLARATION =
  /^export (?:default )?(?:abstract )?(?:const|let|function|async function|interface|type|class|enum) (\w+)/gm;

function collect(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, found);
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) found.push(path);
  }
  return found;
}

const root = resolve(__dirname, '..');
const relative = (path: string) => path.slice(root.length + 1).replace(/[\\]/g, '/');

describe('superficie pública', () => {
  const everywhere = SEARCHED.flatMap((dir) => collect(resolve(root, dir)));
  const sources = everywhere.filter((path) =>
    SCANNED.some((dir) => relative(path).startsWith(`${dir}/`)),
  );
  const corpus = everywhere.map((path) => readFileSync(path, 'utf8'));

  it('encuentra el código que tiene que mirar', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(corpus.length).toBeGreaterThan(sources.length);
  });

  it('ningún export quedó sin un solo uso en todo el repo', () => {
    const dead: string[] = [];

    for (const path of sources) {
      for (const [, name] of readFileSync(path, 'utf8').matchAll(DECLARATION)) {
        if (DELIBERATE[`${relative(path)}:${name!}`]) continue;

        const mentions = new RegExp(`\\b${name!}\\b`, 'g');
        const uses = corpus.reduce((total, text) => total + (text.match(mentions)?.length ?? 0), 0);

        // 1 es su propia declaración: nadie más lo nombra.
        if (uses === 1) dead.push(`${relative(path)} → ${name!}`);
      }
    }

    expect(dead).toEqual([]);
  });
});
