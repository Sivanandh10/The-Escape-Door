'use client'
// Footer "drop alerts" form → submitLead({ kind: 'newsletter' }). Owner: F1.
// States: idle · sending (screentone shimmer, < 100 ms feedback) · success (stamp slam) · error (ink-splat + retry).
import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { submitLead } from '@/lib/leads'
import { track } from '@/lib/analytics'
import { InkSplat } from '@/components/fx/InkSplat'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'sending' | 'done' | 'error'

export function NewsletterForm({ className }: { className?: string }) {
  const id = useId()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [value, setValue] = useState('')
  const honeypot = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const contact = value.trim()
    if (contact.length < 5) {
      setStatus('error')
      setError('Add a WhatsApp number or an email so we can reach you.')
      input.current?.focus()
      return
    }
    setStatus('sending')
    setError('')
    const res = await submitLead(
      { kind: 'newsletter', contact, payload: { from: 'footer' } },
      { honeypot: honeypot.current?.value ?? '' },
    )
    if (res.ok) {
      track('newsletter', { from: 'footer' })
      setStatus('done')
      return
    }
    setStatus('error')
    setError(
      res.fieldErrors?.contact?.[0] ??
        (res.error === 'rate-limited'
          ? 'Too many tries in a row. Give it a minute, then send again.'
          : 'That did not go through. Check your connection and send again.'),
    )
  }

  return (
    <div className={cn('relative', className)} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {status === 'done' ? (
          <motion.div
            key="done"
            initial={{ scale: 1.25, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -2, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="relative border-[3px] border-ink bg-volt p-4 text-ink shadow-hard"
          >
            <p className="font-display text-[34px] uppercase leading-[0.9]">You&apos;re on the list</p>
            <p className="mt-2 text-[15px]">New drops and fest stalls reach you first. No spam, ever.</p>
            <span aria-hidden="true" className="sfx font-sfx-jp absolute -right-3 -top-6 text-[40px]" style={{ ['--sfx-rot' as string]: '8deg' }}>
              ドン!
            </span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING}
          >
            <label htmlFor={`${id}-c`} className="label block text-ink">
              WhatsApp number or email
            </label>
            <div
              className={cn(
                'mt-2 flex border-[3px] border-ink bg-paper shadow-hard transition-shadow duration-200',
                status === 'error' && 'shadow-[6px_6px_0_0_var(--color-hype)]',
              )}
            >
              <input
                ref={input}
                id={`${id}-c`}
                name="contact"
                type="text"
                inputMode="email"
                autoComplete="email"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (status === 'error') setStatus('idle')
                }}
                placeholder="you@college.in"
                aria-invalid={status === 'error' || undefined}
                aria-describedby={status === 'error' ? `${id}-err` : `${id}-note`}
                className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-[16px] text-ink placeholder:text-tone-3 focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className={cn(
                  'press label relative flex min-h-12 shrink-0 items-center gap-2 overflow-hidden border-l-[3px] border-ink px-4 font-bold text-ink',
                  status === 'sending' ? 'skeleton-tone text-paper' : 'bg-volt hover:bg-volt-hot',
                )}
              >
                {status === 'sending' ? 'Sending…' : 'Notify me'}
                {status !== 'sending' && <ArrowRight aria-hidden="true" className="size-4" />}
              </button>
            </div>
            {/* honeypot: hidden from people and assistive tech */}
            <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
            <AnimatePresence initial={false}>
              {status === 'error' && (
                <motion.p
                  id={`${id}-err`}
                  role="alert"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: [0, -5, 5, -3, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative mt-3 flex items-start gap-2 text-[14px] font-medium text-ink"
                >
                  <InkSplat variant={3} color="var(--color-hype)" className="size-5 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <RotateCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                </motion.p>
              )}
            </AnimatePresence>
            <p id={`${id}-note`} className="mt-3 text-[13px] text-tone-2">
              Only used for drop and fest alerts.{' '}
              <Link href="/policies/privacy" className="underline decoration-2 underline-offset-2 hover:text-door">
                Privacy
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

export default NewsletterForm
