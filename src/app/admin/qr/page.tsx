// /admin/qr — fest/stall QR studio. Session reads stay inside <Suspense> (Cache Components).
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/AdminPage'
import { AdminSkeleton } from '@/components/admin/EmptyState'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { getAnalytics, knownSrcs } from '@/components/admin/analytics/data'
import { QrStudio } from '@/components/admin/qr/QrStudio'
import { getCollections } from '@/lib/data/repo'
import { SITE_URL } from '@/lib/seo'

export const metadata: Metadata = { title: 'QR codes' }

async function Body() {
  const gate = await requireAdmin('qr.use')
  if (!gate.allowed) return <NoAccess perm="qr.use" session={gate.session} inline />
  const [srcs, snapshot, collections] = await Promise.all([knownSrcs(), getAnalytics(90), getCollections()])
  return (
    <QrStudio
      siteUrl={SITE_URL}
      srcs={srcs}
      arcs={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      rows={snapshot.srcs}
      demo={snapshot.demo}
      error={snapshot.error}
      range={{ from: snapshot.from, to: snapshot.to }}
    />
  )
}

export default function QrPage() {
  return (
    <AdminPage
      no="03"
      title={<>Print the <em>door</em></>}
      jp="QRコード"
      description="One QR per fest or stall. Every scan lands with its src tag, so the visits, leads and orders it brings show up below."
    >
      <Suspense
        fallback={
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              <div className="skeleton-tone h-[420px]" />
              <div className="skeleton-tone h-[520px]" />
            </div>
            <AdminSkeleton rows={6} />
          </>
        }
      >
        <Body />
      </Suspense>
    </AdminPage>
  )
}
