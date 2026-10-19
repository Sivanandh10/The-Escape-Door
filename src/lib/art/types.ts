// Structural types for the art system. `Product` / `Collection` from '@/lib/types' are assignable to these.

export type ArtMotif = 'smoke' | 'walls' | 'flames' | 'waves' | 'spiral' | 'ribbons' | 'speedlines'
export type ArtSide = 'front' | 'back'

export interface ArtProduct {
  slug: string
  name?: string
  type: string
  collection: string
  designTitle: string
  jpTitle?: string
  colorBlock?: string
  tags?: string[]
  variants?: ReadonlyArray<{ label: string; attrs?: Record<string, string> }>
}

export interface ArtCollection {
  slug: string
  name?: string
  jp?: string
  motif: ArtMotif
  accentA: string
  accentB: string
}

/** Everything a builder needs, fully resolved. */
export interface ArtSpec {
  slug: string
  type: string
  title: string
  jp: string
  collectionName: string
  motif: ArtMotif
  colorA: string
  colorB: string
  block: string
  /** layout template for the back print / flat-lay arrangement */
  template: 'A' | 'B' | 'C'
  /** variant hint, e.g. 'led' katana, 'magnetic' bookmark, 'pack' */
  variant: string
  /** unique id prefix for <defs> (multiple inline SVGs on one page) */
  uid: string
}
