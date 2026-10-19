// /admin/custom-rules — custom-order minimums & prices (custom_rules) + apparel extras (settings 'apparel_custom').
import type { Metadata } from 'next'
import { getApparelCustom, getCustomRules } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { CustomRulesManager } from '@/components/admin/crud/RulesManagers'

export const metadata: Metadata = { title: 'Custom rules' }

export default async function CustomRulesPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  const [rules, apparel] = await Promise.all([isSupabaseConfigured() ? [] : getCustomRules(), getApparelCustom()])
  return <CustomRulesManager initial={rules} apparel={apparel} />
}
