#!/usr/bin/env node
/**
 * Aplica el esquema y el catálogo contra Postgres (Supabase).
 *
 * Existe para que levantar el proyecto no dependa de copiar y pegar SQL a mano
 * en el dashboard: `npm run db:setup` deja la base lista y verificada.
 *
 *   npm run db:migrate   -- sólo el esquema
 *   npm run db:seed      -- sólo el catálogo y las promos
 *   npm run db:setup     -- esquema + catálogo + verificación
 *   npm run db:check     -- qué hay cargado ahora mismo
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  // En orden: cada migración asume que corrieron las anteriores.
  migrate: [
    'db/migrations/0001_init.sql',
    'db/migrations/0002_order_emails.sql',
    'db/migrations/0003_product_category.sql',
  ],
  seed: ['db/seed.sql'],
};

// ---------------------------------------------------------------------------

/** Carga .env.local sin sumar una dependencia: son cuatro líneas de parseo. */
function loadEnvFile(name) {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

/** Errores de copiado y pegado que si no, fallan con un mensaje críptico de red. */
function findUrlProblem(url) {
  if (/\[YOUR-PASSWORD\]|\[TU-PASSWORD\]/i.test(url)) {
    return 'Falta reemplazar [YOUR-PASSWORD] por la contraseña real de la base.';
  }
  if (/:sb_(secret|publishable)_/.test(url)) {
    return 'Pusiste una API key como contraseña. Va la contraseña de la BASE (Settings → Database).';
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return 'El DATABASE_URL tiene que empezar con postgresql://';
  }
  return null;
}

/** Caracteres que en una URI significan otra cosa y no pueden ir crudos en el password. */
const ILLEGAL_IN_USERINFO = /[?/#@[\]\s]/;

/**
 * Supabase genera contraseñas con `?`, `/` o `#`. En una URI el `?` abre el
 * query string y el `/` separa el path, así que el driver corta el password ahí
 * y la conexión muere con un error de autenticación que no explica nada.
 * Se re-arma la URI con el password percent-encoded.
 */
function normalizeDatabaseUrl(raw) {
  const url = raw.trim();
  const match = /^(postgres(?:ql)?:\/\/)([^:@/]+):(.*)@([^@]+)$/.exec(url);
  if (!match) return url;

  const [, scheme, user, password, rest] = match;
  if (!ILLEGAL_IN_USERINFO.test(password)) return url;

  console.log('  (password con caracteres especiales: se codifica para la URI)');
  return `${scheme}${user}:${encodeURIComponent(password)}@${rest}`;
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const problem = findUrlProblem(url);
    if (!problem) return normalizeDatabaseUrl(url);
    console.error(`
DATABASE_URL inválido: ${problem}
`);
    process.exit(1);
  }

  console.error(
    [
      '',
      'Falta DATABASE_URL.',
      '',
      'En Supabase: botón "Connect" (arriba) → pestaña "Direct · Connection string"',
      '→ dentro elegí "Session pooler" → copiá el URI.',
      '',
      'Reemplazá [YOUR-PASSWORD] por la contraseña de la BASE (la que definiste al',
      'crear el proyecto). No es una API key.',
      '',
      'Después pegalo en .env.local:',
      '  DATABASE_URL=postgresql://postgres.xxxx:TU-PASSWORD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
      '',
      'Si perdiste la contraseña: Settings → Database → Reset database password.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const readSql = (relativePath) => readFileSync(resolve(ROOT, relativePath), 'utf8');

async function withClient(fn) {
  const client = new pg.Client({
    connectionString: requireDatabaseUrl(),
    // Supabase exige TLS; el certificado es de una CA que Node no trae de fábrica.
    ssl: { rejectUnauthorized: false },
    application_name: 'camg-db-script',
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Corre cada archivo dentro de una transacción: o entra entero, o no entra. */
async function runFiles(client, relativePaths) {
  for (const relativePath of relativePaths) {
    process.stdout.write(`  → ${relativePath} … `);
    await client.query('begin');
    try {
      await client.query(readSql(relativePath));
      await client.query('commit');
      console.log('ok');
    } catch (error) {
      await client.query('rollback');
      console.log('ERROR');
      throw error;
    }
  }
}

async function check(client) {
  const { rows } = await client.query(`
    select
      (select count(*) from public.products)                        as productos,
      (select count(*) from public.products where is_active)        as productos_visibles,
      (select count(*) from public.promotions where is_active)      as promos_activas,
      (select count(*) from public.orders)                          as pedidos,
      (select count(*) from public.email_log where status = 'sent') as mails_enviados,
      (select count(*) from storage.buckets where id = 'product-images') as bucket
  `);

  const summary = rows[0];
  console.log('\n  Estado de la base:');
  console.log(`    productos ............ ${summary.productos} (${summary.productos_visibles} visibles)`);
  console.log(`    promociones activas .. ${summary.promos_activas}`);
  console.log(`    pedidos .............. ${summary.pedidos}`);
  console.log(`    mails enviados ....... ${summary.mails_enviados}`);
  console.log(`    bucket de imágenes ... ${Number(summary.bucket) > 0 ? 'ok' : 'FALTA'}`);

  const { rows: catalog } = await client.query(`
    select id, price_small, price_large, cardinality(sizes_small) + cardinality(sizes_large) as talles
    from public.products
    order by sort_order
  `);
  if (catalog.length) {
    console.log('\n  Catálogo:');
    for (const row of catalog) {
      console.log(
        `    ${row.id.padEnd(22)} $${String(row.price_small).padStart(6)} / $${String(row.price_large).padStart(6)}  ${row.talles} talles`,
      );
    }
  }
}

const COMMANDS = {
  migrate: (client) => runFiles(client, FILES.migrate),
  seed: (client) => runFiles(client, FILES.seed),
  check,
  async setup(client) {
    await runFiles(client, [...FILES.migrate, ...FILES.seed]);
    await check(client);
  },
};

// ---------------------------------------------------------------------------

loadEnvFile('.env.local');
loadEnvFile('.env');

const command = process.argv[2] ?? 'setup';
const run = COMMANDS[command];

if (!run) {
  console.error(`Comando desconocido: ${command}. Usá: ${Object.keys(COMMANDS).join(' | ')}`);
  process.exit(1);
}

console.log(`\ndb:${command}`);

try {
  await withClient(run);
  console.log('\nListo.\n');
} catch (error) {
  console.error(`\n${error.message}\n`);
  if (error.hint) console.error(`Pista: ${error.hint}\n`);
  process.exit(1);
}
