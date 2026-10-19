'use client'
// Admin mode context (P4a). AdminShell provides it; any admin client component reads it.
//   const { demo, email } = useAdmin()   // demo = Supabase not connected → read seed, disable writes
import { createContext, useContext, type ReactNode } from 'react'

export interface AdminContextValue {
  /** true when Supabase env is missing: show seed/sample data, disable writes with a friendly note */
  demo: boolean
  /** signed-in owner email (null in demo mode) */
  email: string | null
}

const AdminCtx = createContext<AdminContextValue>({ demo: true, email: null })

export function AdminProvider({ value, children }: { value: AdminContextValue; children: ReactNode }) {
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>
}

export function useAdmin(): AdminContextValue {
  return useContext(AdminCtx)
}

/** Copy for disabled write controls in demo mode (use as title/tooltip or inline note). */
export const DEMO_WRITE_NOTE = 'Demo mode — connect Supabase to save changes. Nothing you do here is stored.'
