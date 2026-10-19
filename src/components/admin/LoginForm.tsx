'use client'
// Owner login (P4a) with the #68 character touch: Kado covers its eyes while the password field has focus,
// and peeks through when "show password" is on. Designed errors shake the panel.
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { cn } from '@/lib/utils'
import { signInAction, type SignInState } from './actions'
import { adminBtn, adminInput, adminLabel } from './ui'

const NOTES: Record<string, string> = {
  'not-owner': 'That account is signed in but isn’t on the owner list (admins table).',
  'signed-out': 'Door closed. You’re signed out.',
}

function Hands({ cover, peek }: { cover: boolean; peek: boolean }) {
  // overlay in the mascot's 200×220 viewBox; mitts slide up over the eyes (82,76) / (118,76)
  const t = 'transform 260ms cubic-bezier(0.34,1.56,0.64,1)'
  const mitt = (x: number, lift: boolean) => (
    <g style={{ transform: lift ? 'translate(0,0)' : 'translate(0px,96px)', transition: t }}>
      <path d={`M${x < 100 ? 72 : 128} 156 L${x} 84`} stroke="#0B0B0F" strokeWidth="17" strokeLinecap="round" />
      <path d={`M${x < 100 ? 72 : 128} 156 L${x} 84`} stroke="#0B0B0F" strokeWidth="13" strokeLinecap="round" />
      <circle cx={x} cy={78} r={15} fill="#0B0B0F" stroke="#F4EFE6" strokeWidth="3.2" />
    </g>
  )
  return (
    <svg viewBox="0 0 200 220" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {mitt(82, cover && !peek)}
      {mitt(118, cover)}
    </svg>
  )
}

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, { status: 'idle' })
  const [pwFocus, setPwFocus] = useState(false)
  const [show, setShow] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const note = NOTES[params.get('e') ?? '']

  useEffect(() => {
    if (state.status === 'error') setShakeKey((k) => k + 1)
    if (state.status === 'ok') {
      const next = params.get('next')
      router.replace(next && next.startsWith('/admin') ? next : '/admin')
      router.refresh()
    }
  }, [state, params, router])

  const err = state.status === 'error' ? state : null

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* character panel */}
      <div className="screentone screentone-mid relative hidden items-center justify-center overflow-hidden border-r-4 border-ink bg-door [--tone-color:var(--color-ink)] [--tone-opacity:0.18] lg:flex">
        <p aria-hidden="true" className="absolute left-8 top-8 font-display text-[clamp(64px,9vw,150px)] uppercase leading-[0.82] text-paper/90">
          Owner&apos;s<br />room
        </p>
        <p aria-hidden="true" lang="ja" className="absolute bottom-8 right-8 font-sfx-jp text-[48px] text-volt [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke_fill]">
          {pwFocus && !show ? 'みてない!' : 'ようこそ'}
        </p>
        <div className="relative size-[min(34vw,420px)]">
          <Mascot mood={show && pwFocus ? 'peek' : 'idle'} animate title="" className="h-full w-full" />
          <Hands cover={pwFocus} peek={show} />
        </div>
      </div>

      {/* form */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div key={shakeKey} className={cn('w-full max-w-[440px]', shakeKey > 0 && 'admin-shake')}>
          <div className="mb-6 flex items-end gap-4 lg:hidden">
            <div className="relative size-[96px] shrink-0">
              <Mascot mood={show && pwFocus ? 'peek' : 'idle'} animate title="" className="h-full w-full" />
              <Hands cover={pwFocus} peek={show} />
            </div>
            <p lang="ja" className="jp-sub pb-3">管理室</p>
          </div>
          <p className="label text-volt">The Escape Door · admin</p>
          <h1 className="mt-2 font-display text-[clamp(48px,7vw,84px)] uppercase leading-[0.86]">
            Knock <em>knock</em>
          </h1>
          <p className="mt-3 text-[15px] text-paper/70">Owner-only. Sign in with the email and password set up in Supabase Auth.</p>

          {note && <p role="status" className="mt-5 border-2 border-lav bg-lav/10 px-3 py-2 text-[13.5px]">{note}</p>}

          {demo ? (
            <div className="mt-6 border-2 border-volt bg-volt/10 p-4">
              <p className="font-display text-[22px] uppercase leading-none text-volt">Demo mode</p>
              <p className="mt-2 text-[14px] text-paper/75">
                Supabase isn&apos;t connected, so there&apos;s nothing to sign in to. Browse the admin with clearly labelled sample data.
              </p>
              <Link href="/admin" className={adminBtn({ className: 'mt-4 w-full' })}>Enter demo admin</Link>
            </div>
          ) : (
            <form action={action} className="mt-6 space-y-4 border-2 border-paper/15 bg-tone-1 p-5 shadow-[6px_6px_0_var(--color-door)]" noValidate>
              <div>
                <label htmlFor="adm-email" className={adminLabel}>Email</label>
                <div className="relative">
                  <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-paper/45" />
                  <input id="adm-email" name="email" type="email" autoComplete="username" required
                    aria-invalid={err?.field === 'email' || undefined} aria-describedby={err ? 'adm-err' : undefined}
                    className={cn(adminInput, 'pl-9')} />
                </div>
              </div>
              <div>
                <label htmlFor="adm-pw" className={adminLabel}>Password</label>
                <div className="relative">
                  <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-paper/45" />
                  <input id="adm-pw" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required
                    onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                    aria-invalid={err?.field === 'password' || undefined} aria-describedby={err ? 'adm-err' : undefined}
                    className={cn(adminInput, 'pl-9 pr-12')} />
                  <button type="button" onClick={() => setShow((s) => !s)} onMouseDown={(e) => e.preventDefault()}
                    aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
                    className="absolute right-0 top-0 grid size-11 place-items-center text-paper/60 focus-ring can-hover:hover:text-volt">
                    {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                  </button>
                </div>
              </div>
              {err && (
                <p id="adm-err" role="alert" className="border-l-4 border-hype bg-hype/10 px-3 py-2 text-[13.5px]">
                  <strong className="mr-1 font-display text-[16px] uppercase tracking-[0.02em] text-hype">Locked.</strong>
                  {err.message}
                </p>
              )}
              <button type="submit" disabled={pending} className={adminBtn({ className: 'w-full' })}>
                {pending ? 'Turning the key…' : state.status === 'ok' ? 'Door open!' : 'Open the door'}
              </button>
            </form>
          )}
          <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper/60 focus-ring can-hover:hover:text-volt">
            ← Back to the shop
          </Link>
        </div>
      </div>
    </div>
  )
}
