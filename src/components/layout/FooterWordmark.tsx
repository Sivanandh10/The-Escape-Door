'use client'
// #47 giant outline "ESCAPE DOOR" that fills with volt as the footer scrolls into view. Owner: F1.
// Two stacked copies: paper outline + volt fill revealed by a scrubbed clip-path. Reduced motion = filled.
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { registerGsap } from '@/lib/motion'

registerGsap()

const WORD = 'ESCAPE DOOR'

export function FooterWordmark() {
  const root = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          fill.current,
          { clipPath: 'inset(0% 100% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            ease: 'none',
            scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
          },
        )
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <div ref={root} aria-hidden="true" className="relative select-none overflow-hidden">
      <span className="font-display uppercase outline-text block whitespace-nowrap text-center text-[16.4vw] leading-[0.9] [--stroke-w:2px] md:[--stroke-w:3px]">
        {WORD}
      </span>
      <span
        ref={fill}
        className="font-display uppercase absolute inset-x-0 top-0 block whitespace-nowrap text-center text-[16.4vw] leading-[0.9] text-volt"
        style={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      >
        {WORD}
      </span>
    </div>
  )
}

export default FooterWordmark
