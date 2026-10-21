'use client'
// Admin side of photo search (owner: SEARCH): keeps product_image_embeddings in step with the product images.
//   useImageIndexSync() → sync(product)   after a product save: embeds only images without a row (new / replaced
//                                          URL), removes rows of images the product no longer has. Runs in the
//                                          background (Web Worker), a toast reports it. Live mode only.
//   <RebuildImageIndexButton products />  re-embeds EVERY image of every product (hidden ones too) with a progress
//                                          bar, then drops rows of older model versions. Use after replacing an
//                                          image file in place under the same URL, or after a model change.
// The model + transformers.js load lazily (dynamic import) the first time either runs — never on page load.
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ScanSearch } from 'lucide-react'
import type { AdminProduct } from './entities'
import { adminBtn } from '../ui'
import { imageIndexState, pruneOldImageModels, replaceImageEmbeddings } from './imageIndexActions'
import { cn } from '@/lib/utils'

type Engine = typeof import('@/lib/visual-search/client')
type Vec = typeof import('@/lib/visual-search/vec')
let engineP: Promise<[Engine, Vec]> | null = null
const engine = () => (engineP ??= Promise.all([import('@/lib/visual-search/client'), import('@/lib/visual-search/vec')]))

const srcsOf = (p: Pick<AdminProduct, 'images'>) => [...new Set(p.images.map((i) => i.src.trim()).filter(Boolean))]

async function embedAll(srcs: string[], onEach?: () => void): Promise<{ items: { src: string; vec: string }[]; failed: string[] }> {
  const [E, V] = await engine()
  const items: { src: string; vec: string }[] = []
  const failed: string[] = []
  for (const src of srcs) {
    try {
      items.push({ src, vec: V.encodeVec(await E.embedUrl(src)) })
    } catch {
      failed.push(src)
    }
    onEach?.()
  }
  return { items, failed }
}

export function useImageIndexSync(live: boolean) {
  const running = useRef(new Map<string, Promise<void>>())
  return useCallback(
    (p: AdminProduct) => {
      if (!live) return
      const prev = running.current.get(p.id) ?? Promise.resolve()
      const next = prev.then(async () => {
        const state = await imageIndexState([p.id])
        if (!state.ok) {
          // table not migrated yet / no service key: say it once, quietly
          toast.message('Photo search not updated', { id: 'image-index-sync', description: state.error })
          return
        }
        const srcs = srcsOf(p)
        const have = new Set(state.data.rows.map((r) => r.src))
        const missing = srcs.filter((s) => !have.has(s))
        const stale = state.data.rows.some((r) => !srcs.includes(r.src))
        if (!missing.length && !stale) return
        const id = `image-index-${p.id}`
        if (missing.length) toast.loading(`Updating photo search for ${p.name}…`, { id, description: 'Reading the new images on this device.' })
        const { items, failed } = await embedAll(missing)
        const res = await replaceImageEmbeddings({ productId: p.id, items })
        if (!res.ok) {
          toast.error('Photo search not updated', { id, description: res.error })
          return
        }
        if (failed.length) toast.warning(`Photo search: ${failed.length} image${failed.length === 1 ? '' : 's'} couldn’t be read`, { id, description: 'Check the image URL, then save again or rebuild the index.' })
        else if (missing.length) toast.success('Photo search updated', { id, description: `${res.data.saved} image${res.data.saved === 1 ? '' : 's'} added${res.data.removed ? `, ${res.data.removed} removed` : ''}.`, duration: 2500 })
      })
      const settled = next.catch((e: unknown) => {
        toast.error('Photo search not updated', { id: `image-index-${p.id}`, description: (e as Error)?.message ?? 'The image model could not load.' })
      })
      running.current.set(p.id, settled)
    },
    [live],
  )
}

export function RebuildImageIndexButton({ products, disabled, disabledReason }: { products: AdminProduct[]; disabled?: boolean; disabledReason?: string }) {
  const [job, setJob] = useState<{ done: number; total: number; phase: 'model' | 'images' } | null>(null)
  const [mb, setMb] = useState<string | null>(null)

  const rebuild = async () => {
    if (disabled) {
      if (disabledReason) toast(disabledReason, { id: 'image-index-locked' })
      return
    }
    const list = products.filter((p) => srcsOf(p).length)
    const total = list.reduce((n, p) => n + srcsOf(p).length, 0)
    if (!total) return void toast('No product images to index yet.')
    setJob({ done: 0, total, phase: 'model' })
    let done = 0
    let saved = 0
    let failed = 0
    try {
      const [E] = await engine()
      await E.bootModel((pr) => setMb(pr.total ? `${(pr.loaded / 1048576).toFixed(1)} / ${(pr.total / 1048576).toFixed(1)} MB` : null))
      setJob({ done: 0, total, phase: 'images' })
      for (const p of list) {
        const { items, failed: f } = await embedAll(srcsOf(p), () => setJob({ done: ++done, total, phase: 'images' }))
        failed += f.length
        const res = await replaceImageEmbeddings({ productId: p.id, items })
        if (!res.ok) throw new Error(res.error)
        saved += res.data.saved
      }
      const pruned = await pruneOldImageModels()
      E.resetImageIndex()
      toast.success('Photo search index rebuilt', {
        description: `${saved} images from ${list.length} products${failed ? ` · ${failed} couldn’t be read` : ''}${pruned.ok && pruned.data.removed ? ` · ${pruned.data.removed} old rows removed` : ''}. Live on the shop now.`,
      })
    } catch (e) {
      toast.error('Rebuild stopped', { description: `${(e as Error)?.message ?? 'Unknown error'} (${done}/${total} images done — run it again to finish).` })
    } finally {
      setJob(null)
      setMb(null)
    }
  }

  const pct = job ? Math.round((job.done / Math.max(1, job.total)) * 100) : 0
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={rebuild}
        aria-disabled={disabled || undefined}
        disabled={!!job}
        title={disabled ? disabledReason : 'Re-reads every product image for “search with a photo”'}
        className={adminBtn({ variant: 'ghost', size: 'sm', className: cn('min-h-11 gap-2', disabled && 'opacity-50') })}
      >
        <ScanSearch aria-hidden className="size-4" />
        {job ? (job.phase === 'model' ? 'Loading model…' : `Indexing ${job.done}/${job.total}`) : 'Rebuild image search index'}
      </button>
      {job && (
        <span className="flex min-w-[120px] flex-1 items-center gap-2" role="progressbar" aria-label="Rebuilding the photo-search index" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.phase === 'model' ? 0 : pct}>
          <span aria-hidden className="relative h-2.5 w-28 border-2 border-paper/40 bg-ink">
            <span className={cn('absolute inset-y-0 left-0 bg-volt transition-[width] duration-200', job.phase === 'model' && 'skeleton-tone w-full opacity-50')} style={job.phase === 'images' ? { width: `${pct}%` } : undefined} />
          </span>
          <span className="font-mono text-[11px] text-paper/60">{job.phase === 'model' ? mb ?? 'starting…' : `${pct}%`}</span>
        </span>
      )}
    </div>
  )
}
