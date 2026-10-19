'use client'
// #13 word-by-word opacity reveal, scrubbed with scroll. Real sentence stays in the DOM (spans only).
// Reduced motion: fully visible, no scrub. Owner: S10.
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'

registerGsap()

export function WordReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return
      const words = ref.current.querySelectorAll('[data-w]')
      gsap.fromTo(
        words,
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: ref.current, start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
        },
      )
    },
    { scope: ref },
  )
  return (
    <p ref={ref} className={cn(className)}>
      {text.split(/\s+/).map((w, i) => (
        <span key={i} data-w className="inline-block">
          {w}
          {' '}
        </span>
      ))}
    </p>
  )
}

export default WordReveal
