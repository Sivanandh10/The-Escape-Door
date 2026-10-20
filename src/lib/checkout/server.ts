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
import type { BundleRule, CartItem, Product, ProductImage, Variant } from '@/lib/types'
import type { CheckoutLine } from './schema'
import { voucherFromRow, type OrderLine, type OrderTotals, type Voucher } from './types'
import { evaluateVoucher, type VoucherResult } from './voucher'

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
    public code: 'unavailable' | 'item-missing' | 'sold-out' | 'empty' | 'voucher' | 'address' | 'db',
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

async function redemptionCounts(voucherId: string, userId: string): Promise<{ total: number; mine: number }> {
  const sb = supabaseAdmin()
  if (!sb) return { total: 0, mine: 0 }
  const [all, mine] = await Promise.all([
    sb.from('voucher_redemptions').select('id', { count: 'exact', head: true }).eq('voucher_id', voucherId),
    sb.from('voucher_redemptions').select('id', { count: 'exact', head: true }).eq('voucher_id', voucherId).eq('user_id', userId),
  ])
  return { total: all.count ?? 0, mine: mine.count ?? 0 }
}

export type AppliedVoucher = { voucher: Voucher; result: VoucherResult }

export async function applyVoucher(code: string, totals: ReturnType<typeof computeTotals>, buyer: Buyer): Promise<AppliedVoucher | null> {
  const voucher = await findVoucher(code)
  if (!voucher) return null
  const used = await redemptionCounts(voucher.id, buyer.user.id)
  const result = evaluateVoucher(voucher, {
    totals,
    // assigned vouchers match the login email, even a synthetic MAL one (never mailed)
    email: buyer.user.email ?? null,
    usedTotal: used.total,
    usedByUser: used.mine,
    inr: formatINR,
  })
  return { voucher, result }
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
