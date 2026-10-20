// GET /api/recs — hybrid recommendations for any visitor (owner: RECS). Privacy-safe: the browser sends its own
// compact signals in the query (no ids of people, nothing stored); signed-in shoppers also get their own DB signals
// (recent_views, own orders, linked MyAnimeList) read under RLS.
//
//   ?context=home|shop|product|cart|account   (default home)
//   &slug=<product slug>                       product page anchor
//   &limit=1..12                               (default 8)
//   &v=slug~minutesAgo~count,…                 recently viewed (≤ 30)
//   &c=ref,…                                   cart product ids/slugs (≤ 40)
//   &w=ref,…                                   wishlist product ids/slugs (≤ 60)
//   &s=term|term                               recent shop searches (≤ 5)
//   &x=slug,…                                  extra slugs to leave out (≤ 12)
// → { context, items: [{ product, reason: {kind,label}, score }], personal, signedIn, cold }
// The item→item graph (co-purchase + co-view + popularity) is cached for an hour (src/lib/recs/graph.ts, tag 'recs').
import { cookies } from 'next/headers'
import { getCollections, getProducts, getRelatedProducts } from '@/lib/data/repo'
import { getAuthUser } from '@/lib/auth/customer-server'
import { malSignals, rankRecs, RECS_CONTEXTS, type RecSignals, type RecsContext } from '@/lib/recs/engine'
import { getItemGraph } from '@/lib/recs/graph'
import { loadMal, loadOrderRefs, loadViews } from '@/lib/recs/server'
import { allow, clientKey, json } from '../_lib/guard'

const SLUG = /^[a-z0-9-]{1,120}$/
const REF = /^[\w-]{1,120}$/
const MINUTE = 60_000

function list(v: string | null, max: number, re: RegExp): string[] {
  if (!v) return []
  const out: string[] = []
  for (const raw of v.split(',')) {
    const s = raw.trim()
    if (re.test(s) && !out.includes(s)) out.push(s)
    if (out.length >= max) break
  }
  return out
}

/** Supabase auth cookie present? (skips the Auth round-trip for anonymous visitors) */
async function maybeSignedIn(): Promise<boolean> {
  try {
    return (await cookies()).getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  if (!allow(`recs:${clientKey(req)}`, 120, MINUTE)) return json({ error: 'rate-limited' }, 429)
  const url = new URL(req.url)
  const sp = url.searchParams
  const ctxRaw = sp.get('context') ?? 'home'
  const context = (RECS_CONTEXTS as string[]).includes(ctxRaw) ? (ctxRaw as RecsContext) : null
  if (!context) return json({ error: 'bad-context' }, 400)
  const slugRaw = sp.get('slug')
  const slug = slugRaw && SLUG.test(slugRaw) ? slugRaw : null
  const limit = Math.max(1, Math.min(12, Number(sp.get('limit')) || 8))
  const now = Date.now()

  const views: NonNullable<RecSignals['views']> = []
  for (const part of (sp.get('v') ?? '').split(',').slice(0, 30)) {
    const [s, age, count] = part.split('~')
    if (!s || !SLUG.test(s)) continue
    const mins = Math.max(0, Math.min(60 * 24 * 365, Number(age) || 0))
    views.push({ slug: s, at: now - mins * MINUTE, count: Math.max(1, Math.min(50, Math.floor(Number(count) || 1))) })
  }
  const searches = (sp.get('s') ?? '')
    .split('|')
    .map((t) => t.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').slice(0, 40))
    .filter((t) => t.length >= 2)
    .slice(0, 5)
  const signals: RecSignals = {
    views,
    cart: list(sp.get('c'), 40, REF),
    wish: list(sp.get('w'), 60, REF),
    searches,
    orders: [],
    mal: [],
  }
  const exclude = list(sp.get('x'), 12, SLUG)

  try {
    const [products, collections, graph] = await Promise.all([getProducts(), getCollections(), getItemGraph()])

    // signed-in: merge the shopper's own DB signals (never trusted beyond ranking)
    let signedIn = false
    if (await maybeSignedIn()) {
      const auth = await getAuthUser()
      if (auth) {
        signedIn = true
        const [dbViews, orders, mal] = await Promise.all([
          loadViews(auth.sb, auth.user.id, 40).catch(() => []),
          loadOrderRefs(auth.sb, auth.user.id).catch(() => []),
          loadMal(auth.sb, auth.user.id).catch(() => null),
        ])
        const seen = new Set(views.map((v) => v.slug))
        for (const v of dbViews) {
          const at = Date.parse(v.viewedAt)
          if (!seen.has(v.slug) && Number.isFinite(at)) views.push({ slug: v.slug, at, count: v.count })
        }
        signals.orders = orders
        if (mal && Array.isArray(mal.anime_snapshot)) signals.mal = malSignals(mal.anime_snapshot, collections)
      }
    }

    // product page: the static "Pairs well with" row already shows these — don't repeat them
    if (context === 'product' && slug) {
      const related = await getRelatedProducts(slug, 4)
      for (const r of related) exclude.push(r.slug)
    }

    const ranked = rankRecs({ context, products, collections, signals, graph, anchor: slug, exclude, limit, now })
    const personal =
      views.length > 0 || !!signals.cart?.length || !!signals.wish?.length || !!signals.orders?.length || !!signals.mal?.length || searches.length > 0
    const cold = !Object.keys(graph.coBuy).length && !Object.keys(graph.coView).length
    return json({
      context,
      items: ranked.map((r) => ({ product: r.product, reason: r.reason, score: r.score })),
      personal,
      signedIn,
      cold,
    })
  } catch {
    return json({ context, items: [], personal: false, signedIn: false, cold: true, error: 'server' }, 500)
  }
}
