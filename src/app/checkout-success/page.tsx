// /checkout-success — #71 success moment. Static shell; the order comes from sessionStorage on the
// client, so nothing personal is ever rendered on the server or cached. noindex, nofollow (SITEMAP).
import type { Metadata } from 'next'
import { SuccessView } from '@/components/shop/cart/SuccessView'

export const metadata: Metadata = {
  title: 'Order sent',
  description: 'Your order is on its way to The Escape Door on WhatsApp.',
  robots: { index: false, follow: false },
}

export default function CheckoutSuccessPage() {
  return <SuccessView />
}
