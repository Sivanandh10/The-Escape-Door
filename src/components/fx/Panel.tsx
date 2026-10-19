// Manga panel: thick ink border, flat colour block, optional diagonal gutter (clip-path). Owner: F1. Server-safe.
// <Panel tone="volt" slant="right" shadow="ink">…</Panel>
// Slanted panels draw the border as an ink frame behind an inset content layer (clip-path cuts real borders),
// and the hard shadow is a drop-shadow filter on the wrapper so it follows the diagonal.
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type PanelTone = 'paper' | 'ink' | 'volt' | 'lav' | 'pink' | 'door' | 'arc' | 'none'
type Shadow = 'none' | 'ink' | 'volt' | 'paper' | 'door'

const TONE: Record<PanelTone, string> = {
  paper: 'bg-paper text-ink grain',
  ink: 'bg-ink text-paper',
  volt: 'bg-volt text-ink',
  lav: 'bg-lav text-ink',
  pink: 'bg-pink text-ink',
  door: 'bg-door text-paper',
  arc: 'bg-arc-a text-paper',
  none: '',
}
const BORDER: Record<PanelTone, string> = {
  paper: 'var(--color-ink)',
  ink: 'var(--color-paper)',
  volt: 'var(--color-ink)',
  lav: 'var(--color-ink)',
  pink: 'var(--color-ink)',
  door: 'var(--color-ink)',
  arc: 'var(--color-ink)',
  none: 'var(--color-ink)',
}
const SHADOW: Record<Shadow, string | undefined> = {
  none: undefined,
  ink: 'var(--color-ink)',
  volt: 'var(--color-volt)',
  paper: 'var(--color-paper)',
  door: 'var(--color-door)',
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  as?: ElementType
  tone?: PanelTone
  /** diagonal gutter on the left or right edge */
  slant?: 'none' | 'left' | 'right'
  /** horizontal size of the diagonal cut. Default '14%' */
  slantSize?: string
  /** hard offset shadow colour. Default 'none' */
  shadow?: Shadow
  /** border width in px. Default 4 */
  border?: number
  /** override the border colour (CSS colour / var) */
  borderColor?: string
  children?: ReactNode
  /** classes for the inner content layer (padding etc.). Applied to the panel itself when slant='none' */
  innerClassName?: string
}

function clipFor(slant: 'left' | 'right', s: string) {
  return slant === 'right'
    ? `polygon(0 0, 100% 0, calc(100% - ${s}) 100%, 0 100%)`
    : `polygon(${s} 0, 100% 0, 100% 100%, 0 100%)`
}

export function Panel({
  as: Tag = 'div',
  tone = 'paper',
  slant = 'none',
  slantSize = '14%',
  shadow = 'none',
  border = 4,
  borderColor,
  className,
  innerClassName,
  style,
  children,
  ...rest
}: PanelProps) {
  const bc = borderColor ?? BORDER[tone]
  const sc = SHADOW[shadow]

  if (slant === 'none') {
    return (
      <Tag
        className={cn('relative', TONE[tone], className, innerClassName)}
        style={{
          border: `${border}px solid ${bc}`,
          borderRadius: 2,
          boxShadow: sc ? `6px 6px 0 0 ${sc}` : undefined,
          ...style,
        }}
        {...rest}
      >
        {children}
      </Tag>
    )
  }

  const clip = clipFor(slant, slantSize)
  return (
    <Tag
      className={cn('relative', className)}
      style={{ filter: sc ? `drop-shadow(6px 6px 0 ${sc})` : undefined, ...style } as CSSProperties}
      {...rest}
    >
      <div aria-hidden="true" className="absolute inset-0" style={{ background: bc, clipPath: clip }} />
      <div
        className={cn('relative h-full', TONE[tone], innerClassName)}
        style={{ margin: border, clipPath: clip, minHeight: `calc(100% - ${border * 2}px)` }}
      >
        {children}
      </div>
    </Tag>
  )
}

export default Panel
