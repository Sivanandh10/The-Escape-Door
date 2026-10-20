'use client'
// Voucher code → POST /api/vouchers/validate (server re-prices the cart; the browser never decides a discount).
// Applied = a stamped coupon stub with the saving; Remove puts it back. Re-checks itself when the cart changes.
// Owner: CHECKOUT.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, TicketPercent, X } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { cartSignature, validateVoucher, type VoucherOk } from '@/lib/checkout/client'
import type { CartItem } from '@/lib/types'
import { FieldError, fieldCls } from './fields'

export type AppliedVoucher = Pick<VoucherOk, 'code' | 'discount' | 'headline' | 'description'>

export interface VoucherBoxProps {
  items: CartItem[]
  applied: AppliedVoucher | null
  onChange: (v: AppliedVoucher | null) => void
  /** e.g. when the server refused the voucher at "place order" */
  externalError?: string | null
  /** the login gate (validation needs a signed-in customer) */
  onNeedLogin?: () => void
  className?: string
}

export function VoucherBox({ items, applied, onChange, externalError, onNeedLogin, className }: VoucherBoxProps) {
  const id = useId()
  const reduced = useReducedMotion()
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'checking'>('idle')
  const [error, setError] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const sig = cartSignature(items)
  const lastSig = useRef(sig)

  const check = async (raw: string, quiet = false) => {
    const c = raw.trim().toUpperCase().replace(/\s+/g, '')
    if (!c) {
      setError('Type a voucher code first.')
      return
    }
    ctrl.current?.abort()
    const ac = new AbortController()
    ctrl.current = ac
    setState('checking')
    setError(null)
    const r = await validateVoucher(c, items, ac.signal)
    if (ac.signal.aborted) return
    setState('idle')
    if (r.ok) {
      onChange({ code: r.code, discount: r.discount, headline: r.headline, description: r.description })
      setCode('')
      return
    }
    if (r.error === 'aborted') return
    if (r.error === 'login') onNeedLogin?.()
    if (quiet && applied) onChange(null)
    setError(quiet ? `${c}: ${r.message}` : r.message)
  }

  // cart changed → the saving may have changed (or the voucher may no longer apply)
  useEffect(() => {
    if (sig === lastSig.current) return
    lastSig.current = sig
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-validate the applied code for the new cart
    if (applied) void check(applied.code, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  useEffect(() => () => ctrl.current?.abort(), [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (state === 'checking') return
    void check(code)
  }

  const shown = error ?? externalError ?? null

  return (
    <div className={cn('flex flex-col gap-3 text-ink', className)}>
      <AnimatePresence mode="wait" initial={false}>
        {applied ? (
          <motion.div
            key="applied"
            initial={reduced ? { opacity: 0 } : { scale: 0.7, rotate: -5, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, rotate: -1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { scale: 0.85, opacity: 0, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 20 }}
            className="relative flex items-stretch border-[3px] border-ink bg-volt shadow-hard-sm"
          >
            <span aria-hidden="true" className="grid w-14 shrink-0 place-items-center border-r-[3px] border-dashed border-ink">
              <TicketPercent className="size-7" />
            </span>
            <span className="min-w-0 flex-1 px-3 py-2.5">
              <span className="block font-mono text-[15px] font-bold tracking-[0.08em]">{applied.code}</span>
              <span className="block text-[13px] leading-snug">
                {applied.headline} · <strong>you save {formatINR(applied.discount)}</strong>
              </span>
              {applied.description && <span className="block text-[12px] text-tone-2">{applied.description}</span>}
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setError(null)
              }}
              aria-label={`Remove voucher ${applied.code}`}
              className="grid w-12 shrink-0 place-items-center border-l-[3px] border-ink bg-paper focus-ring can-hover:hover:bg-pink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-code`} className="label text-[11px]">
              Voucher code
            </label>
            <div className="flex gap-2">
              <input
                id={`${id}-code`}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  if (error) setError(null)
                }}
                placeholder="TED-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={32}
                aria-invalid={!!shown || undefined}
                aria-describedby={shown ? `${id}-err` : undefined}
                className={cn(fieldCls(shown ?? undefined), 'h-12 min-w-0 flex-1 font-mono uppercase tracking-[0.12em]')}
              />
              <button
                type="submit"
                disabled={state === 'checking'}
                className="press inline-flex min-h-12 shrink-0 items-center gap-2 border-[3px] border-ink bg-ink px-4 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-paper disabled:cursor-progress"
              >
                {state === 'checking' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                {state === 'checking' ? 'Checking' : 'Apply'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <FieldError id={`${id}-err`} error={shown ?? undefined} />
      <p role="status" aria-live="polite" className="sr-only">
        {state === 'checking' ? 'Checking your voucher.' : applied ? `Voucher ${applied.code} applied. You save ${formatINR(applied.discount)}.` : ''}
      </p>
    </div>
  )
}
