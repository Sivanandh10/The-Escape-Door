// Six original ink splats (procedural, deterministic — identical on server and client). Owner: F1. Server-safe.
// <InkSplat variant={3} className="w-40 text-volt" />  — fill = currentColor, decorative (aria-hidden).
import type { CSSProperties } from 'react'
import { seeded } from '@/lib/utils'

type Splat = { body: string; drops: Array<[cx: number, cy: number, r: number]> }

const SEEDS = [1907, 4421, 7703, 2593, 9187, 6151]

function closedCurve(pts: Array<[number, number]>): string {
  // Catmull-Rom → cubic Bézier, closed
  const n = pts.length
  const f = (v: number) => Math.round(v * 10) / 10
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

function makeSplat(seed: number): Splat {
  const rnd = seeded(seed)
  const cx = 100
  const cy = 100
  const r0 = 34 + rnd() * 8
  const waves = Array.from({ length: 3 }, () => ({ f: 2 + Math.floor(rnd() * 6), p: rnd() * Math.PI * 2, a: 0.05 + rnd() * 0.08 }))
  const armCount = 5 + Math.floor(rnd() * 5)
  const arms = Array.from({ length: armCount }, (_, i) => ({
    phi: (i / armCount) * Math.PI * 2 + (rnd() - 0.5) * 0.7,
    w: 0.06 + rnd() * 0.12,
    len: 14 + rnd() * 40,
  }))
  const N = 96
  const pts: Array<[number, number]> = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    let r = r0 * (1 + waves.reduce((s, w) => s + w.a * Math.sin(w.f * th + w.p), 0))
    for (const a of arms) {
      let d = th - a.phi
      d = Math.atan2(Math.sin(d), Math.cos(d))
      r += a.len * Math.exp(-((d / a.w) ** 2))
    }
    pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r])
  }
  const drops: Splat['drops'] = []
  for (const a of arms) {
    if (rnd() < 0.7) {
      const dist = r0 + a.len + 6 + rnd() * 18
      drops.push([cx + Math.cos(a.phi) * dist, cy + Math.sin(a.phi) * dist, 2 + rnd() * 5])
      if (rnd() < 0.5) {
        const d2 = dist + 8 + rnd() * 10
        drops.push([cx + Math.cos(a.phi + 0.05) * d2, cy + Math.sin(a.phi + 0.05) * d2, 1.2 + rnd() * 2.2])
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const th = rnd() * Math.PI * 2
    const dist = r0 + 10 + rnd() * 30
    drops.push([cx + Math.cos(th) * dist, cy + Math.sin(th) * dist, 1 + rnd() * 2])
  }
  // fit everything inside the 200×200 box (radius ≤ 96)
  let maxR = 0
  for (const [x, y] of pts) maxR = Math.max(maxR, Math.hypot(x - cx, y - cy))
  for (const [x, y, r] of drops) maxR = Math.max(maxR, Math.hypot(x - cx, y - cy) + r)
  const k = Math.min(1, 96 / maxR)
  const fit = (x: number, y: number): [number, number] => [cx + (x - cx) * k, cy + (y - cy) * k]
  return {
    body: closedCurve(pts.map(([x, y]) => fit(x, y))),
    drops: drops.map(([x, y, r]) => [...fit(x, y), r * k] as [number, number, number]),
  }
}

const SPLATS: Splat[] = SEEDS.map(makeSplat)

export interface InkSplatProps {
  /** 1..6 */
  variant?: 1 | 2 | 3 | 4 | 5 | 6
  /** CSS colour; default currentColor */
  color?: string
  /** degrees */
  rotate?: number
  className?: string
  style?: CSSProperties
}

export function InkSplat({ variant = 1, color, rotate = 0, className, style }: InkSplatProps) {
  const s = SPLATS[(variant - 1) % SPLATS.length]
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 200"
      className={className}
      style={{ color, transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}
    >
      <path d={s.body} fill="currentColor" />
      {s.drops.map(([x, y, r], i) => (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill="currentColor" />
      ))}
    </svg>
  )
}

export default InkSplat
