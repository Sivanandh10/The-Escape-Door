// Customer-auth helpers shared by server and client (pure — no Supabase, no cookies). Owner: AUTH.
import type { Customer } from './contract'

/** MyAnimeList-only accounts get a synthetic, never-mailed address on this domain (MAL doesn't share emails). */
export const SYNTHETIC_EMAIL_DOMAIN = 'users.the-escape-door.local'
/** `nonce` must be unguessable (server-side random) so nobody can pre-register the address a MAL login will use. */
export const malSyntheticEmail = (malId: number | string, nonce: string) =>
  `mal-${malId}-${nonce.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)}@${SYNTHETIC_EMAIL_DOMAIN}`
export const isSyntheticEmail = (email: string | null | undefined) =>
  !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)

/** A real, contactable email (null for MAL-only synthetic addresses). */
export const contactEmail = (email: string | null | undefined) => (email && !isSyntheticEmail(email) ? email : null)

/** Only same-site relative paths survive a login round-trip ("/product/x?y" ok; "//evil.com", "https://…" → fallback). */
export function safeNext(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw) return fallback
  const s = String(raw).trim()
  // control chars (TAB/CR/LF get stripped by the URL parser, so "/<TAB>/evil.com" would become "//evil.com") and backslashes
  if (!s.startsWith('/') || /[\u0000-\u001F\u007F\\]/.test(s)) return fallback
  let out: string
  try {
    const base = 'https://x.invalid'
    const u = new URL(s, base)
    if (u.origin !== base) return fallback
    out = u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
  if (!out.startsWith('/') || out.startsWith('//')) return fallback
  if (out.startsWith('/api/') || out.startsWith('/auth/') || out.startsWith('/admin')) return fallback
  return out.length > 512 ? fallback : out
}

type Meta = Record<string, unknown> | null | undefined
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Display name / avatar from an OAuth user_metadata blob (Google: full_name/name/avatar_url/picture). */
export function metaName(meta: Meta): string | null {
  return str(meta?.full_name) ?? str(meta?.name) ?? str(meta?.display_name) ?? null
}
export function metaAvatar(meta: Meta): string | null {
  return str(meta?.avatar_url) ?? str(meta?.picture) ?? null
}

export interface ProfileBits {
  name?: string | null
  phone?: string | null
  avatar_url?: string | null
}

/** Merge the auth user, the profile row and the MAL link into the CONTRACT Customer. */
export function toCustomer(
  user: { id: string; email?: string | null; user_metadata?: Meta },
  profile: ProfileBits | null | undefined,
  malUsername: string | null | undefined,
): Customer {
  return {
    id: user.id,
    email: user.email ?? '',
    name: str(profile?.name) ?? metaName(user.user_metadata) ?? (malUsername || null),
    avatarUrl: str(profile?.avatar_url) ?? metaAvatar(user.user_metadata),
    phone: str(profile?.phone),
    malUsername: malUsername || null,
  }
}

/** "Sivanandh" → "S", "" → "?" — avatar fallback letter. */
export function initialOf(c: Pick<Customer, 'name' | 'email'> | null): string {
  const s = (c?.name || contactEmail(c?.email) || '?').trim()
  return (s[0] ?? '?').toUpperCase()
}

export const firstName = (c: Pick<Customer, 'name' | 'email'> | null) =>
  (c?.name?.split(/\s+/)[0] || contactEmail(c?.email)?.split('@')[0] || 'friend').slice(0, 24)
