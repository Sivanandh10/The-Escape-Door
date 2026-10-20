// Built-in policy copy (CONTRACTS §10.7): the facts we have, and every unknown clearly marked
// "being finalised — message us". No invented terms, windows, charges or timelines. Owner: CMS.
// Privacy reflects what the site actually collects (src/lib/analytics.ts, /api/lead, /api/upload-url,
// netlify/functions/track.mts, cart/wishlist localStorage) — DPDP Act 2023.
//
// Since the Pages CMS (supabase/migrations/0008_pages.sql) these texts are the FALLBACK: /policies/* reads
// public.pages first (admin → Pages), and only shows the text below when the row is missing or Supabase is
// down. The migration seeds the table with exactly this markdown — keep both in sync if you edit here.
//
// Markdown dialect (src/app/policies/_lib/markdown.tsx): text before the first "## " is the intro;
// each "## Heading" starts a section; wrap the accent word in *stars*; a trailing "{#id}" fixes the anchor
// and "{pending}" adds the "Being finalised — message us" badge.

export type BuiltinPolicySlug = 'privacy' | 'shipping' | 'returns' | 'terms'

export interface Policy {
  slug: BuiltinPolicySlug
  /** SEO <title> (absolute) */
  title: string
  description: string
  /** visible H1 (= the CMS "title") */
  h1: string
  jp: string
  kicker: string
  /** page body in the CMS markdown dialect */
  body: string
}

/** Last time the built-in copy was reviewed. Fixed string (no new Date() under Cache Components). */
export const POLICIES_UPDATED = '19 October 2026'

const PRIVACY = `We collect as little as we can: what you type into a form so we can reply, and anonymous page statistics. No advertising cookies, no fingerprinting, and we never store your IP address.

## What we *collect* {#collect}

**When you fill in a form** (WhatsApp checkout, Design Your Own, stall reminder, drop alerts, fest partnership or contact): your name, city, WhatsApp number or email, and your message. A WhatsApp order also saves the items and totals in your cart. A custom order saves your design brief and the files you upload.

**Anonymous analytics:** a random visitor ID kept in your browser (localStorage) and a session ID (localStorage, renewed after 30 minutes of inactivity), the pages you view and actions such as add to cart or WhatsApp click, how you arrived (campaign tags, a fest QR code or the referring website's domain), your device type (mobile, tablet or desktop) and an approximate country, region and city provided by our host. We do not store your IP address or browser user agent.

**Your cart and wishlist** live only in your browser until you choose to check out.

If your browser sends **Do Not Track** or **Global Privacy Control**, analytics are switched off.

## Why we *use* it {#use}

- To reply to you and confirm your order, custom request or fest enquiry on WhatsApp or email.
- To make the custom item you asked for from the files you sent.
- To remind you about a stall or a new drop, only if you asked us to.
- To see which pages and products are useful, in aggregate, so we can improve the site.

## Where it is *stored* {#where}

Form details and analytics are stored in our database on Supabase. Custom-order files go to a private Supabase storage bucket; we view them through signed links that expire after 7 days. The site is hosted on Netlify.

When you tap a WhatsApp button, your order message opens in WhatsApp, which is run by Meta under its own privacy policy. Links to Instagram work the same way.

## How long we *keep* it {#retention pending}

Our analytics dashboards look at the last 90 days. Exact retention periods for form details and uploaded files are being finalised. Until they are published, you can ask us to delete your details at any time.

## Your *rights* {#rights}

Under India's Digital Personal Data Protection Act, 2023, you can:

- ask what personal data we hold about you and how we use it;
- ask us to correct, complete, update or erase it;
- withdraw consent you gave earlier, for example for drop alerts;
- raise a grievance with us, and if it is not resolved, with the Data Protection Board of India;
- nominate someone to exercise these rights for you.

To use any of these, write to us through the [contact page](/contact) or a DM to [@escapedoor.in](https://www.instagram.com/escapedoor.in).

## Grievance *contact* {#grievance pending}

Our business name, address and grievance contact email are being finalised and will be listed here. Until then, use the [contact page](/contact) and we will respond.

## Under *18*? {#children}

If you are under 18, please ask a parent or guardian before you send us your details.
`

const SHIPPING = `Orders are confirmed one by one on WhatsApp, so the details for your order are always agreed in the chat before you pay. Our standard shipping terms are being finalised.

## How an order *works* {#how}

1. Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.
2. We confirm availability, the final price for items sold in a price range, payment and delivery details in the chat.
3. Your order is confirmed once we both agree in the chat.

## How we *ship* {#ship pending}

Delivery areas, shipping charges, dispatch times and delivery times are being finalised. Message us on WhatsApp or Instagram before you order and we will tell you what applies to your city.

## Cash on *delivery* {#cod pending}

Whether cash on delivery is available is being finalised. Ask us in the chat when you order.

## Custom *orders* {#custom}

Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with you on WhatsApp before we start. See [Design Your Own](/custom).

## Buying at a *stall* {#stalls}

At a fest stall you buy in person and take your merch home the same day. See [upcoming stalls](/fests#live).
`

const RETURNS = `Our return and exchange policy is being finalised. Here is what to do in the meantime.

## Something *wrong*? {#problem}

If an item arrives damaged, or is not what you ordered, message us on WhatsApp with your order details and a few photos, so we can look into it with you.

## Return *window* and conditions {#window pending}

The return window, which items can be returned or exchanged, and how refunds are paid are being finalised.

## Sizes and *exchanges* {#sizes pending}

Our size chart is coming soon. Until it is published, ask us on WhatsApp for measurements before you order a tee or hoodie. Whether size exchanges are possible is being finalised.

## Custom-made *items* {#custom pending}

Custom items are made to your design. How returns apply to them is being finalised.
`

const TERMS = `The short version of how buying from us works. Parts that are still being finalised are marked.

## Our *products* {#products}

We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. Series names only describe what a design is inspired by.

Some product images are sample mockups and are marked as samples. We confirm what the real item looks like before you pay.

Cosplay katanas and other props are costume and display pieces, not real weapons.

## *Prices* {#prices}

Prices are in Indian rupees (₹). Items shown with a price range, and items marked “price on request”, get an exact price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart.

## How orders are *confirmed* {#orders}

Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items, price, payment and delivery with you in the chat.

## Your *artwork* {#artwork}

When you send a design for a custom order, send only artwork you have the right to use. We use your files only to make your order.

## Payments, shipping and *returns* {#payments pending}

Accepted payment methods are being finalised. Shipping and returns are covered on the [shipping](/policies/shipping) and [returns](/policies/returns) pages.
`

export const POLICIES: Policy[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy | The Escape Door',
    description:
      'What The Escape Door collects (form details, anonymous analytics, custom uploads), why, where it is stored, and your rights under the DPDP Act 2023.',
    h1: 'Privacy policy',
    jp: 'プライバシー',
    kicker: 'Policies · Privacy',
    body: PRIVACY,
  },
  {
    slug: 'shipping',
    title: 'Shipping Policy | The Escape Door',
    description:
      'How Escape Door orders work: you send your cart on WhatsApp and we confirm the price, payment and delivery with you. Shipping details are being finalised.',
    h1: 'Shipping policy',
    jp: '配送',
    kicker: 'Policies · Shipping',
    body: SHIPPING,
  },
  {
    slug: 'returns',
    title: 'Returns & Exchanges | The Escape Door',
    description:
      'Returns and exchanges at The Escape Door: our policy is being finalised. If an item arrives damaged or wrong, message us on WhatsApp with photos.',
    h1: 'Returns & exchanges',
    jp: '返品・交換',
    kicker: 'Policies · Returns',
    body: RETURNS,
  },
  {
    slug: 'terms',
    title: 'Terms of Sale | The Escape Door',
    description:
      'Terms of sale at The Escape Door: original fan-inspired designs, prices in INR, orders confirmed on WhatsApp, and what to know about custom artwork.',
    h1: 'Terms of sale',
    jp: '利用規約',
    kicker: 'Policies · Terms',
    body: TERMS,
  },
]

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug)
