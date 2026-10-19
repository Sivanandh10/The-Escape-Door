'use client'
// P4b — CRUD UI bits on top of P4a's admin kit (docs/CONTRACTS.md §12): sandbox switch, toolbar,
// filter chips, door-swing drawer, form fields, save bar, load/error switch.
import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FlaskConical, Search, X } from 'lucide-react'
import { AdminSkeleton } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion'
import { adminBtn, adminInput, adminLabel } from '../ui'
import { setSandbox, type CrudMode, type CrudStatus } from './data'

// ---------------------------------------------------------------- sandbox switch (demo only)
export function SandboxSwitch({ mode }: { mode: CrudMode }) {
  if (mode === 'live') return null
  const on = mode === 'sandbox'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setSandbox(!on)}
      title="Try edits locally. Nothing is saved — refresh to reset."
      className={cn(
        adminBtn({ variant: on ? 'door' : 'ghost' }),
        on && 'shadow-[4px_4px_0_var(--color-volt)]',
      )}
    >
      <FlaskConical aria-hidden className="size-4" />
      {on ? 'Sandbox on · not saved' : 'Try sandbox'}
    </button>
  )
}

// ---------------------------------------------------------------- toolbar bits
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('admin-rise flex flex-wrap items-center gap-2.5', className)} style={{ ['--d' as string]: '80ms' }}>{children}</div>
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative block min-w-0 flex-1 basis-[220px]">
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-paper/45" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(adminInput, 'pl-9')} />
    </label>
  )
}

/** Segmented filter chips (radio group). */
export function Chips<T extends string>({
  value, onChange, options, label, className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ id: T; label: string; count?: number }>
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex max-w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]', className)} data-lenis-prevent="">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-1.5 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-[background-color,color,translate] duration-150 focus-ring active:translate-y-px',
              on ? 'border-ink bg-paper text-ink shadow-[3px_3px_0_var(--color-door)]' : 'border-paper/20 text-paper/70 can-hover:hover:border-paper/60 can-hover:hover:text-paper',
            )}
          >
            {o.label}
            {o.count != null && <span className={cn('tabular-nums', on ? 'text-door' : 'text-paper/40')}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- states
export function StateSwitch({ status, error, onRetry, rows = 6, variant = 'table', children }: { status: CrudStatus; error: string | null; onRetry: () => void; rows?: number; variant?: 'table' | 'cards'; children: ReactNode }) {
  if (status === 'loading') return <AdminSkeleton variant={variant} rows={rows} />
  if (status === 'error') return <ErrorState title="The door is jammed" message={`${error ?? 'Unknown error'} — check your connection or that you're signed in as an owner.`} onRetry={onRetry} />
  return <>{children}</>
}

// ---------------------------------------------------------------- drawer (door swings in from the right)
export function Drawer({
  open, onClose, title, jp, children, footer, wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  jp?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const reduced = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const lastFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
    lenis?.stop()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button')
      first?.focus()
    }, 60)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prev
      lenis?.start()
      if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus()
    }
  }, [open])

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
    if (e.key !== 'Tab' || !panel.current) return
    const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')
    if (!f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90]" onKeyDown={onKey}>
          <motion.div
            className="absolute inset-0 bg-ink/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden
          >
            <div className="screentone screentone-dense absolute inset-0 text-door [--tone-opacity:0.18]" />
          </motion.div>
          <div className="absolute inset-y-0 right-0 flex w-full justify-end [perspective:1600px]">
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={cn(
                'relative flex h-full w-full flex-col border-l-4 border-ink bg-[#121218] shadow-[-10px_0_0_var(--color-door)]',
                wide ? 'max-w-[880px]' : 'max-w-[600px]',
              )}
              style={{ transformOrigin: '100% 50%' }}
              initial={reduced ? { opacity: 0 } : { rotateY: -68, opacity: 0.4, x: 40 }}
              animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { rotateY: -55, opacity: 0, x: 60 }}
              transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 260, damping: 30 }}
            >
              <div className="flex items-start gap-3 border-b-4 border-ink bg-door px-5 py-4 text-paper sm:px-7">
                <div className="min-w-0 flex-1">
                  {jp && <p className="jp-sub text-[11px] text-paper">{jp}</p>}
                  <h2 id={titleId} className="mt-1 truncate font-display text-[30px] uppercase leading-none sm:text-[36px]">{title}</h2>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-paper text-ink shadow-[3px_3px_0_var(--color-ink)] focus-ring active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7" data-lenis-prevent="">
                {children}
              </div>
              {footer && <div className="flex flex-wrap items-center gap-2.5 border-t-4 border-ink bg-ink px-5 py-3.5 sm:px-7">{footer}</div>}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------- fields
export function Field({ label, hint, error, children, className, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className={adminLabel}>{label}</label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-hype">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] leading-snug text-paper/50">{hint}</p>
      ) : null}
    </div>
  )
}

type FieldBase = { label: string; hint?: ReactNode; error?: string; className?: string }

export function TextField({ value, onChange, placeholder, type = 'text', mono, maxLength, ...f }: FieldBase & { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean; maxLength?: number }) {
  const id = useId()
  return (
    <Field {...f} htmlFor={id}>
      <input id={id} type={type} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={!!f.error} className={cn(adminInput, mono && 'font-mono text-[14px]')} />
    </Field>
  )
}

export function NumberField({ value, onChange, placeholder, min = 0, ...f }: FieldBase & { value: number | null; onChange: (v: number | null) => void; placeholder?: string; min?: number }) {
  const id = useId()
  return (
    <Field {...f} htmlFor={id}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        aria-invalid={!!f.error}
        className={cn(adminInput, 'font-mono text-[14px] tabular-nums')}
      />
    </Field>
  )
}

export function TextArea({ value, onChange, rows = 4, placeholder, maxLength, ...f }: FieldBase & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  const id = useId()
  return (
    <Field {...f} htmlFor={id}>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={!!f.error} className={cn(adminInput, 'resize-y leading-relaxed')} />
      {maxLength && <p className="mt-1 text-right font-mono text-[10.5px] text-paper/40 tabular-nums">{value.length}/{maxLength}</p>}
    </Field>
  )
}

export function SelectField<T extends string>({ value, onChange, options, ...f }: FieldBase & { value: T; onChange: (v: T) => void; options: Array<{ id: T; label: string }> }) {
  const id = useId()
  return (
    <Field {...f} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} aria-invalid={!!f.error} className={cn(adminInput, 'cursor-pointer appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9')} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23F4EFE6' stroke-width='2' fill='none'/%3E%3C/svg%3E\")" }}>
        {options.map((o) => <option key={o.id} value={o.id} className="bg-ink">{o.label}</option>)}
      </select>
    </Field>
  )
}

/** Big chunky switch. */
export function Toggle({ checked, onChange, label, hint, tone = 'volt' }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; tone?: 'volt' | 'door' | 'hype' }) {
  const on = { volt: 'bg-volt', door: 'bg-door', hype: 'bg-hype' }[tone]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex min-h-11 w-full items-center gap-3 border-2 border-paper/15 px-3 py-2 text-left transition-colors duration-150 focus-ring can-hover:hover:border-paper/40"
    >
      <span className={cn('relative h-6 w-11 shrink-0 border-2 border-ink transition-colors duration-150', checked ? on : 'bg-tone-2')}>
        <span className={cn('absolute top-0.5 size-4 border-2 border-ink bg-paper transition-[left] duration-200 ease-(--ease-slam)', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-paper">{label}</span>
        {hint && <span className="block text-[12px] leading-snug text-paper/50">{hint}</span>}
      </span>
    </button>
  )
}

export function ColorField({ value, onChange, ...f }: FieldBase & { value: string; onChange: (v: string) => void }) {
  const id = useId()
  const valid = /^#[0-9a-f]{6}$/i.test(value)
  return (
    <Field {...f} htmlFor={id}>
      <div className="flex items-stretch gap-2">
        <label className="relative block size-11 shrink-0 cursor-pointer border-2 border-ink shadow-[3px_3px_0_var(--color-paper)] focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-door" style={{ background: valid ? value : '#000' }}>
          <span className="sr-only">Pick {f.label}</span>
          <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!f.error || !valid} maxLength={7} className={cn(adminInput, 'font-mono text-[14px] uppercase')} />
      </div>
    </Field>
  )
}

/** Comma/Enter-separated tag input. */
export function TagsField({ value, onChange, placeholder, ...f }: FieldBase & { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  return (
    <Field {...f} htmlFor={id}>
      <div className={cn(adminInput, 'flex min-h-11 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-volt')}>
        {value.map((t, i) => (
          <span key={t + i} className="inline-flex items-center gap-1 border-2 border-ink bg-lav py-0.5 pl-2 pr-0.5 font-mono text-[11.5px] font-bold text-ink">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-6 place-items-center focus-ring can-hover:hover:bg-ink can-hover:hover:text-paper">
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(draft) }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => add(draft)}
          className="min-w-[120px] flex-1 bg-transparent py-1 text-[15px] text-paper outline-none placeholder:text-paper/35"
        />
      </div>
    </Field>
  )
}

/** Section divider inside forms. */
export function FormSection({ title, jp, children, className }: { title: string; jp?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-8 first:mt-0', className)}>
      <h3 className="mb-4 flex items-baseline gap-3 border-b-2 border-paper/10 pb-2">
        <span className="font-display text-[22px] uppercase leading-none text-paper">{title}</span>
        {jp && <span className="jp-sub text-[10.5px]">{jp}</span>}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/** zod issues → { field: message } */
export function issuesToErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const k = i.path.map(String).join('.')
    if (!out[k]) out[k] = i.message
  }
  return out
}

/** Drawer footer: save + cancel with saving state. */
export function SaveBar({ saving, dirty, onSave, onCancel, extra, mode }: { saving: boolean; dirty: boolean; onSave: () => void; onCancel: () => void; extra?: ReactNode; mode: CrudMode }) {
  return (
    <>
      <button type="button" onClick={onSave} disabled={saving} className={adminBtn({ variant: 'primary' })}>
        {saving ? <span className="inline-block size-3.5 animate-spin border-2 border-ink border-t-transparent" aria-hidden /> : null}
        {saving ? 'Saving…' : mode === 'sandbox' ? 'Save (sandbox)' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} className={adminBtn({ variant: 'ghost' })}>Cancel</button>
      {dirty && !saving && <span className="label text-[10px] text-volt">● Unsaved changes</span>}
      <span className="ml-auto flex items-center gap-2">{extra}</span>
    </>
  )
}
