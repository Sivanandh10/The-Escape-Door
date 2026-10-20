'use client'
// S09 stage (#05 fly-in + impact): an "uploaded" original art card flies in and SLAMS onto a blank tee —
// impact frame (scale 1.06→1 + 2-frame shake), ink splat, "BAM!", speed-line burst; the print-zone guides
// flash (back 12×15 in, front 4×4 in). Idle: tee float. Exit: stage drifts up like a turning page.
// Reduced motion: final composition, no flight/shake. Owner: S09.
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { RotateCcw } from 'lucide-react'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { InkSplat } from '@/components/fx/InkSplat'
import { Sfx } from '@/components/fx/Sfx'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Screentone } from '@/components/fx/Screentone'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { BlankTee, BACK_ZONE } from './BlankTee'

registerGsap()

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`

/** The original "uploaded" design: duotone sunburst + type. Not a franchise asset. */
function DesignArt() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-door">
      <ArcMotif motif="spiral" colorA="#6D3BFF" colorB="#FFE14D" width={480} height={600} density={0.75} seed="forge-card" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-[8%] bottom-[7%] flex flex-col items-start">
        <span className="font-jp text-[clamp(10px,1.4vw,16px)] font-black tracking-[0.3em] text-paper [text-shadow:2px_2px_0_#0B0B0F]">わたしの章</span>
        <span className="font-display text-[clamp(34px,6.2vw,92px)] uppercase leading-[0.82] text-volt [-webkit-text-stroke:0.035em_#0B0B0F] [paint-order:stroke_fill] [text-shadow:0.06em_0.06em_0_#0B0B0F]">
          My
          <br />
          Arc
        </span>
      </div>
    </div>
  )
}

export function ForgeStage() {
  const root = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const [busy, setBusy] = useState(false)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const reduced = prefersReducedMotion()
      if (reduced) {
        gsap.set(q('[data-frame]'), { opacity: 0 })
        return
      }
      const card = q('[data-card]')
      const tee = q('[data-tee]')
      const zone = q('[data-zone]')
      const callouts = q('[data-callout]')

      const t = gsap.timeline({
        paused: true,
        defaults: { overwrite: 'auto' },
        onStart: () => setBusy(true),
        onComplete: () => setBusy(false),
      })
      t.set(card, { xPercent: 120, yPercent: -150, rotation: 28, scale: 1.45, opacity: 1 })
        .set(q('[data-frame]'), { opacity: 1 })
        .set(q('[data-splat]'), { scale: 0, rotation: -40, opacity: 1 })
        .set(q('[data-bam]'), { scale: 0, rotation: -24, opacity: 0 })
        .set(q('[data-burst]'), { opacity: 0 })
        .set(zone, { opacity: 0 })
        .set(callouts, { opacity: 0, y: 14 })
        // anticipation: the guides blink where the design will land
        .to(zone, { opacity: 1, duration: 0.07, repeat: 3, yoyo: true, ease: 'none' }, 0.05)
        // fly-in, accelerating into the impact
        .to(card, { xPercent: 0, yPercent: 0, rotation: -3, scale: 1, duration: 0.55, ease: 'expo.in' }, 0.12)
        .addLabel('impact')
        // impact frame
        .fromTo(tee, { scale: 1.07 }, { scale: 1, duration: 0.45, ease: 'ted-slam' }, 'impact')
        .to(tee, { x: -9, y: 5, duration: 0.033, repeat: 3, yoyo: true, ease: 'none' }, 'impact')
        .set(tee, { x: 0, y: 0 }, 'impact+=0.14')
        .to(card, { rotation: 0, duration: 0.3, ease: 'back.out(3)' }, 'impact')
        .to(q('[data-frame]'), { opacity: 0, duration: 0.12, ease: 'none' }, 'impact+=0.02')
        .to(q('[data-splat]'), { scale: 1, rotation: 0, duration: 0.42, ease: 'back.out(2.2)' }, 'impact')
        .to(q('[data-bam]'), { scale: 1, rotation: -10, opacity: 1, duration: 0.38, ease: 'back.out(3.2)' }, 'impact+=0.03')
        .to(q('[data-burst]'), { opacity: 1, duration: 0.05, ease: 'none' }, 'impact')
        .to(q('[data-burst]'), { opacity: 0.25, duration: 0.7, ease: 'power2.out' }, 'impact+=0.12')
        // guides flash, then hold as faint rulers with labels
        .to(zone, { opacity: 1, duration: 0.06, repeat: 5, yoyo: true, ease: 'none' }, 'impact+=0.18')
        .to(zone, { opacity: 0.55, duration: 0.2 }, '>')
        .to(callouts, { opacity: 1, y: 0, duration: 0.5, stagger: 0.09, ease: 'expo.out' }, 'impact+=0.3')
      tl.current = t

      // entrance: plays once when the stage is well in view
      const st = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: 'top 70%', once: true, onEnter: () => t.restart() },
      })

      // idle: the tee floats (sine yoyo)
      const idle = gsap.to(q('[data-float]'), { y: -10, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      // perf: pause the idle float while offscreen
      const idleIo = new IntersectionObserver(([e]) => (e.isIntersecting ? idle.play() : idle.pause()))
      if (root.current) idleIo.observe(root.current)
      // exit: stage drifts up + tilts as the section scrolls away
      const exit = gsap.to(q('[data-exit]'), {
        yPercent: -6,
        rotation: -1.5,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'bottom 55%', end: 'bottom top', scrub: true },
      })
      return () => {
        st.scrollTrigger?.kill()
        st.kill()
        idleIo.disconnect()
        idle.kill()
        exit.scrollTrigger?.kill()
        exit.kill()
        t.kill()
      }
    },
    { scope: root },
  )

  const replay = () => {
    if (!tl.current || busy) return
    tl.current.restart()
  }

  const zoneStyle = {
    left: pct(BACK_ZONE.x, 1000),
    top: pct(BACK_ZONE.y, 1100),
    width: pct(BACK_ZONE.w, 1000),
    height: pct(BACK_ZONE.h, 1100),
  }

  return (
    <div ref={root} className="relative">
      <div data-exit className="relative isolate overflow-hidden border-4 border-ink bg-lav shadow-hard-lg">
        <Screentone density="mid" color="#0B0B0F" opacity={0.18} className="absolute inset-0 -z-10" />
        <div data-burst className="pointer-events-none absolute inset-0 -z-10 opacity-25" aria-hidden="true">
          <SpeedLines intensity={0.9} color="#0B0B0F" count={120} inner={0.34} react={false} seed={9} className="h-full w-full" />
        </div>
        <span className="label absolute left-4 top-4 z-10 border-2 border-ink bg-paper px-2 py-1 text-ink">Design · preview</span>

        <div className="relative mx-auto w-[min(86%,560px)] py-[9%]">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[118%] -translate-x-1/2 -translate-y-1/2 text-volt" aria-hidden="true">
            <div data-splat>
              <InkSplat variant={3} className="block h-auto w-full" />
            </div>
          </div>
          <div data-float>
            <div data-tee className="relative" style={{ aspectRatio: '1000 / 1100' }}>
              <BlankTee side="back" className="absolute inset-0 h-full w-full" />
              <div className="absolute" style={zoneStyle}>
                <div data-card className="relative h-full w-full will-change-transform">
                  <DesignArt />
                  {/* upload card frame: disappears on impact, leaving the print */}
                  <div data-frame className="pointer-events-none absolute -inset-[7%] border-4 border-ink bg-transparent shadow-hard" aria-hidden="true">
                    <div className="absolute inset-0 border-[clamp(6px,1.2vw,14px)] border-paper" />
                    <span className="absolute -bottom-[11%] left-0 whitespace-nowrap border-2 border-ink bg-paper px-1.5 py-0.5 font-mono text-[clamp(9px,1vw,12px)] text-ink">
                      my-arc.png ↑
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* callout: back zone */}
          <div data-callout className="absolute left-[-4%] top-[44%] flex flex-row-reverse items-center gap-2 sm:left-[-12%]" aria-hidden="true">
            <span className="h-[3px] w-6 bg-ink sm:w-12" />
            <span className="border-[3px] border-ink bg-volt px-2 py-1 font-mono text-[11px] font-bold leading-tight text-ink shadow-hard-sm sm:text-xs">
              BACK
              <br />
              12 × 15 in
            </span>
          </div>
        </div>

        {/* front inset: 4×4 in chest zone */}
        <div data-callout className="absolute bottom-3 left-3 w-[24%] min-w-[92px] max-w-[150px] border-[3px] border-ink bg-paper p-1.5 shadow-hard-sm" aria-hidden="true">
          <div className="relative" style={{ aspectRatio: '1000 / 1100' }}>
            <BlankTee side="front" className="absolute inset-0 h-full w-full" />
          </div>
          <span className="mt-1 block text-center font-mono text-[10px] font-bold leading-tight text-ink sm:text-[11px]">FRONT · 4 × 4 in</span>
        </div>

        <div data-bam className="pointer-events-none absolute right-[4%] top-[6%] z-10 sm:right-[7%]">
          <Sfx text="BAM!" size="lg" tone="volt" rotate={-10} />
        </div>

        <button
          type="button"
          onClick={replay}
          disabled={busy}
          className="press focus-ring label absolute bottom-3 right-3 z-10 inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-3 font-bold text-ink shadow-hard-sm transition-colors duration-150 hover:bg-volt disabled:opacity-60 motion-reduce:hidden"
          aria-label="Replay the print slam"
        >
          <RotateCcw className="size-4" aria-hidden="true" strokeWidth={2.5} />
          Slam again
        </button>
      </div>
    </div>
  )
}

export default ForgeStage
