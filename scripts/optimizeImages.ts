/**
 * Genera los WebP que sirve el sitio.
 *
 *   npm run images
 *
 * Los originales quedan intactos en `public/images`: son el archivo de trabajo
 * del club y el fallback del `<picture>`. Los derivados van a `public/images/opt`
 * y son los que descarga cualquier navegador de los últimos ocho años.
 *
 * Es idempotente: si el derivado ya existe y es más nuevo que el original, no
 * lo vuelve a generar.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { requestedWidths } from '../shared/media/imageVariants.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = join(ROOT, 'public', 'images');
const OUT = join(IMAGES, 'opt');

/** 78 es el punto donde una foto de prenda deja de mejorar a simple vista. */
const QUALITY = 78;

const SOURCE = /\.(jpe?g|png)$/i;

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    // `opt` es la salida: recorrerla sería generar derivados de derivados.
    if (entry.isDirectory()) {
      if (full !== OUT) yield* walk(full);
    } else if (SOURCE.test(entry.name)) {
      yield full;
    }
  }
}

/**
 * Escribe el manifiesto como módulo TypeScript, no como JSON.
 *
 * Así viaja dentro del bundle: el navegador no hace un request extra para
 * enterarse de qué imágenes existen, y un ancho mal escrito lo caza el
 * compilador antes de llegar a producción.
 */
function writeManifest(manifest: Map<string, number[]>): void {
  const entries = [...manifest.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, widths]) => `  '${key}': [${[...widths].sort((a, b) => a - b).join(', ')}],`)
    .join('\n');

  const file = [
    '/**',
    ' * GENERADO POR `npm run images`. No editar a mano.',
    ' *',
    ' * Qué derivados existen realmente en `public/images/opt`. El `srcset` sale',
    ' * de acá y no de la configuración, así que nunca pide un archivo que el',
    ' * generador salteó por ser el original más chico que ese ancho.',
    ' */',
    'export const IMAGE_MANIFEST: Record<string, readonly number[]> = {',
    entries,
    '};',
    '',
  ].join('\n');

  writeFileSync(join(ROOT, 'shared', 'media', 'imageManifest.ts'), file, 'utf8');
}

async function main(): Promise<void> {
  if (!existsSync(IMAGES)) {
    console.error(`No existe ${IMAGES}`);
    process.exit(1);
  }

  let originales = 0;
  let generados = 0;
  let saltados = 0;
  let escritos = 0;

  // Lo que de verdad quedó en disco. De acá sale el manifiesto que consume el
  // `srcset`, para que nunca pida un ancho que no existe.
  const manifest = new Map<string, number[]>();

  for (const file of [...walk(IMAGES)].sort()) {
    // La ruta pública es la que conocen el catálogo y la base de datos.
    const publicPath = `/images/${relative(IMAGES, file).split('\\').join('/')}`;
    const widths = requestedWidths(publicPath);

    const source = statSync(file);
    originales += source.size;

    if (widths.length === 0) {
      console.log(`  —  ${publicPath} (sin variantes configuradas)`);
      continue;
    }

    const meta = await sharp(file).metadata();
    const name = relative(IMAGES, file).split('\\').join('/').replace(extname(file), '');

    for (const width of widths) {
      // No se agranda una imagen: si el original es más chico, ese ancho no
      // aporta nada y el `srcset` igual lo resuelve con el mayor disponible.
      if (meta.width && meta.width < width) continue;

      const target = join(OUT, `${name}-${width}.webp`);
      mkdirSync(dirname(target), { recursive: true });

      const done = manifest.get(name) ?? [];
      done.push(width);
      manifest.set(name, done);

      if (existsSync(target) && statSync(target).mtimeMs >= source.mtimeMs) {
        saltados += 1;
        generados += statSync(target).size;
        continue;
      }

      const info = await sharp(file)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(target);

      generados += info.size;
      escritos += 1;
      console.log(`  ✓  ${name}-${width}.webp  ${kb(source.size)} → ${kb(info.size)}`);
    }
  }

  writeManifest(manifest);

  console.log('');
  console.log(`Originales:  ${kb(originales)}  (quedan como fallback, no se descargan)`);
  console.log(`Derivados:   ${kb(generados)}  en ${OUT}`);
  console.log(`Escritos:    ${escritos}   ·   ya estaban al día: ${saltados}`);
}

await main();
