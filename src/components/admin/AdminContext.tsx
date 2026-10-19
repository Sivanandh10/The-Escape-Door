'use client'
// Admin mode context (P4a + team roles). AdminShell provides it; any admin client component reads it.
//   const { demo, email, role, perms } = useAdmin()   // demo = Supabase not connected → read seed, disable writes
//   const canEdit = useCan('leads.edit')               // read-only roles see edit controls disabled
//   const canDel = useCanDelete()                      // only the superadmin deletes (locked buttons otherwise)
import { createContext, useContext, type ReactNode } from 'react'
import { PERMS, SUPERADMIN_DELETE_NOTE, can, canDelete, type Perm, type Role } from '@/lib/admin/permissions'

export interface AdminContextValue {
  /** true when Supabase env is missing: show seed/sample data, disable writes with a friendly note */
  demo: boolean
  /** signed-in member email (null in demo mode) */
  email: string | null
  /** team role (null in demo mode) */
  role?: Role | null
  /** effective permissions; demo mode = everything (writes are blocked by demo anyway) */
  perms?: readonly Perm[]
  isSuperadmin?: boolean
}

const AdminCtx = createContext<AdminContextValue>({ demo: true, email: null, role: null, perms: PERMS, isSuperadmin: false })

export function AdminProvider({ value, children }: { value: AdminContextValue; children: ReactNode }) {
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>
}

export function useAdmin(): AdminContextValue {
  return useContext(AdminCtx)
}

/** Does the signed-in member hold `perm`? Always true in demo mode (writes are blocked there separately). */
export function useCan(perm: Perm): boolean {
  const { demo, perms } = useContext(AdminCtx)
  return demo || can(perms ?? [], perm)
}

/**
 * Hierarchy rule: only the superadmin deletes. True in demo mode (deletes are blocked / sandboxed there
 * separately) so the demo still shows the shredder. Server actions + RLS re-check it.
 */
export function useCanDelete(): boolean {
  const { demo, isSuperadmin, role, perms } = useContext(AdminCtx)
  return demo || (canDelete({ isSuperadmin, role }) && canDelete(perms ?? []))
}

/** Tooltip for locked delete buttons. */
export const DELETE_LOCK_NOTE = SUPERADMIN_DELETE_NOTE

/** Copy for disabled write controls in demo mode (use as title/tooltip or inline note). */
export const DEMO_WRITE_NOTE = 'Demo mode — connect Supabase to save changes. Nothing you do here is stored.'

/** Copy for write controls the member's role doesn't allow. */
export const READONLY_NOTE = 'View only — your role can’t change this. Ask the superadmin for edit access.'
