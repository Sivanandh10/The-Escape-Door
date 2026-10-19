// /admin/instagram (P4b) — home Instagram strip CRUD. Live rows load in the browser under RLS.
import type { Metadata } from 'next'
import { getInstaPosts } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { InstagramManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Instagram' }

export default async function InstagramPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  const initial = isSupabaseConfigured() ? [] : (await getInstaPosts()).map((p) => ({ ...p, published: true }))
  return <InstagramManager initial={initial} />
}
