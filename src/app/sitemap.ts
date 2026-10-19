// sitemap.xml (SITEMAP §1 rule 9 + critic addenda 5/6). Owner: P5.
// Indexable clean URLs only, data-driven (admin-added arcs/products appear automatically).
// No new Date(): static pages use fixed content dates; products use updatedAt (fallback createdAt).
import type { MetadataRoute } from 'next'
import { SHOP_CATEGORIES } from '@/components/layout/nav'
import { POLICIES } from '@/components/content/policies'
import { getCollections, getProducts } from '@/lib/data/repo'
import { absUrl } from '@/lib/seo'

/** Last content review of the static pages (bump when their copy changes). */
const CONTENT_UPDATED = '2026-10-19'

const latest = (dates: string[]) => dates.filter(Boolean).sort().at(-1) ?? CONTENT_UPDATED

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [collections, products] = await Promise.all([getCollections(), getProducts()])
  const stamp = (p: { updatedAt?: string; createdAt?: string }) => p.updatedAt || p.createdAt || CONTENT_UPDATED
  const catalogueUpdated = latest(products.map(stamp))

  const page = (path: string, priority: number, lastModified = CONTENT_UPDATED, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'monthly') => ({
    url: absUrl(path),
    lastModified,
    changeFrequency,
    priority,
  })

  return [
    page('/', 1, catalogueUpdated, 'weekly'),
    page('/shop', 0.9, catalogueUpdated, 'weekly'),
    ...SHOP_CATEGORIES.map((c) => page(c.href, 0.8, catalogueUpdated, 'weekly')),
    ...collections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((c) => page(`/arc/${c.slug}`, 0.8, latest(products.filter((p) => p.collection === c.slug).map(stamp)), 'weekly')),
    page('/custom', 0.8),
    page('/fests', 0.7),
    page('/cosplay', 0.7),
    page('/about', 0.5),
    page('/faq', 0.6),
    page('/contact', 0.4),
    ...POLICIES.map((p) => page(`/policies/${p.slug}`, 0.2, CONTENT_UPDATED, 'yearly')),
    ...products.map((p) => ({
      url: absUrl(`/product/${p.slug}`),
      lastModified: stamp(p),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      images: p.images.slice(0, 2).map((i) => absUrl(i.src)),
    })),
  ]
}
