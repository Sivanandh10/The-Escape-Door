'use client'
// "Picked for you" (owner: AUTH) — personal rows for a signed-in shopper, built from REAL signals only:
// recently viewed products, cart + wishlist, and (when linked) their MyAnimeList list + MAL suggestions.
//   <ForYou exclude={slug} />            product page: compact (picks + one "because you watched" row + recent)
//   <ForYou variant="account" />         /account: everything + anime suggestions + "Request merch" for unmapped shows
// Signed out: product variant shows a one-line login nudge; account variant renders nothing.
// Data: GET /api/auth/me/recs (dynamic, cookie-bound) so the product page itself stays static.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight, Check, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProductCard } from '@/components/shop/ProductCard'
import { useCustomer } from '@/lib/auth/customer'
import { clearRecentViews, requestAnimeMerch } from '@/lib/auth/actions'
import { useCart, useHydrated, useWishlist } from '@/lib/cart'
import { malAnimeUrl } from '@/lib/recs/mal-map'
import type { AnimeRef, RecsPayload, SuggestionRef } from '@/lib/recs/types'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface ForYouProps {
  exclude?: string
  variant?: 'product' | 'account'
  className?: string
}

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: RecsPayload }

export function ForYou({ exclude, variant = 'product', className }: ForYouProps) {
  const { customer, loading, openLogin } = useCustomer()
  const hydrated = useHydrated()
  const cartIds = useCart((s) => s.items.map((i) => i.productId).join(','))
  const wishIds = useWishlist((s) => s.ids.join(','))
  const [state, setState] = useState<State>({ status: 'idle' })
  const [nonce, setNonce] = useState(0)
  const full = variant === 'account'

  const ids = useMemo(() => [...new Set([...cartIds.split(','), ...wishIds.split(',')].filter(Boolean))].slice(0, 60).join(','), [cartIds, wishIds])

  useEffect(() => {
    if (loading || !customer || !hydrated) return
    const ctrl = new AbortController()
    const q = new URLSearchParams()
    if (exclude) q.set('exclude', exclude)
    if (ids) q.set('ids', ids)
    if (full) q.set('full', '1')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for the fetch this effect starts
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }))
    fetch(`/api/auth/me/recs?${q}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<RecsPayload>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') setState({ status: 'error' })
      })
    return () => ctrl.abort()
  }, [customer, loading, hydrated, exclude, ids, full, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])

  if (loading) return null
  if (!customer) {
    if (full) return null
    return (
      <section aria-label="Picks for you" className={cn('container-x pb-16', className)}>
        <div className="flex flex-col items-start gap-3 border-[3px] border-paper/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-paper/85">
            <Sparkles aria-hidden="true" className="mr-2 inline size-4 text-volt" />
            Log in and we’ll pick drops from what you browse — and from your MyAnimeList, if you link it.
          </p>
          <button
            type="button"
            onClick={() => openLogin('Log in for picks made for you')}
            className="press focus-ring min-h-11 shrink-0 border-[3px] border-ink bg-volt px-4 font-display text-[18px] uppercase text-ink shadow-hard-paper"
          >
            Get my picks
          </button>
        </div>
      </section>
    )
  }

  if (state.status === 'idle' || state.status === 'loading') return <RecsSkeleton full={full} className={className} />
  if (state.status === 'error') {
    return (
      <section aria-label="Picks for you" className={cn(full ? '' : 'container-x pb-16', className)}>
        <div className="flex flex-wrap items-center gap-3 border-[3px] border-hype p-4 text-paper">
          <p>We couldn’t load your picks just now.</p>
          <button type="button" onClick={retry} className="press focus-ring inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-4 font-bold text-ink">
            <RefreshCw aria-hidden="true" className="size-4" /> Retry
          </button>
        </div>
      </section>
    )
  }

  const d = state.data
  const nothing = !d.recent.length && !d.picks.length && !d.watched.length && !d.suggestions.length && !d.unmapped.length

  if (!full) {
    if (nothing) return null
    const firstWatched = d.watched[0]
    return (
      <section aria-labelledby="foryou-h" className={cn('container-x pb-20 md:pb-28', className)}>
        {d.picks.length > 0 && (
          <Row id="foryou-h" kicker={d.pickReason ?? 'Picked for you'} before="Picked for " accent="you" jp="あなたへ" products={d.picks.slice(0, 4)} />
        )}
        {firstWatched && (
          <Row
            id={d.picks.length ? undefined : 'foryou-h'}
            kicker={`From your MyAnimeList`}
            before="Because you watched "
            accent={firstWatched.anime.title}
            jp={firstWatched.collection.jp}
            products={firstWatched.products}
            more={{ href: `/arc/${firstWatched.collection.slug}`, label: `All ${firstWatched.collection.name}` }}
          />
        )}
        {d.recent.length > 0 && (
          <Row id={d.picks.length || firstWatched ? undefined : 'foryou-h'} kicker="Your trail" before="Recently " accent="viewed" products={d.recent.slice(0, 4)} small />
        )}
      </section>
    )
  }

  // ---- account: everything
  return (
    <div className={cn('space-y-14', className)}>
      {nothing && (
        <div className="border-[3px] border-paper/30 p-6 text-paper/85">
          <p className="font-display text-[28px] uppercase leading-none text-paper">Your picks start here</p>
          <p className="mt-2 max-w-xl">Open a few products, add something to your wishlist, or link MyAnimeList — we’ll start picking drops for you straight away.</p>
          <Link href="/shop" className="press focus-ring mt-4 inline-flex min-h-11 items-center border-[3px] border-ink bg-volt px-4 font-display text-[18px] uppercase text-ink shadow-hard-paper">
            Browse the shop
          </Link>
        </div>
      )}
      {d.picks.length > 0 && <Row kicker={d.pickReason ?? 'Picked for you'} before="Picked for " accent="you" jp="あなたへ" products={d.picks} />}
      {d.watched.map((w) => (
        <Row
          key={w.collection.slug}
          kicker="From your MyAnimeList"
          before="Because you watched "
          accent={w.anime.title}
          jp={w.collection.jp}
          products={w.products}
          more={{ href: `/arc/${w.collection.slug}`, label: `All ${w.collection.name}` }}
        />
      ))}
      {d.unmapped.length > 0 && <Unmapped items={d.unmapped} beyond={d.beyond} />}
      {d.suggestions.length > 0 && <Suggestions items={d.suggestions} />}
      {d.recent.length > 0 && <RecentRow products={d.recent} onCleared={retry} />}
    </div>
  )
}

function Head({ id, kicker, before, accent, jp }: { id?: string; kicker?: string; before: string; accent: string; jp?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {kicker && <p className="label text-[0.6875rem] text-volt">{kicker}</p>}
      <h2 id={id} className="h-display text-[clamp(2rem,4.6vw,3.75rem)] text-paper">
        {before}
        <em>{accent}</em>
      </h2>
      {jp && (
        <p lang="ja" className="jp-sub text-paper">
          {jp}
        </p>
      )}
    </div>
  )
}

function Row({ id, kicker, before, accent, jp, products, more, small }: { id?: string; kicker?: string; before: string; accent: string; jp?: string; products: Product[]; more?: { href: string; label: string }; small?: boolean }) {
  return (
    <div className="mt-12 first:mt-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Head id={id} kicker={kicker} before={before} accent={accent} jp={jp} />
        {more && (
          <Link href={more.href} className="label focus-ring inline-flex min-h-11 items-center gap-1.5 text-[0.6875rem] text-paper/85 underline decoration-2 underline-offset-4 hover:text-volt">
            {more.label} <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      <ul role="list" className={cn('grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-5', small ? 'lg:grid-cols-4 xl:grid-cols-6' : 'lg:grid-cols-4')}>
        {products.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <ProductCard product={p} index={i} headingLevel="h3" quickAdd={!small} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecentRow({ products, onCleared }: { products: Product[]; onCleared: () => void }) {
  const [busy, setBusy] = useState(false)
  const clear = async () => {
    setBusy(true)
    const r = await clearRecentViews()
    setBusy(false)
    if (r.ok) {
      toast.success('History cleared.')
      onCleared()
    } else toast.error(r.error)
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Head kicker="Your trail" before="Recently " accent="viewed" jp="最近見た" />
        <button type="button" onClick={clear} disabled={busy} className="label focus-ring inline-flex min-h-11 items-center gap-1.5 text-[0.6875rem] text-paper/80 hover:text-hype disabled:opacity-60">
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />} Clear history
        </button>
      </div>
      <ul role="list" className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-5 md:grid-cols-4 xl:grid-cols-6">
        {products.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <ProductCard product={p} index={i} headingLevel="h3" quickAdd={false} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function AnimeThumb({ a }: { a: AnimeRef }) {
  return a.picture ? (
    // eslint-disable-next-line @next/next/no-img-element -- MAL CDN poster, small, lazy
    <img src={a.picture} alt="" width={56} height={80} loading="lazy" referrerPolicy="no-referrer" className="h-20 w-14 shrink-0 border-2 border-ink object-cover" />
  ) : (
    <span aria-hidden="true" className="screentone screentone-mid h-20 w-14 shrink-0 border-2 border-ink bg-lav" />
  )
}

function Unmapped({ items, beyond }: { items: AnimeRef[]; beyond: Product[] }) {
  const [sent, setSent] = useState<Record<number, 'busy' | 'done'>>({})
  const request = async (a: AnimeRef) => {
    setSent((s) => ({ ...s, [a.id]: 'busy' }))
    const r = await requestAnimeMerch({ title: a.title, malId: a.id })
    if (r.ok) {
      setSent((s) => ({ ...s, [a.id]: 'done' }))
      toast.success(`Request sent for ${a.title}`, { description: 'We’ll message you if we make a drop for it.' })
    } else {
      setSent((s) => {
        const n = { ...s }
        delete n[a.id]
        return n
      })
      toast.error(r.error)
    }
  }
  return (
    <div>
      <Head kicker="Not in the shop yet" before="Want merch for " accent="these?" jp="リクエスト" />
      <p className="mt-3 max-w-2xl text-paper/80">You rate these on MyAnimeList but we don’t make a drop for them yet. Tap request — enough asks and we draw one.</p>
      <ul role="list" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a, i) => {
          const st = sent[a.id]
          return (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.04 }}
              className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 text-ink shadow-hard-sm"
            >
              <AnimeThumb a={a} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-bold leading-tight">{a.title}</p>
                <a href={malAnimeUrl(a.id)} target="_blank" rel="noopener noreferrer" className="focus-ring mt-1 inline-flex min-h-8 items-center gap-1 text-[12.5px] font-bold text-door underline">
                  On MyAnimeList <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </a>
              </div>
              <button
                type="button"
                onClick={() => request(a)}
                disabled={!!st}
                className={cn(
                  'press focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 border-[3px] border-ink px-3 text-[14px] font-bold',
                  st === 'done' ? 'bg-volt' : 'bg-ink text-paper hover:bg-door',
                )}
              >
                {st === 'busy' ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : st === 'done' ? <Check aria-hidden="true" className="size-4" /> : null}
                {st === 'done' ? 'Requested' : 'Request merch'}
              </button>
            </motion.li>
          )
        })}
      </ul>
      {beyond.length > 0 && (
        <div className="mt-10">
          <p className="label mb-4 text-[0.6875rem] text-paper/75">Meanwhile, from Beyond Anime</p>
          <ul role="list" className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-5 lg:grid-cols-4">
            {beyond.map((p, i) => (
              <li key={p.id} className="min-w-0">
                <ProductCard product={p} index={i} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Suggestions({ items }: { items: SuggestionRef[] }) {
  return (
    <div>
      <Head kicker="MyAnimeList suggests" before="Anime you might " accent="watch next" jp="次に観るなら" />
      <ul role="list" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 border-[3px] border-paper/25 p-3 text-paper">
            <AnimeThumb a={s} />
            <div className="min-w-0 flex-1">
              <a href={malAnimeUrl(s.id)} target="_blank" rel="noopener noreferrer" className="focus-ring line-clamp-2 font-bold leading-tight hover:text-volt">
                {s.title}
                <span className="sr-only"> (opens MyAnimeList)</span>
              </a>
              <p className="mt-1 text-[12.5px] text-paper/70">
                {[s.mean ? `★ ${s.mean.toFixed(2)}` : null, s.genres.join(' · ')].filter(Boolean).join('  ·  ')}
              </p>
              {s.collection && (
                <Link href={`/arc/${s.collection}`} className="focus-ring label mt-1.5 inline-flex min-h-8 items-center border-2 border-ink bg-volt px-2 text-[10px] text-ink">
                  We make merch for this →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecsSkeleton({ full, className }: { full: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn(full ? '' : 'container-x pb-20', className)}>
      <div className="skeleton-tone mb-6 h-12 w-64 max-w-full" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton-tone aspect-[4/5] border-[3px] border-ink" />
        ))}
      </div>
    </div>
  )
}

export default ForYou
