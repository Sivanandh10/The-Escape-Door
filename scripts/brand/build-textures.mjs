#!/usr/bin/env node
// Generates the original texture set in public/textures/ (deterministic — same output every run):
//   screentone-{light,mid,dense}.svg  tileable dot screens (ink on transparent)
//   speedlines.svg                    radial manga focus lines (transparent centre)
//   speedlines-horizontal.svg         horizontal speed lines
//   paper-grain.webp                  tileable paper grain (ink alpha noise, < 15 KB)
//   splat-1..6.svg                    six ink splats (+ src/components/brand/splats.generated.ts path data)
// Run: node scripts/brand/build-textures.mjs   (uses sharp from the project)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = path.join(root, 'public/textures')
fs.mkdirSync(out, { recursive: true })
const INK = '#0B0B0F'
const HEAD = '<!-- Original texture — created for The Escape Door (scripts/brand/build-textures.mjs) -->\n'

// mulberry32
const seeded = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const f1 = (n) => Math.round(n * 10) / 10

// ---------- screentones (45° offset grid; tile = 2 dots) ----------
const tones = { light: [12, 1.2], mid: [9, 1.7], dense: [6, 1.65] }
for (const [name, [s, r]] of Object.entries(tones)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><g fill="${INK}"><circle cx="${s / 4}" cy="${s / 4}" r="${r}"/><circle cx="${(3 * s) / 4}" cy="${(3 * s) / 4}" r="${r}"/></g></svg>`
  fs.writeFileSync(path.join(out, `screentone-${name}.svg`), HEAD + svg)
}

// ---------- radial speed lines ----------
{
  const rnd = seeded(77)
  const W = 1200, H = 1200, cx = 600, cy = 600
  let polys = ''
  const n = 150
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.03
    const w = 0.004 + rnd() * 0.012
    const r0 = 260 + rnd() * 230
    const R = 900
    const p = (ang, r) => `${f1(cx + Math.cos(ang) * r)},${f1(cy + Math.sin(ang) * r)}`
    polys += `<polygon points="${p(a - w, R)} ${p(a + w, R)} ${p(a, r0)}"/>`
  }
  fs.writeFileSync(path.join(out, 'speedlines.svg'), HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="${INK}">${polys}</g></svg>`)
}

// ---------- horizontal speed lines ----------
{
  const rnd = seeded(31)
  const W = 1600, H = 900
  let lines = ''
  for (let i = 0; i < 70; i++) {
    const y = f1((i / 70) * H + rnd() * 10)
    const len = 300 + rnd() * 1100
    const x = f1(rnd() < 0.5 ? 0 : W - len)
    const h = f1(0.8 + rnd() * 3.2)
    lines += `<rect x="${x}" y="${y}" width="${f1(len)}" height="${h}" rx="${h / 2}"/>`
  }
  fs.writeFileSync(path.join(out, 'speedlines-horizontal.svg'), HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g fill="${INK}">${lines}</g></svg>`)
}

// ---------- ink splats ----------
function catmull(pts) {
  const n = pts.length
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d + 'Z'
}
function splat(seed, style) {
  const rnd = seeded(seed)
  const cx = 100, cy = 100
  const pts = []
  const N = 120
  const spikes = Array.from({ length: style.spikes }, () => ({ a: rnd() * Math.PI * 2, len: style.len[0] + rnd() * style.len[1], w: 0.05 + rnd() * 0.09 }))
  const base = style.r
  const wob = [2 + Math.floor(rnd() * 4), rnd() * 6]
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    let r = base * (1 + 0.08 * Math.sin(a * wob[0] + wob[1]) + 0.05 * Math.sin(a * 7 + seed))
    for (const s of spikes) {
      let da = Math.abs(a - s.a)
      da = Math.min(da, Math.PI * 2 - da)
      if (da < s.w) r += s.len * Math.pow(1 - da / s.w, 2.2)
    }
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  let d = catmull(pts)
  // droplets at spike tips + satellites
  for (const s of spikes) {
    if (rnd() < 0.7) {
      const rr = base + s.len + 6 + rnd() * 14
      const dr = 2.2 + rnd() * 4.5
      const x = cx + Math.cos(s.a) * rr, y = cy + Math.sin(s.a) * rr
      d += `M${f1(x - dr)} ${f1(y)}a${f1(dr)} ${f1(dr)} 0 1 0 ${f1(dr * 2)} 0a${f1(dr)} ${f1(dr)} 0 1 0 ${f1(-dr * 2)} 0Z`
    }
  }
  for (let i = 0; i < style.sats; i++) {
    const a = rnd() * Math.PI * 2
    const rr = base * (1.25 + rnd() * 0.9)
    const dr = 1.4 + rnd() * 3.6
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
    if (x < 6 || x > 194 || y < 6 || y > 194) continue
    d += `M${f1(x - dr)} ${f1(y)}a${f1(dr)} ${f1(dr)} 0 1 0 ${f1(dr * 2)} 0a${f1(dr)} ${f1(dr)} 0 1 0 ${f1(-dr * 2)} 0Z`
  }
  return d
}
const styles = [
  { r: 42, spikes: 9, len: [10, 34], sats: 10 },
  { r: 36, spikes: 14, len: [8, 26], sats: 14 },
  { r: 48, spikes: 6, len: [16, 30], sats: 6 },
  { r: 30, spikes: 18, len: [12, 40], sats: 18 },
  { r: 44, spikes: 11, len: [6, 18], sats: 22 },
  { r: 38, spikes: 8, len: [24, 34], sats: 8 },
]
const splats = styles.map((s, i) => splat(1300 + i * 977, s))
splats.forEach((d, i) => {
  fs.writeFileSync(path.join(out, `splat-${i + 1}.svg`), HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path fill="${INK}" d="${d}"/></svg>`)
})
fs.writeFileSync(
  path.join(root, 'src/components/brand/splats.generated.ts'),
  `// AUTO-GENERATED by scripts/brand/build-textures.mjs — original ink splats, viewBox 0 0 200 200, fill with any colour.\nexport const INK_SPLATS: readonly string[] = ${JSON.stringify(splats)}\n`,
)

// ---------- paper grain (tileable: periodic value noise + white noise) ----------
{
  const S = 192
  const rnd = seeded(2024)
  const lat = (g) => Array.from({ length: g * g }, () => rnd())
  const octave = (g, x, y, L) => {
    const fx = (x / S) * g, fy = (y / S) * g
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = fx - x0, ty = fy - y0
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const at = (i, j) => L[((j % g) + g) % g * g + (((i % g) + g) % g)]
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
  const L1 = lat(12), L2 = lat(48)
  const buf = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = 0.45 * octave(12, x, y, L1) + 0.25 * octave(48, x, y, L2) + 0.3 * rnd()
      const alpha = Math.max(0, Math.min(255, Math.round((v - 0.3) * 0.5 * 255)))
      const o = (y * S + x) * 4
      buf[o] = 11; buf[o + 1] = 11; buf[o + 2] = 15; buf[o + 3] = alpha
    }
  await sharp(buf, { raw: { width: S, height: S, channels: 4 } }).webp({ quality: 38, alphaQuality: 40, effort: 6 }).toFile(path.join(out, 'paper-grain.webp'))
}

for (const f of fs.readdirSync(out)) console.log(f.padEnd(28), (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB')
