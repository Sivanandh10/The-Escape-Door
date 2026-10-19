'use client'
// S04 back-print turntable (#63 #10 #64). Owner: s03-s04-tee.
// Two-sided CSS-3D card (front/back TeeArt faces, rotateY 0→180) with a halftone shading layer masked to the tee.
//  · ≥1024 px + motion: section pinned, scroll scrubs the turn; spec callouts draw leader lines (#64) per face.
//  · <1024 px + motion: no pin — tap "Turn it around" to flip (plus a small wobble hint on enter); numbered legend.
//  · reduced motion: front and back side by side, static.
import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { Product } from '@/lib/types'
import { registerGsap, useReducedMotion, EASE } from '@/lib/motion'
import { TeeArt } from '@/components/shop/TeeArt'
import { Sfx } from '@/components/fx/Sfx'
import { cn } from '@/lib/utils'

registerGsap()

// Same silhouette as src/lib/art/garments.ts TEE_PATH (1000×1100) — used only as a CSS mask for the shading layer.
const TEE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1100'><path d='M405,92 Q500,116 595,92 L815,134 C872,152 928,262 980,420 L822,490 C809,472 796,454 787,434 C793,640 793,860 793,1058 Q500,1074 207,1058 C207,860 207,640 213,434 C204,454 191,472 178,490 L20,420 C72,262 128,152 185,134 Z'/></svg>",
)}")`

type Face = 'front' | 'back'
interface Callout {
  n: number
  face: Face
  /** anchor in % of the 1000×1100 art */
  x: number
  y: number
  side: 'left' | 'right'
  title: string
  value: string
  count?: [number, number]
}
// Facts from the owner's notebook only (front 4×4 in, back 12×15 in, oversized drop-shoulder).
const CALLOUTS: Callout[] = [
  { n: 1, face: 'front', x: 65, y: 24, side: 'right', title: 'Front print', value: '4×4 in', count: [4, 4] },
  { n: 2, face: 'front', x: 18, y: 21, side: 'left', title: 'Oversized', value: 'Drop-shoulder' },
  { n: 3, face: 'back', x: 50, y: 45, side: 'right', title: 'Back print', value: '12×15 in', count: [12, 15] },
  { n: 2, face: 'back', x: 18, y: 21, side: 'left', title: 'Oversized', value: 'Drop-shoulder' },
]
const LEGEND = [
  { n: 1, face: 'front' as Face, title: 'Front print', value: '4×4 in' },
  { n: 2, face: 'both' as const, title: 'Oversized', value: 'drop-shoulder fit' },
  { n: 3, face: 'back' as Face, title: 'Back print', value: '12×15 in' },
]

function Marker({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <span
      data-marker
      aria-hidden="true"
      className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-volt/50 [animation-duration:2.2s]" />
      <span className="relative grid size-7 place-items-center rounded-full border-[3px] border-ink bg-volt font-mono text-[12px] font-bold text-ink">
        {n}
      </span>
    </span>
  )
}

function FaceArt({ product, face, markers = true }: { product: Product; face: Face; markers?: boolean }) {
  const img = product.images.find((i) => i.side === face)
  return (
    <div className="relative h-full w-full">
      <TeeArt product={product} side={face} title={img?.alt ?? `${product.name}, ${face}`} className="h-full w-full" />
      {/* halftone shading — darkens as the face turns away from the light */}
      {product.type === 'tshirt' && (
        <div
          data-shade={face}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 46%, transparent 50%)',
            backgroundSize: '6px 6px',
            maskImage: TEE_MASK,
            WebkitMaskImage: TEE_MASK,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
          }}
        />
      )}
      {markers && CALLOUTS.filter((c) => c.face === face).map((c) => <Marker key={`${face}-${c.n}`} n={c.n} x={c.x} y={c.y} />)}
    </div>
  )
}

export function Turntable({ product, intro }: { product: Product; intro: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [face, setFace] = useState<Face>('front')
  const flipTo = useRef<(f: Face) => void>(() => {})

  useGSAP(
    () => {
      const el = root.current
      if (!el || reduced) return
      const q = gsap.utils.selector(el)
      const card = q('[data-card]')[0]
      const mm = gsap.matchMedia()

      // shared: rotation drives shading + floor + readout
      const angle = { v: 0 }
      const readout = q('[data-angle]')
      const render = () => {
        const a = angle.v
        const s = Math.abs(Math.sin((a * Math.PI) / 180))
        gsap.set(card, { rotationY: a })
        gsap.set(q('[data-shade="front"]'), { opacity: Math.min(0.85, s * 0.95) })
        gsap.set(q('[data-shade="back"]'), { opacity: Math.min(0.85, s * 0.95) })
        gsap.set(q('[data-floor]'), { scaleX: 1 - s * 0.55 })
        readout.forEach((r) => (r.textContent = `${String(Math.round(a)).padStart(3, '0')}°`))
      }

      mm.add('(min-width: 1024px)', () => {
        const lines = (f: Face) => q(`[data-callout][data-face="${f}"] [data-line]`)
        const labels = (f: Face) => q(`[data-callout][data-face="${f}"] [data-label]`)
        const markers = (f: Face) => q(`[data-face-el="${f}"] [data-marker]`)
        gsap.set([...lines('front'), ...lines('back')], { scaleX: 0 })
        gsap.set([...labels('front'), ...labels('back')], { autoAlpha: 0, y: 12 })
        gsap.set([...markers('front'), ...markers('back')], { scale: 0 })
        gsap.set(q('[data-cta]'), { autoAlpha: 0, scale: 0.4, rotate: -18 })
        gsap.set(q('[data-word="back"]'), { autoAlpha: 0 })
        gsap.set(q('[data-turn-sfx]'), { autoAlpha: 0, scale: 0.3 })
        const counts = q('[data-count]')
        const countUp = (f: Face) => {
          const obj = { p: 0 }
          return gsap.to(obj, {
            p: 1, duration: 0.1, ease: 'none',
            onUpdate: () => {
              counts.filter((c) => c.dataset.face === f).forEach((c) => {
                const [w, h] = (c.dataset.count ?? '0,0').split(',').map(Number)
                c.textContent = `${Math.max(1, Math.round(w * obj.p))}×${Math.max(1, Math.round(h * obj.p))} in`
              })
            },
          })
        }

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: q('[data-pin]')[0],
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 0.7,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => gsap.set(q('[data-progress]'), { scaleX: self.progress }),
          },
        })
        // 1 · front specs draw in
        tl.to(markers('front'), { scale: 1, duration: 0.06, ease: EASE.slam, stagger: 0.03 }, 0.02)
          .to(lines('front'), { scaleX: 1, duration: 0.08, ease: 'power2.out', stagger: 0.04 }, 0.05)
          .to(labels('front'), { autoAlpha: 1, y: 0, duration: 0.06, stagger: 0.04 }, 0.09)
          .add(countUp('front'), 0.09)
          // 2 · retract, then turn (light falls off at 90°)
          .to(labels('front'), { autoAlpha: 0, y: -10, duration: 0.05 }, 0.3)
          .to(lines('front'), { scaleX: 0, duration: 0.05 }, 0.3)
          .to(markers('front'), { scale: 0, duration: 0.04 }, 0.32)
          .to(angle, { v: 180, duration: 0.38, ease: 'power2.inOut', onUpdate: render }, 0.34)
          .to(q('[data-turn-sfx]'), { autoAlpha: 1, scale: 1, duration: 0.06, ease: EASE.slam }, 0.46)
          .to(q('[data-turn-sfx]'), { autoAlpha: 0, scale: 1.2, duration: 0.06 }, 0.6)
          .to(q('[data-word="front"]'), { autoAlpha: 0, duration: 0.04 }, 0.5)
          .to(q('[data-word="back"]'), { autoAlpha: 1, duration: 0.04 }, 0.52)
          // 3 · back specs
          .to(markers('back'), { scale: 1, duration: 0.06, ease: EASE.slam, stagger: 0.03 }, 0.74)
          .to(lines('back'), { scaleX: 1, duration: 0.08, ease: 'power2.out', stagger: 0.04 }, 0.77)
          .to(labels('back'), { autoAlpha: 1, y: 0, duration: 0.06, stagger: 0.04 }, 0.8)
          .add(countUp('back'), 0.8)
          // 4 · custom sticker slams
          .to(q('[data-cta]'), { autoAlpha: 1, scale: 1, rotate: -6, duration: 0.07, ease: EASE.slam }, 0.9)
          .to({}, { duration: 0.04 }, 0.96)
        return () => {
          angle.v = 0
          render()
        }
      })

      mm.add('(max-width: 1023.98px)', () => {
        flipTo.current = (f: Face) => {
          gsap.to(angle, { v: f === 'back' ? 180 : 0, duration: 0.95, ease: 'back.out(1.15)', onUpdate: render, overwrite: true })
          gsap.fromTo(q('[data-turn-sfx]'), { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: EASE.slam, yoyo: true, repeat: 1, repeatDelay: 0.25 })
        }
        // wobble hint once the tee is on screen
        const hint = gsap.timeline({ paused: true })
          .to(angle, { v: -28, duration: 0.45, ease: 'power2.out', onUpdate: render })
          .to(angle, { v: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', onUpdate: render })
        const st = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 65%', once: true, onEnter: () => hint.play() } })
        return () => {
          hint.kill()
          st.kill()
          flipTo.current = () => {}
          angle.v = 0
          render()
        }
      })
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  )

  const flip = () => {
    const next: Face = face === 'front' ? 'back' : 'front'
    setFace(next)
    flipTo.current(next)
  }

  if (reduced) {
    return (
      <div ref={root} className="container-x section-y">
        {intro}
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {(['front', 'back'] as Face[]).map((f) => (
            <figure key={f} className="panel-ink relative p-4">
              <div className="mx-auto aspect-[1000/1100] w-full max-w-[420px]">
                <FaceArt product={product} face={f} />
              </div>
              <figcaption className="label mt-3 text-tone-4">{f === 'front' ? '表 · Front — chest mark' : '裏 · Back — full print'}</figcaption>
            </figure>
          ))}
        </div>
        <Legend face="both" />
        <CustomLink className="mt-6" />
      </div>
    )
  }

  return (
    <div ref={root}>
      <div data-pin className="relative overflow-hidden lg:h-svh lg:min-h-[640px]">
        {/* giant outline word behind the tee (#47 echo) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden items-center justify-end overflow-hidden pr-[2vw] lg:flex">
          <span data-word="front" className="outline-text absolute font-display text-[24vw] uppercase leading-none opacity-[0.14]">Front</span>
          <span data-word="back" className="outline-text absolute font-display text-[24vw] uppercase leading-none opacity-[0.14]">Back</span>
        </div>

        <div className="container-x relative grid h-full gap-x-10 gap-y-10 py-[clamp(72px,10vw,120px)] lg:grid-cols-12 lg:items-center lg:py-0">
          <div className="lg:col-span-4">
            {intro}
            {/* progress: front → back */}
            <div className="mt-8 hidden max-w-[360px] lg:block" aria-hidden="true">
              <div className="label flex justify-between text-tone-4">
                <span>表 Front</span>
                <span data-angle className="text-volt">000°</span>
                <span>Back 裏</span>
              </div>
              <div className="mt-2 h-2 border-2 border-paper">
                <div data-progress className="h-full origin-left scale-x-0 bg-volt" />
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-8">
            <div
              className="relative mx-auto aspect-[1000/1100] w-[min(84vw,460px)] lg:w-[min(46vw,calc((100svh-140px)*0.909),560px)]"
              style={{ perspective: '1600px' }}
            >
              {/* floor spotlight */}
              <div aria-hidden="true" className="absolute inset-x-[10%] bottom-[-5%] h-[9%]">
                <div
                  data-floor
                  className="h-full w-full rounded-[50%]"
                  style={{ backgroundImage: 'radial-gradient(circle, #6D3BFF 40%, transparent 44%)', backgroundSize: '8px 8px' }}
                />
              </div>
              <div data-card className="relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
                <div data-face-el="front" className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                  <FaceArt product={product} face="front" />
                </div>
                <div
                  data-face-el="back"
                  className="absolute inset-0"
                  style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <FaceArt product={product} face="back" />
                </div>
              </div>

              {/* desktop callouts with leader lines (#64) */}
              {CALLOUTS.map((c, i) => (
                <div
                  key={i}
                  data-callout
                  data-face={c.face}
                  aria-hidden="true"
                  className="pointer-events-none absolute hidden lg:block"
                  style={{ top: `${c.y}%`, left: 0, right: 0 }}
                >
                  <span
                    data-line
                    className={cn('absolute top-0 h-[3px] bg-volt', c.side === 'right' ? 'origin-left' : 'origin-right')}
                    style={
                      c.side === 'right'
                        ? { left: `${c.x}%`, width: `calc(${100 - c.x}% + 28px)` }
                        : { right: `${100 - c.x}%`, width: `calc(${c.x}% + 28px)` }
                    }
                  />
                  <span
                    data-label
                    className={cn(
                      'absolute top-0 block w-[clamp(120px,11vw,170px)] -translate-y-1/2 border-[3px] border-ink bg-paper px-3 py-2 text-ink shadow-hard-volt',
                      c.side === 'right' ? 'left-[calc(100%+28px)]' : 'right-[calc(100%+28px)] text-right',
                    )}
                  >
                    <span className="label block text-ink/70">
                      {c.n} · {c.title}
                    </span>
                    <span
                      className="mt-1 block font-display text-[clamp(22px,2vw,30px)] uppercase leading-none"
                      {...(c.count ? { 'data-count': c.count.join(','), 'data-face': c.face } : {})}
                    >
                      {c.value}
                    </span>
                  </span>
                </div>
              ))}

              {/* turn SFX */}
              <div data-turn-sfx aria-hidden="true" className="pointer-events-none absolute -right-[4%] top-[6%] opacity-0">
                <Sfx text="クルッ!" tone="volt" rotate={-10} style={{ fontSize: 'clamp(40px, 5vw, 72px)' }} />
              </div>

              {/* custom sticker CTA (desktop: slams in at the end of the turn) */}
              <div data-cta className="absolute -bottom-[2%] -right-[10%] hidden lg:block">
                <CustomLink sticker />
              </div>
            </div>

            {/* mobile / tablet: flip control + legend */}
            <div className="mx-auto mt-10 max-w-[460px] lg:hidden">
              <button
                type="button"
                onClick={flip}
                aria-pressed={face === 'back'}
                className="press focus-ring flex h-14 w-full items-center justify-center gap-3 border-[3px] border-paper bg-volt font-display text-[22px] uppercase text-ink shadow-hard-door"
              >
                <span aria-hidden="true" className={cn('inline-block transition-transform duration-500', face === 'back' && 'rotate-180')}>
                  ↻
                </span>
                {face === 'front' ? 'Turn it around' : 'Back to the front'}
                <span data-angle aria-hidden="true" className="font-mono text-[13px] opacity-60">
                  000°
                </span>
              </button>
              <p className="sr-only" aria-live="polite">
                Showing the {face} of the tee.
              </p>
              <Legend face={face} />
              <CustomLink className="mt-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend({ face }: { face: Face | 'both' }) {
  return (
    <ol className="mt-6 grid gap-2">
      {LEGEND.map((l) => {
        const on = face === 'both' || l.face === 'both' || l.face === face
        return (
          <li
            key={l.n}
            className={cn(
              'flex items-center gap-3 border-[3px] px-3 py-2.5 transition-[opacity,border-color] duration-200',
              on ? 'border-volt opacity-100' : 'border-tone-2 opacity-45',
            )}
          >
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-volt font-mono text-[12px] font-bold text-ink">
              {l.n}
            </span>
            <span className="label text-tone-4">{l.title}</span>
            <span className="ml-auto font-display text-[22px] uppercase leading-none">{l.value}</span>
          </li>
        )
      })}
    </ol>
  )
}

function CustomLink({ sticker, className }: { sticker?: boolean; className?: string }) {
  return (
    <Link
      href="/custom"
      data-cursor="OPEN"
      className={cn(
        'focus-ring press group block border-[3px] border-ink text-ink',
        sticker ? 'w-[200px] bg-pink px-4 py-3 shadow-hard-paper' : 'bg-paper px-4 py-3 shadow-hard-volt',
        className,
      )}
    >
      <span className="label block text-ink/70">Custom front / back available</span>
      <span className="mt-1 flex items-center justify-between gap-2 font-display text-[24px] uppercase leading-none">
        Open the Forge
        <span aria-hidden="true" className="transition-transform duration-200 can-hover:group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  )
}

export default Turntable
