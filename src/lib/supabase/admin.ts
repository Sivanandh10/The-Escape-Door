// Service-role Supabase client — SERVER ONLY (route handlers, server actions, Netlify Functions).
// Bypasses RLS. Never import from a 'use client' file. Owner: F2.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseAdminConfigured, isSupabaseConfigured, supabaseServiceKey, supabaseUrl } from './env'

export { isSupabaseConfigured, isSupabaseAdminConfigured }

let admin: SupabaseClient | null = null

/** null when the URL or service key is missing (or when called in a browser). */
export function supabaseAdmin(): SupabaseClient | null {
  if (typeof window !== 'undefined') throw new Error('supabaseAdmin() is server-only')
  if (!isSupabaseAdminConfigured()) return null
  if (!admin) {
    admin = createClient(supabaseUrl(), supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return admin
}
