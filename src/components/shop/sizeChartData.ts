// Size charts — pure data helpers shared by the storefront modal (SizeChart.tsx), the admin editor
// (admin/crud/SizeChartManager.tsx) and the settings schema. Server + client safe (no React, no Supabase).
// Stored in public.settings under key 'size_charts' (Admin → Pricing → Size charts; catalog.edit). Nothing is
// seeded: the measurements are business facts the owner enters. TYPICAL_SIZE_CHARTS below is ONLY a starting
// point the admin can pre-fill (clearly labelled), never shown to shoppers.
import type { ProductType, Variant } from '@/lib/types'

export const SIZE_CHARTS_KEY = 'size_charts'

export const SIZE_FITS = [
  { id: 'oversized', label: 'Oversized tee', short: 'Oversized', jp: 'オーバーサイズ' },
  { id: 'regular', label: 'Regular tee', short: 'Regular', jp: 'レギュラー' },
  { id: 'baby', label: 'Baby tee', short: 'Baby tee', jp: 'ベビーT' },
  { id: 'hoodie', label: 'Hoodie', short: 'Hoodie', jp: 'パーカー' },
] as const

export type SizeFit = (typeof SIZE_FITS)[number]['id']

export interface SizeChartRow {
  size: string
  /** inches, garment measurement (full chest round) */
  chest: number | null
  /** inches, top of the shoulder to the hem */
  length: number | null
  /** inches, seam to seam */
  shoulder: number | null
}

export interface SizeCharts {
  charts: Partial<Record<SizeFit, SizeChartRow[]>>
  /** optional line shown under the table, e.g. "Measured flat, ±0.5 in" */
  note: string
}

export const EMPTY_SIZE_CHARTS: SizeCharts = { charts: {}, note: '' }
export const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XXXL', '4XL']
export const MAX_SIZE_ROWS = 12

const isFit = (k: string): k is SizeFit => SIZE_FITS.some((f) => f.id === k)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 99 ? v : null)

/** Defensive read of whatever is stored (bad rows dropped, never throws). */
export function normalizeSizeCharts(v: unknown): SizeCharts {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return EMPTY_SIZE_CHARTS
  const raw = v as { charts?: unknown; note?: unknown }
  const out: SizeCharts = { charts: {}, note: typeof raw.note === 'string' ? raw.note.slice(0, 300) : '' }
  if (raw.charts && typeof raw.charts === 'object' && !Array.isArray(raw.charts)) {
    for (const [k, rows] of Object.entries(raw.charts as Record<string, unknown>)) {
      if (!isFit(k) || !Array.isArray(rows)) continue
      const clean = rows
        .map((r) => {
          if (!r || typeof r !== 'object') return null
          const o = r as Record<string, unknown>
          const size = typeof o.size === 'string' ? o.size.trim().slice(0, 8) : ''
          if (!size) return null
          return { size, chest: num(o.chest), length: num(o.length), shoulder: num(o.shoulder) }
        })
        .filter((r): r is SizeChartRow => !!r && (r.chest !== null || r.length !== null))
        .slice(0, MAX_SIZE_ROWS)
      if (clean.length) out.charts[k] = clean
    }
  }
  return out
}

/** Fits that have at least one row, in display order. */
export function filledFits(c: SizeCharts): SizeFit[] {
  return SIZE_FITS.map((f) => f.id).filter((id) => (c.charts[id]?.length ?? 0) > 0)
}

/** Which chart a product/variant uses: hoodies → 'hoodie'; tees → the variant's fit attr. null = unknown. */
export function fitFor(type: ProductType, variant?: Pick<Variant, 'attrs'> | null): SizeFit | null {
  if (type === 'hoodie') return 'hoodie'
  const f = variant?.attrs?.fit
  return f && isFit(f) ? f : null
}

export const fitLabel = (id: SizeFit) => SIZE_FITS.find((f) => f.id === id)?.label ?? id

/** in → cm, one decimal ("44" → "111.8") */
export const toCm = (inches: number) => Math.round(inches * 25.4) / 10

/**
 * TYPICAL garment measurements (inches) for Indian D2C streetwear blanks — a STARTING POINT for the admin form only.
 * Every brand's blanks differ: the owner must measure their own and correct these before saving.
 */
export const TYPICAL_SIZE_CHARTS: Record<SizeFit, SizeChartRow[]> = {
  oversized: [
    { size: 'XS', chest: 40, length: 27, shoulder: 20 },
    { size: 'S', chest: 42, length: 28, shoulder: 21 },
    { size: 'M', chest: 44, length: 29, shoulder: 22 },
    { size: 'L', chest: 46, length: 30, shoulder: 23 },
    { size: 'XL', chest: 48, length: 31, shoulder: 24 },
    { size: 'XXL', chest: 50, length: 32, shoulder: 25 },
  ],
  regular: [
    { size: 'XS', chest: 36, length: 26, shoulder: 16.5 },
    { size: 'S', chest: 38, length: 27, shoulder: 17 },
    { size: 'M', chest: 40, length: 28, shoulder: 18 },
    { size: 'L', chest: 42, length: 29, shoulder: 19 },
    { size: 'XL', chest: 44, length: 30, shoulder: 20 },
    { size: 'XXL', chest: 46, length: 31, shoulder: 21 },
  ],
  baby: [
    { size: 'XS', chest: 30, length: 18, shoulder: 13.5 },
    { size: 'S', chest: 32, length: 19, shoulder: 14 },
    { size: 'M', chest: 34, length: 20, shoulder: 14.5 },
    { size: 'L', chest: 36, length: 21, shoulder: 15 },
    { size: 'XL', chest: 38, length: 22, shoulder: 15.5 },
    { size: 'XXL', chest: 40, length: 23, shoulder: 16 },
  ],
  hoodie: [
    { size: 'XS', chest: 40, length: 26, shoulder: 18 },
    { size: 'S', chest: 42, length: 27, shoulder: 19 },
    { size: 'M', chest: 44, length: 28, shoulder: 20 },
    { size: 'L', chest: 46, length: 29, shoulder: 21 },
    { size: 'XL', chest: 48, length: 30, shoulder: 22 },
    { size: 'XXL', chest: 50, length: 31, shoulder: 23 },
  ],
}
