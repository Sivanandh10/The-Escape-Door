// Lab preview for the Custom Forge studio (noindex, dev QA). Owner: P3 forge.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ForgeStudio } from '@/components/forge/ForgeStudio'
import { StudioSkeleton } from '@/components/forge/StudioSkeleton'
import { ZoneDiagram } from '@/components/forge/ZoneDiagram'
import type { ForgeData } from '@/components/forge/model'
import { getCustomRules, getHoodieTiers, getTeeFits } from '@/lib/data/repo'
import { apparelCustom } from '@/lib/data/rules'

export const metadata: Metadata = { title: 'Lab · Forge', robots: { index: false, follow: false } }

export default async function ForgeLab() {
  const [rules, fits, tiers] = await Promise.all([getCustomRules(), getTeeFits(), getHoodieTiers()])
  const data: ForgeData = { fits, tiers, rules, apparel: apparelCustom }
  return (
    <div className="container-x py-10">
      <p className="label text-volt">Lab · P3 Forge</p>
      <div className="mt-6">
        <Suspense fallback={<StudioSkeleton />}>
          <ForgeStudio data={data} />
        </Suspense>
      </div>
      <div className="mt-16">
        <p className="label mb-3">Loading state</p>
        <StudioSkeleton />
      </div>
      <div className="mt-16">
        <ZoneDiagram zones={apparelCustom.zones} />
      </div>
    </div>
  )
}
