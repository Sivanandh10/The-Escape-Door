// Team roles & permissions — pure, server- and client-safe. Mirrors supabase/migrations/0002_roles.sql,
// 0003_superadmin_delete.sql and 0004_perms.sql (public.role_perms / public.effective_perms / public.has_perm).
// Keep both in sync.
//   effectivePerms('sales', ['catalog.edit'])  → sales defaults ∪ catalog.edit
//   can(session.perms, 'leads.edit')
//   canDelete(session)                         → only the superadmin deletes
//
// Hierarchy (owner rule: "super admin all access, admin all access but only super admin can delete"):
//   5 Superadmin > 4 Admin > 3 Editor > 2 Sales > 1 Viewer

export const PERMS = [
  'dashboard.view',
  'analytics.view',
  'leads.view',
  'leads.edit',
  'orders.view',
  'orders.edit',
  'catalog.edit',
  'settings.edit',
  'qr.use',
  'customers.view',
  'vouchers.edit',
  'careers.edit',
  'pages.edit',
  'team.manage',
  'delete',
] as const
export type Perm = (typeof PERMS)[number]

/** Never grantable, never in another role's defaults (delete is also enforced by RLS — 0003). */
export const SUPERADMIN_ONLY_PERMS = ['team.manage', 'delete'] as const satisfies readonly Perm[]

/** Tooltip on locked delete buttons + the error every server-side delete path returns. */
export const SUPERADMIN_DELETE_NOTE = 'Only the superadmin can delete'

export const ROLES = ['superadmin', 'admin', 'editor', 'sales', 'viewer'] as const
export type Role = (typeof ROLES)[number]

/** Roles a superadmin can hand out, in rank order (highest first). There is exactly one superadmin. */
export const ASSIGNABLE_ROLES = ['admin', 'editor', 'sales', 'viewer'] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

/** Extras that can be granted on top of a role (team.manage and delete are superadmin-only). */
export const GRANTABLE_PERMS = [
  'dashboard.view',
  'analytics.view',
  'leads.view',
  'leads.edit',
  'orders.view',
  'orders.edit',
  'catalog.edit',
  'settings.edit',
  'qr.use',
  'customers.view',
  'vouchers.edit',
  'careers.edit',
  'pages.edit',
] as const satisfies readonly Perm[]
export type GrantablePerm = (typeof GRANTABLE_PERMS)[number]

const ALL_GRANTABLE = GRANTABLE_PERMS as readonly Perm[]

export const ROLE_DEFAULTS: Record<Role, readonly Perm[]> = {
  superadmin: PERMS,
  admin: ALL_GRANTABLE,
  editor: ['dashboard.view', 'catalog.edit', 'qr.use', 'careers.edit', 'pages.edit'],
  sales: [
    'dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view', 'orders.edit', 'qr.use',
    'customers.view', 'vouchers.edit',
  ],
  viewer: ['dashboard.view', 'analytics.view'],
}

export function isPerm(v: unknown): v is Perm {
  return typeof v === 'string' && (PERMS as readonly string[]).includes(v)
}
export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

/**
 * Role defaults ∪ extras, in PERMS order. team.manage and delete only for the superadmin; `*.edit` implies
 * `*.view` (same rules as public.effective_perms in SQL).
 */
export function effectivePerms(role: Role, extras: readonly string[] = []): Perm[] {
  const set = new Set<Perm>(ROLE_DEFAULTS[role] ?? [])
  for (const e of extras) if (isPerm(e)) set.add(e)
  if (role !== 'superadmin') for (const p of SUPERADMIN_ONLY_PERMS) set.delete(p)
  if (set.has('leads.edit')) set.add('leads.view')
  if (set.has('orders.edit')) set.add('orders.view')
  return PERMS.filter((p) => set.has(p))
}

/** Clean an extras list for storage: known grantable keys, nothing the role already has. */
export function normalizeExtras(role: Role, extras: readonly string[]): GrantablePerm[] {
  const defaults = new Set<string>(ROLE_DEFAULTS[role] ?? [])
  return GRANTABLE_PERMS.filter((p) => extras.includes(p) && !defaults.has(p))
}

export function can(perms: readonly string[] | null | undefined, key: Perm): boolean {
  return !!perms && perms.includes(key)
}

/**
 * Hierarchy rule: only the superadmin deletes (rows, product images, uploaded files). Admins still create
 * and edit everything. Accepts a session-like object or an effective permission list.
 *   canDelete(session)          // AdminSession (server) or useAdmin() value (client)
 *   canDelete(session.perms)
 */
export function canDelete(
  who: readonly string[] | { role?: Role | null; isSuperadmin?: boolean } | null | undefined,
): boolean {
  if (!who) return false
  if (Array.isArray(who)) return who.includes('delete')
  const s = who as { role?: Role | null; isSuperadmin?: boolean }
  return s.isSuperadmin === true && (s.role == null || s.role === 'superadmin')
}

// ---------------------------------------------------------------- UI copy
export type PermGroup = 'Insights' | 'Inbox' | 'Catalogue' | 'Site'
export const PERM_GROUPS: PermGroup[] = ['Insights', 'Inbox', 'Catalogue', 'Site']

export const PERM_META: Record<Perm, { label: string; description: string; group: PermGroup }> = {
  'dashboard.view': { label: 'Dashboard', description: 'See the dashboard KPIs (visits, carts, WhatsApp taps).', group: 'Insights' },
  'analytics.view': { label: 'Analytics', description: 'Open the analytics deep-dive: pages, sources, cities.', group: 'Insights' },
  'leads.view': { label: 'View leads', description: 'Read the lead inbox (names, contacts, messages).', group: 'Inbox' },
  'leads.edit': { label: 'Work leads', description: 'Move leads along the pipeline, add notes, mark spam.', group: 'Inbox' },
  'orders.view': { label: 'View orders', description: 'Read the order desk.', group: 'Inbox' },
  'orders.edit': { label: 'Work orders', description: 'Promote leads, mark paid / shipped, cancel.', group: 'Inbox' },
  'catalog.edit': { label: 'Edit catalogue', description: 'Create and edit products, collections, deals, custom-order rules, hoodie tiers / tee fits, events, partners and Instagram posts.', group: 'Catalogue' },
  'settings.edit': { label: 'Site settings', description: 'Hero copy, banner, ticker, WhatsApp order number.', group: 'Site' },
  'qr.use': { label: 'QR studio', description: 'Make and save fest / stall QR links and see what they bring in.', group: 'Site' },
  'customers.view': { label: 'Customers', description: 'See signed-in customers, their orders, addresses and recent activity.', group: 'Inbox' },
  'vouchers.edit': { label: 'Vouchers', description: 'Create, pause and hand out voucher codes; see redemptions.', group: 'Inbox' },
  'careers.edit': { label: 'Careers', description: 'Post and close job openings, read applications and export them as CSV.', group: 'Site' },
  'pages.edit': { label: 'Pages & policies', description: 'Edit policy and info pages (shipping, returns, privacy, terms, FAQ).', group: 'Site' },
  'team.manage': { label: 'Manage team', description: 'Add, edit and remove team members. Superadmin only.', group: 'Site' },
  delete: { label: 'Delete', description: 'Permanently delete products, arcs, events, posts, images, leads and orders. Superadmin only.', group: 'Site' },
}

export type RoleTone = 'volt' | 'door' | 'lav' | 'pink' | 'muted'
export const ROLE_META: Record<Role, { label: string; jp: string; rank: number; summary: string; description: string; tone: RoleTone }> = {
  superadmin: {
    label: 'Superadmin', jp: '総長', rank: 5, tone: 'volt',
    summary: 'Everything — the only one who can delete or manage the team.',
    description: 'Everything, including the team and deleting. Protected — can’t be edited or removed.',
  },
  admin: {
    label: 'Admin', jp: '管理者', rank: 4, tone: 'door',
    summary: 'Creates and edits everything; can’t delete or manage the team.',
    description: 'Runs the whole shop: inbox, customers, vouchers, catalogue, pages, careers, settings, insights. Creates and edits everything — deleting and the team stay with the superadmin.',
  },
  editor: {
    label: 'Editor', jp: '編集', rank: 3, tone: 'lav',
    summary: 'Creates and edits the catalogue, pages and careers, plus QR codes.',
    description: 'Keeps the catalogue fresh: products, arcs, events, Instagram. Plus policy pages, job posts and QR codes.',
  },
  sales: {
    label: 'Sales', jp: '営業', rank: 2, tone: 'pink',
    summary: 'Works leads, orders, customers and vouchers, plus analytics and QR codes.',
    description: 'Works the inbox: leads, orders, customers and vouchers, plus analytics and QR codes.',
  },
  viewer: {
    label: 'Viewer', jp: '閲覧', rank: 1, tone: 'muted',
    summary: 'Read-only dashboard and analytics.',
    description: 'Read-only look at the dashboard and analytics.',
  },
}

/** Higher rank = more power. Superadmin 5 > Admin 4 > Editor 3 > Sales 2 > Viewer 1. */
export function roleRank(role: Role): number {
  return ROLE_META[role].rank
}

/** Roles from the top of the hierarchy down. */
export const ROLES_BY_RANK: readonly Role[] = [...ROLES].sort((a, b) => roleRank(b) - roleRank(a))

/** Assignable roles (everything below the superadmin), highest rank first — for role pickers. */
export const ASSIGNABLE_BY_RANK: readonly AssignableRole[] = [...ASSIGNABLE_ROLES].sort((a, b) => roleRank(b) - roleRank(a))

/** Which permission each admin route needs (longest prefix wins). Used by the shell and pages. */
export const ROUTE_PERMS: Array<{ href: string; perm: Perm }> = [
  { href: '/admin/analytics', perm: 'analytics.view' },
  { href: '/admin/qr', perm: 'qr.use' },
  { href: '/admin/leads', perm: 'leads.view' },
  { href: '/admin/orders', perm: 'orders.view' },
  { href: '/admin/products', perm: 'catalog.edit' },
  { href: '/admin/collections', perm: 'catalog.edit' },
  { href: '/admin/deals', perm: 'catalog.edit' },
  { href: '/admin/custom-rules', perm: 'catalog.edit' },
  { href: '/admin/pricing', perm: 'catalog.edit' },
  { href: '/admin/events', perm: 'catalog.edit' },
  { href: '/admin/instagram', perm: 'catalog.edit' },
  { href: '/admin/customers', perm: 'customers.view' },
  { href: '/admin/vouchers', perm: 'vouchers.edit' },
  { href: '/admin/careers', perm: 'careers.edit' },
  { href: '/admin/pages', perm: 'pages.edit' },
  { href: '/admin/settings', perm: 'settings.edit' },
  { href: '/admin/team', perm: 'team.manage' },
  { href: '/admin', perm: 'dashboard.view' },
]

/** First admin page a member can open (for "No access" fallbacks and post-login). */
export function homeFor(perms: readonly string[]): string {
  const order = [
    '/admin', '/admin/leads', '/admin/orders', '/admin/customers', '/admin/products', '/admin/analytics', '/admin/qr',
    '/admin/vouchers', '/admin/pages', '/admin/careers', '/admin/settings', '/admin/team',
  ]
  for (const href of order) {
    const r = ROUTE_PERMS.find((x) => x.href === href)
    if (r && perms.includes(r.perm)) return href
  }
  return '/admin/login?e=no-perms'
}
