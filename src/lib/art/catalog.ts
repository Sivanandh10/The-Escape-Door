// Products + collections the art system renders (lab route + mockup generator).
// Reads the seed directly (static, deterministic — no Supabase at build time).
import { collections, products } from '@/lib/data/seed'
import { sidesFor } from './compose'
import type { ArtCollection, ArtProduct, ArtSide } from './types'

export function artProducts(): ArtProduct[] {
  return products
}

export function artProduct(slug: string): ArtProduct | undefined {
  return products.find((p) => p.slug === slug)
}

export function artCollection(slug: string): ArtCollection | undefined {
  return collections.find((c) => c.slug === slug)
}

/** Every mockup file the catalogue references: /mockups/<slug>-<side>.webp */
export function mockupJobs(): Array<{ slug: string; side: ArtSide; file: string }> {
  const jobs: Array<{ slug: string; side: ArtSide; file: string }> = []
  for (const p of products) {
    const sides = new Set<ArtSide>()
    for (const im of p.images ?? []) {
      const m = /^\/mockups\/(.+)-(front|back)\.webp$/.exec(im.src)
      if (m && m[1] === p.slug) sides.add(m[2] as ArtSide)
    }
    if (!sides.size) sidesFor(p.type).forEach((s) => sides.add(s))
    for (const side of sides) jobs.push({ slug: p.slug, side, file: `${p.slug}-${side}.webp` })
  }
  return jobs
}
