'use client'
// The cart's "Checkout" call to action (drawer + /cart page). Owner: CHECKOUT.
// Every order goes through /checkout (contact / address / gift / voucher / review → order saved → WhatsApp).
// Login is OPTIONAL (src/lib/auth/policy.ts): everyone goes straight to /checkout — signed out = guest checkout (name +
// WhatsApp number only). With NEXT_PUBLIC_LOGIN_REQUIRED=1 the gate opens the login modal first, as before.
// (The old WhatsApp-only shortcut that skipped the address is gone.)
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Lock } from 'lucide-react'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { useCart } from '@/lib/cart'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { useCustomer, useRequireLogin } from '@/lib/checkout/auth'
import { loginGateOn } from '@/lib/auth/policy'

export interface CheckoutCtaProps {
  /** where it sits (analytics) */
  where: 'drawer' | 'page' | 'buy_now'
  /** closes the drawer before navigating */
  onNavigate?: () => void
  pieces: number
  total: number
  className?: string
}

/** → /checkout (login gate only with NEXT_PUBLIC_LOGIN_REQUIRED=1). Instant feedback: the door on the button opens on press. */
export function CheckoutCta({ where, onNavigate, pieces, total, className }: CheckoutCtaProps) {
  const go = useGoToCheckout()
  const [going, setGoing] = useState(false)
  const { customer } = useCustomer()
  const guest = !customer && !loginGateOn()

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        onClick={() =>
          go({
            where,
            pieces,
            total,
            onGo: () => {
              setGoing(true)
              onNavigate?.()
            },
          })
        }
        aria-busy={going}
        data-cursor="GO"
        className="press group flex min-h-14 w-full items-center justify-center gap-3 border-[3px] border-ink bg-ink px-5 text-paper shadow-[5px_5px_0_0_var(--color-door)]"
      >
        <span aria-hidden="true" className="grid size-8 place-items-center border-2 border-paper bg-paper">
          <DoorIcon open={going ? 0.95 : 0.15} size={20} light="var(--color-door)" />
        </span>
        <span className="font-display text-[24px] uppercase leading-none tracking-[0.02em]">{going ? 'Opening checkout…' : 'Checkout'}</span>
        <ArrowRight aria-hidden="true" className="size-5 text-volt transition-transform duration-200 can-hover:group-hover:translate-x-1" />
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-tone-3">
        <Lock aria-hidden="true" className="size-3 shrink-0" />
        {guest ? 'No account needed · name + WhatsApp number · pay in the chat — nothing is charged on site' : customer ? 'Pick an address · pay on WhatsApp — nothing is charged on site' : 'Log in · pick an address · pay on WhatsApp — nothing is charged on site'}
      </p>
    </div>
  )
}

/** Shared "go to checkout" (close the drawer → /checkout; the gate is a pass-through while login is optional). */
export function useGoToCheckout() {
  const router = useRouter()
  const requireLogin = useRequireLogin()
  return ({ where, pieces, total, onGo }: { where: string; pieces?: number; total?: number; onGo?: () => void }) => {
    router.prefetch('/checkout')
    // login optional → the gate runs the action straight away (guest checkout)
    requireLogin('Log in to check out', () => {
      track('checkout_start', { where, pieces: pieces ?? null, total: total ?? null })
      onGo?.()
      useCart.getState().setOpen(false)
      router.push('/checkout')
    })
  }
}
