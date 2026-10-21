'use client'
// AddToCartButton — the shop signature #66 "storytelling button" (owner: P1 shop).
//
// Story: press → label morphs ("INTO THE DOOR…") within one frame → the product thumbnail lifts off
// (from `flyFrom` or the button) and arcs (FLIP-style, fixed-position clone, transform only) into the
// header door-cart (#cart-door / [data-cart-door]) which cracks open (Header listens to
// useCart().lastAdded.nonce) → ink burst at the door → button flips to "ADDED!" with a manga SFX pop.
// Reduced motion / no visible cart door → instant add + sonner toast. Screen readers get a polite status.
//
// PUBLIC PROPS (stable — imported by home sections S03 etc.):
//   product     Product (required)
//   variant?    Variant | null   — default: product.variants[0]
//   size?       string | null    — apparel size; if the product has sizes and none is given the button
//                                  shakes, says "PICK A SIZE" and calls onNeedSize (nothing is added)
//   qty?        number           — default 1
//   onAdded?    (r: { key: string; qty: number }) => void
//   onNeedSize? () => void
//   mode?       'add' | 'buy'    — 'buy' adds to the cart and goes straight to /checkout (address + saved order
//                                  before WhatsApp, like every other place-order path), no flight
//   flyFrom?    RefObject<HTMLElement | null> — element the thumbnail lifts off from (card image / gallery)
//   scale?      'sm' | 'md' | 'lg'  (default 'md'; sm is still ≥ 44px tall)
//   tone?       'volt' | 'ink' | 'paper' (default 'volt'; 'buy' mode defaults to 'ink')
//   block?      boolean — full width
//   label?      string — idle label (default "Add to cart" / "Buy now")
//   disabled?   boolean
//   className?
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { toast } from 'sonner'
import { MessageCircle, Plus } from 'lucide-react'
import type { CartItem, Product, Variant } from '@/lib/types'
import { useCart, lineKey } from '@/lib/cart'
import { track } from '@/lib/analytics'
import { registerGsap, useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { useRequireLogin } from '@/lib/auth/customer'
import { Sfx } from '@/components/fx/Sfx'
import './shop.css'

export interface AddToCartButtonProps {
  product: Product
  variant?: Variant | null
  size?: string | null
  qty?: number
  onAdded?: (r: { key: string; qty: number }) => void
  /** after a redirect login (Google / MAL) the add is replayed; 'checkout' also continues to /checkout (Buy now) */
  replayThen?: 'checkout'
  onNeedSize?: () => void
  mode?: 'add' | 'buy'
  flyFrom?: RefObject<HTMLElement | null>
  scale?: 'sm' | 'md' | 'lg'
  tone?: 'volt' | 'ink' | 'paper'
  block?: boolean
  label?: string
  disabled?: boolean
  className?: string
}

type Phase = 'idle' | 'need' | 'flying' | 'added'
const ORDER: Phase[] = ['idle', 'need', 'flying', 'added']

/** Small thumbnail for the cart line + flight: the 600px mockup when it exists. */
export function cartThumb(product: Pick<Product, 'images' | 'slug'>): string {
  const src = product.images[0]?.src ?? ''
  return /^\/mockups\/.+-(front|back)\.webp$/.test(src) ? src.replace(/\.webp$/, '-600.webp') : src
}

const SCALE = {
  sm: 'min-h-11 px-3.5 text-[0.95rem] gap-2 border-[3px]',
  md: 'min-h-12 px-5 text-[1.15rem] gap-2.5 border-[3px]',
  lg: 'min-h-14 px-6 text-[1.4rem] gap-3 border-4',
} as const

export function AddToCartButton({
  product,
  variant,
  size,
  qty = 1,
  onAdded,
  replayThen,
  onNeedSize,
  mode = 'add',
  flyFrom,
  scale = 'md',
  tone,
  block,
  label,
  disabled,
  className,
}: AddToCartButtonProps) {
  const reduced = useReducedMotion()
  const requireLogin = useRequireLogin() // login is mandatory to add / buy (AUTH)
  const router = useRouter()
  const btn = useRef<HTMLButtonElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [burst, setBurst] = useState(0)
  const timers = useRef<number[]>([])
  const flight = useRef<{ tl: gsap.core.Timeline; els: HTMLElement[]; pending: (() => void) | null } | null>(null)

  const v = variant ?? product.variants[0] ?? null
  const soldOut = product.stock === 'out'
  const isDisabled = disabled || soldOut || !v
  const needsSize = !!product.sizes?.length
  const idleLabel = soldOut ? 'Sold out' : label ?? (mode === 'buy' ? 'Buy now' : 'Add to cart')
  const t = tone ?? (mode === 'buy' ? 'ink' : 'volt')

  // cleanup: never lose an add because the component unmounted mid-flight
  useEffect(() => {
    const ts = timers.current
    return () => {
      ts.forEach((id) => window.clearTimeout(id))
      const f = flight.current
      if (f) {
        f.pending?.()
        f.tl.kill()
        f.els.forEach((el) => el.remove())
      }
    }
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  function buildItem() {
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      type: product.type,
      collection: product.collection,
      variantId: v!.id,
      variantLabel: v!.label,
      variantAttrs: v!.attrs,
      size: size ?? undefined,
      unitPrice: typeof v!.price === 'number' ? v!.price : null,
      image: cartThumb(product),
      qty,
    }
  }

  function commit(): { key: string; qty: number; item: CartItem } {
    const item = buildItem()
    useCart.getState().add(item)
    const key = lineKey(item)
    track('add_to_cart', { product: product.slug, variant: v!.id, size: size ?? null, qty, price: item.unitPrice, mode })
    setStatus(`Added ${qty > 1 ? `${qty} × ` : ''}${product.name}${size ? `, size ${size}` : ''} to your cart.`)
    onAdded?.({ key, qty })
    return { key, qty, item: { ...item, key } }
  }

  function finish() {
    setPhase('added')
    setBurst((n) => n + 1)
    later(() => setPhase('idle'), 1700)
    // owner rule: once logged in, adding takes you to the cart
    later(() => useCart.getState().setOpen(true), 650)
  }

  function onClick() {
    if (isDisabled) return
    if (phase === 'flying') return
    if (needsSize && !size) {
      setPhase('need')
      setStatus('Pick a size first.')
      onNeedSize?.()
      later(() => setPhase((p) => (p === 'need' ? 'idle' : p)), 1400)
      return
    }
    // signed out → login modal; the add/buy continues right after login (Google/MAL: replayed on return)
    requireLogin(
      mode === 'buy' ? 'Log in to buy this' : 'Log in to add to your cart',
      proceed,
      { type: 'cart-add', item: buildItem(), ...(replayThen ? { then: replayThen } : {}) },
    )
  }

  function proceed() {
    if (mode === 'buy') {
      // same pipeline as the cart: address + order saved at /checkout, and only then WhatsApp
      commit()
      useCart.getState().setOpen(false)
      setPhase('added')
      router.push('/checkout')
      later(() => setPhase('idle'), 1700)
      return
    }

    const door = document.querySelector<HTMLElement>('#cart-door, [data-cart-door]')
    const to = door?.getBoundingClientRect()
    const doorVisible = !!to && to.width > 0 && to.bottom > 0 && to.top < window.innerHeight
    if (reduced || !doorVisible || !btn.current) {
      commit()
      setPhase('added')
      toast.success(`Added ${product.name}`, {
        description: size ? `Size ${size} · ${v!.label}` : v!.label,
        action: { label: 'View cart', onClick: () => useCart.getState().setOpen(true) },
        duration: 2600,
      })
      later(() => setPhase('idle'), 1500)
      later(() => useCart.getState().setOpen(true), 400)
      return
    }

    // < 100ms feedback: label morphs this frame, flight starts next frame
    setPhase('flying')
    fly(door!, to!)
  }

  function fly(door: HTMLElement, to: DOMRect) {
    registerGsap()
    const src = (flyFrom?.current ?? btn.current)!.getBoundingClientRect()
    const w = Math.round(Math.min(132, Math.max(72, src.width * 0.42)))
    const h = Math.round(w * 1.25)
    const x0 = src.left + src.width / 2 - w / 2
    const y0 = src.top + src.height / 2 - h / 2
    const x1 = to.left + to.width / 2 - w / 2
    const y1 = to.top + to.height / 2 - h / 2
    // quadratic arc: control point above both ends (a throw, not a slide)
    const cx = (x0 + x1) / 2 + (x1 > x0 ? -40 : 40)
    const cy = Math.min(y0, y1) - Math.max(90, Math.abs(x1 - x0) * 0.18)

    const el = document.createElement('div')
    el.className = 'ted-fly'
    el.setAttribute('aria-hidden', 'true')
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.background = product.colorBlock || 'var(--color-lav)'
    const thumb = cartThumb(product)
    if (thumb) {
      const img = document.createElement('img')
      img.src = thumb
      img.alt = ''
      img.decoding = 'async'
      el.appendChild(img)
    }
    const ink = document.createElement('div')
    ink.className = 'ted-fly-ink'
    ink.setAttribute('aria-hidden', 'true')
    document.body.append(el, ink)

    const state = { p: 0 }
    let added = false
    const doAdd = () => {
      if (added) return
      added = true
      commit()
      if (flight.current) flight.current.pending = null
    }

    gsap.set(el, { x: x0, y: y0, scale: 1, rotation: 0, transformOrigin: '50% 50%' })
    gsap.set(ink, { x: to.left + to.width / 2, y: to.top + to.height / 2, scale: 0, opacity: 0 })
    const tl = gsap.timeline({
      onComplete: () => {
        el.remove()
        ink.remove()
        flight.current = null
        doAdd()
        finish()
      },
    })
    // anticipation: lift + tilt off the source
    tl.to(el, { scale: 1.14, rotation: -7, y: y0 - 14, duration: 0.14, ease: 'power2.out' })
      // the throw
      .to(state, {
        p: 1,
        duration: 0.58,
        ease: 'power2.in',
        onUpdate: () => {
          const p = state.p
          const q = 1 - p
          const x = q * q * x0 + 2 * q * p * cx + p * p * x1
          const y = q * q * (y0 - 14) + 2 * q * p * cy + p * p * y1
          gsap.set(el, { x, y, scale: 1.14 - p * 0.86, rotation: -7 + p * 25 })
        },
      })
      // door cracks open while the card is still approaching (Header reacts to the store nonce)
      .call(doAdd, [], '-=0.3')
      // swallowed by the door + ink burst
      .to(el, { scale: 0, opacity: 0, duration: 0.1, ease: 'power2.in' })
      .to(ink, { scale: 1.25, opacity: 1, duration: 0.12, ease: 'back.out(3)' }, '<')
      .to(ink, { scale: 1.6, opacity: 0, duration: 0.22, ease: 'power1.out' })
    flight.current = { tl, els: [el, ink], pending: doAdd }
    void door
  }

  const idx = ORDER.indexOf(phase)
  const labels: Array<[Phase, string]> = [
    ['idle', idleLabel],
    ['need', 'Pick a size'],
    ['flying', 'Into the door…'],
    ['added', mode === 'buy' ? 'To checkout…' : 'Added!'],
  ]

  return (
    <span className={cn('relative inline-flex', block && 'flex w-full', className)}>
      <button
        ref={btn}
        type="button"
        onClick={onClick}
        aria-disabled={isDisabled || undefined}
        data-state={phase}
        data-tone={t}
        data-cursor={isDisabled ? undefined : mode === 'buy' ? 'BUY' : 'ADD'}
        data-cursor-jp={isDisabled ? undefined : 'カート'}
        className={cn(
          'ted-atc relative inline-flex select-none items-center justify-center border-ink font-display uppercase leading-none tracking-[0.01em] focus-ring',
          SCALE[scale],
          block && 'w-full',
        )}
      >
        <span aria-hidden="true" className="inline-flex shrink-0">
          {mode === 'buy' ? (
            <MessageCircle className="h-[1.05em] w-[1.05em]" strokeWidth={2.6} />
          ) : phase === 'idle' || phase === 'need' ? (
            <Plus className="h-[1.05em] w-[1.05em]" strokeWidth={3} />
          ) : (
            <DoorIcon open={phase === 'flying' ? 0.85 : 0.25} size={20} strokeWidth={2.4} />
          )}
        </span>
        <span className="ted-atc-labels" aria-hidden="true">
          {labels.map(([k, text], i) => (
            <span key={k} data-on={k === phase || undefined} data-past={i < idx || undefined}>
              {text}
            </span>
          ))}
        </span>
        <span className="sr-only">{idleLabel}{v && v.label && product.variants.length > 1 ? ` — ${v.label}` : ''}{size ? `, size ${size}` : ''}</span>
      </button>
      {burst > 0 && phase === 'added' && !reduced && mode === 'add' && (
        <span key={burst} className="ted-atc-sfx" aria-hidden="true">
          <Sfx text="ADDED!" size={scale === 'lg' ? 34 : scale === 'md' ? 28 : 22} tone="hype" rotate={-8} />
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">{status}</span>
    </span>
  )
}

export default AddToCartButton
