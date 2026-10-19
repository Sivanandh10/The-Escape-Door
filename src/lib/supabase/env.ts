// Supabase env resolution. Owner: F2.
// Accepts both the current key names (publishable / secret) and the legacy ones (anon / service_role).
// NEXT_PUBLIC_* are written literally so Next inlines them into client bundles.

export function supabaseUrl(): string {
  // Tolerate a pasted Data API URL (…supabase.co/rest/v1/) or trailing slashes.
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

/** Public (anon / publishable) key — safe in the browser; RLS applies. */
export function supabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
}

/** Service-role / secret key — server only, bypasses RLS. Empty in the browser by design. */
export function supabaseServiceKey(): string {
  if (typeof window !== 'undefined') return ''
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
}

/** true when URL + public key are set (catalogue reads, auth). */
export function isSupabaseConfigured(): boolean {
  const url = supabaseUrl()
  return /^https?:\/\//.test(url) && supabaseAnonKey().length > 0
}

/** true when the service key is also set (lead inserts, signed uploads, analytics writes). */
export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && supabaseServiceKey().length > 0
}
