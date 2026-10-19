// Admin navigation map (P4a + team roles). Shared by AdminShell (sidebar + mobile sheet) and pages that want their index/JP label.
// Each item names the permission it needs; the shell only shows items the member can open.
import type { Perm } from '@/lib/admin/permissions'

export interface AdminNavItem {
  href: string
  label: string
  jp: string
  /** two-digit chapter number shown in the sidebar and page kickers */
  no: string
  icon: 'dashboard' | 'analytics' | 'leads' | 'orders' | 'products' | 'collections' | 'deals' | 'custom' | 'pricing' | 'events' | 'instagram' | 'settings' | 'qr' | 'team'
  /** permission needed to open this section */
  perm: Perm
}
export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', jp: 'ダッシュボード', no: '01', icon: 'dashboard', perm: 'dashboard.view' },
      { href: '/admin/analytics', label: 'Analytics', jp: '分析', no: '02', icon: 'analytics', perm: 'analytics.view' },
      { href: '/admin/qr', label: 'QR codes', jp: 'QRコード', no: '03', icon: 'qr', perm: 'qr.use' },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { href: '/admin/leads', label: 'Leads', jp: '問い合わせ', no: '04', icon: 'leads', perm: 'leads.view' },
      { href: '/admin/orders', label: 'Orders', jp: '注文', no: '05', icon: 'orders', perm: 'orders.view' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products', jp: '商品', no: '06', icon: 'products', perm: 'catalog.edit' },
      { href: '/admin/collections', label: 'Collections', jp: 'アーク', no: '07', icon: 'collections', perm: 'catalog.edit' },
      { href: '/admin/deals', label: 'Deals', jp: 'お得', no: '08', icon: 'deals', perm: 'catalog.edit' },
      { href: '/admin/custom-rules', label: 'Custom rules', jp: '特注', no: '09', icon: 'custom', perm: 'catalog.edit' },
      { href: '/admin/pricing', label: 'Pricing', jp: '価格', no: '10', icon: 'pricing', perm: 'catalog.edit' },
      { href: '/admin/events', label: 'Events & Partners', jp: 'イベント', no: '11', icon: 'events', perm: 'catalog.edit' },
      { href: '/admin/instagram', label: 'Instagram', jp: 'インスタ', no: '12', icon: 'instagram', perm: 'catalog.edit' },
    ],
  },
  {
    label: 'Site',
    items: [
      { href: '/admin/settings', label: 'Settings', jp: '設定', no: '13', icon: 'settings', perm: 'settings.edit' },
      { href: '/admin/team', label: 'Team', jp: 'チーム', no: '14', icon: 'team', perm: 'team.manage' },
    ],
  },
]

export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items)

/** Nav item for a pathname (longest matching prefix). */
export function adminNavFor(pathname: string): AdminNavItem | undefined {
  const exact = ADMIN_NAV_FLAT.find((i) => i.href === pathname)
  if (exact) return exact
  return ADMIN_NAV_FLAT.filter((i) => i.href !== '/admin' && pathname.startsWith(i.href + '/')).sort(
    (a, b) => b.href.length - a.href.length,
  )[0]
}

/** Nav groups filtered to what a member can open (empty groups dropped). */
export function navFor(perms: readonly string[]): AdminNavGroup[] {
  return ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => perms.includes(i.perm)) })).filter((g) => g.items.length > 0)
}
