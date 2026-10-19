'use client'
// Team & roles (/admin/team) — superadmin only. Members table, "Add member" and "Edit" door drawers,
// grouped permission picker (role defaults shown checked + locked), temp passwords shown ONCE with a
// copy button (signature: the key "cuts" in character by character), reset password, remove with a
// confirm step. Every write goes through ./actions (server, service role, re-checked); the protected
// superadmin row has no edit / remove controls at all and the database refuses changes to it anyway.
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  Check, Copy, KeyRound, Link2, Lock, Pencil, RefreshCw, ShieldAlert, ShieldCheck, Trash2, UserPlus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion'
import {
  ASSIGNABLE_BY_RANK, GRANTABLE_PERMS, PERMS, PERM_GROUPS, PERM_META, ROLES_BY_RANK, ROLE_DEFAULTS, ROLE_META,
  effectivePerms, roleRank,
  type AssignableRole, type GrantablePerm, type Role,
} from '@/lib/admin/permissions'
import { AdminPage, AdminPanel } from '../AdminPage'
import { DEMO_WRITE_NOTE } from '../AdminContext'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { adminBtn, adminInput, adminLabel, adminPill } from '../ui'
import { Drawer, SelectField, TextField, Toggle } from '../crud/kit'
import { fmtDate } from '../crud/util'
import { createMember, listMembers, removeMember, resetPassword, updateMember } from './actions'
import type { TeamMember } from './types'

type DrawerState = { kind: 'add' } | { kind: 'edit'; id: string } | null
interface Issued { email: string; password: string | null; reusedLogin?: boolean; reason: 'created' | 'reset' }

const LOGIN_PATH = '/admin/login'

export interface TeamManagerProps {
  initial: TeamMember[]
  initialError?: string | null
  /** Supabase unconfigured → sample rows, read-only */
  demo?: boolean
  /** 0002_roles.sql not applied yet */
  legacy?: boolean
}

export function TeamManager({ initial, initialError = null, demo = false, legacy = false }: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [reloading, startReload] = useTransition()
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const locked = demo || legacy
  const editing = drawer?.kind === 'edit' ? members.find((m) => m.userId === drawer.id) ?? null : null

  const reload = () =>
    startReload(async () => {
      const r = await listMembers()
      if (r.ok) {
        setMembers(r.data)
        setError(null)
      } else setError(r.error)
    })

  const upsertLocal = (m: TeamMember) =>
    setMembers((ms) => (ms.some((x) => x.userId === m.userId) ? ms.map((x) => (x.userId === m.userId ? m : x)) : [...ms, m]))

  const columns: DataTableColumn<TeamMember>[] = [
    {
      id: 'name', header: 'Member', sortValue: (m) => (m.displayName || m.email || '').toLowerCase(),
      cell: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar m={m} />
          <span className="min-w-0 leading-tight">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold">{m.displayName || (m.email ?? '').split('@')[0] || 'Member'}</span>
              {m.isSelf && <span className={adminPill('paper')}>You</span>}
              {m.sample && <span className={adminPill('muted')}>Sample</span>}
            </span>
            <span className="block truncate font-mono text-[11.5px] text-paper/50 md:hidden">{m.email}</span>
          </span>
        </span>
      ),
    },
    { id: 'email', header: 'Email', hideOnMobile: true, sortValue: (m) => m.email ?? '', cell: (m) => <span className="block truncate font-mono text-[12.5px] text-paper/75">{m.email ?? '—'}</span> },
    { id: 'role', header: 'Role', sortValue: (m) => roleRank(m.role), cell: (m) => <RoleChip role={m.role} protectedRow={m.isProtected} /> },
    {
      id: 'perms', header: 'Access', sortValue: (m) => m.perms.length,
      cell: (m) => (
        <span className="block leading-tight" title={m.perms.map((p) => PERM_META[p].label).join(' · ')}>
          <span className="font-mono text-[13px] font-bold tabular-nums">{m.perms.length}<span className="text-paper/40">/{PERMS.length}</span></span>
          <span className="ml-1.5 text-[12px] text-paper/55">rooms</span>
          {m.extras.length > 0 && <span className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-volt">+{m.extras.length} extra</span>}
        </span>
      ),
    },
    {
      id: 'added', header: 'Added', hideOnMobile: true, sortValue: (m) => m.createdAt ?? '',
      cell: (m) => (
        <span className="block leading-tight">
          <span className="font-mono text-[12px] text-paper/70">{m.createdAt ? fmtDate(m.createdAt) : '—'}</span>
          <span className="block font-mono text-[10.5px] text-paper/40">{m.lastSignInAt ? `last in ${fmtDate(m.lastSignInAt)}` : 'never signed in'}</span>
        </span>
      ),
    },
  ]

  return (
    <AdminPage
      no="11"
      kicker={`Team · ${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      title={<>The <em>crew</em></>}
      jp="チーム · 役割と権限"
      description="Give each person their own login with only the rooms they need. The superadmin is locked at the database level — nobody can edit or remove it, not even with the service key."
      actions={
        <button
          type="button"
          onClick={() => setDrawer({ kind: 'add' })}
          disabled={locked}
          title={demo ? DEMO_WRITE_NOTE : legacy ? 'Apply supabase/migrations/0002_roles.sql first' : undefined}
          className={adminBtn()}
        >
          <UserPlus aria-hidden className="size-4" /> Add member
        </button>
      }
    >
      {demo && (
        <Notice tone="volt" icon={<ShieldAlert aria-hidden className="size-5" />} title="Demo mode — read only">
          Supabase isn’t connected, so these are sample rows and nothing can be added or changed. Once the keys are set and{' '}
          <code className="font-mono text-[12px] font-bold">0002_roles.sql</code> is applied, the superadmin manages real members here.
        </Notice>
      )}
      {legacy && !demo && (
        <Notice tone="hype" icon={<ShieldAlert aria-hidden className="size-5" />} title="One step left: apply the roles migration">
          The database doesn’t have the team columns yet. Run <code className="font-mono text-[12px] font-bold">supabase/migrations/0002_roles.sql</code>{' '}
          in the Supabase SQL editor, then reload. Until then you keep full owner access.
        </Notice>
      )}

      {error && !legacy ? (
        <ErrorState title="Couldn’t open the team list" message={error} onRetry={reload} retrying={reloading} />
      ) : (
        <DataTable
          caption="Team members"
          rows={members}
          columns={columns}
          rowKey={(m) => m.userId}
          selectedKey={drawer?.kind === 'edit' ? drawer.id : null}
          onRowClick={(m) => {
            if (locked || m.isProtected || m.isSelf) return
            setDrawer({ kind: 'edit', id: m.userId })
          }}
          search={{ placeholder: 'Search name or email…', text: (m) => `${m.displayName ?? ''} ${m.email ?? ''} ${m.role}` }}
          pageSize={0}
          toolbar={
            !demo && (
              <button type="button" onClick={reload} disabled={reloading} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10' })}>
                <RefreshCw aria-hidden className={cn('size-3.5', reloading && 'animate-spin')} /> {reloading ? 'Refreshing…' : 'Refresh'}
              </button>
            )
          }
          rowActions={(m) =>
            m.isProtected ? (
              <span className="inline-flex items-center gap-1.5 border-2 border-volt/60 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-volt" title="Locked in the database: can’t be edited or removed">
                <Lock aria-hidden className="size-3.5" /> Protected — can’t be edited or removed
              </span>
            ) : m.isSelf || locked ? null : (
              <button type="button" onClick={() => setDrawer({ kind: 'edit', id: m.userId })} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10' })} aria-label={`Edit ${m.displayName || m.email}`}>
                <Pencil aria-hidden className="size-3.5" /> Edit
              </button>
            )
          }
          empty={<EmptyState title="Nobody here yet" body="Add the first team member — they get their own login and only the rooms you pick." />}
        />
      )}

      {!error && !demo && !legacy && members.length <= 1 && (
        <EmptyState
          compact
          mood="wave"
          sfx="ひとり…"
          title="Just you behind the door"
          body="Add a helper for the stall, someone to run the inbox, or a friend who keeps the catalogue fresh. Each gets their own login."
          action={<button type="button" onClick={() => setDrawer({ kind: 'add' })} className={adminBtn()}><UserPlus aria-hidden className="size-4" /> Add member</button>}
        />
      )}

      <Hierarchy />
      <RoleTable />

      <AddMemberDrawer
        open={drawer?.kind === 'add'}
        onClose={() => setDrawer(null)}
        onCreated={upsertLocal}
      />
      <EditMemberDrawer
        member={editing}
        onClose={() => setDrawer(null)}
        onSaved={upsertLocal}
        onRemoved={(id) => {
          setMembers((ms) => ms.filter((m) => m.userId !== id))
          setDrawer(null)
        }}
      />
    </AdminPage>
  )
}

// ---------------------------------------------------------------- bits
const ROLE_TONE: Record<string, string> = {
  volt: 'border-ink bg-volt text-ink',
  door: 'border-ink bg-door text-paper',
  lav: 'border-ink bg-lav text-ink',
  pink: 'border-ink bg-pink text-ink',
  muted: 'border-paper/25 bg-tone-2 text-paper/80',
}

/** Rank badge: Lv 5 (superadmin) … Lv 1 (viewer). */
function RankBadge({ role, className }: { role: Role; className?: string }) {
  const rank = roleRank(role)
  return (
    <span
      className={cn('inline-grid h-[18px] min-w-[30px] place-items-center bg-ink px-1 font-mono text-[9.5px] font-bold leading-none tracking-[0.08em] text-paper', className)}
      title={`Rank ${rank} of 5`}
    >
      <span aria-hidden>LV{rank}</span>
      <span className="sr-only">Rank {rank} of 5</span>
    </span>
  )
}

function RoleChip({ role, protectedRow }: { role: Role; protectedRow?: boolean }) {
  const meta = ROLE_META[role]
  return (
    <span className={cn('inline-flex items-center gap-1.5 border-2 py-0.5 pl-0.5 pr-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em]', ROLE_TONE[meta.tone])} title={`${meta.label} — ${meta.summary}`}>
      <RankBadge role={role} />
      {(role === 'superadmin' || protectedRow) && <Lock aria-hidden className="size-3" />}
      {meta.label}
    </span>
  )
}

/** Chain of command — a staircase, highest rank on the left / top. */
function Hierarchy() {
  return (
    <AdminPanel index={1} title={<>Chain of <em className="accent">command</em></>} jp="序列" bodyClassName="p-4 sm:p-5">
      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" aria-label="Role hierarchy, highest first">
        {ROLES_BY_RANK.map((r, i) => {
          const meta = ROLE_META[r]
          const deletes = ROLE_DEFAULTS[r].includes('delete')
          return (
            <li
              key={r}
              className="admin-rise flex flex-col border-2 border-ink bg-[#121218] shadow-[4px_4px_0_var(--color-ink)]"
              style={{ ['--d' as string]: `${80 + i * 60}ms` }}
            >
              {/* step height grows with rank on wide screens: the staircase */}
              <span aria-hidden className={cn('hidden border-b-2 border-ink lg:block', ROLE_TONE[meta.tone])} style={{ height: `${8 + meta.rank * 10}px` }} />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <span className="flex items-center justify-between gap-2">
                  <RoleChip role={r} />
                  <span lang="ja" className="font-jp text-[11px] font-bold text-paper/45">{meta.jp}</span>
                </span>
                <p className="text-[12.5px] leading-snug text-paper/70">{meta.summary}</p>
                <p className={cn('mt-auto inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]', deletes ? 'text-hype' : 'text-paper/35')}>
                  {deletes ? <Trash2 aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
                  {deletes ? 'Can delete' : 'No delete'}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 border-t-2 border-paper/10 pt-3 text-[12.5px] leading-relaxed text-paper/55">
        <strong className="text-paper/80">Legend:</strong> LV5 is the top. Each role sees the same or less than the one above it.
        Admins create and edit everything; only the superadmin can delete (rows, product images, uploaded files) or manage the team —
        the database enforces this too. Prefer <em>Hidden</em> / <em>Spam</em> / <em>Cancelled</em> over deleting.
      </p>
    </AdminPanel>
  )
}

function Avatar({ m }: { m: TeamMember }) {
  const meta = ROLE_META[m.role]
  const letter = (m.displayName || m.email || '?').trim().charAt(0).toUpperCase()
  return (
    <span aria-hidden className={cn('relative grid size-10 shrink-0 place-items-center border-2 font-display text-[20px] shadow-[3px_3px_0_var(--color-ink)]', ROLE_TONE[meta.tone])}>
      {letter}
      {m.isProtected && (
        <span className="absolute -bottom-1.5 -right-1.5 grid size-5 place-items-center border-2 border-ink bg-paper text-ink">
          <Lock className="size-3" />
        </span>
      )}
    </span>
  )
}

function Notice({ tone, icon, title, children }: { tone: 'volt' | 'hype'; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div role="status" className={cn('admin-rise flex gap-3 border-2 px-4 py-3.5 sm:px-5', tone === 'volt' ? 'border-volt bg-volt/10' : 'border-hype bg-hype/10')}>
      <span className={cn('mt-0.5 shrink-0', tone === 'volt' ? 'text-volt' : 'text-hype')}>{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-[20px] uppercase leading-none">{title}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-paper/75">{children}</p>
      </div>
    </div>
  )
}

/** Who can open what — every role against every permission. */
function RoleTable() {
  return (
    <AdminPanel index={2} title={<>Who opens <em className="accent">what</em></>} jp="役割 × 権限" bodyClassName="p-0">
      <div className="overflow-x-auto" data-lenis-prevent="">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <caption className="sr-only">Role defaults</caption>
          <thead>
            <tr className="border-b-2 border-paper/10">
              <th scope="col" className="label px-4 py-3 text-paper/50 sm:px-5">Permission</th>
              {ROLES_BY_RANK.map((r) => (
                <th key={r} scope="col" className="px-2 py-3 text-center">
                  <RoleChip role={r} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p} className="border-b border-paper/5 last:border-0">
                <th scope="row" className="px-4 py-2 font-normal sm:px-5">
                  <span className="block font-semibold text-paper/90">{PERM_META[p].label}</span>
                  <span className="block text-[11.5px] text-paper/45">{PERM_META[p].description}</span>
                </th>
                {ROLES_BY_RANK.map((r) => {
                  const on = ROLE_DEFAULTS[r].includes(p)
                  return (
                    <td key={r} className="px-2 py-2 text-center">
                      {on ? (
                        <Check aria-label="yes" className="mx-auto size-4 text-volt" />
                      ) : (
                        <span aria-label="no" className="font-mono text-paper/20">·</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t-2 border-paper/10 px-4 py-3 text-[12.5px] text-paper/55 sm:px-5">
        Extras can be ticked per person on top of a role. “Manage team” and “Delete” stay with the superadmin only, and edit rights include view rights.
      </p>
    </AdminPanel>
  )
}

/** Grouped checkboxes. Role defaults (and view rights implied by edit rights) are checked and locked. */
function PermPicker({ role, extras, onChange, disabled }: { role: Role; extras: GrantablePerm[]; onChange: (v: GrantablePerm[]) => void; disabled?: boolean }) {
  const defaults = ROLE_DEFAULTS[role]
  const effective = effectivePerms(role, extras)
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-paper/60">
        Effective access: <strong className="font-mono text-volt">{effective.length}/{PERMS.length}</strong> rooms. Ticks in grey come with the role.
      </p>
      {PERM_GROUPS.map((group) => {
        const perms = GRANTABLE_PERMS.filter((p) => PERM_META[p].group === group)
        return (
          <fieldset key={group} className="border-2 border-paper/12 px-3 pb-2 pt-1">
            <legend className="label px-1.5 text-paper/55">{group}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {perms.map((p) => {
                const fromRole = defaults.includes(p)
                const implied = !fromRole && ((p === 'leads.view' && extras.includes('leads.edit')) || (p === 'orders.view' && extras.includes('orders.edit')))
                const locked = fromRole || implied
                const checked = locked || extras.includes(p)
                return (
                  <label
                    key={p}
                    className={cn(
                      'group flex min-h-11 items-start gap-3 px-2 py-2 transition-colors duration-150',
                      locked || disabled ? 'cursor-not-allowed' : 'cursor-pointer can-hover:hover:bg-paper/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      disabled={locked || disabled}
                      onChange={(e) => onChange(e.target.checked ? [...extras, p] : extras.filter((x) => x !== p))}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center border-2 transition-[background-color,transform] duration-150 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-door',
                        checked ? (locked ? 'border-paper/30 bg-paper/25 text-ink' : 'scale-105 border-ink bg-volt text-ink') : 'border-paper/35',
                      )}
                    >
                      {checked && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-paper">
                        {PERM_META[p].label}
                        {fromRole && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper/40">role</span>}
                        {implied && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper/40">with edit</span>}
                      </span>
                      <span className="block text-[12px] leading-snug text-paper/50">{PERM_META[p].description}</span>
                    </span>
                  </label>
                )
              })}
              {group === 'Site' && (['team.manage', 'delete'] as const).map((p) => (
                <span key={p} className="flex min-h-11 items-start gap-3 px-2 py-2 opacity-60">
                  <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-paper/25 text-paper/60">
                    <Lock className="size-3" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold">{PERM_META[p].label}</span>
                    <span className="block text-[12px] leading-snug text-paper/50">Superadmin only — can’t be granted.</span>
                  </span>
                </span>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

function RoleSelect({ value, onChange, disabled }: { value: AssignableRole; onChange: (r: AssignableRole) => void; disabled?: boolean }) {
  return (
    <div>
      <SelectField
        label="Role"
        value={value}
        onChange={(v) => !disabled && onChange(v)}
        options={ASSIGNABLE_BY_RANK.map((r) => ({ id: r, label: `LV${ROLE_META[r].rank} · ${ROLE_META[r].label} — ${ROLE_META[r].jp}` }))}
      />
      <p className="mt-1.5 text-[12.5px] leading-snug text-paper/55">{ROLE_META[value].description}</p>
      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper/40">Ranked below the superadmin · deleting stays superadmin-only</p>
    </div>
  )
}

// ---------------------------------------------------------------- copy + key card (signature: the key cuts in)
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text)
        if (ok) {
          setDone(true)
          toast.success(`${label} copied`)
          window.setTimeout(() => setDone(false), 1600)
        } else toast.error('Couldn’t copy — select it and copy by hand')
      }}
      className={cn(adminBtn({ variant: done ? 'door' : 'primary', size: 'sm', className: 'min-h-10 min-w-[104px]' }), className)}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={done ? 'done' : 'copy'}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-1.5"
        >
          {done ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
          {done ? 'Copied' : `Copy`}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

function KeyCard({ issued }: { issued: Issued }) {
  const reduced = useReducedMotion()
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}${LOGIN_PATH}` : LOGIN_PATH
  const share = issued.password
    ? `You're on The Escape Door admin team.\nSign in: ${loginUrl}\nEmail: ${issued.email}\nTemporary password: ${issued.password}\nKeep it private.`
    : `You're on The Escape Door admin team.\nSign in: ${loginUrl}\nEmail: ${issued.email}\nUse your existing password.`
  return (
    <motion.section
      aria-label="Login details"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, rotate: -1.5 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0 }}
      transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 26 }}
      className="relative border-4 border-ink bg-paper p-5 text-ink shadow-[8px_8px_0_var(--color-volt)]"
    >
      <span aria-hidden lang="ja" className="absolute -right-3 -top-4 rotate-[8deg] font-sfx-jp text-[26px] text-door [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke_fill]">
        カチッ
      </span>
      <p className="flex items-center gap-2 font-display text-[28px] uppercase leading-none">
        <KeyRound aria-hidden className="size-6 text-door" />
        {issued.reason === 'reset' ? 'New key cut' : issued.password ? 'Key cut!' : 'Door unlocked'}
      </p>
      <p className="mt-2 text-[14px] text-ink/70">
        {issued.password
          ? <>Share these with <strong>{issued.email}</strong>. The password is shown <strong>once</strong> — it isn’t stored anywhere you can open again.</>
          : <><strong>{issued.email}</strong> already had a login, so their existing password works. Use “Reset password” if they need a new one.</>}
      </p>

      {issued.password && (
        <div className="mt-4">
          <p className="label mb-1.5 text-ink/55">Temporary password</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex min-h-11 flex-1 items-center overflow-x-auto border-2 border-ink bg-ink px-3 font-mono text-[17px] font-bold tracking-[0.06em] text-volt" data-lenis-prevent="">
              {reduced
                ? issued.password
                : issued.password.split('').map((ch, i) => (
                    <motion.span
                      key={i}
                      initial={{ y: -10, opacity: 0, rotateX: 90 }}
                      animate={{ y: 0, opacity: 1, rotateX: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 24, delay: 0.12 + i * 0.022 }}
                      className="inline-block"
                    >
                      {ch}
                    </motion.span>
                  ))}
            </code>
            <CopyButton text={issued.password} label="Password" />
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="label mb-1.5 text-ink/55">Login page</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2 border-2 border-ink bg-ink/5 px-3 font-mono text-[13px]">
            <Link2 aria-hidden className="size-4 shrink-0 text-door" />
            <span className="truncate">{loginUrl}</span>
          </span>
          <CopyButton text={loginUrl} label="Login link" />
        </div>
      </div>

      <div className="mt-4 border-t-2 border-ink/15 pt-4">
        <CopyButton text={share} label="Invite message" className="w-full" />
        <p className="mt-1.5 text-center text-[12px] text-ink/55">Copies link + email{issued.password ? ' + password' : ''} as one message for WhatsApp.</p>
      </div>
    </motion.section>
  )
}

// ---------------------------------------------------------------- add drawer
function AddMemberDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (m: TeamMember) => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<AssignableRole>('sales')
  const [extras, setExtras] = useState<GrantablePerm[]>([])
  const [auto, setAuto] = useState(true)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [pending, start] = useTransition()

  const reset = () => {
    setEmail(''); setDisplayName(''); setRole('sales'); setExtras([]); setAuto(true); setPassword('')
    setErrors({}); setFormError(null); setIssued(null)
  }
  const close = () => {
    onClose()
    // let the door swing shut before clearing (so the key card doesn't flash empty)
    window.setTimeout(reset, 260)
  }

  const submit = () => {
    const local: Record<string, string> = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) local.email = 'That doesn’t look like an email.'
    if (!auto && password.length < 10) local.password = 'Use at least 10 characters, or switch auto-generate back on.'
    setErrors(local)
    if (Object.keys(local).length) return
    setFormError(null)
    start(async () => {
      const r = await createMember({ email, displayName, role, extraPerms: extras, password: auto ? undefined : password })
      if (!r.ok) {
        if (r.field) setErrors({ [r.field === 'extraPerms' ? 'perms' : r.field]: r.error })
        else setFormError(r.error)
        toast.error('Member not added', { description: r.error })
        return
      }
      onCreated(r.data.member)
      setIssued({ email: r.data.member.email ?? email, password: r.data.password, reusedLogin: r.data.reusedLogin, reason: 'created' })
      toast.success(`${r.data.member.displayName || r.data.member.email} joined the team`, { description: `${ROLE_META[r.data.member.role].label} · ${r.data.member.perms.length} rooms` })
    })
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={issued ? 'Share the key' : 'Add member'}
      jp={issued ? '鍵の受け渡し' : '新しい仲間'}
      footer={
        issued ? (
          <>
            <button type="button" onClick={close} className={adminBtn()}>Done</button>
            <button type="button" onClick={reset} className={adminBtn({ variant: 'ghost' })}><UserPlus aria-hidden className="size-4" /> Add another</button>
          </>
        ) : (
          <>
            <button type="button" onClick={submit} disabled={pending} className={adminBtn()}>
              {pending ? <span className="inline-block size-3.5 animate-spin border-2 border-ink border-t-transparent" aria-hidden /> : <UserPlus aria-hidden className="size-4" />}
              {pending ? 'Cutting a key…' : 'Add to team'}
            </button>
            <button type="button" onClick={close} className={adminBtn({ variant: 'ghost' })}>Cancel</button>
          </>
        )
      }
    >
      {issued ? (
        <KeyCard issued={issued} />
      ) : (
        <div className="space-y-6">
          {formError && (
            <p role="alert" className="border-l-4 border-hype bg-hype/10 px-3 py-2 text-[13.5px]">{formError}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Email" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="helper@gmail.com" className="sm:col-span-2" />
            <TextField label="Display name" value={displayName} onChange={setDisplayName} error={errors.displayName} placeholder="Riya (stall crew)" maxLength={80} className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <RoleSelect value={role} onChange={setRole} />
            </div>
          </div>
          <section>
            <p className={adminLabel}>Extra permissions</p>
            <PermPicker role={role} extras={extras} onChange={setExtras} />
            {errors.perms && <p role="alert" className="mt-1.5 text-[12.5px] text-hype">{errors.perms}</p>}
          </section>
          <section className="space-y-3">
            <p className={adminLabel}>Password</p>
            <Toggle checked={auto} onChange={setAuto} label="Auto-generate a strong temp password" hint="You’ll see it once, with a copy button, to share with them." />
            {!auto && (
              <div>
                <label htmlFor="team-pw" className="sr-only">Password</label>
                <input
                  id="team-pw"
                  type="text"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  placeholder="At least 10 characters"
                  className={cn(adminInput, 'font-mono text-[14px]')}
                />
                {errors.password && <p role="alert" className="mt-1.5 text-[12.5px] text-hype">{errors.password}</p>}
              </div>
            )}
            <p className="text-[12.5px] text-paper/50">If this email already has a login, it’s reused and their password stays the same.</p>
          </section>
        </div>
      )}
    </Drawer>
  )
}

// ---------------------------------------------------------------- edit drawer
function EditMemberDrawer({
  member, onClose, onSaved, onRemoved,
}: { member: TeamMember | null; onClose: () => void; onSaved: (m: TeamMember) => void; onRemoved: (id: string) => void }) {
  // Remount the form per member so state starts from that member's values.
  return (
    <Drawer open={!!member} onClose={onClose} title={member ? member.displayName || member.email || 'Member' : 'Member'} jp={member ? `${ROLE_META[member.role].label} · ${ROLE_META[member.role].jp}` : undefined} footer={null}>
      {member && <EditForm key={member.userId} member={member} onClose={onClose} onSaved={onSaved} onRemoved={onRemoved} />}
    </Drawer>
  )
}

function EditForm({ member, onClose, onSaved, onRemoved }: { member: TeamMember; onClose: () => void; onSaved: (m: TeamMember) => void; onRemoved: (id: string) => void }) {
  const startRole: AssignableRole = member.role === 'superadmin' ? 'admin' : member.role
  const [role, setRole] = useState<AssignableRole>(startRole)
  const [extras, setExtras] = useState<GrantablePerm[]>(member.extras)
  const [displayName, setDisplayName] = useState(member.displayName ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [resetting, startReset] = useTransition()
  const [removing, startRemove] = useTransition()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [deleteLogin, setDeleteLogin] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const reduced = useReducedMotion()

  const dirty = useMemo(
    () => role !== startRole || displayName !== (member.displayName ?? '') || [...extras].sort().join() !== [...member.extras].sort().join(),
    [role, startRole, displayName, extras, member],
  )
  const name = member.displayName || member.email || 'this member'

  const save = () =>
    startSave(async () => {
      setFormError(null)
      const r = await updateMember(member.userId, { role, extraPerms: extras, displayName })
      if (!r.ok) {
        setFormError(r.error)
        toast.error('Changes not saved', { description: r.error })
        return
      }
      onSaved(r.data)
      toast.success(`Saved ${r.data.displayName || r.data.email}`, { description: `${ROLE_META[r.data.role].label} · ${r.data.perms.length} rooms` })
      onClose()
    })

  const doReset = () =>
    startReset(async () => {
      const r = await resetPassword(member.userId)
      setConfirmReset(false)
      if (!r.ok) {
        toast.error('Password not reset', { description: r.error })
        return
      }
      setIssued({ email: member.email ?? '', password: r.data.password, reason: 'reset' })
      toast.success('New temp password ready', { description: 'Their old password stopped working.' })
    })

  const doRemove = () =>
    startRemove(async () => {
      const r = await removeMember(member.userId, { deleteLogin })
      if (!r.ok) {
        toast.error('Not removed', { description: r.error })
        return
      }
      onRemoved(member.userId)
      toast.success(`${name} left the team`, { description: r.data.loginDeleted ? 'Their login was deleted too.' : 'Their login still exists but opens nothing here.' })
    })

  const slip = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } }

  return (
    <div className="space-y-7">
      {formError && <p role="alert" className="border-l-4 border-hype bg-hype/10 px-3 py-2 text-[13.5px]">{formError}</p>}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 border-2 border-paper/12 px-3 py-2.5">
          <Avatar m={member} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[13px] text-paper/80">{member.email}</span>
            <span className="block font-mono text-[11px] text-paper/45">
              Added {member.createdAt ? fmtDate(member.createdAt) : '—'} · {member.lastSignInAt ? `last in ${fmtDate(member.lastSignInAt)}` : 'never signed in'}
            </span>
          </span>
        </div>
        <TextField label="Display name" value={displayName} onChange={setDisplayName} maxLength={80} placeholder="How the team knows them" />
        <RoleSelect value={role} onChange={setRole} />
      </section>

      <section>
        <p className={adminLabel}>Extra permissions</p>
        <PermPicker role={role} extras={extras} onChange={setExtras} />
      </section>

      <div className="flex flex-wrap items-center gap-2.5 border-y-2 border-paper/10 py-4">
        <button type="button" onClick={save} disabled={saving || !dirty} className={adminBtn()}>
          {saving ? <span className="inline-block size-3.5 animate-spin border-2 border-ink border-t-transparent" aria-hidden /> : <ShieldCheck aria-hidden className="size-4" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onClose} className={adminBtn({ variant: 'ghost' })}>Cancel</button>
        {dirty && !saving && <span className="label text-[10px] text-volt">● Unsaved changes</span>}
      </div>

      {/* reset password */}
      <section aria-labelledby="reset-title" className="space-y-3">
        <h3 id="reset-title" className="font-display text-[22px] uppercase leading-none">Password</h3>
        {issued ? (
          <KeyCard issued={issued} />
        ) : (
          <>
            <p className="text-[13.5px] text-paper/60">Forgot it? Cut a new temp password. Their old one stops working straight away.</p>
            <AnimatePresence initial={false} mode="wait">
              {confirmReset ? (
                <motion.div key="confirm" {...slip} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-2 border-volt bg-volt/10 p-3">
                    <span className="flex-1 text-[13.5px]">Issue a new password for <strong>{name}</strong>?</span>
                    <button type="button" onClick={doReset} disabled={resetting} className={adminBtn({ size: 'sm', className: 'min-h-10' })}>
                      <KeyRound aria-hidden className={cn('size-3.5', resetting && 'animate-pulse')} /> {resetting ? 'Cutting…' : 'Yes, new password'}
                    </button>
                    <button type="button" onClick={() => setConfirmReset(false)} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10' })}>Keep it</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="btn" {...slip} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <button type="button" onClick={() => setConfirmReset(true)} className={adminBtn({ variant: 'ghost' })}>
                    <KeyRound aria-hidden className="size-4" /> Reset password
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </section>

      {/* remove */}
      <section aria-labelledby="remove-title" className="space-y-3 border-2 border-hype/40 bg-hype/[0.06] p-4">
        <h3 id="remove-title" className="font-display text-[22px] uppercase leading-none text-hype">Remove from team</h3>
        <p className="text-[13.5px] text-paper/65">They lose access to every admin room immediately. This can’t be undone — you’d add them again from scratch.</p>
        <AnimatePresence initial={false} mode="wait">
          {confirmRemove ? (
            <motion.div key="confirm" {...slip} transition={{ duration: 0.18 }} className="overflow-hidden">
              <div className="space-y-3 border-2 border-hype bg-ink p-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px]">
                  <input type="checkbox" checked={deleteLogin} onChange={(e) => setDeleteLogin(e.target.checked)} className="size-4 accent-[var(--color-hype)]" />
                  Also delete their login (Supabase auth user)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={doRemove} disabled={removing} className={adminBtn({ variant: 'danger', size: 'sm', className: 'min-h-10' })}>
                    <Trash2 aria-hidden className={cn('size-3.5', removing && 'animate-pulse')} /> {removing ? 'Removing…' : `Yes, remove ${name}`}
                  </button>
                  <button type="button" onClick={() => setConfirmRemove(false)} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10' })}>
                    <X aria-hidden className="size-3.5" /> Keep them
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="btn" {...slip} transition={{ duration: 0.18 }} className="overflow-hidden">
              <button type="button" onClick={() => setConfirmRemove(true)} className={adminBtn({ variant: 'danger' })}>
                <Trash2 aria-hidden className="size-4" /> Remove…
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
