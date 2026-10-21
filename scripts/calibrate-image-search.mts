// Calibrates the visual-search thresholds on the real catalogue. Owner: SEARCH. Read-only (no DB writes).
//   node scripts/calibrate-image-search.mts                 products from Supabase (.env.local) or the seed catalogue
//   node scripts/calibrate-image-search.mts --web           + real photos from picsum.photos (negatives, photo
//                                                           backgrounds, foreign prints)
//   node scripts/calibrate-image-search.mts --neg-dir DIR   + every image in DIR as a real-photo negative (photos of
//                                                           OTHER shops' tees / hoodies / badges). Default: the local,
//                                                           git-ignored qa/visual-search/neg-photos when it exists.
//   node scripts/calibrate-image-search.mts --json out.json also write every query's top 5
//
// The index is built exactly like product_image_embeddings + /api/image-index (vec.viewsFor() views per image, int8
// round trip, VIEW_PENALTY per view) and, for comparison, the old one-view-per-image index. What it measures (model + dtype from thresholds.ts):
//   (a) every product image, unchanged                         → EXACT top-1
//   (b) the same image as JPEG q60 / resized to 480 px / centre-cropped 80 % / rotated 8° / "photographed"
//       (brightness + saturation shift, blur, sensor noise, JPEG q75) / all of those at once
//                                                              → EXACT top-1 (at least top-3)
//   (c) the middle of the mockup laid on a table               → informative
//   (e) PHOTO-LIKE (scripts/lib/photo-sim.mts): perspective-skewed, rotated, shadowed, white-balance-shifted, blurred
//       JPEGs on wood / bedsheet / floor / room backgrounds: the whole mockup · the garment cut out of the poster
//       (front, back) · a close-up of the print (front, back) · the product centre of non-apparel mockups
//   (d) negatives that must NOT be called EXACT:
//       off-topic (plain colours, gradients, text, noise, patterns, textures from public/, photos) → NO RESULT;
//       in-domain: our own brand drawings (badge, wordmarks: printed on our products, e.g. the earrings' card), our garment silhouette with foreign prints, our poster frame with a foreign print
//       ("template"), real photos of other tees (--neg-dir), plain text → never EXACT (SIMILAR is acceptable)
// Then: the outcome with the thresholds in thresholds.ts, a grid search for the tier-2 EXACT rule (vec.isExact) and
// a SIMILAR threshold sweep.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type * as Lib from './lib/visual-search-node.mjs'
import type * as Sim from './lib/photo-sim.mjs'

// runtime: the .mts sources (Node strips the types); the type-only imports above let tsc follow them
const L: typeof Lib = await import(new URL('./lib/visual-search-node.mts', import.meta.url).href)
const S: typeof Sim = await import(new URL('./lib/photo-sim.mts', import.meta.url).href)
const { createEmbedder, fetchProducts, loadImageBytes, productImages, ROOT, MATCH, MODEL_ID, MODEL_DTYPE, EMBED_DIM, VIEW_PENALTY, vec } = L

const args = process.argv.slice(2)
const WEB = args.includes('--web')
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null
const negDirArg = args.includes('--neg-dir') ? args[args.indexOf('--neg-dir') + 1] : null
const NEG_DIR = negDirArg ? path.resolve(negDirArg) : path.join(ROOT, 'qa', 'visual-search', 'neg-photos')

// ---------------------------------------------------------------- seeded randomness (deterministic runs)
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss(rnd: () => number) {
  const u = Math.max(1e-9, rnd())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}
async function noiseOverlay(w: number, h: number, sigma: number, seed: number): Promise<Buffer> {
  const rnd = mulberry32(seed)
  const buf = Buffer.alloc(w * h * 3)
  for (let i = 0; i < buf.length; i++) buf[i] = Math.max(0, Math.min(255, Math.round(128 + gauss(rnd) * sigma)))
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

// ---------------------------------------------------------------- perturbations
type Perturb = (bytes: Buffer, seed: number) => Promise<Buffer>
const meta = async (b: Buffer) => {
  const m = await sharp(b).metadata()
  return { w: m.width ?? 1, h: m.height ?? 1 }
}
const crop80: Perturb = async (b) => {
  const { w, h } = await meta(b)
  return sharp(b).extract({ left: Math.round(w * 0.1), top: Math.round(h * 0.1), width: Math.round(w * 0.8), height: Math.round(h * 0.8) }).png().toBuffer()
}
const photo: Perturb = async (b, seed) => {
  const base = await sharp(b).resize({ width: 900 }).modulate({ brightness: 1.14, saturation: 0.88 }).blur(0.7).png().toBuffer()
  const { w, h } = await meta(base)
  const noise = await noiseOverlay(w, h, 22, seed)
  return sharp(base).composite([{ input: noise, blend: 'overlay' }]).jpeg({ quality: 75 }).toBuffer()
}
const PERTURB: Record<string, Perturb> = {
  original: async (b) => b,
  jpeg60: (b) => sharp(b).jpeg({ quality: 60 }).toBuffer(),
  resize480: (b) => sharp(b).resize({ width: 480 }).png().toBuffer(),
  crop80,
  rotate8: (b) => sharp(b).rotate(8, { background: '#7f7f7f' }).png().toBuffer(),
  photo,
  combo: async (b, seed) => {
    const c = await crop80(b, seed)
    const r = await sharp(c).rotate(8, { background: '#7f7f7f' }).resize({ width: 480 }).png().toBuffer()
    return sharp(await photo(r, seed)).jpeg({ quality: 60 }).toBuffer()
  },
  // (c) garment-only shot: the middle of the mockup (garment + print, little of the art background) on a "table"
  onTable: async (b, seed) => {
    const { w, h } = await meta(b)
    const cut = await sharp(b).extract({ left: Math.round(w * 0.12), top: Math.round(h * 0.17), width: Math.round(w * 0.76), height: Math.round(h * 0.66) }).resize({ width: 640 }).rotate(-4, { background: '#9a8f80' }).png().toBuffer()
    const cm = await meta(cut)
    const W = Math.round(cm.w * 1.3), H = Math.round(cm.h * 1.3)
    const table = await sharp({ create: { width: W, height: H, channels: 3, background: '#9a8f80' } }).png().toBuffer()
    const grain = await noiseOverlay(W, H, 30, seed + 7)
    const t2 = await sharp(table).composite([{ input: grain, blend: 'overlay' }]).png().toBuffer()
    return sharp(t2).composite([{ input: cut, left: Math.round((W - cm.w) / 2), top: Math.round((H - cm.h) / 2) }]).modulate({ brightness: 0.92 }).jpeg({ quality: 70 }).toBuffer()
  },
}
const MUST_EXACT = ['original', 'jpeg60', 'resize480', 'crop80', 'rotate8', 'photo', 'combo']

// ---------------------------------------------------------------- negatives (generated, deterministic)
const svg = (body: string, w = 800, h = 1000) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)
async function negatives(): Promise<Array<{ name: string; bytes: Buffer }>> {
  const solid = (hex: string) => sharp({ create: { width: 800, height: 1000, channels: 3, background: hex } }).png().toBuffer()
  const out: Array<{ name: string; bytes: Buffer }> = [
    { name: 'solid black', bytes: await solid('#0B0B0F') },
    { name: 'solid white', bytes: await solid('#FFFFFF') },
    { name: 'solid volt yellow', bytes: await solid('#FFE14D') },
    { name: 'solid lavender', bytes: await solid('#C9B8FF') },
    { name: 'solid door purple', bytes: await solid('#6D3BFF') },
    { name: 'linear gradient', bytes: await sharp(svg('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d3d"/><stop offset="1" stop-color="#1c6fe0"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/>')).png().toBuffer() },
    { name: 'radial gradient', bytes: await sharp(svg('<defs><radialGradient id="g"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#0a3d2e"/></radialGradient></defs><rect width="800" height="1000" fill="url(#g)"/>')).png().toBuffer() },
    { name: 'text on white', bytes: await sharp(svg('<rect width="800" height="1000" fill="#fff"/><text x="60" y="420" font-family="Arial" font-size="96" font-weight="700">INVOICE</text><text x="60" y="560" font-family="Arial" font-size="48">Total due: 4,250.00</text><text x="60" y="640" font-family="Arial" font-size="40">Thank you for your business</text>')).png().toBuffer() },
    { name: 'sale text on red', bytes: await sharp(svg('<rect width="800" height="1000" fill="#d8202c"/><text x="80" y="520" font-family="Arial" font-size="150" font-weight="900" fill="#fff">SALE</text><text x="80" y="660" font-family="Arial" font-size="90" fill="#fff">50% OFF</text>')).png().toBuffer() },
    { name: 'random noise', bytes: await noiseOverlay(800, 1000, 70, 42) },
    { name: 'checkerboard', bytes: await sharp(svg('<defs><pattern id="p" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="50" height="50"/><rect x="50" y="50" width="50" height="50"/></pattern></defs><rect width="800" height="1000" fill="#fff"/><rect width="800" height="1000" fill="url(#p)"/>')).png().toBuffer() },
    { name: 'stripes', bytes: await sharp(svg('<defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="40" height="80" fill="#12A5A0"/><rect x="40" width="40" height="80" fill="#F4EFE6"/></pattern></defs><rect width="800" height="1000" fill="url(#p)"/>')).png().toBuffer() },
    { name: 'line chart', bytes: await sharp(svg('<rect width="800" height="1000" fill="#f7f7f7"/><g stroke="#ccc">' + Array.from({ length: 9 }, (_, i) => `<line x1="80" x2="760" y1="${150 + i * 90}" y2="${150 + i * 90}"/>`).join('') + '</g><polyline fill="none" stroke="#2563eb" stroke-width="8" points="80,800 200,700 320,740 440,520 560,560 680,300 760,340"/>')).png().toBuffer() },
    { name: 'house drawing', bytes: await sharp(svg('<rect width="800" height="1000" fill="#bfe3ff"/><rect y="760" width="800" height="240" fill="#6cbf4b"/><rect x="240" y="480" width="320" height="300" fill="#f2d7a6" stroke="#333" stroke-width="6"/><polygon points="220,490 400,330 580,490" fill="#c0392b" stroke="#333" stroke-width="6"/><rect x="370" y="640" width="70" height="140" fill="#7a4a21"/><circle cx="660" cy="170" r="70" fill="#ffd34d"/>')).png().toBuffer() },
  ]
  const files = ['brand/badge.svg', 'brand/wordmark.svg', 'brand/wordmark-stacked.svg', 'textures/speedlines.svg', 'textures/screentone-mid.svg', 'textures/splat-1.svg', 'textures/paper-grain.webp']
  for (const f of files) {
    const p = path.join(ROOT, 'public', f)
    if (!fs.existsSync(p)) continue
    const img = sharp(p, { density: 144 }).resize({ width: 800, height: 1000, fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' })
    out.push({ name: `public/${f}`, bytes: await img.png().toBuffer() })
  }
  if (WEB) {
    for (let i = 1; i <= 12; i++) {
      try {
        const res = await fetch(`https://picsum.photos/seed/ted-neg-${i}/640/800`)
        if (res.ok) out.push({ name: `photo picsum #${i}`, bytes: Buffer.from(await res.arrayBuffer()) })
      } catch {
        /* offline: skip */
      }
    }
  }
  return out
}

// ---------------------------------------------------------------- run
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—')
const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]
}
const f3 = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : '—')
const APPAREL = new Set(['tshirt', 'hoodie'])

const { rows, source } = await fetchProducts({ publishedOnly: true })
console.log(`catalogue: ${rows.length} published products (${source}) · model ${MODEL_ID} ${MODEL_DTYPE} · dim ${EMBED_DIM} · views ${vec.INDEX_VIEWS.length}`)
const embedder = await createEmbedder()
const sim = S.createPhotoSim(1234)

// ---- index: multi-view (what product_image_embeddings stores) + single-view (the old index, for comparison)
type P = { slug: string; vecs: Float32Array[]; offs?: number[] }
const multi: P[] = []
const rawIndex: Array<{ slug: string; images: string[] }> = [] // --json: every image's views (encodeVecs)
const single: P[] = []
const sources: Array<{ slug: string; type: string; side: string; src: string; bytes: Buffer }> = []
let quantLoss = 1
const t0 = Date.now()
for (const r of rows) {
  const m: P = { slug: r.slug, vecs: [], offs: [] }
  const s1: P = { slug: r.slug, vecs: [] }
  for (const im of productImages(r)) {
    try {
      const bytes = await loadImageBytes(im.src)
      const vs = await embedder.embedViews(bytes, vec.viewsFor(r.type, im.side))
      const ds = vec.splitVecs(vec.encodeVecs(vs), EMBED_DIM).map((b) => vec.decodeVec(b, EMBED_DIM)!)
      vs.forEach((v, i) => (quantLoss = Math.min(quantLoss, vec.dot(v, ds[i]))))
      m.vecs.push(...ds)
      m.offs!.push(...ds.map((_, i) => VIEW_PENALTY[i] ?? 0))
      if (jsonOut) (rawIndex.find((x) => x.slug === r.slug) ?? (rawIndex.push({ slug: r.slug, images: [] }), rawIndex[rawIndex.length - 1])).images.push(vec.encodeVecs(vs))
      s1.vecs.push(ds[0])
      sources.push({ slug: r.slug, type: r.type, side: im.side, src: im.src, bytes })
    } catch (e) {
      console.warn(`! ${r.slug} ${im.src}: ${(e as Error).message}`)
    }
  }
  if (m.vecs.length) {
    multi.push(m)
    single.push(s1)
  }
}
console.log(`indexed ${sources.length} images of ${multi.length} products (${multi.reduce((n, p) => n + p.vecs.length, 0)} vectors, view penalty ${VIEW_PENALTY.join('/')}) in ${((Date.now() - t0) / 1000).toFixed(1)} s · int8 round-trip min cos ${quantLoss.toFixed(5)}`)

// ---- queries
interface Hit { slug: string; score: number }
interface Summary { top: Hit[]; rank: number; correct: number }
interface Row { group: 'copy' | 'photo' | 'offTopic' | 'inDomain'; case: string; name: string; slug: string | null; multi: Summary; single: Summary; q?: string }
const results: Row[] = []
function summarize(v: Float32Array, index: P[], slug: string | null): Summary {
  const ranked = vec.rankProducts(v, index)
  const rank = slug ? ranked.findIndex((r) => r.product.slug === slug) + 1 : 0
  return { top: ranked.slice(0, 5).map((r) => ({ slug: r.product.slug, score: r.score })), rank, correct: rank ? ranked[rank - 1].score : -1 }
}
async function query(group: Row['group'], kase: string, name: string, slug: string | null, bytes: Buffer) {
  const v = await embedder.embed(bytes)
  results.push({ group, case: kase, name, slug, multi: summarize(v, multi, slug), single: summarize(v, single, slug), ...(jsonOut ? { q: vec.encodeVec(v) } : {}) })
}

let seed = 1
for (const s of sources) for (const [name, fn] of Object.entries(PERTURB)) await query('copy', name, s.src, s.slug, await fn(s.bytes, seed++))

// ---- (e) photo-like positives
const bgs = await sim.backgrounds(WEB)
const backCuts: Sim.Cut[] = []
let bi = 0
for (const s of sources) {
  const bg = bgs[bi++ % bgs.length].bytes
  const mock = await sharp(s.bytes).resize({ width: 600 }).ensureAlpha().png().toBuffer()
  await query('photo', 'mockupOnPhoto', s.src, s.slug, await sim.onPhoto(mock, bg, 0.62, 0.1))
  if (APPAREL.has(s.type)) {
    const c = await sim.cutGarment(s.bytes)
    if (!c) {
      console.warn(`! no garment cut-out: ${s.src}`)
      continue
    }
    if (s.side === 'back') backCuts.push(c)
    await query('photo', `garmentOnPhoto:${s.side}`, s.src, s.slug, await sim.onPhoto(await sim.cutToPng(c), bg, 0.72, 0.08))
    await query('photo', `printCloseup:${s.side}`, s.src, s.slug, await sim.onPhoto(await sim.cutToPng(c, sim.printRegion(c)), bg, 0.95, 0.06))
  } else {
    const m = await sharp(s.bytes).metadata()
    const cw = m.width ?? 1, ch = m.height ?? 1
    const ctr = await sharp(s.bytes).extract({ left: Math.round(cw * 0.15), top: Math.round(ch * 0.2), width: Math.round(cw * 0.7), height: Math.round(ch * 0.6) }).ensureAlpha().png().toBuffer()
    await query('photo', 'centreOnPhoto', s.src, s.slug, await sim.onPhoto(ctr, bg, 0.6, 0.08))
  }
}

// ---- (d) negatives
for (const n of await negatives()) {
  // our own brand drawings are printed on our products (the earrings' card): SIMILAR is a fair answer, EXACT is not
  if (n.name.startsWith('public/brand/')) await query('inDomain', 'ownBrand', n.name, null, n.bytes)
  else await query('offTopic', 'offTopic', n.name, null, n.bytes)
}
const arts = await sim.foreignArts(WEB)
const cutSample = backCuts.filter((_, i) => i % Math.max(1, Math.floor(backCuts.length / 6)) === 0).slice(0, 6)
for (const [ci, c] of cutSample.entries()) {
  for (const [ai, a] of arts.entries()) {
    for (const fabric of [[20, 20, 22], [235, 233, 228]] as [number, number, number][]) {
      const tee = await sim.foreignTee(c, a.bytes, fabric)
      await query('inDomain', 'foreignTee', `tee#${ci} ${fabric[0] > 100 ? 'white' : 'black'} · ${a.name}`, null, await sim.onPhoto(tee, bgs[(ci + ai) % bgs.length].bytes, 0.72, 0.08))
    }
  }
}
for (const [ci, s] of sources.filter((s) => s.side === 'back').slice(0, 6).entries()) {
  const c = await sim.cutGarment(s.bytes)
  if (!c) continue
  const full = await sharp(s.bytes).resize({ width: 600 }).png().toBuffer()
  const tee = await sim.foreignTee(c, arts[1 + (ci % (arts.length - 1))].bytes)
  await query('inDomain', 'template', `${s.slug} frame + foreign print`, null, await sharp(full).composite([{ input: tee, left: c.bbox.x0, top: c.bbox.y0 }]).jpeg({ quality: 80 }).toBuffer())
}
if (fs.existsSync(NEG_DIR)) {
  for (const f of fs.readdirSync(NEG_DIR).sort()) {
    if (!/\.(jpe?g|png|webp|avif)$/i.test(f)) continue
    try {
      await query('inDomain', 'realPhoto', f, null, await sharp(path.join(NEG_DIR, f)).jpeg().toBuffer())
    } catch {
      /* unreadable: skip */
    }
  }
} else console.log(`(no real-photo negatives: ${NEG_DIR} not found)`)
for (const t of ['BEYOND THE WALL', 'THE ESCAPE DOOR', 'ANIME T-SHIRT']) {
  await query('inDomain', 'textOnly', t, null, await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#111"/><text x="400" y="520" text-anchor="middle" font-family="Arial Black,Arial" font-size="72" fill="#fff">${t}</text></svg>`)).png().toBuffer())
}

// ---------------------------------------------------------------- classification
type T = typeof MATCH
type Outcome = 'ok' | 'wrong' | 'sim3' | 'simLow' | 'none'
const top1 = (s: Summary) => s.top[0]?.score ?? -1
const top2 = (s: Summary) => s.top[1]?.score ?? -1
function outcome(r: Row, s: Summary, t: T): Outcome {
  const top = top1(s)
  if (vec.isExact(top, top2(s), t)) return r.slug && s.top[0].slug === r.slug ? 'ok' : 'wrong'
  if (top < t.similar) return 'none'
  return r.slug && s.rank <= 3 && s.correct >= t.similar ? 'sim3' : 'simLow'
}
const POS_CASES = [...new Set(results.filter((r) => r.slug).map((r) => r.case))]
const NEG_CASES = [...new Set(results.filter((r) => !r.slug).map((r) => r.case))]

function table(t: T, which: 'multi' | 'single', title: string) {
  console.log(`\n== ${title}: exact ≥ ${t.exact} & lead ≥ ${t.margin}  OR  ≥ ${t.exact2} & lead ≥ ${t.margin2} · similar ≥ ${t.similar} ==`)
  console.log('case                    n   top1    top3   EXACT ok  WRONG exact  SIMILAR, ours top 3  SIMILAR, ours lower  NO RESULT  corr med')
  for (const c of POS_CASES) {
    const rs = results.filter((r) => r.case === c)
    const o = rs.map((r) => outcome(r, r[which], t))
    const n = (k: Outcome) => o.filter((x) => x === k).length
    console.log(
      `${c.padEnd(22)} ${String(rs.length).padStart(3)}  ${pct(rs.filter((r) => r[which].rank === 1).length, rs.length).padStart(6)}  ${pct(rs.filter((r) => r[which].rank <= 3).length, rs.length).padStart(6)}  ${pct(n('ok'), rs.length).padStart(8)}  ${pct(n('wrong'), rs.length).padStart(11)}  ${pct(n('sim3'), rs.length).padStart(19)}  ${pct(n('simLow'), rs.length).padStart(19)}  ${pct(n('none'), rs.length).padStart(9)}  ${f3(q(rs.map((r) => r[which].correct), 0.5))}`,
    )
  }
  for (const c of NEG_CASES) {
    const rs = results.filter((r) => r.case === c)
    const o = rs.map((r) => outcome(r, r[which], t))
    console.log(`neg ${c.padEnd(18)} ${String(rs.length).padStart(3)}  EXACT ${o.filter((x) => x === 'wrong').length} · SIMILAR ${o.filter((x) => x === 'simLow').length} · NO RESULT ${o.filter((x) => x === 'none').length} · top max ${f3(Math.max(...rs.map((r) => top1(r[which]))))}`)
  }
  const pos = results.filter((r) => r.slug)
  const wrong = pos.filter((r) => outcome(r, r[which], t) === 'wrong').length
  const negEx = results.filter((r) => !r.slug && outcome(r, r[which], t) === 'wrong').length
  console.log(`→ WRONG exact ${wrong}/${pos.length} positives · EXACT on negatives ${negEx}/${results.length - pos.length}`)
}

// own designs: nearest OTHER product of each original image
const crossBest = results.filter((r) => r.case === 'original').map((r) => r.multi.top.find((h) => h.slug !== r.slug)?.score ?? -1)
console.log(`\nown designs (multi-view): nearest other product of an original image: median ${f3(q(crossBest, 0.5))} · p95 ${f3(q(crossBest, 0.95))} · max ${f3(Math.max(...crossBest))}`)

table({ ...MATCH, exact2: 9, margin2: 9 }, 'single', 'OLD index (1 view) + OLD rule (tier 1 only)')
table({ ...MATCH, exact2: 9, margin2: 9 }, 'multi', `NEW index (${vec.INDEX_VIEWS.length} views) + tier 1 only`)
table(MATCH, 'multi', `NEW index (${vec.INDEX_VIEWS.length} views) + thresholds.ts`)

// ---------------------------------------------------------------- tier-2 grid search (multi-view)
// Valid = 0 wrong EXACT on every positive and 0 EXACT on every negative, ALSO one step looser on both axes
// (exact2 − 0.02, margin2 − 0.02), so the choice isn't sitting on the edge. Best = most correct EXACT overall.
const pos = results.filter((r) => r.slug)
const negs = results.filter((r) => !r.slug)
const errors = (t: T) => pos.filter((r) => outcome(r, r.multi, t) === 'wrong').length + negs.filter((r) => outcome(r, r.multi, t) === 'wrong').length
const cands: Array<{ e2: number; m2: number; ok: number; okPhoto: number }> = []
for (let e2 = 0.55; e2 <= 0.7601; e2 += 0.01) {
  for (let m2 = 0.08; m2 <= 0.2001; m2 += 0.01) {
    const t = { ...MATCH, exact2: +e2.toFixed(2), margin2: +m2.toFixed(2) }
    if (errors(t) || errors({ ...t, exact2: t.exact2 - 0.02, margin2: t.margin2 - 0.02 })) continue
    cands.push({ e2: t.exact2, m2: t.margin2, ok: pos.filter((r) => outcome(r, r.multi, t) === 'ok').length, okPhoto: pos.filter((r) => r.group === 'photo' && outcome(r, r.multi, t) === 'ok').length })
  }
}
cands.sort((a, b) => b.ok - a.ok || b.e2 - a.e2 || b.m2 - a.m2)
console.log('\n== tier-2 grid (multi-view; 0 errors here AND one step looser) — best 8 ==')
for (const c of cands.slice(0, 8)) console.log(`exact2 ${c.e2.toFixed(2)} margin2 ${c.m2.toFixed(2)} → EXACT ok ${c.ok}/${pos.length} (photo-like ${c.okPhoto}/${pos.filter((r) => r.group === 'photo').length})`)
const negLead = negs.map((r) => ({ top: top1(r.multi), lead: top1(r.multi) - top2(r.multi), name: `${r.case} ${r.name}` })).sort((a, b) => b.lead - a.lead)
console.log('negatives with the biggest lead:', negLead.slice(0, 5).map((n) => `${f3(n.top)}/lead ${f3(n.lead)} ${n.name}`).join(' · '))

// ---------------------------------------------------------------- SIMILAR sweep (multi-view, thresholds.ts EXACT rule)
console.log('\n== SIMILAR threshold sweep (multi-view) ==')
console.log('similar  off-topic shown  in-domain shown  positives where ours is not shown')
for (let s = 0.45; s <= 0.6501; s += 0.025) {
  const t = { ...MATCH, similar: +s.toFixed(3) }
  const shown = (g: Row['group']) => negs.filter((r) => r.group === g && outcome(r, r.multi, t) !== 'none')
  const lost = pos.filter((r) => {
    const o = outcome(r, r.multi, t)
    return o === 'none' || (o !== 'ok' && (r.multi.correct < t.similar || r.multi.rank > t.maxSimilar))
  })
  console.log(`${t.similar.toFixed(3)}    ${String(shown('offTopic').length).padStart(3)}/${negs.filter((r) => r.group === 'offTopic').length}           ${String(shown('inDomain').length).padStart(3)}/${negs.filter((r) => r.group === 'inDomain').length}          ${lost.length}/${pos.length}`)
}

const miss = results.filter((r) => r.group === 'copy' && MUST_EXACT.includes(r.case) && r.multi.rank > 3)
if (miss.length) {
  console.log('\nnot in the top 3 on (a)/(b) (multi-view):')
  for (const r of miss) console.log(`  ${r.case.padEnd(9)} ${r.name}  rank ${r.multi.rank}  correct ${f3(r.multi.correct)}  top ${r.multi.top[0].slug} ${f3(top1(r.multi))}`)
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ model: MODEL_ID, dtype: MODEL_DTYPE, views: vec.INDEX_VIEWS, thresholds: MATCH, index: rawIndex, results }, null, 1))
