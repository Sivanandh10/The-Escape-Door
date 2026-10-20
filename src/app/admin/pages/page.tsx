// /admin/pages — Pages CMS (CMS + ADMIN-DATA): policy / info pages with a live markdown preview.
// Needs pages.edit (editor, admin, superadmin); delete / reset-to-built-in = superadmin only.
// Session reads stay inside <Suspense> (Cache Components).
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/AdminPage'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { loadAdminPages } from '@/components/admin/pages/data'
import { PagesManager } from '@/components/admin/pages/PagesManager'

export const metadata: Metadata = { title: 'Pages' }

async function Body() {
  const gate = await requireAdmin('pages.edit')
  if (!gate.allowed) return <NoAccess perm="pages.edit" session={gate.session} inline />
  const { rows, error } = await loadAdminPages(gate.demo)
  return <PagesManager initial={rows} loadError={error} demo={gate.demo} />
}

export default function PagesPage() {
  return (
    <AdminPage
      no="15"
      kicker="Site · Pages & policies"
      title={<>Pages &amp; <em>policies</em></>}
      jp="ページ · ポリシー"
      description="Privacy, shipping, returns and terms — edit the words here and the site updates the moment you publish. Write in simple markdown; the preview shows exactly how it will look."
    >
      <Suspense
        fallback={
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton-tone h-[112px]" />
              ))}
            </div>
            <div className="skeleton-tone h-[640px]" />
          </>
        }
      >
        <Body />
      </Suspense>
    </AdminPage>
  )
}
