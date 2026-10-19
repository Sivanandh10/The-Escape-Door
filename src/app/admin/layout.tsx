// Admin layout (P4a + team roles): noindex, team gate, AdminShell (sidebar filtered by the member's permissions). The session read sits inside <Suspense> (Cache Components).
// DEMO MODE when Supabase env is missing: browsable without login, banner + sample data, writes disabled.
import '@/components/admin/admin.css'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { signOutAction } from '@/components/admin/actions'
import { getAdminContext } from '@/components/admin/server'
import { Mascot } from '@/components/brand/Mascot'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

// Admin legitimately blocks on the session (stack-notes §1.2).
export const instant = false

async function AdminGate({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get('x-ted-path') ?? ''
  const ctx = await getAdminContext()
  if (ctx.demo) return <AdminShell demo>{children}</AdminShell>

  const isLogin = path.startsWith('/admin/login')
  if (isLogin) return <AdminShell demo={false} bare>{children}</AdminShell>
  if (!ctx.session) redirect('/admin/login')
  if (!ctx.session.isAdmin) redirect('/admin/login?e=not-owner')
  return (
    <AdminShell
      demo={false}
      email={ctx.session.email}
      signOutAction={signOutAction}
      role={ctx.session.role}
      perms={ctx.session.perms}
      displayName={ctx.session.displayName}
      isSuperadmin={ctx.session.isSuperadmin}
      isProtected={ctx.session.isProtected}
    >
      {children}
    </AdminShell>
  )
}

function AdminBoot() {
  return (
    <div data-admin-shell="" className="grid min-h-dvh place-items-center bg-ink px-6 text-paper" aria-busy="true">
      <div className="flex flex-col items-center gap-4 text-center">
        <Mascot mood="peek" size={110} animate title="" />
        <p className="font-display text-[28px] uppercase leading-none">Unlocking the owner&apos;s room…</p>
        <p lang="ja" className="jp-sub">管理室</p>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminBoot />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  )
}
