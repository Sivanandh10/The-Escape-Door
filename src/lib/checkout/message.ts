// The WhatsApp text for a placed order (pure). Built on the server from the stored order, and rebuilt in the
// browser from the same snapshot when the customer reopens /checkout-success. Owner: CHECKOUT.
import { formatINR, formatINRRange, parseRange } from '../pricing'
import { addressLines, formatPhone } from './schema'
import type { OrderSnapshot } from './types'

const clean = (s: string | null | undefined, max = 300) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function describe(l: OrderSnapshot['items'][number]): string {
  const bits = [
    l.variantLabel && !/^(standard|single)$/i.test(l.variantLabel) ? l.variantLabel : '',
    l.size ? `Size ${l.size}` : '',
  ].filter(Boolean)
  return bits.length ? `${l.name} — ${bits.join(' · ')}` : l.name
}

export function buildCheckoutMessage(o: Pick<OrderSnapshot, 'ref' | 'items' | 'totals' | 'address' | 'gift' | 'note'>, opts: { src?: string } = {}): string {
  const out: string[] = []
  const t = o.totals
  const priced = o.items.filter((l) => l.unitPrice != null)
  const quoted = o.items.filter((l) => l.unitPrice == null)

  out.push(`Hi The Escape Door! New order ${o.ref}`)
  out.push('')
  priced.forEach((l, i) => {
    out.push(`${i + 1}. ${describe(l)}`)
    const gross = (l.unitPrice as number) * l.qty
    const deal = l.saving > 0 ? ` (deal −${formatINR(l.saving)} → ${formatINR(l.lineTotal ?? gross)})` : ''
    out.push(`   ${l.qty} × ${formatINR(l.unitPrice as number)} = ${formatINR(gross)}${deal}`)
  })
  if (quoted.length) {
    if (priced.length) out.push('')
    out.push('Price on request:')
    quoted.forEach((l, i) => {
      const r = parseRange(l.variantAttrs?.range)
      out.push(`${priced.length + i + 1}. ${describe(l)} × ${l.qty}${r ? ` (${formatINRRange(r[0], r[1])})` : ''}`)
    })
  }

  out.push('')
  if (t.applied.length) for (const a of t.applied) out.push(`Deal: ${a.label} −${formatINR(a.saving)}`)
  if (priced.length) {
    out.push(`Subtotal: ${formatINR(t.subtotal)}`)
    if (t.savings > 0) out.push(`Bundle savings: −${formatINR(t.savings)}`)
    if (t.voucher && t.discount > 0) out.push(`Voucher ${t.voucher.code}: −${formatINR(t.discount)}`)
  }
  if (t.giftFee > 0) out.push(`Gift wrap: ${formatINR(t.giftFee)}`)
  if (priced.length || t.giftFee > 0) out.push(`Total to pay: ${formatINR(t.payable)}${t.hasPriceOnRequest ? ' + quoted items' : ''}`)
  else out.push('Total: please quote the items above')

  if (o.address) {
    const a = o.address
    out.push('')
    out.push('Deliver to:')
    out.push(`${clean(a.name, 80)} · ${formatPhone(a.phone)}`)
    for (const line of addressLines(a)) out.push(clean(line, 200))
  }

  if (o.gift?.enabled) {
    out.push('')
    out.push('GIFT — please pack it as a gift')
    if (o.gift.receiverName || o.gift.receiverPhone) {
      out.push(`Receiver: ${[clean(o.gift.receiverName, 80), o.gift.receiverPhone ? formatPhone(o.gift.receiverPhone) : ''].filter(Boolean).join(' · ')}`)
    }
    if (o.gift.note) out.push(`Gift note: "${clean(o.gift.note, 240)}"`)
    if (o.gift.hidePrices) out.push('Hide prices on the invoice / packing slip')
  }

  const note = clean(o.note, 500)
  if (note) {
    out.push('')
    out.push(`Note: ${note}`)
  }
  const src = clean(opts.src, 40)
  if (src) {
    out.push('')
    out.push(`ref: ${src}`)
  }
  return out.join('\n')
}
