// RECREATION — replace with original vector files.
// Door-bracket wordmark recreated from the brand's Instagram (docs/references/instagram-post-01.png).
// Lettering is pre-converted to paths (no webfont dependency). Collage art is original.
import { useId } from 'react'
import { BANGERS, SPICY } from './glyphs.generated'
import { InkText, INK, drawCss, placeWord, safeId } from './lettering'
import { FullCollage, MiniCollage } from './collage'

export type WordmarkVariant = 'full' | 'bracket' | 'stacked' | 'inline'

export interface WordmarkProps {
  variant?: WordmarkVariant
  className?: string
  /** #24 stroke-draw entrance (CSS, plays once on mount, skipped for reduced motion). */
  animated?: boolean
  /** Accessible name. Pass '' to mark the logo decorative (aria-hidden). */
  title?: string
  /** stacked/inline only: letter fill (default white) */
  fill?: string
}

const WHITE = '#FFFFFF'

/** Geometry of each variant (exported so other components can size containers without layout shift). */
export const WORDMARK_VIEWBOX: Record<WordmarkVariant, [number, number]> = {
  full: [520, 440],
  bracket: [100, 100],
  stacked: [300, 236],
  inline: [712, 104],
}

function Bracket({ points, inner, sw, draw }: { points: string; inner: string; sw: number; draw?: boolean }) {
  return (
    <g>
      <polygon points={points} fill={WHITE} data-fill="" />
      <polygon points={inner} fill="#B9B5AC" data-fill="" />
      <polygon points={points} fill="none" stroke={INK} strokeWidth={sw} strokeLinejoin="miter" pathLength={1} data-draw="" style={draw ? { ['--i' as string]: 0 } : undefined} />
    </g>
  )
}

function BracketIcon({ uid, draw }: { uid: string; draw?: boolean }) {
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-bclip`}>
          <rect x="3" y="3" width="94" height="94" />
        </clipPath>
      </defs>
      <g data-panel="">
        <g clipPath={`url(#${uid}-bclip)`}>
          <MiniCollage />
        </g>
        <rect x="3" y="3" width="94" height="94" fill="none" stroke={INK} strokeWidth="6" />
      </g>
      <Bracket points="20,16 72,13 71,31 38,33 37,67 78,69 77,87 19,88" inner="38,33 44,38 43,63 37,67" sw={5} draw={draw} />
    </g>
  )
}

export function Wordmark({ variant = 'full', className, animated = false, title = 'The Escape Door', fill = WHITE }: WordmarkProps) {
  const uid = safeId(useId())
  const [w, h] = WORDMARK_VIEWBOX[variant]
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  const cls = [uid, className].filter(Boolean).join(' ')
  const style = animated ? <style>{drawCss(uid)}</style> : null

  if (variant === 'full') {
    const size = 100
    const the = placeWord(BANGERS.THE, { x: 204, y: 146, size, firstScale: 1.18, startIndex: 1 })
    const esc = placeWord(BANGERS.ESCAPE, { x: 170, y: 262, size, firstScale: 1.26, startIndex: 4 })
    const door = placeWord(BANGERS.DOOR, { x: 140, y: 378, size, firstScale: 1.2, startIndex: 10 })
    const panel = '30,42 300,28 412,34 416,148 482,156 474,300 426,304 432,412 228,420 34,408'
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={cls} {...a11y} xmlns="http://www.w3.org/2000/svg">
        {style}
        <defs>
          <clipPath id={`${uid}-clip`}>
            <polygon points={panel} />
          </clipPath>
        </defs>
        <g data-panel="">
          <polygon points={panel} transform="translate(8 8)" fill={INK} />
          <g clipPath={`url(#${uid}-clip)`}>
            <FullCollage id={uid} />
          </g>
          <polygon points={panel} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        </g>
        <Bracket points="56,62 190,54 188,96 104,100 102,350 224,356 222,398 54,404" inner="104,100 116,112 114,340 102,350" sw={9} draw={animated} />
        <g data-pop="" style={animated ? { ['--i' as string]: 6 } : undefined}>
          <circle cx="126" cy="300" r="9" fill={WHITE} stroke={INK} strokeWidth="4.5" />
        </g>
        <InkText letters={[...the, ...esc, ...door]} fill={WHITE} outlineWidth={17} shadow={[7, 7]} draw={animated} />
      </svg>
    )
  }

  if (variant === 'bracket') {
    return (
      <svg viewBox="0 0 100 100" className={cls} {...a11y} xmlns="http://www.w3.org/2000/svg">
        {style}
        <BracketIcon uid={uid} draw={animated} />
      </svg>
    )
  }

  if (variant === 'stacked') {
    const size = 76
    const lines = [SPICY.THE, SPICY.ESCAPE, SPICY.DOOR]
    const cx = w / 2
    const letters = lines.flatMap((word, li) =>
      placeWord(word, { x: cx, y: 70 + li * 70, size, tracking: -2, align: 'middle', bounce: [3.5, 2.2], startIndex: li * 6 }),
    )
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={cls} {...a11y} xmlns="http://www.w3.org/2000/svg">
        {style}
        <InkText letters={letters} fill={fill} outlineWidth={16} shadow={[5, 6]} draw={animated} />
      </svg>
    )
  }

  // inline — mini bracket + one-line lettering
  const size = 100
  const text = placeWord(BANGERS['THE ESCAPE DOOR'], { x: 118, y: 90, size, startIndex: 1 })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cls} {...a11y} xmlns="http://www.w3.org/2000/svg">
      {style}
      <BracketIcon uid={uid} draw={animated} />
      <InkText letters={text} fill={WHITE} outlineWidth={15} shadow={[5, 5]} draw={animated} />
    </svg>
  )
}

export default Wordmark
