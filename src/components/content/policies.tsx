// Built-in policy copy (CONTRACTS §10.7): the facts we have, written as plain, confident answers. Anything that
// depends on the order (delivery date, shipping charge, payment, cash on delivery, the fix for a damaged piece) is
// "confirmed with you on WhatsApp before you pay". No invented terms, windows, charges or timelines: typical
// terms with real numbers live as unpublished DRAFTS in Admin → Pages (supabase/migrations/0014) until the owner
// confirms and publishes them. Owner: CMS.
// Privacy reflects what the site actually collects (src/lib/analytics.ts, /api/lead, /api/upload-url,
// netlify/functions/track.mts, cart/wishlist localStorage) — DPDP Act 2023.
//
// Since the Pages CMS (supabase/migrations/0008_pages.sql) these texts are the FALLBACK: /policies/* reads
// public.pages first (admin → Pages), and only shows the text below when the row is missing or Supabase is
// down. The migration seeds the table with exactly this markdown — keep both in sync if you edit here.
//
// Markdown dialect (src/app/policies/_lib/markdown.tsx): text before the first "## " is the intro;
// each "## Heading" starts a section; wrap the accent word in *stars*; a trailing "{#id}" fixes the anchor
// and "{pending}" adds an "Ask us for details" badge (none of the built-in pages use it any more).

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
export const POLICIES_UPDATED = '25 October 2026'

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

## How long we *keep* it {#retention}

Our analytics dashboards look at the last 90 days. Form details and uploaded files are kept for as long as we need them to handle your order or request. You can ask us to delete your details at any time, and we will.

## Your *rights* {#rights}

Under India's Digital Personal Data Protection Act, 2023, you can:

- ask what personal data we hold about you and how we use it;
- ask us to correct, complete, update or erase it;
- withdraw consent you gave earlier, for example for drop alerts;
- raise a grievance with us, and if it is not resolved, with the Data Protection Board of India;
- nominate someone to exercise these rights for you.

To use any of these, write to us through the [contact page](/contact) or a DM to [@escapedoor.in](https://www.instagram.com/escapedoor.in).

## Grievance *contact* {#grievance}

For any privacy question, request or complaint, write to us through the [contact page](/contact) or send a DM to [@escapedoor.in](https://www.instagram.com/escapedoor.in). Say it is a privacy request and we will reply to you there.

## Under *18*? {#children}

If you are under 18, please ask a parent or guardian before you send us your details.
`

const SHIPPING = `We ship within India. Every order is confirmed one by one on WhatsApp, so the delivery date and the shipping charge for your address are agreed with you in the chat before you pay. Nothing is charged on this website.

## How an order *works* {#how}

1. Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.
2. We confirm availability, the final price for items sold in a price range, the shipping charge and the delivery date in the chat.
3. You pay once you are happy with the total, and we pack your order.

## Delivery *date* and charges {#ship}

Delivery time and shipping charges depend on your PIN code and on what you order, so we tell you both in the chat before you pay. Need it by a certain day, for a birthday or a fest? Say so when you message us and we will tell you honestly if we can make it.

## Payment and cash on *delivery* {#cod}

Payment is arranged on WhatsApp after we confirm your order, for example by UPI. Prefer cash on delivery? Ask us in the chat with your PIN code and we will tell you whether it is possible for your order before you place it.

## Custom *orders* {#custom}

Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with you on WhatsApp before we start. See [Design Your Own](/custom).

## Buying at a *stall* {#stalls}

At a fest stall you buy in person and take your merch home the same day. See [upcoming stalls](/fests#live).
`

const RETURNS = `Something not right with your order? Message us on WhatsApp and we will sort it out with you. Every order is confirmed in the chat, so the same chat is where we fix anything that goes wrong.

## Damaged or *wrong* item {#problem}

If an item arrives damaged, or is not what you ordered, message us on WhatsApp as soon as it arrives with your order details and a few clear photos. We look at it with you and agree the fix in the chat.

## Getting the *size* right {#sizes}

Open the size chart on any tee or hoodie page before you order. Not sure between two sizes? Tell us your usual size on WhatsApp and we will match the fit for you before you pay. If the size you picked does not fit, message us and we will see what we can do.

## Custom-made *items* {#custom}

Custom items are made to your design. We share the design, size and spelling with you on WhatsApp before we print, so please check them carefully before you say yes.

## Bought at a *stall*? {#stalls}

Check your merch at the stall before you leave. If something is wrong after the fest, message us on WhatsApp or Instagram with a photo.
`

const TERMS = `The short version of how buying from us works.

## Our *products* {#products}

We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. Series names only describe what a design is inspired by.

Some product images are illustrated mockups; we confirm what the real item looks like before you pay.

Cosplay katanas and other props are costume and display pieces, not real weapons.

## *Prices* {#prices}

Prices are in Indian rupees (₹). Items shown with a price range, and items marked “price on request”, get an exact price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart.

## How orders are *confirmed* {#orders}

Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items, price, payment and delivery with you in the chat.

## Your *artwork* {#artwork}

When you send a design for a custom order, send only artwork you have the right to use. We use your files only to make your order.

## Payments, shipping and *returns* {#payments}

Nothing is charged on this website. Payment is arranged on WhatsApp once your order is confirmed. Shipping and returns are covered on the [shipping](/policies/shipping) and [returns](/policies/returns) pages.
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
      'We ship within India. Send your cart on WhatsApp and we confirm the delivery date, shipping charge and payment with you before you pay.',
    h1: 'Shipping policy',
    jp: '配送',
    kicker: 'Policies · Shipping',
    body: SHIPPING,
  },
  {
    slug: 'returns',
    title: 'Returns & Exchanges | The Escape Door',
    description:
      'Damaged, wrong item or the wrong size? Message The Escape Door on WhatsApp with a few photos and we sort it out with you in the chat.',
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
