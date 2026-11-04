import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const demoMode = import.meta.env.VITE_NEXUS_DEMO_MODE !== 'false'

/**
 * Checks whether live Supabase backend credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '')
}

/**
 * Returns true if the client should communicate with Supabase backend.
 */
export function isBackendLive(): boolean {
  return isSupabaseConfigured() && !demoMode
}

/**
 * Singleton Supabase Client instance (or null if unconfigured).
 * Never uses or accepts service-role keys in frontend code.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

