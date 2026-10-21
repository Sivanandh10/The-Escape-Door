'use server'
// Photo-search index writes from the admin (owner: SEARCH). Migration 0011_image_index.sql.
// The embeddings are computed in the admin's browser (same Web Worker / model as the storefront) and saved here.
// Guard: checkPerm('catalog.edit') + zod, then the SERVICE ROLE writes. Rows are derived data (a cache of vectors
// computed from the product images), so catalog.edit may also REPLACE them, i.e. delete the rows of images that
// were removed from a product or of an old model version. DOCUMENTED EXCEPTION to the "only the superadmin deletes"
// rule: this never deletes a product, an image file or anything that can't be recomputed; product deletes still go
// through deleteRows() (superadmin only) and their embeddings follow by ON DELETE CASCADE.
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { EMBED_DIM, MODEL_KEY } from '@/lib/visual-search/thresholds'
import { decodeVec, encodedLength, INDEX_VIEWS, splitVecs, viewsFor } from '@/lib/visual-search/vec'
import { IMAGE_INDEX_TAG } from '@/lib/visual-search/index-server'
import { checkPerm } from '../server'

export type IndexResult<T> = { ok: true; data: T } | { ok: false; error: string }

const TABLE = 'product_image_embeddings'
const MISSING_TABLE = 'The photo-search table is missing. Run supabase/migrations/0011_image_index.sql first.'

/** one row's `vec`: 1..INDEX_VIEWS.length encoded vectors back to back (vec.ts encodeVecs); the exact count for the
 *  image (vec.viewsFor(type, side)) is checked against the saved product below */
const vecSchema = z
  .string()
  .min(encodedLength(EMBED_DIM))
  .max(encodedLength(EMBED_DIM) * INDEX_VIEWS.length)
  .regex(/^[A-Za-z0-9+/=]+$/, 'not base64')
  .refine((s) => {
    const parts = splitVecs(s, EMBED_DIM)
    return (
      parts.length > 0 &&
      parts.every((v) => {
        const d = decodeVec(v, EMBED_DIM)
        return !!d && d.some((x) => x !== 0)
      })
    )
  }, 'not a valid embedding')

const replaceSchema = z.object({
  productId: z.string().min(1).max(200),
  items: z
    .array(z.object({ src: z.string().trim().min(1).max(2048), vec: vecSchema }))
    .max(40)
    .refine((items) => new Set(items.map((i) => i.src)).size === items.length, 'the same image is in the batch twice'),
})

const idsSchema = z.array(z.string().min(1).max(200)).max(500).optional()

function dbError(e: { code?: string; message?: string } | null): string {
  if (!e) return 'Unknown database error.'
  if (e.code === '42P01' || /product_image_embeddings/.test(e.message ?? '')) return MISSING_TABLE
  return `The database refused: ${e.message ?? e.code}`
}

/** Which product images already have an embedding for the current model. */
export async function imageIndexState(productIds?: string[]): Promise<IndexResult<{ model: string; rows: { productId: string; src: string }[] }>> {
  const auth = await checkPerm('catalog.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const ids = idsSchema.safeParse(productIds)
  if (!ids.success) return { ok: false, error: 'Bad product list.' }
  const sb = supabaseAdmin()
  if (!sb) return { ok: false, error: 'The server has no Supabase service key (SUPABASE_SERVICE_ROLE_KEY).' }
  const rows: { productId: string; src: string }[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    let q = sb.from(TABLE).select('product_id,image_src').eq('model', MODEL_KEY).order('product_id').order('image_src').range(from, from + 999)
    if (ids.data?.length) q = q.in('product_id', ids.data)
    const { data, error } = await q
    if (error) return { ok: false, error: dbError(error) }
    for (const r of (data ?? []) as { product_id: string; image_src: string }[]) rows.push({ productId: r.product_id, src: r.image_src })
    if (!data || data.length < 1000) break
  }
  return { ok: true, data: { model: MODEL_KEY, rows } }
}

/**
 * Upsert the given image embeddings of ONE product and drop that product's rows for images it no longer has (and
 * for older model versions). Each src must be one of the product's CURRENT images (read from the database).
 */
export async function replaceImageEmbeddings(input: { productId: string; items: { src: string; vec: string }[] }): Promise<IndexResult<{ saved: number; removed: number }>> {
  const auth = await checkPerm('catalog.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = replaceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: `Invalid embeddings: ${parsed.error.issues[0]?.message ?? 'bad input'}` }
  const sb = supabaseAdmin()
  if (!sb) return { ok: false, error: 'The server has no Supabase service key (SUPABASE_SERVICE_ROLE_KEY).' }
  const { productId, items } = parsed.data

  const { data: product, error: pErr } = await sb.from('products').select('id,type,images').eq('id', productId).maybeSingle()
  if (pErr) return { ok: false, error: dbError(pErr) }
  if (!product) return { ok: false, error: 'That product no longer exists.' }
  // src -> side of its first occurrence (the indexers use the same rule)
  const current = new Map<string, string | undefined>()
  for (const i of Array.isArray(product.images) ? (product.images as { src?: unknown; side?: unknown }[]) : []) {
    const src = typeof i?.src === 'string' ? i.src.trim() : ''
    if (src && !current.has(src)) current.set(src, typeof i.side === 'string' ? i.side : undefined)
  }
  const foreign = items.find((i) => !current.has(i.src))
  if (foreign) return { ok: false, error: 'An image in this batch is not on the saved product. Save the product, then try again.' }
  const badViews = items.find((i) => splitVecs(i.vec, EMBED_DIM).length !== viewsFor(String(product.type), current.get(i.src)))
  if (badViews) return { ok: false, error: 'Invalid embeddings: wrong number of views for an image.' }

  let saved = 0
  if (items.length) {
    const rows = items.map((i) => ({ product_id: productId, image_src: i.src, model: MODEL_KEY, dim: EMBED_DIM, views: splitVecs(i.vec, EMBED_DIM).length, vec: i.vec }))
    const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'product_id,image_src,model' })
    if (error) return { ok: false, error: dbError(error) }
    saved = rows.length
  }

  // stale rows of this product: removed images + older model versions (derived data, see header)
  const { data: existing, error: eErr } = await sb.from(TABLE).select('image_src,model').eq('product_id', productId)
  if (eErr) return { ok: false, error: dbError(eErr) }
  const stale = ((existing ?? []) as { image_src: string; model: string }[]).filter((r) => r.model !== MODEL_KEY || !current.has(r.image_src))
  let removed = 0
  // one delete per model key (usually one call): rows of this product whose image_src is no longer on it
  for (const model of new Set(stale.map((r) => r.model))) {
    const srcs = stale.filter((r) => r.model === model).map((r) => r.image_src)
    const { data: gone, error } = await sb.from(TABLE).delete().eq('product_id', productId).eq('model', model).in('image_src', srcs).select('image_src')
    if (error) {
      if (saved) updateTag(IMAGE_INDEX_TAG)
      return { ok: false, error: `Saved ${saved} image${saved === 1 ? '' : 's'}, but old rows could not be removed. ${dbError(error)}` }
    }
    removed += Array.isArray(gone) ? gone.length : 0
  }

  if (saved || removed) updateTag(IMAGE_INDEX_TAG)
  return { ok: true, data: { saved, removed } }
}

/** After a full rebuild: drop rows of older model versions everywhere. */
export async function pruneOldImageModels(): Promise<IndexResult<{ removed: number }>> {
  const auth = await checkPerm('catalog.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const sb = supabaseAdmin()
  if (!sb) return { ok: false, error: 'The server has no Supabase service key (SUPABASE_SERVICE_ROLE_KEY).' }
  const { data, error } = await sb.from(TABLE).delete().neq('model', MODEL_KEY).select('product_id')
  if (error) return { ok: false, error: dbError(error) }
  updateTag(IMAGE_INDEX_TAG)
  return { ok: true, data: { removed: Array.isArray(data) ? data.length : 0 } }
}
