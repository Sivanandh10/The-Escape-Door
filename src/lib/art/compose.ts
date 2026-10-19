// Full product compositions (1200 x 1500) + subject dispatch by product type.
import { artSpec } from './arcs'
import { flatlaySubject } from './flatlays'
import { GARMENT_H, GARMENT_W, hoodieSubject, teeSubject, type Subject } from './garments'
import { rng } from './rng'
import { F, INK, PAPER, VOLT, esc, hardShadowFilter, mix, onColor, r1, starPoints, text } from './svg'
import type { ArtCollection, ArtProduct, ArtSide, ArtSpec } from './types'

export const MOCKUP_W = 1200
export const MOCKUP_H = 1500
export const SUBJECT_W = GARMENT_W
export const SUBJECT_H = GARMENT_H

export const APPAREL = new Set(['tshirt', 'hoodie'])

export interface ArtOptions {
  side?: ArtSide
  collection?: Partial<ArtCollection> | null
  /** extra salt for <defs> ids when the same product renders twice on a page */
  uid?: string
}

export interface SubjectOut extends Subject {
  /** focal point (in subject coords) used for the detail ("back") view of flat-lays */
  focus?: { x: number; y: number }
}

export function subjectFor(spec: ArtSpec, side: ArtSide): SubjectOut {
  if (spec.type === 'tshirt') return teeSubject(spec, side)
  if (spec.type === 'hoodie') return hoodieSubject(spec, side)
  return flatlaySubject(spec)
}

const TYPE_LABEL: Record<string, string> = {
  tshirt: 'OVERSIZED TEE',
  hoodie: 'HOODIE',
  polaroid: 'POLAROID PRINTS',
  bookmark: 'BOOKMARKS',
  poster: 'POSTER',
  badge: 'PIN BADGES',
  sticker: 'STICKERS',
  keychain: 'KEYCHAIN',
  cosplay: 'COSPLAY SET',
  katana: 'COSPLAY KATANA',
  figurine: 'FIGURINE',
  cape: 'CAPE',
  accessory: 'EARRINGS',
  hat: 'BUCKET HAT',
  tote: 'TOTE BAG',
  stationery: 'STATIONERY',
}

function typeLabel(spec: ArtSpec): string {
  if (spec.type === 'tshirt') return spec.variant === 'baby' ? 'BABY TEE' : spec.variant === 'regular' ? 'REGULAR TEE' : 'OVERSIZED TEE'
  if (spec.type === 'katana') return spec.variant === 'led' ? 'LED COSPLAY KATANA' : 'COSPLAY KATANA'
  if (spec.type === 'bookmark') return spec.variant === 'magnetic' ? 'MAGNETIC BOOKMARKS' : 'BOOKMARKS'
  return TYPE_LABEL[spec.type] ?? spec.type.toUpperCase()
}

function sideLabel(spec: ArtSpec, side: ArtSide): string {
  if (APPAREL.has(spec.type)) return side === 'back' ? 'BACK PRINT · 12×15 IN' : 'FRONT · CHEST MARK'
  return side === 'back' ? 'DETAIL VIEW' : 'FLAT LAY'
}

/** Halftone corner (dots shrink with distance) — DESIGN: halftone instead of gradients. */
function halftoneCorner(x0: number, y0: number, w: number, h: number, color: string, step: number, flip = false): string {
  let s = ''
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const t = flip ? (x / w + (h - y) / h) / 2 : (x / w + y / h) / 2
      const rad = (1 - t) * step * 0.48
      if (rad > 0.6) s += `<circle cx="${r1(x0 + x + ((y / step) % 2 ? step / 2 : 0))}" cy="${r1(y0 + y)}" r="${r1(rad)}"/>`
    }
  }
  return `<g fill="${color}">${s}</g>`
}

/**
 * Full 1200x1500 feed-style composition: colour block, giant repeated outline title (#47),
 * garment / flat-lay with a hard offset shadow, labels and the SAMPLE corner tag.
 */
export function compositionSvg(product: ArtProduct, opts: ArtOptions = {}): string {
  const side = opts.side ?? 'front'
  const spec = artSpec(product, opts.collection, `${side}${opts.uid ?? ''}`)
  const r = rng(`${spec.slug}:comp:${side}`)
  const W = MOCKUP_W
  const H = MOCKUP_H
  const uid = spec.uid
  const apparel = APPAREL.has(spec.type)
  // detail view of flat-lays sits on the second accent block for variety
  const block = side === 'back' && !apparel ? mix(spec.block, spec.colorA, 0.35) : spec.block
  const fg = onColor(block)
  const deep = mix(block, INK, 0.5)

  // giant outline title rows
  const word = spec.title.toUpperCase()
  const rowSize = 230
  const rowText = `${word} ✦ ${word} ✦ ${word} ✦ ${word}`
  let rows = ''
  for (let i = 0; i < 7; i++) {
    const y = 120 + i * rowSize * 0.9
    const x = -((i * 173 + r.int(0, 120)) % 600)
    const filled = i === 3
    rows += text(rowText, {
      x,
      y,
      size: rowSize,
      fill: filled ? mix(block, INK, 0.1) : 'none',
      extra: filled ? '' : `stroke="${fg}" stroke-width="2.6" stroke-opacity=".38"`,
      tracking: 0.01,
    })
  }

  const subject = subjectFor(spec, side)
  const sx = (W - SUBJECT_W) / 2
  const sy = 215
  let subjectTransform = `translate(${sx},${sy})`
  if (side === 'back' && !apparel && subject.focus) {
    const z = 1.42
    const fx = subject.focus.x
    const fy = subject.focus.y
    subjectTransform = `translate(${r1(W / 2 - fx * z)},${r1(sy + SUBJECT_H / 2 - fy * z)}) scale(${z})`
  }

  const tagRot = r.range(1.5, 3.5)
  const sampleTag = `<g transform="translate(${W - 44},44) rotate(${r1(tagRot)})"><rect x="-430" y="0" width="430" height="58" fill="${INK}" transform="translate(6,6)"/><rect x="-430" y="0" width="430" height="58" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><circle cx="-406" cy="29" r="7" fill="#FF2D3D"/>${text('SAMPLE — replace with real photo', { x: -390, y: 36, size: 18.5, fill: INK, font: F.mono })}</g>`

  const brand = `<g transform="translate(48,50)"><path d="M0,0 H30 V10 H12 V62 H30 V72 H0 Z" fill="${fg}"/><rect x="16" y="14" width="10" height="44" fill="${spec.colorA}"/>${text('THE ESCAPE DOOR', { x: 44, y: 46, size: 40, fill: fg, tracking: 0.02 })}${text(`${typeLabel(spec)} · ${sideLabel(spec, side)}`, { x: 46, y: 70, size: 15, fill: fg, font: F.mono, tracking: 0.12 })}</g>`

  const stickerX = r.chance(0.5) ? 980 : 210
  const stickerY = 330 + r.int(0, 60)
  const sticker = `<g transform="rotate(${r1(r.range(-14, 14))} ${stickerX} ${stickerY})"><polygon points="${starPoints(stickerX + 6, stickerY + 6, 84, 66, 16)}" fill="${INK}"/><polygon points="${starPoints(stickerX, stickerY, 84, 66, 16)}" fill="${VOLT}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>${text('ORIGINAL', { x: stickerX, y: stickerY - 2, size: 30, fill: INK, anchor: 'middle' })}${text('ART', { x: stickerX, y: stickerY + 30, size: 30, fill: INK, anchor: 'middle' })}</g>`

  const footer = `<g><rect x="0" y="${H - 132}" width="${W}" height="132" fill="${INK}"/><rect x="0" y="${H - 132}" width="${W}" height="8" fill="${spec.colorA}"/>${text(spec.title.toUpperCase(), { x: 48, y: H - 58, size: 58, fill: PAPER, maxW: 700, tracking: 0.01 })}${spec.jp ? `<text x="48" y="${H - 26}" font-size="22" fill="${PAPER}" fill-opacity=".7" font-weight="700" letter-spacing="4" style="font-family:${F.jp}">${esc(spec.jp)}</text>` : ''}${text(spec.collectionName.toUpperCase(), { x: W - 48, y: H - 76, size: 18, fill: VOLT, font: F.mono, anchor: 'end', tracking: 0.14 })}${text('ORIGINAL FAN-INSPIRED DESIGN', { x: W - 48, y: H - 46, size: 14, fill: PAPER, font: F.mono, anchor: 'end', tracking: 0.14 })}</g>`

  const shadowId = `${uid}-sh`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${spec.title} ${typeLabel(spec).toLowerCase()} — ${side} — sample mockup`)}"><defs>${hardShadowFilter(shadowId, 22, 26, INK, 0.32)}<clipPath id="${uid}-canvas"><rect width="${W}" height="${H}"/></clipPath>${subject.defs}</defs><g clip-path="url(#${uid}-canvas)"><rect width="${W}" height="${H}" fill="${block}"/>${halftoneCorner(W - 520, H - 132 - 420, 520, 420, deep, 22, true)}${halftoneCorner(0, 140, 360, 300, mix(block, PAPER, 0.35), 20)}${rows}<g filter="url(#${shadowId})"><g transform="${subjectTransform}">${subject.body}</g></g>${apparel ? sticker : ''}${brand}${sampleTag}${footer}</g></svg>`
}

/** Just the product (transparent background), in a 1000x1100 viewBox — for animated sections. */
export function productArtSvg(product: ArtProduct, opts: ArtOptions = {}): string {
  const side = opts.side ?? 'front'
  const spec = artSpec(product, opts.collection, `${side}${opts.uid ?? ''}`)
  const s = subjectFor(spec, side)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SUBJECT_W} ${SUBJECT_H}" role="img" aria-label="${esc(`${spec.title} ${typeLabel(spec).toLowerCase()}, ${side}`)}"><defs>${s.defs}</defs>${s.body}</svg>`
}

/** Sides the mockup generator renders: apparel = front + back; flat-lays = front (+ back = detail view if asked). */
export function sidesFor(type: string): ArtSide[] {
  return APPAREL.has(type) ? ['front', 'back'] : ['front']
}
