import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente con service role — solo para operaciones administrativas del servidor (crear usuarios). */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
