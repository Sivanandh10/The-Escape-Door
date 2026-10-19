'use client'
// ProductView — PDP interactive column + gallery (owner: P1 shop).
// Gallery: <ImageCarousel variant="gallery"> — swipe/arrows/pips/thumbs (Front/Back/Detail), ←/→, zoom.
// Buy box: variant chips, size chips (+ "ask on WhatsApp" size chart), qty stepper, BundleHint,
// #66 AddToCartButton, "Buy now on WhatsApp" (adds + opens drawer checkout), wishlist, custom card.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, Ruler, Wand2, ArrowRight } from 'lucide-react'
import type { Product } from '@/lib/types'
import { track } from '@/lib/analytics'
import { waLink } from '@/lib/whatsapp'
import { useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { cn } from '@/lib/utils'
import { AddToCartButton } from './AddToCartButton'
import { PriceTag } from './PriceTag'
import { WishlistButton } from './WishlistButton'
import { BundleHint } from './BundleHint'
import { ImageCarousel } from './ImageCarousel'
import './shop.css'

export interface ProductViewProps {
  product: Product
  collectionName: string
  collectionJp?: string
  accent?: string
}

export function ProductView({ product: p, collectionName, collectionJp, accent = '#C9B8FF' }: ProductViewProps) {
  const waNumber = useWhatsappNumber()
  const [variantId, setVariantId] = useState(p.variants[0]?.id ?? '')
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [needSize, setNeedSize] = useState(false)
  const sizeGroup = useRef<HTMLDivElement>(null)
  const gallery = useRef<HTMLDivElement>(null)
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0] ?? null

  useEffect(() => {
    track('product_view', { product: p.slug, type: p.type, collection: p.collection })
  }, [p.slug, p.type, p.collection])

  const variantName = p.type === 'hoodie' ? 'GSM tier' : p.variants.some((v) => v.attrs?.fit) ? 'Fit' : 'Style'
  const askSize = waLink(`Hi! Could you share the size chart for “${p.name}” (${variant?.label ?? ''})?`, waNumber)

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
      <Gallery product={p} ref={gallery} accent={accent} />

      <div className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:self-start">
        <div className="flex flex-col gap-2">
          <Link href={`/arc/${p.collection}`} className="label inline-flex w-fit items-center gap-2 border-2 border-paper px-2 py-1 text-[0.6875rem] text-paper hover:bg-paper hover:text-ink focus-ring" data-cursor="OPEN">
            <span aria-hidden="true" className="h-3 w-3 border-2 border-current" style={{ background: accent }} />
            {collectionName}{collectionJp ? <span lang="ja" className="opacity-70"> · {collectionJp}</span> : null}
          </Link>
          <h1 className="h-display text-[clamp(2.8rem,6.4vw,5.6rem)] text-paper">
            {p.designTitle} <em>{p.name.slice(p.designTitle.length).trim() || p.type}</em>
          </h1>
          {p.jpTitle && <p lang="ja" className="jp-sub text-paper">{p.jpTitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <PriceTag variant={p.priceOnRequest ? null : variant} product={p} qty={qty} size="lg" />
          {p.stock === 'made-to-order' && <span className="label border-2 border-paper/60 px-2 py-1 text-[0.625rem] text-paper/80">Made to order</span>}
          {p.stock === 'low' && <span className="label bg-hype px-2 py-1 text-[0.625rem] text-paper">Low stock</span>}
          {p.stock === 'out' && <span className="label bg-paper px-2 py-1 text-[0.625rem] text-ink">Sold out</span>}
        </div>

        <p className="max-w-prose text-paper/85">{p.description}</p>

        {p.variants.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-2 text-[0.6875rem] text-paper/70">{variantName}</legend>
            <div className="flex flex-wrap gap-2">
              {p.variants.map((v) => {
                const on = v.id === variant?.id
                const price = typeof v.price === 'number' ? `₹${v.price.toLocaleString('en-IN')}` : v.attrs?.range ? `₹${v.attrs.range}` : 'on request'
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      'press flex min-h-12 flex-col items-start justify-center border-[3px] px-3 py-1.5 text-left focus-ring',
                      on ? 'border-ink bg-volt text-ink shadow-[3px_3px_0_0_var(--color-paper)]' : 'border-paper bg-ink text-paper hover:bg-tone-2',
                    )}
                  >
                    <span className="font-body text-sm font-bold leading-tight">{v.label}</span>
                    <span className="font-mono text-xs opacity-80">{price}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {!!p.sizes?.length && (
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-2 flex w-full items-center justify-between gap-3 text-[0.6875rem] text-paper/70">
              <span>Size{needSize && !size ? <span className="ml-2 text-pink">— pick one first</span> : null}</span>
            </legend>
            <div ref={sizeGroup} className={cn('flex flex-wrap gap-2', needSize && !size && 'ted-need')}>
              {p.sizes.map((s) => {
                const on = s === size
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setSize(s); setNeedSize(false) }}
                    className={cn(
                      'press grid h-12 min-w-12 place-items-center border-[3px] px-3 font-mono text-sm font-bold focus-ring',
                      on ? 'border-ink bg-volt text-ink shadow-[3px_3px_0_0_var(--color-paper)]' : needSize ? 'border-pink bg-ink text-paper' : 'border-paper bg-ink text-paper hover:bg-tone-2',
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <a href={askSize} target="_blank" rel="noopener noreferrer" className="label inline-flex w-fit items-center gap-2 text-[0.6875rem] text-paper/80 underline decoration-2 underline-offset-4 hover:text-volt focus-ring">
              <Ruler aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} /> Size chart: coming soon — ask on WhatsApp
            </a>
          </fieldset>
        )}

        {!p.priceOnRequest && (
          <div className="flex items-center gap-4">
            <span className="label text-[0.6875rem] text-paper/70" id="qty-label">Qty</span>
            <div role="group" aria-labelledby="qty-label" className="flex items-stretch border-[3px] border-paper">
              <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center text-paper hover:bg-tone-2 disabled:opacity-30 focus-ring">
                <Minus aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
              </button>
              <output aria-live="polite" className="grid w-12 place-items-center border-x-[3px] border-paper font-mono text-lg font-bold text-paper tabular-nums">{qty}</output>
              <button type="button" aria-label="Increase quantity" disabled={qty >= 99} onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-11 w-11 place-items-center text-paper hover:bg-tone-2 disabled:opacity-30 focus-ring">
                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        <BundleHint product={p} variant={variant} qty={qty} />

        <div className="flex flex-col gap-3">
          <div className="flex items-stretch gap-3">
            <AddToCartButton
              product={p}
              variant={variant}
              size={size}
              qty={qty}
              scale="lg"
              block
              flyFrom={gallery}
              onNeedSize={() => { setNeedSize(true); sizeGroup.current?.querySelector('button')?.focus() }}
              label={p.priceOnRequest ? 'Add — price on request' : undefined}
              className="flex-1"
            />
            <WishlistButton productId={p.id} name={p.name} slug={p.slug} className="!h-14 !w-14" />
          </div>
          <AddToCartButton
            product={p}
            variant={variant}
            size={size}
            qty={qty}
            mode="buy"
            block
            onNeedSize={() => { setNeedSize(true); sizeGroup.current?.querySelector('button')?.focus() }}
          />
          <p className="label text-[0.625rem] text-paper/60">Checkout happens on WhatsApp — we confirm price, size and delivery with you there.</p>
        </div>

        {p.customizable && (
          <Link
            href={`/custom?product=${p.type}`}
            data-cursor="OPEN"
            className="press group flex items-center gap-4 border-[3px] border-paper bg-door p-4 text-paper shadow-hard-volt focus-ring"
          >
            <Wand2 aria-hidden="true" className="h-8 w-8 shrink-0" strokeWidth={2.2} />
            <span className="flex-1">
              <span className="h-display block text-2xl leading-none">Make it custom</span>
              <span className="mt-1 block text-sm text-paper/85">Your art or ours on this {p.type === 'tshirt' ? 'tee' : p.type} — open the Custom Forge.</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-6 w-6 transition-transform group-hover:translate-x-1" strokeWidth={2.6} />
          </Link>
        )}
      </div>
    </div>
  )
}

function Gallery({ product: p, ref, accent }: { product: Product; ref: React.Ref<HTMLDivElement>; accent: string }) {
  // Every image in order, front first. Front / Back print / Detail thumbs are jump-to-slide shortcuts.
  const front = p.images.find((i) => i.side !== 'back') ?? p.images[0]
  const imgs = front ? [front, ...p.images.filter((i) => i !== front)] : []
  const sample = imgs.some((i) => i.sample)
  const badge = sample ? (
    <span className="label pointer-events-none absolute bottom-3 left-3 z-[2] border-2 border-ink bg-paper px-2 py-1 text-[0.625rem] text-ink">
      SAMPLE — replace with real photo
    </span>
  ) : null

  if (imgs.length < 2) {
    return (
      <div ref={ref} className="relative aspect-[4/5] overflow-hidden border-4 border-paper shadow-hard-volt" style={{ backgroundColor: p.colorBlock || accent }}>
        {imgs[0] && <Image src={imgs[0].src} alt={imgs[0].alt} fill preload quality={85} sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />}
        {badge}
      </div>
    )
  }
  return (
    <ImageCarousel
      images={imgs}
      variant="gallery"
      aspect="4/5"
      sizes="(min-width: 1024px) 55vw, 100vw"
      priority
      label={`${p.name} images`}
      background={p.colorBlock || accent}
      stageRef={ref}
      stageClassName="border-4 border-paper shadow-hard-volt"
      overlay={badge}
    />
  )
}

export default ProductView
