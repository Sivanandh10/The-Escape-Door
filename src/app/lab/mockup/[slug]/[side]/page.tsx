// Render route for the mockup generator: one 1200x1500 composition per product side.
// /lab/mockup/<slug>/<front|back>  (noindex, dev QA). Screenshotted by scripts/generate-mockups.mjs.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { compositionSvg, MOCKUP_H, MOCKUP_W } from '@/lib/art'
import { artCollection, artProduct, mockupJobs } from '@/lib/art/catalog'
import { artFontVars } from '../../fonts'

export const metadata: Metadata = { title: 'Mockup lab', robots: { index: false, follow: false } }

export async function generateStaticParams() {
  // Dev-only generator route: prerender a single page in production builds (Cache Components needs ≥1).
  const jobs = mockupJobs().map((j) => ({ slug: j.slug, side: j.side }))
  return process.env.NODE_ENV === 'production' ? jobs.slice(0, 1) : jobs
}

export default async function MockupPage({ params }: { params: Promise<{ slug: string; side: string }> }) {
  const { slug, side } = await params
  const product = artProduct(slug)
  if (!product || (side !== 'front' && side !== 'back')) notFound()
  const svg = compositionSvg(product, { side, collection: artCollection(product.collection) })
  return (
    <main style={{ background: '#0B0B0F', minHeight: '100vh', padding: 0, margin: 0 }}>
      <div
        id="mockup"
        data-slug={slug}
        data-side={side}
        style={{ ...artFontVars, width: MOCKUP_W, height: MOCKUP_H, lineHeight: 0, position: 'relative' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </main>
  )
}
