// S12 sub-fandom tiles: original typographic tiles + tiny original doodles (no logos, no characters).
// `f` values match the Beyond Anime product tags / collection.subFandoms slugs used by /arc/beyond-anime?f=.
import type { ReactNode } from 'react'

export interface FandomTile {
  f: string
  name: string
  jp: string
  line: string
  /** tile surface: bg / text / doodle stroke */
  bg: string
  fg: string
  doodle: ReactNode
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

// open book with ruled lines + a quotation mark
const Book = (
  <svg viewBox="0 0 120 90" className="s12-doodle s12-d-book">
    <path {...S} d="M10 20 Q35 10 60 22 Q85 10 110 20 V78 Q85 68 60 80 Q35 68 10 78 Z" />
    <path {...S} d="M60 22 V80" />
    <g className="s12-lines">
      <path {...S} strokeWidth={2} d="M20 34 H50 M20 44 H48 M20 54 H50 M70 34 H100 M72 44 H98 M70 54 H90" />
    </g>
    <path d="M86 58 q-6 2 -6 9 h6 v-7 z M96 58 q-6 2 -6 9 h6 v-7 z" fill="currentColor" />
  </svg>
)

// friendship-bracelet arc of beads, star beads in the middle
const Beads = (
  <svg viewBox="0 0 120 90" className="s12-doodle s12-d-beads">
    <path {...S} strokeWidth={2} d="M8 30 Q60 96 112 30" />
    {[
      [16, 42], [27, 53], [39, 61], [73, 61], [85, 53], [96, 42],
    ].map(([x, y]) => (
      <circle key={`${x}`} cx={x} cy={y} r="6" fill="var(--s12-tile-bg)" stroke="currentColor" strokeWidth="2.5" />
    ))}
    <path className="s12-star" d="M56 56 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill="currentColor" />
    <path className="s12-star s12-star-2" d="M100 14 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 z" fill="currentColor" />
  </svg>
)

// three floating candles with flames
const Candles = (
  <svg viewBox="0 0 120 90" className="s12-doodle s12-d-candles">
    {[
      [22, 34, 0], [58, 20, 1], [94, 38, 2],
    ].map(([x, y, i]) => (
      <g key={i} className={`s12-candle s12-candle-${i}`}>
        <rect x={x - 6} y={y} width="12" height="30" {...S} strokeWidth={2.5} />
        <path className="s12-flame" d={`M${x} ${y - 4} q-6 -8 0 -16 q6 8 0 16 z`} fill="var(--color-volt)" stroke="currentColor" strokeWidth="2" />
      </g>
    ))}
  </svg>
)

// lightstick with glow rings
const Lightstick = (
  <svg viewBox="0 0 120 90" className="s12-doodle s12-d-stick">
    <g className="s12-rings">
      <circle cx="60" cy="30" r="26" {...S} strokeWidth={2} strokeDasharray="4 6" />
      <circle cx="60" cy="30" r="36" {...S} strokeWidth={2} strokeDasharray="2 8" />
    </g>
    <circle cx="60" cy="30" r="15" fill="var(--color-paper)" stroke="currentColor" strokeWidth="3" />
    <path {...S} d="M54 44 L56 84 H64 L66 44" />
    <path {...S} strokeWidth={2} d="M57 58 H63 M57 66 H63" />
  </svg>
)

// chequered strip + speed lines
const Chequer = (
  <svg viewBox="0 0 120 90" className="s12-doodle s12-d-flag">
    <g className="s12-speed">
      <path {...S} strokeWidth={2} d="M4 22 H34 M10 34 H40 M2 46 H30 M12 58 H36" />
    </g>
    <g transform="translate(48 18) skewX(-12)">
      {Array.from({ length: 12 }, (_, i) => {
        const c = i % 4
        const r = Math.floor(i / 4)
        return (c + r) % 2 === 0 ? <rect key={i} x={c * 16} y={r * 16} width="16" height="16" fill="currentColor" /> : null
      })}
      <rect x="0" y="0" width="64" height="48" {...S} strokeWidth={2.5} />
    </g>
    <path {...S} d="M48 66 H112" strokeWidth={2} strokeDasharray="10 6" />
  </svg>
)

// toy box with a paper rocket and marbles
const ToyBox = (
  <svg viewBox="0 0 120 90" className="s12-doodle s12-d-toy">
    <path {...S} d="M24 50 H96 V84 H24 Z M24 50 L32 40 H88 L96 50" />
    <circle cx="44" cy="66" r="6" {...S} strokeWidth={2.5} />
    <circle cx="60" cy="70" r="5" fill="currentColor" />
    <circle cx="76" cy="66" r="6" {...S} strokeWidth={2.5} />
    <g className="s12-rocket">
      <path {...S} strokeWidth={2.5} d="M70 34 L92 8 L96 12 L74 38 Z M70 34 L64 34 L66 28 M74 38 L74 44 L80 42" />
    </g>
  </svg>
)

export const FANDOM_TILES: FandomTile[] = [
  {
    f: 'bookish', name: 'Bookish', jp: '本の虫', line: 'Jane Austen letters · margin notes',
    bg: 'var(--color-paper)', fg: 'var(--color-ink)', doodle: Book,
  },
  {
    f: 'swiftie', name: 'Swiftie', jp: 'キラキラ', line: 'Sparkle eras · bracelet beads',
    bg: 'var(--color-lav)', fg: 'var(--color-ink)', doodle: Beads,
  },
  {
    f: 'harry-potter', name: 'Wizard school', jp: '魔法学校', line: 'Candlelit castles · quills',
    bg: 'var(--color-ink)', fg: 'var(--color-paper)', doodle: Candles,
  },
  {
    f: 'k-pop', name: 'K-pop', jp: 'アンコール', line: 'Lightstick glow · encores',
    bg: 'var(--color-volt)', fg: 'var(--color-ink)', doodle: Lightstick,
  },
  {
    f: 'f1', name: 'F1', jp: '全開', line: 'Pit lanes · apex corners',
    bg: 'var(--color-door)', fg: 'var(--color-paper)', doodle: Chequer,
  },
  {
    f: 'pixar', name: 'Animated films', jp: 'アニメ映画', line: 'Pixar-inspired toy boxes',
    bg: 'var(--color-paper)', fg: 'var(--color-ink)', doodle: ToyBox,
  },
]

/** the rest of the Beyond Anime shelf (SITEMAP §beyond-anime chips) — text only */
export const ALSO_BEHIND = ['K-drama', 'Series', 'Games', 'Sports', 'Art', 'Coffee', 'Spiritual']
