// /cart — full-page cart (same panel as the drawer) + WhatsApp checkout. noindex, follow (SITEMAP).
import type { Metadata } from 'next'
import { CartPanel } from '@/components/shop/CartPanel'
import { Masthead } from '@/components/shop/cart/Masthead'

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review your Escape Door picks, see bundle savings and send the order on WhatsApp.',
  alternates: { canonical: '/cart' },
  robots: { index: false, follow: true },
}

export default function CartPage() {
  return (
    <>
      <Masthead kicker="Order desk · Chapter 00" jp="カート" echo="Cart Cart">
        Your <em>cart</em>
      </Masthead>
      <section aria-label="Cart" className="container-x pb-24 pt-8 md:pt-12">
        <CartPanel variant="page" />
      </section>
    </>
  )
}
