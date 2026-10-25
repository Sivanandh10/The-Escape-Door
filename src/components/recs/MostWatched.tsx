'use client'
// "Your most-watched anime" (owner: MAL-RECS) — the top franchises from the shopper's MyAnimeList, ranked by the
// affinity model (src/lib/recs/affinity.ts): episodes watched + their MAL score. Anime we already make pieces for link to
// the arc; anime we don't → "We don't have <anime> merch yet — Request it" (creates a lead via requestAnimeMerch).
//   <MostWatched top={…} />            /account "Picked for you": ranked cards
//   <MostWatched top={…} compact />    top of the home / shop "Picked for you" row: one scrollable strip
// Signature moment: the rank numbers stamp in (spring) and a request flips to "Requested" with a check.
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight, Check, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { requestAnimeMerch } from '@/lib/auth/actions'
import { malAnimeUrl } from '@/lib/recs/mal-map'
import { useReducedMotion } from '@/lib/motion'
import type { TopAnime } from '@/lib/recs/types'
import { cn } from '@/lib/utils'

const STATUS: Record<string, string> = { watching: 'Watching', completed: 'Completed', on_hold: 'On hold', plan_to_watch: 'Plan to watch' }

export function epsLabel(n: number | undefined): string {
  return n ? `${n} ${n === 1 ? 'ep' : 'eps'}` : ''
}

function useRequest() {
  const [sent, setSent] = useState<Record<number, 'busy' | 'done'>>({})
  const request = async (a: TopAnime) => {
    setSent((s) => ({ ...s, [a.id]: 'busy' }))
    const r = await requestAnimeMerch({ title: a.title, malId: a.id })
    if (r.ok) {
      setSent((s) => ({ ...s, [a.id]: 'done' }))
      toast.success(`Request sent for ${a.title}`, { description: 'Enough asks and we draw a drop for it. We’ll message you.' })
    } else {
      setSent((s) => {
        const n = { ...s }
        delete n[a.id]
        return n
      })
      toast.error(r.error)
    }
  }
  return { sent, request }
}

function Poster({ a, small }: { a: TopAnime; small?: boolean }) {
  const cls = small ? 'h-12 w-9' : 'h-20 w-14'
  return a.picture ? (
    // eslint-disable-next-line @next/next/no-img-element -- MAL CDN poster, small, lazy
    <img src={a.picture} alt="" width={small ? 36 : 56} height={small ? 48 : 80} loading="lazy" referrerPolicy="no-referrer" className={cn(cls, 'shrink-0 border-2 border-ink object-cover')} />
  ) : (
    <span aria-hidden="true" className={cn(cls, 'screentone screentone-mid shrink-0 border-2 border-ink bg-lav')} />
  )
}

function RequestButton({ a, state, onRequest, small }: { a: TopAnime; state?: 'busy' | 'done'; onRequest: (a: TopAnime) => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onRequest(a)}
      disabled={!!state}
      aria-label={state === 'done' ? `Requested merch for ${a.title}` : `Request ${a.title} merch`}
      className={cn(
        'press focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 border-[3px] border-ink font-bold transition-colors duration-150',
        small ? 'px-2.5 text-[12.5px]' : 'px-3 text-[14px]',
        state === 'done' ? 'bg-volt text-ink' : 'bg-ink text-paper hover:bg-door',
      )}
    >
      {state === 'busy' ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : state === 'done' ? (
        <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
          <Check aria-hidden="true" className="size-4" />
        </motion.span>
      ) : (
        <Send aria-hidden="true" className="size-3.5" />
      )}
      {state === 'done' ? 'Requested' : 'Request it'}
    </button>
  )
}

export function MostWatched({ top, compact, className }: { top: TopAnime[]; compact?: boolean; className?: string }) {
  const reduced = useReducedMotion()
  const { sent, request } = useRequest()
  if (!top.length) return null
  const items = top.slice(0, 5)

  if (compact) {
    return (
      <div className={cn('mb-6', className)} data-mal-top="">
        <p className="label mb-2 text-[0.6875rem] text-paper/75">Your most-watched anime · from MyAnimeList</p>
        <ol role="list" className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {items.map((a, i) => (
            <li key={a.key} className="flex min-w-[15.5rem] max-w-[19rem] shrink-0 snap-start items-center gap-2.5 border-[3px] border-ink bg-paper p-2 pr-2.5 text-ink shadow-hard-sm">
              <span className="font-display text-[22px] leading-none text-door" aria-label={`Number ${i + 1}`}>
                {i + 1}
              </span>
              <Poster a={a} small />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold leading-tight" title={a.title}>
                  {a.title}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11.5px] text-tone-3">
                  {[epsLabel(a.episodes), a.score ? `★ ${a.score}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              {a.stocked ? (
                a.collection ? (
                  <Link href={`/arc/${a.collection}`} className="focus-ring label inline-flex min-h-11 shrink-0 items-center gap-1 border-2 border-ink bg-volt px-2 text-[10px]">
                    Shop <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : (
                  <span className="label shrink-0 border-2 border-ink bg-volt px-2 py-1 text-[10px]">In shop</span>
                )
              ) : (
                <RequestButton a={a} state={sent[a.id]} onRequest={request} small />
              )}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className={className} data-mal-top="">
      <div className="flex flex-col gap-1.5">
        <p className="label text-[0.6875rem] text-volt">Ranked by episodes watched, your score and how recently you watched</p>
        <h2 className="h-display text-[clamp(2rem,4.6vw,3.75rem)] text-paper">
          Your most-watched <em>anime</em>
        </h2>
        <p lang="ja" className="jp-sub text-paper">
          よく観たアニメ
        </p>
      </div>
      <ol role="list" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a, i) => (
          <li key={a.key} className="relative flex items-center gap-3 border-[3px] border-ink bg-paper p-3 pl-4 text-ink shadow-hard-sm">
            <motion.span
              aria-hidden="true"
              initial={reduced ? false : { scale: 1.8, rotate: -12, opacity: 0 }}
              whileInView={reduced ? undefined : { scale: 1, rotate: -6, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 520, damping: 20, delay: i * 0.06 }}
              className="absolute -left-2.5 -top-3 grid size-8 place-items-center border-[3px] border-ink bg-volt font-display text-[18px] leading-none"
            >
              {i + 1}
            </motion.span>
            <Poster a={a} />
            <div className="min-w-0 flex-1">
              <a href={malAnimeUrl(a.id)} target="_blank" rel="noopener noreferrer" className="focus-ring line-clamp-2 font-bold leading-tight hover:text-door">
                <span className="sr-only">Number {i + 1}: </span>
                {a.title}
                <span className="sr-only"> (opens MyAnimeList)</span>
              </a>
              <p className="mt-1 font-mono text-[12px] text-tone-3">
                {[epsLabel(a.episodes), a.score ? `★ ${a.score}/10` : 'not scored', STATUS[a.status ?? ''] ?? null].filter(Boolean).join(' · ')}
              </p>
              {a.stocked ? (
                a.collection ? (
                  <Link href={`/arc/${a.collection}`} className="focus-ring label mt-1.5 inline-flex min-h-8 items-center border-2 border-ink bg-volt px-2 text-[10px]">
                    We make merch for this →
                  </Link>
                ) : (
                  <span className="label mt-1.5 inline-flex min-h-8 items-center border-2 border-ink bg-volt px-2 text-[10px]">Pieces in the shop ↓</span>
                )
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-[12.5px] leading-snug text-tone-2">We don’t have {a.title} merch yet.</p>
                  <RequestButton a={a} state={sent[a.id]} onRequest={request} small />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default MostWatched
