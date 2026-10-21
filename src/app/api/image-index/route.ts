// GET /api/image-index — the visual-search index for the browser (owner: SEARCH).
// → { model, dim, items: [{ slug, name, price, image, type, arc, vecs: [one string per image: its views (base64 int8 × dim) back to back] }], at }
// PUBLISHED products only; ~2 kB per product image (one string = its 2–3 index views, vec.ts viewsFor). Cached with the 'products' + 'image-index' tags
// (src/lib/visual-search/index-server.ts), so a catalogue save or an embedding write refreshes it.
// The photo itself never comes here: matching runs in the shopper's browser.
import { getImageIndex } from '@/lib/visual-search/index-server'

export async function GET() {
  const index = await getImageIndex()
  return Response.json(index)
}
