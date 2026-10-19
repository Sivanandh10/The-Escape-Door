// Server Supabase clients. Owner: F2.
// - supabaseServer(): cookie-bound (auth/session) — Server Components inside <Suspense>,
//   Server Actions, Route Handlers. NEVER inside 'use cache' / generateStaticParams / sitemap.
// - publicClient(): cookie-less anon client — safe inside 'use cache', generateStaticParams,
//   generateMetadata and sitemap.ts (CONTRACTS §10.1 / §10.10).
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { effectivePerms, isRole, type Perm, type Role } from '@/lib/admin/permissions'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './env'
import { supabaseAdmin } from './admin'

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
  displayName: string | null
  /** null when signed in but not on the team */
  role: Role | null
  /** effective permissions (role defaults ∪ extras) */
  perms: Perm[]
  /** on the team (public.admins row, or ADMIN_EMAILS bootstrap) */
  isAdmin: boolean
  isSuperadmin: boolean
  /** the protected superadmin row (can't be edited or removed — enforced in the database) */
  isProtected: boolean
  /** 0002_roles.sql not applied yet: the old owner row is treated as full access */
  legacy?: boolean
  /** ADMIN_EMAILS bootstrap (no admins row, no superadmin exists yet) */
  bootstrap?: boolean
}

const NOT_MEMBER = (userId: string, email: string | null): AdminSession => ({
  userId, email, displayName: null, role: null, perms: [], isAdmin: false, isSuperadmin: false, isProtected: false,
})

function bootstrapEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

/** true when no superadmin row exists yet (service role; false when it can't tell). */
async function noSuperadminYet(): Promise<boolean> {
  try {
    const sa = supabaseAdmin()
    if (!sa) return false
    const { count, error } = await sa.from('admins').select('user_id', { count: 'exact', head: true }).eq('role', 'superadmin')
    return !error && count === 0
  } catch {
    return false
  }
}

/**
 * Team membership for a signed-in user. The public.admins row is the source of truth (role +
 * extra permissions). ADMIN_EMAILS never blocks a member — it only bootstraps a superadmin when the
 * email has no row AND no superadmin exists yet. The real gate is RLS (public.has_perm()).
 */
export async function resolveAdminSession(sb: SupabaseClient, userId: string, email: string | null): Promise<AdminSession> {
  const { data, error } = await sb
    .from('admins')
    .select('role, permissions, is_protected, display_name, email')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // Migration 0002 not applied yet → old single-owner model: any admins row = full access.
    if (error.code === '42703' || /column .* does not exist/i.test(error.message)) {
      const { data: isAdminRpc } = await sb.rpc('is_admin')
      if (isAdminRpc !== true) return NOT_MEMBER(userId, email)
      return {
        userId, email, displayName: null, role: 'superadmin', perms: effectivePerms('superadmin'),
        isAdmin: true, isSuperadmin: true, isProtected: false, legacy: true,
      }
    }
    return NOT_MEMBER(userId, email)
  }

  if (!data) {
    if (email && bootstrapEmails().includes(email.toLowerCase()) && (await noSuperadminYet())) {
      return {
        userId, email, displayName: null, role: 'superadmin', perms: effectivePerms('superadmin'),
        isAdmin: true, isSuperadmin: true, isProtected: false, bootstrap: true,
      }
    }
    return NOT_MEMBER(userId, email)
  }

  const row = data as { role?: unknown; permissions?: unknown; is_protected?: unknown; display_name?: unknown; email?: unknown }
  const role: Role = isRole(row.role) ? row.role : 'viewer'
  const extras = Array.isArray(row.permissions) ? row.permissions.filter((p): p is string => typeof p === 'string') : []
  return {
    userId,
    email: email ?? (typeof row.email === 'string' ? row.email : null),
    displayName: typeof row.display_name === 'string' && row.display_name.trim() ? row.display_name : null,
    role,
    perms: effectivePerms(role, extras),
    isAdmin: true,
    isSuperadmin: role === 'superadmin',
    isProtected: row.is_protected === true,
  }
}

/**
 * Who is signed in and what may they do? Returns null when signed out or Supabase is unconfigured.
 * Reads cookies → call inside <Suspense> / actions / route handlers. Memoised per request.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  try {
    const sb = await supabaseServer()
    if (!sb) return null
    const { data } = await sb.auth.getClaims()
    const claims = data?.claims as { sub?: string; email?: string } | undefined
    if (!claims?.sub) return null
    return await resolveAdminSession(sb, claims.sub, claims.email ?? null)
  } catch {
    return null
  }
})
