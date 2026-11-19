import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function createSupabaseClient(
  config: SupabaseConfig,
  options?: Parameters<typeof createClient>[2],
): SupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_ANON_KEY. Revisa las variables de entorno.",
    );
  }
  return createClient(config.url, config.anonKey, options);
}
