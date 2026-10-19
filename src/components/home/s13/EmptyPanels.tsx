// S13 designed empty state: six manga panel frames of what lands on @escapedoor.in first.
// Frames are a redundant visual link to the profile (aria-hidden, out of tab order) — the real,
// labelled CTA is the follow button above. Owner: s13.
import type { ReactNode } from 'react'
import { DoorIcon } from '@/components/brand'
import { KadoArt } from '@/components/brand/BrandArt'
import { Screentone } from '@/components/fx/Screentone'
import { cn } from '@/lib/utils'

interface Frame {
  title: string
  jp: string
  note: string
  bg: string
  fg: string
  art: ReactNode
}

const FRAMES: Frame[] = [
  {
    title: 'New drops',
    jp: '新作',
    note: 'first look',
    bg: 'bg-volt',
    fg: 'text-ink',
    art: (
      <>
        <span className="s13-burst absolute inset-0" style={{ ['--burst' as string]: 'var(--color-ink)' }} />
        <span className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 -rotate-6 border-[3px] border-ink bg-paper px-3 py-1 font-sfx text-[clamp(1.6rem,2.4vw,2.4rem)] leading-none text-ink shadow-[4px_4px_0_0_var(--color-ink)]">
          NEW!
        </span>
      </>
    ),
  },
  {
    title: 'Fest stalls',
    jp: '出店',
    note: 'where we pop up next',
    bg: 'bg-tone-2',
    fg: 'text-paper',
    art: (
      <>
        <Screentone density="mid" color="var(--color-paper)" opacity={0.18} fade="top" />
        <span className="absolute left-1/2 top-[48%] grid -translate-x-1/2 -translate-y-1/2 place-items-center">
          <span className="relative block h-[clamp(64px,7vw,96px)] w-[clamp(96px,11vw,150px)] border-[3px] border-paper">
            <span className="absolute -top-[3px] left-0 right-0 h-[38%] border-[3px] border-paper [background:repeating-linear-gradient(90deg,var(--color-volt)_0_16px,var(--color-ink)_16px_32px)]" />
          </span>
          <span className="mt-2 flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-paper">
            <span className="s13-blink size-2 rounded-full bg-hype" /> stall alert
          </span>
        </span>
      </>
    ),
  },
  {
    title: 'Say hi',
    jp: 'こんにちは',
    note: '@escapedoor.in',
    bg: 'bg-lav',
    fg: 'text-ink',
    art: (
      <>
        <Screentone density="light" color="var(--color-ink)" opacity={0.16} fade="bottom" />
        <span className="absolute bottom-[22%] left-1/2 block w-[58%] -translate-x-1/2">
          <KadoArt name="kado-wave-anim-flat" className="block h-auto w-full" />
        </span>
        <span className="absolute right-[8%] top-[16%] rotate-3 border-[3px] border-ink bg-paper px-2 py-1 font-sfx text-[0.95rem] leading-none text-ink">
          FOLLOW!
        </span>
      </>
    ),
  },
  {
    title: 'Custom-made',
    jp: '特注',
    note: 'DM to personalize',
    bg: 'bg-paper',
    fg: 'text-ink',
    art: (
      <>
        <Screentone density="dense" color="var(--color-ink)" opacity={0.1} />
        <span className="absolute left-1/2 top-[46%] block -translate-x-1/2 -translate-y-1/2 -rotate-3 border-[3px] border-dashed border-ink px-4 py-3 text-center font-display text-[clamp(1.4rem,2.2vw,2.2rem)] uppercase leading-[0.9] text-ink">
          Your
          <br />
          design
        </span>
      </>
    ),
  },
  {
    title: 'Pop-ups',
    jp: 'ポップアップ',
    note: 'collabs & events',
    bg: 'bg-door',
    fg: 'text-paper',
    art: (
      <>
        <Screentone density="mid" color="var(--color-ink)" opacity={0.3} fade="edge" />
        <span className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 text-paper">
          <DoorIcon open={0.55} size={88} strokeWidth={1.6} title="" />
        </span>
      </>
    ),
  },
  {
    title: 'Collabs',
    jp: 'コラボ',
    note: 'fandom partner',
    bg: 'bg-pink',
    fg: 'text-ink',
    art: (
      <>
        <Screentone density="mid" color="var(--color-ink)" opacity={0.14} fade="right" />
        <span className="absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 items-center font-display text-[clamp(2.6rem,4vw,4rem)] leading-none text-ink">
          <span className="grid size-[1.3em] place-items-center border-[3px] border-ink bg-paper">E</span>
          <span className="mx-1 font-sfx text-[0.6em]">×</span>
          <span className="grid size-[1.3em] place-items-center border-[3px] border-ink bg-volt">?</span>
        </span>
      </>
    ),
  },
]

export function EmptyPanels({ instagram }: { instagram: string }) {
  return (
    <ul
      className="s13-strip -mx-[var(--gutter)] flex gap-4 overflow-x-auto px-[var(--gutter)] pb-4 pt-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-6"
      aria-label="What lands on Instagram first"
    >
      {FRAMES.map((f, i) => (
        <li key={f.title} className={cn('w-[62%] shrink-0 md:w-auto', i % 2 === 1 && 'lg:translate-y-8')}>
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            aria-hidden="true"
            className={cn('s13-frame group relative block aspect-[4/5] overflow-hidden border-[3px] border-paper', f.fg)}
          >
            <span className={cn('s13-zoom absolute inset-0 block', f.bg)}>{f.art}</span>
            <span className="s13-alt absolute inset-0 grid place-items-center bg-ink/55">
              <span className="label border-2 border-paper bg-ink px-3 py-2 text-paper">Open ↗</span>
            </span>
            <span className="absolute inset-x-3 top-3 flex items-center justify-between font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
              <span>#{String(i + 1).padStart(2, '0')}</span>
              <span lang="ja" className="font-jp font-bold tracking-[0.2em]">
                {f.jp}
              </span>
            </span>
            <span className="absolute inset-x-3 bottom-3 block">
              <span className="block font-display text-[clamp(1.5rem,2vw,2rem)] uppercase leading-[0.9]">{f.title}</span>
              <span className="mt-1 block font-mono text-[0.625rem] uppercase tracking-[0.14em] opacity-80">{f.note}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
