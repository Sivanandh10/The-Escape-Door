// Recommendation signals — BROWSER side (owner: RECS). Logged-out personalisation without accounts or cookies:
// product views (with time + count) and recent shop searches live in localStorage only, and are sent to
// GET /api/recs as a compact query when a recommendation row renders. Nothing here identifies a person.
// localStorage can be missing/blocked → every access is guarded and the site works without it.
//
// The session TRAIL (ted-recs-trail-v1): every search, collection page, shop category, cart add, wishlist save and
// product view, timestamped, newest first, capped at 200. It is what the visitor did BEFORE logging in: on login
// CustomerProvider posts it to POST /api/auth/me/sync (→ customer_signals, migration 0012) and drops what was stored,
// so the account's picks start from the whole session; while signed in, new events are flushed the same way.
// Recorded by: RecordView (views), ShopBrowser + <SignalTracker> (searches, /arc + /shop/[category] visits,
// cart adds, wishlist saves).
import { readLocalViews } from './local'

const KEY = 'ted-recs-v1'
const MAX_VIEWS = 30
const MAX_SEARCHES = 5
export const SIGNALS_EVENT = 'ted:recs-signals'

interface Store {
  /** [slug, epoch ms, count] newest first */
  v: Array<[string, number, number]>
  /** [term, epoch ms] newest first */
  s: Array<[string, number]>
}

const SLUG = /^[a-z0-9-]{1,120}$/

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY)
    const j = raw ? (JSON.parse(raw) as Partial<Store>) : {}
    const v = Array.isArray(j.v)
      ? j.v.filter((x): x is [string, number, number] => Array.isArray(x) && typeof x[0] === 'string' && SLUG.test(x[0]) && Number.isFinite(x[1])).slice(0, MAX_VIEWS)
      : []
    const s = Array.isArray(j.s) ? j.s.filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && Number.isFinite(x[1])).slice(0, MAX_SEARCHES) : []
    return { v, s }
  } catch {
    return { v: [], s: [] }
  }
}

function write(st: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(st))
    window.dispatchEvent(new Event(SIGNALS_EVENT))
  } catch {
    /* storage blocked — fine */
  }
}

/** Remember a product view (dedup; repeat views bump the count and move it to the front). */
let lastPush: { slug: string; at: number } | null = null

export function pushSignalView(slug: string): void {
  if (!SLUG.test(slug)) return
  // one page view = one signal (effects can re-run when the session finishes loading)
  if (lastPush && lastPush.slug === slug && Date.now() - lastPush.at < 10_000) return
  lastPush = { slug, at: Date.now() }
  const st = read()
  const prev = st.v.find((x) => x[0] === slug)
  st.v = [[slug, Date.now(), Math.min(50, (prev?.[2] ?? 0) + 1)] as [string, number, number], ...st.v.filter((x) => x[0] !== slug)].slice(0, MAX_VIEWS)
  write(st)
  pushTrail('view', slug)
}

/** Search term as stored everywhere (browser trail, /api/recs, customer_signals): lower-case, letters/digits/space/-. */
export function normTerm(term: string): string {
  return String(term ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .trim()
}

/** Remember a shop search term (lower-cased, trimmed, deduped). */
export function pushSignalSearch(term: string): void {
  const t = normTerm(term)
  if (t.length < 2) return
  const st = read()
  // typing "jj" → "jjk": keep only the longer, latest form
  st.s = [[t, Date.now()] as [string, number], ...st.s.filter((x) => x[0] !== t && !t.startsWith(x[0]))].slice(0, MAX_SEARCHES)
  write(st)
  pushTrail('search', t)
}

export function clearSignals(): void {
  try {
    window.localStorage.removeItem(KEY)
    window.localStorage.removeItem(TRAIL_KEY)
    window.dispatchEvent(new Event(SIGNALS_EVENT))
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- session trail (synced to the account on login)
export const TRAIL_KINDS = ['search', 'collection', 'type', 'cart', 'wishlist', 'view'] as const
export type TrailKind = (typeof TRAIL_KINDS)[number]
export interface TrailEvent {
  kind: TrailKind
  value: string
  /** epoch ms */
  at: number
}
export const TRAIL_KEY = 'ted-recs-trail-v1'
export const MAX_TRAIL = 200
const REF = /^[\w-]{1,120}$/
const KIND_SET: ReadonlySet<string> = new Set(TRAIL_KINDS)

/** Is `value` acceptable for `kind`? (same rule as the server: search = normalised term, others = slug / id) */
export function validTrailValue(kind: TrailKind, value: string): boolean {
  if (kind === 'search') return value.length >= 2 && value.length <= 40 && normTerm(value) === value
  return REF.test(value)
}

function readTrailRaw(): TrailEvent[] {
  try {
    const raw = window.localStorage.getItem(TRAIL_KEY)
    const j = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(j)) return []
    const out: TrailEvent[] = []
    for (const x of j) {
      if (!Array.isArray(x) || !KIND_SET.has(x[0]) || typeof x[1] !== 'string' || !Number.isFinite(x[2])) continue
      if (!validTrailValue(x[0] as TrailKind, x[1])) continue
      out.push({ kind: x[0] as TrailKind, value: x[1], at: x[2] as number })
      if (out.length >= MAX_TRAIL) break
    }
    return out
  } catch {
    return []
  }
}

function writeTrail(list: TrailEvent[]): void {
  try {
    window.localStorage.setItem(TRAIL_KEY, JSON.stringify(list.slice(0, MAX_TRAIL).map((e) => [e.kind, e.value, e.at])))
    window.dispatchEvent(new Event(SIGNALS_EVENT))
  } catch {
    /* storage blocked — fine */
  }
}

/** Record one trail event (newest first). Repeats of the same thing within 30 s are one event; a search typed
 *  letter by letter ("jj" → "jjk") within 2 min keeps only its longest form. */
export function pushTrail(kind: TrailKind, raw: string, now = Date.now()): void {
  const value = kind === 'search' ? normTerm(raw) : String(raw ?? '').trim()
  if (!validTrailValue(kind, value)) return
  const list = readTrailRaw()
  if (list.some((e) => e.kind === kind && e.value === value && now - e.at < 30_000)) return
  let rest = list
  if (kind === 'search') {
    const recent = list.find((e) => e.kind === 'search' && now - e.at < 120_000)
    if (recent && recent.value.startsWith(value)) return // backspacing: the longer form already says it
    if (recent && value.startsWith(recent.value)) rest = list.filter((e) => e !== recent)
  }
  writeTrail([{ kind, value, at: now }, ...rest])
}

export function readTrail(): TrailEvent[] {
  return readTrailRaw()
}

/** Remove the events that were stored on the server (everything recorded at or before `upTo`). */
export function dropTrail(upTo: number): void {
  const left = readTrailRaw().filter((e) => e.at > upTo)
  try {
    if (left.length) writeTrail(left)
    else window.localStorage.removeItem(TRAIL_KEY)
  } catch {
    /* ignore */
  }
}

/** Distinct values of one kind, newest first. */
function trailValues(list: TrailEvent[], kind: TrailKind, max: number): string[] {
  const out: string[] = []
  for (const e of list) {
    if (e.kind !== kind || out.includes(e.value)) continue
    out.push(e.value)
    if (out.length >= max) break
  }
  return out
}

export interface LocalSignals {
  views: Array<{ slug: string; at: number; count: number }>
  searches: string[]
  /** collection (arc) pages visited, newest first */
  collections: string[]
  /** shop categories / product types browsed, newest first */
  types: string[]
}

/** Views (timestamped store ∪ the older slug-only "recently viewed" list) + searches. */
export function readSignals(now = Date.now()): LocalSignals {
  const st = read()
  const views = st.v.map(([slug, at, count]) => ({ slug, at, count }))
  const have = new Set(views.map((v) => v.slug))
  readLocalViews().forEach((slug, i) => {
    // the legacy list has no timestamps: treat it as half a day apart, oldest last
    if (!have.has(slug)) views.push({ slug, at: now - (i + 1) * 12 * 3_600_000, count: 1 })
  })
  const trail = readTrailRaw()
  return {
    views: views.slice(0, MAX_VIEWS),
    searches: st.s.map((x) => x[0]),
    collections: trailValues(trail, 'collection', 6),
    types: trailValues(trail, 'type', 6),
  }
}

export function hasLocalSignals(): boolean {
  const s = readSignals()
  return s.views.length > 0 || s.searches.length > 0 || s.collections.length > 0 || s.types.length > 0
}

/** Compact query for GET /api/recs. */
export function recsQuery(opts: {
  context: string
  slug?: string | null
  limit?: number
  cart?: string[]
  wish?: string[]
  exclude?: string[]
  now?: number
}): string {
  const now = opts.now ?? Date.now()
  const sig = readSignals(now)
  const q = new URLSearchParams()
  q.set('context', opts.context)
  if (opts.slug) q.set('slug', opts.slug)
  if (opts.limit) q.set('limit', String(opts.limit))
  // minutes are rounded to 5 so the URL (and the fetch key) doesn't change every minute
  // the anchor product is seeded server-side; leaving it out keeps the query stable when its own view is recorded
  const v = sig.views.filter((x) => x.slug !== opts.slug).map((x) => `${x.slug}~${Math.round(Math.max(0, now - x.at) / 300_000) * 5}~${x.count}`)
  if (v.length) q.set('v', v.join(','))
  if (opts.cart?.length) q.set('c', [...new Set(opts.cart)].slice(0, 40).join(','))
  if (opts.wish?.length) q.set('w', [...new Set(opts.wish)].slice(0, 60).join(','))
  if (sig.searches.length) q.set('s', sig.searches.join('|'))
  if (sig.collections.length) q.set('g', sig.collections.join(','))
  if (sig.types.length) q.set('t', sig.types.join(','))
  if (opts.exclude?.length) q.set('x', opts.exclude.slice(0, 12).join(','))
  return q.toString()
}
