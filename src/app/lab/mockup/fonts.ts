// Webfonts for the mockup lab so inline-SVG text renders exactly in screenshots.
import { Anton, Caveat, Dela_Gothic_One, JetBrains_Mono, Noto_Sans_JP } from 'next/font/google'
import type { CSSProperties } from 'react'

const anton = Anton({ weight: '400', subsets: ['latin'], display: 'block' })
const dela = Dela_Gothic_One({ weight: '400', subsets: ['latin'], preload: false, display: 'block' })
const noto = Noto_Sans_JP({ weight: ['700', '900'], subsets: ['latin'], preload: false, display: 'block' })
const mono = JetBrains_Mono({ weight: ['500'], subsets: ['latin'], display: 'block' })
const hand = Caveat({ weight: ['600'], subsets: ['latin'], display: 'block' })

/** CSS vars consumed by src/lib/art (F.display, F.jp, …). */
export const artFontVars = {
  '--font-display': anton.style.fontFamily,
  '--font-sfx-jp': `${dela.style.fontFamily}, ${noto.style.fontFamily}`,
  '--font-jp': noto.style.fontFamily,
  '--font-mono': mono.style.fontFamily,
  '--font-hand': hand.style.fontFamily,
} as CSSProperties
