// /admin/collections (P4b) — arc doors CRUD. Live rows load in the browser under RLS.
import type { Metadata } from 'next'
import { getCollections } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { CollectionsManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Collections' }

export default async function CollectionsPage() {
  const initial = isSupabaseConfigured() ? [] : (await getCollections()).map((c) => ({ ...c, published: true }))
  return <CollectionsManager initial={initial} />
}
