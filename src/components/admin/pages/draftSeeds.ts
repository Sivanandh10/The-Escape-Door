// Pages CMS — the UNPUBLISHED drafts seeded by supabase/migrations/0014_size_charts.sql (owner feedback #8).
// Typical terms for an Indian direct-to-customer merch store, with real-looking numbers (dispatch days, a shipping
// fee, a COD limit, a 48-hour damage window, a 7-day size exchange). They are commitments, so they are NEVER live
// until the owner checks every number in Admin → Pages and presses Publish. The live pages keep the honest
// "confirmed on WhatsApp" copy from @/components/content/policies until then.
// Demo mode (no Supabase) shows these as drafts too, read-only. Keep in sync with the migration if you edit here.

export const DRAFT_NOTE = 'DRAFT — typical terms, not yet confirmed. Check every number (days, ₹, time windows) before publishing.'

export interface DraftSeed {
  slug: 'shipping' | 'returns' | 'terms'
  title: string
  description: string
  body: string
  note: string
}

const SHIPPING = `We ship across India. Every order is confirmed on WhatsApp first, then packed and handed to our courier partner. Nothing is charged on this website.

## How an order *works* {#how}

1. Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.
2. We confirm availability, the final price for items sold in a price range, the shipping charge and the delivery date in the chat.
3. You pay, we pack your order and send you the tracking link on WhatsApp.

## Dispatch *time* {#dispatch}

- Ready-stock items are packed and dispatched within 2–4 working days of payment.
- Made-to-order and custom pieces take 7–10 working days to make before dispatch. We confirm the date in the chat.

## Delivery *time* {#delivery}

After dispatch, most orders reach metro cities in 3–5 working days and other PIN codes in 5–8 working days. Remote areas can take longer. Courier delays during festivals, sales or bad weather are outside our control; we keep you updated in the chat.

## Shipping *charges* {#charges}

Shipping is ₹79 per order within India, and free on orders above ₹999. The exact total is confirmed in the chat before you pay.

## Cash on *delivery* {#cod}

- Prepaid orders (UPI or bank transfer) ship first.
- Cash on delivery is available on ready-stock orders up to ₹2,000 for serviceable PIN codes, with a ₹50 COD fee.
- Custom and made-to-order items are prepaid only.

## Custom *orders* {#custom}

Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with you on WhatsApp before we start. See [Design Your Own](/custom).

## Buying at a *stall* {#stalls}

At a fest stall you buy in person and take your merch home the same day. See [upcoming stalls](/fests#live).
`

const RETURNS = `Something not right with your order? Here is exactly how we fix it.

## Damaged or *wrong* item {#problem}

Message us on WhatsApp within 48 hours of delivery with your order details, an unboxing photo or video, and clear photos of the problem. Once we confirm it, we send a replacement at no cost to you, or a full refund if the item is out of stock.

## Size *exchanges* {#sizes}

Tees and hoodies can be exchanged for another size within 7 days of delivery, if they are unworn, unwashed and in their original packing. You pay the shipping both ways, the new size is subject to stock, and each order gets one exchange. Check the size chart on the product page before you order.

## What we can’t *take back* {#exclusions}

- Custom-made items, unless they arrive damaged or misprinted.
- Posters, polaroids, stickers, badges and bookmarks, unless they arrive damaged.
- Items bought at a fest stall: please check them at the stall before you leave.
- Change of mind returns.

## *Refunds* {#refunds}

Approved refunds are paid to your original payment method (UPI or bank account) within 5–7 working days of approval. Cash on delivery orders are refunded by UPI or bank transfer.

## Cancelling an *order* {#cancel}

You can cancel for a full refund until your order is dispatched. Custom orders can’t be cancelled once printing has started.
`

const TERMS = `The short version of how buying from us works.

## Our *products* {#products}

We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. Series names only describe what a design is inspired by.

Some product images are illustrated mockups; we confirm what the real item looks like before you pay.

Cosplay katanas and other props are costume and display pieces, not real weapons.

## *Prices* {#prices}

Prices are in Indian rupees (₹) and include all taxes. Items shown with a price range, and items marked “price on request”, get an exact price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart. Shipping is shown separately; see the [shipping policy](/policies/shipping).

## How orders are *confirmed* {#orders}

Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items, price, payment and delivery with you in the chat and the payment is received (or cash on delivery is agreed).

## *Payments* {#payments}

We accept UPI and bank transfer, arranged on WhatsApp. Nothing is charged on this website. Cash on delivery is available on some orders; see the [shipping policy](/policies/shipping#cod).

## Shipping and *returns* {#shipping-returns}

Shipping times and charges are on the [shipping policy](/policies/shipping). Damaged items, size exchanges and refunds are on the [returns policy](/policies/returns).

## Your *artwork* {#artwork}

When you send a design for a custom order, send only artwork you have the right to use. We use your files only to make your order, and we may refuse a design that copies someone else’s work.

## Who we *are* {#about}

The Escape Door is run from India. Our business name, address and contact email will be listed here. These terms are governed by the laws of India.
`

export const DRAFT_SEEDS: DraftSeed[] = [
  {
    slug: 'shipping',
    title: 'Shipping policy',
    description: 'Shipping across India: dispatch in 2–4 working days, delivery in 3–8 working days, ₹79 shipping (free above ₹999) and cash on delivery on eligible orders.',
    body: SHIPPING,
    note: DRAFT_NOTE,
  },
  {
    slug: 'returns',
    title: 'Returns & exchanges',
    description: 'Damaged or wrong item? Message us within 48 hours of delivery for a free replacement. Size exchanges on tees and hoodies within 7 days.',
    body: RETURNS,
    note: DRAFT_NOTE,
  },
  {
    slug: 'terms',
    title: 'Terms of sale',
    description: 'Terms of sale at The Escape Door: original fan-inspired designs, prices in INR including taxes, orders confirmed and paid on WhatsApp, shipping and returns.',
    body: TERMS,
    note: `${DRAFT_NOTE} Add your business name, address and contact email under “Who we are”.`,
  },
]

export const draftSeedBySlug = (slug: string) => DRAFT_SEEDS.find((d) => d.slug === slug)
