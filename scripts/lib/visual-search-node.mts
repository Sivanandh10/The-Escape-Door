// Shared Node helpers for scripts/build-image-index.mts and scripts/calibrate-image-search.mts. Owner: SEARCH.
// Same model + dtype as the browser worker (src/lib/visual-search/embed.worker.ts), CPU backend (onnxruntime-node).
// Reads Supabase keys from .env.local into process.env (never prints them).
// Import order matters: transformers (and the CommonJS onnxruntime-node it requires) must load BEFORE the repo's
// TS resolve hook is registered — the hook rewrites relative requires to file: URLs, which CommonJS can't load.
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env as hfEnv } from '@huggingface/transformers'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import '../../src/lib/data/node-ts-hook.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const T = await import(new URL('../../src/lib/visual-search/thresholds.ts', import.meta.url).href)
const V = await import(new URL('../../src/lib/visual-search/vec.ts', import.meta.url).href)
export const MODEL_ID: string = T.MODEL_ID
export const MODEL_KEY: string = T.MODEL_KEY
export const MODEL_DTYPE: 'fp16' = T.MODEL_DTYPE
export const EMBED_DIM: number = T.EMBED_DIM
export const MATCH: { exact: number; margin: number; similar: number; maxSimilar: number } = T.MATCH
export const vec = V as typeof import('../../src/lib/visual-search/vec')

hfEnv.allowLocalModels = false

// ---------------------------------------------------------------- env
export function loadEnvLocal(): void {
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || process.env[m[1]]) continue
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

export function supabaseEnv(): { url: string; anon: string; service: string } {
  loadEnvLocal()
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  const service = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return { url, anon, service }
}

// ---------------------------------------------------------------- products
export interface ProductRow {
  id: string
  slug: string
  name: string
  type: string
  collection: string
  is_published: boolean
  images: { src: string; alt?: string; side?: string }[]
}

/** Every product (service key) or the published ones (anon key); falls back to the seed catalogue offline. */
export async function fetchProducts(opts: { publishedOnly?: boolean } = {}): Promise<{ rows: ProductRow[]; source: string }> {
  const { url, anon, service } = supabaseEnv()
  const key = service || anon
  if (url && key) {
    const q = new URL(`${url}/rest/v1/products`)
    q.searchParams.set('select', 'id,slug,name,type,collection,is_published,images')
    q.searchParams.set('order', 'sort_order.asc')
    if (opts.publishedOnly || !service) q.searchParams.set('is_published', 'eq.true')
    const res = await fetch(q, { headers: { apikey: key, authorization: `Bearer ${key}` } })
    if (res.ok) return { rows: (await res.json()) as ProductRow[], source: service ? 'supabase (service role)' : 'supabase (anon, published only)' }
    console.warn(`! products request failed (${res.status}) — using the seed catalogue`)
  }
  const seed = await import(new URL('../../src/lib/data/seed.ts', import.meta.url).href)
  const rows = (seed.products as Array<{ id: string; slug: string; name: string; type: string; collection: string; images: ProductRow['images'] }>).map(
    (p) => ({ id: p.id, slug: p.slug, name: p.name, type: p.type, collection: p.collection, is_published: true, images: p.images }),
  )
  return { rows, source: 'seed catalogue' }
}

/** Images worth indexing: non-empty src, deduped per product. */
export function productImages(p: ProductRow): { src: string; side: string }[] {
  const seen = new Set<string>()
  const out: { src: string; side: string }[] = []
  for (const im of Array.isArray(p.images) ? p.images : []) {
    const src = typeof im?.src === 'string' ? im.src.trim() : ''
    if (!src || seen.has(src)) continue
    seen.add(src)
    out.push({ src, side: im.side ?? 'front' })
  }
  return out
}

/** "/mockups/x.webp" → bytes from public/, "https://…" → fetched bytes. */
export async function loadImageBytes(src: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`GET ${src} → ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
  const rel = src.split('?')[0].replace(/^\/+/, '')
  const file = path.join(ROOT, 'public', rel)
  if (!file.startsWith(path.join(ROOT, 'public'))) throw new Error(`refusing path outside public/: ${src}`)
  return fs.promises.readFile(file)
}

/** Any encoded image → RawImage (RGB) via sharp, so manipulated buffers and files go through the same decoder. */
export async function toRawImage(bytes: Buffer): Promise<RawImage> {
  const img = sharp(bytes).rotate()
  const m = await img.metadata()
  const oriented = (m.orientation ?? 1) >= 5 // EXIF 5–8 swap width / height
  const W = (oriented ? m.height : m.width) ?? 1
  const H = (oriented ? m.width : m.height) ?? 1
  const { w, h } = vec.preShrinkSize(W, H)
  const { data, info } = await img
    .resize({ width: w, height: h, fit: 'fill' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  return new RawImage(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, 3)
}

// ---------------------------------------------------------------- model
export interface Embedder {
  embed(bytes: Buffer): Promise<Float32Array>
}

export async function createEmbedder(): Promise<Embedder> {
  const t = Date.now()
  const processor = await AutoProcessor.from_pretrained(MODEL_ID)
  const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE, device: 'cpu' })
  console.log(`model ${MODEL_ID} (${MODEL_DTYPE}) ready in ${((Date.now() - t) / 1000).toFixed(1)} s`)
  return {
    async embed(bytes: Buffer) {
      const image = await toRawImage(bytes)
      const inputs = await processor(image)
      const { image_embeds } = await model(inputs)
      return vec.l2normalize(Float32Array.from(image_embeds.data as Float32Array))
    },
  }
}
