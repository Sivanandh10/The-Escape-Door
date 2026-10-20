'use client'
// S00 preloader overlay + choreography (#01 branded preloader, #24 ink stroke-draw, #06 0→100 counter, #03 door/curtain).
// Hard budget ≈ 1.2 s from navigation start (UX pass): draw + count → brief gate on real progress (fonts + hero
// poster, ≤ 0.1 s) → ドン! slam → doors open. If React hydrated late, the timeline is sped up to fit what is left
// of the budget, or skipped with a 180 ms fade. First visit only (localStorage 'ted:pl'). The SSR overlay already
// shows a type-only brand mark, so the very first paint is branded even before JS arrives.
// Overlay only: the hero is already rendered underneath. Scroll is locked (Lenis stop + overflow) and the page behind
// is inert while it runs. Click / Esc / Enter / Space fast-forwards. `?preload=force&t=1.2` freezes the timeline (lab QA).
import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { registerGsap } from '@/lib/motion'
import { useLenis } from '@/components/motion/SmoothScroll'
import { Wordmark, Mascot } from '@/components/brand'
import { Sfx } from '@/components/fx/Sfx'
import { seeded } from '@/lib/utils'
import './preloader.css'

const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
function kanjiNum(n: number): string {
  if (n >= 100) return '百'
  const t = Math.floor(n / 10)
  const o = n % 10
  if (t === 0) return KANJI[o]
  return (t > 1 ? KANJI[t] : '') + '十' + (o ? KANJI[o] : '')
}

/** deterministic speed-line burst (wedges radiating from the centre) */
function useBurst() {
  return useMemo(() => {
    const r = seeded(4021)
    const out: string[] = []
    const n = 46
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.09
      const w = 0.006 + r() * 0.018
      const r0 = 34 + r() * 16
      const r1 = 150
      const p = (rad: number, ang: number) => `${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`
      out.push(`${p(r0, a)} ${p(r1, a - w)} ${p(r1, a + w)}`)
    }
    return out
  }, [])
}

type Phase = 'pending' | 'run' | 'skip' | 'done'

/** total ms the intro may hold the page, measured from the cover's first paint (inline gate) */
const BUDGET_MS = 1200
/** below this much remaining budget the intro is skipped (quick fade) instead of compressed */
const MIN_RUN_MS = 420

export default function Preloader() {
  const root = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('pending')
  const lenis = useLenis()
  const burst = useBurst()

  const budget = useRef<number | null>(null)

  // decide once on mount: the inline gate already chose (html.ted-pl)
  useEffect(() => {
    const html = document.documentElement
    const on = html.classList.contains('ted-pl')
    if (!on) {
      html.dataset.preloader = 'done'
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time decision from the inline gate class
      setPhase('done')
      return
    }
    try {
      localStorage.setItem('ted:pl', '1')
      sessionStorage.setItem('ted:pl', '1')
    } catch {}
    const frozen = /[?&]t=/.test(location.search)
    // budget runs from when the cover first painted (the gate), not from navigation start
    const shownAt = (window as Window & { __tedPlT?: number }).__tedPlT ?? 0
    const left = BUDGET_MS - (performance.now() - shownAt)
    if (!frozen && left < MIN_RUN_MS) {
      // hydrated late: no show now; fade the cover away and hand over the page
      setPhase('skip')
      const t = window.setTimeout(() => {
        html.classList.remove('ted-pl')
        html.dataset.preloader = 'done'
        window.dispatchEvent(new CustomEvent('ted:preloader-done'))
        setPhase('done')
        requestAnimationFrame(() => ScrollTrigger.refresh())
      }, 190)
      return () => window.clearTimeout(t)
    }
    html.dataset.preloader = 'run' // tells the gate's 1.2 s release timer that we own the exit now
    budget.current = frozen ? null : left / 1000
    setPhase('run')
  }, [])

  // scroll lock while running (Lenis may mount after us)
  useEffect(() => {
    if (phase !== 'run' || !lenis) return
    lenis.stop()
    return () => lenis.start()
  }, [phase, lenis])

  useGSAP(
    () => {
      if (phase !== 'run' || !root.current) return
      registerGsap()
      const el = root.current
      const q = gsap.utils.selector(el)
      const html = document.documentElement
      const params = new URLSearchParams(location.search)
      const freezeAt = params.has('t') ? parseFloat(params.get('t') || '0') : null

      // ── inert background (focus stays inside the overlay) ──
      // walk up from the overlay to <body>, inerting every sibling branch on the way
      const inerted: Element[] = []
      for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
        const parent: Element | null = node.parentElement
        if (!parent) break
        for (const c of Array.from(parent.children)) {
          if (c === node || c.tagName === 'SCRIPT' || c.hasAttribute('inert')) continue
          c.setAttribute('inert', '')
          inerted.push(c)
        }
      }

      // ── real progress: fonts + hero poster (+ the SFX/JP faces we're about to show) ──
      let ready = false
      const sfxEl = el.querySelector<HTMLElement>('.s00-don .sfx')
      const jpEl = el.querySelector<HTMLElement>('.s00-kanji')
      const fontLoads = [
        sfxEl && document.fonts?.load(`80px ${getComputedStyle(sfxEl).fontFamily}`, 'ドン!'),
        jpEl && document.fonts?.load(`700 20px ${getComputedStyle(jpEl).fontFamily}`, '〇一二三四五六七八九十百第巻'),
      ]
      const heroImgs = Array.from(document.querySelectorAll<HTMLImageElement>('#hero img')).slice(0, 2)
      const assets = Promise.all([
        document.fonts?.ready,
        ...fontLoads,
        ...heroImgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))),
      ]).catch(() => {})
      void assets.then(() => {
        ready = true
      })

      const num = el.querySelector<HTMLElement>('[data-s00-num]')
      const numShadow = el.querySelector<HTMLElement>('[data-s00-num-shadow]')
      const kanji = el.querySelector<HTMLElement>('[data-s00-kanji]')
      const bar = q('.s00-bar-fill')
      const kado = el.querySelector<SVGSVGElement>('.s00-kado svg')
      const counter = { v: 0 }
      let last = -1
      const render = () => {
        const v = Math.round(counter.v)
        if (v === last) return
        last = v
        const s = String(v).padStart(2, '0')
        if (num) num.textContent = s
        if (numShadow) numShadow.textContent = s
        if (kanji) kanji.textContent = kanjiNum(v)
        gsap.set(bar, { scaleX: v / 100 })
      }

      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        html.classList.remove('ted-pl')
        html.dataset.preloader = 'done'
        inerted.forEach((c) => c.removeAttribute('inert'))
        window.dispatchEvent(new CustomEvent('ted:preloader-done'))
        setPhase('done')
        requestAnimationFrame(() => ScrollTrigger.refresh())
      }

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' }, onComplete: finish })

      // 1 · ink brush draws the door-bracket wordmark (#24) — panel wipe, outlines, then fills pop
      tl.to(q('.s00-mark [data-panel]'), { clipPath: 'inset(0 0% 0 0)', duration: 0.34, ease: 'power3.out' }, 0)
        .to(q('.s00-mark [data-draw]'), { strokeDashoffset: 0, duration: 0.28, ease: 'ted-ink', stagger: { amount: 0.1 } }, 0.03)
        .to(q('.s00-mark [data-shadow], .s00-mark [data-fill], .s00-mark [data-pop]'), { opacity: 1, duration: 0.1, ease: 'none', stagger: { amount: 0.08 } }, 0.34)
        // Kado peeks up from below and opens his door-head while we count
        .fromTo(q('.s00-kado'), { yPercent: 110 }, { yPercent: 0, duration: 0.4, ease: 'back.out(1.6)' }, 0.06)
        .fromTo(kado, { '--kado-open': 0 }, { '--kado-open': 0.85, duration: 0.5, ease: 'power2.inOut' }, 0.18)
        // 2 · counter 0 → 90 (#06), then wait for real progress (≤ 0.1 s), then → 100
        .to(counter, { v: 90, duration: 0.5, ease: 'power2.inOut', onUpdate: render }, 0.04)
      if (freezeAt == null) {
        tl.addPause(0.54, () => {
          if (ready) return tl.resume()
          const deadline = gsap.delayedCall(0.1, () => tl.resume())
          void assets.then(() => {
            deadline.kill()
            tl.resume()
          })
        })
      }
      tl.to(counter, { v: 100, duration: 0.08, ease: 'power1.out', onUpdate: render }, 0.54)

      // 3 · SLAM — impact frame: 2-frame invert, scale 1.08 → 1, 2-frame shake, speed-line burst, ドン!
      tl.addLabel('slam', 0.62)
        .set(q('.s00-flash'), { opacity: 1 }, 'slam')
        .set(q('.s00-flash'), { opacity: 0 }, 'slam+=0.05')
        .fromTo(q('.s00-mark'), { scale: 1.08 }, { scale: 1, duration: 0.26, ease: 'power4.out' }, 'slam')
        .to(q('.s00-shake'), { x: 11, y: -7, duration: 0.033, ease: 'none' }, 'slam')
        .to(q('.s00-shake'), { x: -9, y: 6, duration: 0.033, ease: 'none' })
        .to(q('.s00-shake'), { x: 0, y: 0, duration: 0.033, ease: 'none' })
        .fromTo(q('.s00-burst'), { scale: 0.5, opacity: 1 }, { scale: 1.35, opacity: 0, duration: 0.4, ease: 'power2.out' }, 'slam')
        .fromTo(q('.s00-don'), { scale: 2.6, rotate: -26, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.2, ease: 'back.out(2.4)' }, 'slam')
        .to(q('.s00-kado'), { y: -16, duration: 0.08, ease: 'power2.out', yoyo: true, repeat: 1 }, 'slam')
        .to(kado, { '--kado-open': 1, duration: 0.14, ease: 'power3.out' }, 'slam')

      // 4 · the door OPENS (#03): content punches forward, leaves swing out, halftone light spills through
      tl.addLabel('open', 'slam+=0.16')
        .to(q('.s00-content'), { scale: 1.07, opacity: 0, duration: 0.2, ease: 'power2.in' }, 'open')
        .to(q('.s00-leaf-l'), { rotateY: 104, duration: 0.4, ease: 'expo.inOut' }, 'open')
        .to(q('.s00-leaf-r'), { rotateY: -104, duration: 0.4, ease: 'expo.inOut' }, 'open')
        .fromTo(q('.s00-spill'), { scaleX: 0, opacity: 1 }, { scaleX: 1.3, duration: 0.3, ease: 'power2.out' }, 'open+=0.05')
        .to(q('.s00-spill'), { opacity: 0, duration: 0.14, ease: 'power1.in' }, 'open+=0.24')

      // fit the remaining budget: if hydration ate into it, play faster (never slower than designed)
      const room = budget.current
      if (room != null && freezeAt == null) tl.timeScale(Math.max(1, tl.duration() / Math.max(room, 0.3)))

      el.dataset.state = 'run'

      // skip / fast-forward: any click, Esc, Enter, Space
      const skip = () => {
        if (finished || freezeAt != null) return
        if (tl.time() < tl.labels.slam) {
          tl.seek('slam')
          counter.v = 100
          render()
        }
        tl.timeScale(Math.max(tl.timeScale(), 1.8)).play()
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          skip()
        }
      }
      el.addEventListener('click', skip)
      window.addEventListener('keydown', onKey)

      if (freezeAt != null) tl.pause(freezeAt)
      else tl.play(0)

      // hard stop: GSAP pauses with rAF (background tab, jank), timers don't — the page is never held past budget
      const hardStop =
        freezeAt == null
          ? window.setTimeout(() => {
              tl.progress(1)
              finish()
            }, Math.max(room ?? BUDGET_MS / 1000, 0.3) * 1000 + 450)
          : undefined

      return () => {
        window.clearTimeout(hardStop)
        el.removeEventListener('click', skip)
        window.removeEventListener('keydown', onKey)
        tl.kill()
        if (!finished) {
          html.classList.remove('ted-pl')
          inerted.forEach((c) => c.removeAttribute('inert'))
        }
      }
    },
    { scope: root, dependencies: [phase] },
  )

  if (phase === 'done') return null

  return (
    <div ref={root} className="s00" data-s00="" data-state={phase}>
      <p role="status" aria-live="polite" className="sr-only">
        {phase === 'run' ? 'Loading The Escape Door' : ''}
      </p>

      <div className="s00-stage" aria-hidden="true">
        <div className="s00-spill" />
        <div className="s00-leaf s00-leaf-l">
          <span className="s00-seam" />
          <span className="s00-knob" />
        </div>
        <div className="s00-leaf s00-leaf-r">
          <span className="s00-seam" />
          <span className="s00-knob" />
        </div>
      </div>

      <div className="s00-content">
        <div className="flex items-start justify-between gap-4 px-4 pt-4 md:px-7 md:pt-6">
          <p className="label leading-relaxed text-tone-4" aria-hidden="true">
            Vol.01 <span className="text-paper">/</span> The Escape Door
            <span className="s00-kanji mt-1 block font-jp text-[13px] font-bold tracking-[0.3em] text-tone-3">第一巻</span>
          </p>
          <button
            type="button"
            className="s00-skip press label focus-ring inline-flex min-h-11 items-center gap-2 border-2 border-paper/70 bg-ink px-4 text-[11px] text-paper hover:border-volt hover:text-volt"
          >
            Skip intro <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="relative grid place-items-center px-4">
          <div className="s00-shake relative">
            <svg className="s00-burst pointer-events-none absolute left-1/2 top-1/2 size-[170%] -translate-x-1/2 -translate-y-1/2" viewBox="-150 -150 300 300" aria-hidden="true">
              {phase === 'run' && (
                <g fill="var(--color-paper)">
                  {burst.map((pts, i) => (
                    <polygon key={i} points={pts} />
                  ))}
                </g>
              )}
            </svg>
            <div className="s00-mark">
              {/* perf: the 79 KB wordmark only exists while the intro actually runs (never in the SSR HTML) */}
              {phase === 'run' ? (
                <Wordmark variant="full" title="" className="relative block size-full" />
              ) : (
                // type-only mark in the SSR HTML: the cover is branded on the very first paint, before JS
                <span className="s00-ssr" aria-hidden="true">
                  <span>The Escape</span>
                  <span className="s00-ssr-door">Door</span>
                </span>
              )}
            </div>
            <div className="s00-don pointer-events-none absolute -right-[4%] -top-[14%] origin-center md:-right-[16%]">
              <Sfx text="ドン!" size="lg" tone="hype" rotate={-9} />
            </div>
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-4 px-4 pb-5 md:px-7 md:pb-7" aria-hidden="true">
          <div className="min-w-0 flex-1">
            <div className="flex items-end gap-3 md:gap-5">
              <div className="relative isolate">
                <span className="s00-num block" data-s00-num="">
                  00
                </span>
                <span className="s00-num s00-num-shadow block" data-s00-num-shadow="">
                  00
                </span>
              </div>
              <div className="pb-2 md:pb-3">
                <span className="s00-kanji block font-jp text-[clamp(18px,2.6vh,28px)] font-bold leading-none text-paper" data-s00-kanji="">
                  〇
                </span>
                <span className="label mt-2 block text-[10px] text-tone-4 md:text-[11px]">Opening the door</span>
              </div>
            </div>
            <div className="mt-3 h-3 w-full max-w-[520px] border-2 border-paper bg-ink md:mt-4">
              <div className="s00-bar-fill h-full origin-left bg-volt" />
            </div>
          </div>
          <div className="s00-kado pointer-events-none -mb-5 shrink-0 md:-mb-7">
            {phase === 'run' ? <Mascot mood="peek" open={0} animate title="" className="block w-[92px] md:w-[150px]" /> : <span className="block aspect-[200/220] w-[92px] md:w-[150px]" />}
          </div>
        </div>
      </div>

      <div className="s00-flash" aria-hidden="true" />
    </div>
  )
}
