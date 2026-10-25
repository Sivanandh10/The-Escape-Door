// Root share card (every page without its own): static JPEG from public/og/default.jpg. Owner: SHARE.
// Regenerate with `node scripts/generate-og.mjs`. WhatsApp needs JPEG/PNG — never WebP here.
import { DEFAULT_OG, OG_SIZE, OG_TYPE, ogResponse } from '@/lib/og-image'

export const alt = DEFAULT_OG.alt
export const size = OG_SIZE
export const contentType = OG_TYPE

export default function Image() {
  return ogResponse('default.jpg')
}
