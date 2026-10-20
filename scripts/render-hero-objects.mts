// Renders the STATIC product objects that float inside the hero door (S01), as transparent cut-outs.
//   npx --no-install tsx scripts/render-hero-objects.mts
// Hard-coded set (owner request: static, not admin-dynamic). Each object is the bare art-builder garment /
// flat-lay (no colour-block card) rendered in Chromium with the real webfonts, trimmed to its alpha, padded
// (room for the runtime rim light + shadow) and written as alpha WebP:
//   public/hero/<id>.webp (≈900px tall, WebGL + desktop) and public/hero/<id>-600.webp (phones)
//   src/components/home/s01/hero-objects.generated.ts  (pixel sizes, so layout never shifts)
// Needs internet for Google Fonts. Re-run only when the list below or the art builders change.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import * as SEED from '../src/lib/data/seed'
import * as STATIC from '../src/lib/art/static'

const pick = <T,>(m: unknown, k: string): T => ((m as Record<string, unknown>)[k] ?? (m as { default: Record<string, unknown> }).default[k]) as T
const products = pick<typeof SEED.products>(SEED, 'products')
const productDoc = pick<typeof STATIC.productDoc>(STATIC, 'productDoc')

/** id → which seed product + side. Order here is the scroll order inside the door. */
const OBJECTS: Array<{ id: string; slug: string; side: 'front' | 'back' }> = [
  { id: 'tee-cursed-static', slug: 'cursed-static-oversized-t-shirt', side: 'back' },
  { id: 'hoodie-ember-night', slug: 'ember-night-hoodie', side: 'back' },
  { id: 'tee-flame-ribbon', slug: 'flame-breath-ribbon-oversized-t-shirt', side: 'back' },
  { id: 'polaroids-talisman', slug: 'talisman-strip-polaroid-prints', side: 'front' },
]

const root = path.resolve(import.meta.dirname, '..')
const OUT = path.join(root, 'public/hero')
const MANIFEST = path.join(root, 'src/components/home/s01/hero-objects.generated.ts')
fs.mkdirSync(OUT, { recursive: true })

const FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600&family=Dela+Gothic+One&family=JetBrains+Mono:wght@500&family=Noto+Sans+JP:wght@700;900&display=block'
const W = 1000
const H = 1100
const SCALE = 2 // render at 2x, then downsample → crisp print text
const TARGET = 900 // long edge of the main file
const PAD = 0.07 // transparent margin (share of the long edge) for rim + shadow

const { chromium } = await import('@playwright/test')
const browser = await chromium.launch()
const sizes: Record<string, { w: number; h: number }> = {}
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  for (const o of OBJECTS) {
    const p = products.find((x) => x.slug === o.slug)
    if (!p) throw new Error(`seed product not found: ${o.slug}`)
    const doc = productDoc(p, { side: o.side })
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS_CSS}"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}#art{width:${W}px;height:${H}px;line-height:0}#art svg{display:block;width:100%;height:100%}</style></head><body><div id="art">${doc}</div></body></html>`
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 120000 })
    await page.evaluate(async () => {
      const t = document.getElementById('art')?.textContent || 'A'
      await Promise.all(['Anton', 'Dela Gothic One', '"Noto Sans JP"', '"JetBrains Mono"', 'Caveat'].map((f) => document.fonts.load(`700 40px ${f}`, t)))
      await document.fonts.ready
    })
    const png = await page.locator('#art').screenshot({ type: 'png', omitBackground: true, animations: 'disabled' })
    // trim to the alpha silhouette, fit the long edge, pad evenly
    const trimmed = await sharp(png).trim({ threshold: 1 }).toBuffer()
    const meta = await sharp(trimmed).metadata()
    const long = Math.max(meta.width!, meta.height!)
    const inner = Math.round(TARGET * (1 - PAD * 2))
    const resized = await sharp(trimmed)
      .resize({ ...(meta.width! >= meta.height! ? { width: inner } : { height: inner }), kernel: 'lanczos3' })
      .toBuffer()
    const rm = await sharp(resized).metadata()
    const pad = Math.round(TARGET * PAD)
    const padded = await sharp(resized)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    const full = { w: rm.width! + pad * 2, h: rm.height! + pad * 2 }
    const big = await sharp(padded).webp({ quality: 86, alphaQuality: 95, effort: 6, smartSubsample: true }).toBuffer()
    const small = await sharp(padded)
      .resize(Math.round((full.w * 600) / Math.max(full.w, full.h)))
      .webp({ quality: 82, alphaQuality: 92, effort: 6, smartSubsample: true })
      .toBuffer()
    fs.writeFileSync(path.join(OUT, `${o.id}.webp`), big)
    fs.writeFileSync(path.join(OUT, `${o.id}-600.webp`), small)
    sizes[o.id] = full
    console.log(`✓ ${o.id} (${o.slug} ${o.side}) ${full.w}×${full.h} · ${(big.length / 1024).toFixed(0)} KB · 600px ${(small.length / 1024).toFixed(0)} KB (src long edge ${long})`)
  }
} finally {
  await browser.close()
}

const ts = `// GENERATED by scripts/render-hero-objects.mts — do not edit.
export const HERO_OBJECT_SIZES: Readonly<Record<string, { w: number; h: number }>> = ${JSON.stringify(sizes, null, 2)}
`
fs.writeFileSync(MANIFEST, ts)
console.log(`manifest → ${path.relative(root, MANIFEST)}`)
