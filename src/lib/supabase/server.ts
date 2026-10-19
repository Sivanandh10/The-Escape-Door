// Server Supabase clients. Owner: F2.
// - supabaseServer(): cookie-bound (auth/session) — Server Components inside <Suspense>,
//   Server Actions, Route Handlers. NEVER inside 'use cache' / generateStaticParams / sitemap.
// - publicClient(): cookie-less anon client — safe inside 'use cache', generateStaticParams,
//   generateMetadata and sitemap.ts (CONTRACTS §10.1 / §10.10).
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './env'

export { isSupabaseConfigured }

export async function supabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null
  const store = await cookies()
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          /* called during RSC render — proxy.ts refreshes the session */
        }
      },
    },
  })
}

let pub: SupabaseClient | null = null
/** Cookie-less anon client (RLS: public read of published catalogue rows). null if unconfigured. */
export function publicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!pub) {
    pub = createClient(supabaseUrl(), supabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return pub
}

export interface AdminSession {
  userId: string
  email: string | null
  isAdmin: boolean
}

/**
 * Who is signed in and are they an owner? Checks the `admins` table via is_admin() (the real
 * gate is RLS) and, optionally, the ADMIN_EMAILS allow-list. Returns null when signed out or
 * Supabase is unconfigured. Reads cookies → call inside <Suspense> / actions / route handlers.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const sb = await supabaseServer()
    if (!sb) return null
    const { data } = await sb.auth.getClaims()
    const claims = data?.claims as { sub?: string; email?: string } | undefined
    if (!claims?.sub) return null
    const email = claims.email ?? null
    const { data: isAdminRpc } = await sb.rpc('is_admin')
    const allow = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    const emailOk = allow.length === 0 || (email ? allow.includes(email.toLowerCase()) : false)
    return { userId: claims.sub, email, isAdmin: isAdminRpc === true && emailOk }
  } catch {
    return null
  }
}
