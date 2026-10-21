'use client'
// Live camera for photo search (owner: SEARCH). Part of the PhotoSearchModal chunk (never ships with the page).
// getUserMedia viewfinder (rear camera on phones, webcam on laptops) that scans continuously: every ~700 ms — and only
// once the previous frame has come back, frames are never queued — the centre square (exactly what the square
// viewfinder shows) is cut to 256 px, sent to the embedding worker as a transferred ImageBitmap and scored against the
// index. EXACT on 2 frames in a row for the same product = auto-lock: freeze the frame, buzz, stop the camera, hand
// the result to the modal. The shutter grabs the full frame and runs the normal one-shot search instead.
// Privacy: frames stay in memory on the device; nothing is recorded or uploaded. The camera is stopped on close
// (stopRef, called synchronously by the modal because AnimatePresence keeps the exiting tree mounted), on unmount,
// when the tab is hidden, on pagehide and when a result locks.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import Image from 'next/image'
import { ArrowLeft, Camera, CameraOff, Flashlight, FlashlightOff, ImageUp, Lock, RotateCcw, SwitchCamera } from 'lucide-react'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { searchFrame, VisualSearchError, type PhotoSearch } from '@/lib/visual-search/client'
import { MATCH } from '@/lib/visual-search/thresholds'
import { matchStrength, type DecodedProduct, type Ranked } from '@/lib/visual-search/vec'

/** a new frame at most this often (the previous one must also have finished) */
const SCAN_EVERY_MS = 700
/** consecutive EXACT frames (same product) before auto-lock */
const LOCK_FRAMES = 2
/** frame side sent to the model (= the CLIP input; vec.ts preShrinkSize keeps it as is) */
const FRAME_PX = 256
/** a plain tee / hoodie front stays "similar" (all fronts look alike): after this many frames, ask for the back */
const FRONT_HINT_FRAMES = 4

type CamError = 'insecure' | 'unsupported' | 'denied' | 'nocamera' | 'busy'
type Status = 'checking' | 'prompt' | 'starting' | 'live' | 'paused' | 'locked' | 'shot' | 'error'
type Stage = 'looking' | 'closer' | 'found'
type Facing = 'environment' | 'user'
export type LiveModelState = 'idle' | 'loading' | 'ready' | 'failed'

export interface LiveCameraProps {
  from: 'header' | 'shop'
  reduced: boolean
  touch: boolean
  model: LiveModelState
  /** model download 0..100 while loading */
  progress: number | null
  /** the modal calls this synchronously when it closes */
  stopRef: MutableRefObject<(() => void) | null>
  onLocked: (file: File, result: PhotoSearch) => void
  onShutter: (file: File) => void
  onFail: (kind: 'model' | 'index') => void
  onBack: () => void
  onUpload: () => void
  onTakePhoto: () => void
}

interface Scan {
  stage: Stage
  top: Ranked<DecodedProduct> | null
  /** consecutive exact frames for top */
  streak: number
  /** consecutive similar frames with a tee / hoodie on top */
  frontish: number
}
const IDLE_SCAN: Scan = { stage: 'looking', top: null, streak: 0, frontish: 0 }

const isIOS = () =>
  typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

function camErrorOf(err: unknown): CamError {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'nocamera'
  if (name === 'TypeError' || name === 'NotSupportedError') return 'unsupported'
  return 'busy' // NotReadableError / TrackStartError / AbortError: another app holds the camera, or it failed to start
}

async function openStream(opt: { facing?: Facing; deviceId?: string }): Promise<MediaStream> {
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } }
  const video: MediaTrackConstraints = opt.deviceId ? { deviceId: { exact: opt.deviceId }, ...size } : { facingMode: { ideal: opt.facing ?? 'environment' }, ...size }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false })
  } catch (err) {
    // an old webcam that can't do the size / a stale deviceId: take any camera rather than none
    if ((err as { name?: string })?.name !== 'OverconstrainedError') throw err
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  }
}

/** the centre square of the frame (what the square viewfinder shows) at FRAME_PX, high-quality downscale */
async function grabSquare(v: HTMLVideoElement): Promise<ImageBitmap> {
  const w = v.videoWidth
  const h = v.videoHeight
  const s = Math.min(w, h)
  const sx = Math.round((w - s) / 2)
  const sy = Math.round((h - s) / 2)
  try {
    return await createImageBitmap(v, sx, sy, s, s, { resizeWidth: FRAME_PX, resizeHeight: FRAME_PX, resizeQuality: 'high' })
  } catch {
    // Safari < 17 / no resize options: canvas route
    const c = document.createElement('canvas')
    c.width = FRAME_PX
    c.height = FRAME_PX
    const g = c.getContext('2d')
    if (!g) throw new Error('no-2d-context')
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(v, sx, sy, s, s, 0, 0, FRAME_PX, FRAME_PX)
    return createImageBitmap(c)
  }
}

/** draw the whole current frame into `c` (unmirrored: what the camera really sees) */
function drawFrame(v: HTMLVideoElement, c: HTMLCanvasElement): boolean {
  if (!v.videoWidth || !v.videoHeight) return false
  c.width = v.videoWidth
  c.height = v.videoHeight
  const g = c.getContext('2d')
  if (!g) return false
  g.drawImage(v, 0, 0)
  return true
}

const canvasFile = (c: HTMLCanvasElement, name: string) =>
  new Promise<File | null>((resolve) => {
    try {
      c.toBlob((b) => resolve(b ? new File([b], name, { type: 'image/jpeg' }) : null), 'image/jpeg', 0.92)
    } catch {
      resolve(null)
    }
  })

export function LiveCamera({ from, reduced, touch, model, progress, stopRef, onLocked, onShutter, onFail, onBack, onUpload, onTakePhoto }: LiveCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const freezeRef = useRef<HTMLCanvasElement>(null)
  const shutterRef = useRef<HTMLButtonElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  /** bumped on every stop / start: results of an older stream are dropped */
  const genRef = useRef(0)
  const statusRef = useRef<Status>('checking')
  const scanRef = useRef<Scan>(IDLE_SCAN)
  const doneRef = useRef(false) // locked, shot or closed: no more frames, no restarts
  const closedRef = useRef(false) // the modal closed / we unmounted: never call back into the modal
  const devicesRef = useRef<MediaDeviceInfo[]>([])
  const optRef = useRef<{ facing?: Facing; deviceId?: string }>({ facing: 'environment' })
  const statsRef = useRef({ frames: 0, t0: 0, tracked: false })
  // latest props for the stable callbacks below (the camera must not restart because a prop changed)
  const cb = useRef({ onLocked, onShutter, onFail, from })
  const [status, setStatusState] = useState<Status>('checking')
  const [error, setError] = useState<CamError | null>(null)
  const [scan, setScan] = useState<Scan>(IDLE_SCAN)
  const [mirror, setMirror] = useState(false)
  const [canSwitch, setCanSwitch] = useState(false)
  const [torchOk, setTorchOk] = useState(false)
  const [torch, setTorch] = useState(false)
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    cb.current = { onLocked, onShutter, onFail, from }
  })

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s
    setStatusState(s)
  }, [])

  const report = useCallback(
    (result: string) => {
      const st = statsRef.current
      if (st.tracked) return
      st.tracked = true
      track('image_search_live', { result, frames: st.frames, ms: st.t0 ? Math.round(performance.now() - st.t0) : 0, from: cb.current.from })
    },
    [],
  )

  const stopStream = useCallback(() => {
    genRef.current++
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
  }, [])

  const fail = useCallback(
    (kind: CamError) => {
      stopStream()
      setError(kind)
      setStatus('error')
      report(kind)
    },
    [report, setStatus, stopStream],
  )

  const start = useCallback(
    async (opt: { facing?: Facing; deviceId?: string } = optRef.current) => {
      if (doneRef.current) return
      if (!window.isSecureContext) return fail('insecure')
      if (!navigator.mediaDevices?.getUserMedia) return fail('unsupported')
      stopStream()
      const gen = genRef.current
      optRef.current = opt
      setStatus('starting')
      setError(null)
      let stream: MediaStream
      try {
        stream = await openStream(opt)
      } catch (err) {
        if (gen === genRef.current && !doneRef.current) fail(camErrorOf(err))
        return
      }
      if (gen !== genRef.current || doneRef.current) {
        stream.getTracks().forEach((t) => t.stop()) // closed / switched while the prompt was up
        return
      }
      streamRef.current = stream
      const v = videoRef.current
      const tr = stream.getVideoTracks()[0]
      if (!v || !tr) {
        stream.getTracks().forEach((t) => t.stop())
        return fail('nocamera')
      }
      v.muted = true
      v.playsInline = true
      v.srcObject = stream
      await v.play().catch(() => {})
      if (gen !== genRef.current) return
      const settings = tr.getSettings()
      // a front (selfie) camera: mirror the live PREVIEW only, like every camera app. Frames sent to the model and the
      // frozen frame are never mirrored, so the print reads the right way round. (Webcams that don't report a facing
      // mode stay unmirrored: a shopper holding up a tee wants to read its print.)
      setMirror(settings.facingMode === 'user')
      const caps = (typeof tr.getCapabilities === 'function' ? tr.getCapabilities() : {}) as MediaTrackCapabilities & { torch?: boolean }
      setTorchOk(!!caps.torch)
      setTorch(false)
      tr.addEventListener('ended', () => {
        if (gen === genRef.current && !doneRef.current) fail('busy') // unplugged, or another app took it
      })
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          devicesRef.current = list.filter((d) => d.kind === 'videoinput')
          setCanSwitch(devicesRef.current.length > 1)
        })
        .catch(() => {})
      scanRef.current = IDLE_SCAN
      setScan(IDLE_SCAN)
      if (!statsRef.current.t0) statsRef.current.t0 = performance.now()
      setStatus('live')
    },
    [fail, setStatus, stopStream],
  )

  // ---- first look: permission already granted → straight in; denied → the fix-it card; else the pre-prompt
  useEffect(() => {
    let alive = true
    const check = async () => {
      let state: PermissionState | 'unknown' = 'unknown'
      try {
        state = (await navigator.permissions.query({ name: 'camera' as PermissionName })).state
      } catch {
        state = 'unknown' // Firefox / older Safari can't query 'camera'
      }
      if (!alive) return
      if (!window.isSecureContext) fail('insecure')
      else if (!navigator.mediaDevices?.getUserMedia) fail('unsupported')
      else if (state === 'granted') void start()
      else if (state === 'denied') fail('denied')
      else setStatus('prompt')
    }
    void check()
    return () => {
      alive = false
    }
  }, [fail, setStatus, start])

  // ---- stop everything: modal close (stopRef), unmount, pagehide; tab hidden pauses (restarts when visible)
  useEffect(() => {
    const stopAll = () => {
      if (!doneRef.current && (statusRef.current === 'live' || statusRef.current === 'starting' || statusRef.current === 'paused')) report('closed')
      doneRef.current = true
      closedRef.current = true
      stopStream()
    }
    doneRef.current = false // (re)mounted: React dev StrictMode runs this cleanup + setup once on mount
    closedRef.current = false
    stopRef.current = stopAll
    const onVis = () => {
      if (doneRef.current) return
      if (document.hidden) {
        if (streamRef.current || statusRef.current === 'starting') {
          stopStream()
          setStatus('paused')
        }
      } else if (statusRef.current === 'paused') {
        void start()
      }
    }
    // leaving the page: camera off at once. Not a permanent stop: a back/forward-cache restore shows "Camera paused"
    // (and visibilitychange turns it back on) instead of a dead black viewfinder.
    const onPageHide = () => {
      if (doneRef.current) return
      stopStream()
      if (statusRef.current === 'live' || statusRef.current === 'starting') setStatus('paused')
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onPageHide)
      if (stopRef.current === stopAll) stopRef.current = null
      stopAll()
    }
  }, [report, setStatus, start, stopRef, stopStream])

  // ---- freeze the current frame into the overlay canvas, stop the camera
  const freeze = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current
    const c = freezeRef.current
    if (!v || !c) return null
    v.pause()
    const ok = drawFrame(v, c)
    stopStream()
    return ok ? c : null
  }, [stopStream])

  const lock = useCallback(
    async (result: PhotoSearch) => {
      doneRef.current = true
      const c = freeze()
      setStatus('locked')
      try {
        navigator.vibrate?.(40)
      } catch {
        /* not allowed here */
      }
      report('locked')
      const file = c ? await canvasFile(c, 'live-camera.jpg') : null
      await new Promise((r) => setTimeout(r, reduced ? 150 : 650)) // the "Found it!" stamp on the frozen frame
      if (closedRef.current) return
      if (file) cb.current.onLocked(file, result)
      else cb.current.onFail('model')
    },
    [freeze, reduced, report, setStatus],
  )

  const shoot = useCallback(async () => {
    if (statusRef.current !== 'live' || doneRef.current) return
    doneRef.current = true
    setFlash((n) => n + 1)
    const c = freeze()
    setStatus('shot')
    report('shutter')
    const file = c ? await canvasFile(c, 'camera-photo.jpg') : null
    if (closedRef.current) return
    if (file) cb.current.onShutter(file)
    else {
      doneRef.current = false
      void start()
    }
  }, [freeze, report, setStatus, start])

  // ---- the scan loop: one frame in flight at most, ~700 ms apart, paused while the tab is hidden
  const ready = status === 'live' && model === 'ready'
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let timer = 0
    let embedErrors = 0
    const gen = genRef.current
    const next = (ms: number) => {
      if (!cancelled) timer = window.setTimeout(tick, ms)
    }
    const tick = async () => {
      const v = videoRef.current
      if (cancelled || doneRef.current || gen !== genRef.current) return
      if (!v || document.hidden || v.readyState < 2 || !v.videoWidth) return next(200)
      const t = performance.now()
      let result: PhotoSearch
      try {
        result = await searchFrame(await grabSquare(v))
        embedErrors = 0
      } catch (err) {
        if (cancelled || doneRef.current || gen !== genRef.current) return
        const stage = err instanceof VisualSearchError ? err.stage : 'embed'
        if (stage === 'index') return cb.current.onFail('index')
        if (stage === 'load' || stage === 'timeout' || ++embedErrors >= 3) return cb.current.onFail('model')
        return next(SCAN_EVERY_MS)
      }
      if (cancelled || doneRef.current || gen !== genRef.current) return
      statsRef.current.frames++
      const top = result.exact ?? result.similar[0] ?? null
      const prev = scanRef.current
      const exactNow = !!result.exact
      const streak = exactNow && prev.top?.product.slug === result.exact!.product.slug ? prev.streak + 1 : exactNow ? 1 : 0
      const apparel = !!top && (top.product.type === 'tshirt' || top.product.type === 'hoodie')
      const s: Scan = {
        stage: exactNow ? 'found' : top ? 'closer' : 'looking',
        top,
        streak,
        frontish: !exactNow && apparel ? prev.frontish + 1 : 0,
      }
      scanRef.current = s
      setScan(s)
      if (streak >= LOCK_FRAMES) return void lock(result)
      next(Math.max(60, SCAN_EVERY_MS - (performance.now() - t)))
    }
    next(150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [ready, lock])

  // the matcher failed to load while the viewfinder waits for it: camera off, the modal's "matcher" error
  useEffect(() => {
    if (model !== 'failed' || doneRef.current || (status !== 'live' && status !== 'starting' && status !== 'paused')) return
    doneRef.current = true
    stopStream()
    report('model-failed')
    cb.current.onFail('model')
  }, [model, status, report, stopStream])

  // keyboard focus on the shutter once the viewfinder is live
  useEffect(() => {
    if (status === 'live') shutterRef.current?.focus({ preventScroll: true })
  }, [status])

  const switchCamera = () => {
    const tr = streamRef.current?.getVideoTracks()[0]
    const s = tr?.getSettings()
    if (s?.facingMode) {
      void start({ facing: s.facingMode === 'user' ? 'environment' : 'user' })
      return
    }
    const list = devicesRef.current
    if (list.length < 2) return
    const i = list.findIndex((d) => d.deviceId === s?.deviceId)
    void start({ deviceId: list[(i + 1) % list.length].deviceId })
  }

  const toggleTorch = async () => {
    const tr = streamRef.current?.getVideoTracks()[0]
    if (!tr) return
    const on = !torch
    try {
      await tr.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorch(on)
    } catch {
      setTorchOk(false)
    }
  }

  const showVideo = status === 'live' || status === 'starting' || status === 'locked' || status === 'shot'
  const frozen = status === 'locked' || status === 'shot'
  const pct = scan.top ? Math.round(matchStrength(scan.top.score, MATCH, scan.stage === 'found') * 100) : 0
  const loadingModel = status === 'live' && model !== 'ready'

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3">
      {/* viewfinder: square + object-cover = exactly the centre square that is scanned */}
      <div
        className={cn(
          'ted-lc relative aspect-square w-full max-w-[min(100%,52dvh)] overflow-hidden border-4 border-ink bg-ink shadow-hard',
          `is-${scan.stage}`,
          status === 'locked' && 'is-locked',
          reduced && 'is-still',
        )}
        aria-busy={status === 'starting' || loadingModel}
      >
        <video
          ref={videoRef}
          className={cn('absolute inset-0 size-full object-cover', mirror && '-scale-x-100', !showVideo && 'invisible')}
          playsInline
          muted
          autoPlay
          disablePictureInPicture
          aria-label="Live camera view"
        />
        <canvas ref={freezeRef} aria-hidden="true" className={cn('absolute inset-0 size-full object-cover', !frozen && 'hidden')} />

        {showVideo && (
          <>
            <span aria-hidden="true" className="ted-lc-bracket absolute" />
            {scan.stage === 'found' && <span aria-hidden="true" className="ted-ps-lines absolute inset-[-25%]" />}
            <span className="label absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1 text-[10.5px] font-bold text-ink shadow-hard-sm">
              <span aria-hidden="true" className={cn('ted-lc-rec size-2 rounded-full bg-hype', frozen && 'opacity-0')} />
              {frozen ? 'Frozen' : 'Live'} <span lang="ja" aria-hidden="true" className="opacity-60">ライブ</span>
            </span>
          </>
        )}

        {/* live status card */}
        {(status === 'live' || status === 'locked') && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'absolute inset-x-2.5 bottom-2.5 flex items-center gap-2.5 border-[3px] border-ink p-2 text-ink shadow-hard-sm transition-colors duration-200',
              scan.stage === 'found' ? 'bg-volt' : 'bg-paper',
            )}
          >
            {scan.top && scan.stage !== 'looking' ? (
              <span className="relative size-12 shrink-0 overflow-hidden border-2 border-ink bg-ink">
                {scan.top.product.image && <Image src={scan.top.product.image} alt="" fill sizes="48px" className="object-cover" />}
              </span>
            ) : (
              <span aria-hidden="true" className="ted-lc-radar relative grid size-12 shrink-0 place-items-center border-2 border-ink bg-lav">
                <Camera className="size-5" strokeWidth={2.4} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[22px] uppercase leading-[0.9]">
                {loadingModel ? 'Waking up…' : status === 'locked' || scan.stage === 'found' ? 'Found it!' : scan.stage === 'closer' ? 'Getting closer…' : 'Looking…'}
              </span>
              <span className="block truncate text-[12.5px] font-semibold leading-tight">
                {loadingModel
                  ? `Loading the matcher${progress != null ? ` · ${progress}%` : ''}`
                  : scan.top && scan.stage !== 'looking'
                    ? scan.top.product.name
                    : 'Fill the box with the print'}
              </span>
              {scan.top && scan.stage !== 'looking' && !loadingModel && (
                <span aria-hidden="true" className="mt-1 flex items-center gap-1.5">
                  <span className="relative h-2 flex-1 border-2 border-ink bg-paper">
                    <span className="ted-lc-meter absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.max(6, pct)}%` }} />
                  </span>
                  <span className="w-8 text-right font-mono text-[10.5px] font-bold tabular-nums">{pct}%</span>
                </span>
              )}
            </span>
          </div>
        )}

        {status === 'locked' && (
          <span aria-hidden="true" className="ted-lc-stamp pointer-events-none absolute left-1/2 top-[38%] border-4 border-ink bg-volt px-4 py-2 font-display text-[40px] uppercase leading-none text-ink shadow-hard">
            Got it <span lang="ja" className="text-[26px]">ドン!</span>
          </span>
        )}
        {flash > 0 && !reduced && <span key={flash} aria-hidden="true" className="ted-lc-flash pointer-events-none absolute inset-0 bg-paper" />}

        {/* not live yet: pre-prompt / starting / paused / error */}
        {!showVideo && (
          <div className="absolute inset-0 overflow-y-auto bg-lav p-4 text-ink sm:p-5">
            <span aria-hidden="true" className="screentone screentone-mid pointer-events-none absolute inset-0 text-ink [--tone-opacity:0.12]" />
            <div className="relative flex min-h-full flex-col justify-center gap-3">
              {status === 'error' && error ? (
                <CameraErrorCard kind={error} touch={touch} onRetry={() => void start()} onUpload={onUpload} onTakePhoto={onTakePhoto} />
              ) : status === 'paused' ? (
                <>
                  <p className="font-display text-[30px] uppercase leading-[0.9]">Camera paused</p>
                  <p className="text-[14px] leading-snug">We turned it off while you were away.</p>
                  <button type="button" data-autofocus="" onClick={() => void start()} className="press focus-ring label inline-flex min-h-12 w-fit items-center gap-2 border-[3px] border-ink bg-volt px-4 text-[11.5px] font-bold shadow-hard-sm">
                    <Camera aria-hidden="true" className="size-4" /> Turn it back on
                  </button>
                </>
              ) : (
                <>
                  <span className="grid size-14 place-items-center border-[3px] border-ink bg-paper shadow-hard-sm">
                    <Camera aria-hidden="true" className="size-7" strokeWidth={2.4} />
                  </span>
                  <p className="font-display text-[30px] uppercase leading-[0.9] sm:text-[36px]">Point, hold, <em>found</em></p>
                  <p className="max-w-[40ch] text-[14px] leading-snug">
                    We need your camera to look at the design. It finds the product while you hold it steady. The video stays on your {touch ? 'phone' : 'device'}: nothing is recorded or uploaded.
                  </p>
                  <p className="flex items-center gap-2 text-[12.5px] font-semibold">
                    <Lock aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.6} />
                    Your browser will ask once. Tap <strong>Allow</strong>.
                  </p>
                  <button
                    type="button"
                    data-autofocus=""
                    disabled={status !== 'prompt'}
                    onClick={() => void start()}
                    className="press focus-ring label inline-flex min-h-12 w-fit items-center gap-2 border-[3px] border-ink bg-ink px-4 text-[11.5px] font-bold text-paper shadow-hard-sm disabled:opacity-60 can-hover:hover:bg-door"
                  >
                    <Camera aria-hidden="true" className="size-4" /> {status === 'checking' ? 'One moment…' : 'Turn on camera'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {status === 'starting' && (
          <span className="label absolute inset-x-0 bottom-3 mx-auto w-fit border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold text-ink shadow-hard-sm">Opening camera…</span>
        )}
      </div>

      {/* controls */}
      <div className="grid w-full max-w-[min(100%,52dvh)] grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex justify-start">
          <button type="button" onClick={onBack} className="press focus-ring label inline-flex min-h-11 items-center gap-1.5 border-[3px] border-ink bg-paper px-3 text-[10.5px] font-bold shadow-hard-sm can-hover:hover:bg-volt">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back
          </button>
        </div>
        <button
          ref={shutterRef}
          type="button"
          onClick={() => void shoot()}
          disabled={status !== 'live'}
          aria-label="Take the photo now"
          className={cn('ted-lc-shutter press focus-ring relative grid size-[72px] place-items-center border-4 border-ink bg-volt shadow-hard disabled:opacity-50', status === 'error' && 'invisible')}
        >
          <span aria-hidden="true" className="size-[46px] border-[3px] border-ink bg-paper" />
        </button>
        <div className="flex justify-end gap-2">
          {canSwitch && status === 'live' && (
            <button type="button" onClick={switchCamera} aria-label="Switch camera" title="Switch camera" className="press focus-ring grid size-11 place-items-center border-[3px] border-ink bg-paper shadow-hard-sm can-hover:hover:bg-volt">
              <SwitchCamera aria-hidden="true" className="size-5" />
            </button>
          )}
          {torchOk && status === 'live' && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-pressed={torch}
              aria-label={torch ? 'Turn the light off' : 'Turn the light on'}
              title="Light"
              className={cn('press focus-ring grid size-11 place-items-center border-[3px] border-ink shadow-hard-sm', torch ? 'bg-volt' : 'bg-paper can-hover:hover:bg-volt')}
            >
              {torch ? <Flashlight aria-hidden="true" className="size-5" /> : <FlashlightOff aria-hidden="true" className="size-5" />}
            </button>
          )}
        </div>
      </div>

      <p className={cn('max-w-[46ch] text-center text-[13px] leading-snug text-ink/75', status === 'error' && 'hidden')}>
        {scan.frontish >= FRONT_HINT_FRAMES ? (
          <>Our tee fronts look alike. <strong>Turn it around</strong>: the back print locks the exact design.</>
        ) : (
          <>Hold the print inside the brackets, straight on and in good light. It locks by itself, or press the shutter.</>
        )}
      </p>
      <style>{LC_CSS}</style>
    </div>
  )
}

const ERR_COPY: Record<CamError, { title: string; body: (ios: boolean, touch: boolean) => string }> = {
  insecure: {
    title: 'Camera needs a secure page',
    body: () => 'Browsers only open the camera on https pages. Open the shop at its https address, or upload a photo instead.',
  },
  unsupported: {
    title: 'This browser can’t stream the camera',
    body: (_ios, touch) => (touch ? 'Take a photo with your camera app instead: it works the same.' : 'Upload a photo of the design instead: it works the same.'),
  },
  denied: {
    title: 'Camera is blocked',
    body: (ios, touch) =>
      ios
        ? 'Tap aA in the address bar › Website Settings › Camera › Allow (or Settings › Safari › Camera › Allow), then press Try again.'
        : touch
          ? 'Tap the icon left of the address bar › Permissions › Camera › Allow, then press Try again.'
          : 'Click the camera or lock icon in the address bar › allow the camera for this site, then press Try again.',
  },
  nocamera: {
    title: 'No camera found',
    body: () => 'We couldn’t find a camera on this device. Upload a photo or a screenshot of the design instead.',
  },
  busy: {
    title: 'The camera is busy',
    body: () => 'Another app or tab may be using it. Close it and press Try again, or upload a photo instead.',
  },
}

function CameraErrorCard({ kind, touch, onRetry, onUpload, onTakePhoto }: { kind: CamError; touch: boolean; onRetry: () => void; onUpload: () => void; onTakePhoto: () => void }) {
  const e = ERR_COPY[kind]
  const retry = kind === 'denied' || kind === 'busy'
  return (
    <div role="alert" className="flex flex-col gap-3">
      <span className="grid size-14 place-items-center border-[3px] border-ink bg-hype text-paper shadow-hard-sm">
        <CameraOff aria-hidden="true" className="size-7" strokeWidth={2.4} />
      </span>
      <p className="font-display text-[30px] uppercase leading-[0.9]">{e.title}</p>
      <p className="max-w-[44ch] text-[14px] leading-snug">{e.body(isIOS(), touch)}</p>
      <div className="flex flex-wrap gap-2">
        {retry && (
          <button type="button" data-autofocus="" onClick={onRetry} className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-volt px-3 text-[11px] font-bold shadow-hard-sm">
            <RotateCcw aria-hidden="true" className="size-4" /> Try again
          </button>
        )}
        {touch && (
          <button type="button" data-autofocus={retry ? undefined : ''} onClick={onTakePhoto} className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-ink px-3 text-[11px] font-bold text-paper shadow-hard-sm">
            <Camera aria-hidden="true" className="size-4" /> Take a photo
          </button>
        )}
        <button type="button" data-autofocus={retry || touch ? undefined : ''} onClick={onUpload} className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-3 text-[11px] font-bold shadow-hard-sm can-hover:hover:bg-volt">
          <ImageUp aria-hidden="true" className="size-4" /> Upload a photo
        </button>
      </div>
    </div>
  )
}

const LC_CSS = `@layer components{
.ted-lc-bracket{--b:var(--color-volt);inset:9%;transition:inset 260ms var(--ease-punch,cubic-bezier(.34,1.56,.64,1));background:
  linear-gradient(var(--b),var(--b)) top left/34px 5px no-repeat,linear-gradient(var(--b),var(--b)) top left/5px 34px no-repeat,
  linear-gradient(var(--b),var(--b)) top right/34px 5px no-repeat,linear-gradient(var(--b),var(--b)) top right/5px 34px no-repeat,
  linear-gradient(var(--b),var(--b)) bottom left/34px 5px no-repeat,linear-gradient(var(--b),var(--b)) bottom left/5px 34px no-repeat,
  linear-gradient(var(--b),var(--b)) bottom right/34px 5px no-repeat,linear-gradient(var(--b),var(--b)) bottom right/5px 34px no-repeat;
  filter:drop-shadow(2px 2px 0 var(--color-ink));animation:ted-lc-breathe 1400ms ease-in-out infinite alternate}
.ted-lc.is-closer .ted-lc-bracket{inset:12%;--b:var(--color-paper);animation-duration:700ms}
.ted-lc.is-found .ted-lc-bracket,.ted-lc.is-locked .ted-lc-bracket{inset:14%;--b:var(--color-volt);animation:none}
@keyframes ted-lc-breathe{from{transform:scale(1)}to{transform:scale(.965)}}
.ted-lc-rec{animation:ted-lc-rec 1s steps(2) infinite}
@keyframes ted-lc-rec{50%{opacity:.25}}
.ted-lc-meter{transition:width 300ms var(--ease-expo,cubic-bezier(.16,1,.3,1))}
.ted-lc-radar{animation:ted-lc-radar 1100ms steps(4) infinite}
@keyframes ted-lc-radar{0%,100%{transform:rotate(0)}50%{transform:rotate(-6deg)}}
.ted-lc-stamp{transform:translate(-50%,-50%) rotate(-6deg);animation:ted-lc-stamp 380ms cubic-bezier(.34,1.56,.64,1) both}
@keyframes ted-lc-stamp{from{transform:translate(-50%,-50%) rotate(-14deg) scale(1.9);opacity:0}to{transform:translate(-50%,-50%) rotate(-6deg) scale(1);opacity:1}}
.ted-lc-flash{animation:ted-lc-flash 260ms ease-out forwards}
@keyframes ted-lc-flash{from{opacity:.85}to{opacity:0}}
.ted-lc-shutter:not(:disabled):active>span{transform:scale(.86)}
.ted-lc-shutter>span{transition:transform 150ms ease-out}
.ted-lc.is-still .ted-lc-bracket,.ted-lc.is-still .ted-lc-rec,.ted-lc.is-still .ted-lc-radar,.ted-lc.is-still .ted-ps-lines{animation:none}
.ted-lc.is-still .ted-lc-bracket{transition:none}
.ted-lc.is-still .ted-lc-stamp{animation:none}
@media (prefers-reduced-motion:reduce){.ted-lc-bracket,.ted-lc-rec,.ted-lc-radar,.ted-lc-stamp,.ted-lc .ted-ps-lines{animation:none}.ted-lc-bracket,.ted-lc-meter{transition:none}}
}`

export default LiveCamera
