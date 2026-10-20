// /admin/pricing — hoodie GSM tiers + tee fits (settings 'hoodie_tiers' / 'tee_fits'). Saves → updateTag('settings').
import type { Metadata } from 'next'
import { mergeHoodieTiers, mergeTeeFits } from '@/lib/data/repo'
import { readSettingFresh } from '@/components/admin/crud/settingsFresh'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { PricingManager } from '@/components/admin/crud/RulesManagers'

export const metadata: Metadata = { title: 'Pricing' }

export default async function PricingPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  // fresh rows (not the public 'use cache' copy) so the editor never starts from stale items
  const [tiers, fits] = await Promise.all([readSettingFresh('hoodie_tiers'), readSettingFresh('tee_fits')])
  return <PricingManager tiers={mergeHoodieTiers(tiers.value)} fits={mergeTeeFits(fits.value)} />
}
