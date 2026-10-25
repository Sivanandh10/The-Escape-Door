// GET /api/auth/mal/callback — MyAnimeList redirects here (owner: AUTH).
// 1. validate state (cookie) → 2. exchange the code (PKCE plain) → 3. import @me + anime list + suggestions →
// 4a. signed in already → link MAL to this account, or
// 4b. signed out → find the account linked to this MAL id (staff refused), or create one (random never-mailed email,
//     email_confirm) → sign in server-side: admin.generateLink(magiclink) → verifyOtp(token_hash) sets the cookies.
// Stores the import snapshot + the MAL refresh token (server-only column). Never logs tokens.
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { ensureProfile, getAuthUser, isStaff, requestOrigin } from '@/lib/auth/customer-server'
import { malSyntheticEmail, safeNext } from '@/lib/auth/shared'
import { MAL_COOKIE, MAL_COOKIE_PATH, MalError, exchangeCode, importMal, malConfig } from '@/lib/auth/mal'
import { importMalRich } from '@/lib/auth/mal-import'

export async function GET(req: Request) {
  const origin = requestOrigin(req)
  const url = new URL(req.url)
  const jar = await cookies()
  const next = safeNext(jar.get(MAL_COOKIE.next)?.value, '/account')
  const verifier = jar.get(MAL_COOKIE.verifier)?.value
  const expected = jar.get(MAL_COOKIE.state)?.value

  const done = (to: string, flash?: string) => {
    const res = NextResponse.redirect(new URL(to, origin))
    for (const name of Object.values(MAL_COOKIE)) res.cookies.set(name, '', { path: MAL_COOKIE_PATH, maxAge: 0 })
    if (flash) res.cookies.set('ted_flash', flash, { path: '/', maxAge: 60, sameSite: 'lax', secure: process.env.NODE_ENV !== 'development' })
    res.headers.set('cache-control', 'private, no-store')
    res.headers.set('x-robots-tag', 'noindex')
    return res
  }
  const fail = (code: string) => done(`/login?error=mal-${code}&next=${encodeURIComponent(next)}`)

  const cfg = await malConfig()
  if (!cfg) return fail('unavailable')
  if (url.searchParams.get('error')) return fail('denied')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state || !verifier || !expected || state !== expected) return fail('state')

  const sa = supabaseAdmin()
  if (!sa) return fail('server')

  // ---- talk to MAL
  let imported: Awaited<ReturnType<typeof importMal>>
  let refreshToken = ''
  let expiresIn = 0
  try {
    const tokens = await exchangeCode(code, verifier, cfg.redirectUri)
    refreshToken = tokens.refresh_token
    expiresIn = tokens.expires_in
    // + rewatch / total episodes / media type for the anime-affinity model (falls back to the plain import)
    imported = await importMalRich(tokens.access_token)
  } catch (e) {
    const c = e instanceof MalError ? e.code : 'api'
    return fail(c.startsWith('token') ? 'token' : 'api')
  }
  const { me, list, stats, suggestions } = imported
  const now = new Date()
  const malRow = {
    mal_id: me.id,
    mal_username: me.name.slice(0, 64),
    picture: me.picture?.slice(0, 600) ?? null,
    refresh_token: refreshToken || null,
    token_expires_at: expiresIn ? new Date(now.getTime() + expiresIn * 1000).toISOString() : null,
    anime_snapshot: list,
    suggestions,
    stats,
    synced_at: now.toISOString(),
  }

  try {
    const { data: linked } = await sa.from('mal_accounts').select('user_id').eq('mal_id', me.id).maybeSingle()
    const current = await getAuthUser()

    // ---- 4a. already signed in → link (never to a team account: staff are not customers, and a MAL login must
    //          never become a way into /admin)
    if (current) {
      if (await isStaff(current.user.id)) return fail('staff')
      if (linked && linked.user_id !== current.user.id) return fail('linked-elsewhere')
      const { error } = await sa.from('mal_accounts').upsert({ user_id: current.user.id, ...malRow }, { onConflict: 'user_id' })
      if (error) return fail('server')
      await ensureProfile(current.user)
      return done(next, 'mal-linked')
    }

    // ---- 4b. signed out → the account linked to this MAL id (looked up ONLY via mal_accounts), or a brand-new one.
    //          The new account's address carries a server-side random nonce, so nobody can pre-register it, and we never
    //          fall back to "whoever already owns that address".
    let userId = (linked?.user_id as string | undefined) ?? null
    let email: string | null = null
    if (userId) {
      if (await isStaff(userId)) return fail('staff')
      const { data } = await sa.auth.admin.getUserById(userId)
      email = data.user?.email ?? null
      if (!email) userId = null // orphaned link → create a fresh account below
    }
    if (!userId) {
      email = malSyntheticEmail(me.id, randomBytes(12).toString('hex'))
      const meta = { name: me.name, avatar_url: me.picture ?? null, provider: 'myanimelist', mal_id: me.id }
      const created = await sa.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta, app_metadata: { ted_provider: 'myanimelist', mal_id: me.id } })
      if (created.error || !created.data.user) return fail('server')
      userId = created.data.user.id
    }
    if (!email || !userId) return fail('server')

    const link = await sa.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = link.data?.properties?.hashed_token
    // the magic link must belong to exactly the account we resolved above
    if (link.error || !tokenHash || link.data?.user?.id !== userId) return fail('session')

    const { error: linkErr } = await sa.from('mal_accounts').upsert({ user_id: userId, ...malRow }, { onConflict: 'user_id' })
    if (linkErr) return fail('server')

    const sb = await supabaseServer()
    if (!sb) return fail('server')
    const { data: session, error: otpErr } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (otpErr || !session.user) return fail('session')
    await ensureProfile(session.user, { name: me.name, avatarUrl: me.picture ?? null })
    return done(next, linked ? 'mal-welcome-back' : 'mal-welcome')
  } catch {
    return fail('server')
  }
}
