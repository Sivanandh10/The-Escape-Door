'use client'
// One cart line: thumb, name, variant/size, unit price, qty stepper, line total (+ bundle saving),
// remove with the #69 shred (strips fall) → removeWithUndo toast. Owner: P2.
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { formatINR, formatINRRange, parseRange } from '@/lib/pricing'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { CartItem } from '@/lib/types'
import { detailBits, removeWithUndo } from './order'
import { Rupees, Thumb } from './bits'

type Line = CartItem & { lineTotal: number | null; saving: number }

const STRIPS = 7
const EXIT = [0.7, 0, 0.84, 0] as const

/** #69: the row is sliced into vertical strips that drop and tumble out (≈ 420 ms). */
function Shredded({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" inert className="pointer-events-none absolute inset-0 z-10">
      {Array.from({ length: STRIPS }, (_, i) => {
        const w = 100 / STRIPS
        return (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ clipPath: `inset(-2px ${100 - (i + 1) * w}% -2px ${i * w}%)` }}
            initial={{ y: 0, rotate: 0, opacity: 1 }}
            animate={{ y: 70 + (i % 3) * 22, rotate: (i % 2 ? 1 : -1) * (4 + (i % 3) * 3), opacity: 0 }}
            transition={{ duration: 0.38, delay: 0.02 + ((i * 3) % STRIPS) * 0.028, ease: EXIT }}
          >
            {children}
          </motion.div>
        )
      })}
      {/* shredder teeth */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-2 bg-ink [mask:linear-gradient(135deg,#000_50%,transparent_50%)_0_0/10px_8px_repeat-x]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.12 }}
      />
    </div>
  )
}

export function CartLine({ line, compact = false, onNavigate }: { line: Line; compact?: boolean; onNavigate?: () => void }) {
  const setQty = useCart((s) => s.setQty)
  const reduced = useReducedMotion()
  const [shredding, setShredding] = useState(false)
  const bits = detailBits(line)
  const range = line.unitPrice == null ? parseRange(line.variantAttrs?.range) : null
  const gross = line.unitPrice != null ? line.unitPrice * line.qty : null
  const label = `${line.name}${bits.length ? `, ${bits.join(', ')}` : ''}`

  const remove = () => {
    if (shredding) return
    if (reduced) return removeWithUndo(line)
    setShredding(true)
    window.setTimeout(() => removeWithUndo(line), 430)
  }

  const body = (
    <div className={cn('flex gap-3 p-3', compact ? 'sm:gap-3' : 'sm:gap-4 sm:p-4')}>
      <Link href={`/product/${line.slug}`} onClick={onNavigate} tabIndex={-1} aria-hidden="true" className="block">
        <Thumb src={line.image} className={compact ? 'w-[72px]' : 'w-[72px] sm:w-[96px]'} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/product/${line.slug}`}
              onClick={onNavigate}
              className="focus-ring line-clamp-2 text-[15px] font-bold leading-snug decoration-[3px] underline-offset-2 can-hover:hover:underline"
            >
              {line.name}
            </Link>
            {bits.length > 0 && <p className="label mt-1 text-[10.5px] text-tone-3">{bits.join(' · ')}</p>}
            <p className="mt-1 font-mono text-[12px] text-tone-2">
              {line.unitPrice != null ? (
                <>{formatINR(line.unitPrice)} each</>
              ) : (
                <>{range ? `${formatINRRange(range[0], range[1])} · ` : ''}price on request</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={shredding}
            aria-label={`Remove ${label}`}
            className="press -mr-1.5 -mt-1.5 grid size-11 shrink-0 place-items-center text-ink/70 transition-colors can-hover:hover:bg-ink can-hover:hover:text-paper"
          >
            <Trash2 aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="flex items-stretch border-[3px] border-ink bg-paper" role="group" aria-label={`Quantity for ${line.name}`}>
            <button
              type="button"
              onClick={() => setQty(line.key, line.qty - 1)}
              disabled={line.qty <= 1}
              aria-label="One less"
              className="grid size-10 place-items-center transition-colors disabled:text-ink/25 can-hover:enabled:hover:bg-volt"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <output
              aria-live="polite"
              aria-label={`Quantity ${line.qty}`}
              className="relative grid w-9 place-items-center overflow-hidden border-x-[3px] border-ink font-mono text-[15px] font-bold"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={line.qty}
                  initial={{ y: -14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 14, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  {line.qty}
                </motion.span>
              </AnimatePresence>
            </output>
            <button
              type="button"
              onClick={() => setQty(line.key, line.qty + 1)}
              disabled={line.qty >= 99}
              aria-label="One more"
              className="grid size-10 place-items-center transition-colors disabled:text-ink/25 can-hover:enabled:hover:bg-volt"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>

          <div className="text-right font-mono leading-tight">
            {line.lineTotal == null ? (
              <span className="inline-block -rotate-2 border-2 border-ink bg-lav px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                Quote on WhatsApp
              </span>
            ) : (
              <>
                {line.saving > 0 && gross != null && (
                  <s className="block text-[12px] text-tone-3 decoration-hype decoration-2">{formatINR(gross)}</s>
                )}
                <Rupees value={line.lineTotal} className="text-[17px] font-bold" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <motion.li
      layout={reduced ? false : 'position'}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2, ease: EXIT } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="relative"
    >
      <div className={cn('relative border-[3px] border-ink bg-paper text-ink', shredding && 'invisible')}>
        {body}
        {line.saving > 0 && (
          <span className="absolute -left-[3px] -top-3 rotate-[-3deg] border-2 border-ink bg-volt px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-wider">
            Deal −{formatINR(line.saving)}
          </span>
        )}
      </div>
      {shredding && (
        <Shredded>
          <div className="border-[3px] border-ink bg-paper text-ink">{body}</div>
        </Shredded>
      )}
    </motion.li>
  )
}
