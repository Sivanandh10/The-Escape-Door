// Builds the photo-search index: embeds every product image and upserts product_image_embeddings. Owner: SEARCH.
//   node scripts/build-image-index.mts            all products (hidden ones too), skip images already indexed
//   node scripts/build-image-index.mts --force    re-embed everything (after replacing files under the same URL)
//   node scripts/build-image-index.mts --dry      embed + report, write nothing
// Needs: supabase/migrations/0011_image_index.sql applied, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) +
// NEXT_PUBLIC_SUPABASE_URL in .env.local. Images: "/mockups/…" are read from public/, URLs are downloaded.
// Same model / dtype / preprocessing family as the browser worker (src/lib/visual-search/embed.worker.ts).
// Afterwards the storefront picks the rows up on its next index refresh: an admin product save (tag 'products') or
// the admin "Rebuild image search index" button refreshes the cache immediately; otherwise within an hour
// (cacheLife('hours')).
import type * as Lib from './lib/visual-search-node.mjs'

const L: typeof Lib = await import(new URL('./lib/visual-search-node.mts', import.meta.url).href)
const { createEmbedder, fetchProducts, loadImageBytes, productImages, supabaseEnv, MODEL_KEY, EMBED_DIM, vec } = L

const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const DRY = args.has('--dry')
const TABLE = 'product_image_embeddings'

/** A clean stop: message + exit code 1 (no process.exit(): on Windows it can abort while onnxruntime's threads close). */
class Fatal extends Error {}

const { url, service } = supabaseEnv()
const headers = { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 404 || /product_image_embeddings/.test(body)) {
      throw new Fatal('✗ Table public.product_image_embeddings not found. Apply supabase/migrations/0011_image_index.sql first.')
    }
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.slice(0, 300)}`)
  }
  return res
}

async function main() {
if (!url || !service) throw new Fatal('✗ Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (service role writes the index).')
// existing rows for this model (to skip unless --force)
const existing = new Set<string>()
if (!FORCE) {
  for (let from = 0; ; from += 1000) {
    const res = await rest(`${TABLE}?select=product_id,image_src&model=eq.${encodeURIComponent(MODEL_KEY)}&order=product_id,image_src`, { headers: { range: `${from}-${from + 999}` } })
    const rows = (await res.json()) as { product_id: string; image_src: string }[]
    for (const r of rows) existing.add(`${r.product_id}\u0000${r.image_src}`)
    if (rows.length < 1000) break
  }
}

const { rows: products, source } = await fetchProducts()
console.log(`${products.length} products (${source}) · model ${MODEL_KEY} · ${existing.size} images already indexed${FORCE ? ' (ignored: --force)' : ''}${DRY ? ' · DRY RUN' : ''}`)

const embedder = await createEmbedder()
let embedded = 0, skipped = 0, failed = 0, removed = 0
const t0 = Date.now()
for (const p of products) {
  const imgs = productImages(p)
  const batch: { product_id: string; image_src: string; model: string; dim: number; vec: string }[] = []
  for (const im of imgs) {
    if (existing.has(`${p.id}\u0000${im.src}`)) {
      skipped++
      continue
    }
    try {
      const v = await embedder.embed(await loadImageBytes(im.src))
      batch.push({ product_id: p.id, image_src: im.src, model: MODEL_KEY, dim: EMBED_DIM, vec: vec.encodeVec(v) })
      embedded++
    } catch (e) {
      failed++
      console.warn(`! ${p.slug} ${im.src}: ${(e as Error).message}`)
    }
  }
  if (DRY) continue
  if (batch.length) {
    await rest(`${TABLE}?on_conflict=product_id,image_src,model`, { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(batch) })
  }
  // drop rows of images this product no longer has (derived data; see migration 0011 header)
  const res = await rest(`${TABLE}?select=image_src,model&product_id=eq.${encodeURIComponent(p.id)}`)
  const have = (await res.json()) as { image_src: string; model: string }[]
  const keep = new Set(imgs.map((i) => i.src))
  for (const r of have.filter((r) => r.model !== MODEL_KEY || !keep.has(r.image_src))) {
    await rest(`${TABLE}?product_id=eq.${encodeURIComponent(p.id)}&image_src=eq.${encodeURIComponent(r.image_src)}&model=eq.${encodeURIComponent(r.model)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } })
    removed++
  }
  process.stdout.write(`\r${p.slug.padEnd(48).slice(0, 48)} ${embedded} embedded · ${skipped} skipped · ${failed} failed`)
}
process.stdout.write('\n')
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s · ${embedded} embedded · ${skipped} already there · ${removed} stale rows removed · ${failed} failed`)
if (!DRY) console.log('Storefront: the cached index refreshes within an hour, on the next product save, or right away via Admin → Products → "Rebuild image search index".')
}

try {
  await main()
} catch (e) {
  if (!(e instanceof Fatal)) throw e
  console.error(e.message)
  process.exitCode = 1
}
