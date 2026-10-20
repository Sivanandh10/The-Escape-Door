// Recommendation engine (pure, deterministic — no randomness; pass `now` for reproducible output). Owner: RECS.
// Runs on the server (/api/recs, /api/auth/me/recs) and in node --test (src/lib/recs/engine.test.ts).
//
//   rankRecs(input)  — hybrid ranker used by every surface:
//     score = Σ weight[context][feature] · feature(product)            (every feature normalised to 0..1)
//             features: collection affinity · type affinity · co-purchase · co-view · popularity · newness ·
//                       MyAnimeList affinity · price-band fit · content similarity (to the anchor) · complement · search
//           − penalties (in cart · already bought · just viewed · price on request); out of stock is never returned
//     then MMR diversification (λ ≈ 0.72; max 2 per type in the top 6, collections spread), stable tie-break by slug.
//     Every result carries an explainable reason ("Because you viewed …", "Bought together", "Popular in …").
//   buildItemGraph() — item→item co-occurrence (orders + same-session product views) and 30-day popularity.
//   buildRecs()      — the signed-in payload for <ForYou variant="account"> (recent / picks / MAL rows), with
//                      hybrid picks + per-pick reasons. Payload shape unchanged (pickReasons is additive).
import type { Collection, Product, ProductType } from '@/lib/types'
import { makeMapper } from './mal-map'
import type { AnimeRef, MalAnime, MalSnapshotStats, MalSuggestion, RecentView, RecsPayload, SuggestionRef, WatchedRow } from './types'
import { EMPTY_RECS } from './types'

const DAY = 86_400_000

// ============================================================================ types
export type RecsContext = 'home' | 'product' | 'cart' | 'account' | 'shop'
export const RECS_CONTEXTS: RecsContext[] = ['home', 'product', 'cart', 'account', 'shop']

export type ReasonKind = 'viewed' | 'bought-together' | 'viewed-together' | 'similar' | 'watched' | 'complete' | 'popular' | 'new' | 'search' | 'cart' | 'wishlist'
export interface RecReason {
  kind: ReasonKind
  label: string
}

export type Feature = 'col' | 'type' | 'coBuy' | 'coView' | 'pop' | 'fresh' | 'mal' | 'price' | 'sim' | 'comp' | 'search'

export interface ScoredRec {
  product: Product
  score: number
  reason: RecReason
  /** weighted feature contributions (debug / tests) */
  parts: Partial<Record<Feature, number>>
}

/** Visitor signals. Product references may be ids or slugs (both resolve). */
export interface RecSignals {
  /** product views; `at` = epoch ms */
  views?: Array<{ slug: string; at: number; count?: number }>
  cart?: string[]
  wish?: string[]
  /** products bought before (ids or slugs) */
  orders?: string[]
  /** search terms typed in the shop, newest first */
  searches?: string[]
  /** MyAnimeList → collection affinity (already mapped) */
  mal?: Array<{ collection: string; weight: number; title: string }>
}

export interface ItemGraph {
  /** slug → neighbour slug → co-purchase strength (0..1, cosine-normalised, shrunk for rare pairs) */
  coBuy: Record<string, Record<string, number>>
  /** slug → neighbour slug → same-session co-view strength (0..1) */
  coView: Record<string, Record<string, number>>
  /** slug → 0..1 (log-scaled views + add-to-cart + orders, last 30 days) */
  popularity: Record<string, number>
  builtAt?: string
}
export const EMPTY_GRAPH: ItemGraph = { coBuy: {}, coView: {}, popularity: {} }

export interface RankInput {
  context: RecsContext
  products: Product[]
  collections?: Pick<Collection, 'slug' | 'name'>[]
  signals?: RecSignals
  graph?: ItemGraph
  /** product page: the product being viewed (slug or id) */
  anchor?: string | null
  /** slugs/ids never to return (e.g. the "Pairs well with" row already on the page) */
  exclude?: string[]
  limit?: number
  /** epoch ms — pass it for deterministic output */
  now?: number
}

// ============================================================================ tunables
/** Feature weights per surface. Product: similar + bought together. Cart: complementary types. Home/shop/account: taste. */
export const WEIGHTS: Record<RecsContext, Record<Feature, number>> = {
  home: { col: 3, type: 1.2, coBuy: 2, coView: 1.6, pop: 1, fresh: 0.5, mal: 2.6, price: 0.6, sim: 0, comp: 0, search: 1.4 },
  shop: { col: 3, type: 1.2, coBuy: 2, coView: 1.6, pop: 1, fresh: 0.5, mal: 2.6, price: 0.6, sim: 0, comp: 0, search: 1.6 },
  account: { col: 3, type: 1.2, coBuy: 2.2, coView: 1.4, pop: 0.8, fresh: 0.5, mal: 3, price: 0.6, sim: 0, comp: 0, search: 1 },
  product: { col: 1, type: 0.5, coBuy: 3, coView: 2.2, pop: 0.6, fresh: 0.3, mal: 0.8, price: 0.8, sim: 3.4, comp: 0.8, search: 0.4 },
  cart: { col: 2, type: 0.2, coBuy: 3.4, coView: 1, pop: 0.8, fresh: 0.3, mal: 0.8, price: 0.5, sim: 0.6, comp: 3.2, search: 0.4 },
}

export const PENALTY = {
  inCart: 6,
  purchased: 3,
  /** collectibles get bought again (more polaroids, more stickers) — lighter penalty */
  purchasedCollectible: 1,
  /** already viewed (home/shop/account: show something new; product page: lighter) */
  viewed: 2.5,
  viewedOnProduct: 0.5,
  /** viewed in the last 30 min — on top of `viewed` */
  justViewed: 1.2,
  priceOnRequest: 0.25,
  /** cart context: another piece of the same type + arc as something already in the cart */
  sameAsCart: 0.8,
} as const

/** "Complete the look": what goes with what (earlier = better fit). */
export const COMPLEMENTS: Partial<Record<ProductType, ProductType[]>> = {
  tshirt: ['hoodie', 'polaroid', 'sticker', 'badge', 'keychain', 'poster'],
  hoodie: ['tshirt', 'keychain', 'badge', 'sticker', 'polaroid'],
  polaroid: ['bookmark', 'poster', 'badge', 'sticker'],
  poster: ['polaroid', 'sticker', 'badge', 'bookmark'],
  bookmark: ['polaroid', 'stationery', 'tote', 'sticker'],
  badge: ['sticker', 'keychain', 'tote', 'polaroid'],
  sticker: ['badge', 'polaroid', 'keychain', 'bookmark'],
  keychain: ['badge', 'sticker', 'accessory'],
  katana: ['cape', 'hat', 'cosplay', 'accessory'],
  cape: ['katana', 'hat', 'cosplay'],
  hat: ['cape', 'katana', 'cosplay'],
  cosplay: ['katana', 'cape', 'hat', 'accessory'],
  accessory: ['keychain', 'badge', 'figurine'],
  figurine: ['poster', 'keychain', 'polaroid'],
  tote: ['badge', 'bookmark', 'stationery'],
  stationery: ['bookmark', 'tote', 'sticker'],
}

const COLLECTIBLE: ReadonlySet<ProductType> = new Set(['polaroid', 'bookmark', 'poster', 'badge', 'sticker', 'stationery'])

const TYPE_WORD: Record<ProductType, string> = {
  tshirt: 'tee', hoodie: 'hoodie', polaroid: 'polaroids', bookmark: 'bookmark', poster: 'poster', badge: 'badge', sticker: 'sticker',
  keychain: 'keychain', cosplay: 'cosplay', katana: 'katana', figurine: 'figurine', cape: 'cape', accessory: 'accessory', hat: 'hat',
  tote: 'tote', stationery: 'stationery',
}

const TYPE_PLURAL: Record<ProductType, string> = {
  tshirt: 'tees', hoodie: 'hoodies', polaroid: 'polaroids', bookmark: 'bookmarks', poster: 'posters', badge: 'badges', sticker: 'stickers',
  keychain: 'keychains', cosplay: 'cosplay pieces', katana: 'katanas', figurine: 'figurines', cape: 'capes', accessory: 'accessories',
  hat: 'hats', tote: 'totes', stationery: 'stationery',
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

function bump<K>(m: Map<K, number>, k: K, w: number) {
  m.set(k, (m.get(k) ?? 0) + w)
}

function normalise<K>(m: Map<K, number>): Map<K, number> {
  let max = 0
  for (const v of m.values()) if (v > max) max = v
  if (max <= 0) return new Map()
  const out = new Map<K, number>()
  for (const [k, v] of m) out.set(k, v / max)
  return out
}

// ============================================================================ item features (pure)
/** Lowest numeric price (same rule as the shop's price filter). null = on request. */
export function itemPrice(p: Product): number | null {
  if (p.priceOnRequest) return null
  let lo: number | null = null
  for (const v of p.variants) {
    const n = typeof v.price === 'number' ? v.price : v.attrs?.range ? Number(v.attrs.range.split(/[–—-]/)[0]) : null
    if (n != null && Number.isFinite(n)) lo = lo == null ? n : Math.min(lo, n)
  }
  return lo ?? p.priceFrom
}

/** 0 < ₹100 · 1 < ₹300 · 2 < ₹700 · 3 < ₹1500 · 4 above · -1 on request */
export function priceBand(p: Product): number {
  const n = itemPrice(p)
  if (n == null) return -1
  return n < 100 ? 0 : n < 300 ? 1 : n < 700 ? 2 : n < 1500 ? 3 : 4
}

/** fit (oversized/regular/baby) and GSM tiers offered */
export function fitKeys(p: Product): string[] {
  const out = new Set<string>()
  for (const v of p.variants) {
    if (v.attrs?.fit) out.add(`fit:${v.attrs.fit}`)
    if (v.attrs?.gsm) out.add(`gsm:${v.attrs.level ?? v.attrs.gsm}`)
  }
  return [...out].sort()
}

/** 1 for a brand-new piece, ~0.37 after 45 days. */
export function newness(p: Pick<Product, 'createdAt'>, now: number): number {
  const t = Date.parse(p.createdAt)
  if (!Number.isFinite(t)) return 0
  return Math.exp(-Math.max(0, now - t) / (45 * DAY))
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a), B = new Set(b)
  if (!A.size && !B.size) return 0
  let inter = 0
  for (const x of B) if (A.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

/** Content similarity 0..1 (collection, type, tags, price band, fit/GSM). Symmetric. */
export function contentSim(a: Product, b: Product): number {
  if (a.slug === b.slug) return 1
  const fa = fitKeys(a), fb = fitKeys(b)
  const ba = priceBand(a)
  return (
    (a.collection === b.collection ? 0.42 : 0) +
    (a.type === b.type ? 0.26 : 0) +
    0.16 * jaccard(a.tags, b.tags) +
    (ba >= 0 && ba === priceBand(b) ? 0.1 : 0) +
    (fa.length && fb.length ? 0.06 * jaccard(fa, fb) : 0)
  )
}

/** Recency decay of a view: halves every 3 days; repeat views add up to +100%. */
export function viewWeight(at: number, count: number, now: number): number {
  const ageDays = Math.max(0, now - at) / DAY
  const decay = Number.isFinite(ageDays) ? Math.pow(0.5, ageDays / 3) : 0.2
  return decay * (1 + Math.min(4, Math.max(0, count - 1)) * 0.25)
}

export function searchHay(p: Product): string {
  return [p.name, p.designTitle, p.jpTitle ?? '', p.type, p.collection.replace(/-/g, ' '), ...p.tags].join(' ').toLowerCase()
}

// ============================================================================ visitor profile
interface Source { kind: ReasonKind; label: string; w: number; slug: string }

export interface Profile {
  col: Map<string, number>
  type: Map<string, number>
  band: Map<number, number>
  mal: Map<string, number>
  /** collection → personal sources, strongest first (name the reason chip) */
  colSource: Map<string, Source[]>
  malTitle: Map<string, string>
  /** weighted seed items for the collaborative features (slug → weight) */
  seeds: Map<string, number>
  /** products matching the search terms: slug → 0..1 */
  search: Map<string, number>
  searchTerm: string | null
  cart: Set<string>
  wish: Set<string>
  bought: Set<string>
  justViewed: Set<string>
  viewed: Set<string>
  /** true when there is any personal signal at all */
  any: boolean
}

export function buildProfile(products: Product[], signals: RecSignals = {}, now = Date.now(), anchor?: string | null): Profile {
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const byId = new Map(products.map((p) => [p.id, p]))
  const resolve = (ref: string) => bySlug.get(ref) ?? byId.get(ref)
  const col = new Map<string, number>(), type = new Map<string, number>(), band = new Map<number, number>(), mal = new Map<string, number>()
  const colSource = new Map<string, Source[]>()
  const malTitle = new Map<string, string>()
  const seeds = new Map<string, number>()
  const cart = new Set<string>(), wish = new Set<string>(), bought = new Set<string>(), justViewed = new Set<string>(), viewed = new Set<string>()

  const learn = (p: Product, w: number, src: Source) => {
    bump(col, p.collection, 3 * w)
    bump(type, p.type, 1.5 * w)
    const b = priceBand(p)
    if (b >= 0) bump(band, b, w)
    bump(seeds, p.slug, w)
    const list = colSource.get(p.collection) ?? []
    list.push(src)
    list.sort((a, b) => b.w - a.w || a.slug.localeCompare(b.slug))
    // a few per arc, so explain() can pick the one closest to each candidate (same type / price band)
    colSource.set(p.collection, list.slice(0, 6))
  }

  // views — newest 40, recency-decayed
  const views = [...(signals.views ?? [])]
    .filter((v) => v && typeof v.slug === 'string' && Number.isFinite(v.at))
    .sort((a, b) => b.at - a.at || a.slug.localeCompare(b.slug))
    .slice(0, 40)
  for (const v of views) {
    const p = resolve(v.slug)
    if (!p || viewed.has(p.slug)) continue
    const w = viewWeight(v.at, v.count ?? 1, now)
    viewed.add(p.slug)
    if (now - v.at < 30 * 60_000) justViewed.add(p.slug)
    learn(p, w, { kind: 'viewed', label: `Because you viewed ${p.designTitle}`, w, slug: p.slug })
  }
  for (const ref of (signals.cart ?? []).slice(0, 40)) {
    const p = resolve(ref)
    if (!p || cart.has(p.slug)) continue
    cart.add(p.slug)
    learn(p, 1.4, { kind: 'cart', label: `Goes with ${p.designTitle} in your cart`, w: 1.4, slug: p.slug })
  }
  for (const ref of (signals.wish ?? []).slice(0, 60)) {
    const p = resolve(ref)
    if (!p || wish.has(p.slug)) continue
    wish.add(p.slug)
    learn(p, 1.1, { kind: 'wishlist', label: `Because you saved ${p.designTitle}`, w: 1.1, slug: p.slug })
  }
  for (const ref of (signals.orders ?? []).slice(0, 80)) {
    const p = resolve(ref)
    if (!p || bought.has(p.slug)) continue
    bought.add(p.slug)
    learn(p, 1.6, { kind: 'viewed', label: `Because you bought ${p.designTitle}`, w: 1.6, slug: p.slug })
  }
  for (const m of (signals.mal ?? []).slice(0, 40)) {
    if (!m || !m.collection || !(m.weight > 0)) continue
    bump(mal, m.collection, m.weight)
    if (!malTitle.has(m.collection)) malTitle.set(m.collection, m.title)
  }

  // searches → products whose text matches every word of a term (newest term strongest)
  const search = new Map<string, number>()
  let searchTerm: string | null = null
  const terms = (signals.searches ?? []).map((s) => String(s).trim().toLowerCase()).filter((s) => s.length >= 2).slice(0, 5)
  terms.forEach((term, i) => {
    const words = term.split(/\s+/).filter(Boolean)
    const hits = products.filter((p) => words.every((w) => searchHay(p).includes(w)))
    if (!hits.length) return
    if (!searchTerm) searchTerm = term
    const w = Math.pow(0.6, i)
    const spread = Math.sqrt(hits.length)
    for (const p of hits) {
      bump(search, p.slug, w)
      bump(col, p.collection, (1.2 * w) / spread)
      bump(type, p.type, (0.6 * w) / spread)
    }
  })

  // the product page anchor is the strongest seed for the collaborative features
  if (anchor) {
    const a = resolve(anchor)
    if (a) bump(seeds, a.slug, 3)
  }

  const any = viewed.size > 0 || cart.size > 0 || wish.size > 0 || bought.size > 0 || mal.size > 0 || search.size > 0
  return {
    col: normalise(col), type: normalise(type), band: normalise(band), mal: normalise(mal),
    colSource, malTitle, seeds, search: normalise(search), searchTerm, cart, wish, bought, justViewed, viewed, any,
  }
}

// ============================================================================ collaborative graph
export interface GraphInput {
  /** each order's product refs (slug or id) */
  orders: string[][]
  /** product_view events grouped by session */
  sessions: string[][]
  /** popularity events in the last 30 days */
  events?: Array<{ slug: string; kind: 'view' | 'cart' | 'order' }>
  /** resolves ids → slugs and drops unknown items */
  products: Pick<Product, 'id' | 'slug'>[]
  /** neighbours kept per item (default 24) */
  topK?: number
  /** distinct orders a co-purchase pair needs before it counts (default 1) */
  minCoBuy?: number
  builtAt?: string
}

/** Item-item co-occurrence: cosine over baskets, big baskets discounted, rare pairs shrunk, top-K, max-normalised per row. */
export function cooccur(baskets: string[][], maxBasket: number, topK: number, minSupport = 1): Record<string, Record<string, number>> {
  const freq = new Map<string, number>()
  const pair = new Map<string, Map<string, number>>()
  const hits = new Map<string, Map<string, number>>()
  for (const raw of baskets) {
    const items = [...new Set(raw)].sort()
    if (!items.length || items.length > maxBasket) continue
    for (const a of items) bump(freq, a, 1)
    if (items.length < 2) continue
    const w = 1 / Math.log2(1 + items.length) // a 2-item basket says more than a 20-item one
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j]
        for (const [x, y] of [[a, b], [b, a]] as const) {
          if (!pair.has(x)) { pair.set(x, new Map()); hits.set(x, new Map()) }
          bump(pair.get(x)!, y, w)
          bump(hits.get(x)!, y, 1)
        }
      }
  }
  const out: Record<string, Record<string, number>> = {}
  for (const a of [...pair.keys()].sort()) {
    const m = pair.get(a)!, h = hits.get(a)!
    const ranked = [...m.entries()]
      .filter(([b]) => (h.get(b) ?? 0) >= minSupport)
      .map(([b, c]) => {
        const n = h.get(b) ?? 1
        return [b, (c / Math.sqrt((freq.get(a) ?? 1) * (freq.get(b) ?? 1))) * (n / (n + 1))] as [string, number]
      })
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, topK)
    if (!ranked.length) continue
    const top = ranked[0][1] || 1
    out[a] = Object.fromEntries(ranked.map(([b, s]) => [b, round(s / top)]))
  }
  return out
}

export function buildItemGraph(input: GraphInput): ItemGraph {
  const slugs = new Set(input.products.map((p) => p.slug))
  const idToSlug = new Map(input.products.map((p) => [p.id, p.slug]))
  const norm = (ref: string) => (slugs.has(ref) ? ref : idToSlug.get(ref) ?? null)
  const clean = (b: string[]) => b.map(norm).filter((s): s is string => !!s)
  const topK = input.topK ?? 24
  // minCoBuy: a pair needs this many DISTINCT orders before it counts (one order — e.g. a test or spam basket —
  // must not create a "Bought with …" recommendation). Default 1 keeps small fixtures readable; graph.ts uses 2.
  const coBuy = cooccur(input.orders.map(clean), 30, topK, input.minCoBuy ?? 1)
  // sessions with > 40 distinct product views look like crawlers — skipped
  const coView = cooccur(input.sessions.map(clean), 40, topK)
  const raw = new Map<string, number>()
  for (const e of input.events ?? []) {
    const s = norm(e.slug)
    if (s) bump(raw, s, e.kind === 'order' ? 5 : e.kind === 'cart' ? 3 : 1)
  }
  let max = 0
  for (const v of raw.values()) max = Math.max(max, Math.log1p(v))
  const popularity: Record<string, number> = {}
  for (const s of [...raw.keys()].sort()) popularity[s] = max > 0 ? round(Math.log1p(raw.get(s)!) / max) : 0
  return { coBuy, coView, popularity, builtAt: input.builtAt }
}

// ============================================================================ ranking
/** Σ seedWeight · neighbourStrength, normalised to 0..1; `from` = the seed that contributed most. */
function collabScore(seeds: Map<string, number>, m: Record<string, Record<string, number>>, slug: string): { s: number; from: string | null } {
  let s = 0, best = 0, total = 0
  let from: string | null = null
  for (const [seed, w] of [...seeds.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    total += w
    const v = m[seed]?.[slug]
    if (!v) continue
    s += w * v
    if (w * v > best) { best = w * v; from = seed }
  }
  return { s: total > 0 ? Math.min(1, s / Math.min(total, 3)) : 0, from }
}

export interface MmrOptions {
  limit: number
  /** relevance vs. novelty (1 = pure relevance) */
  lambda?: number
  /** max items of one type within the first `window` results */
  perTypeTop?: number
  /** max items of one collection within the first `window` results */
  perCollectionTop?: number
  window?: number
}

/** Greedy MMR with hard diversity caps in the top window; relaxes the caps only if it runs dry. Deterministic. */
export function diversify<T extends { product: Product; score: number }>(cands: T[], opts: MmrOptions): T[] {
  const { limit, lambda = 0.72, perTypeTop = 2, perCollectionTop = 3, window = 6 } = opts
  const pool = [...cands].sort((a, b) => b.score - a.score || a.product.slug.localeCompare(b.product.slug))
  if (!pool.length) return []
  const hi = pool[0].score, lo = pool[pool.length - 1].score
  const rel = (x: T) => (hi > lo ? (x.score - lo) / (hi - lo) : 1)
  const picked: T[] = []
  const typeN = new Map<string, number>(), colN = new Map<string, number>()
  const taken = new Set<string>()
  for (const relaxed of [false, true]) {
    while (picked.length < limit) {
      let best: T | null = null
      let bestV = -Infinity
      const inWindow = picked.length < window
      for (const c of pool) {
        if (taken.has(c.product.slug)) continue
        if (!relaxed) {
          const tn = typeN.get(c.product.type) ?? 0
          if (inWindow && (tn >= perTypeTop || (colN.get(c.product.collection) ?? 0) >= perCollectionTop)) continue
          // beyond the window keep spreading softly: at most a third of the list per type
          if (!inWindow && tn >= Math.max(perTypeTop, Math.ceil(limit / 3))) continue
        }
        let maxSim = 0
        for (const p of picked) maxSim = Math.max(maxSim, contentSim(c.product, p.product))
        const v = round(lambda * rel(c) - (1 - lambda) * maxSim)
        if (v > bestV) { best = c; bestV = v } // pool is pre-sorted, so ties keep score/slug order
      }
      if (!best) break
      picked.push(best)
      taken.add(best.product.slug)
      bump(typeN, best.product.type, 1)
      bump(colN, best.product.collection, 1)
    }
    if (picked.length >= limit) break
  }
  return picked
}

export function rankRecs(input: RankInput): ScoredRec[] {
  const { context, products } = input
  const now = input.now ?? Date.now()
  const limit = Math.max(1, Math.min(24, Math.floor(input.limit ?? 8)))
  const graph = input.graph ?? EMPTY_GRAPH
  const W = WEIGHTS[context] ?? WEIGHTS.home
  const names = new Map((input.collections ?? []).map((c) => [c.slug, c.name]))
  const colName = (slug: string) => names.get(slug) ?? slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const byId = new Map(products.map((p) => [p.id, p]))
  const anchorP = input.anchor ? bySlug.get(input.anchor) ?? byId.get(input.anchor) ?? null : null
  const prof = buildProfile(products, input.signals, now, anchorP?.slug)
  const excluded = new Set<string>()
  for (const ref of input.exclude ?? []) {
    const p = bySlug.get(ref) ?? byId.get(ref)
    if (p) excluded.add(p.slug)
  }
  if (anchorP) excluded.add(anchorP.slug)

  // complement bases: the cart (cart context) or the anchor (product page)
  const bases: Product[] = context === 'cart' ? [...prof.cart].sort().map((s) => bySlug.get(s)!).filter(Boolean) : anchorP ? [anchorP] : []
  const cartKinds = new Set(bases.map((b) => `${b.type}|${b.collection}`))
  const compFor = (p: Product): { v: number; base: Product | null } => {
    let best = 0
    let base: Product | null = null
    for (const b of bases) {
      const i = (COMPLEMENTS[b.type] ?? []).indexOf(p.type)
      if (i < 0) continue
      const v = (1 - i * 0.1) * (b.collection === p.collection ? 1 : 0.55)
      if (v > best + 1e-9) { best = v; base = b }
    }
    return { v: best, base }
  }
  const anchorBand = anchorP ? priceBand(anchorP) : -1

  const cands: ScoredRec[] = []
  for (const p of products) {
    if (excluded.has(p.slug) || p.stock === 'out') continue // never recommend what can't be bought
    const parts: Partial<Record<Feature, number>> = {}
    const add = (f: Feature, v: number) => {
      if (v > 0 && W[f] > 0) parts[f] = round(W[f] * Math.min(1, v))
    }
    add('col', prof.col.get(p.collection) ?? 0)
    if (context !== 'cart') add('type', prof.type.get(p.type) ?? 0)
    const cb = collabScore(prof.seeds, graph.coBuy, p.slug)
    add('coBuy', cb.s)
    const cv = collabScore(prof.seeds, graph.coView, p.slug)
    add('coView', cv.s)
    add('pop', graph.popularity[p.slug] ?? 0)
    add('fresh', newness(p, now) * 0.6 + (p.dropOfWeek ? 0.25 : 0) + (p.featured ? 0.15 : 0))
    add('mal', prof.mal.get(p.collection) ?? 0)
    const b = priceBand(p)
    if (b >= 0) add('price', anchorBand >= 0 ? Math.max(0, 1 - Math.abs(anchorBand - b) * 0.45) : prof.band.get(b) ?? 0)
    if (anchorP) add('sim', contentSim(anchorP, p))
    const comp = compFor(p)
    add('comp', comp.v)
    add('search', prof.search.get(p.slug) ?? 0)

    let score = Object.values(parts).reduce<number>((s, v) => s + (v ?? 0), 0)
    if (prof.cart.has(p.slug)) score -= PENALTY.inCart
    if (prof.bought.has(p.slug)) score -= COLLECTIBLE.has(p.type) ? PENALTY.purchasedCollectible : PENALTY.purchased
    if (prof.viewed.has(p.slug) && !prof.cart.has(p.slug)) {
      if (context === 'product' || context === 'cart') score -= PENALTY.viewedOnProduct
      else score -= PENALTY.viewed + (prof.justViewed.has(p.slug) ? PENALTY.justViewed : 0)
    }
    if (p.priceOnRequest) score -= PENALTY.priceOnRequest
    if (context === 'cart' && cartKinds.has(`${p.type}|${p.collection}`)) score -= PENALTY.sameAsCart
    score = round(score)
    cands.push({ product: p, score, parts, reason: explain(p, parts, { prof, cb, cv, comp, anchorP, bySlug, colName, context }) })
  }

  const productish = context === 'product' || context === 'cart'
  return diversify(
    cands.filter((c) => c.score > 0.05),
    { limit, perTypeTop: 2, perCollectionTop: context === 'cart' ? 4 : 3, window: 6, lambda: productish ? 0.78 : 0.72 },
  )
}

interface ExplainCtx {
  prof: Profile
  cb: { s: number; from: string | null }
  cv: { s: number; from: string | null }
  comp: { v: number; base: Product | null }
  anchorP: Product | null
  bySlug: Map<string, Product>
  colName: (s: string) => string
  context: RecsContext
}

/** The strongest contribution names the chip. */
export function explain(p: Product, parts: Partial<Record<Feature, number>>, x: ExplainCtx): RecReason {
  const { prof } = x
  const order: Feature[] = ['coBuy', 'comp', 'sim', 'mal', 'search', 'col', 'coView', 'type', 'pop', 'fresh', 'price']
  let top: Feature | null = null
  let best = 0
  for (const f of order) {
    const v = parts[f] ?? 0
    if (v > best + 1e-9) { best = v; top = f }
  }
  const title = (slug: string | null) => (slug ? x.bySlug.get(slug)?.designTitle ?? null : null)
  switch (top) {
    case 'coBuy': {
      const from = title(x.cb.from)
      return { kind: 'bought-together', label: from && from !== x.anchorP?.designTitle ? `Bought with ${from}` : 'Bought together' }
    }
    case 'coView': {
      const from = title(x.cv.from)
      return { kind: 'viewed-together', label: from && from !== x.anchorP?.designTitle ? `Viewed with ${from}` : 'Viewed together' }
    }
    case 'comp':
      return { kind: 'complete', label: x.comp.base ? `Completes your ${TYPE_WORD[x.comp.base.type]}` : 'Completes the look' }
    case 'sim':
      return x.anchorP && x.anchorP.collection === p.collection
        ? { kind: 'similar', label: `More ${x.colName(p.collection)}` }
        : x.anchorP && x.anchorP.type === p.type
          ? { kind: 'similar', label: `Similar ${TYPE_WORD[p.type]}` }
          : { kind: 'similar', label: 'Similar style' }
    case 'mal': {
      const t = prof.malTitle.get(p.collection)
      return { kind: 'watched', label: t ? `Because you watched ${t}` : 'From your MyAnimeList' }
    }
    case 'search':
      return { kind: 'search', label: prof.searchTerm ? `Matches “${prof.searchTerm}”` : 'From your search' }
    case 'col':
    case 'type': {
      // never "Because you viewed X" on X itself. Name the source that best explains THIS pick: the seed that
      // drove its collaborative score, else one of the same type, else the same price band, else the arc's strongest
      const srcs = (prof.colSource.get(p.collection) ?? []).filter((s) => s.slug !== p.slug)
      const collabFrom = x.cb.from ?? x.cv.from
      const band = priceBand(p)
      const src =
        srcs.find((s) => s.slug === collabFrom) ??
        srcs.find((s) => x.bySlug.get(s.slug)?.type === p.type) ??
        (band >= 0 ? srcs.find((s) => { const sp = x.bySlug.get(s.slug); return !!sp && priceBand(sp) === band }) : undefined) ??
        srcs[0]
      if (src && (top === 'col' || (parts.col ?? 0) > 0)) return { kind: src.kind, label: src.label }
      if (top === 'type') return { kind: 'similar', label: `More ${TYPE_PLURAL[p.type]} for you` }
      // affinity that came from searching (no view/cart/wishlist in this arc)
      if ((parts.search ?? 0) > 0 && prof.searchTerm) return { kind: 'search', label: `Matches “${prof.searchTerm}”` }
      const t = prof.malTitle.get(p.collection)
      if (t) return { kind: 'watched', label: `Because you watched ${t}` }
      return { kind: 'popular', label: `Popular in ${x.colName(p.collection)}` }
    }
    case 'fresh':
      return { kind: 'new', label: p.dropOfWeek ? 'Drop of the week' : 'New drop' }
    default:
      return { kind: 'popular', label: `Popular in ${x.colName(p.collection)}` }
  }
}

// ============================================================================ signed-in payload (account / product extras)
export interface RecsInput {
  products: Product[]
  collections: Collection[]
  views: RecentView[]
  /** product ids in the cart / wishlist (client-provided hints; only used to rank, never trusted for anything else) */
  signalIds?: string[]
  /** past orders (product ids or slugs) */
  orderIds?: string[]
  /** product slug to leave out (the page being viewed) */
  exclude?: string | null
  mal?: { username: string; syncedAt: string | null; list: MalAnime[]; suggestions: MalSuggestion[]; stats: MalSnapshotStats | null } | null
  graph?: ItemGraph
  limits?: { recent?: number; picks?: number; watchedRows?: number; perRow?: number }
  now?: number
}

/** Weight of a MAL entry as a taste signal: watching > high score completed > rest. */
export function animeWeight(a: Pick<MalAnime, 'status' | 'score'>): number {
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

/** MAL list → per-collection affinity (the strongest title per collection names the reason). */
export function malSignals(list: MalAnime[], collections: Pick<Collection, 'slug' | 'name' | 'group'>[]): NonNullable<RecSignals['mal']> {
  const mapper = makeMapper(collections)
  const out = new Map<string, { collection: string; weight: number; title: string; best: number }>()
  for (const a of list) {
    const w = animeWeight(a)
    if (w <= 0) continue
    const slug = mapper.map(a)
    if (!slug) continue
    const title = a.en || a.title
    const cur = out.get(slug)
    if (!cur) out.set(slug, { collection: slug, weight: w, title, best: w })
    else {
      cur.weight += w
      if (w > cur.best) { cur.best = w; cur.title = title }
    }
  }
  return [...out.values()]
    .sort((a, b) => b.weight - a.weight || a.collection.localeCompare(b.collection))
    .map(({ collection, weight, title }) => ({ collection, weight, title }))
}

const typeRank: Partial<Record<Product['type'], number>> = { tshirt: 3, hoodie: 3, poster: 2, polaroid: 1.5, keychain: 1, badge: 1 }

export function buildRecs(input: RecsInput): RecsPayload {
  const { products, collections, views, signalIds = [], exclude, mal } = input
  const now = input.now ?? Date.now()
  const L = { recent: 8, picks: 8, watchedRows: 3, perRow: 4, ...input.limits }
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const colBySlug = new Map(collections.map((c) => [c.slug, c]))
  const available = (p: Product | undefined): p is Product => !!p && p.stock !== 'out' && p.slug !== exclude

  // ---- recently viewed (newest first)
  const sortedViews = [...views].sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
  const recent = sortedViews.map((v) => bySlug.get(v.slug)).filter((p): p is Product => !!p && p.slug !== exclude).slice(0, L.recent)

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

  // ---- picks: the hybrid ranker (views + cart/wishlist + orders + MAL + co-occurrence)
  const signals: RecSignals = {
    views: sortedViews.slice(0, 40).map((v) => ({ slug: v.slug, at: Date.parse(v.viewedAt) || now - 7 * DAY, count: v.count })),
    cart: signalIds,
    orders: input.orderIds ?? [],
    mal: mal?.list?.length ? malSignals(mal.list, collections) : [],
  }
  const personal = buildProfile(products, signals, now).any
  const picksR = personal
    ? rankRecs({
        context: 'account',
        products,
        collections,
        signals,
        graph: input.graph,
        exclude: [...(exclude ? [exclude] : []), ...sortedViews.map((v) => v.slug), ...signalIds],
        limit: L.picks,
        now,
      })
    : [] // no personal signal → the account page shows its designed empty state, never filler
  const picks = picksR.map((r) => r.product)
  const pickReasons = Object.fromEntries(picksR.map((r) => [r.product.id, r.reason]))
  const topCol = picks[0]?.collection
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

  const beyond = unmapped.length ? products.filter((p) => available(p) && colBySlug.get(p.collection)?.group === 'beyond').slice(0, 4) : []

  return {
    ...EMPTY_RECS,
    signedIn: true,
    recent,
    picks,
    pickReason,
    pickReasons,
    watched,
    unmapped,
    beyond,
    suggestions,
    mal: mal ? { username: mal.username, syncedAt: mal.syncedAt, stats: mal.stats ?? null } : null,
  }
}
