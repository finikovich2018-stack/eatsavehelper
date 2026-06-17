import { createClient } from '@supabase/supabase-js';

/** Lazy Supabase admin client (avoids stale env at module load) */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase admin env vars missing');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/** @deprecated Use getSupabaseAdmin() */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);
