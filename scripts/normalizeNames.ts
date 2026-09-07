/**
 * Normaliza los nombres de los pedidos que ya están cargados.
 *
 *   npm run db:normalize-names          muestra qué cambiaría
 *   npm run db:normalize-names -- --write   lo aplica
 *
 * Los pedidos nuevos ya salen normalizados desde el esquema del checkout; esto
 * es para los que se cargaron antes. Usa la MISMA función que el servidor, así
 * no hay dos definiciones de "nombre bien escrito" que puedan separarse.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizeName } from '../shared/domain/name.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(name: string): void {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key!]) process.env[key!] = value!.trim().replace(/^["']|["']$/g, '');
  }
}

/** Supabase genera contraseñas con caracteres que rompen la URI si van crudos. */
function normalizeDatabaseUrl(raw: string): string {
  const match = /^(postgres(?:ql)?:\/\/)([^:@/]+):(.*)@([^@]+)$/.exec(raw.trim());
  if (!match) return raw.trim();

  const [, scheme, user, password, rest] = match;
  return /[?/#@[\]\s]/.test(password!)
    ? `${scheme}${user}:${encodeURIComponent(password!)}@${rest}`
    : raw.trim();
}

interface Row {
  code: string;
  customer_name: string;
  customer_last_name: string;
}

async function main(): Promise<void> {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL en .env.local');
    process.exit(1);
  }

  const write = process.argv.includes('--write');
  const client = new pg.Client({
    connectionString: normalizeDatabaseUrl(url),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const { rows } = await client.query<Row>(
      'select code, customer_name, customer_last_name from orders order by created_at',
    );

    const cambios = rows
      .map((row) => ({
        code: row.code,
        antes: `${row.customer_name} ${row.customer_last_name}`,
        name: normalizeName(row.customer_name),
        lastName: normalizeName(row.customer_last_name),
      }))
      .filter((row) => row.antes !== `${row.name} ${row.lastName}`);

    if (cambios.length === 0) {
      console.log(`Nada que corregir: los ${rows.length} pedidos ya están normalizados.`);
      return;
    }

    for (const cambio of cambios) {
      console.log(`  ${cambio.code}  ${cambio.antes}  →  ${cambio.name} ${cambio.lastName}`);
    }

    if (!write) {
      console.log(`\n${cambios.length} de ${rows.length} pedidos cambiarían.`);
      console.log('Nada se escribió. Volvé a correrlo con  -- --write  para aplicarlo.');
      return;
    }

    for (const cambio of cambios) {
      await client.query(
        'update orders set customer_name = $1, customer_last_name = $2 where code = $3',
        [cambio.name, cambio.lastName, cambio.code],
      );
    }

    console.log(`\n${cambios.length} pedidos actualizados.`);
  } finally {
    await client.end();
  }
}

await main();
