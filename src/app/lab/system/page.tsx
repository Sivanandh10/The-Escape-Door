// /lab/system — kitchen sink of every F1 token, fx and motion primitive. Dev QA only; noindex. Owner: F1.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Halftone } from '@/components/fx/Halftone'
import { InkSplat } from '@/components/fx/InkSplat'
import { Panel } from '@/components/fx/Panel'
import { PaperGrain } from '@/components/fx/PaperGrain'
import { Screentone } from '@/components/fx/Screentone'
import { Sfx } from '@/components/fx/Sfx'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Ticker } from '@/components/fx/Ticker'
import { VerticalType } from '@/components/fx/VerticalType'
import { Magnetic } from '@/components/motion/Magnetic'
import { Reveal } from '@/components/motion/Reveal'
import { SplitReveal } from '@/components/motion/SplitReveal'
import { Tilt } from '@/components/motion/Tilt'
import { ArcDemo, ToastDemo } from './Demos'

export const metadata: Metadata = {
  title: 'Lab · Design system',
  robots: { index: false, follow: false },
}

const COLOURS = [
  ['ink', '#0B0B0F', 'bg-ink text-paper'],
  ['paper', '#F4EFE6', 'bg-paper text-ink'],
  ['volt', '#FFE14D', 'bg-volt text-ink'],
  ['lav', '#C9B8FF', 'bg-lav text-ink'],
  ['door', '#6D3BFF', 'bg-door text-paper'],
  ['pink', '#FFB8DE', 'bg-pink text-ink'],
  ['hype', '#FF2D3D', 'bg-hype text-paper'],
  ['tone-1', '#1A1A20', 'bg-tone-1 text-paper'],
  ['tone-2', '#2B2B33', 'bg-tone-2 text-paper'],
  ['tone-3', '#6E6E78', 'bg-tone-3 text-paper'],
  ['tone-4', '#B9B5AC', 'bg-tone-4 text-ink'],
] as const

function Block({ n, title, jp, note, children, tone = 'ink' }: { n: string; title: string; jp: string; note?: string; children: ReactNode; tone?: 'ink' | 'paper' }) {
  return (
    <section className={tone === 'paper' ? 'border-t-4 border-ink bg-paper text-ink grain' : 'border-t-4 border-tone-2 bg-ink text-paper'}>
      <div className="container-x py-14 md:py-20">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="label opacity-60">{n}</span>
          <h2 className="font-display text-[clamp(34px,5vw,64px)] uppercase leading-[0.92]">{title}</h2>
          <span lang="ja" aria-hidden="true" className="jp-sub">
            {jp}
          </span>
        </div>
        {note && <p className="label mt-3 max-w-3xl normal-case tracking-normal opacity-70">{note}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}

function Cap({ children }: { children: ReactNode }) {
  return <p className="label mt-3 opacity-70">{children}</p>
}

export default function SystemLab() {
  return (
    <>
      <header className="relative overflow-hidden bg-ink">
        <SpeedLines className="absolute inset-0" intensity={0.5} focus={{ x: 0.85, y: 0.5 }} color="var(--color-tone-2)" />
        <div className="container-x relative py-20 md:py-28">
          <p className="label text-volt">Lab · F1 design system</p>
          <h1 className="h-display mt-4 max-w-[12ch] text-h1">
            Manga page come <em>alive</em>
          </h1>
          <p className="mt-5 max-w-[52ch] text-tone-4">
            Every token, texture and motion primitive the shell and sections build on. Scroll velocity drives the speed lines and tickers.
          </p>
        </div>
      </header>

      <Block n="01" title="Colour" jp="色" tone="paper" note="Core five cover 90% of every screen. Per-arc accents recolour bg-arc-a / bg-arc-b via useArcTheme().">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {COLOURS.map(([name, hex, cls]) => (
            <li key={name} className={`flex h-28 flex-col justify-between border-4 border-ink p-3 ${cls}`}>
              <span className="font-display text-[22px] uppercase leading-none">{name}</span>
              <span className="label opacity-80">{hex}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <ArcDemo />
        </div>
      </Block>

      <Block n="02" title="Type" jp="書体">
        <div className="space-y-6">
          <p className="h-display text-h1">Display H1</p>
          <h2 className="h-display text-h2">
            Pick your <em>arc</em>: H2 with accent
          </h2>
          <p className="h-display text-h2">
            Lavender <em className="accent accent-lav">accent</em> &amp; door <em className="accent accent-door">accent</em>
          </p>
          <p className="h-display text-h3">H3 · Anton 28–40px</p>
          <p className="max-w-[60ch] text-body">
            Body copy in DM Sans at 17px with a 1.55 line-height. An <em className="accent accent-text">accent in body text</em> uses the tighter accent-text inset.
          </p>
          <p className="label">Label · JetBrains Mono · ₹1,200</p>
          <p lang="ja" className="jp-sub">
            呪術廻戦 · 進撃の巨人 · 鬼滅の刃
          </p>
          <p className="outline-text h-display text-h2">Outline text</p>
          <div className="flex flex-wrap items-end gap-8 pt-4">
            <span className="font-sfx text-[56px] leading-none">Bangers SFX</span>
            <span lang="ja" className="font-sfx-jp text-[56px] leading-none">
              ゴゴゴ
            </span>
          </div>
        </div>
      </Block>

      <Block n="03" title="Panels" jp="コマ" tone="paper" note="Panel tone / slant / shadow. Hard offsets only — never blur.">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel tone="volt" shadow="ink" innerClassName="p-5">
            <p className="font-display text-[32px] uppercase leading-none">Volt · shadow</p>
          </Panel>
          <Panel tone="ink" slant="right" shadow="door" innerClassName="p-5 pr-16">
            <p className="font-display text-[32px] uppercase leading-none">Ink · slant right</p>
          </Panel>
          <Panel tone="lav" slant="left" innerClassName="p-5 pl-16">
            <p className="font-display text-[32px] uppercase leading-none">Lav · slant left</p>
          </Panel>
          <div className="panel-paper p-5 shadow-hard">
            <p className="label">.panel-paper .shadow-hard</p>
          </div>
          <div className="panel bg-door p-5 text-paper shadow-hard-volt">
            <p className="label">.panel .shadow-hard-volt</p>
          </div>
          <div className="relative border-4 border-ink bg-paper p-5">
            <PaperGrain opacity={0.8} />
            <p className="label relative">PaperGrain</p>
          </div>
        </div>
      </Block>

      <Block n="04" title="Screentone & halftone" jp="トーン" note="#58 — dot screens replace gradients. Halftone is canvas; `form` gathers dots on first view.">
        <div className="grid gap-4 sm:grid-cols-3">
          {(['light', 'mid', 'dense'] as const).map((d) => (
            <div key={d} className="relative h-40 overflow-hidden border-4 border-paper">
              <Screentone density={d} color="var(--color-lav)" opacity={0.7} fade="bottom" drift />
              <span className="label absolute bottom-3 left-3">density {d}</span>
            </div>
          ))}
          <div className="relative h-48 overflow-hidden border-4 border-paper bg-door">
            <Halftone shape="radial" color="var(--color-volt)" form />
            <span className="label absolute bottom-3 left-3">halftone radial · form</span>
          </div>
          <div className="relative h-48 overflow-hidden border-4 border-paper bg-paper">
            <Halftone shape="linear" from="bottom" color="var(--color-ink)" dotSize={7} />
            <span className="label absolute bottom-3 left-3 text-ink">halftone linear</span>
          </div>
          <div className="screentone screentone-dense relative h-48 border-4 border-paper bg-pink text-ink [--tone-color:var(--color-door)]">
            <span className="label absolute bottom-3 left-3">.screentone-dense</span>
          </div>
        </div>
      </Block>

      <Block n="05" title="Impact" jp="衝撃" tone="paper" note="InkSplat ×6 (original shapes), Sfx onomatopoeia (decorative, aria-hidden), speed lines.">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {([1, 2, 3, 4, 5, 6] as const).map((v) => (
            <div key={v} className="flex flex-col items-center">
              <InkSplat variant={v} color={v % 2 ? 'var(--color-ink)' : 'var(--color-door)'} className="size-24" />
              <Cap>splat {v}</Cap>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-10">
          <Sfx text="ドン!" size="lg" tone="volt" />
          <Sfx text="BAM!" size="lg" tone="hype" rotate={6} />
          <Sfx text="ゴゴゴ" size="md" tone="lav" rotate={-3} />
          <Sfx text="SNAP!" size="md" tone="ink" rotate={4} pop />
        </div>
        <div className="relative mt-10 h-64 overflow-hidden border-4 border-ink bg-ink">
          <SpeedLines intensity={0.55} animated focus={{ x: 0.5, y: 0.5 }} className="absolute inset-0" />
          <span className="absolute inset-0 grid place-items-center">
            <Sfx text="バン!" size="xl" tone="volt" />
          </span>
        </div>
      </Block>

      <section className="overflow-hidden border-t-4 border-tone-2 bg-ink py-16" aria-label="Tickers">
        <Ticker items={['YOU ARE MY SPECIAL', 'PICK YOUR ARC', 'ドン', 'CUSTOM MADE']} tone="volt" rotate={-3} size="lg" />
        <Ticker items={['OVERSIZED ₹800', '3 POLAROIDS ₹100', '新作', 'FANDOM PARTNER']} tone="lav" rotate={2} direction="right" className="mt-6" />
        <Ticker items={['THOMSO', 'FLUXUS', 'ZEITGEIST', 'BLITHCHRON']} tone="ink" size="sm" className="mt-6" />
      </section>

      <Block n="06" title="Motion" jp="動き" tone="paper" note="Hover the cards (pointer: fine). Magnetic #30 · Tilt #29 · Cursor labels #31 · SplitReveal #04 · Reveal #07/#08.">
        <div className="flex flex-wrap items-center gap-10">
          <Magnetic>
            <a href="#motion" data-cursor="OPEN" className="press label inline-flex min-h-12 items-center border-[3px] border-ink bg-volt px-6 py-4 font-bold text-ink shadow-hard">
              Magnetic · OPEN
            </a>
          </Magnetic>
          <Tilt max={10} glare className="w-56">
            <div data-cursor="ADD" className="flex h-64 flex-col justify-end border-4 border-ink bg-lav p-4 shadow-hard">
              <span className="font-display text-[30px] uppercase leading-none">Tilt + glare</span>
              <span className="label mt-2">cursor: ADD</span>
            </div>
          </Tilt>
          <div data-cursor="VIEW" className="flex h-40 w-48 items-end border-4 border-ink bg-pink p-4">
            <span className="label">cursor: VIEW</span>
          </div>
          <div data-cursor="DRAG" className="flex h-40 w-48 items-end border-4 border-ink bg-paper p-4">
            <span className="label">cursor: DRAG</span>
          </div>
        </div>
        <div id="motion" className="mt-16">
          <SplitReveal className="h-display text-h2">
            Split text rises out of its <em>mask</em>
          </SplitReveal>
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-4" variant="slam">
            {['Slam', 'Stagger', 'Hold', 'Turn'].map((w) => (
              <div key={w} className="border-4 border-ink bg-volt p-6 shadow-hard">
                <span className="font-display text-[34px] uppercase leading-none">{w}</span>
              </div>
            ))}
          </Reveal>
        </div>
        <div className="mt-12">
          <ToastDemo />
        </div>
      </Block>

      <section className="relative min-h-[70vh] overflow-hidden border-t-4 border-tone-2 bg-ink" aria-label="Vertical type">
        <VerticalType text="THE ESCAPE DOOR" jp="逃げ道" side="left" className="absolute inset-y-0 left-2 text-paper" always />
        <VerticalType text="PICK YOUR ARC" side="right" outline className="absolute inset-y-0 right-2 opacity-40" always />
        <div className="container-x grid min-h-[70vh] place-items-center">
          <p className="label text-tone-4">VerticalType rails (left filled · right outline)</p>
        </div>
      </section>
    </>
  )
}
