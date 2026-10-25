#!/usr/bin/env node
// Social share cards (Open Graph / Twitter) — owner: SHARE.
//
//   node scripts/generate-og.mjs [--base=http://localhost:3100] [--only=slug,slug2] [--q=82]
//
// Writes 1200x630 JPEGs (WhatsApp ignores WebP; every card < 300 KB) into public/og/:
//   default.jpg                    root card: wordmark, tagline, tee + hoodie art
//   products/<slug>.jpg            product art + name + price
//   arcs/<collection>.jpg          arc name, JP title, tagline, three designs
//   shop/<category>.jpg            category label, price line, three designs
//   index.json                     { v, products, arcs, shop } slug → content hash (cache-buster ?v=)
// Products come from GET <base>/api/image-index (published products: name, price, image, type, arc),
// falling back to the live site, so new admin products get a card on the next run. Product art is the
// generated /mockups composition (back print for apparel) or the product's own photo.
// Rendered with Playwright (Google Fonts: Anton, Dela Gothic One, DM Sans, JetBrains Mono), encoded with sharp.
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
const BASE = String(args.base || process.env.OG_BASE || 'http://localhost:3100').replace(/\/$/, '')
const LIVE = 'https://the-escape-door.netlify.app'
const OUT = path.resolve('public/og')
const PUB = path.resolve('public')
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null
const Q0 = Number(args.q || 82)
const MAX_BYTES = 290 * 1024
const W = 1200
const H = 630

const INK = '#0B0B0F'
const PAPER = '#F4EFE6'
const VOLT = '#FFE14D'
const LAV = '#C9B8FF'
const DOOR = '#6D3BFF'
const HYPE = '#FF2D3D'

// DESIGN §2 arc table (fallback for an arc added later: door purple + volt).
const ARCS = {
  'jujutsu-kaisen': { name: 'Jujutsu Kaisen', jp: '呪術廻戦', a: '#4B2BFF', b: '#A78BFF', tagline: 'Cursed static, pressed in ink.' },
  'attack-on-titan': { name: 'Attack on Titan', jp: '進撃の巨人', a: '#A39780', b: '#C8102E', tagline: 'Everything past the wall.' },
  'demon-slayer': { name: 'Demon Slayer', jp: '鬼滅の刃', a: '#FF6A13', b: '#12A5A0', tagline: 'Flame on one side, tide on the other.' },
  'one-piece': { name: 'One Piece', jp: 'ワンピース', a: '#1C6FE0', b: '#F2C230', tagline: 'Sea blue, sun yellow, no map.' },
  naruto: { name: 'Naruto', jp: 'ナルト', a: '#FF7A00', b: '#1B2A4A', tagline: 'Orange hour, spiral wind.' },
  'beyond-anime': { name: 'Beyond Anime', jp: 'その先へ', a: '#FFB8DE', b: '#F4EFE6', tagline: 'One more door, every other fandom.' },
}
// shop/[category] — label, price line (from the category titles), JP + colours (category hero table).
const CATS = {
  'oversized-t-shirts': { label: 'Oversized tees', line: '₹800 · under ₹1000', jp: 'オーバーサイズ', a: '#FFE14D', b: '#C9B8FF', match: (p) => p.type === 'tshirt' && /oversized/i.test(p.name) },
  't-shirts': { label: 'Anime T-shirts', line: 'Regular & baby tees', jp: 'Tシャツ', a: '#C9B8FF', b: '#FFE14D', match: (p) => p.type === 'tshirt' && !/oversized/i.test(p.name) },
  hoodies: { label: 'Anime hoodies', line: '280 to 600 GSM', jp: 'パーカー', a: '#6D3BFF', b: '#C9B8FF', match: (p) => p.type === 'hoodie' },
  polaroids: { label: 'Polaroid prints', line: '₹50 each · 3 for ₹100', jp: 'ポラロイド', a: '#FFB8DE', b: '#FFE14D', match: (p) => p.type === 'polaroid' },
  bookmarks: { label: 'Bookmarks', line: 'Plain & magnetic', jp: 'しおり', a: '#C9B8FF', b: '#FFB8DE', match: (p) => p.type === 'bookmark' },
  posters: { label: 'Anime posters', line: '6 for ₹1000', jp: 'ポスター', a: '#FFE14D', b: '#FF2D3D', match: (p) => p.type === 'poster' },
  badges: { label: 'Pin badges', line: '₹50 each · 5 for ₹200', jp: '缶バッジ', a: '#FFB8DE', b: '#6D3BFF', match: (p) => p.type === 'badge' },
  stickers: { label: 'Stickers', line: '₹30 each', jp: 'ステッカー', a: '#FFE14D', b: '#C9B8FF', match: (p) => p.type === 'sticker' },
  'cosplay-props': { label: 'Cosplay props', line: 'Katanas · capes · LED & basic', jp: 'コスプレ', a: '#FF6A13', b: '#12A5A0', match: (p) => ['katana', 'cape', 'hat', 'cosplay'].includes(p.type) },
  accessories: { label: 'Accessories', line: 'Keychains · earrings · figurines', jp: 'アクセサリー', a: '#C9B8FF', b: '#FFE14D', match: (p) => ['keychain', 'accessory', 'figurine'].includes(p.type) },
}
const TYPE_LABEL = {
  tshirt: 'T-shirt', hoodie: 'Hoodie', polaroid: 'Polaroids', poster: 'Poster', bookmark: 'Bookmark', badge: 'Badge',
  sticker: 'Sticker', keychain: 'Keychain', accessory: 'Accessory', figurine: 'Figurine', cape: 'Cape', katana: 'Katana',
  hat: 'Hat', tote: 'Tote', stationery: 'Stationery', cosplay: 'Cosplay',
}
const APPAREL = new Set(['tshirt', 'hoodie'])
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// ---------------------------------------------------------------- data
async function loadIndex() {
  for (const origin of [BASE, LIVE]) {
    try {
      const r = await fetch(`${origin}/api/image-index`)
      if (!r.ok) throw new Error(String(r.status))
      const j = await r.json()
      if (Array.isArray(j.items) && j.items.length) {
        console.log(`products: ${j.items.length} from ${origin}`)
        return j.items.map((it) => ({ slug: it.slug, name: it.name, price: it.price, image: it.image, type: it.type, arc: it.arc }))
      }
    } catch (e) {
      console.warn(`image-index @ ${origin}: ${e.message}`)
    }
  }
  throw new Error('no product list (start the dev server or check the live site)')
}

const dataUriCache = new Map()
/** Image → data: URI. Local /public files are read from disk; anything else is fetched. */
async function dataUri(src, width = 900) {
  const key = `${src}@${width}`
  if (dataUriCache.has(key)) return dataUriCache.get(key)
  let buf
  if (src.startsWith('/')) {
    const local = path.join(PUB, decodeURIComponent(src.split('?')[0]))
    if (fs.existsSync(local)) buf = fs.readFileSync(local)
    else buf = Buffer.from(await (await fetch(`${BASE}${src}`)).arrayBuffer())
  } else buf = Buffer.from(await (await fetch(src)).arrayBuffer())
  // keep the page light: re-encode to a PNG/webp the browser decodes quickly, max `width` px wide
  const out = await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer()
  const uri = `data:image/webp;base64,${out.toString('base64')}`
  dataUriCache.set(key, uri)
  return uri
}

/** Best art for a product card: apparel → the back print mockup when it exists. */
function artFor(p) {
  if (APPAREL.has(p.type) && /^\/mockups\/.+-front\.webp$/.test(p.image)) {
    const back = p.image.replace(/-front\.webp$/, '-back.webp')
    if (fs.existsSync(path.join(PUB, back))) return back
  }
  return p.image
}

// ---------------------------------------------------------------- templates
const FONTS =
  'https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@500;700&family=Dela+Gothic+One&family=JetBrains+Mono:wght@500;700&display=block'

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${INK}}
body{font-family:'DM Sans',sans-serif;color:${PAPER};position:relative}
.anton{font-family:Anton,Impact,sans-serif;text-transform:uppercase;line-height:.88;letter-spacing:-.005em}
.mono{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.14em;font-weight:700}
.jp{font-family:'Dela Gothic One',sans-serif}
.tone{position:absolute;inset:0;background-image:radial-gradient(rgba(244,239,230,.07) 1.6px,transparent 1.7px);background-size:14px 14px}
.lines{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 92% 50%,rgba(244,239,230,.035) 0deg 2deg,transparent 2deg 9deg)}
.brand{display:flex;align-items:center;gap:14px}
.brand svg{flex:none}
.brand b{font-family:Anton,sans-serif;font-weight:400;font-size:34px;letter-spacing:.02em;line-height:1}
.panel{position:absolute;border:6px solid ${PAPER};overflow:hidden}
.panel img{display:block;width:100%;height:100%;object-fit:cover}
.sticker{display:inline-block;background:${VOLT};color:${INK};border:4px solid ${INK};box-shadow:8px 8px 0 ${INK};padding:10px 22px 6px}
.strip{position:absolute;left:0;right:0;bottom:0;height:64px;background:${PAPER};color:${INK};display:flex;align-items:center;justify-content:space-between;padding:0 48px}
.strip .t{font-weight:700;font-size:22px}
.strip .m{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px;letter-spacing:.14em;text-transform:uppercase}
.fit{overflow:hidden}
`
const doorMark = (fg, accent, s = 1) =>
  `<svg width="${30 * s}" height="${72 * s}" viewBox="0 0 30 72"><path d="M0,0 H30 V10 H12 V62 H30 V72 H0 Z" fill="${fg}"/><rect x="16" y="14" width="10" height="44" fill="${accent}"/></svg>`
const page = (body, extraCss = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${BASE_CSS}${extraCss}</style></head><body>${body}</body></html>`

function defaultCard({ tee, hoodie }) {
  return page(
    `<div class="lines"></div><div class="tone"></div>
    <div style="position:absolute;left:56px;top:52px;width:640px">
      <div class="brand">${doorMark(PAPER, DOOR, 0.75)}<b>THE ESCAPE DOOR</b></div>
      <p class="mono" style="margin-top:36px;font-size:16px;color:${VOLT}">Vol. 01 · アニメ · Anime merch from India</p>
      <h1 class="anton fit" id="fit" data-max="300" style="margin-top:16px;font-size:94px">Anime merch drawn like a <span style="color:${VOLT}">living manga</span> volume</h1>
      <p style="margin-top:22px;font-size:21px;font-weight:500;white-space:nowrap;color:rgba(244,239,230,.82)">Oversized tees ₹800 · Hoodies from ₹1,200 · Polaroids ₹50</p>
    </div>
    <div class="panel" style="left:742px;top:58px;width:250px;height:300px;background:${VOLT};transform:rotate(-5deg);box-shadow:12px 12px 0 ${DOOR}"></div>
    <div class="panel" style="left:900px;top:186px;width:250px;height:300px;background:${LAV};transform:rotate(4deg);box-shadow:12px 12px 0 ${HYPE}"></div>
    <img src="${tee}" style="position:absolute;left:700px;top:38px;width:330px;transform:rotate(-5deg);filter:drop-shadow(0 10px 0 rgba(11,11,15,.35))">
    <img src="${hoodie}" style="position:absolute;left:868px;top:164px;width:310px;transform:rotate(4deg);filter:drop-shadow(0 10px 0 rgba(11,11,15,.35))">
    <span class="jp" aria-hidden="true" style="position:absolute;left:1046px;top:24px;font-size:54px;color:${HYPE};transform:rotate(8deg);-webkit-text-stroke:2px ${INK};text-shadow:4px 4px 0 ${INK}">ドン!</span>
    <div class="strip"><span class="t">Original fan-inspired designs · tees, hoodies, polaroids, posters, props</span><span class="m">Order on WhatsApp</span></div>`,
  )
}

function productCard({ p, art, accent }) {
  const type = TYPE_LABEL[p.type] || 'Merch'
  const kicker = /oversized/i.test(p.name) ? 'Oversized tee' : type
  return page(
    `<div class="lines"></div><div class="tone"></div>
    <div style="position:absolute;left:0;top:0;width:540px;height:${H}px;background:${accent}"></div>
    <div class="panel" style="left:64px;top:30px;width:420px;height:525px;transform:rotate(-2deg);box-shadow:14px 14px 0 ${INK}"><img src="${art}" alt=""></div>
    <div style="position:absolute;left:584px;top:44px;right:52px">
      <div class="brand">${doorMark(PAPER, DOOR, 0.6)}<b style="font-size:28px">THE ESCAPE DOOR</b></div>
      <p class="mono" style="margin-top:34px;font-size:16px;color:${VOLT}">${esc(kicker)} · ${esc(p.arc || 'Original')}</p>
      <h1 class="anton fit" id="fit" data-max="232" style="margin-top:14px;font-size:96px">${esc(p.name)}</h1>
    </div>
    <div style="position:absolute;left:584px;top:420px;transform:rotate(-3deg)"><span class="sticker anton" style="font-size:${p.price && p.price.length > 9 ? 46 : 58}px">${esc(p.price || 'Price on WhatsApp')}</span></div>
    <div class="strip" style="left:540px;padding:0 40px"><span class="t">Original fan-inspired design</span><span class="m">Order on WhatsApp</span></div>`,
  )
}

function groupCard({ kicker, title, jp, line, a, b, arts }) {
  const fg = lum(a) > 0.5 ? INK : PAPER
  const pos = [
    { l: 640, t: 92, r: -8 },
    { l: 790, t: 46, r: 3 },
    { l: 940, t: 104, r: 9 },
  ]
  const panels = arts
    .slice(0, 3)
    .map((src, i) => `<div class="panel" style="left:${pos[i].l}px;top:${pos[i].t}px;width:236px;height:295px;transform:rotate(${pos[i].r}deg);box-shadow:10px 10px 0 ${INK};z-index:${i === 1 ? 3 : 2}"><img src="${src}" alt=""></div>`)
    .join('')
  return page(
    `<div style="position:absolute;inset:0;background:${a}"></div>
    <div class="tone" style="background-image:radial-gradient(${fg === INK ? 'rgba(11,11,15,.09)' : 'rgba(244,239,230,.09)'} 1.6px,transparent 1.7px)"></div>
    <div style="position:absolute;right:-60px;bottom:-80px;width:620px;height:620px;border-radius:50%;background:${b};opacity:.9"></div>
    <div style="position:absolute;left:56px;top:48px;width:560px;color:${fg}">
      <div class="brand">${doorMark(fg, fg === INK ? DOOR : VOLT, 0.6)}<b style="font-size:28px">THE ESCAPE DOOR</b></div>
      <p class="mono" style="margin-top:40px;font-size:16px">${esc(kicker)}</p>
      <h1 class="anton fit" id="fit" data-max="226" style="margin-top:12px;font-size:120px">${esc(title)}</h1>
      <p class="jp" style="margin-top:14px;font-size:34px;opacity:.75">${esc(jp)}</p>
    </div>
    ${panels}
    <div class="strip" style="background:${INK};color:${PAPER}"><span class="t">${esc(line)}</span><span class="m" style="color:${VOLT}">Original fan-inspired designs</span></div>`,
  )
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

// ---------------------------------------------------------------- render
const index = { v: 1, products: {}, arcs: {}, shop: {} }
const prevIndexPath = path.join(OUT, 'index.json')
const prev = fs.existsSync(prevIndexPath) ? JSON.parse(fs.readFileSync(prevIndexPath, 'utf8')) : null
if (prev && ONLY) Object.assign(index, prev)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
const tab = await ctx.newPage()

async function shoot(html, rel) {
  await tab.setContent(html, { waitUntil: 'networkidle', timeout: 60000 })
  await tab.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(['Anton', '"Dela Gothic One"', '"JetBrains Mono"', '"DM Sans"'].map((f) => document.fonts.load(`700 40px ${f}`, document.body.textContent || 'A')))
    await document.fonts.ready
    // shrink the headline until it fits its box (data-max = max height in px)
    const el = document.getElementById('fit')
    if (el) {
      const max = Number(el.dataset.max || 240)
      let size = parseFloat(getComputedStyle(el).fontSize)
      while (el.scrollHeight > max && size > 34) {
        size -= 3
        el.style.fontSize = `${size}px`
      }
    }
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))))
  })
  const png = await tab.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } })
  let q = Q0
  let jpg
  for (;;) {
    jpg = await sharp(png).flatten({ background: INK }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
    if (jpg.length <= MAX_BYTES || q <= 60) break
    q -= 6
  }
  if (jpg.length > MAX_BYTES) jpg = await sharp(png).flatten({ background: INK }).jpeg({ quality: 70, mozjpeg: true }).toBuffer()
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, jpg)
  const meta = await sharp(jpg).metadata()
  if (meta.width !== W || meta.height !== H) throw new Error(`${rel}: ${meta.width}x${meta.height}`)
  console.log(`✓ og/${rel}  ${(jpg.length / 1024).toFixed(0)} KB (q${q})`)
  return crypto.createHash('sha256').update(jpg).digest('hex').slice(0, 10)
}

const want = (slug) => !ONLY || ONLY.some((o) => slug.includes(o))
const products = await loadIndex()
let failed = 0

try {
  if (want('default')) {
    index.default = await shoot(
      defaultCard({ tee: await dataUri('/hero/tee-cursed-static.webp', 700), hoodie: await dataUri('/hero/hoodie-ember-night.webp', 700) }),
      'default.jpg',
    )
  }

  for (const p of products) {
    if (!want(p.slug)) continue
    try {
      const arcSlug = slugify(p.arc || '')
      const accent = ARCS[arcSlug]?.a || DOOR
      index.products[p.slug] = await shoot(productCard({ p, art: await dataUri(artFor(p), 860), accent }), `products/${p.slug}.jpg`)
    } catch (e) {
      failed++
      console.error(`✗ products/${p.slug}: ${e.message}`)
    }
  }

  const arcSlugs = [...new Set([...Object.keys(ARCS), ...products.map((p) => slugify(p.arc || '')).filter(Boolean)])]
  for (const slug of arcSlugs) {
    if (!want(slug)) continue
    const items = products.filter((p) => slugify(p.arc || '') === slug)
    if (!items.length) continue
    const meta = ARCS[slug] || { name: items[0].arc, jp: '', a: DOOR, b: VOLT, tagline: 'Original fan-inspired designs.' }
    const pick = [...items.filter((p) => APPAREL.has(p.type)), ...items.filter((p) => !APPAREL.has(p.type))].slice(0, 3)
    const arts = await Promise.all(pick.map((p) => dataUri(artFor(p), 520)))
    index.arcs[slug] = await shoot(
      groupCard({ kicker: `Arc · ${items.length} design${items.length === 1 ? '' : 's'} in the shop`, title: meta.name, jp: meta.jp, line: meta.tagline, a: meta.a, b: meta.b, arts }),
      `arcs/${slug}.jpg`,
    )
  }

  for (const [slug, c] of Object.entries(CATS)) {
    if (!want(slug)) continue
    const items = products.filter(c.match)
    const pool = items.length ? items : products.filter((p) => APPAREL.has(p.type))
    const arts = await Promise.all(pool.slice(0, 3).map((p) => dataUri(artFor(p), 520)))
    index.shop[slug] = await shoot(groupCard({ kicker: 'Shop · fan-inspired anime merch', title: c.label, jp: c.jp, line: c.line, a: c.a, b: c.b, arts }), `shop/${slug}.jpg`)
  }
} finally {
  await browser.close()
}

for (const k of ['products', 'arcs', 'shop']) index[k] = Object.fromEntries(Object.entries(index[k]).sort())
fs.writeFileSync(prevIndexPath, JSON.stringify(index, null, 2) + '\n')
console.log(`done → public/og (${Object.keys(index.products).length} products, ${Object.keys(index.arcs).length} arcs, ${Object.keys(index.shop).length} categories), ${failed} failed`)
if (failed) process.exit(1)
