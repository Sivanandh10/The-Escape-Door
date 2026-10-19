// /lab/s12 — isolated QA preview for S12 Beyond Anime + S13 Instagram (empty + sample posts). noindex.
import type { Metadata } from 'next'
import { getCollection, getInstaPosts, getSettings } from '@/lib/data/repo'
import { products } from '@/lib/data/seed'
import type { InstaPost } from '@/lib/types'
import S12Beyond from '@/components/home/S12Beyond'
import S13Instagram from '@/components/home/S13Instagram'

export const metadata: Metadata = {
  title: 'Lab · S12 + S13',
  robots: { index: false, follow: false },
}

export default async function LabS12() {
  const [beyond, posts, settings] = await Promise.all([getCollection('beyond-anime'), getInstaPosts(), getSettings()])
  // lab-only stand-ins for the "posts exist" state, built from our own product mockups
  const sample: InstaPost[] = products
    .filter((p) => p.type === 'tshirt' || p.type === 'poster' || p.type === 'hoodie')
    .slice(0, 7)
    .map((p, i) => ({
      id: `lab-${p.slug}`,
      image: `/mockups/${p.slug}-front-600.webp`,
      url: settings.instagram,
      caption: `LAB SAMPLE — ${p.name}`,
      order: i,
    }))
  return (
    <div className="bg-ink">
      <div className="container-x grid min-h-[90vh] place-content-center gap-4 py-24 text-paper">
        <p className="label text-volt">Lab · S12 + S13</p>
        <p className="max-w-[48ch] text-tone-4">Scroll ↓ — the Beyond Anime door opens on scroll; the Instagram strip shows its empty state, then a sample-posts state.</p>
      </div>
      <S12Beyond collection={beyond} />
      <S13Instagram posts={posts} instagram={settings.instagram} />
      <div className="border-t-4 border-volt bg-ink py-6 text-center">
        <p className="label text-volt">↓ Posts state (lab sample data)</p>
      </div>
      <S13Instagram posts={sample} instagram={settings.instagram} />
    </div>
  )
}
