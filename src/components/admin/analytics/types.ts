// Analytics snapshot shape shared by the server aggregator and the dashboard/analytics client views (P4a).
export interface Kpis {
  visits: number
  uniques: number
  sessions: number
  addToCart: number
  /** sessions with ≥1 add_to_cart ÷ sessions (0..1) */
  addToCartRate: number
  whatsappClicks: number
  leads: number
  orders: number
  /** sum of whatsapp_order lead totals (₹) — an estimate, not settled revenue */
  revenueEstimate: number
}

export interface SeriesPoint { date: string; label: string; visits: number; uniques: number; whatsapp: number }
export interface Ranked { key: string; label: string; value: number; extra?: number }
export interface FunnelStep { id: string; label: string; jp: string; sessions: number }
export interface SrcRow { src: string; visits: number; uniques: number; leads: number; orders: number; revenue: number }

export interface AnalyticsSnapshot {
  demo: boolean
  /** true when the events query failed — show an error state, not zeros */
  error: string | null
  days: number
  from: string
  to: string
  kpis: Kpis
  prev: Kpis | null
  series: SeriesPoint[]
  topPages: Ranked[]
  topCollections: Ranked[]
  /** value = product views, extra = adds to cart */
  topProducts: Ranked[]
  funnel: FunnelStep[]
  /** sessions by acquisition source (QR src / utm_source / referrer host / direct) */
  sources: Ranked[]
  srcs: SrcRow[]
  devices: Ranked[]
  countries: Ranked[]
  regions: Ranked[]
  cities: Ranked[]
  leadsByKind: Ranked[]
  integrations: { supabase: boolean; tracking: boolean; ga4: boolean; clarity: boolean }
  /** rows scanned (real mode) — shown so the owner knows when the sample cap is hit */
  scanned: number
  capped: boolean
}

export const RANGES = [7, 14, 30, 90] as const
export type RangeDays = (typeof RANGES)[number]
export function parseRange(v: unknown): RangeDays {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30
}
