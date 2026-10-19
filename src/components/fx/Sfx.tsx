// Manga onomatopoeia (ドン! ゴゴゴ バン! BAM!). Decorative only: aria-hidden. Owner: F1. Server-safe.
// Latin → Bangers, JP → Dela Gothic One. Skewed, ink stroke via paint-order, hard offset shadow.
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type SfxTone = 'ink' | 'volt' | 'hype' | 'paper' | 'lav' | 'pink' | 'door'

const FILL: Record<SfxTone, [fill: string, stroke: string, shadow: string]> = {
  volt: ['var(--color-volt)', 'var(--color-ink)', 'var(--color-ink)'],
  hype: ['var(--color-hype)', 'var(--color-ink)', 'var(--color-ink)'],
  paper: ['var(--color-paper)', 'var(--color-ink)', 'var(--color-ink)'],
  lav: ['var(--color-lav)', 'var(--color-ink)', 'var(--color-ink)'],
  pink: ['var(--color-pink)', 'var(--color-ink)', 'var(--color-ink)'],
  door: ['var(--color-door)', 'var(--color-ink)', 'var(--color-ink)'],
  ink: ['var(--color-ink)', 'var(--color-paper)', 'var(--color-volt)'],
}
const SIZE = { sm: '2rem', md: '3.5rem', lg: 'clamp(4rem, 9vw, 7.5rem)', xl: 'clamp(5.5rem, 16vw, 13rem)' }

export interface SfxProps {
  text: string
  /** force the Japanese face (auto-detected from kana/kanji when omitted) */
  jp?: boolean
  /** 'sm' | 'md' | 'lg' | 'xl' or a px number. Default 'lg' */
  size?: keyof typeof SIZE | number
  tone?: SfxTone
  /** degrees. Default -6 */
  rotate?: number
  /** pop in with a slam when it enters the viewport (CSS only; static under reduced motion) */
  pop?: boolean
  className?: string
  style?: CSSProperties
}

const JP_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/

export function Sfx({ text, jp, size = 'lg', tone = 'volt', rotate = -6, pop = false, className, style }: SfxProps) {
  const isJp = jp ?? JP_RE.test(text)
  const [fill, stroke, shadow] = FILL[tone]
  return (
    <span
      aria-hidden="true"
      className={cn('sfx', isJp ? 'font-sfx-jp' : 'font-sfx', pop && 'sfx-pop', className)}
      style={
        {
          fontSize: typeof size === 'number' ? `${size}px` : SIZE[size],
          '--sfx-rot': `${rotate}deg`,
          '--sfx-fill': fill,
          '--sfx-stroke': stroke,
          '--sfx-shadow': shadow,
          '--sfx-stroke-w': isJp ? '0.08em' : '0.1em',
          letterSpacing: isJp ? '-0.02em' : '0.02em',
          ...style,
        } as CSSProperties
      }
    >
      {text}
    </span>
  )
}

export default Sfx
