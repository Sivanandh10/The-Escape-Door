'use client'
// Bundle savings stickers, nudges, and the subtotal/savings/total stack. Owner: P2.
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import type { CartTotals } from '@/lib/types'
import { Rupees } from './bits'

export function Deals({ totals, className }: { totals: CartTotals; className?: string }) {
  if (!totals.applied.length && !totals.hints.length) return null
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence initial={false}>
        {totals.applied.map((a) => (
          <motion.p
            key={a.ruleId}
            layout="position"
            initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="flex items-center gap-2 border-[3px] border-ink bg-volt px-3 py-2 text-[13.5px] font-bold text-ink shadow-hard-sm"
          >
            <Sparkles aria-hidden="true" className="size-4 shrink-0" />
            <span className="flex-1">{a.label}</span>
            <span className="font-mono text-[12.5px]">you saved {formatINR(a.saving)}</span>
          </motion.p>
        ))}
        {totals.hints.map((h) => (
          <motion.p
            key={h}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="flex items-start gap-2 border-2 border-dashed border-ink/60 bg-paper px-3 py-2 text-[13px] leading-snug text-ink"
          >
            <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-door" />
            <span>{h}</span>
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function TotalsStack({ totals, size = 'md' }: { totals: CartTotals; size?: 'md' | 'lg' }) {
  const priced = totals.lines.some((l) => l.unitPrice != null)
  return (
    <dl className="font-mono text-[13.5px] text-ink">
      {priced && (
        <div className="flex justify-between py-1">
          <dt className="text-tone-2">Subtotal</dt>
          <dd><Rupees value={totals.subtotal} /></dd>
        </div>
      )}
      {totals.savings > 0 && (
        <div className="flex justify-between py-1">
          <dt className="text-tone-2">Bundle savings</dt>
          <dd className="font-bold text-door">−<Rupees value={totals.savings} /></dd>
        </div>
      )}
      <div className="mt-1 flex items-end justify-between gap-3 border-t-[3px] border-ink pt-2">
        <dt className="label text-[11px]">Total</dt>
        <dd className="text-right">
          {priced ? (
            <Rupees value={totals.total} className={cn('font-display tracking-wide', size === 'lg' ? 'text-[44px] leading-none' : 'text-[34px] leading-none')} />
          ) : (
            <span className="font-display text-[26px] uppercase leading-none">Quoted on WhatsApp</span>
          )}
          {priced && totals.hasPriceOnRequest && (
            <span className="mt-1 block text-[11px] text-tone-2">+ price-on-request items, quoted in chat</span>
          )}
        </dd>
      </div>
    </dl>
  )
}
