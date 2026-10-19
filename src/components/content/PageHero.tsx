// Content-page hero: a manga "chapter opener" panel. Owner: P5. Server component.
// The H1 is visible from the first paint (LCP) — only the volt highlighter swipes in, the side panel
// slams in, and the SFX pops (CSS, off under reduced motion). Speed lines idle behind (canvas, F1).
import type { ReactNode } from 'react'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Sfx } from '@/components/fx/Sfx'
import { VerticalType } from '@/components/fx/VerticalType'
import { cn } from '@/lib/utils'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import s from './content.module.css'

export interface PageHeroProps {
  /** mono kicker above the H1, e.g. "Chapter · Fests" */
  kicker: string
  /** H1 content — wrap the accent word in <em> */
  title: ReactNode
  jp: string
  intro: ReactNode
  crumbs: Crumb[]
  /** side panel (facts, mascot…) — slams in */
  aside?: ReactNode
  /** decorative SFX text, e.g. "ドン!" */
  sfx?: string
  /** vertical rail text on ≥1024px */
  rail?: string
  /** speed-line focus */
  focus?: { x: number; y: number }
  /** extra content under the intro (CTAs) */
  children?: ReactNode
  /** compact = policies (smaller H1, no speed lines) */
  compact?: boolean
  className?: string
}

export function PageHero({ kicker, title, jp, intro, crumbs, aside, sfx, rail, focus = { x: 0.82, y: 0.45 }, children, compact, className }: PageHeroProps) {
  return (
    <header className={cn('relative overflow-hidden bg-ink text-paper', s.hero, className)}>
      <Breadcrumbs items={crumbs} />
      {!compact && (
        <SpeedLines className="top-10 opacity-60" intensity={0.3} focus={focus} color="var(--color-tone-2)" count={90} />
      )}
      {rail && <VerticalType text={rail} side="right" outline repeat={2} size="clamp(56px, 6vw, 96px)" className="absolute right-3 top-14 bottom-0 opacity-40" />}
      <div className={cn('container-x relative grid gap-10 lg:grid-cols-12 lg:gap-8', compact ? 'pb-14 pt-10 sm:pb-16 sm:pt-14' : 'pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pb-28 lg:pt-20')}>
        <div className={cn('relative', aside ? 'lg:col-span-7' : 'lg:col-span-10')}>
          <p className="label flex items-center gap-2 text-volt">
            <span aria-hidden="true" className="inline-block size-2 bg-volt" />
            {kicker}
          </p>
          <h1 className={cn('h-display mt-5 max-w-[14ch] text-balance', compact ? 'text-[clamp(48px,8vw,104px)]' : 'text-h1')}>{title}</h1>
          <span lang="ja" aria-hidden="true" className="jp-sub mt-5 block text-paper">
            {jp}
          </span>
          <div className="mt-6 max-w-[58ch] text-[17px] leading-[1.6] text-tone-4 sm:text-[18px]">{intro}</div>
          {children && <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">{children}</div>}
          {sfx && (
            <span aria-hidden="true" className={cn('pointer-events-none absolute -top-2 right-0 hidden sm:block lg:-right-6', s.heroSfx)}>
              <Sfx text={sfx} size="md" tone="volt" rotate={8} />
            </span>
          )}
        </div>
        {aside && <div className={cn('relative lg:col-span-5 lg:pt-10', s.heroPanel)}>{aside}</div>}
      </div>
    </header>
  )
}

export default PageHero
