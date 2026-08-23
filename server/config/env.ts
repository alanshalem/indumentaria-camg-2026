/**
 * Configuración del servidor. Se lee una sola vez y falla temprano (fail-fast):
 * un deploy mal configurado se detecta en el primer request, no a mitad de un pedido.
 * Ninguna de estas variables lleva prefijo VITE_, así que nunca llega al bundle del browser.
 */
export interface ServerConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  adminPassword: string;
  tokenSecret: string;
  sessionTtlMs: number;
  imageBucket: string;
  isProduction: boolean;
  email: EmailConfig;
}

/**
 * Config de mails. Es TODA opcional a propósito: sin `RESEND_API_KEY` la app
 * funciona igual y los envíos quedan registrados como omitidos. Un pedido
 * jamás puede fallar porque el proveedor de mail no esté configurado.
 */
export interface EmailConfig {
  apiKey: string | null;
  from: string;
  replyTo: string | null;
  /** Base absoluta para el logo y los links del mail. */
  siteUrl: string;
}

export class ConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Faltan variables de entorno del servidor: ${missing.join(', ')}. ` +
        'Configuralas en Vercel (Project Settings → Environment Variables) o en .env.local.',
    );
    this.name = 'ConfigError';
  }
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_BUCKET = 'product-images';
const DEFAULT_SITE_URL = 'https://indumentaria-camg-2026.vercel.app';

const read = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
};

let cached: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (cached) return cached;

  const supabaseUrl = read('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseServiceRoleKey = read('SUPABASE_SERVICE_ROLE_KEY');
  const adminPassword = read('ADMIN_PASSWORD');
  const tokenSecret = read('ADMIN_TOKEN_SECRET');

  const missing = [
    ['SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', supabaseServiceRoleKey],
    ['ADMIN_PASSWORD', adminPassword],
    ['ADMIN_TOKEN_SECRET', tokenSecret],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key as string);

  if (missing.length) throw new ConfigError(missing);

  cached = {
    supabaseUrl: supabaseUrl!,
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
    adminPassword: adminPassword!,
    tokenSecret: tokenSecret!,
    sessionTtlMs: SESSION_TTL_MS,
    imageBucket: read('SUPABASE_IMAGE_BUCKET') ?? DEFAULT_BUCKET,
    isProduction: process.env.NODE_ENV === 'production',
    email: {
      apiKey: read('RESEND_API_KEY') ?? null,
      // El default de Resend sólo entrega a la casilla dueña de la cuenta:
      // sirve para revisar los mails antes de tener un dominio verificado.
      from: read('EMAIL_FROM') ?? 'CAMG <onboarding@resend.dev>',
      replyTo: read('EMAIL_REPLY_TO') ?? null,
      siteUrl: (read('PUBLIC_SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/+$/, ''),
    },
  };

  return cached;
}
