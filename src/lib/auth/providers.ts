'use client'
// Which customer login methods work right now (GET /api/auth/providers). One shared request per page load.
// `null` = still checking. Owner: INTEGRATOR (AUTH area).
import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export interface AuthProviders {
  google: boolean
  mal: boolean
  email: boolean
  /** at least one works → the login gate is on */
  any: boolean
}

const NONE: AuthProviders = { google: false, mal: false, email: false, any: false }
let shared: Promise<AuthProviders> | null = null
let settled: AuthProviders | null = null

export function loadAuthProviders(): Promise<AuthProviders> {
  if (settled) return Promise.resolve(settled)
  if (!isSupabaseConfigured()) return Promise.resolve((settled = NONE))
  shared ??= fetch('/api/auth/providers')
    .then((r) => (r.ok ? (r.json() as Promise<AuthProviders>) : NONE))
    .catch(() => NONE)
    .then((p) => {
      const v = { google: !!p.google, mal: !!p.mal, email: !!p.email, any: !!p.any }
      settled = v
      return v
    })
  return shared
}

/** Last known value without waiting (null until the first answer). */
export const peekAuthProviders = () => settled

export function useAuthProviders(): AuthProviders | null {
  const [p, setP] = useState<AuthProviders | null>(settled)
  useEffect(() => {
    let alive = true
    if (!settled) void loadAuthProviders().then((v) => alive && setP(v))
    return () => {
      alive = false
    }
  }, [])
  return p
}
