// /admin/instagram (P4b) — home Instagram strip CRUD. Live rows load in the browser under RLS.
import type { Metadata } from 'next'
import { getInstaPosts } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { InstagramManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Instagram' }

export default async function InstagramPage() {
  const initial = isSupabaseConfigured() ? [] : (await getInstaPosts()).map((p) => ({ ...p, published: true }))
  return <InstagramManager initial={initial} />
}
