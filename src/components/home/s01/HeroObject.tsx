'use client'
// S01 — the product object behind the door (CSS path: phones, tablets, reduced motion, no-WebGL) + its chip.
// Owner: S01. STATIC set (./objects.ts), swapped by scroll position (HeroMotion → heroObjectStore).
//  • <DoorObject>  a transparent cut-out floating in the doorway light, perspective tilt + sway, no card/box.
//                  Swap = quick punchy spin-in (250 ms, WAAPI). Reduced motion: the tee, still.
//  • <ObjectChip>  what is on show + a link to that category (GSAP fades it in once the door is open).
import Link from 'next/link'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { HERO_OBJECTS, heroObjectStore } from './objects'
import st from './hero.module.css'

const getI = () => heroObjectStore.i
const server0 = () => 0

export function useHeroObjectIndex(): number {
  return useSyncExternalStore(heroObjectStore.subscribe.bind(heroObjectStore), getI, server0)
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function DoorObject() {
  const i = useHeroObjectIndex()
  const refs = useRef<(HTMLImageElement | null)[]>([])
  const prev = useRef(i)

  useEffect(() => {
    const from = prev.current
    prev.current = i
    if (from === i || reduced()) return
    const out = refs.current[from]
    const inn = refs.current[i]
    const dir = i > from ? 1 : -1
    out?.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `scale(0.62) rotateY(${-70 * dir}deg) rotate(${-8 * dir}deg)` },
      ],
      { duration: 130, easing: 'cubic-bezier(.55,0,1,.45)' },
    )
    inn?.animate(
      [
        { opacity: 0, transform: `scale(0.55) rotateY(${75 * dir}deg) rotate(${7 * dir}deg)` },
        { opacity: 1, transform: `scale(1.09) rotateY(${-8 * dir}deg) rotate(${-1 * dir}deg)`, offset: 0.62 },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 250, easing: 'cubic-bezier(.2,.9,.3,1)' },
    )
  }, [i])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" style={{ perspective: '760px' }}>
      <div className={cn(st.objSway, 'relative aspect-square w-[98%]')}>
        {HERO_OBJECTS.map((o, k) => (
          // eslint-disable-next-line @next/next/no-img-element -- small pre-sized static alpha rasters (srcSet), decorative
          <img
            key={o.id}
            ref={(el) => {
              refs.current[k] = el
            }}
            src={o.src600}
            srcSet={`${o.src600} 600w, ${o.src} ${Math.max(o.w, o.h)}w`}
            sizes="(min-width: 1024px) 22vw, 70vw"
            alt=""
            width={o.w}
            height={o.h}
            loading={k === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            className={cn(st.objImg, 'absolute inset-0 h-full w-full object-contain')}
            style={{ opacity: k === i ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  )
}

export function ObjectChip({ className }: { className?: string }) {
  const i = useHeroObjectIndex()
  const o = HERO_OBJECTS[Math.min(i, HERO_OBJECTS.length - 1)]
  const n = HERO_OBJECTS.length
  return (
    <div data-showcase-chip className={cn('pointer-events-none flex justify-center', className)}>
      <Link
        href={o.href}
        data-cursor="SHOP"
        className="focus-ring group/chip pointer-events-auto flex min-h-12 max-w-full items-center gap-2.5 border-[3px] border-ink bg-paper px-3 py-1.5 text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-[translate,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-ink)]"
      >
        <span className="label hidden shrink-0 bg-volt px-1.5 py-0.5 text-[10px] text-ink min-[400px]:inline">{o.kind}</span>
        <span key={o.id} className="min-w-0 truncate font-display text-[18px] uppercase leading-none tracking-[0.02em] motion-safe:animate-[ted-fade-in_.25s_ease-out] sm:text-[20px]">
          {o.cta}
        </span>
        <span aria-hidden="true" className="shrink-0 font-mono text-[15px] transition-transform duration-200 group-hover/chip:translate-x-1">
          →
        </span>
        <span aria-hidden="true" className="hidden shrink-0 border-l-2 border-ink pl-2.5 font-mono text-[11px] font-bold tabular-nums sm:inline">
          {String(i + 1).padStart(2, '0')}/{String(n).padStart(2, '0')}
        </span>
      </Link>
    </div>
  )
}
