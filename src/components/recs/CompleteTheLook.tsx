'use client'
// "Complete the look" — cart-drawer recommendations (owner: RECS). Complementary types for what's in the cart
// (tee → hoodie / polaroids / sticker …, same arc first), via GET /api/recs?context=cart. Light (paper) surface.
// Renders nothing for an empty cart or when nothing fits; a skeleton while loading; quietly hides on error
// (it's an extra — the cart itself must never be blocked by it).
// Each card: the whole card opens the product; "+ Add" adds it in place (AddToCartButton → login gate + flight);
// pieces that need a size / option choice get "Choose" instead, which opens the product page.
import Image from 'next/image'
import Link from 'next/link'
import { productPriceLabel } from '@/lib/pricing'
import { useCart } from '@/lib/cart'
import type { Product } from '@/lib/types'
import { AddToCartButton } from '@/components/shop/AddToCartButton'
import { cn } from '@/lib/utils'
import { ReasonChip } from './RecsRow'
import { useRecs } from './useRecs'

/** One tap is enough only for single-variant, size-less, priced items (same rule as ProductCard's quick add). */
function quickAddable(p: Product): boolean {
  return p.variants.length === 1 && !p.sizes?.length && !p.priceOnRequest
}

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
            <div key={i} className="skeleton-tone h-[136px] border-[3px] border-ink" />
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
              <div className="group relative flex h-full flex-col gap-2 border-[3px] border-ink bg-paper p-2 text-ink shadow-hard-sm transition-colors duration-150 can-hover:hover:bg-lav has-[[data-ctl-link]:focus-visible]:outline has-[[data-ctl-link]:focus-visible]:outline-[3px] has-[[data-ctl-link]:focus-visible]:outline-offset-2 has-[[data-ctl-link]:focus-visible]:outline-door">
                <span className="flex min-h-[76px] items-stretch gap-2.5">
                  <span className="relative block w-[60px] shrink-0 overflow-hidden border-2 border-ink" style={{ backgroundColor: p.colorBlock }}>
                    {img && <Image src={img.src} alt="" fill sizes="60px" quality={60} className="object-cover transition-transform duration-300 can-hover:group-hover:scale-110" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-between gap-1">
                    <ReasonChip reason={it.reason} tone="ink" delay={i * 0.05} className="self-start text-[0.5625rem]" />
                    {/* the whole card is this link (stretched); the quick add sits above it */}
                    <Link
                      href={`/product/${p.slug}`}
                      onClick={onNavigate}
                      data-cursor="VIEW"
                      data-ctl-link=""
                      className="line-clamp-2 text-[13.5px] font-bold leading-tight outline-none after:absolute after:inset-0 after:z-[1] after:content-['']"
                    >
                      {p.name}
                    </Link>
                  </span>
                </span>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <span className="font-mono text-[12px] font-bold">{productPriceLabel(p)}</span>
                  <span className="relative z-[2] ml-auto inline-flex whitespace-nowrap">
                    {quickAddable(p) ? (
                      <AddToCartButton product={p} scale="sm" label="Add" tone="volt" />
                    ) : (
                      <Link
                        href={`/product/${p.slug}`}
                        onClick={onNavigate}
                        data-cursor="VIEW"
                        aria-label={`Choose ${p.sizes?.length ? 'a size' : 'options'} for ${p.name}`}
                        className="press label inline-flex min-h-11 items-center border-[3px] border-ink bg-paper px-3.5 text-[0.75rem] font-bold text-ink shadow-hard-sm focus-ring can-hover:hover:bg-volt"
                      >
                        {p.priceOnRequest ? 'Ask price' : 'Choose'}
                      </Link>
                    )}
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default CompleteTheLook
