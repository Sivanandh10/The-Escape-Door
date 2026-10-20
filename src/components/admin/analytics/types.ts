// Analytics snapshot shape shared by the server aggregator and the dashboard/analytics client views (P4a).
// Counting rules (honest numbers):
//   visit = one session (ends after 30 min idle / at midnight; reloads and page changes stay one visit)
//   unique visitor = one anonymous browser id
//   page view = a path seen in a session, counted once per session + path (reloads don't add)
//   staff browsers (anyone who opened /admin) and /admin, /lab, /api paths are excluded.
export interface Kpis {
  /** distinct sessions */
  visits: number
  /** distinct visitor ids */
  uniques: number
  /** same as visits (kept for older callers) */
  sessions: number
  /** de-duplicated page views (once per session + path) */
  pageViews: number
  /** raw add_to_cart events */
  addToCart: number
  /** sessions with ≥1 add_to_cart */
  cartSessions: number
  /** sessions with ≥1 add_to_cart ÷ sessions (0..1) */
  addToCartRate: number
  /** sessions with ≥1 whatsapp_click */
  whatsappClicks: number
  /** raw whatsapp_click events */
  whatsappRaw: number
  leads: number
  orders: number
  /** ₹ — real order totals (status ≠ cancelled) when `revenueSource` is 'orders', else the sum of
   *  whatsapp_order lead totals (an estimate, not settled revenue). Name kept for older callers. */
  revenueEstimate: number
}

/** visits = sessions started that day · uniques = visitors who started a session that day · whatsapp = sessions with a WhatsApp click */
export interface SeriesPoint { date: string; label: string; visits: number; uniques: number; whatsapp: number }
/** topPages: value = de-duplicated page views, extra = unique visitors */
export interface Ranked { key: string; label: string; value: number; extra?: number }
export interface FunnelStep { id: string; label: string; jp: string; sessions: number }
/** visits = sessions that arrived with this ?src= */
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
  /** where revenue / order counts come from: real public.orders rows, or WhatsApp-order lead estimates */
  revenueSource: 'orders' | 'leads'
  /** partial failures (e.g. leads or orders didn't load) — shown above the KPIs, never hidden behind zeros */
  warnings: string[]
  /** ISO time the server built this snapshot ("updated 14:32:05") */
  generatedAt: string
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
  /** true when the viewer lacks analytics.view: topPages / sources / countries / regions / cities are emptied server-side */
  limited?: boolean
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
