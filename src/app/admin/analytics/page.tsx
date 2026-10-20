// /admin/analytics (P4a; live refresh: CMS + ADMIN-DATA) — deeper tables + date range + per-src breakdown + integration slots.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/AdminPage'
import { AdminSkeleton } from '@/components/admin/EmptyState'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { getAnalytics } from '@/components/admin/analytics/data'
import { AnalyticsView } from '@/components/admin/analytics/AnalyticsView'
import { RangePicker } from '@/components/admin/analytics/RangePicker'
import { LiveRefresh } from '@/components/admin/analytics/LiveRefresh'
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePicker basePath="/admin/analytics" current={days} from={s.from} to={s.to} />
        <LiveRefresh generatedAt={s.generatedAt} demo={s.demo} />
      </div>
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
      <Suspense fallback={<><div className="flex flex-wrap justify-between gap-3"><div className="skeleton-tone h-11 w-72" /><div className="skeleton-tone h-11 w-56" /></div><AdminSkeleton variant="cards" rows={6} /><AdminSkeleton rows={8} /></>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}
