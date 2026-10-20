// /admin/customers (owner: AUTH) — signed-in shoppers (team members excluded): signup, login provider, orders,
// spend, last seen, MyAnimeList; detail drawer + CSV export. Real data only (service role after the perm check).
import { connection } from 'next/server'
import type { Metadata } from 'next'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { CustomersManager } from '@/components/admin/customers/CustomersManager'
import { loadCustomers } from '@/components/admin/customers/data'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage() {
  await connection()
  const gate = await requireAdmin('customers.view')
  if (!gate.allowed) return <NoAccess perm="customers.view" session={gate.session} />
  if (gate.demo) return <CustomersManager initial={{ rows: [], loadedAt: new Date().toISOString(), notes: [], error: null }} demo />
  return <CustomersManager initial={await loadCustomers()} />
}
