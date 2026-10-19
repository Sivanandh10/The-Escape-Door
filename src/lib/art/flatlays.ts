// Flat-lay subjects for non-apparel products, each in a 1000 x 1100 box.
// All art is original: motifs from ./motifs, typography, generic object anatomy. No franchise marks.
import type { SubjectOut } from './compose'
import { motifSvg } from './motifs'
import { backPrint, chestMark } from './prints'
import { rng, type Rng } from './rng'
import { F, HYPE, INK, PAPER, VOLT, dotPattern, esc, fitAnton, hardShadowFilter, mix, r1, splitLines, starPoints, text } from './svg'
import type { ArtMotif, ArtSpec } from './types'

const WARM_WHITE = '#FBF8F1'
const METAL = '#A9A6A0'
const METAL_DARK = '#6F6C67'

interface Ctx {
  s: ArtSpec
  r: Rng
  uid: string
  defs: string[]
  /** id of a small hard shadow filter for stacked items */
  sh: string
}

function ctx(s: ArtSpec): Ctx {
  const uid = `${s.uid}-fl`
  const sh = `${uid}-ish`
  return { s, r: rng(`${s.slug}:flat`), uid, sh, defs: [hardShadowFilter(sh, 10, 12, INK, 0.28), dotPattern(`${uid}-dots`, INK, 9, 1.6, 45), dotPattern(`${uid}-pdots`, PAPER, 9, 1.6, 45)] }
}

const at = (x: number, y: number, rot = 0, sc = 1) => `transform="translate(${r1(x)},${r1(y)})${rot ? ` rotate(${r1(rot)})` : ''}${sc !== 1 ? ` scale(${r1(sc * 100) / 100})` : ''}"`

/** Motif art clipped into a rect, on a tinted background. */
function artRect(c: Ctx, key: string, w: number, h: number, motif: ArtMotif, bg: string, a: string, b: string, density = 0.6): string {
  const id = `${c.uid}-${key}`
  c.defs.push(`<clipPath id="${id}"><rect width="${r1(w)}" height="${r1(h)}"/></clipPath>`)
  return `<g clip-path="url(#${id})"><rect width="${r1(w)}" height="${r1(h)}" fill="${bg}"/><rect width="${r1(w)}" height="${r1(h)}" fill="url(#${c.uid}-dots)" opacity=".12"/>${motifSvg(motif, { w, h, a, b, seed: `${c.s.slug}-${key}`, uid: id, density })}</g>`
}

function artCircle(c: Ctx, key: string, rad: number, motif: ArtMotif, bg: string, a: string, b: string): string {
  const id = `${c.uid}-${key}`
  c.defs.push(`<clipPath id="${id}"><circle r="${r1(rad)}"/></clipPath>`)
  return `<g clip-path="url(#${id})"><rect x="${r1(-rad)}" y="${r1(-rad)}" width="${r1(rad * 2)}" height="${r1(rad * 2)}" fill="${bg}"/><g transform="translate(${r1(-rad)},${r1(-rad)})">${motifSvg(motif, { w: rad * 2, h: rad * 2, a, b, seed: `${c.s.slug}-${key}`, uid: id, density: 0.5 })}</g></g>`
}

// ---------- polaroids ----------
function polaroids(c: Ctx): SubjectOut {
  const { s, r } = c
  const n = s.variant === 'pack' ? 3 : r.chance(0.5) ? 4 : 3
  const captions = [s.title.toLowerCase(), s.collectionName.toLowerCase(), s.jp || 'arc ✦', 'pick your arc']
  const pos = n === 4
    ? [[250, 330, -11], [700, 300, 8], [300, 760, 6], [720, 740, -7]]
    : [[230, 470, -13], [500, 420, 3], [770, 500, 12]]
  let body = ''
  const bgs = [mix(s.colorA, INK, 0.55), mix(s.colorB, INK, 0.4), INK, mix(s.colorA, PAPER, 0.25)]
  pos.slice(0, n).forEach(([x, y, rot], i) => {
    const pw = 330
    const ph = 400
    const kind = i % 4 // 0 motif + title · 1 zoomed crop · 2 speed lines + SFX · 3 motif alt palette
    const a = i % 2 ? s.colorB : s.colorA
    const b = i % 2 ? s.colorA : s.colorB
    let photo = ''
    if (kind === 1) {
      const id = `${c.uid}-polz${i}`
      c.defs.push(`<clipPath id="${id}"><rect width="290" height="290"/></clipPath>`)
      photo = `<g clip-path="url(#${id})"><rect width="290" height="290" fill="${bgs[1]}"/><g transform="translate(-160,-200) scale(2)">${motifSvg(s.motif, { w: 290, h: 290, a: s.colorA, b: s.colorB, seed: `${s.slug}-z${i}`, uid: id })}</g></g>`
    } else if (kind === 2) {
      const sfx = r.pick(['ドン', 'ゴゴゴ', 'バン'])
      photo =
        artRect(c, `pol${i}`, 290, 290, 'speedlines', PAPER, s.colorA, VOLT, 0.5) +
        text(sfx, { x: 145, y: 172, size: 300 / Math.max(2.2, [...sfx].length), fill: INK, font: F.sfxJp, anchor: 'middle', stroke: PAPER, strokeWidth: 10, extra: 'transform="rotate(-8 145 145)"' })
    } else photo = artRect(c, `pol${i}`, 290, 290, s.motif, bgs[kind === 3 ? 3 : 0], a, b, 0.5 + i * 0.1)
    const cap = captions[i % captions.length]
    const capSize = Math.min(40, 300 / Math.max(6, cap.length * 0.48))
    const titleOverlay = i === 0 ? text(s.title.toUpperCase(), { x: 145, y: 270, size: fitAnton(s.title.toUpperCase(), 250, 52), fill: PAPER, anchor: 'middle', stroke: INK, strokeWidth: 5 }) : ''
    body += `<g ${at(x, y, rot + r.range(-2, 2))} filter="url(#${c.sh})"><g transform="translate(${-pw / 2},${-ph / 2})"><rect width="${pw}" height="${ph}" fill="${WARM_WHITE}" stroke="${mix(WARM_WHITE, INK, 0.12)}" stroke-width="2"/><g transform="translate(20,20)">${photo}${titleOverlay}<rect width="290" height="290" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="2"/></g><text x="${pw / 2}" y="${ph - 34}" font-size="${r1(capSize)}" text-anchor="middle" fill="${INK}" fill-opacity=".85" style="font-family:${i === 2 && s.jp ? F.jp : F.hand}">${esc(cap)}</text></g></g>`
  })
  // washi tape on the top one
  const [tx, ty] = pos[n - 1]
  body += `<rect x="${tx - 70}" y="${ty - 232}" width="140" height="40" fill="${s.colorB}" fill-opacity=".72" transform="rotate(-8 ${tx} ${ty - 212})"/>`
  // a pack band
  if (s.variant === 'pack') body += `<g ${at(500, 930, -3)}><rect x="-170" y="-34" width="340" height="68" fill="${VOLT}" stroke="${INK}" stroke-width="4"/>${text('SET OF 3 PRINTS', { x: 0, y: 14, size: 40, fill: INK, anchor: 'middle' })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: pos[0][0] + 40, y: pos[0][1] } }
}

// ---------- poster ----------
function poster(c: Ctx): SubjectOut {
  const { s, r } = c
  const fw = 600
  const fh = 800
  const mat = 26
  const art = `<rect width="${fw - mat * 2}" height="${fh - mat * 2}" fill="${INK}"/><g transform="translate(36,40)">${backPrint(s, fw - mat * 2 - 72, fh - mat * 2 - 80)}</g>`
  let body = ''
  // rolled poster leaning beside
  const rollX = 830
  body += `<g ${at(rollX, 640, 8)} filter="url(#${c.sh})"><rect x="-38" y="-330" width="76" height="660" fill="${mix(s.colorA, PAPER, 0.3)}" stroke="${INK}" stroke-width="5"/><rect x="-38" y="-330" width="76" height="660" fill="url(#${c.uid}-dots)" opacity=".18"/><ellipse cx="0" cy="-330" rx="38" ry="14" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="5"/><ellipse cx="0" cy="-330" rx="16" ry="6" fill="none" stroke="${INK}" stroke-width="3"/><path d="M-38,-200 h76 M-38,120 h76" stroke="${INK}" stroke-width="3"/><rect x="-40" y="-60" width="80" height="30" fill="${s.colorB}" stroke="${INK}" stroke-width="3"/></g>`
  const rot = r.range(-3.5, -1.5)
  body += `<g ${at(430, 560, rot)} filter="url(#${c.sh})"><g transform="translate(${-fw / 2},${-fh / 2})"><rect width="${fw}" height="${fh}" fill="${INK}"/><rect x="8" y="8" width="${fw - 16}" height="${fh - 16}" fill="none" stroke="#2C2C34" stroke-width="3"/><g transform="translate(${mat},${mat})">${art}</g><path d="M${mat},${mat} L${fw * 0.55},${mat} L${mat},${fh * 0.5} Z" fill="${PAPER}" opacity=".06"/></g></g>`
  if (s.variant === 'pack') body += `<g ${at(220, 1000, -4)}><rect x="-170" y="-34" width="340" height="68" fill="${VOLT}" stroke="${INK}" stroke-width="4"/>${text('BUY 5, GET 1 FREE', { x: 0, y: 14, size: 38, fill: INK, anchor: 'middle' })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 430, y: 470 } }
}

// ---------- bookmarks ----------
function bookmarks(c: Ctx): SubjectOut {
  const { s, r } = c
  let body = ''
  if (s.variant === 'magnetic') {
    // closed book with a folded magnetic bookmark clipped over the top edge
    body += `<g ${at(560, 600, -6)} filter="url(#${c.sh})"><rect x="-260" y="-340" width="520" height="680" fill="${mix(s.colorB, INK, 0.55)}" stroke="${INK}" stroke-width="6"/><rect x="-240" y="-340" width="22" height="680" fill="${mix(s.colorB, INK, 0.7)}"/><rect x="-170" y="-200" width="340" height="120" fill="none" stroke="${PAPER}" stroke-opacity=".35" stroke-width="3"/><path d="M260,-330 L278,-322 L278,338 L260,340 Z" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="3"/><g transform="translate(60,-372)"><rect x="0" y="0" width="120" height="220" fill="${INK}" stroke="${INK}" stroke-width="4"/><g transform="translate(6,6)">${artRect(c, 'mag-on', 108, 208, s.motif, mix(s.colorA, INK, 0.5), s.colorA, s.colorB, 0.5)}</g><rect x="0" y="0" width="120" height="16" fill="${mix(s.colorA, INK, 0.2)}"/></g></g>`
    // two opened magnetic bookmarks
    for (let i = 0; i < 2; i++) {
      const x = 170 + i * 150
      const y = 640 + i * 40
      const rot = i ? 9 : -4
      body += `<g ${at(x, y, rot)} filter="url(#${c.sh})"><g transform="translate(-65,-300)"><rect width="130" height="600" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="5"/><g transform="translate(10,10)">${artRect(c, `mag${i}`, 110, 280, i ? 'speedlines' : s.motif, mix(i ? s.colorB : s.colorA, INK, 0.5), s.colorA, s.colorB, 0.5)}</g><path d="M0,300 h130" stroke="${INK}" stroke-width="3" stroke-dasharray="8 6"/><g transform="translate(10,310)"><rect width="110" height="280" fill="${i ? s.colorA : s.colorB}"/><rect width="110" height="280" fill="url(#${c.uid}-dots)" opacity=".2"/></g><rect x="45" y="250" width="40" height="30" fill="${METAL}" stroke="${INK}" stroke-width="2"/><rect x="45" y="320" width="40" height="30" fill="${METAL}" stroke="${INK}" stroke-width="2"/>${`<g transform="translate(65,560) rotate(-90)">${text(s.title.toUpperCase(), { x: 0, y: 12, size: fitAnton(s.title.toUpperCase(), 220, 40), fill: INK, maxW: 220 })}</g>`}</g></g>`
    }
    body += `<g ${at(760, 1010, -3)}><rect x="-150" y="-30" width="300" height="60" fill="${VOLT}" stroke="${INK}" stroke-width="4"/>${text('MAGNETIC · SNAPS SHUT', { x: 0, y: 12, size: 30, fill: INK, anchor: 'middle' })}</g>`
    return { defs: c.defs.join(''), body, focus: { x: 240, y: 560 } }
  }
  const n = 4
  for (let i = 0; i < n; i++) {
    const x = 230 + i * 180
    const y = 560 + (i % 2 ? 30 : -10)
    const rot = (i - 1.5) * 5 + r.range(-2, 2)
    const bw = 150
    const bh = 600
    const motif: ArtMotif = i === 2 ? 'speedlines' : s.motif
    const bg = [mix(s.colorA, INK, 0.5), INK, mix(s.colorB, INK, 0.35), mix(s.colorA, PAPER, 0.2)][i]
    const t = s.title.toUpperCase()
    body += `<g ${at(x, y, rot)} filter="url(#${c.sh})"><g transform="translate(${-bw / 2},${-bh / 2})"><rect width="${bw}" height="${bh}" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="4"/><g transform="translate(10,10)">${artRect(c, `bm${i}`, bw - 20, bh - 20, motif, bg, s.colorA, s.colorB, 0.7)}</g><g transform="translate(${bw / 2 + 18},${bh - 40}) rotate(-90)">${text(t, { x: 0, y: 0, size: fitAnton(t, bh * 0.62, 54), fill: PAPER, stroke: INK, strokeWidth: 5, maxW: bh * 0.62 })}</g><circle cx="${bw / 2}" cy="34" r="10" fill="${mix(s.block, INK, 0.1)}" stroke="${INK}" stroke-width="3"/><path d="M${bw / 2},34 C${bw / 2 - 10},-30 ${bw / 2 + 30},-70 ${bw / 2 + 10},-120" stroke="${i % 2 ? s.colorB : s.colorA}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M${bw / 2 + 10},-120 l-12,-40 M${bw / 2 + 10},-120 l4,-42 M${bw / 2 + 10},-120 l18,-36" stroke="${i % 2 ? s.colorB : s.colorA}" stroke-width="4" stroke-linecap="round"/></g></g>`
  }
  if (s.variant === 'pack') body += `<g ${at(500, 1010, -3)}><rect x="-150" y="-30" width="300" height="60" fill="${VOLT}" stroke="${INK}" stroke-width="4"/>${text('PACK OF 4', { x: 0, y: 14, size: 38, fill: INK, anchor: 'middle' })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 410, y: 520 } }
}

// ---------- badges ----------
function badges(c: Ctx): SubjectOut {
  const { s, r } = c
  const spots = [
    [330, 380, 150], [640, 330, 120], [520, 620, 165], [250, 700, 110], [790, 610, 115], [700, 860, 100], [380, 930, 95],
  ]
  let body = ''
  const lines = splitLines(s.title, 2)
  spots.forEach(([x, y, rad], i) => {
    const kind = i === 2 ? 'title' : i === 4 ? 'jp' : i === 6 ? 'back' : 'motif'
    const edge = mix(INK, PAPER, 0.15)
    let face = ''
    if (kind === 'motif') face = artCircle(c, `bd${i}`, rad, i === 3 ? 'speedlines' : s.motif, mix(i % 2 ? s.colorB : s.colorA, INK, 0.45), i % 2 ? s.colorB : s.colorA, i % 2 ? s.colorA : s.colorB)
    else if (kind === 'title') {
      face = `<circle r="${rad}" fill="${VOLT}"/><circle r="${rad}" fill="url(#${c.uid}-dots)" opacity=".18"/>`
      let ty = -((lines.length - 1) * rad * 0.42) / 2 + rad * 0.17
      for (const l of lines) {
        face += text(l, { x: 0, y: ty, size: fitAnton(l, rad * 1.5, rad * 0.5), fill: INK, anchor: 'middle' })
        ty += rad * 0.46
      }
    } else if (kind === 'jp') {
      const jp = [...(s.jp || 'ドン')].slice(0, 3).join('')
      face = `<circle r="${rad}" fill="${HYPE}"/>${text(jp, { x: 0, y: rad * 0.2, size: Math.min(rad * 0.6, (rad * 1.5) / [...jp].length), fill: PAPER, font: F.sfxJp, anchor: 'middle', stroke: INK, strokeWidth: 6 })}`
    } else {
      face = `<circle r="${rad}" fill="${METAL}"/><circle r="${rad * 0.82}" fill="none" stroke="${METAL_DARK}" stroke-width="3"/><path d="M${-rad * 0.6},${-rad * 0.1} L${rad * 0.55},${-rad * 0.25}" stroke="${METAL_DARK}" stroke-width="7" stroke-linecap="round"/><circle cx="${-rad * 0.6}" cy="${-rad * 0.1}" r="9" fill="${METAL_DARK}"/>${text('THE ESCAPE DOOR', { x: 0, y: rad * 0.4, size: rad * 0.16, fill: METAL_DARK, font: F.mono, anchor: 'middle' })}`
    }
    const shine = kind === 'back' ? '' : `<path d="M${-rad * 0.72},${-rad * 0.35} A${rad * 0.8},${rad * 0.8} 0 0 1 ${-rad * 0.1},${-rad * 0.78}" stroke="${PAPER}" stroke-opacity=".55" stroke-width="${r1(rad * 0.09)}" fill="none" stroke-linecap="round"/>`
    body += `<g ${at(x, y, r.range(-20, 20))} filter="url(#${c.sh})"><circle cy="7" r="${rad}" fill="${edge}"/>${face}${shine}<circle r="${rad}" fill="none" stroke="${INK}" stroke-width="5"/></g>`
  })
  if (s.variant === 'pack') body += `<g ${at(800, 1010, -3)}><rect x="-150" y="-30" width="300" height="60" fill="${VOLT}" stroke="${INK}" stroke-width="4"/>${text('PACK OF 5', { x: 0, y: 14, size: 38, fill: INK, anchor: 'middle' })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 520, y: 600 } }
}

// ---------- stickers ----------
function dieCut(shape: string, inner: string, sw = 18): string {
  return `<path d="${shape}" fill="${INK}" stroke="${INK}" stroke-width="${sw + 6}" stroke-linejoin="round"/><path d="${shape}" fill="${PAPER}" stroke="${PAPER}" stroke-width="${sw}" stroke-linejoin="round"/>${inner}`
}

function stickers(c: Ctx): SubjectOut {
  const { s, r } = c
  let body = ''
  // 1. big title text sticker
  const lines = splitLines(s.title, 2)
  let tsvg = ''
  let ty = 0
  for (const l of lines) {
    const size = fitAnton(l, 420, 130)
    ty += size * 0.86
    tsvg += `<text x="0" y="${r1(ty)}" font-size="${r1(size)}" text-anchor="middle" fill="${INK}" stroke="${INK}" stroke-width="44" stroke-linejoin="round" style="font-family:${F.display}">${esc(l)}</text>`
    tsvg += `<text x="0" y="${r1(ty)}" font-size="${r1(size)}" text-anchor="middle" fill="${PAPER}" stroke="${PAPER}" stroke-width="36" stroke-linejoin="round" style="font-family:${F.display}">${esc(l)}</text>`
    tsvg += `<text x="0" y="${r1(ty)}" font-size="${r1(size)}" text-anchor="middle" fill="${s.colorA}" stroke="${INK}" stroke-width="6" paint-order="stroke" stroke-linejoin="round" style="font-family:${F.display}">${esc(l)}</text>`
    ty += size * 0.08
  }
  body += `<g ${at(560, 260 - ty / 2, -6)} filter="url(#${c.sh})">${tsvg}</g>`
  // 2. motif blob sticker (rounded rect)
  const blob = 'M-150,-110 C-60,-150 70,-140 150,-110 C180,-30 175,60 150,120 C60,150 -60,150 -150,120 C-178,40 -178,-40 -150,-110 Z'
  c.defs.push(`<clipPath id="${c.uid}-blob"><path d="${blob}"/></clipPath>`)
  body += `<g ${at(300, 600, 8)} filter="url(#${c.sh})">${dieCut(blob, `<g clip-path="url(#${c.uid}-blob)"><rect x="-180" y="-160" width="360" height="320" fill="${mix(s.colorA, INK, 0.45)}"/><g transform="translate(-180,-160)">${motifSvg(s.motif, { w: 360, h: 320, a: s.colorA, b: s.colorB, seed: s.slug + 'st', uid: c.uid + 'st' })}</g></g><path d="${blob}" fill="none" stroke="${INK}" stroke-width="4"/>`)}</g>`
  // 3. burst with JP
  const burst = `M${starPoints(0, 0, 140, 104, 14).split(' ').join(' L')} Z`
  const jp = [...(s.jp || 'ドン')].slice(0, 3).join('')
  body += `<g ${at(740, 640, r.range(-12, 12))} filter="url(#${c.sh})">${dieCut(burst, `<path d="${burst}" fill="${VOLT}" stroke="${INK}" stroke-width="4"/>${text(jp, { x: 0, y: 26, size: Math.min(80, 210 / [...jp].length), fill: INK, font: F.sfxJp, anchor: 'middle' })}`)}</g>`
  // 4. circle motif sticker
  body += `<g ${at(560, 930, -4)} filter="url(#${c.sh})"><circle r="112" fill="${INK}"/><circle r="106" fill="${PAPER}"/>${artCircle(c, 'stc', 92, s.motif === 'speedlines' ? 'ribbons' : 'speedlines', mix(s.colorB, INK, 0.3), s.colorB, s.colorA)}<circle r="92" fill="none" stroke="${INK}" stroke-width="4"/></g>`
  // 5. small door-bracket brand sticker
  body += `<g ${at(220, 930, 10)} filter="url(#${c.sh})">${dieCut('M-100,-70 H100 V70 H-100 Z', `<rect x="-100" y="-70" width="200" height="140" fill="${INK}"/>${chestMark(-62, -34, 1, PAPER, s.colorA)}`, 16)}</g>`
  body += `<g ${at(800, 1010, 4)}><rect x="-120" y="-30" width="240" height="60" fill="${HYPE}" stroke="${INK}" stroke-width="4"/>${text('DIE-CUT', { x: 0, y: 14, size: 38, fill: PAPER, anchor: 'middle' })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 330, y: 560 } }
}

// ---------- keychain ----------
function keychainCharm(c: Ctx, key: string, x: number, y: number, rot: number, sc: number, motif: ArtMotif): string {
  const shape = 'M-120,-150 C-40,-180 40,-180 120,-150 C150,-50 150,60 120,160 C40,190 -40,190 -120,160 C-150,60 -150,-50 -120,-150 Z'
  c.defs.push(`<clipPath id="${c.uid}-${key}"><path d="${shape}" transform="scale(.86)"/></clipPath>`)
  let chain = ''
  for (let i = 0; i < 4; i++) chain += `<ellipse cx="0" cy="${-232 - i * 30}" rx="${i % 2 ? 6 : 12}" ry="17" fill="none" stroke="${METAL_DARK}" stroke-width="6"/><ellipse cx="0" cy="${-232 - i * 30}" rx="${i % 2 ? 6 : 12}" ry="17" fill="none" stroke="${METAL}" stroke-width="3"/>`
  return `<g ${at(x, y, rot, sc)} filter="url(#${c.sh})">${chain}<circle cy="-370" r="52" fill="none" stroke="${METAL_DARK}" stroke-width="12"/><circle cy="-370" r="52" fill="none" stroke="${METAL}" stroke-width="7"/><path d="M-30,-412 A52,52 0 0 1 30,-412" stroke="${PAPER}" stroke-width="3" fill="none" opacity=".8"/><circle cy="-188" r="14" fill="none" stroke="${METAL}" stroke-width="7"/><path d="${shape}" fill="${PAPER}" fill-opacity=".55" stroke="${INK}" stroke-width="5"/><circle cy="-150" r="12" fill="${mix(c.s.block, INK, 0.1)}" stroke="${INK}" stroke-width="3"/><g clip-path="url(#${c.uid}-${key})"><rect x="-150" y="-130" width="300" height="320" fill="${mix(c.s.colorA, INK, 0.5)}"/><g transform="translate(-150,-130)">${motifSvg(motif, { w: 300, h: 320, a: c.s.colorA, b: c.s.colorB, seed: c.s.slug + key, uid: c.uid + key })}</g>${text(c.s.title.toUpperCase(), { x: 0, y: 140, size: fitAnton(c.s.title.toUpperCase(), 200, 48), fill: PAPER, anchor: 'middle', stroke: INK, strokeWidth: 5 })}</g><path d="M-95,-120 C-60,-140 -20,-142 10,-138" stroke="${PAPER}" stroke-width="8" stroke-linecap="round" fill="none" opacity=".8"/></g>`
}
function keychains(c: Ctx): SubjectOut {
  const body = keychainCharm(c, 'kc2', 760, 640, 14, 0.62, 'speedlines') + keychainCharm(c, 'kc1', 420, 640, -8, 1, c.s.motif)
  return { defs: c.defs.join(''), body, focus: { x: 420, y: 560 } }
}

// ---------- katana ----------
/** A generic katana drawn horizontally, centred on x=0 (length ~1040). */
function sword(c: Ctx, mode: 'sheathed' | 'blade' | 'saya'): string {
  const { s } = c
  const L = 1040
  const ito = `${c.uid}-ito`
  if (!c.defs.some((d) => d.includes(`id="${ito}"`)))
    c.defs.push(`<pattern id="${ito}" width="34" height="40" patternUnits="userSpaceOnUse"><rect width="34" height="40" fill="${INK}"/><path d="M0,0 L17,20 L0,40 M34,0 L17,20 L34,40" stroke="${s.colorA === '#FFB8DE' ? PAPER : s.colorA}" stroke-width="7" fill="none"/><path d="M17,14 l5,6 l-5,6 l-5,-6 Z" fill="${PAPER}"/></pattern>`)
  const sayaFill = mix(s.colorA, INK, 0.62)
  const handle = `<path d="M0,-20 L250,-24 L250,24 L0,20 Q-14,0 0,-20 Z" fill="url(#${ito})" stroke="${INK}" stroke-width="5"/><rect x="-16" y="-22" width="22" height="44" rx="6" fill="${METAL_DARK}" stroke="${INK}" stroke-width="4"/>`
  const tsuba = `<ellipse cx="262" cy="0" rx="16" ry="62" fill="${INK}" stroke="${METAL}" stroke-width="5"/><ellipse cx="262" cy="0" rx="7" ry="44" fill="none" stroke="${VOLT}" stroke-width="2.5"/><rect x="276" y="-22" width="22" height="44" fill="${VOLT}" stroke="${INK}" stroke-width="3"/>`
  const saya = (x0: number) =>
    `<path d="M${x0},-24 L${L - 30},-18 Q${L},-14 ${L},0 Q${L},14 ${L - 30},18 L${x0},24 Z" fill="${sayaFill}" stroke="${INK}" stroke-width="5"/><path d="M${x0 + 12},-12 L${L - 40},-8" stroke="${PAPER}" stroke-opacity=".4" stroke-width="5" stroke-linecap="round"/><rect x="${L - 50}" y="-19" width="40" height="38" fill="${METAL_DARK}" stroke="${INK}" stroke-width="4"/><rect x="${x0}" y="-25" width="16" height="50" fill="${METAL_DARK}" stroke="${INK}" stroke-width="3"/>${[0, 1, 2].map((i) => `<path d="M${x0 + 64 + i * 26},-26 l14,52" stroke="${s.colorB}" stroke-width="12"/><path d="M${x0 + 64 + i * 26},-26 l14,52" stroke="${INK}" stroke-width="2" fill="none"/>`).join('')}<path d="M${x0 + 120},24 C${x0 + 160},74 ${x0 + 230},84 ${x0 + 270},62" stroke="${s.colorB}" stroke-width="10" fill="none" stroke-linecap="round"/>`
  let out = ''
  if (mode === 'saya') out = saya(298)
  else if (mode === 'sheathed') out = `${handle}${tsuba}${saya(298)}`
  else {
    const blade = `M298,-16 L${L - 70},-10 Q${L - 10},-6 ${L + 10},10 Q${L - 60},14 ${L - 80},14 L298,16 Z`
    // LED prop: a lit edge — wide halo behind the blade, tinted steel, bright core line on top
    const lit = mix(s.colorA, '#FFFFFF', 0.25)
    const edge = `M300,6 L${L - 80},6 Q${L - 30},4 ${L + 8},8`
    const halo = [120, 80, 48, 26]
      .map((w, i) => `<path d="${edge}" stroke="${s.colorA}" stroke-opacity="${[0.1, 0.18, 0.3, 0.55][i]}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`)
      .join('')
    out = `${handle}${tsuba}${halo}<path d="${blade}" fill="${mix('#DADDE3', s.colorA, 0.35)}" stroke="${INK}" stroke-width="4"/><path d="M300,-4 L${L - 90},-2" stroke="${METAL_DARK}" stroke-width="2"/><path d="${edge}" stroke="${lit}" stroke-width="12" fill="none" stroke-linecap="round" stroke-opacity=".9"/><path d="${edge}" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round"/>${[0.25, 0.5, 0.75, 0.95].map((t) => { const x = 300 + t * (L - 300); return `<path d="M${x},-34 l0,-26 M${x - 16},-28 l-10,-20 M${x + 16},-28 l10,-20" stroke="${lit}" stroke-width="5" stroke-linecap="round"/>` }).join('')}`
  }
  return `<g transform="translate(${-L / 2},0)">${out}</g>`
}

function katana(c: Ctx): SubjectOut {
  const { s } = c
  const led = s.variant === 'led'
  const wood = '#3B2A20'
  const woodLite = '#5A4232'
  const upright = (x: number) =>
    `<path d="M${x - 40},250 L${x - 40},-150 Q${x - 40},-190 ${x},-196 Q${x + 40},-190 ${x + 40},-150 L${x + 40},250 Z" fill="${wood}" stroke="${INK}" stroke-width="5"/><path d="M${x - 24},-140 V240" stroke="${woodLite}" stroke-width="3"/>`
  const hook = (x: number, y: number) =>
    `<path d="M${x - 46},${y + 26} Q${x - 46},${y + 52} ${x - 14},${y + 52} L${x + 14},${y + 52} Q${x + 46},${y + 52} ${x + 46},${y + 26} L${x + 46},${y + 18} L${x + 34},${y + 18} L${x + 34},${y + 28} Q${x + 34},${y + 40} ${x + 14},${y + 40} L${x - 14},${y + 40} Q${x - 34},${y + 40} ${x - 34},${y + 28} L${x - 34},${y + 18} L${x - 46},${y + 18} Z" fill="${woodLite}" stroke="${INK}" stroke-width="4"/>`
  const top = -110
  const low = 80
  const stand = `<rect x="-410" y="240" width="820" height="56" fill="${wood}" stroke="${INK}" stroke-width="5"/><path d="M-410,262 h820" stroke="${woodLite}" stroke-width="3"/>${upright(-280)}${upright(280)}`
  let swords = ''
  if (led) {
    swords += `<g transform="translate(40,${low})">${sword(c, 'saya')}</g>${hook(-280, low)}${hook(280, low)}`
    swords += `<g transform="translate(0,${top})">${sword(c, 'blade')}</g>${hook(-280, top)}${hook(280, top)}`
  } else {
    swords += `<g transform="translate(0,${top})">${sword(c, 'sheathed')}</g>${hook(-280, top)}${hook(280, top)}${hook(-280, low)}${hook(280, low)}`
  }
  let body = `<g ${at(500, 600, -7)} filter="url(#${c.sh})">${stand}${swords}</g>`
  body += `<g ${at(150, 300, -8)} filter="url(#${c.sh})"><path d="M0,0 L230,0 L262,44 L230,88 L0,88 Z" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="4"/><circle cx="236" cy="44" r="9" fill="${s.block}" stroke="${INK}" stroke-width="3"/>${text(s.title.toUpperCase(), { x: 18, y: 50, size: fitAnton(s.title.toUpperCase(), 200, 40), fill: INK })}${text(led ? 'LED · COSPLAY PROP' : 'COSPLAY PROP', { x: 18, y: 74, size: 13, fill: INK, font: F.mono, tracking: 0.1 })}</g>`
  if (led) body += `<g ${at(780, 1000, 4)}><rect x="-150" y="-34" width="300" height="68" fill="${INK}" stroke="${s.colorA}" stroke-width="5"/>${text('LED BLADE GLOW', { x: 0, y: 13, size: 36, fill: mix(s.colorA, PAPER, 0.2), anchor: 'middle' })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 300, y: 500 } }
}

// ---------- cape ----------
function cape(c: Ctx): SubjectOut {
  const { s } = c
  const outer = 'M380,150 L620,150 C700,400 820,700 900,1010 C760,1060 600,1050 500,1040 C400,1050 240,1060 100,1010 C180,700 300,400 380,150 Z'
  const clip = `${c.uid}-cape`
  c.defs.push(`<clipPath id="${clip}"><path d="${outer}"/></clipPath>`)
  const body = `<g filter="url(#${c.sh})"><path d="M120,1000 C240,1060 380,1046 500,1036 L510,1060 C380,1076 220,1084 110,1030 Z" fill="${s.colorA}" stroke="${INK}" stroke-width="4"/><path d="${outer}" fill="#18181D"/><g clip-path="url(#${clip})"><rect x="0" y="820" width="1000" height="260" fill="${mix(s.colorA, INK, 0.4)}"/><g transform="translate(60,800)">${motifSvg(s.motif, { w: 880, h: 280, a: s.colorA, b: s.colorB, seed: s.slug + 'cape', uid: c.uid + 'cp', density: 0.8 })}</g><path d="M380,150 C330,500 300,760 280,1060" stroke="#000" stroke-opacity=".35" stroke-width="40" fill="none"/><path d="M620,150 C670,500 700,760 720,1060" stroke="#000" stroke-opacity=".35" stroke-width="40" fill="none"/><path d="M500,170 C505,500 500,800 500,1060" stroke="#2A2A31" stroke-width="16" fill="none"/></g><path d="M100,1010 C240,1060 400,1050 500,1040 C600,1050 760,1060 900,1010" stroke="${PAPER}" stroke-width="3" stroke-dasharray="8 6" fill="none" transform="translate(0,-18)"/><path d="${outer}" fill="none" stroke="${INK}" stroke-width="5"/><path d="M360,120 C420,96 580,96 640,120 L630,170 C580,150 420,150 370,170 Z" fill="#202027" stroke="${INK}" stroke-width="5"/><circle cx="430" cy="166" r="20" fill="${METAL}" stroke="${INK}" stroke-width="4"/><circle cx="570" cy="166" r="20" fill="${METAL}" stroke="${INK}" stroke-width="4"/><path d="M450,170 C480,196 520,196 550,170" stroke="${METAL}" stroke-width="5" fill="none"/>${chestMark(560, 240, 0.7, PAPER, s.colorA)}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 500, y: 860 } }
}

// ---------- figurine (original chibi in a knit beanie — not any character) ----------
function figurine(c: Ctx): SubjectOut {
  const { s } = c
  const cloak = mix(s.colorB, INK, 0.35)
  let body = `<g ${at(500, 470)}><rect x="-330" y="-380" width="660" height="760" fill="${PAPER}" stroke="${INK}" stroke-width="6"/><rect x="-290" y="-300" width="580" height="560" fill="${mix(s.block, PAPER, 0.5)}" stroke="${INK}" stroke-width="4"/><rect x="-290" y="-300" width="580" height="560" fill="url(#${c.uid}-dots)" opacity=".1"/>${text(s.title.toUpperCase(), { x: 0, y: -326, size: fitAnton(s.title.toUpperCase(), 560, 50), fill: INK, anchor: 'middle' })}<rect x="-330" y="290" width="660" height="90" fill="${s.colorA}" stroke="${INK}" stroke-width="5"/>${text('ORIGINAL CHIBI FIGURE', { x: 0, y: 346, size: 30, fill: INK, anchor: 'middle', tracking: 0.04 })}</g>`
  // figure
  body += `<g ${at(500, 560)} filter="url(#${c.sh})"><ellipse cx="0" cy="330" rx="220" ry="54" fill="${INK}"/><ellipse cx="0" cy="316" rx="220" ry="54" fill="${s.colorA}" stroke="${INK}" stroke-width="5"/><rect x="-90" y="330" width="180" height="40" fill="${VOLT}" stroke="${INK}" stroke-width="3"/>${text(s.title.toUpperCase(), { x: 0, y: 360, size: fitAnton(s.title.toUpperCase(), 160, 26), fill: INK, anchor: 'middle' })}`
  // cloak body
  body += `<path d="M-120,40 C-150,150 -170,240 -150,300 L150,300 C170,240 150,150 120,40 Z" fill="${cloak}" stroke="${INK}" stroke-width="6"/><path d="M0,60 V300" stroke="${INK}" stroke-width="4"/><path d="M-60,300 v-60 M60,300 v-60" stroke="${INK}" stroke-width="4"/>`
  // scarf
  body += `<path d="M-120,40 C-60,80 60,80 120,40 L118,78 C60,112 -60,112 -118,78 Z" fill="${s.colorA}" stroke="${INK}" stroke-width="5"/><path d="M90,70 C150,90 200,60 230,20 L250,60 C210,110 150,130 96,108 Z" fill="${s.colorA}" stroke="${INK}" stroke-width="5"/>`
  // head: round face + knit beanie with a star antenna (original chibi — no hood, no void face)
  const skin = '#F6E1CC'
  body += `<circle cx="0" cy="-90" r="150" fill="${skin}" stroke="${INK}" stroke-width="6"/>`
  body += `<path d="M-156,-96 C-162,-250 162,-250 156,-96 C90,-118 -90,-118 -156,-96 Z" fill="${cloak}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M-160,-100 C-90,-126 90,-126 160,-100 L164,-62 C90,-88 -90,-88 -164,-62 Z" fill="${s.colorA}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>${[-120, -80, -40, 0, 40, 80, 120].map((x) => `<path d="M${x},${-112 + Math.abs(x) * 0.08} v34" stroke="${INK}" stroke-opacity=".35" stroke-width="4"/>`).join('')}<path d="M0,-226 C-6,-256 10,-276 4,-300" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round"/><polygon points="${starPoints(6, -318, 34, 15, 5)}" fill="${VOLT}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M-90,-200 C-50,-226 20,-232 60,-222" stroke="${PAPER}" stroke-opacity=".3" stroke-width="10" fill="none" stroke-linecap="round"/>`
  body += `<ellipse cx="-52" cy="-24" rx="17" ry="25" fill="${INK}"/><ellipse cx="52" cy="-24" rx="17" ry="25" fill="${INK}"/><circle cx="-58" cy="-34" r="7" fill="#fff"/><circle cx="46" cy="-34" r="7" fill="#fff"/><circle cx="-46" cy="-14" r="3.5" fill="${s.colorA}"/><circle cx="58" cy="-14" r="3.5" fill="${s.colorA}"/><ellipse cx="-96" cy="18" rx="22" ry="11" fill="#FF9FCF" opacity=".8"/><ellipse cx="96" cy="18" rx="22" ry="11" fill="#FF9FCF" opacity=".8"/><path d="M-16,22 Q0,38 16,22" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`
  // tiny door charm on the chest (brand)
  body += `<rect x="-24" y="140" width="48" height="70" fill="${PAPER}" stroke="${INK}" stroke-width="4"/><circle cx="12" cy="178" r="5" fill="${VOLT}" stroke="${INK}" stroke-width="2"/></g>`
  return { defs: c.defs.join(''), body, focus: { x: 500, y: 520 } }
}

// ---------- earrings / accessory ----------
function charm(motif: ArtMotif, a: string, b: string): string {
  switch (motif) {
    case 'smoke':
      return `<rect x="-26" y="0" width="52" height="150" fill="${PAPER}" stroke="${INK}" stroke-width="4"/><rect x="-18" y="8" width="36" height="134" fill="none" stroke="${a}" stroke-width="3"/><text x="0" y="62" font-size="32" text-anchor="middle" font-weight="900" style="font-family:${F.jp}">封</text><text x="0" y="104" font-size="32" text-anchor="middle" font-weight="900" style="font-family:${F.jp}">印</text>`
    case 'walls':
      return `<circle cy="70" r="64" fill="none" stroke="${INK}" stroke-width="16"/><circle cy="70" r="64" fill="none" stroke="${a}" stroke-width="10"/><circle cy="70" r="36" fill="${b}" stroke="${INK}" stroke-width="4"/>`
    case 'flames':
      return `<path d="M-40,140 C-50,80 -10,50 0,0 C20,40 60,70 40,140 Q0,160 -40,140 Z" fill="${a}" stroke="${INK}" stroke-width="4"/><path d="M-16,140 C-20,110 -4,90 0,70 C10,90 24,110 16,140 Z" fill="${VOLT}"/>`
    case 'waves':
      return `<circle cy="70" r="66" fill="${PAPER}" stroke="${INK}" stroke-width="4"/><path d="M-66,80 Q-33,40 0,80 T66,80 L66,90 A66,66 0 0 1 -66,90 Z" fill="${a}" stroke="${INK}" stroke-width="4"/><polygon points="${starPoints(0, 40, 22, 6, 4)}" fill="${b}" stroke="${INK}" stroke-width="2"/>`
    case 'spiral':
      return `<path d="M0,0 C50,40 50,110 0,150 C-50,110 -50,40 0,0 Z" fill="${a}" stroke="${INK}" stroke-width="4"/><path d="M0,20 V160" stroke="${INK}" stroke-width="3"/>`
    case 'ribbons':
      return `<polygon points="${starPoints(0, 70, 70, 30, 5)}" fill="${a}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    default:
      return `<polygon points="${starPoints(0, 70, 70, 44, 10)}" fill="${a}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
  }
}
function earrings(c: Ctx): SubjectOut {
  const { s } = c
  const one = (x: number, rot: number) =>
    `<g ${at(x, 380, rot)} filter="url(#${c.sh})"><path d="M0,0 C0,-60 -60,-70 -66,-20" stroke="${METAL_DARK}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M0,0 C0,-60 -60,-70 -66,-20" stroke="${METAL}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cy="18" r="16" fill="none" stroke="${METAL}" stroke-width="6"/><g transform="translate(0,34) scale(1.5)">${charm(s.motif, s.colorA, s.colorB)}</g></g>`
  const body = `<g ${at(500, 560, -3)} filter="url(#${c.sh})"><rect x="-300" y="-380" width="600" height="760" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="5"/><rect x="-300" y="-380" width="600" height="120" fill="${s.colorA}" stroke="${INK}" stroke-width="5"/>${text('THE ESCAPE DOOR', { x: 0, y: -305, size: 54, fill: INK, anchor: 'middle' })}<circle cy="-340" r="12" fill="${s.block}" stroke="${INK}" stroke-width="3"/>${text(s.title.toUpperCase(), { x: 0, y: 330, size: fitAnton(s.title.toUpperCase(), 520, 56), fill: INK, anchor: 'middle' })}${s.jp ? `<text x="0" y="364" font-size="22" text-anchor="middle" fill="${INK}" fill-opacity=".6" font-weight="700" style="font-family:${F.jp}">${esc(s.jp)}</text>` : ''}<circle cx="-130" cy="-200" r="7" fill="${INK}"/><circle cx="130" cy="-200" r="7" fill="${INK}"/></g>${one(370, -4)}${one(630, 4)}`
  return { defs: c.defs.join(''), body, focus: { x: 370, y: 520 } }
}

// ---------- hat / tote / stationery / cosplay ----------
function hat(c: Ctx): SubjectOut {
  const { s } = c
  const body = `<g ${at(500, 560)} filter="url(#${c.sh})"><path d="M-420,120 C-380,40 -240,10 0,10 C240,10 380,40 420,120 C380,210 220,250 0,250 C-220,250 -380,210 -420,120 Z" fill="#1A1A20" stroke="${INK}" stroke-width="6"/><path d="M-360,128 C-300,190 300,190 360,128 M-320,120 C-260,170 260,170 320,120" stroke="#3A3A44" stroke-width="3" stroke-dasharray="7 6" fill="none"/><path d="M-250,60 C-250,-200 -160,-270 0,-270 C160,-270 250,-200 250,60 C150,100 -150,100 -250,60 Z" fill="#17171C" stroke="${INK}" stroke-width="6"/><path d="M-250,30 C-150,70 150,70 250,30" stroke="#3A3A44" stroke-width="3" stroke-dasharray="7 6" fill="none"/><path d="M-120,-250 C-140,-150 -150,-50 -160,60" stroke="#26262E" stroke-width="8" fill="none"/><g transform="translate(0,-90)"><circle r="96" fill="${INK}"/>${artCircle(c, 'hat', 88, s.motif, mix(s.colorA, INK, 0.45), s.colorA, s.colorB)}<circle r="88" fill="none" stroke="${PAPER}" stroke-width="6" stroke-dasharray="4 4"/></g></g>`
  return { defs: c.defs.join(''), body, focus: { x: 500, y: 470 } }
}

function tote(c: Ctx): SubjectOut {
  const { s } = c
  const canvas = '#E8DFCB'
  const body = `<g filter="url(#${c.sh})"><path d="M330,300 C330,40 670,40 670,300" stroke="${INK}" stroke-width="56" fill="none"/><path d="M330,300 C330,40 670,40 670,300" stroke="${canvas}" stroke-width="44" fill="none"/><path d="M330,300 C330,40 670,40 670,300" stroke="#B9AE96" stroke-width="2" stroke-dasharray="6 6" fill="none"/><rect x="150" y="260" width="700" height="800" fill="${canvas}" stroke="${INK}" stroke-width="6"/><rect x="150" y="260" width="700" height="800" fill="url(#${c.uid}-dots)" opacity=".05"/><path d="M150,300 H850" stroke="#B9AE96" stroke-width="3" stroke-dasharray="8 6"/><g transform="translate(240,360)"><rect width="520" height="620" fill="${INK}"/><g transform="translate(30,30)">${backPrint(s, 460, 560)}</g></g></g>`
  return { defs: c.defs.join(''), body, focus: { x: 500, y: 600 } }
}

function stationery(c: Ctx): SubjectOut {
  const { s } = c
  const t = s.title.toUpperCase()
  const body = `<g ${at(460, 560, -5)} filter="url(#${c.sh})"><rect x="-300" y="-400" width="600" height="800" fill="${INK}" stroke="${INK}" stroke-width="6"/><g transform="translate(-270,-370)">${artRect(c, 'nb', 540, 560, s.motif, mix(s.colorA, INK, 0.5), s.colorA, s.colorB, 0.8)}</g>${text(t, { x: -270, y: 290, size: fitAnton(t, 540, 110), fill: PAPER, maxW: 540 })}${text('A5 NOTEBOOK · THE ESCAPE DOOR', { x: -270, y: 350, size: 18, fill: s.colorB === '#F4EFE6' ? PAPER : s.colorB, font: F.mono, tracking: 0.12 })}${Array.from({ length: 12 }, (_, i) => `<rect x="-318" y="${-370 + i * 64}" width="36" height="20" rx="8" fill="${METAL}" stroke="${INK}" stroke-width="3"/>`).join('')}</g><g ${at(800, 820, 9)} filter="url(#${c.sh})"><rect x="-110" y="-110" width="220" height="220" fill="${VOLT}" stroke="${INK}" stroke-width="4"/><text x="0" y="-20" font-size="40" text-anchor="middle" style="font-family:${F.hand}">pick your</text><text x="0" y="30" font-size="48" text-anchor="middle" style="font-family:${F.hand}">arc ✦</text></g><g ${at(820, 400, 24)} filter="url(#${c.sh})"><rect x="-16" y="-260" width="32" height="480" rx="8" fill="${s.colorA}" stroke="${INK}" stroke-width="4"/><path d="M-16,220 L0,270 L16,220 Z" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="4"/><rect x="-16" y="-260" width="32" height="70" fill="${INK}"/></g>`
  return { defs: c.defs.join(''), body, focus: { x: 460, y: 460 } }
}

function cosplay(c: Ctx): SubjectOut {
  const { s } = c
  const jacket = mix(s.colorB, INK, 0.3)
  const body = `<g ${at(470, 560, -4)} filter="url(#${c.sh})"><rect x="-320" y="-300" width="640" height="600" fill="${jacket}" stroke="${INK}" stroke-width="6"/><rect x="-320" y="-300" width="640" height="600" fill="url(#${c.uid}-pdots)" opacity=".12"/><path d="M-320,-300 L0,-40 L320,-300" stroke="${INK}" stroke-width="5" fill="none"/><path d="M-260,-300 L0,-90 L260,-300 Z" fill="${mix(jacket, INK, 0.4)}"/><path d="M-40,-60 L40,-60 L30,300 L-30,300 Z" fill="${mix(jacket, INK, 0.15)}" stroke="${INK}" stroke-width="4"/><rect x="-320" y="40" width="640" height="90" fill="${s.colorA}" stroke="${INK}" stroke-width="5"/><rect x="-320" y="40" width="640" height="90" fill="url(#${c.uid}-dots)" opacity=".2"/><path d="M-300,190 h600 M-300,250 h600" stroke="${INK}" stroke-opacity=".35" stroke-width="3"/></g><g ${at(800, 860, 12)} filter="url(#${c.sh})"><path d="M0,0 L170,0 L200,40 L170,80 L0,80 Z" fill="${WARM_WHITE}" stroke="${INK}" stroke-width="4"/>${text('COSPLAY SET', { x: 14, y: 36, size: 30, fill: INK })}${text(s.title.toUpperCase(), { x: 14, y: 64, size: 14, fill: INK, font: F.mono, maxW: 150 })}</g>`
  return { defs: c.defs.join(''), body, focus: { x: 470, y: 520 } }
}

const BUILDERS: Record<string, (c: Ctx) => SubjectOut> = {
  polaroid: polaroids,
  poster,
  bookmark: bookmarks,
  badge: badges,
  sticker: stickers,
  keychain: keychains,
  katana,
  cape,
  figurine,
  accessory: earrings,
  hat,
  tote,
  stationery,
  cosplay,
}

export function flatlaySubject(spec: ArtSpec): SubjectOut {
  const b = BUILDERS[spec.type] ?? poster
  return b(ctx(spec))
}
