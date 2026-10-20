// Voucher maths + code generator (pure; RELATIVE imports so it runs anywhere). Owner: CHECKOUT.
// The server is the only place a discount is decided (POST /api/vouchers/validate, POST /api/orders);
// the browser just shows what the server said.
import type { CartTotals } from '../types'
import type { Voucher } from './types'

export type VoucherProblem =
  | 'not-found'
  | 'inactive'
  | 'not-started'
  | 'expired'
  | 'not-yours'
  | 'used-up'
  | 'already-used'
  | 'min-order'
  | 'not-applicable'

export type VoucherResult =
  | { ok: true; discount: number; base: number }
  | { ok: false; problem: VoucherProblem; message: string }

export interface VoucherContext {
  totals: Pick<CartTotals, 'lines' | 'total'>
  /** signed-in customer's email (lower-case compare) */
  email: string | null
  /** redemptions of this voucher so far: all customers / this customer */
  usedTotal: number
  usedByUser: number
  now?: Date
  inr: (n: number) => string
}

export const VOUCHER_MESSAGES: Record<VoucherProblem, string> = {
  'not-found': 'We couldn’t find that code. Check the spelling?',
  inactive: 'That voucher is paused right now.',
  'not-started': 'That voucher isn’t live yet.',
  expired: 'That voucher has expired.',
  'not-yours': 'That voucher belongs to another account.',
  'used-up': 'That voucher has been fully used.',
  'already-used': 'You’ve already used this voucher.',
  'min-order': 'Your cart is below this voucher’s minimum.',
  'not-applicable': 'This voucher doesn’t apply to anything in your cart.',
}

const fail = (problem: VoucherProblem, message = VOUCHER_MESSAGES[problem]): VoucherResult => ({ ok: false, problem, message })

/** Decide the discount for a priced cart. Discount never exceeds what the eligible items cost. */
export function evaluateVoucher(v: Voucher, ctx: VoucherContext): VoucherResult {
  const now = ctx.now ?? new Date()
  if (!v.active) return fail('inactive')
  if (v.startsAt && now < new Date(v.startsAt)) return fail('not-started')
  if (v.endsAt && now >= new Date(v.endsAt)) return fail('expired')
  if (v.assignedEmail && (ctx.email ?? '').toLowerCase() !== v.assignedEmail.toLowerCase()) return fail('not-yours')
  if (v.usageLimit != null && ctx.usedTotal >= v.usageLimit) return fail('used-up')
  if (v.perUserLimit != null && ctx.usedByUser >= v.perUserLimit) return fail('already-used')

  const priced = ctx.totals.lines.filter((l) => l.lineTotal != null)
  const cartValue = ctx.totals.total
  if (!priced.length) return fail('not-applicable', 'Vouchers apply to priced items — this cart is quoted on WhatsApp.')
  if (v.minOrder > 0 && cartValue < v.minOrder) {
    return fail('min-order', `Add ${ctx.inr(v.minOrder - cartValue)} more to use this voucher (minimum ${ctx.inr(v.minOrder)}).`)
  }

  const eligible = v.appliesToType ? priced.filter((l) => l.type === v.appliesToType) : priced
  const base = eligible.reduce((s, l) => s + (l.lineTotal ?? 0), 0)
  if (base <= 0) return fail('not-applicable', v.appliesToType ? `This voucher is for ${v.appliesToType}s only.` : VOUCHER_MESSAGES['not-applicable'])

  let discount = v.type === 'percent' ? Math.floor((base * Math.min(100, Math.max(0, v.value))) / 100) : Math.max(0, Math.floor(v.value))
  if (v.type === 'percent' && v.maxDiscount != null) discount = Math.min(discount, v.maxDiscount)
  discount = Math.min(discount, base)
  if (discount <= 0) return fail('not-applicable')
  return { ok: true, discount, base }
}

// ---------------------------------------------------------------- codes
// Readable: no 0/O/1/I/L. "TED-JJK-7K2Q" — prefix + optional tag + 4 random characters.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomChars(n: number): string {
  const out: string[] = []
  const bytes = new Uint8Array(n)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256)
  for (let i = 0; i < n; i++) out.push(ALPHABET[bytes[i] % ALPHABET.length])
  return out.join('')
}

/** generateVoucherCode('jjk') → "TED-JJK-7K2Q"; generateVoucherCode() → "TED-7K2Q" */
export function generateVoucherCode(tag?: string): string {
  const t = (tag ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  // 8 random chars from a 31-letter alphabet ≈ 40 bits: not guessable even with the readable TED-<TAG>- prefix
  return ['TED', t, randomChars(8)].filter(Boolean).join('-')
}
