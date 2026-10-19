// Pricing rules — exact maths from docs/source/NOTEBOOK_TRANSCRIPTION.md. Owner: F2.
// Kept separate from seed.ts (and free of runtime imports) so client code (pricing/cart)
// pulls in only these few rules, never the whole catalogue.
import type { ApparelCustomRules, BundleRule, CustomRule, HoodieTier, TeeFit } from '../types'

export const bundleRules: BundleRule[] = [
  // Polaroid — ₹50 / piece · ₹100 / 3 pieces
  { id: 'polaroid-3for100', label: '3 polaroids for ₹100', appliesTo: { type: 'polaroid' }, kind: 'nForPrice', n: 3, price: 100 },
  // Poster — ₹200 / pc · ₹1000 / 6 pcs → "Buy 5 get 1 free"
  { id: 'poster-buy5get1', label: 'Posters: buy 5, get 1 free', appliesTo: { type: 'poster' }, kind: 'buyXgetY', n: 5, free: 1 },
  // Bookmark plain — ₹30 / pc · ₹100 / 4 pcs
  { id: 'bookmark-plain-4for100', label: '4 plain bookmarks for ₹100', appliesTo: { type: 'bookmark', variantAttr: ['kind', 'plain'] }, kind: 'nForPrice', n: 4, price: 100 },
  // Bookmark magnetic — ₹100 / pc · ₹150 / 2 pcs
  { id: 'bookmark-magnetic-2for150', label: '2 magnetic bookmarks for ₹150', appliesTo: { type: 'bookmark', variantAttr: ['kind', 'magnetic'] }, kind: 'nForPrice', n: 2, price: 150 },
  // Badges — ₹50 / pc · ₹200 / 5 pcs
  { id: 'badge-5for200', label: '5 badges for ₹200', appliesTo: { type: 'badge' }, kind: 'nForPrice', n: 5, price: 200 },
]

export const customRules: CustomRule[] = [
  { type: 'polaroid', minQty: 20, unitPrice: 50, note: 'Same or different designs. 20 × ₹50 = ₹1000. The 3-for-₹100 deal is for ready-made prints (owner to confirm for custom).' },
  { type: 'bookmark', minQty: 14, unitPrice: 100, note: '14 × ₹100 = ₹1400. Owner to confirm whether this is for plain or magnetic bookmarks.' },
  { type: 'sticker', minQty: 15, unitPrice: 30, note: 'Minimum 15. The notebook also shows "25 × 15" — the per-piece custom price (₹30 or ₹25) is to be confirmed.' },
  { type: 'badge', minQty: 350, unitPrice: 12, note: 'Read as 350 badges at ₹12 each, different designs allowed. It could also read "₹350 for 12" — owner to confirm before this is shown as a fixed price.' },
  { type: 'tshirt', minQty: 1, unitPrice: null, note: 'Garment price by fit (oversized ₹800 · regular ₹600 · baby tee ₹400) plus print; the final price depends on the cloth.' },
  { type: 'hoodie', minQty: 1, unitPrice: null, note: 'Garment price by GSM (₹1200–2500) plus print; the final price depends on the cloth.' },
]

export const apparelCustom: ApparelCustomRules = {
  companyDesignFee: 200,
  halfHalfFee: 200,
  zones: { front: { w: 4, h: 4, unit: 'in' }, back: { w: 12, h: 15, unit: 'in' } },
  note: '"Depends on cloth price." Whether the ₹200 design fee is per piece or per order is to be confirmed — quotes treat it as once per order and are confirmed on WhatsApp.',
}

/** Hoodie GSM tiers (S07 "power levels"). Level names are original, not franchise ranks. */
export const hoodieTiers: HoodieTier[] = [
  { id: 'gsm-280-330', level: 1, code: 'LV.1', name: 'Everyday', gsmMin: 280, gsmMax: 330, gsmLabel: '280–330 GSM', price: 1200, feel: 'The lightest tier. Easy over a tee for lectures, travel and air-conditioned rooms.' },
  { id: 'gsm-330-380', level: 2, code: 'LV.2', name: 'Street', gsmMin: 330, gsmMax: 380, gsmLabel: '330–380 GSM', price: 1500, feel: 'Midweight. More body and structure, still easy to layer.' },
  { id: 'gsm-380-430', level: 3, code: 'LV.3', name: 'Heavyweight', gsmMin: 380, gsmMax: 430, gsmLabel: '380–430 GSM', price: 1800, feel: 'Dense fabric that holds its shape. Built for cold evenings.' },
  { id: 'gsm-430-600', level: 4, code: 'LV.4', name: 'Final Form', gsmMin: 430, gsmMax: 600, gsmLabel: '430–600 GSM', price: 2500, feel: 'The heaviest tier we make. Thick, warm and stiff in the drape.' },
]

export const teeFits: TeeFit[] = [
  { id: 'oversized', label: 'Oversized', price: 800, blurb: 'Drop shoulder, boxy body. The fit our back prints are drawn for.' },
  { id: 'regular', label: 'Regular', price: 600, blurb: 'Classic everyday fit.' },
  { id: 'baby', label: 'Baby tee', price: 400, blurb: 'Short, fitted silhouette.' },
]
