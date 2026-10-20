'use client'
// Recommendation row + explainable reason chips (owner: RECS). Dark surface (paper text), ProductCard grid.
//   <RecsRow id kicker before accent jp items action? cols? />
//   <ReasonChip reason />   — "Because you viewed Cursed Static", "Bought together", "Popular in Jujutsu Kaisen" …
// Chips pop in with a spring (once, in view); reduced motion → static.
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Eye, Flame, Heart, Layers, Search, ShoppingBag, Sparkles, Tv, Users } from 'lucide-react'
import { ProductCard } from '@/components/shop/ProductCard'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { RecItem } from './useRecs'

const ICON: Record<string, typeof Eye> = {
  viewed: Eye,
  'bought-together': ShoppingBag,
  'viewed-together': Users,
  similar: Sparkles,
  watched: Tv,
  complete: Layers,
  popular: Flame,
  new: Sparkles,
  search: Search,
  cart: ShoppingBag,
  wishlist: Heart,
}

export function ReasonChip({ reason, tone = 'volt', className, delay = 0 }: { reason: { kind: string; label: string }; tone?: 'volt' | 'paper' | 'ink'; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  const Icon = ICON[reason.kind] ?? Sparkles
  return (
    <motion.span
      initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: -4 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ type: 'spring', stiffness: 520, damping: 24, delay }}
      title={reason.label}
      className={cn(
        'label inline-flex max-w-full items-start gap-1.5 border-2 border-ink px-2 py-1 text-[0.625rem] leading-[1.25] tracking-[0.04em]',
        tone === 'volt' && 'bg-volt text-ink shadow-[2px_2px_0_0_var(--color-ink)]',
        tone === 'paper' && 'bg-paper text-ink',
        tone === 'ink' && 'bg-ink text-volt',
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-3 shrink-0" strokeWidth={2.8} />
      <span className="line-clamp-2 break-words">{reason.label}</span>
    </motion.span>
  )
}

export function RecsHead({ id, kicker, before, accent, jp }: { id?: string; kicker?: string; before: string; accent: string; jp?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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

export function RecsRow({
  id, kicker, before, accent, jp, items, action, cols = 4, className,
}: {
  id?: string
  kicker?: string
  before: string
  accent: string
  jp?: string
  items: RecItem[]
  action?: ReactNode
  cols?: 4 | 6
  className?: string
}) {
  if (!items.length) return null
  return (
    <div className={cn('mt-12 first:mt-0', className)}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <RecsHead id={id} kicker={kicker} before={before} accent={accent} jp={jp} />
        {action}
      </div>
      <ul role="list" className={cn('grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5', cols === 6 ? 'md:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4')}>
        {items.map((r, i) => (
          <li key={r.product.id} className="flex min-w-0 flex-col gap-2" data-rec-reason={r.reason.kind}>
            {/* fixed 2-line slot so cards stay aligned whatever the reason length */}
            <div className="flex min-h-[2.4rem] items-end">
              <ReasonChip reason={r.reason} delay={i * 0.04} />
            </div>
            <ProductCard product={r.product} index={i} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RecsSkeleton({ count = 4, className, light }: { count?: number; className?: string; light?: boolean }) {
  return (
    <div aria-hidden="true" className={className}>
      <div className={cn('skeleton-tone mb-6 h-12 w-64 max-w-full', light && 'opacity-60')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="skeleton-tone h-6 w-32 max-w-full" />
            <div className="skeleton-tone aspect-[4/5] border-[3px] border-ink" />
          </div>
        ))}
      </div>
    </div>
  )
}
