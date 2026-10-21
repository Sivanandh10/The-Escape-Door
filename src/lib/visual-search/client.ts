// Visual search — main-thread engine (owner: SEARCH). Import ONLY from lazily loaded client code (the photo-search
// modal, the admin index tools): creating the worker is what starts the model download.
//   bootModel(onProgress?)          start / join the model load (progress in bytes) → { device, dtype, ms }
//   embedBlob(blob) / embedUrl(url) → L2-normalised Float32Array(512), computed in the worker
//   loadImageIndex()                GET /api/image-index once per page session, decoded
//   searchPhoto(file)               → MatchResult (exact / similar / none) with the calibrated thresholds
import type { WorkerIn, WorkerOut } from './embed.worker'
import { classify, decodeIndex, rankProducts, type DecodedProduct, type ImageIndex, type MatchResult } from './vec'
import { EMBED_DIM, MODEL_KEY } from './thresholds'

export interface ModelInfo { device: string; dtype: string; ms: number }
export interface LoadProgress { loaded: number; total: number }

let worker: Worker | null = null
let ready: Promise<ModelInfo> | null = null
let lastProgress: LoadProgress | null = null
let seq = 0
const listeners = new Set<(p: LoadProgress) => void>()
const pending = new Map<number, { resolve: (v: Float32Array) => void; reject: (e: Error) => void }>()
let readyResolve: ((v: ModelInfo) => void) | null = null
let readyReject: ((e: Error) => void) | null = null

export class VisualSearchError extends Error {
  constructor(public stage: 'load' | 'embed' | 'index', message: string) {
    super(message)
  }
}

function getWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module', name: 'ted-visual-search' })
  w.addEventListener('message', (e: MessageEvent<WorkerOut>) => {
    const m = e.data
    if (m.type === 'progress') {
      lastProgress = { loaded: m.loaded, total: m.total }
      listeners.forEach((fn) => fn(lastProgress!))
    } else if (m.type === 'ready') {
      readyResolve?.({ device: m.device, dtype: m.dtype, ms: m.ms })
    } else if (m.type === 'vec') {
      pending.get(m.id)?.resolve(m.vec)
      pending.delete(m.id)
    } else if (m.type === 'error') {
      const err = new VisualSearchError(m.stage, m.message)
      if (m.id != null) {
        pending.get(m.id)?.reject(err)
        pending.delete(m.id)
      }
      if (m.stage === 'load') {
        readyReject?.(err)
        ready = null // allow a retry
      }
    }
  })
  w.addEventListener('error', (e) => {
    const err = new VisualSearchError('load', e.message || 'worker-failed')
    readyReject?.(err)
    pending.forEach((p) => p.reject(err))
    pending.clear()
    worker?.terminate()
    worker = null
    ready = null
  })
  worker = w
  return w
}

const send = (m: WorkerIn) => getWorker().postMessage(m)

/** Start (or join) the model load. Safe to call many times. */
export function bootModel(onProgress?: (p: LoadProgress) => void): Promise<ModelInfo> {
  if (onProgress) {
    listeners.add(onProgress)
    if (lastProgress) onProgress(lastProgress)
  }
  if (!ready) {
    ready = new Promise<ModelInfo>((resolve, reject) => {
      readyResolve = resolve
      readyReject = reject
    })
    ready.catch(() => {})
    // QA override: localStorage 'ted-vs-device' = 'wasm' forces the CPU backend
    let device: 'wasm' | undefined
    try {
      device = window.localStorage.getItem('ted-vs-device') === 'wasm' ? 'wasm' : undefined
    } catch {
      device = undefined
    }
    send({ type: 'init', device })
  }
  return ready
}

export function offProgress(fn: (p: LoadProgress) => void) {
  listeners.delete(fn)
}

function embed(msg: { blob?: Blob; url?: string }): Promise<Float32Array> {
  const id = ++seq
  return new Promise<Float32Array>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    void bootModel()
    send({ type: 'embed', id, ...msg })
  })
}

export const embedBlob = (blob: Blob) => embed({ blob })
export const embedUrl = (url: string) => embed({ url: new URL(url, window.location.href).href })

// ---------------------------------------------------------------- index
let indexP: Promise<DecodedProduct[]> | null = null

export function loadImageIndex(): Promise<DecodedProduct[]> {
  if (!indexP) {
    indexP = (async () => {
      const res = await fetch('/api/image-index', { headers: { accept: 'application/json' } })
      if (!res.ok) throw new VisualSearchError('index', `index ${res.status}`)
      const index = (await res.json()) as ImageIndex
      if (index.model !== MODEL_KEY || index.dim !== EMBED_DIM) throw new VisualSearchError('index', 'index-model-mismatch')
      const decoded = decodeIndex(index)
      if (!decoded.length) throw new VisualSearchError('index', 'index-empty')
      return decoded
    })()
    indexP.catch(() => {
      indexP = null
    })
  }
  return indexP
}

/** Forget the cached index (admin after a rebuild). */
export function resetImageIndex() {
  indexP = null
}

export interface PhotoSearch extends MatchResult<DecodedProduct> {
  ms: number
}

export async function searchPhoto(file: Blob): Promise<PhotoSearch> {
  const t0 = performance.now()
  const [index, vec] = await Promise.all([loadImageIndex(), embedBlob(file)])
  const result = classify(rankProducts(vec, index))
  return { ...result, ms: Math.round(performance.now() - t0) }
}
