'use client'
// S07 scanner island (real hoodie per tier via HoodieDeck). One scalar `g` (0..1) drives everything through CSS vars (--g, --sp) and direct
// text writes, so scrolling never re-renders React; only a tier change (4×) does.
// ≥1024 + motion: pinned (#10) — scroll scans LV.1 → LV.4, then holds on the last tier.
// <1024: no pin — a one-shot "power up" charge on enter, tiers by tap. Reduced motion: static, LV.4 shown.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import type { HoodieTier } from '@/lib/types'
import { formatINR } from '@/lib/pricing'
import { EASE, registerGsap, useReducedMotion } from '@/lib/motion'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Sfx } from '@/components/fx/Sfx'
import { SplitReveal } from '@/components/motion/SplitReveal'
import { cn, clamp, lerp } from '@/lib/utils'
import { HoodieDeck, sheetsFor, type TierShot } from './HoodieDeck'
import { PowerGauge } from './PowerGauge'
import { S07_CSS } from './styles'

registerGsap()

export type { TierShot }

/** share of the pinned scroll that scans; the rest holds on the top tier */
const SCAN = 0.86

export default function GsmScanner({ tiers, shots = [] }: { tiers: HoodieTier[]; shots?: Array<TierShot | null> }) {
  const n = tiers.length
  const root = useRef<HTMLElement>(null)
  const pinEl = useRef<HTMLDivElement>(null)
  const exitEl = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const shake = useRef<HTMLDivElement>(null)
  const lvRef = useRef<HTMLSpanElement>(null)
  const priceRef = useRef<HTMLSpanElement>(null)
  const g = useRef({ v: 0 })
  const idxRef = useRef(0)
  const priceVal = useRef({ v: tiers[0].price })
  const mode = useRef<{ pinned: ScrollTrigger | null; tween: gsap.core.Tween | null }>({ pinned: null, tween: null })
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState(false)
  const reduced = useReducedMotion()
  const t = tiers[active]
  const shot = shots[active] ?? null
  const isMax = active === n - 1

  const apply = useCallback(
    (v: number) => {
      const el = root.current
      if (!el) return
      const gv = clamp(v, 0, 1)
      const idx = Math.min(n - 1, Math.floor(gv * n))
      const tier = tiers[idx]
      const gsm = Math.round(lerp(tier.gsmMin, tier.gsmMax, clamp(gv * n - idx, 0, 1)))
      el.style.setProperty('--g', gv.toFixed(4))
      el.querySelectorAll<HTMLElement>('[data-gsm-num]').forEach((node) => {
        node.textContent = String(gsm)
      })
      if (idx !== idxRef.current) {
        idxRef.current = idx
        setActive(idx)
      }
    },
    [n, tiers],
  )

  // tier change → #17 price count, LV slam, impact shake at max
  useEffect(() => {
    const el = priceRef.current
    if (!el) return
    const price = tiers[active].price
    if (reduced) {
      priceVal.current.v = price
      el.textContent = formatINR(price)
      return
    }
    const tw = gsap.to(priceVal.current, {
      v: price,
      duration: 0.7,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = formatINR(Math.round(priceVal.current.v / 10) * 10)
      },
    })
    const slam = lvRef.current
      ? gsap.fromTo(lvRef.current, { scale: 1.4, rotate: -5 }, { scale: 1, rotate: 0, duration: 0.45, ease: EASE.slam })
      : null
    const quake =
      active === n - 1 && shake.current
        ? gsap.to(shake.current, { keyframes: { x: [-8, 7, -5, 4, -2, 0] }, duration: 0.34, ease: 'none' })
        : null
    return () => {
      tw.kill()
      slam?.kill()
      quake?.kill()
    }
  }, [active, n, reduced, tiers])

  useGSAP(
    () => {
      const el = root.current
      const pin = pinEl.current
      if (!el || !pin) return
      apply(g.current.v)
      const mm = gsap.matchMedia()
      mm.add(
        {
          desk: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
          mob: '(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)',
          red: '(prefers-reduced-motion: reduce)',
        },
        (ctx) => {
          const { desk, red } = ctx.conditions as { desk: boolean; mob: boolean; red: boolean }
          if (red) {
            setArmed(true)
            g.current.v = 1
            apply(1)
            return
          }
          // entrance: tier rows + readout slide in
          gsap.from('[data-s07-in]', {
            y: 36,
            opacity: 0,
            duration: 0.8,
            stagger: 0.07,
            ease: EASE.out,
            scrollTrigger: { trigger: el, start: 'top 72%', once: true },
          })
          ScrollTrigger.create({ trigger: el, start: 'top 70%', once: true, onEnter: () => setArmed(true) })
          // exit: the page slides away under the next panel
          if (exitEl.current)
            gsap.to(exitEl.current, {
              yPercent: -6,
              scale: 0.97,
              opacity: 0.45,
              ease: 'none',
              // created before the pin below → refresh after it so the pin spacer is counted (else it dims mid-pin)
              scrollTrigger: { trigger: el, start: 'bottom bottom', end: 'bottom top', scrub: true, refreshPriority: -1 },
            })

          if (desk) {
            const tl = gsap.timeline({
              scrollTrigger: { trigger: pin, start: 'top top', end: '+=260%', pin: true, scrub: 0.6, anticipatePin: 1 },
            })
            tl.to(g.current, { v: 1, duration: SCAN, ease: 'none', onUpdate: () => apply(g.current.v) }).to({}, { duration: 1 - SCAN })
            mode.current.pinned = tl.scrollTrigger ?? null
            return () => {
              mode.current.pinned = null
            }
          }
          // mobile / tablet: one-shot power-up charge
          ScrollTrigger.create({
            trigger: stage.current,
            start: 'top 70%',
            once: true,
            onEnter: () => {
              mode.current.tween?.kill()
              mode.current.tween = gsap.to(g.current, {
                v: 1,
                duration: 2.4,
                delay: 0.35,
                ease: 'power2.inOut',
                onUpdate: () => apply(g.current.v),
              })
            },
          })
          return () => {
            mode.current.tween?.kill()
          }
        },
      )
      return () => mm.revert()
    },
    { scope: root },
  )

  const select = (i: number) => {
    setArmed(true)
    const st = mode.current.pinned
    if (st) {
      const y = st.start + ((i + 0.6) / n) * SCAN * (st.end - st.start)
      if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.1 })
      else window.scrollTo({ top: y, behavior: 'smooth' })
      return
    }
    mode.current.tween?.kill()
    const to = i === n - 1 ? 1 : (i + 0.999) / n
    if (reduced) {
      g.current.v = to
      apply(to)
      return
    }
    mode.current.tween = gsap.to(g.current, { v: to, duration: 0.8, ease: EASE.inOut, onUpdate: () => apply(g.current.v) })
  }

  const range = `${tiers[0].gsmMin} to ${tiers[n - 1].gsmMax} GSM`

  return (
    <section
      ref={root}
      id="gsm"
      aria-labelledby="gsm-title"
      className="s07 relative border-t-4 border-ink bg-ink text-paper"
      style={{ '--g': 0, '--n': sheetsFor(active) } as CSSProperties}
      data-max={isMax || undefined}
    >
      <style>{S07_CSS}</style>
      <div ref={pinEl} className="relative overflow-hidden lg:h-svh lg:min-h-[760px]">
        {/* idle: drifting screentone wash on the void */}
        <div aria-hidden="true" className="s07-tone pointer-events-none absolute inset-0" />
        <div
          ref={exitEl}
          className="container-x relative grid h-full gap-10 py-[72px] md:py-24 lg:grid-cols-12 lg:gap-8 lg:pb-12 lg:pt-[112px]"
        >
          {/* ── left: title + tier selector ─────────────────────────── */}
          <div className="flex min-w-0 flex-col lg:col-span-4">
            <p className="label text-volt">Chapter 07 · Hoodie power levels</p>
            <SplitReveal
              as="h2"
              id="gsm-title"
              className="h-display mt-4 text-[clamp(46px,12vw,72px)] lg:text-[clamp(52px,4.6vw,80px)]"
            >
              Hoodie power <em>levels</em>: {range}
            </SplitReveal>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
              パワーレベル ・ 戦闘力スキャン
            </span>
            <p className="mt-5 max-w-[44ch] text-[16px] leading-[1.55] text-paper/80" data-s07-in>
              We price hoodies by fabric weight. GSM is grams per square metre: the higher the number, the thicker
              and warmer the hoodie. Any tier can carry your own print.
            </p>

            <ul aria-label="Hoodie GSM tiers" className="mt-7 grid grid-cols-2 gap-2.5 lg:mt-auto lg:grid-cols-1 lg:pt-6">
              {tiers.map((tier, i) => {
                const on = active === i
                return (
                  <li key={tier.id} data-s07-in>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => select(i)}
                      className={cn(
                        'press focus-ring group relative flex min-h-11 w-full flex-col items-start gap-1 border-[3px] px-3 py-2.5 text-left',
                        'lg:flex-row lg:items-center lg:gap-3',
                        on
                          ? 'border-volt bg-volt text-ink shadow-[4px_4px_0_0_var(--color-door)]'
                          : 'border-paper/35 bg-ink text-paper can-hover:hover:border-paper can-hover:hover:bg-tone-1',
                      )}
                    >
                      <span className={cn('label', on ? 'text-ink' : 'text-volt')}>{tier.code}</span>
                      <span className="font-display text-[22px] uppercase leading-none lg:text-[24px]">{tier.name}</span>
                      <span className={cn('font-mono text-[12px] lg:ml-auto', on ? 'text-ink/75' : 'text-paper/65')}>
                        {tier.gsmLabel}
                      </span>
                      <span className="font-mono text-[15px] font-bold tabular-nums lg:w-[64px] lg:text-right">
                        {formatINR(tier.price)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ── centre: the scanner stage — a real hoodie per tier, layered by fabric weight ─── */}
          <div className="flex min-w-0 flex-col lg:col-span-5">
            <div
              ref={stage}
              className="s07-stage relative h-[360px] overflow-hidden border-[3px] border-paper/25 sm:h-[440px] lg:h-auto lg:min-h-0 lg:flex-1"
            >
              <SpeedLines
                intensity={0.08 + active * 0.17}
                inner={0.34}
                focus={{ x: 0.5, y: 0.52 }}
                color={isMax ? '#FFE14D' : '#F4EFE6'}
                count={120}
                animated={isMax && !reduced}
                className="opacity-30"
              />
              <ScanFrame active={active} n={n} isMax={isMax} />
              <div ref={shake} className="absolute inset-0">
                <HoodieDeck tiers={tiers} shots={shots} active={active} armed={armed} />
              </div>
              {isMax && (
                <span aria-hidden="true" className="s07-sfx absolute right-[5%] top-[13%] z-10">
                  <Sfx text="ゴゴゴ" size="md" tone="volt" rotate={-8} className="s07-rumble" />
                </span>
              )}
            </div>
            <div key={active} className="s07-swap mt-4 min-h-[96px]">
              <p className="label text-volt">
                {t.code} · {t.gsmLabel}
              </p>
              <p className="mt-1 font-display text-[clamp(30px,3vw,42px)] uppercase leading-none">{t.name}</p>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-[1.5] text-paper/75">{t.feel}</p>
              {shot && (
                <Link
                  href={`/product/${shot.slug}`}
                  data-cursor="VIEW"
                  className="focus-ring label mt-3 inline-flex min-h-11 items-center gap-2 text-paper underline decoration-volt decoration-2 underline-offset-4 can-hover:hover:text-volt"
                >
                  On the stand: {shot.name} hoodie <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>

          {/* ── right: POWER LEVEL readout + vertical gauge ─────────────── */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-5 lg:flex-1">
              <div className="flex min-w-0 flex-col" data-s07-in>
                <div className="border-[3px] border-paper bg-tone-1 p-4 shadow-[6px_6px_0_0_var(--color-door)]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="label text-volt">Power level</span>
                    <span lang="ja" aria-hidden="true" className="jp-sub !tracking-[0.2em]">
                      戦闘力
                    </span>
                  </div>
                  <p aria-hidden="true" className="mt-2 font-display text-[clamp(64px,16vw,104px)] uppercase leading-[0.82] lg:text-[clamp(64px,6vw,104px)]">
                    <span ref={lvRef} className="inline-block origin-bottom-left">
                      LV.<span className={cn(isMax && 'text-volt')}>{t.level}</span>
                    </span>
                  </p>
                  <dl aria-hidden="true" className="mt-4 grid grid-cols-2 gap-3 border-t-2 border-paper/20 pt-3">
                    <div>
                      <dt className="label text-paper/55">Fabric</dt>
                      <dd className="mt-1 font-mono text-[24px] font-bold leading-none tabular-nums">
                        <span data-gsm-num>{tiers[0].gsmMin}</span>
                        <span className="ml-1 text-[12px] font-medium text-paper/70">GSM</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="label text-paper/55">Price</dt>
                      <dd className="mt-1 font-mono text-[24px] font-bold leading-none tabular-nums text-volt">
                        <span ref={priceRef}>{formatINR(tiers[0].price)}</span>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-auto hidden flex-col gap-3 pt-6 lg:flex">
                  <ShopLinks />
                </div>
              </div>
              <PowerGauge tiers={tiers} active={active} orientation="v" className="hidden lg:block" />
            </div>
            <PowerGauge tiers={tiers} active={active} orientation="h" className="lg:hidden" />
            <div className="flex flex-col gap-3 sm:flex-row lg:hidden">
              <ShopLinks />
            </div>
            <p className="sr-only" aria-live="polite">
              {`${t.code} ${t.name}: ${t.gsmLabel}, ${formatINR(t.price)}.`}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ShopLinks() {
  return (
    <>
      <Link
        href="/shop/hoodies"
        data-cursor="OPEN"
        className="press focus-ring label inline-flex min-h-12 items-center justify-center gap-3 border-[3px] border-ink bg-volt px-6 py-4 font-bold text-ink shadow-[6px_6px_0_0_var(--color-door)]"
      >
        Shop hoodies <span aria-hidden="true">→</span>
      </Link>
      <Link
        href="/custom?product=hoodie"
        className="focus-ring label inline-flex min-h-11 items-center justify-center gap-2 px-2 py-2 text-paper/80 underline decoration-2 underline-offset-4 can-hover:hover:text-volt"
      >
        Print your own design on any tier
      </Link>
    </>
  )
}

function ScanFrame({ active, n, isMax }: { active: number; n: number; isMax: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-3 z-10">
      <span className="s07-corner left-0 top-0 border-l-[3px] border-t-[3px]" />
      <span className="s07-corner right-0 top-0 border-r-[3px] border-t-[3px]" />
      <span className="s07-corner bottom-0 left-0 border-b-[3px] border-l-[3px]" />
      <span className="s07-corner bottom-0 right-0 border-b-[3px] border-r-[3px]" />
      <span className="label absolute left-4 top-3 flex items-center gap-2 text-paper/80">
        <span className={cn('s07-dot inline-block size-2 rounded-full', isMax ? 'bg-hype' : 'bg-volt')} />
        {isMax ? 'Max power' : 'Scanning fabric'}
      </span>
      <span className="label absolute right-4 top-3 tabular-nums text-paper/60">
        {String(active + 1).padStart(2, '0')}/{String(n).padStart(2, '0')}
      </span>
      <span className="label absolute bottom-3 left-4 hidden max-w-[30ch] normal-case sm:block tracking-[0.04em] text-paper/45">
        More layers = heavier fabric
      </span>
    </div>
  )
}
