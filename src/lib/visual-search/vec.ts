// Visual search — pure vector maths shared by the browser (worker + modal), the server route and the Node scripts.
// Owner: SEARCH. No DOM, no Node APIs (btoa/atob exist in both).
//
// Storage format: every embedding is L2-normalised, then scalar-quantised to int8 with a per-vector scale
// (q = round(x / max|x| · 127)) and stored as base64 of the raw 512 bytes (684 chars). Cosine similarity ignores the
// scale, so decoding is "int8 → float → L2-normalise". Measured quantisation loss: cos(original, decoded) ≥ 0.9999.
import { MATCH, PRE_SHRINK, VIEW_PENALTY, type MatchThresholds } from './thresholds'

/**
 * Both pipelines (browser worker, Node scripts) first shrink every image so its SHORT side is PRE_SHRINK px with a
 * high-quality filter (browser: createImageBitmap resizeQuality 'high'; Node: sharp's default lanczos3), then hand
 * it to the CLIP processor (resize shortest edge 256 = no-op, centre crop 256). Images already smaller are kept.
 */
export function preShrinkSize(w: number, h: number, short = PRE_SHRINK): { w: number; h: number } {
  const k = Math.min(1, short / Math.max(1, Math.min(w, h)))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/**
 * Index views. Every product image is embedded several times (MEASURED, see thresholds.ts): the whole image, the
 * product in the centre (drops the poster's title bar / footer type) and the print area. A shopper's photo is ONE
 * view (the whole photo) and scores max over all of them, so a close-up of the print or a garment shot without the
 * poster frame still lands near one of our vectors. Fractions of the (EXIF-oriented) image; null = the whole image.
 * Both pipelines crop with viewRect() so the browser (admin auto-index) and Node (scripts) cut the same pixels.
 */
export const INDEX_VIEWS: ReadonlyArray<{ l: number; t: number; w: number; h: number } | null> = [
  null,
  { l: 0.12, t: 0.15, w: 0.76, h: 0.7 },
  { l: 0.28, t: 0.25, w: 0.44, h: 0.42 },
]

/**
 * How many INDEX_VIEWS an image gets (always the first n). Tee / hoodie FRONTS skip the print crop: it is plain black
 * fabric + the small chest mark on every one of them (MEASURED: it scored 0.64 against a solid black image and 0.51–0.58
 * against any flat colour, gradient or noise), so it adds nothing but false SIMILAR answers.
 */
export function viewsFor(type: string, side: string | undefined): number {
  return (type === 'tshirt' || type === 'hoodie') && (side ?? 'front') === 'front' ? 2 : INDEX_VIEWS.length
}

export function viewRect(W: number, H: number, view: (typeof INDEX_VIEWS)[number]): { left: number; top: number; width: number; height: number } {
  if (!view) return { left: 0, top: 0, width: W, height: H }
  const left = Math.min(W - 1, Math.max(0, Math.round(W * view.l)))
  const top = Math.min(H - 1, Math.max(0, Math.round(H * view.t)))
  return { left, top, width: Math.max(1, Math.min(W - left, Math.round(W * view.w))), height: Math.max(1, Math.min(H - top, Math.round(H * view.h))) }
}

/** In-place L2 normalisation; returns the same array. A zero vector stays zero. */
export function l2normalize<T extends Float32Array | number[]>(v: T): T {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i] * v[i]
  const n = Math.sqrt(s)
  if (n > 0) for (let i = 0; i < v.length; i++) v[i] = v[i] / n
  return v
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

/** float vector → base64(int8[dim]) (the vector is normalised first; the input is not modified). */
export function encodeVec(v: ArrayLike<number>): string {
  const f = l2normalize(Float32Array.from(v))
  let max = 0
  for (let i = 0; i < f.length; i++) max = Math.max(max, Math.abs(f[i]))
  const bytes = new Uint8Array(f.length)
  const k = max > 0 ? 127 / max : 0
  for (let i = 0; i < f.length; i++) {
    const q = Math.max(-127, Math.min(127, Math.round(f[i] * k)))
    bytes[i] = q & 0xff
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** base64(int8[dim]) → L2-normalised Float32Array, or null when it isn't `dim` bytes. */
export function decodeVec(b64: string, dim: number): Float32Array | null {
  let bin: string
  try {
    bin = atob(b64)
  } catch {
    return null
  }
  if (bin.length !== dim) return null
  const out = new Float32Array(dim)
  for (let i = 0; i < dim; i++) {
    const b = bin.charCodeAt(i)
    out[i] = b > 127 ? b - 256 : b
  }
  return l2normalize(out)
}

/** Base64 length of an encoded vector of `dim` bytes (used by validators). */
export const encodedLength = (dim: number) => Math.ceil(dim / 3) * 4

/** Several views of one image → one string (the encoded vectors back to back; product_image_embeddings.vec). */
export const encodeVecs = (vs: ArrayLike<number>[]) => vs.map(encodeVec).join('')

/** product_image_embeddings.vec → the encoded vectors it holds ([] when the length is not a whole number of them). */
export function splitVecs(s: string, dim: number): string[] {
  const n = encodedLength(dim)
  if (!s || s.length % n) return []
  const out: string[] = []
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n))
  return out
}

// ---------------------------------------------------------------- matching
export interface IndexedProduct {
  slug: string
  name: string
  /** "₹800" / "From ₹400" / "Price on request" */
  price: string
  /** cover image src (local /mockups/… or Supabase public URL) */
  image: string
  type: string
  /** arc display name */
  arc: string
  /** one string per product image: its index views back to back (product_image_embeddings.vec) */
  vecs: string[]
}

export interface ImageIndex {
  model: string
  dim: number
  items: IndexedProduct[]
  /** ISO time the index was built (cache freshness / debugging) */
  at?: string
}

export interface DecodedProduct extends Omit<IndexedProduct, 'vecs'> {
  vecs: Float32Array[]
  /** subtracted from that vector's cosine (VIEW_PENALTY of its view) */
  offs: number[]
}

/** items[].vecs are index rows (one per image: its views back to back); view i gets VIEW_PENALTY[i]. */
export function decodeIndex(index: ImageIndex): DecodedProduct[] {
  const out: DecodedProduct[] = []
  for (const it of index.items) {
    const vecs: Float32Array[] = []
    const offs: number[] = []
    for (const row of it.vecs) {
      splitVecs(row, index.dim).forEach((b, i) => {
        const v = decodeVec(b, index.dim)
        if (!v) return
        vecs.push(v)
        offs.push(VIEW_PENALTY[i] ?? 0)
      })
    }
    if (vecs.length) out.push({ ...it, vecs, offs })
  }
  return out
}

export interface Ranked<P = DecodedProduct> {
  product: P
  /** cosine similarity (minus the view penalty), max over the product's image views */
  score: number
  /** which image matched best */
  image: number
}

/** Product score = max over its vectors of (cosine − offs[i]); sorted best first. */
export function rankProducts<P extends { vecs: ArrayLike<number>[]; offs?: number[] }>(query: ArrayLike<number>, products: P[]): Ranked<P>[] {
  const out: Ranked<P>[] = []
  for (const p of products) {
    let best = -2
    let at = 0
    for (let i = 0; i < p.vecs.length; i++) {
      const s = dot(query, p.vecs[i]) - (p.offs?.[i] ?? 0)
      if (s > best) {
        best = s
        at = i
      }
    }
    if (p.vecs.length) out.push({ product: p, score: best, image: at })
  }
  return out.sort((a, b) => b.score - a.score)
}

export type MatchKind = 'exact' | 'similar' | 'none'

export interface MatchResult<P = DecodedProduct> {
  kind: MatchKind
  exact: Ranked<P> | null
  similar: Ranked<P>[]
  /** best score seen (for analytics buckets / debugging) */
  top: number
}

/**
 * Two ways to be EXACT (one of our designs), both need a clear lead over the runner-up product:
 *   tier 1: a near-copy of an index image   score ≥ exact  and lead ≥ margin
 *   tier 2: a real photo (skew, light, crop) score ≥ exact2 and lead ≥ margin2 (lower score, much bigger lead)
 */
export function isExact(top: number, second: number, t: Pick<MatchThresholds, 'exact' | 'margin' | 'exact2' | 'margin2'> = MATCH): boolean {
  const lead = top - second
  return (top >= t.exact && lead >= t.margin) || (top >= t.exact2 && lead >= t.margin2)
}

/**
 * EXACT   = isExact(best, runner-up).
 * SIMILAR = everything else ≥ similar threshold (max 12).
 * NONE    = nothing reaches the similar threshold.
 */
export function classify<P>(ranked: Ranked<P>[], t: MatchThresholds = MATCH): MatchResult<P> {
  const top = ranked[0]?.score ?? -1
  const second = ranked[1]?.score ?? -1
  const exact = ranked[0] && isExact(top, second, t) ? ranked[0] : null
  const similar = ranked.filter((r) => r !== exact && r.score >= t.similar).slice(0, t.maxSimilar)
  return { kind: exact ? 'exact' : similar.length ? 'similar' : 'none', exact, similar, top }
}

/** 0..1 bar width for a score: similar threshold → 0.15, exact threshold → 0.8, a perfect match → 1 (piecewise). */
export function matchStrength(score: number, t: { similar: number; exact: number } = MATCH, exactMatch = false): number {
  if (exactMatch && score < t.exact) return Math.max(0.8, Math.min(1, matchStrength(score, t)))
  if (score >= t.exact) return Math.min(1, 0.8 + (0.2 * (score - t.exact)) / Math.max(1e-6, 1 - t.exact))
  return Math.max(0, 0.15 + (0.65 * (score - t.similar)) / Math.max(1e-6, t.exact - t.similar))
}
