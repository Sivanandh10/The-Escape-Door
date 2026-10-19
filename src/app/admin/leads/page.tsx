// /admin/leads (P4b) — pipeline board + list, detail drawer, CSV export. Live rows load in the browser under RLS.
import type { Metadata } from 'next'
import { getProducts } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { LeadsManager } from '@/components/admin/crud/LeadsManager'
import { demoLeads } from '@/components/admin/crud/demo'

export const metadata: Metadata = { title: 'Leads' }

export default async function LeadsPage() {
  const initial = isSupabaseConfigured() ? [] : demoLeads(await getProducts())
  return <LeadsManager initial={initial} />
}
