// Recommendation signals — BROWSER side (owner: RECS). Logged-out personalisation without accounts or cookies:
// product views (with time + count) and recent shop searches live in localStorage only, and are sent to
// GET /api/recs as a compact query when a recommendation row renders. Nothing here identifies a person.
// localStorage can be missing/blocked → every access is guarded and the site works without it.
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
}

/** Remember a shop search term (lower-cased, trimmed, deduped). */
export function pushSignalSearch(term: string): void {
  const t = term.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
  if (t.length < 2) return
  const st = read()
  // typing "jj" → "jjk": keep only the longer, latest form
  st.s = [[t, Date.now()] as [string, number], ...st.s.filter((x) => x[0] !== t && !t.startsWith(x[0]))].slice(0, MAX_SEARCHES)
  write(st)
}

export function clearSignals(): void {
  try {
    window.localStorage.removeItem(KEY)
    window.dispatchEvent(new Event(SIGNALS_EVENT))
  } catch {
    /* ignore */
  }
}

export interface LocalSignals {
  views: Array<{ slug: string; at: number; count: number }>
  searches: string[]
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
  return { views: views.slice(0, MAX_VIEWS), searches: st.s.map((x) => x[0]) }
}

export function hasLocalSignals(): boolean {
  const s = readSignals()
  return s.views.length > 0 || s.searches.length > 0
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
  if (opts.exclude?.length) q.set('x', opts.exclude.slice(0, 12).join(','))
  return q.toString()
}
