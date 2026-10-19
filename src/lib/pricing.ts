// Pure pricing engine — no React, no Next, RELATIVE imports only (so `node --test` can run it).
// Owner: F2. Maths from docs/source/NOTEBOOK_TRANSCRIPTION.md (rules live in ./data/rules).
import type { BundleRule, CartItem, CartTotals, CustomQuote, CustomSpec, Product, ProductType, Variant } from './types'
import { apparelCustom, bundleRules, customRules, teeFits } from './data/rules'

// ---------------------------------------------------------------- formatting
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** formatINR(1200) → "₹1,200" · formatINR(100000) → "₹1,00,000" (Indian grouping) */
export function formatINR(n: number): string {
  const r = Math.round(n)
  return r < 0 ? `−₹${INR.format(-r)}` : `₹${INR.format(r)}`
}

/** formatINRRange(1200, 2000) → "₹1,200–2,000" */
export function formatINRRange(lo: number, hi: number): string {
  if (lo === hi) return formatINR(lo)
  return `${formatINR(lo)}–${INR.format(Math.round(hi))}`
}

/** "1200–2000" | "1200-2000" → [1200, 2000] */
export function parseRange(range: string | undefined | null): [number, number] | null {
  if (!range) return null
  const m = /^\s*(\d+)\s*[–—-]\s*(\d+)\s*$/.exec(range)
  if (!m) return null
  const a = Number(m[1]), b = Number(m[2])
  return a <= b ? [a, b] : [b, a]
}

/** Lowest/highest numbers a variant can cost (range or fixed), or null for price-on-request. */
export function variantBounds(v: Variant): [number, number] | null {
  if (typeof v.price === 'number') return [v.price, v.price]
  return parseRange(v.attrs?.range)
}

/** "₹800" · "₹1,200–2,000" · "Price on request" */
export function variantPriceLabel(v: Variant): string {
  const b = variantBounds(v)
  return b ? formatINRRange(b[0], b[1]) : 'Price on request'
}

/**
 * Card / PDP price label.
 * - priceOnRequest → "Price on request"
 * - one fixed price → "₹800"
 * - any range variant → "₹1,200–2,000" (lowest–highest across variants)
 * - several fixed prices → "From ₹400"
 */
export function productPriceLabel(p: Pick<Product, 'variants' | 'priceFrom' | 'priceOnRequest'>): string {
  if (p.priceOnRequest) return 'Price on request'
  const bounds = p.variants.map(variantBounds).filter((b): b is [number, number] => b !== null)
  if (!bounds.length) return p.priceFrom != null ? `From ${formatINR(p.priceFrom)}` : 'Price on request'
  const lo = Math.min(...bounds.map((b) => b[0]))
  const hi = Math.max(...bounds.map((b) => b[1]))
  if (lo === hi) return formatINR(lo)
  const hasRange = p.variants.some((v) => v.price == null && parseRange(v.attrs?.range))
  return hasRange ? formatINRRange(lo, hi) : `From ${formatINR(lo)}`
}

// ---------------------------------------------------------------- bundle matching
const NOUN: Partial<Record<ProductType, [string, string]>> = {
  polaroid: ['polaroid', 'polaroids'],
  poster: ['poster', 'posters'],
  bookmark: ['bookmark', 'bookmarks'],
  badge: ['badge', 'badges'],
  sticker: ['sticker', 'stickers'],
}

function ruleNoun(rule: BundleRule, count: number): string {
  const [one, many] = NOUN[rule.appliesTo.type] ?? [rule.appliesTo.type, `${rule.appliesTo.type}s`]
  const prefix = rule.appliesTo.variantAttr ? `${rule.appliesTo.variantAttr[1]} ` : ''
  return prefix + (count === 1 ? one : many)
}

/** Does a cart line count towards this rule? Custom and price-on-request lines never do. */
export function ruleMatches(rule: BundleRule, item: CartItem): boolean {
  if (item.custom || item.unitPrice == null || item.qty <= 0) return false
  if (rule.appliesTo.type !== item.type) return false
  const attr = rule.appliesTo.variantAttr
  if (!attr) return true
  const [k, v] = attr
  if (item.variantAttrs && k in item.variantAttrs) return item.variantAttrs[k] === v
  // Fallbacks for lines added without attrs: seed variant ids end in `--<key>`; else match the label.
  return item.variantId.endsWith(`--${v}`) || item.variantLabel.toLowerCase().includes(v.toLowerCase())
}

// ---------------------------------------------------------------- totals
export function computeTotals(items: CartItem[], rules: BundleRule[] = bundleRules): CartTotals {
  const rawSaving = items.map(() => 0)
  const consumed = items.map(() => 0) // units already used by an earlier rule
  const applied: CartTotals['applied'] = []
  const hints: string[] = []

  for (const rule of rules) {
    const units: Array<{ idx: number; price: number }> = []
    items.forEach((it, idx) => {
      if (!ruleMatches(rule, it)) return
      const free = Math.max(0, Math.floor(it.qty) - consumed[idx])
      for (let u = 0; u < free; u++) units.push({ idx, price: it.unitPrice as number })
    })
    if (!units.length) continue
    units.sort((a, b) => b.price - a.price) // most expensive first; stable for equal prices

    const groupSize = rule.kind === 'buyXgetY' ? rule.n + (rule.free ?? 1) : rule.n
    if (groupSize <= 0) continue
    const groups = Math.floor(units.length / groupSize)
    let ruleSaving = 0

    for (let g = 0; g < groups; g++) {
      const grp = units.slice(g * groupSize, g * groupSize + groupSize)
      if (rule.kind === 'nForPrice') {
        const sum = grp.reduce((s, u) => s + u.price, 0)
        const saving = sum - (rule.price ?? sum)
        if (saving <= 0) continue
        for (const u of grp) { rawSaving[u.idx] += (saving * u.price) / sum; consumed[u.idx]++ }
        ruleSaving += saving
      } else {
        // buy X get Y: the cheapest `free` units of each group cost nothing
        const freeCount = rule.free ?? 1
        const freeUnits = grp.slice(grp.length - freeCount)
        for (const u of grp) consumed[u.idx]++
        for (const u of freeUnits) { rawSaving[u.idx] += u.price; ruleSaving += u.price }
      }
    }
    if (ruleSaving > 0) applied.push({ ruleId: rule.id, label: rule.label, saving: Math.round(ruleSaving) })

    const rem = units.length % groupSize
    if (rem > 0) {
      const need = groupSize - rem
      if (rule.kind === 'buyXgetY') {
        const freeCount = rule.free ?? 1
        hints.push(need <= freeCount
          ? `Add ${need} more ${ruleNoun(rule, need)} — ${need === 1 ? "it's" : "they're"} free (buy ${rule.n}, get ${freeCount} free).`
          : `Add ${need} more ${ruleNoun(rule, need)} to get ${freeCount} free (buy ${rule.n}, get ${freeCount} free).`)
      } else {
        hints.push(`Add ${need} more ${ruleNoun(rule, need)} to unlock ${rule.label}.`)
      }
    }
  }

  // Integer rupee savings per line (largest remainder, so lines sum exactly to the total saving).
  const savings = applied.reduce((s, a) => s + a.saving, 0)
  const floored = rawSaving.map((s) => Math.floor(s + 1e-9))
  let leftover = savings - floored.reduce((s, v) => s + v, 0)
  const order = rawSaving.map((s, i) => ({ i, frac: s - Math.floor(s + 1e-9) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) { if (leftover <= 0) break; if (rawSaving[i] > 0) { floored[i]++; leftover-- } }

  let subtotal = 0
  let hasPriceOnRequest = false
  const lines = items.map((it, i) => {
    if (it.unitPrice == null) { hasPriceOnRequest = true; return { ...it, lineTotal: null, saving: 0 } }
    const gross = it.unitPrice * it.qty
    subtotal += gross
    return { ...it, lineTotal: gross - floored[i], saving: floored[i] }
  })

  return { lines, subtotal, savings, total: subtotal - savings, hasPriceOnRequest, applied, hints }
}

// ---------------------------------------------------------------- custom orders
const APPAREL: ProductType[] = ['tshirt', 'hoodie']
/** Custom prices the owner's notebook states without doubt. Everything else is an estimate. */
const CONFIRMED_CUSTOM: ProductType[] = ['polaroid']

/** Minimum pieces for a custom order of this type (1 when there is no rule). */
export function minQtyFor(type: ProductType): number {
  return customRules.find((r) => r.type === type)?.minQty ?? 1
}

/**
 * Quote a Custom Forge request.
 * Apparel: garment price (from `product`'s chosen/first variant, else oversized ₹800 for tees,
 * unknown for hoodies) × qty + ₹200 company design (once per order — owner to confirm)
 * + ₹200 half-n-half per piece. Always an estimate ("depends on cloth price").
 * Others: notebook unit price × qty, with the minimum flagged.
 */
export function customQuote(
  spec: Pick<CustomSpec, 'product' | 'quantity' | 'mode' | 'halfHalf'>,
  product?: Pick<Product, 'variants' | 'priceFrom' | 'priceOnRequest'> | null,
  variantId?: string,
): CustomQuote {
  const type = spec.product
  const rule = customRules.find((r) => r.type === type)
  const minQty = minQtyFor(type)
  const quantity = Math.max(0, Math.floor(spec.quantity || 0))
  const notes: string[] = []
  const extras: CustomQuote['extras'] = []
  let unitPrice: number | null
  let estimate: boolean

  if (APPAREL.includes(type)) {
    const v = product?.variants.find((x) => x.id === variantId) ?? product?.variants[0]
    unitPrice = product
      ? (product.priceOnRequest ? null : v?.price ?? product.priceFrom ?? null)
      : type === 'tshirt' ? (teeFits.find((f) => f.id === 'oversized')?.price ?? null) : null
    if (spec.mode === 'company') extras.push({ label: 'Design by The Escape Door', amount: apparelCustom.companyDesignFee, per: 'order' })
    if (spec.halfHalf) extras.push({ label: 'Half-n-half print', amount: apparelCustom.halfHalfFee, per: 'piece' })
    const z = apparelCustom.zones
    notes.push(`Print zones: front ${z.front.w}×${z.front.h} in, back ${z.back.w}×${z.back.h} in.`)
    if (unitPrice == null && type === 'hoodie') notes.push('Hoodies are ₹1200–2500 by GSM — pick a weight to see the garment price.')
    notes.push(apparelCustom.note)
    estimate = true
  } else {
    unitPrice = rule?.unitPrice ?? null
    if (spec.mode === 'company') notes.push('Want us to design it? We quote the design on WhatsApp.')
    estimate = !CONFIRMED_CUSTOM.includes(type)
  }
  if (rule?.note) notes.push(rule.note)
  if (!rule && !APPAREL.includes(type)) notes.push('Price on request — we quote this on WhatsApp.')

  const meetsMinimum = quantity >= minQty
  if (!meetsMinimum) notes.unshift(`Minimum ${minQty} ${minQty === 1 ? 'piece' : 'pieces'} for custom ${NOUN[type]?.[1] ?? type}.`)

  const total = unitPrice == null
    ? null
    : unitPrice * quantity + extras.reduce((s, e) => s + (e.per === 'piece' ? e.amount * quantity : e.amount), 0)

  return { type, quantity, minQty, meetsMinimum, unitPrice, extras, total, estimate, notes }
}
