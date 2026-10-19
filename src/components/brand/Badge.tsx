// RECREATION — replace with original vector files.
// Circle badge recreated from the brand's Instagram profile picture (docs/references/instagram-profile-390.png):
// cream circle, chunky 1970s lettering with a rust → orange grainy fill.
// Lettering: Spicy Rice (SIL OFL 1.1) converted to paths — no webfont dependency.
import { useId } from 'react'
import { SPICY } from './glyphs.generated'
import { placeWord, safeId } from './lettering'

export interface BadgeProps {
  /** rendered width/height in px (omit to size with CSS via className) */
  size?: number
  className?: string
  /** Accessible name. Pass '' to mark decorative (aria-hidden). */
  title?: string
  /** feTurbulence print grain on the lettering (default true) */
  grain?: boolean
  /** circle colour (default cream) */
  background?: string
}

export const BADGE_CREAM = '#F3EBDD'
export const BADGE_RUST = ['#AE3F27', '#BE4B2C', '#DC6A30'] as const

export function Badge({ size, className, title = 'The Escape Door', grain = true, background = BADGE_CREAM }: BadgeProps) {
  const uid = safeId(useId())
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  const s = 82
  const letters = [
    ...placeWord(SPICY.THE, { x: 150, y: 111, size: s, tracking: -3, align: 'middle', bounce: [3, 2.4], startIndex: 0 }),
    ...placeWord(SPICY.ESCAPE, { x: 150, y: 179, size: s, tracking: -3, align: 'middle', bounce: [3, 2.4], startIndex: 3 }),
    ...placeWord(SPICY.DOOR, { x: 151, y: 247, size: s, tracking: -3, align: 'middle', bounce: [3, 2.4], startIndex: 9 }),
  ]
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} className={className} {...a11y} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}-rust`} x1="40" y1="50" x2="260" y2="250" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BADGE_RUST[0]} />
          <stop offset=".5" stopColor={BADGE_RUST[1]} />
          <stop offset="1" stopColor={BADGE_RUST[2]} />
        </linearGradient>
        {grain && (
          <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="1.25" numOctaves="2" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.14  0 0 0 0 0.08  0 0 0 -4 1.9" result="dark" />
            <feComposite in="dark" in2="SourceGraphic" operator="in" result="darkIn" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.66  0 0 0 0 0.42  0 0 0 3.4 -2.05" result="light" />
            <feComposite in="light" in2="SourceGraphic" operator="in" result="lightIn" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="darkIn" />
              <feMergeNode in="lightIn" />
            </feMerge>
          </filter>
        )}
      </defs>
      <circle cx="150" cy="150" r="147" fill={background} stroke="#E0D3BE" strokeWidth="2" />
      <g fill={`url(#${uid}-rust)`} filter={grain ? `url(#${uid}-grain)` : undefined}>
        {letters.map((l) => (
          <path key={l.key} d={l.d} transform={l.t} />
        ))}
      </g>
    </svg>
  )
}

export default Badge
