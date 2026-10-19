// <TeeArt product side /> — SVG version of the black oversized tee / hoodie mockup (owner: F3b).
// Used by Drop of the Week (S03), Back-Print Reveal (S04) and the Custom Forge preview.
// Same builders as public/mockups/<slug>-<side>.webp, so the animated art matches the photos.
import { ProductArt, type ProductArtProps } from './ProductArt'

export interface TeeArtProps extends Omit<ProductArtProps, 'side'> {
  /** 'front' = chest mark, 'back' = full back print (default 'back') */
  side?: 'front' | 'back'
}

export function TeeArt({ side = 'back', ...rest }: TeeArtProps) {
  return <ProductArt side={side} {...rest} />
}

export default TeeArt
