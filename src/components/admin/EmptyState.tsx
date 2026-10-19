// Admin empty / loading states (P4a). Server-safe. Mascot "Kado" in work mode by default (DESIGN §6).
//   <EmptyState title="No leads yet" body="…" action={<Link className={adminBtn()} …/>} />
//   <AdminSkeleton variant="table" rows={6} />
import type { ReactNode } from 'react'
import { Mascot, type MascotMood } from '@/components/brand/Mascot'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: ReactNode
  body?: ReactNode
  /** one primary action (a Link or button styled with adminBtn()) */
  action?: ReactNode
  mood?: MascotMood
  /** small manga SFX label next to the mascot, decorative (e.g. "シーン…" = silence) */
  sfx?: string
  /** smaller layout for inside panels/tables */
  compact?: boolean
  className?: string
}

export function EmptyState({ title, body, action, mood = 'work', sfx = 'シーン…', compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'screentone screentone-light relative flex flex-col items-center gap-4 border-2 border-dashed border-paper/20 text-center [--tone-opacity:0.07] sm:flex-row sm:text-left',
        compact ? 'px-4 py-6' : 'px-6 py-10 sm:px-10',
        className,
      )}
    >
      <div className="relative shrink-0">
        <Mascot mood={mood} size={compact ? 84 : 120} animate title="" />
        {sfx && (
          <span
            aria-hidden="true"
            lang="ja"
            className="absolute -right-6 -top-2 rotate-[8deg] font-sfx-jp text-[18px] text-volt [-webkit-text-stroke:3px_var(--color-ink)] [paint-order:stroke_fill]"
          >
            {sfx}
          </span>
        )}
      </div>
      <div className="min-w-0 max-w-[52ch]">
        <p className={cn('font-display uppercase leading-[0.92]', compact ? 'text-[26px]' : 'text-[34px]')}>{title}</p>
        {body && <div className="mt-2 text-[14.5px] leading-relaxed text-paper/70">{body}</div>}
        {action && <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">{action}</div>}
      </div>
    </div>
  )
}

export function AdminSkeleton({ variant = 'table', rows = 5, className }: { variant?: 'table' | 'cards' | 'chart'; rows?: number; className?: string }) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6', className)} aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-tone h-[132px] border-2 border-paper/10" />
        ))}
      </div>
    )
  }
  if (variant === 'chart') {
    return <div className={cn('skeleton-tone h-[280px] border-2 border-paper/10', className)} aria-busy="true" aria-label="Loading chart" />
  }
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Loading">
      <div className="skeleton-tone h-10 border-2 border-paper/10" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-tone h-12 opacity-70" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}
