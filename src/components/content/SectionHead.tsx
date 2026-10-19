// Section heading: "Chapter" label · H2 with an <em> accent word · JP subtitle (outside the H2, aria-hidden)
// · optional intro. Owner: P5. Server component; the H2 rises in with F1's SplitReveal (#04).
import type { ReactNode } from 'react'
import { SplitReveal } from '@/components/motion/SplitReveal'
import { cn } from '@/lib/utils'

export interface SectionHeadProps {
  /** e.g. "01" */
  n?: string
  label: string
  jp: string
  /** H2 markup — wrap the accent word in <em> */
  children: ReactNode
  intro?: ReactNode
  id?: string
  tone?: 'ink' | 'paper'
  /** smaller H2 for dense pages */
  size?: 'lg' | 'md'
  className?: string
}

export function SectionHead({ n, label, jp, children, intro, id, tone = 'ink', size = 'lg', className }: SectionHeadProps) {
  return (
    <div className={cn('relative', className)}>
      <p className={cn('label flex items-center gap-3', tone === 'ink' ? 'text-tone-4' : 'text-tone-2')}>
        {n && (
          <span className={cn('border-2 px-1.5 py-0.5 tabular-nums', tone === 'ink' ? 'border-volt text-volt' : 'border-ink bg-ink text-paper')}>{n}</span>
        )}
        {label}
      </p>
      <SplitReveal
        as="h2"
        id={id}
        split="words"
        className={cn('h-display mt-4 max-w-[18ch] text-balance', size === 'lg' ? 'text-h2' : 'text-[clamp(36px,5.2vw,80px)]')}
      >
        {children}
      </SplitReveal>
      <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
        {jp}
      </span>
      {intro && (
        <div className={cn('mt-6 max-w-[60ch] text-[17px] leading-[1.6]', tone === 'ink' ? 'text-tone-4' : 'text-tone-2')}>{intro}</div>
      )}
    </div>
  )
}

export default SectionHead
