// Admin guard (P4a) — Next 16 proxy (stack-notes §1.10 / §7.2). Matcher is ONLY /admin so public pages stay static.
// - Refreshes the Supabase session cookie, redirects signed-out visitors to /admin/login (UX only — RLS is the real gate).
// - Passes the pathname to the admin layout as `x-ted-path` and marks every admin response noindex.
// - Supabase unconfigured → DEMO MODE: no auth, just headers.
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const nextRes = () => {
    const h = new Headers(request.headers)
    h.set('x-ted-path', path)
    const r = NextResponse.next({ request: { headers: h } })
    r.headers.set('x-robots-tag', 'noindex, nofollow')
    return r
  }

  let res = nextRes()
  if (!isSupabaseConfigured()) return res

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        res = nextRes()
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([k, v]) => res.headers.set(k, String(v)))
      },
    },
  })
  // nothing between client creation and getClaims (Supabase SSR guidance)
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const isLogin = path === '/admin/login' || path.startsWith('/admin/login/')

  const redirectTo = (to: URL) => {
    const r = NextResponse.redirect(to)
    res.cookies.getAll().forEach((c) => r.cookies.set(c))
    r.headers.set('cache-control', 'private, no-store')
    r.headers.set('x-robots-tag', 'noindex, nofollow')
    return r
  }

  if (!signedIn && !isLogin) {
    const to = new URL('/admin/login', request.url)
    if (path !== '/admin') to.searchParams.set('next', path)
    return redirectTo(to)
  }
  // signed in and on the login page with no error to show → straight in (the layout bounces non-owners back with ?e=)
  if (signedIn && isLogin && !request.nextUrl.searchParams.has('e')) {
    return redirectTo(new URL('/admin', request.url))
  }
  return res
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
