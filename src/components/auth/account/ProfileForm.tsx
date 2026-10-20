'use client'
// /account profile form (owner: AUTH): name + phone (used to pre-fill checkout and reminders). Email is the login
// and read-only here. Inline validation, < 100 ms feedback, saved state stamps "SAVED".
import { useId, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile } from '@/lib/auth/actions'
import { useCustomer } from '@/lib/auth/customer'
import { cn } from '@/lib/utils'

const input =
  'mt-1.5 block min-h-12 w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink placeholder:text-tone-3 transition-shadow duration-150 focus:outline-none focus-visible:shadow-hard-door aria-[invalid=true]:border-hype'

export function ProfileForm({ initial, email, synthetic, provider }: { initial: { name: string; phone: string }; email: string; synthetic: boolean; provider: string }) {
  const id = useId()
  const { refresh } = useCustomer()
  const [name, setName] = useState(initial.name)
  const [phone, setPhone] = useState(initial.phone)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [stamp, setStamp] = useState(0)
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null)
  const dirty = name.trim() !== saved.name || phone.trim() !== saved.phone

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !dirty) return
    setBusy(true)
    setErr(null)
    const r = await updateProfile({ name, phone })
    setBusy(false)
    if (!r.ok) {
      setErr({ field: r.field, msg: r.error })
      return
    }
    const next = { name: r.data.name ?? '', phone: r.data.phone ?? '' }
    setSaved(next)
    setName(next.name)
    setPhone(next.phone)
    setStamp((n) => n + 1)
    toast.success('Profile saved.')
    void refresh?.()
  }

  return (
    <form onSubmit={submit} noValidate className="relative mt-6 grid gap-4 border-4 border-ink bg-paper p-5 text-ink shadow-hard-door sm:p-7 md:grid-cols-2">
      <label htmlFor={`${id}-name`} className="block text-[14px] font-bold">
        Name
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={input} aria-invalid={err?.field === 'name' || undefined} />
      </label>
      <label htmlFor={`${id}-phone`} className="block text-[14px] font-bold">
        WhatsApp / phone <span className="font-normal text-tone-3">(optional)</span>
        <input
          id={`${id}-phone`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={24}
          placeholder="+91 98765 43210"
          className={input}
          aria-invalid={err?.field === 'phone' || undefined}
          aria-describedby={`${id}-phone-hint`}
        />
        <span id={`${id}-phone-hint`} className="mt-1 block text-[12.5px] font-normal text-tone-3">
          Pre-fills checkout and fest reminders. Never shown publicly.
        </span>
      </label>
      <div className="md:col-span-2">
        <p className="text-[14px] font-bold">Login</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px]">
          <span className="label border-2 border-ink bg-lav px-2 py-1 text-[10px]">{provider}</span>
          {synthetic ? <span className="text-tone-2">Signed in with MyAnimeList (no email on file)</span> : <span className="break-all">{email}</span>}
        </p>
      </div>
      {err && (
        <p role="alert" className="border-[3px] border-ink bg-hype px-3 py-2 text-[14px] font-bold text-paper md:col-span-2">
          {err.msg}
        </p>
      )}
      <div className="flex items-center gap-4 md:col-span-2">
        <button
          type="submit"
          disabled={busy || !dirty}
          className={cn(
            'press focus-ring inline-flex min-h-12 items-center gap-2 border-[3px] border-ink px-5 font-display text-[19px] uppercase tracking-[0.02em] shadow-hard-sm',
            dirty ? 'bg-ink text-volt' : 'cursor-default bg-tone-4/40 text-ink/60 shadow-none',
          )}
        >
          {busy && <Loader2 aria-hidden="true" className="size-5 animate-spin" />}
          {busy ? 'Saving…' : 'Save details'}
        </button>
        <AnimatePresence>
          {stamp > 0 && !dirty && (
            <motion.span
              key={stamp}
              initial={{ scale: 1.6, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: -8, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              aria-hidden="true"
              className="inline-flex items-center gap-1 border-4 border-double border-door px-2 py-0.5 font-display text-[20px] uppercase text-door"
            >
              <Check className="size-5" /> Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </form>
  )
}

export default ProfileForm
