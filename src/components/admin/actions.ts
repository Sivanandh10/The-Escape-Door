'use server'
// Admin auth Server Actions (P4a): owner-only email+password sign-in and sign-out (stack-notes §7.3).
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export type SignInState =
  | { status: 'idle' }
  | { status: 'error'; code: 'invalid' | 'credentials' | 'not-owner' | 'unconfigured' | 'rate-limited' | 'server'; message: string; field?: 'email' | 'password' }
  | { status: 'ok' }

const Creds = z.object({
  email: z.email({ error: 'That doesn’t look like an email.' }).max(200),
  password: z.string().min(6, { error: 'Password is at least 6 characters.' }).max(200),
})

export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', code: 'unconfigured', message: 'Supabase isn’t connected yet — use the demo admin instead.' }
  }
  const parsed = Creds.safeParse({ email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { status: 'error', code: 'invalid', message: issue?.message ?? 'Check the form.', field: issue?.path[0] === 'password' ? 'password' : 'email' }
  }
  const sb = await supabaseServer()
  if (!sb) return { status: 'error', code: 'unconfigured', message: 'Supabase isn’t connected yet.' }

  const { data, error } = await sb.auth.signInWithPassword(parsed.data)
  if (error || !data.user) {
    const rate = error?.status === 429
    return rate
      ? { status: 'error', code: 'rate-limited', message: 'Too many tries. Wait a minute, then knock again.' }
      : { status: 'error', code: 'credentials', message: 'Wrong email or password. This door only opens for the owner.', field: 'password' }
  }

  // owner check: admins table (is_admin()) + optional ADMIN_EMAILS allow-list
  const { data: isAdmin } = await sb.rpc('is_admin')
  const allow = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const emailOk = allow.length === 0 || allow.includes((data.user.email ?? '').toLowerCase())
  if (isAdmin !== true || !emailOk) {
    await sb.auth.signOut()
    return { status: 'error', code: 'not-owner', message: 'You signed in, but this account isn’t on the owner list (admins table).' }
  }
  return { status: 'ok' }
}

export async function signOutAction(): Promise<void> {
  const sb = await supabaseServer()
  if (sb) await sb.auth.signOut()
  redirect('/admin/login?e=signed-out')
}
