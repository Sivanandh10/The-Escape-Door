// Inline-SVG product art (owner: F3b) — the same deterministic builders that render
// public/mockups/*.webp, for animated sections (Drop of the Week, Back-Print Reveal, Forge, empty-image fallbacks).
// Server-safe. Dispatches by product.type: tshirt/hoodie → garment, everything else → flat-lay.
import { useId } from 'react'
import { compositionSvg, productArtSvg } from '@/lib/art/compose'
import type { ArtCollection, ArtProduct, ArtSide } from '@/lib/art/types'

export interface ProductArtProps {
  /** a Product from '@/lib/types' (structurally an ArtProduct) */
  product: ArtProduct
  /** apparel: 'front' (chest mark) | 'back' (big print). Flat-lays: 'back' = same subject. Default 'front'. */
  side?: ArtSide
  /** collection record (accents/motif from Supabase/seed). Optional — falls back to the built-in arc table. */
  collection?: Partial<ArtCollection> | null
  /** true → the full 1200×1500 feed composition (colour block, outline title, SAMPLE tag) instead of the bare product */
  framed?: boolean
  className?: string
  /** override the generated aria-label; '' → decorative (aria-hidden) */
  title?: string
}

/** Adds sizing + optional a11y overrides to a builder's root <svg>. */
function finish(svg: string, title: string | undefined): string {
  let s = svg.replace('<svg ', '<svg width="100%" height="100%" style="display:block" ')
  if (title === '') s = s.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')
  else if (title) s = s.replace(/aria-label="[^"]*"/, `aria-label="${title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"`)
  return s
}

export function ProductArt({ product, side = 'front', collection, framed = false, className, title }: ProductArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const opts = { side, collection, uid }
  const svg = framed ? compositionSvg(product, opts) : productArtSvg(product, opts)
  return (
    <div
      className={className}
      data-product-art={product.type}
      data-side={side}
      style={{ aspectRatio: framed ? '1200 / 1500' : '1000 / 1100', lineHeight: 0 }}
      // markup comes from our deterministic builders; text is escaped inside src/lib/art
      dangerouslySetInnerHTML={{ __html: finish(svg, title) }}
    />
  )
}

export default ProductArt
