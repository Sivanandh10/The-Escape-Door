'use client'
// Admin-managed site settings the client needs at runtime (Admin → Settings, via repo getSettings()
// in the root layout). Today: the WhatsApp order number used by every "Buy on WhatsApp" button.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { whatsappNumber } from '@/lib/whatsapp'

export interface SiteSettingsValue {
  /** digits only ('' = not configured → wa.me/?text= lets the customer pick a contact) */
  whatsapp: string
}

const SiteSettingsContext = createContext<SiteSettingsValue>({ whatsapp: whatsappNumber() })

export function SiteSettingsProvider({ whatsapp, children }: { whatsapp?: string; children: ReactNode }) {
  const value = useMemo(() => ({ whatsapp: whatsappNumber(whatsapp) }), [whatsapp])
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export function useSiteSettings(): SiteSettingsValue {
  return useContext(SiteSettingsContext)
}

/** Shorthand: the number to pass as waLink(text, number). */
export function useWhatsappNumber(): string {
  return useContext(SiteSettingsContext).whatsapp
}
