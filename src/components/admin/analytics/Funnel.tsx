'use client'
// Conversion funnel (P4a): stepped manga panels narrowing toward "Opened WhatsApp", step-to-step rate chips.
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { FunnelStep } from './types'

const nf = new Intl.NumberFormat('en-IN')
const TONES = ['bg-lav', 'bg-pink', 'bg-volt', 'bg-door text-paper']

export function Funnel({ steps }: { steps: FunnelStep[] }) {
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
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setOn(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const top = Math.max(steps[0]?.sessions ?? 0, 1)
  const end = steps[steps.length - 1]?.sessions ?? 0

  return (
    <div>
      <ol ref={ref} className="space-y-1.5">
        {steps.map((s, i) => {
          const pct = Math.max(s.sessions / top, 0.06)
          const prev = i > 0 ? steps[i - 1].sessions : null
          const rate = prev ? s.sessions / Math.max(prev, 1) : null
          return (
            <li key={s.id}>
              {rate != null && (
                <p className="mb-1 ml-2 font-mono text-[10.5px] text-paper/50">
                  ↓ <span className="font-bold text-paper/80">{(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%</span> continue
                </p>
              )}
              <div className="relative h-12 border-2 border-paper/10 bg-ink">
                <div
                  className={cn('absolute inset-y-0 left-0 origin-left border-r-4 border-ink text-ink transition-transform duration-[900ms] ease-(--ease-expo)', TONES[i % TONES.length])}
                  style={{ width: `${pct * 100}%`, transform: `scaleX(${on ? 1 : 0})`, transitionDelay: `${i * 110}ms` }}
                  aria-hidden="true"
                />
                <div className="relative flex h-full items-center justify-between gap-2 px-3">
                  <span className="truncate text-[13.5px] font-semibold mix-blend-difference text-paper">
                    {s.label} <span lang="ja" className="ml-1 font-jp text-[10px] opacity-70">{s.jp}</span>
                  </span>
                  <span className="font-mono text-[14px] font-bold tabular-nums mix-blend-difference text-paper">{nf.format(s.sessions)}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 border-t-2 border-paper/10 pt-3 text-[12.5px] text-paper/60">
        Overall: <span className="font-mono font-bold text-volt">{((end / top) * 100).toFixed(1)}%</span> of product viewers opened WhatsApp.
      </p>
    </div>
  )
}
