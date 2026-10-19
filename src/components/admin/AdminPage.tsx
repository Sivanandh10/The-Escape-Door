// Admin page frame + panel (P4a). Server-safe (no hooks) — use from server or client pages.
//   <AdminPage no="04" title={<>All <em>leads</em></>} jp="問い合わせ" description="…" actions={<button…/>}>…</AdminPage>
//   <AdminPanel title="Top pages" jp="人気ページ" action={<Link…/>}>…</AdminPanel>
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AdminPageProps {
  /** H1 (the page's only H1). Wrap the accent word in <em>. */
  title: ReactNode
  /** JP subtitle under the title */
  jp?: string
  /** chapter number "04" — shown as "CH.04" in the kicker */
  no?: string
  /** kicker text (default "Owner's room") */
  kicker?: string
  description?: ReactNode
  /** buttons on the right of the header (stack under the title on mobile) */
  actions?: ReactNode
  /** optional strip under the header (filters, tabs, range picker) */
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}

export function AdminPage({ title, jp, no, kicker = "Owner's room", description, actions, toolbar, children, className }: AdminPageProps) {
  return (
    <div className={cn('relative', className)}>
      <header className="relative mb-6 border-b-4 border-paper/10 pb-6 lg:mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="label flex items-center gap-2 text-volt">
              {no && <span className="bg-volt px-1.5 py-0.5 text-ink">CH.{no}</span>}
              <span>{kicker}</span>
            </p>
            <h1 className="admin-slam mt-3 font-display text-[clamp(44px,6.4vw,92px)] uppercase leading-[0.88] tracking-[-0.01em] [overflow-wrap:anywhere]">
              {title}
            </h1>
            {jp && (
              <p lang="ja" className="jp-sub mt-2">
                {jp}
              </p>
            )}
            {description && <div className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-paper/70">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3 md:justify-end">{actions}</div>}
        </div>
        {toolbar && <div className="mt-5">{toolbar}</div>}
      </header>
      <div className="space-y-6 lg:space-y-8">{children}</div>
    </div>
  )
}

export type AdminPanelTone = 'ink' | 'paper' | 'volt' | 'lav' | 'door'
const PANEL_TONE: Record<AdminPanelTone, string> = {
  ink: 'bg-tone-1 text-paper border-paper/15',
  paper: 'bg-paper text-ink border-ink grain',
  volt: 'bg-volt text-ink border-ink',
  lav: 'bg-lav text-ink border-ink',
  door: 'bg-door text-paper border-ink',
}

export interface AdminPanelProps {
  title?: ReactNode
  jp?: string
  /** right side of the panel header (link, button, select) */
  action?: ReactNode
  tone?: AdminPanelTone
  /** hard offset shadow colour */
  shadow?: 'none' | 'door' | 'volt' | 'paper'
  className?: string
  bodyClassName?: string
  children: ReactNode
  /** id for aria-labelledby / anchors */
  id?: string
  /** stagger index for the entrance rise */
  index?: number
}

const PANEL_SHADOW = {
  none: '',
  door: 'shadow-[6px_6px_0_var(--color-door)]',
  volt: 'shadow-[6px_6px_0_var(--color-volt)]',
  paper: 'shadow-[6px_6px_0_var(--color-paper)]',
}

export function AdminPanel({ title, jp, action, tone = 'ink', shadow = 'none', className, bodyClassName, children, id, index = 0 }: AdminPanelProps) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cn('admin-rise relative min-w-0 border-2', PANEL_TONE[tone], PANEL_SHADOW[shadow], className)}
      style={{ ['--d' as string]: `${Math.min(index, 8) * 60}ms` }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b-2 border-current/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="font-display text-[22px] uppercase leading-none tracking-[0.005em] sm:text-[24px]">
                {title}
              </h2>
            )}
            {jp && (
              <p lang="ja" className="jp-sub mt-1 text-[10.5px]">
                {jp}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
