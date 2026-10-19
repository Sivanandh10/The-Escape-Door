'use client'
// Cart drawer — a door that swings shut over the page from the right (hinge on the right edge,
// halftone shading lifts as it opens). Dialog semantics: aria-modal, focus trap, Esc, scroll lock
// (Lenis stop), focus restored to the header door-cart. Owner: P2.
// Mounted lazily by Providers (default export, no props). Opens via useCart().setOpen(true), or
// straight on the WhatsApp details step via: window.dispatchEvent(new Event('ted:cart-checkout')).
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useCart, useCartCount, useHydrated } from '@/lib/cart'
import { useIsClient, useReducedMotion } from '@/lib/motion'
import { CartPanel, type CartStep } from './CartPanel'
import { CHECKOUT_EVENT } from './cart/order'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const SWING = { type: 'spring', stiffness: 230, damping: 26, mass: 0.9 } as const
const SHUT = [0.7, 0, 0.84, 0] as const

export default function CartDrawer() {
  const open = useCart((s) => s.open)
  const setOpen = useCart((s) => s.setOpen)
  const count = useCartCount()
  const hydrated = useHydrated()
  const mounted = useIsClient()
  const reduced = useReducedMotion()
  const [step, setStep] = useState<CartStep>('cart')
  const panel = useRef<HTMLElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [setOpen])

  // "Buy now" elsewhere → open straight on the details step
  useEffect(() => {
    const onCheckout = () => {
      setStep('details')
      setOpen(true)
    }
    const onNav = () => setOpen(false)
    window.addEventListener(CHECKOUT_EVENT, onCheckout)
    window.addEventListener('ted:navigate', onNav)
    return () => {
      window.removeEventListener(CHECKOUT_EVENT, onCheckout)
      window.removeEventListener('ted:navigate', onNav)
    }
  }, [setOpen])

  // an emptied cart always lands back on the cart step
  const empty = hydrated && count === 0
  const [wasEmpty, setWasEmpty] = useState(empty)
  if (empty !== wasEmpty) {
    setWasEmpty(empty)
    if (empty) setStep('cart')
  }

  // dialog plumbing
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    window.__lenis?.stop()
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => closeBtn.current?.focus({ preventScroll: true }))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (!panel.current.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      root.style.overflow = prevOverflow
      window.__lenis?.start()
      const target = prev && document.contains(prev) ? prev : document.getElementById('cart-door')
      target?.focus?.({ preventScroll: true })
    }
  }, [open, close])

  // reset to the cart step after the door has shut
  const onExitComplete = () => setStep('cart')

  if (!mounted) return null

  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <div key="cart-drawer" className="fixed inset-0 z-[160]">
          {/* the page behind dims into screentone */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/65"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22, delay: 0.06 } }}
            transition={{ duration: 0.24 }}
          >
            <div className="screentone screentone-dense absolute inset-0 text-ink [--tone-opacity:0.55]" />
          </motion.div>

          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-full justify-end [perspective:1700px] sm:w-[min(500px,100vw)]">
            <motion.aside
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-drawer-title"
              className="pointer-events-auto relative flex h-full w-full flex-col border-l-4 border-ink bg-paper text-ink grain [transform-style:preserve-3d] sm:w-[calc(100%-12px)]"
              style={{ transformOrigin: '100% 50%' }}
              initial={reduced ? { opacity: 0 } : { rotateY: -82, opacity: 1 }}
              animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0.15 } } : { rotateY: -86, transition: { duration: 0.3, ease: SHUT } }}
              transition={reduced ? { duration: 0.15 } : SWING}
            >
              {/* door frame along the free edge + volt knob */}
              <span aria-hidden="true" className="absolute inset-y-0 -left-4 hidden w-3 border-x-[3px] border-ink bg-door sm:block">
                <span className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-volt" />
              </span>
              {/* halftone shading that lifts as the door swings flat */}
              {!reduced && (
                <motion.span
                  aria-hidden="true"
                  className="screentone screentone-mid pointer-events-none absolute inset-0 z-20 text-ink [--tone-opacity:0.7]"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 1, transition: { duration: 0.3, ease: SHUT } }}
                  transition={{ duration: 0.45, delay: 0.05 }}
                />
              )}

              <header className="relative flex items-center gap-3 border-b-4 border-ink bg-ink px-4 py-3 text-paper">
                <div className="flex min-w-0 flex-1 items-baseline gap-3">
                  <h2 id="cart-drawer-title" className="font-display text-[34px] uppercase leading-none tracking-[0.01em]">
                    {step === 'details' ? (
                      <>
                        Your <span className="text-volt">details</span>
                      </>
                    ) : (
                      <>
                        The <span className="text-volt">cart</span>
                      </>
                    )}
                  </h2>
                  <span lang="ja" className="jp-sub text-[11px]">{step === 'details' ? 'お届け先' : 'カート'}</span>
                </div>
                {hydrated && count > 0 && (
                  <span className="border-2 border-paper px-2 py-1 font-mono text-[12px] font-bold tabular-nums" aria-label={`${count} ${count === 1 ? 'piece' : 'pieces'}`}>
                    ×{count}
                  </span>
                )}
                <button
                  ref={closeBtn}
                  type="button"
                  onClick={close}
                  aria-label="Close cart"
                  data-focus="volt"
                  className="press grid size-11 shrink-0 place-items-center border-[3px] border-paper bg-volt text-ink"
                >
                  <X aria-hidden="true" className="size-6" />
                </button>
              </header>

              {step === 'details' && (
                <ol className="flex border-b-[3px] border-ink bg-lav font-mono text-[10.5px] font-bold uppercase tracking-[0.12em]" aria-label="Checkout steps">
                  <li className="flex-1 px-4 py-2 text-ink/50">01 Cart</li>
                  <li className="flex-1 border-x-[3px] border-ink bg-volt px-4 py-2" aria-current="step">02 Details</li>
                  <li className="flex-1 px-4 py-2 text-ink/50">03 WhatsApp</li>
                </ol>
              )}

              <CartPanel variant="drawer" step={step} onStepChange={setStep} onNavigate={close} />
            </motion.aside>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
