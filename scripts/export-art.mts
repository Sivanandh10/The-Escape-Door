// Exports the site's static art ONCE so the big SVG markup stays out of every HTML page / RSC payload.
//   npx --no-install tsx scripts/export-art.mts [--force] [--dry]
// Writes (content-addressed, committed):
//   public/art/<key>.svg            arc motifs for every preset × catalogue entry (src/lib/art/presets.ts)
//   public/art/<key>.webp, -500.webp product subjects (bare tee/hoodie/flat-lay, alpha) — rendered in Chromium
//                                   with the real webfonts (an SVG <img> can't use page fonts)
//   public/art/brand-<name>-<key>.svg  Badge / Kado (React components rendered to static markup)
//   src/lib/art/static-art.generated.ts  the key manifest the components check before rendering a file
// Keys hash the exact markup (src/lib/art/static.ts), so a changed builder or catalogue entry simply
// misses the manifest and that piece renders inline until this script runs again. Unchanged keys are
// skipped (no browser launched when nothing raster changed). Needs internet for Google Fonts.
import fs from 'node:fs'
import path from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import * as SEED from '../src/lib/data/seed'
import * as STATIC from '../src/lib/art/static'
import * as PRESETS from '../src/lib/art/presets'
import * as COMPOSE from '../src/lib/art/compose'
import * as MASCOT from '../src/components/brand/Mascot'
import * as BADGE from '../src/components/brand/Badge'

// TS modules compile to CJS under tsx (package has no "type") → unwrap the interop object
const pick = <T,>(m: unknown, k: string): T => ((m as Record<string, unknown>)[k] ?? (m as { default: Record<string, unknown> }).default[k]) as T
const { collections, products } = { collections: pick<typeof SEED.collections>(SEED, 'collections'), products: pick<typeof SEED.products>(SEED, 'products') }
const motifDoc = pick<typeof STATIC.motifDoc>(STATIC, 'motifDoc')
const productDoc = pick<typeof STATIC.productDoc>(STATIC, 'productDoc')
const artKey = pick<typeof STATIC.artKey>(STATIC, 'artKey')
const MOTIF_PRESETS = pick<typeof PRESETS.MOTIF_PRESETS>(PRESETS, 'MOTIF_PRESETS')
const SHOP_HERO_DEFAULT = pick<typeof PRESETS.SHOP_HERO_DEFAULT>(PRESETS, 'SHOP_HERO_DEFAULT')
const sidesFor = pick<typeof COMPOSE.sidesFor>(COMPOSE, 'sidesFor')
const Mascot = pick<typeof MASCOT.Mascot>(MASCOT, 'Mascot')
const Badge = pick<typeof BADGE.Badge>(BADGE, 'Badge')

const root = path.resolve(import.meta.dirname, '..')
const OUT = path.join(root, 'public/art')
const MANIFEST = path.join(root, 'src/lib/art/static-art.generated.ts')
const FORCE = process.argv.includes('--force')
const DRY = process.argv.includes('--dry')
fs.mkdirSync(OUT, { recursive: true })

// ── 1 · motifs (vector) ────────────────────────────────────────────────────────────────────────────
const svgFiles = new Map<string, string>() // key → doc
const addMotif = (doc: string | null) => {
  if (doc) svgFiles.set(artKey(doc), doc)
}
const colOf = (slug: string) => collections.find((c) => c.slug === slug)
for (const c of collections) {
  addMotif(motifDoc(MOTIF_PRESETS.door(c)))
  addMotif(motifDoc(MOTIF_PRESETS.arcHero(c)))
  addMotif(motifDoc(MOTIF_PRESETS.strip(c)))
  addMotif(motifDoc(MOTIF_PRESETS.about(c)))
}
addMotif(motifDoc(MOTIF_PRESETS.shopHero(SHOP_HERO_DEFAULT.motif, SHOP_HERO_DEFAULT.accentA, SHOP_HERO_DEFAULT.accentB)))
addMotif(motifDoc(MOTIF_PRESETS.forgeCard()))
for (const p of products) {
  const c = colOf(p.collection)
  const m = { slug: p.slug, motif: c?.motif ?? 'speedlines', a: c?.accentA ?? '#6D3BFF', b: c?.accentB ?? '#C9B8FF' }
  if (p.type === 'polaroid') addMotif(motifDoc(MOTIF_PRESETS.wallPolaroid(m)))
  if (p.type === 'poster') addMotif(motifDoc(MOTIF_PRESETS.wallPoster(m)))
  if (p.type === 'badge') addMotif(motifDoc(MOTIF_PRESETS.wallBadge(m)))
  if (p.type === 'bookmark') addMotif(motifDoc(MOTIF_PRESETS.wallBookmark(m)))
}

// ── 2 · product subjects (raster) ──────────────────────────────────────────────────────────────────
const rasterJobs = new Map<string, { doc: string; label: string }>()
for (const p of products) {
  for (const side of sidesFor(p.type)) {
    const doc = productDoc(p, { side })
    rasterJobs.set(artKey(doc), { doc, label: `${p.slug}-${side}` })
  }
}

// ── 3 · brand components ───────────────────────────────────────────────────────────────────────────
const brandDocs: Record<string, string> = {
  badge: renderToStaticMarkup(h(Badge, { title: '' })),
  'kado-wave-anim-flat': renderToStaticMarkup(h(Mascot, { mood: 'wave', animate: true, shadow: false, title: '' })),
  'kado-sleepy': renderToStaticMarkup(h(Mascot, { mood: 'sleepy', title: '' })),
}
const brand: Record<string, string> = {}
const brandFiles = new Map<string, string>()
for (const [name, doc] of Object.entries(brandDocs)) {
  const file = `brand-${name}-${artKey(doc)}.svg`
  brand[name] = `/art/${file}`
  brandFiles.set(file, doc)
}

// ── write ──────────────────────────────────────────────────────────────────────────────────────────
const HEAD = '<!-- Generated by scripts/export-art.mts — original art for The Escape Door -->\n'
const keep = new Set<string>()
let wroteSvg = 0
for (const [k, doc] of svgFiles) {
  const f = `${k}.svg`
  keep.add(f)
  if (!DRY && (FORCE || !fs.existsSync(path.join(OUT, f)))) {
    fs.writeFileSync(path.join(OUT, f), HEAD + doc)
    wroteSvg++
  }
}
for (const [f, doc] of brandFiles) {
  keep.add(f)
  if (!DRY && (FORCE || !fs.existsSync(path.join(OUT, f)))) {
    fs.writeFileSync(path.join(OUT, f), HEAD + doc)
    wroteSvg++
  }
}

const todo = [...rasterJobs].filter(([k]) => {
  keep.add(`${k}.webp`)
  keep.add(`${k}-500.webp`)
  return FORCE || !fs.existsSync(path.join(OUT, `${k}.webp`)) || !fs.existsSync(path.join(OUT, `${k}-500.webp`))
})
console.log(`motifs ${svgFiles.size} (${wroteSvg} written) · brand ${brandFiles.size} · products ${rasterJobs.size} (${todo.length} to render)`)

if (todo.length && !DRY) {
  const { chromium } = await import('@playwright/test')
  const FONTS_CSS =
    'https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600&family=Dela+Gothic+One&family=JetBrains+Mono:wght@500&family=Noto+Sans+JP:wght@700;900&display=block'
  const W = 1000
  const H = 1100
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  let n = 0
  try {
    for (const [k, job] of todo) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS_CSS}"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}#art{width:${W}px;height:${H}px;line-height:0}#art svg{display:block;width:100%;height:100%}</style></head><body><div id="art">${job.doc}</div></body></html>`
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 120000 })
      // fonts are unicode-range sliced: request every glyph actually used before the shot
      await page.evaluate(async () => {
        const t = document.getElementById('art')?.textContent || 'A'
        await Promise.all(['Anton', 'Dela Gothic One', '"Noto Sans JP"', '"JetBrains Mono"', 'Caveat'].map((f) => document.fonts.load(`700 40px ${f}`, t)))
        await document.fonts.ready
      })
      const png = await page.locator('#art').screenshot({ type: 'png', omitBackground: true, animations: 'disabled' })
      const big = await sharp(png).webp({ quality: 80, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer()
      const small = await sharp(png).resize(500).webp({ quality: 80, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer()
      fs.writeFileSync(path.join(OUT, `${k}.webp`), big)
      fs.writeFileSync(path.join(OUT, `${k}-500.webp`), small)
      n++
      console.log(`✓ ${job.label} → ${k}.webp ${(big.length / 1024).toFixed(0)} KB · 500px ${(small.length / 1024).toFixed(0)} KB`)
    }
  } finally {
    await browser.close()
  }
  console.log(`rendered ${n} product subject(s)`)
}

if (!DRY) {
  // drop files no preset / product references any more
  for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) fs.rmSync(path.join(OUT, f))
  const list = (keys: Iterable<string>) => [...keys].sort().map((k) => `  '${k}',`).join('\n')
  const ts = `// GENERATED by scripts/export-art.mts — do not edit.
export const STATIC_SVG: ReadonlySet<string> = new Set<string>([
${list(svgFiles.keys())}
])
export const STATIC_RASTER: ReadonlySet<string> = new Set<string>([
${list(rasterJobs.keys())}
])
export const BRAND_ART: Readonly<Record<string, string>> = ${JSON.stringify(brand, null, 2)}
`
  fs.writeFileSync(MANIFEST, ts)
  console.log(`manifest → ${path.relative(root, MANIFEST)}`)
}
