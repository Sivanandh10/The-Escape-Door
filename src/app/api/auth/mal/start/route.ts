// GET /api/auth/mal/start?next=/path — begin "Continue with MyAnimeList" (owner: AUTH).
// PKCE verifier + state go into short-lived httpOnly cookies scoped to /api/auth/mal, then we redirect to MAL.
import { NextResponse } from 'next/server'
import { requestOrigin } from '@/lib/auth/customer-server'
import { safeNext } from '@/lib/auth/shared'
import { MAL_COOKIE, MAL_COOKIE_PATH, authorizeUrl, malConfig, newState, newVerifier } from '@/lib/auth/mal'

export async function GET(req: Request) {
  const origin = requestOrigin(req)
  const url = new URL(req.url)
  const next = safeNext(url.searchParams.get('next'), '/account')
  const cfg = await malConfig()
  if (!cfg) return NextResponse.redirect(new URL(`/login?error=mal-unavailable&next=${encodeURIComponent(next)}`, origin))
  // the PKCE cookies must live on the host MAL sends the shopper back to (the registered redirect URI). Started on
  // another host (custom domain, preview) → hop to the redirect URI's host first; localhost dev keeps its own host
  // (set MAL_REDIRECT_URI to the local callback, registered at MAL, to test there).
  let redirectOrigin = origin
  try {
    redirectOrigin = new URL(cfg.redirectUri).origin
  } catch {
    /* malformed setting → keep this host */
  }
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin)
  if (redirectOrigin !== origin && !local && url.searchParams.get('hop') !== '1') {
    const hop = new URL('/api/auth/mal/start', redirectOrigin)
    hop.searchParams.set('next', next)
    hop.searchParams.set('hop', '1')
    return NextResponse.redirect(hop)
  }

  const verifier = newVerifier()
  const state = newState()
  const res = NextResponse.redirect(authorizeUrl({ clientId: cfg.clientId, verifier, state, redirectUri: cfg.redirectUri }))
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax' as const,
    path: MAL_COOKIE_PATH,
    maxAge: 600,
  }
  res.cookies.set(MAL_COOKIE.verifier, verifier, opts)
  res.cookies.set(MAL_COOKIE.state, state, opts)
  res.cookies.set(MAL_COOKIE.next, next, opts)
  res.headers.set('cache-control', 'private, no-store')
  res.headers.set('x-robots-tag', 'noindex')
  return res
}
