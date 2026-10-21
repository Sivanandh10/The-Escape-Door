// Recommendation engine unit tests (pure functions). Run from the repo root (Node >= 22.15, no deps):
//   node --test src/lib/recs/engine.test.ts
// Covers: feature helpers, scoring, penalties, collaborative graph, diversity (MMR caps), reasons, determinism.
import test from 'node:test'
import assert from 'node:assert/strict'
import '../data/node-ts-hook.mjs'
import type { Product, ProductType } from '../types'

type Engine = typeof import('./engine')
type Seed = typeof import('../data/seed')
const enginePath = './engine' + '.ts'
const seedPath = '../data/seed' + '.ts'
const E = (await import(enginePath)) as Engine
const S = (await import(seedPath)) as Seed
const { rankRecs, buildItemGraph, buildProfile, diversify, contentSim, priceBand, viewWeight, newness, cooccur, buildRecs, malSignals, PENALTY } = E

const NOW = Date.parse('2026-10-21T12:00:00.000Z')
const H = 3_600_000
const D = 24 * H

const PRICE: Partial<Record<ProductType, number>> = { tshirt: 800, hoodie: 1200, polaroid: 50, poster: 200, badge: 50, sticker: 30, keychain: 150, bookmark: 30, cape: 700 }
function mk(slug: string, type: ProductType, collection: string, extra: Partial<Product> = {}): Product {
  return {
    id: `p-${slug}`, slug, name: `${slug} ${type}`, type, collection, tags: [type, collection], designTitle: slug.replace(/-/g, ' '),
    description: '', images: [], variants: [{ id: 'v', label: 'std', price: PRICE[type] ?? 100 }], priceFrom: PRICE[type] ?? 100,
    customizable: false, featured: false, dropOfWeek: false, stock: 'in', colorBlock: '#000', createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z', ...extra,
  }
}

// a small catalogue: 3 arcs × several types
const CAT: Product[] = [
  mk('jjk-tee-a', 'tshirt', 'jjk'), mk('jjk-tee-b', 'tshirt', 'jjk'), mk('jjk-tee-c', 'tshirt', 'jjk'), mk('jjk-hoodie', 'hoodie', 'jjk'),
  mk('jjk-polaroid', 'polaroid', 'jjk'), mk('jjk-sticker', 'sticker', 'jjk'), mk('jjk-badge', 'badge', 'jjk'), mk('jjk-poster', 'poster', 'jjk'),
  mk('jjk-keychain', 'keychain', 'jjk', { stock: 'out' }),
  mk('op-tee', 'tshirt', 'op'), mk('op-hoodie', 'hoodie', 'op'), mk('op-polaroid', 'polaroid', 'op'), mk('op-sticker', 'sticker', 'op'),
  mk('ds-tee', 'tshirt', 'ds'), mk('ds-poster', 'poster', 'ds'), mk('ds-cape', 'cape', 'ds'), mk('ds-badge', 'badge', 'ds'),
]
const COLS = [{ slug: 'jjk', name: 'Jujutsu Kaisen' }, { slug: 'op', name: 'One Piece' }, { slug: 'ds', name: 'Demon Slayer' }]
const views = (...slugs: string[]) => slugs.map((slug, i) => ({ slug, at: NOW - (i + 1) * H, count: 1 }))

// ---------------------------------------------------------------- features
test('priceBand / contentSim / viewWeight / newness are sane', () => {
  assert.equal(priceBand(mk('a', 'sticker', 'x')), 0)
  assert.equal(priceBand(mk('a', 'poster', 'x')), 1)
  assert.equal(priceBand(mk('a', 'hoodie', 'x')), 3)
  assert.equal(priceBand(mk('a', 'tshirt', 'x', { priceOnRequest: true })), -1)
  const a = CAT[0], b = CAT[1], c = CAT.find((p) => p.slug === 'op-sticker')!
  assert.ok(contentSim(a, b) > contentSim(a, c), 'same arc + type is more similar than different arc + type')
  assert.equal(contentSim(a, b), contentSim(b, a), 'symmetric')
  assert.equal(contentSim(a, a), 1)
  assert.ok(Math.abs(viewWeight(NOW - 3 * D, 1, NOW) - 0.5) < 1e-9, 'a view halves after 3 days')
  assert.ok(viewWeight(NOW, 5, NOW) > viewWeight(NOW, 1, NOW), 'repeat views count more')
  assert.ok(newness({ createdAt: new Date(NOW).toISOString() }, NOW) > newness({ createdAt: '2026-01-01T00:00:00Z' }, NOW))
})

test('profile: recency decay favours the latest views; anchor seeds collaboration', () => {
  const prof = buildProfile(CAT, { views: [{ slug: 'op-tee', at: NOW - 20 * D }, { slug: 'jjk-tee-a', at: NOW - H }] }, NOW)
  assert.ok((prof.col.get('jjk') ?? 0) > (prof.col.get('op') ?? 0))
  assert.equal(prof.any, true)
  assert.equal(buildProfile(CAT, {}, NOW).any, false)
  const p2 = buildProfile(CAT, {}, NOW, 'ds-tee')
  assert.equal(p2.seeds.get('ds-tee'), 3)
})

// ---------------------------------------------------------------- scoring
test('shop: viewing 3 JJK products → JJK-leaning, diverse, explained', () => {
  const recs = rankRecs({ context: 'shop', products: CAT, collections: COLS, signals: { views: views('jjk-tee-a', 'jjk-hoodie', 'jjk-polaroid') }, limit: 6, now: NOW })
  assert.equal(recs.length, 6)
  const jjk = recs.filter((r) => r.product.collection === 'jjk').length
  assert.ok(jjk >= 3, `expected JJK-leaning, got ${jjk}/6`)
  assert.ok(jjk <= 3, 'max 3 per collection in the top 6')
  const perType = new Map<string, number>()
  for (const r of recs) perType.set(r.product.type, (perType.get(r.product.type) ?? 0) + 1)
  assert.ok([...perType.values()].every((n) => n <= 2), 'max 2 per type in the top 6')
  assert.equal(recs[0].product.collection, 'jjk')
  assert.match(recs[0].reason.label, /Because you viewed/)
  assert.ok(recs.every((r) => r.reason.label.length > 0))
})

test('penalties: in cart, out of stock, just viewed, already bought', () => {
  const recs = rankRecs({ context: 'shop', products: CAT, signals: { views: views('jjk-tee-a'), cart: ['p-jjk-hoodie'] }, limit: 12, now: NOW })
  const slugs = recs.map((r) => r.product.slug)
  assert.ok(!slugs.includes('jjk-keychain'), 'out of stock never returned')
  assert.ok(!slugs.includes('jjk-hoodie'), 'cart item sinks below the threshold')
  // just viewed (1 h ago) gets the justViewed penalty compared with an identical older view
  const fresh = rankRecs({ context: 'shop', products: CAT, signals: { views: [{ slug: 'jjk-tee-a', at: NOW - 5 * 60_000 }] }, limit: 24, now: NOW })
  const old = rankRecs({ context: 'shop', products: CAT, signals: { views: [{ slug: 'jjk-tee-a', at: NOW - 2 * H }] }, limit: 24, now: NOW })
  const sF = fresh.find((r) => r.product.slug === 'jjk-tee-a')?.score ?? -Infinity
  const sO = old.find((r) => r.product.slug === 'jjk-tee-a')?.score ?? -Infinity
  assert.ok(sF < sO, `just-viewed should score lower (${sF} vs ${sO})`)
  // bought apparel is penalised harder than a bought collectible
  const bought = rankRecs({ context: 'account', products: CAT, signals: { views: views('jjk-poster'), orders: ['jjk-tee-b', 'jjk-sticker'] }, limit: 24, now: NOW })
  const base = rankRecs({ context: 'account', products: CAT, signals: { views: views('jjk-poster') }, limit: 24, now: NOW })
  const delta = (slug: string) => (base.find((r) => r.product.slug === slug)?.score ?? 0) - (bought.find((r) => r.product.slug === slug)?.score ?? 0)
  assert.ok(delta('jjk-tee-b') > delta('jjk-sticker'), 'apparel purchased penalty > collectible penalty')
  assert.ok(PENALTY.purchased > PENALTY.purchasedCollectible)
})

test('product: similar + bought together, anchor + excluded never returned', () => {
  const graph = buildItemGraph({
    orders: [['ds-tee', 'jjk-sticker'], ['ds-tee', 'jjk-sticker'], ['ds-tee', 'jjk-sticker', 'op-tee'], ['op-tee', 'op-hoodie']],
    sessions: [],
    products: CAT,
  })
  const recs = rankRecs({ context: 'product', products: CAT, collections: COLS, anchor: 'ds-tee', exclude: ['ds-poster'], graph, limit: 6, now: NOW })
  const slugs = recs.map((r) => r.product.slug)
  assert.ok(!slugs.includes('ds-tee') && !slugs.includes('ds-poster'))
  assert.equal(slugs[0], 'jjk-sticker', 'strong co-purchase wins the first slot')
  assert.equal(recs[0].reason.kind, 'bought-together')
  assert.ok(slugs.includes('ds-cape') || slugs.includes('ds-badge'), 'same-arc similar items still show')
})

test('cart: complete the look prefers complementary types from the same arc', () => {
  const recs = rankRecs({ context: 'cart', products: CAT, collections: COLS, signals: { cart: ['p-jjk-tee-a'] }, limit: 4, now: NOW })
  const types = recs.map((r) => r.product.type)
  assert.equal(recs[0].product.slug, 'jjk-hoodie', 'tee → hoodie first')
  assert.ok(!types.includes('tshirt') || types.indexOf('tshirt') > 1, 'not another tee up top')
  assert.equal(recs[0].reason.kind, 'complete')
  assert.match(recs[0].reason.label, /Completes your tee/)
})

test('MAL affinity → "Because you watched"', () => {
  const recs = rankRecs({ context: 'home', products: CAT, collections: COLS, signals: { mal: [{ collection: 'ds', weight: 5, title: 'Demon Slayer' }] }, limit: 4, now: NOW })
  assert.equal(recs[0].product.collection, 'ds')
  assert.equal(recs[0].reason.label, 'Because you watched Demon Slayer')
})

test('search terms steer the ranking', () => {
  const recs = rankRecs({ context: 'shop', products: CAT, signals: { searches: ['polaroid'] }, limit: 3, now: NOW })
  assert.equal(recs[0].product.type, 'polaroid')
  assert.equal(recs[0].reason.kind, 'search')
})

test('cold start: no signals → popularity + newness, still diverse', () => {
  const graph = buildItemGraph({ orders: [], sessions: [], events: [{ slug: 'op-hoodie', kind: 'cart' }, { slug: 'op-hoodie', kind: 'view' }, { slug: 'ds-cape', kind: 'view' }], products: CAT })
  const recs = rankRecs({ context: 'home', products: CAT, collections: COLS, graph, limit: 6, now: NOW })
  assert.equal(recs[0].product.slug, 'op-hoodie')
  assert.equal(recs[0].reason.label, 'Popular in One Piece')
})

// ---------------------------------------------------------------- graph
test('cooccur: cosine-normalised, shrinks single co-occurrences, ignores oversized baskets', () => {
  const g = cooccur([['a', 'b'], ['a', 'b'], ['a', 'c'], ['x', ...Array.from({ length: 50 }, (_, i) => `z${i}`)]], 30, 10)
  assert.equal(g.a.b, 1, 'strongest neighbour normalised to 1')
  assert.ok(g.a.c < g.a.b)
  assert.equal(g.x, undefined, 'oversized basket skipped')
})

test('buildItemGraph resolves ids → slugs and drops unknown items', () => {
  const g = buildItemGraph({ orders: [['p-jjk-tee-a', 'jjk-hoodie', 'ghost']], sessions: [['op-tee', 'op-hoodie']], products: CAT })
  assert.ok(g.coBuy['jjk-tee-a']['jjk-hoodie'] > 0)
  assert.equal(g.coBuy.ghost, undefined)
  assert.ok(g.coView['op-tee']['op-hoodie'] > 0)
})

// ---------------------------------------------------------------- diversity
test('diversify: caps per type / collection in the window, relaxes when it runs dry', () => {
  const tees = Array.from({ length: 8 }, (_, i) => ({ product: mk(`t${i}`, 'tshirt', 'jjk'), score: 10 - i }))
  const others = [{ product: mk('h', 'hoodie', 'op'), score: 1 }, { product: mk('s', 'sticker', 'ds'), score: 0.5 }]
  const out = diversify([...tees, ...others], { limit: 6, perTypeTop: 2, perCollectionTop: 3 })
  assert.equal(out.length, 6)
  assert.ok(out.slice(0, 4).some((x) => x.product.slug === 'h'), 'a lower-scored hoodie is lifted into the top')
  const onlyTees = diversify(tees, { limit: 5 })
  assert.equal(onlyTees.length, 5, 'relaxed pass fills the list when only one type exists')
})

test('deterministic: same input → same output', () => {
  const input = { context: 'shop' as const, products: CAT, signals: { views: views('jjk-tee-a', 'op-tee') }, limit: 8, now: NOW }
  const a = rankRecs(input).map((r) => `${r.product.slug}:${r.score}`)
  const b = rankRecs({ ...input, products: [...CAT].reverse() }).map((r) => `${r.product.slug}:${r.score}`)
  assert.deepEqual(a, b)
})

// ---------------------------------------------------------------- real catalogue + account payload
test('seed catalogue: 3 JJK views → JJK-leaning shop row with reasons', () => {
  const v = views('cursed-static-oversized-t-shirt', 'violet-smoke-hoodie', 'talisman-strip-polaroid-prints')
  const recs = rankRecs({ context: 'shop', products: S.products, collections: S.collections, signals: { views: v }, limit: 8, now: NOW })
  assert.equal(recs.length, 8)
  const top6 = recs.slice(0, 6)
  assert.ok(top6.filter((r) => r.product.collection === 'jujutsu-kaisen').length >= 3)
  assert.ok(new Set(top6.map((r) => r.product.type)).size >= 3, 'diverse types')
  assert.ok(recs.every((r) => !['cursed-static-oversized-t-shirt', 'violet-smoke-hoodie', 'talisman-strip-polaroid-prints'].includes(r.product.slug) || r.score > 0))
})

test('buildRecs: hybrid picks + reasons; no signals → empty picks', () => {
  const recent = [{ slug: 'cursed-static-oversized-t-shirt', viewedAt: new Date(NOW - H).toISOString(), count: 2 }]
  const out = buildRecs({ products: S.products, collections: S.collections, views: recent, now: NOW })
  assert.ok(out.picks.length > 0)
  assert.ok(!out.picks.some((p) => p.slug === 'cursed-static-oversized-t-shirt'), 'already-seen items are not picks')
  assert.ok(out.pickReasons && Object.keys(out.pickReasons).length === out.picks.length)
  const empty = buildRecs({ products: S.products, collections: S.collections, views: [], now: NOW })
  assert.equal(empty.picks.length, 0)
  const mal = malSignals([{ id: 1, title: 'Kimetsu no Yaiba', en: 'Demon Slayer', synonyms: [], genres: [], mean: 8, picture: null, status: 'completed', score: 9, episodes: 26, updatedAt: null }], S.collections)
  assert.deepEqual(mal.map((m) => m.collection), ['demon-slayer'])
})

// ---------------------------------------------------------------- integrator fixes
test('co-purchase needs minCoBuy distinct orders (one test / spam basket never makes "Bought with")', () => {
  const one = buildItemGraph({ orders: [['jjk-tee-a', 'jjk-hoodie']], sessions: [], products: CAT, minCoBuy: 2 })
  assert.equal(one.coBuy['jjk-tee-a'], undefined)
  const two = buildItemGraph({ orders: [['jjk-tee-a', 'jjk-hoodie'], ['jjk-hoodie', 'jjk-tee-a', 'op-tee']], sessions: [], products: CAT, minCoBuy: 2 })
  assert.ok(two.coBuy['jjk-tee-a']['jjk-hoodie'] > 0)
  assert.equal(two.coBuy['jjk-tee-a']['op-tee'], undefined, 'a pair seen in only one order is dropped')
})

test('reason chip names the viewed item closest to each pick (same type), not just the arc\'s strongest view', () => {
  // the poster is the most recent (strongest) JJK view; the tee was viewed too
  const recs = rankRecs({ context: 'shop', products: CAT, collections: COLS, signals: { views: views('jjk-poster', 'jjk-tee-a') }, limit: 12, now: NOW })
  const tee = recs.find((r) => r.product.type === 'tshirt' && r.product.collection === 'jjk' && r.reason.label.startsWith('Because you viewed'))
  assert.ok(tee, 'a JJK tee is recommended with a "Because you viewed" chip')
  assert.match(tee!.reason.label, /jjk tee a/)
})

// ---------------------------------------------------------------- session trail → account (search-term affinity)
test('search words: plurals, synonyms and partial matches of longer terms', () => {
  const { termMatch, searchWords, typesOf } = E
  assert.deepEqual(searchWords('The JJK merch for tees'), ['jjk', 'tees'], 'stop words dropped')
  assert.equal(termMatch('jjk-hoodie hoodie jjk', searchWords('hoodies')), 1, 'plural → singular')
  assert.equal(termMatch('cursed static oversized t-shirt tshirt jujutsu kaisen', searchWords('jjk tees')), 1, 'jjk → jujutsu, tees → shirt')
  assert.equal(termMatch('ds-cape cape ds', searchWords('ds jacket')), 0.25, 'half of a 2-word term → half weight × share')
  assert.equal(termMatch('op-tee tshirt op', searchWords('katana')), 0)
  assert.deepEqual(typesOf('cosplay-props'), ['katana', 'cape', 'hat', 'cosplay'])
  assert.deepEqual(typesOf('hoodie'), ['hoodie'])
  assert.deepEqual(typesOf('nope'), [])
})

test('search-term affinity: matching products lead, their arc gets a lift, partial matches rank below full ones', () => {
  const recs = rankRecs({ context: 'shop', products: CAT, collections: COLS, signals: { searches: ['ds posters'] }, limit: 8, now: NOW })
  assert.equal(recs[0].product.slug, 'ds-poster', 'full match first')
  assert.equal(recs[0].reason.kind, 'search')
  assert.match(recs[0].reason.label, /ds posters/)
  const prof = buildProfile(CAT, { searches: ['ds posters'] }, NOW)
  assert.ok((prof.search.get('ds-poster') ?? 0) > (prof.search.get('ds-cape') ?? 0), 'full beats partial')
  assert.ok((prof.search.get('ds-cape') ?? 0) > 0, 'other Demon Slayer pieces still count (partial)')
  assert.ok((prof.col.get('ds') ?? 0) > (prof.col.get('op') ?? 0), 'the searched arc gains affinity')
})

test('storedToSignals: recency-decayed, strongest first, views ignored, mergeSignals de-duplicates', () => {
  const { storedToSignals, mergeSignals } = E
  const s = storedToSignals(
    [
      { kind: 'search', value: 'one piece', at: NOW - 40 * D },
      { kind: 'search', value: 'polaroid', at: NOW - H },
      { kind: 'search', value: 'polaroid', at: NOW - 2 * H },
      { kind: 'collection', value: 'op', at: NOW - H },
      { kind: 'collection', value: 'op', at: NOW - 3 * H },
      { kind: 'collection', value: 'ds', at: NOW - 30 * D },
      { kind: 'type', value: 'hoodies', at: NOW - H },
      { kind: 'cart', value: 'p-jjk-hoodie', at: NOW - D },
      { kind: 'wishlist', value: 'p-ds-cape', at: NOW - D },
      { kind: 'view', value: 'jjk-tee-a', at: NOW - H },
    ],
    NOW,
  )
  assert.deepEqual(s.searches, ['polaroid', 'one piece'])
  assert.deepEqual(s.collections!.map((c) => c.slug), ['op', 'ds'])
  assert.ok(s.collections![0].weight > 1.9 && s.collections![1].weight < 0.3, 'two fresh visits ≫ one old one')
  assert.deepEqual(s.types!.map((t) => t.type), ['hoodies'])
  assert.deepEqual(s.added, ['p-jjk-hoodie'])
  assert.deepEqual(s.wish, ['p-ds-cape'])
  const m = mergeSignals({ searches: ['polaroid', 'jjk'], collections: [{ slug: 'op', weight: 1 }] }, s)
  assert.deepEqual(m.searches, ['polaroid', 'jjk', 'one piece'])
  assert.equal(m.collections!.find((c) => c.slug === 'op')!.weight, 1 + s.collections![0].weight)
})

test('buildRecs: a logged-in shopper with only a stored trail (searches, arcs, cart adds) gets real picks', () => {
  const at = NOW - 2 * H
  const stored = [
    { kind: 'search' as const, value: 'polaroid', at },
    { kind: 'collection' as const, value: 'op', at },
    { kind: 'collection' as const, value: 'op', at: at - H },
  ]
  const out = buildRecs({ products: CAT, collections: COLS as never, views: [], stored, now: NOW })
  assert.ok(out.picks.length > 0, 'no views needed — the trail is enough')
  assert.equal(out.picks[0].type, 'polaroid', 'search term wins the top slot')
  assert.ok(out.picks.slice(0, 4).some((p) => p.collection === 'op'), 'browsed arc shows up near the top')
  const reasons = Object.values(out.pickReasons ?? {}).map((r) => r.label)
  assert.ok(reasons.some((l) => l === 'Matches “polaroid”'), 'search reason chip')
  assert.ok(reasons.some((l) => l === 'Because you browsed One Piece'), 'browsed-arc reason chip')
  // a past cart add is interest, not "in your cart": the item itself can still be picked
  const hist = buildRecs({ products: CAT, collections: COLS as never, views: [], stored: [{ kind: 'cart', value: 'p-ds-cape', at }], now: NOW })
  assert.ok(hist.picks.some((p) => p.collection === 'ds'))
  const none = buildRecs({ products: CAT, collections: COLS as never, views: [], stored: [{ kind: 'view', value: 'ds-cape', at }], now: NOW })
  assert.equal(none.picks.length, 0, 'stored views alone are ignored (recent_views carries them)')
})

test('stored search terms → affinity: an arc NAME typed in search ("one piece") lifts that arc for a logged-in shopper', () => {
  const at = NOW - 3 * H
  const out = buildRecs({ products: CAT, collections: COLS as never, views: [], stored: [{ kind: 'search', value: 'one piece', at, weight: 1 }], now: NOW })
  assert.ok(out.picks.length > 0)
  assert.equal(out.picks[0].collection, 'op', 'the searched arc leads')
  assert.ok(out.picks.slice(0, 3).every((p) => p.collection === 'op'), 'top 3 are One Piece pieces')
  // an old search still counts, but a fresh one of another arc beats it
  const mixed = buildRecs({
    products: CAT, collections: COLS as never, views: [], now: NOW,
    stored: [{ kind: 'search', value: 'one piece', at: NOW - 60 * D }, { kind: 'search', value: 'demon slayer', at: NOW - H }, { kind: 'search', value: 'demon slayer', at: NOW - 2 * H }],
  })
  assert.equal(mixed.picks[0].collection, 'ds', 'recent + repeated search wins')
})
