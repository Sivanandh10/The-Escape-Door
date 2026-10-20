// Checkout shapes + validation shared by the browser and the server (pure — zod only). Owner: CHECKOUT.
// Addresses (public.addresses), gift options, the POST /api/orders and /api/vouchers/validate bodies.
import { z } from 'zod'

// ---------------------------------------------------------------- India
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const

export const PIN_RE = /^[1-9][0-9]{5}$/
const MOBILE_RE = /^[6-9][0-9]{9}$/

/** "+91 98765-43210" / "098765 43210" / "9876543210" → "9876543210" ('' when it isn't an Indian mobile). */
export function normalizePhone(v: string | null | undefined): string {
  let d = (v ?? '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return MOBILE_RE.test(d) ? d : ''
}

/** "9876543210" → "+91 98765 43210" */
export function formatPhone(d: string | null | undefined): string {
  const n = normalizePhone(d)
  return n ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : (d ?? '')
}

const text = (min: number, max: number, msg: string) =>
  z.string().trim().min(min, msg).max(max, `Keep it under ${max} characters.`)
const optText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional().default('')
const phone = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== '', '10-digit Indian mobile number, e.g. 98765 43210.')
  .transform((v) => normalizePhone(v))

// ---------------------------------------------------------------- addresses
export const ADDRESS_KINDS = [
  { id: 'home', label: 'Home' },
  { id: 'college', label: 'College / hostel' },
  { id: 'work', label: 'Work' },
] as const
export type AddressKind = (typeof ADDRESS_KINDS)[number]['id']

export const addressInputSchema = z.object({
  kind: z.enum(['home', 'college', 'work']).default('home'),
  name: text(2, 80, 'Who receives the parcel? (2 letters or more)'),
  phone,
  line1: text(3, 160, 'House / flat / room no. and street.'),
  line2: optText(160),
  landmark: optText(120),
  city: text(2, 80, 'Which city or town?'),
  state: z.enum(INDIAN_STATES, { error: 'Pick your state.' }),
  pin: z.string().trim().regex(PIN_RE, '6-digit PIN code, e.g. 560001.'),
  isDefault: z.boolean().default(false),
})
export type AddressInput = z.input<typeof addressInputSchema>
export type AddressValues = z.output<typeof addressInputSchema>

/** A saved address (public.addresses row, camelCased). */
export interface Address extends AddressValues {
  id: string
  createdAt: string
}

export function addressFromRow(r: Record<string, unknown>): Address {
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  const kind = s(r.kind)
  return {
    id: s(r.id),
    kind: (kind === 'college' || kind === 'work' ? kind : 'home') as AddressKind,
    name: s(r.name),
    phone: s(r.phone),
    line1: s(r.line1),
    line2: s(r.line2),
    landmark: s(r.landmark),
    city: s(r.city),
    state: s(r.state) as AddressValues['state'],
    pin: s(r.pin),
    isDefault: r.is_default === true,
    createdAt: s(r.created_at),
  }
}

export function addressToRow(a: AddressValues): Record<string, unknown> {
  return {
    kind: a.kind,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 || null,
    landmark: a.landmark || null,
    city: a.city,
    state: a.state,
    pin: a.pin,
    is_default: a.isDefault,
  }
}

/** Snapshot stored on the order (the address can be edited or deleted later; the order keeps this copy). */
export type AddressSnapshot = Omit<Address, 'id' | 'createdAt' | 'isDefault'> & { id?: string }

export function addressLines(a: Pick<AddressSnapshot, 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'pin'>): string[] {
  return [
    [a.line1, a.line2].filter(Boolean).join(', '),
    a.landmark ? `Landmark: ${a.landmark}` : '',
    `${a.city}, ${a.state} – ${a.pin}`,
  ].filter(Boolean)
}

// ---------------------------------------------------------------- contact (guest checkout: who is ordering)
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const contactSchema = z.object({
  name: text(2, 80, 'Your name, so we know who’s ordering (2 letters or more).'),
  phone,
  email: z
    .string()
    .trim()
    .max(200, 'Keep it under 200 characters.')
    .optional()
    .default('')
    .refine((v) => v === '' || EMAIL_RE.test(v), 'That email doesn’t look right — or leave it empty.')
    .transform((v) => v.toLowerCase()),
})
export type ContactInput = z.input<typeof contactSchema>
export type ContactValues = z.output<typeof contactSchema>

// ---------------------------------------------------------------- gift
export const giftSchema = z
  .object({
    enabled: z.boolean().default(false),
    note: optText(240),
    receiverName: optText(80),
    receiverPhone: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine((v) => v === '' || normalizePhone(v) !== '', '10-digit Indian mobile number (or leave it empty).')
      .transform((v) => (v ? normalizePhone(v) : '')),
    hidePrices: z.boolean().default(false),
  })
  .transform((g) => (g.enabled ? g : { enabled: false, note: '', receiverName: '', receiverPhone: '', hidePrices: false }))
export type GiftInput = z.input<typeof giftSchema>
export type GiftOptions = z.output<typeof giftSchema>
export const NO_GIFT: GiftOptions = { enabled: false, note: '', receiverName: '', receiverPhone: '', hidePrices: false }

// ---------------------------------------------------------------- cart lines sent to the server
// Only identities + quantities travel. Prices, names and images are looked up again on the server.
export const lineSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  variantId: z.string().trim().min(1).max(160),
  size: z.string().trim().max(20).optional(),
  qty: z.number().int().min(1).max(99),
  /** custom-print line: never priced from the catalogue — quoted on WhatsApp */
  custom: z.boolean().optional(),
})
export type CheckoutLine = z.infer<typeof lineSchema>

export const VOUCHER_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/
export const voucherCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/\s+/g, ''))
  .refine((v) => VOUCHER_CODE_RE.test(v), 'That doesn’t look like a voucher code.')

export const voucherValidateSchema = z.object({
  code: voucherCode,
  items: z.array(lineSchema).min(1).max(60),
})

export const orderRequestSchema = z.object({
  /** idempotency key (client-generated per checkout attempt) */
  nonce: z.string().trim().regex(/^[A-Za-z0-9_-]{12,64}$/),
  items: z.array(lineSchema).min(1, 'Your cart is empty.').max(60),
  /** signed-in customers: one of their saved addresses */
  addressId: z.uuid('Pick a delivery address.').optional(),
  /** guests: the delivery address typed at checkout (never saved to an address book) */
  address: addressInputSchema.omit({ isDefault: true }).optional(),
  /** guests: who is ordering (required for guests; ignored for signed-in customers) */
  contact: contactSchema.optional(),
  /** honeypot (hidden field in the contact step) — people leave it empty */
  website: z.string().max(200).optional(),
  /** the total the shopper saw; a different server total answers 409 price-changed instead of placing the order */
  expectedPayable: z.number().int().min(0).max(10_000_000).optional(),
  gift: giftSchema.optional(),
  voucherCode: voucherCode.optional(),
  note: optText(500),
  source: z
    .object({
      src: optText(64),
      utm_source: optText(100),
      utm_medium: optText(100),
      utm_campaign: optText(100),
      referrer: optText(200),
      landing: optText(200),
    })
    .partial()
    .optional(),
})
export type OrderRequest = z.input<typeof orderRequestSchema>

/** Guest voucher check (POST /api/orders/voucher): the cart + who is ordering (per-customer limits by phone). */
export const guestVoucherSchema = voucherValidateSchema.extend({
  phone: z.string().trim().max(24).optional().default(''),
  email: z.string().trim().max(200).optional().default(''),
})

/** First message per field, for inline errors. */
export function fieldErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const k = String(i.path[0] ?? '_')
    if (!out[k]) out[k] = i.message
  }
  return out
}
