'use client'
// Local #66 storytelling add button for S03 (owner: s03-s04-tee).
// Same props as the shared <AddToCartButton product variant size qty onAdded? /> (CONTRACTS §6) so it can be swapped
// for the P1 component once it lands. Story: idle → working (label kicks out, the tee drops into a tiny door,
// a thumbnail flies into the header #cart-door) → done ("ADDED!" pop) → idle. Feedback on pointerdown (< 100 ms).
// Reduced motion: instant add + toast. Result announced via aria-live.
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { toast } from 'sonner'
import type { Product, Variant } from '@/lib/types'
import { useCart } from '@/lib/cart'
import { track } from '@/lib/analytics'
import { EASE, prefersReducedMotion, registerGsap } from '@/lib/motion'
import { DoorIcon } from '@/components/brand'
import { cn } from '@/lib/utils'

registerGsap()

type Phase = 'idle' | 'working' | 'done'

export interface AddButtonProps {
  product: Product
  variant: Variant
  size?: string
  qty?: number
  /** return false to block the add (e.g. size missing) — the button shakes */
  onBeforeAdd?: () => boolean
  onAdded?: () => void
  className?: string
}

export function AddButton({ product, variant, size, qty = 1, onBeforeAdd, onAdded, className }: AddButtonProps) {
  const root = useRef<HTMLButtonElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [said, setSaid] = useState('')
  const add = useCart((s) => s.add)
  const setOpen = useCart((s) => s.setOpen)
  const thumb = product.images.find((i) => i.side === 'back')?.src ?? product.images[0]?.src ?? ''
  const thumbSmall = thumb.replace(/\.webp$/, '-600.webp')
  const { contextSafe } = useGSAP({ scope: root })

  const fly = contextSafe(() => {
    const from = root.current?.querySelector<HTMLElement>('[data-story-thumb]')
    const target = document.querySelector<HTMLElement>('#cart-door, [data-cart-door]')
    if (!from) return
    const a = from.getBoundingClientRect()
    const b = target?.getBoundingClientRect()
    const tx = b && b.width ? b.left + b.width / 2 : window.innerWidth - 40
    const ty = b && b.width ? b.top + b.height / 2 : 36
    const ghost = document.createElement('img')
    ghost.src = thumbSmall
    ghost.alt = ''
    ghost.setAttribute('aria-hidden', 'true')
    Object.assign(ghost.style, {
      position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
      zIndex: '120', pointerEvents: 'none', objectFit: 'cover', border: '3px solid #0B0B0F',
      background: '#C9B8FF', boxShadow: '4px 4px 0 #0B0B0F',
    })
    document.body.appendChild(ghost)
    const dx = tx - (a.left + a.width / 2)
    const dy = ty - (a.top + a.height / 2)
    gsap.timeline({ onComplete: () => ghost.remove() })
      .to(ghost, { x: dx, duration: 0.62, ease: 'power1.inOut' }, 0)
      .to(ghost, { y: dy, duration: 0.62, ease: 'back.in(1.6)' }, 0)
      .to(ghost, { rotate: 18, scale: 0.32, duration: 0.62, ease: 'power2.in' }, 0)
      .to(ghost, { autoAlpha: 0, duration: 0.12 }, 0.56)
  })

  const onClick = contextSafe(() => {
    if (phase !== 'idle') return
    if (onBeforeAdd && !onBeforeAdd()) {
      if (!prefersReducedMotion()) gsap.fromTo(root.current, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
      return
    }
    const msg = `${product.designTitle} ${variant.label}${size ? `, size ${size}` : ''} added to cart`
    const commit = () => {
      add({
        productId: product.id, slug: product.slug, name: product.name, type: product.type, collection: product.collection,
        variantId: variant.id, variantLabel: variant.label, ...(variant.attrs ? { variantAttrs: variant.attrs } : {}),
        ...(size ? { size } : {}), unitPrice: variant.price, qty, image: product.images[0]?.src ?? thumb,
      })
      track('add_to_cart', { product: product.slug, variant: variant.id, size: size ?? '', price: variant.price ?? 0, source: 'home-drop' })
      setSaid(msg)
      onAdded?.()
    }

    if (prefersReducedMotion()) {
      commit()
      toast.success('Added to cart', { description: msg, action: { label: 'View cart', onClick: () => setOpen(true) } })
      return
    }

    setPhase('working')
    const q = gsap.utils.selector(root)
    gsap.timeline({
      onComplete: () => {
        setPhase('done')
        gsap.timeline({ onComplete: () => setPhase('idle') })
          .fromTo(q('[data-story-done]'), { scale: 0.3, rotate: -14, autoAlpha: 0 }, { scale: 1, rotate: -4, autoAlpha: 1, duration: 0.42, ease: EASE.slam })
          .to({}, { duration: 1.3 })
          .to(q('[data-story-done]'), { yPercent: -120, autoAlpha: 0, duration: 0.22, ease: EASE.in })
          .fromTo(q('[data-story-label]'), { yPercent: 120 }, { yPercent: 0, duration: 0.35, ease: EASE.out })
      },
    })
      .to(q('[data-story-label]'), { yPercent: -130, duration: 0.18, ease: EASE.in }, 0)
      .fromTo(q('[data-story-layer]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.05)
      .fromTo(q('[data-story-door]'), { '--door-open': 0 }, { '--door-open': 1, duration: 0.2, ease: EASE.punch }, 0.08)
      .fromTo(q('[data-story-thumb]'), { y: -46, rotate: -18, scale: 0.8 }, { y: 0, rotate: 0, scale: 1, duration: 0.34, ease: 'ted-slam' }, 0.1)
      .add(() => { commit(); fly() }, 0.42)
      .to(q('[data-story-door]'), { '--door-open': 0, duration: 0.16, ease: EASE.in }, 0.5)
      .to(q('[data-story-layer]'), { autoAlpha: 0, duration: 0.12 }, 0.64)
  })

  const busy = phase !== 'idle'
  return (
    <>
      <button
        ref={root}
        type="button"
        onClick={onClick}
        aria-disabled={busy || undefined}
        data-cursor="ADD"
        data-cursor-jp="カート"
        data-phase={phase}
        className={cn(
          'press focus-ring group relative isolate flex h-14 w-full items-center justify-center overflow-hidden border-[3px] border-ink px-6 text-ink shadow-hard',
          'transition-colors duration-150 active:shadow-none',
          phase === 'done' ? 'bg-ink text-volt' : 'bg-volt can-hover:hover:bg-volt-hot',
          busy && 'pointer-events-none',
          className,
        )}
      >
        {/* idle label */}
        <span data-story-label className="flex items-center gap-3 font-display text-[22px] uppercase leading-none tracking-[0.02em]">
          <DoorIcon size={22} open={0.15} strokeWidth={2.4} light="var(--color-door)" />
          Add to cart
          <span className="font-mono text-[13px] tracking-normal opacity-70">· {variant.price !== null ? `₹${variant.price.toLocaleString('en-IN')}` : 'on request'}</span>
        </span>
        {/* story layer: a tiny door swallows the tee */}
        <span data-story-layer aria-hidden="true" className="invisible absolute inset-0 flex items-center justify-center gap-3 bg-volt">
          <span
            data-story-door
            className="relative block h-9 w-7 border-[3px] border-ink bg-door"
            style={{ ['--door-open' as string]: 0 }}
          >
            <span
              className="absolute inset-0 origin-left bg-ink"
              style={{ transform: 'perspective(80px) rotateY(calc(var(--door-open) * -70deg))' }}
            />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-story-thumb src={thumbSmall} alt="" width={30} height={38} className="block h-[38px] w-[30px] border-2 border-ink bg-lav object-cover" />
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.14em]">Packing…</span>
        </span>
        {/* done */}
        <span data-story-done aria-hidden="true" className={cn('absolute inset-0 flex items-center justify-center gap-3', phase !== 'done' && 'invisible')}>
          <span className="sfx font-sfx text-[30px]" style={{ ['--sfx-rot' as string]: '-4deg' }}>ADDED!</span>
          <span lang="ja" className="font-jp text-[13px] font-bold tracking-[0.3em] text-paper/70">追加</span>
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </>
  )
}

export default AddButton
