'use server'
// Customer account Server Actions (owner: AUTH). Every action re-verifies the session server-side (getUser →
// Auth server) and validates input with zod. Writes to the shopper's own rows go through their RLS-bound client;
// MyAnimeList tokens are only touched with the service role.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { contactEmail, isSyntheticEmail } from './shared'
import { getAuthUser } from './customer-server'
import { MalError, importMal, isMalConfigured, refreshTokens } from './mal'

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; field?: string }

const SIGNED_OUT: ActionResult<never> = { ok: false, error: 'You’re signed out. Log in again.' }

// ---------------------------------------------------------------- profile
const ProfileInput = z.object({
  name: z.string().trim().max(80, 'Keep your name under 80 characters.'),
  phone: z
    .string()
    .trim()
    .max(24)
    .refine((v) => v === '' || /^\+?[\d\s-]{7,20}$/.test(v), 'Enter a phone number like +91 98765 43210.'),
})

export async function updateProfile(input: { name: string; phone: string }): Promise<ActionResult<{ name: string | null; phone: string | null }>> {
  const auth = await getAuthUser()
  if (!auth) return SIGNED_OUT
  const parsed = ProfileInput.safeParse(input)
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    return { ok: false, error: i?.message ?? 'Check the form.', field: String(i?.path[0] ?? '') }
  }
  const name = parsed.data.name || null
  const phone = parsed.data.phone ? parsed.data.phone.replace(/\s+/g, ' ') : null
  const { error } = await auth.sb.from('profiles').upsert({ id: auth.user.id, name, phone }, { onConflict: 'id' })
  if (error) return { ok: false, error: 'Couldn’t save right now. Please try again.' }
  return { ok: true, data: { name, phone } }
}

// ---------------------------------------------------------------- recently viewed
export async function clearRecentViews(): Promise<ActionResult> {
  const auth = await getAuthUser()
  if (!auth) return SIGNED_OUT
  const { error } = await auth.sb.from('recent_views').delete().eq('user_id', auth.user.id)
  return error ? { ok: false, error: 'Couldn’t clear your history. Try again.' } : { ok: true, data: null }
}

// ---------------------------------------------------------------- MyAnimeList
/** Re-import the shopper's MAL list with the stored refresh token (rotates the token). */
export async function syncMal(): Promise<ActionResult<{ syncedAt: string; total: number }>> {
  const auth = await getAuthUser()
  if (!auth) return SIGNED_OUT
  if (!isMalConfigured()) return { ok: false, error: 'MyAnimeList sync isn’t switched on yet.' }
  const sa = supabaseAdmin()
  if (!sa) return { ok: false, error: 'Server isn’t configured.' }
  const { data: row } = await sa.from('mal_accounts').select('refresh_token, synced_at').eq('user_id', auth.user.id).maybeSingle()
  if (!row) return { ok: false, error: 'Connect MyAnimeList first.' }
  if (row.synced_at && Date.now() - Date.parse(row.synced_at as string) < 60_000) {
    return { ok: false, error: 'Just synced — give it a minute.' }
  }
  if (!row.refresh_token) return { ok: false, error: 'Reconnect MyAnimeList to sync again.' }
  try {
    const tokens = await refreshTokens(row.refresh_token as string)
    const { me, list, stats, suggestions } = await importMal(tokens.access_token)
    const syncedAt = new Date().toISOString()
    const { error } = await sa
      .from('mal_accounts')
      .update({
        mal_username: me.name.slice(0, 64),
        picture: me.picture?.slice(0, 600) ?? null,
        refresh_token: tokens.refresh_token || row.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        anime_snapshot: list,
        suggestions,
        stats,
        synced_at: syncedAt,
      })
      .eq('user_id', auth.user.id)
    if (error) return { ok: false, error: 'Couldn’t save the sync. Try again.' }
    return { ok: true, data: { syncedAt, total: list.length } }
  } catch (e) {
    if (e instanceof MalError && e.code === 'token-rejected') {
      await sa.from('mal_accounts').update({ refresh_token: null }).eq('user_id', auth.user.id)
      return { ok: false, error: 'MyAnimeList logged us out. Reconnect to sync again.' }
    }
    return { ok: false, error: 'MyAnimeList isn’t answering. Try again in a minute.' }
  }
}

/** Unlink MAL (keeps the account). Refused for MAL-only accounts — that's their only way in. */
export async function unlinkMal(): Promise<ActionResult> {
  const auth = await getAuthUser()
  if (!auth) return SIGNED_OUT
  if (isSyntheticEmail(auth.user.email)) {
    return { ok: false, error: 'MyAnimeList is how you log in here, so it can’t be unlinked. Add Google or an email login first.' }
  }
  const sa = supabaseAdmin()
  if (!sa) return { ok: false, error: 'Server isn’t configured.' }
  const { error } = await sa.from('mal_accounts').delete().eq('user_id', auth.user.id)
  return error ? { ok: false, error: 'Couldn’t unlink right now.' } : { ok: true, data: null }
}

// ---------------------------------------------------------------- "Request merch for this anime" → lead
const RequestInput = z.object({
  title: z.string().trim().min(1).max(160),
  malId: z.number().int().positive().max(10_000_000).optional(),
})

export async function requestAnimeMerch(input: { title: string; malId?: number }): Promise<ActionResult> {
  const auth = await getAuthUser()
  if (!auth) return SIGNED_OUT
  const parsed = RequestInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Pick an anime first.' }
  const sa = supabaseAdmin()
  if (!sa) return { ok: false, error: 'Server isn’t configured.' }

  // one request per anime per shopper per day (cheap de-dupe against double taps)
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { data: dup } = await sa
    .from('leads')
    .select('id')
    .eq('kind', 'custom_request')
    .gte('created_at', since)
    .contains('payload', { type: 'anime_request', userId: auth.user.id, anime: parsed.data.title })
    .limit(1)
  if (dup?.length) return { ok: true, data: null }

  const { data: profile } = await auth.sb.from('profiles').select('name, phone').eq('id', auth.user.id).maybeSingle()
  const contact = (profile?.phone as string | null) || contactEmail(auth.user.email) || null
  const { error } = await sa.from('leads').insert({
    kind: 'custom_request',
    name: ((profile?.name as string | null) ?? null)?.slice(0, 80) ?? null,
    contact: contact?.slice(0, 120) ?? null,
    message: `Merch request for “${parsed.data.title}” (from their MyAnimeList).`.slice(0, 2000),
    payload: { type: 'anime_request', anime: parsed.data.title, malId: parsed.data.malId ?? null, userId: auth.user.id },
    status: 'new',
  })
  return error ? { ok: false, error: 'Couldn’t send the request. Try again.' } : { ok: true, data: null }
}
