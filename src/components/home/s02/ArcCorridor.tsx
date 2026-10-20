'use client'
// S02 corridor. Desktop (≥1024, motion OK): the section pins and the track scrubs sideways
// (#10 #11); doors swing on a corridor curve as they pass; the door nearest the centre recolours
// the page (#18 #41 via useArcTheme) and a giant outline name swaps behind (#47).
// Mobile / reduced motion: no pin — a swipe/scroll-snap carousel of the same doors.
// Under both: the #34 Collections index. Arc theme resets when the section leaves.
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useArcTheme } from '@/components/Providers'
import { registerGsap } from '@/lib/motion'
import { ArcDoor } from './ArcDoor'
import { CollectionsIndex } from './CollectionsIndex'
import type { ArcDoorData } from './types'
import './s02.css'

const PIN_Q = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)'
const MOTION_Q = '(prefers-reduced-motion: no-preference)'
const pad = (n: number) => String(n).padStart(2, '0')

export function ArcCorridor({ doors }: { doors: ArcDoorData[] }) {
  const section = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const st = useRef<ScrollTrigger | null>(null)
  const centres = useRef<number[]>([])
  const mode = useRef<'pin' | 'carousel'>('carousel')
  const owning = useRef(false)

  const [active, setActive] = useState(-1)
  const [inView, setInView] = useState(false)
  const activeRef = useRef(-1)
  const { set: setArc } = useArcTheme()

  const pick = useCallback((i: number) => {
    if (activeRef.current === i) return
    activeRef.current = i
    setActive(i)
  }, [])

  // recolour while the corridor is on screen; reset (only if we coloured it) when it leaves
  useEffect(() => {
    const slug = inView && active >= 0 ? doors[active]?.slug : null
    if (slug) {
      owning.current = true
      setArc(slug)
    } else if (owning.current) {
      owning.current = false
      setArc(null)
    }
  }, [active, inView, doors, setArc])
  useEffect(
    () => () => {
      if (owning.current) setArc(null)
    },
    [setArc],
  )

  useGSAP(
    () => {
      registerGsap()
      const mm = gsap.matchMedia(section.current ?? undefined)

      // ── desktop: pinned horizontal corridor ─────────────────────────────
      mm.add(PIN_Q, () => {
        mode.current = 'pin'
        const p = pin.current!
        const t = track.current!
        const items = gsap.utils.toArray<HTMLElement>('.s02-item', t)
        const distance = () => Math.max(0, t.scrollWidth - p.clientWidth)
        const measure = () => {
          centres.current = items.map((el) => el.offsetLeft + el.offsetWidth / 2)
        }
        const update = (progress: number) => {
          const x = progress * distance() + p.clientWidth / 2
          let best = -1
          let bestD = Infinity
          centres.current.forEach((c, i) => {
            const d = Math.abs(c - x)
            if (d < bestD) {
              bestD = d
              best = i
            }
          })
          const reach = (items[0]?.offsetWidth ?? 300) * 1.15
          pick(bestD <= reach ? best : -1)
          if (bar.current) bar.current.style.transform = `scaleX(${progress})`
        }

        const tween = gsap.to(t, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: p,
            pin: true,
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onRefresh: (self) => {
              measure()
              update(self.progress)
            },
            onUpdate: (self) => update(self.progress),
            onToggle: (self) => setInView(self.isActive),
          },
        })
        st.current = tween.scrollTrigger ?? null

        // corridor curve: doors angle in from the right, face you at centre, angle away left
        items.forEach((el) => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: el,
                containerAnimation: tween,
                start: 'left right',
                end: 'right left',
                scrub: true,
              },
            })
            .fromTo(
              el,
              { rotateY: -26, scale: 0.9, transformPerspective: 1400, transformOrigin: '50% 60%' },
              { rotateY: 0, scale: 1, ease: 'power1.out', duration: 1 },
            )
            .to(el, { rotateY: 22, scale: 0.92, ease: 'power1.in', duration: 1 })
        })

        // ghost name drifts against the travel (parallax)
        gsap.to('.s02-ghost-wrap', {
          xPercent: -18,
          ease: 'none',
          scrollTrigger: { trigger: p, start: 'top top', end: () => `+=${distance()}`, scrub: true },
        })

        // entrance: heading lines + label punch up as the section arrives
        gsap.from('.s02-intro > *', {
          y: 48,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: section.current, start: 'top 70%', once: true },
        })
        gsap.from('.s02-door', {
          xPercent: 40,
          rotate: 4,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'back.out(1.4)',
          stagger: 0.07,
          scrollTrigger: { trigger: section.current, start: 'top 55%', once: true },
        })

        return () => {
          st.current = null
          pick(-1)
          setInView(false)
        }
      })

      return () => mm.revert()
    },
    { scope: section, dependencies: [doors.length] },
  )

  // carousel mode (anything that isn't the pinned corridor): IO-driven active door + in-view
  useEffect(() => {
    const mq = window.matchMedia(PIN_Q)
    let cleanup: (() => void) | null = null
    const setup = () => {
      cleanup?.()
      cleanup = null
      if (mq.matches) return
      mode.current = 'carousel'
      const s = section.current
      const l = list.current
      if (!s || !l) return
      const items = Array.from(l.querySelectorAll<HTMLElement>('.s02-item'))
      const ratios = new Map<number, number>()
      const ioDoors = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => ratios.set(Number((e.target as HTMLElement).dataset.i), e.intersectionRatio))
          let best = -1
          let bestR = 0.55
          ratios.forEach((r, i) => {
            if (r > bestR) {
              bestR = r
              best = i
            }
          })
          if (best >= 0) pick(best)
          const i = activeRef.current < 0 ? 0 : activeRef.current
          if (bar.current) bar.current.style.transform = `scaleX(${(i + 1) / items.length})`
        },
        { root: l, threshold: [0, 0.25, 0.55, 0.75, 1] },
      )
      items.forEach((el) => ioDoors.observe(el))
      const ioSection = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
        rootMargin: '-35% 0px -35% 0px',
      })
      ioSection.observe(l)

      // light entrance for the carousel (skipped for reduced motion)
      let tw: gsap.core.Tween | null = null
      if (window.matchMedia(MOTION_Q).matches) {
        registerGsap()
        tw = gsap.from(items.map((el) => el.firstElementChild), {
          x: 70,
          rotate: 3,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'back.out(1.4)',
          stagger: 0.08,
          scrollTrigger: { trigger: l, start: 'top 85%', once: true },
        })
      }
      cleanup = () => {
        ioDoors.disconnect()
        ioSection.disconnect()
        tw?.scrollTrigger?.kill()
        tw?.revert()
      }
    }
    setup()
    mq.addEventListener('change', setup)
    return () => {
      mq.removeEventListener('change', setup)
      cleanup?.()
    }
  }, [pick])

  const goTo = (i: number) => {
    const items = list.current?.querySelectorAll<HTMLElement>('.s02-item')
    const el = items?.[i]
    if (!el) return
    if (mode.current === 'pin' && st.current && pin.current && track.current) {
      const s = st.current
      const dist = Math.max(1, track.current.scrollWidth - pin.current.clientWidth)
      const c = centres.current[i] ?? el.offsetLeft + el.offsetWidth / 2
      const prog = gsap.utils.clamp(0, 1, (c - pin.current.clientWidth / 2) / dist)
      const y = s.start + prog * (s.end - s.start)
      if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.1 })
      else window.scrollTo({ top: y, behavior: 'smooth' })
      return
    }
    const l = list.current!
    l.scrollTo({
      left: el.offsetLeft - (l.clientWidth - el.offsetWidth) / 2,
      behavior: window.matchMedia(MOTION_Q).matches ? 'smooth' : 'auto',
    })
    pick(i)
  }

  const shown = active >= 0 ? doors[active] : null
  const counter = pad(Math.max(1, active + 1))

  return (
    <section id="choose-arc" ref={section} aria-labelledby="choose-arc-title" className="s02">
      <div className="s02-bg" aria-hidden="true" />
      <div ref={pin} className="s02-pin">
        <div className="s02-ghost-wrap" aria-hidden="true">
          <p key={shown?.slug ?? 'intro'} className="s02-ghost h-display">
            {shown ? shown.name : 'Pick your arc'}
          </p>
        </div>

        <div ref={track} className="s02-track">
          <header className="s02-intro">
            <p className="label text-volt">
              Chapter 02 · Choose your arc <span lang="ja">第二話</span>
            </p>
            <h2 id="choose-arc-title" className="s02-h2 h-display">
              Pick your <em>arc</em>: Jujutsu Kaisen, One Piece, Naruto and more
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub block">
              物語を選べ ・ 扉の向こうへ
            </span>
            <p className="s02-lede">
              Every collection is a door. Walk the corridor, pick the arc you live in and step through to
              tees, hoodies, polaroids and props. Original, fan-inspired designs only.
            </p>
            <p className="s02-hint label" aria-hidden="true" data-scrolltop-avoid="">
              <span className="s02-hint-arrow">→</span> Scroll to walk the corridor
            </p>
          </header>

          <ol ref={list} className="s02-doors" aria-label="Collections" data-lenis-prevent-horizontal="">
            {doors.map((d, i) => (
              <li key={d.slug} className="s02-item" data-i={i}>
                <ArcDoor door={d} total={doors.length} active={active === i} priority={i === 0} />
              </li>
            ))}
          </ol>
        </div>

        <div className="s02-hud">
          <p className="s02-count" aria-live="polite" aria-atomic="true">
            <span className="label">Arc</span>
            <span className="s02-count-n font-display">{counter}</span>
            <span className="label opacity-60">/{pad(doors.length)}</span>
            <span className="sr-only">{shown ? `: ${shown.name}` : ''}</span>
          </p>
          <div className="s02-segs" role="group" aria-label="Jump to an arc">
            {doors.map((d, i) => (
              <button
                key={d.slug}
                type="button"
                className="s02-seg focus-ring"
                data-on={active === i ? '' : undefined}
                aria-label={`Show ${d.name}`}
                aria-current={active === i ? 'true' : undefined}
                onClick={() => goTo(i)}
                style={{ ['--seg' as string]: d.accentA }}
              >
                <span />
              </button>
            ))}
          </div>
          <span className="s02-bar" aria-hidden="true">
            <span ref={bar} />
          </span>
          <div className="s02-nav">
            <button
              type="button"
              className="s02-arrow focus-ring press"
              aria-label="Previous arc"
              onClick={() => goTo(Math.max(0, (active < 0 ? 0 : active) - 1))}
            >
              ←
            </button>
            <button
              type="button"
              className="s02-arrow focus-ring press"
              aria-label="Next arc"
              onClick={() => goTo(Math.min(doors.length - 1, (active < 0 ? 0 : active) + 1))}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="s02-index-wrap container-x">
        <CollectionsIndex doors={doors} onArc={setArc} />
      </div>
    </section>
  )
}
