// Team management types (shared by the 'use server' actions and the TeamManager client).
import type { GrantablePerm, Perm, Role } from '@/lib/admin/permissions'

export interface TeamMember {
  userId: string
  email: string | null
  displayName: string | null
  role: Role
  /** extra permissions on top of the role defaults */
  extras: GrantablePerm[]
  /** effective permissions (role defaults ∪ extras) */
  perms: Perm[]
  /** the superadmin row — can't be edited or removed (database trigger) */
  isProtected: boolean
  isSelf: boolean
  createdAt: string | null
  createdBy: string | null
  lastSignInAt: string | null
  /** demo-mode sample row (never real) */
  sample?: boolean
}

export type TeamErrorCode = 'demo' | 'forbidden' | 'protected' | 'self' | 'invalid' | 'exists' | 'not-found' | 'unconfigured' | 'server'

export type TeamResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TeamErrorCode; error: string; field?: string }

export interface CreatedMember {
  member: TeamMember
  /** temp password — shown ONCE to the creator; null when an existing login was reused */
  password: string | null
  reusedLogin: boolean
}

export interface MemberInput {
  email: string
  displayName?: string
  role: string
  extraPerms: string[]
  password?: string
}

export interface MemberPatch {
  role: string
  extraPerms: string[]
  displayName?: string
}
