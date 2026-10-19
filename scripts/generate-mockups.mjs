#!/usr/bin/env node
// Generate SAMPLE product mockups from the catalogue (owner: F3b).
//
//   node scripts/generate-mockups.mjs [--base=http://localhost:3100] [--force] [--only=slug,slug2]
//        [--out=public/mockups] [--png=qa/f3b] [--concurrency=3]
//
// For every /mockups/<slug>-<side>.webp referenced by src/lib/data/seed.ts (job list served by
// /lab/mockup/index.json), it opens /lab/mockup/<slug>/<side>, screenshots the 1200x1500
// composition with Playwright, and writes via sharp:
//   public/mockups/<slug>-<side>.webp       (1200x1500, q≈78, target < 120 KB)
//   public/mockups/<slug>-<side>-600.webp   (600x750)
// Deterministic + idempotent: the composition's SVG markup is hashed into
// public/mockups/manifest.json; unchanged jobs are skipped unless --force.
//
// Two modes:
//   server (default)  needs the dev server (or `next start`) running at --base; uses /lab/mockup/*.
//   --standalone      no server: renders the compositions in Node (src/lib/art) and screenshots
//                     self-contained HTML (Google Fonts: Anton, Dela Gothic One, Noto Sans JP,
//                     JetBrains Mono, Caveat). Must run under tsx so the TS sources resolve:
//                       npx -y tsx scripts/generate-mockups.mjs --standalone [--force]
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  }),
)
const BASE = String(args.base || process.env.MOCKUP_BASE || 'http://localhost:3100').replace(/\/$/, '')
const OUT = path.resolve(String(args.out || 'public/mockups'))
const PNG = args.png ? path.resolve(String(args.png)) : null
const FORCE = !!args.force
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null
const CONC = Math.max(1, Number(args.concurrency || 3))
const RENDER_VERSION = 'v1' // bump to invalidate every cached file
const TARGET_BYTES = 120 * 1024

fs.mkdirSync(OUT, { recursive: true })
if (PNG) fs.mkdirSync(PNG, { recursive: true })
const manifestPath = path.join(OUT, 'manifest.json')
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {}

const STANDALONE = !!args.standalone
let allJobs, width, height, art, catalog
if (STANDALONE) {
  catalog = await import('../src/lib/art/catalog.ts')
  art = await import('../src/lib/art/index.ts')
  allJobs = catalog.mockupJobs()
  width = art.MOCKUP_W
  height = art.MOCKUP_H
} else {
  const res = await fetch(`${BASE}/lab/mockup/index.json`).catch((e) => {
    console.error(`Cannot reach ${BASE} — start the dev server first, or use --standalone. ${e.message}`)
    process.exit(1)
  })
  if (!res.ok) {
    console.error(`GET /lab/mockup/index.json → ${res.status} (try --standalone)`)
    process.exit(1)
  }
  ;({ jobs: allJobs, width, height } = await res.json())
}
const FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600&family=Dela+Gothic+One&family=JetBrains+Mono:wght@500&family=Noto+Sans+JP:wght@700;900&display=block'
/** standalone: the composition SVG for a job (same builder the lab route uses) */
function localSvg(job) {
  const product = catalog.artProduct(job.slug)
  if (!product) throw new Error(`unknown product ${job.slug}`)
  return art.compositionSvg(product, { side: job.side, collection: catalog.artCollection(product.collection) })
}
const htmlFor = (svg) =>
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS_CSS}"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}#mockup{width:${width}px;height:${height}px;line-height:0}</style></head><body><div id="mockup">${svg}</div></body></html>`
const jobs = allJobs.filter((j) => !ONLY || ONLY.some((o) => j.slug.includes(o) || j.file.includes(o)))
console.log(`${jobs.length} mockup job(s) → ${path.relative(process.cwd(), OUT)}`)

/** Hash of the composition markup from the server HTML (cheap: no browser). */
async function markupHash(url) {
  const html = await (await fetch(url)).text()
  const i = html.indexOf('id="mockup"')
  if (i < 0) throw new Error(`no #mockup in ${url}`)
  const j = html.indexOf('</svg>', i)
  // strip next/font hashed class/family names so a font-loader rebuild doesn't bust the cache
  const markup = html.slice(i, j).replace(/__[A-Za-z_]+_[0-9a-f]{6,}/g, 'F')
  return crypto.createHash('sha256').update(RENDER_VERSION + markup).digest('hex').slice(0, 16)
}

async function encode(png, file) {
  let q = 78
  let buf
  for (;;) {
    buf = await sharp(png).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer()
    if (buf.length <= TARGET_BYTES || q <= 58) break
    q -= 6
  }
  fs.writeFileSync(path.join(OUT, file), buf)
  const small = await sharp(png).resize(600).webp({ quality: Math.min(q + 4, 80), effort: 6 }).toBuffer()
  fs.writeFileSync(path.join(OUT, file.replace(/\.webp$/, '-600.webp')), small)
  return { q, bytes: buf.length, smallBytes: small.length }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
let done = 0
let skipped = 0
const failures = []

async function run(job) {
  const url = `${BASE}/lab/mockup/${job.slug}/${job.side}?nopreload`
  const svg = STANDALONE ? localSvg(job) : null
  const h = STANDALONE ? crypto.createHash('sha256').update(RENDER_VERSION + svg).digest('hex').slice(0, 16) : await markupHash(url)
  const exists = fs.existsSync(path.join(OUT, job.file)) && fs.existsSync(path.join(OUT, job.file.replace(/\.webp$/, '-600.webp')))
  if (!FORCE && exists && manifest[job.file] === h && !PNG) {
    skipped++
    return
  }
  const page = await ctx.newPage()
  try {
    if (STANDALONE) {
      await page.setContent(htmlFor(svg), { waitUntil: 'networkidle', timeout: 120000 })
      // fonts are unicode-range sliced: ask for every glyph actually used before shooting
      await page.evaluate(async () => {
        const t = document.getElementById('mockup')?.textContent ?? ''
        await Promise.all(['Anton', 'Dela Gothic One', '"Noto Sans JP"', '"JetBrains Mono"', 'Caveat'].map((f) => document.fonts.load(`700 40px ${f}`, t || 'A')))
        await document.fonts.ready
      })
    } else await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 })
    await page.evaluate(async () => {
      const el = document.getElementById('mockup')
      if (!el) throw new Error('no #mockup')
      // isolate the composition: no header, cursor, overlays or dev tools in the shot
      document.body.replaceChildren(el)
      Object.assign(document.body.style, { margin: '0', padding: '0', background: 'transparent', overflow: 'hidden' })
      document.documentElement.style.overflow = 'hidden'
      window.scrollTo(0, 0)
      await document.fonts.ready
    })
    await page.waitForTimeout(250)
    await page.evaluate(() => document.fonts.ready)
    const png = await page.locator('#mockup').screenshot({ type: 'png', animations: 'disabled' })
    if (PNG) fs.writeFileSync(path.join(PNG, job.file.replace(/\.webp$/, '.png')), png)
    const r = await encode(png, job.file)
    manifest[job.file] = h
    done++
    console.log(`✓ ${job.file}  ${(r.bytes / 1024).toFixed(0)} KB (q${r.q}) · 600px ${(r.smallBytes / 1024).toFixed(0)} KB`)
  } catch (e) {
    failures.push(`${job.file}: ${e.message}`)
    console.error(`✗ ${job.file}: ${e.message}`)
  } finally {
    await page.close()
  }
}

const queue = [...jobs]
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (queue.length) await run(queue.shift())
  }),
)
await browser.close()
fs.writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n')
console.log(`done: ${done} rendered, ${skipped} unchanged, ${failures.length} failed`)
if (failures.length) process.exit(1)
