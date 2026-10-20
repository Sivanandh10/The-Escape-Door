'use server'
// Admin → Customers Server Actions (owner: AUTH). Read-only: re-checks customers.view on the server, validates input.
import { z } from 'zod'
import { checkPerm } from '@/components/admin/server'
import { loadCustomerDetail, loadCustomers, type CustomerDetail, type CustomersData } from './data'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const Id = z.uuid()

export async function getCustomerDetail(userId: string): Promise<Result<CustomerDetail>> {
  const auth = await checkPerm('customers.view')
  if (!auth.ok) return { ok: false, error: auth.error }
  const id = Id.safeParse(userId)
  if (!id.success) return { ok: false, error: 'Unknown customer.' }
  try {
    return { ok: true, data: await loadCustomerDetail(id.data) }
  } catch {
    return { ok: false, error: 'Couldn’t load this customer. Try again.' }
  }
}

export async function reloadCustomers(): Promise<Result<CustomersData>> {
  const auth = await checkPerm('customers.view')
  if (!auth.ok) return { ok: false, error: auth.error }
  return { ok: true, data: await loadCustomers() }
}
