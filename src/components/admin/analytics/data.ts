// Analytics aggregator (P4a) — server only (reads cookies via the owner's Supabase session).
// Real mode: scans analytics_events (+ leads) for the range and the previous range under RLS, aggregates in JS.
// Honest counting, applied to stored history too (no rows are deleted):
//   visits = distinct sessions · unique visitors = distinct visitor ids ·
//   page views = page_view rows de-duplicated to one per session + path (reloads don't inflate) ·
//   funnel / WhatsApp / add-to-cart = distinct sessions. Rows on /admin, /lab, /api and every row of a
//   visitor id that ever opened /admin (staff browsers) are ignored.
// Revenue: real orders (public.orders.total, status ≠ cancelled) as soon as the orders table has any row;
// before that, the sum of WhatsApp-order lead totals, labelled as an estimate (`revenueSource`).
// Demo mode (Supabase missing): deterministic seeded sample data, clearly flagged `demo: true` — never real.
// When Supabase IS configured the sample data is never used: a failed query returns zeros + `error`.
import { connection } from 'next/server'
import { getAdminContext } from '../server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { can } from '@/lib/admin/permissions'
import { getCollections, getEvents, getPartnerships, getProducts } from '@/lib/data/repo'
import { hashString, seeded } from '@/lib/utils'
import type { AnalyticsSnapshot, Kpis, Ranked, SeriesPoint, SrcRow } from './types'

const DAY = 86_400_000
const PAGE = 1000
const MAX_ROWS = 60_000
const EXCLUDED_PATH = /^\/(admin|lab|api)(\/|$)/

interface EventRow {
  ts: string
  visitor_id: string
  session_id: string
  name: string
  path: string
  props: Record<string, unknown> | null
  src: string | null
  utm_source: string | null
  referrer: string | null
  device: string | null
  country: string | null
  region: string | null
  city: string | null
}
interface LeadRow { kind: string; src: string | null; payload: unknown; created_at: string }
interface OrderRow { total: number | null; status: string; src: string | null; created_at: string }
type Fetched<T> = { rows: T[]; error: string | null; capped: boolean }
/** orders that never count as revenue */
const NOT_REVENUE = new Set(['cancelled'])

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10)
const dayLabel = (k: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const startOfUtcDay = (t: number) => Math.floor(t / DAY) * DAY

function integrations(supabase: boolean) {
  return {
    supabase,
    tracking: supabase && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    ga4: Boolean(process.env.NEXT_PUBLIC_GA4_ID),
    clarity: Boolean(process.env.NEXT_PUBLIC_CLARITY_ID),
  }
}

function top(map: Map<string, number>, limit: number, label: (k: string) => string = (k) => k, extra?: Map<string, number>): Ranked[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, label: label(key), value, ...(extra ? { extra: extra.get(key) ?? 0 } : {}) }))
}
const inc = (m: Map<string, number>, k: string | null | undefined, by = 1) => {
  if (!k) return
  m.set(k, (m.get(k) ?? 0) + by)
}

function orderTotal(payload: unknown): number {
  const p = payload as { totals?: { total?: unknown }; total?: unknown } | null
  const v = Number(p?.totals?.total ?? p?.total ?? 0)
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** Known fest/stall QR sources: partnerships + events (id without prefix). */
export async function knownSrcs(): Promise<{ src: string; label: string }[]> {
  const [pts, evs] = await Promise.all([getPartnerships(), getEvents()])
  const out = new Map<string, string>()
  for (const p of pts) out.set(p.id.replace(/^pt-/, ''), p.institution ? `${p.fest} · ${p.institution}` : p.fest)
  for (const e of evs) out.set(e.id.replace(/^ev-/, ''), e.name)
  return [...out.entries()].map(([src, label]) => ({ src, label }))
}

// ────────────────────────────────────────────────────────────── real data
/**
 * Raw analytics rows (visitor ids, referrers, cities) are readable under RLS only with analytics.view.
 * Dashboard-only / QR-only members get aggregates computed here with the service role; the deep-dive
 * parts (pages, sources, geography) are then stripped by `limitSnapshot` before anything reaches them.
 */
async function eventsClient() {
  const ctx = await getAdminContext()
  const perms = ctx.session?.perms ?? []
  if (!can(perms, 'analytics.view') && (can(perms, 'dashboard.view') || can(perms, 'qr.use'))) {
    const sa = supabaseAdmin()
    if (sa) return sa
  }
  return supabaseServer()
}

async function fetchEvents(fromIso: string, toIso: string): Promise<{ rows: EventRow[]; capped: boolean; error: string | null }> {
  const sb = await eventsClient()
  if (!sb) return { rows: [], capped: false, error: 'Supabase client unavailable' }
  const rows: EventRow[] = []
  for (let i = 0; i < MAX_ROWS; i += PAGE) {
    const { data, error } = await sb
      .from('analytics_events')
      .select('ts,visitor_id,session_id,name,path,props,src,utm_source,referrer,device,country,region,city')
      .gte('ts', fromIso)
      .lt('ts', toIso)
      // scroll depth / time on page are never aggregated; skipping them keeps a late page_leave
      // (sent after the visit ended, or after midnight) from showing up as an extra visit.
      .not('name', 'in', '(scroll_depth,page_leave)')
      .order('ts', { ascending: true })
      .order('id', { ascending: true }) // stable paging when timestamps tie
      .range(i, i + PAGE - 1)
    if (error) return { rows, capped: false, error: error.message }
    rows.push(...((data ?? []) as EventRow[]))
    if (!data || data.length < PAGE) return { rows, capped: false, error: null }
  }
  return { rows, capped: true, error: null }
}

/** Visitor ids that ever opened an /admin page (owner / staff browsers): excluded from every number. */
async function fetchStaffVisitors(): Promise<Set<string>> {
  const sb = await eventsClient()
  const out = new Set<string>()
  if (!sb) return out
  // Supabase caps a response at 1000 rows, so page through (page views only: one per admin page opened).
  for (let i = 0; i < 20 * PAGE; i += PAGE) {
    const { data, error } = await sb
      .from('analytics_events')
      .select('visitor_id')
      .eq('name', 'page_view')
      .or('path.eq./admin,path.like./admin/*')
      .order('id', { ascending: true })
      .range(i, i + PAGE - 1)
    if (error || !data) break
    for (const r of data as { visitor_id: string }[]) out.add(r.visitor_id)
    if (data.length < PAGE) break
  }
  return out
}

/** Drop staff visitors and internal paths. */
function publicRows(rows: EventRow[], staff: Set<string>): EventRow[] {
  return rows.filter((r) => !EXCLUDED_PATH.test(r.path) && !staff.has(r.visitor_id))
}

/**
 * Lead counts for the KPIs. Members who may see insights (dashboard / analytics / QR) but not the lead
 * inbox still get the aggregate numbers: the rows are read server-side with the service role and only
 * counted here — names / contacts never leave the server. Everyone else reads under RLS.
 */
async function leadsClient() {
  const ctx = await getAdminContext()
  const perms = ctx.session?.perms ?? []
  const insights = (['dashboard.view', 'analytics.view', 'qr.use'] as const).some((p) => can(perms, p))
  if (insights && !can(perms, 'leads.view')) {
    const sa = supabaseAdmin()
    if (sa) return sa
  }
  return supabaseServer()
}

async function fetchLeads(fromIso: string, toIso: string): Promise<Fetched<LeadRow>> {
  const sb = await leadsClient()
  if (!sb) return { rows: [], error: 'Supabase client unavailable', capped: false }
  const rows: LeadRow[] = []
  // page through (Supabase caps one response at 1000 rows) — a silent cap would undercount leads
  for (let i = 0; i < 20 * PAGE; i += PAGE) {
    const { data, error } = await sb
      .from('leads')
      .select('kind,src,payload,created_at')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(i, i + PAGE - 1)
    if (error) return { rows, error: error.message, capped: false }
    rows.push(...((data ?? []) as LeadRow[]))
    if (!data || data.length < PAGE) return { rows, error: null, capped: false }
  }
  return { rows, error: null, capped: true }
}

/** Same rule as leads: orders.view reads under RLS; insight-only members get server-side counts (service role). */
async function ordersClient() {
  const ctx = await getAdminContext()
  const perms = ctx.session?.perms ?? []
  const insights = (['dashboard.view', 'analytics.view', 'qr.use'] as const).some((p) => can(perms, p))
  if (insights && !can(perms, 'orders.view')) {
    const sa = supabaseAdmin()
    if (sa) return sa
  }
  return supabaseServer()
}

/** Does the orders table hold any order yet? Decides the revenue source for every range (deltas compare like with like). */
async function ordersExist(): Promise<{ yes: boolean; error: string | null }> {
  const sb = await ordersClient()
  if (!sb) return { yes: false, error: 'Supabase client unavailable' }
  const { count, error } = await sb.from('orders').select('id', { count: 'exact', head: true })
  if (error) return { yes: false, error: error.message }
  return { yes: (count ?? 0) > 0, error: null }
}

async function fetchOrders(fromIso: string, toIso: string): Promise<Fetched<OrderRow>> {
  const sb = await ordersClient()
  if (!sb) return { rows: [], error: 'Supabase client unavailable', capped: false }
  const rows: OrderRow[] = []
  for (let i = 0; i < 20 * PAGE; i += PAGE) {
    const { data, error } = await sb
      .from('orders')
      .select('total,status,src,created_at')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(i, i + PAGE - 1)
    if (error) return { rows, error: error.message, capped: false }
    rows.push(...((data ?? []) as OrderRow[]).filter((o) => !NOT_REVENUE.has(o.status)))
    if (!data || data.length < PAGE) return { rows, error: null, capped: false }
  }
  return { rows, error: null, capped: true }
}

const orderValue = (o: OrderRow) => (typeof o.total === 'number' && Number.isFinite(o.total) && o.total > 0 ? o.total : 0)

const pvKey = (r: EventRow) => `${r.session_id}\u0000${r.path}`

/** `orders` = real (non-cancelled) orders when the orders table is the revenue source, else null → lead estimate. */
function kpisFrom(rows: EventRow[], leads: LeadRow[], orders: OrderRow[] | null): Kpis {
  const visitors = new Set<string>(), sessions = new Set<string>(), cartSessions = new Set<string>(), waSessions = new Set<string>()
  const pageViews = new Set<string>()
  let adds = 0, wa = 0
  for (const r of rows) {
    sessions.add(r.session_id)
    visitors.add(r.visitor_id)
    if (r.name === 'page_view') pageViews.add(pvKey(r))
    else if (r.name === 'add_to_cart') { adds++; cartSessions.add(r.session_id) }
    else if (r.name === 'whatsapp_click') { wa++; waSessions.add(r.session_id) }
  }
  const waOrders = leads.filter((l) => l.kind === 'whatsapp_order')
  return {
    visits: sessions.size,
    uniques: visitors.size,
    sessions: sessions.size,
    pageViews: pageViews.size,
    addToCart: adds,
    cartSessions: cartSessions.size,
    addToCartRate: sessions.size ? cartSessions.size / sessions.size : 0,
    whatsappClicks: waSessions.size,
    whatsappRaw: wa,
    leads: leads.length,
    orders: orders ? orders.length : waOrders.length,
    revenueEstimate: orders ? orders.reduce((s, o) => s + orderValue(o), 0) : waOrders.reduce((s, l) => s + orderTotal(l.payload), 0),
  }
}

function sourceOf(r: EventRow): string {
  if (r.src) return `qr:${r.src}`
  if (r.utm_source) return r.utm_source.toLowerCase()
  if (r.referrer) {
    try {
      const h = new URL(r.referrer).hostname.replace(/^www\./, '').replace(/^l\./, '').replace(/^m\./, '')
      if (/instagram/.test(h)) return 'instagram'
      if (/google\./.test(h)) return 'google'
      if (/whatsapp|wa\.me/.test(h)) return 'whatsapp'
      return h
    } catch { /* ignore */ }
  }
  return 'direct'
}

async function realSnapshot(days: number): Promise<AnalyticsSnapshot> {
  const end = startOfUtcDay(Date.now()) + DAY
  const from = end - days * DAY
  const prevFrom = from - days * DAY
  const iso = (t: number) => new Date(t).toISOString()
  const [cur, prev, leadsRes, prevLeadsRes, collections, products, staff, hasOrders] = await Promise.all([
    fetchEvents(iso(from), iso(end)),
    fetchEvents(iso(prevFrom), iso(from)),
    fetchLeads(iso(from), iso(end)),
    fetchLeads(iso(prevFrom), iso(from)),
    getCollections(),
    getProducts(),
    fetchStaffVisitors(),
    ordersExist(),
  ])
  const [ordersRes, prevOrdersRes] = hasOrders.yes
    ? await Promise.all([fetchOrders(iso(from), iso(end)), fetchOrders(iso(prevFrom), iso(from))])
    : [null, null]
  const leads = leadsRes.rows
  const prevLeads = prevLeadsRes.rows
  const orders = ordersRes && !ordersRes.error ? ordersRes.rows : null
  const prevOrders = prevOrdersRes && !prevOrdersRes.error ? prevOrdersRes.rows : null
  const revenueSource: 'orders' | 'leads' = orders ? 'orders' : 'leads'
  const warnings: string[] = []
  if (leadsRes.error) warnings.push(`Leads didn’t load (${leadsRes.error}) — lead counts and the revenue estimate are incomplete.`)
  if (hasOrders.error || ordersRes?.error) warnings.push(`Orders didn’t load (${hasOrders.error ?? ordersRes?.error}) — revenue falls back to WhatsApp order estimates.`)
  if (leadsRes.capped || ordersRes?.capped) warnings.push('More than 20,000 leads or orders in this range — pick a shorter range for exact totals.')
  const rows = publicRows(cur.rows, staff)
  const prevRows = publicRows(prev.rows, staff)
  const colName = new Map(collections.map((c) => [c.slug, c.name]))
  const prodName = new Map(products.map((p) => [p.slug, p.name]))

  // series: a session belongs to the day it started; WhatsApp = sessions with a click that day
  const byDay = new Map<string, { v: number; u: Set<string>; w: Set<string> }>()
  for (let t = from; t < end; t += DAY) byDay.set(dayKey(t), { v: 0, u: new Set(), w: new Set() })
  const pages = new Map<string, number>(), pageVisitors = new Map<string, Set<string>>()
  const cols = new Map<string, number>(), prodViews = new Map<string, number>(), prodAdds = new Map<string, number>()
  const firstOfSession = new Map<string, EventRow>()
  const seenPv = new Set<string>()
  const funnelSets = { view: new Set<string>(), cart: new Set<string>(), checkout: new Set<string>(), wa: new Set<string>() }
  const srcSessions = new Map<string, Set<string>>(), srcVisitors = new Map<string, Set<string>>()
  const addTo = (m: Map<string, Set<string>>, k: string, v: string) => {
    let set = m.get(k)
    if (!set) { set = new Set(); m.set(k, set) }
    set.add(v)
  }

  for (const r of rows) {
    if (!firstOfSession.has(r.session_id)) firstOfSession.set(r.session_id, r)
    if (r.src) { addTo(srcSessions, r.src, r.session_id); addTo(srcVisitors, r.src, r.visitor_id) }
    if (r.name === 'page_view') {
      const key = pvKey(r)
      if (seenPv.has(key)) continue // reload / repeat of the same page in the same session
      seenPv.add(key)
      inc(pages, r.path)
      addTo(pageVisitors, r.path, r.visitor_id)
      const arc = r.path.match(/^\/arc\/([^/?#]+)/)?.[1]
      if (arc) inc(cols, arc)
      const prod = r.path.match(/^\/product\/([^/?#]+)/)?.[1]
      if (prod) { inc(prodViews, prod); funnelSets.view.add(r.session_id) }
    } else if (r.name === 'product_view') {
      funnelSets.view.add(r.session_id)
    } else if (r.name === 'add_to_cart') {
      funnelSets.cart.add(r.session_id)
      const slug = String((r.props?.product ?? r.props?.slug ?? '') || '')
      if (slug) inc(prodAdds, slug)
    } else if (r.name === 'checkout_start') {
      funnelSets.checkout.add(r.session_id)
    } else if (r.name === 'whatsapp_click') {
      funnelSets.wa.add(r.session_id)
      byDay.get(r.ts.slice(0, 10))?.w.add(r.session_id)
    } else if (r.name === 'collection_open') {
      const slug = String(r.props?.collection ?? r.props?.slug ?? '')
      if (slug) inc(cols, slug)
    }
  }
  for (const r of firstOfSession.values()) {
    const d = byDay.get(r.ts.slice(0, 10))
    if (d) { d.v++; d.u.add(r.visitor_id) }
  }
  const pageUniques = new Map([...pageVisitors].map(([k, v]) => [k, v.size]))
  // funnel is cumulative: a WhatsApp click implies the earlier steps
  const reached = (s: Set<string>, ...later: Set<string>[]) => new Set([...s, ...later.flatMap((x) => [...x])]).size

  const sources = new Map<string, number>(), devices = new Map<string, number>(), countries = new Map<string, number>(), regions = new Map<string, number>(), cities = new Map<string, number>()
  for (const r of firstOfSession.values()) {
    inc(sources, sourceOf(r))
    inc(devices, r.device ?? 'unknown')
    inc(countries, r.country)
    inc(regions, r.region)
    inc(cities, r.city)
  }

  const srcRows = new Map<string, SrcRow>()
  const srcRow = (src: string) => {
    if (!srcRows.has(src)) srcRows.set(src, { src, visits: 0, uniques: 0, leads: 0, orders: 0, revenue: 0 })
    return srcRows.get(src)!
  }
  for (const [src, v] of srcSessions) { const s = srcRow(src); s.visits = v.size; s.uniques = srcVisitors.get(src)?.size ?? 0 }
  const kinds = new Map<string, number>()
  for (const l of leads) {
    inc(kinds, l.kind)
    if (!l.src) continue
    const s = srcRow(l.src)
    s.leads++
    if (!orders && l.kind === 'whatsapp_order') { s.orders++; s.revenue += orderTotal(l.payload) }
  }
  if (orders) {
    for (const o of orders) {
      if (!o.src) continue
      const s = srcRow(o.src)
      s.orders++
      s.revenue += orderValue(o)
    }
  }

  // previous range compares like with like (same revenue source); no deltas at all when a query failed
  const prevK = kpisFrom(prevRows, prevLeads, orders ? (prevOrders ?? []) : null)
  const prevOk = !prev.error && !prevLeadsRes.error && (!orders || !!prevOrders)
  return {
    demo: false,
    error: cur.error,
    days,
    from: dayKey(from),
    to: dayKey(end - DAY),
    kpis: kpisFrom(rows, leads, orders),
    prev: prevOk ? prevK : null,
    revenueSource,
    warnings,
    generatedAt: new Date().toISOString(),
    series: [...byDay.entries()].map(([date, x]) => ({ date, label: dayLabel(date), visits: x.v, uniques: x.u.size, whatsapp: x.w.size })),
    topPages: top(pages, 10, (k) => k, pageUniques),
    topCollections: top(cols, 8, (k) => colName.get(k) ?? k),
    topProducts: top(prodViews, 8, (k) => prodName.get(k) ?? k, prodAdds),
    funnel: [
      { id: 'view', label: 'Viewed a product', jp: '閲覧', sessions: reached(funnelSets.view, funnelSets.cart, funnelSets.checkout, funnelSets.wa) },
      { id: 'cart', label: 'Added to cart', jp: 'カート', sessions: reached(funnelSets.cart, funnelSets.checkout, funnelSets.wa) },
      { id: 'checkout', label: 'Started checkout', jp: '注文開始', sessions: reached(funnelSets.checkout, funnelSets.wa) },
      { id: 'wa', label: 'Opened WhatsApp', jp: '送信', sessions: funnelSets.wa.size },
    ],
    sources: top(sources, 10, (k) => (k.startsWith('qr:') ? `QR · ${k.slice(3)}` : k)),
    srcs: [...srcRows.values()].sort((a, b) => b.visits - a.visits || b.leads - a.leads),
    devices: top(devices, 4),
    countries: top(countries, 8),
    regions: top(regions, 8),
    cities: top(cities, 10),
    leadsByKind: top(kinds, 6),
    integrations: integrations(true),
    scanned: cur.rows.length,
    capped: cur.capped,
  }
}

// ────────────────────────────────────────────────────────────── demo data (seeded, labelled)
async function demoSnapshot(days: number): Promise<AnalyticsSnapshot> {
  const [collections, products, srcList] = await Promise.all([getCollections(), getProducts(), knownSrcs()])
  const end = startOfUtcDay(Date.now()) + DAY
  const from = end - days * DAY

  // daily sessions (visits) with a weekly shape, slow trend and the odd fest-stall spike
  const daySessions = (t: number) => {
    const r = seeded(hashString(dayKey(t)))
    const dow = new Date(t).getUTCDay()
    const weekly = dow === 0 || dow === 6 ? 1.28 : dow === 5 ? 1.12 : 1
    const trend = 1 + ((t / DAY) % 365) / 900
    const spike = r() > 0.93 ? 2.1 : 1
    return Math.round((64 + r() * 30) * weekly * trend * spike)
  }
  const build = (a: number, b: number) => {
    const series: SeriesPoint[] = []
    let visits = 0, dailyUniques = 0, pageViews = 0, waSessions = 0
    for (let t = a; t < b; t += DAY) {
      const r = seeded(hashString(dayKey(t)) ^ 0x9e37)
      const v = daySessions(t)
      const u = Math.round(v * (0.78 + r() * 0.08))
      const w = Math.round(v * (0.05 + r() * 0.025))
      visits += v; dailyUniques += u; waSessions += w
      pageViews += Math.round(v * (2.1 + r() * 0.6))
      const k = dayKey(t)
      series.push({ date: k, label: dayLabel(k), visits: v, uniques: u, whatsapp: w })
    }
    const cartSessions = Math.round(visits * 0.068)
    const orders = Math.round(waSessions * 0.74)
    const kpis: Kpis = {
      visits,
      uniques: Math.round(dailyUniques * 0.86), // returning visitors across days
      sessions: visits,
      pageViews,
      addToCart: Math.round(cartSessions * 1.35),
      cartSessions,
      addToCartRate: visits ? cartSessions / visits : 0,
      whatsappClicks: waSessions,
      whatsappRaw: Math.round(waSessions * 1.3),
      leads: orders + Math.round(waSessions * 0.31),
      orders,
      revenueEstimate: orders * 1340,
    }
    return { series, kpis }
  }
  const cur = build(from, end)
  const prev = build(from - days * DAY, from)
  const k = cur.kpis
  const r = seeded(days * 7919 + 17)
  const share = (n: number, weights: number[]) => {
    const sum = weights.reduce((s, w) => s + w, 0)
    return weights.map((w) => Math.round((n * w) / sum))
  }

  const pageList = ['/', '/shop', '/custom', '/shop/t-shirts', '/fests', '/shop/hoodies', '/shop/polaroids', '/cosplay', '/faq', '/about']
  const pageW = [34, 16, 9, 8, 6, 5, 5, 4, 2, 1.5]
  const pagesV = share(k.pageViews, pageW)
  const colW = collections.map((_, i) => 10 / (i + 1.4) + r() * 2)
  const colV = share(k.pageViews * 0.14, colW)
  const prodPick = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 8)
  const prodV = share(k.pageViews * 0.16, prodPick.map((_, i) => 9 / (i + 1.2) + r()))
  const srcPick = srcList.slice(0, 7)
  const srcV = share(k.visits * 0.12, srcPick.map((_, i) => 8 / (i + 1) + r() * 2))

  const view = Math.round(k.sessions * 0.41)
  return {
    demo: true,
    error: null,
    days,
    from: dayKey(from),
    to: dayKey(end - DAY),
    kpis: k,
    prev: prev.kpis,
    revenueSource: 'leads',
    warnings: [],
    generatedAt: new Date().toISOString(),
    series: cur.series,
    topPages: pageList.map((p, i) => ({ key: p, label: p, value: pagesV[i], extra: Math.round(pagesV[i] * 0.82) })),
    topCollections: collections.map((c, i) => ({ key: c.slug, label: c.name, value: colV[i] })).sort((a, b) => b.value - a.value),
    topProducts: prodPick.map((p, i) => ({ key: p.slug, label: p.name, value: prodV[i], extra: Math.round(prodV[i] * (0.09 + r() * 0.06)) })),
    funnel: [
      { id: 'view', label: 'Viewed a product', jp: '閲覧', sessions: view },
      { id: 'cart', label: 'Added to cart', jp: 'カート', sessions: k.cartSessions },
      { id: 'checkout', label: 'Started checkout', jp: '注文開始', sessions: Math.round(k.whatsappClicks * 1.45) },
      { id: 'wa', label: 'Opened WhatsApp', jp: '送信', sessions: k.whatsappClicks },
    ],
    sources: (() => {
      const names = ['instagram', 'direct', 'google', ...srcPick.slice(0, 3).map((s) => `QR · ${s.src}`), 'whatsapp']
      const v = share(k.sessions, [38, 24, 15, 7, 5, 3, 8])
      return names.map((n, i) => ({ key: n, label: n, value: v[i] }))
    })(),
    srcs: srcPick.map((s, i) => {
      const leads = Math.round(srcV[i] * (0.025 + r() * 0.02))
      const orders = Math.round(leads * 0.6)
      return { src: s.src, visits: srcV[i], uniques: Math.round(srcV[i] * 0.7), leads, orders, revenue: orders * 1200 }
    }),
    devices: (() => {
      const v = share(k.sessions, [78, 19, 3])
      return [{ key: 'mobile', label: 'mobile', value: v[0] }, { key: 'desktop', label: 'desktop', value: v[1] }, { key: 'tablet', label: 'tablet', value: v[2] }]
    })(),
    countries: [{ key: 'IN', label: 'India', value: Math.round(k.sessions * 0.96) }, { key: 'AE', label: 'UAE', value: Math.round(k.sessions * 0.02) }, { key: 'US', label: 'United States', value: Math.round(k.sessions * 0.01) }],
    regions: (() => {
      const names = ['Madhya Pradesh', 'Uttarakhand', 'Maharashtra', 'Gujarat', 'West Bengal', 'Assam', 'Rajasthan', 'Delhi']
      const v = share(k.sessions * 0.9, [22, 16, 15, 12, 10, 8, 7, 6])
      return names.map((n, i) => ({ key: n, label: n, value: v[i] }))
    })(),
    cities: (() => {
      const names = ['Bhopal', 'Roorkee', 'Surat', 'Kolkata', 'Indore', 'Kolhapur', 'Guwahati', 'Jodhpur', 'Mumbai', 'Delhi']
      const v = share(k.sessions * 0.8, [18, 13, 11, 10, 9, 8, 7, 6, 5, 5])
      return names.map((n, i) => ({ key: n, label: n, value: v[i] }))
    })(),
    leadsByKind: [
      { key: 'whatsapp_order', label: 'whatsapp_order', value: k.orders },
      { key: 'custom_request', label: 'custom_request', value: Math.round(k.leads * 0.14) },
      { key: 'remind_me', label: 'remind_me', value: Math.round(k.leads * 0.08) },
      { key: 'newsletter', label: 'newsletter', value: Math.round(k.leads * 0.05) },
    ],
    integrations: integrations(false),
    scanned: 0,
    capped: false,
  }
}

/**
 * Without analytics.view a member only gets the dashboard KPIs, series, funnel, top collections /
 * products and devices. Pages, traffic sources and geography are the analytics deep-dive and are
 * removed here, server-side, so they never reach the browser. QR rows stay for qr.use (QR studio).
 */
function limitSnapshot(s: AnalyticsSnapshot, perms: readonly string[]): AnalyticsSnapshot {
  if (can(perms, 'analytics.view')) return s
  return {
    ...s,
    limited: true,
    topPages: [],
    sources: [],
    countries: [],
    regions: [],
    cities: [],
    srcs: can(perms, 'qr.use') ? s.srcs : [],
  }
}

/** All-zero snapshot for a failed real query: the error is shown instead — never sample numbers. */
function emptySnapshot(days: number, error: string): AnalyticsSnapshot {
  const end = startOfUtcDay(Date.now()) + DAY
  const from = end - days * DAY
  const zero: Kpis = {
    visits: 0, uniques: 0, sessions: 0, pageViews: 0, addToCart: 0, cartSessions: 0, addToCartRate: 0,
    whatsappClicks: 0, whatsappRaw: 0, leads: 0, orders: 0, revenueEstimate: 0,
  }
  const series: SeriesPoint[] = []
  for (let t = from; t < end; t += DAY) series.push({ date: dayKey(t), label: dayLabel(dayKey(t)), visits: 0, uniques: 0, whatsapp: 0 })
  return {
    demo: false, error, days, from: dayKey(from), to: dayKey(end - DAY), kpis: zero, prev: null,
    revenueSource: 'leads', warnings: [], generatedAt: new Date().toISOString(), series,
    topPages: [], topCollections: [], topProducts: [], funnel: [], sources: [], srcs: [], devices: [],
    countries: [], regions: [], cities: [], leadsByKind: [], integrations: integrations(true), scanned: 0, capped: false,
  }
}

/** Snapshot for the last `days` days (UTC). Demo data ONLY when Supabase is unconfigured. Never throws. */
export async function getAnalytics(days: number): Promise<AnalyticsSnapshot> {
  await connection() // request-time: uses Date.now() for the range
  const ctx = await getAdminContext()
  if (ctx.demo) return demoSnapshot(days)
  const perms = ctx.session?.perms ?? []
  try {
    return limitSnapshot(await realSnapshot(days), perms)
  } catch (e) {
    return limitSnapshot(emptySnapshot(days, e instanceof Error ? e.message : 'Analytics query failed'), perms)
  }
}
