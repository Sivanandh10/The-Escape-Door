// Root Twitter / X card — same JPEG as the Open Graph card. Owner: SHARE.
import { DEFAULT_OG, OG_SIZE, OG_TYPE, ogResponse } from '@/lib/og-image'

export const alt = DEFAULT_OG.alt
export const size = OG_SIZE
export const contentType = OG_TYPE

export default function Image() {
  return ogResponse('default.jpg')
}
