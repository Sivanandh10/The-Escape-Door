'use client'
// Admin error state (P4a): ink-splat panel + retry (DESIGN §10).
//   <ErrorState message="Couldn't load leads." onRetry={reload} />
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { InkSplat } from '@/components/fx/InkSplat'
import { cn } from '@/lib/utils'
import { adminBtn } from './ui'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function ErrorState({ title = 'That door jammed', message = 'Something went wrong loading this. Your data is safe.', onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('relative overflow-hidden border-2 border-hype bg-[#1a0d10] px-5 py-6 sm:px-7', className)}>
      <InkSplat variant={3} color="var(--color-hype)" className="pointer-events-none absolute -right-8 -top-10 w-40 opacity-25" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <TriangleAlert aria-hidden="true" className="size-8 shrink-0 text-hype" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[26px] uppercase leading-none">{title}</p>
          <p className="mt-1.5 text-[14px] text-paper/75">{message}</p>
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} disabled={retrying} className={adminBtn({ variant: 'ghost' })}>
            <RefreshCw aria-hidden="true" className={cn('size-4', retrying && 'animate-spin')} />
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  )
}
