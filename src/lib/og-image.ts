// Share cards (Open Graph / Twitter) — owner: SHARE. Server-only (node:fs): never import from 'use client'.
// The cards are static 1200×630 JPEGs in public/og, rendered by `node scripts/generate-og.mjs`
// (WhatsApp ignores WebP; every card < 300 KB). public/og/index.json maps slug → content hash, used as
// a ?v= cache-buster so WhatsApp / Facebook re-scrape a card after it is regenerated.
import fs from 'node:fs'
import path from 'node:path'
import ogIndex from '../../public/og/index.json'
import { SITE_URL } from './seo'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_TYPE = 'image/jpeg'

type OgGroup = 'products' | 'arcs' | 'shop'
type OgIndex = { default?: string; products: Record<string, string>; arcs: Record<string, string>; shop: Record<string, string> }
const INDEX = ogIndex as OgIndex

const withV = (p: string, v?: string) => (v ? `${p}?v=${v}` : p)

/** Root card: /og/default.jpg?v=… (relative — metadataBase makes it absolute). */
export const DEFAULT_OG = {
  url: withV('/og/default.jpg', INDEX.default),
  ...OG_SIZE,
  type: OG_TYPE,
  alt: 'The Escape Door: anime merch drawn like a living manga volume, oversized tee and hoodie art',
}

/** The generated card for a product / arc / shop category, or null when the script has not made one yet. */
export function ogCard(group: OgGroup, slug: string): string | null {
  const v = INDEX[group]?.[slug]
  return v ? withV(`/og/${group}/${slug}.jpg`, v) : null
}

/** Every slug that has a generated card in a group (generateStaticParams of the image routes). */
export function ogSlugs(group: OgGroup): string[] {
  return Object.keys(INDEX[group] ?? {})
}

/** Relative path of the card file inside public/og (falls back to the root card). */
export function ogFile(group: OgGroup, slug: string): string {
  return INDEX[group]?.[slug] ? `${group}/${slug}.jpg` : 'default.jpg'
}

/**
 * Bytes of public/og/<rel> as an image response, for opengraph-image / twitter-image routes.
 * Read from disk (build / prerender, or when the files are traced into the function); otherwise fetched
 * from the CDN copy of /og/<rel> so a cold serverless function still answers 200 image/jpeg.
 */
export async function ogResponse(rel: string): Promise<Response> {
  const headers = { 'Content-Type': OG_TYPE, 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' }
  const safe = rel.startsWith('/') ? rel.slice(1) : rel
  if (!/^[a-z0-9/-]+\.jpg$/.test(safe) || safe.includes('..')) return new Response('Not found', { status: 404 })
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'og', safe))
    return new Response(new Uint8Array(buf), { headers })
  } catch {
    for (const candidate of [safe, 'default.jpg']) {
      try {
        const r = await fetch(`${SITE_URL}/og/${candidate}`)
        if (r.ok) return new Response(await r.arrayBuffer(), { headers })
      } catch {
        /* try the next one */
      }
    }
    return new Response('Not found', { status: 404 })
  }
}
