'use client'
// /account → MyAnimeList (owner: AUTH). Not linked → "Connect" (OAuth via /api/auth/mal/start; hidden as "coming
// soon" until the MAL env vars exist). Linked → stats, top shows, re-sync (refresh token) and unlink (with confirm).
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { ArrowUpRight, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { syncMal, unlinkMal } from '@/lib/auth/actions'
import { useCustomer } from '@/lib/auth/customer'
import { malAnimeUrl } from '@/lib/recs/mal-map'
import type { MalAnime, MalSnapshotStats } from '@/lib/recs/types'
import { cn } from '@/lib/utils'

export interface MalPanelData {
  username: string
  picture: string | null
  syncedAt: string | null
  stats: MalSnapshotStats | null
  top: MalAnime[]
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never'

export function MalPanel({ data, canUnlink }: { data: MalPanelData | null; canUnlink: boolean }) {
  const router = useRouter()
  const { refresh } = useCustomer()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<null | 'sync' | 'unlink' | 'connect'>(null)
  const [confirm, setConfirm] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    fetch('/api/auth/mal/status')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => alive && setEnabled(!!d.enabled))
      .catch(() => alive && setEnabled(false))
    return () => {
      alive = false
    }
  }, [])

  const connect = () => {
    setBusy('connect')
    window.location.assign('/api/auth/mal/start?next=/account%23myanimelist')
  }
  const sync = async () => {
    setBusy('sync')
    const r = await syncMal()
    setBusy(null)
    if (!r.ok) return void toast.error(r.error)
    toast.success(`Synced ${r.data.total} shows from MyAnimeList.`)
    startTransition(() => router.refresh())
  }
  const unlink = async () => {
    setBusy('unlink')
    const r = await unlinkMal()
    setBusy(null)
    setConfirm(false)
    if (!r.ok) return void toast.error(r.error)
    toast('MyAnimeList unlinked.')
    void refresh?.()
    startTransition(() => router.refresh())
  }

  if (!data) {
    return (
      <div className="mt-6 grid gap-5 border-4 border-ink bg-[#2E51A2] p-5 text-paper shadow-hard-volt sm:p-7 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="font-display text-[clamp(1.75rem,4vw,2.6rem)] uppercase leading-[0.92]">Link your anime list</p>
          <p className="mt-3 max-w-xl text-paper/90">
            Connect MyAnimeList and we’ll read what you watch and rate (never post anything) to match drops to your shows — plus suggestions for what to watch next.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <button
            type="button"
            onClick={connect}
            disabled={!enabled || !!busy}
            className={cn(
              'press focus-ring inline-flex min-h-12 items-center gap-2 border-[3px] border-ink px-5 font-display text-[19px] uppercase shadow-hard-sm',
              enabled ? 'bg-volt text-ink' : 'cursor-not-allowed bg-paper/30 text-paper shadow-none',
            )}
          >
            {busy === 'connect' ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Link2 aria-hidden="true" className="size-5" />}
            {busy === 'connect' ? 'Opening MyAnimeList…' : 'Connect MyAnimeList'}
          </button>
          {enabled === false && <span className="label border-2 border-ink bg-volt px-2 py-1 text-[10px] text-ink">Coming soon</span>}
        </div>
      </div>
    )
  }

  const s = data.stats
  const tiles = s
    ? [
        { label: 'Watching', v: s.watching },
        { label: 'Completed', v: s.completed },
        { label: 'Plan to watch', v: s.planToWatch },
        { label: 'Mean score', v: s.meanScore ?? '—' },
      ]
    : []

  return (
    <div className="mt-6 border-4 border-ink bg-paper text-ink shadow-hard-volt">
      <div className="flex flex-wrap items-center gap-4 border-b-4 border-ink bg-[#2E51A2] p-4 text-paper sm:p-5">
        {data.picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- MAL avatar
          <img src={data.picture} alt="" width={56} height={56} referrerPolicy="no-referrer" className="size-14 border-[3px] border-ink object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-14 place-items-center border-[3px] border-ink bg-volt font-display text-[26px] text-ink">
            {data.username[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="label text-[10px] text-paper/80">Linked account</p>
          <a href={`https://myanimelist.net/profile/${encodeURIComponent(data.username)}`} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 font-display text-[28px] uppercase leading-none hover:text-volt">
            {data.username} <ArrowUpRight aria-hidden="true" className="size-5" />
            <span className="sr-only">(opens MyAnimeList)</span>
          </a>
          <p className="mt-1 text-[13px] text-paper/80">Last synced {fmt(data.syncedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={sync} disabled={!!busy} className="press focus-ring inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-volt px-4 font-bold text-ink shadow-hard-sm disabled:opacity-70">
            {busy === 'sync' ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="size-4" />}
            {busy === 'sync' ? 'Syncing…' : 'Sync now'}
          </button>
          {canUnlink &&
            (confirm ? (
              <span className="inline-flex items-center gap-2 border-[3px] border-ink bg-paper px-2 text-ink">
                <span className="text-[13px] font-bold">Unlink?</span>
                <button type="button" onClick={unlink} disabled={!!busy} className="focus-ring min-h-11 px-2 font-bold text-hype">
                  {busy === 'unlink' ? 'Unlinking…' : 'Yes'}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="focus-ring min-h-11 px-2 font-bold">
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="press focus-ring inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-4 font-bold text-ink">
                <Unlink aria-hidden="true" className="size-4" /> Unlink
              </button>
            ))}
        </div>
      </div>

      {tiles.length > 0 && (
        <dl className="grid grid-cols-2 border-b-4 border-ink sm:grid-cols-4">
          {tiles.map((t, i) => (
            <div key={t.label} className={cn('p-4', i > 0 && 'sm:border-l-[3px] sm:border-ink', i % 2 === 1 && 'border-l-[3px] border-ink sm:border-l-[3px]', i > 1 && 'border-t-[3px] border-ink sm:border-t-0')}>
              <dt className="label text-[10px] text-tone-3">{t.label}</dt>
              <dd className="mt-1 font-mono text-[28px] font-bold leading-none">{t.v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="p-4 sm:p-5">
        <p className="label text-[11px] text-tone-3">Your top shows</p>
        {data.top.length ? (
          <ul role="list" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.top.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.03 }}
              >
                <a href={malAnimeUrl(a.id)} target="_blank" rel="noopener noreferrer" className="focus-ring group flex gap-2.5 border-[3px] border-ink p-2 hover:bg-lav">
                  {a.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element -- MAL CDN poster
                    <img src={a.picture} alt="" width={44} height={62} loading="lazy" referrerPolicy="no-referrer" className="h-[62px] w-11 shrink-0 border-2 border-ink object-cover" />
                  ) : (
                    <span aria-hidden="true" className="screentone screentone-mid h-[62px] w-11 shrink-0 border-2 border-ink bg-lav" />
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13.5px] font-bold leading-tight">{a.en || a.title}</span>
                    <span className="mt-1 block text-[12px] text-tone-3">
                      {a.status === 'watching' ? 'Watching' : a.status === 'completed' ? 'Completed' : a.status === 'on_hold' ? 'On hold' : ''}
                      {a.score ? ` · ★ ${a.score}` : ''}
                    </span>
                  </span>
                </a>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-tone-2">Your list is empty on MyAnimeList — add a few shows there, then hit Sync now.</p>
        )}
      </div>
    </div>
  )
}

export default MalPanel
