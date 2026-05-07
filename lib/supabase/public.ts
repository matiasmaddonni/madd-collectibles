// Cookie-less Supabase client for public storefront reads. Calling cookies()
// inside a Server Component opts the route into dynamic rendering and breaks
// `revalidate` / ISR. Storefront queries don't need session-aware behavior, so
// we use a plain anon client here and reserve `lib/supabase/server.ts` for
// admin auth flows.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
