'use client'
// /checkout when signed out: a locked door panel + the login modal (opens once by itself). After a
// successful login the server part of the page re-renders with the customer's saved addresses. Owner: CHECKOUT.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { ArrowLeft, LogIn, MessageCircle } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { useCartCount, useHydrated } from '@/lib/cart'
import { useCustomer } from '@/lib/checkout/auth'
import { useAuthProviders } from '@/lib/auth/providers'
import { useWhatsAppCartOrder } from '@/lib/checkout/whatsapp-fallback'

export function LoginWall() {
  const router = useRouter()
  const { openLogin, customer, loading } = useCustomer()
  const hydrated = useHydrated()
  const count = useCartCount()
  const asked = useRef(false)
  const providers = useAuthProviders()
  const guest = providers?.any === false
  const guestOrder = useWhatsAppCartOrder()

  const ask = () => openLogin('Log in to check out', () => router.refresh())

  useEffect(() => {
    if (loading || !providers || guest) return
    // signed in on the client but the server render was signed out (cookie just set) → refresh once
    if (customer) {
      router.refresh()
      return
    }
    if (asked.current) return
    asked.current = true
    const t = window.setTimeout(ask, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, customer, providers])

  if (guest) {
    // no customer login method is switched on yet → the pre-accounts WhatsApp order, so nobody is locked out
    return (
      <div className="panel-paper mx-auto grid max-w-3xl items-center gap-6 p-6 text-ink shadow-hard-volt sm:grid-cols-[1fr_auto] sm:p-8">
        <div>
          <p className="label text-[11px] text-door">Order on WhatsApp · 注文</p>
          <h2 className="mt-2 font-display text-[clamp(36px,6vw,56px)] uppercase leading-[0.9]">
            Send us your <span className="bg-volt px-1">order</span>
          </h2>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-snug text-tone-2">
            {hydrated && count > 0 ? `Your ${count} ${count === 1 ? 'piece is' : 'pieces are'} ready. ` : 'Your cart is empty right now. '}
            We open WhatsApp with the order typed out — we confirm stock, size and delivery there. Nothing is charged on site.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!hydrated || count === 0}
              onClick={() => guestOrder('checkout_page')}
              className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-5 font-display text-[22px] uppercase leading-none text-paper shadow-[4px_4px_0_0_var(--color-door)] disabled:opacity-50"
            >
              <MessageCircle aria-hidden className="size-5 text-volt" /> Order on WhatsApp
            </button>
            <Link href={count > 0 ? '/cart' : '/shop'} className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-paper px-5 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
              <ArrowLeft aria-hidden className="size-4" /> {count > 0 ? 'Back to cart' : 'Shop the drop'}
            </Link>
          </div>
        </div>
        <Mascot mood="peek" size={150} animate title="" className="mx-auto hidden sm:block" />
      </div>
    )
  }

  return (
    <div className="panel-paper mx-auto grid max-w-3xl items-center gap-6 p-6 text-ink shadow-hard-volt sm:grid-cols-[1fr_auto] sm:p-8">
      <div>
        <p className="label text-[11px] text-door">Members only · 会員</p>
        <h2 className="mt-2 font-display text-[clamp(36px,6vw,56px)] uppercase leading-[0.9]">
          Log in to <span className="bg-volt px-1">check out</span>
        </h2>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-snug text-tone-2">
          {hydrated && count > 0 ? `Your ${count} ${count === 1 ? 'piece is' : 'pieces are'} waiting in the cart. ` : ''}
          Logging in saves your delivery addresses, lets you use vouchers and track every order from your account.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={ask} className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-5 font-display text-[22px] uppercase leading-none text-paper shadow-[4px_4px_0_0_var(--color-door)]">
            <LogIn aria-hidden className="size-5 text-volt" /> Log in / sign up
          </button>
          <Link href="/cart" className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-paper px-5 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
            <ArrowLeft aria-hidden className="size-4" /> Back to cart
          </Link>
        </div>
      </div>
      <Mascot mood="peek" size={150} animate title="" className="mx-auto hidden sm:block" />
    </div>
  )
}
