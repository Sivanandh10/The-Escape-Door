'use client'
// /admin/qr studio: pick a src + target path → tracked URL → framed on-brand QR (SVG/PNG download)
// + per-src attribution table from the analytics snapshot.
import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Check, Copy, Download, ImageDown, Loader2, QrCode } from 'lucide-react'
import { AdminPanel } from '../AdminPage'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { adminBtn, adminInput, adminLabel, adminPill } from '../ui'
import type { SrcRow } from '../analytics/types'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'

type Target = 'home' | 'shop' | 'custom' | 'arc'
const TARGETS: { id: Target; label: string; path: string }[] = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'shop', label: 'Shop', path: '/shop' },
  { id: 'custom', label: 'Custom', path: '/custom' },
  { id: 'arc', label: 'An arc', path: '/arc/' },
]
const NEW = '__new__'
const nf = new Intl.NumberFormat('en-IN')

export function slugifySrc(v: string) {
  return v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export function buildQrUrl(siteUrl: string, path: string, src: string) {
  const q = new URLSearchParams({ src, utm_source: 'qr', utm_medium: 'stall', utm_campaign: src })
  return `${siteUrl}${path}?${q.toString()}`
}

interface Props {
  siteUrl: string
  srcs: { src: string; label: string }[]
  arcs: { slug: string; name: string }[]
  rows: SrcRow[]
  demo: boolean
  error: string | null
  range: { from: string; to: string }
}

type QrState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; svg: string; url: string } | { status: 'error'; message: string }

export function QrStudio({ siteUrl, srcs, arcs, rows, demo, error, range }: Props) {
  const reduce = useReducedMotion()
  const [pick, setPick] = useState<string>(srcs[0]?.src ?? NEW)
  const [draft, setDraft] = useState('')
  const [target, setTarget] = useState<Target>('home')
  const [arc, setArc] = useState(arcs[0]?.slug ?? '')
  const [qr, setQr] = useState<QrState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<'svg' | 'png' | null>(null)
  const [nonce, setNonce] = useState(0)

  const src = pick === NEW ? slugifySrc(draft) : pick
  const label = srcs.find((s) => s.src === src)?.label
  const path = target === 'arc' ? (arc ? `/arc/${arc}` : '/') : TARGETS.find((t) => t.id === target)!.path
  const url = src ? buildQrUrl(siteUrl, path, src) : ''

  useEffect(() => {
    if (!url) { setQr({ status: 'idle' }); return }
    let live = true
    setQr({ status: 'loading' })
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#0b0b0f', light: '#f4efe6' } })
      .then((svg) => { if (live) setQr({ status: 'ready', svg, url }) })
      .catch((e: unknown) => { if (live) setQr({ status: 'error', message: e instanceof Error ? e.message : 'Could not draw the code' }) })
    return () => { live = false }
  }, [url, nonce])

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied', { description: url })
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Clipboard blocked — select the link and copy it by hand')
    }
  }

  function save(href: string, name: string) {
    const a = document.createElement('a')
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function download(kind: 'svg' | 'png') {
    if (qr.status !== 'ready') return
    setBusy(kind)
    try {
      const name = `escape-door-qr-${src}${target === 'home' ? '' : `-${path.replace(/\//g, '-').replace(/^-/, '')}`}`
      if (kind === 'svg') {
        const blobUrl = URL.createObjectURL(new Blob([qr.svg], { type: 'image/svg+xml' }))
        save(blobUrl, `${name}.svg`)
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
      } else {
        const dataUrl = await QRCode.toDataURL(qr.url, { errorCorrectionLevel: 'M', width: 1024, margin: 2, color: { dark: '#0b0b0f', light: '#f4efe6' } })
        save(dataUrl, `${name}.png`)
      }
      toast.success(`${kind.toUpperCase()} saved`, { description: `${src} → ${path}` })
    } catch (e) {
      toast.error(`${kind.toUpperCase()} failed`, { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  // known srcs with zero traffic still get a row, so every stall is visible
  const tableRows = useMemo(() => {
    const m = new Map(rows.map((r) => [r.src, r]))
    for (const s of srcs) if (!m.has(s.src)) m.set(s.src, { src: s.src, visits: 0, uniques: 0, leads: 0, orders: 0, revenue: 0 })
    return [...m.values()]
  }, [rows, srcs])
  const labelOf = useMemo(() => new Map(srcs.map((s) => [s.src, s.label])), [srcs])

  const cols: DataTableColumn<SrcRow>[] = [
    {
      id: 'src', header: 'src', sortValue: (r) => r.src,
      cell: (r) => (
        <span className="flex flex-col">
          <span className={cn('font-mono font-bold', r.src === src ? 'text-volt' : 'text-paper')}>{r.src}{r.src === src && <span className="sr-only"> (selected)</span>}</span>
          {labelOf.get(r.src) && <span className="text-[12px] text-paper/55">{labelOf.get(r.src)}</span>}
        </span>
      ),
    },
    { id: 'visits', header: 'Visits', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.visits)}</span>, sortValue: (r) => r.visits },
    { id: 'uniques', header: 'Uniques', align: 'right', hideOnMobile: true, cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.uniques)}</span>, sortValue: (r) => r.uniques },
    { id: 'leads', header: 'Leads', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.leads)}</span>, sortValue: (r) => r.leads },
    { id: 'orders', header: 'Orders', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.orders)}</span>, sortValue: (r) => r.orders },
    { id: 'revenue', header: 'Revenue (est.)', align: 'right', hideOnMobile: true, cell: (r) => <span className="font-mono font-bold tabular-nums">{formatINR(r.revenue)}</span>, sortValue: (r) => r.revenue },
  ]

  const big = src.replace(/-/g, ' ')

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* ── controls */}
        <AdminPanel id="qr-build" index={0} title="Build the link" jp="リンク">
          <div className="space-y-6">
            <fieldset>
              <legend className={adminLabel}>1 · Who is it for (src)</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Source">
                {srcs.map((s) => (
                  <button key={s.src} type="button" role="radio" aria-checked={pick === s.src} title={s.label} onClick={() => setPick(s.src)}
                    className={cn('min-h-11 border-2 px-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-[transform,background-color,color] duration-150 focus-ring active:translate-y-px',
                      pick === s.src ? 'border-volt bg-volt text-ink shadow-[3px_3px_0_0_var(--color-door)]' : 'border-paper/25 text-paper/80 can-hover:hover:border-paper/60 can-hover:hover:text-paper')}>
                    {s.src}
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={pick === NEW} onClick={() => setPick(NEW)}
                  className={cn('min-h-11 border-2 border-dashed px-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors duration-150 focus-ring',
                    pick === NEW ? 'border-lav bg-lav text-ink' : 'border-paper/30 text-paper/70 can-hover:hover:text-paper')}>
                  + New src
                </button>
              </div>
              {pick === NEW && (
                <div className="mt-3">
                  <label htmlFor="qr-new" className={adminLabel}>Fest or stall name</label>
                  <input id="qr-new" autoFocus className={adminInput} value={draft} placeholder="e.g. Mood Indigo 2026" onChange={(e) => setDraft(e.target.value)}
                    aria-invalid={draft.length > 0 && !src} aria-describedby="qr-new-hint" />
                  <p id="qr-new-hint" className="mt-1.5 font-mono text-[11.5px] text-paper/60">
                    {draft && !src ? 'Needs at least one letter or number.' : <>src → <span className="text-volt">{src || '…'}</span></>}
                  </p>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className={adminLabel}>2 · Where the scan lands</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Target page">
                {TARGETS.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={target === t.id} onClick={() => setTarget(t.id)}
                    className={cn('flex min-h-14 flex-col items-start justify-center border-2 px-3 text-left transition-colors duration-150 focus-ring',
                      target === t.id ? 'border-paper bg-paper text-ink' : 'border-paper/25 text-paper/80 can-hover:hover:border-paper/60')}>
                    <span className="text-[14px] font-bold">{t.label}</span>
                    <span className="font-mono text-[11px] opacity-70">{t.path}{t.id === 'arc' ? '…' : ''}</span>
                  </button>
                ))}
              </div>
              {target === 'arc' && (
                <div className="mt-3">
                  <label htmlFor="qr-arc" className={adminLabel}>Arc</label>
                  {arcs.length ? (
                    <select id="qr-arc" className={adminInput} value={arc} onChange={(e) => setArc(e.target.value)}>
                      {arcs.map((a) => <option key={a.slug} value={a.slug}>{a.name} — /arc/{a.slug}</option>)}
                    </select>
                  ) : <p className="font-mono text-[12px] text-paper/60">No arcs yet — falls back to the home page.</p>}
                </div>
              )}
            </fieldset>

            <div>
              <p className={adminLabel}>3 · The tracked link</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <output aria-live="polite" className="min-h-11 flex-1 break-all border-2 border-paper/20 bg-tone-1 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-paper/90">
                  {url || <span className="text-paper/45">Pick or name a src to build the link.</span>}
                </output>
                <button type="button" onClick={copy} disabled={!url} className={adminBtn({ variant: copied ? 'door' : 'primary', className: 'min-w-[132px] shrink-0' })}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={copied ? 'y' : 'n'} className="inline-flex items-center gap-2"
                      initial={reduce ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: -8, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 32 }}>
                      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                      {copied ? 'Copied' : 'Copy link'}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
            </div>
          </div>
        </AdminPanel>

        {/* ── preview */}
        <AdminPanel id="qr-preview" index={1} title="Stall card" jp="プレビュー" shadow="volt">
          {!src ? (
            <EmptyState mood="work" compact title="Name the stall first" body="Choose a fest from the list or type a new src — Kado draws the code as soon as there is one." />
          ) : qr.status === 'error' ? (
            <ErrorState title="The code didn’t draw" message={qr.message} onRetry={() => setNonce((n) => n + 1)} />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.figure
                  key={url}
                  aria-label={`QR code for ${url}`}
                  className="relative mx-auto w-full max-w-[380px] border-[6px] border-ink bg-paper p-5 text-ink shadow-[8px_8px_0_0_var(--color-door)] outline-2 outline-paper/0"
                  initial={reduce ? false : { clipPath: 'inset(0 0 100% 0)', y: -6 }}
                  animate={{ clipPath: 'inset(0 0 0% 0)', y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                >
                  <div className="flex items-center justify-between border-b-[3px] border-ink pb-2">
                    <span className="font-display text-[15px] uppercase tracking-[0.18em]">The Escape Door</span>
                    <span className="font-jp text-[11px] font-bold">扉</span>
                  </div>
                  <p className="mt-3 break-words font-display text-[clamp(40px,11vw,64px)] uppercase leading-[0.86] tracking-[-0.01em]">{big}</p>
                  {label && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink/60">{label}</p>}
                  <div className="relative mt-4 aspect-square w-full border-[3px] border-ink bg-paper p-3">
                    {qr.status === 'ready' ? (
                      <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
                    ) : (
                      <div className="grid h-full w-full place-items-center" role="status">
                        <Loader2 className="motion-safe:animate-spin" size={28} aria-hidden />
                        <span className="sr-only">Drawing the code…</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 bg-ink px-3 py-2 text-paper">
                    <span className="font-sfx text-[20px] tracking-[0.04em]">Scan → pick your arc</span>
                    <QrCode size={18} className="text-volt" aria-hidden />
                  </div>
                  <figcaption className="mt-2 truncate font-mono text-[10.5px] text-ink/55">{path}?src={src}</figcaption>
                </motion.figure>
              </AnimatePresence>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => download('svg')} disabled={qr.status !== 'ready' || busy !== null} className={adminBtn({ variant: 'ghost' })}>
                  {busy === 'svg' ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden /> : <Download size={16} aria-hidden />} SVG
                </button>
                <button type="button" onClick={() => download('png')} disabled={qr.status !== 'ready' || busy !== null} className={adminBtn({ variant: 'ghost' })}>
                  {busy === 'png' ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden /> : <ImageDown size={16} aria-hidden />} PNG · 1024
                </button>
              </div>
              <p className="text-center font-mono text-[11px] text-paper/55">Error correction M · print at 3 cm or larger</p>
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        id="qr-srcs" index={2} title="What each QR brought in" jp="QR別" shadow="door"
        action={<span className={adminPill(demo ? 'hype' : 'muted')}>{demo ? 'Demo data · not real' : `Last 90 days · ${range.from.slice(0, 10)} → ${range.to.slice(0, 10)}`}</span>}
      >
        {error ? (
          <ErrorState title="Attribution didn’t load" message={`Supabase said: ${error}`} onRetry={() => location.reload()} />
        ) : tableRows.length === 0 ? (
          <EmptyState mood="work" title="No fest QRs yet" body="Build a link above and print it for the next stall. Scans show up here with their visits, leads and orders." />
        ) : (
          <DataTable
            caption="Attribution by src"
            rows={tableRows}
            rowKey={(r) => r.src}
            columns={cols}
            selectedKey={src || undefined}
            onRowClick={(r) => setPick(r.src)}
            initialSort={{ id: 'visits', dir: 'desc' }}
            search={{ placeholder: 'Find a src…', text: (r) => `${r.src} ${labelOf.get(r.src) ?? ''}` }}
            pageSize={15}
            dense
          />
        )}
        <p className="mt-3 font-mono text-[11px] text-paper/55">Tap a row to load that src into the builder. Revenue is an estimate from WhatsApp order messages.</p>
      </AdminPanel>
    </>
  )
}
