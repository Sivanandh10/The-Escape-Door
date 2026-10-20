// /checkout-success — #71 success moment. Static shell; the order comes from sessionStorage (the hand-off from
// /checkout) or, with ?order=<id>, from the database under RLS in the browser — nothing personal is rendered on
// the server or cached. noindex, nofollow. Owner: CHECKOUT.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SuccessView } from '@/components/shop/cart/SuccessView'

export const metadata: Metadata = {
  title: 'Order placed',
  description: 'Your order is saved and on its way to The Escape Door on WhatsApp.',
  robots: { index: false, follow: false },
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container-x section-y" aria-busy="true">
          <span className="sr-only">Loading your order…</span>
          <div className="skeleton-tone h-[60vh] w-full max-w-md" />
        </div>
      }
    >
      <SuccessView />
    </Suspense>
  )
}
