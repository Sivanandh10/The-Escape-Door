'use client'
// #16 Scroll progress timeline: an ink line draws down through the fest panels (scaleY scrub,
// transform-origin top) and each panel "inks in" (toggles active) as the line reaches it.
// Owner: P5. Reduced motion: line fully drawn, every panel active. Cleanup via useGSAP.
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import type { Partnership } from '@/lib/types'
import { cn } from '@/lib/utils'

registerGsap()

const TONES = ['bg-volt text-ink', 'bg-lav text-ink', 'bg-pink text-ink', 'bg-paper text-ink'] as const

export function InkTimeline({ items }: { items: Partnership[] }) {
  const root = useRef<HTMLOListElement>(null)

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const rows = gsap.utils.toArray<HTMLElement>('[data-row]', el)
      if (prefersReducedMotion()) {
        rows.forEach((r) => r.setAttribute('data-active', ''))
        return
      }
      gsap.fromTo(
        '[data-line]',
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 70%', end: 'bottom 70%', scrub: 0.4 } },
      )
      rows.forEach((r) => {
        ScrollTrigger.create({
          trigger: r,
          start: 'top 70%',
          onEnter: () => r.setAttribute('data-active', ''),
          onLeaveBack: () => r.removeAttribute('data-active'),
        })
      })
    },
    { scope: root },
  )

  return (
    <ol ref={root} className="relative ml-1 sm:ml-0">
      {/* track + drawn ink line */}
      <span aria-hidden="true" className="absolute bottom-6 left-[15px] top-6 w-[3px] bg-tone-2 sm:left-[23px]" />
      <span aria-hidden="true" data-line className="absolute bottom-6 left-[14px] top-6 w-[5px] origin-top bg-volt sm:left-[22px]" />
      {items.map((p, i) => (
        <li key={p.id} data-row className="group/row relative grid grid-cols-[32px_1fr] gap-4 pb-6 last:pb-0 sm:grid-cols-[48px_1fr] sm:gap-8 sm:pb-8">
          <span
            aria-hidden="true"
            className="relative z-[1] mt-6 grid size-8 place-items-center border-[3px] border-paper bg-ink font-mono text-[11px] font-bold text-paper transition-[background-color,color,scale] duration-300 group-data-[active]/row:scale-110 group-data-[active]/row:border-ink group-data-[active]/row:bg-volt group-data-[active]/row:text-ink sm:size-12 sm:text-[13px]"
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <article
            className={cn(
              'relative border-4 border-ink p-5 shadow-hard transition-[opacity,translate] duration-500 [.js_&]:opacity-45 [.js_&]:[translate:24px_0] group-data-[active]/row:opacity-100 group-data-[active]/row:[translate:0_0] sm:p-6',
              TONES[i % TONES.length],
            )}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <h3 className="font-display text-[clamp(32px,4.6vw,60px)] uppercase leading-[0.9]">{p.fest}</h3>
              {p.years && (
                <span className="label shrink-0 border-[3px] border-ink bg-ink px-2 py-1 text-paper">{p.years}</span>
              )}
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] font-semibold">
              <span className="label border-2 border-ink px-1.5 py-0.5">{p.role}</span>
              {p.institution && <span>{p.institution}</span>}
            </p>
            {p.detail && p.detail !== p.role && <p className="mt-2 text-[15px] text-ink/80">{p.detail}</p>}
          </article>
        </li>
      ))}
    </ol>
  )
}

export default InkTimeline
