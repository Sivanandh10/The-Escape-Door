// Shared types — CONTRACTS §3 (+ §10.6 updatedAt). Owner: F2.
// Pure type module: safe to import from client, server and Node scripts (`import type`).

export type ProductType =
  | 'tshirt' | 'hoodie' | 'polaroid' | 'bookmark' | 'poster' | 'badge' | 'sticker'
  | 'keychain' | 'cosplay' | 'katana' | 'figurine' | 'cape' | 'accessory' | 'hat' | 'tote' | 'stationery'

export type Motif = 'smoke' | 'walls' | 'flames' | 'waves' | 'spiral' | 'ribbons' | 'speedlines'

export interface Collection {
  slug: string
  name: string
  jp: string
  group: 'anime' | 'beyond'
  accentA: string
  accentB: string
  motif: Motif
  tagline: string
  blurb: string
  order: number
  featured: boolean
  subFandoms?: string[]
}

/** price null = range or on-request. A range is carried in attrs.range, e.g. '1200–2000'. */
export interface Variant { id: string; label: string; price: number | null; attrs?: Record<string, string> }

export interface ProductImage { src: string; alt: string; side?: 'front' | 'back' | 'detail'; sample?: boolean }

export interface Product {
  id: string
  slug: string
  name: string
  type: ProductType
  collection: string
  tags: string[]
  designTitle: string
  jpTitle?: string
  description: string
  images: ProductImage[]
  variants: Variant[]
  sizes?: string[]
  priceFrom: number | null
  priceOnRequest?: boolean
  bundleRuleId?: string
  customizable: boolean
  featured: boolean
  dropOfWeek: boolean
  stock: 'in' | 'low' | 'out' | 'made-to-order'
  colorBlock: string
  createdAt: string
  /** CONTRACTS §10.6 — sitemap lastModified */
  updatedAt: string
}

export interface BundleRule {
  id: string
  label: string
  appliesTo: { type: ProductType; variantAttr?: [string, string] }
  kind: 'nForPrice' | 'buyXgetY'
  n: number
  price?: number
  free?: number
}

export interface CustomRule { type: ProductType; minQty: number; unitPrice: number | null; note: string }

export interface CartItem {
  key: string
  productId: string
  slug: string
  name: string
  type: ProductType
  collection: string
  variantId: string
  variantLabel: string
  /** Optional (F2 addition): the variant's attrs, so bundle rules with `variantAttr` match exactly. */
  variantAttrs?: Record<string, string>
  size?: string
  unitPrice: number | null
  qty: number
  image: string
  custom?: CustomSpec
}

export interface CustomSpec {
  mode: 'own' | 'company'
  product: ProductType
  fileUrls: string[]
  zones: Array<{ zone: 'front' | 'back'; x: number; y: number; scale: number }>
  halfHalf: boolean
  notes?: string
  quantity: number
}

export interface CartTotals {
  lines: Array<CartItem & { lineTotal: number | null; saving: number }>
  subtotal: number
  savings: number
  total: number
  hasPriceOnRequest: boolean
  applied: Array<{ ruleId: string; label: string; saving: number }>
  hints: string[]
}

export interface FestEvent {
  id: string
  name: string
  venue: string
  city: string
  startDate: string | null
  endDate: string | null
  /** e.g. "21–28 Feb · dates to be confirmed" — never an invented year (§10.6) */
  dateLabel: string
  confirmed: boolean
  kind: 'stall' | 'popup' | 'fest' | 'online'
  status: 'upcoming' | 'past'
}

export interface Partnership { id: string; fest: string; institution: string; years: string; role: string; detail?: string; order: number }

export type LeadKind = 'whatsapp_order' | 'custom_request' | 'remind_me' | 'newsletter' | 'exit_intent'

export interface LeadInput {
  kind: LeadKind
  name?: string
  city?: string
  contact?: string
  message?: string
  payload?: unknown
  source?: Attribution
}

export interface Attribution {
  src?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer?: string
  landing?: string
}

export interface SiteSettings {
  heroKicker: string
  heroTitle: string
  heroSub: string
  bannerText: string
  tickerWords: string[]
  whatsapp: string
  instagram: string
}

export interface InstaPost { id: string; image: string; url: string; caption: string; order: number }

// ---------- F2 additions (data used by S07 / Forge / shop) ----------

/** Hoodie GSM "power levels" (S07). Original level names — no franchise ranks. */
export interface HoodieTier {
  id: string
  level: number
  /** e.g. "LV.1" */
  code: string
  name: string
  gsmMin: number
  gsmMax: number
  /** display string, e.g. "280–330 GSM" */
  gsmLabel: string
  price: number
  feel: string
}

export interface TeeFit { id: 'oversized' | 'regular' | 'baby'; label: string; price: number; blurb: string }

/** Custom-apparel extras from the notebook (Forge). */
export interface ApparelCustomRules {
  companyDesignFee: number
  halfHalfFee: number
  zones: { front: { w: number; h: number; unit: 'in' }; back: { w: number; h: number; unit: 'in' } }
  note: string
}

export interface ProductFilter {
  collection?: string
  type?: ProductType | ProductType[]
  q?: string
  min?: number
  max?: number
  featured?: boolean
}

export interface CustomQuote {
  type: ProductType
  quantity: number
  minQty: number
  meetsMinimum: boolean
  /** garment / piece price; null when it depends on the cloth or is unknown */
  unitPrice: number | null
  extras: Array<{ label: string; amount: number; per: 'piece' | 'order' }>
  /** null when any part is price-on-request */
  total: number | null
  /** true when the owner confirms the final number on WhatsApp */
  estimate: boolean
  notes: string[]
}
