'use client'
// #47 giant background typography: the design title repeated as outline rows scrolling in opposite directions.
// Scroll-scrubbed (transform only); static under reduced motion. Decorative (aria-hidden). Owner: s03-s04-tee.
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'

registerGsap()

export function TitleRows({ title, jp, className }: { title: string; jp?: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const latin = `${title} ✦ `.repeat(4)
  const rows: { text: string; kind: 'outline' | 'solid' | 'jp'; dir: 1 | -1 }[] = [
    { text: latin, kind: 'outline', dir: -1 },
    { text: jp ? `${jp} ✦ `.repeat(6) : latin, kind: jp ? 'jp' : 'solid', dir: 1 },
    { text: latin, kind: 'outline', dir: -1 },
  ]

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<HTMLElement>('[data-row]', root.current).forEach((row) => {
          const dir = Number(row.dataset.row)
          gsap.fromTo(
            row,
            { xPercent: dir < 0 ? 0 : -22 },
            {
              xPercent: dir < 0 ? -22 : 0,
              ease: 'none',
              scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
            },
          )
        })
      })
    },
    { scope: root },
  )

  return (
    <div ref={root} aria-hidden="true" className={cn('pointer-events-none select-none overflow-hidden', className)}>
      <div className="flex h-full flex-col justify-center gap-[1vw]">
        {rows.map((r, i) => (
          <div key={i} data-row={r.dir} className="whitespace-nowrap will-change-transform">
            <span
              className={cn(
                'inline-block uppercase leading-[0.84]',
                r.kind === 'jp' ? 'font-jp font-black tracking-[-0.02em]' : 'font-display',
                r.kind === 'outline' && 'outline-text outline-text-ink',
                r.kind === 'solid' && 'text-ink/10',
                r.kind === 'jp' && 'text-ink/[0.09]',
              )}
              style={{
                fontSize: r.kind === 'jp' ? 'clamp(88px, 13vw, 220px)' : 'clamp(110px, 17vw, 290px)',
                ...(r.kind === 'outline' ? ({ '--stroke-w': '2px', opacity: 0.45 } as React.CSSProperties) : null),
              }}
            >
              {r.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TitleRows
