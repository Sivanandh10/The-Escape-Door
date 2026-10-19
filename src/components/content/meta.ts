// Per-page metadata for P5 pages (SITEMAP §2.7–2.11): exact title (absolute — SITEMAP titles already
// carry the brand), meta description, clean canonical, OG + Twitter. Owner: P5.
import type { Metadata } from 'next'

export function pageMeta({
  title,
  description,
  path,
  ogImage = true,
  noindex = false,
}: {
  title: string
  description: string
  path: string
  /** false when the segment has its own opengraph-image.tsx (file convention wins) */
  ogImage?: boolean
  noindex?: boolean
}): Metadata {
  const images = ogImage ? [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'The Escape Door — anime merch, drawn like a manga volume' }] : undefined
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'The Escape Door', locale: 'en_IN', url: path, title, description, ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
