'use client'
// Customer login panel (owner: AUTH) — used by the login modal and the /login page.
// Google (Supabase OAuth) · MyAnimeList (own OAuth, hidden until configured) · email + password (sign in / create
// account) · forgot password · magic link. Kado reacts (#68 character login): covers up while you type a password,
// shocked on an error, cheers when you're in. Every action answers within one frame (pressed state + label morph).
import { useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, MailCheck, Sparkles } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { safeNext } from '@/lib/auth/shared'
import { useAuthProviders, type AuthProviders } from '@/lib/auth/providers'
import { Mascot, type MascotMood } from '@/components/brand/Mascot'
import { Sfx } from '@/components/fx/Sfx'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup' | 'forgot' | 'magic' | 'sent'

export interface LoginPanelProps {
  /** headline, e.g. "Log in to add Cursed Static to your cart" */
  reason?: string
  /** where to land after a redirect login (default: this page) */
  next?: string
  /** login finished in-page (modal shows its own success) */
  success?: boolean
  /** called right before the page leaves for Google / MAL / an email link (stash the pending action) */
  onBeforeRedirect?: () => void
  /** /login page: an error code from the callback (?error=…) */
  errorCode?: string | null
  /** id for the dialog title (modal aria-labelledby) */
  titleId?: string
  initialMode?: 'signin' | 'signup'
}

const CALLBACK_ERRORS: Record<string, string> = {
  'link-expired': 'That link has expired or was already used. Ask for a fresh one below.',
  denied: 'Login was cancelled. No worries — pick any way in below.',
  callback: 'We couldn’t finish that login. Please try again.',
  unconfigured: 'Accounts aren’t switched on yet. Try again soon.',
  'mal-unavailable': 'MyAnimeList login is coming soon.',
  'mal-staff': 'Team accounts can’t use MyAnimeList login. Sign in to the admin with your email and password.',
  'mal-denied': 'MyAnimeList login was cancelled.',
  'mal-state': 'That MyAnimeList login timed out. Tap the button again.',
  'mal-token': 'MyAnimeList didn’t accept the login. Please try again.',
  'mal-api': 'MyAnimeList is not answering right now. Try again in a minute.',
  'mal-linked-elsewhere': 'That MyAnimeList account is already linked to another Escape Door account.',
  'mal-session': 'We couldn’t start your session. Please try again.',
  'mal-server': 'Something broke on our side. Please try again.',
}

/** "Use Google for now." — only names the login methods that work right now (never sends people in a circle). */
function otherWays(p: AuthProviders | null, not: 'google' | 'mal' | 'email'): string {
  const ways = [p?.google && not !== 'google' ? 'Google' : null, p?.mal && not !== 'mal' ? 'MyAnimeList' : null, p?.email && not !== 'email' ? 'email' : null].filter(Boolean)
  return ways.length ? ` Use ${ways.join(' or ')} for now.` : ' Please try again a little later.'
}

function friendly(message: string | undefined, p: AuthProviders | null): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match. Try again, or reset your password.'
  if (m.includes('email not confirmed')) return 'Confirm your email first — we sent you a link. (Check spam too.)'
  if (m.includes('rate') || m.includes('too many') || m.includes('security purposes')) return 'Too many tries in a row. Give it a minute, then try again.'
  if (m.includes('password') && (m.includes('short') || m.includes('least') || m.includes('weak'))) return 'Use at least 8 characters for your password.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account — sign in instead.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return `New email sign-ups are paused right now.${otherWays(p, 'email')}`
  // Supabase's built-in mailer only reaches team addresses until custom SMTP is set up (docs/SETUP_LOGIN.md, step 4)
  if (m.includes('not authorized') || m.includes('error sending') || m.includes('sending confirmation') || m.includes('sending magic link') || m.includes('sending recovery'))
    return `We can’t send login emails just yet.${otherWays(p, 'email')}`
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return `Google login isn’t switched on yet.${otherWays(p, 'google')}`
  if (m.includes('fetch') || m.includes('network')) return 'We couldn’t reach the server. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const input =
  'mt-1.5 block min-h-12 w-full border-[3px] border-ink bg-paper px-3 text-[16px] text-ink placeholder:text-tone-3 transition-shadow duration-150 focus:outline-none focus-visible:shadow-hard-door aria-[invalid=true]:border-hype'

export function LoginPanel({ reason, next, success, onBeforeRedirect, errorCode, titleId, initialMode = 'signin' }: LoginPanelProps) {
  const id = useId()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [show, setShow] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const [busy, setBusy] = useState<null | 'google' | 'mal' | 'email'>(null)
  const [error, setError] = useState<string | null>(errorCode ? CALLBACK_ERRORS[errorCode] ?? CALLBACK_ERRORS.callback : null)
  const [field, setField] = useState<'email' | 'password' | 'name' | null>(null)
  const [sentWhat, setSentWhat] = useState<'confirm' | 'reset' | 'magic'>('confirm')
  const providers = useAuthProviders()
  // null while checking; false = not switched on yet (button shows "Coming soon")
  const mal = providers ? providers.mal : null
  const googleOn = providers ? providers.google : null
  const [shake, setShake] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)

  const target = () => safeNext(next ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/account'), '/account')
  const origin = () => window.location.origin

  const fail = (msg: string, f: typeof field = null) => {
    setError(msg)
    setField(f)
    setShake((n) => n + 1)
    setBusy(null)
  }

  async function google() {
    if (googleOn === false) return
    const sb = supabaseBrowser()
    if (!sb) return fail('Accounts aren’t switched on yet.')
    setBusy('google')
    setError(null)
    onBeforeRedirect?.()
    const { error: e } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(target())}` },
    })
    if (e) fail(friendly(e.message, providers))
  }

  function myAnimeList() {
    if (!mal) return
    setBusy('mal')
    setError(null)
    onBeforeRedirect?.()
    window.location.assign(`/api/auth/mal/start?next=${encodeURIComponent(target())}`)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const sb = supabaseBrowser()
    if (!sb) return fail('Accounts aren’t switched on yet.')
    const em = email.trim()
    if (!EMAIL.test(em)) {
      emailRef.current?.focus()
      return fail('Enter a valid email address.', 'email')
    }
    if ((mode === 'signin' || mode === 'signup') && password.length < (mode === 'signup' ? 8 : 1)) {
      return fail(mode === 'signup' ? 'Use at least 8 characters for your password.' : 'Enter your password.', 'password')
    }
    setBusy('email')
    setError(null)
    setField(null)
    try {
      if (mode === 'signin') {
        const { error: err } = await sb.auth.signInWithPassword({ email: em, password })
        if (err) return fail(friendly(err.message, providers), /invalid login/i.test(err.message) ? 'password' : null)
        setBusy(null) // provider picks up SIGNED_IN → success
        return
      }
      if (mode === 'signup') {
        onBeforeRedirect?.()
        const { data, error: err } = await sb.auth.signUp({
          email: em,
          password,
          options: {
            emailRedirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(target())}`,
            data: name.trim() ? { full_name: name.trim().slice(0, 80) } : undefined,
          },
        })
        if (err) return fail(friendly(err.message, providers))
        if (data.session) {
          setBusy(null)
          return
        }
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setMode('signin')
          return fail('That email already has an account — sign in instead.', 'email')
        }
        setSentWhat('confirm')
        setMode('sent')
        setBusy(null)
        return
      }
      if (mode === 'forgot') {
        const { error: err } = await sb.auth.resetPasswordForEmail(em, { redirectTo: `${origin()}/auth/callback?flow=recovery` })
        if (err) return fail(friendly(err.message, providers))
        setSentWhat('reset')
        setMode('sent')
        setBusy(null)
        return
      }
      if (mode === 'magic') {
        onBeforeRedirect?.()
        const { error: err } = await sb.auth.signInWithOtp({
          email: em,
          options: { emailRedirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(target())}`, shouldCreateUser: true },
        })
        if (err) return fail(friendly(err.message, providers))
        setSentWhat('magic')
        setMode('sent')
        setBusy(null)
      }
    } catch (x) {
      fail(friendly(x instanceof Error ? x.message : undefined, providers))
    }
  }

  const mood: MascotMood = success ? 'cheer' : error ? 'shock' : busy ? 'work' : pwFocus && !show ? 'sleepy' : mode === 'sent' ? 'wave' : 'peek'
  const headline = success ? 'You’re in!' : reason || 'Step through the door'
  const tabs: Array<{ id: 'signin' | 'signup'; label: string }> = [
    { id: 'signin', label: 'Sign in' },
    { id: 'signup', label: 'Create account' },
  ]

  return (
    <div className="relative">
      {/* header strip: Kado + headline */}
      <div className="relative flex items-end gap-3 border-b-4 border-ink bg-volt py-4 pl-4 pr-14 sm:pl-6">
        <div aria-hidden="true" className="screentone screentone-light pointer-events-none absolute inset-0 [--tone-opacity:0.18]" />
        <div className="relative -mb-4 shrink-0">
          <Mascot mood={mood} size={84} animate title="" />
          <AnimatePresence>
            {success && (
              <motion.span
                key="sfx"
                className="absolute -right-7 -top-3"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: -8 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                aria-hidden="true"
              >
                <Sfx text="IN!" size={30} tone="hype" rotate={-8} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="label text-[11px] text-ink/70">
            Members only · <span lang="ja">会員</span>
          </p>
          <h2
            id={titleId}
            className={cn(
              'mt-1.5 font-display uppercase leading-[0.92] text-ink',
              headline.length > 28 ? 'text-[clamp(1.35rem,4.6vw,2rem)]' : 'text-[clamp(1.75rem,6vw,2.4rem)]',
            )}
          >
            {headline}
          </h2>
        </div>
      </div>

      <div className="px-5 pb-6 pt-5 sm:px-7">
        <p role="status" aria-live="polite" className="sr-only">
          {success ? 'Signed in.' : ''}
        </p>
        {mode !== 'sent' && !success && (
          <p className="text-[15px] leading-snug text-tone-2">
            Log in to add to cart, keep your wishlist and get fest reminders{mal ? ' — plus picks based on what you watch' : ''}.
          </p>
        )}

        {error && (
          <motion.p
            key={shake}
            role="alert"
            initial={{ x: -8 }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 700, damping: 12 }}
            className="mt-4 border-[3px] border-ink bg-hype px-3 py-2 text-[14px] font-bold text-paper"
          >
            {error}
          </motion.p>
        )}

        {success ? (
          <p className="mt-4 font-display text-[22px] uppercase leading-none text-ink">Opening the door…</p>
        ) : mode === 'sent' ? (
          <SentNote what={sentWhat} email={email} onBack={() => setMode('signin')} />
        ) : (
          <>
            {/* social */}
            <div className="mt-5 grid gap-2.5">
              <button
                type="button"
                onClick={google}
                disabled={!!busy || googleOn === false}
                aria-describedby={googleOn === false ? `${id}-google-soon` : undefined}
                className={cn(
                  'press focus-ring flex min-h-12 w-full items-center justify-center gap-3 border-[3px] border-ink px-4 font-bold shadow-hard-sm disabled:opacity-60',
                  googleOn === false ? 'cursor-not-allowed bg-tone-4/40 text-ink/70 shadow-none disabled:opacity-100' : 'bg-paper text-ink',
                )}
              >
                {busy === 'google' ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <GoogleMark />}
                <span className="whitespace-nowrap">{busy === 'google' ? 'Opening Google…' : googleOn === false ? 'Google' : 'Continue with Google'}</span>
                {googleOn === false && (
                  <span id={`${id}-google-soon`} className="label ml-1 shrink-0 border-2 border-ink bg-volt px-1.5 py-0.5 text-[10px] text-ink">
                    Coming soon
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={myAnimeList}
                disabled={!!busy || !mal}
                aria-describedby={mal === false ? `${id}-mal-soon` : undefined}
                className={cn(
                  'press focus-ring flex min-h-12 w-full items-center justify-center gap-3 border-[3px] border-ink px-4 font-bold shadow-hard-sm',
                  mal ? 'bg-[#2E51A2] text-paper' : 'cursor-not-allowed bg-tone-4/40 text-ink/70 shadow-none',
                )}
              >
                {busy === 'mal' ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <span aria-hidden="true" className="grid size-6 place-items-center border-2 border-current font-display text-[11px] leading-none">MAL</span>}
                <span className="whitespace-nowrap">{busy === 'mal' ? 'Opening MyAnimeList…' : mal === false ? 'MyAnimeList' : 'Continue with MyAnimeList'}</span>
                {mal === false && (
                  <span id={`${id}-mal-soon`} className="label ml-1 shrink-0 border-2 border-ink bg-volt px-1.5 py-0.5 text-[10px] text-ink">
                    Coming soon
                  </span>
                )}
              </button>
              {mal && <p className="text-[12.5px] text-tone-3">MyAnimeList imports what you watch so we can match merch to your shows. We never post anything.</p>}
            </div>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-[3px] flex-1 bg-ink" />
              <span className="label text-[11px] text-tone-3">or with email</span>
              <span className="h-[3px] flex-1 bg-ink" />
            </div>

            {(mode === 'signin' || mode === 'signup') && (
              <div role="tablist" aria-label="Email login" className="mb-4 grid grid-cols-2 border-[3px] border-ink">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === t.id}
                    onClick={() => {
                      setMode(t.id)
                      setError(null)
                      setField(null)
                    }}
                    className={cn(
                      'focus-ring min-h-11 font-display text-[17px] uppercase tracking-[0.02em] transition-colors duration-150',
                      mode === t.id ? 'bg-ink text-volt' : 'bg-paper text-ink hover:bg-lav',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {(mode === 'forgot' || mode === 'magic') && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
                className="focus-ring label mb-3 inline-flex min-h-11 items-center gap-1.5 text-[12px] text-ink hover:text-door"
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in
              </button>
            )}

            <form onSubmit={submit} noValidate className="grid gap-3.5" aria-busy={busy === 'email'}>
              {mode === 'forgot' && <p className="text-[15px] text-tone-2">Enter your email and we’ll send a link to set a new password.</p>}
              {mode === 'magic' && <p className="text-[15px] text-tone-2">No password needed — we’ll email you a one-tap login link.</p>}
              {mode === 'signup' && (
                <label htmlFor={`${id}-name`} className="block text-[14px] font-bold text-ink">
                  Your name <span className="font-normal text-tone-3">(optional)</span>
                  <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={input} aria-invalid={field === 'name' || undefined} />
                </label>
              )}
              <label htmlFor={`${id}-email`} className="block text-[14px] font-bold text-ink">
                Email
                <input
                  ref={emailRef}
                  id={`${id}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (field === 'email') setField(null)
                  }}
                  maxLength={120}
                  placeholder="you@example.com"
                  className={input}
                  aria-invalid={field === 'email' || undefined}
                />
              </label>
              {(mode === 'signin' || mode === 'signup') && (
                <label htmlFor={`${id}-pw`} className="block text-[14px] font-bold text-ink">
                  <span className="flex items-center justify-between gap-2">
                    Password
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot')
                          setError(null)
                        }}
                        className="focus-ring text-[13px] font-bold text-door underline decoration-2 underline-offset-2"
                      >
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <span className="relative block">
                    <input
                      id={`${id}-pw`}
                      type={show ? 'text' : 'password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      minLength={mode === 'signup' ? 8 : undefined}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (field === 'password') setField(null)
                      }}
                      onFocus={() => setPwFocus(true)}
                      onBlur={() => setPwFocus(false)}
                      maxLength={72}
                      className={cn(input, 'pr-12')}
                      aria-invalid={field === 'password' || undefined}
                      aria-describedby={mode === 'signup' ? `${id}-pw-hint` : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? 'Hide password' : 'Show password'}
                      aria-pressed={show}
                      className="focus-ring absolute right-1 top-1/2 mt-[3px] grid size-11 -translate-y-1/2 place-items-center text-ink"
                    >
                      {show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
                    </button>
                  </span>
                  {mode === 'signup' && (
                    <span id={`${id}-pw-hint`} className="mt-1 block text-[12.5px] font-normal text-tone-3">
                      At least 8 characters.
                    </span>
                  )}
                </label>
              )}

              <button
                type="submit"
                disabled={!!busy}
                className="press focus-ring mt-1 flex min-h-13 w-full items-center justify-center gap-2.5 border-[3px] border-ink bg-ink px-5 py-3 font-display text-[20px] uppercase tracking-[0.02em] text-volt shadow-hard-door disabled:opacity-70"
              >
                {busy === 'email' ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : mode === 'magic' ? <Sparkles aria-hidden="true" className="size-5" /> : <Mail aria-hidden="true" className="size-5" />}
                {busy === 'email'
                  ? mode === 'signup'
                    ? 'Making your account…'
                    : mode === 'signin'
                      ? 'Opening the door…'
                      : 'Sending…'
                  : mode === 'signup'
                    ? 'Create my account'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : mode === 'magic'
                        ? 'Email me a login link'
                        : 'Sign in'}
              </button>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('magic')
                    setError(null)
                  }}
                  className="focus-ring mx-auto min-h-11 text-[14px] font-bold text-ink underline decoration-2 underline-offset-4 hover:text-door"
                >
                  Email me a login link instead
                </button>
              )}
            </form>
          </>
        )}

        <p className="mt-5 text-[12.5px] leading-snug text-tone-3">
          We only keep your name, email and what you browse here to run your account and pick things for you.{' '}
          <Link href="/policies/privacy" className="font-bold text-ink underline decoration-2 underline-offset-2">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/policies/terms" className="font-bold text-ink underline decoration-2 underline-offset-2">
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}

function SentNote({ what, email, onBack }: { what: 'confirm' | 'reset' | 'magic'; email: string; onBack: () => void }) {
  const copy = {
    confirm: { h: 'Check your inbox', b: `We sent a confirmation link to ${email}. Tap it and you’re in.` },
    reset: { h: 'Reset link sent', b: `If ${email} has an account, a link to set a new password is on its way.` },
    magic: { h: 'Login link sent', b: `We emailed a one-tap login link to ${email}. Open it on this device.` },
  }[what]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="mt-5 border-[3px] border-ink bg-lav p-4 shadow-hard-sm"
    >
      <p className="flex items-center gap-2 font-display text-[24px] uppercase leading-none text-ink">
        <MailCheck aria-hidden="true" className="size-6" /> {copy.h}
      </p>
      <p className="mt-2 text-[15px] text-ink">{copy.b}</p>
      <p className="mt-1 text-[13px] text-ink/70">Nothing after a couple of minutes? Check spam or promotions.</p>
      <button type="button" onClick={onBack} className="focus-ring label mt-3 inline-flex min-h-11 items-center gap-1.5 text-[12px] text-ink hover:text-door">
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in
      </button>
    </motion.div>
  )
}

/** Google "G" mark (Google sign-in branding guidelines). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default LoginPanel
