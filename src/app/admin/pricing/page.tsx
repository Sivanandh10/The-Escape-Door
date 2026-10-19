// /admin/pricing — hoodie GSM tiers + tee fits (settings 'hoodie_tiers' / 'tee_fits'). Saves → updateTag('settings').
import type { Metadata } from 'next'
import { getHoodieTiers, getTeeFits } from '@/lib/data/repo'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { PricingManager } from '@/components/admin/crud/RulesManagers'

export const metadata: Metadata = { title: 'Pricing' }

export default async function PricingPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  const [tiers, fits] = await Promise.all([getHoodieTiers(), getTeeFits()])
  return <PricingManager tiers={tiers} fits={fits} />
}
