'use client'
// S11 "Remind me" inline form → submitLead({kind:'remind_me'}). Inline validation (< 100 ms), designed
// loading / error states; success is handled by the parent ticket (stamp). Owner: S11.
import { useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Loader2, Send } from 'lucide-react'
import gsap from 'gsap'
import { submitLead } from '@/lib/leads'
import { prefersReducedMotion } from '@/lib/motion'
import { track } from '@/lib/analytics'
import { InkSplat } from '@/components/fx/InkSplat'
import { cn } from '@/lib/utils'
import type { FestEvent } from '@/lib/types'
import { useCustomer } from '@/lib/auth/customer'
import { contactEmail } from '@/lib/auth/shared'

const PHONE = /^[+\d][\d\s-]{6,}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function contactError(v: string): string | null {
  const s = v.trim()
  if (!s) return 'Add a WhatsApp number or email so we can remind you.'
  if (!PHONE.test(s) && !EMAIL.test(s)) return 'That doesn’t look like a phone number or email.'
  return null
}

const ERRORS: Record<string, string> = {
  'rate-limited': 'Too many tries in a row. Give it a minute, then hit send again.',
  network: 'We couldn’t reach the server. Check your connection and retry.',
  server: 'Something broke on our side. Please retry, or DM us on Instagram.',
  invalid: 'Please check the highlighted field.',
}

export function RemindForm({ event, onDone }: { event: FestEvent; onDone: () => void }) {
  const id = useId()
  const { customer } = useCustomer()
  // signed-in shoppers get their phone / email pre-filled (AUTH)
  const [contact, setContact] = useState(() => customer?.phone || contactEmail(customer?.email) || '')
  const [touched, setTouched] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [serverField, setServerField] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const contactRef = useRef<HTMLInputElement>(null)

  const fieldError = serverField ?? (touched ? contactError(contact) : null)

  function shake() {
    if (!contactRef.current || prefersReducedMotion()) return
    gsap.fromTo(contactRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.3)', clearProps: 'x' })
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'loading') return
    setTouched(true)
    setServerField(null)
    const err = contactError(contact)
    if (err) {
      shake()
      contactRef.current?.focus()
      return
    }
    const fd = new FormData(e.currentTarget)
    setStatus('loading')
    setError(null)
    const res = await submitLead(
      {
        kind: 'remind_me',
        name: String(fd.get('name') || '').trim() || undefined,
        city: String(fd.get('city') || '').trim() || undefined,
        contact: contact.trim(),
        payload: { eventId: event.id, event: event.name, dateLabel: event.dateLabel },
      },
      { honeypot: String(fd.get('company') || '') },
    )
    if (res.ok) {
      track('remind_me', { eventId: event.id })
      onDone()
      return
    }
    const fieldMsg = res.fieldErrors?.contact?.[0]
    if (fieldMsg) {
      setServerField(fieldMsg)
      shake()
      contactRef.current?.focus()
    }
    setError(ERRORS[res.error ?? 'server'] ?? ERRORS.server)
    setStatus('error')
  }

  const loading = status === 'loading'
  const input =
    'mt-1 block min-h-12 w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink placeholder:text-tone-3 focus:outline-none focus-visible:shadow-hard-door transition-shadow duration-150'

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-3" aria-busy={loading}>
      <p className="font-display text-[22px] uppercase leading-none">Remind me about {event.name}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[14px] font-bold" htmlFor={`${id}-name`}>
          Name <span className="font-normal text-tone-3">(optional)</span>
          <input id={`${id}-name`} name="name" autoComplete="given-name" maxLength={80} className={input} />
        </label>
        <label className="block text-[14px] font-bold" htmlFor={`${id}-city`}>
          City <span className="font-normal text-tone-3">(optional)</span>
          <input id={`${id}-city`} name="city" autoComplete="address-level2" maxLength={60} className={input} />
        </label>
      </div>
      <label className="block text-[14px] font-bold" htmlFor={`${id}-contact`}>
        WhatsApp number or email
        <input
          ref={contactRef}
          id={`${id}-contact`}
          name="contact"
          inputMode="email"
          autoComplete="email"
          maxLength={120}
          required
          value={contact}
          onChange={(e) => {
            setContact(e.target.value)
            setServerField(null)
          }}
          onBlur={() => contact && setTouched(true)}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? `${id}-err` : undefined}
          placeholder="+91 98xxx xxxxx or you@mail.com"
          className={cn(input, fieldError && 'border-hype')}
        />
      </label>
      {fieldError && (
        <p id={`${id}-err`} role="alert" className="-mt-1 text-[14px] font-bold text-hype">
          {fieldError}
        </p>
      )}
      {/* honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === 'error' && error && (
        <div role="alert" className="relative overflow-hidden border-[3px] border-ink bg-ink p-3 pl-14 text-[14px] font-semibold text-paper">
          <InkSplat variant={5} className="absolute -left-3 top-1/2 w-16 -translate-y-1/2 text-hype" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={loading}
          className="press focus-ring relative inline-flex min-h-12 items-center gap-2 overflow-hidden border-[3px] border-ink bg-volt px-5 font-display text-[20px] uppercase leading-none text-ink shadow-hard-sm disabled:cursor-wait"
        >
          {loading && <span aria-hidden="true" className="skeleton-tone absolute inset-0 opacity-40" />}
          {loading ? <Loader2 className="relative size-5 animate-spin" aria-hidden="true" /> : <Send className="relative size-5" aria-hidden="true" strokeWidth={2.5} />}
          <span className="relative">{loading ? 'Saving…' : status === 'error' ? 'Retry' : 'Remind me'}</span>
        </button>
        <span className="sr-only" aria-live="polite">
          {loading ? 'Saving your reminder' : ''}
        </span>
      </div>
      <p className="text-[13px] leading-snug text-tone-2">
        We only use this to remind you about this stall.{' '}
        <Link href="/policies/privacy" className="font-semibold text-ink underline decoration-door decoration-2 underline-offset-2">
          Privacy policy
        </Link>
      </p>
    </form>
  )
}

export default RemindForm
