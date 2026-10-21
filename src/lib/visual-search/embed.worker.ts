/// <reference lib="webworker" />
// Visual search — image embedding Web Worker (owner: SEARCH). The UI thread never runs the model.
// transformers.js is imported lazily on the first 'init' (so the worker chunk boots instantly), the MobileCLIP S0
// image tower is fetched from the Hugging Face CDN on first use and kept in the browser's Cache Storage by the
// library (env.useBrowserCache). WebGPU when the adapter supports fp16 shaders, otherwise WASM (onnxruntime-web).
// Same model + dtype as the Node scripts (scripts/lib/visual-search-node.mts) so browser vectors match the index.
//
// Protocol (postMessage):
//   in  { type: 'init', device?: 'wasm' }                  → progress… then { type: 'ready', device, dtype, ms }
//   in  { type: 'embed', id, blob? | url? | bitmap?, views? } → { type: 'vec', id, vecs: Float32Array(512)[], ms }
//        views: how many INDEX_VIEWS (default 1 = the whole image, a shopper's photo; admin indexing: vec.viewsFor)
//        bitmap: a live-camera frame (transferred ImageBitmap, already the square crop at ~256 px; the worker owns
//        and closes it)
//   out { type: 'progress', loaded, total }                  bytes across all model files
//   out { type: 'error', id?, stage: 'load' | 'embed' | 'size', message }
import { BIG_PIXELS, MAX_PIXELS, MODEL_DTYPE, MODEL_ID } from './thresholds'
import { DIMS_HEAD_BYTES, imageDims } from './dims'
import { INDEX_VIEWS, preShrinkSize, viewRect } from './vec'

type Transformers = typeof import('@huggingface/transformers')
type Loaded = {
  T: Transformers
  processor: Awaited<ReturnType<Transformers['AutoProcessor']['from_pretrained']>>
  model: Awaited<ReturnType<Transformers['CLIPVisionModelWithProjection']['from_pretrained']>>
  device: 'webgpu' | 'wasm'
}

export type WorkerIn = { type: 'init'; device?: 'wasm' } | { type: 'embed'; id: number; blob?: Blob; url?: string; bitmap?: ImageBitmap; views?: number }
export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; device: string; dtype: string; ms: number }
  | { type: 'vec'; id: number; vecs: Float32Array[]; ms: number }
  | { type: 'error'; id?: number; stage: 'load' | 'embed' | 'size'; message: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (m: WorkerOut, transfer: Transferable[] = []) => ctx.postMessage(m, transfer)

let loading: Promise<Loaded> | null = null

async function pickDevice(): Promise<'webgpu' | 'wasm'> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu
    if (!gpu) return 'wasm'
    const adapter = await gpu.requestAdapter()
    return adapter && adapter.features.has('shader-f16') ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

function load(force?: 'wasm'): Promise<Loaded> {
  if (loading) return loading
  loading = (async () => {
    const t0 = performance.now()
    const T = await import('@huggingface/transformers')
    T.env.allowLocalModels = false
    T.env.useBrowserCache = true

    const files = new Map<string, { loaded: number; total: number }>()
    let last = 0
    const progress_callback = (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (!p?.file || (p.status !== 'progress' && p.status !== 'done')) return
      const prev = files.get(p.file) ?? { loaded: 0, total: 0 }
      const total = Number(p.total) || prev.total
      const loaded = p.status === 'done' ? total || prev.loaded : Number(p.loaded) || prev.loaded
      files.set(p.file, { loaded, total })
      const now = performance.now()
      if (p.status === 'progress' && now - last < 80) return
      last = now
      let L = 0
      let N = 0
      for (const f of files.values()) {
        L += f.loaded
        N += f.total
      }
      post({ type: 'progress', loaded: L, total: N })
    }

    const processor = await T.AutoProcessor.from_pretrained(MODEL_ID, { progress_callback })
    let device = force ?? (await pickDevice())
    let model: Loaded['model']
    try {
      model = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { device, dtype: MODEL_DTYPE, progress_callback })
    } catch (e) {
      if (device === 'wasm') throw e
      device = 'wasm' // WebGPU refused the graph → CPU (same weights, already cached)
      model = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { device, dtype: MODEL_DTYPE, progress_callback })
    }
    post({ type: 'ready', device, dtype: MODEL_DTYPE, ms: Math.round(performance.now() - t0) })
    return { T, processor, model, device }
  })()
  loading.catch(() => {
    loading = null // let "Try again" start over
  })
  return loading
}

/** A photo too big to decode safely (MAX_PIXELS) — reported as stage 'size' (the shopper sees the size message). */
class TooBig extends Error {}

/**
 * Decode once at (EXIF-oriented) full size — or, for a big camera photo, straight to ~1024 px — then cut each
 * requested view (vec.viewRect, the same rounding as the Node scripts), pre-shrink it with a proper filter and
 * draw it on WHITE (transparent PNGs: Node flattens onto white too).
 */
async function decode(T: Transformers, src: Blob | ImageBitmap, views: ReadonlyArray<(typeof INDEX_VIEWS)[number]>): Promise<InstanceType<Transformers['RawImage']>[]> {
  let full: ImageBitmap
  if (src instanceof ImageBitmap) {
    full = src // a live-camera frame: already decoded and small (closed below like any other)
  } else {
    const dims = imageDims(new Uint8Array(await src.slice(0, DIMS_HEAD_BYTES).arrayBuffer()))
    const px = dims ? dims.w * dims.h : 0
    if (dims && px > MAX_PIXELS) throw new TooBig(`${dims.w}x${dims.h} px`)
    // Big photo: let the decoder scale down (JPEG decodes at 1/2, 1/4, 1/8 natively). Only the width can be given
    // without knowing the EXIF rotation; 1024 keeps the short side >= 256 for any aspect up to 4:1.
    full =
      dims && px > BIG_PIXELS && Math.min(dims.w, dims.h) > 1024
        ? await createImageBitmap(src, { resizeWidth: 1024, resizeQuality: 'high' })
        : await createImageBitmap(src)
  }
  const out: InstanceType<Transformers['RawImage']>[] = []
  try {
    for (const view of views) {
      const r = viewRect(full.width, full.height, view)
      // Pre-shrink with a proper (area-averaging) filter so the processor's own resize is ~identity. Without this the
      // processor's canvas resize aliases the screentone / halftone art (measured: the same mockup scored 0.92 against
      // its Node-built vector; with the matching pre-shrink in both pipelines it is ~0.99).
      const { w, h } = preShrinkSize(r.width, r.height)
      const small = await createImageBitmap(full, r.left, r.top, r.width, r.height, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
      try {
        const canvas = new OffscreenCanvas(w, h)
        const g = canvas.getContext('2d', { willReadFrequently: true })
        if (!g) throw new Error('no-2d-context')
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, w, h)
        g.drawImage(small, 0, 0)
        const { data } = g.getImageData(0, 0, w, h)
        out.push(new T.RawImage(data, w, h, 4).rgb())
      } finally {
        small.close()
      }
    }
  } finally {
    full.close()
  }
  return out
}

async function embed(id: number, blob?: Blob, url?: string, views = 1, bitmap?: ImageBitmap) {
  const t0 = performance.now()
  let loaded: Loaded
  try {
    loaded = await load()
  } catch (err) {
    bitmap?.close()
    throw Object.assign(new Error(String((err as Error)?.message ?? err)), { stage: 'load' as const })
  }
  const { T, processor, model } = loaded
  let src: Blob | ImageBitmap | undefined = bitmap ?? blob
  if (!src && url) {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error(`image ${res.status}`)
    src = await res.blob()
  }
  if (!src) throw new Error('no-image')
  let images: InstanceType<Transformers['RawImage']>[]
  try {
    images = await decode(T, src, INDEX_VIEWS.slice(0, Math.max(1, Math.min(INDEX_VIEWS.length, views))))
  } catch (err) {
    if (err instanceof TooBig) throw Object.assign(err, { stage: 'size' as const })
    throw err
  }
  const vecs: Float32Array[] = []
  for (const image of images) {
    const inputs = await processor(image)
    const out = (await model(inputs)) as { image_embeds: { type: string; data: ArrayLike<number>; to?: (t: string) => { data: ArrayLike<number> } } }
    const t = out.image_embeds
    const data = t.type === 'float32' || !t.to ? t.data : t.to('float32').data
    const vec = Float32Array.from(data as ArrayLike<number>)
    let s = 0
    for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i]
    const n = Math.sqrt(s) || 1
    for (let i = 0; i < vec.length; i++) vec[i] /= n
    vecs.push(vec)
  }
  post({ type: 'vec', id, vecs, ms: Math.round(performance.now() - t0) }, vecs.map((v) => v.buffer))
}

ctx.addEventListener('message', (e: MessageEvent<WorkerIn>) => {
  const m = e.data
  if (m?.type === 'init') {
    load(m.device).catch((err: unknown) => post({ type: 'error', stage: 'load', message: String((err as Error)?.message ?? err) }))
  } else if (m?.type === 'embed') {
    embed(m.id, m.blob, m.url, m.views, m.bitmap).catch((err: unknown) => {
      const message = String((err as Error)?.message ?? err)
      post({ type: 'error', id: m.id, stage: (err as { stage?: 'load' | 'size' }).stage ?? 'embed', message })
    })
  }
})
