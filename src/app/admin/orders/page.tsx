// /admin/orders (P4b) — WhatsApp orders board. Live rows load in the browser under RLS; demo rows otherwise.
import { connection } from 'next/server'
import type { Metadata } from 'next'
import { getProducts } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { OrdersManager } from '@/components/admin/crud/OrdersManager'
import { demoLeads, demoOrders } from '@/components/admin/crud/demo'

export const metadata: Metadata = { title: 'Orders' }

export default async function OrdersPage() {
  await connection()
  const gate = await requireAdmin('orders.view')
  if (!gate.allowed) return <NoAccess perm="orders.view" session={gate.session} />
  if (isSupabaseConfigured()) return <OrdersManager initialOrders={[]} initialLeads={[]} />
  const leads = demoLeads(await getProducts())
  return <OrdersManager initialOrders={demoOrders(leads)} initialLeads={leads} />
}
