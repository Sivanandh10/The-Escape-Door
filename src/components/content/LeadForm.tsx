'use client'
// Lead form for /fests#partner (fest partnership) and /contact. Owner: P5.
// → submitLead({ kind: 'custom_request', payload: { type, … } }) (CONTRACTS §10.5: only what's needed + consent line).
// States: idle · invalid (inline, instant) · sending (screentone shimmer) · error (ink splat + retry) ·
// success (stamp slams in + Kado cheers, with a WhatsApp follow-up link). Honeypot field "company".
import Link from 'next/link'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, MessageCircle, RotateCcw } from 'lucide-react'
import { Mascot } from '@/components/brand'
import { InkSplat } from '@/components/fx/InkSplat'
import { submitLead } from '@/lib/leads'
import { track } from '@/lib/analytics'
import { waLink } from '@/lib/whatsapp'
import { useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { cn } from '@/lib/utils'

type Variant = 'fest' | 'contact'
type Field = 'name' | 'contact' | 'fest' | 'college' | 'dates' | 'city' | 'topic' | 'message'
type Values = Record<Field, string>
type Status = 'idle' | 'sending' | 'done' | 'error'

const TOPICS = ['An order', 'A custom design', 'A fest partnership', 'Something else'] as const

const CONFIG: Record<Variant, { fields: Field[]; required: Field[]; submit: string; stamp: string; done: string }> = {
  fest: {
    fields: ['name', 'contact', 'fest', 'college', 'dates', 'message'],
    required: ['name', 'contact', 'fest'],
    submit: 'Send partnership request',
    stamp: 'Request sent',
    done: 'We read every fest request ourselves and reply on WhatsApp or email.',
  },
  contact: {
    fields: ['name', 'contact', 'city', 'topic', 'message'],
    required: ['name', 'contact', 'message'],
    submit: 'Send message',
    stamp: 'Message sent',
    done: 'Thanks for writing in. We reply on WhatsApp or email, whichever you gave us.',
  },
}

const LABEL: Record<Field, string> = {
  name: 'Your name',
  contact: 'WhatsApp number or email',
  fest: 'Fest name',
  college: 'College and city',
  dates: 'Fest dates (if fixed)',
  city: 'City',
  topic: 'What is it about?',
  message: 'Message',
}
const PLACEHOLDER: Partial<Record<Field, string>> = {
  name: 'Aanya',
  contact: '98xxxxxx10 or you@college.in',
  fest: 'e.g. your college cultural fest',
  college: 'Institute, city',
  dates: 'e.g. 3 days in February',
  city: 'Your city',
  message: '',
}

const CONTACT_RE = /^[+\d][\d\s-]{6,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(v: Values, required: Field[]): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {}
  for (const f of required) if (!v[f].trim()) e[f] = f === 'contact' ? 'Add a WhatsApp number or an email so we can reply.' : `Add ${LABEL[f].toLowerCase()}.`
  const c = v.contact.trim()
  if (c && !CONTACT_RE.test(c) && !EMAIL_RE.test(c)) e.contact = 'Enter a phone number or an email address.'
  return e
}

export function LeadForm({ variant, className, intro }: { variant: Variant; className?: string; intro?: ReactNode }) {
  const waNumber = useWhatsappNumber()
  const cfg = CONFIG[variant]
  const uid = useId()
  const honeypot = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Values>({ name: '', contact: '', fest: '', college: '', dates: '', city: '', topic: TOPICS[0], message: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState('')

  const set = (f: Field, val: string) => {
    setValues((v) => ({ ...v, [f]: val }))
    if (errors[f]) setErrors((e) => ({ ...e, [f]: undefined }))
  }

  const waText =
    variant === 'fest'
      ? `Hi The Escape Door! I'm ${values.name || '…'} from ${values.fest || 'our fest'}${values.college ? ` (${values.college})` : ''}. We'd like to talk about a Fandom Partner stall${values.dates ? ` on ${values.dates}` : ''}.`
      : `Hi The Escape Door! I'm ${values.name || '…'}. ${values.message || ''}`.trim()

  const sendLead = (via: 'form' | 'whatsapp') =>
    submitLead(
      {
        kind: 'custom_request',
        name: values.name.trim(),
        contact: values.contact.trim(),
        city: (variant === 'fest' ? values.college : values.city).trim() || undefined,
        message: values.message.trim() || undefined,
        payload:
          variant === 'fest'
            ? { type: 'fest-partnership', fest: values.fest.trim(), college: values.college.trim(), dates: values.dates.trim(), contact: values.contact.trim(), via }
            : { type: 'contact', topic: values.topic, via },
      },
      { honeypot: honeypot.current?.value ?? '' },
    )

  // "Or message us on WhatsApp" is a plain <a href> with the final text (opens instantly); when the form is
  // already filled we also save the lead in the background — never awaited (keepalive fetch).
  const onWhatsapp = () => {
    track('whatsapp_click', { from: `${variant}-form` })
    if (Object.keys(validate(values, cfg.required)).length === 0) void sendLead('whatsapp')
  }

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    const errs = validate(values, cfg.required)
    setErrors(errs)
    const first = cfg.fields.find((f) => errs[f])
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    // optimistic: the success stamp shows at once; roll back to the error state only if the save fails
    setStatus('done')
    setServerError('')
    const res = await sendLead('form')
    if (res.ok) return
    if (res.fieldErrors) {
      const fe: Partial<Record<Field, string>> = {}
      for (const [k, msgs] of Object.entries(res.fieldErrors)) if ((cfg.fields as string[]).includes(k)) fe[k as Field] = msgs[0]
      setErrors(fe)
    }
    setStatus('error')
    setServerError(
      res.error === 'rate-limited'
        ? 'Too many tries in a row. Give it a minute, then send again — or message us on WhatsApp.'
        : 'That did not go through. Check your connection and send again — or message us on WhatsApp.',
    )
  }

  return (
    <div className={cn('relative', className)} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {status === 'done' ? (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative overflow-hidden border-4 border-ink bg-paper p-6 text-ink shadow-hard-lg grain sm:p-8"
          >
            <motion.p
              initial={{ scale: 1.6, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 20 }}
              className="font-display inline-block border-[5px] border-hype px-4 py-1 text-[clamp(40px,7vw,72px)] uppercase leading-none text-hype"
            >
              {cfg.stamp}
            </motion.p>
            <div className="mt-6 flex items-end gap-4">
              <p className="max-w-[40ch] text-[17px] leading-[1.55]">{cfg.done}</p>
              <Mascot mood="cheer" size={96} animate title="" className="ml-auto shrink-0" />
            </div>
            <a
              href={waLink(waText, waNumber)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_click', { from: `${variant}-form-success` })}
              className="press focus-ring label mt-6 inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 font-bold shadow-hard-sm hover:bg-volt-hot"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              Also ping us on WhatsApp
            </a>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            ref={formRef}
            noValidate
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            className="relative border-4 border-ink bg-paper p-5 text-ink shadow-hard-lg grain sm:p-8"
          >
            {intro}
            <div className="grid gap-4 sm:grid-cols-2">
              {cfg.fields.map((f) => {
                const id = `${uid}-${f}`
                const err = errors[f]
                const wide = f === 'message' || (variant === 'contact' && f === 'topic')
                const req = cfg.required.includes(f)
                const base = cn(
                  'w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink placeholder:text-tone-3 transition-shadow duration-150 focus:outline-none focus-visible:shadow-[4px_4px_0_0_var(--color-door)]',
                  err && 'shadow-[4px_4px_0_0_var(--color-hype)]',
                )
                return (
                  <div key={f} className={cn(wide && 'sm:col-span-2')}>
                    <label htmlFor={id} className="label flex items-baseline justify-between gap-2">
                      <span>{LABEL[f]}</span>
                      <span className="text-[10px] text-tone-3">{req ? 'Required' : 'Optional'}</span>
                    </label>
                    {f === 'message' ? (
                      <textarea
                        id={id}
                        name={f}
                        rows={4}
                        maxLength={2000}
                        value={values[f]}
                        onChange={(e) => set(f, e.target.value)}
                        aria-invalid={!!err || undefined}
                        aria-describedby={err ? `${id}-err` : undefined}
                        placeholder={variant === 'fest' ? 'Footfall, stall space, custom merch for your team…' : 'How can we help?'}
                        className={cn(base, 'mt-2 block min-h-28 resize-y py-2.5')}
                      />
                    ) : f === 'topic' ? (
                      <select id={id} name={f} value={values.topic} onChange={(e) => set(f, e.target.value)} className={cn(base, 'mt-2 block min-h-12 cursor-pointer')}>
                        {TOPICS.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        name={f}
                        type="text"
                        inputMode={f === 'contact' ? 'email' : undefined}
                        autoComplete={f === 'name' ? 'name' : f === 'contact' ? 'email' : f === 'city' ? 'address-level2' : 'off'}
                        maxLength={f === 'contact' ? 120 : 80}
                        value={values[f]}
                        onChange={(e) => set(f, e.target.value)}
                        onBlur={() => {
                          if (f === 'contact' && values.contact.trim()) setErrors((x) => ({ ...x, contact: validate(values, []).contact }))
                        }}
                        aria-invalid={!!err || undefined}
                        aria-describedby={err ? `${id}-err` : undefined}
                        placeholder={PLACEHOLDER[f]}
                        className={cn(base, 'mt-2 block min-h-12')}
                      />
                    )}
                    {err && (
                      <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1.5 text-[14px] font-medium text-[#b3121f]">
                        <InkSplat variant={2} color="var(--color-hype)" className="size-4 shrink-0" />
                        {err}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />

            <AnimatePresence initial={false}>
              {status === 'error' && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: [0, -5, 5, -3, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-5 flex items-start gap-2 border-[3px] border-ink bg-pink p-3 text-[15px] font-medium"
                >
                  <InkSplat variant={3} color="var(--color-hype)" className="size-5 shrink-0" />
                  <span className="flex-1">{serverError}</span>
                  <RotateCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={status === 'sending'}
                className={cn(
                  'press focus-ring label relative inline-flex min-h-13 items-center justify-center gap-2 overflow-hidden border-[3px] border-ink px-5 py-3.5 text-[13px] font-bold shadow-hard',
                  status === 'sending' ? 'skeleton-tone cursor-progress text-paper' : 'bg-volt text-ink hover:bg-volt-hot',
                )}
              >
                {status === 'sending' ? 'Sending…' : cfg.submit}
                {status !== 'sending' && <ArrowRight aria-hidden="true" className="size-4" />}
              </button>
              <a
                href={waLink(waText, waNumber)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onWhatsapp}
                className="focus-ring label inline-flex min-h-11 items-center gap-2 underline decoration-2 underline-offset-4 hover:text-door"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Or message us on WhatsApp
              </a>
            </div>
            <p className="mt-4 text-[13px] leading-[1.5] text-tone-2">
              We only use these details to reply to you.{' '}
              <Link href="/policies/privacy" className="underline decoration-2 underline-offset-2 hover:text-door">
                Privacy policy
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LeadForm
