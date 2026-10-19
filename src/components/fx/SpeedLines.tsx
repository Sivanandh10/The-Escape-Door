'use client'
// Manga speed lines (canvas). Radial wedges toward a focus point; intensity follows Lenis scroll velocity.
// Owner: F1. DPR capped at 1.5, ~30fps "inked" flicker only while visible and moving, static under reduced motion.
import { useEffect, useRef, type CSSProperties } from 'react'
import { useLowPower, useReducedMotion } from '@/lib/motion'
import { useScrollVelocity } from '@/components/motion/SmoothScroll'
import { cn, clamp, seeded } from '@/lib/utils'

export interface SpeedLinesProps {
  /** base intensity 0..1 (also the static/reduced-motion look). Default 0.35 */
  intensity?: number
  /** focus point in 0..1 of the box. Default { x: .5, y: .5 } */
  focus?: { x: number; y: number }
  /** CSS colour of the lines. Default paper */
  color?: string
  /** number of lines at full intensity. Default 110 */
  count?: number
  /** clear radius around the focus as a share of the half-diagonal. Default 0.3 */
  inner?: number
  /** add scroll velocity to the intensity. Default true */
  react?: boolean
  /** keep flickering even at rest (hero bursts). Default false */
  animated?: boolean
  seed?: number
  className?: string
  style?: CSSProperties
}

export function SpeedLines({
  intensity = 0.35,
  focus = { x: 0.5, y: 0.5 },
  color = '#f4efe6',
  count = 110,
  inner = 0.3,
  react = true,
  animated = false,
  seed = 7,
  className,
  style,
}: SpeedLinesProps) {
  const reduced = useReducedMotion()
  // perf: low-power devices get the static drawing only (no rAF loop)
  const lowPower = useLowPower()
  const still = reduced || lowPower
  const velocity = useScrollVelocity()
  const canvas = useRef<HTMLCanvasElement>(null)
  const fx = focus.x
  const fy = focus.y

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const base = seeded(seed)
    const lines = Array.from({ length: count }, () => ({
      a: base() * Math.PI * 2,
      w: 0.0025 + base() ** 2 * 0.018,
      s: base(),
      rank: base(),
    }))
    let W = 0
    let H = 0
    let dpr = 1
    let raf = 0
    let last = 0
    let visible = true
    let wasMoving = true
    let lastK = -1
    let flicker = seeded(seed * 31 + 1)

    const resize = () => {
      const r = cv.getBoundingClientRect()
      dpr = Math.min(1.5, window.devicePixelRatio || 1)
      W = Math.max(1, Math.round(r.width))
      H = Math.max(1, Math.round(r.height))
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      draw(intensity, false)
    }

    const draw = (k: number, jitter: boolean) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      if (k <= 0.01) return
      const cx = W * fx
      const cy = H * fy
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 4
      const clear = Math.hypot(W, H) * 0.5 * inner
      ctx.fillStyle = color
      ctx.beginPath()
      for (const l of lines) {
        if (l.rank > k) continue
        const j = jitter ? flicker() : l.s
        const start = clear * (1.35 - k * 0.45) + j * clear * 0.9
        const a = l.a + (jitter ? (flicker() - 0.5) * 0.01 : 0)
        const w = l.w * (0.6 + k * 0.8)
        const ex1 = cx + Math.cos(a - w) * R
        const ey1 = cy + Math.sin(a - w) * R
        const ex2 = cx + Math.cos(a + w) * R
        const ey2 = cy + Math.sin(a + w) * R
        ctx.moveTo(cx + Math.cos(a) * start, cy + Math.sin(a) * start)
        ctx.lineTo(ex1, ey1)
        ctx.lineTo(ex2, ey2)
        ctx.closePath()
      }
      ctx.fill()
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible) return
      if (t - last < 33) return // ~30fps: inked, not floaty
      last = t
      const v = react ? Math.abs(velocity.current) : 0
      const k = clamp(intensity + v * 0.05, 0, 1)
      const moving = animated || v > 0.3
      if (!moving && !wasMoving && Math.abs(k - lastK) < 0.005) return // at rest: nothing to repaint
      wasMoving = moving
      lastK = k
      draw(k, moving)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    resize()
    let io: IntersectionObserver | null = null
    if (!still) {
      io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting
        if (visible && !raf) raf = requestAnimationFrame(loop)
        if (!visible) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      })
      io.observe(cv)
    }
    return () => {
      ro.disconnect()
      io?.disconnect()
      cancelAnimationFrame(raf)
      flicker = () => 0
    }
  }, [intensity, fx, fy, color, count, inner, react, animated, seed, still, velocity])

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      style={style}
    />
  )
}

export default SpeedLines
