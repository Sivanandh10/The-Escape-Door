// /admin/collections (P4b) — arc doors CRUD. Live rows load in the browser under RLS.
import type { Metadata } from 'next'
import { getCollections } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { CollectionsManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Collections' }

export default async function CollectionsPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  const initial = isSupabaseConfigured() ? [] : (await getCollections()).map((c) => ({ ...c, published: true }))
  return <CollectionsManager initial={initial} />
}
