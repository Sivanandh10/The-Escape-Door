// Checkout — SERVER ONLY (route handlers / server components). Owner: CHECKOUT.
// Prices are never taken from the browser: every order is re-priced here from FRESH database rows
// (products, bundle rules, vouchers, the 'checkout' settings key) — not from the per-instance 'use cache'
// copies, so an admin price change applies to the very next order on every instance.
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { computeTotals, formatINR } from '@/lib/pricing'
import { products as seedProducts, bundleRules as seedRules } from '@/lib/data/seed'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { publicClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getAuthUser } from '@/lib/auth/customer-server'
import { contactEmail } from '@/lib/auth/shared'
import { isMalConfigured } from '@/lib/auth/mal'
import type { BundleRule, CartItem, Product, ProductImage, Variant } from '@/lib/types'
import type { CheckoutLine } from './schema'
import { voucherFromRow, type OrderLine, type OrderTotals, type Voucher } from './types'
import { VOUCHER_MESSAGES, evaluateVoucher, type VoucherResult } from './voucher'

export interface CheckoutSettings {
  /** ₹ added when "pack as a gift" is on; 0 = free (no fee shown) */
  giftWrapFee: number
}
export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = { giftWrapFee: 0 }

export function parseCheckoutSettings(v: unknown): CheckoutSettings {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  const fee = typeof o.giftWrapFee === 'number' && Number.isFinite(o.giftWrapFee) ? Math.max(0, Math.min(5000, Math.round(o.giftWrapFee))) : 0
  return { giftWrapFee: fee }
}

/** Service role when available (bypasses RLS for reads we fully control), else the anon client. */
function readClient(): SupabaseClient | null {
  return supabaseAdmin() ?? publicClient()
}

// ---------------------------------------------------------------- who is buying
export interface Buyer {
  user: User
  /** real, contactable email (null for MyAnimeList-only accounts) */
  email: string | null
}

export async function getBuyer(): Promise<Buyer | null> {
  const auth = await getAuthUser()
  if (!auth) return null
  return { user: auth.user, email: contactEmail(auth.user.email) }
}

// ---------------------------------------------------------------- fresh catalogue reads
type Row = Record<string, unknown>
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function toProduct(r: Row): Pick<Product, 'id' | 'slug' | 'name' | 'type' | 'collection' | 'images' | 'variants' | 'priceOnRequest' | 'stock'> {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    type: str(r.type) as Product['type'],
    collection: str(r.collection),
    images: (Array.isArray(r.images) ? r.images : []) as ProductImage[],
    variants: (Array.isArray(r.variants) ? r.variants : []) as Variant[],
    priceOnRequest: r.price_on_request === true,
    stock: (['in', 'low', 'out', 'made-to-order'].includes(str(r.stock)) ? str(r.stock) : 'in') as Product['stock'],
  }
}

function toRule(r: Row): BundleRule {
  const k = str(r.variant_attr_key), v = str(r.variant_attr_value)
  const price = num(r.price), free = num(r.free)
  return {
    id: str(r.id), label: str(r.label),
    appliesTo: { type: str(r.applies_type) as BundleRule['appliesTo']['type'], ...(k && v ? { variantAttr: [k, v] as [string, string] } : {}) },
    kind: r.kind === 'buyXgetY' ? 'buyXgetY' : 'nForPrice', n: num(r.n) ?? 1,
    ...(price != null ? { price } : {}), ...(free != null ? { free } : {}),
  }
}

export class CheckoutError extends Error {
  constructor(
    public code: 'unavailable' | 'item-missing' | 'sold-out' | 'empty' | 'voucher' | 'address' | 'contact' | 'price-changed' | 'login' | 'rate-limited' | 'db',
    message: string,
    public detail?: Record<string, unknown>,
  ) {
    super(message)
  }
}

type PricedProduct = ReturnType<typeof toProduct>

async function loadProducts(slugs: string[]): Promise<Map<string, PricedProduct>> {
  if (!isSupabaseConfigured()) return new Map(seedProducts.filter((p) => slugs.includes(p.slug)).map((p) => [p.slug, toProduct({ ...p, price_on_request: p.priceOnRequest })]))
  const sb = readClient()
  if (!sb) throw new CheckoutError('unavailable', 'The shop is offline for a moment. Try again shortly.')
  const { data, error } = await sb
    .from('products')
    .select('id, slug, name, type, collection, images, variants, price_on_request, stock, is_published')
    .in('slug', slugs)
    .eq('is_published', true)
  if (error || !Array.isArray(data)) throw new CheckoutError('unavailable', 'We couldn’t load prices right now. Try again in a moment.')
  return new Map((data as Row[]).map((r) => [str(r.slug), toProduct(r)]))
}

async function loadRules(): Promise<BundleRule[]> {
  if (!isSupabaseConfigured()) return seedRules
  const sb = readClient()
  if (!sb) return []
  const { data, error } = await sb.from('bundle_rules').select('*')
  if (error || !Array.isArray(data)) throw new CheckoutError('unavailable', 'We couldn’t load the bundle deals right now. Try again in a moment.')
  return (data as Row[]).filter((r) => r.active !== false).map(toRule)
}

export async function loadCheckoutSettings(): Promise<CheckoutSettings> {
  const sb = readClient()
  if (!sb) return DEFAULT_CHECKOUT_SETTINGS
  try {
    const { data } = await sb.from('settings').select('value').eq('key', 'checkout').maybeSingle()
    return parseCheckoutSettings((data as { value?: unknown } | null)?.value)
  } catch {
    return DEFAULT_CHECKOUT_SETTINGS
  }
}

const thumb = (p: Pick<Product, 'images'>) => {
  const src = (p.images.find((i) => i.side !== 'back') ?? p.images[0])?.src ?? ''
  return /^\/mockups\/.+-(front|back)\.webp$/.test(src) ? src.replace(/\.webp$/, '-600.webp') : src
}

/** Re-price cart lines from the database. Throws CheckoutError for missing / sold-out items. */
export async function priceLines(lines: CheckoutLine[]): Promise<{ items: CartItem[]; totals: ReturnType<typeof computeTotals> }> {
  if (!lines.length) throw new CheckoutError('empty', 'Your cart is empty.')
  const slugs = [...new Set(lines.map((l) => l.slug))]
  const [products, rules] = await Promise.all([loadProducts(slugs), loadRules()])

  const merged = new Map<string, CartItem>()
  for (const l of lines) {
    const p = products.get(l.slug)
    const v = p?.variants.find((x) => x.id === l.variantId)
    if (!p || !v) throw new CheckoutError('item-missing', 'Something in your cart is no longer in the shop. Remove it and try again.', { slug: l.slug })
    if (p.stock === 'out') throw new CheckoutError('sold-out', `${p.name} just sold out. Remove it to continue.`, { slug: l.slug })
    const size = l.size?.trim() || undefined
    const key = `${p.id}|${v.id}|${size ?? ''}${l.custom ? '|custom' : ''}`
    const prev = merged.get(key)
    if (prev) {
      prev.qty = Math.min(99, prev.qty + l.qty)
      continue
    }
    merged.set(key, {
      key,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      type: p.type,
      collection: p.collection,
      variantId: v.id,
      variantLabel: v.label,
      ...(v.attrs ? { variantAttrs: v.attrs } : {}),
      ...(size ? { size } : {}),
      unitPrice: !l.custom && !p.priceOnRequest && typeof v.price === 'number' ? v.price : null,
      qty: l.qty,
      image: thumb(p),
    })
  }
  const items = [...merged.values()]
  return { items, totals: computeTotals(items, rules) }
}

// ---------------------------------------------------------------- vouchers
export async function findVoucher(code: string): Promise<Voucher | null> {
  const sb = supabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from('vouchers').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error || !data) return null
  return voucherFromRow(data as Row)
}

/** Who a voucher is checked for: a signed-in customer (user id + login email) or a guest (phone / typed email). */
export type VoucherIdentity =
  | { kind: 'user'; userId: string; email: string | null }
  | { kind: 'guest'; phone: string; email: string | null }

async function redemptionCounts(voucherId: string, who: VoucherIdentity): Promise<{ total: number; mine: number }> {
  const sb = supabaseAdmin()
  if (!sb) return { total: 0, mine: 0 }
  const all = sb.from('voucher_redemptions').select('id', { count: 'exact', head: true }).eq('voucher_id', voucherId)
  if (who.kind === 'user') {
    const [a, m] = await Promise.all([all, sb.from('voucher_redemptions').select('id', { count: 'exact', head: true }).eq('voucher_id', voucherId).eq('user_id', who.userId)])
    return { total: a.count ?? 0, mine: m.count ?? 0 }
  }
  // guests: a typed phone / email proves nothing, so per-customer vouchers are refused for them outright
  // (applyVoucherFor) — only the global count matters here
  const a = await all
  return { total: a.count ?? 0, mine: 0 }
}

export const GUEST_VOUCHERS_OFF = 'Vouchers on guest orders switch on shortly — remove it to place the order, or ask us on WhatsApp.'

export type AppliedVoucher = { voucher: Voucher; result: VoucherResult }

export async function applyVoucherFor(code: string, totals: ReturnType<typeof computeTotals>, who: VoucherIdentity): Promise<AppliedVoucher | null> {
  const voucher = await findVoucher(code)
  if (!voucher) return null
  // "N per customer" needs a verified identity: a guest could reuse it forever by typing a new number each time.
  // Answered like someone else's personal code ('not-yours' → the routes reply "not found", no code enumeration).
  if (who.kind === 'guest' && voucher.perUserLimit != null) {
    return { voucher, result: { ok: false, problem: 'not-yours', message: VOUCHER_MESSAGES['not-yours'] } }
  }
  const used = await redemptionCounts(voucher.id, who)
  const result = evaluateVoucher(voucher, {
    totals,
    // assigned vouchers match the LOGIN email (even a synthetic MAL one, never mailed); a guest's typed email never
    // unlocks someone's personal voucher → '' never equals an assigned address → 'not-yours' (answered as not-found)
    email: who.kind === 'user' ? who.email : '',
    usedTotal: used.total,
    usedByUser: used.mine,
    inr: formatINR,
  })
  return { voucher, result }
}

export function applyVoucher(code: string, totals: ReturnType<typeof computeTotals>, buyer: Buyer): Promise<AppliedVoucher | null> {
  return applyVoucherFor(code, totals, { kind: 'user', userId: buyer.user.id, email: buyer.user.email ?? null })
}

// ---------------------------------------------------------------- guest checkout switches
/**
 * Guests may order only while NO customer login method works (owner rule: once login is live, it's mandatory).
 * Same test as GET /api/auth/providers (Google enabled in Supabase Auth, MAL configured, or email that reaches
 * shoppers). Memoised 60 s per instance. Fails OPEN to guest ordering only when Supabase can't be reached AND
 * MAL is off — then nobody could log in anyway.
 */
let loginMemo: { at: number; live: boolean } | null = null
export async function customerLoginLive(): Promise<boolean> {
  const now = Date.now()
  if (loginMemo && now - loginMemo.at < 60_000) return loginMemo.live
  let live = isMalConfigured()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!live && url && anon) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, cache: 'no-store', signal: AbortSignal.timeout(4000) })
      if (r.ok) {
        const st = (await r.json()) as { external?: Record<string, boolean>; mailer_autoconfirm?: boolean }
        const smtpLive = /^(1|true|yes|on)$/i.test((process.env.AUTH_EMAIL_LIVE ?? '').trim())
        live = !!st.external?.google || (!!st.external?.email && (!!st.mailer_autoconfirm || smtpLive))
      }
    } catch {
      /* unreachable → same answer the providers endpoint gives (off) */
    }
  }
  loginMemo = { at: now, live }
  return live
}

/** true once supabase/migrations/0010_guest_orders.sql has run (orders.contact_phone exists). Memoised 5 min when true. */
let schemaMemo: { at: number; ok: boolean } | null = null
export async function guestSchemaReady(): Promise<boolean> {
  const now = Date.now()
  if (schemaMemo && now - schemaMemo.at < (schemaMemo.ok ? 300_000 : 30_000)) return schemaMemo.ok
  const sb = supabaseAdmin()
  if (!sb) return false
  const { error } = await sb.from('orders').select('contact_phone, guest').limit(0)
  schemaMemo = { at: now, ok: !error }
  return !error
}

/** Final totals stored on the order. */
export function orderTotals(
  totals: ReturnType<typeof computeTotals>,
  discount: number,
  giftFee: number,
  voucher: Voucher | null,
): { lines: OrderLine[]; totals: OrderTotals } {
  const { lines, ...rest } = totals
  const payable = Math.max(0, totals.total - discount) + giftFee
  return {
    lines,
    totals: {
      ...rest,
      discount,
      giftFee,
      payable,
      voucher: voucher && discount > 0 ? { code: voucher.code, description: voucher.description, discount } : null,
    },
  }
}
