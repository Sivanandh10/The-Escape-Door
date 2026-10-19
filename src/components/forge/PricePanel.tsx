'use client'
// Live price panel: mono breakdown lines + animated total (#17 counter). Owner: P3 forge.
import { useEffect, useRef, useState } from 'react'
import { formatINR } from '@/lib/pricing'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { ForgeQuote } from './model'

export function useCountUp(value: number | null, ms = 380): number | null {
  const [shown, setShown] = useState(value)
  const from = useRef(value ?? 0)
  useEffect(() => {
    if (value == null) {
      setShown(null)
      return
    }
    if (prefersReducedMotion()) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 4)
      const v = Math.round(a + (value - a) * e)
      from.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

export function TotalFigure({ quote, className }: { quote: ForgeQuote; className?: string }) {
  const n = useCountUp(quote.total)
  const final = quote.total == null ? 'On request' : `${formatINR(quote.total)}${quote.plus ? ` ${quote.plus}` : ''}`
  return (
    <>
      <span aria-hidden="true" className={cn('font-mono font-bold tabular-nums', className)}>
        {n == null ? 'On request' : formatINR(n)}
        {quote.plus && n != null ? <span className="ml-1 text-[0.5em] font-medium">{quote.plus}</span> : null}
      </span>
      <span className="sr-only">{final}</span>
    </>
  )
}

export function PricePanel({ quote, empty, className }: { quote: ForgeQuote; empty: boolean; className?: string }) {
  return (
    <section aria-label="Live price" className={cn('border-4 border-ink bg-paper text-ink shadow-hard', className)}>
      <header className="flex items-center justify-between border-b-4 border-ink bg-volt px-4 py-2">
        <p className="label font-bold">Live quote</p>
        <span lang="ja" aria-hidden="true" className="font-jp text-xs font-bold">
          見積もり
        </span>
      </header>
      {empty ? (
        <p className="px-4 py-5 text-sm">Pick a product and the numbers show up here, line by line.</p>
      ) : (
        <div className="px-4 py-3">
          <ul className="divide-y-2 divide-dashed divide-ink/25 font-mono text-[13px]">
            {quote.lines.map((l) => (
              <li key={l.label} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block font-bold">{l.label}</span>
                  {l.detail ? <span className="block text-ink/70">{l.detail}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums">{l.amount == null ? 'quote' : formatINR(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-end justify-between gap-3 border-t-4 border-ink pt-3">
            <span className="label">{quote.estimate ? 'Estimate' : 'Total'}</span>
            <TotalFigure quote={quote} className="text-3xl leading-none" />
          </div>
          <ul className="mt-3 space-y-1 text-[13px] leading-snug text-ink/75">
            {quote.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default PricePanel
