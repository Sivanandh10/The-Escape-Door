// P4b — admin entity types + row mappers (DB snake_case ⇄ app types) + CrudConfigs.
// Mirrors supabase/migrations/0001_init.sql. Pure module (client + server safe).
import type {
  Attribution, BundleRule, CartItem, CartTotals, Collection, CustomRule, FestEvent, InstaPost, LeadKind, Partnership, Product, ProductImage,
  SiteSettings, Variant,
} from '@/lib/types'
import type { CrudConfig } from './data'
import { bool, num, str, strArr } from './util'

/** Every product type the shop knows (pickers in Products, Deals and Custom rules). */
export const PRODUCT_TYPES: Product['type'][] = [
  'tshirt', 'hoodie', 'polaroid', 'bookmark', 'poster', 'badge', 'sticker', 'keychain', 'cosplay', 'katana',
  'figurine', 'cape', 'accessory', 'hat', 'tote', 'stationery',
]

// ---------------------------------------------------------------- catalogue (+ admin-only columns)
export type AdminProduct = Product & { published: boolean; sortOrder: number }
export type AdminCollection = Collection & { published: boolean }
export type AdminEvent = FestEvent & { published: boolean; sortOrder: number }
export type AdminPartnership = Partnership & { published: boolean }
export type AdminInsta = InstaPost & { published: boolean }

const nowIso = () => new Date().toISOString()

export const productCfg: CrudConfig<AdminProduct> = {
  table: 'products',
  pk: 'id',
  order: { column: 'sort_order' },
  tags: ['products'],
  label: (p) => p.name,
  setOrder: (p, i) => ({ ...p, sortOrder: i }),
  fromRow: (r) => ({
    id: str(r.id), slug: str(r.slug), name: str(r.name), type: str(r.type) as Product['type'],
    collection: str(r.collection), tags: strArr(r.tags), designTitle: str(r.design_title, str(r.name)),
    ...(str(r.jp_title) ? { jpTitle: str(r.jp_title) } : {}),
    description: str(r.description),
    images: (Array.isArray(r.images) ? r.images : []) as ProductImage[],
    variants: (Array.isArray(r.variants) ? r.variants : []) as Variant[],
    ...(strArr(r.sizes).length ? { sizes: strArr(r.sizes) } : {}),
    priceFrom: num(r.price_from),
    ...(bool(r.price_on_request) ? { priceOnRequest: true } : {}),
    ...(str(r.bundle_rule_id) ? { bundleRuleId: str(r.bundle_rule_id) } : {}),
    customizable: bool(r.customizable), featured: bool(r.featured), dropOfWeek: bool(r.drop_of_week),
    stock: (['in', 'low', 'out', 'made-to-order'].includes(str(r.stock)) ? str(r.stock) : 'in') as Product['stock'],
    colorBlock: str(r.color_block, '#C9B8FF'),
    createdAt: str(r.created_at, nowIso()), updatedAt: str(r.updated_at, nowIso()),
    published: bool(r.is_published, true), sortOrder: num(r.sort_order) ?? 0,
  }),
  toRow: (p) => ({
    id: p.id, slug: p.slug, name: p.name, type: p.type, collection: p.collection, tags: p.tags,
    design_title: p.designTitle, jp_title: p.jpTitle || null, description: p.description,
    images: p.images, variants: p.variants, sizes: p.sizes?.length ? p.sizes : null,
    price_from: p.priceFrom, price_on_request: !!p.priceOnRequest, bundle_rule_id: p.bundleRuleId || null,
    customizable: p.customizable, featured: p.featured, drop_of_week: p.dropOfWeek, stock: p.stock,
    color_block: p.colorBlock, sort_order: p.sortOrder, is_published: p.published,
  }),
}

export const collectionCfg: CrudConfig<AdminCollection> = {
  table: 'collections',
  pk: 'slug',
  order: { column: 'sort_order' },
  // slug renames cascade to products.collection, and listings join arc names → refresh both
  tags: ['collections', 'products'],
  label: (c) => c.name,
  setOrder: (c, i) => ({ ...c, order: i }),
  fromRow: (r) => ({
    slug: str(r.slug), name: str(r.name), jp: str(r.jp), group: r.group_type === 'beyond' ? 'beyond' : 'anime',
    accentA: str(r.accent_a, '#6D3BFF'), accentB: str(r.accent_b, '#FFE14D'),
    motif: str(r.motif, 'speedlines') as Collection['motif'], tagline: str(r.tagline), blurb: str(r.blurb),
    order: num(r.sort_order) ?? 0, featured: bool(r.featured),
    ...(strArr(r.sub_fandoms).length ? { subFandoms: strArr(r.sub_fandoms) } : {}),
    published: bool(r.is_published, true),
  }),
  toRow: (c) => ({
    slug: c.slug, name: c.name, jp: c.jp, group_type: c.group, accent_a: c.accentA, accent_b: c.accentB, motif: c.motif,
    tagline: c.tagline, blurb: c.blurb, sort_order: c.order, featured: c.featured, sub_fandoms: c.subFandoms ?? [],
    is_published: c.published,
  }),
}

export const eventCfg: CrudConfig<AdminEvent> = {
  table: 'events',
  pk: 'id',
  order: { column: 'sort_order' },
  tags: ['events'],
  label: (e) => e.name,
  setOrder: (e, i) => ({ ...e, sortOrder: i }),
  fromRow: (r) => ({
    id: str(r.id), name: str(r.name), venue: str(r.venue), city: str(r.city),
    startDate: str(r.start_date) || null, endDate: str(r.end_date) || null, dateLabel: str(r.date_label),
    confirmed: bool(r.confirmed),
    kind: (['stall', 'popup', 'fest', 'online'].includes(str(r.kind)) ? str(r.kind) : 'stall') as FestEvent['kind'],
    status: r.status === 'past' ? 'past' : 'upcoming',
    published: bool(r.is_published, true), sortOrder: num(r.sort_order) ?? 0,
  }),
  toRow: (e) => ({
    id: e.id, name: e.name, venue: e.venue, city: e.city, start_date: e.startDate || null, end_date: e.endDate || null,
    date_label: e.dateLabel, confirmed: e.confirmed, kind: e.kind, status: e.status, sort_order: e.sortOrder,
    is_published: e.published,
  }),
}

export const partnershipCfg: CrudConfig<AdminPartnership> = {
  table: 'partnerships',
  pk: 'id',
  order: { column: 'sort_order' },
  tags: ['partnerships'],
  label: (p) => p.fest,
  setOrder: (p, i) => ({ ...p, order: i }),
  fromRow: (r) => ({
    id: str(r.id), fest: str(r.fest), institution: str(r.institution), years: str(r.years), role: str(r.role),
    ...(str(r.detail) ? { detail: str(r.detail) } : {}), order: num(r.sort_order) ?? 0,
    published: bool(r.is_published, true),
  }),
  toRow: (p) => ({
    id: p.id, fest: p.fest, institution: p.institution, years: p.years, role: p.role, detail: p.detail || null,
    sort_order: p.order, is_published: p.published,
  }),
}

export const instaCfg: CrudConfig<AdminInsta> = {
  table: 'insta_posts',
  pk: 'id',
  order: { column: 'sort_order' },
  tags: ['insta'],
  label: (p) => p.caption || 'Instagram post',
  setOrder: (p, i) => ({ ...p, order: i }),
  fromRow: (r) => ({
    id: str(r.id), image: str(r.image), url: str(r.url), caption: str(r.caption), order: num(r.sort_order) ?? 0,
    published: bool(r.is_published, true),
  }),
  toRow: (p) => ({ id: p.id, image: p.image, url: p.url, caption: p.caption, sort_order: p.order, is_published: p.published }),
}

// ---------------------------------------------------------------- pricing rules (tag 'rules')
/** Bundle deal + the admin-only `active` switch (inactive deals stay in the list but stop applying). */
export type AdminBundleRule = BundleRule & { active: boolean }

export const bundleRuleCfg: CrudConfig<AdminBundleRule> = {
  table: 'bundle_rules',
  pk: 'id',
  order: { column: 'id' },
  tags: ['rules'],
  label: (r) => r.label || r.id,
  fromRow: (r) => {
    const k = str(r.variant_attr_key), v = str(r.variant_attr_value)
    const price = num(r.price), free = num(r.free)
    return {
      id: str(r.id), label: str(r.label),
      appliesTo: { type: str(r.applies_type, 'polaroid') as BundleRule['appliesTo']['type'], ...(k && v ? { variantAttr: [k, v] as [string, string] } : {}) },
      kind: r.kind === 'buyXgetY' ? 'buyXgetY' : 'nForPrice',
      n: num(r.n) ?? 1,
      ...(price != null ? { price } : {}), ...(free != null ? { free } : {}),
      active: bool(r.active, true),
    }
  },
  toRow: (r) => ({
    id: r.id, label: r.label, applies_type: r.appliesTo.type,
    variant_attr_key: r.appliesTo.variantAttr?.[0] || null, variant_attr_value: r.appliesTo.variantAttr?.[1] || null,
    kind: r.kind, n: r.n,
    price: r.kind === 'nForPrice' ? (r.price ?? null) : null,
    free: r.kind === 'buyXgetY' ? (r.free ?? null) : null,
    active: r.active,
  }),
}

/** Custom-order rule per product type (pk = type). */
export type AdminCustomRule = CustomRule

export const customRuleCfg: CrudConfig<AdminCustomRule> = {
  table: 'custom_rules',
  pk: 'type',
  order: { column: 'type' },
  tags: ['rules'],
  label: (r) => `${r.type} custom rule`,
  fromRow: (r) => ({ type: str(r.type) as CustomRule['type'], minQty: num(r.min_qty) ?? 1, unitPrice: num(r.unit_price), note: str(r.note) }),
  toRow: (r) => ({ type: r.type, min_qty: r.minQty, unit_price: r.unitPrice, note: r.note }),
}

// ---------------------------------------------------------------- settings (key/value row 'site')
export type SettingsRow = { key: string; value: SiteSettings }
export const settingsCfg: CrudConfig<SettingsRow> = {
  table: 'settings',
  pk: 'id', // overridden: settings uses `key` — handled by SettingsManager directly
  tags: ['settings'],
  label: () => 'Site settings',
  fromRow: (r) => ({ key: str(r.key), value: r.value as SiteSettings }),
  toRow: (s) => ({ key: s.key, value: s.value }),
}

// ---------------------------------------------------------------- leads & orders
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed' | 'spam'
export interface AdminLead {
  id: string
  kind: LeadKind
  name: string
  city: string
  contact: string
  message: string
  payload: Record<string, unknown> | null
  source: Attribution | null
  src: string
  status: LeadStatus
  createdAt: string
  updatedAt: string
  /** owner notes — stored inside payload._admin.notes (the leads table has no notes column) */
  notes: string
}

export const LEAD_STATUSES: Array<{ id: LeadStatus; label: string; jp: string; tone: string }> = [
  { id: 'new', label: 'New', jp: '新規', tone: 'bg-volt text-ink' },
  { id: 'contacted', label: 'Contacted', jp: '連絡済', tone: 'bg-lav text-ink' },
  { id: 'converted', label: 'Won', jp: '成約', tone: 'bg-door text-paper' },
  { id: 'closed', label: 'Lost', jp: '失注', tone: 'bg-tone-3 text-paper' },
]
export const SPAM_STATUS = { id: 'spam' as const, label: 'Spam', jp: '迷惑', tone: 'bg-hype text-paper' }

export const LEAD_KINDS: Array<{ id: LeadKind; label: string; short: string }> = [
  { id: 'whatsapp_order', label: 'WhatsApp order', short: 'Order' },
  { id: 'custom_request', label: 'Custom request', short: 'Custom' },
  { id: 'remind_me', label: 'Remind me', short: 'Remind' },
  { id: 'newsletter', label: 'Newsletter', short: 'News' },
  { id: 'exit_intent', label: 'Exit intent', short: 'Exit' },
]

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export const leadCfg: CrudConfig<AdminLead> = {
  table: 'leads',
  pk: 'id',
  order: { column: 'created_at', ascending: false },
  label: (l) => l.name || l.contact || 'lead',
  fromRow: (r) => {
    const payload = asObj(r.payload)
    const admin = asObj(payload?._admin)
    return {
      id: str(r.id),
      kind: str(r.kind, 'newsletter') as LeadKind,
      name: str(r.name), city: str(r.city), contact: str(r.contact), message: str(r.message),
      payload, source: asObj(r.source) as Attribution | null, src: str(r.src),
      status: (['new', 'contacted', 'converted', 'closed', 'spam'].includes(str(r.status)) ? str(r.status) : 'new') as LeadStatus,
      createdAt: str(r.created_at, nowIso()), updatedAt: str(r.updated_at, nowIso()),
      notes: str(admin?.notes),
    }
  },
  toRow: (l) => ({
    id: l.id, kind: l.kind, name: l.name || null, city: l.city || null, contact: l.contact || null,
    message: l.message || null,
    payload: { ...(l.payload ?? {}), _admin: { ...(asObj(l.payload?._admin) ?? {}), notes: l.notes } },
    source: l.source, src: l.src || null, status: l.status,
  }),
}

export type OrderStatus = 'new' | 'confirmed' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
export const ORDER_STATUSES: Array<{ id: OrderStatus; label: string; jp: string; tone: string }> = [
  { id: 'new', label: 'New', jp: '新規', tone: 'bg-volt text-ink' },
  { id: 'confirmed', label: 'Confirmed', jp: '確認', tone: 'bg-lav text-ink' },
  { id: 'paid', label: 'Paid', jp: '入金', tone: 'bg-door text-paper' },
  { id: 'shipped', label: 'Shipped', jp: '発送', tone: 'bg-pink text-ink' },
  { id: 'delivered', label: 'Delivered', jp: '配達', tone: 'bg-paper text-ink' },
  { id: 'cancelled', label: 'Cancelled', jp: '取消', tone: 'bg-tone-3 text-paper' },
]

export interface AdminOrder {
  id: string
  leadId: string | null
  items: CartItem[]
  totals: CartTotals | null
  subtotal: number | null
  savings: number | null
  total: number | null
  name: string
  city: string
  contact: string
  note: string
  src: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export const orderCfg: CrudConfig<AdminOrder> = {
  table: 'orders',
  pk: 'id',
  order: { column: 'created_at', ascending: false },
  label: (o) => `Order ${o.id.slice(0, 6).toUpperCase()}`,
  fromRow: (r) => ({
    id: str(r.id), leadId: str(r.lead_id) || null,
    items: (Array.isArray(r.items) ? r.items : []) as CartItem[],
    totals: (asObj(r.totals) as CartTotals | null) ?? null,
    subtotal: num(r.subtotal), savings: num(r.savings), total: num(r.total),
    name: str(r.name), city: str(r.city), contact: str(r.contact), note: str(r.note), src: str(r.src),
    status: (ORDER_STATUSES.some((s) => s.id === r.status) ? r.status : 'new') as OrderStatus,
    createdAt: str(r.created_at, nowIso()), updatedAt: str(r.updated_at, nowIso()),
  }),
  toRow: (o) => ({
    id: o.id, lead_id: o.leadId, items: o.items, totals: o.totals, subtotal: o.subtotal, savings: o.savings,
    total: o.total, name: o.name || null, city: o.city || null, contact: o.contact || null, note: o.note || null,
    src: o.src || null, status: o.status,
  }),
}

/** Pull cart lines + totals out of a whatsapp_order lead payload (shape from P2's checkout). */
export function orderFromLead(l: AdminLead, id: string): AdminOrder {
  const p = l.payload ?? {}
  const items = (Array.isArray(p.items) ? p.items : []) as CartItem[]
  const totals = (asObj(p.totals) as CartTotals | null) ?? null
  return {
    id, leadId: l.id, items, totals,
    subtotal: totals?.subtotal ?? null, savings: totals?.savings ?? null, total: totals?.total ?? null,
    name: l.name, city: l.city, contact: l.contact, note: l.message, src: l.src, status: 'new',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}

/** All custom-upload references inside a lead payload (fileUrls / files / paths, any depth ≤ 3). */
export function fileRefs(payload: unknown, depth = 0): string[] {
  if (!payload || depth > 3) return []
  if (Array.isArray(payload)) return payload.flatMap((x) => fileRefs(x, depth + 1))
  if (typeof payload !== 'object') return []
  const out: string[] = []
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (k === '_admin') continue
    if (/^(fileUrls|files|paths|uploads|fileUrl|file|path|referenceUrls?)$/i.test(k)) {
      const list = Array.isArray(v) ? v : [v]
      for (const x of list) {
        if (typeof x === 'string' && x) out.push(x)
        else if (x && typeof x === 'object' && typeof (x as { path?: unknown }).path === 'string') out.push((x as { path: string }).path)
        else if (x && typeof x === 'object' && typeof (x as { url?: unknown }).url === 'string') out.push((x as { url: string }).url)
      }
    } else if (v && typeof v === 'object') out.push(...fileRefs(v, depth + 1))
  }
  return [...new Set(out)]
}
