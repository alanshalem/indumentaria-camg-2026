import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config/env';

let client: SupabaseClient | null = null;

/**
 * Cliente con `service_role`: sortea RLS y NUNCA debe salir del servidor.
 * Singleton perezoso para reusar el socket entre invocaciones calientes.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { supabaseUrl, supabaseServiceRoleKey } = getConfig();
  client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'camg-api' } },
  });
  return client;
}
