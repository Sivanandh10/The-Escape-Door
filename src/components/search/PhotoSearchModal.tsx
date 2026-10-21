'use client'
// Photo search modal (owner: SEARCH) — "search with a picture", like the big shops. Lazy chunk (PhotoSearchButton).
// Pick a photo (upload, drag & drop, paste, the phone camera, or the LIVE camera: LiveCamera.tsx scans continuously
// and locks on its own) → the MobileCLIP image model runs in a Web Worker
// in THIS browser → cosine match against the catalogue index (GET /api/image-index) → EXACT product, SIMILAR
// products, or a clear "No matching product" (→ Request this design / Try another photo). The photo never leaves
// the device unless the shopper chooses "Request this design" (it is then attached to their custom request).
// Signature moment: the manga "scan" — focus lines + a volt scan bar sweeping the photo. Reduced motion: static.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Camera, ClipboardPaste, ImageUp, Lock, RotateCcw, ScanLine, Search, X } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { track } from '@/lib/analytics'
import { useRequireLogin } from '@/lib/auth/customer'
import { useIsTouch, useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { LiveCamera } from './LiveCamera'
import { bootModel, disposeModel, loadImageIndex, offProgress, searchPhoto, VisualSearchError, type LoadProgress, type PhotoSearch } from '@/lib/visual-search/client'
import { stashPhotoForCustom } from '@/lib/visual-search/handoff'
import { MATCH, MAX_IMAGE_BYTES, MODEL_MB } from '@/lib/visual-search/thresholds'
import { matchStrength, type DecodedProduct, type Ranked } from '@/lib/visual-search/vec'

export interface PhotoSearchModalProps {
  open: boolean
  from: 'header' | 'shop'
  onClose: () => void
}

type ErrorKind = 'type' | 'size' | 'decode' | 'model' | 'index'
type Phase =
  | { name: 'pick' }
  | { name: 'live' }
  | { name: 'scan'; file: File; url: string }
  | { name: 'result'; file: File; url: string; result: PhotoSearch }
  | { name: 'error'; kind: ErrorKind; file?: File; url?: string }

type ModelState = 'idle' | 'loading' | 'ready' | 'failed'
type IndexState = 'loading' | 'ready' | 'failed'

const TYPE_LABEL: Record<string, string> = {
  tshirt: 'Tees', hoodie: 'Hoodies', polaroid: 'Polaroids', bookmark: 'Bookmarks', poster: 'Posters', badge: 'Badges',
  sticker: 'Stickers', keychain: 'Keychains', cosplay: 'Cosplay', katana: 'Katanas', figurine: 'Figurines', cape: 'Capes',
  accessory: 'Accessories', hat: 'Hats', tote: 'Totes', stationery: 'Stationery',
}
/** product types Design Your Own can preselect (src/components/forge/model.ts parseProductParam) */
const FORGE_KINDS = new Set(['tshirt', 'hoodie', 'polaroid', 'bookmark', 'sticker', 'badge'])
const SUGGESTIONS = [
  { href: '/shop/oversized-t-shirts', label: 'Oversized tees' },
  { href: '/shop/hoodies', label: 'Hoodies' },
  { href: '/shop/posters', label: 'Posters' },
  { href: '/shop/polaroids', label: 'Polaroids' },
  { href: '/shop/badges', label: 'Badges' },
  { href: '/shop/cosplay-props', label: 'Cosplay props' },
]
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'
const MIN_SCAN_MS = 650
/** free the model (worker + onnxruntime session) this long after the modal closes; reopening reloads it from cache */
const DISPOSE_AFTER_MS = 60_000

const mb = (n: number) => (n / 1048576).toFixed(1)

export function PhotoSearchModal({ open, from, onClose }: PhotoSearchModalProps) {
  const reduced = useReducedMotion()
  const touch = useIsTouch()
  const router = useRouter()
  const requireLogin = useRequireLogin()
  const titleId = useId()
  const descId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const lastFocus = useRef<Element | null>(null)
  const runId = useRef(0)
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<Phase>({ name: 'pick' })
  const [model, setModel] = useState<ModelState>('idle')
  const [index, setIndex] = useState<IndexState>('loading')
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [device, setDevice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [live, setLive] = useState('')
  /** LiveCamera's stop: called synchronously on close (AnimatePresence keeps the exiting tree mounted ~0.2 s) */
  const liveStop = useRef<(() => void) | null>(null)
  // every close path goes through here: the camera goes off at once, and a reopen starts at the picker
  const close = useCallback(() => {
    liveStop.current?.()
    setPhase((p) => (p.name === 'live' ? { name: 'pick' } : p))
    onClose()
  }, [onClose])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client mount flag for the portal
    setMounted(true)
  }, [])
  const canPaste = mounted && !!navigator.clipboard && typeof navigator.clipboard.read === 'function'
  // shown when the browser can stream a camera, and on plain-http pages (LiveCamera explains why it can't there)
  const canLive = mounted && (!!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)

  // ---- on open: fetch the index FIRST, and only when it has products wake the model (first open downloads it).
  // An empty / unavailable index goes straight to the text-search fallback without spending ~23 MB of data.
  // (state only changes in the promise callbacks; model 'idle' renders as loading while the index is fine)
  const wake = useCallback(() => {
    loadImageIndex()
      .then(() => {
        setIndex('ready')
        return bootModel(setProgress).then(
          (info) => {
            setDevice(info.device)
            setModel('ready')
          },
          (err: unknown) => {
            if (!(err instanceof VisualSearchError && err.message === 'disposed')) setModel('failed')
          },
        )
      })
      .catch(() => {
        setIndex('failed')
        setPhase((p) => (p.name === 'pick' || p.name === 'live' ? { name: 'error', kind: 'index' } : p))
      })
  }, [])
  useEffect(() => {
    if (!open) return
    wake()
    return () => offProgress(setProgress)
  }, [open, wake])

  // ---- free the model a while after closing, and when the page is hidden for good (low-RAM phones)
  useEffect(() => {
    const dispose = () => {
      if (disposeModel()) {
        setModel('idle')
        setProgress(null)
      }
    }
    window.addEventListener('pagehide', dispose)
    const t = open ? 0 : window.setTimeout(dispose, DISPOSE_AFTER_MS)
    return () => {
      window.removeEventListener('pagehide', dispose)
      if (t) window.clearTimeout(t)
    }
  }, [open])

  // ---- dialog plumbing: scroll lock (Lenis), focus in / back, close on navigation
  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
    lenis?.stop()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 60)
    const onNav = () => close()
    window.addEventListener('ted:navigate', onNav)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('ted:navigate', onNav)
      document.body.style.overflow = prev
      lenis?.start()
      if (lastFocus.current instanceof HTMLElement && document.contains(lastFocus.current)) lastFocus.current.focus({ preventScroll: true })
    }
  }, [open, close])

  // ---- object URLs: revoke the old preview whenever the phase drops it
  const urlRef = useRef<string | null>(null)
  useEffect(() => {
    const url = 'url' in phase ? phase.url ?? null : null
    if (urlRef.current && urlRef.current !== url) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
  }, [phase])
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const reset = useCallback(() => {
    runId.current++
    setPhase({ name: 'pick' })
    setLive('Pick another photo.')
    if (index === 'failed') {
      setIndex('loading')
      wake() // the index may be back; if not, wake() shows the fallback again
    }
  }, [index, wake])

  // keep keyboard focus inside the dialog as views swap (the button that was focused unmounts)
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      if (phase.name === 'live') return // LiveCamera focuses its own button (pre-prompt / shutter)
      const target = phase.name === 'scan' ? panel.current : panel.current?.querySelector<HTMLElement>('[data-autofocus]')
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [open, phase.name])

  // ---- the search itself
  const run = useCallback(
    async (file: File) => {
      const id = ++runId.current
      if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i.test(file.name)) {
        setPhase({ name: 'error', kind: 'type' })
        track('image_search_result', { kind: 'error', reason: 'type', from })
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setPhase({ name: 'error', kind: 'size' })
        track('image_search_result', { kind: 'error', reason: 'size', from })
        return
      }
      const url = URL.createObjectURL(file)
      setPhase({ name: 'scan', file, url })
      setLive('Scanning your photo…')
      if (model === 'failed' || index === 'failed') {
        if (model === 'failed') setModel('loading')
        if (index === 'failed') setIndex('loading')
        wake()
      }
      const t0 = performance.now()
      try {
        const result = await searchPhoto(file)
        const wait = reduced ? 0 : Math.max(0, MIN_SCAN_MS - (performance.now() - t0))
        if (wait) await new Promise((r) => setTimeout(r, wait))
        if (id !== runId.current) return
        setPhase({ name: 'result', file, url, result })
        setLive(
          result.kind === 'exact'
            ? `Exact match: ${result.exact!.product.name}.${result.similar.length ? ` ${result.similar.length} similar products.` : ''}`
            : result.kind === 'similar'
              ? `${result.similar.length} similar products.`
              : 'No matching product.',
        )
        track('image_search_result', { kind: result.kind, top: Math.round(result.top * 100) / 100, n: result.similar.length + (result.exact ? 1 : 0), ms: result.ms, from })
      } catch (err) {
        if (id !== runId.current) return
        const stage = err instanceof VisualSearchError ? err.stage : 'embed'
        // load / timeout → the matcher (Try again re-runs this photo) · size → too many pixels · embed → this photo
        const kind: ErrorKind = stage === 'load' || stage === 'timeout' ? 'model' : stage === 'index' ? 'index' : stage === 'size' ? 'size' : 'decode'
        if (kind === 'model') setModel('failed')
        if (kind === 'index') setIndex('failed')
        setPhase({ name: 'error', kind, file, url })
        setLive('Photo search hit a problem.')
        track('image_search_result', { kind: 'error', reason: kind, from })
      }
    },
    [from, model, index, reduced, wake],
  )

  // ---- live camera: an auto-locked frame already has its result (no second search); the shutter runs the normal one
  const liveLocked = useCallback(
    (file: File, result: PhotoSearch) => {
      runId.current++
      const url = URL.createObjectURL(file)
      setPhase({ name: 'result', file, url, result })
      setLive(result.exact ? `Found it: ${result.exact.product.name}.${result.similar.length ? ` ${result.similar.length} similar products.` : ''}` : 'Results ready.')
      track('image_search_result', { kind: result.kind, top: Math.round(result.top * 100) / 100, n: result.similar.length + (result.exact ? 1 : 0), ms: result.ms, from, via: 'live' })
    },
    [from],
  )
  const liveFail = useCallback((kind: 'model' | 'index') => {
    if (kind === 'model') setModel('failed')
    else setIndex('failed')
    setPhase({ name: 'error', kind })
    setLive('Photo search hit a problem.')
  }, [])
  const startLive = () => {
    runId.current++
    setPhase({ name: 'live' })
    setLive('Live camera. Point it at the design.')
    if (model === 'failed' || index === 'failed') {
      if (model === 'failed') setModel('loading')
      if (index === 'failed') setIndex('loading')
      wake()
    }
  }
  // the model was freed while the viewfinder stayed up (pagehide → back/forward-cache restore): load it again,
  // or the live scan would wait for it forever
  useEffect(() => {
    if (open && phase.name === 'live' && model === 'idle' && index === 'ready') wake()
  }, [open, phase.name, model, index, wake])

  const pickFiles = (list: FileList | null | undefined) => {
    const f = list?.[0]
    if (f) void run(f)
  }

  // ---- paste anywhere while open (Ctrl/⌘+V)
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const item = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      const f = item?.getAsFile()
      if (!f) return
      e.preventDefault()
      liveStop.current?.() // pasting while the live camera is open: camera off, search the pasted picture
      void run(new File([f], f.name || 'pasted-image.png', { type: f.type }))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open, run])

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (!type) continue
        const blob = await it.getType(type)
        void run(new File([blob], `pasted.${type.split('/')[1] || 'png'}`, { type }))
        return
      }
      setLive('No picture on the clipboard. Copy an image first.')
      setPhase({ name: 'error', kind: 'type' })
    } catch {
      setLive('Clipboard blocked. Press Ctrl+V or ⌘V instead.')
    }
  }

  // ---- drag & drop on the whole panel
  const onDragOver = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!dragging) setDragging(true)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFiles(e.dataTransfer.files)
  }

  // ---- keyboard: Esc closes, Tab stays inside (document capture: works even if focus slipped out, and the
  // header's own Escape handler doesn't also close the search panel underneath)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && el.offsetParent !== null)
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement
      if (!panel.current.contains(active) || active === panel.current) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, close])

  // ---- leaving the modal: product pages + Design Your Own keep the shop's login rule
  const goProduct = (e: ReactMouseEvent<HTMLAnchorElement>, slug: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    const href = `/product/${slug}`
    close()
    requireLogin('Log in to see this product', () => router.push(href))
  }
  const requestDesign = () => {
    const file = 'file' in phase ? phase.file : undefined
    if (file) stashPhotoForCustom(file)
    const top = phase.name === 'result' ? (phase.result.exact ?? phase.result.similar[0])?.product.type : undefined
    const href = top && FORGE_KINDS.has(top) ? `/custom?product=${top}` : '/custom'
    track('custom_start', { from: 'photo_search' })
    close()
    requireLogin('Log in to design your own', () => router.push(href))
  }

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-6"
          // React events bubble through the portal to the React parent: the header search panel renders this modal
          // inside its <form onSubmit>, which would also run (and drop the typed term). Keep them in here.
          onSubmit={stopEvent}
          onKeyDown={stopEvent}
          onKeyUp={stopEvent}
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            onClick={close}
          >
            <div className="screentone screentone-dense absolute inset-0 text-volt [--tone-opacity:0.12]" />
          </motion.div>

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            data-lenis-prevent=""
            onDragOver={onDragOver}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDragging(false)
            }}
            onDrop={onDrop}
            className="ted-ps relative flex max-h-[94dvh] outline-none w-full max-w-[880px] flex-col overflow-hidden border-4 border-ink bg-paper text-ink shadow-[8px_8px_0_var(--color-volt)] sm:max-h-[90dvh]"
            initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0, rotate: -1.2 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, rotate: 0 }}
            exit={reduced ? { opacity: 0 } : { y: 28, opacity: 0, transition: { duration: 0.16 } }}
            transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 32 }}
          >
            {/* header strip */}
            <div className="flex items-center gap-3 border-b-4 border-ink bg-volt px-4 py-3 sm:px-5">
              <Camera aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.6} />
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-display text-[28px] uppercase leading-[0.9] sm:text-[34px]">
                  Search with a photo
                </h2>
                <p className="jp-sub text-[11px] opacity-70" lang="ja" aria-hidden="true">写真で探す</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close photo search"
                className="press focus-ring grid size-11 shrink-0 place-items-center border-[3px] border-ink bg-paper shadow-hard-sm"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <p id={descId} className="sr-only">
                Upload, drop, paste or take a photo of a tee, hoodie, poster or badge, or point the live camera at it. It is matched on your device and never uploaded.
              </p>
              <p className="sr-only" role="status" aria-live="polite">{live}</p>

              {phase.name === 'pick' && (
                <PickView
                  dragging={dragging}
                  touch={touch}
                  canPaste={canPaste}
                  canLive={canLive}
                  onLive={startLive}
                  onUpload={() => fileInput.current?.click()}
                  onCamera={() => cameraInput.current?.click()}
                  onPaste={pasteFromClipboard}
                />
              )}
              {phase.name === 'live' && (
                <LiveCamera
                  from={from}
                  reduced={reduced}
                  touch={touch}
                  model={model}
                  progress={progress?.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null}
                  stopRef={liveStop}
                  onLocked={liveLocked}
                  onShutter={(file) => void run(file)}
                  onFail={liveFail}
                  onBack={reset}
                  onUpload={() => fileInput.current?.click()}
                  onTakePhoto={() => cameraInput.current?.click()}
                />
              )}
              {phase.name === 'scan' && <ScanView url={phase.url} reduced={reduced} />}
              {phase.name === 'result' && (
                <ResultView
                  url={phase.url}
                  result={phase.result}
                  reduced={reduced}
                  onAgain={reset}
                  onOpen={goProduct}
                  onRequest={requestDesign}
                />
              )}
              {phase.name === 'error' && (
                <ErrorView kind={phase.kind} onAgain={reset} onRetryModel={() => (phase.file ? void run(phase.file) : reset())} onClose={close} />
              )}
            </div>

            {/* footer: privacy + model status */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t-[3px] border-ink bg-ink px-4 py-2.5 text-paper sm:px-6">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <Lock aria-hidden="true" className="size-4 shrink-0 text-volt" strokeWidth={2.6} />
                Your photo stays on your {touch ? 'phone' : 'device'}. We match it right here, nothing is uploaded.
              </p>
              <ModelStatus state={index === 'failed' ? 'off' : model === 'idle' ? 'loading' : model} progress={progress} device={device} />
            </div>

            {dragging && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-volt/90">
                <span className="font-display text-[44px] uppercase leading-none">Drop it!</span>
              </div>
            )}

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pickFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pickFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <style>{PS_CSS}</style>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const stopEvent = (e: { stopPropagation: () => void }) => e.stopPropagation()

// ---------------------------------------------------------------- pick
function PickView({ dragging, touch, canPaste, canLive, onLive, onUpload, onCamera, onPaste }: { dragging: boolean; touch: boolean; canPaste: boolean; canLive: boolean; onLive: () => void; onUpload: () => void; onCamera: () => void; onPaste: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1.25fr_1fr] md:items-stretch">
      <button
        type="button"
        data-autofocus=""
        onClick={touch ? onCamera : onUpload}
        className={cn(
          'ted-ps-drop press focus-ring group relative flex min-h-[220px] flex-col items-center justify-center gap-3 overflow-hidden border-[3px] border-dashed border-ink bg-lav px-5 py-8 text-center',
          dragging && 'bg-volt',
        )}
      >
        <span aria-hidden="true" className="screentone screentone-mid pointer-events-none absolute inset-0 text-ink [--tone-opacity:0.14]" />
        <span aria-hidden="true" className="ted-ps-bracket pointer-events-none absolute inset-4" />
        <span className="relative grid size-16 place-items-center border-[3px] border-ink bg-paper shadow-hard-sm transition-transform duration-200 group-hover:-rotate-6">
          {touch ? <Camera aria-hidden="true" className="size-8" strokeWidth={2.4} /> : <ImageUp aria-hidden="true" className="size-8" strokeWidth={2.4} />}
        </span>
        <span className="relative font-display text-[30px] uppercase leading-[0.9] sm:text-[36px]">{touch ? 'Snap a photo' : 'Drop a photo here'}</span>
        <span className="relative max-w-[30ch] text-[14px] leading-snug">
          A tee, hoodie, poster, badge, a screenshot from Instagram… we find that design or the closest ones.
        </span>
      </button>

      <div className="flex flex-col gap-2.5">
        {canLive && (
          <PickButton onClick={onLive} icon={<ScanLine aria-hidden="true" className="size-5" />} label="Live camera" hint="Point it at the design · finds it by itself" tone="volt" />
        )}
        {touch && (
          <PickButton onClick={onCamera} icon={<Camera aria-hidden="true" className="size-5" />} label="Take a photo" hint="Opens your camera" tone="ink" />
        )}
        <PickButton onClick={onUpload} icon={<ImageUp aria-hidden="true" className="size-5" />} label={touch ? 'Choose from gallery' : 'Upload from device'} hint="JPG, PNG or WebP · up to 10 MB" tone={touch ? 'paper' : 'ink'} />
        {canPaste && (
          <PickButton onClick={onPaste} icon={<ClipboardPaste aria-hidden="true" className="size-5" />} label="Paste image" hint={touch ? 'From your clipboard' : 'Or press Ctrl+V / ⌘V anywhere here'} tone="paper" />
        )}
        <div className="mt-auto border-[3px] border-ink bg-paper p-3 text-[13px] leading-snug shadow-hard-sm">
          <p className="label mb-1 text-[10px] opacity-70">Best results</p>
          Get the <strong>whole print</strong> in the shot, straight on and in good light. For tees and hoodies, the <strong>back print</strong> finds the exact design.
        </div>
      </div>
    </div>
  )
}

function PickButton({ onClick, icon, label, hint, tone }: { onClick: () => void; icon: ReactNode; label: string; hint: string; tone: 'ink' | 'paper' | 'volt' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press focus-ring flex min-h-14 items-center gap-3 border-[3px] border-ink px-4 py-2.5 text-left shadow-hard-sm',
        tone === 'ink' ? 'bg-ink text-paper can-hover:hover:bg-door' : tone === 'volt' ? 'bg-volt text-ink can-hover:hover:bg-volt-hot' : 'bg-paper text-ink can-hover:hover:bg-volt',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold leading-tight">{label}</span>
        <span className={cn('block text-[12px] leading-tight', tone === 'ink' ? 'text-paper/70' : 'text-ink/65')}>{hint}</span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- scan (signature moment)
function ScanView({ url, reduced }: { url: string; reduced: boolean }) {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-4 py-2" aria-busy="true">
      <div className={cn('ted-ps-scan relative aspect-[4/5] w-full max-w-[340px] overflow-hidden border-4 border-ink bg-ink shadow-hard', reduced && 'is-still')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never uploaded */}
        <img src={url} alt="Your photo" className="absolute inset-0 size-full object-contain" />
        <span aria-hidden="true" className="ted-ps-lines absolute inset-[-25%]" />
        <span aria-hidden="true" className="ted-ps-bar absolute inset-x-0 top-0 h-[22%]" />
        <span aria-hidden="true" className="ted-ps-bracket absolute inset-3" />
        <span className="label absolute bottom-3 left-3 border-2 border-ink bg-volt px-2 py-1 text-[11px] font-bold text-ink shadow-hard-sm">
          Scanning<span className="ted-ps-dots" aria-hidden="true" /> <span lang="ja" aria-hidden="true">スキャン中</span>
        </span>
      </div>
      <p className="text-center text-[14px] text-ink/75">Reading the print, colours and shapes…</p>
    </div>
  )
}

// ---------------------------------------------------------------- results
function ResultView({
  url, result, reduced, onAgain, onOpen, onRequest,
}: {
  url: string
  result: PhotoSearch
  reduced: boolean
  onAgain: () => void
  onOpen: (e: ReactMouseEvent<HTMLAnchorElement>, slug: string) => void
  onRequest: () => void
}) {
  const [type, setType] = useState('')
  const types = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of result.similar) m.set(r.product.type, (m.get(r.product.type) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [result.similar])
  const shown = type ? result.similar.filter((r) => r.product.type === type) : result.similar
  const apparelOnly = !result.exact && result.similar.slice(0, 3).some((r) => r.product.type === 'tshirt' || r.product.type === 'hoodie')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview */}
        <img src={url} alt="Your photo" className="size-16 shrink-0 border-[3px] border-ink bg-ink object-cover shadow-hard-sm" />
        <div className="min-w-0 flex-1">
          <p className="label text-[10px] opacity-60">Your photo</p>
          <p className="font-bold leading-tight">
            {result.kind === 'exact' ? 'Found it in the shop' : result.kind === 'similar' ? `${result.similar.length} close ${result.similar.length === 1 ? 'design' : 'designs'}` : 'No matching product'}
          </p>
        </div>
        {result.kind !== 'none' && (
          <button type="button" data-autofocus="" onClick={onAgain} aria-label="Try another photo" className="press focus-ring label inline-flex min-h-11 shrink-0 items-center gap-2 border-[3px] border-ink bg-paper px-3 text-[11px] font-bold shadow-hard-sm can-hover:hover:bg-volt">
            <RotateCcw aria-hidden="true" className="size-4" /> <span className="sm:hidden">New photo</span><span className="max-sm:hidden">Try another photo</span>
          </button>
        )}
      </div>

      {result.kind === 'none' && <NoneView onAgain={onAgain} onRequest={onRequest} />}

      {result.exact && <ExactCard r={result.exact} reduced={reduced} onOpen={onOpen} />}

      {result.similar.length > 0 && (
        <section aria-labelledby="ps-similar" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 id="ps-similar" className="font-display text-[26px] uppercase leading-none">
              {result.exact ? <>More <em>like this</em></> : <>Similar <em>designs</em></>}
            </h3>
            {types.length > 1 && (
              <div role="group" aria-label="Filter by type" className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
                <TypeChip on={!type} onClick={() => setType('')} label="All" count={result.similar.length} />
                {types.map(([t, n]) => (
                  <TypeChip key={t} on={type === t} onClick={() => setType(type === t ? '' : t)} label={TYPE_LABEL[t] ?? t} count={n} />
                ))}
              </div>
            )}
          </div>
          {apparelOnly && (
            <p className="border-l-4 border-door bg-lav/60 px-3 py-2 text-[13px] leading-snug">
              Our tees look alike from the front. <strong>Snap the back print</strong> to pin down the exact design.
            </p>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {shown.map((r, i) => (
              <SimilarCard key={r.product.slug} r={r} i={i} reduced={reduced} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}

      {result.kind !== 'none' && (
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-ink/30 pt-4">
          <p className="text-[14px]">Not quite it?</p>
          <button type="button" onClick={onRequest} className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-ink px-4 text-[11px] font-bold text-paper shadow-hard-sm can-hover:hover:bg-door">
            Request this design <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function TypeChip({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'press focus-ring label inline-flex min-h-10 shrink-0 items-center gap-1.5 border-2 border-ink px-2.5 text-[10.5px] font-bold',
        on ? 'bg-ink text-volt' : 'bg-paper text-ink shadow-hard-sm can-hover:hover:bg-lav',
      )}
    >
      {label} <span className="font-mono text-[10px] opacity-60">{count}</span>
    </button>
  )
}

function Strength({ score, tone, exact }: { score: number; tone: 'ink' | 'paper'; exact?: boolean }) {
  const w = matchStrength(score, MATCH, exact)
  const pct = Math.round(w * 100)
  return (
    <span className="flex items-center gap-2" aria-label={`Match strength ${pct} percent`}>
      <span aria-hidden="true" className={cn('relative h-2.5 flex-1 border-2', tone === 'ink' ? 'border-ink bg-paper' : 'border-paper bg-ink')}>
        <span className={cn('absolute inset-y-0 left-0', tone === 'ink' ? 'bg-ink' : 'bg-volt')} style={{ width: `${Math.max(6, pct)}%` }} />
      </span>
      <span aria-hidden="true" className="w-9 text-right font-mono text-[11px] font-bold tabular-nums">{pct}%</span>
    </span>
  )
}

function Thumb({ p, sizes, priority }: { p: DecodedProduct; sizes: string; priority?: boolean }) {
  if (!p.image) return <span className="absolute inset-0 bg-lav" />
  return <Image src={p.image} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
}

function ExactCard({ r, reduced, onOpen }: { r: Ranked<DecodedProduct>; reduced: boolean; onOpen: (e: ReactMouseEvent<HTMLAnchorElement>, slug: string) => void }) {
  const p = r.product
  return (
    <motion.a
      href={`/product/${p.slug}`}
      onClick={(e) => onOpen(e, p.slug)}
      data-score={r.score.toFixed(4)}
      className="ted-ps-exact press focus-ring group relative grid grid-cols-[minmax(0,40%)_1fr] overflow-hidden border-4 border-ink bg-volt text-ink shadow-hard sm:grid-cols-[220px_1fr]"
      initial={reduced ? { opacity: 0 } : { scale: 1.06, rotate: -1.5, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
      transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 520, damping: 22 }}
    >
      <span className="relative block aspect-[4/5] border-r-4 border-ink bg-ink">
        <Thumb p={p} sizes="(min-width: 640px) 220px, 40vw" priority />
      </span>
      <span className="flex min-w-0 flex-col gap-2 p-3 sm:p-5">
        <span className="label inline-flex w-fit items-center gap-2 border-2 border-ink bg-ink px-2 py-1 text-[10px] font-bold text-volt">
          Exact match <span lang="ja" aria-hidden="true">ドン!</span>
        </span>
        <span className="font-display text-[28px] uppercase leading-[0.9] sm:text-[40px]">{p.name}</span>
        <span className="text-[13px] font-semibold opacity-75">{p.arc} · {TYPE_LABEL[p.type] ?? p.type}</span>
        <span className="font-mono text-[18px] font-bold">{p.price}</span>
        <span className="mt-auto flex flex-col gap-1">
          <span className="label text-[10px]">Same design</span>
          <Strength score={r.score} tone="ink" exact />
        </span>
        <span className="label inline-flex items-center gap-1 text-[11px] font-bold underline decoration-2 underline-offset-4">
          View product <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </motion.a>
  )
}

function SimilarCard({ r, i, reduced, onOpen }: { r: Ranked<DecodedProduct>; i: number; reduced: boolean; onOpen: (e: ReactMouseEvent<HTMLAnchorElement>, slug: string) => void }) {
  const p = r.product
  const close = r.score >= MATCH.exact
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { delay: Math.min(i, 8) * 0.04, type: 'spring', stiffness: 420, damping: 30 }}
    >
      <a
        href={`/product/${p.slug}`}
        onClick={(e) => onOpen(e, p.slug)}
        data-score={r.score.toFixed(4)}
        className="press focus-ring group flex h-full flex-col border-[3px] border-ink bg-paper shadow-hard-sm can-hover:hover:-translate-x-0.5 can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-hard"
      >
        <span className="relative block aspect-[4/5] overflow-hidden border-b-[3px] border-ink bg-ink">
          <Thumb p={p} sizes="(min-width: 768px) 190px, (min-width: 640px) 30vw, 45vw" />
          <span className={cn('label absolute left-1.5 top-1.5 border-2 border-ink px-1.5 py-0.5 text-[9.5px] font-bold', close ? 'bg-volt' : 'bg-paper')}>
            {close ? 'Very close' : 'Similar style'}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-1 p-2.5">
          <span className="line-clamp-2 text-[14px] font-bold leading-tight">{p.name}</span>
          <span className="text-[11.5px] opacity-65">{p.arc}</span>
          <span className="font-mono text-[13px] font-bold">{p.price}</span>
          <span className="mt-auto pt-1"><Strength score={r.score} tone="ink" /></span>
        </span>
      </a>
    </motion.li>
  )
}

// ---------------------------------------------------------------- empty + error
function NoneView({ onAgain, onRequest }: { onAgain: () => void; onRequest: () => void }) {
  return (
    <div className="grid items-center gap-5 border-4 border-ink bg-lav p-5 shadow-hard sm:grid-cols-[140px_1fr] sm:p-6">
      <Mascot mood="shock" size={130} className="mx-auto" title="" />
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-[34px] uppercase leading-[0.9]">No matching <em>product</em></h3>
        <p className="text-[15px] leading-snug">Nothing in the shop looks close enough to your photo. We can make it: send it as a custom request and we will quote it on WhatsApp.</p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" data-autofocus="" onClick={onRequest} className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 text-[11.5px] font-bold shadow-hard-sm can-hover:hover:bg-volt-hot">
            Request this design <ArrowRight aria-hidden="true" className="size-4" />
          </button>
          <button type="button" onClick={onAgain} className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-paper px-4 text-[11.5px] font-bold shadow-hard-sm">
            <RotateCcw aria-hidden="true" className="size-4" /> Try another photo
          </button>
        </div>
        <p className="text-[12px] text-ink/70">Request this design attaches your photo to the request form. Nothing is sent until you press Send there.</p>
      </div>
    </div>
  )
}

const ERRORS: Record<ErrorKind, { title: string; body: string }> = {
  type: { title: 'That isn’t a picture', body: 'Use a photo or screenshot: JPG, PNG or WebP (HEIC works in Safari only).' },
  size: { title: 'That photo is too big', body: 'Photos up to 10 MB and 100 megapixels work. Pick a smaller one, or take a screenshot of it and use that.' },
  decode: { title: 'We couldn’t read that photo', body: 'Try a JPG or PNG. On iPhone: Settings › Camera › Formats › Most Compatible.' },
  model: { title: 'The door-spirit didn’t wake up', body: 'The photo matcher couldn’t load (slow or blocked connection). Try again, or search by name.' },
  index: { title: 'Photo search is getting ready', body: 'The shop’s picture index isn’t available right now. Search by name in the meantime.' },
}

function ErrorView({ kind, onAgain, onRetryModel, onClose }: { kind: ErrorKind; onAgain: () => void; onRetryModel: () => void; onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const e = ERRORS[kind]
  const fallback = kind === 'model' || kind === 'index'
  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    ev.stopPropagation() // never reach the header's own search form (the modal is its React child)
    const term = q.trim()
    onClose()
    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }
  return (
    <div className="flex flex-col gap-4" role="alert">
      <div className="relative overflow-hidden border-4 border-ink bg-paper p-5 shadow-hard">
        <span aria-hidden="true" className="ted-ps-splat absolute -right-6 -top-6 size-28 bg-hype" />
        <h3 className="relative max-w-[22ch] font-display text-[32px] uppercase leading-[0.9]">{e.title}</h3>
        <p className="relative mt-2 max-w-[52ch] text-[15px] leading-snug">{e.body}</p>
        <div className="relative mt-4 flex flex-wrap gap-2.5">
          {kind === 'model' && (
            <button type="button" data-autofocus="" onClick={onRetryModel} className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 text-[11.5px] font-bold shadow-hard-sm">
              <RotateCcw aria-hidden="true" className="size-4" /> Try again
            </button>
          )}
          <button type="button" data-autofocus={kind === 'model' ? undefined : ''} onClick={onAgain} className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-paper px-4 text-[11.5px] font-bold shadow-hard-sm can-hover:hover:bg-volt">
            <ImageUp aria-hidden="true" className="size-4" /> Pick another photo
          </button>
        </div>
      </div>
      {fallback && (
        <div className="border-[3px] border-ink bg-lav p-4">
          <form role="search" onSubmit={submit} className="flex items-stretch gap-2">
            <label htmlFor="ps-text-q" className="sr-only">Search by name</label>
            <input
              id="ps-text-q"
              type="search"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder="Search by name: Gojo, flame, wall…"
              className="min-h-12 min-w-0 flex-1 border-[3px] border-ink bg-paper px-3 text-base outline-none focus-visible:outline-3 focus-visible:outline-door"
            />
            <button type="submit" className="press focus-ring grid min-h-12 min-w-12 place-items-center border-[3px] border-ink bg-ink text-paper" aria-label="Search">
              <Search aria-hidden="true" className="size-5" />
            </button>
          </form>
          <p className="label mt-3 text-[10px] opacity-70">Or jump to</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <a key={s.href} href={s.href} onClick={(ev) => { if (ev.metaKey || ev.ctrlKey || ev.button !== 0) return; ev.preventDefault(); onClose(); router.push(s.href) }} className="press focus-ring label inline-flex min-h-10 items-center border-2 border-ink bg-paper px-3 text-[10.5px] font-bold shadow-hard-sm can-hover:hover:bg-volt">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- model status
function ModelStatus({ state, progress, device }: { state: ModelState | 'off'; progress: LoadProgress | null; device: string | null }) {
  if (state === 'off') return null
  if (state === 'ready') {
    return <p className="ml-auto font-mono text-[11px] text-paper/70">Door-spirit awake · {device === 'webgpu' ? 'GPU' : 'CPU'}</p>
  }
  if (state === 'failed') return <p className="ml-auto font-mono text-[11px] text-hype">Matcher offline</p>
  if (state !== 'loading') return null
  const total = progress?.total || MODEL_MB * 1048576
  const loaded = Math.min(progress?.loaded ?? 0, total)
  const pct = Math.round((loaded / total) * 100)
  return (
    <div className="ml-auto flex w-full min-w-[220px] items-center gap-2 sm:w-auto" role="progressbar" aria-label="Loading the photo matcher" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="font-mono text-[11px] text-paper/85">
        Waking the door-spirit… {mb(loaded)} / {mb(total)} MB
      </span>
      <span aria-hidden="true" className="relative h-2.5 min-w-[80px] flex-1 border-2 border-paper bg-ink">
        <span className="absolute inset-y-0 left-0 bg-volt transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}

const PS_CSS = `@layer components{
.ted-ps-bracket{--b:var(--color-ink);background:
  linear-gradient(var(--b),var(--b)) top left/22px 4px no-repeat,linear-gradient(var(--b),var(--b)) top left/4px 22px no-repeat,
  linear-gradient(var(--b),var(--b)) top right/22px 4px no-repeat,linear-gradient(var(--b),var(--b)) top right/4px 22px no-repeat,
  linear-gradient(var(--b),var(--b)) bottom left/22px 4px no-repeat,linear-gradient(var(--b),var(--b)) bottom left/4px 22px no-repeat,
  linear-gradient(var(--b),var(--b)) bottom right/22px 4px no-repeat,linear-gradient(var(--b),var(--b)) bottom right/4px 22px no-repeat}
.ted-ps-scan .ted-ps-bracket{--b:var(--color-volt)}
.ted-ps-lines{background:repeating-conic-gradient(from 0deg at 50% 50%,rgb(11 11 15/.62) 0deg 1.4deg,transparent 1.4deg 7deg);
  -webkit-mask:radial-gradient(circle at 50% 50%,transparent 26%,#000 58%);mask:radial-gradient(circle at 50% 50%,transparent 26%,#000 58%);
  animation:ted-ps-lines 900ms steps(3) infinite}
@keyframes ted-ps-lines{0%{transform:rotate(0deg) scale(1)}33%{transform:rotate(2.5deg) scale(1.03)}66%{transform:rotate(-2deg) scale(.99)}100%{transform:rotate(0deg) scale(1)}}
.ted-ps-bar{border-bottom:4px solid var(--color-ink);
  background:linear-gradient(to bottom,transparent,rgb(255 225 77/.0) 10%,rgb(255 225 77/.55)),
    radial-gradient(circle at center,var(--color-volt) 32%,transparent 36%) 0 0/6px 6px;
  -webkit-mask:linear-gradient(to bottom,transparent,#000);mask:linear-gradient(to bottom,transparent,#000);
  box-shadow:0 4px 0 var(--color-volt);animation:ted-ps-bar 1150ms cubic-bezier(.65,0,.35,1) infinite alternate}
@keyframes ted-ps-bar{from{transform:translateY(-100%)}to{transform:translateY(455%)}}
.ted-ps-dots::after{content:"…";display:inline-block;width:1.2em;text-align:left;animation:ted-ps-dots 900ms steps(4) infinite;overflow:hidden;vertical-align:bottom}
@keyframes ted-ps-dots{from{width:0}to{width:1.2em}}
.ted-ps-splat{clip-path:polygon(50% 0,61% 32%,98% 18%,72% 48%,100% 72%,64% 68%,58% 100%,44% 70%,8% 92%,30% 58%,0 38%,36% 34%);opacity:.9}
.ted-ps-scan.is-still .ted-ps-lines,.ted-ps-scan.is-still .ted-ps-bar,.ted-ps-scan.is-still .ted-ps-dots::after{animation:none}
.ted-ps-scan.is-still .ted-ps-bar{transform:translateY(180%)}
@media (prefers-reduced-motion:reduce){.ted-ps-lines,.ted-ps-bar,.ted-ps-dots::after{animation:none}.ted-ps-bar{transform:translateY(180%)}}
}`

export default PhotoSearchModal
