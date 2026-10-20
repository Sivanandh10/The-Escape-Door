// POST /api/vouchers/validate — does this code work on this cart, and for how much? Owner: CHECKOUT.
// Login required (vouchers can be tied to an email and limited per customer). The cart is re-priced
// from the database here; the browser's prices are never used. Vouchers are never listed publicly.
import { z } from 'zod'
import { formatINR } from '@/lib/pricing'
import { voucherValidateSchema } from '@/lib/checkout/schema'
import { CheckoutError, applyVoucher, getBuyer, priceLines } from '@/lib/checkout/server'
import { voucherHeadline } from '@/lib/checkout/types'
import { VOUCHER_MESSAGES } from '@/lib/checkout/voucher'
import { isSupabaseAdminConfigured } from '@/lib/supabase/env'
import { allow, clientKey, json, readJson, sameOrigin } from '../../_lib/guard'

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  if (!allow(`voucher:ip:${clientKey(req)}`, 30, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'Too many tries — wait a few minutes and try again.' }, 429, { 'retry-after': '600' })
  }

  const buyer = await getBuyer()
  if (!buyer) return json({ ok: false, error: 'login', message: 'Log in to use a voucher.' }, 401)
  if (!allow(`voucher:u:${buyer.user.id}`, 20, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'Too many tries — wait a few minutes and try again.' }, 429, { 'retry-after': '600' })
  }
  if (!isSupabaseAdminConfigured()) return json({ ok: false, error: 'unavailable', message: 'Vouchers aren’t switched on yet.' }, 503)

  const body = await readJson(req, 16 * 1024)
  if ('error' in body) return json({ ok: false, error: 'invalid', message: 'Something went wrong — try again.' }, 400)
  const parsed = voucherValidateSchema.safeParse(body.data)
  if (!parsed.success) {
    const codeErr = z.flattenError(parsed.error).fieldErrors.code?.[0]
    return json({ ok: false, error: 'invalid', message: codeErr ?? 'Something went wrong — try again.' }, 400)
  }

  try {
    const { totals } = await priceLines(parsed.data.items)
    const applied = await applyVoucher(parsed.data.code, totals, buyer)
    if (!applied) return json({ ok: false, error: 'not-found', message: VOUCHER_MESSAGES['not-found'] }, 404)
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
    if (e instanceof CheckoutError) return json({ ok: false, error: e.code, message: e.message }, e.code === 'unavailable' ? 503 : 409)
    console.error('[api/vouchers/validate]', e instanceof Error ? e.message : e)
    return json({ ok: false, error: 'server', message: 'We couldn’t check that code right now. Try again.' }, 500)
  }
}
