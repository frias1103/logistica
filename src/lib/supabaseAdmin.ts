import { createClient } from "@supabase/supabase-js";

// Este cliente usa la SERVICE_ROLE_KEY y solo se usa dentro de rutas API
// (nunca en el navegador), porque tiene permisos totales sobre la base de datos.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
