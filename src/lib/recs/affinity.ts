// MyAnimeList → anime-affinity model (pure, deterministic; pass `now`). Owner: MAL-RECS.
// Turns the stored list snapshot (mal_accounts.anime_snapshot) into "what this shopper watches most":
//
//   per entry   engagement = status · score · recency · rewatch
//                 status    watching 1 · completed 0.9 · on hold 0.4 · plan to watch 0.25 · dropped 0
//                 score     1 + (score − 6) · 0.12   (10 → 1.48 · 6 → 1 · 1 → 0.4; not scored → 1)
//                 recency   0.3 + 0.7 · ½^(days since list update / 120)   (unknown → 0.6)
//                 rewatch   ×1.25 while rewatching · +15% per past rewatch (max 3)
//               animeAffinity = engagement · episodes(log)          episodes(n) = 0.3 + ln(1+n) / ln(101)
//   franchise   seasons, parts, films and spin-offs grouped by normalised title (season / part / movie markers and
//               subtitles stripped), our alias table (mal-map.ts) and MAL alternative titles (en + synonyms), plus a
//               word-prefix rule that needs a shared genre ("Haikyuu!!" + "Haikyuu!! To the Top", not "Monster" +
//               "Monster Musume").
//               affinity = (best engagement + 0.15 · Σ other engagements) · episodes(total watched, dropped excluded)
//   → franchise → our arc (makeMapper) and → product tags (Beyond Anime pieces: racing → F1, idols → K-pop …)
//   → engine signals: mal (arc affinity), malTags (tag affinity), malLead (franchises in order, for the lead row)
import type { Collection, Product } from '@/lib/types'
import { aliasOf, makeMapper, tagsOf } from './mal-map'
import type { MalAnime, MalStatus, TopAnime } from './types'

const DAY = 86_400_000

export const STATUS_WEIGHT: Record<MalStatus, number> = { watching: 1, completed: 0.9, on_hold: 0.4, plan_to_watch: 0.25, dropped: 0 }
/** list status we don't know (null) — treated a little above plan-to-watch */
const UNKNOWN_STATUS = 0.3
export const RECENCY_HALF_LIFE_DAYS = 120

const round = (n: number) => Math.round(n * 1e6) / 1e6

export function statusWeight(s: MalStatus | null | undefined): number {
  return s ? STATUS_WEIGHT[s] ?? UNKNOWN_STATUS : UNKNOWN_STATUS
}
/** The shopper's own score, centred on 6. 0 = not scored → neutral. */
export function scoreFactor(score: number): number {
  if (!(score > 0)) return 1
  return Math.max(0.1, 1 + (Math.min(10, score) - 6) * 0.12)
}
/** Log-scaled episodes watched: 0 → 0.3 · 12 → 0.86 · 24 → 0.99 · 100 → 1.3 · 1000 → 1.8 */
export function episodeFactor(n: number): number {
  return 0.3 + Math.log1p(Math.max(0, n || 0)) / Math.log1p(100)
}
/** List activity recency (half-life 120 days, floor 0.3 so an old favourite still counts). */
export function recencyFactor(updatedAt: string | null | undefined, now: number): number {
  const t = updatedAt ? Date.parse(updatedAt) : NaN
  if (!Number.isFinite(t)) return 0.6
  const days = Math.max(0, now - t) / DAY
  return 0.3 + 0.7 * Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS)
}
export function rewatchFactor(a: Pick<MalAnime, 'rewatching' | 'rewatches'>): number {
  return (a.rewatching ? 1.25 : 1) * (1 + 0.15 * Math.min(3, Math.max(0, a.rewatches ?? 0)))
}

/** status · score · recency · rewatch (no episodes) */
export function engagement(a: MalAnime, now: number): number {
  const s = statusWeight(a.status)
  if (s <= 0) return 0
  return s * scoreFactor(a.score) * recencyFactor(a.updatedAt, now) * rewatchFactor(a)
}

/** One list entry's affinity (engagement × log-scaled episodes). Dropped = 0. */
export function animeAffinity(a: MalAnime, now = Date.now()): number {
  const e = engagement(a, now)
  return e > 0 ? round(e * episodeFactor(a.episodes)) : 0
}

// ---------------------------------------------------------------- franchise grouping
const TAIL =
  /\s+(?:(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|final|last)\s+season|season\s*\d+|s\d+|part\s*(?:\d+|i{1,3}|iv|v)|cour\s*\d+|movie(?:\s*\d+)?|the\s+movie|film|gekijouban|ova|ona|oad|specials?|special|recap|tv|shippuu?den|kanketsu\s*hen|\d+|i{2,3}|iv|the)$/
const HEAD = /^(?:gekijouban|movie|the movie|eiga)\s+/

/** Franchise base of one title: "Shingeki no Kyojin: The Final Season Part 2" → "shingeki no kyojin",
 *  "Jujutsu Kaisen 0 Movie" → "jujutsu kaisen", "Steins;Gate 0" → "steins gate", "Re:Zero kara …" keeps "re zero …". */
export function franchiseBase(raw: string): string {
  let t = String(raw ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/×/g, 'x')
  // a subtitle after ":" or " - " goes when what's before it is a real name (≥ 4 letters/digits)
  const m = t.match(/^(.*?)\s*(?::|\s[-–—]\s)/)
  if (m && m[1].replace(/[^a-z0-9]/g, '').length >= 4) t = m[1]
  t = t.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
  const before = t
  t = t.replace(HEAD, '')
  for (let i = 0; i < 6; i++) {
    const n = t.replace(TAIL, '').trim()
    if (n === t) break
    t = n
  }
  return t.length >= 2 ? t : before
}

export interface Franchise {
  key: string
  /** display title (shortest English-or-romaji title among the entries — usually season 1) */
  title: string
  /** representative entry (strongest affinity) */
  lead: MalAnime
  members: MalAnime[]
  /** total episodes watched (dropped entries excluded) */
  episodes: number
  score: number
  status: MalStatus | null
  /** raw affinity */
  raw: number
  /** 0..1 vs. the top franchise */
  affinity: number
  /** our arc for it (live anime-group collections only) */
  collection: string | null
  /** product tags it points to → weight 0..1 */
  tags: Map<string, number>
}

const STATUS_ORDER: MalStatus[] = ['watching', 'completed', 'on_hold', 'plan_to_watch', 'dropped']

function find(p: number[], i: number): number {
  while (p[i] !== i) {
    p[i] = p[p[i]]
    i = p[i]
  }
  return i
}
function union(p: number[], a: number, b: number) {
  const ra = find(p, a), rb = find(p, b)
  if (ra !== rb) p[Math.max(ra, rb)] = Math.min(ra, rb)
}

/** Group the list into franchises and score them, strongest first. */
export function animeFranchises(list: MalAnime[], collections: Pick<Collection, 'slug' | 'name' | 'group'>[] = [], now = Date.now()): Franchise[] {
  const items = (Array.isArray(list) ? list : []).filter((a) => a && Number.isFinite(a.id) && typeof a.title === 'string' && a.title)
  if (!items.length) return []
  const parent = items.map((_, i) => i)
  const byKey = new Map<string, number>()
  const mainKeys: string[][] = []
  items.forEach((a, i) => {
    const alias = aliasOf(a)
    const keys = [a.title, a.en ?? '', ...(a.synonyms ?? [])].filter(Boolean).map(franchiseBase).filter((k) => k.replace(/\s/g, '').length >= 3)
    if (alias) keys.push(`@${alias}`)
    mainKeys.push([a.title, a.en ?? ''].filter(Boolean).map(franchiseBase).filter((k) => k.length >= 3))
    for (const k of new Set(keys)) {
      const j = byKey.get(k)
      if (j == null) byKey.set(k, i)
      else union(parent, i, j)
    }
  })
  // word-prefix rule: "haikyuu" + "haikyuu to the top" — only with a shared genre (or no genres to compare)
  const flat: Array<[string, number]> = []
  mainKeys.forEach((ks, i) => ks.forEach((k) => flat.push([k, i])))
  flat.sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]) || a[1] - b[1])
  for (let x = 0; x < flat.length; x++) {
    const [short, i] = flat[x]
    if (!(short.includes(' ') || short.length >= 6)) continue
    for (let y = x + 1; y < flat.length; y++) {
      const [long, j] = flat[y]
      if (i === j || !long.startsWith(`${short} `)) continue
      const gi = items[i].genres ?? [], gj = items[j].genres ?? []
      if (gi.length && gj.length && !gi.some((g) => gj.includes(g))) continue
      union(parent, i, j)
    }
  }

  const groups = new Map<number, MalAnime[]>()
  items.forEach((a, i) => {
    const r = find(parent, i)
    const g = groups.get(r) ?? []
    g.push(a)
    groups.set(r, g)
  })

  const mapper = makeMapper(collections)
  const out: Franchise[] = []
  for (const members of groups.values()) {
    const scored = members
      .map((a) => ({ a, e: engagement(a, now), f: animeAffinity(a, now) }))
      .sort((x, y) => y.f - x.f || y.e - x.e || x.a.id - y.a.id)
    const live = scored.filter((s) => s.e > 0)
    if (!live.length) continue // only dropped entries → no affinity
    const engs = live.map((s) => s.e).sort((a, b) => b - a)
    const episodes = live.reduce((n, s) => n + Math.max(0, s.a.episodes || 0), 0)
    const raw = round((engs[0] + 0.15 * engs.slice(1).reduce((n, v) => n + v, 0)) * episodeFactor(episodes))
    const lead = live[0].a
    const name = (a: MalAnime) => a.en || a.title
    const title = [...members].sort((x, y) => name(x).length - name(y).length || x.id - y.id).map(name)[0]
    let collection: string | null = null
    const tags = new Map<string, number>()
    for (const s of scored) {
      if (!collection) collection = mapper.map(s.a)
      for (const [t, w] of tagsOf(s.a)) if ((tags.get(t) ?? 0) < w) tags.set(t, w)
    }
    const status = STATUS_ORDER.find((st) => members.some((m) => m.status === st)) ?? null
    out.push({
      key: franchiseBase(lead.title),
      title,
      lead,
      members: scored.map((s) => s.a),
      episodes,
      score: Math.max(0, ...members.map((m) => m.score || 0)),
      status,
      raw,
      affinity: 0,
      collection,
      tags,
    })
  }
  out.sort((a, b) => b.raw - a.raw || b.episodes - a.episodes || a.key.localeCompare(b.key))
  const top = out[0]?.raw || 1
  for (const f of out) f.affinity = round(f.raw / top)
  return out
}

/** Does a product belong to this franchise? (its arc, or one of its fandom tags) */
export function franchiseHas(f: Pick<Franchise, 'collection' | 'tags'>, p: Pick<Product, 'collection' | 'tags'>): boolean {
  if (f.collection && p.collection === f.collection) return true
  for (const t of p.tags ?? []) if (f.tags.has(t)) return true
  return false
}

// ---------------------------------------------------------------- engine signals + "most watched" list
export interface MalLeadSignal {
  key: string
  title: string
  episodes: number
  collection: string | null
  tags: string[]
}
export interface MalModel {
  franchises: Franchise[]
  /** arc affinity, strongest first (title = the franchise that contributes most) */
  mal: Array<{ collection: string; weight: number; title: string }>
  /** fandom-tag affinity (Beyond Anime pieces), strongest first */
  malTags: Array<{ tag: string; weight: number; title: string }>
  /** franchises in affinity order (top 8) — the first one we stock leads "Picked for you" */
  malLead: MalLeadSignal[]
}

export function malModel(list: MalAnime[], collections: Pick<Collection, 'slug' | 'name' | 'group'>[], now = Date.now()): MalModel {
  const franchises = animeFranchises(list, collections, now)
  const arcs = new Map<string, { collection: string; weight: number; title: string; best: number }>()
  const tags = new Map<string, { tag: string; weight: number; title: string }>()
  for (const f of franchises) {
    if (f.collection) {
      const cur = arcs.get(f.collection)
      if (!cur) arcs.set(f.collection, { collection: f.collection, weight: f.raw, title: f.title, best: f.raw })
      else {
        cur.weight += f.raw
        if (f.raw > cur.best) { cur.best = f.raw; cur.title = f.title }
      }
    }
    for (const [t, w] of f.tags) {
      const v = f.raw * w
      const cur = tags.get(t)
      if (!cur || v > cur.weight) tags.set(t, { tag: t, weight: round(v), title: f.title })
    }
  }
  return {
    franchises,
    mal: [...arcs.values()]
      .sort((a, b) => b.weight - a.weight || a.collection.localeCompare(b.collection))
      .map(({ collection, weight, title }) => ({ collection, weight: round(weight), title })),
    malTags: [...tags.values()].sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag)),
    malLead: franchises.slice(0, 8).map((f) => ({ key: f.key, title: f.title, episodes: f.episodes, collection: f.collection, tags: [...f.tags.keys()].sort() })),
  }
}

/** "Your most-watched anime": the top `n` franchises, each flagged with whether we stock a piece for it. */
export function topAnime(franchises: Franchise[], products: Pick<Product, 'collection' | 'tags' | 'stock'>[], n = 5): TopAnime[] {
  return franchises.slice(0, n).map((f) => ({
    key: f.key,
    id: f.lead.id,
    title: f.title,
    picture: f.lead.picture ?? f.members.find((m) => m.picture)?.picture ?? null,
    episodes: f.episodes,
    score: f.score,
    status: f.status,
    entries: f.members.length,
    affinity: f.affinity,
    collection: f.collection,
    stocked: products.some((p) => p.stock !== 'out' && franchiseHas(f, p)),
  }))
}
