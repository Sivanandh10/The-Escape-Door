'use client'
// Add / edit a delivery address. zod-validated inline (errors after a field is visited, < 100 ms, no network),
// 6-digit PIN + 10-digit mobile checks, Indian states dropdown, home / college / work chips, and a best-effort
// PIN → city/state fill (India Post public API; silently skipped when it can't be reached). Owner: CHECKOUT.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Building2, GraduationCap, Home, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ADDRESS_KINDS, INDIAN_STATES, PIN_RE, addressInputSchema, fieldErrors, formatPhone,
  type Address, type AddressInput, type AddressKind,
} from '@/lib/checkout/schema'
import { SelectInput, TextInput } from './fields'

const KIND_ICON: Record<AddressKind, typeof Home> = { home: Home, college: GraduationCap, work: Building2 }
type Values = {
  kind: AddressKind
  name: string
  phone: string
  line1: string
  line2: string
  landmark: string
  city: string
  state: string
  pin: string
  isDefault: boolean
}
type Field = keyof Values

const blank = (seed?: { name?: string | null; phone?: string | null }): Values => ({
  kind: 'home', name: seed?.name ?? '', phone: seed?.phone ? formatPhone(seed.phone) : '', line1: '', line2: '', landmark: '', city: '', state: '', pin: '', isDefault: false,
})

const fromAddress = (a: Address): Values => ({
  kind: a.kind, name: a.name, phone: formatPhone(a.phone), line1: a.line1, line2: a.line2 ?? '', landmark: a.landmark ?? '', city: a.city, state: a.state, pin: a.pin, isDefault: a.isDefault,
})

function validate(v: Values): Partial<Record<Field, string>> {
  const r = addressInputSchema.safeParse(v)
  return r.success ? {} : (fieldErrors(r.error.issues) as Partial<Record<Field, string>>)
}

const STATE_OPTS = INDIAN_STATES.map((s) => ({ id: s, label: s }))

export interface AddressFormProps {
  initial?: Address | null
  /** prefill name / phone for a first address (from the customer profile) */
  seed?: { name?: string | null; phone?: string | null }
  /** show "Make this my default" (hidden for the very first address — it becomes the default) */
  allowDefault?: boolean
  submitLabel?: string
  onSubmit: (input: AddressInput) => Promise<boolean>
  onCancel?: () => void
  className?: string
  /** form element id (lets an outside "Next" button submit it with requestSubmit()) */
  formId?: string
}

export function AddressForm({ initial, seed, allowDefault = true, submitLabel, onSubmit, onCancel, className, formId }: AddressFormProps) {
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Values>(() => (initial ? fromAddress(initial) : blank(seed)))
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [saving, setSaving] = useState(false)
  const [pinState, setPinState] = useState<'idle' | 'looking' | 'filled'>('idle')
  const [shake, setShake] = useState(0)

  const set = <K extends Field>(k: K, v: Values[K]) => {
    const next = { ...values, [k]: v }
    setValues(next)
    if (touched[k] || errors[k]) setErrors((e) => ({ ...e, [k]: validate(next)[k] }))
  }
  const blur = (k: Field) => {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((e) => ({ ...e, [k]: validate(values)[k] }))
  }

  // PIN → city / state (only fills empty fields; never blocks typing)
  const pin = values.pin.trim()
  useEffect(() => {
    if (!PIN_RE.test(pin)) return
    if (values.city && values.state) return
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 3500)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading hint for the lookup
    setPinState('looking')
    fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Array<{ Status?: string; PostOffice?: Array<{ District?: string; State?: string }> | null }> | null) => {
        const po = data?.[0]?.Status === 'Success' ? data[0].PostOffice?.[0] : null
        if (!po) return setPinState('idle')
        const state = INDIAN_STATES.find((s) => s.toLowerCase() === (po.State ?? '').toLowerCase())
        setValues((v) => ({ ...v, city: v.city || po.District || '', state: v.state || state || '' }))
        setErrors((e) => ({ ...e, city: undefined, state: undefined }))
        setPinState('filled')
      })
      .catch(() => setPinState('idle'))
      .finally(() => window.clearTimeout(timer))
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per complete PIN only
  }, [pin])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const errs = validate(values)
    setErrors(errs)
    setTouched({ kind: true, name: true, phone: true, line1: true, line2: true, landmark: true, city: true, state: true, pin: true })
    const first = (Object.keys(errs) as Field[]).find((k) => errs[k])
    if (first) {
      setShake((n) => n + 1)
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    setSaving(true)
    const ok = await onSubmit(values as AddressInput)
    setSaving(false)
    if (!ok) setShake((n) => n + 1)
  }

  const err = (k: Field) => (touched[k] ? errors[k] : undefined)

  return (
    <form ref={formRef} id={formId} onSubmit={submit} noValidate className={cn('flex flex-col gap-4 text-ink', className)} aria-busy={saving}>
      <fieldset>
        <legend className="label mb-2 text-[11px]">Address type</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {ADDRESS_KINDS.map((k) => {
            const Icon = KIND_ICON[k.id]
            const on = values.kind === k.id
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set('kind', k.id)}
                className={cn(
                  'press inline-flex min-h-11 items-center gap-2 border-[3px] border-ink px-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em]',
                  on ? 'bg-volt shadow-hard-sm' : 'bg-paper text-tone-2',
                )}
              >
                <Icon aria-hidden="true" className="size-4" /> {k.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput id={`${id}-name`} name="name" label="Receiver’s name" required autoComplete="name" value={values.name} error={err('name')} onChange={(v) => set('name', v)} onBlur={() => blur('name')} />
        <TextInput
          id={`${id}-phone`}
          name="phone"
          label="Mobile number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          hint="For the courier — 10 digits, +91 optional."
          value={values.phone}
          error={err('phone')}
          onChange={(v) => set('phone', v)}
          onBlur={() => blur('phone')}
        />
      </div>
      <TextInput id={`${id}-line1`} name="line1" label={values.kind === 'college' ? 'Room / hostel / block' : 'House / flat no. and street'} required autoComplete="address-line1" value={values.line1} error={err('line1')} onChange={(v) => set('line1', v)} onBlur={() => blur('line1')} />
      <TextInput id={`${id}-line2`} name="line2" label={values.kind === 'college' ? 'College / campus' : 'Area / locality'} autoComplete="address-line2" value={values.line2} error={err('line2')} onChange={(v) => set('line2', v)} onBlur={() => blur('line2')} />
      <TextInput id={`${id}-landmark`} name="landmark" label="Landmark" placeholder="Near…" value={values.landmark} error={err('landmark')} onChange={(v) => set('landmark', v)} onBlur={() => blur('landmark')} />
      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <TextInput
          id={`${id}-pin`}
          name="pin"
          label="PIN code"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="560001"
          className="font-mono tracking-[0.2em]"
          hint={pinState === 'looking' ? <span className="inline-flex items-center gap-1"><Loader2 aria-hidden className="size-3 animate-spin" /> Finding your city…</span> : pinState === 'filled' ? 'City and state filled from the PIN — check them.' : undefined}
          value={values.pin}
          error={err('pin')}
          onChange={(v) => set('pin', v.replace(/\D/g, '').slice(0, 6))}
          onBlur={() => blur('pin')}
        />
        <TextInput id={`${id}-city`} name="city" label="City / town" required autoComplete="address-level2" value={values.city} error={err('city')} onChange={(v) => set('city', v)} onBlur={() => blur('city')} />
      </div>
      <SelectInput
        id={`${id}-state`}
        label="State / UT"
        required
        autoComplete="address-level1"
        placeholder="Pick your state"
        value={values.state as (typeof INDIAN_STATES)[number] | ''}
        options={STATE_OPTS}
        error={err('state')}
        onChange={(v) => {
          set('state', v)
          setTouched((t) => ({ ...t, state: true }))
        }}
      />
      {allowDefault && (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 self-start text-[14px] font-semibold">
          <input type="checkbox" checked={values.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="size-5 accent-[var(--color-door)]" />
          Make this my default address
        </label>
      )}

      <motion.div key={shake} animate={shake ? { x: [0, -8, 7, -5, 3, 0] } : undefined} transition={{ duration: 0.32 }} className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="press inline-flex min-h-12 flex-1 items-center justify-center gap-2 border-[3px] border-ink bg-ink px-5 font-display text-[20px] uppercase leading-none tracking-[0.02em] text-paper shadow-[4px_4px_0_0_var(--color-door)] disabled:cursor-progress sm:flex-none"
        >
          {saving && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {saving ? 'Saving…' : submitLabel ?? (initial ? 'Save changes' : 'Save address')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="press inline-flex min-h-12 items-center border-[3px] border-ink bg-paper px-5 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
            Cancel
          </button>
        )}
      </motion.div>
      <p role="status" aria-live="polite" className="sr-only">{saving ? 'Saving your address.' : ''}</p>
    </form>
  )
}
