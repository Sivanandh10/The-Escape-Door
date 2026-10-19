'use client'
// ProductCard — catalogue panel card (owner: P1 shop).
// Light #29 tilt (fine pointer only, via F1 <Tilt>) + #28 inner zoom. 2+ images → <ImageCarousel variant="card">
// (plays while hovered on desktop, gentle auto-advance in view on touch); 1 image + back → #40 crossfade. Whole card is one link (stretched title link); wishlist + quick add sit above it.
// Quick add only for single-variant, size-less items; otherwise a "Choose size / options" link.
//
// PUBLIC PROPS (stable — imported by home sections):
//   product          Product (required)
//   priority?        boolean — preload the front image (first row / above the fold)
//   collectionName?  string  — display name of product.collection (default: title-cased slug)
//   index?           number  — position in a grid (used for a tiny alternating tilt of the price sticker)
//   tilt?            boolean — #29 pointer tilt (default true)
//   quickAdd?        boolean — show the quick add / choose-options row (default true)
//   headingLevel?    'h2' | 'h3' (default 'h3')
//   sizes?           next/image sizes (default grid sizes)
//   tone?            'paper' | 'ink' — info panel surface (default 'paper')
//   className?
import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, RotateCcw } from 'lucide-react'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/utils'
import { bundleRules } from '@/lib/data/rules'
import { Tilt } from '@/components/motion/Tilt'
import { PriceTag } from './PriceTag'
import { WishlistButton } from './WishlistButton'
import { AddToCartButton } from './AddToCartButton'
import { ImageCarousel } from './ImageCarousel'
import './shop.css'

export interface ProductCardProps {
  product: Product
  priority?: boolean
  collectionName?: string
  index?: number
  tilt?: boolean
  quickAdd?: boolean
  headingLevel?: 'h2' | 'h3'
  sizes?: string
  tone?: 'paper' | 'ink'
  className?: string
}

export const titleCase = (slug: string) =>
  slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')

/** "Cursed Static Oversized T-Shirt" − "Cursed Static" → "Oversized T-Shirt" */
export function productKind(p: Pick<Product, 'name' | 'designTitle'>): string {
  const rest = p.name.startsWith(p.designTitle) ? p.name.slice(p.designTitle.length).trim() : ''
  return rest || p.name
}

const STOCK: Partial<Record<Product['stock'], { text: string; cls: string }>> = {
  low: { text: 'Low stock', cls: 'bg-hype text-paper' },
  out: { text: 'Sold out', cls: 'bg-ink text-paper' },
  'made-to-order': { text: 'Made to order', cls: 'bg-paper text-ink' },
}

export function ProductCard({
  product: p,
  priority,
  collectionName,
  index = 0,
  tilt = true,
  quickAdd = true,
  headingLevel = 'h3',
  sizes = '(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw',
  tone = 'paper',
  className,
}: ProductCardProps) {
  const stage = useRef<HTMLDivElement>(null)
  const front = p.images.find((i) => i.side !== 'back') ?? p.images[0]
  const back = p.images.find((i) => i.side === 'back' && i !== front)
  // 2+ images → the carousel replaces the front→back crossfade (front first, then the rest in order).
  const multi = p.images.length > 1
  const slides = multi && front ? [front, ...p.images.filter((i) => i !== front)] : p.images
  const [slideSide, setSlideSide] = useState<string | undefined>(slides[0]?.side)
  const href = `/product/${p.slug}`
  const H = headingLevel
  const single = p.variants.length === 1 && !p.sizes?.length && !p.priceOnRequest
  const stock = STOCK[p.stock]
  const arc = collectionName ?? titleCase(p.collection)
  const deal = p.bundleRuleId ? bundleRules.find((r) => r.id === p.bundleRuleId)?.label : undefined

  const card = (
    <article
      data-has-back={back && !multi ? '' : undefined}
      data-product-card={p.slug}
      className={cn(
        'ted-card @container group relative flex h-full flex-col border-[3px] border-ink shadow-hard',
        tone === 'paper' ? 'bg-paper text-ink grain' : 'bg-ink text-paper border-paper shadow-hard-volt',
        className,
      )}
    >
      {/* stage */}
      <div
        ref={stage}
        className="relative aspect-[4/5] overflow-hidden border-b-[3px] border-ink"
        style={{ backgroundColor: p.colorBlock || 'var(--color-lav)' }}
        data-cursor="VIEW"
      >
        {multi ? (
          <ImageCarousel
            images={slides}
            variant="card"
            aspect="4/5"
            sizes={sizes}
            priority={priority}
            href={href}
            label={`${p.name} images`}
            className="absolute inset-0"
            onIndexChange={(_, img) => setSlideSide(img.side)}
          />
        ) : front ? (
          <Image
            src={front.src}
            alt={front.alt}
            fill
            sizes={sizes}
            preload={priority}
            quality={75}
            className="ted-card-img ted-card-front object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center screentone-mid" aria-hidden="true">
            <span className="h-display text-5xl text-ink/70">{p.designTitle}</span>
          </div>
        )}
        {back && !multi && (
          <Image
            src={back.src}
            alt=""
            aria-hidden="true"
            fill
            sizes={sizes}
            quality={75}
            className="ted-card-img ted-card-back object-cover"
          />
        )}

        <span className={cn('label pointer-events-none absolute left-2 z-[2] max-w-[calc(100%-4.5rem)] truncate border-2 border-ink bg-ink px-2 py-1 text-[0.625rem] text-paper', multi ? 'top-4' : 'top-2')}>
          {arc}
        </span>
        <WishlistButton
          productId={p.id}
          name={p.name}
          slug={p.slug}
          size="sm"
          className={cn('!absolute right-2 z-[2]', multi ? 'top-4' : 'top-2')}
        />
        {stock && (
          <span className={cn('label pointer-events-none absolute left-2 z-[2] border-2', multi ? 'top-12' : 'top-10', ' border-ink px-2 py-1 text-[0.625rem]', stock.cls)}>
            {stock.text}
          </span>
        )}
        {back && (
          <span
            data-on={multi && slideSide === 'back' ? '' : undefined}
            className={cn(
              'label pointer-events-none absolute bottom-2 left-2 z-[2] inline-flex items-center gap-1 border-2 border-ink bg-volt px-2 py-1 text-[0.625rem] text-ink',
              multi ? 'ted-card-flip-car' : 'ted-card-flip',
            )}
          >
            <RotateCcw aria-hidden="true" className="h-3 w-3" strokeWidth={3} /> Back print
          </span>
        )}
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-[2] origin-bottom-right @max-3xs:bottom-1.5 @max-3xs:right-1.5 @max-3xs:scale-[0.82]">
          <PriceTag product={p} size="md" rotate={index % 2 ? 3 : -3} />
        </span>
      </div>

      {/* info */}
      <div className="relative flex flex-1 flex-col gap-1.5 p-2.5 @3xs:p-3 @xs:p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label truncate text-[0.6875rem] opacity-70">{productKind(p)}</p>
          {p.jpTitle && (
            <p lang="ja" className="jp-sub shrink-0 !text-[0.6875rem] !tracking-[0.2em] @max-3xs:hidden">
              {p.jpTitle}
            </p>
          )}
        </div>
        <H className="h-display text-[1.35rem] leading-[0.92] @3xs:text-[1.7rem] @xs:text-[2rem]">
          <Link href={href} className="ted-card-link focus-ring outline-offset-4" data-cursor="VIEW">
            {p.designTitle}
          </Link>
        </H>
        {quickAdd && (
          <div className="relative z-[2] mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2">
            {single ? (
              <AddToCartButton product={p} scale="sm" label="Add" flyFrom={stage} />
            ) : (
              <Link
                href={href}
                data-cursor="VIEW"
                className={cn(
                  'press label inline-flex min-h-11 items-center gap-1.5 border-[3px] px-3 font-bold focus-ring',
                  tone === 'paper' ? 'border-ink bg-paper text-ink shadow-hard-sm hover:bg-lav' : 'border-paper bg-ink text-paper hover:bg-tone-2',
                )}
                aria-label={`${p.sizes?.length ? 'Choose size' : 'Choose options'} for ${p.name}`}
              >
                {p.priceOnRequest ? 'Ask price' : p.sizes?.length ? 'Choose size' : 'Options'}
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
              </Link>
            )}
            {deal && <span className="label max-w-[9rem] text-right text-[0.625rem] leading-tight opacity-75 @max-3xs:hidden">{deal}</span>}
          </div>
        )}
      </div>
    </article>
  )

  return tilt ? (
    <Tilt max={5} className="h-full">
      {card}
    </Tilt>
  ) : (
    card
  )
}

export default ProductCard
