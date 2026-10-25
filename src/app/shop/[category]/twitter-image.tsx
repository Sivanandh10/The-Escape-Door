// Per-category share card (twitter): static JPEG public/og/shop/<slug>.jpg (scripts/generate-og.mjs),
// the root card when none exists yet. Owner: SHARE.
import { OG_SIZE, OG_TYPE, ogFile, ogResponse } from '@/lib/og-image'

export const alt = 'Shop category share card: fan-inspired anime merch by The Escape Door'
export const size = OG_SIZE
export const contentType = OG_TYPE

export default async function Image({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  return ogResponse(ogFile('shop', category))
}
