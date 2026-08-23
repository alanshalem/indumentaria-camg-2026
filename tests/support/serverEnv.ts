/**
 * `getConfig()` es fail-fast: cualquier test que toque el servidor explota sin
 * estas variables. Se llama al importar, antes de que un módulo cachee la
 * config, y usa `??=` para no pisar un `.env.local` real.
 *
 * Sin esto los tests pasan sólo en la máquina del que tiene el `.env.local`.
 */
export function stubServerEnv(): void {
  process.env.SUPABASE_URL ??= 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test';
  process.env.ADMIN_PASSWORD ??= 'test';
  process.env.ADMIN_TOKEN_SECRET ??= 'secreto-de-prueba-suficientemente-largo';
}

stubServerEnv();
