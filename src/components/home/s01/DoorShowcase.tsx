'use client'
// S01 — what is behind the door: the live catalogue. Owner: S01.
//  • <ShowcaseDoorway>  the product cards inside the CSS door's doorway (behind the swinging leaf)
//  • <ShowcaseChip>     the clickable name + price chip over the portal; it owns the 2.2 s clock
// The WebGL door reads the same `showcaseStore.i` every frame (DoorPortal3D), so all three agree.
// Auto-advance only runs while the chip is visible (door open), on screen, tab visible, not hovered/focused,
// not paused, and never under reduced motion (manual next/prev still work there).
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { SHOWCASE_MS, showcaseStore, type ShowcaseItem } from './showcase'

const getI = () => showcaseStore.i
const getPaused = () => showcaseStore.paused
const getTick = () => showcaseStore.tick
const server0 = () => 0
const serverFalse = () => false

export function useShowcaseIndex(): number {
  return useSyncExternalStore(showcaseStore.subscribe.bind(showcaseStore), getI, server0)
}

/** Product cards stacked inside the doorway; only the current + next image are ever requested. */
export function ShowcaseDoorway({ items }: { items: ShowcaseItem[] }) {
  const i = useShowcaseIndex()
  const n = items.length
  const [seen, setSeen] = useState<number[]>(() => (n > 1 ? [0, 1] : [0]))

  useEffect(() => {
    if (!showcaseStore.n) showcaseStore.n = n
  }, [n])

  // reveal as we go: current + next are mounted (and so preloaded); earlier ones stay for the cross-fade
  const want = n ? [i, (i + 1) % n] : []
  if (want.some((k) => !seen.includes(k))) setSeen((s) => [...new Set([...s, ...want])])

  if (!n) return null
  return (
    <div aria-hidden="true" className="absolute inset-0">
      {/* soft burst behind the card */}
      <div className="absolute left-1/2 top-[46%] aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/35 blur-2xl" />
      {items.map((it, k) =>
        seen.includes(k) ? (
          <div
            key={`${it.slug}-${k}`}
            data-on={k === i ? '' : undefined}
            className="absolute left-[8%] right-[8%] top-[45%] aspect-[4/5] border-[3px] border-ink bg-paper shadow-[5px_5px_0_0_var(--color-ink)] transition-[opacity,clip-path,translate,rotate] duration-[460ms] ease-[var(--ease-expo)] motion-reduce:transition-none"
            style={{
              translate: k === i ? '0 -54%' : '0 -46%',
              rotate: k === i ? '-1.5deg' : '3deg',
              opacity: k === i ? 1 : 0,
              clipPath: k === i ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
              zIndex: k === i ? 2 : 1,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized rasters; lazy, decorative (the chip carries the link + name) */}
            <img
              src={it.src}
              alt=""
              width={600}
              height={750}
              loading={k === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              className="block h-full w-full object-cover"
            />
          </div>
        ) : null,
      )}
    </div>
  )
}

/** Name + price chip (links to the product) and the clock that advances the showcase. */
export function ShowcaseChip({ items, className }: { items: ShowcaseItem[]; className?: string }) {
  const i = useShowcaseIndex()
  const paused = useSyncExternalStore(showcaseStore.subscribe.bind(showcaseStore), getPaused, serverFalse)
  const tick = useSyncExternalStore(showcaseStore.subscribe.bind(showcaseStore), getTick, server0)
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [held, setHeld] = useState(false) // hover / focus inside the chip pauses it
  const n = items.length
  const item = items[Math.min(i, n - 1)]

  useEffect(() => {
    showcaseStore.n = n
    if (showcaseStore.i >= n) showcaseStore.set(0)
  }, [n])

  useEffect(() => {
    const el = root.current?.closest('[data-portal]') ?? root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const auto = n > 1 && inView && !paused && !held && !reduce
  const [rearm, setRearm] = useState(0)
  useEffect(() => {
    if (!auto) return
    const t = window.setTimeout(() => {
      const el = root.current
      const cs = el ? getComputedStyle(el) : null
      // GSAP hides the chip (autoAlpha) while the door is shut → nothing to watch, don't spend bandwidth
      const shown = !!cs && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.2
      if (shown && !document.hidden) showcaseStore.set(showcaseStore.i + 1)
      else setRearm((x) => x + 1)
    }, SHOWCASE_MS)
    return () => window.clearTimeout(t)
    // `tick` restarts the timer after every change (manual or automatic)
  }, [auto, tick, rearm])

  if (!n || !item) return null
  return (
    <div
      ref={root}
      data-showcase-chip
      className={cn('pointer-events-none flex flex-col items-center', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
    >
      <div className="pointer-events-auto flex max-w-full items-stretch border-[3px] border-ink bg-paper text-ink shadow-[4px_4px_0_0_var(--color-ink)]">
        {n > 1 && (
          <button
            type="button"
            onClick={() => showcaseStore.set(showcaseStore.i - 1)}
            className="focus-ring flex w-10 shrink-0 items-center justify-center border-r-[3px] border-ink transition-colors duration-150 hover:bg-volt"
            aria-label="Previous product"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
        )}
        <Link
          href={`/product/${item.slug}`}
          data-cursor="VIEW"
          className="focus-ring group/chip flex min-h-12 min-w-0 items-center gap-2.5 px-3 py-1.5"
          aria-label={`${item.name}, ${item.price} — view product`}
        >
          <span className="label hidden shrink-0 bg-volt px-1.5 py-0.5 text-[10px] text-ink min-[400px]:inline">{item.kind}</span>
          <span key={item.slug} className="min-w-0 truncate font-display text-[17px] uppercase leading-none tracking-[0.02em] motion-safe:animate-[ted-fade-in_.3s_ease-out] sm:text-[19px]">
            {item.name}
          </span>
          <span className="shrink-0 bg-ink px-1.5 py-1 font-mono text-[12px] font-bold leading-none text-volt">{item.price}</span>
          <span aria-hidden="true" className="shrink-0 font-mono text-[15px] transition-transform duration-200 group-hover/chip:translate-x-1">
            →
          </span>
        </Link>
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => showcaseStore.set(showcaseStore.i + 1)}
              className="focus-ring flex w-10 shrink-0 items-center justify-center border-l-[3px] border-ink transition-colors duration-150 hover:bg-volt"
              aria-label="Next product"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
            {!reduce && (
              <button
                type="button"
                onClick={() => showcaseStore.setPaused(!paused)}
                className="focus-ring hidden w-10 shrink-0 items-center justify-center border-l-[3px] border-ink bg-ink text-paper transition-colors duration-150 hover:bg-tone-2 sm:flex"
                aria-label={paused ? 'Play the product slideshow' : 'Pause the product slideshow'}
                aria-pressed={paused}
              >
                {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
              </button>
            )}
          </>
        )}
      </div>
      {/* timer bar */}
      {n > 1 && !reduce && (
        <span aria-hidden="true" className="mt-1.5 block h-[5px] w-[min(220px,60%)] border-2 border-ink bg-paper">
          <span
            key={`${tick}-${rearm}-${auto}`}
            className="block h-full origin-left bg-door"
            style={{
              transform: auto ? undefined : 'scaleX(0)',
              animation: auto ? `ted-showcase-bar ${SHOWCASE_MS}ms linear both` : undefined,
            }}
          />
        </span>
      )}
      <span className="sr-only" aria-live="off">
        Showing {i + 1} of {n}
      </span>
      <style>{'@keyframes ted-showcase-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
    </div>
  )
}
