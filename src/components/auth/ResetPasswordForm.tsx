'use client'
// Set-a-new-password form (owner: AUTH). Needs the recovery session from /auth/callback?flow=recovery.
import { useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useCustomer } from '@/lib/auth/customer'

const input =
  'mt-1.5 block min-h-12 w-full border-[3px] border-ink bg-paper px-3 pr-12 text-[16px] text-ink transition-shadow duration-150 focus:outline-none focus-visible:shadow-hard-door aria-[invalid=true]:border-hype'

export function ResetPasswordForm() {
  const id = useId()
  const router = useRouter()
  const { customer, loading } = useCustomer()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!loading && !customer) {
    return (
      <div>
        <p className="font-display text-[26px] uppercase leading-none">Link expired</p>
        <p className="mt-2 text-tone-2">That reset link has expired or was already used. Ask for a fresh one from the login screen.</p>
        <Link href="/login?next=/account" className="press focus-ring mt-4 inline-flex min-h-11 items-center border-[3px] border-ink bg-ink px-4 font-display text-[18px] uppercase text-volt">
          Back to login
        </Link>
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    if (pw !== pw2) return setErr('The two passwords don’t match.')
    const sb = supabaseBrowser()
    if (!sb) return setErr('Accounts aren’t switched on yet.')
    setBusy(true)
    setErr(null)
    const { error } = await sb.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(/same/i.test(error.message) ? 'That’s your current password — pick a new one.' : 'Couldn’t update your password. Try again.')
    toast.success('Password updated. You’re all set.')
    router.push('/account')
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-busy={busy}>
      {(['pw', 'pw2'] as const).map((k) => (
        <label key={k} htmlFor={`${id}-${k}`} className="block text-[14px] font-bold">
          {k === 'pw' ? 'New password' : 'Type it again'}
          <span className="relative block">
            <input
              id={`${id}-${k}`}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              value={k === 'pw' ? pw : pw2}
              onChange={(e) => (k === 'pw' ? setPw(e.target.value) : setPw2(e.target.value))}
              className={input}
              aria-invalid={!!err || undefined}
            />
            {k === 'pw' && (
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'} aria-pressed={show} className="focus-ring absolute right-1 top-1/2 mt-[3px] grid size-11 -translate-y-1/2 place-items-center">
                {show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
              </button>
            )}
          </span>
        </label>
      ))}
      {err && (
        <p role="alert" className="border-[3px] border-ink bg-hype px-3 py-2 text-[14px] font-bold text-paper">
          {err}
        </p>
      )}
      <button type="submit" disabled={busy || loading} className="press focus-ring flex min-h-12 items-center justify-center gap-2 border-[3px] border-ink bg-ink px-5 font-display text-[20px] uppercase text-volt shadow-hard-door disabled:opacity-70">
        {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <KeyRound aria-hidden="true" className="size-5" />}
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}

export default ResetPasswordForm
