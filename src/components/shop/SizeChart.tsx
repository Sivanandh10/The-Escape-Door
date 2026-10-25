'use client'
// <SizeChart> — the "Size chart" link on tee / hoodie product pages (owner feedback #8) and its pop-up.
// Data: public.settings 'size_charts' (Admin → Pricing → Size charts), read from the browser only when the pop-up
// opens (settings has a public read policy), cached for the visit. The chart shown is the one for the fit the
// shopper picked (variant attrs.fit, or 'hoodie'). No chart for that fit yet → a friendly "Tell us your usual size on
// WhatsApp and we'll match the fit" with a pre-filled WhatsApp message — never "coming soon".
// Signature: inches ⇄ cm flip; the size the shopper already picked is marked in the table.
// Bottom sheet on phones, centred card on larger screens; focus trapped, Esc / backdrop / ✕ close, Lenis paused,
// reduced motion → plain fade.
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MessageCircle, Ruler, X } from 'lucide-react'
import type { Product, Variant } from '@/lib/types'
import { track } from '@/lib/analytics'
import { useReducedMotion } from '@/lib/motion'
import { waLink } from '@/lib/whatsapp'
import { useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { cn } from '@/lib/utils'
import {
  SIZE_CHARTS_KEY, SIZE_FITS, filledFits, fitFor, fitLabel, normalizeSizeCharts, toCm,
  type SizeCharts, type SizeFit,
} from './sizeChartData'

type Load = { state: 'loading' } | { state: 'ready'; charts: SizeCharts } | { state: 'error' }

let cache: Promise<SizeCharts> | null = null
function loadCharts(): Promise<SizeCharts> {
  if (!cache) {
    cache = (async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const sb = supabaseBrowser()
      if (!sb) return normalizeSizeCharts(null)
      const { data, error } = await sb.from('settings').select('value').eq('key', SIZE_CHARTS_KEY).maybeSingle()
      if (error) throw error
      return normalizeSizeCharts((data as { value?: unknown } | null)?.value)
    })().catch((e: unknown) => {
      cache = null // let the next open retry
      throw e
    })
  }
  return cache
}

const fmtIn = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''))

export interface SizeChartProps {
  product: Pick<Product, 'name' | 'type'>
  variant: Pick<Variant, 'attrs' | 'label'> | null
  /** size chip the shopper already picked (highlighted in the table) */
  size?: string | null
  className?: string
}

export function SizeChart({ product, variant, size, className }: SizeChartProps) {
  const [open, setOpen] = useState(false)
  const fit = fitFor(product.type, variant)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          track('size_chart_open', { product: product.name, fit: fit ?? 'unknown' })
        }}
        aria-haspopup="dialog"
        className={cn(
          'label inline-flex min-h-11 w-fit items-center gap-2 text-[0.6875rem] text-paper/80 underline decoration-2 underline-offset-4 hover:text-volt focus-ring',
          className,
        )}
      >
        <Ruler aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} /> Size chart
      </button>
      <SizeChartModal open={open} onClose={() => setOpen(false)} productName={product.name} variantLabel={variant?.label ?? ''} fit={fit} size={size ?? null} />
    </>
  )
}

function SizeChartModal({
  open, onClose, productName, variantLabel, fit, size,
}: { open: boolean; onClose: () => void; productName: string; variantLabel: string; fit: SizeFit | null; size: string | null }) {
  const reduced = useReducedMotion()
  const waNumber = useWhatsappNumber()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<Element | null>(null)
  const [mounted, setMounted] = useState(false)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [tab, setTab] = useState<SizeFit | null>(null)
  const [unit, setUnit] = useState<'in' | 'cm'>('in')
  const [nonce, setNonce] = useState(0)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client mount flag for the portal
  useEffect(() => setMounted(true), [])

  // fetch on open (cached for the visit)
  useEffect(() => {
    if (!open) return
    let alive = true
    loadCharts()
      .then((charts) => alive && setLoad({ state: 'ready', charts }))
      .catch(() => alive && setLoad({ state: 'error' }))
    return () => {
      alive = false
    }
  }, [open, nonce])

  // focus, scroll lock, Lenis
  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
    lenis?.stop()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus())
    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = prev
      lenis?.start()
      if (lastFocus.current instanceof HTMLElement && document.contains(lastFocus.current)) lastFocus.current.focus()
    }
  }, [open])

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!f.length) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const charts = load.state === 'ready' ? load.charts : null
  const filled = charts ? filledFits(charts) : []
  // the product's own fit when it has a chart; a tee with an unknown fit can browse every filled chart
  const choices: SizeFit[] = fit ? (filled.includes(fit) ? [fit] : []) : filled
  const active = tab && choices.includes(tab) ? tab : choices[0] ?? null
  const rows = active && charts ? charts.charts[active] ?? [] : []
  const hasShoulder = rows.some((r) => r.shoulder !== null)
  const pick = size?.toUpperCase() ?? null

  const fitText = fit ? fitLabel(fit).toLowerCase() : variantLabel ? variantLabel.toLowerCase() : ''
  const waText = `Hi Escape Door! I’m looking at “${productName}”${fitText ? ` (${fitText})` : ''}. ${
    pick ? `I usually wear ${pick}` : 'My usual size is ___'
  } — which size should I pick?`
  const wa = waLink(waText, waNumber)
  const v = (n: number | null) => (n === null ? '—' : unit === 'in' ? fmtIn(n) : String(toCm(n)))

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6" onKeyDown={onKey}>
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-lenis-prevent=""
            className="relative max-h-[90dvh] w-full max-w-[560px] overflow-y-auto overscroll-contain border-4 border-ink bg-paper text-ink shadow-[8px_8px_0_var(--color-volt)] grain sm:max-h-[86dvh]"
            initial={reduced ? { opacity: 0 } : { y: 48, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 32, opacity: 0, transition: { duration: 0.16 } }}
            transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 30 }}
          >
            {/* tape-measure edge */}
            <div
              aria-hidden="true"
              className="h-3.5 border-b-[3px] border-ink bg-volt"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, var(--color-ink) 0 2px, transparent 2px 12px), repeating-linear-gradient(90deg, var(--color-ink) 0 2px, transparent 2px 60px)',
                backgroundSize: '100% 45%, 100% 85%',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="label text-tone-2">Fit guide · <span lang="ja">サイズ表</span></p>
                  <h2 id={titleId} className="h-display mt-1 text-[clamp(34px,6vw,48px)] leading-[0.9]">
                    Size <em>chart</em>
                  </h2>
                  <p className="mt-2 text-[14px] text-tone-2">{productName}</p>
                </div>
                <button
                  type="button"
                  data-autofocus
                  onClick={onClose}
                  aria-label="Close size chart"
                  className="press focus-ring grid size-11 shrink-0 place-items-center border-[3px] border-ink bg-paper text-ink shadow-hard-sm"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>

              <div aria-live="polite" className="mt-5">
                {load.state === 'loading' && (
                  <div className="space-y-2" aria-label="Loading the size chart">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="h-9 animate-pulse bg-ink/10 motion-reduce:animate-none" />
                    ))}
                  </div>
                )}

                {load.state !== 'loading' && rows.length === 0 && (
                  <div className="border-[3px] border-ink bg-volt p-5 shadow-hard-sm">
                    <p className="font-display text-[clamp(26px,5vw,34px)] uppercase leading-[0.95]">
                      Tell us your usual size on WhatsApp and we’ll match the fit.
                    </p>
                    <p className="mt-3 text-[14.5px] leading-relaxed">
                      Measure a tee you love wearing — armpit to armpit, and from the top of the shoulder to the hem — and send us the
                      numbers or just your usual size. We reply with the size to pick before you order.
                    </p>
                    {load.state === 'error' && (
                      <button type="button" onClick={() => { setLoad({ state: 'loading' }); setNonce((n) => n + 1) }} className="focus-ring mt-3 text-[13px] font-semibold underline decoration-2 underline-offset-4">
                        Couldn’t load the chart — try again
                      </button>
                    )}
                  </div>
                )}

                {rows.length > 0 && active && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {choices.length > 1 ? (
                        <div role="tablist" aria-label="Fit" className="flex flex-wrap gap-2">
                          {choices.map((f) => (
                            <button
                              key={f}
                              type="button"
                              role="tab"
                              aria-selected={f === active}
                              onClick={() => setTab(f)}
                              className={cn(
                                'press focus-ring label min-h-11 border-[3px] border-ink px-3 text-[11px]',
                                f === active ? 'bg-ink text-paper' : 'bg-paper hover:bg-volt',
                              )}
                            >
                              {SIZE_FITS.find((x) => x.id === f)?.short}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="label text-[11px]">{fitLabel(active)}</p>
                      )}
                      {/* inches ⇄ cm */}
                      <div role="radiogroup" aria-label="Units" className="relative inline-grid grid-cols-2 border-[3px] border-ink">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-y-0 left-0 w-1/2 bg-ink transition-transform duration-200 ease-(--ease-punch) motion-reduce:transition-none',
                            unit === 'cm' && 'translate-x-full',
                          )}
                        />
                        {(['in', 'cm'] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            role="radio"
                            aria-checked={unit === u}
                            onClick={() => setUnit(u)}
                            className={cn('focus-ring relative z-[1] min-h-11 min-w-14 px-3 font-mono text-[13px] font-bold uppercase transition-colors duration-150', unit === u ? 'text-paper' : 'text-ink')}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto border-[3px] border-ink" data-lenis-prevent-horizontal>
                      <table className="w-full border-collapse text-left">
                        <caption className="sr-only">
                          {fitLabel(active)} measurements in {unit === 'in' ? 'inches' : 'centimetres'}
                        </caption>
                        <thead className="bg-ink text-paper">
                          <tr className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
                            <th scope="col" className="px-3 py-2.5">Size</th>
                            <th scope="col" className="px-3 py-2.5">Chest</th>
                            <th scope="col" className="px-3 py-2.5">Length</th>
                            {hasShoulder && <th scope="col" className="px-3 py-2.5">Shoulder</th>}
                          </tr>
                        </thead>
                        <motion.tbody key={unit} initial={reduced ? false : { opacity: 0.35, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                          {rows.map((r) => {
                            const mine = pick === r.size.toUpperCase()
                            return (
                              <tr key={r.size} className={cn('border-t-2 border-ink/15 font-mono text-[15px] tabular-nums', mine && 'bg-volt')}>
                                <th scope="row" className="px-3 py-2.5 text-left font-bold">
                                  {r.size}
                                  {mine && <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.1em]">your pick</span>}
                                </th>
                                <td className="px-3 py-2.5">{v(r.chest)}</td>
                                <td className="px-3 py-2.5">{v(r.length)}</td>
                                {hasShoulder && <td className="px-3 py-2.5">{v(r.shoulder)}</td>}
                              </tr>
                            )
                          })}
                        </motion.tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-tone-2">
                      Garment measurements, laid flat: chest all the way round, length from the top of the shoulder to the hem.
                      Compare with a tee you already like.{charts?.note ? ` ${charts.note}` : ''}
                    </p>
                  </>
                )}
              </div>

              {load.state !== 'loading' && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('whatsapp_click', { from: 'size_chart', product: productName })}
                  className="press focus-ring label mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 border-[3px] border-ink bg-ink px-4 py-3 text-paper shadow-hard-sm hover:bg-door sm:w-auto"
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  {rows.length ? 'Between sizes? Ask us on WhatsApp' : 'Ask on WhatsApp'}
                </a>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default SizeChart
