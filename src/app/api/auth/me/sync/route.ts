// POST /api/auth/me/sync — the shopper's browsing → their account (owner: AUTH).
//   { views?: string[], trail?: [{ kind, value, at }], flush?: boolean }
// Login sync (once per browser session after a customer signs in): creates the profile on first login (never for
// staff), merges the product pages they browsed before logging in (localStorage) into recent_views, stamps
// last_seen_at, and stores the session TRAIL (searches, collection pages, shop categories, cart adds, wishlist saves,
// views — src/lib/recs/signals.ts) in customer_signals (migration 0012) so recommendations use the whole session.
// flush: true = a signed-in shopper's new trail events only (no profile / views work; its own rate limit).
// customer_signals missing (0012 not run yet) → { ok: true, signalsStored: false } — never an error for the browser.
import { z } from 'zod'
import { ensureProfile, getAuthUser, isStaff } from '@/lib/auth/customer-server'
import { allow, json, readJson, sameOrigin } from '../../../_lib/guard'

const SLUG = /^[a-z0-9-]{1,120}$/
const REF = /^[\w-]{1,120}$/
const KINDS = ['search', 'collection', 'type', 'cart', 'wishlist', 'view'] as const
type Kind = (typeof KINDS)[number]
/** Server-set weights (the browser never chooses them): a cart add says more than a page visit. */
const WEIGHT: Record<Kind, number> = { search: 1, collection: 1, type: 0.8, cart: 2, wishlist: 1.5, view: 0.5 }
const DAY = 86_400_000

const TrailEvent = z.object({
  kind: z.enum(KINDS),
  value: z.string().trim().min(1).max(120),
  at: z.number().finite(),
})
const Body = z.object({
  views: z.array(z.string().trim().min(1).max(120).regex(SLUG)).max(20).optional(),
  trail: z.array(TrailEvent).max(200).optional(),
  flush: z.boolean().optional(),
})

/** Same normalisation as normTerm() in src/lib/recs/signals.ts (copied so the route has no client imports). */
function normTerm(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim()
}

function cleanTrail(trail: z.infer<typeof TrailEvent>[], now: number) {
  const out: Array<{ kind: Kind; value: string; weight: number; at: string }> = []
  const seen = new Set<string>()
  for (const e of trail) {
    const value = e.kind === 'search' ? normTerm(e.value) : e.value
    if (e.kind === 'search' ? value.length < 2 : !REF.test(value)) continue
    const at = Math.min(now, Math.max(now - 180 * DAY, Math.floor(e.at)))
    const key = `${e.kind}|${value}|${at}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: e.kind, value, weight: WEIGHT[e.kind], at: new Date(at).toISOString() })
  }
  return out
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const auth = await getAuthUser()
  if (!auth) return json({ ok: false, error: 'signed-out' }, 401)
  const body = await readJson(req, 48 * 1024)
  if ('error' in body && body.error === 'too-large') return json({ ok: false, error: 'too-large' }, 413)
  const parsed = Body.safeParse('data' in body ? body.data ?? {} : {})
  if (!parsed.success) return json({ ok: false, error: 'invalid' }, 400)
  const { flush, views: rawViews, trail: rawTrail } = parsed.data
  if (!allow(flush ? `signals:${auth.user.id}` : `sync:${auth.user.id}`, flush ? 40 : 10, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited' }, 429)
  }

  let profile: Awaited<ReturnType<typeof ensureProfile>> | null = null
  let merged = 0
  if (!flush) {
    profile = await ensureProfile(auth.user)
    // oldest first so the newest local view ends up newest on the server
    const views = [...new Set(rawViews ?? [])].reverse()
    for (const slug of views) await auth.sb.rpc('record_product_view', { p_slug: slug })
    merged = views.length
  }

  // staff accounts don't collect shopping signals
  const staff = profile ? profile === 'staff' : rawTrail?.length ? await isStaff(auth.user.id) : false
  const rows = staff ? [] : cleanTrail(rawTrail ?? [], Date.now())
  let signals = 0
  let signalsStored = true
  if (rows.length) {
    const { data, error } = await auth.sb.rpc('record_customer_signals', { p_rows: rows })
    if (error) signalsStored = false
    else signals = typeof data === 'number' ? data : 0
  }
  return json({ ok: true, profile, merged, signals, signalsStored })
}
