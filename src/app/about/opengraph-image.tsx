// /about share card (opengraph): the root 1200×630 JPEG (public/og/default.jpg). The page's own metadata sets no
// image, so this segment file is what WhatsApp / X / LinkedIn see. Owner: SHARE.
import { DEFAULT_OG, OG_SIZE, OG_TYPE, ogResponse } from '@/lib/og-image'

export const alt = DEFAULT_OG.alt
export const size = OG_SIZE
export const contentType = OG_TYPE

export default function Image() {
  return ogResponse('default.jpg')
}
