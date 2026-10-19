// /admin/settings (P4b) — hero copy, banner, ticker, WhatsApp order number. Save → updateTag('settings') → live.
import type { Metadata } from 'next'
import { getSettings } from '@/lib/data/repo'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { SettingsManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const gate = await requireAdmin('settings.edit')
  if (!gate.allowed) return <NoAccess perm="settings.edit" session={gate.session} />
  return <SettingsManager initial={await getSettings()} />
}
