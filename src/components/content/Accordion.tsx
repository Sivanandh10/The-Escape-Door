'use client'
// #49 Smooth FAQ accordion. Owner: P5.
// grid-template-rows 0fr → 1fr (no JS measuring), .45s cubic-bezier(.65,0,.35,1), "+" rotates 45°,
// only one open at a time. Answers stay in the DOM (crawlable / citable); closed panels are `inert`.
// Feedback < 100 ms: the row slams into its shadow on press, the Q-chip flips to volt instantly.
import Link from 'next/link'
import { useId, useState, type ReactNode } from 'react'
import { ArrowUpRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { splitAccent, type FaqItem } from './faq'
import s from './content.module.css'

export interface AccordionProps {
  items: FaqItem[]
  /** heading level for each question (h2 on /faq — question H2s; h3 inside a section) */
  level?: 2 | 3
  /** index open on first render (-1 = all closed). Default 0 */
  defaultOpen?: number
  /** 'paper' rows on ink, or 'ink' rows on paper */
  tone?: 'paper' | 'ink'
  /** number offset for the Q.01 chips */
  startAt?: number
  className?: string
}

export function Accordion({ items, level = 3, defaultOpen = 0, tone = 'paper', startAt = 1, className }: AccordionProps) {
  const uid = useId()
  const [open, setOpen] = useState(defaultOpen)
  const H = (level === 2 ? 'h2' : 'h3') as 'h2' | 'h3'

  return (
    <div className={cn('flex flex-col gap-3 sm:gap-4', className)}>
      {items.map((item, i) => {
        const isOpen = open === i
        const [pre, acc, post] = splitAccent(item.q, item.accent)
        const btnId = `${uid}-b${i}`
        const panelId = `${uid}-p${i}`
        return (
          <div
            key={item.id}
            id={item.id}
            className={cn(
              s.row,
              'scroll-mt-28 border-[3px] sm:border-4',
              tone === 'paper' ? 'border-ink bg-paper text-ink' : 'border-paper bg-ink text-paper',
              isOpen ? (tone === 'paper' ? 'shadow-[6px_6px_0_0_var(--color-volt)]' : 'shadow-[6px_6px_0_0_var(--color-volt)]') : tone === 'paper' ? 'shadow-hard-sm' : 'shadow-[4px_4px_0_0_var(--color-tone-2)]',
            )}
            data-open={isOpen || undefined}
          >
            <H className="m-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="press focus-ring group flex min-h-16 w-full items-start gap-3 px-4 py-4 text-left sm:gap-5 sm:px-6 sm:py-5"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'label mt-1 shrink-0 border-2 px-1.5 py-1 tabular-nums transition-colors duration-150',
                    tone === 'paper' ? 'border-ink' : 'border-paper',
                    isOpen ? 'bg-volt text-ink' : tone === 'paper' ? 'bg-ink text-paper' : 'bg-paper text-ink',
                  )}
                >
                  Q.{String(startAt + i).padStart(2, '0')}
                </span>
                <span className="font-display flex-1 text-[22px] uppercase leading-[1.02] tracking-[-0.005em] sm:text-[28px] lg:text-[32px]">
                  {pre}
                  {acc && <em className={cn('accent', tone === 'ink' && 'accent-lav')}>{acc}</em>}
                  {post}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    s.plus,
                    'grid size-10 shrink-0 place-items-center border-[3px] transition-colors duration-150 sm:size-11',
                    tone === 'paper' ? 'border-ink' : 'border-paper',
                    isOpen ? 'bg-volt text-ink' : 'can-hover:group-hover:bg-volt can-hover:group-hover:text-ink',
                  )}
                >
                  <Plus className="size-5" strokeWidth={3} />
                </span>
              </button>
            </H>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              inert={!isOpen}
              className={s.panel}
            >
              <div className="min-h-0 overflow-hidden">
                <div className={cn('px-4 pb-5 sm:px-6 sm:pb-6 sm:pl-[92px]', s.answer)}>
                  <p className="max-w-[68ch] text-[16px] leading-[1.6] sm:text-[17px]">{item.a}</p>
                  {(item.more || item.link) && (
                    <p className={cn('mt-3 max-w-[68ch] text-[15px]', tone === 'paper' ? 'text-tone-2' : 'text-tone-4')}>
                      {item.more}{' '}
                      {item.link && <AnswerLink href={item.link.href}>{item.link.label}</AnswerLink>}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AnswerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center gap-1 font-semibold underline decoration-2 underline-offset-4 transition-colors duration-150 hover:text-door"
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-4" />
    </Link>
  )
}

export default Accordion
