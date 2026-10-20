'use client'
// ProductGrid — responsive grid of ProductCards with #08 staggered reveal (owner: P1 shop).
// - First paint: everything visible (SSR/SEO); cards below the fold slam in on scroll (ScrollTrigger.batch).
// - Filter change: GSAP Flip — survivors glide to their new slots, newcomers stagger in.
// - Paging is client-side (no server pagination, CONTRACTS §10.1):
//     uncontrolled (no `page` prop): "Load more" appends pageSize at a time (arc pages, older callers).
//     controlled (`page` + `onPageChange`, the shop): numbered pages on md+ (slice = that page), and a
//       "Load more" button on phones (slice = pages 1..page, so ?page=3 restores the same scroll depth).
//
// PROPS: products, collectionNames?: Record<slug,name>, pageSize? (default 24, 0 = all),
//        priorityCount? (default 4), flipKey? (string that changes when the filter changes),
//        page?: number (1-based, controlled), onPageChange?(page, how: 'jump'|'more'), hrefFor?(page) → link href,
//        empty?: ReactNode, headingLevel?, className?
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Product } from '@/lib/types'
import { registerGsap, prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ProductCard } from './ProductCard'

export interface ProductGridProps {
  products: Product[]
  collectionNames?: Record<string, string>
  pageSize?: number
  priorityCount?: number
  flipKey?: string
  empty?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
  /** controlled paging (1-based) */
  page?: number
  onPageChange?: (page: number, how: 'jump' | 'more') => void
  hrefFor?: (page: number) => string
}

const PHONE = '(max-width: 767.98px)'
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
/** phones get "Load more", larger screens numbered pages. Server snapshot = not a phone (page 1 is identical). */
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false)
}

/** 1 … 4 5 6 … 12 */
export function pageWindow(cur: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: Array<number | 'gap'> = [1]
  const lo = Math.max(2, cur - 1), hi = Math.min(total - 1, cur + 1)
  if (lo > 2) out.push('gap')
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < total - 1) out.push('gap')
  out.push(total)
  return out
}

export function ProductGrid({
  products,
  collectionNames,
  pageSize = 24,
  priorityCount = 4,
  flipKey = '',
  empty,
  headingLevel = 'h3',
  className,
  page,
  onPageChange,
  hrefFor,
}: ProductGridProps) {
  const phone = useIsPhone()
  const list = useRef<HTMLUListElement>(null)
  const [shown, setShown] = useState(pageSize || products.length)
  const [lastKey, setLastKey] = useState(flipKey)
  const flipState = useRef<Flip.FlipState | null>(null)
  const prevKey = useRef(flipKey)

  // reset paging when the filter changes (derived during render, not in an effect)
  if (lastKey !== flipKey) {
    setLastKey(flipKey)
    setShown(pageSize || products.length)
  }

  // capture positions *before* React commits the new filter result. Deliberate render-phase read: FLIP needs the
  // OLD layout, and by the time any effect runs the DOM already shows the new result (guarded: once per key change)
  /* eslint-disable react-hooks/refs */
  if (prevKey.current !== flipKey && list.current && !flipState.current && typeof window !== 'undefined') {
    registerGsap()
    flipState.current = Flip.getState(list.current.querySelectorAll('[data-flip-id]'))
  }
  /* eslint-enable react-hooks/refs */

  // filter change → Flip
  useLayoutEffect(() => {
    if (prevKey.current === flipKey) return
    prevKey.current = flipKey
    const state = flipState.current
    flipState.current = null
    if (!state || !list.current || prefersReducedMotion()) return
    const tl = Flip.from(state, {
      targets: list.current.querySelectorAll('[data-flip-id]'),
      duration: 0.55,
      ease: 'power3.out',
      stagger: 0.015,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, y: 36, scale: 0.94, rotation: -1.5 }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.045, clearProps: 'transform,opacity' }),
    })
    return () => { tl.kill() }
  }, [flipKey])

  // scroll-in reveal for cards below the fold (#08)
  useLayoutEffect(() => {
    if (!list.current || prefersReducedMotion()) return
    registerGsap()
    const items = Array.from(list.current.querySelectorAll<HTMLElement>('[data-flip-id]:not([data-revealed])'))
    const below = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92)
    items.forEach((el) => el.setAttribute('data-revealed', ''))
    if (!below.length) return
    gsap.set(below, { opacity: 0, y: 48 })
    const triggers = ScrollTrigger.batch(below, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.07, overwrite: true, clearProps: 'transform,opacity' }),
    })
    return () => {
      triggers.forEach((t) => t.kill())
      gsap.set(below, { clearProps: 'transform,opacity' })
    }
  }, [shown, flipKey])

  if (!products.length) return <>{empty}</>
  const controlled = page != null && pageSize > 0
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(products.length / pageSize)) : 1
  const cur = controlled ? Math.min(Math.max(1, Math.floor(page)), pages) : 1
  const visible = !pageSize
    ? products
    : controlled
      ? phone
        ? products.slice(0, cur * pageSize)
        : products.slice((cur - 1) * pageSize, cur * pageSize)
      : products.slice(0, shown)
  const go = (n: number, how: 'jump' | 'more') => (e?: MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return // new tab: let the link work
    e?.preventDefault()
    onPageChange?.(n, how)
  }

  return (
    <div className={className}>
      <ul ref={list} className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 md:grid-cols-3 xl:grid-cols-4" role="list">
        {visible.map((p, i) => (
          <li key={p.id} data-flip-id={p.id} className="min-w-0">
            <ProductCard
              product={p}
              index={i}
              priority={i < priorityCount}
              collectionName={collectionNames?.[p.collection]}
              headingLevel={headingLevel}
            />
          </li>
        ))}
      </ul>
      {controlled && pages > 1 && (
        <>
          {/* phones: load more (pages 1..n stay on screen) */}
          {cur < pages && (
            <div className="mt-10 flex flex-col items-center gap-3 md:hidden">
              <p className="label opacity-70" aria-live="polite">
                Showing {Math.min(products.length, cur * pageSize)} of {products.length}
              </p>
              <button
                type="button"
                onClick={go(cur + 1, 'more')}
                className="press h-display min-h-12 border-[3px] border-ink bg-paper px-6 text-xl text-ink shadow-hard-volt focus-ring"
              >
                Turn the page — load {Math.min(pageSize, products.length - cur * pageSize)} more
              </button>
            </div>
          )}
          {/* tablets + desktop: numbered pages */}
          <nav aria-label="Catalogue pages" className="mt-12 flex flex-col items-center gap-4 max-md:hidden">
            <p className="label text-[0.6875rem] opacity-70" aria-live="polite">
              Showing {(cur - 1) * pageSize + 1}–{Math.min(products.length, cur * pageSize)} of {products.length}
            </p>
            <ul role="list" className="flex flex-wrap items-center justify-center gap-2">
              <li>
                <PageLink href={hrefFor?.(cur - 1)} disabled={cur <= 1} onClick={go(cur - 1, 'jump')} label="Previous page">
                  <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={3} />
                </PageLink>
              </li>
              {pageWindow(cur, pages).map((n, i) =>
                n === 'gap' ? (
                  <li key={`gap-${i}`} aria-hidden="true" className="px-1 font-mono text-sm opacity-60">…</li>
                ) : (
                  <li key={n}>
                    <PageLink href={hrefFor?.(n)} current={n === cur} onClick={go(n, 'jump')} label={`Page ${n}`}>
                      {n}
                    </PageLink>
                  </li>
                ),
              )}
              <li>
                <PageLink href={hrefFor?.(cur + 1)} disabled={cur >= pages} onClick={go(cur + 1, 'jump')} label="Next page">
                  <ChevronRight aria-hidden="true" className="size-5" strokeWidth={3} />
                </PageLink>
              </li>
            </ul>
          </nav>
        </>
      )}
      {!controlled && pageSize > 0 && shown < products.length && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="label opacity-70" aria-live="polite">
            Showing {visible.length} of {products.length}
          </p>
          <button
            type="button"
            onClick={() => setShown((n) => n + pageSize)}
            className={cn('press h-display min-h-12 border-[3px] border-ink bg-paper px-6 text-xl text-ink shadow-hard-volt focus-ring')}
          >
            Turn the page — load {Math.min(pageSize, products.length - shown)} more
          </button>
        </div>
      )}
    </div>
  )
}

function PageLink({ href, current, disabled, onClick, label, children }: { href?: string; current?: boolean; disabled?: boolean; onClick: (e: MouseEvent) => void; label: string; children: ReactNode }) {
  const cls = cn(
    'press grid h-12 min-w-12 place-items-center border-[3px] border-ink px-3 font-mono text-base font-bold tabular-nums focus-ring',
    current ? 'bg-ink text-volt shadow-[3px_3px_0_0_var(--color-volt)]' : 'bg-paper text-ink shadow-hard-sm can-hover:hover:bg-volt',
    disabled && 'pointer-events-none opacity-35 shadow-none',
  )
  if (disabled) return <span aria-hidden="true" className={cls}>{children}</span>
  return (
    <a href={href ?? '#'} onClick={onClick} aria-label={label} aria-current={current ? 'page' : undefined} className={cls}>
      {children}
    </a>
  )
}

export default ProductGrid
