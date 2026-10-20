// S01 — product cut-outs floating in the cover panel, so a first-time visitor reads "merch store" in one glance.
// Owner: S01. Server component. The pictures are the catalogue's own garment/flat-lay renders (pre-exported
// alpha rasters in /public/art, picked from the live products); a product whose raster isn't exported is skipped.
// Decorative (aria-hidden). HeroMotion drives [data-cutout] (intro pop + scroll parallax by data-depth).
import type { CSSProperties } from 'react'
import type { Product, ProductType } from '@/lib/types'
import { productDoc, staticProductImage } from '@/lib/art/static'
import s from './hero.module.css'

interface Slot {
  types: ProductType[]
  side: 'front' | 'back'
  /** position/size inside the cover panel (mobile = stacked block, lg = stage-relative) */
  cls: string
  /** opacity classes (on the inner layer — GSAP owns the outer one's opacity) */
  fade: string
  rotate: number
  depth: number
  bob: string
}

// lg: the cover panel spans x 5.2–60% (diagonal right edge 60% → 52%); the copy column ends ≈ 48%.
const SLOTS: Slot[] = [
  {
    types: ['hoodie'],
    side: 'back',
    cls: 'right-[-14%] top-[1%] w-[50%] sm:right-[-4%] sm:w-[34%] lg:left-[43.5%] lg:right-auto lg:top-[5%] lg:w-[15.5%]',
    fade: 'opacity-[0.5] lg:opacity-[0.92]',
    rotate: 9,
    depth: 1,
    bob: '5.8s',
  },
  {
    types: ['tshirt'],
    side: 'back',
    cls: 'right-[-10%] top-[38%] w-[40%] sm:right-[2%] sm:top-[30%] sm:w-[26%] lg:left-[46.5%] lg:right-auto lg:top-[38%] lg:w-[12.5%]',
    fade: 'opacity-[0.2] sm:opacity-[0.36] lg:opacity-[0.88]',
    rotate: -10,
    depth: 1.8,
    bob: '6.6s',
  },
  {
    types: ['polaroid'],
    side: 'front',
    cls: 'hidden lg:block lg:left-[48.5%] lg:top-[70%] lg:w-[8%]',
    fade: 'lg:opacity-[0.9]',
    rotate: 7,
    depth: 2.4,
    bob: '5.2s',
  },
  {
    types: ['poster'],
    side: 'front',
    cls: 'hidden lg:block lg:left-[28.5%] lg:top-[-1%] lg:w-[8%]',
    fade: 'lg:opacity-[0.75]',
    rotate: -6,
    depth: 0.6,
    bob: '7.2s',
  },
]

function pick(products: Product[], slot: Slot, used: Set<string>) {
  const pool = products.filter((p) => slot.types.includes(p.type) && !used.has(p.slug))
  pool.sort((a, z) => Number(z.featured) - Number(a.featured) || Number(z.dropOfWeek) - Number(a.dropOfWeek))
  for (const p of pool) {
    try {
      const file = staticProductImage(productDoc(p, { side: slot.side }))
      if (file) {
        used.add(p.slug)
        return { p, file }
      }
    } catch {
      /* a product the art builders can't draw → try the next one */
    }
  }
  return null
}

export function HeroCutouts({ products }: { products?: Product[] }) {
  if (!products?.length) return null
  const used = new Set<string>()
  const items = SLOTS.map((slot) => ({ slot, hit: pick(products, slot, used) })).filter((x) => x.hit)
  if (!items.length) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden lg:overflow-visible">
      {items.map(({ slot, hit }, i) => (
        <div key={hit!.p.slug} data-cutout data-depth={slot.depth} className={`absolute ${slot.cls}`}>
          <div className={slot.fade} style={{ rotate: `${slot.rotate}deg` }}>
            <div className={s.bob} style={{ '--bob-dur': slot.bob, '--bob-delay': `${-i * 1.3}s` } as CSSProperties}>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- content-addressed static rasters with srcSet */}
                <img
                  src={hit!.file.src.replace(/\.webp$/, '-500.webp')}
                  srcSet={hit!.file.srcSet}
                  sizes="(min-width: 1024px) 16vw, 45vw"
                  alt=""
                  width={1000}
                  height={1100}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  draggable={false}
                  className={s.cutImg}
                />
                <span className={s.cutTint} style={{ '--cut-src': `url(${hit!.file.src.replace(/\.webp$/, '-500.webp')})` } as CSSProperties} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default HeroCutouts
