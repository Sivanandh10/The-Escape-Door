// Paper grain overlay: tiny generated feTurbulence noise as a data-uri (no network). Owner: F1. Server-safe.
import { cn } from '@/lib/utils'

export interface PaperGrainProps {
  /** layer opacity 0..1 (the noise tile is already 50% alpha). Default 0.35 ≈ DESIGN's subtle 4–6% grain */
  opacity?: number
  /** 'multiply' darkens light paper; 'screen' lifts ink. Default multiply */
  blend?: 'multiply' | 'screen' | 'overlay'
  className?: string
}

export function PaperGrain({ opacity = 0.35, blend = 'multiply', className }: PaperGrainProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 block', className)}
      style={{
        backgroundImage: 'var(--grain)',
        backgroundSize: '160px 160px',
        opacity,
        mixBlendMode: blend,
        filter: blend === 'screen' ? 'invert(1)' : undefined,
      }}
    />
  )
}

export default PaperGrain
