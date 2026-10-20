// Customer auth — SERVER side (owner: AUTH). Implements CONTRACT `getCustomer()`.
// Reads cookies → call only inside <Suspense>, Server Actions or Route Handlers (never inside 'use cache').
import { cache } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Customer } from './contract'
import { metaAvatar, metaName, toCustomer } from './shared'

export type { Customer } from './contract'

/** The verified auth user for this request (Auth server round-trip), or null. Memoised per request. */
export const getAuthUser = cache(async (): Promise<{ sb: SupabaseClient; user: User } | null> => {
  try {
    const sb = await supabaseServer()
    if (!sb) return null
    const { data, error } = await sb.auth.getUser()
    if (error || !data.user) return null
    return { sb, user: data.user }
  } catch {
    return null
  }
})

/** CONTRACT: current customer from the Supabase session cookies, or null. Never throws. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const auth = await getAuthUser()
  if (!auth) return null
  const { sb, user } = auth
  const [profile, mal] = await Promise.all([
    sb.from('profiles').select('name, phone, avatar_url').eq('id', user.id).maybeSingle(),
    sb.from('mal_accounts').select('mal_username').eq('user_id', user.id).maybeSingle(),
  ])
  return toCustomer(
    user,
    profile.error ? null : profile.data,
    mal.error ? null : (mal.data as { mal_username?: string } | null)?.mal_username ?? null,
  )
})

/**
 * true when this auth user is on the team (public.admins). Staff never get a profile automatically.
 * Uses the service role when present, else the user's own cookie client (0001 policy "admins read self").
 * Fails CLOSED: if we can't tell, treat as staff (no profile is created, no MAL link is made).
 */
export async function isStaff(userId: string): Promise<boolean> {
  try {
    const sb = supabaseAdmin() ?? (await supabaseServer())
    if (!sb) return false // Supabase not configured at all → there is no team table to be on
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
    if (error) return true
    return !!data
  } catch {
    return true
  }
}

/**
 * Create the shopper's profile on first login (idempotent: never overwrites what they edited).
 * Skips team members. Uses the service role when available, else the user's own client (RLS: insert own).
 */
export async function ensureProfile(user: Pick<User, 'id' | 'email' | 'user_metadata'>, extra?: { name?: string | null; avatarUrl?: string | null }): Promise<'created' | 'exists' | 'staff' | 'skipped'> {
  try {
    if (await isStaff(user.id)) return 'staff'
    const sa = supabaseAdmin()
    const sb = sa ?? (await supabaseServer())
    if (!sb) return 'skipped'
    const { data: existing } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (existing) {
      // last_seen_at / avatar_url are server-written only (0009: browsers may only write name + phone)
      if (sa) await sa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
      return 'exists'
    }
    const name = (extra?.name ?? metaName(user.user_metadata))?.slice(0, 80) ?? null
    const avatar = (extra?.avatarUrl ?? metaAvatar(user.user_metadata))?.slice(0, 600) ?? null
    const row: Record<string, unknown> = sa ? { id: user.id, name, avatar_url: avatar, last_seen_at: new Date().toISOString() } : { id: user.id, name }
    const { error } = await sb.from('profiles').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
    return error ? 'skipped' : 'created'
  } catch {
    return 'skipped'
  }
}

/** Public origin of this request (Netlify sits behind a proxy → prefer x-forwarded-host). */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url)
  if (process.env.NODE_ENV === 'development') return url.origin
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  return host ? `${proto}://${host}` : url.origin
}
