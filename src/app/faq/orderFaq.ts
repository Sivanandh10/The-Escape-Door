// FAQ "Orders & delivery" group (owner feedback #8: shipping / COD / returns / sizes no longer say "being finalised").
// Same honest copy as the live policies (@/components/content/policies): nothing invented — delivery date, shipping
// charge, payment and cash on delivery are confirmed on WhatsApp before you pay. Self-contained 40–60-word answers;
// rendered on /faq and mirrored in its FAQPage JSON-LD. Owner: POLICIES.
// The typical terms with real numbers wait as unpublished drafts in Admin → Pages; when the owner publishes them,
// update these answers to match.
import type { FaqGroup, FaqItem } from '@/components/content/faq'

/** Not one of faq.ts's FaqGroup ids (that file belongs to P5); the Accordion never reads `group`. */
export const ORDERS_GROUP_ID = 'orders' as unknown as FaqGroup

export const ORDERS_GROUP = {
  id: ORDERS_GROUP_ID,
  label: 'Orders & delivery',
  jp: '注文・配送',
  blurb: 'Shipping, payment, cash on delivery, sizes and fixing a problem.',
}

export const ORDER_FAQ: FaqItem[] = [
  {
    id: 'shipping-cost',
    group: ORDERS_GROUP_ID,
    q: 'How does shipping work, and what does delivery cost?',
    accent: 'shipping',
    a: 'We ship within India. Delivery time and the shipping charge depend on your PIN code and your order, so we confirm both with you on WhatsApp before you pay. Nothing is charged on the website: you send your cart, we reply with the exact total including shipping, and you pay once you agree.',
    link: { href: '/policies/shipping', label: 'Read the shipping policy' },
  },
  {
    id: 'cash-on-delivery',
    group: ORDERS_GROUP_ID,
    q: 'Can I pay cash on delivery?',
    accent: 'cash',
    a: 'Payment is arranged on WhatsApp after we confirm your order, for example by UPI. If you would rather pay cash on delivery, ask us in the chat with your PIN code and we will tell you whether it is possible for your order before you place it. You never pay anything on the website.',
    link: { href: '/policies/shipping#cod', label: 'Payment and cash on delivery' },
  },
  {
    id: 'find-my-size',
    group: ORDERS_GROUP_ID,
    q: 'How do I find my size for a tee or hoodie?',
    accent: 'size',
    a: 'Tap “Size chart” on any tee or hoodie page and compare it with a tee you already like: armpit to armpit for the chest, top of the shoulder to the hem for the length. Not sure? Tell us your usual size on WhatsApp and we will match the fit before you pay.',
    link: { href: '/shop/t-shirts', label: 'Browse tees' },
  },
  {
    id: 'damaged-or-wrong',
    group: ORDERS_GROUP_ID,
    q: 'What if my order arrives damaged or wrong?',
    accent: 'damaged',
    a: 'Message us on WhatsApp as soon as it arrives, with your order details and a few clear photos of the problem. We look at it with you and agree the fix in the same chat where your order was confirmed. Custom pieces are checked with you on WhatsApp before we print them.',
    link: { href: '/policies/returns', label: 'Returns & exchanges' },
  },
]
