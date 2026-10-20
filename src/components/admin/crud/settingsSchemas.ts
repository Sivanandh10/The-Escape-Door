// Settings-stored admin lists (public.settings key/value rows) — pure, client + server safe.
//   hoodie_tiers  HoodieTier[]          catalog.edit   (S07 power levels, /custom, /fests)
//   tee_fits      TeeFit[]              catalog.edit   (S05, /custom, /fests)
//   apparel_custom ApparelCustomRules   catalog.edit   (/custom, S05, S09)
//   qr_links      QrLink[]              qr.use         (/admin/qr saved links)
//   site          SiteSettings          settings.edit  (hero copy, banner, ticker, WhatsApp, Instagram — every page)
// Writes go through saveSettingValue() (settingsActions.ts): permission re-check, zod, and — for lists —
// removing an existing item counts as a delete, so it needs the superadmin (checkDelete).
import { z } from 'zod'
import type { Perm } from '@/lib/admin/permissions'
import { apparelCustom, hoodieTiers, teeFits } from '@/lib/data/rules'

export interface QrLink {
  id: string
  /** attribution tag (?src=) */
  src: string
  label: string
  /** landing path, e.g. "/" or "/arc/jujutsu-kaisen" */
  path: string
  createdAt: string
}

const slugId = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-with-dashes').max(60)
const rupees = z.number({ error: 'Enter a price' }).int('Whole rupees').min(0).max(1_000_000)
const uniqueIds = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id)).size === list.length

export const hoodieTierSchema = z
  .object({
    id: slugId,
    level: z.number({ error: 'Level number' }).int().min(1).max(99),
    code: z.string().trim().min(1, 'e.g. LV.1').max(12),
    name: z.string().trim().min(2, 'Name the tier').max(40),
    gsmMin: z.number({ error: 'GSM from' }).int().min(50).max(2000),
    gsmMax: z.number({ error: 'GSM to' }).int().min(50).max(2000),
    gsmLabel: z.string().trim().min(2, 'Shown on the site, e.g. 280–330 GSM').max(40),
    price: rupees,
    feel: z.string().trim().max(300),
  })
  .refine((t) => t.gsmMax >= t.gsmMin, { message: 'GSM “to” must be ≥ “from”', path: ['gsmMax'] })

export const teeFitSchema = z.object({
  id: slugId,
  label: z.string().trim().min(2, 'Name the fit').max(40),
  price: rupees,
  blurb: z.string().trim().max(200),
})

const zone = z.object({
  w: z.number({ error: 'Width' }).positive('Width > 0').max(60),
  h: z.number({ error: 'Height' }).positive('Height > 0').max(60),
  unit: z.literal('in'),
})
export const apparelCustomSchema = z.object({
  companyDesignFee: rupees,
  halfHalfFee: rupees,
  zones: z.object({ front: zone, back: zone }),
  note: z.string().trim().max(600),
})

export const qrLinkSchema = z.object({
  id: z.string().min(1).max(60),
  src: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-with-dashes').max(40),
  label: z.string().trim().max(80),
  path: z.string().regex(/^\/[a-z0-9\-/]*$/, 'A site path, e.g. / or /arc/naruto').max(120),
  createdAt: z.string().max(40),
})

/** Admin → Settings ('site'): hero copy, banner, ticker words, WhatsApp order number, Instagram link. */
export const siteSettingsSchema = z.object({
  heroKicker: z.string().trim().min(2, 'A short kicker line').max(60),
  heroTitle: z.string().trim().min(4, 'The H1 needs words').max(90),
  heroSub: z.string().trim().max(260),
  bannerText: z.string().trim().max(120),
  tickerWords: z.array(z.string().trim().min(1).max(40)).min(3, 'At least 3 words keep the ticker moving').max(24),
  whatsapp: z.string().trim().regex(/^(\+?\d[\d\s-]{8,16})?$/, 'Digits with country code, e.g. +91 98…'),
  instagram: z.string().trim().regex(/^(https:\/\/(www\.)?instagram\.com\/.+)?$/, 'An instagram.com link'),
})

export const SETTING_KEYS = {
  hoodie_tiers: {
    perm: 'catalog.edit' as Perm,
    list: true,
    schema: z.array(hoodieTierSchema).max(20).refine(uniqueIds, 'Two tiers share an id'),
    fallback: hoodieTiers as unknown,
  },
  tee_fits: {
    perm: 'catalog.edit' as Perm,
    list: true,
    schema: z.array(teeFitSchema).max(12).refine(uniqueIds, 'Two fits share an id'),
    fallback: teeFits as unknown,
  },
  apparel_custom: {
    perm: 'catalog.edit' as Perm,
    list: false,
    schema: apparelCustomSchema,
    fallback: apparelCustom as unknown,
  },
  qr_links: {
    perm: 'qr.use' as Perm,
    list: true,
    schema: z.array(qrLinkSchema).max(300).refine(uniqueIds, 'Two links share an id'),
    fallback: [] as unknown,
  },
  site: {
    perm: 'settings.edit' as Perm,
    list: false,
    schema: siteSettingsSchema,
    fallback: null as unknown,
  },
} as const

export type SettingKey = keyof typeof SETTING_KEYS
export type SettingListKey = { [K in SettingKey]: (typeof SETTING_KEYS)[K]['list'] extends true ? K : never }[SettingKey]

export function isSettingKey(k: unknown): k is SettingKey {
  return typeof k === 'string' && Object.prototype.hasOwnProperty.call(SETTING_KEYS, k)
}
