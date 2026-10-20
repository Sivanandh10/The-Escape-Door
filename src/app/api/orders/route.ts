// POST /api/orders — place an order. Owner: CHECKOUT.
// ONE pipeline for everyone: the order is saved here FIRST (status 'placed', items, address snapshot, gift, voucher,
// totals, contact, attribution) and only then does the browser open WhatsApp with the text this route returns.
//   signed in → address = one of the customer's saved addresses (by id); user_id set
//   guest     → allowed only while NO customer login method is live (owner rule: once login works it's mandatory);
//               contact (name, +91 mobile, optional email) + a typed address; user_id null, linked to the account
//               later by claim_guest_orders() (0010) when they log in through an email link / Google with that email
// The server decides every number: the cart is re-priced from the database (products + bundle rules), the voucher is
// re-validated (and re-checked under a row lock in place_checkout_order()), the gift-wrap fee comes from Admin
// settings. If the total differs from what the shopper saw (expectedPayable) → 409 price-changed, nothing saved.
// Idempotent: the client sends a nonce per checkout; a retry returns the first order instead of a second one.
import { z } from 'zod'
import { buildCheckoutMessage } from '@/lib/checkout/message'
import { addressFromRow, orderRequestSchema, type AddressSnapshot } from '@/lib/checkout/schema'
import {
  CheckoutError, GUEST_VOUCHERS_OFF, applyVoucherFor, customerLoginLive, getBuyer, guestSchemaReady, loadCheckoutSettings,
  orderTotals, priceLines, type AppliedVoucher, type VoucherIdentity,
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
  voucher_guest: 'not-found',
}
const FAILED = 'We couldn’t save your order. Nothing was charged — try again.'
const OFFLINE = 'Online ordering is offline for a moment — message us on WhatsApp.'

function respond(order: OrderSnapshot, src: string | undefined, replay = false): Response {
  return json({ ok: true, replay, order, message: buildCheckoutMessage(order, { src }) })
}

export async function POST(req: Request): Promise<Response> {
  // browsers always send Origin on a POST — a missing one is a script, not a shopper
  if (!req.headers.get('origin') || !sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  if (!allow(`order:ip:${clientKey(req)}`, 20, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'Too many orders from here — wait a few minutes.' }, 429, { 'retry-after': '600' })
  }

  const sb = supabaseAdmin()
  if (!sb) return json({ ok: false, error: 'unavailable', message: OFFLINE }, 503)

  const body = await readJson(req, 32 * 1024)
  if ('error' in body) return json({ ok: false, error: 'invalid', message: 'Something went wrong — try again.' }, body.error === 'too-large' ? 413 : 400)
  const parsed = orderRequestSchema.safeParse(body.data)
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
    const field = Object.keys(fe).find((k) => fe[k]?.length)
    const error = field === 'contact' ? 'contact' : field === 'address' || field === 'addressId' ? 'address' : 'invalid'
    return json({ ok: false, error, fieldErrors: fe, message: (field && fe[field]?.[0]) || 'Check your details and try again.' }, 400)
  }
  const reqBody = parsed.data
  const src = reqBody.source?.src || null
  // honeypot filled → a bot. Same answer as any bad form, nothing saved, no admin toast
  if (reqBody.website) return json({ ok: false, error: 'invalid', message: 'Check your details and try again.' }, 400)

  const buyer = await getBuyer()
  const guest = !buyer
  if (guest) {
    if (await customerLoginLive()) return json({ ok: false, error: 'login', message: 'Log in to place your order.' }, 401)
    if (!reqBody.contact) return json({ ok: false, error: 'contact', message: 'Add your name and mobile number so we can confirm the order.' }, 400)
    if (!reqBody.address) return json({ ok: false, error: 'address', message: 'Add the delivery address.' }, 400)
  } else if (!reqBody.addressId) {
    return json({ ok: false, error: 'address', message: 'Pick a delivery address (or add one).' }, 400)
  }
  const uid = buyer?.user.id ?? null
  const contactPhone = guest ? reqBody.contact!.phone : null
  const schemaReady = guest ? await guestSchemaReady() : true

  // retry of an order that already went through → same order, no second row
  {
    // oldest first + limit(1): even if a pre-0010 race ever left two rows for one nonce, a retry still gets the first
    const q = sb.from('orders').select('*').eq('nonce', reqBody.nonce).order('created_at', { ascending: true }).limit(1)
    const { data: found } = uid ? await q.eq('user_id', uid) : await q.is('user_id', null)
    const existing = Array.isArray(found) ? found[0] : null
    if (existing) return respond(orderSnapshotFromRow(existing as Record<string, unknown>), src ?? undefined, true)
  }

  if (!allow(guest ? `order:g:${contactPhone}` : `order:u:${uid}`, 8, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited', message: 'That’s a lot of orders in a few minutes — message us on WhatsApp if you need more.' }, 429, { 'retry-after': '600' })
  }

  try {
    // ---------------------------------------------------------------- address
    let address: AddressSnapshot
    if (guest) {
      const a = reqBody.address!
      address = { kind: a.kind, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pin: a.pin }
    } else {
      // must be one of the buyer's own saved addresses
      const { data: addrRow, error: addrErr } = await sb.from('addresses').select('*').eq('id', reqBody.addressId!).eq('user_id', uid!).maybeSingle()
      if (addrErr) throw new CheckoutError('db', 'We couldn’t load your address. Try again.')
      if (!addrRow) throw new CheckoutError('address', 'Pick a delivery address (or add one).')
      const a = addressFromRow(addrRow as Record<string, unknown>)
      address = { id: a.id, kind: a.kind, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pin: a.pin }
    }

    const [{ totals }, settings] = await Promise.all([priceLines(reqBody.items), loadCheckoutSettings()])

    // ---------------------------------------------------------------- voucher
    let discount = 0
    let voucher: AppliedVoucher | null = null
    if (reqBody.voucherCode) {
      if (guest && !schemaReady) throw new CheckoutError('voucher', GUEST_VOUCHERS_OFF, { problem: 'unavailable' })
      const who: VoucherIdentity = guest
        ? { kind: 'guest', phone: contactPhone!, email: reqBody.contact!.email || null }
        : { kind: 'user', userId: uid!, email: buyer!.user.email ?? null }
      const applied = await applyVoucherFor(reqBody.voucherCode, totals, who)
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

    // ---------------------------------------------------------------- price check (what the shopper saw)
    if (reqBody.expectedPayable != null && reqBody.expectedPayable !== final.totals.payable) {
      throw new CheckoutError(
        'price-changed',
        `Prices changed since this went in your cart — the total is now ₹${final.totals.payable.toLocaleString('en-IN')}. Check it and place the order again.`,
        {
          payable: final.totals.payable,
          lines: final.lines.map((l) => ({ slug: l.slug, variantId: l.variantId, size: l.size ?? null, unitPrice: l.unitPrice })),
        },
      )
    }

    // ---------------------------------------------------------------- the order row
    const c = guest ? reqBody.contact! : null
    const orderEmail = guest ? c!.email || null : buyer!.email
    const orderRow: Record<string, unknown> = {
      user_id: uid,
      guest,
      nonce: reqBody.nonce,
      email: orderEmail,
      contact_email: orderEmail,
      contact_phone: guest ? contactPhone : address.phone,
      name: guest ? c!.name : address.name,
      city: address.city,
      contact: guest ? contactPhone : address.phone,
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
    const lead = {
      name: orderRow.name,
      city: address.city,
      contact: orderRow.contact,
      message: reqBody.note || null,
      src,
      source: reqBody.source ?? null,
      payload: {
        from: guest ? 'checkout_guest' : 'checkout',
        pieces: final.lines.reduce((n, l) => n + l.qty, 0),
        items: final.lines.map((l) => ({ slug: l.slug, name: l.name, type: l.type, variant: l.variantLabel, size: l.size ?? null, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
        totals: { subtotal: final.totals.subtotal, savings: final.totals.savings, discount, giftFee, total: final.totals.payable, hasPriceOnRequest: final.totals.hasPriceOnRequest },
        voucher: voucher?.voucher.code ?? null,
        gift: !!gift,
        ...(orderEmail ? { email: orderEmail } : {}),
      },
    }

    // before 0010 runs: guests are saved with a plain service-role insert (vouchers were refused above)
    if (guest && !schemaReady) return respond(await insertGuestLegacy(orderRow, lead), src ?? undefined)

    const { data, error } = await sb.rpc('place_checkout_order', {
      p_order: orderRow,
      p_lead: lead,
      p_voucher_id: voucher?.voucher.id ?? null,
      p_discount: discount,
    })
    if (error) {
      const problem = error.hint ? HINT_TO_PROBLEM[error.hint] : undefined
      if (problem) throw new CheckoutError('voucher', VOUCHER_MESSAGES[problem], { problem })
      if (error.hint === 'guest_contact') throw new CheckoutError('contact', 'Add a 10-digit mobile number so we can confirm the order.')
      if (error.hint === 'guest_busy') throw new CheckoutError('rate-limited', 'We’re getting a lot of orders right now — try again in a few minutes, or message us on WhatsApp.')
      if (error.code === 'PGRST202' || error.code === '42883') {
        console.error('[api/orders] place_checkout_order missing — run supabase/migrations/0006_checkout.sql')
        throw new CheckoutError('unavailable', 'Online ordering is being switched on — message us on WhatsApp for now.')
      }
      console.error('[api/orders] rpc failed', error.code, error.message)
      throw new CheckoutError('db', FAILED)
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new CheckoutError('db', FAILED)
    return respond(orderSnapshotFromRow(row as Record<string, unknown>), src ?? undefined)
  } catch (e) {
    if (e instanceof CheckoutError) {
      const status = e.code === 'unavailable' ? 503 : e.code === 'db' ? 500 : e.code === 'voucher' ? 422 : e.code === 'contact' ? 400 : e.code === 'login' ? 401 : e.code === 'rate-limited' ? 429 : 409
      return json({ ok: false, error: e.code, message: e.message, ...(e.detail ?? {}) }, status)
    }
    console.error('[api/orders]', e instanceof Error ? e.message : e)
    return json({ ok: false, error: 'server', message: FAILED }, 500)
  }
}

/**
 * Guest order before migration 0010: only the 0006 columns (contact lives in name / contact / email).
 * The ORDER goes in first; the 'converted' lead only after it exists (no orphan leads in Admin), then it is linked.
 * There is no unique guest-nonce index before 0010, so this path is best-effort idempotent (pre-check in POST) —
 * apply 0010 for the hard guarantee.
 */
async function insertGuestLegacy(orderRow: Record<string, unknown>, lead: Record<string, unknown>): Promise<OrderSnapshot> {
  const sb = supabaseAdmin()
  if (!sb) throw new CheckoutError('unavailable', OFFLINE)
  const row = Object.fromEntries(Object.entries(orderRow).filter(([k]) => k !== 'guest' && k !== 'contact_email' && k !== 'contact_phone'))
  const { data, error } = await sb.from('orders').insert({ ...row, status: 'placed' }).select('*').single()
  if (error || !data) {
    console.error('[api/orders] guest insert failed', error?.code, error?.message)
    throw new CheckoutError('db', FAILED)
  }
  let saved = data as Record<string, unknown>
  const { data: leadRow, error: leadErr } = await sb
    .from('leads')
    .insert({ kind: 'whatsapp_order', name: lead.name, city: lead.city, contact: lead.contact, message: lead.message, payload: lead.payload, source: lead.source, src: lead.src, status: 'converted' })
    .select('id')
    .maybeSingle()
  const leadId = (leadRow as { id?: string } | null)?.id
  if (leadErr || !leadId) {
    console.error('[api/orders] guest lead insert failed (order kept)', leadErr?.code, leadErr?.message)
  } else {
    const { data: linked } = await sb.from('orders').update({ lead_id: leadId }).eq('id', saved.id as string).select('*').maybeSingle()
    if (linked) saved = linked as Record<string, unknown>
  }
  return orderSnapshotFromRow(saved)
}
