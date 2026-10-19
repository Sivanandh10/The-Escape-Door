// WhatsApp checkout text + link. Owner: F2. Pure apart from reading the session attribution.
import type { CartItem, CartTotals } from './types'
import { computeTotals, formatINR, formatINRRange, parseRange } from './pricing'
import { getAttribution } from './analytics'

export interface OrderMessageInput {
  items: CartItem[]
  /** pass the totals you already rendered; computed from items when omitted */
  totals?: CartTotals
  name?: string
  city?: string
  note?: string
  /** signed/public links to uploaded custom artwork */
  customLinks?: string[]
  /** fest QR / campaign ref; defaults to the session's `?src=` */
  ref?: string
  /** optional order reference shown in the header line, e.g. a lead id */
  orderRef?: string
}

const clean = (s: string | undefined, max = 300) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function describe(i: CartItem): string {
  const bits = [i.variantLabel && i.variantLabel !== 'Standard' && i.variantLabel !== 'Single' ? i.variantLabel : '', i.size ? `Size ${i.size}` : '']
    .filter(Boolean)
  return bits.length ? `${i.name} — ${bits.join(' · ')}` : i.name
}

function customLine(i: CartItem): string | null {
  const c = i.custom
  if (!c) return null
  const bits = [
    c.mode === 'company' ? 'designed by The Escape Door' : 'my own design',
    `${c.quantity} pcs`,
    c.halfHalf ? 'half-n-half' : '',
    c.zones.length ? `print: ${Array.from(new Set(c.zones.map((z) => z.zone))).join(' + ')}` : '',
    c.fileUrls.length ? `${c.fileUrls.length} file${c.fileUrls.length > 1 ? 's' : ''} attached` : '',
  ].filter(Boolean)
  const notes = clean(c.notes, 200)
  return `   Custom: ${bits.join(' · ')}${notes ? ` — "${notes}"` : ''}`
}

/** Clean, numbered, multi-line order text for wa.me. */
export function buildOrderMessage(input: OrderMessageInput): string {
  const totals = input.totals ?? computeTotals(input.items)
  const priced = totals.lines.filter((l) => l.unitPrice != null)
  const onRequest = totals.lines.filter((l) => l.unitPrice == null)
  const out: string[] = []

  out.push(`Hi The Escape Door! I'd like to order:${input.orderRef ? ` (ref ${clean(input.orderRef, 40)})` : ''}`)
  out.push('')

  priced.forEach((l, idx) => {
    out.push(`${idx + 1}. ${describe(l)}`)
    const gross = (l.unitPrice as number) * l.qty
    const deal = l.saving > 0 ? ` (deal −${formatINR(l.saving)} → ${formatINR(l.lineTotal ?? gross)})` : ''
    out.push(`   ${l.qty} × ${formatINR(l.unitPrice as number)} = ${formatINR(gross)}${deal}`)
    const c = customLine(l)
    if (c) out.push(c)
  })

  if (onRequest.length) {
    if (priced.length) out.push('')
    out.push('Price on request:')
    onRequest.forEach((l, idx) => {
      const r = parseRange(l.variantAttrs?.range)
      out.push(`${priced.length + idx + 1}. ${describe(l)} × ${l.qty}${r ? ` (${formatINRRange(r[0], r[1])})` : ''}`)
      const c = customLine(l)
      if (c) out.push(c)
    })
  }

  out.push('')
  if (totals.applied.length) {
    out.push('Deals applied:')
    for (const a of totals.applied) out.push(`• ${a.label}: −${formatINR(a.saving)}`)
  }
  if (priced.length) {
    out.push(`Subtotal: ${formatINR(totals.subtotal)}`)
    if (totals.savings > 0) out.push(`Bundle savings: −${formatINR(totals.savings)}`)
    out.push(`Total: ${formatINR(totals.total)}${totals.hasPriceOnRequest ? ' + price-on-request items' : ''}`)
  } else if (totals.hasPriceOnRequest) {
    out.push('Total: please quote the items above')
  }

  const links = (input.customLinks ?? []).map((u) => u.trim()).filter(Boolean)
  if (links.length) {
    out.push('')
    out.push('Custom files:')
    links.forEach((u) => out.push(`• ${u}`))
  }

  const name = clean(input.name, 80)
  const city = clean(input.city, 80)
  const note = clean(input.note, 500)
  if (name || city || note) out.push('')
  if (name) out.push(`Name: ${name}`)
  if (city) out.push(`City: ${city}`)
  if (note) out.push(`Note: ${note}`)

  const ref = clean(input.ref ?? getAttribution().src, 40)
  if (ref) {
    out.push('')
    out.push(`ref: ${ref}`)
  }
  return out.join('\n')
}

let warned = false
// Digits only, in international form: a bare 10-digit Indian mobile (6-9…) or a 0-prefixed one
// gets the 91 country code, because wa.me needs it (9342446559 would otherwise dial +93).
const digitsOf = (v: string | null | undefined) => {
  let d = (v ?? '').replace(/\D/g, '')
  if (/^0[6-9]\d{9}$/.test(d)) d = d.slice(1)
  if (/^[6-9]\d{9}$/.test(d)) d = `91${d}`
  return d
}

/**
 * The shop's WhatsApp number (digits only), or '' when not configured.
 * Runtime source: the admin-managed `settings.whatsapp` value (pass it in — on the server from
 * repo getSettings(), on the client from useWhatsappNumber()). NEXT_PUBLIC_WHATSAPP_NUMBER is
 * only the fallback when the setting is empty.
 */
export function whatsappNumber(fromSettings?: string | null): string {
  return digitsOf(fromSettings) || digitsOf(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER)
}

/**
 * https://wa.me/<number>?text=… — `number` is the settings value (any format; non-digits stripped).
 * With no number anywhere, falls back to https://wa.me/?text=… (WhatsApp lets the customer pick
 * the contact) and warns once.
 */
export function waLink(text: string, number?: string | null): string {
  const digits = whatsappNumber(number)
  const q = `?text=${encodeURIComponent(text)}`
  if (!digits) {
    if (!warned && typeof console !== 'undefined') {
      warned = true
      console.warn('[whatsapp] No WhatsApp number in Admin → Settings — opening WhatsApp without a recipient.')
    }
    return `https://wa.me/${q}`
  }
  return `https://wa.me/${digits}${q}`
}
