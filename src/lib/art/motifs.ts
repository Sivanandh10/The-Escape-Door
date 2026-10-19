// Original motif drawings per arc (DESIGN §2). Pure SVG strings, deterministic by seed.
// Never franchise symbols, crests or character silhouettes — only generic natural / graphic forms.
import type { Rng } from './rng'
import { rng as makeRng } from './rng'
import { F, INK, PAPER, VOLT, esc, mix, r1, starPoints } from './svg'
import type { ArtMotif } from './types'

export interface MotifOpts {
  w: number
  h: number
  a: string
  b: string
  /** stroke/outline colour (ink on light, paper on black garments) */
  line?: string
  /** light fill colour (paper by default) */
  light?: string
  seed: string
  uid: string
  /** add CSS animation classes (only ArcMotif defines the keyframes) */
  animated?: boolean
  /** 0..1 how busy the drawing is */
  density?: number
}

type MotifFn = (r: Rng, o: Required<MotifOpts>) => string

const cls = (o: Required<MotifOpts>, c: string, delay?: number) =>
  o.animated ? ` class="${c}"${delay != null ? ` style="animation-delay:${r1(delay)}s"` : ''}` : ''

/** Merged-outline cloud: stroke pass, then fill pass. */
function cloud(cx: number, cy: number, rad: number, r: Rng, fill: string, line: string, sw: number, n = 6): string {
  const circles: Array<[number, number, number]> = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x = cx + (t - 0.5) * rad * 2.4
    const y = cy - Math.sin(t * Math.PI) * rad * 0.55 + r.range(-0.1, 0.1) * rad
    circles.push([x, y, rad * r.range(0.45, 0.75) * (0.7 + Math.sin(t * Math.PI) * 0.5)])
  }
  circles.push([cx, cy + rad * 0.25, rad * 0.8])
  const st = circles.map(([x, y, cr]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(cr)}"/>`).join('')
  return `<g fill="${line}" stroke="${line}" stroke-width="${sw * 2}">${st}</g><g fill="${fill}">${st}</g>`
}

/** Tapered curl (smoke wisp / wind). */
function curl(x: number, y: number, s: number, dir: 1 | -1, fill: string, line: string, sw: number): string {
  const d = `M${r1(x)},${r1(y)} c${r1(dir * s * 0.6)},${r1(-s * 0.3)} ${r1(dir * s * 1.2)},${r1(-s * 0.05)} ${r1(dir * s * 1.1)},${r1(-s * 0.55)} c${r1(-dir * s * 0.05)},${r1(-s * 0.32)} ${r1(-dir * s * 0.42)},${r1(-s * 0.38)} ${r1(-dir * s * 0.55)},${r1(-s * 0.16)} c${r1(-dir * s * 0.08)},${r1(s * 0.15)} ${r1(dir * s * 0.08)},${r1(s * 0.3)} ${r1(dir * s * 0.24)},${r1(s * 0.2)} c${r1(-dir * s * 0.02)},${r1(s * 0.3)} ${r1(-dir * s * 0.55)},${r1(s * 0.42)} ${r1(-dir * s * 0.8)},${r1(s * 0.5)} z`
  return `<path d="${d}" fill="${fill}" stroke="${line}" stroke-width="${sw}" stroke-linejoin="round"/>`
}

function talisman(x: number, y: number, w: number, h: number, rot: number, o: Required<MotifOpts>, r: Rng, extra = ''): string {
  const sw = Math.max(2, w * 0.05)
  const chars = r.pick(['封印', '呪符', '禁', '滅', '結界', '護符'])
  const fs = Math.min(w * 0.62, (h * 0.62) / chars.length)
  const glyphs = [...chars]
    .map((c, i) => `<text x="${r1(w / 2)}" y="${r1(h * 0.22 + fs * 0.9 + i * fs * 1.05)}" font-size="${r1(fs)}" text-anchor="middle" fill="${INK}" font-weight="900" style="font-family:${F.jp}">${esc(c)}</text>`)
    .join('')
  const squiggle = `<path d="M${r1(w * 0.25)},${r1(h * 0.86)} q${r1(w * 0.12)},${r1(-h * 0.04)} ${r1(w * 0.25)},0 t${r1(w * 0.25)},0" fill="none" stroke="${o.a}" stroke-width="${r1(sw * 0.9)}" stroke-linecap="round"/>`
  return `<g transform="translate(${r1(x)},${r1(y)}) rotate(${r1(rot)})"${extra}><g transform="translate(${r1(-w / 2)},${r1(-h / 2)})"><rect width="${r1(w)}" height="${r1(h)}" fill="${PAPER}" stroke="${o.line}" stroke-width="${r1(sw)}"/><rect x="${r1(w * 0.1)}" y="${r1(w * 0.1)}" width="${r1(w * 0.8)}" height="${r1(h - w * 0.2)}" fill="none" stroke="${o.a}" stroke-width="${r1(sw * 0.7)}"/><circle cx="${r1(w / 2)}" cy="${r1(h * 0.12)}" r="${r1(w * 0.13)}" fill="${o.a}"/>${glyphs}${squiggle}</g></g>`
}

const smoke: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const sw = 4 * k
  let s = ''
  // back plumes (colour B), front plumes (colour A)
  const n = 3 + Math.round(o.density * 2)
  for (let i = 0; i < n; i++) {
    const cx = w * (0.15 + (0.7 * i) / Math.max(1, n - 1)) + r.range(-20, 20) * k
    const cy = h * r.range(0.55, 0.85)
    s += `<g${cls(o, 'am-drift', i * 0.7)}>${cloud(cx, cy, r.range(48, 72) * k, r, i % 2 ? o.a : o.b, o.line, sw, 5)}</g>`
  }
  for (let i = 0; i < 3; i++) {
    s += `<g${cls(o, 'am-drift', 0.4 + i)}>${curl(w * r.range(0.1, 0.6), h * r.range(0.3, 0.6), r.range(80, 120) * k, r.chance(0.5) ? 1 : -1, i % 2 ? o.light : o.b, o.line, sw)}</g>`
  }
  // talisman strips
  const t = 2 + (o.density > 0.6 ? 1 : 0)
  for (let i = 0; i < t; i++) {
    s += talisman(w * (0.22 + 0.56 * (i / Math.max(1, t - 1))), h * r.range(0.22, 0.42), 54 * k, 190 * k, r.range(-18, 18), o, r, cls(o, 'am-sway', i * 0.9))
  }
  // sparks
  for (let i = 0; i < 6; i++)
    s += `<polygon points="${starPoints(r.range(0.05, 0.95) * w, r.range(0.05, 0.5) * h, r.range(7, 14) * k, 2.5 * k, 4)}" fill="${o.light}"${cls(o, 'am-twinkle', i * 0.5)}/>`
  return s
}

function ring(cx: number, cy: number, R: number, H: number, fill: string, top: string, line: string, sw: number, hatch: string): string {
  const ry = R * 0.34
  const face = `M${r1(cx - R)},${r1(cy - H)} A${r1(R)},${r1(ry)} 0 0 0 ${r1(cx + R)},${r1(cy - H)} L${r1(cx + R)},${r1(cy)} A${r1(R)},${r1(ry)} 0 0 1 ${r1(cx - R)},${r1(cy)} Z`
  // crenellations on the rim
  let cren = ''
  const nC = Math.max(8, Math.round(R / 14))
  for (let i = 1; i < nC; i += 2) {
    const a0 = Math.PI - (i / nC) * Math.PI
    const x = cx + Math.cos(a0) * R
    const y = cy - H + Math.sin(a0) * ry
    cren += `<rect x="${r1(x - R * 0.035)}" y="${r1(y - H * 0.22)}" width="${r1(R * 0.07)}" height="${r1(H * 0.24)}" fill="${top}" stroke="${line}" stroke-width="${r1(sw * 0.6)}"/>`
  }
  return `<path d="${face}" fill="${fill}" stroke="${line}" stroke-width="${r1(sw)}" stroke-linejoin="round"/><path d="${face}" fill="url(#${hatch})" opacity=".5"/><ellipse cx="${r1(cx)}" cy="${r1(cy - H)}" rx="${r1(R)}" ry="${r1(ry)}" fill="none" stroke="${top}" stroke-width="${r1(sw * 2.4)}"/><ellipse cx="${r1(cx)}" cy="${r1(cy - H)}" rx="${r1(R)}" ry="${r1(ry)}" fill="none" stroke="${line}" stroke-width="${r1(sw * 0.7)}"/>${cren}`
}

const walls: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const sw = 4 * k
  const hatch = `${o.uid}-brick`
  const cx = w * 0.5
  const cy = h * 0.72
  const Rm = w * 0.46
  let s = `<defs><pattern id="${hatch}" width="${r1(18 * k)}" height="${r1(10 * k)}" patternUnits="userSpaceOnUse"><path d="M0,${r1(10 * k)} H${r1(18 * k)} M${r1(9 * k)},0 V${r1(10 * k)}" stroke="${o.line}" stroke-width="${r1(1.4 * k)}"/></pattern></defs>`
  // ground disc
  s += `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(Rm)}" ry="${r1(Rm * 0.34)}" fill="${mix(o.a, INK, 0.55)}"/>`
  const rings = [1, 0.68, 0.38]
  // draw inner (far) to outer (near)
  for (let i = rings.length - 1; i >= 0; i--) {
    const R = Rm * rings[i]
    const H = R * 0.24
    const yShift = -(1 - rings[i]) * h * 0.1
    s += ring(cx, cy + yShift, R, H, i % 2 ? mix(o.a, INK, 0.2) : o.a, mix(o.a, PAPER, 0.35), o.line, sw, hatch)
  }
  // wind-torn cloth
  const cw = w * 0.62
  const ch = h * 0.2
  const ox = w * r.range(0.04, 0.12)
  const oy = h * r.range(0.08, 0.18)
  let jag = ''
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    const y = (i / steps) * ch
    const x = cw - (i % 2 ? r.range(18, 40) * k : 0) - (i / steps) * cw * 0.06
    jag += ` L${r1(x)},${r1(y)}`
  }
  const cloth = `M0,0 C${r1(cw * 0.3)},${r1(-ch * 0.25)} ${r1(cw * 0.6)},${r1(ch * 0.2)} ${r1(cw)},0${jag} C${r1(cw * 0.6)},${r1(ch * 1.25)} ${r1(cw * 0.3)},${r1(ch * 0.8)} 0,${r1(ch)} Z`
  s += `<g transform="translate(${r1(ox)},${r1(oy)}) rotate(${r1(r.range(-14, -6))})"${cls(o, 'am-flap')}><rect x="${r1(-6 * k)}" y="${r1(-20 * k)}" width="${r1(10 * k)}" height="${r1(ch * 2.2)}" fill="${o.line}"/><path d="${cloth}" fill="${o.b}" stroke="${o.line}" stroke-width="${r1(sw)}" stroke-linejoin="round"/><path d="M${r1(cw * 0.25)},${r1(ch * 0.1)} C${r1(cw * 0.35)},${r1(ch * 0.4)} ${r1(cw * 0.3)},${r1(ch * 0.7)} ${r1(cw * 0.4)},${r1(ch * 0.95)} M${r1(cw * 0.58)},${r1(ch * 0.15)} C${r1(cw * 0.66)},${r1(ch * 0.45)} ${r1(cw * 0.6)},${r1(ch * 0.7)} ${r1(cw * 0.7)},${r1(ch * 0.9)}" fill="none" stroke="${mix(o.b, INK, 0.45)}" stroke-width="${r1(sw * 0.8)}" stroke-linecap="round"/></g>`
  // wind streaks
  for (let i = 0; i < 5; i++) {
    const y = h * r.range(0.05, 0.45)
    const x = w * r.range(0.3, 0.7)
    s += `<path d="M${r1(x)},${r1(y)} h${r1(r.range(60, 140) * k)}" stroke="${o.light}" stroke-width="${r1(sw * 0.8)}" stroke-linecap="round"${cls(o, 'am-streak', i * 0.4)}/>`
  }
  return s
}

function flameTongue(x: number, y: number, fw: number, fh: number, lean: number): string {
  return `M${r1(x - fw / 2)},${r1(y)} C${r1(x - fw / 2)},${r1(y - fh * 0.45)} ${r1(x + lean * 0.2 - fw * 0.35)},${r1(y - fh * 0.55)} ${r1(x + lean)},${r1(y - fh)} C${r1(x + lean * 0.3 + fw * 0.28)},${r1(y - fh * 0.6)} ${r1(x + fw / 2)},${r1(y - fh * 0.42)} ${r1(x + fw / 2)},${r1(y)} Q${r1(x)},${r1(y + fw * 0.3)} ${r1(x - fw / 2)},${r1(y)} Z`
}

function waveBand(w: number, base: number, amp: number, len: number, phase: number, bottom: number): string {
  let d = `M0,${r1(bottom)} L0,${r1(base)}`
  for (let x = -len + phase; x < w + len; x += len) {
    d += ` Q${r1(x + len * 0.25)},${r1(base - amp * 1.6)} ${r1(x + len * 0.5)},${r1(base - amp * 0.2)} Q${r1(x + len * 0.75)},${r1(base + amp * 0.9)} ${r1(x + len)},${r1(base)}`
  }
  return `${d} L${r1(w + len)},${r1(bottom)} Z`
}

function foam(cx: number, cy: number, rad: number, light: string, line: string, inner: string, sw: number): string {
  return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(rad)}" fill="${light}" stroke="${line}" stroke-width="${r1(sw)}"/><path d="M${r1(cx - rad * 0.55)},${r1(cy + rad * 0.1)} a${r1(rad * 0.5)},${r1(rad * 0.5)} 0 1 1 ${r1(rad * 0.6)},${r1(rad * 0.4)}" fill="none" stroke="${inner}" stroke-width="${r1(sw * 1.1)}" stroke-linecap="round"/>`
}

const flames: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const sw = 4 * k
  let s = ''
  // water (B) bottom-right
  const deep = mix(o.b, INK, 0.35)
  s += `<g${cls(o, 'am-bob')}><path d="${waveBand(w, h * 0.68, 22 * k, 120 * k, r.range(0, 60) * k, h)}" fill="${deep}" stroke="${o.line}" stroke-width="${r1(sw)}"/><path d="${waveBand(w, h * 0.8, 18 * k, 95 * k, r.range(0, 60) * k, h)}" fill="${o.b}" stroke="${o.line}" stroke-width="${r1(sw)}"/></g>`
  for (let i = 0; i < 4; i++) s += foam(w * (0.12 + i * 0.26) + r.range(-10, 10) * k, h * 0.66 + r.range(-8, 8) * k, 13 * k, o.light, o.line, o.b, sw * 0.7)
  // brush strokes in water
  for (let i = 0; i < 4; i++) {
    const y = h * (0.86 + i * 0.035)
    s += `<path d="M${r1(w * r.range(0.05, 0.3))},${r1(y)} q${r1(w * 0.15)},${r1(-10 * k)} ${r1(w * 0.3)},0" fill="none" stroke="${o.light}" stroke-width="${r1(sw * 0.8)}" stroke-linecap="round" opacity=".8"/>`
  }
  // flames (A) rising
  const nF = 4 + Math.round(o.density * 2)
  for (let i = 0; i < nF; i++) {
    const x = w * (0.12 + (0.76 * i) / (nF - 1)) + r.range(-12, 12) * k
    const fh = h * r.range(0.42, 0.72) * (1 - Math.abs(i / (nF - 1) - 0.5) * 0.6)
    const fw = r.range(70, 100) * k
    const lean = r.range(-30, 40) * k
    const base = h * 0.7
    s += `<g${cls(o, 'am-flicker', i * 0.23)}><path d="${flameTongue(x, base, fw, fh, lean)}" fill="${o.a}" stroke="${o.line}" stroke-width="${r1(sw)}" stroke-linejoin="round"/><path d="${flameTongue(x + lean * 0.1, base, fw * 0.5, fh * 0.6, lean * 0.6)}" fill="${VOLT}"/></g>`
  }
  // embers
  for (let i = 0; i < 7; i++) s += `<rect x="${r1(r.range(0.1, 0.9) * w)}" y="${r1(r.range(0.05, 0.35) * h)}" width="${r1(7 * k)}" height="${r1(7 * k)}" fill="${i % 2 ? VOLT : o.a}" transform="rotate(45 ${r1(w / 2)} ${r1(h / 2)})"${cls(o, 'am-twinkle', i * 0.3)}/>`
  return s
}

function compass(cx: number, cy: number, R: number, o: Required<MotifOpts>, sw: number): string {
  let s = `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R * 0.92)}" fill="${o.light}" stroke="${o.line}" stroke-width="${r1(sw)}"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R * 0.8)}" fill="none" stroke="${o.line}" stroke-width="${r1(sw * 2.2)}" stroke-dasharray="${r1(sw * 0.8)} ${r1(sw * 2)}"/>`
  const pts = (len: number, ang: number) => {
    const a = (ang * Math.PI) / 180
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len]
    const l = [cx + Math.cos(a - Math.PI / 2) * len * 0.16, cy + Math.sin(a - Math.PI / 2) * len * 0.16]
    const rr = [cx + Math.cos(a + Math.PI / 2) * len * 0.16, cy + Math.sin(a + Math.PI / 2) * len * 0.16]
    return { tip, l, rr }
  }
  for (const [len, offs, c1, c2] of [
    [R * 0.72, 45, o.a, mix(o.a, INK, 0.4)],
    [R * 1.05, 0, o.b, mix(o.b, INK, 0.35)],
  ] as Array<[number, number, string, string]>) {
    for (let i = 0; i < 4; i++) {
      const { tip, l, rr } = pts(len, offs + i * 90 - 90)
      s += `<polygon points="${r1(cx)},${r1(cy)} ${r1(tip[0])},${r1(tip[1])} ${r1(l[0])},${r1(l[1])}" fill="${c1}" stroke="${o.line}" stroke-width="${r1(sw * 0.7)}" stroke-linejoin="round"/><polygon points="${r1(cx)},${r1(cy)} ${r1(tip[0])},${r1(tip[1])} ${r1(rr[0])},${r1(rr[1])}" fill="${c2}" stroke="${o.line}" stroke-width="${r1(sw * 0.7)}" stroke-linejoin="round"/>`
    }
  }
  s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R * 0.07)}" fill="${o.line}"/>`
  s += `<text x="${r1(cx)}" y="${r1(cy - R * 1.12)}" font-size="${r1(R * 0.3)}" text-anchor="middle" fill="${o.line}" style="font-family:${F.display}">N</text>`
  return s
}

const waves: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const sw = 4 * k
  let s = ''
  const R = Math.min(w, h) * 0.24
  s += `<g transform="translate(${r1(w * r.range(0.62, 0.72))},${r1(h * 0.3)})"><g${cls(o, 'am-spin-slow')}>${compass(0, 0, R, o, sw)}</g></g>`
  const bands = [
    [0.55, 30, 150, mix(o.a, PAPER, 0.25)],
    [0.68, 26, 120, o.a],
    [0.82, 22, 100, mix(o.a, INK, 0.35)],
  ] as Array<[number, number, number, string]>
  bands.forEach(([y, amp, len, fill], i) => {
    const ph = r.range(0, len) * k
    s += `<g${cls(o, 'am-bob', i * 0.5)}><path d="${waveBand(w, h * y, amp * k, len * k, ph, h)}" fill="${fill}" stroke="${o.line}" stroke-width="${r1(sw)}" stroke-linejoin="round"/>`
    for (let x = -len * k + ph; x < w + len * k; x += len * k) {
      if (x + len * k * 0.5 > 0 && x + len * k * 0.5 < w) s += foam(x + len * k * 0.42, h * y - amp * k * 0.95, amp * k * 0.42, o.light, o.line, fill, sw * 0.6)
    }
    s += `</g>`
  })
  // gull-free sky: small stars of foam spray
  for (let i = 0; i < 6; i++) s += `<circle cx="${r1(r.range(0.05, 0.5) * w)}" cy="${r1(r.range(0.35, 0.5) * h)}" r="${r1(r.range(3, 7) * k)}" fill="${o.light}" stroke="${o.line}" stroke-width="${r1(sw * 0.5)}"/>`
  return s
}

function spiralPath(cx: number, cy: number, r0: number, r1_: number, turns: number, rot: number): string {
  const n = Math.round(turns * 28)
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = rot + t * turns * Math.PI * 2
    const rad = r0 + (r1_ - r0) * t
    d += `${i ? ' L' : 'M'}${r1(cx + Math.cos(a) * rad)},${r1(cy + Math.sin(a) * rad)}`
  }
  return d
}

function leaf(x: number, y: number, L: number, rot: number, fill: string, line: string, sw: number, extra = ''): string {
  return `<g transform="translate(${r1(x)},${r1(y)}) rotate(${r1(rot)})"${extra}><path d="M0,${r1(-L)} C${r1(L * 0.5)},${r1(-L * 0.45)} ${r1(L * 0.45)},${r1(L * 0.5)} 0,${r1(L)} C${r1(-L * 0.45)},${r1(L * 0.5)} ${r1(-L * 0.5)},${r1(-L * 0.45)} 0,${r1(-L)} Z" fill="${fill}" stroke="${line}" stroke-width="${r1(sw)}" stroke-linejoin="round"/><path d="M0,${r1(-L * 0.8)} V${r1(L * 1.25)} M0,${r1(-L * 0.2)} l${r1(L * 0.25)},${r1(-L * 0.25)} M0,${r1(L * 0.2)} l${r1(-L * 0.25)},${r1(-L * 0.25)}" stroke="${line}" stroke-width="${r1(sw * 0.7)}" fill="none" stroke-linecap="round"/></g>`
}

const spiral: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const sw = 4 * k
  const cx = w * r.range(0.42, 0.58)
  const cy = h * r.range(0.42, 0.52)
  const R = Math.min(w, h) * 0.42
  let s = `<g transform="translate(${r1(cx)},${r1(cy)})"><g${cls(o, 'am-spin')}>`
  // three-arm wind vortex (open arcs, never a single closed emblem)
  for (let arm = 0; arm < 3; arm++) {
    const rot = (arm * Math.PI * 2) / 3 + r.range(0, 0.3)
    const d = spiralPath(0, 0, R * 0.12, R, 0.9, rot)
    s += `<path d="${d}" fill="none" stroke="${o.line}" stroke-width="${r1(sw * 5)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${arm === 1 ? o.light : o.a}" stroke-width="${r1(sw * 3)}" stroke-linecap="round"/>`
    const d2 = spiralPath(0, 0, R * 0.3, R * 0.85, 0.55, rot + 0.5)
    s += `<path d="${d2}" fill="none" stroke="${o.line}" stroke-width="${r1(sw * 2.6)}" stroke-linecap="round"/><path d="${d2}" fill="none" stroke="${o.b === INK ? o.light : mix(o.a, PAPER, 0.4)}" stroke-width="${r1(sw * 1.2)}" stroke-linecap="round"/>`
  }
  s += `</g></g>`
  // leaf scatter
  const nL = 6 + Math.round(o.density * 4)
  for (let i = 0; i < nL; i++) {
    const a = r.range(0, Math.PI * 2)
    const d = R * r.range(0.6, 1.25)
    const x = Math.min(w * 0.95, Math.max(w * 0.05, cx + Math.cos(a) * d))
    const y = Math.min(h * 0.95, Math.max(h * 0.05, cy + Math.sin(a) * d))
    s += leaf(x, y, r.range(16, 28) * k, r.range(0, 360), i % 3 === 0 ? o.light : i % 3 === 1 ? o.a : mix(o.a, VOLT, 0.5), o.line, sw * 0.8, cls(o, 'am-fall', i * 0.45))
  }
  // wind lines
  for (let i = 0; i < 4; i++) {
    const y = h * r.range(0.1, 0.9)
    s += `<path d="M${r1(w * r.range(0, 0.2))},${r1(y)} q${r1(w * 0.2)},${r1(-30 * k)} ${r1(w * 0.42)},${r1(-6 * k)}" fill="none" stroke="${o.light}" stroke-width="${r1(sw * 0.8)}" stroke-linecap="round"${cls(o, 'am-streak', i * 0.6)}/>`
  }
  return s
}

const ribbons: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const sw = 4 * k
  let s = ''
  // record
  const R = Math.min(w, h) * 0.34
  const rx = w * r.range(0.55, 0.68)
  const ry = h * r.range(0.38, 0.5)
  let grooves = ''
  for (let i = 0; i < 9; i++) grooves += `<circle r="${r1(R * (0.42 + i * 0.065))}" fill="none" stroke="${mix(INK, PAPER, 0.18)}" stroke-width="${r1(1.4 * k)}"/>`
  s += `<g transform="translate(${r1(rx)},${r1(ry)})"><g${cls(o, 'am-spin')}><circle r="${r1(R)}" fill="${INK}" stroke="${o.line === INK ? INK : o.line}" stroke-width="${r1(sw)}"/>${grooves}<path d="M${r1(-R * 0.75)},${r1(-R * 0.45)} A${r1(R * 0.9)},${r1(R * 0.9)} 0 0 1 ${r1(-R * 0.2)},${r1(-R * 0.85)}" fill="none" stroke="${PAPER}" stroke-width="${r1(3 * k)}" opacity=".5"/><circle r="${r1(R * 0.32)}" fill="${o.a}"/><circle r="${r1(R * 0.32)}" fill="none" stroke="${INK}" stroke-width="${r1(sw * 0.5)}"/><text y="${r1(-R * 0.08)}" font-size="${r1(R * 0.11)}" text-anchor="middle" fill="${INK}" style="font-family:${F.display}">SIDE A</text><circle r="${r1(R * 0.04)}" fill="${INK}"/></g></g>`
  // ribbons (bookmark ribbons)
  for (let i = 0; i < 2; i++) {
    const y0 = h * (0.2 + i * 0.5) + r.range(-20, 20) * k
    const amp = r.range(30, 50) * k
    const d = `M${r1(-20 * k)},${r1(y0)} C${r1(w * 0.25)},${r1(y0 - amp)} ${r1(w * 0.45)},${r1(y0 + amp)} ${r1(w * 0.7)},${r1(y0)} S${r1(w * 0.95)},${r1(y0 - amp)} ${r1(w + 20 * k)},${r1(y0 + amp * 0.3)}`
    const c = i ? o.b : o.a
    s += `<g${cls(o, 'am-bob', i * 0.8)}><path d="${d}" fill="none" stroke="${o.line}" stroke-width="${r1(34 * k)}" stroke-linecap="butt"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${r1(26 * k)}" stroke-linecap="butt"/><path d="${d}" fill="none" stroke="${mix(c, INK, 0.25)}" stroke-width="${r1(2 * k)}" stroke-dasharray="${r1(6 * k)} ${r1(6 * k)}"/></g>`
  }
  // stars
  for (let i = 0; i < 9; i++) {
    const x = r.range(0.05, 0.95) * w
    const y = r.range(0.05, 0.95) * h
    const sz = r.range(9, 20) * k
    s += i % 3 === 0
      ? `<polygon points="${starPoints(x, y, sz, sz * 0.45, 5)}" fill="${VOLT}" stroke="${o.line}" stroke-width="${r1(sw * 0.6)}" stroke-linejoin="round"${cls(o, 'am-twinkle', i * 0.4)}/>`
      : `<polygon points="${starPoints(x, y, sz, sz * 0.22, 4)}" fill="${o.light}" stroke="${o.line}" stroke-width="${r1(sw * 0.5)}" stroke-linejoin="round"${cls(o, 'am-twinkle', i * 0.4)}/>`
  }
  return s
}

const speedlines: MotifFn = (r, o) => {
  const { w, h } = o
  const k = Math.min(w, h) / 400
  const cx = w * r.range(0.42, 0.58)
  const cy = h * r.range(0.42, 0.58)
  const R = Math.hypot(w, h)
  let lines = ''
  const n = 46
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(-0.04, 0.04)
    const inner = Math.min(w, h) * r.range(0.2, 0.32)
    const spread = r.range(0.008, 0.022)
    const p1 = [cx + Math.cos(a) * inner, cy + Math.sin(a) * inner]
    const p2 = [cx + Math.cos(a - spread) * R, cy + Math.sin(a - spread) * R]
    const p3 = [cx + Math.cos(a + spread) * R, cy + Math.sin(a + spread) * R]
    lines += `<polygon points="${r1(p1[0])},${r1(p1[1])} ${r1(p2[0])},${r1(p2[1])} ${r1(p3[0])},${r1(p3[1])}" fill="${i % 5 === 0 ? o.a : o.line}"/>`
  }
  const burst = starPoints(cx, cy, Math.min(w, h) * 0.2, Math.min(w, h) * 0.12, 12)
  return `<g${cls(o, 'am-zoom')}>${lines}</g><polygon points="${burst}" fill="${o.b}" stroke="${o.line}" stroke-width="${r1(4 * k)}" stroke-linejoin="round"${cls(o, 'am-pulse')}/><polygon points="${starPoints(cx, cy, Math.min(w, h) * 0.1, Math.min(w, h) * 0.06, 8)}" fill="${o.light}"/>`
}

const MOTIFS: Record<ArtMotif, MotifFn> = { smoke, walls, flames, waves, spiral, ribbons, speedlines }

/** Draw a motif into a (0,0,w,h) box. Returns SVG elements (no wrapper). */
export function motifSvg(motif: ArtMotif, opts: MotifOpts): string {
  const o: Required<MotifOpts> = { line: INK, light: PAPER, animated: false, density: 0.6, ...opts }
  const fn = MOTIFS[motif] ?? speedlines
  return fn(makeRng(`${o.seed}:${motif}`), o)
}

/** CSS keyframes for animated motifs (ArcMotif). Reduced motion = static. */
export const MOTIF_CSS = `
.am-drift,.am-sway,.am-flap,.am-streak,.am-bob,.am-flicker,.am-twinkle,.am-spin,.am-spin-slow,.am-fall,.am-zoom,.am-pulse{transform-box:fill-box;transform-origin:center}
.am-drift{animation:am-drift 7s ease-in-out infinite alternate}
.am-sway{animation:am-sway 5s ease-in-out infinite alternate;transform-origin:50% 0}
.am-flap{animation:am-flap 2.6s ease-in-out infinite alternate;transform-origin:0 50%}
.am-streak{animation:am-streak 2.4s linear infinite}
.am-bob{animation:am-bob 5s ease-in-out infinite alternate}
.am-flicker{animation:am-flicker 1.4s ease-in-out infinite alternate;transform-origin:50% 100%}
.am-twinkle{animation:am-twinkle 2.2s ease-in-out infinite alternate}
.am-spin{animation:am-spin 26s linear infinite}
.am-spin-slow{animation:am-spin 60s linear infinite}
.am-fall{animation:am-fall 6s ease-in-out infinite alternate}
.am-zoom{animation:am-zoom 1.6s ease-in-out infinite alternate}
.am-pulse{animation:am-pulse 1.8s ease-in-out infinite alternate}
@keyframes am-drift{to{transform:translate(4%,-6%) scale(1.04)}}
@keyframes am-sway{from{transform:rotate(-4deg)}to{transform:rotate(5deg)}}
@keyframes am-flap{from{transform:skewY(-3deg) scaleX(.97)}to{transform:skewY(4deg) scaleX(1.02)}}
@keyframes am-streak{from{transform:translateX(-30%);opacity:0}30%{opacity:1}to{transform:translateX(40%);opacity:0}}
@keyframes am-bob{from{transform:translate(-2%,1%)}to{transform:translate(2%,-2%)}}
@keyframes am-flicker{from{transform:scale(.94,.9)}to{transform:scale(1.03,1.06)}}
@keyframes am-twinkle{from{opacity:.25;transform:scale(.7)}to{opacity:1;transform:scale(1.1)}}
@keyframes am-spin{to{transform:rotate(360deg)}}
@keyframes am-fall{from{transform:translate(0,-8%) rotate(-20deg)}to{transform:translate(6%,10%) rotate(25deg)}}
@keyframes am-zoom{from{opacity:.75;transform:scale(1)}to{opacity:1;transform:scale(1.06)}}
@keyframes am-pulse{from{transform:scale(.94)}to{transform:scale(1.06)}}
@media (prefers-reduced-motion: reduce){.am-drift,.am-sway,.am-flap,.am-streak,.am-bob,.am-flicker,.am-twinkle,.am-spin,.am-spin-slow,.am-fall,.am-zoom,.am-pulse{animation:none!important}}
`
