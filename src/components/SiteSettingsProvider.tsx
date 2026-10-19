'use client'
// Admin-managed site settings the client needs at runtime (Admin → Settings, via repo getSettings()
// in the root layout): the WhatsApp order number used by every "Buy on WhatsApp" button, and the live
// bundle deals (Admin → Deals, repo getBundleRules()) the cart, product cards and bundle hints apply.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { BundleRule } from '@/lib/types'
import { bundleRules as seedRules } from '@/lib/data/rules'
import { whatsappNumber } from '@/lib/whatsapp'

export interface SiteSettingsValue {
  /** digits only ('' = not configured → wa.me/?text= lets the customer pick a contact) */
  whatsapp: string
  /** active bundle deals (Admin → Deals); seed rules until the layout passes them */
  bundleRules: BundleRule[]
}

const SiteSettingsContext = createContext<SiteSettingsValue>({ whatsapp: whatsappNumber(), bundleRules: seedRules })

export function SiteSettingsProvider({ whatsapp, bundleRules, children }: { whatsapp?: string; bundleRules?: BundleRule[]; children: ReactNode }) {
  const value = useMemo(() => ({ whatsapp: whatsappNumber(whatsapp), bundleRules: bundleRules ?? seedRules }), [whatsapp, bundleRules])
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export function useSiteSettings(): SiteSettingsValue {
  return useContext(SiteSettingsContext)
}

/** Shorthand: the number to pass as waLink(text, number). */
export function useWhatsappNumber(): string {
  return useContext(SiteSettingsContext).whatsapp
}

/** Live bundle deals (Admin → Deals) — pass to computeTotals(items, rules). */
export function useBundleRules(): BundleRule[] {
  return useContext(SiteSettingsContext).bundleRules
}
