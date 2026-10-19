'use client'
// Admin shell (P4a): ink sidebar of "chapters", sliding door-purple active tab, demo hazard banner, mobile sheet.
// Mounted once by src/app/admin/layout.tsx — pages never render it themselves.
import './admin.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BadgePercent, CalendarDays, ChartLine, DoorOpen, Gauge, Ruler, ExternalLink, Images, Inbox, LayoutDashboard, Lock, LogOut, Menu, Package,
  QrCode, Settings, Shirt, UsersRound, X, type LucideIcon,
} from 'lucide-react'
import { Wordmark } from '@/components/brand'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion'
import { PERMS, ROLE_META, type Perm, type Role } from '@/lib/admin/permissions'
import { AdminProvider } from './AdminContext'
import { adminNavFor, navFor, type AdminNavGroup, type AdminNavItem } from './nav'

const ICONS: Record<AdminNavItem['icon'], LucideIcon> = {
  dashboard: LayoutDashboard,
  analytics: ChartLine,
  qr: QrCode,
  leads: Inbox,
  orders: Package,
  products: Shirt,
  collections: DoorOpen,
  deals: BadgePercent,
  custom: Ruler,
  pricing: Gauge,
  events: CalendarDays,
  instagram: Images,
  settings: Settings,
  team: UsersRound,
}

export interface AdminShellProps {
  children: ReactNode
  /** Supabase not configured → sample data + disabled writes */
  demo: boolean
  email?: string | null
  /** server action that signs out and redirects to /admin/login */
  signOutAction?: () => Promise<void>
  /** render children without chrome (login screen) */
  bare?: boolean
  /** team role of the signed-in member (null in demo mode) */
  role?: Role | null
  /** effective permissions; the sidebar only lists sections the member can open (demo = all) */
  perms?: readonly Perm[]
  displayName?: string | null
  isSuperadmin?: boolean
  isProtected?: boolean
}

export function AdminShell({
  children, demo, email = null, signOutAction, bare, role = null, perms = PERMS, displayName = null, isSuperadmin = false, isProtected = false,
}: AdminShellProps) {
  const pathname = usePathname() ?? '/admin'
  const isLogin = pathname.startsWith('/admin/login')
  const [open, setOpen] = useState(false)
  const groups = navFor(demo ? PERMS : perms)
  const ctx = { demo, email, role, perms: demo ? PERMS : perms, isSuperadmin }
  const who: Who = { email, role, displayName, isProtected, demo }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile sheet on route change
  useEffect(() => setOpen(false), [pathname])

  if (bare || isLogin) {
    return (
      <AdminProvider value={ctx}>
        <div data-admin-shell="" className="min-h-dvh bg-ink text-paper">
          {children}
        </div>
      </AdminProvider>
    )
  }

  const current = adminNavFor(pathname)

  return (
    <AdminProvider value={ctx}>
      <div data-admin-shell="" className="min-h-dvh bg-ink text-paper lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* ── desktop sidebar ───────────────────────────── */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r-4 border-paper/10 bg-[#0e0e13] lg:flex" aria-label="Admin">
          <SidebarBrand demo={demo} />
          <nav aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" data-lenis-prevent="">
            <NavGroups groups={groups} pathname={pathname} layoutId="admin-nav-desk" />
          </nav>
          <SidebarFoot who={who} signOutAction={signOutAction} />
        </aside>

        {/* ── main column ───────────────────────────────── */}
        <div className="min-w-0">
          {demo && <DemoBanner />}
          <MobileBar current={current} onMenu={() => setOpen(true)} />
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
        </div>

        <MobileSheet open={open} onClose={() => setOpen(false)} pathname={pathname} groups={groups} who={who} signOutAction={signOutAction} />
      </div>
    </AdminProvider>
  )
}

function SidebarBrand({ demo }: { demo: boolean }) {
  return (
    <div className="relative px-5 pb-5 pt-6">
      <Link href="/admin" className="group flex items-center gap-3 focus-ring" aria-label="Admin dashboard">
        <span className="relative block size-12 shrink-0 transition-transform duration-200 ease-(--ease-punch) can-hover:group-hover:-rotate-6">
          <Wordmark variant="bracket" title="" className="size-12" />
        </span>
        <span className="leading-none">
          <span className="block font-display text-[26px] uppercase tracking-[-0.01em]">Owner&apos;s room</span>
          <span className="jp-sub mt-1 block text-[11px]">管理室 · THE ESCAPE DOOR</span>
        </span>
      </Link>
      <span
        className={cn(
          'mt-4 inline-flex items-center gap-2 border-2 px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]',
          demo ? 'border-volt text-volt' : 'border-paper/25 text-paper/80',
        )}
      >
        <span className={cn('size-2 rounded-full', demo ? 'bg-volt' : 'animate-pulse bg-[#3ddc84]')} aria-hidden="true" />
        {demo ? 'Demo mode' : 'Live · Supabase'}
      </span>
    </div>
  )
}

function NavGroups({ groups, pathname, layoutId, onNavigate }: { groups: AdminNavGroup[]; pathname: string; layoutId: string; onNavigate?: () => void }) {
  const current = adminNavFor(pathname)
  const reduced = useReducedMotion()
  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="mt-4 first:mt-0">
          <p className="label px-3 pb-1.5 text-[10px] text-paper/40">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon]
              const active = current?.href === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex min-h-11 items-center gap-3 px-3 py-2 focus-ring',
                      active ? 'text-paper' : 'text-paper/70 can-hover:hover:text-paper',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={layoutId}
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
                        className="absolute inset-0 border-2 border-ink bg-door shadow-[4px_4px_0_var(--color-volt)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        'relative w-5 font-mono text-[10px] tabular-nums',
                        active ? 'text-volt' : 'text-paper/35',
                      )}
                    >
                      {item.no}
                    </span>
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'relative size-[18px] shrink-0 transition-transform duration-200 ease-(--ease-punch)',
                        !active && 'can-hover:group-hover:-translate-y-0.5 can-hover:group-hover:-rotate-6',
                      )}
                    />
                    <span className="relative flex-1 truncate text-[14.5px] font-semibold">{item.label}</span>
                    <span
                      lang="ja"
                      className={cn('relative font-jp text-[10px] font-bold', active ? 'text-paper/75' : 'text-paper/25')}
                    >
                      {item.jp}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

function SignOutButton({ signOutAction, className }: { signOutAction?: () => Promise<void>; className?: string }) {
  const [pending, start] = useTransition()
  if (!signOutAction) return null
  return (
    <button
      type="button"
      onClick={() => start(() => signOutAction())}
      disabled={pending}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 px-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper/70 focus-ring can-hover:hover:text-hype disabled:opacity-50',
        className,
      )}
    >
      <LogOut aria-hidden="true" className={cn('size-4', pending && 'animate-pulse')} />
      {pending ? 'Closing the door…' : 'Sign out'}
    </button>
  )
}

interface Who {
  email: string | null
  role: Role | null
  displayName: string | null
  isProtected: boolean
  demo: boolean
}

/** Signed-in member's role badge. SUPERADMIN = volt with a lock (protected at the database level). */
function RoleBadge({ role, isProtected }: { role: Role; isProtected: boolean }) {
  const meta = ROLE_META[role]
  const tone: Record<string, string> = {
    volt: 'border-ink bg-volt text-ink shadow-[3px_3px_0_var(--color-door)]',
    door: 'border-ink bg-door text-paper',
    lav: 'border-ink bg-lav text-ink',
    pink: 'border-ink bg-pink text-ink',
    muted: 'border-paper/25 bg-tone-2 text-paper/80',
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 border-2 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]', tone[meta.tone])}
      title={isProtected ? 'Protected superadmin — can’t be edited or removed' : meta.description}
    >
      {(role === 'superadmin' || isProtected) && <Lock aria-hidden="true" className="size-3" />}
      {meta.label}
      <span lang="ja" className="font-jp text-[9.5px] opacity-70">{meta.jp}</span>
    </span>
  )
}

function SidebarFoot({ who, signOutAction }: { who: Who; signOutAction?: () => Promise<void> }) {
  const { email, demo, role, displayName, isProtected } = who
  return (
    <div className="border-t-2 border-paper/10 px-5 py-4">
      {role && (
        <div className="mb-2 flex items-center gap-2">
          <RoleBadge role={role} isProtected={isProtected} />
        </div>
      )}
      {displayName && <p className="truncate text-[13px] font-semibold text-paper/85">{displayName}</p>}
      {email ? (
        <p className="truncate font-mono text-[11px] text-paper/60" title={email}>
          {email}
        </p>
      ) : (
        <p className="font-mono text-[11px] text-paper/50">{demo ? 'No login in demo mode' : ''}</p>
      )}
      <div className="mt-1 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper/70 focus-ring can-hover:hover:text-volt"
        >
          <ExternalLink aria-hidden="true" className="size-4" /> View site
        </Link>
        <SignOutButton signOutAction={signOutAction} />
      </div>
    </div>
  )
}

function DemoBanner() {
  return (
    <div role="status" className="relative overflow-hidden border-b-4 border-ink bg-volt text-ink">
      <div className="admin-tape absolute inset-y-0 left-0 w-3 sm:w-5" aria-hidden="true" />
      <div className="admin-tape absolute inset-y-0 right-0 w-3 sm:w-5" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2.5 sm:px-9 lg:px-12">
        <strong className="font-display text-[19px] uppercase leading-none tracking-[0.01em]">
          Demo data — connect Supabase
        </strong>
        <span className="text-[13px] font-medium leading-snug">
          Numbers here are generated samples, not real traffic. Saving is switched off until{' '}
          <code className="font-mono text-[12px] font-bold">NEXT_PUBLIC_SUPABASE_URL</code> + keys are set.
        </span>
      </div>
    </div>
  )
}

function MobileBar({ current, onMenu }: { current?: AdminNavItem; onMenu: () => void }) {
  return (
    <div className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b-4 border-paper/10 bg-ink/95 px-4 backdrop-blur-sm sm:px-6 lg:hidden">
      <Link href="/admin" aria-label="Admin dashboard" className="focus-ring">
        <Wordmark variant="bracket" title="" className="size-10" />
      </Link>
      <div className="min-w-0 flex-1 leading-none">
        <p className="label text-[10px] text-paper/50">Owner&apos;s room</p>
        <p className="truncate font-display text-[22px] uppercase">{current?.label ?? 'Admin'}</p>
      </div>
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open admin menu"
        className="grid size-11 place-items-center border-2 border-paper/30 bg-tone-1 focus-ring active:translate-x-[2px] active:translate-y-[2px]"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
    </div>
  )
}

function MobileSheet({
  open, onClose, pathname, groups, who, signOutAction,
}: { open: boolean; onClose: () => void; pathname: string; groups: AdminNavGroup[]; who: Who; signOutAction?: () => Promise<void> }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a, button:not([disabled])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    window.__lenis?.stop()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.__lenis?.start()
      prev?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <motion.button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className="screentone screentone-light absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col border-r-4 border-ink bg-[#0e0e13] shadow-[8px_0_0_var(--color-door)] [--tone-opacity:0.06]"
            initial={reduced ? { opacity: 0 } : { x: '-104%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '-104%' }}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="flex items-start justify-between pr-3">
              <SidebarBrand demo={who.demo} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close admin menu"
                className="mt-5 grid size-11 place-items-center border-2 border-paper/30 focus-ring"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" data-lenis-prevent="">
              <NavGroups groups={groups} pathname={pathname} layoutId="admin-nav-sheet" onNavigate={onClose} />
            </nav>
            <SidebarFoot who={who} signOutAction={signOutAction} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
