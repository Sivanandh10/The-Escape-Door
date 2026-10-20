'use client'
// S01 — all hero motion in one GSAP context. Owner: S01.
//  • intro (#22 panels assemble): the manga panels SLAM in on diagonal gutters, impact shake, "ゴゴゴ" pops.
//    H1 (#04): SplitText lines get a volt ink-bar wipe — the H1 is server-rendered and NEVER hidden by CSS
//    (it is the LCP); the bar covers each line, the line rises behind it, the bar retracts.
//    Waits for the S00 preloader (`[data-preloader]` + `ted:preloader-done`, 2.6 s failsafe).
//  • desktop ≥1024: pinned ~180vh scrub — the door creaks, swings open onto the product showcase, the portal
//    panel grows to full screen (#15) while the camera walks up to the threshold, holds on the showcase (chip
//    with name + price fades in), then a volt speed-line burst hands over to S02.
//    Writes heroProgress.p for the R3F door (same story, one source of truth).
//  • phones/tablets: no JS pin. The door panel is CSS-sticky inside [data-door-track] (S01Hero); this scrubs
//    the door open over the track's extra height, so the reveal always finishes while the panel fills the
//    screen (native touch scroll — no normalizeScroll, no pin-spacer jumps when the URL bar resizes).
//  • product cut-outs ([data-cutout]): pop in with the intro, then drift at their data-depth (parallax).
//  • reduced motion: nothing moves; the CSS door is drawn open (static illustration), the chip is visible.
import { useRef, type CSSProperties, type ReactNode } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { registerGsap } from '@/lib/motion'
import { heroProgress, PHASE } from './progress'

registerGsap()

/** P2 (portal) polygon at rest on desktop — keep in sync with S01Hero CLIP.p2. */
export const P2_REST = 'polygon(61.2% 3%, 94.8% 3%, 94.8% 61.5%, 55.6% 61.5%)'
const P2_FULL = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'

const OFF: Record<string, { xPercent: number; yPercent: number; rotation: number }> = {
  l: { xPercent: -14, yPercent: 0, rotation: -3 },
  r: { xPercent: 16, yPercent: -4, rotation: 3 },
  b: { xPercent: 0, yPercent: 26, rotation: -4 },
  br: { xPercent: 10, yPercent: 26, rotation: 5 },
  t: { xPercent: 0, yPercent: -30, rotation: 0 },
  up: { xPercent: 0, yPercent: 120, rotation: 0 },
}

function waitForPreloader(cb: () => void): () => void {
  // the preloader only runs when its gate script added html.ted-pl (first visit, no ?nopreload, not a bot)
  const html = document.documentElement
  const pre = document.querySelector<HTMLElement>('[data-preloader]')
  if (!html.classList.contains('ted-pl') || html.dataset.preloader === 'done' || !pre || pre.dataset.state === 'done' || pre.hidden) {
    cb()
    return () => {}
  }
  let fired = false
  const fire = () => {
    if (fired) return
    fired = true
    cb()
  }
  window.addEventListener('ted:preloader-done', fire, { once: true })
  const t = window.setTimeout(fire, 2600)
  return () => {
    window.removeEventListener('ted:preloader-done', fire)
    clearTimeout(t)
  }
}

const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72

export function HeroMotion({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const stage = root.current
      if (!stage) return
      const q = gsap.utils.selector(stage)
      const one = <T extends Element = HTMLElement>(s: string) => q(s)[0] as unknown as T | undefined
      const pending = q('[data-reveal="pending"]') as HTMLElement[]
      const mm = gsap.matchMedia()

      mm.add(
        {
          desk: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
          mob: '(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)',
          reduce: '(prefers-reduced-motion: reduce)',
        },
        (ctx) => {
          const { desk, reduce } = ctx.conditions as { desk: boolean; mob: boolean; reduce: boolean }
          if (reduce) {
            pending.forEach((el) => (el.dataset.reveal = 'done'))
            return
          }

          const leaf = one('[data-leaf]')
          const shade = one('[data-leaf-shade]')
          const spill = one('[data-spill]')
          const lines = one('[data-interior-lines]')
          const rays = one('[data-rays]')
          const wrap = one('[data-door-wrap]')
          const portal = one('[data-portal]')
          const scene = one('[data-scene]')
          const gogo = one('[data-gogo]')

          // ── INTRO ────────────────────────────────────────────────────────────
          // swap the CSS pre-state (html.js [data-reveal=pending] → opacity 0) for GSAP's own
          gsap.set(pending, { autoAlpha: 0 })
          pending.forEach((el) => (el.dataset.reveal = 'done'))

          const intro = gsap.timeline({ paused: true })
          const slams = q('[data-slam]') as HTMLElement[]
          intro.fromTo(
            slams,
            {
              xPercent: (_i: number, el: HTMLElement) => OFF[el.dataset.slam ?? 'b'].xPercent,
              yPercent: (_i: number, el: HTMLElement) => OFF[el.dataset.slam ?? 'b'].yPercent,
              rotation: (_i: number, el: HTMLElement) => OFF[el.dataset.slam ?? 'b'].rotation,
              scale: 1.06,
              autoAlpha: 0,
            },
            { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.62, ease: 'ted-slam', stagger: 0.085 },
            0,
          )
          const soft = q('[data-soft]') as HTMLElement[]
          intro.fromTo(soft, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'expo.out', stagger: 0.07 }, 0.42)
          const shake = one('[data-shake]')
          if (shake) {
            intro.to(shake, { x: 7, y: -3, duration: 0.035, ease: 'none' }, 0.6)
            intro.to(shake, { x: -5, y: 2, duration: 0.035, ease: 'none' })
            intro.to(shake, { x: 0, y: 0, duration: 0.05, ease: 'none' })
          }
          if (gogo) intro.fromTo(gogo, { scale: 0.2, rotation: -24, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.4)' }, 0.62)
          const cutouts = q('[data-cutout]') as HTMLElement[]
          if (cutouts.length) {
            intro.fromTo(cutouts, { scale: 0.55, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'back.out(2)', stagger: 0.09 }, 0.55)
          }
          const chip = one('[data-showcase-chip]')
          if (chip) gsap.set(chip, { autoAlpha: 0 })
          const knock = one('[data-door-knock]')
          if (knock) {
            intro.fromTo(knock, { rotation: 0 }, { rotation: -1.6, duration: 0.07, ease: 'power2.out', yoyo: true, repeat: 3 }, 0.72)
          }

          // H1: line-by-line volt ink-bar wipe OVER the (always-visible, never-moved) server text.
          // No line masks and no line offsets: the glyphs (line-height 0.86) never get clipped and the LCP text
          // is painted at its final position from the first frame.
          const h1 = one('[data-hero-h1]')
          let introStarted = false
          let h1Tl: gsap.core.Timeline | null = null
          if (h1) {
            SplitText.create(h1, {
              type: 'lines',
              linesClass: 'hero-line',
              autoSplit: true,
              aria: 'auto',
              onSplit(self) {
                if (h1Tl) return // play once; later re-splits (resize) just re-wrap the text
                const bars = self.lines.map((line) => {
                  const host = line as HTMLElement
                  host.style.position = 'relative'
                  host.style.width = 'fit-content' // bar hugs the words, not the whole column
                  const b = document.createElement('span')
                  b.setAttribute('aria-hidden', 'true')
                  Object.assign(b.style, {
                    position: 'absolute',
                    left: '-0.04em',
                    top: '0.02em',
                    height: '0.84em',
                    width: 'calc(100% + 0.08em)',
                    background: 'var(--color-volt)',
                    transformOrigin: '0% 50%',
                    transform: 'scaleX(0)',
                    zIndex: '3',
                    pointerEvents: 'none',
                  })
                  host.appendChild(b)
                  return b
                })
                const t = gsap.timeline({ paused: true, delay: 0.1, onComplete: () => bars.forEach((b) => b.remove()) })
                bars.forEach((bar, i) => {
                  const at = i * 0.085
                  t.to(bar, { scaleX: 1, duration: 0.22, ease: 'power3.in' }, at)
                  t.set(bar, { transformOrigin: '100% 50%' }, at + 0.22)
                  t.to(bar, { scaleX: 0, duration: 0.42, ease: 'expo.out' }, at + 0.25)
                })
                h1Tl = t
                if (introStarted) t.play()
              },
            })
          }

          // ── IDLE (paused offscreen) ─────────────────────────────────────────
          const idle = gsap.timeline({ paused: true })
          if (rays) idle.to(rays, { scaleX: 0.78, transformOrigin: '0% 50%', duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
          const wobble = one('[data-gogo-idle]')
          if (wobble) idle.to(wobble, { rotation: 3, x: 2, duration: 0.09, ease: 'none', yoyo: true, repeat: -1, repeatDelay: 0.02 }, 0)
          const cue = one('[data-cue-arrow]')
          if (cue) idle.to(cue, { y: 8, duration: 0.6, ease: 'power2.inOut', yoyo: true, repeat: -1 }, 0)
          gsap.timeline({
            scrollTrigger: {
              trigger: stage,
              start: 'top bottom',
              end: 'bottom top',
              onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
            },
          })

          const stopWait = waitForPreloader(() => {
            introStarted = true
            intro.play()
            idle.play()
            h1Tl?.play()
          })

          // ── SCROLL ──────────────────────────────────────────────────────────
          if (desk && portal && scene && wrap && leaf) {
            const p1 = one('[data-p1]')
            const smalls = q('[data-small]')
            const rails = q('[data-rail]')
            const ticker = one('[data-ticker]')
            const burst = one('[data-burst]')
            const burstText = one('[data-burst-text]')
            const cueBox = one('[data-cue]')
            const H = () => stage.offsetHeight

            const tl = gsap.timeline({
              defaults: { ease: 'none' },
              onUpdate: () => {
                heroProgress.p = tl.progress()
              },
              scrollTrigger: {
                trigger: stage,
                start: () => `top ${headerH()}px`,
                end: () => `+=${Math.round(window.innerHeight * 1.8)}`,
                pin: true,
                scrub: 0.7,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            })
            const [c0, c1] = PHASE.creak
            const [o0, o1] = PHASE.open
            const [e0, e1] = PHASE.expand
            const [d0, d1] = PHASE.dolly
            const [b0, b1] = PHASE.burst
            const [s0, s1] = PHASE.show
            tl.set({}, {}, 1) // normalise the timeline to 0..1

            if (cueBox) tl.to(cueBox, { autoAlpha: 0, y: -16, duration: 0.08 }, 0)
            const caption = one('[data-caption]')
            if (caption) tl.to(caption, { autoAlpha: 0, y: -12, duration: 0.06 }, PHASE.expand[0])
            tl.fromTo(leaf, { rotationY: 0 }, { rotationY: 13, duration: c1 - c0, ease: 'power1.in' }, c0)
            if (gogo) tl.fromTo(gogo, { x: 0 }, { x: 4, duration: 0.015, repeat: 7, yoyo: true }, c0)
            tl.to(leaf, { rotationY: 104, duration: o1 - o0, ease: 'power2.inOut' }, o0)
            if (shade) tl.to(shade, { opacity: 0.8, duration: o1 - o0 }, o0)
            if (spill) tl.fromTo(spill, { opacity: 0.12, scaleY: 0.55 }, { opacity: 1, scaleY: 1, duration: o1 - o0, ease: 'power2.out' }, o0)
            if (lines) tl.to(lines, { opacity: 1, duration: 0.2 }, o0 + 0.08)
            if (rays) tl.to(rays, { opacity: 0, duration: 0.12 }, o0 + 0.1)

            // page-turn push of the other panels while the portal grows over them
            if (p1) tl.to(p1, { x: () => -stage.offsetWidth * 0.07, rotation: -1.4, duration: 0.4, ease: 'power2.in' }, 0.3)
            if (smalls.length) tl.to(smalls, { y: () => H() * 0.12, rotation: 2, duration: 0.4, ease: 'power2.in', stagger: 0.03 }, 0.32)
            if (rails.length) tl.to(rails, { yPercent: (i: number) => (i ? 30 : -30), duration: 0.5 }, 0.25)
            if (ticker) tl.to(ticker, { yPercent: 160, duration: 0.25, ease: 'power2.in' }, 0.32)

            // #15 portal → full screen, scene re-centres (the camera lines up with the door)
            tl.fromTo(portal, { clipPath: P2_REST }, { clipPath: P2_FULL, duration: e1 - e0, ease: 'power2.inOut' }, e0)
            tl.fromTo(scene, { '--px': '26.6%', '--py': '-17.75%' }, { '--px': '0%', '--py': '0%', duration: e1 - e0, ease: 'power2.inOut' }, e0)
            // CSS dolly: walk up to the threshold until the doorway (and its product card) fills the frame
            tl.fromTo(wrap, { scale: 1, transformOrigin: '50% 50%' }, { scale: 1.95, duration: d1 - d0, ease: 'power2.inOut' }, d0)
            // the showcase chip: on once the door is open, off when the burst takes over
            if (chip) {
              tl.fromTo(chip, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power2.out' }, s0)
              tl.to(chip, { autoAlpha: 0, y: -16, duration: 0.04, ease: 'power1.in' }, s1 - 0.02)
            }
            // cut-outs drift up at their own depth while the cover panel is pushed aside
            cutouts.forEach((el) => {
              const depth = Number(el.dataset.depth) || 1
              tl.to(el, { y: () => -H() * 0.06 * depth, duration: 0.6, ease: 'power1.in' }, 0)
            })
            if (burst) tl.fromTo(burst, { autoAlpha: 0 }, { autoAlpha: 1, duration: b1 - b0, ease: 'power1.in' }, b0)
            if (burstText) tl.fromTo(burstText, { yPercent: 40, scale: 0.86 }, { yPercent: 0, scale: 1, duration: 0.18, ease: 'back.out(1.6)' }, b0 + 0.1)
          } else if (portal && leaf) {
            // phones / tablets — the portal is CSS-sticky inside [data-door-track]; scrub over the track's extra height
            const track = (portal.closest('[data-door-track]') as HTMLElement | null) ?? portal
            const stickTop = () => headerH() + 10
            const caption = one('[data-caption]')
            const tl = gsap.timeline({
              defaults: { ease: 'none' },
              scrollTrigger: {
                trigger: track,
                // starts as the panel reaches its sticky spot, ends exactly when it unsticks
                start: () => `top ${stickTop()}px`,
                end: () => `bottom ${stickTop() + portal.offsetHeight}px`,
                scrub: 0.35,
                invalidateOnRefresh: true,
              },
            })
            tl.set({}, {}, 1)
            if (caption) tl.to(caption, { autoAlpha: 0, y: -10, duration: 0.08 }, 0.04)
            tl.fromTo(leaf, { rotationY: 0 }, { rotationY: 104, duration: 0.5, ease: 'power2.inOut' }, 0.04)
            if (shade) tl.to(shade, { opacity: 0.75, duration: 0.5 }, 0.04)
            if (spill) tl.fromTo(spill, { opacity: 0.12, scaleY: 0.55 }, { opacity: 1, scaleY: 1, duration: 0.45 }, 0.1)
            if (lines) tl.to(lines, { opacity: 1, duration: 0.3 }, 0.2)
            if (rays) tl.to(rays, { opacity: 0, duration: 0.2 }, 0.2)
            if (wrap) tl.fromTo(wrap, { scale: 0.96, transformOrigin: '50% 50%' }, { scale: 1.14, duration: 0.7, ease: 'power1.inOut' }, 0)
            if (chip) tl.fromTo(chip, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.42)
            const p1Inner = one('[data-p1-inner]')
            if (p1Inner) {
              gsap.to(p1Inner, { y: -36, ease: 'none', scrollTrigger: { trigger: stage, start: 'top top', end: () => `+=${window.innerHeight}`, scrub: true } })
            }
            cutouts.forEach((el) => {
              const depth = Number(el.dataset.depth) || 1
              gsap.to(el, {
                y: () => -window.innerHeight * 0.08 * depth,
                ease: 'none',
                scrollTrigger: { trigger: stage, start: 'top top', end: () => `+=${window.innerHeight}`, scrub: true, invalidateOnRefresh: true },
              })
            })
          }

          return () => {
            stopWait()
            heroProgress.p = 0
          }
        },
      )
    },
    { scope: root },
  )

  return (
    <div ref={root} className={className} style={style}>
      {children}
    </div>
  )
}

export default HeroMotion
