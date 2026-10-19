// STUB by F1 so the home page renders with its H1. Owner: S01 section agent (replace freely).
import Link from 'next/link'
import type { SiteSettings } from '@/lib/types'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Sfx } from '@/components/fx/Sfx'
import { Ticker } from '@/components/fx/Ticker'
import { VerticalType } from '@/components/fx/VerticalType'
import { Magnetic } from '@/components/motion/Magnetic'
import { SplitReveal } from '@/components/motion/SplitReveal'

export default function S01Hero({ settings }: { settings?: SiteSettings }) {
  return (
    <section id="hero" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ink">
      <SpeedLines className="absolute inset-0 -z-10" intensity={0.3} focus={{ x: 0.72, y: 0.42 }} color="var(--color-tone-2)" />
      <VerticalType text="THE ESCAPE DOOR" jp="逃げ道" side="right" outline className="absolute inset-y-0 right-3 opacity-30" />
      <div className="container-x relative flex min-h-[calc(100svh-var(--header-h)-64px)] flex-col justify-center py-20 lg:pr-28">
        <p className="label text-volt">{settings?.heroKicker ?? 'Original anime merch · India'}</p>
        <SplitReveal as="h1" id="hero-title" trigger="load" className="h-display mt-5 max-w-[12ch] text-[clamp(56px,8.6vw,132px)]">
          Anime merch, drawn like a <em>living</em> manga volume
        </SplitReveal>
        {settings?.heroSub && <p className="mt-6 max-w-[46ch] text-[17px] text-tone-4 md:text-[19px]">{settings.heroSub}</p>}
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Magnetic>
            <Link
              href="/shop"
              data-cursor="OPEN"
              className="press label inline-flex min-h-12 items-center border-[3px] border-ink bg-volt px-6 py-4 text-[13px] font-bold text-ink shadow-hard-paper"
            >
              Shop anime merch
            </Link>
          </Magnetic>
          <Link
            href="/custom"
            className="press label inline-flex min-h-12 items-center border-[3px] border-paper px-6 py-4 text-[13px] font-bold text-paper hover:bg-paper hover:text-ink"
          >
            Start a custom order
          </Link>
        </div>
        <Sfx text="ドン!" size="xl" tone="volt" rotate={-10} pop className="pointer-events-none absolute bottom-[14%] right-[18%] hidden lg:block" />
      </div>
      <Ticker items={settings?.tickerWords ?? ['PICK YOUR ARC', 'CUSTOM MADE']} tone="volt" rotate={-2} size="md" className="relative my-4" />
    </section>
  )
}
