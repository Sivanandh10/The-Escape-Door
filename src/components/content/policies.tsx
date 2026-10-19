// Policy copy (CONTRACTS §10.7): the facts we have, and every unknown clearly marked
// "being finalised — message us". No invented terms, windows, charges or timelines. Owner: P5.
// Privacy reflects what the site actually collects (src/lib/analytics.ts, /api/lead, /api/upload-url,
// netlify/functions/track.mts, cart/wishlist localStorage) — DPDP Act 2023.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { INSTAGRAM_URL } from '@/lib/seo'

export interface PolicySection {
  id: string
  /** H2 — wrap the accent word in <em> */
  h2: ReactNode
  /** plain-text H2 for the table of contents */
  toc: string
  body: ReactNode
  pending?: boolean
}

export interface Policy {
  slug: 'privacy' | 'shipping' | 'returns' | 'terms'
  title: string
  description: string
  h1: string
  jp: string
  kicker: string
  intro: ReactNode
  sections: PolicySection[]
}

/** Last time this copy was reviewed. Fixed string (no new Date() under Cache Components). */
export const POLICIES_UPDATED = '19 October 2026'

const A = ({ href, children }: { href: string; children: ReactNode }) =>
  href.startsWith('http') ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-2 underline-offset-4 hover:text-door">
      {children}
    </a>
  ) : (
    <Link href={href} className="font-semibold underline decoration-2 underline-offset-4 hover:text-door">
      {children}
    </Link>
  )

export const POLICIES: Policy[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy | The Escape Door',
    description:
      'What The Escape Door collects (form details, anonymous analytics, custom uploads), why, where it is stored, and your rights under the DPDP Act 2023.',
    h1: 'Privacy policy',
    jp: 'プライバシー',
    kicker: 'Policies · Privacy',
    intro: (
      <p>
        We collect as little as we can: what you type into a form so we can reply, and anonymous page statistics. No
        advertising cookies, no fingerprinting, and we never store your IP address.
      </p>
    ),
    sections: [
      {
        id: 'collect',
        toc: 'What we collect',
        h2: (
          <>
            What we <em>collect</em>
          </>
        ),
        body: (
          <>
            <p>
              <strong>When you fill in a form</strong> (WhatsApp checkout, Custom Forge, stall reminder, drop alerts, fest
              partnership or contact): your name, city, WhatsApp number or email, and your message. A WhatsApp order also saves
              the items and totals in your cart. A custom order saves your design brief and the files you upload.
            </p>
            <p>
              <strong>Anonymous analytics:</strong> a random visitor ID kept in your browser (localStorage) and a session ID
              (localStorage, renewed after 30 minutes of inactivity), the pages you view and actions such as add to cart or WhatsApp click, how you arrived (campaign
              tags, a fest QR code or the referring website&apos;s domain), your device type (mobile, tablet or desktop) and an
              approximate country, region and city provided by our host. We do not store your IP address or browser user agent.
            </p>
            <p>
              <strong>Your cart and wishlist</strong> live only in your browser until you choose to check out.
            </p>
            <p>
              If your browser sends <strong>Do Not Track</strong> or <strong>Global Privacy Control</strong>, analytics are
              switched off.
            </p>
          </>
        ),
      },
      {
        id: 'use',
        toc: 'Why we use it',
        h2: (
          <>
            Why we <em>use</em> it
          </>
        ),
        body: (
          <ul>
            <li>To reply to you and confirm your order, custom request or fest enquiry on WhatsApp or email.</li>
            <li>To make the custom item you asked for from the files you sent.</li>
            <li>To remind you about a stall or a new drop, only if you asked us to.</li>
            <li>To see which pages and products are useful, in aggregate, so we can improve the site.</li>
          </ul>
        ),
      },
      {
        id: 'where',
        toc: 'Where it is stored',
        h2: (
          <>
            Where it is <em>stored</em>
          </>
        ),
        body: (
          <>
            <p>
              Form details and analytics are stored in our database on Supabase. Custom-order files go to a private Supabase
              storage bucket; we view them through signed links that expire after 7 days. The site is hosted on Netlify.
            </p>
            <p>
              When you tap a WhatsApp button, your order message opens in WhatsApp, which is run by Meta under its own privacy
              policy. Links to Instagram work the same way.
            </p>
          </>
        ),
      },
      {
        id: 'retention',
        toc: 'How long we keep it',
        pending: true,
        h2: (
          <>
            How long we <em>keep</em> it
          </>
        ),
        body: (
          <p>
            Our analytics dashboards look at the last 90 days. Exact retention periods for form details and uploaded files are
            being finalised. Until they are published, you can ask us to delete your details at any time.
          </p>
        ),
      },
      {
        id: 'rights',
        toc: 'Your rights',
        h2: (
          <>
            Your <em>rights</em>
          </>
        ),
        body: (
          <>
            <p>Under India&apos;s Digital Personal Data Protection Act, 2023, you can:</p>
            <ul>
              <li>ask what personal data we hold about you and how we use it;</li>
              <li>ask us to correct, complete, update or erase it;</li>
              <li>withdraw consent you gave earlier, for example for drop alerts;</li>
              <li>raise a grievance with us, and if it is not resolved, with the Data Protection Board of India;</li>
              <li>nominate someone to exercise these rights for you.</li>
            </ul>
            <p>
              To use any of these, write to us through the <A href="/contact">contact page</A> or a DM to{' '}
              <A href={INSTAGRAM_URL}>@escapedoor.in</A>.
            </p>
          </>
        ),
      },
      {
        id: 'grievance',
        toc: 'Grievance contact',
        pending: true,
        h2: (
          <>
            Grievance <em>contact</em>
          </>
        ),
        body: (
          <p>
            Our business name, address and grievance contact email are being finalised and will be listed here. Until then, use
            the <A href="/contact">contact page</A> and we will respond.
          </p>
        ),
      },
      {
        id: 'children',
        toc: 'Under 18?',
        h2: (
          <>
            Under <em>18</em>?
          </>
        ),
        body: <p>If you are under 18, please ask a parent or guardian before you send us your details.</p>,
      },
    ],
  },
  {
    slug: 'shipping',
    title: 'Shipping Policy | The Escape Door',
    description:
      'How Escape Door orders work: you send your cart on WhatsApp and we confirm the price, payment and delivery with you. Shipping details are being finalised.',
    h1: 'Shipping policy',
    jp: '配送',
    kicker: 'Policies · Shipping',
    intro: (
      <p>
        Orders are confirmed one by one on WhatsApp, so the details for your order are always agreed in the chat before you
        pay. Our standard shipping terms are being finalised.
      </p>
    ),
    sections: [
      {
        id: 'how',
        toc: 'How an order works',
        h2: (
          <>
            How an order <em>works</em>
          </>
        ),
        body: (
          <ol>
            <li>Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.</li>
            <li>We confirm availability, the final price for items sold in a price range, payment and delivery details in the chat.</li>
            <li>Your order is confirmed once we both agree in the chat.</li>
          </ol>
        ),
      },
      {
        id: 'ship',
        toc: 'Where and how fast we ship',
        pending: true,
        h2: (
          <>
            How we <em>ship</em>
          </>
        ),
        body: (
          <p>
            Delivery areas, shipping charges, dispatch times and delivery times are being finalised. Message us on WhatsApp or
            Instagram before you order and we will tell you what applies to your city.
          </p>
        ),
      },
      {
        id: 'cod',
        toc: 'Cash on delivery',
        pending: true,
        h2: (
          <>
            Cash on <em>delivery</em>
          </>
        ),
        body: <p>Whether cash on delivery is available is being finalised. Ask us in the chat when you order.</p>,
      },
      {
        id: 'custom',
        toc: 'Custom orders',
        h2: (
          <>
            Custom <em>orders</em>
          </>
        ),
        body: (
          <p>
            Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with
            you on WhatsApp before we start. See the <A href="/custom">Custom Forge</A>.
          </p>
        ),
      },
      {
        id: 'stalls',
        toc: 'Buying at a stall',
        h2: (
          <>
            Buying at a <em>stall</em>
          </>
        ),
        body: (
          <p>
            At a fest stall you buy in person and take your merch home the same day. See <A href="/fests#live">upcoming stalls</A>.
          </p>
        ),
      },
    ],
  },
  {
    slug: 'returns',
    title: 'Returns & Exchanges | The Escape Door',
    description:
      'Returns and exchanges at The Escape Door: our policy is being finalised. If an item arrives damaged or wrong, message us on WhatsApp with photos.',
    h1: 'Returns & exchanges',
    jp: '返品・交換',
    kicker: 'Policies · Returns',
    intro: <p>Our return and exchange policy is being finalised. Here is what to do in the meantime.</p>,
    sections: [
      {
        id: 'problem',
        toc: 'Something wrong with your order?',
        h2: (
          <>
            Something <em>wrong</em>?
          </>
        ),
        body: (
          <p>
            If an item arrives damaged, or is not what you ordered, message us on WhatsApp with your order details and a few
            photos, so we can look into it with you.
          </p>
        ),
      },
      {
        id: 'window',
        toc: 'Return window and conditions',
        pending: true,
        h2: (
          <>
            Return <em>window</em> and conditions
          </>
        ),
        body: <p>The return window, which items can be returned or exchanged, and how refunds are paid are being finalised.</p>,
      },
      {
        id: 'sizes',
        toc: 'Sizes and exchanges',
        pending: true,
        h2: (
          <>
            Sizes and <em>exchanges</em>
          </>
        ),
        body: (
          <p>
            Our size chart is coming soon. Until it is published, ask us on WhatsApp for measurements before you order a tee or
            hoodie. Whether size exchanges are possible is being finalised.
          </p>
        ),
      },
      {
        id: 'custom',
        toc: 'Custom-made items',
        pending: true,
        h2: (
          <>
            Custom-made <em>items</em>
          </>
        ),
        body: <p>Custom items are made to your design. How returns apply to them is being finalised.</p>,
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Sale | The Escape Door',
    description:
      'Terms of sale at The Escape Door: original fan-inspired designs, prices in INR, orders confirmed on WhatsApp, and what to know about custom artwork.',
    h1: 'Terms of sale',
    jp: '利用規約',
    kicker: 'Policies · Terms',
    intro: <p>The short version of how buying from us works. Parts that are still being finalised are marked.</p>,
    sections: [
      {
        id: 'products',
        toc: 'Our products',
        h2: (
          <>
            Our <em>products</em>
          </>
        ),
        body: (
          <>
            <p>
              We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators,
              publishers or studios of any series named on this site. Series names only describe what a design is inspired by.
            </p>
            <p>
              Some product images are sample mockups and are marked as samples. We confirm what the real item looks like before
              you pay.
            </p>
            <p>Cosplay katanas and other props are costume and display pieces, not real weapons.</p>
          </>
        ),
      },
      {
        id: 'prices',
        toc: 'Prices',
        h2: (
          <>
            <em>Prices</em>
          </>
        ),
        body: (
          <p>
            Prices are in Indian rupees (₹). Items shown with a price range, and items marked “price on request”, get an exact
            price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart.
          </p>
        ),
      },
      {
        id: 'orders',
        toc: 'Orders',
        h2: (
          <>
            How orders are <em>confirmed</em>
          </>
        ),
        body: (
          <p>
            Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items,
            price, payment and delivery with you in the chat.
          </p>
        ),
      },
      {
        id: 'artwork',
        toc: 'Your artwork',
        h2: (
          <>
            Your <em>artwork</em>
          </>
        ),
        body: (
          <p>
            When you send a design for a custom order, send only artwork you have the right to use. We use your files only to
            make your order.
          </p>
        ),
      },
      {
        id: 'payments',
        toc: 'Payments, shipping and returns',
        pending: true,
        h2: (
          <>
            Payments, shipping and <em>returns</em>
          </>
        ),
        body: (
          <p>
            Accepted payment methods are being finalised. Shipping and returns are covered on the <A href="/policies/shipping">shipping</A>{' '}
            and <A href="/policies/returns">returns</A> pages.
          </p>
        ),
      },
    ],
  },
]

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug)
