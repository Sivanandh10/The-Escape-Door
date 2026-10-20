'use client'
// Manga-paper form fields for checkout (ink border, door-purple hard focus shadow, inline errors < 100 ms).
// Owner: CHECKOUT.
import type { ReactNode, InputHTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const fieldCls = (error?: string) =>
  cn(
    'w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink outline-none transition-[box-shadow,background-color] duration-150 placeholder:text-tone-3',
    'focus:bg-white focus:shadow-[4px_4px_0_0_var(--color-door)]',
    error && 'border-hype bg-[color-mix(in_oklab,var(--color-pink)_35%,var(--color-paper))]',
  )

export function FieldShell({
  id, label, hint, error, required, children, className,
}: { id: string; label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="label flex items-baseline justify-between gap-2 text-[11px] text-ink">
        <span>{label}</span>
        <span className="text-tone-3 normal-case tracking-normal">{required ? 'required' : 'optional'}</span>
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12px] leading-snug text-tone-3">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} error={error} />
    </div>
  )
}

export function FieldError({ id, error }: { id?: string; error?: string }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          id={id}
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
  )
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  value: string
  onChange: (v: string) => void
  wrapClassName?: string
}

export function TextInput({ id, label, hint, error, value, onChange, required, wrapClassName, className, ...rest }: InputProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={cn(fieldCls(error), 'h-12', className)}
        {...rest}
      />
    </FieldShell>
  )
}

export function TextArea({
  id, label, hint, error, value, onChange, required, rows = 2, maxLength, placeholder, wrapClassName,
}: { id: string; label: ReactNode; hint?: ReactNode; error?: string; value: string; onChange: (v: string) => void; required?: boolean; rows?: number; maxLength?: number; placeholder?: string; wrapClassName?: string }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        className={cn(fieldCls(error), 'min-h-[76px] resize-y py-2.5')}
      />
    </FieldShell>
  )
}

export function SelectInput<T extends string>({
  id, label, hint, error, value, onChange, options, required, placeholder, autoComplete, wrapClassName,
}: { id: string; label: ReactNode; hint?: ReactNode; error?: string; value: T | ''; onChange: (v: T) => void; options: ReadonlyArray<{ id: T; label: string }>; required?: boolean; placeholder?: string; autoComplete?: string; wrapClassName?: string }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      <span className="relative block">
        <select
          id={id}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value as T)}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(fieldCls(error), 'h-12 appearance-none pr-10')}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-ink" />
      </span>
    </FieldShell>
  )
}

/** Big manga toggle (role=switch). */
export function Switch({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={cn(
          'press relative mt-0.5 h-8 w-14 shrink-0 border-[3px] border-ink transition-colors duration-150',
          checked ? 'bg-door' : 'bg-tone-4',
        )}
      >
        <motion.span
          aria-hidden="true"
          className="absolute top-[2px] block size-[22px] border-2 border-ink bg-volt"
          animate={{ left: checked ? 26 : 2 }}
          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-bold leading-tight text-ink">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="mt-0.5 block text-[13px] leading-snug text-tone-2">
            {hint}
          </span>
        )}
      </label>
    </div>
  )
}
