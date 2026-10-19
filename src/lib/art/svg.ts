// Tiny string helpers shared by every art builder (pure, no DOM).

export const INK = '#0B0B0F'
export const PAPER = '#F4EFE6'
export const VOLT = '#FFE14D'
export const HYPE = '#FF2D3D'
export const LAV = '#C9B8FF'
export const PINK = '#FFB8DE'
export const DOOR = '#6D3BFF'
export const TONE = ['#1A1A20', '#2B2B33', '#6E6E78', '#B9B5AC'] as const

/** Font stacks. Inline-SVG text resolves the CSS vars set by the site (F1 @theme) or by /lab/mockup. */
export const F = {
  display: 'var(--font-display, Anton), Anton, Impact, sans-serif',
  jp: "var(--font-jp, 'Noto Sans JP'), 'Noto Sans JP', sans-serif",
  sfxJp: "var(--font-sfx-jp, 'Dela Gothic One'), 'Dela Gothic One', sans-serif",
  mono: "var(--font-mono, 'JetBrains Mono'), 'JetBrains Mono', ui-monospace, monospace",
  hand: "var(--font-hand, Caveat), Caveat, 'Segoe Print', cursive",
} as const

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** round to 1 decimal for compact markup */
export const r1 = (n: number) => Math.round(n * 10) / 10

/** Anton average advance per cap (measured in Chromium: 26 caps @100px = 1231px). */
const ANTON_CAP = 0.474
const ANTON_SPACE = 0.234
export function antonWidth(text: string, size: number, tracking = 0): number {
  let w = 0
  for (const ch of text) w += ch === ' ' ? ANTON_SPACE : /[IJ1!.,:'’]/.test(ch) ? 0.26 : /[MW]/.test(ch) ? 0.62 : ANTON_CAP
  return (w + tracking * Math.max(0, text.length - 1)) * size
}

/** Font size that fits `text` into `maxW` (Anton), capped at `maxSize`. */
export function fitAnton(text: string, maxW: number, maxSize: number, tracking = 0): number {
  const w = antonWidth(text, 1, tracking)
  return Math.min(maxSize, maxW / Math.max(w, 0.01))
}

interface TextOpts {
  x: number
  y: number
  size: number
  fill?: string
  font?: string
  anchor?: 'start' | 'middle' | 'end'
  weight?: number | string
  tracking?: number // em
  stroke?: string
  strokeWidth?: number
  /** squeeze to exactly this width (only applied when the estimate overflows) */
  maxW?: number
  extra?: string
}

/** <text> with sensible defaults. Text is escaped. */
export function text(t: string, o: TextOpts): string {
  const font = o.font ?? F.display
  const attrs = [
    `x="${r1(o.x)}"`,
    `y="${r1(o.y)}"`,
    `font-size="${r1(o.size)}"`,
    `text-anchor="${o.anchor ?? 'start'}"`,
    `fill="${o.fill ?? INK}"`,
  ]
  if (o.weight) attrs.push(`font-weight="${o.weight}"`)
  if (o.tracking) attrs.push(`letter-spacing="${r1(o.tracking * o.size)}"`)
  if (o.stroke) attrs.push(`stroke="${o.stroke}" stroke-width="${r1(o.strokeWidth ?? 2)}" paint-order="stroke" stroke-linejoin="round"`)
  if (o.maxW && font === F.display && antonWidth(t, o.size, o.tracking ?? 0) > o.maxW)
    attrs.push(`textLength="${r1(o.maxW)}" lengthAdjust="spacingAndGlyphs"`)
  if (o.extra) attrs.push(o.extra)
  return `<text ${attrs.join(' ')} style="font-family:${font}">${esc(t)}</text>`
}

/** Split a title into balanced lines (max `max` lines). */
export function splitLines(title: string, max = 3): string[] {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (words.length <= 1 || max <= 1) return [words.join(' ')]
  if (words.length <= max) return words
  // greedy balance by character count
  const total = words.join(' ').length
  const target = total / max
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const nxt = cur ? `${cur} ${w}` : w
    if (cur && nxt.length > target * 1.15 && lines.length < max - 1) {
      lines.push(cur)
      cur = w
    } else cur = nxt
  }
  if (cur) lines.push(cur)
  return lines
}

/** Dot screentone pattern def. */
export function dotPattern(id: string, color: string, size = 8, r = 1.6, angle = 45, opacity = 1): string {
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}" opacity="${opacity}"/></pattern>`
}

/** Hatch (line) pattern def. */
export function hatchPattern(id: string, color: string, gap = 8, w = 1.4, angle = 45): string {
  return `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><rect width="${w}" height="${gap}" fill="${color}"/></pattern>`
}

/** Hard offset shadow filter (no blur — DESIGN §1). */
export function hardShadowFilter(id: string, dx: number, dy: number, color = INK, opacity = 1): string {
  return `<filter id="${id}" x="-10%" y="-10%" width="130%" height="130%" color-interpolation-filters="sRGB"><feFlood flood-color="${color}" flood-opacity="${opacity}"/><feComposite in2="SourceAlpha" operator="in"/><feOffset dx="${dx}" dy="${dy}" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
}

/** Regular polygon/star points. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, n: number, rot = -90): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner
    const a = ((rot + (i * 180) / n) * Math.PI) / 180
    pts.push(`${r1(cx + Math.cos(a) * rad)},${r1(cy + Math.sin(a) * rad)}`)
  }
  return pts.join(' ')
}

/** Mix two hex colours (t=0 -> a, t=1 -> b). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
export function parseHex(h: string): [number, number, number] {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  const n = parseInt(s.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** relative luminance 0..1 */
export function lum(h: string): number {
  const [r, g, b] = parseHex(h).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** ink or paper, whichever reads better on `bg` */
export const onColor = (bg: string) => (lum(bg) > 0.33 ? INK : PAPER)
