'use client'
// #30 Magnetic wrapper: the child drifts toward the cursor (fine pointer only), snaps back elastically.
// Owner: F1. Wraps any element; GSAP writes transform on the inner span only (never on your child).
import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'

registerGsap()

export interface MagneticProps {
  children: ReactNode
  /** 0..1 share of the cursor offset applied (playbook: 0.3–0.4). Default 0.35 */
  strength?: number
  /** extra px around the element that still attracts. Default 24 */
  radius?: number
  className?: string
}

export function Magnetic({ children, strength = 0.35, radius = 24, className }: MagneticProps) {
  const root = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const el = root.current
      const target = inner.current
      if (!el || !target) return
      const mm = gsap.matchMedia()
      mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const xTo = gsap.quickTo(target, 'x', { duration: 0.4, ease: 'power3' })
        const yTo = gsap.quickTo(target, 'y', { duration: 0.4, ease: 'power3' })
        let rect: DOMRect | null = null
        const enter = () => {
          rect = el.getBoundingClientRect()
        }
        const move = (e: PointerEvent) => {
          if (!rect) rect = el.getBoundingClientRect()
          xTo((e.clientX - rect.left - rect.width / 2) * strength)
          yTo((e.clientY - rect.top - rect.height / 2) * strength)
        }
        const leave = () => {
          rect = null
          gsap.to(target, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' })
        }
        el.addEventListener('pointerenter', enter)
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        return () => {
          el.removeEventListener('pointerenter', enter)
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
          gsap.set(target, { x: 0, y: 0 })
        }
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [strength] },
  )

  return (
    <span
      ref={root}
      className={cn('relative inline-block', className)}
      style={{ padding: radius, margin: -radius }}
      data-magnetic=""
    >
      <span ref={inner} className="inline-block will-change-transform">
        {children}
      </span>
    </span>
  )
}

export default Magnetic
