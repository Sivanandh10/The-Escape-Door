'use client'
// "Pack as a gift" — the ribbon ties itself when switched on (one small moment, 300 ms, none under reduced
// motion). Gift note, receiver name + phone, hide prices on the invoice. The wrap fee only appears when the
// admin set one (Admin → Vouchers → Checkout settings). Owner: CHECKOUT.
import { useId } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Gift } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { GiftOptions as Gift_ } from '@/lib/checkout/schema'
import { Switch, TextArea, TextInput } from './fields'

export interface GiftOptionsProps {
  value: Gift_
  onChange: (g: Gift_) => void
  fee: number
  errors?: Partial<Record<'receiverPhone' | 'note' | 'receiverName', string>>
  className?: string
}

export function GiftOptions({ value, onChange, fee, errors, className }: GiftOptionsProps) {
  const id = useId()
  const reduced = useReducedMotion()
  const set = (p: Partial<Gift_>) => onChange({ ...value, ...p })

  return (
    <div className={cn('flex flex-col gap-4 text-ink', className)}>
      <div className="flex items-start gap-4">
        <GiftBox on={value.enabled} reduced={reduced} />
        <Switch
          id={`${id}-gift`}
          checked={value.enabled}
          onChange={(enabled) => set({ enabled })}
          label={<>Pack it as a gift{fee > 0 && <span className="ml-2 font-mono text-[13px] font-medium text-tone-2">+{formatINR(fee)}</span>}</>}
          hint={fee > 0 ? 'Gift wrap, a handwritten-style note card, and no prices on the packing slip if you like.' : 'Gift wrap and a note card — free. Hide the prices on the packing slip if you like.'}
        />
      </div>

      <AnimatePresence initial={false}>
        {value.enabled && (
          <motion.div
            key="gift-fields"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.24 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-l-4 border-door pl-4 pt-1">
              <TextArea
                id={`${id}-note`}
                label="Gift note"
                hint="We print it on the note card. Up to 240 characters."
                maxLength={240}
                rows={3}
                placeholder="Happy birthday! Open the door…"
                value={value.note}
                error={errors?.note}
                onChange={(note) => set({ note })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput id={`${id}-rname`} label="Receiver’s name" hint="If it’s not the name on the address." autoComplete="off" value={value.receiverName} error={errors?.receiverName} onChange={(receiverName) => set({ receiverName })} />
                <TextInput id={`${id}-rphone`} label="Receiver’s mobile" type="tel" inputMode="tel" autoComplete="off" placeholder="98765 43210" hint="So the courier can reach them." value={value.receiverPhone} error={errors?.receiverPhone} onChange={(receiverPhone) => set({ receiverPhone })} />
              </div>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 self-start text-[14px] font-semibold">
                <input type="checkbox" checked={value.hidePrices} onChange={(e) => set({ hidePrices: e.target.checked })} className="size-5 accent-[var(--color-door)]" />
                Hide prices on the invoice / packing slip
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Tiny box whose ribbon ties when the gift switch turns on. */
function GiftBox({ on, reduced }: { on: boolean; reduced: boolean }) {
  return (
    <span aria-hidden="true" className={cn('relative grid size-14 shrink-0 place-items-center border-[3px] border-ink transition-colors duration-200', on ? 'bg-pink' : 'bg-paper')}>
      <Gift className={cn('size-7 transition-transform duration-300', on && !reduced && '-rotate-6 scale-110')} strokeWidth={2.2} />
      <AnimatePresence>
        {on && !reduced && (
          <motion.span
            key="pop"
            className="absolute -right-3 -top-3 border-2 border-ink bg-volt px-1 font-sfx text-[13px] leading-none"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 8 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          >
            ♥
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
