// Admin server helpers (P4a). Server-only: reads cookies → call inside <Suspense>, Server Actions or Route Handlers.
//   const ctx = await requireAdmin()            // redirects to /admin/login when signed out / not an owner
//   if (ctx.demo) { …read seed… } else { const sb = await supabaseServer(); …RLS-gated reads… }
import { redirect } from 'next/navigation'
import { getAdminSession, supabaseServer, type AdminSession } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export interface AdminContext {
  /** Supabase not configured → demo mode (seed/sample data, writes disabled) */
  demo: boolean
  session: AdminSession | null
}

/** Who is looking at the admin. Never throws. */
export async function getAdminContext(): Promise<AdminContext> {
  if (!isSupabaseConfigured()) return { demo: true, session: null }
  const session = await getAdminSession()
  return { demo: false, session }
}

/** Guard for admin pages / actions. In demo mode it passes (there is nothing real to protect). */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext()
  if (ctx.demo) return ctx
  if (!ctx.session) redirect('/admin/login')
  if (!ctx.session.isAdmin) redirect('/admin/login?e=not-owner')
  return ctx
}

/** Cookie-bound Supabase client for an owner (RLS: is_admin()). null in demo mode. */
export async function adminDb() {
  const ctx = await requireAdmin()
  if (ctx.demo) return null
  return supabaseServer()
}
