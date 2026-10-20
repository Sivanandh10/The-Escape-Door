'use client'
// Ranked bar list (P4a): manga "power bars" that charge in when visible. Lighter than a chart for top-N lists.
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/motion'
import type { Ranked } from './types'

const nf = new Intl.NumberFormat('en-IN')

export function BarList({
  items, tone = 'volt', unit, extraLabel, empty = 'Nothing tracked in this range yet.', mono, max: maxItems = 8,
}: {
  items: Ranked[]
  tone?: 'volt' | 'lav' | 'pink' | 'door'
  unit?: string
  /** label for `extra` (e.g. "adds") — rendered as a second mono figure */
  extraLabel?: string
  empty?: string
  /** monospace labels (paths, srcs) */
  mono?: boolean
  max?: number
}) {
  const ref = useRef<HTMLOListElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (prefersReducedMotion()) {
      // no animation: show the bars on the next frame (never a synchronous setState in the effect)
      const raf = requestAnimationFrame(() => setOn(true))
      return () => cancelAnimationFrame(raf)
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setOn(true); io.disconnect() } }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const list = items.slice(0, maxItems)
  if (!list.length) return <p className="py-6 text-center text-[13.5px] text-paper/50">{empty}</p>
  const max = Math.max(...list.map((i) => i.value), 1)
  const fill = { volt: 'bg-volt', lav: 'bg-lav', pink: 'bg-pink', door: 'bg-door' }[tone]

  return (
    <ol ref={ref} className="space-y-2.5">
      {list.map((it, i) => (
        <li key={it.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] tabular-nums text-paper/40">{String(i + 1).padStart(2, '0')}</span>
          <span className={cn('truncate text-[13.5px]', mono && 'font-mono text-[12.5px]')} title={it.label}>
            {it.label}
          </span>
          <span className="text-right font-mono text-[12.5px] font-bold tabular-nums">
            {nf.format(it.value)}
            {unit && <span className="ml-1 font-normal text-paper/45">{unit}</span>}
            {extraLabel && it.extra != null && (
              <span className="ml-2 font-normal text-paper/55">
                {nf.format(it.extra)} {extraLabel}
              </span>
            )}
          </span>
          <span className="col-span-2 col-start-2 block h-2.5 overflow-hidden border border-paper/15 bg-ink" aria-hidden="true">
            <span
              className={cn('block h-full origin-left transition-transform duration-[900ms] ease-(--ease-expo)', fill)}
              style={{ transform: `scaleX(${on ? it.value / max : 0})`, transitionDelay: `${i * 55}ms` }}
            />
          </span>
        </li>
      ))}
    </ol>
  )
}
