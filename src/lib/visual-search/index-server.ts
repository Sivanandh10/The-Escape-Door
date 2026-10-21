// Visual search — the public image index (SERVER ONLY). Owner: SEARCH.
// Joins product_image_embeddings (public read under RLS, migration 0011) with the PUBLISHED catalogue from the
// repo and returns the compact payload GET /api/image-index serves. Cached ('use cache', cookie-less client) with
// the 'products' tag (any catalogue save) and 'image-index' (embedding writes, imageIndexActions.ts).
// Never throws: a missing table / unconfigured Supabase gives an empty index (the UI then offers text search).
import { cacheLife, cacheTag } from 'next/cache'
import { getCollections, getProducts, TAGS } from '@/lib/data/repo'
import { productPriceLabel } from '@/lib/pricing'
import { publicClient } from '@/lib/supabase/server'
import type { ImageIndex, IndexedProduct } from './vec'
import { EMBED_DIM, MODEL_KEY } from './thresholds'

export const IMAGE_INDEX_TAG = 'image-index'

const PAGE = 1000
const MAX_ROWS = 20_000

interface EmbeddingRow { product_id: string; image_src: string; vec: string }

async function fetchEmbeddings(): Promise<EmbeddingRow[] | null> {
  const sb = publicClient()
  if (!sb) return null
  const out: EmbeddingRow[] = []
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await sb
        .from('product_image_embeddings')
        .select('product_id,image_src,vec')
        .eq('model', MODEL_KEY)
        .eq('dim', EMBED_DIM)
        .order('product_id', { ascending: true })
        .order('image_src', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error || !Array.isArray(data)) return out.length ? out : null
      out.push(...(data as EmbeddingRow[]))
      if (data.length < PAGE) break
    }
  } catch {
    return out.length ? out : null
  }
  return out
}

export async function getImageIndex(): Promise<ImageIndex> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.products, IMAGE_INDEX_TAG)
  const [products, collections, rows] = await Promise.all([getProducts(), getCollections(), fetchEmbeddings()])
  const arcName = new Map(collections.map((c) => [c.slug, c.name]))

  // an image URL used by several products (e.g. a shared "detail" slide) can't identify one of them
  const owners = new Map<string, number>()
  for (const p of products) for (const src of new Set(p.images.map((i) => i.src))) owners.set(src, (owners.get(src) ?? 0) + 1)

  const byProduct = new Map<string, Map<string, string>>()
  for (const r of rows ?? []) {
    if (!r?.product_id || !r.image_src || typeof r.vec !== 'string') continue
    let m = byProduct.get(r.product_id)
    if (!m) byProduct.set(r.product_id, (m = new Map()))
    m.set(r.image_src, r.vec)
  }

  const items: IndexedProduct[] = []
  for (const p of products) {
    const m = byProduct.get(p.id)
    if (!m) continue
    const vecs: string[] = []
    for (const img of p.images) {
      const v = m.get(img.src)
      if (!v || vecs.includes(v)) continue
      if ((owners.get(img.src) ?? 0) > 1 && img.side === 'detail') continue
      vecs.push(v)
    }
    if (!vecs.length) continue
    const cover = p.images.find((i) => i.side !== 'back' && i.src) ?? p.images[0]
    items.push({
      slug: p.slug,
      name: p.name,
      price: productPriceLabel(p),
      image: cover?.src ?? '',
      type: p.type,
      arc: arcName.get(p.collection) ?? p.collection,
      vecs,
    })
  }
  return { model: MODEL_KEY, dim: EMBED_DIM, items, at: new Date().toISOString() }
}
