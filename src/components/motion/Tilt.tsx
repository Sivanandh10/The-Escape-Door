'use client'
// #29 3D tilt (pointer:fine only, reduced-motion off). Optional screentone glare that follows the cursor.
// Owner: F1. The rect is cached on pointerenter (never read per frame).
import { useRef, type ReactNode, type CSSProperties } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'

registerGsap()

export interface TiltProps {
  children: ReactNode
  /** max rotation in degrees. Default 8 */
  max?: number
  /** lift toward the viewer on hover (px). Default 0 */
  lift?: number
  /** show a moving halftone glare. Default false */
  glare?: boolean
  className?: string
  style?: CSSProperties
}

export function Tilt({ children, max = 8, lift = 0, glare = false, className, style }: TiltProps) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const shine = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = root.current
      const c = card.current
      if (!el || !c) return
      const mm = gsap.matchMedia()
      mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        gsap.set(c, { transformPerspective: 800, transformStyle: 'preserve-3d' })
        const rx = gsap.quickTo(c, 'rotationX', { duration: 0.4, ease: 'power3' })
        const ry = gsap.quickTo(c, 'rotationY', { duration: 0.4, ease: 'power3' })
        const gx = shine.current ? gsap.quickTo(shine.current, '--gx', { duration: 0.3 }) : null
        const gy = shine.current ? gsap.quickTo(shine.current, '--gy', { duration: 0.3 }) : null
        let rect: DOMRect | null = null
        const enter = () => {
          rect = el.getBoundingClientRect()
          if (lift) gsap.to(c, { z: lift, duration: 0.3, ease: 'power3.out' })
          if (shine.current) gsap.to(shine.current, { opacity: 1, duration: 0.25 })
        }
        const move = (e: PointerEvent) => {
          if (!rect) rect = el.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width - 0.5
          const y = (e.clientY - rect.top) / rect.height - 0.5
          ry(x * max * 2)
          rx(-y * max * 2)
          gx?.((x + 0.5) * 100)
          gy?.((y + 0.5) * 100)
        }
        const leave = () => {
          rect = null
          gsap.to(c, { rotationX: 0, rotationY: 0, z: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' })
          if (shine.current) gsap.to(shine.current, { opacity: 0, duration: 0.3 })
        }
        el.addEventListener('pointerenter', enter)
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        return () => {
          el.removeEventListener('pointerenter', enter)
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
        }
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [max, lift] },
  )

  return (
    <div ref={root} className={cn('relative', className)} style={style} data-tilt="">
      <div ref={card} className="relative h-full w-full">
        {children}
        {glare && (
          <div
            ref={shine}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0"
            style={
              {
                '--gx': 50,
                '--gy': 50,
                // halftone glare (DESIGN: halftone instead of gradients) — volt dots under the cursor
                background: 'var(--color-volt)',
                WebkitMask:
                  'radial-gradient(circle at calc(var(--gx) * 1%) calc(var(--gy) * 1%), #000 0, transparent 38%), var(--tone-mid) 0 0 / 8px 8px repeat',
                WebkitMaskComposite: 'source-in',
                mask: 'radial-gradient(circle at calc(var(--gx) * 1%) calc(var(--gy) * 1%), #000 0, transparent 38%), var(--tone-mid) 0 0 / 8px 8px repeat',
                maskComposite: 'intersect',
                mixBlendMode: 'multiply',
              } as CSSProperties
            }
          />
        )}
      </div>
    </div>
  )
}

export default Tilt
