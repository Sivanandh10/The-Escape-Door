// Calibrates the visual-search thresholds on the real catalogue. Owner: SEARCH. Read-only (no DB writes).
//   node scripts/calibrate-image-search.mts            products from Supabase (.env.local) or the seed catalogue
//   node scripts/calibrate-image-search.mts --web      + 12 random real photos from picsum.photos as extra negatives
//   node scripts/calibrate-image-search.mts --json out.json   also write every score
//
// What it measures (model + dtype from src/lib/visual-search/thresholds.ts, vectors int8-quantised like the DB):
//   (a) every product image, unchanged                         → should be EXACT top-1
//   (b) the same image as JPEG q60 / resized to 480 px / centre-cropped 80 % / rotated 8° / "photographed"
//       (brightness + saturation shift, blur, sensor noise, JPEG q75) / all of those at once
//                                                              → should stay EXACT top-1 (at least top-3)
//   (c) the garment cut out and laid on a table-like background → informative (closest to a real phone photo)
//   (d) ≥ 10 unrelated images (plain colours, gradients, text, noise, checkerboard, stripes, brand drawings and
//       textures from public/; optional real photos)          → must return NO RESULT
// Then it suggests thresholds and prints the outcome with the thresholds currently in thresholds.ts.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type * as Lib from './lib/visual-search-node.mjs'

// runtime: the .mts source (Node strips the types); the type-only import above lets tsc follow it
const L: typeof Lib = await import(new URL('./lib/visual-search-node.mts', import.meta.url).href)
const { createEmbedder, fetchProducts, loadImageBytes, productImages, ROOT, MATCH, MODEL_ID, MODEL_DTYPE, EMBED_DIM, vec } = L

const args = process.argv.slice(2)
const WEB = args.includes('--web')
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null

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

const { rows, source } = await fetchProducts({ publishedOnly: true })
console.log(`catalogue: ${rows.length} published products (${source}) · model ${MODEL_ID} ${MODEL_DTYPE} · dim ${EMBED_DIM}`)
const embedder = await createEmbedder()

// index (int8 round trip, exactly like product_image_embeddings → /api/image-index)
type P = { slug: string; vecs: Float32Array[] }
const index: P[] = []
const sources: Array<{ slug: string; src: string; bytes: Buffer }> = []
let quantLoss = 1
const t0 = Date.now()
for (const r of rows) {
  const p: P = { slug: r.slug, vecs: [] }
  for (const im of productImages(r)) {
    try {
      const bytes = await loadImageBytes(im.src)
      const v = await embedder.embed(bytes)
      const d = vec.decodeVec(vec.encodeVec(v), EMBED_DIM)!
      quantLoss = Math.min(quantLoss, vec.dot(v, d))
      p.vecs.push(d)
      sources.push({ slug: r.slug, src: im.src, bytes })
    } catch (e) {
      console.warn(`! ${r.slug} ${im.src}: ${(e as Error).message}`)
    }
  }
  if (p.vecs.length) index.push(p)
}
console.log(`indexed ${sources.length} images of ${index.length} products in ${((Date.now() - t0) / 1000).toFixed(1)} s · int8 round-trip min cos ${quantLoss.toFixed(5)}`)

// nearest OTHER product for each original image = how alike our own designs are
const crossBest: number[] = []

interface Q { case: string; slug: string; src: string; correct: number; wrong: number; rank: number; topSlug: string; second: number }
const results: Q[] = []
let seed = 1
for (const s of sources) {
  for (const [name, fn] of Object.entries(PERTURB)) {
    const bytes = await fn(s.bytes, seed++)
    const v = await embedder.embed(bytes)
    const ranked = vec.rankProducts(v, index)
    const rank = ranked.findIndex((r) => r.product.slug === s.slug)
    const correct = rank >= 0 ? ranked[rank].score : -1
    const wrong = ranked.find((r) => r.product.slug !== s.slug)?.score ?? -1
    results.push({ case: name, slug: s.slug, src: s.src, correct, wrong, rank: rank + 1, topSlug: ranked[0].product.slug, second: ranked[1]?.score ?? -1 })
    if (name === 'original') crossBest.push(wrong)
  }
}

const negs = await negatives()
const negResults: Array<{ name: string; top: number; slug: string; kind: string }> = []
for (const n of negs) {
  const v = await embedder.embed(n.bytes)
  const ranked = vec.rankProducts(v, index)
  negResults.push({ name: n.name, top: ranked[0].score, slug: ranked[0].product.slug, kind: vec.classify(ranked, MATCH).kind })
}

// ---------------------------------------------------------------- report
console.log('\n== positives: correct-product score / best wrong product ==')
console.log('case        n    top1    top3   corr p05  corr med  wrong max  margin p05')
for (const name of Object.keys(PERTURB)) {
  const rs = results.filter((r) => r.case === name)
  const margins = rs.map((r) => r.correct - r.wrong)
  console.log(
    `${name.padEnd(10)} ${String(rs.length).padStart(3)}  ${pct(rs.filter((r) => r.rank === 1).length, rs.length).padStart(6)}  ${pct(rs.filter((r) => r.rank <= 3).length, rs.length).padStart(6)}  ` +
      `${f3(q(rs.map((r) => r.correct), 0.05)).padStart(9)}  ${f3(q(rs.map((r) => r.correct), 0.5)).padStart(8)}  ${f3(Math.max(...rs.map((r) => r.wrong))).padStart(9)}  ${f3(q(margins, 0.05)).padStart(10)}`,
  )
}
console.log(`\nown designs: nearest other product (originals) median ${f3(q(crossBest, 0.5))} · p95 ${f3(q(crossBest, 0.95))} · max ${f3(Math.max(...crossBest))}`)

console.log('\n== negatives: best product score ==')
for (const n of [...negResults].sort((a, b) => b.top - a.top)) console.log(`${f3(n.top)}  ${n.kind.padEnd(7)}  ${n.name}  (→ ${n.slug})`)
const negMax = Math.max(...negResults.map((n) => n.top))

// suggestion: similar just above the worst negative; exact low enough for p05 of the hard positives (combo),
// high enough that no negative and no wrong-product top-1 gets near it.
const hard = results.filter((r) => MUST_EXACT.includes(r.case))
const sugSimilar = Math.ceil((negMax + 0.03) * 100) / 100
const sugExact = Math.max(sugSimilar + 0.1, Math.floor(q(hard.filter((r) => r.rank === 1).map((r) => r.correct), 0.02) * 100) / 100)
console.log(`\nsuggested: similar ≥ ${sugSimilar.toFixed(2)} (worst negative ${f3(negMax)} + 0.03) · exact ≥ ${sugExact.toFixed(2)} (2nd percentile of correct top-1 scores on (a)+(b))`)

console.log(`\n== outcome with thresholds.ts: exact ≥ ${MATCH.exact} & margin ≥ ${MATCH.margin}, similar ≥ ${MATCH.similar} ==`)
console.log('case        n   EXACT ok  WRONG exact  SIMILAR, ours in top 3  SIMILAR, ours lower  NO RESULT')
for (const name of Object.keys(PERTURB)) {
  const rs = results.filter((r) => r.case === name)
  let ok = 0, bad = 0, sim3 = 0, simLow = 0, none = 0
  for (const r of rs) {
    const top = Math.max(r.correct, r.wrong)
    const isExact = top >= MATCH.exact && top - r.second >= MATCH.margin
    if (isExact && r.topSlug === r.slug) ok++
    else if (isExact) bad++
    else if (top < MATCH.similar) none++
    else if (r.rank <= 3 && r.correct >= MATCH.similar) sim3++
    else simLow++
  }
  console.log(`${name.padEnd(10)} ${String(rs.length).padStart(3)}  ${pct(ok, rs.length).padStart(8)}  ${pct(bad, rs.length).padStart(11)}  ${pct(sim3, rs.length).padStart(22)}  ${pct(simLow, rs.length).padStart(19)}  ${pct(none, rs.length).padStart(9)}`)
}
const negOk = negResults.filter((n) => n.kind === 'none').length
console.log(`negatives: ${negOk}/${negResults.length} NO RESULT`)

const miss = results.filter((r) => MUST_EXACT.includes(r.case) && r.rank !== 1)
if (miss.length) {
  console.log('\nnot top-1 on (a)/(b):')
  for (const r of miss.slice(0, 30)) console.log(`  ${r.case.padEnd(9)} ${r.src}  rank ${r.rank}  correct ${f3(r.correct)}  top ${r.topSlug} ${f3(Math.max(r.wrong, r.correct))}`)
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ model: MODEL_ID, dtype: MODEL_DTYPE, results, negatives: negResults, crossBest }, null, 1))
