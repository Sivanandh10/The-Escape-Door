// /admin/team — team members, roles and permissions (superadmin only: team.manage).
// Session reads sit inside <Suspense> (Cache Components). Writes go through server actions with the
// service role; the superadmin row is protected by a database trigger (supabase/migrations/0002_roles.sql).
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminPage } from '@/components/admin/AdminPage'
import { AdminSkeleton } from '@/components/admin/EmptyState'
import { NoAccess } from '@/components/admin/NoAccess'
import { requireAdmin } from '@/components/admin/server'
import { TeamManager } from '@/components/admin/team/TeamManager'
import { listMembers } from '@/components/admin/team/actions'
import type { TeamMember } from '@/components/admin/team/types'
import { effectivePerms } from '@/lib/admin/permissions'

export const metadata: Metadata = { title: 'Team' }

/** Demo mode only — clearly labelled sample rows, never real people. */
function sampleMembers(): TeamMember[] {
  const row = (m: Pick<TeamMember, 'userId' | 'email' | 'displayName' | 'role' | 'extras' | 'createdAt'> & { isProtected?: boolean }): TeamMember => ({
    ...m,
    perms: effectivePerms(m.role, m.extras),
    isProtected: m.isProtected ?? false,
    isSelf: m.isProtected ?? false,
    createdBy: null,
    lastSignInAt: null,
    sample: true,
  })
  return [
    row({ userId: 'demo-super', email: 'owner@example.com', displayName: 'Owner', role: 'superadmin', extras: [], createdAt: '2026-06-01T09:00:00Z', isProtected: true }),
    row({ userId: 'demo-sales', email: 'stall-crew@example.com', displayName: 'Stall crew', role: 'sales', extras: [], createdAt: '2026-09-12T10:30:00Z' }),
    row({ userId: 'demo-editor', email: 'catalogue@example.com', displayName: 'Catalogue helper', role: 'editor', extras: ['settings.edit'], createdAt: '2026-10-02T14:15:00Z' }),
  ]
}

async function TeamBody() {
  const gate = await requireAdmin('team.manage')
  if (!gate.allowed) return <NoAccess perm="team.manage" session={gate.session} />
  if (gate.demo) return <TeamManager demo initial={sampleMembers()} />
  if (gate.session?.legacy) return <TeamManager legacy initial={[]} />
  const res = await listMembers()
  return <TeamManager initial={res.ok ? res.data : []} initialError={res.ok ? null : res.error} />
}

function TeamLoading() {
  return (
    <AdminPage no="14" kicker="Team" title={<>The <em>crew</em></>} jp="チーム · 役割と権限" description="Opening the team list…">
      <div aria-busy="true" aria-label="Loading team">
        <AdminSkeleton rows={4} />
      </div>
      <AdminSkeleton variant="table" rows={6} />
    </AdminPage>
  )
}

export default function TeamPage() {
  return (
    <Suspense fallback={<TeamLoading />}>
      <TeamBody />
    </Suspense>
  )
}
