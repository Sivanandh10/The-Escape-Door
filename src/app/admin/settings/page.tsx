// /admin/settings (P4b) — hero copy, banner, ticker, WhatsApp order number. Save → updateTag('settings') → live.
import type { Metadata } from 'next'
import { mergeSiteSettings } from '@/lib/data/repo'
import type { SiteSettings } from '@/lib/types'
import { readSettingFresh } from '@/components/admin/crud/settingsFresh'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { SettingsManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const gate = await requireAdmin('settings.edit')
  if (!gate.allowed) return <NoAccess perm="settings.edit" session={gate.session} />
  // fresh row, never the 'use cache' copy: a stale form would save old hero text back over newer edits
  const row = await readSettingFresh<Partial<SiteSettings>>('site')
  return <SettingsManager initial={mergeSiteSettings(row.value)} updatedAt={row.updatedAt} />
}
