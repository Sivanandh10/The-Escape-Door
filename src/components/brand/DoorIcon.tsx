// Small door glyph for the header cart button. Original. Server-safe (no hooks).
// <DoorIcon open={0..1} /> — the leaf swings on its left hinge (CSS transform, 260ms spring-ish),
// light (volt) shows through the gap. Lines use currentColor so it inherits the button colour.
import type { CSSProperties } from 'react'

export interface DoorIconProps {
  /** 0 = closed, 1 = wide open. Changes animate (reduced motion: instant). */
  open?: number
  /** px (default 24) */
  size?: number
  className?: string
  strokeWidth?: number
  /** colour of the light behind the door (default volt) */
  light?: string
  /** leaf fill (default transparent → background shows) */
  leaf?: string
  /** Accessible name; omit/'' → aria-hidden (the button should carry the label). */
  title?: string
}

export function DoorIcon({ open = 0, size = 24, className, strokeWidth = 2, light = 'var(--color-volt, #FFE14D)', leaf = 'none', title }: DoorIconProps) {
  const o = Math.max(0, Math.min(1, open))
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  const style = { ['--o' as string]: o } as CSSProperties
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className} style={style} {...a11y} xmlns="http://www.w3.org/2000/svg">
      <style>{`
.ted-door-leaf{transform-box:view-box;transform-origin:6.5px 12px;transform:scaleX(cos(calc(var(--o) * 72deg))) skewY(calc(var(--o) * -6deg));transition:transform .26s cubic-bezier(.34,1.56,.64,1)}
.ted-door-light{opacity:calc(var(--o) * 3);transition:opacity .2s ease-out}
@media (prefers-reduced-motion:reduce){.ted-door-leaf,.ted-door-light{transition:none}}
`}</style>
      {/* light inside the frame */}
      <path className="ted-door-light" d="M6.5 21V8.5a5.5 5.5 0 0 1 11 0V21Z" fill={light} />
      {/* leaf */}
      <g className="ted-door-leaf">
        <path d="M6.5 21V8.5a5.5 5.5 0 0 1 11 0V21Z" fill={leaf} stroke="currentColor" strokeWidth={strokeWidth * 0.8} strokeLinejoin="round" />
        <circle cx="15" cy="14" r="1.1" fill="currentColor" />
      </g>
      {/* frame + threshold */}
      <path d="M4 21.5V8.5a8 8 0 0 1 16 0v13" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2.5 21.5h19" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

export default DoorIcon
