'use client'
// WhatsApp checkout form (#66 label morph on the send button). Owner: P2.
// Flow: validate (zod, inline errors) → build the order text + wa.me link synchronously → open WhatsApp in the
// same submit gesture (instant) → submitLead('whatsapp_order') fire-and-forget (keepalive) → track → /checkout-success.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowLeft, MessageCircle } from 'lucide-react'
import { z } from 'zod'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { submitLead } from '@/lib/leads'
import { buildOrderMessage, waLink } from '@/lib/whatsapp'
import { openWhatsApp } from '@/lib/wa-open'
import { useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { getAttribution, track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { CartItem, CartTotals } from '@/lib/types'
import { saveLastOrder, slimOrderPayload } from './cart/order'

const PHONE = /^[+\d][\d\s-]{6,}$/
const schema = z.object({
  name: z.string().trim().min(2, 'Tell us your name (2 letters or more).').max(80, 'Keep the name under 80 characters.'),
  city: z.string().trim().min(2, 'Which city are you in?').max(80, 'Keep the city under 80 characters.'),
  phone: z
    .string()
    .trim()
    .max(20, 'That number is too long.')
    .refine((v) => v === '' || PHONE.test(v), 'Digits only, e.g. +91 and your 10-digit number.'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.'),
})
type Values = z.infer<typeof schema>
type Field = keyof Values
type Errors = Partial<Record<Field, string>>

function validate(v: Values): Errors {
  const r = schema.safeParse(v)
  if (r.success) return {}
  const out: Errors = {}
  for (const issue of r.error.issues) {
    const k = issue.path[0] as Field
    if (!out[k]) out[k] = issue.message
  }
  return out
}

export interface CheckoutFormProps {
  items: CartItem[]
  totals: CartTotals
  /** drawer: shows a "Back to cart" link */
  onBack?: () => void
  /** called right before routing to /checkout-success (drawer closes itself) */
  onSent?: () => void
  className?: string
}

export function CheckoutForm({ items, totals, onBack, onSent, className }: CheckoutFormProps) {
  const waNumber = useWhatsappNumber()
  const router = useRouter()
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Values>({ name: '', city: '', phone: '', note: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [shake, setShake] = useState(0)
  const honeypot = useRef<HTMLInputElement>(null)

  const set = (k: Field, v: string) => {
    const next = { ...values, [k]: v }
    setValues(next)
    // live re-validation once a field has been visited (< 100 ms feedback, no network)
    if (touched[k] || errors[k]) setErrors((e) => ({ ...e, [k]: validate(next)[k] }))
  }
  const blur = (k: Field) => {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((e) => ({ ...e, [k]: validate(values)[k] }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (status === 'sending' || !items.length) return
    const errs = validate(values)
    setErrors(errs)
    setTouched({ name: true, city: true, phone: true, note: true })
    const first = (Object.keys(errs) as Field[])[0]
    if (first) {
      setShake((n) => n + 1)
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }

    // 1) build the message + link synchronously and open WhatsApp inside the submit gesture — no awaits first
    const v = schema.parse(values)
    const ref = `TED-${Date.now().toString(36).slice(-6).toUpperCase()}`
    const text = buildOrderMessage({ items, totals, name: v.name, city: v.city, note: v.note, orderRef: ref })
    const link = waLink(text, waNumber)
    const opened = openWhatsApp(link, { fallbackSameTab: false })
    setStatus('sending')

    // 2) save the lead in the background (keepalive fetch survives the tab switch); never awaited
    void submitLead(
      {
        kind: 'whatsapp_order',
        name: v.name,
        city: v.city,
        ...(v.phone ? { contact: v.phone } : {}),
        ...(v.note ? { message: v.note } : {}),
        payload: { ...slimOrderPayload(items, totals), orderRef: ref },
        source: getAttribution(),
      },
      { honeypot: honeypot.current?.value ?? '' },
    )
    track('whatsapp_click', {
      where: 'checkout',
      pieces: items.reduce((n, i) => n + i.qty, 0),
      total: totals.total,
      opened,
    })

    // 3) hand-off to the success page (the success moment plays AFTER WhatsApp opened), then empty the cart
    saveLastOrder({
      ref,
      items,
      totals: {
        subtotal: totals.subtotal,
        savings: totals.savings,
        total: totals.total,
        hasPriceOnRequest: totals.hasPriceOnRequest,
        applied: totals.applied,
        lines: totals.lines.map((l) => ({ key: l.key, lineTotal: l.lineTotal, saving: l.saving })),
      },
      name: v.name,
      city: v.city,
      link,
      at: Date.now(),
      opened,
    })
    onSent?.()
    // the success page empties the cart once it has the order (no empty-cart flash here);
    // if the popup was blocked, it shows the link as a button.
    router.push('/checkout-success')
  }

  const sending = status === 'sending'

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className={cn('flex flex-col gap-4 text-ink', className)} aria-busy={sending}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="label -mb-1 inline-flex min-h-11 items-center gap-2 self-start text-[11px] can-hover:hover:text-door"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to cart
        </button>
      )}

      <Input id={`${id}-name`} name="name" label="Your name" autoComplete="name" required value={values.name} error={touched.name ? errors.name : undefined} onChange={(v) => set('name', v)} onBlur={() => blur('name')} />
      <Input id={`${id}-city`} name="city" label="City" autoComplete="address-level2" required value={values.city} error={touched.city ? errors.city : undefined} onChange={(v) => set('city', v)} onBlur={() => blur('city')} />
      <Input
        id={`${id}-phone`}
        name="phone"
        label="WhatsApp number"
        hint="Optional — only if it differs from the one you message from."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        error={touched.phone ? errors.phone : undefined}
        onChange={(v) => set('phone', v)}
        onBlur={() => blur('phone')}
      />
      <Input
        id={`${id}-note`}
        name="note"
        label="Notes"
        hint="Optional — sizes to double-check, gift message, pick-up at a fest stall…"
        multiline
        value={values.note}
        error={touched.note ? errors.note : undefined}
        onChange={(v) => set('note', v)}
        onBlur={() => blur('note')}
      />
      {/* honeypot (bots fill it, humans never see it) */}
      <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />

      <motion.div
        key={shake}
        animate={shake ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
        transition={{ duration: 0.32 }}
      >
        <button
          type="submit"
          disabled={sending}
          data-cursor="SEND"
          className="press group relative flex min-h-14 w-full items-center justify-center gap-3 overflow-hidden border-[3px] border-ink bg-volt px-5 text-ink shadow-hard disabled:cursor-progress"
        >
          <span aria-hidden="true" className="grid size-8 place-items-center border-2 border-ink bg-paper">
            <DoorIcon open={sending ? 0.95 : 0.15} size={20} light="var(--color-door)" />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={sending ? 'sending' : 'idle'}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="font-display text-[24px] uppercase leading-none tracking-[0.02em]"
            >
              {sending ? 'Opening WhatsApp…' : 'Buy on WhatsApp'}
            </motion.span>
          </AnimatePresence>
          {!sending && <MessageCircle aria-hidden="true" className="size-5 transition-transform duration-200 can-hover:group-hover:-rotate-12" />}
        </button>
      </motion.div>
      <p role="status" aria-live="polite" className="sr-only">
        {sending ? 'Saving your order and opening WhatsApp.' : ''}
      </p>

      <p className="text-[12.5px] leading-snug text-tone-2">
        Nothing is charged here. WhatsApp opens with your order typed out — we confirm stock, size and the final price in chat. We use these details only to handle this order (
        <Link href="/policies/privacy" className="font-semibold text-ink underline decoration-door decoration-2 underline-offset-2">
          privacy
        </Link>
        ).
      </p>
    </form>
  )
}

function Input({
  id,
  name,
  label,
  hint,
  error,
  multiline,
  value,
  onChange,
  onBlur,
  required,
  ...rest
}: {
  id: string
  name: string
  label: ReactNode
  hint?: string
  error?: string
  multiline?: boolean
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  required?: boolean
  type?: string
  inputMode?: 'tel' | 'text'
  autoComplete?: string
}) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined
  const cls = cn(
    'w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink outline-none transition-[box-shadow,background-color] duration-150 placeholder:text-tone-3',
    'focus:bg-white focus:shadow-[4px_4px_0_0_var(--color-door)]',
    error && 'border-hype bg-[color-mix(in_oklab,var(--color-pink)_35%,var(--color-paper))]',
  )
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label flex items-baseline justify-between text-[11px]">
        <span>{label}</span>
        {required ? <span className="text-tone-3 normal-case tracking-normal">required</span> : <span className="text-tone-3 normal-case tracking-normal">optional</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={cn(cls, 'min-h-[76px] resize-y py-2.5')}
        />
      ) : (
        <input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(cls, 'h-12')}
          {...rest}
        />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12px] text-tone-3">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-err`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#b3001b]"
          >
            <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
