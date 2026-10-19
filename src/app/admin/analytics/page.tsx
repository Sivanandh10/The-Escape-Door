// /admin/analytics (P4a) — deeper tables + date range + per-src breakdown + integration slots.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/AdminPage'
import { AdminSkeleton } from '@/components/admin/EmptyState'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { getAnalytics } from '@/components/admin/analytics/data'
import { AnalyticsView } from '@/components/admin/analytics/AnalyticsView'
import { RangePicker } from '@/components/admin/analytics/RangePicker'
import { parseRange } from '@/components/admin/analytics/types'

export const metadata: Metadata = { title: 'Analytics' }

type SP = Promise<Record<string, string | string[] | undefined>>

async function Body({ searchParams }: { searchParams: SP }) {
  const gate = await requireAdmin('analytics.view')
  if (!gate.allowed) return <NoAccess perm="analytics.view" session={gate.session} inline />
  const days = parseRange((await searchParams).range)
  const s = await getAnalytics(days)
  return (
    <>
      <RangePicker basePath="/admin/analytics" current={days} from={s.from} to={s.to} />
      <AnalyticsView s={s} />
    </>
  )
}

export default function AnalyticsPage({ searchParams }: { searchParams: SP }) {
  return (
    <AdminPage
      no="02"
      title={<>Read the <em>signs</em></>}
      jp="分析"
      description="First-party, privacy-light numbers: anonymous visitor ids and city-level location only. Fest QR codes show up by their src."
    >
      <Suspense fallback={<><div className="skeleton-tone h-11 w-72" /><AdminSkeleton variant="cards" rows={6} /><AdminSkeleton rows={8} /></>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}
