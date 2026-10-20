// Customer-side order + address reads — SERVER ONLY (cookies → inside <Suspense>, actions, route handlers).
// RLS does the scoping: "orders own read" / "addresses own read" (0006_checkout.sql). Owner: CHECKOUT.
//   const orders = await getMyOrders()        // newest first, [] when signed out / unconfigured
//   const addresses = await getMyAddresses()  // default first
import { cache } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/customer-server'
import { publicClient } from '@/lib/supabase/server'
import { addressFromRow, type Address } from './schema'
import { orderSnapshotFromRow, type OrderSnapshot } from './types'
import { parseCheckoutSettings, type CheckoutSettings } from './server'

export type MyOrder = OrderSnapshot

/** The signed-in customer's orders, newest first (max `limit`). Never throws. */
export const getMyOrders = cache(async (limit = 50): Promise<MyOrder[]> => {
  try {
    const auth = await getAuthUser()
    if (!auth) return []
    const { data, error } = await auth.sb
      .from('orders')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)))
    if (error || !Array.isArray(data)) return []
    return (data as Record<string, unknown>[]).map(orderSnapshotFromRow)
  } catch {
    return []
  }
})

/** One of the signed-in customer's orders (null when it isn't theirs / missing). */
export async function getMyOrder(id: string): Promise<MyOrder | null> {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    const auth = await getAuthUser()
    if (!auth) return null
    const { data } = await auth.sb.from('orders').select('*').eq('id', id).eq('user_id', auth.user.id).maybeSingle()
    return data ? orderSnapshotFromRow(data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The signed-in customer's saved addresses (default first, then newest). Never throws. */
export const getMyAddresses = cache(async (): Promise<Address[]> => {
  try {
    const auth = await getAuthUser()
    if (!auth) return []
    const { data, error } = await auth.sb
      .from('addresses')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    if (error || !Array.isArray(data)) return []
    return (data as Record<string, unknown>[]).map(addressFromRow)
  } catch {
    return []
  }
})

/** Admin → Vouchers "Checkout settings" (settings key 'checkout'). Cached; revalidated by updateTag('settings'). */
export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  'use cache'
  cacheLife('hours')
  cacheTag('settings')
  const sb = publicClient()
  if (!sb) return parseCheckoutSettings(null)
  try {
    const { data } = await sb.from('settings').select('value').eq('key', 'checkout').maybeSingle()
    return parseCheckoutSettings((data as { value?: unknown } | null)?.value)
  } catch {
    return parseCheckoutSettings(null)
  }
}
