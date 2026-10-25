// /checkout — (contact →) address → gift → voucher → review → order saved FIRST, then WhatsApp. Owner: CHECKOUT.
// Static shell (masthead) + the customer part inside <Suspense> (reads the session cookie). Signed in → saved
// addresses. Signed out → the fast guest checkout (login is optional; name + WhatsApp number are all it needs).
// The cart itself lives in the browser (localStorage). noindex.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Masthead } from '@/components/shop/cart/Masthead'
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow'
import { SignedOutCheckout } from '@/components/checkout/SignedOutCheckout'
import { getAuthUser, getCustomer } from '@/lib/auth/customer-server'
import { getCheckoutSettings, getMyAddresses } from '@/lib/checkout/orders-server'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Log in, pick your delivery address and place your Escape Door order on WhatsApp.',
  alternates: { canonical: '/checkout' },
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return (
    <>
      <Masthead kicker="Order desk · Chapter 01" jp="お会計" echo="Checkout">
        Check<em>out</em>
      </Masthead>
      <section aria-label="Checkout" className="container-x pb-24 pt-8 md:pt-12">
        <Suspense fallback={<CheckoutSkeleton />}>
          <CheckoutGate />
        </Suspense>
      </section>
    </>
  )
}

async function CheckoutGate() {
  const auth = await getAuthUser()
  if (!auth) return <SignedOutCheckout giftWrapFee={(await getCheckoutSettings()).giftWrapFee} />
  const [addresses, settings, customer] = await Promise.all([getMyAddresses(), getCheckoutSettings(), getCustomer()])
  return (
    <CheckoutFlow
      initialAddresses={addresses}
      giftWrapFee={settings.giftWrapFee}
      seed={{ name: customer?.name ?? null, phone: customer?.phone ?? null }}
    />
  )
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12" aria-busy="true">
      <span className="sr-only">Opening the order desk…</span>
      <div className="flex flex-col gap-4 lg:col-span-7">
        <div className="skeleton-tone h-56 w-full" />
        <div className="skeleton-tone h-20 w-full" />
        <div className="skeleton-tone h-20 w-full" />
      </div>
      <div className="skeleton-tone hidden h-96 w-full lg:col-span-5 lg:block" />
    </div>
  )
}
