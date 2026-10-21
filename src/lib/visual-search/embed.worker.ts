/// <reference lib="webworker" />
// Visual search — image embedding Web Worker (owner: SEARCH). The UI thread never runs the model.
// transformers.js is imported lazily on the first 'init' (so the worker chunk boots instantly), the MobileCLIP S0
// image tower is fetched from the Hugging Face CDN on first use and kept in the browser's Cache Storage by the
// library (env.useBrowserCache). WebGPU when the adapter supports fp16 shaders, otherwise WASM (onnxruntime-web).
// Same model + dtype as the Node scripts (scripts/lib/visual-search-node.mts) so browser vectors match the index.
//
// Protocol (postMessage):
//   in  { type: 'init', device?: 'wasm' }                  → progress… then { type: 'ready', device, dtype, ms }
//   in  { type: 'embed', id, blob? | url? }                → { type: 'vec', id, vec: Float32Array(512), ms }
//   out { type: 'progress', loaded, total }                  bytes across all model files
//   out { type: 'error', id?, stage: 'load' | 'embed', message }
import { MODEL_DTYPE, MODEL_ID } from './thresholds'
import { preShrinkSize } from './vec'

type Transformers = typeof import('@huggingface/transformers')
type Loaded = {
  T: Transformers
  processor: Awaited<ReturnType<Transformers['AutoProcessor']['from_pretrained']>>
  model: Awaited<ReturnType<Transformers['CLIPVisionModelWithProjection']['from_pretrained']>>
  device: 'webgpu' | 'wasm'
}

export type WorkerIn = { type: 'init'; device?: 'wasm' } | { type: 'embed'; id: number; blob?: Blob; url?: string }
export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; device: string; dtype: string; ms: number }
  | { type: 'vec'; id: number; vec: Float32Array; ms: number }
  | { type: 'error'; id?: number; stage: 'load' | 'embed'; message: string }

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

async function decode(T: Transformers, src: Blob): Promise<InstanceType<Transformers['RawImage']>> {
  const full = await createImageBitmap(src)
  let small: ImageBitmap | null = null
  try {
    // Pre-shrink with a proper (area-averaging) filter so the processor's own resize is ~identity. Without this the
    // processor's canvas resize aliases the screentone / halftone art (measured: the same mockup scored 0.92 against
    // its Node-built vector; with the matching pre-shrink in both pipelines it is ≈ 0.99).
    const { w, h } = preShrinkSize(full.width, full.height)
    small = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
    const canvas = new OffscreenCanvas(w, h)
    const g = canvas.getContext('2d', { willReadFrequently: true })
    if (!g) throw new Error('no-2d-context')
    g.drawImage(small, 0, 0)
    const { data } = g.getImageData(0, 0, w, h)
    return new T.RawImage(data, w, h, 4).rgb()
  } finally {
    full.close()
    small?.close()
  }
}

async function embed(id: number, blob?: Blob, url?: string) {
  const t0 = performance.now()
  let loaded: Loaded
  try {
    loaded = await load()
  } catch (err) {
    throw Object.assign(new Error(String((err as Error)?.message ?? err)), { stage: 'load' as const })
  }
  const { T, processor, model } = loaded
  let src = blob
  if (!src && url) {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error(`image ${res.status}`)
    src = await res.blob()
  }
  if (!src) throw new Error('no-image')
  const image = await decode(T, src)
  const inputs = await processor(image)
  const out = (await model(inputs)) as { image_embeds: { type: string; data: ArrayLike<number>; to?: (t: string) => { data: ArrayLike<number> } } }
  const t = out.image_embeds
  const data = t.type === 'float32' || !t.to ? t.data : t.to('float32').data
  const vec = Float32Array.from(data as ArrayLike<number>)
  let s = 0
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i]
  const n = Math.sqrt(s) || 1
  for (let i = 0; i < vec.length; i++) vec[i] /= n
  post({ type: 'vec', id, vec, ms: Math.round(performance.now() - t0) }, [vec.buffer])
}

ctx.addEventListener('message', (e: MessageEvent<WorkerIn>) => {
  const m = e.data
  if (m?.type === 'init') {
    load(m.device).catch((err: unknown) => post({ type: 'error', stage: 'load', message: String((err as Error)?.message ?? err) }))
  } else if (m?.type === 'embed') {
    embed(m.id, m.blob, m.url).catch((err: unknown) => {
      const message = String((err as Error)?.message ?? err)
      post({ type: 'error', id: m.id, stage: (err as { stage?: 'load' }).stage ?? 'embed', message })
    })
  }
})
