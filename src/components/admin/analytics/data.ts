// Analytics aggregator (P4a) — server only (reads cookies via the owner's Supabase session).
// Real mode: scans analytics_events (+ leads) for the range and the previous range under RLS, aggregates in JS.
// Demo mode (Supabase missing): deterministic seeded sample data, clearly flagged `demo: true` — never real.
import { getAdminContext } from '../server'
import { supabaseServer } from '@/lib/supabase/server'
import { getCollections, getEvents, getPartnerships, getProducts } from '@/lib/data/repo'
import { hashString, seeded } from '@/lib/utils'
import type { AnalyticsSnapshot, Kpis, Ranked, SeriesPoint, SrcRow } from './types'

const DAY = 86_400_000
const PAGE = 1000
const MAX_ROWS = 60_000

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
async function fetchEvents(fromIso: string, toIso: string): Promise<{ rows: EventRow[]; capped: boolean; error: string | null }> {
  const sb = await supabaseServer()
  if (!sb) return { rows: [], capped: false, error: 'Supabase client unavailable' }
  const rows: EventRow[] = []
  for (let i = 0; i < MAX_ROWS; i += PAGE) {
    const { data, error } = await sb
      .from('analytics_events')
      .select('ts,visitor_id,session_id,name,path,props,src,utm_source,referrer,device,country,region,city')
      .gte('ts', fromIso)
      .lt('ts', toIso)
      .order('ts', { ascending: true })
      .range(i, i + PAGE - 1)
    if (error) return { rows, capped: false, error: error.message }
    rows.push(...((data ?? []) as EventRow[]))
    if (!data || data.length < PAGE) return { rows, capped: false, error: null }
  }
  return { rows, capped: true, error: null }
}

async function fetchLeads(fromIso: string, toIso: string): Promise<LeadRow[]> {
  const sb = await supabaseServer()
  if (!sb) return []
  const { data } = await sb.from('leads').select('kind,src,payload,created_at').gte('created_at', fromIso).lt('created_at', toIso).limit(5000)
  return (data ?? []) as LeadRow[]
}

function kpisFrom(rows: EventRow[], leads: LeadRow[]): Kpis {
  const visitors = new Set<string>(), sessions = new Set<string>(), cartSessions = new Set<string>()
  let visits = 0, adds = 0, wa = 0
  for (const r of rows) {
    sessions.add(r.session_id)
    if (r.name === 'page_view') { visits++; visitors.add(r.visitor_id) }
    else if (r.name === 'add_to_cart') { adds++; cartSessions.add(r.session_id) }
    else if (r.name === 'whatsapp_click') wa++
  }
  const orders = leads.filter((l) => l.kind === 'whatsapp_order')
  return {
    visits,
    uniques: visitors.size,
    sessions: sessions.size,
    addToCart: adds,
    addToCartRate: sessions.size ? cartSessions.size / sessions.size : 0,
    whatsappClicks: wa,
    leads: leads.length,
    orders: orders.length,
    revenueEstimate: orders.reduce((s, l) => s + orderTotal(l.payload), 0),
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
  const [cur, prev, leads, prevLeads, collections, products] = await Promise.all([
    fetchEvents(new Date(from).toISOString(), new Date(end).toISOString()),
    fetchEvents(new Date(prevFrom).toISOString(), new Date(from).toISOString()),
    fetchLeads(new Date(from).toISOString(), new Date(end).toISOString()),
    fetchLeads(new Date(prevFrom).toISOString(), new Date(from).toISOString()),
    getCollections(),
    getProducts(),
  ])
  const rows = cur.rows
  const colName = new Map(collections.map((c) => [c.slug, c.name]))
  const prodName = new Map(products.map((p) => [p.slug, p.name]))

  // series
  const byDay = new Map<string, { v: number; u: Set<string>; w: number }>()
  for (let t = from; t < end; t += DAY) byDay.set(dayKey(t), { v: 0, u: new Set(), w: 0 })
  const pages = new Map<string, number>(), cols = new Map<string, number>(), prodViews = new Map<string, number>(), prodAdds = new Map<string, number>()
  const firstOfSession = new Map<string, EventRow>()
  const funnelSets = { view: new Set<string>(), cart: new Set<string>(), checkout: new Set<string>(), wa: new Set<string>() }
  const srcVisits = new Map<string, number>(), srcVisitors = new Map<string, Set<string>>()

  for (const r of rows) {
    const d = byDay.get(r.ts.slice(0, 10))
    if (!firstOfSession.has(r.session_id)) firstOfSession.set(r.session_id, r)
    if (r.name === 'page_view') {
      if (d) { d.v++; d.u.add(r.visitor_id) }
      inc(pages, r.path)
      const arc = r.path.match(/^\/arc\/([^/?#]+)/)?.[1]
      if (arc) inc(cols, arc)
      const prod = r.path.match(/^\/product\/([^/?#]+)/)?.[1]
      if (prod) { inc(prodViews, prod); funnelSets.view.add(r.session_id) }
      if (r.src) {
        inc(srcVisits, r.src)
        if (!srcVisitors.has(r.src)) srcVisitors.set(r.src, new Set())
        srcVisitors.get(r.src)!.add(r.visitor_id)
      }
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
      if (d) d.w++
    } else if (r.name === 'collection_open') {
      const slug = String(r.props?.collection ?? r.props?.slug ?? '')
      if (slug) inc(cols, slug)
    }
  }
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
  for (const [src, v] of srcVisits) { const s = srcRow(src); s.visits = v; s.uniques = srcVisitors.get(src)?.size ?? 0 }
  const kinds = new Map<string, number>()
  for (const l of leads) {
    inc(kinds, l.kind)
    if (!l.src) continue
    const s = srcRow(l.src)
    s.leads++
    if (l.kind === 'whatsapp_order') { s.orders++; s.revenue += orderTotal(l.payload) }
  }

  const prevK = kpisFrom(prev.rows, prevLeads)
  return {
    demo: false,
    error: cur.error,
    days,
    from: dayKey(from),
    to: dayKey(end - DAY),
    kpis: kpisFrom(rows, leads),
    prev: prev.error ? null : prevK,
    series: [...byDay.entries()].map(([date, x]) => ({ date, label: dayLabel(date), visits: x.v, uniques: x.u.size, whatsapp: x.w })),
    topPages: top(pages, 10),
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
    scanned: rows.length,
    capped: cur.capped,
  }
}

// ────────────────────────────────────────────────────────────── demo data (seeded, labelled)
async function demoSnapshot(days: number): Promise<AnalyticsSnapshot> {
  const [collections, products, srcList] = await Promise.all([getCollections(), getProducts(), knownSrcs()])
  const end = startOfUtcDay(Date.now()) + DAY
  const from = end - days * DAY

  const dayVisits = (t: number) => {
    const r = seeded(hashString(dayKey(t)))
    const dow = new Date(t).getUTCDay()
    const weekly = dow === 0 || dow === 6 ? 1.28 : dow === 5 ? 1.12 : 1
    const trend = 1 + ((t / DAY) % 365) / 900
    const spike = r() > 0.93 ? 2.1 : 1 // a fest-stall day
    return Math.round((150 + r() * 70) * weekly * trend * spike)
  }
  const build = (a: number, b: number) => {
    const series: SeriesPoint[] = []
    let visits = 0, uniques = 0, wa = 0
    for (let t = a; t < b; t += DAY) {
      const r = seeded(hashString(dayKey(t)) ^ 0x9e37)
      const v = dayVisits(t)
      const u = Math.round(v * (0.58 + r() * 0.08))
      const w = Math.round(v * (0.028 + r() * 0.014))
      visits += v; uniques += u; wa += w
      const k = dayKey(t)
      series.push({ date: k, label: dayLabel(k), visits: v, uniques: u, whatsapp: w })
    }
    const sessions = Math.round(visits * 0.44)
    const addToCart = Math.round(sessions * 0.083)
    const orders = Math.round(wa * 0.74)
    const kpis: Kpis = {
      visits, uniques, sessions, addToCart,
      addToCartRate: sessions ? (addToCart * 0.82) / sessions : 0,
      whatsappClicks: wa,
      leads: orders + Math.round(wa * 0.31),
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
  const pagesV = share(k.visits * 0.7, pageW)
  const colW = collections.map((_, i) => 10 / (i + 1.4) + r() * 2)
  const colV = share(k.visits * 0.14, colW)
  const prodPick = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 8)
  const prodV = share(k.visits * 0.16, prodPick.map((_, i) => 9 / (i + 1.2) + r()))
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
    series: cur.series,
    topPages: pageList.map((p, i) => ({ key: p, label: p, value: pagesV[i] })),
    topCollections: collections.map((c, i) => ({ key: c.slug, label: c.name, value: colV[i] })).sort((a, b) => b.value - a.value),
    topProducts: prodPick.map((p, i) => ({ key: p.slug, label: p.name, value: prodV[i], extra: Math.round(prodV[i] * (0.09 + r() * 0.06)) })),
    funnel: [
      { id: 'view', label: 'Viewed a product', jp: '閲覧', sessions: view },
      { id: 'cart', label: 'Added to cart', jp: 'カート', sessions: Math.round(k.addToCartRate * k.sessions) },
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

/** Snapshot for the last `days` days (UTC). Demo data when Supabase is unconfigured. Never throws. */
export async function getAnalytics(days: number): Promise<AnalyticsSnapshot> {
  const ctx = await getAdminContext()
  if (ctx.demo) return demoSnapshot(days)
  try {
    return await realSnapshot(days)
  } catch (e) {
    const empty = await demoSnapshot(days)
    return { ...empty, demo: false, error: e instanceof Error ? e.message : 'Analytics query failed' }
  }
}
