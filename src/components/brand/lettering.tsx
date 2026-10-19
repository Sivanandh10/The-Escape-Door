// Shared helpers for brand lettering rendered from pre-converted glyph outlines
// (see scripts/brand/build-glyphs.mjs). Pure functions — usable from Server Components.
import type { CSSProperties, ReactNode } from 'react'
import type { GlyphWord } from './glyphs.generated'

export const INK = '#0B0B0F'
export const PAPER = '#F4EFE6'

export interface PlacedLetter {
  key: string
  d: string
  /** SVG transform for this letter */
  t: string
  /** running index across the whole mark (for stagger) */
  i: number
}

export interface WordOpts {
  x: number
  /** baseline y */
  y: number
  /** font size in user units (glyph data is at 100) */
  size: number
  /** extra tracking in user units, added after each letter */
  tracking?: number
  /** scale for the first letter (comic "drop cap") */
  firstScale?: number
  /** deterministic per-letter bounce: [maxRotateDeg, maxYOffset] */
  bounce?: [number, number]
  /** align x as 'start' or 'middle' */
  align?: 'start' | 'middle'
  startIndex?: number
}

// Small deterministic pseudo-random (no Math.random → no hydration mismatch)
const wobble = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/** Measured width of a word with the given options (user units). */
export function wordWidth(word: GlyphWord, o: Pick<WordOpts, 'size' | 'tracking' | 'firstScale'>) {
  const k = o.size / 100
  const first = word.letters[0]
  const extraFirst = first ? first.w * k * ((o.firstScale ?? 1) - 1) : 0
  return word.width * k + extraFirst + (o.tracking ?? 0) * (word.letters.length - 1)
}

export function placeWord(word: GlyphWord, o: WordOpts): PlacedLetter[] {
  const k = o.size / 100
  const total = wordWidth(word, o)
  const x0 = o.align === 'middle' ? o.x - total / 2 : o.x
  const first = word.letters[0]
  const firstExtra = first ? first.w * k * ((o.firstScale ?? 1) - 1) : 0
  const out: PlacedLetter[] = []
  word.letters.forEach((l, idx) => {
    const s = idx === 0 ? (o.firstScale ?? 1) : 1
    const i = (o.startIndex ?? 0) + idx
    const x = x0 + l.x * k + (idx > 0 ? firstExtra : 0) + (o.tracking ?? 0) * idx
    let extra = ''
    if (o.bounce) {
      const [rot, dy] = o.bounce
      const cx = ((l.x1 + l.x2) / 2) * k * s
      const cy = ((l.y1 + l.y2) / 2) * k * s
      extra = ` translate(0 ${(wobble(i + 3) * dy).toFixed(2)}) rotate(${(wobble(i + 11) * rot).toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})`
    }
    out.push({ key: `${l.ch}${i}`, d: l.d, t: `translate(${x.toFixed(2)} ${o.y}) ${extra} scale(${(k * s).toFixed(4)})`, i })
  })
  return out
}

export interface InkTextProps {
  letters: PlacedLetter[]
  fill: string
  outline?: string
  /** outline stroke width in GLYPH units (font-size 100 space) — scales with the letter */
  outlineWidth?: number
  /** hard offset shadow [dx, dy] in user units */
  shadow?: [number, number]
  shadowColor?: string
  /** expose outline strokes for #24 stroke-draw */
  draw?: boolean
  fillProps?: Record<string, string | number>
}

/**
 * Comic lettering: (shadow) → outline strokes (data-draw, pathLength=1) → fills (data-fill).
 * All outlines are drawn before all fills so overlapping italic letters merge into one slab.
 */
export function InkText({ letters, fill, outline = INK, outlineWidth = 0, shadow, shadowColor = INK, draw, fillProps }: InkTextProps): ReactNode {
  return (
    <g>
      {shadow && (
        <g data-shadow="" transform={`translate(${shadow[0]} ${shadow[1]})`} fill={shadowColor} stroke={shadowColor} strokeWidth={outlineWidth} strokeLinejoin="round">
          {letters.map((l) => (
            <path key={l.key} d={l.d} transform={l.t} />
          ))}
        </g>
      )}
      {outlineWidth > 0 && (
        <g fill="none" stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round" strokeLinecap="round">
          {letters.map((l) => (
            <path key={l.key} d={l.d} transform={l.t} pathLength={1} data-draw="" style={draw ? ({ ['--i' as string]: l.i } as CSSProperties) : undefined} />
          ))}
        </g>
      )}
      <g fill={fill} {...fillProps}>
        {letters.map((l) => (
          <path key={l.key} d={l.d} transform={l.t} data-fill="" style={draw ? ({ ['--i' as string]: l.i } as CSSProperties) : undefined} />
        ))}
      </g>
    </g>
  )
}

/** CSS for the #24 stroke-draw entrance; scoped by a class on the root <svg>. */
export function drawCss(scope: string, opts: { drawDur?: number; stagger?: number; fillDelay?: number } = {}) {
  const { drawDur = 0.9, stagger = 0.05, fillDelay = 0.75 } = opts
  return `@media (prefers-reduced-motion: no-preference){
.${scope} [data-draw]{stroke-dasharray:1 1;stroke-dashoffset:1;animation:ted-draw ${drawDur}s cubic-bezier(.65,0,.35,1) forwards;animation-delay:calc(var(--i,0) * ${stagger}s)}
.${scope} [data-fill],.${scope} [data-shadow],.${scope} [data-pop]{opacity:0;animation:ted-fill .22s ease-out forwards;animation-delay:calc(${fillDelay}s + var(--i,0) * ${stagger}s)}
.${scope} [data-panel]{clip-path:inset(0 100% 0 0);animation:ted-wipe .55s cubic-bezier(.16,1,.3,1) forwards}
}
@keyframes ted-draw{to{stroke-dashoffset:0}}
@keyframes ted-fill{to{opacity:1}}
@keyframes ted-wipe{to{clip-path:inset(0 0 0 0)}}`
}

/** Turn React's useId() output into something safe for SVG ids / CSS class names. */
export const safeId = (id: string) => 'ted' + id.replace(/[^a-zA-Z0-9_-]/g, '')
