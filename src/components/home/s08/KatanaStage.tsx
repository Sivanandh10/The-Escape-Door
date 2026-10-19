'use client'
// S08 stage island: dark stage with a halftone spotlight that follows the pointer (#32), the katana with an
// LED glow sweep, a Basic vs LED radiogroup (#40 crossfade + title slide-up), and the stage growing from an
// inset panel to full-bleed as it scrolls in (#15). Touch: the spotlight drifts on its own while in view.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { EASE, registerGsap, useReducedMotion } from '@/lib/motion'
import { Sfx } from '@/components/fx/Sfx'
import { cn } from '@/lib/utils'
import { Katana } from './Katana'

registerGsap()

export interface KatanaPick {
  name: string
  design: string
  href: string
  price: string
}

type Mode = 'basic' | 'led'

export default function KatanaStage({ basic, led }: { basic: KatanaPick | null; led: KatanaPick | null }) {
  const modes = (['basic', 'led'] as const).filter((m) => (m === 'led' ? led : basic))
  const [mode, setMode] = useState<Mode>(led ? 'led' : 'basic')
  const [ignite, setIgnite] = useState(0)
  const reduced = useReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const blade = useRef<HTMLDivElement>(null)
  const parallax = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const current = mode === 'led' ? led : basic

  // #32 spotlight: pointer → --x/--y (rAF-batched); katana parallax tilt on fine pointers
  useGSAP(
    () => {
      const el = stage.current
      const par = parallax.current
      if (!el || !par) return
      const mm = gsap.matchMedia()
      mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const rx = gsap.quickTo(par, 'rotate', { duration: 0.8, ease: 'power3.out' })
        const ry = gsap.quickTo(par, 'y', { duration: 0.8, ease: 'power3.out' })
        let raf = 0
        let px = 0
        let py = 0
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect()
          px = e.clientX - r.left
          py = e.clientY - r.top
          if (!raf)
            raf = requestAnimationFrame(() => {
              raf = 0
              el.style.setProperty('--x', `${px}px`)
              el.style.setProperty('--y', `${py}px`)
              const nx = px / r.width - 0.5
              const ny = py / r.height - 0.5
              rx(nx * 3)
              ry(ny * 14)
            })
        }
        const leave = () => {
          el.style.removeProperty('--x')
          el.style.removeProperty('--y')
          rx(0)
          ry(0)
        }
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        return () => {
          cancelAnimationFrame(raf)
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
        }
      })
      // touch / coarse: the spotlight sweeps slowly by itself while the stage is on screen
      mm.add('(hover: none), (pointer: coarse)', () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const pos = { x: 30, y: 40 }
        const tw = gsap.to(pos, {
          keyframes: { x: [30, 70, 55, 30], y: [40, 35, 60, 40] },
          duration: 9,
          ease: 'sine.inOut',
          repeat: -1,
          paused: true,
          onUpdate: () => {
            el.style.setProperty('--x', `${pos.x}%`)
            el.style.setProperty('--y', `${pos.y}%`)
          },
        })
        const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tw.play() : tw.pause()))
        io.observe(el)
        return () => {
          io.disconnect()
          tw.kill()
        }
      })
      // #15 entrance: inset panel → full-bleed stage; katana slices in; exit: blade sweeps off right
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(7% 6% 7% 6%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 22%', scrub: true },
          },
        )
        if (blade.current) {
          gsap.from(blade.current, {
            xPercent: -28,
            opacity: 0,
            duration: 1.1,
            ease: EASE.out,
            scrollTrigger: {
              trigger: el,
              start: 'top 62%',
              once: true,
              onEnter: () => {
                if (modeRef.current === 'led') setIgnite((k) => k + 1)
              },
            },
          })
          gsap.to(blade.current, {
            xPercent: 14,
            opacity: 0.35,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'bottom 45%', end: 'bottom top', scrub: true },
          })
        }
      })
      return () => mm.revert()
    },
    { scope: stage },
  )

  // #40 crossfade: incoming blade scales 1.04 → 1, title slides up
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const root = stage.current
    if (!root || reduced) return
    const incoming = root.querySelector(`.s08-k-${mode}`)
    const tl = gsap.timeline()
    if (incoming) tl.fromTo(incoming, { scale: 1.04, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.8, ease: 'power2.out' }, 0)
    if (title.current) tl.fromTo(title.current, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: EASE.out }, 0)
    return () => {
      tl.kill()
    }
  }, [mode, reduced])

  // LED ignition: the lit edge draws hilt → tip (on entrance and on every switch to LED)
  useEffect(() => {
    const root = stage.current
    if (!root || !ignite || reduced) return
    const tw = gsap.fromTo(
      root.querySelectorAll('.s08-k-led .s08-edge'),
      { strokeDasharray: 1000, strokeDashoffset: 1000 },
      { strokeDashoffset: 0, duration: 0.55, ease: 'power3.out', delay: 0.05, clearProps: 'strokeDasharray,strokeDashoffset' },
    )
    return () => {
      tw.kill()
    }
  }, [ignite, reduced])

  const choose = (m: Mode) => {
    if (m === mode) return
    setMode(m)
    if (m === 'led') setIgnite((k) => k + 1)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || modes.length < 2) return
    e.preventDefault()
    const next = mode === 'led' ? 'basic' : 'led'
    choose(next)
    stage.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus()
  }

  return (
    <div className="relative mt-10 lg:mt-14">
      <div
        ref={stage}
        className={cn('s08-stage relative isolate overflow-hidden border-y-4 border-paper', `s08-mode-${mode}`)}
        data-mode={mode}
      >
        {/* stage materials: halftone spotlight, top light cone, floor tone */}
        <div aria-hidden="true" className="s08-spot pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="s08-cone pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="s08-floor pointer-events-none absolute inset-x-0 bottom-0 h-[34%]" />
        <span aria-hidden="true" className="s08-bigword pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display uppercase leading-none">
          {mode === 'led' ? 'LED' : 'KATANA'}
        </span>

        {/* katana */}
        <div ref={blade} className="s08-blade-pos pointer-events-none absolute left-1/2 top-1/2">
          <div ref={parallax}>
            <div className="s08-blade">
              <Katana className="block h-auto w-full overflow-visible" />
            </div>
          </div>
        </div>

        {mode === 'led' && ignite > 0 && (
          <span key={ignite} aria-hidden="true" className="s08-sfx pointer-events-none absolute right-[6%] top-[10%] z-10 md:right-[9%] md:top-[14%]">
            <Sfx text="シャキン!" size="md" tone="volt" rotate={-10} />
          </span>
        )}

        {/* overlay UI */}
        <div className="relative z-20 flex h-full flex-col justify-between p-4 md:p-8 lg:px-[max(32px,calc((100vw-1440px)/2+32px))] lg:py-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div
              role="radiogroup"
              aria-label="Katana type"
              onKeyDown={onKey}
              className="inline-flex border-[3px] border-paper bg-ink p-1 shadow-[5px_5px_0_0_var(--color-door)]"
            >
              {modes.map((m) => {
                const on = mode === m
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    data-mode={m}
                    onClick={() => choose(m)}
                    className={cn(
                      'focus-ring label relative min-h-11 min-w-[92px] px-4 font-bold transition-colors duration-150',
                      on ? 'bg-volt text-ink' : 'text-paper can-hover:hover:bg-tone-2',
                    )}
                  >
                    {m === 'led' ? 'LED' : 'Basic'}
                  </button>
                )
              })}
            </div>
            <p className="label hidden text-paper/70 sm:block">
              <span aria-hidden="true" className="mr-2 inline-block size-2 bg-volt align-middle" />
              Display &amp; cosplay prop · not a real blade
            </p>
          </div>

          {current && (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div aria-live="polite" className="overflow-hidden">
                <div ref={title}>
                  <p className="label text-volt">{mode === 'led' ? 'LED cosplay katana' : 'Basic cosplay katana'}</p>
                  <p className="mt-1 pb-[0.08em] font-display text-[clamp(40px,7vw,88px)] uppercase leading-none tracking-[0.01em]">
                    <span className="s08-price">{current.price}</span>
                  </p>
                </div>
              </div>
              <Link
                href={current.href}
                data-cursor="VIEW"
                className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-4 py-3 font-bold text-ink shadow-[4px_4px_0_0_var(--color-volt)]"
              >
                See {current.design}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
