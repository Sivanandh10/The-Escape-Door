'use client'
// Browser Supabase client (anon/publishable key, RLS applies). Owner: F2.
// Returns null when Supabase is not configured — callers show a designed fallback.
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './env'

export { isSupabaseConfigured }

let browser: SupabaseClient | null = null

export function supabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!browser) browser = createBrowserClient(supabaseUrl(), supabaseAnonKey())
  return browser
}

/** Alias matching Supabase's docs naming. */
export const createClient = supabaseBrowser
