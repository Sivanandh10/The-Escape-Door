'use client'
// #07 fade-up / #08 staggered reveal of direct children on enter. Owner: F1.
// Reduced motion → children shown in their final state immediately.
// Variants: 'up' (default, y 40 → 0), 'slam' (panel slam: scale 1.06 → 1 + back.out), 'flip' (rotateX −40 → 0).
import { useRef, type ElementType, type ReactNode, type HTMLAttributes } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { EASE, prefersReducedMotion, registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'

registerGsap()

export interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  as?: ElementType
  children: ReactNode
  /** seconds between children. Default 0.08 (total is capped at ~0.8s) */
  stagger?: number
  /** travel distance in px for 'up'. Default 40 */
  y?: number
  variant?: 'up' | 'slam' | 'flip'
  delay?: number
  /** ScrollTrigger start. Default 'top 85%' */
  start?: string
  /** animate the wrapper itself instead of its children */
  self?: boolean
}

export function Reveal({
  as: Tag = 'div',
  children,
  stagger = 0.08,
  y = 40,
  variant = 'up',
  delay = 0,
  start = 'top 85%',
  self = false,
  className,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      el.dataset.reveal = 'done'
      if (prefersReducedMotion()) return
      const items = self ? [el] : (Array.from(el.children) as HTMLElement[])
      if (!items.length) return
      const each = Math.min(stagger, 0.8 / Math.max(1, items.length))
      const from: gsap.TweenVars =
        variant === 'slam'
          ? { autoAlpha: 0, scale: 1.08, y: 18, rotate: -1.5 }
          : variant === 'flip'
            ? { autoAlpha: 0, y: 50, rotationX: -40, transformPerspective: 1000 }
            : { autoAlpha: 0, y }
      gsap.set(items, from)
      ScrollTrigger.batch(items, {
        start,
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotate: 0,
            rotationX: 0,
            duration: variant === 'slam' ? 0.55 : 0.9,
            ease: variant === 'slam' ? EASE.slam : 'power3.out',
            stagger: each,
            delay,
            overwrite: true,
          }),
      })
    },
    { scope: ref, dependencies: [] },
  )

  return (
    <Tag ref={ref} data-reveal="pending" className={cn(className)} {...rest}>
      {children}
    </Tag>
  )
}

export default Reveal
