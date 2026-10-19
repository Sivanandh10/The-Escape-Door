// Custom Forge state model: product options, quote maths, draft persistence, WhatsApp message.
// Owner: P3 forge. Pure (no React) so the page, the studio and tests can share it.
import type { ApparelCustomRules, CustomRule, HoodieTier, TeeFit } from '@/lib/types'
import { formatINR } from '@/lib/pricing'

export type ForgeKind = 'tshirt' | 'hoodie' | 'polaroid' | 'bookmark' | 'sticker' | 'badge'
export type Side = 'front' | 'back'
export const KINDS: ForgeKind[] = ['tshirt', 'hoodie', 'polaroid', 'bookmark', 'sticker', 'badge']
export const isApparel = (k: ForgeKind | null): k is 'tshirt' | 'hoodie' => k === 'tshirt' || k === 'hoodie'

export interface ForgeData {
  fits: TeeFit[]
  tiers: HoodieTier[]
  rules: CustomRule[]
  apparel: ApparelCustomRules
}

export const KIND_META: Record<ForgeKind, { label: string; plural: string; jp: string; blurb: string }> = {
  tshirt: { label: 'T-shirt', plural: 'T-shirts', jp: 'Tシャツ', blurb: 'Oversized, regular or baby tee' },
  hoodie: { label: 'Hoodie', plural: 'Hoodies', jp: 'パーカー', blurb: 'Four fabric weights by GSM' },
  polaroid: { label: 'Polaroids', plural: 'Polaroids', jp: 'ポラロイド', blurb: 'Same or different designs' },
  bookmark: { label: 'Bookmarks', plural: 'Bookmarks', jp: 'しおり', blurb: 'Plain or magnetic' },
  sticker: { label: 'Stickers', plural: 'Stickers', jp: 'ステッカー', blurb: 'Laptops, bottles, phones' },
  badge: { label: 'Badges', plural: 'Badges', jp: '缶バッジ', blurb: 'Bulk runs for clubs and fests' },
}

/** Placement of the artwork inside a print zone. x/y = centre as a fraction of the zone, scale = fraction of the zone. */
export interface Placement {
  on: boolean
  x: number
  y: number
  scale: number
  rotate: number
  /** index into the attached files */
  file: number
}

export const DEFAULT_PLACE: Record<Side, Placement> = {
  front: { on: true, x: 0.5, y: 0.5, scale: 0.86, rotate: 0, file: 0 },
  back: { on: true, x: 0.5, y: 0.42, scale: 0.8, rotate: 0, file: 0 },
}

export interface ForgeDraft {
  v: 1
  kind: ForgeKind | null
  fit: TeeFit['id']
  tier: string
  bookmark: 'plain' | 'magnetic'
  mode: 'own' | 'company'
  brief: string
  side: Side
  place: Record<Side, Placement>
  halfHalf: boolean
  qty: number
  name: string
  city: string
  phone: string
  notes: string
  step: number
  maxStep: number
}

export const STEPS = [
  { id: 'pick', label: 'Pick', jp: '選ぶ' },
  { id: 'design', label: 'Design', jp: '描く' },
  { id: 'place', label: 'Place', jp: '配置' },
  { id: 'send', label: 'Send', jp: '送信' },
] as const

export function initialDraft(data: ForgeData): ForgeDraft {
  return {
    v: 1,
    kind: null,
    fit: data.fits.find((f) => f.id === 'oversized')?.id ?? data.fits[0]?.id ?? 'oversized',
    tier: data.tiers[0]?.id ?? '',
    bookmark: 'magnetic',
    mode: 'own',
    brief: '',
    side: 'back',
    place: { front: { ...DEFAULT_PLACE.front }, back: { ...DEFAULT_PLACE.back } },
    halfHalf: false,
    qty: 1,
    name: '',
    city: '',
    phone: '',
    notes: '',
    step: 0,
    maxStep: 0,
  }
}

export const minQty = (kind: ForgeKind | null, data: ForgeData) =>
  kind ? Math.max(1, data.rules.find((r) => r.type === kind)?.minQty ?? 1) : 1

/** Lowest garment / unit price for the product picker. */
export function fromPrice(kind: ForgeKind, data: ForgeData): number | null {
  if (kind === 'tshirt') return data.fits.length ? Math.min(...data.fits.map((f) => f.price)) : null
  if (kind === 'hoodie') return data.tiers.length ? Math.min(...data.tiers.map((t) => t.price)) : null
  return data.rules.find((r) => r.type === kind)?.unitPrice ?? null
}

export interface QuoteLine {
  label: string
  detail?: string
  amount: number | null
}
export interface ForgeQuote {
  lines: QuoteLine[]
  total: number | null
  /** shown after the total when part of it is quoted on WhatsApp */
  plus?: string
  minQty: number
  estimate: boolean
  notes: string[]
}

export function garmentLabel(d: ForgeDraft, data: ForgeData): string {
  if (d.kind === 'tshirt') {
    const f = data.fits.find((x) => x.id === d.fit)
    return f ? (f.id === 'baby' ? f.label : `${f.label} tee`) : 'T-shirt'
  }
  if (d.kind === 'hoodie') {
    const t = data.tiers.find((x) => x.id === d.tier)
    return t ? `Hoodie ${t.code} · ${t.gsmLabel}` : 'Hoodie'
  }
  if (d.kind === 'bookmark') return `${d.bookmark === 'magnetic' ? 'Magnetic' : 'Plain'} bookmarks`
  return d.kind ? KIND_META[d.kind].plural : ''
}

/** Live quote from the data the page passed in (mirrors pricing.customQuote, without the owner-doubt notes). */
export function quoteFor(d: ForgeDraft, data: ForgeData): ForgeQuote {
  const min = minQty(d.kind, data)
  const qty = Math.max(min, d.qty)
  if (!d.kind) return { lines: [], total: null, minQty: 1, estimate: true, notes: [] }

  if (isApparel(d.kind)) {
    const unit =
      d.kind === 'tshirt' ? data.fits.find((f) => f.id === d.fit)?.price ?? null : data.tiers.find((t) => t.id === d.tier)?.price ?? null
    const lines: QuoteLine[] = [{ label: garmentLabel(d, data), detail: `${qty} × ${unit == null ? '—' : formatINR(unit)}`, amount: unit == null ? null : unit * qty }]
    if (d.mode === 'company') lines.push({ label: 'We design it', detail: 'once per order', amount: data.apparel.companyDesignFee })
    if (d.halfHalf) lines.push({ label: 'Half-n-half print', detail: `${qty} × ${formatINR(data.apparel.halfHalfFee)}`, amount: data.apparel.halfHalfFee * qty })
    const total = lines.some((l) => l.amount == null) ? null : lines.reduce((s, l) => s + (l.amount ?? 0), 0)
    return { lines, total, minQty: min, estimate: true, notes: ['Final price depends on the garment. We confirm it on WhatsApp before you pay.'] }
  }

  const rule = data.rules.find((r) => r.type === d.kind)
  const unit = rule?.unitPrice ?? null
  const lines: QuoteLine[] = [{ label: garmentLabel(d, data), detail: `${qty} × ${unit == null ? '—' : formatINR(unit)}`, amount: unit == null ? null : unit * qty }]
  let plus: string | undefined
  if (d.mode === 'company') {
    lines.push({ label: 'We design it', detail: 'quoted on WhatsApp', amount: null })
    plus = '+ design'
  }
  const base = lines[0].amount
  return {
    lines,
    total: base,
    plus,
    minQty: min,
    estimate: true,
    notes: [`Minimum ${min} pieces — same or different designs.`, 'We confirm the final number on WhatsApp before printing.'],
  }
}

// ---------------------------------------------------------------- draft storage
const KEY = 'ted-forge-draft-v1'

export function loadDraft(data: ForgeData): ForgeDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<ForgeDraft>
    if (d.v !== 1) return null
    const base = initialDraft(data)
    const merged: ForgeDraft = {
      ...base,
      ...d,
      place: { front: { ...base.place.front, ...d.place?.front }, back: { ...base.place.back, ...d.place?.back } },
    } as ForgeDraft
    if (merged.kind && !KINDS.includes(merged.kind)) merged.kind = null
    return merged
  } catch {
    return null
  }
}
export function saveDraft(d: ForgeDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {}
}
export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

/** ?product= → kind (+ tee fit). Accepts product types, category slugs and plurals. */
export function parseProductParam(v: string | null): { kind: ForgeKind; fit?: TeeFit['id'] } | null {
  if (!v) return null
  const s = v.toLowerCase().trim()
  if (/oversized/.test(s)) return { kind: 'tshirt', fit: 'oversized' }
  if (/baby/.test(s)) return { kind: 'tshirt', fit: 'baby' }
  if (/^(tshirt|t-shirt|t-shirts|tee|tees|tshirts|regular)$/.test(s)) return { kind: 'tshirt' }
  if (/^hoodies?$/.test(s)) return { kind: 'hoodie' }
  if (/^polaroids?$/.test(s)) return { kind: 'polaroid' }
  if (/^bookmarks?$/.test(s)) return { kind: 'bookmark' }
  if (/^stickers?$/.test(s)) return { kind: 'sticker' }
  if (/^badges?$/.test(s)) return { kind: 'badge' }
  return null
}

// ---------------------------------------------------------------- WhatsApp message
const pct = (n: number) => `${Math.round(n * 100)}%`
const clean = (s: string, max = 400) => s.replace(/\s+/g, ' ').trim().slice(0, max)

export function buildForgeMessage(
  d: ForgeDraft,
  data: ForgeData,
  opts: { fileUrls: string[]; filesPending: number; fileCount: number; ref?: string; leadId?: string },
): string {
  const q = quoteFor(d, data)
  const qty = Math.max(q.minQty, d.qty)
  const z = data.apparel.zones
  const out: string[] = []
  out.push(`Hi The Escape Door! Custom Forge request${opts.leadId ? ` (ref ${opts.leadId.slice(0, 8)})` : ''}:`)
  out.push('')
  out.push(`• Product: ${garmentLabel(d, data)} × ${qty}`)
  out.push(
    `• Design: ${d.mode === 'company' ? 'please design it for me' : 'my own artwork'}${opts.fileCount ? ` (${opts.fileCount} file${opts.fileCount > 1 ? 's' : ''})` : ''}`,
  )
  if (d.mode === 'company' && clean(d.brief)) out.push(`• Brief: "${clean(d.brief, 600)}"`)
  if (isApparel(d.kind)) {
    const sides = (['front', 'back'] as Side[]).filter((s) => d.place[s].on)
    for (const s of sides) {
      const p = d.place[s]
      const zone = z[s]
      out.push(`• Print ${s} (${zone.w}×${zone.h} in): size ${pct(p.scale)} of zone, centre ${pct(p.x)} across / ${pct(p.y)} down${p.rotate ? `, rotated ${Math.round(p.rotate)}°` : ''}`)
    }
    if (d.halfHalf) out.push(`• Half-n-half: yes (+${formatINR(data.apparel.halfHalfFee)} each)`)
  }
  out.push('')
  for (const l of q.lines) out.push(`${l.label}: ${l.detail ?? ''}${l.amount != null ? ` = ${formatINR(l.amount)}` : ''}`)
  if (q.total != null) out.push(`Estimate: ${formatINR(q.total)}${q.plus ? ` ${q.plus}` : ''}`)
  else out.push('Estimate: please quote')

  if (opts.fileUrls.length) {
    out.push('')
    out.push('Files:')
    opts.fileUrls.forEach((u) => out.push(`• ${u}`))
  }
  if (opts.filesPending > 0) {
    out.push('')
    out.push(`I'll share the design ${opts.filesPending === 1 ? 'file' : `files (${opts.filesPending})`} here in chat.`)
  }
  out.push('')
  if (clean(d.name)) out.push(`Name: ${clean(d.name, 80)}`)
  if (clean(d.city)) out.push(`City: ${clean(d.city, 80)}`)
  if (clean(d.phone)) out.push(`WhatsApp: ${clean(d.phone, 20)}`)
  if (clean(d.notes)) out.push(`Notes: ${clean(d.notes, 600)}`)
  if (opts.ref) {
    out.push('')
    out.push(`ref: ${clean(opts.ref, 40)}`)
  }
  return out.join('\n')
}
