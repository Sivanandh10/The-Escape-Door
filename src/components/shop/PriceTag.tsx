// PriceTag — mono price sticker (owner: P1 shop). Server-safe (no hooks).
//
// PUBLIC PROPS (stable):
//   product?   Product-like { variants, priceFrom, priceOnRequest } → productPriceLabel()
//   variant?   Variant | null → variantPriceLabel() (wins over product)
//   qty?       number (default 1) — when > 1 and the variant has a fixed price, shows the line total + "× qty"
//   label?     string — explicit text (wins over everything)
//   size?      'sm' | 'md' | 'lg'   (default 'md')
//   tone?      'volt' | 'paper' | 'ink' | 'lav'  (default 'volt')
//   sticker?   boolean (default true) — hard shadow + slight tilt; false = flat inline text
//   rotate?    number degrees (default -3, only when sticker)
//   className?
//
// Prices always come from data (never hardcoded). "From"/"Price on request" are rendered as small
// prefixes so the number stays the hero.
import type { CSSProperties } from 'react'
import type { Product, Variant } from '@/lib/types'
import { formatINR, productPriceLabel, variantPriceLabel } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export interface PriceTagProps {
  product?: Pick<Product, 'variants' | 'priceFrom' | 'priceOnRequest'> | null
  variant?: Variant | null
  qty?: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'volt' | 'paper' | 'ink' | 'lav'
  sticker?: boolean
  rotate?: number
  className?: string
}

const TONE: Record<NonNullable<PriceTagProps['tone']>, string> = {
  volt: 'bg-volt text-ink border-ink',
  paper: 'bg-paper text-ink border-ink',
  lav: 'bg-lav text-ink border-ink',
  ink: 'bg-ink text-volt border-paper',
}
const SIZE: Record<NonNullable<PriceTagProps['size']>, { box: string; num: string; pre: string }> = {
  sm: { box: 'px-2 py-1 border-2 gap-1', num: 'text-[0.9375rem]', pre: 'text-[0.625rem]' },
  md: { box: 'px-2.5 py-1.5 border-[3px] gap-1.5', num: 'text-lg', pre: 'text-[0.6875rem]' },
  lg: { box: 'px-4 py-2 border-[3px] gap-2', num: 'text-[clamp(1.75rem,3.2vw,2.5rem)]', pre: 'text-xs' },
}

/** Split "From ₹400" → ["From", "₹400"]; "Price on request" → ["", "Price on request"]. */
function split(text: string): [string, string] {
  const m = /^(From)\s+(.+)$/.exec(text)
  return m ? [m[1], m[2]] : ['', text]
}

export function priceText({ product, variant, qty = 1, label }: Pick<PriceTagProps, 'product' | 'variant' | 'qty' | 'label'>): {
  pre: string
  main: string
  post: string
  onRequest: boolean
} {
  if (label) {
    const [pre, main] = split(label)
    return { pre, main, post: '', onRequest: /request/i.test(label) }
  }
  if (variant) {
    if (typeof variant.price === 'number' && qty > 1) {
      return { pre: '', main: formatINR(variant.price * qty), post: `${qty} × ${formatINR(variant.price)}`, onRequest: false }
    }
    const t = variantPriceLabel(variant)
    return { pre: '', main: t, post: '', onRequest: /request/i.test(t) }
  }
  if (product) {
    const [pre, main] = split(productPriceLabel(product))
    return { pre, main, post: '', onRequest: /request/i.test(main) }
  }
  return { pre: '', main: 'Price on request', post: '', onRequest: true }
}

export function PriceTag({
  product,
  variant,
  qty = 1,
  label,
  size = 'md',
  tone = 'volt',
  sticker = true,
  rotate = -3,
  className,
}: PriceTagProps) {
  const { pre, main, post, onRequest } = priceText({ product, variant, qty, label })
  const s = SIZE[size]
  const style = sticker ? ({ transform: `rotate(${rotate}deg)` } as CSSProperties) : undefined
  return (
    <span
      data-price-tag=""
      className={cn(
        'inline-flex items-baseline whitespace-nowrap font-mono font-bold leading-none tabular-nums',
        sticker ? cn(s.box, TONE[tone], tone === 'ink' ? 'shadow-[3px_3px_0_0_var(--color-volt)]' : 'shadow-hard-sm') : 'gap-1.5',
        className,
      )}
      style={style}
    >
      {pre && <span className={cn('uppercase tracking-[0.14em] font-medium opacity-75', s.pre)}>{pre}</span>}
      <span className={cn(onRequest ? cn(s.pre, 'uppercase tracking-[0.12em]') : s.num)}>{main}</span>
      {post && <span className={cn('font-medium opacity-70', s.pre)}>{post}</span>}
    </span>
  )
}

export default PriceTag
