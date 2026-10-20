// MyAnimeList OAuth2 + API v2 — SERVER ONLY (owner: AUTH). MAL is not a Supabase provider, so the site runs the
// OAuth dance itself: PKCE with code_challenge_method=plain (the only method MAL supports).
// Env: MAL_CLIENT_ID, MAL_CLIENT_SECRET (Netlify env). Optional MAL_REDIRECT_URI (must equal the URL registered at
// https://myanimelist.net/apiconfig; default `${origin}/api/auth/mal/callback`).
import { randomBytes } from 'node:crypto'
import type { MalAnime, MalSnapshotStats, MalSuggestion } from '@/lib/recs/types'

const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize'
const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token'
const API = 'https://api.myanimelist.net/v2'

export const MAL_COOKIE = { verifier: 'ted_mal_v', state: 'ted_mal_s', next: 'ted_mal_n' } as const
export const MAL_COOKIE_PATH = '/api/auth/mal'

export function malConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.MAL_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.MAL_CLIENT_SECRET ?? '').trim()
  return clientId ? { clientId, clientSecret } : null
}
export const isMalConfigured = () => malConfig() !== null

export function malRedirectUri(origin: string): string {
  return (process.env.MAL_REDIRECT_URI ?? '').trim() || `${origin}/api/auth/mal/callback`
}

/** 86-char verifier from the unreserved set [A-Za-z0-9-_] (RFC 7636: 43–128). */
export const newVerifier = () => randomBytes(64).toString('base64url')
export const newState = () => randomBytes(24).toString('base64url')

export function authorizeUrl(opts: { clientId: string; verifier: string; state: string; redirectUri: string }): string {
  const u = new URL(AUTH_URL)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', opts.clientId)
  u.searchParams.set('code_challenge', opts.verifier) // plain: challenge === verifier
  u.searchParams.set('code_challenge_method', 'plain')
  u.searchParams.set('state', opts.state)
  u.searchParams.set('redirect_uri', opts.redirectUri)
  return u.toString()
}

export interface MalTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

async function tokenRequest(body: Record<string, string>): Promise<MalTokens> {
  const cfg = malConfig()
  if (!cfg) throw new MalError('not-configured')
  const form = new URLSearchParams({ client_id: cfg.clientId, ...(cfg.clientSecret ? { client_secret: cfg.clientSecret } : {}), ...body })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new MalError(res.status === 400 || res.status === 401 ? 'token-rejected' : 'token-failed', res.status)
  const data = (await res.json()) as Partial<MalTokens>
  if (!data.access_token) throw new MalError('token-failed')
  return { access_token: data.access_token, refresh_token: data.refresh_token ?? '', expires_in: data.expires_in ?? 3600, token_type: data.token_type ?? 'Bearer' }
}

export const exchangeCode = (code: string, verifier: string, redirectUri: string) =>
  tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri })
export const refreshTokens = (refreshToken: string) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })

export class MalError extends Error {
  constructor(public code: string, public status?: number) {
    super(`mal:${code}${status ? `:${status}` : ''}`)
  }
}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new MalError(res.status === 401 ? 'api-unauthorized' : 'api-failed', res.status)
  return (await res.json()) as T
}

interface MalNode {
  id: number
  title: string
  main_picture?: { medium?: string; large?: string }
  alternative_titles?: { synonyms?: string[]; en?: string; ja?: string }
  genres?: Array<{ id: number; name: string }>
  mean?: number
}
interface MalListStatus {
  status?: string
  score?: number
  num_episodes_watched?: number
  updated_at?: string
}

export interface MalUser {
  id: number
  name: string
  picture?: string
}

export async function fetchMe(token: string): Promise<MalUser> {
  const me = await api<{ id: number; name: string; picture?: string }>('/users/@me', token)
  if (!me?.id || !me?.name) throw new MalError('api-failed')
  return { id: me.id, name: me.name, picture: me.picture }
}

const SNAPSHOT_MAX = 400

function compactNode(n: MalNode) {
  return {
    id: n.id,
    title: String(n.title ?? '').slice(0, 160),
    en: n.alternative_titles?.en ? String(n.alternative_titles.en).slice(0, 160) : null,
    synonyms: (n.alternative_titles?.synonyms ?? []).slice(0, 3).map((s) => String(s).slice(0, 120)),
    genres: (n.genres ?? []).slice(0, 5).map((g) => g.name),
    mean: typeof n.mean === 'number' ? n.mean : null,
    picture: n.main_picture?.medium ?? null,
  }
}

/** The user's anime list (most recently updated first), compacted for storage. */
export async function fetchAnimeList(token: string): Promise<{ list: MalAnime[]; stats: MalSnapshotStats }> {
  const fields = 'list_status,genres,mean,alternative_titles'
  const out: MalAnime[] = []
  let url: string | null = `/users/@me/animelist?fields=${fields}&limit=1000&sort=list_updated_at`
  // at most 2 pages (2000 entries) — we keep the newest SNAPSHOT_MAX anyway
  for (let page = 0; url && page < 2 && out.length < SNAPSHOT_MAX; page++) {
    const res: { data?: Array<{ node: MalNode; list_status?: MalListStatus }>; paging?: { next?: string } } = await api(url, token)
    for (const row of res.data ?? []) {
      if (!row?.node?.id) continue
      out.push({
        ...compactNode(row.node),
        status: (row.list_status?.status as MalAnime['status']) ?? null,
        score: typeof row.list_status?.score === 'number' ? row.list_status.score : 0,
        episodes: row.list_status?.num_episodes_watched ?? 0,
        updatedAt: row.list_status?.updated_at ?? null,
      })
    }
    const next = res.paging?.next
    url = next && next.startsWith(API) ? next.slice(API.length) : null
  }
  const list = out.slice(0, SNAPSHOT_MAX)
  const count = (s: string) => list.filter((a) => a.status === s).length
  const scored = list.filter((a) => a.score > 0)
  const stats: MalSnapshotStats = {
    total: list.length,
    watching: count('watching'),
    completed: count('completed'),
    planToWatch: count('plan_to_watch'),
    onHold: count('on_hold'),
    dropped: count('dropped'),
    meanScore: scored.length ? Math.round((scored.reduce((a, b) => a + b.score, 0) / scored.length) * 100) / 100 : null,
  }
  return { list, stats }
}

/** MAL's own "you might like" suggestions for this user. */
export async function fetchSuggestions(token: string): Promise<MalSuggestion[]> {
  const res = await api<{ data?: Array<{ node: MalNode }> }>('/anime/suggestions?limit=20&fields=mean,genres,alternative_titles', token)
  return (res.data ?? []).filter((r) => r?.node?.id).map((r) => compactNode(r.node))
}

/** Everything we import on connect / re-sync. Suggestions are best-effort (an empty list never fails the sync). */
export async function importMal(token: string) {
  const [me, list, suggestions] = await Promise.all([
    fetchMe(token),
    fetchAnimeList(token),
    fetchSuggestions(token).catch(() => [] as MalSuggestion[]),
  ])
  return { me, list: list.list, stats: list.stats, suggestions }
}
