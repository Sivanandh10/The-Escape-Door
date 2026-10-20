// Link guest orders to the account that just logged in (owner: CHECKOUT, minimal hook in AUTH's /auth/callback).
// SERVER ONLY. public.claim_guest_orders() (migration 0010, service role only) does the matching: the order's contact
// email must equal the account's auth email AND this login must have proved control of that inbox (emailProven:
// email link / OTP / Google OAuth landing on /auth/callback), or the account has a Google identity with that verified
// email. Never by phone (profiles.phone is typed, never verified). Password logins never pass emailProven: with
// "Confirm email" off, a password sign-up proves nothing about the address.
// Never throws; returns how many orders were linked (0 before 0010 runs or without the service role).
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function claimGuestOrders(userId: string, opts: { emailProven?: boolean } = {}): Promise<number> {
  try {
    const sa = supabaseAdmin()
    if (!sa || !userId) return 0
    const { data, error } = await sa.rpc('claim_guest_orders', { p_user_id: userId, p_email_proven: opts.emailProven === true })
    if (error) return 0
    return typeof data === 'number' ? data : 0
  } catch {
    return 0
  }
}
