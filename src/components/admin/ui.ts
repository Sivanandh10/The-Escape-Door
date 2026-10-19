// Admin class helpers (P4a) — server- and client-safe. Keep every admin control on the same visual system.
//   <button className={adminBtn()}>Save</button>   <Link className={adminBtn({ variant: 'ghost', size: 'sm' })} …/>
import { cn } from '@/lib/utils'

export type AdminBtnVariant = 'primary' | 'ghost' | 'danger' | 'door' | 'quiet'
export type AdminBtnSize = 'sm' | 'md'

const VARIANT: Record<AdminBtnVariant, string> = {
  primary: 'bg-volt text-ink border-ink shadow-[4px_4px_0_var(--color-paper)] can-hover:hover:bg-volt-hot',
  door: 'bg-door text-paper border-ink shadow-[4px_4px_0_var(--color-volt)] can-hover:hover:brightness-110',
  ghost: 'bg-transparent text-paper border-paper/40 can-hover:hover:border-paper can-hover:hover:bg-paper/5',
  danger: 'bg-hype text-paper border-ink shadow-[4px_4px_0_var(--color-paper)] can-hover:hover:brightness-110',
  quiet: 'bg-transparent text-paper/75 border-transparent can-hover:hover:text-paper can-hover:hover:bg-paper/5',
}
const SIZE: Record<AdminBtnSize, string> = {
  sm: 'min-h-9 px-3 text-[11px] gap-1.5',
  md: 'min-h-11 px-4 text-xs gap-2',
}

/** Admin button classes. min-h-11 (44px) for md; sm (36px) only inside dense tables/toolbars on desktop. */
export function adminBtn({ variant = 'primary', size = 'md', className }: { variant?: AdminBtnVariant; size?: AdminBtnSize; className?: string } = {}) {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap border-2 font-mono font-bold uppercase tracking-[0.14em]',
    'transition-[translate,box-shadow,background-color,color,filter,border-color] duration-150 ease-(--ease-hover)',
    'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-ring',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:opacity-45',
    VARIANT[variant],
    SIZE[size],
    className,
  )
}

/** Text input / select / textarea classes for admin forms (dark panel, volt focus). */
export const adminInput =
  'w-full min-h-11 border-2 border-paper/25 bg-ink px-3 py-2 text-[15px] text-paper placeholder:text-paper/35 outline-none transition-colors duration-150 focus:border-volt focus-visible:outline-none aria-[invalid=true]:border-hype'

/** Small uppercase field label. */
export const adminLabel = 'label mb-1.5 block text-paper/70'

export type PillTone = 'volt' | 'lav' | 'pink' | 'door' | 'hype' | 'paper' | 'muted'
const PILL: Record<PillTone, string> = {
  volt: 'bg-volt text-ink border-ink',
  lav: 'bg-lav text-ink border-ink',
  pink: 'bg-pink text-ink border-ink',
  door: 'bg-door text-paper border-ink',
  hype: 'bg-hype text-paper border-ink',
  paper: 'bg-paper text-ink border-ink',
  muted: 'bg-tone-2 text-paper/80 border-paper/15',
}
/** Status chip classes (e.g. lead status). */
export function adminPill(tone: PillTone = 'muted', className?: string) {
  return cn('inline-flex items-center gap-1 border-2 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] leading-[1.4]', PILL[tone], className)
}
