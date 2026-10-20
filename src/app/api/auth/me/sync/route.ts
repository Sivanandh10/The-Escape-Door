// POST /api/auth/me/sync { views?: string[] } — called once per browser session after a customer signs in
// (owner: AUTH). Creates the profile on first login (never for staff), merges the product pages they browsed
// before logging in (localStorage) into recent_views, stamps last_seen_at.
import { z } from 'zod'
import { ensureProfile, getAuthUser } from '@/lib/auth/customer-server'
import { allow, json, readJson, sameOrigin } from '../../../_lib/guard'

const Body = z.object({ views: z.array(z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/)).max(20).optional() })

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const auth = await getAuthUser()
  if (!auth) return json({ ok: false, error: 'signed-out' }, 401)
  if (!allow(`sync:${auth.user.id}`, 10, 10 * 60_000)) return json({ ok: false, error: 'rate-limited' }, 429)
  const body = await readJson(req, 8 * 1024)
  const parsed = Body.safeParse('data' in body ? body.data : {})
  if (!parsed.success) return json({ ok: false, error: 'invalid' }, 400)

  const profile = await ensureProfile(auth.user)
  // oldest first so the newest local view ends up newest on the server
  const views = [...new Set(parsed.data.views ?? [])].reverse()
  for (const slug of views) await auth.sb.rpc('record_product_view', { p_slug: slug })
  return json({ ok: true, profile, merged: views.length })
}
