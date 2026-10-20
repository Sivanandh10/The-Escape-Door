// GET /api/auth/me/recs?exclude=<slug>&ids=<productId,…> — "Picked for you" data for the signed-in shopper
// (owner: AUTH). Signed out → { signedIn:false }. `ids` = cart + wishlist product ids from the browser, used only to rank.
import { getAuthUser } from '@/lib/auth/customer-server'
import { recsForUser } from '@/lib/recs/server'
import { EMPTY_RECS } from '@/lib/recs/types'
import { json } from '../../../_lib/guard'

const SLUG = /^[a-z0-9-]{1,120}$/
const ID = /^[\w-]{1,80}$/

export async function GET(req: Request) {
  const url = new URL(req.url)
  const auth = await getAuthUser()
  if (!auth) return json(EMPTY_RECS)
  const exclude = url.searchParams.get('exclude')
  const ids = (url.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter((s) => ID.test(s)).slice(0, 60)
  const full = url.searchParams.get('full') === '1'
  try {
    const recs = await recsForUser(auth.sb, auth.user.id, {
      exclude: exclude && SLUG.test(exclude) ? exclude : null,
      signalIds: ids,
      limits: full ? { recent: 12, picks: 12, watchedRows: 4, perRow: 4 } : undefined,
    })
    return json(recs)
  } catch {
    return json({ ...EMPTY_RECS, signedIn: true, error: 'server' }, 500)
  }
}
