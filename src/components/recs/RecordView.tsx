'use client'
// Remembers a product page view (owner: AUTH). Always kept locally (merged into the account on login);
// sent to the server for signed-in shoppers (recent_views via record_product_view). Renders nothing.
// RECS: every view (signed in or not) also lands in the timestamped signal store used by /api/recs.
import { useEffect } from 'react'
import { useCustomer } from '@/lib/auth/customer'
import { pushLocalView, sendView } from '@/lib/recs/local'
import { pushSignalView } from '@/lib/recs/signals'

export function RecordView({ slug }: { slug: string }) {
  const { customer, loading } = useCustomer()
  const id = customer?.id
  useEffect(() => {
    if (loading) return
    pushSignalView(slug) // timestamped view for the recommendation engine (this device only)
    if (id) sendView(slug)
    else pushLocalView(slug)
  }, [slug, id, loading])
  return null
}

export default RecordView
