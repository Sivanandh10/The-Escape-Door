// Catalogue config shared by /shop, /shop/[category], /arc/[collection] and the grid (owner: P1 shop).
// Pure + client-safe. Copy and SEO strings are from SITEMAP.md §2.3 (do not invent prices here —
// the numbers in copy mirror the notebook rules in src/lib/data/rules.ts).
import type { Product, ProductType } from '@/lib/types'

export const TYPE_LABEL: Record<ProductType, [string, string]> = {
  tshirt: ['T-shirt', 'T-shirts'],
  hoodie: ['Hoodie', 'Hoodies'],
  polaroid: ['Polaroid', 'Polaroids'],
  bookmark: ['Bookmark', 'Bookmarks'],
  poster: ['Poster', 'Posters'],
  badge: ['Badge', 'Badges'],
  sticker: ['Sticker', 'Stickers'],
  keychain: ['Keychain', 'Keychains'],
  cosplay: ['Cosplay', 'Cosplay'],
  katana: ['Katana', 'Katanas'],
  figurine: ['Figurine', 'Figurines'],
  cape: ['Cape', 'Capes'],
  accessory: ['Earrings & more', 'Earrings & more'],
  hat: ['Cosplay hat', 'Cosplay hats'],
  tote: ['Tote', 'Totes'],
  stationery: ['Stationery', 'Stationery'],
}

/** Product-type groups used for the "products grouped by type" sections on arc pages. */
export const TYPE_GROUPS: Array<{ id: string; title: [string, string, string]; types: ProductType[] }> = [
  { id: 'apparel', title: ['Wear the ', 'arc', ': tees and hoodies'], types: ['tshirt', 'hoodie'] },
  { id: 'collectibles', title: ['Collect the ', 'panels', ': polaroids, posters, badges'], types: ['polaroid', 'poster', 'bookmark', 'badge', 'sticker', 'stationery', 'tote'] },
  { id: 'cosplay', title: ['Gear for your ', 'cosplay', ''], types: ['katana', 'cape', 'hat', 'cosplay'] },
  { id: 'accessories', title: ['Small pieces, big ', 'fandom', ''], types: ['keychain', 'accessory', 'figurine'] },
]

const fits = (p: Product) => new Set(p.variants.map((v) => v.attrs?.fit).filter(Boolean))

export interface Category {
  slug: string
  label: string
  /** short label for chips */
  chip: string
  match: (p: Product) => boolean
  title: string
  meta: string
  h1: string
  /** [before, accent, after] — the category-specific H2 */
  h2: [string, string, string]
  intro: string
  kind: 'apparel' | 'collectible' | 'prop'
  related: string[]
  /** optional GEO answer blocks shown on the page (+ FAQPage JSON-LD) */
  faq?: Array<{ q: string; a: string }>
}

export const CATEGORIES: Category[] = [
  {
    slug: 'oversized-t-shirts', label: 'Oversized tees', chip: 'Oversized',
    match: (p) => p.type === 'tshirt' && fits(p).has('oversized'),
    title: 'Anime Oversized T-Shirts ₹800 — Under ₹1000 | Escape Door',
    meta: 'Anime oversized t-shirts at ₹800, under ₹1000. Black drop-shoulder tees with fan-inspired back prints up to 12×15 in. Add your own design.',
    h1: 'Anime oversized t-shirts, ₹800 flat',
    h2: ['Back prints up to 12×15 ', 'inches', ''],
    intro: 'Black drop-shoulder tees with a small front hit (up to 4×4 in) and a big back print (up to 12×15 in). Every design is an original, fan-inspired illustration. Sizes XS–XXL; ask us on WhatsApp for the size chart before you order.',
    kind: 'apparel', related: ['t-shirts', 'hoodies'],
    faq: [
      { q: 'How much is an anime oversized t-shirt?', a: 'Every oversized tee in the catalogue is ₹800, under ₹1000. Custom designs on the same tee are priced on WhatsApp because they depend on the garment.' },
      { q: 'How big is the back print?', a: 'Back prints go up to 12×15 inches and the front hit up to 4×4 inches.' },
    ],
  },
  {
    slug: 't-shirts', label: 'T-shirts', chip: 'Regular & baby',
    match: (p) => p.type === 'tshirt' && (fits(p).has('regular') || fits(p).has('baby') || fits(p).size === 0),
    title: 'Anime T-Shirts India — Regular & Baby Tees | Escape Door',
    meta: 'Anime t-shirts in regular fit for ₹600 and baby tees for ₹400. Fan-inspired designs across Jujutsu Kaisen, One Piece, Naruto and more.',
    h1: 'Anime t-shirts, regular and baby fit',
    h2: ['Regular ₹600, baby tee ₹400: pick your ', 'fit', ''],
    intro: 'The same original prints in three fits: regular, baby tee and oversized. Pick the fit on the product page; the price follows the fit.',
    kind: 'apparel', related: ['oversized-t-shirts', 'hoodies'],
  },
  {
    slug: 'hoodies', label: 'Hoodies', chip: 'Hoodies',
    match: (p) => p.type === 'hoodie',
    title: 'Anime Hoodies India — 280 to 600 GSM | The Escape Door',
    meta: 'Anime hoodies priced by weight: 280–330 GSM ₹1200, 330–380 ₹1500, 380–430 ₹1800, 430–600 GSM ₹2500. Fan-inspired prints.',
    h1: 'Anime hoodies, priced by GSM',
    h2: ['Choose your ', 'weight', ': four GSM tiers'],
    intro: 'Hoodies come in four fabric weights. Higher GSM means a thicker, heavier hoodie. Pick a tier on the product page — the price is set by the GSM.',
    kind: 'apparel', related: ['oversized-t-shirts', 't-shirts'],
    faq: [{ q: 'What does GSM mean on a hoodie?', a: 'GSM is grams per square metre of fabric: the higher the number, the thicker and heavier the hoodie. Ours run 280–330, 330–380, 380–430 and 430–600 GSM.' }],
  },
  {
    slug: 'polaroids', label: 'Polaroids', chip: 'Polaroids',
    match: (p) => p.type === 'polaroid',
    title: 'Anime Polaroid Prints — ₹50 Each, 3 for ₹100 | Escape Door',
    meta: 'Polaroid-style anime prints at ₹50 each or 3 for ₹100. 1500 designs across anime, K-pop, K-drama, F1 and films. Custom sets from 20 pieces.',
    h1: 'Anime polaroid prints, 1500 designs',
    h2: ['Build a ', 'set', ': 3 for ₹100'],
    intro: 'Polaroid-style prints at ₹50 each. Any three for ₹100 — mix designs and arcs to make your set; the discount applies in the cart automatically.',
    kind: 'collectible', related: ['bookmarks', 'posters'],
  },
  {
    slug: 'bookmarks', label: 'Bookmarks', chip: 'Bookmarks',
    match: (p) => p.type === 'bookmark',
    title: 'Anime Bookmarks — Plain & Magnetic | The Escape Door',
    meta: 'Plain anime bookmarks ₹30 (4 for ₹100) and magnetic bookmarks ₹100 (2 for ₹150). 1800 plain and 450 magnetic designs. Custom from 14 pieces.',
    h1: 'Anime bookmarks, plain and magnetic',
    h2: ['Magnetic bookmarks that ', 'snap', ' shut'],
    intro: 'Plain bookmarks are ₹30 each or 4 for ₹100. Magnetic ones fold over the page and snap shut: ₹100 each or 2 for ₹150.',
    kind: 'collectible', related: ['polaroids', 'posters'],
  },
  {
    slug: 'posters', label: 'Posters', chip: 'Posters',
    match: (p) => p.type === 'poster',
    title: 'Anime Posters India — 6 for ₹1000 | The Escape Door',
    meta: 'Anime posters at ₹200 each, or 6 for ₹1000: buy 5, get 1 free. 750 designs across anime and every other fandom.',
    h1: 'Anime posters: buy 5, get 1 free',
    h2: ['Six posters, one ', 'wall', ''],
    intro: 'Posters are ₹200 each. Put six in the cart and you pay for five — the sixth is on us.',
    kind: 'collectible', related: ['polaroids', 'badges'],
  },
  {
    slug: 'badges', label: 'Badges', chip: 'Badges',
    match: (p) => p.type === 'badge',
    title: 'Anime Badges — ₹50 Each, 5 for ₹200 | The Escape Door',
    meta: 'Anime pin badges at ₹50 each or 5 for ₹200. 400+ designs for bags, jackets and lanyards. Bulk custom badges for fests and clubs.',
    h1: 'Anime badges, 400+ designs',
    h2: ['Five badges, one ', 'bag', ''],
    intro: 'Pin badges at ₹50 each or 5 for ₹200 — for bags, jackets and lanyards. Clubs and fests can order custom badges in bulk.',
    kind: 'collectible', related: ['stickers', 'polaroids'],
  },
  {
    slug: 'stickers', label: 'Stickers', chip: 'Stickers',
    match: (p) => p.type === 'sticker',
    title: 'Anime Stickers — ₹30 Each | The Escape Door',
    meta: 'Anime stickers at ₹30 each for laptops, bottles and phones. Fan-inspired designs plus custom sticker runs from 15 pieces.',
    h1: 'Anime stickers for every surface',
    h2: ['Stick it ', 'everywhere', ''],
    intro: 'Stickers at ₹30 each for laptops, bottles and phones. Custom sticker runs start at 15 pieces.',
    kind: 'collectible', related: ['badges', 'bookmarks'],
  },
  {
    slug: 'cosplay-props', label: 'Cosplay props', chip: 'Cosplay',
    match: (p) => ['katana', 'cape', 'hat', 'cosplay'].includes(p.type),
    title: 'Cosplay Katanas & Capes India — LED & Basic | Escape Door',
    meta: 'Cosplay katanas: basic ₹1200–2000, LED ₹3000–4000. Capes ₹700–1000. Display and cosplay props, not real blades.',
    h1: 'Cosplay katanas and capes',
    h2: ['Basic vs ', 'LED', ': which katana?'],
    intro: 'Basic katanas run ₹1200–2000 and LED katanas ₹3000–4000, depending on the model; capes are ₹700–1000. These are display and cosplay props, not real blades — we confirm the exact piece and price with you on WhatsApp.',
    kind: 'prop', related: ['accessories', 'badges'],
    faq: [{ q: 'Basic or LED katana — what is the difference?', a: 'A basic katana (₹1200–2000) is a plain display prop. An LED katana (₹3000–4000) has a blade that lights up, which reads well on stage and in photos. Both are cosplay props, not real blades.' }],
  },
  {
    slug: 'accessories', label: 'Accessories', chip: 'Accessories',
    match: (p) => ['keychain', 'accessory', 'figurine'].includes(p.type),
    title: 'Anime Accessories — Keychains, Earrings | The Escape Door',
    meta: 'Anime keychains ₹150, earrings and accessories ₹250–800, figurines from ₹250. Fan-inspired designs for gifting and everyday carry.',
    h1: 'Anime accessories, keychains and figurines',
    h2: ['Small pieces, big ', 'fandom', ''],
    intro: 'Keychains at ₹150, earrings and accessories ₹250–800, and figurines from ₹250 — small fan-inspired pieces for gifting and everyday carry.',
    kind: 'prop', related: ['cosplay-props', 'badges'],
  },
]

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug)

/** The single best category for a product (breadcrumbs, PDP back-link). */
export function primaryCategory(p: Product): Category | undefined {
  if (p.type === 'tshirt') return categoryBySlug(fits(p).size === 1 && fits(p).has('oversized') ? 'oversized-t-shirts' : 't-shirts')
  return CATEGORIES.find((c) => c.match(p))
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Lowest numeric price a product can cost (for sort + price filter). null = on request. */
export function minPrice(p: Product): number | null {
  if (p.priceOnRequest) return null
  let lo: number | null = null
  for (const v of p.variants) {
    const n = typeof v.price === 'number' ? v.price : v.attrs?.range ? Number(v.attrs.range.split(/[–—-]/)[0]) : null
    if (n != null && Number.isFinite(n)) lo = lo == null ? n : Math.min(lo, n)
  }
  return lo ?? p.priceFrom
}

export function searchText(p: Product, collectionName = ''): string {
  return [p.name, p.designTitle, p.jpTitle, p.type, TYPE_LABEL[p.type][1], p.collection, collectionName, ...p.tags].join(' ').toLowerCase()
}
