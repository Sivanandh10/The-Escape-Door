// /admin/careers (careers.edit) — job posts + applications (role dropdown, responses, CSV, live toasts).
// Live rows load in the browser under RLS (0007_careers.sql). No demo data: without Supabase the lists are empty.
// Owner: CAREERS.
import type { Metadata } from 'next'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { CareersManager } from '@/components/admin/careers/CareersManager'

export const metadata: Metadata = { title: 'Careers' }

export default async function CareersAdminPage() {
  const gate = await requireAdmin('careers.edit')
  if (!gate.allowed) return <NoAccess perm="careers.edit" session={gate.session} />
  return <CareersManager />
}
