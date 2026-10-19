// Admin server helpers (P4a + team roles). Server-only: reads cookies → call inside <Suspense>, Server Actions or Route Handlers.
//   const gate = await requireAdmin('leads.view')   // redirects to /admin/login when signed out / not on the team
//   if (!gate.allowed) return <NoAccess perm="leads.view" />
//   if (gate.demo) { …read seed… } else { const sb = await supabaseServer(); …RLS-gated reads… }
// Server Actions: const auth = await checkPerm('catalog.edit'); if (!auth.ok) return { ok: false, error: auth.error }
// Deletes:        const auth = await checkDelete()   // superadmin only (hierarchy rule)
import { redirect } from 'next/navigation'
import { getAdminSession, supabaseServer, type AdminSession } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { PERM_META, SUPERADMIN_DELETE_NOTE, can, canDelete, type Perm } from '@/lib/admin/permissions'

export interface AdminContext {
  /** Supabase not configured → demo mode (seed/sample data, writes disabled) */
  demo: boolean
  session: AdminSession | null
}

export interface AdminGate extends AdminContext {
  /** false when the member lacks the permission the page needs → render <NoAccess perm=… /> */
  allowed: boolean
}

/** Who is looking at the admin. Never throws. */
export async function getAdminContext(): Promise<AdminContext> {
  if (!isSupabaseConfigured()) return { demo: true, session: null }
  const session = await getAdminSession()
  return { demo: false, session }
}

/**
 * Guard for admin pages. Redirects to /admin/login when signed out / not on the team.
 * With `perm`, `allowed` says whether the member holds it (pages then render the designed No-access
 * state instead of their content). Demo mode always passes (there is nothing real to protect).
 */
export async function requireAdmin(perm?: Perm): Promise<AdminGate> {
  const ctx = await getAdminContext()
  if (ctx.demo) return { ...ctx, allowed: true }
  if (!ctx.session) redirect('/admin/login')
  if (!ctx.session.isAdmin) redirect('/admin/login?e=not-owner')
  return { ...ctx, allowed: !perm || can(ctx.session.perms, perm) }
}

export type PermCheck =
  | { ok: true; session: AdminSession }
  | { ok: false; demo: boolean; error: string }

/** For Server Actions: never redirects, never throws. Re-checks the session + permission server-side. */
export async function checkPerm(perm: Perm): Promise<PermCheck> {
  if (!isSupabaseConfigured()) return { ok: false, demo: true, error: 'Demo mode — connect Supabase to save changes.' }
  const session = await getAdminSession()
  if (!session) return { ok: false, demo: false, error: 'You are signed out. Sign in again.' }
  if (!session.isAdmin) return { ok: false, demo: false, error: 'This account is not on the team.' }
  if (!can(session.perms, perm)) {
    return { ok: false, demo: false, error: `Your role doesn’t include “${PERM_META[perm].label}”. Ask the superadmin.` }
  }
  return { ok: true, session }
}

/**
 * For every server-side delete path: only the superadmin may delete (hierarchy rule). Never throws.
 * RLS enforces the same rule (0003_superadmin_delete.sql); this returns a friendly message first.
 */
export async function checkDelete(): Promise<PermCheck> {
  if (!isSupabaseConfigured()) return { ok: false, demo: true, error: 'Demo mode — connect Supabase to delete for real.' }
  const session = await getAdminSession()
  if (!session) return { ok: false, demo: false, error: 'You are signed out. Sign in again.' }
  if (!session.isAdmin) return { ok: false, demo: false, error: 'This account is not on the team.' }
  if (!session.isSuperadmin || !canDelete(session) || !can(session.perms, 'delete')) {
    return { ok: false, demo: false, error: `${SUPERADMIN_DELETE_NOTE}. You can still edit it — or unpublish / hide it instead.` }
  }
  return { ok: true, session }
}

/** Cookie-bound Supabase client for a team member (RLS: has_perm()). null in demo mode. */
export async function adminDb() {
  const ctx = await requireAdmin()
  if (ctx.demo) return null
  return supabaseServer()
}
