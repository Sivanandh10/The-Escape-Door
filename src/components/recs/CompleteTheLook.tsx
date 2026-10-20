'use client'
// "Complete the look" — cart-drawer recommendations (owner: RECS). Complementary types for what's in the cart
// (tee → hoodie / polaroids / sticker …, same arc first), via GET /api/recs?context=cart. Light (paper) surface.
// Renders nothing for an empty cart or when nothing fits; a skeleton while loading; quietly hides on error
// (it's an extra — the cart itself must never be blocked by it).
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { productPriceLabel } from '@/lib/pricing'
import { useCart } from '@/lib/cart'
import { cn } from '@/lib/utils'
import { ReasonChip } from './RecsRow'
import { useRecs } from './useRecs'

export function CompleteTheLook({ onNavigate, className, limit = 4 }: { onNavigate?: () => void; className?: string; limit?: number }) {
  const hasItems = useCart((s) => s.items.length > 0)
  const r = useRecs('cart', { limit, enabled: hasItems })
  if (!hasItems || r.status === 'error' || r.status === 'idle') return null
  if (r.status === 'loading' && !r.items.length) {
    return (
      <div aria-hidden="true" className={cn('mt-6', className)}>
        <div className="skeleton-tone mb-3 h-7 w-44" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="skeleton-tone h-[92px] border-[3px] border-ink" />
          ))}
        </div>
      </div>
    )
  }
  if (!r.items.length) return null
  return (
    <section aria-labelledby="ctl-h" className={cn('mt-6 border-t-[3px] border-dashed border-ink/40 pt-5', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 id="ctl-h" className="font-display text-[26px] uppercase leading-none text-ink">
          Complete the <span className="bg-volt px-1">look</span>
        </h3>
        <span lang="ja" className="jp-sub text-[11px] text-ink">コーデ</span>
      </div>
      <ul role="list" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {r.items.map((it, i) => {
          const p = it.product
          const img = p.images.find((x) => x.side !== 'back') ?? p.images[0]
          return (
            <li key={p.id} className="min-w-0">
              <Link
                href={`/product/${p.slug}`}
                onClick={onNavigate}
                data-cursor="VIEW"
                className="press group flex h-full min-h-[92px] items-stretch gap-2.5 border-[3px] border-ink bg-paper p-2 text-ink shadow-hard-sm focus-ring can-hover:hover:bg-lav"
              >
                <span className="relative block w-[64px] shrink-0 overflow-hidden border-2 border-ink" style={{ backgroundColor: p.colorBlock }}>
                  {img && <Image src={img.src} alt="" fill sizes="64px" quality={60} className="object-cover transition-transform duration-300 can-hover:group-hover:scale-110" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-between gap-1">
                  <ReasonChip reason={it.reason} tone="ink" delay={i * 0.05} className="self-start text-[0.5625rem]" />
                  <span className="line-clamp-2 text-[13.5px] font-bold leading-tight">{p.name}</span>
                  <span className="flex items-center justify-between gap-2 font-mono text-[12px] font-bold">
                    {productPriceLabel(p)}
                    <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-200 can-hover:group-hover:-translate-y-0.5 can-hover:group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default CompleteTheLook
