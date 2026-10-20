// GET /auth/callback — Supabase Auth lands here (owner: AUTH):
//   ?code=…                    Google OAuth / email links in PKCE flow → exchangeCodeForSession(code)
//   ?token_hash=…&type=…       email templates that use {{ .TokenHash }} (works across devices) → verifyOtp
//   ?error=…&error_description  provider said no → /login with a friendly message
// Then: create the shopper profile on first login (never for staff) and redirect to `next` (same-site only).
// Password-recovery links go to /account/reset-password.
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'
import { ensureProfile, requestOrigin } from '@/lib/auth/customer-server'
import { safeNext } from '@/lib/auth/shared'

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

export async function GET(req: Request) {
  const origin = requestOrigin(req)
  const url = new URL(req.url)
  const q = url.searchParams
  const type = q.get('type') as EmailOtpType | null
  const recovery = type === 'recovery' || q.get('flow') === 'recovery'
  const next = recovery ? '/account/reset-password' : safeNext(q.get('next'), '/account')

  const go = (to: string, flash?: string) => {
    const res = NextResponse.redirect(new URL(to, origin))
    if (flash) res.cookies.set('ted_flash', flash, { path: '/', maxAge: 60, sameSite: 'lax', secure: process.env.NODE_ENV !== 'development' })
    res.headers.set('cache-control', 'private, no-store')
    res.headers.set('x-robots-tag', 'noindex')
    return res
  }
  const fail = (code: string) => go(`/login?error=${code}&next=${encodeURIComponent(recovery ? '/account' : next)}`)

  if (q.get('error') || q.get('error_code')) {
    const ec = q.get('error_code') ?? q.get('error') ?? ''
    return fail(/expired/i.test(ec) || /expired/i.test(q.get('error_description') ?? '') ? 'link-expired' : ec === 'access_denied' ? 'denied' : 'callback')
  }

  const sb = await supabaseServer()
  if (!sb) return fail('unconfigured')

  const code = q.get('code')
  const tokenHash = q.get('token_hash')
  let user = null
  if (code) {
    const { data, error } = await sb.auth.exchangeCodeForSession(code)
    if (error) return fail(/verifier|expired|invalid/i.test(error.message) ? 'link-expired' : 'callback')
    user = data.user
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { data, error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return fail('link-expired')
    user = data.user
  } else {
    return fail('callback')
  }
  if (!user) return fail('callback')

  await ensureProfile(user)
  return go(next, recovery ? undefined : type === 'signup' || type === 'email' ? 'email-confirmed' : 'signed-in')
}
