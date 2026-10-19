// Screentone dot layer (absolute, decorative). Owner: F1. Server-safe.
// <Screentone density="mid" color="var(--color-paper)" opacity={0.2} fade="bottom" drift />
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type ToneDensity = 'light' | 'mid' | 'dense'

const TILE: Record<ToneDensity, [string, string]> = {
  light: ['var(--tone-light)', '10px 10px'],
  mid: ['var(--tone-mid)', '8px 8px'],
  dense: ['var(--tone-dense)', '6px 6px'],
}
const FADE: Record<string, string> = {
  top: 'linear-gradient(to bottom, #000, transparent)',
  bottom: 'linear-gradient(to top, #000, transparent)',
  left: 'linear-gradient(to right, #000, transparent)',
  right: 'linear-gradient(to left, #000, transparent)',
  radial: 'radial-gradient(closest-side, #000, transparent)',
  edge: 'radial-gradient(closest-side, transparent 55%, #000)',
}

export interface ScreentoneProps {
  density?: ToneDensity
  /** dot colour (any CSS colour / var). Default currentColor */
  color?: string
  /** 0..1. Default 0.35 */
  opacity?: number
  /** fade the dots out toward one side (manga shading). */
  fade?: 'none' | 'top' | 'bottom' | 'left' | 'right' | 'radial' | 'edge'
  /** slow idle drift (respects reduced motion via the global rule) */
  drift?: boolean
  /** scale the tile (1 = default size) */
  scale?: number
  className?: string
  style?: CSSProperties
}

export function Screentone({
  density = 'mid',
  color = 'currentColor',
  opacity = 0.35,
  fade = 'none',
  drift = false,
  scale = 1,
  className,
  style,
}: ScreentoneProps) {
  const [tile, size] = TILE[density]
  const sz = size
    .split(' ')
    .map((v) => `${parseFloat(v) * scale}px`)
    .join(' ')
  const masks = fade === 'none' ? `${tile}` : `${tile}, ${FADE[fade]}`
  const sizes = fade === 'none' ? sz : `${sz}, 100% 100%`
  const repeats = fade === 'none' ? 'repeat' : 'repeat, no-repeat'
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 block', drift && 'animate-tone-drift', className)}
      style={{
        background: color,
        opacity,
        WebkitMaskImage: masks,
        maskImage: masks,
        WebkitMaskSize: sizes,
        maskSize: sizes,
        WebkitMaskRepeat: repeats,
        maskRepeat: repeats,
        WebkitMaskComposite: fade === 'none' ? undefined : 'source-in',
        maskComposite: fade === 'none' ? undefined : 'intersect',
        ...(drift ? { animationName: 'ted-tone-mask-drift' } : null),
        ...style,
      }}
    />
  )
}

export default Screentone
