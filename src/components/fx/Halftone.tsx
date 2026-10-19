'use client'
// #58 Halftone (canvas). Dot screens replace gradients (DESIGN §1).
// Owner: F1. Draws once per resize (static), or forms from scattered dots on first view (`form`).
//   <Halftone shape="radial" color="var(--color-volt)" />                 shading blob
//   <Halftone shape="linear" from="bottom" color="var(--color-door)" />    tone fade
//   <Halftone src="/mockups/x-front.webp" color="var(--color-ink)" />    image → dot screen (same-origin)
import { useEffect, useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { cn, seeded } from '@/lib/utils'

export interface HalftoneProps {
  /** same-origin image to convert into a dot screen */
  src?: string
  /** dot colour (any CSS colour / var). Default currentColor */
  color?: string
  /** cell size in px. Default 9 */
  dotSize?: number
  /** screen angle in degrees. Default 18 */
  angle?: number
  /** tone source when no src: 'radial' (centre heavy), 'linear', or 'flat'. Default 'radial' */
  shape?: 'radial' | 'linear' | 'flat'
  /** for shape="linear": where the heavy end sits. Default 'bottom' */
  from?: 'top' | 'bottom' | 'left' | 'right'
  /** 0..1 tone for shape="flat". Default 0.5 */
  amount?: number
  /** swap light/dark */
  invert?: boolean
  /** dots fly in from a scatter and form the image on first view (#58). Default false */
  form?: boolean
  className?: string
  style?: CSSProperties
}

export function Halftone({
  src,
  color = 'currentColor',
  dotSize = 9,
  angle = 18,
  shape = 'radial',
  from = 'bottom',
  amount = 0.5,
  invert = false,
  form = false,
  className,
  style,
}: HalftoneProps) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    registerGsap()
    let W = 0
    let H = 0
    let dpr = 1
    let img: HTMLImageElement | null = null
    let sample: ImageData | null = null
    let dots: Array<{ x: number; y: number; r: number; sx: number; sy: number }> = []
    const prog = { p: form && !prefersReducedMotion() ? 0 : 1 }
    let tween: gsap.core.Tween | null = null
    let dead = false

    const toneAt = (x: number, y: number): number => {
      let v: number
      if (sample) {
        const sx = Math.min(sample.width - 1, Math.max(0, Math.floor((x / W) * sample.width)))
        const sy = Math.min(sample.height - 1, Math.max(0, Math.floor((y / H) * sample.height)))
        const i = (sy * sample.width + sx) * 4
        const lum = (0.2126 * sample.data[i] + 0.7152 * sample.data[i + 1] + 0.0722 * sample.data[i + 2]) / 255
        v = (1 - lum) * (sample.data[i + 3] / 255)
      } else if (shape === 'flat') v = amount
      else if (shape === 'linear') {
        const t = from === 'bottom' ? y / H : from === 'top' ? 1 - y / H : from === 'right' ? x / W : 1 - x / W
        v = t ** 1.4
      } else {
        const d = Math.hypot(x / W - 0.5, y / H - 0.5) / 0.7071
        v = 1 - Math.min(1, d) ** 0.9
      }
      return invert ? 1 - v : v
    }

    const build = () => {
      const rnd = seeded(dotSize * 131 + angle)
      const a = (angle * Math.PI) / 180
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      const diag = Math.hypot(W, H)
      const out: typeof dots = []
      const max = dotSize * 0.62
      for (let gy = -diag / 2; gy < diag / 2; gy += dotSize) {
        for (let gx = -diag / 2; gx < diag / 2; gx += dotSize) {
          const x = W / 2 + gx * cos - gy * sin
          const y = H / 2 + gx * sin + gy * cos
          if (x < -dotSize || y < -dotSize || x > W + dotSize || y > H + dotSize) continue
          const r = toneAt(Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y))) * max
          if (r < 0.35) continue
          out.push({ x, y, r, sx: rnd() * W, sy: rnd() * H })
        }
      }
      dots = out
    }

    const draw = () => {
      const p = prog.p
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = getComputedStyle(cv).color
      ctx.beginPath()
      for (const d of dots) {
        const x = p >= 1 ? d.x : d.sx + (d.x - d.sx) * p
        const y = p >= 1 ? d.y : d.sy + (d.y - d.sy) * p
        const r = p >= 1 ? d.r : d.r * (0.4 + 0.6 * p)
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, Math.PI * 2)
      }
      ctx.fill()
    }

    const resize = () => {
      const rect = cv.getBoundingClientRect()
      dpr = Math.min(1.5, window.devicePixelRatio || 1)
      W = Math.max(1, Math.round(rect.width))
      H = Math.max(1, Math.round(rect.height))
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      if (img && img.complete && img.naturalWidth) {
        // cover-fit the image into a small sampling canvas
        const s = document.createElement('canvas')
        s.width = Math.max(1, Math.round(W / dotSize))
        s.height = Math.max(1, Math.round(H / dotSize))
        const sc = s.getContext('2d', { willReadFrequently: true })
        if (sc) {
          const k = Math.max(s.width / img.naturalWidth, s.height / img.naturalHeight)
          const dw = img.naturalWidth * k
          const dh = img.naturalHeight * k
          sc.drawImage(img, (s.width - dw) / 2, (s.height - dh) / 2, dw, dh)
          try {
            sample = sc.getImageData(0, 0, s.width, s.height)
          } catch {
            sample = null
          }
        }
      }
      build()
      draw()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    if (src) {
      img = new Image()
      img.decoding = 'async'
      img.onload = () => !dead && resize()
      img.src = src
    }

    let io: IntersectionObserver | null = null
    if (prog.p < 1) {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting || tween) return
          tween = gsap.to(prog, { p: 1, duration: 1.4, ease: 'expo.inOut', onUpdate: draw })
          io?.disconnect()
        },
        { threshold: 0.25 },
      )
      io.observe(cv)
    }
    return () => {
      dead = true
      ro.disconnect()
      io?.disconnect()
      tween?.kill()
    }
  }, [src, dotSize, angle, shape, from, amount, invert, form])

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      style={{ color, ...style }}
    />
  )
}

export default Halftone
