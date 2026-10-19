'use client'
// S03 product theatre (#51 floating product + pointer parallax, impact entrance). Owner: s03-s04-tee.
// Nested wrappers so each motion layer owns its own transform: exit (scroll) → enter (slam) → tilt (pointer) → float (idle).
import { useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { Product } from '@/lib/types'
import { registerGsap } from '@/lib/motion'
import { TeeArt } from '@/components/shop/TeeArt'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Sfx } from '@/components/fx/Sfx'

registerGsap()

export function DropStage({ product, dropLabel }: { product: Product; dropLabel: string }) {
  const root = useRef<HTMLDivElement>(null)
  const back = product.images.find((i) => i.side === 'back')

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const q = gsap.utils.selector(el)
      const mm = gsap.matchMedia()
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', fine: '(hover: hover) and (pointer: fine)' }, (ctx) => {
        const { motion, fine } = ctx.conditions as { motion: boolean; fine: boolean }
        if (!motion) return

        // entrance: the tee falls in and SLAMS onto its colour block (impact frame)
        gsap.set(q('[data-enter]'), { y: -240, rotate: -12, scale: 1.1, autoAlpha: 0 })
        gsap.set(q('[data-floor]'), { scaleX: 0.3, autoAlpha: 0 })
        gsap.set(q('[data-burst]'), { autoAlpha: 0, scale: 0.8 })
        gsap.set(q('[data-pop]'), { scale: 0, autoAlpha: 0 })
        const tl = gsap.timeline({ paused: true })
          .to(q('[data-enter]'), { y: 0, rotate: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'power3.in' })
          .addLabel('impact')
          .to(q('[data-floor]'), { scaleX: 1, autoAlpha: 1, duration: 0.35, ease: 'expo.out' }, 'impact')
          .to(q('[data-burst]'), { autoAlpha: 1, scale: 1.08, duration: 0.12, ease: 'power2.out' }, 'impact')
          .to(q('[data-burst]'), { autoAlpha: 0.28, scale: 1, duration: 0.9, ease: 'expo.out' }, 'impact+=0.14')
          .fromTo(q('[data-shake]'), { x: -9, y: 4 }, { x: 0, y: 0, duration: 0.32, ease: 'elastic.out(1.2, 0.25)' }, 'impact')
          .to(q('[data-pop]'), { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.08 }, 'impact+=0.04')
        const st = gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top 72%', once: true, onEnter: () => tl.play() },
        })

        // idle: float + breathing shadow (#51)
        const float = gsap.to(q('[data-float]'), { y: -16, rotate: 0.8, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        const floor = gsap.to(q('[data-floor-inner]'), { scaleX: 0.84, opacity: 0.55, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        // perf: idle loops only tick while the stage is on screen
        const idleIo = new IntersectionObserver(([e]) => [float, floor].forEach((t) => (e.isIntersecting ? t.play() : t.pause())))
        idleIo.observe(el)

        // exit: the tee lifts and recedes as the page turns to S04
        gsap.to(q('[data-exit]'), {
          yPercent: -10, scale: 0.92, ease: 'none',
          scrollTrigger: { trigger: el, start: 'bottom 75%', end: 'bottom top', scrub: 0.6 },
        })

        // pointer parallax (fine pointer only): tee tilts toward the cursor, stickers counter-move
        let cleanup = () => {}
        if (fine) {
          const section = el.closest('section') ?? el
          const tilt = q('[data-tilt]')[0]
          gsap.set(tilt, { transformPerspective: 900 })
          const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.9, ease: 'power3.out' })
          const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.9, ease: 'power3.out' })
          const tx = gsap.quickTo(tilt, 'x', { duration: 1, ease: 'power3.out' })
          const deco = q('[data-depth]')
          const dx = deco.map((d) => gsap.quickTo(d, 'x', { duration: 1.1, ease: 'power3.out' }))
          const dy = deco.map((d) => gsap.quickTo(d, 'y', { duration: 1.1, ease: 'power3.out' }))
          const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            const nx = gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.75))
            const ny = gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.75))
            ry(nx * 12)
            rx(-ny * 7)
            tx(nx * 18)
            deco.forEach((d, i) => {
              const depth = Number(d.getAttribute('data-depth')) || 1
              dx[i](-nx * 22 * depth)
              dy[i](-ny * 16 * depth)
            })
          }
          const onLeave = () => {
            rx(0); ry(0); tx(0)
            dx.forEach((f) => f(0)); dy.forEach((f) => f(0))
          }
          section.addEventListener('pointermove', onMove as EventListener)
          section.addEventListener('pointerleave', onLeave)
          cleanup = () => {
            section.removeEventListener('pointermove', onMove as EventListener)
            section.removeEventListener('pointerleave', onLeave)
          }
        }
        return () => {
          cleanup()
          tl.kill()
          st.kill()
          idleIo.disconnect()
          float.kill()
          floor.kill()
        }
      })
    },
    { scope: root },
  )

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[680px]">
      <div data-exit className="relative">
        <div data-shake className="relative aspect-[1000/1100] w-full">
          {/* speed-line burst behind the tee */}
          <div data-burst aria-hidden="true" className="pointer-events-none absolute -inset-[12%]">
            <SpeedLines intensity={0.55} count={90} inner={0.42} color="#0B0B0F" react={false} seed={31} className="h-full w-full" />
          </div>
          {/* floor shadow (halftone ellipse, hard — no blur) */}
          <div data-floor aria-hidden="true" className="absolute inset-x-[16%] bottom-[-3%] h-[7%]">
            <div
              data-floor-inner
              className="h-full w-full rounded-[50%] opacity-80"
              style={{ backgroundImage: 'radial-gradient(circle, #0B0B0F 38%, transparent 42%)', backgroundSize: '7px 7px' }}
            />
          </div>
          <div data-enter className="absolute inset-0">
            <div data-tilt className="h-full w-full will-change-transform">
              <div data-float className="h-full w-full">
                <Link
                  href={`/product/${product.slug}`}
                  tabIndex={-1}
                  data-cursor="VIEW"
                  data-cursor-jp="見る"
                  aria-label={`View ${product.name}`}
                  className="block h-full w-full"
                >
                  <TeeArt product={product} side="back" title={back?.alt ?? `${product.name}, back print`} className="h-full w-full" />
                </Link>
              </div>
            </div>
          </div>
          {/* stickers (parallax depth layers) */}
          <div data-depth="1.4" aria-hidden="true" className="pointer-events-none absolute left-[2%] top-[4%] sm:left-[-2%]">
            <div data-pop>
              <div className="grid size-[clamp(78px,11vw,124px)] -rotate-12 place-items-center rounded-full border-[3px] border-ink bg-volt text-center shadow-hard-sm">
                <span className="font-display text-[clamp(22px,3vw,34px)] uppercase leading-[0.85]">
                  {dropLabel.split(' ')[0]}
                  <br />
                  {dropLabel.split(' ')[1]}
                </span>
              </div>
            </div>
          </div>
          <div data-depth="0.8" aria-hidden="true" className="pointer-events-none absolute bottom-[10%] right-[0%]">
            <div data-pop>
              <span className="block rotate-3 border-[3px] border-ink bg-paper px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink shadow-hard-sm sm:text-[12px]">
                Back print · 12×15 in
              </span>
            </div>
          </div>
          <div data-depth="1.8" aria-hidden="true" className="pointer-events-none absolute right-[2%] top-[0%]">
            <div data-pop>
              <Sfx text="ドン!" tone="paper" rotate={8} style={{ fontSize: 'clamp(44px, 6.5vw, 88px)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DropStage
