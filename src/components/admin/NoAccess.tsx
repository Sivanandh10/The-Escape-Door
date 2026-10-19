// "No access" state (team roles). Server-safe. Rendered by a page instead of its content when the
// signed-in member's role lacks the permission:   if (!gate.allowed) return <NoAccess perm="leads.view" session={gate.session} />
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { PERM_META, ROLE_META, homeFor, type Perm } from '@/lib/admin/permissions'
import type { AdminSession } from '@/lib/supabase/server'
import { AdminPage } from './AdminPage'
import { adminBtn, adminPill } from './ui'

/** `inline` = just the locked panel (for pages whose AdminPage header is already on screen). */
export function NoAccess({ perm, session, inline }: { perm: Perm; session: AdminSession | null; inline?: boolean }) {
  const meta = PERM_META[perm]
  const role = session?.role ? ROLE_META[session.role] : null
  const home = session ? homeFor(session.perms) : '/admin'
  const canGoHome = !home.startsWith('/admin/login')
  const panel = (
      <section
        aria-labelledby="no-access-title"
        className="admin-rise screentone screentone-light relative flex flex-col items-center gap-6 border-4 border-ink bg-[#121218] px-6 py-10 text-center shadow-[8px_8px_0_var(--color-hype)] [--tone-opacity:0.07] sm:flex-row sm:px-10 sm:text-left"
      >
        <div className="relative shrink-0">
          <Mascot mood="shock" size={140} animate title="" />
          <span
            aria-hidden="true"
            lang="ja"
            className="absolute -right-5 -top-3 rotate-[10deg] font-sfx-jp text-[22px] text-hype [-webkit-text-stroke:3px_var(--color-ink)] [paint-order:stroke_fill]"
          >
            ガチャ!
          </span>
        </div>
        <div className="min-w-0 max-w-[56ch]">
          <p className="inline-flex items-center gap-2 border-2 border-ink bg-hype px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-paper">
            <Lock aria-hidden="true" className="size-3.5" /> Needs “{meta.label}”
          </p>
          <h2 id="no-access-title" className="mt-3 font-display text-[clamp(30px,4vw,44px)] uppercase leading-[0.92]">
            This room is locked for your role
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-paper/70">
            {meta.description} Your role{' '}
            {role ? <span className={adminPill(role.tone)}>{role.label}</span> : 'on the team'}{' '}
            doesn’t include it. Ask the superadmin to add “{meta.label}” to your account.
          </p>
          {canGoHome && (
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Link href={home} className={adminBtn()}>
                Back to a room you can open
              </Link>
            </div>
          )}
        </div>
      </section>
  )
  if (inline) return panel
  return (
    <AdminPage kicker="Locked door" title={<>Not your <em>door</em></>} jp="立入禁止">
      {panel}
    </AdminPage>
  )
}
