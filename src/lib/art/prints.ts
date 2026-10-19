// Original print artwork: big back prints (3 templates) and the small chest mark.
import { motifSvg } from './motifs'
import { rng } from './rng'
import { F, HYPE, INK, PAPER, VOLT, dotPattern, esc, fitAnton, mix, r1, splitLines, starPoints, text } from './svg'
import type { ArtSpec } from './types'

/** Door-bracket mini mark + "TED" (original recreation of the brand bracket). Box ~ 120 x 64. */
export function chestMark(x: number, y: number, s: number, fg = PAPER, accent = '#6D3BFF'): string {
  return `<g transform="translate(${r1(x)},${r1(y)}) scale(${r1(s * 100) / 100})"><path d="M14,4 H40 V14 H24 V50 H40 V60 H14 Z" fill="${fg}"/><rect x="28" y="18" width="8" height="28" fill="${accent}"/>${text('TED', { x: 46, y: 52, size: 44, fill: fg, tracking: 0.02 })}<rect x="47" y="56" width="62" height="4" fill="${accent}"/></g>`
}

function jpVertical(jp: string, x: number, y: number, size: number, fill: string, font: string = F.jp, weight = 900, stroke?: string): string {
  return [...jp]
    .map((c, i) => `<text x="${r1(x)}" y="${r1(y + size * (i + 0.88) * 1.04)}" font-size="${r1(size)}" text-anchor="middle" fill="${fill}" font-weight="${weight}"${stroke ? ` stroke="${stroke}" stroke-width="${r1(size * 0.1)}" paint-order="stroke" stroke-linejoin="round"` : ''} style="font-family:${font}">${esc(c)}</text>`)
    .join('')
}

const poly = (pts: number[][]) => pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ')

function titleBlock(lines: string[], x: number, y: number, w: number, maxSize: number, fill: string, offsetFill: string, stroke = INK, anchor: 'start' | 'middle' = 'start', maxH = Infinity): { svg: string; height: number } {
  let sizes = lines.map((l) => fitAnton(l, w, maxSize, 0.01))
  const total = sizes.reduce((a, b) => a + b * 0.94, 0)
  if (total > maxH) sizes = sizes.map((sz) => (sz * maxH) / total)
  let svg = ''
  let cy = y
  lines.forEach((line, i) => {
    const size = sizes[i]
    const off = Math.max(4, size * 0.06)
    cy += size * 0.88
    const tx = anchor === 'middle' ? x + w / 2 : x
    svg += text(line, { x: tx + off, y: cy + off, size, fill: offsetFill, anchor, maxW: w, tracking: 0.01 })
    svg += text(line, { x: tx, y: cy, size, fill, anchor, stroke, strokeWidth: size * 0.05, maxW: w, tracking: 0.01 })
    cy += size * 0.06
  })
  return { svg, height: cy - y }
}

/** mono text width estimate (JetBrains Mono ≈ 0.6em per glyph) */
const monoW = (t: string, size: number, tracking = 0) => t.length * size * (0.6 + tracking)

/**
 * Big original back print in a (0,0,pw,ph) box, for a black garment.
 * Templates: A = manga panel stack, B = title over burst, C = vertical poster.
 */
export function backPrint(spec: ArtSpec, pw: number, ph: number): string {
  if (spec.variant === 'half') {
    // Half-n-half: two original prints split down the middle (owner's "half-n-half" option)
    const L = backPrint({ ...spec, variant: '', template: 'A', colorB: mix(spec.colorA, PAPER, 0.3), uid: `${spec.uid}L`, slug: `${spec.slug}-l` }, pw, ph)
    const R = backPrint({ ...spec, variant: '', template: 'A', colorA: spec.colorB, colorB: mix(spec.colorB, PAPER, 0.3), uid: `${spec.uid}R`, slug: `${spec.slug}-r` }, pw, ph)
    const id = `${spec.uid}-half`
    return `<defs><clipPath id="${id}l"><rect x="-20" y="-20" width="${r1(pw / 2 + 20)}" height="${ph + 40}"/></clipPath><clipPath id="${id}r"><rect x="${r1(pw / 2)}" y="-20" width="${r1(pw / 2 + 20)}" height="${ph + 40}"/></clipPath></defs><g clip-path="url(#${id}l)">${L}</g><g clip-path="url(#${id}r)">${R}</g><path d="M${r1(pw / 2)},-10 V${ph + 10}" stroke="${PAPER}" stroke-width="6" stroke-dasharray="18 10"/><g transform="translate(${r1(pw / 2)},${r1(ph * 0.42)}) rotate(-90)"><rect x="-74" y="-16" width="148" height="32" fill="${VOLT}" stroke="${INK}" stroke-width="3"/>${text('HALF-N-HALF', { x: 0, y: 9, size: 22, fill: INK, anchor: 'middle', tracking: 0.04 })}</g>`
  }
  const r = rng(`${spec.slug}:print`)
  const uid = `${spec.uid}-bp`
  const swap = (spec.motif === 'smoke' || spec.motif === 'ribbons' || spec.motif === 'speedlines') && r.chance(0.35)
  const A = swap ? spec.colorB : spec.colorA
  const B = swap ? spec.colorA : spec.colorB
  // keep the accent readable on black
  const accent = mixIfDark(A, B)
  const lines = splitLines(spec.title, 3)
  const fileNo = String(r.int(1, 99)).padStart(3, '0')
  const defs: string[] = [dotPattern(`${uid}-dots`, PAPER, 9, 1.8, 45), dotPattern(`${uid}-dotsA`, accent, 10, 2.4, 30)]
  let body = ''

  if (spec.template === 'A') {
    const g1 = r.range(250, 292)
    const g2 = r.range(-30, 30)
    const P1 = [[0, 34], [pw, 34], [pw, g1 - 30], [0, g1]]
    const P2 = [[0, g1 + 14], [pw * 0.56 + g2 * 0.3, g1 - 6], [pw * 0.5 + g2 * 0.3, 410], [0, 410]]
    const P3 = [[pw * 0.56 + g2 * 0.3 + 14, g1 - 10], [pw, g1 - 22], [pw, 410], [pw * 0.5 + g2 * 0.3 + 14, 410]]
    defs.push(`<clipPath id="${uid}-p1"><polygon points="${poly(P1)}"/></clipPath><clipPath id="${uid}-p2"><polygon points="${poly(P2)}"/></clipPath><clipPath id="${uid}-p3"><polygon points="${poly(P3)}"/></clipPath>`)
    body += text(`THE ESCAPE DOOR — FILE Nº ${fileNo}`, { x: 0, y: 20, size: 14, fill: PAPER, font: F.mono, tracking: 0.12 })
    body += text(spec.collectionName.toUpperCase(), { x: pw, y: 20, size: 14, fill: accent, font: F.mono, tracking: 0.12, anchor: 'end' })
    // P1: motif scene
    body += `<g clip-path="url(#${uid}-p1)"><rect width="${pw}" height="${ph}" fill="${mix(A, INK, 0.62)}"/><rect width="${pw}" height="${ph}" fill="url(#${uid}-dotsA)" opacity=".35"/><g transform="translate(0,34)">${motifSvg(spec.motif, { w: pw, h: g1 - 34, a: A, b: B, seed: spec.slug, uid })}</g></g>`
    // P2: speed lines + SFX
    const sfx = r.pick(['ドン', 'ゴゴゴ', 'バン', 'ズン'])
    body += `<g clip-path="url(#${uid}-p2)"><rect width="${pw}" height="${ph}" fill="${PAPER}"/><g transform="translate(0,${r1(g1 - 20)})">${motifSvg('speedlines', { w: pw * 0.58, h: 430 - g1, a: A, b: VOLT, seed: spec.slug + 'p2', uid: uid + 'b', density: 0.4 })}</g>${text(sfx, { x: pw * 0.27, y: 392, size: 74, fill: INK, font: F.sfxJp, anchor: 'middle', stroke: PAPER, strokeWidth: 8, extra: `transform="rotate(-8 ${r1(pw * 0.27)} 360)"` })}</g>`
    // P3: zoomed motif crop on screentone
    body += `<g clip-path="url(#${uid}-p3)"><rect width="${pw}" height="${ph}" fill="${B}"/><rect width="${pw}" height="${ph}" fill="url(#${uid}-dots)" opacity=".5"/><g transform="translate(${r1(pw * 0.3)},${r1(g1 - 120)}) scale(1.7)">${motifSvg(spec.motif, { w: pw * 0.5, h: 240, a: A, b: B, seed: spec.slug + 'zoom', uid: uid + 'c', density: 0.3 })}</g></g>`
    body += [P1, P2, P3].map((p) => `<polygon points="${poly(p)}" fill="none" stroke="${PAPER}" stroke-width="6" stroke-linejoin="miter"/>`).join('')
    // JP vertical tab on P1
    if (spec.jp) {
      const n = Math.min([...spec.jp].length, 5)
      const jp = [...spec.jp].slice(0, n).join('')
      const fs = Math.min(34, (g1 - 80) / (n * 1.05))
      body += `<rect x="${r1(pw - fs - 26)}" y="46" width="${r1(fs + 18)}" height="${r1(fs * n * 1.05 + 20)}" fill="${INK}" stroke="${PAPER}" stroke-width="3"/>${jpVertical(jp, pw - fs / 2 - 17, 52, fs, PAPER)}`
    }
    const tb = titleBlock(lines.length > 2 ? [lines.slice(0, -1).join(' '), lines[lines.length - 1]] : lines, 0, 424, pw, 118, PAPER, accent, INK, 'start', ph - 430)
    body += tb.svg
  } else if (spec.template === 'B') {
    const cx = pw / 2
    const cy = 205
    const R = 190
    defs.push(`<clipPath id="${uid}-c"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`)
    // radiating paper lines outside burst
    let rays = ''
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + r.range(-0.03, 0.03)
      const ri = R + 10
      const ro = R + r.range(30, 70)
      rays += `<line x1="${r1(cx + Math.cos(a) * ri)}" y1="${r1(cy + Math.sin(a) * ri)}" x2="${r1(cx + Math.cos(a) * ro)}" y2="${r1(cy + Math.sin(a) * ro)}" stroke="${i % 4 ? PAPER : accent}" stroke-width="${i % 4 ? 3 : 6}" stroke-linecap="round"/>`
    }
    body += rays
    body += `<polygon points="${starPoints(cx, cy, R + 22, R + 6, 22)}" fill="${accent}"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="${mix(A, INK, 0.5)}"/><g clip-path="url(#${uid}-c)"><rect x="0" y="0" width="${pw}" height="${ph}" fill="url(#${uid}-dotsA)" opacity=".5"/><g transform="translate(${r1(cx - R)},${r1(cy - R)})">${motifSvg(spec.motif, { w: R * 2, h: R * 2, a: A, b: B, seed: spec.slug, uid })}</g></g><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${PAPER}" stroke-width="7"/>`
    // hanko stamp with JP
    if (spec.jp) {
      const chars = [...spec.jp].slice(0, 6)
      const n = chars.length
      const fs = Math.min(30, 150 / n)
      const hx = r.chance(0.5) ? pw - 46 : 46
      body += `<g transform="rotate(${r1(r.range(-8, 8))} ${r1(hx)} 70)"><rect x="${r1(hx - fs / 2 - 11)}" y="18" width="${r1(fs + 22)}" height="${r1(n * fs * 1.04 + 20)}" fill="${HYPE}" stroke="${PAPER}" stroke-width="3"/>${jpVertical(chars.join(''), hx, 24, fs, PAPER)}</g>`
    }
    const tb = titleBlock(lines, 0, 368, pw, 128, PAPER, accent, INK, 'middle', ph - 368 - 40)
    body += tb.svg
    const foot = `THE ESCAPE DOOR ✦ ${spec.collectionName.toUpperCase()} ✦ Nº ${fileNo}`
    body += text(foot, { x: pw / 2, y: Math.min(ph - 4, 368 + tb.height + 30), size: Math.min(14, pw / (foot.length * 0.75)), fill: PAPER, font: F.mono, anchor: 'middle', tracking: 0.14 })
  } else {
    // C: vertical poster
    const px = 74
    const pwid = pw - px - 4
    const ph2 = ph - 80
    defs.push(`<clipPath id="${uid}-v"><rect x="${px}" y="10" width="${r1(pwid)}" height="${r1(ph2)}"/></clipPath>`)
    body += `<g clip-path="url(#${uid}-v)"><rect x="${px}" y="10" width="${r1(pwid)}" height="${r1(ph2)}" fill="${mix(B, INK, 0.45)}"/><rect x="${px}" y="10" width="${r1(pwid)}" height="${r1(ph2)}" fill="url(#${uid}-dots)" opacity=".18"/><g transform="translate(${px},${r1(10 + ph2 * 0.18)})">${motifSvg(spec.motif, { w: pwid, h: ph2 * 0.82, a: A, b: B, seed: spec.slug, uid, density: 0.9 })}</g></g><rect x="${px}" y="10" width="${r1(pwid)}" height="${r1(ph2)}" fill="none" stroke="${PAPER}" stroke-width="6"/>`
    // rotated title down the left
    const t = spec.title.toUpperCase()
    const size = fitAnton(t, ph2, 78, 0.02)
    body += `<g transform="translate(62,${r1(10 + ph2)}) rotate(-90)">${text(t, { x: 0, y: 0, size, fill: PAPER, maxW: ph2, tracking: 0.02 })}</g>`
    body += `<rect x="0" y="10" width="10" height="${r1(ph2)}" fill="${accent}"/>`
    // JP vertical, big, inside top-right
    if (spec.jp) {
      const jp = [...spec.jp].slice(0, 5).join('')
      const fs = Math.min(56, (ph2 * 0.55) / [...jp].length)
      body += jpVertical(jp, pw - fs / 2 - 22, 26, fs, PAPER, F.sfxJp, 400, INK)
    }
    // headline band
    const band = `Nº ${fileNo} · ${spec.collectionName.toUpperCase()}`
    const bandSize = Math.min(15, (pwid * 0.62 - 20) / (band.length * 0.68))
    body += `<rect x="${px + 16}" y="28" width="${r1(monoW(band, bandSize, 0.08) + 20)}" height="34" fill="${VOLT}"/>${text(band, { x: px + 26, y: 51, size: bandSize, fill: INK, font: F.mono, tracking: 0.08 })}`
    // barcode + footer
    let bars = ''
    let bx = px
    const br = rng(spec.slug + 'bar')
    while (bx < px + Math.min(130, pw - px - 230)) {
      const bw = br.int(1, 5)
      bars += `<rect x="${bx}" y="${r1(ph - 56)}" width="${bw}" height="40" fill="${PAPER}"/>`
      bx += bw + br.int(2, 4)
    }
    body += bars + text('THE ESCAPE DOOR', { x: pw, y: ph - 36, size: 22, fill: PAPER, anchor: 'end', tracking: 0.04 }) + text('ORIGINAL FAN-INSPIRED ART', { x: pw, y: ph - 16, size: 12, fill: accent, font: F.mono, anchor: 'end', tracking: 0.14 })
  }
  return `<defs>${defs.join('')}</defs>${body}`
}

/** if colour is too dark to read on black, lift it toward the other accent / paper */
function mixIfDark(a: string, b: string): string {
  const [r, g, bl] = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)]
  const l = (0.299 * r + 0.587 * g + 0.114 * bl) / 255
  if (l > 0.42) return a
  const [r2, g2, b2] = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]
  const l2 = (0.299 * r2 + 0.587 * g2 + 0.114 * b2) / 255
  return l2 > 0.42 ? b : mix(a, PAPER, 0.45)
}
