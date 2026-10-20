// Customer-auth helpers shared by server and client (pure — no Supabase, no cookies). Owner: AUTH.
import type { Customer } from './contract'

/** MyAnimeList-only accounts get a synthetic, never-mailed address on this domain (MAL doesn't share emails). */
export const SYNTHETIC_EMAIL_DOMAIN = 'users.the-escape-door.local'
export const malSyntheticEmail = (malId: number | string) => `mal-${malId}@${SYNTHETIC_EMAIL_DOMAIN}`
export const isSyntheticEmail = (email: string | null | undefined) =>
  !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)

/** A real, contactable email (null for MAL-only synthetic addresses). */
export const contactEmail = (email: string | null | undefined) => (email && !isSyntheticEmail(email) ? email : null)

/** Only same-site relative paths survive a login round-trip ("/product/x?y" ok; "//evil.com", "https://…" → fallback). */
export function safeNext(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw) return fallback
  const s = String(raw).trim()
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\') || /[\r\n]/.test(s)) return fallback
  if (s.startsWith('/api/') || s.startsWith('/auth/') || s.startsWith('/admin')) return fallback
  return s.slice(0, 512)
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
