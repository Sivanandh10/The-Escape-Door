// Pricing unit tests. Run from the repo root (Node >= 22.15, native TS type-stripping, no deps):
//   node --test src/lib/pricing.test.ts
// Verified on Node 24.14: 17/17 pass. The one-time MODULE_TYPELESS_PACKAGE_JSON warning is harmless.
// The hook lets Node resolve the bundler-style extensionless imports inside pricing.ts.
import test from 'node:test'
import assert from 'node:assert/strict'
import './data/node-ts-hook.mjs'
import type { CartItem, ProductType } from './types'

type Pricing = typeof import('./pricing')
type Seed = typeof import('./data/seed')
// Dynamic imports run after the hook above is registered (static imports would resolve first).
const pricingPath = './pricing' + '.ts'
const seedPath = './data/seed' + '.ts'
const P = (await import(pricingPath)) as Pricing
const S = (await import(seedPath)) as Seed
const { computeTotals, formatINR, formatINRRange, customQuote, minQtyFor, productPriceLabel, variantPriceLabel, parseRange } = P

let n = 0
function item(type: ProductType, unitPrice: number | null, qty: number, extra: Partial<CartItem> = {}): CartItem {
  n++
  return {
    key: `k${n}`, productId: `p${n}`, slug: `s${n}`, name: `Item ${n}`, type, collection: 'jujutsu-kaisen',
    variantId: `p${n}--single`, variantLabel: 'Single', unitPrice, qty, image: '/x.webp', ...extra,
  }
}

test('formatINR uses ₹ and Indian grouping', () => {
  assert.equal(formatINR(0), '₹0')
  assert.equal(formatINR(50), '₹50')
  assert.equal(formatINR(1200), '₹1,200')
  assert.equal(formatINR(100000), '₹1,00,000')
  assert.equal(formatINR(1234567), '₹12,34,567')
  assert.equal(formatINR(99.6), '₹100')
  assert.equal(formatINRRange(1200, 2000), '₹1,200–2,000')
  assert.equal(formatINRRange(800, 800), '₹800')
  assert.deepEqual(parseRange('1200–2000'), [1200, 2000])
  assert.deepEqual(parseRange('700-1000'), [700, 1000])
  assert.equal(parseRange('abc'), null)
})

test('polaroids: 3 for ₹100', () => {
  assert.equal(computeTotals([item('polaroid', 50, 1)]).total, 50)
  const t3 = computeTotals([item('polaroid', 50, 3)])
  assert.equal(t3.total, 100)
  assert.equal(t3.savings, 50)
  assert.deepEqual(t3.applied, [{ ruleId: 'polaroid-3for100', label: '3 polaroids for ₹100', saving: 50 }])
  assert.equal(computeTotals([item('polaroid', 50, 4)]).total, 150)
  assert.equal(computeTotals([item('polaroid', 50, 6)]).total, 200)
  assert.equal(computeTotals([item('polaroid', 50, 7)]).total, 250)
})

test('polaroids mix across designs and lines; line savings sum to total saving', () => {
  const t = computeTotals([item('polaroid', 50, 1), item('polaroid', 50, 1), item('polaroid', 50, 1)])
  assert.equal(t.total, 100)
  assert.equal(t.lines.reduce((s, l) => s + l.saving, 0), 50)
  assert.equal(t.lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0), 100)
  for (const l of t.lines) assert.ok(Number.isInteger(l.saving))
})

test('posters: buy 5 get 1 free (6 for ₹1000)', () => {
  assert.equal(computeTotals([item('poster', 200, 5)]).total, 1000)
  assert.equal(computeTotals([item('poster', 200, 6)]).total, 1000)
  assert.equal(computeTotals([item('poster', 200, 7)]).total, 1200)
  assert.equal(computeTotals([item('poster', 200, 12)]).total, 2000)
  const t = computeTotals([item('poster', 200, 5)])
  assert.ok(t.hints.some((h) => /1 more poster — it's free/.test(h)), t.hints.join(' | '))
})

test('bookmarks: plain 4 for ₹100, magnetic 2 for ₹150, kept separate', () => {
  const plain = (q: number) => item('bookmark', 30, q, { variantId: 'pb--plain', variantLabel: 'Plain', variantAttrs: { kind: 'plain' } })
  const mag = (q: number) => item('bookmark', 100, q, { variantId: 'pb--magnetic', variantLabel: 'Magnetic', variantAttrs: { kind: 'magnetic' } })
  assert.equal(computeTotals([plain(4)]).total, 100)
  assert.equal(computeTotals([plain(5)]).total, 130)
  assert.equal(computeTotals([mag(2)]).total, 150)
  assert.equal(computeTotals([mag(3)]).total, 250)
  // 3 plain + 1 magnetic must NOT form a 4-for-₹100 plain set
  assert.equal(computeTotals([plain(3), mag(1)]).total, 190)
  const both = computeTotals([plain(4), mag(2)])
  assert.equal(both.total, 250)
  assert.equal(both.applied.length, 2)
})

test('bookmark attrs fall back to seed variant id / label when attrs are missing', () => {
  const t = computeTotals([
    item('bookmark', 100, 1, { variantId: 'p-x-bookmark--magnetic', variantLabel: 'Magnetic' }),
    item('bookmark', 100, 1, { variantId: 'whatever', variantLabel: 'Magnetic' }),
  ])
  assert.equal(t.total, 150)
})

test('badges: 5 for ₹200', () => {
  assert.equal(computeTotals([item('badge', 50, 5)]).total, 200)
  assert.equal(computeTotals([item('badge', 50, 4)]).total, 200)
  assert.equal(computeTotals([item('badge', 50, 10)]).total, 400)
  assert.equal(computeTotals([item('badge', 50, 11)]).total, 450)
})

test('stickers and tees have no bundle', () => {
  assert.equal(computeTotals([item('sticker', 30, 4)]).total, 120)
  assert.equal(computeTotals([item('sticker', 100, 2, { variantLabel: 'Pack (count TBC)' })]).total, 200)
  const t = computeTotals([item('tshirt', 800, 2), item('tshirt', 600, 1)])
  assert.equal(t.total, 2200)
  assert.equal(t.savings, 0)
  assert.deepEqual(t.applied, [])
})

test('mixed cart: every rule at once', () => {
  const t = computeTotals([
    item('tshirt', 800, 1),           // 800
    item('hoodie', 1500, 1),          // 1500
    item('polaroid', 50, 3),          // 150 → 100
    item('poster', 200, 6),           // 1200 → 1000
    item('badge', 50, 5),             // 250 → 200
    item('bookmark', 30, 4, { variantAttrs: { kind: 'plain' } }),    // 120 → 100
    item('bookmark', 100, 2, { variantAttrs: { kind: 'magnetic' } }), // 200 → 150
    item('sticker', 30, 2),           // 60
  ])
  assert.equal(t.subtotal, 800 + 1500 + 150 + 1200 + 250 + 120 + 200 + 60)
  assert.equal(t.savings, 50 + 200 + 50 + 20 + 50)
  assert.equal(t.total, 800 + 1500 + 100 + 1000 + 200 + 100 + 150 + 60)
  assert.equal(t.applied.length, 5)
  assert.equal(t.hasPriceOnRequest, false)
  assert.deepEqual(t.hints, [])
})

test('price on request + range items are excluded from totals and flagged', () => {
  const t = computeTotals([
    item('tshirt', 800, 1),
    item('hat', null, 1),
    item('katana', null, 1, { variantLabel: 'Basic' }),
  ])
  assert.equal(t.total, 800)
  assert.equal(t.hasPriceOnRequest, true)
  assert.equal(t.lines[1].lineTotal, null)
  assert.equal(t.lines[2].lineTotal, null)
})

test('custom lines never join a bundle', () => {
  const custom = { mode: 'own' as const, product: 'polaroid' as const, fileUrls: [], zones: [], halfHalf: false, quantity: 20 }
  const t = computeTotals([item('polaroid', 50, 2), item('polaroid', 50, 1, { custom })])
  assert.equal(t.total, 150)
  assert.equal(t.savings, 0)
})

test('hints nudge towards the next deal', () => {
  const t = computeTotals([item('polaroid', 50, 2), item('badge', 50, 3)])
  assert.ok(t.hints.includes('Add 1 more polaroid to unlock 3 polaroids for ₹100.'), t.hints.join(' | '))
  assert.ok(t.hints.includes('Add 2 more badges to unlock 5 badges for ₹200.'), t.hints.join(' | '))
})

test('empty cart', () => {
  const t = computeTotals([])
  assert.deepEqual([t.subtotal, t.savings, t.total, t.hasPriceOnRequest, t.lines.length], [0, 0, 0, false, 0])
})

test('custom minimums and unit prices from the notebook', () => {
  assert.equal(minQtyFor('polaroid'), 20)
  assert.equal(minQtyFor('bookmark'), 14)
  assert.equal(minQtyFor('sticker'), 15)
  assert.equal(minQtyFor('badge'), 350)
  assert.equal(minQtyFor('tshirt'), 1)
  assert.equal(minQtyFor('poster'), 1)

  const pol = customQuote({ product: 'polaroid', quantity: 20, mode: 'own', halfHalf: false })
  assert.equal(pol.total, 1000)
  assert.equal(pol.meetsMinimum, true)
  assert.equal(pol.estimate, false)

  const bm = customQuote({ product: 'bookmark', quantity: 14, mode: 'own', halfHalf: false })
  assert.equal(bm.total, 1400)
  assert.equal(bm.estimate, true)

  const st = customQuote({ product: 'sticker', quantity: 10, mode: 'own', halfHalf: false })
  assert.equal(st.meetsMinimum, false)
  assert.match(st.notes[0], /Minimum 15 pieces/)

  const bd = customQuote({ product: 'badge', quantity: 350, mode: 'own', halfHalf: false })
  assert.equal(bd.total, 4200)
  assert.equal(bd.estimate, true)
})

test('custom apparel: +₹200 company design (once), +₹200 half-n-half (per piece)', () => {
  const own = customQuote({ product: 'tshirt', quantity: 1, mode: 'own', halfHalf: false })
  assert.equal(own.unitPrice, 800)
  assert.equal(own.total, 800)
  assert.equal(own.estimate, true)
  const company = customQuote({ product: 'tshirt', quantity: 2, mode: 'company', halfHalf: true })
  assert.equal(company.total, 800 * 2 + 200 + 200 * 2)
  assert.ok(company.notes.some((x) => x.includes('front 4×4 in, back 12×15 in')))

  const hoodie = S.products.find((p) => p.type === 'hoodie')!
  const lv3 = hoodie.variants[2]
  const hq = customQuote({ product: 'hoodie', quantity: 1, mode: 'own', halfHalf: false }, hoodie, lv3.id)
  assert.equal(hq.unitPrice, 1800)
  const hNoProduct = customQuote({ product: 'hoodie', quantity: 1, mode: 'own', halfHalf: false })
  assert.equal(hNoProduct.total, null)
})

test('price labels: fixed, from, range, on request', () => {
  const by = (slug: string) => S.products.find((p) => p.slug === slug)!
  assert.equal(productPriceLabel(by('cursed-static-oversized-t-shirt')), '₹800')
  assert.equal(productPriceLabel(by('talisman-rain-t-shirt')), 'From ₹400')
  assert.equal(productPriceLabel(by('violet-smoke-hoodie')), 'From ₹1,200')
  assert.equal(productPriceLabel(by('ember-edge-cosplay-katana')), '₹1,200–2,000')
  assert.equal(productPriceLabel(by('tide-glow-led-cosplay-katana')), '₹3,000–4,000')
  assert.equal(productPriceLabel(by('wall-runner-cape')), '₹700–1,000')
  assert.equal(productPriceLabel(by('desk-guardian-figurine')), '₹250–2,500')
  assert.equal(productPriceLabel(by('sunny-straw-cosplay-hat')), 'Price on request')
  assert.equal(variantPriceLabel(by('ember-edge-cosplay-katana').variants[0]), '₹1,200–2,000')
})

test('seed integrity: prices match the notebook', () => {
  const ps = S.products
  assert.ok(ps.length >= 56, `only ${ps.length} products`)
  assert.equal(ps.filter((p) => p.dropOfWeek).length, 1)
  assert.equal(ps.filter((p) => p.featured).length, 8)
  assert.equal(new Set(ps.map((p) => p.slug)).size, ps.length)
  const drop = ps.find((p) => p.dropOfWeek)!
  assert.equal(drop.collection, 'jujutsu-kaisen')
  assert.equal(drop.type, 'tshirt')
  const allowed: Record<string, number[]> = {
    tshirt: [800, 600, 400], hoodie: [1200, 1500, 1800, 2500], polaroid: [50], poster: [200],
    bookmark: [30, 100], badge: [50], sticker: [30, 100], keychain: [150], figurine: [2500],
  }
  for (const p of ps) {
    assert.ok(p.collection && S.collections.some((c) => c.slug === p.collection), p.slug)
    assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    for (const v of p.variants) {
      if (v.price != null) assert.ok(allowed[p.type]?.includes(v.price), `${p.slug} ${v.label} ₹${v.price}`)
    }
    for (const i of p.images) assert.ok(i.alt.length > 0 && i.alt.length <= 125, `${p.slug} alt ${i.alt.length}`)
  }
  for (const r of S.bundleRules) assert.ok(ps.some((p) => p.type === r.appliesTo.type))
})
