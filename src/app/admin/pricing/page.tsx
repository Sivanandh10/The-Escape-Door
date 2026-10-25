// /admin/pricing — hoodie GSM tiers + tee fits (settings 'hoodie_tiers' / 'tee_fits') and the product-page size charts
// (settings 'size_charts', nothing seeded). Saves → updateTag('settings').
import type { Metadata } from 'next'
import { mergeHoodieTiers, mergeTeeFits } from '@/lib/data/repo'
import { readSettingFresh } from '@/components/admin/crud/settingsFresh'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { PricingManager } from '@/components/admin/crud/RulesManagers'
import { SizeChartManager } from '@/components/admin/crud/SizeChartManager'
import { normalizeSizeCharts } from '@/components/shop/sizeChartData'

export const metadata: Metadata = { title: 'Pricing' }

export default async function PricingPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  // fresh rows (not the public 'use cache' copy) so the editor never starts from stale items
  const [tiers, fits, charts] = await Promise.all([readSettingFresh('hoodie_tiers'), readSettingFresh('tee_fits'), readSettingFresh('size_charts')])
  return (
    <>
      <PricingManager tiers={mergeHoodieTiers(tiers.value)} fits={mergeTeeFits(fits.value)} />
      <div className="mt-6 lg:mt-8">
        <SizeChartManager initial={normalizeSizeCharts(charts.value)} initialUpdatedAt={charts.updatedAt} />
      </div>
    </>
  )
}
