// POST /api/orders/voucher — voucher check for GUEST checkout (login is optional — policy.ts). Owner: CHECKOUT.
// Same answers as POST /api/vouchers/validate (signed-in customers keep using that one): the cart is re-priced from
// the database, unknown / paused / not-yet-live / personal codes all answer the same 404. Personal (email-assigned)
// and per-customer-limited vouchers never work for a guest — a typed phone / email proves nothing, so their limit
// couldn't be enforced (they answer the same 404). Refused only when NEXT_PUBLIC_LOGIN_REQUIRED=1 (login mandatory).
import { z } from 'zod'
import { formatINR } from '@/lib/pricing'
import { LOGIN_ALWAYS_REQUIRED } from '@/lib/auth/policy'
import { guestVoucherSchema, normalizePhone } from '@/lib/checkout/schema'
import { CheckoutError, GUEST_VOUCHERS_OFF, applyVoucherFor, getBuyer, guestSchemaReady, priceLines } from '@/lib/checkout/server'
import { voucherHeadline } from '@/lib/checkout/types'
import { isSupabaseAdminConfigured } from '@/lib/supabase/env'
import { allow, clientKey, json, readJson, sameOrigin } from '../../_lib/guard'

const HIDDEN = new Set<string>(['not-found', 'inactive', 'not-started', 'not-yours'])
const NOT_USABLE = 'That code can’t be used here. Check the spelling?'

export async function POST(req: Request): Promise<Response> {
  if (!req.headers.get('origin') || !sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  if (!allow(`voucher:ip:${clientKey(req)}`, 30, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'Too many tries — wait a few minutes and try again.' }, 429, { 'retry-after': '600' })
  }
  if (LOGIN_ALWAYS_REQUIRED || (await getBuyer())) return json({ ok: false, error: 'login', message: 'Log in to use a voucher.' }, 401)
  if (!isSupabaseAdminConfigured()) return json({ ok: false, error: 'unavailable', message: 'Vouchers aren’t switched on yet.' }, 503)

  const body = await readJson(req, 16 * 1024)
  if ('error' in body) return json({ ok: false, error: 'invalid', message: 'Something went wrong — try again.' }, 400)
  const parsed = guestVoucherSchema.safeParse(body.data)
  if (!parsed.success) {
    const codeErr = z.flattenError(parsed.error).fieldErrors.code?.[0]
    return json({ ok: false, error: 'invalid', message: codeErr ?? 'Something went wrong — try again.' }, 400)
  }
  const phone = normalizePhone(parsed.data.phone)
  if (!phone) return json({ ok: false, error: 'contact', message: 'Add your mobile number in step 01 first — vouchers are limited per customer.' }, 400)
  if (!allow(`voucher:g:${phone}`, 20, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'Too many tries — wait a few minutes and try again.' }, 429, { 'retry-after': '600' })
  }
  if (!(await guestSchemaReady())) return json({ ok: false, error: 'unavailable', message: GUEST_VOUCHERS_OFF }, 503)

  try {
    const { totals } = await priceLines(parsed.data.items)
    const applied = await applyVoucherFor(parsed.data.code, totals, { kind: 'guest', phone, email: parsed.data.email || null })
    if (!applied || (!applied.result.ok && HIDDEN.has(applied.result.problem))) return json({ ok: false, error: 'not-found', message: NOT_USABLE }, 404)
    const { voucher, result } = applied
    if (!result.ok) return json({ ok: false, error: result.problem, message: result.message }, 422)
    return json({
      ok: true,
      code: voucher.code,
      discount: result.discount,
      headline: voucherHeadline(voucher, formatINR),
      description: voucher.description,
      appliesToType: voucher.appliesToType,
    })
  } catch (e) {
    if (e instanceof CheckoutError) return json({ ok: false, error: e.code, message: e.message }, e.code === 'unavailable' || e.code === 'voucher' ? 503 : 409)
    console.error('[api/orders/voucher]', e instanceof Error ? e.message : e)
    return json({ ok: false, error: 'server', message: 'We couldn’t check that code right now. Try again.' }, 500)
  }
}
