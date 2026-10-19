'use server'
// Team management Server Actions (superadmin only: team.manage). Every action re-checks the session
// server-side, validates with zod, and writes with the service role (public.admins has NO browser write
// policies). They refuse to touch the protected superadmin row or the caller's own row, refuse to grant
// role 'superadmin' or permission 'team.manage', and turn the database trigger errors into plain words.
import { randomInt } from 'node:crypto'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPerm } from '@/components/admin/server'
import {
  ASSIGNABLE_ROLES, GRANTABLE_PERMS, effectivePerms, isRole, normalizeExtras, type GrantablePerm, type Role,
} from '@/lib/admin/permissions'
import type { CreatedMember, MemberInput, MemberPatch, TeamErrorCode, TeamMember, TeamResult } from './types'

// ---------------------------------------------------------------- validation
const RoleInput = z.enum(ASSIGNABLE_ROLES, { error: 'Pick admin, editor, sales or viewer.' })
const Extras = z.array(z.enum(GRANTABLE_PERMS, { error: 'Unknown permission.' })).max(GRANTABLE_PERMS.length)
const DisplayName = z.string().trim().max(80, { error: 'Keep the name under 80 characters.' }).optional()
const UserId = z.uuid({ error: 'Unknown member.' })

const CreateInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: 'That doesn’t look like an email.' }).max(200)),
  displayName: DisplayName,
  role: RoleInput,
  extraPerms: Extras,
  password: z
    .string()
    .max(72, { error: 'Passwords stop at 72 characters.' })
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined))
    .pipe(z.string().min(10, { error: 'Use at least 10 characters (or leave it empty to auto-generate).' }).optional()),
})

const PatchInput = z.object({ role: RoleInput, extraPerms: Extras, displayName: DisplayName })

// ---------------------------------------------------------------- helpers
type Fail = Extract<TeamResult<never>, { ok: false }>
const fail = (code: TeamErrorCode, error: string, field?: string): Fail => ({ ok: false, code, error, ...(field ? { field } : {}) })

function zodFail(e: z.ZodError): Fail {
  const i = e.issues[0]
  return fail('invalid', i?.message ?? 'Check the form.', i?.path.map(String).join('.') || undefined)
}

/** Turn Postgres / trigger / auth errors into owner-friendly copy. */
function dbFail(e: { message?: string; hint?: string | null; code?: string } | null | undefined, fallback = 'The database said no.'): Fail {
  const msg = e?.message ?? ''
  if (e?.hint === 'protected_admin' || /is protected/i.test(msg)) {
    return fail('protected', 'That’s the protected superadmin — the database won’t let anyone edit or remove it.')
  }
  if (e?.hint === 'superadmin_exists' || /already a superadmin/i.test(msg)) {
    return fail('forbidden', 'There is already a superadmin. Nobody else can be made superadmin.')
  }
  if (e?.code === '23505') return fail('exists', 'That person is already on the team.')
  if (e?.code === '42703') return fail('unconfigured', 'Run supabase/migrations/0002_roles.sql in Supabase first (team columns are missing).')
  return fail('server', msg ? `${fallback} (${msg})` : fallback)
}

/** Strong, readable temp password: Door-XXXX-XXXX-XXXX-## (no look-alike characters). */
function tempPassword(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const chunk = () => Array.from({ length: 4 }, () => A[randomInt(A.length)]).join('')
  return `Door-${chunk()}-${chunk()}-${chunk()}-${randomInt(10, 100)}`
}

interface AdminRow {
  user_id: string
  email: string | null
  display_name: string | null
  role: string | null
  permissions: string[] | null
  is_protected: boolean | null
  created_at: string | null
  created_by: string | null
}
const COLS = 'user_id, email, display_name, role, permissions, is_protected, created_at, created_by'

function toMember(r: AdminRow, selfId: string, lastSignInAt: string | null = null): TeamMember {
  const role: Role = isRole(r.role) ? r.role : 'viewer'
  const extras = normalizeExtras(role, r.permissions ?? [])
  return {
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role,
    extras,
    perms: effectivePerms(role, extras),
    isProtected: r.is_protected === true,
    isSelf: r.user_id === selfId,
    createdAt: r.created_at,
    createdBy: r.created_by,
    lastSignInAt,
  }
}

type Ctx = { sa: SupabaseClient; selfId: string }

/** team.manage + service role, or a failure to return as-is. */
async function gate(): Promise<{ ok: true; ctx: Ctx } | Fail> {
  const auth = await checkPerm('team.manage')
  if (!auth.ok) return fail(auth.demo ? 'demo' : 'forbidden', auth.demo ? 'Demo mode — connect Supabase to manage the team.' : auth.error)
  if (!auth.session.isSuperadmin) return fail('forbidden', 'Only the superadmin can manage the team.')
  const sa = supabaseAdmin()
  if (!sa) return fail('unconfigured', 'The server is missing SUPABASE_SERVICE_ROLE_KEY, so team changes can’t be saved.')
  return { ok: true, ctx: { sa, selfId: auth.session.userId } }
}

/** Load one row and refuse protected / own rows. */
async function editableRow(ctx: Ctx, userId: string, what: string): Promise<{ ok: true; row: AdminRow } | Fail> {
  if (userId === ctx.selfId) return fail('self', `You can’t ${what} your own account.`)
  const { data, error } = await ctx.sa.from('admins').select(COLS).eq('user_id', userId).maybeSingle()
  if (error) return dbFail(error, 'Couldn’t load that member.')
  if (!data) return fail('not-found', 'That member isn’t on the team any more. Refresh the list.')
  const row = data as AdminRow
  if (row.is_protected || row.role === 'superadmin') {
    return fail('protected', 'That’s the protected superadmin — it can’t be edited or removed.')
  }
  return { ok: true, row }
}

async function lastSignIns(sa: SupabaseClient): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  try {
    const { data } = await sa.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) out.set(u.id, u.last_sign_in_at ?? null)
  } catch {
    /* optional detail */
  }
  return out
}

async function findAuthUserId(sa: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sa.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return null
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit.id
    if (data.users.length < 1000) return null
  }
  return null
}

// ---------------------------------------------------------------- actions
export async function listMembers(): Promise<TeamResult<TeamMember[]>> {
  try {
    const g = await gate()
    if (!g.ok) return g
    const { sa, selfId } = g.ctx
    const [{ data, error }, signIns] = await Promise.all([
      sa.from('admins').select(COLS).order('created_at', { ascending: true }),
      lastSignIns(sa),
    ])
    if (error) return dbFail(error, 'Couldn’t load the team.')
    const rows = (data ?? []) as AdminRow[]
    const members = rows.map((r) => toMember(r, selfId, signIns.get(r.user_id) ?? null))
    // superadmin first, then by date added
    members.sort((a, b) => Number(b.isProtected) - Number(a.isProtected))
    return { ok: true, data: members }
  } catch (e) {
    return fail('server', e instanceof Error ? e.message : 'Couldn’t load the team.')
  }
}

export async function createMember(input: MemberInput): Promise<TeamResult<CreatedMember>> {
  try {
    const g = await gate()
    if (!g.ok) return g
    const { sa, selfId } = g.ctx
    const parsed = CreateInput.safeParse(input)
    if (!parsed.success) return zodFail(parsed.error)
    const { email, displayName, role, extraPerms, password } = parsed.data

    // already on the team? (also catches the superadmin's own email)
    const { data: existing, error: exErr } = await sa.from('admins').select('user_id, is_protected').eq('email', email).maybeSingle()
    if (exErr && exErr.code !== 'PGRST116') return dbFail(exErr, 'Couldn’t check the team list.')
    if (existing) {
      return (existing as { is_protected?: boolean }).is_protected
        ? fail('protected', 'That’s the protected superadmin — already on the team.', 'email')
        : fail('exists', 'That email is already on the team. Edit them instead.', 'email')
    }

    // 1) the login (auth user): create, or reuse an existing one
    let userId: string | null = null
    let reusedLogin = false
    let issued: string | null = null
    const pw = password ?? tempPassword()
    const created = await sa.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    })
    if (created.error) {
      // 422 is also used for a rejected password (weak_password) — report that on the password field
      if (created.error.code === 'weak_password') {
        return fail('invalid', created.error.message || 'That password is too weak for the project’s password rules.', 'password')
      }
      const exists =
        created.error.code === 'email_exists' ||
        created.error.code === 'user_already_exists' ||
        /already (been )?registered/i.test(created.error.message)
      if (!exists) return fail('server', `Couldn’t create the login (${created.error.message}).`)
      userId = await findAuthUserId(sa, email)
      if (!userId) return fail('server', 'A login with that email exists but couldn’t be found. Try again.')
      reusedLogin = true
    } else {
      userId = created.data.user?.id ?? null
      issued = pw
    }
    if (!userId) return fail('server', 'Supabase didn’t return the new login.')

    // already a row for that auth user under another email?
    const { data: byId } = await sa.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
    if (byId) return fail('exists', 'That login is already on the team.', 'email')

    // 2) the team row
    const extras = normalizeExtras(role, extraPerms)
    const { data: row, error } = await sa
      .from('admins')
      .insert({ user_id: userId, email, display_name: displayName || null, role, permissions: extras, is_protected: false, created_by: selfId })
      .select(COLS)
      .single()
    if (error) {
      if (!reusedLogin) await sa.auth.admin.deleteUser(userId).catch(() => null) // roll back the fresh login
      return dbFail(error, 'Couldn’t add them to the team.')
    }
    return { ok: true, data: { member: toMember(row as AdminRow, selfId), password: issued, reusedLogin } }
  } catch (e) {
    return fail('server', e instanceof Error ? e.message : 'Couldn’t add the member.')
  }
}

export async function updateMember(userId: string, patch: MemberPatch): Promise<TeamResult<TeamMember>> {
  try {
    const g = await gate()
    if (!g.ok) return g
    const id = UserId.safeParse(userId)
    if (!id.success) return zodFail(id.error)
    const parsed = PatchInput.safeParse(patch)
    if (!parsed.success) return zodFail(parsed.error)
    const cur = await editableRow(g.ctx, id.data, 'change the role of')
    if (!cur.ok) return cur

    const { role, extraPerms, displayName } = parsed.data
    const extras: GrantablePerm[] = normalizeExtras(role, extraPerms)
    const { data, error } = await g.ctx.sa
      .from('admins')
      .update({ role, permissions: extras, display_name: displayName ? displayName : null })
      .eq('user_id', id.data)
      .eq('is_protected', false)
      .select(COLS)
      .maybeSingle()
    if (error) return dbFail(error, 'Couldn’t save the changes.')
    if (!data) return fail('not-found', 'That member changed or left meanwhile. Refresh the list.')
    return { ok: true, data: toMember(data as AdminRow, g.ctx.selfId) }
  } catch (e) {
    return fail('server', e instanceof Error ? e.message : 'Couldn’t save the changes.')
  }
}

export async function removeMember(userId: string, opts?: { deleteLogin?: boolean }): Promise<TeamResult<{ userId: string; loginDeleted: boolean }>> {
  try {
    const g = await gate()
    if (!g.ok) return g
    const id = UserId.safeParse(userId)
    if (!id.success) return zodFail(id.error)
    const cur = await editableRow(g.ctx, id.data, 'remove')
    if (!cur.ok) return cur

    const { error } = await g.ctx.sa.from('admins').delete().eq('user_id', id.data).eq('is_protected', false)
    if (error) return dbFail(error, 'Couldn’t remove them.')

    let loginDeleted = false
    if (opts?.deleteLogin === true) {
      const del = await g.ctx.sa.auth.admin.deleteUser(id.data)
      loginDeleted = !del.error
    }
    return { ok: true, data: { userId: id.data, loginDeleted } }
  } catch (e) {
    return fail('server', e instanceof Error ? e.message : 'Couldn’t remove them.')
  }
}

export async function resetPassword(userId: string): Promise<TeamResult<{ password: string }>> {
  try {
    const g = await gate()
    if (!g.ok) return g
    const id = UserId.safeParse(userId)
    if (!id.success) return zodFail(id.error)
    const cur = await editableRow(g.ctx, id.data, 'reset the password of')
    if (!cur.ok) return cur

    const password = tempPassword()
    const { error } = await g.ctx.sa.auth.admin.updateUserById(id.data, { password })
    if (error) return fail('server', `Couldn’t reset the password (${error.message}).`)
    return { ok: true, data: { password } }
  } catch (e) {
    return fail('server', e instanceof Error ? e.message : 'Couldn’t reset the password.')
  }
}
