// Admin navigation map (P4a). Shared by AdminShell (sidebar + mobile sheet) and pages that want their index/JP label.
export interface AdminNavItem {
  href: string
  label: string
  jp: string
  /** two-digit chapter number shown in the sidebar and page kickers */
  no: string
  icon: 'dashboard' | 'analytics' | 'leads' | 'orders' | 'products' | 'collections' | 'events' | 'instagram' | 'settings' | 'qr'
}
export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', jp: 'ダッシュボード', no: '01', icon: 'dashboard' },
      { href: '/admin/analytics', label: 'Analytics', jp: '分析', no: '02', icon: 'analytics' },
      { href: '/admin/qr', label: 'QR codes', jp: 'QRコード', no: '03', icon: 'qr' },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { href: '/admin/leads', label: 'Leads', jp: '問い合わせ', no: '04', icon: 'leads' },
      { href: '/admin/orders', label: 'Orders', jp: '注文', no: '05', icon: 'orders' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products', jp: '商品', no: '06', icon: 'products' },
      { href: '/admin/collections', label: 'Collections', jp: 'アーク', no: '07', icon: 'collections' },
      { href: '/admin/events', label: 'Events & Partners', jp: 'イベント', no: '08', icon: 'events' },
      { href: '/admin/instagram', label: 'Instagram', jp: 'インスタ', no: '09', icon: 'instagram' },
    ],
  },
  {
    label: 'Site',
    items: [{ href: '/admin/settings', label: 'Settings', jp: '設定', no: '10', icon: 'settings' }],
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
