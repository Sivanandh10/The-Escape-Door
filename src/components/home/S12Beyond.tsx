'use client'
// S12 BEYOND ANIME (#02 circle reveal · #18 background colour shift). Owner: s12.
// One door (pink/paper). Scroll swings its leaves open, then a circle iris grows out of the
// doorway and reveals six original typographic sub-fandom tiles; the section tints ink → pink
// and the page arc theme switches to beyond-anime while it is in view.
// SSR + reduced motion = the final (open, pink) state, so content never depends on JS.
import './s12/s12.css'
import Link from 'next/link'
import { useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight } from 'lucide-react'
import type { Collection } from '@/lib/types'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { useArcTheme } from '@/components/Providers'
import { Screentone } from '@/components/fx/Screentone'
import { Sfx } from '@/components/fx/Sfx'
import { Reveal } from '@/components/motion/Reveal'
import { ALSO_BEHIND, FANDOM_TILES } from './s12/fandoms'

registerGsap()

const SPARKLES: [number, number, number][] = [
  [22, 18, 10], [74, 26, 14], [38, 54, 8], [70, 70, 11], [18, 80, 7], [56, 40, 6],
]

export default function S12Beyond({ collection }: { collection?: Collection | null }) {
  const root = useRef<HTMLElement>(null)
  const { set: setArc } = useArcTheme()
  const ours = useRef(false)
  const slug = collection?.slug ?? 'beyond-anime'
  const href = `/arc/${slug}`

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const q = gsap.utils.selector(el)

      // #18 page tint (arc theme) while the section owns the viewport centre
      const tint = ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (self.isActive) {
            ours.current = true
            setArc(slug)
          } else if (ours.current) {
            ours.current = false
            setArc(null)
          }
        },
      })

      if (prefersReducedMotion()) return () => tint.kill()

      const mm = gsap.matchMedia()
      mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)' }, (ctx) => {
        const desktop = Boolean(ctx.conditions?.desktop)
        const stage = q('.s12-stage')[0]
        const tiles = q('.s12-tile')

        gsap.set(el, { '--s12-bg': '#0B0B0F', '--s12-fg': '#F4EFE6', '--s12-line': '#F4EFE6' })
        gsap.set(q('.s12-world'), { clipPath: 'circle(0% at 50% 50%)' })
        gsap.set(q('.s12-leaf-l'), { rotateY: 0 })
        gsap.set(q('.s12-leaf-r'), { rotateY: 0 })
        gsap.set(q('.s12-spill'), { autoAlpha: 0.25, scaleY: 0.4 })
        gsap.set(tiles, { autoAlpha: 0, y: 34, scale: 0.9, rotate: (i: number) => (i % 2 ? 2.5 : -2.5) })
        gsap.set(q('.s12-kira'), { autoAlpha: 0, scale: 0.4 })

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage,
            start: desktop ? 'top 82%' : 'top 88%',
            end: desktop ? 'center 46%' : 'center 52%',
            scrub: 0.6,
          },
        })
        // 1. leaves swing open, light spills out of the doorway
        tl.to(q('.s12-leaf-l'), { rotateY: -112, duration: 0.34, ease: 'power2.in' }, 0)
          .to(q('.s12-leaf-r'), { rotateY: 112, duration: 0.34, ease: 'power2.in' }, 0.02)
          .to(q('.s12-spill'), { autoAlpha: 1, scaleY: 1, duration: 0.3, ease: 'power2.out' }, 0.08)
          .to(q('.s12-door'), { scale: 1.06, duration: 0.3, ease: 'power1.in' }, 0.12)
          // 2. #02 iris grows out of the doorway
          .to(q('.s12-world'), { clipPath: 'circle(75% at 50% 50%)', duration: 0.5, ease: 'power3.inOut' }, 0.32)
          // 3. tiles settle in a stagger, sparkle SFX
          .to(tiles, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.3, stagger: 0.04, ease: 'back.out(1.6)' }, 0.5)
          .to(q('.s12-kira'), { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'back.out(2.4)' }, 0.78)
          // 4. #18 the whole section tints ink → pink
          .to(el, { '--s12-bg': '#FFB8DE', '--s12-fg': '#0B0B0F', '--s12-line': '#0B0B0F', duration: 0.22 }, 0.66)
      })

      return () => {
        tint.kill()
        mm.revert()
        if (ours.current) {
          ours.current = false
          setArc(null)
        }
      }
    },
    { scope: root, dependencies: [slug] },
  )

  return (
    <section
      ref={root}
      id="beyond"
      aria-labelledby="beyond-title"
      data-arc={slug}
      className="s12 relative overflow-hidden border-t-4 border-ink section-y"
    >
      <div className="container-x">
        {/* header */}
        <Reveal className="max-w-[1100px]">
          <p className="label opacity-80">Chapter 12 · Door 06 · Beyond anime</p>
          <h2 id="beyond-title" className="h-display mt-4 max-w-[17ch] text-h2">
            Beyond anime: K-pop, F1, films and <em>more</em>
          </h2>
          <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block opacity-70">
            {collection?.jp ?? 'その先へ'} · もうひとつの扉
          </span>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-12">
          {/* copy column */}
          <Reveal className="flex flex-col gap-6 lg:col-span-4 lg:pt-2" stagger={0.06}>
            <p className="max-w-[46ch] text-[1.0625rem] leading-relaxed">
              {collection?.tagline ? <strong className="font-bold">{collection.tagline} </strong> : null}
              {collection?.blurb ??
                'Book quotes, stadium-tour sparkle, wizard-school candlelight, K-pop encores, pit-lane speed and animated-film warmth. Original designs, one door.'}
            </p>
            <div>
              <p className="label opacity-70">Also behind this door</p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="More fandoms in Beyond Anime">
                {ALSO_BEHIND.map((x) => (
                  <li
                    key={x}
                    className="border-2 px-2.5 py-1 font-mono text-[0.75rem] uppercase tracking-[0.12em]"
                    style={{ borderColor: 'var(--s12-line)' }}
                  >
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col lg:items-start">
              <Link
                href={href}
                data-cursor="OPEN"
                data-cursor-jp="開"
                className="press focus-ring label inline-flex min-h-12 items-center justify-center gap-2 border-[3px] bg-volt px-6 py-3 font-bold text-ink"
                style={{ borderColor: 'var(--s12-line)', boxShadow: '6px 6px 0 0 var(--s12-line)' }}
              >
                Open the Beyond Anime door
                <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </Link>
              <Link
                href="/custom"
                className="focus-ring label inline-flex min-h-11 items-center gap-2 font-bold underline decoration-2 underline-offset-[6px] hover:decoration-[4px]"
              >
                Don&apos;t see yours? Make it custom
              </Link>
            </div>
          </Reveal>

          {/* stage: door → iris → tiles */}
          <div className="s12-stage relative isolate overflow-hidden lg:col-span-8">
            {/* door layer (decorative) */}
            <div aria-hidden="true" className="absolute inset-0 bg-ink">
              <Screentone density="light" color="var(--color-pink)" opacity={0.22} fade="radial" />
              <p className="label absolute left-4 top-4 text-pink">Door 06 / 06</p>
              <p className="label absolute bottom-4 right-4 text-paper/60">Scroll to open ↓</p>
              <div className="absolute inset-0 grid place-items-center">
                <div className="s12-door relative w-[clamp(132px,24%,220px)]">
                  {/* lintel sign */}
                  <div className="relative z-10 mx-auto -mb-[3px] w-[78%] border-[3px] border-ink bg-volt py-1 text-center font-jp text-[clamp(10px,1.1vw,14px)] font-black tracking-[0.3em] text-ink">
                    その先へ
                  </div>
                  {/* frame */}
                  <div className="border-[3px] border-ink bg-paper p-[7%] pb-0 shadow-[8px_8px_0_0_var(--color-pink)]">
                    <div className="s12-doorway relative aspect-[0.56] border-[3px] border-ink bg-pink">
                      {/* what's inside: pink light + sparkles */}
                      <Screentone density="dense" color="var(--color-ink)" opacity={0.2} fade="edge" />
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
                        {SPARKLES.map(([x, y, s], i) => (
                          <path
                            key={i}
                            className="s12-sparkle"
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            d={`M${x} ${y - s / 2} L${x + s / 8} ${y - s / 8} L${x + s / 2} ${y} L${x + s / 8} ${y + s / 8} L${x} ${y + s / 2} L${x - s / 8} ${y + s / 8} L${x - s / 2} ${y} L${x - s / 8} ${y - s / 8} Z`}
                            fill="#F4EFE6"
                            stroke="#0B0B0F"
                            strokeWidth="0.8"
                          />
                        ))}
                      </svg>
                      {/* leaves */}
                      <Leaf side="l" />
                      <Leaf side="r" />
                    </div>
                  </div>
                  {/* threshold light spill */}
                  <div
                    className="s12-spill absolute left-1/2 top-full h-[40%] w-[150%] -translate-x-1/2 origin-top"
                    style={{ clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0 100%)' }}
                  >
                    <Screentone density="mid" color="var(--color-pink)" opacity={0.85} fade="bottom" />
                  </div>
                </div>
              </div>
            </div>

            {/* world layer: the sub-fandom tiles */}
            <div className="s12-world relative bg-pink p-3 sm:p-4 lg:p-5">
              <Screentone density="mid" color="var(--color-ink)" opacity={0.12} fade="edge" />
              <span className="s12-kira absolute -right-2 top-0 z-10 hidden sm:block">
                <Sfx text="キラッ" size="md" tone="paper" rotate={8} />
              </span>
              <ul className="relative grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-label="Pick another fandom">
                {FANDOM_TILES.map((t, i) => (
                  <li key={t.f}>
                    <Link
                      href={`${href}?f=${t.f}`}
                      data-cursor="OPEN"
                      className="s12-tile group relative flex h-full min-h-[148px] flex-col overflow-hidden border-[3px] border-ink p-3 sm:min-h-[184px] sm:p-4 lg:min-h-[206px]"
                      style={{ '--tile-bg': t.bg, '--tile-fg': t.fg } as CSSProperties}
                    >
                      <Screentone className="s12-tone" density="light" color="currentColor" opacity={0.18} />
                      <span className="relative flex items-start justify-between gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        <span lang="ja" aria-hidden="true" className="font-jp font-bold tracking-[0.2em] opacity-75">
                          {t.jp}
                        </span>
                      </span>
                      <span aria-hidden="true" className="pointer-events-none relative mx-auto my-2 block h-[58px] w-[86px] sm:h-[72px] sm:w-[104px]">
                        {t.doodle}
                      </span>
                      <span className="relative mt-auto flex items-end justify-between gap-2">
                        <span>
                          <span className="block font-display text-[clamp(1.5rem,2.6vw,2.5rem)] uppercase leading-[0.88]">
                            {t.name}
                          </span>
                          <span className="mt-1.5 block text-[0.75rem] leading-snug opacity-80 sm:text-[0.8125rem]">{t.line}</span>
                        </span>
                        <ArrowUpRight aria-hidden="true" className="s12-arrow size-5 shrink-0" strokeWidth={2.5} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Leaf({ side }: { side: 'l' | 'r' }) {
  const l = side === 'l'
  return (
    <div
      className={`s12-leaf s12-leaf-${side} absolute top-0 h-full w-1/2 border-ink bg-pink ${l ? 'left-0 border-r-[1.5px]' : 'right-0 border-l-[1.5px]'}`}
      style={{ transform: `rotateY(${l ? -112 : 112}deg)` }}
    >
      <div className="absolute inset-x-[16%] top-[7%] h-[38%] border-2 border-ink bg-paper/70" />
      <div className="absolute inset-x-[16%] bottom-[7%] h-[42%] border-2 border-ink bg-paper/70">
        <Screentone density="light" color="var(--color-pink)" opacity={0.9} />
      </div>
      <span
        className={`absolute top-1/2 size-[clamp(8px,1vw,12px)] -translate-y-1/2 rounded-full border-2 border-ink bg-volt ${l ? 'right-[8%]' : 'left-[8%]'}`}
      />
    </div>
  )
}
