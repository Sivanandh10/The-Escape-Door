// /admin/events (P4b) — stalls & fest partnerships CRUD. Live rows load in the browser under RLS.
import type { Metadata } from 'next'
import { getEvents, getPartnerships } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { EventsManager } from '@/components/admin/crud/CatalogManagers'

export const metadata: Metadata = { title: 'Events & Partners' }

export default async function EventsPage() {
  if (isSupabaseConfigured()) return <EventsManager events={[]} partners={[]} />
  const [events, partners] = await Promise.all([getEvents(), getPartnerships()])
  return (
    <EventsManager
      events={events.map((e, i) => ({ ...e, published: true, sortOrder: i + 1 }))}
      partners={partners.map((p) => ({ ...p, published: true }))}
    />
  )
}
