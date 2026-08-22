import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Vercel **transpila** el código de `api/` en vez de bundlearlo y, como el
 * `package.json` declara `"type": "module"`, lo ejecuta como ESM nativo. Ahí un
 * import relativo sin extensión tira `ERR_MODULE_NOT_FOUND` al cargar el
 * módulo: la Function muere antes de correr una línea y Vercel devuelve un
 * `FUNCTION_INVOCATION_FAILED` opaco en TODOS los endpoints.
 *
 * Este test es el guardarraíl: si alguien vuelve a escribir `from './algo'` en
 * el código que termina dentro de la Function, falla acá y no en producción.
 *
 * `src/` queda afuera a propósito: lo empaqueta Vite y nunca corre en Node.
 */
const BUNDLED_INTO_FUNCTION = ['api', 'server', 'shared'];

const RELATIVE_IMPORT = /(?:from\s+|import\(\s*)(['"])(\.\.?\/[^'"]*)\1/g;
const REAL_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json'];

function collectTypeScriptFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collectTypeScriptFiles(path, found);
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) found.push(path);
  }
  return found;
}

const root = resolve(__dirname, '..');

describe('imports que corren en Node ESM', () => {
  const files = BUNDLED_INTO_FUNCTION.flatMap((dir) => collectTypeScriptFiles(resolve(root, dir)));

  it('encuentra los archivos del backend', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('todos los imports relativos llevan extensión explícita', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [, , specifier] of source.matchAll(RELATIVE_IMPORT)) {
        if (!REAL_EXTENSIONS.some((extension) => specifier!.endsWith(extension))) {
          offenders.push(`${file.slice(root.length + 1)} → ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
