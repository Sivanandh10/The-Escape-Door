// S01 — the product showcase behind the door (data + a tiny shared clock). Owner: S01.
// Pure + client/server safe. The server picks the items from the live catalogue (Admin → Products), the
// CSS doorway, the WebGL doorway and the DOM chip all read ONE index from `showcaseStore`, so the three layers
// always show the same product.
import type { Product, ProductType } from '@/lib/types'
import { productPriceLabel } from '@/lib/pricing'

export interface ShowcaseItem {
  slug: string
  name: string
  /** short type label for the chip ("Hoodie") */
  kind: string
  /** "₹800" / "From ₹400" / "Price on request" */
  price: string
  /** 4:5 product image (mockup or an admin upload) */
  src: string
  alt: string
  /** 'contain' for transparent product renders (whole garment visible), 'cover' for photos/mockups */
  fit?: 'cover' | 'contain'
}

/** Rotation order: one of each kind before repeating, so a visitor sees the range (tee → hoodie → polaroid …). */
const BUCKETS: Array<{ kind: string; types: ProductType[] }> = [
  { kind: 'Oversized tee', types: ['tshirt'] },
  { kind: 'Hoodie', types: ['hoodie'] },
  { kind: 'Polaroids', types: ['polaroid'] },
  { kind: 'Poster', types: ['poster'] },
  { kind: 'Cosplay', types: ['cosplay', 'katana', 'cape', 'hat'] },
]

const KIND: Partial<Record<ProductType, string>> = {
  tshirt: 'Tee', hoodie: 'Hoodie', polaroid: 'Polaroids', poster: 'Poster', cosplay: 'Cosplay', katana: 'Cosplay prop',
  cape: 'Cosplay cape', hat: 'Cosplay hat',
}

/** Smaller raster for the generated mockups (`x.webp` → `x-600.webp`); admin uploads are used as-is. */
export function showcaseSrc(src: string): string {
  const m = /^(\/mockups\/.+?)(-600)?\.webp$/.exec(src)
  return m ? `${m[1]}-600.webp` : src
}

/** Server-supplied fallback: a clean product render (no "SAMPLE" stamp) for products that only have seeded mockups. */
export type BareImage = (p: Product, side: 'front' | 'back') => string | null

const hasReal = (p: Product) => p.images.some((i) => i?.src && !i.sample)

function imageOf(p: Product, bare?: BareImage): { src: string; alt: string; fit?: 'contain' } | null {
  const imgs = p.images.filter((i) => i && typeof i.src === 'string' && i.src)
  if (!imgs.length) return null
  // apparel: the big back print sells it; everything else: the first image
  const apparel = p.type === 'tshirt' || p.type === 'hoodie'
  // 1) a real (admin-uploaded) photo always wins — back print first for apparel
  const real = (apparel ? imgs.find((i) => !i.sample && i.side === 'back') : null) ?? imgs.find((i) => !i.sample)
  if (real) return real
  // 2) only seeded mockups (they carry a "SAMPLE — replace with real photo" stamp) → the bare render instead
  const side = apparel ? 'back' : 'front'
  const clean = bare?.(p, side)
  if (clean) return { src: clean, alt: p.name, fit: 'contain' }
  // 3) last resort: the mockup itself
  return (apparel ? imgs.find((i) => i.side === 'back') : null) ?? imgs[0]
}

/** Up to `limit` products for the doorway: real photos first, then featured inside each kind, kinds interleaved. */
export function pickShowcase(products: Product[] | undefined, limit = 8, bare?: BareImage): ShowcaseItem[] {
  if (!products?.length) return []
  const pool = products.filter((p) => p.stock !== 'out' && imageOf(p, bare))
  const queues = BUCKETS.map((b) =>
    pool
      .filter((p) => b.types.includes(p.type))
      .sort(
        (a, z) =>
          Number(hasReal(z)) - Number(hasReal(a)) ||
          Number(z.featured) - Number(a.featured) ||
          Number(z.dropOfWeek) - Number(a.dropOfWeek),
      ),
  )
  const out: Product[] = []
  for (let round = 0; out.length < limit && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (out.length >= limit) break
      if (q[round]) out.push(q[round])
    }
  }
  return out.map((p) => {
    const img = imageOf(p, bare)!
    return {
      slug: p.slug,
      name: p.name,
      kind: KIND[p.type] ?? 'Merch',
      price: productPriceLabel(p),
      src: showcaseSrc(img.src),
      alt: img.alt || p.name,
      ...(img.fit ? { fit: img.fit } : {}),
    }
  })
}

// ---------------------------------------------------------------- shared clock (client)
type Listener = () => void
const listeners = new Set<Listener>()

/** Current item index + count + paused flag. `i` is read every frame by the WebGL door. */
export const showcaseStore = {
  i: 0,
  n: 0,
  paused: false,
  /** bumps on every manual/auto change (lets the chip restart its progress bar) */
  tick: 0,
  set(i: number) {
    if (!this.n) return
    this.i = ((i % this.n) + this.n) % this.n
    this.tick++
    listeners.forEach((l) => l())
  },
  setPaused(v: boolean) {
    this.paused = v
    listeners.forEach((l) => l())
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
}

/** Auto-advance interval (ms). */
export const SHOWCASE_MS = 2200
