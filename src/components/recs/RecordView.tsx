'use client'
// Remembers a product page view (owner: AUTH). Always kept locally (merged into the account on login);
// sent to the server for signed-in shoppers (recent_views via record_product_view). Renders nothing.
import { useEffect } from 'react'
import { useCustomer } from '@/lib/auth/customer'
import { pushLocalView, sendView } from '@/lib/recs/local'

export function RecordView({ slug }: { slug: string }) {
  const { customer, loading } = useCustomer()
  const id = customer?.id
  useEffect(() => {
    if (loading) return
    if (id) sendView(slug)
    else pushLocalView(slug)
  }, [slug, id, loading])
  return null
}

export default RecordView
