// POST /api/orders — place an order (login required). Owner: CHECKOUT.
// The server decides every number: the cart is re-priced from the database (products + bundle rules),
// the voucher is re-validated (and re-checked under a row lock in place_checkout_order()), the gift-wrap fee
// comes from Admin settings. The address is loaded from the customer's own saved addresses by id.
// Idempotent: the client sends a nonce per checkout; a retry returns the first order instead of a second one.
// Payment still happens on WhatsApp — the response carries the order text the client opens wa.me with.
import { z } from 'zod'
import { buildCheckoutMessage } from '@/lib/checkout/message'
import { addressFromRow, orderRequestSchema, type AddressSnapshot } from '@/lib/checkout/schema'
import {
  CheckoutError, applyVoucher, getBuyer, loadCheckoutSettings, orderTotals, priceLines,
} from '@/lib/checkout/server'
import { orderSnapshotFromRow, type OrderSnapshot } from '@/lib/checkout/types'
import { VOUCHER_MESSAGES, type VoucherProblem } from '@/lib/checkout/voucher'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { allow, clientKey, json, readJson, sameOrigin } from '../_lib/guard'

const HINT_TO_PROBLEM: Record<string, VoucherProblem> = {
  voucher_invalid: 'not-found',
  voucher_inactive: 'inactive',
  voucher_not_started: 'not-started',
  voucher_expired: 'expired',
  voucher_used_up: 'used-up',
  voucher_already_used: 'already-used',
}

function respond(order: OrderSnapshot, src: string | undefined, replay = false): Response {
  return json({ ok: true, replay, order, message: buildCheckoutMessage(order, { src }) })
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  if (!allow(`order:ip:${clientKey(req)}`, 20, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'Too many orders from here — wait a few minutes.' }, 429, { 'retry-after': '600' })
  }

  const buyer = await getBuyer()
  if (!buyer) return json({ ok: false, error: 'login', message: 'Log in to place your order.' }, 401)

  const sb = supabaseAdmin()
  if (!sb) return json({ ok: false, error: 'unavailable', message: 'Online ordering is offline for a moment — message us on WhatsApp.' }, 503)

  const body = await readJson(req, 32 * 1024)
  if ('error' in body) return json({ ok: false, error: 'invalid', message: 'Something went wrong — try again.' }, body.error === 'too-large' ? 413 : 400)
  const parsed = orderRequestSchema.safeParse(body.data)
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
    const first = Object.values(fe).find((v) => v?.length)?.[0]
    return json({ ok: false, error: 'invalid', fieldErrors: fe, message: first ?? 'Check your details and try again.' }, 400)
  }
  const reqBody = parsed.data
  const uid = buyer.user.id

  // retry of an order that already went through → same order, no second row
  {
    const { data: existing } = await sb.from('orders').select('*').eq('user_id', uid).eq('nonce', reqBody.nonce).maybeSingle()
    if (existing) return respond(orderSnapshotFromRow(existing as Record<string, unknown>), reqBody.source?.src, true)
  }

  if (!allow(`order:u:${uid}`, 8, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'That’s a lot of orders in a few minutes — message us on WhatsApp if you need more.' }, 429, { 'retry-after': '600' })
  }

  try {
    // address: must be one of the buyer's own saved addresses
    const { data: addrRow, error: addrErr } = await sb.from('addresses').select('*').eq('id', reqBody.addressId).eq('user_id', uid).maybeSingle()
    if (addrErr) throw new CheckoutError('db', 'We couldn’t load your address. Try again.')
    if (!addrRow) throw new CheckoutError('address', 'Pick a delivery address (or add one).')
    const a = addressFromRow(addrRow as Record<string, unknown>)
    const address: AddressSnapshot = { id: a.id, kind: a.kind, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pin: a.pin }

    const [{ totals }, settings] = await Promise.all([priceLines(reqBody.items), loadCheckoutSettings()])

    let discount = 0
    let voucher: Awaited<ReturnType<typeof applyVoucher>> = null
    if (reqBody.voucherCode) {
      const applied = await applyVoucher(reqBody.voucherCode, totals, buyer)
      if (!applied) throw new CheckoutError('voucher', VOUCHER_MESSAGES['not-found'], { problem: 'not-found' })
      const res = applied.result
      // same answer as an unknown code for paused / not-yet-live / someone else's codes (no code enumeration)
      if (!res.ok && ['inactive', 'not-started', 'not-yours'].includes(res.problem)) {
        throw new CheckoutError('voucher', VOUCHER_MESSAGES['not-found'], { problem: 'not-found' })
      }
      if (!res.ok) throw new CheckoutError('voucher', res.message, { problem: res.problem })
      discount = res.discount
      voucher = applied
    }

    const gift = reqBody.gift?.enabled ? reqBody.gift : null
    const giftFee = gift ? settings.giftWrapFee : 0
    const final = orderTotals(totals, discount, giftFee, voucher?.voucher ?? null)
    const src = reqBody.source?.src || null

    const orderRow = {
      user_id: uid,
      nonce: reqBody.nonce,
      email: buyer.email,
      name: address.name,
      city: address.city,
      contact: address.phone,
      note: reqBody.note || null,
      src,
      items: final.lines,
      totals: final.totals,
      subtotal: final.totals.subtotal,
      savings: final.totals.savings,
      discount,
      gift_fee: giftFee,
      total: final.totals.payable,
      address,
      gift,
    }
    const pieces = final.lines.reduce((n, l) => n + l.qty, 0)
    const lead = {
      name: address.name,
      city: address.city,
      contact: address.phone,
      message: reqBody.note || null,
      src,
      source: reqBody.source ?? null,
      payload: {
        from: 'checkout',
        pieces,
        items: final.lines.map((l) => ({ slug: l.slug, name: l.name, type: l.type, variant: l.variantLabel, size: l.size ?? null, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
        totals: { subtotal: final.totals.subtotal, savings: final.totals.savings, discount, giftFee, total: final.totals.payable, hasPriceOnRequest: final.totals.hasPriceOnRequest },
        voucher: voucher?.voucher.code ?? null,
        gift: !!gift,
      },
    }

    const { data, error } = await sb.rpc('place_checkout_order', {
      p_order: orderRow,
      p_lead: lead,
      p_voucher_id: voucher?.voucher.id ?? null,
      p_discount: discount,
    })
    if (error) {
      const problem = error.hint ? HINT_TO_PROBLEM[error.hint] : undefined
      if (problem) throw new CheckoutError('voucher', VOUCHER_MESSAGES[problem], { problem })
      if (error.code === 'PGRST202' || error.code === '42883') {
        console.error('[api/orders] place_checkout_order missing — run supabase/migrations/0006_checkout.sql')
        throw new CheckoutError('unavailable', 'Online ordering is being switched on — message us on WhatsApp for now.')
      }
      console.error('[api/orders] rpc failed', error.code, error.message)
      throw new CheckoutError('db', 'We couldn’t save your order. Nothing was charged — try again.')
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new CheckoutError('db', 'We couldn’t save your order. Nothing was charged — try again.')
    const order = orderSnapshotFromRow(row as Record<string, unknown>)
    return respond(order, src ?? undefined)
  } catch (e) {
    if (e instanceof CheckoutError) {
      const status = e.code === 'unavailable' ? 503 : e.code === 'db' ? 500 : e.code === 'voucher' ? 422 : 409
      return json({ ok: false, error: e.code, message: e.message, ...(e.detail ?? {}) }, status)
    }
    console.error('[api/orders]', e instanceof Error ? e.message : e)
    return json({ ok: false, error: 'server', message: 'We couldn’t save your order. Nothing was charged — try again.' }, 500)
  }
}
