'use client'
// WishlistButton — heart toggle with an ink-pop (owner: P1 shop).
//
// PUBLIC PROPS (stable):
//   productId  string (required)
//   name?      string — used in the accessible label ("Save Cursed Static to wishlist")
//   slug?      string — analytics only
//   size?      'sm' | 'md'  (default 'md'; both ≥ 44px hit area)
//   tone?      'paper' | 'ink'  (default 'paper')
//   withLabel? boolean — show "Save"/"Saved" text next to the heart (PDP)
//   className?
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useHydrated, useWishlist } from '@/lib/cart'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import './shop.css'

export interface WishlistButtonProps {
  productId: string
  name?: string
  slug?: string
  size?: 'sm' | 'md'
  tone?: 'paper' | 'ink'
  withLabel?: boolean
  className?: string
}

export function WishlistButton({ productId, name, slug, size = 'md', tone = 'paper', withLabel, className }: WishlistButtonProps) {
  const hydrated = useHydrated()
  const saved = useWishlist((s) => s.ids.includes(productId)) && hydrated
  const toggle = useWishlist((s) => s.toggle)
  const [pop, setPop] = useState(0)
  const router = useRouter()

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !saved
    toggle(productId)
    setPop((n) => n + 1)
    if (next) {
      track('wishlist_add', { product: slug ?? productId })
      toast(`Saved${name ? ` “${name}”` : ''} to your wishlist`, {
        action: { label: 'View', onClick: () => router.push('/wishlist') },
        duration: 2500,
      })
    }
  }

  const label = `${saved ? 'Remove' : 'Save'}${name ? ` ${name}` : ''} ${saved ? 'from' : 'to'} wishlist`
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? 'Saved' : 'Save to wishlist'}
      data-cursor={saved ? 'SAVED' : 'SAVE'}
      className={cn(
        'ted-wish press relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-[3px] focus-ring',
        tone === 'paper' ? 'border-ink bg-paper text-ink shadow-hard-sm' : 'border-paper bg-ink text-paper',
        size === 'sm' ? 'h-11 w-11' : withLabel ? 'h-12 px-4' : 'h-12 w-12',
        saved && 'is-saved',
        className,
      )}
    >
      <Heart
        key={pop}
        aria-hidden="true"
        className={cn('ted-wish-heart h-5 w-5', pop > 0 && 'ted-wish-pop')}
        strokeWidth={2.4}
        fill={saved ? 'var(--color-hype)' : 'transparent'}
        color={saved ? 'var(--color-ink)' : 'currentColor'}
      />
      {withLabel && <span className="label">{saved ? 'Saved' : 'Save'}</span>}
    </button>
  )
}

export default WishlistButton
