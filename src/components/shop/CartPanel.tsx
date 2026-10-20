'use client'
// The cart itself — shared by the door drawer and the /cart page. Owner: CHECKOUT (was P2).
// drawer: scrolling lines + pinned totals footer with the login-gated "Checkout" button.
// page:   lines + deals on the left, sticky receipt-panel with totals + "Checkout" on the right.
// Checkout itself (address, gift, voucher, order + WhatsApp) lives on /checkout.
import Link from 'next/link'
import { useMemo } from 'react'
import { AnimatePresence } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useCart, useHydrated } from '@/lib/cart'
import { computeTotals } from '@/lib/pricing'
import { useBundleRules } from '@/components/SiteSettingsProvider'
import { cn } from '@/lib/utils'
import { CheckoutCta } from './CheckoutForm'
import { CartLine } from './cart/CartLine'
import { Deals, TotalsStack } from './cart/Totals'
import { EmptyCart } from './cart/EmptyCart'
import { SkeletonLines } from './cart/bits'

/** kept for older imports — the drawer has a single step now */
export type CartStep = 'cart'

export interface CartPanelProps {
  variant?: 'drawer' | 'page'
  /** close the drawer when a link inside is followed */
  onNavigate?: () => void
}

export function CartPanel({ variant = 'page', onNavigate }: CartPanelProps) {
  const hydrated = useHydrated()
  const items = useCart((s) => s.items)
  const bundleRules = useBundleRules()
  const totals = useMemo(() => computeTotals(items, bundleRules), [items, bundleRules])
  const pieces = items.reduce((n, i) => n + i.qty, 0)

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
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5" data-lenis-prevent="">
          {lines(true)}
          <Deals totals={totals} className="mt-4" />
          {onRequestNote && <div className="mt-3">{onRequestNote}</div>}
        </div>
        <div className="border-t-4 border-ink bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <TotalsStack totals={totals} />
          <CheckoutCta where="drawer" pieces={pieces} total={totals.total} onNavigate={onNavigate} className="mt-3" />
          <Link href="/cart" onClick={onNavigate} className="label mt-1 inline-flex min-h-11 items-center text-[10.5px] underline decoration-2 underline-offset-4 can-hover:hover:text-door">
            View full cart
          </Link>
        </div>
      </div>
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
            <p className="mt-3 text-[13px] leading-snug text-tone-2">Vouchers, gift wrap and your delivery address come next, at checkout.</p>
            <div className="my-5 h-0 border-t-[3px] border-dashed border-ink/40" />
            <CheckoutCta where="page" pieces={pieces} total={totals.total} />
          </div>
        </div>
      </aside>
    </div>
  )
}
