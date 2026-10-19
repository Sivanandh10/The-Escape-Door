'use client'
// ProductGrid — responsive grid of ProductCards with #08 staggered reveal (owner: P1 shop).
// - First paint: everything visible (SSR/SEO); cards below the fold slam in on scroll (ScrollTrigger.batch).
// - Filter change: GSAP Flip — survivors glide to their new slots, newcomers stagger in.
// - "Load more" pages client-side (no server pagination, CONTRACTS §10.1).
//
// PROPS: products, collectionNames?: Record<slug,name>, pageSize? (default 24, 0 = all),
//        priorityCount? (default 4), flipKey? (string that changes when the filter changes),
//        empty?: ReactNode, headingLevel?, className?
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
}: ProductGridProps) {
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

  // capture positions *before* React commits the new filter result
  if (prevKey.current !== flipKey && list.current && !flipState.current && typeof window !== 'undefined') {
    registerGsap()
    flipState.current = Flip.getState(list.current.querySelectorAll('[data-flip-id]'))
  }

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
  const visible = pageSize ? products.slice(0, shown) : products

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
      {pageSize > 0 && shown < products.length && (
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

export default ProductGrid
