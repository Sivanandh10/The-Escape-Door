// S01 HERO — "the volume cover": a manga page whose panels slam together on diagonal gutters, with THE DOOR
// in the centre panel. Scroll opens it onto a floating product object in the light (static set; scroll swaps
// tee → hoodie → back print → polaroids) + a chip linking to that category. Desktop: the panel grows to full
// screen and the camera walks up to the threshold.
// Phones/tablets: the door panel sticks (CSS sticky — native touch scroll, no JS pin) while it opens.
// Owner: S01. Techniques: #22 (R3F door, gated) · #15 (portal → full screen) · #04 (split-text wipe) ·
// #30 (magnetic CTA) · #47 (vertical type rails + giant 扉) · #58 (halftone light) · #37 ticker.
// Server component: the H1 is in the HTML and visible from the first paint (it is the LCP).
// Copy (kicker, H1, subline, ticker) comes from Admin → Settings via getSettings() (tag 'settings').
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Product, SiteSettings } from '@/lib/types'
import { Halftone } from '@/components/fx/Halftone'
import { Sfx } from '@/components/fx/Sfx'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Ticker } from '@/components/fx/Ticker'
import { VerticalType } from '@/components/fx/VerticalType'
import { Magnetic } from '@/components/motion/Magnetic'
import { DoorIcon } from '@/components/brand'
import { cn } from '@/lib/utils'
import { CssDoor } from './s01/CssDoor'
import { HeroMotion, P2_REST } from './s01/HeroMotion'
import { Portal3DGate } from './s01/Portal3DGate'
import { HeroCutouts } from './s01/HeroCutouts'
import { DoorObject, ObjectChip } from './s01/HeroObject'
import st from './s01/hero.module.css'

const DEFAULTS = {
  heroKicker: 'Original anime merch · India',
  heroTitle: 'Anime merch, drawn like a living manga volume',
  heroSub:
    'Oversized tees, hoodies, polaroids, posters and props — original fan-inspired designs at student prices, custom-made on demand. Pick your arc.',
  tickerWords: ['YOU ARE MY SPECIAL', 'PICK YOUR ARC', 'ドン', 'CUSTOM MADE'],
}

/** Desktop (≥1024) panel polygons in % of the stage. Mobile uses short diagonal cuts. */
const CLIP = {
  p1: 'polygon(5.2% 3%, 60% 3%, 52% 86%, 5.2% 86%)',
  p2: P2_REST,
  p3: 'polygon(55.4% 63.5%, 73.5% 63.5%, 71.5% 86%, 53.2% 86%)',
  p4: 'polygon(74.7% 63.5%, 94.8% 63.5%, 94.8% 86%, 72.7% 86%)',
  m1: 'polygon(0 0, 100% 0, 100% calc(100% - 26px), 0 100%)',
  m2: 'polygon(0 0, 100% 26px, 100% 100%, 0 100%)',
  m3: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
  m4: 'polygon(14px 0, 100% 0, 100% 100%, 0 100%)',
}
const clip = (m: string, lg: string) => ({ '--clip-m': m, '--clip-lg': lg }) as CSSProperties
const CLIP_CLS = '[clip-path:var(--clip-m)] lg:[clip-path:var(--clip-lg)]'
const LAYER = 'relative lg:absolute lg:inset-0'

/** "What do they sell?" in one line — links straight into the shop categories. */
const CATEGORIES = [
  { href: '/shop/oversized-t-shirts', label: 'Tees' },
  { href: '/shop/hoodies', label: 'Hoodies' },
  { href: '/shop/polaroids', label: 'Polaroids' },
  { href: '/shop/posters', label: 'Posters' },
  { href: '/shop/cosplay-props', label: 'Cosplay' },
]

/** Wrap the accent word ("living", else the last word) in <em> — admin can edit heroTitle. */
function Title({ text }: { text: string }) {
  const words = text.trim().split(/\s+/)
  let i = words.findIndex((w) => /^living\b/i.test(w))
  if (i < 0) i = words.length - 1
  return (
    <>
      {words.slice(0, i).join(' ')} <em>{words[i]}</em>
      {i < words.length - 1 ? ` ${words.slice(i + 1).join(' ')}` : ''}
    </>
  )
}

export default function S01Hero({ settings, products }: { settings?: SiteSettings; products?: Product[] }) {
  // empty admin fields fall back to the defaults (never an empty H1)
  const s = { ...DEFAULTS, ...settings }
  for (const k of ['heroKicker', 'heroTitle', 'heroSub'] as const) if (!s[k]?.trim()) s[k] = DEFAULTS[k]
  const ticker = s.tickerWords?.length ? s.tickerWords : DEFAULTS.tickerWords

  return (
    <section id="hero" data-hold-header aria-labelledby="hero-title" className="relative overflow-x-clip bg-paper">
      <HeroMotion className="grain relative bg-paper lg:h-[calc(100svh-var(--header-h))] lg:min-h-[600px]">
        <div data-shake className="flex flex-col gap-3 p-3 pb-0 md:gap-4 md:p-4 md:pb-0 lg:absolute lg:inset-0 lg:block lg:p-0">
          {/* ── vertical rails (#47, ≥1024) ── */}
          <div data-rail data-slam="t" data-reveal="pending" className="absolute inset-y-0 left-0 hidden w-[5.2%] text-ink lg:block" aria-hidden="true">
            <VerticalType text="THE ESCAPE DOOR" side="left" repeat={3} size="min(3.9vw, 8.4svh)" className="absolute inset-0 justify-center" />
          </div>
          <div data-rail data-slam="t" data-reveal="pending" className="absolute inset-y-0 right-0 hidden w-[5.2%] text-ink lg:block" aria-hidden="true">
            <VerticalType
              text="THE ESCAPE DOOR"
              side="right"
              outline
              repeat={3}
              jp="逃げ道"
              size="min(3.9vw, 8.4svh)"
              className="absolute inset-0 justify-center [--stroke-c:var(--color-ink)]"
            />
          </div>

          {/* ── P1: the cover copy (LCP lives here — never hidden) ── */}
          <div data-p1 className={`${LAYER} z-[1] bg-ink text-paper ${CLIP_CLS}`} style={clip(CLIP.m1, CLIP.p1)}>
            <span
              aria-hidden="true"
              className="outline-text pointer-events-none absolute -right-[4%] bottom-[-6%] select-none font-jp text-[56vw] font-black leading-none [--stroke-c:var(--color-tone-2)] [--stroke-w:2px] lg:right-[44%] lg:bottom-[10%] lg:text-[min(30vw,62svh)]"
            >
              扉
            </span>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 text-tone-2 [mask-image:linear-gradient(to_bottom,#000,transparent)] lg:hidden" aria-hidden="true">
              <div className="h-full w-full bg-current" style={{ WebkitMaskImage: 'var(--tone-mid)', maskImage: 'var(--tone-mid)' }} />
            </div>
            {/* tees · hoodies · polaroids floating behind the copy — "this is a merch store" at a glance */}
            <HeroCutouts products={products} />
            <div
              data-p1-inner
              className="relative px-5 pb-14 pt-9 md:px-8 md:pb-16 md:pt-12 lg:absolute lg:left-[7.4%] lg:top-[7.5%] lg:w-[41%] lg:p-0"
            >
              <p data-soft data-reveal="pending" className="label flex items-center gap-2 text-volt">
                <span className="inline-block size-2 bg-hype" aria-hidden="true" />
                {s.heroKicker}
              </p>
              <h1
                id="hero-title"
                data-hero-h1
                className="h-display mt-4 text-[clamp(52px,14.2vw,96px)] leading-[0.86] md:max-w-[11ch] lg:mt-5 lg:max-w-none lg:text-[min(6.9vw,11.6svh)]"
              >
                <Title text={s.heroTitle} />
              </h1>
              <p
                data-soft
                data-reveal="pending"
                className="mt-5 max-w-[44ch] text-[16px] leading-[1.55] text-tone-4 md:text-[18px] lg:mt-6 lg:text-[clamp(15px,1.25vw,18px)]"
              >
                {s.heroSub}
              </p>
              <div data-soft data-reveal="pending" className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center lg:mt-8">
                <Magnetic className="w-full sm:w-auto" strength={0.4}>
                  <span className={cn(st.ctaWrap, 'w-full sm:w-auto')}>
                    <span aria-hidden="true" className={st.ctaRing} />
                    <Link
                      href="/shop"
                      data-cursor="SHOP"
                      data-cursor-jp="ショップ"
                      className={cn(
                        st.cta,
                        'focus-ring inline-flex min-h-16 w-full items-center justify-center gap-2.5 whitespace-nowrap border-[3px] border-ink bg-volt px-5 font-display text-[clamp(21px,6.4vw,26px)] uppercase leading-none tracking-[0.02em] text-ink shadow-hard-paper sm:w-auto sm:gap-3 sm:px-8 lg:min-h-[4.25rem] lg:text-[clamp(24px,2vw,30px)]',
                      )}
                    >
                      <DoorIcon size={26} strokeWidth={2.4} />
                      Shop the drop
                      <span aria-hidden="true" className={cn(st.ctaArrow, 'font-mono text-[24px] leading-none')}>
                        →
                      </span>
                    </Link>
                    <span
                      aria-hidden="true"
                      className={cn(st.sticker, 'border-2 border-ink bg-hype px-1.5 py-1 font-display text-[14px] uppercase leading-none text-paper shadow-[2px_2px_0_0_var(--color-ink)]')}
                    >
                      New
                    </span>
                  </span>
                </Magnetic>
                <Link
                  href="/custom"
                  data-cursor="DESIGN"
                  className="press focus-ring inline-flex min-h-14 w-full items-center justify-center gap-2 border-[3px] border-paper px-6 font-display text-[20px] uppercase tracking-[0.02em] text-paper transition-colors duration-150 hover:bg-paper hover:text-ink sm:w-auto"
                >
                  Design Your Own
                  <span aria-hidden="true" className="font-mono text-[15px]">
                    →
                  </span>
                </Link>
              </div>
              <nav data-soft data-reveal="pending" aria-label="Shop by type" className="mt-4 hidden lg:mt-5 lg:block">
                <ul className="-mx-1 flex flex-wrap items-center gap-x-2">
                  {CATEGORIES.map((c) => (
                    <li key={c.href} className="flex items-center">
                      <Link
                        href={c.href}
                        className="focus-ring inline-flex min-h-11 items-center gap-1.5 px-1 font-mono before:size-1.5 before:shrink-0 before:bg-volt before:content-[''] text-[12px] font-bold uppercase tracking-[0.14em] text-paper/85 underline decoration-transparent decoration-2 underline-offset-[6px] transition-colors duration-150 hover:text-volt hover:decoration-volt md:text-[13px]"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          {/* ── P2: THE DOOR PORTAL ──
               < lg: the panel is CSS-sticky inside a taller track; the track's extra height is the scroll distance
               over which the door opens (HeroMotion scrubs it — native touch scroll, no JS pin).
               ≥ lg: absolute panel inside the GSAP-pinned stage. */}
          <div data-door-track className="max-lg:relative lg:contents">
            <div
              data-portal
              data-slam="r"
              data-reveal="pending"
              data-3d="off"
              className={`group/portal z-[3] h-[calc(100svh-var(--header-h)-20px)] max-h-[780px] min-h-[440px] md:max-h-[920px] overflow-hidden bg-ink max-lg:sticky max-lg:top-[calc(var(--header-h)+10px)] lg:absolute lg:inset-0 lg:h-auto lg:max-h-none lg:min-h-0 ${CLIP_CLS}`}
              style={clip(CLIP.m2, CLIP.p2)}
            >
              <div
                data-scene
                className="absolute inset-0 [--door-h:64%] sm:[--door-h:68%] lg:[--door-h:46%] lg:[--px:26.6%] lg:[--py:-17.75%]"
                style={{ translate: 'var(--px, 0%) var(--py, 0%)' }}
              >
                <div className="absolute inset-0 group-data-[3d=on]/portal:invisible" aria-hidden="true">
                  <Halftone shape="radial" color="var(--color-door)" dotSize={11} className="absolute inset-0 opacity-90" />
                </div>
                <div
                  data-door-knock
                  className="absolute inset-0 flex items-center justify-center pb-[14%] group-data-[3d=on]/portal:invisible lg:pb-0"
                  aria-hidden="true"
                >
                  <CssDoor>
                    <DoorObject />
                  </CssDoor>
                </div>
                <Portal3DGate />
              </div>
              {/* panel caption (manga narration box) — on phones it is also the scroll cue */}
              <p data-caption className="label absolute left-4 top-9 z-[1] border-2 border-ink bg-paper px-2 py-1 text-ink lg:left-[62.2%] lg:top-[5.4%]">
                扉 · <span className="lg:hidden motion-reduce:hidden">Scroll to open ↓</span>
                <span className="hidden lg:inline motion-reduce:inline">The door</span>
              </p>
              {/* what's behind the door: the object on show + a link to its category */}
              <ObjectChip className="absolute inset-x-3 bottom-5 z-[3] pl-14 lg:inset-x-[8%] lg:bottom-[6%] lg:pl-0" />
              {/* the burst the camera lands in → hands over to S02 */}
              <div data-burst className="invisible absolute inset-0 z-[4] bg-volt opacity-0" aria-hidden="true">
                <SpeedLines color="var(--color-ink)" intensity={0.85} inner={0.22} animated seed={4} className="absolute inset-0" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <p data-burst-text className="text-center text-ink">
                    <span className="jp-sub block !opacity-80">第一章 · 扉の向こう</span>
                    <span className="h-display mt-2 block text-[min(12vw,22svh)] leading-[0.84]">Step inside</span>
                    <span className="label mt-4 block">↓ the shop is right here</span>
                  </p>
                </div>
              </div>
            </div>
            {/* scroll distance for the sticky door (phones/tablets only) */}
            <div aria-hidden="true" className="h-[38svh] lg:hidden" />
          </div>

          {/* ── P3 + P4: two small panels (desktop; phones get the cue inside the sticky door panel) ── */}
          <div className="hidden lg:contents">
            <div data-small data-slam="b" data-reveal="pending" className={`${LAYER} z-[1] min-h-[150px] overflow-hidden bg-volt text-ink lg:min-h-0 ${CLIP_CLS}`} style={clip(CLIP.m3, CLIP.p3)}>
              <div className="absolute inset-0 text-ink/15" aria-hidden="true">
                <div className="h-full w-full bg-current" style={{ WebkitMaskImage: 'var(--tone-dense)', maskImage: 'var(--tone-dense)' }} />
              </div>
              <div className="relative flex h-full flex-col justify-between p-4 lg:absolute lg:left-[55.6%] lg:top-[64.6%] lg:h-[20%] lg:w-[16.5%] lg:p-0">
                <span data-gogo className="inline-block origin-left">
                  <span data-gogo-idle className="inline-block">
                    <Sfx text="ゴゴゴ" tone="paper" rotate={-7} style={{ fontSize: 'clamp(2.2rem, 3.7vw, 4.2rem)' }} />
                  </span>
                </span>
                <p className="label max-w-[22ch] text-[10px] leading-[1.45] lg:text-[11px]">ゴゴゴ — the rumble before a reveal</p>
              </div>
            </div>
            <div data-small data-slam="br" data-reveal="pending" className={`${LAYER} z-[1] min-h-[150px] overflow-hidden bg-lav text-ink lg:min-h-0 ${CLIP_CLS}`} style={clip(CLIP.m4, CLIP.p4)}>
              <div
                data-cue
                className="relative flex h-full flex-col justify-between p-4 pl-6 lg:absolute lg:left-[76%] lg:top-[64.6%] lg:h-[20%] lg:w-[17.5%] lg:p-0"
              >
                <p className="h-display text-[clamp(30px,8.4vw,44px)] leading-[0.86] lg:text-[min(2.9vw,6.2svh)]">
                  <span className="motion-reduce:hidden">
                    Scroll
                    <br />
                    to open
                  </span>
                  <span className="hidden motion-reduce:inline">
                    The door
                    <br />
                    is open
                  </span>
                </p>
                <div className="flex items-end justify-between gap-2">
                  <span lang="ja" className="jp-sub !opacity-70 text-[11px] !tracking-[0.2em]">
                    扉を開けて
                  </span>
                  <span data-cue-arrow aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center border-[3px] border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)]">
                    <span className="font-mono text-[18px] leading-none">↓</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ticker band (#37) ── */}
          <div data-ticker data-slam="up" data-reveal="pending" className="relative z-[2] -mx-3 py-3 md:-mx-4 lg:absolute lg:inset-x-0 lg:bottom-[2.2%] lg:mx-0 lg:py-0">
            <Ticker items={ticker} tone="ink" rotate={-1.5} size="md" label="Shop highlights" />
          </div>
        </div>
      </HeroMotion>
    </section>
  )
}
