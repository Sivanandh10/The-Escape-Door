// Per-collection share card (twitter): static JPEG public/og/arcs/<slug>.jpg (scripts/generate-og.mjs),
// the root card when none exists yet. Owner: SHARE.
import { OG_SIZE, OG_TYPE, ogFile, ogResponse } from '@/lib/og-image'

export const alt = 'Anime arc share card: original fan-inspired designs by The Escape Door'
export const size = OG_SIZE
export const contentType = OG_TYPE

export default async function Image({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params
  return ogResponse(ogFile('arcs', collection))
}
