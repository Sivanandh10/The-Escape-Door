// Recommendation engine (pure, deterministic — no randomness). Owner: AUTH.
// Inputs are real signals only: the shopper's recent product views, cart + wishlist product ids and (optionally)
// their imported MyAnimeList list. No signals → empty rows (the UI then shows a designed empty state, never filler).
import type { Collection, Product } from '@/lib/types'
import { makeMapper } from './mal-map'
import type { AnimeRef, MalAnime, MalSnapshotStats, MalSuggestion, RecentView, RecsPayload, SuggestionRef, WatchedRow } from './types'
import { EMPTY_RECS } from './types'

export interface RecsInput {
  products: Product[]
  collections: Collection[]
  views: RecentView[]
  /** product ids in the cart / wishlist (client-provided hints; only used to rank, never trusted for anything else) */
  signalIds?: string[]
  /** product slug to leave out (the page being viewed) */
  exclude?: string | null
  mal?: { username: string; syncedAt: string | null; list: MalAnime[]; suggestions: MalSuggestion[]; stats: MalSnapshotStats | null } | null
  limits?: { recent?: number; picks?: number; watchedRows?: number; perRow?: number }
}

const DAY = 86_400_000

/** Weight of a MAL entry as a taste signal: watching > high score completed > rest. */
function animeWeight(a: MalAnime): number {
  if (a.status === 'dropped') return 0
  let w = 0
  if (a.status === 'watching') w += 3
  if (a.status === 'completed') w += 2
  if (a.status === 'on_hold') w += 1
  if (a.status === 'plan_to_watch') w += 0.5
  if (a.score >= 9) w += 3
  else if (a.score >= 7) w += 2
  else if (a.score >= 5) w += 0.5
  return w
}

const typeRank: Partial<Record<Product['type'], number>> = { tshirt: 3, hoodie: 3, poster: 2, polaroid: 1.5, keychain: 1, badge: 1 }

export function buildRecs(input: RecsInput): RecsPayload {
  const { products, collections, views, signalIds = [], exclude, mal } = input
  const L = { recent: 8, picks: 8, watchedRows: 3, perRow: 4, ...input.limits }
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const byId = new Map(products.map((p) => [p.id, p]))
  const colBySlug = new Map(collections.map((c) => [c.slug, c]))
  const available = (p: Product | undefined): p is Product => !!p && p.stock !== 'out' && p.slug !== exclude

  // ---- recently viewed (newest first)
  const sortedViews = [...views].sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
  const recent = sortedViews.map((v) => bySlug.get(v.slug)).filter((p): p is Product => !!p && p.slug !== exclude).slice(0, L.recent)

  // ---- taste profile: collection + type weights
  const colW = new Map<string, number>()
  const typeW = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, w: number) => m.set(k, (m.get(k) ?? 0) + w)
  const now = Date.now()
  for (const v of sortedViews.slice(0, 30)) {
    const p = bySlug.get(v.slug)
    if (!p) continue
    const age = Math.max(0, now - Date.parse(v.viewedAt || '')) / DAY
    const recency = Number.isFinite(age) ? 1 / (1 + age / 7) : 0.3 // halves after ~a week
    const w = recency * (1 + Math.min(4, v.count - 1) * 0.25)
    add(colW, p.collection, 3 * w)
    add(typeW, p.type, 1.5 * w)
  }
  for (const id of signalIds.slice(0, 60)) {
    const p = byId.get(id)
    if (!p) continue
    add(colW, p.collection, 3)
    add(typeW, p.type, 1)
  }

  // ---- MyAnimeList → collections
  const mapper = makeMapper(collections)
  const watched: WatchedRow[] = []
  const unmapped: AnimeRef[] = []
  const malCols = new Map<string, MalAnime>()
  if (mal?.list?.length) {
    const ranked = [...mal.list]
      .filter((a) => animeWeight(a) > 0)
      .sort((a, b) => animeWeight(b) - animeWeight(a) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    const seenUnmapped = new Set<string>()
    for (const a of ranked) {
      const slug = mapper.map(a)
      if (slug) {
        add(colW, slug, animeWeight(a))
        if (!malCols.has(slug)) malCols.set(slug, a)
      } else if ((a.status === 'watching' || a.score >= 7) && unmapped.length < 6) {
        // group seasons of one show under its first title word-run
        const key = a.title.toLowerCase().split(/[:(]/)[0].replace(/\s+(season|part|movie|film)\b.*$/, '').trim()
        if (!seenUnmapped.has(key)) {
          seenUnmapped.add(key)
          unmapped.push({ id: a.id, title: a.en || a.title, picture: a.picture })
        }
      }
    }
    for (const [slug, a] of malCols) {
      if (watched.length >= L.watchedRows) break
      const c = colBySlug.get(slug)
      if (!c) continue
      const row = products
        .filter((p) => p.collection === slug && available(p))
        .sort((x, y) => (typeRank[y.type] ?? 0) + (y.featured ? 1 : 0) - ((typeRank[x.type] ?? 0) + (x.featured ? 1 : 0)) || x.slug.localeCompare(y.slug))
        .slice(0, L.perRow)
      if (row.length) watched.push({ anime: { id: a.id, title: a.en || a.title, picture: a.picture }, collection: { slug: c.slug, name: c.name, jp: c.jp }, products: row })
    }
  }

  // ---- picks: score every product not already seen / in the cart
  const seen = new Set([...sortedViews.map((v) => v.slug)])
  const inSignals = new Set(signalIds)
  const scored = products
    .filter((p) => available(p) && !seen.has(p.slug) && !inSignals.has(p.id))
    .map((p) => ({ p, s: (colW.get(p.collection) ?? 0) + (typeW.get(p.type) ?? 0) + (p.featured ? 0.4 : 0) + (p.dropOfWeek ? 0.3 : 0) }))
    .filter((x) => x.s > 0.5)
    .sort((a, b) => b.s - a.s || a.p.slug.localeCompare(b.p.slug))
  // keep variety: max 3 per collection
  const perCol = new Map<string, number>()
  const picks: Product[] = []
  for (const { p } of scored) {
    const n = perCol.get(p.collection) ?? 0
    if (n >= 3) continue
    perCol.set(p.collection, n + 1)
    picks.push(p)
    if (picks.length >= L.picks) break
  }
  const topCol = [...colW.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const pickReason = picks.length ? (topCol && colBySlug.get(topCol) ? `Because you’re into ${colBySlug.get(topCol)!.name}` : 'Picked from what you browsed') : null

  // ---- MAL suggestions
  const suggestions: SuggestionRef[] = (mal?.suggestions ?? []).slice(0, 12).map((s) => ({
    id: s.id,
    title: s.en || s.title,
    picture: s.picture,
    mean: s.mean,
    genres: s.genres.slice(0, 3),
    collection: mapper.map(s),
  }))

  const beyond = unmapped.length
    ? products.filter((p) => available(p) && colBySlug.get(p.collection)?.group === 'beyond').slice(0, 4)
    : []

  return {
    ...EMPTY_RECS,
    signedIn: true,
    recent,
    picks,
    pickReason,
    watched,
    unmapped,
    beyond,
    suggestions,
    mal: mal ? { username: mal.username, syncedAt: mal.syncedAt, stats: mal.stats ?? null } : null,
  }
}
