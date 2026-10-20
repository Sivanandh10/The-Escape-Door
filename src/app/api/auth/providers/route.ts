// GET /api/auth/providers → { google, mal, email, any } — which customer login methods actually work right now.
// The login modal disables the ones that are off, and the shop drops the login gate (WhatsApp ordering, as before
// accounts) while NONE works, so customers can never be locked out of the cart. Owner: INTEGRATOR (AUTH area).
// google  = Supabase Auth → Providers → Google is enabled (read from the public /auth/v1/settings endpoint)
// mal     = MAL_CLIENT_ID is set on the server
// email   = email sign-in is on AND mail actually reaches shoppers: either "Confirm email" is off (autoconfirm) or the
//           owner set AUTH_EMAIL_LIVE=1 after configuring custom SMTP (the built-in mailer only reaches team addresses).
// Never returns keys. Cached for 60 s per instance + 60 s at the CDN.
import { connection } from 'next/server'
import { isMalConfigured } from '@/lib/auth/mal'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env'
import type { AuthProviders } from '@/lib/auth/providers'


let memo: { at: number; value: AuthProviders } | null = null
const TTL = 60_000

async function read(): Promise<AuthProviders> {
  const mal = isMalConfigured()
  let google = false
  let email = false
  if (isSupabaseConfigured()) {
    try {
      const r = await fetch(`${supabaseUrl()}/auth/v1/settings`, {
        headers: { apikey: supabaseAnonKey() },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })
      if (r.ok) {
        const s = (await r.json()) as { external?: Record<string, boolean>; mailer_autoconfirm?: boolean; disable_signup?: boolean }
        google = !!s.external?.google
        const smtpLive = /^(1|true|yes|on)$/i.test((process.env.AUTH_EMAIL_LIVE ?? '').trim())
        email = !!s.external?.email && (!!s.mailer_autoconfirm || smtpLive)
      }
    } catch {
      /* Supabase unreachable → treat Google/email as off for this minute */
    }
  }
  return { google, mal, email, any: google || mal || email }
}

export async function GET() {
  await connection()
  const now = Date.now()
  if (!memo || now - memo.at > TTL) memo = { at: now, value: await read() }
  return new Response(JSON.stringify(memo.value), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30, s-maxage=60',
      'x-robots-tag': 'noindex',
    },
  })
}
