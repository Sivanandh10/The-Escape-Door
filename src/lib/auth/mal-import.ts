// MyAnimeList import with the extra list fields the affinity model uses (owner: MAL-RECS; server only).
// importMalRich(token) = importMal() (src/lib/auth/mal.ts) + per entry: is_rewatching, num_times_rewatched, the show's
// total episode count and media type (tv / movie / …). The callback and re-sync store its `list` as
// mal_accounts.anime_snapshot; the engine treats every extra field as optional, so older snapshots keep working.
// If MAL rejects the richer field set, it falls back to the plain import — a login never fails because of it.
// Never logs or returns tokens.
import { importMal } from './mal'
import type { MalAnime } from '@/lib/recs/types'

const API = 'https://api.myanimelist.net/v2'
const SNAPSHOT_MAX = 400
const FIELDS =
  'list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched,updated_at},num_episodes,media_type'

interface RichRow {
  node?: { id?: number; num_episodes?: number; media_type?: string }
  list_status?: { is_rewatching?: boolean; num_times_rewatched?: number }
}

/** id → extra fields, newest list updates first (same order + cap as the stored snapshot). */
async function fetchExtras(token: string): Promise<Map<number, Pick<MalAnime, 'rewatching' | 'rewatches' | 'total' | 'media'>>> {
  const out = new Map<number, Pick<MalAnime, 'rewatching' | 'rewatches' | 'total' | 'media'>>()
  let url: string | null = `${API}/users/@me/animelist?fields=${encodeURIComponent(FIELDS)}&limit=1000&sort=list_updated_at`
  for (let page = 0; url && page < 2 && out.size < SNAPSHOT_MAX; page++) {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`mal-extras:${res.status}`)
    const body = (await res.json()) as { data?: RichRow[]; paging?: { next?: string } }
    for (const row of body.data ?? []) {
      const id = row?.node?.id
      if (!id) continue
      const total = row.node?.num_episodes
      const times = row.list_status?.num_times_rewatched
      out.set(id, {
        rewatching: row.list_status?.is_rewatching === true || undefined,
        rewatches: typeof times === 'number' && times > 0 ? Math.min(99, Math.floor(times)) : undefined,
        total: typeof total === 'number' && total > 0 ? total : null,
        media: typeof row.node?.media_type === 'string' ? row.node.media_type.slice(0, 16) : null,
      })
    }
    const next: string | undefined = body.paging?.next
    url = next && next.startsWith(API) ? next : null
  }
  return out
}

/** importMal() + the affinity extras (best-effort). Same return shape as importMal(). */
export async function importMalRich(token: string): Promise<Awaited<ReturnType<typeof importMal>>> {
  const [base, extras] = await Promise.all([importMal(token), fetchExtras(token).catch(() => null)])
  if (!extras?.size) return base
  const list: MalAnime[] = base.list.map((a) => {
    const x = extras.get(a.id)
    if (!x) return a
    const out: MalAnime = { ...a }
    if (x.rewatching) out.rewatching = true
    if (x.rewatches) out.rewatches = x.rewatches
    if (x.total) out.total = x.total
    if (x.media) out.media = x.media
    return out
  })
  return { ...base, list }
}
