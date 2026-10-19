// Server-side data access. Owner: F2. CONTRACTS §4 + §10.1.
// - Every read is a 'use cache' function (cacheLife + cacheTag) using the cookie-less
//   publicClient(), so public pages stay static. Admin writes call updateTag('<tag>').
// - Supabase when configured, otherwise (or on any error / empty table) the seed catalogue.
// - Never throws to the UI.
// Do not import from 'use client' files (use props from a Server Component instead).
import { cacheLife, cacheTag } from 'next/cache'
import type {
  BundleRule, Collection, CustomRule, FestEvent, HoodieTier, InstaPost, Partnership, Product,
  ProductFilter, ProductImage, SiteSettings, TeeFit, Variant,
} from '../types'
import { publicClient } from '../supabase/server'
import * as seed from './seed'

/** Cache tags — pass to updateTag()/revalidateTag(tag, 'max') after admin writes. */
export const TAGS = {
  collections: 'collections',
  products: 'products',
  events: 'events',
  partnerships: 'partnerships',
  settings: 'settings',
  insta: 'insta',
  rules: 'rules',
} as const

// ---------------------------------------------------------------- row mappers (DB snake_case → types)
type Row = Record<string, unknown>
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d)
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const iso = (v: unknown, d: string): string => (typeof v === 'string' && v ? new Date(v).toISOString() : d)

function toCollection(r: Row): Collection {
  const sub = strArr(r.sub_fandoms)
  return {
    slug: str(r.slug), name: str(r.name), jp: str(r.jp),
    group: r.group_type === 'beyond' ? 'beyond' : 'anime',
    accentA: str(r.accent_a, '#6D3BFF'), accentB: str(r.accent_b, '#FFE14D'),
    motif: (str(r.motif, 'speedlines') as Collection['motif']),
    tagline: str(r.tagline), blurb: str(r.blurb), order: num(r.sort_order) ?? 0, featured: bool(r.featured),
    ...(sub.length ? { subFandoms: sub } : {}),
  }
}

function toProduct(r: Row): Product {
  const fallback = '2026-10-19T00:00:00.000Z'
  const images = (Array.isArray(r.images) ? r.images : []) as ProductImage[]
  const variants = (Array.isArray(r.variants) ? r.variants : []) as Variant[]
  const jp = str(r.jp_title)
  const sizes = strArr(r.sizes)
  const createdAt = iso(r.created_at, fallback)
  return {
    id: str(r.id), slug: str(r.slug), name: str(r.name), type: str(r.type) as Product['type'],
    collection: str(r.collection), tags: strArr(r.tags), designTitle: str(r.design_title, str(r.name)),
    ...(jp ? { jpTitle: jp } : {}),
    description: str(r.description), images, variants,
    ...(sizes.length ? { sizes } : {}),
    priceFrom: num(r.price_from),
    ...(bool(r.price_on_request) ? { priceOnRequest: true } : {}),
    ...(str(r.bundle_rule_id) ? { bundleRuleId: str(r.bundle_rule_id) } : {}),
    customizable: bool(r.customizable), featured: bool(r.featured), dropOfWeek: bool(r.drop_of_week),
    stock: (['in', 'low', 'out', 'made-to-order'].includes(str(r.stock)) ? str(r.stock) : 'in') as Product['stock'],
    colorBlock: str(r.color_block, '#C9B8FF'),
    createdAt, updatedAt: iso(r.updated_at, createdAt),
  }
}

function toEvent(r: Row): FestEvent {
  return {
    id: str(r.id), name: str(r.name), venue: str(r.venue), city: str(r.city),
    startDate: str(r.start_date) || null, endDate: str(r.end_date) || null,
    dateLabel: str(r.date_label), confirmed: bool(r.confirmed),
    kind: (['stall', 'popup', 'fest', 'online'].includes(str(r.kind)) ? str(r.kind) : 'stall') as FestEvent['kind'],
    status: r.status === 'past' ? 'past' : 'upcoming',
  }
}

function toPartnership(r: Row): Partnership {
  const detail = str(r.detail)
  return {
    id: str(r.id), fest: str(r.fest), institution: str(r.institution), years: str(r.years), role: str(r.role),
    ...(detail ? { detail } : {}), order: num(r.sort_order) ?? 0,
  }
}

function toInsta(r: Row): InstaPost {
  return { id: str(r.id), image: str(r.image), url: str(r.url), caption: str(r.caption), order: num(r.sort_order) ?? 0 }
}

function toBundleRule(r: Row): BundleRule {
  const k = str(r.variant_attr_key), v = str(r.variant_attr_value)
  const price = num(r.price), free = num(r.free)
  return {
    id: str(r.id), label: str(r.label),
    appliesTo: { type: str(r.applies_type) as BundleRule['appliesTo']['type'], ...(k && v ? { variantAttr: [k, v] as [string, string] } : {}) },
    kind: r.kind === 'buyXgetY' ? 'buyXgetY' : 'nForPrice', n: num(r.n) ?? 1,
    ...(price != null ? { price } : {}), ...(free != null ? { free } : {}),
  }
}

function toCustomRule(r: Row): CustomRule {
  return { type: str(r.type) as CustomRule['type'], minQty: num(r.min_qty) ?? 1, unitPrice: num(r.unit_price), note: str(r.note) }
}

/** select * from <table> where is_published (if present) order by sort_order — or null on any failure. */
async function fetchRows(table: string, opts: { published?: boolean; order?: string } = {}): Promise<Row[] | null> {
  const sb = publicClient()
  if (!sb) return null
  try {
    let q = sb.from(table).select('*')
    if (opts.published !== false) q = q.eq('is_published', true)
    if (opts.order) q = q.order(opts.order, { ascending: true })
    const { data, error } = await q
    if (error || !Array.isArray(data) || data.length === 0) return null
    return data as Row[]
  } catch {
    return null
  }
}

async function fetchSetting<T>(key: string): Promise<T | null> {
  const sb = publicClient()
  if (!sb) return null
  try {
    const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle()
    if (error || !data) return null
    return (data as { value: T }).value ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- cached loaders
async function loadCollections(): Promise<Collection[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.collections)
  const rows = await fetchRows('collections', { order: 'sort_order' })
  const list = rows ? rows.map(toCollection).filter((c) => c.slug) : seed.collections
  return [...list].sort((a, b) => a.order - b.order)
}

async function loadProducts(): Promise<Product[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.products)
  const rows = await fetchRows('products', { order: 'sort_order' })
  return rows ? rows.map(toProduct).filter((p) => p.slug && p.variants.length) : seed.products
}

export async function getCollections(): Promise<Collection[]> {
  return loadCollections()
}

export async function getCollection(slug: string): Promise<Collection | null> {
  return (await loadCollections()).find((c) => c.slug === slug) ?? null
}

function matches(p: Product, f: ProductFilter, collectionNames: Map<string, string>): boolean {
  if (f.collection && p.collection !== f.collection) return false
  if (f.type) {
    const types = Array.isArray(f.type) ? f.type : [f.type]
    if (!types.includes(p.type)) return false
  }
  if (f.featured !== undefined && p.featured !== f.featured) return false
  if (f.min !== undefined || f.max !== undefined) {
    if (p.priceFrom == null) return false
    if (f.min !== undefined && p.priceFrom < f.min) return false
    if (f.max !== undefined && p.priceFrom > f.max) return false
  }
  if (f.q) {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    const hay = [p.name, p.designTitle, p.jpTitle ?? '', p.type, p.collection, collectionNames.get(p.collection) ?? '', ...p.tags]
      .join(' ').toLowerCase()
    if (!terms.every((t) => hay.includes(t))) return false
  }
  return true
}

/** All published products, optionally filtered (filtering happens after the cached load). */
export async function getProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const [all, cols] = await Promise.all([loadProducts(), loadCollections()])
  const names = new Map(cols.map((c) => [c.slug, c.name]))
  return all.filter((p) => matches(p, filter, names))
}

export async function getProduct(slug: string): Promise<Product | null> {
  return (await loadProducts()).find((p) => p.slug === slug) ?? null
}

/** The one dropOfWeek product (falls back to the first featured oversized tee). */
export async function getDropOfWeek(): Promise<Product | null> {
  const all = await loadProducts()
  return all.find((p) => p.dropOfWeek) ?? all.find((p) => p.featured && p.type === 'tshirt') ?? all[0] ?? null
}

/** "Pairs well with": same collection, other product types first, then anything featured. */
export async function getRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
  const all = await loadProducts()
  const p = all.find((x) => x.slug === slug)
  if (!p) return []
  const seen = new Set<string>([p.type])
  const sameArc = all.filter((x) => x.slug !== slug && x.collection === p.collection)
  const out: Product[] = []
  for (const x of sameArc) if (!seen.has(x.type) && !x.priceOnRequest) { out.push(x); seen.add(x.type) }
  for (const x of [...sameArc, ...all.filter((y) => y.featured)]) {
    if (out.length >= limit) break
    if (x.slug !== slug && !out.includes(x)) out.push(x)
  }
  return out.slice(0, limit)
}

export async function getEvents(): Promise<FestEvent[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.events)
  const rows = await fetchRows('events', { order: 'sort_order' })
  return rows ? rows.map(toEvent).filter((e) => e.id) : seed.events
}

export async function getPartnerships(): Promise<Partnership[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.partnerships)
  const rows = await fetchRows('partnerships', { order: 'sort_order' })
  const list = rows ? rows.map(toPartnership).filter((p) => p.id) : seed.partnerships
  return [...list].sort((a, b) => a.order - b.order)
}

export async function getSettings(): Promise<SiteSettings> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.settings)
  const stored = await fetchSetting<Partial<SiteSettings>>('site')
  const merged: SiteSettings = { ...seed.settings, ...(stored ?? {}) }
  if (!Array.isArray(merged.tickerWords) || !merged.tickerWords.length) merged.tickerWords = seed.settings.tickerWords
  if (!merged.whatsapp) merged.whatsapp = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
  return merged
}

/** Admin-managed; [] by default (S13 shows its designed empty state). */
export async function getInstaPosts(): Promise<InstaPost[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.insta)
  const rows = await fetchRows('insta_posts', { order: 'sort_order' })
  return rows ? rows.map(toInsta).filter((p) => p.image && p.url) : seed.instaPosts
}

export async function getBundleRules(): Promise<BundleRule[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.rules)
  const rows = await fetchRows('bundle_rules', { published: false })
  return rows ? rows.filter((r) => r.active !== false).map(toBundleRule) : seed.bundleRules
}

export async function getCustomRules(): Promise<CustomRule[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.rules)
  const rows = await fetchRows('custom_rules', { published: false })
  return rows ? rows.map(toCustomRule) : seed.customRules
}

export async function getHoodieTiers(): Promise<HoodieTier[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.settings)
  const stored = await fetchSetting<HoodieTier[]>('hoodie_tiers')
  return Array.isArray(stored) && stored.length ? stored : seed.hoodieTiers
}

export async function getTeeFits(): Promise<TeeFit[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.settings)
  const stored = await fetchSetting<TeeFit[]>('tee_fits')
  return Array.isArray(stored) && stored.length ? stored : seed.teeFits
}
