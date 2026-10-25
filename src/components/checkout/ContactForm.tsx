'use client'
// Guest checkout · step 01 "Your details": name + WhatsApp number (+91 fixed prefix, 10 digits) are all that's
// required; email optional; `extra` slot for the address choice.
// zod-validated inline (after a field is visited, < 100 ms, no network). The email is how the order finds its way into
// an account later (same verified email at login), so the hint says so. Owner: CHECKOUT.
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { contactSchema, fieldErrors, type ContactValues } from '@/lib/checkout/schema'
import { FieldShell, TextInput, fieldCls } from './fields'

type Values = { name: string; phone: string; email: string }
type Field = keyof Values

function validate(v: Values): Partial<Record<Field, string>> {
  const r = contactSchema.safeParse(v)
  return r.success ? {} : (fieldErrors(r.error.issues) as Partial<Record<Field, string>>)
}

/**
 * "9876543210" → "98765 43210" (display only; the schema normalises). A pasted or typed "+91 98765 43210" /
 * "098765 43210" keeps every digit until it's complete (12 / 11 digits), then the 91 / 0 prefix is dropped.
 */
const spaced = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 12)
  const n = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d
  return n.length > 5 && n.length <= 10 ? `${n.slice(0, 5)} ${n.slice(5)}` : n
}

export interface ContactMeta {
  /** honeypot (hidden "website" field): anything typed here means a bot filled the form */
  hp: string
  /** opt-in: keep name / phone / address in this browser for the next order */
  remember: boolean
}

export interface ContactFormProps {
  initial?: Partial<ContactValues> | null
  onSubmit: (v: ContactValues, meta: ContactMeta) => void
  submitLabel?: string
  formId?: string
  className?: string
  /** the details came from this browser's memory → offer "Not you? Clear details" */
  remembered?: boolean
  onForget?: () => void
  /** rendered between the fields and the submit button (guest checkout: the address choice) */
  extra?: ReactNode
}

export function ContactForm({ initial, onSubmit, submitLabel = 'Continue', formId, className, remembered = false, onForget, extra }: ContactFormProps) {
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [remember, setRemember] = useState(remembered)
  const [values, setValues] = useState<Values>({ name: initial?.name ?? '', phone: initial?.phone ? spaced(initial.phone) : '', email: initial?.email ?? '' })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [shake, setShake] = useState(0)

  const set = (k: Field, v: string) => {
    const next = { ...values, [k]: v }
    setValues(next)
    if (touched[k] || errors[k]) setErrors((e) => ({ ...e, [k]: validate(next)[k] }))
  }
  const blur = (k: Field) => {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((e) => ({ ...e, [k]: validate(values)[k] }))
  }
  const err = (k: Field) => (touched[k] ? errors[k] : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = contactSchema.safeParse(values)
    if (!r.success) {
      const errs = fieldErrors(r.error.issues) as Partial<Record<Field, string>>
      setErrors(errs)
      setTouched({ name: true, phone: true, email: true })
      setShake((n) => n + 1)
      const first = (['name', 'phone', 'email'] as Field[]).find((k) => errs[k])
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    const hp = formRef.current?.querySelector<HTMLInputElement>('input[name="website"]')?.value ?? ''
    onSubmit(r.data, { hp, remember })
  }

  const forget = () => {
    setValues({ name: '', phone: '', email: '' })
    setTouched({})
    setErrors({})
    setRemember(false)
    onForget?.()
    formRef.current?.querySelector<HTMLElement>('[name="name"]')?.focus()
  }

  const phoneErr = err('phone')
  const phoneDesc = [phoneErr ? `${id}-phone-err` : `${id}-phone-hint`].join(' ')

  return (
    <form ref={formRef} id={formId} onSubmit={submit} noValidate className={cn('flex flex-col gap-4 text-ink', className)}>
      {remembered && (values.name || values.phone) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-[3px] border-ink bg-volt/40 px-3 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
          Filled from this device
          <button type="button" onClick={forget} className="press min-h-11 underline decoration-2 underline-offset-4 sm:min-h-0">
            Not you? Clear details
          </button>
        </p>
      )}
      {/* honeypot: hidden from people and assistive tech; bots that fill every field give themselves away */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput id={`${id}-name`} name="name" label="Your name" required autoComplete="name" value={values.name} error={err('name')} onChange={(v) => set('name', v)} onBlur={() => blur('name')} />
        <FieldShell id={`${id}-phone`} label="WhatsApp number" required error={phoneErr} hint="We confirm the order and sort the rest in this chat.">
          <span className="flex">
            <span aria-hidden="true" className="grid h-12 shrink-0 place-items-center border-[3px] border-r-0 border-ink bg-volt px-3 font-mono text-[15px] font-bold">
              +91
            </span>
            <input
              id={`${id}-phone`}
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={values.phone}
              onChange={(e) => set('phone', spaced(e.target.value))}
              onBlur={() => blur('phone')}
              aria-invalid={!!phoneErr || undefined}
              aria-required
              aria-describedby={phoneDesc}
              className={cn(fieldCls(phoneErr), 'h-12 min-w-0 flex-1 font-mono tracking-[0.08em]')}
            />
          </span>
        </FieldShell>
      </div>
      <TextInput
        id={`${id}-email`}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        label="Email"
        placeholder="you@example.com"
        hint="Optional — skip it. Handy only if you make an account later: the order shows up there."
        value={values.email}
        error={err('email')}
        onChange={(v) => set('email', v)}
        onBlur={() => blur('email')}
      />
      {extra}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] leading-snug">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 shrink-0 accent-ink" />
        <span>
          Remember my details on this device <span className="text-ink/60">— skip it on a shared or café computer</span>
        </span>
      </label>
      <motion.div key={shake} animate={shake ? { x: [0, -8, 7, -5, 3, 0] } : undefined} transition={{ duration: 0.32 }}>
        <button
          type="submit"
          className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-5 font-display text-[20px] uppercase leading-none text-paper shadow-[4px_4px_0_0_var(--color-door)]"
        >
          {submitLabel} <ArrowRight aria-hidden className="size-5 text-volt" />
        </button>
      </motion.div>
    </form>
  )
}
