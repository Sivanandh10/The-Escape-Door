// The Escape Door — seed catalogue. Owner: F2.
// Source of truth for prices: docs/source/NOTEBOOK_TRANSCRIPTION.md. Every design title is an
// original codename; collection names are text only. No reviews, no invented numbers.
// Used by repo.ts (fallback when Supabase is not configured), scripts/gen-seed-sql.mjs and
// the mockup generator. Node scripts: `import './src/lib/data/node-ts-hook.mjs'` first.
import type {
  Collection, FestEvent, InstaPost, Partnership, Product, ProductImage, ProductType, SiteSettings, Variant,
} from '../types'
import { apparelCustom, bundleRules, customRules, hoodieTiers, teeFits } from './rules'

export { apparelCustom, bundleRules, customRules, hoodieTiers, teeFits }

/** Fixed timestamp (no `new Date()` — Cache Components + deterministic seed). */
const SEEDED_AT = '2026-10-19T00:00:00.000Z'
export const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

// ---------------------------------------------------------------- collections
export const collections: Collection[] = [
  {
    slug: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', jp: '呪術廻戦', group: 'anime',
    accentA: '#4B2BFF', accentB: '#A78BFF', motif: 'smoke', order: 1, featured: true,
    tagline: 'Cursed static, pressed in ink.',
    blurb: 'Violet smoke, paper talismans and type that crackles like a bad signal. Original prints for fans who read every panel twice.',
  },
  {
    slug: 'attack-on-titan', name: 'Attack on Titan', jp: '進撃の巨人', group: 'anime',
    accentA: '#A39780', accentB: '#C8102E', motif: 'walls', order: 2, featured: true,
    tagline: 'Everything past the wall.',
    blurb: 'Stone grey, blood red and wind-torn cloth. Heavy, quiet designs built from rings of wall and a red horizon.',
  },
  {
    slug: 'demon-slayer', name: 'Demon Slayer', jp: '鬼滅の刃', group: 'anime',
    accentA: '#FF6A13', accentB: '#12A5A0', motif: 'flames', order: 3, featured: true,
    tagline: 'Flame on one side, tide on the other.',
    blurb: 'Brush-stroke fire meets brush-stroke water. Prints, props and katanas for the fan who picks a side and then wears both.',
  },
  {
    slug: 'one-piece', name: 'One Piece', jp: 'ワンピース', group: 'anime',
    accentA: '#1C6FE0', accentB: '#F2C230', motif: 'waves', order: 4, featured: true,
    tagline: 'Sea blue, sun yellow, no map.',
    blurb: 'Rolling waves, compass roses and sun-bleached colour. Original designs for long voyages and longer fest days.',
  },
  {
    slug: 'naruto', name: 'Naruto', jp: 'ナルト', group: 'anime',
    accentA: '#FF7A00', accentB: '#1B2A4A', motif: 'spiral', order: 5, featured: true,
    tagline: 'Orange hour, spiral wind.',
    blurb: 'Loud orange on night navy, with spirals and scattered leaves. Original prints for the fan who never gave up on the arc.',
  },
  {
    slug: 'beyond-anime', name: 'Beyond Anime', jp: 'その先へ', group: 'beyond',
    accentA: '#FFB8DE', accentB: '#F4EFE6', motif: 'ribbons', order: 6, featured: true,
    tagline: 'One more door, every other fandom.',
    blurb: 'Book quotes, stadium-tour sparkle, wizard-school candlelight, K-pop encores, pit-lane speed and animated-film warmth. Original designs, one door.',
    subFandoms: ['Bookish', 'Jane Austen', 'Swiftie', 'Harry Potter', 'K-pop', 'F1', 'Pixar'],
  },
]

const COLLECTION_NAME: Record<string, string> = Object.fromEntries(collections.map((c) => [c.slug, c.name]))

// ---------------------------------------------------------------- palette blocks
const BLOCK = { lav: '#C9B8FF', pink: '#FFB8DE', volt: '#FFE14D' } as const
const COLOUR_NAME: Record<string, string> = {
  '#C9B8FF': 'lavender', '#FFB8DE': 'pink', '#FFE14D': 'yellow',
  '#4B2BFF': 'indigo', '#A78BFF': 'violet', '#A39780': 'stone grey', '#C8102E': 'red',
  '#FF6A13': 'orange', '#12A5A0': 'teal', '#1C6FE0': 'sea blue', '#F2C230': 'straw yellow',
  '#FF7A00': 'orange', '#1B2A4A': 'navy',
}
const colourOf = (hex: string) => COLOUR_NAME[hex] ?? 'colour'

// ---------------------------------------------------------------- builders
interface Base {
  design: string
  jp?: string
  collection: string
  /** e.g. "fan-inspired Jujutsu Kaisen" / "Swiftie-inspired" — used in alt text */
  inspo?: string
  /** one honest sentence about the original art */
  line: string
  block: string
  tags?: string[]
  featured?: boolean
  dropOfWeek?: boolean
  stock?: Product['stock']
}

const kebab = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const inspoOf = (b: Base) => b.inspo ?? `fan-inspired ${COLLECTION_NAME[b.collection]}`

function img(slug: string, side: 'front' | 'back', alt: string): ProductImage {
  return { src: `/mockups/${slug}-${side}.webp`, alt, side, sample: true }
}

function variant(productId: string, key: string, label: string, price: number | null, attrs?: Record<string, string>): Variant {
  return { id: `${productId}--${key}`, label, price, ...(attrs ? { attrs } : {}) }
}

interface Shape {
  type: ProductType
  /** product-type noun used in names + slugs, e.g. "Oversized T-Shirt" */
  noun: string
  /** lower-case noun for alt text, e.g. "oversized t-shirt" */
  altNoun: string
  apparel?: boolean
  variants: (id: string) => Variant[]
  description: (b: Base) => string
  bundleRuleId?: string
  customizable: boolean
  priceOnRequest?: boolean
  stock: Product['stock']
  extraTags?: string[]
}

function make(b: Base, s: Shape): Product {
  const name = `${b.design} ${s.noun}`
  const slug = kebab(name)
  const id = `p-${slug}`
  const variants = s.variants(id)
  const prices = variants.map((v) => v.price ?? (v.attrs?.range ? Number(v.attrs.range.split('–')[0]) : null)).filter((p): p is number => p !== null)
  const priceFrom = s.priceOnRequest ? null : prices.length ? Math.min(...prices) : null
  const colour = colourOf(b.block)
  const credit = `${inspoOf(b)} design by The Escape Door`
  const images: ProductImage[] = s.apparel
    ? [
        img(slug, 'front', `${b.design} ${s.altNoun} in black, front view: ${credit}`),
        img(slug, 'back', `${b.design} ${s.altNoun} in black, back view: ${credit}`),
      ]
    : [img(slug, 'front', `${b.design} ${s.altNoun} on a ${colour} panel: ${credit}`)]
  return {
    id, slug, name, type: s.type, collection: b.collection,
    tags: Array.from(new Set([...(s.extraTags ?? []), ...(b.tags ?? [])])),
    designTitle: b.design, ...(b.jp ? { jpTitle: b.jp } : {}),
    description: s.description(b),
    images, variants,
    ...(s.apparel ? { sizes: APPAREL_SIZES } : {}),
    priceFrom,
    ...(s.priceOnRequest ? { priceOnRequest: true } : {}),
    ...(s.bundleRuleId ? { bundleRuleId: s.bundleRuleId } : {}),
    customizable: s.customizable,
    featured: !!b.featured,
    dropOfWeek: !!b.dropOfWeek,
    stock: b.stock ?? s.stock,
    colorBlock: b.block,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }
}

const SIZE_LINE = 'Sizes XS–XXL — ask us on WhatsApp for the size chart before you order.'

const oversizedTee = (b: Base) => make(b, {
  type: 'tshirt', noun: 'Oversized T-Shirt', altNoun: 'oversized t-shirt', apparel: true, customizable: true, stock: 'made-to-order',
  extraTags: ['oversized', 'apparel'],
  variants: (id) => [variant(id, 'oversized', 'Oversized', 800, { fit: 'oversized' })],
  description: (x) => `${x.line} Printed on a black oversized drop-shoulder tee: back print up to 12×15 in, front hit up to 4×4 in. ₹800. ${SIZE_LINE}`,
})

const fitTee = (b: Base) => make(b, {
  type: 'tshirt', noun: 'T-Shirt', altNoun: 't-shirt', apparel: true, customizable: true, stock: 'made-to-order',
  extraTags: ['oversized', 'regular', 'baby-tee', 'apparel'],
  variants: (id) => teeFits.map((f) => variant(id, f.id, f.label, f.price, { fit: f.id })),
  description: (x) => `${x.line} Pick your fit: oversized ₹800, regular ₹600 or baby tee ₹400 — same original print on a black tee. ${SIZE_LINE}`,
})

const hoodie = (b: Base) => make(b, {
  type: 'hoodie', noun: 'Hoodie', altNoun: 'hoodie', apparel: true, customizable: true, stock: 'made-to-order',
  extraTags: ['hoodie', 'gsm', 'apparel'],
  variants: (id) => hoodieTiers.map((t) => variant(id, t.id, `${t.code} ${t.name} · ${t.gsmLabel}`, t.price, { gsm: `${t.gsmMin}–${t.gsmMax}`, level: String(t.level) })),
  description: (x) => `${x.line} Priced by fabric weight: 280–330 GSM ₹1200, 330–380 GSM ₹1500, 380–430 GSM ₹1800 and 430–600 GSM ₹2500. Higher GSM means a thicker, warmer hoodie. ${SIZE_LINE}`,
})

const polaroids = (b: Base) => make(b, {
  type: 'polaroid', noun: 'Polaroid Prints', altNoun: 'polaroid-style prints laid out', customizable: true, stock: 'in',
  bundleRuleId: 'polaroid-3for100', extraTags: ['polaroid', 'collectible'],
  variants: (id) => [variant(id, 'single', 'Single print', 50)],
  description: (x) => `${x.line} Polaroid-style prints at ₹50 each — any 3 for ₹100, and you can mix designs and arcs to make the set. Custom prints from 20 pieces.`,
})

const poster = (b: Base) => make(b, {
  type: 'poster', noun: 'Poster', altNoun: 'poster', customizable: false, stock: 'in',
  bundleRuleId: 'poster-buy5get1', extraTags: ['poster', 'wall'],
  variants: (id) => [variant(id, 'single', 'Poster', 200)],
  description: (x) => `${x.line} ₹200 each, or 6 for ₹1000 — buy 5, get 1 free, mixed designs allowed. Size and paper are confirmed with you on WhatsApp.`,
})

const bookmark = (b: Base) => make(b, {
  type: 'bookmark', noun: 'Bookmark', altNoun: 'bookmark', customizable: true, stock: 'in',
  bundleRuleId: 'bookmark-plain-4for100', extraTags: ['bookmark', 'collectible'],
  variants: (id) => [
    variant(id, 'plain', 'Plain', 30, { kind: 'plain' }),
    variant(id, 'magnetic', 'Magnetic', 100, { kind: 'magnetic' }),
  ],
  description: (x) => `${x.line} Plain ₹30 (4 for ₹100) or magnetic ₹100 (2 for ₹150) — the magnetic one folds over the page and snaps shut.`,
})

const badge = (b: Base) => make(b, {
  type: 'badge', noun: 'Badge', altNoun: 'pin badge', customizable: true, stock: 'in',
  bundleRuleId: 'badge-5for200', extraTags: ['badge', 'collectible'],
  variants: (id) => [variant(id, 'single', 'Badge', 50)],
  description: (x) => `${x.line} ₹50 each or 5 for ₹200 — mix any designs for a bag, jacket or lanyard.`,
})

const sticker = (b: Base) => make(b, {
  type: 'sticker', noun: 'Sticker', altNoun: 'sticker', customizable: true, stock: 'in',
  extraTags: ['sticker', 'collectible'],
  variants: (id) => [
    variant(id, 'single', 'Single sticker', 30, { pack: 'single' }),
    variant(id, 'pack', 'Pack (count TBC)', 100, { pack: 'pack' }),
  ],
  description: (x) => `${x.line} ₹30 for a single sticker. The ₹100 pack is also available — message us for how many stickers are in it this week.`,
})

const keychain = (b: Base) => make(b, {
  type: 'keychain', noun: 'Keychain', altNoun: 'keychain', customizable: false, stock: 'in',
  extraTags: ['keychain', 'accessory'],
  variants: (id) => [variant(id, 'single', 'Keychain', 150)],
  description: (x) => `${x.line} ₹150 each.`,
})

const katana = (b: Base, kind: 'basic' | 'led') => make(b, {
  type: 'katana', noun: kind === 'led' ? 'LED Cosplay Katana' : 'Cosplay Katana', altNoun: kind === 'led' ? 'LED cosplay katana' : 'cosplay katana',
  customizable: false, stock: 'in', extraTags: ['katana', 'cosplay', 'prop', kind === 'led' ? 'led' : 'basic'],
  variants: (id) => kind === 'led'
    ? [variant(id, 'led', 'LED', null, { range: '3000–4000' })]
    : [variant(id, 'basic', 'Basic', null, { range: '1200–2000' })],
  description: (x) => kind === 'led'
    ? `${x.line} LED katanas run ₹3000–4000 depending on the model; we confirm the exact piece and price on WhatsApp. A cosplay and display prop, not a real blade.`
    : `${x.line} Basic katanas run ₹1200–2000 depending on the model; we confirm the exact piece and price on WhatsApp. A cosplay and display prop, not a real blade.`,
})

const cape = (b: Base) => make(b, {
  type: 'cape', noun: 'Cape', altNoun: 'cosplay cape', customizable: false, stock: 'in',
  extraTags: ['cape', 'cosplay'],
  variants: (id) => [variant(id, 'cape', 'Cape', null, { range: '700–1000' })],
  description: (x) => `${x.line} Capes run ₹700–1000 depending on length and fabric; we confirm the exact piece and price on WhatsApp.`,
})

const figurine = (b: Base) => make(b, {
  type: 'figurine', noun: 'Figurine', altNoun: 'figurine', customizable: false, stock: 'in',
  extraTags: ['figurine', 'collectible'],
  variants: (id) => [
    variant(id, 'standard', 'Standard', null, { range: '250–1200' }),
    variant(id, 'premium', 'Premium', 2500, { tier: 'premium' }),
  ],
  description: (x) => `${x.line} Standard figurines run ₹250–1200 by size; select premium pieces are ₹2500. Which figures are in stock changes often — ask on WhatsApp.`,
})

const earrings = (b: Base) => make(b, {
  type: 'accessory', noun: 'Earrings', altNoun: 'earrings', customizable: false, stock: 'in',
  extraTags: ['earrings', 'accessory'],
  variants: (id) => [variant(id, 'pair', 'Pair', null, { range: '250–800' })],
  description: (x) => `${x.line} Earrings and accessories run ₹250–800 by piece; we confirm the exact price on WhatsApp.`,
})

const onRequest = (b: Base, type: ProductType, noun: string, altNoun: string, tags: string[], apparel = false) => make(b, {
  type, noun, altNoun, apparel, customizable: type === 'tshirt', stock: 'made-to-order', priceOnRequest: true,
  extraTags: tags,
  variants: (id) => [variant(id, 'standard', 'Standard', null)],
  description: (x) => `${x.line} Price on request — message us on WhatsApp and we will quote it.`,
})

// ---------------------------------------------------------------- products
const JJK = 'jujutsu-kaisen', AOT = 'attack-on-titan', DS = 'demon-slayer', OP = 'one-piece', NAR = 'naruto', BEY = 'beyond-anime'

const baseProducts: Product[] = [
  // ── Jujutsu Kaisen 呪術廻戦
  oversizedTee({ design: 'Cursed Static', jp: '呪いのノイズ', collection: JJK, block: BLOCK.lav, dropOfWeek: true, featured: true, tags: ['jjk', 'drop'],
    line: 'A back print of violet smoke breaking into scan-line static, with the title stacked in tall condensed caps.' }),
  fitTee({ design: 'Talisman Rain', jp: '札の雨', collection: JJK, block: '#A78BFF', tags: ['jjk'],
    line: 'Paper talisman strips falling through a screentone sky, drawn as an original ink panel.' }),
  hoodie({ design: 'Violet Smoke', jp: '紫煙', collection: JJK, block: '#4B2BFF', tags: ['jjk'],
    line: 'Drifting cursed-energy smoke wraps the back of the hoodie in indigo and violet.' }),
  polaroids({ design: 'Talisman Strip', jp: '護符', collection: JJK, block: BLOCK.lav, featured: true, tags: ['jjk'],
    line: 'Original talisman-and-smoke panels, framed polaroid style.' }),
  poster({ design: 'Sealed Panel', jp: '封印', collection: JJK, block: BLOCK.volt, tags: ['jjk'],
    line: 'A single manga panel bound shut with paper seals and speed lines.' }),
  bookmark({ design: 'Paper Talisman', jp: 'お札', collection: JJK, block: BLOCK.pink, tags: ['jjk'],
    line: 'Shaped like a paper talisman strip, inked in indigo.' }),
  badge({ design: 'Static Eye', collection: JJK, block: BLOCK.lav, tags: ['jjk'],
    line: 'A round badge of violet static and a single inked eye-glint.' }),
  sticker({ design: 'Smoke Sigil', collection: JJK, block: '#A78BFF', tags: ['jjk'],
    line: 'An original smoke-curl sigil, die-cut.' }),
  keychain({ design: 'Talisman', collection: JJK, block: BLOCK.lav, tags: ['jjk'],
    line: 'A paper-talisman shaped keychain in indigo and paper white.' }),
  earrings({ design: 'Talisman Drop', collection: JJK, block: BLOCK.pink, tags: ['jjk'],
    line: 'Light drop earrings with a small talisman-strip charm.' }),
  figurine({ design: 'Desk Guardian', collection: JJK, block: '#A78BFF', tags: ['jjk'],
    line: 'Fan figurines for your desk or shelf.' }),

  // ── Attack on Titan 進撃の巨人
  oversizedTee({ design: 'Beyond the Wall', jp: '壁の向こう', collection: AOT, block: '#A39780', featured: true, tags: ['aot'],
    line: 'Three rings of wall drawn from above, with a red horizon cutting across the back.' }),
  fitTee({ design: 'Wind-Torn Cloak', jp: '風の外套', collection: AOT, block: BLOCK.volt, tags: ['aot'],
    line: 'Cloth ripping in a crosswind, inked in stone grey with one red stroke.' }),
  hoodie({ design: 'Stone Rampart', jp: '城壁', collection: AOT, block: '#A39780', tags: ['aot'],
    line: 'A wall of stacked stone blocks rising up the back, shaded in screentone.' }),
  polaroids({ design: 'Wall Line', jp: '壁', collection: AOT, block: BLOCK.lav, tags: ['aot'],
    line: 'Original wall-and-sky panels in grey and red, framed polaroid style.' }),
  poster({ design: 'Red Horizon', jp: '赤い地平', collection: AOT, block: '#C8102E', tags: ['aot'],
    line: 'A red sky over a ring of wall, drawn as a full-bleed manga splash page.' }),
  bookmark({ design: 'Cloth and Wind', collection: AOT, block: BLOCK.pink, tags: ['aot'],
    line: 'A ribbon of wind-torn cloth running the length of the bookmark.' }),
  badge({ design: 'Rampart Ring', collection: AOT, block: BLOCK.volt, tags: ['aot'],
    line: 'Concentric wall rings on a stone-grey badge.' }),
  sticker({ design: 'Wall Crack', collection: AOT, block: '#A39780', tags: ['aot'],
    line: 'A cracked stone block with a sliver of red sky behind it.' }),
  cape({ design: 'Wall Runner', collection: AOT, block: '#A39780', tags: ['aot'],
    line: 'A long field cape for your cosplay, cut to move when you do.' }),

  // ── Demon Slayer 鬼滅の刃
  oversizedTee({ design: 'Flame Breath Ribbon', jp: '炎のリボン', collection: DS, block: '#FF6A13', featured: true, tags: ['demon-slayer'],
    line: 'A ribbon of brush-stroke flame curling across the back, edged in ink.' }),
  fitTee({ design: 'Tidewater Edge', jp: '水の刃', collection: DS, block: '#12A5A0', tags: ['demon-slayer'],
    line: 'A single blade-stroke of teal water breaking into brush waves.' }),
  hoodie({ design: 'Ember Night', jp: '残り火', collection: DS, block: BLOCK.volt, tags: ['demon-slayer'],
    line: 'Embers drifting up a night-black hoodie, in orange and teal.' }),
  polaroids({ design: 'Ember and Tide', jp: '火と水', collection: DS, block: BLOCK.pink, tags: ['demon-slayer'],
    line: 'Fire panels and water panels, framed polaroid style — collect both sides.' }),
  poster({ design: 'Ink Blade', jp: '墨の刃', collection: DS, block: BLOCK.volt, tags: ['demon-slayer'],
    line: 'One sweeping ink stroke shaped like a blade, splitting flame from water.' }),
  bookmark({ design: 'Brush Wave', collection: DS, block: '#12A5A0', tags: ['demon-slayer'],
    line: 'Layered brush waves in teal, with a flame tip at the top.' }),
  badge({ design: 'Flame Ring', collection: DS, block: '#FF6A13', tags: ['demon-slayer'],
    line: 'A ring of brush flame on an orange badge.' }),
  sticker({ design: 'Water Brush', collection: DS, block: BLOCK.lav, tags: ['demon-slayer'],
    line: 'A curling teal water stroke, die-cut.' }),
  katana({ design: 'Ember Edge', collection: DS, block: '#FF6A13', tags: ['demon-slayer'],
    line: 'A basic cosplay katana for your fest look.' }, 'basic'),
  katana({ design: 'Tide Glow', collection: DS, block: '#12A5A0', featured: true, tags: ['demon-slayer'],
    line: 'A cosplay katana with a built-in LED blade glow for night photos and stage walks.' }, 'led'),
  earrings({ design: 'Ember Hoop', collection: DS, block: BLOCK.volt, tags: ['demon-slayer'],
    line: 'Hoop earrings with a small flame charm.' }),
  onRequest({ design: 'Flame and Tide Half-n-Half', jp: '半々', collection: DS, block: BLOCK.pink, tags: ['demon-slayer', 'half-n-half'],
    line: 'One half flame, one half tide — two original prints split down the middle of a black tee.' }, 'tshirt', 'Tee', 'half-n-half tee', ['half-n-half', 'apparel'], true),

  // ── One Piece ワンピース
  oversizedTee({ design: 'Open Sea Chart', jp: '海図', collection: OP, block: '#1C6FE0', tags: ['one-piece'],
    line: 'A hand-drawn sea chart with a compass rose and rolling waves across the back.' }),
  fitTee({ design: 'Sun on Deck', jp: '甲板の太陽', collection: OP, block: '#F2C230', tags: ['one-piece'],
    line: 'A big straw-yellow sun over a wooden deck, in thick ink lines.' }),
  hoodie({ design: 'Compass Rose', jp: '羅針', collection: OP, block: BLOCK.lav, featured: true, tags: ['one-piece'],
    line: 'An oversized compass rose spinning on the back, sea blue on black.' }),
  polaroids({ design: 'Harbour Log', jp: '航海日誌', collection: OP, block: '#F2C230', tags: ['one-piece'],
    line: 'Original harbour, wave and compass panels, framed polaroid style.' }),
  poster({ design: 'Tide Chart', jp: '潮', collection: OP, block: '#1C6FE0', tags: ['one-piece'],
    line: 'A full-page tide chart in sea blue and yellow, drawn like an old map.' }),
  bookmark({ design: 'Rolling Wave', collection: OP, block: BLOCK.volt, tags: ['one-piece'],
    line: 'Rolling waves stacked down the bookmark in blue and paper white.' }),
  badge({ design: 'Compass', collection: OP, block: '#F2C230', tags: ['one-piece'],
    line: 'A compass rose on a straw-yellow badge.' }),
  sticker({ design: 'Sea Spray', collection: OP, block: BLOCK.pink, tags: ['one-piece'],
    line: 'A burst of sea spray and a tiny sun, die-cut.' }),
  figurine({ design: 'Deck Crew', collection: OP, block: '#1C6FE0', tags: ['one-piece'],
    line: 'Fan figurines for your desk or shelf.' }),
  onRequest({ design: 'Sunny Straw', collection: OP, block: '#F2C230', tags: ['one-piece', 'cosplay'],
    line: 'A woven straw sun hat for cosplay and sunny fest days.' }, 'hat', 'Cosplay Hat', 'cosplay hat', ['hat', 'cosplay']),

  // ── Naruto ナルト
  oversizedTee({ design: 'Spiral Wind', jp: '渦の風', collection: NAR, block: '#FF7A00', featured: true, tags: ['naruto'],
    line: 'A spiral of wind spinning out across the back in loud orange on black.' }),
  fitTee({ design: 'Leaf Scatter', jp: '木の葉', collection: NAR, block: BLOCK.volt, tags: ['naruto'],
    line: 'Leaves scattering in a gust, inked in orange and night navy.' }),
  hoodie({ design: 'Night Scroll', jp: '夜の巻物', collection: NAR, block: '#1B2A4A', tags: ['naruto'],
    line: 'An unrolled scroll down the back with a spiral seal, navy on black.' }),
  polaroids({ design: 'Scroll Seal', jp: '巻物', collection: NAR, block: BLOCK.lav, tags: ['naruto'],
    line: 'Original scroll, spiral and leaf panels, framed polaroid style.' }),
  poster({ design: 'Orange Hour', jp: '夕焼け', collection: NAR, block: '#FF7A00', tags: ['naruto'],
    line: 'An orange sunset over rooftops, with a spiral sun.' }),
  bookmark({ design: 'Scroll', collection: NAR, block: BLOCK.pink, tags: ['naruto'],
    line: 'A rolled-scroll bookmark with a spiral seal at the top.' }),
  badge({ design: 'Spiral', collection: NAR, block: '#FF7A00', tags: ['naruto'],
    line: 'A single wind spiral on an orange badge.' }),
  sticker({ design: 'Leaf Whirl', collection: NAR, block: BLOCK.volt, tags: ['naruto'],
    line: 'A whirl of leaves, die-cut.' }),
  keychain({ design: 'Spiral', collection: NAR, block: '#FF7A00', tags: ['naruto'],
    line: 'A spiral-wind keychain in orange and navy.' }),
  cape({ design: 'Night Wind', collection: NAR, block: '#1B2A4A', tags: ['naruto'],
    line: 'A navy cosplay cape with a long, wind-catching cut.' }),

  // ── Beyond Anime その先へ (fandom names live in tags only)
  fitTee({ design: 'Regency Letters', collection: BEY, block: BLOCK.pink, inspo: 'Jane Austen-inspired bookish', tags: ['bookish', 'jane-austen'],
    line: 'Handwritten Regency-era letters and a pressed flower, for readers who live in the 1810s.' }),
  bookmark({ design: 'Marginalia', collection: BEY, block: BLOCK.lav, inspo: 'bookish', tags: ['bookish'],
    line: 'Scribbled margin notes and underlines, for the annotators.' }),
  fitTee({ design: 'Sparkle Era', collection: BEY, block: BLOCK.lav, inspo: 'Swiftie-inspired', featured: true, tags: ['swiftie'],
    line: 'Sequins, friendship-bracelet beads and a stage-light sparkle, drawn in ink.' }),
  polaroids({ design: 'Glitter Notes', collection: BEY, block: BLOCK.pink, inspo: 'Swiftie-inspired', tags: ['swiftie'],
    line: 'Glitter, setlist scribbles and bracelet beads, framed polaroid style.' }),
  poster({ design: 'Castle by Candlelight', collection: BEY, block: BLOCK.volt, inspo: 'wizard-school-inspired', tags: ['harry-potter', 'wizarding'],
    line: 'A castle on a hill under floating candles, drawn as an original ink plate.' }),
  bookmark({ design: 'Candle and Quill', collection: BEY, block: '#F4EFE6', inspo: 'wizard-school-inspired', tags: ['harry-potter', 'wizarding', 'bookish'],
    line: 'A quill and a dripping candle on parchment.' }),
  fitTee({ design: 'Encore', collection: BEY, block: BLOCK.pink, inspo: 'K-pop-inspired', tags: ['k-pop'],
    line: 'A sea of glowing lightsticks and the word ENCORE in tall condensed caps.' }),
  polaroids({ design: 'Lightstick Glow', collection: BEY, block: BLOCK.lav, inspo: 'K-pop-inspired', tags: ['k-pop'],
    line: 'Concert-glow panels in pastel neon, framed polaroid style.' }),
  fitTee({ design: 'Pit Lane', collection: BEY, block: BLOCK.volt, inspo: 'F1-inspired', tags: ['f1'],
    line: 'Speed lines, a chequered strip and a pit-board countdown, in ink and yellow.' }),
  poster({ design: 'Apex Corner', collection: BEY, block: '#FFE14D', inspo: 'F1-inspired', tags: ['f1'],
    line: 'A hairpin corner from above, with tyre-smoke speed lines.' }),
  poster({ design: 'Toy Box Afternoon', collection: BEY, block: BLOCK.pink, inspo: 'animated-film-inspired', tags: ['pixar', 'animated-films'],
    line: 'An original toy box spilling marbles and paper rockets in warm afternoon light.' }),
  onRequest({ design: 'Reading Room', collection: BEY, block: '#F4EFE6', inspo: 'bookish', tags: ['bookish'],
    line: 'A canvas tote for books, sketchbooks and fest hauls.' }, 'tote', 'Tote Bag', 'tote bag', ['tote']),
  onRequest({ design: 'Margin Notes', collection: BEY, block: BLOCK.lav, inspo: 'bookish', tags: ['bookish'],
    line: 'Fandom stationery — notebooks and paper goods; the set changes with each batch.' }, 'stationery', 'Stationery Set', 'stationery set', ['stationery']),
]

/** Apparel gets a 3rd "detail" slide: the companion polaroid/poster art from the same arc (best tag match first). */
const COMPANION_TYPES: ProductType[] = ['polaroid', 'poster']
function withDetail(p: Product, all: Product[]): Product {
  if (p.type !== 'tshirt' && p.type !== 'hoodie') return p
  const pool = all.filter((q) => q.collection === p.collection && COMPANION_TYPES.includes(q.type) && q.images[0])
  if (!pool.length) return p
  const score = (q: Product) => q.tags.filter((t) => p.tags.includes(t) && !['polaroid', 'poster', 'collectible', 'wall'].includes(t)).length * 10 - COMPANION_TYPES.indexOf(q.type)
  const mate = [...pool].sort((a, b) => score(b) - score(a))[0]
  const detail: ProductImage = { src: mate.images[0].src, alt: `Companion art from the same arc: ${mate.name}, an original ${inspoLabel(p)} design by The Escape Door`, side: 'detail', sample: true }
  return { ...p, images: [...p.images, detail] }
}
const inspoLabel = (p: Product) => (p.collection === 'beyond-anime' ? 'fan-inspired' : `fan-inspired ${COLLECTION_NAME[p.collection] ?? p.collection}`)

export const products: Product[] = baseProducts.map((p) => withDetail(p, baseProducts))

// ---------------------------------------------------------------- events
export const events: FestEvent[] = [
  { id: 'ev-vit-bhopal', name: 'VIT Bhopal stall', venue: 'VIT Bhopal', city: 'Bhopal', startDate: null, endDate: null, dateLabel: '21–28 Feb · dates to be confirmed', confirmed: false, kind: 'stall', status: 'upcoming' },
  { id: 'ev-iit-ropar', name: 'IIT Ropar stall', venue: 'IIT Ropar', city: 'Rupnagar', startDate: null, endDate: null, dateLabel: '13–15 Mar · dates to be confirmed', confirmed: false, kind: 'stall', status: 'upcoming' },
  { id: 'ev-iit-indore', name: 'IIT Indore stall', venue: 'IIT Indore', city: 'Indore', startDate: null, endDate: null, dateLabel: '14–16 Mar · dates to be confirmed', confirmed: false, kind: 'stall', status: 'upcoming' },
  { id: 'ev-popup-surat', name: 'Surat pop-up', venue: '', city: 'Surat', startDate: null, endDate: null, dateLabel: 'Past pop-up', confirmed: false, kind: 'popup', status: 'past' },
  { id: 'ev-popup-bhopal', name: 'Bhopal pop-up', venue: '', city: 'Bhopal', startDate: null, endDate: null, dateLabel: 'Past pop-up', confirmed: false, kind: 'popup', status: 'past' },
  { id: 'ev-popup-kolkata', name: 'Kolkata pop-up', venue: '', city: 'Kolkata', startDate: null, endDate: null, dateLabel: 'Past pop-up', confirmed: false, kind: 'popup', status: 'past' },
  { id: 'ev-popup-kolhapur', name: 'Kolhapur pop-up', venue: '', city: 'Kolhapur', startDate: null, endDate: null, dateLabel: 'Past pop-up', confirmed: false, kind: 'popup', status: 'past' },
]

// ---------------------------------------------------------------- partnerships (BRIEF credibility list — exactly)
export const partnerships: Partnership[] = [
  { id: 'pt-thomso', fest: 'Thomso', institution: 'IIT Roorkee', years: '3×', role: 'Fandom Partner', detail: 'Fandom Partner three times', order: 1 },
  { id: 'pt-fluxus', fest: 'Fluxus', institution: 'IIT Indore', years: '2024', role: 'Fest partner', order: 2 },
  { id: 'pt-zeitgeist', fest: 'Zeitgeist', institution: 'IIT Ropar', years: '2026', role: 'Fandom Partner', order: 3 },
  { id: 'pt-blithchron', fest: 'Blithchron', institution: 'IIT Gandhinagar', years: '2026', role: 'Fandom Partner', order: 4 },
  { id: 'pt-abhivyakti', fest: 'Abhivyakti', institution: '', years: '2025', role: 'Fest partner', order: 5 },
  { id: 'pt-ignus', fest: "Ignus'25", institution: 'IIT Jodhpur', years: '2025', role: 'Gifting Partner', order: 6 },
  { id: 'pt-coscon', fest: 'CosCon', institution: '', years: '', role: 'Cosplay competition', detail: '₹50K in prizes, with hampers by The Escape Door', order: 7 },
  { id: 'pt-alcher-con', fest: 'Alcher Con at Alcheringa', institution: 'IIT Guwahati', years: '', role: 'Cosplay competition', detail: '₹20K+ in prizes', order: 8 },
  { id: 'pt-cos-matsuri', fest: 'Cos-Matsuri', institution: '', years: '', role: 'Online cosplay event', detail: 'Online', order: 9 },
]

// ---------------------------------------------------------------- settings
export const settings: SiteSettings = {
  heroKicker: 'Original anime merch · India',
  heroTitle: 'Anime merch, drawn like a living manga volume',
  heroSub: 'Oversized tees, hoodies, polaroids, posters and props — original fan-inspired designs at student prices, custom-made on demand. Pick your arc.',
  bannerText: '3 polaroids ₹100 · 6 posters ₹1000 · custom orders open',
  tickerWords: ['YOU ARE MY SPECIAL', 'PICK YOUR ARC', 'ドン', 'CUSTOM MADE', 'OVERSIZED ₹800', '3 POLAROIDS ₹100', '新作', 'FANDOM PARTNER'],
  whatsapp: '',
  instagram: 'https://www.instagram.com/escapedoor.in',
}

/** Admin-managed. Empty by default: the S13 strip shows a designed empty state + follow CTA. */
export const instaPosts: InstaPost[] = []
