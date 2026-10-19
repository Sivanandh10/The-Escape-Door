// Original manga-panel collage used inside the door-bracket wordmark.
// Abstract only: screentone, speed lines, focus lines, ink shards and a tiny open door with light.
// No characters, no franchise symbols. Deterministic (no Math.random).
import type { ReactNode } from 'react'

export const LAV = {
  base: '#A88EE0',
  mid: '#8A6CCF',
  ink: '#2A1650',
  light: '#E4DAFB',
}

const rnd = (n: number) => {
  const s = Math.sin(n * 91.345 + 47.853) * 24634.6345
  return s - Math.floor(s)
}

/** Halftone dots that grow toward (fx, fy) inside a rectangle. */
function halftone(x0: number, y0: number, x1: number, y1: number, step: number, fx: number, fy: number, maxR: number, fill: string, reach: number) {
  const out: ReactNode[] = []
  let k = 0
  for (let y = y0; y <= y1; y += step) {
    const odd = Math.round((y - y0) / step) % 2
    for (let x = x0 + (odd ? step / 2 : 0); x <= x1; x += step) {
      const dist = Math.hypot(x - fx, y - fy)
      const r = maxR * Math.max(0, 1 - dist / reach)
      if (r > 0.35) out.push(<circle key={k++} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)} fill={fill} />)
    }
  }
  return out
}

/** Thin radiating wedges (manga focus lines) around (cx, cy). */
function focusLines(cx: number, cy: number, inner: number, outer: number, count: number, fill: string, seed = 1, maxW = 0.05) {
  const out: ReactNode[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd(i + seed) * 0.12
    const w = 0.012 + rnd(i * 3 + seed) * maxW
    const r0 = inner + rnd(i * 7 + seed) * inner * 0.8
    const p = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`
    out.push(<polygon key={i} points={`${p(a - w, outer)} ${p(a + w, outer)} ${p(a, r0)}`} fill={fill} />)
  }
  return out
}

/** Horizontal speed lines entering from the right edge. */
function speedLines(x0: number, x1: number, y0: number, y1: number, count: number, stroke: string, seed = 5) {
  const out: ReactNode[] = []
  for (let i = 0; i < count; i++) {
    const y = y0 + ((i + rnd(i + seed) * 0.6) / count) * (y1 - y0)
    const len = (0.35 + rnd(i * 5 + seed) * 0.65) * (x1 - x0)
    const w = 0.8 + rnd(i * 11 + seed) * 2.6
    out.push(<path key={i} d={`M${x1} ${y.toFixed(1)}H${(x1 - len).toFixed(1)}`} stroke={stroke} strokeWidth={w.toFixed(2)} strokeLinecap="round" />)
  }
  return out
}

/** Full collage for the 520×440 wordmark. Must be rendered inside a clip to the panel shape. */
export function FullCollage({ id }: { id: string }) {
  const door = { x: 120, y: 182, w: 30, h: 46 }
  return (
    <g>
      <defs>
        <pattern id={`${id}-dots`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.5" fill={LAV.ink} />
        </pattern>
        <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <path d="M0 0V7" stroke={LAV.ink} strokeWidth="1.4" />
        </pattern>
      </defs>
      <rect width="520" height="440" fill={LAV.base} />

      {/* A — top-left: halftone storm */}
      <rect x="0" y="0" width="190" height="160" fill={`url(#${id}-dots)`} opacity=".55" />
      {halftone(0, 0, 190, 160, 9, 20, 20, 5.2, LAV.ink, 190)}

      {/* B — top-right: speed lines */}
      <rect x="190" y="0" width="330" height="152" fill={LAV.light} />
      <g>{speedLines(190, 520, 6, 148, 22, LAV.ink)}</g>

      {/* C — big left panel: focus lines on a tiny open door spilling light */}
      <g>{focusLines(door.x + door.w / 2, door.y + door.h / 2, 46, 330, 64, LAV.ink, 2)}</g>
      <polygon points={`${door.x},${door.y + door.h} ${door.x + door.w},${door.y + door.h} ${door.x + door.w + 70},330 ${door.x - 18},330`} fill={LAV.light} opacity=".9" />
      <rect x={door.x - 5} y={door.y - 5} width={door.w + 10} height={door.h + 5} fill={LAV.ink} />
      <rect x={door.x} y={door.y} width={door.w} height={door.h} fill="#FFFFFF" />
      <polygon points={`${door.x},${door.y} ${door.x - 13},${door.y - 7} ${door.x - 13},${door.y + door.h + 7} ${door.x},${door.y + door.h}`} fill={LAV.mid} stroke={LAV.ink} strokeWidth="3" strokeLinejoin="round" />
      <circle cx={door.x - 9} cy={door.y + door.h / 2 + 3} r="1.8" fill={LAV.ink} />

      {/* D — right band: dark panel with ink shards */}
      <polygon points="262,160 520,150 520,300 248,308" fill={LAV.ink} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 280 + i * 34 + rnd(i) * 10
        const h = 60 + rnd(i + 9) * 70
        return <polygon key={i} points={`${x},304 ${x + 9},${304 - h} ${x + 20},304`} fill={LAV.mid} />
      })}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 300 + i * 44
        const h = 40 + rnd(i + 21) * 50
        return <polygon key={`b${i}`} points={`${x},158 ${x + 8},${158 + h} ${x + 18},158`} fill={LAV.mid} opacity=".7" />
      })}

      {/* E — bottom-right: hatching + halftone */}
      <polygon points="232,312 520,302 520,440 210,440" fill={LAV.base} />
      <polygon points="232,312 520,302 520,440 210,440" fill={`url(#${id}-hatch)`} opacity=".55" />
      {halftone(220, 316, 520, 440, 11, 470, 420, 5.5, LAV.ink, 220)}

      {/* gutters */}
      <g stroke={LAV.ink} strokeWidth="6" fill="none" strokeLinejoin="round">
        <path d="M0 160L190 156V0" />
        <path d="M190 152L520 146" />
        <path d="M262 160L248 308L520 300" />
        <path d="M250 308L232 312L210 440" />
      </g>
    </g>
  )
}

/** Simplified collage for the 100×100 bracket icon (readable at 16–48px):
 *  the bracket is the door frame; the door leaf hangs open on the right and light pours out. */
export function MiniCollage({ light = '#FFE14D' }: { light?: string }) {
  return (
    <g>
      <rect width="100" height="100" fill={LAV.base} />
      <g>{focusLines(57, 50, 10, 95, 18, LAV.ink, 4, 0.05)}</g>
      <rect x="34" y="29" width="46" height="42" fill={light} />
      <polygon points="78,29 93,21 93,79 78,71" fill={LAV.ink} />
      <circle cx="89" cy="52" r="2.6" fill={light} />
    </g>
  )
}
