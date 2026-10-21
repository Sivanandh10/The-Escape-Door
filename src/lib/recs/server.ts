// Recommendations — SERVER (owner: AUTH, extended by RECS). Reads the signed-in shopper's own rows under RLS
// (recent_views, own orders, mal_accounts minus the token, customer_signals = the stored session trail) + the cached
// catalogue + the cached item graph, then runs the pure engine.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCollections, getProducts } from '@/lib/data/repo'
import { buildRecs, type StoredSignal } from './engine'
import { getItemGraph } from './graph'
import type { MalAnime, MalSnapshotStats, MalSuggestion, RecentView, RecsPayload } from './types'

export interface MalRow {
  mal_id: number
  mal_username: string
  picture: string | null
  anime_snapshot: MalAnime[] | null
  suggestions: MalSuggestion[] | null
  stats: MalSnapshotStats | null
  synced_at: string | null
}

/** Columns a browser/user client may select from mal_accounts (never refresh_token). */
export const MAL_PUBLIC_COLS = 'mal_id, mal_username, picture, anime_snapshot, suggestions, stats, synced_at'

export async function loadViews(sb: SupabaseClient, userId: string, limit = 60): Promise<RecentView[]> {
  const { data, error } = await sb
    .from('recent_views')
    .select('product_slug, viewed_at, view_count')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((r) => ({ slug: r.product_slug as string, viewedAt: r.viewed_at as string, count: (r.view_count as number) ?? 1 }))
}

/** Product refs (slug, else id) from the shopper's own past orders (RLS "orders own read"), newest first. */
export async function loadOrderRefs(sb: SupabaseClient, userId: string, limit = 30): Promise<string[]> {
  const { data, error } = await sb
    .from('orders')
    .select('items, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !Array.isArray(data)) return []
  const out: string[] = []
  for (const o of data as Array<{ items: unknown; status: string | null }>) {
    if (o.status === 'cancelled' || !Array.isArray(o.items)) continue
    for (const it of o.items as Array<{ slug?: unknown; productId?: unknown }>) {
      const ref = typeof it?.slug === 'string' ? it.slug : typeof it?.productId === 'string' ? it.productId : null
      if (ref && !out.includes(ref)) out.push(ref)
    }
  }
  return out.slice(0, 80)
}

const SIGNAL_KINDS: ReadonlySet<string> = new Set(['search', 'collection', 'type', 'cart', 'wishlist', 'view'])

/** The shopper's stored trail (customer_signals, migration 0012), newest first. Table missing / error → []. */
export async function loadSignals(sb: SupabaseClient, userId: string, limit = 300): Promise<StoredSignal[]> {
  const { data, error } = await sb
    .from('customer_signals')
    .select('kind, value, weight, at')
    .eq('user_id', userId)
    .order('at', { ascending: false })
    .limit(limit)
  if (error || !Array.isArray(data)) return []
  const out: StoredSignal[] = []
  for (const r of data as Array<{ kind: string; value: string; weight: number | null; at: string }>) {
    const at = Date.parse(r.at)
    if (!SIGNAL_KINDS.has(r.kind) || typeof r.value !== 'string' || !Number.isFinite(at)) continue
    out.push({ kind: r.kind as StoredSignal['kind'], value: r.value, weight: r.weight, at })
  }
  return out
}

export async function loadMal(sb: SupabaseClient, userId: string): Promise<MalRow | null> {
  const { data, error } = await sb.from('mal_accounts').select(MAL_PUBLIC_COLS).eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return data as unknown as MalRow
}

export async function recsForUser(
  sb: SupabaseClient,
  userId: string,
  opts: { exclude?: string | null; signalIds?: string[]; limits?: Parameters<typeof buildRecs>[0]['limits'] } = {},
): Promise<RecsPayload> {
  const [products, collections, views, mal, orderIds, graph, stored] = await Promise.all([
    getProducts(),
    getCollections(),
    loadViews(sb, userId),
    loadMal(sb, userId),
    loadOrderRefs(sb, userId).catch(() => []),
    getItemGraph(),
    loadSignals(sb, userId).catch(() => []),
  ])
  return buildRecs({
    products,
    collections,
    views,
    orderIds,
    graph,
    stored,
    signalIds: opts.signalIds,
    exclude: opts.exclude,
    limits: opts.limits,
    mal: mal
      ? {
          username: mal.mal_username,
          syncedAt: mal.synced_at,
          list: Array.isArray(mal.anime_snapshot) ? mal.anime_snapshot : [],
          suggestions: Array.isArray(mal.suggestions) ? mal.suggestions : [],
          stats: mal.stats ?? null,
        }
      : null,
  })
}
