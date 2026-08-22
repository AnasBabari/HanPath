import type { SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export async function getSupabaseClientAsync(): Promise<SupabaseClient | null> {
  if (supabase) return supabase;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return null;

    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    return supabase;
  })();

  return initPromise;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}
