'use client'
// KPI card with #17 animated counter (P4a). Counts up once when it scrolls into view; reduced motion = final value.
//   <StatCard label="Visits" jp="訪問" value={1234} delta={0.12} tone="volt" icon={<Eye className="size-4" />} />
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

export type StatFormat = 'int' | 'inr' | 'pct' | 'compact'
export type StatTone = 'ink' | 'volt' | 'lav' | 'pink' | 'door'

export interface StatCardProps {
  label: string
  /** null = unknown → shows an em dash */
  value: number | null
  /** int "1,234" · inr "₹1,234" · pct (value is 0..1) "12.5%" · compact "12.4K" */
  format?: StatFormat
  jp?: string
  /** change vs previous period as a fraction (0.12 = +12%). null/undefined hides the chip. */
  delta?: number | null
  /** small line under the value (e.g. "estimate · sum of WhatsApp orders") */
  hint?: ReactNode
  tone?: StatTone
  /** a lucide icon element, e.g. <Eye className="size-4" /> */
  icon?: ReactNode
  /** stagger index for the entrance */
  index?: number
  className?: string
}

const TONE: Record<StatTone, string> = {
  ink: 'bg-tone-1 text-paper border-paper/15',
  volt: 'bg-volt text-ink border-ink',
  lav: 'bg-lav text-ink border-ink',
  pink: 'bg-pink text-ink border-ink',
  door: 'bg-door text-paper border-ink',
}

const nf = new Intl.NumberFormat('en-IN')
const cf = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

export function formatStat(v: number, format: StatFormat = 'int'): string {
  switch (format) {
    case 'inr':
      return formatINR(Math.round(v))
    case 'pct':
      return `${(v * 100).toFixed(v * 100 >= 10 ? 1 : 2).replace(/\.0+$/, '')}%`
    case 'compact':
      return cf.format(v)
    default:
      return nf.format(Math.round(v))
  }
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function StatCard({ label, value, format = 'int', jp, delta, hint, tone = 'ink', icon, index = 0, className }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<number | null>(value)

  useIsoLayoutEffect(() => {
    if (value == null) { setShown(null); return }
    if (prefersReducedMotion()) { setShown(value); return }
    const el = ref.current
    if (!el) return
    setShown(0)
    let raf = 0
    const run = () => {
      const t0 = performance.now()
      const dur = 1100 + Math.min(index, 6) * 90
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur)
        const e = 1 - Math.pow(2, -10 * p) // expo.out
        setShown(p >= 1 ? value : value * e)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) { io.disconnect(); run() }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value, index])

  const light = tone !== 'ink' && tone !== 'door'
  const up = (delta ?? 0) >= 0

  return (
    <div
      ref={ref}
      className={cn('admin-rise relative flex min-h-[132px] flex-col justify-between overflow-hidden border-2 p-4', TONE[tone], className)}
      style={{ ['--d' as string]: `${Math.min(index, 8) * 70}ms` }}
    >
      {/* corner screentone flap */}
      <span
        aria-hidden="true"
        className={cn('tone-bg pointer-events-none absolute -right-px -top-px size-10 [clip-path:polygon(0_0,100%_0,100%_100%)] [--tone-step:5px]', light ? '[--tone-color:var(--color-ink)] opacity-30' : '[--tone-color:var(--color-paper)] opacity-20')}
      />
      <div className="flex items-center gap-2">
        {icon && <span className={cn('shrink-0', light ? 'text-ink/70' : 'text-paper/60')} aria-hidden="true">{icon}</span>}
        <p className={cn('label text-[10.5px]', light ? 'text-ink/75' : 'text-paper/65')}>{label}</p>
        {jp && <span lang="ja" className={cn('ml-auto font-jp text-[10px] font-bold', light ? 'text-ink/45' : 'text-paper/35')}>{jp}</span>}
      </div>
      <p className="mt-3 font-mono text-[clamp(28px,3.1vw,40px)] font-bold leading-none tabular-nums tracking-[-0.03em]" aria-live="off">
        <span className="sr-only">{value == null ? 'unknown' : formatStat(value, format)}</span>
        <span aria-hidden="true">{shown == null ? '—' : formatStat(shown, format)}</span>
      </p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2">
        {delta != null && Number.isFinite(delta) && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 border px-1.5 font-mono text-[11px] font-bold tabular-nums',
              light ? 'border-ink bg-ink text-paper' : up ? 'border-volt text-volt' : 'border-hype text-hype',
            )}
          >
            {up ? <ArrowUp aria-hidden="true" className="size-3" /> : <ArrowDown aria-hidden="true" className="size-3" />}
            {Math.abs(delta * 100).toFixed(Math.abs(delta) >= 0.1 ? 0 : 1)}%
            <span className="sr-only"> {up ? 'up' : 'down'} vs previous period</span>
          </span>
        )}
        {hint && <span className={cn('text-[11.5px] leading-tight', light ? 'text-ink/70' : 'text-paper/55')}>{hint}</span>}
      </div>
    </div>
  )
}
