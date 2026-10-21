// Visual search — main-thread engine (owner: SEARCH). Import ONLY from lazily loaded client code (the photo-search
// modal, the admin index tools): creating the worker is what starts the model download.
//   bootModel(onProgress?)          start / join the model load (progress in bytes) → { device, dtype, ms }
//   embedBlob(blob)                 → L2-normalised Float32Array(512) of the whole photo, computed in the worker
//   embedUrlViews(url, n)           → the first n INDEX_VIEWS vectors (what the index stores; admin indexing)
//   loadImageIndex()                GET /api/image-index once per page session, decoded
//   searchPhoto(file)               → MatchResult (exact / similar / none) with the calibrated thresholds; loads the
//                                     index FIRST, so an empty / unavailable index never downloads the model
//   searchFrame(bitmap)             the same for one live-camera frame (an ImageBitmap, transferred to the worker)
//   modelReady()                    whether the model has finished loading (live scanning only starts then)
//   disposeModel()                  terminate the worker (frees the model session); the next call boots it again
//                                   from Cache Storage (~1 s)
import type { WorkerIn, WorkerOut } from './embed.worker'
import { classify, decodeIndex, rankProducts, type DecodedProduct, type ImageIndex, type MatchResult } from './vec'
import { EMBED_DIM, MODEL_KEY } from './thresholds'

export interface ModelInfo { device: string; dtype: string; ms: number }
export interface LoadProgress { loaded: number; total: number }

/** load = the model; embed = reading this photo (incl. a worker crash mid-photo); size = too many pixels;
 *  timeout = the model hung on a photo; index = the shop's picture index */
export type VisualSearchStage = 'load' | 'embed' | 'size' | 'timeout' | 'index'

/** an embed that takes longer than this (after the model is ready) is treated as hung: reject + restart the worker */
const EMBED_TIMEOUT_MS = 30_000

let worker: Worker | null = null
let ready: Promise<ModelInfo> | null = null
let isReady = false
let lastProgress: LoadProgress | null = null
let seq = 0
const listeners = new Set<(p: LoadProgress) => void>()
const pending = new Map<number, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>()
let readyResolve: ((v: ModelInfo) => void) | null = null
let readyReject: ((e: Error) => void) | null = null

export class VisualSearchError extends Error {
  constructor(public stage: VisualSearchStage, message: string) {
    super(message)
  }
}

function teardown() {
  worker?.terminate()
  worker = null
  ready = null
  isReady = false
  lastProgress = null
}

function failPending(err: VisualSearchError) {
  pending.forEach((p) => p.reject(err))
  pending.clear()
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
      isReady = true
      readyResolve?.({ device: m.device, dtype: m.dtype, ms: m.ms })
    } else if (m.type === 'vec') {
      pending.get(m.id)?.resolve(m.vecs)
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
    // A crash while the model was already running is about THIS photo (e.g. out of memory decoding it), not the model.
    const err = new VisualSearchError(isReady ? 'embed' : 'load', e.message || 'worker-crashed')
    readyReject?.(err)
    failPending(err)
    teardown()
  })
  worker = w
  return w
}

const send = (m: WorkerIn, transfer: Transferable[] = []) => getWorker().postMessage(m, transfer)

/** The model is loaded and answering (live scanning waits for this instead of queueing frames behind the download). */
export const modelReady = () => isReady

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

/** Free the model (worker + onnxruntime session). No-op while a photo is being read. Returns whether it disposed. */
export function disposeModel(): boolean {
  if (!worker || pending.size) return false
  readyReject?.(new VisualSearchError('load', 'disposed'))
  teardown()
  return true
}

async function embed(msg: { blob?: Blob; url?: string; bitmap?: ImageBitmap; views?: number }): Promise<Float32Array[]> {
  try {
    await bootModel()
  } catch (err) {
    msg.bitmap?.close()
    throw err
  }
  const id = ++seq
  return new Promise<Float32Array[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return
      // a hung WebGPU / WASM inference: fail this (and any queued) photo, then start the worker over
      failPending(new VisualSearchError('timeout', 'embed-timeout'))
      teardown()
    }, EMBED_TIMEOUT_MS)
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      },
    })
    send({ type: 'embed', id, ...msg }, msg.bitmap ? [msg.bitmap] : [])
  })
}

export const embedBlob = async (blob: Blob) => (await embed({ blob }))[0]
/** one live-camera frame; the bitmap is transferred (unusable here afterwards) */
export const embedBitmap = async (bitmap: ImageBitmap) => (await embed({ bitmap }))[0]
export const embedUrlViews = (url: string, views: number) => embed({ url: new URL(url, window.location.href).href, views })

// ---------------------------------------------------------------- index
let indexP: Promise<DecodedProduct[]> | null = null

export function loadImageIndex(): Promise<DecodedProduct[]> {
  if (!indexP) {
    indexP = (async () => {
      let res: Response
      try {
        res = await fetch('/api/image-index', { headers: { accept: 'application/json' } })
      } catch {
        throw new VisualSearchError('index', 'index-offline')
      }
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
  const index = await loadImageIndex() // first: no index → no model download
  const vec = await embedBlob(file)
  const result = classify(rankProducts(vec, index))
  return { ...result, ms: Math.round(performance.now() - t0) }
}

/** One live-camera frame (the square the viewfinder shows, ~256 px). The bitmap is transferred to the worker. */
export async function searchFrame(bitmap: ImageBitmap): Promise<PhotoSearch> {
  const t0 = performance.now()
  let index: DecodedProduct[]
  try {
    index = await loadImageIndex()
  } catch (err) {
    bitmap.close()
    throw err
  }
  const vec = await embedBitmap(bitmap)
  const result = classify(rankProducts(vec, index))
  return { ...result, ms: Math.round(performance.now() - t0) }
}
