'use client'
// The cart itself — shared by the door drawer and the /cart page. Owner: P2.
// drawer: scrolling lines + pinned totals footer, then a "details" step with the WhatsApp form.
// page:   lines + deals on the left, sticky receipt-panel with totals + form on the right.
import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Lock } from 'lucide-react'
import { useCart, useHydrated } from '@/lib/cart'
import { computeTotals } from '@/lib/pricing'
import { useBundleRules } from '@/components/SiteSettingsProvider'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { CheckoutForm } from './CheckoutForm'
import { CartLine } from './cart/CartLine'
import { Deals, TotalsStack } from './cart/Totals'
import { EmptyCart } from './cart/EmptyCart'
import { Rupees, SkeletonLines, Thumb } from './cart/bits'

export type CartStep = 'cart' | 'details'

export interface CartPanelProps {
  variant?: 'drawer' | 'page'
  /** drawer only (controlled by CartDrawer) */
  step?: CartStep
  onStepChange?: (s: CartStep) => void
  /** close the drawer when a link inside is followed */
  onNavigate?: () => void
}

export function CartPanel({ variant = 'page', step = 'cart', onStepChange, onNavigate }: CartPanelProps) {
  const hydrated = useHydrated()
  const items = useCart((s) => s.items)
  const bundleRules = useBundleRules()
  const totals = useMemo(() => computeTotals(items, bundleRules), [items, bundleRules])
  const pieces = items.reduce((n, i) => n + i.qty, 0)
  const startedRef = useRef(false)

  const startCheckout = () => {
    if (!startedRef.current) {
      startedRef.current = true
      track('checkout_start', { where: variant, pieces, total: totals.total })
    }
  }

  // the page variant shows the form straight away — count the checkout start once the form is seen
  useEffect(() => {
    if (variant === 'page' && hydrated && items.length) startCheckout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, hydrated, items.length > 0])

  if (!hydrated) {
    return (
      <div className={cn(variant === 'drawer' ? 'flex-1 p-4' : 'py-6')} aria-busy="true">
        <span className="sr-only">Loading your cart…</span>
        <SkeletonLines rows={variant === 'drawer' ? 2 : 3} />
      </div>
    )
  }

  if (!items.length) {
    return variant === 'drawer' ? (
      <div className="flex flex-1 items-center justify-center overflow-y-auto" data-lenis-prevent="">
        <EmptyCart onNavigate={onNavigate} as="h3" />
      </div>
    ) : (
      <div className="panel-paper mx-auto max-w-xl shadow-hard-volt">
        <EmptyCart />
      </div>
    )
  }

  const lines = (compact: boolean) => (
    <ul className="flex flex-col gap-3" aria-label="Items in your cart">
      <AnimatePresence initial={false}>
        {totals.lines.map((l) => (
          <CartLine key={l.key} line={l} compact={compact} onNavigate={onNavigate} />
        ))}
      </AnimatePresence>
    </ul>
  )

  const onRequestNote = totals.hasPriceOnRequest && (
    <p className="border-[3px] border-ink bg-lav px-3 py-2 text-[13px] leading-snug text-ink">
      <strong>Price-on-request items</strong> are listed in your order — we quote them in the WhatsApp chat before you pay anything.
    </p>
  )

  // ── drawer ────────────────────────────────────────────────────────────
  if (variant === 'drawer') {
    return (
      <AnimatePresence mode="wait" initial={false}>
        {step === 'cart' ? (
          <motion.div
            key="cart"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5" data-lenis-prevent="">
              {lines(true)}
              <Deals totals={totals} className="mt-4" />
              {onRequestNote && <div className="mt-3">{onRequestNote}</div>}
            </div>
            <div className="border-t-4 border-ink bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
              <TotalsStack totals={totals} />
              <button
                type="button"
                onClick={() => {
                  startCheckout()
                  onStepChange?.('details')
                }}
                className="press group mt-3 flex min-h-14 w-full items-center justify-center gap-3 border-[3px] border-ink bg-ink px-5 text-paper shadow-[5px_5px_0_0_var(--color-door)]"
              >
                <span className="font-display text-[24px] uppercase leading-none tracking-[0.02em]">Checkout on WhatsApp</span>
                <ArrowRight aria-hidden="true" className="size-5 text-volt transition-transform duration-200 can-hover:group-hover:translate-x-1" />
              </button>
              <div className="mt-2 flex items-center justify-between">
                <Link href="/cart" onClick={onNavigate} className="label inline-flex min-h-11 items-center text-[10.5px] underline decoration-2 underline-offset-4 can-hover:hover:text-door">
                  View full cart
                </Link>
                <span className="label inline-flex items-center gap-1.5 text-[10.5px] text-tone-3">
                  <Lock aria-hidden="true" className="size-3" /> No payment on site
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4"
            data-lenis-prevent=""
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <OrderStrip totals={totals} pieces={pieces} />
            <CheckoutForm items={items} totals={totals} onBack={() => onStepChange?.('cart')} onSent={onNavigate} className="mt-4" />
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // ── page ──────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <p className="label mb-3 text-[11px] text-tone-4">
          {pieces} {pieces === 1 ? 'piece' : 'pieces'} · {items.length} {items.length === 1 ? 'line' : 'lines'}
        </p>
        {lines(false)}
        <Deals totals={totals} className="mt-5" />
        {onRequestNote && <div className="mt-3">{onRequestNote}</div>}
        <Link href="/shop" className="label mt-6 inline-flex min-h-11 items-center gap-2 text-[11px] text-paper underline decoration-volt decoration-2 underline-offset-4">
          Keep shopping <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <aside className="lg:col-span-5" aria-labelledby="cart-summary-title">
        <div className="panel-paper shadow-hard-volt lg:sticky lg:top-[calc(var(--header-h)+24px)]">
          <div className="flex items-center justify-between border-b-4 border-ink bg-ink px-4 py-3 text-paper">
            <h2 id="cart-summary-title" className="font-display text-[26px] uppercase leading-none">
              Order <span className="text-volt">slip</span>
            </h2>
            <span lang="ja" className="jp-sub text-[11px]">注文票</span>
          </div>
          <div className="p-4 sm:p-5">
            <TotalsStack totals={totals} size="lg" />
            <div className="my-5 h-0 border-t-[3px] border-dashed border-ink/40" />
            <CheckoutForm items={items} totals={totals} />
          </div>
        </div>
      </aside>
    </div>
  )
}

function OrderStrip({ totals, pieces }: { totals: ReturnType<typeof computeTotals>; pieces: number }) {
  const priced = totals.lines.some((l) => l.unitPrice != null)
  return (
    <div className="flex items-center gap-3 border-[3px] border-ink bg-volt p-2.5 text-ink shadow-hard-sm">
      <div className="flex -space-x-5">
        {totals.lines.slice(0, 3).map((l) => (
          <Thumb key={l.key} src={l.image} className="w-10 border-2" sizes="40px" />
        ))}
      </div>
      <p className="flex-1 text-[13.5px] font-bold leading-tight">
        {pieces} {pieces === 1 ? 'piece' : 'pieces'}
        {totals.savings > 0 && <span className="block font-mono text-[11.5px] font-medium">bundle savings applied</span>}
      </p>
      <p className="font-display text-[26px] leading-none">{priced ? <Rupees value={totals.total} /> : 'Quote'}</p>
    </div>
  )
}
