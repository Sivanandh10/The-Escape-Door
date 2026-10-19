// /admin — Dashboard (P4a). Session + searchParams reads stay inside <Suspense> (Cache Components).
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/AdminPage'
import { AdminSkeleton } from '@/components/admin/EmptyState'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { getAnalytics } from '@/components/admin/analytics/data'
import { DashboardView } from '@/components/admin/analytics/DashboardView'
import { RangePicker } from '@/components/admin/analytics/RangePicker'
import { parseRange } from '@/components/admin/analytics/types'

export const metadata: Metadata = { title: 'Dashboard' }

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin('dashboard.view')
  if (!gate.allowed) return <NoAccess perm="dashboard.view" session={gate.session} inline />
  const days = parseRange((await searchParams).range)
  const s = await getAnalytics(days)
  return (
    <>
      <RangePicker basePath="/admin" current={days} from={s.from} to={s.to} />
      <DashboardView s={s} />
    </>
  )
}

export default function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <AdminPage
      no="01"
      title={<>Today at the <em>door</em></>}
      jp="ダッシュボード"
      description="Who walked in, what they opened, and how many reached WhatsApp. Revenue is an estimate from order messages — payment happens in chat."
    >
      <Suspense
        fallback={
          <>
            <div className="skeleton-tone h-11 w-72" />
            <AdminSkeleton variant="cards" rows={6} />
            <AdminSkeleton variant="chart" />
          </>
        }
      >
        <Body searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  )
}
