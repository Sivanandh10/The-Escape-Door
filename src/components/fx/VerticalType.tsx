// Vertical stacked condensed-caps rail (#47 type-as-image). Decorative: aria-hidden. Owner: F1. Server-safe.
// Shown from lg (≥1024px) by default — DESIGN §9 "vertical wordmark rails on ≥ 1024 px".
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export interface VerticalTypeProps {
  text: string
  /** which edge it sits on: left reads bottom→top, right reads top→bottom. Default 'left' */
  side?: 'left' | 'right'
  /** outlined instead of filled */
  outline?: boolean
  /** repeat the text N times with a ✦ separator. Default 2 */
  repeat?: number
  /** font size (CSS). Default clamp(48px, 6vw, 96px) */
  size?: string
  /** optional JP line set beside the caps */
  jp?: string
  /** show below lg as well */
  always?: boolean
  className?: string
  style?: CSSProperties
}

export function VerticalType({
  text,
  side = 'left',
  outline = false,
  repeat = 2,
  size = 'clamp(48px, 6vw, 96px)',
  jp,
  always = false,
  className,
  style,
}: VerticalTypeProps) {
  const runs = Array.from({ length: Math.max(1, repeat) }, () => text)
  // Outer box stays horizontal-tb so positioning classes (inset-y-0, right-4, top-0 …) mean what they say;
  // only the inner rail switches writing-mode (logical insets would otherwise flip axes).
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none select-none overflow-hidden', always ? 'flex' : 'hidden lg:flex', className)}
      style={style}
    >
      <div
        className="flex h-full items-center gap-3 whitespace-nowrap"
        style={{ writingMode: 'vertical-rl', transform: side === 'left' ? 'rotate(180deg)' : undefined }}
      >
      <span
        className={cn('font-display uppercase leading-[0.82] tracking-[-0.01em]', outline && 'outline-text')}
        style={{ fontSize: size }}
      >
        {runs.join('  ✦  ')}
      </span>
      {jp && (
        <span lang="ja" className="jp-sub" style={{ writingMode: 'vertical-rl' }}>
          {jp}
        </span>
      )}
      </div>
    </div>
  )
}

export default VerticalType
