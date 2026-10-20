// Order pipeline + voucher types shared by the storefront, the API and the admin (pure). Owner: CHECKOUT.
import type { CartItem, CartTotals } from '../types'
import type { AddressSnapshot, GiftOptions } from './schema'

/** placed → confirmed → paid → packed → shipped → delivered (or cancelled). 'new' = hand-added / older rows. */
export type OrderStatus = 'new' | 'placed' | 'confirmed' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'cancelled'

export const ORDER_PIPELINE: Array<{ id: OrderStatus; label: string; jp: string; tone: string; customer: string }> = [
  { id: 'placed', label: 'Placed', jp: '注文', tone: 'bg-volt text-ink', customer: 'Order placed — we’ll confirm it on WhatsApp.' },
  { id: 'confirmed', label: 'Confirmed', jp: '確認', tone: 'bg-lav text-ink', customer: 'Confirmed — stock and sizes checked.' },
  { id: 'paid', label: 'Paid', jp: '入金', tone: 'bg-door text-paper', customer: 'Payment received. Thank you!' },
  { id: 'packed', label: 'Packed', jp: '梱包', tone: 'bg-pink text-ink', customer: 'Packed and ready to leave.' },
  { id: 'shipped', label: 'Shipped', jp: '発送', tone: 'bg-tone-4 text-ink', customer: 'On its way to you.' },
  { id: 'delivered', label: 'Delivered', jp: '配達', tone: 'bg-paper text-ink', customer: 'Delivered. Enjoy the drop!' },
]
export const CANCELLED = { id: 'cancelled' as const, label: 'Cancelled', jp: '取消', tone: 'bg-tone-3 text-paper', customer: 'This order was cancelled.' }
export const ALL_STATUSES = [...ORDER_PIPELINE, CANCELLED]

export function statusMeta(s: OrderStatus | string) {
  if (s === 'new') return { ...ORDER_PIPELINE[0], id: 'new' as const }
  return ALL_STATUSES.find((x) => x.id === s) ?? { ...ORDER_PIPELINE[0], id: 'new' as const }
}

/** The step a status sits on in the pipeline (new counts as placed; cancelled = -1). */
export function pipelineIndex(s: OrderStatus | string): number {
  if (s === 'new') return 0
  return ORDER_PIPELINE.findIndex((x) => x.id === s)
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (v === 'new' || ALL_STATUSES.some((s) => s.id === v))
}

export const orderRef = (orderNo: number | null | undefined, id?: string) =>
  orderNo ? `TED-${orderNo}` : id ? `TED-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}` : 'TED-—'

export interface TimelineEntry {
  status: OrderStatus
  at: string
  by?: string
}

/** Server-priced line stored on the order (CartItem + line maths). */
export type OrderLine = CartItem & { lineTotal: number | null; saving: number }

/** Totals stored on the order: the bundle maths + voucher + gift wrap → payable. */
export interface OrderTotals extends Omit<CartTotals, 'lines'> {
  discount: number
  giftFee: number
  /** what the customer pays for the priced items (price-on-request items are quoted on top) */
  payable: number
  voucher: { code: string; description: string; discount: number } | null
}

export interface OrderSnapshot {
  id: string
  orderNo: number | null
  ref: string
  status: OrderStatus
  createdAt: string
  items: OrderLine[]
  totals: OrderTotals
  address: AddressSnapshot | null
  gift: GiftOptions | null
  voucherCode: string | null
  note: string
  email: string | null
  timeline: TimelineEntry[]
}

// ---------------------------------------------------------------- vouchers
export type VoucherType = 'percent' | 'flat'

export interface Voucher {
  id: string
  code: string
  description: string
  type: VoucherType
  value: number
  minOrder: number
  maxDiscount: number | null
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  perUserLimit: number | null
  assignedEmail: string | null
  appliesToType: string | null
  active: boolean
  createdAt: string
}

export function voucherFromRow(r: Record<string, unknown>): Voucher {
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
  return {
    id: s(r.id),
    code: s(r.code),
    description: s(r.description),
    type: r.type === 'flat' ? 'flat' : 'percent',
    value: n(r.value) ?? 0,
    minOrder: n(r.min_order) ?? 0,
    maxDiscount: n(r.max_discount),
    startsAt: s(r.starts_at) || null,
    endsAt: s(r.ends_at) || null,
    usageLimit: n(r.usage_limit),
    perUserLimit: n(r.per_user_limit),
    assignedEmail: s(r.assigned_email) || null,
    appliesToType: s(r.applies_to_type) || null,
    active: r.active !== false,
    createdAt: s(r.created_at),
  }
}

export function voucherToRow(v: Voucher): Record<string, unknown> {
  return {
    ...(v.id ? { id: v.id } : {}),
    code: v.code.trim().toUpperCase(),
    description: v.description.trim() || null,
    type: v.type,
    value: v.value,
    min_order: v.minOrder || 0,
    max_discount: v.type === 'percent' ? v.maxDiscount || null : null,
    starts_at: v.startsAt || null,
    ends_at: v.endsAt || null,
    usage_limit: v.usageLimit || null,
    per_user_limit: v.perUserLimit || null,
    assigned_email: v.assignedEmail?.trim().toLowerCase() || null,
    applies_to_type: v.appliesToType || null,
    active: v.active,
  }
}

/** "20% off (max ₹200)" / "₹150 off" — plain text, no currency formatting dependency for callers. */
export function voucherHeadline(v: Pick<Voucher, 'type' | 'value' | 'maxDiscount'>, inr: (n: number) => string): string {
  return v.type === 'percent' ? `${v.value}% off${v.maxDiscount ? ` (up to ${inr(v.maxDiscount)})` : ''}` : `${inr(v.value)} off`
}

// ---------------------------------------------------------------- orders row → snapshot
const EMPTY_TOTALS: OrderTotals = {
  subtotal: 0, savings: 0, total: 0, hasPriceOnRequest: false, applied: [], hints: [],
  discount: 0, giftFee: 0, payable: 0, voucher: null,
}

/** public.orders row (select *) → OrderSnapshot. Tolerates hand-added / older rows. */
export function orderSnapshotFromRow(r: Record<string, unknown>): OrderSnapshot {
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
  const raw = obj(r.totals)
  const subtotal = n(r.subtotal) ?? n(raw?.subtotal) ?? 0
  const savings = n(r.savings) ?? n(raw?.savings) ?? 0
  const discount = n(r.discount) ?? n(raw?.discount) ?? 0
  const giftFee = n(r.gift_fee) ?? n(raw?.giftFee) ?? 0
  const totals: OrderTotals = {
    ...EMPTY_TOTALS,
    ...(raw as Partial<OrderTotals> | null),
    subtotal,
    savings,
    total: n(raw?.total) ?? subtotal - savings,
    discount,
    giftFee,
    payable: n(raw?.payable) ?? n(r.total) ?? subtotal - savings - discount + giftFee,
    applied: Array.isArray(raw?.applied) ? (raw!.applied as OrderTotals['applied']) : [],
    hints: [],
    voucher: (obj(raw?.voucher) as OrderTotals['voucher']) ?? null,
  }
  const orderNo = n(r.order_no)
  const id = s(r.id)
  const status = isOrderStatus(r.status) ? r.status : 'placed'
  return {
    id,
    orderNo,
    ref: orderRef(orderNo, id),
    status,
    createdAt: s(r.created_at),
    items: (Array.isArray(r.items) ? r.items : []) as OrderLine[],
    totals,
    address: (obj(r.address) as AddressSnapshot | null) ?? null,
    gift: (obj(r.gift) as GiftOptions | null) ?? null,
    voucherCode: s(r.voucher_code) || null,
    note: s(r.note),
    email: s(r.email) || null,
    timeline: (Array.isArray(r.timeline) ? r.timeline : []).filter((t): t is TimelineEntry => !!t && typeof t === 'object' && isOrderStatus((t as TimelineEntry).status)),
  }
}
