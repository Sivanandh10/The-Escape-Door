'use client'
// /wishlist — saved pieces as pinned polaroid-ish cards with "Move to cart" (inline fit/size
// picker when needed) and remove with undo. Owner: P2.
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, HeartOff, ShoppingBag, X } from 'lucide-react'
import { toast } from 'sonner'
import { Mascot } from '@/components/brand/Mascot'
import { useCart, useHydrated, useWishlist, type AddInput } from '@/lib/cart'
import { useRequireLogin } from '@/lib/auth/customer'
import { track } from '@/lib/analytics'
import { formatINR, variantPriceLabel } from '@/lib/pricing'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Product, Variant } from '@/lib/types'
import { Thumb } from './cart/bits'

export type WishProduct = Pick<
  Product,
  'id' | 'slug' | 'name' | 'type' | 'collection' | 'variants' | 'sizes' | 'priceOnRequest' | 'stock' | 'jpTitle'
> & { image: string; alt: string; priceLabel: string; collectionName: string }

export function WishlistView({ products }: { products: WishProduct[] }) {
  const hydrated = useHydrated()
  const ids = useWishlist((s) => s.ids)
  const saved = useMemo(() => {
    const by = new Map<string, WishProduct>()
    products.forEach((p) => {
      by.set(p.id, p)
      by.set(p.slug, p)
    })
    const seen = new Set<string>()
    return ids
      .map((id) => by.get(id))
      .filter((p): p is WishProduct => !!p && !seen.has(p.id) && !!seen.add(p.id))
      .reverse() // newest first
  }, [ids, products])

  if (!hydrated) {
    return (
      <ul aria-busy="true" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="skeleton-tone aspect-[4/6] border-[3px] border-tone-2" />
        ))}
      </ul>
    )
  }

  if (!saved.length) {
    return (
      <div className="panel-paper mx-auto flex max-w-xl flex-col items-center px-5 py-10 text-center shadow-hard-volt">
        <Mascot mood="peek" size={150} animate title="" />
        <h2 className="mt-4 font-display text-[40px] uppercase leading-[0.9]">
          No doors <em className="accent">saved</em> yet
        </h2>
        <p lang="ja" className="jp-sub mt-2 text-[12px]">ほしい物リストは空っぽ</p>
        <p className="mt-3 max-w-[34ch] text-[15px] text-tone-2">Tap the heart on any piece and it waits here until you&rsquo;re ready.</p>
        <Link href="/shop" data-cursor="OPEN" className="press mt-6 inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-5 font-mono text-[13px] font-bold uppercase tracking-[0.14em] shadow-hard">
          Browse the shop <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <>
      <p className="label mb-4 text-[11px] text-tone-4" aria-live="polite">
        {saved.length} saved {saved.length === 1 ? 'piece' : 'pieces'}
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {saved.map((p, i) => (
            <WishCard key={p.id} product={p} index={i} />
          ))}
        </AnimatePresence>
      </ul>
    </>
  )
}

const TILT = [-1.6, 1.2, -0.8, 1.8, -1.2, 0.9]

function WishCard({ product: p, index }: { product: WishProduct; index: number }) {
  const add = useCart((s) => s.add)
  const requireLogin = useRequireLogin() // adding to the cart needs login, same as every other add path
  const setOpen = useCart((s) => s.setOpen)
  const toggle = useWishlist((s) => s.toggle)
  const reduced = useReducedMotion()
  const priced = p.variants.filter((v) => v.price != null || v.attrs?.range)
  const needsPick = p.variants.length > 1 || !!p.sizes?.length
  const [picking, setPicking] = useState(false)
  const [variantId, setVariantId] = useState(p.variants[0]?.id ?? '')
  const [size, setSize] = useState<string | undefined>(undefined)
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0]
  const savedId = useWishlist((s) => (s.ids.includes(p.id) ? p.id : p.slug))

  const unsave = (msg: string, undo = true) => {
    toggle(savedId)
    if (undo) toast(msg, { description: p.name, duration: 5000, action: { label: 'Undo', onClick: () => toggle(savedId) } })
  }

  const moveToCart = () => {
    if (!variant) return
    if (needsPick && !picking) return setPicking(true)
    if (p.sizes?.length && !size) return
    const item: AddInput = {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      type: p.type,
      collection: p.collection,
      variantId: variant.id,
      variantLabel: variant.label,
      ...(size ? { size } : {}),
      unitPrice: variant.price,
      image: p.image,
      ...(variant.attrs ? { variantAttrs: variant.attrs } : {}),
    }
    requireLogin(
      'Log in to add to your cart',
      () => {
        add(item)
        track('add_to_cart', { slug: p.slug, variant: variant.id, from: 'wishlist' })
        unsave('Moved to your cart', false)
        toast.success('Moved to your cart', { description: p.name, action: { label: 'Open cart', onClick: () => setOpen(true) } })
      },
      { type: 'cart-add', item },
    )
  }

  return (
    <motion.li
      layout={reduced ? false : 'position'}
      initial={{ opacity: 0, y: 24, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: TILT[index % TILT.length] }}
      exit={{ opacity: 0, y: 40, rotate: TILT[index % TILT.length] * 4, transition: { duration: 0.25, ease: [0.7, 0, 0.84, 0] } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="relative"
    >
      <article className="relative flex h-full flex-col border-[3px] border-ink bg-paper p-2 text-ink shadow-hard-paper">
        {/* tape */}
        <span aria-hidden="true" className="absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-4deg] border-2 border-ink/20 bg-volt/80" />
        <Link href={`/product/${p.slug}`} className="group relative block" data-cursor="VIEW">
          <Thumb src={p.image} alt={p.alt} className="w-full border-ink" sizes="(min-width:1280px) 320px, (min-width:768px) 30vw, 46vw" />
          {p.stock === 'out' && (
            <span className="absolute left-2 top-2 border-2 border-ink bg-paper px-1.5 font-mono text-[10px] font-bold uppercase">Sold out</span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => unsave('Removed from your wishlist')}
          aria-label={`Remove ${p.name} from wishlist`}
          className="press absolute right-0 top-0 grid size-11 place-items-center border-b-[3px] border-l-[3px] border-ink bg-paper can-hover:hover:bg-pink"
        >
          <HeartOff aria-hidden="true" className="size-[18px]" />
        </button>
        <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
          <p className="label text-[10px] text-tone-3">{p.collectionName}</p>
          <h2 className="mt-1 line-clamp-2 text-[15px] font-bold leading-snug">
            <Link href={`/product/${p.slug}`} className="focus-ring can-hover:hover:underline">
              {p.name}
            </Link>
          </h2>
          <p className="mt-1 font-mono text-[13px] font-bold">{p.priceLabel}</p>

          <AnimatePresence initial={false}>
            {picking && (
              <motion.fieldset
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <legend className="sr-only">Choose options for {p.name}</legend>
                {p.variants.length > 1 && (
                  <Chips
                    label="Option"
                    options={(priced.length ? priced : p.variants).map((v: Variant) => ({ value: v.id, label: v.label.split(' · ')[0], hint: variantPriceLabel(v) }))}
                    value={variantId}
                    onChange={setVariantId}
                  />
                )}
                {!!p.sizes?.length && (
                  <Chips label="Size" options={p.sizes.map((s) => ({ value: s, label: s }))} value={size} onChange={setSize} />
                )}
              </motion.fieldset>
            )}
          </AnimatePresence>

          <div className="mt-auto flex gap-2 pt-3">
            <button
              type="button"
              onClick={moveToCart}
              disabled={picking && !!p.sizes?.length && !size}
              className={cn(
                'press flex min-h-11 flex-1 items-center justify-center gap-1.5 border-[3px] border-ink px-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] disabled:opacity-50',
                picking ? 'bg-ink text-paper' : 'bg-volt',
              )}
            >
              {picking ? <Check aria-hidden="true" className="size-4" /> : <ShoppingBag aria-hidden="true" className="size-4" />}
              {picking
                ? p.sizes?.length && !size
                  ? 'Pick a size'
                  : `Add${variant?.price != null ? ` · ${formatINR(variant.price)}` : ''}`
                : 'Move to cart'}
            </button>
            {picking && (
              <button type="button" onClick={() => setPicking(false)} aria-label="Cancel" className="press grid size-11 place-items-center border-[3px] border-ink">
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </div>
      </article>
    </motion.li>
  )
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string; hint?: string }[]
  value?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-3">
      <p className="label text-[10px] text-tone-3">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            title={o.hint}
            className={cn(
              'min-h-11 min-w-11 border-2 border-ink px-2 font-mono text-[11px] font-bold transition-colors duration-150',
              value === o.value ? 'bg-ink text-paper' : 'bg-paper can-hover:hover:bg-lav',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
