// /admin/settings (P4b) — hero copy, banner, ticker, WhatsApp order number. Save → updateTag('settings') → live.
import type { Metadata } from 'next'
import { getSettings } from '@/lib/data/repo'
import { SettingsManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  return <SettingsManager initial={await getSettings()} />
}
