// Collaborative signals — SERVER ONLY (owner: RECS). Builds the cached item→item similarity map the hybrid ranker uses:
//   co-purchase  ← orders.items (last 180 days, confirmed or later — 'new' / 'placed' are unconfirmed and anyone can
//                  place a guest order, so they never shape recommendations), a pair needs ≥ 2 distinct orders
//   co-view      ← analytics_events product_view grouped by session_id (last 30 days)
//   popularity   ← product_view (1) + add_to_cart (3) in the last 30 days + ordered (5) in the last 180, log-scaled
// Cached for an hour ('use cache' + cacheLife('hours'), tag 'recs'; also re-validated with the catalogue tag).
// Reads with the service role (orders / analytics_events have no public read) and returns aggregates only —
// item slugs and numbers, never a visitor, session or order. Never throws: any failure → an empty graph (cold start).
import { cacheLife, cacheTag } from 'next/cache'
import { getProducts } from '@/lib/data/repo'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildItemGraph, EMPTY_GRAPH, type ItemGraph } from './engine'

export const RECS_TAG = 'recs'
const PAGE = 1000
const MAX_EVENT_PAGES = 20 // ≤ 20k events per rebuild
const DAY = 86_400_000

type EventRow = { session_id: string | null; name: string; product: string | null; slug: string | null }
type OrderRow = { items: unknown }

function refsOf(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const out: string[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const r = it as { slug?: unknown; productId?: unknown }
    if (typeof r.slug === 'string' && r.slug) out.push(r.slug)
    else if (typeof r.productId === 'string' && r.productId) out.push(r.productId)
  }
  return out
}

export async function getItemGraph(): Promise<ItemGraph> {
  'use cache'
  cacheLife('hours')
  cacheTag(RECS_TAG, 'products')
  const sb = supabaseAdmin()
  const products = await getProducts()
  if (!sb || !products.length) return EMPTY_GRAPH
  const now = Date.now()
  try {
    const since30 = new Date(now - 30 * DAY).toISOString()
    const since180 = new Date(now - 180 * DAY).toISOString()

    const ordersQ = sb
      .from('orders')
      .select('items')
      .gte('created_at', since180)
      .in('status', ['confirmed', 'paid', 'packed', 'shipped', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(2000)

    const events: EventRow[] = []
    for (let page = 0; page < MAX_EVENT_PAGES; page++) {
      const { data, error } = await sb
        .from('analytics_events')
        .select('session_id, name, product:props->>product, slug:props->>slug')
        .in('name', ['product_view', 'add_to_cart'])
        .gte('ts', since30)
        .order('id', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error || !Array.isArray(data)) break
      events.push(...(data as unknown as EventRow[]))
      if (data.length < PAGE) break
    }
    const { data: orderRows } = await ordersQ
    const orders = (Array.isArray(orderRows) ? (orderRows as OrderRow[]) : []).map((o) => refsOf(o.items)).filter((b) => b.length)

    const sessions = new Map<string, string[]>()
    const popEvents: Array<{ slug: string; kind: 'view' | 'cart' | 'order' }> = []
    for (const e of events) {
      const ref = e.product || e.slug
      if (!ref) continue
      if (e.name === 'product_view') {
        popEvents.push({ slug: ref, kind: 'view' })
        if (e.session_id) {
          const list = sessions.get(e.session_id) ?? []
          list.push(ref)
          sessions.set(e.session_id, list)
        }
      } else popEvents.push({ slug: ref, kind: 'cart' })
    }
    for (const b of orders) for (const ref of b) popEvents.push({ slug: ref, kind: 'order' })

    return buildItemGraph({
      orders,
      sessions: [...sessions.values()],
      events: popEvents,
      products,
      minCoBuy: 2,
      builtAt: new Date(now).toISOString(),
    })
  } catch {
    return EMPTY_GRAPH
  }
}
