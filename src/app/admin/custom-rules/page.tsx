// /admin/custom-rules — custom-order minimums & prices (custom_rules) + apparel extras (settings 'apparel_custom').
import type { Metadata } from 'next'
import { getCustomRules, mergeApparelCustom } from '@/lib/data/repo'
import type { ApparelCustomRules } from '@/lib/types'
import { readSettingFresh } from '@/components/admin/crud/settingsFresh'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { CustomRulesManager } from '@/components/admin/crud/RulesManagers'

export const metadata: Metadata = { title: 'Custom rules' }

export default async function CustomRulesPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  // apparel extras: fresh row (not the public 'use cache' copy) so a stale form can't overwrite a newer save
  const [rules, apparel] = await Promise.all([isSupabaseConfigured() ? [] : getCustomRules(), readSettingFresh<Partial<ApparelCustomRules>>('apparel_custom')])
  return <CustomRulesManager initial={rules} apparel={mergeApparelCustom(apparel.value)} />
}
