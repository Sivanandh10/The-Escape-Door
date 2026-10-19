'use client'
// #16 scroll-drawn ink timeline through manga panels. The spine scales 0→1 with scroll (transform only),
// a brush-tip rides its end, and each episode's door node swings open as the ink reaches it.
// Panels slam in from their side once. Reduced motion: fully drawn, all doors open, no entrance.
// Owner: S10.
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { DoorIcon } from '@/components/brand'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Partnership } from '@/lib/types'

registerGsap()

function roleTone(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('fandom')) return 'bg-volt text-ink'
  if (r.includes('gifting')) return 'bg-pink text-ink'
  if (r.includes('cosplay')) return 'bg-lav text-ink'
  return 'bg-paper text-ink'
}

export function PartnerTimeline({ items }: { items: Partnership[] }) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Set<number>>(() => new Set())

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const q = gsap.utils.selector(el)
      if (prefersReducedMotion()) {
        setActive(new Set(items.map((_, i) => i)))
        return
      }
      const line = q('[data-ink]')[0] as HTMLElement | undefined
      const tip = q('[data-tip]')[0] as HTMLElement | undefined
      const track = q('[data-track]')[0] as HTMLElement | undefined
      gsap.set(line ?? [], { scaleY: 0, transformOrigin: '50% 0%' })
      gsap.to(line ?? [], {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: track,
          start: 'top 62%',
          end: 'bottom 62%',
          scrub: 0.4,
          onUpdate: (self) => {
            if (tip && track) tip.style.transform = `translate3d(-50%, ${(self.progress * track.offsetHeight).toFixed(1)}px, 0)`
          },
        },
      })

      q('[data-item]').forEach((node, i) => {
        const panel = (node as HTMLElement).querySelector('[data-panel]')
        const fromLeft = (node as HTMLElement).dataset.side === 'left'
        gsap.from(panel, {
          x: fromLeft ? -70 : 70,
          rotation: fromLeft ? -3 : 3,
          opacity: 0,
          duration: 0.8,
          ease: 'expo.out',
          scrollTrigger: { trigger: node, start: 'top 88%', once: true },
        })
        gsap.timeline({
          scrollTrigger: {
            trigger: node,
            start: 'top 62%',
            onEnter: () => setActive((s) => new Set(s).add(i)),
            onLeaveBack: () =>
              setActive((s) => {
                const n = new Set(s)
                n.delete(i)
                return n
              }),
          },
        })
      })
    },
    { scope: root, dependencies: [items.length] },
  )

  return (
    <div ref={root} className="relative">
      <ol data-track className="relative grid gap-8 lg:gap-0" aria-label="Fests and events we have partnered with">
        {/* spine: faint dashed guide + scroll-drawn ink */}
        <span aria-hidden="true" className="absolute bottom-0 left-[21px] top-0 w-0 border-l-[3px] border-dashed border-tone-4 lg:left-1/2" />
        <span aria-hidden="true" className="absolute bottom-0 left-[18px] top-0 w-[9px] lg:left-[calc(50%-3px)]">
          <span data-ink className="block h-full w-full bg-ink" />
        </span>
        <span aria-hidden="true" className="absolute left-[22.5px] top-0 lg:left-1/2">
          <span data-tip className="block size-5 rounded-full border-[3px] border-ink bg-volt" style={{ transform: 'translate3d(-50%,0,0)' }} />
        </span>

        {items.map((p, i) => {
          const side = i % 2 === 0 ? 'left' : 'right'
          const on = active.has(i)
          const featured = p.years.includes('×')
          const meta = [p.institution, p.years && !featured ? p.years : ''].filter(Boolean).join(' · ')
          return (
            <li
              key={p.id}
              data-item
              data-side={side}
              className={cn('relative grid pl-14 lg:grid-cols-2 lg:pl-0', i > 0 && 'lg:-mt-14')}
            >
              {/* node */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[3px] top-6 z-10 grid size-11 place-items-center border-[3px] border-ink transition-colors duration-200 lg:left-1/2 lg:-ml-[22px]',
                  on ? 'bg-door text-paper' : 'bg-paper text-ink',
                )}
              >
                <DoorIcon open={on ? 0.85 : 0} size={22} strokeWidth={2.4} />
              </span>
              <article
                data-panel
                className={cn(
                  'relative border-4 border-ink p-5 shadow-hard sm:p-6',
                  featured ? 'bg-ink text-paper shadow-hard-volt' : 'bg-paper text-ink',
                  side === 'left' ? 'lg:col-start-1 lg:mr-14' : 'lg:col-start-2 lg:ml-14',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('font-mono text-[12px] font-bold tracking-[0.14em]', featured ? 'text-volt' : 'text-tone-3')}>
                    EP.{String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={cn('border-2 border-ink px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide', roleTone(p.role))}>{p.role}</span>
                </div>
                <h3 className="mt-3 font-display text-[clamp(40px,5vw,76px)] uppercase leading-[0.86] tracking-[-0.01em]">{p.fest}</h3>
                {meta && <p className={cn('mt-2 font-mono text-[14px]', featured ? 'text-tone-4' : 'text-tone-2')}>{meta}</p>}
                {p.detail && p.detail !== 'Online' && <p className={cn('mt-3 max-w-[40ch] text-[16px] leading-snug', featured ? 'text-paper' : 'text-ink')}>{p.detail}</p>}
                {featured && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-3 -top-5 rotate-[8deg] border-[3px] border-ink bg-volt px-3 py-1 font-display text-[36px] leading-none text-ink shadow-hard-sm"
                  >
                    ×{p.years.replace(/[^\d]/g, '')}
                  </span>
                )}
              </article>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default PartnerTimeline
