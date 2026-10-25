// FAQ answer blocks (SITEMAP §4 + critic addenda). Owner: P5. Pure data — server and client safe.
// Every ₹ figure is from docs/source/NOTEBOOK_TRANSCRIPTION.md. [CONFIRM] lines are NOT rendered.
// `q` is the exact visible question (also used verbatim in FAQPage JSON-LD); `accent` is the word
// that gets the <em> highlighter; `a` is the self-contained 40–60-word answer; `more` + `link`
// is the one supporting sentence that points at the page that owns the answer.

export type FaqGroup = 'prices' | 'custom' | 'cosplay' | 'fests' | 'about'

export interface FaqItem {
  id: string
  group: FaqGroup
  q: string
  accent: string
  a: string
  more?: string
  link?: { href: string; label: string }
}

export const FAQ_GROUPS: Array<{ id: FaqGroup; label: string; jp: string; blurb: string }> = [
  { id: 'prices', label: 'Prices', jp: '価格', blurb: 'Tees, hoodies, polaroids, bookmarks, posters, badges and stickers.' },
  { id: 'custom', label: 'Custom orders', jp: '特注', blurb: 'Your own artwork, print sizes and minimum quantities.' },
  { id: 'cosplay', label: 'Cosplay', jp: 'コスプレ', blurb: 'Katanas, capes and finishing touches.' },
  { id: 'fests', label: 'Fests & stalls', jp: 'フェス', blurb: 'Where to find us, and how your fest can partner with us.' },
  { id: 'about', label: 'About us', jp: '私たち', blurb: 'What we make, and what we are not.' },
]

export const FAQ: FaqItem[] = [
  {
    id: 'oversized-tee-price',
    group: 'prices',
    q: 'How much does an anime oversized t-shirt cost?',
    accent: 'cost',
    a: 'At The Escape Door, an anime oversized t-shirt costs ₹800, which keeps it under ₹1000. Regular-fit anime t-shirts cost ₹600 and baby tees cost ₹400. Every design is fan-inspired and original. Our library holds 2,000+ t-shirt designs across anime, shows, movies, games and sports; around 60 pieces are in the online shop, and we share the full library on WhatsApp.',
    more: 'Any tee can also carry your own artwork: tap Design Your Own.',
    link: { href: '/shop/oversized-t-shirts', label: 'Browse anime oversized t-shirts' },
  },
  {
    id: 'hoodie-gsm',
    group: 'prices',
    q: 'How are hoodies priced by GSM?',
    accent: 'GSM',
    a: 'Hoodies at The Escape Door are priced by fabric weight. A 280–330 GSM hoodie costs ₹1200, 330–380 GSM costs ₹1500, 380–430 GSM costs ₹1800, and the heaviest 430–600 GSM hoodie costs ₹2500. Higher GSM means a thicker, warmer hoodie. Any hoodie design can also be printed with your own artwork.',
    more: 'Pick the weight first, then the design.',
    link: { href: '/shop/hoodies', label: 'Compare hoodies by GSM' },
  },
  {
    id: 'bookmark-price',
    group: 'prices',
    q: 'How much do plain and magnetic bookmarks cost?',
    accent: 'bookmarks',
    a: 'Plain bookmarks cost ₹30 each or ₹100 for four, and our library holds about 1,800 plain designs. Magnetic bookmarks cost ₹100 each or ₹150 for two, from about 450 designs. Only some are online; ask on WhatsApp for the rest. Custom bookmarks need at least 14 pieces, and 14 custom pieces cost ₹1400.',
    more: 'The cart applies the 4-for-₹100 and 2-for-₹150 deals automatically.',
    link: { href: '/shop/bookmarks', label: 'See plain and magnetic bookmarks' },
  },
  {
    id: 'poster-deal',
    group: 'prices',
    q: 'Is there a poster deal?',
    accent: 'deal',
    a: "Yes. Posters cost ₹200 each, or ₹1000 for six, which works out as buy five, get one free. The Escape Door's poster library has around 750 designs across anime and other fandoms (only some are online; ask us for the rest), so a full wall set can mix series.",
    more: 'Add six to your cart and the free one is taken off.',
    link: { href: '/shop/posters', label: 'Build a poster wall' },
  },
  {
    id: 'badges-stickers',
    group: 'prices',
    q: 'How much are anime badges and stickers?',
    accent: 'stickers',
    a: 'Anime badges cost ₹50 each or ₹200 for five, from a library of 400-plus designs (ask on WhatsApp for the ones not online). Stickers cost ₹30 each. Custom stickers need a minimum of 15 pieces.',
    more: 'Badges and stickers are the easiest way to fill a laptop or a tote.',
    link: { href: '/shop/badges', label: 'Shop anime badges' },
  },
  {
    id: 'own-design',
    group: 'custom',
    q: 'Can I print my own design on a t-shirt or hoodie?',
    accent: 'design',
    a: 'Yes. With Design Your Own you can send your own artwork, or have The Escape Door create the design for ₹200 extra. The front print area is 4×4 inches and the back print area is 12×15 inches. The final price depends on the garment you choose.',
    more: 'Upload your file, place it on the garment and send the request on WhatsApp.',
    link: { href: '/custom', label: 'Design Your Own' },
  },
  {
    id: 'custom-polaroid-minimum',
    group: 'custom',
    q: 'What is the minimum order for custom polaroids?',
    accent: 'polaroids',
    a: 'Custom polaroid-style prints start at a minimum of 20 pieces. The designs can be all the same or all different. At ₹50 each, 20 custom pieces cost ₹1000. Ready-made polaroids cost ₹50 each or ₹100 for a set of three, covering anime, K-pop, K-drama, F1 and films; the full library runs to about 1,500 designs, shared on request.',
    more: 'Ready-made sets ship from the catalogue; custom sets start in Design Your Own.',
    link: { href: '/shop/polaroids', label: 'Shop polaroid-style prints' },
  },
  {
    id: 'katana-price',
    group: 'cosplay',
    q: 'How much does a cosplay katana cost?',
    accent: 'katana',
    a: 'A basic cosplay katana costs ₹1200–2000, and an LED katana costs ₹3000–4000. Capes cost ₹700–1000, keychains ₹150, and earrings and other accessories ₹250–800. Figurines range from ₹250 to ₹1200, with select pieces at ₹2500. Katanas are sold as cosplay and display props, not real blades.',
    more: 'We confirm the exact piece and price with you on WhatsApp.',
    link: { href: '/shop/cosplay-props', label: 'See cosplay katanas and capes' },
  },
  {
    id: 'where-live',
    group: 'fests',
    q: 'Where can I find The Escape Door live?',
    accent: 'live',
    a: 'The Escape Door runs pop-up stalls at college fests. It has been Fandom Partner at Thomso, IIT Roorkee, three times, and has partnered with Fluxus at IIT Indore, Zeitgeist at IIT Ropar and Blithchron at IIT Gandhinagar. Next season’s stalls are lined up at VIT Bhopal, IIT Indore and IIT Ropar; each date goes up on the fests page as soon as the fest confirms it.',
    more: 'Tap Remind me on a stall and we message you when its dates are fixed. Follow @escapedoor.in on Instagram for live updates.',
    link: { href: '/fests', label: 'See upcoming stalls' },
  },
  {
    id: 'fest-partner',
    group: 'fests',
    q: 'How can our college fest partner with you?',
    accent: 'partner',
    a: 'Fest teams can make The Escape Door their Fandom Partner: a stall for your fest and custom merch for your committee or attendees. Custom minimums are low, with polaroids from 20 pieces, bookmarks from 14 and stickers from 15, plus bulk badges.',
    more: 'Send your fest name and dates and we reply on WhatsApp or email.',
    link: { href: '/fests#partner', label: 'Ask about a fest partnership' },
  },
  {
    id: 'official-merch',
    group: 'about',
    q: 'Is this official licensed anime merch?',
    accent: 'merch',
    a: 'No. The Escape Door sells original, fan-inspired designs made by fans for fans. It is not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on the site. Series names are used only to describe what each design is inspired by.',
    link: { href: '/about', label: 'Read how we work' },
  },
  {
    id: 'only-anime',
    group: 'about',
    q: 'Do you only make anime merch?',
    accent: 'anime',
    a: 'Anime comes first, but not only anime. Beyond Anime covers shows, series, movies, K-pop, K-drama, F1, sports, games, paintings, spiritual themes, coffee and book quotes. Our offline libraries run to about 2,000 t-shirt designs, 1,500 polaroids, 1,800 plain bookmarks, 450 magnetic bookmarks, 750 posters and 400-plus badges. Around 60 pieces are in the online shop; ask us on WhatsApp for the full library.',
    link: { href: '/arc/beyond-anime', label: 'Step through the Beyond Anime door' },
  },
]

/** /cosplay "Questions cosplayers ask" — worded for that page (SITEMAP §4: reuse with different wording). */
export const COSPLAY_FAQ: FaqItem[] = [
  {
    id: 'cosplay-real-blade',
    group: 'cosplay',
    q: 'Are the cosplay katanas real blades?',
    accent: 'blades',
    a: 'No. Every katana at The Escape Door is a cosplay and display prop, not a real blade. Basic katanas cost ₹1200–2000 and LED katanas cost ₹3000–4000, depending on the model. The exact piece and its price are confirmed with you on WhatsApp before you pay.',
    link: { href: '/shop/cosplay-props', label: 'Browse cosplay props' },
  },
  {
    id: 'cosplay-full-look',
    group: 'cosplay',
    q: 'Can I put a whole cosplay look together in one order?',
    accent: 'look',
    a: 'Yes. Pick a prop, add a cape and finish with small pieces: capes cost ₹700–1000, keychains ₹150, and earrings and other accessories ₹250–800. Add a tee or hoodie from your arc and the whole look arrives together.',
    link: { href: '/shop/accessories', label: 'See earrings and keychains' },
  },
]

export const faqById =(id: string) => FAQ.find((f) => f.id === id)

/** Home S14: the 7 questions fans ask first. */
export const HOME_FAQ_IDS = ['oversized-tee-price', 'hoodie-gsm', 'own-design', 'custom-polaroid-minimum', 'katana-price', 'where-live', 'official-merch']

/** Split a question around its accent word → [before, accent, after]. Falls back to no accent. */
export function splitAccent(q: string, accent: string): [string, string, string] {
  const i = q.toLowerCase().lastIndexOf(accent.toLowerCase())
  if (i < 0) return [q, '', '']
  return [q.slice(0, i), q.slice(i, i + accent.length), q.slice(i + accent.length)]
}
