'use client'
// #04 split-text masked reveal (GSAP SplitText 3.15: mask + autoSplit + aria). Owner: F1.
// Real text stays in the DOM (aria: 'auto' keeps it readable for screen readers).
// Reduced motion → plain text, no split. Accent words: pass children with <em>…</em>.
import { useRef, type ElementType, type ReactNode, type HTMLAttributes } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { EASE, prefersReducedMotion, registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'

registerGsap()

export interface SplitRevealProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** element to render. Default 'h2' */
  as?: ElementType
  /** plain text (or use children for markup such as an <em> accent word) */
  text?: string
  children?: ReactNode
  /** 'scroll' (default) plays when the element enters the viewport; 'load' plays on mount */
  trigger?: 'scroll' | 'load'
  /** unit that rises. Default 'words' (lines are always masked) */
  split?: 'lines' | 'words' | 'chars'
  delay?: number
  stagger?: number
  duration?: number
  /** ScrollTrigger start. Default 'top 85%' */
  start?: string
}

export function SplitReveal({
  as: Tag = 'h2',
  text,
  children,
  trigger = 'scroll',
  split = 'words',
  delay = 0,
  stagger,
  duration = 0.9,
  start = 'top 85%',
  className,
  ...rest
}: SplitRevealProps) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      if (prefersReducedMotion()) {
        el.dataset.reveal = 'done'
        return
      }
      let played = false
      const type = split === 'chars' ? 'lines,words,chars' : 'lines,words'
      SplitText.create(el, {
        type,
        mask: 'lines',
        linesClass: 'sr-line',
        wordsClass: 'sr-word',
        charsClass: 'sr-char',
        autoSplit: true,
        aria: 'auto',
        onSplit(self) {
          el.dataset.reveal = 'done'
          if (played) return
          const targets = split === 'chars' ? self.chars : split === 'lines' ? self.lines : self.words
          return gsap.from(targets, {
            yPercent: 115,
            rotate: split === 'lines' ? 0 : 4,
            duration,
            ease: EASE.out,
            delay,
            stagger: stagger ?? (split === 'chars' ? 0.025 : split === 'words' ? 0.05 : 0.08),
            onComplete: () => {
              played = true
            },
            scrollTrigger: trigger === 'scroll' ? { trigger: el, start, once: true } : undefined,
          })
        },
      })
    },
    { scope: ref, dependencies: [] },
  )

  return (
    <Tag ref={ref} data-reveal="pending" className={cn('ted-split', className)} {...rest}>
      {children ?? text}
    </Tag>
  )
}

export default SplitReveal
