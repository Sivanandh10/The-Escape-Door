// Static art files — keeps big SVG markup OUT of the HTML / RSC payload (perf).
// The same deterministic builders are exported once by `npx --no-install tsx scripts/export-art.mts`:
//   motifs           → public/art/<key>.svg    (vector; CSS keyframes still play inside <img>)
//   product subjects → public/art/<key>.webp + <key>-500.webp (raster with alpha: their <text> uses
//                      webfonts, which an SVG <img> cannot load, and big filtered SVGs are costly to repaint)
// <key> is a hash of the exact markup, so a file can never be stale: if data changes (admin edits a
// colour, a new product), the key misses the manifest and the component falls back to inline SVG.
import { compositionSvg, productArtSvg } from './compose'
import { MOTIF_CSS, motifSvg } from './motifs'
import { hash } from './rng'
import type { ArtCollection, ArtMotif, ArtProduct, ArtSide } from './types'
import { STATIC_RASTER, STATIC_SVG } from './static-art.generated'

/** fixed <defs> id prefix used inside files (ids are isolated per <img>) */
export const FILE_UID = 'f'
export const KNOWN_MOTIFS: ArtMotif[] = ['smoke', 'walls', 'flames', 'waves', 'spiral', 'ribbons', 'speedlines']

// design tokens (globals.css) — an <img> can't resolve page CSS variables, so files get the hex value
const TOKENS: Record<string, string> = {
  ink: '#0b0b0f',
  paper: '#f4efe6',
  volt: '#ffe14d',
  'volt-hot': '#ffe600',
  lav: '#c9b8ff',
  door: '#6d3bff',
  pink: '#ffb8de',
  hype: '#ff2d3d',
  'tone-1': '#1a1a20',
  'tone-2': '#2b2b33',
  'tone-3': '#6e6e78',
  'tone-4': '#b9b5ac',
}

/** '#abc' / 'var(--color-volt)' → literal colour, or null when it depends on runtime CSS (e.g. --arc-a). */
export function literalColor(c: string): string | null {
  const v = /^var\(--color-([a-z0-9-]+)\)$/.exec(c.trim())
  if (v) return TOKENS[v[1]] ?? null
  return c.includes('var(') ? null : c
}

export interface MotifSpec {
  motif: ArtMotif | string
  colorA: string
  colorB: string
  animated?: boolean
  line?: string
  light?: string
  width?: number
  height?: number
  density?: number
  seed?: string
  fit?: string
}

export function motifKey(motif: string): ArtMotif {
  return (KNOWN_MOTIFS as string[]).includes(motif) ? (motif as ArtMotif) : 'speedlines'
}

/** Inner markup of a motif (shared by the inline <svg> and the file). */
export function motifInner(s: MotifSpec, uid: string): string {
  const key = motifKey(s.motif)
  const animated = !!s.animated
  const inner = motifSvg(key, {
    w: s.width ?? 800,
    h: s.height ?? 600,
    a: s.colorA,
    b: s.colorB,
    line: s.line ?? '#0B0B0F',
    light: s.light ?? '#F4EFE6',
    seed: s.seed ?? key,
    uid,
    animated,
    density: s.density ?? 0.6,
  })
  return `${animated ? `<style>${MOTIF_CSS}</style>` : ''}${inner}`
}

/** Standalone SVG document for a motif, or null when a colour only exists as a runtime CSS variable. */
export function motifDoc(s: MotifSpec): string | null {
  const colorA = literalColor(s.colorA)
  const colorB = literalColor(s.colorB)
  const line = literalColor(s.line ?? '#0B0B0F')
  const light = literalColor(s.light ?? '#F4EFE6')
  if (!colorA || !colorB || !line || !light) return null
  const w = s.width ?? 800
  const h = s.height ?? 600
  const body = motifInner({ ...s, colorA, colorB, line, light }, `am${FILE_UID}`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${s.fit ?? 'xMidYMid slice'}">${body}</svg>`
}

export interface ProductDocOpts {
  side?: ArtSide
  collection?: Partial<ArtCollection> | null
  framed?: boolean
}

/** The exact markup the art builders produce for a product (file uid). */
export function productDoc(product: ArtProduct, o: ProductDocOpts = {}): string {
  const opts = { side: o.side ?? 'front', collection: o.collection, uid: FILE_UID }
  return o.framed ? compositionSvg(product, opts) : productArtSvg(product, opts)
}

/** Content key of a document (FNV-1a + length, base36). */
export function artKey(doc: string): string {
  return `${hash(doc).toString(36)}${doc.length.toString(36)}`
}

/** /art/<key>.svg when the motif file was exported, else null (→ render inline). */
export function staticMotifSrc(doc: string | null): string | null {
  if (!doc) return null
  const k = artKey(doc)
  return STATIC_SVG.has(k) ? `/art/${k}.svg` : null
}

/** { src, srcSet } of the exported raster for a product subject, else null (→ render inline). */
export function staticProductImage(doc: string): { src: string; srcSet: string } | null {
  const k = artKey(doc)
  if (!STATIC_RASTER.has(k)) return null
  return { src: `/art/${k}.webp`, srcSet: `/art/${k}-500.webp 500w, /art/${k}.webp 1000w` }
}

/** aria-label of a builder document (decoded), used as <img alt>. */
export function docLabel(doc: string): string {
  const m = /aria-label="([^"]*)"/.exec(doc)
  if (!m) return ''
  return m[1]
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
