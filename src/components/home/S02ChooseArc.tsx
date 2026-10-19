// S02 CHOOSE YOUR ARC — a corridor of collection doors (#10 #11 #18 #41 #31 #34). Owner: S02.
// Server shell: derives per-arc counts / "from ₹X" / peek mockup from the catalogue (repo is
// 'use cache', so the home page stays static) and hands plain data to the client corridor.
import type { Collection, Product } from '@/lib/types'
import { getProducts } from '@/lib/data/repo'
import { formatINR, variantBounds } from '@/lib/pricing'
import { readableOn } from '@/components/layout/nav'
import { ArcCorridor } from './s02/ArcCorridor'
import type { ArcDoorData } from './s02/types'

const PEEK_TYPES: string[] = ['tshirt', 'hoodie']

function lowestPrice(p: Product): number | null {
  if (p.priceOnRequest) return null
  const lows = p.variants
    .map(variantBounds)
    .filter((b): b is [number, number] => b !== null)
    .map((b) => b[0])
  if (lows.length) return Math.min(...lows)
  return p.priceFrom
}

function pickPeek(list: Product[]): ArcDoorData['peek'] {
  const apparel = list.filter((p) => PEEK_TYPES.includes(p.type))
  const best = apparel.find((p) => p.featured) ?? apparel[0] ?? list.find((p) => p.featured) ?? list[0]
  if (!best) return null
  const img = best.images.find((i) => i.side === 'back') ?? best.images[0]
  if (!img) return null
  // every generated mockup ships a 600px variant (API.md, F3)
  const src = img.src.startsWith('/mockups/') ? img.src.replace(/\.webp$/, '-600.webp') : img.src
  return { src, alt: img.alt, name: best.designTitle || best.name }
}

function toDoorData(collections: Collection[], products: Product[]): ArcDoorData[] {
  return [...collections]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => {
      const list = products.filter((p) => p.collection === c.slug)
      const prices = list.map(lowestPrice).filter((n): n is number => n !== null)
      return {
        slug: c.slug,
        name: c.name,
        jp: c.jp,
        group: c.group,
        accentA: c.accentA,
        accentB: c.accentB,
        motif: c.motif,
        tagline: c.tagline,
        count: list.length,
        fromLabel: prices.length ? `from ${formatINR(Math.min(...prices))}` : null,
        peek: pickPeek(list),
        index: i,
        fgA: readableOn(c.accentA),
      }
    })
}

export default async function S02ChooseArc({
  collections = [],
  products,
}: {
  collections?: Collection[]
  /** optional — fetched from the cached repo when page.tsx doesn't pass it */
  products?: Product[]
}) {
  const all = products ?? (await getProducts())
  return <ArcCorridor doors={toDoorData(collections, all)} />
}
