'use client'
// Custom Forge studio: step rail (Pick → Design → Place/Count → Send), live stage, live quote,
// uploads, lead + WhatsApp hand-off and the success moment. Owner: P3 forge.
// Reads ?product= (so it must sit inside <Suspense>); persists a draft in localStorage.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Mascot } from '@/components/brand'
import { Sfx } from '@/components/fx/Sfx'
import { formatINR } from '@/lib/pricing'
import { track, getAttribution } from '@/lib/analytics'
import { submitLead } from '@/lib/leads'
import { waLink } from '@/lib/whatsapp'
import { useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { useReducedMotion } from '@/lib/motion'
import { clamp, cn } from '@/lib/utils'
import {
  KINDS,
  KIND_META,
  STEPS,
  DEFAULT_PLACE,
  buildForgeMessage,
  clearDraft,
  fromPrice,
  garmentLabel,
  initialDraft,
  isApparel,
  loadDraft,
  minQty,
  parseProductParam,
  quoteFor,
  saveDraft,
  type ForgeData,
  type ForgeDraft,
  type ForgeKind,
  type Placement,
  type Side,
} from './model'
import { Stage, type Art } from './Stage'
import { PricePanel, TotalFigure } from './PricePanel'
import { ACCEPT_ATTR, MAX_FILES, fileProblem, uploadArtwork, type UploadOutcome } from './upload'
import { KindIcon } from './KindIcon'
import { openWhatsApp, openWhatsAppPending } from '@/lib/wa-open'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { useRequireLogin } from '@/lib/auth/customer'

interface Attached {
  id: string
  file: File
  url: string
  type: 'image' | 'pdf'
  /** upload starts the moment the file is picked, so the link is ready by Send */
  up: 'uploading' | 'ok' | 'failed' | 'skipped'
  progress: number
}

/** max wait for still-running uploads after Send before WhatsApp opens without their links */
const UPLOAD_WAIT_MS = 6000

type Phase = 'idle' | 'uploading' | 'saving' | 'opening' | 'done'

const ContactSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name (2+ letters).').max(80, 'Keep it under 80 characters.'),
  city: z.string().trim().min(2, 'Which city should we ship to?').max(80, 'Keep it under 80 characters.'),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === '' || /^\+?[\d\s-]{8,18}$/.test(v), 'Use digits, e.g. +91 98765 43210.'),
  notes: z.string().max(600, 'Keep notes under 600 characters.'),
})
type ContactErrors = Partial<Record<'name' | 'city' | 'phone' | 'notes', string>>

let uid = 0
const nextId = () => `f${++uid}`

export function ForgeStudio({ data }: { data: ForgeData }) {
  const waNumber = useWhatsappNumber()
  const params = useSearchParams()
  const reduced = useReducedMotion()
  const [d, setD] = useState<ForgeDraft>(() => initialDraft(data))
  const [files, setFiles] = useState<Attached[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [slamKey, setSlamKey] = useState(0)
  const [ready, setReady] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ContactErrors>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const uploads = useRef(new Map<string, Promise<UploadOutcome>>())
  const uploaded = useRef(new Map<string, UploadOutcome>())
  const uploadsOff = useRef(false)
  const [result, setResult] = useState<{ link: string; opened: boolean; pending: number; stored: boolean } | null>(null)
  const started = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const studio = useRef<HTMLDivElement>(null)
  const userNav = useRef(false)
  const [studioInView, setStudioInView] = useState(false)

  const update = useCallback((patch: Partial<ForgeDraft>) => setD((p) => ({ ...p, ...patch })), [])
  const quote = useMemo(() => quoteFor(d, data), [d, data])
  const apparel = isApparel(d.kind)

  // ---- restore draft + ?product= (client only)
  useEffect(() => {
    const saved = loadDraft(data)
    const param = parseProductParam(params.get('product'))
    let next = saved ?? initialDraft(data)
    if (saved?.kind) {
      toast('Draft restored', {
        description: 'Your choices are back. Files need re-attaching.',
        action: { label: 'Start over', onClick: () => resetAll() },
      })
    }
    if (param) {
      next = { ...next, kind: param.kind, fit: param.fit ?? next.fit, qty: Math.max(next.kind === param.kind ? next.qty : 1, minQty(param.kind, data)) }
      if (next.kind !== saved?.kind) next.step = 0
    }
    // files never survive a reload → never resume on the Send step with stale state
    next.step = Math.min(next.step, next.maxStep)
    setD(next)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- persist (debounced)
  useEffect(() => {
    if (!ready || phase === 'done') return
    const t = setTimeout(() => saveDraft(d), 250)
    return () => clearTimeout(t)
  }, [d, ready, phase])

  // ---- object URLs cleanup
  const filesRef = useRef(files)
  const requireLogin = useRequireLogin() // sending a design needs an account (AUTH)
  const loginPassed = useRef(false)
  filesRef.current = files
  useEffect(() => () => filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)), [])

  // ---- sticky mobile bar only while the studio is on screen
  useEffect(() => {
    const el = studio.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStudioInView(e.isIntersecting), { rootMargin: '-30% 0px -30% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // ---- focus the step heading after user navigation
  useEffect(() => {
    if (!userNav.current) return
    userNav.current = false
    stepHeading.current?.focus({ preventScroll: true })
    const top = controls.current?.getBoundingClientRect().top ?? 0
    if (top < 60 || top > window.innerHeight * 0.7) {
      const y = window.scrollY + top - 140
      const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o?: object) => void } }).__lenis
      if (lenis) lenis.scrollTo(y, { duration: reduced ? 0 : 0.6 })
      else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' })
    }
  }, [d.step, reduced])

  function resetAll() {
    clearDraft()
    filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url))
    setFiles([])
    setFileErrors([])
    setErrors({})
    setStepError(null)
    setPhase('idle')
    uploads.current.clear()
    uploaded.current.clear()
    setResult(null)
    setD(initialDraft(data))
  }

  // ---- product
  const pickKind = (k: ForgeKind) => {
    if (!started.current) {
      started.current = true
      track('custom_start', { product: k })
    }
    setStepError(null)
    setD((p) => ({
      ...p,
      kind: k,
      qty: p.kind === k ? p.qty : minQty(k, data),
      side: isApparel(k) ? p.side : 'front',
      halfHalf: isApparel(k) ? p.halfHalf : false,
    }))
  }

  // ---- files
  const patchFile = (id: string, patch: Partial<Attached>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  // uploads start as soon as a file is picked (progress shown on its tile) so links are ready by Send.
  // No Supabase on this deploy → skip instantly (the message then says the file follows in chat).
  const startUpload = (a: Attached) => {
    const p = uploadArtwork(a.file, (pr) => patchFile(a.id, { progress: pr })).then((res) => {
      uploaded.current.set(a.id, res)
      if (res.status === 'unconfigured') uploadsOff.current = true
      patchFile(a.id, res.status === 'ok' ? { up: 'ok', progress: 1 } : { up: res.status === 'unconfigured' ? 'skipped' : 'failed' })
      return res
    })
    uploads.current.set(a.id, p)
  }
  const addFiles = (list: File[]) => {
    const errs: string[] = []
    const ok: Attached[] = []
    if (!isSupabaseConfigured()) uploadsOff.current = true
    const skip = uploadsOff.current
    for (const f of list) {
      const problem = fileProblem(f)
      if (problem) errs.push(problem)
      else
        ok.push({
          id: nextId(),
          file: f,
          url: f.type === 'application/pdf' ? '' : URL.createObjectURL(f),
          type: f.type === 'application/pdf' ? 'pdf' : 'image',
          up: skip ? 'skipped' : 'uploading',
          progress: 0,
        })
    }
    const room = Math.max(0, MAX_FILES - filesRef.current.length)
    if (ok.length > room) errs.push(`Up to ${MAX_FILES} files per request — send the rest on WhatsApp.`)
    ok.slice(room).forEach((f) => f.url && URL.revokeObjectURL(f.url))
    const accepted = ok.slice(0, room)
    setFiles((prev) => [...prev, ...accepted])
    if (!skip) accepted.forEach(startUpload)
    setFileErrors(errs)
    if (ok.length) setSlamKey((k) => k + 1)
  }
  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id)
      if (f?.url) URL.revokeObjectURL(f.url)
      return prev.filter((x) => x.id !== id)
    })
    setD((p) => ({ ...p, place: { front: { ...p.place.front, file: 0 }, back: { ...p.place.back, file: 0 } } }))
  }

  const artFor = (side: Side): Art => {
    if (files.length) {
      const f = files[d.place[side].file] ?? files[0]
      return f.type === 'pdf' ? { kind: 'pdf', name: f.file.name } : { kind: 'image', url: f.url, name: f.file.name }
    }
    return d.mode === 'company' ? { kind: 'brief' } : null
  }
  const art = { front: artFor('front'), back: artFor('back') }

  const setPlace = (side: Side, p: Partial<Placement>) =>
    setD((prev) => ({ ...prev, place: { ...prev.place, [side]: { ...prev.place[side], ...p } } }))

  // ---- navigation
  const go = (step: number) => {
    userNav.current = true
    setStepError(null)
    setD((p) => ({ ...p, step, maxStep: Math.max(p.maxStep, step) }))
    if (step === 2 && (files.length || d.mode === 'company')) setSlamKey((k) => k + 1)
  }
  const next = () => {
    if (d.step === 0 && !d.kind) return setStepError('Pick something to print on first.')
    if (d.step === 2 && apparel && !d.place.front.on && !d.place.back.on) return setStepError('Turn on at least one print side — front or back.')
    if (d.step < 3) go(d.step + 1)
  }

  // ---- submit
  const busy = phase !== 'idle' && phase !== 'done'
  const upProgress = files.length ? files.reduce((n, f) => n + (f.up === 'uploading' ? f.progress : 1), 0) / files.length : 1
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || !d.kind) return
    const parsed = ContactSchema.safeParse({ name: d.name, city: d.city, phone: d.phone, notes: d.notes })
    if (!parsed.success) {
      const fe: ContactErrors = {}
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ContactErrors
        if (!fe[k]) fe[k] = issue.message
      }
      setErrors(fe)
      const first = (['name', 'city', 'phone', 'notes'] as const).find((k) => fe[k])
      if (first) document.getElementById(`forge-${first}`)?.focus()
      return
    }
    setErrors({})
    if (!loginPassed.current) {
      // signed in â†’ runs now (same click, WhatsApp still opens); signed out â†’ login modal, then sends
      requireLogin('Log in to send your design', () => {
        loginPassed.current = true
        void submit()
      })
      return
    }
    loginPassed.current = false
    const honeypot = (document.getElementById('forge-company') as HTMLInputElement | null)?.value ?? ''

    const current = filesRef.current
    const kind = d.kind
    const quantity = Math.max(quote.minQty, d.qty)

    // Build the message from whatever links are ready, open WhatsApp, save the lead in the background.
    const send = (open: (link: string) => boolean) => {
      const fileUrls: string[] = []
      for (const f of current) {
        const r = uploaded.current.get(f.id)
        if (r?.status === 'ok') fileUrls.push(r.url)
      }
      const pending = current.length - fileUrls.length
      const text = buildForgeMessage(d, data, { fileUrls, filesPending: pending, fileCount: current.length, ref: getAttribution().src })
      const link = waLink(text, waNumber)
      const opened = open(link)
      const spec = {
        mode: d.mode,
        product: kind,
        variant: garmentLabel(d, data),
        quantity,
        halfHalf: apparel && d.halfHalf,
        zones: apparel
          ? (['front', 'back'] as Side[]).filter((s) => d.place[s].on).map((s) => ({ zone: s, x: d.place[s].x, y: d.place[s].y, scale: d.place[s].scale, rotate: d.place[s].rotate }))
          : [],
        brief: d.mode === 'company' ? d.brief.trim().slice(0, 1000) : undefined,
        fileUrls,
        filesPending: pending,
        quote: { total: quote.total, lines: quote.lines, estimate: quote.estimate },
      }
      // fire-and-forget (keepalive) — never delays WhatsApp
      void submitLead(
        { kind: 'custom_request', name: d.name.trim(), city: d.city.trim(), contact: d.phone.trim() || undefined, message: d.notes.trim() || undefined, payload: spec },
        { honeypot },
      )
      track('custom_submit', { product: kind, mode: d.mode, qty: quantity, total: quote.total ?? undefined, files: current.length, uploaded: fileUrls.length })
      track('whatsapp_click', { source: 'forge', opened })
      clearDraft()
      // the success moment plays AFTER WhatsApp has opened
      setResult({ link, opened, pending, stored: true })
      setPhase('done')
    }

    const running = current.map((f) => (f.up === 'uploading' ? uploads.current.get(f.id) : undefined)).filter((p): p is Promise<UploadOutcome> => !!p)
    if (!running.length) {
      // links ready (or no files / uploads off): WhatsApp opens inside this click
      send((link) => openWhatsApp(link))
      return
    }
    // uploads still running: open the tab now (popup-safe), point it at WhatsApp when they land (max 6 s)
    const tab = openWhatsAppPending()
    setPhase('uploading')
    await Promise.race([Promise.all(running), new Promise((r) => window.setTimeout(r, UPLOAD_WAIT_MS))])
    send((link) => tab.go(link))
  }

  // ------------------------------------------------------------------ render
  if (phase === 'done' && result) {
    return <Success d={d} data={data} quote={quote} result={result} onAgain={resetAll} reduced={reduced} />
  }

  const stepMeta = STEPS[d.step]
  const stepLabel = (i: number) => (i === 2 && d.kind && !apparel ? 'Count' : STEPS[i].label)
  const stepJp = (i: number) => (i === 2 && d.kind && !apparel ? '数量' : STEPS[i].jp)

  return (
    <div ref={studio} className="relative">
      {/* step rail */}
      <nav aria-label="Forge steps" className="border-4 border-ink bg-ink text-paper shadow-hard">
        <ol className="grid grid-cols-4">
          {STEPS.map((s, i) => {
            const current = i === d.step
            const reachable = i <= d.maxStep
            return (
              <li key={s.id} className={cn(i > 0 && 'border-l-2 border-tone-2')}>
                <button
                  type="button"
                  disabled={!reachable || busy}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => go(i)}
                  className={cn(
                    'focus-ring relative flex min-h-14 w-full flex-col items-start justify-center px-2 py-2 text-left transition-colors duration-150 sm:min-h-16 sm:px-4',
                    current ? 'text-ink' : reachable ? 'text-paper can-hover:hover:bg-tone-2' : 'cursor-not-allowed text-tone-3',
                  )}
                >
                  {current ? (
                    <motion.span
                      layoutId="forge-rail"
                      aria-hidden="true"
                      className="absolute inset-0 bg-volt"
                      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative flex items-baseline gap-1.5">
                    <span className="font-mono text-[11px] font-bold">{String(i + 1).padStart(2, '0')}</span>
                    {i < d.maxStep && !current ? <span aria-label="done" className="text-[11px] text-volt">✓</span> : null}
                  </span>
                  <span className="relative font-display text-lg uppercase leading-none sm:text-2xl">{stepLabel(i)}</span>
                  <span lang="ja" aria-hidden="true" className="relative hidden font-jp text-[10px] font-bold opacity-60 sm:block">
                    {stepJp(i)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        {/* stage */}
        <div className="sticky top-[calc(var(--header-h)+8px)] z-10 h-[44svh] min-h-[300px] border-4 border-ink bg-lav text-ink shadow-hard sm:h-[52svh] lg:top-[calc(var(--header-h)+16px)] lg:col-span-7 lg:h-[calc(100svh-8rem)] lg:max-h-[780px] lg:min-h-[560px]">
          <div aria-hidden="true" className="screentone-light pointer-events-none absolute inset-0 screentone" style={{ ['--tone-opacity' as string]: 0.18 }} />
          <Stage
            kind={d.kind}
            data={data}
            side={d.side}
            onSide={(s) => update({ side: s })}
            place={d.place}
            onPlace={setPlace}
            art={art}
            slamKey={slamKey}
            editing={d.step === 2}
            qty={Math.max(quote.minQty, d.qty)}
            bookmark={d.bookmark}
            onDropFiles={d.kind ? addFiles : undefined}
          />
        </div>

        {/* controls */}
        <div className="lg:col-span-5">
          <div ref={controls} className="border-4 border-ink bg-paper text-ink shadow-hard grain">
            <div className="flex items-center gap-3 border-b-4 border-ink px-4 py-3 sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center bg-ink font-mono text-sm font-bold text-volt">{String(d.step + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <h3 ref={stepHeading} tabIndex={-1} className="font-display text-2xl uppercase leading-none outline-none sm:text-3xl">
                  {d.step === 0 && 'Pick what we print on'}
                  {d.step === 1 && 'Bring the design'}
                  {d.step === 2 && (apparel ? 'Place it on the garment' : 'How many pieces?')}
                  {d.step === 3 && 'Send it to the press'}
                </h3>
                <p lang="ja" aria-hidden="true" className="font-jp text-[11px] font-bold tracking-[0.3em] opacity-60">
                  {stepJp(d.step)} · STEP {d.step + 1}/4
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stepMeta.id + (d.kind ?? '')}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -28 }}
                  transition={{ duration: reduced ? 0.12 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="px-4 py-5 sm:px-5"
                >
                  {d.step === 0 && <StepPick d={d} data={data} onKind={pickKind} update={update} />}
                  {d.step === 1 && (
                    <StepDesign d={d} data={data} update={update} files={files} errors={fileErrors} onAdd={addFiles} onRemove={removeFile} />
                  )}
                  {d.step === 2 &&
                    (apparel ? (
                      <StepPlace d={d} data={data} update={update} setPlace={setPlace} files={files} onSlam={() => setSlamKey((k) => k + 1)} />
                    ) : (
                      <StepCount d={d} data={data} update={update} />
                    ))}
                  {d.step === 3 && (
                    <StepSend d={d} update={update} errors={errors} setErrors={setErrors} onSubmit={submit} busy={busy} phase={phase} progress={upProgress} files={files.length} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {stepError ? (
              <p role="alert" className="mx-4 mb-3 border-l-4 border-hype bg-hype/10 px-3 py-2 text-sm font-medium sm:mx-5">
                {stepError}
              </p>
            ) : null}

            {/* nav */}
            <div className="flex items-center justify-between gap-3 border-t-4 border-ink px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => go(Math.max(0, d.step - 1))}
                disabled={d.step === 0 || busy}
                className="label focus-ring press min-h-12 px-3 disabled:invisible"
              >
                ← Back
              </button>
              {d.step < 3 ? (
                <button
                  type="button"
                  onClick={next}
                  className="label focus-ring press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-5 font-bold text-ink shadow-hard-sm"
                >
                  {d.step === 1 && !files.length && d.mode === 'own' ? 'Skip — send file later' : `Next: ${stepLabel(d.step + 1)}`} →
                </button>
              ) : null}
            </div>
          </div>

          <PricePanel quote={quote} empty={!d.kind} className="mt-4 lg:mt-6" />
          {d.kind ? (
            <button type="button" onClick={resetAll} className="label focus-ring mt-3 min-h-11 text-paper/70 underline underline-offset-4 can-hover:hover:text-volt">
              Start over
            </button>
          ) : null}
        </div>
      </div>

      {/* mobile sticky quote bar */}
      <div
        aria-hidden={!studioInView}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t-4 border-ink bg-paper px-4 py-2 text-ink transition-transform duration-200 lg:hidden',
          studioInView && d.kind && d.step < 3 ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label truncate text-[10px]">{d.kind ? garmentLabel(d, data) : ''} · estimate</p>
            <TotalFigure quote={quote} className="text-xl leading-tight" />
          </div>
          <button
            type="button"
            tabIndex={studioInView ? 0 : -1}
            onClick={next}
            className="label focus-ring press min-h-12 shrink-0 border-[3px] border-ink bg-volt px-4 font-bold shadow-hard-sm"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// ================================================================== steps
function Choice({ name, checked, onChange, children, className }: { name: string; checked: boolean; onChange: () => void; children: ReactNode; className?: string }) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer border-[3px] border-ink transition-[background-color,box-shadow,translate] duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-door',
        checked ? 'bg-ink text-paper shadow-hard-volt' : 'bg-paper can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-hard-sm',
        className,
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  )
}

function StepPick({ d, data, onKind, update }: { d: ForgeDraft; data: ForgeData; onKind: (k: ForgeKind) => void; update: (p: Partial<ForgeDraft>) => void }) {
  return (
    <div>
      <fieldset>
        <legend className="sr-only">Product</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {KINDS.map((k) => {
            const from = fromPrice(k, data)
            const min = minQty(k, data)
            const checked = d.kind === k
            return (
              <Choice key={k} name="forge-kind" checked={checked} onChange={() => onKind(k)} className="flex-col p-3">
                <KindIcon kind={k} className={cn('mb-2 h-10 w-10', checked ? 'text-volt' : 'text-ink')} />
                <span className="font-display text-xl uppercase leading-none">{KIND_META[k].label}</span>
                <span lang="ja" aria-hidden="true" className="mt-0.5 font-jp text-[10px] font-bold opacity-60">
                  {KIND_META[k].jp}
                </span>
                <span className="mt-2 font-mono text-[11px] leading-tight">
                  {from != null ? `from ${formatINR(from)}` : 'price on request'}
                  {min > 1 ? <span className="block opacity-75">min {min} pcs</span> : null}
                </span>
              </Choice>
            )
          })}
        </div>
      </fieldset>

      {d.kind === 'tshirt' ? (
        <fieldset className="mt-5">
          <legend className="label mb-2">Fit</legend>
          <div className="grid gap-2">
            {data.fits.map((f) => (
              <Choice key={f.id} name="forge-fit" checked={d.fit === f.id} onChange={() => update({ fit: f.id })} className="items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block font-bold">{f.label}</span>
                  <span className="block text-[13px] opacity-75">{f.blurb}</span>
                </span>
                <span className="font-mono text-sm font-bold">{formatINR(f.price)}</span>
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : null}

      {d.kind === 'hoodie' ? (
        <fieldset className="mt-5">
          <legend className="label mb-2">Fabric weight</legend>
          <div className="grid grid-cols-2 gap-2">
            {data.tiers.map((t) => (
              <Choice key={t.id} name="forge-tier" checked={d.tier === t.id} onChange={() => update({ tier: t.id })} className="flex-col px-3 py-2.5">
                <span className="font-mono text-[11px] font-bold">{t.code}</span>
                <span className="font-display text-lg uppercase leading-none">{t.name}</span>
                <span className="mt-1 font-mono text-[12px]">{t.gsmLabel}</span>
                <span className="font-mono text-sm font-bold">{formatINR(t.price)}</span>
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : null}

      {d.kind === 'bookmark' ? (
        <fieldset className="mt-5">
          <legend className="label mb-2">Bookmark type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['plain', 'magnetic'] as const).map((b) => (
              <Choice key={b} name="forge-bm" checked={d.bookmark === b} onChange={() => update({ bookmark: b })} className="px-3 py-3">
                <span className="font-display text-lg uppercase leading-none">{b}</span>
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}

function StepDesign({
  d,
  data,
  update,
  files,
  errors,
  onAdd,
  onRemove,
}: {
  d: ForgeDraft
  data: ForgeData
  update: (p: Partial<ForgeDraft>) => void
  files: Attached[]
  errors: string[]
  onAdd: (f: File[]) => void
  onRemove: (id: string) => void
}) {
  const apparel = isApparel(d.kind)
  return (
    <div>
      <fieldset>
        <legend className="sr-only">Design source</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Choice name="forge-mode" checked={d.mode === 'own'} onChange={() => update({ mode: 'own' })} className="flex-col p-3">
            <span className="font-display text-xl uppercase leading-none">Upload my design</span>
            <span className="mt-1 text-[13px] opacity-80">Your art, printed as sent.</span>
          </Choice>
          <Choice name="forge-mode" checked={d.mode === 'company'} onChange={() => update({ mode: 'company' })} className="flex-col p-3">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-display text-xl uppercase leading-none">Let us design it</span>
              <span className={cn('shrink-0 px-1 font-mono text-[11px] font-bold', d.mode === 'company' ? 'bg-volt text-ink' : 'bg-ink text-volt')}>
                {apparel ? `+${formatINR(data.apparel.companyDesignFee)}` : 'quoted'}
              </span>
            </span>
            <span className="mt-1 text-[13px] opacity-80">Tell us the idea; we draw it.</span>
          </Choice>
        </div>
      </fieldset>

      {d.mode === 'company' ? (
        <div className="mt-4">
          <label htmlFor="forge-brief" className="label mb-1.5 block">
            Your idea
          </label>
          <textarea
            id="forge-brief"
            value={d.brief}
            onChange={(e) => update({ brief: e.target.value.slice(0, 1000) })}
            rows={4}
            maxLength={1000}
            placeholder="e.g. Your fandom, a quote, colours, the vibe — and where it goes (front, back or both)."
            className="focus-ring w-full resize-y border-[3px] border-ink bg-paper px-3 py-2 text-[15px] placeholder:text-ink/45"
          />
          <p className="mt-1 text-right font-mono text-[11px] opacity-60">{d.brief.length}/1000</p>
        </div>
      ) : null}

      <Dropzone label={d.mode === 'company' ? 'Reference images (optional)' : 'Your artwork'} files={files} onAdd={onAdd} onRemove={onRemove} />
      {errors.length ? (
        <ul role="alert" className="mt-2 space-y-1">
          {errors.map((e) => (
            <motion.li
              key={e}
              initial={{ x: -10 }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', stiffness: 900, damping: 12 }}
              className="border-l-4 border-hype bg-hype/10 px-3 py-1.5 text-[13px] font-medium"
            >
              {e}
            </motion.li>
          ))}
        </ul>
      ) : null}
      {d.mode === 'own' && !files.length ? (
        <p className="mt-3 text-[13px] opacity-75">No file handy? Continue anyway — you can send it on WhatsApp.</p>
      ) : null}
    </div>
  )
}

function Dropzone({ label, files, onAdd, onRemove }: { label: string; files: Attached[]; onAdd: (f: File[]) => void; onRemove: (id: string) => void }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="mt-4">
      <p className="label mb-1.5">{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onAdd(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 border-[3px] border-dashed border-ink px-4 py-6 text-center transition-colors duration-150',
          over ? 'bg-volt' : 'bg-paper screentone screentone-light',
        )}
      >
        <span aria-hidden="true" className="font-sfx text-3xl leading-none">
          {over ? 'DROP IT!' : 'DRAG ART HERE'}
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="label focus-ring press min-h-11 border-[3px] border-ink bg-ink px-4 font-bold text-paper shadow-hard-volt"
        >
          Choose files
        </button>
        <span className="font-mono text-[11px] opacity-70">PNG · JPG · WebP · SVG · PDF — up to 10 MB each</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-label={`${label}: choose files`}
          onChange={(e) => {
            onAdd(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>
      {files.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f, i) => (
            <li key={f.id} className="relative border-[3px] border-ink bg-tone-1">
              <div className="aspect-square overflow-hidden">
                {f.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview
                  <img src={f.url} alt={`Attached file ${i + 1}: ${f.file.name}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-paper font-display text-2xl text-ink">PDF</span>
                )}
              </div>
              <p className="truncate bg-paper px-1 font-mono text-[10px]">{f.file.name}</p>
              {f.up === 'uploading' ? (
                <div role="progressbar" aria-label={`Uploading ${f.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f.progress * 100)} className="h-1.5 bg-ink/20">
                  <div className="h-full bg-door transition-[width] duration-150" style={{ width: `${Math.max(4, f.progress * 100)}%` }} />
                </div>
              ) : f.up === 'ok' ? (
                <p className="bg-volt px-1 font-mono text-[10px] font-bold uppercase">Uploaded ✓</p>
              ) : f.up === 'failed' ? (
                <p className="bg-hype px-1 font-mono text-[10px] font-bold uppercase">Send in chat</p>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`Remove ${f.file.name}`}
                className="focus-ring absolute -right-2 -top-2 grid size-8 place-items-center border-2 border-ink bg-hype font-bold text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ v: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex border-[3px] border-ink">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn('label focus-ring min-h-11 flex-1 px-3 font-bold transition-colors duration-150', value === o.v ? 'bg-ink text-volt' : 'can-hover:hover:bg-ink/10')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Range({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="label">
          {label}
        </label>
        <span className="font-mono text-[12px] font-bold">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="forge-range focus-ring h-11 w-full cursor-pointer accent-door"
      />
    </div>
  )
}

function Stepper({ id, label, value, min, max, onChange, help }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; help?: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = (raw: string) => {
    const n = Math.round(Number(raw))
    onChange(Number.isFinite(n) ? clamp(n, min, max) : min)
  }
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      <div className="flex w-fit border-[3px] border-ink">
        <button type="button" aria-label="One less" disabled={value <= min} onClick={() => onChange(clamp(value - 1, min, max))} className="focus-ring grid size-12 place-items-center text-2xl font-bold disabled:opacity-30">
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 5))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          aria-describedby={help ? `${id}-help` : undefined}
          className="focus-ring w-20 border-x-[3px] border-ink bg-paper text-center font-mono text-xl font-bold"
        />
        <button type="button" aria-label="One more" disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))} className="focus-ring grid size-12 place-items-center text-2xl font-bold disabled:opacity-30">
          +
        </button>
      </div>
      {help ? (
        <p id={`${id}-help`} className="mt-1.5 text-[13px] opacity-75">
          {help}
        </p>
      ) : null}
    </div>
  )
}

function StepPlace({
  d,
  data,
  update,
  setPlace,
  files,
  onSlam,
}: {
  d: ForgeDraft
  data: ForgeData
  update: (p: Partial<ForgeDraft>) => void
  setPlace: (s: Side, p: Partial<Placement>) => void
  files: Attached[]
  onSlam: () => void
}) {
  const p = d.place[d.side]
  const z = data.apparel.zones
  return (
    <div className="space-y-5">
      <p className="text-[14px] leading-snug">
        Drag the art inside the dashed zone. Pinch or use the sliders to size and turn it. Keyboard: arrows move, <kbd className="font-mono">+</kbd>/<kbd className="font-mono">−</kbd> resize,{' '}
        <kbd className="font-mono">[</kbd>/<kbd className="font-mono">]</kbd> rotate.
      </p>
      <Seg
        label="Editing side"
        value={d.side}
        onChange={(s) => update({ side: s })}
        options={[
          { v: 'front', label: `Front ${z.front.w}×${z.front.h}` },
          { v: 'back', label: `Back ${z.back.w}×${z.back.h}` },
        ]}
      />
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-[3px] border-ink px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-door">
        <span className="font-bold">Print on the {d.side}</span>
        <input type="checkbox" checked={p.on} onChange={(e) => setPlace(d.side, { on: e.target.checked })} className="size-5 accent-door" />
      </label>
      {p.on ? (
        <>
          {files.length > 1 ? (
            <div>
              <p className="label mb-1.5">Artwork for the {d.side}</p>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={p.file === i}
                    aria-label={`Use ${f.file.name}`}
                    onClick={() => {
                      setPlace(d.side, { file: i })
                      onSlam()
                    }}
                    className={cn('focus-ring size-14 overflow-hidden border-[3px] bg-tone-1', p.file === i ? 'border-door shadow-hard-sm' : 'border-ink')}
                  >
                    {f.type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview
                      <img src={f.url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="grid h-full place-items-center bg-paper font-display text-ink">PDF</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Range id="forge-scale" label="Size" value={Math.round(p.scale * 100)} min={20} max={100} step={1} onChange={(v) => setPlace(d.side, { scale: v / 100 })} format={(v) => `${v}%`} />
          <Range id="forge-rotate" label="Rotate" value={Math.round(p.rotate)} min={-45} max={45} step={1} onChange={(v) => setPlace(d.side, { rotate: v })} format={(v) => `${v}°`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPlace(d.side, { x: 0.5, y: 0.5 })} className="label focus-ring press min-h-11 border-[3px] border-ink px-3 font-bold">
              Centre
            </button>
            <button type="button" onClick={() => setPlace(d.side, { ...DEFAULT_PLACE[d.side], on: true, file: p.file })} className="label focus-ring press min-h-11 border-[3px] border-ink px-3 font-bold">
              Reset
            </button>
            <button type="button" onClick={onSlam} className="label focus-ring press min-h-11 border-[3px] border-ink bg-ink px-3 font-bold text-volt">
              Slam it again
            </button>
          </div>
        </>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 border-[3px] border-ink p-3 has-[:checked]:bg-volt has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-door">
        <input type="checkbox" checked={d.halfHalf} onChange={(e) => update({ halfHalf: e.target.checked })} className="mt-1 size-5 shrink-0 accent-door" />
        <span>
          <span className="flex flex-wrap items-baseline gap-2 font-bold">
            Half-n-half print <span className="font-mono text-[12px]">+{formatINR(data.apparel.halfHalfFee)} each</span>
          </span>
          <span className="block text-[13px] leading-snug opacity-80">A split design on one garment. Describe the split in your notes — we confirm the layout on WhatsApp before printing.</span>
        </span>
      </label>

      <Stepper id="forge-qty" label="Pieces" value={Math.max(1, d.qty)} min={1} max={500} onChange={(v) => update({ qty: v })} help="Sizes and mixes go in your notes on the next step." />
    </div>
  )
}

function StepCount({ d, data, update }: { d: ForgeDraft; data: ForgeData; update: (p: Partial<ForgeDraft>) => void }) {
  const min = minQty(d.kind, data)
  const qty = Math.max(min, d.qty)
  const quick = [min, min * 2, min * 5].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3 border-[3px] border-ink bg-volt p-3">
        <span className="font-display text-6xl leading-[0.8]">{min}</span>
        <span className="pb-1 text-[14px] font-bold leading-tight">
          pieces minimum
          <span className="block font-normal">Same design or all different.</span>
        </span>
      </div>
      <Stepper id="forge-qty" label="Pieces" value={qty} min={min} max={10000} onChange={(v) => update({ qty: v })} help={`Can't go below ${min} — that's the custom minimum.`} />
      <div>
        <p className="label mb-1.5">Quick pick</p>
        <div className="flex flex-wrap gap-2">
          {quick.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={qty === v}
              onClick={() => update({ qty: v })}
              className={cn('focus-ring press min-h-11 border-[3px] border-ink px-4 font-mono font-bold', qty === v ? 'bg-ink text-volt' : 'bg-paper')}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ id, label, error, children, optional }: { id: string; label: string; error?: string; children: ReactNode; optional?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 flex justify-between">
        <span>{label}</span>
        {optional ? <span className="opacity-60">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-[13px] font-bold text-hype [text-shadow:0_0_0_#0B0B0F]">
          <span className="bg-ink px-1 text-paper">!</span> {error}
        </p>
      ) : null}
    </div>
  )
}

const inputCls = (err?: string) =>
  cn('focus-ring w-full border-[3px] bg-paper px-3 text-[16px] placeholder:text-ink/40', err ? 'border-hype' : 'border-ink')

function StepSend({
  d,
  update,
  errors,
  setErrors,
  onSubmit,
  busy,
  phase,
  progress,
  files,
}: {
  d: ForgeDraft
  update: (p: Partial<ForgeDraft>) => void
  errors: ContactErrors
  setErrors: (e: ContactErrors) => void
  onSubmit: (e?: React.FormEvent) => void
  busy: boolean
  phase: Phase
  progress: number
  files: number
}) {
  const check = (k: keyof ContactErrors, v: string) => {
    const shape = ContactSchema.shape[k]
    const r = shape.safeParse(v)
    setErrors({ ...errors, [k]: r.success ? undefined : r.error.issues[0]?.message })
  }
  const label =
    phase === 'uploading'
      ? `Uploading${files > 1 ? ` ${files} files` : ''} · ${Math.round(progress * 100)}%`
      : phase === 'saving'
        ? 'Saving your request…'
        : phase === 'opening'
          ? 'Opening WhatsApp…'
          : 'Send to WhatsApp'
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4" aria-busy={busy}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="forge-name" label="Name" error={errors.name}>
          <input
            id="forge-name"
            autoComplete="name"
            value={d.name}
            onChange={(e) => update({ name: e.target.value })}
            onBlur={(e) => e.target.value && check('name', e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'forge-name-err' : undefined}
            className={cn(inputCls(errors.name), 'min-h-12')}
          />
        </Field>
        <Field id="forge-city" label="City" error={errors.city}>
          <input
            id="forge-city"
            autoComplete="address-level2"
            value={d.city}
            onChange={(e) => update({ city: e.target.value })}
            onBlur={(e) => e.target.value && check('city', e.target.value)}
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? 'forge-city-err' : undefined}
            className={cn(inputCls(errors.city), 'min-h-12')}
          />
        </Field>
      </div>
      <Field id="forge-phone" label="WhatsApp number" optional error={errors.phone}>
        <input
          id="forge-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={d.phone}
          onChange={(e) => update({ phone: e.target.value })}
          onBlur={(e) => check('phone', e.target.value)}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'forge-phone-err' : undefined}
          className={cn(inputCls(errors.phone), 'min-h-12')}
        />
      </Field>
      <Field id="forge-notes" label="Notes" optional error={errors.notes}>
        <textarea
          id="forge-notes"
          rows={3}
          maxLength={600}
          value={d.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Sizes, colours, a deadline, how to split a half-n-half…"
          className={cn(inputCls(errors.notes), 'resize-y py-2')}
        />
      </Field>
      {/* honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="forge-company">Company</label>
        <input id="forge-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="text-[13px] leading-snug opacity-80">
        We use these details only to reply to this request. Read our{' '}
        <Link href="/policies/privacy" className="font-bold underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
      <button
        type="submit"
        disabled={busy}
        data-cursor="SEND"
        className="focus-ring press relative flex min-h-14 w-full items-center justify-center overflow-hidden border-[3px] border-ink bg-ink px-5 text-paper shadow-hard-volt disabled:cursor-wait"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-door transition-[width] duration-200"
          style={{ width: busy ? `${phase === 'uploading' ? Math.max(6, progress * 70) : phase === 'saving' ? 85 : 100}%` : '0%' }}
        />
        <span className="relative flex items-center gap-3">
          <WaGlyph className="size-6 text-volt" />
          <span className="font-display text-2xl uppercase leading-none">{label}</span>
        </span>
      </button>
      <p aria-live="polite" className="sr-only">
        {busy ? label : ''}
      </p>
      <p className="text-center text-[12px] opacity-70">Opens WhatsApp with your full request typed out. Nothing is charged here.</p>
    </form>
  )
}

function WaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.66 15l-1.3 4.76 4.88-1.28A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-2.9.76.78-2.83-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.77 4.77 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.69c1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}

// ================================================================== success (#71, small)
function Success({
  d,
  data,
  quote,
  result,
  onAgain,
  reduced,
}: {
  d: ForgeDraft
  data: ForgeData
  quote: ReturnType<typeof quoteFor>
  result: { link: string; opened: boolean; pending: number; stored: boolean }
  onAgain: () => void
  reduced: boolean
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const qty = Math.max(quote.minQty, d.qty)
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 22 }}
        className="relative overflow-hidden border-4 border-ink bg-volt p-6 text-ink shadow-hard sm:p-10 lg:col-span-7"
      >
        <div aria-hidden="true" className="screentone screentone-mid pointer-events-none absolute inset-0" style={{ ['--tone-opacity' as string]: 0.12 }} />
        <span aria-hidden="true" className="absolute -right-2 top-4 sm:right-6">
          <Sfx text="ドン!" size="lg" tone="paper" rotate={8} pop={!reduced} />
        </span>
        <p className="label">Request sent · 送信完了</p>
        <h3 ref={heading} tabIndex={-1} className="h-display mt-3 max-w-[11ch] text-[clamp(48px,8vw,104px)] outline-none">
          Forged. See you on WhatsApp.
        </h3>
        <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed">
          {result.opened ? 'WhatsApp opened in a new tab with your request typed out — hit send there.' : 'Tap the button below to open WhatsApp with your request typed out, then hit send.'}{' '}
          {result.pending > 0 ? `Attach your ${result.pending === 1 ? 'file' : `${result.pending} files`} in that chat — we couldn't upload ${result.pending === 1 ? 'it' : 'them'} here.` : ''}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            className="label focus-ring press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-5 font-bold text-paper shadow-hard-paper"
          >
            <WaGlyph className="size-5 text-volt" /> {result.opened ? "Didn't open? Tap here" : 'Open WhatsApp'}
          </a>
          <button type="button" onClick={onAgain} className="label focus-ring press min-h-12 border-[3px] border-ink bg-paper px-5 font-bold">
            Forge another
          </button>
          <Link href="/shop" className="label focus-ring press inline-flex min-h-12 items-center border-[3px] border-ink px-5 font-bold">
            Browse the shop
          </Link>
        </div>
        <div className="pointer-events-none absolute -bottom-4 right-2 hidden sm:block">
          <Mascot mood="cheer" size={150} animate={!reduced} title="" />
        </div>
      </motion.div>

      {/* ticket stub */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0.15 } : { delay: 0.18, type: 'spring', stiffness: 300, damping: 26 }}
        className="relative border-4 border-ink bg-paper p-5 font-mono text-[13px] text-ink shadow-hard lg:col-span-5"
      >
        <p className="label border-b-2 border-dashed border-ink pb-2">Forge ticket</p>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-3">
            <dt>Product</dt>
            <dd className="text-right font-bold">{garmentLabel(d, data)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Pieces</dt>
            <dd className="font-bold">{qty}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Design</dt>
            <dd className="text-right font-bold">{d.mode === 'company' ? 'We draw it' : 'Your art'}</dd>
          </div>
          {isApparel(d.kind) ? (
            <div className="flex justify-between gap-3">
              <dt>Print</dt>
              <dd className="text-right font-bold">{(['front', 'back'] as Side[]).filter((s) => d.place[s].on).join(' + ') || '—'}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 border-t-4 border-ink pt-2 text-[15px]">
            <dt>Estimate</dt>
            <dd className="font-bold">{quote.total == null ? 'On request' : `${formatINR(quote.total)}${quote.plus ? ` ${quote.plus}` : ''}`}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[12px] leading-snug opacity-75">We confirm the final price on WhatsApp before anything is printed.</p>
      </motion.div>
    </div>
  )
}

export default ForgeStudio
