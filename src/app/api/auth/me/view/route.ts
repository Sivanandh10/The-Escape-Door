// POST /api/auth/me/view { slug } — record a product view for the signed-in shopper (owner: AUTH).
// RLS-bound: the SQL helper record_product_view() writes only the caller's own row.
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth/customer-server'
import { allow, json, readJson, sameOrigin } from '../../../_lib/guard'

const Body = z.object({ slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/) })

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const body = await readJson(req, 2048)
  const parsed = Body.safeParse('data' in body ? body.data : null)
  if (!parsed.success) return json({ ok: false, error: 'invalid' }, 400)
  const auth = await getAuthUser()
  if (!auth) return json({ ok: true, stored: false })
  if (!allow(`view:${auth.user.id}`, 120, 10 * 60_000)) return json({ ok: false, error: 'rate-limited' }, 429)
  const { error } = await auth.sb.rpc('record_product_view', { p_slug: parsed.data.slug })
  return json({ ok: !error, stored: !error })
}
